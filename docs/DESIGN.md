---
name: Nicely Done
description: Free, private web tools. Your device is a sealed block of glass - light gets in, your files never get out.
colors:
  # the stage and the three spectral lines: the same in both themes
  ink: "#06070c"
  ink-2: "#0f1220"
  rose: "#ff4d6d"
  mint: "#3ee6c1"
  blue: "#5b8cff"
  # paper: the working surface (light theme, the default)
  paper: "#f4f5f9"
  paper-well: "#eaecf3"
  surface: "#ffffff"
  surface-2: "#eff0f6"
  line: "#dfe2ec"
  line-2: "#c8ccdb"
  field-line: "#7b8098"
  text: "#06070c"
  text-2: "#3f4560"
  text-3: "#596080"
  dim: "#7b8098"
  accent: "#2952d9"
  accent-2: "#1e3fae"
  accent-soft: "#e7ecff"
  accent-line: "#b4c4fa"
  mark: "#cfdcff"
  ok: "#067a5f"
  ok-soft: "#dcf7ef"
  danger: "#c2183c"
  danger-soft: "#ffe3e8"
  warn: "#8a5300"
  warn-soft: "#fbecc8"
  info: "#1c58c4"
  info-soft: "#e3ecfb"
  gold: "#855600"
  gold-soft: "#f8ecc9"
  # on ink: the stage in both themes, and every surface in the dark theme
  ink-well: "#030408"
  ink-panel-2: "#171b2e"
  ink-line: "#1d2133"
  ink-line-2: "#2a2f45"
  ink-field-line: "#636a8b"
  ink-text: "#f5f7ff"
  ink-text-2: "#aab0c8"
  ink-text-3: "#8a90ad"
  ink-dim: "#6d7390"
  ink-accent: "#86a8ff"
  ink-accent-2: "#a9c0ff"
  ink-accent-soft: "#131b36"
  ink-accent-line: "#2c3f7a"
  ink-mark: "#243565"
  ink-ok-soft: "#0a2a25"
  ink-danger: "#ff6682"
  ink-danger-soft: "#33121b"
  ink-warn: "#f0b55e"
  ink-warn-soft: "#33240a"
  ink-info: "#8fb6ff"
  ink-info-soft: "#141f3d"
  ink-gold: "#e9c06f"
  ink-gold-soft: "#33290f"
typography:
  display:
    fontFamily: "'Funnel Display', 'Funnel Sans', system-ui, -apple-system, 'Segoe UI', sans-serif"
    fontSize: "clamp(2.7rem, 5.84vw, 5.25rem)"
    fontWeight: 600
    lineHeight: 0.96
    letterSpacing: "-0.04em"
  headline:
    fontFamily: "'Funnel Display', 'Funnel Sans', system-ui, -apple-system, 'Segoe UI', sans-serif"
    fontSize: "clamp(2.1rem, 4vw, 3.25rem)"
    fontWeight: 600
    lineHeight: 1.02
    letterSpacing: "-0.035em"
  title:
    fontFamily: "'Funnel Display', 'Funnel Sans', system-ui, -apple-system, 'Segoe UI', sans-serif"
    fontSize: "clamp(1.7rem, 3vw, 2.5rem)"
    fontWeight: 600
    lineHeight: 1.06
    letterSpacing: "-0.03em"
  subtitle:
    fontFamily: "'Funnel Display', 'Funnel Sans', system-ui, -apple-system, 'Segoe UI', sans-serif"
    fontSize: "1.3rem"
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "-0.02em"
  lede:
    fontFamily: "'Funnel Sans', system-ui, -apple-system, 'Segoe UI', sans-serif"
    fontSize: "clamp(1.05rem, 1.46vw, 1.3rem)"
    fontWeight: 400
    lineHeight: 1.45
  body:
    fontFamily: "'Funnel Sans', system-ui, -apple-system, 'Segoe UI', sans-serif"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: 1.55
  label:
    fontFamily: "'Funnel Sans', system-ui, -apple-system, 'Segoe UI', sans-serif"
    fontSize: "0.82rem"
    fontWeight: 600
    lineHeight: 1.55
    letterSpacing: "0em"
  mono:
    fontFamily: "'Geist Mono', ui-monospace, 'SFMono-Regular', Menlo, monospace"
    fontSize: "0.9rem"
    fontWeight: 400
    lineHeight: 1.6
  display-ar:
    fontFamily: "'Readex Pro', system-ui, 'Segoe UI', Tahoma, sans-serif"
    fontSize: "clamp(2.3rem, 4.9vw, 4.4rem)"
    fontWeight: 600
    lineHeight: 1.22
    letterSpacing: "0em"
  body-ar:
    fontFamily: "'Readex Pro', system-ui, 'Segoe UI', Tahoma, sans-serif"
    fontSize: "16.5px"
    fontWeight: 400
    lineHeight: 1.75
    letterSpacing: "0em"
