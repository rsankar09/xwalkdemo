/* global WebImporter */
/*
 * AEM Importer transform for the NYL migration.
 *
 * Target contract: capture/mapping.json + MIGRATION-HANDOFF.md §3.
 *
 * ROW/CELL RULE (xwalk import) — the table mirrors the MODEL, not the page.
 *   Simple block:    one row per property group, each row a SINGLE cell,
 *                    in model order, every row emitted even when empty.
 *   Container block: one row per child item; that item's groups are its cells.
 *   Companion fields (imageAlt, linkText, ctaText, copy_titleType) collapse
 *   into their base property and never get a row or cell of their own.
 *
 * Derived from the model partials in blocks/<name>/_<name>.json:
 *
 *   hero-billboard          3 rows x 1  [image] [copy] [cta]
 *   announcement-banner     3 rows x 1  [icon]  [copy] [link]
 *   feature-highlight-band  4 rows x 1  [image] [copy] [highlights] [cta]
 *   cta-banner              2 rows x 1  [copy]  [cta]
 *   feature-card            N rows x 3  [image] | [copy]        | [link]
 *   product-card            N rows x 2  [copy]  | [link]
 *   icon-list-card          N rows x 2  [icon]  | [copy]
 *   icon-link-card          N rows x 3  [icon]  | [copy]        | [link]
 *
 * Block-name headers are SINGULAR. toClassName() in scripts/aem.js turns the
 * header text into the block class, so "Feature Cards" would resolve to
 * .feature-cards and load nothing. The definition titles in the model
 * partials are plural for the authoring UI only — do not copy them here.
 */

const HEADINGS = 'h1, h2, h3, h4, h5, h6';

/*
 * Inline-SVG icon fingerprints, generated from the extracted /icons/*.svg.
 * The source markup inlines unnamed <svg> elements, so the icon token cannot
 * be derived from the DOM — it has to be looked up. Key is viewBox + the
 * first 32 chars of the first path's `d`; viewBox alone collides
 * (heart and heartbeat are both "0 0 49 44").
 *
 * Regenerate with: node tools/importer/build-icon-map.mjs
 */
const SVG_ICONS = {
  '0 0 48 48|M31.5045 7.89474V9.15321L12.6309': 'announcement',
  '0 0 16 16|M12 5.18286H9.61563V3.5221C9.584': 'facebook',
  '0 0 48 47|M45.6012 7.48634L25.7501 0.37984': 'graduation',
  '0 0 49 44|M5.07312 22.6549C2.96542 20.336 ': 'heart',
  '0 0 49 44|M28.5469 21.9809H37.753C37.8931 ': 'heartbeat',
  '0 0 48 42|M47.7259 12.9105L23.9244 0.09380': 'house',
  '0 0 16 16|M7.99982 3.89429C7.18734 3.89429': 'instagram',
  '0 0 16 16|M0.000488281 2.30658C0.000488281': 'linkedin',
  '0 0 48 40|M29.0263 28.1897C29.4856 27.1972': 'people',
  '0 0 40 48|M39.0803 20.7036H20.474V10.3343C': 'plant',
  '0 0 24 24|M16.9,15.5c2.4-3.2,2.2-7.7-0.7-1': 'search',
  '0 0 38 48|M36.768 24.132H18.2899C18.1788 2': 'strategy',
  '0 0 16 16|M9.321 6.77491L15.1515 0H13.7699': 'x',
  '0 0 16 12|M15.6591 1.75342C15.4723 1.06342': 'youtube',
};

/*
 * Some icons arrive as remote Scene7 rasters rather than inline SVGs
 * (the announcement megaphone is the one on the home page). Matched on a
 * stable fragment of the asset path.
 */
const RASTER_ICONS = [
  ['icon-announcement', 'announcement'],
];

/*
 * Section background colours. Both notations are listed because the value
 * can arrive from getComputedStyle (rgb) or straight out of the stylesheet
 * text (hex).
 */
const BAND_COLORS = {
  'rgb(0, 10, 98)': 'navy',
  '#000a62': 'navy',
  'rgb(1, 99, 85)': 'green',
  '#016355': 'green',
};

/* Collected per page by the transform, reported by the QA harness. */
const warnings = [];

