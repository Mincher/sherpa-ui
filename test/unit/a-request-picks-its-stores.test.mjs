/**
 * A REQUEST PICKS ITS STORES — plan 695 H2. An app's stores are said once
 * (`defineStores`), and the incoming request reaches the app's pick: an app header
 * names which of a name's stores answers, and Sherpa passes the headers on and
 * never reads them. TRAP T-a-request-picks-its-stores
 *
 *   node --test test/unit/a-request-picks-its-stores.test.mjs
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  ArrayStore, DATA_BASE, HeldStore, RestStore, createDataHandler, defineStores, fakeRemote, heldOf, openRequestStore,
} from '../../dist/data.js';

const settle = () => new Promise((done) => setTimeout(done, 30));
/** The headers Sherpa's own protocol reads — a CORS policy's too; nothing else of a request is its. */
const SHERPAS = new Set(['traceparent', 'sherpa-data', 'content-type', 'if-unmodified-since', 'origin', 'access-control-request-method']);

/** Two stores under one name, picked by the app's own header. */
function app() {
  const plain = new ArrayStore([{ id: 1, owner: 'Ada' }], { key: 'id' });
  const other = new ArrayStore([{ id: 1, owner: 'Bo' }, { id: 2, owner: 'Cy' }], { key: 'id' });
  const seen = [];
  const stores = defineStores(() => ({
    people: {
      stores: { plain, other },
      // The app's read of its own header — Sherpa never makes it.
      pick: (request) => {
        const said = Headers.prototype.get.call(request.headers, 'X-App-Tenant');
        seen.push({ tenant: said, auth: Headers.prototype.get.call(request.headers, 'Authorization') });
        return said === 'other' ? 'other' : 'plain';
      },
    },
  }));
  return { plain, other, seen, stores };
}

/** Every header name Sherpa read of a request, by any door. */
function spied(request) {
  const read = new Set();
  const headers = request.headers;
  for (const door of ['get', 'has']) {
    const real = headers[door].bind(headers);
    headers[door] = (name) => { read.add(String(name).toLowerCase()); return real(name); };
  }
  for (const door of ['entries', 'keys', 'values', 'forEach', Symbol.iterator]) {
    const real = headers[door].bind(headers);
    headers[door] = (...args) => { read.add(`*${String(door)}`); return real(...args); };
  }
  return read;
}

test('an app header picks the store that answers, and the request store says which', async () => {
  const { stores, seen } = app();
  const send = createDataHandler({ stores });
  const plain = await openRequestStore({ name: 'people', send });
  const other = await openRequestStore({ name: 'people', send, headers: () => ({ 'X-App-Tenant': 'other', Authorization: 'Bearer t0k3n' }) });
  assert.deepEqual((await plain.load()).rows.map((r) => r.owner), ['Ada']);
  assert.deepEqual((await other.load()).rows.map((r) => r.owner), ['Bo', 'Cy']);
  assert.equal(await other.totalCount(), 2);
  // The app's own headers reached its pick whole: its sign-in too.
  assert.ok(seen.some((s) => s.tenant === 'other' && s.auth === 'Bearer t0k3n'));
  assert.deepEqual(stores.all('people').map((d) => d.as), ['plain', 'other']);
});

test('Sherpa never reads an app header: only its own protocol\'s', async () => {
  const { stores } = app();
  const handle = createDataHandler({ stores });
  const ask = async (init, path = '') => {
    const request = new Request(`http://app${DATA_BASE}people${path}`, {
      ...init, headers: { 'X-App-Tenant': 'other', Authorization: 'Bearer t0k3n', 'Sherpa-Data': '1', ...init?.headers },
    });
    const read = spied(request);
    const response = await handle(request);
    return { read: [...read], status: response.status };
  };
  const all = [
    await ask({ method: 'GET' }),
    await ask({ method: 'QUERY', headers: { 'Content-Type': 'application/vnd.sherpa.query+json' }, body: JSON.stringify({}) }),
    await ask({ method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ owner: 'Di' }) }, '/1'),
  ];
  assert.deepEqual(all.map((a) => a.status), [200, 200, 200]);
  // The spy hears a read: Sherpa's own version header is read on each.
  for (const { read } of all) assert.ok(read.includes('sherpa-data'));
  for (const { read } of all) assert.deepEqual(read.filter((name) => !SHERPAS.has(name)), [], `it read only its own: ${read}`);
});

test('a request\'s pick holds for its writes: one tenant\'s write reaches its own store alone', async () => {
  const { stores, plain, other } = app();
  const send = createDataHandler({ stores });
  const theirs = await openRequestStore({ name: 'people', send, headers: () => ({ 'X-App-Tenant': 'other' }) });
  await theirs.update(1, { owner: 'Di' });
  assert.equal((await other.byKey(1)).owner, 'Di');
  assert.equal((await plain.byKey(1)).owner, 'Ada', 'the other store is untouched');
});

