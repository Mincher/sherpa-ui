/**
 * A STATUS IS WORKED OUT BY THE DATA — Will, plan 683. A status field's value is
 * named by conditions on a row's other fields, the first that matches; the data
 * works it out for every row, a filter on it becomes conditions on the fields it
 * reads, and no write may name it.
 * TRAP T-a-status-is-worked-out-by-the-data
 *
 *   node --test test/unit/a-status-is-worked-out-by-the-data.test.mjs
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  ArrayStore, DataSource, HeldStore, createDataHandler, fakeRemote, openRequestStore, statusFields,
} from '../../dist/data.js';
import { filterFields } from '../../dist/core/data/store.js';

const HEALTH = {
  type: 'status', label: 'Health',
  values: [
    { value: 'At risk', status: 'critical', when: [{ score: { lt: 60 } }, { openTickets: { gte: 5 } }] },
    { value: 'Watch', status: 'warning', when: [{ score: { lt: 80 } }, { openTickets: { gt: 0 } }] },
    { value: 'Healthy', status: 'success' },
  ],
};
const ROWS = [
  { id: 1, score: 50, openTickets: 0 }, // At risk: score
  { id: 2, score: 90, openTickets: 6 }, // At risk: tickets
  { id: 3, score: 70, openTickets: 0 }, // Watch: score
  { id: 4, score: 90, openTickets: 2 }, // Watch: tickets
  { id: 5, score: 95, openTickets: 0 }, // Healthy
  { id: 6, score: 100, openTickets: 0 }, // Healthy
];

/** The store, and every filter that reached the one under it. */
function stores() {
  const inner = new ArrayStore(ROWS.map((r) => ({ ...r })), { key: 'id' });
  const reached = [];
  const load = inner.load.bind(inner);
  inner.load = (o = {}) => { if (o.filter) reached.push(o.filter); return load(o); };
  return { inner, reached, store: statusFields(inner, { health: HEALTH }) };
}
const health = async (store, options) => (await store.load(options)).rows.map((r) => [r.id, r.health]);

test('every row carries its value: the first value whose conditions match', async () => {
  const { store } = stores();
  assert.deepEqual(await health(store), [[1, 'At risk'], [2, 'At risk'], [3, 'Watch'], [4, 'Watch'], [5, 'Healthy'], [6, 'Healthy']]);
});

test('a filter on it is conditions on the fields it reads: the store under it never hears of it', async () => {
  const { store, reached } = stores();
  assert.deepEqual((await health(store, { filter: ['health', 'eq', 'Watch'] })).map(([id]) => id), [3, 4]);
  assert.deepEqual((await health(store, { filter: ['health', 'in', ['At risk', 'Healthy']] })).map(([id]) => id), [1, 2, 5, 6]);
  assert.deepEqual((await health(store, { filter: ['and', ['health', 'ne', 'At risk'], ['score', 'gt', 80]] })).map(([id]) => id), [4, 5, 6]);
  assert.equal(await store.totalCount({ filter: ['health', 'eq', 'At risk'] }), 2);
  for (const filter of reached) assert.ok(!filterFields(filter).includes('health'), JSON.stringify(filter));
});

test('it sorts, groups and pages by its value, which the store under it does not hold', async () => {
  const { store } = stores();
  const { rows, total } = await store.load({ sort: [{ field: 'health', direction: 'asc' }, { field: 'id', direction: 'desc' }], skip: 1, take: 3 });
  assert.equal(total, 6);
  // A to Z, as any list field sorts: At risk [2, 1], Healthy [6, 5], Watch [4, 3] — then a page.
  assert.deepEqual(rows.map((r) => r.id), [1, 6, 5]);
});

test('its values, in its own order, as the rows hold them; and as a domain with each look', async () => {
  const { store } = stores();
  assert.deepEqual((await store.distinct(['health'])).health, ['At risk', 'Watch', 'Healthy']);
  assert.deepEqual((await store.distinct(['health'], { filter: ['score', 'gte', 90] })).health, ['At risk', 'Watch', 'Healthy']);
  assert.deepEqual((await store.distinct(['health'], { filter: ['openTickets', 'eq', 0] })).health, ['At risk', 'Watch', 'Healthy']);
  assert.deepEqual(store.domains.health, { values: ['At risk', 'Watch', 'Healthy'], statuses: { 'At risk': 'critical', Watch: 'warning', Healthy: 'success' } });
});

test('no write names it; a write to a field it reads moves it, and says so', async () => {
  const { store } = stores();
  await assert.rejects(store.update(5, { health: 'At risk' }), /never written/);
  const said = [];
  store.addEventListener('change', (e) => said.push(e.detail));
  const saved = await store.update(5, { score: 40 });
  assert.equal(saved.health, 'At risk');
  assert.ok(said.at(-1).fields.includes('health'));
  assert.equal(said.at(-1).row.health, 'At risk');
});

test('a date condition reads today: last 30 days', async () => {
  const day = (ago) => new Date(Date.now() - ago * 86400000).toISOString().slice(0, 10);
  const inner = new ArrayStore([{ id: 1, seen: day(3) }, { id: 2, seen: day(90) }], { key: 'id' });
  const store = statusFields(inner, { activity: { type: 'status', values: [{ value: 'Active', when: [{ seen: { last: 30, unit: 'day' } }] }, { value: 'Quiet' }] } });
  assert.deepEqual(await health({ load: (o) => store.load(o).then((r) => ({ rows: r.rows.map((x) => ({ id: x.id, health: x.activity })) })) }), [[1, 'Active'], [2, 'Quiet']]);
});

test('a condition with no opposite, before another value, is refused at once', () => {
  const inner = new ArrayStore([], { key: 'id' });
  assert.throws(() => statusFields(inner, { tag: { type: 'status', values: [{ value: 'A', when: [{ name: { startswith: 'A' } }] }, { value: 'Other' }] } }), /no opposite/);
});

test('through the worker: a page filters by it, and is told its values and looks', async () => {
  const inner = new ArrayStore(ROWS.map((r) => ({ ...r })), { key: 'id' });
  const held = new HeldStore(fakeRemote(statusFields(inner, { health: HEALTH }), { delay: 0 }));
  const store = await openRequestStore({ name: 'people', send: createDataHandler({ stores: { people: held } }) });
  assert.deepEqual(store.domains.health.statuses, { 'At risk': 'critical', Watch: 'warning', Healthy: 'success' });
  const source = new DataSource({ store });
  await source.load();
  const { rows } = await store.load({ filter: ['health', 'eq', 'At risk'] });
  assert.deepEqual(rows.map((r) => r.id), [1, 2]);
});
