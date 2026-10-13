/**
 * A LIVE FILTER — Will, TODO 107. A source with `applyOn: 'input'` loads once
 * the moves stop, `debounce` ms after the last; the default still loads on the
 * tick. A remote source always waits for Apply.
 *
 *   node --test test/unit/a-live-filter-waits-for-the-moves-to-stop.test.mjs
 *
 * TRAP T-coalesce-microtask-not-debounce
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import Ajv2020 from 'ajv/dist/2020.js';

import { ArrayStore, DataSource } from '../../dist/data.js';
import { openSource } from '../../dist/core/data/page-definition.js';

const ROWS = Array.from({ length: 20 }, (_, i) => ({ id: i + 1, seats: i * 10 }));
const wait = (ms) => new Promise((done) => setTimeout(done, ms));

/** A store that counts its loads. */
function counted(extra = {}) {
  const store = Object.assign(new ArrayStore(ROWS, { key: 'id' }), extra);
  const load = store.load.bind(store);
  store.loads = 0;
  store.load = (options) => { store.loads += 1; return load(options); };
  return store;
}

const move = (source, n) => source.select('seats', [0, n], { range: true });

test('live: five moves, one load — once the moves stop', async () => {
  const store = counted();
  const source = new DataSource({ store, applyOn: 'input', debounce: 30 });
  source.declareField('seats', { type: 'number' });
  await source.load();
  const before = store.loads;
  for (const n of [10, 20, 30, 40, 50]) {
    move(source, n);
    await wait(5);
  }
  assert.equal(store.loads, before, 'nothing while it moves');
  await wait(60);
  assert.equal(store.loads, before + 1);
  assert.equal(source.debugState().total, 6);
});

test('the default loads on the tick, as before', async () => {
  const store = counted();
  const source = new DataSource({ store });
  source.declareField('seats', { type: 'number' });
  await source.load();
  const before = store.loads;
  move(source, 10);
  await wait(0);
  assert.equal(store.loads, before + 1);
  assert.equal(source.applyOn, 'change');
});

test('a remote source is never live', () => {
  const source = new DataSource({ store: counted({ remote: true }), applyOn: 'input' });
  assert.equal(source.applyOn, 'change');
});

test('the page JSON says it per source, and the schema takes it', async () => {
  const def = { store: 'records', applyOn: 'input', debounce: 120, fields: { seats: { type: 'number' } } };
  const source = await openSource(def, counted());
  assert.equal(source.applyOn, 'input');
  const Ajv = Ajv2020.default ?? Ajv2020;
  const schema = JSON.parse(await readFile(new URL('../../schemas/page.v1.json', import.meta.url), 'utf8'));
  const check = new Ajv({ allErrors: true }).compile(schema);
  assert.ok(check({ v: 1, id: 'p', source: def }), JSON.stringify(check.errors));
});
