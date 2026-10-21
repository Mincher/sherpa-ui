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
