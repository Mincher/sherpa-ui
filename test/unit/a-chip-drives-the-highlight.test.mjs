/**
 * ONE CHIP DRIVES THE HIGHLIGHT — Will, TODO 441. Its answer filters AND
 * marks: the Query keeps the driver, `compile()` gives what it matches, and
 * the source pushes a component the rows again with the test, though no row
 * moved.
 *
 *   node --test test/unit/a-chip-drives-the-highlight.test.mjs
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { ArrayStore, DataSource, QueryContext, VIEW, bindSource, compile } from '../../dist/data.js';

const ROWS = [{ id: 1, plan: 'Pro', region: 'EMEA' }, { id: 2, plan: 'Free', region: 'EMEA' }, { id: 3, plan: 'Pro', region: 'AMER' }];

/** A component that marks rows: it keeps what it is pushed. */
const marker = (id) => {
  const attrs = new Map();
  return Object.assign(new EventTarget(), {
    id, attrs, pushes: 0, test: null,
    setAttribute(n, v) { attrs.set(n, v); }, removeAttribute(n) { attrs.delete(n); }, hasAttribute: (n) => attrs.has(n),
    populate() { this.pushes++; },
    drawHighlight(test) { this.test = test; },
  });
};

test('compile gives what the driver matches, and still filters by it', () => {
  const query = { v: 1, scopes: { [VIEW]: { holds: ['plan'], readings: { plan: { picked: ['Pro'] } }, highlight: 'plan' } } };
  const out = compile(query);
  assert.deepEqual(out.highlight, out.filter);
  assert.equal(compile({ v: 1, scopes: { [VIEW]: { holds: ['plan'], readings: { plan: { picked: ['Pro'] } } } } }).highlight, undefined);
  // A suspended answer applies nothing, and marks nothing.
  query.scopes[VIEW].readings.plan.suspended = true;
  assert.equal(compile(query).highlight, undefined);
});

test('the Query holds ONE driver: a second takes over, and only the driver lets go', () => {
  const query = new QueryContext();
  query.hold(VIEW, ['plan', 'region']);
  query.highlight(VIEW, 'plan', true);
  assert.deepEqual(query.highlighted, { scope: VIEW, field: 'plan' });
  query.highlight(VIEW, 'region', true);
  assert.deepEqual(query.highlighted, { scope: VIEW, field: 'region' });
  assert.equal(query.applied.scopes[VIEW].highlight, 'region');
  query.highlight(VIEW, 'plan', false);
  assert.deepEqual(query.highlighted, { scope: VIEW, field: 'region' });
  query.highlight(VIEW, 'region', false);
  assert.equal(query.highlighted, null);
});

test('a chip asks for it by request; the source tests a row, and pushes the mark though no row moved', async () => {
  const query = new QueryContext();
  const source = new DataSource({ store: new ArrayStore(ROWS, { key: 'id' }), query });
  const bar = marker('bar');
  const grid = marker('grid');
  bindSource(source, bar, { scope: 'data' });
  bindSource(source, grid, { scope: VIEW, shows: 'grid' });
  await source.load();
  query.hold('data', ['plan']);
  query.setReading('data', 'plan', { picked: ['Pro'] });
  await source.load();
  assert.equal(source.highlight, null);
  const before = grid.pushes;
  bar.dispatchEvent(new CustomEvent('quick-filter-change', { detail: { request: { field: 'plan', highlight: true } } }));
  assert.deepEqual(query.highlighted, { scope: 'data', field: 'plan' });
  assert.equal(source.highlight(ROWS[0]), true);
  assert.equal(source.highlight(ROWS[1]), false);
  assert.ok(grid.pushes > before, 'pushed again');
  assert.equal(grid.test(ROWS[2]), true);
  // The bar over the driver's scope is told which chip drives; the grid is not.
  assert.equal(bar.attrs.get('data-highlight-field'), 'plan');
  assert.equal(grid.attrs.has('data-highlight-field'), false);
  bar.dispatchEvent(new CustomEvent('quick-filter-change', { detail: { request: { field: 'plan', highlight: false } } }));
  assert.equal(source.highlight, null);
  assert.equal(grid.test, null);
  assert.equal(bar.attrs.has('data-highlight-field'), false);
});
