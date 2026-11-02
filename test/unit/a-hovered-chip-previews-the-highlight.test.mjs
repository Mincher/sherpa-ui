/**
 * A CHIP HOVERED DRIVES THE HIGHLIGHT — Will, TODOs 449, 589, 655. A hover is the
 * PAGE's: a bar's rest goes to its host, never to the Query, and nothing loads.
 * The data layer only says what it matches when asked (`highlightOf`,
 * `highlightTest`), and keeps nothing. Who it reaches is the provider's.
 *
 *   node --test test/unit/a-hovered-chip-previews-the-highlight.test.mjs
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { ArrayStore, DataSource, QueryContext, VIEW, bindSource, compile, summariseMarked } from '../../dist/data.js';
import { highlightOf } from '../../dist/core/data/query.js';

const ROWS = [{ id: 1, plan: 'Pro', region: 'EMEA' }, { id: 2, plan: 'Free', region: 'EMEA' }, { id: 3, plan: 'Pro', region: 'AMER' }];

/** A component that steers: it keeps what it is pushed. */
const marker = (id) => {
  const attrs = new Map();
  return Object.assign(new EventTarget(), {
    id, attrs, pushes: 0,
    setAttribute(n, v) { attrs.set(n, v); }, removeAttribute(n) { attrs.delete(n); }, hasAttribute: (n) => attrs.has(n),
    populate() { this.pushes++; },
  });
};

test('what a chip hovered matches is what its answer filters by; with no answer, nothing', () => {
  const query = { v: 1, scopes: { [VIEW]: { holds: ['plan'], readings: { plan: { picked: ['Pro'] } } } } };
  assert.deepEqual(highlightOf(query, { scope: VIEW, field: 'plan' }), compile(query).filter);
  assert.equal(highlightOf(query, { scope: VIEW, field: 'region' }), undefined);
  // compile itself knows no hover. TODO 655
  assert.equal('highlight' in compile(query), false);
});

// Will, TODO 496: a chip hovered OFF previews what it holds.
test('a hovered chip that is OFF previews what it holds', () => {
  const query = { v: 1, scopes: { [VIEW]: { holds: ['plan'], readings: { plan: { picked: ['Pro'], suspended: true } } } } };
  assert.equal(compile(query).filter, undefined);
  assert.deepEqual(highlightOf(query, { scope: VIEW, field: 'plan' }), ['plan', 'eq', 'Pro']);
});

// TODOs 459, 513: one value, picked or not; and a scope not made yet.
test('ONE value hovered matches only that value — picked or not, in a scope made or not', () => {
  const query = { v: 1, scopes: { data: { holds: ['region'], readings: { region: { picked: ['EMEA', 'AMER'] } } } } };
  assert.deepEqual(highlightOf(query, { scope: 'data', field: 'region', value: 'AMER' }), ['region', 'eq', 'AMER']);
  assert.deepEqual(highlightOf(query, { scope: 'data', field: 'plan', value: 'Pro' }), ['plan', 'eq', 'Pro']);
  assert.deepEqual(highlightOf(query, { scope: 'a-chart', field: 'plan', value: 'Pro' }), ['plan', 'eq', 'Pro']);
});

// TRAP T-the-highlight-reaches-the-whole-page
test('another source\'s scope drives this one\'s highlight, where it has the field (TODO 458)', () => {
  const query = { v: 1, scopes: {
    [VIEW]: { holds: ['region'], readings: {} },
    data: { holds: ['plan'], readings: { plan: { picked: ['Pro'] } } },
  } };
  // This source owns the View alone: `data` is another's, so it filters nothing here…
  const mine = (id) => id === VIEW;
  assert.equal(compile(query, { mine }).filter, undefined);
  assert.deepEqual(highlightOf(query, { scope: 'data', field: 'plan' }, { mine }), ['plan', 'eq', 'Pro']);
  // …and a source with no `plan` marks nothing.
  assert.equal(highlightOf(query, { scope: 'data', field: 'plan' }, { mine, has: (f) => f !== 'plan' }), undefined);
});

// TRAP T-a-hovered-chip-previews-the-highlight
test('a bar\'s rest goes to its HOST: never the Query, no query-change, no load; the source tests a row when asked', async () => {
  const query = new QueryContext();
  const store = new ArrayStore(ROWS, { key: 'id' });
  const source = new DataSource({ store, query });
  const heard = [];
  const bar = marker('bar');
  bindSource(source, bar, { scope: 'data', hover: (h) => heard.push(h) });
  query.hold('data', ['plan', 'region']);
  query.setReading('data', 'region', { picked: ['EMEA'] });
  await source.load();
  let changes = 0;
  query.addEventListener('query-change', () => changes++);
  let loads = 0;
  const load = store.load.bind(store);
  store.load = (...args) => { loads++; return load(...args); };
  const ask = (request) => bar.dispatchEvent(new CustomEvent('quick-filter-change', { detail: { request } }));

  ask({ field: 'region', preview: true });
  ask({ field: 'plan', preview: true, value: 'Pro' });
  ask({ field: 'region', preview: false });
  assert.deepEqual(heard, [
    { scope: 'data', field: 'region', on: true },
    { scope: 'data', field: 'plan', on: true, value: 'Pro' },
    { scope: 'data', field: 'region', on: false },
  ]);
  assert.equal(JSON.stringify(query.applied).includes('"preview"'), false, 'never in the Query');
  const test = source.highlightTest({ scope: 'data', field: 'region' });
  assert.deepEqual(ROWS.map((r) => test(r)), [true, true, false]);
  assert.equal(source.highlightTest({ scope: 'data', field: 'tier' }), null, 'no answer: nothing to light');
  await new Promise((r) => setTimeout(r, 20));
  assert.deepEqual({ changes, loads }, { changes: 0, loads: 0 });
});

test('a chart\'s segments say the part the driver matches; with none, they say nothing', () => {
  const spec = { shape: 'segments', segment: 'region' };
  const pro = (row) => row.plan === 'Pro';
  assert.deepEqual(summariseMarked(ROWS, spec, () => [], () => undefined, pro).map((d) => [d.label, d.value, d.matched]),
    [['EMEA', 2, 1], ['AMER', 1, 1]]);
  assert.equal(summariseMarked(ROWS, spec).some((d) => 'matched' in d), false);
});

test('a series gives each point the part the driver matches, and a value its own', () => {
  const pro = (row) => row.plan === 'Pro';
  const line = summariseMarked(ROWS, { shape: 'series', over: 'region' }, () => [], () => undefined, pro);
  assert.deepEqual(line.labels, ['AMER', 'EMEA']);
  assert.deepEqual(line.series[0].matched, [1, 1]);
  const value = summariseMarked(ROWS, { shape: 'aggregate', over: 'region' }, () => [], () => undefined, pro);
  assert.equal(value.value, 3);
  assert.equal(value.matched, 2);
  // A plain number has nowhere to say it.
  assert.equal(summariseMarked(ROWS, { shape: 'aggregate' }, () => [], () => undefined, pro), 3);
});
