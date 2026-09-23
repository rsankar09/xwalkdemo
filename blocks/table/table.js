import { moveInstrumentation } from '../../scripts/scripts.js';

/*
 * Table (cmp-a05, cmp-a06, cmp-p07 — mapping xc-4).
 *
 * tools/importer/import.js rewrites every source <table> as a `Table` block
 * and 46 captured pages carry one, so this block sits on the import path
 * first and the hand-authoring path second.
 *
 * Two shapes arrive here and both have to work:
 *
 *   a) a real <table> inside an authored richtext cell
 *        block > div > div > table
 *   b) the div grid the Edge Delivery pipeline produces from an imported
 *      markdown table
 *        block > div (row) > div (cell)
 *
 * (b) is rebuilt into a real <table>: a grid of divs carries none of the
 * row/column semantics a screen reader needs, and the source cells hold
 * authored richtext rather than plain strings, so their markup is carried
 * across node-for-node instead of being flattened to text.
 *
 * Markup contract — simple block, so the two authoring surfaces differ:
 *
 *   Universal Editor                 Document / import
 *   block > div > div  (table)       block > div > div ...  (data rows)
 *   block > div > div  (caption)
 *
 * Variants: `no-header`, `striped`, `bordered`.
 */

/**
 * Collapses an element's text the way an author would have typed it.
 * @param {Element} el The element to read, may be null
 * @returns {string} the collapsed text
 */
function cellText(el) {
  return (el?.textContent || '').replace(/\s+/g, ' ').trim();
}

/**
 * Re-tags a row's cells as <th> or <td>, carrying content and Universal
 * Editor instrumentation across. Cells already using the wanted tag are left
 * in place so their instrumentation is never touched needlessly.
 * @param {HTMLTableRowElement} row The row to re-tag
 * @param {string} tag 'th' or 'td'
 */
function retagCells(row, tag) {
  [...row.children].forEach((cell) => {
    let target = cell;
    if (cell.tagName.toLowerCase() !== tag) {
      target = document.createElement(tag);
      moveInstrumentation(cell, target);
      target.append(...cell.childNodes);
      cell.replaceWith(target);
    }
    if (tag === 'th') target.setAttribute('scope', 'col');
    else target.removeAttribute('scope');
  });
}

/**
 * Builds a semantic <table> from the div grid the pipeline delivers.
 * @param {Element} block The block element
 * @returns {HTMLTableElement|null} the table, or null when there is no data
 */
function buildTableFromGrid(block) {
  const rows = [...block.children].filter((row) => row.children.length);
  if (!rows.length) return null;

  const table = document.createElement('table');
  const tbody = document.createElement('tbody');

  rows.forEach((row) => {
    const tr = document.createElement('tr');
    moveInstrumentation(row, tr);
    [...row.children].forEach((cell) => {
      const td = document.createElement('td');
      moveInstrumentation(cell, td);
      // childNodes, not textContent: the source wraps cell content in
      // richtext and the inline markup is part of the authored copy
      td.append(...cell.childNodes);
      tr.append(td);
    });
    tbody.append(tr);
  });

  table.append(tbody);
  return table;
}

/**
 * Makes the first row a <thead> of column headers, or undoes that for the
 * `no-header` variant. Works on an authored table that already has a <thead>
 * as well as on one built from the grid.
 * @param {HTMLTableElement} table The table
 * @param {boolean} wantHeader Whether the first row is a header row
 */
function applyHeader(table, wantHeader) {
  const body = table.tBodies[0];

  if (wantHeader) {
    const head = table.tHead?.rows[0];
    if (head) {
      retagCells(head, 'th');
      return;
    }
    const first = body?.rows[0];
    if (!first) return;
    table.createTHead().append(first);
    retagCells(first, 'th');
    return;
  }

  if (!table.tHead) return;
  // reversed so the rows keep their order once prepended one by one
  [...table.tHead.rows].reverse().forEach((row) => {
    retagCells(row, 'td');
    if (body) body.prepend(row);
    else table.append(row);
  });
  table.tHead.remove();
}

/**
 * Puts the authored caption on the table as a real <caption>.
 * @param {HTMLTableElement} table The table
 * @param {string} value The authored caption, may be empty
 * @returns {string} the caption text now carried by the table
 */
function applyCaption(table, value) {
  const existing = table.querySelector(':scope > caption');
  if (!value) {
    if (existing) existing.classList.add('table-caption');
    return cellText(existing);
  }
  const caption = existing || document.createElement('caption');
  caption.textContent = value;
  caption.classList.add('table-caption');
  if (!existing) table.prepend(caption);
  return value;
}

/**
 * Names the scrollable region.
 * A role="region" without an accessible name is dropped by assistive
 * technology, which would leave the tab stop unexplained.
 * @param {HTMLTableElement} table The table
 * @param {string} caption The caption text, may be empty
 * @returns {string} the accessible name
 */
function accessibleName(table, caption) {
  if (caption) return caption;
  const headers = [...table.querySelectorAll('thead th')]
    .map((th) => cellText(th))
    .filter(Boolean);
  return headers.length ? `Table: ${headers.join(', ')}` : 'Data table';
}

/**
 * loads and decorates the block
 * @param {Element} block The block element
 */
export default function decorate(block) {
  const cells = [...block.querySelectorAll(':scope > div > div')];
  const tableCell = cells.find((cell) => cell.querySelector('table'));

  let table;
  let caption = '';
  if (tableCell) {
    table = tableCell.querySelector('table');
    // classified by content: the caption is whatever other cell carries
    // text, so omitting the table or the caption cannot shift the other
    caption = cellText(cells.find((cell) => cell !== tableCell && cellText(cell)));
  } else {
    table = buildTableFromGrid(block);
  }

  if (!table) {
    block.replaceChildren();
    return;
  }

  applyHeader(table, !block.classList.contains('no-header'));
  caption = applyCaption(table, caption);

  // the region is the horizontal scroller: keyboard users cannot scroll an
  // overflow container that is not focusable
  const scroll = document.createElement('div');
  scroll.className = 'table-scroll';
  scroll.setAttribute('role', 'region');
  scroll.setAttribute('tabindex', '0');
  scroll.setAttribute('aria-label', accessibleName(table, caption));
  if (tableCell) moveInstrumentation(tableCell, scroll);
  scroll.append(table);

  block.replaceChildren(scroll);
}
