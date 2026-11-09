/**
 * languageConfig.js — adapter from the central registry to the shape Prisma/Timbre/Evon services use.
 * Voices are configurable per language in config/languageCapabilities.json (written by the probe script)
 * or via env GNANI_VOICE_FEMALE / GNANI_VOICE_MALE. Nalini/Deepak are the only voices already used by this project.
 */
const { getLanguage, isKnown } = require('./languageRegistry');

const DEFAULT_FEMALE = process.env.GNANI_VOICE_FEMALE || 'Nalini';
const DEFAULT_MALE = process.env.GNANI_VOICE_MALE || 'Deepak';

function getLanguageConfig(langCode) {
  const lang = getLanguage(isKnown(langCode) ? langCode : 'hi-IN');
  const sttLocale = lang.code === 'hinglish' ? 'hi-IN' : lang.locale;
  const voice = lang.voiceId || DEFAULT_FEMALE;
  return {
    code: lang.code,
    label: `${lang.native} (${lang.name})`,
    name: lang.name,
    script: lang.script,
    supportStatus: lang.supportStatus,
    sttAvailable: lang.sttAvailable,
    ttsAvailable: lang.ttsAvailable,
    stt: { model: 'prisma-v3.0', languageCode: sttLocale, sampleRate: 16000, encoding: 'wav' },
    tts: {
      provider: 'Gnani Timbre', model: 'timbre-v2.5', defaultVoiceFemale: voice, defaultVoiceMale: DEFAULT_MALE,
      languageCode: sttLocale, sampleRate: 24000, container: 'wav'
    },
    responseLanguage: lang.code === 'hinglish' ? 'Hinglish (Hindi written in Roman script)' : `${lang.name} (${lang.native})`,
    systemInstruction: `Reply ONLY in ${lang.code === 'hinglish' ? 'natural Roman-script Hinglish' : `natural, conversational ${lang.name} written in its native script (${lang.script})`}. Use everyday Indian phrasing, not formal administrative or word-for-word translated language. Understand mixed-language input but always respond in the selected language.`
  };
}

module.exports = { getLanguageConfig };
