const { chromium } = require('playwright-core');
const B = process.env.B || 'http://localhost:8899';
const fs = require('fs');
(async () => {
  const br = await chromium.launch({ executablePath: require('../chrome') });
  const pages = ['/', '/404.html'].concat(fs.readdirSync(require('path').resolve(__dirname, '../..') + '/dist').filter(d => fs.existsSync(require('path').resolve(__dirname, '../..') + '/dist/' + d + '/index.html') && d !== 'ar').map(d => '/' + d + '/'));
  let bad = 0;
  for (const w of [390, 360, 320]) {
    const ctx = await br.newContext({ viewport: { width: w, height: 800 }, hasTouch: true, isMobile: true }); const p = await ctx.newPage();
    for (const path of pages) for (const l of ['', '/ar']) {
      await p.goto(B + l + path); await p.waitForTimeout(120);
      const sw = await p.evaluate(() => document.documentElement.scrollWidth);
      if (sw > w + 1) { bad++; console.log('OVERFLOW', w, l + path, sw); }
    }
    await ctx.close();
  }
  console.log(bad ? bad + ' pages overflow' : `all ${pages.length * 2} pages fit at 390, 360 and 320 px`);
  await br.close();
})();
