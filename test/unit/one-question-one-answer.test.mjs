/**
 * ONE QUESTION, ONE ANSWER — TODO 612. The data layer will carry a rules engine,
 * so a wrong answer a reader would rarely see is still wrong.
 *
 *   node --test test/unit/one-question-one-answer.test.mjs
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { ArrayStore, DataSource, QueryContext, bindSource, fakeRemote, fieldState, filterRows, openSource } from '../../dist/data.js';

const ids = (rows, ...clause) => filterRows(rows, clause).map((r) => r.id);
const settle = () => new Promise((r) => setTimeout(r, 30));
const ROWS = [
  { id: 1, plan: 'Pro', seats: 5 }, { id: 2, plan: 'Free', seats: 50 }, { id: 3, plan: 'Pro', seats: 500 },
];

test('a number against a text value compares as numbers', () => {
  const rows = [{ id: 1, a: 1.25 }, { id: 2, a: 1.5 }, { id: 3, a: 2 }, { id: 4, a: 10 }];
  assert.deepEqual(ids(rows, 'a', 'gt', '1.5'), [3, 4]);
  assert.deepEqual(ids(rows, 'a', 'lt', '10'), [1, 2, 3]);
  assert.deepEqual(ids(rows, 'a', 'between', ['1.5', '2']), [2, 3]);
  assert.deepEqual(ids([{ id: 1, a: -5 }, { id: 2, a: -3 }, { id: 3, a: -1 }], 'a', 'gt', '-3'), [3]);
  // Text that is no number stays a text compare, and throws nothing.
  assert.deepEqual(ids(rows, 'a', 'gt', 'abc'), []);
  assert.deepEqual(ids(rows, 'a', 'gt', ''), [1, 2, 3, 4]);
});

test('a Date row against ISO text compares as dates', () => {
  const rows = [{ id: 1, at: new Date('2026-06-01T00:00:00Z') }, { id: 2, at: new Date('2027-01-01T00:00:00Z') }];
  assert.deepEqual(ids(rows, 'at', 'between', ['2026-01-01', '2026-12-31']), [1]);
  assert.deepEqual(ids(rows, 'at', 'gt', '2026-12-31'), [2]);
  assert.deepEqual(ids(rows, 'at', 'lt', 'soon'), [1, 2]);
});

test('"in the last 0" answers nothing, so a chip is off, as its rows say', () => {
  const state = (text) => fieldState({ field: 'at', type: 'date' }, { conditions: [{ op: 'last', text, unit: 'day' }], mode: 'advanced' }).fieldState;
  assert.equal(state('0'), 'off');
  assert.equal(state('-1'), 'off');
  assert.equal(state(''), 'off');
  assert.equal(state('7'), 'active');
});

test('a Query taken in while a scope waits rehomes the applied answer too: chip and rows agree', async () => {
  const source = new DataSource({ store: new ArrayStore(ROWS, { key: 'id' }) });
  source.declareValues('plan', ['Free', 'Pro']);
  source.query.offer('data', ['plan']);
  source.query.wait('data');
  await source.query.setQuery({ v: 1, scopes: { view: { holds: ['plan'], readings: {} }, data: { holds: [], readings: { plan: { picked: ['Pro'] } } } } });
  await source.load();
  await settle();
  assert.deepEqual(Object.keys(source.query.applied.scopes.view.readings), ['plan']);
  assert.deepEqual(Object.keys(source.query.draft.scopes.view.readings), ['plan']);
  assert.equal(source.query.dirty(), false);
  assert.deepEqual(source.rows.map((r) => r.id), [1, 3]);
});

test('a search while the Switch is off keeps the sort it kept', async () => {
  const source = new DataSource({ store: new ArrayStore(ROWS, { key: 'id' }) });
  source.declareValues('plan', ['Free', 'Pro']);
  source.query.offer('data', ['plan']);
  source.query.hold('data', ['plan']);
  source.query.setReading('data', 'plan', { picked: ['Pro'] });
  source.query.commit({ scope: 'data' });
  source.query.setSort('seats', 'desc', 'data');
  source.query.suspend('data', null, true);
  assert.ok(source.query.applied.scopes.data.suspended, 'the Switch is off');
  source.query.setSearch('o', 'data');
  source.query.suspend('data', null, false);
  assert.deepEqual(source.query.applied.scopes.data.sort, [{ field: 'seats', direction: 'desc' }]);
});

test('a question exported and taken back keeps each source\'s own sort', async () => {
  const context = new QueryContext();
  const a = new DataSource({ store: new ArrayStore(ROWS, { key: 'id' }), query: context });
  const b = new DataSource({ store: new ArrayStore(ROWS, { key: 'id' }), query: context });
  a.query.offer('a', ['plan', 'seats']);
  b.query.offer('b', ['plan', 'seats']);
  a.query.setSort('seats', 'desc', 'a');
  b.query.setSort('plan', 'asc', 'b');
  const before = JSON.stringify([context.applied.scopes.a?.sort, context.applied.scopes.b?.sort]);
  await context.import(context.export());
  assert.equal(JSON.stringify([context.applied.scopes.a?.sort, context.applied.scopes.b?.sort]), before);
  assert.notEqual(context.applied.scopes.b?.sort, undefined);
});

test('a Refresh asks a server field again: its old keys are of the set let go', async () => {
  const inner = new ArrayStore(ROWS.map((r) => ({ ...r })), { key: 'id' });
  const store = fakeRemote(inner, { delay: 0 });
  const asked = [];
  const load = store.load.bind(store);
  store.load = (options) => { if (options?.filter) asked.push(options.filter); return load(options); };
  const source = await openSource({
    store: 'rows',
    fields: { seats: { label: 'Seats', type: 'number', fetch: 'server' } },
    scopes: { data: { label: 'Rows', holds: ['seats'] } },
  }, store);
  bindSource(source, { populate() {}, setAttribute() {}, removeAttribute() {}, addEventListener() {}, removeEventListener() {} }, { scope: 'data' });
  source.query.setReading('data', 'seats', { conditions: [{ op: 'gt', text: '40' }], mode: 'advanced' });
  source.query.commit({ scope: 'data' });
  await source.load();
  await settle();
  assert.deepEqual(source.rows.map((r) => r.id).sort(), [2, 3]);
  assert.ok(asked.length > 0, 'the store is asked for the keys');
  // Another client's write: row 1 now matches.
  await inner.update(1, { seats: 900 });
  await source.load({ force: true });
  await settle();
  assert.deepEqual(source.rows.map((r) => r.id).sort(), [1, 2, 3]);
});