rounded:
  sm: "8px"
  md: "12px"
  lg: "14px"
  xl: "18px"
  2xl: "24px"
  pill: "999px"
spacing:
  s-1: "4px"
  s-2: "8px"
  s-3: "12px"
  s-4: "16px"
  s-5: "24px"
  s-6: "32px"
  s-7: "48px"
  s-8: "72px"
  gutter: "clamp(20px, 4.45vw, 64px)"
  section: "clamp(56px, 8vw, 112px)"
components:
  button:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text}"
    rounded: "{rounded.md}"
    height: "44px"
    padding: "0 18px"
  button-hover:
    backgroundColor: "{colors.surface-2}"
  button-primary:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.ink-text}"
    rounded: "{rounded.md}"
    height: "44px"
    padding: "0 18px"
  button-primary-on-ink:
    backgroundColor: "{colors.ink-text}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    height: "44px"
    padding: "0 18px"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.text-2}"
    rounded: "{rounded.md}"
    height: "44px"
    padding: "0 18px"
  button-small:
    rounded: "10px"
    height: "36px"
    padding: "0 13px"
  icon-button:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text-2}"
    rounded: "{rounded.md}"
    size: "40px"
  input:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text}"
    rounded: "{rounded.md}"
    padding: "11px 13px"
  chip:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text-2}"
    rounded: "{rounded.md}"
    height: "44px"
    padding: "0 14px"
  filter-selected:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.ink-text}"
    rounded: "{rounded.pill}"
    height: "38px"
    padding: "0 14px"
  panel:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text}"
    rounded: "{rounded.xl}"
    padding: "clamp(18px, 2.6vw, 30px)"
  tile-icon:
    backgroundColor: "{colors.surface-2}"
    textColor: "{colors.text}"
    rounded: "11px"
    size: "42px"
  badge:
    backgroundColor: "{colors.surface-2}"
    textColor: "{colors.text-2}"
    rounded: "{rounded.pill}"
    padding: "2px 9px"
  output-well:
    backgroundColor: "{colors.paper-well}"
    textColor: "{colors.text}"
    typography: "{typography.mono}"
    rounded: "{rounded.md}"
    padding: "14px 16px"
  hero-search:
    backgroundColor: "{colors.ink-2}"
    textColor: "{colors.ink-text-3}"
    rounded: "{rounded.lg}"
    height: "58px"
    padding: "0 12px 0 18px"
  hero-drop:
    backgroundColor: "{colors.ink-text}"
    textColor: "{colors.ink}"
    rounded: "{rounded.lg}"
    height: "58px"
    padding: "0 22px"
---

# Design System: Nicely Done

This file records the "Prism" system as it was built (November 2026), read back from the shipped
styles in `src/styles/`, the glass in `src/assets/prism.js` and the pages in `dist/`. The token
values above are the ones in `src/styles/01-tokens.css`; that file stays the source. The voice
rules are in `VOICE.md`.

## Overview

**Creative North Star: "The Sealed Glass"**

Your device is a sealed block of glass: light gets in, your files never get out. The home page
shows that with one real object, a slab of optical glass with a page sealed inside it, drawn live
by a hand-written shader, and then hands over the working tool. Everything else on the site is
quiet on purpose, so the glass is the only thing that shines.

The site is built from two materials. The first is ink: a near-black stage that carries the
header, the top of every page, the footer and the maker's promise, in the light theme and the dark
theme alike. The second is paper: the bright surface the tools sit on, made of white panels with
one hairline edge each. In the dark theme the paper becomes ink panels; the stage does not change.
Colour is rationed. Rose, mint and blue are the three lines a prism splits light into, and they
appear where light passes through the glass, in the brand mark, and to mark a state. They are
never a background wash and never a glow.

The interface is dense and exact: tight grotesque headlines, mono for anything that is a value,
44px controls, hairlines instead of boxes inside boxes. It moves once, when the home page arrives,
and after that only when you move something yourself.

