// Phone checks that came out of testing on a real iPhone:
//   1. nothing keeps animating once a page is at rest (that is what warmed the phone up)
//   2. every menu and popover stays inside a 375 px screen, in English and Arabic
//   3. OCR reads a tilted phone photo of a product label
//   4. PDF Studio stays inside a time budget for one 12 MP photo
const { chromium } = require('playwright-core');
const fs = require('fs');
const F = process.env.F, B = process.env.B || 'http://localhost:8899';
let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
const PHOTO = F + '/label-photo.jpg';

// Elements that are outside the screen or cut off by it. Returns a short description of each.
const offScreen = (sel) => {
  const vw = document.documentElement.clientWidth, vh = window.innerHeight, bad = [];
  document.querySelectorAll(sel).forEach((el) => {
    const r = el.getBoundingClientRect(); if (!r.width || !r.height) return;
    if (r.left < -0.5 || r.right > vw + 0.5 || r.top < -0.5 || r.bottom > vh + 0.5) bad.push(`${el.id || el.className} [${Math.round(r.left)},${Math.round(r.top)} → ${Math.round(r.right)},${Math.round(r.bottom)}] in ${vw}x${vh}`);
    el.querySelectorAll('button, a, [role="menuitem"]').forEach((b) => { const q = b.getBoundingClientRect(); if (q.width && (q.left < -0.5 || q.right > vw + 0.5)) bad.push('item ' + (b.textContent || '').trim().slice(0, 24)); });
  });
  return bad;
};
// Text that is clipped with an ellipsis or by its own box.
const clipped = (sel) => [...document.querySelectorAll(sel)].filter((el) => el.offsetParent && el.scrollWidth > el.clientWidth + 1).map((el) => (el.textContent || '').trim().slice(0, 30));

