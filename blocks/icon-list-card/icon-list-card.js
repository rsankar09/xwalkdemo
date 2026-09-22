import { buildCardGrid } from '../../scripts/card-utils.js';

/*
 * Icon list card (cmp-003).
 * Icon + title + description, three across, no border and no link — the only
 * card shape in the design that is not an anchor. The model has no link field
 * at all, so an author cannot accidentally make one clickable.
 *
 * Markup contract — container block, so items are rows on BOTH authoring
 * surfaces and each item's field groups are its cells:
 *
 *   block > div                card item
 *           > div              media  (icon)
 *           > div              copy   (copy_title, copy_titleType, copy_description)
 */

/**
 * loads and decorates the block
 * @param {Element} block The block element
 */
export default function decorate(block) {
  buildCardGrid(block, 'icon-list-card', false);
}
