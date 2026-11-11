# Nicely Done — design system

The November 2026 redesign. This file records what the system is and why, so
the next change stays inside it. The voice rules are in `VOICE.md`.

## The idea: paper, ink and one green pen

Nicely Done is one person's honest set of tools. It should feel like a tidy
desk, not a product launch: warm paper, dark ink, and a single green pen that
ticks things off. That gives three rules everything else follows from.

1. **Flat and quiet.** No glass, glow, grain or gradients. Depth comes from
   hairlines and two surface tones; shadow is kept for things that really
   float (menus, dialogs, the search box).
2. **One accent, used for meaning.** Deep green marks what you can act on and
   what is selected. Red, amber and blue are only ever status colours.
3. **Lists before cards.** The site is a directory of tools. Lists scan faster
   than grids of boxes, so tools are rows; boxes are for the tool itself.

The previous design (dark, mint glow, serif italics, pill buttons, card grids)
is preserved on `main` up to the release commit — see `RELEASE.md`.

## Tokens — `src/styles/01-tokens.css`

Every colour, radius and size comes from here. Light ("paper") is the default;
dark ("night desk") applies when the system asks for it or the visitor chooses
it (`data-theme` on `<html>`, remembered in `localStorage` as `nd:theme`).

| Token | Light | Dark | Used for |
|---|---|---|---|
| `--bg` | `#f6f4ee` | `#0f1412` | the page |
| `--bg-2` | `#eeebe3` | `#0a0e0c` | wells: code, results, sunken areas |
| `--surface` | `#fffefb` | `#161c19` | panels |
| `--surface-2` | `#f3f0e8` | `#1d2521` | hover on a surface, neutral tags |
| `--line` / `--line-2` | `#e2ded2` / `#cdc8b9` | `#252e29` / `#364139` | hairlines / stronger edges |
| `--field-line` | `#868e84` | `#66756b` | edges of inputs (≥ 3:1) |
| `--text` / `-2` / `-3` | `#17211c` / `#4a554e` / `#5a645d` | `#e9ede7` / `#abb4ad` / `#869088` | text, secondary, hints (all ≥ 4.5:1) |
| `--accent` / `--accent-2` | `#0b6b4b` / `#085239` | `#86d4ad` / `#a5e0c3` | actions, links, selection / hover and small text on tints |
| `--accent-soft`, `--accent-line` | `#e2efe6`, `#a9cdb9` | `#182b22`, `#2f5a45` | tinted fills and their edges |
| `--mark` | `#d9ecb4` | `#2c4a34` | the highlighter behind a key word, text selection |
| `--gold`, `--danger`, `--warn`, `--info` (+ `-soft`) | | | pins; status only |

Shape: `--r-sm 6` (tags), `--r-md 10` (buttons, inputs), `--r-lg 14` (panels),
`--r-xl 18` (large drop areas). `--r-pill` only for things that are round by
nature (switches, file chips, the account chip).

Space is a 4 px grid (`--s-1` … `--s-8`). Layout: `--max 1120px`, `--gutter`,
`--header-h 60px`. Motion: one curve (`--ease`), one duration (`--t`, 160 ms).

## Type

| Role | Face | Notes |
|---|---|---|
| Display, headings | **Bricolage Grotesque** 650–700 | tight (−0.02 to −0.035em); a grotesque with some hand in it |
| Text, UI | **Geist** | unchanged |
| Values, code | **Geist Mono** | passwords, hashes, numbers |
| Arabic (everything) | **IBM Plex Sans Arabic** | one family for headings and text; never letter-spaced |

Scale: `.display` (home and info heroes) → `.h1` (page title) → `.h2`
(sections) → `.h4` (side notes). Inside headings `<em>` marks the key word in
the accent colour — never italic. `.marked` adds the highlighter and is used
once, on the home page. Small labels (`.panel-title`) are sentence case, 600
weight; there is no uppercase mono "eyebrow" style any more.

All fonts are self-hosted (`src/assets/fonts`, OFL). The script and serif faces
that remain are content fonts for PDF Studio (signatures, text on pages).

## Files — `src/styles/`

`build.py` concatenates these in order into `dist/assets/site.css`.

