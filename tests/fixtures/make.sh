#!/usr/bin/env bash
# Builds every test file from scratch into $1. Needs: node, qpdf, ImageMagick, and the test server running (for mkscan.js).
set -euo pipefail
F="$1"; mkdir -p "$F"; HERE="$(cd "$(dirname "$0")" && pwd)"; cd "$HERE"
node mkfix.mjs "$F" 2>/dev/null; node mkform.mjs "$F" 2>/dev/null; node mkfix3.mjs "$F" 2>/dev/null
cd "$F"
qpdf --encrypt secret owner123 256 -- secret-src.pdf locked.pdf && rm -f secret-src.pdf
qpdf --encrypt "" owner123 256 --modify=none --extract=n -- report.pdf restricted.pdf
# a phone photo stored landscape but tagged (EXIF orientation 6) to display portrait
magick -size 1600x1200 gradient:'#2a6f97'-'#e9c46a' -fill white -draw "circle 800,600 800,300" -quality 88 photo-rotated.jpg
node -e '
const fs=require("fs"),f=process.argv[1],b=fs.readFileSync(f);
const tiff=Buffer.from([0x4D,0x4D,0x00,0x2A,0,0,0,8,0,1,0x01,0x12,0,3,0,0,0,1,0,6,0,0,0,0,0,0]);
const body=Buffer.concat([Buffer.from("Exif\0\0","binary"),tiff]);
fs.writeFileSync(f,Buffer.concat([b.subarray(0,2),Buffer.from([0xFF,0xE1,(body.length+2)>>8,(body.length+2)&255]),body,b.subarray(2)]));' "$F/photo-rotated.jpg"
magick -size 900x600 xc:none -fill '#e76f51' -draw "roundrectangle 40,40 860,560 60,60" logo.png
magick -size 1200x1600 xc:white -fill '#999' -draw "rectangle 80,240 1100,250" -draw "rectangle 80,300 900,310" -quality 85 scan.webp
echo "not a pdf" > notes.txt
head -c 3000 report.pdf > broken.pdf
magick -size 1000x380 xc:'#efebe2' -attenuate 0.25 +noise Gaussian -fill '#1b2a6b' -stroke '#1b2a6b' -strokewidth 7 -draw "path 'M 90,260 C 160,90 230,330 300,200 S 420,90 470,230 S 600,300 650,160 S 780,120 900,250'" -quality 85 sig-photo.jpg
magick -size 3000x4000 plasma:steelblue-wheat -blur 0x1 -quality 95 big1.jpg
magick -size 3000x4000 plasma:tomato-ivory -quality 95 big2.jpg
magick -density 360 -units PixelsPerInch big1.jpg big2.jpg -compress jpeg -quality 95 photos-a4.pdf
magick -size 2400x1800 plasma:seagreen-white -depth 8 -compress zip flate.pdf
rm -f big1.jpg big2.jpg
cd "$HERE"; F="$F" node mkscan.js
magick "$F/scan.png" -quality 85 -density 300 -units PixelsPerInch "$F/scanned.pdf"
echo "fixtures ready in $F"
