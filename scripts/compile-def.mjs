#!/usr/bin/env node
/**
 * compile-def.mjs — def.json → { ts, html, css }. The `def → code` leg (CLI).
 *
 * Proof-of-shape: reconstruct a component's three files from its definition.
 * Needs an `anatomy` block (only enriched defs have one). Writes to a scratch
 * dir by default so the output can be diffed against the real files without
 * touching them.
 *
 * The transformation itself lives in the pure, importable
 * scripts/lib/generation/compile-def.mjs — this CLI owns arg parsing, file
 * reading, and --print/--out writing, then delegates to compileDef().
 *
 * Usage:
 *   node scripts/compile-def.mjs sherpa-tag              # → scratch/<name>/*
 *   node scripts/compile-def.mjs sherpa-tag --out DIR    # custom out dir
 *   node scripts/compile-def.mjs sherpa-tag --print      # stdout, no write
 */
import { writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { compileDef } from './lib/generation/compile-def.mjs';
import { loadContract } from './lib/contract-io.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const COMPONENTS = join(ROOT, 'src', 'components');

const args = process.argv.slice(2);
const name = args.find((a) => !a.startsWith('--'));
const PRINT = args.includes('--print');
const outFlag = args.indexOf('--out');
const OUT = outFlag !== -1 ? args[outFlag + 1] : join(ROOT, '.compile-out', name);

if (!name) { console.error('usage: compile-def.mjs <sherpa-name> [--print|--out DIR]'); process.exit(1); }

const def = loadContract(join(COMPONENTS, name, `${name}.def`));
if (!def.anatomy) { console.error(`${name} has no anatomy block — cannot compile HTML.`); process.exit(1); }
def.name ??= name;

const { ts, html, css } = compileDef(def);
const files = { [`${name}.ts`]: ts, [`${name}.html`]: html, [`${name}.css`]: css };

if (PRINT) {
  for (const [f, c] of Object.entries(files)) console.log(`\n===== ${f} =====\n${c}`);
} else {
  if (!existsSync(OUT)) mkdirSync(OUT, { recursive: true });
  for (const [f, c] of Object.entries(files)) writeFileSync(join(OUT, f), c);
  console.log(`Wrote ${Object.keys(files).length} files → ${OUT}`);
}
