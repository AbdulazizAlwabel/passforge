/* One-time secret sharing API.
 *
 * The browser encrypts the secret (AES-256-GCM) and keeps the key in the link's
 * #fragment, which browsers never send to servers. This module only ever sees
 * ciphertext. A secret can be revealed once; then its ciphertext is deleted.
 */
const crypto = require('crypto');

const TTLS = new Set([3600, 86400, 604800]);
const MAX_PAYLOAD = 60000;
const MAX_ATTEMPTS = 5;
const PAYLOAD_RE = /^[A-Za-z0-9_-]{16}\.[A-Za-z0-9_-]{22,60000}$/;
const ID_RE = /^[A-Za-z0-9_-]{22}$/;
const B64U = (n) => new RegExp('^[A-Za-z0-9_-]{' + n + '}$');

module.exports = function mountSecrets(api, { db, wrap, limiter, sha256, readUser }) {
  const createLimit = limiter({ windowMs: 15 * 60 * 1000, max: 30 });
  const revealLimit = limiter({ windowMs: 15 * 60 * 1000, max: 30 });
  const metaLimit = limiter({ windowMs: 15 * 60 * 1000, max: 120 });

  const statusOf = (r) =>
    r.burned_at ? 'burned' : r.viewed_at ? 'viewed' : new Date(r.expires_at) <= new Date() ? 'expired' : 'active';

  api.post('/secrets', createLimit, wrap(async (req, res) => {
    const { payload, salt, verifier } = req.body;
    const ttl = +req.body.expiresIn;
    if (typeof payload !== 'string' || payload.length > MAX_PAYLOAD || !PAYLOAD_RE.test(payload))
      return res.status(400).json({ error: 'Invalid or too large secret' });
    if (!TTLS.has(ttl)) return res.status(400).json({ error: 'Invalid expiry' });
    const hasPw = salt != null || verifier != null;
    if (hasPw && !(B64U(22).test(salt || '') && B64U(43).test(verifier || '')))
      return res.status(400).json({ error: 'Invalid password parameters' });

    const id = crypto.randomBytes(16).toString('base64url');
    const burnToken = crypto.randomBytes(24).toString('base64url');
    const user = await readUser(req);
    await db.execute(
      'INSERT INTO secrets (id, payload, salt, verifier_hash, burn_hash, user_id, expires_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [id, payload, hasPw ? salt : null, hasPw ? sha256(verifier) : null, sha256(burnToken), user ? user.id : null,
        new Date(Date.now() + ttl * 1000)]);
    res.status(201).json({ id, burnToken, expiresAt: new Date(Date.now() + ttl * 1000).toISOString() });
  }));

  // Metadata only — never consumes the secret (safe for link-preview bots).
  api.get('/secrets/:id', metaLimit, wrap(async (req, res) => {
    if (!ID_RE.test(req.params.id)) return res.status(404).json({ status: 'missing' });
    const [[r]] = await db.execute(
      'SELECT salt, verifier_hash, expires_at, viewed_at, burned_at, created_at FROM secrets WHERE id = ?', [req.params.id]);
    if (!r) return res.status(404).json({ status: 'missing' });
    const status = statusOf(r);
    res.json({
      status, createdAt: r.created_at, expiresAt: r.expires_at, viewedAt: r.viewed_at,
      hasPassword: !!r.verifier_hash, salt: status === 'active' ? r.salt : undefined,
    });
  }));

  api.post('/secrets/:id/reveal', revealLimit, wrap(async (req, res) => {
    if (!ID_RE.test(req.params.id)) return res.status(404).json({ error: 'This secret doesn’t exist.' });
    const conn = await db.getConnection();
    try {
      await conn.beginTransaction();
      const [[r]] = await conn.execute(
        'SELECT payload, verifier_hash, attempts, expires_at, viewed_at, burned_at FROM secrets WHERE id = ? FOR UPDATE',
        [req.params.id]);
      if (!r) { await conn.rollback(); return res.status(404).json({ error: 'This secret doesn’t exist.', status: 'missing' }); }
      const status = statusOf(r);
      if (status !== 'active' || r.payload == null) {
        await conn.rollback();
        return res.status(410).json({ status, error: status === 'viewed' ? 'This secret has already been viewed.' : status === 'expired' ? 'This secret has expired.' : 'This secret was destroyed by its creator.' });
      }
      if (r.verifier_hash) {
        const v = String(req.body.verifier || '');
        const ok = B64U(43).test(v) && crypto.timingSafeEqual(Buffer.from(sha256(v)), Buffer.from(r.verifier_hash));
        if (!ok) {
          const attempts = r.attempts + 1;
          if (attempts >= MAX_ATTEMPTS) {
            await conn.execute('UPDATE secrets SET attempts = ?, payload = NULL, burned_at = UTC_TIMESTAMP() WHERE id = ?', [attempts, req.params.id]);
            await conn.commit();
            return res.status(410).json({ status: 'burned', error: 'Too many wrong passwords — the secret has been destroyed.' });
          }
          await conn.execute('UPDATE secrets SET attempts = ? WHERE id = ?', [attempts, req.params.id]);
          await conn.commit();
          return res.status(403).json({ error: 'Wrong password.', attemptsLeft: MAX_ATTEMPTS - attempts });
        }
      }
      await conn.execute('UPDATE secrets SET payload = NULL, viewed_at = UTC_TIMESTAMP() WHERE id = ?', [req.params.id]);
      await conn.commit();
      res.json({ payload: r.payload });
    } catch (e) {
      await conn.rollback().catch(() => {});
      throw e;
    } finally {
      conn.release();
    }
  }));

  api.post('/secrets/:id/burn', revealLimit, wrap(async (req, res) => {
    if (!ID_RE.test(req.params.id)) return res.status(404).json({ error: 'Not found' });
    const [[r]] = await db.execute('SELECT burn_hash, user_id FROM secrets WHERE id = ?', [req.params.id]);
    if (!r) return res.status(404).json({ error: 'Not found' });
    const token = String(req.body.burnToken || '');
    const user = await readUser(req);
    const byToken = token && crypto.timingSafeEqual(Buffer.from(sha256(token)), Buffer.from(r.burn_hash));
    const byOwner = user && r.user_id === user.id;
    if (!byToken && !byOwner) return res.status(403).json({ error: 'You can’t destroy this secret.' });
    await db.execute('UPDATE secrets SET payload = NULL, burned_at = UTC_TIMESTAMP() WHERE id = ? AND viewed_at IS NULL AND burned_at IS NULL', [req.params.id]);
    res.json({ message: 'Secret destroyed' });
  }));

  // Signed-in users: the links they created (status only, never content).
  api.get('/my/secrets', wrap(async (req, res) => {
    const user = await readUser(req);
    if (!user) return res.status(401).json({ error: 'Not signed in' });
    const [rows] = await db.execute(
      'SELECT id, created_at, expires_at, viewed_at, burned_at, verifier_hash IS NOT NULL AS has_pw FROM secrets WHERE user_id = ? ORDER BY created_at DESC LIMIT 50',
      [user.id]);
    res.json(rows.map((r) => ({ id: r.id, createdAt: r.created_at, expiresAt: r.expires_at, viewedAt: r.viewed_at, hasPassword: !!r.has_pw, status: statusOf(r) })));
  }));

  // Housekeeping: drop expired ciphertext promptly, forget rows after 30 days.
  const sweep = async () => {
    try {
      await db.query('UPDATE secrets SET payload = NULL WHERE payload IS NOT NULL AND expires_at <= UTC_TIMESTAMP()');
      await db.query('DELETE FROM secrets WHERE created_at < UTC_TIMESTAMP() - INTERVAL 30 DAY');
    } catch (e) { console.error('[secrets] sweep failed:', e.message); }
  };
  setInterval(sweep, 10 * 60 * 1000).unref();
  setTimeout(sweep, 5000).unref();
};
