#!/usr/bin/env node
/**
 * check-size.mjs — lines per file, against a baseline that may only FALL.
 *
 * A refactor must delete what it replaces; this shows whether it did. A file
 * that grew past its baseline fails, a new file is reported, and a shrink is
 * good news to record. In the pre-commit hook — Will, 2026-09-26: growth is
 * recorded ON PURPOSE, never by accident.
 *
 *   npm run check:size                    compare against the baseline
 *   npm run check:size -- --update-baseline   record the counts as they are now
 *
 * Map:
 * - SOURCES — the files counted: component and core TypeScript, CSS and HTML, and the example Contexts
 * - lines — one file's line count
 * - measure — every counted file's line count, by path
 */
import { readFileSync, writeFileSync, globSync, existsSync } from 'node:fs';

export const SOURCES = [
  'src/**/*.ts',
  'src/components/**/*.css',
  // The HAND-WRITTEN shared and family sheets — a rule moved there still counts.
  // (typography, group-positions and style-modes are generated.)
  'src/core/sherpa-base.css',
  'src/core/sherpa-anchor.css',
  'src/core/sherpa-grouping.css',
  'src/core/sherpa-icon.css',
  'src/core/sherpa-motion.css',
  'src/core/sherpa-chart-*.css',
  'src/components/**/*.html',
];

const BASELINE = 'scripts/size-baseline.json';

/** One file's line count. */
export const lines = (path) => readFileSync(path, 'utf8').split('\n').length;

/** Every counted file's line count, by path. */
export function measure() {
  const out = {};
  for (const pattern of SOURCES) {
    for (const path of globSync(pattern).sort()) out[path] = lines(path);
  }
  return out;
}

const now = measure();

if (process.argv.includes('--update-baseline')) {
  writeFileSync(BASELINE, `${JSON.stringify(now, null, 2)}\n`);
  const total = Object.values(now).reduce((a, b) => a + b, 0);
  console.log(`check-size: baseline recorded — ${Object.keys(now).length} files, ${total} lines`);
  process.exit(0);
}

if (!existsSync(BASELINE)) {
  console.error(`check-size: no ${BASELINE} — run with --update-baseline first`);
  process.exit(1);
}

const was = JSON.parse(readFileSync(BASELINE, 'utf8'));
const grew = [];
const fell = [];
const added = [];
for (const [path, count] of Object.entries(now)) {
  if (!(path in was)) added.push([path, count]);
  else if (count > was[path]) grew.push([path, was[path], count]);
  else if (count < was[path]) fell.push([path, was[path], count]);
}
const gone = Object.keys(was).filter((path) => !(path in now));

const net = Object.values(now).reduce((a, b) => a + b, 0)
  - Object.values(was).reduce((a, b) => a + b, 0);
for (const [path, from, to] of fell) console.log(`  ▼ ${path}  ${from} → ${to}`);
for (const path of gone) console.log(`  ✂ ${path}  (deleted)`);
for (const [path, count] of added) console.log(`  + ${path}  ${count} (new)`);
for (const [path, from, to] of grew) console.log(`  ▲ ${path}  ${from} → ${to}`);
console.log(`check-size: net ${net >= 0 ? '+' : ''}${net} lines · ${fell.length} fell · ${gone.length} deleted · ${added.length} new · ${grew.length} grew`);

if (grew.length) {
  console.error('\nA file grew past its baseline. Delete what the change replaced, or');
  console.error('record the growth on purpose: npm run check:size -- --update-baseline');
  process.exit(1);
}
