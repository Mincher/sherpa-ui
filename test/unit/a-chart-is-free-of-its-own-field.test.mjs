/**
 * A CHART IS FREE OF ITS OWN FIELD — Will, TODO 479. A gauge over its field's
 * zones is never narrowed by that field: its rows are the View's less any
 * clause on it, so the needle stays; the picks only light its zones. The View's
 * other filters still narrow it.
 *
 *   node --test test/unit/a-chart-is-free-of-its-own-field.test.mjs
 *
 * TRAP T-a-chart-is-free-of-its-own-field
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { ArrayStore, bindId, bindSource, openSource, statusFields } from '../../dist/data.js';
import { filterWithout } from '../../dist/core/data/store.js';

/** Health, worked out from the score: the gauge's zones (plan 683). */
const HEALTH = {
  type: 'status',
  values: [
    { value: 'At risk', status: 'critical', when: [{ score: { lt: 60 } }] },
    { value: 'Watch', status: 'warning', when: [{ score: { lt: 80 } }] },
    { value: 'Healthy', status: 'success' },
  ],
};
const ROWS = [
  { id: 1, score: 50, region: 'EMEA' }, { id: 2, score: 70, region: 'EMEA' },
  { id: 3, score: 90, region: 'EMEA' }, { id: 4, score: 95, region: 'APAC' },
];
const settle = () => new Promise((res) => setTimeout(res, 20));

test('a filter less a field: an and drops its parts on it; an or goes only when all of it is that field', () => {
  const health = ['health', 'lt', 60];
  const region = ['region', 'eq', 'EMEA'];
  assert.deepEqual(filterWithout(['and', health, region], new Set(['health'])), region);
  assert.equal(filterWithout(health, new Set(['health'])), undefined);
  assert.deepEqual(filterWithout(['or', health, region], new Set(['health'])), ['or', health, region]);
  assert.equal(filterWithout(['or', health, ['health', 'gte', 80]], new Set(['health'])), undefined);
  assert.deepEqual(filterWithout(['and', ['and', health, region], ['region', 'ne', 'APAC']], new Set(['health'])),
    ['and', region, ['region', 'ne', 'APAC']]);
});

test('a chart free of its field is narrowed by the View\'s other filters, never by its own; its picks are told', async () => {
  const source = await openSource({
    store: 'rows',
    fields: { health: { label: 'Health', select: 'multiple' }, region: { label: 'Region', start: 'all' } },
    scopes: { view: { label: 'View', holds: ['region', 'health'] } },
  }, statusFields(new ArrayStore(ROWS, { key: 'id' }), { health: HEALTH }));
  const seen = [];
  const gauge = { populate(d) { seen.push(d.map((r) => r.id)); }, setAttribute() {}, removeAttribute() {}, addEventListener() {}, removeEventListener() {} };
  const grid = { populate() {}, setAttribute() {}, removeAttribute() {}, addEventListener() {}, removeEventListener() {} };
  bindSource(source, grid, {});
  bindSource(source, gauge, { rows: 'all', readonly: true, free: ['health'] });
  await source.load();
  await settle();
  source.query.ask({ scope: 'view', field: 'health', reading: { picked: ['At risk'] } });
  source.query.ask({ scope: 'view', field: 'region', reading: { picked: ['EMEA'] } });
  source.query.ask({ commit: true });
  await source.load();
  await settle();
  // The page is narrowed by both; the gauge by Region alone.
  assert.equal(source.debugState().total, 1);
  assert.deepEqual(seen.at(-1), [1, 2, 3]);
  assert.deepEqual(source.pickedFor(bindId(gauge), 'health'), ['At risk']);
});

test('only picks in force are lit: none while the field is Advanced or says "is not" (TODO 518)', async () => {
  const { ArrayStore: Store, DataSource, VIEW } = await import('../../dist/data.js');
  const source = new DataSource({ store: new Store([{ id: 1, plan: 'Pro' }, { id: 2, plan: 'Free' }], { key: 'id' }) });
  const chart = Object.assign(new EventTarget(), { setAttribute() {}, removeAttribute() {}, hasAttribute: () => false, populate() {} });
  bindSource(source, chart, { scope: 'chart', rows: 'all', readonly: true, free: ['plan'] });
  source.query.ask({ scope: VIEW, hold: ['plan'] });
  source.query.ask({ scope: VIEW, field: 'plan', reading: { picked: ['Pro'] } });
  assert.deepEqual(source.pickedFor(bindId(chart), 'plan'), ['Pro']);
  source.query.ask({ scope: VIEW, field: 'plan', reading: { picked: ['Pro'], mode: 'advanced', tree: { op: 'eq', value: 'Free' } } });
  assert.deepEqual(source.pickedFor(bindId(chart), 'plan'), [], 'Advanced is in force, not the Simple picks');
  source.query.ask({ scope: VIEW, field: 'plan', reading: { op: 'ne', picked: ['Pro'] } });
  assert.deepEqual(source.pickedFor(bindId(chart), 'plan'), [], '"is not Pro" lights no Pro');
});
