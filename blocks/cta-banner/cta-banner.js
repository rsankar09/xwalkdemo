/**
 * CTA banner (cmp-010): outlined angled box, copy on the left, one button
 * on the right.
 *
 * Markup contract — this is a simple block, so the two authoring surfaces
 * deliver different row structures:
 *
 *   Universal Editor              Document
 *   block > div > div  (copy)     block > div > div  (copy)
 *   block > div > div  (cta)                  > div  (cta)
 *         2 rows x 1 cell               1 row x 2 cells
 *
 * decorate() therefore reads cells and normalizes them into a single row,
 * which becomes the flex container and carries the outlined shape.
 */

const HEADINGS = 'h1, h2, h3, h4, h5, h6';

/**
 * Decides whether a cell holds the call to action.
 * decorateButtons() has already run by the time block JS executes, so an
 * authored button arrives as a.button inside p.button-wrapper.
 * @param {Element} cell The cell to test
 * @returns {boolean} true when the cell is the CTA cell
 */
function isCtaCell(cell) {
  if (cell.querySelector('a.button')) return true;
  const anchors = cell.querySelectorAll('a[href]');
  return anchors.length === 1
    && !cell.querySelector(HEADINGS)
    && cell.textContent.trim() === anchors[0].textContent.trim();
}

/**
 * loads and decorates the block
 * @param {Element} block The block element
 */
export default function decorate(block) {
  const cells = [...block.querySelectorAll(':scope > div > div')];
  const row = document.createElement('div');
  row.className = 'cta-banner-inner';

  cells.forEach((cell) => {
    if (isCtaCell(cell)) {
      cell.classList.add('cta-banner-action');
    } else if (cell.textContent.trim() || cell.children.length) {
      cell.classList.add('cta-banner-copy');
      const heading = cell.querySelector(HEADINGS);
      if (heading) heading.classList.add('cta-banner-title');
    } else {
      // an omitted field still produces an empty cell — drop it so the
      // flex layout does not gain a phantom column
      cell.remove();
      return;
    }
    row.append(cell);
  });

  block.replaceChildren(row);
}
