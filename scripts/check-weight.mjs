#!/usr/bin/env node
/**
 * check-weight.mjs — what ONE import costs, against a baseline that may only FALL.
 *
 * For each entry — the package, the data layer, every component alone — the JS
 * its import graph loads, and the template and sheet files its components fetch.
 * A new import shows here as weight; growth is recorded on purpose. And no app
 * module (provider, router, session, saved Views) enters a display component's
 * graph, so an app layer stays opt-in. TODO 220.
 *
 *   npm run build && npm run check:weight
 *   npm run check:weight -- --update-baseline   record the weights as they are now
 *
 * Map:
 * - APP — the modules a display component may not reach: the app layer
 * - graph — every module an entry's import graph loads, and every file they fetch
 * - weigh — every entry's JS and fetched bytes, and any app module it reaches
 */
import { existsSync, globSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, normalize, relative } from 'node:path';
import { pathToFileURL } from 'node:url';

const DIST = 'dist';
const BASELINE = 'scripts/weight-baseline.json';

export const APP = [
  'components/sherpa-provider/', 'components/sherpa-router/',
  'core/browser/session.js', 'core/browser/persist-view.js', 'core/browser/route.js',
  'core/browser/view-files.js', 'core/browser/view-drafts.js', 'core/browser/view-sync.js',
];
/** These may reach it: the app layer itself, the package, and the data entry, which ships saved Views and the session. */
const APP_ENTRIES = new Set(['index.js', 'data.js', 'components/sherpa-provider/sherpa-provider.js', 'components/sherpa-router/sherpa-router.js']);

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

/** Every entry's JS and fetched bytes, and any app module it reaches. */
export function weigh() {
  const entries = [`${DIST}/index.js`, `${DIST}/data.js`, ...globSync(`${DIST}/components/*/sherpa-*.js`)
    .filter((f) => f.endsWith(`/${f.split('/').at(-2)}.js`))].sort();
  const bytes = (files) => [...files].reduce((sum, f) => sum + statSync(f).size, 0);
  const out = {};
  const reaches = {};
  for (const entry of entries) {
    const name = relative(DIST, entry);
    const { modules, fetched } = graph(entry);
    out[name] = { js: bytes(modules), files: modules.size, fetched: bytes(fetched) };
    if (APP_ENTRIES.has(name)) continue;
    const app = [...modules].map((m) => relative(DIST, m)).filter((m) => APP.some((a) => m.startsWith(a)));
    if (app.length) reaches[name] = app;
  }
  return { weights: out, reaches };
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  if (!existsSync(`${DIST}/index.js`)) {
    console.error('check-weight: no dist/ — run npm run build first');
    process.exit(1);
  }
  const { weights, reaches } = weigh();
  if (process.argv.includes('--update-baseline')) {
    writeFileSync(BASELINE, `${JSON.stringify(weights, null, 2)}\n`);
    console.log(`check-weight: baseline recorded — ${Object.keys(weights).length} entries`);
  }
  const base = existsSync(BASELINE) ? JSON.parse(readFileSync(BASELINE, 'utf8')) : {};
  const grew = Object.entries(weights).filter(([name, w]) => base[name]
    && (w.js > base[name].js || w.fetched > base[name].fetched))
    .map(([name, w]) => `  ✗ ${name}: js ${base[name].js} → ${w.js}, fetched ${base[name].fetched} → ${w.fetched}`);
  const fresh = Object.keys(weights).filter((name) => !base[name]).map((name) => `  ✗ ${name}: not in the baseline`);
  const app = Object.entries(reaches).map(([name, mods]) => `  ✗ ${name} reaches the app layer: ${mods.join(', ')}`);
  for (const line of [...app, ...grew, ...fresh]) console.error(line);
  if (app.length) console.error('\nA display component imports the app layer. It must stay opt-in (TODO 221).');
  if (grew.length || fresh.length) console.error('\nAn import grew. Remove what it replaced, or record it: npm run check:weight -- --update-baseline');
  if (app.length || grew.length || fresh.length) process.exit(1);
  const button = weights['components/sherpa-button/sherpa-button.js'];
  console.log(`check-weight: ${Object.keys(weights).length} entries within the baseline; one button is ${button?.files} files, ${Math.round((button?.js ?? 0) / 1024)} KB of JS, ${Math.round((button?.fetched ?? 0) / 1024)} KB fetched`);
}
