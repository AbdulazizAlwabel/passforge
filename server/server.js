/* Nicely Done — optional account API + static host.
 *
 * The tools are 100% client-side; this server only provides accounts
 * (register, verify, sign in, reset password, profile, admin) and serves
 * the built site from STATIC_DIR. API routes are compatible with v1 (PassForge).
 */
require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const express = require('express');
const cookieParser = require('cookie-parser');
const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const mail = require('./email');

const {
  PORT = 3000,
  NODE_ENV = 'production',
  SITE_URL = 'https://nicelydone.qd.je',
  STATIC_DIR = '../dist',
  TRUST_PROXY = '1',
  JWT_SECRET,
  ADMIN_USERNAMES = 'AbdulazizAlwabel,Abdulaziz',
} = process.env;

if (!JWT_SECRET || JWT_SECRET.length < 32) {
  console.error('[nicelydone] JWT_SECRET must be set to at least 32 characters (see .env.example).');
  process.exit(1);
}

const PROD = NODE_ENV === 'production';
const ADMINS = new Set(ADMIN_USERNAMES.split(',').map((s) => s.trim().toLowerCase()).filter(Boolean));
const STATIC_ROOT = path.resolve(__dirname, STATIC_DIR);
const COOKIE = 'token';
const SESSION_DAYS = 7;
const BCRYPT_COST = 12;
const DUMMY_HASH = bcrypt.hashSync(crypto.randomBytes(16).toString('hex'), BCRYPT_COST);

const db = mysql.createPool({
  host: process.env.DB_HOST,
  port: +(process.env.DB_PORT || 3306),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  timezone: 'Z',
});

const app = express();
app.disable('x-powered-by');
if (TRUST_PROXY === '1') app.set('trust proxy', 1);

/* ── Security headers ─────────────────────────────────────────────── */
const CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com",
  "img-src 'self' data:",
  "connect-src 'self' https://ipwho.is https://ipapi.co https://api64.ipify.org https://fonts.googleapis.com https://fonts.gstatic.com",
  "worker-src 'self'",
  "manifest-src 'self'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "object-src 'none'",
].join('; ');
app.use((req, res, next) => {
  res.set({
    'Content-Security-Policy': CSP,
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), interest-cohort=()',
    'Cross-Origin-Opener-Policy': 'same-origin',
  });
  if (PROD) res.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  next();
});

/* ── API ──────────────────────────────────────────────────────────── */
const api = express.Router();
api.use(express.json({ limit: '10kb' }));
api.use(cookieParser());
api.use((req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });

// Reject cross-site state-changing requests (CSRF defence in depth on top of SameSite).
const allowedOrigins = new Set([new URL(SITE_URL).origin, new URL(SITE_URL).origin.replace('://', '://www.')]);
api.use((req, res, next) => {
  if (req.method === 'GET' || req.method === 'HEAD') return next();
  const origin = req.get('origin');
  if (origin && !allowedOrigins.has(origin) && PROD) return res.status(403).json({ error: 'Cross-site request blocked' });
  next();
});

/* Tiny in-memory rate limiter (single process). */
function limiter({ windowMs, max }) {
  const hits = new Map();
  setInterval(() => { const now = Date.now(); for (const [k, v] of hits) if (v.reset < now) hits.delete(k); }, windowMs).unref();
  return (req, res, next) => {
    const key = req.ip + '|' + req.path;
    const now = Date.now();
    let h = hits.get(key);
    if (!h || h.reset < now) { h = { n: 0, reset: now + windowMs }; hits.set(key, h); }
    if (++h.n > max) {
      res.set('Retry-After', Math.ceil((h.reset - now) / 1000));
      return res.status(429).json({ error: 'Too many attempts. Please wait a few minutes and try again.' });
    }
    next();
  };
}
const strict = limiter({ windowMs: 15 * 60 * 1000, max: 10 });
const normal = limiter({ windowMs: 15 * 60 * 1000, max: 60 });

const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
const sha256 = (s) => crypto.createHash('sha256').update(s).digest('hex');
const isAdmin = (username) => ADMINS.has(String(username).toLowerCase());
const USERNAME_RE = /^[A-Za-z0-9_.-]{3,30}$/;
const EMAIL_RE = /^[^\s@]{1,64}@[^\s@]{1,255}\.[^\s@]{2,}$/;

function setSession(res, user) {
  const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: SESSION_DAYS + 'd' });
  res.cookie(COOKIE, token, { httpOnly: true, secure: PROD, sameSite: 'lax', path: '/', maxAge: SESSION_DAYS * 864e5 });
}

