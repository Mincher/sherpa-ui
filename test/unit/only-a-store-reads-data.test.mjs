/**
 * ONLY A STORE READS DATA — Will, 2026-11-14: "Nothing should ever read a Data Source directly except a Data Store."
 * PRINCIPLES 25. The half a test can hold: only the modules listed here reach outside the page — `fetch`, an
 * `EventSource`, a `WebSocket`, an `XMLHttpRequest`, a file read — each for its reason. A store reads rows; the rest
 * read what is no row: a definition, a template, an icon, a notice. No module imports a JSON file. A new one fails here
 * until it is listed, and says why.
 *
 *   node --test test/unit/only-a-store-reads-data.test.mjs
 *
 * TRAP T-only-a-store-reads-data
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

/** Each module that reaches outside, and what it reads. */
const READERS = {
  // Stores: the one door to rows.
  'src/core/data/stores.ts': 'a store: a request store, and a file store',
  'src/core/data/live-stores.ts': 'a store: a live feed of rows',
  'src/core/browser/worker-store.ts': 'a store: a request store in a worker',
  'src/core/browser/type-stores.ts': 'a store: a type\'s rows, from the data file its type names',
  'src/core/browser/entity-files.ts': 'the shelf, the entities\' store: an app\'s entity files',
  // No rows.
  'src/core/browser/view-files.ts': 'a definition: an app\'s saved Views',
  'src/components/sherpa-outlet/sherpa-outlet.ts': 'a definition: a page',
  'src/core/browser/follow-updates.ts': 'notices that a store\'s rows moved, and a store asked to read again',
  'src/core/ui/templater.ts': 'a component\'s template and sheet',
  'src/core/ui/render-icon.ts': 'the icon sprite',
  'src/core/worker/app-files.ts': 'the app\'s own files, kept for offline',
  'src/core/server/worker-script.ts': 'a worker\'s script',
};

// The global `fetch`, never a method of that name (`source.fetch()`, an interface's `fetch(): Promise<void>`).
// …and a JSON file imported whole: rows would be read around their store.
const READS = /(?<![.\w#])fetch\((?!\)\s*:)|new EventSource\(|new WebSocket\(|XMLHttpRequest|\breadFile(?:Sync)?\(|\bimport\b[^;]*['"][^'"]+\.json['"]/;

/** Every source file, by its path from the repo. */
function* files(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) yield* files(path);
    else if (path.endsWith('.ts') && !path.endsWith('.d.ts')) yield path;
  }
}
/** A file's code, its comments left out: a comment that names `fetch(` reads nothing. */
const code = (path) => readFileSync(path, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

test('only the listed modules reach outside the page, each for its reason', () => {
  const found = [...files('src')].filter((path) => READS.test(code(path))).sort();
  assert.deepEqual(found, Object.keys(READERS).sort());
});
