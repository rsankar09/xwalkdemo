/*
 * Retire capture directories that a newer crawler has superseded.
 *
 * Two things make this less trivial than `rm -rf`:
 *
 *   1. The crawler's slug scheme changed (`/` used to collapse to `-`, now
 *      to `--`), so a re-crawl writes a NEW directory beside the old one
 *      rather than replacing it. The old one is dead weight but looks
 *      identical to a live capture.
 *   2. A capture directory can hold analysis that the crawler never wrote
 *      and cannot regenerate — inventory.json, mapping.json,
 *      mapping-notes.json, crops/. capture/ is gitignored, so deleting
 *      those is unrecoverable.
 *
 * So: freshness is decided by meta.json's collector_fingerprint, and any
 * directory holding analysis is REFUSED rather than deleted, with the
 * successor named so the artifacts can be moved first.
 *
 * Usage:
 *   node tools/importer/prune-captures.mjs            # report only
 *   node tools/importer/prune-captures.mjs --migrate  # move artifacts to the successor
 *   node tools/importer/prune-captures.mjs --delete   # delete superseded dirs
 */

import {
  readdirSync, readFileSync, existsSync, rmSync, renameSync, mkdirSync,
} from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const CAPTURE = join(ROOT, 'capture');
const DELETE = process.argv.includes('--delete');
const MIGRATE = process.argv.includes('--migrate');

/** Files a crawler never produces, so they can never be re-fetched. */
const ANALYSIS = ['inventory.json', 'mapping.json', 'mapping-notes.json', 'crops'];

/**
 * Re-implements the crawler's slugify so a stale directory can be matched
 * to the directory that replaced it.
 * @param {string} url The page URL
 * @returns {string} The capture directory name
 */
function slugify(url) {
  const u = new URL(url);
  const p = u.pathname.replace(/\.(html?|php|aspx)$/i, '').replace(/^\/|\/$/g, '');
  const slug = (p || 'index').replace(/[^a-z0-9/-]+/gi, '-').replace(/\//g, '--').toLowerCase();
  return slug || 'index';
}

const dirs = readdirSync(CAPTURE, { withFileTypes: true })
  .filter((d) => d.isDirectory())
  .map((d) => d.name);

const entries = dirs.map((name) => {
  let meta = null;
  try {
    meta = JSON.parse(readFileSync(join(CAPTURE, name, 'meta.json'), 'utf8'));
  } catch { /* unreadable */ }
  return {
    name,
    url: meta?.url || null,
    fingerprint: meta?.collector_fingerprint || null,
    artifacts: ANALYSIS.filter((f) => existsSync(join(CAPTURE, name, f))),
  };
});

// The current collector is whichever fingerprint the most captures carry.
const counts = new Map();
entries.forEach((e) => {
  if (e.fingerprint) counts.set(e.fingerprint, (counts.get(e.fingerprint) || 0) + 1);
});
const current = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];

if (!current) {
  console.log('No capture carries a collector_fingerprint — nothing to compare against.');
  process.exit(0);
}

const fresh = entries.filter((e) => e.fingerprint === current);
const stale = entries.filter((e) => e.fingerprint !== current);
const freshNames = new Set(fresh.map((e) => e.name));

console.log(`current collector: ${current}`);
console.log(`fresh: ${fresh.length}   superseded: ${stale.length}\n`);

const blocked = [];
const removable = [];

stale.forEach((e) => {
  const successor = e.url ? slugify(e.url) : null;
  const replaced = successor && freshNames.has(successor);
  if (e.artifacts.length) {
    blocked.push({ ...e, successor, replaced });
  } else if (replaced) {
    removable.push({ ...e, successor });
  }
  // a stale dir with no successor is left alone: it was never re-crawled,
  // so deleting it would lose the only copy of that page
});

if (blocked.length) {
  console.log(`HOLDS ANALYSIS (${blocked.length}) — not deletable without moving it first:`);
  blocked.forEach((e) => console.log(
    `  ${e.name}  [${e.artifacts.join(', ')}]  -> successor: ${e.successor}`
    + `${e.replaced ? '' : ' (NOT re-crawled yet)'}`,
  ));
  console.log();
}

if (MIGRATE) {
  let moved = 0;
  blocked.filter((e) => e.replaced).forEach((e) => {
    e.artifacts.forEach((f) => {
      const from = join(CAPTURE, e.name, f);
      const to = join(CAPTURE, e.successor, f);
      if (existsSync(to)) {
        console.log(`  skip ${e.successor}/${f} — already present`);
        return;
      }
      mkdirSync(dirname(to), { recursive: true });
      renameSync(from, to);
      console.log(`  moved ${e.name}/${f} -> ${e.successor}/${f}`);
      moved += 1;
    });
  });
  console.log(`\nmigrated ${moved} artifact(s). Re-run to confirm nothing is still blocked.`);
  process.exit(0);
}

console.log(`SUPERSEDED AND SAFE TO DELETE (${removable.length}):`);
removable.slice(0, 5).forEach((e) => console.log(`  ${e.name} -> ${e.successor}`));
if (removable.length > 5) console.log(`  ... and ${removable.length - 5} more`);

const orphans = stale.filter((e) => !e.artifacts.length
  && !(e.url && freshNames.has(slugify(e.url))));
if (orphans.length) {
  console.log(`\nSTALE BUT NOT RE-CRAWLED (${orphans.length}) — kept, they are the only copy:`);
  orphans.slice(0, 5).forEach((e) => console.log(`  ${e.name}`));
  if (orphans.length > 5) console.log(`  ... and ${orphans.length - 5} more`);
}

if (DELETE) {
  if (blocked.some((e) => e.replaced)) {
    console.log('\nREFUSING to delete: run with --migrate first, analysis would be lost.');
    process.exit(1);
  }
  removable.forEach((e) => rmSync(join(CAPTURE, e.name), { recursive: true, force: true }));
  console.log(`\ndeleted ${removable.length} superseded capture(s).`);
} else {
  console.log('\n(report only — pass --migrate then --delete to act)');
}
