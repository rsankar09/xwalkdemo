/*
 * Hero billboard (cmp-002).
 * Full-bleed photo with an offset white content card carrying an eyebrow,
 * h1, description and one CTA.
 *
 * Markup contract — simple block, so the two authoring surfaces deliver
 * different row structures:
 *
 *   Universal Editor                  Document
 *   block > div > div  (media)        block > div > div  (media)
 *   block > div > div  (copy)                     > div  (copy)
 *   block > div > div  (cta)                      > div  (cta)
 *         3 rows x 1 cell                   1 row x 3 cells
 *
 * decorate() therefore reads cells and normalizes them into two direct
 * children of the block — a media pane and a content card — so the layout
 * never depends on how many rows arrived.
 */

import { moveInstrumentation } from '../../scripts/scripts.js';

const HEADINGS = 'h1, h2, h3, h4, h5, h6';

/**
 * Classifies one authored cell by content, never by position.
 * @param {Element} cell The cell to classify
 * @returns {string} 'media' | 'cta' | 'copy' | 'empty'
 */
function classifyCell(cell) {
  if (cell.querySelector('picture')) return 'media';
  if (!cell.textContent.trim() && !cell.children.length) return 'empty';
  const anchors = cell.querySelectorAll('a[href]');
  if (
    anchors.length === 1
    && !cell.querySelector(HEADINGS)
    && cell.textContent.trim() === anchors[0].textContent.trim()
  ) {
    return 'cta';
  }
  return 'copy';
}

/**
 * loads and decorates the block
 * @param {Element} block The block element
 */
export default function decorate(block) {
  const cells = [...block.querySelectorAll(':scope > div > div')];

  const media = document.createElement('div');
  media.className = 'hero-billboard-media';
  const content = document.createElement('div');
  content.className = 'hero-billboard-content';

  cells.forEach((cell) => {
    const kind = classifyCell(cell);
    if (kind === 'media') {
      // the cell carries the image field's data-aue-* instrumentation; it is
      // dropped here in favour of the media pane, so carry it across or the
      // image stops being editable in Universal Editor
      moveInstrumentation(cell, media);
      media.append(...cell.childNodes);
    } else if (kind === 'cta') {
      cell.classList.add('hero-billboard-cta');
      content.append(cell);
    } else if (kind === 'copy') {
      const heading = cell.querySelector(HEADINGS);
      if (heading) {
        heading.classList.add('hero-billboard-title');
        let prev = heading.previousElementSibling;
        while (prev) {
          prev.classList.add('hero-billboard-pretitle');
          prev = prev.previousElementSibling;
        }
        let next = heading.nextElementSibling;
        while (next) {
          next.classList.add('hero-billboard-description');
          next = next.nextElementSibling;
        }
      }
      cell.classList.add('hero-billboard-copy');
      content.append(cell);
    }
  });

  const children = [];
  if (media.childElementCount) children.push(media);
  if (content.childElementCount) children.push(content);
  block.replaceChildren(...children);
}
