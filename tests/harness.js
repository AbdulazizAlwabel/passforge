// Boots server.js with in-memory MySQL + captured email, for API flow tests.
const Module = require('module');
const users = [], tokens = [], secrets = []; global.SPEED = {}; const RC = []; let rcid = 0; const VAULTS = {}; const VITEMS = []; const SUGG = []; let sid = 0; let uid = 0, tid = 0;
global.SENT = [];
const now = () => new Date();
async function execute(sql, p = []) {
  sql = sql.replace(/\s+/g, ' ').trim();
  if (sql === 'SELECT 1') return [[{ 1: 1 }]];
  const U = (id) => users.find(u => u.id === id);
  if (sql.startsWith('UPDATE users SET totp_pending_enc = ?')) { U(p[1]).totp_pending_enc = p[0]; return [{}]; }
  if (sql.startsWith('UPDATE users SET totp_enabled = 1')) { const u = U(p[1]); u.totp_enabled = 1; u.totp_secret_enc = u.totp_pending_enc; u.totp_pending_enc = null; u.totp_last_step = p[0]; return [{}]; }
  if (sql.startsWith('UPDATE users SET totp_enabled = 0')) { const u = U(p[0]); u.totp_enabled = 0; u.totp_secret_enc = null; u.totp_pending_enc = null; return [{}]; }
  if (sql.startsWith('UPDATE users SET totp_last_step')) { U(p[1]).totp_last_step = p[0]; return [{}]; }
  if (sql.startsWith('SELECT COUNT(*) AS n FROM recovery_codes')) return [[{ n: RC.filter(r => r.user_id === p[0] && !r.used_at).length }]];
  if (sql.startsWith('DELETE FROM recovery_codes')) { for (let i = RC.length - 1; i >= 0; i--) if (RC[i].user_id === p[0]) RC.splice(i, 1); return [{}]; }
  if (sql.startsWith('INSERT INTO recovery_codes')) { RC.push({ id: ++rcid, user_id: p[0], code_hash: p[1], used_at: null }); return [{}]; }
  if (sql.startsWith('UPDATE recovery_codes SET used_at')) { const r = RC.find(r => r.user_id === p[0] && r.code_hash === p[1] && !r.used_at); if (r) r.used_at = now(); return [{ affectedRows: r ? 1 : 0 }]; }
  if (sql.startsWith('SELECT kdf_salt')) return [VAULTS[p[0]] ? [{ ...VAULTS[p[0]] }] : []];
  if (sql.startsWith('SELECT id, data, updated_at FROM vault_items')) return [VITEMS.filter(i => i.user_id === p[0]).map(i => ({ id: i.id, data: i.data, updated_at: i.updated_at }))];
  if (sql.startsWith('INSERT INTO vaults')) { if (VAULTS[p[0]]) { const e = new Error('dup'); e.code = 'ER_DUP_ENTRY'; throw e; } VAULTS[p[0]] = { kdf_salt: p[1], kdf_iterations: p[2], wrapped_pass: p[3], wrapped_recov: p[4], updated_at: now() }; return [{}]; }
  if (sql.startsWith('UPDATE vaults SET')) { const v = VAULTS[p[4]]; if (!v) return [{ affectedRows: 0 }]; Object.assign(v, { kdf_salt: p[0], kdf_iterations: p[1], wrapped_pass: p[2], wrapped_recov: p[3] }); return [{ affectedRows: 1 }]; }
  if (sql.startsWith('SELECT user_id FROM vaults')) return [VAULTS[p[0]] ? [{ user_id: p[0] }] : []];
  if (sql.startsWith('SELECT user_id FROM vault_items')) return [VITEMS.filter(i => i.id === p[0]).map(i => ({ user_id: i.user_id }))];
  if (sql.startsWith('SELECT COUNT(*) AS n FROM vault_items')) return [[{ n: VITEMS.filter(i => i.user_id === p[0]).length }]];
  if (sql.startsWith('INSERT INTO vault_items')) { VITEMS.push({ id: p[0], user_id: p[1], data: p[2], updated_at: now() }); return [{}]; }
  if (sql.startsWith('UPDATE vault_items SET data')) { const i = VITEMS.find(i => i.id === p[1] && i.user_id === p[2]); if (i) { i.data = p[0]; i.updated_at = now(); } return [{}]; }
  if (sql.startsWith('DELETE FROM vault_items WHERE id')) { const k = VITEMS.findIndex(i => i.id === p[0] && i.user_id === p[1]); if (k >= 0) VITEMS.splice(k, 1); return [{}]; }
  if (sql.startsWith('DELETE FROM vault_items WHERE user_id')) { for (let k = VITEMS.length - 1; k >= 0; k--) if (VITEMS[k].user_id === p[0]) VITEMS.splice(k, 1); return [{}]; }
  if (sql.startsWith('DELETE FROM vaults')) { delete VAULTS[p[0]]; return [{}]; }
  if (sql.startsWith('INSERT INTO suggestions')) { SUGG.push({ id: ++sid, title: p[0], details: p[1], lang: p[2], status: 'pending', votes: 0, created_at: now() }); return [{ insertId: sid }]; }
  if (sql.includes("FROM suggestions WHERE status IN ('open','planned','done')")) return [SUGG.filter(x => ['open','planned','done'].includes(x.status)).sort((a, b) => b.votes - a.votes)];
  if (sql.includes("FROM suggestions ORDER BY FIELD(status,'pending')")) return [[...SUGG].reverse()];
  if (sql.startsWith('UPDATE suggestions SET votes')) { const x = SUGG.find(x => x.id === p[1] && ['open','planned'].includes(x.status)); if (x) x.votes = Math.max(0, x.votes + p[0]); return [{ affectedRows: x ? 1 : 0 }]; }
  if (sql.startsWith('SELECT votes FROM suggestions')) return [SUGG.filter(x => x.id === p[0]).map(x => ({ votes: x.votes }))];
  if (sql.startsWith('UPDATE suggestions SET status')) { const x = SUGG.find(x => x.id === p[1]); if (x) x.status = p[0]; return [{ affectedRows: x ? 1 : 0 }]; }
  if (sql.startsWith('DELETE FROM suggestions')) { const i = SUGG.findIndex(x => x.id === p[0]); if (i >= 0) SUGG.splice(i, 1); return [{ affectedRows: 1 }]; }
  if (sql.startsWith('SELECT bytes FROM speed_usage')) return [SPEED[p[0]] ? [{ bytes: SPEED[p[0]].bytes }] : []];
  if (sql.startsWith('INSERT INTO speed_usage')) { const r = SPEED[p[0]] = SPEED[p[0]] || { bytes: 0, tests: 0 }; r.bytes += p[1]; r.tests += p[2]; return [{}]; }
  const sec = (id) => secrets.find(x => x.id === id);
  if (sql.startsWith('INSERT INTO secrets')) { secrets.push({ id: p[0], payload: p[1], salt: p[2], verifier_hash: p[3], burn_hash: p[4], user_id: p[5], expires_at: p[6], attempts: 0, created_at: now(), viewed_at: null, burned_at: null }); return [{}]; }
  if (/^SELECT .* FROM secrets WHERE id = \?/.test(sql)) { const x = sec(p[0]); return [x ? [{ ...x }] : []]; }
  if (sql.startsWith('UPDATE secrets SET attempts = ?, payload = NULL')) { const x = sec(p[1]); x.attempts = p[0]; x.payload = null; x.burned_at = now(); return [{}]; }
  if (sql.startsWith('UPDATE secrets SET attempts = ?')) { sec(p[1]).attempts = p[0]; return [{}]; }
  if (sql.startsWith('UPDATE secrets SET payload = NULL, viewed_at')) { const x = sec(p[0]); x.payload = null; x.viewed_at = now(); return [{}]; }
  if (sql.startsWith('UPDATE secrets SET payload = NULL, burned_at')) { const x = sec(p[0]); if (!x.viewed_at && !x.burned_at) { x.payload = null; x.burned_at = now(); } return [{}]; }
  if (/FROM secrets WHERE user_id = \?/.test(sql)) return [secrets.filter(x => x.user_id === p[0]).map(x => ({ ...x, has_pw: x.verifier_hash ? 1 : 0 }))];
  if (sql.startsWith('UPDATE secrets SET payload = NULL WHERE payload IS NOT NULL')) { secrets.forEach(x => { if (x.expires_at <= now()) x.payload = null; }); return [{}]; }
  if (sql.startsWith('DELETE FROM secrets')) return [{}];
  if (sql === '__expire__') { secrets.forEach(x => x.expires_at = new Date(Date.now() - 1000)); return [{}]; }
  if (sql.startsWith('INSERT INTO users')) {
    if (users.some(u => u.username === p[0] || u.email === p[1])) { const e = new Error('dup'); e.code = 'ER_DUP_ENTRY'; throw e; }
    users.push({ id: ++uid, username: p[0], email: p[1], password: p[2], verified: 0, token_version: 0, totp_enabled: 0, totp_secret_enc: null, totp_pending_enc: null, totp_last_step: 0, created_at: now() }); return [{ insertId: uid }];
  }
  if (sql.startsWith('UPDATE tokens SET used = 1 WHERE user_id')) { tokens.forEach(t => { if (t.user_id === p[0] && t.type === p[1]) t.used = 1; }); return [{}]; }
  if (sql.startsWith('INSERT INTO tokens')) { tokens.push({ id: ++tid, user_id: p[0], token: p[1], type: p[2], expires_at: p[3], used: 0, created_at: now() }); return [{}]; }
  if (sql.startsWith('SELECT id, user_id FROM tokens')) return [tokens.filter(t => t.token === p[0] && t.type === p[1] && !t.used && t.expires_at > now())];
  if (sql.startsWith('UPDATE tokens SET used = 1 WHERE id')) { const t = tokens.find(t => t.id === p[0] && !t.used); if (t) t.used = 1; return [{ affectedRows: t ? 1 : 0 }]; }
  if (sql.startsWith('UPDATE users SET verified')) { const u = users.find(u => u.id === p[0]); if (u) u.verified = 1; return [{ affectedRows: u ? 1 : 0 }]; }
  if (sql.startsWith('UPDATE users SET password')) { const u = users.find(u => u.id === p[1]); u.password = p[0]; if (sql.includes('token_version')) u.token_version++; return [{ affectedRows: 1 }]; }
  if (sql.startsWith('UPDATE users SET token_version')) { users.find(u => u.id === p[0]).token_version++; return [{}]; }
  if (sql.startsWith('DELETE FROM secrets WHERE user_id')) { for (let i = secrets.length - 1; i >= 0; i--) if (secrets[i].user_id === p[0]) secrets.splice(i, 1); return [{}]; }
  if (sql.startsWith('DELETE FROM users')) { const i = users.findIndex(u => u.id === p[0]); if (i >= 0) users.splice(i, 1); return [{ affectedRows: i >= 0 ? 1 : 0 }]; }
  if (/FROM users WHERE email = \?/.test(sql)) return [users.filter(u => u.email === p[0])];
  if (/FROM users WHERE username = \?/.test(sql)) return [users.filter(u => u.username === p[0])];
  if (/FROM users WHERE id = \?/.test(sql)) return [users.filter(u => u.id === p[0]).map(u => ({ ...u }))];
  if (/FROM users ORDER BY/.test(sql)) return [[...users].reverse()];
  if (/FROM tokens t JOIN users/.test(sql)) return [tokens.map(t => ({ ...t, username: users.find(u => u.id === t.user_id)?.username }))];
  throw new Error('unhandled SQL: ' + sql);
}
const origLoad = Module._load;
Module._load = function (req, ...rest) {
  if (req === 'mysql2/promise') return { createPool: () => ({ execute, query: execute, getConnection: async () => ({ execute, beginTransaction: async () => {}, commit: async () => {}, rollback: async () => {}, release() {} }) }) };
  if (req === 'nodemailer') return { createTransport: () => ({ sendMail: async m => { global.SENT.push(m); } }) };
  return origLoad.call(this, req, ...rest);
};
process.env.JWT_SECRET = 'x'.repeat(48); process.env.PORT = '8899'; process.env.NODE_ENV = 'development';
process.env.STATIC_DIR = '../dist'; process.env.ADMIN_USER_IDS = '1'; process.env.TOTP_ENC_KEY = require('crypto').randomBytes(32).toString('hex'); process.env.SITE_URL = 'http://localhost:8899'; process.env.MAIL_FROM_ADDRESS = 'no-reply@test';
require(process.argv[2] || require('path').resolve(__dirname, '../server/server.js'));
// expose sent mail for the test client
require('http').createServer((q, s) => { if (q.url === '/vaultdump') return s.end(JSON.stringify({ VAULTS, VITEMS })); if (q.url === '/speed') return s.end(JSON.stringify(SPEED)); if (q.url === '/expire') { execute('__expire__'); return s.end('ok'); } s.end(JSON.stringify(global.SENT.map(m => ({ to: m.to, subject: m.subject, text: m.text })))); }).listen(8898);
