/**
 * dialogueEngine.js — dynamic slot-filling conversation engine (replaces the scripted state machine).
 * Language-independent complaint slots  ->  multilingual response layer (localizedStrings.js).
 * Understanding: Gnani Evon (JSON extraction, any language / code-mixed) with a rule-based fallback.
 * Rules: ask only for missing info, one question at a time, never repeat a question, never guess values.
 */
const { callEvonJSON, ruleBasedCivicParser } = require('./evonService');
const { getLanguageConfig } = require('./languageConfig');
const { getStrings } = require('./localizedStrings');

const CATEGORIES = ['plastic_waste', 'food_waste', 'paper_cardboard', 'construction_debris', 'mixed_waste', 'hazardous_waste', 'sanitation_overflow', 'other'];
const INTENTS = ['inform', 'confirm', 'deny', 'cancel', 'skip', 'correct', 'unclear'];

// Minimal multilingual yes/no/skip/cancel cues used ONLY when Evon is unavailable.
const CUES = {
  confirm: /^(yes|yeah|yep|ok|okay|correct|sure|confirm|register|submit|haan|han|ha|haa|sahi|theek|thik|bilkul|kar do|हाँ|हां|हा|सही|ठीक|दर्ज|होय|हो|बरोबर|ஆம்|சரி|అవును|సరే|হ্যাঁ|ঠিক|હા|સાચું|ಹೌದು|ಸರಿ|അതെ|ശരി|ਹਾਂ|ਠੀਕ)/i,
  deny: /^(no|nope|wrong|incorrect|nahi|nahin|nai|galat|नहीं|नही|गलत|नाही|चूक|இல்லை|కాదు|না|ভুল|ના|ಇಲ್ಲ|ഇല്ല|ਨਹੀਂ)/i,
  skip: /^(skip|no photo|later|chhod|chod|rehne do|छोड़|छोड|वगळा|தவிர்|వదిలేయ|বাদ|છોડ|ಬಿಡಿ|ഒഴിവാക്ക|ਛੱਡ)/i,
  cancel: /(cancel|stop|never mind|nevermind|forget it|रद्द|कैंसल|बंद करो|नको|ரத்து|రద్దు|বাতিল|રદ|ರದ್ದು|റദ്ദ|ਰੱਦ)/i
};

function fallbackExtract(text, lang, ctx) {
  const t = text.trim();
  const parsed = ruleBasedCivicParser(t, null, null, lang);
  let intent = 'inform';
  if (CUES.cancel.test(t)) intent = 'cancel';
  else if (CUES.skip.test(t)) intent = 'skip';
  else if (CUES.confirm.test(t) && t.split(/\s+/).length <= 4) intent = 'confirm';
  else if (CUES.deny.test(t) && t.split(/\s+/).length <= 4) intent = 'deny';
  const out = { intent, problem: '', waste_category: parsed.waste_category || null, duration: null, severity: null, location_text: null, landmark: null, corrections: {} };
  if (intent === 'inform') {
    if (parsed.waste_category || /kachra|garbage|waste|कचरा|कूड़ा|गंदगी|घाण|कचऱ्|குப்பை|చెత్త|আবর্জনা|કચરો|ಕಸ|മാലിന്യ|ਕੂੜ/i.test(t)) out.problem = t;
    else if (!ctx.problem_description) out.problem = t;
    if (parsed.duration && parsed.duration !== 'unknown') out.duration = parsed.duration.replace(/\s*\(.*\)$/, '');
    if (['low', 'medium', 'high', 'critical'].includes(parsed.severity)) out.severity = parsed.severity;
    if (parsed.location_description && !/not specified|supplied/i.test(parsed.location_description)) out.landmark = parsed.location_description;
    // A short answer given while the engine is waiting on a specific slot fills that slot verbatim.
    const q = ctx.currentQuestionKey;
    if (q === 'duration' && !out.duration) out.duration = t;
    if ((q === 'location' || q === 'gps' || q === 'pin') && !out.landmark) out.location_text = t;
    if (q === 'landmark' && !out.landmark) out.landmark = t;
    if (q === 'severity' && !out.severity) out.severity = t;
    if (q !== 'problem' && ctx.problem_description) out.problem = ''; // don't overwrite the problem with an answer to another question
  }
  return out;
}

