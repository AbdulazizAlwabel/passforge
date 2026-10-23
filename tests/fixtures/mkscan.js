const { chromium } = require('playwright-core'); const fs = require('fs');
(async () => {
  const br = await chromium.launch({ executablePath: require('../chrome') }); const p = await br.newPage();
  await p.goto('http://localhost:8899/pdf-studio/');
  const png = await p.evaluate(async () => {
    await document.fonts.load('40px "IBM Plex Sans Arabic"', 'فاتورة'); await document.fonts.load('40px Geist', 'Invoice');
    const c = document.createElement('canvas'); c.width = 2480; c.height = 3508; const x = c.getContext('2d');
    x.fillStyle = '#f4f1ea'; x.fillRect(0, 0, c.width, c.height); x.fillStyle = '#1a1a1a';
    x.font = '700 90px "IBM Plex Sans Arabic"'; x.direction = 'rtl'; x.textAlign = 'right'; x.fillText('فاتورة ضريبية', 2280, 300);
    x.font = '500 62px "IBM Plex Sans Arabic"'; x.fillText('اسم العميل: عبدالعزيز الوابل', 2280, 480); x.fillText('رقم الهوية: 1098765432', 2280, 600); x.fillText('المبلغ الإجمالي: 450 ريال', 2280, 720);
    x.direction = 'ltr'; x.textAlign = 'left'; x.font = '500 62px Geist'; x.fillText('Tax invoice — copy for the customer', 200, 960); x.fillText('Phone: 0559876543', 200, 1080); x.fillText('Email: scan@example.com', 200, 1200);
    for (let i = 0; i < 3000; i++) { x.fillStyle = 'rgba(0,0,0,' + (Math.random() * 0.08) + ')'; x.fillRect(Math.random() * c.width, Math.random() * c.height, 2, 2); }
    return c.toDataURL('image/png').split(',')[1];
  });
  fs.writeFileSync(process.env.F + '/scan.png', Buffer.from(png, 'base64')); await br.close();
})();
