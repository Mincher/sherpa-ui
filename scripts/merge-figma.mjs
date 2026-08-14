#!/usr/bin/env node
/**
 * merge-figma.mjs — inject the real Figma read into each component's def.json.
 *
 * Reads:
 *   scripts/figma-data/figma-read.json  — raw bridge read (source of truth)
 *   scripts/figma-data/name-map.json    — code (sherpa-*) ↔ Figma page name
 *
 * For each def, replaces its `figma` block with the mapped Figma component's
 * real variant axes, boolean/text/instance props, mode pins, and events, plus a
 * `figma._status` (matched | no-figma). Auto defs (generated:true) are updated;
 * enriched defs (generated:false) are SKIPPED unless --force (then merged, but
 * hand-authored top-level fields are preserved — only the `figma` block changes).
 *
 * Usage:
 *   node scripts/merge-figma.mjs           # merge into all defs
 *   node scripts/merge-figma.mjs --force   # also update enriched (generated:false)
 *   node scripts/merge-figma.mjs --dry     # report, don't write
 */
import { readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const COMPONENTS = join(ROOT, 'src', 'components');
const DATA = join(ROOT, 'scripts', 'figma-data');

const args = process.argv.slice(2);
const DRY = args.includes('--dry');
const FORCE = args.includes('--force');

const read = (p) => JSON.parse(readFileSync(p, 'utf8'));
const figmaRead = read(join(DATA, 'figma-read.json')).pages;
const nameMap = read(join(DATA, 'name-map.json')).map;

let matched = 0, noFigma = 0, skipped = 0, missing = 0;

for (const name of readdirSync(COMPONENTS)) {
  const defPath = join(COMPONENTS, name, `${name}.def.json`);
  if (!existsSync(defPath)) continue;
  const def = read(defPath);

  const entry = nameMap[name];
  if (!entry) { console.warn(`no map entry: ${name}`); missing++; continue; }

  // Build the figma block from the read (or a no-figma stub).
  let figma;
  if (entry.status === 'no-figma' || !entry.figma) {
    figma = { _status: 'no-figma', figmaName: null, note: entry.note ?? 'no Figma component' };
    noFigma++;
  } else {
    const fig = figmaRead[entry.figma];
    if (!fig) { console.warn(`map points at missing Figma page: ${name} → ${entry.figma}`); missing++; continue; }
    figma = {
      _status: 'matched',
      figmaName: entry.figma,
      nodeType: fig.nodeType,
      built: fig.built,
      variantAxes: fig.variantAxes,
      booleanProps: fig.boolProps,
      textProps: fig.textProps,
      instanceProps: fig.instanceProps,
      modePins: fig.modePins,
      figmaEvents: fig.events,
      ...(entry.note ? { note: entry.note } : {}),
    };
    matched++;
  }

  // Enriched files: skip unless --force. When forced, replace ONLY the figma block.
  if (def.generated === false && !FORCE) {
    console.log(`skip (enriched): ${name} — use --force to merge figma block`);
    skipped++;
    continue;
  }

  def.figma = figma;
  if (!DRY) writeFileSync(defPath, JSON.stringify(def, null, 2) + '\n');
}

console.log(`\nmatched:${matched}  no-figma:${noFigma}  skipped:${skipped}  missing:${missing}${DRY ? '  (dry-run)' : ''}`);
