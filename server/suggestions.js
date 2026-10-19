/* "Suggest a tool" with public voting.
 * New suggestions are pending until the owner approves them in the admin console.
 * Nothing about the visitor is stored: duplicate votes are prevented in the browser
 * (localStorage) and by short-lived in-memory rate limits.
 */
const PUBLIC = ['open', 'planned', 'done'];
const URLISH = /(https?:\/\/|www\.|\b[a-z0-9-]+\.(com|net|org|ru|xyz|top|io|info|biz|cn)\b)/i;

module.exports = function mountSuggestions(api, { db, wrap, limiter, admin }) {
  const postLimit = limiter({ windowMs: 60 * 60 * 1000, max: 4 });
  const voteLimit = limiter({ windowMs: 60 * 60 * 1000, max: 40 });

  api.get('/suggestions', wrap(async (req, res) => {
    const [rows] = await db.query(
      "SELECT id, title, details, lang, status, votes, created_at FROM suggestions WHERE status IN ('open','planned','done') ORDER BY FIELD(status,'planned','open','done'), votes DESC, id DESC LIMIT 200");
    res.json(rows);
  }));

  api.post('/suggestions', postLimit, wrap(async (req, res) => {
    const b = req.body || {};
    if (b.website) return res.status(201).json({ message: 'Thanks! Your suggestion will appear once it’s reviewed.' }); // honeypot: pretend success
    const elapsed = Date.now() - Number(b.t || 0);
    if (!(elapsed > 2500 && elapsed < 6 * 3600e3)) return res.status(400).json({ error: 'Please take a moment and try again.' });
    const title = String(b.title || '').replace(/\s+/g, ' ').trim();
    const details = String(b.details || '').replace(/[ \t]+/g, ' ').trim();
    if (title.length < 4 || title.length > 80) return res.status(400).json({ error: 'Give the tool a short name (4–80 characters).' });
    if (details.length > 500) return res.status(400).json({ error: 'Keep the details under 500 characters.' });
    if (URLISH.test(title) || URLISH.test(details)) return res.status(400).json({ error: 'Please describe the tool without links.' });
    await db.execute('INSERT INTO suggestions (title, details, lang) VALUES (?, ?, ?)', [title, details, b.lang === 'ar' ? 'ar' : 'en']);
    res.status(201).json({ message: 'Thanks! Your suggestion will appear once it’s reviewed.' });
  }));

  api.post('/suggestions/:id/vote', voteLimit, wrap(async (req, res) => {
    const id = parseInt(req.params.id, 10);
    const delta = req.body && req.body.undo ? -1 : 1;
    const [r] = await db.execute(
      `UPDATE suggestions SET votes = GREATEST(0, CAST(votes AS SIGNED) + ?) WHERE id = ? AND status IN ('open','planned')`, [delta, id]);
    if (!r.affectedRows) return res.status(404).json({ error: 'Not found' });
    const [[row]] = await db.execute('SELECT votes FROM suggestions WHERE id = ?', [id]);
    res.json({ votes: row.votes });
  }));

  // Owner moderation
  api.get('/admin/suggestions', admin, wrap(async (req, res) => {
    const [rows] = await db.query("SELECT id, title, details, lang, status, votes, created_at FROM suggestions ORDER BY FIELD(status,'pending') DESC, created_at DESC LIMIT 300");
    res.json(rows);
  }));
  api.put('/admin/suggestions/:id', admin, wrap(async (req, res) => {
    const status = String(req.body.status || '');
    if (!['open', 'planned', 'done', 'declined'].includes(status)) return res.status(400).json({ error: 'Invalid status' });
    const [r] = await db.execute('UPDATE suggestions SET status = ? WHERE id = ?', [status, parseInt(req.params.id, 10)]);
    if (!r.affectedRows) return res.status(404).json({ error: 'Not found' });
    res.json({ message: 'Updated' });
  }));
  api.delete('/admin/suggestions/:id', admin, wrap(async (req, res) => {
    await db.execute('DELETE FROM suggestions WHERE id = ?', [parseInt(req.params.id, 10)]);
    res.json({ message: 'Deleted' });
  }));
};
module.exports.PUBLIC = PUBLIC;
