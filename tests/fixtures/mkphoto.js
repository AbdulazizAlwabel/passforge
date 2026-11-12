// A phone-style photo of a product label: 12 MP, tilted, glossy, on a busy background.
// Stands in for the real photos people OCR on their phones (see e2e/mobile-qa.js).
//   node mkphoto.js out.jpg [width height]
const { chromium } = require('playwright-core');
module.exports = async (out, W = 3024, H = 4032) => {
  const b = await chromium.launch({ executablePath: require('../chrome.js'), args: ['--no-sandbox'] });
  const p = await (await b.newContext({ viewport: { width: 756, height: 1008 }, deviceScaleFactor: W / 756 })).newPage();
  await p.setContent(`<style>*{margin:0;box-sizing:border-box}body{width:756px;height:1008px;overflow:hidden;font-family:Arial,Helvetica,sans-serif;
  background:repeating-linear-gradient(90deg,#c9c4bb 0 118px,#b3ada3 118px 122px),#c9c4bb}
  .shelf{position:absolute;inset:0 0 62% 55%;background:repeating-linear-gradient(0deg,#3b3f46 0 70px,#8d8f95 70px 78px);filter:blur(3px)}
  .bottle{position:absolute;left:120px;top:60px;width:520px;height:920px;border-radius:120px 120px 60px 60px;transform:rotate(-4deg) skewY(-2deg);
  background:linear-gradient(100deg,#123a9c 0,#2c63e0 22%,#5d8bff 34%,#2457d6 52%,#173fa8 78%,#0d2b78 100%)}
  .cap{position:absolute;left:190px;top:-34px;width:140px;height:90px;border-radius:14px;background:linear-gradient(90deg,#1d47b8,#4a78f0,#1d47b8)}
  .label{position:absolute;left:70px;top:330px;width:400px;height:430px;border-radius:200px 200px 36px 36px/150px 150px 36px 36px;color:#fff;padding:92px 34px 0;
  background:radial-gradient(120px 260px at 78% 30%,rgba(255,255,255,.28),transparent 70%),linear-gradient(110deg,#0c0c10,#1b1c22 60%,#0a0a0d)}
  .gp{font-size:19px;font-style:italic;letter-spacing:.5px;text-align:center}
  .big{font-size:64px;font-weight:700;font-style:italic;letter-spacing:-1px;margin-top:26px;white-space:nowrap}
  .sm{font-size:15px;line-height:1.35;margin-top:22px;font-weight:700}
  .bar{margin-top:16px;height:46px;background:repeating-linear-gradient(90deg,#fff 0 3px,#111 3px 5px,#fff 5px 9px,#111 9px 12px);border:6px solid #fff}
  .hand{position:absolute;right:28px;top:600px;width:150px;height:230px;border-radius:70px;background:linear-gradient(120deg,#b98a66,#8d6244);transform:rotate(18deg)}
  .glare{position:absolute;inset:0;background:radial-gradient(260px 520px at 30% 40%,rgba(255,255,255,.16),transparent 70%)}
  .noise{position:absolute;inset:0;opacity:.09;mix-blend-mode:overlay}</style>
  <div class="shelf"></div><div class="bottle"><div class="cap"></div><div class="label"><div class="gp">HYUNDAI &nbsp; Genuine Parts</div><div class="big">ATF SP-IV</div>
  <div class="sm">1 LITRE<br>1.0568 U.S. QUART<br>04500-00115</div><div class="bar"></div></div></div><div class="hand"></div><div class="glare"></div>
  <svg class="noise" width="756" height="1008"><filter id="n"><feTurbulence type="fractalNoise" baseFrequency="1.1" numOctaves="2"/></filter><rect width="100%" height="100%" filter="url(#n)"/></svg>`);
  await p.screenshot({ path: out, type: 'jpeg', quality: 88, clip: { x: 0, y: 0, width: 756, height: H * 756 / W } });
  await b.close();
};
if (require.main === module) module.exports(process.argv[2], +(process.argv[3] || 3024), +(process.argv[4] || 4032));
