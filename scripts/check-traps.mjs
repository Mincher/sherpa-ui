#!/usr/bin/env node
/**
 * check-traps.mjs — gate: every trap id cited in the code has a `### <id>`
 * section in docs/TRAPS.md, and that section's `Site:` lines name exactly the
 * files that cite it. Drift in either direction exits 1.
 *
 *   node scripts/check-traps.mjs
 */
import { readFileSync, existsSync, globSync } from 'node:fs';

const DOC = 'docs/TRAPS.md';
/** Everywhere a citation may live. A file not scanned here is not gated. */
const SOURCES = [
  'src/components/*/*.ts',
  'src/core/*.ts',
  'src/components/*/*.css',
  // sherpa-base.css — adopted into every shadow root.
  'src/core/*.css',
  'test/reforged/harness.html',
  'playwright.config.ts',
  'test/e2e/*.ts',
  'test/unit/*.mjs',
  'scripts/check-*.mjs',
  'examples/views/*.js',
];

/** `### <the-id>` opens a trap; `Site:` lines list the files that cite it. */
const HEADING = /^###\s+(T-[a-z0-9-]+)\s*$/;
const SITE = /^-\s*Site:\s*`([^`]+)`/;
/**
 * A citation: the word TRAP, then the id. `\s` spans NEWLINES and an optional
 * `*` may sit between the two, because a JSDoc block wraps mid-citation —
 * anchoring both to one line hides real citations.
 */
const CITE = /\bTRAP\s*(?:\*\s*)?(T-[a-z0-9-]+)\b/g;

if (!existsSync(DOC)) {
  console.log('check-traps: no docs/TRAPS.md yet, nothing to check');
  process.exit(0);
}

// ── Read the doc: id → the files it claims cite it ────────────────────────────
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

// ── Read the sources: id → the files that actually cite it ────────────────────
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

// ── Compare — report every failure, not just the first ───────────────────────
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
