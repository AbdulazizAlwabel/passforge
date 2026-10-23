# Tests

Browser end-to-end tests for the whole site: tools, accounts, 2FA, vault, PDF Studio (all three phases), Arabic, phones.
They run against a local copy of the site — `harness.js` starts the real `server/server.js` with an in-memory
database and captured email, so nothing touches production.

```bash
bash tests/setup.sh          # once per machine: poppler, qpdf, ImageMagick, npm packages, Chromium
bash tests/run.sh            # all suites (~20 min); exits non-zero if anything fails
bash tests/run.sh pdf3-tools # one or more suites by name
```

Every check prints `PASS`/`FAIL`; the summary lists failing suites. Logs, downloaded PDFs and screenshots go to
`tests/.work/` (ignored by git). Downloaded files are verified with independent tools (pdfinfo, pdftotext, qpdf,
ImageMagick), not with the site’s own code.

| Suite | Covers |
|---|---|
| e2e, ar | accounts, one-time secrets, core tools — English / Arabic |
| owner | owner-only widgets and admin |
| features, features-ar | link checker, Ctrl K answers, suggestions |
| acct, acct-ar | 2FA sign-in, encrypted vault |
| pdf-e2e, pdf-touch, pdf-ar, pdf-site, pdf-offline | PDF Studio: organise, split, convert, phones, Arabic, task pages, offline |
| pdf2-sign, pdf2-vault-touch, pdf2-ar | fill & sign, signatures in the vault, page numbers, watermark |
| pdf3-tools, pdf3-ar | compress, protect, unlock, redact, OCR |
| phone-widths | every page fits 390 / 360 / 320 px screens |

Notes
- `features` downloads public threat feeds; without internet access it reports them unavailable.
- Suites can also run against the live site: `B=https://nicelydone.qd.je node tests/e2e/pdf3-tools.js`
  (only the ones that don’t create accounts — never point account suites at production).
