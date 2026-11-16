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
const { stagesOf, stageBands, heldBands, fitStages, stageWidthRange, STAGE_MIN, STAGE_PAD, STAGE_GAP } = await import(new URL('node-stages.js', core));
const { onReport } = await import(new URL('report.js', core));

const flow = () => ({
  v: 3, id: 'f',
  nodes: [{ id: 'a', kind: 'source', x: 0, y: 0 }, { id: 'b', kind: 'organise', x: 400, y: 0 }],
  connections: [{ from: 'a/rows', to: 'b' }],
});
const heard = () => { const said = []; const stop = onReport((r) => said.push(r.message)); return { said, stop }; };

test('a workflow with no stages has one, Stage 1, round every node', () => {
  const w = flow();
  assert.deepEqual(stagesOf(w).map((s) => s.label), ['Stage 1']);
  const { bands } = stageBands(w, nodeWidth);
  // Round its nodes, and never narrower than STAGE_MIN (TODO 1027).
  assert.deepEqual(bands, [{ id: 'stage-1', left: -STAGE_PAD, right: Math.max(400 + NODE_WIDTH + STAGE_PAD, -STAGE_PAD + STAGE_MIN) }]);
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
  const grown = { ...back, nodes: [...back.nodes, { id: 'c', kind: 'organise', x: two.left - STAGE_PAD - NODE_WIDTH / 2, y: 200, stage: 'stage-1' }] };
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
  w = editWorkflow(w, { add: { id: 'c', kind: 'organise', x: at, y: 200 } });
  assert.notEqual(editWorkflow(w, { restage: ['c'] }).nodes.find((n) => n.id === 'c').stage, 'stage-1', 'by its middle: not stage 1');
  assert.equal(editWorkflow(w, { restage: ['c'], by: at }).nodes.find((n) => n.id === 'c').stage, 'stage-1', 'by the point: stage 1');
});

test('an edge dragged makes a stage wider and the next as much narrower, no node moving; each keeps room for its nodes (900)', () => {
  let w = editWorkflow(flow(), { addStage: {} });
  w = fitStages(editWorkflow(editWorkflow(w, { node: 'b', set: { x: stageBands(w, nodeWidth).bands[1].left + 40 } }), { restage: ['b'] }), nodeWidth);
  // Packed, stage 2 has no room before b: a wider edge stays (moving b is 901's). Moved on in its stage, b leaves room.
  const packed = stageBands(w, nodeWidth).bands[0];
  assert.equal(editWorkflow(w, { resizeStage: { id: 'stage-1', w: packed.right - packed.left + 60 } }), w);
  w = fitStages(editWorkflow(w, { node: 'b', set: { x: w.nodes.find((n) => n.id === 'b').x + 200 } }), nodeWidth);
  const [one, two] = stageBands(w, nodeWidth).bands;
  const xs = w.nodes.map((n) => n.x);
  // Stage 1 wider by 40: stage 2 starts 40 on, its end where it was.
  const wide = fitStages(editWorkflow(w, { resizeStage: { id: 'stage-1', w: one.right - one.left + 40 } }), nodeWidth);
  const [a, b] = stageBands(wide, nodeWidth).bands;
  assert.deepEqual([a.left, a.right, b.left, b.right], [one.left, one.right + 40, two.left + 40, two.right]);
  assert.deepEqual(wide.nodes.map((n) => n.x), xs, 'no node moves');
  assert.equal(wide.stages[0].w, a.right - a.left);
  // Too far either way: the edge stops at room for each stage's nodes.
  const range = stageWidthRange(w, 'stage-1', nodeWidth);
  const node = w.nodes.find((n) => n.id === 'a');
  assert.equal(range.least, node.x + nodeWidth(node) + STAGE_PAD - one.left);
  const tight = fitStages(editWorkflow(w, { resizeStage: { id: 'stage-1', w: 10 } }), nodeWidth);
  assert.equal(stageBands(tight, nodeWidth).bands[0].right - one.left, range.least);
  const far = fitStages(editWorkflow(w, { resizeStage: { id: 'stage-1', w: 99999 } }), nodeWidth);
  const nb = w.nodes.find((n) => n.id === 'b');
  assert.equal(stageBands(far, nodeWidth).bands[1].left, nb.x - STAGE_PAD, 'stage 2 keeps its pad before b');
  assert.deepEqual(far.nodes.map((n) => n.x), xs);
  // The last stage has no edge to drag.
  assert.equal(editWorkflow(w, { resizeStage: { id: 'stage-2', w: 900 } }), w);
  assert.equal(stageWidthRange(w, 'stage-2', nodeWidth), null);
  assert.equal(checkWorkflow(wide), true);
});

