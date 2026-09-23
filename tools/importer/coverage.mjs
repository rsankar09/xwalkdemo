/*
 * Component coverage analysis for the newyorklife.com crawl.
 *
 * Streams every capture/<slug>/dom.json (one file at a time -- they are ~400KB
 * each and there are >1200 of them) and counts, per component type, how many
 * distinct PAGES contain it.
 *
 * Signatures are derived from the source site's actual markup: it is an AEM
 * Sites site built on Core Components, so every component renders a BEM root
 * class of the form `cmp-<name>` plus `cmp-<name>__<element>` /
 * `cmp-<name>--<modifier>` descendants, inside an `aem-Grid` responsive grid.
 *
 * Usage: node tools/importer/coverage.mjs [--csv]
 */

import { readdirSync, existsSync, readFileSync } from 'fs';
import { join } from 'path';

const CAPTURE_DIR = 'capture';

/**
 * Page body region: everything between the end of the global header
 * experience fragment and the start of the global footer experience fragment.
 * Counting inside the chrome would make header/footer-only components
 * (drawer, link-list, social-follow, email-subscribe) look like they are on
 * 100% of pages.
 */
function bodyRegion(html) {
  const start = html.indexOf('</header>');
  const end = html.lastIndexOf('<footer');
  if (start > 0 && end > start) return html.slice(start + 9, end);
  const head = html.indexOf('</head>');
  return head > 0 ? html.slice(head) : html;
}

/** Root `cmp-*` block name for a single class token, or null. */
function cmpBlock(token) {
  if (!token.startsWith('cmp-')) return null;
  const match = token.match(/^cmp-([a-z0-9]+(?:-[a-z0-9]+)*?)(?:__|--|$)/);
  return match ? match[1] : null;
}

/** Every distinct class token used in a chunk of html. */
function classTokens(html) {
  const tokens = new Set();
  const re = /class="([^"]*)"/g;
  let match = re.exec(html);
  while (match) {
    match[1].split(/\s+/).forEach((token) => {
      if (token) tokens.add(token);
    });
    match = re.exec(html);
  }
  return tokens;
}

/**
 * Curated catalogue. `test` receives { body, tokens, blocks } where `blocks`
 * is the Set of cmp-* root block names found in the page body.
 *
 * `status` records whether an already-built EDS block covers the pattern.
 */
