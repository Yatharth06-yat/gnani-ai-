const crypto = require('crypto');
const VoiceSession = require('../../models/VoiceSession');

// In-memory fallback cache for sessions when DB is offline
const inMemorySessions = new Map();

function createSessionId() {
  return `VS-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`;
}

async function getOrCreateSession(sessionId, citizenId = null, language = 'hi-IN') {
  const sid = sessionId || createSessionId();

  try {
    let session = await VoiceSession.findOne({ sessionId: sid });
    if (!session) {
      session = new VoiceSession({
        sessionId: sid,
        citizenId: citizenId || null,
        language,
        confirmationStatus: 'in_progress'
      });
      await session.save();
    }
    return session;
  } catch (dbError) {
    console.warn('Database offline for VoiceSession, using memory cache:', dbError.message);
    if (!inMemorySessions.has(sid)) {
      inMemorySessions.set(sid, {
        sessionId: sid,
        citizenId,
        language,
        transcript: '',
        extractedInformation: {},
        clarificationHistory: [],
        confirmationStatus: 'in_progress',
        createdAt: new Date()
      });
    }
    return inMemorySessions.get(sid);
  }
}

async function updateSessionData(sessionId, updates = {}) {
  try {
    const session = await VoiceSession.findOneAndUpdate(
      { sessionId },
      { $set: updates },
      { new: true, upsert: true }
    );
    return session;
  } catch (dbError) {
    const existing = inMemorySessions.get(sessionId) || { sessionId };
    const merged = { ...existing, ...updates, updatedAt: new Date() };
    inMemorySessions.set(sessionId, merged);
    return merged;
  }
}

async function appendClarificationTurn(sessionId, question, answer) {
  const turn = { question, answer, timestamp: new Date() };
  try {
    const session = await VoiceSession.findOneAndUpdate(
      { sessionId },
      { $push: { clarificationHistory: turn } },
      { new: true }
    );
    return session;
  } catch (dbError) {
    const s = inMemorySessions.get(sessionId);
    if (s) {
      s.clarificationHistory = s.clarificationHistory || [];
      s.clarificationHistory.push(turn);
    }
    return s;
  }
}

module.exports = {
  createSessionId,
  getOrCreateSession,
  updateSessionData,
  appendClarificationTurn
};

