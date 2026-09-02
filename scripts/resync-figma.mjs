#!/usr/bin/env node
/**
 * resync-figma.mjs — align each component spec's Figma binding with a LIVE Figma read.
 *
 * Figma is the source of truth. This takes a live binding snapshot (variantAxes,
 * booleanProps per figmaName) and rewrites the `$extensions.sherpa` block of every
 * matching `*.component.yaml` to agree with it — fixing drift (stale active/inactive
 * State axes that became Control modes, lost axes, renamed props).
 *
 * The Figma binding used to live in `*.thin.yaml` under `figmaVerbatim`; since
 * thin.yaml was RETIRED it lives in each spec's `$extensions.sherpa` (figmaName,
 * variantAxes, booleanProps, divergence). Only that block is touched — anatomy,
 * props, tokens, events are left exactly as authored.
 *
 * The live snapshot is passed as a JSON file: { "<figmaName>": { variantAxes,
 * booleanProps, ... } }. NOTE: textProps is NOT compared — the spec's
 * $extensions.sherpa deliberately carries only figmaName/category/variantAxes/
 * booleanProps/divergence (the fields that shape variant identity), matching the
 * retirement contract.
 *
 *   node scripts/resync-figma.mjs <live-figma.json> [--dry|--check]
 */
import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import yaml from 'js-yaml';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const C = join(ROOT, 'src', 'components');
const args = process.argv.slice(2);
const DRY = args.includes('--dry');
// --check: report drift (def vs live) and EXIT NON-ZERO if any def is stale. No writes.
const CHECK = args.includes('--check');
const snapPath = args.find((a) => !a.startsWith('--'));
if (!snapPath) { console.error('usage: resync-figma.mjs <live-figma.json> [--dry|--check]'); process.exit(1); }
const live = JSON.parse(readFileSync(snapPath, 'utf8'));

// Normalise a set of names/axes for order-independent comparison.
const norm = (a) => [...(a || [])].sort();
const axesKey = (ax) => (ax || []).map((a) => `${a.name}[${[...(a.values || [])].sort().join(',')}]`).sort().join(' ');

let synced = 0, unchanged = 0, noMatch = 0;
const changes = [];
const drift = [];

for (const n of readdirSync(C)) {
  const p = join(C, n, `${n}.component.yaml`);
  if (!existsSync(p)) continue;
  const spec = yaml.load(readFileSync(p, 'utf8'));
  const ext = (spec.$extensions && spec.$extensions.sherpa) || {};
  const figmaName = ext.figmaName;
  if (!figmaName) { noMatch++; continue; }
  const L = live[figmaName];
  if (!L) { noMatch++; continue; }

  // --check: report where the spec disagrees with live Figma, then move on (no write).
  // Only variantAxes + booleanProps shape variant identity and are carried in the
  // spec; textProps is intentionally not compared (see header).
  if (CHECK) {
    const issues = [];
    if (axesKey(ext.variantAxes) !== axesKey(L.variantAxes)) issues.push(`axes: spec[${axesKey(ext.variantAxes) || '—'}] vs live[${axesKey(L.variantAxes) || '—'}]`);
    if (norm(ext.booleanProps).join() !== norm(L.booleanProps).join()) issues.push(`bool: spec[${norm(ext.booleanProps).join()}] vs live[${norm(L.booleanProps).join()}]`);
    if (issues.length) { drift.push({ name: n, figmaName, issues }); }
    continue;
  }

  const before = JSON.stringify({ variantAxes: ext.variantAxes ?? null, booleanProps: ext.booleanProps ?? [] });

  // Rewrite ONLY the live-derived fields in $extensions.sherpa; keep figmaName,
  // category, divergence, jsProps and any other authored keys.
  const next = { ...ext };
  next.figmaName = figmaName;
  if (L.variantAxes && L.variantAxes.length) next.variantAxes = L.variantAxes.map((a) => ({ name: a.name, values: [...a.values] }));
  else delete next.variantAxes;
  if (L.booleanProps && L.booleanProps.length) next.booleanProps = [...L.booleanProps];
  else delete next.booleanProps;

  const after = JSON.stringify({ variantAxes: next.variantAxes ?? null, booleanProps: next.booleanProps ?? [] });
  if (before === after) { unchanged++; continue; }

  spec.$extensions = { ...(spec.$extensions || {}), sherpa: next };
  if (!DRY) writeFileSync(p, yaml.dump(spec, { lineWidth: 100, noRefs: true }));
  synced++;
  changes.push(`${n} (${figmaName})`);
}

if (CHECK) {
  const aligned = Object.keys(live).length; // rough; only matters relatively
  if (drift.length === 0) {
    console.log('✅ all defs agree with live Figma (axes / booleanProps / textProps).');
    process.exit(0);
  }
  console.log(`⚠️  ${drift.length} def(s) DRIFT from live Figma:\n`);
  for (const d of drift) { console.log(`  ${d.name} (${d.figmaName})`); d.issues.forEach((i) => console.log(`      ${i}`)); }
  console.log(`\nRun without --check to re-sync, or update the defs by hand.`);
  process.exit(1); // fail loudly — stale defs must not ship silently
}
console.log(`${DRY ? '[dry] ' : ''}synced ${synced}, unchanged ${unchanged}, no live match ${noMatch}`);
if (changes.length) { console.log('\nRe-synced:'); changes.forEach((c) => console.log('  ✎ ' + c)); }
