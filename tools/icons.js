// App icons from tools/icon.html:  node tools/icons.js  → src/static/{icon-512,icon-192,apple-touch-icon,favicon-32}.png
const path = require('path');
const { chromium } = require(path.join(__dirname, '../tests/node_modules/playwright-core'));
(async () => {
  const br = await chromium.launch({ executablePath: require(path.join(__dirname, '../tests/chrome')) });
  for (const [name, size] of [['icon-512', 512], ['icon-192', 192], ['apple-touch-icon', 180], ['favicon-32', 32]]) {
    const p = await br.newPage({ viewport: { width: size, height: size }, deviceScaleFactor: 1 });
    await p.goto('file://' + path.join(__dirname, 'icon.html'));
    await p.screenshot({ path: path.join(__dirname, '../src/static', name + '.png') });
    await p.close();
  }
  await br.close();
  console.log('icons written to src/static/');
})().catch((e) => { console.error(e); process.exit(1); });
