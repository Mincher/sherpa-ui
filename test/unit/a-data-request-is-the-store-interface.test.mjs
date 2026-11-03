/**
 * THE DATA LAYER OVER HTTP — one `handle()` answers a store's reads and writes,
 * so a page, a Service Worker and a server host the same thing. Plan 652, step S1.
 * TRAP T-a-data-request-is-the-store-interface
 *
 *   node --test test/unit/a-data-request-is-the-store-interface.test.mjs
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  ArrayStore, DATA_QUERY_TYPE, HttpError, IdbStore, createDataHandler, decodeQuery, encodeQuery, keySegment, defineStores,
} from '../../dist/data.js';

const ORIGIN = 'http://app.test';
const rows = () => [
  { id: 1, name: 'Ada', plan: 'Pro', seats: 5 },
  { id: 2, name: 'Bo', plan: 'Free', seats: 1 },
  { id: 3, name: 'Cy', plan: 'Pro', seats: 9 },
];
const setup = (extra = {}) => {
  const people = new ArrayStore(rows(), { key: 'id' });
  const handle = createDataHandler({ stores: defineStores(() => ({ people, ...extra })) });
  const ask = (method, path, body, headers = {}) => handle(new Request(`${ORIGIN}/sherpa/data/${path}`, {
    method,
    ...(body === undefined ? {} : { body: typeof body === 'string' ? body : JSON.stringify(body) }),
    headers: { ...(method === 'QUERY' ? { 'Content-Type': DATA_QUERY_TYPE } : {}), ...headers },
  }));
  return { people, handle, ask };
};
const json = async (response) => ({ status: response.status, body: response.status === 204 ? null : await response.json() });

test('a QUERY answers what the store itself answers', async () => {
  const { people, ask } = setup();
  const asked = { filter: ['plan', 'eq', 'Pro'], sort: [{ field: 'seats', direction: 'desc' }], take: 1 };
  const direct = await people.load(asked);
  const { status, body } = await json(await ask('QUERY', 'people', encodeQuery(asked)));
  assert.equal(status, 200);
  assert.deepEqual(body, JSON.parse(JSON.stringify(direct)));
  assert.deepEqual(body.rows.map((r) => r.name), ['Cy']);
  assert.equal(body.total, 2);
});

test('a QUERY can ask for the count alone', async () => {
  const { ask } = setup();
  const { body } = await json(await ask('QUERY', 'people', encodeQuery({ filter: ['seats', 'gt', 1] }, true)));
  assert.deepEqual(body, { total: 2 });
});

test('a read survives the trip whole: its clock, its fields, its search', () => {
  const asked = { now: new Date('2026-11-02T10:00:00Z'), fields: ['name'], search: 'a', searchFields: ['name'], skip: 2, group: 'plan' };
  const back = decodeQuery(JSON.parse(JSON.stringify(encodeQuery(asked))));
  assert.deepEqual(back, { options: asked, total: false });
});

test('a body that is not a read says why, and the store is never asked', async () => {
  const { ask } = setup();
  for (const [body, why] of [
    [{ filter: ['plan', 'like', 'Pro'] }, /filter/],
    [{ take: -1 }, /take/],
    [{ now: 'soon' }, /now/],
  ]) {
    const { status, body: said } = await json(await ask('QUERY', 'people', body));
    assert.equal(status, 422);
    assert.match(said.detail, why);
  }
  assert.equal((await ask('QUERY', 'people', '{not json')).status, 400);
  const plain = await ask('QUERY', 'people', encodeQuery(), { 'Content-Type': 'application/json' });
  assert.equal(plain.status, 415);
  assert.equal(plain.headers.get('Accept-Query'), DATA_QUERY_TYPE);
});

test('a row is read, made, changed and removed by its key; 5 and "5" reach the store as they were sent', async () => {
  const seen = [];
  const keyed = { key: 'id', async load() { return { rows: [], total: 0 } }, async byKey(key) { seen.push(key); return { id: key } } };
  const { ask, people } = setup({ keyed });
  await ask('GET', `keyed/${keySegment(5)}`);
  await ask('GET', `keyed/${keySegment('5')}`);
  assert.deepEqual(seen, [5, '5']);
  assert.deepEqual((await json(await ask('GET', `people/${keySegment(2)}`))).body.name, 'Bo');
  assert.equal((await ask('GET', `people/${keySegment(9)}`)).status, 404);
  assert.equal((await ask('POST', 'people', { id: 4, name: 'Di', plan: 'Free', seats: 2 })).status, 201);
  assert.equal((await json(await ask('PATCH', `people/${keySegment(4)}`, { seats: 3 }))).body.seats, 3);
  assert.equal((await ask('DELETE', `people/${keySegment(4)}`)).status, 204);
  assert.equal(await people.totalCount(), 3);
});

test('OPTIONS says what each route allows and what a QUERY takes; any other method is refused', async () => {
  const { ask } = setup();
  const store = await ask('OPTIONS', 'people');
  assert.equal(store.status, 204);
  assert.equal(store.headers.get('Allow'), 'QUERY, GET, POST, OPTIONS');
  assert.equal(store.headers.get('Accept-Query'), DATA_QUERY_TYPE);
  assert.equal((await ask('OPTIONS', `people/${keySegment(1)}`)).headers.get('Allow'), 'GET, PATCH, DELETE, OPTIONS');
  const put = await ask('PUT', 'people', {});
  assert.equal(put.status, 405);
  assert.equal(put.headers.get('Allow'), 'QUERY, GET, POST, OPTIONS');
});

test('a GET of the store says what it is, and what changed where it can say', async () => {
  const { ask } = setup();
  const { body } = await json(await ask('GET', 'people'));
  assert.equal(body.key, 'id');
  assert.equal(typeof body.changes, 'boolean');
  const told = { key: 'id', async load() { return { rows: [], total: 0 } }, async changes(since) { return { at: (since ?? 0) + 1, rows: true } } };
  const { ask: askTold } = setup({ told });
  assert.deepEqual((await json(await askTold('GET', 'told?since=4'))).body, { at: 5, rows: true });
});

test('a store that fails answers with its failure: its kind, and its status where it had one', async () => {
  const down = { key: 'id', async load() { throw new HttpError(503, 'Unavailable', 'https://api.test/rows') } };
  const { ask } = setup({ down, idb: new IdbStore({ name: 'nowhere', key: 'id' }) });
  const busy = await json(await ask('QUERY', 'down', encodeQuery()));
  assert.equal(busy.status, 503);
  assert.equal(busy.body.kind, 'server');
  // No IndexedDB in Node: the store rejects, and the answer says so rather than throwing.
  const none = await ask('QUERY', 'idb', encodeQuery());
  assert.ok(none.status >= 400);
});

test('it answers only under its own path, and names no store it does not have', async () => {
  const { handle, ask } = setup();
  assert.equal(await handle(new Request(`${ORIGIN}/app.js`)), null);
  assert.equal((await ask('QUERY', 'ghosts', encodeQuery())).status, 404);
  assert.equal((await ask('GET', 'people', undefined, { 'Sherpa-Data': '2' })).status, 400);
});

// Where a proxy refuses QUERY, a POST carries the same body and is answered the same. Will, 2026-11-02
test('a POST of a query is answered as the QUERY; a POST of a row still adds it', async () => {
  const { ask, people } = setup();
  const asked = encodeQuery({ filter: ['plan', 'eq', 'Pro'] });
  const viaQuery = await json(await ask('QUERY', 'people', asked));
  const viaPost = await json(await ask('POST', 'people', asked, { 'Content-Type': DATA_QUERY_TYPE }));
  assert.deepEqual(viaPost, viaQuery);
  assert.equal(await people.totalCount(), 3);
  assert.equal((await ask('POST', 'people', { id: 7, name: 'Ed', plan: 'Free', seats: 1 }, { 'Content-Type': 'application/json' })).status, 201);
  assert.equal(await people.totalCount(), 4);
});

// Plan 695 H5: ONE version marker — the header, on every request and answer; the body says none.
test('the version is one header, on every request and every answer; a query body carries none', async () => {
  const { ask } = setup();
  assert.equal('v' in encodeQuery({ take: 1 }), false);
  for (const [method, path, body] of [['GET', 'people'], ['QUERY', 'people', encodeQuery()], ['GET', 'ghosts'], ['OPTIONS', 'people']]) {
    assert.equal((await ask(method, path, body)).headers.get('Sherpa-Data'), '1', `${method} ${path}`);
  }
  assert.equal((await ask('QUERY', 'people', encodeQuery(), { 'Sherpa-Data': '2' })).status, 400);
  // A body's own `v` is no marker: it is not read.
  assert.equal((await ask('QUERY', 'people', { v: 2 })).status, 200);
});

// Plan 695 H5: an answer is the store's, and may be one reader's alone — no cache keeps it.
test('no answer is kept by a cache: rows, facts, changes, problems and acts', async () => {
  const told = { key: 'id', async load() { return { rows: [], total: 0 } }, async changes() { return { at: 1 } } };
  const { ask } = setup({ told });
  for (const [method, path, body] of [['QUERY', 'people', encodeQuery()], ['GET', 'people'], ['GET', 'told?since=1'], ['GET', 'ghosts'], ['POST', '?recheck']]) {
    assert.equal((await ask(method, path, body)).headers.get('Cache-Control'), 'no-store', `${method} ${path}`);
  }
});

// Plan 695 H5: a `since` that is not JSON is refused, and the store is never asked.
test('a since that is no mark is refused before the store is asked', async () => {
  const asked = [];
  const told = { key: 'id', async load() { return { rows: [], total: 0 } }, async changes(since) { asked.push(since); return { at: 1 } } };
  const { ask } = setup({ told });
  const bad = await ask('GET', `told?since=${encodeURIComponent('{not')}`);
  assert.equal(bad.status, 400);
  assert.equal((await bad.json()).kind, 'invalid');
  assert.deepEqual(asked, []);
  assert.equal((await ask('GET', `told?since=${encodeURIComponent(JSON.stringify({ at: 'c7' }))}`)).status, 200);
  assert.equal((await ask('GET', 'told?since=')).status, 200);
  assert.deepEqual(asked, [{ at: 'c7' }, undefined]);
});
