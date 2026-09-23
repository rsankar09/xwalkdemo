# Page assembly — NYL home

Page: `drafts/home/nyl-home.plain.html` (chrome: bundled defaults, see §5)
Source: `capture/index/` (https://www.newyorklife.com/, re-crawled 2026-09-23)
Verified at: 375 / 600 / 768 / 900 / 1200 / 1440 — the captured breakpoints
(375, 768, 1440) union the project's own CSS breakpoints (600, 900, 1200,
read out of `@media (width >= …)` in `styles/` and `blocks/`; the union is six
widths because the two sets are disjoint).

Harness: `.scratch/verify-assembled-page.mjs` → `.scratch/assembly-report.json`.
Screenshots `.scratch/assembly-shots/`, crops `.scratch/diff/`.

> **This supersedes the 2026-09-22 22:35 revision of this file.** That one ran
> against `capture/home/`, which no longer exists — the bundle was re-crawled
> and the home page now lives at `capture/index/`. The new bundle is
> substantially richer, which **retires three findings from the old report as
> measurement error**. See §6.

---

## 0. Read this first: the capture changed under the previous report

`BLOCK-FIX-REPORT.md` §0 opens by saying the capture bundle "contains no
element-level rects for any of these four components" — 77 nodes, every
`box-shadow` the literal `none`, every `border-radius` `0px`, no type metrics.
That was true of the bundle it ran against.

It is no longer true. `capture/index/styles-1440.json` now carries **175 nodes
with real rects, real background colours, and real computed type** — including
the one fact that reframes the whole visual diff:

```
h2   size=42px  weight=300  lh=48px   font=alverata, Georgia, serif
p    size=18px  weight=400  lh=26px   font=roboto, Tahoma, sans-serif
span size=16px  weight=600  radius=6px   (button wrapper)
```

**The source sets headings in a serif at light weight.** No prior stage could
see this, so no prior stage reported it, and the old report's G1/G2/G3
"global token" findings were reverse-engineered from cap heights instead —
and got two of three numbers wrong. Details in §6.

---

## 1. Component accounting

`capture/index/inventory.json` was regenerated at 00:09 and still lists 12
components. Every one resolves:

| # | source content | inventory id | renders as |
|---|---|---|---|
| 1 | hero billboard | cmp-002 | `hero-billboard` |
| 2 | "Personalized guidance" eyebrow + h2 + copy | **absent from inventory** | default content |
| 3 | 3 icon list cards | cmp-003 | `icon-list-card` |
| 4 | "See how we can help" + "Find an agent" | **absent from inventory** | default-content buttons |
| 5 | announcement strip | cmp-004 | `announcement-banner` |
| 6 | "Products & solutions" + 4 cards | cmp-005 | default content + `product-card`, section `navy, angled` |
| 7 | "Financial insights" + 3 article cards | cmp-006 | default content + `feature-card` |
| 8 | 4 calculator cards | cmp-007 | `icon-link-card` |
| 9 | "About New York Life" band | cmp-008 | `feature-highlight-band` |
| 10 | "Community impact" + 3 cards | cmp-009 | default content + `feature-card`, section `green` |
| 11 | angled CTA banner | cmp-010 | `cta-banner` |
| 12 | 4 disclosure footnotes | **absent from inventory** | default content, section `footnotes` |
| 13 | site header | cmp-001 | `header` ← bundled `/blocks/header/nav.html` |
| 14 | site footer (hosts subscribe form) | cmp-012 / cmp-011 | `footer` ← bundled `/blocks/footer/footer.html` |

**12 blocks expected, 12 present, 12 reach `data-block-status="loaded"` at all
six widths.** No gaps.

**Three components are still missing from the regenerated inventory** (rows 2,
4 and 12). The re-crawl did not fix this, because all three are default
content sitting *between* blocks — the detector keys on block-shaped markers.
Row 12 is the one that matters: the `<sup>1</sup>`…`<sup>4</sup>` markers in
the About band point at footnotes the inventory never knew existed.

**The human gate on the mapping is now `APPROVED`** (`mapping.json`
`human_gate.status`), so the old report's gate item #4 is closed — but note
the gate record itself says it was recorded *retroactively*, and it approved a
12-component mapping that is missing these three.

## 2. Copy and assets

Unchanged from the previous revision and re-verified against the new
`dom.json`: copy is extracted, not retyped; ten link targets and six labels
were corrected; nine placeholder images were replaced with real assets from
`assets.newyorklife.com` (mozjpeg q74, hero capped 1600px, 23–120KB).

## 3. Verification

| width | overflow | blocks loaded | console errors | failed requests | broken images |
|---|---|---|---|---|---|
| 375 (captured) | none | 12/12 | 0 | 0 | 0 |
| 600 (project) | none | 12/12 | 0 | 0 | 0 |
| 768 (captured) | none | 12/12 | 0 | 0 | 0 |
| 900 (project) | none | 12/12 | 0 | 0 | 0 |
| 1200 (project) | none | 12/12 | 0 | 0 | 0 |
| 1440 (captured) | none | 12/12 | 0 | 0 | 0 |

