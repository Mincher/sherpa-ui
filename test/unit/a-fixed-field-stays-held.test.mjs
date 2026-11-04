/**
 * A FIXED FIELD STAYS HELD, AND ONE ALWAYS ON STAYS ON — Will, TODO 703. A scope's
 * definition says, once, which fields it holds a reader cannot remove (`fixed`) and
 * which a reader cannot switch off (`alwaysOn`). Its chips say so, and every door of
 * the Query refuses the same: what a reader cannot do by pointer, no caller can.
 *
 *   node --test test/unit/a-fixed-field-stays-held.test.mjs
 *
 * TRAP T-a-fixed-field-stays-held
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { ArrayStore, bindSource, checkPage, onReport, openSource } from '../../dist/data.js';
import { schemaCheck } from '../../scripts/lib/schema-check.mjs';

const ROWS = [
  { id: 1, customer: 'Acme', region: 'EU', created: '2026-01-05', health: 'Good', plan: 'Pro' },
  { id: 2, customer: 'Acme', region: 'US', created: '2026-02-05', health: 'Poor', plan: 'Free' },
  { id: 3, customer: 'Globex', region: 'EU', created: '2026-03-05', health: 'Good', plan: 'Pro' },
];
const PAGE = {
  v: 1, id: 'p',
  source: {
    store: 'rows',
    fields: {
      customer: { label: 'Customer' }, region: { label: 'Region' }, created: { label: 'Date', type: 'date' },
      health: { label: 'Health' }, plan: { label: 'Plan' },
    },
    scopes: {
      view: {
        label: 'View Context', holds: ['customer', 'region', 'created', 'health'],
        fixed: ['customer', 'region', 'created'], alwaysOn: ['customer', 'region'],
      },
      data: { label: 'Rows', offers: 'all', holds: ['plan'] },
    },
  },
};
const settle = () => new Promise((res) => setTimeout(res, 20));
const bar = () => ({ populate() {}, setAttribute() {}, removeAttribute() {}, addEventListener() {}, removeEventListener() {} });

async function page() {
  const source = await openSource(PAGE.source, new ArrayStore(ROWS, { key: 'id' }));
  bindSource(source, bar(), { scope: 'view' });
  bindSource(source, bar(), { scope: 'data' });
  await source.load();
  await settle();
  return source;
}
/** What a door said, and what it did. */
function heard(fn) {
  const said = [];
  const stop = onReport((r) => said.push(r.code));
  try { fn(); } finally { stop(); }
  return said;
}
const holds = (source, scope = 'view') => source.query.scope(scope);
const off = (source, field) => !!source.query.reading('view', field)?.suspended;

test('the page schema and checkPage accept fixed and always-on fields its scope holds, and say each it does not', () => {
  const check = schemaCheck('page.v1.json');
  assert.deepEqual(check(PAGE), []);
  assert.notDeepEqual(check({ ...PAGE, source: { ...PAGE.source, scopes: { view: { holds: ['customer'], fixed: 'customer' } } } }), []);
  const said = [];
  const stop = onReport((r) => said.push([r.code, r.at?.field]));
  try {
    assert.equal(checkPage(PAGE), true);
    assert.deepEqual(said, []);
    const view = { ...PAGE.source.scopes.view, fixed: ['customer', 'owner'], alwaysOn: ['site'] };
    assert.equal(checkPage({ ...PAGE, source: { ...PAGE.source, scopes: { view } } }), false);
  } finally { stop(); }
  assert.deepEqual(said, [['fixed-field-not-held', 'owner'], ['always-on-field-not-held', 'site']]);
});

test('its chips say it: a fixed field has no Remove, one always on is so; the rest are as before', async () => {
  const source = await page();
  const drawn = source.describe('view').filters.map(({ id, removable, fixed, alwaysOn }) => ({ id, removable, fixed, alwaysOn }));
  assert.deepEqual(drawn, [
    { id: 'customer', removable: false, fixed: true, alwaysOn: true },
    { id: 'region', removable: false, fixed: true, alwaysOn: true },
    { id: 'created', removable: false, fixed: true, alwaysOn: undefined },
    { id: 'health', removable: true, fixed: undefined, alwaysOn: undefined },
  ]);
  assert.deepEqual(source.query.fixed('view'), ['customer', 'region', 'created']);
  assert.deepEqual(source.query.alwaysOn('view'), ['customer', 'region']);
});

