// Share-preview images (Open Graph) for every public page, in English and Arabic.
//   python3 build.py && node tests/harness.js &   # the site must be served on :8899
//   node tools/og.js                               # writes src/og/<page>.jpg and src/og/ar/<page>.jpg
// Then run build.py again so the pages point at their own image. Re-run this after changing a title or lede.
const fs = require('fs'), path = require('path');
const { chromium } = require(path.join(__dirname, '../tests/node_modules/playwright-core'));
const ROOT = path.join(__dirname, '..'), DIST = path.join(ROOT, 'dist'), OUT = path.join(ROOT, 'src/og');
const B = process.env.B || 'http://localhost:8899';

const MARK = '<svg viewBox="0 0 32 32"><rect x="1" y="1" width="30" height="30" rx="9" fill="#f1efe8"/><path d="M8.5 16.8l4.6 4.6L23.5 10.6" fill="none" stroke="#7ee2b0" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const CHECK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>';
const CHIPS = { en: ['Free', 'No ads, no tracking', 'Works on your device'], ar: ['مجاني', 'بدون إعلانات ولا تتبّع', 'يشتغل على جهازك'] };

function pages() {
  const out = [];
  (function walk(dir) {
    for (const f of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, f.name);
      if (f.isDirectory()) { if (!['assets', 'og', 'widgets'].includes(f.name)) walk(p); }
      else if (f.name === 'index.html') {
        const html = fs.readFileSync(p, 'utf8');
        if (/<meta name="robots" content="noindex/.test(html)) continue;
        const rel = path.relative(DIST, path.dirname(p)).split(path.sep).join('/');
        const ar = rel === 'ar' || rel.startsWith('ar/');
        const slug = (ar ? rel.replace(/^ar\/?/, '') : rel) || 'home';
        out.push({ url: '/' + (rel ? rel + '/' : ''), key: (ar ? 'ar/' : '') + slug, ar });
      }
    }
  })(DIST);
  return out;
}

const css = (ar) => `
@font-face{font-family:Geist;src:url(/assets/fonts/geist-normal-300-700-latin.woff2) format('woff2');font-weight:300 700}
@font-face{font-family:'Instrument Serif';src:url(/assets/fonts/instrument-serif-normal-400-latin.woff2) format('woff2')}
@font-face{font-family:'Instrument Serif';font-style:italic;src:url(/assets/fonts/instrument-serif-italic-400-latin.woff2) format('woff2')}
@font-face{font-family:Plex;font-weight:400;src:url(/assets/fonts/ibm-plex-sans-arabic-normal-400-arabic.woff2) format('woff2')}
@font-face{font-family:Plex;font-weight:700;src:url(/assets/fonts/ibm-plex-sans-arabic-normal-700-arabic.woff2) format('woff2')}
@font-face{font-family:Plex;font-weight:400;src:url(/assets/fonts/ibm-plex-sans-arabic-normal-400-latin.woff2) format('woff2');unicode-range:U+0000-00FF}
@font-face{font-family:Plex;font-weight:700;src:url(/assets/fonts/ibm-plex-sans-arabic-normal-700-latin.woff2) format('woff2');unicode-range:U+0000-00FF}
*{box-sizing:border-box;margin:0}
html,body{width:1200px;height:630px;overflow:hidden}
body{position:relative;background:#0b0c0b;color:#f1efe8;font-family:${ar ? 'Plex,' : ''}Geist,sans-serif;padding:60px 76px}
.bg{position:absolute;inset:0;background:radial-gradient(900px 520px at ${ar ? '100%' : '0%'} 0%,rgba(126,226,176,.18),transparent 60%),radial-gradient(700px 500px at ${ar ? '0%' : '100%'} 100%,rgba(232,201,138,.10),transparent 60%)}
.grid{position:absolute;inset:0;background-image:linear-gradient(rgba(255,255,255,.035) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.035) 1px,transparent 1px);background-size:60px 60px;mask-image:radial-gradient(ellipse at 30% 30%,#000,transparent 75%)}
.wrap{position:relative;height:100%;display:flex;flex-direction:column}
.brand{display:flex;align-items:center;gap:14px;font-family:'Instrument Serif';font-size:38px;direction:ltr;align-self:flex-start}
.brand svg{width:46px;height:46px}.brand em{color:#7ee2b0}
.mid{flex:1;display:flex;align-items:center;gap:44px}
.ic{flex:none;width:132px;height:132px;border-radius:36px;display:grid;place-items:center;background:#7ee2b0;color:#0b0c0b;box-shadow:0 24px 60px -20px rgba(126,226,176,.55)}
.ic svg{width:66px;height:66px;stroke-width:1.6}
.t{font-family:${ar ? 'Plex' : "'Instrument Serif'"};font-weight:${ar ? 700 : 400};font-size:${ar ? 68 : 92}px;line-height:${ar ? 1.3 : 1};letter-spacing:${ar ? 0 : '-.01em'}}
.t em{color:#7ee2b0;font-style:${ar ? 'normal' : 'italic'}}
.l{margin-top:22px;font-size:${ar ? 29 : 28}px;line-height:1.45;color:#b9b7ae;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;max-width:880px}
.foot{display:flex;align-items:center;gap:12px}
.chip{display:inline-flex;align-items:center;gap:8px;height:44px;padding:0 18px;border-radius:999px;border:1px solid rgba(255,255,255,.14);background:rgba(255,255,255,.04);font-size:${ar ? 21 : 20}px;color:#d9d7cf}
.chip svg{width:18px;height:18px;color:#7ee2b0}
.dom{margin-inline-start:auto;font-size:21px;color:#8d8b84;direction:ltr;font-family:Geist}`;

