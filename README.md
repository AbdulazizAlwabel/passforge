# Nicely Done — nicelydone.qd.je

Small, private tools for security and everyday developer work. (Formerly **PassForge**.)

Every tool runs in the browser — nothing typed into them is sent anywhere:

| Security | Developer | Everyday |
|---|---|---|
| Password & passphrase generator | Base64 encode/decode (+ files) | Unit converter (10 categories) |
| Password strength checker | JSON formatter / validator | Hijri ⇄ Gregorian (Umm al-Qura) |
| Hash generator (MD5, SHA-1/256/384/512, files, verify) | Text case converter | |
| Username generator | IP & network + subnet calculator | |
| **One-time secret links** (E2E encrypted, self-destructing) | | |

Extras: a full **Arabic version** at `/ar/` (right-to-left, Arabic typography, translated at build time from `src/i18n/ar.json`), ⌘K / Ctrl K command palette, light & dark themes, offline support (service worker / PWA),
SEO metadata, Open Graph image, sitemap, and an **optional** account system (sign up, email
verification, password reset, profile, admin console).

## Layout

```
build.py            static site generator (no dependencies, Python 3.8+)
src/assets/         site.css, site.js, words.js (EFF wordlist)
src/pages/          one file per page: @tool / @aside / @about / @script sections
src/static/         og.png, icons (regenerate from tools/*.html with headless Chromium)
dist/               build output — deploy this folder
server/             Node/Express account API + static host (MySQL/MariaDB, SMTP)
deploy/             Caddyfile + systemd unit
```

## Translations

Pages are written in English; `build.py` renders each one again under `/ar/` using `src/i18n/ar.json`
(page text, attributes and inline-script strings) and `src/i18n/ar.runtime.json` (shared scripts and API
messages). Every build writes `i18n-missing.txt`; keep it empty. Sentences with numbers use templates —
`ND.f('Found in {count}', …)` — and plurals use `ND.pl` / `ND.count` with Arabic plural forms.

## Build

```sh
python3 build.py          # → dist/
python3 -m http.server -d dist 8000   # static preview (accounts hidden)
```

## Hosting options

**Static only (tools, about page):** upload `dist/` to any static host — GitHub Pages,
Cloudflare Pages, Netlify, Azure Static Web Apps or IIS (`web.config` included). The account UI
hides itself automatically when `/api` isn't available.

**Full (tools + accounts):** run the Node server, which serves `dist/` and `/api` from one origin:

```sh
cd server
cp .env.example .env      # fill in JWT_SECRET, DB_*, SMTP_*
mysql -u root -p < schema.sql
npm ci --omit=dev
node server.js            # :3000 — put Caddy (deploy/Caddyfile) or IIS/nginx in front for HTTPS
```

The API is compatible with v1 (PassForge) and the existing `users`/`tokens` tables; v2 adds
rate limiting, hashed one-time tokens, username login, resend-verification, strict cookies,
security headers (CSP, HSTS) and a `/api/health` check.

## DNS

`nicelydone.qd.je` is a DigitalPlat FreeDomain subdomain. Its nameservers are set in the
DigitalPlat dashboard; records then live at that DNS provider:

- Static host: `CNAME nicelydone.qd.je → <host>` (e.g. `abdulazizalwabel.github.io`)
- Own server: `A nicelydone.qd.je → <server IPv4>` and `CNAME www → nicelydone.qd.je`

## Operations (Oracle VM)

`deploy/install-vm.sh` also installs three systemd timers from `deploy/ops/`:

| Timer | What it does |
|---|---|
| `nicelydone-backup` | 00:30 UTC nightly `mysqldump` → `/var/backups/nicelydone`, 14 days kept |
| `nicelydone-monitor` | every 5 min: health check through HTTPS + daily certificate-expiry check; alerts on change |
| `nicelydone-autodeploy` | every 5 min: if GitHub `main` moved, rebuild, install, health-check, notify |

Alerts go through Hermes to the target in `/etc/nicelydone/ops.env` (kept off the repo).
`deploy/ops/nicelydone-backup-pull.*` is a user-level timer template for pulling the backups to another machine.
Admins are set by numeric id: `ADMIN_USER_IDS` in `server/.env`.
