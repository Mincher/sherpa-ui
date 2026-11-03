/**
 * A REQUEST STORE ACTS AS ITS STORE — plan 652 S2. Every read and write is one
 * request to a data handler, in the page here: what it answers is what the store
 * behind the handler answers, its rows keyed, its own writes announced, and a
 * refused write refused as the store's own error, by field.
 * TRAP T-a-data-request-is-the-store-interface
 *
 *   node --test test/unit/a-request-store-acts-as-its-store.test.mjs
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  ArrayStore, DataSource, HttpError, VIEW, ValidationError, createDataHandler, openRequestStore, required, rowKey, rules,
} from '../../dist/data.js';

const PEOPLE = [
  { id: 1, name: 'Ada', team: 'core', score: 9 },
  { id: 2, name: 'Bo', team: 'ops', score: 4 },
  { id: 3, name: 'Cy', team: 'core', score: 7 },
];

/** A request store over an array store, through a handler in the page. */
async function pair(options = {}) {
  const inner = new ArrayStore(PEOPLE.map((p) => ({ ...p })), { key: 'id', ...options });
  const store = await openRequestStore({ name: 'people', send: createDataHandler({ stores: { people: inner } }) });
  return { inner, store };
}

test('its facts are its store\'s: key, total, projection, announcing', async () => {
  const { inner, store } = await pair();
  assert.equal(store.key, 'id');
  assert.equal(store.reportsTotal, inner.reportsTotal);
  assert.equal(store.projects, inner.projects);
  assert.equal(store.announcesAll, inner.announcesAll);
  assert.equal(store.remote, false);
});

test('a load and a count answer what the store answers, its rows keyed', async () => {
  const { inner, store } = await pair();
  const asked = { filter: ['team', 'eq', 'core'], sort: [{ field: 'score', direction: 'desc' }], take: 1 };
  const got = await store.load(asked);
  const own = await inner.load(asked);
  assert.deepEqual(got, own);
  // Keyed as the store keys its own: a row from JSON is a new object.
  assert.equal(rowKey(got.rows[0]), rowKey(own.rows[0]));
  assert.notEqual(rowKey(got.rows[0]), undefined);
  assert.equal(await store.totalCount({ filter: ['team', 'eq', 'core'] }), 2);
});

test('a row by its key; none is undefined', async () => {
  const { store } = await pair();
  assert.deepEqual(await store.byKey(2), PEOPLE[1]);
  assert.equal(await store.byKey(99), undefined);
});

test('its own writes reach the store, and are announced, as a store\'s are', async () => {
  const { inner, store } = await pair();
  const heard = [];
  store.addEventListener('change', (e) => heard.push(e.detail.type));
  await store.insert({ id: 4, name: 'Di', team: 'ops', score: 5 });
  await store.update(4, { score: 6 });
  await store.remove(1);
  assert.deepEqual(heard, ['insert', 'update', 'remove']);
  assert.deepEqual((await inner.load()).rows.map((r) => r.id), [2, 3, 4]);
  assert.equal((await inner.byKey(4)).score, 6);
  assert.equal(store.history.seq, 3, 'its History holds them');
});

test('a refused write is refused as the store\'s own error, by field', async () => {
  const { store } = await pair({ schema: rules({ name: required() }) });
  await assert.rejects(store.insert({ id: 5, team: 'ops' }), (error) => {
    assert.ok(error instanceof ValidationError);
    assert.deepEqual(error.issues.map((i) => i.path?.[0]), ['name']);
    return true;
  });
  await assert.rejects(store.update(99, { name: 'X' }), (error) => error instanceof HttpError);
});

test('a source over it reads and filters as over its store', async () => {
  const { store } = await pair();
  const source = new DataSource({ store });
  await source.load();
  assert.equal(source.debugState().total, 3);
  source.query.ask({ scope: VIEW, hold: ['team'] });
  source.query.ask({ scope: VIEW, field: 'team', reading: { picked: ['ops'] } });
  await source.load();
  assert.deepEqual(source.rows.map((r) => r.name), ['Bo']);
});
