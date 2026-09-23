# Block fixes — the four defects returned from page assembly

Branch: `feat/nyl-component-migration`
Input: `PAGE-ASSEMBLY-REPORT.md` §6, "Back to `eds-block-authoring`".
Source: `capture/home/` (https://www.newyorklife.com/, captured 2026-09-22).
Verified at 375 / 600 / 768 / 900 / 1200 / 1440 — the captured breakpoints
(375, 768, 1440) union the project's own CSS breakpoints (600, 900, 1200).
Harness: `.scratch/verify-blocks.mjs` (`doc` and `ue` surfaces).

> **Gate status unchanged.** `capture/home/mapping.json` still records
> `human_gate.status: "PENDING"`. Nothing here cleared it.

---

## 0. Read this before the tables: where the "source" numbers come from

The capture bundle **contains no element-level rects for any of these four
components.** `styles.json` (77 nodes) and `styles-responsive.json` (79 nodes
each at 375/768) capture only `<body>`'s direct children — the header and
footer experience fragments, the root grid, and ~50 tracking scripts and
pixels. Across all 235 captured nodes, *every* `box-shadow` is the literal
string `none` and *every* `border-radius` is `0px`. `clip-path`, `transform`,
`object-fit` and `aspect-ratio` are not in the captured property set at all.

`tools/importer/preflight.mjs` already warns about this class of problem
("1217 of 1538 captures have no component-level rects").

What made these fixes possible is that `dom.json` embeds the page's inline
`<style>` blocks, which carry the **authored** rules for these components by
container id. So the "source" column below is authored CSS — the rule text
itself, which is stronger evidence than a computed readback — except where
marked *derived* or *not captured*. Where a number genuinely is not in the
bundle, it says so rather than carrying an invented value.

---

## 1. cmp-004 `announcement-banner` — full-bleed → inset, 4px radius

**The mechanism was the opposite of what it looked like.** The source strip
has no `max-width` and no positive margin. It is inset because
`margin-left: 0; margin-right: 0` *cancels* the negative-margin breakout that
this site's other tinted bands use (`-4.25rem` / `-0.75rem` / `-1rem`). So the
fix is not to add an inset — it is to delete our full-bleed release rule and
let the section wrapper size it, which makes the inset track *this project's*
container instead of hard-coding the source's.

| property | source (authored) | ours now |
|---|---|---|
| `border-radius` | `4px`, unconditional — no media query | `4px` |
| `background-color` | `#e5f1ff !important` | `#e5f1ff` (`--brand-pale-blue`) |
| inner gutter | `margin-left: 24px; margin-right: 40px` | `padding: 20px 40px 20px 24px` |

The inline `style` attribute on this element says `background-color:#F8F7F7`
(grey). The stylesheet's `!important` pale blue wins. **Any importer reading
the DOM attribute gets the wrong colour** — worth knowing for cmp-010, whose
element carries the same misleading inline grey.

### Geometry — strip outer box (identical on both surfaces)

| width | source x, w | before x, w | after x, w | after y, h (doc) |
|---|---|---|---|---|
| 375 | 16, 343 *(derived)* | 0, 375 | **24, 327** | 1866, 237 |
| 600 | not captured | 0, 600 | **24, 552** | 1607, 211 |
| 768 | 12, 744 *(derived)* | 0, 768 | **24, 720** | 1512, 184 |
| 900 | not captured | 0, 900 | **32, 836** | 1294, 95 |
| 1200 | not captured | 0, 1200 | **32, 1136** | 1272, 95 |
| 1440 | 68, 1304 *(derived)* | 0, 1440 | **120, 1200** | 1272, 95 |

Source x/w derived from the footer XF rect, which is a `default--12` grid
sibling of the strip and therefore *is* the content-container box: 68+1304+68
= 1440, 12+744+12 = 768, 16+343+16 = 375. Those three are real captured rects.

**Deviation:** our container is 1200 wide, the source's 1304, so the inset is
120px at 1440 against the source's 68px. That is this project's existing grid
(`main > .section > div { max-width: 1200px }`), which every other band
already uses — not a new choice made here.

---

## 2. cmp-002 `hero-billboard` — CTA alignment + the angled edge

### 2a. The CTA

The source does **not** use `text-align: right`. It uses
`align-self: flex-end` on the CTA wrapper, which works because the content
card is a column flexbox. `text-align` on the card would have right-aligned
the h1 and copy too, which the source does not do. Implemented as flex.

There is a deliberate asymmetry: the source gives `.cmp-hero__title` and
`.cmp-hero__description` `margin-right: 19px` and gives the CTA none, so the
button overhangs the text column by exactly 19px. Held rather than averaged.

### 2b. The angled edge — two bevels, not one

The source clips the card with an SVG `clipPath` using
`clipPathUnits="objectBoundingBox"`, so the angle is **proportional to the
card's box**, not a fixed degree. Decoded vertex-for-vertex from
`svg#target__brand-svg-1 > clipPath#target__clipPath1 > path` and transcribed
to percentages, which reproduces it exactly and stays proportional:

```
polygon(0.62% 0, 85.68% 0, 99.96% 70.46%, 100% 99.13%,
        60.62% 100%, 0.44% 73.82%, 0 72.99%, 0 0.87%)
```

There are **two** bevels: a long top-right diagonal falling across 70% of the
card's height, and a bottom-left diagonal cutting the left 60% of the bottom
edge. Our previous `--band-angle` notch was a 56px cut on the top-right corner
only — the wrong shape in both size and count. The page-assembly report
described this as "the card's bottom edge is angled"; the bottom edge is
straight for its right 39% and diagonal across the left 61%.

| property | source (authored, ≥1024) | before | after (≥900) |
|---|---|---|---|
| `width` / `max-width` | `max-width: 640px` | `620px` | `640px` |
| `padding` | `40px 43px 40px 38px` | `48px 88px 48px 48px` | `40px 43px 40px 38px` |
| `border-radius` | `5px` | none | `5px` |
| `clip-path` | `url(#target__clipPath1)` | 56px corner notch | the polygon above |
| CTA alignment | `align-self: flex-end` | default (left) | `align-self: flex-end` |

### Geometry — hero content card and CTA (identical on both surfaces)

| width | card before x, w, h | card after x, w, h | CTA before x, w | CTA after x, w |
|---|---|---|---|---|
| 375 | 0, 375, 419 | 0, 375, 419 | 24, 327 | 24, 327 |
| 600 | 0, 600, 365 | 0, 600, 365 | 24, 552 | 24, 552 |
| 768 | 0, 768, 315 | 0, 768, 315 | 24, 720 | 24, 720 |
| 900 | 32, 620, 369 | **32, 640, 353** | 80, 484 | **454, 175** |
| 1200 | 32, 620, 369 | **32, 640, 353** | 80, 484 | **454, 175** |
| 1440 | 152, 620, 369 | **152, 640, 353** | 200, 484 | **574, 175** |

Card `y` = 282 and CTA `y` = 551 at all three desktop widths (doc surface);
hero block stays 680px tall, unchanged. Below 900 nothing changed, which is
correct — the source applies neither the clip nor the right-alignment there.

**Checked, because the clip can eat live text:** the bottom-left bevel meets
the card's left edge at 73.82% × 353px = 261px below the card top (y = 543).
The description's last line ends at ~523 and the CTA is bottom-*right*, so
both clear it. Confirmed visually in `.scratch/fix-hero-1440.png`.

**Deviation:** the source gates both the clip-path and the right-alignment at
`min-width: 1024px`; we apply them at 900, the project's breakpoint. Between
900 and 1024 we are angled where the source is a plain rectangle.

---

## 3. cmp-006 / cmp-009 `feature-card` — radius yes, shadow **no**

### 3a. The reported "~8px radius and a soft drop shadow" is wrong on both counts

**Radius is per-band, and neither band is 8px:**

| | cmp-006 (light) | cmp-009 (green) |
|---|---|---|
| authored `border-radius` | **18px** | **4px** |
| authored `border` | `2px solid #dcd9d5` | not declared |
| hover background | `#f1f0ef` | `#d4f7e0` |

The 18px comes from `#container-710848f31b .cmp-card.d-flex { border-radius:
18px }`, which beats the `4px` rule alongside it on specificity — the element
is literally `<div class="cmp-card d-flex">`. Implemented as the block default
plus a `main > .section.green` override, matching how the dark treatment is
already modelled as a section style rather than a block option.

`overflow: hidden` was added because the source puts no radius on the image
itself — the photo's top corners are clipped against the card.

### 3b. BLOCKED — the drop shadow cannot be confirmed and was not added

There is **no box-shadow anywhere in the capture bundle**. Zero `box-shadow`
declarations for cards in any of the three inline `<style>` blocks (the only
two in the file are OneTrust consent-banner rules), and `box-shadow: none` on
all 235 captured nodes. The card's resting `background-color` and `overflow`
are likewise undeclared.

Those properties live in
`/etc.clientlibs/nylcom/clientlibs/global.min.ACSHASH2a97bc29a2c5d0d0c6a33d764409706f.css`,
which is `<link>`ed from `dom.json` but **not in the bundle**.

So I did not add a shadow. Inventing one would bake a guess into the block
that has to be unwound when the real value arrives. **To unblock:** re-capture
with the node selector set widened to card/image/heading level and `border`,
`object-fit`, `aspect-ratio` added to the collected properties, or fetch that
stylesheet.

### 3c. Image ratio corrected

Every card image in this grid is served at `-w575-h323` — **575 × 323**
(1.780:1). The block previously forced `7 / 4` (1.75:1), eyeballed off the
crop. Now `575 / 323`. A fixed ratio remains correct here under the contract's
grid exception: a card grid wants one uniform strip. Note the asset
*filenames* claim `3x2` and `4_3`; the delivered bytes are neither, and the
source `<img>` carries no `width`/`height`, so it has no CLS protection — we
do not replicate that.

### Geometry — card item (identical on both surfaces)

| width | before x, w, h | after x, w, h | radius | border |
|---|---|---|---|---|
| 375 | 24, 327, 371 | 24, 327, **368** | 0 → **18px** | 1px → **2px** |
| 600 | 24, 264, 335 | 24, 264, **333** | 0 → **18px** | 1px → **2px** |
| 768 | 24, 348, 383 | 24, 348, **380** | 0 → **18px** | 1px → **2px** |
| 900 | 32, 263, 321 | 32, 263, **320** | 0 → **18px** | 1px → **2px** |
| 1200 | 32, 363, 356 | 32, 363, **353** | 0 → **18px** | 1px → **2px** |
| 1440 | 120, 384, 368 | 120, 384, **365** | 0 → **18px** | 1px → **2px** |

Heights drop 1–3px: the image is now 575:323 rather than 7:4, slightly
shorter, partly offset by the extra 1px of border per side. Source card rects:
**not captured** at any breakpoint, so there is no source column to compare
against — only the authored property values above.

---

## 4. cmp-008 `feature-highlight-band` — h2 → h4 skip removed

Confirmed from `dom.json`: the source really does go `h2` "Stronger together
since 1845" → four `h4`s, with no `h3` anywhere between. Four highlight items.

Re-tagged to `h3` in both fixtures. This is a **content and model** fix, not a
code fix — `highlights` is a richtext field, so the level is authored. The
block already classifies any heading level, and its CSS is class-scoped
(`.feature-highlight-band-item-title`), so the visual is unaffected:

| width | font-size before → after | line-height before → after |
|---|---|---|
| 375 / 600 / 768 | 19px → **19px** | 26.6px → **26.6px** |
| 900 / 1200 / 1440 | 16px → **16px** | 22.4px → **22.4px** |

Source `h4` font metrics are **not captured** (no heading node exists in the
bundle), so there was nothing to match *to* — holding our own rendering
constant across the re-tag is the strongest available check.

Also added to the model, so an author does not reintroduce the skip:

> Use Heading 3 — the band's own heading is a Heading 2, so Heading 4 here
> skips a level. Styling comes from the block, not the heading level.

`npm run build:json` re-run; the description is present in
`component-models.json` and `feature-highlight-band` is still in the section
filter.

**Page outline after the fix** — `H2 → H3` throughout, no skipped levels.

---

## 5. Verification

Both authoring surfaces measured, per the contract's step-6 gate:

- **doc** — `drafts/home/nyl-home.plain.html`
- **ue** — `drafts/components-ue.plain.html`, one row per model field group

**Every probe returns identical `x`, `w`, `h` on both surfaces** at all six
widths (`y` differs only because they are different pages). Cell
classification reports `ok` for all four blocks on both — no half-decorated
block on either shape.

| width | overflow (doc) | overflow (ue) | classification |
|---|---|---|---|
| 375 / 600 / 768 / 900 / 1200 / 1440 | none | none | 4/4 ok on both |

`document.documentElement.scrollWidth` equals the viewport at every width on
both surfaces. `npm run lint` clean (2 pre-existing warnings, unrelated —
the boilerplate `cards` item title, and capture freshness).

Whole-page check at 1440: **12/12 blocks `loaded`**, no `main` image missing
`alt`, page height 5,878px against the assembly stage's 5,877px — these fixes
are geometry-neutral at page scale.

Screenshots: `.scratch/fix-{hero,banner,cards,green}-1440.png`.
Harness kept at `.scratch/verify-blocks.mjs` — it is the only thing that
catches a surface-specific decoration bug, which is invisible without it.

### One correction to `PAGE-ASSEMBLY-REPORT.md` §4

That report states "Chrome loads: no `/nav` or `/footer` 404." **There are
two**, reproducibly: `404 /nav.plain.html` and `404 /footer.plain.html`.

They are benign — the header and footer probe for an authored fragment and
fall back to the bundled `blocks/header/nav.html` / `blocks/footer/footer.html`
— and the fallback is intact (header 119px / 59 links, footer 1103px / 57
links, identical to the assembly stage's measurements). Nothing here touched
those blocks. Recording it because the contract flags exactly this failure
mode: a `/nav` 404 that persists all session because it is dismissed as a
local-dev artifact. In production these resolve to authored documents; if they
do not, the fallback masks it silently.

---

## 6. For the human gate

### Blocked — needs data, not a patch

1. **The card drop shadow (§3b).** Not in the bundle at all. Needs a re-capture
   or the global stylesheet before it can be implemented rather than guessed.
2. **Source heading metrics for cmp-008 (§4)** — same root cause: no
   heading-level nodes were captured.

### Decide

3. **The 18px radius comes from an Adobe Target experiment layer.** It sits in
   an inline `<style>` inside `div#target__redesign.at-element-marker`,
   alongside the `:root` overrides that this migration *already* uses —
   `--orange-bg: #ffe8cf` is our `--brand-peach`, and the green band's
   `#016355 !important` is our `--brand-green`. So the whole migration is
   already built against the Target variant and 18px is consistent with it.
   But it is a live personalisation layer: the value may not be stable across
   visitors, and may not be what the design system specifies. **Worth
   confirming the intended token with NYL** rather than treating one capture
   as authoritative.
4. **G1/G2/G3 remain unchanged** — heading weight 600 vs source ~400,
   `--heading-font-size-xxl` 45px vs ~63px, button radius 2.4em pill vs
   square. I asked whether to fix them in this pass and got no answer, so I
   took the in-scope default and left them. They are still the dominant cause
   of the −16.8% desktop height deficit, and the button radius is visible on
   the hero CTA in `.scratch/fix-hero-1440.png` (43.2px against a square
   source button).

### Observed, not fixed — outside the four reported defects

5. **Card hover state.** The source changes the card's background on hover
   (`#f1f0ef` light, `#d4f7e0` green); ours only underlines the title and
   shifts the arrow colour.
6. **`mapping.json` records cmp-009's band as "dark navy".** It renders dark
   green `#016355` — the DOM's inline `#000A62` is overridden. The register is
   wrong, and it also understates the cmp-006/cmp-009 delta as "CSS only"
   when it is radius **and** border **and** hover colour.
7. **cmp-007 is selector-coupled to cmp-006** in every source rule
   (`#container-710848f31b …, #container-1991f9d8e4 …`). Since the human gate
   split them into separate blocks, that shared styling is now duplicated by
   hand in two places and will drift.
8. **Source footnote markers are out of order** in cmp-008's copy (items run
   `1,2 → 4 → 3`). Inherited; we reproduce it verbatim.
