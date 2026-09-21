#!/usr/bin/env node
/**
 * Diff a live Figma variable read against figma.tokens.json. Figma wins.
 * With --patch, rewrites the dump; otherwise exits non-zero on drift (CI gate).
 *
 *   node scripts/check-tokens.mjs <live-tokens.json> [--patch] [--collection=slug]
 *
 * BASE collections only — extension overrides read back EMPTY from `valuesByMode`.
 * Not drift: a hex where Figma holds `{primitives.…}`, hex case, a `{MISSING:…}`
 * cross-library target.
 */import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DUMP = join(ROOT, 'src/styles/tokens/figma.tokens.json');

const args = process.argv.slice(2);
const PATCH = args.includes('--patch');
const only = (args.find((a) => a.startsWith('--collection=')) || '').split('=')[1];
const livePath = args.find((a) => !a.startsWith('--'));
if (!livePath) {
  console.error('usage: check-tokens.mjs <live-tokens.json> [--patch] [--collection=slug]');
  process.exit(1);
}

const live = JSON.parse(readFileSync(livePath, 'utf8'));
const dumpRaw = readFileSync(DUMP, 'utf8');
const dump = JSON.parse(dumpRaw);

function* leaves(node, path = '') {
  if (!node || typeof node !== 'object') return;
  if ('$value' in node) {
    yield [path, node];
    return;
  }
  for (const [k, v] of Object.entries(node)) {
    if (k.startsWith('$')) continue;
    yield* leaves(v, path ? `${path}/${k}` : k);
  }
}

const fold = (v) => (typeof v === 'string' && v.startsWith('#') ? v.toLowerCase() : v);

/** `modes` holds only NON-PRIMARY modes; the primary one is the leaf's `$value`. */
function dumpValue(leaf, mode, primaryMode) {
  const ext = leaf.$extensions?.['figma-console-mcp'] ?? {};
  if (mode === (ext.primaryMode ?? primaryMode)) return leaf.$value;
  return ext.modes?.[mode];
}

const drift = [];
const missing = [];
const absent = [];

for (const [slug, col] of Object.entries(live)) {
  if (only && slug !== only) continue;
  const dumped = dump[slug];
  if (!dumped) {
    absent.push(`collection ${slug} is not in the dump at all`);
    continue;
  }
  const byPath = new Map([...leaves(dumped)].map(([p, l]) => [p, l]));

  for (const [name, modes] of Object.entries(col.vars)) {
    const leaf = byPath.get(name);
    if (!leaf) {
      absent.push(`${slug}/${name} — in Figma, not in the dump`);
      continue;
    }
    for (const [mode, figmaVal] of Object.entries(modes)) {
      if (typeof figmaVal === 'string' && figmaVal.startsWith('{MISSING:')) {
        missing.push(`${slug}/${name} [${mode}] → ${figmaVal}`);
        continue;
      }
      const dumpVal = dumpValue(leaf, mode, col.primaryMode);
      if (dumpVal === undefined) continue; // the dump does not model this mode

      // Projector inlines primitives, so a literal here is not drift.
      if (
        typeof figmaVal === 'string' &&
        figmaVal.startsWith('{primitives.') &&
        typeof dumpVal === 'string' &&
        dumpVal.startsWith('#')
      ) {
        continue;
      }
      if (fold(dumpVal) !== fold(figmaVal)) {
        drift.push({ slug, name, mode, dump: dumpVal, figma: figmaVal, leaf });
      }
    }
  }
}

const pad = (s, n) => String(s).padEnd(n);
if (drift.length) {
  console.log(`\n${drift.length} drifted value(s) — Figma wins:\n`);
  for (const d of drift) {
    console.log(
      `  ${pad(`${d.slug}/${d.name}`, 46)} [${pad(d.mode, 12)}] ${pad(d.dump, 34)} → ${d.figma}`,
    );
  }
} else {
  console.log(`\n✓ no drift${only ? ` in ${only}` : ''}`);
}
if (missing.length) {
  console.log(`\n${missing.length} dangling alias(es) — cross-library, NOT drift:`);
  for (const m of missing.slice(0, 8)) console.log(`  ${m}`);
  if (missing.length > 8) console.log(`  …and ${missing.length - 8} more`);
}
if (absent.length) {
  console.log(`\n${absent.length} structural difference(s):`);
  for (const a of absent) console.log(`  ${a}`);
}

if (PATCH && drift.length) {
  const stamp = new Date().toISOString();
  for (const d of drift) {
    const ext = (d.leaf.$extensions ??= {})['figma-console-mcp'] ??= {};
    const primary = ext.primaryMode ?? live[d.slug].primaryMode;
    if (d.mode === primary) d.leaf.$value = d.figma;
    else (ext.modes ??= {})[d.mode] = d.figma;
    const lsv = (ext.lastSyncedValue ??= {});
    lsv[d.mode] =
      typeof d.figma === 'string' && d.figma.startsWith('{')
        ? { reference: d.figma }
        : d.figma;
    ext.lastSyncedAt = stamp;
  }
  // The dump stores non-ASCII escaped.
  const json = JSON.stringify(dump, null, 2).replace(/[-￿]/g, (c) =>
    `\\u${c.charCodeAt(0).toString(16).padStart(4, '0')}`,
  );
  writeFileSync(DUMP, `${json}\n`);
  console.log(`\n✓ patched ${drift.length} value(s) into src/styles/tokens/figma.tokens.json`);
  console.log('  next: node scripts/project-tokens.mjs   then sweep the var() fallbacks');
}

if (drift.length && !PATCH) process.exit(1);
