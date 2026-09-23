/*
 * Teaser (cmp-a09): a tinted band carrying a headline, one short description
 * and a single quiet text link with a trailing arrow.
 *
 * Deliberately the quieter sibling of cta-banner. Both say "go here next";
 * cta-banner shouts it with a filled button, this one whispers it with a text
 * link. Which one to use is an authoring decision, so they stay separate
 * blocks with separate names rather than one block with a loudness option.
 *
 * Markup contract — this is a simple block, so the two authoring surfaces
 * deliver different row structures:
 *
 *   Universal Editor              Document
 *   block > div > div  (image)    block > div > div  (image)
 *   block > div > div  (copy)                 > div  (copy)
 *   block > div > div  (link)                 > div  (link)
 *         3 rows x 1 cell               1 row x 3 cells
 *
 * Row order follows model field order — [image], [copy], [link] — and an
 * omitted field still arrives as an empty cell, so nothing may be read by
 * position. The image is optional: roughly half the authored teasers are
 * text-only bands.
 * The `classes` model field is not part of that count: block options ride in
 * the block header ("Teaser (text-left, tinted)") and never claim a row.
 *
 * decorate() therefore reads cells, classifies them by content, and
 * normalizes them into a single inner element that owns the layout.
 */

import { createArrow } from '../../scripts/card-utils.js';

const HEADINGS = 'h1, h2, h3, h4, h5, h6';

/*
 * decorateButtons() in scripts.js fills a link in when the author bolded or
 * italicised it. This block is the text-link variant by definition, so the
 * button costume comes back off.
 */
const BUTTON_CLASSES = ['button', 'primary', 'secondary', 'accent'];

/**
 * Classifies one authored cell by content, never by position.
 * @param {Element} cell The cell to classify
 * @returns {string} 'media' | 'link' | 'copy' | 'empty'
 */
function classifyCell(cell) {
  if (cell.querySelector('picture, img')) return 'media';
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
 * Labels the parts of the copy cell.
 * Anchored to the heading rather than to child index, so an omitted headline
 * or description does not shift the remaining fields.
 * @param {Element} cell The copy cell
 */
function decorateCopy(cell) {
  cell.classList.add('teaser-copy');
  const heading = cell.querySelector(HEADINGS);
  if (heading) heading.classList.add('teaser-title');
  cell.querySelectorAll('p').forEach((p) => p.classList.add('teaser-description'));
}

/**
 * Turns the link cell into the arrow affordance.
 * The authored anchor is kept in place rather than rebuilt, so its Universal
 * Editor instrumentation survives untouched.
 * @param {Element} cell The link cell
 */
function decorateAction(cell) {
  cell.classList.add('teaser-action');
  const link = cell.querySelector('a[href]');
  if (!link) return;
  link.classList.remove(...BUTTON_CLASSES);
  link.classList.add('teaser-link');
  const wrapper = link.closest('p');
  if (wrapper) {
    wrapper.classList.remove('button-wrapper');
    if (!wrapper.className) wrapper.removeAttribute('class');
  }
  // aria-hidden inside the anchor, so the accessible name stays the link text
  link.append(createArrow('teaser'));
}

/**
 * Labels the image cell.
 *
 * The cell itself is kept and classed rather than unwrapped: it carries the
 * `image` field's data-aue-* instrumentation, and replacing it would make
 * the image uneditable in Universal Editor.
 * @param {Element} cell The media cell
 */
function decorateMedia(cell) {
  cell.classList.add('teaser-media');
  cell.querySelectorAll('p').forEach((p) => {
    if (p.querySelector('picture, img')) p.replaceWith(...p.childNodes);
  });
}

/**
 * loads and decorates the block
 * @param {Element} block The block element
 */
export default function decorate(block) {
  const cells = [...block.querySelectorAll(':scope > div > div')];
  const inner = document.createElement('div');
  inner.className = 'teaser-inner';
  let media = null;

  cells.forEach((cell) => {
    const kind = classifyCell(cell);
    // an omitted field still produces a cell — drop it rather than padding
    // the band with an empty box
    if (kind === 'empty') return;
    if (kind === 'media') {
      decorateMedia(cell);
      // the image is a sibling of the copy, not part of it: the two sit
      // side by side at desktop and stack on mobile
      media = cell;
      return;
    }
    if (kind === 'link') {
      decorateAction(cell);
    } else {
      decorateCopy(cell);
    }
    inner.append(cell);
  });

  // `image-left` / `image-right` are meaningless without an image, and an
  // author can leave one set after clearing the picture
  if (!media) block.classList.remove('image-left', 'image-right');
  else if (!block.classList.contains('image-right')) block.classList.add('image-left');

  const parts = [media, inner.children.length ? inner : null].filter((p) => p);
  // every field omitted: emit nothing rather than an empty tinted band
  block.replaceChildren(...parts);
}
