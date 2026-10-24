// Phase 2 (dynamic): home "Try it right here" cards, pinned tools, crack-time bar, link anatomy — English and Arabic.
const { chromium } = require('playwright-core');
const B = process.env.B || 'http://localhost:8899';
let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
(async () => {
  const br = await chromium.launch({ executablePath: require('../chrome') }); const errs = [];
  for (const L of ['', '/ar']) {
    const tag = L ? 'ar' : 'en';
    const ctx = await br.newContext({ viewport: { width: 1280, height: 900 } });
    const p = await ctx.newPage(); p.on('pageerror', (e) => errs.push(tag + ': ' + e.message));
    await p.goto(B + L + '/');
    // 1) strength card — same estimate as the Strength Checker
    await p.fill('#tryPw', 'password');
    ok(await p.getAttribute('#tryMeter', 'data-level') === '1', tag + ': "password" is very weak on the home card');
    await p.fill('#tryPw', 'q7#Lp!2vXz@9Wm$4Rt8&');
    ok(await p.getAttribute('#tryMeter', 'data-level') === '5', tag + ': a long random password is excellent on the home card');
    ok(!/[a-z]{3,} \{|\{time\}/.test(await p.textContent('#tryOut')), tag + ': time wording filled in: ' + (await p.textContent('#tryOut')).trim());
    await p.fill('#tryPw', '');
    ok(/leaves this page|ما يطلع/.test(await p.textContent('#tryOut')), tag + ': empty card shows the privacy line');
    // 2) password card
    await p.waitForTimeout(800);
    const pw = (await p.textContent('#tryGen')).trim();
    ok(pw.length === 20, tag + ': fresh 20-character password (' + pw.length + ')');
    await p.click('#tryNew'); await p.waitForTimeout(800);
    ok((await p.textContent('#tryGen')).trim() !== pw, tag + ': “New one” makes a different password');
    // 3) today card
    const hj = await p.textContent('#tryHijri');
    ok(/14\d\d/.test(hj) && (L ? /هـ/.test(hj) : /AH/.test(hj)), tag + ': Hijri date shown: ' + hj);
    ok(L ? /[؀-ۿ]/.test(await p.textContent('#tryGreg')) : /\d{4}/.test(await p.textContent('#tryGreg')), tag + ': Gregorian date shown');
    if (!(await p.isHidden('#tryNext'))) ok(/\d|tomorrow|بكرة|Mubarak|مبارك/.test(await p.textContent('#tryNext')), tag + ': next Ramadan / Eid line: ' + await p.textContent('#tryNext'));
    // pins + recent
    ok(await p.isHidden('#recent'), tag + ': “Your tools” hidden on a first visit');
    await p.goto(B + L + '/link-checker/');
    await p.goto(B + L + '/vault/');
    await p.click('.pin-btn');
    ok(await p.getAttribute('.pin-btn', 'aria-pressed') === 'true', tag + ': pin button turns on');
    await p.goto(B + L + '/');
    const items = await p.$$eval('#recentList .recent-i', (e) => e.map((x) => [x.getAttribute('href'), x.classList.contains('pinned')]));
    ok(items.length >= 2 && items[0][1] && /vault/.test(items[0][0]), tag + ': pinned tool comes first: ' + JSON.stringify(items));
    ok(items.some(([h, pin]) => /link-checker/.test(h) && !pin), tag + ': recently used tool listed too');
    ok(items.every(([h]) => L ? h.startsWith('/ar/') : !h.startsWith('/ar/')), tag + ': links stay in the same language');
    await p.goto(B + L + '/vault/'); await p.click('.pin-btn');
    ok(await p.getAttribute('.pin-btn', 'aria-pressed') === 'false', tag + ': pin button turns off again');
    // crack-time bar
    await p.goto(B + L + '/strength-checker/');
    await p.fill('#pw', 'abc'); await p.waitForTimeout(100);
    const low = parseFloat(await p.evaluate(() => getComputedStyle(document.getElementById('ctime')).getPropertyValue('--p')));
    await p.fill('#pw', 'q7#Lp!2vXz@9Wm$4Rt8&'); await p.waitForTimeout(100);
    const high = parseFloat(await p.evaluate(() => getComputedStyle(document.getElementById('ctime')).getPropertyValue('--p')));
    ok(low < 5 && high > 95, tag + ': crack-time bar moves from ' + low + '% to ' + high + '%');
    ok((await p.textContent('#ctimeV')).trim().length > 2, tag + ': crack-time value: ' + await p.textContent('#ctimeV'));
    // link anatomy
    await p.goto(B + L + '/link-checker/');
    await p.fill('#url', 'http://secure.absher-sa-verify.info/login?id=7'); await p.click('#form button');
    await p.waitForSelector('.ua-seg');
    const segs = await p.$$eval('.ua-seg', (e) => e.map((x) => [x.querySelector('code').textContent, x.className]));
    const seg = (t) => (segs.find(([c]) => c === t) || [])[1] || '';
    ok(/bad/.test(seg('absher-sa-verify')), tag + ': website name flagged red ' + JSON.stringify(segs));
    ok(/warn/.test(seg('.info')), tag + ': risky ending flagged');
    ok(/warn/.test(seg('http://')), tag + ': http flagged');
    ok(/absher-sa-verify\.info/.test(await p.textContent('.ua-real')), tag + ': says where the link really goes');
    await p.fill('#url', 'https://www.absher.sa/portal'); await p.click('#form button'); await p.waitForTimeout(400);
    ok(/good/.test((await p.$$eval('.ua-seg', (e) => e.map((x) => x.className))).join(' ')), tag + ': official site marked green');
    await p.fill('#url', 'bit.ly/x1'); await p.click('#form button'); await p.waitForTimeout(400);
    ok(/short link|رابط مختصر/.test(await p.textContent('.ua-real')), tag + ': short link explained');
    await ctx.close();
  }
  // motion: first visit, done moments, cards that grow into the page
  {
    const ctx = await br.newContext({ viewport: { width: 1280, height: 900 }, permissions: ['clipboard-read', 'clipboard-write'] });
    await ctx.addInitScript(() => { addEventListener('pagereveal', (e) => { const vt = !!e.viewTransition; setTimeout(() => { window.__vt = { vt, anims: [...new Set(document.getAnimations().map((a) => a.effect && a.effect.pseudoElement).filter(Boolean))] }; }, 30); }); });
    const p = await ctx.newPage(); p.on('pageerror', (e) => errs.push('motion: ' + e.message));
    await p.goto(B + '/');
    ok(await p.evaluate(() => document.documentElement.classList.contains('nd-first')), 'first visit: the logo check draws itself');
    ok(await p.locator('.scribble-u path').count() === 2, 'headline underline is there');
    await p.reload();
    ok(!(await p.evaluate(() => document.documentElement.classList.contains('nd-first'))), 'second visit: no logo animation');
    for (const L of ['', '/ar']) {
      await p.goto(B + L + '/'); await p.waitForTimeout(300);
      await p.click('.tasks .task'); await p.waitForURL(/pdf-studio/); await p.waitForTimeout(150);
      const fwd = await p.evaluate(() => window.__vt);
      ok(fwd && fwd.vt && fwd.anims.includes('::view-transition-old(vt-icon)') && fwd.anims.includes('::view-transition-new(vt-title)'), (L || 'en') + ': card grows into the tool heading ' + JSON.stringify(fwd && fwd.anims));
      ok(await p.locator('.tool-hero .tool-ic').count() === 1, (L || 'en') + ': tool page has its icon');
      await p.goBack(); await p.waitForFunction(() => window.__vt && window.__vt.fresh !== false, null, { timeout: 3000 }).catch(() => {}); await p.waitForTimeout(400);
      const back = await p.evaluate(() => window.__vt);
      ok(back && back.anims.includes('::view-transition-old(vt-icon)') && back.anims.includes('::view-transition-new(vt-icon)'), (L || 'en') + ': and shrinks back into its card ' + JSON.stringify(back && back.anims));
      ok(!(await p.evaluate(() => { const n = {}; for (const el of document.querySelectorAll('*')) { const v = el.style.viewTransitionName; if (v) { if (n[v]) return true; n[v] = 1; } } return false; })), (L || 'en') + ': no duplicate transition names left behind');
    }
    await p.goto(B + '/password-generator/'); await p.waitForTimeout(300);
    await p.click('#copyPw'); await p.waitForSelector('#copyPw svg.ic-done', { timeout: 2000 }).catch(() => {});
    ok(await p.locator('#copyPw svg.ic-done').count() === 1, 'copy: the button icon turns into a check');
    ok(await p.evaluate(() => document.querySelector('.toast').classList.contains('toast-done')), 'copy: toast draws its check');
    await p.waitForTimeout(1600);
    ok(await p.locator('#copyPw svg.ic-done').count() === 0 && await p.locator('#copyPw svg').count() === 1, 'copy: the original icon comes back');
    await p.evaluate(() => ND.done('Saved test.pdf'));
    ok(await p.evaluate(() => { const t = document.querySelector('.toast'); return t.classList.contains('toast-file') && !!t.querySelector('.t-file') && /Saved test\.pdf/.test(t.textContent); }), 'download toast: the file drops in');
    await p.click('.pin-btn');
    ok(await p.evaluate(() => document.querySelector('.pin-btn').classList.contains('burst')), 'pin: the star pops');
    await p.click('.pin-btn');
    await ctx.close();
  }
  // reduced motion: no tilt, password appears at once
  const rm = await br.newContext({ reducedMotion: 'reduce' }); const q = await rm.newPage();
  await q.goto(B + '/'); ok((await q.textContent('#tryGen')).trim().length === 20 && !(await q.$('#tryGen .scramble')), 'reduced motion: password shown without the scramble');
  await q.hover('.task'); ok(!(await q.$('.task.spot')), 'reduced motion: cards don’t tilt');
  ok(await q.evaluate(() => getComputedStyle(document.querySelector('.scribble-u path')).strokeDashoffset) === '0px' || await q.evaluate(() => getComputedStyle(document.querySelector('.scribble-u path')).strokeDashoffset) === '0', 'reduced motion: underline simply shown');
  ok(await q.evaluate(() => getComputedStyle(document.querySelector('.note')).animationName) === 'none', 'reduced motion: the note doesn’t drop');
  await rm.close();
  ok(!errs.length, 'no page errors ' + errs.join(' | '));
  await br.close(); console.log(fails ? fails + ' FAILED' : 'ALL PASSED');
})().catch((e) => { console.error(e); process.exit(2); });
