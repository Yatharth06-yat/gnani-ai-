import React, { useMemo, useState, useRef, useEffect } from 'react';
import { getUIStrings } from '../utils/localizedStrings';

const API_BASE = 'http://localhost:8002/api/gnani';

// Honest availability label per support status (comes directly from the backend registry)
const STATUS_LABEL = {
  FULL_VOICE_SUPPORTED: { text: '🎙 Voice', color: '#166534', bg: '#dcfce7' },
  STT_ONLY: { text: '🎤 Speak only', color: '#854d0e', bg: '#fef9c3' },
  TTS_ONLY: { text: '🔊 Listen only', color: '#854d0e', bg: '#fef9c3' },
  TEXT_SUPPORTED: { text: '⌨ Text only', color: '#1e40af', bg: '#dbeafe' },
  COMING_SOON: { text: 'Coming soon', color: '#6b7280', bg: '#f3f4f6' },
  TEMPORARILY_UNAVAILABLE: { text: 'Temporarily unavailable', color: '#991b1b', bg: '#fee2e2' }
};

const LanguageSelector = ({ languages, states, loading, error, onSelect, onRetry, onClose }) => {
  const [query, setQuery] = useState('');
  const [state, setState] = useState('');
  const [chosen, setChosen] = useState(null);
  const [previewPlaying, setPreviewPlaying] = useState(null);
  const audioRef = useRef(null);

  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  const playPreview = (e, l) => {
    e.stopPropagation();
    if (previewPlaying === l.code) {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
      setPreviewPlaying(null);
      return;
    }

    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }

    setPreviewPlaying(l.code);
    const audio = new Audio(`${API_BASE}/preview/${l.code}`);
    audioRef.current = audio;
    audio.onended = () => {
      setPreviewPlaying(null);
      audioRef.current = null;
    };
    audio.onerror = () => {
      setPreviewPlaying(null);
      audioRef.current = null;
    };
    audio.play().catch(() => {
      setPreviewPlaying(null);
      audioRef.current = null;
    });
  };

  const q = query.trim().toLowerCase();
  const match = (l) => !q || l.name.toLowerCase().includes(q) || l.native.toLowerCase().includes(q) || l.code.toLowerCase().includes(q);
  const byCode = useMemo(() => Object.fromEntries((languages || []).map((l) => [l.code, l])), [languages]);
  const recommended = (state && states?.[state] ? states[state] : []).map((c) => byCode[c]).filter(Boolean);

  const popular = (languages || []).filter((l) => l.popular && match(l));
  const scheduled = (languages || []).filter((l) => l.scheduled && match(l));
  const regional = (languages || []).filter((l) => !l.scheduled && !l.popular && match(l));

  const t = getUIStrings(chosen?.code, chosen?.textFallback);

  const Chip = ({ l, big }) => {
    const st = STATUS_LABEL[l.supportStatus] || STATUS_LABEL.TEXT_SUPPORTED;
    const sel = chosen?.code === l.code;
    const disabled = l.supportStatus === 'COMING_SOON';
    const isPlayingThis = previewPlaying === l.code;

    return (
      <div
        role="option"
        tabIndex={disabled ? -1 : 0}
        aria-selected={sel}
        aria-disabled={disabled}
        onClick={() => !disabled && setChosen(l)}
        onKeyDown={(e) => {
          if (!disabled && (e.key === 'Enter' || e.key === ' ')) {
            e.preventDefault();
            setChosen(l);
          }
        }}
        style={{
          ...css.chip,
          ...(big ? css.chipBig : {}),
          ...(sel ? css.chipSel : {}),
          opacity: disabled ? 0.55 : 1,
          cursor: disabled ? 'not-allowed' : 'pointer',
          textAlign: 'left'
        }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'flex-start' }}>
          <div>
            <span style={{ fontSize: big ? '1.1rem' : '0.98rem', fontWeight: 600 }}>{l.native}</span>
            {l.native !== l.name && <span style={css.sub}> ({l.name})</span>}
          </div>
          {l.ttsAvailable && (
            <button
              type="button"
              title="Listen to genuine voice sample"
              onClick={(e) => playPreview(e, l)}
              style={{ ...css.previewBtn, background: isPlayingThis ? '#fee2e2' : '#f1f5f9', color: isPlayingThis ? '#dc2626' : '#334155' }}>
              {isPlayingThis ? '⏹' : '🔊'}
            </button>
          )}
        </div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 4, flexWrap: 'wrap' }}>
          <span style={{ ...css.badge, color: st.color, background: st.bg }}>
            {st.text}{l.supportStatus === 'FULL_VOICE_SUPPORTED' && !l.voiceVerified ? ' (unverified)' : ''}
          </span>
          {l.scheduled ? null : l.popular ? null : <span style={css.sub}>Regional</span>}
        </div>
      </div>
    );
  };

  const Section = ({ title, note, items, big }) => items.length === 0 ? null : (
    <section style={{ marginBottom: 16 }} aria-label={title}>
      <h3 style={css.h3}>{title}</h3>
      {note && <p style={css.note}>{note}</p>}
      <div role="listbox" aria-label={title} style={css.grid}>{items.map((l) => <Chip key={`${title}-${l.code}`} l={l} big={big} />)}</div>
    </section>
  );

  const chosenSt = chosen && (STATUS_LABEL[chosen.supportStatus] || STATUS_LABEL.TEXT_SUPPORTED);

  return (
    <div style={css.wrap}>
      <div style={css.head}>
        <div>
          <div style={css.brand}>🌿 Swachh Saathi</div>
          <h2 style={css.title}>Welcome to Swachh Saathi</h2>
          <p style={css.subtitle}>अपनी पसंदीदा भाषा चुनें / Choose your preferred language</p>
        </div>
        {onClose && <button onClick={onClose} style={css.close} aria-label="Close">✕</button>}
      </div>

      <div style={css.body}>
        <div style={css.filters}>
          <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search language / भाषा खोजें" aria-label="Search language" style={css.input} />
          <select value={state} onChange={(e) => setState(e.target.value)} aria-label="State or Union Territory (optional)" style={css.input}>
            <option value="">State / UT (optional) — राज्य</option>
            {Object.keys(states || {}).sort().map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>

        {loading && <p style={css.note}>Loading languages…</p>}
        {error && <div style={css.err} role="alert">{error} <button onClick={onRetry} style={css.link}>Retry</button></div>}

        {recommended.length > 0 && <Section title={`Commonly spoken in ${state}`} note="Suggestions only — you can choose any language below." items={recommended} big />}
        <Section title="Popular languages" items={popular} big />
        <Section title="All 22 scheduled Indian languages" note="Languages of the Eighth Schedule of the Constitution." items={scheduled} />
        <Section title="Other regional languages" note="Not part of the Eighth Schedule." items={regional} />
        {!loading && !popular.length && !scheduled.length && !regional.length && <p style={css.note}>No language matches “{query}”.</p>}
      </div>

      <div style={css.foot}>
        <div style={{ fontSize: '0.82rem', color: '#475569', flex: 1, minWidth: 0 }}>
          {chosen ? (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span>Selected: <strong>{chosen.native}</strong> ({chosen.name}) — {chosenSt.text.replace(/^\S+\s/, '')}</span>
                {chosen.ttsAvailable && (
                  <button
                    type="button"
                    onClick={(e) => playPreview(e, chosen)}
                    style={{ ...css.previewBtnSmall, background: previewPlaying === chosen.code ? '#fee2e2' : '#f1f5f9', color: previewPlaying === chosen.code ? '#dc2626' : '#1e293b' }}>
                    {previewPlaying === chosen.code ? '⏹ Stop' : '🔊 Voice sample'}
                  </button>
                )}
              </div>
              {chosen.supportStatus === 'TEXT_SUPPORTED' && <div style={{ marginTop: 2 }}>Voice is not verified for this language yet. You can report by typing{chosen.textFallback ? `; prompts appear in ${byCode[chosen.textFallback]?.name || 'Hindi/English'}` : ''}.</div>}
            </div>
          ) : 'Choose a language to begin. Nothing is recorded or played until you do.'}
        </div>
        <button
          type="button"
          disabled={!chosen}
          onClick={() => {
            if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; }
            onSelect(chosen);
          }}
          style={{ ...css.go, opacity: chosen ? 1 : 0.5 }}>
          {chosen ? `Start / ${t.startConversation || 'शुरू करें'}` : 'Start / शुरू करें'}
        </button>
      </div>
    </div>
  );
};