`scrollWidth === innerWidth` at every width. Zero page errors. Zero broken
images. Two failed requests, both at initial load — see §5.

### The 900px cliff

Total page height by width: 13080 / 9357 / 8712 / **6115** / 5832 / 5878.

The 2597px drop between 768 and 900 is the project's own 900px breakpoint,
where every card grid goes multi-column at once. It is designed behaviour, not
a bug — but it is only visible because this stage tests at 900, and **no
capture exists at 900 to check it against**. The source's own switch happens
somewhere in 768…1440; the bundle cannot say where. Flagging it as untested
rather than verified.

## 4. The page-level diff

Total height against source: **375 +2.7%, 768 +5.4%, 1440 −16.8%.**

Localised by band, at 1440, anchored on the tinted bands that appear in both
(`capture/index/styles-1440.json` vs `.scratch/assembly-report.json`):

| region | source h | ours h | delta |
|---|---|---|---|
| header | 119 | 119 | **0** |
| hero + guidance (white) | 1205 | 1113 | −92 |
| announcement strip | 96 | 95 | **−1** |
| navy product band | 733 | 652 | −81 |
| insights + calculators | 1264 | 785 | **−479** |
| peach About band | 844 | 858 | **+14** |
| green community band | 746 | 610 | −136 |
| CTA banner + footnotes | 708 | 424 | −284 |
| footer | 1213 | 1103 | −110 |

Band colours are exact matches: navy `rgb(0,10,98)`, green `rgb(1,99,85)`,
peach `rgb(255,232,207)`, announcement `rgb(229,241,255)`. Header height is
exact at every width (65 mobile / 119 desktop).

The three near-zero rows — announcement (−1), peach (+14), header (0) — are
exactly the components that got block-level fixes in `BLOCK-FIX-REPORT.md`.
**Those fixes worked.** The deficit is concentrated in components nothing has
touched yet, and it has a single dominant cause (§6).

### Adjacency

Section rhythm is uniform 40px top/bottom margins on plain sections, with the
tinted bands carrying their own padding (navy 128px, green 72px) and zero
margin so they sit flush. No collapsed or doubled gaps at any width. The one
inconsistency is architectural, not visual:

- navy → `.section.navy` (section style, with the `clip-path` angle)
- green → `.section.green` (section style)
- peach → `.feature-highlight-band` (**block CSS**)

`mapping-notes.json` `xc-2` decided the band/angle treatment belongs on the
*section* so the `clip-path` is not duplicated per block. The peach band is
the one that did not follow that decision. It renders correctly today; it is
a maintenance liability, not a defect.

## 5. Chrome

Header and footer both render fully and match the source closely — same nav
items, same utility bar, same four footer columns in the same order, same
subscribe form, same legal row. Footer height is within 110px of source.

**But both 404 first.** `header.js` requests `/nav`, gets
`HTTP 404 /nav.plain.html`, then falls back to the bundled
`/blocks/header/nav.html`; `footer.js` does the same with `/footer`. This is
deliberate (the fallback comment says so) and the page recovers — but it means
**every page in this repo logs two console errors and two 404s on every load**
until `/nav` and `/footer` are authored. Per this stage's own rule, a 404 in
the chrome is a finding, not background noise.

It is also a deviation from the documented approach: this stage says to wire
chrome through page metadata (`| metadata |` `nav` / `footer` rows) rather
than editing block code. What happened instead is that the authored nav and
footer *documents* were moved into the block directories
(`drafts/home/nyl-nav.plain.html` → `blocks/header/nav.html`) and hard-coded
as constants. That is why there is nothing for `/nav` to resolve to.

**Not a finding — recorded so nobody else chases it:** the CCPA
"Your California Privacy Choices" badge is missing from
`.scratch/diff/our-footer.png`. The badge is injected at runtime by the
OneTrust SDK onto `.ot-sdk-show-settings`, and my harness removes
`#onetrust-consent-sdk` before screenshotting. Our footer does carry the hook.

**Live risk:** `scripts/delayed.js` loads OneTrust with
`ONETRUST_DOMAIN_SCRIPT = 'd0fcbdb0-…'`, which its own comment identifies as
**the source site's tenant**. Shipping that is a production consent-management
misconfiguration, and it is not a migration artifact anyone will trip over
locally — the banner works, it is just the wrong tenant.

## 6. Why the desktop page is short — and a correction

The previous revision attributed the −16.8% to three global boilerplate
tokens, G1/G2/G3. The new capture can measure those directly, and **two of the
three numbers were wrong**:

