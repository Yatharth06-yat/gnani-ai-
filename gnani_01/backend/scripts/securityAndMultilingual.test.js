/**
 * securityAndMultilingual.test.js
 * Comprehensive integration tests for Swachh Saathi Security, Ownership, and Multilingual Features.
 */

const path = require('path');
const B = path.resolve(__dirname, '..') + path.sep;
const store = { sessions: [], issues: [] };

const get = (o, p) => p.split('.').reduce((a, k) => (a == null ? a : a[k]), o);
const setp = (o, p, v) => {
  const ks = p.split('.');
  let c = o;
  ks.slice(0, -1).forEach(k => { c[k] = c[k] || {}; c = c[k]; });
  c[ks.at(-1)] = v;
};
const match = (d, q) => Object.entries(q).every(([k, v]) => {
  if (v && typeof v === 'object' && '$ne' in v) return get(d, k) !== v.$ne;
  return get(d, k) === v;
});

class Sess {
  constructor(d) {
    Object.assign(this, { status: 'active', turnCount: 0, messages: [], languageHistory: [], citizenId: null, ...d });
    this.complaintContext = { askedQuestions: [], ...d.complaintContext };
  }
  async save() {
    const idx = store.sessions.findIndex(s => s.sessionId === this.sessionId);
    if (idx >= 0) store.sessions[idx] = this;
    else store.sessions.push(this);
    return this;
  }
  toObject() { return JSON.parse(JSON.stringify(this)); }
  static async findOne(q) { return store.sessions.find(s => match(s, q)) || null; }
  static async findOneAndUpdate(q, u) {
    const s = store.sessions.find(x => match(x, q));
    if (!s) return null;
    Object.entries(u.$set || {}).forEach(([k, v]) => setp(s, k, v));
    return s;
  }
  static async updateOne(q, u) {
    const s = store.sessions.find(x => match(x, q));
    if (!s) return;
    Object.entries(u.$set || {}).forEach(([k, v]) => setp(s, k, v));
    if (u.$push) Object.entries(u.$push).forEach(([k, v]) => s[k].push(v));
    if (u.$inc) Object.entries(u.$inc).forEach(([k, v]) => s[k] += v);
  }
}

class Iss {
  constructor(d) { Object.assign(this, d); }
  async save() { store.issues.push(this); return this; }
  static async exists(q) { return store.issues.find(i => i.complaintId === q.complaintId) ? { _id: 1 } : null; }
  static async findOne(q) { return store.issues.find(i => i.complaintId === q.complaintId) || null; }
}

const inject = (rel, exp) => {
  const p = require.resolve(B + rel);
  require.cache[p] = { id: p, filename: p, loaded: true, exports: exp };
};

inject('models/ConversationSession.js', Sess);
inject('models/Issue.js', Iss);
inject('models/User.js', {});
inject('models/VoiceSession.js', {});

// Mock authMiddleware that distinguishes two test users
inject('middleware/authMiddleware.js', {
  authenticateUser: (req, res, next) => {
    const auth = req.headers.authorization;
    if (auth === 'Bearer token_user_1') {
      req.user = { _id: 'user_1', name: 'Citizen 1' };
      return next();
    }
    if (auth === 'Bearer token_user_2') {
      req.user = { _id: 'user_2', name: 'Citizen 2' };
      return next();
    }
    return res.status(401).json({ success: false, error: 'UNAUTHORIZED', message: 'Auth required' });
  },
  optionalAuthenticateUser: (req, res, next) => {
    const auth = req.headers.authorization;
    if (auth === 'Bearer token_user_1') req.user = { _id: 'user_1', name: 'Citizen 1' };
    else if (auth === 'Bearer token_user_2') req.user = { _id: 'user_2', name: 'Citizen 2' };
    else req.user = null;
    return next();
  }
});

inject('services/ai/aiService.js', {
  detectObjects: async () => ({
    garbage_detected: true,
    total_objects: 1,
    detections: [{ class_name: 'garbage_pile', confidence: 0.92, bbox: [10, 20, 100, 200] }]
  })
});

const express = require(B + 'node_modules/express');
const app = express();
app.use(express.json());
app.use('/api/gnani', require(B + 'routes/gnaniRoutes'));