**Key Characteristics:**
- One ink stage in both themes; paper (light) or ink panels (dark) for the working areas.
- One live 3D object, the glass on the home page. No other page has a scene.
- Three spectral colours, kept for the glass, the brand mark and state.
- Hairline panels, flat at rest. Shadows only under things that float over the page.
- Large tight headlines whose second half is dimmer, never coloured.
- Mono for values: passwords, counts, bits, dates, file sizes, keyboard keys.
- A real, measured "bytes sent from this page" counter as the proof of the promise.
- English and Arabic are both first-class; the Arabic hero is mirrored, not translated in place.

## Colors

Near-black ink and cool blue-grey paper, with three spectral lines that only the glass and state
may use.

### Primary
- **Ink** (`ink`): the stage. The header, the home hero, every tool and info page top, the promise
  band and the footer are painted with it in both themes. It is also the primary button on paper
  and the browser's theme colour.
- **Paper White on Ink** (`ink-text`): text on the stage, and the primary button when it sits on
  ink. The pair `ink` / `ink-text` is the one high-contrast gesture of the system.

### Secondary
- **Prism Rose** (`rose`): the left fringe of the glass, the bar across the sealed page, the left
  edge of the brand mark, and symbol characters in the live password.
- **Prism Mint** (`mint`): the right fringe of the glass, the right edge of the brand mark, the
  live dot, the strength line under the live password, the zero in "bytes sent from this page: 0",
  digits in the live password, and the Drop a file button while a file is held over the page.
- **Prism Blue** (`blue`): the light arriving at the glass and the slit of light in its
  reflections. It lives in the shader and in the small page drawings on the Fix a PDF card; no
  interface style uses it.

### Tertiary
- **Link Blue** (`accent`, `accent-2` on hover; `ink-accent` on ink): links, focus rings, the text
  caret and selection. It marks what can be acted on and is never a fill for large areas.
- **Status colours** (`ok`, `danger`, `warn`, `info`, `gold`, each with a `-soft` tint; brighter
  `ink-` versions on ink, where OK is `mint`): results, messages, strength meters, a pinned tool.
  Always paired with words or an icon.

### Neutral
- **Paper** (`paper`): the page behind the working areas in the light theme.
- **Paper Well** (`paper-well`): sunken areas that hold a result: output boxes, stats, segmented
  controls, list rows.
- **Surface** (`surface`) and **Surface Hover** (`surface-2`): panels, and what a panel or row
  turns into under the pointer; also neutral tags and icon tiles.
- **Hairline** (`line`) and **Strong Hairline** (`line-2`): panel edges and dividers; control
  edges.
- **Field Edge** (`field-line`): the edge of anything you type into or tick, at 3:1 against its
  background.
- **Text** (`text`), **Text 2** (`text-2`), **Text 3** (`text-3`): body, supporting text, and
  hints or meta.
- **Dim** (`dim`, `ink-dim` on ink): the quieter half of a headline. Large type only.
- **On ink** (`ink-well`, `ink-2`, `ink-panel-2`, `ink-line`, `ink-line-2`, `ink-field-line`,
  `ink-text-2`, `ink-text-3`): the same roles on the stage and in the dark theme. `ink-2` is the
  panel colour there.

### Named Rules
**The Stage Rule.** The header, the top of every page, the promise band and the footer are ink in
both themes. The styles do this by re-scoping the tokens on those regions, so a component placed
on the stage picks up its on-ink colours without a second set of rules. A new region joins the
stage by taking the `ink` class, not by hard-coding dark colours.

**The Spectrum Rule.** Rose, mint and blue belong to the glass, the brand mark and state. They are
never a gradient wash, a glow, a card tint or a category colour. The one place they describe data
instead of state is the live password, where they tell symbols and digits apart.

**The Ink-on-Paper Rule.** The one thing to do is ink on paper and paper on ink (`--btn-bg` /
`--btn-ink`). The primary action is never blue and never coloured.

## Typography

**Display Font:** Funnel Display (with Funnel Sans, system-ui)
**Body Font:** Funnel Sans (with system-ui)
**Label/Mono Font:** Geist Mono (with ui-monospace)
**Arabic:** Readex Pro for headings and text alike

**Character:** A tight, slightly wide grotesque for headlines over a plain, friendly sans for
reading, with mono wherever the text is a value the visitor might copy. All fonts are self-hosted.

