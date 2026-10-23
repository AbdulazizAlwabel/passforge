const { chromium } = require('playwright-core');
const B = process.env.B || 'http://localhost:8899';
let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
const LATIN_SCAN = () => {
  const skip = el => el.closest('code,kbd,.kbd,.mono,.mono-in,pre,.out,.brand,.foot-big,.pw-text,.specimen-pw,.tile-preview,.hash-row .val,.bits-row,.names,.case-item .txt,svg,script,style,textarea,input,.list-item .txt,.ip-big,.kv dd,.stat .v,option,select,.json-out,[dir="ltr"],.lang-switch,.cal .h');
  const words = new Set(); const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  while (w.nextNode()) { const n = w.currentNode; if (!n.parentElement || skip(n.parentElement)) continue;
    const st = getComputedStyle(n.parentElement); if (st.display === 'none' || st.visibility === 'hidden') continue;
    if (n.parentElement.closest('[hidden]')) continue;
    (n.textContent.match(/[A-Za-z][A-Za-z'’-]{2,}/g) || []).forEach(x => words.add(x)); }
  return [...words];
};
const ALLOWED = new Set(['Nicely','Done','Base64','JSON','IPv4','CIDR','PIN','UTF','Ctrl','MD5','SHA','API','HTTPS','HTTP','EFF','AES','GCM','PBKDF2','bcrypt','scrypt','Argon2','GitHub','JavaScript','Java','React','Python','SQL','CSS','HTML','URL','URLs','JWT','Unicode','Network','Have','Been','Pwned','Intl','XHR','fetch','Wi-Fi','only','HTTP-only','same-site','DevTools','camelCase','PascalCase','snake_case','kebab-case','CONSTANT_CASE','UPPERCASE','lowercase','Title','Case','Sentence','case','Web','Crypto','btoa','Basic','Aziz','Falcon','Nova','user','profile','settings','getUserProfileSettings','abc','ABC','Il1O0','qwerty','p@ssw0rd','kcal','mmHg','Torr','PSI','BTU','ASN','CGNAT','ISP','OS','KiB','MiB','GiB','TiB','emoji','data','URL','ipwho','ipapi','Train-Case','InVeRsE','aLtErNaTiNg','esreveR','slug','path','dot','case','Inspect','alternating','nicely','done','tools','Argon','CC','US','BY','gamer','camel','Pascal','snake','kebab','constant','title','sentence','Short','Wordlist','JWTs']);
(async () => {
  const br = await chromium.launch({ executablePath: require('../chrome') });
  const errs = []; const pg = async (path) => { const p = await br.newPage(); p.on('pageerror', e => errs.push(path + ': ' + e.message)); await p.goto(B + path); await p.waitForTimeout(700); return p; };
  const leftovers = {};
  const scan = async (p, path) => { const l = (await p.evaluate(LATIN_SCAN)).filter(x => !ALLOWED.has(x) && !/^[A-Z]{2,}$/.test(x)); if (l.length) leftovers[path] = l; };
  // password generator
  let p = await pg('/ar/password-generator/');
  ok((await p.textContent('#pwOut')).trim().length >= 20, 'pw generated: ' + (await p.textContent('#pwOut')).trim());
  ok(/ممتازة|قوية/.test(await p.textContent('#lvl')), 'strength label arabic: ' + await p.textContent('#lvl'));
  await p.click('[data-mode="passphrase"]'); await p.waitForTimeout(200);
  ok((await p.textContent('#poolInfo')).includes('كلمة'), 'passphrase pool: ' + await p.textContent('#poolInfo'));
  await scan(p, '/ar/password-generator/');
  // strength checker
  p = await pg('/ar/strength-checker/');
  await p.fill('#pw', 'P@ssw0rd123'); await p.waitForSelector('#breach[data-state="bad"]', { timeout: 15000 });
  ok(/^طلعت في [\d,]+ تسريب/.test(await p.textContent('#breachTitle')), 'breach arabic: ' + await p.textContent('#breachTitle'));
  await p.fill('#pw', 'zQ7!kfp2Lw9#'); await p.waitForTimeout(900);
  const crack = await p.$$eval('#crack .v', e => e.map(x => x.textContent));
  ok(crack.every(t => !/[a-z]{3,}/.test(t)), 'crack times arabic: ' + crack.join(' | '));
  const checks = await p.textContent('#checks'); ok(!/[a-z]{4,}/.test(checks.replace(/abc|123/g, '')), 'checks arabic');
  await scan(p, '/ar/strength-checker/');
  // unit converter
  p = await pg('/ar/unit-converter/');
  ok((await p.$$eval('#cats button', b => b.map(x => x.textContent))).includes('الطول'), 'unit tabs arabic');
  ok((await p.inputValue('#toVal')).startsWith('0.62137'), 'km→mi works: ' + await p.inputValue('#toVal'));
  await p.click('[data-c="Temperature"]'); await p.fill('#fromVal', '100'); await p.waitForTimeout(100);
  ok((await p.inputValue('#toVal')) === '212', 'temperature 100C→212F');
  await scan(p, '/ar/unit-converter/');
  // date converter
  p = await pg('/ar/date-converter/');
  const main = await p.textContent('#h2gOut .main'); ok(/، \d+ [؀-ۿ]+ \d{4}/.test(main), 'hijri→greg arabic: ' + main);
  await p.click('[data-tab="cal"]'); await p.waitForTimeout(200);
  ok((await p.$$('#cal .day')).length >= 28, 'calendar renders'); ok((await p.textContent('#cal .dow')).length > 0 && !/Sun/.test(await p.textContent('#cal')), 'calendar weekday names arabic');
  await scan(p, '/ar/date-converter/');
  // ip subnet labels
  p = await pg('/ar/ip-network/'); const labels = await p.$$eval('#subGrid .k', e => e.map(x => x.textContent));
  ok(labels.includes('قناع الشبكة الفرعية') && labels.includes('المضيفون المتاحون'), 'subnet labels arabic');
  await scan(p, '/ar/ip-network/');
  // others: scan
  for (const path of ['/ar/', '/ar/hash-generator/', '/ar/username-generator/', '/ar/base64-tool/', '/ar/json-formatter/', '/ar/text-converter/', '/ar/share/', '/ar/s/', '/ar/about/', '/ar/account/', '/ar/account/#register', '/ar/reset-password/?token=' + 'a'.repeat(64), '/ar/profile/', '/ar/404.html']) {
    p = await pg(path); await scan(p, path);
    if (path === '/ar/json-formatter/') { await p.click('#sample'); await p.waitForTimeout(200); ok(/JSON صالح/.test(await p.textContent('#status')), 'json valid badge arabic'); await scan(p, path + ' (after format)'); }
    if (path === '/ar/hash-generator/') { await p.fill('#txt', 'abc'); await p.waitForTimeout(300); ok((await p.textContent('#out')).includes('900150983cd24fb0d6963f7d28e17f72'), 'md5 works in arabic page'); await scan(p, path + ' (after typing)'); }
    if (path === '/ar/') {
      await p.keyboard.press('Control+k'); await p.waitForSelector('.cmdk-backdrop.open'); await p.keyboard.type('كلمة مرور'); await p.waitForTimeout(200);
      const res = await p.$$eval('.cmdk-item strong', e => e.map(x => x.textContent)); ok(res.includes('مولّد كلمات المرور'), 'arabic search finds: ' + res.join(', '));
      ok((await p.getAttribute('.cmdk-item[data-href]', 'data-href')).startsWith('/ar/'), 'search results link to /ar/');
      ok((await p.getAttribute('.lang-switch', 'href')) === '/', 'lang switch → /');
      ok(await p.evaluate(() => document.documentElement.dir === 'rtl' && document.documentElement.lang === 'ar'), 'html dir=rtl lang=ar');
      await p.keyboard.press('Escape');
    }
  }
  console.log('\nLatin leftovers (review):'); for (const [k, v] of Object.entries(leftovers)) console.log('  ' + k + ': ' + v.join(', '));
  ok(!errs.length, 'no page errors ' + errs.join(' | '));
  await br.close(); console.log(fails ? fails + ' FAILED' : 'ALL PASSED'); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
