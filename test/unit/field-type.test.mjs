/**
 * THE FIELD TYPE DECIDES THE CLAUSE.
 *
 * A UI sends PARAMETERS — which field, which values, which conditions. It never
 * builds a query. Before this, the data layer had no idea `seats` was a number,
 * so every app had to know that two picks on it meant a RANGE — and three
 * different query builders grew out of that one gap.
 *
 *   node --test test/unit/field-type.test.mjs
 *
 * TRAP T-the-field-type-decides-the-clause
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { ArrayStore, DataSource, stateClause } from '../../dist/data.js';

const ROWS = [
  { id: 1, seats: 5, owner: 'Dana', made: '2026-01-05' },
  { id: 2, seats: 50, owner: 'Ravi', made: '2026-03-05' },
  { id: 3, seats: 500, owner: 'Dana', made: '2026-06-05' },
  { id: 4, seats: 9, owner: 'Pia', made: '2026-09-05' },
];

const settle = () => new Promise((r) => setTimeout(r, 30));

async function source() {
  const src = new DataSource({ store: new ArrayStore(ROWS, { key: 'id' }) });
  await src.ready;
  src.declareField('seats', { type: 'number', label: 'Seats' });
  src.declareField('made', { type: 'date', label: 'Made' });
  src.declareValues('owner', ['Dana', 'Ravi', 'Pia']);
  return src;
}

const ids = (src) => src.rows.map((r) => r.id);

/* ── A range field ──────────────────────────────────────────────────── */

test('two picks on a NUMBER are a range, sorted numerically', async () => {
  const src = await source();
  src.select('seats', ['9', '500']);
  await settle();

  // Sorted as TEXT this is ["500","9"] and the range matches nothing.
  assert.deepEqual(stateClause(src.selection('seats')), ['seats', 'between', [9, 500]]);
  assert.deepEqual(ids(src), [2, 3, 4]);
});

test('one pick on a NUMBER is a comparison, as a number', async () => {
  const src = await source();
  src.select('seats', ['50']);
  await settle();
  assert.deepEqual(ids(src), [2]);
});

test('two picks on a DATE are a range, sorted lexically', async () => {
  const src = await source();
  src.select('made', ['2026-06-05', '2026-03-05']);
  await settle();
  assert.deepEqual(
    stateClause(src.selection('made')),
    ['made', 'between', ['2026-03-05', '2026-06-05']],
  );
  assert.deepEqual(ids(src), [2, 3]);
});

test('a range field needs no declared value list', async () => {
  const src = await source();
  // Nothing called `declareValues('seats', …)`, and it still filters.
  assert.deepEqual(src.valuesFor('seats'), []);
  src.select('seats', ['1', '10']);
  await settle();
  assert.deepEqual(ids(src), [1, 4]);
});

/* ── Conditions travel through select() ─────────────────────────────── */

test('CONDITIONS answer a field with no picks and no text', async () => {
  const src = await source();
  src.select('owner', [], {
    conditions: [
      { op: 'eq', picked: ['Dana'] },
      { op: 'eq', join: 'or', picked: ['Ravi'] },
    ],
  });
  await settle();

  // Before this the reading was DELETED — no picks, no text, so "not answered".
  assert.deepEqual(
    stateClause(src.selection('owner')),
    ['or', ['owner', 'eq', 'Dana'], ['owner', 'eq', 'Ravi']],
  );
  assert.deepEqual(ids(src), [1, 2, 3]);
});

test('a typed condition reaches the rows too', async () => {
  const src = await source();
  src.select('owner', [], { conditions: [{ op: 'startswith', text: 'D' }] });
  await settle();
  assert.deepEqual(ids(src), [1, 3]);
});

/* ── A text field is unchanged ──────────────────────────────────────── */

test('a TEXT field still turns two picks into `in`', async () => {
  const src = await source();
  src.select('owner', ['Dana', 'Pia']);
  await settle();
  assert.deepEqual(stateClause(src.selection('owner')), ['owner', 'in', ['Dana', 'Pia']]);
  assert.deepEqual(ids(src), [1, 3, 4]);
});

test('an UNDECLARED field is text, so nothing that ignores this changes', async () => {
  const src = new DataSource({ store: new ArrayStore(ROWS, { key: 'id' }) });
  await src.ready;
  src.declareValues('owner', ['Dana', 'Ravi', 'Pia']);
  src.select('owner', ['Ravi']);
  await settle();
  assert.equal(src.selection('owner').type, 'text');
  assert.deepEqual(ids(src), [2]);
});

/* ── The declaration itself ─────────────────────────────────────────── */

test('declareField merges, so type and label can arrive separately', async () => {
  const src = await source();
  src.declareField('seats', { label: 'Licensed seats' });
  assert.deepEqual(src.fieldFacts('seats'), { type: 'number', label: 'Licensed seats' });
  // And the label reaches whatever draws the field.
  assert.equal(src.selection('seats').label, 'Licensed seats');
});