### Hierarchy
- **Display** (600, clamp(2.7rem, 5.84vw, 5.25rem), 0.96, -0.04em): the one sentence at the top
  of the home page; a step smaller (to 4.4rem) on info pages.
- **Headline** (600, clamp(2.1rem, 4vw, 3.25rem), 1.02, -0.035em): a tool page's name.
- **Title** (600, clamp(1.7rem, 3vw, 2.5rem), 1.06, -0.03em): section headings.
- **Subtitle** (600, 1.3rem, 1.2, -0.02em): card titles, list group heads, principles.
- **Lede** (400, clamp(1.05rem, 1.46vw, 1.3rem), 1.45, max 58ch): the plain promise under a
  heading, in `text-2`.
- **Body** (400, 16px, 1.55): everything else. Prose is capped at 68ch.
- **Label** (600, 0.82rem, no tracking, sentence case): the small name above a group of things.
  Not uppercase, not tracked.
- **Mono** (400 to 500, 0.72rem to 1.12rem, tabular numerals): passwords, counts, bits, dates,
  step numbers, keyboard keys, the bytes counter.

### Named Rules
**The Dimmer Half Rule.** Emphasis in a heading is the opposite of emphasis: the second half of
the sentence is set in `dim`. It is a flat colour, never a gradient, and it is used only at
headline sizes, where its contrast (above 3:1) is enough.

**The One Voice in Arabic Rule.** Arabic pages set headings and text in Readex Pro, with
letter-spacing forced to zero everywhere so letters join, a 16.5px body at 1.75, and headlines a
step smaller with taller line-height for the marks. Values stay in Geist Mono and left to right;
the brand name stays in Latin, in Funnel Display.

**The Value Rule.** If a visitor could copy it or compare it, it is in mono.

## Layout

The page is a single column up to 1312px wide (`--max`) with a fluid gutter of 20px to 64px.
Spacing sits on a 4px grid (4, 8, 12, 16, 24, 32, 48, 72). Sections are separated by 56px to
112px. The header is 72px tall, 60px on phones, and sticks to the top.

Every page opens on the stage and continues on the working surface:

- **Home.** The hero fills the first screen (up to 960px tall): a text column up to 720px on the
  start side, holding the headline, the lede, search beside Drop a file, and the live password;
  the glass on the end side, larger than its column and allowed to run off the edge; the bytes
  counter at the bottom end corner. Below it, on paper: one ruled sheet of tasks (a four-column
  grid with 1px gaps, one double-size cell), two tools to try in place, the directory as three
  ruled lists, and the promise band back on ink.
- **Tool pages.** Breadcrumbs, the icon and name, the lede and three small badges sit on the
  stage. The tool's first panel rides 32px to 48px up over the edge of the stage. The tool is the
  wide column; a 320px sticky aside holds trust notes and shortcuts.
- **Info pages.** A stage top with a display heading, then ruled sections with a 250px heading
  column.

Lists are ruled, not boxed: directory rows, steps, questions, principles and news entries are
separated by hairlines. Cards are kept for things that are objects (a tool, a result).

Responsive changes: the hero becomes one column at 860px, with the glass under the text and the
counter in the flow; the task grid goes to two columns at 1040px and one at 560px; the aside drops
under the tool at 980px; header links collapse into the Tools menu at 940px. Layout uses logical
properties throughout, so Arabic needs only a short override file. In Arabic the whole hero scene
is mirrored, so the glass faces the text again.

On touch screens and windows under 820px, things you tap are at least 44px tall and fields are at
least 16px, so iPhone Safari does not zoom.

## Elevation & Depth

Flat by default. Depth comes from three tonal steps (page, panel, well) and from the edge where
the paper meets the stage. Panels have a hairline and no shadow at rest; hover changes the edge
and the fill, not the height.

### Shadow Vocabulary
- **Small** (`--shadow-sm`: `0 1px 2px rgb(6 7 12 / 0.05)`): available for small raised controls.
- **Medium** (`--shadow`: `0 1px 2px rgb(6 7 12 / 0.04), 0 12px 28px -18px rgb(6 7 12 / 0.22)`):
  available for raised cards.
- **Large** (`--shadow-lg`: `0 2px 4px rgb(6 7 12 / 0.05), 0 30px 60px -28px rgb(6 7 12 / 0.38)`):
  things that float over the page: the Tools menu, the search palette, the toast, the sign-in
  card, and the first panel of a tool where it overlaps the stage.
