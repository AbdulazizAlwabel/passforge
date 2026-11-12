// node sweep.js [widths] [langs] — every page on a phone: things cut off by the screen edge, clipped labels,
// small tap targets, popovers that leave the screen, script errors. One page at a time to stay light on memory.
const { chromium } = require('playwright-core');
const fs = require('fs'), path = require('path');
const B = process.env.B || 'http://localhost:8899', DIST = path.resolve(__dirname, '../../dist');
const widths = (process.argv[2] || '375,390,430').split(',').map(Number), langs = (process.argv[3] || 'en,ar').split(',');
const pages = ['/'].concat(fs.readdirSync(DIST).filter((d) => fs.existsSync(path.join(DIST, d, 'index.html')) && d !== 'ar').map((d) => '/' + d + '/'));

const { audit, popAudit } = require('./audit.js');
// The audit lives in audit.js so the in-use sweep (states.js) can share it.
(async () => {
  const br = await chromium.launch({ executablePath: require('../chrome.js') });
  const seen = new Map();
  for (const w of widths) for (const lang of langs) {
    const ctx = await br.newContext({ viewport: { width: w, height: 760 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2, serviceWorkers: 'block' });
    await ctx.addInitScript(() => { try { localStorage.setItem('nd:seen', '1'); localStorage.setItem('nd:lang-choice', '1'); } catch (e) {} });
    const p = await ctx.newPage(); let errs = []; p.on('pageerror', (e) => errs.push(e.message));
    for (const pg of pages) {
      errs = []; const url = (lang === 'ar' ? '/ar' : '') + pg;
      await p.goto(B + url); await p.waitForTimeout(350);
      let found = await p.evaluate(audit);
      // open what can be opened without data: disclosure buttons and <details>
      const n = await p.evaluate(() => { let i = 0; document.querySelectorAll('main [aria-expanded="false"][aria-controls], main [aria-haspopup]').forEach((b) => { if (b.offsetParent) b.dataset.sw = String(i++); }); return i; });
      for (let i = 0; i < n; i++) {
        try { await p.tap(`[data-sw="${i}"]`, { timeout: 1500 }); await p.waitForTimeout(250);
          const sel = await p.evaluate((k) => { const b = document.querySelector(`[data-sw="${k}"]`), id = b.getAttribute('aria-controls'); return id ? '#' + id : (b.nextElementSibling && !b.nextElementSibling.hidden ? '[data-sw="' + k + '"] + *' : ''); }, i);
          if (sel) found = found.concat(await p.evaluate(popAudit, sel));
          found = found.concat((await p.evaluate(audit)).filter((x) => x.startsWith('EDGE') || x.startsWith('PAGE')).map((x) => x + ' (after opening a control)'));
          await p.keyboard.press('Escape'); await p.evaluate(() => document.querySelectorAll('dialog[open]').forEach((d) => d.close()));
        } catch (e) {}
      }
      for (const e of errs) found.push('ERROR ' + e.slice(0, 120));
      for (const f of [...new Set(found)]) { const k = pg + ' :: ' + f.replace(/ -?\d+→-?\d+.*$/, '').replace(/ \d+×\d+$/, ''); if (!seen.has(k)) seen.set(k, []); seen.get(k).push(lang + w + (/\d/.test(f.slice(-6)) ? ' ' + f.split(' ').slice(-1)[0] : '')); }
    }
    await ctx.close();
  }
  await br.close();
  const rows = [...seen.entries()].sort();
  for (const [k, where] of rows) console.log(k, ' [' + where.join(', ') + ']');
  console.log('\n' + rows.length + ' distinct findings on ' + pages.length + ' pages × ' + langs.length + ' languages × ' + widths.length + ' widths');
})();
