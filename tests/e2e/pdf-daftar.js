// PDF Studio receiving a "fill profile" from Daftar (round 6 L).
// A fake Daftar runs on http://127.0.0.1:8896 (the one test origin the page
// accepts when it runs on localhost); a second one on :8897 plays an
// untrusted site. Checks: handshake and origin/nonce/source rules, mapping
// suggestions (EN/AR), filling forms and placing details, Save to Daftar,
// Forget, no network/storage/URL leaks, COOP only relaxed on /sign-pdf/,
// and the page unchanged without a profile.
const { chromium } = require('playwright-core');
const http = require('http');
const fs = require('fs');
const F = process.env.F, B = process.env.B || 'http://localhost:8899';
let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };

const SECRET = { name_en: 'Abdulaziz Testname', name_ar: 'عبدالعزيز التجربة', id_number: '1098765432', phone: '0551234567', email: 'aziz.test@example.com', passport_number: 'X1234567', nationality: 'Saudi', address: '1234 King Fahd Rd, Riyadh 12345', employer: 'Test Co' };
const FIELDS = Object.entries(SECRET).map(([key, value]) => ({ key, label: key, value }));

const FAKE = `<!doctype html><meta charset=utf-8><title>fake daftar</title><button id=go>open</button><script>
window.got=[];window.saved=null;window.cfg={};
document.getElementById('go').onclick=()=>{
  const c=window.cfg;const w=window.open(c.url,'nd');window.win=w;let sent=0;
  window.addEventListener('message',e=>{
    const d=e.data||{};window.got.push({nd:d.nd,origin:e.origin,fromWin:e.source===w});
    if(d.nd==='daftar-ready'&&e.source===w&&!sent){sent=1;
      const msg={nd:'daftar-profile',v:1,nonce:c.badNonce?'not-the-nonce':d.nonce,session:'sess_0123456789abcdef',lang:'en',fields:c.fields};
      let tr=[];if(c.pdf){const b=Uint8Array.from(atob(c.pdf),ch=>ch.charCodeAt(0)).buffer;msg.pdf={name:'bank-form.pdf',bytes:b};tr=[b];}
      w.postMessage(msg,c.target||'*',tr);
      if(c.twice)setTimeout(()=>w.postMessage({...msg,fields:[{key:'phone',label:'',value:'0000'}]},'*'),300);
    }
    if(d.nd==='daftar-save')window.saved={name:d.name,size:d.bytes&&d.bytes.byteLength,session:d.session,origin:e.origin,head:d.bytes?String.fromCharCode(...new Uint8Array(d.bytes,0,5)):''};
  });
};
</script>`;
function serve(port) { return new Promise(r => { const s = http.createServer((q, res) => { res.setHeader('content-type', 'text/html'); res.end(FAKE); }).listen(port, '127.0.0.1', () => r(s)); }); }