test('with Cmd/Ctrl the edge moves the stages after it on, each width kept, their nodes with them; the first stage\'s start edge, plain or moving all (985)', () => {
  let w = editWorkflow(flow(), { addStage: {} });
  w = fitStages(editWorkflow(editWorkflow(w, { node: 'b', set: { x: stageBands(w, nodeWidth).bands[1].left + 40 } }), { restage: ['b'] }), nodeWidth);
  const [one, two] = stageBands(w, nodeWidth).bands;
  const at = (wf, id) => wf.nodes.find((n) => n.id === id).x;
  const edges = (wf) => stageBands(fitStages(wf, nodeWidth), nodeWidth).bands.map((b) => [b.left, b.right]);
  // Stage 2 has no room before b, so a plain edge stays; moving on, it needs none: stage 2 and b go 40 on.
  const on = editWorkflow(w, { resizeStage: { id: 'stage-1', w: one.right - one.left + 40, moves: true } });
  assert.deepEqual(edges(on), [[one.left, one.right + 40], [two.left + 40, two.right + 40]]);
  assert.deepEqual([at(on, 'a'), at(on, 'b')], [at(w, 'a'), at(w, 'b') + 40]);
  // Back past its own node: it stops at the room a needs.
  const least = stageWidthRange(w, 'stage-1', nodeWidth).least;
  const back = editWorkflow(w, { resizeStage: { id: 'stage-1', w: 10, moves: true } });
  assert.deepEqual(edges(back), [[one.left, one.left + least], [two.left - (one.right - one.left - least), two.right - (one.right - one.left - least)]]);
  // The last stage has no end edge; any but the first has no start edge of its own.
  assert.equal(editWorkflow(w, { resizeStage: { id: 'stage-2', w: 900, moves: true } }), w);
  assert.equal(editWorkflow(w, { resizeStage: { id: 'stage-2', w: 900, start: true } }), w);
  // The first stage's start edge: plain, 60 wider to the left, its right edge kept, no node moved; no further in than a.
  const out = editWorkflow(w, { resizeStage: { id: 'stage-1', w: one.right - one.left + 60, start: true } });
  assert.deepEqual(edges(out), [[one.left - 60, one.right], [two.left, two.right]]);
  assert.deepEqual(out.nodes.map((n) => n.x), w.nodes.map((n) => n.x));
  const inside = editWorkflow(w, { resizeStage: { id: 'stage-1', w: 10, start: true } });
  assert.equal(edges(inside)[0][0], at(w, 'a') - STAGE_PAD);
  // Moving all: every stage and node 60 on.
  const all = editWorkflow(w, { resizeStage: { id: 'stage-1', w: one.right - one.left - 60, start: true, moves: true } });
  assert.deepEqual(edges(all), [[one.left + 60, one.right + 60], [two.left + 60, two.right + 60]]);
  assert.deepEqual(all.nodes.map((n) => n.x), w.nodes.map((n) => n.x + 60));
  assert.equal(checkWorkflow(all), true);
});

test('given the nodes\' heights, the edge goes past them: the stage it narrows pushes its nodes in, in order, the gap kept, to its widest node (901)', () => {
  // Stage 1 holds a Source at 48 and two Organise nodes at 400, side by side down; stage 2 one at its start.
  let w = editWorkflow({ ...flow(), nodes: [...flow().nodes, { id: 'c', kind: 'organise', x: 400, y: 300 }] }, { addStage: {} });
  w = fitStages(editWorkflow(w, { node: 'b', set: { x: 400 } }), nodeWidth);
  const at = (wf, id) => wf.nodes.find((n) => n.id === id).x;
  const [one] = stageBands(w, nodeWidth).bands;
  const heights = { a: 100, b: 100, c: 100 };
  // Pushing, the range is each stage's widest node and its pads; not pushing, as its nodes stand.
  const width = nodeWidth(w.nodes[1]);
  assert.equal(stageWidthRange(w, 'stage-1', nodeWidth, true).least, width + 2 * STAGE_PAD);
  assert.ok(stageWidthRange(w, 'stage-1', nodeWidth).least > stageWidthRange(w, 'stage-1', nodeWidth, true).least);
  // Narrower by 200: b and c, nearest the edge, come in by as much; a, a row of its own with room, stays.
  const right = at(w, 'b') + width;
  const in200 = editWorkflow(w, { resizeStage: { id: 'stage-1', w: right + STAGE_PAD - one.left - 200, heights } });
  assert.deepEqual(['a', 'b', 'c'].map((id) => at(in200, id)), [at(w, 'a'), at(w, 'b') - 200, at(w, 'c') - 200]);
  assert.equal(in200.stages[0].w, right + STAGE_PAD - one.left - 200);
  // Further: b meets a in its row and pushes it on, the gap between them kept. a stands 100 in, so it has room to go.
  const roomy = editWorkflow(w, { node: 'a', set: { x: one.left + STAGE_PAD + 100 } });
  const gap = Math.min(STAGE_PAD, at(roomy, 'b') - (at(roomy, 'a') + nodeWidth(w.nodes[0])));
  const meet = at(roomy, 'a') + nodeWidth(w.nodes[0]) + gap + width + STAGE_PAD - one.left;
  const near = editWorkflow(roomy, { resizeStage: { id: 'stage-1', w: meet - 40, heights } });
  assert.equal(at(near, 'a'), at(roomy, 'a') - 40, 'a pushed on by as much');
  assert.equal(at(near, 'b') - (at(near, 'a') + nodeWidth(w.nodes[0])), gap, 'the gap kept');
  const floor = editWorkflow(w, { resizeStage: { id: 'stage-1', w: 10, heights } });
  assert.deepEqual(['a', 'b', 'c'].map((id) => at(floor, id)), [one.left + STAGE_PAD, one.left + STAGE_PAD, one.left + STAGE_PAD]);
  // Without the heights, it is 900's: no node moves.
  assert.deepEqual(editWorkflow(w, { resizeStage: { id: 'stage-1', w: 10 } }).nodes.map((n) => n.x), w.nodes.map((n) => n.x));
  assert.equal(checkWorkflow(in200), true);
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
  assert.deepEqual(schemaCheck('workflow.v3.json')(w), []);
  assert.notDeepEqual(schemaCheck('workflow.v3.json')({ ...w, stages: [{ id: 'stage-1', label: '', x: 0 }] }), []);
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
