/**
 * ONE NUMBER OFFERS NO AXIS — Will, TODO 696. A gauge draws one number: no
 * Primary, Group or Sort changes it, so its slot offers none, and its bar draws
 * no Organise chip. A chart that splits keeps all three. With no filter either,
 * its bar draws nothing, and its card's toggle goes (Will: A).
 *
 *   node --test test/unit/one-number-offers-no-axis.test.mjs
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { ArrayStore, bindSource, openSource } from '../../dist/data.js';
import { drawsNothing, organiseOf } from '../../dist/core/ui/filter-host.js';

const ROWS = [
  { id: 1, customer: 'Acme', status: 'active', score: 30 },
  { id: 2, customer: 'Bolt', status: 'trial', score: 70 },
];

/** A control the binder can steer: events in, nothing drawn. */
const control = () => Object.assign(new EventTarget(), {
  setAttribute() {}, removeAttribute() {}, hasAttribute: () => false, populate() {}, drawScope() {},
});

async function page() {
  const source = await openSource({
    store: 'people',
    fields: { customer: { label: 'Customer' }, status: { label: 'Status' }, score: { label: 'Score', type: 'number' } },
    scopes: { data: { offers: 'all' } },
  }, new ArrayStore(ROWS, { key: 'id' }));
  bindSource(source, control(), { scope: 'data' });
  bindSource(source, control(), { scope: 'by-status', rows: 'all', readonly: true, shows: { primary: 'customer' }, stacks: true });
  bindSource(source, control(), { scope: 'mean-score', rows: 'all', readonly: true, shows: {}, whole: true });
  await source.load();
  return source;
}

test('a gauge\'s slot offers no Primary, Group or Sort; its bar draws no Organise chip', async () => {
  const slot = (await page()).describe('mean-score');
  assert.equal(slot.presents, true);
  assert.equal(slot.whole, true);
  assert.equal(slot.chartFields, undefined);
  // Empty, not absent: its bar is told, so a Group or Sort it drew before goes.
  assert.deepEqual(slot.group, []);
  assert.deepEqual(organiseOf(slot), { group: [], sort: [] });
  assert.equal(drawsNothing(slot), true);
  // A legend in its bar is a filter there: something to draw.
  assert.equal(drawsNothing({ ...slot, filters: [{ id: 'health', field: 'health' }] }), false);
});

test('a chart that splits keeps its Primary, Group and order', async () => {
  const slot = (await page()).describe('by-status');
  assert.equal(slot.whole, undefined);
  const organise = organiseOf(slot);
  assert.equal(organise.order, true);
  assert.ok(organise.group.length > 0);
  assert.ok(organise.chart?.fields.length);
  assert.equal(drawsNothing(slot), false);
});
