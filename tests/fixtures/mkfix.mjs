import { PDFDocument, StandardFonts, rgb, degrees } from '../../src/assets/vendor/pdf-studio-1/pdf-lib.esm.min.js';
import fs from 'fs';
const F = process.argv[2];
const hues = [[0.30,0.55,0.95],[0.95,0.55,0.30],[0.25,0.75,0.55],[0.75,0.35,0.85],[0.90,0.75,0.25],[0.35,0.70,0.85]];
async function make(name, n, size, label, opts = {}) {
  const d = await PDFDocument.create(); const font = await d.embedFont(StandardFonts.HelveticaBold); const f2 = await d.embedFont(StandardFonts.Helvetica);
  d.setTitle(label);
  for (let i = 0; i < n; i++) {
    const p = d.addPage(size); const [w, h] = size; const c = hues[i % hues.length];
    p.drawRectangle({ x: 0, y: h - 90, width: w, height: 90, color: rgb(...c) });
    p.drawText(label, { x: 40, y: h - 58, size: 26, font, color: rgb(1, 1, 1) });
    p.drawText(String(i + 1), { x: w / 2 - 60, y: h / 2 - 60, size: 160, font, color: rgb(...c) });
    p.drawText(`${label} — page ${i + 1} of ${n}`, { x: 40, y: 40, size: 12, font: f2, color: rgb(0.3, 0.3, 0.3) });
    for (let k = 0; k < 8; k++) p.drawRectangle({ x: 40, y: h - 130 - k * 16, width: (w - 80) * (0.5 + ((k * 37 + i * 11) % 50) / 100), height: 6, color: rgb(0.85, 0.85, 0.85) });
    if (opts.rotate && opts.rotate[i]) p.setRotation(degrees(opts.rotate[i]));
  }
  fs.writeFileSync(`${F}/${name}`, await d.save());
}
await make('report.pdf', 12, [595.28, 841.89], 'Quarterly Report');
await make('slides.pdf', 3, [842, 595], 'Slides (landscape)', { rotate: { 2: 90 } });
await make('letter.pdf', 2, [612, 792], 'Letter');
await make('big.pdf', 300, [595.28, 841.89], 'Big document');
await make('secret-src.pdf', 2, [595.28, 841.89], 'Locked statement');
console.log('ok');