function warn(message) {
  warnings.push(message);
  // eslint-disable-next-line no-console
  console.warn(`[import] ${message}`);
}

/**
 * Collapses whitespace and trims, the way an author would have typed it.
 * @param {Element|string} input Element or string to normalize
 * @returns {string} The normalized text
 */
function text(input) {
  const raw = typeof input === 'string' ? input : (input?.textContent ?? '');
  return raw.replace(/\s+/g, ' ').trim();
}

/**
 * Builds the lookup key for an inline <svg>.
 * @param {Element} svg The svg element
 * @returns {string} viewBox + truncated first path data
 */
function svgKey(svg) {
  const viewBox = (svg.getAttribute('viewBox') || '').trim();
  const path = svg.querySelector('path');
  const d = (path?.getAttribute('d') || '').replace(/\s+/g, ' ').slice(0, 32);
  return `${viewBox}|${d}`;
}

/**
 * Resolves an icon token for whatever media element represents an icon.
 * Returns the authored token (":people:") or null when unrecognised, so the
 * caller can emit an empty cell rather than a wrong one.
 * @param {Element} el An <svg> or <img>/<picture> standing in for an icon
 * @returns {string|null} The icon token, or null
 */
function iconToken(el) {
  if (!el) return null;
  if (el.tagName?.toLowerCase() === 'svg') {
    const name = SVG_ICONS[svgKey(el)];
    if (name) return `:${name}:`;
    warn(`unrecognised inline SVG icon, key="${svgKey(el)}" — cell left empty`);
    return null;
  }
  const img = el.tagName?.toLowerCase() === 'img' ? el : el.querySelector('img');
  const src = img?.getAttribute('src') || '';
  const hit = RASTER_ICONS.find(([fragment]) => src.includes(fragment));
  if (hit) return `:${hit[1]}:`;
  warn(`unrecognised raster icon src="${src}" — cell left empty`);
  return null;
}

/**
 * Reduces a source <picture> to a single <img> the importer can download.
 * The art-directed <source> variants are dropped — Edge Delivery regenerates
 * responsive variants itself. Alt text is preserved, since it is the
 * accessible name and the model's companion `imageAlt` field.
 * @param {Element} scope Element to search within
 * @param {Document} document The document
 * @returns {Element|null} A bare <img>, or null when there is no image
 */
function imageFrom(scope, document) {
  const img = scope?.querySelector('picture img, img');
  if (!img) return null;
  const out = document.createElement('img');
  out.setAttribute('src', img.getAttribute('src'));
  out.setAttribute('alt', img.getAttribute('alt') || '');
  return out;
}

/**
 * Finds the anchor's label. Source buttons bury it in a nested span; cards
 * carry it on the anchor's `title`, which is the screen-reader label the
 * `linkText` field exists to hold.
 * @param {Element} a The anchor
 * @returns {string} The label
 */
function anchorLabel(a) {
  const span = a.querySelector('.cmp-button--link-text, .button--link-text');
  return text(span) || text(a.getAttribute('title') || '') || text(a);
}

/**
 * Emits a plain text link — the `link` + `linkText` pair.
 * @param {Element} a Source anchor
 * @param {Document} document The document
 * @returns {Element|null} An <a>, or null
 */
function linkFrom(a, document) {
  if (!a?.getAttribute('href')) return null;
  const out = document.createElement('a');
  out.setAttribute('href', a.getAttribute('href'));
  out.textContent = anchorLabel(a);
  return out;
}

/**
 * Emits a primary button — the `cta` + `ctaText` pair. decorateButtons()
 * renders <strong><a> as a primary button, which is what every CTA in the
 * source is.
 * @param {Element} a Source anchor
 * @param {Document} document The document
 * @returns {Element|null} A <p><strong><a>, or null
 */
function buttonFrom(a, document) {
  const link = linkFrom(a, document);
  if (!link) return null;
  const p = document.createElement('p');
  const strong = document.createElement('strong');
  strong.append(link);
  p.append(strong);
  return p;
}

/**
 * Builds a heading element.
 * @param {string} tag Heading tag name
 * @param {string} value Heading text
 * @param {Document} document The document
 * @returns {Element|null} The heading, or null when empty
 */
function heading(tag, value, document) {
  if (!value) return null;
  const h = document.createElement(tag);
  h.textContent = value;
  return h;
}

