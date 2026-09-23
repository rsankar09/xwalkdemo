/*
 * Fragment Block
 * Include content on a page as a fragment.
 * https://www.aem.live/developer/block-collection/fragment
 */

// eslint-disable-next-line import/no-cycle
import {
  decorateMain,
} from '../../scripts/scripts.js';

import {
  loadSections,
} from '../../scripts/aem.js';

/**
 * Fetches a document and decorates it as a fragment.
 * @param {string} url The URL to fetch
 * @param {string} base Base used to resolve relative media references
 * @returns {Promise<HTMLElement|null>} The root element, or null
 */
async function fragmentFrom(url, base) {
  const resp = await fetch(url);
  if (!resp.ok) return null;

  const main = document.createElement('main');
  main.innerHTML = await resp.text();

  // reset base path for media to fragment base
  const resetAttributeBase = (tag, attr) => {
    main.querySelectorAll(`${tag}[${attr}^="./media_"]`).forEach((elem) => {
      elem[attr] = new URL(elem.getAttribute(attr), new URL(base, window.location)).href;
    });
  };
  resetAttributeBase('img', 'src');
  resetAttributeBase('source', 'srcset');

  decorateMain(main);
  await loadSections(main);
  return main;
}

/**
 * Loads a fragment.
 * @param {string} path The path to the fragment
 * @returns {HTMLElement} The root element of the fragment
 */
export async function loadFragment(path) {
  if (path && path.startsWith('/') && !path.startsWith('//')) {
    // eslint-disable-next-line no-param-reassign
    path = path.replace(/(\.plain)?\.html/, '');
    return fragmentFrom(`${path}.plain.html`, path);
  }
  return null;
}

/**
 * Loads a fragment that ships with the code rather than being authored.
 *
 * The header and footer use this as a fallback so the page chrome renders
 * even when no /nav or /footer content document exists yet — during the
 * migration, on a local dev server, and on any environment whose content
 * has not been authored. Unlike loadFragment() the URL is taken literally,
 * because these files live in the code repo and have no `.plain.html` form.
 * @param {string} url Path to the bundled HTML file
 * @returns {Promise<HTMLElement|null>} The root element, or null
 */
export async function loadBundledFragment(url) {
  try {
    return await fragmentFrom(url, url);
  } catch (e) {
    return null;
  }
}

export default async function decorate(block) {
  const link = block.querySelector('a');
  const path = link ? link.getAttribute('href') : block.textContent.trim();
  const fragment = await loadFragment(path);
  if (fragment) block.replaceChildren(...fragment.childNodes);
}
