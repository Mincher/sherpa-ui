#!/usr/bin/env node
/**
 * figma-export-extensions.mjs — the would-be regenerator for
 * `src/styles/tokens/figma.extensions.json`, and the GATE that stops a wrong
 * one being written.
 *
 * **It cannot regenerate the file yet, and the reason is in Figma, not here.**
 * An override collection's variables key `valuesByMode` by their PARENT
 * collection's mode ids; the collection's OWN mode ids appear nowhere in the
 * chain. Measured 2026-09-24 across all ten: zero overlap, every time. So a
 * plugin read returns the BASE value and every override collapses to the same
 * numbers. TRAP T-an-override-collection-is-keyed-by-its-parent
 *
 *   node scripts/figma-export-extensions.mjs --print    # the capture code
 *   node scripts/figma-export-extensions.mjs <file>     # verify, then save
 *
 * The `<file>` path runs the checks below. They exist because a capture that
 * silently returns base values looks exactly like a good one — the numbers are
 * real, they are simply the wrong ones.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'src', 'styles', 'tokens', 'figma.extensions.json');

/**
 * The ten collections, and whose modes key each one. `parent: null` means the
 * collection keys by its own modes — which none of them actually do.
 */
const COLLECTIONS = [
  { slug: 'style-transparent', name: 'Transparent', parent: 'Style' },
  { slug: 'style-saturated', name: 'Saturated', parent: 'Style' },
  { slug: 'display-compact', name: 'compact', parent: 'Display Mode' },
  { slug: 'display-comfortable', name: 'comfortable', parent: 'Display Mode' },
  { slug: 'vertical', name: 'vertical', parent: 'Grouping' },
  { slug: 'grid-top', name: 'grid-top', parent: 'Grouping' },
  { slug: 'grid-mid', name: 'grid-mid', parent: 'Grouping' },
  { slug: 'grid-bottom', name: 'grid-bottom', parent: 'Grouping' },
  { slug: 'data-viz-status', name: 'Status', parent: 'Data Viz' },
  { slug: 'data-viz-set-2', name: 'Set 2', parent: 'Data Viz' },
];

/**
 * Pairs that MUST differ. Each shares a parent, so a capture that reads the
 * base value makes them identical — which is exactly the silent failure.
 * The counts are what the known-good cache holds.
 */
const MUST_DIFFER = [
  ['style-transparent', 'style-saturated', 54],
  ['display-compact', 'display-comfortable', 102],
  ['data-viz-status', 'data-viz-set-2', 55],
  ['vertical', 'grid-top', 14],
  ['grid-top', 'grid-mid', 8],
  ['grid-mid', 'grid-bottom', 8],
];

/** The code to run inside Figma. Self-contained — it takes no imports. */
function pluginCode() {
  return `
const WANTED = ${JSON.stringify(COLLECTIONS)};

const cache = new Map();
async function getVar(id) {
  if (!cache.has(id)) cache.set(id, await figma.variables.getVariableByIdAsync(id));
  return cache.get(id);
}
const byte = (n) => Math.round(Math.max(0, Math.min(1, n)) * 255).toString(16).padStart(2, '0');

/**
 * Resolve to {r,g,b,a} for a colour, or a primitive. A nested COMPOSE_COLOR
 * returns CHANNELS, never a hex string — returning a string drops every outer
 * alpha, which is how style-surface/shadow lost its 30%.
 */
async function resolve(val, modeId, depth) {
  if (depth > 16 || val == null) return null;
  const t = typeof val;
  if (t === 'number' || t === 'string' || t === 'boolean') return val;
  if (val.type === 'VARIABLE_ALIAS') {
    const v = await getVar(val.id);
    if (!v) return null;
    const keys = Object.keys(v.valuesByMode);
    const pick = keys.includes(modeId) ? modeId : keys[0];
    return resolve(v.valuesByMode[pick], modeId, depth + 1);
  }
  if (val.type === 'VARIABLE_EXPRESSION' && val.expressionFunction === 'COMPOSE_COLOR') {
    const col = await resolve(val.expressionArguments[0], modeId, depth + 1);
    let a = await resolve(val.expressionArguments[1], modeId, depth + 1);
    // Figma opacity is 0-100, NOT 0-1.
    a = typeof a === 'number' ? a / 100 : 1;
    if (col && typeof col === 'object' && 'r' in col) {
      const base = col.a == null ? 1 : col.a;
      return { r: col.r, g: col.g, b: col.b, a: base * a };
    }
    return col;
  }
  if (t === 'object' && 'r' in val) {
    return { r: val.r, g: val.g, b: val.b, a: val.a == null ? 1 : val.a };
  }
  return null;
}

const flatten = (c) =>
  c && typeof c === 'object' && 'r' in c
    ? '#' + byte(c.r) + byte(c.g) + byte(c.b) + (c.a >= 1 ? '' : byte(c.a))
    : c;

const all = await figma.variables.getLocalVariableCollectionsAsync();
const byName = new Map(all.map((c) => [c.name, c]));

const out = {};
const missing = [];
/* Does this collection's OWN mode id appear in its variables at all? If not,
   the capture below is reading the parent's value and every mode of this
   collection will come back the same. */
const unreadable = [];

for (const want of WANTED) {
  const coll = byName.get(want.name);
  if (!coll) { missing.push(want.name); continue; }
  const keying = want.parent ? byName.get(want.parent) : coll;
  if (!keying) { missing.push(want.parent + ' (parent of ' + want.name + ')'); continue; }

  const own = new Set(coll.modes.map((m) => m.modeId));
  let sawOwnMode = false;
  const vars = {};
  for (const id of coll.variableIds) {
    const v = await getVar(id);
    if (!v) continue;
    for (const k of Object.keys(v.valuesByMode)) if (own.has(k)) sawOwnMode = true;
    const row = {};
    for (const m of keying.modes) {
      row[m.name] = flatten(await resolve(v.valuesByMode[m.modeId], m.modeId, 0));
    }
    vars[v.name] = row;
  }
  if (!sawOwnMode) unreadable.push(want.slug);
  out[want.slug] = { collectionId: coll.id, defaultMode: keying.modes[0].name, vars };
}
return { captured: out, missing, unreadable };
`.trim();
}

