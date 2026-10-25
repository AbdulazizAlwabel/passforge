/* Nicely Done — the link-checking rules, shared by the Link Checker and the Email Checker.
   Everything runs in the browser. Only the first 5 characters of SHA-256 fingerprints go to the server
   (k-anonymity), and the matching is done here. Wording goes through the site's runtime dictionary. */
(function () {
  const ND = window.ND, T = (s) => ND.t(s);
  // [name, official domain, words that mean "this is about them", Arabic names (for email senders)]
  const BRANDS = [
    ['Absher', 'absher.sa', ['absher'], ['أبشر']], ['Nafath', 'iam.gov.sa', ['nafath', 'nafaz'], ['نفاذ']], ['My Government', 'my.gov.sa', ['mygov'], ['حكومتي']],
    ['Saudi Post (SPL)', 'splonline.com.sa', ['splonline', 'saudipost', 'spl-'], ['البريد السعودي', 'سبل']], ['ZATCA', 'zatca.gov.sa', ['zatca'], ['زاتكا', 'هيئة الزكاة']], ['Tawakkalna', 'tawakkalna.sdaia.gov.sa', ['tawakkalna'], ['توكلنا']],
    ['Al Rajhi Bank', 'alrajhibank.com.sa', ['alrajhi', 'rajhi'], ['الراجحي']], ['Saudi National Bank', 'alahli.com', ['alahli', 'snb-'], ['البنك الأهلي', 'الأهلي السعودي']], ['Riyad Bank', 'riyadbank.com', ['riyadbank'], ['بنك الرياض']],
    ['SAB', 'sab.com', ['sabb'], ['ساب']], ['Alinma Bank', 'alinma.com', ['alinma'], ['الإنماء', 'الانماء']], ['Bank Albilad', 'bankalbilad.com', ['albilad'], ['بنك البلاد']], ['Arab National Bank', 'anb.com.sa', ['anb-'], ['العربي الوطني']],
    ['STC', 'stc.com.sa', ['stc-', 'mystc'], ['اس تي سي', 'إس تي سي']], ['stc pay', 'stcpay.com.sa', ['stcpay'], []], ['Mobily', 'mobily.com.sa', ['mobily'], ['موبايلي']], ['Zain', 'sa.zain.com', ['zain'], []],
    ['mada', 'mada.com.sa', ['mada-'], []], ['Aramex', 'aramex.com', ['aramex'], ['أرامكس', 'ارامكس']], ['SMSA Express', 'smsaexpress.com', ['smsa'], ['سمسا']], ['Saudia', 'saudia.com', ['saudia'], ['الخطوط السعودية']],
    ['Apple', 'apple.com', ['apple', 'icloud', 'appleid'], ['آبل', 'أبل']], ['Google', 'google.com', ['google', 'gmail'], ['قوقل', 'جوجل']], ['Microsoft', 'microsoft.com', ['microsoft', 'office365', 'outlook'], ['مايكروسوفت']],
    ['PayPal', 'paypal.com', ['paypal'], ['باي بال']], ['Netflix', 'netflix.com', ['netflix'], ['نتفليكس']], ['Amazon', 'amazon.sa', ['amazon'], ['أمازون', 'امازون']], ['noon', 'noon.com', ['noon-'], []],
    ['WhatsApp', 'whatsapp.com', ['whatsapp'], ['واتساب']], ['Instagram', 'instagram.com', ['instagram'], ['انستقرام', 'إنستغرام']], ['Facebook', 'facebook.com', ['facebook'], ['فيسبوك']],
    ['Binance', 'binance.com', ['binance'], ['بينانس']], ['DHL', 'dhl.com', ['dhl'], []]];
  const OFFICIAL_EXTRA = { 'apple.com': ['icloud.com', 'apple.co'], 'google.com': ['gmail.com', 'youtube.com', 'goo.gl', 'google.com.sa', 'googleusercontent.com', 'googleapis.com', 'gstatic.com', 'withgoogle.com'], 'microsoft.com': ['live.com', 'office.com', 'outlook.com', 'microsoftonline.com', 'microsoft365.com', 'azure.com', 'windows.com', 'xbox.com'], 'facebook.com': ['fb.com', 'fb.me', 'facebookmail.com'], 'whatsapp.com': ['wa.me', 'whatsapp.net'], 'amazon.sa': ['amazon.com', 'amazon.ae'], 'alahli.com': ['snb.com.sa'], 'aramex.com': ['aramex.net'], 'sa.zain.com': ['zain.com'], 'instagram.com': ['mail.instagram.com'], 'paypal.com': ['paypal.me'], 'netflix.com': ['mailer.netflix.com'] };
  const SHORTENERS = ['bit.ly', 'tinyurl.com', 'cutt.ly', 'is.gd', 'rb.gy', 'shorturl.at', 'tiny.cc', 'ow.ly', 'goo.gl', 's.id', 'rebrand.ly', 't.ly', 'v.gd', 'shorturl.gg', 'bit.do', 'qr.io', 'linktr.ee', 't.co'];
  const RISKY_TLDS = ['zip', 'mov', 'top', 'xyz', 'icu', 'cfd', 'sbs', 'click', 'link', 'cyou', 'rest', 'buzz', 'monster', 'quest', 'lol', 'mom', 'cam', 'bond', 'tk', 'ml', 'ga', 'cf', 'gq', 'support', 'live', 'shop', 'online', 'site', 'info', 'vip', 'win'];
  const BAIT = ['login', 'signin', 'sign-in', 'verify', 'verification', 'update', 'secure', 'account', 'wallet', 'confirm', 'unlock', 'suspend', 'prize', 'gift', 'reward', 'bonus', 'delivery', 'parcel', 'customs', 'fee', 'payment', 'invoice', 'refund', 'redeem', 'claim'];
  const TWO_LEVEL = /\.(com|net|org|gov|edu|med|sch)\.(sa|ae|uk|eg|kw|qa|bh|om|jo|tr|au|br|in)$/;

  const norm = (h) => h.toLowerCase().replace(/\.$/, '').replace(/^www\./, '');
  const registrable = (h) => { const p = h.split('.'); return TWO_LEVEL.test(h) ? p.slice(-3).join('.') : p.slice(-2).join('.'); };
  const isOfficial = (host, dom) => host === dom || host.endsWith('.' + dom) || (OFFICIAL_EXTRA[dom] || []).some((x) => host === x || host.endsWith('.' + x));
  const officialFor = (host) => BRANDS.find(([, dom]) => isOfficial(norm(host), dom)) || null;
  function lev(a, b) {
    const m = a.length, n = b.length; if (Math.abs(m - n) > 2) return 9;
    const d = Array.from({ length: m + 1 }, (_, i) => [i]); for (let j = 1; j <= n; j++) d[0][j] = j;
    for (let i = 1; i <= m; i++) for (let j = 1; j <= n; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    return d[m][n];
  }
  async function sha(s) { const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)); return Array.from(new Uint8Array(b), (x) => x.toString(16).padStart(2, '0')).join(''); }

  function parse(raw) {
    let s = raw.trim().replace(/^[<("']+|[>)"'.,]+$/g, '');
    if (!s || /\s/.test(s)) return null;
    if (!/^[a-z][a-z0-9+.-]*:/i.test(s)) s = 'https://' + s;
    try {
      const u = new URL(s);
      if (/^https?:$/.test(u.protocol) && !/\.[a-z0-9-]{2,}$/i.test(u.hostname) && !/^\d{1,3}(\.\d{1,3}){3}$/.test(u.hostname) && !u.hostname.startsWith('[')) return null;
      return u;
    } catch (e) { return null; }
  }

  // Which brand does this domain pretend to be (by name or look-alike spelling)? → {brand, domain, how}
  function imitates(host) {
    host = norm(host);
    if (officialFor(host)) return null;
    const reg = registrable(host), label = reg.split('.')[0], tokens = host.split(/[.-]/);
    for (const [name, dom, keys] of BRANDS) {
      const domLabel = dom.split('.')[0];
      const mentions = keys.some((k) => { k = k.replace(/-$/, ''); return k.length < 5 ? tokens.includes(k) : tokens.some((t) => t === k || t.startsWith(k) || (t.endsWith(k) && t.length - k.length <= 3)); });
      if (mentions) {
        const inName = keys.some((k) => { k = k.replace(/-$/, ''); return label.split('-').some((t) => t === k || t.startsWith(k) || (t.endsWith(k) && t.length - k.length <= 3)); });
        return { brand: name, domain: dom, how: 'mention', part: inName ? 'name' : 'sub' };
      }
      if (domLabel.length >= 6 && label !== domLabel && lev(label, domLabel) <= (domLabel.length >= 8 ? 2 : 1)) return { brand: name, domain: dom, how: 'lookalike', part: 'name' };
    }
    return null;
  }

  // Brands named in free text (an email's display name or subject), in English or Arabic
  function brandsIn(text) {
    const t = ' ' + String(text || '').toLowerCase() + ' ', out = [];
    for (const b of BRANDS) {
      const [name, , keys, ar] = b;
      const en = [name.toLowerCase()].concat(keys.map((k) => k.replace(/-$/, '')).filter((k) => k.length >= 5));
      const hit = en.some((w) => new RegExp('(^|[^a-z])' + w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '([^a-z]|$)').test(t)) || ar.some((w) => t.includes(w));
      if (hit) out.push(b);
    }
    return out;
  }

  function analyse(u, raw) {
    const F = []; const add = (sev, text, part) => F.push({ sev, text, part });
    raw = raw || u.href;
    const host = norm(u.hostname), reg = registrable(host), label = reg.split('.')[0], tld = host.split('.').pop();
    if (!/^https?:$/.test(u.protocol)) { add('high', ND.f('Uses the “{scheme}” scheme instead of a normal web address — it can run code or open apps.', { scheme: u.protocol.replace(':', '') }), 'scheme'); return { F, host }; }
    const official = officialFor(host);
    if (official) add('good', ND.f('This is the official address of {brand} ({domain}).', { brand: T(official[0]), domain: official[1] }), 'name');
    if (u.username || u.password || /^[^/]*@/.test(raw.replace(/^[a-z]+:\/\//i, ''))) add('high', T('Contains “@” before the address — everything before it is ignored, so the real destination is hidden.'), 'user');
    if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host) || host.startsWith('[')) add('high', T('Points to a raw IP address instead of a name — legitimate services almost never do this.'), 'name');
    if (host.split('.').some((p) => p.startsWith('xn--'))) add('high', T('Uses international characters that can imitate normal letters (punycode). The real address is: ') + host, label.startsWith('xn--') ? 'name' : 'sub');
    else if (/[^\x00-\x7f]/.test(raw.split(/[/?#]/).slice(0, 3).join('/'))) add('medium', T('Contains non-Latin characters in the address — check it carefully.'), 'name');
    const im = official ? null : imitates(host);
    if (im) {
      if (im.how === 'mention') add('high', ND.f('Mentions {brand} but is not {brand}’s official site ({domain}).', { brand: T(im.brand), domain: im.domain }), im.part);
      else add('high', ND.f('Looks like {domain} but is spelled differently — a classic imitation.', { domain: im.domain }), 'name');
    }
    if (SHORTENERS.includes(host)) add('medium', T('This is a shortened link — the real destination is hidden until you open it.'), 'name');
    if (RISKY_TLDS.includes(tld) && !official) add('medium', ND.f('Ends in “.{tld}”, a domain ending that is cheap and very common in scams.', { tld }), 'tld');
    if (/\.(apk|exe|scr|bat|msi|cmd|vbs|jar|dmg|pkg)$/i.test(u.pathname)) add('high', T('Downloads an app or program file — never install apps from links in messages.'), 'path');
    if (u.protocol === 'http:') add('low', T('Not encrypted (http) — anything you type could be read on the way.'), 'scheme');
    if (u.port && !['80', '443'].includes(u.port)) add('low', ND.f('Uses an unusual port ({port}).', { port: u.port }), 'port');
    const sub = host.split('.').length - reg.split('.').length;
    if (sub >= 3 || host.length > 45) add('low', T('Has an unusually long or deeply nested address — often used to hide the real domain.'), 'sub');
    const bait = BAIT.filter((w) => (host + u.pathname).toLowerCase().includes(w));
    if (bait.length && !official) add('low', ND.f('Uses pressure words often seen in scams: {words}.', { words: bait.slice(0, 4).join(', ') }), bait.some((w) => u.pathname.toLowerCase().includes(w)) ? 'path' : (bait.some((w) => label.includes(w)) ? 'name' : 'sub'));
    return { F, host, reg, official };
  }

  function variants(u) {
    const host = norm(u.hostname), keys = new Set(), path = u.pathname.replace(/\/+$/, '');
    keys.add('u:' + host + (u.port ? ':' + u.port : '') + path + u.search);
    keys.add('u:' + host + (u.port ? ':' + u.port : '') + path);
    const parts = host.split('.');
    for (let i = 0; i < parts.length - 1; i++) keys.add('d:' + parts.slice(i).join('.'));
    return [...keys];
  }

  // Check several links against the threat lists at once. → {hits: Map(href → [feed ids]), meta} (meta null if unavailable)
  async function lookup(urls) {
    const per = await Promise.all(urls.map(async (u) => ({ u, hashes: await Promise.all(variants(u).map(sha)) })));
    const pre = [...new Set(per.flatMap((x) => x.hashes.map((h) => h.slice(0, 5))))];
    const matches = {}; let meta = null;
    for (let i = 0; i < pre.length; i += 24) {
      try {
        const r = await ND.api('/linkcheck?p=' + pre.slice(i, i + 24).join(','));
        if (r.ok && r.data.ready) { meta = r.data; Object.assign(matches, r.data.matches); }
      } catch (e) { /* offline: the warning signs still work */ }
    }
    const hits = new Map(), head = meta ? meta.head || 64 : 64;
    per.forEach(({ u, hashes }) => {
      const found = new Set();
      hashes.forEach((h) => (matches[h.slice(0, 5)] || []).forEach(([fh, feed]) => { if (fh === h.slice(0, head)) found.add(feed); }));
      hits.set(u.href, [...found]);
    });
    return { hits, meta };
  }
  const feedNames = (meta, ids) => ids.map((id) => ((meta && meta.feeds.find((f) => f.id === id)) || {}).name || id);

  ND.lc = { BRANDS, SHORTENERS, norm, registrable, officialFor, imitates, brandsIn, parse, analyse, variants, lookup, feedNames, sha };
})();
