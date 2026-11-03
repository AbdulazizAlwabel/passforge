/* Daftar → PDF Studio: the rules for receiving a "fill profile" (no UI here).
 *
 * Daftar (Abdulaziz's own document app, on its own address behind a sign-in)
 * opens PDF Studio with window.open and hands it his details with
 * postMessage. Nothing goes through this site's server, nothing is put in
 * the address bar, and nothing is stored: the details live in this tab's
 * memory until it closes or "Forget" is pressed.
 *
 * Handshake (one time per tab):
 *   1. PDF Studio, opened with ?from=daftar, posts {nd:'daftar-ready', v:1, nonce}
 *      to its opener, addressed only to Daftar's exact origin.
 *   2. Daftar answers {nd:'daftar-profile', v:1, nonce, session, fields, pdf?},
 *      addressed only to this site's origin.
 *   3. PDF Studio accepts it only if it comes from Daftar's origin, from the
 *      window that opened it, carries the nonce it made, and arrives once.
 *   4. "Save to Daftar" posts {nd:'daftar-save', v:1, session, name, bytes} back,
 *      again only to Daftar's origin; Daftar checks the session it made.
 */
(function () {
  'use strict';
  const PROD = 'https://daftar.nicelydone.qd.je';
  // Only when this page itself runs on localhost (the test harness): never in production.
  const TEST = 'http://127.0.0.1:8896';
  const MAX_FIELDS = 40, MAX_VALUE = 300, MAX_LABEL = 80, MAX_PDF = 50 * 1024 * 1024;
  const KEY_RE = /^[a-z][a-z0-9_]{0,39}$/, SESSION_RE = /^[A-Za-z0-9_-]{16,64}$/;

  function origins(loc) {
    loc = loc || location;
    return loc.hostname === 'localhost' ? [PROD, TEST] : [PROD];
  }
  const originOk = (o, loc) => origins(loc).includes(o);

  function nonce() {
    const b = crypto.getRandomValues(new Uint8Array(18));
    return btoa(String.fromCharCode(...b)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }

  const clean = (s, max) => typeof s === 'string' ? s.replace(/[\u0000-\u001f\u007f]+/g, ' ').trim().slice(0, max) : '';

  /* The profile message, checked field by field. Returns null for anything
     that is not exactly what Daftar sends. */
  function readProfile(data, expectNonce) {
    if (!data || typeof data !== 'object' || Array.isArray(data)) return null;
    if (data.nd !== 'daftar-profile' || data.v !== 1) return null;
    if (typeof expectNonce !== 'string' || !expectNonce || data.nonce !== expectNonce) return null;
    if (typeof data.session !== 'string' || !SESSION_RE.test(data.session)) return null;
    if (!Array.isArray(data.fields) || data.fields.length > MAX_FIELDS) return null;
    const fields = [], seen = new Set();
    for (const f of data.fields) {
      if (!f || typeof f !== 'object' || typeof f.key !== 'string' || !KEY_RE.test(f.key) || seen.has(f.key)) continue;
      const value = clean(f.value, MAX_VALUE);
      if (!value) continue;
      seen.add(f.key);
      fields.push({ key: f.key, label: clean(f.label, MAX_LABEL), value });
    }
    let pdf = null;
    if (data.pdf != null) {
      const p = data.pdf;
      if (!p || !(p.bytes instanceof ArrayBuffer) || !p.bytes.byteLength || p.bytes.byteLength > MAX_PDF) return null;
      const head = new Uint8Array(p.bytes, 0, Math.min(5, p.bytes.byteLength));
      if (String.fromCharCode(...head) !== '%PDF-') return null;
      pdf = { name: clean(p.name, 200).replace(/[\\/:*?"<>|]+/g, '-') || 'document.pdf', bytes: p.bytes };
    }
    if (!fields.length && !pdf) return null;
    return { session: data.session, lang: data.lang === 'ar' ? 'ar' : 'en', fields, pdf };
  }

  /* ---------- Suggesting which detail goes in which form field ---------- */
  const ARABIC = /[؀-ۿ]/;
  function norm(s) {
    return String(s || '')
      .replace(/([a-z])([A-Z])/g, '$1 $2')            // fullName → full Name
      .replace(/[_\-.:/\\()[\]#*'’]+/g, ' ')
      .replace(/\d+/g, ' ')
      .toLowerCase()
      .replace(/[ً-ٰٟـ]/g, '')   // Arabic marks, tatweel
      .replace(/[أإآ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي')
      .replace(/\s+/g, ' ').trim();
  }
  // [key, phrases]. Phrases are normalised like field names. The longest
  // phrase that matches wins, so "passport expiry" beats "passport".
  const RULES = [
    ['employer', ['employer', 'employer name', 'company', 'company name', 'workplace', 'place of work', 'organisation', 'organization', 'جهه العمل', 'اسم الشركه', 'الشركه', 'مكان العمل']],
    ['passport_expiry', ['passport expiry', 'passport expiry date', 'passport expiration', 'passport valid until', 'passport exp', 'انتهاء الجواز', 'تاريخ انتهاء الجواز', 'صلاحيه الجواز']],
    ['passport_number', ['passport', 'passport no', 'passport number', 'passport num', 'رقم الجواز', 'جواز السفر', 'رقم جواز السفر']],
    ['id_number', ['national id', 'id number', 'id no', 'identity', 'identity number', 'iqama', 'iqama number', 'iqama no', 'residence id', 'civil id', 'nid', 'national identity', 'رقم الهويه', 'الهويه', 'الهويه الوطنيه', 'رقم الاقامه', 'الاقامه', 'السجل المدني', 'رقم السجل المدني']],
    ['date_of_birth', ['date of birth', 'birth date', 'birthdate', 'dob', 'born', 'birthday', 'تاريخ الميلاد', 'الميلاد']],
    ['nationality', ['nationality', 'citizenship', 'الجنسيه']],
    ['address', ['address', 'national address', 'home address', 'residential address', 'street', 'العنوان', 'العنوان الوطني', 'عنوان السكن']],
    ['phone', ['phone', 'phone number', 'mobile', 'mobile number', 'mobile no', 'telephone', 'tel', 'cell', 'contact number', 'الجوال', 'رقم الجوال', 'الهاتف', 'رقم الهاتف', 'جوال']],
    ['email', ['email', 'e mail', 'email address', 'mail', 'البريد', 'البريد الالكتروني', 'الايميل']],
    ['name', ['name', 'full name', 'applicant name', 'customer name', 'client name', 'account holder', 'account name', 'your name', 'name in full', 'الاسم', 'الاسم الكامل', 'اسم العميل', 'اسم مقدم الطلب', 'الاسم الرباعي', 'اسم']],
    ['today', ['date', 'today', 'todays date', 'signature date', 'date signed', 'التاريخ', 'تاريخ اليوم', 'تاريخ التوقيع']],
  ];
  // A name field that is about someone else (or only part of the name) is left for Aziz.
  const NOT_HIS = ['father', 'mother', 'spouse', 'husband', 'wife', 'bank', 'branch', 'beneficiary', 'emergency', 'reference', 'first', 'last', 'middle', 'family', 'surname', 'given', 'user', 'file', 'الاب', 'الام', 'الزوج', 'الزوجه', 'البنك', 'الفرع', 'المستفيد', 'الاول', 'الاخير', 'العائله'];

  function words(s) { return ' ' + norm(s) + ' '; }
  function has(hay, phrase) { return hay.includes(' ' + phrase + ' '); }

  /* One form field → the profile key it most likely wants, or null.
     `text` is the field's name plus its tooltip (alternate name). */
  function suggest(text, available) {
    const hay = words(text), avail = new Set(available);
    let best = null, bestLen = 0;
    for (const [key, phrases] of RULES) {
      for (const p of phrases) if (p.length > bestLen && has(hay, p)) { best = key; bestLen = p.length; }
    }
    if (!best) return null;
    const hijri = /\bhijri\b|هجري/.test(hay);
    const want = k => (hijri && avail.has(k + '_hijri') ? k + '_hijri' : k);
    if (best === 'name') {
      if (NOT_HIS.some(w => has(hay, w))) return null;
      const ar = ARABIC.test(text) || /\barabic\b|\bar\b|عربي/.test(hay);
      const en = /\benglish\b|\ben\b|انجليزي/.test(hay);
      const k = ar && !en ? 'name_ar' : 'name_en';
      return avail.has(k) ? k : (avail.has('name_en') ? 'name_en' : avail.has('name_ar') ? 'name_ar' : null);
    }
    if (best === 'today') {
      // "Date" next to words like expiry/issue/birth is not today's date.
      if (/expir|issue|valid|birth|انتهاء|اصدار|ميلاد/.test(hay)) return null;
      return avail.has(want('today')) ? want('today') : null;
    }
    const k = want(best);
    return avail.has(k) ? k : (avail.has(best) ? best : null);
  }

  /* Every text field of a form → {name, key}. */
  function mapFields(fields, available) {
    return fields.map(f => ({ name: f.name, key: f.type === 'text' ? suggest(f.name + ' ' + (f.alt || ''), available) : null }));
  }

  /* Today's date, Gregorian and Hijri (Umm al-Qura), day/month/year, Western digits. */
  function todayValues(d) {
    d = d || new Date();
    const pick = (cal) => {
      const parts = new Intl.DateTimeFormat('en-u-ca-' + cal + '-nu-latn', { day: '2-digit', month: '2-digit', year: 'numeric' }).formatToParts(d);
      const g = t => (parts.find(p => p.type === t) || {}).value || '';
      return g('day') + '/' + g('month') + '/' + g('year');
    };
    return { today: pick('gregory'), today_hijri: pick('islamic-umalqura') };
  }

  window.ND = window.ND || {};
  ND.daftarFill = { origins, originOk, nonce, readProfile, norm, suggest, mapFields, todayValues, PROD, TEST };
})();