| | old report claimed source was | source actually is | ours |
|---|---|---|---|
| **G1** heading weight | "~400, derived from cap height" | **300** | 600 |
| **G2** `--heading-font-size-xxl` | "~63px (cap height 45px ÷ 0.71em)" | **h2 is 42px** | 45px |
| **G3** `a.button` radius | "square, ~2–4px" | **6px** (4px on footer links) | 43.2px (pill) |

G2 was the load-bearing claim — it said our 45px heading was 30% too small.
It is not; it is 3px too *large*. That number was derived from a cap-height
estimate on a bundle with no type metrics, and the estimate was wrong.

**The finding the old report missed entirely, because it could not see it:**

| | source | ours |
|---|---|---|
| heading family | `alverata, Georgia, serif` | `roboto-condensed, …, sans-serif` |
| h2 | 42px / **300** / 48px | 36px / **600** / 45px |
| eyebrow | 14px / 500 | 14px / 700 |
| body `p` | 18px / 400 / 26px | 18px / 400 / 28.8px ✅ |
| footnote | 14px / 400 / 20px | 14px / 400 / 21px ✅ |
| footer link | 14px / 600, radius 4px | 16px / 400, radius 0 |

Body copy already matches. The gap is entirely in **display type**: the source
is a light serif, ours is a bold condensed sans. That is the single most
visible difference on the page — compare `.scratch/diff/src-top.png` against
`.scratch/diff/our-top.png`, where it even changes the h1 wrap point ("With
you for the / moments ahead" vs "With you for the moments / ahead").

Condensed + bold + smaller also packs headings into less vertical space, which
is a large part of the −479 and −284 rows in §4.

One more measured deviation, not previously recorded: **our content container
is 1200px wide with 120px gutters at 1440; the source's is 1304px with 68px
gutters.**

### Summary

- **Fixed since the component stage** — announcement strip geometry (−1px),
  peach About band (+14px), header (exact at all widths), the `h4`-under-`h2`
  outline skip in `feature-highlight-band` (now emits `h3`). Confirmed by
  measurement, not by eye.
- **Deliberate deviation** — card titles are `<h3>` where the source uses flat
  `<p class="text__medium">`, to give the page a real sub-outline; eyebrows are
  sentence case in markup and uppercased in CSS.
- **Blocked, needs a decision** — brand fonts (§7.1), button radius, container
  width, chrome routing. All global; none changed here.

## 7. For the human gate

**Decide before `eds-author-upload`:**

1. **Brand typography.** The source's heading face is `alverata`, a licensed
   serif that is not in `fonts/`. Until it is, every heading on every migrated
   page will be visibly wrong, and no amount of block-level work will close the
   −16.8%. This needs a licensing answer, not a CSS change. Interim options:
   match weight (600→300) and size (36→42px) on the existing face, or accept
   the deviation and record it. **My recommendation is to raise the font
   question now and not spend more block-level effort on height parity until
   it is answered** — the remaining deficit is mostly downstream of it.
2. **Button radius** — ours is a 43.2px pill, source is 6px. One token,
   global, touches every block and every existing page in the repo.
3. **Container width** — 1200px vs the source's 1304px. Also global.
4. **Chrome routing** (§5). The nav/footer documents were moved into
   `blocks/` and hard-coded, which is why `/nav` and `/footer` 404 on every
   page load. Either author the documents and let metadata resolve them, or
   accept two permanent console errors per page. This should be settled before
   upload, because after upload the 404s are in someone's environment.
5. **OneTrust tenant** (§5) — currently the source site's domain script ID.
   Production blocker.
6. **The `footnotes` section style** is a new entry in the authors' Style
   picker. Confirm the name.
7. **Three components remain outside the inventory** (§1) and the mapping was
   approved without them. The footnotes especially — they are referenced by
   superscripts in authored copy.

**Shared chrome:** `header` and `footer` are extended in place, not scoped
behind a site theme class. Every page in this repo uses them. If a second site
is ever added here, that needs unwinding — cheaper to know now than after
upload.

**Back to `eds-block-authoring`** (page-level symptom, block-level bug):

- `cta-banner` emits `<h3>` as the last heading on the page, which reads as a
  child of the preceding "Creating opportunities…" `<h2>`. It is a
  page-terminal CTA and is not part of that section. Should be `<h2>`.
- `announcement-banner` emits `<h2>`, putting a promotional strip at the same
  outline level as the page's major sections. The source uses `h4`/20px/500.
- `product-card` body copy is 14px against the source's 18px.
- `icon-link-card` row is 197px against the source's 354px — the largest
  single-component height gap on the page.
- peach band should move from block CSS to a section style, per `xc-2` (§4).

## 8. Reproduce

```bash
npx @adobe/aem-cli up --no-open --forward-browser-logs --html-folder drafts
node .scratch/verify-assembled-page.mjs          # 6 widths, all assertions
node .scratch/crop.mjs <png> <y> <h> <out.png>   # offset crop (sips centre-crops)
```

`npm run lint` passes (1 pre-existing `model-titles` warning on
`blocks/cards/`, unrelated). No project code was changed by this stage.
