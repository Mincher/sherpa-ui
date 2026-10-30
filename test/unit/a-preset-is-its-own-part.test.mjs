/**
 * A PRESET IS A WRAPPER ROUND ITS FIELDS' CONDITIONS — Will, TODOs 493 (A), 510
 * (A), 521, 526, 590. A scope's definition names its presets: the app's own
 * conditions, over several fields, each a boolean chip. On, it puts them on each
 * field, apart from its answer and ANDed with it, so a chip there shows them and
 * the field keeps its mode. It adds no chip. Off, it takes them off.
 *
 *   node --test test/unit/a-preset-is-its-own-part.test.mjs
 *
 * TRAP T-a-preset-is-its-own-part
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { ArrayStore, bindSource, openSource } from '../../dist/data.js';

const ROWS = [
  { id: 1, health: 40, tickets: 2, plan: 'pro' },
  { id: 2, health: 40, tickets: 0, plan: 'pro' },
  { id: 3, health: 90, tickets: 3, plan: 'free' },
  { id: 4, health: 50, tickets: 1, plan: 'free' },
];
const settle = () => new Promise((res) => setTimeout(res, 20));

async function page() {
  const source = await openSource({
    store: 'rows',
    fields: { health: { label: 'Health', type: 'number' }, tickets: { label: 'Tickets', type: 'number' }, plan: { label: 'Plan' } },
    scopes: {
      data: {
        label: 'Rows', holds: ['plan'],
        presets: [{ id: 'high-risk', label: 'High risk', where: { health: { lt: 60 }, tickets: { gt: 0 } } }],
      },
    },
  }, new ArrayStore(ROWS, { key: 'id' }));
  bindSource(source, { populate() {}, setAttribute() {}, removeAttribute() {}, addEventListener() {}, removeEventListener() {} }, { scope: 'data' });
  // The scope HAS these fields, as a grid's columns say: a preset's may be held here.
  source.query.offer('data', ['plan', 'health', 'tickets']);
  await source.load();
  await settle();
  return source;
}
const ids = (source) => source.rows.map((r) => r.id).sort();

const readings = (source) => source.query.applied.scopes.data.readings;
const on = (source) => source.describe('data').filters[0].active;
const act = async (source, fn) => {
  fn();
  source.query.commit({ scope: 'data' });
  await source.load();
  await settle();
};

test('a preset leads its scope as a boolean chip, off at the start', async () => {
  const source = await page();
  const [first, ...rest] = source.describe('data').filters;
  assert.deepEqual(first, { id: 'preset:high-risk', label: 'High risk', preset: true, active: false });
  assert.deepEqual(rest.map((f) => f.id), ['plan']);
  assert.deepEqual(ids(source), [1, 2, 3, 4]);
});

test('on, it puts its conditions on the fields, adds no chip, and never goes Advanced; off takes them away', async () => {
  const source = await page();
  await act(source, () => source.query.setPreset('data', 'high-risk', true));
  assert.deepEqual(ids(source), [1, 4]);
  assert.equal(on(source), true);
  assert.deepEqual(readings(source).health.byPreset, { 'high-risk': { label: 'High risk', scope: 'data', rows: [{ op: 'lt', text: '60' }] } });
  assert.deepEqual(readings(source).tickets.byPreset['high-risk'].rows, [{ op: 'gt', text: '0' }]);
  assert.equal(readings(source).health.mode, undefined);
  assert.equal(readings(source).health.conditions, undefined);
  assert.deepEqual(source.describe('data').filters.map((f) => f.id), ['preset:high-risk', 'plan']);
  // A field's own answer narrows beside them.
  await act(source, () => source.query.setReading('data', 'plan', { picked: ['free'] }));
  assert.deepEqual(ids(source), [4]);
  await act(source, () => source.query.setPreset('data', 'high-risk', false));
  assert.deepEqual(ids(source), [3, 4]);
  assert.equal(on(source), false);
  assert.equal(readings(source).health, undefined);
  assert.equal(readings(source).tickets, undefined);
  assert.deepEqual(source.describe('data').filters.map((f) => f.id), ['preset:high-risk', 'plan']);
});

test('its rows are ANDed with a field\'s own; off, the field\'s own is all that is left', async () => {
  const source = await page();
  await act(source, () => source.query.setReading('data', 'tickets', { op: 'gt', text: '1' }));
  assert.deepEqual(ids(source), [1, 3]);
  await act(source, () => source.query.setPreset('data', 'high-risk', true));
  assert.deepEqual(ids(source), [1]);
  // The reader's answer and its mode stay as they were, beside the preset's.
  assert.deepEqual(readings(source).tickets.conditions, undefined);
  assert.equal(readings(source).tickets.text, '1');
  assert.equal(readings(source).tickets.mode, undefined);
  await act(source, () => source.query.setPreset('data', 'high-risk', false));
  assert.deepEqual(ids(source), [1, 3]);
  assert.equal(readings(source).tickets.text, '1');
  assert.equal(readings(source).tickets.byPreset, undefined);
  assert.ok(source.describe('data').filters.some((f) => f.id === 'tickets'));
});

test('a reader\'s answer on its field, or a clear of it, leaves it on; the Switch shows it off while the fields are off; Reset takes it off', async () => {
  const source = await page();
  await act(source, () => source.query.setPreset('data', 'high-risk', true));
  await act(source, () => source.query.setReading('data', 'health', { conditions: [{ op: 'lt', text: '50' }], mode: 'advanced' }));
  assert.equal(on(source), true);
  assert.deepEqual(ids(source), [1]);
  await act(source, () => source.query.setReading('data', 'health', null));
  assert.equal(on(source), true);
  assert.deepEqual(ids(source), [1, 4]);
  source.query.suspend('data', null, true);
  await source.load();
  await settle();
  assert.deepEqual(ids(source), [1, 2, 3, 4]);
  assert.equal(on(source), false);
  source.query.suspend('data', null, false);
  await source.load();
  await settle();
  assert.equal(on(source), true);
  await act(source, () => source.query.reset(['data']));
  assert.deepEqual(ids(source), [1, 2, 3, 4]);
  assert.equal(on(source), false);
});

test('on a field no scope holds, its reading is read where it sits: the state says on, not off (Will, TODO 611)', async () => {
  const source = await page();
  assert.equal(source.query.scopeOf('tickets'), null);
  await act(source, () => source.query.setPreset('data', 'high-risk', true));
  assert.equal(source.selection('tickets').fieldState, 'active');
  // Still its scope's alone: it never moved to the View.
  assert.ok(source.query.applied.scopes.data.readings.tickets);
  assert.equal(source.query.applied.scopes.view?.readings.tickets, undefined);
  await act(source, () => source.query.setPreset('data', 'high-risk', false));
  assert.equal(source.selection('tickets').fieldState, 'off');
});
