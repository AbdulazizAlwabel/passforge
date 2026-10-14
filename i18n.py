"""Build-time localisation for the static site.

Pages are rendered in English, then `localize()` rewrites them for another
language using a flat dictionary (src/i18n/<lang>.json) of English → target:

* HTML text is translated in *inline runs*: text plus inline tags such as
  <b>, <a>, <code>, <span>, so a whole sentence with markup is one unit.
  If a run isn't in the dictionary, its individual text pieces are tried.
* Attributes: placeholder, aria-label, title, alt and meta content.
* Inline <script> string literals whose content is a dictionary key (object
  keys — a literal followed by ':' — are left alone). Literals containing
  HTML are translated like page HTML.

Anything with Latin words that wasn't translated is reported, so coverage
can be checked on every build.
"""
import json
import re

INLINE = {"b", "strong", "em", "i", "a", "code", "span", "kbd", "small", "br", "sup", "sub", "u"}
TOKEN_RE = re.compile(r"<!--.*?-->|<[^>]+>|[^<]+|<", re.S)
FULL_TAG_RE = re.compile(r"<[a-zA-Z/][^<>]*>")
TAGNAME_RE = re.compile(r"^</?\s*([a-zA-Z0-9]+)")
ATTR_RE = re.compile(r'(\s(?:placeholder|aria-label|title|alt|content|data-label)=")([^"]*)(")')
SCRIPT_RE = re.compile(r"(<script\b[^>]*>)(.*?)(</script>)", re.S | re.I)
STYLE_RE = re.compile(r"(<style\b[^>]*>.*?</style>)", re.S | re.I)
JS_STR_RE = re.compile(r"""'(?:[^'\\\n]|\\.)*'|"(?:[^"\\\n]|\\.)*"|`(?:[^`\\$]|\\.)*`""")
LATIN_WORD = re.compile(r"[A-Za-z]{2,}")
WS = re.compile(r"\s+")

# Tokens that legitimately stay Latin (brand names, units, code identifiers…).
KEEP = re.compile(r"^(?:Ctrl|K|R|C|F12|esc|nicely|done|nicelydone\.qd\.je|Nicely Done|MD5|SHA-\d+|SHA-\d+/\d+/\d+|"
                  r"Base64|JSON|IPv4|IPv6|CIDR|UTF-8|AES-256-GCM|PBKDF2|ZeroSSL|EFF|JWT|API|URL|HTTP|HTTPS|"
                  r"\{ALT_\w+\}|nicelydone\.qd\.je/s/#|Mbps|Mbps ·|Mbps · ↑|[A-Za-z0-9_.\-/:@#%+]{1,3}|k7#Qm|vX!pL2|wR4z|null|&nbsp;|AH|CE|English|EN|Il1O0|ABC|abc|github\.com/AbdulazizAlwabel/passforge|crypto\.getRandomValues|kB|MB|GB|TB|KiB|MiB|GiB|TiB|°[CFR]|K|OK)$")


