/*
 * Header block.
 *
 * Content is authored in the /nav fragment document (overridable per page with
 * the `nav` metadata key). The document is read positionally, one section per
 * region, in this order:
 *
 *   1. Brand      – the logo, as a linked image
 *   2. Navigation – one nested <ul>, up to three levels deep, plus `#search`
 *   3. Tools      – the right hand call to action(s)
 *   4. Search     – heading + a single link: text = placeholder, href = results
 *   5. Utility    – the thin link row above the bar, plus `#login`
 *   6. Login      – the login drawer: heading, intro, field list, submit link
 *
 * Sections 3–6 are optional; a document with only the first two behaves like
 * the boilerplate header.
 */
import { getMetadata } from '../../scripts/aem.js';
import { loadFragment, loadBundledFragment } from '../fragment/fragment.js';

/*
 * Chrome that ships with the code, used when no /nav document exists.
 * See the fallback note in decorate().
 */
const BUNDLED_NAV = '/blocks/header/nav.html';

/* the nav collapses to a hamburger below the project's 900px breakpoint */
const isDesktop = window.matchMedia('(min-width: 900px)');

const FOCUSABLE = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

/* the header block element, assigned once by decorate() */
let header;
/* the drawer that is currently open, as { toggle, panel, modal } */
let current = null;
/* monotonic source of unique ids for aria-controls wiring */
let ids = 0;

function nextId(prefix) {
  ids += 1;
  return `${prefix}-${ids}`;
}

/**
 * The default content wrapper of a nav fragment section.
 * @param {Element} section A section of the nav fragment
 * @returns {Element|null} The element holding the authored content
 */
function contentOf(section) {
  if (!section) return null;
  return section.querySelector(':scope > .default-content-wrapper') || section;
}

/** The fragment identifier of a link, or an empty string. */
function hashOf(link) {
  const href = link && link.getAttribute('href');
  if (!href) return '';
  const index = href.indexOf('#');
  return index < 0 ? '' : href.slice(index + 1);
}

function focusablesIn(root) {
  return [...root.querySelectorAll(FOCUSABLE)].filter((el) => el.getClientRects().length);
}

function isMenuOpen() {
  return header.classList.contains('nav-open');
}

/* body scroll is locked whenever the page behind the header is covered */
function syncScrollLock() {
  const locked = !!current || (!isDesktop.matches && isMenuOpen());
  document.body.style.overflowY = locked ? 'hidden' : '';
}

function setOverlay(visible) {
  const overlay = header.querySelector('.nav-overlay');
  if (overlay) overlay.hidden = !visible;
}

/**
 * Collapses the open drawer, if any.
 * @param {boolean} returnFocus Move focus back to the drawer's toggle
 */
function closeDrawer(returnFocus = false) {
  if (!current) return;
  const { toggle, panel } = current;
  toggle.setAttribute('aria-expanded', 'false');
  panel.hidden = true;
  current = null;
  setOverlay(false);
  syncScrollLock();
  if (returnFocus) toggle.focus();
}

/**
 * Expands a drawer, collapsing any other one first.
 * @param {Element} toggle The button that controls the drawer
 * @param {Element} panel The drawer panel
 * @param {boolean} modal Whether the drawer takes initial focus (search/login)
 */
function openDrawer(toggle, panel, modal = false) {
  if (current && current.toggle === toggle) {
    closeDrawer(true);
    return;
  }
  closeDrawer();
  toggle.setAttribute('aria-expanded', 'true');
  panel.hidden = false;
  current = { toggle, panel, modal };
  setOverlay(isDesktop.matches);
  syncScrollLock();
  if (modal) {
    const first = focusablesIn(panel).find((el) => el.matches('input, select, textarea'))
      || focusablesIn(panel)[0];
    if (first) first.focus();
  }
}

/**
 * Reveals one mega-menu category column, collapsing its siblings.
 * @param {Element} button The category button
 * @param {boolean} force Open even when the button is already expanded
 */
function openCategory(button, force = false) {
  const list = button.closest('.nav-categories');
  const panel = document.getElementById(button.getAttribute('aria-controls'));
  const wasOpen = button.getAttribute('aria-expanded') === 'true';
  list.querySelectorAll('[aria-expanded="true"]').forEach((other) => {
    if (other === button) return;
    other.setAttribute('aria-expanded', 'false');
    const otherPanel = document.getElementById(other.getAttribute('aria-controls'));
    if (otherPanel) otherPanel.hidden = true;
  });
  /* on desktop one column is always showing, so re-clicking it is a no-op */
  const open = force || !wasOpen || isDesktop.matches;
  button.setAttribute('aria-expanded', open ? 'true' : 'false');
  if (panel) panel.hidden = !open;
}