(async () => {
  const servers = [await serve(8896), await serve(8897)];
  const br = await chromium.launch({ executablePath: require('../chrome') });
  const pdf64 = fs.readFileSync(F + '/form.pdf').toString('base64');

  async function session(origin, cfg, lang = '') {
    const ctx = await br.newContext({ viewport: { width: 1340, height: 900 } });
    const opener = await ctx.newPage(); const errs = [];
    await opener.goto(origin + '/');
    await opener.evaluate(c => { window.cfg = c; }, { url: B + (lang ? '/' + lang : '') + '/sign-pdf/?from=daftar', fields: FIELDS, ...cfg });
    const [studio] = await Promise.all([ctx.waitForEvent('page'), opener.click('#go')]);
    studio.on('pageerror', e => errs.push(e.message));
    const reqs = []; studio.on('request', r => reqs.push(r.url() + ' ' + (r.postData() || '')));
    await studio.waitForLoadState('load');
    return { ctx, opener, studio, errs, reqs };
  }
  const st = (p) => p.evaluate(() => window.__studio.daftar);

  /* ---------- the rules, straight ---------- */
  {
    const ctx = await br.newContext(); const p = await ctx.newPage();
    await p.goto(B + '/sign-pdf/');
    const r = await p.evaluate(() => {
      const D = ND.daftarFill, all = ['name_en', 'name_ar', 'id_number', 'passport_number', 'passport_expiry', 'date_of_birth', 'date_of_birth_hijri', 'nationality', 'address', 'phone', 'email', 'employer', 'today', 'today_hijri'];
      const cases = [['fullName', 'name_en'], ['Applicant Name', 'name_en'], ['name_ar', 'name_ar'], ['الاسم الكامل', 'name_ar'], ['Name in Arabic', 'name_ar'],
        ['national_id_number', 'id_number'], ['IqamaNo', 'id_number'], ['رقم الهوية', 'id_number'], ['رقم الإقامة', 'id_number'],
        ['passportNo', 'passport_number'], ['Passport Expiry Date', 'passport_expiry'], ['تاريخ انتهاء الجواز', 'passport_expiry'],
        ['DOB', 'date_of_birth'], ['Date of Birth (Hijri)', 'date_of_birth_hijri'], ['تاريخ الميلاد', 'date_of_birth'], ['Nationality', 'nationality'], ['الجنسية', 'nationality'],
        ['National Address', 'address'], ['العنوان الوطني', 'address'], ['mobile_no', 'phone'], ['رقم الجوال', 'phone'], ['E-mail', 'email'], ['البريد الإلكتروني', 'email'],
        ['Employer Name', 'employer'], ['Company Name', 'employer'], ['جهة العمل', 'employer'], ['Date', 'today'], ['التاريخ', 'today'], ['Signature date', 'today'],
        ["Father's Name", null], ['Bank Name', null], ['First Name', null], ['Issue Date', null], ['Expiry Date', null], ['Amount', null], ['اسم الأب', null], ['notes', null]];
      return cases.map(([t, want]) => [t, want, D.suggest(t, all)]);
    });
    const bad = r.filter(([, want, got]) => want !== got);
    ok(!bad.length, `mapping suggestions EN/AR (${r.length} cases)` + (bad.length ? ' — wrong: ' + JSON.stringify(bad) : ''));
    const only = await p.evaluate(() => ND.daftarFill.suggest('Full name', ['name_ar']));
    ok(only === 'name_ar', 'suggests only keys the profile has');
    const v = await p.evaluate(() => {
      const D = ND.daftarFill, good = { nd: 'daftar-profile', v: 1, nonce: 'n1', session: 'sess_0123456789abcdef', fields: [{ key: 'phone', label: 'x', value: ' 055\u0007 ' }] };
      return {
        good: D.readProfile(good, 'n1'), wrongNonce: D.readProfile(good, 'n2'), noNonce: D.readProfile(good, null),
        badKey: D.readProfile({ ...good, fields: [{ key: '__proto__', value: 'x' }] }, 'n1'),
        badSession: D.readProfile({ ...good, session: 'x' }, 'n1'), v2: D.readProfile({ ...good, v: 2 }, 'n1'),
        tooMany: D.readProfile({ ...good, fields: Array.from({ length: 41 }, (_, i) => ({ key: 'k' + i, value: 'v' })) }, 'n1'),
        notPdf: D.readProfile({ ...good, pdf: { name: 'a.pdf', bytes: new TextEncoder().encode('hello').buffer } }, 'n1'),
        origins: D.origins({ hostname: 'nicelydone.qd.je' }), local: D.origins({ hostname: 'localhost' }),
      };
    });
    ok(v.good && v.good.fields[0].value === '055' && !v.wrongNonce && !v.noNonce && !v.badKey && !v.badSession && !v.v2 && !v.tooMany && !v.notPdf, 'profile messages are checked field by field (nonce, session, keys, size, PDF bytes)');
    ok(JSON.stringify(v.origins) === '["https://daftar.nicelydone.qd.je"]' && v.local.includes('http://127.0.0.1:8896'), 'production accepts only Daftar’s exact origin; the test origin only on localhost');
    // COOP: relaxed on /sign-pdf/ only.
    const h = async (u) => (await p.request.get(B + u)).headers()['cross-origin-opener-policy'];
    ok(await h('/sign-pdf/') === 'unsafe-none' && await h('/ar/sign-pdf/') === 'unsafe-none', 'COOP unsafe-none on /sign-pdf/ and /ar/sign-pdf/');
    ok(await h('/pdf-studio/') === 'same-origin' && await h('/') === 'same-origin' && await h('/vault/') === 'same-origin', 'COOP stays same-origin everywhere else');
    // Without a profile: nothing changes.
    ok(await p.isHidden('#dfBar') && await p.isHidden('#dfChips') && (await p.evaluate(() => window.__studio.daftar)).waiting === false, 'without ?from=daftar the page shows nothing new and waits for nothing');
    await ctx.close();
  }

  /* ---------- the handoff ---------- */
  {
    const { ctx, opener, studio, errs, reqs } = await session('http://127.0.0.1:8896', { pdf: pdf64 });
    await studio.waitForFunction(() => window.__studio.daftar.on && window.__studio.pages.length > 0, null, { timeout: 30000 });
    const s0 = await st(studio);
    ok(s0.fields === FIELDS.length && !s0.waiting, 'profile accepted once, nonce used up');
    ok(await studio.isVisible('#dfBar') && /Your details from Daftar are here/.test(await studio.innerText('#dfBar')), '“from Daftar” banner shows');
    ok((await studio.evaluate(() => window.__studio.sources))[0].name === 'bank-form.pdf', 'the PDF Daftar sent is open');
    ok(!/from=daftar.*(1098765432|Testname)/.test(studio.url()) && !studio.url().includes('#'), 'nothing personal in the address');
    const got = await opener.evaluate(() => window.got);
    ok(got.some(g => g.nd === 'daftar-ready' && g.origin === 'http://localhost:8899' && g.fromWin), 'studio announced itself to its opener (and only it)');
    // Fill the form (AcroForm) through the mapping dialog.
    // The sign page opens the editor over the banner by itself; the chip row has the same button.
    await studio.waitForSelector('#dlgView[open]'); await studio.waitForSelector('#dfFillV:not([hidden])');
    await studio.click('#dfFillV'); await studio.waitForSelector('#dlgMap[open]');
    const rows = await studio.$$eval('#mapRows select', ss => ss.map(s => [s.dataset.name, s.value]));
    const pick = Object.fromEntries(rows);
    ok(pick.fullName === 'name_en' && pick.email === 'email' && pick.notes === '', 'form fields get suggested details (fullName → name, email → email, notes left empty)');
    await studio.selectOption('#mapRows select[data-name=notes]', 'employer');
    await studio.click('#mapOk');
    // The dialog's close event (which fills the form) runs a moment after the click.
    await studio.waitForFunction(() => Object.keys(window.__studio.forms).length >= 3, null, { timeout: 5000 }).catch(() => {});
    const forms = await studio.evaluate(() => window.__studio.forms);
    const fv = k => Object.entries(forms).find(([kk]) => kk.endsWith('|' + k))?.[1];
    ok(fv('fullName') === SECRET.name_en && fv('email') === SECRET.email && fv('notes') === SECRET.employer, 'Fill in puts the chosen details into the form' + (fv('fullName') === SECRET.name_en ? '' : ' — got ' + JSON.stringify(forms)));
    // Chips in the page editor: tap a chip, tap the page.
    await studio.waitForSelector('#dlgMap', { state: 'hidden' }); await studio.waitForSelector('#viewSpin', { state: 'hidden' });
    ok(await studio.isVisible('#dfChips') && (await studio.$$('.st-dfchip')).length >= FIELDS.length + 2, 'details show as chips in the editor (plus today’s dates)');
    const bx = await studio.locator('#pageBox').boundingBox();
    await studio.click('.st-dfchip[data-key=phone]'); ok(await studio.isVisible('#dfHint'), 'tapping a chip asks where it goes');
    await studio.mouse.click(bx.x + bx.width * 0.6, bx.y + bx.height * 0.06);   // a free spot above the form fields
    let marks = (await studio.evaluate(() => window.__studio.pages))[0].marks || [];
    ok(marks.some(m => m.kind === 'text' && m.text === SECRET.phone), 'chip value placed on the page as text');
    // Chip into a focused form field.
    await studio.click('.fld[title=city]').catch(() => {});
    const textFld = await studio.$('input.fld');
    if (textFld) { await textFld.click(); await studio.click('.st-dfchip[data-key=id_number]'); ok(await textFld.inputValue() === SECRET.id_number, 'chip fills the focused form field'); }
    const today = await studio.$eval('.st-dfchip[data-key=today_hijri] .st-dfchip-v', e => e.textContent);
    ok(/^\d{2}\/\d{2}\/14\d\d$/.test(today), 'today’s Hijri date chip (Umm al-Qura)');
    await studio.click('#vClose');
    ok(await studio.isVisible('#dfFill'), 'the banner offers the form filler too, once the editor is closed');
    // A second profile, or one from the wrong sender, is ignored.
    await studio.evaluate(() => window.postMessage({ nd: 'daftar-profile', v: 1, nonce: 'x', session: 'sess_0123456789abcdef', fields: [{ key: 'phone', value: '1' }] }, '*'));
    await studio.waitForTimeout(500);
    ok((await st(studio)).fields === FIELDS.length, 'later or self-sent profiles are ignored');
    // Save to Daftar.
    await studio.click('#dfSave');
    await opener.waitForFunction(() => window.saved, null, { timeout: 30000 });
    const saved = await opener.evaluate(() => window.saved);
    ok(saved.head === '%PDF-' && saved.size > 1000 && saved.session === 'sess_0123456789abcdef' && saved.origin === 'http://localhost:8899', 'Save to Daftar sends the filled PDF to the opener only');
    // Nothing personal left the browser or was stored.
    const leaked = reqs.filter(r => Object.values(SECRET).some(v => r.includes(v) || r.includes(encodeURIComponent(v))));
    ok(!leaked.length, 'no request carries any detail (' + reqs.length + ' requests checked)' + (leaked.length ? ': ' + leaked[0] : ''));
    const stored = await studio.evaluate(async () => {
      const dbs = indexedDB.databases ? (await indexedDB.databases()).map(d => d.name) : [];
      return JSON.stringify({ l: { ...localStorage }, s: { ...sessionStorage }, dbs });
    });
    ok(!Object.values(SECRET).some(v => stored.includes(v)), 'no detail in localStorage, sessionStorage or IndexedDB names');
    // Forget.
    await studio.click('#dfForget');
    const s1 = await st(studio);
    ok(!s1.on && !s1.fields && await studio.isHidden('#dfBar') && await studio.isHidden('#dfChips'), 'Forget drops the details and the banner');
    ok(!errs.length, 'no page errors' + (errs.length ? ': ' + errs[0] : ''));
    await ctx.close();
  }

  /* ---------- refusals ---------- */
  {
    const { ctx, studio } = await session('http://127.0.0.1:8897', {});
    await studio.waitForTimeout(2500);
    ok(!(await st(studio)).on && await studio.isHidden('#dfBar'), 'a profile from any other site is refused');
    await ctx.close();
  }
  {
    const { ctx, studio } = await session('http://127.0.0.1:8896', { badNonce: true });
    await studio.waitForTimeout(2500);
    ok(!(await st(studio)).on, 'a profile without the right one-time code is refused');
    await ctx.close();
  }
  {
    const { ctx, opener, studio } = await session('http://127.0.0.1:8896', { target: 'https://nicelydone.qd.je' });
    await studio.waitForTimeout(2000);
    ok(!(await st(studio)).on, 'a profile addressed to another origin never arrives');
    await ctx.close();
  }
  {
    // /pdf-studio/ keeps COOP same-origin, so it cannot talk to its opener.
    const ctx = await br.newContext(); const opener = await ctx.newPage();
    await opener.goto('http://127.0.0.1:8896/');
    await opener.evaluate(c => { window.cfg = c; }, { url: B + '/pdf-studio/?from=daftar', fields: FIELDS });
    const [studio] = await Promise.all([ctx.waitForEvent('page'), opener.click('#go')]);
    await studio.waitForLoadState('load'); await studio.waitForTimeout(1500);
    ok(!(await opener.evaluate(() => window.got)).length && !(await st(studio)).on, 'other PDF pages keep their opener cut off (COOP)');
    await ctx.close();
  }

  /* ---------- Arabic ---------- */
  {
    const { ctx, studio, errs } = await session('http://127.0.0.1:8896', {}, 'ar');
    await studio.waitForFunction(() => window.__studio.daftar.on, null, { timeout: 15000 });
    const t = await studio.innerText('#dfBar');
    ok(/بياناتك من دفتر جاهزة/.test(t) && /انسَ بياناتي/.test(t) && await studio.getAttribute('html', 'dir') === 'rtl', 'Arabic banner, right to left');
    ok(!errs.length, 'no page errors in Arabic');
    await ctx.close();
  }

  await br.close(); servers.forEach(s => s.close());
  console.log(fails ? `${fails} FAILED` : 'ALL PASSED');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
