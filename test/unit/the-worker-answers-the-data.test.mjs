/**
 * THE WORKER ANSWERS THE DATA — plan 652 S4. `serveData` answers the data layer's
 * own requests in a Service Worker, after its stores are ready, and leaves every
 * other request alone; `openWorkerStore` asks the page's own handler where no
 * worker can answer. A worker scope is faked here: Node has none.
 * TRAP T-the-worker-answers-the-data
 *
 *   node --test test/unit/the-worker-answers-the-data.test.mjs
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ArrayStore, DATA_QUERY_TYPE, createDataHandler, encodeQuery, defineStores } from '../../dist/data.js';
import { serveData } from '../../dist/worker.js';
import { openWorkerStore } from '../../dist/app.js';

const ORIGIN = 'https://app.test';
const ROWS = [{ id: 1, team: 'core' }, { id: 2, team: 'ops' }];

/** A worker scope with no network: what `serveData` reads of one. */
function workerScope() {
  return Object.assign(new EventTarget(), {
    location: { origin: ORIGIN },
    clients: { claim: async () => {} },
    skipWaiting: async () => {},
  });
}

/** A fetch event the worker may answer: what it answered with, or nothing. */
function ask(scope, request) {
  let answered = null;
  const event = Object.assign(new Event('fetch'), { request, respondWith: (r) => { answered = Promise.resolve(r); }, waitUntil() {} });
  scope.dispatchEvent(event);
  return answered;
}

test('it answers the data layer\'s path from its stores, and no other request', async () => {
  const scope = workerScope();
  serveData(scope, { stores: defineStores(() => ({ people: new ArrayStore(ROWS, { key: 'id' }) })) });
  const read = await ask(scope, new Request(`${ORIGIN}/sherpa/data/people`, {
    method: 'QUERY', headers: { 'Content-Type': DATA_QUERY_TYPE }, body: JSON.stringify(encodeQuery({ filter: ['team', 'eq', 'ops'] })),
  }));
  assert.equal(read.status, 200);
  assert.deepEqual((await read.json()).rows, [ROWS[1]]);
  assert.equal(ask(scope, new Request(`${ORIGIN}/app.json`)), null, 'a file is not the data layer\'s');
  assert.equal(ask(scope, new Request('https://elsewhere.test/sherpa/data/people')), null, 'nor another origin\'s');
});

test('each request waits until its stores are ready', async () => {
  const scope = workerScope();
  const store = new ArrayStore([], { key: 'id' });
  let seed;
  const ready = new Promise((done) => { seed = async () => { await store.insert(ROWS[0]); done(); }; });
  serveData(scope, { stores: defineStores(() => ({ people: store })), ready });
  const answer = ask(scope, new Request(`${ORIGIN}/sherpa/data/people`, {
    method: 'QUERY', headers: { 'Content-Type': DATA_QUERY_TYPE }, body: JSON.stringify(encodeQuery({})),
  }));
  await seed();
  assert.deepEqual((await (await answer).json()).rows, [ROWS[0]], 'answered after the seed, not before');
});

test('with no worker to ask, the page\'s own handler answers', async () => {
  const handler = createDataHandler({ stores: defineStores(() => ({ people: new ArrayStore(ROWS, { key: 'id' }) })) });
  const store = await openWorkerStore({ name: 'people', fallback: handler });
  assert.equal(await store.totalCount(), 2);
});
