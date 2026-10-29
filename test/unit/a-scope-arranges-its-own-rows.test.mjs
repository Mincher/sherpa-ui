/**
 * ONLY SOME SCOPES ARRANGE — Will, TODO 99 step 4 (B): *"Only certain component
 * scopes, and possibly view scope, will have group and sort."* A scope a page
 * of rows is drawn in arranges; another only if it says so (TODO 341: no
 * component kind decides it). The source still loads
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
  for (const scope of ['view', 'data', 'chart']) source.query.offer(scope, ['plan', 'name']);
  const grid = control();
  bindSource(source, grid, { scope: 'data' });
  // A summary is given every row, not a page.
  bindSource(source, control(), { scope: 'chart', rows: 'all', readonly: true });
  return { source, grid };
}

test('a grid\'s scope arranges; a chart\'s and the View do not, unless they say so', () => {
  const { source } = page();
  assert.equal(source.query.arranges('data'), true);
  assert.equal(source.query.arranges('chart'), false);
  assert.equal(source.query.arranges('view'), false);
  assert.equal(source.describe('chart').sort, undefined);
  source.query.declareScope('view', { arranges: true });
  assert.equal(source.query.arranges('view'), true);
  assert.deepEqual(source.describe('view').sort.map((c) => c.field), ['plan', 'name']);
});

test('a sort shows in the scope that set it, and a View keeps it there', async () => {
  const { source, grid } = page();
  source.query.declareScope('view', { arranges: true });
  grid.dispatchEvent(new CustomEvent('sort-change', { detail: { field: 'name', direction: 'desc' } }));
  await source.load();
  assert.equal(source.describe('data').sortField, 'name');
  assert.equal(source.describe('view').sortField, undefined);
  const out = source.query.export().query.scopes;
  assert.deepEqual(out.data.sort, [{ field: 'name', direction: 'desc' }]);
  assert.equal(out.view?.sort, undefined);
  // Read back, it is that scope's again.
  const again = page().source;
  again.query.declareScope('view', { arranges: true });
  await again.query.import(source.query.export());
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
  assert.deepEqual(saved.data.sort, source.query.export().query.scopes.data.sort);
});

test('only a LIST field is offered to Group; any field to Sort (Will, TODO 523 S5)', async () => {
  const source = new DataSource({ store: new ArrayStore([{ id: 1, plan: 'Pro', seats: 3, at: '2026-01-02', name: 'Ada' }], { key: 'id' }) });
  source.declareField('plan', { label: 'Plan' });
  source.declareField('seats', { label: 'Seats', type: 'number' });
  source.declareField('at', { label: 'At', type: 'date' });
  source.declareField('name', { label: 'Name', advanced: 'only' });
  source.query.offer('data', ['plan', 'seats', 'at', 'name']);
  bindSource(source, control(), { scope: 'data' });
  await source.load();
  const d = source.describe('data');
  assert.deepEqual(d.group.map((c) => c.field), ['plan']);
  assert.deepEqual(d.sort.map((c) => c.field), ['plan', 'seats', 'at', 'name']);
});

test('only the scope that arranges is TOLD its sort: a bar over another scope is not (TODO 523 S6)', async () => {
  const { source, grid } = page();
  source.query.declareScope('view', { arranges: true });
  // The binder writes what it is told as attributes: record them.
  const told = () => {
    const attrs = new Map();
    return Object.assign(control(), { attrs, setAttribute: (n, v) => attrs.set(n, v), removeAttribute: (n) => attrs.delete(n) });
  };
  const viewBar = told(), dataBar = told();
  bindSource(source, viewBar, { scope: 'view', steerOnly: true });
  bindSource(source, dataBar, { scope: 'data', steerOnly: true });
  grid.dispatchEvent(new CustomEvent('sort-change', { detail: { field: 'name', direction: 'desc' } }));
  await source.load();
  assert.equal(dataBar.attrs.get('data-sort-field'), 'name');
  assert.equal(dataBar.attrs.get('data-sort-direction'), 'desc');
  assert.equal(viewBar.attrs.get('data-sort-field'), undefined);
  // Grouped from the View: now the View's alone.
  source.query.setGroup('plan', 'view');
  await source.load();
  assert.equal(viewBar.attrs.get('data-group-field'), 'plan');
  assert.equal(dataBar.attrs.get('data-group-field'), undefined);
});
