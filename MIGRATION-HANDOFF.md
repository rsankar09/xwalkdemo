# NYL component migration — block authoring handoff

Branch: `feat/nyl-component-migration`
Source: `capture/mapping.json` (home page scope), 12 components, verdicts 10 × extend / 2 × new.

> **This proposal was built against an ungated mapping.** `mapping.json` records
> `human_gate.status: "PENDING"` with `auto_approved: []`.

## 1. Decisions taken on the four REVIEWER DECISION items

The mapping recommended consolidating the card family (xc-1) and expressing
cmp-004/cmp-008 as default content. **That was built first and then reversed on
instruction: the project wants one block per component, no consolidation.**
What ships is therefore the *alternative* candidate the mapping listed for each
of these, not its preferred one.

| id | question | decision | note |
|---|---|---|---|
| **xc-1** | one card block or four? | **Four separate blocks** | Overturns the mapping's recommendation. Cost is four near-duplicate `decorate()` bodies; mitigated by a shared helper (§2). Benefit is tighter models — `icon-list-card` has no link field at all, so an author cannot make one clickable. |
| **cmp-004** | announcement as a block or default content? | **Its own block** | The mapping's alternative candidate. Self-contained: paints its own band, needs no section style. |
| **cmp-008** | one bespoke block or decompose? | **Its own block** | The mapping's alternative candidate. Keeps the image, heading, highlights and CTA from drifting apart. |
| **cmp-010** | merge with cmp-004 into one `banner` block? | **Not merged** | Consistent with the no-merge instruction. |

## 1a. Where every mapping entry ended up — one block per component

| `component_key` | id | block | authoring |
|---|---|---|---|
| site-header | cmp-001 | `blocks/header/` | `/nav` fragment document |
| hero-billboard | cmp-002 | `blocks/hero-billboard/` | block |
| icon-list-card | cmp-003 | `blocks/icon-list-card/` | container block + items |
| announcement-banner | cmp-004 | `blocks/announcement-banner/` | block |
| product-card | cmp-005 | `blocks/product-card/` | container block + items |
| feature-card | cmp-006 | `blocks/feature-card/` | container block + items |
| icon-link-card | cmp-007 | `blocks/icon-link-card/` | container block + items |
| feature-highlight-band | cmp-008 | `blocks/feature-highlight-band/` | block |
| feature-card (dark) | cmp-009 | `blocks/feature-card/` on a Green band section | same `component_key` as cmp-006 — the mapping itself records this as one component with a band variant, not two |
| cta-banner | cmp-010 | `blocks/cta-banner/` | block |
| email-subscribe | cmp-011 | `blocks/email-subscribe/` | block |
| site-footer | cmp-012 | `blocks/footer/` | `/footer` fragment document |

Two naming caveats:

- **`header` and `footer` cannot be renamed** to `site-header`/`site-footer`.
  `aem.js` hardcodes `buildBlock('header', '')` and `buildBlock('footer', '')`;
  the names are a platform contract, not a choice.
- **The boilerplate `cards`, `hero` and `columns` blocks were reverted to
  stock** and left registered. Nothing in this migration uses them. If their
  presence in the author's component list is unwanted, remove them from
  `models/_section.json` — that is a one-line change, deliberately not taken
  here because deleting boilerplate blocks is a wider decision.

## 2. What was built

### New blocks
| block | component |
|---|---|
| `blocks/hero-billboard/` | cmp-002 |
| `blocks/icon-list-card/` | cmp-003 |
| `blocks/announcement-banner/` | cmp-004 |
| `blocks/product-card/` | cmp-005 |
| `blocks/feature-card/` | cmp-006, cmp-009 |
| `blocks/icon-link-card/` | cmp-007 |
| `blocks/feature-highlight-band/` | cmp-008 |
| `blocks/cta-banner/` | cmp-010 |
| `blocks/email-subscribe/` | cmp-011 |

### Extended blocks
| block | component | change |
|---|---|---|
| `blocks/header/` | cmp-001 | Sticky bar, three mega-menu drawers with multi-column panels and promo footnote, search drawer, login drawer with a real `<form>`, utility row, 3-level nesting. All chrome is CSS-drawn — **no icon assets required**. |
| `blocks/footer/` | cmp-012 | 4-column link lists, social icon row, phone + copyright, legal row, OneTrust hook, hosts the nested `email-subscribe`. |

