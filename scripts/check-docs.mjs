#!/usr/bin/env node
/**
 * check-docs.mjs — a doc that names a script, an npm command or another doc
 * must name one that EXISTS.
 *
 * A retired doc pointed at `scripts/lint-component-css.mjs` for weeks after it
 * became `lint-css.mjs`. A reader following that runs nothing and concludes the
 * rule is unenforced.
 *
 * A reference inside a line that marks it dead — RETIRED, deleted, was —
 * is allowed: naming what went is how a doc explains a change.
 *
 *   node scripts/check-docs.mjs
 */
import { readFileSync, existsSync, globSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SCRIPTS = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8')).scripts;

/** A line saying the thing is gone is not a dangling pointer. */
const OBITUARY = /\b(RETIRED|retired|deleted|DELETED|removed|RENAMED|was |used to|no longer|future|planned|proposed)\b/;

const problems = [];

for (const file of ['CLAUDE.md', ...globSync('docs/*.md', { cwd: ROOT })]) {
  const lines = readFileSync(join(ROOT, file), 'utf8').split('\n');

  lines.forEach((line, i) => {
    if (OBITUARY.test(line)) return;

    for (const m of line.matchAll(/`(scripts\/[\w./-]+\.(?:mjs|js))`/g)) {
      if (!existsSync(join(ROOT, m[1]))) {
        problems.push(`${file}:${i + 1}  names ${m[1]}, which does not exist`);
      }
    }
    for (const m of line.matchAll(/`npm run ([\w:]+)`/g)) {
      if (!(m[1] in SCRIPTS)) {
        problems.push(`${file}:${i + 1}  names \`npm run ${m[1]}\`, which package.json does not define`);
      }
    }
    // A doc path, named from the repo root.
    for (const m of line.matchAll(/`(docs\/[\w./-]+\.md)`/g)) {
      if (!existsSync(join(ROOT, m[1]))) problems.push(`${file}:${i + 1}  names ${m[1]}, which does not exist`);
    }
    // A relative link resolves from the doc's own folder; a URL has a colon, so it is not one.
    for (const m of line.matchAll(/\]\(([^)#\s:]+\.md)(?:#[^)]*)?\)/g)) {
      if (!existsSync(join(ROOT, dirname(file), decodeURIComponent(m[1])))) problems.push(`${file}:${i + 1}  links ${m[1]}, which does not exist`);
    }
  });
}

if (problems.length) {
  console.error(`check-docs: ${problems.length} problem(s)\n`);
  for (const p of problems) console.error(`  ✗ ${p}\n`);
  console.error(
    'A doc naming a script that does not exist sends its reader to run nothing,\n' +
      'and they conclude the rule it describes is unenforced. Fix the name, or say\n' +
      'on the same line that the thing is RETIRED or deleted.',
  );
  process.exit(1);
}

console.log('check-docs: every script, command and doc a doc names exists');
