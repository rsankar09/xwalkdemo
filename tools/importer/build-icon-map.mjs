/*
 * Regenerates the SVG_ICONS fingerprint table in import.js from icons/*.svg.
 *
 * The source markup inlines unnamed <svg> elements, so the importer cannot
 * derive an icon token from the DOM — it matches the artwork instead.
 * The key is viewBox + the first 32 characters of the first path's `d`;
 * viewBox alone collides (heart and heartbeat are both "0 0 49 44").
 *
 * Usage: node tools/importer/build-icon-map.mjs
 * Copy the printed object over SVG_ICONS in tools/importer/import.js.
 */

import { readdirSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const ICONS = join(ROOT, 'icons');

const map = {};
const skipped = [];

readdirSync(ICONS)
  .filter((f) => f.endsWith('.svg'))
  .sort()
  .forEach((file) => {
    const svg = readFileSync(join(ICONS, file), 'utf-8');
    const viewBox = /viewBox="([^"]+)"/.exec(svg);
    const d = /\sd="([^"]{0,48})/.exec(svg);
    if (!viewBox || !d) {
      skipped.push(file);
      return;
    }
    const key = `${viewBox[1].trim()}|${d[1].replace(/\s+/g, ' ').slice(0, 32)}`;
    const name = file.replace(/\.svg$/, '');
    if (map[key]) {
      console.error(`COLLISION: ${map[key]} and ${name} share key "${key}"`);
    }
    map[key] = name;
  });

console.log('const SVG_ICONS = {');
Object.entries(map).forEach(([k, v]) => {
  console.log(`  '${k.replace(/'/g, "\\'")}': '${v}',`);
});
console.log('};');

if (skipped.length) {
  console.error(`\nskipped (no viewBox or path): ${skipped.join(', ')}`);
}