### One shared helper, deliberately

`scripts/card-utils.js` holds the mechanics the four card blocks must share:
cell classification, the stretched link, the arrow, and image optimisation.
Each card block keeps its own folder, model, CSS and `decorate()` — an author
picks them by name — but four copies of this logic would drift. **If zero
shared code is preferred, inlining it is mechanical**: roughly 40 lines per
block, no behavioural change.

### Core changes (landed first, per the contract's ordering rule)
- `styles/styles.css` — brand palette, navy/green band + angled-edge section
  styles, eyebrow rule, footnote `sup`, and `--nav-height` corrected to
  65/119px. **`a.button.primary` is now brand blue rather than near-black**:
  every CTA in the source is blue. This affects any existing `.button.primary`.
- `models/_section.json` — nine blocks registered in the section filter; band
  styles reduced to `navy`, `green`, `angled` (the `announcement`, `peach` and
  `angled-media` styles were removed — those blocks now paint their own bands).
- `scripts/delayed.js` — OneTrust CMP loader.
- `icons/` — seven icons extracted from the capture's inline SVGs.

### Test fixtures (kept as regression pages)
- `drafts/components.plain.html` — document shape, full page in source order.
- `drafts/components-ue.plain.html` — Universal Editor shape.
- `drafts/edge.plain.html` — omitted fields and author-written links in copy.

Run with `npx @adobe/aem-cli up --html-folder drafts`.

## 3. Markup contract

Universal Editor is the primary surface (`editor-support.js`,
`component-models.json` and `_<block>.json` partials all present), so local
drafts are a test harness, not the contract.

**The four card blocks are container blocks.** Child items are the rows on
*both* surfaces, and each item's field groups are its cells — identical either
way. Their cells differ because their models do:

```
feature-card      media (image, imageAlt) | copy (pretitle, title, titleType) | link
product-card      copy (pretitle, title, titleType, description) | link
icon-list-card    media (icon) | copy (title, titleType, description)
icon-link-card    media (icon) | copy (title, titleType) | link
```

**`hero-billboard`, `announcement-banner`, `feature-highlight-band`,
`cta-banner` and `email-subscribe` are simple blocks**, so the surfaces differ:

```
Universal Editor                    Document
block > div > div   (group 1)       block > div > div  (group 1)
block > div > div   (group 2)                   > div  (group 2)
      N rows x 1 cell                     1 row x N cells
```

All of them read `:scope > div > div` and classify **by content**, never by
position. Verified on both shapes — see §5.

`feature-highlight-band` has one extra rule worth knowing: its intro and its
highlights both arrive as copy cells, and are told apart by **heading count**
(the highlights field holds several, the intro at most one). Only when that is
inconclusive — a single authored highlight — does the later cell win.

**`header` and `footer` are page chrome, not section blocks.** They are built
by `loadHeader()`/`loadFooter()` from the `/nav` and `/footer` fragment
documents and are never inserted into a section, so neither has a model partial
nor a section-filter entry — contract §8's "registered twice" rule does not
apply to them. Their authoring contract is the fragment document structure:

*`/nav` — read positionally, one section per region. Sections 3–6 are optional
and sections 1–3 keep their boilerplate meaning, so an existing boilerplate
`/nav` still renders.*

| # | region | authored content |
|---|---|---|
| 1 | Brand | one linked image — `[![alt](logo)](/)` |
| 2 | Navigation | one nested `<ul>`, up to 3 levels |
| 3 | Tools | right-hand CTA, e.g. `**[Get Started](/…)**` |
| 4 | Search | `## Search` + one link — text is the placeholder, href the results page |
| 5 | Utility | `<ul>` of links for the top strip; an `#login` href opens the login drawer |
| 6 | Login | drawer title, intro, `Label \| type \| name` field list, one bold link supplying the form action, extra link columns |

Within section 2: an L1 item with a nested list becomes a mega-menu drawer; L2
items are categories; L3 items are `[Title](url)` plus optional description
text; an L3 link in `*italics*` becomes the column's trailing arrow CTA.

*`/footer` — sections are the structure.* Every section but the last is a
column; the last is the legal row. Inside a column each heading starts a link
group. A list whose every item is an icon-only link becomes the social row. A
column containing a nested block or the social row becomes the aside column. In
the legal section a paragraph containing a `tel:` link becomes the contact
line, and `href="#ot-sdk-show-settings"` wires the OneTrust hook.

