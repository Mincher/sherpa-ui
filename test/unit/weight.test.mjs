/**
 * What one import costs may only fall, and no display component reaches the
 * app layer, so it stays opt-in (TODO 220). The gate is scripts/check-weight.mjs.
 *
 *   npm run build && node --test test/unit/weight.test.mjs
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { weigh } from '../../scripts/check-weight.mjs';

const { weights, reaches } = weigh();

test('no display component reaches the app layer', () => {
  assert.deepEqual(reaches, {});
});

test('every entry is within its recorded weight', () => {
  const base = JSON.parse(readFileSync('scripts/weight-baseline.json', 'utf8'));
  const over = Object.entries(weights)
    .filter(([name, w]) => !base[name] || w.js > base[name].js || w.fetched > base[name].fetched)
    .map(([name]) => name);
  assert.deepEqual(over, [], 'record growth on purpose: npm run check:weight -- --update-baseline');
});
