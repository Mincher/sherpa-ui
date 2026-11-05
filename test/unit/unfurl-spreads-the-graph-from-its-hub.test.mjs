/**
 * UNFURL lays a whole graph out round its most connected node: inputs fan left, outputs right, every line left to
 * right, no two nodes closer than Arrange's gap, on the 4px grid, the anchor kept, the same out for the same in.
 * Crossings never rise on a tidy graph and fall on a dense one. Will, TODO 569 · docs/history/plan-569-unfurl.md
 * · TRAP T-unfurl-keeps-the-flow
 *
 *   node --test test/unit/unfurl-spreads-the-graph-from-its-hub.test.mjs
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

const core = new URL('../../dist/core/data/', import.meta.url);
const { unfurlNodes } = await import(new URL('node-unfurl.js', core));
const { arrangeNodes, crossings } = await import(new URL('node-arrange.js', core));
const { tieLimit } = await import(new URL('workflow.js', core));

const GAP = 168;
const R = (a, b) => ({ from: a, to: b });
const node = (s) => s.split('/')[0];
const graphOf = (nodes, routes, more = {}) => ({ nodes: nodes.map(([id, x, y]) => ({ id, x, y })), routes, ...more });
const boxesOf = (g, h = () => 120) => Object.fromEntries(g.nodes.map((n) => [n.id, { w: 240, h: h(n.id) }]));
const opts = (g, more = {}) => ({ gapX: GAP, gapY: GAP, grid: 4, boxes: g.boxes ?? boxesOf(g), ...more });
const ids = (g) => g.nodes.map((n) => n.id);
const unfurl = (g, more) => unfurlNodes(g, ids(g), opts(g, more));
const placesOf = (g) => Object.fromEntries(g.nodes.map((n) => [n.id, { x: n.x, y: n.y }]));
const crossed = (g, places) => crossings(places, g.boxes ?? boxesOf(g), g.routes);
const moved = (g, out) => ({ ...g, nodes: g.nodes.map((n) => ({ ...n, ...out.nodes[n.id] })) });

/** Every pair of boxes clear of each other by the gap, across or down. */
function clearance(g, places) {
  const boxes = g.boxes ?? boxesOf(g);
  const list = Object.entries(places);
  const close = [];
  for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) {
    const [[a, p], [b, q]] = [list[i], list[j]];
    const across = Math.max(q.x - (p.x + boxes[a].w), p.x - (q.x + boxes[b].w));
    const down = Math.max(q.y - (p.y + boxes[a].h), p.y - (q.y + boxes[b].h));
    if (across < GAP && down < GAP) close.push(`${a}~${b}`);
  }
  return close;
}
/** Every route whose target's left edge is not a gap past its source's right edge. */
const backwards = (g, places) => g.routes.filter((r) => places[node(r.to)].x < places[node(r.from)].x + (g.boxes ?? boxesOf(g))[node(r.from)].w + GAP);

// Demos' shipped workflow, tidy: a Store, a Field, a Value and a Condition, an Output.
const demos = graphOf([['start', 0, 0], ['field', 360, 0], ['status', 360, 240], ['filter', 720, 0], ['end', 1080, 0]],
  [R('start/rows', 'field'), R('field/field', 'filter'), R('status/value', 'filter/b'), R('filter/rows', 'end')]);
// A store, four fields, four conditions each with a value, an And, an Output; laid out in columns, crossed.
function tree() {
  const nodes = [['store', 0, 400]];
  const routes = [];
  for (let i = 0; i < 4; i++) {
    nodes.push([`f${i}`, 400, i * 240], [`v${i}`, 400, 1000 + i * 200], [`c${i}`, 800, i * 240]);
    routes.push(R('store/rows', `f${i}`), R(`f${i}/field`, `c${i}`), R(`v${i}/value`, `c${i}/b`), R(`c${i}`, 'and'));
  }
  nodes.push(['and', 1200, 400], ['out', 1600, 400]);
  routes.push(R('and', 'out'));
  const g = graphOf(nodes, routes);
  return { ...g, boxes: boxesOf(g, (id) => (id.startsWith('c') ? 200 : 120)) };
}
// A random DAG, each node fed by one to three earlier ones, at messy places.
function dense(n, seed) {
  const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
  const names = Array.from({ length: n }, (_, i) => `n${i}`);
  const routes = [];
  for (let j = 1; j < n; j++) {
    const from = new Set(Array.from({ length: 1 + Math.floor(rnd() * 3) }, () => Math.floor(rnd() * j)));
    for (const i of from) routes.push(R(`${names[i]}/out`, `${names[j]}/in${i % 3}`));
  }
  const side = Math.sqrt(n) * 420;
  const g = graphOf(names.map((id) => [id, Math.floor(rnd() * side), Math.floor(rnd() * side)]), routes);
  return { ...g, boxes: Object.fromEntries(names.map((id) => [id, { w: 240, h: 80 + 40 * Math.floor(rnd() * 5) }])) };
}

