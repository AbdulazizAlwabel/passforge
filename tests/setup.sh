#!/usr/bin/env bash
# One-time setup for a fresh machine (cloud session, CI, new laptop). Safe to run again.
set -euo pipefail
T="$(cd "$(dirname "$0")" && pwd)"; R="$(cd "$T/.." && pwd)"
SUDO=""; [ "$(id -u)" -ne 0 ] && command -v sudo >/dev/null && SUDO=sudo
need=""
for c in pdftotext:poppler-utils qpdf:qpdf unzip:unzip curl:curl; do command -v "${c%%:*}" >/dev/null || need="$need ${c#*:}"; done
command -v magick >/dev/null || command -v convert >/dev/null || need="$need imagemagick"
if [ -n "$need" ]; then
  if command -v apt-get >/dev/null; then $SUDO apt-get update -qq && $SUDO apt-get install -y -qq $need fonts-dejavu-core;
  else echo "Please install:$need"; exit 1; fi
fi
(cd "$R/server" && npm ci --no-audit --no-fund)
(cd "$T" && npm ci --no-audit --no-fund)
if ! node -e "process.exit(require('$T/chrome.js')?0:1)"; then
  echo "▸ fetching Chromium for Playwright"; (cd "$T" && npx --yes playwright-core install --with-deps chromium)
fi
node -e "console.log('Chromium:', require('$T/chrome.js'))"
echo "Setup done. Run: bash tests/run.sh"
