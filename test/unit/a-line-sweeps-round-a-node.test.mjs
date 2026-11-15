/**
 * A LINE SWEEPS ROUND A NODE — Will, TODO 1010: "The unfurled mid points of connectors cause the connector to be squiggly.
 * The rotation of the handles of the point, as well as the position, need to be set so that they create a nice consistent
 * flow from one socket to another while also avoiding any other nodes. Nodes have a radius that we can use for quick
 * collision checks." `sweepOf` gives a line's one bend, or none, and its handles' turn. TRAP T-a-line-sweeps-round-a-node
 *
 *   node --test test/unit/a-line-sweeps-round-a-node.test.mjs
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

const ui = new URL('../../dist/core/ui/', import.meta.url);
const data = new URL('../../dist/core/data/', import.meta.url);
const { sweepOf, dotsThrough, controlsThrough } = await import(new URL('connector-path.js', ui));
const { clampedVia, placeBend } = await import(new URL('connector-bends.js', data));

const box = (x, y, w, h) => ({ left: x, top: y, right: x + w, bottom: y + h });
const inBox = (o, [x, y]) => x >= o.left && x <= o.right && y >= o.top && y <= o.bottom;
const curveOf = (a, bend, b) => (bend ? dotsThrough([a, [bend.x, bend.y], b], true, new Set([1]), new Map([[1, bend.turn]])) : dotsThrough([a, b]));

test('a line whose curve misses every node needs no bend', () => {
  assert.equal(sweepOf([0, 0], [600, 100], [box(200, 300, 200, 120)]), undefined);
});

test('a node in the way: one bend whose curve misses it, its handles at a turn of their own', () => {
  const [a, b, node] = [[0, 100], [800, 140], box(300, 40, 200, 160)];
  const bend = sweepOf(a, b, [node]);
  assert.ok(bend && Number.isFinite(bend.turn), JSON.stringify(bend));
  assert.ok(!curveOf(a, bend, b).some((p) => inBox(node, p)), 'the curve misses the node');
  assert.ok(Math.abs(bend.turn) <= 80, 'its handles lean, never stand up');
});

test('a bend\'s turn sets its handles; a point moved by hand loses it, and one held inside its ends keeps it', () => {
  const [p, at, n] = [[0, 0], [100, 50], [200, 0]];
  const [[, into]] = controlsThrough([p, at, n], true, new Set([1]), new Map([[1, 0]]));
  assert.equal(into[1], 50, 'a turn of 0: the handle into the bend is flat');
  const [[, chord]] = controlsThrough([p, at, n], true, new Set([1]));
  assert.equal(chord[1], 50, 'none: along the way from the point before to the point after, here flat too');
  const [[, steep]] = controlsThrough([p, at, n], true, new Set([1]), new Map([[1, 45]]));
  assert.ok(steep[1] < 50, 'a turn of 45: it leans');
  assert.equal(placeBend([{ x: 100, y: 50, turn: 30 }], 0, 120, 60).via[0].turn, undefined, 'moved by hand');
  assert.equal(clampedVia([{ x: 100, y: 50, turn: 30 }], { from: 0, to: 400 })[0].turn, 30, 'drawn inside its ends');
});
