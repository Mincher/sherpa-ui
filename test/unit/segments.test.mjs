/**
 * A RANGE IS CUT INTO THE LARGEST UNIT THAT FITS AT LEAST THREE WHOLE TIMES (TODO 540).
 *
 *   node --test test/unit/segments.test.mjs
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

const { segmentUnit, segmentLabel } = await import(new URL('../../dist/core/data/segments.js', import.meta.url));

const CASES = [
  ['2026-03-04', '2026-03-04', 'hour2', 'a single day: 12 steps of 2 hours'],
  ['2026-03-04', '2026-03-05', 'day', 'two days'],
  ['2026-03-01', '2026-03-07', 'day', 'a week: 7 days'],
  ['2026-03-01', '2026-03-14', 'day', '2 weeks: 14 days, not 2 weeks'],
  ['2026-03-01', '2026-03-09', 'day', '9 days win over 2 weeks'],
  ['2026-03-01', '2026-03-21', 'week', '3 weeks'],
  ['2026-03-01', '2026-03-31', 'week', 'one month: a week each'],
  ['2026-01-01', '2026-02-12', 'week', '6 weeks win over 2 months'],
  ['2026-01-01', '2026-03-31', 'month', '3 months'],
  ['2026-01-01', '2026-08-31', 'month', '8 months win over 3 quarters'],
  ['2026-01-01', '2026-09-30', 'quarter', '9 months: 3 quarters'],
  ['2026-01-01', '2028-12-31', 'year', '3 years'],
  ['2026-03-05', '2026-03-04', 'day', 'an end before its start is no range'],
];

for (const [from, to, unit, why] of CASES) {
  test(`${from}..${to} → ${unit} (${why})`, () => assert.equal(segmentUnit(from, to), unit));
}

test('a segment says its time span', () => {
  assert.match(segmentLabel('2026-03-02', 'week'), /Mar.+2.+8|2.+8.+Mar/);
  assert.match(segmentLabel('2026-03-04', 'day'), /Wed/);
  assert.match(segmentLabel('2026-03', 'month'), /March 2026/);
  assert.equal(segmentLabel('2026-Q1', 'quarter'), 'Q1 2026');
  assert.match(segmentLabel('2026-03-04T08', 'hour2'), /08:00.10:00/);
});

const { summarise } = await import(new URL('../../dist/core/data/aggregate.js', import.meta.url));

test('a series by week is padded to its range, and each point says its span', () => {
  const rows = [
    { at: '2026-03-03', n: 5 }, { at: '2026-03-04', n: 7 }, { at: '2026-03-17', n: 1 },
  ];
  const out = summarise(rows, {
    shape: 'aggregate', aggregate: 'sum', field: 'n', over: 'at', bucket: 'week', range: ['2026-03-01', '2026-03-28'],
  });
  // Mondays 23 Feb (holds Sun 1 Mar), 2, 9, 16, 23 Mar: a quiet week is 0.
  assert.deepEqual(out.values, [0, 12, 0, 1, 0]);
  assert.equal(out.value, 13);
  assert.equal(out.labels.length, 5);
});
