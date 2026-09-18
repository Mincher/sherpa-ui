#!/usr/bin/env node
/**
 * check-mcp-tools.mjs — keeps each tool module's header comment honest.
 *
 * Every file in mcp-server/tools/ opens with a list of the tools it provides.
 * That list is what a person reads before the code, and on 2026-09-18 one of
 * them was wrong: `discover.js` promised `explain_token` and `browse_ontology`
 * — deleted with the ontology two days earlier — and omitted `find_token`,
 * which replaced them. Nothing noticed, because nothing looked.
 *
 * This is the same failure the spec round-trip gate exists for: a description
 * of some code, sitting beside that code, drifting from it silently. The repo's
 * rule is that such a check must RUN, not merely be possible — see the note in
 * check-traps.mjs about a gate that reported for three months and enforced
 * never.
 *
 * THE CONTRACT. In each `mcp-server/tools/*.js`:
 *
 *   the header     ` *   tool_name   — what it does`, one line per tool
 *   the code       `server.registerTool("tool_name", …)`
 *
 * The two sets must match exactly. Exit 1 on any difference.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const DIR = 'mcp-server/tools';

/** The header's list: an indented ` *   name — …` line inside the opening block. */
const HEADER_LINE = /^\s*\*\s{2,}([a-z][a-z0-9_]*)\s+[—-]/;
/** A real registration. The name is the first argument, on its own line or not. */
const REGISTERED = /server\.registerTool\(\s*["']([a-z][a-z0-9_]*)["']/g;

let problems = 0;

for (const file of readdirSync(DIR).filter((f) => f.endsWith('.js')).sort()) {
  const path = join(DIR, file);
  const src = readFileSync(path, 'utf8');

  // The header is the FIRST block comment only — a later one listing example
  // names is prose, not a promise.
  const header = src.slice(0, src.indexOf('*/') + 2);
  const claimed = new Set(
    header.split('\n').map((l) => HEADER_LINE.exec(l)?.[1]).filter(Boolean),
  );
  const real = new Set([...src.matchAll(REGISTERED)].map((m) => m[1]));

  const phantom = [...claimed].filter((n) => !real.has(n));
  const missing = [...real].filter((n) => !claimed.has(n));

  for (const n of phantom) {
    console.error(`  ✗ ${path}: header lists "${n}", which is not registered`);
    problems++;
  }
  for (const n of missing) {
    console.error(`  ✗ ${path}: registers "${n}", which the header does not list`);
    problems++;
  }
}

if (problems) {
  console.error(`\ncheck-mcp-tools: ${problems} problem(s)`);
  console.error('A tool module\'s header and its registrations have drifted apart.');
  process.exit(1);
}

const count = readdirSync(DIR).filter((f) => f.endsWith('.js')).length;
console.log(`check-mcp-tools: ${count} modules, headers match their registrations`);
