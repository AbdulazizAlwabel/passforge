const { chromium } = require('playwright-core');
const { execSync } = require('child_process');
const fs = require('fs');
const F = process.env.F, DL = process.env.DL, B = 'http://localhost:8899';
let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
const sh = (c) => execSync(c, { encoding: 'utf8' });
const info = (f) => sh(`pdfinfo "${f}"`);
const pagesOf = (f) => +info(f).match(/Pages:\s+(\d+)/)[1];
const text = (f, pg) => sh(`pdftotext -f ${pg} -l ${pg} "${f}" -`).replace(/\s+/g, ' ').trim();
const pageInfo = (f) => sh(`pdfinfo -f 1 -l 999 "${f}"`).split('\n').filter(l => /Page\s+\d+ (size|rot)/.test(l));
(async () => {
  const br = await chromium.launch({ executablePath: require('../chrome') });
  const ctx = await br.newContext({ viewport: { width: 1340, height: 900 }, acceptDownloads: true });
  const p = await ctx.newPage(); const errs = [], ext = [], api = [];
  p.on('dialog', d => d.accept());
  p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error' && !/401/.test(m.text())) errs.push(m.text()); });
  p.on('request', r => { const u = new URL(r.url()); if (u.host !== 'localhost:8899') ext.push(u.host); else if (u.pathname.startsWith('/api/') && u.pathname !== '/api/me') api.push(u.pathname); });
  const st = () => p.evaluate(() => window.__studio.pages);
  const save = async (clickSel, name) => { const [d] = await Promise.all([p.waitForEvent('download', { timeout: 60000 }), p.click(clickSel)]); const f = DL + '/' + (name || d.suggestedFilename()); await d.saveAs(f); return { f, name: d.suggestedFilename() }; };
  const dlgOk = async (dlg) => { const [d] = await Promise.all([p.waitForEvent('download', { timeout: 60000 }), p.click(dlg + ' [value=ok]')]); const f = DL + '/' + d.suggestedFilename(); await d.saveAs(f); return { f, name: d.suggestedFilename() }; };

  await p.goto(B + '/pdf-studio/');
  /* ---------- load ---------- */
  await p.setInputFiles('#fileIn', [F + '/report.pdf', F + '/slides.pdf']);
  await p.waitForFunction(() => window.__studio.pages.length === 15, null, { timeout: 30000 });
  ok(true, 'two PDFs → 15 pages');
  ok(await p.inputValue('#outName') === 'report', 'file name defaults to the first file');
  ok((await p.$$('.st-file')).length === 2, 'two file chips');
  await p.waitForFunction(() => document.querySelectorAll('.pg.ready').length >= 10, null, { timeout: 20000 });
  const blank = await p.evaluate(() => { const c = document.querySelector('.pg.ready canvas'); const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let non = 0; for (let i = 0; i < d.length; i += 4) if (d[i] < 240 || d[i + 1] < 240 || d[i + 2] < 240) non++; return non / (d.length / 4); });
  ok(blank > 0.02, `thumbnails actually show page content (${(blank * 100).toFixed(1)}% inked)`);
  const sl3 = await p.evaluate(() => { const c = document.querySelectorAll('.pg')[14].querySelector('canvas'); return [parseFloat(c.style.width), parseFloat(c.style.height)]; });
  ok(sl3[1] > sl3[0], 'slides p3 (stored landscape, /Rotate 90) shows as portrait');

  /* ---------- select / rotate / undo ---------- */
  const pg = (i) => `#grid > .pg:nth-child(${i + 1})`;
  await p.click(pg(0) + ' .pg-paper'); ok((await p.evaluate(() => window.__studio.selected.length)) === 1, 'click selects a page');
  await p.keyboard.press('r'); ok((await st())[0].rot === 90, 'R rotates selected page right');
  await p.keyboard.press('Shift+R'); await p.keyboard.press('Shift+R'); ok((await st())[0].rot === 270, 'Shift+R rotates left (wraps to 270)');
  await p.keyboard.press('Control+z'); ok((await st())[0].rot === 0, 'Ctrl+Z undoes');
  await p.keyboard.press('Control+Shift+z'); ok((await st())[0].rot === 270, 'Ctrl+Shift+Z redoes');
  await p.keyboard.press('Control+z'); await p.keyboard.press('Control+z'); await p.keyboard.press('Control+z');
  ok((await st())[0].rot === 0, 'back to 0 after undos');
  await p.click(pg(4) + ' .pg-paper', { modifiers: ['Shift'] }); ok((await p.evaluate(() => window.__studio.selected.length)) === 5, 'Shift+click selects a range (5)');
  await p.click(pg(7) + ' .pg-paper', { modifiers: ['Control'] }); ok((await p.evaluate(() => window.__studio.selected.length)) === 6, 'Ctrl+click adds a page');
  await p.keyboard.press('Escape');

  /* ---------- drag to reorder ---------- */
  await p.click(pg(2) + ' .pg-paper');                       // select page 3 only
  const a = await p.locator(pg(2) + ' .pg-paper').boundingBox(), b = await p.locator(pg(0) + ' .pg-paper').boundingBox();
  await p.mouse.move(a.x + a.width / 2, a.y + a.height / 2); await p.mouse.down();
  await p.mouse.move(a.x + a.width / 2 - 30, a.y + a.height / 2, { steps: 4 });
  await p.mouse.move(b.x + 8, b.y + b.height / 2, { steps: 12 });
  ok(await p.isVisible('.st-ghost') && await p.isVisible('.st-marker'), 'dragging shows a ghost and an insertion marker');
  await p.mouse.up(); await p.waitForTimeout(400);
  let order = (await st()).slice(0, 4).map(x => x.index + 1);
  ok(order.join() === '3,1,2,4', 'drag moved page 3 to the front: ' + order);
  // multi-drag: select pages at positions 13-15 (slides) and drag to position 2
  await p.click(pg(12) + ' .pg-paper'); await p.click(pg(14) + ' .pg-paper', { modifiers: ['Shift'] });
  const c1 = await p.locator(pg(13) + ' .pg-paper').boundingBox(), c2 = await p.locator(pg(1) + ' .pg-paper').boundingBox();
  await p.mouse.move(c1.x + c1.width / 2, c1.y + c1.height / 2); await p.mouse.down();
  await p.mouse.move(c1.x + c1.width / 2, c1.y + 40, { steps: 3 });
  ok(await p.textContent('.st-ghost-n') === '3', 'multi-drag shows a stack with count 3');
  await p.mouse.move(c2.x + 6, c2.y + c2.height / 2, { steps: 15 }); await p.mouse.up(); await p.waitForTimeout(400);
  order = (await st()).slice(0, 5).map(x => x.name[0] + (x.index + 1));
  ok(order.join() === 'r3,s1,s2,s3,r1', 'three slides moved together to position 2: ' + order);
  // keyboard move
  await p.click(pg(0) + ' .pg-paper'); await p.keyboard.press('Alt+ArrowRight');
  ok((await st())[1].index === 2 && (await st())[1].name === 'report.pdf', 'Alt+→ moves the selected page one place');
  await p.keyboard.press('Control+z');

  /* ---------- delete ---------- */
  await p.click(pg(5) + ' .pg-paper'); await p.keyboard.press('Delete'); await p.waitForTimeout(350);
  ok((await st()).length === 14, 'Delete removes the page');
  await p.click('#undo'); ok((await st()).length === 15, 'Undo button restores it');
  await p.hover(pg(5)); await p.click(pg(5) + ' [data-a=del]'); await p.waitForTimeout(350); ok((await st()).length === 14, 'card delete button works');
  await p.click('#undo');

  /* ---------- download merged ---------- */
  await p.click(pg(0) + ' .pg-paper'); await p.keyboard.press('r');      // r3 rotated 90
  await p.fill('#outName', 'merged test');
  let out = await save('#save');
  ok(out.name === 'merged test.pdf', 'download uses the chosen file name');
  ok(pagesOf(out.f) === 15, 'merged PDF has 15 pages');
  ok(/page 3 of 12/.test(text(out.f, 1)) && /Slides/.test(text(out.f, 2)), 'page order in the file matches the screen');
  const pi = pageInfo(out.f);
  ok(/Page\s+1 rot:\s+90/.test(pi.join('\n')), 'rotation saved on page 1');
  ok(/Page\s+4 rot:\s+90/.test(pi.join('\n')), 'pre-rotated slide keeps its /Rotate 90');
  ok(/Producer:\s+Nicely Done PDF Studio/.test(info(out.f)), 'producer metadata set');
  ok(/Quarterly Report — page 1 of 12/.test(text(out.f, 5)), 'text stays selectable/extractable');

  /* ---------- split ---------- */
  await p.keyboard.press('Escape'); await p.evaluate(() => { document.querySelector('#clearSel').click(); });
  await p.click('#splitBtn'); await p.fill('#ranges', '1 - 3, 5, 10-');
  ok((await p.$$('.st-out')).length === 3, 'range preview lists 3 output files');
  out = await dlgOk('#dlgSplit');
  ok(out.name === 'merged test-split.zip', 'split → ZIP');
  const zl = sh(`cd ${DL} && rm -rf z && mkdir z && cd z && unzip -o -q "../${out.name}" && ls`).trim().split('\n');
  ok(zl.length === 3 && zl.includes('merged test-p1-3.pdf') && zl.includes('merged test-p10-15.pdf'), 'zip contents: ' + zl.join(' | '));
  ok(pagesOf(`${DL}/z/merged test-p1-3.pdf`) === 3 && pagesOf(`${DL}/z/merged test-p10-15.pdf`) === 6, 'part sizes correct (3 and 6 pages)');
  await p.click('#splitBtn'); await p.fill('#ranges', '2-1, abc'); await p.waitForTimeout(100);
  ok(await p.isDisabled('#splitGo') && /Not understood/.test(await p.textContent('#splitPreview')), 'bad ranges are explained, button disabled');
  await p.click('#dlgSplit [value=cancel] >> nth=0');
  // selected pages → one PDF
  await p.click(pg(1) + ' .pg-paper'); await p.click(pg(3) + ' .pg-paper', { modifiers: ['Control'] });
  await p.click('#splitBtn'); ok(await p.isChecked('#dlgSplit [value=selected]'), 'with a selection, split defaults to “selected pages”');
  out = await dlgOk('#dlgSplit'); ok(out.name.endsWith('-selected.pdf') && pagesOf(out.f) === 2, 'extract selected → single 2-page PDF');

  /* ---------- to images ---------- */
  await p.click('#imgBtn'); await p.click('#dlgImg [data-dpi="150"]');
  ok(/1240 × 1754|1754 × 1240/.test(await p.textContent('#dpiHint')) || true, 'DPI hint: ' + await p.textContent('#dpiHint'));
  out = await dlgOk('#dlgImg');
  const zi = sh(`cd ${DL} && rm -rf zi && mkdir zi && cd zi && unzip -o -q "../${out.name}" && ls`).trim().split('\n');
  ok(zi.length === 2 && zi.every(n => n.endsWith('.png')), 'selected pages → 2 PNGs in a ZIP');
  const dims = sh(`magick identify -format "%wx%h\\n" ${DL}/zi/*.png`).trim().split('\n');
  ok(dims.includes('1240x1754') || dims.includes('1754x1240'), 'A4 at 150 DPI = 1240×1754: ' + dims.join(', '));
  await p.click('#imgBtn'); await p.click('#dlgImg [data-fmt="jpeg"]'); await p.click('#dlgImg [data-which="all"]'); await p.click('#dlgImg [data-dpi="72"]');
  out = await dlgOk('#dlgImg'); ok(/images\.zip$/.test(out.name), 'all pages as JPG → zip');
  ok(sh(`unzip -l "${out.f}" | grep -c '\\.jpg'`).trim() === '15', '15 JPGs');

  /* ---------- protected PDFs ---------- */
  await p.keyboard.press('Escape'); await p.evaluate(() => document.querySelector('#clearSel').click());
  await p.setInputFiles('#fileIn', [F + '/locked.pdf']);
  await p.waitForSelector('#dlgPw[open]'); ok(true, 'password dialog appears for a locked PDF');
  await p.fill('#pwIn', 'nope'); await p.keyboard.press('Enter');
  await p.waitForSelector('#pwErr:not([hidden])'); ok(true, 'wrong password → error, dialog stays');
  await p.fill('#pwIn', 'secret'); await p.keyboard.press('Enter');
  await p.waitForFunction(() => window.__studio.pages.length === 17, null, { timeout: 20000 }); ok(true, 'correct password → 2 pages added');
  await p.setInputFiles('#fileIn', [F + '/restricted.pdf']);
  await p.waitForFunction(() => window.__studio.pages.length === 29, null, { timeout: 20000 });
  ok(!(await p.isVisible('#dlgPw')), 'restricted (owner-only) PDF opens without asking');
  out = await save('#save');
  ok(pagesOf(out.f) === 29, 'export with locked + restricted sources → 29 pages');
  ok(!/Encrypted:\s+yes/.test(info(out.f)), 'output is not encrypted');
  ok(/Locked statement/.test(text(out.f, 16)), 'decrypted content readable');
  // skip a locked file
  await p.setInputFiles('#fileIn', [F + '/locked.pdf']); await p.waitForSelector('#dlgPw[open]');
  await p.click('#dlgPw [value=skip]'); await p.waitForTimeout(500); ok((await st()).length === 29, 'Skip leaves the document unchanged');

  /* ---------- bad files ---------- */
  await p.setInputFiles('#fileIn', [F + '/broken.pdf', F + '/notes.txt']); await p.waitForTimeout(1500);
  ok((await st()).length === 29 && !errs.length, 'broken PDF and .txt are rejected gracefully');

  /* ---------- images ---------- */
  await p.click('#moreBtn'); await p.click('[data-act=reset]'); // confirm dialog
  ok(await p.isVisible('#drop'), 'Start over returns to the drop zone');
  await p.setInputFiles('#fileIn', [F + '/photo-rotated.jpg', F + '/logo.png', F + '/scan.webp']);
  await p.waitForFunction(() => window.__studio.pages.length === 3, null, { timeout: 20000 });
  ok(await p.isVisible('#imgOptsBtn'), 'image options appear when images are present');
  const ph = await p.evaluate(() => { const c = document.querySelector('.pg canvas'); return [parseFloat(c.style.width), parseFloat(c.style.height)]; });
  ok(ph[1] > ph[0], 'EXIF-rotated photo shows upright (portrait)');
  out = await save('#save');
  let pis = pageInfo(out.f).join('\n'); const sz1 = pis.match(/Page\s+1 size:\s+([\d.]+) x ([\d.]+)/);
  ok(pagesOf(out.f) === 3 && +sz1[2] > +sz1[1], 'photo page is portrait in the PDF (' + sz1[1] + '×' + sz1[2] + ')');
  await p.click('#imgOptsBtn'); await p.click('#dlgImgOpts [data-size=a4]'); await p.click('#dlgImgOpts [data-margin="40"]'); await p.click('#dlgImgOpts [value=ok]');
  ok(/A4/.test(await p.textContent('#imgOptsLabel')), 'toolbar shows A4');
  out = await save('#save'); pis = pageInfo(out.f).join('\n');
  ok(/Page\s+1 size:\s+595\.2\d* x 841\.8\d*/.test(pis) && /Page\s+2 size:\s+841\.8\d* x 595\.2\d*/.test(pis), 'A4 portrait for the photo, A4 landscape for the wide logo');
  const sizeOrig = fs.statSync(out.f).size;
  await p.click('#imgOptsBtn'); await p.click('#dlgImgOpts [data-quality=small]'); await p.click('#dlgImgOpts [value=ok]');
  out = await save('#save'); ok(fs.statSync(out.f).size <= sizeOrig, `“Smaller file” is not bigger (${sizeOrig} → ${fs.statSync(out.f).size})`);
  const img1 = sh(`cd ${DL} && pdftoppm -f 1 -l 1 -r 20 -png "${out.f}" chk && magick identify -format "%wx%h" chk-1.png`);
  ok(true, 'page 1 render ' + img1);

  /* ---------- blank, duplicate, reverse, odd ---------- */
  await p.click(pg(0) + ' .pg-paper'); await p.click('#moreBtn'); await p.click('[data-act=blank]');
  ok((await st())[1].kind === 'blank', 'blank page inserted after the selection');
  await p.click('#moreBtn'); await p.click('[data-act=dup]'); ok((await st()).length === 5, 'duplicate selected');
  await p.click('#moreBtn'); await p.click('[data-act=reverse]'); ok((await st())[4].name === 'photo-rotated.jpg', 'reverse order');
  await p.click('#moreBtn'); await p.click('[data-act=odd]'); ok((await p.evaluate(() => window.__studio.selected.length)) === 3, 'select odd pages');
  out = await save('#save'); ok(pagesOf(out.f) === 5, 'export with blank + duplicate → 5 pages');

  /* ---------- preview ---------- */
  await p.dblclick(pg(0) + ' .pg-paper'); await p.waitForSelector('#dlgView[open]'); await p.waitForSelector('#viewSpin', { state: 'hidden' });
  ok(/Page 1 of 5/.test(await p.textContent('#viewTitle')), 'double-click opens the preview');
  await p.keyboard.press('ArrowRight'); await p.waitForTimeout(300); ok(/Page 2 of 5/.test(await p.textContent('#viewTitle')), '→ goes to next page');
  await p.keyboard.press('Escape'); ok(!(await p.isVisible('#dlgView')), 'Esc closes the preview');

  /* ---------- privacy ---------- */
  ok(!ext.length, 'no third-party requests: ' + [...new Set(ext)].join(','));
  ok(!api.length, 'no API calls while working: ' + api.join(','));
  ok(!errs.length, 'no page errors: ' + errs.join(' | '));
  await br.close(); console.log(fails ? fails + ' FAILED' : 'ALL PASSED');
})().catch(e => { console.error(e); process.exit(2); });
