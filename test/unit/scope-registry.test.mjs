/**
 * A SCOPE IS A PLACE, NOT A REACH.
 *
 * Will, 2026-09-25: "Scoping of filters should live in the data layer." Two
 * controls must agree which surface holds a field, and NEITHER MAY KNOW THE
 * OTHER EXISTS — a panel that asked a toolbar what it held is a panel coupled
 * to a toolbar.
 *
 *   node --test test/unit/scope-registry.test.mjs
 *
 * TRAP T-a-scope-is-a-place-not-a-reach · TRAP T-three-things-called-scope
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { ArrayStore, DataSource } from '../../dist/data.js';

const ROWS = [
  { id: 1, owner: 'Dana', plan: 'Pro' },
  { id: 2, owner: 'Ravi', plan: 'Free' },
];

async function source() {
  const src = new DataSource({ store: new ArrayStore(ROWS, { key: 'id' }) });
  await src.ready;
  return src;
}

test('a scope holds fields, in the order it was given them', async () => {
  const src = await source();
  src.hold('view', ['customer', 'region']);
  src.hold('data', ['owner', 'plan']);

  assert.deepEqual(src.scope('view'), ['customer', 'region']);
  assert.deepEqual(src.scopes.sort(), ['data', 'view']);
  // A scope nobody named is empty, never undefined.
  assert.deepEqual(src.scope('nowhere'), []);
});

test('holds() answers for one scope; scopeOf() finds the owner', async () => {
  const src = await source();
  src.hold('view', ['customer']);
  src.hold('data', ['owner']);

  assert.equal(src.holds('view', 'customer'), true);
  assert.equal(src.holds('data', 'customer'), false);

  /* THIS IS WHAT SUPERSEDING IS. A field the view holds is not the data bar's
     to narrow — and neither bar has to know the other is there. */
  assert.equal(src.scopeOf('customer'), 'view');
  assert.equal(src.scopeOf('owner'), 'data');
  assert.equal(src.scopeOf('nobody'), null);
});

test('an empty list FORGETS a scope, and the answer is a copy', async () => {
  const src = await source();
  src.hold('data', ['owner']);
  const held = src.scope('data');
  held.push('tampered');
  // A caller cannot reach in through the answer.
  assert.deepEqual(src.scope('data'), ['owner']);

  src.hold('data', []);
  assert.deepEqual(src.scopes, []);
});

test('scope-change fires on a real change, and NOT on a no-op', async () => {
  const src = await source();
  let heard = 0;
  src.addEventListener('scope-change', () => { heard += 1; });

  src.hold('data', ['owner', 'plan']);
  assert.equal(heard, 1);

  // The same list again is not news — a bar re-renders on this event.
  src.hold('data', ['owner', 'plan']);
  assert.equal(heard, 1);

  src.hold('data', ['owner']);
  assert.equal(heard, 2);
});

test('debugState says everything the source thinks is true', async () => {
  const src = await source();
  src.declareField('plan', { type: 'text', label: 'Plan' });
  src.declareValues('owner', ['Dana', 'Ravi']);
  src.hold('data', ['owner']);
  src.setSort('owner', 'desc');
  src.select('owner', ['Dana']);
  await new Promise((r) => setTimeout(r, 40));

  const d = src.debugState();
  assert.equal(d.rows, 1);
  assert.equal(d.total, 1);
  assert.deepEqual(d.sort, [{ field: 'owner', direction: 'desc' }]);
  assert.deepEqual(d.scopes, { data: ['owner'] });
  assert.deepEqual(d.fields.plan, { type: 'text', label: 'Plan' });
  assert.equal(d.selections.owner.fieldState, 'active');
  assert.equal(d.loaded, true);
  /* A BUG REPORT SHOULD BE A PASTE, so it must survive JSON.
     TRAP T-a-bug-report-should-be-a-paste */
  assert.equal(typeof JSON.stringify(d), 'string');
});