test('each request store hears its own store\'s changes, of those under its name', async () => {
  const { stores, plain, other } = app();
  const send = createDataHandler({ stores, notifies: true });
  const mine = await openRequestStore({ name: 'people', send });
  const theirs = await openRequestStore({ name: 'people', send, headers: () => ({ 'X-App-Tenant': 'other' }) });
  const heard = { mine: 0, theirs: 0 };
  mine.addEventListener('change', () => heard.mine++);
  theirs.addEventListener('change', () => heard.theirs++);
  await other.update(2, { owner: 'Ed' });
  await settle();
  assert.deepEqual(heard, { mine: 0, theirs: 1 });
  await plain.update(1, { owner: 'Fa' });
  await settle();
  assert.deepEqual(heard, { mine: 1, theirs: 1 });
  mine.close();
  theirs.close();
});

test('a check behind is the name\'s: every store under it that holds a set reads again', async () => {
  const inner = new ArrayStore([{ id: 1, owner: 'Ada' }], { key: 'id' });
  const remote = fakeRemote(inner, { delay: 0 });
  const held = new HeldStore(remote);
  await held.load();
  const stores = defineStores(() => ({ people: { stores: { local: inner, held }, pick: () => 'local' } }));
  const handle = createDataHandler({ stores });
  let checked = 0;
  const recheck = held.recheck.bind(held);
  held.recheck = () => { checked++; return recheck(); };
  // A feed's word carries no app header: the pick names the local store, and the held one is still checked.
  const response = await handle(new Request(`http://app${DATA_BASE}people?recheck`, { method: 'POST' }));
  assert.equal(response.status, 204);
  assert.equal(checked, 1);
});

test('a store made once, at the first ask: a page a worker answers makes none', async () => {
  let made = 0;
  const stores = defineStores(() => {
    made++;
    return { people: new ArrayStore([{ id: 1 }], { key: 'id' }) };
  });
  assert.equal(made, 0);
  const handle = createDataHandler({ stores });
  assert.equal(made, 0, 'a handler that does not notify makes nothing until it is asked');
  await handle(new Request(`http://app${DATA_BASE}people`));
  await handle(new Request(`http://app${DATA_BASE}people`));
  assert.equal(made, 1);
});

/* A STORE MADE PER REQUEST — plan 695 H5: a server wraps each request's own sign-in
   into its store, here one that sends it upstream. The app reads the request; Sherpa
   reads only its own protocol's headers, and never holds such a store. */
function upstream(t) {
  const was = globalThis.fetch;
  t.after(() => { globalThis.fetch = was; });
  const heard = [];
  globalThis.fetch = async (url, init = {}) => {
    heard.push(new Headers(init.headers).get('Authorization'));
    return new Response(JSON.stringify({ data: [{ id: 1, owner: 'Ada' }], total: 1 }), { status: 200, headers: { 'content-type': 'application/json' } });
  };
  let made = 0;
  const stores = defineStores(() => ({
    // The app's factory: the request's own sign-in, read by the app, sent upstream.
    orders: (request) => {
      made++;
      const auth = Headers.prototype.get.call(request.headers, 'Authorization');
      return new RestStore({ url: 'https://upstream.test/orders', key: 'id', rowsPath: 'data', totalPath: 'total', init: { headers: auth ? { Authorization: auth } : {} } });
    },
  }));
  return { stores, heard, made: () => made };
}

test('a store made per request sends that request\'s sign-in upstream; Sherpa reads none of it', async (t) => {
  const { stores, heard, made } = upstream(t);
  const handle = createDataHandler({ stores, host: 'server' });
  const ask = async (token, init = {}) => {
    const request = new Request(`https://api.test${DATA_BASE}orders`, {
      method: 'QUERY', ...init, headers: { 'Content-Type': 'application/vnd.sherpa.query+json', Authorization: `Bearer ${token}`, 'Sherpa-Data': '1' }, body: '{}',
    });
    const read = spied(request);
    const response = await handle(request);
    return { read: [...read], status: response.status, body: await response.json() };
  };
  const ada = await ask('ada');
  const bo = await ask('bo');
  assert.deepEqual([ada.status, bo.status], [200, 200]);
  assert.deepEqual(ada.body.rows, [{ id: 1, owner: 'Ada' }]);
  assert.deepEqual(heard, ['Bearer ada', 'Bearer bo'], 'each request\'s own sign-in went upstream');
  assert.equal(made(), 2, 'one store for each request');
  for (const { read } of [ada, bo]) assert.deepEqual(read.filter((name) => !SHERPAS.has(name)), [], `it read only its own: ${read}`);
});

test('a store made per request is never held, never heard, never handed out', async (t) => {
  const { stores, made } = upstream(t);
  assert.deepEqual(stores.all(), [], 'none is made until a request asks');
  assert.ok(stores.has('orders'));
  const worker = stores.through(({ store }) => heldOf(store) ?? store);
  const one = worker.pick('orders', new Request('https://api.test/'));
  const two = worker.pick('orders', new Request('https://api.test/'));
  assert.notEqual(one.store, two.store);
  assert.equal(one.store instanceof HeldStore, false, 'a held set per request would read upstream on every ask');
  assert.equal(made(), 2);
  // A check behind has nothing of it to read: it answers, and asks upstream nothing.
  const handle = createDataHandler({ stores });
  assert.equal((await handle(new Request(`https://api.test${DATA_BASE}orders?recheck`, { method: 'POST' }))).status, 204);
  assert.equal(made(), 2);
});
