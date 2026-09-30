#!/usr/bin/env node
/**
 * check-extensions.mjs — guard `src/styles/tokens/figma.extensions.json`.
 *
 * That file is HAND-MAINTAINED: the DTCG export cannot carry an override
 * collection. The plugin API can, but only through the COLLECTION's
 * `variableOverrides` — TRAP T-an-override-collection-is-keyed-by-its-parent.
 * Will's ruling 2026-09-24: read what a task needs live through the
 * figma-console MCP, and hand-patch this file when a value changes.
 *
 * A hand-patch is exactly where a whole collection can quietly collapse onto
 * its sibling, so this checks the shape a good file has:
 *
 *   node scripts/check-extensions.mjs
 */
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const FILE = join(ROOT, 'src', 'styles', 'tokens', 'figma.extensions.json');

/** Every collection the projector reads, and how many variables it carries. */
const EXPECTED = {
  // The two looks hold only what they OVERRIDE, as refs — the rest is Style's.
  'style-transparent': 7,
  'style-saturated': 8,
  // Density overrides SPACE and SIZE only — 27 each. The rest was a stale copy
  // of the ramp, and painted an old success green. TRAP T-a-density-mode-is-one-step
  'display-compact': 27,
  'display-comfortable': 27,
  vertical: 8,
  'grid-top': 8,
  'grid-mid': 8,
  'grid-bottom': 8,
  'data-viz-status': 11,
  'data-viz-set-2': 11,
};

/**
 * Pairs that MUST differ. Each shares a parent collection, so a bad capture —
 * or a copy-paste patch — makes them identical, which is the silent failure
 * this file exists to catch. The numbers are MEASURED from the known-good file,
 * not guessed — a wrong constant here reads as drift in the data.
 */
const MUST_DIFFER = [
  ['style-transparent', 'style-saturated', 53],
  ['display-compact', 'display-comfortable', 50],
  ['data-viz-status', 'data-viz-set-2', 55],
  ['vertical', 'grid-top', 14],
  ['grid-top', 'grid-mid', 8],
  ['grid-mid', 'grid-bottom', 8],
];

const problems = [];
const note = (msg) => problems.push(msg);

if (!existsSync(FILE)) {
  console.error('check-extensions: figma.extensions.json is MISSING');
  process.exit(1);
}
const doc = JSON.parse(readFileSync(FILE, 'utf8'));

for (const [slug, count] of Object.entries(EXPECTED)) {
  const coll = doc[slug];
  if (!coll) {
    note(`${slug}: missing`);
    continue;
  }
  const n = Object.keys(coll.vars ?? {}).length;
  if (!n) note(`${slug}: carries NO variables`);
  // A count that MOVED is worth saying out loud — Figma gained or lost one.
  else if (n !== count) note(`${slug}: ${n} variables, expected ${count}`);
  if (!coll.defaultMode) note(`${slug}: no defaultMode`);
  if (!coll.collectionId) note(`${slug}: no collectionId`);
}

const countDiff = (a, b) => {
  const va = doc[a]?.vars ?? {};
  const vb = doc[b]?.vars ?? {};
  let n = 0;
  for (const name of new Set([...Object.keys(va), ...Object.keys(vb)])) {
    for (const mode of new Set([...Object.keys(va[name] ?? {}), ...Object.keys(vb[name] ?? {})])) {
      // A look value can be an object ({ ref, opacity }), so compare by content.
      if (JSON.stringify(va[name]?.[mode]) !== JSON.stringify(vb[name]?.[mode])) n++;
    }
  }
  return n;
};

for (const [a, b, want] of MUST_DIFFER) {
  if (!doc[a] || !doc[b]) continue;
  const got = countDiff(a, b);
  if (got === 0) note(`${a} and ${b} are IDENTICAL — one has collapsed onto the other`);
  else if (got !== want) note(`${a} vs ${b}: ${got} differences, expected ${want}`);
}

const total = Object.values(doc).reduce((n, c) => n + Object.keys(c.vars ?? {}).length, 0);

if (problems.length) {
  for (const p of problems) console.error(`  ✗ ${p}`);
  console.error(`\ncheck-extensions: ${problems.length} problem(s) in figma.extensions.json`);
  process.exit(1);
}
console.log(`check-extensions: ${Object.keys(doc).length} collections, ${total} variables, all consistent`);
