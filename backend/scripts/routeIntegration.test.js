process.env.GNANI_API_KEY = ''; // no live Gnani in sandbox -> exercises honest-failure paths
const path = require('path'); const B = '/home/claude/proj/gnani_01/backend/';
const store = { sessions: [], issues: [] };
const get = (o, p) => p.split('.').reduce((a, k) => (a == null ? a : a[k]), o);
const setp = (o, p, v) => { const ks = p.split('.'); let c = o; ks.slice(0, -1).forEach(k => { c[k] = c[k] || {}; c = c[k]; }); c[ks.at(-1)] = v; };
const match = (d, q) => Object.entries(q).every(([k, v]) => v && typeof v === 'object' && '$ne' in v ? get(d, k) !== v.$ne : get(d, k) === v);
class Sess { constructor(d) { Object.assign(this, { status: 'active', turnCount: 0, messages: [], languageHistory: [], ...d }); this.complaintContext = { askedQuestions: [], ...d.complaintContext }; }
  async save() { if (!store.sessions.includes(this)) store.sessions.push(this); return this; } toObject() { return JSON.parse(JSON.stringify(this)); }
  static async findOne(q) { return store.sessions.find(s => match(s, q)) || null; }
  static async findOneAndUpdate(q, u) { const s = store.sessions.find(x => match(x, q)); if (!s) return null; Object.entries(u.$set || {}).forEach(([k, v]) => setp(s, k, v)); return s; }
  static async updateOne(q, u) { const s = store.sessions.find(x => match(x, q)); if (!s) return; Object.entries(u.$set || {}).forEach(([k, v]) => setp(s, k, v)); (u.$push && Object.entries(u.$push).forEach(([k, v]) => s[k].push(v))); (u.$inc && Object.entries(u.$inc).forEach(([k, v]) => s[k] += v)); } }