## 4. Which model owns each authored property

| property | owned by | why |
|---|---|---|
| card media / eyebrow / title / description / link | the card block's **item** model | Per-card content. Each card type's model differs — `icon-list-card` has no link field, `icon-link-card` no description. |
| card column count, border, fill | **CSS, not authored** | Each card type has one fixed presentation, so there is nothing to pick. This is the main gain from splitting: no variant checkboxes. |
| band colour (navy / green) | **section** `style` | xc-2: the band spans the whole section, not just the block. An author opening the Product Cards dialog will not find it — it is on the section. |
| diagonal band edge (`angled`) | **section** `style` | Same. Used with `navy` behind the product cards. |
| the announcement band and the peach highlight band | **the block itself** | Those two blocks release themselves from the content width and paint their own band, so they need no section style. |
| eyebrow in default content | **position** — first paragraph immediately followed by an `h2` | Default content carries no class field. Documented because it is invisible otherwise. |

## 5. Verification

Measured in Chromium at the **union** of the captured breakpoints (375/768/1440)
and this project's own CSS media-query widths (600/900/1200), across three
fixtures, against the real `loadPage()` pipeline.

### Both surfaces agree

`x`, `w` and `h` are **identical across the document and Universal Editor
fixtures for every block** at every width. At 1440:

| element | doc (x,w,h) | UE (x,w,h) |
|---|---|---|
| hero-billboard | `0,1440,680` | `0,1440,680` |
| — content card | `152,620,369` | `152,620,369` |
| icon-list-card | `120,1200,158` | `120,1200,158` |
| — item 1 / item 3 | `120,384,158` / `936,384,158` | identical |
| announcement-banner | `0,1440,90` | `0,1440,90` |
| — inner | `120,1200,50` | `120,1200,50` |
| product-card | `120,1200,226` | `120,1200,226` |
| — item 1 / item 4 | `120,282,226` / `1038,282,226` | identical |
| feature-card | `120,1200,368` | `120,1200,368` |
| — item 1 / item 3 | `120,384,368` / `936,384,368` | identical |
| — image | `121,382,218` | `121,382,218` |
| icon-link-card | `120,1200,200` | `120,1200,200` |
| — item 1 / item 4 | `120,282,200` / `1038,282,200` | identical |
| feature-highlight-band | `0,1440,863` | `0,1440,863` |
| — highlight grid | `152,1136,176` | `152,1136,176` |
| — item 1 / item 2 | `152,544,74` / `744,544,74` | identical |
| cta-banner | `120,1200,142` | `120,1200,142` |
| email-subscribe | `120,400,140` | `120,400,140` |
| navy band (section) | `0,1440,652` | `0,1440,652` |

Column counts are as designed: 3-up at 384px for `feature-card` and
`icon-list-card`, 4-up at 282px for `product-card` and `icon-link-card`.

### Against the source capture, at 1440

Source rects are from `capture/home/inventory.json`. They cover the whole
component *including* its band and heading, so only full-bleed rows compare
directly; `y` is not comparable because the fixture omits the header and some
page furniture, so offsets drift cumulatively.

| component | source (x,y,w,h) | rendered (x,w,h) | Δw | Δh |
|---|---|---|---|---|
| cmp-002 hero-billboard | `0,119,1440,680` | `0,1440,680` | **0** | **0** |
| cmp-004 announcement | `0,1400,1440,135` | `0,1440,90` | **0** | −45 |
| cmp-005 navy band | `0,1590,1440,745` | `0,1440,652` | **0** | −93 |
| cmp-008 highlight band | `0,3340,1440,1100` | `0,1440,863` | **0** | −237 |
| cmp-009 green band | `0,4430,1440,775` | `0,1440,615` | **0** | −160 |
| cmp-010 cta-banner | `0,5270,1440,250` | `120,1200,142` | −240¹ | −108 |
| cmp-011 email-subscribe | `1020,5960,400,245` | `120,400,140` | **0** | −105 |

¹ cmp-010's source rect spans the full viewport because it includes the
container; the outlined box itself sits inside the content column.

Every height runs short. The dominant cause is the font substitution (§6) —
the fallback stack has different metrics, so copy wraps in fewer lines. The
placeholder fixture images also differ in ratio from the source assets.

### Assertions

