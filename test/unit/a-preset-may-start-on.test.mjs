/**
 * A PRESET MAY START ON — Will, plan 963: "a preset filter on of 'Does not contain: Customer = Organisation' … This
 * will hide the Org users by default". A preset that says `on: true` is ticked when its page opens, its rows held from
 * the first load, through the preset door, so it reads on; the reader may untick it; and a Reset ticks it again, as a
 * start answer comes back.
 *
 *   node --test test/unit/a-preset-may-start-on.test.mjs
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { ArrayStore, openSource } from '../../dist/data.js';
const { schemaCheck } = await import('../../scripts/lib/schema-check.mjs');

const ROWS = [
  { id: 'u1', name: 'Ana', customers: ['Contoso'] },
  { id: 'u2', name: 'Bo', customers: ['Organisation'] },
  { id: 'u3', name: 'Cy', customers: ['Fabrikam', 'Organisation'] },
];
const SOURCE = {
  store: 'users',
  fields: { customers: { label: 'Customers', select: 'multiple' } },
  scopes: {
    view: {
      label: 'View', holds: ['customers'],
      presets: [{ id: 'not-organisation', label: 'Not the Organisation', where: { customers: { ne: 'Organisation' } }, on: true }],
    },
  },
};

test('a preset that says on is ticked at the start, its rows held; untick it and they come back', async () => {
  assert.deepEqual(schemaCheck('page.v1.json')({ v: 1, id: 'users', source: SOURCE }), []);
  const source = await openSource(SOURCE, new ArrayStore(ROWS));
  await source.load();
  assert.equal(source.query.presetOn('view', 'not-organisation', true), true, 'it reads on: its marks are there');
  assert.deepEqual(source.rows.map((r) => r.id), ['u1'], 'no row that holds the Organisation, a list cell too');
  source.query.ask({ scope: 'view', preset: 'not-organisation', on: false, commit: true });
  await source.load();
  assert.equal(source.query.presetOn('view', 'not-organisation', true), false);
  assert.equal(source.total, 3);
  source.dispose?.();
});

test('a Reset ticks it again, as a start answer comes back', async () => {
  const source = await openSource(SOURCE, new ArrayStore(ROWS));
  await source.load();
  source.query.ask({ scope: 'view', preset: 'not-organisation', on: false, commit: true });
  source.query.ask({ scope: 'view', reset: {}, commit: true });
  await source.load();
  assert.equal(source.query.presetOn('view', 'not-organisation', true), true);
  assert.equal(source.total, 1);
  source.dispose?.();
});
