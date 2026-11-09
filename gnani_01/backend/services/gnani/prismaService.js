const gnaniConfig = require('./gnaniConfig');
const { getLanguageConfig } = require('./languageConfig');
const { handleGnaniError } = require('./gnaniErrorHandler');

/**
 * Gnani Prisma Speech-to-Text Adapter
 * Integrates official Vachana/Prisma endpoint for voice complaint transcription.
 * Optimized with language-specific hinting, accurate MIME types, and sample rates.
 */
async function transcribeAudio(audioBuffer, mimeType = 'audio/wav', language = 'hi-IN', correlationId = '') {
  if (!audioBuffer || audioBuffer.length === 0) {
    throw new Error('Audio buffer is required for transcription');
  }

  // Minimum size validation: reject silent/empty buffers (< 1KB)
  if (audioBuffer.length < 500) {
    return {
      success: false,
      transcript: '',
      error: 'AUDIO_TOO_SHORT',
      message: 'Audio input was too short. Please speak clearly into your microphone.'
    };
  }

  const langConfig = getLanguageConfig(language);

  // Never fabricate a transcript. Without credentials the caller must fall back to text input.
  if (!gnaniConfig.isConfigured()) {
    return { success: false, service: 'gnani_Prisma_STT', error: 'STT_NOT_CONFIGURED', message: 'Speech recognition is not configured on the server.', canFallbackToText: true };
  }
  if (!langConfig.sttAvailable) {
    return { success: false, service: 'gnani_Prisma_STT', error: 'STT_LANGUAGE_UNAVAILABLE', message: `Voice input is not available for ${langConfig.name}.`, canFallbackToText: true };
  }

  try {
    const formData = new FormData();
    // Only true RIFF/WAVE bytes are sent as WAV. The client converts to 16 kHz mono PCM WAV before upload.
    const isWav = audioBuffer.length > 12 && audioBuffer.toString('ascii', 0, 4) === 'RIFF' && audioBuffer.toString('ascii', 8, 12) === 'WAVE';
    if (!isWav) {
      return { success: false, service: 'gnani_Prisma_STT', error: 'UNSUPPORTED_AUDIO_FORMAT', message: 'Audio must be WAV (PCM). Please try recording again.', canFallbackToText: true };
    }
    const blob = new Blob([audioBuffer], { type: 'audio/wav' });
    formData.append('audio_file', blob, 'voice_complaint.wav');
    formData.append('model', langConfig.stt.model || 'prisma-v3.0');
    // Send exact language code (hi-IN, en-IN, mr-IN) to maximize acoustic accuracy
    formData.append('language_code', langConfig.stt.languageCode);

    const res = await fetch(gnaniConfig.prismaEndpoint, {
      method: 'POST',
      headers: {
        'X-API-Key-ID': gnaniConfig.apiKey,
        'X-Correlation-Id': correlationId
      },
      body: formData,
      signal: AbortSignal.timeout(gnaniConfig.timeoutMs)
    });

    const data = await res.json();
    console.log(`📡 [Prisma STT] Transcription completed (${langConfig.stt.languageCode}, chars: ${data.transcript ? data.transcript.length : 0})`);

    if (res.ok && data?.transcript !== undefined) {
      return {
        success: true,
        source: 'gnani_prisma_api',
        isLiveApi: true,
        transcript: data.transcript,
        language: data.detected_language_code || langConfig.code,
        confidence: data.confidence || 0.95,
        processingTime: data.processing_time || null,
        correlationId
      };
    } else {
      console.warn('⚠️ Gnani Prisma API error response:', data);
      throw new Error(data?.error?.message || data?.detail?.[0]?.msg || 'Gnani STT conversion failed');
    }
  } catch (error) {
    console.warn('⚠️ Falling back to error handler due to STT error:', error.message);
    const errorDetails = handleGnaniError('Prisma_STT', error, correlationId);
    return errorDetails;
  }
}

module.exports = {
  transcribeAudio
};
