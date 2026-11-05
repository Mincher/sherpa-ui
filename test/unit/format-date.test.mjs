/**
 * A DATE READS ONE WAY — TODO 45.
 *
 *   node --test test/unit/format-date.test.mjs
 *
 * TRAP T-a-date-reads-one-way
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { formatDate } from '../../dist/data.js';

test('one day reads DD Mmm YYYY', () => {
  assert.equal(formatDate('2026-09-03'), '03 Sep 2026');
  assert.equal(formatDate('2026-09-03', '2026-09-03'), '03 Sep 2026');
});

test('a range says each part once: month, then year', () => {
  assert.equal(formatDate('2026-09-03', '2026-09-15'), '03 to 15 Sep 2026');
  assert.equal(formatDate('2026-09-03', '2026-10-15'), '03 Sep to 15 Oct 2026');
  assert.equal(formatDate('2026-12-18', '2027-01-03'), '18 Dec 2026 to 03 Jan 2027');
});

test('read in UTC, so no browser shows the day before; a non-day is shown as given', () => {
  assert.equal(formatDate('2026-01-01T23:30:00Z'), '01 Jan 2026');
  assert.equal(formatDate('last week'), 'last week');
});

test('a day and its time read in words, and what a reader types reads back as ISO (plan 749 P4)', async () => {
  const { formatDateTime, isDateTime, readDateTime } = await import('../../dist/core/data/format-date.js');
  assert.equal(formatDateTime('2024-01-12'), '12 Jan 2024');
  assert.equal(formatDateTime('2024-01-12T09:30'), '12 Jan 2024, 09:30');
  assert.equal(formatDateTime('soon'), 'soon');
  // Its own words read back, and ISO, with a T or a space; a day the calendar has not is none.
  for (const iso of ['2024-01-12', '2024-01-12T09:30', '2024-02-29']) assert.equal(readDateTime(formatDateTime(iso)), iso);
  assert.equal(readDateTime('12 January 2024'), '2024-01-12');
  assert.equal(readDateTime(' 3 jan 2024 9:05 '), '2024-01-03T09:05');
  assert.equal(readDateTime('2024-01-12 09:30'), '2024-01-12T09:30');
  for (const no of ['2024-02-30', '2023-02-29', '2024-01-12T24:00', '31 Feb 2024', 'next Tuesday', '']) assert.equal(readDateTime(no), undefined, no);
  assert.deepEqual(['2024-02-29', '2024-02-30', '2024-1-2'].map(isDateTime), [true, false, false]);
});
