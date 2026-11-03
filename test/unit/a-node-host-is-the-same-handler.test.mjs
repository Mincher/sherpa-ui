/**
 * A NODE HOST IS THE SAME HANDLER — plan 695 H5. `sherpa-ui/server` serves the
 * handler the page and the worker answer with on `node:http`, and as an
 * Express-style middleware: one protocol, three hosts. The feed streams through it,
 * and the worker script is stamped with the build. Each server listens on a port
 * the system picks, and stops after. TRAP T-a-node-host-is-the-same-handler
 *
 *   npm run build && node --test test/unit/a-node-host-is-the-same-handler.test.mjs
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { Readable } from 'node:stream';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { globSync } from 'node:fs';
import { ArrayStore, DATA_BASE, DATA_QUERY_TYPE, defineStores, encodeQuery, keySegment, openRequestStore } from '../../dist/data.js';
import { UPDATES_PATH, createDataHandler, nodeHandler, serveWorkerScript, updatesFeed } from '../../dist/server.js';
import lint from '../../eslint.config.js';
import { graph } from '../../scripts/check-weight.mjs';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const rows = () => [{ id: 1, name: 'Ada', plan: 'Pro' }, { id: 2, name: 'Bo', plan: 'Free' }];

/** A `node:http` server over these handlers, on a port the system picks; it stops after the test. */
async function serve(t, handlers, options) {
  const server = createServer(nodeHandler(handlers, options));
  await new Promise((up) => server.listen(0, '127.0.0.1', up));
  t.after(() => new Promise((down) => { server.closeAllConnections(); server.close(down); }));
  return `http://127.0.0.1:${server.address().port}`;
}

test('a node:http host answers as the handler does: facts, a QUERY, a write, an act, a problem', async (t) => {
  const people = new ArrayStore(rows(), { key: 'id' });
  const handle = createDataHandler({ stores: defineStores(() => ({ people })), host: 'server' });
  const at = await serve(t, handle);
  const facts = await fetch(`${at}${DATA_BASE}people`);
  assert.equal(facts.status, 200);
  assert.equal((await facts.json()).key, 'id');
  assert.equal(facts.headers.get('Cache-Control'), 'no-store');
  const read = await fetch(`${at}${DATA_BASE}people`, { method: 'QUERY', headers: { 'Content-Type': DATA_QUERY_TYPE }, body: JSON.stringify(encodeQuery({ filter: ['plan', 'eq', 'Pro'] })) });
  assert.deepEqual((await read.json()).rows.map((r) => r.name), ['Ada']);
  const changed = await fetch(`${at}${DATA_BASE}people/${keySegment(2)}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ plan: 'Pro' }) });
  assert.equal((await changed.json()).plan, 'Pro');
  assert.equal((await people.byKey(2)).plan, 'Pro');
  assert.equal((await fetch(`${at}${DATA_BASE}people?recheck`, { method: 'POST' })).status, 204);
  const none = await fetch(`${at}${DATA_BASE}ghosts`);
  assert.equal(none.status, 404);
  assert.equal(none.headers.get('Content-Type'), 'application/problem+json');
  assert.equal((await fetch(`${at}/app.js`)).status, 404, 'what no handler answers is 404, with no next');
});

test('a request store reads the Node host over the network, as a page reads its worker', async (t) => {
  const handle = createDataHandler({ stores: defineStores(() => ({ people: new ArrayStore(rows(), { key: 'id' }) })), host: 'server' });
  const at = await serve(t, handle);
  const store = await openRequestStore({ name: 'people', origin: at, send: (request) => fetch(request) });
  assert.equal((await store.load({ sort: [{ field: 'name', direction: 'desc' }] })).rows[0].name, 'Bo');
  assert.equal(await store.totalCount(), 2);
  await store.insert({ id: 3, name: 'Cy', plan: 'Free' });
  assert.equal(await store.totalCount(), 3);
});

test('as Express middleware: what no handler answers goes to next, and a body a parser read is used', async () => {
  const handle = createDataHandler({ stores: defineStores(() => ({ people: new ArrayStore(rows(), { key: 'id' }) })) });
  const middleware = nodeHandler(handle);
  const call = (req) => new Promise((done) => {
    const res = fakeResponse(done);
    void middleware(req, res, (error) => done({ next: true, error }));
  });
  const passed = await call(nodeRequest({ url: '/app.js' }));
  assert.deepEqual(passed, { next: true, error: undefined });
  // Mounted at a path, Express rewrites `url`; `originalUrl` is the whole path.
  const parsed = Object.assign(nodeRequest({ method: 'POST', url: '/people', originalUrl: `${DATA_BASE}people`, headers: { 'content-type': 'application/json' } }), { body: { id: 3, name: 'Cy' } });
  parsed.resume();
  await new Promise((done) => parsed.on('end', done));
  const made = await call(parsed);
  assert.equal(made.status, 201);
  assert.equal(JSON.parse(made.body).name, 'Cy');
});

test('a request no handler answers goes on to the next middleware with its body whole', async (t) => {
  const handle = createDataHandler({ stores: defineStores(() => ({ people: new ArrayStore(rows(), { key: 'id' }) })) });
  const middleware = nodeHandler(handle);
  const server = createServer((req, res) => middleware(req, res, async () => {
    let body = '';
    for await (const chunk of req) body += chunk;
    res.end(`next read ${body}`);
  }));
  await new Promise((up) => server.listen(0, '127.0.0.1', up));
  t.after(() => new Promise((down) => { server.closeAllConnections(); server.close(down); }));
  const at = `http://127.0.0.1:${server.address().port}`;
  assert.equal(await (await fetch(`${at}/debug`, { method: 'POST', body: '{"kind":"app"}' })).text(), 'next read {"kind":"app"}');
  assert.equal((await fetch(`${at}${DATA_BASE}people`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: 3, name: 'Cy' }) })).status, 201);
});

