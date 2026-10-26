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

import { ArrayStore, DataSource, QueryContext, VIEW, bindSource, compile, summariseMarked } from '../../dist/data.js';

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

// TRAP T-a-hovered-chip-previews-the-highlight
test('a chip HOVERED previews the highlight: never in the Query, no query-change, no load; the driver comes back (TODO 449)', async () => {
  const query = new QueryContext();
  const store = new ArrayStore(ROWS, { key: 'id' });
  const source = new DataSource({ store, query });
  const bar = marker('bar');
  const grid = marker('grid');
  bindSource(source, bar, { scope: 'data' });
  bindSource(source, grid, { scope: VIEW, shows: 'grid' });
  query.hold('data', ['plan', 'region']);
  query.setReading('data', 'plan', { picked: ['Pro'] });
  query.setReading('data', 'region', { picked: ['EMEA'] });
  await source.load();
  query.highlight('data', 'plan', true);
  await source.load();
  let changes = 0;
  query.addEventListener('query-change', () => changes++);
  let loads = 0;
  const load = store.load.bind(store);
  store.load = (...args) => { loads++; return load(...args); };
  const ask = (preview) => bar.dispatchEvent(new CustomEvent('quick-filter-change', { detail: { request: { field: 'region', preview } } }));

  ask(true);
  assert.deepEqual(query.previewed, { scope: 'data', field: 'region' });
  assert.deepEqual(query.highlighted, { scope: 'data', field: 'plan' }, 'the driver stays');
  assert.equal(query.applied.scopes.data.highlight, 'plan', 'never in the Query');
  assert.equal(grid.test(ROWS[1]), true, 'EMEA, Free');
  assert.equal(grid.test(ROWS[2]), false, 'AMER');
  ask(false);
  assert.equal(query.previewed, null);
  assert.equal(grid.test(ROWS[1]), false, 'the driver again: Free');
  assert.equal(grid.test(ROWS[2]), true, 'Pro');
  await new Promise((r) => setTimeout(r, 20));
  assert.deepEqual({ changes, loads }, { changes: 0, loads: 0 });
});

// TRAP T-a-hovered-chip-previews-the-highlight
test('ONE value hovered previews only that value — picked or not (TODO 459)', async () => {
  const query = new QueryContext();
  const source = new DataSource({ store: new ArrayStore(ROWS, { key: 'id' }), query });
  const bar = marker('bar');
  const grid = marker('grid');
  bindSource(source, bar, { scope: 'data' });
  bindSource(source, grid, { scope: VIEW, shows: 'grid' });
  query.hold('data', ['plan', 'region']);
  query.setReading('data', 'region', { picked: ['EMEA', 'AMER'] });
  await source.load();
  const ask = (request) => bar.dispatchEvent(new CustomEvent('quick-filter-change', { detail: { request } }));
  ask({ field: 'region', preview: true, value: 'AMER' });
  assert.deepEqual(query.previewed, { scope: 'data', field: 'region', value: 'AMER' });
  assert.deepEqual(ROWS.map((r) => grid.test(r)), [false, false, true], 'AMER alone, not every pick');
  // A value of a field with no answer: Pro.
  ask({ field: 'plan', preview: true, value: 'Pro' });
  assert.deepEqual(ROWS.map((r) => grid.test(r)), [true, false, true]);
  // The whole field again: its answer.
  ask({ field: 'region', preview: true });
  assert.deepEqual(ROWS.map((r) => grid.test(r)), [true, true, true]);
  ask({ field: 'region', preview: false });
  assert.equal(grid.test, null);
});

test('a chart\'s segments say the part the driver matches; with none, they say nothing', () => {
  const spec = { shape: 'segments', segment: 'region' };
  const pro = (row) => row.plan === 'Pro';
  assert.deepEqual(summariseMarked(ROWS, spec, () => [], () => ({}), pro).map((d) => [d.label, d.value, d.matched]),
    [['EMEA', 2, 1], ['AMER', 1, 1]]);
  assert.equal(summariseMarked(ROWS, spec).some((d) => 'matched' in d), false);
});

test('a series gives each point the part the driver matches, and a value its own', () => {
  const pro = (row) => row.plan === 'Pro';
  const line = summariseMarked(ROWS, { shape: 'series', over: 'region' }, () => [], () => ({}), pro);
  assert.deepEqual(line.labels, ['AMER', 'EMEA']);
  assert.deepEqual(line.series[0].matched, [1, 1]);
  const value = summariseMarked(ROWS, { shape: 'aggregate', over: 'region' }, () => [], () => ({}), pro);
  assert.equal(value.value, 3);
  assert.equal(value.matched, 2);
  // A plain number has nowhere to say it.
  assert.equal(summariseMarked(ROWS, { shape: 'aggregate' }, () => [], () => ({}), pro), 3);
});