/* Escape closes, Tab cycles inside the open drawer (toggle included). */
function onKeydown(e) {
  if (e.key === 'Escape') {
    if (current) {
      closeDrawer(true);
      e.preventDefault();
    } else if (!isDesktop.matches && isMenuOpen()) {
      const hamburger = header.querySelector('.nav-hamburger button');
      // eslint-disable-next-line no-use-before-define
      toggleMenu(false);
      if (hamburger) hamburger.focus();
      e.preventDefault();
    }
    return;
  }
  if (e.key !== 'Tab') return;
  /*
   * Three cases. A modal drawer (search/login) is aria-modal, so its toggle is
   * outside the dialog and must stay out of the ring. A mega-menu drawer is
   * non-modal and reads as toggle-then-panel. With no drawer open but the
   * mobile panel covering the page, the whole header is the ring — without
   * this the user tabs onto content hidden behind the panel.
   */
  let ring;
  if (current) {
    ring = current.modal
      ? focusablesIn(current.panel)
      : [current.toggle, ...focusablesIn(current.panel)];
  } else if (!isDesktop.matches && isMenuOpen()) {
    ring = focusablesIn(header);
  } else {
    return;
  }
  if (ring.length < 2) return;
  const first = ring[0];
  const last = ring[ring.length - 1];
  if (e.shiftKey && document.activeElement === first) {
    last.focus();
    e.preventDefault();
  } else if (!e.shiftKey && document.activeElement === last) {
    first.focus();
    e.preventDefault();
  }
}

/**
 * Opens or closes the mobile navigation panel.
 * @param {boolean} expanded The state to move to
 */
function toggleMenu(expanded) {
  const button = header.querySelector('.nav-hamburger button');
  header.classList.toggle('nav-open', expanded);
  if (button) {
    button.setAttribute('aria-expanded', expanded ? 'true' : 'false');
    button.setAttribute('aria-label', expanded ? 'Close navigation' : 'Open navigation');
  }
  if (!expanded) closeDrawer();
  syncScrollLock();
}

/* ------------------------------------------------------------------ build */

/**
 * Splits a list item into the content before its nested list, the list, and
 * the content after it.
 * @param {Element} li The list item
 * @returns {{list: Element|null, before: Node[], after: Node[]}} The parts
 */
function splitItem(li) {
  const list = li.querySelector(':scope > ul');
  const before = [];
  const after = [];
  let seen = false;
  [...li.childNodes].forEach((node) => {
    if (node === list) {
      seen = true;
      return;
    }
    (seen ? after : before).push(node);
  });
  return { list, before, after };
}

function labelOf(nodes) {
  return nodes.map((node) => node.textContent).join(' ').replace(/\s+/g, ' ').trim();
}

function hasContent(nodes) {
  return nodes.some((node) => node.nodeType === Node.ELEMENT_NODE || node.textContent.trim());
}

function buildToggle(label, panelId, className) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = className;
  button.setAttribute('aria-expanded', 'false');
  button.setAttribute('aria-controls', panelId);
  button.textContent = label;
  return button;
}

/**
 * Normalizes one link list item into `<a><span title><span description>`.
 * @param {Element} li The list item
 * @returns {boolean} Whether the item was authored as an emphasised "see all"
 */
function decorateNavLink(li) {
  const link = li.querySelector('a[href]');
  if (!link) {
    li.remove();
    return false;
  }
  const em = link.closest('em');
  const emphasised = !!em && li.contains(em);
  if (em) em.replaceWith(link);
  const strong = link.closest('strong');
  if (strong && li.contains(strong)) strong.replaceWith(link);

  const rest = [...li.childNodes].filter((node) => node !== link);
  const description = labelOf(rest);
  rest.forEach((node) => node.remove());

  const title = document.createElement('span');
  title.className = 'nav-link-title';
  title.append(...[...link.childNodes]);
  link.append(title);
  if (description) {
    const text = document.createElement('span');
    text.className = 'nav-link-description';
    text.textContent = description;
    link.append(text);
  }
  link.classList.remove('button', 'primary', 'secondary', 'accent');
  li.className = emphasised ? 'nav-link-cta' : 'nav-link';
  return emphasised;
}

