/*
 * Structural preflight for the migration.
 *
 * Every check here exists because the gap it closes actually bit us between
 * the home-page run and the article/product run. None of them are style
 * opinions; each one is a failure that shipped silently and was only found
 * by a human reading code much later:
 *
 *   1. blocks/table/ was referenced by the importer but never built. A
 *      hand-maintained suppression list in qa.mjs hid it for a whole run.
 *   2. New blocks were invisible in Universal Editor because nobody added
 *      them to the section allow-list in models/_section.json.
 *   3. The footer shipped an :icon: token with no matching /icons/*.svg,
 *      so every page 404'd on it.
 *   4. import.js and qa.mjs each keep their own copy of the "remove this
 *      chrome" selector list. They drifted, and the QA content-fidelity
 *      check reported phantom dropped links as a result.
 *   5. capture/mapping.json was written to the wrong path AND the wrong
 *      shape, so the component registry stayed empty and every component
 *      was re-analysed from scratch on the next page.
 *   6. Captures were produced by a crawler that was fixed afterwards, so
 *      styles.json had no component-level rects and bounding boxes were
 *      being estimated by hand.
 *
 * Usage: node tools/importer/preflight.mjs [--strict]
 *   --strict  treat warnings as failures too (use in CI)
 */

import {
  readdirSync, readFileSync, existsSync, statSync,
} from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as lib from '@adobe/helix-importer';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const STRICT = process.argv.includes('--strict');

const errors = [];
const warnings = [];
const fail = (check, msg) => errors.push(`${check}: ${msg}`);
const warn = (check, msg) => warnings.push(`${check}: ${msg}`);

const read = (p) => readFileSync(join(ROOT, p), 'utf-8');
const readJson = (p) => JSON.parse(read(p));
const has = (p) => existsSync(join(ROOT, p));

