/* Two-factor authentication: TOTP (RFC 6238, SHA-1, 6 digits, 30 s) + one-time recovery codes.
 * Secrets are encrypted at rest with TOTP_ENC_KEY (AES-256-GCM). */
const crypto = require('crypto');

const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
function base32(buf) {
  let bits = 0, value = 0, out = '';
  for (const b of buf) { value = (value << 8) | b; bits += 8; while (bits >= 5) { out += B32[(value >>> (bits - 5)) & 31]; bits -= 5; } }
  if (bits > 0) out += B32[(value << (5 - bits)) & 31];
  return out;
}
function unbase32(s) {
  const clean = s.toUpperCase().replace(/[^A-Z2-7]/g, '');
  let bits = 0, value = 0; const out = [];
  for (const c of clean) { value = (value << 5) | B32.indexOf(c); bits += 5; if (bits >= 8) { out.push((value >>> (bits - 8)) & 255); bits -= 8; } }
  return Buffer.from(out);
}
function hotp(secret, counter) {
  const msg = Buffer.alloc(8); msg.writeBigUInt64BE(BigInt(counter));
  const h = crypto.createHmac('sha1', secret).update(msg).digest();
  const o = h[h.length - 1] & 15;
  const n = ((h[o] & 127) << 24) | (h[o + 1] << 16) | (h[o + 2] << 8) | h[o + 3];
  return String(n % 1e6).padStart(6, '0');
}
/* Returns the matching time step (for replay protection) or 0. Accepts ±1 step. */
function verifyTotp(secretB32, code, lastStep, now = Date.now()) {
  if (!/^\d{6}$/.test(code)) return 0;
  const secret = unbase32(secretB32), step = Math.floor(now / 30000);
  for (const d of [0, -1, 1]) {
    const s = step + d;
    if (s <= lastStep) continue;
    const exp = hotp(secret, s);
    if (crypto.timingSafeEqual(Buffer.from(exp), Buffer.from(code))) return s;
  }
  return 0;
}

