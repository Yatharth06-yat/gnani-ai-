/**
 * conversationService.js — session helpers + reply generation for Swachh Saathi.
 * Dialogue logic lives in dialogueEngine.js; all user-facing text in localizedStrings.js.
 * The selected language is authoritative: it is never auto-switched from the user's speech.
 */
const ConversationSession = require('../../models/ConversationSession');
const { processTurn } = require('./dialogueEngine');
const { getStrings, getUIStrings } = require('./localizedStrings');
const { getLanguage, isKnown } = require('./languageRegistry');

async function maybeSummarizeOldMessages(session) {
  if (session.messages.length <= 20) return session;
  const old = session.messages.slice(0, session.messages.length - 12);
  session.contextSummary = ((session.contextSummary ? session.contextSummary + '\n' : '') + old.map(m => `${m.role}: ${m.content}`).join('\n')).slice(-3000);
  session.messages = session.messages.slice(-12);
  await session.save();
  return session;
}

async function generateReply(session) {
  const userMessages = session.messages.filter(m => m.role === 'user');
  if (userMessages.length === 0) return { reply: getStrings(session.language).greeting, updatedContext: session.complaintContext || {}, source: 'system' };
  session = await maybeSummarizeOldMessages(session);
  return processTurn(session, userMessages[userMessages.length - 1].content);
}

function newSessionId() { return `conv_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`; }

/** language is REQUIRED (chosen by the citizen). Throws on unknown codes. */
async function getOrCreateConversationSession(sessionId, citizenId, language) {
  if (!language || !isKnown(language)) { const e = new Error('A valid language must be selected first'); e.status = 400; throw e; }
  if (sessionId) {
    const existing = await ConversationSession.findOne({ sessionId, status: 'active' });
    if (existing) return existing;
  }
  const S = getStrings(language);
  const s = new ConversationSession({
    sessionId: sessionId || newSessionId(), citizenId: citizenId || null, language, languageHistory: [language],
    turnCount: 0, status: 'active',
    complaintContext: { stage: 'problem_discovery', currentQuestionKey: 'problem', askedQuestions: [], additionalRemarks: [] },
    messages: [{ role: 'assistant', content: S.greeting, timestamp: new Date(), messageId: `msg_${Date.now()}_welcome`, source: 'system' }]
  });
  await s.save();
  return s;
}

/** Switch STT/TTS/response language mid-complaint. Complaint context, GPS and evidence are untouched. */
async function switchSessionLanguage(session, language) {
  if (!isKnown(language)) { const e = new Error('Unknown language'); e.status = 400; throw e; }
  const S = getStrings(language);
  session.language = language;
  session.languageHistory = [...(session.languageHistory || []), language];
  // Re-ask the pending question in the new language so the citizen continues seamlessly.
  const ctx = session.complaintContext?.toObject ? session.complaintContext.toObject() : { ...(session.complaintContext || {}) };
  const keyToText = { problem: 'ask_problem', gps: 'ask_gps', location: 'ask_location', duration: 'ask_duration', severity: 'ask_severity', photo: 'ask_photo' };
  const { summaryText } = require('./dialogueEngine');
  let followUp = '';
  if (ctx.stage === 'summary_confirmation') { ctx.summary = summaryText(S, ctx); followUp = ctx.summary; }
  else if (ctx.stage !== 'submitted' && keyToText[ctx.currentQuestionKey]) followUp = S[keyToText[ctx.currentQuestionKey]];
  const reply = ctx.problem_description || ctx.stage === 'submitted' ? `${S.lang_changed}${followUp ? '\n\n' + followUp : ''}` : S.greeting;
  session.messages.push({ role: 'assistant', content: reply, timestamp: new Date(), messageId: `msg_${Date.now()}_lang`, source: 'system' });
  session.complaintContext = ctx;
  await session.save();
  return { reply, info: getLanguage(language) };
}

async function addUserMessage(session, content, source = 'text') {
  session.messages.push({ role: 'user', content, timestamp: new Date(), messageId: `msg_${Date.now()}_u`, source });
  session.turnCount += 1;
  await session.save();
  return session;
}

async function addAssistantMessage(session, content, updatedContext, source = 'system', audioDataUrl = null) {
  if (content) session.messages.push({ role: 'assistant', content, timestamp: new Date(), messageId: `msg_${Date.now()}_a`, source, audioDataUrl });
  if (updatedContext) session.complaintContext = updatedContext;
  await session.save();
  return session;
}

module.exports = { getStrings, getUIStrings, generateReply, getOrCreateConversationSession, switchSessionLanguage, addUserMessage, addAssistantMessage };
