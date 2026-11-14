/**
 * A ROW TAKES ITS VALUE'S TYPE (plan 986, Will, 2026-11-14: "check all node input rows across all nodes to make sure
 * their options, or input type, makes sense"): a Value of a type takes that type's control; a Condition's Value B,
 * Start and End take the type of the field that reaches them, in a workflow and in a page's Query graph alike; a value
 * with choices keeps its pick. And a sweep of every row of every kind, so a new row that breaks the rule fails here.
 *
 * TRAP T-a-row-takes-its-values-type
 *
 *   node --test test/unit/a-row-takes-its-values-type.test.mjs
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { nodeKinds, queryGraph, readingsOf, workflowGraph } from '../../dist/data.js';
import { resolveKind } from '../../dist/core/data/node-kinds.js';

const fieldsOf = {
  customers: {
    seats: { label: 'Seats', type: 'number' },
    created: { label: 'Created', type: 'date' },
    name: { label: 'Name' },
    status: { label: 'Status', values: ['active', 'trial'] },
  },
};
/** Customers › a Field on `field` › a Condition of `op`. */
const flow = (field, op) => ({
  v: 3, id: 'w',
  nodes: [
    { id: 's', kind: 'source', x: 0, y: 0, values: { store: 'customers' } },
    { id: 'f', kind: 'field', x: 300, y: 0, values: { field } },
    { id: 'c', kind: 'condition', x: 600, y: 0, values: { type: op } },
  ],
  connections: [{ from: 's/rows', to: 'f' }, { from: 'f/field', to: 'c' }],
});
const controls = (graph, id) => Object.fromEntries(graph.nodes.find((n) => n.id === id).rows.filter((r) => r.control && r.name !== 'type').map((r) => [r.name, r.control]));

test('a Value takes its type\'s control: Integer and Decimal a number, Date a date, True/false a switch', () => {
  const value = nodeKinds()['value'];
  const of = (t) => resolveKind(value, t).rows.find((r) => r.name === 'value');
  assert.deepEqual(['text', 'integer', 'decimal', 'date', 'boolean'].map((t) => of(t).control), ['text', 'number', 'number', 'datetime', 'switch']);
  assert.equal(of('integer').step, 1, 'an Integer takes whole numbers');
});

test('a Condition\'s Value B, Start and End take the type of the field that reaches them; a value with choices keeps its pick', () => {
  assert.deepEqual(controls(workflowGraph(flow('seats', 'gt'), { fieldsOf }), 'c'), { b: 'number' });
  assert.deepEqual(controls(workflowGraph(flow('seats', 'between'), { fieldsOf }), 'c'), { start: 'number', end: 'number' });
  assert.deepEqual(controls(workflowGraph(flow('created', 'lt'), { fieldsOf }), 'c'), { b: 'datetime' });
  assert.deepEqual(controls(workflowGraph(flow('created', 'between'), { fieldsOf }), 'c'), { start: 'datetime', end: 'datetime' });
  assert.deepEqual(controls(workflowGraph(flow('name', 'eq'), { fieldsOf }), 'c'), { b: 'text' }, 'a text field: text');
  assert.deepEqual(controls(workflowGraph(flow('status', 'eq'), { fieldsOf }), 'c'), { b: 'values' }, 'its declared values: a pick');
  // Is one of is a list of the field's values, never a number.
  assert.deepEqual(controls(workflowGraph(flow('seats', 'in'), { fieldsOf }), 'c'), { b: 'tags' });
});

test('in a page\'s Query graph too: a test on a number field takes a number, on a date a date', () => {
  const page = { v: 1, id: 'p', source: { store: 'customers', fields: { seats: { label: 'Seats', type: 'number' }, created: { label: 'Created', type: 'date' } } } };
  const g = queryGraph({ v: 1, scopes: { view: { holds: ['seats', 'created'], readings: readingsOf({ seats: { gt: 5 }, created: { between: ['2024-01-01', '2024-12-31'] } }) } } }, page);
  const rows = (id) => Object.fromEntries(g.nodes.find((n) => n.id === id).rows.filter((r) => r.control && r.name !== 'type').map((r) => [r.name, r.control]));
  assert.deepEqual(rows('when-view-seats'), { b: 'number' });
  assert.deepEqual(rows('when-view-created'), { start: 'datetime', end: 'datetime' });
});

test('the sweep: every row of every kind takes a control its value fits', () => {
  const faults = [];
  for (const [id, kind] of Object.entries(nodeKinds())) {
    for (const t of kind.types ? Object.keys(kind.types) : [undefined]) {
      const at = t ? `${id}/${t}` : id;
      for (const row of (t ? resolveKind(kind, t) : kind).rows) {
        // A pick has its choices, or names where they come from.
        if (row.control === 'pick' && !row.choices?.length && !row.of) faults.push(`${at} ${row.name}: a pick with no choices`);
        // A value of the reaching field is a test's value: Value B, Start or End, not a list.
        if (row.ofField && !['b', 'start', 'end'].includes(row.name)) faults.push(`${at} ${row.name}: ofField on a row no test takes`);
        if (row.ofField && row.multiple) faults.push(`${at} ${row.name}: a list cannot take one value's type`);
        // A number takes a number, a date or a time a date, a yes or no a switch: never free text.
        if (row.gives === 'number' && row.control === 'text') faults.push(`${at} ${row.name}: a number as text`);
        if (row.gives === 'boolean' && row.control === 'text') faults.push(`${at} ${row.name}: a yes or no as text`);
        // A day is a date. A time of day (a Schedule's At) waits for a time control: plan 986.
        if (/^(until|date)$/.test(row.name) && row.control === 'text') faults.push(`${at} ${row.name}: a day as text`);
      }
    }
  }
  assert.deepEqual(faults, []);
});