(async () => {
  if (!fs.existsSync(PHOTO)) await require('../fixtures/mkphoto.js')(PHOTO);
  const br = await chromium.launch({ executablePath: require('../chrome') });
  const phone = async (width, extra) => {
    const ctx = await br.newContext({ viewport: { width, height: 740 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2, serviceWorkers: 'block', ...(extra || {}) });
    await ctx.addInitScript(() => { try { localStorage.setItem('nd:seen', '1'); localStorage.setItem('nd:lang-choice', '1'); } catch (e) {} });
    const p = await ctx.newPage(); p.errs = []; p.on('pageerror', (e) => p.errs.push(e.message)); return p;
  };

  /* ---------- 1. at rest means at rest ---------- */
  {
    const p = await phone(390);
    for (const path of ['/', '/pdf-studio/', '/password-generator/', '/tools/', '/ar/', '/speed-test/']) {
      await p.goto(B + path); await p.waitForTimeout(2500);
      const running = await p.evaluate(() => document.getAnimations().filter((a) => a.playState === 'running' && a.effect && a.effect.getComputedTiming().iterations === Infinity)
        .map((a) => (a.animationName || '?') + ' on ' + ((a.effect.target && (a.effect.target.id || a.effect.target.className.baseVal || a.effect.target.className || a.effect.target.tagName)) || '?')));
      ok(running.length === 0, `${path}: no endless animation is running on a phone` + (running.length ? ' — ' + running.join('; ') : ''));
      const blur = await p.evaluate(() => [...document.querySelectorAll('.site-header > .wrap, .aurora i')].filter((el) => { const s = getComputedStyle(el); return (s.backdropFilter && s.backdropFilter !== 'none') || (s.webkitBackdropFilter && s.webkitBackdropFilter !== 'none') || (s.filter && s.filter !== 'none'); }).length);
      ok(blur === 0, `${path}: no blur layers behind the header or the background on a phone`);
    }
    await p.context().close();
    // with a mouse the motion is allowed, but it must stop once nobody is using the page
    const d = await (await br.newContext({ viewport: { width: 1280, height: 800 }, serviceWorkers: 'block' })).newPage();
    await d.goto(B + '/'); await d.waitForTimeout(1500);
    const before = await d.evaluate(() => document.getAnimations().filter((a) => a.playState === 'running' && a.effect.getComputedTiming().iterations === Infinity).length);
    await d.waitForFunction(() => document.documentElement.classList.contains('idle'), null, { timeout: 20000 });
    const after = await d.evaluate(() => document.getAnimations().filter((a) => a.playState === 'running' && a.effect.getComputedTiming().iterations === Infinity).length);
    ok(before > 0 && after === 0, `desktop: decorative motion runs (${before}) and pauses once the page is idle (${after})`);
    await d.mouse.move(300, 300); await d.waitForTimeout(300);
    ok(await d.evaluate(() => !document.documentElement.classList.contains('idle')), 'desktop: moving the mouse wakes the page up again');
    await d.context().close();
  }

  /* ---------- 2. menus and popovers stay on screen ---------- */
  for (const lang of ['', '/ar']) for (const width of [375, 390, 430]) {
    const tag = `${lang ? 'AR' : 'EN'} ${width}px`;
    const p = await phone(width);
    await p.goto(B + lang + '/pdf-studio/'); await p.setInputFiles('#fileIn', [F + '/report.pdf']);
    await p.waitForFunction(() => window.__studio.pages.length === 12); await p.waitForTimeout(600);
    // toolbar
    ok((await p.evaluate(offScreen, '#bar')).filter((x) => x.startsWith('item')).length === 0, `${tag}: every toolbar button is on screen`);
    ok(await p.evaluate(() => { const b = document.querySelector('#save'), r = b.getBoundingClientRect(), t = b.querySelector('span').getBoundingClientRect(), vw = document.documentElement.clientWidth;
      return t.width > 20 && t.left >= r.left && t.right <= r.right && r.left >= 0 && r.right <= vw; }), `${tag}: the Download button shows its whole label`);
    // More menu
    await p.tap('#moreBtn'); await p.waitForSelector('#moreMenu:not([hidden])'); await p.waitForTimeout(350);
    let bad = await p.evaluate(offScreen, '#moreMenu'); ok(bad.length === 0, `${tag}: the More menu is fully on screen` + (bad.length ? ' — ' + bad.slice(0, 3).join('; ') : ''));
    bad = await p.evaluate(clipped, '#moreMenu button span'); ok(bad.length === 0, `${tag}: no More menu label is cut off` + (bad.length ? ' — ' + bad.join('; ') : ''));
    ok(await p.evaluate(() => document.querySelectorAll('#moreMenu [role=menuitem]').length) === 11, `${tag}: all 11 actions are listed`);
    await p.tap('#moreMenu [data-act="ocr"]'); await p.waitForSelector('#dlgOcr[open]'); ok(true, `${tag}: “Recognise text” can be tapped and opens`);
    bad = await p.evaluate(offScreen, 'dialog[open]'); ok(bad.length === 0, `${tag}: the OCR dialog fits the screen` + (bad.length ? ' — ' + bad.slice(0, 3).join('; ') : ''));
    await p.keyboard.press('Escape');
    // every other dialog the toolbar and menu can open
    for (const act of ['stamp', 'find', 'dlopts', 'keys']) {
      await p.tap('#moreBtn'); await p.waitForSelector('#moreMenu:not([hidden])'); await p.tap(`#moreMenu [data-act="${act}"]`);
      await p.waitForSelector('dialog[open]', { timeout: 5000 }); await p.waitForTimeout(300);
      bad = await p.evaluate(offScreen, 'dialog[open]'); ok(bad.length === 0, `${tag}: the “${act}” dialog fits the screen` + (bad.length ? ' — ' + bad.slice(0, 3).join('; ') : ''));
      await p.keyboard.press('Escape'); await p.waitForSelector('dialog[open]', { state: 'detached', timeout: 3000 }).catch(() => {});
      await p.evaluate(() => document.querySelectorAll('dialog[open]').forEach((d) => d.close()));
    }
    // site header: tools menu, search, language
    await p.goto(B + lang + '/'); await p.waitForTimeout(500);
    await p.tap('.menu-btn'); await p.waitForTimeout(450);
    bad = await p.evaluate(offScreen, '.menu:not([hidden])'); ok(bad.filter((x) => x.startsWith('item')).length === 0, `${tag}: the Tools menu keeps every link on screen` + (bad.length ? ' — ' + bad.slice(0, 3).join('; ') : ''));
    await p.keyboard.press('Escape');
    await p.tap('.search-trigger, [data-cmdk], #searchBtn').catch(() => {}); await p.waitForTimeout(450);
    bad = await p.evaluate(offScreen, '.cmdk:not([hidden]), .cmdk-panel'); ok(bad.length === 0, `${tag}: search fits the screen` + (bad.length ? ' — ' + bad.slice(0, 3).join('; ') : ''));
    ok(await p.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1), `${tag}: the page does not scroll sideways`);
    ok(p.errs.length === 0, `${tag}: no script errors` + (p.errs.length ? ' — ' + p.errs[0] : ''));
    await p.context().close();
  }

  /* ---------- 3 + 4. OCR on a phone photo, inside a budget ---------- */
  {
    const p = await phone(390); const cdp = await p.context().newCDPSession(p);
    await p.addInitScript(() => { window.__lt = []; try { new PerformanceObserver((l) => l.getEntries().forEach((e) => window.__lt.push(e.duration))).observe({ type: 'longtask' }); } catch (e) {} });
    await p.goto(B + '/pdf-studio/'); await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
    let t = Date.now(); await p.setInputFiles('#fileIn', [PHOTO]); await p.waitForSelector('.pg.ready', { timeout: 60000 });
    const loadMs = Date.now() - t; ok(loadMs < 6000, `a 12 MP photo is on screen in ${loadMs} ms at 4× CPU slowdown (budget 6000)`);
    await p.tap('#moreBtn'); await p.tap('#moreMenu [data-act="ocr"]'); await p.waitForSelector('#dlgOcr[open]');
    await p.evaluate(() => { window.__lt.length = 0; });
    t = Date.now(); await p.tap('#ocrStart'); await p.waitForSelector('#ocrActs:not([hidden])', { timeout: 180000 });
    const ocrMs = Date.now() - t, text = await p.inputValue('#ocrOut');
    console.log('     OCR read: ' + text.replace(/\n+/g, ' | '));
    for (const s of ['ATF SP-IV', 'Genuine Parts', '04500-00115', 'HYUNDAI']) ok(text.includes(s), `OCR finds “${s}” on the tilted label photo`);
    ok(!/[؀-ۿ]{2,}/.test(text), 'OCR does not invent Arabic words from the barcode');
    ok(ocrMs < 30000, `OCR of the photo takes ${ocrMs} ms at 4× CPU slowdown (budget 30000)`);
    const lt = await p.evaluate(() => window.__lt); const worst = Math.round(Math.max(0, ...lt));
    ok(worst < 400, `the page stays responsive during OCR: longest main-thread task ${worst} ms (budget 400)`);
    // the text can be found again on the page, where the print is
    const w = await p.evaluate(() => window.__studio.ocrCount); ok(w === 1, 'the result is cached, not recomputed');
    await p.keyboard.press('Escape');
    const rest = await p.evaluate(() => document.getAnimations().filter((a) => a.playState === 'running' && a.effect.getComputedTiming().iterations === Infinity).length);
    ok(rest === 0, 'nothing keeps animating after OCR has finished');
    ok(p.errs.length === 0, 'no script errors' + (p.errs.length ? ' — ' + p.errs[0] : ''));
    await p.context().close();
  }

  await br.close();
  console.log(fails ? `\n${fails} FAILED` : '\nALL PASSED');
  process.exit(fails ? 1 : 0);
})();
