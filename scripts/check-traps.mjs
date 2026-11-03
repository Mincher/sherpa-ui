#!/usr/bin/env node
/**
 * Gate: every trap id cited in the code has a `### <id>` section in one of
 * docs/traps/*.md, and that section's `Site:` lines name exactly the files that
 * cite it. Drift either way exits 1. Each entry lives in the file of its first
 * Site's area (plan-695 T1). It also writes docs/TRAPS-INDEX.md, the entries by
 * area, from those Site lines — and fails when it is stale.
 *
 *   npm run check:traps    check
 *   npm run traps:write    write the index, then check
 */
import { readFileSync, writeFileSync, existsSync, globSync } from 'node:fs';

const DOC = 'docs/traps/*.md';
const INDEX = 'docs/TRAPS-INDEX.md';
const WRITE = process.argv.includes('--write');
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
  // A family's markup (TRAP T-a-family-shares-markup).
  'src/core/*.html',
  'test/reforged/harness.html',
  'playwright.config.ts',
  'test/e2e/*.ts',
  'test/unit/*.mjs',
  'test/a11y/*.mjs',
  'scripts/*.mjs',
  // The build LIBRARY too. `scripts/*.mjs` is one level deep, so a citation in
  // scripts/lib/ was invisible and the gate reported its own Site as uncited.
  'scripts/lib/*.mjs',
  'scripts/lib/*/*.mjs',
  // The two ENTRY POINTS. Both carry citations and neither was scanned.
  'src/index.ts',
  'src/data.ts',
  // The MCP: its own package, but its citations are this doc's.
  'mcp-server/*.js',
  'mcp-server/*/*.js',
  'mcp-server/scripts/*.mjs',
  'bin/*.mjs',
];

