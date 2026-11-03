/**
 * A QUERY FALLS BACK TO POST — plan 652 S10. A read is a `QUERY` with its query as a
 * body, so a long filter never breaks a URL; where a server or a proxy refuses it, the
 * same body goes as `POST`, from then on. A read that fails at the network tries
 * `POST` once, and keeps it only if it answers. A REST store sends `GET` unless told.
 * TRAP T-a-query-falls-back-to-post
 *
 *   node --test test/unit/a-query-falls-back-to-post.test.mjs
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ArrayStore, RestStore, createDataHandler, openRequestStore, defineStores } from '../../dist/data.js';

const people = () => new ArrayStore([{ id: 1, name: 'Ada' }, { id: 2, name: 'Bo' }], { key: 'id' });

test('a request store whose server refuses QUERY sends the same body as POST, and keeps to it', async () => {
  const handle = createDataHandler({ stores: defineStores(() => ({ people: people() })) });
  const methods = [];
  const store = await openRequestStore({
    name: 'people',
    send: (request) => {
      methods.push(request.method);
      return request.method === 'QUERY' ? Promise.resolve(new Response(null, { status: 405 })) : handle(request);
    },
  });
  methods.length = 0;
  assert.equal((await store.load({ filter: ['name', 'eq', 'Bo'] })).rows[0].name, 'Bo');
  assert.equal((await store.load()).total, 2);
  assert.deepEqual(methods, ['QUERY', 'POST', 'POST'], 'refused once, then POST alone');
});

test('blocked at the network, it tries POST once — and keeps it only if it answers', async () => {
  const handle = createDataHandler({ stores: defineStores(() => ({ people: people() })) });
  let offline = false;
  const methods = [];
  const store = await openRequestStore({
    name: 'people',
    send: (request) => {
      methods.push(request.method);
      if (offline) return Promise.reject(new TypeError('fetch failed'));
      return request.method === 'QUERY' ? Promise.reject(new TypeError('preflight refused')) : handle(request);
    },
  });
  offline = true;
  methods.length = 0;
  await assert.rejects(store.load(), TypeError);
  assert.deepEqual(methods, ['QUERY', 'POST']);
  offline = false;
  methods.length = 0;
  assert.equal((await store.load()).total, 2);
  assert.deepEqual(methods, ['QUERY', 'POST'], 'offline did not stick: QUERY first, then a POST that answered');
});

test('a REST store sends GET by default; told QUERY, a long filter rides in the body, and a refusal falls back to POST', async (t) => {
  const was = globalThis.fetch;
  t.after(() => { globalThis.fetch = was; });
  const sent = [];
  globalThis.fetch = async (url, init = {}) => {
    sent.push({ url: String(url), method: init.method, body: init.body ? JSON.parse(init.body) : undefined });
    if (init.method === 'QUERY') return new Response(null, { status: 405 });
    return new Response(JSON.stringify({ data: [{ id: 1, name: 'Ada' }], total: 1 }), { status: 200, headers: { 'content-type': 'application/json' } });
  };
  const plain = new RestStore({ url: 'http://test/api', key: 'id', rowsPath: 'data', totalPath: 'total' });
  await plain.load({ filter: ['name', 'eq', 'Ada'] });
  assert.equal(sent[0].method, 'GET');
  assert.match(sent[0].url, /\?/);

  sent.length = 0;
  const long = 'x'.repeat(20000);
  const store = new RestStore({ url: 'http://test/api', key: 'id', rowsPath: 'data', totalPath: 'total', method: 'QUERY' });
  const { rows } = await store.load({ filter: ['name', 'contains', long] });
  assert.equal(rows[0].name, 'Ada');
  assert.deepEqual(sent.map((s) => s.method), ['QUERY', 'POST']);
  assert.equal(sent[1].url, 'http://test/api', 'no query string');
  assert.deepEqual(sent[1].body.filter, ['name', 'contains', long]);
  await store.load();
  assert.equal(sent.at(-1).method, 'POST', 'and POST from then on');
});
