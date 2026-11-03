/**
 * A PREFLIGHT IS THE APP'S TO ANSWER — plan 695 H5. A page on another origin asks
 * by the app's own CORS policy: its origins, and the app's own headers. An allowed
 * origin's preflight is answered with Sherpa's methods and headers; a refused one is
 * refused, and a request store on the far side reads that as `refused`, never as
 * offline. The browser half is in reforged-a-server-answers-another-origin.spec.ts.
 * TRAP T-a-preflight-is-the-apps-to-answer
 *
 *   node --test test/unit/a-preflight-is-the-apps-to-answer.test.mjs
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ArrayStore, DATA_BASE, DATA_QUERY_TYPE, createDataHandler, defineStores, encodeQuery, failureOf, openRequestStore } from '../../dist/data.js';

const PAGE = 'https://page.test';
const people = () => new ArrayStore([{ id: 1, name: 'Ada' }], { key: 'id' });
const setup = (cors) => createDataHandler({ stores: defineStores(() => ({ people: people() })), ...(cors ? { cors } : {}) });
const preflight = (handle, origin, path = 'people') => handle(new Request(`https://api.test${DATA_BASE}${path}`, {
  method: 'OPTIONS', headers: { Origin: origin, 'Access-Control-Request-Method': 'QUERY', 'Access-Control-Request-Headers': 'content-type, sherpa-data, authorization' },
}));

test('an allowed origin\'s preflight: its origin, the route\'s methods, Sherpa\'s and the app\'s headers', async () => {
  const handle = setup({ origins: [PAGE], headers: ['Authorization'], maxAge: 60 });
  const response = await preflight(handle, PAGE);
  assert.equal(response.status, 204);
  assert.equal(response.headers.get('Access-Control-Allow-Origin'), PAGE);
  assert.equal(response.headers.get('Access-Control-Allow-Methods'), 'QUERY, GET, POST, OPTIONS');
  assert.equal(response.headers.get('Access-Control-Allow-Headers'), 'Content-Type, Sherpa-Data, If-Unmodified-Since, traceparent, Authorization');
  assert.equal(response.headers.get('Access-Control-Max-Age'), '60');
  assert.equal(response.headers.get('Vary'), 'Origin');
  assert.equal(response.headers.get('Access-Control-Allow-Credentials'), null, 'no cookies unless the app says');
  assert.equal((await preflight(handle, PAGE, 'people/1')).headers.get('Access-Control-Allow-Methods'), 'GET, PATCH, DELETE, OPTIONS');
});

test('an allowed origin\'s answer lets its page read Sherpa\'s own headers', async () => {
  const handle = setup({ origins: (origin) => origin.endsWith('.test'), credentials: true });
  const response = await handle(new Request(`https://api.test${DATA_BASE}people`, {
    method: 'QUERY', headers: { Origin: PAGE, 'Content-Type': DATA_QUERY_TYPE }, body: JSON.stringify(encodeQuery()),
  }));
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('Access-Control-Allow-Origin'), PAGE);
  assert.equal(response.headers.get('Access-Control-Allow-Credentials'), 'true');
  assert.match(response.headers.get('Access-Control-Expose-Headers'), /Sherpa-Data, Sherpa-Stale, traceparent/);
});

test('a refused origin is refused, preflight and request alike, and no store is asked', async () => {
  let asked = 0;
  const store = Object.assign(people(), {});
  const load = store.load.bind(store);
  store.load = (...args) => { asked++; return load(...args); };
  const handle = createDataHandler({ stores: defineStores(() => ({ people: store })), cors: { origins: [PAGE] } });
  const pre = await preflight(handle, 'https://elsewhere.test');
  assert.equal(pre.status, 403);
  assert.equal(pre.headers.get('Access-Control-Allow-Origin'), null);
  assert.equal((await pre.json()).kind, 'refused');
  const read = await handle(new Request(`https://api.test${DATA_BASE}people`, {
    method: 'QUERY', headers: { Origin: 'https://elsewhere.test', 'Content-Type': DATA_QUERY_TYPE }, body: '{}',
  }));
  assert.equal(read.status, 403);
  assert.equal(asked, 0);
});

test('its own origin always may, and with no policy no CORS is said', async () => {
  const strict = setup({ origins: [] });
  const own = await strict(new Request(`https://api.test${DATA_BASE}people`, { headers: { Origin: 'https://api.test' } }));
  assert.equal(own.status, 200);
  const none = setup();
  const response = await none(new Request(`https://api.test${DATA_BASE}people`, { headers: { Origin: PAGE } }));
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('Access-Control-Allow-Origin'), null);
});

/* What a browser does, played in Node: a refused preflight fails the fetch as a
   TypeError, as offline would; a plain no-cors GET still reaches the host. */
test('a request store reads a refused preflight as refused, and a host that is gone as offline', async (t) => {
  const was = Object.getOwnPropertyDescriptor(globalThis, 'location');
  Object.defineProperty(globalThis, 'location', { value: { origin: PAGE }, configurable: true });
  t.after(() => (was ? Object.defineProperty(globalThis, 'location', was) : delete globalThis.location));
  const handle = setup({ origins: [PAGE] });
  const net = { up: true, refused: false };
  const sent = [];
  const send = async (request) => {
    sent.push(request.mode === 'no-cors' ? 'probe' : request.method);
    if (!net.up) throw new TypeError('Failed to fetch');
    if (net.refused && request.mode !== 'no-cors') throw new TypeError('Failed to fetch');
    return handle(request);
  };
  const store = await openRequestStore({ name: 'people', origin: 'https://api.test', send });
  assert.equal((await store.load()).total, 1);
  net.refused = true;
  sent.length = 0;
  const refused = await store.load().then(() => null, (e) => e);
  assert.equal(failureOf(refused).kind, 'refused');
  assert.deepEqual(sent, ['QUERY', 'POST', 'probe'], 'POST is tried first, then one plain GET tells refused from offline');
  net.up = false;
  const gone = await store.byKey(1).then(() => null, (e) => e);
  assert.equal(failureOf(gone).kind, 'offline');
});
