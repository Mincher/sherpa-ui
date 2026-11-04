/**
 * AN OVERTAKEN LOAD ANSWERS WITH THE NEWEST. `await source.load()` overtaken by a
 * newer ask, whichever store read lands first, resolves with the rows the source
 * then shows — never the rows from before both. TODO 706
 *
 *   node --test test/unit/an-overtaken-load-answers-with-the-newest.test.mjs
 *
 * TRAP T-an-asked-load-is-awaited
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ArrayStore, DataSource } from '../../dist/data.js';

const ROWS = [{ id: 1, status: 'active' }, { id: 2, status: 'churned' }, { id: 3, status: 'active' }];
const tick = () => new Promise((done) => setTimeout(done, 0));
const ids = (result) => result?.rows.map((row) => row.id).join(',');

/** An ArrayStore whose reads, once gated, land only when released. */
class Gated extends ArrayStore {
  gate = false;
  held = [];
  async load(options) {
    const answer = await super.load(options);
    if (this.gate) await new Promise((open) => this.held.push({ filter: options.filter ?? null, open }));
    return answer;
  }
  release(i) { this.held.splice(i, 1)[0].open(); }
}

const picked = (source, values) => source.query.ask({ scope: 'view', field: 'status', reading: { picked: values } });

/** Churned is shown; A (no filter) is asked, then B (active) overtakes it. */
async function race() {
  const store = new Gated(ROWS, { key: 'id' });
  const source = new DataSource({ store, autoLoad: false });
  await source.ready;
  picked(source, ['churned']);
  await source.load();
  assert.equal(ids(source.result), '2');
  store.gate = true;
  const answers = {};
  picked(source, []);
  const a = source.load().then((r) => (answers.a = r));
  await tick();
  picked(source, ['active']);
  const b = source.load().then((r) => (answers.b = r));
  await tick();
  assert.deepEqual(store.held.map((h) => h.filter), [null, ['status', 'eq', 'active']], 'A then B are in the store');
  return { store, source, answers, both: Promise.all([a, b]) };
}

test('A lands first: its awaited load waits for B, and answers with B\'s rows', async () => {
  const { store, source, answers, both } = await race();
  store.release(0);
  await tick(); await tick();
  assert.equal(answers.a, undefined, 'A answered before the load that overtook it landed');
  store.release(0);
  await both;
  assert.equal(ids(answers.a), '1,3');
  assert.equal(ids(answers.b), '1,3');
  assert.equal(ids(source.result), '1,3');
});

test('B lands first: A answers with B\'s rows when its own read lands', async () => {
  const { store, source, answers, both } = await race();
  store.release(1);
  await tick(); await tick();
  assert.equal(ids(answers.b), '1,3');
  store.release(0);
  await both;
  assert.equal(ids(answers.a), '1,3');
  assert.equal(ids(source.result), '1,3');
});