/** Block folders that carry a model partial, i.e. are authorable. */
function modelledBlocks() {
  return readdirSync(join(ROOT, 'blocks'), { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .filter((name) => has(`blocks/${name}/_${name}.json`));
}

/* ---------------------------------------------------------------- 1 */

/**
 * Every modelled block must be insertable into a section, or an author can
 * never place it. A block that is built, linted and shipped but missing
 * from this list is invisible in Universal Editor with no error anywhere.
 * @returns {void}
 */
function checkSectionAllowList() {
  const section = readJson('models/_section.json');
  const filter = (section.filters || []).find((f) => f.id === 'section');
  if (!filter) {
    fail('section-allow-list', 'models/_section.json has no `section` filter');
    return;
  }
  const allowed = new Set(filter.components || []);
  modelledBlocks().forEach((name) => {
    if (!allowed.has(name)) {
      fail('section-allow-list', `blocks/${name}/ is not in models/_section.json `
        + 'filters — authors cannot insert it in Universal Editor');
    }
  });
}

/* ---------------------------------------------------------------- 2 */

/**
 * A block folder needs its three files. A missing CSS or JS is usually a
 * half-finished block rather than a deliberate CSS-only one, so the
 * deliberate cases are allow-listed by being empty rather than absent.
 * @returns {void}
 */
function checkBlockFiles() {
  modelledBlocks().forEach((name) => {
    ['js', 'css'].forEach((ext) => {
      if (!has(`blocks/${name}/${name}.${ext}`)) {
        fail('block-files', `blocks/${name}/${name}.${ext} is missing`);
      }
    });
  });
}

/* ---------------------------------------------------------------- 3 */

/**
 * md2jcr resolves a block header to a component by EXACT title match, so a
 * child-item title that collides with a block title silently converts the
 * container against the item model. Enforce the naming rule that avoids it.
 * @returns {void}
 */
function checkModelTitles() {
  const titles = new Map();
  modelledBlocks().forEach((name) => {
    const json = readJson(`blocks/${name}/_${name}.json`);
    (json.definitions || []).forEach((def) => {
      const { title } = def;
      const type = def.plugins?.xwalk?.page?.resourceType || '';
      if (titles.has(title)) {
        fail('model-titles', `title "${title}" is declared by both `
          + `${titles.get(title)} and blocks/${name}/ — md2jcr resolves by `
          + 'exact title, so one will shadow the other');
      }
      titles.set(title, `blocks/${name}/`);

      if (type.endsWith('/block/item')) {
        const blockDef = (json.definitions || []).find((d) => (
          d.plugins?.xwalk?.page?.resourceType?.endsWith('/block/v1/block')
        ));
        // Only a genuine COLLISION breaks md2jcr, and that is caught above.
        // Off-convention item names are drift worth seeing but not worth
        // blocking a commit over — the boilerplate `cards` block ships as
        // "Card", and failing on it would block untouched vendor code.
        if (blockDef && title !== `${blockDef.title} Item`) {
          warn('model-titles', `item title "${title}" in blocks/${name}/ is not `
            + `"${blockDef.title} Item" — off the convention at the top of `
            + 'tools/importer/import.js (harmless unless it collides)');
        }
      }
    });
  });
}

/* ---------------------------------------------------------------- 4 */

/**
 * Every icon token referenced by code-shipped markup must have an SVG, or
 * the page 404s. Only files that ship with the code are scanned: authored
 * content can legitimately reference an icon that is added later.
 * @returns {void}
 */
function checkIcons() {
  const available = new Set(
    readdirSync(join(ROOT, 'icons'))
      .filter((f) => f.endsWith('.svg'))
      .map((f) => f.replace(/\.svg$/, '')),
  );

  const sources = [
    'blocks/header/nav.html',
    'blocks/footer/footer.html',
  ].filter((p) => has(p));

  sources.forEach((src) => {
    const html = read(src);
    const referenced = new Set();
    // rendered form: <span class="icon icon-name">
    [...html.matchAll(/class="[^"]*\bicon-([a-z0-9-]+)\b/g)].forEach((m) => referenced.add(m[1]));
    // authored form: :name:
    [...html.matchAll(/:([a-z0-9-]+):/g)].forEach((m) => referenced.add(m[1]));

    referenced.forEach((name) => {
      if (!available.has(name)) {
        fail('icons', `${src} references :${name}: but icons/${name}.svg does not exist`);
      }
    });
  });

  // Block JS that names icons directly. Matched on an `icon: 'name'`
  // property rather than on the rendered `icon-<name>` class, because that
  // class pattern also matches block names like `icon-list-card` and would
  // invent an icon called "list-card".
  modelledBlocks().forEach((name) => {
    const rel = `blocks/${name}/${name}.js`;
    if (!has(rel)) return;
    const js = read(rel);
    const referenced = [
      // `icon: 'facebook'` in a config object
      ...[...js.matchAll(/\bicon:\s*'([a-z0-9-]+)'/g)].map((m) => m[1]),
      // `createIcon('link')` — any helper whose name ends in Icon. No \b
      // before `Icon`: in `createIcon(` the preceding char is a word char,
      // so a word boundary never matches there.
      ...[...js.matchAll(/Icon\(\s*'([a-z0-9-]+)'/g)].map((m) => m[1]),
    ];
    new Set(referenced).forEach((icon) => {
      if (!available.has(icon)) {
        fail('icons', `blocks/${name}/${name}.js renders :${icon}: but `
          + `icons/${icon}.svg does not exist`);
      }
    });
  });

  // Icon tokens the importer can EMIT must also resolve, otherwise imported
  // pages 404 the moment they are authored.
  if (has('tools/importer/import.js')) {
    const js = read('tools/importer/import.js');
    const map = js.slice(js.indexOf('const SVG_ICONS'), js.indexOf('const RASTER_ICONS'));
    [...map.matchAll(/:\s*'([a-z0-9-]+)'/g)].forEach(([, name]) => {
      if (!available.has(name)) {
        fail('icons', `import.js can emit :${name}: but icons/${name}.svg does not exist`);
      }
    });
  }
}

/* ---------------------------------------------------------------- 5 */

/**
 * Extracts the quoted selectors from an array literal starting at `marker`.
 * @param {string} source File contents
 * @param {string} marker Substring that precedes the array literal
 * @returns {Set<string>} The selectors
 */
function selectorsAfter(source, marker) {
  const start = source.indexOf(marker);
  if (start === -1) return new Set();
  const open = source.indexOf('[', start);
  const close = source.indexOf(']', open);
  if (open === -1 || close === -1) return new Set();
  return new Set(
    [...source.slice(open, close).matchAll(/'([^']+)'/g)].map((m) => m[1]),
  );
}

/**
 * import.js runs inside the remote import service and cannot import a
 * shared module, so its chrome-removal list is necessarily duplicated in
 * the QA harness. Duplication is fine; DRIFT is not — anything the importer
 * removes that the harness keeps is counted as dropped content and produces
 * a phantom fidelity failure.
 * @returns {void}
 */
function checkRemovalListsAgree() {
  if (!has('tools/importer/import.js') || !has('tools/importer/qa.mjs')) return;
  const importer = selectorsAfter(read('tools/importer/import.js'), 'DOMUtils.remove(main');
  const qa = selectorsAfter(read('tools/importer/qa.mjs'), 'body.querySelectorAll([');
  if (!importer.size || !qa.size) {
    warn('removal-lists', 'could not parse one of the removal lists — check the markers');
    return;
  }
  [...importer].forEach((sel) => {
    if (!qa.has(sel)) {
      fail('removal-lists', `import.js removes "${sel}" but qa.mjs does not — `
        + 'the harness will report its content as dropped');
    }
  });
}

/* ---------------------------------------------------------------- 6 */

/**
 * A suppression entry that names a block which now exists is stale, and a
 * stale suppression hides real regressions. This is the specific mechanism
 * that let the missing `table` block survive an entire run.
 * @returns {void}
 */
function checkNoStaleSuppressions() {
  if (!has('tools/importer/qa.mjs')) return;
  const qa = read('tools/importer/qa.mjs');
  const set = selectorsAfter(qa, 'KNOWN_UNBUILT');
  [...set].forEach((name) => {
    if (has(`blocks/${name}/_${name}.json`)) {
      fail('stale-suppression', `qa.mjs KNOWN_UNBUILT still lists "${name}" but `
        + `blocks/${name}/ now exists — remove it or it will hide a regression`);
    }
  });
}

/* ---------------------------------------------------------------- 7 */

/**
 * The registry is keyed off capture/<page>/mapping.json being an ARRAY.
 * A mapping at the capture root, or wrapped in an object, leaves the
 * registry empty and silently forces every component to be re-analysed.
 * @returns {void}
 */
function checkMappingShape() {
  if (!has('capture')) return;

  if (has('capture/mapping.json')) {
    fail('mapping-shape', 'capture/mapping.json sits at the capture ROOT — '
      + 'registry.js reads capture/<page>/mapping.json, so this is invisible to it');
  }

  readdirSync(join(ROOT, 'capture'), { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .forEach((d) => {
      const rel = `capture/${d.name}/mapping.json`;
      if (!has(rel)) return;
      let parsed;
      try {
        parsed = readJson(rel);
      } catch {
        fail('mapping-shape', `${rel} is not valid JSON`);
        return;
      }
      if (!Array.isArray(parsed)) {
        fail('mapping-shape', `${rel} is an object, but the eds-block-mapping `
          + 'contract is a bare array — registry.js will throw on it');
      }
    });
}

/* ---------------------------------------------------------------- 8 */

/**
 * A mapping whose human gate still reads PENDING while its blocks are
 * already built means the decision was taken somewhere other than the
 * record. That is how the card-consolidation call ended up documented only
 * in prose, with the machine-readable gate still saying nobody had signed
 * off — which makes the whole approval trail untrustworthy.
 * @returns {void}
 */
function checkGateRecorded() {
  if (!has('capture')) return;
  readdirSync(join(ROOT, 'capture'), { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .forEach((d) => {
      const rel = `capture/${d.name}/mapping-notes.json`;
      if (!has(rel)) return;
      let notes;
      try {
        notes = readJson(rel);
      } catch {
        return;
      }
      const status = notes.human_gate?.status;
      if (status && status !== 'APPROVED') {
        warn('gate-recorded', `${rel} human_gate is "${status}" — if the work `
          + 'has shipped, record the decision there so the approval trail matches reality');
      }
    });
}

/**
 * A capture whose styles.json has no component-level rects was produced by
 * an older crawler. Detection then has nothing to crop from and bounding
 * boxes get estimated by hand, which is exactly how the home-page inventory
 * ended up with approximate rects nobody flagged.
 * @returns {void}
 */
function checkCaptureFreshness() {
  if (!has('capture')) return;
  const pages = readdirSync(join(ROOT, 'capture'), { withFileTypes: true })
    .filter((d) => d.isDirectory() && has(`capture/${d.name}/styles.json`))
    .map((d) => d.name);
  if (!pages.length) return;

  // Preferred signal: the crawler stamps meta.json with a fingerprint of
  // its own style collector. Captures made before that existed have none,
  // and for those we fall back to detecting the symptom directly — a
  // styles.json with no component-level nodes in it.
  const fingerprints = new Set();
  const shallow = [];

  pages.forEach((page) => {
    let fingerprint = null;
    try {
      fingerprint = readJson(`capture/${page}/meta.json`).collector_fingerprint || null;
    } catch { /* treat as unstamped */ }
    if (fingerprint) fingerprints.add(fingerprint);

    const rel = `capture/${page}/styles.json`;
    // cheap prefilter: a deep capture is far bigger than a chrome-only one
    if (statSync(join(ROOT, rel)).size > 150_000) return;
    let nodes;
    try {
      nodes = readJson(rel);
    } catch {
      return;
    }
    const withRects = nodes.filter((n) => /aem-GridColumn/.test(n.classes || ''));
    if (withRects.length < 3) shallow.push(page);
  });

  if (fingerprints.size > 1) {
    warn('capture-freshness', `captures were produced by ${fingerprints.size} `
      + 'different style collectors — they are not comparable, re-crawl the '
      + 'older ones before mapping across pages');
  }

  if (shallow.length) {
    warn('capture-freshness', `${shallow.length} of ${pages.length} captures have `
      + 'no component-level rects and predate the current crawler — re-crawl '
      + `before running detection on them (e.g. ${shallow.slice(0, 3).join(', ')})`);
  }
}

/* ---------------------------------------------------------------- 10 */

/**
 * Every `WebImporter.<ns>.<fn>` the transform calls must actually exist on
 * @adobe/helix-importer, and the qa.mjs stub must expose the same namespaces.
 *
 * This exists because `WebImporter.DOMUtils.createMetadata` was called for
 * the entire project: it is not a DOMUtils member (the real one is
 * `rules.createMetadata`), so every real import aborted — while qa.mjs
 * hand-stubbed the same wrong name onto its fake DOMUtils and reported the
 * full 1,221-page corpus green. A stub that disagrees with the library turns
 * the harness into a machine for confirming its own mistakes.
 * @returns {void}
 */
function checkWebImporterApi() {
  if (!has('tools/importer/import.js')) return;
  const src = read('tools/importer/import.js');
  const used = new Set(
    [...src.matchAll(/WebImporter\.([A-Za-z0-9_]+)\.([A-Za-z0-9_]+)/g)]
      .map((m) => `${m[1]}.${m[2]}`),
  );
  if (!used.size) return;

  const qa = has('tools/importer/qa.mjs') ? read('tools/importer/qa.mjs') : '';
  [...used].sort().forEach((path) => {
    const [ns, fn] = path.split('.');
    const namespace = lib[ns];
    if (!namespace) {
      fail('webimporter-api', `import.js calls WebImporter.${path} but `
        + `@adobe/helix-importer exports no "${ns}" — available: `
        + `${Object.keys(lib).join(', ')}`);
      return;
    }
    if (typeof namespace[fn] !== 'function') {
      const near = Object.entries(lib)
        .filter(([, v]) => v && typeof v[fn] === 'function')
        .map(([k]) => `WebImporter.${k}.${fn}`);
      const hint = near.length ? ` — did you mean ${near.join(' or ')}?` : '';
      fail('webimporter-api', `import.js calls WebImporter.${path} but "${fn}" `
        + `is not a function on ${ns}${hint}`);
      return;
    }
    // The call is real; now make sure the harness models the same namespace,
    // otherwise qa.mjs is exercising a different API than the importer.
    if (qa && !new RegExp(`\\b${ns}\\b`).test(qa)) {
      warn('webimporter-api', `import.js uses WebImporter.${ns} but qa.mjs `
        + 'never mentions it — the harness stub has drifted from the importer');
    }
  });
}

/* ---------------------------------------------------------------- run */

checkSectionAllowList();
checkBlockFiles();
checkModelTitles();
checkIcons();
checkRemovalListsAgree();
checkNoStaleSuppressions();
checkMappingShape();
checkGateRecorded();
checkCaptureFreshness();
checkWebImporterApi();

warnings.forEach((w) => console.log(`  warn  ${w}`));
errors.forEach((e) => console.log(`  FAIL  ${e}`));

const failed = errors.length || (STRICT && warnings.length);
console.log(failed
  ? `\npreflight FAILED — ${errors.length} error(s), ${warnings.length} warning(s)`
  : `\npreflight OK — ${warnings.length} warning(s)`);
process.exit(failed ? 1 : 0);
