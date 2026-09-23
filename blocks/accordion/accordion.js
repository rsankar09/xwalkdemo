import { moveInstrumentation } from '../../scripts/scripts.js';

/*
 * Accordion (cmp-a07, cmp-p08). 134 captured pages carry one, which makes it
 * the second most common component on the site.
 *
 * Native <details>/<summary> does the disclosure. It is keyboard operable and
 * exposed as a button with its expanded state for free, and it works before —
 * and without — this script, so nothing is trapped behind a failed JS load.
 * No ARIA is added on top: role and aria-expanded on a <summary> would only
 * fight the implicit semantics.
 *
 * The source sets data-cmp-single-expansion (one panel open at a time). The
 * `single` variant reproduces that with the shared `name` attribute, which
 * browsers implement natively; where it is unsupported the accordion simply
 * degrades to multi-expansion. Multi-expansion is the default: a panel
 * closing itself when the reader opens another is the surprising behaviour,
 * so authors opt into it.
 *
 * Markup contract — container block, so items are rows on BOTH authoring
 * surfaces and each item's fields are its cells:
 *
 *   block > div        accordion item
 *           > div      title   (text)
 *           > div      content (richtext)
 */

/* Cells longer than this read as body copy rather than as a label. */
const LABEL_MAX = 120;

/* Group counter, so two accordions on one page never share an exclusivity group. */
let groups = 0;

/**
 * Collapses an element's text the way an author would have typed it.
 * @param {Element} el The element to read, may be null
 * @returns {string} the collapsed text
 */
function cellText(el) {
  return (el?.textContent || '').replace(/\s+/g, ' ').trim();
}

/**
 * Tells whether an authored element carries anything worth rendering.
 * @param {Element} el The element to test
 * @returns {boolean} true when the element is not empty
 */
function hasContent(el) {
  return !!(cellText(el) || el.querySelector('img, picture, svg, iframe'));
}

/**
 * Tells whether a cell reads as body copy rather than as a label.
 * Structural first, length second — never positional: an author can omit or
 * reorder fields and an omitted field still emits its cell.
 * @param {Element} cell The cell to test
 * @returns {boolean} true when the cell holds body copy
 */
function isBodyCell(cell) {
  if (cell.querySelector('ul, ol, table, picture, img, blockquote, h1, h2, h3, h4, h5, h6')) {
    return true;
  }
  if (cell.querySelectorAll('p').length > 1) return true;
  return cellText(cell).length > LABEL_MAX;
}

/**
 * Scores how much a cell reads like a label rather than like prose.
 * Lower is more label-like. Every term is a property of the content, so a
 * one-line answer sitting where the question was expected is still scored
 * as prose: a sentence ends in sentence punctuation and runs long, a label
 * usually does neither, and a Universal Editor text field arrives as a bare
 * text node where a richtext field is always wrapped in markup.
 * @param {Element} cell The cell to score
 * @returns {number} the score, lower is more label-like
 */
function labelScore(cell) {
  const value = cellText(cell);
  let score = 0;
  if (/[.!]$/.test(value)) score += 2;
  if (value.length > 60) score += 1;
  if (cell.children.length) score += 1;
  return score;
}

/**
 * Picks the cell that carries the item label.
 * @param {Element[]} cells The item's non-empty cells
 * @returns {Element|null} the label cell, or null when the item cannot split
 */
function pickLabelCell(cells) {
  if (cells.length < 2) return null;
  // when every cell reads as body copy the item still has to open with
  // something, so the whole set becomes the pool
  const plain = cells.filter((cell) => !isBodyCell(cell));
  const pool = plain.length ? plain : cells;
  // strict <, so an exact tie keeps the earlier cell
  return pool.reduce((best, cell) => (labelScore(cell) < labelScore(best) ? cell : best));
}

/**
 * Builds one disclosure from an authored row.
 * @param {Element} row The authored item row
 * @param {string} group Exclusivity group name, empty for multi-expansion
 * @returns {Element|null} the item element, or null when the row is empty
 */
function buildItem(row, group) {
  const cells = [...row.children].filter(hasContent);
  if (!cells.length) return null;

  const labelCell = pickLabelCell(cells);
  if (!labelCell) {
    // either nothing to name the control with or nothing to reveal — show
    // the content outright rather than hide it behind an unnamed control
    const plain = document.createElement('div');
    plain.className = 'accordion-item accordion-plain';
    moveInstrumentation(row, plain);
    plain.append(...cells);
    return plain;
  }

  const details = document.createElement('details');
  details.className = 'accordion-item';
  if (group) details.setAttribute('name', group);
  moveInstrumentation(row, details);

  const summary = document.createElement('summary');
  // the heading is the summary's only child: the content model allows one
  // heading element, and the chevron is drawn by CSS rather than added here
  const title = document.createElement('h3');
  title.className = 'accordion-title';
  title.textContent = cellText(labelCell);
  moveInstrumentation(labelCell, title);
  summary.append(title);

  const panel = document.createElement('div');
  panel.className = 'accordion-panel';
  panel.append(...cells.filter((cell) => cell !== labelCell));

  details.append(summary, panel);
  return details;
}

/**
 * loads and decorates the block
 * @param {Element} block The block element
 */
export default function decorate(block) {
  let group = '';
  if (block.classList.contains('single')) {
    groups += 1;
    group = `accordion-group-${groups}`;
  }

  const items = [...block.children]
    .map((row) => buildItem(row, group))
    .filter(Boolean);

  block.replaceChildren(...items);
}
