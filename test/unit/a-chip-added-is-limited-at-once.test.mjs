/**
 * A CHIP ADDED IS LIMITED AT ONCE — TODO 981 (found building 554). A field a reader adds to a bar is told what the filters
 * before it leave as soon as it is held, not at the next pick: a hold moves no row, so no load walks again for it, and
 * the source asks the walk itself. Any field, not only one the View fixes.
 *
 *   node --test test/unit/a-chip-added-is-limited-at-once.test.mjs
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { ArrayStore, bindSource, openSource } from '../../dist/data.js';

const ROWS = [
  { id: 1, customer: 'Acme', health: 'Good', plan: 'Pro' },
  { id: 2, customer: 'Acme', health: 'Poor', plan: 'Free' },
  { id: 3, customer: 'Globex', health: 'Fair', plan: 'Pro' },
];
const DEF = {
  store: 'rows',
  fields: Object.fromEntries(['customer', 'health', 'plan'].map((f) => [f, { label: f, start: 'all' }])),
  scopes: { view: { label: 'View Context', holds: ['customer'] }, data: { label: 'Rows', offers: 'all', holds: ['plan'] } },
};
const settle = () => new Promise((res) => setTimeout(res, 30));
/** A bar that keeps what it is told each field may offer, and how often. */
const bar = () => Object.assign(new EventTarget(), {
  present: {}, told: 0, populate() {}, setAttribute() {}, removeAttribute() {}, toggleAttribute() {}, drawScope() {}, supersede() {},
  drawPresent(present) { this.present = present; this.told++; },
});

test('a field added to a bar is told what the View leaves it at once, with no pick and no load', async () => {
  const store = new ArrayStore(ROWS, { key: 'id' });
  const source = await openSource(DEF, store);
  const cards = bar();
  bindSource(source, bar(), { scope: 'view' });
  bindSource(source, cards, { scope: 'data' });
  source.query.ask({ scope: 'view', field: 'customer', reading: { picked: ['Acme'] } });
  await source.load();
  await settle();
  assert.deepEqual([...cards.present.plan].sort(), ['Free', 'Pro']);
  const told = cards.told;
  source.query.ask({ scope: 'data', hold: ['plan', 'health'] });
  await settle();
  assert.ok(cards.told > told, 'told again');
  assert.deepEqual([...cards.present.health].sort(), ['Good', 'Poor'], 'what the View leaves, not Fair');
});
