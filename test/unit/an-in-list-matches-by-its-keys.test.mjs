/**
 * AN IN-LIST MATCHES BY ITS KEYS — TODO 369. `in` and `notin` keep each list's
 * values as a Set of the keys `looseEqual` compares, once per list, instead of a
 * key per list value per row. Every value matches as it did: text without case,
 * a number as a number or its text, an object by its fields, and a null or an
 * undefined only itself.
 *
 *   node --test test/unit/an-in-list-matches-by-its-keys.test.mjs
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { matchesFilter, filterRows } from '../../dist/data.js';

const is = (actual, list) => matchesFilter({ v: actual }, ['v', 'in', list]);
const isNot = (actual, list) => matchesFilter({ v: actual }, ['v', 'notin', list]);

test('text without case, numbers as numbers or their text, objects by their fields', () => {
  assert.equal(is('Pro', ['free', 'PRO']), true);
  assert.equal(is('Team', ['free', 'pro']), false);
  assert.equal(is(5, [5, 9]), true);
  assert.equal(is(5, ['5']), true);
  assert.equal(is('9', [9]), true);
  assert.equal(is(50, [5]), false);
  assert.equal(is({ customer: 'Northwind', site: 'London' }, [{ site: 'London', customer: 'Northwind' }]), true);
  assert.equal(is({ customer: 'Northwind', site: 'Leeds' }, [{ site: 'London', customer: 'Northwind' }]), false);
  assert.equal(isNot('Pro', ['free', 'PRO']), false);
  assert.equal(isNot('Team', ['free', 'PRO']), true);
});

test('null, undefined and the empty string each match only themselves', () => {
  assert.equal(is(null, [null]), true);
  assert.equal(is(null, ['']), false);
  assert.equal(is(undefined, [null]), false);
  assert.equal(is(undefined, [undefined]), true);
  assert.equal(is('', ['']), true);
  assert.equal(is('', [null]), false);
  assert.equal(is(NaN, [NaN]), false);
  // `notin` keeps a row with no value unless the list names it.
  assert.equal(isNot(null, ['Pro']), true);
  assert.equal(isNot(null, [null]), false);
});

test('one list serves every row, and the rows come back in order', () => {
  const rows = Array.from({ length: 10000 }, (_, i) => ({ id: i, plan: `p${i % 200}` }));
  const list = Array.from({ length: 40 }, (_, i) => `P${i}`);
  const t0 = performance.now();
  const kept = filterRows(rows, ['plan', 'in', list]);
  const ms = performance.now() - t0;
  assert.equal(kept.length, 40 * 50);
  assert.equal(kept[0].id, 0);
  // A loose guard, not a benchmark: 10,000 rows by 40 values is well under a second.
  assert.ok(ms < 1000, `${ms} ms`);
});
