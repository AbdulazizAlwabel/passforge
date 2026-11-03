# Fill a form from Daftar (PDF Studio side)

Daftar is Abdulaziz's own document app on `https://daftar.nicelydone.qd.je`,
behind its own sign-in. Its "Fill a form" button opens PDF Studio's sign page
here and hands over the details he picked (name, ID number, passport, address,
…) and, optionally, the PDF to fill. This file is the contract both sides
follow. The rules live in `src/assets/daftar-fill.js`; the page part is the
"From Daftar" section of `src/pages/pdf-studio.html`.

## Promises

- **Nothing goes to this site's server.** The details travel from one browser
  tab to another with `postMessage`. No request from PDF Studio ever carries
  them (a test watches every request).
- **Nothing in the address.** Daftar opens `/sign-pdf/?from=daftar` (or
  `/ar/sign-pdf/?from=daftar`). That flag is all; no details, not even after `#`.
- **Nothing kept.** The details live in the page's memory only: no
  localStorage, sessionStorage, IndexedDB or service-worker cache. They go when
  the tab closes, or at once with **Forget my details**. What he already put on
  the page stays until he removes it (it is his document).
- **Without Daftar, nothing changes.** Opened any other way, the page shows
  nothing new and listens for nothing.

## Handshake

1. Daftar calls `window.open('https://nicelydone.qd.je/sign-pdf/?from=daftar')`.
2. PDF Studio makes a random one-time code (`nonce`, 144 bits) and posts
   `{nd: 'daftar-ready', v: 1, nonce}` to `window.opener`, addressed only to
   `https://daftar.nicelydone.qd.je` (repeated every 0.5 s for 20 s until
   answered).
3. Daftar answers, addressed only to `https://nicelydone.qd.je`:

   ```js
   {nd: 'daftar-profile', v: 1, nonce, session, lang: 'en' | 'ar',
    fields: [{key: 'name_en', label: 'Name (English)', value: 'Abdulaziz …'}, …],
    pdf: {name: 'bank-form.pdf', bytes: ArrayBuffer}}   // pdf is optional, sent as a transfer
   ```

4. PDF Studio accepts it only if **all** hold: `event.origin` is exactly
   Daftar's, `event.source` is the window that opened it, `nonce` is the one it
   made, and it is the first profile. Then the code is used up; anything later
   is ignored.
   - `session`: 16–64 characters `[A-Za-z0-9_-]`, made by Daftar.
   - At most 40 fields; `key` `^[a-z][a-z0-9_]{0,39}$`, no repeats; `value` up to
     300 characters, `label` up to 80; control characters are removed; empty
     values are dropped.
   - `pdf.bytes` must start with `%PDF-` and be at most 50 MB.
5. **Save to Daftar** (optional) posts the filled PDF back, addressed only to
   Daftar's origin: `{nd: 'daftar-save', v: 1, session, name, bytes: ArrayBuffer}`.
   Daftar checks the origin, that it comes from the window it opened, and
   the `session` it made.

Known keys and their labels on this side: `name_en`, `name_ar`, `id_number`,
`passport_number`, `passport_expiry` (+`_hijri`), `date_of_birth` (+`_hijri`),
`nationality`, `address`, `phone`, `email`, `employer`. PDF Studio adds
`today` and `today_hijri` (Umm al-Qura) itself. Other keys show Daftar's label.

## Using the details

- **Forms (AcroForm):** **Fill the form** lists every text field with a
  suggested detail (field names and tooltips, English and Arabic: "fullName",
  "رقم الهوية", "Passport Expiry Date", "تاريخ الميلاد", …). He confirms or
  changes each one, then **Fill in**. Fields about someone else (father, bank,
  emergency contact) or only part of the name are left empty.
- **Flat PDFs:** in the page editor each detail is a chip. Tap a chip, then tap
  the page: it becomes a text item (the same as the Text tool). With a form
  field focused, a chip fills that field instead.

## Why the sign page's COOP differs

Every page sends `Cross-Origin-Opener-Policy: same-origin`, which cuts the link
between a page and a window of another site that opened it. Then
`window.opener` is `null` and no handshake can happen. `server/server.js`
sends `unsafe-none` on `/sign-pdf/` and `/ar/sign-pdf/` only, so those two
pages keep the link to Daftar. They accept messages only as described above,
and nothing there is secret before Daftar sends it. All other pages keep
`same-origin`.

## Tests

`tests/e2e/pdf-daftar.js` (in `bash tests/run.sh`): fake Daftar pages on
`http://127.0.0.1:8896` (the one extra origin allowed when the page runs on
`localhost`, never in production) and `:8897` (untrusted). It covers the
handshake, wrong origin, wrong code, a second profile, a profile sent to the
wrong address, a page whose opener link is cut, the mapping table, Fill in,
chips, Save to Daftar, Forget, no leaks to the network, storage or the
address, the COOP headers, and the Arabic page.

## Deploy

Nothing special: merging to `main` auto-deploys within 5 minutes
(`deploy/ops/autodeploy.sh`). The COOP change is in `server/server.js`, so the
service restarts as usual during the install; `deploy/` is unchanged.