const arg = process.argv[2];

if (!arg || arg === '--print') {
  process.stdout.write(pluginCode() + '\n');
  process.exit(0);
}

const captured = JSON.parse(readFileSync(arg, 'utf8'));
const payload = captured.captured ?? captured;
const fail = (msg) => {
  console.error(`refused: ${msg}`);
  console.error('  The cache was NOT written. See TRAP T-an-override-collection-is-keyed-by-its-parent.');
  process.exit(1);
};

const slugs = Object.keys(payload);
const absent = COLLECTIONS.map((c) => c.slug).filter((s) => !slugs.includes(s));
if (absent.length) fail(`${absent.length} collection(s) missing — ${absent.join(', ')}`);

const empty = slugs.filter((s) => !Object.keys(payload[s].vars ?? {}).length);
if (empty.length) fail(`${empty.length} collection(s) captured NO variables — ${empty.join(', ')}`);

if (captured.unreadable?.length) {
  fail(
    `${captured.unreadable.length} collection(s) never showed their OWN mode ids, so the ` +
      `capture read the PARENT's value — ${captured.unreadable.join(', ')}`,
  );
}

/* The real gate. A base-value read makes sibling collections identical. */
const countDiff = (a, b) => {
  const va = payload[a]?.vars ?? {};
  const vb = payload[b]?.vars ?? {};
  let n = 0;
  for (const name of new Set([...Object.keys(va), ...Object.keys(vb)])) {
    for (const mode of new Set([...Object.keys(va[name] ?? {}), ...Object.keys(vb[name] ?? {})])) {
      if (va[name]?.[mode] !== vb[name]?.[mode]) n++;
    }
  }
  return n;
};
const collapsed = MUST_DIFFER.map(([a, b, want]) => [a, b, want, countDiff(a, b)]).filter(
  ([, , , got]) => got === 0,
);
if (collapsed.length) {
  fail(
    `${collapsed.length} pair(s) came back IDENTICAL that must differ — ` +
      collapsed.map(([a, b, want]) => `${a}/${b} (expected ~${want} differences)`).join(', '),
  );
}

const before = JSON.parse(readFileSync(OUT, 'utf8'));
let changed = 0;
for (const slug of slugs) {
  const a = before[slug]?.vars ?? {};
  const b = payload[slug].vars;
  for (const name of new Set([...Object.keys(a), ...Object.keys(b)])) {
    for (const mode of new Set([...Object.keys(a[name] ?? {}), ...Object.keys(b[name] ?? {})])) {
      if (a[name]?.[mode] !== b[name]?.[mode]) changed++;
    }
  }
}

writeFileSync(OUT, JSON.stringify(payload, null, 2) + '\n');
console.log(`✓ ${slugs.length} collections written · ${changed} value(s) changed`);
console.log('  next: node scripts/project-tokens.mjs');
