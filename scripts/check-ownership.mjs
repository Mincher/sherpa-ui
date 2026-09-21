#!/usr/bin/env node
/**
 * check-ownership.mjs — one owner per value, enforced.
 *
 * `DataSource.#push` writes seven `data-*` attributes onto every bound
 * component. A component that ALSO writes one of them is both reporter and
 * owner of the same value, which is the recurring bug this repo has hit four
 * times in a week: the grid deleting a sort column the toolbar was suspending,
 * a chip deriving an on/off state a grid also set, a pager showing a page the
 * query had not reached.
 *
 * `data-locked` is the answer — a bound component reports its interaction and
 * stops writing its own state — and a rule nothing checks is a rule that
 * drifts. It was documented, and honoured by ONE component of 58, for months.
 *
 * WHAT COUNTS AS A VIOLATION. A write to an owned attribute that is not:
 *
 *   - guarded by a `data-locked` check on a nearby line, OR
 *   - inside a `set <name>(…)` accessor — a host calling `pager.page = 2` is
 *     the state channel working as intended, not a component owning a value.
 *
 * Deliberately CRUDE. It reads lines, not an AST, so a determined author can
 * slip past it — the point is to catch the accidental reintroduction, which is
 * how every one of those four bugs arrived.
 *
 *   node scripts/check-ownership.mjs
 *
 * TRAP T-bind-locks-what-it-owns.
 */
import { readFileSync } from 'node:fs';
import { globSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, relative } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

/**
 * The attributes `DataSource.#push` writes. Kept here rather than parsed out of
 * data-source.ts: a list this short is clearer stated, and the gate should fail
 * loudly if someone adds an eighth without thinking about who owns it.
 */
const OWNED = [
  'data-sort-field',
  'data-sort-direction',
  'data-group-field',
  'data-filter-fields',
  'data-page',
  'data-total-pages',
  'data-page-size',
];

/** `data-sort-field` → `sortField`, for the `dataset` spelling. */
const camel = (attr) =>
  attr.replace(/^data-/, '').replace(/-([a-z])/g, (_, c) => c.toUpperCase());

/** How many lines either side of a write a `data-locked` guard may sit. */
const GUARD_WINDOW = 3;

const problems = [];

for (const file of globSync('src/components/*/*.ts', { cwd: ROOT })) {
  const lines = readFileSync(join(ROOT, file), 'utf8').split('\n');

  // Which lines are inside a `set <name>(…)` accessor — a host's own channel.
  const inSetter = new Array(lines.length).fill(false);
  let depth = null;
  for (let i = 0; i < lines.length; i++) {
    if (depth === null) {
      if (/^\s*set\s+[A-Za-z_$][\w$]*\s*\(/.test(lines[i])) { depth = 0; inSetter[i] = true; }
      else continue;
    } else inSetter[i] = true;
    for (const ch of lines[i]) {
      if (ch === '{') depth++;
      else if (ch === '}') depth--;
    }
    if (depth !== null && depth <= 0 && lines[i].includes('}')) depth = null;
  }

  lines.forEach((line, i) => {
    const code = line.trim();
    if (code.startsWith('*') || code.startsWith('//') || code.startsWith('/*')) return;

    for (const attr of OWNED) {
      const prop = camel(attr);
      const writes =
        new RegExp(`dataset\\['${prop}'\\]\\s*=(?!=)`).test(line) ||
        new RegExp(`dataset\\.${prop}\\s*=(?!=)`).test(line) ||
        new RegExp(`setAttribute\\(\\s*'${attr}'`).test(line) ||
        new RegExp(`this\\.set\\(\\s*'${attr}'`).test(line);
      if (!writes) continue;
      if (inSetter[i]) continue;

      const from = Math.max(0, i - GUARD_WINDOW);
      const to = Math.min(lines.length, i + GUARD_WINDOW + 1);
      const guarded = lines.slice(from, to).some((l) => l.includes('data-locked'));
      if (guarded) continue;

      problems.push(
        `${relative(ROOT, file)}:${i + 1}  writes ${attr} with no data-locked guard\n` +
          `      ${code.slice(0, 96)}`,
      );
    }
  });
}

if (problems.length) {
  console.error(`check-ownership: ${problems.length} problem(s)\n`);
  for (const p of problems) console.error(`  ✗ ${p}\n`);
  console.error(
    'The DataSource owns these attributes on every element it binds, and writes\n' +
      'them back after collating the change. A component that writes one too is\n' +
      'both reporter and owner of one value.\n\n' +
      'Report the intent, and write only when nothing else will:\n\n' +
      "    if (!this.hasAttribute('data-locked')) this.set('data-sort-field', field);\n" +
      "    this.emit('sort-change', { field, direction });\n\n" +
      'The guard matters because an UNBOUND component has no other owner and must\n' +
      'still work — every data-grid test drives one. See T-bind-locks-what-it-owns.',
  );
  process.exit(1);
}

console.log(`check-ownership: ${OWNED.length} owned attributes, no unguarded writes`);
