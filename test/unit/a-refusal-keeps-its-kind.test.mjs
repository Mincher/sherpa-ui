/**
 * A REFUSAL KEEPS ITS KIND — plan 695 H5. A store's failure crosses the protocol as
 * `application/problem+json` (RFC 9457), with the protocol's kind kept: an offline
 * source is a 503 that says `offline`, never a 500, and a request store on the far
 * side throws it as `offline` again. TRAP T-a-refusal-keeps-its-kind
 *
 *   node --test test/unit/a-refusal-keeps-its-kind.test.mjs
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  ArrayStore, DATA_QUERY_TYPE, HttpError, PROBLEM_TYPE, ValidationError, createDataHandler, defineStores, encodeQuery,
  failureOf, fakeRemote, openRequestStore, required, rules,
} from '../../dist/data.js';

const rows = () => [{ id: 1, name: 'Ada' }, { id: 2, name: 'Bo' }];
/** A store whose every read fails as `error()` makes it. */
const failing = (error) => ({ key: 'id', capabilities: { remote: true }, async load() { throw error(); }, async totalCount() { throw error(); } });
const setup = (stores) => createDataHandler({ stores: defineStores(() => stores) });
const query = (handle, name) => handle(new Request(`http://app.test/sherpa/data/${name}`, { method: 'QUERY', headers: { 'Content-Type': DATA_QUERY_TYPE }, body: JSON.stringify(encodeQuery()) }));

test('a failure is a problem: its media type, type, title, status, detail and kind', async () => {
  const handle = setup({ down: failing(() => new TypeError('fetch failed')) });
  const response = await query(handle, 'down');
  assert.equal(response.headers.get('Content-Type'), PROBLEM_TYPE);
  const said = await response.json();
  assert.deepEqual(Object.keys(said).sort(), ['detail', 'kind', 'status', 'title', 'type']);
  assert.equal(said.status, response.status);
  assert.equal(said.type, 'tag:sherpa-ui,2026:offline');
  assert.equal(said.detail, 'fetch failed');
  assert.equal(typeof said.title, 'string');
});

test('each kind crosses as its own status, and reads back as the same kind', async () => {
  const cases = {
    offline: [() => new TypeError('fetch failed'), 503],
    timeout: [() => Object.assign(new Error('slow'), { name: 'TimeoutError' }), 504],
    server: [() => new HttpError(502, 'Bad Gateway', 'https://api.test'), 502],
    refused: [() => new HttpError(401, 'Unauthorized', 'https://api.test'), 401],
    conflict: [() => new HttpError(412, 'Precondition Failed', 'https://api.test'), 412],
  };
  const handle = setup(Object.fromEntries(Object.entries(cases).map(([kind, [error]]) => [kind, failing(error)])));
  for (const [kind, [, status]] of Object.entries(cases)) {
    const response = await query(handle, kind);
    assert.equal(response.status, status, kind);
    assert.equal((await response.json()).kind, kind);
    // The far side reads the kind its host said, not the status alone.
    const store = await openRequestStore({ name: kind, send: handle });
    const error = await store.load().then(() => null, (e) => e);
    assert.equal(failureOf(error).kind, kind, `${kind} read back`);
    assert.equal(failureOf(error).status, status);
  }
});

test('an offline source behind a host is offline to the page, not a failing server', async () => {
  // The worker's host: a remote store whose network is down, its first read with no set held.
  const net = { down: true };
  const remote = fakeRemote(new ArrayStore(rows(), { key: 'id' }), { delay: 0, fail: () => (net.down ? 1 : 0) });
  const handle = setup({ people: remote });
  const store = await openRequestStore({ name: 'people', send: handle });
  const error = await store.load().then(() => null, (e) => e);
  assert.equal(error.status, 503);
  assert.equal(failureOf(error).kind, 'offline');
  net.down = false;
  assert.equal((await store.load()).total, 2);
});

test('a refused write says its issues, and the far side throws them as its own ValidationError', async () => {
  const people = new ArrayStore(rows(), { key: 'id', schema: rules({ name: required() }) });
  const handle = setup({ people });
  const response = await handle(new Request('http://app.test/sherpa/data/people', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: 3 }) }));
  const said = await response.json();
  assert.equal(said.kind, 'invalid');
  assert.ok(said.issues.length);
  const store = await openRequestStore({ name: 'people', send: handle });
  await assert.rejects(store.insert({ id: 4 }), ValidationError);
});

test('a request that is not one the data takes is a problem too: 404, 405, 415', async () => {
  const handle = setup({ people: new ArrayStore(rows(), { key: 'id' }) });
  for (const [request, status] of [
    [new Request('http://app.test/sherpa/data/ghosts'), 404],
    [new Request('http://app.test/sherpa/data/people', { method: 'PUT', body: '{}' }), 405],
    [new Request('http://app.test/sherpa/data/people', { method: 'QUERY', headers: { 'Content-Type': 'application/json' }, body: '{}' }), 415],
  ]) {
    const response = await handle(request);
    assert.equal(response.status, status);
    assert.equal(response.headers.get('Content-Type'), PROBLEM_TYPE);
    assert.equal((await response.json()).kind, 'invalid');
  }
});
