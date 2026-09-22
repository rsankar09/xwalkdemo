import { getMetadata } from '../../scripts/aem.js';
import { loadFragment } from '../fragment/fragment.js';

/*
 * Footer block.
 *
 * Content comes from the /footer fragment document. Its sections are the
 * authoring contract:
 *   - every section but the last is a footer column
 *   - the last section (or any section styled `footer-legal`) is the legal row
 *
 * Inside a column, each heading starts a new link group: the heading is the
 * group title and the list that follows it are the links. A list whose links
 * all carry an `:icon:` is treated as the social row instead. A column that
 * holds a nested block (e.g. email-subscribe) or the social row becomes the
 * aside column.
 */

/** href an author gives a legal link to turn it into the OneTrust hook. */
const ONETRUST_HREF = '#ot-sdk-show-settings';

/** id that the OneTrust loader in scripts/delayed.js looks for. */
const ONETRUST_ID = 'onetrust-privacy-choices';

const isHeading = (el) => /^H[1-6]$/.test(el.tagName);

/**
 * A list is the social row when every one of its items is an icon-only link.
 * @param {Element} el candidate element
 * @returns {boolean} true when the list should render as the social row
 */
function isSocialList(el) {
  if (el.tagName !== 'UL') return false;
  const links = [...el.querySelectorAll(':scope > li > a')];
  return links.length > 0 && links.every((a) => a.querySelector('span.icon'));
}

/**
 * Reduces a social link to its icon and gives it an accessible name, taken
 * from the authored link text, its title, or the icon name as a last resort.
 * @param {HTMLAnchorElement} a the social link
 */
function decorateSocialLink(a) {
  const icon = a.querySelector('span.icon');
  const iconClass = [...icon.classList].find((c) => c.startsWith('icon-'));
  const iconName = iconClass ? iconClass.slice(5).replace(/-/g, ' ') : '';
  const label = a.getAttribute('aria-label')
    || a.textContent.trim()
    || a.title
    || iconName;
  a.setAttribute('aria-label', label);
  a.classList.add('footer-social-link');
  a.replaceChildren(icon);
}

/**
 * Turns a heading + list pair into a labelled navigation landmark.
 * @param {Element[]} group the heading and the elements that follow it
 * @returns {Element} the element to put back into the column
 */
function buildLinkGroup(group) {
  const list = group.find((el) => el.tagName === 'UL');
  if (!list) {
    const text = document.createElement('div');
    text.className = 'footer-column-text';
    text.append(...group);
    return text;
  }

  const heading = isHeading(group[0]) ? group[0] : null;
  const social = isSocialList(list);
  const nav = document.createElement('nav');
  nav.className = social ? 'footer-social' : 'footer-linklist';
  nav.setAttribute('aria-label', heading ? heading.textContent.trim() : 'Footer');

  if (heading) {
    heading.classList.add(social ? 'footer-social-title' : 'footer-linklist-title');
    // the social row is icon-only by design, so its title is for AT only
    if (social) heading.classList.add('footer-visually-hidden');
  }

  if (social) {
    list.classList.add('footer-social-list');
    list.querySelectorAll(':scope > li > a').forEach(decorateSocialLink);
  } else {
    list.classList.add('footer-linklist-items');
  }

  nav.append(...group);
  return nav;
}

/**
 * Splits a column's default content on its headings and rebuilds it as
 * navigation landmarks.
 * @param {Element} wrapper a default-content-wrapper inside a footer column
 */
function decorateColumnContent(wrapper) {
  const groups = [];
  [...wrapper.children].forEach((el) => {
    if (isHeading(el) || !groups.length) groups.push([]);
    groups[groups.length - 1].push(el);
  });
  wrapper.replaceChildren(...groups.map(buildLinkGroup));
}

/**
 * Decorates the phone/copyright line and the legal link row, and wires the
 * OneTrust privacy-choices hook.
 * @param {Element} section the legal section of the footer fragment
 */
function decorateLegal(section) {
  section.classList.add('footer-legal');
  const wrapper = section.querySelector(':scope > .default-content-wrapper')
    || section.firstElementChild;
  if (!wrapper) return;
  wrapper.classList.add('footer-legal-inner');

  const paragraphs = [...wrapper.querySelectorAll(':scope > p')];
  if (paragraphs.length) {
    const meta = document.createElement('div');
    meta.className = 'footer-legal-meta';
    paragraphs.forEach((p) => {
      p.classList.add(p.querySelector('a[href^="tel:"]') ? 'footer-contact' : 'footer-copyright');
    });
    paragraphs[0].replaceWith(meta);
    meta.append(...paragraphs);
  }

  const list = wrapper.querySelector(':scope > ul');
  if (list) {
    const nav = document.createElement('nav');
    nav.className = 'footer-legal-nav';
    nav.setAttribute('aria-label', 'Legal');
    list.replaceWith(nav);
    list.classList.add('footer-legal-links');
    nav.append(list);
  }

  // OneTrust owns the click handler; it binds to .ot-sdk-show-settings when
  // the CMP loads from scripts/delayed.js. The link keeps its href so it
  // degrades to an in-page anchor if the CMP never arrives.
  const privacyChoices = wrapper.querySelector(`a[href$="${ONETRUST_HREF}"]`);
  if (privacyChoices) {
    privacyChoices.id = ONETRUST_ID;
    privacyChoices.classList.add('ot-sdk-show-settings', 'footer-privacy-choices');
  }
}

/**
 * loads and decorates the footer
 * @param {Element} block The footer block element
 */
export default async function decorate(block) {
  // load footer as fragment
  const footerMeta = getMetadata('footer');
  const footerPath = footerMeta ? new URL(footerMeta, window.location).pathname : '/footer';
  const fragment = await loadFragment(footerPath);

  block.textContent = '';
  if (!fragment) return;

  const sections = [...fragment.children].filter((el) => el.classList.contains('section'));
  const legal = fragment.querySelector(':scope > .section.footer-legal')
    || (sections.length > 1 ? sections[sections.length - 1] : null);
  const columns = sections.filter((section) => section !== legal);

  if (columns.length) {
    const grid = document.createElement('div');
    grid.className = 'footer-columns';
    columns.forEach((column) => {
      column.classList.add('footer-column');
      column.querySelectorAll(':scope > .default-content-wrapper').forEach(decorateColumnContent);
      // the column carrying the subscribe block and/or the social row
      if (column.querySelector('.block, .footer-social')) {
        column.classList.add('footer-column-aside');
      }
      grid.append(column);
    });
    block.append(grid);
  }

  if (legal) {
    decorateLegal(legal);
    block.append(legal);
  }

  // anything the author left outside a section still renders
  while (fragment.firstElementChild) block.append(fragment.firstElementChild);
}
