import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useVoiceActivation } from '../../context/VoiceActivationContext';
import { 
  classifyIntent, 
  AGENT_TYPES, 
  executeStatusQuery,
  executeLocationQuery,
  resolveMapMarkerLocation
} from '../../services/wakeWord/agentOrchestrator';
import { getUIStrings } from '../../utils/localizedStrings';
import { BACKEND_URL } from '../../utils/api';
import LanguageSelector from '../LanguageSelector';
import './SiriAssistant.css';

const API_BASE = `${BACKEND_URL}/api/gnani`;

// Format time
function formatDuration(sec) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s < 10 ? '0' : ''}${s}`;
}

// Convert audio recorded to true 16kHz mono PCM WAV for Gnani Prisma STT
function encodeWav(buf) {
  const ch = buf.getChannelData(0);
  const n = ch.length;
  const dv = new DataView(new ArrayBuffer(44 + n * 2));
  const w = (o, s) => [...s].forEach((c, i) => dv.setUint8(o + i, c.charCodeAt(0)));
  w(0, 'RIFF'); dv.setUint32(4, 36 + n * 2, true); w(8, 'WAVE'); w(12, 'fmt '); dv.setUint32(16, 16, true); dv.setUint16(20, 1, true); dv.setUint16(22, 1, true);
  dv.setUint32(24, 16000, true); dv.setUint32(28, 32000, true); dv.setUint16(32, 2, true); dv.setUint16(34, 16, true); w(36, 'data'); dv.setUint32(40, n * 2, true);
  for (let i = 0; i < n; i++) {
    const s = Math.max(-1, Math.min(1, ch[i]));
    dv.setInt16(44 + i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  return new Blob([dv], { type: 'audio/wav' });
}

async function toWav16kMono(blob) {
  const Ctx = window.AudioContext || window.webkitAudioContext;
  const ctx = new Ctx();
  try {
    const decoded = await ctx.decodeAudioData(await blob.arrayBuffer());
    const off = new OfflineAudioContext(1, Math.max(1, Math.ceil(decoded.duration * 16000)), 16000);
    const src = off.createBufferSource();
    src.buffer = decoded;
    src.connect(off.destination);
    src.start();
    return encodeWav(await off.startRendering());
  } finally {
    if (ctx.close) ctx.close();
  }
}

const authHeader = () => {
  const t = localStorage.getItem('token');
  return t ? { Authorization: `Bearer ${t}` } : {};
};

const SiriAssistantModal = ({ onComplaintConfirmed }) => {
  const {
    assistantOpen,
    closeAssistant,
    pendingCommand,
    setPendingCommand,
    wakeWordEnabled,
    toggleWakeWord,
    detectorStatus
  } = useVoiceActivation();

  // Assistant State Machine:
  // 'standby' | 'wake_detected' | 'listening' | 'processing' | 'speaking' | 'error' | 'permission_required'
  const [visualState, setVisualState] = useState('standby');
  const [activeAgent, setActiveAgent] = useState(AGENT_TYPES.GENERAL);
  const [transcript, setTranscript] = useState('');
  const [speechReply, setSpeechReply] = useState('');
  const [messages, setMessages] = useState([]);
  const [sessionId, setSessionId] = useState(null);
  const [lang, setLang] = useState({ code: 'hi-IN', name: 'Hindi', native: 'हिंदी' });
  const [showLanguagePicker, setShowLanguagePicker] = useState(false);
  const [languages, setLanguages] = useState([]);
  const [isMuted, setIsMuted] = useState(false);
  const [recDuration, setRecDuration] = useState(0);
  const [complaintContext, setComplaintContext] = useState({});
  const [errorMessage, setErrorMessage] = useState('');

  const audioRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const recTimerRef = useRef(null);
  const fileInputRef = useRef(null);
  const autoListenTimeoutRef = useRef(null);

  const t = getUIStrings(lang?.code);

  // Stop currently playing TTS audio safely
  const stopAudio = useCallback(() => {
    if (audioRef.current) {
      try { audioRef.current.pause(); } catch (_) {}
      audioRef.current = null;
    }
  }, []);

  // Play assistant voice via Gnani Timbre
  const speakText = useCallback((audioUrl) => {
    stopAudio();
    if (!audioUrl || isMuted) {
      setVisualState('standby');
      return;
    }

    const a = new Audio(audioUrl);
    audioRef.current = a;
    setVisualState('speaking');

    a.onended = () => {
      audioRef.current = null;
      setVisualState('standby');
    };
    a.onerror = () => {
      audioRef.current = null;
      setVisualState('standby');
    };
    a.play().catch(() => {
      setVisualState('standby');
    });
  }, [isMuted, stopAudio]);

  // Load language options
  useEffect(() => {
    fetch(`${API_BASE}/languages`)
      .then((r) => r.json())
      .then((d) => {
        if (d.languages) setLanguages(d.languages);
      })
      .catch(() => {});
  }, []);

  // Initialize session whenever modal opens
  useEffect(() => {
    if (!assistantOpen) {
      stopAudio();
      stopRecording();
      setVisualState('standby');
      setTranscript('');
      setSpeechReply('');
      return;
    }

    setVisualState('wake_detected');

    // Create conversation session on backend
    fetch(`${API_BASE}/session`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeader() },
      body: JSON.stringify({ language: lang.code })
    })
      .then((r) => r.json())
      .then((d) => {
        if (d.success) {
          setSessionId(d.sessionId);
          setComplaintContext(d.complaintContext || {});
          if (d.languageInfo) setLang(d.languageInfo);

          // If triggered with a spoken command right after wake phrase
          if (pendingCommand && pendingCommand.trim()) {
            handleCitizenSpeech(pendingCommand.trim(), d.sessionId);
            setPendingCommand(null);
          } else {
            // Greet citizen
            const greeting = d.greetingText || 'Ji, batayiye. Main aapki kya help kar sakta hoon?';
            setSpeechReply(greeting);
            setMessages([{ role: 'assistant', content: greeting }]);
            if (d.welcomeAudio && !isMuted) {
              speakText(d.welcomeAudio);
            } else {
              setVisualState('standby');
            }
          }
        }
      })
      .catch((err) => {
        setVisualState('error');
        setErrorMessage('Failed to connect to SwachhMap backend.');
      });

    return () => {
      stopAudio();
      if (recTimerRef.current) clearInterval(recTimerRef.current);
      if (autoListenTimeoutRef.current) clearTimeout(autoListenTimeoutRef.current);
    };
  }, [assistantOpen]); // eslint-disable-line

  // Send citizen speech into Phase 1, 2, 3 orchestrator
  const handleCitizenSpeech = async (spokenText, sid = sessionId) => {
    if (!spokenText || !spokenText.trim()) return;
    const currentSid = sid || sessionId;
    if (!currentSid) return;

    setTranscript(spokenText);
    setVisualState('processing');

    // Phase 1: Intent Classification
    const intent = classifyIntent(spokenText);
    setActiveAgent(intent.agent);

    // Phase 2: Status Agent handling
    if (intent.agent === AGENT_TYPES.STATUS) {
      const statusRes = await executeStatusQuery();
      setSpeechReply(statusRes.message);
      setMessages((prev) => [
        ...prev,
        { role: 'user', content: spokenText },
        { role: 'assistant', content: statusRes.message }
      ]);
      // Synthesize audio answer
      try {
        const synResp = await fetch(`${API_BASE}/synthesize`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...authHeader() },
          body: JSON.stringify({ text: statusRes.message, language: lang.code })
        });
        const synData = await synResp.json();
        if (synData.success && synData.audioDataUrl) {
          speakText(synData.audioDataUrl);
        } else {
          setVisualState('standby');
        }
      } catch (_) {
        setVisualState('standby');
      }
      return;
    }

    // Phase 3: Vision Agent handling ("Camera open karo")
    if (intent.agent === AGENT_TYPES.VISION) {
      const msg = 'Camera khol raha hoon. Kripya garbage ki photo upload karein.';
      setSpeechReply(msg);
      setMessages((prev) => [
        ...prev,
        { role: 'user', content: spokenText },
        { role: 'assistant', content: msg }
      ]);
      if (fileInputRef.current) {
        fileInputRef.current.click();
      }
      setVisualState('standby');
      return;
    }

    // Phase 3: Location Agent handling ("Meri location batao" / "Location galat hai")
    if (intent.agent === AGENT_TYPES.LOCATION) {
      if (intent.action === 'correct_location') {
        const correctMsg = 'Samajh gaya. Chaliye map par correct location select karte hain. Aap marker ko move kar sakte hain.';
        setSpeechReply(correctMsg);
        setMessages((prev) => [
          ...prev,
          { role: 'user', content: spokenText },
          { role: 'assistant', content: correctMsg }
        ]);
        try {
          const syn = await fetch(`${API_BASE}/synthesize`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...authHeader() },
            body: JSON.stringify({ text: correctMsg, language: lang.code })
          });
          const synD = await syn.json();
          if (synD.success && synD.audioDataUrl) speakText(synD.audioDataUrl);
          else setVisualState('standby');
        } catch (_) {
          setVisualState('standby');
        }
        return;
      }

      // Voice-Based Location Retrieval & Reverse Geocoding Name Announcement
      const locResult = await executeLocationQuery(lang.code);
      const reply = locResult.spokenMessage;
      setSpeechReply(reply);
      setMessages((prev) => [
        ...prev,
        { role: 'user', content: spokenText },
        { role: 'assistant', content: reply }
      ]);

      if (locResult.success && locResult.coords) {
        // Send to active session context
        try {
          await fetch(`${API_BASE}/session/${currentSid}/location`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...authHeader() },
            body: JSON.stringify({
              lat: locResult.coords.lat,
              lng: locResult.coords.lng,
              address: locResult.displayText,
              locationSource: 'gps',
              permissionStatus: 'granted'
            })
          });
        } catch (_) {}
      }

      // Voice output using Gnani Timbre TTS
      try {
        const synResp = await fetch(`${API_BASE}/synthesize`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...authHeader() },
          body: JSON.stringify({ text: reply, language: lang.code })
        });
        const synData = await synResp.json();
        if (synData.success && synData.audioDataUrl) {
          speakText(synData.audioDataUrl);
        } else {
          setVisualState('standby');
        }
      } catch (_) {
        setVisualState('standby');
      }
      return;
    }

    // Control Agent: Stop or gratitude
    if (intent.agent === AGENT_TYPES.CONTROL) {
      if (intent.action === 'gratitude') {
        const reply = 'Aapka swagat hai! Saaf aur swachh shahar banane me hamara saath dene ke liye dhanyawad.';
        setSpeechReply(reply);
        setMessages((prev) => [
          ...prev,
          { role: 'user', content: spokenText },
          { role: 'assistant', content: reply }
        ]);
        setVisualState('standby');
      } else {
        closeAssistant();
      }
      return;
    }

    // Phase 2: Complaint Agent — Multi-turn dialogue with Gnani Evon
    try {
      const resp = await fetch(`${API_BASE}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeader() },
        body: JSON.stringify({
          sessionId: currentSid,
          message: spokenText,
          voiceEnabled: !isMuted
        })
      });
      const d = await resp.json();
      if (d.success) {
        setSpeechReply(d.reply);
        setMessages(d.messages || []);
        setComplaintContext(d.complaintContext || {});

        if (d.action === 'request_gps') {
          requestDeviceLocation(currentSid);
        } else if (d.readyToSubmit) {
          executeFinalSubmission(currentSid);
        } else if (d.audioDataUrl && !isMuted) {
          speakText(d.audioDataUrl);
        } else {
          setVisualState('standby');
        }
      } else {
        setVisualState('error');
        setErrorMessage(d.message || 'Error processing response');
      }
    } catch (err) {
      setVisualState('error');
      setErrorMessage('Network connection error.');
    }
  };

  // Device GPS request
  const requestDeviceLocation = (sid) => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        fetch(`${API_BASE}/session/${sid}/location`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...authHeader() },
          body: JSON.stringify({
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            locationSource: 'gps',
            permissionStatus: 'granted'
          })
        })
          .then((r) => r.json())
          .then((d) => {
            if (d.success) {
              setComplaintContext(d.complaintContext || {});
              if (d.audioDataUrl) speakText(d.audioDataUrl);
            }
          })
          .catch(() => {});
      },
      () => {},
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  // Final complaint submission
  const executeFinalSubmission = async (sid) => {
    setVisualState('processing');
    try {
      const resp = await fetch(`${API_BASE}/session/${sid}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeader() },
        body: JSON.stringify({ confirmed: true })
      });
      const d = await resp.json();
      if (d.success) {
        const doneMsg = d.successSpeech?.text || `Complaint #${d.complaintId} darj ho gayi hai!`;
        setSpeechReply(doneMsg);
        setMessages(d.messages || []);
        if (d.successSpeech?.audioDataUrl && !isMuted) {
          speakText(d.successSpeech.audioDataUrl);
        }
        if (onComplaintConfirmed) {
          onComplaintConfirmed(d);
        }
      }
    } catch (_) {}
  };

  // Start live microphone capture for citizen response
  const startRecording = async () => {
    stopAudio();
    setErrorMessage('');
    audioChunksRef.current = [];

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true }
      });
      const mr = new MediaRecorder(stream);
      mediaRecorderRef.current = mr;

      mr.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      mr.onstop = async () => {
        if (recTimerRef.current) clearInterval(recTimerRef.current);
        stream.getTracks().forEach((track) => track.stop());
        setVisualState('processing');

        try {
          const wavBlob = await toWav16kMono(new Blob(audioChunksRef.current, { type: mr.mimeType || 'audio/webm' }));
          const fd = new FormData();
          fd.append('audio', wavBlob, 'citizen_speech.wav');
          fd.append('language', lang.code);

          const resp = await fetch(`${API_BASE}/transcribe`, {
            method: 'POST',
            headers: authHeader(),
            body: fd
          });
          const d = await resp.json();
          if (d.success && d.transcript?.trim()) {
            handleCitizenSpeech(d.transcript.trim());
          } else {
            setVisualState('standby');
            setSpeechReply(d.message || 'Aapki aawaz theek se nahi suni. Kripya dubara bolein.');
          }
        } catch (_) {
          setVisualState('error');
          setErrorMessage('Could not process speech. Please speak again.');
        }
      };

      mr.start();
      setVisualState('listening');
      setRecDuration(0);
      recTimerRef.current = setInterval(() => setRecDuration((d) => d + 1), 1000);
    } catch (err) {
      setVisualState('permission_required');
      setErrorMessage('Microphone access denied or unavailable.');
    }
  };

  const stopRecording = () => {
    if (recTimerRef.current) clearInterval(recTimerRef.current);
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
  };

  // Photo upload from Vision Agent
  const handlePhotoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !sessionId) return;
    setVisualState('processing');

    try {
      const fd = new FormData();
      fd.append('image', file);
      const resp = await fetch(`${API_BASE}/session/${sessionId}/image`, {
        method: 'POST',
        headers: authHeader(),
        body: fd
      });
      const d = await resp.json();
      if (d.success) {
        setSpeechReply(d.reply || 'Photo verify ho gayi hai.');
        setMessages(d.messages || []);
        if (d.audioDataUrl && !isMuted) speakText(d.audioDataUrl);
        else setVisualState('standby');
      } else {
        setVisualState('standby');
        setSpeechReply(d.message || 'Photo analysis fail ho gaya.');
      }
    } catch (_) {
      setVisualState('standby');
    }
  };

  if (!assistantOpen) return null;

  return (
    <div className="siri-overlay" onClick={closeAssistant}>
      <div className="siri-card" onClick={(e) => e.stopPropagation()}>
        {/* Header Controls */}
        <div className="siri-header">
          <div className="siri-branding">
            <span className="siri-title">SWACHH SAATHI</span>
            <span className="siri-status-badge">
              {visualState === 'listening' ? 'Listening...' :
               visualState === 'processing' ? 'Thinking...' :
               visualState === 'speaking' ? 'Speaking...' :
               wakeWordEnabled ? 'Wake Word: Active' : 'Voice Assistant'}
            </span>
          </div>

          <div className="siri-controls">
            <button
              className={`siri-icon-btn ${isMuted ? 'active' : ''}`}
              title={isMuted ? 'Unmute Speech' : 'Mute Speech'}
              onClick={() => setIsMuted(!isMuted)}
            >
              {isMuted ? '🔇' : '🔊'}
            </button>
            <button
              className="siri-icon-btn"
              title="Change Language"
              onClick={() => setShowLanguagePicker(!showLanguagePicker)}
            >
              🌐 {lang.name}
            </button>
            <button
              className="siri-icon-btn close-btn"
              title="Close (ESC)"
              onClick={closeAssistant}
            >
              ✕
            </button>
          </div>
        </div>

        {/* Language Picker Dropdown */}
        {showLanguagePicker && (
          <div className="siri-lang-modal">
            <LanguageSelector
              languages={languages}
              onSelect={(l) => {
                setLang(l);
                setShowLanguagePicker(false);
              }}
              onClose={() => setShowLanguagePicker(false)}
            />
          </div>
        )}

        {/* Central Siri-Style Glow Orb */}
        <div className="siri-orb-stage">
          <div
            className={`siri-orb ${visualState}`}
            onClick={visualState === 'listening' ? stopRecording : startRecording}
            role="button"
            tabIndex={0}
            title={visualState === 'listening' ? 'Click to stop listening' : 'Click to speak'}
          >
            <div className="siri-orb-core">
              <span className="siri-mic-icon">
                {visualState === 'listening' ? '⏹' :
                 visualState === 'processing' ? '⏳' :
                 visualState === 'speaking' ? '🔊' : '🎙'}
              </span>
            </div>
            <div className="siri-orb-ring ring-1"></div>
            <div className="siri-orb-ring ring-2"></div>
            <div className="siri-orb-ring ring-3"></div>
          </div>

          {/* Dynamic Audio Waveform during listening or speaking */}
          {(visualState === 'listening' || visualState === 'speaking') && (
            <div className="siri-waveform">
              <span className="bar bar-1"></span>
              <span className="bar bar-2"></span>
              <span className="bar bar-3"></span>
              <span className="bar bar-4"></span>
              <span className="bar bar-5"></span>
              <span className="bar bar-6"></span>
              <span className="bar bar-7"></span>
            </div>
          )}

          {visualState === 'listening' && (
            <div className="siri-rec-timer">
              Recording: {formatDuration(recDuration)}
            </div>
          )}
        </div>

        {/* Dynamic Speech Display */}
        <div className="siri-speech-content">
          {transcript && (
            <div className="siri-user-transcript">
              <span className="label">You:</span> "{transcript}"
            </div>
          )}

          <div className="siri-assistant-reply">
            {speechReply ? (
              <p>{speechReply}</p>
            ) : visualState === 'processing' ? (
              <p className="dimmed">Processing your civic request with Gnani Evon...</p>
            ) : (
              <p className="dimmed">Tap the mic or say your command...</p>
            )}
          </div>

          {errorMessage && (
            <div className="siri-error-notice">
              ⚠️ {errorMessage}
            </div>
          )}
        </div>

        {/* Hidden File Input for Vision Agent */}
        <input
          type="file"
          ref={fileInputRef}
          style={{ display: 'none' }}
          accept="image/*"
          capture="environment"
          onChange={handlePhotoUpload}
        />

        {/* Footer Quick Controls */}
        <div className="siri-footer">
          <div className="siri-wake-switch">
            <label className="switch-label">
              <input
                type="checkbox"
                checked={wakeWordEnabled}
                onChange={(e) => toggleWakeWord(e.target.checked)}
              />
              <span className="switch-slider"></span>
              <span className="switch-text">Wake phrase ("Hey Swachh Saathi")</span>
            </label>
          </div>

          <div className="siri-action-bar">
            {visualState === 'listening' ? (
              <button className="siri-pill-btn stop" onClick={stopRecording}>
                Done Speaking
              </button>
            ) : (
              <button className="siri-pill-btn primary" onClick={startRecording}>
                🎙 Speak Now
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SiriAssistantModal;

