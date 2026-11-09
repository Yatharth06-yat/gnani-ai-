import React, { useState, useRef } from 'react';
import api from '../utils/api';
import { toast } from 'react-toastify';

// Helper to encode AudioBuffer to standard WAV Blob for Gnani Prisma STT
function bufferToWave(abuffer) {
  const numOfChan = abuffer.numberOfChannels;
  const length = abuffer.length * numOfChan * 2 + 44;
  const out = new DataView(new ArrayBuffer(length));
  const channels = [];
  let sample = 0;
  let offset = 0;
  let pos = 0;

  function setUint16(data) {
    out.setUint16(pos, data, true);
    pos += 2;
  }
  function setUint32(data) {
    out.setUint32(pos, data, true);
    pos += 4;
  }

  // write WAVE header
  setUint32(0x46464952); // "RIFF"
  setUint32(length - 8); // file length - 8
  setUint32(0x45564157); // "WAVE"
  setUint32(0x20746d66); // "fmt " chunk
  setUint32(16); // length = 16
  setUint16(1); // PCM (uncompressed)
  setUint16(numOfChan);
  setUint32(abuffer.sampleRate);
  setUint32(abuffer.sampleRate * 2 * numOfChan); // avg. bytes/sec
  setUint16(numOfChan * 2); // block-align
  setUint16(16); // 16-bit
  setUint32(0x61746164); // "data" - chunk
  setUint32(length - pos - 4); // chunk length

  for (let i = 0; i < abuffer.numberOfChannels; i++) {
    channels.push(abuffer.getChannelData(i));
  }

  while (pos < length) {
    for (let i = 0; i < numOfChan; i++) {
      sample = Math.max(-1, Math.min(1, channels[i][offset]));
      sample = (0.5 + sample < 0 ? sample * 32768 : sample * 32767) | 0;
      out.setInt16(pos, sample, true);
      pos += 2;
    }
    offset++;
  }

  return new Blob([out], { type: 'audio/wav' });
}

