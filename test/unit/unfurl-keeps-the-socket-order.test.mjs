/**
 * UNFURL in the SOCKETS' ORDER: the nodes that hang from one node stand on their ring in the order of the sockets
 * they join there, its outputs on the right and its inputs on the left; where several connections join two nodes, the
 * topmost socket decides; each line is pulled level; the lines are counted socket to socket. With no socket heights,
 * unfurl is as it was. Will, TODO 827 · TRAP T-unfurl-keeps-the-flow
 *
 *   node --test test/unit/unfurl-keeps-the-socket-order.test.mjs
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

const core = new URL('../../dist/core/data/', import.meta.url);
const { unfurlNodes } = await import(new URL('node-unfurl.js', core));
const { crossings } = await import(new URL('node-arrange.js', core));

const GAP = 168;
const R = (a, b) => ({ from: a, to: b });
const node = (s) => s.split('/')[0];
const graphOf = (nodes, connections, more = {}) => ({ nodes: nodes.map(([id, x, y]) => ({ id, x, y })), connections, ...more });
const unfurl = (g, more = {}) => unfurlNodes(g, g.nodes.map((n) => n.id), { gapX: GAP, gapY: GAP, grid: 4, boxes: g.boxes, ...more });
const mid = (out, g, id) => out.nodes[id].y + g.boxes[id].h / 2;
const box = (h) => ({ w: 240, h });

// A Math node whose rows a, b and c are fed by three Values that stood in the wrong order; its result to an Output.
const fed = {
  ...graphOf([['vc', 0, 0], ['va', 0, 900], ['vb', 0, 450], ['m', 500, 300], ['out', 1000, 300]],
    [R('vc/value', 'm/c'), R('va/value', 'm/a'), R('vb/value', 'm/b'), R('m/result', 'out')]),
  boxes: { vc: box(120), va: box(120), vb: box(120), m: box(248), out: box(80) },
  sockets: { inputs: { 'm/a': 80, 'm/b': 128, 'm/c': 176, out: 24 }, outputs: { 'va/value': 90, 'vb/value': 90, 'vc/value': 90, 'm/result': 224 } },
};
// A Condition whose header, rows row and False footer each send to an Output, which stood upside down.
const forks = {
  ...graphOf([['s', 0, 300], ['c', 400, 300], ['no', 900, 0], ['yes', 900, 400], ['head', 900, 800]],
    [R('s/rows', 'c'), R('c/#false', 'no'), R('c/rows', 'yes'), R('c', 'head')]),
  boxes: { s: box(120), c: box(200), no: box(80), yes: box(80), head: box(80) },
  sockets: { inputs: { c: 24, no: 24, yes: 24, head: 24 }, outputs: { 's/rows': 80, c: 24, 'c/rows': 110, 'c/#false': 184 } },
};

test('the nodes that feed a node stand in the order of its input sockets, top to bottom', () => {
  const out = unfurl(fed, { sockets: fed.sockets });
  assert.ok(mid(out, fed, 'va') < mid(out, fed, 'vb') && mid(out, fed, 'vb') < mid(out, fed, 'vc'), JSON.stringify(out.nodes));
  assert.equal(crossings(out.nodes, fed.boxes, fed.connections, fed.sockets), 0);
});

test('the nodes a node feeds stand in the order of its output sockets: the header, then the rows, then False', () => {
  const out = unfurl(forks, { sockets: forks.sockets });
  assert.ok(mid(out, forks, 'head') < mid(out, forks, 'yes') && mid(out, forks, 'yes') < mid(out, forks, 'no'), JSON.stringify(out.nodes));
  assert.equal(crossings(out.nodes, forks.boxes, forks.connections, forks.sockets), 0);
});

test('where several connections join two nodes, the topmost socket decides', () => {
  // `vb` joins `m` on rows a and c: a, the topmost, puts it above `va`, which joins on b. By c it would stand below.
  const g = { ...fed, nodes: fed.nodes.filter((n) => n.id !== 'vc'), connections: [R('va/value', 'm/b'), R('vb/value', 'm/c'), R('vb/value', 'm/a'), R('m/result', 'out')] };
  const out = unfurl(g, { sockets: fed.sockets });
  assert.ok(mid(out, g, 'vb') < mid(out, g, 'va'), JSON.stringify(out.nodes));
});

test('the sockets\' order wins over fewer crossings: Will\'s order is the intent', () => {
  // `p` sends to `a` from its upper socket and to `b` from the one below; both feed `q1` and `q2` the other way round.
  // `b` above `a` would cross 2 pairs of lines; `a` above `b`, in `p`'s order, crosses 3. The order wins.
  const g = {
    ...graphOf([['p', 0, 300], ['a', 500, 600], ['b', 500, 0], ['s1', -500, 0], ['s2', -500, 300], ['s3', -500, 600], ['q1', 1000, 0], ['q2', 1000, 500]],
      [R('s1/out', 'p'), R('s2/out', 'p'), R('s3/out', 'p'), R('p/top', 'a'), R('p/bottom', 'b'), R('a/out', 'q1/low'), R('b/out', 'q1'), R('a/out', 'q2/low'), R('b/out', 'q2')]),
    boxes: { p: box(200), a: box(120), b: box(120), s1: box(80), s2: box(80), s3: box(80), q1: box(200), q2: box(200) },
    sockets: { inputs: { p: 24, a: 24, b: 24, q1: 24, 'q1/low': 176, q2: 24, 'q2/low': 176 }, outputs: { 's1/out': 40, 's2/out': 40, 's3/out': 40, 'p/top': 80, 'p/bottom': 128, 'a/out': 60, 'b/out': 60 } },
  };
  const out = unfurl(g, { sockets: g.sockets });
  assert.ok(mid(out, g, 'a') < mid(out, g, 'b'), JSON.stringify(out.nodes));
  assert.equal(crossings(out.nodes, g.boxes, g.connections, g.sockets), 3);
});

test('a line is pulled level: a lone neighbour\'s socket at the height of the one it joins', () => {
  // `m`'s result leaves low on its right; `out`'s input is at its top: out's top sits the difference lower.
  const g = { ...graphOf([['m', 0, 0], ['out', 600, 0]], [R('m/result', 'out')]), boxes: { m: box(248), out: box(80) } };
  const out = unfurl(g, { sockets: { inputs: { out: 24 }, outputs: { 'm/result': 224 } } });
  assert.ok(Math.abs(out.nodes.out.y + 24 - (out.nodes.m.y + 224)) <= 4, JSON.stringify(out.nodes));
  // At mid height, with no sockets, the two centres are level instead.
  const plain = unfurl(g);
  assert.ok(Math.abs(mid(plain, g, 'out') - mid(plain, g, 'm')) <= 4, JSON.stringify(plain.nodes));
});

test('a frame\'s sockets are its nodes\': what its upper node sends stands above what its lower node sends', () => {
  const g = {
    ...graphOf([['top', 0, 0], ['low', 0, 288], ['x', 600, 0], ['y', 600, 600], ['src', -600, 100]],
      [R('low/out', 'x'), R('top/out', 'y'), R('src/rows', 'top'), R('src/rows', 'low')], { frames: [{ id: 'f', nodes: ['top', 'low'] }] }),
    boxes: { top: box(120), low: box(120), x: box(80), y: box(80), src: box(120) },
  };
  const out = unfurl(g, { frameMargin: { top: 84, side: 24 }, sockets: { inputs: { x: 24, y: 24, top: 24, low: 24 }, outputs: { 'low/out': 60, 'top/out': 60, 'src/rows': 60 } } });
  assert.deepEqual([out.nodes.low.x - out.nodes.top.x, out.nodes.low.y - out.nodes.top.y], [0, 288], 'the column kept');
  assert.ok(mid(out, g, 'y') < mid(out, g, 'x'), JSON.stringify(out.nodes));
});

test('with no socket heights, or none for a socket, unfurl is as it was: each socket at mid height', () => {
  for (const g of [fed, forks]) assert.deepEqual(unfurl(g, { sockets: { inputs: {}, outputs: {} } }), unfurl(g));
});

test('lines counted socket to socket: two out of one node\'s two sockets that swap cross; two at one socket only touch', () => {
  const g = { nodes: [], boxes: { p: box(200), a: box(80), b: box(80) }, connections: [R('p/one', 'a'), R('p/two', 'b')] };
  const sockets = { inputs: { a: 40, b: 40 }, outputs: { 'p/one': 40, 'p/two': 160 } };
  const swapped = { p: { x: 0, y: 0 }, a: { x: 500, y: 300 }, b: { x: 500, y: 0 } };
  assert.equal(crossings(swapped, g.boxes, g.connections, sockets), 1);
  assert.equal(crossings(swapped, g.boxes, g.connections), 0, 'at mid height, lines of one node never count');
  const one = { ...g, connections: [R('p/one', 'a'), R('p/one', 'b')] };
  assert.equal(crossings(swapped, one.boxes, one.connections, sockets), 0);
});

// A random DAG whose connections use a node's header and rows, each socket at its drawn height.
function socketed(n, seed) {
  const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
  const names = Array.from({ length: n }, (_, i) => `n${i}`);
  const rows = Object.fromEntries(names.map((id) => [id, 1 + Math.floor(rnd() * 4)]));
  const boxes = Object.fromEntries(names.map((id) => [id, box(56 + 48 * rows[id])]));
  const sockets = { inputs: {}, outputs: {} };
  const at = (id, k) => (k === 0 ? id : `${id}/r${k}`);
  const yOf = (k) => (k === 0 ? 24 : 56 + 48 * (k - 1) + 24);
  const connections = [];
  for (let j = 1; j < n; j++) {
    for (const i of new Set(Array.from({ length: 1 + Math.floor(rnd() * 3) }, () => Math.floor(rnd() * j)))) {
      const [ko, ki] = [Math.floor(rnd() * (rows[names[i]] + 1)), Math.floor(rnd() * (rows[names[j]] + 1))];
      sockets.outputs[at(names[i], ko)] = yOf(ko);
      sockets.inputs[at(names[j], ki)] = yOf(ki);
      connections.push(R(at(names[i], ko), at(names[j], ki)));
    }
  }
  const side = Math.sqrt(n) * 420;
  return { ...graphOf(names.map((id) => [id, Math.floor(rnd() * side), Math.floor(rnd() * side)]), connections), boxes, sockets };
}

test('dense graphs with sockets: far fewer crossings socket to socket, and no more than measured; no overlap, every line forward, the grid', () => {
  let [before, after] = [0, 0];
  for (const [n, seed] of [[12, 1], [12, 2], [15, 4], [10, 8], [20, 3], [30, 11], [30, 5], [60, 9]]) {
    const g = socketed(n, seed);
    const out = unfurl(g, { sockets: g.sockets });
    assert.deepEqual(unfurl(g, { sockets: g.sockets }), out, 'the same out for the same in');
    before += crossings(Object.fromEntries(g.nodes.map((nd) => [nd.id, nd])), g.boxes, g.connections, g.sockets);
    after += crossings(out.nodes, g.boxes, g.connections, g.sockets);
    const ids = Object.keys(out.nodes);
    for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++) {
      const [p, q, bp, bq] = [out.nodes[ids[i]], out.nodes[ids[j]], g.boxes[ids[i]], g.boxes[ids[j]]];
      assert.ok(Math.max(q.x - (p.x + bp.w), p.x - (q.x + bq.w)) >= GAP || Math.max(q.y - (p.y + bp.h), p.y - (q.y + bq.h)) >= GAP, `${ids[i]}~${ids[j]}`);
    }
    for (const r of g.connections) assert.ok(out.nodes[node(r.to)].x >= out.nodes[node(r.from)].x + 240 + GAP, `${r.from}>${r.to}`);
    for (const p of Object.values(out.nodes)) assert.ok(p.x % 4 === 0 && p.y % 4 === 0);
  }
  assert.ok(after * 3 < before, `${before} → ${after}`);
  // Measured 2026-11-06: 2396 → 624. Each neighbour read at its socket in the sweeps; 639 without, 881 with the order first.
  assert.ok(after <= 624, `${after} crossings`);
});

test('it is as fast with sockets: 300 nodes', (t) => {
  const g = socketed(300, 21);
  unfurl(g, { sockets: g.sockets });
  const start = performance.now();
  for (let k = 0; k < 3; k++) unfurl(g, { sockets: g.sockets });
  const ms = (performance.now() - start) / 3;
  t.diagnostic(`300 nodes, ${g.connections.length} connections, with sockets: ${ms.toFixed(1)} ms`);
  assert.ok(ms < 1000, `${ms} ms`);
});