async function understandTurn(text, session, ctx) {
  const lang = session.language;
  const cfg = getLanguageConfig(lang);
  const sys = `You extract fields from ONE citizen turn in a civic cleanliness complaint chat. The citizen may mix languages (e.g. Hindi+English). The chat language is ${cfg.responseLanguage}.
Return ONLY JSON: {"intent":"inform|confirm|deny|cancel|skip|correct|unclear","problem":"","waste_category":null|"${CATEGORIES.join('|')}","duration":null|"","severity":null|"low|medium|high|critical","location_text":null|"","landmark":null|"","corrections":{"<field>":"<new value>"}}
Rules: copy the citizen's own words for text fields; set a field ONLY if the citizen actually said it; never invent places, landmarks or durations; "unclear" if the turn is unintelligible; "correct" when the citizen changes a previously given value (put it in corrections using field names problem|duration|severity|location_text|landmark).
Known so far: ${JSON.stringify({ problem: ctx.problem_description, duration: ctx.duration, severity: ctx.severity, location: ctx.confirmedAddress, landmark: ctx.landmark })}. The assistant just asked about: ${ctx.currentQuestionKey || 'problem'}.`;
  const r = await callEvonJSON(sys, { citizen_turn: text }, `NLU-${Date.now()}`);
  if (r.ok && r.data && typeof r.data === 'object') {
    const d = r.data;
    return {
      source: 'gnani_evon',
      intent: INTENTS.includes(d.intent) ? d.intent : 'inform',
      problem: typeof d.problem === 'string' ? d.problem.trim() : '',
      waste_category: CATEGORIES.includes(d.waste_category) ? d.waste_category : null,
      duration: typeof d.duration === 'string' && d.duration.trim() ? d.duration.trim() : null,
      severity: ['low', 'medium', 'high', 'critical'].includes(d.severity) ? d.severity : null,
      location_text: typeof d.location_text === 'string' && d.location_text.trim() ? d.location_text.trim() : null,
      landmark: typeof d.landmark === 'string' && d.landmark.trim() ? d.landmark.trim() : null,
      corrections: d.corrections && typeof d.corrections === 'object' ? d.corrections : {}
    };
  }
  return { source: 'rule_based', ...fallbackExtract(text, lang, ctx) };
}

function applyExtraction(ctx, x) {
  const set = (k, v) => { if (v && String(v).trim()) ctx[k] = String(v).trim().slice(0, 500); };
  const fieldMap = { problem: 'problem_description', duration: 'duration', severity: 'severity', location_text: 'confirmedAddress', landmark: 'landmark' };
  for (const [f, v] of Object.entries(x.corrections || {})) if (fieldMap[f] && typeof v === 'string') { set(fieldMap[f], v); if (f === 'location_text') { ctx.locationSource = 'manual'; ctx.locationVerified = false; } }
  if (x.problem && !ctx.problem_description) { ctx.problem_description = x.problem.slice(0, 500); ctx.citizen_description = ctx.citizen_description || x.problem.slice(0, 500); }
  else if (x.problem && ctx.currentQuestionKey === 'problem') ctx.problem_description = x.problem.slice(0, 500);
  if (x.waste_category) ctx.waste_category = x.waste_category;
  if (x.duration) ctx.duration = x.duration;
  if (x.severity) ctx.severity = x.severity;
  if (x.landmark) ctx.landmark = x.landmark;
  if (x.location_text && !(ctx.latitude != null && ctx.locationVerified)) {
    ctx.confirmedAddress = x.location_text; ctx.locationSource = ctx.locationSource === 'none' || !ctx.locationSource ? 'manual' : ctx.locationSource; ctx.locationVerified = ctx.locationVerified || false;
  }
}

const hasLocation = (c) => (c.latitude != null && c.longitude != null) || Boolean(c.confirmedAddress) || Boolean(c.landmark);

function summaryText(S, ctx) {
  const L = S.labels;
  const where = [ctx.confirmedAddress, ctx.landmark].filter(Boolean).join(', ') || '—';
  const pin = ctx.locationVerified ? L.verified : L.unverified;
  const lines = [
    `${L.problem}: ${ctx.problem_description || '—'}`,
    `${L.location}: ${where} (${pin})`,
    ctx.duration && `${L.duration}: ${ctx.duration}`,
    ctx.severity && `${L.severity}: ${ctx.severity}`,
    `${L.photo}: ${ctx.imageVerificationStatus === 'verified' ? L.yes : L.no}`
  ].filter(Boolean);
  return `${S.confirm_intro}\n\n${lines.join('\n')}\n\n${S.confirm_ask}`;
}

