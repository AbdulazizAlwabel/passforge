// Finds a Chromium/Chrome binary for Playwright: $CHROME_PATH, a system install, or one fetched by `npx playwright-core install chromium`.
const fs = require('fs');
const found = [process.env.CHROME_PATH, '/usr/bin/chromium', '/usr/bin/chromium-browser', '/usr/bin/google-chrome', '/usr/bin/google-chrome-stable', '/opt/google/chrome/chrome']
  .filter(Boolean).find((p) => fs.existsSync(p));
let fallback;
try { fallback = require('playwright-core').chromium.executablePath(); } catch (e) { /* not installed */ }
module.exports = found || (fallback && fs.existsSync(fallback) ? fallback : undefined);
