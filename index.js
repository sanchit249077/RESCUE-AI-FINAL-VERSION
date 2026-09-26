import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import multer from 'multer';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import nodemailer from 'nodemailer';
import OpenAI from 'openai';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import crypto from 'node:crypto';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT || 4000);
const DATA_FILE = path.resolve(__dirname, process.env.DATA_FILE || './data/rescueai.json');
const UPLOAD_DIR = path.resolve(__dirname, process.env.UPLOAD_DIR || './uploads');
const JWT_SECRET = process.env.JWT_SECRET || crypto.randomBytes(48).toString('hex');
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || 'http://localhost:5173';
const DEV_OTP = process.env.DEV_OTP || '123456';

const app = express();
app.use(cors({ origin: CLIENT_ORIGIN.split(',').map((s) => s.trim()), credentials: true }));
app.use(express.json({ limit: '4mb' }));
app.use('/uploads', express.static(UPLOAD_DIR));

const entityNames = ['Disaster', 'IncidentReport', 'Resource', 'VictimReport', 'Alert'];
const store = { users: [], disasters: [], incidentReports: [], resources: [], victimReports: [], alerts: [], otps: [], resets: [] };

async function ensureStore() {
  await fs.mkdir(path.dirname(DATA_FILE), { recursive: true });
  await fs.mkdir(UPLOAD_DIR, { recursive: true });
  try {
    const parsed = JSON.parse(await fs.readFile(DATA_FILE, 'utf8'));
    Object.assign(store, parsed);
  } catch {
    await seed();
    await persist();
  }
  if (!store.users.length) {
    store.users.push({
      id: id('usr'),
      email: 'demo@rescueai.local',
      password_hash: await bcrypt.hash('RescueAI123!', 12),
      verified: true,
      created_date: now(),
    });
    await persist();
  }
  if (!store.disasters.length) {
    seed();
    await persist();
  }
}
async function persist() {
  await fs.writeFile(DATA_FILE, JSON.stringify(store, null, 2));
}
function id(prefix) { return `${prefix}_${crypto.randomUUID()}`; }
function now() { return new Date().toISOString(); }
function seed() {
  store.disasters.push(
    { id: id('dis'), name: 'Yamuna Flood Zone', type: 'flood', severity: 'high', status: 'active', location_name: 'Delhi NCR', latitude: 28.6139, longitude: 77.2090, affected_population: 18500, risk_score: 82, created_date: now() },
    { id: id('dis'), name: 'Cyclone Watch', type: 'cyclone', severity: 'medium', status: 'active', location_name: 'Odisha Coast', latitude: 20.2961, longitude: 85.8245, affected_population: 7200, risk_score: 63, created_date: now() },
    { id: id('dis'), name: 'Urban Flash Flood', type: 'flood', severity: 'moderate', status: 'monitoring', location_name: 'Mumbai', latitude: 19.0760, longitude: 72.8777, affected_population: 3100, risk_score: 48, created_date: now() }
  );
}

function sign(user) { return jwt.sign({ sub: user.id, email: user.email }, JWT_SECRET, { expiresIn: '7d' }); }
function auth(req, res, next) {
  const h = req.headers.authorization || '';
  const token = h.startsWith('Bearer ') ? h.slice(7) : null;
  if (!token) return res.status(401).json({ message: 'Authentication required' });
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    const user = store.users.find((u) => u.id === payload.sub);
    if (!user) return res.status(401).json({ message: 'Session expired' });
    req.user = user;
    next();
  } catch {
    return res.status(401).json({ message: 'Invalid or expired session' });
  }
}
function errorMessage(message, status = 400, extra = {}) {
  const e = new Error(message); e.status = status; e.data = extra; return e;
}
function normalizeEntityName(name) { return name[0].toLowerCase() + name.slice(1) + 's'; }
function getCollection(name) {
  const key = normalizeEntityName(name);
  if (!store[key]) throw errorMessage(`Unknown entity: ${name}`, 404);
  return store[key];
}

function queryCollection(collection, req) {
  const sort = req.query.sort || '-created_date';
  const limit = Math.max(1, Math.min(Number(req.query.limit || 100), 500));
  const field = sort.replace(/^-/, '');
  const dir = sort.startsWith('-') ? -1 : 1;
  return [...collection].sort((a, b) => {
    const av = a[field] ?? ''; const bv = b[field] ?? '';
    if (av === bv) return 0;
    return av > bv ? dir : -dir;
  }).slice(0, limit);
}

async function maybeEmail({ to, subject, text }) {
  if (!process.env.SMTP_HOST || !process.env.SMTP_USER) {
    console.log(`[EMAIL DEMO] To: ${to}\nSubject: ${subject}\n${text}\n`);
    return false;
  }
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: String(process.env.SMTP_SECURE).toLowerCase() === 'true',
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });
  await transporter.sendMail({ from: process.env.SMTP_FROM || process.env.SMTP_USER, to, subject, text });
  return true;
}

let aiClient = null;
if (process.env.OPENAI_API_KEY) aiClient = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

