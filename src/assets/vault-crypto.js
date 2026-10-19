/* Nicely Done — zero-knowledge vault cryptography (runs only in the browser).
 *
 *   vault key  = 256 random bits; encrypts every item with AES-256-GCM (AAD "nd-vault-v1")
 *   passphrase → PBKDF2-SHA256 (600,000 rounds, 128-bit salt) → wraps the vault key
 *   recovery key = 256 random bits shown once as 13 groups of 4 (base32) → also wraps the vault key
 * The server stores only the wrapped keys and item ciphertext. Losing both the passphrase and the
 * recovery key means the vault cannot be opened by anyone — including us.
 */
(function () {
  'use strict';
  const subtle = crypto.subtle, te = new TextEncoder(), td = new TextDecoder();
  const AAD = te.encode('nd-vault-v1'), WRAP_AAD = te.encode('nd-vault-key-v1');
  const ITER = 600000;
  const rand = (n) => crypto.getRandomValues(new Uint8Array(n));
  const b64u = {
    enc(b) { let s = ''; b = new Uint8Array(b); for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode.apply(null, b.subarray(i, i + 0x8000)); return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); },
    dec(s) { const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4)); return Uint8Array.from(bin, (c) => c.charCodeAt(0)); },
  };
  const B32 = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no I, O, 0, 1 — easy to read and type
  const rk = {
    enc(bytes) { let bits = 0, v = 0, out = ''; for (const b of bytes) { v = (v << 8) | b; bits += 8; while (bits >= 5) { out += B32[(v >>> (bits - 5)) & 31]; bits -= 5; } } if (bits) out += B32[(v << (5 - bits)) & 31]; return out.match(/.{1,4}/g).join('-'); },
    dec(str) { const s = str.toUpperCase().replace(/[^A-Z0-9]/g, ''); let bits = 0, v = 0; const out = [];
      for (const c of s) { const i = B32.indexOf(c); if (i < 0) return null; v = (v << 5) | i; bits += 5; if (bits >= 8) { out.push((v >>> (bits - 8)) & 255); bits -= 8; } }
      return out.length >= 32 ? Uint8Array.from(out.slice(0, 32)) : null; },
  };

  async function passKey(passphrase, salt, iterations) {
    const base = await subtle.importKey('raw', te.encode(passphrase.normalize('NFC')), 'PBKDF2', false, ['deriveKey']);
    return subtle.deriveKey({ name: 'PBKDF2', salt, iterations, hash: 'SHA-256' }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
  }
  const rawKey = (bytes) => subtle.importKey('raw', bytes, 'AES-GCM', false, ['encrypt', 'decrypt']);
  async function wrap(kek, vk) { const iv = rand(12); return b64u.enc(iv) + '.' + b64u.enc(await subtle.encrypt({ name: 'AES-GCM', iv, additionalData: WRAP_AAD }, kek, vk)); }
  async function unwrap(kek, wrapped) { const [iv, ct] = wrapped.split('.'); return new Uint8Array(await subtle.decrypt({ name: 'AES-GCM', iv: b64u.dec(iv), additionalData: WRAP_AAD }, kek, b64u.dec(ct))); }

  /* An unlocked vault session: holds the vault key in memory only. */
  function Session(vkBytes) { this._vk = vkBytes; this._key = null; }
  Session.prototype.key = async function () { if (!this._key) this._key = await rawKey(this._vk); return this._key; };
  Session.prototype.encrypt = async function (obj) {
    const iv = rand(12), pt = te.encode(JSON.stringify(obj));
    return b64u.enc(iv) + '.' + b64u.enc(await subtle.encrypt({ name: 'AES-GCM', iv, additionalData: AAD }, await this.key(), pt));
  };
  Session.prototype.decrypt = async function (data) {
    const [iv, ct] = data.split('.');
    return JSON.parse(td.decode(await subtle.decrypt({ name: 'AES-GCM', iv: b64u.dec(iv), additionalData: AAD }, await this.key(), b64u.dec(ct))));
  };
  /* New wrapped keys for a new passphrase (and, optionally, a fresh recovery key). */
  Session.prototype.rewrap = async function (passphrase, newRecovery) {
    const salt = rand(16), out = { kdf_salt: b64u.enc(salt), kdf_iterations: ITER, wrapped_pass: await wrap(await passKey(passphrase, salt, ITER), this._vk) };
    if (newRecovery) { const r = rand(32); out.wrapped_recov = await wrap(await rawKey(r), this._vk); out.recoveryKey = rk.enc(r); }
    return out;
  };
  Session.prototype.close = function () { if (this._vk) this._vk.fill(0); this._vk = null; this._key = null; };

  window.NDVault = {
    ITER,
    /* Create a brand-new vault: returns the server payload, the recovery key to show once, and an open session. */
    async create(passphrase) {
      const vk = rand(32), salt = rand(16), r = rand(32);
      const payload = {
        kdf_salt: b64u.enc(salt), kdf_iterations: ITER,
        wrapped_pass: await wrap(await passKey(passphrase, salt, ITER), vk),
        wrapped_recov: await wrap(await rawKey(r), vk),
      };
      return { payload, recoveryKey: rk.enc(r), session: new Session(vk.slice()) };
    },
    async unlock(meta, passphrase) {
      try { return new Session(await unwrap(await passKey(passphrase, b64u.dec(meta.kdf_salt), meta.kdf_iterations), meta.wrapped_pass)); }
      catch (e) { return null; }
    },
    async unlockWithRecovery(meta, recoveryKey) {
      const bytes = rk.dec(recoveryKey); if (!bytes) return null;
      try { return new Session(await unwrap(await rawKey(bytes), meta.wrapped_recov)); } catch (e) { return null; }
    },
    newId() { return b64u.enc(rand(16)); },
  };
})();
