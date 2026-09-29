#!/usr/bin/env node
/**
 * Gate: every trap id cited in the code has a `### <id>` section in
 * docs/TRAPS.md, and that section's `Site:` lines name exactly the files that
 * cite it. Drift either way exits 1.
 *
 *   node scripts/check-traps.mjs
 */
import { readFileSync, existsSync, globSync } from 'node:fs';

const DOC = 'docs/TRAPS.md';
/** A file not scanned here is not gated. */
const SOURCES = [
  'src/*.ts',
  'src/components/*/*.ts',
  'src/core/*.ts',
  // src/core is split by RUNTIME TIER — data, browser, ui.
  'src/core/*/*.ts',
  'src/components/*/*.css',
  // A citation in a TEMPLATE was invisible: the comment is the only place some
  // structural rules are written down, and one went undefined for months.
  'src/components/*/*.html',
  'src/core/*.css',
  'test/reforged/harness.html',
  'playwright.config.ts',
  'test/e2e/*.ts',
  'test/unit/*.mjs',
  'scripts/*.mjs',
  // The build LIBRARY too. `scripts/*.mjs` is one level deep, so a citation in
  // scripts/lib/ was invisible and the gate reported its own Site as uncited.
  'scripts/lib/*.mjs',
  'scripts/lib/*/*.mjs',
  'examples/contexts/*.js',
  // The app's page and View definitions.
  'examples/definitions/*.js',
  // The example TEMPLATES too. A citation in the Add-customer dialog was
  // unchecked, which is how a missing form field went unnoticed.
  'examples/templates/*.html',
  // The two ENTRY POINTS. Both carry citations and neither was scanned.
  'src/index.ts',
  'src/data.ts',
];

const HEADING = /^###\s+(T-[a-z0-9-]+)\s*$/;
const SITE = /^-\s*Site:\s*`([^`]+)`/;
/** `\s` spans newlines and `*` is optional: a JSDoc block may wrap mid-citation. */
const CITE = /\bTRAP\s*(?:\*\s*)?(T-[a-z0-9-]+)\b/g;

if (!existsSync(DOC)) {
  console.log('check-traps: no docs/TRAPS.md yet, nothing to check');
  process.exit(0);
}

// id → the files the doc claims cite it
const defined = new Map();
let current = null;
for (const line of readFileSync(DOC, 'utf8').split('\n')) {
  const heading = HEADING.exec(line);
  if (heading) {
    current = heading[1];
    if (defined.has(current)) {
      console.error(`✗ ${DOC}: ${current} is defined twice`);
      process.exit(1);
    }
    defined.set(current, new Set());
    continue;
  }
  const site = SITE.exec(line);
  if (site && current) defined.get(current).add(site[1]);
}

// id → the files that actually cite it
const cited = new Map();
for (const pattern of SOURCES) {
  for (const file of globSync(pattern)) {
    const text = readFileSync(file, 'utf8');
    for (const [, id] of text.matchAll(CITE)) {
      if (!cited.has(id)) cited.set(id, new Set());
      cited.get(id).add(file);
    }
  }
}

// Report every failure, not just the first.
const problems = [];

for (const [id, files] of cited) {
  if (!defined.has(id)) {
    problems.push(`${id} is cited by ${[...files].join(', ')} but ${DOC} does not define it`);
  }
}

for (const [id, claimed] of defined) {
  const actual = cited.get(id);
  if (!actual) {
    problems.push(`${id} is defined in ${DOC} but nothing cites it — delete it or cite it`);
    continue;
  }
  for (const file of claimed) {
    if (!actual.has(file)) {
      problems.push(`${id}: ${DOC} lists Site \`${file}\`, which does not cite it`);
    }
  }
  for (const file of actual) {
    if (!claimed.has(file)) {
      problems.push(`${id}: ${file} cites it, but ${DOC} does not list it as a Site`);
    }
  }
}

if (problems.length) {
  console.error(`check-traps: ${problems.length} problem(s)\n`);
  for (const problem of problems) console.error(`  ✗ ${problem}`);
  console.error(`\nA trap in ${DOC} and the code that cites it have drifted apart.`);
  process.exit(1);
}

console.log(`check-traps: ${defined.size} traps, ${cited.size} cited, all consistent`);
