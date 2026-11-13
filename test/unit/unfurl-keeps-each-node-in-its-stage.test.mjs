/**
 * UNFURL keeps each node in its STAGE. A graph in stages unfurls by the flow, each stage's nodes inside its own band, the
 * stages left to right a gap apart, the first where it stood: so the stages fit their nodes, and push none; and each node
 * right of what feeds it (Will, 2026-11-12). A lone node stands in its own stage's stack; one in no stage joins the nearest.
 * No stages, as before. TODO 950
 *
 *   node --test test/unit/unfurl-keeps-each-node-in-its-stage.test.mjs
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

const core = new URL('../../dist/core/data/', import.meta.url);
const { unfurlNodes } = await import(new URL('node-unfurl.js', core));
const { stageBands, fitStages, STAGE_PAD, STAGE_GAP, STAGE_MIN } = await import(new URL('node-stages.js', core));
const { editWorkflow, nodeWidth } = await import(new URL('workflow.js', core));

const GAP = 168;
const H = 120;
const R = (from, to) => ({ from, to });
const node = (address) => address.split('/')[0];

/** Demos' made Coworker (TODO 950): Plan, Run and Report, each node naming its stage; lines across them; a lone node in Report. */
function coworker() {
  const at = (id, kind, x, y, stage) => ({ id, kind, x, y, stage });
  return {
    v: 3, id: 'cw',
    stages: [{ id: 'plan', label: 'Plan', x: -40 }, { id: 'run', label: 'Run', x: 1920 }, { id: 'report', label: 'Report', x: 2800 }],
    nodes: [
      at('when', 'value', 0, 900, 'plan'), at('devices', 'source', 0, 0, 'plan'), at('customer', 'field', 360, 0, 'plan'),
      at('theirs', 'condition', 720, 0, 'plan'), at('provider', 'value', 0, 500, 'plan'), at('model', 'value', 360, 500, 'plan'),
      at('brief', 'math', 1100, 300, 'plan'), at('expert-1', 'organise', 1100, 700, 'plan'),
      at('run', 'organise', 1960, 0, 'run'),
      at('count', 'math', 2840, 0, 'report'), at('done', 'result', 3600, 0, 'report'), at('notice', 'result', 3600, 300, 'report'),
      at('expert-2', 'organise', 2840, 700, 'report'), at('expert-3', 'organise', 2840, 1100, 'report'), at('note', 'value', 3200, 1500, 'report'),
    ],
    connections: [
      R('devices/rows', 'customer'), R('customer/field', 'theirs'), R('provider/value', 'model/a'), R('model/value', 'brief/a'),
      R('theirs/rows', 'brief'), R('theirs/rows', 'run'), R('run/rows', 'count'), R('run/rows', 'done'),
      R('brief/result', 'expert-1'), R('expert-1/rows', 'expert-2'), R('expert-2/rows', 'expert-3'), R('expert-3/rows', 'notice'),
    ],
  };
}

const boxesOf = (w) => Object.fromEntries(w.nodes.map((n) => [n.id, { w: nodeWidth(n), h: H }]));
/** Unfurl as the editor does: every node, the stages read; the places written in one edit; the stages fitted after. */
function unfurled(w) {
  const placed = unfurlNodes(w, w.nodes.map((n) => n.id), { gapX: GAP, gapY: GAP, grid: 4, boxes: boxesOf(w) });
  const laid = editWorkflow(w, { place: { nodes: placed.nodes, ties: placed.ties, bends: 'reset', ...(placed.stages ? { stages: placed.stages } : {}) } });
  return { placed, laid, fit: fitStages(laid, nodeWidth) };
}
function overlaps(w) {
  const hit = [];
  for (let i = 0; i < w.nodes.length; i++) for (let j = i + 1; j < w.nodes.length; j++) {
    const [a, b] = [w.nodes[i], w.nodes[j]];
    if (a.x < b.x + nodeWidth(b) && b.x < a.x + nodeWidth(a) && a.y < b.y + H && b.y < a.y + H) hit.push(`${a.id}~${b.id}`);
  }
  return hit;
}

test('a graph in stages unfurls with no two nodes on each other, each node in its own stage', () => {
  const w = coworker();
  const { fit } = unfurled(w);
  assert.deepEqual(overlaps(fit), []);
  for (const n of w.nodes) assert.equal(fit.nodes.find((m) => m.id === n.id).stage, n.stage, n.id);
});

test('each stage holds its nodes inside its band, the stages left to right a gap apart, the first where it stood', () => {
  const w = coworker();
  const { fit } = unfurled(w);
  const { bands } = stageBands(fit, nodeWidth);
  assert.deepEqual(bands.map((b) => b.id), ['plan', 'run', 'report']);
  assert.equal(bands[0].left, -40);
  for (let i = 1; i < bands.length; i++) assert.equal(bands[i].left, bands[i - 1].right + STAGE_GAP, bands[i].id);
  for (const n of fit.nodes) {
    const band = bands.find((b) => b.id === n.stage);
    assert.ok(n.x >= band.left + STAGE_PAD && n.x + nodeWidth(n) <= band.right - STAGE_PAD, `${n.id} in ${n.stage}`);
  }
  // Each fits its nodes: as wide as an empty stage at the least, and no wider than its nodes side by side.
  for (const b of bands) {
    const ns = fit.nodes.filter((n) => n.stage === b.id);
    const most = Math.max(STAGE_MIN, ns.reduce((s, n) => s + nodeWidth(n) + GAP, -GAP) + 2 * STAGE_PAD);
    assert.ok(b.right - b.left >= STAGE_MIN && b.right - b.left <= most, `${b.id} is ${b.right - b.left} wide`);
  }
});