function template(d, ar) {
  return `<!doctype html><html lang="${ar ? 'ar' : 'en'}" dir="${ar ? 'rtl' : 'ltr'}"><head><meta charset="utf-8"><style>${css(ar)}</style></head><body>
<div class="bg"></div><div class="grid"></div>
<div class="wrap">
  <div class="brand">${MARK}<span>nicely<em>done</em></span></div>
  <div class="mid"><div class="ic">${d.icon || CHECK}</div><div><h1 class="t">${d.title}</h1>${d.lede ? `<p class="l">${d.lede}</p>` : ''}</div></div>
  <div class="foot">${CHIPS[ar ? 'ar' : 'en'].map((c) => `<span class="chip">${CHECK}${c}</span>`).join('')}<span class="dom">nicelydone.qd.je</span></div>
</div></body></html>`;
}

(async () => {
  const br = await chromium.launch({ executablePath: require(path.join(__dirname, '../tests/chrome')) });
  const ctx = await br.newContext({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1, reducedMotion: 'reduce', serviceWorkers: 'block' });
  const p = await ctx.newPage();
  let html = '';
  await p.route('**/__og', (r) => r.fulfill({ contentType: 'text/html; charset=utf-8', body: html }));
  const list = pages(); let n = 0;
  for (const pg of list) {
    await p.goto(B + pg.url, { waitUntil: 'domcontentloaded' });
    const d = await p.evaluate(() => {
      const h = document.querySelector('.tool-hero h1, .hero h1, main h1');
      const clone = h ? h.cloneNode(true) : document.createElement('h1');
      clone.querySelectorAll('svg').forEach((s) => s.remove());
      const keep = (el) => { // only text and <em> survive
        let s = ''; el.childNodes.forEach((n) => { s += n.nodeType === 3 ? n.textContent.replace(/[<>&]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c])) : n.nodeName === 'EM' ? '<em>' + keep(n) + '</em>' : n.nodeName === 'BR' ? '<br>' : keep(n); }); return s; };
      const lede = document.querySelector('.tool-hero .lede, .hero .lede, main .lede');
      const ic = document.querySelector('.tool-hero .tool-ic svg');
      return { title: keep(clone).replace(/\s+/g, ' ').trim(), lede: lede ? lede.textContent.replace(/\s+/g, ' ').trim().replace(/[<>&]/g, '') : '', icon: ic ? ic.outerHTML : '' };
    });
    html = template(d, pg.ar);
    await p.goto(B + '/__og'); await p.evaluate(() => document.fonts.ready);
    const file = path.join(OUT, pg.key + '.jpg');
    fs.mkdirSync(path.dirname(file), { recursive: true });
    await p.screenshot({ path: file, type: 'jpeg', quality: 86 });
    n++;
  }
  console.log(`wrote ${n} images to src/og/`);
  await br.close();
})().catch((e) => { console.error(e); process.exit(1); });
