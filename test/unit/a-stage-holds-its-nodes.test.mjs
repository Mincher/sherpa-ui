/**
 * STAGES are columns across a workflow's canvas, left to right. A workflow with none has one, Stage 1, holding every
 * node. A node is in one stage at most: the one its middle is let go in. A stage reaches past its nodes; empty, it has a
 * width of its own; it pushes the stages after it, and their nodes, right. Removing a stage leaves its nodes where they
 * are, in the stage before; the last one stays. No node is in none: one let go outside every stage joins the nearest (899). An order packs the stages, each node with its own. Will, 2026-11-10
 *
 *   node --test test/unit/a-stage-holds-its-nodes.test.mjs
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { schemaCheck } from '../../scripts/lib/schema-check.mjs';

const core = new URL('../../dist/core/data/', import.meta.url);
const { editWorkflow, checkWorkflow, nodeWidth, NODE_WIDTH } = await import(new URL('workflow.js', core));
const { stagesOf, stageBands, heldBands, fitStages, STAGE_MIN, STAGE_PAD, STAGE_GAP } = await import(new URL('node-stages.js', core));
const { onReport } = await import(new URL('report.js', core));

const flow = () => ({
  v: 2, id: 'f',
  nodes: [{ id: 'a', kind: 'source', x: 0, y: 0 }, { id: 'b', kind: 'sort', x: 400, y: 0 }],
  routes: [{ from: 'a/rows', to: 'b' }],
});
const heard = () => { const said = []; const stop = onReport((r) => said.push(r.message)); return { said, stop }; };

test('a workflow with no stages has one, Stage 1, round every node', () => {
  const w = flow();
  assert.deepEqual(stagesOf(w).map((s) => s.label), ['Stage 1']);
  const { bands } = stageBands(w, nodeWidth);
  assert.deepEqual(bands, [{ id: 'stage-1', left: -STAGE_PAD, right: 400 + NODE_WIDTH + STAGE_PAD }]);
});

test('Add stage writes Stage 1 out, every node in it, and puts the new one after it, empty and its own width', () => {
  const w = editWorkflow(flow(), { addStage: {} });
  assert.deepEqual(w.stages.map((s) => s.id), ['stage-1', 'stage-2']);
  assert.ok(w.nodes.every((n) => n.stage === 'stage-1'));
  const { bands } = stageBands(w, nodeWidth);
  assert.equal(bands[1].left, bands[0].right + STAGE_GAP);
  assert.equal(bands[1].right - bands[1].left, STAGE_MIN);
  assert.equal(checkWorkflow(w), true);
});

test('a node let go in the next stage joins it; a stage that grows pushes the next, and its nodes, right', () => {
  let w = editWorkflow(flow(), { addStage: {} });
  const two = stageBands(w, nodeWidth).bands[1];
  // b let go in stage 2: it joins it.
  w = editWorkflow(editWorkflow(w, { node: 'b', set: { x: two.left + 40 } }), { restage: ['b'] });
  assert.equal(w.nodes.find((n) => n.id === 'b').stage, 'stage-2');
  const back = fitStages(editWorkflow(editWorkflow(w, { node: 'a', set: { x: 0 } }), { restage: ['a'] }), nodeWidth);
  assert.equal(back.nodes.find((n) => n.id === 'a').stage, 'stage-1');
  // Stage 1 grows: a node of it placed out to its right edge pushes stage 2 and b along.
  const grown = { ...back, nodes: [...back.nodes, { id: 'c', kind: 'sort', x: two.left - STAGE_PAD - NODE_WIDTH / 2, y: 200, stage: 'stage-1' }] };
  const fit = fitStages(grown, nodeWidth);
  const [one, next] = stageBands(fit, nodeWidth).bands;
  assert.ok(next.left >= one.right + STAGE_GAP, 'stage 2 starts after stage 1 ends');
  assert.ok(fit.nodes.find((n) => n.id === 'b').x > back.nodes.find((n) => n.id === 'b').x, 'b moved with its stage');
});

test('a node let go past the stages, or before them, joins the nearest, which grows to hold it (899)', () => {
  const w = editWorkflow(flow(), { addStage: {} });
  const far = editWorkflow(editWorkflow(w, { node: 'b', set: { x: 5000 } }), { restage: ['b'] });
  assert.equal(far.nodes.find((n) => n.id === 'b').stage, 'stage-2');
  const back = editWorkflow(editWorkflow(w, { node: 'b', set: { x: -3000 } }), { restage: ['b'] });
  assert.equal(back.nodes.find((n) => n.id === 'b').stage, 'stage-1');
  const fit = fitStages(far, nodeWidth);
  const two = stageBands(fit, nodeWidth).bands[1];
  const b = fit.nodes.find((n) => n.id === 'b');
  assert.ok(b.x >= two.left && b.x + nodeWidth(b) <= two.right, 'stage 2 holds it');
});

test('in a gap, a node joins the stage whose edge is nearer; a node in none joins the nearest at the next fit (899)', () => {
  let w = editWorkflow(flow(), { addStage: {} });
  // The bands as they stand without b: what it is let go among.
  const [one, two] = heldBands(w, nodeWidth, new Set(['b']));
  const at = (middle) => editWorkflow(editWorkflow(w, { node: 'b', set: { x: middle - NODE_WIDTH / 2 } }), { restage: ['b'] }).nodes.find((n) => n.id === 'b').stage;
  assert.ok(one.right + 2 < two.left - 2, 'a gap between them');
  assert.equal(at(one.right + 2), 'stage-1', 'just past stage 1: stage 1');
  assert.equal(at(two.left - 2), 'stage-2', 'just before stage 2: stage 2');
  w = editWorkflow(editWorkflow(w, { node: 'b', set: { x: one.right + 2 - NODE_WIDTH / 2 } }), { restage: ['b'] });
  // Written in none (a draft from before): the fit puts it in a stage.
  const bare = { ...w, nodes: w.nodes.map((n) => (n.id === 'a' ? { id: n.id, kind: n.kind, x: n.x, y: n.y } : n)) };
  assert.equal(fitStages(bare, nodeWidth).nodes.find((n) => n.id === 'a').stage, 'stage-1');
});

test('a new node goes in the stage under the point it was let go at, though its middle stands in the next (923)', () => {
  let w = editWorkflow(flow(), { addStage: {} });
  const [one] = stageBands(w, nodeWidth).bands;
  // Let go just inside stage 1's right edge: its left edge there, its middle past it.
  const at = one.right - 20;
  w = editWorkflow(w, { add: { id: 'c', kind: 'sort', x: at, y: 200 } });
  assert.notEqual(editWorkflow(w, { restage: ['c'] }).nodes.find((n) => n.id === 'c').stage, 'stage-1', 'by its middle: not stage 1');
  assert.equal(editWorkflow(w, { restage: ['c'], by: at }).nodes.find((n) => n.id === 'c').stage, 'stage-1', 'by the point: stage 1');
});

test('Edit names, lines and colours a stage; an empty line or colour takes it away', () => {
  let w = editWorkflow(flow(), { setStage: { id: 'stage-1', label: 'Intake', description: 'Where rows come in', colour: '#3b4ccd' } });
  assert.deepEqual(w.stages[0], { id: 'stage-1', label: 'Intake', description: 'Where rows come in', colour: '#3b4ccd', x: w.stages[0].x });
  w = editWorkflow(w, { setStage: { id: 'stage-1', label: '', description: '', colour: '' } });
  assert.deepEqual(w.stages[0], { id: 'stage-1', label: 'Intake', x: w.stages[0].x });
});

test('Remove leaves its nodes where they are, in the stage before, or after where it was the first; the last stage stays', () => {
  const two = editWorkflow(flow(), { addStage: { label: 'Out' } });
  const gone = editWorkflow(two, { removeStage: 'stage-1' });
  assert.deepEqual(gone.stages.map((s) => s.id), ['stage-2']);
  assert.deepEqual(gone.nodes.map((n) => [n.x, n.stage]), [[0, 'stage-2'], [400, 'stage-2']]);
  const kept = editWorkflow(two, { removeStage: 'stage-2' });
  assert.deepEqual(kept.nodes.map((n) => n.stage), ['stage-1', 'stage-1']);
  // Laid out, the stage holds them where they stand.
  const fit = fitStages(gone, nodeWidth);
  const [band] = stageBands(fit, nodeWidth).bands;
  assert.ok(fit.nodes.every((n) => n.x >= band.left && n.x + nodeWidth(n) <= band.right), 'stage 2 holds them');
  const { said, stop } = heard();
  assert.equal(editWorkflow(gone, { removeStage: 'stage-2' }), gone);
  stop();
  assert.match(said.join(), /one stage at least/);
});

test('an order packs the stages left to right from where the first stood, each node moving with its own', () => {
  let w = editWorkflow(flow(), { addStage: { label: 'Out' } });
  const two = stageBands(w, nodeWidth).bands[1];
  // As the editor writes it: let go, restaged, then laid out.
  w = fitStages(editWorkflow(editWorkflow(w, { node: 'b', set: { x: two.left + 40 } }), { restage: ['b'] }), nodeWidth);
  const before = stageBands(w, nodeWidth).bands;
  const swapped = fitStages(editWorkflow(w, { orderStages: ['stage-2', 'stage-1'] }), nodeWidth);
  assert.deepEqual(swapped.stages.map((s) => s.id), ['stage-2', 'stage-1']);
  const after = stageBands(swapped, nodeWidth).bands;
  assert.equal(after[0].left, before[0].left, 'the first starts where the first stood');
  assert.equal(after[1].left, after[0].right + STAGE_GAP);
  const b = swapped.nodes.find((n) => n.id === 'b');
  assert.equal(b.x - after[0].left, w.nodes.find((n) => n.id === 'b').x - before[1].left, 'b keeps its place in its stage');
});

test('stages are saved and read back: the schema takes them, and a node in a stage not there is a fault', () => {
  const w = editWorkflow(editWorkflow(flow(), { addStage: { label: 'Out', colour: '#ff0000' } }), { setStage: { id: 'stage-1', description: 'In' } });
  assert.deepEqual(schemaCheck('workflow.v2.json')(w), []);
  assert.notDeepEqual(schemaCheck('workflow.v2.json')({ ...w, stages: [{ id: 'stage-1', label: '', x: 0 }] }), []);
  const { said, stop } = heard();
  assert.equal(checkWorkflow({ ...w, nodes: [{ ...w.nodes[0], stage: 'stage-9' }, w.nodes[1]] }), false);
  stop();
  assert.match(said.join(), /stage-9/);
});

test('a FLEX row: a stage that shrinks draws the next back, its nodes with it, the gap kept; a node left of its stage\'s start is held at it', async () => {
  let w = editWorkflow(flow(), { addStage: { label: 'Out' } });
  const two = stageBands(w, nodeWidth).bands[1];
  w = fitStages(editWorkflow(editWorkflow(w, { node: 'b', set: { x: two.left + 40 } }), { restage: ['b'] }), nodeWidth);
  // Stage 1 now holds only a: it shrank, and stage 2 stands the gap after it, b with it.
  const [one, next] = stageBands(w, nodeWidth).bands;
  assert.equal(next.left, one.right + STAGE_GAP);
  const b = w.nodes.find((n) => n.id === 'b');
  // It stood 40px in, which is inside the pad: it is held at the pad.
  assert.equal(b.x, next.left + STAGE_PAD, 'b moves with its stage');
  // b dragged left past stage 2's start, in it still: held at the start.
  const held = fitStages({ ...w, nodes: w.nodes.map((n) => (n.id === 'b' ? { ...n, x: 0 } : n)) }, nodeWidth);
  assert.equal(held.nodes.find((n) => n.id === 'b').x, stageBands(held, nodeWidth).bands[1].left + STAGE_PAD);
});

test('Add stage before or after a stage puts it there, the stages after moving on with their nodes; a default name is its place', () => {
  let w = editWorkflow(flow(), { addStage: {} });
  w = fitStages(editWorkflow(editWorkflow(w, { node: 'b', set: { x: stageBands(w, nodeWidth).bands[1].left + 40 } }), { restage: ['b'] }), nodeWidth);
  const bx = w.nodes.find((n) => n.id === 'b').x;
  // Before Stage 1: the new one is Stage 1, the old Stage 1 and 2 are 2 and 3, and b moves on with its stage.
  const before = fitStages(editWorkflow(w, { addStage: { before: 'stage-1' } }), nodeWidth);
  assert.deepEqual(before.stages.map((s) => [s.id, s.label]), [['stage-3', 'Stage 1'], ['stage-1', 'Stage 2'], ['stage-2', 'Stage 3']]);
  assert.ok(before.nodes.find((n) => n.id === 'b').x > bx, 'b moves on with its stage');
  assert.ok(before.nodes.every((n) => n.stage !== 'stage-3'), 'the new stage is empty');
  // After Stage 1: between the two.
  const after = editWorkflow(w, { addStage: { after: 'stage-1' } });
  assert.deepEqual(after.stages.map((s) => [s.id, s.label]), [['stage-1', 'Stage 1'], ['stage-3', 'Stage 2'], ['stage-2', 'Stage 3']]);
  // A stage not there is refused.
  const { said, stop } = heard();
  assert.equal(editWorkflow(w, { addStage: { after: 'nope' } }), w);
  stop();
  assert.match(said.join(' '), /the stage "nope" is not there/);
});

test('a default name follows its place on a move and a removal; a name of its own stays', () => {
  let w = editWorkflow(editWorkflow(flow(), { addStage: {} }), { addStage: {} });
  w = editWorkflow(w, { setStage: { id: 'stage-2', label: 'Decide' } });
  // Stage 3 moved first: it is Stage 1, the old Stage 1 is Stage 2; Decide keeps its name.
  const moved = editWorkflow(w, { orderStages: ['stage-3', 'stage-1', 'stage-2'] });
  assert.deepEqual(moved.stages.map((s) => [s.id, s.label]), [['stage-3', 'Stage 1'], ['stage-1', 'Stage 2'], ['stage-2', 'Decide']]);
  const removed = editWorkflow(moved, { removeStage: 'stage-3' });
  assert.deepEqual(removed.stages.map((s) => [s.id, s.label]), [['stage-1', 'Stage 1'], ['stage-2', 'Decide']]);
});
