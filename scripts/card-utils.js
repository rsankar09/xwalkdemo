/*
 * Shared mechanics for the card blocks (feature-card, product-card,
 * icon-list-card, icon-link-card).
 *
 * Each of those is a separate block with its own model, markup contract and
 * CSS — an author picks them by name. Only the mechanics that must behave
 * identically live here: cell classification, the stretched link, the arrow,
 * and image optimisation. Four copies of these would drift.
 */

import { createOptimizedPicture } from './aem.js';
import { moveInstrumentation } from './scripts.js';

const HEADINGS = 'h1, h2, h3, h4, h5, h6';

/**
 * Builds the arrow affordance shown on linked cards.
 * Inline rather than an /icons/*.svg fetch so it inherits currentColor and
 * costs no extra request on a grid of a dozen cards.
 * @param {string} blockName Block name used to scope the class
 * @returns {Element} the arrow element
 */
export function createArrow(blockName) {
  const arrow = document.createElement('span');
  arrow.className = `${blockName}-arrow`;
  arrow.setAttribute('aria-hidden', 'true');
  arrow.innerHTML = '<svg viewBox="0 0 24 24" focusable="false"><path d="M4 12h15M13 6l6 6-6 6" fill="none" stroke="currentColor" stroke-width="2"/></svg>';
  return arrow;
}

/**
 * Classifies one authored cell by content.
 * Never by position: cell order follows model field order in Universal Editor
 * and column order in a document, and an omitted field still emits a cell.
 * @param {Element} cell The cell to classify
 * @returns {string} 'media' | 'link' | 'copy' | 'empty'
 */
export function classifyCell(cell) {
  if (cell.querySelector('picture, .icon')) return 'media';
  const anchors = cell.querySelectorAll('a[href]');
  if (anchors.length === 1 && cell.textContent.trim() === anchors[0].textContent.trim()) {
    return 'link';
  }
  if (!cell.textContent.trim() && !cell.children.length) return 'empty';
  return 'copy';
}

/**
 * Splits a copy cell into eyebrow / title / description around its heading.
 * Anchored to the heading rather than child index, so an omitted eyebrow or
 * description does not shift the remaining fields.
 * @param {Element} cell The copy cell
 * @param {string} blockName Block name used to scope the classes
 */
export function decorateCopy(cell, blockName) {
  cell.classList.add(`${blockName}-body`);
  const heading = cell.querySelector(HEADINGS);
  if (!heading) return;
  heading.classList.add(`${blockName}-title`);
  let prev = heading.previousElementSibling;
  while (prev) {
    prev.classList.add(`${blockName}-pretitle`);
    prev = prev.previousElementSibling;
  }
  let next = heading.nextElementSibling;
  while (next) {
    next.classList.add(`${blockName}-description`);
    next = next.nextElementSibling;
  }
}

/**
 * Makes a whole card clickable without nesting anchors.
 *
 * The anchor wraps the title and a CSS ::after overlay covers the card, so any
 * link the author put in the description stays a sibling. Wrapping the card in
 * an anchor instead would nest them — invalid HTML that the browser does not
 * repair here, because this DOM is built in JS rather than parsed.
 * @param {Element} li The card element
 * @param {HTMLAnchorElement} link The authored link
 * @param {string} blockName Block name used to scope the classes
 */
export function applyStretchedLink(li, link, blockName) {
  const anchor = document.createElement('a');
  anchor.href = link.href;
  /*
   * Only carry a title the author actually typed. This anchor takes the card
   * title as its text, so a title echoing the original link text would become
   * a description that disagrees with the accessible name.
   */
  if (link.title && link.title.trim() !== link.textContent.trim()) {
    anchor.title = link.title;
  }
  anchor.className = `${blockName}-link`;

  const title = li.querySelector(`.${blockName}-title`);
  if (title) {
    anchor.append(...title.childNodes);
    title.append(anchor);
  } else {
    // nothing to host the link — carry the authored text as the accessible
    // name, visually hidden, so the card is still reachable
    anchor.textContent = link.textContent.trim();
    anchor.classList.add(`${blockName}-link-bare`);
    li.append(anchor);
  }
  li.append(createArrow(blockName));
}

/**
 * Replaces authored pictures with optimized ones, carrying the intrinsic
 * dimensions across so the browser can reserve the right box.
 * @param {Element} scope The element to search within
 */
export function optimizePictures(scope) {
  scope.querySelectorAll('picture > img').forEach((img) => {
    const optimized = createOptimizedPicture(img.src, img.alt, false, [{ width: '750' }]);
    const newImg = optimized.querySelector('img');
    // createOptimizedPicture copies only src/alt — carry the real dimensions
    if (img.getAttribute('width')) newImg.setAttribute('width', img.getAttribute('width'));
    if (img.getAttribute('height')) newImg.setAttribute('height', img.getAttribute('height'));
    moveInstrumentation(img, newImg);
    img.closest('picture').replaceWith(optimized);
  });
}

/**
 * Builds a card grid from a container block's items.
 *
 * `cards`-style container blocks deliver their child items as rows on both
 * authoring surfaces, and each item's field groups as that row's cells, so
 * iterating children as items is correct here.
 * @param {Element} block The block element
 * @param {string} blockName Block name used to scope the classes
 * @param {boolean} linkable Whether this card type supports a link
 */
export function buildCardGrid(block, blockName, linkable) {
  const ul = document.createElement('ul');

  [...block.children].forEach((row) => {
    const li = document.createElement('li');
    li.className = `${blockName}-item`;
    moveInstrumentation(row, li);

    let link = null;
    [...row.children].forEach((cell) => {
      const kind = classifyCell(cell);
      if (kind === 'media') {
        cell.classList.add(`${blockName}-media`);
        li.append(cell);
      } else if (kind === 'link' && linkable) {
        link = cell.querySelector('a[href]');
      } else if (kind === 'copy') {
        decorateCopy(cell, blockName);
        li.append(cell);
      }
    });

    if (link) applyStretchedLink(li, link, blockName);
    li.classList.toggle(`${blockName}-linked`, !!link);
    ul.append(li);
  });

  optimizePictures(ul);
  block.replaceChildren(ul);
}