const CATALOGUE = [
  // --- structural / default content -------------------------------------
  {
    key: 'text (RTE / default content)',
    group: 'default content',
    status: 'covered (EDS default content)',
    test: (p) => p.blocks.has('text'),
  },
  {
    key: 'container / section',
    group: 'default content',
    status: 'covered (EDS sections)',
    test: (p) => p.blocks.has('container'),
  },
  {
    key: 'button (CTA link)',
    group: 'default content',
    status: 'covered (EDS button decoration)',
    test: (p) => p.blocks.has('button'),
  },
  {
    key: 'image (standalone)',
    group: 'default content',
    status: 'covered (EDS default content)',
    test: (p) => p.blocks.has('image'),
  },
  {
    key: 'heading h1',
    group: 'default content',
    status: 'covered (EDS default content)',
    test: (p) => /<h1[\s>]/i.test(p.body),
  },

  // --- navigation / page furniture --------------------------------------
  {
    key: 'breadcrumb',
    group: 'page furniture',
    status: 'NEW BLOCK NEEDED',
    test: (p) => p.blocks.has('breadcrumb'),
  },
  {
    key: 'social-share bar',
    group: 'page furniture',
    status: 'NEW BLOCK NEEDED',
    test: (p) => p.blocks.has('social-share'),
  },
  {
    // The wrapper carries `separator cmp-display--thin|--thick`; the inner
    // node is `cmp-separator > hr.cmp-separator__horizontal-rule`. One
    // component, two weight modifiers -- counted once here.
    key: 'separator / horizontal rule',
    group: 'page furniture',
    status: 'NEW BLOCK NEEDED (or CSS-only)',
    test: (p) => p.blocks.has('separator') || p.blocks.has('display'),
  },
  {
    key: 'experience fragment (in body)',
    group: 'page furniture',
    status: 'covered (fragment block)',
    test: (p) => p.blocks.has('experiencefragment'),
  },

  // --- promo / marketing --------------------------------------------------
  {
    key: 'card (any variant)',
    group: 'promo',
    status: 'covered (feature-card / product-card / icon-*-card)',
    test: (p) => p.blocks.has('card'),
  },
  {
    key: 'card -- compact variant',
    group: 'promo',
    status: 'check coverage',
    test: (p) => p.tokens.has('cmp-card--compact'),
  },
  {
    key: 'card -- list variant',
    group: 'promo',
    status: 'check coverage',
    test: (p) => p.tokens.has('cmp-card--list'),
  },
  {
    key: 'card -- feature-card column',
    group: 'promo',
    status: 'covered (feature-card)',
    test: (p) => p.tokens.has('cmp-card__feature-card-column'),
  },
  {
    key: 'teaser (image + text band)',
    group: 'promo',
    status: 'partly covered (feature-highlight-band)',
    test: (p) => p.blocks.has('teaser'),
  },
  {
    key: 'hero',
    group: 'promo',
    status: 'covered (hero-billboard)',
    test: (p) => p.blocks.has('hero'),
  },
  {
    key: 'content-list (related content)',
    group: 'promo',
    status: 'NEW BLOCK NEEDED',
    test: (p) => p.blocks.has('content-list'),
  },
  {
    key: 'email-subscribe (in body)',
    group: 'promo',
    status: 'covered (email-subscribe)',
    test: (p) => p.blocks.has('email-subscribe'),
  },

  // --- rich / interactive -------------------------------------------------
  {
    key: 'accordion',
    group: 'interactive',
    status: 'NEW BLOCK NEEDED',
    test: (p) => p.blocks.has('accordion'),
  },
  {
    key: 'adaptive form (AEM Forms)',
    group: 'interactive',
    status: 'NEW BLOCK NEEDED (embed/integration)',
    test: (p) => p.blocks.has('aem-form-container') || p.tokens.has('guideContainerNode'),
  },
  {
    key: 'form element (any <form>)',
    group: 'interactive',
    status: 'NEW BLOCK NEEDED',
    test: (p) => /<form[\s>]/i.test(p.body),
  },
  {
    key: 'table',
    group: 'interactive',
    status: 'NEW BLOCK NEEDED',
    test: (p) => p.blocks.has('table') || /<table[\s>]/i.test(p.body),
  },
  {
    key: 'video (Brightcove / video.js)',
    group: 'interactive',
    status: 'NEW BLOCK NEEDED',
    test: (p) => p.blocks.has('video') || /video-js|brightcove|<video[\s>]/i.test(p.body),
  },
  {
    key: 'embed / iframe',
    group: 'interactive',
    status: 'NEW BLOCK NEEDED',
    test: (p) => p.blocks.has('embed') || /<iframe[\s>]/i.test(p.body),
  },
  {
    key: 'pull-quote',
    group: 'interactive',
    status: 'NEW BLOCK NEEDED',
    test: (p) => p.blocks.has('pull-quote'),
  },
  {
    key: 'tooltip',
    group: 'interactive',
    status: 'NEW BLOCK NEEDED',
    test: (p) => p.blocks.has('tooltip'),
  },
  {
    key: 'modal / dialog',
    group: 'interactive',
    status: 'NEW BLOCK NEEDED',
    test: (p) => /class="[^"]*\bmodal\b/i.test(p.body),
  },
  {
    key: 'download (asset link)',
    group: 'interactive',
    status: 'NEW BLOCK NEEDED',
    test: (p) => p.blocks.has('download'),
  },
  {
    key: 'auv sortable table',
    group: 'interactive',
    status: 'NEW BLOCK NEEDED',
    test: (p) => p.blocks.has('auv'),
  },
  {
    key: 'dropdown-targeting',
    group: 'interactive',
    status: 'NEW BLOCK NEEDED',
    test: (p) => p.blocks.has('dropdown-targeting'),
  },
  {
    key: 'cost-of-ltc calculator',
    group: 'interactive',
    status: 'NEW BLOCK NEEDED',
    test: (p) => p.blocks.has('cost-of-ltc'),
  },

  // --- commonly-missed patterns we explicitly probed for -------------------
  {
    key: 'carousel / slider',
    group: 'probe',
    status: 'n/a',
    test: (p) => /class="[^"]*(carousel|swiper|slick|splide|glide__|owl-carousel)/i.test(p.body),
  },
  {
    key: 'tabs',
    group: 'probe',
    status: 'n/a',
    test: (p) => /class="[^"]*(cmp-tabs|nav-tabs|tab-pane)/i.test(p.body),
  },
  {
    key: 'pagination',
    group: 'probe',
    status: 'n/a',
    test: (p) => /class="[^"]*pagination/i.test(p.body),
  },
  {
    key: 'search / search results',
    group: 'probe',
    status: 'n/a',
    test: (p) => /class="[^"]*(cmp-search|search-results|searchbox)/i.test(p.body),
  },
  {
    key: 'article byline / author',
    group: 'probe',
    status: 'n/a',
    test: (p) => /class="[^"]*(byline|by-line|article-author|cmp-author)/i.test(p.body),
  },
  {
    key: 'anchor nav / table of contents',
    group: 'probe',
    status: 'n/a',
    test: (p) => /class="[^"]*(anchor-nav|jump-link|table-of-contents|toc-)/i.test(p.body),
  },
  {
    key: 'disclaimer / footnote (body copy)',
    group: 'probe',
    status: 'n/a',
    test: (p) => /class="[^"]*(disclaimer|footnote|legal-copy|fine-print)/i.test(p.body),
  },
];