/**
 * Builds a paragraph element.
 * @param {string} value Paragraph text
 * @param {Document} document The document
 * @returns {Element|null} The paragraph, or null when empty
 */
function para(value, document) {
  if (!value) return null;
  const p = document.createElement('p');
  p.textContent = value;
  return p;
}

/**
 * Extracts a RICHTEXT field, preserving inline markup.
 *
 * Flattening these to plain text silently drops author-written inline
 * links — the product pages link "premiums" and "beneficiaries" into the
 * glossary from inside a card description. Only the presentational spans
 * the source wraps everything in (.article-body, .body-small, .text__*)
 * are unwrapped; anchors, <strong>, <em> and <sup> survive.
 * @param {Element} scope The source element, e.g. .text__body
 * @param {Document} document The document
 * @returns {Element[]} Cloned block-level children
 */
function richFrom(scope, document) {
  if (!scope) return [];
  const clone = scope.cloneNode(true);
  // unwrap styling spans, innermost first
  let span = clone.querySelector('span');
  while (span) {
    span.replaceWith(...span.childNodes);
    span = clone.querySelector('span');
  }
  const blocks = [...clone.children].filter((c) => text(c));
  if (blocks.length) return blocks;
  // no block children — the text sat directly in the wrapper
  const value = text(clone);
  return value ? [para(value, document)] : [];
}

/**
 * Assembles a copy cell from an ordered list of nodes, dropping the ones
 * that turned out empty. Always returns an element so the cell is emitted
 * even when every field was omitted — a skipped cell would shift every
 * later property by one.
 * @param {Array} nodes Candidate nodes
 * @param {Document} document The document
 * @returns {Array} The non-empty nodes, or an empty array
 */
function cell(nodes) {
  return nodes.filter((n) => n);
}

/* ------------------------------------------------------------------ *
 * cmp-002 — hero-billboard (simple, 3 rows x 1 cell)
 * ------------------------------------------------------------------ */

/**
 * Transforms the billboard hero.
 * @param {Element} el The .cmp-hero root
 * @param {Document} document The document
 * @returns {Element} The block table
 */
function heroBillboard(el, document) {
  const image = imageFrom(el.querySelector('.cmp-hero__image'), document);

  const titleEl = el.querySelector('.cmp-hero__title');
  const pretitleEl = titleEl?.querySelector('.cmp-hero__pretitle');
  const pretitle = text(pretitleEl);
  // the title is the heading's own text once the nested pretitle is removed
  let title = '';
  if (titleEl) {
    const clone = titleEl.cloneNode(true);
    clone.querySelector('.cmp-hero__pretitle')?.remove();
    title = text(clone);
  }
  const description = el.querySelector('.cmp-hero__description');
  const cta = el.querySelector('.cmp-hero__cta a[href]');

  return WebImporter.DOMUtils.createTable([
    ['Hero Billboard'],
    [cell([image])],
    [cell([
      para(pretitle, document),
      heading('h1', title, document),
      ...richFrom(description, document),
    ])],
    [cell([buttonFrom(cta, document)])],
  ], document);
}

/* ------------------------------------------------------------------ *
 * cmp-003 / 005 / 006 / 007 / 009 — the card grids (container blocks)
 * ------------------------------------------------------------------ */

/**
 * Classifies a card grid by the shape of its first card. Content-based, so
 * it generalises past the home page.
 * @param {Element} card A .cmp-card element
 * @returns {string} The target block name
 */
function cardKind(card) {
  const linked = !!card.querySelector('a.cmp-card__content-wrapper[href]');
  const wrapper = card.querySelector('.cmp-card__image-wrapper');
  const hasPicture = !!wrapper?.querySelector('picture, img');
  const hasSvg = !!wrapper?.querySelector('svg');

  if (!linked) return 'Icon List Card';
  if (hasPicture) return 'Feature Card';
  if (hasSvg) return 'Icon Link Card';
  return 'Product Card';
}

/**
 * Pulls the authored fields off one card.
 * @param {Element} card A .cmp-card element
 * @returns {object} The card's parts
 */