async function runLLM({ prompt, file_urls = [], response_json_schema }) {
  if (!aiClient) return mockLLM(prompt, response_json_schema);
  const content = [{ type: 'text', text: prompt }];
  for (const url of file_urls.slice(0, 4)) {
    let imageData = url;
    if (url.startsWith('/uploads/')) {
      const filePath = path.join(UPLOAD_DIR, path.basename(url));
      try {
        const bytes = await fs.readFile(filePath);
        const ext = path.extname(filePath).toLowerCase();
        const mime = ext === '.png' ? 'image/png' : ext === '.webp' ? 'image/webp' : 'image/jpeg';
        imageData = `data:${mime};base64,${bytes.toString('base64')}`;
      } catch { /* fall back to URL */ }
    } else if (!url.startsWith('http') && !url.startsWith('data:')) {
      imageData = `${CLIENT_ORIGIN}${url}`;
    }
    content.push({ type: 'image_url', image_url: { url: imageData } });
  }
  const params = { model: process.env.OPENAI_MODEL || 'gpt-4o-mini', messages: [{ role: 'user', content }], temperature: 0.2 };
  if (response_json_schema) params.response_format = { type: 'json_object' };
  const result = await aiClient.chat.completions.create(params);
  const text = result.choices?.[0]?.message?.content || '';
  if (!response_json_schema) return text;
  try { return JSON.parse(text); } catch { return text; }
}

function mockLLM(prompt, schema) {
  const lower = prompt.toLowerCase();
  if (!schema) {
    const body = prompt.split('Return only the translated message:').pop()?.trim() || prompt;
    if (lower.includes('translate this emergency alert') && lower.includes('hindi')) return `आपातकालीन चेतावनी: ${body}`;
    return body;
  }
  const props = schema.properties || {};
  const out = {};
  for (const [key, cfg] of Object.entries(props)) {
    if (cfg.type === 'array') out[key] = key.includes('target') ? ['Main road corridor', 'Low-lying residential zone'] : ['Resource gap identified', 'Maintain emergency access'];
    else if (cfg.type === 'number') out[key] = /confidence/i.test(key) ? 86 : /percentage/i.test(key) ? 42 : /buildings/i.test(key) ? 18 : /roads/i.test(key) ? 4 : /population/i.test(key) ? 1200 : /priority/i.test(key) ? 78 : /time/i.test(key) ? 24 : /distance/i.test(key) ? 8.5 : 60;
    else if (cfg.type === 'string') {
      if (key === 'risk_trend') out[key] = 'stable';
      else if (key.includes('status')) out[key] = 'moderate_damage';
      else if (key.includes('severity')) out[key] = 'medium';
      else if (key.includes('recommended_status')) out[key] = 'verified';
      else if (key.includes('urgency')) out[key] = 'high';
      else out[key] = 'AI analysis available. Review conditions and prioritize vulnerable areas.';
    }
  }
  return out;
}

app.get('/api/health', (_req, res) => res.json({ ok: true, service: 'RescueAI backend', ai: Boolean(aiClient), time: now() }));
app.get('/api/public-settings', (_req, res) => res.json({ id: 'rescueai-local', public_settings: { auth_required: true, providers: ['email'] } }));

app.post('/api/auth/register', async (req, res, next) => {
  try {
    const email = String(req.body.email || '').trim().toLowerCase();
    const password = String(req.body.password || '');
    if (!email || password.length < 6) throw errorMessage('Email and a password of at least 6 characters are required', 400);
    if (store.users.some((u) => u.email === email)) throw errorMessage('An account with this email already exists', 409);
    const user = { id: id('usr'), email, password_hash: await bcrypt.hash(password, 12), verified: false, created_date: now() };
    store.users.push(user);
    const code = process.env.SMTP_HOST ? String(Math.floor(100000 + Math.random() * 900000)) : DEV_OTP;
    store.otps = store.otps.filter((o) => o.email !== email);
    store.otps.push({ email, code, expires_at: Date.now() + 10 * 60 * 1000 });
    await persist();
    await maybeEmail({ to: email, subject: 'RescueAI verification code', text: `Your RescueAI verification code is ${code}. It expires in 10 minutes.` });
    res.json({ ok: true });
  } catch (e) { next(e); }
});

