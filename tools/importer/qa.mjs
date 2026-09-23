/*
 * Local QA harness for tools/importer/import.js.
 *
 * `aem-import-helper import` submits the script to the remote import
 * service, so the transform cannot be exercised locally through the CLI.
 * This harness runs it against the captured DOM in capture/<page>/dom.json
 * with jsdom and a faithful WebImporter stub, then asserts:
 *
 *   1. every block header resolves to a BLOCK component in
 *      component-definition.json — not to a child-item component
 *   2. every emitted block table matches the row/cell contract derived
 *      from that block's own model partial
 *   3. the markdown actually converts to JCR through the real
 *      `@adobe/helix-importer` md2jcr pipeline, with every authored value
 *      landing on the model field it belongs to
 *   4. no source text, link or image was dropped
 *
 * Check 3 is the authoritative one. Checks 1 and 2 are cheap structural
 * pre-flights that produce a precise message; md2jcr is what the import
 * service actually runs, and it is the only thing that proves the cells
 * map to the right properties.
 *
 * Usage: node tools/importer/qa.mjs [page ...]
 */

import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { JSDOM } from 'jsdom';
import { md2jcr } from '@adobe/helix-importer';
import { readContracts } from './model-contract.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

/* --- WebImporter stub, matching @adobe/helix-importer's DOMUtils --- */
const WebImporter = {
  DOMUtils: {
    createTable(data, document) {
      const table = document.createElement('table');
      const maxCols = data.reduce((m, row) => Math.max(m, row.length), 0);
      data.forEach((row, index) => {
        const tr = document.createElement('tr');
        row.forEach((c) => {
          const td = document.createElement(index === 0 ? 'th' : 'td');
          if (row.length < maxCols) {
            td.setAttribute('colspan', String(maxCols - row.length + 1));
          }
          if (typeof c === 'string') td.innerHTML = c;
          else if (Array.isArray(c)) c.forEach((n) => td.append(n));
          else if (c) td.append(c);
          tr.append(td);
        });
        table.append(tr);
      });
      return table;
    },
    remove(element, selectors) {
      selectors.forEach((s) => element.querySelectorAll(s).forEach((e) => e.remove()));
    },
    createMetadata() { /* metadata block not asserted here */ },
  },
  FileUtils: {
    sanitizePath: (p) => p.toLowerCase().replace(/[^a-z0-9/_-]/g, '-'),
  },
};
global.WebImporter = WebImporter;

const transformer = (await import('./import.js')).default;
const contracts = readContracts(ROOT);

/*
 * The aggregated component JSONs, exactly as the import service reads them.
 * Run `npm run build:json` after touching any `_<block>.json` — md2jcr
 * derives the cell-to-property mapping from these, so a stale aggregate
 * imports the old shape.
 */
const components = {
  models: JSON.parse(readFileSync(join(ROOT, 'component-models.json'), 'utf-8')),
  definition: JSON.parse(readFileSync(join(ROOT, 'component-definition.json'), 'utf-8')),
  filters: JSON.parse(readFileSync(join(ROOT, 'component-filters.json'), 'utf-8')),
};

const ITEM_RESOURCE_TYPE = 'core/franklin/components/block/v1/block/item';

/**
 * Every component in the definition file, flattened out of its groups.
 * @returns {object[]} The component definitions
 */
const allComponents = () => components.definition.groups.flatMap((g) => g.components || []);

/**
 * Resolves a block header the way md2jcr does — `getComponentByTitle`, a
 * plain `find()` over every component's `title`.
 *
 * This is where the plural block titles bit: a header of `Icon List Card`
 * matched the *item* component titled "Icon List Card" (the block was
 * "Icon List Cards"), so md2jcr treated the container block as a simple
 * one, fed the row's cells to the item model's first field group and threw
 * "The content isn't mapping to the model correctly" on the second cell.
 * @param {string} title The block header text
 * @returns {string|null} A failure message, or null when the header is sound
 */
function checkBlockTitle(title) {
  const hit = allComponents().find((c) => c.title === title);
  if (!hit) {
    return `block header "${title}" matches no component title in `
      + 'component-definition.json — md2jcr will throw "The component '
      + `'${title}' does not exist"`;
  }
  const resourceType = hit.plugins?.xwalk?.page?.resourceType;
  if (resourceType === ITEM_RESOURCE_TYPE) {
    return `block header "${title}" resolves to the CHILD ITEM component `
      + `"${hit.id}", not a block. Give the block definition the title `
      + `"${title}" and rename the item (e.g. "${title} Item").`;
  }
  return null;
}

/** @returns {string} normalized text */
const norm = (s) => (s || '').replace(/\s+/g, ' ').trim();