function cardParts(card) {
  const wrapper = card.querySelector('.cmp-card__image-wrapper');
  return {
    anchor: card.querySelector('a.cmp-card__content-wrapper[href]'),
    svg: wrapper?.querySelector('svg') || null,
    picture: wrapper || null,
    pretitle: text(card.querySelector('.cmp-card__pretitle')),
    // the title is a <p class="text__medium"> or an <h*> depending on variant
    title: text(card.querySelector('.text__medium')),
    // copy_description is a richtext field in both card models that use it
    description: card.querySelector('.text__body'),
  };
}

/**
 * Transforms a grid of cards into the matching container block.
 * @param {Element[]} cards The .cmp-card elements
 * @param {Document} document The document
 * @returns {Element} The block table
 */
function cardGrid(cards, document) {
  const name = cardKind(cards[0]);
  const rows = cards.map((card) => {
    const p = cardParts(card);
    const icon = p.svg ? iconToken(p.svg) : null;

    // cells are the item model's field groups, in model order
    if (name === 'Feature Card') {
      return [
        cell([imageFrom(p.picture, document)]),
        cell([para(p.pretitle, document), heading('h3', p.title, document)]),
        cell([linkFrom(p.anchor, document)]),
      ];
    }
    if (name === 'Product Card') {
      return [
        cell([
          para(p.pretitle, document),
          heading('h3', p.title, document),
          ...richFrom(p.description, document),
        ]),
        cell([linkFrom(p.anchor, document)]),
      ];
    }
    if (name === 'Icon Link Card') {
      return [
        cell([icon]),
        cell([heading('h3', p.title, document)]),
        cell([linkFrom(p.anchor, document)]),
      ];
    }
    // Icon List Card — no link field at all in the model
    return [
      cell([icon]),
      cell([
        heading('h3', p.title, document),
        ...richFrom(p.description, document),
      ]),
    ];
  });

  return WebImporter.DOMUtils.createTable([[name], ...rows], document);
}

/* ------------------------------------------------------------------ *
 * cmp-004 — announcement-banner (simple, 3 rows x 1 cell)
 * ------------------------------------------------------------------ */

/**
 * Transforms the announcement strip.
 * @param {Element} grid The .aem-Grid holding image + text + button
 * @param {Document} document The document
 * @returns {Element} The block table
 */
function announcementBanner(grid, document) {
  const icon = iconToken(grid.querySelector('.cmp-image'));
  const title = text(grid.querySelector('.cmp-text')?.querySelector(HEADINGS));
  const link = grid.querySelector('.cmp-button a[href]');

  return WebImporter.DOMUtils.createTable([
    ['Announcement Banner'],
    [cell([icon])],
    [cell([heading('h2', title, document)])],
    [cell([linkFrom(link, document)])],
  ], document);
}

/* ------------------------------------------------------------------ *
 * cmp-008 — feature-highlight-band (simple, 4 rows x 1 cell)
 * ------------------------------------------------------------------ */

/**
 * Transforms the highlight band.
 * @param {Element} grid The outer .aem-Grid
 * @param {Element} inner The nested container holding the highlight texts
 * @param {Document} document The document
 * @returns {Element} The block table
 */
function featureHighlightBand(grid, inner, document) {
  const image = imageFrom(grid.querySelector(':scope > .image .cmp-image'), document);

  const introEl = grid.querySelector(':scope > .text .cmp-text');
  const pretitle = text(introEl?.querySelector('.eyebrow'));
  const introHeading = introEl?.querySelector(HEADINGS);

  // Each highlight is its own .cmp-text of h4 + paragraph. They are flattened
  // into one richtext field; the block re-splits them on heading count.
  const highlights = [];
  inner.querySelectorAll('.cmp-text').forEach((t) => {
    const h = t.querySelector(HEADINGS);
    if (h) highlights.push(heading('h4', text(h), document));
    t.querySelectorAll(':scope > p').forEach((p) => {
      // keep <sup> footnote markers rather than flattening to plain text
      const clone = p.cloneNode(true);
      if (text(clone)) highlights.push(clone);
    });
  });

  const cta = grid.querySelector('.cmp-button a[href], .button a[href]');

  return WebImporter.DOMUtils.createTable([
    ['Feature Highlight Band'],
    [cell([image])],
    [cell([
      para(pretitle, document),
      heading('h2', text(introHeading), document),
    ])],
    [cell(highlights)],
    [cell([buttonFrom(cta, document)])],
  ], document);
}