/* Create a one-time token; only its SHA-256 is stored. Older unused tokens of the same type are retired. */
async function createToken(userId, type, minutes) {
  const raw = crypto.randomBytes(32).toString('hex');
  await db.execute('UPDATE tokens SET used = 1 WHERE user_id = ? AND type = ? AND used = 0', [userId, type]);
  await db.execute('INSERT INTO tokens (user_id, token, type, expires_at) VALUES (?, ?, ?, ?)',
    [userId, sha256(raw), type, new Date(Date.now() + minutes * 60000)]);
  return raw;
}
async function consumeToken(raw, type) {
  if (!/^[a-f0-9]{64}$/.test(raw || '')) return null;
  const [rows] = await db.execute(
    'SELECT id, user_id FROM tokens WHERE token = ? AND type = ? AND used = 0 AND expires_at > UTC_TIMESTAMP()',
    [sha256(raw), type]);
  if (!rows.length) return null;
  const [r] = await db.execute('UPDATE tokens SET used = 1 WHERE id = ? AND used = 0', [rows[0].id]);
  return r.affectedRows ? rows[0].user_id : null;
}

function auth(req, res, next) {
  const t = req.cookies[COOKIE];
  if (!t) return res.status(401).json({ error: 'Not signed in' });
  try { req.user = jwt.verify(t, JWT_SECRET); next(); }
  catch { res.clearCookie(COOKIE, { path: '/' }); res.status(401).json({ error: 'Your session has expired. Please sign in again.' }); }
}
function admin(req, res, next) {
  auth(req, res, () => (isAdmin(req.user.username) ? next() : res.status(403).json({ error: 'Access denied' })));
}

api.get('/health', wrap(async (req, res) => {
  await db.query('SELECT 1');
  res.json({ ok: true });
}));

api.post('/register', strict, wrap(async (req, res) => {
  const username = String(req.body.username || '').trim();
  const email = String(req.body.email || '').trim().toLowerCase();
  const password = String(req.body.password || '');
  if (!username || !email || !password) return res.status(400).json({ error: 'All fields are required' });
  if (!USERNAME_RE.test(username)) return res.status(400).json({ error: 'Username must be 3–30 letters, numbers, _ . or -' });
  if (!EMAIL_RE.test(email) || email.length > 255) return res.status(400).json({ error: 'Enter a valid email address' });
  if (password.length < 8 || password.length > 128) return res.status(400).json({ error: 'Password must be 8–128 characters' });

  const hash = await bcrypt.hash(password, BCRYPT_COST);
  let userId;
  try {
    const [r] = await db.execute('INSERT INTO users (username, email, password) VALUES (?, ?, ?)', [username, email, hash]);
    userId = r.insertId;
  } catch (e) {
    if (e.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'That username or email is already registered' });
    throw e;
  }
  try {
    const t = await createToken(userId, 'verify_email', 24 * 60);
    await mail.sendVerification(email, username, t);
  } catch (e) {
    console.error('[register] verification email failed:', e.message);
  }
  res.status(201).json({ message: 'Account created! Check your email to verify it.' });
}));

api.post('/login', strict, wrap(async (req, res) => {
  const id = String(req.body.email || req.body.username || '').trim();
  const password = String(req.body.password || '');
  if (!id || !password) return res.status(400).json({ error: 'Email and password are required' });
  const [rows] = await db.execute(
    id.includes('@') ? 'SELECT * FROM users WHERE email = ?' : 'SELECT * FROM users WHERE username = ?',
    [id.includes('@') ? id.toLowerCase() : id]);
  // Compare against a dummy hash when the user doesn't exist so timing doesn't reveal accounts.
  const user = rows[0];
  const ok = await bcrypt.compare(password, user ? user.password : DUMMY_HASH);
  if (!user || !ok) return res.status(401).json({ error: 'Invalid email or password' });
  setSession(res, user);
  res.json({ message: 'Signed in', username: user.username });
}));

api.post('/logout', (req, res) => {
  res.clearCookie(COOKIE, { path: '/' });
  res.json({ message: 'Signed out' });
});

api.get('/verify-email', normal, wrap(async (req, res) => {
  const userId = await consumeToken(String(req.query.token || ''), 'verify_email');
  if (!userId) return res.redirect(303, '/account/?verified=0');
  await db.execute('UPDATE users SET verified = 1 WHERE id = ?', [userId]);
  const [[u]] = await db.execute('SELECT username, email FROM users WHERE id = ?', [userId]);
  if (u) mail.sendWelcome(u.email, u.username).catch((e) => console.error('[verify] welcome email failed:', e.message));
  res.redirect(303, '/account/?verified=1');
}));

api.post('/resend-verification', strict, auth, wrap(async (req, res) => {
  const [[u]] = await db.execute('SELECT id, username, email, verified FROM users WHERE id = ?', [req.user.id]);
  if (!u) return res.status(404).json({ error: 'User not found' });
  if (u.verified) return res.json({ message: 'Your email is already verified' });
  const t = await createToken(u.id, 'verify_email', 24 * 60);
  await mail.sendVerification(u.email, u.username, t);
  res.json({ message: 'Verification email sent' });
}));

api.post('/forgot-password', strict, wrap(async (req, res) => {
  const email = String(req.body.email || '').trim().toLowerCase();
  if (!email) return res.status(400).json({ error: 'Email is required' });
  // Same response either way to prevent account enumeration.
  res.json({ message: 'If that email has an account, a reset link is on its way.' });
  try {
    const [[u]] = await db.execute('SELECT id, username, email FROM users WHERE email = ?', [email]);
    if (!u) return;
    const t = await createToken(u.id, 'reset_password', 60);
    await mail.sendPasswordReset(u.email, u.username, t);
  } catch (e) {
    console.error('[forgot-password]', e.message);
  }
}));