/*
 * Blocks the transform emits on purpose that do not exist in this repo
 * yet. Reported, not failed — the gap is block authoring (mapping xc-4),
 * not the transform.
 */
const KNOWN_UNBUILT = new Set(['table']);

/**
 * Runs the transform over one captured page and checks the result.
 * @param {string} page The capture directory name
 * @returns {object} The report for this page
 */
async function checkPage(page) {
  const domPath = join(ROOT, 'capture', page, 'dom.json');
  if (!existsSync(domPath)) return { page, skipped: 'no dom.json' };
  const { html } = JSON.parse(readFileSync(domPath, 'utf-8'));

  const dom = new JSDOM(html, { url: `https://www.newyorklife.com/${page}` });
  const { document } = dom.window;

  // source-side inventory, taken before the transform mutates the DOM
  // Same strip list the transform uses, so the deltas below measure the
  // transform rather than the difference between two strip lists.
  const body = document.body.cloneNode(true);
  body.querySelectorAll([
    'style', 'script', 'noscript', 'iframe',
    '.cmp-experiencefragment--navigation',
    '.cmp-experiencefragment--global-footer',
    'header', 'footer', '.cmp-breadcrumb',
    '#onetrust-consent-sdk', '#onetrust-banner-sdk',
    '#ot-sdk-btn-floating', '.onetrust-pc-dark-filter',
    'img[src*="bat.bing.com"]', 'img[src*="analytics.twitter.com"]',
    'img[src*="t.co/i/adsct"]', 'img[src*="researchnow.com"]',
    'img[src*="ciqtracking.com"]', 'img[src*="pix.pub"]',
    'img[src*="doubleclick"]', 'img[src*="tag.tapad.com"]',
    'img[src*="/events?"]', 'img[width="1"]', 'img[height="1"]',
  ].join(', ')).forEach((e) => e.remove());
  const srcLinks = new Set(
    [...body.querySelectorAll('a[href]')].map((a) => a.getAttribute('href')),
  );
  const srcImages = new Set(
    [...body.querySelectorAll('picture img, .cmp-image img')]
      .map((i) => i.getAttribute('src')),
  );
  // The hero's eyebrow is a <span> nested inside the <h1>, and the
  // transform correctly splits it into its own paragraph. Strip it here
  // too, otherwise the concatenated source heading never matches.
  body.querySelectorAll('.cmp-hero__pretitle').forEach((e) => e.remove());
  const srcHeadings = [...body.querySelectorAll('h1,h2,h3,h4')]
    .map((h) => norm(h.textContent)).filter((t) => t);

  let main;
  try {
    main = transformer.transformDOM({
      document,
      url: `https://www.newyorklife.com/${page}`,
      html,
    });
  } catch (e) {
    return { page, error: `${e.message}\n${e.stack?.split('\n')[1] || ''}` };
  }

  const blocks = [];
  const failures = [];

  main.querySelectorAll('table').forEach((table) => {
    const rows = [...table.querySelectorAll('tr')];
    const header = norm(rows[0]?.textContent);
    const name = header.toLowerCase().replace(/[^0-9a-z]/gi, '-')
      .replace(/-+/g, '-').replace(/^-|-$/g, '');
    if (name === 'section-metadata') {
      blocks.push({ name, styles: norm(rows[1]?.textContent) });
      return;
    }
    const bodyRows = rows.slice(1);
    const cellCounts = bodyRows.map((r) => r.querySelectorAll('td').length);
    const info = { name, rows: bodyRows.length, cellCounts };
    blocks.push(info);

    const contract = contracts[name];
    if (!contract) {
      if (KNOWN_UNBUILT.has(name)) {
        info.unbuilt = true;
        return;
      }
      failures.push(`${name}: no model partial found — header text does not `
        + 'resolve to a block folder (check singular/plural)');
      return;
    }

    // md2jcr resolves the header by component TITLE, so a header that maps
    // to a block folder can still resolve to the wrong component.
    const titleFailure = checkBlockTitle(header);
    if (titleFailure) failures.push(titleFailure);

    if (contract.kind === 'simple') {
      if (bodyRows.length !== contract.rows) {
        failures.push(`${name}: emitted ${bodyRows.length} rows, model has `
          + `${contract.rows} groups [${contract.groups.join(', ')}]`);
      }
      cellCounts.forEach((c, i) => {
        if (c !== 1) failures.push(`${name}: row ${i + 1} has ${c} cells, simple blocks take 1`);
      });
    } else {
      cellCounts.forEach((c, i) => {
        if (c !== contract.cellsPerRow) {
          failures.push(`${name}: item ${i + 1} has ${c} cells, item model has `
            + `${contract.cellsPerRow} groups [${contract.groups.join(', ')}]`);
        }
      });
    }
  });

  // content fidelity
  const outLinks = new Set(
    [...main.querySelectorAll('a[href]')].map((a) => a.getAttribute('href')),
  );
  const outImages = new Set(
    [...main.querySelectorAll('img')].map((i) => i.getAttribute('src')),
  );
  const outText = norm(main.textContent);

  const droppedImages = [...srcImages].filter((s) => s && !outImages.has(s));
  const droppedHeadings = srcHeadings.filter((h) => !outText.includes(h));
  const missingAlt = [...main.querySelectorAll('img')]
    .filter((i) => !i.getAttribute('alt')).length;

  // grabbed before md2jcr runs the transform a second time and resets them
  const warnings = transformer.getWarnings();

  /*
   * The authoritative check: run the same conversion the import service
   * runs. md2jcr re-parses the source html and calls transformDOM itself,
   * so it gets a clean document rather than the one mutated above.
   *
   * Everything before this point only counts rows and cells. This is what
   * proves each cell lands on the property it is meant to.
   */
  const jcr = { ok: false };
  try {
    const res = await md2jcr(
      `https://www.newyorklife.com/${page}`,
      html,
      transformer,
      {
        createDocumentFromString: (s) => new JSDOM(s, {
          url: `https://www.newyorklife.com/${page}`,
        }).window.document,
      },
      { components },
    );
    const xml = res.jcr?.toString?.() ?? res.jcr ?? '';
    jcr.ok = true;
    jcr.items = [...xml.matchAll(/ model="([a-z0-9-]+)"/g)].map((m) => m[1]);
  } catch (e) {
    jcr.error = e.message.split('\n').slice(0, 2).join(' — ');
    failures.push(`md2jcr: ${jcr.error}`);
  }

  return {
    page,
    jcr,
    blocks,
    failures,
    warnings,
    droppedImages,
    droppedHeadings,
    missingAlt,
    srcLinkCount: srcLinks.size,
    outLinkCount: outLinks.size,
    path: transformer.generateDocumentPath({
      url: `https://www.newyorklife.com/${page}`,
    }),
  };
}

