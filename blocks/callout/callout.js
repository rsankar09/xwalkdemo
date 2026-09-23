/*
 * Callout (cmp-a04, "Key takeaways"): one tinted box holding a bold heading
 * and a bulleted list, constrained to the width of the text column.
 *
 * In the source CMS this is the same component as icon-list-card
 * (cmp-card--list + card-color__ultralight-gray), used once rather than three
 * times across. That is a coincidence of the source implementation, not a
 * shared authoring intent: a one-box summary and a three-up icon grid want
 * different models, different copy lengths and different CSS. So it is split
 * out here, and it deliberately does NOT reuse the grid machinery in
 * scripts/card-utils.js — there is no grid, no icon and no link.
 *
 * Markup contract — this is a simple block with a single property group, so
 * both authoring surfaces deliver the same shape:
 *
 *   Universal Editor              Document
 *   block > div > div  (copy)     block > div > div  (copy)
 *         1 row x 1 cell                1 row x 1 cell
 *
 * The `classes` model field is not part of that count: block options ride in
 * the block header ("Callout (tinted)") and never claim a row.
 *
 * decorate() still iterates cells rather than indexing one, so an author who
 * splits the heading and the list across two cells in a document gets a box
 * instead of an exception.
 */

const HEADINGS = 'h1, h2, h3, h4, h5, h6';

/**
 * Labels the parts of one copy cell.
 * The heading level comes from the model, so it is styled rather than
 * rewritten — rewriting it would break the author's document outline.
 * @param {Element} cell The copy cell
 */
function decorateCopy(cell) {
  cell.classList.add('callout-copy');
  const heading = cell.querySelector(HEADINGS);
  if (heading) heading.classList.add('callout-title');
  cell.querySelectorAll('ul, ol').forEach((list) => list.classList.add('callout-list'));
}

/**
 * loads and decorates the block
 * @param {Element} block The block element
 */
export default function decorate(block) {
  const cells = [...block.querySelectorAll(':scope > div > div')];
  const box = document.createElement('div');
  box.className = 'callout-box';

  cells.forEach((cell) => {
    // an omitted field still produces a cell — drop it rather than padding
    // the box out with an empty child
    if (!cell.textContent.trim() && !cell.children.length) return;
    decorateCopy(cell);
    box.append(cell);
  });

  // every field omitted: emit nothing rather than an empty tinted box
  block.replaceChildren(...(box.children.length ? [box] : []));
}
