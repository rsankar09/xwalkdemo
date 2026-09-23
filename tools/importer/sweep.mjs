/*
 * Full-corpus sweep for tools/importer/import.js.
 *
 * `qa.mjs` is the per-page authority, but it is verbose and holds every
 * jsdom document for the run in memory. This drives it in batches as child
 * processes instead, so the whole 1,200-page corpus can be swept unattended
 * without the heap growing without bound, and aggregates the result into a
 * failure-class histogram — which is the only way to find the failure modes
 * that a 15-page sample never reaches.
 *
 * Usage: node tools/importer/sweep.mjs [--batch 50] [--limit N]
 */

import { readdirSync, existsSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const CAPTURE = join(ROOT, 'capture');

const args = process.argv.slice(2);
const argVal = (name, fallback) => {
  const i = args.indexOf(name);
  return i >= 0 ? Number(args[i + 1]) : fallback;
};
const BATCH = argVal('--batch', 50);
const LIMIT = argVal('--limit', Infinity);

/*
 * Every directory holding a dom.json, whatever slug scheme wrote it.
 *
 * Deliberately NOT filtered by slug shape. The crawler's scheme changed
 * mid-migration (`/` used to collapse to `-`, now to `--`), and
 * prune-captures.mjs retires the superseded directory once a page has been
 * re-crawled. Selecting one scheme therefore silently tracks whichever half
 * of the corpus happens to be current: an earlier run of this sweep was
 * pinned to single-dash slugs, and when a re-crawl retired them underneath
 * it, 547 pages reported as failures that were really just directories that
 * no longer existed. Presence of dom.json is the only durable test.
 */
const pages = readdirSync(CAPTURE, { withFileTypes: true })
  .filter((d) => d.isDirectory())
  .map((d) => d.name)
  .filter((name) => existsSync(join(CAPTURE, name, 'dom.json')))
  .sort()
  .slice(0, LIMIT);

console.log(`sweeping ${pages.length} pages in batches of ${BATCH}\n`);

/**
 * Runs one batch of pages through qa.mjs in a child process.
 * @param {string[]} batch The page slugs
 * @returns {Promise<string>} The combined stdout/stderr
 */
function runBatch(batch) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [join(ROOT, 'tools', 'importer', 'qa.mjs'), ...batch], {
      cwd: ROOT,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let out = '';
    child.stdout.on('data', (d) => { out += d; });
    child.stderr.on('data', (d) => { out += d; });
    child.on('close', () => resolve(out));
  });
}

/**
 * Splits a qa.mjs run into its per-page report sections.
 * @param {string} out The raw output
 * @returns {Map<string, string>} page -> section body
 */
function splitSections(out) {
  const sections = new Map();
  const parts = out.split(/^={10,}$/m);
  parts.forEach((part) => {
    const lines = part.split('\n').filter((l) => l.trim());
    if (!lines.length) return;
    const page = lines[0].trim();
    if (!page || page.includes(' ')) return;
    sections.set(page, part);
  });
  return sections;
}

const results = [];
/* eslint-disable no-await-in-loop */
for (let i = 0; i < pages.length; i += BATCH) {
  const batch = pages.slice(i, i + BATCH);
  const out = await runBatch(batch);
  const sections = splitSections(out);
  batch.forEach((page) => {
    const body = sections.get(page) || '';
    const fails = [...body.matchAll(/^\s*FAIL (.+)$/gm)].map((m) => m[1].trim());
    const blocks = [...body.matchAll(/^\s*- ([a-z0-9-]+)(?: \[BLOCK NOT BUILT\])?: \d+ row/gm)]
      .map((m) => m[1]);
    const iconWarnings = (body.match(/unrecognised inline SVG icon/g) || []).length;
    const droppedImages = Number(/DROPPED IMAGES \((\d+)\)/.exec(body)?.[1] || 0);
    const droppedHeadings = Number(/DROPPED HEADINGS \((\d+)\)/.exec(body)?.[1] || 0);
    const links = /links: (\d+) source -> (\d+) imported/.exec(body);
    /*
     * A page that produced no report at all is NOT a failure — most often
     * its capture was retired by a re-crawl while the sweep was running.
     * Counting those as failures is how a clean run reported 44.7% failing
     * with an empty failure-class histogram: 547 pages "failed" with
     * nothing whatsoever to say about why.
     */
    const skipped = !body.trim() || /SKIPPED:/.test(body);
    results.push({
      page,
      skipped,
      ok: !skipped && fails.length === 0 && body.includes('contract: OK'),
      fails,
      blocks,
      iconWarnings,
      droppedImages,
      droppedHeadings,
      srcLinks: Number(links?.[1] || 0),
      outLinks: Number(links?.[2] || 0),
    });
  });
  const done = Math.min(i + BATCH, pages.length);
  const failed = results.filter((r) => !r.ok && !r.skipped).length;
  const skipped = results.filter((r) => r.skipped).length;
  console.log(`  ${done}/${pages.length} — ${failed} failed, ${skipped} skipped so far`);
}
/* eslint-enable no-await-in-loop */

