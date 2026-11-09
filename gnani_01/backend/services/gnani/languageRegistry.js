/**
 * languageRegistry.js — single source of truth for Swachh Saathi languages.
 * Add a language by adding one entry here (+ optional strings in localizedStrings.js).
 * Voice status comes from config/languageCapabilities.json, which is WRITTEN BY
 * `node scripts/probeGnaniLanguages.js` after real STT/TTS calls. Without a probe result,
 * languages fall back to the conservative `defaultStatus` below (never an unverified claim of voice).
 */
const fs = require('fs');
const path = require('path');

const STATUS = {
  FULL: 'FULL_VOICE_SUPPORTED', STT_ONLY: 'STT_ONLY', TTS_ONLY: 'TTS_ONLY',
  TEXT: 'TEXT_SUPPORTED', SOON: 'COMING_SOON', DOWN: 'TEMPORARILY_UNAVAILABLE'
};

// group: popular | scheduled | regional (a language can be both popular and scheduled)
// scheduled:true => in Eighth Schedule. Regional entries must NEVER set scheduled:true.
// gnaniLocale: locale sent to Gnani, or null when not known to be offered.
const L = (code, name, native, locale, o = {}) => ({
  code, name, native, locale,
  scheduled: !!o.scheduled, popular: !!o.popular, group: o.group || (o.scheduled ? 'scheduled' : 'regional'),
  script: o.script || 'Other', gnaniLocale: o.gnaniLocale === undefined ? null : o.gnaniLocale,
  sttLocale: o.sttLocale, ttsLocale: o.ttsLocale,
  defaultStatus: o.defaultStatus || STATUS.TEXT, textResponseLang: o.textResponseLang || name,
  voice: o.voice || null
});

