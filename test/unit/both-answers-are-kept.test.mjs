/**
 * BOTH ANSWERS ARE KEPT — TODO 102.
 *
 * Will, 2026-09-29: "Both simple and advanced mode conditions need to be
 * tracked and stored to allow switching at any point." A reading keeps its
 * picks AND its rows, and `mode` says which one filters.
 *
 *   node --test test/unit/both-answers-are-kept.test.mjs
 *
 * TRAP T-both-answers-are-kept
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { ArrayStore, DataSource, fieldState, stateClause } from '../../dist/data.js';

const OWNER = { field: 'owner', values: ['Dana', 'Ravi', 'Mo'] };
const BOTH = {
  picked: ['Dana'],
  conditions: [{ op: 'startswith', text: 'R' }],
};
const clause = (reading) => stateClause(fieldState(OWNER, reading));

test('only the answer in force filters', () => {
  assert.deepEqual(clause({ ...BOTH, mode: 'simple' }), ['owner', 'eq', 'Dana']);
  assert.deepEqual(clause({ ...BOTH, mode: 'advanced' }), ['owner', 'startswith', 'R']);
});

test('the answer NOT in force is kept, and filters nothing', () => {
  const simple = fieldState(OWNER, { ...BOTH, mode: 'simple' });
  assert.equal(simple.mode, 'simple');
  assert.deepEqual(simple.conditions, BOTH.conditions);
  assert.equal(simple.condition, 'simple');

  // Advanced with no answered row filters nothing, whatever Simple holds.
  const empty = fieldState(OWNER, { picked: ['Dana'], conditions: [{ op: 'eq' }], mode: 'advanced' });
  assert.equal(empty.fieldState, 'off');
  assert.equal(stateClause(empty), undefined);
  assert.deepEqual(empty.values.filter((v) => v.state === 'picked').map((v) => v.value), ['Dana']);
});

test('a reading with no mode keeps the old rule: rows win where there are any', () => {
  assert.deepEqual(clause(BOTH), ['owner', 'startswith', 'R']);
  assert.equal(fieldState(OWNER, BOTH).mode, 'advanced');
  assert.equal(fieldState(OWNER, { picked: ['Dana'] }).mode, 'simple');
});

test('a source keeps both answers, the mode and the mirror', async () => {
  const source = new DataSource({ store: new ArrayStore([
    { id: 1, owner: 'Dana' }, { id: 2, owner: 'Ravi' }, { id: 3, owner: 'Rex' }, { id: 4, owner: 'Mo' },
  ]) });
  await source.load();
  source.write('data', 'owner', { ...BOTH, mode: 'simple', mirror: false });
  await source.load();
  assert.equal(source.debugState().total, 1);
  assert.deepEqual(source.reading('data', 'owner'), { ...BOTH, mode: 'simple', mirror: false });

  source.write('data', 'owner', { ...BOTH, mode: 'advanced', mirror: false });
  await source.load();
  // Ravi and Rex start with R.
  assert.equal(source.debugState().total, 2);
});