class Iss { constructor(d) { Object.assign(this, d); } async save() { store.issues.push(this); return this; } static async exists(q) { return store.issues.find(i => i.complaintId === q.complaintId) ? { _id: 1 } : null; } static async findOne(q) { return store.issues.find(i => i.complaintId === q.complaintId) || null; } }
const inject = (rel, exp) => { const p = require.resolve(B + rel); require.cache[p] = { id: p, filename: p, loaded: true, exports: exp }; };
inject('models/ConversationSession.js', Sess); inject('models/Issue.js', Iss); inject('models/User.js', {});
inject('models/VoiceSession.js', {});
inject('middleware/authMiddleware.js', { authenticateUser: (req, res, next) => { if (req.headers.authorization === 'Bearer ok') { req.user = { _id: 'u1' }; return next(); } res.status(401).json({ success: false, message: 'auth' }); } });
inject('services/ai/aiService.js', { detectObjects: async () => ({ garbage_detected: true, total_objects: 2, detections: [{ class_name: 'plastic', confidence: 0.9, bbox: [1, 2, 3, 4] }] }) });
const express = require(B + 'node_modules/express');
const app = express(); app.use(express.json()); app.use('/api/gnani', require(B + 'routes/gnaniRoutes'));
const srv = app.listen(0, async () => {
  const base = `http://localhost:${srv.address().port}/api/gnani`; let pass = 0, fail = 0;
  const ok = (n, c, x = '') => { c ? pass++ : fail++; console.log(c ? 'PASS' : 'FAIL', n, c ? '' : x); };
  const J = async (u, m = 'GET', b, h = {}) => { const r = await fetch(base + u, { method: m, headers: { 'Content-Type': 'application/json', ...h }, body: b ? JSON.stringify(b) : undefined }); return { s: r.status, d: await r.json() }; };
  let r = await J('/languages'); ok('languages endpoint lists registry', r.d.languages.length >= 36 && r.d.states['Madhya Pradesh'].includes('mup-IN'));
  const sched = r.d.languages.filter(l => l.scheduled); ok('exactly 22 scheduled languages', sched.length === 22, sched.length);
  ok('regional langs not marked scheduled', r.d.languages.filter(l => ['bho-IN', 'mup-IN', 'tcy-IN', 'trp-IN'].includes(l.code)).every(l => !l.scheduled));
  ok('no auto language: session without language rejected', (await J('/session', 'POST', {})).s === 400);
  ok('unknown language rejected', (await J('/session', 'POST', { language: 'xx' })).s === 400);
  r = await J('/session', 'POST', { language: 'ta-IN' }); const sid = r.d.sessionId;
  ok('tamil session greets in Tamil', r.d.greetingText.startsWith('வணக்கம்'));
  ok('TTS failure reported honestly (no fake audio)', r.d.welcomeAudio === null && r.d.tts.ok === false, JSON.stringify(r.d.tts));
  r = await J(`/session/${sid}/language`, 'POST', { language: 'hi-IN' }); ok('language switch ok + Hindi', r.d.success && r.d.language === 'hi-IN');
  r = await J('/chat', 'POST', { sessionId: sid, message: 'सड़क पर कचरा पड़ा है, 3 दिन से, बाज़ार के पास' }); ok('chat turn asks GPS consent in Hindi', r.d.complaintContext.stage === 'location_permission' && /लोकेशन/.test(r.d.reply), r.d.reply);
  r = await J(`/session/${sid}/location`, 'POST', { lat: 28.6139, lng: 77.209, locationSource: 'gps', permissionStatus: 'granted' }); ok('GPS stored only when sent', r.d.complaintContext.latitude === 28.6139 && r.d.complaintContext.locationVerified === true);
  r = await J(`/session/${sid}/location`, 'POST', { lat: 51.5, lng: -0.12 }); ok('non-India coords rejected', r.s === 400);
  let s = store.sessions[0]; ok('context preserved across language switch', s.complaintContext.problem_description.includes('कचरा'));
  r = await J(`/session/${sid}/language`, 'POST', { language: 'en-IN' }); ok('switch back keeps GPS + problem', r.d.complaintContext.latitude === 28.6139 && r.d.complaintContext.problem_description);
  r = await J(`/session/${sid}/submit`, 'POST', { confirmed: true }); ok('submit requires login', r.s === 401);
  r = await J(`/session/${sid}/submit`, 'POST', { confirmed: true }, { Authorization: 'Bearer ok' }); ok('submit blocked before confirmation stage', r.s === 409, JSON.stringify(r.d));
  await J('/chat', 'POST', { sessionId: sid, message: 'it is severe, big pile' }); r = await J(`/session/${sid}/skip-photo`, 'POST');
  ok('photo skip reaches summary', r.d.complaintContext.stage === 'summary_confirmation', r.d.complaintContext.stage);
  const [a, b] = await Promise.all([J(`/session/${sid}/submit`, 'POST', { confirmed: true }, { Authorization: 'Bearer ok' }), J(`/session/${sid}/submit`, 'POST', { confirmed: true }, { Authorization: 'Bearer ok' })]);
  ok('double submit -> exactly ONE issue stored', store.issues.length === 1, store.issues.length);
  ok('both responses carry same complaint id or 409', [a, b].filter(x => x.d.success).every(x => x.d.complaintId === store.issues[0].complaintId));
  r = await J(`/session/${sid}/submit`, 'POST', { confirmed: true }, { Authorization: 'Bearer ok' }); ok('later resubmit is idempotent', r.d.alreadySubmitted && store.issues.length === 1);
  const iss = store.issues[0]; ok('issue uses real GPS, not default', iss.location.coordinates[1] === 28.6139 && iss.reportedBy === 'u1' && iss.imageUrl === '');
  ok('no fabricated CNN values', iss.aiAnalysis.cnnProbability === undefined && iss.aiAnalysis.requiresHumanReview === true);
  // no-location submission must be refused
  r = await J('/session', 'POST', { language: 'en-IN' }); const s2 = r.d.sessionId; const S2 = store.sessions.find(x => x.sessionId === s2);
  S2.complaintContext.stage = 'summary_confirmation'; S2.complaintContext.is_confirmed_by_user = true;
  r = await J(`/session/${s2}/submit`, 'POST', { confirmed: true }, { Authorization: 'Bearer ok' }); ok('submit w/o coordinates refused (no Delhi default)', r.s === 422 && r.d.error === 'LOCATION_REQUIRED');
  // STT honesty
  const fd = new FormData(); fd.append('audio', new Blob([Buffer.from('RIFF....WAVE' + 'x'.repeat(2000))], { type: 'audio/wav' }), 'a.wav'); fd.append('language', 'hi-IN');
  let t = await (await fetch(base + '/transcribe', { method: 'POST', body: fd })).json(); ok('STT without key returns failure, not fake transcript', t.success === false && !t.transcript, JSON.stringify(t));
  const fd2 = new FormData(); fd2.append('audio', new Blob([Buffer.alloc(2000)], { type: 'audio/webm' }), 'a.webm'); fd2.append('language', 'hi-IN');
  const w = await fetch(base + '/transcribe', { method: 'POST', body: fd2 }); ok('non-WAV audio upload rejected', w.status === 415, w.status);
  const fd3 = new FormData(); fd3.append('image', new Blob([Buffer.from('not an image at all, plain text')], { type: 'image/jpeg' }), 'a.jpg');
  const im = await fetch(`${base}/session/${s2}/image`, { method: 'POST', body: fd3 }); ok('fake image bytes rejected', im.status === 400, im.status);
  console.log(`\n${pass} passed, ${fail} failed`); srv.close(); process.exit(fail ? 1 : 0);
});
