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
import yaml from 'js-yaml';
import { loadContract } from './lib/contract-io.mjs';
import { parseBehaviours } from './lib/parse-behaviour.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const COMPONENTS = join(ROOT, 'src', 'components');
const DATA = join(ROOT, 'scripts', 'figma-data');

const args = process.argv.slice(2);
const DRY = args.includes('--dry');
const FORCE = args.includes('--force');

const read = (p) => JSON.parse(readFileSync(p, 'utf8'));
const figmaRead = read(join(DATA, 'figma-read.json')).pages;  // machine dump — JSON
const nameMap = loadContract(join(DATA, 'name-map')).map;      // authored — YAML preferred

let matched = 0, noFigma = 0, skipped = 0, missing = 0;

for (const name of readdirSync(COMPONENTS)) {
  const thinPath = join(COMPONENTS, name, `${name}.thin.yaml`);
  if (!existsSync(thinPath)) continue;
  // Load the thin YAML RAW (not hydrated) so we edit only the figma block in
  // place and leave anatomy/props/events/tokens byte-for-byte untouched.
  const def = yaml.load(readFileSync(thinPath, 'utf8'));

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

  // Behaviour channel: parse a ```behaviour block from the component description
  // into a first-class `behaviours` field (runtime behaviour Figma can't model —
  // column pinning, sticky headers, scroll). Only when the read carries a description.
  const fig = figmaRead[entry?.figma];
  if (fig?.description) {
    const behaviours = parseBehaviours(fig.description);
    if (behaviours.length) def.behaviours = behaviours;
  }

  // Preserve figmaEvents from the existing block if the read didn't carry them.
  const prev = def.figmaVerbatim || def.figma;
  if (figma.figmaEvents == null && prev?.figmaEvents) figma.figmaEvents = prev.figmaEvents;
  // Write ONLY the figma binding; every other field stays exactly as authored.
  def.figmaVerbatim = figma;
  delete def.figma;
  if (!DRY) writeFileSync(thinPath, yaml.dump(def, { lineWidth: 100, noRefs: true }));
}

console.log(`\nmatched:${matched}  no-figma:${noFigma}  skipped:${skipped}  missing:${missing}${DRY ? '  (dry-run)' : ''}`);
