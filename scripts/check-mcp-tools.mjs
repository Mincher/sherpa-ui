#!/usr/bin/env node
/**
 * run: node scripts/check-mcp-tools.mjs
 *
 * Each mcp-server/tools/*.js header must list exactly the tools it registers.
 * Exit 1 on any difference, so a header cannot promise a deleted tool.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const DIR = 'mcp-server/tools';

const HEADER_LINE = /^\s*\*\s{2,}([a-z][a-z0-9_]*)\s+[—-]/;
const REGISTERED = /server\.registerTool\(\s*["']([a-z][a-z0-9_]*)["']/g;

let problems = 0;

for (const file of readdirSync(DIR).filter((f) => f.endsWith('.js')).sort()) {
  const path = join(DIR, file);
  const src = readFileSync(path, 'utf8');

  // The FIRST block comment only — a later list of names is prose, not a promise.
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
