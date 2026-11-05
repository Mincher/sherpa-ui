/**
 * ARRANGE lays picked nodes out in columns along their routes, rows ordered to cross least, on the
 * 4px grid, the top-left kept, ties centred in the gaps; `place` is its ONE edit, with bends reset.
 * Will, TODO 752 · docs/history/plan-752-arrange.md
 *
 *   node --test test/unit/arrange-puts-picked-nodes-on-a-grid.test.mjs
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

const core = new URL('../../dist/core/data/', import.meta.url);
const { arrangeNodes, crossings } = await import(new URL('node-arrange.js', core));
const { editWorkflow } = await import(new URL('workflow.js', core));

const box = { w: 240, h: 100 };
const boxesOf = (ids) => Object.fromEntries(ids.map((id) => [id, box]));
const opts = (ids) => ({ gapX: 56, gapY: 56, grid: 4, boxes: boxesOf(ids) });
const R = (a, b) => ({ from: a, to: b });
const graphOf = (nodes, routes, ties) => ({ nodes: nodes.map(([id, x, y]) => ({ id, x, y })), routes, ...(ties ? { ties } : {}) });
const places = (g, out) => ({ ...Object.fromEntries(g.nodes.map((n) => [n.id, { x: n.x, y: n.y }])), ...out.nodes });

// A messy diamond: a feeds b and c, both feed d. Drawn crossed.
const messy = graphOf([['a', 300, 500], ['b', 20, 40], ['c', 700, 300], ['d', 90, 220]], [R('a', 'b'), R('a', 'c'), R('b', 'd'), R('c', 'd')]);

test('columns follow the flow: sources left, each column one gap right of the last', () => {
  const out = arrangeNodes(messy, ['a', 'b', 'c', 'd'], opts(['a', 'b', 'c', 'd']));
  const { a, b, c, d } = out.nodes;
  assert.ok(a.x < b.x && b.x === c.x && c.x < d.x);
  assert.equal(b.x - (a.x + 240), 56);
  assert.equal(d.x - (b.x + 240), 56);
});

test('every place is on the 4px grid; the top-left is where the picked nodes\' was', () => {
  const g = graphOf([['a', 301, 503], ['b', 21, 41], ['c', 700, 300]], [R('a', 'b'), R('b', 'c')]);
  const out = arrangeNodes(g, ['a', 'b', 'c'], opts(['a', 'b', 'c']));
  for (const p of Object.values(out.nodes)) assert.ok(p.x % 4 === 0 && p.y % 4 === 0, JSON.stringify(p));
  assert.equal(Math.min(...Object.values(out.nodes).map((p) => p.x)), 20);
  assert.equal(Math.min(...Object.values(out.nodes).map((p) => p.y)), 40);
});

test('rows in a column are a gap apart, and an odd height stays on the grid', () => {
  const g = graphOf([['a', 0, 0], ['b', 0, 10], ['c', 0, 20]], [R('a', 'c'), R('b', 'c')]);
  const out = arrangeNodes(g, ['a', 'b', 'c'], { gapX: 56, gapY: 56, boxes: { a: { w: 240, h: 101 }, b: box, c: box } });
  const [one, two] = [out.nodes.a, out.nodes.b].sort((p, q) => p.y - q.y);
  assert.ok(Math.abs(two.y - (one.y + 101) - 56) <= 3);
  assert.equal(out.nodes.a.x, out.nodes.b.x);
});

test('the sweep orders rows so the lines cross less, never more than the input', () => {
  const ids = ['a', 'b', 'c', 'd'];
  const g = graphOf([['a', 0, 0], ['b', 0, 200], ['c', 400, 0], ['d', 400, 200]], [R('a', 'd'), R('b', 'c')]);
  const out = arrangeNodes(g, ids, opts(ids));
  assert.equal(crossings(places(g, out), boxesOf(ids), g.routes), 0);
  assert.ok(crossings(places(g, out), boxesOf(ids), g.routes) <= crossings(places(g, { nodes: {} }), boxesOf(ids), g.routes));
});

test('random DAGs: far fewer crossings in all, worse than the input in only a few', () => {
  let seed = 7;
  const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
  let worse = 0, before = 0, after = 0;
  const rounds = 100;
  for (let round = 0; round < rounds; round++) {
    const n = 4 + Math.floor(rnd() * 8);
    const ids = Array.from({ length: n }, (_, i) => `n${i}`);
    const routes = [];
    for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) if (rnd() < 0.25) routes.push(R(ids[i], ids[j]));
    const g = graphOf(ids.map((id) => [id, Math.floor(rnd() * 900), Math.floor(rnd() * 600)]), routes);
    const out = arrangeNodes(g, ids, opts(ids));
    assert.deepEqual(arrangeNodes(g, ids, opts(ids)), out, 'deterministic');
    const was = crossings(places(g, { nodes: {} }), boxesOf(ids), routes);
    const now = crossings(places(g, out), boxesOf(ids), routes);
    before += was; after += now; if (now > was) worse++;
  }
  assert.ok(after * 2 < before, `${after} vs ${before}`);
  assert.ok(worse <= rounds * 0.1, `${worse} worse`);
});

test('a single column, and fewer than two nodes', () => {
  const g = graphOf([['a', 5, 5], ['b', 90, 30], ['c', 10, 400]], []);
  const out = arrangeNodes(g, ['a', 'b', 'c'], opts(['a', 'b', 'c']));
  assert.equal(new Set(Object.values(out.nodes).map((p) => p.x)).size, 1);
  assert.deepEqual(arrangeNodes(g, ['a'], opts(['a'])), { nodes: {}, ties: {} });
});

test('a cycle ends, and every node is placed', () => {
  const g = graphOf([['a', 0, 0], ['b', 0, 100], ['c', 0, 200]], [R('a', 'b'), R('b', 'c'), R('c', 'a')]);
  const out = arrangeNodes(g, ['a', 'b', 'c'], opts(['a', 'b', 'c']));
  assert.equal(Object.keys(out.nodes).length, 3);
});

test('a tie stands in the gap, several equally spaced, at the mean height of its routes', () => {
  const ids = ['a', 'b', 'c', 'd'];
  const g = graphOf([['a', 0, 0], ['b', 0, 300], ['c', 600, 0], ['d', 600, 300]], [R('a', 'c'), R('b', 'd')],
    [{ id: 't1', x: 300, y: 0, routes: [R('a', 'c')] }, { id: 't2', x: 310, y: 0, routes: [R('b', 'd')] }]);
  const out = arrangeNodes(g, ids, opts(ids));
  const [t1, t2] = [out.ties.t1, out.ties.t2];
  const gap = [240, 296];
  assert.ok(t1.x > gap[0] && t2.x < gap[1]);
  assert.ok(Math.abs((t1.x - gap[0]) - (gap[1] - t2.x)) <= 1, 'equal margins');
  // one tie sits at the gap's centre
  const one = arrangeNodes(graphOf([['a', 0, 0], ['c', 600, 0]], [R('a', 'c')], [{ id: 't', x: 0, y: 0, routes: [R('a', 'c')] }]), ['a', 'c'], opts(['a', 'c']));
  assert.equal(one.ties.t.x, 240 + 28);
});

test('place: nodes, ties and bends in one edit; bends reset on a touched route; the rest left', () => {
  const w = {
    v: 2, id: 'p',
    nodes: [{ id: 'a', kind: 'store', x: 0, y: 0 }, { id: 'b', kind: 'output', x: 600, y: 0 }, { id: 'c', kind: 'store', x: 0, y: 200 }, { id: 'd', kind: 'output', x: 600, y: 200 }],
    routes: [{ from: 'a/rows', to: 'b', via: [{ x: 300, y: 50 }] }, { from: 'c/rows', to: 'd', via: [{ x: 300, y: 250 }] }],
  };
  const next = editWorkflow(w, { place: { nodes: { a: { x: 4, y: 8 }, b: { x: 644, y: 8 } }, bends: 'reset' } });
  assert.equal(next.nodes[0].x, 4);
  assert.equal(next.routes[0].via, undefined);
  assert.deepEqual(next.routes[1].via, [{ x: 300, y: 250 }]);
  const shifted = editWorkflow(w, { place: { nodes: { a: { x: 10, y: 20 }, b: { x: 610, y: 20 } }, bends: { dx: 10, dy: 20 } } });
  assert.deepEqual(shifted.routes[0].via, [{ x: 310, y: 70 }]);
  assert.deepEqual(shifted.routes[1].via, [{ x: 300, y: 250 }]);
});

test('place: faults in words, and the workflow comes back untouched', () => {
  const w = { v: 2, id: 'p', nodes: [{ id: 'a', kind: 'store', x: 0, y: 0 }, { id: 'b', kind: 'output', x: 6, y: 0 }], routes: [] };
  assert.equal(editWorkflow(w, { place: { nodes: { a: { x: 1, y: 1 } } } }), w);
  assert.equal(editWorkflow(w, { place: { nodes: { a: { x: 1, y: 1 }, z: { x: 1, y: 1 } } } }), w);
  assert.equal(editWorkflow(w, { place: { nodes: { a: { x: NaN, y: 1 }, b: { x: 1, y: 1 } } } }), w);
});