| File | Holds |
|---|---|
| `01-tokens.css` | tokens, both themes, Arabic font swap |
| `02-base.css` | reset, type scale, sections, motion, view transitions |
| `03-shell.css` | header, tools menu, footer, search palette, toast |
| `04-components.css` | buttons, panels, badges, forms, chips, segmented control, outputs, tables, states, FAQ, link rows, pin |
| `05-pages.css` | home, directory, tool page shell, info pages, accounts, 404 |
| `06-tools.css` | per-tool pieces (password, hash, calendar, speed test, checkers, QR, resizer, widgets) |
| `07-accounts-vault.css` | breach check, vault, two-factor |
| `studio/pdf-studio.css` | PDF Studio |
| `08-rtl.css` | the few rules logical properties can't express |

Rules for adding styles: use tokens, never raw colours (the only exceptions
are things that must look like paper or iOS regardless of theme — PDF pages,
signature pads, the widget mock-ups); use logical properties
(`margin-inline-start`, `inset-inline-end`) so Arabic needs no extra rule; put
a style in the lowest file that fits and reuse a component before inventing one.

## Components

- **Buttons** `.btn` (+ `-primary`, `-ghost`, `-danger`, `-sm`, `-block`),
  `.icon-btn`, `.copy`. One primary action per panel.
- **Fields** `.field` > `.label` + `.input` / `.select` / `.textarea`;
  `.range`; `.chips` > `.chip` (checkbox toggles); `.seg` (one of a few);
  `.filter` (one of many, scrollable).
- **Containers** `.panel` (`-body`, `-sec`), `.aside` (side notes), `.out`,
  `.stat`, `.list-item`, `.kv`, `table.data`.
- **Status** `.badge` (`ok`, `bad`, `warn`, `info`), `.msg`, `.alert`,
  `.verdict`, `.meter`, `.empty-state`, `.spinner`, toast (`ND.toast`,
  `ND.ok`, `ND.done`).
- **Navigation** `.tool-row` (the directory row, used on home, `/tools/`,
  categories), `.related`, `.widget-callout`, `.crumbs`, `.section-link`.
- **Overlays** the search palette (`.cmdk`), tools menu (`.menu`), PDF Studio
  dialogs (`.st-dlg`). All sit on `--scrim`; none blur what is behind them.

## Page patterns

- **Home**: headline, then the two fastest ways in (search, drop a file),
  then your pinned/recent tools, eight everyday tasks, three live widgets, the
  whole directory as three lists, and the promise.
- **Tool page**: breadcrumb, icon + title, one sentence, then the tool — it
  starts in the first screen. Notes sit in a side column; "How it works" and
  the longer explanation follow the tool, never precede it.
- **Directory** `/tools/`: every tool and PDF task on one page with an
  as-you-type filter (`?q=` pre-fills it; the home page's JSON-LD
  `SearchAction` points here).
- **Info pages** (About, Privacy & security, Contact, What's new): a
  `.page-hero` and numbered `.about-sec` rows.

## Accessibility

- Text meets WCAG AA contrast in both themes; input edges meet 3:1.
- Headings descend without gaps (side notes are `h2.h4`, footer groups `h2`).
- Everything is reachable by keyboard; focus is a 2 px accent ring. The search
  palette is `inert` while closed.
- `prefers-reduced-motion` turns off all animation and page transitions.
- Arabic pages are real right-to-left layouts, not mirrored afterthoughts.

## Decisions worth remembering

- **Light is the default theme** (it was dark). Tools people use for documents
  and forms read better on paper; dark still follows the system.
- **The About page was split.** "Check it yourself", "What does go online" and
  the technical notes moved to `/privacy/`, so there is one page to link to
  for privacy and security. `/contact/` lists the two real ways to reach
  Abdulaziz; there is deliberately no email address on the site.
- **No new dependencies and no framework.** The site is still static HTML
  built by `build.py`; the stylesheet was reorganised, not replaced by a
  toolchain. The API, database and service worker contract are untouched.
- **URLs are unchanged.** Three were added (`/tools/`, `/privacy/`,
  `/contact/`, each with `/ar/`); none were removed or renamed.
