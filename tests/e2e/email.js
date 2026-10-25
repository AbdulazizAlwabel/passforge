// Email Checker — scams are caught, genuine mail isn't, and nothing from the email leaves the page.
const { chromium } = require('playwright-core');
const fs = require('fs'), path = require('path');
const B = process.env.B || 'http://localhost:8899', DL = process.env.DL || '/tmp';
let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
const b64 = (s) => Buffer.from(s, 'utf8').toString('base64');
(async () => {
  const br = await chromium.launch({ executablePath: require('../chrome') }); const errs = [];
  const ctx = await br.newContext({ viewport: { width: 1280, height: 900 } });
  const p = await ctx.newPage(); p.on('pageerror', (e) => errs.push(e.message));
  const sent = []; p.on('request', (r) => { const u = new URL(r.url()); if (u.pathname.startsWith('/api/')) sent.push(u.pathname + u.search + (r.postData() || '')); });
  const done = () => p.waitForFunction(() => { const v = document.getElementById('emVerdict'); return v && v.dataset.kind && v.dataset.kind !== 'busy'; }, null, { timeout: 20000 });
  const kind = () => p.getAttribute('#emVerdict', 'data-kind');
  const finds = async () => (await p.textContent('#emFind')).replace(/\s+/g, ' ');

  for (const L of ['', '/ar']) {
    const tag = L ? 'ar' : 'en';
    await p.goto(B + L + '/email-checker/');
    // 1) the built-in example: a fake Absher email
    sent.length = 0;
    await p.click('#emSample'); await done();
    ok(await kind() === 'bad', tag + ': example is a likely scam');
    const fx = await finds();
    ok(/DMARC/.test(fx), tag + ': DMARC failure reported');
    ok(/absher-sa-verify\.info/.test(fx) && /absher\.sa/.test(fx), tag + ': link that shows absher.sa but goes elsewhere');
    ok(/invoice\.pdf\.html/.test(fx), tag + ': disguised attachment flagged');
    ok(/gmail\.com/.test(await p.textContent('#emCard')), tag + ': reply-to shown');
    ok(await p.locator('.em-auth.bad').count() >= 2, tag + ': SPF/DMARC pills show failure');
    ok(/أبشر/.test(await p.textContent('#emCard')), tag + ': encoded Arabic sender name decoded');
    ok(await p.locator('#emBody .em-mk').count() >= 3, tag + ': pressure words marked in the message');
    ok(await p.locator('.em-link.bad').count() >= 1, tag + ': bad link highlighted');
    const leak = sent.filter((x) => !/^\/api\/linkcheck\?p=([0-9a-f]{5},?)+$/.test(x) && !/^\/api\/me/.test(x));
    ok(!leak.length && sent.some((x) => x.startsWith('/api/linkcheck')), tag + ': only 5-character fingerprints were sent ' + JSON.stringify(leak));
    // 2) a genuine-looking email: DMARC pass from the real domain
    const genuine = ['Authentication-Results: mx.google.com; dkim=pass header.i=@amazon.com; spf=pass smtp.mailfrom=amazon.com; dmarc=pass (p=QUARANTINE) header.from=amazon.com',
      'From: "Amazon.sa" <order-update@amazon.com>', 'To: you@example.com', 'Subject: Your order has shipped', 'Date: Sat, 25 Oct 2026 10:00:00 +0300', 'Message-ID: <x@amazon.com>', 'MIME-Version: 1.0',
      'Content-Type: text/html; charset=UTF-8', 'Content-Transfer-Encoding: base64', '', b64('<p>Hello, your package is on its way. <a href="https://www.amazon.sa/gp/your-account/order-history">Your orders</a></p>')].join('\n');
    await p.fill('#em', genuine); await p.fill('#emFrom', ''); await p.click('#emGo'); await done();
    ok(await kind() === 'good' && /genuine|حقيقي|أصلي|سليم/i.test(await p.textContent('#emVTitle')), tag + ': genuine Amazon email looks genuine: ' + await p.textContent('#emVTitle'));
    ok(await p.locator('.em-auth.ok').count() === 3, tag + ': SPF, DKIM and DMARC all pass');
    // 3) pasted text, Arabic, with the sender typed in
    await p.fill('#em', 'مصرف الراجحي\nعميلنا العزيز، تم إيقاف حسابك. أرسل رمز التحقق خلال 24 ساعة على الرابط bit.ly/rj-verify');
    await p.fill('#emFrom', 'alrajhi.bank.sa@gmail.com'); await p.click('#emGo'); await done();
    ok(await kind() === 'bad', tag + ': pasted Arabic bank scam is a likely scam');
    const f3 = await finds();
    ok(/gmail\.com/.test(f3), tag + ': free email pretending to be a company');
    ok(/bit\.ly/.test(await p.textContent('#emLinks')), tag + ': plain-text link found');
    ok(/Paste the full source|الصق المصدر|المصدر الكامل/.test(await p.textContent('#emCard')), tag + ': explains the source is needed for sender checks');
    // 4) harmless text: no false alarm
    await p.fill('#em', 'Hi Sara, see you at lunch tomorrow at 1. Bring the photos from the trip!'); await p.fill('#emFrom', 'friend@example.org'); await p.click('#emGo'); await done();
    ok(await kind() === 'good', tag + ': a normal message raises no alarm');
  }
  // 5) an .eml file with a quoted-printable Arabic body in Windows-1256
  const cp1256 = Buffer.from([0xC7, 0xE1, 0xD3, 0xE1, 0xC7, 0xE3]); // «السلام»
  const qp = [...cp1256].map((b) => '=' + b.toString(16).toUpperCase()).join('');
  const eml = Buffer.concat([Buffer.from(['From: Aramex <noreply@aramex-delivery.top>', 'To: you@example.com', 'Subject: Parcel on hold', 'Date: Sat, 25 Oct 2026 10:00:00 +0300', 'Message-ID: <y@aramex-delivery.top>', 'MIME-Version: 1.0',
    'Content-Type: text/plain; charset=windows-1256', 'Content-Transfer-Encoding: quoted-printable', '', qp + ' customs fee https://aramex-delivery.top/pay', ''].join('\r\n'))]);
  const ef = path.join(DL, 'test.eml'); fs.writeFileSync(ef, eml);
  await p.goto(B + '/email-checker/');
  await p.setInputFiles('#emFile', ef); await done();
  ok(await kind() === 'bad', '.eml: fake Aramex email is a likely scam');
  ok(/السلام/.test(await p.textContent('#emBody')), '.eml: Windows-1256 Arabic decoded');
  ok(/aramex/i.test(await finds()), '.eml: look-alike Aramex sender caught');
  ok(!errs.length, 'no page errors ' + errs.join(' | '));
  await br.close(); console.log(fails ? fails + ' FAILED' : 'ALL PASSED');
})().catch((e) => { console.error(e); process.exit(2); });
