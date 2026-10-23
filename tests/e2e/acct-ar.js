const { chromium } = require('playwright-core');
const T = require(require('path').resolve(__dirname, '../..') + '/server/twofa.js');
const B = 'http://localhost:8899', OUT = (process.env.OUT || process.argv[2]);
let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
(async () => {
  const br = await chromium.launch({ executablePath: require('../chrome') }); const errs = [];
  for (const [name, vp, scheme] of [['desk-dark', { width: 1340, height: 900 }, 'dark'], ['phone-light', { width: 390, height: 844 }, 'light']]) {
    const ctx = await br.newContext({ viewport: vp, colorScheme: scheme, deviceScaleFactor: 1 });
    const p = await ctx.newPage(); p.on('pageerror', e => errs.push(e.message));
    const u = 'u' + name.replace('-', '');
    await ctx.request.post(B + '/api/register', { data: { username: u, email: u + '@x.io', password: 'pass word 1234' } });
    await ctx.request.post(B + '/api/login', { data: { email: u, password: 'pass word 1234' } });
    // English: vault signed-out hero + create
    const anon = await br.newContext({ viewport: vp, colorScheme: scheme }); const pa = await anon.newPage();
    await pa.goto(B + '/vault/'); await pa.waitForSelector('[data-s="signedout"]:not([hidden])'); await pa.waitForTimeout(500); await pa.screenshot({ path: `${OUT}/${name}-vault-signedout.png` }); await anon.close();
    // profile 2FA setup
    await p.goto(B + '/profile/'); await p.waitForSelector('#tfaStart:visible'); await p.click('#tfaStart'); await p.waitForSelector('#tfaQr svg');
    await p.locator('#tfaPanel').screenshot({ path: `${OUT}/${name}-2fa-setup.png` });
    const secret = (await p.textContent('#tfaSecret')).replace(/\s/g, '');
    await p.fill('#tfaCode', T.hotp(T.unbase32(secret), Math.floor(Date.now() / 30000))); await p.click('#tfaConfirm button[type=submit]'); await p.waitForSelector('#tfaCodes:not([hidden])');
    await p.locator('#tfaPanel').screenshot({ path: `${OUT}/${name}-2fa-codes.png` }); await p.click('#rcDone');
    // Arabic vault flow
    await p.goto(B + '/ar/vault/'); await p.waitForSelector('[data-s="create"]:not([hidden])');
    ok(await p.evaluate(() => document.documentElement.dir === 'rtl'), name + ': Arabic vault is RTL');
    ok(/اختر عبارة مرور/.test(await p.textContent('[data-s="create"]')), name + ': Arabic create heading');
    await p.click('#cpSuggest'); await p.waitForTimeout(300);
    await p.screenshot({ path: `${OUT}/${name}-ar-create.png` });
    await p.click('#createForm button[type=submit]'); await p.waitForSelector('[data-s="recovery"]:not([hidden])', { timeout: 15000 });
    await p.screenshot({ path: `${OUT}/${name}-ar-recovery.png` });
    await p.check('#rkSaved', { force: true }); await p.click('#rkDone'); await p.waitForSelector('[data-s="open"]:not([hidden])');
    const add = async (type, fill) => { await p.click(`[data-new="${type}"]`); await p.waitForSelector('#itemForm'); for (const [k, v] of Object.entries(fill)) await p.fill('#f_' + k, v); await p.click('#itemForm button[type=submit]'); await p.waitForTimeout(400); };
    await add('login', { title: 'البنك الأهلي', url: 'https://alahli.example', username: 'aziz', password: 'password123' });
    await add('login', { title: 'GitHub', url: 'https://github.com', username: 'aziz@x.io' });
    await add('note', { title: 'شبكة المنزل', body: 'الاسم: Home\nالمفتاح: abc-123-xyz' });
    await add('secret', { title: 'Resend API', value: 're_xxxxxxxxxxxxxxxx' });
    ok(/4 عناصر مشفّرة/.test(await p.textContent('#vfoot')), name + ': Arabic plural "4 عناصر مشفّرة": ' + (await p.textContent('#vfoot')));
    console.log('LIST', JSON.stringify(await p.$$eval('.vitem strong', e => e.map(x => x.textContent))));
    if (await p.isVisible('.vback')) await p.click('.vback');
    await p.click('.vitem >> nth=1'); await p.waitForSelector('#itemForm'); await p.waitForTimeout(200);
    await p.screenshot({ path: `${OUT}/${name}-ar-open.png`, fullPage: false });
    await p.click('#healthBtn'); await p.waitForSelector('.health-score', { timeout: 20000 }); await p.waitForTimeout(200);
    await p.screenshot({ path: `${OUT}/${name}-ar-health.png` });
    await p.click('#lockBtn'); await p.waitForSelector('[data-s="locked"]:not([hidden])');
    ok(/4 عناصر مشفّرة/.test(await p.textContent('#lockedSub')), name + ': locked subtitle Arabic');
    await p.screenshot({ path: `${OUT}/${name}-ar-locked.png` });
    // Arabic 2FA sign-in step
    await ctx.clearCookies(); await p.goto(B + '/ar/account/'); await p.fill('#lEmail', u); await p.fill('#lPass', 'pass word 1234'); await p.click('#loginForm button[type=submit]');
    await p.waitForSelector('[data-view="twofa"]:not([hidden])'); ok(/رمز التحقق بخطوتين/.test(await p.textContent('[data-view="twofa"] h2')), name + ': Arabic 2FA heading');
    await p.fill('#tfaIn', '111111'); await p.waitForSelector('#tfaForm .msg.err:not([hidden])'); ok(/الرمز ما طابق/.test(await p.textContent('#tfaForm .msg.err')), name + ': Arabic server error message');
    await p.screenshot({ path: `${OUT}/${name}-ar-2fa-login.png` });
    await ctx.close();
  }
  ok(!errs.length, 'no page errors ' + errs.join(' | '));
  await br.close(); console.log(fails ? fails + ' FAILED' : 'ALL PASSED');
})().catch(e => { console.error(e); process.exit(2); });
