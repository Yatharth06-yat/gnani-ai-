/**
 * speechTextNormalizer.js
 * Optimizes AI response text for Gnani Timbre speech synthesis without altering meaning.
 * Maintains two distinct representations:
 * 1. Display Text: Rich formatted markdown for the user-facing chat UI.
 * 2. Speech Text: Clean, natural spoken text with appropriate pauses and phonetic numbers.
 */

function normalizeComplaintIdForSpeech(id, lang = 'hi-IN') {
  if (!id) return '';
  const parts = id.split('-');
  if (parts.length >= 3) {
    const prefixes = {
      'hi-IN': 'एस डब्ल्यू एम',
      'mr-IN': 'एस डब्ल्यू एम',
      'ta-IN': 'எஸ் டபிள்யூ எம்',
      'te-IN': 'ఎస్ డబ్ల్యూ ఎం',
      'bn-IN': 'এস ডাব্লিউ এম',
      'gu-IN': 'એસ ડબલ્યુ એમ',
      'kn-IN': 'ಎಸ್ ಡಬ್ಲ್ಯೂ ಎಂ',
      'ml-IN': 'എസ് ഡബ്ല്യു എം',
      'pa-IN': 'ਐੱਸ ਡਬਲਿਊ ਐੱਮ',
      'en-IN': 'S W M',
      'hinglish': 'S W M'
    };
    const prefix = prefixes[lang] || 'S W M';
    const yearDigits = parts[1].split('').join(' ');
    const numDigits = parts[2].split('').join(' ');
    return `${prefix}, ${yearDigits}, ${numDigits}`;
  }
  return id;
}

function normalizeForSpeech(displayText, lang = 'hi-IN') {
  if (!displayText || typeof displayText !== 'string') return '';

  let speech = displayText;

  // 1. Remove action tags or system markers
  speech = speech.replace(/\[READY_TO_SUBMIT\]/g, '');
  speech = speech.replace(/\[action:\s*[^\]]+\]/gi, '');

  // 2. Normalize complaint IDs in speech (e.g., SWM-2026-4595)
  speech = speech.replace(/\bSWM-(\d{4})-(\d{4})\b/g, (match) => {
    return normalizeComplaintIdForSpeech(match, lang);
  });

  // 3. Remove Markdown headings, bold, italics, code blocks
  speech = speech.replace(/#{1,6}\s+/g, '');
  speech = speech.replace(/\*\*(.*?)\*\*/g, '$1');
  speech = speech.replace(/\*(.*?)\*/g, '$1');
  speech = speech.replace(/`([^`]+)`/g, '$1');

  // 4. Clean summary list formatting into spoken cadence
  speech = speech.replace(/Problem:\s*/gi, (lang === 'hi-IN' ? 'समस्या: ' : (lang === 'mr-IN' ? 'समस्या: ' : 'Problem: ')));
  speech = speech.replace(/Area:\s*/gi, (lang === 'hi-IN' ? 'क्षेत्र: ' : (lang === 'mr-IN' ? 'क्षेत्र: ' : 'Area: ')));
  speech = speech.replace(/Site:\s*/gi, (lang === 'hi-IN' ? 'स्थान: ' : (lang === 'mr-IN' ? 'ठिकाण: ' : 'Site: ')));
  speech = speech.replace(/Duration:\s*/gi, (lang === 'hi-IN' ? 'समय: ' : (lang === 'mr-IN' ? 'कालावधी: ' : 'Duration: ')));
  speech = speech.replace(/Frequency:\s*/gi, (lang === 'hi-IN' ? 'आवृत्ति: ' : (lang === 'mr-IN' ? 'वारंवारता: ' : 'Frequency: ')));
  speech = speech.replace(/Odour\/Hazard:\s*/gi, (lang === 'hi-IN' ? 'बदबू: ' : (lang === 'mr-IN' ? 'दुर्गंधी: ' : 'Odour: ')));
  speech = speech.replace(/Location:\s*/gi, (lang === 'hi-IN' ? 'लोकेशन: ' : (lang === 'mr-IN' ? 'लोकेशन: ' : 'Location: ')));
  speech = speech.replace(/Landmark:\s*/gi, (lang === 'hi-IN' ? 'लैंडमार्क: ' : (lang === 'mr-IN' ? 'खूण: ' : 'Landmark: ')));
  speech = speech.replace(/Image verification:\s*/gi, (lang === 'hi-IN' ? 'तस्वीर: ' : (lang === 'mr-IN' ? 'फोटो: ' : 'Photo: ')));

  // 5. Replace technical acronyms and parens
  speech = speech.replace(/\(YOLO11n\)/gi, '');
  speech = speech.replace(/YOLO11n/gi, (lang === 'en-IN' ? 'AI' : 'एआई'));
  speech = speech.replace(/\s*\(\s*([^)]+)\s*\)/g, ', $1, ');

  // 6. Replace multiple line breaks with commas or periods for smooth speech pauses
  speech = speech.replace(/\n\s*\n/g, '। ');
  speech = speech.replace(/\n/g, ', ');

  // 7. Strip emojis and special decorative symbols
  speech = speech.replace(/[\u{1F300}-\u{1F9FF}]/gu, '');
  speech = speech.replace(/[✓✔🎯📷📸🎙️📡🔊🎉✅❌⚠️ℹ️🏷️🔄👁️⚪]/gu, '');

  // 8. Clean up redundant spaces and punctuation
  speech = speech.replace(/\s+/g, ' ');
  speech = speech.replace(/,\s*,/g, ',');
  speech = speech.replace(/।\s*।/g, '।');
  speech = speech.replace(/\.\s*\./g, '.');

  return speech.trim();
}

module.exports = {
  normalizeForSpeech,
  normalizeComplaintIdForSpeech
};

