#!/usr/bin/env node
/**
 * compile-def.mjs — <name>.component.json → { ts, html, css }. The `def → code`
 * leg (CLI).
 *
 * Proof-of-shape: reconstruct a component's three files from its component spec.
 * Reads the DTCG-dialect `*.component.json` (thin.yaml is retired), adapts it via
 * specToDef, and needs an `anatomy` block. Writes to a scratch dir by default so
 * the output can be diffed against the real files without touching them.
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
import { writeFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { compileDef } from './lib/generation/compile-def.mjs';
import { specToDef } from './lib/component-to-def.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const COMPONENTS = join(ROOT, 'src', 'components');

const args = process.argv.slice(2);
const name = args.find((a) => !a.startsWith('--'));
const PRINT = args.includes('--print');
const outFlag = args.indexOf('--out');
const OUT = outFlag !== -1 ? args[outFlag + 1] : join(ROOT, '.compile-out', name);

if (!name) { console.error('usage: compile-def.mjs <sherpa-name> [--print|--out DIR]'); process.exit(1); }

// The single component contract is <name>.component.json (the DTCG-dialect spec —
// *.thin.yaml is retired). Adapt it to the `def` shape compileDef consumes.
const specPath = join(COMPONENTS, name, `${name}.component.json`);
if (!existsSync(specPath)) { console.error(`${name}: no ${name}.component.json.`); process.exit(1); }
const def = specToDef(JSON.parse(readFileSync(specPath, 'utf8')));
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
