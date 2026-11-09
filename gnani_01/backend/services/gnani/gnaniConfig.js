const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const gnaniConfig = {
  get apiKey() { return process.env.GNANI_API_KEY || ''; },
  get prismaEndpoint() { return process.env.GNANI_PRISMA_ENDPOINT || 'https://api.vachana.ai/stt/v3'; },
  get evonEndpoint() { return process.env.GNANI_EVON_ENDPOINT || 'https://api.vachana.ai/v1/chat/completions'; },
  get timbreEndpoint() { return process.env.GNANI_TIMBRE_ENDPOINT || 'https://api.vachana.ai/api/v1/tts/inference'; },
  get timeoutMs() { return parseInt(process.env.GNANI_TIMEOUT_MS, 10) || 15000; },
  maxRetries: 2,
  defaultLanguage: 'hi-IN',
  supportedLanguages: ['hi-IN', 'en-IN', 'hinglish', 'kn-IN', 'ta-IN', 'te-IN', 'mr-IN'],
  isConfigured: () => Boolean(process.env.GNANI_API_KEY && process.env.GNANI_API_KEY.trim().length > 0)
};

module.exports = gnaniConfig;

