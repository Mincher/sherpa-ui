/**
 * A DATE IS LIMITED AS A LIST IS — Will, TODO 982 A (2026-11-15): "the date is limited by the walk as a list is, live,
 * one door for lists and dates, on any card." A date field's ruler tallies the days the filters before it leave, as a
 * list's tallies its values, where a chip holds it: with Limit, at its place; without, a card's at the View's end (347). A range outside them
 * stays in force and reads 0 (Will, 2026-10-20). Held rows and a store's own requests give the same.
 *
 *   node --test test/unit/a-date-is-limited-as-a-list-is.test.mjs
 *
 * TRAP T-a-ruled-out-value-is-greyed
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { ArrayStore } from '../../dist/data.js';
import { walkInOrder } from '../../dist/core/data/walk.js';
import { planWalk, walkStepwise } from '../../dist/core/data/source-counts.js';

// Pro accounts were seen in January, Free ones in March.
const ROWS = [
  ['Pro', '2024-01-05'], ['Pro', '2024-01-20'], ['Pro', '2024-01-20'], ['Free', '2024-03-02'], ['Free', '2024-03-30'],
].map(([plan, seen], id) => ({ id, plan, seen }));
const PRO_DAYS = ['2024-01-05', '2024-01-20'];

/** A source's facts, by hand: Plan a list, Seen a date. */
const facts = (over = {}) => ({
  field: (f) => (f === 'seen' ? { type: 'date' } : {}),
  isList: (f) => f === 'plan',
  isDate: (f) => f === 'seen',
  plainPicks: (_f, r) => !r.range,
  sets: () => [],
  fields: (scope) => (scope === 'view' ? ['plan', 'seen'] : ['seen']),
  components: new Set(['data']),
  fixed: new Set(),
  narrowing: new Map(),
  limit: false,
  now: new Date('2026-11-15T12:00:00Z'),
  ...over,
});
/** The View holds Plan, Pro picked; the card holds Seen, with a reading or none. */
const query = (seen) => ({
  v: 1,
  scopes: {
    view: { holds: ['plan'], readings: { plan: { picked: ['Pro'] } } },
    data: { holds: ['seen'], readings: seen ? { seen } : {} },
  },
});
const sorted = (keys) => [...(keys ?? [])].sort();

test('a card\'s date is told the days the View leaves it, as a list is told its values; no isDate, no date is limited', () => {
  const w = walkInOrder(ROWS, planWalk(query(), facts()));
  assert.deepEqual(sorted(w.present.data?.seen), PRO_DAYS);
  // As before: a source that says no field is a date limits none.
  const { isDate: _d, ...lists } = facts();
  assert.equal(walkInOrder(ROWS, planWalk(query(), lists)).present.data?.seen, undefined);
});

test('with Limit, a date is told the days at its place; one no chip holds is tallied nowhere (a chip added asks a walk, 981)', () => {
  const w = walkInOrder(ROWS, planWalk(query(), facts({ limit: true })));
  assert.deepEqual(sorted(w.present.data?.seen), PRO_DAYS);
  assert.equal(w.present.view?.seen, undefined, 'the View holds no Seen chip');
});

test('a range outside the days stays in force and reads 0; the days it is told are the same (Will, 2026-10-20)', () => {
  const march = { picked: ['2024-03-01', '2024-03-31'], range: true };
  const w = walkInOrder(ROWS, planWalk(query(march), facts()));
  assert.deepEqual([w.results.data?.seen, w.ends.data], [0, 0]);
  assert.deepEqual(sorted(w.present.data?.seen), PRO_DAYS);
});

test('a store asked step by step gives the same days', async () => {
  const plan = planWalk(query(), facts({ limit: true }));
  const asked = await walkStepwise(new ArrayStore(ROWS, { key: 'id' }), plan);
  const held = walkInOrder(ROWS, plan);
  assert.deepEqual(sorted(asked.present.data?.seen), sorted(held.present.data?.seen));
  assert.deepEqual(sorted(asked.present.data?.seen), PRO_DAYS);
});
