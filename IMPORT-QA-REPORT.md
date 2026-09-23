# Import transform — QA report

Transform: `tools/importer/import.js`
Harness: `npm run import:qa -- <page>...` (`tools/importer/qa.mjs`)
Corpus sweep: `node tools/importer/sweep.mjs` (new this pass)
Scope: **the full corpus — all 1,221 captured pages**, plus the same 15-page
sample as the previous pass (home, about, product, article, careers) kept
for per-page detail.

> **Gate status: still PENDING, and now carrying more weight.**
> `capture/home/mapping.json` records no approval, and this pass changed
> things the mapping does not cover — a new `pull-quote` block, an `image`
> field on `teaser`, and a change to how card grids are classified. Those
> are content-model decisions, not transform details. See §6.

## 1. Result

**All 1,221 captured pages convert end to end. Zero failures.** The 15-page
sample is 15 of 15, up from 9 of 15. Section band styles now actually reach
the JCR — they did not before, on any page, ever (§2.1).

| | before | after |
|---|---|---|
| **full corpus converting** | ~81% (19% failing) | **1221 / 1221 (100%)** |
| sample pages converting | 9 / 15 | **15 / 15** |
| pages whose band styles survive | 0 | **all** |
| blockquote pages convertible (B4) | 0 of 66 | **66 of 66** |
| data-table pages convertible (B1) | 0 of 92 | **96 of 96** |
| teaser images preserved | 0 of 168 | **168 of 168** |
| pages losing any link | — | **2 of 1221 (0.2%)**, both explained |

The corpus number is the one that matters, and it is new: no previous pass
ever completed a full sweep. §3 has the breakdown.

| block | kind | rows × cells | verified on |
|---|---|---|---|
| `hero-billboard` | simple | 3 × 1 — image / copy / cta | 12 pages |
| `announcement-banner` | simple | 3 × 1 — icon / copy / link | home |
| `feature-highlight-band` | simple | 4 × 1 — image / copy / highlights / cta | home |
| `cta-banner` | simple | 2 × 1 — copy / cta | home |
| `teaser` | simple | 3 × 1 — **image** / copy / link | 5 pages |
| `callout` | simple | 1 × 1 — copy | 2 pages |
| `pull-quote` | simple | 3 × 1 — quote / attribution / role | 3 pages |
| `video` | simple | 3 × 1 — url / poster / title | 6 pages |
| `table` | simple | 2 × 1 — table / caption | 4 pages |
| `form` | simple | 2 × 1 — (empty) / path | 4 pages |
| `feature-card` | container | N × 3 — image \| copy \| link | 11 pages |
| `product-card` | container | N × 2 — copy \| link | 5 pages |
| `icon-list-card` | container | N × 2 — icon \| copy | 9 pages |
| `icon-link-card` | container | N × 3 — icon \| copy \| link | home |
| `accordion` | container | N × 2 — title \| content | 7 pages |

The contract is asserted against the model partials at run time, so a model
change that is not mirrored in the transform fails the harness.

## 2. Bugs this pass caught and fixed

Four of these were **silent**: every prior check passed while content was
being lost. That is the common thread and it is worth stating plainly — a
transform that emits the right number of rows and cells can still be
throwing content away, and until this pass nothing looked past the shape.

### 2.1 Every section band style was being dropped — on every page

**Symptom.** None. The transform emitted its `Section Metadata` tables, the
markdown was textbook-correct, `md2jcr` reported success, the contract
checks passed, and the QA report said 9 pages converted. The bands simply
were not in the JCR:

```xml
<section_1 … model="section" modelFields="[name,style]">   <!-- no style= -->
```

**Root cause.** `md2jcr` resolves a metadata key against the section model
with `model.fields.find((f) => f.name === key)` — an exact, case-sensitive
comparison with no normalisation ([`section-helper.js`][sh]). The transform
emitted the key as `Style`, title-cased, which is the convention for
*document* authoring. The model field is `style`. The row matched nothing
and was discarded.

What makes it silent is that the table's own *header* **is** normalised
(`normalizeString` → `section-metadata`), so the metadata table is found
and then every row inside it is thrown away. There is no error anywhere.

**Fix.** Emit the key as `style`. Verified in the JCR:

```
home:   [navy,angled]  [green]
about:  [green,angled]
```

