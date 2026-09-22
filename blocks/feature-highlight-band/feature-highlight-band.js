/*
 * Feature highlight band (cmp-008).
 * Full-bleed banner image with a diagonal lower edge, eyebrow + heading, a
 * grid of short highlights, and one CTA — all on a peach band.
 *
 * Markup contract — simple block, so the two authoring surfaces deliver
 * different row structures:
 *
 *   Universal Editor                  Document
 *   block > div > div  (media)        block > div > div  (media)
 *   block > div > div  (intro)                    > div  (intro)
 *   block > div > div  (highlights)               > div  (highlights)
 *   block > div > div  (cta)                      > div  (cta)
 *         4 rows x 1 cell                   1 row x 4 cells
 *
 * The highlights cell is one richtext field: each heading in it starts a new
 * grid item, so the band takes 2, 4 or 6 highlights without a model change.
 */

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
 * Splits the highlights richtext into one grid item per heading.
 * @param {Element} cell The highlights cell
 */
function buildHighlightGrid(cell) {
  cell.classList.add('feature-highlight-band-grid');
  const groups = [];
  [...cell.children].forEach((el) => {
    if (el.matches(HEADINGS) || !groups.length) groups.push([]);
    groups[groups.length - 1].push(el);
  });
  cell.replaceChildren(...groups.map((group) => {
    const item = document.createElement('div');
    item.className = 'feature-highlight-band-item';
    group.forEach((el) => {
      if (el.matches(HEADINGS)) el.classList.add('feature-highlight-band-item-title');
    });
    item.append(...group);
    return item;
  }));
}

/**
 * loads and decorates the block
 * @param {Element} block The block element
 */
export default function decorate(block) {
  const cells = [...block.querySelectorAll(':scope > div > div')];

  let media = null;
  let cta = null;
  const copy = [];

  cells.forEach((cell) => {
    const kind = classifyCell(cell);
    if (kind === 'media') media = cell;
    else if (kind === 'cta') cta = cell;
    else if (kind === 'copy') copy.push(cell);
  });

  /*
   * Both the intro and the highlights arrive as copy. They are told apart by
   * heading count rather than position: the highlights field holds several
   * headings, the intro at most one. Only if that is inconclusive — an author
   * wrote a single highlight — does the later cell win.
   */
  let intro = null;
  let highlights = null;
  if (copy.length === 1) {
    [intro] = copy;
  } else if (copy.length > 1) {
    const counts = copy.map((c) => c.querySelectorAll(HEADINGS).length);
    const max = Math.max(...counts);
    const idx = max > 1 ? counts.indexOf(max) : copy.length - 1;
    highlights = copy[idx];
    [intro] = copy.filter((c) => c !== highlights);
  }

  const children = [];

  if (media) {
    media.classList.add('feature-highlight-band-media');
    children.push(media);
  }

  const body = document.createElement('div');
  body.className = 'feature-highlight-band-body';

  if (intro) {
    intro.classList.add('feature-highlight-band-intro');
    const heading = intro.querySelector(HEADINGS);
    if (heading) {
      heading.classList.add('feature-highlight-band-title');
      let prev = heading.previousElementSibling;
      while (prev) {
        prev.classList.add('feature-highlight-band-pretitle');
        prev = prev.previousElementSibling;
      }
    }
    body.append(intro);
  }

  if (highlights) {
    buildHighlightGrid(highlights);
    body.append(highlights);
  }

  if (cta) {
    cta.classList.add('feature-highlight-band-cta');
    body.append(cta);
  }

  if (body.childElementCount) children.push(body);
  block.replaceChildren(...children);
}
