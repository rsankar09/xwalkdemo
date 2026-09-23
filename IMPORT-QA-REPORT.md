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

**9 of 15 sample pages convert end to end. Zero link loss on every page,
including the 6 that fail.** Every emitted block matches the row/cell
structure derived from its own `_<block>.json` model partial, *and* every
cell lands on the model property it belongs to — now verified by running
the real `md2jcr` converter, not just by counting cells.

The 6 failures are two pre-existing content gaps (`Table`, `blockquote`),
not card-mapping problems. See §3.

> **Revision.** An earlier version of this report claimed 15 of 15. That
> number came from a harness that only counted rows and cells against a
> contract it derived itself — it never ran the converter, so it agreed
> with the transform about a shape that the converter rejected. All four
> container blocks in fact failed to import. §2.0 has the detail; the
> harness now runs `md2jcr` and is the authority.

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

`md2jcr` is the real converter. `links` counts source → imported.

| page | links | md2jcr |
|---|---|---|
| home | 21→21 | OK — 31 nodes, all 8 blocks |
| about | 11→11 | OK — 29 nodes |
| products-insurance-term-life | 13→13 | **FAIL** — `Table` (B1) |
| products-investments | 13→13 | **FAIL** — `Table` (B1) |
| articles-…-employee-benefits-for-small-businesses | 10→10 | **FAIL** — `blockquote` (B4) |
| articles-deferred-income-annuities | 8→8 | OK — 13 nodes |
| articles-homeowner | 6→6 | OK — 19 nodes |
| articles-living-benefits-riders | 7→7 | **FAIL** — `blockquote` (B4) |
| articles-building-financial-safety-net | 11→11 | **FAIL** — `Table` (B1) |
| careers-corporate-internships | 10→10 | OK — 22 nodes |
| careers-our-culture-inclusion-lgbtq-community | 4→4 | OK — 18 nodes |
| careers-corporate-career-development | 6→6 | OK — 17 nodes |
| products-…-employee-whole-life | 6→6 | **FAIL** — `Table` (B1) |
| articles-buying-a-home | 7→7 | OK — 13 nodes |
| about-corporate-governance | 19→19 | OK — but emits **no blocks at all** |

`about-corporate-governance` was previously listed as emitting "cards". It
does not: the transform matches nothing on it and the whole page falls
through to default content. Links survive, presentation does not. This is
another instance of §4 — worth a look before the bulk run.

## 2. Bugs this QA pass caught and fixed

### 2.0 Every container block failed to import — plural definition titles

**Symptom.** The import service rejected the page with:

```
Icon List Card has errors!
The content isn’t mapping to the model correctly, likely due to the import
script generating incompatible markdown. Review the model file and ensure
the import script meets all column and row requirements, every field must
align with a column, even if empty.
```

