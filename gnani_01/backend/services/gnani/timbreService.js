const gnaniConfig = require('./gnaniConfig');
const { getLanguageConfig } = require('./languageConfig');
const { normalizeForSpeech } = require('./speechTextNormalizer');

/**
 * Converts raw 16-bit PCM audio from Gnani Timbre into standard RIFF/WAVE.
 * Browsers require a WAV container to decode and play audio.
 */
function rawPcmToWav(rawBuffer, sampleRate = 24000, numChannels = 1, bitDepth = 16) {
  if (rawBuffer.length > 44 && rawBuffer.toString('ascii', 0, 4) === 'RIFF') {
    return rawBuffer;
  }
  const byteRate = sampleRate * numChannels * (bitDepth / 8);
  const blockAlign = numChannels * (bitDepth / 8);
  const dataSize = rawBuffer.length;
  const header = Buffer.alloc(44);
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + dataSize, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(numChannels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(bitDepth, 34);
  header.write('data', 36);
  header.writeUInt32LE(dataSize, 40);
  return Buffer.concat([header, rawBuffer]);
}

/**
 * Gnani Timbre TTS adapter.
 * Synthesizes text with official Gnani Timbre API and wraps raw PCM in standard WAV.
 */
async function callTimbre(payload, correlationId) {
  const response = await fetch(gnaniConfig.timbreEndpoint, {
    method: 'POST',
    headers: {
      'X-API-Key-ID': gnaniConfig.apiKey,
      'Content-Type': 'application/json',
      'X-Correlation-Id': correlationId
    },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(gnaniConfig.timeoutMs)
  });
  if (!response.ok) {
    const errorBody = await response.text().catch(() => '');
    const err = new Error(`Timbre HTTP ${response.status}: ${errorBody.slice(0, 150)}`);
    err.status = response.status;
    throw err;
  }
  return Buffer.from(await response.arrayBuffer());
}

async function synthesizeSpeech(text, language = 'hi-IN', voice = 'female', correlationId = '') {
  if (!text || !text.trim()) throw new Error('Text is required for TTS synthesis');

  const langConfig = getLanguageConfig(language);
  const speechText = normalizeForSpeech(text, langConfig.code);
  const base = { displayText: text, textToSpeak: speechText, language: langConfig.code, useBrowserSpeech: false };

  if (!gnaniConfig.isConfigured()) {
    return { ...base, success: false, isLiveApi: false, error: 'TTS_NOT_CONFIGURED', message: 'Voice output is not configured on the server.' };
  }
  if (!langConfig.ttsAvailable) {
    return { ...base, success: false, isLiveApi: false, error: 'TTS_LANGUAGE_UNAVAILABLE', message: `Voice output is not available for ${langConfig.name}.` };
  }

  const selectedVoice = voice === 'male' ? langConfig.tts.defaultVoiceMale : langConfig.tts.defaultVoiceFemale;
  const payload = {
    text: speechText,
    language_code: langConfig.tts.languageCode,
    language: langConfig.tts.languageCode,
    model: langConfig.tts.model || 'timbre-v2.5',
    voice: selectedVoice,
    speed: 1.0,
    audio_config: { sample_rate: langConfig.tts.sampleRate || 24000, container: 'raw' }
  };

  let lastErr;
  for (let attempt = 0; attempt <= 1; attempt++) {
    try {
      const rawAudio = await callTimbre(payload, correlationId);
      if (rawAudio.length < 500) {
        throw new Error(`Timbre returned insufficient audio payload (${rawAudio.length} bytes)`);
      }
      const wav = rawPcmToWav(rawAudio, langConfig.tts.sampleRate || 24000);
      console.log(`🔊 [Timbre] Synthesized ${wav.length} bytes WAV (${selectedVoice}, ${langConfig.code})`);
      return {
        ...base,
        success: true,
        source: 'gnani_timbre_api',
        isLiveApi: true,
        audioDataUrl: `data:audio/wav;base64,${wav.toString('base64')}`,
        voice: selectedVoice,
        model: payload.model
      };
    } catch (e) {
      lastErr = e;
      const retryable = e.name === 'TimeoutError' || (e.status && e.status >= 500);
      if (!retryable) break;
    }
  }
  console.warn(`⚠️ [Timbre] failed for ${langConfig.code}: ${lastErr?.message}`);
  return { ...base, success: false, isLiveApi: false, error: 'TTS_FAILED', message: 'Voice output failed. The text reply is shown instead.' };
}

module.exports = { synthesizeSpeech, rawPcmToWav };
