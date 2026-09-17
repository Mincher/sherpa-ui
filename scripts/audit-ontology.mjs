#!/usr/bin/env node
/**
 * audit-ontology.mjs — check a component's real Figma bindings against the ontology.
 *
 * Input (stdin or --file): JSON array of bindings, each
 *   { node, prop, var }   where var = "Collection::name"
 * (produced by the collectBindings walker run in figma_execute).
 *
 * For each binding: does the ontology's role for that var match the role the
 * binding PROPERTY implies? Reports agreements + mismatches (ontology gaps).
 *
 * Usage: node scripts/audit-ontology.mjs --file bindings.json [--name Tag]
 */
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadContract } from './lib/contract-io.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
/* The ontology, or a usable message.

   `docs/ontology/` was DELETED 2026-09-16: it described collections that no
   longer existed, and a generated artefact nobody regenerates answers
   confidently and wrongly. This script is kept deliberately (see
   docs/HANDOVER-BACKLOG.md) because it is the only way to rebuild the audit
   from Figma — but until the ontology is back it cannot run, and it used to
   say so by throwing `No contract file found` out of a library three frames
   down. Say it here instead, with the way out. */
let ont;
try {
  ont = loadContract(join(ROOT, 'docs/ontology/tokens'));   // YAML preferred
} catch {
  console.error(`audit-ontology: the ontology is not present.

\`docs/ontology/tokens.{yaml,json}\` was deleted 2026-09-16 — it had rotted, and a
stale generated artefact is worse than none.

To rebuild it:
  1. re-export the Figma variables into scripts/figma-data/variable-graph.json
     (the committed copy is from 2026-08-14: 908 entries against 1366 token
     declarations in tokens.css today, so it would rebuild the WRONG answer)
  2. node scripts/build-ontology.mjs

Until then, token NAMES can be checked against the generated tokens.css —
\`loadCssTokenNames()\` in scripts/lib/generation/data.mjs — but ROLE and SCOPE,
which is what this script audits, have no source.`);
  process.exit(2);
}

const args = process.argv.slice(2);
const fileArg = args[args.indexOf('--file') + 1];
const name = args.includes('--name') ? args[args.indexOf('--name') + 1] : 'component';
const bindings = JSON.parse(readFileSync(fileArg, 'utf8'));

// Figma bind property → the ROLE that property implies.
const PROP_ROLE = {
  fill: 'surface', stroke: 'border',
  topLeftRadius: 'radius', topRightRadius: 'radius', bottomLeftRadius: 'radius', bottomRightRadius: 'radius',
  itemSpacing: 'space', paddingLeft: 'space', paddingRight: 'space', paddingTop: 'space', paddingBottom: 'space',
  strokeTopWeight: 'border', strokeBottomWeight: 'border', strokeLeftWeight: 'border', strokeRightWeight: 'border',
  width: 'size', height: 'size',
  fontSize: 'type', fontWeight: 'type', lineHeight: 'type', letterSpacing: 'type',
  fontFamily: 'type', paragraphSpacing: 'type', effects: 'effect',
};

// roles that are legitimately interchangeable (scope unions / typography quirks)
function roleOk(expected, role) {
  if (role === expected) return true;
  if ((expected === 'space' && role === 'size') || (expected === 'size' && role === 'space')) return true; // GAP+WIDTH_HEIGHT
  if (expected === 'type' && ['type', 'space', 'size', 'other', 'palette', 'open'].includes(role)) return true; // Typography vars vary
  if (expected === 'effect' && ['effect', 'palette', 'open', 'other'].includes(role)) return true; // shadow floats
  if ((expected === 'surface' || expected === 'border' || expected === 'content') && role === 'palette') return true; // open palette bound directly
  return false;
}

let inOnt = 0, notInOnt = 0, agree = 0;
const gaps = [], mismatches = [];
for (const b of bindings) {
  const e = ont[b.var];
  let expected = PROP_ROLE[b.prop] || '?';
  // a fill on a text/icon vector is CONTENT, not surface
  if (b.prop === 'fill' && /Vector|label|content|icon|text/i.test(b.node)) expected = 'content';
  if (!e) { notInOnt++; gaps.push({ ...b, expected }); continue; }
  inOnt++;
  if (roleOk(expected, e.role)) agree++;
  else mismatches.push({ node: b.node, prop: b.prop, var: b.var, ontRole: e.role, expected });
}

console.log(`\n### ${name} — ${bindings.length} bindings`);
console.log(`  in ontology: ${inOnt}  ·  agree: ${agree}/${inOnt}  ·  not in ontology (Core/ref): ${notInOnt}`);
if (mismatches.length) {
  console.log(`\n  ROLE MISMATCHES (ontology says X, usage implies Y):`);
  for (const m of mismatches) console.log(`   ${m.prop.padEnd(16)} ${m.var.padEnd(44)} ont=${m.ontRole} expected=${m.expected}  [${m.node}]`);
} else console.log(`  ✅ no role mismatches`);
if (gaps.length) {
  const refs = gaps.filter(g => /^Core::|^Primitives::/.test(g.var));
  const realGaps = gaps.filter(g => !/^Core::|^Primitives::/.test(g.var));
  console.log(`\n  NOT IN ONTOLOGY: ${refs.length} reference (Core/Primitives — expected), ${realGaps.length} real gaps`);
  for (const g of realGaps) console.log(`   ${g.prop.padEnd(16)} ${g.var}  [${g.node}]`);
}
// machine summary line
console.log(`\nSUMMARY ${name}: agree=${agree} mismatch=${mismatches.length} refNotInOnt=${gaps.filter(g=>/^Core::|^Primitives::/.test(g.var)).length} realGap=${gaps.filter(g=>!/^Core::|^Primitives::/.test(g.var)).length}`);
