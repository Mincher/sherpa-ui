#!/usr/bin/env node
/**
 * check-weight.mjs — what ONE import costs on the wire, against a baseline that may only FALL.
 *
 * For each entry — the package, the data layer, every component alone — the JS
 * its import graph loads and the files its components fetch, in BROTLI bytes,
 * each file compressed alone: every module is its own request. Raw bytes and
 * V8's parse time are reported, not gated: raw overstates the wire 30–70× for
 * repetitive text, and a parse time is the machine's. And no app module enters
 * a display component's graph, so an app layer stays opt-in. TODO 220.
 *
 *   npm run build && npm run check:weight [-- --staged]
 *   npm run check:weight -- --update-baseline   record the weights as they are now
 *
 * --staged (the hook): only when the commit touches what dist/ is built from,
 * and only on a dist/ built after it — CI builds fresh and checks every commit.
 *
 * Map:
 * - APP — the modules a display component may not reach: the app layer
 * - graph — every module an entry's import graph loads, and every file they fetch
 * - weigh — every entry's files and its JS and fetched bytes, brotli and raw; and any app module it reaches
 * - over — each entry heavier in brotli bytes than its baseline, or not in it
 * - parseMs — V8's parse of a set of modules, in ms; null without --experimental-vm-modules
 */
import { execSync } from 'node:child_process';
import { existsSync, globSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, normalize, relative } from 'node:path';
import { pathToFileURL } from 'node:url';
import vm from 'node:vm';
import { brotliCompressSync } from 'node:zlib';

const DIST = 'dist';
const BASELINE = 'scripts/weight-baseline.json';
/** What dist/ is built from; --staged runs when the commit touches one, or this gate. */
const BUILT_FROM = ['src/', 'scripts/build-reforged.mjs', 'tsconfig.reforged.json'];
const STAGED = [...BUILT_FROM, 'scripts/check-weight.mjs', BASELINE];

export const APP = [
  'components/sherpa-provider/', 'components/sherpa-router/', 'components/sherpa-outlet/',
  'core/browser/session.js', 'core/browser/persist-view.js', 'core/browser/route.js',
  'core/browser/view-files.js', 'core/browser/view-drafts.js', 'core/browser/view-sync.js',
  'core/browser/view-markup.js', 'core/browser/saved-filters.js', 'core/ui/bind-settings.js',
  'core/data/app-definition.js',
];
/** These may reach it: the app layer itself, the package, and the data entry, for checkApp, which a server runs headless.
 *  TRAP T-the-app-layer-is-opt-in */
const APP_ENTRIES = new Set([
  'index.js', 'app.js', 'data.js', 'components/sherpa-provider/sherpa-provider.js', 'components/sherpa-router/sherpa-router.js',
  'components/sherpa-outlet/sherpa-outlet.js',
]);

