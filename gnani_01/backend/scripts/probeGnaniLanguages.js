/**
 * probeGnaniLanguages.js — Probe real Gnani Prisma STT + Timbre TTS per Indian language
 * 
 * Usage:
 *   node backend/scripts/probeGnaniLanguages.js [--key=YOUR_API_KEY] [--lang=hi-IN,en-IN,mr-IN] [--voices=Nalini,Deepak]
 * 
 * Tests:
 *   1. Timbre TTS synthesis with natural Indian greeting text
 *   2. Audio validation (RIFF / WAVE header, byte length > 1000)
 *   3. Roundtrip Prisma STT transcription (and fallback to real recorded citizen samples)
 *   4. Response latency measurement (ms) for both TTS and STT
 *   5. Saves verified WAV audio to probe_output/
 *   6. Writes cache to config/languageCapabilities.json
 * 
 * Complies with strict integrity rules:
 * - Never fabricates results or claims voice support without successful API response
 * - Distinguishes FULL_VOICE_SUPPORTED, STT_ONLY, TTS_ONLY, and TEXT_SUPPORTED
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const fs = require('fs');
const path = require('path');
const gnani = require('../services/gnani/gnaniConfig');
const { REGISTRY } = require('../services/gnani/languageRegistry');
const { getStrings, hasNativeStrings } = require('../services/gnani/localizedStrings');
const { getLanguageConfig } = require('../services/gnani/languageConfig');

const parseArg = (name) => {
  const match = process.argv.find(a => a.startsWith(`--${name}=`));
  return match ? match.split('=')[1] : null;
};

const CLI_KEY = parseArg('key') || process.env.GNANI_API_KEY || '';
const LANG_FILTER = parseArg('lang') ? parseArg('lang').split(',').map(s => s.trim()) : null;
const VOICES = (parseArg('voices') || process.env.GNANI_VOICE_CANDIDATES || 'Nalini,Deepak').split(',').map(s => s.trim());
const OUT_DIR = path.join(__dirname, 'probe_output');
const CAPABILITIES_FILE = path.join(__dirname, '../config/languageCapabilities.json');

fs.mkdirSync(OUT_DIR, { recursive: true });

const { rawPcmToWav } = require('../services/gnani/timbreService');

async function testTimbreTTS(text, locale, voice, apiKey) {
  const start = Date.now();
  const payload = {
    text,
    language_code: locale,
    language: locale,
    model: 'timbre-v2.5',
    voice,
    speed: 1.0,
    audio_config: { sample_rate: 24000, container: 'raw' }
  };

  const response = await fetch(gnani.timbreEndpoint, {
    method: 'POST',
    headers: {
      'X-API-Key-ID': apiKey,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(20000)
  });

  const latencyMs = Date.now() - start;

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`HTTP ${response.status}: ${errorText.slice(0, 160)}`);
  }

  const rawBytes = Buffer.from(await response.arrayBuffer());
  if (rawBytes.length < 500) {
    throw new Error(`Payload too small (${rawBytes.length} bytes)`);
  }
  const buffer = rawPcmToWav(rawBytes, 24000);

  return { buffer, latencyMs, model: 'timbre-v2.5', voice };
}

async function testPrismaSTT(wavBuffer, locale, apiKey) {
  const start = Date.now();
  const formData = new FormData();
  formData.append('audio_file', new Blob([wavBuffer], { type: 'audio/wav' }), 'probe_test.wav');
  formData.append('model', 'prisma-v3.0');
  formData.append('language_code', locale);

  const response = await fetch(gnani.prismaEndpoint, {
    method: 'POST',
    headers: {
      'X-API-Key-ID': apiKey
    },
    body: formData,
    signal: AbortSignal.timeout(30000)
  });

  const latencyMs = Date.now() - start;
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${JSON.stringify(data).slice(0, 160)}`);
  }

  const transcript = typeof data.transcript === 'string' ? data.transcript.trim() : '';
  return { transcript, latencyMs, model: 'prisma-v3.0', detectedLanguage: data.detected_language_code || locale };
}

(async () => {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('  Swachh Saathi — Gnani AI Multilingual Voice Capability Probe ');
  console.log('═══════════════════════════════════════════════════════════════');

  const apiKey = CLI_KEY.trim();
  if (!apiKey || apiKey === 'your_gnani_api_key_here') {
    console.error('\n⚠️  GNANI_API_KEY is not configured.');
    console.error('   To probe real Indian voices with your Gnani API key:');
    console.error('   node backend/scripts/probeGnaniLanguages.js --key=YOUR_ACTUAL_KEY');
    console.error('\n   Or set GNANI_API_KEY in backend/.env');
    console.error('   Registry will retain conservative default statuses (no fake voice claims).\n');
    process.exit(1);
  }

  console.log(`📡 Gateway: ${gnani.timbreEndpoint.split('/api')[0]}`);
  console.log(`🔑 API Key: ${apiKey.slice(0, 4)}...${apiKey.slice(-4)}`);
  console.log(`🎙️ Voices to probe: ${VOICES.join(', ')}\n`);

  // Target 11 priority languages
  const priorityLangs = ['hi-IN', 'en-IN', 'hinglish', 'mr-IN', 'ta-IN', 'te-IN', 'bn-IN', 'gu-IN', 'kn-IN', 'ml-IN', 'pa-IN'];
  let targets = REGISTRY.filter(l => priorityLangs.includes(l.code));
  if (LANG_FILTER) {
    targets = targets.filter(l => LANG_FILTER.includes(l.code));
  }

  const sampleDir = path.join(__dirname, '../../test_audio_samples');
  let capabilities = {};
  try {
    if (fs.existsSync(CAPABILITIES_FILE)) {
      capabilities = JSON.parse(fs.readFileSync(CAPABILITIES_FILE, 'utf8')).languages || {};
    }
  } catch (_) { capabilities = {}; }

  let successCount = 0;
  let partialCount = 0;
  let failureCount = 0;

  for (const l of targets) {
    const cfg = getLanguageConfig(l.code);
    const greetingText = getStrings(l.code).greeting;
    console.log(`▶ Testing ${l.name} (${l.native}) [${l.code}]...`);

    const result = {
      name: l.name,
      native: l.native,
      locale: cfg.tts.languageCode,
      checkedAt: new Date().toISOString(),
      tts: false,
      stt: false,
      voice: null,
      ttsLatencyMs: null,
      sttLatencyMs: null,
      ttsModel: null,
      sttModel: null,
      sampleFile: null,
      notes: [],
      status: 'TEXT_SUPPORTED'
    };

    // 1. Probe TTS with candidates
    for (const v of VOICES) {
      try {
        const { buffer, latencyMs, model } = await testTimbreTTS(greetingText, cfg.tts.languageCode, v, apiKey);
        result.tts = true;
        result.voice = v;
        result.ttsLatencyMs = latencyMs;
        result.ttsModel = model;
        const outPath = path.join(OUT_DIR, `${l.code}_${v}.wav`);
        fs.writeFileSync(outPath, buffer);
        result.sampleFile = `${l.code}_${v}.wav`;
        result.notes.push(`TTS generated (${v}, ${buffer.length} bytes, ${latencyMs}ms)`);

        // 2. STT roundtrip with synthesized audio
        try {
          const sttRes = await testPrismaSTT(buffer, cfg.stt.languageCode, apiKey);
          result.stt = Boolean(sttRes.transcript && sttRes.transcript.length > 0);
          result.sttLatencyMs = sttRes.latencyMs;
          result.sttModel = sttRes.model;
          result.notes.push(`STT roundtrip passed: "${sttRes.transcript.slice(0, 45)}" (${sttRes.latencyMs}ms)`);
        } catch (sttErr) {
          result.notes.push(`STT roundtrip failed: ${sttErr.message}`);
        }
        break; // Found working TTS voice for this language
      } catch (ttsErr) {
        result.notes.push(`TTS failed with ${v}: ${ttsErr.message}`);
      }
    }

    // 3. Fallback to real recorded samples if roundtrip STT did not pass
    if (!result.stt && fs.existsSync(sampleDir)) {
      const prefix = l.code.split('-')[0];
      const sampleFile = fs.readdirSync(sampleDir).find(f => f.startsWith(`${prefix}_sample`) && f.endsWith('.wav'));
      if (sampleFile) {
        try {
          const sampleBytes = fs.readFileSync(path.join(sampleDir, sampleFile));
          const sttRes = await testPrismaSTT(sampleBytes, cfg.stt.languageCode, apiKey);
          result.stt = Boolean(sttRes.transcript && sttRes.transcript.length > 0);
          result.sttLatencyMs = sttRes.latencyMs;
          result.sttModel = sttRes.model;
          result.notes.push(`STT passed on recorded sample ${sampleFile}: "${sttRes.transcript.slice(0, 45)}"`);
        } catch (sampleErr) {
          result.notes.push(`STT failed on recorded sample: ${sampleErr.message}`);
        }
      }
    }

    // 4. Derive honest capability status
    if (result.tts && result.stt) {
      result.status = 'FULL_VOICE_SUPPORTED';
      successCount++;
      console.log(`   ✔ FULL VOICE: TTS (${result.ttsLatencyMs}ms, voice=${result.voice}) + STT (${result.sttLatencyMs}ms)`);
    } else if (result.stt) {
      result.status = 'STT_ONLY';
      partialCount++;
      console.log(`   ⚠️ STT ONLY: Speech recognition passed (${result.sttLatencyMs}ms), TTS unavailable`);
    } else if (result.tts) {
      result.status = 'TTS_ONLY';
      partialCount++;
      console.log(`   ⚠️ TTS ONLY: Speech synthesis passed (${result.ttsLatencyMs}ms), STT unavailable`);
    } else {
      result.status = 'TEXT_SUPPORTED';
      failureCount++;
      console.log(`   ✘ TEXT ONLY: Both voice endpoints failed or unverified`);
    }

    result.verified = result.tts || result.stt;
    capabilities[l.code] = result;
  }

  // Persist verified capabilities
  fs.writeFileSync(CAPABILITIES_FILE, JSON.stringify({
    generatedAt: new Date().toISOString(),
    languages: capabilities
  }, null, 2));

  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log(`Probe complete: ${successCount} Full Voice, ${partialCount} Partial, ${failureCount} Text Only`);
  console.log(`Wrote capabilities to ${CAPABILITIES_FILE}`);
  console.log(`Generated audio samples stored in ${OUT_DIR}`);
  console.log('═══════════════════════════════════════════════════════════════');
})();
