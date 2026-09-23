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

- Content column: **1288px wide, starting at x=76** on a 1440 viewport.
  Settled by pixel-measuring the product tiles, which are the load-bearing grid:
  four 292px tiles with 40px gutters running x=76 → x=1363.
  Running **text** sits 4px further in, at x=80 — that inset belongs to the
  text, not to the column. Don't build the column around it.
  Global rule on `main > .section > div`:
  `box-sizing: border-box; max-width: 1352px; padding: 0 32px`.
  **The `box-sizing` is load-bearing** — the boilerplate does not set it globally
  (only on `a.button`), so without it `max-width` sizes the *content* area, the
  gutters are added outside it, and the column comes out 1352px at x=44.
  If you mirror this column inside a block, mirror the `box-sizing` too.
- Prose measure: running text is capped at **~880px**, not the full column.
- Buttons: `padding: 12px 32px` + the 2px border = the source's 34px inset.
  Measured on "Get Started": a 150×52 control around an 82px label.
- Border radii, measured per component — **do not apply 18px to cards generally**:
  - product tiles and the announcement band: **4px**
    (the source's own inline CSS: `#container-a45a9ae443 { border-radius: 4px }`)
  - the *image* cards only: **18px** (`#container-710848f31b`, `#container-1991f9d8e4`)
  - buttons **6px**, small links **4px**, everything else `0`
  - **no pill / fully-rounded buttons anywhere in the source**
- Card title line-height is not uniform: the announcement `h4` is 20/**24**,
  the product tile title (`p.text__medium`) is 20/**26**.

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

--card-title-size: 20px          /* card titles: 20/24 w500 at every breakpoint */
--card-title-line-height: 24px
--card-title-weight: 500
--eyebrow-color: #2e3038         /* kicker on a plain section */
--eyebrow-color-on-card: #474952 /* kicker inside a card */
--brand-blue-medium: #04c        /* card arrow glyph */
--brand-blue-dark: #001e94       /* card arrow, hover */
```

Heading line-height is **1.267 below 900px (38/30)** and **1.143 above (48/42)** —
it tightens as the headings grow, so it is not a single ratio.

Eyebrows/kickers are **w500 with 0.1em tracking**, not w700/0.08em.

## The systemic bug to fix

Block CSS across this repo reaches for `--body-font-size-xs` (14px) and `-s` (16px)
for **running body copy**, which the source sets at 18px. That is why every block
renders visibly smaller and tighter than the original. `xs` is for eyebrows, legal
and utility text only.
