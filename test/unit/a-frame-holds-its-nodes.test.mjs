/**
 * A FRAME holds picked nodes under one header: the workflow keeps only which nodes (`frames`: id, title, line,
 * nodes), and its box is drawn round them. A frame is a bucket: its nodes stay where they stand (Will, 2026-11-10);
 * Release takes the frame away and leaves every node where it is. A node is in one frame at most; one removed
 * leaves its frame, and a frame with none goes. It is saved and read back: in v2, the schema, a Custom Node's
 * body and an entity's graph. Will, TODO 778 · docs/history/plan-778-frames.md
 *
 *   node --test test/unit/a-frame-holds-its-nodes.test.mjs
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { schemaCheck } from '../../scripts/lib/schema-check.mjs';

const core = new URL('../../dist/core/data/', import.meta.url);
const { editWorkflow, finalGraph, readWorkflow, workflowFaults, workflowGraph, checkWorkflow } = await import(new URL('workflow.js', core));
const { framesAmong } = await import(new URL('node-frames.js', core));
const { innerOf, kindsOf } = await import(new URL('node-library.js', core));
const { NODE_KINDS } = await import(new URL('node-kinds.js', core));
const { groupNodes, ungroupUse } = await import(new URL('node-group.js', core));
const { definitionOf, nodeEntityOf } = await import(new URL('entity.js', core));
const { graphWorkflow } = await import(new URL('entity-check.js', core));
const { graphOfWorkflow } = await import(new URL('graph-views.js', core));
const { Journal } = await import(new URL('journal.js', core));
const { onReport } = await import(new URL('report.js', core));

const flow = () => ({
  v: 2, id: 'f',
  nodes: [
    { id: 's1', kind: 'source', x: 0, y: 0 }, { id: 'p1', kind: 'field', x: 420, y: 260 },
    { id: 'e1', kind: 'output', x: 840, y: 40 }, { id: 's2', kind: 'source', x: 840, y: 560 },
  ],
  routes: [{ from: 's1/rows', to: 'p1' }, { from: 'p1/field', to: 'e1' }],
});
const boxes = { s1: { w: 240, h: 190 }, p1: { w: 240, h: 130 }, e1: { w: 240, h: 61 }, s2: { w: 240, h: 190 } };
const GAP = 3 * 56;
/** What one edit reports, refused. */
const refusals = (fn) => {
  const said = [];
  const stop = onReport((r) => said.push(r.message));
  try { fn(); } finally { stop(); }
  return said;
};

test('Frame: two or more nodes, a free id and a numbered title; a node taken from the frame it was in; a frame left with none goes', () => {
  const one = editWorkflow(flow(), { frame: { nodes: ['s1', 'p1'] } });
  assert.deepEqual(one.frames, [{ id: 'frame-1', label: 'Frame 1', nodes: ['s1', 'p1'] }]);
  assert.deepEqual(one.nodes, flow().nodes, 'framing moves no node');
  const two = editWorkflow(one, { frame: { nodes: ['p1', 'e1'], label: ' Outputs ', description: 'what leaves' } });
  assert.deepEqual(two.frames, [
    { id: 'frame-1', label: 'Frame 1', nodes: ['s1'] },
    { id: 'frame-2', label: 'Outputs', description: 'what leaves', nodes: ['p1', 'e1'] },
  ]);
  const three = editWorkflow(two, { frame: { nodes: ['s1', 's2'] } });
  assert.deepEqual(three.frames.map((f) => [f.id, f.nodes]), [['frame-2', ['p1', 'e1']], ['frame-1', ['s1', 's2']]], 'frame-1 emptied and went; its id is free again');
  assert.deepEqual(workflowFaults(three), []);
});

test('Frame refuses, in words, and writes nothing: one node, a node not there, a Group Input, an id taken', () => {
  const one = editWorkflow(flow(), { frame: { nodes: ['s1', 'p1'] } });
  for (const [ask, words] of [
    [{ nodes: ['s1'] }, /two or more/],
    [{ nodes: ['s1', 'zz'] }, /"zz" is not there/],
    [{ nodes: ['s1', '#in'] }, /cannot be framed/],
    [{ nodes: ['e1', 's2'], id: 'frame-1' }, /two frames would be "frame-1"/],
  ]) {
    let out;
    const said = refusals(() => { out = editWorkflow(one, { frame: ask }); });
    assert.equal(out, one, JSON.stringify(ask));
    assert.match(said.join(' '), words);
  }
});

test('Release: the frame goes and every node stays where it was; a frame not there is refused', () => {
  const framed = editWorkflow(flow(), { frame: { nodes: ['s1', 'p1', 'e1'] } });
  const released = editWorkflow(framed, { unframe: 'frame-1' });
  assert.equal(released.frames, undefined);
  assert.deepEqual(released, flow());
  let out;
  assert.match(refusals(() => { out = editWorkflow(released, { unframe: 'frame-1' }); }).join(' '), /"frame-1" is not there/);
  assert.equal(out, released);
});

test('a frame\'s title and line: set, trimmed; empty, gone', () => {
  const framed = editWorkflow(flow(), { frame: { nodes: ['s1', 'p1'] } });
  const named = editWorkflow(framed, { setFrame: { id: 'frame-1', label: '  Sign-ins ', description: 'this month' } });
  assert.deepEqual(named.frames[0], { id: 'frame-1', label: 'Sign-ins', description: 'this month', nodes: ['s1', 'p1'] });
  const bare = editWorkflow(named, { setFrame: { id: 'frame-1', label: '', description: '' } });
  assert.deepEqual(bare.frames[0], { id: 'frame-1', nodes: ['s1', 'p1'] });
});