const VoiceAssistantModal = ({ isOpen, onClose, onComplaintExtracted }) => {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [transcript, setTranscript] = useState('');
  const [manualText, setManualText] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [extractedData, setExtractedData] = useState(null);
  const [clarificationQuestion, setClarificationQuestion] = useState('');
  const [clarificationAnswer, setClarificationAnswer] = useState('');
  const [activeSessionId] = useState(() => `VS-${Date.now()}`);
  const [audioSourceNote, setAudioSourceNote] = useState('');

  const mediaRecorderRef = useRef(null);
  const recognitionRef = useRef(null);
  const liveTranscriptRef = useRef('');
  const audioChunksRef = useRef([]);
  const timerRef = useRef(null);
  const currentAudioRef = useRef(null);

  // Stop any active audio playback
  const stopAudio = () => {
    if (currentAudioRef.current) {
      try {
        currentAudioRef.current.pause();
        currentAudioRef.current = null;
      } catch (e) {}
    }
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    setIsPlayingAudio(false);
  };

  const handleClose = () => {
    stopAudio();
    stopRecording();
    onClose();
  };

  if (!isOpen) return null;

  // Speak text using Gnani Timbre TTS (with Browser Speech Synthesis fallback)
  const playVoice = async (textToSpeak) => {
    if (!textToSpeak || !textToSpeak.trim()) return;
    stopAudio();
    setIsPlayingAudio(true);

    try {
      console.log('🔊 Requesting speech synthesis for:', textToSpeak.substring(0, 50));
      const res = await api.post('/api/gnani/synthesize', {
        text: textToSpeak,
        language: 'hi-IN',
        voice: 'female'
      });

      if (res.data?.audioDataUrl) {
        const audio = new Audio(res.data.audioDataUrl);
        currentAudioRef.current = audio;

        audio.onended = () => {
          setIsPlayingAudio(false);
          currentAudioRef.current = null;
        };

        audio.onerror = (err) => {
          console.warn('HTML Audio element error, falling back to Web Speech API:', err);
          fallbackBrowserSpeech(textToSpeak);
        };

        try {
          await audio.play();
          console.log('✅ Gnani Timbre audio playing successfully!');
        } catch (playErr) {
          console.warn('Autoplay restricted by browser, using Web Speech API:', playErr.message);
          fallbackBrowserSpeech(textToSpeak);
        }
      } else {
        fallbackBrowserSpeech(textToSpeak);
      }
    } catch (err) {
      console.warn('TTS request error:', err);
      fallbackBrowserSpeech(textToSpeak);
    }
  };

  const fallbackBrowserSpeech = (text) => {
    if ('speechSynthesis' in window) {
      try {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = 'hi-IN';
        utterance.rate = 0.95;
        utterance.onend = () => setIsPlayingAudio(false);
        utterance.onerror = () => setIsPlayingAudio(false);
        setIsPlayingAudio(true);
        window.speechSynthesis.speak(utterance);
      } catch (e) {
        setIsPlayingAudio(false);
      }
    } else {
      setIsPlayingAudio(false);
    }
  };

  const startRecording = async () => {
    stopAudio();
    try {
      audioChunksRef.current = [];
      liveTranscriptRef.current = '';
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        let finalAudioBlob = null;
        try {
          const rawBlob = new Blob(audioChunksRef.current, { type: mediaRecorder.mimeType || 'audio/webm' });
          const arrayBuf = await rawBlob.arrayBuffer();
          const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
          const decodedBuffer = await audioCtx.decodeAudioData(arrayBuf);
          finalAudioBlob = bufferToWave(decodedBuffer);
          console.log(`🎙️ Encoded ${finalAudioBlob.size} bytes of WAV audio for Gnani Prisma STT`);
        } catch (e) {
          console.warn('WAV conversion fallback to raw recording:', e);
          finalAudioBlob = new Blob(audioChunksRef.current, { type: 'audio/wav' });
        }

        await handleAudioUpload(finalAudioBlob);
        stream.getTracks().forEach((track) => track.stop());
      };

      // Also start live browser speech recognition for zero-latency real-time display
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (SpeechRecognition) {
        try {
          const recognition = new SpeechRecognition();
          recognition.lang = 'hi-IN';
          recognition.continuous = true;
          recognition.interimResults = true;
          recognition.onresult = (event) => {
            let fullText = '';
            for (let i = 0; i < event.results.length; i++) {
              fullText += event.results[i][0].transcript;
            }
            if (fullText) {
              liveTranscriptRef.current = fullText;
              setTranscript(fullText);
            }
          };
          recognition.start();
          recognitionRef.current = recognition;
        } catch (srErr) {
          console.warn('SpeechRecognition initialization error:', srErr);
        }
      }

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingDuration(0);
      timerRef.current = setInterval(() => {
        setRecordingDuration((prev) => prev + 1);
      }, 1000);
      toast.info('🎙️ Listening... Speak naturally in Hindi, English, or Hinglish.');
    } catch (err) {
      console.error('Microphone access denied:', err);
      toast.error('Microphone access denied. You can type your voice description below.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      clearInterval(timerRef.current);
    }
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (e) {}
    }
  };

  const handleAudioUpload = async (audioBlob) => {
    setIsProcessing(true);
    try {
      const formData = new FormData();
      formData.append('audio', audioBlob, 'recording.wav');
      formData.append('language', 'hi-IN');

      const sttRes = await api.post('/api/gnani/transcribe', formData);

      let text = (sttRes.data?.transcript || '').trim();
      if (!text && liveTranscriptRef.current) {
        text = liveTranscriptRef.current.trim();
      }

      if (text) {
        setTranscript(text);
        setAudioSourceNote(sttRes.data.source === 'gnani_prisma_api' ? 'Gnani Prisma STT (Live API)' : 'Gnani Voice Assistant (Active)');
        toast.success('Speech transcribed successfully!');
        await runEvonAnalysis(text);
      } else {
        toast.info('No speech detected. Please speak louder or type below.');
      }
    } catch (err) {
      console.error('STT error:', err);
      if (liveTranscriptRef.current) {
        toast.info('Using live speech transcript...');
        await runEvonAnalysis(liveTranscriptRef.current);
      } else {
        toast.error('Failed to connect to transcription service');
      }
    } finally {
      setIsProcessing(false);
    }
  };

  const runEvonAnalysis = async (textToAnalyze) => {
    if (!textToAnalyze.trim()) return;
    setIsProcessing(true);
    try {
      const res = await api.post('/api/gnani/analyze', {
        transcript: textToAnalyze,
        sessionId: activeSessionId || undefined
      });

      if (res.data.success && res.data.data) {
        setExtractedData(res.data.data);
        if (res.data.data.clarification_required && res.data.data.clarification_question) {
          setClarificationQuestion(res.data.data.clarification_question);
          playVoice(res.data.data.clarification_question);
        } else {
          setClarificationQuestion('');
          playVoice('आपकी कचरे की शिकायत दर्ज कर ली गई है। कृपया पुष्टि करें।');
        }
      }
    } catch (err) {
      console.error('Evon error:', err);
      toast.error('NLU extraction failed');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleClarificationSubmit = async () => {
    if (!clarificationAnswer.trim()) return;
    const combined = `${transcript} ${clarificationAnswer}`;
    setTranscript(combined);
    setClarificationAnswer('');
    await runEvonAnalysis(combined);
  };

  const handleConfirmAndPopulate = () => {
    if (!extractedData) return;
    stopAudio();
    onComplaintExtracted({
      title: extractedData.summary || 'Voice Reported Waste',
      description: transcript || manualText || extractedData.summary,
      category: mapWasteCategoryToApp(extractedData.waste_category),
      voiceTranscript: transcript,
      locationAddress: extractedData.location_description,
      priority: extractedData.severity === 'high' ? 'High' : 'Medium'
    });
    toast.success('✨ Extracted complaint details applied to form!');
    handleClose();
  };

  const mapWasteCategoryToApp = (cat) => {
    const map = {
      plastic_waste: 'Garbage',
      mixed_waste: 'Garbage',
      sanitation_overflow: 'Sanitation',
      construction_debris: 'Infrastructure',
      hazardous_waste: 'Sanitation'
    };
    return map[cat] || 'Garbage';
  };

  return (
    <div style={styles.overlay}>
      <div style={styles.modal}>
        <div style={styles.header}>
          <div>
            <h3 style={{ margin: 0, fontSize: '1.25rem', color: '#1b5e20' }}>
              🎙️ Gnani AI Voice Complaint Assistant
            </h3>
            <span style={{ fontSize: '0.8rem', color: '#666' }}>
              Powered by Gnani Prisma (STT), Evon 30B (NLU), & Timbre (TTS)
            </span>
          </div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <button
              onClick={() => isPlayingAudio ? stopAudio() : playVoice('नमस्ते! स्वच्छमैप में आपका स्वागत है। कचरे की शिकायत दर्ज करने के लिए माइक दबाकर बोलें।')}
              style={styles.testVoiceBtn}
              title="Test Assistant Voice Output"
            >
              {isPlayingAudio ? '⏹️ Stop Audio' : '🔊 Test Voice (आवाज़ टेस्ट)'}
            </button>
            <button onClick={handleClose} style={styles.closeBtn}>×</button>
          </div>
        </div>

        <div style={styles.body}>
          {/* Recording Controls */}
          <div style={styles.micSection}>
            <button
              onClick={isRecording ? stopRecording : startRecording}
              style={{
                ...styles.micButton,
                backgroundColor: isRecording ? '#d32f2f' : '#2e7d32',
                animation: isRecording ? 'pulse 1.5s infinite' : 'none'
              }}
            >
              {isRecording ? '⏹️ Stop Recording' : '🎙️ Tap to Speak'}
            </button>
            {isRecording && (
              <span style={{ color: '#d32f2f', fontWeight: 'bold' }}>
                Recording: {recordingDuration}s
              </span>
            )}
            {audioSourceNote && (
              <span style={{ fontSize: '0.75rem', color: '#2e7d32' }}>
                Source: {audioSourceNote}
              </span>
            )}
          </div>

          {/* Transcript / Manual Input */}
          <div style={{ marginTop: '15px' }}>
            <label style={styles.label}>Transcribed Voice Text / Input:</label>
            <textarea
              rows={3}
              style={styles.textarea}
              placeholder="Your speech will appear here. Or type in Hindi, English, or Hinglish..."
              value={transcript || manualText}
              onChange={(e) => {
                setManualText(e.target.value);
                setTranscript(e.target.value);
              }}
            />
            {(!transcript && manualText) && (
              <button
                onClick={() => runEvonAnalysis(manualText)}
                disabled={isProcessing}
                style={styles.actionBtn}
              >
                Analyze with Evon 30B
              </button>
            )}
          </div>

          {isProcessing && (
            <div style={styles.loadingBox}>
              <div style={styles.spinner}></div>
              <span>Processing with Gnani AI Conversational Engine...</span>
            </div>
          )}

          {/* Clarification Dialog */}
          {clarificationQuestion && (
            <div style={styles.clarificationBox}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <span style={{ fontWeight: '600', color: '#b78103' }}>
                  🤖 Gnani AI Clarification:
                </span>
                <button
                  type="button"
                  onClick={() => isPlayingAudio ? stopAudio() : playVoice(clarificationQuestion)}
                  style={styles.listenInlineBtn}
                >
                  {isPlayingAudio ? '⏹️ Stop' : '🔊 आवाज़ सुनें (Listen)'}
                </button>
              </div>
              <p style={{ margin: '0 0 10px 0', fontSize: '0.95rem' }}>{clarificationQuestion}</p>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input
                  type="text"
                  style={styles.input}
                  placeholder="e.g. Near City Hospital or Sector 5 main road"
                  value={clarificationAnswer}
                  onChange={(e) => setClarificationAnswer(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleClarificationSubmit()}
                />
                <button onClick={handleClarificationSubmit} style={styles.secondaryBtn}>
                  Reply
                </button>
              </div>
            </div>
          )}

          {/* Extracted Structured Complaint Review */}
          {extractedData && (
            <div style={styles.extractedCard}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                <h4 style={{ margin: 0, color: '#2e7d32' }}>
                  ✅ AI Extracted Complaint Profile
                </h4>
                <button
                  type="button"
                  onClick={() => isPlayingAudio ? stopAudio() : playVoice(`आपकी शिकायत: ${extractedData.summary}। श्रेणी: ${extractedData.waste_category}। कृपया पुष्टि करें।`)}
                  style={styles.listenInlineBtn}
                >
                  {isPlayingAudio ? '⏹️ Stop' : '🔊 आवाज़ सुनें (Listen)'}
                </button>
              </div>
              <div style={styles.grid}>
                <div><strong>Summary:</strong> {extractedData.summary}</div>
                <div><strong>Waste Category:</strong> <span style={styles.pill}>{extractedData.waste_category}</span></div>
                <div><strong>Location:</strong> {extractedData.location_description || 'Pending GPS'}</div>
                <div><strong>Severity:</strong> <span style={{ textTransform: 'capitalize', fontWeight: 'bold' }}>{extractedData.severity}</span></div>
                <div><strong>Duration:</strong> {extractedData.duration}</div>
              </div>

              <div style={{ marginTop: '15px', display: 'flex', gap: '10px' }}>
                <button onClick={handleConfirmAndPopulate} style={styles.confirmBtn}>
                  ✓ Confirm & Use in Report
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const styles = {
  overlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.6)',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 9999
  },
  modal: {
    backgroundColor: '#fff',
    borderRadius: '12px',
    width: '90%',
    maxWidth: '560px',
    maxHeight: '85vh',
    overflowY: 'auto',
    padding: '24px',
    boxShadow: '0 8px 30px rgba(0,0,0,0.25)'
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottom: '1px solid #eee',
    paddingBottom: '12px',
    marginBottom: '16px'
  },
  testVoiceBtn: {
    padding: '6px 12px',
    backgroundColor: '#e8f5e9',
    color: '#1b5e20',
    border: '1px solid #a5d6a7',
    borderRadius: '20px',
    fontSize: '0.82rem',
    cursor: 'pointer',
    fontWeight: 'bold',
    transition: 'all 0.2s',
    display: 'flex',
    alignItems: 'center',
    gap: '4px'
  },
  listenInlineBtn: {
    padding: '4px 10px',
    backgroundColor: '#fff',
    color: '#2e7d32',
    border: '1px solid #81c784',
    borderRadius: '16px',
    fontSize: '0.78rem',
    cursor: 'pointer',
    fontWeight: 'bold',
    boxShadow: '0 1px 3px rgba(0,0,0,0.08)'
  },
  closeBtn: {
    background: 'none',
    border: 'none',
    fontSize: '24px',
    cursor: 'pointer',
    color: '#888'
  },
  micSection: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '8px',
    padding: '16px 0',
    backgroundColor: '#f9fbf9',
    borderRadius: '8px'
  },
  micButton: {
    padding: '12px 28px',
    color: '#fff',
    border: 'none',
    borderRadius: '30px',
    fontSize: '1rem',
    cursor: 'pointer',
    fontWeight: 'bold',
    transition: 'all 0.2s'
  },
  label: {
    display: 'block',
    fontSize: '0.85rem',
    fontWeight: 'bold',
    color: '#333',
    marginBottom: '4px'
  },
  textarea: {
    width: '100%',
    padding: '10px',
    borderRadius: '6px',
    border: '1px solid #ccc',
    boxSizing: 'border-box',
    fontSize: '0.95rem'
  },
  input: {
    flex: 1,
    padding: '8px 12px',
    borderRadius: '6px',
    border: '1px solid #ccc'
  },
  actionBtn: {
    marginTop: '6px',
    padding: '6px 14px',
    backgroundColor: '#2e7d32',
    color: '#fff',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer'
  },
  secondaryBtn: {
    padding: '8px 16px',
    backgroundColor: '#ff9800',
    color: '#fff',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    fontWeight: 'bold'
  },
  confirmBtn: {
    flex: 1,
    padding: '12px',
    backgroundColor: '#2e7d32',
    color: '#fff',
    border: 'none',
    borderRadius: '6px',
    fontSize: '1rem',
    cursor: 'pointer',
    fontWeight: 'bold'
  },
  clarificationBox: {
    marginTop: '15px',
    backgroundColor: '#fff8e1',
    border: '1px solid #ffe082',
    borderRadius: '8px',
    padding: '12px'
  },
  extractedCard: {
    marginTop: '15px',
    backgroundColor: '#e8f5e9',
    border: '1px solid #c8e6c9',
    borderRadius: '8px',
    padding: '14px'
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: '1fr',
    gap: '6px',
    fontSize: '0.9rem'
  },
  pill: {
    backgroundColor: '#c8e6c9',
    padding: '2px 8px',
    borderRadius: '10px',
    fontSize: '0.8rem',
    fontWeight: 'bold'
  },
  loadingBox: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '12px',
    backgroundColor: '#f1f8e9',
    borderRadius: '6px',
    marginTop: '10px',
    fontSize: '0.9rem',
    color: '#2e7d32'
  },
  spinner: {
    width: '18px',
    height: '18px',
    border: '2px solid #a5d6a7',
    borderTopColor: '#2e7d32',
    borderRadius: '50%',
    animation: 'spin 0.8s linear infinite'
  }
};

export default VoiceAssistantModal;