// `\bfrom`, not `\sfrom`: minified code writes `}from"./x.js"`.
const IMPORT = /(?:^|[\s;}])(?:import|export)\s*(?:[^'"`;]*?\bfrom\s*)?['"](\.{1,2}\/[^'"]+)['"]/g;
// An inlined file carries its text as the next argument — `inlined(new URL(…), "…")`,
// renamed when minified — so only a URL with no text after it is fetched. TRAP T-the-text-is-in-the-js
const FETCH = /new URL\(\s*['"](\.{1,2}\/[^'"]+\.(?:css|html))['"]\s*,\s*import\.meta\.url\s*\)(?!\s*,\s*['"`])/g;

/** Every module an entry's import graph loads, and every file they fetch. */
export function graph(entry) {
  const modules = new Set();
  const fetched = new Set();
  const visit = (file) => {
    if (modules.has(file) || !existsSync(file)) return;
    modules.add(file);
    const src = readFileSync(file, 'utf8');
    for (const [, spec] of src.matchAll(IMPORT)) visit(normalize(join(dirname(file), spec)));
    for (const [, spec] of src.matchAll(FETCH)) {
      const path = normalize(join(dirname(file), spec));
      if (existsSync(path)) fetched.add(path);
    }
  };
  visit(entry);
  return { modules, fetched };
}

/** Each file's raw and brotli bytes, compressed once however many graphs hold it. */
const sizes = new Map();
const size = (file) => {
  if (!sizes.has(file)) {
    const bytes = readFileSync(file);
    sizes.set(file, { raw: bytes.length, brotli: brotliCompressSync(bytes).length });
  }
  return sizes.get(file);
};
const total = (files, unit) => [...files].reduce((sum, f) => sum + size(f)[unit], 0);

/** Every entry's files and its JS and fetched bytes, brotli and raw; and any app module it reaches. */
export function weigh() {
  const entries = [`${DIST}/index.js`, `${DIST}/app.js`, `${DIST}/components.js`, `${DIST}/data.js`, ...globSync(`${DIST}/components/*/sherpa-*.js`)
    .filter((f) => f.endsWith(`/${f.split('/').at(-2)}.js`))].sort();
  const out = {};
  const reaches = {};
  for (const entry of entries) {
    const name = relative(DIST, entry);
    const { modules, fetched } = graph(entry);
    out[name] = {
      files: modules.size,
      brotli: { js: total(modules, 'brotli'), fetched: total(fetched, 'brotli') },
      raw: { js: total(modules, 'raw'), fetched: total(fetched, 'raw') },
    };
    if (APP_ENTRIES.has(name)) continue;
    const app = [...modules].map((m) => relative(DIST, m)).filter((m) => APP.some((a) => m.startsWith(a)));
    if (app.length) reaches[name] = app;
  }
  return { weights: out, reaches };
}

/** Each entry heavier in brotli bytes than its baseline, or not in it. */
export function over(weights, base) {
  return Object.entries(weights).flatMap(([name, w]) => {
    const was = base[name]?.brotli;
    if (!was) return [`${name}: not in the baseline in brotli bytes`];
    if (w.brotli.js <= was.js && w.brotli.fetched <= was.fetched) return [];
    return [`${name}: brotli js ${was.js} → ${w.brotli.js}, fetched ${was.fetched} → ${w.brotli.fetched} (raw js ${w.raw.js})`];
  });
}

/** Each module's parse, the fastest of 9, each a fresh copy so no cache can answer. */
const parses = new Map();
/** V8's parse of a set of modules, in ms; null without --experimental-vm-modules. */
export function parseMs(files) {
  if (!vm.SourceTextModule) return null;
  let sum = 0;
  for (const file of files) {
    if (!parses.has(file)) {
      const src = readFileSync(file, 'utf8');
      let best = Infinity;
      for (let i = 0; i < 9; i++) {
        const copy = `${src}\n//${i}`;
        const start = performance.now();
        new vm.SourceTextModule(copy);
        best = Math.min(best, performance.now() - start);
      }
      parses.set(file, best);
    }
    sum += parses.get(file);
  }
  return sum;
}

/** Why dist/ cannot be weighed, or null. A dev build fetches what the shipped build inlines. */
const unweighable = () => (!existsSync(`${DIST}/index.js`) ? 'there is no dist/'
  : globSync(`${DIST}/components/*/*.html`).length ? 'dist/ is a dev build' : null);

/** Why --staged leaves this commit to CI, or null when the dist/ here measures it. */
function leftToCI() {
  const staged = execSync('git diff --cached --name-only --diff-filter=d', { encoding: 'utf8' }).split('\n').filter(Boolean);
  if (!staged.some((f) => STAGED.some((s) => f.startsWith(s)))) return 'nothing the weight measures is staged';
  const why = unweighable();
  if (why) return why;
  const built = statSync(`${DIST}/index.js`).mtimeMs;
  const newer = staged.filter((f) => BUILT_FROM.some((s) => f.startsWith(s)) && statSync(f).mtimeMs > built);
  return newer.length ? `dist/ is older than ${newer[0]}${newer.length > 1 ? ` and ${newer.length - 1} more` : ''}` : null;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const left = process.argv.includes('--staged') && leftToCI();
  if (left) {
    console.log(`check-weight: not checked here — ${left}; CI weighs it`);
    process.exit(0);
  }
  const why = unweighable();
  if (why) {
    console.error(`check-weight: ${why} — run npm run build first`);
    process.exit(1);
  }
  const { weights, reaches } = weigh();
  if (process.argv.includes('--update-baseline')) {
    const record = Object.fromEntries(Object.entries(weights).map(([name, w]) => [name, { files: w.files, brotli: w.brotli }]));
    writeFileSync(BASELINE, `${JSON.stringify(record, null, 2)}\n`);
    console.log(`check-weight: baseline recorded — ${Object.keys(weights).length} entries, in brotli bytes`);
  }
  const base = existsSync(BASELINE) ? JSON.parse(readFileSync(BASELINE, 'utf8')) : {};
  const grew = over(weights, base).map((line) => `  ✗ ${line}`);
  const app = Object.entries(reaches).map(([name, mods]) => `  ✗ ${name} reaches the app layer: ${mods.join(', ')}`);
  for (const line of [...app, ...grew]) console.error(line);
  if (app.length) console.error('\nA display component imports the app layer. It must stay opt-in (TODO 221).');
  if (grew.length) console.error('\nAn import grew. Remove what it replaced, or record it: npm run check:weight -- --update-baseline');
  if (app.length || grew.length) process.exit(1);
  const kb = (bytes) => Math.round(bytes / 102.4) / 10;
  const shown = ['index.js', 'components.js', 'app.js', 'data.js', 'components/sherpa-button/sherpa-button.js',
    'components/sherpa-data-grid/sherpa-data-grid.js'];
  console.log(`check-weight: ${Object.keys(weights).length} entries within the baseline, in brotli bytes`);
  console.table(Object.fromEntries(shown.filter((name) => weights[name]).map((name) => {
    const w = weights[name];
    const ms = parseMs(graph(`${DIST}/${name}`).modules);
    return [name, {
      files: w.files, 'js KB brotli': kb(w.brotli.js), 'js KB raw': kb(w.raw.js),
      'fetched KB brotli': kb(w.brotli.fetched), 'fetched KB raw': kb(w.raw.fetched),
      'parse ms': ms === null ? 'needs --experimental-vm-modules' : Math.round(ms * 10) / 10,
    }];
  })));
}
