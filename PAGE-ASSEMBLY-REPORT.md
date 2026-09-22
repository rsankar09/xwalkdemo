# Page assembly — NYL home

Page: `drafts/home/nyl-home.plain.html` (chrome: `nyl-nav`, `nyl-footer`)
Source: `capture/home/` (https://www.newyorklife.com/, captured 2026-09-22)
Verified at: 375 / 600 / 768 / 900 / 1200 / 1440 — the captured breakpoints
(375, 768, 1440) union the project's own CSS breakpoints (600, 900, 1200).

Harness: `.scratch/verify-page.js`, `.scratch/measure.js`, `.scratch/sections.js`.
Screenshots in `.scratch/shots/`.

> **Gate status inherited, not cleared.** `capture/mapping.json` still records
> `human_gate.status: "PENDING"`. Nothing in this stage changed that.

---

## 1. Component accounting

Every component in the page's source order, and what renders it.

| # | source content | inventory id | renders as |
|---|---|---|---|
| 1 | hero billboard | cmp-002 | `hero-billboard` block |
| 2 | *(US Soccer partnership band)* | — | **not rendered in the source** — see §2 |
| 3 | "Personalized Guidance" eyebrow + h2 + copy | **absent from inventory** | default content |
| 4 | 3 icon list cards | cmp-003 | `icon-list-card` block |
| 5 | "See how we can help" + "Find an agent" CTAs | **absent from inventory** | default content buttons |
| 6 | announcement strip | cmp-004 | `announcement-banner` block |
| 7 | "Products & solutions" heading + 4 product cards | cmp-005 | default content + `product-card`, section `navy, angled` |
| 8 | "Financial insights & calculators" heading + 3 article cards | cmp-006 | default content + `feature-card` |
| 9 | 4 calculator cards | cmp-007 | `icon-link-card` block |
| 10 | "About New York Life" image + highlights band | cmp-008 | `feature-highlight-band` block |
| 11 | "Community impact" heading + 3 cards | cmp-009 | default content + `feature-card`, section `green` |
| 12 | angled CTA banner | cmp-010 | `cta-banner` block |
| 13 | 4 disclosure footnotes | **absent from inventory** | default content, section `footnotes` (new) |
| 14 | site header | cmp-001 | `header` block ← `nav` metadata → `/drafts/home/nyl-nav` |
| 15 | site footer (hosts subscribe form) | cmp-012 / cmp-011 | `footer` block ← `footer` metadata → `/drafts/home/nyl-footer` |

No gaps: 12 blocks resolve, 12 blocks reach `data-block-status="loaded"` at
every tested width.

**Three components were missing from the inventory and therefore from the
mapping** (rows 3, 5 and 13). Composing the page is what surfaced them —
each is default content sitting between blocks, so no component-scoped
fixture would ever have shown the hole. Row 13 is the worst of the three: the
`<sup>1</sup>`…`<sup>4</sup>` markers already in the About band were pointing
at footnotes that did not exist on the page.

## 2. Correction to a prior finding

`IMPORT-QA-REPORT.md` §4 reports a **US Soccer partnership band** as a
home-page component missing from the inventory, and cites it as evidence that
the inventory under-samples.

It is in the DOM, but its container carries `aem-GridColumn--default--hide`
and it renders at **none** of 375, 768 or 1440 in the capture's own
screenshots. It is hidden markup, not a missing component. The inventory was
right to exclude it, and it should not be authored.

The second component that report names — the "Personalized Guidance" band —
*is* real, and is row 3 above.

## 3. Copy and assets

Copy was extracted from `capture/home/dom.json`, not retyped. That changed ten
link targets and two link labels that had been invented at the component
stage:

| | was | now |
|---|---|---|
| hero CTA | `/get-started` | `/leads-agents/get-started-now` |
| announcement | `/newsroom/dividend-2026` | `/newsroom/2025/record-dividend-payout-for-2026` |
| advisory card | `/products/advisory` | `/products/advisory-services` |
| budget article | `/articles/budgeting` | `/articles/how-to-budget` |
| retirement calc | `/…/retirement-savings` | `/…/retirement-savings-calculator` |
| college calc | `/…/college-savings` | `/…/529-college-savings-calculator` |
| long-term care calc | `/…/long-term-care` | `/…/costs-of-long-term-care` |
| philanthropy card | `/philanthropy` | `/foundation/grant-opportunities` |
| sports card | `/sports-partnerships` | `/about/partnerships` |
| cta banner | `/find-an-advisor` | `/leads-agents/get-started-now` |

Card link labels come from the source anchors' `title` attributes, which is
where that site keeps the accessible label. Two were invented and are now
sourced ("Read about the safety of annuities", and the four calculator
labels).

**All nine images were placeholders.** They are now the real assets,
downloaded from `assets.newyorklife.com` and re-encoded (mozjpeg q74, hero
capped at 1600px): 120KB hero, 57KB band, 23–33KB per card. Alt text is the
source's, verbatim.

## 4. Verification

| width | overflow | blocks | console errors | failed requests | broken images |
|---|---|---|---|---|---|
| 375 (captured) | none | 12/12 | 0 | 0 | 0 |
| 600 (project) | none | 12/12 | 0 | 0 | 0 |
| 768 (captured) | none | 12/12 | 0 | 0 | 0 |
| 900 (project) | none | 12/12 | 0 | 0 | 0 |
| 1200 (project) | none | 12/12 | 0 | 0 | 0 |
| 1440 (captured) | none | 12/12 | 0 | 0 | 0 |

`document.documentElement.scrollWidth` equals the viewport at every width.
Chrome loads: no `/nav` or `/footer` 404. No image is missing `alt`.
`npm run lint` is clean.

Two notes on the harness itself, because both initially read as product bugs:

- Jumping straight to `document.body.scrollHeight` to trigger lazy loading
  **skips every image in between**. At 375 the page is 13,099px tall, so all
  six `feature-card` photos stayed unloaded and screenshotted as blank
  frames. The harness now steps a viewport at a time. Worth knowing before
  someone else files it.
- The OneTrust CMP genuinely fires on the local page and covers the hero. The
  harness dismisses it with `#onetrust-accept-btn-handler`, the same selector
  `capture/home/meta.json` records the capture using.

## 5. Page-level diff

| width | source | ours | delta |
|---|---|---|---|
| 375 | 12,736 | 13,099 | **+363 (+2.9%)** |
| 768 | 8,269 | 8,691 | **+422 (+5.1%)** |
| 1440 | 7,065 | 5,877 | **−1,188 (−16.8%)** |

Mobile and tablet are within tolerance. Desktop is not, and it is not one
band — it is spread across all of them:

| band | source h | ours h | Δ |
|---|---|---|---|
| header | 119 | 119 | 0 |
| hero | 680 | 680 | 0 |
| personalized guidance | 601 | 473 | −128 |
| announcement | 135 | 87 | −48 |
| products (navy, angled) | 745 | 652 | −93 |
| insights + article cards | 570 | 471 | −99 |
| calculators | 260 | 197 | −63 |
| about highlight band | 1,100 | 858 | −242 |
| community (green) | 775 | 615 | −160 |
| cta banner | 250 | 142 | −108 |
| footnotes | 332 | 162 | −170 |
| footer | 1,213 | 1,103 | −110 |

(Sums to −1,221 against a measured −1,188; the residual is inter-band gap
rounding.) Header and hero match to the pixel because their heights were
measured and hard-set at the component stage. Everything else is short, by
roughly the same proportion — which points at the type scale and the button
shape, not at any individual block.

### Fixed at this stage

1. Personalized Guidance heading and copy added (was missing entirely).
2. The band's two CTAs added, plus a global rule so consecutive
   `p.button-wrapper` paragraphs in default content sit side by side from
   600px up and stack below it — matching the source at both ends.
   Authoring both links in one paragraph does **not** work: `decorateButtons`
   only promotes an `<a>` that is its paragraph's only child.
3. Footnotes section added, with a new `footnotes` section style
   (`styles/styles.css` + `models/_section.json`, `npm run build:json` re-run).
   This resolves four dangling `<sup>` markers.
4. Ten link targets and six link labels corrected against `dom.json`.
5. Nine placeholder images replaced with real, optimized assets.

### Deliberate deviation

- **Card titles are `<h3>`; the source uses `<p class="text__medium">`.** The
  block models carry a `titleType` field, and the source's flat markup gives
  the page no sub-outline at all. Measured cost: card titles render at 16px
  against the source's ~20px, which is part of the desktop deficit above.
- **Eyebrows are sentence case in markup, uppercased in CSS.** The source
  ships literal uppercase. Ours is the better authoring contract and renders
  identically.

### Blocked — needs a decision, not a patch (§6)

The desktop deficit is dominated by three unreconciled boilerplate defaults.
All three are global, so I have not changed them:

| | project | source (measured at 1440) |
|---|---|---|
| **G1** heading `font-weight` | `600` | ~400 — the source h1 is light, ours is bold |
| **G2** `--heading-font-size-xxl` | `45px` | ~63px (cap height 45px ÷ 0.71 em) |
| **G3** `a.button` `border-radius` | `2.4em` (pill) | square, ~2–4px |

G1 and G3 are the most visible difference on the page — compare
`.scratch/shots/page-1440.png` against `capture/home/screenshots/1440.png` at
the hero. Neither is a migration artifact; both are stock
`aem-boilerplate` values that no stage has yet replaced with brand values.

## 6. For the human gate

**Decide before `eds-author-upload`:**

1. **G1/G2/G3 — the global type and button tokens.** Changing them fixes most
   of the −16.8% but touches every block and every existing page in the repo.
   Changing them is my recommendation; doing it silently is not.
2. **The `footnotes` section style** is a new entry in the authors' Style
   picker. Confirm the name and that a section style (rather than a block) is
   the right home for disclosure copy.
3. **The adjacent-CTA rule** in `styles/styles.css` is a shared default-content
   behaviour change, not scoped to this site.
4. **`mapping.json` is still `PENDING`.** Three of its components were
   missing from the inventory it was built from. That is worth weighing before
   the mapping is approved as-is.

**Shared chrome:** `header` and `footer` were extended in place at the block
stage, not scoped behind a site theme class. Every page in this repo uses
them. If another site is ever added here, that will need unwinding — flagging
it now because it is cheaper than after upload.

**Back to `eds-block-authoring`** (page-level symptoms, block-level bugs):

- `announcement-banner` renders full-bleed; the source strip is inset inside
  the content container with a 4px radius.
- `hero-billboard` left-aligns its CTA; the source right-aligns it inside the
  content card, and the card's bottom edge is angled where ours is straight.
- `feature-card` has a ~2px radius and no shadow; source cards have ~8px and a
  soft drop shadow.
- `feature-highlight-band` emits `h4` directly under the section `h2`, a
  skipped level. Inherited from the source, but the model can emit `h3`.
