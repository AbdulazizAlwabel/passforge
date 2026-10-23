const { chromium } = require('playwright-core');
const B = 'http://localhost:8899';
let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
(async () => {
  const br = await chromium.launch({ executablePath: require('../chrome') }); const errs = [];
  const ctx = async (user) => {
    const c = await br.newContext(); const p = await c.newPage(); p.on('pageerror', e => errs.push(e.message));
    if (user) {
      await c.request.post(B + '/api/register', { data: { username: user, email: user + '@x.io', password: 'pass ' + user + ' 1' } });
      const r = await c.request.post(B + '/api/login', { data: { email: user, password: 'pass ' + user + ' 1' } }); if (!r.ok()) throw new Error('login failed ' + user);
    }
    return { c, p };
  };
  // owner first so it gets user id 1 (ADMIN_USER_IDS=1 in the test harness)
  const owner = await ctx('OwnerAcct'); const member = await ctx('NormalUser'); const anon = await ctx(null);
  for (const [who, { c, p }, expectCard, expectApi] of [['visitor', anon, false, 401], ['normal user', member, false, 403], ['owner', owner, true, 200]]) {
    for (const path of ['/widgets/', '/ar/widgets/']) {
      await p.goto(B + path); await p.waitForTimeout(900);
      const visible = await p.isVisible('#ownerCard');
      ok(visible === expectCard, `${who} ${path}: status card ${visible ? 'shown' : 'hidden'}`);
    }
    const js = await c.request.get(B + '/api/admin/widgets/site-status.js'); const sc = await c.request.get(B + '/api/admin/widgets/site-status.scriptable');
    ok(js.status() === expectApi && sc.status() === expectApi, `${who}: widget files → ${js.status()} / ${sc.status()}`);
    if (expectApi === 200) {
      const d = JSON.parse(await sc.text()); ok(d.name === 'Site Status' && d.script.includes('api/health') && /attachment/.test(sc.headers()['content-disposition']), 'owner gets a valid .scriptable download');
      await p.goto(B + '/widgets/'); await p.waitForTimeout(900); ok((await p.textContent('#sTxt')) === 'Up', 'owner preview shows live status: ' + await p.textContent('#sTxt'));
    }
  }
  for (const f of ['/widgets/site-status.js', '/widgets/Site%20Status.scriptable']) { const r = await anon.c.request.get(B + f); ok(r.status() === 404, `public ${f} → ${r.status()} (removed)`); }
  ok(!errs.length, 'no page errors ' + errs.join('|'));
  await br.close(); console.log(fails ? fails + ' FAILED' : 'ALL PASSED');
})().catch(e => { console.error(e); process.exit(2); });
