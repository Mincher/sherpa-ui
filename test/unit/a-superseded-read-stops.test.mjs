/**
 * A SUPERSEDED READ STOPS — plan 695 S4. Every read takes an `AbortSignal`, and a
 * store passes it to its fetch: a source's newer ask aborts the one it supersedes,
 * and that ask raises no error. The signal never enters the question.
 * TRAP T-a-superseded-read-stops
 *
 *   node --test test/unit/a-superseded-read-stops.test.mjs
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ArrayStore, DataSource, RestStore, createDataHandler, encodeQuery, fakeRemote, openRequestStore } from '../../dist/data.js';

const PEOPLE = [{ id: 1, name: 'Ada' }, { id: 2, name: 'Bo' }, { id: 3, name: 'Cy' }];
const tick = (ms = 0) => new Promise((done) => setTimeout(done, ms));

/** A request store whose reads each wait, as a slow host's do, and stop when aborted. */
async function slow(ms = 40) {
  const handle = createDataHandler({ stores: { people: new ArrayStore(PEOPLE.map((p) => ({ ...p })), { key: 'id' }) } });
  const reads = [];
  const send = async (request) => {
    if (request.method === 'QUERY') {
      reads.push(request.signal);
      await new Promise((done, stop) => {
        const timer = setTimeout(done, ms);
        request.signal.addEventListener('abort', () => { clearTimeout(timer); stop(request.signal.reason); }, { once: true });
      });
    }
    return handle(request);
  };
  return { store: await openRequestStore({ name: 'people', send }), reads };
}

test('a newer ask aborts the read it supersedes, and only that one', async () => {
  const { store, reads } = await slow();
  const source = new DataSource({ store });
  const errors = [];
  source.addEventListener('error', (e) => errors.push(e.detail.failure));
  const first = source.load();
  await tick(5);
  const second = source.load({ force: true });
  await Promise.all([first, second]);
  assert.equal(reads.length, 2, 'two reads were sent');
  assert.deepEqual(reads.map((s) => s.aborted), [true, false], 'the first stopped; the second answered');
  assert.deepEqual(source.rows.map((r) => r.name), ['Ada', 'Bo', 'Cy']);
  assert.deepEqual(errors, [], 'a read that was superseded is no error');
});

test('a closed source stops its read, and says nothing', async () => {
  const { store, reads } = await slow();
  const source = new DataSource({ store });
  const errors = [];
  source.addEventListener('error', (e) => errors.push(e.detail));
  const asked = source.load();
  await tick(5);
  source.close();
  await asked;
  assert.equal(reads[0]?.aborted, true);
  assert.deepEqual(errors, []);
});

test('a RestStore hands its read\'s signal to fetch', async (t) => {
  const seen = [];
  const real = globalThis.fetch;
  globalThis.fetch = (url, init) => new Promise((done, stop) => {
    seen.push(init.signal);
    init.signal.addEventListener('abort', () => stop(init.signal.reason), { once: true });
  });
  t.after(() => { globalThis.fetch = real; });
  const store = new RestStore({ url: 'http://test/api/people', key: 'id' });
  const stop = new AbortController();
  const read = store.load({ take: 2, signal: stop.signal });
  stop.abort();
  await assert.rejects(read, { name: 'AbortError' });
  assert.equal(seen[0]?.aborted, true);
});

test('a faked remote\'s wait stops too', async () => {
  const store = fakeRemote(new ArrayStore(PEOPLE, { key: 'id' }), { delay: 5000 });
  const stop = new AbortController();
  const began = Date.now();
  const read = store.load({ signal: stop.signal });
  stop.abort();
  await assert.rejects(read, { name: 'AbortError' });
  assert.ok(Date.now() - began < 1000);
});

test('the signal is never part of the question', () => {
  const said = encodeQuery({ take: 2, signal: new AbortController().signal });
  assert.equal('signal' in said, false);
});
