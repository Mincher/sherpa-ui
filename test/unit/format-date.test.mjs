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
