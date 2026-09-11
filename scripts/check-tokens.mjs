#!/usr/bin/env node
/**
 * check-tokens.mjs — diff a LIVE Figma variable read against figma.tokens.json.
 *
 * Figma is the source of truth. This reports, per collection and mode, every leaf
 * whose value or alias target has drifted, and (with --patch) rewrites the dump so
 * a re-projection picks the change up.
 *
 *   node scripts/check-tokens.mjs <live-tokens.json> [--patch] [--collection=slug]
 *
 * Exits non-zero when drift is found and --patch was NOT passed, so it works as a
 * CI gate.
 *
 * ── Why this exists ─────────────────────────────────────────────────────────
 * `figma_export_tokens` over the whole file rewrites 800+ leaves and drags in the
 * known dangling cross-library aliases, so a two-token change arrives as an
 * unreviewable diff. This compares instead, and touches only what moved.
 *
 * ── The live snapshot ───────────────────────────────────────────────────────
 * Produced by a figma_execute read (see docs/HANDOVER-TODO-2026-09-11.md item 7):
 *
 *   { "<collection-slug>": {
 *       slug, primaryMode,
 *       vars: { "<leaf/path>": { "<mode name>": "#hex" | "{slug.dotted.path}" } } } }
 *
 * Only BASE collections appear. An extension collection carries no leaves of its
 * own, and its overrides read back EMPTY from `valuesByMode` — they need a
 * bound-probe via a scratch node pinned to the extension's mode, which is what
 * src/styles/tokens/figma.extensions.json caches. Extensions are therefore out of
 * scope here and must be swept separately.
 *
 * ── Comparison rules (each one is a bug this script was written to avoid) ───
 *  • THE PRIMARY MODE LIVES IN `$value`, not in `$extensions[…].modes` (which
 *    holds only the non-primary modes). Reading the primary mode out of `modes`
 *    finds `undefined` and reports no drift — which is exactly how a real
 *    style-content change was missed once.
 *  • Reference PREFIXES differ by side. The dump writes `{theme.content.size.base}`
 *    where a live read of the same alias is `{theme.content.size.base}` only if the
 *    target lives in `theme`; the dump ALSO inlines every `primitives.*` reference
 *    to its literal, because the Primitives collection is never emitted. So a dump
 *    leaf holding a hex where Figma holds `{primitives.…}` is NOT drift.
 *  • HEX CASE IS NOT DRIFT. A previous pass found 139 of 147 reported differences
 *    were case only.
 *  • A `{MISSING:VariableID:…}` target is a cross-library reference, not drift.
 *    Reported separately and never patched.
 */
import { readFileSync, writeFileSync } from 'node:fs';
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

/** Walk a collection's leaves, yielding [slash/path, leafObject]. */
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

/** Case-fold a hex so `#B3B3C3` and `#b3b3c3` compare equal. */
const fold = (v) => (typeof v === 'string' && v.startsWith('#') ? v.toLowerCase() : v);

/**
 * The dump's own reference for a mode.
 *
 * `modes` carries the NON-PRIMARY modes; the primary one is the leaf's `$value`.
 * Returns `undefined` when the dump has nothing for that mode at all.
 */
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

      // A dump leaf holding a LITERAL where Figma holds a primitives alias is the
      // projector's documented inlining, not drift.
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

/* ── Report ──────────────────────────────────────────────────────────────── */
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

/* ── Patch ───────────────────────────────────────────────────────────────── */
if (PATCH && drift.length) {
  const stamp = new Date().toISOString();
  for (const d of drift) {
    const ext = (d.leaf.$extensions ??= {})['figma-console-mcp'] ??= {};
    const primary = ext.primaryMode ?? live[d.slug].primaryMode;
    if (d.mode === primary) d.leaf.$value = d.figma;
    else (ext.modes ??= {})[d.mode] = d.figma;
    // lastSyncedValue mirrors every mode, primary included.
    const lsv = (ext.lastSyncedValue ??= {});
    lsv[d.mode] =
      typeof d.figma === 'string' && d.figma.startsWith('{')
        ? { reference: d.figma }
        : d.figma;
    ext.lastSyncedAt = stamp;
  }
  // ensure_ascii equivalent: the dump escapes every em dash in its $descriptions,
  // and re-encoding them raw turns a 6-line diff into a 132-line one.
  const json = JSON.stringify(dump, null, 2).replace(/[-￿]/g, (c) =>
    `\\u${c.charCodeAt(0).toString(16).padStart(4, '0')}`,
  );
  writeFileSync(DUMP, `${json}\n`);
  console.log(`\n✓ patched ${drift.length} value(s) into src/styles/tokens/figma.tokens.json`);
  console.log('  next: node scripts/project-tokens.mjs   then sweep the var() fallbacks');
}

if (drift.length && !PATCH) process.exit(1);
