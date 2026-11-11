/**
 * SWIMLANES are rows down a workflow's canvas, one for each family of nodes. A node stands in the lane its family names;
 * a logic node, whose family no lane names, stands in the JUNCTION between the lanes of the nodes it joins, or under the one
 * lane they share: never in a lane. A portal is one too, an In and an Out of one name joined (TODO 915). A band grows to hold its nodes and pushes the bands under it down; a band with no node takes no room.
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

test('a condition fed from one lane stands in the junction under it, never in it; a portal stands with the conditions it links (915, 928)', () => {
  const w = editWorkflow({
    v: 2, id: 'p',
    nodes: [
      { id: 'a', kind: 'value', x: 0, y: 0 }, { id: 'b', kind: 'value', x: 0, y: 200 }, { id: 'is', kind: 'condition', x: 300, y: 100 },
      // The condition sends through a portal, In and Out of one name, to an Output.
      { id: 'in', kind: 'portal', x: 600, y: 100, values: { type: 'in', name: 'ok' } },
      { id: 'out-p', kind: 'portal', x: 900, y: 100, values: { type: 'out', name: 'ok' } },
      { id: 'end', kind: 'output', x: 1200, y: 100 },
      // A portal of another name, fed by values only.
      { id: 'alone', kind: 'portal', x: 600, y: 400, values: { type: 'in', name: 'other' } },
    ],
    routes: [
      { from: 'a/value', to: 'is' }, { from: 'b/value', to: 'is/b' }, { from: 'is', to: 'in' },
      { from: 'out-p', to: 'end' }, { from: 'b/value', to: 'alone' },
    ],
  }, { lanes: LANES_BY_FAMILY });
  const at = (id) => laneOf(w, id, NODE_KINDS);
  // Fed from Values: the junction under Values, though it reaches the Output; a portal by what feeds it, an Out by its In.
  assert.equal(at('is'), 'junction:values');
  assert.equal(at('in'), 'junction:values');
  assert.equal(at('out-p'), 'junction:values');
  assert.equal(at('alone'), 'junction:values');
  const lone = editWorkflow({ v: 2, id: 'q', nodes: [{ id: 'a', kind: 'value', x: 0, y: 0 }, { id: 'is', kind: 'condition', x: 300, y: 0 }], routes: [{ from: 'a/value', to: 'is' }] }, { lanes: LANES_BY_FAMILY });
  assert.equal(laneOf(lone, 'is', NODE_KINDS), 'junction:values');
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

test('lanes on keep each node\'s place, and off puts it back — one placed since stays; one edit each way; the schema takes them (929)', () => {
  const w = flow();
  assert.deepEqual(w.beforeLanes.cond, { x: 300, y: 150 });
  assert.equal(checkWorkflow(w), true);
  assert.deepEqual(schemaCheck('workflow.v2.json')(w), []);
  // Laid out, the lanes move the nodes down; a node placed while they are on has no place before.
  const laid = fitLanes(w, H, NODE_KINDS);
  assert.notDeepEqual(laid.nodes.map((n) => n.y), w.nodes.map((n) => n.y));
  const added = { ...laid, nodes: [...laid.nodes, { id: 'new', kind: 'value', x: 5, y: 777 }] };
  const off = editWorkflow(added, { lanes: null });
  assert.equal(off.lanes, undefined);
  assert.equal(off.beforeLanes, undefined);
  assert.deepEqual(off.nodes.map((n) => [n.id, n.x, n.y]), [...w.nodes.map((n) => [n.id, n.x, n.y]), ['new', 5, 777]]);
  // On again: the places kept are the ones before, not re-taken.
  assert.deepEqual(editWorkflow(laid, { lanes: LANES_BY_FAMILY }).beforeLanes, w.beforeLanes);
  const twice = { ...w, lanes: [...w.lanes, { id: 'more', label: 'More', families: ['ai'] }] };
  assert.equal(checkWorkflow(twice), false);
});

test('lane A › junction › lane A › junction is ONE junction lane: each stands under the lane its inputs come from (928)', () => {
  const w = editWorkflow({
    v: 2, id: 'j',
    nodes: [
      { id: 'a', kind: 'value', x: 0, y: 0 }, { id: 'c1', kind: 'condition', x: 300, y: 0 },
      { id: 'm', kind: 'math', x: 600, y: 0 }, { id: 'c2', kind: 'condition', x: 900, y: 0 },
      { id: 'end', kind: 'output', x: 1200, y: 0 }, { id: 'c0', kind: 'condition', x: 900, y: 600 },
    ],
    routes: [
      { from: 'a/value', to: 'c1' }, { from: 'c1', to: 'm/a' }, { from: 'm/result', to: 'c2' }, { from: 'c2', to: 'end' },
      // Fed from no lane: by what it joins, the Output.
      { from: 'c0', to: 'end' },
    ],
  }, { lanes: LANES_BY_FAMILY });
  const at = (id) => laneOf(w, id, NODE_KINDS);
  assert.deepEqual([at('a'), at('m'), at('c1'), at('c2'), at('end')], ['values', 'values', 'junction:values', 'junction:values', 'output']);
  assert.equal(at('c0'), 'junction:output');
  const bands = laneBands(w, H, NODE_KINDS).bands.map((b) => b.id);
  assert.deepEqual(bands, ['values', 'junction:values', 'output', 'junction:output']);
});

