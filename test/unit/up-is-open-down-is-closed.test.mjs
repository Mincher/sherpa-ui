/**
 * UP IS OPEN, DOWN IS CLOSED.
 *
 * Will, 2026-09-25: "Any component field can be applied to the view scope as a
 * filter. Only component fields can be added to that component's scoped
 * filters." And: "A filter can't exist in both the view and component scope
 * so adding to one removes it from the other. However, the same filter can
 * exist across multiple component scopes."
 *
 * Four rules, not symmetric:
 *   UP is open                  any component's field may go to the view
 *   DOWN is closed              a component holds only its own fields
 *   VIEW/COMPONENT exclusive    raising it takes it out of every component
 *   COMPONENT/COMPONENT not     two grids may both filter `owner`
 *
 *   node --test test/unit/up-is-open-down-is-closed.test.mjs
 *
 * TRAP T-up-is-open-down-is-closed
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { ArrayStore, DataSource, VIEW_SCOPE, onReport } from '../../dist/data.js';

async function source() {
  const src = new DataSource({ store: new ArrayStore([], { key: 'id' }) });
  await src.ready;
  // Two components, each with its OWN fields. `owner` is in both.
  src.offer('grid', ['status', 'plan', 'owner']);
  src.offer('tickets', ['priority', 'owner']);
  return src;
}

test('the view is named once, and it is the same word as reach', () => {
  assert.equal(VIEW_SCOPE, 'view');
});

test('UP IS OPEN: the view may hold any field any component has', async () => {
  const src = await source();
  assert.deepEqual(src.fields(VIEW_SCOPE).sort(), ['owner', 'plan', 'priority', 'status']);
  assert.equal(src.canHold(VIEW_SCOPE, 'priority'), true);
});

test('DOWN IS CLOSED: a component may hold only its own fields', async () => {
  const src = await source();
  assert.deepEqual(src.fields('grid'), ['status', 'plan', 'owner']);
  assert.equal(src.canHold('grid', 'plan'), true);
  // `priority` is the tickets component's, not the grid's.
  assert.equal(src.canHold('grid', 'priority'), false);
});

test('RAISING a filter takes it out of EVERY component, in one event', async () => {
  const src = await source();
  src.hold('grid', ['owner', 'plan']);
  src.hold('tickets', ['owner']);
  const events = [];
  src.addEventListener('scope-change', (e) => events.push(e.detail));

  assert.equal(src.move('owner', 'grid', VIEW_SCOPE), true);

  assert.deepEqual(src.scope(VIEW_SCOPE), ['owner']);
  assert.deepEqual(src.scope('grid'), ['plan']);
  // The OTHER component loses it too: the view narrows them all.
  assert.deepEqual(src.scope('tickets'), []);
  // ONE event, so no listener ever sees `owner` in both places or in neither.
  assert.equal(events.length, 1);
  assert.deepEqual(events[0].scopes.sort(), ['grid', 'tickets', 'view']);
});

test('LOWERING it leaves the view and lands in one component', async () => {
  const src = await source();
  src.hold(VIEW_SCOPE, ['owner', 'status']);
  assert.equal(src.move('owner', VIEW_SCOPE, 'tickets'), true);
  assert.deepEqual(src.scope(VIEW_SCOPE), ['status']);
  assert.deepEqual(src.scope('tickets'), ['owner']);
  assert.deepEqual(src.scope('grid'), []);
});

test('COMPONENT and COMPONENT are NOT exclusive — both may hold `owner`', async () => {
  const src = await source();
  src.hold('grid', ['owner']);
  src.hold('tickets', ['owner']);
  assert.deepEqual(src.scope('grid'), ['owner']);
  assert.deepEqual(src.scope('tickets'), ['owner']);
});

test('a component REFUSES a field it does not have, and says so', async () => {
  const src = await source();
  src.hold(VIEW_SCOPE, ['priority']);
  const seen = [];
  const undo = onReport((r) => seen.push(r));
  const moved = src.move('priority', VIEW_SCOPE, 'grid');
  undo();

  assert.equal(moved, false);
  // Nothing changed: the refusal is not half a move.
  assert.deepEqual(src.scope(VIEW_SCOPE), ['priority']);
  assert.deepEqual(src.scope('grid'), []);
  assert.deepEqual(seen.map((r) => r.code), ['scope-refused']);
  assert.equal(seen[0].at.to, 'grid');
});

test('offer() on an unchanged list fires nothing — a bar re-renders on it', async () => {
  const src = await source();
  let fired = 0;
  src.addEventListener('scope-change', () => { fired += 1; });
  src.offer('grid', ['status', 'plan', 'owner']);
  assert.equal(fired, 0);
});

test('debugState says what each scope HAS as well as what it holds', async () => {
  const src = await source();
  src.hold('grid', ['plan']);
  const d = src.debugState();
  assert.deepEqual(d.offers.grid, ['status', 'plan', 'owner']);
  assert.deepEqual(d.scopes.grid, ['plan']);
});