**Blast radius.** This is the whole of mapping item xc-2 — the navy, green
and angled bands that the mapping deliberately modelled as section styles
rather than block options. Every one of them, on every page, was being
thrown away. The `styles.css` rules for `main > .section.navy` and
`.section.green` have never once matched imported content.

The harness now reads section styles back out of the JCR and fails when
more `Section Metadata` tables are emitted than styles land.

[sh]: node_modules/@adobe/helix-md2jcr/src/mdast2jcr/hb/helpers/section-helper.js

### 2.2 Teaser images were dropped — 135 pages, 168 images

**Symptom.** `DROPPED IMAGES` on `about`, and the contract check passing
anyway.

**Root cause.** Not a transform bug but a **model gap**, which is why the
contract check could not see it. `blocks/teaser/_teaser.json` had no image
field at all, so the derived contract was 2 rows, the transform emitted 2
rows, and the two agreed with each other about a model that did not
describe the content. The source teaser is an image+text band: 168 images
across 135 pages, `cmp-teaser__image--right` on 60 of them.

**Fix.** Added `image` + `imageAlt` to the model (leading, so the row order
is image/copy/link), taught the transform to emit the row — including when
empty, since about half the teasers are text-only — and added the layout to
the block. Also added the `dark` band variant: `cmp-teaser__dark-blue` is
on 123 pages and was being silently flattened into the default treatment.

### 2.3 `md2jcr` cannot convert `<blockquote>` — 66 pages aborting (B4, cleared)

**Symptom.** `Element 'blockquote' is currently not supported.` and the
**entire page** fails — blocks and body copy alike.

**Root cause.** All 67 instances in the corpus are one component,
`cmp-pull-quote`, and the transform claimed none of them, so the raw
`<blockquote>` reached the converter.

**Fix.** New `blocks/pull-quote/`. The markup is unusually uniform — the
`<blockquote>` class string is byte-identical across all 67 — so the
transform is a single selector. 22 of the 67 carry an attribution and 12 of
those a separate role line; both are preserved. Three colour variants map
to block options. The source's decorative quote `<svg>` and its
always-emitted empty attribution scaffold are dropped.

A **safety net** was added alongside it: any `<blockquote>` that somehow
reaches the end of the transform is flattened to paragraphs and reported,
rather than being allowed to take the page down. The cost of being wrong
here is a whole page, not one component.

### 2.4 A model naming collision that mimics a markdown error

Worth recording because it is the *second* time this exact class of bug has
appeared (§2.0 of the previous report was the first).

The pull-quote model originally named its two credit fields `attribution`
and `attributionTitle`. The import failed with the same misleading message
as before:

```
Pull Quote (highlighted) has errors!
The content isn't mapping to the model correctly, likely due to the import
script generating incompatible markdown.
```

Again not a markdown problem. A `*Title` suffix is a **companion**
convention (it is the link-`title` attribute pattern), so `attributionTitle`
was collapsed into `attribution`'s cell — and two independent text values
cannot both be read out of one cell. Renaming the field to `role` gives it
its own group and its own row.

**The general rule, now written into the block:** companion suffixes
(`Alt`, `Text`, `Type`, `Title`, `MimeType`) are reserved. A field that is
an independent value must not end in one, however natural the name reads.

### 2.5 Card grids were classified wrongly, twice over

`cardKind()` had two independent defects, each losing different content.

**It tested `linked` before the media type,** so *any* card without a link
went to `Icon List Card` — a model whose media field is an `icon` and which
has no image field at all. A card with a photograph and no link therefore
had the photograph dropped on the floor. Caught on `/about/partnerships`,
where all three partner logos (MLB, US Soccer, Yankees) vanished.

**It classified the whole grid from `cards[0]`,** and source grids are not
homogeneous. `/newsroom/get-to-know-ching-wang` opens with an unlinked
"About GMAD" text box followed by three linked article cards; the grid was
typed from the box, mapped to a model with no `link` field, and all three
article links were silently dropped.

**Fix.** Classify across every card in the grid, and take the **most
capable** shape present. That asymmetry is the point: every `link` and
media group is optional, so a card missing one contributes an empty cell,
whereas a model without the field has nowhere to put the content and
discards it. Mixed photograph/icon grids now warn rather than guess.