/**
 * Turns the trailing content of a drawer item into the promo footnote.
 * @param {Node[]} nodes The content authored after the nested list
 * @returns {Element} The footnote element
 */
function buildFootnote(nodes) {
  const footnote = document.createElement('div');
  footnote.className = 'nav-drawer-footnote';
  footnote.append(...nodes);
  footnote.querySelectorAll('a').forEach((a) => {
    a.classList.remove('button', 'primary', 'secondary', 'accent');
    a.classList.add('nav-arrow-link');
  });
  footnote.querySelectorAll('.button-wrapper').forEach((p) => {
    p.className = 'nav-footnote-cta';
  });
  return footnote;
}

/**
 * Builds the link column shown for one mega-menu category.
 * @param {Element} list The authored link list
 * @param {Node[]} extra Content authored after the list
 * @param {string} id The panel id referenced by the category button
 * @returns {Element} The panel element
 */
function buildPanel(list, extra, id) {
  const panel = document.createElement('div');
  panel.className = 'nav-panel';
  panel.id = id;
  panel.hidden = true;

  list.className = 'nav-links';
  [...list.children].forEach((li) => {
    const emphasised = decorateNavLink(li);
    if (emphasised) {
      const cta = document.createElement('p');
      cta.className = 'nav-panel-cta';
      const link = li.firstElementChild;
      if (link) {
        link.classList.add('nav-arrow-link');
        cta.append(link);
      }
      panel.append(cta);
      li.remove();
    }
  });
  panel.prepend(list);
  if (hasContent(extra)) {
    const trailing = document.createElement('div');
    trailing.className = 'nav-panel-extra';
    trailing.append(...extra);
    trailing.querySelectorAll('a').forEach((a) => {
      a.classList.remove('button', 'primary', 'secondary', 'accent');
      a.classList.add('nav-arrow-link');
    });
    panel.append(trailing);
  }
  return panel;
}

/**
 * Builds one mega-menu drawer from a top level list item.
 * @param {Element} li The top level list item
 */
function buildDrawer(li) {
  const { list, before, after } = splitItem(li);
  const label = labelOf(before);
  const drawerId = nextId('nav-drawer');

  const drawer = document.createElement('div');
  drawer.className = 'nav-drawer';
  drawer.id = drawerId;
  drawer.hidden = true;

  const inner = document.createElement('div');
  inner.className = 'nav-drawer-inner';
  drawer.append(inner);

  const columns = [...list.children];
  const nested = columns.some((item) => item.querySelector(':scope > ul'));

  if (nested) {
    /* the panel stays inside its category item so that mobile reads as an
       accordion; desktop re-lays it out as a rail plus a column with grid */
    const rail = document.createElement('ul');
    rail.className = 'nav-categories';
    columns.forEach((item) => {
      const parts = splitItem(item);
      const railItem = document.createElement('li');
      railItem.className = 'nav-category-item';
      if (!parts.list) {
        /* a category without links is just a link in the rail */
        railItem.append(...parts.before);
        rail.append(railItem);
        return;
      }
      const panelId = nextId('nav-panel');
      const button = buildToggle(labelOf(parts.before), panelId, 'nav-category');
      button.addEventListener('click', () => openCategory(button));
      railItem.append(button, buildPanel(parts.list, parts.after, panelId));
      rail.append(railItem);
    });
    inner.append(rail);
  } else {
    /* two level nav: render the links as a single column */
    inner.append(buildPanel(list, [], nextId('nav-panel')));
    inner.querySelector('.nav-panel').hidden = false;
  }

  if (hasContent(after)) inner.append(buildFootnote(after));

  const toggle = buildToggle(label, drawerId, 'nav-drawer-toggle');
  toggle.addEventListener('click', () => {
    const opening = !current || current.toggle !== toggle;
    openDrawer(toggle, drawer);
    const firstCategory = drawer.querySelector('.nav-category');
    if (opening && firstCategory && isDesktop.matches) openCategory(firstCategory, true);
  });

  li.textContent = '';
  li.className = 'nav-drop';
  li.append(toggle, drawer);
}

/**
 * Builds the search drawer from the Search section of the nav document.
 * @param {Element} section The Search section
 * @returns {{drawer: Element, title: string}|null} The drawer, or null
 */
