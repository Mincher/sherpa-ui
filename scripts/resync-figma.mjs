#!/usr/bin/env node
/**
 * resync-figma.mjs — align each thin def's figmaVerbatim with a LIVE Figma read.
 *
 * Figma is the source of truth. This takes a live binding snapshot (variantAxes,
 * booleanProps, textProps per figmaName) and rewrites the figmaVerbatim block of
 * every matching thin def to agree with it — fixing drift the old figma-read.json
 * dump had accumulated (stale active/inactive State axes that became Control
 * modes, lost axes, renamed props).
 *
 * The live snapshot is passed as a JSON file: { "<figmaName>": { variantAxes,
 * booleanProps, textProps } }. Only the figma binding is touched — anatomy,
 * props, tokens are left exactly as they are.
 *
 *   node scripts/resync-figma.mjs <live-figma.json> [--dry]
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
  const p = join(C, n, `${n}.thin.yaml`);
  if (!existsSync(p)) continue;
  const def = yaml.load(readFileSync(p, 'utf8'));
  const L = live[def.figmaName];
  if (!L) { noMatch++; continue; }

  const fv = def.figmaVerbatim || def.figma || {};

  // --check: report where the def disagrees with live Figma, then move on (no write).
  if (CHECK) {
    const issues = [];
    if (axesKey(fv.variantAxes) !== axesKey(L.variantAxes)) issues.push(`axes: def[${axesKey(fv.variantAxes) || '—'}] vs live[${axesKey(L.variantAxes) || '—'}]`);
    if (norm(fv.booleanProps).join() !== norm(L.booleanProps).join()) issues.push(`bool: def[${norm(fv.booleanProps).join()}] vs live[${norm(L.booleanProps).join()}]`);
    if (norm(fv.textProps).join() !== norm(L.textProps).join()) issues.push(`text: def[${norm(fv.textProps).join()}] vs live[${norm(L.textProps).join()}]`);
    if (issues.length) { drift.push({ name: n, figmaName: def.figmaName, issues }); }
    continue;
  }

  const before = JSON.stringify({ variantAxes: fv.variantAxes, booleanProps: fv.booleanProps, textProps: fv.textProps });

  // Rewrite ONLY the live-derived fields; keep _status/figmaName/nodeType/note.
  const next = { ...fv };
  next._status = fv._status ?? 'matched';
  next.figmaName = def.figmaName;
  next.nodeType = L.type;
  next.built = fv.built ?? true;
  if (L.variantAxes) next.variantAxes = L.variantAxes.map((a) => ({ name: a.name, values: [...a.values] }));
  else delete next.variantAxes;
  next.booleanProps = [...(L.booleanProps || [])];
  next.textProps = [...(L.textProps || [])];
  next.instanceProps = fv.instanceProps ?? [];
  next.modePins = fv.modePins ?? {};
  next.figmaEvents = fv.figmaEvents ?? [];
  if (fv.note) next.note = fv.note;

  const after = JSON.stringify({ variantAxes: next.variantAxes, booleanProps: next.booleanProps, textProps: next.textProps });
  if (before === after) { unchanged++; continue; }

  def.figmaVerbatim = next;
  delete def.figma;
  if (!DRY) writeFileSync(p, yaml.dump(def, { lineWidth: 100, noRefs: true }));
  synced++;
  changes.push(`${n} (${def.figmaName})`);
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
