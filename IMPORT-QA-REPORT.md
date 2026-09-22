# Import transform — QA report

Transform: `tools/importer/import.js`
Harness: `npm run import:qa -- <page>...` (`tools/importer/qa.mjs`)
Sample: 15 captured pages across 5 templates (home, about, product, article, careers).

> **Gate status inherited, not cleared.** `capture/mapping.json` still records
> `human_gate.status: "PENDING"`. This transform was written against
> `MIGRATION-HANDOFF.md`, which documents the four REVIEWER DECISION items
> being settled *against* the mapping's recommendation (one block per
> component, no card consolidation). The block models and the handoff's
> §3 contract table agree with each other, and the transform was derived
> from the models — but the underlying mapping was never formally approved.

## 1. Result

**15 of 15 sample pages pass the contract check. Zero link loss on every
page.** Every emitted block matches the row/cell structure derived
independently from its own `_<block>.json` model partial.

| block | kind | rows × cells | verified on |
|---|---|---|---|
| `hero-billboard` | simple | 3 × 1 — image / copy / cta | 12 pages |
| `announcement-banner` | simple | 3 × 1 — icon / copy / link | home |
| `feature-highlight-band` | simple | 4 × 1 — image / copy / highlights / cta | home |
| `cta-banner` | simple | 2 × 1 — copy / cta | home |
| `feature-card` | container | N × 3 — image \| copy \| link | 9 pages |
| `product-card` | container | N × 2 — copy \| link | 6 pages |
| `icon-list-card` | container | N × 2 — icon \| copy | 9 pages |
| `icon-link-card` | container | N × 3 — icon \| copy \| link | home |

The contract is asserted against the models at run time, not hard-coded, so
a model change that is not mirrored in the transform fails the harness.

### Per-page

| page | blocks emitted | links | contract |
|---|---|---|---|
| home | hero, icon-list×3, announcement, product×4 `navy, angled`, feature×3, icon-link×4, highlight-band, feature×3 `green`, cta-banner | 21→21 | OK |
| about | hero, icon-list×3 ×3 grids `green, angled`, feature×3, feature×4 | 11→11 | OK |
| products-insurance-term-life | hero, icon-list×4/×2 `navy`/×3, **table**, feature×4 | 13→13 | OK |
| products-investments | hero, …, **table** | 13→13 | OK |
| articles-employee-benefits | hero, icon-list×3, product×3, feature×3 | 8→8 | OK |
| articles-deferred-income-annuities | hero, cards | 8→8 | OK |
| articles-homeowner | hero, cards | 6→6 | OK |
| articles-living-benefits-rider | hero, **table**, cards | 13→13 | OK |
| articles-building-financial-safety-net | icon-list×1, **table**, feature×3 | 11→11 | OK |
| careers-corporate-internships | hero, product×13, feature×1, product×3 | 10→10 | OK |
| careers-our-culture-inclusion-lgbtq | hero, cards | 4→4 | OK |
| careers-corporate-career-development | hero, cards | 6→6 | OK |
| products-…-employee-whole-life | hero, icon-list×3, **table**, product×2 | 6→6 | OK |
| articles-buying-a-home | hero, cards | 7→7 | OK |
| about-corporate-governance | cards | 19→19 | OK |

## 2. Bugs this QA pass caught and fixed

1. **Richtext descriptions were flattened to plain text, dropping inline
   links.** `copy_description` is a `richtext` field on `icon-list-card`,
   `product-card` and `hero-billboard`, but the transform extracted
   `textContent`. The product pages link "premiums", "beneficiaries",
   "death benefit" and "cash value" into `/resources/glossary` from inside
   card copy — all four were silently lost. Fixed with `richFrom()`, which
   unwraps the source's presentational spans but keeps `<a>`, `<strong>`,
   `<em>` and `<sup>`.
2. **A card grid that also held its section heading was skipped entirely.**
   The guard required *every* grid child to be a card, so cmp-009 — whose
   heading sits in the same grid — produced no block at all. Now only the
   `.card` children are folded in and the heading stays as default content.
3. **The band colour was read wrong.** The source overrides an inline navy
   with an `!important` green in a `<style>` block, so cmp-009's section
   came out `navy` instead of `green`. `getComputedStyle` is not reliable
   here either (the styles are stripped before the transform runs, and
   jsdom reports the inline value), so the cascade is now resolved
   explicitly: `!important` rule → inline → normal rule → computed.
