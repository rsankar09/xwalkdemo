import { buildCardGrid } from '../../scripts/card-utils.js';

/*
 * Product card (cmp-005).
 * Eyebrow + title + description, no image, whole card linked, four across,
 * solid blue fill. Designed to sit on the navy angled band, which is a
 * section style (xc-2) rather than part of this block.
 *
 * Markup contract — container block, so items are rows on BOTH authoring
 * surfaces and each item's field groups are its cells:
 *
 *   block > div                card item
 *           > div              copy   (copy_pretitle, copy_title, copy_titleType, copy_description)
 *           > div              link   (link, linkText)
 */

/**
 * loads and decorates the block
 * @param {Element} block The block element
 */
export default function decorate(block) {
  buildCardGrid(block, 'product-card', true);
}