test('the same graph in gives the same places out, whatever order its nodes come in; a second unfurl changes nothing', () => {
  // A loop too, two nodes each sending to the other: which way it runs must not hang on the order the nodes come in.
  const loop = graphOf([['x', 0, 0], ['y', 300, 0], ['z', 600, 0], ['w', 900, 0]], [R('x', 'y'), R('x', 'z'), R('y', 'z'), R('z', 'y/b'), R('z', 'w')]);
  for (const g of [demos, tree(), dense(30, 11), loop]) {
    const out = unfurl(g);
    assert.deepEqual(unfurl(g), out);
    assert.deepEqual(unfurl({ ...g, nodes: [...g.nodes].reverse(), routes: [...g.routes].reverse() }), out);
    assert.deepEqual(unfurl(moved(g, out)), out, 'idempotent');
  }
});

test('the anchor, the node with the most connections, keeps its place; its outputs fan to its right', () => {
  const g = graphOf([['hub', 501, 303], ['a', 0, 0], ['b', 900, 900], ['c', 40, 700], ['d', 300, 1300]],
    [R('hub/rows', 'a'), R('hub/rows', 'b'), R('hub/rows', 'c'), R('c/out', 'd')]);
  const out = unfurl(g);
  assert.deepEqual(out.nodes.hub, { x: 500, y: 304 }, 'on the grid, where it was');
  for (const id of ['a', 'b', 'c']) assert.ok(out.nodes[id].x >= 500 + 240 + GAP, id);
});

test('each route on a socket counts: three routes out of one socket weigh three', () => {
  // `h` sends three routes from ONE socket; `z` one from each of three. Each weighs three, so the lower id is the
  // anchor; counted by socket, `h` would weigh one and `z` would be.
  const g = graphOf([['z', 900, 901], ['h', 13, 17], ['p', 400, 0], ['q', 400, 300], ['r', 400, 600]],
    [R('h/rows', 'p'), R('h/rows', 'q'), R('h/rows', 'r'), R('z/a', 'p/b'), R('z/b', 'q/b'), R('z/c', 'r/b')]);
  const out = unfurl(g);
  assert.deepEqual(out.nodes.h, { x: 12, y: 16 });
  assert.notDeepEqual(out.nodes.z, { x: 900, y: 900 });
});

test('a tie for the anchor: the most different neighbours first, then the lowest id', () => {
  // `k` and `m` each have three route ends; `m`'s join three nodes, `k`'s two.
  const g = graphOf([['k', 100, 100], ['m', 500, 500], ['x', 900, 0], ['p', 0, 800], ['q', 800, 800]],
    [R('k/a', 'x'), R('k/b', 'x/b'), R('k/c', 'm'), R('m', 'p'), R('m', 'q')]);
  assert.deepEqual(unfurl(g).nodes.m, { x: 500, y: 500 });
  // Even: the lowest id.
  const even = graphOf([['b', 400, 400], ['a', 120, 120]], [R('a', 'b')]);
  assert.deepEqual(unfurl(even).nodes.a, { x: 120, y: 120 });
});

test('crossings never rise on a tidy graph and fall on a dense one, no more in all than Arrange leaves', () => {
  for (const g of [demos, tree()]) assert.ok(crossed(g, unfurl(g).nodes) <= crossed(g, placesOf(g)), JSON.stringify(g.nodes[0]));
  assert.equal(crossed(demos, unfurl(demos).nodes), 0);
  assert.equal(crossed(tree(), unfurl(tree()).nodes), 0, 'a tree crosses none');
  let [before, after, arranged] = [0, 0, 0];
  for (const [n, seed] of [[20, 3], [30, 11], [30, 5], [60, 9], [12, 1], [12, 2], [15, 4], [10, 8]]) {
    const g = dense(n, seed);
    const [was, now] = [crossed(g, placesOf(g)), crossed(g, unfurl(g).nodes)];
    assert.ok(now < was, `${n} nodes: ${was} → ${now}`);
    before += was;
    after += now;
    arranged += crossed(g, arrangeNodes(g, ids(g), opts(g)).nodes);
  }
  assert.ok(after * 2.5 < before, `${before} → ${after}`);
  assert.ok(after <= arranged, `unfurl ${after}, arrange ${arranged}`);
});

test('no two nodes closer than the gap, every place on the 4px grid, every line left to right', () => {
  for (const g of [demos, tree(), dense(20, 3), dense(30, 5), dense(60, 9), dense(100, 21)]) {
    const out = unfurl(g);
    assert.equal(Object.keys(out.nodes).length, g.nodes.length);
    assert.deepEqual(clearance(g, out.nodes), []);
    for (const p of Object.values(out.nodes)) assert.ok(p.x % 4 === 0 && p.y % 4 === 0, JSON.stringify(p));
    assert.deepEqual(backwards(g, out.nodes).map((r) => `${r.from}>${r.to}`), []);
  }
});

