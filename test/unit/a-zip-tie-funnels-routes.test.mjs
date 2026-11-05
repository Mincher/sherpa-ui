/**
 * A ZIP TIE funnels routes through one place, and changes no data. It is a part of the workflow
 * (`ties`: id, place, the routes it ties in order), made, moved and removed by pure edits, and it
 * leaves with its last route. Its x never goes past the nodes its SHORTEST tied route joins. It is
 * kept in v2, in a Custom Node's body too, and in no version or diff. Will, TODO 562 · plan 562.
 *
 *   node --test test/unit/a-zip-tie-funnels-routes.test.mjs
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { schemaCheck } from '../../scripts/lib/schema-check.mjs';

const core = new URL('../../dist/core/data/', import.meta.url);
const { editWorkflow, readWorkflow, workflowFaults, workflowGraph, tieLimit, tiesAmong, NODE_WIDTH } = await import(new URL('workflow.js', core));
const { versionOf: definitionVersion, innerOf } = await import(new URL('node-library.js', core));

const R = (n) => ({ from: `s${n}/rows`, to: `e${n}` });
const flow = {
  v: 2, id: 'f',
  nodes: [
    { id: 's1', kind: 'source', x: 0, y: 0 }, { id: 'e1', kind: 'output', x: 400, y: 0 },
    { id: 's2', kind: 'source', x: 100, y: 100 }, { id: 'e2', kind: 'output', x: 700, y: 100 },
    { id: 's3', kind: 'source', x: 0, y: 200 }, { id: 'e3', kind: 'output', x: 900, y: 200 },
  ],
  routes: [R(1), R(2), R(3)],
};
const tied = editWorkflow(flow, { tie: { routes: [R(1), R(2), R(3)], x: 520, y: 120 } });

test('the limit is the range of the SHORTEST tied route, in numbers', () => {
  // spans: (240..400) = 160, (340..700) = 360, (240..900) = 660
  assert.deepEqual(tieLimit(flow, { routes: [R(1), R(2), R(3)] }), { min: NODE_WIDTH, max: 400 });
  assert.deepEqual(tieLimit(flow, { routes: [R(2), R(3)] }), { min: 340, max: 700 });
  assert.equal(tieLimit(flow, { routes: [{ from: 'zz/rows', to: 'e9' }] }), undefined);
  // The target left of its source: the one point halfway.
  const back = { nodes: [{ id: 'a', x: 300 }, { id: 'b', x: 500 }] };
  assert.deepEqual(tieLimit(back, { routes: [{ from: 'a/rows', to: 'b' }] }), { min: 520, max: 520 });
});

test('a tie added past the limit is clamped; moved, it is clamped again', () => {
  assert.equal(tied.ties.length, 1);
  assert.equal(tied.ties[0].id, 'tie-1');
  assert.equal(tied.ties[0].x, 400);
  assert.equal(editWorkflow(tied, { moveTie: { id: 'tie-1', x: 100 } }).ties[0].x, 240);
  const moved = editWorkflow(tied, { moveTie: { id: 'tie-1', x: 300, y: 50 } }).ties[0];
  assert.deepEqual([moved.x, moved.y], [300, 50]);
  assert.deepEqual(tied.ties[0].routes, [R(1), R(2), R(3)]);
  assert.equal(tied.ties[0].x, 400, 'the one given is untouched');
});

test('a tie of a missing route is a fault in words; edits keep what is given', () => {
  const bad = editWorkflow(flow, { tie: { routes: [R(1), R(9)], x: 300, y: 0 } });
  assert.deepEqual(workflowFaults(bad).filter((f) => f.includes('tie')), ['the tie "tie-1" ties the route "s9/rows" → "e9", which is not there']);
  assert.deepEqual(workflowFaults(tied), []);
  const empty = { ...flow, ties: [{ id: 'x', x: 0, y: 0, routes: [] }, { id: 'x', x: 0, y: 0, routes: [R(1)] }] };
  const faults = workflowFaults(empty);
  assert.ok(faults.includes('the tie "x" ties no route') && faults.includes('two ties are "x"'));
});

test('cutting a tied route drops it from the tie; the last one takes the tie', () => {
  const cut = editWorkflow(tied, { cut: R(2) });
  assert.deepEqual(cut.ties[0].routes, [R(1), R(3)]);
  const alone = editWorkflow(editWorkflow(cut, { cut: R(1) }), { cut: R(3) });
  assert.equal(alone.ties, undefined);
  assert.equal(editWorkflow(tied, { remove: 's2' }).ties[0].routes.length, 2);
  assert.equal(editWorkflow(tied, { untie: 'tie-1' }).ties, undefined);
  assert.equal(editWorkflow(tied, { untie: 'tie-1' }).routes.length, 3, 'the routes stay');
  assert.deepEqual(tiesAmong(tied.ties, [R(3)])[0].routes, [R(3)]);
});

test('a route may pass through several ties, drawn from the workflow', () => {
  const two = editWorkflow(tied, { tie: { routes: [R(3), R(2)], x: 800, y: 300 } });
  assert.deepEqual(two.ties.map((t) => t.id), ['tie-1', 'tie-2']);
  assert.deepEqual(two.ties[1].routes, [R(3), R(2)]);
  assert.equal(workflowGraph(two).ties.length, 2);
  assert.equal(workflowGraph(flow).ties, undefined);
});

test('a tie is saved and read in v2, checks by its schema, and a v1 has none', () => {
  const saved = JSON.parse(JSON.stringify(tied));
  assert.deepEqual(readWorkflow(saved).workflow.ties, tied.ties);
  assert.deepEqual(schemaCheck('workflow.v2.json')(saved), []);
  assert.notDeepEqual(schemaCheck('workflow.v2.json')({ ...saved, ties: [{ id: 'tie-1', x: 1, y: 1, routes: [] }] }), []);
  assert.equal(readWorkflow({ ...flow, v: 1 }).workflow.ties, undefined);
});

test('a Custom Node body holds a tie, and it is no part of the version', () => {
  const body = { v: 1, label: 'T', inputs: [], outputs: [], nodes: flow.nodes.slice(0, 2), routes: [R(1)] };
  const withTie = { ...body, ties: [{ id: 'tie-1', x: 300, y: 0, routes: [R(1)] }] };
  assert.equal(definitionVersion(body), definitionVersion(withTie));
  const lib = { v: 1, nodes: { t: withTie } };
  assert.deepEqual(innerOf({ id: 'use', kind: 't' }, lib).workflow.ties, withTie.ties);
  assert.equal(innerOf({ id: 'use', kind: 't' }, { v: 1, nodes: { t: body } }).workflow.ties, undefined);
});
