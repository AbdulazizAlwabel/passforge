const { chromium } = require('playwright-core');
const F = process.env.F, B = process.env.B || 'http://localhost:8899', OUT = process.env.OUT;
let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
(async () => {
  const br = await chromium.launch({ executablePath: require('../chrome') });
  const errs = [];
  const ctx = await br.newContext({ viewport: { width: 1340, height: 900 } });
  const p = await ctx.newPage(); p.on('pageerror', e => errs.push(e.message)); p.on('dialog', d => d.accept());
  const PASS = 'violet-anchor-mosaic-tundra-27';
  await ctx.request.post(B + '/api/register', { data: { username: 'signer', email: 'signer@x.io', password: 'signer pass 123' } });
  await ctx.request.post(B + '/api/login', { data: { email: 'signer', password: 'signer pass 123' } });
  await p.goto(B + '/pdf-studio/');
  ok(await p.evaluate(async (pw) => { const c = await NDVault.create(pw); const r = await ND.api('/vault', { method: 'POST', body: c.payload }); return r.ok; }, PASS), 'vault created for the test user');
  const open = async () => { await p.setInputFiles('#fileIn', [F + '/report.pdf']); await p.waitForFunction(() => window.__studio.pages.length >= 12); await p.dblclick('#grid > .pg:nth-child(1) .pg-paper'); await p.waitForSelector('#viewSpin', { state: 'hidden' }); };
  await open();
  /* type a signature, save it to the vault */
  await p.click('[data-tool=sign]'); await p.waitForSelector('#dlgSign[open]');
  ok(await p.isVisible('#sigVault'), 'signed in → vault options shown');
  await p.click('[data-stab=type]'); await p.fill('#sigName', 'Abdulaziz Alwabel'); await p.waitForTimeout(300);
  ok((await p.$$('.sg-font')).length === 3 && /Abdulaziz Alwabel/.test(await p.innerText('#sigFonts')), 'three handwriting styles preview the name');
  await p.click('.sg-font[data-sf=caveat]'); await p.check('#sigToVault', { force: true });
  await p.screenshot({ path: OUT + '/sign-type.png' });
  await p.click('#sigOk'); await p.waitForSelector('#dlgVaultUnlock[open]');
  await p.fill('#vuPass', 'wrong one'); await p.keyboard.press('Enter'); await p.waitForSelector('#vuErr:not([hidden])');
  ok(/Wrong passphrase/.test(await p.innerText('#vuErr')), 'wrong vault passphrase is refused');
  await p.fill('#vuPass', PASS); await p.keyboard.press('Enter');
  await p.waitForFunction(() => document.querySelector('#placeHint') && !document.querySelector('#placeHint').hidden, null, { timeout: 20000 });
  const bx = await p.locator('#pageBox').boundingBox(); await p.mouse.click(bx.x + bx.width * 0.5, bx.y + bx.height * 0.8);
  await p.waitForTimeout(1500);
  const v = await p.evaluate(async (pw) => { const r = await ND.api('/vault'); const s = await NDVault.unlock(r.data, pw); const out = []; for (const it of r.data.items) out.push(await s.decrypt(it.data)); return out.map(o => ({ type: o.type, png: /^data:image\/png;base64,/.test(o.image || ''), len: (o.image || '').length })); }, PASS);
  ok(v.length === 1 && v[0].type === 'signature' && v[0].png, 'signature saved, end-to-end encrypted, in the vault (' + (v[0] && v[0].len) + ' chars)');
  const dump = await (await fetch('http://localhost:8898/vaultdump')).text();
  ok(!/iVBOR|signature|Abdulaziz/.test(dump), 'server holds no readable signature data');
  /* reuse it from the vault after a reload */
  await p.reload(); await open();
  await p.click('[data-tool=sign]'); await p.waitForSelector('#dlgSign[open]'); await p.click('#sigFromVault');
  await p.waitForSelector('#dlgVaultUnlock[open]'); await p.fill('#vuPass', PASS); await p.keyboard.press('Enter');
  await p.waitForSelector('.sg-chip', { timeout: 20000 }); ok((await p.$$('.sg-chip .sg-lock')).length === 1, 'vault signature listed with a lock badge');
  await p.click('.sg-chip'); ok(!(await p.isDisabled('#sigOk')), 'choosing it enables “Use signature”');
  await p.click('#sigOk'); await p.waitForSelector('#placeHint:not([hidden])'); await p.keyboard.press('Escape');
  ok((await p.evaluate(() => window.__studio.pages[0].marks.filter(m => m.kind === 'image').length)) === 1, 'Esc while placing puts it in the default spot');
  /* upload a photo of a signature */
  await p.click('[data-tool=sign]'); await p.waitForSelector('#dlgSign[open]'); await p.click('[data-stab=upload]');
  await p.setInputFiles('#sigFile', F + '/sig-photo.jpg'); await p.waitForSelector('#sigUpPrev:not([hidden])'); await p.waitForTimeout(300);
  await p.screenshot({ path: OUT + '/sign-upload.png' });
  await p.click('#sigOk'); await p.waitForSelector('#placeHint:not([hidden])'); await p.mouse.click(bx.x + bx.width * 0.3, bx.y + bx.height * 0.3);
  const alpha = await p.evaluate(async () => { const m = window.__studio.pages[0].marks.filter(x => x.kind === 'image').pop(); const im = new Image(); im.src = m.src; await im.decode(); const c = document.createElement('canvas'); c.width = im.naturalWidth; c.height = im.naturalHeight; const x = c.getContext('2d'); x.drawImage(im, 0, 0); const d = x.getImageData(0, 0, c.width, c.height).data; let clear = 0, ink = 0; for (let i = 3; i < d.length; i += 4) { if (d[i] < 10) clear++; else if (d[i] > 200) ink++; } return { clear: clear / (d.length / 4), ink: ink / (d.length / 4) }; });
  ok(alpha.clear > 0.6 && alpha.ink > 0.02, `photo background removed (${(alpha.clear * 100).toFixed(0)}% transparent, ${(alpha.ink * 100).toFixed(1)}% ink)`);
  await p.click('#vClose');
  /* vault page shows the signature */
  await p.goto(B + '/vault/'); await p.fill('#up', PASS); await p.click('#unlockForm button[type=submit]');
  await p.waitForSelector('[data-s="open"]:not([hidden])', { timeout: 20000 }); await p.click('.vitem');
  ok(await p.isVisible('.sig-prev img'), 'vault page previews the saved signature');
  await p.screenshot({ path: OUT + '/vault-sig.png' });
  /* presets */
  for (const [slug, check] of [['sign-pdf', () => p.waitForSelector('#dlgView[open]', { timeout: 8000 })], ['add-page-numbers', () => p.waitForFunction(() => document.querySelector('#dlgStamp').open && document.querySelector('#numOn').checked, null, { timeout: 8000 })], ['watermark-pdf', () => p.waitForFunction(() => document.querySelector('#dlgStamp').open && document.querySelector('#wmOn').checked && document.activeElement.id === 'wmText', null, { timeout: 8000 })]]) {
    await p.goto(B + '/' + slug + '/'); await p.setInputFiles('#fileIn', [F + '/report.pdf']);
    ok(await check().then(() => true, () => false), `/${slug}/ opens the right tool after the file loads`);
  }
  await ctx.close();
  /* touch editing */
  const tc = await br.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
  const t = await tc.newPage(); t.on('pageerror', e => errs.push('touch: ' + e.message));
  const cdp = await tc.newCDPSession(t); const touch = (type, x, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y }] });
  await t.goto(B + '/pdf-studio/'); await t.setInputFiles('#fileIn', [F + '/form.pdf']); await t.waitForFunction(() => window.__studio.pages.length === 1); await t.waitForTimeout(800);
  await t.evaluate(() => scrollTo(0, document.querySelector('#grid').getBoundingClientRect().top + scrollY - 160)); await t.waitForTimeout(300);
  await t.tap('#grid > .pg:nth-child(1) [data-a=view]'); await t.waitForSelector('#viewSpin', { state: 'hidden' }); await t.waitForTimeout(300);
  ok(await t.isVisible('.fld[title=fullName]'), 'phone: editor opens from the page’s pen button, fields visible');
  await t.tap('.fld[title=fullName]'); await t.keyboard.type('Touch Typed'); 
  await t.tap('[data-tool=check]'); const tb = await t.locator('#pageBox').boundingBox(); await t.tap('#layer', { position: { x: tb.width * 0.85, y: tb.height * 0.5 } });
  const m0 = (await t.evaluate(() => window.__studio.pages[0].marks))[0];
  ok(m0 && m0.kind === 'check', 'phone: tap places a tick');
  const mb = await t.locator('.mk-check').boundingBox();
  await touch('touchStart', mb.x + mb.width / 2, mb.y + mb.height / 2); for (let i = 1; i <= 6; i++) await touch('touchMove', mb.x + mb.width / 2 - i * 8, mb.y + mb.height / 2 + i * 5); await touch('touchEnd');
  const m1 = (await t.evaluate(() => window.__studio.pages[0].marks))[0];
  ok(m1.x < m0.x - 10 && m1.y > m0.y + 5, 'phone: drag the tick with a finger');
  await t.screenshot({ path: OUT + '/phone-editor.png' });
  ok((await t.evaluate(() => window.__studio.forms))[Object.keys(await t.evaluate(() => window.__studio.forms))[0]] === 'Touch Typed', 'phone: typing into a form field works');
  ok(!errs.length, 'no errors ' + errs.join(' | '));
  await br.close(); console.log(fails ? fails + ' FAILED' : 'ALL PASSED');
})().catch(e => { console.error(e); process.exit(2); });
