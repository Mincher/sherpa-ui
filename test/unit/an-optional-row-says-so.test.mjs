/**
 * AN OPTIONAL ROW SAYS SO — Will, 2026-11-14, TODO 984: "For optional inputs like Values in a Field Node we should
 * append (Optional) to the input title label." One rule, `rowTitle`: the row drawn, its socket's tip and a node's
 * Incoming and Outgoing JSON read it. Its name, its connections and its warnings keep its label.
 *
 *   node --test test/unit/an-optional-row-says-so.test.mjs
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { nodeKinds } from '../../dist/data.js';
import { rowTitle } from '../../dist/core/data/node-kinds.js';
import { START, START_KIND } from '../../dist/core/data/node-start.js';

/** Every row of every kind the library ships, the Start's too: its own, and each of its types'. */
const everyRow = () => Object.entries({ ...nodeKinds(), [START]: START_KIND }).flatMap(([id, kind]) => [
  ...kind.rows.map((row) => [id, row]),
  ...Object.values(kind.types ?? {}).flatMap((type) => (type.rows ?? []).map((row) => [id, row])),
]);

test('a Field\'s Values is titled "Values (Optional)"; its name and label stay', () => {
  const values = nodeKinds().field.rows.find((r) => r.name === 'values');
  assert.equal(rowTitle(values), 'Values (Optional)');
  assert.deepEqual([values.name, values.label], ['values', 'Values']);
});

test('every optional row of every kind says so, and no other row does', () => {
  const said = everyRow().map(([id, row]) => [id, row.name, rowTitle(row).endsWith(' (Optional)'), !!row.optional]);
  assert.deepEqual(said.filter(([, , says, optional]) => says !== optional), []);
  assert.ok(said.some(([id, name, says]) => id === 'source' && name === 'fields' && says), 'a Source\'s Fields');
  assert.ok(said.some(([id, name, says]) => id === START && name === 'model' && says), 'the Start\'s Model');
  assert.ok(said.some(([id, name, says]) => id === 'condition' && name === 'a' && says), 'a Condition\'s Value A');
});
