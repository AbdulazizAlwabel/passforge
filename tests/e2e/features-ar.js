const { chromium } = require('playwright-core');
const B = 'http://localhost:8899';
let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
(async () => {
  const br = await chromium.launch({ executablePath: require('../chrome') }); const errs = [];
  const pg = async () => { const p = await br.newPage({ viewport: { width: 1280, height: 900 } }); p.on('pageerror', e => errs.push(e.message)); return p; };
  const lc = await pg(); await lc.goto(B + '/ar/link-checker/');
  for (const [u, re] of [['absher-sa-verify.info/login', /على الأرجح احتيال/], ['https://www.absher.sa', /عنوان رسمي/], ['bit.ly/x1', /كن حذرًا/]]) {
    await lc.fill('#url', u); await lc.click('#form button[type=submit]'); await lc.waitForFunction(() => document.querySelector('#verdict').dataset.kind !== 'busy', null, { timeout: 15000 });
    const t = await lc.textContent('#vTitle'), f = (await lc.$$eval('#findings .check span', e => e.map(x => x.textContent))).join(' | ');
    ok(re.test(t), `${u} → ${t} [${f.slice(0, 110)}]`);
  }
  ok(/فُحص مقابل [\d,]+ تهديدًا معروفًا/.test(await lc.textContent('#feeds')), 'feeds line arabic: ' + (await lc.textContent('#feeds')).slice(0, 60));
  await lc.screenshot({ path: (process.env.OUT || process.argv[2]) + '/lc-ar.png', fullPage: true });
  const ia = await pg(); await ia.goto(B + '/ar/');
  for (const [q, re] of [['كلمة مرور 24', /^\S{24}$/], ['10 كم الى ميل', /^6\.2137119224 mi$/], ['هجري', / هـ$/], ['١٥% من ٢٠٠', /^30$/], ['example.com', /example\.com/]]) {
    await ia.keyboard.press('Control+k'); await ia.waitForSelector('.cmdk-backdrop.open'); await ia.fill('.cmdk-input input', q); await ia.waitForTimeout(250);
    const v = await ia.$('.cmdk-answer .ans-value'), l = await ia.$('.cmdk-answer .ans-label');
    ok(v && re.test(await v.textContent()), `answer "${q}" → ${v ? await v.textContent() : null}  (${l ? await l.textContent() : ''})`);
    await ia.keyboard.press('Escape');
  }
  await ia.keyboard.press('Control+k'); await ia.waitForTimeout(200); ok(/جرّب/.test(await ia.textContent('.cmdk-try')), 'arabic examples row: ' + (await ia.textContent('.cmdk-try')).slice(0, 60)); await ia.screenshot({ path: (process.env.OUT || process.argv[2]) + '/cmdk-ar.png' }); await ia.keyboard.press('Escape');
  for (const path of ['/ar/link-checker/', '/ar/suggest/', '/ar/']) {
    const p = await pg(); await p.goto(B + path); await p.waitForTimeout(900);
    const latin = await p.evaluate(() => { const out = new Set(); const tw = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      while (tw.nextNode()) { const el = tw.currentNode.parentElement; if (!el || el.closest('code,.kbd,script,.brand,.foot-big,.tile-preview,.specimen,.mono,[hidden],.lang-switch,.cmdk-backdrop')) continue; (tw.currentNode.textContent.match(/[A-Za-z]{3,}/g) || []).forEach(x => out.add(x)); } return [...out]; });
    console.log('  ' + path + ' latin words:', latin.join(', '));
    if (path === '/ar/suggest/') await p.screenshot({ path: (process.env.OUT || process.argv[2]) + '/suggest-ar.png', fullPage: true });
  }
  ok(!errs.length, 'no page errors ' + errs.join(' | '));
  await br.close(); console.log(fails ? fails + ' FAILED' : 'ALL PASSED');
})().catch(e => { console.error(e); process.exit(2); });
