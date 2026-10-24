/* Nicely Done — password strength estimate, shared by the home page and the Strength Checker.
   Runs entirely in the browser. Returns numbers and issue codes; each page words the issues itself. */
(function () {
  const COMMON = ['password','passw0rd','123456','12345678','123456789','1234567890','qwerty','qwertyuiop','abc123','111111','123123','admin','letmein','welcome','monkey','dragon','football','baseball','iloveyou','master','sunshine','princess','shadow','superman','michael','trustno1','starwars','whatever','hello','freedom','login','secret','computer','charlie','donald','batman','access','mustang','696969','654321','666666','121212','000000','zaq12wsx','1q2w3e4r','1qaz2wsx','asdfgh','asdfghjkl','zxcvbnm','google','samsung','apple','summer','winter','spring','autumn','love','pokemon','soccer','hockey','killer','jordan','hunter','ranger','buster','pepper','ginger','cookie','cheese','flower','tigger','matrix','qwerty123','password1','password123','admin123','root','toor','changeme','default','guest','test','test123','pass','pass123','user','abcdef','abcd1234','aaaaaa','987654321','00000000','11111111','q1w2e3r4','987654','ninja','azerty','solo','loveme','whatever1','mypass','mypassword','allah','bismillah','saudi','riyadh','arabia'];
  const WORDS = ['love','pass','word','admin','user','king','queen','star','moon','blue','red','dog','cat','life','baby','angel','money','team','game','golf','home','cool','summer','winter','apple','orange','lion','tiger','eagle','dragon','magic','power','secret','hello','world','sun','fire','ice','rock','music','happy','sweet','heart','god','jesus','allah'];
  const ROWS = ['qwertyuiop','asdfghjkl','zxcvbnm','1234567890','qwertzuiop','azertyuiop'];
  const LEET = { '0': 'o', '1': 'i', '3': 'e', '4': 'a', '5': 's', '7': 't', '@': 'a', '$': 's', '!': 'i' };

  function pool(pw) { let s = 0; if (/[a-z]/.test(pw)) s += 26; if (/[A-Z]/.test(pw)) s += 26; if (/[0-9]/.test(pw)) s += 10; if (/[^a-zA-Z0-9]/.test(pw)) s += 33; return s; }
  function seqLen(pw) {
    let max = 1, run = 1;
    for (let i = 1; i < pw.length; i++) {
      const d = pw.charCodeAt(i) - pw.charCodeAt(i - 1);
      if (Math.abs(d) === 1 && (i < 2 || pw.charCodeAt(i - 1) - pw.charCodeAt(i - 2) === d)) { run++; max = Math.max(max, run); } else run = 1;
    }
    return max >= 3 ? max : 0;
  }
  function kbWalk(pw) {
    const p = pw.toLowerCase(); let best = 0;
    ROWS.forEach((r) => { for (let n = Math.min(p.length, r.length); n >= 4; n--) { for (let i = 0; i + n <= r.length; i++) { const s = r.substr(i, n); if (p.includes(s) || p.includes([...s].reverse().join(''))) { best = Math.max(best, n); break; } } } });
    return best;
  }

  // issues: {k, sev, …} — k is one of common, word, kb, seq, rep, chunk, year, shape
  function strength(pw) {
    const len = [...pw].length, P = pool(pw);
    let bits = len * Math.log2(Math.max(P, 1));
    const issues = [];
    const lower = pw.toLowerCase();
    const unleet = lower.replace(/[013457@$!]/g, (c) => LEET[c] || c);
    const common = COMMON.find((c) => lower === c || unleet === c || unleet.replace(/\d+$/, '') === c);
    if (common) { bits = Math.min(bits, 10); issues.push({ k: 'common', sev: 'bad' }); }
    else {
      const dict = COMMON.concat(WORDS).filter((w) => w.length >= 4 && unleet.includes(w));
      if (dict.length) { const w = dict.sort((a, b) => b.length - a.length)[0]; bits -= w.length * Math.log2(P || 1) * 0.75; issues.push({ k: 'word', sev: 'fail', w, leet: unleet !== lower }); }
    }
    const kb = kbWalk(pw); if (kb) { bits -= kb * 2.5; issues.push({ k: 'kb', sev: 'fail', n: kb }); }
    const sq = seqLen(pw); if (sq) { bits -= sq * 2.5; issues.push({ k: 'seq', sev: 'fail', n: sq }); }
    const rep = pw.match(/(.)\1{2,}/); if (rep) { bits -= rep[0].length * 2; issues.push({ k: 'rep', sev: 'fail', c: rep[1], n: rep[0].length }); }
    const chunk = pw.match(/(.{2,})\1+/); if (chunk && chunk[0].length >= 4) { bits -= chunk[0].length * 1.5; issues.push({ k: 'chunk', sev: 'fail', c: chunk[1] }); }
    if (/(19|20)\d{2}/.test(pw)) { bits -= 6; issues.push({ k: 'year', sev: 'fail' }); }
    if (/^[A-Z][a-z]+\d+[^a-zA-Z0-9]?$/.test(pw)) { bits -= 8; issues.push({ k: 'shape', sev: 'fail' }); }
    bits = Math.max(0, bits);
    return { len, P, bits, unique: new Set(pw).size, issues, level: level(bits) };
  }
  // 1 very weak · 2 weak · 3 fair · 4 strong · 5 excellent
  function level(bits) { const b = Math.round(bits); return b < 28 ? 1 : b < 45 ? 2 : b < 64 ? 3 : b < 90 ? 4 : 5; }
  // Average seconds to crack at a given guess rate (half the space, on average)
  strength.seconds = (bits, rate) => Math.pow(2, bits) / 2 / rate;
  strength.level = level;
  const UNITS = [
    [3153600000, { one: 'century', other: 'centuries' }, { one: 'قرن', two: 'قرنين', few: 'قرون', many: 'قرن', other: 'قرن' }],
    [31536000, { one: 'year', other: 'years' }, { one: 'سنة', two: 'سنتين', few: 'سنين', many: 'سنة', other: 'سنة' }],
    [2592000, { one: 'month', other: 'months' }, { one: 'شهر', two: 'شهرين', few: 'شهور', many: 'شهر', other: 'شهر' }],
    [86400, { one: 'day', other: 'days' }, { one: 'يوم', two: 'يومين', few: 'أيام', many: 'يوم', other: 'يوم' }],
    [3600, { one: 'hour', other: 'hours' }, { one: 'ساعة', two: 'ساعتين', few: 'ساعات', many: 'ساعة', other: 'ساعة' }],
    [60, { one: 'minute', other: 'minutes' }, { one: 'دقيقة', two: 'دقيقتين', few: 'دقايق', many: 'دقيقة', other: 'دقيقة' }],
    [1, { one: 'second', other: 'seconds' }, { one: 'ثانية', two: 'ثانيتين', few: 'ثواني', many: 'ثانية', other: 'ثانية' }]];
  // Seconds → “3 years”, “Instantly”… (wording goes through the site’s runtime dictionary)
  strength.human = (sec) => {
    if (sec < 1) return ND.t('Instantly');
    if (sec > 3153600000 * 1e6) return ND.t('Heat death of the sun');
    for (const [s, en, ar] of UNITS) {
      if (sec >= s) {
        const v = sec / s;
        if (s === UNITS[0][0] && v >= 1000) return v >= 1e6 ? ND.f('{n} million centuries', { n: Math.round(v / 1e6) }) : ND.f('{n} thousand centuries', { n: Math.round(v / 1000) });
        return ND.count(Math.round(v), en, ar);
      }
    }
  };
  // Where a crack time sits on a 1 second → age-of-the-universe log scale, 0–100
  strength.scale = (sec) => Math.max(0, Math.min(100, (Math.log10(Math.max(sec, 1)) / 17.64) * 100));
  strength.FAST = 1e11; // offline attacker with a fast hash — the worst case
  (window.ND = window.ND || {}).strength = strength;
})();