/* ---------------- aggregate ---------------- */

/**
 * Buckets a raw failure message into a stable class, so the histogram counts
 * failure MODES rather than every distinct element name or block title.
 * @param {string} message The FAIL line
 * @returns {string} The class label
 */
function classify(message) {
  const unsupported = /Element '([^']+)' is currently not supported/.exec(message);
  if (unsupported) return `md2jcr: unsupported element <${unsupported[1]}>`;
  const missing = /The component '([^']+)' does not exist/.exec(message);
  if (missing) return `md2jcr: component missing — ${missing[1]}`;
  if (message.includes("isn't mapping to the model")) {
    return 'md2jcr: content does not map to model';
  }
  if (message.includes('no model partial found')) return 'contract: header resolves to no block';
  if (message.includes('resolves to the CHILD ITEM')) return 'contract: header hits child item';
  if (/emitted \d+ rows/.test(message)) return 'contract: wrong row count';
  if (/has \d+ cells/.test(message)) return 'contract: wrong cell count';
  return `other: ${message.slice(0, 80)}`;
}

const skippedPages = results.filter((r) => r.skipped);
const scored = results.filter((r) => !r.skipped);
const failing = scored.filter((r) => !r.ok);
const classes = new Map();
failing.forEach((r) => {
  new Set(r.fails.map(classify)).forEach((c) => {
    if (!classes.has(c)) classes.set(c, []);
    classes.get(c).push(r.page);
  });
});

const blockUse = new Map();
scored.forEach((r) => new Set(r.blocks).forEach((b) => {
  blockUse.set(b, (blockUse.get(b) || 0) + 1);
}));

const pct = (n) => `${((n / (scored.length || 1)) * 100).toFixed(1)}%`;

console.log(`\n${'='.repeat(64)}\nSWEEP RESULT`);
console.log(`  pages scored: ${scored.length}`);
console.log(`  passed:       ${scored.length - failing.length} (${pct(scored.length - failing.length)})`);
console.log(`  failed:       ${failing.length} (${pct(failing.length)})`);
if (skippedPages.length) {
  console.log(`  skipped:      ${skippedPages.length} (no capture on disk — excluded from the rates above)`);
  console.log(`         e.g. ${skippedPages.slice(0, 3).map((r) => r.page).join(', ')}`);
}

console.log('\nfailure classes:');
[...classes.entries()].sort((a, b) => b[1].length - a[1].length).forEach(([c, ps]) => {
  console.log(`  ${String(ps.length).padStart(4)} ${pct(ps.length).padStart(6)}  ${c}`);
  console.log(`         e.g. ${ps.slice(0, 3).join(', ')}`);
});

console.log('\nblock usage (pages emitting each block):');
[...blockUse.entries()].sort((a, b) => b[1] - a[1]).forEach(([b, n]) => {
  console.log(`  ${String(n).padStart(4)} ${pct(n).padStart(6)}  ${b}`);
});

const linkLoss = scored.filter((r) => r.outLinks < r.srcLinks);
const iconPages = scored.filter((r) => r.iconWarnings > 0);
const imgPages = scored.filter((r) => r.droppedImages > 0);
const headPages = scored.filter((r) => r.droppedHeadings > 0);

console.log('\ncontent fidelity:');
console.log(`  pages losing links:        ${linkLoss.length} (${pct(linkLoss.length)})`);
console.log(`  pages with empty icons:    ${iconPages.length} (${pct(iconPages.length)})`);
console.log(`  pages dropping images:     ${imgPages.length} (${pct(imgPages.length)})`);
console.log(`  pages dropping headings:   ${headPages.length} (${pct(headPages.length)})`);
if (linkLoss.length) {
  console.log('  worst link loss:');
  linkLoss.sort((a, b) => (b.srcLinks - b.outLinks) - (a.srcLinks - a.outLinks))
    .slice(0, 10)
    .forEach((r) => console.log(`    -${r.srcLinks - r.outLinks}  ${r.page} (${r.srcLinks} -> ${r.outLinks})`));
}
if (headPages.length) {
  console.log('  worst heading loss:');
  headPages.sort((a, b) => b.droppedHeadings - a.droppedHeadings).slice(0, 10)
    .forEach((r) => console.log(`    -${r.droppedHeadings}  ${r.page}`));
}

writeFileSync(join(ROOT, '.scratch', 'sweep-results.json'), JSON.stringify(results, null, 2));
console.log('\nper-page detail written to .scratch/sweep-results.json');