test('no door of the Query lets a fixed field go; a field not fixed still goes', async () => {
  const source = await page();
  const all = ['customer', 'region', 'created', 'health'];
  assert.deepEqual(heard(() => source.query.ask({ scope: 'view', release: 'customer' })), ['field-fixed']);
  assert.deepEqual(heard(() => source.query.ask({ scope: 'view', hold: ['region', 'created', 'health'] })), ['field-fixed']);
  // Sent down to a scope that has it, or moved there: it stays.
  assert.deepEqual(heard(() => source.query.ask({ scope: 'data', take: ['created'], from: 'view' })), ['field-fixed']);
  assert.deepEqual(heard(() => source.query.ask({ scope: 'data', move: 'region', from: 'view' })), ['field-fixed']);
  assert.deepEqual(holds(source), all);
  assert.deepEqual(holds(source, 'data'), ['plan']);
  // Its order may change; it stays held.
  assert.deepEqual(heard(() => source.query.ask({ scope: 'view', hold: ['region', 'customer', 'created', 'health'] })), []);
  assert.deepEqual(heard(() => source.query.ask({ scope: 'view', release: 'health' })), []);
  assert.deepEqual(holds(source), ['region', 'customer', 'created']);
});

test('no door of the Query switches an always-on field off; its answer still moves, and a field not on still goes off', async () => {
  const source = await page();
  const ids = () => source.rows.map((r) => r.id);
  const act = async (fn) => {
    const said = heard(fn);
    source.query.ask({ commit: true });
    await source.load();
    await settle();
    return said;
  };
  await act(() => source.query.ask([
    { scope: 'view', field: 'customer', reading: { picked: ['Acme'] } },
    { scope: 'view', field: 'region', reading: { picked: ['EU', 'US'] } },
    { scope: 'view', field: 'health', reading: { picked: ['Good', 'Poor'] } },
  ]));
  assert.deepEqual(ids(), [1, 2]);
  // Its own off, and an answer that comes in off.
  assert.deepEqual(await act(() => source.query.ask({ scope: 'view', field: 'customer', suspended: true })), ['field-always-on']);
  assert.deepEqual(await act(() => source.query.ask({ scope: 'view', field: 'customer', reading: { picked: ['Globex'], suspended: true } })), ['field-always-on']);
  assert.equal(off(source, 'customer'), false);
  assert.deepEqual(source.query.reading('view', 'customer').picked, ['Globex']);
  assert.deepEqual(ids(), [3]);
  // The scope's Switch and a Solo pass it by: it stays on, and the rest go off.
  await act(() => source.query.ask({ scope: 'view', suspended: true }));
  assert.deepEqual({ customer: off(source, 'customer'), region: off(source, 'region'), health: off(source, 'health') },
    { customer: false, region: false, health: true });
  await act(() => source.query.ask({ scope: 'view', suspended: false }));
  await act(() => source.query.ask({ scope: 'view', solo: 'health' }));
  assert.deepEqual({ customer: off(source, 'customer'), region: off(source, 'region'), health: off(source, 'health') },
    { customer: false, region: false, health: false });
  await act(() => source.query.ask({ unsolo: true }));
  // A field not always on goes off, as before.
  assert.deepEqual(await act(() => source.query.ask({ scope: 'view', field: 'health', suspended: true })), []);
  assert.equal(off(source, 'health'), true);
});

test('a restore that let a fixed field go puts it back, leading; one that switched an always-on field off, on', async () => {
  const source = await page();
  await source.query.setQuery({ v: 1, scopes: { view: {
    holds: ['health', 'region'], readings: { customer: { picked: ['Acme'], suspended: true }, region: { picked: ['EU'], suspended: true } },
  } } });
  assert.deepEqual(holds(source), ['customer', 'region', 'created', 'health']);
  assert.equal(off(source, 'customer'), false);
  assert.equal(off(source, 'region'), false);
  assert.deepEqual(source.query.reading('view', 'region').picked, ['EU']);
});
