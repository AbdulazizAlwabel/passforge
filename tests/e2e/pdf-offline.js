const { chromium } = require('playwright-core');
const F = process.env.F, DL = process.env.DL, B = 'http://localhost:8899';
let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
(async () => {
  const br = await chromium.launch({ executablePath: require('../chrome') });
  const ctx = await br.newContext({ viewport: { width: 1340, height: 900 }, acceptDownloads: true });
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  const fetched = []; p.on('request', r => { if (r.url().includes('/vendor/')) fetched.push(r.url().split('/').pop()); });
  await p.goto(B + '/pdf-studio/');
  await p.waitForFunction(() => navigator.serviceWorker && navigator.serviceWorker.controller, null, { timeout: 15000 }).catch(() => {});
  await p.reload(); await p.waitForTimeout(6000);   // idle prefetch fires ~2.5s after load
  ok(['pdf.min.mjs', 'pdf.worker.min.mjs', 'pdf-lib.esm.min.js', 'fflate.mjs'].every(f => fetched.includes(f)), 'engines prefetched while idle: ' + [...new Set(fetched)].join(', '));
  await ctx.setOffline(true);
  await p.reload(); ok(await p.isVisible('#drop'), 'studio page loads with no network');
  await p.setInputFiles('#fileIn', [F + '/report.pdf', F + '/logo.png']);
  await p.waitForFunction(() => window.__studio.pages.length === 13, null, { timeout: 20000 }).then(() => ok(true, 'opens a PDF and an image offline'), () => ok(false, 'opens files offline'));
  await p.keyboard.press('Control+a'); await p.keyboard.press('r');
  const [d] = await Promise.all([p.waitForEvent('download', { timeout: 30000 }), p.click('#save')]); await d.saveAs(DL + '/offline.pdf');
  ok(+require('child_process').execSync(`pdfinfo "${DL}/offline.pdf" | awk '/Pages/{print $2}'`, { encoding: 'utf8' }) === 13, 'builds and downloads the PDF offline');
  ok(!errs.length, 'no errors ' + errs.join('|'));
  await br.close(); console.log(fails ? fails + ' FAILED' : 'ALL PASSED');
})().catch(e => { console.error(e); process.exit(2); });
