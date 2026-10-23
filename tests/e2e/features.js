const { chromium } = require('playwright-core');
const B = process.env.B || 'http://localhost:8899';
let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
(async () => {
  const br = await chromium.launch({ executablePath: require('../chrome') }); const errs = [];
  const page = async (ctx) => { const p = await (ctx || await br.newContext()).newPage(); p.on('pageerror', e => errs.push(e.message)); return p; };
  /* ---- link checker ---- */
  const lc = await page(); await lc.goto(B + '/link-checker/');
  const reqs = []; lc.on('request', r => { if (r.url().includes('/api/linkcheck')) reqs.push(r.url()); });
  const check = async (u) => { await lc.fill('#url', u); await lc.click('#form button[type=submit]'); await lc.waitForFunction(() => document.querySelector('#verdict').dataset.kind !== 'busy', null, { timeout: 15000 }); return { kind: await lc.getAttribute('#verdict', 'data-kind'), title: await lc.textContent('#vTitle'), f: (await lc.$$eval('#findings .check span', e => e.map(x => x.textContent))).join(' | ') }; };
  const cases = [

    ['absher-sa-verify.info/login', 'bad', /scam/i],
    ['https://www.absher.sa/wps/portal/individuals', 'good', /Official/],
    ['alrajhlbank.com.sa', 'bad', /scam/i],
    ['http://192.168.0.1/admin', 'bad', /scam/i],
    ['bit.ly/3xYz', 'warn', /careful/i],
    ['https://xn--pple-43d.com', 'bad', /scam/i],
    ['spl-delivery.top/fee', 'bad', /scam/i],
    ['https://example.com/download/app.apk', 'bad', /scam/i],
    ['https://www.wikipedia.org', 'good', /No warning signs/],
    ['pineapple.com', 'good', /No warning signs/],
    ['not a link at all', 'warn', /doesn’t look like a link/],
  ];
  for (const [u, kind, re] of cases) { const r = await check(u); ok(r.kind === kind && re.test(r.title), `${u.slice(0, 40).padEnd(40)} → ${r.title}${r.f ? '  [' + r.f.slice(0, 90) + ']' : ''}`); }
  ok(reqs.length > 0 && reqs.every(x => /\/api\/linkcheck\?p=([0-9a-f]{5},?)+$/.test(x)), 'server only ever received 5-char hash prefixes (' + reqs.length + ' requests)');
  ok(reqs.every(x => !/absher|alrajh|wikipedia|example|bit\.ly|192\.168/.test(x)), 'no link text in any request');
  const wa = await lc.getAttribute('#ncaWa', 'href'); ok(wa.startsWith('https://wa.me/966118136644?text='), 'NCA Tahqaq WhatsApp link prefilled');
  /* fragment hand-off */
  const fr = await page(); await fr.goto(B + '/link-checker/#' + encodeURIComponent('absher-update.xyz')); await fr.waitForFunction(() => document.querySelector('#verdict').dataset.kind && document.querySelector('#verdict').dataset.kind !== 'busy', null, { timeout: 15000 });
  ok((await fr.textContent('#vTitle')) === 'Likely a scam' && !(await fr.evaluate(() => location.hash)), '#fragment hand-off works and is cleared');
  /* ---- instant answers ---- */
  const ia = await page(); await ia.goto(B + '/');
  const ask = async (q) => { await ia.keyboard.press('Control+k'); await ia.waitForSelector('.cmdk-backdrop.open'); await ia.fill('.cmdk-input input', q); await ia.waitForTimeout(250); const v = await ia.$('.cmdk-answer .ans-value'); const t = v ? await v.textContent() : null; await ia.keyboard.press('Escape'); return t; };
  const tests = [['pw 24', v => v && v.length === 24], ['pin', v => /^\d{6}$/.test(v)], ['uuid', v => /^[0-9a-f-]{36}$/.test(v)], ['10 km in mi', v => v === '6.2137119224 mi'],
    ['100 c to f', v => v === '212 °F'], ['15% of 200', v => v === '30'], ['(3+4)*2^3', v => v === '56'], ['sha256 hello', v => v === '2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824'],
    ['b64 hello', v => v === 'aGVsbG8='], ['snake Hello World', v => v === 'hello_world'], ['hijri', v => / AH$/.test(v)], ['example.com/path', v => v === 'example.com/path'], ['2 gb to mb', v => v === '2,000 MB'], ['hash', v => v === null]];
  for (const [q, f] of tests) { const v = await ask(q); ok(f(v), `answer "${q}" → ${v}`); }
  await ia.keyboard.press('Control+k'); await ia.fill('.cmdk-input input', '15% of 200'); await ia.waitForTimeout(200); await ia.context().grantPermissions(['clipboard-read', 'clipboard-write']); await ia.keyboard.press('Enter'); await ia.waitForTimeout(200);
  ok((await ia.evaluate(() => navigator.clipboard.readText())) === '30', 'Enter copies the answer');
  /* ---- suggestions ---- */
  const sp = await page(); await sp.goto(B + '/suggest/'); await sp.waitForTimeout(3000);
  await sp.fill('#title', 'Prayer times'); await sp.fill('#details', 'Umm al-Qura prayer times for my city'); await sp.click('#form button[type=submit]');
  await sp.waitForSelector('#okMsg:not([hidden])'); ok(/reviewed/.test(await sp.textContent('#okMsg')), 'suggestion accepted, awaiting review');
  await sp.reload(); await sp.waitForTimeout(500); ok((await sp.$$('.idea')).length === 0, 'pending suggestion not public');
  await sp.waitForTimeout(3000); await sp.fill('#title', 'Spam site'); await sp.fill('#details', 'visit https://spam.example'); await sp.click('#form button[type=submit]'); await sp.waitForTimeout(500);
  ok(/without links/.test(await sp.textContent('#form .msg.err')), 'links rejected');
  const bot = await sp.evaluate(async () => (await fetch('/api/suggestions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title: 'Bot idea', website: 'x', t: Date.now() - 9999 }) })).status);
  const fast = await sp.evaluate(async () => (await fetch('/api/suggestions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title: 'Too fast idea', t: Date.now() }) })).status);
  ok(bot === 201 && fast === 400, 'honeypot silently ignored, instant submit rejected');
  // owner approves
  const actx = await br.newContext(); await actx.request.post(B + '/api/register', { data: { username: 'OwnerX', email: 'o@x.io', password: 'owner pass 1' } }).catch(() => {});
  const login = await actx.request.post(B + '/api/login', { data: { email: 'OwnerX', password: 'owner pass 1' } });
  const ad = await page(actx); await ad.goto(B + '/admin/'); await ad.waitForSelector('#sugg [data-st="open"]', { timeout: 8000 });
  ok(/1 waiting for review/.test(await ad.textContent('#pendingBadge')) && login.ok(), 'admin sees "1 waiting for review" (bot entry was never stored)');
  await ad.click('#sugg [data-st="open"]'); await ad.waitForTimeout(500);
  await sp.reload(); await sp.waitForSelector('.idea'); ok((await sp.textContent('.idea-title')).includes('Prayer times'), 'approved suggestion is public');
  await sp.click('.vote'); await sp.waitForTimeout(400); ok((await sp.textContent('.vote b')) === '1' && await sp.getAttribute('.vote', 'aria-pressed') === 'true', 'vote counted');
  await sp.reload(); await sp.waitForSelector('.vote.on'); ok(true, 'vote remembered in this browser (no server identifiers)');
  await sp.click('.vote'); await sp.waitForTimeout(400); ok((await sp.textContent('.vote b')) === '0', 'vote can be undone');
  ok(!errs.length, 'no page errors ' + errs.join(' | '));
  await br.close(); console.log(fails ? fails + ' FAILED' : 'ALL PASSED');
})().catch(e => { console.error(e); process.exit(2); });
