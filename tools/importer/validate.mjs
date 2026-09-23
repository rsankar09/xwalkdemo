/* global document */
/*
 * Post-migration validation harness.
 *
 * Renders fixtures through the real loadPage() pipeline in Chromium and
 * asserts the two things the migration was reported broken on:
 *   1. header/footer actually populate from their fragment documents
 *   2. data-aue-* instrumentation survives block decoration, so Universal
 *      Editor can bind fields
 *
 * Uses puppeteer-core against a system Chrome rather than puppeteer, so the
 * repo does not pull a ~200MB browser download; the bundled Chromium also
 * fails to spawn on arm64 here (errno -88). Override with CHROME_PATH.
 *
 * Usage: node tools/importer/validate.mjs [baseUrl]
 */
import { existsSync } from 'fs';
import puppeteer from 'puppeteer-core';

const CHROME_CANDIDATES = [
  process.env.CHROME_PATH,
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
].filter(Boolean);

function resolveChrome() {
  const found = CHROME_CANDIDATES.find((p) => existsSync(p));
  if (!found) {
    throw new Error(`No Chrome found. Set CHROME_PATH. Tried:\n  ${CHROME_CANDIDATES.join('\n  ')}`);
  }
  return found;
}

const BASE = process.argv[2] || 'http://localhost:3000';
const WIDTHS = [375, 768, 1440];

const results = [];
const record = (page, name, pass, detail) => {
  results.push({
    page, name, pass, detail,
  });
  console.log(`  ${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
};

async function withPage(browser, path, width, fn) {
  const page = await browser.newPage();
  await page.setViewport({ width, height: 900 });
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(`${BASE}${path}`, { waitUntil: 'networkidle0' });
  await new Promise((r) => { setTimeout(r, 700); });
  await fn(page, errors);
  await page.close();
}

async function checkChrome(browser, path, label) {
  console.log(`\n[${label}] ${path}`);
  await withPage(browser, path, 1440, async (page, errors) => {
    const header = await page.evaluate(() => {
      const h = document.querySelector('header');
      return {
        links: h ? h.querySelectorAll('a[href]').length : 0,
        hasNav: !!h?.querySelector('nav'),
        height: h ? h.getBoundingClientRect().height : 0,
      };
    });
    record(
      label,
      'header populated',
      header.links > 5 && header.height > 0,
      `${header.links} links, nav=${header.hasNav}, h=${Math.round(header.height)}px`,
    );

    const footer = await page.evaluate(() => {
      const f = document.querySelector('footer');
      return {
        links: f ? f.querySelectorAll('a[href]').length : 0,
        height: f ? f.getBoundingClientRect().height : 0,
      };
    });
    record(
      label,
      'footer populated',
      footer.links > 5 && footer.height > 0,
      `${footer.links} links, h=${Math.round(footer.height)}px`,
    );

    record(
      label,
      'no console errors',
      errors.length === 0,
      errors.slice(0, 3).join(' | ') || 'clean',
    );
  });

  // horizontal overflow across breakpoints
  const overflow = [];
  // sequential on purpose: one viewport at a time
  await WIDTHS.reduce(async (prev, w) => {
    await prev;
    return withPage(browser, path, w, async (page) => {
      const over = await page.evaluate(() => document.documentElement.scrollWidth
        > document.documentElement.clientWidth);
      if (over) overflow.push(w);
    });
  }, Promise.resolve());
  record(
    label,
    'no horizontal overflow',
    overflow.length === 0,
    overflow.length ? `overflows at ${overflow.join(', ')}` : '375/768/1440 clean',
  );
}

async function checkInstrumentation(browser) {
  const path = '/drafts/ue-instrumented';
  console.log(`\n[ue] ${path}`);
  await withPage(browser, path, 1440, async (page, errors) => {
    const loaded = await page.evaluate(() => performance
      .getEntriesByType('resource')
      .some((r) => r.name.includes('editor-support.js')));
    record(
      'ue',
      'editor-support.js loaded',
      loaded,
      loaded ? 'imported by loadLazy' : 'NOT imported — UE gets no aue:content-* handling',
    );

    // every authored field must still be reachable after decoration
    const probes = await page.evaluate(() => {
      const q = (sel) => !!document.querySelector(sel);
      return {
        heroImage: q('.hero-billboard [data-aue-prop="image"]'),
        heroCopy: q('.hero-billboard [data-aue-prop="copy"]'),
        heroCta: q('.hero-billboard [data-aue-prop="cta"]'),
        subCopy: q('.email-subscribe [data-aue-prop="copy"]'),
        subForm: q('.email-subscribe [data-aue-prop="form_action"]'),
        subConsent: q('.email-subscribe [data-aue-prop="consent"]'),
        cardItems: document.querySelectorAll('.feature-card [data-aue-model="feature-card-item"]').length,
        cardImages: document.querySelectorAll('.feature-card [data-aue-prop="image"]').length,
        blockResources: document.querySelectorAll('[data-aue-resource]').length,
      };
    });

    record(
      'ue',
      'hero-billboard image field editable',
      probes.heroImage,
      probes.heroImage ? 'data-aue-prop=image survived' : 'LOST — media cell discarded',
    );
    record('ue', 'hero-billboard copy field editable', probes.heroCopy);
    record('ue', 'hero-billboard cta field editable', probes.heroCta);
    record('ue', 'email-subscribe copy field editable', probes.subCopy);
    record(
      'ue',
      'email-subscribe form_action editable',
      probes.subForm,
      probes.subForm ? 'moved onto generated field' : 'LOST — form cell discarded',
    );
    record(
      'ue',
      'email-subscribe consent editable',
      probes.subConsent,
      probes.subConsent ? 'moved onto generated label' : 'LOST — consent cell discarded',
    );
    record(
      'ue',
      'feature-card items instrumented',
      probes.cardItems === 2,
      `${probes.cardItems}/2 items`,
    );
    record(
      'ue',
      'feature-card images instrumented',
      probes.cardImages === 2,
      `${probes.cardImages}/2 images`,
    );
    record(
      'ue',
      'block resources intact',
      probes.blockResources >= 5,
      `${probes.blockResources} data-aue-resource nodes`,
    );
    record(
      'ue',
      'no console errors',
      errors.length === 0,
      errors.slice(0, 3).join(' | ') || 'clean',
    );
  });
}

(async () => {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox'],
    executablePath: resolveChrome(),
  });
  try {
    await checkChrome(browser, '/drafts/home/nyl-home', 'home');
    await checkInstrumentation(browser);
  } finally {
    await browser.close();
  }

  const failed = results.filter((r) => !r.pass);
  console.log(`\n${'='.repeat(60)}`);
  console.log(`${results.length - failed.length}/${results.length} checks passed`);
  if (failed.length) {
    console.log('\nFailures:');
    failed.forEach((f) => console.log(`  [${f.page}] ${f.name} — ${f.detail}`));
  }
  process.exit(failed.length ? 1 : 0);
})();
