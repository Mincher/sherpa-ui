/**
 * Sherpa's dates are `Temporal`; an engine without it — every iOS browser, and
 * Node 24 — gets the stand-in, which must answer as `Temporal` would. Will,
 * TODO 255. TRAP T-temporal-is-the-date-model
 *
 *   node --test test/unit/a-day-without-temporal.test.mjs
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { hasTemporal, plainDate, plainYearMonth, today } from '../../dist/core/ui/temporal.js';

test('node has no Temporal, so this is the stand-in', () => {
  assert.equal(hasTemporal(), false);
});

test('a day: from ISO text, its parts, its weekday, its text', () => {
  const d = plainDate('2024-02-29');
  assert.deepEqual([d.year, d.month, d.day, d.dayOfWeek, d.toString()], [2024, 2, 29, 4, '2024-02-29']);
  assert.equal(plainDate('2026-10-18').dayOfWeek, 7);
  assert.equal(plainDate({ year: 5, month: 1, day: 1 }).toString(), '0005-01-01');
  assert.equal(plainDate({ year: 2000, month: 2, day: 1 }).toLocaleString('en', { month: 'long' }), 'February');
});

test('bad text throws; fields clamp the day to the month, as Temporal does', () => {
  assert.throws(() => plainDate('2023-02-29'), RangeError);
  assert.throws(() => plainDate('2023-13-01'), RangeError);
  assert.throws(() => plainDate('not a day'), RangeError);
  assert.equal(plainDate({ year: 2023, month: 2, day: 31 }).toString(), '2023-02-28');
});

test('a month: its length, add and with across years, and its days', () => {
  const m = plainYearMonth({ year: 2024, month: 2 });
  assert.equal(m.daysInMonth, 29);
  assert.equal(plainYearMonth({ year: 2023, month: 2 }).daysInMonth, 28);
  const back = m.add({ months: -3 });
  assert.deepEqual([back.year, back.month], [2023, 11]);
  const on = m.add({ years: 1, months: 11 });
  assert.deepEqual([on.year, on.month], [2026, 1]);
  assert.deepEqual([m.with({ month: 7 }).month, m.with({ year: 1999 }).year], [7, 1999]);
  assert.equal(m.toPlainDate({ day: 1 }).dayOfWeek, 4);
  assert.equal(plainDate('2024-02-10').toPlainYearMonth().daysInMonth, 29);
});

test('a day adds as Temporal does: months first, clamped, then days', () => {
  assert.equal(plainDate('2024-01-31').add({ months: 1 }).toString(), '2024-02-29');
  assert.equal(plainDate('2024-12-30').add({ days: 3 }).toString(), '2025-01-02');
  assert.equal(plainDate('2024-03-01').add({ days: -1 }).toString(), '2024-02-29');
  assert.equal(plainDate('2024-02-29').add({ years: 1 }).toString(), '2025-02-28');
  assert.equal(plainDate('2024-01-31').add({ months: 1, days: 1 }).toString(), '2024-03-01');
});

test('today is this device\'s day', () => {
  const now = new Date();
  const t = today();
  assert.deepEqual([t.year, t.month, t.day], [now.getFullYear(), now.getMonth() + 1, now.getDate()]);
});
