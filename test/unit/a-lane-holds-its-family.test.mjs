/**
 * SWIMLANES are rows down a workflow's canvas, one for each family of nodes. A node stands in the lane its family names;
 * a logic node, whose family no lane names, stands in the JUNCTION between the lanes of the nodes it joins, or in the one
 * lane they share. A band grows to hold its nodes and pushes the bands under it down; a band with no node takes no room.
 * On and off is one edit, and the nodes stay where they are. Will, 2026-11-10
 *
 *   node --test test/unit/a-lane-holds-its-family.test.mjs
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { schemaCheck } from '../../scripts/lib/schema-check.mjs';

const core = new URL('../../dist/core/data/', import.meta.url);
const { editWorkflow, checkWorkflow } = await import(new URL('workflow.js', core));
const { NODE_KINDS } = await import(new URL('node-kinds.js', core));
const { LANES_BY_FAMILY, LANE_PAD, LANE_GAP, laneOf, laneBands, fitLanes } = await import(new URL('node-lanes.js', core));

const H = () => 100;
// A Source (Data) and a Value (Values) meet at a Condition (logic), which sends to a Sort (Organise) and an Output.
const flow = () => editWorkflow({
  v: 2, id: 'l',
  nodes: [
    { id: 'src', kind: 'source', x: 0, y: 0 }, { id: 'val', kind: 'value', x: 0, y: 300 },
    { id: 'cond', kind: 'condition', x: 300, y: 150 }, { id: 'sort', kind: 'sort', x: 600, y: 150 },
    { id: 'out', kind: 'output', x: 900, y: 150 }, { id: 'lone', kind: 'condition', x: 0, y: 900 },
  ],
  routes: [{ from: 'src/rows', to: 'cond' }, { from: 'val/value', to: 'cond/b' }, { from: 'cond/rows', to: 'sort' }, { from: 'sort/rows', to: 'out' }],
}, { lanes: LANES_BY_FAMILY });

test('a node stands in its family\'s lane; a logic node in the junction between the lanes it joins; one joined to none, in none', () => {
  const w = flow();
  const at = (id) => laneOf(w, id, NODE_KINDS);
  assert.equal(at('src'), 'data');
  assert.equal(at('val'), 'values');
  assert.equal(at('sort'), 'organise');
  assert.equal(at('out'), 'output');
  // It joins Data, Values and Organise: the junction just above the lowest, under Values.
  assert.equal(at('cond'), 'junction:values');
  assert.equal(at('lone'), undefined);
});

test('the bands stand top to bottom in the lanes\' order, a gap apart; a band with no node takes no room', () => {
  const w = flow();
  const { bands } = laneBands(w, H, NODE_KINDS);
  const ids = bands.map((b) => b.id);
  assert.ok(!ids.includes('agentic') && !ids.includes('custom'), 'no AI or Custom node: no band');
  for (let i = 1; i < bands.length; i++) assert.ok(bands[i].top >= bands[i - 1].bottom + LANE_GAP, `${ids[i]} under ${ids[i - 1]}`);
  assert.equal(bands[0].top, -LANE_PAD);
  assert.ok(bands.find((b) => b.junction), 'a junction is drawn');
});

test('a band that grows pushes the ones under it, and their nodes, down; the fit is what the bands say', () => {
  const w = flow();
  const fit = fitLanes(w, H, NODE_KINDS);
  const y = (wf, id) => wf.nodes.find((n) => n.id === id).y;
  // Data holds src at 0; Values starts under it, so val moves down past Data's bottom.
  assert.ok(y(fit, 'val') >= 0 + 100 + LANE_PAD + LANE_GAP + LANE_PAD);
  assert.equal(fitLanes(fit, H, NODE_KINDS), fit, 'fitted, it is fitted');
  // A node dragged up out of its lane stands back under the lane above.
  const dragged = { ...fit, nodes: fit.nodes.map((n) => (n.id === 'out' ? { ...n, y: -500 } : n)) };
  const back = fitLanes(dragged, H, NODE_KINDS);
  const { bands } = laneBands(back, H, NODE_KINDS);
  const above = bands[bands.findIndex((b) => b.id === 'output') - 1];
  assert.ok(y(back, 'out') >= above.bottom + LANE_GAP + LANE_PAD - 1);
});

test('lanes on and off is one edit; off, the nodes stay; the schema takes them; a family in two lanes is a fault', () => {
  const w = flow();
  assert.equal(checkWorkflow(w), true);
  assert.deepEqual(schemaCheck('workflow.v2.json')(w), []);
  const off = editWorkflow(w, { lanes: null });
  assert.equal(off.lanes, undefined);
  assert.deepEqual(off.nodes, w.nodes);
  const twice = { ...w, lanes: [...w.lanes, { id: 'more', label: 'More', families: ['ai'] }] };
  assert.equal(checkWorkflow(twice), false);
});
