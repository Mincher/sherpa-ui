/**
 * MANY CONDITIONS ON ONE FIELD.
 *
 * A reader may build several rows — `contains "an" OR starts with "B"` — and
 * each row after the first says how it joins the one before it. The whole set
 * is still ONE reading of ONE field, so `stateClause()` returns one filter:
 * a clause when there is one row, a group when there are several.
 *
 *   node --test test/unit/filter-conditions.test.mjs
 *
 * TRAP T-many-conditions-are-one-reading
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { fieldState, stateClause } from '../../dist/data.js';

const FACTS = { field: 'name', values: ['Ann', 'Bob', 'Cara'] };
const clause = (reading) => stateClause(fieldState(FACTS, reading));

test('the SINGLE-condition shape is untouched', () => {
  // Every existing caller writes this, and it must keep returning one clause.
  assert.deepEqual(clause({ op: 'contains', text: 'an' }), ['name', 'contains', 'an']);
  assert.deepEqual(clause({ picked: ['Ann'] }), ['name', 'eq', 'Ann']);
});

test('two rows joined by OR become a group', () => {
  assert.deepEqual(
    clause({ tree: { or: [{ op: 'contains', value: 'an' }, { op: 'contains', value: 'ob' }] } }),
    ['or', ['name', 'contains', 'an'], ['name', 'contains', 'ob']],
  );
});

test('two rows joined by AND become a group', () => {
  assert.deepEqual(
    clause({ tree: { and: [{ op: 'contains', value: 'a' }, { op: 'endswith', value: 'n' }] } }),
    ['and', ['name', 'contains', 'a'], ['name', 'endswith', 'n']],
  );
});

test('rows read left to right — A or B and C is (A or B) and C (Will, TODO 594)', () => {
  /* Each row joins all before it, as a reader reads a stack: the AND reaches both. */
  assert.deepEqual(
    clause({ tree: { and: [{ or: [{ op: 'contains', value: 'a' }, { op: 'startswith', value: 'B' }] }, { op: 'contains', value: 'o' }] } }),
    ['and',
      ['or', ['name', 'contains', 'a'], ['name', 'startswith', 'B']],
      ['name', 'contains', 'o']],
  );
});

test('an `eq` row takes PICKS, not typed text', () => {
  // Will's rule: for Equals the second input is a select of the field's values.
  assert.deepEqual(
    clause({ tree: { or: [{ op: 'eq', value: 'Ann' }, { op: 'eq', value: 'Bob' }] } }),
    ['or', ['name', 'eq', 'Ann'], ['name', 'eq', 'Bob']],
  );
});

test('a HALF-BUILT row narrows nothing', () => {
  // A row whose op has no value yet is not a filter — the field reads off.
  const half = fieldState(FACTS, { tree: undefined });
  assert.equal(half.fieldState, 'off');
  assert.equal(stateClause(half), undefined);

  // And it is DROPPED from a set that has real rows beside it.
  assert.deepEqual(
    clause({ tree: { op: 'contains', value: 'an' } }),
    ['name', 'contains', 'an'],
  );
});

test('one surviving row is a CLAUSE, never a one-member group', () => {
  // `['or', x]` is valid and pointless; a caller ANDs it either way, but a
  // reader debugging a filter should see the shape they built.
  assert.deepEqual(
    clause({ tree: { op: 'contains', value: 'an' } }),
    ['name', 'contains', 'an'],
  );
});

test('conditions SUSPEND like any other reading', () => {
  const held = fieldState(FACTS, {
    tree: { op: 'contains', value: 'an' },
    suspended: true,
  });
  assert.equal(held.fieldState, 'suspended');
  // Off, but not forgotten — the rows are still there to come back to.
  assert.equal(stateClause(held), undefined);
  assert.ok(held.tree);
});
