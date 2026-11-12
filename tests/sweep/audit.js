const audit = () => {
  const vw = document.documentElement.clientWidth, out = [];
  const vis = (el) => { const s = getComputedStyle(el); if (s.visibility === 'hidden' || s.display === 'none' || +s.opacity === 0) return false; const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
  const scrollerOf = (el) => { for (let n = el.parentElement; n && n !== document.body; n = n.parentElement) { const s = getComputedStyle(n); if (/(auto|scroll|hidden|clip)/.test(s.overflowX) && n.scrollWidth > n.clientWidth + 1) return n; if (/(hidden|clip)/.test(s.overflowX)) return n; } return null; };
  const name = (el) => (el.id ? '#' + el.id : el.tagName.toLowerCase() + (el.className && el.className.baseVal === undefined && el.className ? '.' + String(el.className).trim().split(/\s+/).slice(0, 2).join('.') : '')) + ' “' + (el.getAttribute('aria-label') || el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 26) + '”';
  if (document.documentElement.scrollWidth > vw + 1) out.push('PAGE scrolls sideways: ' + document.documentElement.scrollWidth + ' > ' + vw);
  document.querySelectorAll('a, button, input, select, textarea, [role="button"], [role="tab"], [role="menuitem"], summary, label, h1, h2, h3, p, .card, .btn, .chip, .badge').forEach((el) => {
    if (!vis(el) || el.closest('[hidden], [inert], .sr-only, .skip')) return;
    const r = el.getBoundingClientRect();
    if ((r.right > vw + 1 || r.left < -1) && !scrollerOf(el)) out.push('EDGE ' + name(el) + ' ' + Math.round(r.left) + '→' + Math.round(r.right));
  });
  // labels cut with an ellipsis
  document.querySelectorAll('button, a, .btn, .chip, .badge, label, th, .seg button, [role="tab"], h1, h2, h3, strong').forEach((el) => {
    if (!vis(el) || el.closest('[hidden], [inert]')) return; const s = getComputedStyle(el);
    if (s.textOverflow === 'ellipsis' && s.overflow !== 'visible' && el.scrollWidth > el.clientWidth + 1 && s.direction === 'ltr') out.push('CUT ' + name(el));
  });
  // tap targets (WCAG 2.2 2.5.8: 24 px, inline text links exempt)
  document.querySelectorAll('button, [role="button"], [role="tab"], input[type="checkbox"], input[type="radio"], select, summary, a.btn, a.icon-btn, .icon-btn').forEach((el) => {
    if (!vis(el) || el.closest('[hidden], [inert]') || el.disabled) return; let r = el.getBoundingClientRect();
    if ((el.type === 'checkbox' || el.type === 'radio') && el.closest('label')) r = el.closest('label').getBoundingClientRect();
    if (r.width < 23.5 || r.height < 23.5) out.push('SMALL ' + name(el) + ' ' + Math.round(r.width) + '×' + Math.round(r.height));
  });
  // text inputs under 16 px make iOS Safari zoom the page on focus
  document.querySelectorAll('input:not([type="checkbox"]):not([type="radio"]):not([type="range"]):not([type="file"]):not([type="hidden"]):not([type="color"]), textarea, select').forEach((el) => {
    if (!vis(el) || el.closest('[hidden], [inert]')) return; const fs = parseFloat(getComputedStyle(el).fontSize); if (fs < 16) out.push('ZOOM ' + name(el) + ' ' + fs + 'px');
  });
  return out;
};
const popAudit = (sel) => {
  const vw = document.documentElement.clientWidth, vh = innerHeight, el = document.querySelector(sel); if (!el) return [];
  const r = el.getBoundingClientRect(); if (!r.width) return [];
  return r.left < -1 || r.right > vw + 1 || r.top < -1 || r.bottom > vh + 1 ? [`POP ${sel} ${Math.round(r.left)},${Math.round(r.top)}→${Math.round(r.right)},${Math.round(r.bottom)} in ${vw}×${vh}`] : [];
};

module.exports = { audit, popAudit };