const args = process.argv.slice(2);
const pages = args.length ? args : ['home'];

// checked one page at a time: the transform keeps its warnings in module
// state, so running pages concurrently would interleave them
const results = await pages.reduce(async (acc, page) => {
  const all = await acc;
  all.push(await checkPage(page));
  return all;
}, Promise.resolve([]));

let failed = 0;
results.forEach((r) => {
  console.log(`\n${'='.repeat(64)}\n${r.page}`);
  if (r.skipped) { console.log(`  SKIPPED: ${r.skipped}`); return; }
  if (r.error) { console.log(`  ERROR: ${r.error}`); failed += 1; return; }

  console.log(`  path: ${r.path}`);
  console.log('  blocks:');
  r.blocks.forEach((b) => {
    if (b.styles !== undefined) console.log(`    - section-metadata: ${b.styles}`);
    else {
      console.log(`    - ${b.name}${b.unbuilt ? ' [BLOCK NOT BUILT]' : ''}: `
        + `${b.rows} row(s), cells ${JSON.stringify(b.cellCounts)}`);
    }
  });
  if (r.warnings.length) {
    console.log('  warnings:');
    r.warnings.forEach((w) => console.log(`    ! ${w}`));
  }
  if (r.droppedImages.length) {
    console.log(`  DROPPED IMAGES (${r.droppedImages.length}):`);
    r.droppedImages.forEach((s) => console.log(`    x ${s.slice(0, 100)}`));
  }
  if (r.droppedHeadings.length) {
    console.log(`  DROPPED HEADINGS (${r.droppedHeadings.length}):`);
    r.droppedHeadings.forEach((h) => console.log(`    x ${h.slice(0, 90)}`));
  }
  if (r.missingAlt) console.log(`  images missing alt: ${r.missingAlt}`);
  console.log(`  links: ${r.srcLinkCount} source -> ${r.outLinkCount} imported`);
  console.log(`  md2jcr: ${r.jcr.ok
    ? `OK, ${r.jcr.items.length} node(s) — ${[...new Set(r.jcr.items)].join(', ')}`
    : 'FAILED'}`);
  if (r.failures.length) {
    failed += 1;
    console.log('  CONTRACT FAILURES:');
    r.failures.forEach((f) => console.log(`    FAIL ${f}`));
  } else {
    console.log('  contract: OK');
  }
});

console.log(`\n${'='.repeat(64)}`);
console.log(failed ? `${failed} page(s) with failures` : 'all pages passed');
process.exit(failed ? 1 : 0);