### 2.6 Two components imported as something worse than nothing

- **Ceros embeds (31 pages)** were removed with no warning by the `iframe`
  rule, alongside the analytics beacons. They are the content of the
  section they sit in. Still removed — the experience lives on Ceros and
  cannot be imported — but now reported per page with the source URL.
- **Accumulation-unit-value tables (44 pages)** were being swept into
  static `Table` blocks by `tableBlock()`. These are a live market-data
  feed headed *"As of 09/21/2026"*. Freezing one day of fund prices into a
  page that will never update, and that no author can correct, is worse
  than not importing it. Now excluded and reported.

### 2.7 Standalone images and buttons

`cmp-image` (671 pages) and `cmp-button` (326 pages) outside any block were
passed through untouched. Images kept their three art-directed `<source>`
variants, which Edge Delivery regenerates itself; buttons kept their label
buried in a nested span, so `decorateButtons()` would not render them.
Both now run through the existing `imageFrom()` / `buttonFrom()` helpers.

Buttons carrying `data-bs-toggle="modal"` open a dialog rather than
navigating; they import as plain links and are reported, because the dialog
is a design decision nobody has made yet.

**This fix introduced a regression, which the corpus sweep caught.**
`imageFrom()` returns a bare `<img>`, and a standalone image is often a
*linked* logo — the nine bereavement-partner logos on
`/foundation/kais-journey` are each an `<a>` wrapping the `<picture>`.
Replacing the component with the bare image destroyed all nine links. The
standalone pass now carries the anchor over explicitly. (The case does not
arise inside a block, where the link is its own model field — which is
exactly why it was easy to miss.)

### 2.8 Adaptive Form fieldsets are now reported, not just discarded

Forms import as a placeholder pointing at a `/forms/*.json` that a human
must write, because the field list lives in the Adaptive Form model rather
than the page. But the **fieldset headings** are in the page, and they are
the form's structure. They were being dropped with the rest of the
container — correct, since they belong in the definition and not on the
page, but they are precisely what the person writing that definition needs.

Each form now reports them in order:

```
Source fieldsets, in order: Personal information | Submitter personal
information | Claimant personal information | Employment information |
Work schedule | Claim dates | Type of claim | Illness | Accident or
injury | Maternity | Surgery | Facility information | Provider
information | Disclosure authorization | Additional information
```

This also explains most of the corpus-wide "dropped headings" figure: it is
dominated by form pages, where the loss is intended.

## 3. Corpus sweep — all 1,221 pages

`tools/importer/sweep.mjs` is new. The previous pass stopped a full-corpus
run at 200 of 1,222 pages, reported ~19% failing, and noted that a third
failure class probably existed in the tail. There is no tail:

```
pages scored: 1221
passed:       1221 (100.0%)
failed:       0 (0.0%)

failure classes:            (none)
```

### Block coverage

| block | pages | % |
|---|---|---|
| `feature-card` | 475 | 38.9% |
| `teaser` | 301 | 24.7% |
| `hero-billboard` | 247 | 20.2% |
| `product-card` | 245 | 20.1% |
| `accordion` | 240 | 19.7% |
| `form` | 226 | 18.5% |
| `icon-list-card` | 175 | 14.3% |
| `table` | 96 | 7.9% |
| `video` | 77 | 6.3% |
| `callout` | 71 | 5.8% |
| `pull-quote` | 66 | 5.4% |
| `cta-banner` | 13 | 1.1% |
| `icon-link-card` | 8 | 0.7% |
| `feature-highlight-band` | 3 | 0.2% |
| `announcement-banner` | 1 | 0.1% |

### Content fidelity

| measure | pages | % | assessment |
|---|---|---|---|
| losing links | 2 | 0.2% | both explained below |
| empty icon cells | 103 | 8.4% | **blocker B2**, unchanged |
| dropping images | 1 | 0.1% | a 24×24 tooltip icon, not content |
| dropping headings | 66 | 5.4% | Adaptive Form fieldset titles — by design (§2.8) |

Every remaining loss was chased to a cause rather than left as a number:

- **`contact-us--ccpa-request-form` (3 links)** — a phone number and two
  mailto addresses inside an Adaptive Form container, which imports as a
  placeholder by design. The form must be hand-authored regardless.
