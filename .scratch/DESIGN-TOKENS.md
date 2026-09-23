# NYL source design tokens — measured ground truth

Extracted from `capture/index/styles-{375,768,1440}.json` (computed styles of the
live www.newyorklife.com home page). **These are measurements, not guesses — prefer
them over anything already in the CSS.**

## Type

| role | family | size / line-height | weight |
|---|---|---|---|
| body copy | `roboto, Tahoma, sans-serif` | **18px / 26px** at *every* breakpoint | 400 |
| headings | **`alverata, Georgia, serif`** (a light serif, NOT a condensed sans) | h2 `30px/38px` <900, `42px/48px` ≥900 | **300** |
| card heading (h4) | roboto | 20px / 24px | 500 |
| eyebrow / kicker | roboto | 14px / 16–18px, `text-transform: uppercase`, letter-spaced | 500 |
| button label | roboto | 16px / 24px | 600 |
| utility + legal links | roboto | 14px / 20px | 400 (utility) / 600 (legal) |
| footnote `sup` | roboto | 11px | 400 |

Body text color `rgb(23,24,28)` = `#17181c`.

## Geometry

- Content column: **1280px wide, starting at x=80** on a 1440 viewport. (An
  earlier revision of this file said 1288/76 — that was the `aem-Grid` wrapper
  at x=68 w=1304, not the text column. Corrected against `styles-1440.json`.)
  Global rule already set on `main > .section > div`:
  `box-sizing: border-box; max-width: 1344px; padding: 0 32px`.
  **The `box-sizing` is load-bearing** — the boilerplate does not set it globally
  (only on `a.button`), so without it `max-width` sizes the *content* area, the
  gutters are added outside it, and the column comes out 1352px at x=44.
  If you mirror this column inside a block, mirror the `box-sizing` too.
- Prose measure: running text is capped at **~880px**, not the full column.
- Buttons: `padding: 12px 32px` + the 2px border = the source's 34px inset.
  Measured on "Get Started": a 150×52 control around an 82px label.
- Border radii in use, and nothing else: **`0`, `4px` (small links), `6px` (buttons), `18px` (cards)**.
  There are **no pill / fully-rounded buttons anywhere in the source.**

## Global CSS variables now available

```
--heading-font-weight: 300
--heading-line-height: 1.15
--button-font-size: 16px
--button-font-weight: 600
--button-radius: 6px
--card-radius: 18px
--body-font-size-m: 18px   /* body copy — use THIS for running text */
--body-font-size-s: 16px   /* button labels, dense UI */
--body-font-size-xs: 14px  /* eyebrows, legal, utility only */
```

## The systemic bug to fix

Block CSS across this repo reaches for `--body-font-size-xs` (14px) and `-s` (16px)
for **running body copy**, which the source sets at 18px. That is why every block
renders visibly smaller and tighter than the original. `xs` is for eyebrows, legal
and utility text only.