/* ------------------------------------------------------------------ *
 * cmp-010 — cta-banner (simple, 2 rows x 1 cell)
 * ------------------------------------------------------------------ */

/**
 * Transforms the outlined CTA box.
 * @param {Element} grid The .aem-Grid holding the text + button
 * @param {Document} document The document
 * @returns {Element} The block table
 */
function ctaBanner(grid, document) {
  const copy = grid.querySelector('.cmp-text');
  const title = copy?.querySelector(HEADINGS);
  const description = copy?.querySelector('p');
  const cta = grid.querySelector('.cmp-button a[href], .button a[href]');

  return WebImporter.DOMUtils.createTable([
    ['CTA Banner'],
    [cell([
      heading('h3', text(title), document),
      para(text(description), document),
    ])],
    [cell([buttonFrom(cta, document)])],
  ], document);
}

/* ------------------------------------------------------------------ *
 * Source data tables
 * ------------------------------------------------------------------ */

/**
 * Rewrites a source <table> as a `Table` block.
 *
 * Any bare <table> left in an imported document is read by the Edge
 * Delivery pipeline as a block, and the FIRST ROW becomes the block name —
 * so an untouched data table lands as a block called
 * "protection-type-what-it-helps-cover-why-it-matters" and loses its
 * tabular semantics. Naming it `Table` is deterministic and matches the
 * block-collection `table` block's contract, so the markup is recoverable
 * once blocks/table/ exists.
 *
 * NOTE: blocks/table/ is NOT in this repo yet (mapping xc-4). Until it is
 * imported from the block collection, these render unstyled.
 * @param {Element} source The source table
 * @param {Document} document The document
 * @returns {Element} The block table
 */
function tableBlock(source, document) {
  const rows = [...source.querySelectorAll('tr')].map((tr) => (
    [...tr.children].map((td) => [...td.childNodes])
  ));
  return WebImporter.DOMUtils.createTable([['Table'], ...rows], document);
}

/* ------------------------------------------------------------------ *
 * Section metadata — the bands are section styles (mapping xc-2)
 * ------------------------------------------------------------------ */

/**
 * Indexes the page's own stylesheets by element id.
 *
 * The bands cannot be read off the elements: the source sets them in a
 * <style> block with !important, which beats the inline background-color,
 * so container-6e0d748310 carries no inline style at all while
 * container-2171ef64f0's inline value is simply overridden. Only rules
 * whose selector *is* the id (optionally with one class) are taken, so
 * `#id .cmp-image { clip-path }` does not leak onto the section.
 *
 * Must run before the <style> elements are removed.
 * @param {Document} document The source document
 * @returns {Map<string, object>} id -> { bg, clip }
 */
function collectBandCss(document) {
  const map = new Map();
  const css = [...document.querySelectorAll('style')]
    .map((s) => s.textContent).join('\n');
  const rule = /#([A-Za-z0-9_-]+)(?:\.[A-Za-z0-9_-]+)?\s*\{([^}]*)\}/g;
  let m = rule.exec(css);
  while (m) {
    const [, id, body] = m;
    const entry = map.get(id) || {};
    const bg = /background-color\s*:\s*([^;!}]+)(\s*!important)?/.exec(body);
    const clip = /clip-path\s*:\s*([^;!}]+)(\s*!important)?/.exec(body);
    if (bg) {
      entry.bg = bg[1].trim().toLowerCase();
      entry.bgImportant = !!bg[2];
    }
    if (clip) entry.clip = clip[1].trim();
    map.set(id, entry);
    m = rule.exec(css);
  }
  return map;
}

/**
 * Reads the band treatment off a container.
 * @param {Element} container The .cmp-container
 * @param {Window} win The window
 * @param {Map} bandCss Output of collectBandCss()
 * @returns {string[]} The section style tokens
 */
