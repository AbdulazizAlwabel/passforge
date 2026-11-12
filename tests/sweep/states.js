// node states.js [widths] [langs] [pages] — use every tool on a phone: fill the fields with awkward text, press the
// buttons, and after each step look for anything that leaves the screen.
const { chromium } = require('playwright-core');
const fs = require('fs'), path = require('path'); const { audit, popAudit } = require('./audit.js');
const B = process.env.B || 'http://localhost:8899', DIST = path.resolve(__dirname, '../../dist');
const widths = (process.argv[2] || '375').split(',').map(Number), langs = (process.argv[3] || 'en,ar').split(',');
const SKIP = new Set(['admin', 'profile', 'reset-password', 's', 'pdf-studio', 'merge-pdf', 'split-pdf', 'jpg-to-pdf', 'sign-pdf', 'add-page-numbers', 'watermark-pdf', 'compress-pdf', 'protect-pdf', 'unlock-pdf', 'redact-pdf', 'ocr-pdf', 'pdf-to-jpg', 'speed-test']);
const pages = (process.argv[4] ? process.argv[4].split(',') : fs.readdirSync(DIST).filter((d) => fs.existsSync(path.join(DIST, d, 'index.html')) && d !== 'ar' && !SKIP.has(d))).map((d) => '/' + d + '/');
const LONG = 'Hello مرحبا 123 averyveryveryverylongunbrokenstringtotestwrapping0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
(async () => {
  const br = await chromium.launch({ executablePath: require('../chrome.js') });
  const seen = new Map(); const note = (pg, f, where) => { const k = pg + ' :: ' + f.replace(/ -?\d+→-?\d+.*$/, '').replace(/ \d+×\d+$/, ''); if (!seen.has(k)) seen.set(k, new Set()); seen.get(k).add(where); };
  for (const w of widths) for (const lang of langs) {
    const ctx = await br.newContext({ viewport: { width: w, height: 760 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2, serviceWorkers: 'block' });
    await ctx.addInitScript(() => { try { localStorage.setItem('nd:seen', '1'); localStorage.setItem('nd:lang-choice', '1'); } catch (e) {} });
    await ctx.grantPermissions(['clipboard-read', 'clipboard-write']).catch(() => {});
    const p = await ctx.newPage(); let errs = []; p.on('pageerror', (e) => errs.push(e.message)); p.on('dialog', (d) => d.dismiss().catch(() => {}));
    for (const pg of pages) {
      errs = []; const url = (lang === 'ar' ? '/ar' : '') + pg, where = lang + w;
      await p.goto(B + url); await p.waitForTimeout(350);
      const check = async (step) => { for (const f of await p.evaluate(audit)) if (!f.startsWith('SMALL') || step === 'load') note(pg, f + (step === 'load' ? '' : ' (after ' + step + ')'), where);
        for (const f of await p.evaluate(popAudit, 'dialog[open]')) note(pg, f + ' (after ' + step + ')', where); };
      // fill
      const fields = await p.evaluate((LONG) => { let i = 0; const out = []; document.querySelectorAll('main input, main textarea').forEach((el) => { if (!el.offsetParent || el.disabled || el.readOnly || ['checkbox', 'radio', 'range', 'file', 'hidden', 'color'].includes(el.type)) return; el.dataset.sf = String(i);
          const t = el.type, hint = (el.id + ' ' + el.name + ' ' + (el.placeholder || '') + ' ' + (el.inputMode || '')).toLowerCase();
          out.push([i++, t === 'number' || /numeric|decimal/.test(hint) ? '123456789.5' : t === 'email' || /email|from/.test(hint) ? 'security-alerts@accounts.very-long-bank-name-example.com' : t === 'url' || /url|link/.test(hint) ? 'https://absher-sa.info/verify/account/session?id=0123456789abcdef0123456789abcdef&next=home' : /ip|addr|cidr/.test(hint) ? '192.168.100.200/24' : t === 'password' ? 'correct horse battery staple 2026!' : t === 'date' ? '2026-11-12' : LONG]); }); return out; }, LONG);
      for (const [i, v] of fields) { try { await p.fill(`[data-sf="${i}"]`, v, { timeout: 1500 }); } catch (e) {} }
      await p.waitForTimeout(500); await check('typing');
      // press the buttons in the tool (not links, not sign-out/delete)
      const n = await p.evaluate(() => { let i = 0; document.querySelectorAll('main .tool button, main form button, main .seg button, main [role="tab"]').forEach((b) => { if (!b.offsetParent || b.disabled || /delete|sign out|احذف|خروج/i.test(b.textContent)) return; b.dataset.sb = String(i++); }); return Math.min(i, 30); });
      for (let i = 0; i < n; i++) {
        try { const b = p.locator(`[data-sb="${i}"]`); if (!(await b.isVisible())) continue; const label = ((await b.getAttribute('aria-label')) || (await b.textContent()) || '').trim().replace(/\s+/g, ' ').slice(0, 20);
          await b.tap({ timeout: 1200 }); await p.waitForTimeout(280); await check('“' + label + '”');
          if (await p.evaluate(() => !!document.querySelector('dialog[open]'))) { await p.keyboard.press('Escape'); await p.evaluate(() => document.querySelectorAll('dialog[open]').forEach((d) => d.close())); }
          if (!p.url().includes(pg)) { await p.goto(B + url); await p.waitForTimeout(300); break; }
        } catch (e) {}
      }
      for (const e of errs) note(pg, 'ERROR ' + e.slice(0, 140), where);
    }
    await ctx.close();
  }
  await br.close();
  const rows = [...seen.entries()].sort(); for (const [k, where] of rows) console.log(k, ' [' + [...where].join(', ') + ']');
  console.log('\n' + rows.length + ' distinct findings on ' + pages.length + ' pages');
})();
