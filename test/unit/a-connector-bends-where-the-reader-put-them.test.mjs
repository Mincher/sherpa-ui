/**
 * A connection may hold BEND POINTS: `via: [{x,y}]`, sorted by x, beside `from` and `to`. The pure edits `{ bend }` and
 * `{ unbend }` change them; the last one removed clears `via`; a reconnected or cut connection drops them; a Custom Node body
 * keeps them and its version ignores them; a v1 reads none; the curve through none is the default. Will, TODO 744.
 * TODO 754: a tied connection has no handles and no bends; only a point the reader moved is in `via`.
 *
 *   node --test test/unit/a-connector-bends-where-the-reader-put-them.test.mjs
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { schemaCheck } from '../../scripts/lib/schema-check.mjs';

const core = new URL('../../dist/core/', import.meta.url);
const { editWorkflow, readWorkflow, workflowFaults } = await import(new URL('data/workflow.js', core));
const { placeBend, dropBend } = await import(new URL('data/connector-bends.js', core));
const { versionOf } = await import(new URL('data/node-library.js', core));
const { pathThrough, dotsThrough, waypointsOf, handlesOf, middleOf, controlsThrough } = await import(new URL('ui/connector-path.js', core));

const connection = { from: 's/rows', to: 'e' };
const flow = () => ({
  v: 3, id: 'f',
  nodes: [{ id: 's', kind: 'source', x: 0, y: 0, values: { store: 'users' } }, { id: 'e', kind: 'result', x: 700, y: 0 }],
  connections: [{ ...connection }],
});
const bend = (w, at, x, y, insert = false) => editWorkflow(w, { bend: { connection, at, x, y, insert } });

test('a bend with insert puts a point in; with none it moves one; the list stays sorted by x', () => {
  const one = bend(flow(), 0, 300, 90, true);
  assert.deepEqual(one.connections[0].via, [{ x: 300, y: 90 }]);
  const two = bend(one, 1, 500, 20, true);
  assert.deepEqual(two.connections[0].via, [{ x: 300, y: 90 }, { x: 500, y: 20 }]);
  // A point dragged past its neighbour stops a gap short of it (750), so the list stays sorted.
  const moved = bend(two, 0, 600, 5);
  assert.deepEqual(moved.connections[0].via.map((p) => p.x), [492, 500]);
  assert.deepEqual(workflowFaults(moved), []);
});

test('unbend of one of two leaves one; of the last clears via', () => {
  const two = bend(bend(flow(), 0, 300, 90, true), 1, 500, 20, true);
  const one = editWorkflow(two, { unbend: { connection, index: 0 } });
  assert.deepEqual(one.connections[0].via, [{ x: 500, y: 20 }]);
  const none = editWorkflow(one, { unbend: { connection, index: 0 } });
  assert.equal('via' in none.connections[0], false);
  // A bend is hand layout: the mark stays till an Unfurl (1001c).
  assert.deepEqual(none, { ...flow(), byHand: true });
});

test('a connection that is not there, a number that is not real, or a point that is not there is refused, and the workflow is untouched', () => {
  const w = flow();
  assert.equal(editWorkflow(w, { bend: { connection: { from: 'x', to: 'y' }, at: 0, x: 1, y: 1, insert: true } }), w);
  assert.equal(bend(w, 0, Number.NaN, 1, true), w);
  assert.equal(bend(w, 0, 1, Infinity, true), w);
  assert.equal(bend(w, 3, 1, 1), w);
  assert.equal(editWorkflow(w, { unbend: { connection, index: 0 } }), w);
});

test('a via that is out of order or not a point is a fault in words', () => {
  const w = flow();
  w.connections[0].via = [{ x: 500, y: 0 }, { x: 300, y: 0 }];
  assert.match(workflowFaults(w)[0], /not in order from left to right/);
  w.connections[0].via = [{ x: 'a', y: 0 }];
  assert.match(workflowFaults(w)[0], /a bend point needs a finite x and y/);
});

test('a reconnected, cut or removed connection drops its bends', () => {
  const bent = bend(flow(), 0, 300, 90, true);
  assert.equal(editWorkflow(bent, { cut: connection }).connections.length, 0);
  assert.equal(editWorkflow(bent, { cut: 'e' }).connections.length, 0);
  const again = editWorkflow(editWorkflow(bent, { cut: connection }), { connection });
  assert.equal('via' in again.connections[0], false);
  // The same connection made again keeps what it has.
  assert.deepEqual(editWorkflow(bent, { connection }).connections[0].via, [{ x: 300, y: 90 }]);
});

test('the schema takes via, in v2 and in a Custom Node body, and refuses a point with no y', () => {
  const ok = bend(flow(), 0, 300, 90, true);
  assert.deepEqual(schemaCheck('workflow.v3.json')(JSON.parse(JSON.stringify(ok))), []);
  const bad = JSON.parse(JSON.stringify(ok));
  bad.connections[0].via = [{ x: 3 }];
  assert.notDeepEqual(schemaCheck('workflow.v3.json')(bad), []);
  bad.connections[0].via = [];
  assert.notDeepEqual(schemaCheck('workflow.v3.json')(bad), []);
});

test('a v1 is no workflow; a Custom Node version ignores a bend', () => {
  assert.equal(readWorkflow({ v: 1, id: 'f', nodes: flow().nodes, connections: [{ ...connection }] }).workflow, undefined);
  const def = { v: 1, label: 'L', inputs: [], outputs: [], nodes: flow().nodes, connections: [{ ...connection }] };
  const bent = { ...def, connections: [{ ...connection, via: [{ x: 1, y: 2 }] }] };
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
  const smooth = new Set([1, 2]);
  const dots = dotsThrough([a, ...way.map((w) => w.at), b], true, smooth);
  assert.ok(dots.every((p, i) => i === 0 || p[0] >= dots[i - 1][0] - 1e-9), 'x never goes back');
  const near = (at) => Math.min(...dots.map((p) => Math.hypot(p[0] - at[0], p[1] - at[1])));
  assert.ok(near([150, 80]) < 0.01 && near([260, -60]) < 0.01);
  const hs = handlesOf(a, b, way);
  assert.equal(hs.length, 3);
  assert.deepEqual(hs.map((h) => h.insert), [0, 1, 2]);
  // Each handle on the curve as drawn, at its piece's middle.
  for (const h of hs) assert.ok(near(h.at) < 2, `handle ${h.insert} on the curve`);
  assert.deepEqual(middleOf(a, [150, 80]), [75, 40], 'a flat piece: the plain middle');
  // None: one handle at the middle. A tied connection has none (754): its tie is its handle.
  assert.equal(handlesOf(a, b, []).length, 1);
  assert.deepEqual(handlesOf(a, b, waypointsOf(undefined, [[200, 50]])), []);
});

test('a tie takes a connection by an edit, and refuses in words', () => {
  const w = {
    v: 3, id: 'f',
    nodes: [
      { id: 's', kind: 'source', x: 0, y: 0 }, { id: 'e', kind: 'result', x: 700, y: 0 },
      { id: 's2', kind: 'source', x: 0, y: 200 }, { id: 'e2', kind: 'result', x: 700, y: 200 },
    ],
    connections: [connection, { from: 's2/rows', to: 'e2' }],
    ties: [{ id: 'tie-1', x: 400, y: 100, connections: [{ ...connection }] }],
  };
  const add = editWorkflow(w, { tieAdd: { id: 'tie-1', connection: { from: 's2/rows', to: 'e2' } } });
  assert.equal(add.ties[0].connections.length, 2);
  assert.equal(editWorkflow(add, { tieAdd: { id: 'tie-1', connection: { from: 's2/rows', to: 'e2' } } }), add);
  assert.equal(editWorkflow(w, { tieAdd: { id: 'nope', connection: connection } }), w);
  assert.equal(editWorkflow(w, { tieAdd: { id: 'tie-1', connection: { from: 'a', to: 'b' } } }), w);
  // A connection whose nodes leave its ties no room is refused (TODO 973).
  const tight = { ...w, nodes: w.nodes.map((n) => (n.id === 'e2' ? { ...n, x: 100 } : n)) };
  assert.equal(editWorkflow(tight, { tieAdd: { id: 'tie-1', connection: { from: 's2/rows', to: 'e2' } } }), tight);
});

test('TODO 750: a bend stays inside the end sockets and clear of its neighbours; a drawn list is held, the saved one is not rewritten', async () => {
  const { clampBend, clampedVia, BEND_INSET, BEND_GAP } = await import(new URL('data/connector-bends.js', core));
  const ends = { from: 240, to: 700 };
  assert.equal(clampBend(ends, undefined, 0, 9000, true), 700 - BEND_INSET);
  assert.equal(clampBend(ends, undefined, 0, -50, true), 240 + BEND_INSET);
  const via = [{ x: 300, y: 0 }, { x: 500, y: 0 }];
  assert.equal(clampBend(ends, via, 0, 600), 500 - BEND_GAP);
  assert.equal(clampBend(ends, via, 1, 100), 300 + BEND_GAP);
  // The edit obeys it: a bend dragged far past the target socket stops at the limit.
  const w = flow();
  const far = editWorkflow(w, { bend: { connection, at: 0, x: 5000, y: 10, insert: true } });
  assert.equal(far.connections[0].via[0].x, 700 - BEND_INSET);
  // A node moved later: the saved bend is outside, the drawn one is held, and the saved one is untouched.
  const saved = [{ x: 650, y: 5 }];
  const held = clampedVia(saved, { from: 240, to: 400 });
  assert.equal(held[0].x, 400 - BEND_INSET);
  assert.equal(saved[0].x, 650);
  assert.equal(clampedVia(saved, ends)[0], saved[0]);
});

// — TODO 754. (A) A zip tie is a handle: a tied connection has no mid-point handle and holds no bend.
const two = () => ({
  v: 3, id: 'f',
  nodes: [
    { id: 's', kind: 'source', x: 0, y: 0 }, { id: 'e', kind: 'result', x: 700, y: 0 },
    { id: 's2', kind: 'source', x: 0, y: 200 }, { id: 'e2', kind: 'result', x: 700, y: 200 },
  ],
  connections: [{ ...connection, via: [{ x: 300, y: 90 }] }, { from: 's2/rows', to: 'e2', via: [{ x: 420, y: 260 }] }],
});
const R2 = { from: 's2/rows', to: 'e2' };

test('754: a tied connection has no handle points, and is drawn through its ties alone', () => {
  const [a, b] = [[0, 0], [700, 0]];
  const way = waypointsOf([{ x: 300, y: 90 }], [[400, 40], [550, 20]]);
  assert.deepEqual(way, [{ at: [400, 40] }, { at: [550, 20] }]);
  assert.deepEqual(handlesOf(a, b, way), []);
  // Untied, its handles are proposed at the middles; none of them is a waypoint.
  const bent = waypointsOf([{ x: 300, y: 90 }], []);
  assert.deepEqual(bent, [{ at: [300, 90], bend: 0 }]);
  assert.deepEqual(handlesOf(a, b, bent).map((h) => h.insert), [0, 1]);
});

test('754: a tie clears the bends of the connections it takes, in the one edit; a connection it does not take keeps its own', () => {
  const tied = editWorkflow(two(), { tie: { connections: [connection], x: 400, y: 50 } });
  assert.equal('via' in tied.connections[0], false);
  assert.deepEqual(tied.connections[1].via, [{ x: 420, y: 260 }]);
  assert.equal(tied.ties.length, 1);
  assert.deepEqual(workflowFaults(tied), []);
  // A connector dropped on the tie: its bends go too.
  const added = editWorkflow(tied, { tieAdd: { id: 'tie-1', connection: R2 } });
  assert.equal(added.connections.some((r) => 'via' in r), false);
  assert.equal(added.ties[0].connections.length, 2);
});

test('754: a bend on a tied connection is refused in words, and the workflow is untouched', async () => {
  const tied = editWorkflow(two(), { tie: { connections: [connection], x: 400, y: 50 } });
  const { onReport } = await import(new URL('data/report.js', core));
  const said = [];
  const undo = onReport((r) => said.push(r.message));
  try {
    assert.equal(editWorkflow(tied, { bend: { connection, at: 0, x: 300, y: 90, insert: true } }), tied);
  } finally { undo(); }
  assert.deepEqual(said, ['editWorkflow: the connection "s/rows" → "e" is tied: its ties are its handles.']);
});

// (B) A mid-point handle is PROPOSED: only a point the reader moved is in `via`.
test('754: a bend edit writes the one point the reader moved; every other point is as it was', () => {
  const one = bend(flow(), 0, 300, 90, true);
  assert.deepEqual(one.connections[0].via, [{ x: 300, y: 90 }]);
  // A second point put in the right half: the first stays where the reader left it, and the halves' middles are not saved.
  const twice = bend(one, 1, 500, 20, true);
  assert.deepEqual(twice.connections[0].via, [{ x: 300, y: 90 }, { x: 500, y: 20 }]);
  // The first moved: the second, its neighbour, does not.
  const moved = bend(twice, 0, 320, 140);
  assert.deepEqual(moved.connections[0].via, [{ x: 320, y: 140 }, { x: 500, y: 20 }]);
  // Drawn, the waypoints are those two alone: no proposed dot bends the curve.
  assert.deepEqual(waypointsOf(moved.connections[0].via, []).map((w) => w.at), [[320, 140], [500, 20]]);
});

test('754: a group move shifts only the points the reader made, and Arrange clears them; neither adds one', () => {
  const w = { ...two(), connections: [{ ...connection, via: [{ x: 300, y: 90 }] }, { ...R2 }] };
  const moved = editWorkflow(w, { place: { nodes: { s: { x: 40, y: 10 }, e: { x: 740, y: 10 }, s2: { x: 40, y: 210 }, e2: { x: 740, y: 210 } }, bends: 'follow' } });
  assert.deepEqual(moved.connections[0].via, [{ x: 340, y: 100 }]);
  assert.equal('via' in moved.connections[1], false);
  const arranged = editWorkflow(w, { place: { nodes: { s: { x: 0, y: 0 }, e: { x: 400, y: 0 } }, bends: 'reset' } });
  assert.equal(arranged.connections.some((r) => 'via' in r), false);
});

// TRAP T-a-bend-is-a-smooth-point
test('a bend point is a smooth point: its two handles one straight line, of one length, inside the gaps in x; an end and a tie stay flat (TODO 999)', () => {
  // A steep bend: once flat there, it kinked at the acute angle.
  const points = [[0, 0], [60, 220], [400, 240]];
  const [[c1a, c2a], [c1b, c2b]] = controlsThrough(points, true, new Set([1]));
  const into = [points[1][0] - c2a[0], points[1][1] - c2a[1]];
  const out = [c1b[0] - points[1][0], c1b[1] - points[1][1]];
  // One line: the same way in and out, and the same length.
  assert.ok(Math.abs(into[0] * out[1] - into[1] * out[0]) < 1e-6, 'in and out on one line');
  assert.ok(Math.abs(Math.hypot(...into) - Math.hypot(...out)) < 1e-6, 'of one length');
  // Along the way from the point before to the point after.
  assert.ok(Math.abs(out[1] / out[0] - 240 / 400) < 1e-6);
  // Inside the gaps in x: no control goes past its neighbours, so x never goes back.
  const e = 1e-9;
  assert.ok(c2a[0] >= points[0][0] - e && c1b[0] <= points[2][0] + e && c1a[0] <= c2a[0] + e && c1b[0] <= c2b[0] + e);
  const dots = dotsThrough(points, true, new Set([1]));
  assert.ok(dots.every((p, i) => i === 0 || p[0] >= dots[i - 1][0] - 1e-9), 'x never goes back');
  // The ends stay flat; a point not smooth (a tie's slot) stays flat too.
  assert.deepEqual([c1a[1], c2b[1]], [0, 240]);
  const [[, c2t], [c1t]] = controlsThrough(points, true, new Set());
  assert.deepEqual([c2t[1], c1t[1]], [220, 220]);
  // With no bend, the default curve is as before.
  assert.equal(pathThrough([[0, 0], [400, 100]]), 'M 0 0 C 200 0, 200 100, 400 100');
});
