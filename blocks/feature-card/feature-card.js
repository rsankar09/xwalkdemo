import { buildCardGrid } from '../../scripts/card-utils.js';

/*
 * Feature card (cmp-006, and cmp-009's dark treatment).
 * Photo + eyebrow + title, whole card linked, three across.
 *
 * Markup contract — container block, so items are rows on BOTH authoring
 * surfaces and each item's field groups are its cells:
 *
 *   block > div                card item
 *           > div              media  (image, imageAlt)
 *           > div              copy   (copy_pretitle, copy_title, copy_titleType)
 *           > div              link   (link, linkText)
 *
 * The dark variant is the section's Green band style, not a block option —
 * the band sits behind the whole section, not just these cards.
 */

/**
 * loads and decorates the block
 * @param {Element} block The block element
 */
export default function decorate(block) {
  buildCardGrid(block, 'feature-card', true);
}