test('the unfurl places the stages too: fitting them after moves no node, each on the 4px grid', () => {
  const w = coworker();
  const { placed, laid, fit } = unfurled(w);
  assert.deepEqual(fit.nodes.map((n) => [n.id, n.x, n.y]), laid.nodes.map((n) => [n.id, n.x, n.y]));
  assert.deepEqual(Object.keys(placed.stages ?? {}), ['plan', 'run', 'report']);
  for (const n of fit.nodes) assert.deepEqual([n.x % 4, n.y % 4].map(Math.abs), [0, 0], n.id);
});

test('each stage\'s width fits its unfurled nodes: a width kept from a drag goes, wide or narrow (Will, 2026-11-12)', () => {
  const w = coworker();
  // Run dragged far wider than its one node needs; Report narrower than its nodes.
  const dragged = { ...w, stages: w.stages.map((s) => (s.id === 'run' ? { ...s, w: 3000 } : s.id === 'report' ? { ...s, w: 200 } : s)) };
  const { laid, fit } = unfurled(dragged);
  assert.deepEqual(laid.stages.map((s) => 'w' in s), [false, false, false]);
  const right = (id) => Math.max(...fit.nodes.filter((n) => n.stage === id).map((n) => n.x + nodeWidth(n)));
  const band = (id) => stageBands(fit, nodeWidth).bands.find((b) => b.id === id);
  for (const id of ['run', 'report']) assert.equal(band(id).right, Math.max(right(id) + STAGE_PAD, band(id).left + STAGE_MIN), id);
  // As if never dragged.
  assert.deepEqual(fit.nodes.map((n) => [n.id, n.x, n.y]), unfurled(w).fit.nodes.map((n) => [n.id, n.x, n.y]));
});

test('each node stands right of every node that feeds it, across the stage edges too (Will, 2026-11-12)', () => {
  const w = coworker();
  const { fit } = unfurled(w);
  const at = Object.fromEntries(fit.nodes.map((n) => [n.id, n]));
  const left = (r) => at[node(r.to)].x < at[node(r.from)].x + nodeWidth(at[node(r.from)]);
  // Pushed by the stages after a flow-only unfurl, expert-3 and the notice stood level with what feeds them.
  for (const [from, to] of [['expert-2', 'expert-3'], ['expert-3', 'notice']]) assert.ok(at[to].x >= at[from].x + nodeWidth(at[from]) + GAP, `${from} > ${to}`);
  assert.deepEqual(w.connections.filter(left), []);
});

test('a node in no stage joins the one nearest where it stood, and is laid out in it: no push after', () => {
  const w = coworker();
  const loose = { ...w, nodes: w.nodes.map(({ stage, ...n }) => (n.id === 'run' ? n : { ...n, stage })) };
  const { placed, laid, fit } = unfurled(loose);
  assert.equal(placed.nodes.run.stage, 'run');
  assert.equal(fit.nodes.find((n) => n.id === 'run').stage, 'run');
  assert.deepEqual(fit.nodes.map((n) => [n.id, n.x, n.y]), laid.nodes.map((n) => [n.id, n.x, n.y]));
  assert.deepEqual(overlaps(fit), []);
});

test('a second Unfurl gives the same places', () => {
  const once = unfurled(coworker()).fit;
  const twice = unfurled(once).fit;
  assert.deepEqual(twice.nodes, once.nodes);
  assert.deepEqual(twice.stages, once.stages);
});

test('a lone node stands in its own stage, left of the stage\'s other nodes, as the stack does', () => {
  const { fit } = unfurled(coworker());
  const report = stageBands(fit, nodeWidth).bands.find((b) => b.id === 'report');
  const note = fit.nodes.find((n) => n.id === 'note');
  const rest = fit.nodes.filter((n) => n.stage === 'report' && n !== note);
  assert.equal(note.x, report.left + STAGE_PAD);
  assert.ok(note.x + nodeWidth(note) + GAP <= Math.min(...rest.map((n) => n.x)));
});

test('a graph with no stages unfurls as before: the stages its nodes name are not read, and none are placed', () => {
  const w = coworker();
  const { stages: _stages, ...bare } = w;
  const ids = w.nodes.map((n) => n.id);
  const opts = { gapX: GAP, gapY: GAP, grid: 4, boxes: boxesOf(w) };
  const named = unfurlNodes(bare, ids, opts);
  const unnamed = unfurlNodes({ ...bare, nodes: bare.nodes.map(({ stage: _s, ...n }) => n) }, ids, opts);
  assert.deepEqual(named, unnamed);
  assert.equal('stages' in named, false);
});