- **`advanced-planning-group--our-team` (1 link)** — a hero with **two**
  CTAs where the model holds one. Only 4 of the 89 heroes with a CTA do
  this, so it is not worth a model change, but it now warns with the exact
  label and href so the second action can be re-authored rather than
  quietly lost.
- **`products--investments--exchange-traded-funds` (1 image)** — a 24×24
  `Info-icon` from a tooltip. The harness suppresses `/is/content/…icon-`
  paths as icons; this one is `/is/image/…Info-icon`. Left unsuppressed
  deliberately: broadening the pattern to catch it would start hiding real
  image losses, and one known benign hit is the cheaper error.

The 66 heading-loss pages are the one figure worth reading carefully. They
are form fieldset titles, which *should* leave the page — but they are the
structure of the form somebody now has to author, so §2.8 reports them per
page instead of discarding them.

## 4. Known degradations — content preserved, presentation lost

| component | reach | behaviour |
|---|---|---|
| `cmp-text` | 1206 pages (99%) | falls through to default content. Headings and links survive; the source's presentational `.article-body` / `.text__*` spans are not unwrapped the way `richFrom()` does inside blocks |
| `cmp-separator` | 637 pages (52%) | decorative rules. **Checked, and benign** — see §5 |
| `cmp-experiencefragment` | 408 pages (33%) | only `--navigation` and `--global-footer` are stripped. Sub-brand navs and footers (GBS, The Assist, structured settlements) still inline as page content, as do ~290 pages of agent contact cards that should be Fragments |
| breadcrumb | 1083 pages (89%) | stripped by design; belongs in `/nav` |
| `cmp-content-list` | 74 pages (6%) | unclaimed; imports as an image plus a flat list |
| `cmp-email-subscribe` inline | 82 pages (7%) | the transform assumes this only lives in the footer fragment. On 82 pages it is in the body and imports as loose text |
| hero variants | `dark-blue-pretitle-white` 87, `compact` 40, `ultralight-gray` 11 | all map to plain `hero-billboard`; fields are identical, only the treatment differs. Reported per page |

## 5. Claims checked and rejected

Recorded because acting on them would have been expensive and wrong.

- **"`cmp-separator` shatters pages into sections."** The reasoning was
  sound — 1,301 `<hr>` elements, and the importer renders `<hr>` as `---`,
  which is an Edge Delivery section break. Measured instead of assumed:
  `about-privacy-nyl-online-privacy-policy` has **36 separators and emits
  exactly 1 section**. The separators do not survive to the markdown. No
  fix needed, and stripping them (the obvious "fix") would have been a
  change with no effect, dressed up as a correctness win.

The general point: two of the highest-severity items in this pass were
found by measuring the JCR output, and the highest-severity item that
turned out to be false was found the same way. Row and cell counts are not
evidence that content survived.

### The corpus re-slugged mid-pass

Worth knowing before anyone tries to reproduce these numbers. The crawler's
slug scheme changed during this work (`/` used to collapse to `-`, now to
`--`), and `prune-captures.mjs` retired each superseded directory as its
page was re-crawled. Nothing was lost: the analysis artifacts moved with
it (`capture/home/` is now `capture/index/`, mapping and inventory intact),
and the corpus is 1,221 captures — 1,195 under the new scheme plus 26
top-level pages whose slug is identical either way.

But the first full sweep was pinned to single-dash slugs and had them
retired underneath it, so **547 pages reported as failures that were
really just directories that had stopped existing** — with an empty
failure-class histogram, because there was nothing to say about any of
them. Two fixes: the sweep now selects captures by the presence of
`dom.json` rather than by slug shape, and it counts "no report" as
*skipped* rather than *failed*. A 44.7% failure rate with no failure
classes should have been self-evidently a harness bug, and it is now
impossible to report one.

**Page names in §1 and §3 use the current scheme.** The previous report's
names (`products-insurance-term-life`) no longer resolve; the equivalent is
`products--insurance--term-life`.

## 6. Decisions for the reviewer

The first three are new this pass and were made in order to clear blockers.
All are reversible; none has been approved.

1. **`pull-quote` as a new block** (§2.3). The alternative was flattening
   quotes to paragraphs, which clears the blocker in a few lines but
   discards the attribution on 22 pages and the role line on 12. Built as a
   block because the markup is perfectly uniform and the repo's own
   `coverage.mjs` already declared it `NEW BLOCK NEEDED`.
