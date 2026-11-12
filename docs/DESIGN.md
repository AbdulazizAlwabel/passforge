# Nicely Done — design system ("Aurora")

The November 2026 redesign. This file records what the system is and why, so
the next change stays inside it. The voice rules are in `VOICE.md`.

## The idea

Nicely Done should feel like a premium product you happen to get for free:
light and colour with real depth, and motion that answers what you do.

1. **Depth.** Cards float over a slow aurora — three blurred lights behind the
   top of every page. Surfaces are layered: page → card → well, each with its
   own edge and shadow. The header is a glass bar that floats above it all.
2. **Iris.** One brand gradient (indigo → violet → orchid) marks the thing to
   do: primary buttons, the key word of a headline, selection. Green, amber,
   red and blue are only ever status colours — "good" is green, never purple.
3. **A hue per kind of tool.** Security is violet, developer tools are blue,
   everyday tools are orange, PDF is rose. Icon tiles look like small app
   icons in that hue, and a tool's page takes its aurora from it.
4. **Motion with a reason.** Cards lift and catch a light that follows the
   pointer; things rise into place as they enter; the hero's cards float and
   lean toward the pointer; numbers count up; icons spring. All of it stops
   under `prefers-reduced-motion`.

## Tokens — `src/styles/01-tokens.css`

Every colour, radius, shadow and size comes from here. Light is the default;
dark applies when the system asks for it or the visitor chooses it
(`data-theme` on `<html>`, remembered in `localStorage` as `nd:theme`).

| Token | Light | Dark | Used for |
|---|---|---|---|
| `--bg` | `#f6f6fb` | `#08080f` | the page |
| `--bg-2` | `#ededf6` | `#05050a` | wells: code, results, sunken areas |
| `--surface` | `#ffffff` | `#11111c` | cards |
| `--surface-2` | `#f1f1f9` | `#191927` | hover on a card, neutral tags |
| `--glass` | white 72% | `#11111c` 70% | the header and other blurred bars |
| `--line` / `--line-2` | `#e4e4ef` / `#d0d0e0` | `#20202f` / `#2f2f47` | hairlines / stronger edges |
| `--field-line` | `#84859f` | `#6a6b88` | edges of inputs (≥ 3:1) |
| `--text` / `-2` / `-3` | `#0c0c1a` / `#4a4b66` / `#5f6079` | `#f3f3fa` / `#b0b1c8` / `#8a8ba6` | text, secondary, hints (all ≥ 4.5:1) |
| `--accent` / `--accent-2` | `#5142dd` / `#3f31bf` | `#a9a2ff` / `#c4bfff` | links, selection, focus / hover |
| `--accent-soft`, `--accent-line` | `#eceafd`, `#c5bff8` | `#1b1938`, `#3f38a3` | tinted fills and their edges |
| `--grad` | `#5b4bea → #8250ee → #b24fe0` | same | primary buttons, marks (white text ≥ 4.5:1) |
| `--grad-text` | `#5142dd → #9a4ff0 → #e0458f` | lighter | the key word in a headline |
| `--c-security`, `--c-developer`, `--c-everyday`, `--c-pdf`, `--c-brand` | | | icon tiles; each has a `-glow` |
| `--a1`, `--a2`, `--a3`, `--aurora-o` | | | the aurora's three lights |
| `--ok`, `--danger`, `--warn`, `--info`, `--gold` (+ `-soft`) | | | status only |

Shape: `--r-sm 8`, `--r-md 12` (buttons, inputs), `--r-lg 18`, `--r-xl 24`
(cards), `--r-2xl 32`, `--r-pill`. Shadows: `--shadow-sm`, `--shadow`,
`--shadow-lg`, plus `--card-edge` (the lit top edge of a card).
Motion: `--ease` for movement, `--spring` for things that pop, `--t` 180 ms.
Layout: `--max 1160px`, `--gutter`, `--header-h 72px`.

## Type

| Role | Face | Notes |
|---|---|---|
| Display, headings | **Geist** 650 | large and tight (−0.035 to −0.045em) |
| Text, UI | **Geist** | |
| Values, code | **Geist Mono** | passwords, hashes, numbers |
| Arabic (everything) | **IBM Plex Sans Arabic** | headings at 700; never letter-spaced |

Scale: `.display` → `.h1` → `.h2` → `.h4`. Inside headings `<em>` paints the
key word with `--grad-text`. All fonts are self-hosted (`src/assets/fonts`,
OFL). The script and serif faces that remain are content fonts for PDF Studio.

## Files — `src/styles/`

`build.py` joins the numbered files into `dist/assets/site.css`; PDF Studio's
own styles (`studio/pdf-studio.css`) are a second file loaded only by its pages.

