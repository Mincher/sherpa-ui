/**
 * STAGES are columns across a workflow's canvas, left to right. A workflow with none has one, Stage 1, holding every
 * node. A node is in one stage at most: the one its middle is let go in. A stage reaches past its nodes; empty, it has a
 * width of its own; it pushes the stages after it, and their nodes, right. Removing a stage leaves its nodes where they
 * are, in none; the last one stays. An order packs the stages, each node with its own. Will, 2026-11-10
 *
 *   node --test test/unit/a-stage-holds-its-nodes.test.mjs
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { schemaCheck } from '../../scripts/lib/schema-check.mjs';

const core = new URL('../../dist/core/data/', import.meta.url);
const { editWorkflow, checkWorkflow, nodeWidth, NODE_WIDTH } = await import(new URL('workflow.js', core));
const { stagesOf, stageBands, fitStages, STAGE_MIN, STAGE_PAD, STAGE_GAP } = await import(new URL('node-stages.js', core));
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

test('a node let go between or past the stages is in none', () => {
  const w = editWorkflow(flow(), { addStage: {} });
  const far = editWorkflow(editWorkflow(w, { node: 'b', set: { x: 5000 } }), { restage: ['b'] });
  assert.equal(far.nodes.find((n) => n.id === 'b').stage, undefined);
});

test('Edit names, lines and colours a stage; an empty line or colour takes it away', () => {
  let w = editWorkflow(flow(), { setStage: { id: 'stage-1', label: 'Intake', description: 'Where rows come in', colour: '#3b4ccd' } });
  assert.deepEqual(w.stages[0], { id: 'stage-1', label: 'Intake', description: 'Where rows come in', colour: '#3b4ccd', x: w.stages[0].x });
  w = editWorkflow(w, { setStage: { id: 'stage-1', label: '', description: '', colour: '' } });
  assert.deepEqual(w.stages[0], { id: 'stage-1', label: 'Intake', x: w.stages[0].x });
});

test('Remove leaves its nodes where they are, in none; the last stage stays', () => {
  const two = editWorkflow(flow(), { addStage: { label: 'Out' } });
  const gone = editWorkflow(two, { removeStage: 'stage-1' });
  assert.deepEqual(gone.stages.map((s) => s.id), ['stage-2']);
  assert.deepEqual(gone.nodes.map((n) => [n.x, n.stage]), [[0, undefined], [400, undefined]]);
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