- **Focus ring** (`0 0 0 3px` in `accent-soft`, with an `accent` edge): a field that has focus.
  Elsewhere focus is a 2px `accent` outline, 2px off the element.

On ink the same three shadows are black and heavier.

### Named Rules
**The Float Rule.** A shadow means the thing is over something else. If it sits in the page, it
gets a hairline.

**The No-Glow Rule.** Nothing glows and nothing is blurred. The only light on the site is drawn
inside the glass.

## Shapes

Softly squared. Controls and rows are 12px, small parts 8px, large fields 14px, panels 18px, the
sign-in card 24px. Full pills are kept for things that are tags or toggles of a view: badges,
filters, the header search, recent tools, the toast. Icon tiles are small squares (11px radius at
42px) with a hairline edge and a neutral fill; they carry no colour. Edges are 1px everywhere;
only the checkbox mark and the range thumb use more. A drop area is a 1px dashed edge in
`field-line`.

The brand mark is the system in one glyph: a paper-white rounded slab with a rose edge on the left,
a mint edge on the right and an ink tick. On a first visit the tick draws itself once.

## Components

### Buttons
Plain and exact. 44px tall, 12px radius, 500 weight, 0.95rem.
- **Default:** panel fill with a strong hairline. Hover darkens the edge to `text-3` and the fill
  to `surface-2`. Press scales to 0.97.
- **Primary:** ink on paper, paper on ink, 600 weight. Hover mixes 14% of the page colour into the
  fill. One per view.
- **Ghost:** no edge, `text-2`; fills with `surface-2` on hover.
- **Danger:** `danger` text and a tinted edge; `danger-soft` fill on hover.
- **Small:** 36px, 10px radius; 44px on touch screens.
- **Icon button:** a 40px square (44px in the header and on touch), same edge and hover; press
  scales to 0.94.
- **Copy:** a 32px text button (44px on touch) that turns `ok` on `ok-soft` when it has copied.

### Chips
- **Toggle chips:** 44px, 12px radius, with a 17px box. Checked fills the box with the text colour
  and a tick, and darkens the edge. They are checkboxes and behave like them.
- **Segmented control:** a well with 9px-radius buttons; the chosen one is a raised panel with a
  hairline ring.
- **Filters:** pills; the chosen one takes the primary button's colours.
- **Badges:** small pills on `surface-2`; `ok`, `bad`, `info` and `warn` versions use the status
  colour on its soft tint. On the stage, tool badges are outlined.

### Cards / Containers
- **Corner Style:** 18px.
- **Background:** `surface`, with a 1px `line` edge.
- **Shadow Strategy:** none, except where the Float Rule applies.
- **Hover (cards that open something):** edge to `text-3`, fill to `surface-2`, press to 0.99. An
  arrow in the corner moves 2px to 3px.
- **Internal Padding:** clamp(18px, 2.6vw, 30px); sections inside a panel are divided by a
  hairline, not nested panels.
- **Wells:** results, stats and list rows sit in `paper-well` with a hairline and a 12px radius.

### Inputs / Fields
- **Style:** `field-line` edge, 12px radius, 11px 13px padding, 1rem text. On paper the fill is
  white; on ink it is the well colour.
- **Hover / Focus:** edge to `text-2`; focus sets an `accent` edge and a 3px `accent-soft` ring.
- **Range:** a 4px hairline track whose chosen part is solid text colour, with a 24px ringed thumb
  that grows to 1.15 while held.
- **Messages:** status colour on its soft tint with a 30% edge, always with words.

### Navigation
- **Header:** a line of ink with no edge until the page scrolls, then a hairline. Links are
  0.95rem in `text-2`, turning `text` on hover or when current. A pill search trigger shows its
  keyboard shortcut; on narrow screens it becomes an icon.
- **Tools menu:** a full-width sheet of ink that drops 6px from the header, with rows of 28px icon
  tiles.
- **Search palette:** a 640px panel with an 18px radius over a scrim; results are rows, and a
  direct answer is shown in a well.
- **Footer:** the stage again, five columns of plain links, closing with a hairline.
- **Text links:** `accent` with a 1px underline in `accent-line` that darkens on hover. Section
  links are text-coloured with a hairline underline and a small arrow.

