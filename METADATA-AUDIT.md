# Bulk Metadata Audit — NYL EDS Migration

**Source:** `capture/` — 1,222 crawled bundles from `https://www.newyorklife.com/sitemap.xml` (crawled 2026‑09‑22, all HTTP 200).
**Method:** parsed `<head>` out of each `capture/<slug>/dom.json` and mapped `final_url` → EDS target path.
**Unique target paths:** 1,200 (22 sitemap URLs are redirects that collapse into 13 existing targets).

> **Why not the query index?** `main--xwalkdemo--rsankar09.aem.live/query-index.json` returns 404 — this repo has
> no published content yet, and `fstab.yaml` still points at the `adobe-rnd/aem-boilerplate-xwalk` mountpoint.
> This audit therefore profiles the **migration source** so the bulk sheet is ready on day one of content load.

---

## Summary statistics

| Property | Present | Missing | Coverage |
|---|---:|---:|---:|
| `title` | 1200 | 0 | 100.0% |
| `canonical` | 1200 | 0 | 100.0% |
| `og:type` | 1200 | 0 | 100.0% (all literally `website`) |
| `description` | 1052 | **148** | 87.7% |
| `keywords` | 790 | 410 | 65.8% |
| `og:title` | 271 | 929 | 22.6% |
| `og:description` | 246 | 954 | 20.5% |
| **`og:image`** | **179** | **1021** | **14.9%** |
| `robots` | 2 | 1198 | 0.2% |

Length distribution (deduped):

| | n | too short | OK | too long | median |
|---|---:|---:|---:|---:|---:|
| title | 1200 | 22 (<20) | 829 | **349 (>70)** | 60 |
| description | 1052 | 14 (<50) | 914 | 124 (>170) | 142 |

---

## Issues by severity

### Critical

**1. 1,021 of 1,200 pages have no `og:image` (85%).** Every share of these pages on social or Slack renders
with no preview card. Entire sections have zero coverage:

| Section | Pages | With og:image |
|---|---:|---:|
| `/articles` | 356 | **0** |
| `/group-benefit-solutions` | 121 | **0** |
| `/products` | 105 | **0** |
| `/foundation` | 65 | **0** |
| `/resources` | 24 | **0** |
| `/groupmembership` | 19 | **0** |
| `/communities` | 13 | **0** |
| `/newsroom` | 359 | 176 (49%) |

This is the single highest-value thing bulk metadata can fix — it is exactly the "one default per section" case.

**2. `og:type` is `website` on all 1,200 pages,** including 356 articles and 359 newsroom posts. These should be
`article` for correct rich-result and social treatment.

### High

**3. 148 pages have no description.** Concentrated, not scattered — which makes it tractable:

| Section | Missing | Of |
|---|---:|---:|
| `/newsroom` | 80 | 359 |
| `/foundation` | 17 | 65 |
| `/about` | 11 | 41 |
| `/groupmembership` | 9 | 19 |
| `/my-account` | **8** | **9** |
| `/guaranteed-products` | 4 | 9 |
| `/careers` | 3 | 22 |
| `/articles` | 3 | 356 |
| `/leads-recruiting` | **2** | **2** |
| others (11 sections) | 11 | — |

