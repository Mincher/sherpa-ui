#!/usr/bin/env node
/**
 * check-docs.mjs — a doc that names a script, an npm command, a `sherpa-ui`
 * command or another doc must name one that EXISTS; and in the docs a reader is
 * given, each example's `sherpa-*` markup, `sherpa-ui` imports and relative links
 * are real.
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
import { markupProblems } from './check-usage.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (file) => readFileSync(join(ROOT, file), 'utf8');
const PKG = JSON.parse(read('package.json'));
/** The commands `npx sherpa-ui` runs. */
const COMMANDS = new Set([...read('bin/sherpa-ui.mjs').matchAll(/command === '([\w-]+)'/g)].map((m) => m[1]));

/** The docs a reader is given: the front door, the agents' instructions, and each doc the package ships. */
const GIVEN = ['README.md', 'CLAUDE.md', ...PKG.files.filter((f) => f.startsWith('docs/') && f.endsWith('.md'))];

/** Every name an entry exports, values and types, read from its source. */
const exportsOf = (file) => {
  const code = read(file).replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
  const names = new Set();
  for (const m of code.matchAll(/export\s+(?:type\s+)?\{([^}]*)\}/g)) {
    for (const part of m[1].split(',')) {
      const name = part.trim().replace(/^type\s+/, '').split(/\s+as\s+/).pop();
      if (name) names.add(name);
    }
  }
  for (const m of code.matchAll(/export\s+(?:async\s+)?(?:function|const|let|class)\s+(\w+)/g)) names.add(m[1]);
  return names;
};
const ENTRIES = {
  'sherpa-ui/components': exportsOf('src/components.ts'),
  'sherpa-ui/app': exportsOf('src/app.ts'),
  'sherpa-ui/data': exportsOf('src/data.ts'),
};
// src/index.ts is `export *` of the three.
ENTRIES['sherpa-ui'] = new Set(Object.values(ENTRIES).flatMap((names) => [...names]));

/** A line saying the thing is gone is not a dangling pointer. */
const OBITUARY = /\b(RETIRED|retired|deleted|DELETED|removed|RENAMED|was |used to|no longer|future|planned|proposed)\b/;

/** One fenced example's imports, each against the entry it names. */
function importProblems(code, at) {
  const found = [];
  for (const m of code.matchAll(/import\s*\{([^}]*)\}\s*from\s*'(sherpa-ui[^']*)'/g)) {
    // One component alone: its folder is checked line by line.
    if (m[2].startsWith('sherpa-ui/components/')) continue;
    const names = ENTRIES[m[2]];
    if (!names) { found.push(`${at}  imports from '${m[2]}', which is no entry`); continue; }
    for (const part of m[1].split(',')) {
      const name = part.trim().replace(/^type\s+/, '').split(/\s+as\s+/)[0];
      if (name && !names.has(name)) found.push(`${at}  imports ${name}, which '${m[2]}' does not export`);
    }
  }
  return found;
}

/** Each fenced example in a given doc: its markup against the specs, its imports against the entries. */
function exampleProblems(file, lines) {
  const found = [];
  let lang = null;
  let start = 0;
  let body = [];
  lines.forEach((line, i) => {
    const fence = line.match(/^\s*```(\w*)/);
    if (!fence) { if (lang !== null) body.push(line); return; }
    if (lang === null) { lang = fence[1]; start = i + 2; body = []; return; }
    // Padded, so a problem's line number is the doc's own.
    const code = '\n'.repeat(start - 1) + body.join('\n');
    if (lang === 'html') found.push(...markupProblems(code, file).problems);
    if (/^(js|ts|javascript|typescript)$/.test(lang)) found.push(...importProblems(code, `${file}:${start}`));
    lang = null;
  });
  return found;
}

const problems = [];

for (const file of ['README.md', 'CLAUDE.md', ...globSync('docs/*.md', { cwd: ROOT })]) {
  const lines = read(file).split('\n');
  const given = GIVEN.includes(file);
  let fenced = false;

  lines.forEach((line, i) => {
    if (/^\s*```/.test(line)) fenced = !fenced;
    if (OBITUARY.test(line)) return;

    for (const m of line.matchAll(/`(scripts\/[\w./-]+\.(?:mjs|js))`/g)) {
      if (!existsSync(join(ROOT, m[1]))) {
        problems.push(`${file}:${i + 1}  names ${m[1]}, which does not exist`);
      }
    }
    // A given doc's code blocks and prose too; a record doc's backticked ones.
    for (const m of line.matchAll(given ? /\bnpm run ([\w:-]+)/g : /`npm run ([\w:]+)`/g)) {
      const name = m[1].replace(/[:-]+$/, '');
      if (!(name in PKG.scripts)) {
        problems.push(`${file}:${i + 1}  names \`npm run ${name}\`, which package.json does not define`);
      }
    }
    // A doc path, named from the repo root.
    for (const m of line.matchAll(/`(docs\/[\w./-]+\.md)`/g)) {
      if (!existsSync(join(ROOT, m[1]))) problems.push(`${file}:${i + 1}  names ${m[1]}, which does not exist`);
    }
    // A relative link to a doc resolves from the doc's own folder; a URL has a colon, so it is not one.
    for (const m of line.matchAll(/\]\(([^)#\s:]+\.md)(?:#[^)]*)?\)/g)) {
      if (!existsSync(join(ROOT, dirname(file), decodeURIComponent(m[1])))) problems.push(`${file}:${i + 1}  links ${m[1]}, which does not exist`);
    }
    if (!given) return;
    for (const m of line.matchAll(/\bnpx sherpa-ui ([\w-]+)/g)) {
      if (!COMMANDS.has(m[1])) problems.push(`${file}:${i + 1}  names \`npx sherpa-ui ${m[1]}\`, which bin/sherpa-ui.mjs does not run`);
    }
    for (const m of line.matchAll(/sherpa-ui\/components\/(?:sherpa-)?([a-z][\w-]*)/g)) {
      if (!existsSync(join(ROOT, 'src/components', `sherpa-${m[1]}`))) problems.push(`${file}:${i + 1}  names sherpa-ui/components/${m[1]}, which is no component`);
    }
    // A link in a code block is code.
    if (fenced) return;
    for (const m of line.matchAll(/\]\((?!https?:|#|mailto:)([^)\s#]+)/g)) {
      // A doc link is checked above, for every doc.
      if (m[1].endsWith('.md')) continue;
      if (!existsSync(join(ROOT, dirname(file), m[1]))) problems.push(`${file}:${i + 1}  links ${m[1]}, which does not exist`);
    }
  });
  if (given) problems.push(...exampleProblems(file, lines));
}

if (problems.length) {
  console.error(`check-docs: ${problems.length} problem(s)\n`);
  for (const p of problems) console.error(`  ✗ ${p}\n`);
  console.error(
    'A doc that names something that does not exist sends its reader to run\n' +
      'nothing, or to write markup that does nothing. Fix the name, or say on the\n' +
      'same line that the thing is RETIRED or deleted.',
  );
  process.exit(1);
}

console.log('check-docs: every script, command, example and link a doc names exists');