### The Glass (signature)
A ray-marched slab of glass with a page sealed inside, drawn by one hand-written WebGL fragment
shader with no 3D library. Light bends three slightly different amounts through it, which is where
the rose, mint and blue fringes come from; five thin lines of light arrive from the side and are
seen bent through the slab.
- **It starts as a picture.** The page loads with one captured frame of the same shader
  (`prism-still.webp`, 1300 by 1000). The canvas draws its first ten frames unseen and times them;
  only if they average under 22ms does it fade in over 400ms and replace the still, with a small
  turn so you can tell it is alive. If it later drops four slow frames, the still returns for good.
- **When the still stays.** Reduced motion, no WebGL or no high-precision shaders, 2GB of device
  memory or less, data saving, or a machine that fails the timing.
- **It draws only while something changes:** the pointer moved, a spring has not settled, a file
  is going in. With a mouse on a wide screen it also drifts slowly, until the page has been idle
  for 12 seconds. Off screen and in a hidden tab it draws nothing. It never renders more than
  about 1.6 million pixels.
- **You can take hold of it.** It turns toward the pointer; dragged, it follows the hand 1:1,
  rubber-bands past its limits and springs back with the speed you gave it.
- **Dropping a file.** While a file is held over the hero, the Drop a file button turns mint and
  the glass leans toward it. On drop, a page carrying the file's own name falls into the slab from
  above, the slab takes the weight, the light flashes once, and PDF Studio opens about a second
  later. The file is handed over through the browser's own storage.
- **In Arabic** the scene is mirrored.

### The Bytes Counter (signature)
"bytes sent from this page: 0", in mono, `text-3`, with the number in mint. It is measured, not
written: the page counts every request body it sends. If anything is sent, the number turns gold.
On the home page it opens to a plain explanation; on tool pages it sits at the top end corner of
the stage. In Arabic the sentence is in the text face and the number stays mono.

### The Live Password (signature)
A hairline pill on the stage: a mint live dot, a 20-character password in mono with symbols in
rose and digits in mint, Copy and a refresh button, and a 2px mint line along the bottom edge for
its strength. A new password arrives every 4.2 seconds and settles character by character; it
pauses while you point at it, focus it or have just copied it, and the dot turns gold.

### Motion
One choreographed entrance on the home page: the headline (700ms), then the lede (90ms later),
the two ways in (170ms), the password (230ms), the counter (520ms), while the glass scales in
from 0.94 over 1100ms. Everything uses a strong ease-out (`cubic-bezier(0.23, 1, 0.32, 1)`).
State changes take 160ms. Springs are kept for things you move yourself: the glass and the pin
star. Content never waits for a scroll position to appear. Page changes cross-fade in 220ms, and
a tool's icon and name travel from the row you opened. Reduced motion removes all of it.

## Do's and Don'ts

### Do:
- **Do** open every page on the ink stage and put the working tool on paper below it. Add the
  `ink` class to a band that should join the stage.
- **Do** use the tokens in `01-tokens.css` for every colour, radius and shadow, so the stage
  re-scoping and the dark theme keep working.
- **Do** keep the primary action ink on paper or paper on ink, one per view.
- **Do** dim the second half of a headline with `dim`, at headline sizes only.
- **Do** set values in Geist Mono with tabular numerals.
- **Do** separate lists with hairlines; use a panel only for an object.
- **Do** pair every status colour with words or an icon.
- **Do** keep tap targets at least 44px and fields at least 16px on touch screens.
- **Do** build with logical properties and check the page in Arabic; mirror directional arrows.
- **Do** keep the glass on its still picture wherever motion is reduced or the machine is slow,
  and record where any new raster comes from in `docs/provenance/`.

### Don't:
- **Don't** use rose, mint or blue as a background wash, a gradient, a glow, a card tint or a
  category colour.
- **Don't** set headline emphasis in a gradient or an accent colour.
- **Don't** add a second live scene, or a 3D library. The glass is the only one.
- **Don't** give a panel a shadow unless it floats over something.
- **Don't** blur backgrounds or add glows.
- **Don't** colour icon tiles.
- **Don't** add letter-spacing to Arabic, or set it in a second family.
- **Don't** animate content in on scroll, or leave anything moving while the page sits idle.
- **Don't** invent proof. There are no testimonials or user counts; the proof is the counter and
  the working tools.
- **Don't** hard-code dark colours for something on the stage.
