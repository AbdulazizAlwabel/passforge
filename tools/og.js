// Share-preview images (Open Graph) for every public page, in English and Arabic.
//   python3 build.py && node tests/harness.js &   # the site must be served on :8899
//   node tools/og.js                               # writes src/og/<page>.jpg and src/og/ar/<page>.jpg
// Then run build.py again so the pages point at their own image. Re-run this after changing a title or lede.
const fs = require('fs'), path = require('path');
const { chromium } = require(path.join(__dirname, '../tests/node_modules/playwright-core'));
const ROOT = path.join(__dirname, '..'), DIST = path.join(ROOT, 'dist'), OUT = path.join(ROOT, 'src/og');
const B = process.env.B || 'http://localhost:8899';

const MARK = '<svg viewBox="0 0 32 32"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#5b4bea"/><stop offset=".55" stop-color="#8250ee"/><stop offset="1" stop-color="#c05be8"/></linearGradient></defs><rect width="32" height="32" rx="9" fill="url(#g)"/><path d="M9 16.6l4.7 4.7L23 11.4" fill="none" stroke="#fff" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
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
@font-face{font-family:Plex;font-weight:400;src:url(/assets/fonts/ibm-plex-sans-arabic-normal-400-arabic.woff2) format('woff2')}
@font-face{font-family:Plex;font-weight:700;src:url(/assets/fonts/ibm-plex-sans-arabic-normal-700-arabic.woff2) format('woff2')}
@font-face{font-family:Plex;font-weight:400;src:url(/assets/fonts/ibm-plex-sans-arabic-normal-400-latin.woff2) format('woff2');unicode-range:U+0000-00FF}
@font-face{font-family:Plex;font-weight:700;src:url(/assets/fonts/ibm-plex-sans-arabic-normal-700-latin.woff2) format('woff2');unicode-range:U+0000-00FF}
*{box-sizing:border-box;margin:0}
html,body{width:1200px;height:630px;overflow:hidden}
body{position:relative;background:#08080f;color:#f3f3fa;font-family:${ar ? 'Plex,' : ''}Geist,sans-serif;padding:60px 76px}
.bg{position:absolute;inset:0;background:radial-gradient(620px 460px at ${ar ? '100%' : '0%'} -10%,rgba(106,85,255,.55),transparent 70%),radial-gradient(560px 420px at ${ar ? '0%' : '100%'} -10%,rgba(224,85,159,.42),transparent 70%),radial-gradient(520px 380px at 55% 115%,rgba(47,143,230,.32),transparent 70%)}
.wrap{position:relative;height:100%;display:flex;flex-direction:column}
.brand{display:flex;align-items:center;gap:14px;font-family:Geist;font-weight:650;font-size:36px;letter-spacing:-.04em;direction:ltr;align-self:flex-start}
.brand svg{width:48px;height:48px}.brand em{font-style:normal;background:linear-gradient(100deg,#a9a2ff,#c890ff 45%,#ff8fc4);-webkit-background-clip:text;-webkit-text-fill-color:transparent}
.mid{flex:1;display:flex;align-items:center;gap:44px}
.ic{flex:none;width:132px;height:132px;border-radius:36px;display:grid;place-items:center;background:linear-gradient(140deg,#6657f0,#a25cf0);color:#fff;box-shadow:inset 0 2px 0 rgba(255,255,255,.35),0 30px 60px -20px rgba(118,92,240,.8)}
.ic svg{width:64px;height:64px;stroke-width:1.6}
.t{font-family:${ar ? 'Plex' : 'Geist'};font-weight:${ar ? 700 : 650};font-size:${ar ? 66 : 86}px;line-height:${ar ? 1.3 : 1.02};letter-spacing:${ar ? 0 : '-.045em'}}
.t em{font-style:normal;background:linear-gradient(100deg,#a9a2ff,#c890ff 45%,#ff8fc4);-webkit-background-clip:text;-webkit-text-fill-color:transparent;padding-bottom:.1em}
.l{margin-top:20px;font-size:${ar ? 29 : 28}px;line-height:1.45;color:#b0b1c8;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;max-width:880px}
.foot{display:flex;align-items:center;gap:12px}
.chip{display:inline-flex;align-items:center;gap:8px;height:46px;padding:0 18px;border-radius:999px;border:1px solid rgba(255,255,255,.14);background:rgba(255,255,255,.06);font-size:${ar ? 21 : 20}px;font-weight:500;color:#e6e6f2}
.chip svg{width:18px;height:18px;color:#5fd6a0;stroke-width:2.4}
.dom{margin-inline-start:auto;font-size:21px;color:#8a8ba6;direction:ltr;font-family:Geist}`;

function template(d, ar) {
  return `<!doctype html><html lang="${ar ? 'ar' : 'en'}" dir="${ar ? 'rtl' : 'ltr'}"><head><meta charset="utf-8"><style>${css(ar)}</style></head><body>
<div class="bg"></div>
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
    if (pg.key === 'home') await p.screenshot({ path: path.join(ROOT, 'src/static/og.png'), type: 'png' });
    const file = path.join(OUT, pg.key + '.jpg');
    fs.mkdirSync(path.dirname(file), { recursive: true });
    await p.screenshot({ path: file, type: 'jpeg', quality: 86 });
    n++;
  }
  console.log(`wrote ${n} images to src/og/`);
  await br.close();
})().catch((e) => { console.error(e); process.exit(1); });
