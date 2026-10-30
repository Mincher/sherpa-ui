/**
 * A CHIP HOVERED DRIVES THE HIGHLIGHT — Will, TODOs 449, 589. Never in the Query:
 * `compile()` gives what it matches, and the source pushes a component the rows
 * again with the test, though no row moved.
 *
 *   node --test test/unit/a-hovered-chip-previews-the-highlight.test.mjs
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

test('compile gives what the chip hovered matches, and still filters by it; hovered nothing, it marks nothing', () => {
  const query = { v: 1, scopes: { [VIEW]: { holds: ['plan'], readings: { plan: { picked: ['Pro'] } } } } };
  const out = compile(query, { highlight: { scope: VIEW, field: 'plan' } });
  assert.deepEqual(out.highlight, out.filter);
  assert.equal(compile(query).highlight, undefined);
});

// Will, TODO 496: a chip hovered OFF previews what it holds.
test('a hovered chip that is OFF previews what it holds', () => {
  const query = { v: 1, scopes: { [VIEW]: { holds: ['plan'], readings: { plan: { picked: ['Pro'], suspended: true } } } } };
  assert.equal(compile(query).filter, undefined);
  const out = compile(query, { highlight: { scope: VIEW, field: 'plan' } });
  assert.deepEqual(out.highlight, ['plan', 'eq', 'Pro']);
});

test('a chip asks for it by request; the source tests a row, and pushes the mark though no row moved', async () => {
  const query = new QueryContext();
  const source = new DataSource({ store: new ArrayStore(ROWS, { key: 'id' }), query });
  const bar = marker('bar');
  const grid = marker('grid');
  // Across every scope, as 458 had it: off by default since 520.
  source.highlightAcross = true;
  bindSource(source, bar, { scope: 'data' });
  bindSource(source, grid, { scope: VIEW });
  await source.load();
  query.hold('data', ['plan']);
  query.setReading('data', 'plan', { picked: ['Pro'] });
  await source.load();
  assert.equal(source.highlight, null);
  const before = grid.pushes;
  bar.dispatchEvent(new CustomEvent('quick-filter-change', { detail: { request: { field: 'plan', preview: true } } }));
  assert.deepEqual(query.previewed, { scope: 'data', field: 'plan' });
  assert.equal(source.highlight(ROWS[0]), true);
  assert.equal(source.highlight(ROWS[1]), false);
  assert.ok(grid.pushes > before, 'pushed again');
  assert.equal(grid.test(ROWS[2]), true);
  bar.dispatchEvent(new CustomEvent('quick-filter-change', { detail: { request: { field: 'plan', preview: false } } }));
  assert.equal(source.highlight, null);
  assert.equal(grid.test, null);
});

// TRAP T-a-hovered-chip-previews-the-highlight
test('a chip HOVERED previews the highlight: never in the Query, no query-change, no load; left, it lets go (TODO 449)', async () => {
  const query = new QueryContext();
  const store = new ArrayStore(ROWS, { key: 'id' });
  const source = new DataSource({ store, query });
  const bar = marker('bar');
  const grid = marker('grid');
  // Across every scope, as 458 had it: off by default since 520.
  source.highlightAcross = true;
  bindSource(source, bar, { scope: 'data' });
  bindSource(source, grid, { scope: VIEW });
  query.hold('data', ['plan', 'region']);
  query.setReading('data', 'plan', { picked: ['Pro'] });
  query.setReading('data', 'region', { picked: ['EMEA'] });
  await source.load();
  let changes = 0;
  query.addEventListener('query-change', () => changes++);
  let loads = 0;
  const load = store.load.bind(store);
  store.load = (...args) => { loads++; return load(...args); };
  const ask = (preview) => bar.dispatchEvent(new CustomEvent('quick-filter-change', { detail: { request: { field: 'region', preview } } }));

  ask(true);
  assert.deepEqual(query.previewed, { scope: 'data', field: 'region' });
  assert.equal(JSON.stringify(query.applied).includes('"highlight"'), false, 'never in the Query');
  assert.equal(grid.test(ROWS[1]), true, 'EMEA, Free');
  assert.equal(grid.test(ROWS[2]), false, 'AMER');
  ask(false);
  assert.equal(query.previewed, null);
  assert.equal(grid.test, null, 'left: nothing is lit');
  await new Promise((r) => setTimeout(r, 20));
  assert.deepEqual({ changes, loads }, { changes: 0, loads: 0 });
});

// TRAP T-a-hovered-chip-previews-the-highlight
test('ONE value hovered previews only that value — picked or not (TODO 459)', async () => {
  const query = new QueryContext();
  const source = new DataSource({ store: new ArrayStore(ROWS, { key: 'id' }), query });
  const bar = marker('bar');
  const grid = marker('grid');
  // Across every scope, as 458 had it: off by default since 520.
  source.highlightAcross = true;
  bindSource(source, bar, { scope: 'data' });
  bindSource(source, grid, { scope: VIEW });
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

// TRAP T-the-highlight-reaches-the-whole-page
test('across every scope, or only the driver\'s: off, a local driver lights its own scope alone; a View driver lights all (TODO 467)', async () => {
  const query = new QueryContext();
  const source = new DataSource({ store: new ArrayStore(ROWS, { key: 'id' }), query });
  const bar = marker('bar');
  const grid = marker('grid');
  const own = marker('own');
  bindSource(source, bar, { scope: 'data' });
  bindSource(source, grid, { scope: VIEW });
  bindSource(source, own, { scope: 'data' });
  query.hold(VIEW, ['region']);
  query.hold('data', ['plan']);
  query.setReading('data', 'plan', { picked: ['Pro'] });
  query.setReading(VIEW, 'region', { picked: ['EMEA', 'AMER'] });
  await source.load();
  query.preview('data', 'plan', true);
  await source.load();
  // Off by default: a filter's matches stay in its own scope. Will, TODO 520
  assert.equal(source.highlightAcross, false, 'off by default');
  assert.equal(grid.test, null, 'off: not the driver\'s scope');
  source.highlightAcross = true;
  assert.equal(grid.test(ROWS[0]), true, 'across: the View\'s grid is lit');
  source.highlightAcross = false;
  assert.equal(grid.test, null, 'off: not the driver\'s scope');
  assert.equal(own.test(ROWS[0]), true, 'its own scope still is');
  assert.equal(source.highlightFor(VIEW), null);
  assert.equal(source.highlightFor(['data', VIEW])(ROWS[2]), true);
  // A View driver is every scope's.
  query.preview(VIEW, 'region', true);
  await source.load();
  assert.equal(grid.test(ROWS[0]), true);
  assert.equal(own.test(ROWS[0]), true);
  query.preview('data', 'plan', true);
  await source.load();
  source.highlightAcross = true;
  assert.equal(grid.test(ROWS[2]), true, 'on again: pushed again');
});

// TRAP T-the-highlight-reaches-the-whole-page
test('another source\'s scope drives this one\'s highlight, where it has the field (TODO 458)', () => {
  const query = { v: 1, scopes: {
    [VIEW]: { holds: ['region'], readings: {} },
    data: { holds: ['plan'], readings: { plan: { picked: ['Pro'] } } },
  } };
  // This source owns the View alone: `data` is another's, so it filters nothing here…
  const mine = (id) => id === VIEW;
  const hovered = { scope: 'data', field: 'plan' };
  const out = compile(query, { mine, highlight: hovered });
  assert.equal(out.filter, undefined);
  assert.deepEqual(out.highlight, ['plan', 'eq', 'Pro']);
  // …and a source with no `plan` marks nothing.
  assert.equal(compile(query, { mine, highlight: hovered, has: (f) => f !== 'plan' }).highlight, undefined);
});