const css = {
  wrap: { display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0, background: '#fff' },
  head: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '16px 18px 10px', background: 'linear-gradient(135deg,#16a34a,#0f766e)', color: '#fff' },
  brand: { fontSize: '0.85rem', opacity: 0.9, letterSpacing: 0.3 },
  title: { margin: '2px 0', fontSize: '1.25rem' },
  subtitle: { margin: 0, fontSize: '0.9rem', opacity: 0.95 },
  close: { background: 'transparent', border: 'none', color: '#fff', fontSize: '1.2rem', cursor: 'pointer', padding: 6 },
  body: { flex: 1, overflowY: 'auto', padding: '12px 16px' },
  filters: { display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 },
  input: { flex: '1 1 200px', minWidth: 0, padding: '10px 12px', border: '1px solid #cbd5e1', borderRadius: 8, fontSize: '0.95rem' },
  h3: { margin: '4px 0', fontSize: '1rem', color: '#0f172a' },
  note: { margin: '0 0 8px', fontSize: '0.8rem', color: '#64748b' },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(140px,1fr))', gap: 8 },
  chip: { display: 'flex', flexDirection: 'column', gap: 2, alignItems: 'flex-start', textAlign: 'left', padding: '10px 12px', border: '1.5px solid #e2e8f0', borderRadius: 10, background: '#fff', cursor: 'pointer', minHeight: 52 },
  chipBig: { padding: '12px 14px' },
  chipSel: { borderColor: '#16a34a', background: '#f0fdf4', boxShadow: '0 0 0 2px #bbf7d0' },
  sub: { fontSize: '0.74rem', color: '#64748b' },
  badge: { fontSize: '0.7rem', padding: '2px 7px', borderRadius: 999, fontWeight: 600 },
  previewBtn: { border: 'none', borderRadius: 6, padding: '2px 6px', fontSize: '0.78rem', cursor: 'pointer' },
  previewBtnSmall: { border: '1px solid #cbd5e1', borderRadius: 6, padding: '2px 8px', fontSize: '0.74rem', cursor: 'pointer', fontWeight: 500 },
  foot: { display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', borderTop: '1px solid #e2e8f0', background: '#f8fafc' },
  go: { padding: '12px 20px', background: '#16a34a', color: '#fff', border: 'none', borderRadius: 10, fontWeight: 700, fontSize: '0.95rem', cursor: 'pointer', whiteSpace: 'nowrap' },
  err: { background: '#fee2e2', color: '#991b1b', padding: 10, borderRadius: 8, marginBottom: 10, fontSize: '0.88rem' },
  link: { background: 'none', border: 'none', color: '#991b1b', textDecoration: 'underline', cursor: 'pointer' }
};

export default LanguageSelector;
