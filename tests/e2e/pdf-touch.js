const { chromium } = require('playwright-core');
const F = process.env.F, B = 'http://localhost:8899';
let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
(async () => {
  const br = await chromium.launch({ executablePath: require('../chrome') });
  for (const lang of ['', '/ar']) {
    const ctx = await br.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
    const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
    const cdp = await ctx.newCDPSession(p);
    const touch = (type, x, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y }] });
    await p.goto(B + lang + '/pdf-studio/'); await p.setInputFiles('#fileIn', [F + '/report.pdf']);
    await p.waitForFunction(() => window.__studio.pages.length === 12); await p.waitForTimeout(1200);
    const box = async (i) => p.locator(`#grid > .pg:nth-child(${i + 1}) .pg-paper`).boundingBox();
    // tap toggles selection (touch)
    await p.evaluate(() => scrollTo(0, document.querySelector('#grid').getBoundingClientRect().top + scrollY - 160)); await p.waitForTimeout(400);
    let a = await box(0); await p.tap(`#grid > .pg:nth-child(1) .pg-paper`); await p.tap(`#grid > .pg:nth-child(2) .pg-paper`);
    ok((await p.evaluate(() => window.__studio.selected.length)) === 2, lang + ' taps add to the selection (no modifier keys on phones)');
    await p.tap(`#grid > .pg:nth-child(1) .pg-paper`); await p.tap(`#grid > .pg:nth-child(2) .pg-paper`);
    // quick swipe should scroll, not drag
    a = await box(2); const y0 = await p.evaluate(() => scrollY);
    await touch('touchStart', a.x + 50, a.y + 100); for (let k = 1; k <= 8; k++) { await touch('touchMove', a.x + 50, a.y + 100 - k * 30); await p.waitForTimeout(16); } await touch('touchEnd');
    await p.waitForTimeout(400);
    ok(!(await p.isVisible('.st-ghost')) && (await p.evaluate(() => window.__studio.pages.map(x => x.index).join())) === '0,1,2,3,4,5,6,7,8,9,10,11', lang + ' a quick swipe scrolls instead of dragging');
    await p.evaluate(() => scrollTo(0, document.querySelector('#grid').getBoundingClientRect().top + scrollY - 160)); await p.waitForTimeout(300);
    // long-press drag page 4 → before page 1
    a = await box(3); const b = await box(0);
    await touch('touchStart', a.x + a.width / 2, a.y + a.height / 2); await p.waitForTimeout(500);
    ok(await p.isVisible('.st-ghost'), lang + ' press-and-hold picks the page up');
    const tx = lang ? b.x + b.width - 10 : b.x + 10;                       // leading edge of page 1 (right side in Arabic)
    for (let k = 1; k <= 12; k++) await touch('touchMove', a.x + a.width / 2 + (tx - a.x - a.width / 2) * k / 12, a.y + a.height / 2 + (b.y + b.height / 2 - a.y - a.height / 2) * k / 12);
    await p.waitForTimeout(150); await touch('touchEnd'); await p.waitForTimeout(500);
    const order = await p.evaluate(() => window.__studio.pages.slice(0, 3).map(x => x.index + 1).join());
    ok(order === '4,1,2', lang + ' long-press drag moved page 4 to the front: ' + order);
    if (lang) ok(await p.evaluate(() => document.documentElement.dir) === 'rtl', 'Arabic studio is RTL');
    ok(!errs.length, lang + ' no errors ' + errs.join('|'));
    await ctx.close();
  }
  await br.close(); console.log(fails ? fails + ' FAILED' : 'ALL PASSED');
})().catch(e => { console.error(e); process.exit(2); });
