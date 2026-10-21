/**
 * A QUERY CONTEXT holds the Query of one app Context — 366 step 12. It stands
 * with no source; a source joins the one it is given, and `source.query` IS
 * it; a remote source that joins splits the draft from the applied Query
 * once, and a draft that exists is kept.
 * TRAP T-one-query-one-owner
 *
 *   node --test test/unit/query-context.test.mjs
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { ArrayStore, DataSource, QueryContext, spoofRemote, VIEW } from '../../dist/data.js';

const ROWS = [{ id: 1, plan: 'Pro' }, { id: 2, plan: 'Free' }];
const store = () => new ArrayStore(ROWS, { key: 'id' });
const picked = (q) => q.scopes[VIEW]?.readings.plan?.picked;

test('a context with no source holds an empty Query, and waits for no Apply', () => {
  const query = new QueryContext();
  assert.deepEqual(query.applied, { v: 1, scopes: {} });
  assert.deepEqual(query.draft, { v: 1, scopes: {} });
  assert.equal(query.remote, false);
});

test('a source joins the context it is given, and source.query IS it', () => {
  const query = new QueryContext();
  const source = new DataSource({ store: store(), query });
  assert.equal(source.query, query);
  source.hold(VIEW, ['plan']);
  source.select('plan', ['Pro']);
  assert.deepEqual(picked(query.applied), ['Pro']);
  // A source given none makes its own.
  assert.notEqual(new DataSource({ store: store() }).query, query);
});

test('a remote source splits the draft once; a draft that exists is kept', () => {
  const query = new QueryContext();
  const remote = new DataSource({ store: spoofRemote(store(), { delay: 0 }), query });
  assert.equal(query.remote, true);
  remote.hold(VIEW, ['plan']);
  remote.select('plan', ['Free']);
  // The edit waits for Apply.
  assert.deepEqual(picked(query.draft), ['Free']);
  assert.equal(picked(query.applied), undefined);
  // A second remote source keeps the draft as it is.
  new DataSource({ store: spoofRemote(store(), { delay: 0 }), query });
  assert.deepEqual(picked(query.draft), ['Free']);
  remote.commit();
  assert.deepEqual(picked(query.applied), ['Free']);
});

test('each read of the Query is the context\'s (366 step 13)', () => {
  const query = new QueryContext();
  const source = new DataSource({ store: store(), query });
  const chart = { id: 'chart' };
  source.query.offer('data', ['plan', 'id']);
  source.hold(VIEW, ['plan']);
  source.hold('data', ['id']);
  source.query.declareScope('data', { label: 'Records', arranges: true });
  source.query.declareSets('data', [{ id: 'set', fields: ['id'] }]);
  source.query.declarePart('legend', { field: 'plan', only: chart, label: 'Plan' });
  source.declareDefault('grid', { id: { picked: [1] } });
  source.select('plan', ['Pro']);

  assert.deepEqual(query.scope(VIEW), ['plan']);
  assert.deepEqual([...query.scopes].sort(), ['data', 'grid', VIEW], 'a default holds its field');
  assert.equal(query.holds(VIEW, 'plan'), true);
  assert.equal(query.scopeOf('id'), 'data');
  assert.deepEqual(query.fields('data'), ['plan', 'id']);
  assert.deepEqual(query.fields(VIEW), ['plan', 'id'], 'up is open');
  assert.equal(query.canHold('data', 'other'), false, 'down is closed');
  assert.deepEqual(query.reading(VIEW, 'plan').picked, ['Pro']);
  assert.ok(Object.isFrozen(query.reading(VIEW, 'plan')));
  assert.deepEqual(query.defaultFor('grid'), { id: { picked: [1] } });
  assert.deepEqual(query.partFacts('legend'), { field: 'plan', only: chart, label: 'Plan' });
  assert.deepEqual(query.scopeFacts('data'), { label: 'Records', arranges: true });
  assert.equal(query.scopeLabel('other'), 'other');
  assert.equal(query.arranges(VIEW), false);
  assert.deepEqual(query.sets('data').map((s) => s.id), ['set']);
  assert.equal(query.pending('plan'), false, 'never, with no remote member');
  assert.equal(query.dirty(), false);
});

test('pending and dirty: a remote member\'s edit, until Apply', () => {
  const query = new QueryContext();
  const remote = new DataSource({ store: spoofRemote(store(), { delay: 0 }), query });
  remote.hold(VIEW, ['plan']);
  remote.select('plan', ['Free']);
  assert.equal(query.pending('plan'), true);
  assert.equal(query.dirty(VIEW), true);
  remote.commit();
  assert.equal(query.pending('plan'), false);
  assert.equal(query.dirty(), false);
});

test('a declaration is the context\'s, and every member hears it at once (366 step 14)', () => {
  const query = new QueryContext();
  const one = new DataSource({ store: store(), query });
  const two = new DataSource({ store: store(), query });
  const heard = [];
  one.addEventListener('scope-change', () => heard.push('one'));
  two.addEventListener('scope-change', () => heard.push('two'));
  query.offer('data', ['plan']);
  assert.deepEqual(heard, ['one', 'two'], 'in the order they joined, before offer returns');
  assert.deepEqual(query.fields('data'), ['plan']);
  // The same offer again changes nothing, and no one hears it.
  query.offer('data', ['plan']);
  assert.deepEqual(heard, ['one', 'two']);
  query.declareScope('data', { label: 'Records' });
  assert.equal(query.scopeLabel('data'), 'Records');
});