2. **`image` on the `teaser` model** (§2.2). This changes an approved block
   contract from 2 rows to 3. It is the only way the 168 teaser images
   survive, but it is a model change and belongs at the gate.
3. **Card classification now keys on media type, not link** (§2.5). Fixes
   real image loss, and changes which block some existing grids map to —
   unlinked picture cards now become `feature-card` with an empty link
   rather than `icon-list-card`.
4. **Still open from the previous pass:** the four `REVIEWER DECISION`
   items in `capture/home/mapping.json` (cmp-004, cmp-008, cmp-010,
   cmp-011) have never been formally settled.

## 7. Blockers remaining before a bulk run

**B2 — unnamed card icons (103 pages, 8.4%).** Unchanged and now the
largest open item. Only the 14 fingerprinted icons resolve; every other
inline `<svg>` produces an **empty icon cell**. (The previous report's
"533 pages" was an estimate from the inventory; the sweep measures the
actual reach at 103 pages.) The source inlines unnamed SVGs,
so the token must be looked up by artwork fingerprint, and the site ships
slightly translated variants of the same artwork (`heartbeat` appears as
both `0 0 49 44|M28.5469 21.9809…` and `0 0 49 48|M28.5469 23.9804…`), so
exact fingerprinting will keep missing them. Needs the SVGs extracted,
named by a human, dropped into `/icons/`, and `npm run import:icons` re-run.
Converts fine, fails silently, expensive to find later.

**B5 — `/nav` and `/footer` fragment documents do not exist.** Header,
footer and `email-subscribe` are deliberately not imported per page. The
fragment documents they need have still not been authored.

**B6 — Adaptive Forms import as placeholders.** The field list lives in the
Adaptive Form model, not the rendered page, so it cannot be derived. Each
emits a `Form` block pointing at a `/forms/*.json` that a human must write.

Cleared this pass: **B1** (`Table`, 92 pages) and **B4** (`blockquote`,
66 pages) — both previously aborted the whole page.

## 8. How to re-run

```bash
npm run build:json            # ALWAYS first if any _<block>.json changed
npm run import:qa -- home about products-insurance-term-life
node tools/importer/sweep.mjs # full corpus, ~1h, unattended
npm run import:icons          # regenerate the icon fingerprint map
```

`md2jcr` reads the **aggregated** `component-*.json` at the repo root, not
the per-block partials. Editing a partial without re-running
`npm run build:json` converts against the old shape.

## 9. Recommendation

**Do not start a bulk import yet — but the transform is no longer the
reason.** Every one of the 1,221 captured pages converts, with two pages
losing a link between them and both losses understood. What is left is
authoring and approval, not transform work.

Clear first, in order:

1. **The gate itself (§6).** Three model-level decisions were made this
   pass to clear blockers. Importing 1,221 pages against unapproved model
   changes is the expensive mistake available here — re-importing is
   cheap now and will not be once authors have edited the output.
2. **B2 (103 pages, 8.4%).** Converts cleanly, leaves the `icon` property
   empty. Silent, and the most expensive remaining item to discover after
   the fact.
3. **B5.** Every imported page will be missing its header and footer until
   `/nav` and `/footer` exist.

### What this pass was actually about

Eight defects, and the four most serious were **silent** — the transform
emitted the right number of rows and cells, `md2jcr` reported success, and
content was being discarded anyway. Section bands had never once survived
an import. Teaser images had never survived. Card grids were losing
photographs and links depending on which card happened to be first.

Three methodological notes, because they are more reusable than the fixes:

- **Structure is not fidelity.** Every silent defect passed the row/cell
  contract check. They surfaced only once the harness started reading
  values back *out of the JCR* — section styles, field-by-field. That check
  now exists and fails loudly.
- **The sample could not have found them all.** The linked-logo regression
  in §2.7 was introduced *by this pass*, affected 9 links on one page, and
  was caught by the full-corpus sweep. A 15-page sample is a smoke test,
  not evidence.
- **One high-severity claim was false.** `cmp-separator` was reported as
  shattering 52% of pages into sections; measured, 36 separators produce 1
  section (§5). Two of the real findings and the one false alarm were all
  settled the same way — by measuring output rather than reasoning about
  it.