const srv = app.listen(0, async () => {
  const base = `http://localhost:${srv.address().port}/api/gnani`;
  let pass = 0, fail = 0;
  const ok = (n, c, x = '') => {
    c ? pass++ : fail++;
    console.log(c ? 'PASS' : 'FAIL', n, c ? '' : x);
  };

  const J = async (u, m = 'GET', b, h = {}) => {
    const r = await fetch(base + u, {
      method: m,
      headers: { 'Content-Type': 'application/json', ...h },
      body: b ? JSON.stringify(b) : undefined
    });
    return { s: r.status, d: await r.json() };
  };

  console.log('\n--- SECURITY & OWNERSHIP TESTS ---');

  // Test 1: Invalid session ID format is rejected
  let r = await J('/session/invalid_id!@#', 'GET');
  ok('invalid session id format rejected (400)', r.s === 400);

  // Test 2: User 1 starts an authenticated session
  r = await J('/session', 'POST', { language: 'hi-IN' }, { Authorization: 'Bearer token_user_1' });
  const user1SessionId = r.d.sessionId;
  ok('User 1 can create bound session', r.s === 200 && user1SessionId && r.d.language === 'hi-IN');

  // Test 3: User 1 can access own session
  r = await J(`/session/${user1SessionId}`, 'GET', null, { Authorization: 'Bearer token_user_1' });
  ok('User 1 can read own session', r.s === 200 && r.d.sessionId === user1SessionId);

  // Test 4: User 2 CANNOT access User 1's session (Ownership check)
  r = await J(`/session/${user1SessionId}`, 'GET', null, { Authorization: 'Bearer token_user_2' });
  ok('User 2 blocked with 403 Forbidden from User 1 session', r.s === 403);

  // Test 5: Unauthenticated user CANNOT access User 1's bound session
  r = await J(`/session/${user1SessionId}`, 'GET');
  ok('Unauthenticated user blocked with 403 Forbidden from User 1 session', r.s === 403);

  // Test 6: User 2 CANNOT modify User 1's location
  r = await J(`/session/${user1SessionId}/location`, 'POST', { lat: 28.61, lng: 77.20 }, { Authorization: 'Bearer token_user_2' });
  ok('User 2 cannot inject location into User 1 session (403)', r.s === 403);

  // Test 7: User 2 CANNOT chat in User 1's session
  r = await J('/chat', 'POST', { sessionId: user1SessionId, message: 'Malicious message' }, { Authorization: 'Bearer token_user_2' });
  ok('User 2 cannot chat in User 1 session (403)', r.s === 403);

  // Test 8: User 2 CANNOT submit User 1's session
  r = await J(`/session/${user1SessionId}/submit`, 'POST', { confirmed: true }, { Authorization: 'Bearer token_user_2' });
  ok('User 2 cannot submit User 1 session (403)', r.s === 403);

  // Test 9: Anonymous session can be claimed by authenticating user
  r = await J('/session', 'POST', { language: 'en-IN' });
  const anonSessionId = r.d.sessionId;
  ok('Anonymous session created', r.s === 200 && anonSessionId);
  // Claim it with User 2 credentials
  r = await J(`/session/${anonSessionId}`, 'GET', null, { Authorization: 'Bearer token_user_2' });
  ok('User 2 claims anonymous session on first authenticated access', r.s === 200);
  // Now User 1 should be blocked from it
  r = await J(`/session/${anonSessionId}`, 'GET', null, { Authorization: 'Bearer token_user_1' });
  ok('Once claimed, User 1 is blocked with 403 from User 2 session', r.s === 403);

  console.log('\n--- MULTILINGUAL & LOCALIZATION TESTS ---');

  // Test 10: Localization endpoint returns complete UI strings for all 11 core languages
  const coreLangs = ['hi-IN', 'en-IN', 'hinglish', 'mr-IN', 'ta-IN', 'te-IN', 'bn-IN', 'gu-IN', 'kn-IN', 'ml-IN', 'pa-IN'];
  let allLangsPass = true;
  for (const lang of coreLangs) {
    const loc = await J(`/localization/${lang}`);
    if (loc.s !== 200 || !loc.d.ui || !loc.d.ui.selectLanguage || !loc.d.ui.startConversation || !loc.d.ui.confirmComplaint) {
      allLangsPass = false;
      break;
    }
  }
  ok('UI strings complete for all 11 core Indian languages', allLangsPass);

  // Test 11: Regional language fallback works cleanly (Bhojpuri -> Hindi UI)
  r = await J('/localization/bho-IN');
  ok('Bhojpuri cleanly falls back to Hindi UI strings', r.s === 200 && r.d.ui.startConversation === 'बातचीत शुरू करें');

  // Test 12: GET /languages provides UI strings for requested language
  r = await J('/languages?lang=ta-IN');
  ok('/languages provides Tamil UI strings when requested', r.s === 200 && r.d.ui && r.d.ui.changeLanguage === 'மொழியை மாற்று');

  console.log('\n--- VOICE PREVIEW TESTS ---');

  // Test 13: Voice preview endpoint rejects invalid language
  r = await J('/preview/xyz-invalid');
  ok('preview rejects invalid language with 400', r.s === 400);

  // Test 14: Voice preview streams audio sample when available
  const prevResp = await fetch(base + '/preview/hi-IN');
  ok('preview returns 200 and audio/wav for sample language', prevResp.status === 200 && prevResp.headers.get('content-type')?.includes('audio/wav'));

  console.log(`\n${pass} passed, ${fail} failed`);
  srv.close();
  process.exit(fail ? 1 : 0);
});
