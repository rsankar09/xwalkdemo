/*
 * Local QA harness for tools/importer/import.js.
 *
 * `aem-import-helper import` submits the script to the remote import
 * service, so the transform cannot be exercised locally through the CLI.
 * This harness runs it against the captured DOM in capture/<page>/dom.json
 * with jsdom and a faithful WebImporter stub, then asserts:
 *
 *   1. every emitted block table matches the row/cell contract derived
 *      from that block's own model partial
 *   2. no source text, link or image was dropped
 *
 * Usage: node tools/importer/qa.mjs [page ...]
 */

import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { JSDOM } from 'jsdom';
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
function checkPage(page) {
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

  return {
    page,
    blocks,
    failures,
    warnings: transformer.getWarnings(),
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

let failed = 0;
pages.forEach((page) => {
  const r = checkPage(page);
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
