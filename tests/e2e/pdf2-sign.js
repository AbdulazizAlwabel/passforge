const { chromium } = require('playwright-core');
const { execSync } = require('child_process');
const F = process.env.F, DL = process.env.DL, B = process.env.B || 'http://localhost:8899';
let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
const sh = c => execSync(c, { encoding: 'utf8' });
const text = (f, pg) => sh(`pdftotext -f ${pg} -l ${pg} "${f}" -`).replace(/\s+/g, ' ').trim();
const render = (f, pg, tag) => { sh(`cd ${DL} && rm -f r-${tag}*.png && pdftoppm -f ${pg} -l ${pg} -r 72 -png "${f}" r-${tag}`); return sh(`ls ${DL}/r-${tag}*.png`).trim(); };
const ink = (png, x, y, w, h) => +sh(`magick "${png}" -crop ${Math.max(1, Math.round(w))}x${Math.max(1, Math.round(h))}+${Math.round(x)}+${Math.round(y)} -colorspace gray -format "%[fx:mean]" info:`);
const size = png => sh(`magick identify -format "%w %h" "${png}"`).split(' ').map(Number);
(async () => {
  const br = await chromium.launch({ executablePath: require('../chrome') });
  const ctx = await br.newContext({ viewport: { width: 1340, height: 900 }, acceptDownloads: true });
  const p = await ctx.newPage(); const errs = []; p.on('dialog', d => d.accept());
  p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error' && !/401/.test(m.text())) errs.push(m.text()); });
  const st = () => p.evaluate(() => window.__studio.pages);
  let nsave = 0; const save = async () => { const [d] = await Promise.all([p.waitForEvent('download', { timeout: 60000 }), p.click('#save')]); const f = DL + '/out' + (++nsave) + '-' + d.suggestedFilename(); await d.saveAs(f); return f; };
  await p.goto(B + '/pdf-studio/');
  await p.setInputFiles('#fileIn', [F + '/form.pdf', F + '/rot-offset.pdf', F + '/report.pdf']);
  await p.waitForFunction(() => window.__studio.pages.length === 14, null, { timeout: 30000 });
  const srcs = await p.evaluate(() => window.__studio.sources);
  ok(srcs.find(s => s.name === 'form.pdf').hasForm && !srcs.find(s => s.name === 'report.pdf').hasForm, 'fillable form detected (and only there)');
  await p.waitForTimeout(400);
  ok(/Form/.test(await p.innerText('#files')), 'file chip shows a “Form” tag');

  /* ---------- fill the form ---------- */
  await p.dblclick('#grid > .pg:nth-child(1) .pg-paper'); await p.waitForSelector('#viewSpin', { state: 'hidden' }); await p.waitForTimeout(300);
  ok((await p.$$('.fld')).length === 7 && await p.isVisible('#formHint'), 'editor shows 7 fillable fields + hint');
  ok(await p.inputValue('.fld[title=email]') === 'prefilled@example.com', 'pre-filled value is loaded into the field');
  await p.fill('.fld[title=fullName]', 'Abdulaziz Alwabel');
  await p.fill('.fld[title=notes]', 'ملاحظة: مرحبا بالعالم');
  await p.click('.fld[title=agree]'); await p.click('.fld[title=plan] >> nth=1'); await p.selectOption('.fld[title=city]', 'Jeddah');
  await p.click('#layer', { position: { x: 5, y: 5 } });   // blur → commit
  /* ---------- text, tick, date, signature ---------- */
  const bx = await p.locator('#pageBox').boundingBox();
  await p.click('[data-tool=text]'); await p.mouse.click(bx.x + bx.width * 0.6, bx.y + bx.height * 0.06); await p.keyboard.type('Approved by HR'); await p.keyboard.press('Escape');
  ok((await st())[0].marks?.[0]?.text === 'Approved by HR', 'typed text becomes an item on the page');
  await p.keyboard.press('Escape');
  await p.click('[data-tool=text]'); await p.mouse.click(bx.x + bx.width * 0.6, bx.y + bx.height * 0.12); await p.keyboard.type('موافق عليه'); await p.keyboard.press('Escape'); await p.keyboard.press('Escape');
  await p.click('[data-tool=date]'); await p.mouse.click(bx.x + bx.width * 0.15, bx.y + bx.height * 0.93);
  await p.click('[data-tool=check]'); await p.mouse.click(bx.x + bx.width * 0.85, bx.y + bx.height * 0.45); await p.mouse.click(bx.x + bx.width * 0.9, bx.y + bx.height * 0.45); await p.keyboard.press('Escape');
  let marks = (await st())[0].marks;
  ok(marks.length === 5 && marks.filter(m => m.kind === 'check').length === 2 && /\d{2}\/\d{2}\/\d{4}/.test(marks[2].text), 'Arabic text, date (dd/mm/yyyy) and two ticks added (tick tool stays on)');
  // undo / redo inside the editor
  await p.keyboard.press('Control+z'); ok((await st())[0].marks.length === 4, 'Ctrl+Z removes the last tick');
  await p.keyboard.press('Control+Shift+z'); ok((await st())[0].marks.length === 5, 'Ctrl+Shift+Z brings it back');
  // signature: draw, then click where it goes
  await p.click('[data-tool=sign]'); await p.waitForSelector('#dlgSign[open]'); await p.waitForTimeout(250);
  ok(await p.isDisabled('#sigOk'), '“Use signature” disabled until something is drawn');
  const pad = await p.locator('#sigPad').boundingBox();
  await p.mouse.move(pad.x + 60, pad.y + 130); await p.mouse.down(); for (let i = 0; i <= 40; i++) await p.mouse.move(pad.x + 60 + i * 9, pad.y + 115 + Math.sin(i / 3) * 35); await p.mouse.up();
  await p.click('#sigOk'); await p.waitForSelector('#placeHint:not([hidden])');
  ok(true, 'after choosing, the editor asks where the signature goes');
  const tx = bx.x + bx.width * 0.47, ty = bx.y + bx.height * 0.66;
  await p.mouse.move(tx - 40, ty); await p.mouse.move(tx, ty, { steps: 3 });
  ok(await p.isVisible('.st-sig-ghost'), 'a ghost of the signature follows the pointer');
  await p.mouse.click(tx, ty);
  marks = (await st())[0].marks; const sig = marks.find(m => m.kind === 'image');
  const geo = await p.evaluate(() => { const r = document.querySelector('#pageBox').getBoundingClientRect(); return r.width; });
  const k = geo / 595.28, cx = (tx - bx.x) / k, cy = (ty - bx.y) / k;
  ok(sig && Math.abs(sig.x + sig.w / 2 - cx) < 2 && Math.abs(sig.y + sig.h / 2 - cy) < 2, `signature centred where clicked (${(sig.x + sig.w / 2).toFixed(1)},${(sig.y + sig.h / 2).toFixed(1)} vs ${cx.toFixed(1)},${cy.toFixed(1)})`);
  // move it by dragging, resize with the handle
  const sEl = p.locator('.mk-image'); let sb = await sEl.boundingBox();
  await p.mouse.move(sb.x + sb.width / 2, sb.y + sb.height / 2); await p.mouse.down(); await p.mouse.move(sb.x + sb.width / 2 + 30, sb.y + sb.height / 2 + 10, { steps: 5 }); await p.mouse.up();
  const sig2 = (await st())[0].marks.find(m => m.kind === 'image');
  ok(Math.abs(sig2.x - sig.x - 30 / k) < 1.5 && Math.abs(sig2.y - sig.y - 10 / k) < 1.5, 'drag moves the signature');
  sb = await sEl.boundingBox(); const h = p.locator('.mk-image .mk-h'); const hb = await h.boundingBox();
  await p.mouse.move(hb.x + hb.width / 2, hb.y + hb.height / 2); await p.mouse.down(); await p.mouse.move(hb.x + 40, hb.y + 20, { steps: 5 }); await p.mouse.up();
  const sig3 = (await st())[0].marks.find(m => m.kind === 'image');
  ok(sig3.w > sig2.w * 1.15 && Math.abs(sig3.w / sig3.h - sig2.w / sig2.h) < 0.01, 'handle resizes and keeps the proportions');
  // text styling via the floating bar
  await p.click('.mk-text >> nth=0'); await p.waitForSelector('#mkbar:not([hidden])');
  await p.click('#mkbar [data-mb=bigger]'); await p.click('#mkbar [data-c=blue]');
  const t1 = (await st())[0].marks[0]; ok(t1.size > 12 && t1.color === 'blue', 'floating bar: bigger + blue text');
  await p.click('#vClose'); await p.waitForTimeout(500);
  ok(await p.evaluate(() => document.querySelector('#grid > .pg:nth-child(1) .pg-ov').width > 0), 'thumbnail shows the edits');

  /* ---------- page numbers + watermark ---------- */
  await p.click('#stampBtn'); await p.waitForSelector('#dlgStamp[open]');
  await p.check('#numOn', { force: true }); await p.click('#dlgStamp [data-nf=page]'); await p.click('#dlgStamp [data-pos=br]'); await p.check('#numSkip', { force: true });
  await p.check('#wmOn', { force: true }); await p.fill('#wmText', 'CONFIDENTIAL');
  await p.waitForTimeout(300);
  ok(await p.evaluate(() => document.querySelector('#grid > .pg:nth-child(3) .pg-ov').width > 0), 'thumbnails preview numbers/watermark live (behind the side panel)');
  await p.click('#dlgStamp [value=ok]');
  const stamps = await p.evaluate(() => window.__studio.stamps);
  ok(stamps.numbers.format === 'page' && stamps.numbers.pos === 'br' && stamps.numbers.skipFirst && stamps.watermark.text === 'CONFIDENTIAL', 'stamp settings stored');
  await p.click('#undo'); ok(!(await p.evaluate(() => window.__studio.stamps.numbers)), 'one Undo removes the whole stamp change');
  await p.click('#redo');
  // rotate the rotated page once more (base 90 + user 90 = 180)
  await p.click('#grid > .pg:nth-child(2) .pg-paper'); await p.keyboard.press('r'); await p.keyboard.press('Escape');

  const out = await save();
  const info = sh(`pdfinfo "${out}"`);
  ok(+info.match(/Pages:\s+(\d+)/)[1] === 14, 'export: 14 pages');
  ok(/Form:\s+none/.test(info), 'form flattened — no fields left in the output');
  const t1p = text(out, 1);
  ok(/Abdulaziz Alwabel/.test(t1p) && /Jeddah/.test(t1p) && /prefilled@example\.com/.test(t1p), 'Latin answers are real, searchable text');
  ok(!/Page 1 of/.test(t1p), 'skip first page: no number on page 1');
  ok(/Page 3 of 14/.test(text(out, 3)) && /CONFIDENTIAL/.test(sh(`pdftotext -raw -f 3 -l 3 "${out}" -`).replace(/\s+/g, '')), 'page 3 has “Page 3 of 14” and the watermark as text');
  const r1 = render(out, 1, 'a'); const marksNow = (await st())[0].marks;
  const sigM = marksNow.find(m => m.kind === 'image'), ar = marksNow[1], tick = marksNow.find(m => m.kind === 'check');
  ok(ink(r1, sigM.x, sigM.y, sigM.w, sigM.h) < 0.985, 'signature is drawn exactly where it was placed');
  ok(ink(r1, ar.x, ar.y, ar.w, ar.h) < 0.97, 'Arabic text item drawn in place');
  ok(ink(r1, tick.x, tick.y, tick.w, tick.h) < 0.95, 'tick drawn in place');
  ok(ink(r1, 162, 211, 296, 68) < 0.985, 'Arabic form answer drawn inside the notes box');
  ok(ink(r1, 161, 309, 17, 17) < 0.9, 'checkbox ticked');
  // rotated page: numbers must read upright at the bottom-right of the final view
  const r2 = render(out, 2, 'b'), [w2, h2] = size(r2);
  const br_ = ink(r2, w2 * 0.6, h2 * 0.9, w2 * 0.38, h2 * 0.09), tl_ = ink(r2, 0, 0, w2 * 0.4, h2 * 0.09);
  ok(br_ < 0.995 && tl_ > 0.995, `rotated page: page number lands bottom-right of the final view (${br_.toFixed(4)} vs ${tl_.toFixed(4)})`);
  ok(/Page 2 of 14/.test(text(out, 2)), 'rotated page carries its number as text');
  /* ---------- Arabic watermark, pages → images ---------- */
  await p.click('#stampBtn'); await p.fill('#wmText', 'سري للغاية'); await p.click('#dlgStamp [data-wc=red]'); await p.click('#dlgStamp [value=ok]');
  const out2 = await save(); const r3 = render(out2, 4, 'c'), [w3, h3] = size(r3);
  ok(!/CONFIDENTIAL/.test(sh(`pdftotext -raw -f 4 -l 4 "${out2}" -`).replace(/\s+/g, '')) && ink(r3, w3 * 0.3, h3 * 0.35, w3 * 0.4, h3 * 0.3) < 0.99, 'Arabic watermark drawn (as an image) across the page');
  await p.click('#grid > .pg:nth-child(1) .pg-paper');
  await p.click('#imgBtn'); await p.click('#dlgImg [data-which=sel]'); await p.click('#dlgImg [data-dpi="72"]');
  const [d] = await Promise.all([p.waitForEvent('download'), p.click('#dlgImg [value=ok]')]); const png = DL + '/' + d.suggestedFilename(); await d.saveAs(png);
  ok(ink(png, sigM.x, sigM.y, sigM.w, sigM.h) < 0.985, 'saving as an image includes the signature');
  ok(!errs.length, 'no errors ' + errs.join(' | '));
  await br.close(); console.log(fails ? fails + ' FAILED' : 'ALL PASSED');
})().catch(e => { console.error(e); process.exit(2); });
