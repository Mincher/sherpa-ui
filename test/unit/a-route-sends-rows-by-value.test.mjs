/**
 * A ROUTE SENDS ROWS BY VALUE — plan 991 D6 A (Will, 2026-11-14): a Field on its header; Routes, the values it picks, one
 * dropdown of ticks; an output row per value picked (`v-<words>`) and Otherwise. A run sends each row at its value's
 * output, the rest at Otherwise; the text lens reads each output as a fork.
 * TRAP T-a-route-unfolds-its-picks
 *
 *   node --test test/unit/a-route-sends-rows-by-value.test.mjs
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { graphSteps, graphText, workflowFaults, workflowGraph } from '../../dist/data.js';
import { NODE_KINDS, socketType, unfoldedRows } from '../../dist/core/data/node-kinds.js';
import { simulateGraph } from '../../dist/core/data/node-simulate.js';

const fieldsOf = { customers: { risk: { label: 'Risk', values: ['High', 'Medium', 'Low'] } } };
const ROWS = [{ id: 1, risk: 'High' }, { id: 2, risk: 'Low' }, { id: 3, risk: 'Medium' }, { id: 4, risk: 'High' }, { id: 5, risk: ['Low', 'Medium'] }];
/** Customers › Field risk › a Route picking `routes`, each output to its own Run result. */
const flow = (routes, more = []) => ({
  v: 3, id: 'w',
  nodes: [
    { id: 's', kind: 'source', x: 0, y: 0, values: { store: 'customers' } },
    { id: 'f', kind: 'field', x: 300, y: 0, values: { field: 'risk' } },
    { id: 'r', kind: 'route', x: 600, y: 0, values: { routes } },
    { id: 'hi', kind: 'result', x: 900, y: 0 }, { id: 'med', kind: 'result', x: 900, y: 200 }, { id: 'else', kind: 'result', x: 900, y: 400 },
  ],
  connections: [{ from: 's/rows', to: 'f' }, { from: 'f/field', to: 'r' }, { from: 'r/v-high', to: 'hi' }, { from: 'r/v-medium', to: 'med' }, { from: 'r/otherwise', to: 'else' }, ...more],
});

test('a Route draws its Routes row, an output per value picked, then Otherwise; its Routes pick the field\'s values', () => {
  const g = workflowGraph(flow(['High', 'Medium']), { fieldsOf });
  const r = g.nodes.find((n) => n.id === 'r');
  assert.deepEqual(r.rows.filter((x) => x.name !== 'type').map((x) => [x.name, x.label, x.output ?? null]),
    [['routes', 'Routes', null], ['v-high', 'High', 'object'], ['v-medium', 'Medium', 'object'], ['otherwise', 'Otherwise', 'object']]);
  const routes = r.rows.find((x) => x.name === 'routes');
  assert.deepEqual([routes.control, routes.choices.map((c) => c.value)], ['values', ['High', 'Medium', 'Low']]);
  assert.deepEqual(workflowFaults(flow(['High', 'Medium']), NODE_KINDS, { fieldsOf }), [], 'a line from a route output is sound');
  assert.equal(socketType(NODE_KINDS.route, 'v-anything', 'output'), 'object');
  assert.deepEqual(unfoldedRows(['At risk', 'at-risk']).map((x) => x.name), ['v-at-risk', 'v-at-risk-2'], 'a clash takes -2');
});

test('a run sends each row at its value\'s output, the rest at Otherwise; a list cell goes the way of its first value picked', () => {
  const sim = simulateGraph(workflowGraph(flow(['High', 'Medium']), { fieldsOf }), { customers: ROWS });
  const ids = (socket) => sim.nodes.r.outgoing.find((s) => s.socket === `r/${socket}`).rows.map((x) => x.id);
  assert.deepEqual([ids('v-high'), ids('v-medium'), ids('otherwise')], [[1, 4], [3, 5], [2]]);
});

test('the text lens reads each output as a fork, and says the Route in words', () => {
  const graph = flow(['High', 'Medium']);
  const step = graphSteps(graph).flatMap((s) => s.steps).find((s) => s.node === 'r');
  assert.deepEqual(Object.keys(step.branches), ['v-high', 'v-medium', 'otherwise']);
  assert.match(graphText(graph).stages.join('\n'), /Route: send each row on by its .*risk.*: High, Medium; the rest, Otherwise\./);
});