**Not a column/row problem.** The error message points at the markdown,
and that is a red herring — the table was already the right shape (N rows
× 2 cells, `[icon] | [copy]`, exactly the item model's two field groups).

**Root cause — a component title collision.** `md2jcr` resolves a block
header to a component by an exact match on `title`
(`Definitions.getComponentByTitle`, a plain `find()` over every component
in `component-definition.json`). The block definitions were titled in the
plural and the child items in the singular:

| definition | title (before) | resourceType |
|---|---|---|
| `icon-list-card` | `Icon List Cards` | `…/block` |
| `icon-list-card-item` | `Icon List Card` | `…/block/item` |

The transform emits the header `Icon List Card`, so `find()` returned the
**child item** component. `md2jcr` then treated the container block as a
*simple* block against the item model, handed the row's first cell to
field group 1 (`icon`, one field), and hit the second cell with no fields
left — which is the error above, thrown from `processCell`.

Both halves of that naming were wrong, and each was independently fatal:

- the **item** title collided with the header the transform emits, which
  is what threw;
- the **block** title is also what Universal Editor writes into the block
  node's `name` when an author inserts one, and `toClassName("Icon List
  Cards")` is `icon-list-cards` — a class no block folder answers to. So
  author-created blocks would have silently rendered undecorated, with no
  importer involved at all.

**Fix.** Block title = the block folder in title case; item title = that
plus `Item`. Applied to all four container blocks — `feature-card`,
`product-card`, `icon-list-card`, `icon-link-card` — because all four had
the identical defect. `icon-list-card` was simply the first to be
reported. `blocks/cards/` (from the boilerplate) was already correct:
folder `cards`, block title `Cards`, item title `Card`.

| block folder | block title | item title |
|---|---|---|
| `feature-card` | `Feature Card` | `Feature Card Item` |
| `product-card` | `Product Card` | `Product Card Item` |
| `icon-list-card` | `Icon List Card` | `Icon List Card Item` |
| `icon-link-card` | `Icon Link Card` | `Icon Link Card Item` |

Verified in the emitted JCR — every authored value on the right property:

```xml
<item_0 … model="icon-list-card-item"
  modelFields="[icon,copy_title,copy_titleType,copy_description]"
  icon=":people:"
  copy_title="Dedicated financial expertise"
  copy_titleType="h3"
  copy_description="&lt;p&gt;One of our 12,000+ agents and advisors…&lt;/p&gt;"/>
```

**Why QA missed it.** `tools/importer/qa.mjs` derived the expected row and
cell counts from the model partials and compared them to the transform's
output. Both sides were right; the failure was in a third place neither
looked at — the component *titles*. The harness now also
(a) checks that every block header resolves to a block-level component
rather than a child item, and (b) runs the page through the real
`@adobe/helix-importer` `md2jcr` pipeline, which is the authority. Both
checks fail on the old titles.

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
   `feature-cards`, which loads nothing, so the table headers are singular.
   The definition titles were plural, which is what broke every container
   block — see §2.0. Both are singular now and the harness fails on any
   header that does not resolve to a block folder *and* to a block-level
   component.

## 3. Blockers — must clear before a bulk run

**B1 — `blocks/table/` does not exist (92 pages, 8%). Upgraded: this
aborts the page, it does not degrade.**
Data tables are emitted as `Table` blocks, but there is no such block in
the repo. The earlier assessment — "they will render as undecorated divs"
— was wrong: `md2jcr` throws `The component 'Table' does not exist` and
**the entire page fails to convert**, blocks and default content alike.
4 of the 15 sample pages die this way. Nothing about the page is
recoverable until `blocks/table/` exists with a model. The public
block-collection ships `table`; import it and add an xwalk model partial.

**B4 — `blockquote` is not supported by `md2jcr` (66 pages, 5%; new,
previously unreported).**
`Element 'blockquote' is currently not supported.` Same blast radius as
B1: the whole page fails to convert. 2 of the 15 sample pages. 66 of the
1,222 captures contain a `<blockquote>`, and none of the pages that
convert cleanly contain one, so that count is the reach. The source uses
blockquotes for pull-quotes inside article body copy. Either map them to a
block with a model, or flatten them to paragraphs in the transform and
accept the loss of semantics — that is a content-design call, not a
transform detail, so it needs a decision before the bulk run.

### Corpus-wide failure rate (partial)

A full-corpus sweep was started and stopped at 200 of 1,222 pages:
**162 converted, 38 failed — about 19%.** B1 and B4 together account for
roughly 12% of the corpus, so there is likely a third failure class in the
tail that the 15-page sample does not reach. Re-run the sweep to
completion once B1 and B4 are cleared; it is the only way to find out what
else is in there, and it is cheap to run unattended.

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
npm run build:json            # ALWAYS first if any _<block>.json changed
npm run import:qa -- home about products-insurance-term-life
npm run import:icons          # regenerate the icon fingerprint map
```

`aem-import-helper import` submits the script to the remote Spacecat
service, so the *CLI* cannot exercise the transform locally. The
conversion itself can be: `@adobe/helix-importer` is the library that
service runs, and it is now a devDependency, so the harness runs the
genuine `transformDOM → markdown → md2jcr → JCR` pipeline against
`capture/<page>/dom.json`.

`md2jcr` reads the **aggregated** `component-*.json` at the repo root, not
the per-block partials. Editing a partial without re-running
`npm run build:json` converts against the old shape — and, as §2.0 shows,
the failure surfaces as a message about markdown columns rather than about
models.

## 8. Recommendation

Do **not** start a bulk import yet.

Clear before the bulk run:

- **B1 (`Table`, 92 pages)** and **B4 (`blockquote`)** — both abort the
  whole page. These are now the top priority; they were previously
  believed to degrade gracefully and they do not.
- **B2 (66 unnamed icons, 533 pages)** — converts fine, but leaves the
  `icon` property empty, which is silent and expensive to find later.

Cleared in this pass: the container-block title collision (§2.0), which
was failing 100% of pages carrying any card grid.

The transform itself is ready for the pages it covers: 9 of 15 sample
pages now convert to JCR with every field on the right property, and no
sample page loses a link.
