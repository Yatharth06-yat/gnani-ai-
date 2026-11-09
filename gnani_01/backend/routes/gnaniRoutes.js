const express = require('express');
const multer = require('multer');
const mongoose = require('mongoose');
const path = require('path');
const fs = require('fs');
const gnaniConfig = require('../services/gnani/gnaniConfig');
const { transcribeAudio } = require('../services/gnani/prismaService');
const { analyzeComplaintWithEvon } = require('../services/gnani/evonService');
const { synthesizeSpeech } = require('../services/gnani/timbreService');
const {
  getOrCreateSession,
  updateSessionData,
  appendClarificationTurn
} = require('../services/gnani/gnaniSessionService');
const {
  getStrings,
  getUIStrings
} = require('../services/gnani/localizedStrings');
const {
  generateReply,
  getOrCreateConversationSession,
  switchSessionLanguage,
  addUserMessage,
  addAssistantMessage
} = require('../services/gnani/conversationService');
const { nextStep, summaryText } = require('../services/gnani/dialogueEngine');
const { listLanguages, getLanguage, isKnown, STATE_LANGUAGES, TEXT_FALLBACK } = require('../services/gnani/languageRegistry');
const { authenticateUser, optionalAuthenticateUser: rawOptionalAuth } = require('../middleware/authMiddleware');
const optionalAuthenticateUser = rawOptionalAuth || ((req, res, next) => next());
const ConversationSession = require('../models/ConversationSession');
const Issue = require('../models/Issue');
const User = require('../models/User');
const aiServiceClient = require('../services/ai/aiService');

const router = express.Router();
const AUDIO_MIMES = ['audio/wav', 'audio/x-wav', 'audio/wave', 'audio/vnd.wave'];
const IMAGE_MIMES = ['image/jpeg', 'image/png', 'image/webp'];

// Strict upload validation: audio must be WAV (client converts), images must be jpeg/png/webp.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024, files: 1 },
  fileFilter: (req, file, cb) => {
    const ok = file.fieldname === 'audio' ? AUDIO_MIMES.includes(file.mimetype) : file.fieldname === 'image' ? IMAGE_MIMES.includes(file.mimetype) : false;
    cb(ok ? null : Object.assign(new Error(`Unsupported ${file.fieldname} type: ${file.mimetype}`), { status: 415 }), ok);
  }
});
const isRealImage = (b) => b && b.length > 12 && ((b[0] === 0xFF && b[1] === 0xD8) || (b.toString('ascii', 1, 4) === 'PNG') || (b.toString('ascii', 0, 4) === 'RIFF' && b.toString('ascii', 8, 12) === 'WEBP'));

// ── Rate Limiting (Protects API quotas and prevents abuse) ──
const rateLimitMap = new Map();
function apiRateLimit(maxRequests = 60, windowMs = 60000) {
  return (req, res, next) => {
    if (process.env.NODE_ENV === 'test') return next();
    const key = req.ip || req.headers['x-forwarded-for'] || 'client';
    const now = Date.now();
    const entry = rateLimitMap.get(key) || { count: 0, resetAt: now + windowMs };
    if (now > entry.resetAt) {
      entry.count = 0;
      entry.resetAt = now + windowMs;
    }
    entry.count++;
    rateLimitMap.set(key, entry);
    if (entry.count > maxRequests) {
      return res.status(429).json({
        success: false,
        error: 'RATE_LIMIT_EXCEEDED',
        message: 'Too many requests. Please slow down to preserve service availability.'
      });
    }
    next();
  };
}

// Session ID regex to prevent injection or enumeration
const SESSION_ID_REGEX = /^[a-zA-Z0-9_\-]{8,64}$/;
function isValidSessionId(id) {
  return typeof id === 'string' && SESSION_ID_REGEX.test(id);
}

// ══════════════════════════════════════════════════════════════
// PRESERVED ROUTES (Gnani Prisma, Evon, Timbre primitives)
// ══════════════════════════════════════════════════════════════