function buildSearchDrawer(section) {
  const content = contentOf(section);
  const link = content && content.querySelector('a[href]');
  if (!link) return null;

  const heading = content.querySelector('h1, h2, h3, h4, h5, h6');
  const title = heading ? heading.textContent.trim() : 'Search';
  const placeholder = link.textContent.trim();
  const href = link.getAttribute('href');
  /* `/search?query=` names the query parameter; it defaults to `q` */
  const [action, query] = href.split('?');
  const param = (query && query.split('=')[0]) || 'q';

  const drawer = document.createElement('div');
  drawer.className = 'nav-drawer nav-search-drawer';
  drawer.id = nextId('nav-search');
  drawer.hidden = true;

  const form = document.createElement('form');
  form.className = 'nav-search-form';
  form.action = action;
  form.method = 'get';
  form.setAttribute('role', 'search');

  const inputId = nextId('nav-search-input');
  const label = document.createElement('label');
  label.className = 'nav-search-label';
  label.htmlFor = inputId;
  label.textContent = title;

  const input = document.createElement('input');
  input.id = inputId;
  input.type = 'search';
  input.name = param;
  input.placeholder = placeholder;
  input.autocomplete = 'off';

  const clear = document.createElement('button');
  clear.type = 'reset';
  clear.className = 'nav-search-clear';
  clear.textContent = 'Clear';
  clear.addEventListener('click', () => {
    window.requestAnimationFrame(() => input.focus());
  });

  const submit = document.createElement('button');
  submit.type = 'submit';
  submit.className = 'nav-search-submit';
  submit.innerHTML = '<span class="nav-sr-only">Submit search</span>';

  form.append(label, input, clear, submit);
  drawer.append(form);
  return { drawer, title };
}

/**
 * Builds one login form field from a `Label | type | name | autocomplete` row.
 * @param {string} spec The authored field specification
 * @returns {Element} The field wrapper
 */
function buildField(spec) {
  const [label, type = 'text', name = '', complete = ''] = spec.split('|').map((s) => s.trim());
  const id = nextId('nav-login-field');
  const wrapper = document.createElement('div');
  wrapper.className = `nav-login-field nav-login-field-${type}`;

  const input = document.createElement('input');
  input.type = type;
  input.id = id;
  if (name) input.name = name;
  if (type !== 'checkbox') input.required = true;
  const fallback = type === 'password' ? 'current-password' : 'username';
  input.autocomplete = complete || fallback;

  const labelEl = document.createElement('label');
  labelEl.htmlFor = id;
  labelEl.textContent = label;

  if (type === 'checkbox') wrapper.append(input, labelEl);
  else wrapper.append(labelEl, input);
  return wrapper;
}

/**
 * Groups the content authored after the login form into promo and link
 * columns: an image starts a promo, a heading starts a column.
 * @param {Node[]} nodes The trailing content
 * @returns {Element} The extras element
 */
function buildLoginExtras(nodes) {
  const extras = document.createElement('div');
  extras.className = 'nav-login-extras';
  let column = null;
  nodes.forEach((node) => {
    if (node.nodeType !== Node.ELEMENT_NODE) return;
    if (node.querySelector('picture, img')) {
      column = null;
      const promo = document.createElement('div');
      promo.className = 'nav-login-promo';
      promo.append(node);
      extras.append(promo);
      return;
    }
    if (node.matches('h1, h2, h3, h4, h5, h6')) {
      column = document.createElement('div');
      column.className = 'nav-login-column';
      extras.append(column);
    }
    (column || extras).append(node);
  });
  return extras;
}

/**
 * Builds the login drawer from the Login section of the nav document.
 * The form's action and method come from the single bolded link the author
 * writes in that section; without it no form is rendered.
 * @param {Element} section The Login section
 * @returns {{drawer: Element, title: string}|null} The drawer, or null
 */