// Languages the existing code ran against Gnani (hi/en/mr/hinglish) default to FULL until the probe says otherwise.
// Others default to TEXT_SUPPORTED: promoted automatically only after the probe verifies real audio.
const REGISTRY = [
  L('hi-IN', 'Hindi', 'हिंदी', 'hi-IN', { scheduled: true, popular: true, script: 'Devanagari', gnaniLocale: 'hi-IN', defaultStatus: STATUS.FULL }),
  L('en-IN', 'English', 'English', 'en-IN', { popular: true, script: 'Latin', gnaniLocale: 'en-IN', defaultStatus: STATUS.FULL, group: 'popular' }),
  L('hinglish', 'Hinglish', 'Hinglish', 'hi-IN', { popular: true, script: 'Latin', gnaniLocale: 'hi-IN', sttLocale: 'hi-IN', ttsLocale: 'hi-IN', defaultStatus: STATUS.FULL, group: 'popular', textResponseLang: 'Hinglish (Hindi in Roman script)' }),
  L('ta-IN', 'Tamil', 'தமிழ்', 'ta-IN', { scheduled: true, popular: true, script: 'Tamil', gnaniLocale: 'ta-IN' }),
  L('te-IN', 'Telugu', 'తెలుగు', 'te-IN', { scheduled: true, popular: true, script: 'Telugu', gnaniLocale: 'te-IN' }),
  L('bn-IN', 'Bengali', 'বাংলা', 'bn-IN', { scheduled: true, popular: true, script: 'Bengali', gnaniLocale: 'bn-IN' }),
  L('mr-IN', 'Marathi', 'मराठी', 'mr-IN', { scheduled: true, popular: true, script: 'Devanagari', gnaniLocale: 'mr-IN', defaultStatus: STATUS.FULL }),
  L('gu-IN', 'Gujarati', 'ગુજરાતી', 'gu-IN', { scheduled: true, popular: true, script: 'Gujarati', gnaniLocale: 'gu-IN' }),
  L('kn-IN', 'Kannada', 'ಕನ್ನಡ', 'kn-IN', { scheduled: true, popular: true, script: 'Kannada', gnaniLocale: 'kn-IN' }),
  L('ml-IN', 'Malayalam', 'മലയാളം', 'ml-IN', { scheduled: true, popular: true, script: 'Malayalam', gnaniLocale: 'ml-IN' }),
  L('pa-IN', 'Punjabi', 'ਪੰਜਾਬੀ', 'pa-IN', { scheduled: true, popular: true, script: 'Gurmukhi', gnaniLocale: 'pa-IN' }),
  // Remaining Eighth Schedule languages
  L('as-IN', 'Assamese', 'অসমীয়া', 'as-IN', { scheduled: true, script: 'Bengali' }),
  L('brx-IN', 'Bodo', 'बड़ो', 'brx-IN', { scheduled: true, script: 'Devanagari' }),
  L('doi-IN', 'Dogri', 'डोगरी', 'doi-IN', { scheduled: true, script: 'Devanagari' }),
  L('ks-IN', 'Kashmiri', 'کٲشُر', 'ks-IN', { scheduled: true, script: 'Perso-Arabic' }),
  L('kok-IN', 'Konkani', 'कोंकणी', 'kok-IN', { scheduled: true, script: 'Devanagari' }),
  L('mai-IN', 'Maithili', 'मैथिली', 'mai-IN', { scheduled: true, script: 'Devanagari' }),
  L('mni-IN', 'Manipuri / Meitei', 'ꯃꯦꯇꯦꯏꯂꯣꯟ', 'mni-IN', { scheduled: true, script: 'Meitei Mayek' }),
  L('ne-IN', 'Nepali', 'नेपाली', 'ne-IN', { scheduled: true, script: 'Devanagari' }),
  L('or-IN', 'Odia', 'ଓଡ଼ିଆ', 'or-IN', { scheduled: true, script: 'Odia' }),
  L('sa-IN', 'Sanskrit', 'संस्कृतम्', 'sa-IN', { scheduled: true, script: 'Devanagari' }),
  L('sat-IN', 'Santali', 'ᱥᱟᱱᱛᱟᱲᱤ', 'sat-IN', { scheduled: true, script: 'Ol Chiki' }),
  L('sd-IN', 'Sindhi', 'سنڌي', 'sd-IN', { scheduled: true, script: 'Perso-Arabic' }),
  L('ur-IN', 'Urdu', 'اردو', 'ur-IN', { scheduled: true, script: 'Perso-Arabic' }),
  // Other regional (NOT Eighth Schedule)
  L('bho-IN', 'Bhojpuri', 'भोजपुरी', 'bho-IN', { script: 'Devanagari' }),
  L('bgc-IN', 'Haryanvi', 'हरियाणवी', 'bgc-IN', { script: 'Devanagari' }),
  L('raj-IN', 'Rajasthani', 'राजस्थानी', 'raj-IN', { script: 'Devanagari' }),
  L('mwr-IN', 'Marwari', 'मारवाड़ी', 'mwr-IN', { script: 'Devanagari' }),
  L('hne-IN', 'Chhattisgarhi', 'छत्तीसगढ़ी', 'hne-IN', { script: 'Devanagari' }),
  L('bns-IN', 'Bundeli', 'बुंदेली', 'bns-IN', { script: 'Devanagari' }),
  L('mup-IN', 'Malvi', 'मालवी', 'mup-IN', { script: 'Devanagari' }),
  L('gbm-IN', 'Garhwali', 'गढ़वाली', 'gbm-IN', { script: 'Devanagari' }),
  L('kfy-IN', 'Kumaoni', 'कुमाऊँनी', 'kfy-IN', { script: 'Devanagari' }),
  L('tcy-IN', 'Tulu', 'ತುಳು', 'tcy-IN', { script: 'Kannada' }),
  L('kha-IN', 'Khasi', 'Khasi', 'kha-IN', { script: 'Latin' }),
  L('grt-IN', 'Garo', 'Garo', 'grt-IN', { script: 'Latin' }),
  L('lus-IN', 'Mizo', 'Mizo', 'lus-IN', { script: 'Latin' }),
  L('trp-IN', 'Kokborok', 'Kokborok', 'trp-IN', { script: 'Latin' })
];

// Regional languages that have no text-response templates fall back to the nearest widely-understood
// language for the app's own prompts; the UI says so honestly (see `textFallback`).
const TEXT_FALLBACK = {
  'bho-IN': 'hi-IN', 'bgc-IN': 'hi-IN', 'raj-IN': 'hi-IN', 'mwr-IN': 'hi-IN', 'hne-IN': 'hi-IN', 'bns-IN': 'hi-IN',
  'mup-IN': 'hi-IN', 'gbm-IN': 'hi-IN', 'kfy-IN': 'hi-IN', 'mai-IN': 'hi-IN', 'doi-IN': 'hi-IN', 'brx-IN': 'hi-IN',
  'kok-IN': 'mr-IN', 'sa-IN': 'hi-IN', 'ne-IN': 'hi-IN', 'ks-IN': 'ur-IN', 'sd-IN': 'ur-IN', 'tcy-IN': 'kn-IN',
  'as-IN': 'bn-IN', 'or-IN': 'en-IN', 'ur-IN': 'en-IN', 'mni-IN': 'en-IN', 'sat-IN': 'en-IN',
  'kha-IN': 'en-IN', 'grt-IN': 'en-IN', 'lus-IN': 'en-IN', 'trp-IN': 'en-IN'
};

