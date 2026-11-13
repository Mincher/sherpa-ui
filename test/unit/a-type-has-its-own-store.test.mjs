/**
 * A TYPE HAS ITS OWN STORE — Will, plan 960 U3: a type and its rows make a store — local records made from the type,
 * seeded with the rows, its status fields worked out — and the seed's version is made from the rows, so changed rows are
 * a new seed and no one bumps a number. An app's types that name their rows each have one, by the type's id.
 *
 *   node --test test/unit/a-type-has-its-own-store.test.mjs
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { onReport, seedVersionOf, typeStore } from '../../dist/data.js';
const { typeStores } = await import('../../dist/core/browser/type-stores.js');

const DEVICE = {
  v: 1, id: 'device', label: 'Device', data: 'data/devices.json',
  fields: {
    id: {}, name: { label: 'Name', required: true }, risk: { type: 'number', label: 'Risk', min: 0, max: 100 },
    health: { type: 'status', label: 'Health', values: [{ value: 'At risk', status: 'critical', when: [{ risk: { gte: 70 } }] }, { value: 'Healthy' }] },
  },
};
const ROWS = [{ id: 'd1', name: 'Alpha', risk: 80 }, { id: 'd2', name: 'Bravo', risk: 10 }];

test('the seed\'s version is made from its rows: the same rows, the same number; a changed row, another', () => {
  assert.equal(seedVersionOf(ROWS), seedVersionOf(structuredClone(ROWS)));
  assert.notEqual(seedVersionOf(ROWS), seedVersionOf([{ ...ROWS[0], risk: 81 }, ROWS[1]]));
  assert.notEqual(seedVersionOf(ROWS), seedVersionOf([...ROWS].reverse()));
  assert.ok(Number.isInteger(seedVersionOf([])) && seedVersionOf([]) >= 0);
});

test('a type and its rows make its store: seeded, its rules on every write, its status fields worked out', async () => {
  const { store, ready } = typeStore(DEVICE, { rows: ROWS });
  await ready;
  const { rows } = await store.load({});
  assert.deepEqual(rows.map((r) => [r.id, r.health]), [['d1', 'At risk'], ['d2', 'Healthy']]);
  assert.equal(store.key, 'id');
  assert.equal(store.domains.name.label, 'Name', 'a page over it knows each field\'s words');
  await assert.rejects(store.insert({ id: 'd3', name: 'Charlie', risk: 120 }), /at most 100/);
});

test('an app\'s types that name their rows each have a store, by the type\'s id; rows that cannot be read are said', async () => {
  const files = { 'data/devices.json': ROWS, 'data/broken.json': null };
  const was = { fetch: globalThis.fetch, document: globalThis.document };
  globalThis.document = { baseURI: 'http://app.test/' };
  globalThis.fetch = async (url) => {
    const rows = files[new URL(url).pathname.slice(1)];
    return rows ? { ok: true, json: async () => rows } : { ok: false, status: 404 };
  };
  const said = [];
  const stop = onReport((r) => said.push(r));
  try {
    const types = { device: DEVICE, bare: { v: 1, id: 'bare', label: 'Bare', fields: { id: {} } }, broken: { ...DEVICE, id: 'broken', data: 'data/broken.json' } };
    const { stores, ready } = await typeStores(types, (path) => path);
    await ready;
    assert.deepEqual(Object.keys(stores), ['device']);
    assert.equal((await stores.device.load({})).total, 2);
  } finally {
    stop();
    Object.assign(globalThis, was);
  }
  assert.deepEqual(said.map((r) => r.code), ['type-data']);
  assert.match(said[0].message, /the rows of the type "broken" \(data\/broken\.json\) could not be read \(404\), so it has no store/);
});

test('a page that names its type may leave out its store: it reads its type\'s, by the type\'s id', async () => {
  const { storeOf, checkPage } = await import('../../dist/data.js');
  const { schemaCheck } = await import('../../scripts/lib/schema-check.mjs');
  assert.equal(storeOf({ type: 'device' }), 'device');
  assert.equal(storeOf({ store: 'devices', type: 'device' }), 'devices', 'its own store first');
  const page = (source) => ({ v: 1, id: 'p', source });
  assert.deepEqual(schemaCheck('page.v1.json')(page({ type: 'device' })), []);
  assert.ok(schemaCheck('page.v1.json')(page({ pageSize: 10 })).length, 'no store and no type');
  const said = [];
  const stop = onReport((r) => said.push(r.message));
  try {
    assert.equal(checkPage(page({ type: 'device' })), true);
    assert.equal(checkPage(page({ pageSize: 10 })), false);
  } finally {
    stop();
  }
  assert.match(said.join('\n'), /its source names no store and no type/);
});

test('a Context may name a type and no template: it is the type\'s own page; one with neither, or a type the app lacks, is a fault', async () => {
  const { checkApp } = await import('../../dist/data.js');
  const { typePage } = await import('../../dist/core/ui/type-page.js');
  const { schemaCheck } = await import('../../scripts/lib/schema-check.mjs');
  const app = (contexts) => ({ v: 1, default: 'devices', types: { device: 'types/device.json' }, contexts });
  const sound = app({ devices: { label: 'Devices', type: 'device' } });
  assert.deepEqual(schemaCheck('app.v1.json')(sound), []);
  const said = [];
  const stop = onReport((r) => said.push(r.message));
  try {
    assert.equal(checkApp(sound), true);
    assert.equal(checkApp(app({ devices: { label: 'Devices' } })), false);
    assert.equal(checkApp(app({ devices: { label: 'Devices', type: 'record' } })), false);
  } finally {
    stop();
  }
  assert.match(said.join('\n'), /the context "devices" has no template, and no type whose page it is/);
  assert.match(said.join('\n'), /the context "devices" names the type "record", which app\.json `types` does not list/);
  const { markup, definition } = typePage(DEVICE, 'devices');
  assert.match(markup, /<sherpa-quick-filter-toolbar data-scope="data">[\s\S]*<sherpa-data-grid id="grid" data-scope="data"[\s\S]*<sherpa-pagination slot="footer">/);
  assert.deepEqual(definition.source, { type: 'device', pageSize: 50, scopes: { data: { label: 'Device', offers: 'all', holds: ['health'] } } });
  assert.deepEqual(definition.ui.grid.columns.map((c) => c.field), ['name', 'risk', 'health']);
  assert.deepEqual(schemaCheck('page.v1.json')(definition), []);
});
