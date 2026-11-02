/**
 * A NUMBER'S EQUALS LISTS ITS VALUES — Will, TODO 668. An Advanced number keeps
 * the distinct values its rows hold, in number order, for its Equals rows. They
 * are kept apart from its domain, so it is still a number to every chip, count
 * and clause.
 *
 *   node --test test/unit/a-number-equals-lists-its-values.test.mjs
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { FieldCatalogue } from '../../dist/core/data/field-catalogue.js';

const ROWS = { seats: [10, 5, 10, 120, 5], spend: [300, 200] };
const read = async (fields) => Object.fromEntries(fields.map((f) => [f, ROWS[f] ?? []]));

test('an Advanced number lists its distinct values, in number order, apart from its options', async () => {
  const cat = new FieldCatalogue();
  cat.declare('seats', { type: 'number', advanced: true });
  await cat.fromRows(['seats'], read);
  const def = cat.filterDef('seats');
  assert.equal(def.kind, 'number');
  assert.deepEqual(def.listed?.map((o) => o.value), ['5', '10', '120']);
  // Never rows to tick: a host draws a menu's rows from its options.
  assert.equal(def.options, undefined);
  assert.deepEqual([def.min, def.max], [5, 120]);
  // Still a number everywhere else: no domain, no list chip.
  assert.deepEqual(cat.valuesFor('seats'), []);
  assert.equal(cat.isList('seats'), false);
});

test('a number with no Advanced rows lists nothing', async () => {
  const cat = new FieldCatalogue();
  cat.declare('spend', { type: 'number' });
  await cat.fromRows(['spend'], read);
  assert.equal(cat.filterDef('spend').listed, undefined);
});