| check | result |
|---|---|
| horizontal overflow at 375/600/768/900/1200/1440 | **none** — `scrollWidth === clientWidth`, all three fixtures, all six widths |
| JS errors | **none**, 18/18 fixture × width combinations |
| unclassified cells | **0** |
| nested anchors | **0** |
| arrows match linked cards | 14/14 doc, 11/11 UE; unlinked cards correctly get none |
| highlight-band grid split | 4 items from one richtext field on both surfaces; 1 item in the single-highlight edge case, correctly not mistaken for the intro |
| card image ratio | rendered 382×218 = 1.752 against the 7:4 (1.75) design ratio |
| icons resolve | 7/7 load `200` at correct natural sizes |
| section-filter registration | all 9 blocks present in `component-filters.json` |
| every `template.model` resolves | 19/19, including the empty container models |
| axe-core (WCAG 2.0/2.1 A + AA) | **0 violations** across all three fixtures at 375 and 1440 |
| subscribe form behaviour | empty / malformed / recovery-on-input / 500 / 200 all correct; label, `aria-describedby`, `role=status`, `aria-live=polite`, button accessible name all resolve |
| `npm run lint` | clean |

Header and footer were verified separately by their own agents at
375/600/768/900/1200/1440: zero overflow, zero console errors, axe clean on
`.footer`, and for the header `aria-expanded`/`aria-controls` resolution,
Escape-closes-and-restores-focus, focus trapping, and body scroll lock.

### Bugs this verification caught

Found while the consolidated version was being built; all carried forward
into the split blocks, which is the main reason the split was cheap.

1. **A `.icon` variant class collided with the global `.icon` utility** in
   `styles.css` (`inline-block; 24×24`), collapsing whole grids to 24×24 while
   their children rendered at full size. A screenshot showed this as "broken"
   with no indication of the cause. The split architecture avoids the class
   entirely — `icon-list-card` and `icon-link-card` are block names, not
   variants.
2. **The hero broke entirely on the Universal Editor surface.** It was
   `display:flex`, and UE delivers one row per field group, so image and text
   became side-by-side flex items — the card rendered 233px wide instead of 375
   at mobile. **This is the exact bug class the two-surface rule exists for,
   and it was invisible on the document fixture.** `hero-billboard` now
   normalizes cells into a media pane and a content card in `decorate()`, so
   the layout cannot depend on row count at all.
3. **A base `.hero picture { position:absolute }` rule leaked into the
   billboard variant** below 900, so the "stacked" mobile layout was actually
   overlapping. Moot now that `hero-billboard` is a separate block.
4. **The eyebrow heuristic hit trailing content.** `p:first-child` in a band
   matched every default-content wrapper, rendering a band's closing CTA button
   as a tiny uppercase kicker. Narrowed to `p:first-child:has(+ h2)`.
5. **A section-style padding override was clobbered** by band padding inside
   the `≥900` media query (later in source order, same specificity). Moot now
   that the band blocks are self-contained.
6. **The whole-card anchor nested the description's link.** Wrapping the card
   in an `<a>` put any author-written link in the copy *inside* it — invalid
   HTML, and because this DOM is assembled in JS rather than parsed, the
   browser does not un-nest it, so it simply ships broken. Replaced with the
   stretched-link pattern: the anchor wraps the title and a `::after` overlay
   makes the whole card clickable, with inner links raised above it. axe does
   not flag this, so it was only caught by asserting on the DOM directly. The
   fix lives once, in `scripts/card-utils.js`, for all four card blocks.
7. **`--nav-height` was 64px against a 65/119px header.** The header block
   corrected it in `header.css`, but that file arrives with the lazily-loaded
   block, so the correction landed as a ~55px layout shift. Moved to
   `styles.css`, which is render-blocking.
8. **The announcement link failed colour contrast** at 4.11:1 (brand blue on
   the pale-blue strip). Darkened to `--brand-blue-hover`, 6.67:1.
9. *(footer, found by its own verification)* `margin: 72px 0 0` on `.footer-legal`
   overrode the `margin: 0 auto` centring, pushing the legal rule 88px left of
   the columns at 1440.

## 6. Blocked — not fixable in block code

