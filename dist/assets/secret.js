/* Nicely Done — end-to-end encryption for one-time secrets.
 *
 *   key      = 256 random bits, kept only in the link's #fragment
 *   password = optional; PBKDF2-SHA256 (600k) → 512 bits:
 *              first half is mixed into the AES key, second half is a verifier
 *              the server checks (as a SHA-256 hash) before releasing ciphertext.
 *   cipher   = AES-256-GCM, 96-bit random IV, AAD "nd-secret-v1"
 *   payload  = base64url(iv) "." base64url(ciphertext)
 */
(function () {
  'use strict';
  const subtle = crypto.subtle;
  const te = new TextEncoder(), td = new TextDecoder();
  const AAD = te.encode('nd-secret-v1');
  const ITER = 600000;

  const b64u = {
    enc(bytes) {
      let s = ''; bytes = new Uint8Array(bytes);
      for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
      return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    },
    dec(str) {
      const s = atob(str.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((str.length + 3) % 4));
      const out = new Uint8Array(s.length);
      for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
      return out;
    }
  };
  const rand = (n) => crypto.getRandomValues(new Uint8Array(n));
  const concat = (a, b) => { const o = new Uint8Array(a.length + b.length); o.set(a); o.set(b, a.length); return o; };

  async function fromPassword(password, salt) {
    const base = await subtle.importKey('raw', te.encode(password.normalize('NFC')), 'PBKDF2', false, ['deriveBits']);
    const bits = new Uint8Array(await subtle.deriveBits({ name: 'PBKDF2', salt, iterations: ITER, hash: 'SHA-256' }, base, 512));
    return { keyPart: bits.slice(0, 32), verifier: bits.slice(32) };
  }
  async function aesKey(raw, keyPart) {
    const material = keyPart ? new Uint8Array(await subtle.digest('SHA-256', concat(raw, keyPart))) : raw;
    return subtle.importKey('raw', material, 'AES-GCM', false, ['encrypt', 'decrypt']);
  }

  window.NDSecret = {
    b64u,
    /* Encrypt text. Returns what the server stores plus the key for the link. */
    async seal(text, password) {
      const raw = rand(32), iv = rand(12);
      let salt = null, pw = null;
      if (password) { salt = rand(16); pw = await fromPassword(password, salt); }
      const key = await aesKey(raw, pw && pw.keyPart);
      const ct = await subtle.encrypt({ name: 'AES-GCM', iv, additionalData: AAD }, key, te.encode(text));
      return {
        key: b64u.enc(raw),
        payload: b64u.enc(iv) + '.' + b64u.enc(ct),
        salt: salt ? b64u.enc(salt) : null,
        verifier: pw ? b64u.enc(pw.verifier) : null,
      };
    },
    /* Derive the verifier for a password before asking the server to reveal. */
    async verifier(password, salt) {
      const pw = await fromPassword(password, b64u.dec(salt));
      return { verifier: b64u.enc(pw.verifier), keyPart: pw.keyPart };
    },
    async open(payload, keyB64, keyPart) {
      const [ivS, ctS] = payload.split('.');
      const key = await aesKey(b64u.dec(keyB64), keyPart || null);
      const pt = await subtle.decrypt({ name: 'AES-GCM', iv: b64u.dec(ivS), additionalData: AAD }, key, b64u.dec(ctS));
      return td.decode(pt);
    },
    /* Link format: /s/#<id>.<key> — both parts stay client-side. */
    link(id, key) { return location.origin + '/s/#' + id + '.' + key; },
    parse(hash) {
      const m = String(hash || '').replace(/^#/, '').match(/^([A-Za-z0-9_-]{22})\.([A-Za-z0-9_-]{43})$/);
      return m ? { id: m[1], key: m[2] } : null;
    },
  };
})();