| File | Holds |
|---|---|
| `01-tokens.css` | tokens, both themes, per-category hues, Arabic font swap |
| `02-base.css` | reset, aurora, type scale, sections, **the card**, motion, view transitions |
| `03-shell.css` | floating header, tools menu, footer, search palette, toast |
| `04-components.css` | buttons, icon tiles, panels, badges, forms, chips, segmented control, outputs, tables, states, FAQ, link rows and cards, pin |
| `05-pages.css` | home (hero stage, bento, directory cards, promise), `/tools/`, tool page shell, info pages, accounts, 404 |
| `06-tools.css` | per-tool pieces |
| `07-accounts-vault.css` | breach check, vault, two-factor |
| `08-rtl.css` | the few rules logical properties can't express |
| `studio/pdf-studio.css` | PDF Studio |

Rules for adding styles: use tokens, never raw colours (exceptions: things
that must look like paper or iOS whatever the theme — PDF pages, signature
pads, widget mock-ups — and white on a gradient); use logical properties so
Arabic needs no extra rule; reuse a component before inventing one.

## Components

- **Card** — `.card` is the surface (radius, edge, shadow). `.card-link` makes
  it interactive: it lifts, a light follows the pointer (`--mx`/`--my`, set by
  `site.js`), and an iris edge fades in. Used by the bento tiles, directory
  cards, related tools and callouts.
- **Icon tile** — `.tile-icon` with `data-c="security|developer|everyday|pdf"`
  (default: brand). `build.py`'s `tile(t)` writes it; `ckey(t)` picks the hue.
- **Buttons** — `.btn`, `.btn-primary` (gradient, glow, a sheen on hover),
  `-ghost`, `-danger`, `-sm`, `-block`; `.icon-btn`; `.copy`.
- **Fields** — `.field` > `.label` + `.input` / `.select` / `.textarea`;
  `.range`; `.chips` > `.chip`; `.seg`; `.filter`.
- **Containers** — `.panel` (`-body`, `-sec`), `.aside`, `.out`, `.stat`,
  `.list-item`, `.kv`, `table.data`.
- **Status** — `.badge` (`ok`, `bad`, `warn`, `info`), `.msg`, `.alert`,
  `.verdict`, `.meter`, `.empty-state`, `.spinner`, toast (`ND.toast`, `ND.ok`,
  `ND.done`).
- **Navigation** — `.tool-row` (rows inside a card), `.dir-card`, `.related`,
  `.widget-callout`, `.crumbs`, `.section-link`.
- **Overlays** — search palette (`.cmdk`), tools menu (`.menu`), PDF Studio
  dialogs (`.st-dlg`), all on `--scrim`.

## Page patterns

- **Home**: headline and the two fastest ways in (search, drop a file) on one
  side; on the other, three live cards floating on a stage — today's date, a
  password being made, a strength test. Then your pinned tools, a bento of the
  eight things people come to do, the whole directory in three category cards,
  and the promise beside the maker's note.
- **Tool page** (`<body data-cat>`): breadcrumb, a large icon tile + title,
  one sentence, then the tool — in the first screen. Notes sit in a side
  column. "How it works" is three cards; the longer explanation and FAQ follow.
- **Directory** `/tools/`: every tool and PDF task as cards, grouped, with an
  as-you-type filter (`?q=` pre-fills it; the home page's `SearchAction`
  points here). Category pages use the same cards.
- **Info pages**: a `.page-hero` and numbered `.about-sec` cards.

## Motion inventory

| What | Where | Off with reduced motion |
|---|---|---|
| Aurora drift | every page top | yes |
| Hero cards float, lean to the pointer | home | yes |
| Rise on entry (`.reveal`, staggered with `--d`) | cards, steps, headings | yes (shown at once) |
| Lift + pointer light + iris edge | `.card-link` | lift and light off |
| Icon tiles spring, arrows slide | hover | yes |
| Sheen across primary buttons | hover | yes |
| Count-up numbers (`data-count`) | hero stats, speed test | yes |
| Card grows into the tool heading | cross-page view transition | yes |
| Toast check draws, pin star pops | feedback | yes |

## Accessibility

- Text meets WCAG AA contrast in both themes; input edges meet 3:1.
- Headings descend without gaps (side notes are `h2.h4`, footer groups `h2`).
- Everything is reachable by keyboard; focus is a 2 px accent ring. The search
  palette is `inert` while closed.
- Icons in coloured tiles are decorative and always sit next to a text label.
- Arabic pages are real right-to-left layouts.

## Decisions worth remembering

- **Light is the default theme**; dark follows the system or the toggle.
- **The About page was split.** Privacy and technical notes live at
  `/privacy/`; `/contact/` lists the two real ways to reach Abdulaziz (there is
  deliberately no email address on the site).
- **No new dependencies and no framework.** Still static HTML from `build.py`.
  The API, database and service worker contract are untouched.
- **URLs are unchanged.** Three were added (`/tools/`, `/privacy/`,
  `/contact/`, each with `/ar/`); none were removed or renamed.