class Translator:
    def __init__(self, path):
        with open(path, encoding="utf-8") as f:
            raw = json.load(f)
        self.d = {self.norm(k): v for k, v in raw.items() if not k.startswith("//")}
        self.used = set()
        self.missing = {}
        self.js_candidates = {}
        self.js_skipped_ids = set()

    @staticmethod
    def norm(s):
        return WS.sub(" ", s).strip()

    def lookup(self, s):
        k = self.norm(s)
        if k in self.d:
            self.used.add(k)
            return self.d[k]
        return None

    def miss(self, s, where):
        k = self.norm(s)
        if not k or not LATIN_WORD.search(re.sub(r"<[^>]+>", " ", k)):
            return
        plain = self.norm(re.sub(r"<[^>]+>", " ", k))
        if KEEP.match(plain) or all(KEEP.match(w) for w in plain.split()):
            return
        self.missing.setdefault(k, where)

    # ---- HTML text ----
    def html(self, src, where):
        out, run = [], []

        def flush():
            if not run:
                return
            text = "".join(run)
            run.clear()
            core = text.strip()
            if not core or not LATIN_WORD.search(re.sub(r"<[^>]+>", "", core)):
                out.append(text)
                return
            lead = text[: len(text) - len(text.lstrip())]
            trail = text[len(text.rstrip()):]
            t = self.lookup(core)
            if t is None:
                # try inside a single wrapping inline tag, e.g. <span>…</span>
                w = re.fullmatch(r"(<(span|b|strong|em|a|small)\b[^>]*>)(.*)(</\2>)", core, re.S)
                if w and "<" + w.group(2) not in w.group(3):
                    inner = self.lookup(w.group(3))
                    if inner is not None:
                        t = w.group(1) + inner + w.group(4)
            if t is not None:
                out.append(lead + t + trail)
                return
            # fall back to translating each text piece of the run
            pieces = TOKEN_RE.findall(core)
            res = []
            for p in pieces:
                if p.startswith("<"):
                    res.append(p)
                    continue
                pl, pt = p[: len(p) - len(p.lstrip())], p[len(p.rstrip()):]
                tt = self.lookup(p) if p.strip() else None
                if tt is None and p.strip() and '="' not in p and p != "<":
                    self.miss(p, where)
                res.append(pl + tt + pt if tt is not None else p)
            out.append(lead + "".join(res) + trail)

        for tok in TOKEN_RE.findall(src):
            if tok.startswith("<!--"):
                flush(); out.append(tok); continue
            if tok.startswith("<"):
                m = TAGNAME_RE.match(tok)
                name = m.group(1).lower() if m else ""
                tok = self.attrs(tok, where)
                if name in INLINE:
                    run.append(tok)
                else:
                    flush(); out.append(tok)
            else:
                run.append(tok)
        flush()
        return "".join(out)

    def attrs(self, tag, where):
        def rep(m):
            val = m.group(2)
            if not LATIN_WORD.search(val):
                return m.group(0)
            import html as H
            t = self.lookup(H.unescape(val))
            if t is None:
                v = H.unescape(val)
                technical = "=" in v or v.startswith(("http", "/", "{")) or re.fullmatch(r"[a-z_\- ]+", v) and m.group(1).strip().startswith("content")
                if not technical:
                    self.miss(v, where + " [attr]")
                return m.group(0)
            return m.group(1) + H.escape(t, quote=True) + m.group(3)
        return ATTR_RE.sub(rep, tag)

    # ---- JS string literals ----
    def js(self, code, where):
        def rep(m):
            lit = m.group(0)
            q = lit[0]
            # skip object keys:  'key': value   /  "key": value
            after = code[m.end():m.end() + 3].lstrip()
            before = code[max(0, m.start() - 3):m.start()].rstrip()[-1:]
            if after.startswith(":") and before in ("{", ",") and q != "`":
                return lit  # object key, not a ternary branch
            body = lit[1:-1]
            val = self.unescape_js(body)
            if not LATIN_WORD.search(val):
                return lit
            # A single lowercase token ('words', 'password', 'active') is almost always an
            # identifier — an element id, mode, status or storage key — so never translate it.
            if re.fullmatch(r"[a-z][a-zA-Z0-9_-]*", val):
                self.js_skipped_ids.add(val)
                return lit
            if FULL_TAG_RE.search(val):
                newv = self.html(val, where + " [js-html]")
                return lit if newv == val else q + self.escape_js(newv, q) + q
            t = self.lookup(val)
            if t is not None:
                t = val[: len(val) - len(val.lstrip())] + t + val[len(val.rstrip()):]
            if t is None:
                # Report likely user-facing literals (has a space or starts uppercase), not code identifiers.
                if (" " in val.strip() or val[:1].isupper()) and not re.match(r"^[#.\[]|^(?:[a-z]+-)+[a-z]+$|^\w+\(|^https?:|^/|^[A-Z_]+$", val):
                    self.js_candidates.setdefault(self.norm(val), where)
                return lit
            return q + self.escape_js(t, q) + q
        return JS_STR_RE.sub(rep, code)

    @staticmethod
    def unescape_js(s):
        return re.sub(r"\\(.)", lambda m: {"n": "\n", "t": "\t"}.get(m.group(1), m.group(1)), s)

    @staticmethod
    def escape_js(s, q):
        return s.replace("\\", "\\\\").replace(q, "\\" + q).replace("\n", "\\n")

    # ---- whole page ----
    def page(self, src, where):
        parts = []
        last = 0
        for m in SCRIPT_RE.finditer(src):
            parts.append(("html", src[last:m.start()]))
            parts.append(("script", m.groups()))
            last = m.end()
        parts.append(("html", src[last:]))
        out = []
        for kind, val in parts:
            if kind == "html":
                # keep <style> blocks untouched
                segs = STYLE_RE.split(val)
                out.append("".join(s if STYLE_RE.fullmatch(s or "") else self.html(s, where) for s in segs))
            else:
                open_tag, body, close = val
                if " src=" in open_tag:
                    out.append(open_tag + body + close)
                else:
                    out.append(open_tag + self.js(body, where) + close)
        return "".join(out)


def _selftest():
    t = Translator.__new__(Translator)
    t.d, t.used, t.missing, t.js_candidates = {}, set(), {}, {}
    for sample in ['<p>Hi <b>there</b> & <a href="/x">you</a></p>', "a<b", "x = '<button class=\"c\" data-a=\"' + v + '\">';"]:
        assert t.html(sample, "t") == sample, sample
        assert t.js(sample, "t") == sample, sample
    t.d = {"Hi": "مرحبا"}
    assert t.html("<p> Hi </p>", "t") == "<p> مرحبا </p>"


_selftest()