const STATE_LANGUAGES = {
  'Andhra Pradesh': ['te-IN', 'ur-IN', 'en-IN'], 'Arunachal Pradesh': ['en-IN', 'hi-IN'], 'Assam': ['as-IN', 'bn-IN', 'brx-IN'],
  'Bihar': ['hi-IN', 'bho-IN', 'mai-IN'], 'Chhattisgarh': ['hi-IN', 'hne-IN'], 'Goa': ['kok-IN', 'mr-IN', 'en-IN'],
  'Gujarat': ['gu-IN', 'hi-IN'], 'Haryana': ['hi-IN', 'bgc-IN', 'pa-IN'], 'Himachal Pradesh': ['hi-IN', 'pa-IN'],
  'Jharkhand': ['hi-IN', 'sat-IN', 'bn-IN'], 'Karnataka': ['kn-IN', 'tcy-IN', 'en-IN'], 'Kerala': ['ml-IN', 'en-IN'],
  'Madhya Pradesh': ['hi-IN', 'bns-IN', 'mup-IN'], 'Maharashtra': ['mr-IN', 'hi-IN', 'en-IN'], 'Manipur': ['mni-IN', 'en-IN'],
  'Meghalaya': ['kha-IN', 'grt-IN', 'en-IN'], 'Mizoram': ['lus-IN', 'en-IN'], 'Nagaland': ['en-IN'], 'Odisha': ['or-IN', 'hi-IN'],
  'Punjab': ['pa-IN', 'hi-IN'], 'Rajasthan': ['hi-IN', 'raj-IN', 'mwr-IN'], 'Sikkim': ['ne-IN', 'en-IN'], 'Tamil Nadu': ['ta-IN', 'en-IN'],
  'Telangana': ['te-IN', 'ur-IN', 'en-IN'], 'Tripura': ['bn-IN', 'trp-IN'], 'Uttar Pradesh': ['hi-IN', 'bho-IN', 'ur-IN'],
  'Uttarakhand': ['hi-IN', 'gbm-IN', 'kfy-IN'], 'West Bengal': ['bn-IN', 'hi-IN', 'ne-IN'],
  'Andaman and Nicobar Islands': ['hi-IN', 'bn-IN', 'ta-IN'], 'Chandigarh': ['pa-IN', 'hi-IN'],
  'Dadra and Nagar Haveli and Daman and Diu': ['gu-IN', 'hi-IN'], 'Delhi': ['hi-IN', 'en-IN', 'pa-IN', 'ur-IN'],
  'Jammu and Kashmir': ['ks-IN', 'doi-IN', 'ur-IN', 'hi-IN'], 'Ladakh': ['hi-IN', 'en-IN'], 'Lakshadweep': ['ml-IN', 'en-IN'],
  'Puducherry': ['ta-IN', 'te-IN', 'ml-IN', 'en-IN']
};

let overrides = {};
function loadOverrides() {
  try {
    overrides = JSON.parse(fs.readFileSync(path.join(__dirname, '../../config/languageCapabilities.json'), 'utf8')).languages || {};
  } catch (_) { overrides = {}; }
}
loadOverrides();

function computeStatus(l) {
  const o = overrides[l.code];
  if (o) {
    if (o.status) return { status: o.status, verified: true, voice: o.voice || l.voice, stt: !!o.stt, tts: !!o.tts, checkedAt: o.checkedAt };
    const stt = !!o.stt, tts = !!o.tts;
    const status = stt && tts ? STATUS.FULL : stt ? STATUS.STT_ONLY : tts ? STATUS.TTS_ONLY : STATUS.TEXT;
    return { status, verified: true, voice: o.voice || null, stt, tts, checkedAt: o.checkedAt };
  }
  const full = l.defaultStatus === STATUS.FULL;
  return { status: l.defaultStatus, verified: false, voice: null, stt: full, tts: full, checkedAt: null };
}

function describe(l) {
  const s = computeStatus(l);
  return {
    code: l.code, name: l.name, native: l.native, locale: l.locale, script: l.script,
    scheduled: l.scheduled, popular: l.popular,
    group: l.popular ? 'popular' : (l.scheduled ? 'scheduled' : 'regional'),
    sttProvider: s.stt ? 'gnani-prisma' : null, ttsProvider: s.tts ? 'gnani-timbre' : null,
    sttAvailable: s.stt, ttsAvailable: s.tts, voiceId: s.voice,
    supportStatus: s.status, voiceVerified: s.verified,
    textFallback: TEXT_FALLBACK[l.code] || null
  };
}

const byCode = new Map(REGISTRY.map(l => [l.code, l]));
const getLanguage = (code) => byCode.has(code) ? describe(byCode.get(code)) : null;
const listLanguages = () => REGISTRY.map(describe);
const isKnown = (code) => byCode.has(code);

module.exports = { STATUS, REGISTRY, STATE_LANGUAGES, TEXT_FALLBACK, getLanguage, listLanguages, isKnown, reload: loadOverrides };