- **Headline typeface is unavailable.** The source sets a licensed **serif** for
  all headings; `capture/home/styles.json` only captured top-level elements
  (77 entries, almost all tracking pixels) and reports `roboto, Tahoma,
  sans-serif` for those, so the actual family is not even named in the bundle.
  Headings currently render in the repo's `roboto-condensed`. Metrics differ, so
  headings wrap at different points — this accounts for most of the height
  deltas in §5. **Do not tune tracking or size to compensate**; it would have to
  be unwound when the real font lands. Needs the family name and licence.
- **The subscription endpoint is unknown.** The mapping flagged that
  endpoint/consent behaviour needs confirming with the NYL team. The form is
  fully built and validates, but `form_action` is an authorable field with no
  default. With it empty the form announces "Subscription is not configured yet."
  and transmits nothing. **No URL was invented.**
- **`icons/announcement.svg` is missing** (cmp-004). The other seven icons were
  extracted from inline SVGs in the capture; this one is a remote Scene7 raster
  in the source, so there is nothing to extract. Currently 404s.
- **Social and CPRA icons are missing** (footer): `x`, `facebook`, `linkedin`,
  `instagram`, `youtube` (16×16, white artwork — `decorateIcons()` emits `<img>`
  so `currentColor` will not work) and `privacy-options` (30×14, standard CPRA
  badge, not recoloured). These are brand marks; they were not fabricated.
- **OneTrust tenant needs confirming.** `scripts/delayed.js` uses domain script
  `d0fcbdb0-160a-48ef-ae89-6cd26b940beb`, verified present in the captured page
  source. Confirm it is the right tenant for this project before production.
- **The login form posts cross-origin and needs a security review.** The
  endpoint *is* known — it is in the capture
  (`POST https://www.mynyl.newyorklife.com/VSCRegWebApp/securelogin`, fields
  `myNylUserName` / `myNylPassword` / `RememberUserName`) and was **not**
  hardcoded: it is authored through `/nav` section 6, so the block ships with
  no endpoint baked in. But it is a cross-origin POST to a non-EDS host and
  `head.html` currently sets no `form-action` CSP directive (only `script-src`,
  `base-uri`, `object-src`). **This needs a security/CSP review before it is
  pointed at production.** The source also disables submit until both fields
  are filled; that was not replicated — native `required` is used instead.
- **Mega-menu drawer interiors are unverified against the source.** The capture
  has every drawer closed, so the footnote band colour and the active-category
  highlight are a reading of the token set, not measured values.
- **Mobile nav is an accordion, not the source's sliding drill-down.** Same
  information architecture, substantially less JavaScript, simpler keyboard and
  screen-reader behaviour. Flag if the slide-in panels are a requirement.
- **Fixture images are placeholders.** `drafts/media/*.png` are generated
  gradients under 1KB. They exist to make geometry measurable, not to match the
  source art.

### Deliberate deviations

- **Breakpoints snapped to the project's set** (600/900/1200) rather than the
  source's (575/1023). Verified at the union of both, so nothing is untested,
  but the layout switches at different widths than the source.
- **Content width is the project's 1200px container** (1264px including padding
  at 1440). The source runs ~1280px. Blocks therefore start at x=120 rather than
  the source's x≈80. Changing this means changing the global container, not the
  blocks.
- **`--link-color` now points at `--brand-blue` (#0468ff)** rather than the
  boilerplate `#3b63fb`, so there is one blue rather than two near-identical
  ones. `--text-color` was reused as-is for the captured `#17181c`.
- **A fixed 7:4 image ratio on card grids is intentional** — a card grid wants
  one uniform strip. It is the documented exception, and it is *not* applied to
  the hero, where the authored image keeps its intrinsic ratio.

## 7. Not covered

**The mapping is home-page-only and under-samples the site (xc-4).** Absent from
home but widespread elsewhere: breadcrumb (307 pages), accordion (134), table
(46), video (12). Finalising the block architecture on this mapping alone misses
roughly a third of the design system. The public block-collection already ships
accordion, table, video, carousel, tabs, quote and embed, so that third is
likely mostly reuse — but it should be detected over a representative article
and product page before these verdicts are treated as settled.

Also outstanding:
- **No author-instance render.** The UE surface was verified with a hand-built
  fixture derived from the model field groups, not against a real editor.
- **Header and footer have no editor-shaped fixture** — both come from fragments
  via `getMetadata`/`loadFragment`, not from block models.
- **Page-level assembly** (`eds-page-assemble`) has not been run; the fixture
  composes the page body but the real header and footer fragments do not exist
  yet.