function bandStyles(container, win, bandCss) {
  const styles = [];
  let computed = null;
  try {
    computed = win?.getComputedStyle?.(container);
  } catch (e) {
    computed = null;
  }
  const fromCss = bandCss.get(container.id) || {};

  // Follow the cascade explicitly rather than trusting getComputedStyle:
  // the source overrides an inline navy with an !important green on
  // container-6e0d748310, and a DOM-only reading picks the wrong one.
  // (jsdom reports the inline value, so this also keeps QA honest.)
  const candidates = [
    fromCss.bgImportant ? fromCss.bg : null,
    (container.style?.backgroundColor || '').trim().toLowerCase() || null,
    fromCss.bg || null,
    (computed?.backgroundColor || '').trim() || null,
  ].filter((c) => c);

  const band = candidates.map((c) => BAND_COLORS[c]).find((b) => b);
  if (band) styles.push(band);

  const clip = fromCss.clip
    || (computed?.clipPath && computed.clipPath !== 'none' ? computed.clipPath : '');
  if (clip) styles.push('angled');
  return styles;
}

/**
 * Fences a node into its own section and appends the band metadata.
 * Section breaks are <hr>; the importer turns them into `---`.
 * @param {Element} node The node representing the section content
 * @param {string[]} styles The section style tokens
 * @param {Document} document The document
 * @returns {void}
 */
function wrapSection(node, styles, document) {
  if (!styles.length) return;
  const meta = WebImporter.DOMUtils.createTable([
    ['Section Metadata'],
    ['Style', styles.join(', ')],
  ], document);
  node.before(document.createElement('hr'));
  node.after(meta);
  meta.after(document.createElement('hr'));
}

/* ------------------------------------------------------------------ *
 * Detection + assembly
 * ------------------------------------------------------------------ */

/**
 * True when the grid's element children are direct-child <svg> clip-path
 * definitions — the angled brand outline that *is* the CTA banner.
 * @param {Element} grid The .aem-Grid
 * @returns {boolean} Whether brand SVGs are present
 */
function hasBrandSvg(grid) {
  return [...grid.children].some((c) => c.tagName?.toLowerCase() === 'svg');
}

/**
 * Replaces a source container with the block table it maps to.
 * @param {Element} container A .cmp-container
 * @param {Document} document The document
 * @param {Window} win The window
 * @param {Map} bandCss Output of collectBandCss()
 * @returns {boolean} Whether the container was consumed
 */
function transformContainer(container, document, win, bandCss) {
  const grid = container.querySelector(':scope > .aem-Grid');
  if (!grid) return false;
  const kids = [...grid.children].filter((c) => c.tagName?.toLowerCase() !== 'svg');
  const styles = bandStyles(container, win, bandCss);

  // --- card grids ---------------------------------------------------
  // A band section often holds its heading in the same grid as the cards
  // (cmp-009 does). The heading is default content, so only the .card
  // elements are folded into the block and everything else stays put.
  const cardKids = kids.filter((k) => k.classList.contains('card'));
  const cards = cardKids
    .map((k) => k.querySelector('.cmp-card'))
    .filter((c) => c);
  if (cards.length && cards.length === cardKids.length) {
    const table = cardGrid(cards, document);
    if (cardKids.length === kids.length) {
      container.replaceWith(table);
      wrapSection(table, styles, document);
    } else {
      cardKids[0].before(table);
      cardKids.forEach((k) => k.remove());
      wrapSection(container, styles, document);
    }
    return true;
  }

  // --- feature highlight band ----------------------------------------
  // outer container with a banner image, an intro, and a nested container
  // of >= 2 h4 texts
  const nested = kids
    .map((k) => k.querySelector(':scope > .cmp-container'))
    .find((c) => c && c.querySelectorAll('.cmp-text h4').length >= 2);
  if (nested && grid.querySelector(':scope > .image .cmp-image')) {
    container.replaceWith(featureHighlightBand(grid, nested, document));
    return true;
  }

  // --- announcement banner -------------------------------------------
  // icon image + single heading + button, all in one grid
  const imageKid = kids.find((k) => k.classList.contains('image'));
  const textKid = kids.find((k) => k.classList.contains('text'));
  const buttonKid = kids.find((k) => k.classList.contains('button'));
  if (imageKid && textKid && buttonKid && kids.length === 3) {
    const src = imageKid.querySelector('img')?.getAttribute('src') || '';
    if (RASTER_ICONS.some(([fragment]) => src.includes(fragment))) {
      container.replaceWith(announcementBanner(grid, document));
      return true;
    }
  }

  // --- cta banner -----------------------------------------------------
  if (hasBrandSvg(grid) && textKid && buttonKid) {
    container.replaceWith(ctaBanner(grid, document));
    return true;
  }

  // Not a block, but still a banded section — the navy band behind the
  // product cards is authored on an outer container that only holds the
  // section heading and the nested card grid.
  if (styles.length) wrapSection(container, styles, document);
  return false;
}

