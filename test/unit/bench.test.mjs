/**
 * What a reader's act costs may only fall: loads, counts, rows, compiles and
 * clones. The gate is scripts/check-bench.mjs. TODO 286
 * TRAP T-the-bench-counts-and-never-times
 *
 *   node --test test/unit/bench.test.mjs
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { bench, over } from '../../scripts/check-bench.mjs';

test('every act is within its recorded cost', async () => {
  const base = JSON.parse(readFileSync('scripts/bench-baseline.json', 'utf8'));
  assert.deepEqual(over(await bench(), base), [], 'record on purpose: npm run check:bench -- --update-baseline');
});
