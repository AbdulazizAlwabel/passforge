// Share-preview images (Open Graph) for every public page, in English and Arabic.
//   python3 build.py && node tests/harness.js &   # the site must be served on :8899
//   node tools/og.js                               # writes src/og/<page>.jpg and src/og/ar/<page>.jpg
// Then run build.py again so the pages point at their own image. Re-run this after changing a title or lede.
const fs = require('fs'), path = require('path');
const { chromium } = require(path.join(__dirname, '../tests/node_modules/playwright-core'));
const ROOT = path.join(__dirname, '..'), DIST = path.join(ROOT, 'dist'), OUT = path.join(ROOT, 'src/og');
const B = process.env.B || 'http://localhost:8899';

const MARK = '<svg viewBox="0 0 32 32"><rect x="5" y="2.5" width="22" height="27" rx="6" fill="#f5f7ff"/><path d="M5.9 9v14" stroke="#ff4d6d" stroke-width="1.8" stroke-linecap="round"/><path d="M26.1 9v14" stroke="#3ee6c1" stroke-width="1.8" stroke-linecap="round"/><path d="M10.8 16.6l3.7 3.7 6.9-7.6" fill="none" stroke="#06070c" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';
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

// Prism: the ink stage, the sentence on one side and the sealed glass (the shader's own still frame) on the other.
const css = (ar) => `
@font-face{font-family:FD;src:url(/assets/fonts/funnel-display-normal-300-800-latin.woff2) format('woff2');font-weight:300 800}
@font-face{font-family:FS;src:url(/assets/fonts/funnel-sans-normal-300-800-latin.woff2) format('woff2');font-weight:300 800}
@font-face{font-family:RP;src:url(/assets/fonts/readex-pro-normal-160-700-arabic.woff2) format('woff2');font-weight:160 700}
@font-face{font-family:RP;src:url(/assets/fonts/readex-pro-normal-160-700-latin.woff2) format('woff2');font-weight:160 700;unicode-range:U+0000-00FF}
@font-face{font-family:GM;src:url(/assets/fonts/geist-mono-normal-400-latin.woff2) format('woff2')}
*{box-sizing:border-box;margin:0}
html,body{width:1200px;height:630px;overflow:hidden}
body{position:relative;background:#06070c;color:#f5f7ff;font-family:${ar ? 'RP' : 'FS'},sans-serif;padding:56px 64px}
.glass{position:absolute;top:50%;${ar ? 'left' : 'right'}:-300px;height:740px;width:962px;transform:translateY(-50%)${ar ? ' scaleX(-1)' : ''}}
.wrap{position:relative;height:100%;display:flex;flex-direction:column;max-width:${ar ? 590 : 600}px}
.brand{display:flex;align-items:center;gap:13px;font-family:FD;font-weight:600;font-size:31px;letter-spacing:-.015em;direction:ltr;align-self:flex-start}
.brand svg{width:40px;height:40px}
.mid{flex:1;display:flex;flex-direction:column;justify-content:center}
.t{font-family:${ar ? 'RP' : 'FD'};font-weight:600;font-size:${ar ? 58 : 74}px;line-height:${ar ? 1.25 : .98};letter-spacing:${ar ? 0 : '-.04em'}}
.t em{font-style:normal;color:#6d7390}
.l{margin-top:22px;font-size:${ar ? 26 : 27}px;line-height:${ar ? 1.6 : 1.4};color:#aab0c8;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.foot{display:flex;align-items:center;gap:22px;font-size:${ar ? 20 : 19}px;color:#aab0c8;white-space:nowrap}
.chip{display:inline-flex;align-items:center;gap:8px}
.chip svg{width:17px;height:17px;color:#3ee6c1;stroke-width:2.4}
.dom{position:absolute;${ar ? 'left' : 'right'}:64px;bottom:56px;font-size:19px;color:#8a90ad;direction:ltr;font-family:GM}`;

function template(d, ar) {
  return `<!doctype html><html lang="${ar ? 'ar' : 'en'}" dir="${ar ? 'rtl' : 'ltr'}"><head><meta charset="utf-8"><style>${css(ar)}</style></head><body>
<img class="glass" src="/assets/prism-still.webp" alt="">
<div class="wrap">
  <div class="brand">${MARK}<span>Nicely Done</span></div>
  <div class="mid"><h1 class="t">${d.title}</h1>${d.lede ? `<p class="l">${d.lede}</p>` : ''}</div>
  <div class="foot">${CHIPS[ar ? 'ar' : 'en'].map((c) => `<span class="chip">${CHECK}${c}</span>`).join('')}</div>
</div>
<span class="dom">nicelydone.qd.je</span></body></html>`;
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
    await p.goto(B + '/__og'); await p.evaluate(() => Promise.all([document.fonts.ready, document.querySelector('.glass').decode().catch(() => {})]));
    if (pg.key === 'home') await p.screenshot({ path: path.join(ROOT, 'src/static/og.png'), type: 'png' });
    const file = path.join(OUT, pg.key + '.jpg');
    fs.mkdirSync(path.dirname(file), { recursive: true });
    await p.screenshot({ path: file, type: 'jpeg', quality: 86 });
    n++;
  }
  console.log(`wrote ${n} images to src/og/`);
  await br.close();
})().catch((e) => { console.error(e); process.exit(1); });
