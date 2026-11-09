import React, { useState, useEffect, useRef, useCallback } from 'react';
import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import LanguageSelector from './LanguageSelector';
import { getUIStrings } from '../utils/localizedStrings';
import { BACKEND_URL } from '../utils/api';

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png'
});

const API_BASE = `${BACKEND_URL}/api/gnani`;
const INDIA_VIEW = { center: [22.97, 78.66], zoom: 5 }; // Viewport default only — never saved as complaint location

// ── Audio: record -> true 16 kHz mono PCM WAV (supported by Gnani Prisma) ──
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

function formatDuration(sec) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s < 10 ? '0' : ''}${s}`;
}

function MapPicker({ point, onPick, flyTo }) {
  const Handler = () => {
    useMapEvents({ click: (e) => onPick(e.latlng.lat, e.latlng.lng) });
    return null;
  };
  const Fly = () => {
    const map = useMap();
    useEffect(() => { if (flyTo) map.flyTo(flyTo, 16); }, [map]); // eslint-disable-line
    return null;
  };
  return (
    <MapContainer
      center={point ? [point.lat, point.lng] : INDIA_VIEW.center}
      zoom={point ? 16 : INDIA_VIEW.zoom}
      style={{ height: 200, width: '100%', borderRadius: 8 }}
      scrollWheelZoom={false}>
      <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
      <Handler /><Fly />
      {point && <Marker position={[point.lat, point.lng]} />}
    </MapContainer>
  );
}

const authHeader = () => {
  const t = localStorage.getItem('token');
  return t ? { Authorization: `Bearer ${t}` } : {};
};

const ConversationAssistant = ({ isOpen, onClose, onComplaintConfirmed }) => {
  const [langs, setLangs] = useState({ list: [], states: {}, loading: false, error: '' });
  const [lang, setLang] = useState(null); // chosen language info (null => selector screen)
  const [sessionId, setSessionId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [ctx, setCtx] = useState({});
  const [phase, setPhase] = useState('idle'); // idle | listening | processing | speaking
  const [draft, setDraft] = useState('');
  const [heard, setHeard] = useState(false);
  const [notice, setNotice] = useState('');
  const [point, setPoint] = useState(null); // {lat,lng} chosen by the citizen
  const [addr, setAddr] = useState('');
  const [preview, setPreview] = useState(null);
  const [registered, setRegistered] = useState(null);
  const [busy, setBusy] = useState(false);
  const [showSwitch, setShowSwitch] = useState(false);
  const [recDuration, setRecDuration] = useState(0);
  const [playingMessageId, setPlayingMessageId] = useState(null);
  const [isAudioPaused, setIsAudioPaused] = useState(false);

  const audioRef = useRef(null);
  const recRef = useRef(null);
  const recTimerRef = useRef(null);
  const chunks = useRef([]);
  const endRef = useRef(null);
  const audioCache = useRef({});
  const submittingRef = useRef(false);
  const fileRef = useRef(null);

  // Central localization object based on citizen's selected language
  const t = getUIStrings(lang?.code, lang?.textFallback);
  const voiceIn = lang && Boolean(lang.sttAvailable);
  const voiceOut = lang && Boolean(lang.ttsAvailable);

  const stopAudio = useCallback(() => {
    if (audioRef.current) {
      try { audioRef.current.pause(); } catch (_) {}
      audioRef.current = null;
    }
    setPlayingMessageId(null);
    setIsAudioPaused(false);
    setPhase((p) => (p === 'speaking' ? 'idle' : p));
  }, []);

  const play = useCallback((url, msgId = null) => {
    stopAudio();
    if (!url) return;
    const a = new Audio(url);
    audioRef.current = a;
    setPlayingMessageId(msgId);
    setIsAudioPaused(false);
    setPhase('speaking');
    a.onended = () => {
      if (audioRef.current === a) {
        audioRef.current = null;
        setPlayingMessageId(null);
        setIsAudioPaused(false);
        setPhase('idle');
      }
    };
    a.onerror = () => {
      setPhase('idle');
      setPlayingMessageId(null);
      setIsAudioPaused(false);
      setNotice(t.ttsFail);
    };
    a.play().catch(() => {
      setPhase('idle');
      setPlayingMessageId(null);
      setIsAudioPaused(false);
      setNotice(t.ttsFail);
    });
  }, [stopAudio, t.ttsFail]);

  const togglePlayPause = (m) => {
    if (audioRef.current && playingMessageId === m.messageId) {
      if (isAudioPaused) {
        audioRef.current.play().then(() => {
          setIsAudioPaused(false);
          setPhase('speaking');
        }).catch(() => {});
      } else {
        audioRef.current.pause();
        setIsAudioPaused(true);
        setPhase('idle');
      }
    } else {
      replay(m);
    }
  };

  const loadLanguages = useCallback(async () => {
    setLangs((s) => ({ ...s, loading: true, error: '' }));
    try {
      const d = await (await fetch(`${API_BASE}/languages`)).json();
      setLangs({ list: d.languages || [], states: d.states || {}, loading: false, error: '' });
    } catch (_) {
      setLangs((s) => ({ ...s, loading: false, error: 'Could not load languages. Is the backend running on port 8002?' }));
    }
  }, []);

  useEffect(() => {
    if (isOpen && !langs.list.length) loadLanguages();
  }, [isOpen, langs.list.length, loadLanguages]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, phase, ctx.stage]);

  useEffect(() => () => {
    stopAudio();
    if (recTimerRef.current) clearInterval(recTimerRef.current);
  }, [stopAudio]);

  const absorb = (d) => {
    if (d.messages) setMessages(d.messages);
    if (d.complaintContext) setCtx(d.complaintContext);
    if (d.languageInfo) setLang(d.languageInfo);
    const c = d.complaintContext;
    if (c?.latitude != null && c?.longitude != null) {
      setPoint({ lat: c.latitude, lng: c.longitude });
    }
    const last = d.messages && d.messages[d.messages.length - 1];
    if (d.audioDataUrl && last) {
      audioCache.current[last.messageId] = d.audioDataUrl;
      play(d.audioDataUrl, last.messageId);
      setNotice('');
    } else if (d.tts && d.tts.ok === false && !['DISABLED', 'SKIPPED', 'NO_TEXT'].includes(d.tts.error)) {
      setNotice(t.ttsFail);
    }
  };

  // Start session with chosen language (attaching auth if signed in)
  const startWith = async (l) => {
    setBusy(true);
    setNotice('');
    setRegistered(null);
    try {
      const resp = await fetch(`${API_BASE}/session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeader() },
        body: JSON.stringify({ language: l.code })
      });
      const d = await resp.json();
      if (!d.success) throw new Error(d.message);
      setSessionId(d.sessionId);
      setLang(d.languageInfo || l);
      absorb({ ...d, messages: d.messages });
      if (d.welcomeAudio) {
        const last = d.messages[d.messages.length - 1];
        audioCache.current[last.messageId] = d.welcomeAudio;
        play(d.welcomeAudio, last.messageId);
      }
    } catch (e) {
      setLang(null);
      setLangs((s) => ({ ...s, error: e.message || 'Could not start the assistant.' }));
    } finally {
      setBusy(false);
    }
  };

  // Switch language mid-conversation without losing context
  const changeLanguage = async (l) => {
    setShowSwitch(false);
    stopAudio();
    setBusy(true);
    try {
      const resp = await fetch(`${API_BASE}/session/${sessionId}/language`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeader() },
        body: JSON.stringify({ language: l.code })
      });
      const d = await resp.json();
      if (d.success) absorb(d);
      else setNotice(d.message);
    } catch (_) {
      setNotice(t.networkError);
    } finally {
      setBusy(false);
    }
  };

  // Send message
  const send = async (text) => {
    const msg = (text ?? draft).trim();
    if (!msg || !sessionId || busy) return;
    stopAudio();
    setDraft('');
    setHeard(false);
    setBusy(true);
    setPhase('processing');
    try {
      const resp = await fetch(`${API_BASE}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeader() },
        body: JSON.stringify({ sessionId, message: msg, voiceEnabled: Boolean(voiceOut) })
      });
      const d = await resp.json();
      if (!d.success) {
        setNotice(d.message || 'Error');
        setMessages((m) => [...m, { role: 'assistant', content: d.message || 'Error', messageId: `e${Date.now()}` }]);
      } else {
        absorb(d);
        if (d.action === 'request_gps') requestGps();
      }
    } catch (_) {
      setNotice(t.networkError);
    } finally {
      setBusy(false);
      setPhase((p) => (p === 'processing' ? 'idle' : p));
    }
  };

  // Voice recording & transcription
  const startRec = async () => {
    stopAudio();
    setNotice('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true }
      });
      chunks.current = [];
      const mr = new MediaRecorder(stream);
      recRef.current = mr;
      mr.ondataavailable = (e) => e.data.size && chunks.current.push(e.data);
      mr.onstop = async () => {
        if (recTimerRef.current) {
          clearInterval(recTimerRef.current);
          recTimerRef.current = null;
        }
        stream.getTracks().forEach((x) => x.stop());
        setPhase('processing');
        try {
          const wav = await toWav16kMono(new Blob(chunks.current, { type: mr.mimeType || 'audio/webm' }));
          const fd = new FormData();
          fd.append('audio', wav, 'voice.wav');
          fd.append('language', lang.code);
          const resp = await fetch(`${API_BASE}/transcribe`, { method: 'POST', headers: authHeader(), body: fd });
          const d = await resp.json();
          if (d.success && d.transcript?.trim()) {
            setDraft(d.transcript.trim());
            setHeard(true);
          } else {
            setNotice(d.message || (lang.code === 'hi-IN' ? 'माफ़ कीजिए, आवाज़ समझ नहीं आई। कृपया दोबारा बोलें।' : t.noVoice));
          }
        } catch (_) {
          setNotice('Could not process the recording. Please speak again or type.');
        }
        setPhase('idle');
      };
      mr.start();
      setRecDuration(0);
      recTimerRef.current = setInterval(() => setRecDuration((d) => d + 1), 1000);
      setPhase('listening');
    } catch (_) {
      setNotice(t.micDenied);
      setPhase('idle');
    }
  };

  const stopRec = () => {
    if (recTimerRef.current) {
      clearInterval(recTimerRef.current);
      recTimerRef.current = null;
    }
    if (recRef.current && recRef.current.state !== 'inactive') recRef.current.stop();
  };

  // Location handler (GPS consent & Map pin)
  const postLocation = async (body) => {
    setBusy(true);
    try {
      const resp = await fetch(`${API_BASE}/session/${sessionId}/location`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeader() },
        body: JSON.stringify(body)
      });
      const d = await resp.json();
      if (d.success) absorb(d);
      else setNotice(d.message);
    } catch (_) {
      setNotice(t.networkError);
    } finally {
      setBusy(false);
    }
  };

  const requestGps = () => {
    if (!navigator.geolocation) {
      postLocation({ permissionStatus: 'denied' });
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setPoint({ lat: p.coords.latitude, lng: p.coords.longitude });
        postLocation({ lat: p.coords.latitude, lng: p.coords.longitude, locationSource: 'gps', permissionStatus: 'granted' });
      },
      () => {
        setNotice(t.gpsDenied);
        postLocation({ permissionStatus: 'denied' });
      },
      { enableHighAccuracy: true, timeout: 12000 }
    );
  };

  const searchAddress = async () => {
    const q = addr.trim();
    if (!q) return;
    try {
      const r = await (await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=in&q=${encodeURIComponent(q)}`)).json();
      if (r[0]) {
        const lat = Number(r[0].lat), lng = Number(r[0].lon);
        setPoint({ lat, lng });
        postLocation({ address: q, lat, lng, locationSource: 'map_pin' });
      } else {
        postLocation({ address: q });
      }
    } catch (_) {
      postLocation({ address: q });
    }
  };

  // Optional photo evidence upload
  const uploadPhoto = async (file) => {
    if (!file) return;
    setBusy(true);
    setPreview(URL.createObjectURL(file));
    try {
      const fd = new FormData();
      fd.append('image', file);
      const resp = await fetch(`${API_BASE}/session/${sessionId}/image`, { method: 'POST', headers: authHeader(), body: fd });
      const d = await resp.json();
      if (d.success) absorb(d);
      else setNotice(d.message || t.photoUploadFail);
    } catch (_) {
      setNotice(t.photoUploadFail);
    } finally {
      setBusy(false);
    }
  };

  const skipPhoto = async () => {
    setBusy(true);
    try {
      const resp = await fetch(`${API_BASE}/session/${sessionId}/skip-photo`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeader() }
      });
      const d = await resp.json();
      if (d.success) absorb(d);
    } finally {
      setBusy(false);
    }
  };

  // Submit confirmed complaint
  const submit = async () => {
    if (submittingRef.current) return;
    submittingRef.current = true;
    setBusy(true);
    try {
      const r = await fetch(`${API_BASE}/session/${sessionId}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeader() },
        body: JSON.stringify({ confirmed: true })
      });
      const d = await r.json();
      if (d.success) {
        setRegistered(d.complaintId);
        setMessages(d.messages || []);
        setCtx(d.complaintContext || {});
        if (d.successSpeech?.audioDataUrl) play(d.successSpeech.audioDataUrl);
        else if (!d.alreadySubmitted) setNotice(t.ttsFail);
        onComplaintConfirmed && onComplaintConfirmed(d.issue || { complaintId: d.complaintId });
      } else {
        setNotice(r.status === 401 ? t.loginRequired : (d.message || t.networkError));
      }
    } catch (_) {
      setNotice(t.networkError);
    } finally {
      submittingRef.current = false;
      setBusy(false);
    }
  };

  const replay = async (m) => {
    if (audioCache.current[m.messageId]) return play(audioCache.current[m.messageId], m.messageId);
    setPhase('processing');
    try {
      const resp = await fetch(`${API_BASE}/synthesize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeader() },
        body: JSON.stringify({ text: m.content.split('\n\n')[0], language: lang.code })
      });
      const d = await resp.json();
      if (d.success && d.audioDataUrl) {
        audioCache.current[m.messageId] = d.audioDataUrl;
        play(d.audioDataUrl, m.messageId);
      } else {
        setPhase('idle');
        setNotice(t.noVoice);
      }
    } catch (_) {
      setPhase('idle');
      setNotice(t.ttsFail);
    }
  };

  const reset = () => {
    stopAudio();
    if (recTimerRef.current) clearInterval(recTimerRef.current);
    setLang(null);
    setSessionId(null);
    setMessages([]);
    setCtx({});
    setPoint(null);
    setPreview(null);
    setRegistered(null);
    setNotice('');
  };

  const close = () => {
    stopRec();
    stopAudio();
    onClose && onClose();
  };

  if (!isOpen) return null;
  const stage = ctx.stage;
  const needLocation = !registered && ctx.latitude == null && ['location_permission', 'location_query'].includes(stage);
  const needPin = !registered && ctx.latitude == null && stage === 'summary_confirmation';

  return (
    <div style={css.overlay} role="dialog" aria-modal="true" aria-label="Swachh Saathi Voice Assistant">
      <div style={css.modal}>
        {!lang ? (
          <LanguageSelector
            languages={langs.list}
            states={langs.states}
            loading={langs.loading || busy}
            error={langs.error}
            onRetry={loadLanguages}
            onSelect={startWith}
            onClose={close}
          />
        ) : (
          <>
            <div style={css.header}>
              <div>
                <strong>🌿 Swachh Saathi</strong>
                <div style={{ fontSize: '0.78rem', opacity: 0.95 }}>
                  {lang.native} · {lang.name}
                  {voiceIn && voiceOut ? ' · 🎙 Real Voice Active' : (lang.supportStatus !== 'FULL_VOICE_SUPPORTED' ? ` · ${lang.supportStatus.replace(/_/g, ' ').toLowerCase()}` : '')}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <button style={css.hbtn} onClick={() => setShowSwitch(true)}>🌐 {t.changeLanguage}</button>
                <button style={css.hbtn} onClick={close} aria-label={t.cancel || 'Close'}>✕</button>
              </div>
            </div>

            {showSwitch && (
              <div style={css.switchPane}>
                <LanguageSelector
                  languages={langs.list}
                  states={langs.states}
                  onSelect={changeLanguage}
                  onClose={() => setShowSwitch(false)}
                />
              </div>
            )}

            <div style={css.chat} aria-live="polite">
              {messages.map((m) => {
                const isThisPlaying = playingMessageId === m.messageId && !isAudioPaused;
                return (
                  <div key={m.messageId} style={{ display: 'flex', justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start' }}>
                    <div style={{ ...css.bubble, ...(m.role === 'user' ? css.user : css.bot) }}>
                      <div style={{ whiteSpace: 'pre-wrap' }}>{m.content}</div>
                      {m.role === 'assistant' && voiceOut && (
                        <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                          <button
                            style={{ ...css.mini, background: isThisPlaying ? '#dcfce7' : '#f1f5f9', borderColor: isThisPlaying ? '#16a34a' : '#cbd5e1' }}
                            onClick={() => togglePlayPause(m)}
                            aria-label={isThisPlaying ? 'Pause audio' : 'Play audio'}>
                            {isThisPlaying ? '⏸ Pause' : (playingMessageId === m.messageId && isAudioPaused ? '▶ Resume' : '▶ Play')}
                          </button>
                          <button
                            style={css.mini}
                            onClick={() => replay(m)}
                            aria-label="Replay voice">
                            🔊 {t.replay}
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}

              {(needLocation || needPin) && (
                <div style={css.card}>
                  <div style={css.row}>
                    <button style={css.primary} disabled={busy} onClick={requestGps}>📍 {t.allowGps}</button>
                  </div>
                  <div style={{ ...css.row, marginTop: 8 }}>
                    <input
                      style={css.input}
                      value={addr}
                      onChange={(e) => setAddr(e.target.value)}
                      placeholder={t.addressPlaceholder}
                      aria-label={t.addressPlaceholder}
                      onKeyDown={(e) => e.key === 'Enter' && searchAddress()}
                    />
                    <button style={css.secondary} disabled={busy} onClick={searchAddress}>{t.search}</button>
                  </div>
                  <div style={{ fontSize: '0.78rem', color: '#64748b', margin: '8px 0 4px' }}>{t.dropPinPrompt}</div>
                  <MapPicker
                    point={point}
                    onPick={(la, ln) => {
                      setPoint({ lat: la, lng: ln });
                      postLocation({ lat: la, lng: ln, locationSource: 'map_pin', address: addr.trim() || undefined });
                    }}
                  />
                </div>
              )}

              {point && ctx.latitude != null && !registered && (
                <div style={css.card}>
                  <div style={{ fontSize: '0.82rem', marginBottom: 6 }}>
                    📌 {ctx.locationVerified ? t.gpsVerified : t.yourPin} ({point.lat.toFixed(5)}, {point.lng.toFixed(5)})
                    {!ctx.locationVerified && <span style={{ color: '#92400e' }}> · {t.unverifiedLocation}</span>}
                  </div>
                  <MapPicker
                    point={point}
                    onPick={(la, ln) => {
                      setPoint({ lat: la, lng: ln });
                      postLocation({ lat: la, lng: ln, locationSource: 'map_pin' });
                    }}
                  />
                </div>
              )}

              {stage === 'image_request' && !registered && (
                <div style={css.card}>
                  <div style={css.row}>
                    <input
                      ref={fileRef}
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      capture="environment"
                      hidden
                      onChange={(e) => uploadPhoto(e.target.files?.[0])}
                    />
                    <button style={css.primary} disabled={busy} onClick={() => fileRef.current?.click()}>📷 {t.uploadPhoto}</button>
                    <button style={css.secondary} disabled={busy} onClick={skipPhoto}>{t.skipPhoto}</button>
                  </div>
                </div>
              )}

              {preview && (
                <div style={{ marginTop: 6 }}>
                  <img
                    src={ctx.annotatedImageUrl ? (ctx.annotatedImageUrl.startsWith('data:') ? ctx.annotatedImageUrl : `data:image/jpeg;base64,${ctx.annotatedImageUrl}`) : preview}
                    alt="Uploaded evidence"
                    style={{ maxWidth: 200, borderRadius: 8, border: '1px solid #cbd5e1' }}
                  />
                  {ctx.imageVerificationStatus === 'verified' && (
                    <div style={{ fontSize: '0.76rem', color: '#16a34a', marginTop: 2 }}>✔ {t.locationConfirmed || 'Verified by YOLO11n'}</div>
                  )}
                </div>
              )}

              {stage === 'summary_confirmation' && !registered && ctx.latitude != null && (
                <div style={{ ...css.row, marginTop: 8 }}>
                  <button style={css.primary} disabled={busy} onClick={submit}>✅ {t.confirmComplaint}</button>
                </div>
              )}

              {registered && (
                <div style={{ ...css.card, borderColor: '#16a34a', background: '#f0fdf4' }}>
                  <strong style={{ color: '#166534' }}>✅ {t.complaintRegistered}: {registered}</strong>
                  <div style={{ fontSize: '0.8rem', color: '#166534', marginTop: 4 }}>
                    {t.complaintId}: <strong>{registered}</strong>
                  </div>
                  <div style={{ marginTop: 10 }}>
                    <button style={css.secondary} onClick={reset}>{t.newComplaint}</button>
                  </div>
                </div>
              )}
              <div ref={endRef} />
            </div>

            {notice && (
              <div style={css.notice} role="status">
                <span>{notice}</span>
                <button style={css.x} onClick={() => setNotice('')} aria-label="Dismiss">✕</button>
              </div>
            )}
            {!voiceIn && lang.supportStatus === 'TEXT_SUPPORTED' && (
              <div style={css.notice}>{t.noVoice}</div>
            )}

            {!registered && (
              <div style={css.composer}>
                {heard && <div style={{ fontSize: '0.76rem', color: '#475569', marginBottom: 4 }}>{t.heardPrompt}</div>}
                <div style={css.row}>
                  {voiceIn && (
                    <button
                      style={{
                        ...css.mic,
                        background: phase === 'listening' ? '#dc2626' : '#16a34a',
                        boxShadow: phase === 'listening' ? '0 0 0 4px rgba(220, 38, 38, 0.3)' : 'none'
                      }}
                      disabled={busy || phase === 'processing'}
                      onClick={phase === 'listening' ? stopRec : startRec}
                      aria-label={phase === 'listening' ? t.stopRecording : t.tapToSpeak}>
                      {phase === 'listening' ? '⏹' : '🎙'}
                    </button>
                  )}
                  <input
                    style={css.input}
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    placeholder={t.typeMessage}
                    aria-label={t.typeMessage}
                    disabled={busy}
                    onKeyDown={(e) => e.key === 'Enter' && send()}
                  />
                  <button style={css.primary} disabled={busy || !draft.trim()} onClick={() => send()}>{t.send}</button>
                </div>
                <div style={{ fontSize: '0.74rem', color: '#64748b', minHeight: 16, marginTop: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
                  {phase === 'listening' && (
                    <span style={{ color: '#dc2626', fontWeight: 600 }}>
                      🔴 {t.listening} ({formatDuration(recDuration)})
                    </span>
                  )}
                  {phase === 'processing' && <span>⏳ {t.processing}</span>}
                  {phase === 'speaking' && <span>🔊 {t.speaking}</span>}
                  {phase === 'idle' && voiceIn && <span>{t.tapToSpeak}</span>}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

const css = {
  overlay: { position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.55)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 'env(safe-area-inset-top) 8px env(safe-area-inset-bottom)' },
  modal: { position: 'relative', width: 'min(680px,100%)', height: 'min(760px,96vh)', background: '#fff', borderRadius: 14, overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 50px rgba(0,0,0,.3)' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', background: 'linear-gradient(135deg,#16a34a,#0f766e)', color: '#fff' },
  hbtn: { background: 'rgba(255,255,255,.18)', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 10px', cursor: 'pointer', fontSize: '0.82rem', minHeight: 36 },
  switchPane: { position: 'absolute', inset: 0, zIndex: 5, background: '#fff' },
  chat: { flex: 1, overflowY: 'auto', padding: 12, display: 'flex', flexDirection: 'column', gap: 8, background: '#f8fafc' },
  bubble: { maxWidth: '86%', padding: '9px 12px', borderRadius: 12, fontSize: '0.94rem', lineHeight: 1.45 },
  bot: { background: '#fff', border: '1px solid #e2e8f0' },
  user: { background: '#dcfce7' },
  mini: { background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: 999, padding: '3px 10px', fontSize: '0.74rem', cursor: 'pointer', fontWeight: 500 },
  card: { background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10, padding: 10 },
  row: { display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' },
  input: { flex: 1, minWidth: 0, padding: '11px 12px', border: '1px solid #cbd5e1', borderRadius: 10, fontSize: '0.95rem' },
  primary: { padding: '11px 14px', background: '#16a34a', color: '#fff', border: 'none', borderRadius: 10, fontWeight: 600, cursor: 'pointer', minHeight: 44 },
  secondary: { padding: '11px 14px', background: '#fff', color: '#0f172a', border: '1px solid #cbd5e1', borderRadius: 10, cursor: 'pointer', minHeight: 44 },
  mic: { width: 48, height: 48, borderRadius: '50%', border: 'none', color: '#fff', fontSize: '1.25rem', cursor: 'pointer', flexShrink: 0, transition: 'all 0.2s ease' },
  composer: { padding: '8px 12px 10px', borderTop: '1px solid #e2e8f0', background: '#fff' },
  notice: { background: '#fef3c7', color: '#92400e', fontSize: '0.82rem', padding: '6px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  x: { background: 'none', border: 'none', cursor: 'pointer', color: '#92400e', fontSize: '0.9rem' }
};

export default ConversationAssistant;
