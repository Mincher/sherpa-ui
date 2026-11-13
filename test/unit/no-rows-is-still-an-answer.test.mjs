/**
 * NO ROWS IS STILL AN ANSWER — Will, 2026-10-22. A day with no rows, or a range
 * whose ends no row holds, filters to 0 matches and stays on: it is not dropped
 * because the field's values (the days the rows hold) do not name it.
 * TRAP T-no-rows-is-still-an-answer
 *
 *   node --test test/unit/no-rows-is-still-an-answer.test.mjs
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { readingClause } from '../../dist/core/data/filter-state.js';

const DAYS = ['2024-12-07', '2024-12-09'];
const facts = (extra = {}) => ({ field: 'created', type: 'date', values: DAYS, ...extra });

test('a range whose ends no row holds is a between', () => {
  assert.deepEqual(
    readingClause(facts({ range: true }), { picked: ['2026-10-22', '2026-10-22'], range: true }),
    ['created', 'between', ['2026-10-22', '2026-10-22']],
  );
});

test('a day no row holds is an eq', () => {
  assert.deepEqual(readingClause(facts(), { picked: ['2026-10-22'] }), ['created', 'eq', '2026-10-22']);
});

test('the one day the rows hold is still a filter, not "everything ticked"', () => {
  assert.deepEqual(readingClause(facts({ values: ['2024-12-07'] }), { picked: ['2024-12-07'] }), ['created', 'eq', '2024-12-07']);
});

test('a list field keeps its rule: every value ticked is those values, a filter (Will, 2026-11-13)', () => {
  assert.deepEqual(readingClause({ field: 'plan', values: ['Pro', 'Free'] }, { picked: ['Pro', 'Free'] }), ['plan', 'in', ['Pro', 'Free']]);
});
