/* Self-hosted speed test — no third parties, nothing logged or stored per visitor.
 *
 * Limits are designed to be invisible:
 *  - At most MAX_ACTIVE tests run at once; extra visitors wait silently for a slot.
 *  - Tests are time-boxed (the client stops when its window ends), so nobody hits a size cap.
 *  - The measurement window shrinks a little for heavy repeat testers and as the monthly
 *    egress budget is used, instead of refusing tests. Only far beyond any realistic use
 *    (HARD_STOP_BYTES) does the test pause.
 * Only outbound (download) bytes count toward Oracle's free 10 TB/month.
 */
const crypto = require('crypto');

const MAX_ACTIVE = 2;
const LEASE_MS = 45000;
const WAIT_MS = 25000;
const BASE_MS = 8000;              // per direction
const MIN_MS = 4000;
const SOFT_START = 1e12;           // 1 TB/month: start shortening tests
const SOFT_FLOOR = 3e12;           // 3 TB: tests at their shortest
const HARD_STOP_BYTES = 4.5e12;    // 4.5 TB: pause (never expected in practice)
const MAX_CHUNK = 100 * 1024 * 1024;
const RAND = crypto.randomBytes(1024 * 1024); // incompressible, reused

module.exports = function mountSpeed(api, { db, wrap }) {
  const leases = new Map();        // token -> expires
  const waiters = [];
  const perIp = new Map();         // ip -> [timestamps] (memory only, ≤1h, for pacing)
  let pendingBytes = 0, pendingTests = 0, monthBytes = 0, monthKey = '';

  const month = () => new Date().toISOString().slice(0, 7);
  async function loadMonth() {
    monthKey = month();
    try {
      const [[r]] = await db.execute('SELECT bytes FROM speed_usage WHERE month = ?', [monthKey]);
      monthBytes = r ? Number(r.bytes) : 0;
    } catch (e) { console.error('[speed] usage load failed:', e.message); }
  }
  async function flush() {
    if (month() !== monthKey) { await flushTo(monthKey); await loadMonth(); return; }
    await flushTo(monthKey);
  }
  async function flushTo(key) {
    if (!pendingBytes && !pendingTests) return;
    const b = pendingBytes, t = pendingTests; pendingBytes = 0; pendingTests = 0;
    try {
      await db.execute('INSERT INTO speed_usage (month, bytes, tests) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE bytes = bytes + VALUES(bytes), tests = tests + VALUES(tests)', [key, b, t]);
    } catch (e) { pendingBytes += b; pendingTests += t; console.error('[speed] usage flush failed:', e.message); }
  }
  loadMonth();
  setInterval(flush, 30000).unref();

  const sweep = () => { const now = Date.now(); for (const [k, exp] of leases) if (exp < now) leases.delete(k); };
  const grant = () => {
    sweep();
    while (waiters.length && leases.size < MAX_ACTIVE) {
      const w = waiters.shift();
      if (w.done) continue;
      w.done = true; clearTimeout(w.timer);
      const token = crypto.randomBytes(16).toString('base64url');
      leases.set(token, Date.now() + LEASE_MS);
      w.resolve(token);
    }
  };
  setInterval(grant, 1000).unref();
  const valid = (t) => { sweep(); return typeof t === 'string' && leases.has(t); };

  function windowMs(ip) {
    const used = monthBytes + pendingBytes;
    let ms = BASE_MS;
    if (used > SOFT_START) ms -= (BASE_MS - MIN_MS) * Math.min(1, (used - SOFT_START) / (SOFT_FLOOR - SOFT_START));
    const now = Date.now();
    const recent = (perIp.get(ip) || []).filter((t) => now - t < 3600e3);
    recent.push(now); perIp.set(ip, recent);
    if (recent.length > 6) ms = Math.min(ms, MIN_MS + 1000);
    if (recent.length > 15) ms = MIN_MS;
    return Math.round(ms);
  }
  setInterval(() => { const now = Date.now(); for (const [ip, ts] of perIp) { const k = ts.filter((t) => now - t < 3600e3); k.length ? perIp.set(ip, k) : perIp.delete(ip); } }, 600e3).unref();

  const noStore = (res) => res.set({ 'Cache-Control': 'no-store, no-transform', 'X-Accel-Buffering': 'no' });

  // Ask for a slot; waits quietly (long-poll) if two tests are already running.
  api.post('/speed/start', wrap(async (req, res) => {
    noStore(res);
    if (month() !== monthKey) await flush();
    if (monthBytes + pendingBytes > HARD_STOP_BYTES) return res.status(503).json({ error: 'The speed test is resting for the rest of the month.' });
    const token = await new Promise((resolve) => {
      const w = { resolve, done: false };
      w.timer = setTimeout(() => { if (!w.done) { w.done = true; resolve(null); } }, WAIT_MS);
      waiters.push(w); grant();
      req.on('close', () => { if (!w.done) { w.done = true; clearTimeout(w.timer); resolve(null); } });
    });
    if (!token) return res.status(202).json({ retry: true });   // client simply asks again
    pendingTests++;
    res.json({ token, durationMs: windowMs(req.ip), streams: 4, server: 'Riyadh · Oracle Cloud' });
  }));

  api.post('/speed/finish', (req, res) => {
    noStore(res);
    const t = (req.body && req.body.token) || req.query.t;
    leases.delete(t); grant();
    res.status(204).end();
  });

  api.get('/speed/ping', (req, res) => { noStore(res); res.status(204).end(); });

  api.get('/speed/down', (req, res) => {
    noStore(res);
    if (!valid(req.query.t)) return res.status(403).end();
    let left = Math.max(1, Math.min(MAX_CHUNK, parseInt(req.query.size, 10) || 1024 * 1024));
    res.set({ 'Content-Type': 'application/octet-stream', 'Content-Length': String(left) });
    let sent = 0;
    const pump = () => {
      while (left > 0) {
        const n = Math.min(left, RAND.length);
        left -= n;
        const ok = res.write(n === RAND.length ? RAND : RAND.subarray(0, n));
        sent += n;
        if (!ok) return res.once('drain', pump);
      }
      res.end();
    };
    res.on('close', () => { pendingBytes += sent; });
    pump();
  });

  api.post('/speed/up', (req, res) => {
    noStore(res);
    if (!valid(req.query.t)) { req.resume(); return res.status(403).end(); }
    let got = 0;
    req.on('data', (c) => { got += c.length; if (got > MAX_CHUNK) req.destroy(); });
    req.on('end', () => res.status(204).end());
    req.on('error', () => {});
  });
};
