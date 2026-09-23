/*
 * Breadcrumb block.
 *
 * Present on 307 of the captured source pages — the most common component
 * that the home page did not have.
 *
 * The trail is DERIVED, not authored. In the source CMS the breadcrumb is a
 * `nav.cmp-breadcrumb.noindex` that the template generates from the page's
 * position in the hierarchy; no author ever types it. Importing 307 hand-made
 * trails would be 307 things to keep in sync with the page tree, so the
 * importer drops the source markup and this block rebuilds it from the URL.
 *
 * Labels resolve in three stages, cheapest first, so nothing blocks render:
 *   1. the path segment, de-slugified            (synchronous, always works)
 *   2. <title>/h1 for the current page           (synchronous)
 *   3. real page titles from /query-index.json   (async, upgrades in place)
 *
 * An author who needs a non-derived trail can still author one: any rows in
 * the block are read as links and used verbatim instead of the derived trail.
 *
 * Markup contract — simple block, all fields optional:
 *
 *   block > div > div    rootLabel   (text, defaults to "Home")
 *
 * Authored override:
 *
 *   block > div > div    a link per row, in order, root first
 */

/** Cache the index fetch so a page with two breadcrumbs only fetches once. */
let indexPromise = null;

/**
 * Turns a URL path segment into a human label.
 * Used until (and if) the query index supplies the real page title.
 * @param {string} segment A single path segment
 * @returns {string} The de-slugified label
 */
function labelFor(segment) {
  return decodeURIComponent(segment)
    .replace(/\.(html?|plain\.html)$/i, '')
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^./, (c) => c.toUpperCase());
}

/**
 * The path segments of the current page, ignoring empty and index segments.
 * @returns {string[]} The segments
 */
function pathSegments() {
  return window.location.pathname
    .split('/')
    .filter((s) => s && s !== 'index');
}

/**
 * Strips the trailing " | Site name" that page titles carry, so a crumb
 * reads "What is an IRA?" rather than the full document title.
 * @param {string} value A raw document title
 * @returns {string} The bare page title
 */
function bareTitle(value) {
  return value.split(/\s+[|–—]\s+/)[0].trim();
}

/**
 * Best synchronous guess at the current page's own title.
 * @returns {string} The title
 */
function currentTitle() {
  const h1 = document.querySelector('main h1');
  if (h1?.textContent.trim()) return h1.textContent.trim();
  return bareTitle(document.title);
}

/**
 * Builds the derived trail: a root crumb, one crumb per path segment, and the
 * current page last.
 * @param {string} rootLabel Label for the root crumb
 * @returns {Array<{href: string, label: string}>} The trail, root first
 */
function deriveTrail(rootLabel) {
  const segments = pathSegments();
  const trail = [{ href: '/', label: rootLabel }];
  segments.forEach((segment, i) => {
    trail.push({
      href: `/${segments.slice(0, i + 1).join('/')}`,
      label: i === segments.length - 1 ? currentTitle() : labelFor(segment),
    });
  });
  return trail;
}

/**
 * Reads an authored trail from the block's own rows, if there is one.
 * @param {Element} block The block element
 * @returns {Array<{href: string, label: string}>} The trail, possibly empty
 */
function authoredTrail(block) {
  return [...block.querySelectorAll(':scope > div a[href]')].map((a) => ({
    href: a.getAttribute('href'),
    label: a.textContent.trim(),
  }));
}

/**
 * Fetches the query index once and maps path -> title.
 * Resolves to an empty map on any failure: a breadcrumb that keeps its
 * de-slugified labels is fine, a breadcrumb that throws is not.
 * @returns {Promise<Map<string, string>>} path -> title
 */
function loadIndex() {
  if (!indexPromise) {
    indexPromise = fetch('/query-index.json')
      .then((res) => (res.ok ? res.json() : { data: [] }))
      .then(({ data = [] }) => new Map(
        data
          .filter((row) => row.path && row.title)
          .map((row) => [row.path, bareTitle(row.title)]),
      ))
      .catch(() => new Map());
  }
  return indexPromise;
}

/**
 * Upgrades the rendered labels to real page titles once the index arrives.
 * Runs after first paint and mutates text only, so it cannot shift layout
 * enough to matter or block LCP.
 * @param {Element} list The <ol> holding the crumbs
 * @returns {Promise<void>} Resolves when the labels have been updated
 */
async function enhanceLabels(list) {
  const titles = await loadIndex();
  if (!titles.size) return;
  list.querySelectorAll('[data-path]').forEach((el) => {
    const title = titles.get(el.dataset.path);
    if (title) el.textContent = title;
  });
}

/**
 * loads and decorates the block
 * @param {Element} block The block element
 */
export default function decorate(block) {
  const rootLabel = block.querySelector(':scope > div > div')?.textContent.trim();
  const authored = authoredTrail(block);
  const trail = authored.length ? authored : deriveTrail(rootLabel || 'Home');

  const nav = document.createElement('nav');
  nav.setAttribute('aria-label', 'Breadcrumb');

  const list = document.createElement('ol');
  list.className = 'breadcrumb-list';

  trail.forEach(({ href, label }, i) => {
    const item = document.createElement('li');
    item.className = 'breadcrumb-item';
    const last = i === trail.length - 1;

    // The current page is text, not a link: a link to the page you are on is
    // a known screen-reader annoyance, and aria-current carries the meaning.
    const node = document.createElement(last ? 'span' : 'a');
    if (!last) node.setAttribute('href', href);
    else node.setAttribute('aria-current', 'page');
    node.dataset.path = href;
    node.textContent = label;

    item.append(node);
    list.append(item);
  });

  nav.append(list);
  block.replaceChildren(nav);

  if (!authored.length) enhanceLabels(list);
}
