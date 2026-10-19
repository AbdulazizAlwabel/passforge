/* Zero-knowledge vault storage. Everything here is ciphertext produced in the browser:
 * the vault key is wrapped by a passphrase-derived key and by a recovery key, and every
 * item is AES-256-GCM encrypted with the vault key. The server can't read any of it. */
const B64U = /^[A-Za-z0-9_-]+$/;
const WRAPPED = /^[A-Za-z0-9_-]{16}\.[A-Za-z0-9_-]{40,200}$/;     // iv.ciphertext of a 32-byte key
const ITEM = /^[A-Za-z0-9_-]{16}\.[A-Za-z0-9_-]{22,140000}$/;
const MAX_ITEMS = 1000;

module.exports = function mountVault(api, { db, wrap, limiter, auth, bcrypt }) {
  const writeLimit = limiter({ windowMs: 15 * 60 * 1000, max: 600 });
  const keyLimit = limiter({ windowMs: 15 * 60 * 1000, max: 10 });
  const validKeys = (b) => B64U.test(b.kdf_salt || '') && b.kdf_salt.length === 22 && Number.isInteger(b.kdf_iterations) &&
    b.kdf_iterations >= 300000 && b.kdf_iterations <= 5000000 && WRAPPED.test(b.wrapped_pass || '') && WRAPPED.test(b.wrapped_recov || '');

  api.get('/vault', auth, wrap(async (req, res) => {
    const [[v]] = await db.execute('SELECT kdf_salt, kdf_iterations, wrapped_pass, wrapped_recov, updated_at FROM vaults WHERE user_id = ?', [req.user.id]);
    if (!v) return res.json({ exists: false });
    const [items] = await db.execute('SELECT id, data, updated_at FROM vault_items WHERE user_id = ? ORDER BY updated_at DESC', [req.user.id]);
    res.json({ exists: true, ...v, items });
  }));

  api.post('/vault', keyLimit, auth, wrap(async (req, res) => {
    const b = req.body || {};
    if (!validKeys(b)) return res.status(400).json({ error: 'Invalid vault parameters' });
    try {
      await db.execute('INSERT INTO vaults (user_id, kdf_salt, kdf_iterations, wrapped_pass, wrapped_recov) VALUES (?, ?, ?, ?, ?)',
        [req.user.id, b.kdf_salt, b.kdf_iterations, b.wrapped_pass, b.wrapped_recov]);
    } catch (e) {
      if (e.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'You already have a vault.' });
      throw e;
    }
    res.status(201).json({ message: 'Vault created' });
  }));

  // Change passphrase (and optionally recovery key): the browser re-wraps the same vault key.
  api.put('/vault/keys', keyLimit, auth, wrap(async (req, res) => {
    const b = req.body || {};
    if (!validKeys(b)) return res.status(400).json({ error: 'Invalid vault parameters' });
    const [[u]] = await db.execute('SELECT password FROM users WHERE id = ?', [req.user.id]);
    if (!(await bcrypt.compare(String(b.password || ''), u.password))) return res.status(401).json({ error: 'Password is incorrect' });
    const [r] = await db.execute('UPDATE vaults SET kdf_salt = ?, kdf_iterations = ?, wrapped_pass = ?, wrapped_recov = ? WHERE user_id = ?',
      [b.kdf_salt, b.kdf_iterations, b.wrapped_pass, b.wrapped_recov, req.user.id]);
    if (!r.affectedRows) return res.status(404).json({ error: 'No vault yet.' });
    res.json({ message: 'Vault keys updated' });
  }));

  api.put('/vault/items/:id', writeLimit, auth, wrap(async (req, res) => {
    const id = req.params.id, data = String((req.body || {}).data || '');
    if (!/^[A-Za-z0-9_-]{22}$/.test(id) || !ITEM.test(data)) return res.status(400).json({ error: 'Invalid item' });
    const [[v]] = await db.execute('SELECT user_id FROM vaults WHERE user_id = ?', [req.user.id]);
    if (!v) return res.status(404).json({ error: 'No vault yet.' });
    const [[own]] = await db.execute('SELECT user_id FROM vault_items WHERE id = ?', [id]);
    if (own && own.user_id !== req.user.id) return res.status(404).json({ error: 'Not found' });
    if (!own) {
      const [[c]] = await db.execute('SELECT COUNT(*) AS n FROM vault_items WHERE user_id = ?', [req.user.id]);
      if (c.n >= MAX_ITEMS) return res.status(400).json({ error: 'Your vault is full (1,000 items).' });
      await db.execute('INSERT INTO vault_items (id, user_id, data) VALUES (?, ?, ?)', [id, req.user.id, data]);
    } else {
      await db.execute('UPDATE vault_items SET data = ? WHERE id = ? AND user_id = ?', [data, id, req.user.id]);
    }
    res.json({ message: 'Saved' });
  }));

  api.delete('/vault/items/:id', writeLimit, auth, wrap(async (req, res) => {
    await db.execute('DELETE FROM vault_items WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]);
    res.json({ message: 'Deleted' });
  }));

  // Last resort when both passphrase and recovery key are lost: wipe the vault.
  api.delete('/vault', keyLimit, auth, wrap(async (req, res) => {
    const [[u]] = await db.execute('SELECT password FROM users WHERE id = ?', [req.user.id]);
    if (!(await bcrypt.compare(String((req.body || {}).password || ''), u.password))) return res.status(401).json({ error: 'Password is incorrect' });
    await db.execute('DELETE FROM vault_items WHERE user_id = ?', [req.user.id]);
    await db.execute('DELETE FROM vaults WHERE user_id = ?', [req.user.id]);
    res.json({ message: 'Vault deleted' });
  }));
};
