/**
 * A SERVER FIELD IS ASKED ONCE PER ANSWER — 345 phase 6. A field marked
 * `fetch: 'server'` is answered by the store: its Apply asks once for the keys
 * it matches, and the source filters what it holds by them. Off and on again
 * ask nothing; a new answer asks again. Only a set held HERE needs the keys: a
 * store read straight answers the clause in its load (TODO 707).
 * TRAP T-a-server-field-is-asked-once-per-answer
 *
 *   node --test test/unit/a-server-field-is-asked-once.test.mjs
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { ArrayStore, DataSource, bindSource, fakeRemote } from '../../dist/data.js';

const ROWS = Array.from({ length: 10 }, (_, i) => ({ id: i + 1, seats: (i + 1) * 10 }));
const settle = () => new Promise((r) => setTimeout(r, 10));

test('Apply asks the store once for the keys; off and on ask nothing; a new answer asks again', async () => {
  const inner = new ArrayStore(ROWS, { key: 'id' });
  const asked = [];
  const load = inner.load.bind(inner);
  inner.load = (o) => { asked.push(o?.filter ?? null); return load(o); };
  const source = new DataSource({ store: fakeRemote(inner, { delay: 0 }) });
  source.declareField('seats', { type: 'number', fetch: 'server' });
  assert.equal(source.filterDef('seats').commit, true, 'its menus have Apply');
  await source.load();
  const before = asked.length;
  source.query.ask({ scope: 'data', hold: ['seats'] });
  source.query.ask({ scope: 'data', field: 'seats', reading: { mode: 'advanced', tree: { op: 'gt', value: '70' } } });
  source.query.ask({ field: 'seats', commit: true });
  await settle();
  await source.load();
  assert.deepEqual(asked.slice(before), [['seats', 'gt', 70]], 'one ask, for its own clause');
  assert.deepEqual(source.rows.map((r) => r.id), [8, 9, 10]);
  source.query.ask({ scope: 'data', field: 'seats', suspended: true });
  source.query.ask({ field: 'seats', commit: true });
  await settle();
  source.query.ask({ scope: 'data', field: 'seats', suspended: false });
  source.query.ask({ field: 'seats', commit: true });
  await settle();
  await source.load();
  assert.equal(asked.length, before + 1, 'off and on again: no ask');
  assert.deepEqual(source.rows.map((r) => r.id), [8, 9, 10]);
  source.query.ask({ scope: 'data', field: 'seats', reading: { mode: 'advanced', tree: { op: 'gt', value: '90' } } });
  source.query.ask({ field: 'seats', commit: true });
  await settle();
  await source.load();
  assert.equal(asked.length, before + 2, 'a new answer asks again');
  assert.deepEqual(source.rows.map((r) => r.id), [10]);
});

test('a bound grid hears the server FIELD filters, not the key its answer matched (TODO 393)', async () => {
  const source = new DataSource({ store: new ArrayStore(ROWS.map((r) => ({ ...r, plan: r.id > 5 ? 'Pro' : 'Free' })), { key: 'id' }) });
  source.declareField('plan', { label: 'Plan', fetch: 'server' });
  const attrs = {};
  const grid = Object.assign(new EventTarget(), {
    setAttribute: (n, v) => { attrs[n] = v; }, removeAttribute: (n) => { delete attrs[n]; }, toggleAttribute() {},
  });
  bindSource(source, grid);
  await source.load();
  source.query.ask({ scope: 'data', hold: ['plan'] });
  source.query.ask({ scope: 'data', field: 'plan', reading: { picked: ['Pro'] } });
  source.query.ask({ field: 'plan', commit: true });
  await settle();
  await source.load();
  assert.deepEqual(source.rows.map((r) => r.id), [6, 7, 8, 9, 10]);
  assert.equal(attrs['data-filter-fields'], 'plan');
});

test('read straight, a server field asks for no keys: one load per Apply, the same rows, and a new row shows (TODO 707)', async () => {
  const pages = {
    'a local store': (inner) => ({ store: inner }),
    'a remote store it holds none of': (inner) => ({ store: fakeRemote(inner, { delay: 0 }), holdRows: 0 }),
  };
  for (const [name, made] of Object.entries(pages)) {
    const inner = new ArrayStore(ROWS, { key: 'id' });
    const asked = [];
    const load = inner.load.bind(inner);
    inner.load = (o) => { asked.push(o ?? {}); return load(o); };
    const options = made(inner);
    const source = new DataSource(options);
    source.declareField('seats', { type: 'number', fetch: 'server' });
    await source.load();
    source.query.ask({ scope: 'data', hold: ['seats'] });
    await settle();
    let loads = 0;
    source.addEventListener('loading', (e) => { if (e.detail.loading) loads++; });
    asked.length = 0;
    source.query.ask([{ scope: 'data', field: 'seats', reading: { mode: 'advanced', tree: { op: 'gt', value: '70' } } }, { field: 'seats', commit: true }]);
    await settle();
    assert.deepEqual(source.rows.map((r) => r.id), [8, 9, 10], `${name}: the rows`);
    assert.deepEqual(asked.map((o) => o.filter), [['seats', 'gt', 70]], `${name}: one read, its own clause — no keys asked`);
    assert.equal(loads, 1, `${name}: one load`);
    // No keys kept: a row its answer matches shows when it lands.
    await options.store.insert({ id: 11, seats: 110 });
    await settle();
    await source.load();
    assert.deepEqual(source.rows.map((r) => r.id), [8, 9, 10, 11], `${name}: a new row shows`);
  }
});
