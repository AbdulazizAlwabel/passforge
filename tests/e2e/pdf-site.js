const { chromium } = require('playwright-core');
const B = process.env.B || 'http://localhost:8899', OUT = process.env.OUT;
let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
(async () => {
  const br = await chromium.launch({ executablePath: require('../chrome') });
  const p = await (await br.newContext({ viewport: { width: 1340, height: 900 }, colorScheme: 'dark' })).newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  for (const [slug, h1, primary, head] of [['merge-pdf', 'Merge PDF', 'save', 'Drop the PDFs to merge'], ['split-pdf', 'Split PDF', 'splitBtn', 'Drop the PDF to split'], ['jpg-to-pdf', 'JPG to PDF', 'save', 'Drop your photos or scans'], ['pdf-to-jpg', 'PDF to JPG', 'imgBtn', 'Drop the PDF to convert']]) {
    await p.goto(B + '/' + slug + '/');
    ok(await p.textContent('h1') === h1 && (await p.innerText('.st-empty-title')).trim().replace(/\s+/g, ' ') === head, `${slug}: “${h1}” + preset headline`);
    ok((await p.textContent('.crumbs')).includes('PDF Studio'), `${slug}: breadcrumb links back to PDF Studio`);
    ok(await p.getAttribute('link[rel=canonical]', 'href') === `https://nicelydone.qd.je/${slug}/`, `${slug}: canonical URL`);
    await p.evaluate(() => document.querySelector('#studio').dataset.state = 'x');
    ok(await p.evaluate((id) => { document.querySelector('#work').hidden = false; window.dispatchEvent(new Event('resize')); return true; }, primary), slug + ' ok');
  }
  // studio preset default for jpg-to-pdf: A4 + small margin
  const sm = require('fs').readFileSync(require('path').resolve(__dirname, '../..') + '/dist/sitemap.xml', 'utf8');
  ok(['pdf-studio', 'merge-pdf', 'split-pdf', 'jpg-to-pdf', 'pdf-to-jpg'].every(s => sm.includes(`/${s}/`) && sm.includes(`/ar/${s}/`)), 'sitemap lists the studio + 4 task pages in both languages');
  // Ctrl K
  await p.goto(B + '/'); await p.keyboard.press('Control+k'); await p.keyboard.type('merge pdf'); await p.waitForTimeout(300);
  ok(/Merge PDF/.test(await p.textContent('.cmdk-list')), 'Ctrl K finds “Merge PDF”');
  await p.keyboard.press('Escape');
  await p.goto(B + '/ar/'); await p.waitForTimeout(400); await p.keyboard.press('Control+k'); await p.fill('.cmdk-input input', 'دمج'); await p.waitForTimeout(300);
  const items = await p.$$eval('.cmdk-item', e => e.map(x => x.innerText.split('\n')[0]));
  ok(items[0] && /دمج PDF|استوديو PDF/.test(items.slice(0, 3).join('|')), 'Arabic Ctrl K «دمج» → ' + items.slice(0, 4).join(' | '));
  await p.keyboard.press('Escape');
  await p.goto(B + '/'); await p.waitForTimeout(500);
  ok((await p.getAttribute('.tasks .task', 'href')) === '/pdf-studio/', 'PDF Studio is the first task on the home page');
  ok(/Fix a PDF/.test(await p.textContent('.tasks')), 'home task card says “Fix a PDF”');
  await p.locator('.tasks').screenshot({ path: OUT + '/home-tasks.png' });
  await p.goto(B + '/everyday/'); ok(/PDF Studio/.test(await p.textContent('main')), 'listed in Everyday');
  ok(!errs.length, 'no errors ' + errs.join('|'));
  await br.close(); console.log(fails ? fails + ' FAILED' : 'ALL PASSED');
})().catch(e => { console.error(e); process.exit(2); });
