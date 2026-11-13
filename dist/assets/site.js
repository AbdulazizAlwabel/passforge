/* Nicely Done — shared behaviour */
(function () {
  'use strict';
  const root = document.documentElement;
  root.classList.remove('no-js');

  const ICON_FILE = '<svg class="t-file" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8Z"/><path d="M14 3v5h5"/></svg>';
  const ICON_CHECK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>';

  const ND = (window.ND = window.ND || {});

  /* ---------- Language ----------
     Page content is translated at build time; this covers strings created by
     shared scripts and messages coming back from the API. */
  ND.lang = root.lang || 'en';
  const I18N = window.ND_I18N || {};
  const T = (ND.t = (s) => (s != null && Object.prototype.hasOwnProperty.call(I18N, s) ? I18N[s] : s));
  /* Locale-aware internal link: ND.url('/profile/') → '/ar/profile/' on Arabic pages. */
  ND.url = (path) => (ND.lang === 'ar' && path.charAt(0) === '/' && !path.startsWith('/ar/') ? '/ar' + path : path);
  /* Plurals: ND.pl(n, {one:'day', other:'days'}, {one:'يوم', two:'يومان', few:'أيام', many:'يومًا', other:'يوم'}) */
  const plRules = {};
  ND.pl = (n, en, ar) => {
    const forms = ND.lang === 'ar' && ar ? ar : en;
    const rule = (plRules[ND.lang] = plRules[ND.lang] || new Intl.PluralRules(ND.lang));
    return forms[rule.select(n)] || forms.other;
  };
  /* Template with {placeholders}; the template itself is translated. */
  ND.f = (t, v) => T(t).replace(/\{(\w+)\}/g, (m, k) => (v && k in v ? v[k] : m));
  /* Number + plural noun, e.g. ND.count(3, {...}, {...}) → "3 days" / "3 أيام" */
  ND.count = (n, en, ar) => {
    // Arabic duals stand alone: «ملفان», not «2 ملفان».
    if (ND.lang === 'ar' && ar && ar.two && n === 2) return ar.two;
    return n.toLocaleString(ND.lang === 'ar' ? 'en-US' : undefined) + ' ' + ND.pl(n, en, ar);
  };

  /* ---------- What this page uploads ----------
     A running count of the bytes this page sends in the body of its own requests (fetch, XHR, beacons),
     and of how many files it has asked for. Pages show it as proof: on a tool that works on your
     device the first number stays at zero, whatever you type or drop in. Set up before anything else
     runs, so nothing is missed. */
  (function () {
    let bytes = 0, requests = 0; const subs = [];
    const enc = typeof TextEncoder === 'function' ? new TextEncoder() : null;
    const len = (s) => (enc ? enc.encode(s).length : s.length);
    const size = (b) => {
      try {
        if (b == null) return 0;
        if (typeof b === 'string') return len(b);
        if (b instanceof Blob) return b.size;
        if (b instanceof ArrayBuffer || ArrayBuffer.isView(b)) return b.byteLength;
        if (b instanceof URLSearchParams) return len(b.toString());
        if (b instanceof FormData) { let n = 0; b.forEach((v, k) => { n += len(k) + (typeof v === 'string' ? len(v) : v.size); }); return n; }
      } catch (e) { /* unknown body: counted as nothing rather than guessed */ }
      return 0;
    };
    const tell = () => subs.forEach((f) => { try { f(); } catch (e) { /* a reader failed; keep counting */ } });
    const add = (n) => { if (n > 0) { bytes += n; tell(); } };
    const f0 = window.fetch;
    if (f0) window.fetch = function (input, init) {
      try {
        if (init && init.body != null) add(size(init.body));
        else if (typeof Request === 'function' && input instanceof Request && input.method !== 'GET' && input.method !== 'HEAD') input.clone().arrayBuffer().then((b) => add(b.byteLength), () => {});
      } catch (e) { /* never break a request over the count */ }
      return f0.apply(this, arguments);
    };
    if (window.XMLHttpRequest) { const s0 = XMLHttpRequest.prototype.send; XMLHttpRequest.prototype.send = function (body) { add(size(body)); return s0.apply(this, arguments); }; }
    if (navigator.sendBeacon) { const b0 = navigator.sendBeacon; navigator.sendBeacon = function (url, data) { add(size(data)); return b0.apply(this, arguments); }; }
    try { new PerformanceObserver((l) => { requests += l.getEntries().length; tell(); }).observe({ type: 'resource', buffered: true }); } catch (e) { /* no resource timing here */ }
    ND.sent = { get bytes() { return bytes; }, get requests() { return requests; }, on: (f) => { subs.push(f); } };
    /* any element marked data-sent shows the count and keeps it current */
    ND.sentBind = (el) => {
      const n = el.querySelector('[data-sent-n]'), r = el.querySelector('[data-sent-req]');
      const paint = () => { if (n) n.textContent = bytes.toLocaleString('en-US'); if (r) r.textContent = requests.toLocaleString('en-US'); el.setAttribute('data-sent', bytes ? 'some' : 'none'); };
      paint(); subs.push(paint);
    };
  })();

  /* ---------- Utilities ---------- */
  ND.$ = (s, el) => (el || document).querySelector(s);
  ND.$$ = (s, el) => Array.from((el || document).querySelectorAll(s));
  ND.esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  ND.store = {
    get(k, d) { try { const v = localStorage.getItem('nd:' + k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem('nd:' + k, JSON.stringify(v)); } catch (e) { /* storage unavailable */ } }
  };
  /* Unbiased random integer in [0, max) using rejection sampling. */
  ND.randInt = (max) => {
    if (max <= 0) return 0;
    const limit = Math.floor(0x100000000 / max) * max;
    const buf = new Uint32Array(1);
    let x;
    do { crypto.getRandomValues(buf); x = buf[0]; } while (x >= limit);
    return x % max;
  };
  ND.pick = (arr) => arr[ND.randInt(arr.length)];

  /* ---------- Toast ---------- */
  let toastEl, toastTimer;
  // kind: undefined (plain), 'done' (check draws itself) or 'file' (a file drops in, then the check)
  ND.toast = (msg, kind) => {
    if (!toastEl) {
      toastEl = document.createElement('div');
      toastEl.className = 'toast';
      toastEl.setAttribute('role', 'status');
      toastEl.setAttribute('aria-live', 'polite');
      document.body.appendChild(toastEl);
    }
    toastEl.className = 'toast' + (kind ? ' toast-' + kind : '');
    toastEl.innerHTML = (kind === 'file' ? ICON_FILE : '') + ICON_CHECK + '<span></span>';
    toastEl.querySelector('span').textContent = T(msg);
    requestAnimationFrame(() => toastEl.classList.add('show'));
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove('show'), kind === 'file' ? 2600 : 1900);
  };
  /* A finished download: the file drops in and a check draws itself */
  ND.done = (msg) => ND.toast(msg, 'file');
  /* Something worked: the check draws itself */
  ND.ok = (msg) => ND.toast(msg, 'done');

  /* ---------- Clipboard ---------- */
  ND.copy = async (text, btn, msg) => {
    if (text == null || text === '') return;
    try {
      await navigator.clipboard.writeText(text);
    } catch (e) {
      const ta = document.createElement('textarea');
      ta.value = text; ta.setAttribute('readonly', ''); ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.appendChild(ta); ta.select();
      try { document.execCommand('copy'); } catch (_) { /* ignore */ }
      ta.remove();
    }
    ND.toast(T(msg || 'Copied to clipboard'), 'done');
    if (btn) {
      // the button's icon turns into a check for a moment
      const ic = btn.querySelector('svg');
      if (ic && !btn._ic) { btn._ic = ic.outerHTML; ic.outerHTML = ICON_CHECK.replace('<svg ', '<svg class="ic-done" '); }
      btn.classList.add('done');
      clearTimeout(btn._t);
      btn._t = setTimeout(() => {
        btn.classList.remove('done');
        const d = btn.querySelector('svg.ic-done');
        if (d && btn._ic) d.outerHTML = btn._ic;
        btn._ic = null;
      }, 1400);
    }
  };

  /* ---------- Theme ---------- */
  /* Light is the default; the system's dark preference is followed until you choose for yourself. */
  const saved = ND.store.get('theme', null);
  if (saved === 'dark' || saved === 'light') root.setAttribute('data-theme', saved);
  const darkMq = matchMedia('(prefers-color-scheme: dark)');
  const currentTheme = () => root.getAttribute('data-theme') || (darkMq.matches ? 'dark' : 'light');
  const syncMeta = () => {
    const m = document.querySelector('meta[name="theme-color"]');
    if (m) m.setAttribute('content', '#06070c');   // the stage is ink in both themes
    const b = document.querySelector('[data-theme-toggle]');
    if (b) b.setAttribute('aria-pressed', currentTheme() === 'dark' ? 'true' : 'false');
  };
  syncMeta();
  if (darkMq.addEventListener) darkMq.addEventListener('change', syncMeta);
  document.addEventListener('click', (e) => {
    const t = e.target.closest('[data-theme-toggle]');
    if (!t) return;
    const next = currentTheme() === 'dark' ? 'light' : 'dark';
    root.setAttribute('data-theme', next);
    ND.store.set('theme', next);
    syncMeta();
  });

  /* ---------- Rest when nobody is there ----------
     Motion that repeats (the live dot, the glass on the home page) is paused after a few
     seconds without input, so an open tab never keeps the machine busy. */
  (function () {
    const root = document.documentElement; let timer = 0;
    const wake = () => { if (root.classList.contains('idle')) root.classList.remove('idle'); clearTimeout(timer); timer = setTimeout(() => root.classList.add('idle'), 12000); };
    ['pointermove', 'pointerdown', 'keydown', 'scroll', 'touchstart'].forEach((ev) => window.addEventListener(ev, wake, { passive: true }));
    wake();
  })();

  /* ---------- Header shadow ---------- */
  const header = document.querySelector('.site-header');
  if (header) {
    const onScroll = () => header.classList.toggle('scrolled', window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
  }

  /* ---------- Tools menu ---------- */
  ND.$$('[data-menu]').forEach((btn) => {
    const panel = document.getElementById(btn.dataset.menu);
    if (!panel) return;
    const set = (open) => {
      panel.hidden = !open; btn.setAttribute('aria-expanded', open ? 'true' : 'false');
      if (open) { const first = panel.querySelector('a'); if (first && ND._menuKey) first.focus(); }
    };
    btn.addEventListener('click', (e) => { e.preventDefault(); ND._menuKey = e.detail === 0; set(panel.hidden); });
    document.addEventListener('click', (e) => { if (!panel.hidden && !panel.contains(e.target) && !btn.contains(e.target)) set(false); });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !panel.hidden) { set(false); btn.focus(); } });
    panel.addEventListener('click', (e) => { if (e.target.closest('a')) set(false); });
  });

  /* ---------- Reveal on scroll ---------- */
  const reveals = ND.$$('.reveal');
  if ('IntersectionObserver' in window && reveals.length) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((en) => { if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); } });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.05 });
    reveals.forEach((el) => io.observe(el));
  } else {
    reveals.forEach((el) => el.classList.add('in'));
  }

  /* ---------- Range fill ---------- */
  ND.syncRange = (el) => {
    const p = ((el.value - el.min) / (el.max - el.min)) * 100;
    el.style.setProperty('--p', p + '%');
  };
  ND.$$('input[type="range"].range').forEach((r) => {
    ND.syncRange(r);
    r.addEventListener('input', () => ND.syncRange(r));
  });

  /* ---------- Command palette ---------- */
  const tools = window.ND_TOOLS || [];
  let cmdk, cmdInput, cmdList, cmdItems = [], cmdIndex = 0, lastFocus = null;

  function buildCmdk() {
    cmdk = document.createElement('div');
    cmdk.className = 'cmdk-backdrop';
    cmdk.setAttribute('inert', '');
    cmdk.innerHTML =
      '<div class="cmdk" role="dialog" aria-modal="true" aria-label="' + T('Search tools') + '">' +
        '<div class="cmdk-input"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>' +
        '<input type="text" placeholder="' + T('Search tools or type pw 24, 10 km in mi, 15% of 200…') + '" aria-label="' + T('Search tools') + '" autocomplete="off" spellcheck="false" role="combobox" aria-expanded="true" aria-controls="cmdk-list"><span class="kbd">esc</span></div>' +
        '<div class="cmdk-list" id="cmdk-list" role="listbox"></div>' +
        '<div class="cmdk-foot"><span><span class="kbd">↑</span> <span class="kbd">↓</span> ' + T('navigate') + '</span><span><span class="kbd">↵</span> ' + T('open') + '</span><span style="margin-inline-start:auto">nicelydone.qd.je</span></div>' +
      '</div>';
    document.body.appendChild(cmdk);
    cmdInput = cmdk.querySelector('input');
    cmdList = cmdk.querySelector('.cmdk-list');
    cmdk.addEventListener('click', (e) => { if (e.target === cmdk) closeCmdk(); });
    cmdInput.addEventListener('input', renderCmdk);
    cmdInput.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowDown') { e.preventDefault(); move(1); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); move(-1); }
      else if (e.key === 'Enter') { e.preventDefault(); activate(cmdItems[cmdIndex], e.shiftKey); }
      else if (e.key === 'Escape') { closeCmdk(); }
      else if (e.key === 'Tab') { e.preventDefault(); }
    });
  }

  function score(t, q) {
    if (!q) return 1;
    const hay = (t.name + ' ' + t.short + ' ' + t.cat + ' ' + (t.keywords || '')).toLowerCase();
    const terms = q.toLowerCase().split(/\s+/).filter(Boolean);
    let s = 0;
    for (const term of terms) {
      const i = hay.indexOf(term);
      if (i < 0) return 0;
      s += t.name.toLowerCase().startsWith(term) ? 10 : (t.name.toLowerCase().includes(term) ? 5 : 1);
    }
    return s;
  }

  let answerSeq = 0;
  function answerHtml(a) {
    const act = a.href ? T('open') : T('copy');
    return '<div class="cmdk-item cmdk-answer" role="option" id="cmdk-a" aria-selected="false"' +
      (a.href ? ' data-href="' + ND.url(a.href) + '"' : ' data-copy="' + ND.esc(a.copy != null ? a.copy : a.value) + '"') +
      (a.more ? ' data-more="' + ND.url(a.more) + '"' : '') + '>' +
      '<div class="ans-body"><span class="ans-label">' + ND.esc(a.label) + '</span>' +
      '<span class="ans-value' + (a.mono || a.secret ? ' mono' : '') + '">' + ND.esc(a.value) + '</span>' +
      (a.hint ? '<span class="ans-hint">' + ND.esc(a.hint) + '</span>' : '') + '</div>' +
      '<span class="ret">↵ ' + act + '</span></div>';
  }
  function renderCmdk() {
    const q = cmdInput.value.trim();
    const results = tools.map((t) => ({ t, s: score(t, q) })).filter((r) => r.s > 0);
    if (q) results.sort((a, b) => b.s - a.s);
    let html = '', lastCat = null;
    if (!q && ND.answerExamples) {
      html += '<div class="cmdk-try"><span>' + T('Try') + '</span>' + ND.answerExamples.map((x) => '<button type="button" data-try="' + ND.esc(x) + '">' + ND.esc(x) + '</button>').join('') + '</div>';
    }
    let ans = q && ND.answer ? ND.answer(q) : null;
    const seq = ++answerSeq;
    if (ans && typeof ans.then === 'function') {
      ans.then((a) => { if (seq === answerSeq && a) { const slot = cmdList.querySelector('#cmdk-a-slot'); if (slot) { slot.outerHTML = answerHtml(a); bindItems(); select(0); } } });
      html += '<div id="cmdk-a-slot" class="cmdk-answer-pending">…</div>';
      ans = null;
    } else if (ans) html += answerHtml(ans);
    const item = (t, id) => '<div class="cmdk-item" role="option" id="cmdk-' + id + '" data-href="' + t.href + '" aria-selected="false">' +
      '<div class="tile-icon" data-c="' + (t.c || '') + '">' + t.icon + '</div><div><strong>' + ND.esc(t.name) + '</strong><span>' + ND.esc(t.short) + '</span></div><span class="ret">↵</span></div>';
    if (!q) {
      // what you pinned or used last comes first — remembered only in this browser
      const bare = (h) => h.replace(/^\/ar\//, '/');
      const mine = ND.store.get('pins', []).concat(ND.store.get('recent', [])).filter((h, i, a) => a.indexOf(h) === i)
        .map((h) => tools.find((t) => bare(t.href) === h)).filter(Boolean).slice(0, 4);
      if (mine.length) html += '<div class="cmdk-group">' + T('Your tools') + '</div>' + mine.map((t, i) => item(t, 'm' + i)).join('');
    }
    results.forEach(({ t }, i) => {
      if (!q && t.cat !== lastCat) { html += '<div class="cmdk-group">' + ND.esc(t.cat) + '</div>'; lastCat = t.cat; }
      html += item(t, i);
    });
    cmdList.innerHTML = html || '<div class="cmdk-empty">' + T('No tools match') + ' “' + ND.esc(q) + '”<br><a class="link" href="' + ND.url('/suggest/') + '">' + T('Suggest a tool') + '</a></div>';
    cmdList.querySelectorAll('[data-try]').forEach((b) => b.addEventListener('click', () => { cmdInput.value = b.dataset.try; renderCmdk(); cmdInput.focus(); }));
    bindItems();
    cmdIndex = 0; select(0);
  }
  function bindItems() {
    cmdItems = ND.$$('.cmdk-item', cmdList);
    cmdItems.forEach((el, i) => {
      el.onmousemove = () => select(i);
      el.onclick = () => activate(el);
    });
  }
  function activate(el, alt) {
    if (!el) return;
    if (alt && el.dataset.more) { location.href = el.dataset.more; return; }
    if (el.dataset.copy != null) { ND.copy(el.dataset.copy, null, T('Copied')); closeCmdk(); return; }
    if (el.dataset.href) location.href = el.dataset.href;
  }

  function select(i) {
    if (!cmdItems.length) return;
    cmdItems.forEach((el) => el.setAttribute('aria-selected', 'false'));
    cmdIndex = (i + cmdItems.length) % cmdItems.length;
    const el = cmdItems[cmdIndex];
    el.setAttribute('aria-selected', 'true');
    cmdInput.setAttribute('aria-activedescendant', el.id);
    el.scrollIntoView({ block: 'nearest' });
  }
  function move(d) { select(cmdIndex + d); }

  function openCmdk() {
    if (!cmdk) buildCmdk();
    lastFocus = document.activeElement;
    cmdInput.value = '';
    renderCmdk();
    cmdk.classList.add('open');
    cmdk.removeAttribute('inert');
    document.body.style.overflow = 'hidden';
    setTimeout(() => cmdInput.focus(), 20);
  }
  function closeCmdk() {
    if (!cmdk) return;
    cmdk.classList.remove('open');
    cmdk.setAttribute('inert', '');
    document.body.style.overflow = '';
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }
  ND.openSearch = openCmdk;

  document.addEventListener('click', (e) => { if (e.target.closest('[data-search]')) { e.preventDefault(); openCmdk(); } });
  document.addEventListener('keydown', (e) => {
    const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement && document.activeElement.tagName) || (document.activeElement && document.activeElement.isContentEditable);
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); cmdk && cmdk.classList.contains('open') ? closeCmdk() : openCmdk(); }
    else if (e.key === '/' && !typing) { e.preventDefault(); openCmdk(); }
  });
  const isMac = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
  ND.$$('[data-sent]').forEach(ND.sentBind);
  ND.$$('[data-mod]').forEach((el) => { el.textContent = isMac ? '⌘' : 'Ctrl'; });

  /* ---------- Leaked-password check (Have I Been Pwned, k-anonymity) ----------
     Only the first 5 hex chars of the password's SHA-1 leave the device; the
     response lists ~800 matching suffixes (plus padding) and we compare locally.
     Resolves to a breach count (0 = not found) or null if the check failed. */
  const pwnedCache = new Map();
  ND.pwned = async (password) => {
    if (!password) return 0;
    try {
      const digest = await crypto.subtle.digest('SHA-1', new TextEncoder().encode(password));
      const hex = Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('').toUpperCase();
      const prefix = hex.slice(0, 5), suffix = hex.slice(5);
      let body = pwnedCache.get(prefix);
      if (!body) {
        const res = await fetch('https://api.pwnedpasswords.com/range/' + prefix, { headers: { 'Add-Padding': 'true' }, referrerPolicy: 'no-referrer', cache: 'no-store' });
        if (!res.ok) return null;
        body = await res.text();
        pwnedCache.set(prefix, body);
      }
      for (const line of body.split('\n')) {
        const [s, n] = line.trim().split(':');
        if (s === suffix) return parseInt(n, 10) || 0;
      }
      return 0;
    } catch (e) { return null; }
  };

  /* ---------- Accounts (optional backend) ----------
     The tools never need the API. When /api is reachable the header shows
     "Sign in" or the signed-in user; on static-only hosting it stays hidden. */
  ND.API = window.ND_API || '/api';
  ND.api = async (path, opts) => {
    opts = opts || {};
    const init = { method: opts.method || 'GET', credentials: 'include', headers: {} };
    if (opts.body !== undefined) { init.headers['Content-Type'] = 'application/json'; init.body = JSON.stringify(opts.body); }
    let res;
    try { res = await fetch(ND.API + path, init); }
    catch (e) { return { ok: false, status: 0, offline: true, data: { error: T('Can’t reach the server. Check your connection and try again.') } }; }
    let data = {};
    const ct = res.headers.get('content-type') || '';
    if (ct.includes('application/json')) { try { data = await res.json(); } catch (e) { /* empty body */ } }
    const offline = !ct.includes('application/json') && !res.ok;
    if (offline) data = { error: T('Accounts are not available on this deployment right now.') };
    if (data && typeof data === 'object') { if (data.error) data.error = T(data.error); if (data.message) data.message = T(data.message); }
    return { ok: res.ok, status: res.status, offline, data };
  };
  ND.me = (async () => {
    const slot = document.querySelector('[data-account]');
    const r = await ND.api('/session');
    if (r.offline) { if (slot) slot.hidden = true; return null; }
    const me = r.ok && r.data.user ? r.data.user : null;
    if (slot) {
      slot.hidden = false;
      if (me) {
        const u = me.username;
        slot.className = 'account-chip';
        slot.href = ND.url('/profile/');
        slot.setAttribute('aria-label', T('Your profile') + ' (' + u + ')');
        slot.innerHTML = '<span class="avatar">' + ND.esc(u.charAt(0).toUpperCase()) + '</span><span class="name">' + ND.esc(u) + '</span>';
      }
    }
    return me || false;
  })();

  /* ---------- Language suggestion ----------
     Arabic-language browsers on an English page get a one-line, dismissible
     pointer to the Arabic version (never an automatic redirect). */
  document.addEventListener('click', (e) => { if (e.target.closest('.lang-switch, [data-lang-go]')) ND.store.set('lang-choice', 1); });
  const sw = document.querySelector('.lang-switch');
  if (ND.lang === 'en' && sw && !ND.store.get('lang-choice', 0) && /^ar\b/i.test(navigator.language || '')) {
    const bar = document.createElement('div');
    bar.className = 'lang-hint'; bar.setAttribute('lang', 'ar'); bar.setAttribute('dir', 'rtl');
    bar.innerHTML = '<span>هذا الموقع متوفر بالعربية</span><a data-lang-go href="' + sw.getAttribute('href') + '">التبديل إلى العربية</a><button type="button" aria-label="إغلاق">×</button>';
    bar.querySelector('button').addEventListener('click', () => { ND.store.set('lang-choice', 1); bar.remove(); });
    document.body.appendChild(bar);
  }

  /* ---------- Offline support ---------- */
  /* ---------- Recently used tools (this browser only) ---------- */
  try {
    const here = location.pathname.replace(/^\/ar\//, '/');
    if ((window.ND_TOOLS || []).some((t) => t.href.replace(/^\/ar\//, '/') === here) && here !== '/') {
      const list = ND.store.get('recent', []).filter((h) => h !== here);
      list.unshift(here); ND.store.set('recent', list.slice(0, 8));
    }
  } catch (e) { /* storage unavailable */ }

  const calm = matchMedia('(prefers-reduced-motion: reduce)');
  /* ---------- Pin a tool to “Your tools” on the home page (this browser only) ---------- */
  ND.$$('.pin-btn').forEach((b) => {
    const href = b.dataset.pin;
    const paint = () => b.setAttribute('aria-pressed', ND.store.get('pins', []).includes(href));
    paint();
    b.addEventListener('click', () => {
      const pins = ND.store.get('pins', []), on = pins.includes(href);
      ND.store.set('pins', on ? pins.filter((h) => h !== href) : [href].concat(pins).slice(0, 12));
      paint(); ND.toast(T(on ? 'Removed from your tools' : 'Pinned — it’s on your home page now'), on ? undefined : 'done');
      if (!on && !calm.matches) { b.classList.remove('burst'); void b.offsetWidth; b.classList.add('burst'); }
    });
  });

  /* ---------- Numbers that count up to their value ---------- */
  ND.countUp = (el, to, fmt, ms) => {
    fmt = fmt || ((v) => Math.round(v));
    if (calm.matches || !isFinite(to)) { el.textContent = fmt(to); return; }
    const t0 = performance.now(), dur = ms || 700;
    (function step(t) {
      const k = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - k, 3);
      el.textContent = fmt(to * e);
      if (k < 1) requestAnimationFrame(step);
    })(t0);
  };

  /* ---------- Numbers marked data-count climb to their value when they come into view ---------- */
  const counters = ND.$$('[data-count]');
  if (counters.length && 'IntersectionObserver' in window && !calm.matches) {
    const cio = new IntersectionObserver((entries) => {
      entries.forEach((en) => { if (en.isIntersecting) { cio.unobserve(en.target); ND.countUp(en.target, +en.target.dataset.count, null, 900); } });
    }, { threshold: 0.6 });
    counters.forEach((el) => cio.observe(el));
  }

  /* ---------- Cards that grow into the page ----------
     When you open a tool from a card, the card's icon and title glide into place as the tool's
     heading (and back again). Cross-document view transitions — browsers without them just fade. */
  const strip = (p) => p.replace(/^\/ar\//, '/');
  const pathOf = (href) => { try { const u = new URL(href, location.href); return u.origin === location.origin ? strip(u.pathname) : null; } catch (e) { return null; } };
  const isTool = (p) => (window.ND_TOOLS || []).some((t) => strip(t.href) === p);
  const cardFor = (p) => ND.$$('main a[href]').find((a) => pathOf(a.getAttribute('href')) === p && a.querySelector('.tile-icon, .mi'));
  const named = (pairs) => { ND.$$('[style*="view-transition-name"]').forEach((el) => { el.style.viewTransitionName = ''; }); pairs.forEach(([el, n]) => { if (el) el.style.viewTransitionName = n; }); return pairs.map(([el]) => el); };
  const nameCard = (a) => named([[a.querySelector('.tile-icon, .mi'), 'vt-icon'], [a.querySelector('strong') || a.querySelector('.mi + span'), 'vt-title']]);
  // A tool page's own icon and title carry these names in CSS, so they are in place before the first frame.
  const hasHero = () => !!document.querySelector('.tool-title .tool-ic');
  // clear the names once the transition ends — unless a newer transition has named them since
  let vtGen = 0;
  const unname = (els, vt) => { const g = ++vtGen; vt.finished.finally(() => { if (g === vtGen) els.forEach((el) => el && (el.style.viewTransitionName = '')); }); };
  let clicked = null;
  document.addEventListener('click', (e) => { clicked = e.target.closest ? e.target.closest('a[href]') : null; }, true);
  window.addEventListener('pageswap', (e) => {
    if (!e.viewTransition || calm.matches) return;
    let to = null;
    try { to = pathOf(e.activation.entry.url); } catch (_) { to = clicked && pathOf(clicked.getAttribute('href')); }
    if (!to) return;
    // From a list to a tool: the card you clicked grows into the tool's heading. From a tool, its heading
    // already has the names, so it shrinks back into its card (or morphs into the next tool's heading).
    if (hasHero() || !isTool(to)) return;
    const a = clicked && pathOf(clicked.getAttribute('href')) === to && clicked.querySelector('.tile-icon, .mi') ? clicked : cardFor(to);
    if (a) unname(nameCard(a), e.viewTransition);
  });
  window.addEventListener('pagereveal', (e) => {
    if (!e.viewTransition || calm.matches || hasHero()) return;
    let from = null;
    try { from = pathOf(navigation.activation.from.url); } catch (_) { from = document.referrer ? pathOf(document.referrer) : null; }
    const a = from && isTool(from) ? cardFor(from) : null;
    if (a) unname(nameCard(a), e.viewTransition);
  });

  /* ---------- First visit: the logo's check draws itself once ---------- */
  if (root.classList.contains('nd-first')) {
    ND.store.set('seen', 1);
    setTimeout(() => root.classList.remove('nd-first'), 2500);
  }

  if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
    window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(() => {}));
  }
})();
