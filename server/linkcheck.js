/* Link safety checks against open threat feeds — without ever seeing the link.
 *
 * Every 30 minutes the server downloads public blocklists and indexes the SHA-256
 * of each listed domain and URL by its first 5 hex characters. The browser hashes
 * the link it wants to check, sends only those 5-character prefixes, and compares
 * the returned full hashes itself (k-anonymity, like the leaked-password check).
 * The server never learns which link was checked.
 */
const crypto = require('crypto');

const FEEDS = [
  // abuse.ch has required a free Auth-Key since June 2025 — the feed is used only when URLHAUS_AUTH_KEY is set
  { id: 'urlhaus', name: 'URLhaus (abuse.ch)', kind: 'url', threat: 'malware', url: (k) => `https://urlhaus-api.abuse.ch/v2/files/exports/${k}/online.csv`, csv: 3, key: 'URLHAUS_AUTH_KEY' },
  { id: 'openphish', name: 'OpenPhish', kind: 'url', threat: 'phishing', url: 'https://openphish.com/feed.txt' },
  { id: 'phishdb', name: 'Phishing.Database', kind: 'domain', threat: 'phishing', url: 'https://raw.githubusercontent.com/Phishing-Database/Phishing.Database/master/phishing-domains-ACTIVE.txt' },
];
// Never flag these even if a feed lists them (shared hosting / major platforms).
const NEVER = new Set(['google.com', 'docs.google.com', 'sites.google.com', 'drive.google.com', 'forms.gle', 'github.com', 'github.io',
  'microsoft.com', 'live.com', 'office.com', 'sharepoint.com', 'apple.com', 'icloud.com', 'amazon.com', 'amazonaws.com',
  'cloudflare.com', 'pages.dev', 'workers.dev', 'vercel.app', 'netlify.app', 'web.app', 'firebaseapp.com', 'gov.sa', 'com.sa',
  'whatsapp.com', 'facebook.com', 'instagram.com', 'x.com', 'twitter.com', 'linkedin.com', 'youtube.com', 'dropbox.com', 'wa.me', 't.me',
  // shorteners and shared hosting: only specific listed links/subdomains count, never the whole platform
  'bit.ly', 'tinyurl.com', 'cutt.ly', 'is.gd', 'rb.gy', 't.co', 'goo.gl', 'ow.ly', 's.id', 't.ly', 'shorturl.at', 'linktr.ee', 'rebrand.ly', 'tiny.cc', 'v.gd',
  'blogspot.com', 'wixsite.com', 'weebly.com', 'square.site', 'godaddysites.com', 'webflow.io', 'glitch.me', 'herokuapp.com', 'onrender.com',
  'ngrok.io', 'ngrok-free.app', '000webhostapp.com', 'firebaseio.com', 'appspot.com', 'azurewebsites.net', 'cloudfront.net', 'r2.dev',
  'ipfs.io', 'notion.site', 'canva.site', 'my.canva.site', 'wordpress.com', 'myshopify.com', 'carrd.co', 'surge.sh', 'replit.app', 'repl.co']);
const REFRESH_MS = 30 * 60 * 1000;

const sha = (s) => crypto.createHash('sha256').update(s).digest('hex');
/* Canonical forms — must match the browser exactly (see link-checker page). */
const normHost = (h) => h.toLowerCase().replace(/\.$/, '').replace(/^www\./, '');
function normUrl(raw) {
  try {
    const u = new URL(raw.trim());
    if (!/^https?:$/.test(u.protocol)) return null;
    return normHost(u.hostname) + (u.port ? ':' + u.port : '') + (u.pathname.replace(/\/+$/, '') || '') + u.search;
  } catch { return null; }
}

const HEAD = 16; // keep the first 64 bits of each SHA-256 — collisions are ~1 in 10^19

module.exports = function mountLinkcheck(api, { limiter }) {
  // only feeds we can actually download are used — and listed (never claim a source we don't check)
  const ACTIVE = FEEDS.filter((f) => !f.key || process.env[f.key]);
  // Sorted array of "<16 hex><feed index>" strings: compact, and prefix lookups are a binary search.
  let entries = [];
  let stats = { updated: null, counts: {} };

  async function refresh() {
    const keys = new Set(); const counts = {};
    for (let fi = 0; fi < ACTIVE.length; fi++) {
      const f = ACTIVE[fi];
      try {
        const res = await fetch(typeof f.url === 'function' ? f.url(process.env[f.key]) : f.url, { signal: AbortSignal.timeout(60000), headers: Object.assign({ 'User-Agent': 'nicelydone-linkcheck/1.0 (+https://nicelydone.qd.je/link-checker/)' }, f.key ? { 'Auth-Key': process.env[f.key] } : {}) });
        if (!res.ok) throw new Error('HTTP ' + res.status);
        const text = await res.text();
        let n = 0;
        for (const line of text.split('\n')) {
          // CSV feeds: take the address from the given column (rows look like "id","date","url",…)
          const v = f.csv ? ((line.match(/"([^"]*)"/g) || [])[f.csv - 1] || '').slice(1, -1) : line.trim();
          if (!v || v.startsWith('#')) continue;
          let key;
          if (f.kind === 'domain') {
            const h = normHost(v);
            if (!/^[a-z0-9.-]+\.[a-z]{2,}$/.test(h) || NEVER.has(h)) continue;
            key = 'd:' + h;
          } else {
            const u = normUrl(v);
            if (!u || NEVER.has(u.split(/[/:?]/)[0])) continue;
            key = 'u:' + u;
          }
          keys.add(sha(key).slice(0, HEAD) + fi); n++;
        }
        counts[f.id] = n;
      } catch (e) {
        console.error('[linkcheck] feed', f.id, 'failed:', e.message);
        counts[f.id] = stats.counts[f.id] || 0;
        for (const e2 of entries) if (+e2.slice(HEAD) === fi) keys.add(e2);   // keep previous entries for this feed
      }
    }
    entries = [...keys].sort();
    stats = { updated: new Date().toISOString(), counts };
    console.log('[linkcheck] index ready:', JSON.stringify(counts), entries.length, 'hashes');
  }
  refresh();
  setInterval(refresh, REFRESH_MS).unref();

  function lookup(prefix) {
    let lo = 0, hi = entries.length;
    while (lo < hi) { const mid = (lo + hi) >> 1; if (entries[mid] < prefix) lo = mid + 1; else hi = mid; }
    const out = [];
    for (let i = lo; i < entries.length && entries[i].startsWith(prefix); i++) out.push([entries[i].slice(0, HEAD), ACTIVE[+entries[i].slice(HEAD)].id]);
    return out;
  }

  const lim = limiter({ windowMs: 10 * 60 * 1000, max: 120 });
  api.get('/linkcheck', lim, (req, res) => {
    const prefixes = String(req.query.p || '').split(',').filter((p) => /^[0-9a-f]{5}$/.test(p)).slice(0, 24);
    const matches = {};
    for (const p of prefixes) matches[p] = lookup(p);
    res.set('Cache-Control', 'no-store');
    res.json({
      matches, updated: stats.updated, ready: !!stats.updated, head: HEAD,
      // a feed that loaded nothing (down, or the key not working yet) isn't named as a source
      feeds: ACTIVE.filter((f) => stats.counts[f.id] > 0).map((f) => ({ id: f.id, name: f.name, threat: f.threat, entries: stats.counts[f.id] })),
    });
  });
};