router.post('/transcribe', optionalAuthenticateUser, apiRateLimit(40), upload.single('audio'), async (req, res) => {
  try {
    const audioBuffer = req.file?.buffer;
    if (!audioBuffer) {
      return res.status(400).json({ success: false, message: 'Audio file is required' });
    }

    const language = req.body.language;
    if (!isKnown(language)) return res.status(400).json({ success: false, message: 'A valid language is required' });
    const correlationId = req.headers['x-correlation-id'] || `REQ-${Date.now()}`;

    const result = await transcribeAudio(
      audioBuffer,
      'audio/wav',
      language,
      correlationId
    );

    res.json(result);
  } catch (error) {
    console.error('❌ /api/gnani/transcribe error:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/analyze', optionalAuthenticateUser, async (req, res) => {
  try {
    const { transcript, citizenText, visualEvidence, coordinates, sessionId } = req.body;
    const correlationId = req.headers['x-correlation-id'] || `REQ-${Date.now()}`;

    const result = await analyzeComplaintWithEvon({
      transcript,
      citizenText,
      visualEvidence,
      coordinates,
      language: req.body.language,
      correlationId
    });

    if (sessionId && result.success && result.data) {
      await updateSessionData(sessionId, {
        transcript: transcript || citizenText,
        extractedInformation: result.data,
        confirmationStatus: result.data.clarification_required ? 'awaiting_clarification' : 'in_progress'
      });
    }

    res.json(result);
  } catch (error) {
    console.error('❌ /api/gnani/analyze error:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/synthesize', optionalAuthenticateUser, apiRateLimit(40), async (req, res) => {
  try {
    const { text, language, voice = 'female' } = req.body;
    if (!isKnown(language)) return res.status(400).json({ success: false, message: 'A valid language is required' });
    const correlationId = req.headers['x-correlation-id'] || `REQ-${Date.now()}`;

    const result = await synthesizeSpeech(text, language, voice, correlationId);
    res.json(result);
  } catch (error) {
    console.error('❌ /api/gnani/synthesize error:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/session/start', optionalAuthenticateUser, async (req, res) => {
  try {
    const { sessionId, language } = req.body;
    if (!isKnown(language)) return res.status(400).json({ success: false, message: 'A valid language is required' });
    const citizenId = req.user?._id || null;
    const session = await getOrCreateSession(sessionId, citizenId, language);
    res.json({ success: true, session });
  } catch (error) {
    console.error('❌ /api/gnani/session/start error:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/session/clarify', optionalAuthenticateUser, async (req, res) => {
  try {
    const { sessionId, question, answer } = req.body;
    if (!sessionId || !question || !answer) {
      return res.status(400).json({ success: false, message: 'sessionId, question, and answer are required' });
    }
    const session = await appendClarificationTurn(sessionId, question, answer);
    res.json({ success: true, session });
  } catch (error) {
    console.error('❌ /api/gnani/session/clarify error:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
});

// ══════════════════════════════════════════════════════════════
// SWACHH SAATHI — language catalogue, sessions, location, image, submit, chat
// ══════════════════════════════════════════════════════════════

const ctxOf = (session) => (session.complaintContext?.toObject ? session.complaintContext.toObject() : { ...(session.complaintContext || {}) });

/** Real TTS only. Returns { audioDataUrl|null, tts:{ok,error?,message?} } — never pretends audio exists. */
async function speak(text, lang, id) {
  if (!text) return { audioDataUrl: null, tts: { ok: false, error: 'NO_TEXT' } };
  try {
    const r = await synthesizeSpeech(text, lang, 'female', id);
    if (r.success && r.audioDataUrl) return { audioDataUrl: r.audioDataUrl, tts: { ok: true, voice: r.voice } };
    return { audioDataUrl: null, tts: { ok: false, error: r.error, message: r.message } };
  } catch (e) {
    return { audioDataUrl: null, tts: { ok: false, error: 'TTS_FAILED' } };
  }
}

const sessionView = (session) => ({
  sessionId: session.sessionId, messages: session.messages, turnCount: session.turnCount,
  complaintContext: session.complaintContext, status: session.status, language: session.language,
  languageInfo: getLanguage(session.language)
});

/** Enforces session ownership & valid format */
async function loadActive(req, res) {
  const sessionId = req.params.id;
  if (!isValidSessionId(sessionId)) {
    res.status(400).json({ success: false, message: 'Invalid session ID format' });
    return null;
  }
  const session = await ConversationSession.findOne({ sessionId });
  if (!session) {
    res.status(404).json({ success: false, message: 'Session not found' });
    return null;
  }
  // Enforce session ownership
  if (session.citizenId) {
    const requestingUserId = req.user?._id?.toString() || req.user?.id?.toString();
    if (!requestingUserId || requestingUserId !== session.citizenId.toString()) {
      res.status(403).json({ success: false, error: 'FORBIDDEN', message: 'Access denied: You do not own this session.' });
      return null;
    }
  } else if (req.user?._id) {
    // Associate anonymous session with authenticated user
    session.citizenId = req.user._id;
  }
  return session;
}

// Language catalogue for the selector (registry + state recommendations + UI strings)
router.get('/languages', (req, res) => {
  const lang = req.query.lang || 'en-IN';
  res.json({
    success: true,
    languages: listLanguages(),
    states: STATE_LANGUAGES,
    textFallback: TEXT_FALLBACK,
    ui: getUIStrings(lang)
  });
});

// Central UI localization strings endpoint
router.get('/localization/:code', (req, res) => {
  const code = req.params.code;
  res.json({
    success: true,
    language: code,
    ui: getUIStrings(code)
  });
});

// Voice preview endpoint for verified languages
router.get('/preview/:code', async (req, res) => {
  const code = req.params.code;
  if (!isKnown(code)) return res.status(400).json({ success: false, message: 'Unknown language code' });
  const probeDir = path.join(__dirname, '../scripts/probe_output');
  const sampleDir = path.join(__dirname, '../../test_audio_samples');
  
  // 1. Look for probed WAV sample
  if (fs.existsSync(probeDir)) {
    const probeFile = fs.readdirSync(probeDir).find(f => f.startsWith(`${code}_`) && f.endsWith('.wav'));
    if (probeFile) {
      res.setHeader('Content-Type', 'audio/wav');
      return fs.createReadStream(path.join(probeDir, probeFile)).pipe(res);
    }
  }

  // 2. Look for real recorded sample
  const prefix = code.split('-')[0];
  if (fs.existsSync(sampleDir)) {
    const sampleFile = fs.readdirSync(sampleDir).find(f => f.startsWith(`${prefix}_sample`) && f.endsWith('.wav'));
    if (sampleFile) {
      res.setHeader('Content-Type', 'audio/wav');
      return fs.createReadStream(path.join(sampleDir, sampleFile)).pipe(res);
    }
  }

  // 3. Dynamic synthesis if live API configured
  const langInfo = getLanguage(code);
  if (langInfo?.ttsAvailable && gnaniConfig.isConfigured()) {
    try {
      const strings = getStrings(code);
      const audio = await synthesizeSpeech(strings.greeting, code, 'female', `PREVIEW-${Date.now()}`);
      if (audio.success && audio.audioDataUrl) {
        const base64Data = audio.audioDataUrl.split(',')[1];
        const buf = Buffer.from(base64Data, 'base64');
        res.setHeader('Content-Type', 'audio/wav');
        return res.send(buf);
      }
    } catch (_) {}
  }

  return res.status(404).json({ success: false, message: 'No voice preview available for this language.' });
});

// Start a session ONLY after the citizen chose a language. Plays the real greeting via Timbre.
router.post('/session', optionalAuthenticateUser, apiRateLimit(35), async (req, res) => {
  try {
    const { sessionId, language } = req.body;
    if (!isKnown(language)) return res.status(400).json({ success: false, message: 'Please choose a language first.' });
    if (sessionId && !isValidSessionId(sessionId)) return res.status(400).json({ success: false, message: 'Invalid session ID format' });

    const citizenId = req.user?._id || null;
    const session = await getOrCreateConversationSession(sessionId, citizenId, language);
    if (session.citizenId && citizenId && session.citizenId.toString() !== citizenId.toString()) {
      return res.status(403).json({ success: false, error: 'FORBIDDEN', message: 'Access denied: You do not own this session.' });
    }
    if (!session.citizenId && citizenId) {
      session.citizenId = citizenId;
      await session.save();
    }
    if (session.language !== language) { await switchSessionLanguage(session, language); }
    const greeting = [...session.messages].reverse().find(m => m.role === 'assistant');
    let audio = { audioDataUrl: null, tts: { ok: false, error: 'SKIPPED' } };
    if (session.turnCount === 0 && greeting) audio = await speak(greeting.content, session.language, `WELCOME-${Date.now()}`);
    res.json({ success: true, ...sessionView(session), welcomeAudio: audio.audioDataUrl, tts: audio.tts, greetingText: greeting?.content });
  } catch (error) {
    console.error('❌ POST /session error:', error.message);
    res.status(error.status || 500).json({ success: false, message: error.message });
  }
});

router.get('/session/:id', optionalAuthenticateUser, async (req, res) => {
  try { const s = await loadActive(req, res); if (s) res.json({ success: true, ...sessionView(s) }); }
  catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// Change Language: keeps complaint context, GPS and evidence; only switches STT/TTS/response language.
router.post('/session/:id/language', optionalAuthenticateUser, async (req, res) => {
  try {
    const session = await loadActive(req, res); if (!session) return;
    if (session.status !== 'active') return res.status(409).json({ success: false, message: 'Session already completed' });
    if (!isKnown(req.body.language)) return res.status(400).json({ success: false, message: 'Unknown language' });
    const { reply } = await switchSessionLanguage(session, req.body.language);
    const audio = await speak(reply, session.language, `LANG-${Date.now()}`);
    res.json({ success: true, ...sessionView(session), reply, audioDataUrl: audio.audioDataUrl, tts: audio.tts });
  } catch (e) { res.status(e.status || 500).json({ success: false, message: e.message }); }
});

// Start over (keeps selected language)
router.post('/session/:id/reset', optionalAuthenticateUser, async (req, res) => {
  try {
    const session = await loadActive(req, res); if (!session) return;
    const S = getStrings(session.language);
    session.messages = [{ role: 'assistant', content: S.greeting, timestamp: new Date(), messageId: `msg_${Date.now()}_reset`, source: 'system' }];
    session.turnCount = 0; session.status = 'active';
    session.complaintContext = { stage: 'problem_discovery', currentQuestionKey: 'problem', askedQuestions: [] };
    await session.save();
    res.json({ success: true, ...sessionView(session) });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

router.delete('/session/:id', optionalAuthenticateUser, async (req, res) => {
  try { const s = await loadActive(req, res); if (!s) return; s.status = 'completed'; await s.save(); res.json({ success: true }); }
  catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// Location: only what the citizen explicitly provided/consented to. Nothing is ever defaulted.
router.post('/session/:id/location', optionalAuthenticateUser, async (req, res) => {
  try {
    const session = await loadActive(req, res); if (!session) return;
    const { lat, lng, address, landmark, locationSource, permissionStatus } = req.body;
    const ctx = ctxOf(session);
    const S = getStrings(session.language);
    const latN = Number(lat), lngN = Number(lng);
    const hasCoords = lat !== undefined && lat !== null && lng !== undefined && lng !== null && Number.isFinite(latN) && Number.isFinite(lngN)
      && latN >= 6 && latN <= 38 && lngN >= 68 && lngN <= 98; // India bounding box sanity check
    if (permissionStatus) ctx.locationPermissionStatus = ['granted', 'denied', 'asked', 'not_at_location'].includes(permissionStatus) ? permissionStatus : ctx.locationPermissionStatus;
    if (hasCoords) {
      ctx.latitude = latN; ctx.longitude = lngN;
      ctx.locationSource = ['gps', 'map_pin'].includes(locationSource) ? locationSource : 'map_pin';
      ctx.locationVerified = ctx.locationSource === 'gps';
    } else if (lat !== undefined && lat !== null && lat !== '') {
      return res.status(400).json({ success: false, message: 'Coordinates are outside India or invalid' });
    }
    if (typeof address === 'string' && address.trim()) { ctx.confirmedAddress = address.trim().slice(0, 300); if (!hasCoords && !ctx.latitude) { ctx.locationSource = 'manual'; ctx.locationVerified = false; } }
    if (typeof landmark === 'string' && landmark.trim()) ctx.landmark = landmark.trim().slice(0, 200);
    if (ctx.currentQuestionKey === 'gps' || ctx.currentQuestionKey === 'location' || ctx.currentQuestionKey === 'pin') {
      if (!ctx.askedQuestions.includes(ctx.currentQuestionKey) && (hasCoords || ctx.locationPermissionStatus === 'denied' || address)) ctx.askedQuestions.push(ctx.currentQuestionKey);
    }
    let reply = '';
    if (ctx.locationPermissionStatus === 'denied' && !hasCoords && !ctx.confirmedAddress) reply = S.gps_denied;
    const step = nextStep(ctx);
    if (!reply) {
      if (step) { ctx.stage = step.stage; ctx.currentQuestionKey = step.key; reply = S[step.textKey]; }
      else { ctx.stage = 'summary_confirmation'; ctx.currentQuestionKey = 'summary_confirmation'; ctx.summary = summaryText(S, ctx); reply = ctx.summary; }
    }
    session.complaintContext = ctx;
    session.messages.push({ role: 'assistant', content: reply, timestamp: new Date(), messageId: `msg_${Date.now()}_loc`, source: 'system' });
    await session.save();
    const audio = await speak(reply, session.language, `LOC-${Date.now()}`);
    res.json({ success: true, reply, audioDataUrl: audio.audioDataUrl, tts: audio.tts, ...sessionView(session) });
  } catch (e) { console.error('❌ location:', e.message); res.status(500).json({ success: false, message: e.message }); }
});

// Optional photo evidence: real YOLO11n result via the AI service. Failure is reported, never faked.
router.post('/session/:id/image', optionalAuthenticateUser, upload.single('image'), async (req, res) => {
  try {
    const session = await loadActive(req, res); if (!session) return;
    const buf = req.file?.buffer;
    if (!buf || !isRealImage(buf)) return res.status(400).json({ success: false, message: 'A valid JPEG, PNG or WebP image is required' });
    const ctx = ctxOf(session); const S = getStrings(session.language);
    let yolo;
    try { yolo = await aiServiceClient.detectObjects(buf, null, 0.25); }
    catch (e) { return res.status(502).json({ success: false, error: 'AI_SERVICE_UNAVAILABLE', message: 'Photo analysis is unavailable right now. You can skip the photo.' }); }
    const detections = yolo?.detections || [];
    const found = Boolean(yolo?.garbage_detected && (yolo.total_objects > 0 || detections.length > 0));
    if (found) {
      Object.assign(ctx, { imageVerificationStatus: 'verified', yoloDetections: detections, annotatedImageUrl: yolo.annotated_image_base64 || '', imageUrl: `data:${req.file.mimetype};base64,${buf.toString('base64')}` });
    } else { ctx.imageVerificationStatus = 'rejected'; }
    if (ctx.currentQuestionKey === 'photo' && !ctx.askedQuestions.includes('photo')) ctx.askedQuestions.push('photo');
    let reply = found ? S.image_verified : S.image_rejected;
    if (found) {
      const step = nextStep(ctx);
      if (step) { ctx.stage = step.stage; ctx.currentQuestionKey = step.key; reply += ' ' + S[step.textKey]; }
      else { ctx.stage = 'summary_confirmation'; ctx.currentQuestionKey = 'summary_confirmation'; ctx.summary = summaryText(S, ctx); reply += '\n\n' + ctx.summary; }
    }
    session.complaintContext = ctx;
    session.messages.push({ role: 'assistant', content: reply, timestamp: new Date(), messageId: `msg_${Date.now()}_img`, source: 'yolo11n' });
    await session.save();
    const audio = await speak(reply.split('\n\n')[0], session.language, `IMG-${Date.now()}`);
    res.json({ success: true, garbage_detected: found, yoloResult: yolo, reply, audioDataUrl: audio.audioDataUrl, tts: audio.tts, ...sessionView(session) });
  } catch (e) { console.error('❌ image:', e.message); res.status(e.status || 500).json({ success: false, message: e.message }); }
});

// Skip the optional photo
router.post('/session/:id/skip-photo', optionalAuthenticateUser, async (req, res) => {
  try {
    const session = await loadActive(req, res); if (!session) return;
    const ctx = ctxOf(session); const S = getStrings(session.language);
    ctx.photoSkipped = true; if (!ctx.askedQuestions.includes('photo')) ctx.askedQuestions.push('photo');
    const step = nextStep(ctx); let reply;
    if (step) { ctx.stage = step.stage; ctx.currentQuestionKey = step.key; reply = S[step.textKey]; }
    else { ctx.stage = 'summary_confirmation'; ctx.currentQuestionKey = 'summary_confirmation'; ctx.summary = summaryText(S, ctx); reply = ctx.summary; }
    session.complaintContext = ctx;
    session.messages.push({ role: 'assistant', content: reply, timestamp: new Date(), messageId: `msg_${Date.now()}_skip`, source: 'system' });
    await session.save();
    const audio = await speak(reply.split('\n\n')[0], session.language, `SKIP-${Date.now()}`);
    res.json({ success: true, reply, audioDataUrl: audio.audioDataUrl, tts: audio.tts, ...sessionView(session) });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// ── Real complaint registration ─────────────────────────────────
async function newComplaintId() {
  const year = new Date().getFullYear();
  for (let i = 0; i < 12; i++) {
    const id = `SWM-${year}-${Math.floor(1000 + Math.random() * 9000)}`;
    if (!(await Issue.exists({ complaintId: id }))) return id;
  }
  return `SWM-${year}-${Date.now().toString().slice(-6)}`;
}

router.post('/session/:id/submit', authenticateUser, async (req, res) => {
  const sessionId = req.params.id;
  if (!isValidSessionId(sessionId)) return res.status(400).json({ success: false, message: 'Invalid session ID format' });

  let locked = null;
  try {
    const peek = await ConversationSession.findOne({ sessionId });
    if (!peek) return res.status(404).json({ success: false, message: 'Session not found' });
    
    // Check ownership
    if (peek.citizenId && peek.citizenId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, error: 'FORBIDDEN', message: 'You cannot submit another user\'s session.' });
    }

    const S = getStrings(peek.language);
    const prev = peek.complaintContext || {};

    // Idempotent: a session that already produced a complaint returns the SAME real complaint.
    if (prev.complaintId) {
      const existing = await Issue.findOne({ complaintId: prev.complaintId });
      return res.json({ success: true, alreadySubmitted: true, complaintId: prev.complaintId, issue: existing, messages: peek.messages, complaintContext: peek.complaintContext });
    }
    if (prev.stage !== 'summary_confirmation' || !(req.body?.confirmed === true || prev.is_confirmed_by_user)) {
      return res.status(409).json({ success: false, error: 'NOT_CONFIRMED', message: 'The citizen has not confirmed the complaint yet.' });
    }
    if (prev.latitude == null || prev.longitude == null) {
      return res.status(422).json({ success: false, error: 'LOCATION_REQUIRED', message: S.gps_denied });
    }

    // Atomic lock against double-tap / parallel submissions
    locked = await ConversationSession.findOneAndUpdate(
      { sessionId, status: 'active', 'complaintContext.submitting': { $ne: true } },
      { $set: { 'complaintContext.submitting': true } }, { new: true });
    if (!locked) return res.status(409).json({ success: false, error: 'SUBMISSION_IN_PROGRESS', message: 'Submission already in progress.' });

    const ctx = ctxOf(locked); const lang = locked.language;
    const complaintId = await newComplaintId();
    const detections = (ctx.yoloDetections || []).map(d => ({ class: d.class_name || d.class, confidence: d.confidence, bbox: d.bbox }));
    const sev = { low: 'Low', medium: 'Medium', high: 'High', critical: 'Critical' }[String(ctx.severity || '').toLowerCase()] || 'Needs Review';
    const category = ctx.waste_category === 'sanitation_overflow' ? 'Sanitation' : 'Garbage';
    const place = ctx.confirmedAddress || ctx.landmark || `${ctx.latitude.toFixed(5)}, ${ctx.longitude.toFixed(5)}`;
    const description = [ctx.problem_description, ctx.duration && `Duration: ${ctx.duration}`, ctx.severity && `Severity: ${ctx.severity}`, ctx.landmark && `Landmark: ${ctx.landmark}`, `Location ${ctx.locationVerified ? 'verified by device GPS' : 'selected by citizen (unverified)'}`].filter(Boolean).join('. ');

    const issue = await new Issue({
      complaintId,
      title: `${(ctx.waste_category || 'waste').replace(/_/g, ' ')} reported near ${place}`.slice(0, 100),
      description: description.slice(0, 1000),
      category, status: 'Reported', priority: sev,
      location: { type: 'Point', coordinates: [ctx.longitude, ctx.latitude], address: place },
      imageUrl: ctx.imageUrl || '',
      voiceTranscript: locked.messages.filter(m => m.role === 'user').map(m => m.content).join(' | ').slice(0, 4000),
      voiceSessionId: locked.sessionId,
      aiAnalysis: {
        yoloDetections: detections, totalObjects: detections.length,
        evidenceSummary: [ctx.imageVerificationStatus === 'verified' ? `YOLO11n detected ${detections.length} object(s) in the citizen photo.` : 'No photo evidence attached.'],
        uncertainties: ctx.imageVerificationStatus === 'verified' ? [] : ['No verified photo'],
        requiresHumanReview: ctx.imageVerificationStatus !== 'verified', analyzedAt: new Date()
      },
      reportedBy: req.user._id
    }).save();

    const text = S.success_registration(complaintId);
    await ConversationSession.updateOne({ sessionId }, {
      $set: { status: 'completed', 'complaintContext.stage': 'submitted', 'complaintContext.complaintId': complaintId, 'complaintContext.is_complete': true, 'complaintContext.submitting': false, citizenId: req.user._id },
      $push: { messages: { role: 'assistant', content: text, timestamp: new Date(), messageId: `msg_${Date.now()}_done`, source: 'system' } }, $inc: { turnCount: 1 }
    });
    const done = await ConversationSession.findOne({ sessionId });
    const audio = await speak(text, lang, `REG-${complaintId}`);
    res.json({ success: true, complaintId, issue, successSpeech: { text, audioDataUrl: audio.audioDataUrl, tts: audio.tts }, messages: done.messages, complaintContext: done.complaintContext });
  } catch (error) {
    console.error('❌ submit:', error.message);
    if (locked) await ConversationSession.updateOne({ sessionId }, { $set: { 'complaintContext.submitting': false } }).catch(() => {});
    const S = getStrings(locked?.language || 'en-IN');
    res.status(500).json({ success: false, error: 'SUBMIT_FAILED', message: S.submit_failed });
  }
});

// ── Chat turn ──────────────────────────────────────────────────
router.post('/chat', optionalAuthenticateUser, apiRateLimit(60), upload.single('audio'), async (req, res) => {
  try {
    const { sessionId } = req.body;
    const voiceEnabled = String(req.body.voiceEnabled) === 'true';
    if (!sessionId || !isValidSessionId(sessionId)) return res.status(400).json({ success: false, message: 'Valid sessionId is required' });
    
    let session = await ConversationSession.findOne({ sessionId, status: 'active' });
    if (!session) return res.status(404).json({ success: false, message: 'Session not found or completed.' });
    
    // Check ownership
    if (session.citizenId) {
      const uid = req.user?._id?.toString() || req.user?.id?.toString();
      if (!uid || uid !== session.citizenId.toString()) {
        return res.status(403).json({ success: false, error: 'FORBIDDEN', message: 'Access denied: You do not own this session.' });
      }
    } else if (req.user?._id) {
      session.citizenId = req.user._id;
    }

    const S = getStrings(session.language);

    let text = typeof req.body.message === 'string' ? req.body.message.trim() : '';
    let transcript = null;
    if (!text && req.file?.buffer) {
      const stt = await transcribeAudio(req.file.buffer, 'audio/wav', session.language, `CHAT-${Date.now()}`);
      if (!stt.success || !stt.transcript?.trim()) return res.status(422).json({ success: false, error: stt.error || 'STT_FAILED', message: S.did_not_catch, canFallbackToText: true });
      transcript = text = stt.transcript.trim();
    }
    if (!text) return res.status(400).json({ success: false, message: 'No message provided.' });
    if (text.length > 1000) text = text.slice(0, 1000);

    session = await addUserMessage(session, text, transcript ? 'voice' : 'text');
    const out = await generateReply(session);
    session.complaintContext = out.updatedContext;
    if (out.reply) session = await addAssistantMessage(session, out.reply, out.updatedContext, out.source);
    else { await session.save(); }
    let audio = { audioDataUrl: null, tts: { ok: false, error: 'DISABLED' } };
    if (voiceEnabled && out.reply) audio = await speak(out.reply, session.language, `CHAT-${Date.now()}`);
    res.json({ success: true, reply: out.reply, transcript, ...sessionView(session), source: out.source, action: out.action, readyToSubmit: Boolean(out.readyToSubmit), audioDataUrl: audio.audioDataUrl, tts: audio.tts });
  } catch (error) {
    console.error('❌ chat:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Multer / validation errors -> clean JSON
router.use((err, req, res, next) => {
  if (err) return res.status(err.status || (err.code === 'LIMIT_FILE_SIZE' ? 413 : 400)).json({ success: false, message: err.message });
  next();
});

module.exports = router;
