/**
 * A FIELD DECLARES ITS CHILD — TODO 369. A Customer names its Site once, in the
 * page definition: `"customer": { "child": "site" }`. A child has no filter of
 * its own — its picks are in its parent's reading — so `offers: "all"` leaves
 * it out, and a scope that holds, offers or sets it is reported, as is a child
 * nobody declared or one under a number or a date.
 *
 *   node --test test/unit/a-field-declares-its-child.test.mjs
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { ArrayStore, checkTiers, onReport, openSource } from '../../dist/data.js';

const ROWS = [{ id: 1, customer: 'Northwind', site: 'London', seats: 5 }];
const FIELDS = { customer: { label: 'Customer', child: 'site' }, site: { label: 'Site' }, seats: { type: 'number' } };

/** The reports a check makes. */
function heard(fn) {
  const codes = [];
  const undo = onReport((r) => codes.push(r.code));
  try { fn(); } finally { undo(); }
  return codes;
}

test('offers "all" leaves the child out; a sound page reports nothing', async () => {
  const codes = [];
  const undo = onReport((r) => codes.push(r.code));
  let source;
  try {
    source = await openSource({ store: 'rows', fields: FIELDS, scopes: { data: { label: 'Rows', offers: 'all', holds: ['customer'] } } },
      new ArrayStore(ROWS, { key: 'id' }));
  } finally { undo(); }
  assert.deepEqual(codes, []);
  const offered = source.describe('data').available.map((f) => f.id ?? f.field);
  assert.ok(offered.includes('seats'));
  assert.ok(!offered.includes('site'), `site offered: ${offered}`);
  assert.deepEqual([...checkTiers({ fields: FIELDS })], ['site']);
});

test('a child nobody declared, one under a number or a date, and one a scope names are each reported', () => {
  assert.deepEqual(heard(() => checkTiers({ fields: { customer: { child: 'office' } } })), ['child-not-declared']);
  assert.deepEqual(heard(() => checkTiers({ fields: { seats: { type: 'number', child: 'site' }, site: {} } })), ['child-under-a-typed-field']);
  assert.deepEqual(heard(() => checkTiers({ fields: { made: { type: 'date', child: 'site' }, site: {} } })), ['child-under-a-typed-field']);
  const named = heard(() => checkTiers({ fields: FIELDS, scopes: {
    view: { holds: ['site'] },
    data: { offers: ['site'], sets: [{ id: 'where', fields: ['customer', 'site'] }] },
  } }));
  assert.deepEqual(named, ['child-field-named', 'child-field-named']);
});