api.post('/reset-password', strict, wrap(async (req, res) => {
  const password = String(req.body.password || '');
  if (password.length < 8 || password.length > 128) return res.status(400).json({ error: 'Password must be 8–128 characters' });
  const userId = await consumeToken(String(req.body.token || ''), 'reset_password');
  if (!userId) return res.status(400).json({ error: 'This reset link is invalid or has expired. Please request a new one.' });
  await db.execute('UPDATE users SET password = ? WHERE id = ?', [await bcrypt.hash(password, BCRYPT_COST), userId]);
  res.json({ message: 'Password reset successfully' });
}));

api.get('/me', auth, (req, res) => {
  res.json({ id: req.user.id, username: req.user.username, admin: isAdmin(req.user.username) });
});

api.get('/profile', auth, wrap(async (req, res) => {
  const [[u]] = await db.execute('SELECT id, username, email, verified, created_at FROM users WHERE id = ?', [req.user.id]);
  if (!u) { res.clearCookie(COOKIE, { path: '/' }); return res.status(401).json({ error: 'Account not found' }); }
  res.json({ ...u, verified: !!u.verified, admin: isAdmin(u.username) });
}));

api.put('/profile/password', strict, auth, wrap(async (req, res) => {
  const cur = String(req.body.currentPassword || '');
  const next = String(req.body.newPassword || '');
  if (!cur || !next) return res.status(400).json({ error: 'Both fields are required' });
  if (next.length < 8 || next.length > 128) return res.status(400).json({ error: 'New password must be 8–128 characters' });
  const [[u]] = await db.execute('SELECT id, username, password FROM users WHERE id = ?', [req.user.id]);
  if (!u || !(await bcrypt.compare(cur, u.password))) return res.status(401).json({ error: 'Current password is incorrect' });
  await db.execute('UPDATE users SET password = ? WHERE id = ?', [await bcrypt.hash(next, BCRYPT_COST), u.id]);
  setSession(res, u);
  res.json({ message: 'Password updated' });
}));

api.get('/admin/users', admin, wrap(async (req, res) => {
  const [rows] = await db.query('SELECT id, username, email, verified, created_at FROM users ORDER BY created_at DESC');
  res.json(rows.map((r) => ({ ...r, verified: !!r.verified })));
}));
api.put('/admin/users/:id/verify', admin, wrap(async (req, res) => {
  const [r] = await db.execute('UPDATE users SET verified = 1 WHERE id = ?', [+req.params.id]);
  if (!r.affectedRows) return res.status(404).json({ error: 'User not found' });
  res.json({ message: 'User verified' });
}));
api.delete('/admin/users/:id', admin, wrap(async (req, res) => {
  const id = +req.params.id;
  if (id === req.user.id) return res.status(400).json({ error: 'You can’t delete your own account here' });
  const [r] = await db.execute('DELETE FROM users WHERE id = ?', [id]);
  if (!r.affectedRows) return res.status(404).json({ error: 'User not found' });
  res.json({ message: 'User deleted' });
}));
api.get('/admin/tokens', admin, wrap(async (req, res) => {
  const [rows] = await db.query(
    `SELECT t.id, t.type, t.used, t.expires_at, t.created_at, u.username, u.email
       FROM tokens t JOIN users u ON t.user_id = u.id
      ORDER BY t.created_at DESC LIMIT 100`);
  res.json(rows);
}));

api.use((req, res) => res.status(404).json({ error: 'Not found' }));
api.use((err, req, res, next) => { // eslint-disable-line no-unused-vars
  console.error('[api]', err);
  res.status(err.status === 400 ? 400 : 500).json({ error: err.status === 400 ? 'Malformed request' : 'Something went wrong on our side' });
});
app.use('/api', api);

/* ── Static site ──────────────────────────────────────────────────── */
// v1 links such as /password-generator.html → /password-generator/
app.get(/^\/([a-z0-9-]+)\.html$/, (req, res, next) => {
  const slug = req.params[0];
  if (slug === 'index') return res.redirect(301, '/');
  if (slug === 'auth') return res.redirect(301, '/account/');
  if (fs.existsSync(path.join(STATIC_ROOT, slug, 'index.html'))) return res.redirect(301, '/' + slug + '/');
  next();
});
app.use(express.static(STATIC_ROOT, {
  extensions: ['html'],
  setHeaders(res, file) {
    if (file.includes(path.sep + 'assets' + path.sep)) res.set('Cache-Control', 'public, max-age=31536000, immutable');
    else res.set('Cache-Control', 'no-cache');
  },
}));
app.use((req, res) => res.status(404).sendFile(path.join(STATIC_ROOT, '404.html')));

app.listen(PORT, () => console.log(`[nicelydone] listening on :${PORT} — serving ${STATIC_ROOT}`));
