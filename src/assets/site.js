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
  const saved = ND.store.get('theme', null);
  if (saved) root.setAttribute('data-theme', saved);
  const currentTheme = () => root.getAttribute('data-theme') || (matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark');
  const syncMeta = () => {
    const m = document.querySelector('meta[name="theme-color"]');
    if (m) m.setAttribute('content', currentTheme() === 'light' ? '#f5f3ee' : '#0b0c0b');
  };
  syncMeta();
  document.addEventListener('click', (e) => {
    const t = e.target.closest('[data-theme-toggle]');
    if (!t) return;
    const next = currentTheme() === 'dark' ? 'light' : 'dark';
    root.setAttribute('data-theme', next);
    ND.store.set('theme', next);
    syncMeta();
  });

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

  /* ---------- Pointer glow on tiles ---------- */
  document.addEventListener('pointermove', (e) => {
    const tile = e.target.closest && e.target.closest('.tile');
    if (!tile) return;
    const r = tile.getBoundingClientRect();
    tile.style.setProperty('--mx', (e.clientX - r.left) + 'px');
    tile.style.setProperty('--my', (e.clientY - r.top) + 'px');
  }, { passive: true });

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
    results.forEach(({ t }, i) => {
      if (!q && t.cat !== lastCat) { html += '<div class="cmdk-group">' + ND.esc(t.cat) + '</div>'; lastCat = t.cat; }
      html += '<div class="cmdk-item" role="option" id="cmdk-' + i + '" data-href="' + t.href + '" aria-selected="false">' +
        '<div class="tile-icon">' + t.icon + '</div><div><strong>' + ND.esc(t.name) + '</strong><span>' + ND.esc(t.short) + '</span></div><span class="ret">↵</span></div>';
    });
    cmdList.innerHTML = html || '<div class="cmdk-empty">' + T('No tools match') + ' “' + ND.esc(q) + '”</div>';
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
    document.body.style.overflow = 'hidden';
    setTimeout(() => cmdInput.focus(), 20);
  }
  function closeCmdk() {
    if (!cmdk) return;
    cmdk.classList.remove('open');
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
    const r = await ND.api('/me');
    if (r.offline) { if (slot) slot.hidden = true; return null; }
    if (slot) {
      slot.hidden = false;
      if (r.ok && r.data.username) {
        const u = r.data.username;
        slot.className = 'account-chip';
        slot.href = ND.url('/profile/');
        slot.setAttribute('aria-label', T('Your profile') + ' (' + u + ')');
        slot.innerHTML = '<span class="avatar">' + ND.esc(u.charAt(0).toUpperCase()) + '</span><span class="name">' + ND.esc(u) + '</span>';
      }
    }
    return r.ok ? r.data : false;
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

  /* ---------- Cards that follow the pointer (mouse only, never with reduced motion) ---------- */
  const fine = matchMedia('(hover: hover) and (pointer: fine)');
  const SPOT = '.task, .try-card, .tile, .principle, .widget-callout, .cat-head, .related > a, .recent-i, .hero-drop';
  const TILT = '.task, .try-card, .tile';
  let spotEl = null;
  document.addEventListener('pointermove', (e) => {
    if (!fine.matches || calm.matches || e.pointerType !== 'mouse') return;
    const el = e.target.closest && e.target.closest(SPOT);
    if (spotEl && spotEl !== el) { spotEl.classList.remove('spot'); spotEl.style.removeProperty('--rx'); spotEl.style.removeProperty('--ry'); }
    spotEl = el;
    if (!el) return;
    const r = el.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top;
    el.style.setProperty('--mx', x + 'px'); el.style.setProperty('--my', y + 'px');
    el.classList.add('spot');
    if (el.matches(TILT)) {
      el.style.setProperty('--rx', ((0.5 - y / r.height) * 5).toFixed(2) + 'deg');
      el.style.setProperty('--ry', ((x / r.width - 0.5) * 6).toFixed(2) + 'deg');
    }
  }, { passive: true });
  document.addEventListener('pointerleave', () => { if (spotEl) { spotEl.classList.remove('spot'); spotEl = null; } });

  /* ---------- Cards that grow into the page ----------
     When you open a tool from a card, the card's icon and title glide into place as the tool's
     heading (and back again). Cross-document view transitions — browsers without them just fade. */
  const strip = (p) => p.replace(/^\/ar\//, '/');
  const pathOf = (href) => { try { const u = new URL(href, location.href); return u.origin === location.origin ? strip(u.pathname) : null; } catch (e) { return null; } };
  const isTool = (p) => (window.ND_TOOLS || []).some((t) => strip(t.href) === p);
  const cardFor = (p) => ND.$$('main a[href]').find((a) => pathOf(a.getAttribute('href')) === p && a.querySelector('.tile-icon, .mi'));
  const named = (pairs) => { ND.$$('[style*="view-transition-name"]').forEach((el) => { el.style.viewTransitionName = ''; }); pairs.forEach(([el, n]) => { if (el) el.style.viewTransitionName = n; }); return pairs.map(([el]) => el); };
  const nameCard = (a) => named([[a.querySelector('.tile-icon, .mi'), 'vt-icon'], [a.querySelector('strong') || a.querySelector('.mi + span'), 'vt-title']]);
  const nameHero = () => { const ic = document.querySelector('.tool-hero .tool-ic'); return ic ? named([[ic, 'vt-icon'], [document.querySelector('.tool-hero h1'), 'vt-title']]) : []; };
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
    let els = [];
    if (isTool(to)) {
      const a = clicked && pathOf(clicked.getAttribute('href')) === to && clicked.querySelector('.tile-icon, .mi') ? clicked : cardFor(to);
      if (a) els = nameCard(a);
    } else els = nameHero(); // leaving a tool for a list: the heading shrinks back into its card
    unname(els, e.viewTransition);
  });
  window.addEventListener('pagereveal', (e) => {
    if (!e.viewTransition || calm.matches) return;
    let from = null;
    try { from = pathOf(navigation.activation.from.url); } catch (_) { from = document.referrer ? pathOf(document.referrer) : null; }
    let els = nameHero();
    if (!els.length && from) { const a = cardFor(from); if (a) els = nameCard(a); }
    if (els.length) unname(els, e.viewTransition);
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