4. **Source data tables would have become garbage blocks.** Any bare
   `<table>` is read by the pipeline as a block whose *first row is the
   block name*, so a comparison table landed as a block called
   `protection-type-what-it-helps-cover-why-it-matters`. They are now
   rewritten as `Table` blocks — deterministic, and matching the
   block-collection contract. See blocker B1.
5. **The OneTrust consent dialog was being imported as page content** —
   ~2,500 characters of cookie policy, three logos and five headings on
   every page. Stripped, along with 8 analytics beacons that would
   otherwise have been downloaded as content assets.
6. **Block headers must be singular.** `toClassName("Feature Cards")` is
   `feature-cards`, which loads nothing. The model partials' definition
   titles are plural for the authoring UI; the table headers deliberately
   are not. The harness fails on any header that does not resolve to a
   block folder.

## 3. Blockers — must clear before a bulk run

**B1 — `blocks/table/` does not exist (92 pages, 8%).**
Data tables are emitted as `Table` blocks, but there is no such block in
the repo, so they will render as undecorated divs and lose tabular
semantics. The public block-collection ships `table`; import it. Until
then the markup is recoverable but not correct.

**B2 — 66 distinct card icons are unnamed (533 pages).**
Only the 8 icon instances on the home page resolve; every other inline SVG
produces an **empty icon cell**. The source inlines unnamed `<svg>`s, so
the token cannot be derived — it has to be looked up by artwork
fingerprint, and only 14 icons have been extracted so far. Worse, the site
ships slightly translated variants of the same artwork (heartbeat appears
as both `0 0 49 44|M28.5469 21.9809…` and `0 0 49 48|M28.5469 23.9804…`),
so exact fingerprinting will keep missing them. This needs the 66 SVGs
extracted, named by a human, dropped into `/icons/`, and
`npm run import:icons` re-run.

**B3 — the mapping's human gate is still PENDING.** See the note at the top.

## 4. Known degradations — content preserved, presentation lost

These are unmapped components (mapping xc-4). Content falls through to
default content, so **nothing is dropped**, but the presentation is flat.

| component | reach | behaviour |
|---|---|---|
| breadcrumb | 1083 pages (89%) | stripped; belongs in the `/nav` fragment per handoff |
| accordion | 240 pages (20%) | flattened to headings + paragraphs, links intact |
| video | 79 pages (6%) | no block; falls through |
| hero variants | `dark-blue-pretitle-white` 87, `compact` 40, `ultralight-gray` 11 | all map to plain `hero-billboard`; the fields are identical, only the treatment differs, and no variant class exists yet. Reported per page as a warning. |

Two components on the **home page itself** are absent from
`capture/home/inventory.json` and therefore from the mapping:
a US Soccer partnership band (h4 + link + logo) and a "Personalized
Guidance" band (eyebrow + h2 + copy + two CTAs). Both degrade to default
content. This is direct evidence for xc-4 — the inventory under-samples
even the page it was built from.

## 5. Inherited accessibility defects — not fixed by the importer

- **`products-insurance-term-life` has 9 feature-matrix checkmark images
  with no `alt`** (`icon-check-filled`). They carry meaning ("included"),
  so they need real alternative text. The importer preserves source alt
  verbatim and does not invent it.
- The US Soccer logo on home has `alt=""`.

## 6. Scope decisions

- **Header, footer and `email-subscribe` are not imported per page.** They
  are page chrome, authored once as the `/nav` and `/footer` fragment
  documents. `email-subscribe` (1038 pages, 85%) is nested inside the
  footer XF, so importing it per page would duplicate it across the site.
  The fragment documents still need authoring — they do not exist yet.
- **Bands are section metadata, not block options** (mapping xc-2), so
  `navy`, `green` and `angled` are emitted as `Section Metadata` tables.
- `feature-highlight-band` paints its own band, so it gets no section style.

## 7. How to re-run

```bash
npm run import:qa -- home about products-insurance-term-life
npm run import:icons          # regenerate the icon fingerprint map
```

`aem-import-helper import` submits the script to the remote Spacecat
service, so the transform cannot be exercised locally through the CLI.
The harness runs it against `capture/<page>/dom.json` with jsdom and a
WebImporter stub that mirrors `DOMUtils.createTable`.

## 8. Recommendation

Do **not** start a bulk import yet. B1 and B2 both produce silently wrong
output at scale — empty icon cells on 533 pages and semantically broken
tables on 92. Clear those two, re-run this harness, then import.

The transform itself is ready for the pages it covers.