/** Decide the single next question. Returns { key, stage, textKey } or null when ready to confirm. */
function nextStep(ctx) {
  const asked = new Set(ctx.askedQuestions || []);
  if (!ctx.problem_description) return { key: 'problem', stage: 'problem_discovery', textKey: 'ask_problem' };
  if (ctx.latitude == null) {
    // GPS consent first (UI offers: allow GPS / type address / drop pin). Never defaulted, never auto-requested.
    if (!asked.has('gps') && ctx.locationPermissionStatus !== 'denied') return { key: 'gps', stage: 'location_permission', textKey: 'ask_gps' };
    if (!hasLocation(ctx) && !asked.has('location')) return { key: 'location', stage: 'location_query', textKey: 'ask_location' };
    // Registration needs a map point: ask once for a pin if only a typed address/landmark is known.
    if (!asked.has('pin')) return { key: 'pin', stage: 'location_query', textKey: 'gps_denied' };
  }
  if (!ctx.duration && !asked.has('duration')) return { key: 'duration', stage: 'duration', textKey: 'ask_duration' };
  if (!ctx.severity && !asked.has('severity')) return { key: 'severity', stage: 'details', textKey: 'ask_severity' };
  if (ctx.imageVerificationStatus !== 'verified' && !ctx.photoSkipped && !asked.has('photo')) return { key: 'photo', stage: 'image_request', textKey: 'ask_photo' };
  return null;
}

async function processTurn(session, userText) {
  const lang = session.language;
  const S = getStrings(lang);
  const ctx = session.complaintContext?.toObject ? session.complaintContext.toObject() : { ...(session.complaintContext || {}) };
  ctx.askedQuestions = ctx.askedQuestions || [];
  const result = { reply: '', updatedContext: ctx, source: 'dialogue_engine', readyToSubmit: false, action: null };

  const x = await understandTurn(userText, session, ctx);
  result.source = x.source === 'gnani_evon' ? 'gnani_evon' : 'rule_based';

  if (x.intent === 'cancel') {
    Object.assign(ctx, { stage: 'cancelled', is_confirmed_by_user: false });
    result.reply = S.cancelled; result.action = 'cancelled';
    return result;
  }
  if (x.intent === 'unclear' && !x.problem) {
    result.reply = S.did_not_catch; return result;
  }

  // Confirmation stage
  if (ctx.stage === 'summary_confirmation') {
    if (x.intent === 'confirm') {
      if (ctx.latitude == null || ctx.longitude == null) { ctx.stage = 'location_query'; ctx.currentQuestionKey = 'pin'; result.reply = S.gps_denied; return result; }
      ctx.is_confirmed_by_user = true; result.readyToSubmit = true; result.action = 'submit';
      result.reply = ''; // route performs the real submission and speaks the real result
      return result;
    }
    const before = JSON.stringify([ctx.problem_description, ctx.duration, ctx.severity, ctx.confirmedAddress, ctx.landmark]);
    applyExtraction(ctx, x);
    const changed = before !== JSON.stringify([ctx.problem_description, ctx.duration, ctx.severity, ctx.confirmedAddress, ctx.landmark]);
    if (changed) { ctx.stage = 'summary_confirmation'; ctx.summary = summaryText(S, ctx); result.reply = `${S.corrected}\n\n${ctx.summary}`; return result; }
    if (x.intent === 'deny') { ctx.stage = 'problem_discovery'; ctx.currentQuestionKey = 'problem'; result.reply = S.ask_problem; return result; }
    result.reply = S.confirm_ask; return result;
  }

  // Slot answers
  const q = ctx.currentQuestionKey;
  if (x.intent === 'skip') {
    if (q === 'photo') ctx.photoSkipped = true;
    if (q === 'duration' || q === 'severity') { /* optional: mark asked, move on */ }
  }
  if (q === 'gps' && x.intent === 'confirm' && ctx.latitude == null) { // consent given by voice: UI triggers the browser permission prompt
    result.action = 'request_gps'; result.reply = ''; return result;
  }
  if (q === 'gps' && x.intent === 'deny') ctx.locationPermissionStatus = 'denied';
  applyExtraction(ctx, x);
  if (q && q !== 'problem' && !ctx.askedQuestions.includes(q)) ctx.askedQuestions.push(q); // never ask the same slot twice

  const step = nextStep(ctx);
  if (!step) {
    ctx.stage = 'summary_confirmation'; ctx.currentQuestionKey = 'summary_confirmation';
    ctx.summary = summaryText(S, ctx); result.reply = ctx.summary;
  } else {
    ctx.stage = step.stage; ctx.currentQuestionKey = step.key;
    result.reply = S[step.textKey];
  }
  ctx.missing_information = [!ctx.problem_description && 'problem', !hasLocation(ctx) && 'location'].filter(Boolean);
  return result;
}

module.exports = { processTurn, summaryText, nextStep, hasLocation };
