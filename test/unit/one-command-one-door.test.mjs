/**
 * ONE COMMAND, ONE DOOR — plan 695 S2. Every edit to the Query is a `QueryRequest`
 * asked through `QueryContext.ask()`: a control's event, the node editor's edit, an
 * agent's call. The steering events map to commands in one table; the edits that
 * write one copy as plain data are pure.
 * TRAP T-one-command-one-door
 *
 *   node --test test/unit/one-command-one-door.test.mjs
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { ArrayStore, DataSource, QueryContext, VIEW, bindSource } from '../../dist/data.js';
import { editQuery } from '../../dist/core/data/query-edits.js';

const ROWS = [
  { id: 1, plan: 'Pro', region: 'EMEA' },
  { id: 2, plan: 'Free', region: 'APAC' },
  { id: 3, plan: 'Pro', region: 'AMER' },
];

/** A component that steers: it keeps its attributes, and is pushed rows. */
const marker = (id) => {
  const attrs = new Map();
  return Object.assign(new EventTarget(), {
    id, attrs,
    setAttribute(n, v) { attrs.set(n, v); }, removeAttribute(n) { attrs.delete(n); }, hasAttribute: (n) => attrs.has(n),
    populate() {},
  });
};

/** Freeze a value all the way down: an edit that writes it throws. */
const frozen = (v) => {
  if (v && typeof v === 'object') {
    for (const x of Object.values(v)) frozen(x);
    Object.freeze(v);
  }
  return v;
};

test('a pure edit gives the Query after it and leaves the one given untouched', () => {
  const query = frozen({ v: 1, scopes: {
    [VIEW]: { holds: ['plan'], readings: { plan: { picked: ['Pro'] } } },
    data: { holds: ['region', 'plan'], readings: {}, sort: [{ field: 'plan', direction: 'asc' }] },
  } });
  const before = JSON.stringify(query);
  const sorted = editQuery(query, { scope: 'data', sort: 'region', direction: 'desc' });
  assert.deepEqual(sorted.scopes.data.sort, [{ field: 'region', direction: 'desc' }]);
  // Suspended, the column is kept to resume; asked again, it is spent.
  const off = editQuery(sorted, { scope: 'data', sort: null });
  assert.deepEqual([off.scopes.data.sort, off.scopes.data.sortSuspended], [[], { field: 'region', direction: 'desc' }]);
  const forgot = editQuery(off, { scope: 'data', sort: null, clear: true });
  assert.equal(forgot.scopes.data.sortSuspended, undefined);
  // One scope arranges: a Group with none named joins the one that does.
  assert.equal(editQuery(query, { group: 'region' }).scopes.data.group, 'region');
  assert.equal(editQuery(query, { search: 'pro' }).scopes.data.search, 'pro');
  assert.deepEqual(editQuery(query, { scope: 'data', order: ['plan', 'region'] }).scopes.data.holds, ['plan', 'region']);
  assert.deepEqual(editQuery(query, { scope: 'card', presentation: { kind: 'donut' } }).scopes.card.presentation, { kind: 'donut' });
  // Raised to the View, a field leaves every component, and its reading goes with it.
  const raised = editQuery(query, { scope: VIEW, move: 'region', from: 'data' });
  assert.deepEqual([raised.scopes[VIEW].holds, raised.scopes.data.holds], [['plan', 'region'], ['plan']]);
  assert.equal(JSON.stringify(query), before, 'the Query given is untouched');
});

test('in a SLOT, a Sort and a Group are its chart\'s presentation — never the rows\' (bug 5)', () => {
  const query = { v: 1, scopes: { card: { holds: [], readings: {}, sort: [{ field: 'region', direction: 'asc' }] } } };
  const presents = (scope) => scope === 'card';
  const grouped = editQuery(query, { scope: 'card', group: 'plan' }, { presents });
  assert.deepEqual(grouped.scopes.card.presentation, { group: 'plan' });
  assert.equal(grouped.scopes.card.group, undefined);
  const sorted = editQuery(grouped, { scope: 'card', sort: 'anything', direction: 'desc' }, { presents });
  assert.deepEqual(sorted.scopes.card.presentation, { group: 'plan', sort: 'desc' });
  assert.deepEqual(sorted.scopes.card.sort, [{ field: 'region', direction: 'asc' }], 'the rows keep their own');
});