const HEADING = /^###\s+(T-[a-z0-9-]+)\s*$/;
const SITE = /^-\s*Site:\s*`([^`]+)`/;
/** `\s` spans newlines and `*` is optional: a JSDoc block may wrap mid-citation. */
const CITE = /\bTRAP\s*(?:\*\s*)?(T-[a-z0-9-]+)\b/g;

const DOCS = globSync(DOC).sort();
if (!DOCS.length) {
  console.log('check-traps: no docs/traps/ yet, nothing to check');
  process.exit(0);
}

// id → the files the docs claim cite it; id → the doc that defines it
const defined = new Map();
const home = new Map();
for (const doc of DOCS) {
  let current = null;
  for (const line of readFileSync(doc, 'utf8').split('\n')) {
    const heading = HEADING.exec(line);
    if (heading) {
      current = heading[1];
      if (defined.has(current)) {
        console.error(`✗ ${current} is defined twice: ${home.get(current)} and ${doc}`);
        process.exit(1);
      }
      defined.set(current, new Set());
      home.set(current, doc);
      continue;
    }
    const site = SITE.exec(line);
    if (site && current) defined.get(current).add(site[1]);
  }
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

/** The index's areas, in print order. A Site is in the FIRST area it matches. */
const comp = (...names) => new RegExp(`^src/components/sherpa-(${names.join('|')})/`);
const ui = (...names) => new RegExp(`^src/core/ui/(${names.join('|')})\\.ts$`);
const TESTS = 'Tests only';
/** Each area: its name, its file in docs/traps/, and the Sites in it. */
const AREAS = [
  ['The data layer', 'data-layer', [/^src\/core\/data\//, /^src\/data\.ts$/]],
  ['Storage, saved Views and the URL', 'storage', [/^src\/core\/browser\//, /^src\/core\/worker\//, /^src\/worker\.ts$/]],
  ['The join and the app layer', 'join-and-app', [comp('provider', 'router', 'outlet'),
    ui('bind-source', 'context', 'apply-state', 'bind-settings'), /^src\/app\.ts$/]],
  ['Filters', 'filters', [comp('quick-filter', 'quick-filter-toolbar'),
    ui('filter-def', 'filter-host', 'filter-kind', 'filter-menu', 'filters-button', 'more-menu'),
    /^src\/core\/sherpa-filter-/]],
  ['Menus, tips and overlays', 'menus-tips-overlays', [comp('menu', 'tooltip', 'dialog', 'overlay-panel', 'panel', 'toast', 'notifications'),
    ui('top-layer-tips', 'disclosure')]],
  ['The data grid', 'data-grid', [comp('data-grid', 'pagination')]],
  ['Charts', 'charts', [comp('barchart', 'line-chart', 'gauge-chart', 'radial-chart', 'sparkline', 'chart-legend', 'metric'),
    ui('chart-parts', 'show-as'), /^src\/core\/sherpa-chart-/, /^src\/core\/sherpa-show-as\.html$/]],
  ['SherpaElement and the shared sheets', 'element-and-sheets', [/^src\/core\/ui\//, /^src\/core\/[^/]+\.css$/, /^src\/(index|components)\.ts$/]],
  ['Other components', 'other-components', [/^src\/components\//]],
  ['Build, tools and the MCP', 'build-tools-mcp', [/^scripts\//, /^bin\//, /^mcp-server\//, /^playwright\.config\.ts$/]],
  [TESTS, 'tests-only', [/^test\//]],
];
/** A Site's short name: its component, else its file without the extension. */
const short = (site) => /^src\/components\/sherpa-([^/]+)\//.exec(site)?.[1] ?? site.split('/').pop().replace(/\.\w+$/, '');

const lists = new Map(AREAS.map(([name]) => [name, []]));
for (const [id, sites] of defined) {
  const byArea = new Map();
  // Its home: the first area its Sites reach, a test's only where no code cites it.
  const reached = [...sites].map((site) => AREAS.findIndex(([, , res]) => res.some((re) => re.test(site)))).filter((i) => i >= 0);
  const code = reached.filter((i) => AREAS[i][0] !== TESTS);
  const want = reached.length ? `docs/traps/${AREAS[Math.min(...(code.length ? code : reached))][1]}.md` : null;
  if (want && home.get(id) !== want) problems.push(`${id} is in ${home.get(id)} — move it to ${want}, the area of its first Site`);
  for (const site of sites) {
    const area = AREAS.find(([, , res]) => res.some((re) => re.test(site)))?.[0];
    if (!area) { problems.push(`${id}: Site \`${site}\` is in no area of ${INDEX} — add its folder to AREAS`); continue; }
    if (!byArea.has(area)) byArea.set(area, new Set());
    byArea.get(area).add(short(site));
  }
  // A test is a Site, but it puts an entry in an area only when no code cites it.
  if (byArea.size > 1) byArea.delete(TESTS);
  for (const [area, names] of byArea) lists.get(area).push([id, [...names].sort()]);
}
const index = [
  '# TRAPS — the index by area',
  '',
  'GENERATED by `scripts/check-traps.mjs` from the `Site:` lines in',
  '[the traps](TRAPS.md), one file per area in `docs/traps/`. Do not edit it: run `npm run traps:write`.',
  '',
  'An entry is under each area that has code which cites it, with that code\'s',
  'files. An entry that only tests cite is under Tests only.',
];
for (const [area, rows] of lists) {
  if (!rows.length) continue;
  index.push('', `## ${area} (${rows.length})`, '');
  // Code-point order, not localeCompare: the same file on every machine.
  rows.sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  for (const [id, names] of rows) index.push(`- [${id}](${home.get(id).slice('docs/'.length)}#${id.toLowerCase()}) — ${names.join(', ')}`);
}
const indexText = `${index.join('\n')}\n`;
if (WRITE) writeFileSync(INDEX, indexText);
else if (!existsSync(INDEX) || readFileSync(INDEX, 'utf8') !== indexText) {
  problems.push(`${INDEX} is stale — run npm run traps:write`);
}

for (const [id, files] of cited) {
  if (!defined.has(id)) {
    problems.push(`${id} is cited by ${[...files].join(', ')} but no file in docs/traps/ defines it`);
  }
}

for (const [id, claimed] of defined) {
  const actual = cited.get(id);
  if (!actual) {
    problems.push(`${id} is defined in ${home.get(id)} but nothing cites it — delete it or cite it`);
    continue;
  }
  for (const file of claimed) {
    if (!actual.has(file)) {
      problems.push(`${id}: ${home.get(id)} lists Site \`${file}\`, which does not cite it`);
    }
  }
  for (const file of actual) {
    if (!claimed.has(file)) {
      problems.push(`${id}: ${file} cites it, but ${home.get(id)} does not list it as a Site`);
    }
  }
}

if (problems.length) {
  console.error(`check-traps: ${problems.length} problem(s)\n`);
  for (const problem of problems) console.error(`  ✗ ${problem}`);
  console.error(`\nA trap in docs/traps/, the code that cites it, or ${INDEX} have drifted apart.`);
  process.exit(1);
}

console.log(`check-traps: ${defined.size} traps, ${cited.size} cited, all consistent; ${INDEX} is fresh`);
