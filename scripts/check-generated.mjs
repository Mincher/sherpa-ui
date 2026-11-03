#!/usr/bin/env node
/**
 * check-generated.mjs — every file the specs make is what they make now:
 * custom-elements.json, vscode.html-data.json and the pages in docs/components/.
 * TRAP T-the-manifest-is-written-from-the-specs
 *
 *   npm run check:generated
 */
import { existsSync, readFileSync } from 'node:fs';
import { files } from './write-manifest.mjs';
import { orphans, pages } from './write-reference.mjs';

const editor = files();
const reference = pages();
const stale = (want) => [...want].filter(([f, text]) => !existsSync(f) || readFileSync(f, 'utf8') !== text).map(([f]) => f);
const problems = [
  ...stale(editor).map((f) => `${f} — run: npm run manifest`),
  ...[...stale(reference), ...orphans(reference)].map((f) => `${f} — run: npm run reference`),
];

if (problems.length) {
  console.error(`check:generated — ${problems.length} file(s) not what the specs make:`);
  for (const p of problems) console.error(`  ✗ ${p}`);
  process.exit(1);
}
console.log(`check:generated — ${editor.size} editor files and ${reference.size} reference pages match the specs`);
