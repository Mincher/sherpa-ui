/**
 * ONLY SOME SCOPES ARRANGE — Will, TODO 99 step 4 (B): *"Only certain component
 * scopes, and possibly view scope, will have group and sort."* A scope over a
 * grid or a list arranges; another only if it says so. The source still loads
 * once, and remembers WHICH scope arranged the rows.
 *
 *   node --test test/unit/a-scope-arranges-its-own-rows.test.mjs
 *
 * TRAP T-group-and-sort-are-component-scope
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { ArrayStore, DataSource, bindSource } from '../../dist/data.js';
import { saveViewAs } from '../../dist/core/browser/persist-view.js';

const ROWS = [{ id: 1, plan: 'Pro', name: 'b' }, { id: 2, plan: 'Free', name: 'a' }];

/** A control the binder can steer: events in, nothing drawn. */
const control = () => Object.assign(new EventTarget(), {
  setAttribute() {}, removeAttribute() {}, hasAttribute: () => false, populate() {}, drawScope() {},
});

function page() {
  const source = new DataSource({ store: new ArrayStore(ROWS, { key: 'id' }) });
  source.declareField('plan', { label: 'Plan' });
  source.declareField('name', { label: 'Name' });
  for (const scope of ['view', 'data', 'chart']) source.offer(scope, ['plan', 'name']);
  const grid = control();
  bindSource(source, grid, { scope: 'data', shows: 'grid' });
  bindSource(source, control(), { scope: 'chart', shows: 'chart', readonly: true });
  return { source, grid };
}

test('a grid\'s scope arranges; a chart\'s and the View do not, unless they say so', () => {
  const { source } = page();
  assert.equal(source.query.arranges('data'), true);
  assert.equal(source.query.arranges('chart'), false);
  assert.equal(source.query.arranges('view'), false);
  assert.equal(source.describe('chart').sort, undefined);
  source.declareScope('view', { arranges: true });
  assert.equal(source.query.arranges('view'), true);
  assert.deepEqual(source.describe('view').sort.map((c) => c.field), ['plan', 'name']);
});

test('a sort shows in the scope that set it, and a View keeps it there', async () => {
  const { source, grid } = page();
  source.declareScope('view', { arranges: true });
  grid.dispatchEvent(new CustomEvent('sort-change', { detail: { field: 'name', direction: 'desc' } }));
  await source.load();
  assert.equal(source.describe('data').sortField, 'name');
  assert.equal(source.describe('view').sortField, undefined);
  const out = source.export().query.scopes;
  assert.deepEqual(out.data.sort, [{ field: 'name', direction: 'desc' }]);
  assert.equal(out.view?.sort, undefined);
  // Read back, it is that scope's again.
  const again = page().source;
  again.declareScope('view', { arranges: true });
  await again.import(source.export());
  assert.equal(again.describe('data').sortField, 'name');
  assert.equal(again.describe('view').sortField, undefined);
});

test('a SAVED View puts the sort where export() does: in the scope that set it', async () => {
  const { source, grid } = page();
  grid.dispatchEvent(new CustomEvent('sort-change', { detail: { field: 'name', direction: 'desc' } }));
  await source.load();
  // No storage in node: the set comes back all the same.
  const saved = saveViewAs('arranged', 'By name', { source }, {})['by-name'].query.scopes;
  assert.deepEqual(saved.data.sort, [{ field: 'name', direction: 'desc' }]);
  assert.equal(saved.view?.sort, undefined);
  assert.deepEqual(saved.data.sort, source.export().query.scopes.data.sort);
});
