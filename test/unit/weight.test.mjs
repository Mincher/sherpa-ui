/**
 * What one import costs, in brotli bytes, may only fall, and no display
 * component reaches the app layer, so it stays opt-in (TODO 220). The gate is
 * scripts/check-weight.mjs.
 *
 *   npm run build && node --test test/unit/weight.test.mjs
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { over, weigh } from '../../scripts/check-weight.mjs';

const { weights, reaches } = weigh();

test('no display component reaches the app layer', () => {
  assert.deepEqual(reaches, {});
});

test('every entry is within its recorded weight, in brotli bytes', () => {
  const base = JSON.parse(readFileSync('scripts/weight-baseline.json', 'utf8'));
  assert.deepEqual(over(weights, base), [], 'record growth on purpose: npm run check:weight -- --update-baseline');
});

test('a byte of brotli growth fails, and so does a baseline recorded in raw bytes', () => {
  const now = { 'a.js': { files: 1, brotli: { js: 10, fetched: 0 }, raw: { js: 40, fetched: 0 } } };
  assert.deepEqual(over(now, { 'a.js': { files: 1, brotli: { js: 10, fetched: 0 } } }), []);
  assert.equal(over(now, { 'a.js': { files: 1, brotli: { js: 9, fetched: 0 } } }).length, 1);
  assert.equal(over(now, { 'a.js': { files: 1, js: 40, fetched: 0 } }).length, 1);
});