function buildLoginDrawer(section) {
  const content = contentOf(section);
  if (!content) return null;

  const drawer = document.createElement('div');
  drawer.className = 'nav-drawer nav-login-drawer';
  drawer.id = nextId('nav-login');
  drawer.hidden = true;

  const panel = document.createElement('div');
  panel.className = 'nav-login-panel';
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-modal', 'true');
  drawer.append(panel);

  const children = [...content.children];
  const heading = children.find((el) => el.matches('h1, h2, h3, h4, h5, h6'));
  const fieldList = children.find((el) => el.matches('ul') && el.textContent.includes('|'));
  const submitLink = content.querySelector('a.button') || content.querySelector('strong a[href]');
  const submitWrapper = submitLink ? submitLink.closest('p') : null;

  const close = document.createElement('button');
  close.type = 'button';
  close.className = 'nav-login-close';
  close.innerHTML = '<span class="nav-sr-only">Close</span>';
  close.addEventListener('click', () => closeDrawer(true));
  panel.append(close);

  let title = 'Log In';
  if (heading) {
    title = heading.textContent.trim();
    heading.id = nextId('nav-login-title');
    heading.className = 'nav-login-title';
    panel.setAttribute('aria-labelledby', heading.id);
    panel.append(heading);
  } else {
    panel.setAttribute('aria-label', title);
  }

  const stop = Math.max(
    fieldList ? children.indexOf(fieldList) : -1,
    submitWrapper ? children.indexOf(submitWrapper) : -1,
  );
  const intro = children.filter((el, i) => (
    el !== heading && el !== fieldList && el !== submitWrapper && (stop < 0 || i < stop)
  ));
  if (intro.length) {
    const wrapper = document.createElement('div');
    wrapper.className = 'nav-login-intro';
    wrapper.append(...intro);
    panel.append(wrapper);
  }

  /* the paragraph right after the submit link, if it is a bare link, is the
     secondary "trouble logging in" link */
  let help = null;
  if (submitWrapper) {
    const next = children[children.indexOf(submitWrapper) + 1];
    const only = next && next.matches('p') && next.querySelector('a[href]');
    if (only && next.textContent.trim() === only.textContent.trim()) help = only;
  }

  const used = new Set([heading, ...intro]);
  if (submitLink && fieldList) {
    const form = document.createElement('form');
    form.className = 'nav-login-form';
    form.action = submitLink.getAttribute('href');
    form.method = 'post';
    form.name = 'login';
    [...fieldList.children].forEach((li) => {
      const spec = li.textContent.trim();
      if (spec) form.append(buildField(spec));
    });
    const actions = document.createElement('div');
    actions.className = 'nav-login-actions';
    const submit = document.createElement('button');
    submit.type = 'submit';
    submit.className = 'nav-login-submit';
    submit.textContent = submitLink.textContent.trim();
    actions.append(submit);
    if (help) {
      used.add(help.closest('p'));
      help.className = 'nav-login-help';
      actions.append(help);
    }
    form.append(actions);
    panel.append(form);
    used.add(fieldList);
    used.add(submitWrapper);
  }

  const rest = children.filter((el) => !used.has(el));
  if (rest.length) panel.append(buildLoginExtras(rest));

  return { drawer, title };
}

/**
 * Replaces a placeholder link with the button that opens a drawer.
 * @param {Element} link The `#search` or `#login` link
 * @param {{drawer: Element, title: string}} built The drawer to control
 * @param {string} className The class for the toggle button
 * @returns {Element} The toggle button
 */
function wireDrawerLink(link, built, className) {
  const label = link.textContent.trim() || built.title;
  const toggle = buildToggle(label, built.drawer.id, className);
  toggle.addEventListener('click', () => openDrawer(toggle, built.drawer, true));
  const parent = link.parentElement;
  const alone = parent.matches('p') && parent.textContent.trim() === link.textContent.trim();
  (alone ? parent : link).replaceWith(toggle);
  return toggle;
}

/* ---------------------------------------------------------------- decorate */

/**
 * Loads and decorates the header, mainly the nav.
 * @param {Element} block The header block element
 */