test('a node removed leaves its frame; the last one gone, the frame goes', () => {
  const framed = editWorkflow(flow(), { frame: { nodes: ['s1', 'p1'] } });
  const less = editWorkflow(framed, { remove: 'p1' });
  assert.deepEqual(less.frames, [{ id: 'frame-1', label: 'Frame 1', nodes: ['s1'] }]);
  assert.equal(editWorkflow(less, { remove: 's1' }).frames, undefined);
});

test('the check: two frames one id, a frame of no node, a node not there, a node in two frames', () => {
  const w = { ...flow(), frames: [{ id: 'a', nodes: ['s1', 'zz'] }, { id: 'a', nodes: [] }, { id: 'b', nodes: ['s1'] }] };
  const faults = workflowFaults(w);
  for (const words of [/two frames are "a"/, /the frame "a" frames no node/, /frames the node "zz", which is not there/, /the node "s1" is in two frames, "a" and "b"/]) {
    assert.ok(faults.some((f) => words.test(f)), `${words}: ${faults.join(' | ')}`);
  }
});

test('saved and read back: JSON, the v2 schema, Save\'s final graph, and the drawn graph', () => {
  const framed = editWorkflow(flow(), { frame: { nodes: ['s1', 'p1', 'e1'], description: 'the flow' } });
  const back = JSON.parse(JSON.stringify(finalGraph(framed)));
  assert.deepEqual(back.frames, framed.frames);
  assert.equal(checkWorkflow(back), true);
  assert.deepEqual(schemaCheck('workflow.v2.json')(back), []);
  assert.notDeepEqual(schemaCheck('workflow.v2.json')({ ...back, frames: [{ id: 'Bad id', nodes: [] }] }), []);
  // Save drops a node a frame names that is not there, and a frame left with none.
  const stale = { ...framed, frames: [{ id: 'frame-1', nodes: ['s1', 'gone'] }, { id: 'frame-2', nodes: ['gone'] }] };
  assert.deepEqual(finalGraph(stale).frames, [{ id: 'frame-1', nodes: ['s1'] }]);
  assert.deepEqual(workflowGraph(framed).frames, framed.frames);
  assert.deepEqual(framesAmong(framed.frames, ['s1']), [{ ...framed.frames[0], nodes: ['s1'] }]);
});

test('an entity keeps its frames: the graph saved, the definition it offers, and the workflow its canvas edits', () => {
  const framed = editWorkflow(flow(), { frame: { nodes: ['s1', 'p1'] } });
  const graph = graphOfWorkflow(framed);
  assert.deepEqual(graph.frames, framed.frames);
  const entity = { v: 1, type: 'node', id: 'framed', label: 'Framed', graph, settings: { inputs: [], outputs: [] } };
  assert.deepEqual(schemaCheck('entity.v1.json')(entity), []);
  const definition = definitionOf(entity);
  assert.deepEqual(definition.frames, framed.frames);
  assert.deepEqual(nodeEntityOf('framed', definition).graph.frames, framed.frames);
  assert.deepEqual(graphWorkflow(entity).workflow.frames, framed.frames);
  assert.deepEqual(innerOf({ id: 'u', kind: 'framed' }, { v: 1, nodes: { framed: definition } }).workflow.frames, framed.frames);
});

test('Save as Custom Node: a frame wholly picked goes inside, one partly picked keeps the rest; Ungroup brings it back', () => {
  const w = editWorkflow(editWorkflow(flow(), { frame: { nodes: ['s1', 'p1'], label: 'In' } }), { frame: { nodes: ['e1', 's2'], label: 'Out' } });
  const made = groupNodes(w, ['s1', 'p1', 'e1'], { v: 1, nodes: {} }, { label: 'Chain' });
  assert.ok(!('fault' in made), made.fault);
  assert.deepEqual(made.library.nodes[made.id].frames, [{ id: 'frame-1', label: 'In', nodes: ['s1', 'p1'] }]);
  assert.deepEqual(made.workflow.frames, [{ id: 'frame-2', label: 'Out', nodes: ['s2'] }]);
  assert.deepEqual(workflowFaults(made.workflow, { ...NODE_KINDS, ...kindsOf(made.library) }), []);
  const back = ungroupUse(made.workflow, made.use, made.library).workflow;
  assert.deepEqual(back.frames, [{ id: 'frame-2', label: 'Out', nodes: ['s2'] }, { id: 'frame-1', label: 'In', nodes: ['s1', 'p1'] }]);
  assert.deepEqual(workflowFaults(back), []);
});

test('Undo and Redo: a frame is ONE step, put back whole; no node moves', () => {
  const journal = new Journal(10);
  const before = flow();
  const after = editWorkflow(before, { frame: { nodes: ['s1', 'p1', 'e1'] } });
  journal.push({ before, after });
  assert.deepEqual(journal.back().before, flow());
  assert.equal(journal.canBack, false);
  assert.deepEqual(journal.forward().after.frames, [{ id: 'frame-1', label: 'Frame 1', nodes: ['s1', 'p1', 'e1'] }]);
  assert.deepEqual(after.nodes.map((n) => [n.x, n.y]), before.nodes.map((n) => [n.x, n.y]));
});