export default {
  /**
   * Turns a captured NYL page into Edge Delivery block markup.
   * @param {object} ctx The importer context
   * @param {Document} ctx.document The source document
   * @returns {Element} The transformed main element
   */
  transformDOM: ({ document }) => {
    warnings.length = 0;
    const main = document.body;
    const win = document.defaultView;

    // must run before the <style> elements are stripped below
    const bandCss = collectBandCss(document);

    // Page chrome is authored once as the /nav and /footer fragment
    // documents, not per page. Dropping the footer XF also drops the
    // nested email-subscribe block (cmp-011), which lives inside it —
    // importing it onto all 367 pages would be wrong.
    WebImporter.DOMUtils.remove(main, [
      '.cmp-experiencefragment--navigation',
      '.cmp-experiencefragment--global-footer',
      'header',
      'footer',
      'style',
      'script',
      'noscript',
      '.cmp-breadcrumb',
      // OneTrust injects its banner and full cookie-policy dialog into the
      // page body. It is CMP chrome, loaded at runtime by delayed.js, and
      // importing it would push ~2.5k characters of cookie policy into
      // every page as default content.
      '#onetrust-consent-sdk',
      '#onetrust-banner-sdk',
      '#ot-sdk-btn-floating',
      '.onetrust-pc-dark-filter',
      // analytics beacons — these are <img> tags and would otherwise be
      // imported as content images and downloaded as assets
      'img[src*="bat.bing.com"]',
      'img[src*="analytics.twitter.com"]',
      'img[src*="t.co/i/adsct"]',
      'img[src*="researchnow.com"]',
      'img[src*="ciqtracking.com"]',
      'img[src*="pix.pub"]',
      'img[src*="doubleclick"]',
      'img[src*="tag.tapad.com"]',
      'img[src*="/events?"]',
      'img[width="1"]',
      'img[height="1"]',
      'iframe',
    ]);

    // Source data tables first, before any block table exists, so the two
    // can never be confused.
    const dataTables = [...main.querySelectorAll('table')];
    if (dataTables.length) {
      warn(`${dataTables.length} source data table(s) rewritten as \`Table\` `
        + 'blocks — blocks/table/ is not in this repo yet (mapping xc-4)');
      dataTables.forEach((t) => t.replaceWith(tableBlock(t, document)));
    }

    // Heroes first: the hero sits outside the .cmp-container tree.
    // Every hero variant carries the same fields (image, pretitle, title,
    // description, optional CTA) and differs only by a presentational
    // modifier class, so they all map to hero-billboard. The modifier is
    // reported rather than dropped silently: `cmp-hero__dark-blue-
    // pretitle-white` is a treatment nobody has designed a variant for yet.
    main.querySelectorAll('.cmp-hero').forEach((hero) => {
      const root = hero.closest('.hero') || hero;
      const modifier = [...root.classList]
        .find((c) => c.startsWith('cmp-hero__') && c !== 'cmp-hero__billboard');
      if (modifier) {
        warn(`hero variant "${modifier}" mapped to plain hero-billboard — `
          + 'no variant class exists for it');
      }
      root.replaceWith(heroBillboard(hero, document));
    });

    // Containers, innermost last: transformContainer() reads nested
    // containers (the highlight band), so walking outermost-first lets the
    // band claim its children before they are visited on their own.
    const containers = [...main.querySelectorAll('.cmp-container')];
    containers.forEach((container) => {
      if (!container.isConnected) return;
      transformContainer(container, document, win, bandCss);
    });

    WebImporter.DOMUtils.createMetadata(main, document);
    return main;
  },

  /**
   * Mirrors the source path.
   * @param {object} ctx The importer context
   * @param {string} ctx.url The source URL
   * @returns {string} The document path
   */
  generateDocumentPath: ({ url }) => {
    const { pathname } = new URL(url);
    return WebImporter.FileUtils.sanitizePath(
      pathname.replace(/\.html$/, '').replace(/\/$/, '') || '/index',
    );
  },

  /** @returns {string[]} Warnings raised during the last transform. */
  getWarnings: () => [...warnings],
};
