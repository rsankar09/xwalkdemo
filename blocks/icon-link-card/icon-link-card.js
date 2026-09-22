import { buildCardGrid } from '../../scripts/card-utils.js';

/*
 * Icon link card (cmp-007).
 * Icon + title only, whole card linked, bordered, four across. The linked,
 * bordered counterpart of icon-list-card; it has no description field.
 *
 * Markup contract — container block, so items are rows on BOTH authoring
 * surfaces and each item's field groups are its cells:
 *
 *   block > div                card item
 *           > div              media  (icon)
 *           > div              copy   (copy_title, copy_titleType)
 *           > div              link   (link, linkText)
 */

/**
 * loads and decorates the block
 * @param {Element} block The block element
 */
export default function decorate(block) {
  buildCardGrid(block, 'icon-link-card', true);
}
