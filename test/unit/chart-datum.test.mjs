/**
 * ONE TOTAL FOR THE RING AND THE LABEL.
 *
 * Three sums lived across two components and disagreed about negatives and
 * about non-numbers, so a donut could draw one total under a label saying
 * another.
 *
 * TRAP T-one-total-for-the-ring-and-the-label
 *
 *   node --test test/unit/chart-datum.test.mjs
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

const { datumTotal, datumValue } =
  await import(new URL('../../dist/core/data/chart-datum.js', import.meta.url));

test('a value is a NUMBER, or zero — never NaN downstream', () => {
  assert.equal(datumValue({ value: 12 }), 12);
  // A legend widens `value` to string | number, so a numeric string counts.
  assert.equal(datumValue({ value: '12' }), 12);
  assert.equal(datumValue({ value: 'n/a' }), 0, 'not NaN, which would poison a sum');
  assert.equal(datumValue({}), 0);
});

test('CLAMPED and UNCLAMPED are different questions, and both are right', () => {
  const data = [{ value: 10 }, { value: -5 }, { value: 20 }];
  /* The exact case that was wrong: a ring clamped while its own centre label
     did not, so it drew 30 under a label reading 25. Both answers are correct
     for their own question — which is why `clamp` has no default. */
  assert.equal(datumTotal(data, { clamp: true }), 30, 'a negative arc is not a shape');
  assert.equal(datumTotal(data, { clamp: false }), 25, 'a printed total says what the data says');
});

test('a non-number contributes nothing, rather than poisoning the sum', () => {
  const data = [{ value: 10 }, { value: 'n/a' }, { value: 5 }];
  assert.equal(datumTotal(data, { clamp: false }), 15);
  assert.equal(datumTotal([], { clamp: false }), 0, 'nothing adds up to nothing');
});
