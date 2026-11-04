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
  ['2026-01-01', '2026-09-30', 'month', '9 months: 9 segments'],
  ['2026-01-01', '2026-12-31', 'month', '12 months: 12 segments'],
  ['2026-01-01', '2027-01-31', 'quarter', '13 months: 5 quarters'],
  ['2026-01-01', '2027-08-31', 'quarter', '20 months: 7 quarters'],
  ['2026-01-01', '2027-12-31', 'year', '24 months: 2 years'],
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

const { segmentStarts, rangeOf } = await import(new URL('../../dist/core/data/segments.js', import.meta.url));
const { summarise } = await import(new URL('../../dist/core/data/aggregate.js', import.meta.url));

test('a series by week is counted from its range start, padded, and each point says its span', () => {
  const rows = [
    { at: '2026-03-03', n: 5 }, { at: '2026-03-04', n: 7 }, { at: '2026-03-17', n: 1 },
  ];
  const out = summarise(rows, {
    shape: 'aggregate', aggregate: 'sum', field: 'n', over: 'at', bucket: 'week', range: ['2026-03-01', '2026-03-28'],
  });
  // 4 weeks from 1 Mar: a quiet week is 0.
  assert.deepEqual(out.values, [12, 0, 1, 0]);
  assert.equal(out.value, 13);
  assert.match(out.labels[0], /Mar.+1.+7|1.+7.+Mar/);
});

test('last 6 months is 6 segments, whatever the calendar says (TODO 540)', () => {
  const rows = [{ at: '2026-05-04', n: 1 }, { at: '2026-07-31', n: 2 }, { at: '2026-11-04', n: 4 }];
  const out = summarise(rows, {
    shape: 'aggregate', aggregate: 'sum', field: 'n', over: 'at', bucket: 'month', range: ['2026-05-04', '2026-11-04'],
  });
  assert.equal(out.values.length, 6);
  // The last day, 4 Nov, is in the last segment, which starts 4 Oct.
  assert.deepEqual(out.values, [1, 0, 2, 0, 0, 4]);
});

test('segment counts: the number of units, rounded up (Will, TODO 540)', () => {
  const count = (from, to) => segmentStarts(from, to, segmentUnit(from, to)).length;
  assert.equal(count('2026-01-01', '2026-12-31'), 12);
  assert.equal(count('2026-01-01', '2027-01-31'), 5);
  assert.equal(count('2026-01-01', '2027-08-31'), 7);
  assert.equal(count('2026-01-01', '2027-12-31'), 2);
  assert.equal(count('2026-03-01', '2026-03-07'), 7);
  assert.equal(count('2026-03-01', '2026-03-14'), 14);
});

test('last N counts today once: last 7 days is 7 days, last 6 months is 6', () => {
  const today = new Date('2026-11-04T10:00:00Z');
  assert.deepEqual(rangeOf({ last: 7, unit: 'day' }, today), ['2026-10-29', '2026-11-04']);
  const [from, to] = rangeOf({ last: 6, unit: 'month' }, today);
  assert.equal(segmentStarts(from, to, segmentUnit(from, to)).length, 6);
  const [f12, t12] = rangeOf({ last: 12, unit: 'month' }, today);
  assert.equal(segmentStarts(f12, t12, segmentUnit(f12, t12)).length, 12);
});
