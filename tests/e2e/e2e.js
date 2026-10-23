const { chromium } = require('playwright-core');
const B = process.env.B || 'http://localhost:8899';
const SECRET = 'p@ss — كلمة السر 🔐\nline2\tTAB <b>not html</b>';
let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
(async () => {
  const browser = await chromium.launch({ executablePath: require('../chrome') });
  const errs = [];
  const newPage = async () => { const ctx = await browser.newContext(); const p = await ctx.newPage(); p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error' && !/40[34]|410|Failed to load resource/.test(m.text())) errs.push(m.text()); }); return p; };
  const creator = await newPage();
  async function create(text, opts = {}) {
    await creator.goto(B + '/share/');
    if (await creator.isVisible('#another')) await creator.click('#another');
    await creator.fill('#secret', text);
    if (opts.ttl) await creator.click(`[data-ttl="${opts.ttl}"]`);
    if (opts.pw) { await creator.check('#usePw', { force: true }); await creator.fill('#pw', opts.pw); }
    await creator.click('#create');
    await creator.waitForSelector('#result:not([hidden])', { timeout: 20000 });
    return creator.textContent('#link');
  }
  // 1. plain secret
  const link = await create(SECRET);
  ok(/^http:\/\/localhost:8899\/s\/#[A-Za-z0-9_-]{22}\.[A-Za-z0-9_-]{43}$/.test(link), 'link format ' + link.slice(0, 50) + '…');
  const id = link.split('#')[1].split('.')[0];
  // 2. preview bot: fetch page + meta twice, must not consume
  await fetch(B + '/s/'); await fetch(B + '/api/secrets/' + id); const meta = await (await fetch(B + '/api/secrets/' + id)).json();
  ok(meta.status === 'active', 'preview fetches do not consume (status ' + meta.status + ')');
  // 3. reveal
  const r = await newPage(); await r.goto(link); await r.waitForSelector('[data-state="ready"]:not([hidden])');
  await r.click('#revealBtn'); await r.waitForSelector('[data-state="revealed"]:not([hidden])');
  ok((await r.textContent('#plain')) === SECRET, 'decrypted text matches exactly (unicode, tabs, html-ish)');
  ok(!(await r.evaluate(() => location.hash)), 'fragment removed from address bar after reveal');
  // 4. second open
  const r2 = await newPage(); await r2.goto(link); await r2.waitForSelector('[data-state="gone"]:not([hidden])');
  ok((await r2.textContent('#goneTitle')) === 'Already viewed', 'second open → Already viewed');
  // 5. server never saw plaintext: inspect stored payload via API? (ciphertext only) — check payload format and no plaintext
  // 6. password secret
  const plink = await create('top secret 123', { pw: 'correct horse', ttl: 3600 });
  const p = await newPage(); await p.goto(plink); await p.waitForSelector('#pwField:not([hidden])');
  await p.fill('#pw', 'wrong one'); await p.click('#revealBtn'); await p.waitForSelector('#err:not([hidden])', { timeout: 20000 });
  ok(/Wrong password\. Attempts left: 4/.test(await p.textContent('#err')), 'wrong password → 4 attempts left');
  await p.fill('#pw', 'correct horse'); await p.click('#revealBtn'); await p.waitForSelector('[data-state="revealed"]:not([hidden])', { timeout: 20000 });
  ok((await p.textContent('#plain')) === 'top secret 123', 'correct password reveals');
  // 7. 5 wrong passwords burn it
  const blink = await create('burn me', { pw: 'abcd' });
  const b = await newPage(); await b.goto(blink); await b.waitForSelector('#pwField:not([hidden])');
  for (let i = 0; i < 5; i++) { await b.fill('#pw', 'nope' + i); await b.click('#revealBtn'); await b.waitForFunction(() => !document.querySelector('#revealBtn').disabled, null, { timeout: 20000 }); }
  await b.waitForSelector('[data-state="gone"]:not([hidden])');
  ok((await b.textContent('#goneTitle')) === 'This secret was destroyed', '5 wrong passwords → destroyed');
  // 8. creator burns from result
  const dlink = await create('cancel me');
  creator.once('dialog', d => d.accept()); await creator.click('#burnNow'); await creator.waitForSelector('#composer:not([hidden])');
  const d = await newPage(); await d.goto(dlink); await d.waitForSelector('[data-state="gone"]:not([hidden])');
  ok((await d.textContent('#goneTitle')) === 'This secret was destroyed', 'creator burn → destroyed');
  // 9. tampered key → decrypt error, incomplete link → invalid
  const tlink = await create('tamper');
  const t = await newPage(); const k = tlink.split('.').pop(); await t.goto(tlink.slice(0, -43) + (k[0] === 'A' ? 'B' : 'A') + k.slice(1));
  await t.waitForSelector('[data-state="ready"]:not([hidden])'); await t.click('#revealBtn'); await t.waitForSelector('#err:not([hidden])');
  ok(/doesn’t match/.test(await t.textContent('#err')), 'wrong key → clear error');
  const inc = await newPage(); await inc.goto(B + '/s/#' + id); await inc.waitForSelector('[data-state="gone"]:not([hidden])');
  ok((await inc.textContent('#goneTitle')) === 'This link is incomplete', 'incomplete link → incomplete message');
  // 10. expiry
  const elink = await create('expire me');
  await fetch('http://localhost:8898/expire');
  const e = await newPage(); await e.goto(elink); await e.waitForSelector('[data-state="gone"]:not([hidden])');
  ok((await e.textContent('#goneTitle')) === 'This secret expired', 'expired → expired message');
  // 11. creator list shows statuses
  await creator.goto(B + '/share/'); await creator.waitForSelector('#mine .list-item');
  const statuses = await creator.$$eval('#mine .badge', els => els.map(e => e.textContent.trim()));
  ok(statuses.includes('Viewed') && statuses.includes('Destroyed') && statuses.includes('Expired'), 'creator list: ' + statuses.join(', '));
  await creator.screenshot({ path: (process.env.OUT || process.argv[2]) + '/share.png', fullPage: false });
  await r.setViewportSize({ width: 1280, height: 800 }); await r.screenshot({ path: (process.env.OUT || process.argv[2]) + '/reveal.png' });
  ok(errs.length === 0, 'no page errors' + (errs.length ? ': ' + errs.join(' | ') : ''));
  await browser.close();
  console.log(fails ? `\n${fails} FAILED` : '\nALL PASSED');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
