/**
 * A route may hold BEND POINTS: `via: [{x,y}]`, sorted by x, beside `from` and `to`. The pure edits `{ bend }` and
 * `{ unbend }` change them; the last one removed clears `via`; a rerouted or cut route drops them; a Custom Node body
 * keeps them and its version ignores them; a v1 reads none; the curve through none is the default. Will, TODO 744.
 *
 *   node --test test/unit/a-route-bends-where-the-reader-put-them.test.mjs
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { schemaCheck } from '../../scripts/lib/schema-check.mjs';

const core = new URL('../../dist/core/', import.meta.url);
const { editWorkflow, readWorkflow, workflowFaults } = await import(new URL('data/workflow.js', core));
const { placeBend, dropBend } = await import(new URL('data/route-bends.js', core));
const { versionOf } = await import(new URL('data/node-library.js', core));
const { pathThrough, dotsThrough, waypointsOf, handlesOf, middleOf } = await import(new URL('ui/route-path.js', core));

const route = { from: 's/rows', to: 'e' };
const flow = () => ({
  v: 2, id: 'f',
  nodes: [{ id: 's', kind: 'store', x: 0, y: 0, values: { store: 'users' } }, { id: 'e', kind: 'output', x: 700, y: 0 }],
  routes: [{ ...route }],
});
const bend = (w, at, x, y, insert = false) => editWorkflow(w, { bend: { route, at, x, y, insert } });

test('a bend with insert puts a point in; with none it moves one; the list stays sorted by x', () => {
  const one = bend(flow(), 0, 300, 90, true);
  assert.deepEqual(one.routes[0].via, [{ x: 300, y: 90 }]);
  const two = bend(one, 1, 500, 20, true);
  assert.deepEqual(two.routes[0].via, [{ x: 300, y: 90 }, { x: 500, y: 20 }]);
  // A point dragged past its neighbour stops a gap short of it (750), so the list stays sorted.
  const moved = bend(two, 0, 600, 5);
  assert.deepEqual(moved.routes[0].via.map((p) => p.x), [492, 500]);
  assert.deepEqual(workflowFaults(moved), []);
});

test('unbend of one of two leaves one; of the last clears via', () => {
  const two = bend(bend(flow(), 0, 300, 90, true), 1, 500, 20, true);
  const one = editWorkflow(two, { unbend: { route, index: 0 } });
  assert.deepEqual(one.routes[0].via, [{ x: 500, y: 20 }]);
  const none = editWorkflow(one, { unbend: { route, index: 0 } });
  assert.equal('via' in none.routes[0], false);
  assert.deepEqual(none, flow());
});

test('a route that is not there, a number that is not real, or a point that is not there is refused, and the workflow is untouched', () => {
  const w = flow();
  assert.equal(editWorkflow(w, { bend: { route: { from: 'x', to: 'y' }, at: 0, x: 1, y: 1, insert: true } }), w);
  assert.equal(bend(w, 0, Number.NaN, 1, true), w);
  assert.equal(bend(w, 0, 1, Infinity, true), w);
  assert.equal(bend(w, 3, 1, 1), w);
  assert.equal(editWorkflow(w, { unbend: { route, index: 0 } }), w);
});

test('a via that is out of order or not a point is a fault in words', () => {
  const w = flow();
  w.routes[0].via = [{ x: 500, y: 0 }, { x: 300, y: 0 }];
  assert.match(workflowFaults(w)[0], /not in order from left to right/);
  w.routes[0].via = [{ x: 'a', y: 0 }];
  assert.match(workflowFaults(w)[0], /a bend point needs a finite x and y/);
});

test('a rerouted, cut or removed route drops its bends', () => {
  const bent = bend(flow(), 0, 300, 90, true);
  assert.equal(editWorkflow(bent, { cut: route }).routes.length, 0);
  assert.equal(editWorkflow(bent, { cut: 'e' }).routes.length, 0);
  const again = editWorkflow(editWorkflow(bent, { cut: route }), { route });
  assert.equal('via' in again.routes[0], false);
  // The same route made again keeps what it has.
  assert.deepEqual(editWorkflow(bent, { route }).routes[0].via, [{ x: 300, y: 90 }]);
});

test('the schema takes via, in v2 and in a Custom Node body, and refuses a point with no y', () => {
  const ok = bend(flow(), 0, 300, 90, true);
  assert.deepEqual(schemaCheck('workflow.v2.json')(JSON.parse(JSON.stringify(ok))), []);
  const bad = JSON.parse(JSON.stringify(ok));
  bad.routes[0].via = [{ x: 3 }];
  assert.notDeepEqual(schemaCheck('workflow.v2.json')(bad), []);
  bad.routes[0].via = [];
  assert.notDeepEqual(schemaCheck('workflow.v2.json')(bad), []);
});

test('a v1 reads none; a Custom Node version ignores a bend', () => {
  const v1 = { v: 1, id: 'f', nodes: flow().nodes, routes: [{ ...route }] };
  assert.equal('via' in readWorkflow(v1).workflow.routes[0], false);
  const def = { v: 1, label: 'L', inputs: [], outputs: [], nodes: flow().nodes, routes: [{ ...route }] };
  const bent = { ...def, routes: [{ ...route, via: [{ x: 1, y: 2 }] }] };
  assert.equal(versionOf(bent), versionOf(def));
});

test('placeBend and dropBend', () => {
  assert.deepEqual(placeBend(undefined, 0, 10.4, 5, true), { via: [{ x: 10, y: 5 }], at: 0 });
  const r = placeBend([{ x: 10, y: 0 }, { x: 50, y: 0 }], 0, 90, 1);
  assert.deepEqual(r, { via: [{ x: 50, y: 0 }, { x: 90, y: 1 }], at: 1 });
  assert.equal(dropBend([{ x: 1, y: 1 }], 0), undefined);
});

test('the curve through no points is the default; through points it never loops back; each piece has its own middle', () => {
  const [a, b] = [[0, 0], [400, 100]];
  const dflt = `M 0 0 C ${200} 0, ${200} 100, 400 100`;
  assert.equal(pathThrough([a, b]), dflt);
  const way = waypointsOf([{ x: 150, y: 80 }, { x: 260, y: -60 }], []);
  const dots = dotsThrough([a, ...way.map((w) => w.at), b], true);
  assert.ok(dots.every((p, i) => i === 0 || p[0] >= dots[i - 1][0] - 1e-9), 'x never goes back');
  const near = (at) => Math.min(...dots.map((p) => Math.hypot(p[0] - at[0], p[1] - at[1])));
  assert.ok(near([150, 80]) < 0.01 && near([260, -60]) < 0.01);
  const hs = handlesOf(a, b, way);
  assert.equal(hs.length, 3);
  assert.deepEqual(hs.map((h) => h.insert), [0, 1, 2]);
  assert.deepEqual(hs[0].at, middleOf(a, [150, 80]));
  // None: one handle at the middle; a tie's slot makes two, and the bends beside it are not counted twice.
  assert.equal(handlesOf(a, b, []).length, 1);
  const tied = handlesOf(a, b, waypointsOf(undefined, [[200, 50]]));
  assert.deepEqual(tied.map((h) => h.insert), [0, 0]);
});

test('a tie takes a route by an edit, and refuses in words', () => {
  const w = {
    v: 2, id: 'f',
    nodes: [
      { id: 's', kind: 'store', x: 0, y: 0 }, { id: 'e', kind: 'output', x: 700, y: 0 },
      { id: 's2', kind: 'store', x: 0, y: 200 }, { id: 'e2', kind: 'output', x: 700, y: 200 },
    ],
    routes: [route, { from: 's2/rows', to: 'e2' }],
    ties: [{ id: 'tie-1', x: 400, y: 100, routes: [{ ...route }] }],
  };
  const add = editWorkflow(w, { tieAdd: { id: 'tie-1', route: { from: 's2/rows', to: 'e2' } } });
  assert.equal(add.ties[0].routes.length, 2);
  assert.equal(editWorkflow(add, { tieAdd: { id: 'tie-1', route: { from: 's2/rows', to: 'e2' } } }), add);
  assert.equal(editWorkflow(w, { tieAdd: { id: 'nope', route: route } }), w);
  assert.equal(editWorkflow(w, { tieAdd: { id: 'tie-1', route: { from: 'a', to: 'b' } } }), w);
  // A route whose nodes leave the tie no room where it stands is refused.
  const tight = { ...w, nodes: w.nodes.map((n) => (n.id === 'e2' ? { ...n, x: 100 } : n)) };
  assert.equal(editWorkflow(tight, { tieAdd: { id: 'tie-1', route: { from: 's2/rows', to: 'e2' } } }), tight);
});

test('TODO 750: a bend stays inside the end sockets and clear of its neighbours; a drawn list is held, the saved one is not rewritten', async () => {
  const { clampBend, clampedVia, BEND_INSET, BEND_GAP } = await import(new URL('data/route-bends.js', core));
  const ends = { from: 240, to: 700 };
  assert.equal(clampBend(ends, undefined, 0, 9000, true), 700 - BEND_INSET);
  assert.equal(clampBend(ends, undefined, 0, -50, true), 240 + BEND_INSET);
  const via = [{ x: 300, y: 0 }, { x: 500, y: 0 }];
  assert.equal(clampBend(ends, via, 0, 600), 500 - BEND_GAP);
  assert.equal(clampBend(ends, via, 1, 100), 300 + BEND_GAP);
  // A point right of a tie slot stays right of it.
  assert.equal(clampBend(ends, via, 1, 400, false, [450]), 450 + BEND_GAP);
  // The edit obeys it: a bend dragged far past the target socket stops at the limit.
  const w = flow();
  const far = editWorkflow(w, { bend: { route, at: 0, x: 5000, y: 10, insert: true } });
  assert.equal(far.routes[0].via[0].x, 700 - BEND_INSET);
  // A node moved later: the saved bend is outside, the drawn one is held, and the saved one is untouched.
  const saved = [{ x: 650, y: 5 }];
  const held = clampedVia(saved, { from: 240, to: 400 });
  assert.equal(held[0].x, 400 - BEND_INSET);
  assert.equal(saved[0].x, 650);
  assert.equal(clampedVia(saved, ends)[0], saved[0]);
});