test('parts stand side by side in the order they stood, left to right; lone nodes stand in one column after them', () => {
  // The small part `x › y` stood left of `a › b › c`, as a Store and its In portal stand before the Out it reaches.
  const g = graphOf([['a', 900, 0], ['b', 1300, 0], ['c', 1700, 0], ['x', 0, 600], ['y', 400, 600], ['lone', 300, 300], ['alone', 50, 50]],
    [R('a', 'b'), R('b', 'c'), R('a', 'c/b'), R('x', 'y')]);
  const out = unfurl(g).nodes;
  const right = (ns) => Math.max(...ns.map((id) => out[id].x + 240));
  const left = (ns) => Math.min(...ns.map((id) => out[id].x));
  assert.ok(left(['a', 'b', 'c']) >= right(['x', 'y']) + GAP, 'the part that stood second is right of the first');
  assert.deepEqual(out.x, { x: 0, y: 600 }, 'the first part\'s anchor keeps its place');
  assert.ok(left(['lone', 'alone']) >= right(['a', 'b', 'c']) + GAP, 'lone nodes after');
  assert.equal(out.lone.x, out.alone.x);
  assert.ok(out.lone.y - out.alone.y >= 120 + GAP, 'top to bottom as they stood');
  assert.deepEqual(clearance(g, out), []);
});

test('a frame moves whole: its nodes keep their column, and its box clears every other node by the gap', () => {
  const margin = { top: 84, side: 24 };
  const g = graphOf([['s', 0, 0], ['f1', 400, 0], ['f2', 400, 288], ['out', 900, 100], ['v', 0, 600]],
    [R('s/rows', 'f1'), R('s/rows', 'f2'), R('f1', 'out'), R('f2', 'out/b'), R('v/value', 'out/c')],
    { frames: [{ id: 'frame-1', label: 'Fields', nodes: ['f1', 'f2'] }] });
  const out = unfurl(g, { frameMargin: margin }).nodes;
  assert.deepEqual([out.f2.x - out.f1.x, out.f2.y - out.f1.y], [0, 288], 'the column kept');
  // The frame's drawn box: its nodes' box with the margin.
  const frame = { x: out.f1.x - margin.side, y: out.f1.y - margin.top, w: 240 + 2 * margin.side, h: 288 + 120 + margin.top + margin.side };
  for (const id of ['s', 'out', 'v']) {
    const p = out[id];
    const across = Math.max(p.x - (frame.x + frame.w), frame.x - (p.x + 240));
    const down = Math.max(p.y - (frame.y + frame.h), frame.y - (p.y + 120));
    assert.ok(across >= GAP || down >= GAP, `${id} clears the frame`);
  }
});

test('a tie whose routes all join moved nodes stands between them, inside its limit; a loop ends', () => {
  const g = graphOf([['a', 0, 0], ['b', 0, 300], ['c', 900, 0], ['d', 900, 300]], [R('a', 'c'), R('b', 'd'), R('a', 'd/b')],
    { ties: [{ id: 't', x: 5000, y: 5000, routes: [R('a', 'c'), R('b', 'd')] }] });
  const out = unfurl(g);
  const limit = tieLimit({ nodes: Object.entries(out.nodes).map(([id, p]) => ({ id, x: p.x })) }, g.ties[0]);
  assert.ok(out.ties.t.x >= limit.min && out.ties.t.x <= limit.max, JSON.stringify([out.ties.t, limit]));
  const ys = ['a', 'b', 'c', 'd'].map((id) => out.nodes[id].y + 60);
  assert.ok(out.ties.t.y >= Math.min(...ys) && out.ties.t.y <= Math.max(...ys));
  const loop = graphOf([['a', 0, 0], ['b', 0, 100], ['c', 0, 200]], [R('a', 'b'), R('b', 'c'), R('c', 'a')]);
  assert.equal(Object.keys(unfurl(loop).nodes).length, 3);
});

test('only the nodes it is given move; fewer than two, nothing', () => {
  const g = graphOf([['#in', -400, 0], ['a', 0, 0], ['b', 600, 300], ['#out', 1200, 0]], [R('#in/x', 'a'), R('a', 'b'), R('b', '#out/y')]);
  const out = unfurlNodes(g, ['a', 'b', 'gone'], opts(g));
  assert.deepEqual(Object.keys(out.nodes).sort(), ['a', 'b']);
  assert.deepEqual(unfurlNodes(g, ['a'], opts(g)), { nodes: {}, ties: {} });
});

test('it is fast: 20, 100 and 300 nodes', (t) => {
  const said = [];
  for (const [n, cap] of [[20, 50], [100, 200], [300, 1500]]) {
    const g = dense(n, 21);
    unfurl(g);
    const start = performance.now();
    for (let k = 0; k < 3; k++) unfurl(g);
    const ms = (performance.now() - start) / 3;
    said.push(`${n} nodes, ${g.routes.length} routes: ${ms.toFixed(1)} ms`);
    assert.ok(ms < cap, said.at(-1));
  }
  t.diagnostic(said.join('; '));
});
