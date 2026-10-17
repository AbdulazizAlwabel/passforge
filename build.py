#!/usr/bin/env python3
"""Build the Nicely Done static site from src/ into dist/.

Every tool lives at /<slug>/index.html so clean URLs work on any static host
(GitHub Pages, Cloudflare Pages, Netlify, Azure Static Web Apps, IIS…).
"""
import datetime
import hashlib
import html
import json
import re
import shutil
from pathlib import Path

from i18n import Translator

ROOT = Path(__file__).parent
SRC = ROOT / "src"
DIST = ROOT / "dist"
DOMAIN = "nicelydone.qd.je"
ORIGIN = f"https://{DOMAIN}"
SITE = "Nicely Done"
GITHUB = "https://github.com/AbdulazizAlwabel/passforge"

# ---------------------------------------------------------------------------
# Icons (24px stroke icons)
# ---------------------------------------------------------------------------
def ic(body):
    return ('<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" '
            'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + body + '</svg>')

ICONS = {
    "lock": ic('<rect x="4" y="11" width="16" height="10" rx="2.5"/><path d="M8 11V7.5a4 4 0 0 1 8 0V11"/><circle cx="12" cy="16" r="1.2" fill="currentColor"/>'),
    "shield": ic('<path d="M12 21s7.5-3.6 7.5-9.5V5.8L12 3 4.5 5.8v5.7C4.5 17.4 12 21 12 21Z"/><path d="m9 12 2.2 2.2L15.5 10"/>'),
    "hash": ic('<path d="M5 9h15M4 15h15M10 3 8 21M16 3l-2 18"/>'),
    "user": ic('<circle cx="12" cy="8" r="4"/><path d="M4.5 21a7.5 7.5 0 0 1 15 0"/>'),
    "code": ic('<path d="m16 18 6-6-6-6M8 6l-6 6 6 6"/>'),
    "braces": ic('<path d="M8 3H7a2 2 0 0 0-2 2v4a2 2 0 0 1-2 2 2 2 0 0 1 2 2v4a2 2 0 0 0 2 2h1M16 3h1a2 2 0 0 1 2 2v4a2 2 0 0 0 2 2 2 2 0 0 0-2 2v4a2 2 0 0 1-2 2h-1"/>'),
    "globe": ic('<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/>'),
    "type": ic('<path d="M4 7V5h16v2M9 19h6M12 5v14"/>'),
    "ruler": ic('<path d="M3 17 17 3l4 4L7 21z"/><path d="m7 13 2 2M10 10l2 2M13 7l2 2"/>'),
    "calendar": ic('<rect x="3.5" y="5" width="17" height="15.5" rx="2.5"/><path d="M8 3v4M16 3v4M3.5 10h17"/><path d="M15.5 13.2a2.6 2.6 0 1 0 0 4.6 3.3 3.3 0 1 1 0-4.6Z"/>'),
    "gauge": ic('<path d="M4.9 18.5a9 9 0 1 1 14.2 0"/><path d="m12 14 4-5"/><circle cx="12" cy="14" r="1.6" fill="currentColor"/>'),
    "link": ic('<path d="M10 14a4.5 4.5 0 0 0 6.4 0l3.2-3.2a4.5 4.5 0 0 0-6.4-6.4L12 5.6"/><path d="M14 10a4.5 4.5 0 0 0-6.4 0l-3.2 3.2a4.5 4.5 0 0 0 6.4 6.4l1.2-1.2"/>'),
    "arrow": ic('<path d="M7 17 17 7M8 7h9v9"/>'),
    "search": ic('<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>'),
    "copy": ic('<rect x="8" y="8" width="13" height="13" rx="2.5"/><path d="M16 8V5.5A2.5 2.5 0 0 0 13.5 3h-8A2.5 2.5 0 0 0 3 5.5v8A2.5 2.5 0 0 0 5.5 16H8"/>'),
    "refresh": ic('<path d="M21 12a9 9 0 1 1-2.6-6.4L21 8"/><path d="M21 3v5h-5"/>'),
    "eye": ic('<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>'),
    "eye_off": ic('<path d="M10.6 5.1A10 10 0 0 1 12 5c6.4 0 10 7 10 7a17 17 0 0 1-3 3.9M6.6 6.6C3.6 8.4 2 12 2 12s3.6 7 10 7a9.6 9.6 0 0 0 5.4-1.6M3 3l18 18"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"/>'),
    "swap": ic('<path d="M7 4 3 8l4 4M3 8h14M17 20l4-4-4-4M21 16H7"/>'),
    "check": ic('<path d="M20 6 9 17l-5-5"/>'),
    "x": ic('<path d="M18 6 6 18M6 6l12 12"/>'),
    "alert": ic('<circle cx="12" cy="12" r="9"/><path d="M12 8v4.5M12 16h.01"/>'),
    "sparkle": ic('<path d="M12 3v4M12 17v4M3 12h4M17 12h4M6.3 6.3l2.5 2.5M15.2 15.2l2.5 2.5M6.3 17.7l2.5-2.5M15.2 8.8l2.5-2.5"/>'),
    "chev": ic('<path d="m9 18 6-6-6-6"/>'),
    "chev_l": ic('<path d="m15 18-6-6 6-6"/>'),
    "file": ic('<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/>'),
    "wifi": ic('<path d="M5 12.5a10 10 0 0 1 14 0M8.5 16a5 5 0 0 1 7 0M2 9a15 15 0 0 1 20 0"/><circle cx="12" cy="19.5" r="1" fill="currentColor"/>'),
    "offline": ic('<path d="M4 14.5A4.5 4.5 0 0 1 8.2 8a6 6 0 0 1 11.3 2.5A4 4 0 0 1 18 18.5H8"/><path d="m3 3 18 18"/>'),
    "cpu": ic('<rect x="6" y="6" width="12" height="12" rx="2"/><path d="M9 2v3M15 2v3M9 19v3M15 19v3M2 9h3M2 15h3M19 9h3M19 15h3"/>'),
    "sun": '<svg class="sun" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>',
    "moon": '<svg class="moon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20.5 14.1A8.5 8.5 0 1 1 9.9 3.5a6.6 6.6 0 0 0 10.6 10.6Z"/></svg>',
}

MARK = ('<svg class="brand-mark" viewBox="0 0 32 32" aria-hidden="true">'
        '<rect x="1" y="1" width="30" height="30" rx="9" fill="var(--text)"/>'
        '<path d="M8.5 16.8l4.6 4.6L23.5 10.6" fill="none" stroke="var(--accent)" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"/>'
        '</svg>')

# ---------------------------------------------------------------------------
# Tool registry
# ---------------------------------------------------------------------------
TOOLS = [
    dict(slug="password-generator", name="Password Generator", title="Password <em>Generator</em>",
         cat="Security", icon="lock",
         short="Unbiased, cryptographically secure passwords & passphrases.",
         lede="Strong passwords and memorable passphrases, generated with your device’s cryptographic random source. Nothing is sent, stored, or logged.",
         desc="Generate strong, cryptographically secure random passwords and passphrases in your browser. Adjustable length, character sets, and entropy meter. Nothing leaves your device.",
         keywords="random secure strong passphrase diceware generate"),
    dict(slug="strength-checker", name="Strength Checker", title="Password <em>Strength</em>",
         cat="Security", icon="shield",
         short="Entropy, crack-time estimates and pattern detection.",
         lede="See how a password holds up against real attacks — entropy, crack time across attack scenarios, and the patterns that weaken it.",
         desc="Check password strength privately in your browser: entropy bits, crack time estimates for online and offline attacks, common-password and pattern detection.",
         keywords="password strength test entropy crack time analyse"),
    dict(slug="share", name="One-Time Secret", title="One-time <em>secrets</em>",
         cat="Security", icon="link", offline=False, new=True,
         short="Share a password through a link that self-destructs.",
         lede="Send a password, API key or private note through a link that works exactly once. It’s encrypted in your browser — we only ever hold ciphertext we can’t read.",
         desc="Share passwords and secrets with end-to-end encrypted, self-destructing one-time links. Encrypted in your browser with AES-256; the key never reaches the server.",
         keywords="share secret password one-time link self-destruct burn encrypted send note"),
    dict(slug="hash-generator", name="Hash Generator", title="Hash <em>Generator</em>",
         cat="Security", icon="hash",
         short="MD5, SHA-1, SHA-256/384/512 for text or files.",
         lede="Live MD5 and SHA-family digests for text or whole files — with a verify field that lights up when a checksum matches.",
         desc="Generate MD5, SHA-1, SHA-256, SHA-384 and SHA-512 hashes of text or files instantly in your browser, and verify checksums.",
         keywords="md5 sha1 sha256 sha512 checksum digest file verify"),
    dict(slug="username-generator", name="Username Generator", title="Username <em>Generator</em>",
         cat="Security", icon="user",
         short="Distinctive handles in five personalities.",
         lede="Fresh handles in five personalities — professional, gamer, anonymous, friendly and techie. Click any name to copy it.",
         desc="Generate unique usernames and gamer tags in professional, gamer, anonymous, friendly and techie styles.",
         keywords="username handle gamertag nickname name"),
    dict(slug="base64-tool", name="Base64 Encoder", title="Base64 <em>Encode & Decode</em>",
         cat="Developer", icon="code",
         short="Encode and decode Base64 — standard or URL-safe.",
         lede="Encode or decode Base64 as you type, with full Unicode support, URL-safe mode, and file-to-Base64 conversion.",
         desc="Encode and decode Base64 and URL-safe Base64 strings live, with Unicode support and file to data-URL conversion.",
         keywords="base64 encode decode url-safe data url btoa atob"),
    dict(slug="json-formatter", name="JSON Formatter", title="JSON <em>Formatter</em>",
         cat="Developer", icon="braces",
         short="Format, validate, minify and sort JSON.",
         lede="Paste JSON to validate, pretty-print, minify, or sort its keys — with syntax highlighting and precise error locations.",
         desc="Format, validate, minify and sort JSON online with syntax highlighting and line/column error messages. Runs in your browser.",
         keywords="json format beautify validate minify pretty print lint"),
    dict(slug="text-converter", name="Text Case Converter", title="Text <em>Case</em> Converter",
         cat="Developer", icon="type",
         short="camelCase, snake_case, Title Case and more — all at once.",
         lede="Type once, get every case at the same time — camel, Pascal, snake, kebab, constant, title, sentence and more.",
         desc="Convert text between UPPERCASE, lowercase, Title Case, Sentence case, camelCase, PascalCase, snake_case, kebab-case and more.",
         keywords="case convert camel snake kebab pascal title upper lower"),
    dict(slug="ip-network", name="IP & Network", title="IP & <em>Network</em>",
         cat="Developer", icon="globe", offline=False,
         short="Your public IP, browser details and a subnet calculator.",
         lede="Your public IP and network at a glance, browser and device details, and a live IPv4 subnet calculator.",
         desc="See your public IP address, ISP and location, browser details, and calculate IPv4 subnets (CIDR, mask, broadcast, host range).",
         keywords="ip address my ip subnet cidr calculator network mask"),
    dict(slug="unit-converter", name="Unit Converter", title="Unit <em>Converter</em>",
         cat="Everyday", icon="ruler",
         short="Ten categories — weight, length, temperature, data and more.",
         lede="Convert across ten categories — weight, length, speed, temperature, volume, area, data, time, pressure and energy.",
         desc="Convert units of weight, length, speed, temperature, volume, area, data, time, pressure and energy instantly.",
         keywords="convert units kg lb km miles celsius fahrenheit"),
    dict(slug="speed-test", name="Speed Test", title="Speed <em>Test</em>",
         cat="Everyday", icon="gauge", offline=False, local=False, new=True,
         short="Private internet speed test — no third parties.",
         lede="Measure download, upload, latency and responsiveness under load — against our own server, with nothing logged and no third party watching.",
         desc="A private internet speed test: download, upload, latency, jitter and bufferbloat, measured against our own server in Riyadh. No tracking, no third parties, nothing stored.",
         keywords="speed test internet bandwidth download upload ping latency jitter bufferbloat mbps"),
    dict(slug="date-converter", name="Hijri Date Converter", title="Hijri <em>&amp;</em> Gregorian",
         cat="Everyday", icon="calendar",
         short="Umm al-Qura Hijri ⇄ Gregorian, with a dual calendar.",
         lede="Convert between the Hijri (Umm al-Qura) and Gregorian calendars, and browse both side by side in a dual calendar.",
         desc="Convert dates between Hijri (Islamic, Umm al-Qura) and Gregorian calendars with today’s date and a dual monthly calendar.",
         keywords="hijri islamic gregorian date convert umm al-qura calendar"),
]
TOOL_BY_SLUG = {t["slug"]: t for t in TOOLS}
CATS = ["Security", "Developer", "Everyday"]
CAT_META = {
    "Security": dict(slug="security", name="Security & privacy", title="Security &amp; <em>privacy</em>", icon="shield",
                     blurb="Create, check and share secrets without trusting anyone — passwords, hashes and self-destructing links."),
    "Developer": dict(slug="developer", name="Developer", title="Developer <em>tools</em>", icon="code",
                      blurb="Encoders, formatters and network helpers for everyday development — instant, offline, nothing uploaded."),
    "Everyday": dict(slug="everyday", name="Everyday", title="Everyday <em>tools</em>", icon="sparkle",
                     blurb="Practical helpers for daily life — units, Hijri dates and how fast your internet really is."),
}
FEATURED = ["password-generator", "share", "speed-test"]

# ---------------------------------------------------------------------------
# Template pieces
# ---------------------------------------------------------------------------
THEME_BOOT = ("<script>(function(){try{var t=JSON.parse(localStorage.getItem('nd:theme'));"
              "if(t)document.documentElement.setAttribute('data-theme',t)}catch(e){}})();</script>")


def tools_json():
    return json.dumps([
        dict(name=t["name"], short=t["short"], cat=CAT_META[t["cat"]]["name"], href=f"/{t['slug']}/",
             icon=ICONS[t["icon"]], keywords=t["keywords"]) for t in TOOLS
    ], ensure_ascii=False).replace("</", "<\\/")


def head(title, desc, path, extra_fonts="", jsonld=None, noindex=False):
    url = ORIGIN + path
    ld = ""
    if jsonld:
        ld = '<script type="application/ld+json">' + json.dumps(jsonld, ensure_ascii=False) + "</script>"
    robots = '\n<meta name="robots" content="noindex">' if noindex else ""
    return f"""<!doctype html>
<html lang="en" class="no-js">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>{html.escape(title)}</title>
<meta name="description" content="{html.escape(desc)}">
<link rel="canonical" href="{url}">{robots}
<meta name="theme-color" content="#0b0c0b">
<meta name="color-scheme" content="dark light">
<meta property="og:type" content="website">
<meta property="og:site_name" content="{SITE}">
<meta property="og:title" content="{html.escape(title)}">
<meta property="og:description" content="{html.escape(desc)}">
<meta property="og:url" content="{url}">
<meta property="og:image" content="{ORIGIN}/og.png">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="{html.escape(title)}">
<meta name="twitter:description" content="{html.escape(desc)}">
<meta name="twitter:image" content="{ORIGIN}/og.png">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="icon" href="/favicon-32.png" sizes="32x32" type="image/png">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<link rel="manifest" href="/manifest.webmanifest">
<link rel="preload" href="/assets/fonts/geist-normal-300-700-latin.woff2" as="font" type="font/woff2" crossorigin>
<link rel="preload" href="/assets/fonts/instrument-serif-normal-400-latin.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="/assets/fonts.css?v={{V}}">
<link rel="stylesheet" href="/assets/site.css?v={{V}}">
{THEME_BOOT}
<!--HREFLANG-->
{ld}
</head>
<body>
<a class="skip" href="#main">Skip to content</a>
<div class="atmos" aria-hidden="true"><div class="grid"></div></div>
"""


def tools_menu():
    cols = ""
    for c in CATS:
        m = CAT_META[c]
        items = "".join(f'<a href="/{t["slug"]}/"><span class="mi">{ICONS[t["icon"]]}</span><span>{t["name"]}</span></a>'
                        for t in TOOLS if t["cat"] == c)
        cols += (f'<div class="menu-col"><a class="menu-cat" href="/{m["slug"]}/">{m["name"]}</a>'
                 f'<div class="menu-items">{items}</div></div>')
    return f'<div class="menu" id="toolsMenu" hidden><div class="wrap"><div class="menu-grid">{cols}</div></div></div>'


def header(active=None):
    tools_cur = ' aria-current="page"' if active == "tools" else ""
    about_cur = ' aria-current="page"' if active == "about" else ""
    return f"""<header class="site-header">
  <div class="wrap">
    <a class="brand" href="/" aria-label="{SITE} — home">{MARK}<span class="brand-word">nicely<em>done</em></span></a>
    <nav class="nav" aria-label="Primary">
      <a class="nav-link menu-btn" href="/#tools" data-menu="toolsMenu" aria-expanded="false" aria-controls="toolsMenu"{tools_cur}>Tools {ICONS['chev']}</a>
      <a class="nav-link" href="/about/"{about_cur}>About</a>
      <a class="btn btn-sm" data-account hidden href="/account/">Sign in</a>
      <button class="search-trigger" data-search aria-label="Search tools">{ICONS['search']}<span>Search tools…</span><span class="kbd"><span data-mod>Ctrl</span>K</span></button>
      <a class="icon-btn lang-switch" href="{{ALT_HREF}}" hreflang="{{ALT_LANG}}" lang="{{ALT_LANG}}" aria-label="{{ALT_LABEL}}">{{ALT_TEXT}}</a>
      <button class="icon-btn theme-toggle" data-theme-toggle aria-label="Toggle colour theme">{ICONS['moon']}{ICONS['sun']}</button>
    </nav>
  </div>
  {tools_menu()}
</header>
"""


def footer():
    cols = ""
    for c in CATS:
        items = "".join(f'<li><a href="/{t["slug"]}/">{t["name"]}</a></li>' for t in TOOLS if t["cat"] == c)
        cols += f'<div><h5><a href="/{CAT_META[c]["slug"]}/">{CAT_META[c]["name"]}</a></h5><ul>{items}</ul></div>'
    year = datetime.date.today().year
    return f"""<footer class="site-footer">
  <div class="wrap">
    <div class="foot-grid">
      <div>
        <a class="brand" href="/">{MARK}<span class="brand-word">nicely<em>done</em></span></a>
        <p class="foot-tag">Small, sharp tools that work in your browser. No sign-up needed, no tracking, no one watching.</p>
      </div>
      {cols}
    </div>
    <div class="foot-big" aria-hidden="true">nicely<em>done</em></div>
    <div class="foot-bottom">
      <span>© {year} {SITE} · <a href="/about/">About &amp; trust</a> · <a href="/widgets/">iPhone widgets</a> · <a href="{GITHUB}" rel="noopener">Source on GitHub</a></span>
      <span>Private by design · No tracking, no third parties</span>
    </div>
  </div>
</footer>
"""


def scripts(page_script=""):
    return (f"<script>window.ND_TOOLS={tools_json()};</script>\n"
            f'<script src="/assets/site.js?v={{V}}"></script>\n'
            f"{page_script}\n</body>\n</html>\n")


# ---------------------------------------------------------------------------
# Pages
# ---------------------------------------------------------------------------
def split_sections(text):
    parts = {}
    for m in re.finditer(r"<!--\s*@(\w+)\s*-->(.*?)(?=<!--\s*@\w+\s*-->|\Z)", text, re.S):
        parts[m.group(1)] = m.group(2).strip()
    return parts


def render_icons(text):
    return re.sub(r"\{\{icon:(\w+)\}\}", lambda m: ICONS[m.group(1)], text)


def build_tool(t):
    src = (SRC / "pages" / f"{t['slug']}.html").read_text()
    s = split_sections(render_icons(src))
    path = f"/{t['slug']}/"
    jsonld = {
        "@context": "https://schema.org", "@type": "WebApplication",
        "name": f"{t['name']} — {SITE}", "url": ORIGIN + path, "description": t["desc"],
        "applicationCategory": "UtilitiesApplication", "operatingSystem": "Any",
        "offers": {"@type": "Offer", "price": "0", "priceCurrency": "USD"},
        "isAccessibleForFree": True,
    }
    extra = ""
    related = [x for x in TOOLS if x["cat"] == t["cat"] and x["slug"] != t["slug"]]
    related = (related + [x for x in TOOLS if x["cat"] != t["cat"]])[:3]
    rel_html = "".join(
        f'<a href="/{r["slug"]}/"><div class="tile-icon">{ICONS[r["icon"]]}</div>'
        f'<div><strong>{r["name"]}</strong><span>{r["short"]}</span></div></a>' for r in related)
    badges = s.get("badges", "")
    local_badge = f'<span class="badge">{ICONS["cpu"]}Runs on your device</span>' if t.get("local", True) else ""
    offline_badge = f'<span class="badge">{ICONS["offline"]}Works offline</span>' if t.get("offline", True) else ""
    aside = s.get("aside", "")
    ws_class = "workspace" if aside else "workspace single"
    aside_html = f'<aside class="aside">{aside}</aside>' if aside else ""
    about = s.get("about", "")
    about_html = f'<section class="section" style="padding-top:0"><div class="wrap"><div class="prose reveal">{about}</div></div></section>' if about else ""

    page = head(f"{t['name']} — {SITE}", t["desc"], path, extra, jsonld) + header() + f"""<main id="main">
  <section class="tool-hero">
    <div class="wrap">
      <nav class="crumbs" aria-label="Breadcrumb"><a href="/">Home</a>{ICONS['chev']}<a href="/{CAT_META[t['cat']]['slug']}/">{CAT_META[t['cat']]['name']}</a>{ICONS['chev']}<span aria-current="page">{t['name']}</span></nav>
      <h1 class="h1">{t['title']}</h1>
      <p class="lede">{t['lede']}</p>
      <div class="tool-badges">
        {local_badge}
        {offline_badge}
        {badges}
      </div>
    </div>
  </section>
  <section>
    <div class="wrap {ws_class}">
      <div class="tool">{s['tool']}</div>
      {aside_html}
    </div>
  </section>
  {about_html}
  <section class="section" style="padding-top:0">
    <div class="wrap">
      <p class="panel-title" style="margin-bottom:16px">More tools</p>
      <div class="related">{rel_html}</div>
    </div>
  </section>
</main>
""" + footer() + scripts(s.get("script", ""))
    return page.replace("{GITHUB}", GITHUB)


def tool_card(t, i=0, preview=""):
    badge = '<span class="badge ok" style="height:22px">New</span>' if t.get("new") else ""
    return f"""<a class="tile reveal" style="--d:{(i % 3) * 70}ms" href="/{t['slug']}/">
  <div class="tile-top"><div class="tile-icon">{ICONS[t['icon']]}</div><span class="tile-cat">{badge}</span></div>
  {preview}
  <h3>{t['name']}</h3>
  <p>{t['short']}</p>
  <span class="tile-go">{ICONS['arrow']}</span>
</a>
"""


def tool_row(t):
    new = ' <span class="badge ok row-new">New</span>' if t.get("new") else ""
    return (f'<a class="tool-row" href="/{t["slug"]}/"><span class="tile-icon">{ICONS[t["icon"]]}</span>'
            f'<span class="tr-text"><strong>{t["name"]}{new}</strong><span>{t["short"]}</span></span>'
            f'<span class="tr-go">{ICONS["chev"]}</span></a>')


PREVIEWS = {
    "password-generator": '<div class="tile-preview" id="tilePw" aria-hidden="true">k7#Qm<b>9</b>vX!pL2<b>@</b>wR4z</div>',
    "share": '<div class="tile-preview" aria-hidden="true">nicelydone.qd.je/s/#<b>••••••••</b></div>',
    "speed-test": '<div class="tile-preview" id="tileSpeed" aria-hidden="true">↓ <b>—</b> Mbps · ↑ <b>—</b> Mbps · <b>—</b> ms</div>',
}


def build_home():
    featured = "".join(tool_card(TOOL_BY_SLUG[slug], i, PREVIEWS.get(slug, "")) for i, slug in enumerate(FEATURED))
    groups = ""
    for i, c in enumerate(CATS):
        m = CAT_META[c]
        rows = "".join(tool_row(t) for t in TOOLS if t["cat"] == c)
        n = sum(1 for t in TOOLS if t["cat"] == c)
        groups += f"""<div class="cat-group reveal" style="--d:{i * 80}ms">
  <a class="cat-head" href="/{m['slug']}/"><span class="tile-icon">{ICONS[m['icon']]}</span><span><strong>{m['name']}</strong><span class="cat-count">{n} tools</span></span>{ICONS['chev']}</a>
  <div class="cat-rows">{rows}</div>
</div>
"""
    jsonld = {
        "@context": "https://schema.org", "@type": "WebSite", "name": SITE, "url": ORIGIN + "/",
        "description": "Private, browser-based security and developer tools.",
    }
    desc = ("Beautifully crafted, private tools — password generator, one-time secret links, speed test, strength checker, "
            "hashes, Base64, JSON, text case, IP & subnet, unit and Hijri date converters. No tracking, no third parties.")
    page = head(f"{SITE} — Small tools, nicely done.", desc, "/", "", jsonld) + header() + f"""<main id="main">
  <section class="hero">
    <div class="wrap hero-row">
      <div>
        <p class="eyebrow reveal"><span class="dot"></span>{len(TOOLS)} tools · zero tracking</p>
        <h1 class="display reveal" style="--d:80ms">Small tools,<br><em>nicely done.</em></h1>
        <p class="lede reveal" style="--d:160ms">A quiet, beautifully made toolkit for security and everyday developer work. Every calculation happens on your device — nothing you type ever leaves it.</p>
        <div class="hero-cta reveal" style="--d:240ms">
          <a class="btn btn-primary" href="#tools">Explore the tools {ICONS['arrow']}</a>
          <button class="btn" data-search>{ICONS['search']} Search <span class="kbd"><span data-mod>Ctrl</span>K</span></button>
        </div>
        <div class="trust reveal" style="--d:320ms">
          <span>{ICONS['cpu']}Runs in your browser</span>
          <span>{ICONS['shield']}No sign-up, no cookies</span>
          <span>{ICONS['offline']}Works offline</span>
        </div>
      </div>
      <div class="specimen reveal" style="--d:260ms" aria-label="Live password preview">
        <div class="specimen-head">
          <div class="specimen-dots"><i></i><i></i><i></i></div>
          <span class="eyebrow" style="font-size:.68rem">live · crypto.getRandomValues</span>
        </div>
        <div class="specimen-pw" id="specPw" aria-live="off">&nbsp;</div>
        <div class="specimen-meta">
          <span id="specBits">— bits</span>
          <span class="bar"><i id="specBar"></i></span>
          <button class="copy" id="specCopy" aria-label="Copy this password">{ICONS['copy']}Copy</button>
        </div>
      </div>
    </div>
  </section>

  <section class="section" id="tools" style="padding-top:clamp(24px,4vw,48px)">
    <div class="wrap">
      <div class="section-head">
        <div>
          <h2 class="h2 reveal">Start <em>here</em></h2>
          <p class="lede reveal" style="--d:80ms">The three tools people reach for most.</p>
        </div>
      </div>
      <div class="featured">{featured}</div>
    </div>
  </section>

  <section class="section" style="padding-top:0">
    <div class="wrap">
      <div class="section-head">
        <div>
          <h2 class="h2 reveal">Every <em>tool</em>, in its place</h2>
          <p class="lede reveal" style="--d:80ms">Grouped by what you’re trying to do. Or press <span class="kbd"><span data-mod>Ctrl</span>K</span> and type.</p>
        </div>
      </div>
      <div class="cat-groups">{groups}</div>
      <a class="widget-callout reveal" href="/widgets/"><span class="tile-icon">{ICONS['calendar']}</span><span class="tr-text"><strong>On iPhone? Add the widgets</strong><span>Hijri date, one-tap passwords and site status on your Home Screen and Lock Screen.</span></span><span class="tr-go">{ICONS['chev']}</span></a>
    </div>
  </section>

  <section class="section" id="principles">
    <div class="wrap">
      <div class="section-head"><h2 class="h2 reveal">Made with <em>care</em></h2></div>
      <div class="principles reveal">
        <div class="principle"><span class="num">01</span><h3>Private by design</h3><p>No analytics, no ads, no third parties. Passwords and data are generated and processed on your device with the Web Crypto API.</p></div>
        <div class="principle"><span class="num">02</span><h3>Fast &amp; offline</h3><p>Pages are tiny and cached on first visit, so most tools keep working on a plane, in a basement, or behind a firewall.</p></div>
        <div class="principle"><span class="num">03</span><h3>Free, quietly</h3><p>No sign-ups, no paywalls, no pop-ups. Press <span class="kbd"><span data-mod>Ctrl</span>K</span> anywhere to jump straight to a tool.</p></div>
      </div>
    </div>
  </section>
</main>
""" + footer() + scripts(HOME_SCRIPT)
    return page


def build_category(c):
    m = CAT_META[c]
    tools = [t for t in TOOLS if t["cat"] == c]
    cards = "".join(tool_card(t, i, PREVIEWS.get(t["slug"], "")) for i, t in enumerate(tools))
    others = "".join(
        f'<a href="/{CAT_META[o]["slug"]}/"><div class="tile-icon">{ICONS[CAT_META[o]["icon"]]}</div>'
        f'<div><strong>{CAT_META[o]["name"]}</strong><span>{CAT_META[o]["blurb"]}</span></div></a>' for o in CATS if o != c)
    path = f"/{m['slug']}/"
    return head(f"{m['name']} — {SITE}", m["blurb"], path) + header("tools") + f"""<main id="main">
  <section class="tool-hero">
    <div class="wrap">
      <nav class="crumbs" aria-label="Breadcrumb"><a href="/">Home</a>{ICONS['chev']}<span aria-current="page">{m['name']}</span></nav>
      <h1 class="h1">{m['title']}</h1>
      <p class="lede">{m['blurb']}</p>
    </div>
  </section>
  <section class="section" style="padding-top:0">
    <div class="wrap"><div class="featured">{cards}</div></div>
  </section>
  <section class="section" style="padding-top:0">
    <div class="wrap">
      <p class="panel-title" style="margin-bottom:16px">Other categories</p>
      <div class="related related-2">{others}</div>
    </div>
  </section>
</main>
""" + footer() + scripts(HOME_SCRIPT_TILES)


HOME_SCRIPT = r"""<script>
(function(){
  if(new URLSearchParams(location.search).get('deleted')==='1'){ND.toast('Your account has been deleted');history.replaceState(null,'',location.pathname);}
  const CH={u:'ABCDEFGHJKLMNPQRSTUVWXYZ',l:'abcdefghijkmnopqrstuvwxyz',n:'23456789',s:'!@#$%^&*-_=+?'};
  const ALL=CH.u+CH.l+CH.n+CH.s, POOL=26+26+10+13, LEN=20;
  const el=document.getElementById('specPw'),bits=document.getElementById('specBits'),bar=document.getElementById('specBar');
  const reduce=matchMedia('(prefers-reduced-motion: reduce)').matches;
  let current='';
  const cls=c=>CH.s.includes(c)?'c-sym':(CH.n.includes(c)?'c-num':'');
  const paint=(s,locked)=>{el.innerHTML=s.split('').map((c,i)=>{const k=i<locked?cls(c):'scramble';return k?'<span class="'+k+'">'+ND.esc(c)+'</span>':ND.esc(c);}).join('');};
  function make(){let s='';for(let i=0;i<LEN;i++)s+=ALL[ND.randInt(ALL.length)];return s;}
  function next(){
    const target=make();current=target;
    const e=Math.round(LEN*Math.log2(POOL));
    bits.textContent=e+' bits';bar.style.width=Math.min(100,e/1.3)+'%';
    if(reduce){paint(target,LEN);return;}
    let f=0;const total=26;
    (function step(){
      const locked=Math.floor((f/total)*LEN);
      let s=target.slice(0,locked);for(let i=locked;i<LEN;i++)s+=ALL[ND.randInt(ALL.length)];
      paint(s,locked);
      if(++f<=total)requestAnimationFrame(()=>setTimeout(step,28));else paint(target,LEN);
    })();
  }
  next();setInterval(()=>{if(!document.hidden)next();},4200);
  document.getElementById('specCopy').addEventListener('click',e=>ND.copy(current,e.currentTarget,'Password copied'));

  const ts=document.getElementById('tileSpeed'),sh=ND.store.get('speed-history',[]);
  if(ts&&sh.length){const x=sh[0],f=v=>v>=100?Math.round(v):v.toFixed(1);ts.innerHTML='↓ <b>'+f(x.d)+'</b> Mbps · ↑ <b>'+f(x.u)+'</b> Mbps · <b>'+Math.round(x.p)+'</b> ms';}
  const tp=document.getElementById('tilePw');
  if(tp){setInterval(()=>{if(document.hidden)return;let s='';for(let i=0;i<18;i++){const c=ALL[ND.randInt(ALL.length)];s+=(CH.s.includes(c)||CH.n.includes(c))?'<b>'+ND.esc(c)+'</b>':ND.esc(c);}tp.innerHTML=s;},1600);}

})();
</script>"""


HOME_SCRIPT_TILES = r"""<script>
(function(){
  const ALL='ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%^&*-_=+?',SN='23456789!@#$%^&*-_=+?';
  const ts=document.getElementById('tileSpeed'),sh=ND.store.get('speed-history',[]);
  if(ts&&sh.length){const x=sh[0],f=v=>v>=100?Math.round(v):v.toFixed(1);ts.innerHTML='↓ <b>'+f(x.d)+'</b> Mbps · ↑ <b>'+f(x.u)+'</b> Mbps · <b>'+Math.round(x.p)+'</b> ms';}
  const tp=document.getElementById('tilePw');
  if(tp){setInterval(()=>{if(document.hidden)return;let s='';for(let i=0;i<18;i++){const c=ALL[ND.randInt(ALL.length)];s+=SN.includes(c)?'<b>'+ND.esc(c)+'</b>':ND.esc(c);}tp.innerHTML=s;},1600);}
})();
</script>"""


EXTRA_PAGES = [
    # slug, title, description, active nav, noindex
    ("about", "About & trust", "How Nicely Done keeps your data on your device — and how to verify it yourself in ten seconds.", "about", False),
    ("account", "Sign in", "Sign in or create a free Nicely Done account.", None, True),
    ("reset-password", "Reset password", "Choose a new password for your Nicely Done account.", None, True),
    ("profile", "Your profile", "Manage your Nicely Done account.", None, True),
    ("admin", "Admin", "Nicely Done administration.", None, True),
    ("s", "A secret for you", "Someone shared a one-time secret with you.", None, True),
    ("widgets", "iPhone widgets", "Hijri date, password and status widgets for your iPhone Home Screen and Lock Screen — private, open source, run on your phone.", None, False),
]


def build_page(slug, title, desc, active, noindex):
    s = split_sections(render_icons((SRC / "pages" / f"{slug}.html").read_text()))
    return (head(f"{title} — {SITE}", desc, f"/{slug}/", "", None, noindex) + header(active)
            + '<main id="main">' + s["body"].replace("{GITHUB}", GITHUB) + "</main>\n" + footer()
            + scripts(s.get("script", "")))


def build_404():
    links = "".join(
        f'<a href="/{t["slug"]}/"><div class="tile-icon">{ICONS[t["icon"]]}</div><div><strong>{t["name"]}</strong><span>{t["short"]}</span></div></a>'
        for t in TOOLS[:3])
    return head(f"Page not found — {SITE}", "This page doesn’t exist.", "/404.html") + header() + f"""<main id="main">
  <section class="nf"><div class="wrap">
    <p class="eyebrow" style="justify-content:center"><span class="dot"></span>Error 404</p>
    <div class="code" aria-hidden="true">4<em>0</em>4</div>
    <h1 class="h2" style="margin-top:12px">Not quite <em>done</em> — this page doesn’t exist.</h1>
    <div class="path" id="nfPath">/</div>
    <div class="row" style="justify-content:center;margin-top:28px">
      <a class="btn btn-primary" href="/">Back home</a>
      <button class="btn" data-search>{ICONS['search']} Search tools</button>
    </div>
    <div class="related" style="margin-top:48px;text-align:left">{links}</div>
  </div></section>
</main>
""" + footer() + scripts("<script>document.getElementById('nfPath').textContent=location.pathname;</script>")


# ---------------------------------------------------------------------------
# Static extras
# ---------------------------------------------------------------------------
FAVICON = """<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">
<rect x="1" y="1" width="30" height="30" rx="9" fill="#0f1210"/>
<rect x="1.5" y="1.5" width="29" height="29" rx="8.5" fill="none" stroke="#7ee2b0" stroke-opacity=".25"/>
<path d="M8.5 16.8l4.6 4.6L23.5 10.6" fill="none" stroke="#7ee2b0" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"/>
</svg>
"""

SW = """/* Nicely Done — offline cache */
const CACHE = 'nd-{V}';
const PRECACHE = {PRECACHE};
self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(PRECACHE)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  const sameOrigin = url.origin === location.origin;
  if (!sameOrigin) return;
  if (sameOrigin && url.pathname.startsWith('/api/')) return;
  if (req.mode === 'navigate') {
    e.respondWith(fetch(req).then((res) => {
      const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); return res;
    }).catch(() => caches.match(req).then((r) => r || caches.match(url.pathname.startsWith('/ar/') ? '/ar/404.html' : '/404.html'))));
    return;
  }
  e.respondWith(caches.match(req).then((hit) => hit || fetch(req).then((res) => {
    if (res.ok || res.type === 'opaque') { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); }
    return res;
  })));
});
"""


STATIC_PREFIXES = ("assets/", "api/", "favicon", "manifest", "og.png", "apple-touch", "icon-", "sw.js", "ar/", "s/#")


def page_path(rel):
    return "/" if rel == "index.html" else "/" + rel[: -len("index.html")] if rel.endswith("/index.html") else "/" + rel


def finish(html_src, rel, lang):
    """Fill language-specific placeholders; for non-English, localise the page."""
    path = page_path(rel)
    en, ar = ORIGIN + path, ORIGIN + "/ar" + path
    alts = (f'<link rel="alternate" hreflang="en" href="{en}">\n<link rel="alternate" hreflang="ar" href="{ar}">\n'
            f'<link rel="alternate" hreflang="x-default" href="{en}">')
    out = html_src.replace("<!--HREFLANG-->", alts if rel != "404.html" else "")
    if lang == "en":
        return (out.replace("{ALT_HREF}", "/ar" + path).replace("{ALT_LANG}", "ar")
                   .replace("{ALT_LABEL}", "العربية").replace("{ALT_TEXT}", "ع"))
    out = TR.page(out, rel)
    out = out.replace('<script src="/assets/site.js', '<script>window.ND_I18N=' + RUNTIME_AR + ';</script>\n<script src="/assets/site.js', 1)
    out = out.replace('<html lang="en" class="no-js">', '<html lang="ar" dir="rtl" class="no-js">', 1)
    is_file = lambda p: re.search(r"\.(?!html\b)[A-Za-z0-9]{1,12}(?:$|[?#])", p.split("/")[-1] or "") is not None
    out = re.sub(r'(href|data-href)="/(?!/)([^"]*)"', lambda m: m.group(0) if m.group(2).startswith(STATIC_PREFIXES) or is_file(m.group(2)) else f'{m.group(1)}="/ar/{m.group(2)}"', out)
    out = out.replace('"href":"/', '"href":"/ar/').replace('"href": "/', '"href": "/ar/')
    out = out.replace(f'<link rel="canonical" href="{en}">', f'<link rel="canonical" href="{ar}">')
    out = out.replace(f'<meta property="og:url" content="{en}">', f'<meta property="og:url" content="{ar}">')
    out = out.replace('<meta property="og:type" content="website">', '<meta property="og:type" content="website">\n<meta property="og:locale" content="ar_SA">')
    return (out.replace("{ALT_HREF}", path).replace("{ALT_LANG}", "en")
               .replace("{ALT_LABEL}", "English").replace("{ALT_TEXT}", "EN"))


TR = None
RUNTIME_AR = "{}"


WIDGETS = [  # source, installed script name, Scriptable icon glyph
    ("hijri-date.js", "Hijri Date", "calendar-alt"),
    ("password.js", "Nicely Done Password", "key"),
    ("site-status.js", "Site Status", "heartbeat"),
]


def build_widgets():
    out = DIST / "widgets"
    out.mkdir(parents=True, exist_ok=True)
    for src, name, glyph in WIDGETS:
        code = (SRC / "widgets" / src).read_text()
        (out / src).write_text(code)
        (out / f"{name}.scriptable").write_text(json.dumps({
            "always_run_in_app": False, "icon": {"color": "deep-green", "glyph": glyph},
            "name": name, "script": code, "share_sheet_inputs": [],
        }, indent=2, ensure_ascii=False))


def main():
    global TR, RUNTIME_AR
    TR = Translator(SRC / "i18n" / "ar.json")
    RUNTIME_AR = json.dumps(json.loads((SRC / "i18n" / "ar.runtime.json").read_text()), ensure_ascii=False, separators=(",", ":")).replace("</", "<\\/")
    if DIST.exists():
        shutil.rmtree(DIST)
    (DIST / "assets").mkdir(parents=True)

    shutil.copytree(SRC / "assets", DIST / "assets", dirs_exist_ok=True)
    version = hashlib.sha1(b"".join(p.read_bytes() for p in sorted((SRC).rglob("*")) if p.is_file())
                           + Path(__file__).read_bytes()).hexdigest()[:10]

    pages = {"index.html": build_home(), "404.html": build_404()}
    for t in TOOLS:
        pages[f"{t['slug']}/index.html"] = build_tool(t)
    for slug, *rest in EXTRA_PAGES:
        pages[f"{slug}/index.html"] = build_page(slug, *rest)
    for c in CATS:
        pages[f"{CAT_META[c]['slug']}/index.html"] = build_category(c)
    for rel, content in pages.items():
        for lang in ("en", "ar"):
            out = DIST / rel if lang == "en" else DIST / "ar" / rel
            out.parent.mkdir(parents=True, exist_ok=True)
            out.write_text(finish(content, rel, lang).replace("{V}", version))
    missing = TR.missing
    (ROOT / "i18n-missing.txt").write_text("".join(f"{k}\t{v}\n" for k, v in sorted(missing.items())))
    (ROOT / "i18n-missing-js.txt").write_text("".join(f"{k}\t{v}\n" for k, v in sorted(TR.js_candidates.items())))
    print(f"i18n: {len(TR.used)} strings used, {len(missing)} missing → i18n-missing.txt, {len(TR.js_candidates)} JS candidates")

    build_widgets()
    (DIST / "favicon.svg").write_text(FAVICON)
    (DIST / "CNAME").write_text(DOMAIN + "\n")
    (DIST / ".nojekyll").write_text("")
    (DIST / "robots.txt").write_text(f"User-agent: *\nAllow: /\nDisallow: /s/\nDisallow: /ar/s/\nDisallow: /api/\n\nSitemap: {ORIGIN}/sitemap.xml\n")
    today = datetime.date.today().isoformat()
    urls = ["/"] + [f"/{CAT_META[c]['slug']}/" for c in CATS] + [f"/{t['slug']}/" for t in TOOLS] + ["/about/", "/widgets/"]
    (DIST / "sitemap.xml").write_text(
        '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n'
        + "".join(
            f"  <url><loc>{ORIGIN}{pre}{u}</loc><lastmod>{today}</lastmod><priority>{'1.0' if u == '/' else '0.8'}</priority>"
            f'<xhtml:link rel="alternate" hreflang="en" href="{ORIGIN}{u}"/><xhtml:link rel="alternate" hreflang="ar" href="{ORIGIN}/ar{u}"/></url>\n'
            for u in urls for pre in ("", "/ar"))
        + "</urlset>\n")
    (DIST / "manifest.webmanifest").write_text(json.dumps({
        "name": SITE, "short_name": SITE, "description": "Private, browser-based security & developer tools.",
        "start_url": "/", "scope": "/", "display": "standalone",
        "background_color": "#0b0c0b", "theme_color": "#0b0c0b",
        "icons": [
            {"src": "/favicon.svg", "sizes": "any", "type": "image/svg+xml", "purpose": "any"},
            {"src": "/icon-192.png", "sizes": "192x192", "type": "image/png"},
            {"src": "/icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "any maskable"},
        ],
        "shortcuts": [{"name": t["name"], "url": f"/{t['slug']}/"} for t in TOOLS[:4]],
    }, indent=2))
    precache = ["/", "/404.html", f"/assets/site.css?v={version}", f"/assets/site.js?v={version}", f"/assets/fonts.css?v={version}",
                "/assets/fonts/geist-normal-300-700-latin.woff2", "/assets/fonts/instrument-serif-normal-400-latin.woff2", "/favicon.svg"] + \
               [f"/{t['slug']}/" for t in TOOLS] + ["/about/", "/ar/", "/ar/404.html"]
    (DIST / "sw.js").write_text(SW.replace("{V}", version).replace("{PRECACHE}", json.dumps(precache)))
    # Keep IIS / Azure App Service compatibility from the original deployment.
    (DIST / "web.config").write_text(WEB_CONFIG)

    for img in (SRC / "static").glob("*") if (SRC / "static").exists() else []:
        shutil.copy(img, DIST / img.name)
    print(f"built {len(pages)} pages → {DIST} (v{version})")


WEB_CONFIG = """<?xml version="1.0" encoding="UTF-8"?>
<configuration>
  <system.webServer>
    <httpErrors errorMode="Custom" existingResponse="Replace">
      <remove statusCode="404" subStatusCode="-1"/>
      <error statusCode="404" path="/404.html" responseMode="ExecuteURL"/>
    </httpErrors>
    <defaultDocument><files><clear/><add value="index.html"/></files></defaultDocument>
    <staticContent>
      <remove fileExtension=".webmanifest"/>
      <mimeMap fileExtension=".webmanifest" mimeType="application/manifest+json"/>
    </staticContent>
    <rewrite>
      <rules>
        <rule name="HTTPS" stopProcessing="true">
          <match url="(.*)"/>
          <conditions><add input="{HTTPS}" pattern="^OFF$"/></conditions>
          <action type="Redirect" url="https://{HTTP_HOST}/{R:1}" redirectType="Permanent"/>
        </rule>
        <rule name="Legacy .html URLs" stopProcessing="true">
          <match url="^([a-z0-9-]+)\\.html$"/>
          <conditions><add input="{R:1}" pattern="^(index|404)$" negate="true"/></conditions>
          <action type="Redirect" url="/{R:1}/" redirectType="Permanent"/>
        </rule>
      </rules>
    </rewrite>
  </system.webServer>
</configuration>
"""

if __name__ == "__main__":
    main()