test('the feed streams through it: each notice as it is said, and a follower that goes is dropped', async (t) => {
  const feed = updatesFeed();
  const at = await serve(t, [feed.answer]);
  const stop = new AbortController();
  const response = await fetch(`${at}${UPDATES_PATH}`, { signal: stop.signal });
  assert.equal(response.headers.get('Content-Type'), 'text/event-stream');
  assert.equal(response.headers.get('Cache-Control'), 'no-store');
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let text = '';
  feed.say({ kind: 'app' });
  while (!text.includes('"kind":"app"')) text += decoder.decode((await reader.read()).value);
  stop.abort();
  await new Promise((done) => setTimeout(done, 50));
  assert.doesNotThrow(() => feed.say({ kind: 'data', store: 'people' }));
});

test('the worker script is stamped with the build, and a new build is said on the feed once', async (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'sherpa-build-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  writeFileSync(join(dir, 'sw.js'), 'self.x = 1;\n');
  const feed = updatesFeed();
  const said = [];
  const say = feed.say.bind(feed);
  feed.say = (notice) => { said.push(notice); say(notice); };
  const at = await serve(t, serveWorkerScript({ file: join(dir, 'sw.js'), build: [dir], feed, more: (request) => new URL(request.url).searchParams.get('client') ?? '' }));
  const first = await (await fetch(`${at}/sw.js?client=7`)).text();
  assert.match(first, /^\/\/ build \d+-7\nself\.x = 1;\n$/);
  assert.equal((await fetch(`${at}/other.js`)).status, 404);
  await new Promise((done) => setTimeout(done, 2100));
  writeFileSync(join(dir, 'app.js'), 'built again');
  await new Promise((done) => setTimeout(done, 900));
  const second = await (await fetch(`${at}/sw.js`)).text();
  assert.notEqual(second.split('\n')[0], first.split('\n')[0].replace(/-7$/, ''), 'a new build is a new worker');
  assert.deepEqual(said, [{ kind: 'app' }], 'said once');
});

test('everything sherpa-ui/server loads is held DOM-free by the lint', () => {
  const held = new Set(lint
    .filter((b) => b.rules?.['no-restricted-globals']?.slice(1).some((g) => g.name === 'document'))
    .flatMap((b) => b.files.flatMap((glob) => globSync(glob, { cwd: ROOT }))));
  const loaded = [...graph(`${ROOT}dist/server.js`).modules].map((f) => `src/${relative(`${ROOT}dist`, f).replace(/\.js$/, '.ts')}`);
  assert.ok(loaded.includes('src/core/server/node-host.ts'));
  assert.deepEqual(loaded.filter((f) => !held.has(f)), []);
});

/** A Node request with nothing on the wire behind it. */
function nodeRequest({ method = 'GET', url, originalUrl, headers = {} }) {
  const req = Readable.from([]);
  return Object.assign(req, { method, url, originalUrl, headers: { host: 'app.test', ...headers }, socket: {} });
}

/** Enough of a `ServerResponse` to read what was written. */
function fakeResponse(done) {
  const head = {};
  let body = '';
  return {
    statusCode: 200, headersSent: false,
    setHeader: (name, value) => { head[name] = value; },
    flushHeaders() {}, on() {}, once() {},
    write: (chunk) => { body += Buffer.from(chunk).toString(); return true; },
    end() { done({ status: this.statusCode, head, body }); },
  };
}
