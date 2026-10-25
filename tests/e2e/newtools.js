// QR Code Maker and Photo Resizer — the codes really scan (decoded with jsQR), photos really shrink and lose their EXIF.
const { chromium } = require('playwright-core');
const fs = require('fs'), path = require('path');
const B = process.env.B || 'http://localhost:8899', F = process.env.F, DL = process.env.DL;
const JSQR = require.resolve('jsqr');
const jpegSize = (b) => { // width × height from the JPEG frame header
  for (let i = 2; i < b.length;) { if (b[i] !== 0xFF) { i++; continue; } const m = b[i + 1], len = b.readUInt16BE(i + 2); if (m >= 0xC0 && m <= 0xC3) return [b.readUInt16BE(i + 7), b.readUInt16BE(i + 5)]; i += 2 + len; } return [0, 0]; };
let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
(async () => {
  const br = await chromium.launch({ executablePath: require('../chrome') }); const errs = [];
  const ctx = await br.newContext({ viewport: { width: 1280, height: 900 }, acceptDownloads: true });
  const p = await ctx.newPage(); p.on('pageerror', (e) => errs.push(e.message));
  const decode = async () => { // read the preview canvas back with jsQR
    await p.addScriptTag({ path: JSQR });
    return p.evaluate(() => { const c = document.getElementById('qCanvas'), d = c.getContext('2d').getImageData(0, 0, c.width, c.height); const r = jsQR(d.data, c.width, c.height); return r && r.data; });
  };
  for (const L of ['', '/ar']) {
    const tag = L ? 'ar' : 'en';
    await p.goto(B + L + '/qr-code/');
    ok(await p.isDisabled('#qPng'), tag + ': nothing to download before typing');
    await p.fill('#qText', 'https://nicelydone.qd.je/qr-code/');
    ok(await decode() === 'https://nicelydone.qd.je/qr-code/', tag + ': link code scans back to the link');
    await p.fill('#qText', 'مرحبا — Nicely Done ✓');
    ok(await decode() === 'مرحبا — Nicely Done ✓', tag + ': Arabic text survives (UTF-8)');
    await p.click('[data-kind="wifi"]'); await p.fill('#qSsid', 'Home;Net'); await p.fill('#qPass', 'p@ss:word');
    ok(await decode() === 'WIFI:T:WPA;S:Home\\;Net;P:p@ss\\:word;;', tag + ': Wi-Fi code uses the standard format: ' + await decode());
    await p.click('#qSec [data-v="nopass"]');
    ok(await decode() === 'WIFI:T:nopass;S:Home\\;Net;;', tag + ': open network has no password field');
    await p.click('[data-kind="wa"]'); await p.fill('#qWaNum', '+966 50 123 4567'); await p.fill('#qWaMsg', 'السلام عليكم');
    ok(await decode() === 'https://wa.me/966501234567?text=' + encodeURIComponent('السلام عليكم'), tag + ': WhatsApp link with message');
    await p.click('[data-kind="contact"]'); await p.fill('#qName', 'Abdulaziz'); await p.fill('#qTel', '+966500000000');
    ok(await decode() === 'MECARD:N:Abdulaziz;TEL:+966500000000;;', tag + ': contact card (MECARD)');
    await p.click('#qInk [data-c="#0b6e49"]');
    ok(await decode() === 'MECARD:N:Abdulaziz;TEL:+966500000000;;', tag + ': coloured code still scans');
    const [png] = await Promise.all([p.waitForEvent('download'), p.click('#qPng')]);
    const pf = path.join(DL, tag + '-qr.png'); await png.saveAs(pf);
    ok(fs.readFileSync(pf).subarray(1, 4).toString() === 'PNG', tag + ': PNG download ' + png.suggestedFilename());
    const [svg] = await Promise.all([p.waitForEvent('download'), p.click('#qSvg')]);
    const sf = path.join(DL, tag + '-qr.svg'); await svg.saveAs(sf);
    ok(/<svg[\s\S]*fill="#0b6e49" d="M/.test(fs.readFileSync(sf, 'utf8')), tag + ': SVG download in the chosen colour');
    await p.click('[data-kind="text"]'); await p.fill('#qText', 'x'.repeat(3000));
    ok(/too long|طويل/.test(await p.textContent('#qInfo')) && await p.isDisabled('#qPng'), tag + ': too-long text explained');
  }
  // Photo Resizer
  for (const L of ['', '/ar']) {
    const tag = L ? 'ar' : 'en';
    await p.goto(B + L + '/image-resizer/');
    await p.setInputFiles('#irFile', path.join(F, 'photo-rotated.jpg'));
    await p.waitForSelector('[data-dl]', { timeout: 15000 });
    const [d1] = await Promise.all([p.waitForEvent('download'), p.click('[data-dl]')]);
    const f1 = path.join(DL, tag + '-photo.jpg'); await d1.saveAs(f1);
    const b1 = fs.readFileSync(f1), dims = jpegSize(b1);
    ok(dims[0] === 1200 && dims[1] === 1600, tag + ': turned upright using the EXIF orientation, not enlarged: ' + dims);
    ok(!b1.includes(Buffer.from('Exif')), tag + ': no EXIF left in the new copy');
    await p.click('#irSize [data-v="800"]'); await p.waitForFunction(() => /600 × 800/.test(document.getElementById('irList').textContent), null, { timeout: 15000 });
    ok(true, tag + ': “Small” makes it 600 × 800');
    await p.fill('#irKb', '20'); await p.click('label:has(#irCap)');
    await p.waitForSelector('[data-dl]', { timeout: 20000 });
    const [d2] = await Promise.all([p.waitForEvent('download'), p.click('[data-dl]')]);
    const f2 = path.join(DL, tag + '-capped.jpg'); await d2.saveAs(f2);
    ok(fs.statSync(f2).size <= 20 * 1024, tag + ': fits under 20 KB (' + Math.round(fs.statSync(f2).size / 1024) + ' KB)');
    await p.click('label:has(#irCap)'); await p.click('#irFmt [data-v="image/webp"]'); await p.waitForSelector('[data-dl]', { timeout: 15000 });
    await p.setInputFiles('#irFile', [path.join(F, 'sig-photo.jpg'), path.join(F, 'logo.png')]);
    await p.waitForFunction(() => document.querySelectorAll('#irList [data-dl]').length === 3, null, { timeout: 20000 });
    const [z] = await Promise.all([p.waitForEvent('download'), p.click('#irAll')]);
    const zf = path.join(DL, tag + '-photos.zip'); await z.saveAs(zf);
    const zb = fs.readFileSync(zf);
    ok(zb.subarray(0, 2).toString() === 'PK' && (zb.toString('latin1').match(/\.webp/g) || []).length >= 3, tag + ': three photos in one ZIP, as WebP');
    ok(/←|→/.test(await p.textContent('#irSum')), tag + ': before → after summary');
    await p.setInputFiles('#irFile', path.join(F, 'notes.txt'));
    await p.waitForTimeout(400);
    ok(await p.locator('#irList .ir-row').count() === 3, tag + ': non-images are ignored');
  }
  // the new tools are listed and have their own preview images
  await p.goto(B + '/');
  ok(await p.locator('a[href="/qr-code/"]').count() > 0 && await p.locator('a[href="/image-resizer/"]').count() > 0, 'home lists both new tools');
  ok(!errs.length, 'no page errors ' + errs.join(' | '));
  await br.close(); console.log(fails ? fails + ' FAILED' : 'ALL PASSED');
})().catch((e) => { console.error(e); process.exit(2); });
