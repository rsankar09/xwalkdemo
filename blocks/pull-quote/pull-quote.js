/*
 * Pull quote (source component `cmp-pull-quote`): a quoted sentence lifted
 * out of the body copy, optionally credited to a person or a source.
 *
 * Present on 66 captured pages, and the markup is unusually uniform — every
 * one of the 67 instances is the same component with the same class string.
 * A third of them carry an attribution, and half of those add a second line
 * for the speaker's role.
 *
 * Markup contract — this is a simple block with three field groups:
 *
 *   Universal Editor                   Document
 *   block > div > div  (quote)         block > div > div  (quote)
 *   block > div > div  (attribution)               > div  (attribution)
 *   block > div > div  (role)                      > div  (role)
 *         3 rows x 1 cell                    1 row x 3 cells
 *
 * The role line is a field group of its own rather than a companion of
 * `attribution`. It cannot be called `attributionTitle`: md2jcr reads a
 * `*Title` suffix as a companion (the link-title convention) and collapses
 * it into the base property's cell, and two independent text values cannot
 * both be read out of one cell — the import fails with "the content isn't
 * mapping to the model correctly".
 *
 * Two thirds of the authored quotes have neither line, so both still arrive
 * as empty cells and nothing may be read by position.
 *
 * The opening quote glyph is drawn in CSS rather than authored, and the
 * source's decorative <svg> is dropped on import: it is presentation, and
 * baking it into content would make every quote carry ~400 bytes of path
 * data that no author can edit.
 */

/**
 * True when a cell carries no authored value.
 * @param {Element} cell The cell to test
 * @returns {boolean} Whether the cell is empty
 */
function isEmpty(cell) {
  return !cell.textContent.trim() && !cell.querySelector('picture, img');
}

/**
 * Moves a cell's children into a target element, unwrapping the single
 * paragraph the importer wraps a plain text field in.
 * @param {Element} cell The source cell
 * @param {Element} target The destination element
 */
function moveInto(cell, target) {
  const only = cell.children.length === 1 ? cell.firstElementChild : null;
  const source = only?.tagName === 'P' ? only : cell;
  [...source.childNodes].forEach((node) => target.append(node));
}

/**
 * loads and decorates the block
 * @param {Element} block The block element
 */
export default function decorate(block) {
  // Read by position, because that is what the model guarantees: three field
  // groups in a fixed order, each always present even when empty. Content
  // sniffing would be worse here — a one-word quote and a role line are
  // indistinguishable by shape.
  const cells = [...block.querySelectorAll(':scope > div > div')];
  const [quoteCell, nameCell, roleCell] = cells;

  const figure = document.createElement('figure');
  figure.className = 'pull-quote-figure';

  const quote = document.createElement('blockquote');
  quote.className = 'pull-quote-quote';
  if (quoteCell && !isEmpty(quoteCell)) {
    [...quoteCell.childNodes].forEach((node) => quote.append(node));
  }

  // nothing authored: emit nothing rather than an empty decorative box
  if (!quote.textContent.trim()) {
    block.replaceChildren();
    return;
  }
  figure.append(quote);

  const credit = document.createElement('figcaption');
  credit.className = 'pull-quote-credit';

  if (nameCell && !isEmpty(nameCell)) {
    const name = document.createElement('p');
    name.className = 'pull-quote-name';
    moveInto(nameCell, name);
    // Hand-typed dashes are common in the source ("—Heather Nesle"); the
    // block supplies its own styling, so a leading one would read as noise.
    const first = name.firstChild;
    if (first?.nodeType === Node.TEXT_NODE) {
      first.textContent = first.textContent.replace(/^\s*[—–-]\s*/, '');
    }
    credit.append(name);
  }

  if (roleCell && !isEmpty(roleCell)) {
    const role = document.createElement('p');
    role.className = 'pull-quote-role';
    moveInto(roleCell, role);
    credit.append(role);
  }

  // a role with no name still deserves its line; an empty caption does not
  if (credit.children.length) figure.append(credit);

  block.replaceChildren(figure);
}