export default async function decorate(block) {
  header = block;

  const navMeta = getMetadata('nav');
  const navPath = navMeta ? new URL(navMeta, window.location).pathname : '/nav';

  // Authored content wins. The bundled default is the fallback so the header
  // still renders on an environment where /nav has not been authored yet —
  // which is every environment until the migration lands the nav document.
  const fragment = await loadFragment(navPath)
    || await loadBundledFragment(BUNDLED_NAV);
  block.textContent = '';
  if (!fragment) return;

  const [brandSection, navSection, toolsSection, searchSection, utilitySection, loginSection] = [
    ...fragment.children,
  ];

  const overlay = document.createElement('div');
  overlay.className = 'nav-overlay';
  overlay.hidden = true;
  overlay.addEventListener('click', () => closeDrawer(true));

  const wrapper = document.createElement('div');
  wrapper.className = 'nav-wrapper';

  const nav = document.createElement('nav');
  nav.id = 'nav';
  nav.setAttribute('aria-label', 'Main');

  /* hamburger */
  const hamburger = document.createElement('div');
  hamburger.className = 'nav-hamburger';
  hamburger.innerHTML = `<button type="button" aria-controls="nav-sections" aria-expanded="false"
      aria-label="Open navigation"><span class="nav-hamburger-icon"></span></button>`;
  hamburger.querySelector('button').addEventListener('click', () => toggleMenu(!isMenuOpen()));
  nav.append(hamburger);

  /* 1. brand */
  const brandContent = contentOf(brandSection);
  if (brandContent) {
    const brand = document.createElement('div');
    brand.className = 'nav-brand';
    brand.append(...[...brandContent.childNodes]);
    brand.querySelectorAll('a').forEach((a) => {
      a.className = '';
      const p = a.closest('p');
      if (p) p.className = '';
    });
    nav.append(brand);
  }

  /* 4. search drawer, wired from the `#search` item of the nav list */
  const search = searchSection ? buildSearchDrawer(searchSection) : null;

  /* 2. navigation */
  const navContent = contentOf(navSection);
  const navList = navContent && navContent.querySelector(':scope > ul');
  if (navList) {
    const sections = document.createElement('div');
    sections.className = 'nav-sections';
    /* the hamburger's aria-controls target: this is what actually toggles */
    sections.id = 'nav-sections';
    navList.className = 'nav-list';
    [...navList.children].forEach((li) => {
      const link = li.querySelector(':scope > a[href], :scope > p > a[href]');
      const hash = hashOf(link);
      if (hash === 'search') {
        if (!search) {
          li.remove();
          return;
        }
        li.className = 'nav-search';
        const toggle = wireDrawerLink(link, search, 'nav-search-toggle');
        toggle.after(search.drawer);
        return;
      }
      if (li.querySelector(':scope > ul')) {
        buildDrawer(li);
      } else {
        li.className = 'nav-item';
      }
    });
    sections.append(navList);
    nav.append(sections);
  }

  /* 3. tools */
  const toolsContent = contentOf(toolsSection);
  if (toolsContent && toolsContent.childElementCount) {
    const tools = document.createElement('div');
    tools.className = 'nav-tools';
    tools.append(...[...toolsContent.childNodes]);
    nav.append(tools);
  }

  /* 6. login drawer, wired from the `#login` item of the utility row */
  const login = loginSection ? buildLoginDrawer(loginSection) : null;

  /* 5. utility */
  const utilityContent = contentOf(utilitySection);
  const utilityList = utilityContent && utilityContent.querySelector(':scope > ul');
  if (utilityList) {
    const utility = document.createElement('div');
    utility.className = 'nav-utility';
    utilityList.className = 'nav-utility-list';
    [...utilityList.children].forEach((li) => {
      const link = li.querySelector('a[href]');
      if (hashOf(link) !== 'login') return;
      if (!login) {
        li.remove();
        return;
      }
      li.className = 'nav-login';
      wireDrawerLink(link, login, 'nav-login-toggle');
    });
    const inner = document.createElement('div');
    inner.className = 'nav-utility-inner';
    inner.append(utilityList);
    utility.append(inner);
    wrapper.append(utility);
  }

  wrapper.append(nav);
  if (login) wrapper.append(login.drawer);
  block.append(overlay, wrapper);

  /* sticky: the bar is fixed, the class only drives the scrolled shadow */
  const onScroll = () => header.classList.toggle('is-scrolled', window.scrollY > 4);
  onScroll();
  window.addEventListener('scroll', onScroll, { passive: true });

  document.addEventListener('keydown', onKeydown);
  document.addEventListener('click', (e) => {
    if (!current || header.contains(e.target)) return;
    /* hiding the panel while it holds focus would drop focus to <body> */
    closeDrawer(current.panel.contains(document.activeElement));
  });

  isDesktop.addEventListener('change', () => {
    closeDrawer(current ? current.panel.contains(document.activeElement) : false);
    toggleMenu(false);
    header.querySelectorAll('.nav-category[aria-expanded="true"]').forEach((button) => {
      button.setAttribute('aria-expanded', 'false');
      const panel = document.getElementById(button.getAttribute('aria-controls'));
      if (panel) panel.hidden = true;
    });
  });
}