test('ask() reroutes a slot\'s Sort and Group for EVERY caller: a chart bound in a card is its slot', async () => {
  const source = new DataSource({ store: new ArrayStore(ROWS, { key: 'id' }) });
  bindSource(source, marker('chart'), { scope: 'card', rows: 'all', readonly: true });
  await source.load();
  source.query.ask({ scope: 'card', group: 'plan' });
  source.query.ask({ scope: 'card', sort: 'plan', direction: 'desc' });
  assert.deepEqual(source.query.presentation('card'), { group: 'plan', sort: 'desc' });
  assert.deepEqual([source.state.sort, source.state.group], [[], null]);
});

test('the steering events map to commands in one table: each event, the command it asks', async () => {
  const source = new DataSource({ store: new ArrayStore(ROWS, { key: 'id' }) });
  const asked = [];
  const ask = source.query.ask.bind(source.query);
  source.query.ask = (request) => { asked.push(request); ask(request); };
  const bar = marker('bar');
  bindSource(source, bar, { scope: 'data' });
  await source.load();
  const send = (type, detail) => bar.dispatchEvent(new CustomEvent(type, { detail }));
  send('sort-change', { field: 'plan', direction: 'desc' });
  send('sort-change', { clear: true });
  send('group-change', { field: '' });
  send('quick-filter-change', { request: { field: 'plan', reading: { picked: ['Pro'] } } });
  send('filter-add', { scope: VIEW, ids: ['region'], from: 'data' });
  send('filter-remove', { scope: VIEW, id: 'region' });
  send('filter-add', { holds: ['plan', 'region'] });
  send('column-filter-change', { field: 'region', reading: { picked: ['EMEA'] } });
  send('filter-apply', { field: 'plan' });
  send('filter-discard', {});
  send('page-change', { page: 2 });
  send('page-size-change', { pageSize: 10 });
  send('search-change', { value: 'pro' });
  // A report and a read: no edit.
  send('grid-pages-change', { pages: 3 });
  send('select-all-request', {});
  assert.deepEqual(asked, [
    { scope: 'data', sort: 'plan', direction: 'desc' },
    { scope: 'data', sort: null, clear: true },
    { scope: 'data', group: null },
    { field: 'plan', reading: { picked: ['Pro'] }, scope: 'data' },
    { scope: VIEW, take: ['region'], from: 'data' },
    { scope: VIEW, release: 'region' },
    { scope: 'data', hold: ['plan', 'region'] },
    { scope: 'data', field: 'region', reading: { picked: ['EMEA'] }, commit: true },
    { field: 'plan', commit: true },
    { discard: true },
    { scope: 'data', page: 2 },
    { scope: 'data', pageSize: 10 },
    { scope: 'data', search: 'pro' },
  ]);
});

test('a page is the source\'s that draws a page in its scope: another source on the Query keeps its own', async () => {
  const query = new QueryContext();
  const many = Array.from({ length: 30 }, (_, i) => ({ id: i + 1, plan: i % 2 ? 'Pro' : 'Free' }));
  const a = new DataSource({ store: new ArrayStore(many, { key: 'id' }), query, pageSize: 5 });
  const b = new DataSource({ store: new ArrayStore(many, { key: 'id' }), query, pageSize: 5 });
  bindSource(a, marker('a'), { scope: 'a' });
  bindSource(b, marker('b'), { scope: 'b' });
  await Promise.all([a.load(), b.load()]);
  query.ask({ scope: 'a', page: 3 });
  query.ask({ scope: 'b', pageSize: 10 });
  await new Promise((r) => setTimeout(r, 20));
  assert.deepEqual([a.state.page, a.state.pageSize, b.state.page, b.state.pageSize], [3, 5, 1, 10]);
});

test('the Query has ONE door for edits: the old ones are gone', () => {
  const query = new QueryContext();
  const old = ['setReading', 'suspend', 'reset', 'order', 'setPreset', 'present', 'solo', 'unsolo', 'setSort', 'resumeSort',
    'clearSort', 'setGroup', 'setSearch', 'hold', 'take', 'release', 'move', 'letGo', 'batch', 'commit', 'discard'];
  assert.deepEqual(old.filter((name) => name in query), []);
  assert.equal(typeof query.ask, 'function');
  const source = new DataSource({ store: new ArrayStore(ROWS, { key: 'id' }) });
  assert.deepEqual(['setPage', 'setPageSize'].filter((name) => name in source), []);
});
