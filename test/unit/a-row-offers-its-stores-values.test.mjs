/**
 * A ROW OFFERS ITS STORE'S VALUES — plan 986 D1 A (Will, 2026-11-14: "the values in the condition node should be showing
 * all unique values from the 'user' sources 'name' field"; "a source node isn't directly a Data Source. It's the Data
 * Source via the Data Store in the Data Layer"). A field that declares no values offers those its store holds, through the
 * field catalogue's one read, at most 500; declared values still lead; a number or a date is a range, and offers none.
 * TRAP T-a-row-offers-its-stores-values
 *
 *   node --test test/unit/a-row-offers-its-stores-values.test.mjs
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ArrayStore, workflowGraph } from '../../dist/data.js';
import { MOST_OFFERED, withStoreValues } from '../../dist/core/data/field-catalogue.js';

const users = new ArrayStore([
  { id: 1, name: 'Bo', status: 'active', seats: 5 }, { id: 2, name: 'Ann', status: 'gone', seats: 9 },
  { id: 3, name: ['Cy', 'Ann'] }, { id: 4, name: null }, { id: 5, name: '' },
], { key: 'id' });
const fieldsOf = { users: { name: { label: 'Name' }, status: { label: 'Status', values: ['active', 'trial'] }, seats: { type: 'number' }, seen: { type: 'date' } } };
const storeOf = (id) => (id === 'users' ? users : undefined);

test('a field that declares no values takes its store\'s, each once, sorted; declared values lead; a range takes none', async () => {
  const filled = await withStoreValues(fieldsOf, storeOf);
  assert.deepEqual(filled.users.name, { label: 'Name', values: ['Ann', 'Bo', 'Cy'] });
  assert.deepEqual(filled.users.status, fieldsOf.users.status, 'declared values are kept, as declared');
  assert.deepEqual([filled.users.seats, filled.users.seen], [{ type: 'number' }, { type: 'date' }]);
  // What was given is left as it was.
  assert.equal(fieldsOf.users.name.values, undefined);
  // A store the app does not give: its fields as they are.
  assert.deepEqual((await withStoreValues({ other: { name: {} } }, storeOf)).other, { name: {} });
});

test('at most 500, and the store\'s own distinct is the read where it has one: no load', async () => {
  const many = new ArrayStore(Array.from({ length: 600 }, (_, i) => ({ id: i, code: `C${String(i).padStart(3, '0')}` })), { key: 'id' });
  const asked = [];
  const counted = Object.assign(Object.create(many), {
    distinct: (names) => { asked.push(names); return many.distinct ? many.distinct(names) : Promise.resolve({ code: [] }); },
    load: () => { throw new Error('no load where distinct answers'); },
  });
  const filled = await withStoreValues({ codes: { code: {} } }, () => counted);
  assert.deepEqual([MOST_OFFERED, filled.codes.code.values.length, filled.codes.code.values[0], asked], [500, 500, 'C000', [['code']]]);
});

test('a Condition on a Field of a store\'s undeclared field offers the store\'s values: Is one of lists the names', async () => {
  const w = {
    v: 3, id: 'names',
    nodes: [{ id: 's', kind: 'source', x: 0, y: 0, values: { store: 'users' } }, { id: 'f', kind: 'field', x: 300, y: 0, values: { field: 'name' } }, { id: 'c', kind: 'condition', x: 600, y: 0, values: { type: 'in', b: [] } }],
    connections: [{ from: 's/rows', to: 'f' }, { from: 'f/field', to: 'c' }],
  };
  const b = (facts) => workflowGraph(w, facts).nodes.find((n) => n.id === 'c').rows.find((r) => r.name === 'b');
  assert.deepEqual(b({ fieldsOf }).choices ?? [], [], 'undeclared, unread: no choices');
  assert.deepEqual(b({ fieldsOf: await withStoreValues(fieldsOf, storeOf) }).choices.map((c) => c.value), ['Ann', 'Bo', 'Cy']);
});
