/*
 * Announcement banner (cmp-004).
 * Pale-blue full-width strip: icon, one-line headline, trailing arrow link.
 *
 * Markup contract — simple block, so the two authoring surfaces deliver
 * different row structures:
 *
 *   Universal Editor                  Document
 *   block > div > div  (icon)         block > div > div  (icon)
 *   block > div > div  (copy)                     > div  (copy)
 *   block > div > div  (link)                     > div  (link)
 *         3 rows x 1 cell                   1 row x 3 cells
 *
 * decorate() reads cells and normalizes them into a single row, which becomes
 * the flex container, so the layout never depends on how many rows arrived.
 */

const HEADINGS = 'h1, h2, h3, h4, h5, h6';

/**
 * Classifies one authored cell by content, never by position.
 * @param {Element} cell The cell to classify
 * @returns {string} 'media' | 'link' | 'copy' | 'empty'
 */
function classifyCell(cell) {
  if (cell.querySelector('picture, .icon')) return 'media';
  if (!cell.textContent.trim() && !cell.children.length) return 'empty';
  const anchors = cell.querySelectorAll('a[href]');
  if (
    anchors.length === 1
    && !cell.querySelector(HEADINGS)
    && cell.textContent.trim() === anchors[0].textContent.trim()
  ) {
    return 'link';
  }
  return 'copy';
}

/**
 * loads and decorates the block
 * @param {Element} block The block element
 */
export default function decorate(block) {
  const cells = [...block.querySelectorAll(':scope > div > div')];
  const row = document.createElement('div');
  row.className = 'announcement-banner-inner';

  cells.forEach((cell) => {
    const kind = classifyCell(cell);
    if (kind === 'empty') return;
    if (kind === 'media') {
      cell.classList.add('announcement-banner-icon');
    } else if (kind === 'link') {
      cell.classList.add('announcement-banner-action');
    } else {
      cell.classList.add('announcement-banner-copy');
      const heading = cell.querySelector(HEADINGS);
      if (heading) heading.classList.add('announcement-banner-title');
    }
    row.append(cell);
  });

  block.replaceChildren(row);
}
