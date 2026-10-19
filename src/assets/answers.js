/* Nicely Done — instant answers for the Ctrl K command bar.
 * Everything is computed in the browser. ND.answer(query) returns
 * null, an answer {label, value, copy?, href?, hint?}, or a Promise of one.
 */
(function () {
  'use strict';
  const ND = window.ND; if (!ND) return;
  const T = ND.t;
  const AR = ND.lang === 'ar';

  const toLatin = (s) => s.replace(/[٠-٩]/g, (d) => '٠١٢٣٤٥٦٧٨٩'.indexOf(d)).replace(/[۰-۹]/g, (d) => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d)).replace(/٫/g, '.').replace(/٬/g, ',');
  const fmt = (n) => {
    if (!isFinite(n)) return '—';
    const a = Math.abs(n);
    if (a !== 0 && (a >= 1e15 || a < 1e-6)) return n.toExponential(6).replace(/\.?0+e/, 'e');
    return parseFloat(n.toPrecision(12)).toLocaleString('en-US', { maximumFractionDigits: 10 });
  };

  /* ---------- password / pin / uuid ---------- */
  const PW = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%&*-_=+?';
  function password(n) {
    const sets = ['ABCDEFGHJKLMNPQRSTUVWXYZ', 'abcdefghijkmnopqrstuvwxyz', '23456789', '!@#$%&*-_=+?'];
    const c = sets.map((s) => s[ND.randInt(s.length)]);
    while (c.length < n) c.push(PW[ND.randInt(PW.length)]);
    for (let i = c.length - 1; i > 0; i--) { const j = ND.randInt(i + 1); [c[i], c[j]] = [c[j], c[i]]; }
    return c.join('');
  }

  /* ---------- units ---------- */
  const U = {}; // alias -> [category, factor-to-base | 'temp', canonical symbol]
  const def = (cat, factor, sym, aliases) => aliases.concat([sym]).forEach((a) => { U[a.toLowerCase()] = [cat, factor, sym]; });
  def('len', 1, 'm', ['meter', 'meters', 'metre', 'metres', 'متر', 'م', 'أمتار']);
  def('len', 1000, 'km', ['kilometer', 'kilometers', 'kilometre', 'kilometres', 'كم', 'كيلومتر', 'كيلو متر']);
  def('len', 0.01, 'cm', ['centimeter', 'centimeters', 'سم', 'سنتيمتر', 'سنتي']);
  def('len', 0.001, 'mm', ['millimeter', 'millimeters', 'مم', 'مليمتر']);
  def('len', 1609.344, 'mi', ['mile', 'miles', 'ميل', 'أميال']);
  def('len', 0.9144, 'yd', ['yard', 'yards', 'ياردة', 'يارد']);
  def('len', 0.3048, 'ft', ['foot', 'feet', 'قدم', 'أقدام']);
  def('len', 0.0254, 'in', ['inch', 'inches', '"', 'بوصة', 'انش', 'إنش']);
  def('wt', 1, 'kg', ['kilo', 'kilos', 'kilogram', 'kilograms', 'kgs', 'كغ', 'كجم', 'كيلو', 'كيلوغرام', 'كيلوجرام']);
  def('wt', 0.001, 'g', ['gram', 'grams', 'غ', 'جم', 'غرام', 'جرام']);
  def('wt', 0.45359237, 'lb', ['lbs', 'pound', 'pounds', 'رطل', 'باوند']);
  def('wt', 0.028349523125, 'oz', ['ounce', 'ounces', 'أونصة', 'اونصة']);
  def('wt', 1000, 't', ['ton', 'tons', 'tonne', 'tonnes', 'طن']);
  def('wt', 6.35029318, 'st', ['stone', 'stones']);
  def('tmp', 'c', '°C', ['c', 'celsius', '°c', 'مئوية', 'مئوي', 'سيليزي', 'درجة مئوية']);
  def('tmp', 'f', '°F', ['f', 'fahrenheit', '°f', 'فهرنهايت']);
  def('tmp', 'k', 'K', ['kelvin', 'كلفن']);
  def('spd', 1 / 3.6, 'km/h', ['kmh', 'kph', 'كم/س', 'كم/ساعة']);
  def('spd', 0.44704, 'mph', ['ميل/س', 'ميل/ساعة']);
  def('spd', 1, 'm/s', ['mps', 'م/ث']);
  def('spd', 1852 / 3600, 'kn', ['knot', 'knots', 'عقدة']);
  def('vol', 1, 'L', ['l', 'liter', 'liters', 'litre', 'litres', 'لتر', 'ل']);
  def('vol', 0.001, 'mL', ['ml', 'milliliter', 'milliliters', 'مل', 'مليلتر']);
  def('vol', 3.785411784, 'gal', ['gallon', 'gallons', 'us gal', 'غالون', 'جالون']);
  def('vol', 0.2365882365, 'cup', ['cups', 'كوب']);
  def('dat', 1, 'B', ['byte', 'bytes', 'بايت']);
  def('dat', 1e3, 'kB', ['kb', 'kilobyte', 'kilobytes', 'كيلوبايت']);
  def('dat', 1e6, 'MB', ['mb', 'megabyte', 'megabytes', 'ميغابايت', 'ميجابايت']);
  def('dat', 1e9, 'GB', ['gb', 'gigabyte', 'gigabytes', 'غيغابايت', 'جيجابايت', 'جيجا']);
  def('dat', 1e12, 'TB', ['tb', 'terabyte', 'terabytes', 'تيرابايت']);
  def('dat', 1024, 'KiB', ['kib']); def('dat', 1048576, 'MiB', ['mib']); def('dat', 1073741824, 'GiB', ['gib']);
  def('tim', 1, 's', ['sec', 'secs', 'second', 'seconds', 'ثانية', 'ثوان', 'ثواني']);
  def('tim', 60, 'min', ['mins', 'minute', 'minutes', 'دقيقة', 'دقائق']);
  def('tim', 3600, 'h', ['hr', 'hrs', 'hour', 'hours', 'ساعة', 'ساعات']);
  def('tim', 86400, 'day', ['d', 'days', 'يوم', 'أيام', 'ايام']);
  def('tim', 604800, 'week', ['wk', 'weeks', 'أسبوع', 'اسبوع', 'أسابيع']);
  def('tim', 31556952, 'year', ['yr', 'years', 'سنة', 'سنوات', 'عام']);
  def('ar', 1, 'm²', ['m2', 'sqm', 'متر مربع']);
  def('ar', 1e6, 'km²', ['km2', 'كم مربع']);
  def('ar', 10000, 'ha', ['hectare', 'hectares', 'هكتار']);
  def('ar', 4046.8564224, 'acre', ['acres', 'فدان']);
  def('ar', 0.09290304, 'ft²', ['ft2', 'sqft', 'قدم مربع']);
  const toC = { c: (v) => v, f: (v) => (v - 32) * 5 / 9, k: (v) => v - 273.15 };
  const fromC = { c: (v) => v, f: (v) => v * 9 / 5 + 32, k: (v) => v + 273.15 };
  function convert(q) {
    const m = q.match(/^(-?[\d.,]+)\s*(.+?)\s+(?:to|in|into|=|->|→|الى|إلى|بال)\s+(.+?)\??$/i);
    if (!m) return null;
    const v = parseFloat(m[1].replace(/,/g, '')), a = U[m[2].trim().toLowerCase()], b = U[m[3].trim().toLowerCase()];
    if (!a || !b || a[0] !== b[0] || isNaN(v)) return null;
    const r = a[0] === 'tmp' ? fromC[b[1]](toC[a[1]](v)) : v * a[1] / b[1];
    const val = fmt(r) + ' ' + b[2];
    return { label: fmt(v) + ' ' + a[2] + ' =', value: val, copy: fmt(r), hint: T('Unit Converter'), more: '/unit-converter/' };
  }

  /* ---------- calculator (safe, no eval) ---------- */
  function calc(src) {
    const s = src.replace(/×/g, '*').replace(/÷/g, '/').replace(/\s+/g, '').replace(/,/g, '');
    if (!/^[\d.+\-*/()%^]+$/.test(s) || !/[+\-*/%^]/.test(s.replace(/^-/, '')) || !/\d/.test(s)) return null;
    let i = 0;
    const peek = () => s[i];
    function num() { const m = s.slice(i).match(/^\d*\.?\d+(e[+-]?\d+)?/i); if (!m) throw 0; i += m[0].length; return parseFloat(m[0]); }
    function factor() {
      if (peek() === '-') { i++; return -factor(); }
      if (peek() === '+') { i++; return factor(); }
      let v;
      if (peek() === '(') { i++; v = expr(); if (s[i++] !== ')') throw 0; } else v = num();
      if (peek() === '%') { i++; v = v / 100; }
      if (peek() === '^') { i++; v = Math.pow(v, factor()); }
      return v;
    }
    function term() { let v = factor(); while (peek() === '*' || peek() === '/') { const o = s[i++], r = factor(); v = o === '*' ? v * r : v / r; } return v; }
    function expr() { let v = term(); while (peek() === '+' || peek() === '-') { const o = s[i++], r = term(); v = o === '+' ? v + r : v - r; } return v; }
    try { const v = expr(); if (i !== s.length || !isFinite(v)) return null; return { label: src.trim() + ' =', value: fmt(v), copy: fmt(v) }; } catch (e) { return null; }
  }
  function percentOf(q) {
    const m = q.match(/^([\d.,]+)\s*%\s*(?:of|من)\s*([\d.,]+)$/i);
    if (!m) return null;
    const r = parseFloat(m[1].replace(/,/g, '')) / 100 * parseFloat(m[2].replace(/,/g, ''));
    return { label: m[1] + '% ' + T('of') + ' ' + m[2] + ' =', value: fmt(r), copy: fmt(r) };
  }

  /* ---------- text helpers ---------- */
  const words = (t) => t.replace(/([a-z0-9])([A-Z])/g, '$1 $2').split(/[^\p{L}\p{N}]+/u).filter(Boolean);
  const cap = (w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
  const CASES = {
    upper: (t) => t.toUpperCase(), lower: (t) => t.toLowerCase(),
    camel: (t) => words(t).map((w, i) => (i ? cap(w) : w.toLowerCase())).join(''),
    pascal: (t) => words(t).map(cap).join(''),
    snake: (t) => words(t).map((w) => w.toLowerCase()).join('_'),
    kebab: (t) => words(t).map((w) => w.toLowerCase()).join('-'),
    constant: (t) => words(t).map((w) => w.toUpperCase()).join('_'),
    title: (t) => t.toLowerCase().replace(/(^|\s)\S/g, (c) => c.toUpperCase()),
    slug: (t) => t.normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, ''),
  };
  const b64e = (t) => { const b = new TextEncoder().encode(t); let s = ''; b.forEach((x) => { s += String.fromCharCode(x); }); return btoa(s); };
  const b64d = (t) => { const bin = atob(t.replace(/-/g, '+').replace(/_/g, '/').replace(/\s+/g, '') + '==='.slice((t.length + 3) % 4)); return new TextDecoder('utf-8', { fatal: true }).decode(Uint8Array.from(bin, (c) => c.charCodeAt(0))); };

  /* ---------- dates ---------- */
  const HM = AR ? ['محرّم', 'صفر', 'ربيع الأول', 'ربيع الآخر', 'جمادى الأولى', 'جمادى الآخرة', 'رجب', 'شعبان', 'رمضان', 'شوّال', 'ذو القعدة', 'ذو الحجة']
    : ['Muharram', 'Safar', 'Rabiʿ al-Awwal', 'Rabiʿ al-Thani', 'Jumada al-Ula', 'Jumada al-Akhirah', 'Rajab', 'Shaʿban', 'Ramadan', 'Shawwal', 'Dhu al-Qaʿdah', 'Dhu al-Hijjah'];
  function hijriToday() {
    const p = new Intl.DateTimeFormat('en-u-ca-islamic-umalqura-nu-latn', { day: 'numeric', month: 'numeric', year: 'numeric' }).formatToParts(new Date());
    const g = (t) => parseInt(p.find((x) => x.type === t).value, 10);
    const val = g('day') + ' ' + HM[g('month') - 1] + ' ' + g('year') + (AR ? ' هـ' : ' AH');
    const greg = new Date().toLocaleDateString(AR ? 'ar-u-nu-latn' : 'en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    return { label: T('Today') + ' · ' + greg, value: val, copy: val, hint: T('Hijri Date Converter'), more: '/date-converter/' };
  }

  /* ---------- main ---------- */
  ND.answer = function (raw) {
    const q0 = raw.trim(); if (!q0) return null;
    const q = toLatin(q0), ql = q.toLowerCase();
    let m;
    if ((m = ql.match(/^(?:pw|pass|password|passwd|كلمة مرور|كلمه مرور|كلمة سر|باسورد|باس)\s*(\d{1,3})?$/))) {
      const n = Math.min(128, Math.max(8, parseInt(m[1] || '20', 10)));
      return { label: ND.f('Strong password · {n} characters', { n }), value: password(n), secret: true, hint: T('Password Generator'), more: '/password-generator/' };
    }
    if ((m = ql.match(/^(?:pin|رمز)\s*(\d{1,2})?$/))) {
      const n = Math.min(16, Math.max(4, parseInt(m[1] || '6', 10))); let s = ''; for (let i = 0; i < n; i++) s += ND.randInt(10);
      return { label: ND.f('PIN · {n} digits', { n }), value: s, secret: true };
    }
    if (/^(uuid|guid|uuid4)$/.test(ql)) { const v = crypto.randomUUID ? crypto.randomUUID() : null; return v && { label: 'UUID v4', value: v }; }
    if (/^(hijri|today|date|تاريخ|التاريخ|اليوم|هجري|التاريخ الهجري)$/.test(ql)) return hijriToday();
    if (/^(unix|epoch|timestamp|now|الوقت)$/.test(ql)) { const t = Math.floor(Date.now() / 1000); return { label: T('Unix time now'), value: String(t) }; }
    if ((m = ql.match(/^(?:unix|epoch)\s+(\d{9,13})$/))) { const n = +m[1], d = new Date(m[1].length > 10 ? n : n * 1000); return { label: m[1] + ' =', value: d.toISOString().replace('.000', ''), hint: d.toLocaleString(AR ? 'ar-u-nu-latn' : undefined) }; }
    if ((m = q.match(/^(sha-?1|sha-?256|sha-?384|sha-?512)\s+([\s\S]+)$/i))) {
      const alg = 'SHA-' + m[1].replace(/sha-?/i, ''), text = m[2];
      return crypto.subtle.digest(alg, new TextEncoder().encode(text)).then((b) => {
        const h = Array.from(new Uint8Array(b), (x) => x.toString(16).padStart(2, '0')).join('');
        return { label: alg + ' · “' + (text.length > 24 ? text.slice(0, 24) + '…' : text) + '”', value: h, mono: true, hint: T('Hash Generator'), more: '/hash-generator/' };
      });
    }
    if ((m = q.match(/^(?:b64|base64)\s+([\s\S]+)$/i))) return { label: 'Base64', value: b64e(m[1]), mono: true, more: '/base64-tool/' };
    if ((m = q.match(/^(?:unb64|b64d|base64d|decode64)\s+([\s\S]+)$/i))) { try { return { label: T('Decoded Base64'), value: b64d(m[1]), more: '/base64-tool/' }; } catch (e) { return null; } }
    if ((m = q.match(/^(upper|lower|camel|pascal|snake|kebab|constant|title|slug)\s+([\s\S]+)$/i))) {
      const k = m[1].toLowerCase();
      const name = { upper: 'UPPERCASE', lower: 'lowercase', camel: 'camelCase', pascal: 'PascalCase', snake: 'snake_case', kebab: 'kebab-case', constant: 'CONSTANT_CASE', title: 'Title Case', slug: 'slug' }[k];
      return { label: name, value: CASES[k](m[2]), more: '/text-converter/' };
    }
    if (/^(?:https?:\/\/)?(?:[a-z0-9-]+\.)+[a-z]{2,}(?:[/:?#]\S*)?$/i.test(q0) && !/\s/.test(q0) && /[a-z]/i.test(q0.split(/[/?#]/)[0].split('.').pop())) {
      return { label: T('Is this link safe?'), value: q0.length > 48 ? q0.slice(0, 48) + '…' : q0, href: '/link-checker/#' + encodeURIComponent(q0), hint: T('Check it privately with the Link Checker'), action: 'open' };
    }
    return percentOf(q) || convert(q) || calc(q) || null;
  };
  ND.answerExamples = AR ? ['كلمة مرور 24', '10 كم الى ميل', 'هجري', '15% من 200', 'sha256 مرحبا'] : ['pw 24', '10 km in mi', 'hijri', '15% of 200', 'sha256 hello'];
})();
