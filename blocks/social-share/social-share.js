/*
 * Social share (cmp-a03).
 *
 * A vertical rail that sits beside the article H1: Facebook, LinkedIn, X,
 * Email and Copy Link, plus a transient "Link copied" confirmation.
 *
 * The network list and every share URL are built here, at decorate time, from
 * window.location.href and the page title. Nothing about them is authored —
 * hand-typed share URLs go stale the moment a page moves, and an author has
 * no way to know the right query parameter for each network.
 *
 * Markup contract — simple block, so the two authoring surfaces deliver
 * different row structures:
 *
 *   Universal Editor                 Document
 *   block > div > div  (title)       block > div > div  (title)
 *   block > div > div  (layout)                  > div  (layout)
 *         2 rows x 1 cell                  1 row x 2 cells
 *
 * Variants (block classes): `inline`. Default is the sticky vertical rail,
 * which already collapses to a horizontal row below 900px.
 */

import { decorateIcons, getMetadata, toClassName } from '../../scripts/aem.js';
import { moveInstrumentation } from '../../scripts/scripts.js';

/*
 * `rail` is the default and needs no class; `inline` pins the row layout.
 * Keyed by the model value and by the wording of the option label, because a
 * document author types the label they see rather than the stored value.
 */
const LAYOUTS = {
  rail: '',
  vertical: '',
  'vertical-rail': '',
  inline: 'inline',
  row: 'inline',
  'inline-row': 'inline',
  horizontal: 'inline',
};

/*
 * Each network owns its own URL builder, because the parameter names are all
 * different and none of them is guessable. `external` is false for mailto:,
 * which must open in the same context or the mail client never launches.
 */
const NETWORKS = [
  {
    icon: 'facebook',
    label: 'Share on Facebook',
    external: true,
    href: (url) => `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`,
  },
  {
    icon: 'linkedin',
    label: 'Share on LinkedIn',
    external: true,
    href: (url) => `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`,
  },
  {
    icon: 'x',
    label: 'Share on X',
    external: true,
    href: (url, title) => 'https://x.com/intent/post'
      + `?url=${encodeURIComponent(url)}&text=${encodeURIComponent(title)}`,
  },
  {
    icon: 'email',
    label: 'Share by email',
    external: false,
    href: (url, title) => `mailto:?subject=${encodeURIComponent(title)}`
      + `&body=${encodeURIComponent(`${title}\n\n${url}`)}`,
  },
];

/* labels are referenced by id, so each block on a page needs its own */
let instances = 0;

/**
 * Builds an icon placeholder for the project's standard span.icon mechanism.
 * decorateIcons() fills it in with /icons/<name>.svg.
 * @param {string} name The icon token
 * @returns {Element} The icon span
 */
function createIcon(name) {
  const span = document.createElement('span');
  span.className = `icon icon-${name}`;
  return span;
}

/**
 * Creates the polite live region and the helper that announces into it.
 *
 * The region is in the DOM from the start and is hidden with opacity rather
 * than display/visibility — a region that only appears at announce time is
 * unreliable, and the two hiding properties would take it out of the
 * accessibility tree entirely.
 * @returns {{region: Element, announce: function(string): void}} The region
 * and its announce helper
 */
function createStatus() {
  const region = document.createElement('p');
  region.className = 'social-share-status';
  region.setAttribute('role', 'status');
  region.setAttribute('aria-live', 'polite');

  let timer = null;
  const announce = (message) => {
    region.textContent = message;
    region.classList.add('social-share-status-shown');
    clearTimeout(timer);
    timer = setTimeout(() => {
      region.textContent = '';
      region.classList.remove('social-share-status-shown');
    }, 4000);
  };

  return { region, announce };
}

/**
 * Builds one share anchor.
 * @param {object} network The network descriptor
 * @param {string} url The page URL being shared
 * @param {string} title The page title being shared
 * @returns {Element} The list item holding the anchor
 */
function createShareItem(network, url, title) {
  const anchor = document.createElement('a');
  anchor.className = 'social-share-link';
  anchor.href = network.href(url, title);
  // the icon is decorative, so the anchor has to carry the accessible name
  anchor.setAttribute('aria-label', network.label);
  if (network.external) {
    anchor.target = '_blank';
    anchor.rel = 'noopener noreferrer';
  }
  anchor.append(createIcon(network.icon));

  const li = document.createElement('li');
  li.append(anchor);
  return li;
}

/**
 * Builds the copy-link control.
 *
 * Returns null when the Clipboard API is unavailable — an insecure context or
 * an old browser — rather than rendering a button that cannot work.
 * @param {string} url The page URL to copy
 * @param {function(string): void} announce Announces into the live region
 * @returns {Element|null} The list item holding the button, or null
 */
function createCopyItem(url, announce) {
  if (!navigator.clipboard) return null;

  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'social-share-link social-share-copy';
  button.setAttribute('aria-label', 'Copy link to this page');
  button.append(createIcon('link'));

  button.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(url);
      announce('Link copied');
    } catch (e) {
      announce('Could not copy the link');
    }
  });

  const li = document.createElement('li');
  li.append(button);
  return li;
}

/**
 * loads and decorates the block
 * @param {Element} block The block element
 */
export default function decorate(block) {
  const cells = [...block.querySelectorAll(':scope > div > div')];

  let labelCell = null;
  let variant = '';
  cells.forEach((cell) => {
    const value = cell.textContent.trim();
    if (!value) return;
    const layout = toClassName(value);
    if (layout in LAYOUTS) {
      variant = LAYOUTS[layout];
    } else if (!labelCell) {
      labelCell = cell;
    }
  });
  if (variant) block.classList.add(variant);

  const url = window.location.href;
  const title = getMetadata('og:title') || document.title || '';

  const nav = document.createElement('nav');
  nav.className = 'social-share-rail';

  if (labelCell) {
    instances += 1;
    const label = document.createElement('p');
    label.className = 'social-share-label';
    label.id = `social-share-label-${instances}`;
    label.textContent = labelCell.textContent.trim();
    // the cell carries the title field's instrumentation and is dropped here
    moveInstrumentation(labelCell, label);
    nav.setAttribute('aria-labelledby', label.id);
    nav.append(label);
  } else {
    nav.setAttribute('aria-label', 'Share this page');
  }

  const { region, announce } = createStatus();

  const list = document.createElement('ul');
  list.className = 'social-share-list';
  NETWORKS.forEach((network) => list.append(createShareItem(network, url, title)));
  const copyItem = createCopyItem(url, announce);
  if (copyItem) list.append(copyItem);

  nav.append(list, region);
  decorateIcons(nav);
  block.replaceChildren(nav);
}
