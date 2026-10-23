const { chromium } = require('playwright-core');
const { execSync } = require('child_process'); const fs = require('fs');
const F = process.env.F, DL = process.env.DL, B = process.env.B || 'http://localhost:8899';
let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
const sh = c => execSync(c, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
const shq = c => { try { return sh(c); } catch (e) { return 'ERR:' + (e.stdout || '') + (e.stderr || ''); } };
(async () => {
  const br = await chromium.launch({ executablePath: require('../chrome') });
  let ctx, p, errs = [], n = 0;
  const fresh = async (path) => { if (ctx) await ctx.close(); ctx = await br.newContext({ viewport: { width: 1340, height: 900 }, acceptDownloads: true }); p = await ctx.newPage(); p.on('dialog', d => d.accept()); p.on('pageerror', e => errs.push(e.message)); await p.goto(B + (path || '/pdf-studio/')); };
  const load = async (files, count) => { await p.setInputFiles('#fileIn', files.map(f => F + '/' + f)); await p.waitForFunction(c => window.__studio.pages.length === c, count, { timeout: 30000 }); };
  const grab = async (clickSel) => { const [d] = await Promise.all([p.waitForEvent('download', { timeout: 240000 }), p.click(clickSel)]); const f = DL + '/p3-' + (++n) + '-' + d.suggestedFilename(); await d.saveAs(f); return f; };
  const size = f => fs.statSync(f).size;
  /* ---------- compression ---------- */
  await fresh(); await load(['photos-a4.pdf'], 2);
  await p.click('#saveOpts'); await p.waitForSelector('#dlgDl[open]'); await p.click('#dlgDl [data-cmp=balanced]');
  let f = await grab('#dlgDl [value=save]');
  const orig = size(F + '/photos-a4.pdf'), bal = size(f);
  ok(bal < orig * 0.25, `Balanced: ${(orig / 1048576).toFixed(1)} MB → ${(bal / 1048576).toFixed(2)} MB (${Math.round((1 - bal / orig) * 100)}% smaller)`);
  const imgs = sh(`pdfimages -list "${f}"`).split('\n').slice(2).filter(Boolean).map(l => l.trim().split(/\s+/));
  ok(imgs.length === 2 && imgs.every(r => +r[3] <= 1800 && +r[4] <= 1800 && r[8] === 'jpeg'), 'images downsampled to ~150 DPI for A4 (' + imgs.map(r => r[3] + '×' + r[4]).join(', ') + ')');
  sh(`cd ${DL} && pdftoppm -f 1 -l 1 -r 30 -png "${F}/photos-a4.pdf" o && pdftoppm -f 1 -l 1 -r 30 -png "${f}" c`);
  const rmse = parseFloat(shq(`magick compare -metric RMSE ${DL}/o-1.png ${DL}/c-1.png null: 2>&1`).replace(/^ERR:/, '').split('(')[1]);
  ok(rmse < 0.03, 'still looks the same (RMSE ' + rmse.toFixed(4) + ')');
  ok(/compressed|password|searchable/.test(await p.getAttribute('#saveOpts', 'title')) && await p.evaluate(() => document.querySelector('#saveOpts').classList.contains('on')), 'options button shows the active setting');
  await p.click('#saveOpts'); await p.click('#dlgDl [data-cmp=strong]'); f = await grab('#dlgDl [value=save]');
  ok(size(f) < bal, `Smallest (${(size(f) / 1048576).toFixed(2)} MB) beats Balanced`);
  await p.waitForTimeout(400); ok(/was/.test(await p.evaluate(() => document.querySelector('.toast')?.textContent || '')), 'toast shows the before → after size');
  await fresh(); await load(['flate.pdf'], 1); await p.click('#saveOpts'); await p.click('#dlgDl [data-cmp=balanced]'); f = await grab('#dlgDl [value=save]');
  ok(size(f) < size(F + '/flate.pdf') * 0.3, `lossless (Flate) images compressed too: ${(size(F + '/flate.pdf') / 1048576).toFixed(1)} MB → ${(size(f) / 1048576).toFixed(2)} MB`);
  /* ---------- password protection ---------- */
  await fresh(); await load(['personal.pdf'], 1);
  await p.click('#saveOpts'); await p.check('#dlProtect', { force: true }); await p.fill('#dlPw1', 's3cret-pass'); await p.fill('#dlPw2', 'different');
  await p.click('#dlgDl [value=save]');
  const caught = await p.waitForSelector('#dlgDl[open] #dlErr:not([hidden])', { timeout: 5000 }).then(() => true, () => false);
  ok(caught && /match/.test(await p.innerText('#dlErr')), 'mismatched passwords are caught');
  await p.fill('#dlPw2', 's3cret-pass'); await p.check('#dlRestrict', { force: true });
  f = await grab('#dlgDl [value=save]');
  ok(/Incorrect password/.test(shq(`pdfinfo "${f}"`)), 'protected file won’t open without the password');
  const inf = sh(`pdfinfo -upw s3cret-pass "${f}"`);
  ok(/Encrypted:\s+yes \(print:yes copy:no change:no.*AES-256/.test(inf), 'AES-256, printing allowed, copying/editing blocked');
  ok(/Abdulaziz Alwabel/.test(sh(`pdftotext -upw s3cret-pass "${f}" -`)), 'opens with the password');
  /* ---------- unlock ---------- */
  await fresh('/unlock-pdf/'); await p.setInputFiles('#fileIn', F + '/locked.pdf'); await p.waitForSelector('#dlgPw[open]'); await p.fill('#pwIn', 'secret'); await p.keyboard.press('Enter');
  await p.waitForFunction(() => window.__studio.pages.length === 2); await p.waitForTimeout(400);
  ok(/without the password/.test(await p.evaluate(() => document.querySelector('.toast')?.textContent || '')), 'unlock page explains what happens');
  f = await grab('#save'); ok(!/Encrypted:\s+yes/.test(sh(`pdfinfo "${f}"`)), 'unlocked copy opens without a password');
  /* ---------- find & redact ---------- */
  await fresh(); await load(['personal.pdf'], 1);
  await p.click('#moreBtn'); await p.click('[data-act=find]'); await p.waitForSelector('#dlgFind[open]'); await p.check('#dlgFind [data-pat=card]', { force: true });
  await p.click('#findRun'); await p.waitForSelector('#findGo:not([hidden])', { timeout: 20000 });
  const kinds = await p.$$eval('.fd-k', e => e.map(x => x.textContent));
  ok(kinds.length === 6 && kinds.filter(k => k === 'Phone').length === 2, 'found ID, IBAN, 2 phones, email and card — and not the reference number (' + kinds.join(', ') + ')');
  ok(!/1012345678|4111 1111/.test(await p.innerText('#findRes')), 'results are masked on screen');
  await p.click('#findGo'); await p.waitForTimeout(400);
  const reds = (await p.evaluate(() => window.__studio.pages[0].marks)).filter(m => m.kind === 'redact');
  ok(reds.length === 6, '6 redaction boxes added');
  f = await grab('#save');
  sh(`qpdf --qdf --object-streams=disable "${f}" ${DL}/red-qdf.pdf`);
  const raw = fs.readFileSync(DL + '/red-qdf.pdf', 'latin1');
  ok(!/1012345678|SA03|0551234567|aziz@example|4111/.test(sh(`pdftotext "${f}" -`) + raw), 'the redacted data is nowhere in the file — not even in the raw objects');
  ok(sh(`pdffonts "${f}"`).split('\n').length <= 3, 'no fonts left on the redacted page (it was rebuilt as an image)');
  sh(`cd ${DL} && rm -f rd*.png && pdftoppm -r 72 -png "${f}" rd`);
  const b0 = reds[0]; const mean = +sh(`magick ${DL}/rd-1.png -crop ${Math.round(b0.w - 4)}x${Math.round(b0.h - 4)}+${Math.round(b0.x + 2)}+${Math.round(b0.y + 2)} -colorspace gray -format "%[fx:mean]" info:`);
  ok(mean < 0.05, 'black box exactly over the ID number');
  // with OCR on, the rebuilt page is searchable again — without the secrets
  await p.click('#saveOpts'); await p.check('#dlOcr', { force: true }); await p.click('#dlgDl [data-olang=eng]');
  f = await grab('#dlgDl [value=save]');
  const t = sh(`pdftotext "${f}" -`);
  ok(/Customer/.test(t) && /Abdulaziz/.test(t) && !/1012345678|0551234567|aziz@example/.test(t), 'redacted + searchable: other text found, secrets still gone');
  // manual redaction box
  await p.dblclick('#grid > .pg:nth-child(1) .pg-paper'); await p.waitForSelector('#viewSpin', { state: 'hidden' });
  await p.click('[data-tool=redact]'); const bx = await p.locator('#pageBox').boundingBox();
  await p.mouse.move(bx.x + bx.width * 0.1, bx.y + bx.height * 0.5); await p.mouse.down(); await p.mouse.move(bx.x + bx.width * 0.5, bx.y + bx.height * 0.55, { steps: 6 }); await p.mouse.up();
  const r7 = (await p.evaluate(() => window.__studio.pages[0].marks)).filter(m => m.kind === 'redact');
  ok(r7.length === 7 && r7[6].w > 200 && r7[6].h > 30, 'drag draws a redaction box');
  await p.keyboard.press('Control+z'); ok((await p.evaluate(() => window.__studio.pages[0].marks)).filter(m => m.kind === 'redact').length === 6, 'undo removes it');
  await p.click('#vClose');
  /* ---------- OCR ---------- */
  await fresh(); await load(['scanned.pdf'], 1);
  await p.click('#moreBtn'); await p.click('[data-act=ocr]'); await p.waitForSelector('#dlgOcr[open]');
  const t0 = Date.now(); await p.click('#ocrStart'); await p.waitForSelector('#ocrActs:not([hidden])', { timeout: 240000 });
  const text = await p.inputValue('#ocrOut');
  ok(/فاتورة/.test(text) && /Tax invoice/i.test(text) && /0559876543/.test(text), `scanned Arabic + English read on this device in ${((Date.now() - t0) / 1000).toFixed(1)} s`);
  ok(/عبدالعزيز|الوابل/.test(text) && /1098765432/.test(text), 'Arabic name and ID number recognised');
  await p.check('#ocrSearchable', { force: true }); await p.click('#dlgOcr [value=ok]');
  f = await grab('#save');
  const st = sh(`pdftotext "${f}" -`);
  ok(/Tax invoice/i.test(st) && /فاتورة/.test(st), 'downloaded PDF is now searchable (Arabic and English)');
  const im2 = sh(`pdfimages -list "${f}"`).split('\n').slice(2).filter(l => l.trim().split(/\s+/)[2] === 'image');
  ok(im2.length === 1 && /2480\s+3508/.test(im2[0]), 'original scan image kept untouched under the text');
  ok((await p.evaluate(() => window.__studio.ocrCount)) === 1, 'recognition was reused, not run twice');
  // find & redact on a scan
  await p.click('#moreBtn'); await p.click('[data-act=find]'); await p.check('#findOcr', { force: true }); await p.click('#findRun');
  await p.waitForSelector('#findGo:not([hidden])', { timeout: 60000 });
  const k2 = await p.$$eval('.fd-k', e => e.map(x => x.textContent));
  ok(k2.includes('ID number') && k2.includes('Phone') && k2.includes('Email'), 'scanned page: ID, phone and email found via OCR (' + k2.join(', ') + ')');
  /* ---------- presets ---------- */
  for (const [slug, file, check, label] of [
    ['compress-pdf', 'photos-a4.pdf', () => p.waitForFunction(() => document.querySelector('#dlgDl').open && document.querySelector('#dlgDl [data-cmp=balanced]').getAttribute('aria-pressed') === 'true', null, { timeout: 8000 }), 'opens options with Balanced on'],
    ['protect-pdf', 'personal.pdf', () => p.waitForFunction(() => document.querySelector('#dlgDl').open && document.querySelector('#dlProtect').checked && document.activeElement.id === 'dlPw1', null, { timeout: 8000 }), 'opens with the password field ready'],
    ['ocr-pdf', 'scanned.pdf', () => p.waitForFunction(() => document.querySelector('#dlgOcr').open, null, { timeout: 8000 }), 'opens Recognise text'],
    ['redact-pdf', 'personal.pdf', () => p.waitForFunction(() => document.querySelector('#dlgFind').open && document.querySelector('[data-tool=redact]').getAttribute('aria-pressed') === 'true', null, { timeout: 8000 }), 'opens the editor with Redact + Find']]) {
    await fresh('/' + slug + '/'); await p.setInputFiles('#fileIn', F + '/' + file);
    ok(await check().then(() => true, () => false), `/${slug}/ ${label}`);
  }
  ok(!errs.length, 'no errors ' + errs.join(' | '));
  await br.close(); console.log(fails ? fails + ' FAILED' : 'ALL PASSED');
})().catch(e => { console.error(e); process.exit(2); });
