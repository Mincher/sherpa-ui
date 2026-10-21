/**
 * ONE-FIELD REQUESTS — 366 step 18. setReading, suspend, take, reset and batch
 * on the QueryContext: each is one change, and a request whose answer is
 * already in force changes nothing and tells no one.
 * TRAP T-one-query-one-owner
 *
 *   node --test test/unit/one-field-requests.test.mjs
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { ArrayStore, DataSource, QueryContext, VIEW } from '../../dist/data.js';

const ROWS = [
  { id: 1, plan: 'Pro', status: 'active' }, { id: 2, plan: 'Free', status: 'trial' }, { id: 3, plan: 'Pro', status: 'trial' },
];
const make = () => {
  const query = new QueryContext();
  const source = new DataSource({ store: new ArrayStore(ROWS, { key: 'id' }), query });
  const told = [];
  query.addEventListener('query-change', (e) => told.push(e.detail));
  return { query, source, told };
};

test('setReading lands at the field\'s home; the same answer again is a no-op', async () => {
  const { query, source, told } = make();
  query.hold('data', ['plan']);
  told.length = 0;
  query.setReading(VIEW, 'plan', { picked: ['Pro'] });
  assert.deepEqual(query.reading('data', 'plan').picked, ['Pro'], 'at its home, wherever it was asked');
  assert.equal(told.length, 1);
  query.setReading(VIEW, 'plan', { picked: ['Pro'] });
  assert.equal(told.length, 1, 'the same answer: no change, no event');
  await source.load();
  assert.deepEqual(source.rows.map((r) => r.id), [1, 3]);
  query.setReading(VIEW, 'plan', null);
  assert.equal(query.reading('data', 'plan'), undefined, 'null clears it');
});

test('a field no scope holds is held where it is asked, when that scope may hold it', () => {
  const { query } = make();
  query.offer('data', ['status']);
  query.setReading('data', 'status', { picked: ['trial'] });
  assert.deepEqual(query.scope('data'), ['status']);
  assert.deepEqual(query.reading('data', 'status').picked, ['trial']);
  // The View holds nothing it is not given.
  query.setReading(VIEW, 'plan', { picked: ['Pro'] });
  assert.deepEqual(query.scope(VIEW), []);
});

test('suspend: off keeps the answer, and on gives the same reading back', () => {
  const { query, source } = make();
  query.hold(VIEW, ['plan']);
  query.setReading(VIEW, 'plan', { picked: ['Pro'] });
  const on = query.reading(VIEW, 'plan');
  query.suspend(VIEW, 'plan', true);
  assert.equal(query.reading(VIEW, 'plan').suspended, true);
  assert.equal(source.state.filter, undefined, 'off filters nothing');
  query.suspend(VIEW, 'plan', false);
  assert.deepEqual(query.reading(VIEW, 'plan'), on);
  // The scope's Switch: every answer in it, off and back.
  query.suspend(VIEW, null, true);
  assert.deepEqual(query.applied.scopes[VIEW].suspended, { fields: ['plan'] });
  query.suspend(VIEW, null, false);
  assert.deepEqual(query.reading(VIEW, 'plan'), on);
});

test('take holds fields in a scope, as a request to add them does', () => {
  const { query } = make();
  query.offer('data', ['plan', 'status']);
  query.take('data', ['plan', 'status']);
  assert.deepEqual(query.scope('data'), ['plan', 'status']);
});

test('reset clears the answers homed in its scopes, and leaves the others alone', () => {
  const { query } = make();
  query.hold(VIEW, ['plan']);
  query.hold('data', ['status']);
  query.setReading(VIEW, 'plan', { picked: ['Pro'] });
  query.setReading('data', 'status', { picked: ['trial'] });
  query.reset(['data']);
  assert.equal(query.reading('data', 'status'), undefined);
  assert.deepEqual(query.reading(VIEW, 'plan').picked, ['Pro']);
  assert.deepEqual(query.scope('data'), ['status'], 'its chips stay');
});

test('batch: the doors called inside it are one query-change', () => {
  const { query, told } = make();
  query.hold(VIEW, ['plan', 'status']);
  told.length = 0;
  query.batch(() => {
    query.setReading(VIEW, 'plan', { picked: ['Pro'] });
    query.setReading(VIEW, 'status', { picked: ['trial'] });
  });
  assert.deepEqual(told, [{ fields: ['plan', 'status'], scopes: [] }]);
});