Full path list in [Appendix A](#appendix-a--pages-missing-a-description).

**4. Five test/junk pages are in the production sitemap and indexable:**

| Path | Title |
|---|---|
| `/test-form-submission` | Test-form-Submission |
| `/address2testrelease3/core-form-test` | core form test |
| `/houston-clinic/thank-you` | Thank You |
| `/leads-recruiting/contact-a-recruiter2` | Contact a Recruiter |
| `/newsroom/love-takes-action-podcast-episode-three-transcript1` | Love Takes Action podcast episode three transcript. |

The last two are duplicate-suffix artifacts (`2`, `1`) of real pages. **Recommendation: do not migrate these at all.**
If they must be carried over, `noindex` them (covered in the sheet below).

### Medium

**5. 349 titles exceed 70 characters** (longest: 215 chars on
`/products/investments/annuities/variable-annuities/auv-nyl-va-and-nyl-flex-prem-va-june-2003`). Worst offenders:
`/newsroom` 190 of 359, `/group-benefit-solutions` 77 of 121, `/products` 42 of 105.

**6. Inconsistent title branding.** Only 565 of 1,200 titles (47%) end in `| New York Life`; 429 have no brand
suffix at all and 206 use a different pipe-delimited tail. Whole subtrees — `/about/privacy/*`,
`/about/financial-information/*` — are unbranded.

**7. 124 descriptions exceed 170 characters** (longest 434 on `/newsroom/podcast-love-takes-action`); four
`/about/financial-information/*-statutory-basis` pages share an identical 430‑char description.

**8. 22 sitemap URLs are redirects.** They resolve into 13 live targets and need redirect rules in the new site,
not metadata. Notably `/careers/financial-professionals` absorbs **8** former community-market landing pages
(`...-african-american-market`, `-chinese-market`, `-korean-market`, `-latino-market`, `-lgbtq-market`,
`-south-asian-market`, `-vietnamese-market`, `-womens-market`). Full list: `.scratch/redirects.json`.

### Low

**9. 14 duplicated titles across 29 pages / 16 duplicated descriptions across 35 pages.** The real ones:

- **Localized pages reuse English metadata** — `/communities/latino`, `latino-es`, `latino-pt` share one title;
  same for `chinese`/`chinese-cn` and `vietnamese`/`vietnamese-vi`. Translated pages should have translated metadata.
- **`/groupmembership/*` vs `/groupmembership/products/*`** duplicate each other (`contact-us`, `our-difference`).
- **Genuinely wrong pairing:** `/articles/etfs-vs-mutual-funds` and `/articles/life-insurance-for-new-parents`
  share a description about ETFs vs mutual funds — one is simply incorrect.
- `/about/privacy/information-security` carries `/careers/our-culture`'s description.
- `/articles/buying-a-home` and `/articles/homeowner` are fully duplicated (title + description).

**10. Canonicals are clean** — 0 mismatches across 1,200 pages. Nothing to do.

---

## Bulk metadata spreadsheet

Paste into a sheet named **metadata** at the site root. Evaluated top‑to‑bottom; later rows win.

| URL | Description | Image | og:type | Robots |
|---|---|---|---|---|
| `/**` | | `/media/og-default-nyl.jpg` | `website` | |
| `/articles/**` | | `/media/og-default-articles.jpg` | `article` | |
| `/newsroom/**` | | `/media/og-default-newsroom.jpg` | `article` | |
| `/foundation/**` | | `/media/og-default-foundation.jpg` | `article` | |
| `/products/**` | | `/media/og-default-products.jpg` | | |
| `/group-benefit-solutions/**` | | `/media/og-default-gbs.jpg` | | |
| `/groupmembership/**` | | `/media/og-default-gbs.jpg` | | |
| `/guaranteed-products/**` | | `/media/og-default-products.jpg` | | |
| `/communities/**` | | `/media/og-default-communities.jpg` | | |
| `/careers/**` | | `/media/og-default-careers.jpg` | | |
| `/about/**` | | `/media/og-default-about.jpg` | | |
| `/resources/**` | | `/media/og-default-resources.jpg` | | |
| `/my-account/**` | Manage your New York Life policies, payments, and account settings online. | `/media/og-default-about.jpg` | | |
| `/leads-recruiting/**` | Explore a career as a New York Life financial professional and connect with a recruiter. | `/media/og-default-careers.jpg` | | |
| `/drafts/**` | | | | `noindex, nofollow` |
| `/test-form-submission` | | | | `noindex, nofollow` |
| `/address2testrelease3/**` | | | | `noindex, nofollow` |
| `/houston-clinic/thank-you` | | | | `noindex, nofollow` |
| `/leads-recruiting/contact-a-recruiter2` | | | | `noindex, nofollow` |
| `/newsroom/love-takes-action-podcast-episode-three-transcript1` | | | | `noindex, nofollow` |

A tab-separated copy ready to paste is at **`.scratch/metadata-bulk.tsv`**.

### Why these rows and not others

- **`/**` first** sets the safety-net og:image so no page can ever share without a card, then each section
  overrides it. That ordering is what makes 20 rows cover 1,200 pages.
- **`og:type` is only overridden for editorial sections.** `/products` and the rest correctly stay `website`
  via the site-wide row.
- **Only two `Description` values appear**, for `/my-account` (8 of 9 missing) and `/leads-recruiting`
  (2 of 2 missing) — sections where essentially every page lacks one, so a section default is genuinely better
  than nothing. The other 138 missing descriptions are in sections where most pages *do* have one; a shared
  default there would be worse than the gap, because it would look duplicated to a crawler. **Author those per page.**
- **No `Title` column at all.** Every one of the 1,200 pages has a page-level title, and page-level always
  wins — a bulk title column would be dead weight in every row. See the next section.

### What bulk metadata cannot fix here

These four findings need page-level or code changes, **not** the sheet:

| Finding | Where to fix |
|---|---|
| 349 over-length titles | Page metadata table in each source document |
| 635 titles missing `| New York Life` | Page metadata tables, or append centrally in `scripts.js` |
| 124 over-length descriptions | Page metadata table in each source document |
| Wrong/duplicated descriptions (e.g. `/articles/etfs-vs-mutual-funds`) | Page metadata table |

The brand-suffix problem is the one worth doing in code: appending ` | New York Life` in `scripts.js` when the
title does not already end with it fixes 635 pages without touching 635 documents.

### Assets you must create first

The sheet references 10 og:image paths that **do not exist yet**. Before publishing it, upload a 1200×630 image
for each, or point several rows at one shared default:

```
/media/og-default-nyl.jpg          (site-wide fallback — required)
/media/og-default-articles.jpg     /media/og-default-newsroom.jpg
/media/og-default-foundation.jpg   /media/og-default-products.jpg
/media/og-default-gbs.jpg          /media/og-default-communities.jpg
/media/og-default-careers.jpg      /media/og-default-about.jpg
/media/og-default-resources.jpg
```

Minimum viable version: ship the `/**` row alone pointing at `/media/og-default-nyl.jpg`. That takes og:image
coverage from 14.9% to 100% with one row, and the section rows can land later.

---

## Implementation

1. Create a Google Sheet (or `metadata.xlsx`) named **metadata** in the site root — the folder holding `nav`
   and `footer`.
2. Paste `.scratch/metadata-bulk.tsv`. Row 1 must be the header row.
3. Upload the og:image assets listed above.
4. Open AEM Sidekick on the sheet → **Preview** → **Publish**.

### Verification

```bash
curl -s https://main--xwalkdemo--rsankar09.aem.live/metadata.json | jq '.data[0:5]'
curl -s https://main--xwalkdemo--rsankar09.aem.live/articles/401k-contribution-limits \
  | grep -iE 'og:(image|type)'
```

Expect `og:image` and `og:type: article` on the articles page. If a value does not appear, the page's own
metadata table is setting it — page-level always wins, and that is correct behavior.

---

## Appendix A — pages missing a description

**/newsroom** — 80 pages

- /newsroom/2022/2021-record-financial-results
- /newsroom/2022/brave-of-heart-fund-supports-healthcare-community
- /newsroom/2022/craig-desanto-assumes-position-of-ceo
- /newsroom/2022/foundation-releases-state-of-grief-report
- /newsroom/2022/love-takes-action-podcast-series-launches
- /newsroom/2022/new-york-life-contributes-hurricane-ian-relief
- /newsroom/2022/new-york-life-donates-to-eastern-ky-flood-victims
- /newsroom/2022/new-york-life-launches-wealth-plus
- /newsroom/2022/new-york-life-names-michael-mcdonnell-general-counsel
- /newsroom/2022/new-york-life-partners-with-humanapi
- /newsroom/2022/newyorklife-maintains-highest-possible-financial-strength-ratings
- /newsroom/2022/thomas-schievelbein-appointed-lead-director
- /newsroom/2022/todd-taylor-head-of-retail-annuities
- /newsroom/2022/ukraine-grant-disaster-relief
- /newsroom/2022/wealth-watch-impact-of-inflation
- /newsroom/2022/wealth-watch-inflation-americans-adjust-debt-investment-strategy
- /newsroom/2023/hear-about-our-new-term-life-product-suite
- /newsroom/2023/joanne-rodgers-appointed-to-emc
- /newsroom/2023/mental-health-employees-bear-caregiving-burden
- /newsroom/2023/naim-abou-jaoude-named-ceo-of-nylim
- /newsroom/2023/new-york-life-declares-company-record
- /newsroom/2023/new-york-life-hires-industry-veteran-don-vu-as-chief-data-and-an
- /newsroom/2023/new-york-life-launches-2022-corporate-responsibility-report
- /newsroom/2023/new-york-life-launches-hybrid-digital-investment-tool-to-address
- /newsroom/2023/newyorklife-contributes-to-earthquake-relief-in-turkey-and-syria
- /newsroom/2023/nyl-commits-to-momentus-capital
- /newsroom/2023/nyl-contribution-to-communities-impacted-by-wildfire
- /newsroom/2023/out-of-school-time-programs-to-help-middle-school-students
- /newsroom/2023/sandi-tillotson-appointed-chief-compliance-officer
- /newsroom/2023/term-life-product-suite
- /newsroom/2023/tornado-relief-support-arkansas
- /newsroom/2023/wealth-watch-financial-differences-in-families
- /newsroom/2023/wealth-watch-survey-sandwich-generation-unable-to-meet-expenses-due-to-caregiving
- /newsroom/2024/record-2023-results-demonstrate-financial-strength
- /newsroom/2024/two-new-leaders-appointed-to-new-york-life-executive-management-committee
- /newsroom/2025/nyl-enters-2025-with-industry-leading-financial-strength-ratings
- /newsroom/2026/New-York-Life-enhances-Survivorship-Variable-Universal-Life
- /newsroom/2026/wealth-watch-financial-confidence-coaching
- /newsroom/NYL-Foundation-Sesame-Workshop-join-forces-to-bring-healing
- /newsroom/NYL-women-in-data-science-technology-VC-reflect-on-careers
- /newsroom/black-history-month-celebrating-diversity
- /newsroom/commitment-to-communities
- /newsroom/company-financial-strength
- /newsroom/corporate-responsibility-stories
- /newsroom/employee-stories-archive
- /newsroom/employees-financial-wellbeing-boosted-with-benefits
- /newsroom/executive-biographies/aaron-ball-bio
- /newsroom/executive-biographies/amy-miller-bio
- /newsroom/executive-biographies/craig-desanto-bio
- /newsroom/executive-biographies/mike-mcdonnell-bio
- /newsroom/executive-biographies/sonali-virendra
- /newsroom/featured-awards/industry-awards
- /newsroom/featured-awards/our-awards-and-recognition
- /newsroom/featured-awards/workplace-recognition
- /newsroom/financial-tips-for-the-sandwich-generation1
- /newsroom/foundation-2022-state-of-grief-report
- /newsroom/foundation-inaugural-state-of-grief-report
- /newsroom/from-the-archives-a-soldiers-duty-to-his-family
- /newsroom/hbcu-howard-hampton-university-grant
- /newsroom/history-archive
- /newsroom/history-five-facts-founding-new-york-life
- /newsroom/history-george-perkins-agency-model
- /newsroom/history-of-valuing-equality
- /newsroom/innovation
- /newsroom/ken-drinkard-savoy-influential-black-executives
- /newsroom/love-takes-action-podcast-episode-eight-transcript
- /newsroom/love-takes-action-podcast-episode-five-transcript
- /newsroom/love-takes-action-podcast-episode-four-transcript
- /newsroom/love-takes-action-podcast-episode-one-transcript
- /newsroom/love-takes-action-podcast-episode-seven-transcript
- /newsroom/love-takes-action-podcast-episode-six-transcript
- /newsroom/love-takes-action-podcast-episode-three-transcript
- /newsroom/love-takes-action-podcast-episode-three-transcript1
- /newsroom/love-takes-action-podcast-episode-two-transcript
- /newsroom/media-contact
- /newsroom/new-york-life-built-for-times-like-these
- /newsroom/nylgbs-absence-assist
- /newsroom/press-resources
- /newsroom/press-resources/press-releases
- /newsroom/season-2-love-takes-action-podcast

**/foundation** — 17 pages

- /foundation/bereavement-support/grief-supportive-workplace-initiative
- /foundation/kais-journey/lost-in-the-middle
- /foundation/taking-action/stories-to-inspire/9-11-museum-art-cart-and-anniversary-webinar
- /foundation/taking-action/stories-to-inspire/afterschool-alliance
- /foundation/taking-action/stories-to-inspire/building-resilience
- /foundation/taking-action/stories-to-inspire/conversation-with-mary-fitzgerald
- /foundation/taking-action/stories-to-inspire/foundation-at-work
- /foundation/taking-action/stories-to-inspire/foundation-league-of-yes-home-run
- /foundation/taking-action/stories-to-inspire/gssi-expands-to-workforce
- /foundation/taking-action/stories-to-inspire/partnership-with-storycorps
- /foundation/taking-action/stories-to-inspire/story-corp-mothers-day-launch
- /foundation/taking-action/stories-to-inspire/storycorps-fathers-day-launch
- /foundation/taking-action/stories-to-inspire/summer-learning-tips
- /foundation/taking-action/stories-to-inspire/support-bereaved-children
- /foundation/taking-action/stories-to-inspire/tips-for-how-to-support-grieving-children-on-mothers-day-and-fathers-day
- /foundation/taking-action/stories-to-inspire/volunteer-spotlight-john-bayeux
- /foundation/taking-action/stories-to-inspire/volunteer-spotlight-mark-weller

**/about** — 11 pages

- /about/financial-information/2017-financial-information
- /about/financial-information/2018-financial-information
- /about/financial-information/2019-financial-information
- /about/financial-information/2020-financial-information
- /about/financial-information/2021-financial-information
- /about/financial-information/2021-financial-information-statutory-basis
- /about/financial-information/2024-financial-information-statutory-basis
- /about/financial-information/2025-financial-information-statutory-basis
- /about/financial-information/2026-financial-information-statutory-basis
- /about/partnerships/the-assist
- /about/privacy/service-sms-policy

**/groupmembership** — 9 pages

- /groupmembership/clientresources/five-reasons-to-buy-life-insurance
- /groupmembership/clientresources/what-does-life-insurance-cover
- /groupmembership/contact-us
- /groupmembership/products/accident-health-insurance
- /groupmembership/products/associations
- /groupmembership/products/business-travel
- /groupmembership/products/contact-us
- /groupmembership/products/our-difference
- /groupmembership/products/participant

**/my-account** — 8 pages

- /my-account/forms-life-annuities
- /my-account/forms-long-term-care
- /my-account/forms-traditional
- /my-account/forms-traditional-west
- /my-account/forms-variable-life
- /my-account/idi-forms
- /my-account/password-reset-failed
- /my-account/register-failed

**/guaranteed-products** — 4 pages

- /guaranteed-products
- /guaranteed-products/pension-risk-transfer/annuitant-center
- /guaranteed-products/privacy-policy
- /guaranteed-products/resources

**/articles** — 3 pages

- /articles/gen-x-is-facing-a-retirement-crunch
- /articles/how-to-make-passive-income
- /articles/life-insurance-with-pre-existing-conditions

**/careers** — 3 pages

- /careers/financial-professionals/day-in-the-life/alexa-pao
- /careers/financial-professionals/experienced-professionals
- /careers/financial-professionals/financial-advisor

**/leads-recruiting** — 2 pages

- /leads-recruiting/contact-a-recruiter
- /leads-recruiting/contact-a-recruiter2

**/address2testrelease3** — 1 pages

- /address2testrelease3/core-form-test

**/amn** — 1 pages

- /amn/search

**/communities** — 1 pages

- /communities/dst

**/contact-us** — 1 pages

- /contact-us/ccpa-request-form

**/defined-contribution-retirement-income** — 1 pages

- /defined-contribution-retirement-income

**/group-benefit-solutions** — 1 pages

- /group-benefit-solutions/employers/life-and-add

**/houston-clinic** — 1 pages

- /houston-clinic/thank-you

**/more-powerful-together** — 1 pages

- /more-powerful-together

**/products** — 1 pages

- /products/retirement/lifetime-income-annuity-annual-income-amounts

**/test-form-submission** — 1 pages

- /test-form-submission

**/worksite** — 1 pages

- /worksite