module.exports = function mountTwoFa(api, { db, wrap, limiter, auth, sha256, bcrypt, jwt, JWT_SECRET, setSession, SITE_NAME }) {
  const KEY = Buffer.from(process.env.TOTP_ENC_KEY || '', 'hex');
  if (KEY.length !== 32) console.error('[2fa] TOTP_ENC_KEY missing or not 64 hex chars — 2FA disabled');
  const enabled = () => KEY.length === 32;
  const seal = (text) => { const iv = crypto.randomBytes(12); const c = crypto.createCipheriv('aes-256-gcm', KEY, iv);
    const ct = Buffer.concat([c.update(text, 'utf8'), c.final()]); return [iv, c.getAuthTag(), ct].map((b) => b.toString('base64url')).join('.'); };
  const open = (s) => { const [iv, tag, ct] = s.split('.').map((x) => Buffer.from(x, 'base64url'));
    const d = crypto.createDecipheriv('aes-256-gcm', KEY, iv); d.setAuthTag(tag); return Buffer.concat([d.update(ct), d.final()]).toString('utf8'); };

  const strict = limiter({ windowMs: 15 * 60 * 1000, max: 20 });
  const loginStep = limiter({ windowMs: 15 * 60 * 1000, max: 30 });   // each ticket also allows only 5 tries
  const newCodes = async (userId) => {
    const codes = Array.from({ length: 10 }, () => { const r = crypto.randomBytes(5).toString('hex'); return r.slice(0, 5) + '-' + r.slice(5); });
    await db.execute('DELETE FROM recovery_codes WHERE user_id = ?', [userId]);
    for (const c of codes) await db.execute('INSERT INTO recovery_codes (user_id, code_hash) VALUES (?, ?)', [userId, sha256(c)]);
    return codes;
  };

  api.get('/2fa/status', auth, wrap(async (req, res) => {
    const [[u]] = await db.execute('SELECT totp_enabled FROM users WHERE id = ?', [req.user.id]);
    const [[r]] = await db.execute('SELECT COUNT(*) AS n FROM recovery_codes WHERE user_id = ? AND used_at IS NULL', [req.user.id]);
    res.json({ available: enabled(), enabled: !!(u && u.totp_enabled), recoveryLeft: r.n });
  }));

  // Step 1: create a pending secret and return it for the QR code.
  api.post('/2fa/setup', strict, auth, wrap(async (req, res) => {
    if (!enabled()) return res.status(503).json({ error: 'Two-factor sign-in isn’t available right now.' });
    const [[u]] = await db.execute('SELECT username, totp_enabled FROM users WHERE id = ?', [req.user.id]);
    if (u.totp_enabled) return res.status(400).json({ error: 'Two-factor sign-in is already on.' });
    const secret = base32(crypto.randomBytes(20));
    await db.execute('UPDATE users SET totp_pending_enc = ? WHERE id = ?', [seal(secret), req.user.id]);
    const label = encodeURIComponent(SITE_NAME + ':' + u.username);
    res.json({ secret, uri: `otpauth://totp/${label}?secret=${secret}&issuer=${encodeURIComponent(SITE_NAME)}&algorithm=SHA1&digits=6&period=30` });
  }));

  // Step 2: confirm with a code from the app → enable, issue recovery codes (shown once).
  api.post('/2fa/enable', strict, auth, wrap(async (req, res) => {
    const [[u]] = await db.execute('SELECT totp_pending_enc, totp_enabled FROM users WHERE id = ?', [req.user.id]);
    if (!u || !u.totp_pending_enc || u.totp_enabled) return res.status(400).json({ error: 'Start the setup again.' });
    const step = verifyTotp(open(u.totp_pending_enc), String(req.body.code || ''), 0);
    if (!step) return res.status(400).json({ error: 'That code didn’t match. Check your phone’s time and try the newest code.' });
    await db.execute('UPDATE users SET totp_enabled = 1, totp_secret_enc = totp_pending_enc, totp_pending_enc = NULL, totp_last_step = ? WHERE id = ?', [step, req.user.id]);
    res.json({ message: 'Two-factor sign-in is on', recoveryCodes: await newCodes(req.user.id) });
  }));

  api.post('/2fa/recovery-codes', strict, auth, wrap(async (req, res) => {
    const [[u]] = await db.execute('SELECT password, totp_enabled FROM users WHERE id = ?', [req.user.id]);
    if (!u.totp_enabled) return res.status(400).json({ error: 'Turn on two-factor sign-in first.' });
    if (!(await bcrypt.compare(String(req.body.password || ''), u.password))) return res.status(401).json({ error: 'Password is incorrect' });
    res.json({ recoveryCodes: await newCodes(req.user.id) });
  }));

  api.post('/2fa/disable', strict, auth, wrap(async (req, res) => {
    const [[u]] = await db.execute('SELECT password, totp_enabled, totp_secret_enc, totp_last_step FROM users WHERE id = ?', [req.user.id]);
    if (!u.totp_enabled) return res.json({ message: 'Two-factor sign-in is off' });
    if (!(await bcrypt.compare(String(req.body.password || ''), u.password))) return res.status(401).json({ error: 'Password is incorrect' });
    if (!verifyTotp(open(u.totp_secret_enc), String(req.body.code || ''), u.totp_last_step)) return res.status(400).json({ error: 'That code didn’t match.' });
    await db.execute('UPDATE users SET totp_enabled = 0, totp_secret_enc = NULL, totp_pending_enc = NULL WHERE id = ?', [req.user.id]);
    await db.execute('DELETE FROM recovery_codes WHERE user_id = ?', [req.user.id]);
    res.json({ message: 'Two-factor sign-in is off' });
  }));

  // Second step of sign-in: exchange the short-lived ticket + code for a session.
  const failures = new Map(); // ticket jti -> count (memory only)
  api.post('/login/2fa', loginStep, wrap(async (req, res) => {
    let t;
    try { t = jwt.verify(String(req.body.ticket || ''), JWT_SECRET); } catch { return res.status(401).json({ error: 'Your sign-in expired. Please start again.' }); }
    if (t.purpose !== '2fa') return res.status(401).json({ error: 'Your sign-in expired. Please start again.' });
    if ((failures.get(t.jti) || 0) >= 5) return res.status(429).json({ error: 'Too many attempts. Please start again.' });
    const [[u]] = await db.execute('SELECT * FROM users WHERE id = ?', [t.uid]);
    if (!u || !u.totp_enabled) return res.status(401).json({ error: 'Your sign-in expired. Please start again.' });
    const code = String(req.body.code || '').trim().toLowerCase();
    let ok = false;
    if (/^\d{6}$/.test(code)) {
      const step = verifyTotp(open(u.totp_secret_enc), code, u.totp_last_step);
      if (step) { await db.execute('UPDATE users SET totp_last_step = ? WHERE id = ?', [step, u.id]); ok = true; }
    } else if (/^[0-9a-f]{5}-?[0-9a-f]{5}$/.test(code)) {
      const norm = code.replace('-', '').replace(/^(.{5})/, '$1-');
      const [r] = await db.execute('UPDATE recovery_codes SET used_at = UTC_TIMESTAMP() WHERE user_id = ? AND code_hash = ? AND used_at IS NULL', [u.id, sha256(norm)]);
      ok = r.affectedRows === 1;
    }
    if (!ok) { failures.set(t.jti, (failures.get(t.jti) || 0) + 1); setTimeout(() => failures.delete(t.jti), 10 * 60 * 1000).unref(); return res.status(401).json({ error: 'That code didn’t match.' }); }
    failures.delete(t.jti);
    setSession(res, u);
    res.json({ message: 'Signed in', username: u.username });
  }));

  // Used by /login: issue a 5-minute ticket instead of a session when 2FA is on.
  return {
    ticketFor: (u) => jwt.sign({ uid: u.id, purpose: '2fa', jti: crypto.randomBytes(8).toString('hex') }, JWT_SECRET, { expiresIn: '5m' }),
  };
};
module.exports.verifyTotp = verifyTotp; module.exports.hotp = hotp; module.exports.base32 = base32; module.exports.unbase32 = unbase32;
