/**
 * A REQUEST BACK TO THE LAST ANSWER STILL RUNS WHILE ANOTHER IS IN FLIGHT.
 *
 * `load()` skips a request whose key matches the last COMPLETED load — an
 * honest no-op when nothing else is happening. But if a DIFFERENT load is in
 * flight, it will land and overwrite the answer, so the skip loses the
 * request for good.
 *
 * Found on the running page in Firefox: raising Status from the grid to the
 * header cleared the grid's selection (load in flight) and set the header's
 * part to the SAME clause the last finished load had. The second request was
 * skipped as "answered"; the in-flight one landed; 100 rows, no filter.
 *
 *   node --test test/unit/a-request-back-to-the-last-answer-still-runs.test.mjs
 *
 * TRAP T-in-flight-ticket-discards-stale
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { ArrayStore, DataSource } from '../../dist/data.js';

const ROWS = [
  { id: 1, status: 'active' },
  { id: 2, status: 'churned' },
  { id: 3, status: 'active' },
];

/** An ArrayStore whose loads land only when told to. */
class GatedStore extends ArrayStore {
  gates = [];
  async load(options) {
    const answer = await super.load(options);
    await new Promise((open) => this.gates.push(open));
    return answer;
  }
  openAll() { for (const open of this.gates.splice(0)) open(); }
}

const tick = () => new Promise((r) => setTimeout(r, 0));

test('back to the last finished answer, while a different load is in flight', async () => {
  const store = new GatedStore(ROWS, { key: 'id' });
  const src = new DataSource({ store, autoLoad: false });
  await src.ready;

  // 1. Filter to ACTIVE, and let that load finish.
  src.setFilter(['status', 'eq', 'active']);
  await tick(); store.openAll(); await tick(); await tick();
  assert.equal(src.total, 2);

  // 2. Clear it — that load is now IN FLIGHT and has not landed.
  src.setFilter(undefined);
  await tick();

  // 3. …and back to ACTIVE before it lands. Same key as step 1.
  src.setFilter(['status', 'eq', 'active']);
  await tick();

  // Let everything land, in order.
  store.openAll(); await tick(); await tick();
  store.openAll(); await tick(); await tick();

  // The LAST thing asked for is the answer — not the in-flight clear.
  assert.equal(src.total, 2, 'the request back to ACTIVE was skipped as "answered"');
  assert.deepEqual(src.rows.map((r) => r.id).sort(), [1, 3]);
});

test('the plain no-op is still a no-op — nothing in flight, same question', async () => {
  let loads = 0;
  class Counting extends ArrayStore {
    async load(options) { loads += 1; return super.load(options); }
  }
  const src = new DataSource({ store: new Counting(ROWS, { key: 'id' }) });
  await src.ready;
  await src.load();
  const before = loads;
  await src.load();
  assert.equal(loads, before, 'an identical request with nothing in flight should not reload');
});