function main() {
  const wantCsv = process.argv.includes('--csv');

  const slugs = readdirSync(CAPTURE_DIR, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .filter((name) => existsSync(join(CAPTURE_DIR, name, 'dom.json')));

  const catalogueCounts = new Map(CATALOGUE.map((item) => [item.key, 0]));
  const discovered = new Map(); // every cmp-* block name -> page count
  const sectionTotals = new Map();
  const bySection = new Map(); // section -> Map(component -> pages)
  const microsites = []; // pages that ship their own header/footer XF
  let parsed = 0;
  let failed = 0;

  slugs.forEach((slug) => {
    let html;
    try {
      html = JSON.parse(readFileSync(join(CAPTURE_DIR, slug, 'dom.json'), 'utf8')).html;
    } catch {
      failed += 1;
      return;
    }
    if (typeof html !== 'string' || !html.length) {
      failed += 1;
      return;
    }
    parsed += 1;

    const section = slug.split('-')[0];
    sectionTotals.set(section, (sectionTotals.get(section) || 0) + 1);

    const body = bodyRegion(html);
    const tokens = classTokens(body);
    const blocks = new Set();
    tokens.forEach((token) => {
      const block = cmpBlock(token);
      if (block) blocks.add(block);
    });
    blocks.forEach((block) => discovered.set(block, (discovered.get(block) || 0) + 1));

    if (blocks.has('header') || blocks.has('footer')) microsites.push(slug);

    if (!bySection.has(section)) bySection.set(section, new Map());
    const sectionCounts = bySection.get(section);

    const page = { body, tokens, blocks };
    CATALOGUE.forEach((item) => {
      if (item.test(page)) {
        catalogueCounts.set(item.key, catalogueCounts.get(item.key) + 1);
        sectionCounts.set(item.key, (sectionCounts.get(item.key) || 0) + 1);
      }
    });

    // release the big strings before the next file
    html = null;
  });

  const pct = (n) => `${((n / parsed) * 100).toFixed(1)}%`;

  if (wantCsv) {
    console.log('component,group,pages,percent,status');
    CATALOGUE
      .slice()
      .sort((a, b) => catalogueCounts.get(b.key) - catalogueCounts.get(a.key))
      .forEach((item) => {
        const n = catalogueCounts.get(item.key);
        console.log(`"${item.key}",${item.group},${n},${pct(n)},"${item.status}"`);
      });
    return;
  }

  console.log(`Pages scanned: ${parsed} (${failed} unreadable) out of ${slugs.length} capture dirs`);
  console.log('');

  const rows = CATALOGUE
    .slice()
    .sort((a, b) => catalogueCounts.get(b.key) - catalogueCounts.get(a.key))
    .map((item) => {
      const n = catalogueCounts.get(item.key);
      return [item.key, String(n), pct(n), item.group, item.status];
    });
  const header = ['COMPONENT', 'PAGES', '%', 'GROUP', 'COVERAGE'];
  const widths = header.map((h, i) => Math.max(
    h.length,
    ...rows.map((r) => r[i].length),
  ));
  const line = (cells) => cells.map((c, i) => c.padEnd(widths[i])).join('  ');
  console.log(line(header));
  console.log(widths.map((w) => '-'.repeat(w)).join('  '));
  rows.forEach((r) => console.log(line(r)));

  console.log('');
  console.log('ALL DISCOVERED cmp-* BLOCK NAMES (page counts, body region only)');
  [...discovered.entries()]
    .sort((a, b) => b[1] - a[1])
    .forEach(([name, n]) => console.log(`  ${String(n).padStart(5)}  ${pct(n).padStart(6)}  cmp-${name}`));

  console.log('');
  console.log('PAGES BY SECTION');
  [...sectionTotals.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15)
    .forEach(([name, n]) => console.log(`  ${String(n).padStart(5)}  ${name}`));

  console.log('');
  console.log('PER-SECTION PENETRATION (% of that section\'s pages), top 8 sections');
  const topSections = [...sectionTotals.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([name]) => name);
  const matrixRows = CATALOGUE
    .filter((item) => item.group !== 'default content' && catalogueCounts.get(item.key) >= 30)
    .sort((a, b) => catalogueCounts.get(b.key) - catalogueCounts.get(a.key));
  const matrixHeader = ['COMPONENT'].concat(topSections.map((s) => `${s}(${sectionTotals.get(s)})`));
  const matrixBody = matrixRows.map((item) => [item.key].concat(topSections.map((s) => {
    const n = (bySection.get(s).get(item.key) || 0);
    return `${Math.round((n / sectionTotals.get(s)) * 100)}%`;
  })));
  const mw = matrixHeader.map((h, i) => Math.max(h.length, ...matrixBody.map((r) => r[i].length)));
  const mline = (cells) => cells.map((c, i) => c.padEnd(mw[i])).join('  ');
  console.log(mline(matrixHeader));
  console.log(mw.map((w) => '-'.repeat(w)).join('  '));
  matrixBody.forEach((r) => console.log(mline(r)));

  console.log('');
  console.log(`MICROSITE PAGES with their own header/footer XF in the body: ${microsites.length}`);
  console.log(`  e.g. ${microsites.slice(0, 6).join(', ')}`);
}

main();
