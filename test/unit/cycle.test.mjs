/**
 * ONE CYCLE FOR ONE VALUE.
 *
 * The sort cycle was written twice — the data grid's column header and the
 * toolbar's Sort chip — and the two DRIFTED: the grid deleted the column on its
 * third click while the chip suspended it. This is the single function both now
 * run. TRAP T-one-cycle-for-one-value.
 * TRAP T-a-suspended-sort-is-one-owners-job — where the state actually lives.
 *
 *   node --test test/unit/cycle.test.mjs
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

const core = new URL('../../dist/core/', import.meta.url);
const { nextSort, nextToggle, sortDirectionAttr, sortDirectionFrom } =
  await import(new URL('cycle.js', core));

test('the full sort cycle: asc → desc → SUSPENDED → asc', () => {
  // A fresh column starts ascending.
  let s = nextSort('name', null, null);
  assert.deepEqual(s, { field: 'name', direction: 'asc' });

  s = nextSort('name', s.field, s.direction);
  assert.deepEqual(s, { field: 'name', direction: 'desc' });

  // THE THIRD STEP SUSPENDS. The field survives — that is the whole difference
  // between suspending and clearing, and what the grid used to get wrong.
  s = nextSort('name', s.field, s.direction);
  assert.deepEqual(s, { field: 'name', direction: null },
    'descending suspends, and KEEPS the column');

  // …and one more click resumes it, with no trip to a menu.
  s = nextSort('name', s.field, s.direction);
  assert.deepEqual(s, { field: 'name', direction: 'asc' });
});

test('a suspended sort resumes ASCENDING, not at the direction it was left at', () => {
  // Suspended from `desc`. Resuming into `desc` would read as the click having
  // done nothing — the reader turned it off in exactly that state.
  const s = nextSort('name', 'name', null);
  assert.equal(s.direction, 'asc');
});

test('a DIFFERENT column always starts ascending', () => {
  // Whatever the previous column was left at: the direction belongs to the
  // sort, not to the control.
  for (const was of ['asc', 'desc', null]) {
    assert.deepEqual(nextSort('spend', 'name', was), { field: 'spend', direction: 'asc' },
      `from name/${was}`);
  }
});

test('the wire format: an EMPTY direction is suspended, absent is no sort', () => {
  assert.equal(sortDirectionAttr({ field: 'n', direction: 'asc' }), 'asc');
  assert.equal(sortDirectionAttr({ field: 'n', direction: 'desc' }), 'desc');
  // EMPTY STRING, not absent. The field says WHICH column; the direction says
  // whether it is being applied.
  assert.equal(sortDirectionAttr({ field: 'n', direction: null }), '');
  // No field at all — the attribute is removed.
  assert.equal(sortDirectionAttr({ field: null, direction: null }), undefined);
});

test('reading the attribute back', () => {
  assert.equal(sortDirectionFrom('asc'), 'asc');
  assert.equal(sortDirectionFrom('desc'), 'desc');
  // Both mean "not ordering" — the FIELD is what tells suspended from unsorted.
  assert.equal(sortDirectionFrom(''), null);
  assert.equal(sortDirectionFrom(undefined), null);
  assert.equal(sortDirectionFrom(null), null);
  // Anything unrecognised is not a direction.
  assert.equal(sortDirectionFrom('sideways'), null);
});

test('a full round trip through the attribute', () => {
  let state = { field: 'n', direction: 'desc' };
  for (const expected of [null, 'asc', 'desc', null]) {
    const attr = sortDirectionAttr(state);
    state = nextSort('n', state.field, sortDirectionFrom(attr));
    assert.equal(state.direction, expected,
      'the cycle survives being written to an attribute and read back');
  }
});

test('nextToggle: two states, and off is one of them', () => {
  assert.equal(nextToggle(true), false);
  assert.equal(nextToggle(false), true);
});
