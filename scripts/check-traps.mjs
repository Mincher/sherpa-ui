#!/usr/bin/env node
/**
 * check-traps.mjs — keeps docs/TRAPS.md and the code pointing at each other.
 *
 * A trap moved out of the source is a fact that no longer sits next to the code
 * it constrains. A comment cannot lie about the line under it; a doc can, and
 * this repo has the receipts — the round-trip check printed 22 failures and
 * exited 0 for three months. So the move only happens WITH this gate.
 *
 * THE CONTRACT. Each trap has an id (`T-nav-parent-chain`). It appears twice:
 *
 *   docs/TRAPS.md   `### T-nav-parent-chain` followed by the explanation, and a
 *                   `Site:` line naming every file that cites it
 *   the source      `// TRAP T-nav-parent-chain — one-line summary`
 *
 * Four ways that can rot, all of them checked:
 *
 *   1. a source cites an id TRAPS.md does not define        (dangling pointer)
 *   2. TRAPS.md defines an id nothing cites                 (orphan trap)
 *   3. a trap's `Site:` names a file that does not cite it  (stale site list)
 *   4. a cited file has no `Site:` entry                    (unlisted site)
 *
 * It reads only text, so it is fast enough for the pre-commit hook.
 *
 * Exit 1 on any failure — see the hook's own comment about checks that report
 * and never enforce.
 */
import { readFileSync, existsSync, globSync } from 'node:fs';

const DOC = 'docs/TRAPS.md';
/**
 * Everywhere a citation may live.
 *
 * CSS is in here, and had to be added BEFORE the first `/* TRAP … *​/` was
 * written into a stylesheet — a gate that does not scan a file cannot catch a
 * dangling pointer in it, and an unenforced check is the failure this whole
 * mechanism exists to prevent.
 *
 * THE TEST HARNESS AND THE PLAYWRIGHT CONFIG are in for the same reason, added
 * the day the first trap was cited in one (`T-harness-serves-font-awesome-locally`,
 * which explains why the harness serves Font Awesome from node_modules and why
 * a retry exists). A rule about how the suite RUNS is as easy to undo as a rule
 * about how a component renders, and it had no gate at all.
 */
const SOURCES = [
  'src/components/*/*.ts',
  'src/core/*.ts',
  'src/components/*/*.css',
  'test/reforged/harness.html',
  'playwright.config.ts',
  // The SPEC files too, for the same reason the harness is here: a rule about
  // how a test must be written (what a synthetic click can reach, what a
  // selector now matches twice) is as easy to undo as a rule about rendering,
  // and an undone one turns a working component into a red test.
  'test/e2e/*.ts',
  // The EXAMPLES too. They are the working reference for wiring a view —
  // CLAUDE.md says so — and a rule about how a view must be wired rots exactly
  // like a rule about a component. The region chip offering values the data
  // never held survived because nothing checked.
  'examples/views/*.js',
];

/** `### T-some-id` opens a trap; `Site:` lines list the files that cite it. */
const HEADING = /^###\s+(T-[a-z0-9-]+)\s*$/;
const SITE = /^-\s*Site:\s*`([^`]+)`/;
/**
 * `// TRAP T-some-id — summary`, anywhere in a comment.
 *
 * `\s` spans NEWLINES on purpose, and a leading `*` between the two words is
 * allowed: a JSDoc block wraps, so `TRAP` can end one line and the id begin the
 * next. The first version anchored both to one line, reported a real citation in
 * sherpa-menu as missing, and would have had someone "fix" working code.
 */
const CITE = /\bTRAP\s*(?:\*\s*)?(T-[a-z0-9-]+)\b/g;

if (!existsSync(DOC)) {
  // No doc yet means no traps have been moved — nothing to be inconsistent with.
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

// ── Compare, and report every failure rather than the first ───────────────────
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
