/*
 * Derives the expected import row/cell contract from the block model
 * partials, so the QA harness asserts against the models themselves rather
 * than a hand-copied table that can silently go stale.
 *
 * Rules (see the eds-import-transform contract):
 *  - a model's fields collapse into ordered GROUPS
 *  - `group_field` belongs to group `group`
 *  - companion suffixes (Alt, Text, Type, Title, MimeType) collapse into
 *    their base property when that base exists
 *  - simple block    -> one ROW per group, each of one cell
 *  - container block -> one row per item, one CELL per group of the item model
 */

import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const COMPANION_SUFFIXES = ['MimeType', 'Alt', 'Text', 'Type', 'Title'];

/**
 * Resolves the group a field name belongs to.
 * @param {string} name The field name
 * @param {Set<string>} all Every field name in the model
 * @returns {string} The group key
 */
function groupOf(name, all) {
  if (name.includes('_')) return name.split('_')[0];
  const companion = COMPANION_SUFFIXES.find(
    (s) => name.length > s.length && name.endsWith(s) && all.has(name.slice(0, -s.length)),
  );
  return companion ? name.slice(0, -companion.length) : name;
}

/**
 * Reduces a model's fields to its ordered group list.
 * @param {object} model The model definition
 * @returns {string[]} Ordered group keys
 */
export function groupsOf(model) {
  const all = new Set((model.fields || []).map((f) => f.name));
  const groups = [];
  (model.fields || []).forEach((f) => {
    const g = groupOf(f.name, all);
    if (!groups.includes(g)) groups.push(g);
  });
  return groups;
}

/**
 * Reads every block model partial and works out each block's contract.
 * @param {string} root Repository root
 * @returns {object} Map of block class -> contract
 */
export function readContracts(root) {
  const blocksDir = join(root, 'blocks');
  const contracts = {};

  readdirSync(blocksDir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .forEach((d) => {
      const partial = join(blocksDir, d.name, `_${d.name}.json`);
      if (!existsSync(partial)) return;
      const json = JSON.parse(readFileSync(partial, 'utf-8'));
      const models = Object.fromEntries((json.models || []).map((m) => [m.id, m]));

      const itemDef = (json.definitions || []).find((def) => (
        def.plugins?.xwalk?.page?.resourceType?.endsWith('/block/item')
      ));
      const blockDef = (json.definitions || []).find((def) => (
        def.plugins?.xwalk?.page?.resourceType?.endsWith('/block/v1/block')
      ));

      if (itemDef) {
        const model = models[itemDef.plugins.xwalk.page.template.model];
        if (!model) return;
        contracts[d.name] = {
          block: d.name,
          kind: 'container',
          groups: groupsOf(model),
          cellsPerRow: groupsOf(model).length,
        };
        return;
      }
      if (blockDef) {
        const model = models[blockDef.plugins.xwalk.page.template.model];
        if (!model) return;
        const groups = groupsOf(model);
        contracts[d.name] = {
          block: d.name,
          kind: 'simple',
          groups,
          rows: groups.length,
          cellsPerRow: 1,
        };
      }
    });

  return contracts;
}
