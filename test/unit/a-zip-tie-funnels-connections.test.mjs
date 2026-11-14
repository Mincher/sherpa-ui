/**
 * A ZIP TIE funnels connections through one place, and changes no data. It is a part of the workflow
 * (`ties`: id, place, the connections it ties in order), made, moved and removed by pure edits, and it
 * leaves with its last connection. Its x stays in 20% to 80% of its own section of its connector set (TODO 973). It is
 * kept in v2, in a Custom Node's body too, and in no version or diff. Will, TODO 562 · plan 562.
 *
 *   node --test test/unit/a-zip-tie-funnels-connections.test.mjs
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { schemaCheck } from '../../scripts/lib/schema-check.mjs';

const core = new URL('../../dist/core/data/', import.meta.url);
const { editWorkflow, holdTies, readWorkflow, workflowFaults, workflowGraph, tieLimit, tiesAmong } = await import(new URL('workflow.js', core));
const { versionOf: definitionVersion, innerOf } = await import(new URL('node-library.js', core));

const R = (n) => ({ from: `s${n}/rows`, to: `e${n}` });
const flow = {
  v: 3, id: 'f',
  nodes: [
    { id: 's1', kind: 'source', x: 0, y: 0 }, { id: 'e1', kind: 'result', x: 400, y: 0 },
    { id: 's2', kind: 'source', x: 100, y: 100 }, { id: 'e2', kind: 'result', x: 700, y: 100 },
    { id: 's3', kind: 'source', x: 0, y: 200 }, { id: 'e3', kind: 'result', x: 900, y: 200 },
  ],
  connections: [R(1), R(2), R(3)],
};
const tied = editWorkflow(flow, { tie: { connections: [R(1), R(2), R(3)], x: 520, y: 120 } });

test('the limit is 20% to 80% of the span ALL its lines share, from the rightmost from-node to the leftmost to-node (TODO 973)', () => {
  // s1 0→e1 400, s2 100→e2 700, s3 0→e3 900: every line runs from 340 (s2's right edge) to 400 (e1's left edge).
  assert.deepEqual(tieLimit(flow, { connections: [R(1), R(2), R(3)], x: 0 }), { min: 352, max: 388 });
  assert.deepEqual(tieLimit(flow, { connections: [R(2), R(3)], x: 0 }), { min: 340 + 0.2 * 360, max: 340 + 0.8 * 360 });
  assert.equal(tieLimit(flow, { connections: [{ from: 'zz/rows', to: 'e9' }], x: 0 }), undefined);
  // A node grown wider: its own width, not 240.
  const wide = { ...flow, nodes: flow.nodes.map((n) => (n.id === 's2' ? { ...n, size: { w: 1.5, h: 1 } } : n)) };
  assert.deepEqual(tieLimit(wide, { connections: [R(2)], x: 0 }), { min: 460 + 0.2 * 240, max: 460 + 0.8 * 240 });
  // The target left of its source: the one point halfway.
  const back = { nodes: [{ id: 'a', x: 300 }, { id: 'b', x: 500 }] };
  assert.deepEqual(tieLimit(back, { connections: [{ from: 'a/rows', to: 'b' }], x: 0 }), { min: 520, max: 520 });
});

test('a connector set of N ties is cut into N sections, in their order across: each tie stays in 20% to 80% of its own (Will, TODO 973)', () => {
  // s2 → e2 runs 340 to 700: three ties on it, each 120 wide, so 364–436, 484–556 and 604–676.
  const three = { ...flow, ties: [{ id: 'b', x: 500, y: 0, connections: [R(2)] }, { id: 'a', x: 500, y: 0, connections: [R(2)] }, { id: 'c', x: 9000, y: 0, connections: [R(2)] }] };
  const held = holdTies(three);
  assert.deepEqual(held.ties.map((t) => [t.id, t.x]), [['b', 500], ['a', 436], ['c', 676]], 'two at one x: by id, a first; past the end: the last');
  assert.equal(holdTies(held), held, 'held, nothing moves');
  // A tie that shares one line with another is in its set; a tie on other lines is not.
  // p and q: 340 to 400, two sections, 346–364 and 376–394; r alone on s3 → e3, 372–768.
  const linked = { ...flow, ties: [{ id: 'p', x: 300, y: 0, connections: [R(1), R(2)] }, { id: 'q', x: 399, y: 0, connections: [R(2)] }, { id: 'r', x: 10, y: 0, connections: [R(3)] }] };
  assert.deepEqual(holdTies(linked).ties.map((t) => t.x), [346, 394, 372]);
  // Dragged, a tie stays in its own section: it never passes the next.
  assert.equal(editWorkflow({ ...held, connections: [R(1), R(2), R(3)] }, { moveTie: { id: 'a', x: 690 } }).ties.find((t) => t.id === 'a').x, 436);
  // A new tie on the set takes its place in the order, and the others move to their new sections.
  const more = editWorkflow({ ...flow, ties: [{ id: 'a', x: 520, y: 0, connections: [R(2)] }] }, { tie: { connections: [R(2)], x: 360, y: 0 } });
  assert.deepEqual(more.ties.map((t) => [t.id, t.x]), [['a', 556], ['tie-1', 376]]);
});

test('a tie added past the limit is clamped; moved, it is clamped again', () => {
  assert.equal(tied.ties.length, 1);
  assert.equal(tied.ties[0].id, 'tie-1');
  assert.equal(tied.ties[0].x, 388);
  assert.equal(editWorkflow(tied, { moveTie: { id: 'tie-1', x: 100 } }).ties[0].x, 352);
  const moved = editWorkflow(tied, { moveTie: { id: 'tie-1', x: 370, y: 50 } }).ties[0];
  assert.deepEqual([moved.x, moved.y], [370, 50]);
  assert.deepEqual(tied.ties[0].connections, [R(1), R(2), R(3)]);
  assert.equal(tied.ties[0].x, 388, 'the one given is untouched');
});

test('a tie of a missing connection is a fault in words; edits keep what is given', () => {
  const bad = editWorkflow(flow, { tie: { connections: [R(1), R(9)], x: 300, y: 0 } });
  assert.deepEqual(workflowFaults(bad).filter((f) => f.includes('tie')), ['the tie "tie-1" ties the connection "s9/rows" → "e9", which is not there']);
  assert.deepEqual(workflowFaults(tied), []);
  const empty = { ...flow, ties: [{ id: 'x', x: 0, y: 0, connections: [] }, { id: 'x', x: 0, y: 0, connections: [R(1)] }] };
  const faults = workflowFaults(empty);
  assert.ok(faults.includes('the tie "x" ties no connection') && faults.includes('two ties are "x"'));
});

test('cutting a tied connection drops it from the tie; the last one takes the tie', () => {
  const cut = editWorkflow(tied, { cut: R(2) });
  assert.deepEqual(cut.ties[0].connections, [R(1), R(3)]);
  const alone = editWorkflow(editWorkflow(cut, { cut: R(1) }), { cut: R(3) });
  assert.equal(alone.ties, undefined);
  assert.equal(editWorkflow(tied, { remove: 's2' }).ties[0].connections.length, 2);
  assert.equal(editWorkflow(tied, { untie: 'tie-1' }).ties, undefined);
  assert.equal(editWorkflow(tied, { untie: 'tie-1' }).connections.length, 3, 'the connections stay');
  assert.deepEqual(tiesAmong(tied.ties, [R(3)])[0].connections, [R(3)]);
});

test('a connection may pass through several ties, drawn from the workflow', () => {
  const two = editWorkflow(tied, { tie: { connections: [R(3), R(2)], x: 800, y: 300 } });
  assert.deepEqual(two.ties.map((t) => t.id), ['tie-1', 'tie-2']);
  assert.deepEqual(two.ties[1].connections, [R(3), R(2)]);
  assert.equal(workflowGraph(two).ties.length, 2);
  assert.equal(workflowGraph(flow).ties, undefined);
});

test('a tie is saved and read in v2, checks by its schema, and a v1 is no workflow', () => {
  const saved = JSON.parse(JSON.stringify(tied));
  assert.deepEqual(readWorkflow(saved).workflow.ties, tied.ties);
  assert.deepEqual(schemaCheck('workflow.v3.json')(saved), []);
  assert.notDeepEqual(schemaCheck('workflow.v3.json')({ ...saved, ties: [{ id: 'tie-1', x: 1, y: 1, connections: [] }] }), []);
  assert.equal(readWorkflow({ ...flow, v: 1 }).workflow, undefined);
});

test('a Custom Node body holds a tie, and it is no part of the version', () => {
  const body = { v: 1, label: 'T', inputs: [], outputs: [], nodes: flow.nodes.slice(0, 2), connections: [R(1)] };
  const withTie = { ...body, ties: [{ id: 'tie-1', x: 300, y: 0, connections: [R(1)] }] };
  assert.equal(definitionVersion(body), definitionVersion(withTie));
  const lib = { v: 1, nodes: { t: withTie } };
  assert.deepEqual(innerOf({ id: 'use', kind: 't' }, lib).workflow.ties, withTie.ties);
  assert.equal(innerOf({ id: 'use', kind: 't' }, { v: 1, nodes: { t: body } }).workflow.ties, undefined);
});