app.post('/api/auth/verify-otp', async (req, res, next) => {
  try {
    const email = String(req.body.email || '').trim().toLowerCase();
    const otpCode = String(req.body.otpCode || '');
    const row = store.otps.find((o) => o.email === email && o.expires_at > Date.now());
    if (!row || row.code !== otpCode) throw errorMessage('Invalid or expired verification code', 400);
    const user = store.users.find((u) => u.email === email);
    if (!user) throw errorMessage('Account not found', 404);
    user.verified = true;
    store.otps = store.otps.filter((o) => o.email !== email);
    await persist();
    res.json({ access_token: sign(user), user: safeUser(user) });
  } catch (e) { next(e); }
});
app.post('/api/auth/resend-otp', async (req, res, next) => {
  try {
    const email = String(req.body.email || '').trim().toLowerCase();
    const user = store.users.find((u) => u.email === email);
    if (!user) throw errorMessage('If the account exists, a new code has been sent', 200);
    const code = process.env.SMTP_HOST ? String(Math.floor(100000 + Math.random() * 900000)) : DEV_OTP;
    store.otps = store.otps.filter((o) => o.email !== email);
    store.otps.push({ email, code, expires_at: Date.now() + 10 * 60 * 1000 });
    await persist();
    await maybeEmail({ to: email, subject: 'RescueAI verification code', text: `Your RescueAI verification code is ${code}.` });
    res.json({ ok: true });
  } catch (e) { next(e); }
});
app.post('/api/auth/login', async (req, res, next) => {
  try {
    const email = String(req.body.email || '').trim().toLowerCase();
    const password = String(req.body.password || '');
    const user = store.users.find((u) => u.email === email);
    if (!user || !await bcrypt.compare(password, user.password_hash)) throw errorMessage('Invalid email or password', 401);
    if (!user.verified) throw errorMessage('Please verify your email before logging in', 403);
    res.json({ access_token: sign(user), user: safeUser(user) });
  } catch (e) { next(e); }
});
app.get('/api/auth/me', auth, (req, res) => res.json(safeUser(req.user)));
app.post('/api/auth/logout', (_req, res) => res.json({ ok: true }));
app.post('/api/auth/forgot-password', async (req, res, next) => {
  try {
    const email = String(req.body.email || '').trim().toLowerCase();
    const user = store.users.find((u) => u.email === email);
    if (user) {
      const token = crypto.randomBytes(24).toString('hex');
      store.resets.push({ token, user_id: user.id, expires_at: Date.now() + 30 * 60 * 1000 });
      await persist();
      const link = `${CLIENT_ORIGIN}/reset-password?token=${token}`;
      await maybeEmail({ to: email, subject: 'RescueAI password reset', text: `Reset your password: ${link}` });
      console.log(`[RESET DEMO] ${link}`);
    }
    res.json({ ok: true });
  } catch (e) { next(e); }
});
app.post('/api/auth/reset-password', async (req, res, next) => {
  try {
    const { resetToken, newPassword } = req.body;
    if (!resetToken || String(newPassword || '').length < 6) throw errorMessage('Valid reset token and password are required', 400);
    const row = store.resets.find((r) => r.token === resetToken && r.expires_at > Date.now());
    if (!row) throw errorMessage('Invalid or expired reset token', 400);
    const user = store.users.find((u) => u.id === row.user_id);
    user.password_hash = await bcrypt.hash(newPassword, 12);
    store.resets = store.resets.filter((r) => r.token !== resetToken);
    await persist();
    res.json({ ok: true });
  } catch (e) { next(e); }
});
function safeUser(u) { return { id: u.id, email: u.email, verified: u.verified, created_date: u.created_date }; }

for (const entity of entityNames) {
  app.get(`/api/entities/${entity}`, auth, (req, res, next) => {
    try { res.json(queryCollection(getCollection(entity), req)); } catch (e) { next(e); }
  });
  app.post(`/api/entities/${entity}`, auth, async (req, res, next) => {
    try {
      const record = { ...req.body, id: id(entity.toLowerCase()), created_date: now(), updated_date: now() };
      getCollection(entity).push(record); await persist(); res.status(201).json(record);
    } catch (e) { next(e); }
  });
  app.patch(`/api/entities/${entity}/:id`, auth, async (req, res, next) => {
    try {
      const collection = getCollection(entity); const item = collection.find((x) => x.id === req.params.id);
      if (!item) throw errorMessage(`${entity} not found`, 404);
      Object.assign(item, req.body, { updated_date: now() }); await persist(); res.json(item);
    } catch (e) { next(e); }
  });
}

const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
    filename: (_req, file, cb) => cb(null, `${Date.now()}-${crypto.randomUUID()}${path.extname(file.originalname).toLowerCase()}`),
  }),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => cb(null, file.mimetype.startsWith('image/')),
});
app.post('/api/integrations/upload-file', auth, upload.single('file'), (req, res, next) => {
  try {
    if (!req.file) throw errorMessage('Image file required', 400);
    res.json({ file_url: `/uploads/${req.file.filename}` });
  } catch (e) { next(e); }
});
app.post('/api/integrations/llm', auth, async (req, res, next) => {
  try { const result = await runLLM(req.body); res.json(result); } catch (e) { next(e); }
});
app.post('/api/integrations/send-email', auth, async (req, res, next) => {
  try { await maybeEmail(req.body); res.json({ ok: true }); } catch (e) { next(e); }
});

app.use(async (req, res, next) => {
  if (req.method !== 'GET' || req.path.startsWith('/api/') || req.path.startsWith('/uploads/')) return next();
  try {
    const distIndex = path.resolve(__dirname, '../dist/index.html');
    await fs.access(distIndex);
    return res.sendFile(distIndex);
  } catch {
    return next();
  }
});

app.use((req, res) => res.status(404).json({ message: 'Not found' }));
app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(err.status || 500).json({ message: err.message || 'Server error', data: err.data });
});

ensureStore().then(() => app.listen(PORT, () => console.log(`RescueAI backend running on http://localhost:${PORT}`))).catch((e) => { console.error(e); process.exit(1); });
