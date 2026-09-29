/**
 * ONE CONDITION SYSTEM — Default and Custom Condition Filters.
 *
 * Will, 2026-09-25: "Default filter modes are also technically conditional
 * filters… So we can use the same engine regardless of filtering mode… We
 * should call it a Custom Condition Filter. Default is a Default Condition
 * Filter. We use the blue info styling to represent active Custom Condition
 * Filters."
 *
 * Every answer becomes condition ROWS, and one compiler turns rows into a
 * filter. The TYPE — default or custom — is decided once, in the state, and
 * both the chip's info-blue and its fx badge read it. They used to decide it
 * two different ways.
 *
 *   node --test test/unit/one-condition-system.test.mjs
 *
 * TRAP T-one-condition-system
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { fieldState, stateClause, filterFace } from '../../dist/data.js';

const PLANS = { field: 'plan', values: ['Free', 'Pro', 'Enterprise'] };
const SEATS = { field: 'seats', type: 'number' };

const shape = (facts, reading) => {
  const s = fieldState(facts, reading);
  return { condition: s.condition, rows: s.rows, clause: stateClause(s), badge: filterFace(s).badge };
};

/* ── Default Condition Filters ──────────────────────────────────────── */

test('one tick is a DEFAULT condition: EQUALS X', () => {
  assert.deepEqual(shape(PLANS, { picked: ['Pro'] }), {
    condition: 'simple',
    rows: [{ op: 'eq', picked: ['Pro'] }],
    clause: ['plan', 'eq', 'Pro'],
    badge: '',
  });
});

test('several ticks in ONE field are EQUALS X OR EQUALS Y — `in`, still default', () => {
  const s = shape(PLANS, { picked: ['Pro', 'Free'] });
  assert.equal(s.condition, 'simple');
  assert.deepEqual(s.clause, ['plan', 'in', ['Free', 'Pro']]);
});

test('a dragged RANGE is the field\'s own body answering — default, and `between`', () => {
  const s = shape(SEATS, { picked: ['500', '9'] });
  assert.equal(s.condition, 'simple');
  assert.deepEqual(s.rows, [{ op: 'between', picked: ['500', '9'] }]);
  assert.deepEqual(s.clause, ['seats', 'between', [9, 500]]);
});

/* ── Custom Condition Filters ───────────────────────────────────────── */

test('a TYPED condition is custom', () => {
  const s = shape(PLANS, { op: 'contains', text: 'ro' });
  assert.equal(s.condition, 'advanced');
  assert.deepEqual(s.rows, [{ op: 'contains', text: 'ro' }]);
  assert.deepEqual(s.clause, ['plan', 'contains', 'ro']);
  assert.equal(s.badge, 'fx');
});

test('a NAMED op over ticks is custom — DOES NOT EQUAL is not a default', () => {
  const s = shape(PLANS, { op: 'ne', picked: ['Free'] });
  assert.equal(s.condition, 'advanced');
  assert.deepEqual(s.clause, ['plan', 'ne', 'Free']);
});

test('a chain of rows is custom, and compiles with AND binding tighter', () => {
  const s = shape(PLANS, {
    conditions: [
      { op: 'eq', picked: ['Pro'] },
      { join: 'or', op: 'contains', text: 'Ent' },
    ],
  });
  assert.equal(s.condition, 'advanced');
  assert.deepEqual(s.clause, ['or', ['plan', 'eq', 'Pro'], ['plan', 'contains', 'Ent']]);
});

/* ── No answer ──────────────────────────────────────────────────────── */

test('nothing chosen is NO condition — neither type', () => {
  const s = shape(PLANS, {});
  assert.deepEqual(s, { condition: null, rows: [], clause: undefined, badge: '' });
});

test('EVERYTHING ticked is no filter, so no condition either', () => {
  assert.equal(shape(PLANS, { picked: ['Free', 'Pro', 'Enterprise'] }).condition, null);
});

test('an UNANSWERED row is not a custom condition', () => {
  const s = shape(PLANS, { conditions: [{ op: 'contains', text: '  ' }] });
  assert.equal(s.condition, null);
  assert.equal(s.badge, '');
});

/* ── The two readers agree ──────────────────────────────────────────── */

test('the fx badge and the type AGREE on every shape', () => {
  const readings = [
    {}, { picked: ['Pro'] }, { picked: ['Pro', 'Free'] }, { op: 'contains', text: 'ro' },
    { op: 'contains', text: '' }, { op: 'ne', picked: ['Free'] },
    { conditions: [{ op: 'eq', picked: ['Pro'] }] }, { conditions: [{ op: 'eq', picked: [] }] },
  ];
  for (const reading of readings) {
    const s = fieldState(PLANS, reading);
    assert.equal(filterFace(s).badge === 'fx', s.condition === 'advanced', JSON.stringify(reading));
  }
});
