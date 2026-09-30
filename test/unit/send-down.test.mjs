/**
 * SEND A VIEW FILTER DOWN — TODO 120, the other way of "Send to view filters".
 * The View lets go of a field, and its answer goes to ONE scope: where it came
 * up from, or the only one that has it.
 *
 * TRAP T-send-to-view-filters
 *
 *   node --test test/unit/send-down.test.mjs
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

const core = new URL('../../dist/core/data/', import.meta.url);
const { ArrayStore } = await import(new URL('stores.js', core));
const { DataSource } = await import(new URL('data-source.js', core));

const ROWS = [
  { id: 1, plan: 'Pro', region: 'EMEA' }, { id: 2, plan: 'Free', region: 'EMEA' },
  { id: 3, plan: 'Pro', region: 'APAC' }, { id: 4, plan: 'Free', region: 'APAC' },
];
const tick = () => new Promise((r) => setTimeout(r, 0));

async function setup() {
  const source = new DataSource({ store: new ArrayStore(ROWS, { key: 'id' }) });
  source.declareField('plan', { label: 'Plan' });
  source.declareField('region', { label: 'Region' });
  source.declareValues('plan', ['Pro', 'Free']);
  source.declareValues('region', ['EMEA', 'APAC']);
  source.declareScope('view', { label: 'View filters' });
  source.declareScope('data', { label: 'Customer records' });
  source.offer('data', ['plan', 'region']);
  source.hold('view', ['region']);
  const seen = new Map();
  const stub = (name, more = {}) => Object.assign(new EventTarget(), {
    id: name, setAttribute() {}, removeAttribute() {}, hasAttribute: () => false,
    populate: (r) => seen.set(name, r.map((x) => x.id)), ...more,
  });
  const grid = stub('grid');
  const chart = stub('bar');
  const panel = stub('panel', { drawScopes() {}, drawReading() {} });
  source.bind(grid, { scope: 'data' });
  source.bind(chart, { rows: 'all', readonly: true });
  source.bind(panel, { steerOnly: true, scope: ['view', 'data'] });
  await source.load();
  const send = (scope, id, from) => panel.dispatchEvent(new CustomEvent('filter-add-request', {
    detail: { scope, ids: [id], from },
  }));
  const sendTo = (field) => source.describe('view').filters.find((f) => f.id === field)?.sendTo;
  return { source, seen, chart, send, sendTo };
}

test('a View field names each scope it may go down to — and the reader picks where there are two', async () => {
  const { source, chart, sendTo } = await setup();
  assert.deepEqual(sendTo('region'), [{ scope: 'data', label: 'Customer records' }]);
  // A chart's own scope has the field too: both are offered, and the source does not guess.
  source.declarePart('picks:bar', { field: 'region', only: chart, label: 'By region' });
  assert.deepEqual(sendTo('region'), [
    { scope: 'data', label: 'Customer records' }, { scope: 'picks:bar', label: 'By region' },
  ]);
  // A field no scope below has: nowhere to send it.
  source.declareField('owner', { label: 'Owner' });
  source.hold('view', ['region', 'owner']);
  assert.equal(sendTo('owner'), undefined);
});

test('SENT DOWN, the View lets go and the answer goes with the field', async () => {
  const { source, seen, send, sendTo } = await setup();
  source.answer('view', { region: { picked: ['EMEA'] } });
  await tick();
  send('data', 'region', 'view');
  await tick();
  assert.deepEqual(source.scope('view'), []);
  assert.deepEqual(source.scope('data'), ['region']);
  assert.deepEqual(source.query.applied.scopes.data.readings.region.picked, ['EMEA']);
  assert.equal(source.query.applied.scopes.view, undefined);
  assert.deepEqual(seen.get('grid'), [1, 2]);
  // It is the grid's now: nothing of the View's to send.
  assert.equal(sendTo('region'), undefined);
});

test('a field goes back down to where it CAME UP from — a chart\'s own scope — though another scope has it too', async () => {
  const { source, seen, chart, send, sendTo } = await setup();
  source.declarePart('picks:bar', { field: 'plan', only: chart, label: 'By plan' });
  source.write('picks:bar', 'plan', { picked: ['Pro'] });
  send('view', 'plan', 'picks:bar');
  await tick();
  assert.deepEqual(seen.get('grid'), [1, 3]);
  // Where it came UP from leads.
  assert.deepEqual(sendTo('plan'), [{ scope: 'picks:bar', label: 'By plan' }, { scope: 'data', label: 'Customer records' }]);

  send('picks:bar', 'plan', 'view');
  await tick();
  assert.deepEqual(source.scope('view'), ['region']);
  assert.deepEqual(source.query.applied.scopes['picks:bar'].readings.plan.picked, ['Pro']);
  // The chart alone again.
  assert.deepEqual(seen.get('bar'), [1, 3]);
  assert.deepEqual(seen.get('grid'), [1, 2, 3, 4]);
});

/* Will, TODO 168: "If I send a filter from component scope A to View scope
   then back to component scope B then the filter shows again in component
   scope A. A filter should only ever be in 1 scope at any time." */
test('A to the View to B: the field is in B alone, and A does not get it back', async () => {
  const { source, seen, send } = await setup();
  source.declareScope('other', { label: 'Other records' });
  source.offer('other', ['plan', 'region']);
  // A holds Plan, answered; it goes UP, and A keeps its place for it.
  source.hold('data', ['plan']);
  source.answer('data', { plan: { picked: ['Pro'] } });
  send('view', 'plan', 'data');
  await tick();
  assert.deepEqual(source.scope('view'), ['region', 'plan']);
  assert.deepEqual(source.scope('data'), ['plan']);

  // DOWN to B: every other scope lets go, and the answer lands in B.
  send('other', 'plan', 'view');
  await tick();
  assert.deepEqual(source.scope('view'), ['region']);
  assert.deepEqual(source.scope('data'), []);
  assert.deepEqual(source.scope('other'), ['plan']);
  assert.deepEqual(source.query.applied.scopes.other.readings.plan.picked, ['Pro']);
  assert.equal(source.query.applied.scopes.data, undefined);
  assert.deepEqual(seen.get('grid'), [1, 3]);
});
