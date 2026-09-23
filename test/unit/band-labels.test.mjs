/**
 * A BAND LABEL NAMES WHAT IT COUNTS.
 *
 * `bandBy` bands are half-open — [0,20), [20,40) — except the last, which owns
 * its top edge. The LABELS said otherwise: with edges 0,20,40 they read "0-20"
 * and "21-40", so a value of exactly 20 was counted in the second band while
 * the first bar claimed it. Every bar was the right height, which is why it
 * survived: only the label a reader reads was wrong.
 *
 * TRAP T-a-band-label-names-what-it-counts
 *
 *   node --test test/unit/band-labels.test.mjs
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

const { bandBy } = await import(new URL('../../dist/data.js', import.meta.url));

const rows = (...values) => values.map((v) => ({ v }));

/** Which band label did this one value land in? */
const bandOf = (value, edges) =>
  bandBy(rows(value), 'v', edges).find((d) => d.value === 1)?.label;

test('EVERY boundary value is in the band its label names', () => {
  const edges = [0, 20, 40];
  assert.equal(bandOf(0, edges), '0-19');
  assert.equal(bandOf(19, edges), '0-19');
  assert.equal(bandOf(20, edges), '20-40', 'it used to read "0-20" and count here');
  assert.equal(bandOf(40, edges), '20-40');
});

test('the LAST band owns its top edge — a value has to land somewhere', () => {
  const out = bandBy(rows(80, 100), 'v', [0, 20, 40, 60, 80, 100]);
  assert.deepEqual(out.map((d) => d.label),
    ['0-19', '20-39', '40-59', '60-79', '80-100']);
  assert.equal(out.at(-1).value, 2, 'both 80 and 100 are in the last band');
});

test('a value OUTSIDE the edges is dropped, not squeezed in', () => {
  const out = bandBy(rows(-1, 41), 'v', [0, 20, 40]);
  assert.deepEqual(out.map((d) => d.value), [0, 0]);
});

test('the counts did not move — only the labels', () => {
  const out = bandBy(rows(0, 1, 19, 20, 21, 39, 40), 'v', [0, 20, 40]);
  assert.deepEqual(out.map((d) => d.value), [3, 4],
    '0,1,19 below; 20,21,39,40 above — the same split as before');
});

test("a caller's OWN labels still win", () => {
  const out = bandBy(rows(10, 30), 'v', [0, 20, 40], { labels: ['Low', 'High'] });
  assert.deepEqual(out.map((d) => d.label), ['Low', 'High'],
    'bands often mean something the numbers do not say');
});

test('a non-number is SKIPPED, never counted as zero', () => {
  const mixed = [{ v: 10 }, { v: null }, { v: '' }, { v: { a: 1 } }, { v: 'x' }];
  const out = bandBy(mixed, 'v', [0, 20, 40]);
  assert.deepEqual(out.map((d) => d.value), [1, 0],
    'TRAP T-number-of-null-is-zero — a missing value is not a nought');
});

test('fewer than two edges is no bands, never a crash', () => {
  assert.deepEqual(bandBy(rows(1, 2), 'v', [0]), []);
  assert.deepEqual(bandBy(rows(1, 2), 'v', []), []);
});
