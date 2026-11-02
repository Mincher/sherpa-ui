/**
 * A LIST HAS A LIMIT — Will, plan 652 D10. A field with more values than a filter
 * lists (MOST_LISTED, 200) offers its Advanced conditions alone: measured, an Email
 * heading over 100k rows drew 100,001 menu rows. At the limit it is still a list.
 * TRAP T-a-list-has-a-limit
 *
 *   node --test test/unit/a-list-has-a-limit.test.mjs
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { FieldCatalogue, MOST_LISTED } from '../../dist/core/data/field-catalogue.js';

const emails = (n) => Array.from({ length: n }, (_, i) => `a${i}@example.com`);
const catalogue = async (n) => {
  const cat = new FieldCatalogue();
  cat.declare('email', { label: 'Email', advanced: true });
  await cat.fromRows(['email'], async () => ({ email: emails(n) }));
  return cat;
};

test('at the limit a field is a list, every value a row', async () => {
  const cat = await catalogue(MOST_LISTED);
  assert.equal(MOST_LISTED, 200);
  assert.equal(cat.filterDef('email').options?.length, MOST_LISTED);
  assert.equal(cat.isList('email'), true);
  assert.equal(cat.unlisted('email'), false);
});

test('over it, its filter is Advanced alone — contains — and it is no list', async () => {
  const cat = await catalogue(MOST_LISTED + 1);
  const def = cat.filterDef('email');
  assert.equal(def.options, undefined);
  assert.equal(def.advanced, 'only');
  assert.equal(def.op, 'contains');
  assert.equal(cat.isList('email'), false);
  assert.equal(cat.unlisted('email'), true);
});

test('a number or a date is never cut: they have no list', async () => {
  const cat = new FieldCatalogue();
  cat.declare('seen', { type: 'date' });
  cat.declareValues('seen', Array.from({ length: 300 }, (_, i) => `2026-01-${String((i % 28) + 1).padStart(2, '0')}T${i}`));
  assert.equal(cat.unlisted('seen'), false);
});
