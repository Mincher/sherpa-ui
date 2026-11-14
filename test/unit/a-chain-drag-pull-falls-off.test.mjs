/**
 * A CHAIN DRAG'S PULL FALLS OFF: ⌘ or Ctrl held, each node joined to a dragged one, through any number of connectors,
 * moves by the drag times 1 / (1 + d / 240), d its shortest way along them in px, centre to centre; or 1 / (1 + d), d how
 * many connectors (Will, TODO 975). Measured as the chain comes on, so the drag's way there does not change where it
 * ends. No two nodes come closer than their radii, half each one's largest side, one pushed pushing on (plan 918 D2 A).
 * A plain drag pulls and pushes none (Will, TODO 974). A held node is never pulled or pushed; two that began nearer stay
 * as near; 2,000 nodes stay fast.
 *
 *   node --test test/unit/a-chain-drag-pull-falls-off.test.mjs
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

const core = new URL('../../dist/core/data/', import.meta.url);
const { CHAIN_REACH, dragTo, radiusOf, startDrag } = await import(new URL('node-chain.js', core));

/** A node 200 wide and 100 tall: its radius is 100. */
const node = (id, x, y, w = 200, h = 100) => ({ id, x, y, w, h });
/** A connector from a node's right middle to the next one's left middle. */
const link = (from, to) => ({ from, to, fromAt: [200, 50], toAt: [0, 50] });
const centres = (p, a, b) => Math.hypot(p[b].x - p[a].x, p[b].y - p[a].y);
/** Its weight by px: d along the connectors. */
const w = (d) => 1 / (1 + d / CHAIN_REACH);

test('a radius is half the largest side', () => {
  assert.deepEqual([radiusOf({ w: 200, h: 100 }), radiusOf({ w: 120, h: 300 })], [100, 150]);
});

test('chain off: the joined node stays; chain on: it moves by the drag times its weight, 1 / (1 + d / 240)', () => {
  const nodes = [node('a', 0, 0), node('b', 400, 0)];
  assert.deepEqual(Object.keys(dragTo(startDrag(nodes, [link('a', 'b')], ['a']), { a: { x: -300, y: 0 } }, false)), ['a']);
  const on = dragTo(startDrag(nodes, [link('a', 'b')], ['a']), { a: { x: -300, y: -60 } }, true);
  assert.equal(CHAIN_REACH, 240);
  assert.deepEqual(on.b, { x: Math.round(400 - 300 * w(400)), y: Math.round(-60 * w(400)) });
});

test('farther up the chain, less: a line of three, by px and by connectors (Will, TODO 975)', () => {
  const line = () => startDrag([node('a', 0, 0), node('b', 400, 0), node('c', 800, 0)], [link('a', 'b'), link('b', 'c')], ['a']);
  const px = dragTo(line(), { a: { x: -400, y: 0 } }, true);
  assert.deepEqual([px.b.x, px.c.x], [Math.round(400 - 400 * w(400)), Math.round(800 - 400 * w(800))]);
  assert.ok(400 - px.b.x > 800 - px.c.x, 'c moves less than b');
  const hops = dragTo(line(), { a: { x: -400, y: 0 } }, true, 'connections');
  assert.deepEqual([hops.b.x, hops.c.x], [400 - 200, Math.round(800 - 400 / 3)]);
});

test('the drag\'s way does not change where it ends: one step or twenty, the same places', () => {
  const nodes = [node('a', 0, 0), node('b', 400, 0), node('c', 400, 300)];
  const links = [link('a', 'b'), link('b', 'c'), { from: 'c', to: 'a', fromAt: [0, 50], toAt: [200, 50] }];
  const once = dragTo(startDrag(nodes, links, ['a']), { a: { x: -600, y: 200 } }, true);
  const drag = startDrag(nodes, links, ['a']);
  let steps;
  for (let i = 1; i <= 20; i++) steps = dragTo(drag, { a: { x: -30 * i, y: 10 * i } }, true);
  assert.deepEqual(steps, once);
  // A loop: each by its shortest way, c joined to a straight back.
  assert.ok(400 - once.b.x > 0 && 400 - once.c.x > 0, JSON.stringify(once));
});

test('a held node is never pulled or pushed; the nearest held one leads; the chain turned on later measures then', () => {
  const drag = startDrag([node('a', 0, 0), node('b', 400, 0), node('c', 800, 0)], [link('a', 'b'), link('b', 'c')], ['a', 'c']);
  const p = dragTo(drag, { a: { x: -400, y: 0 }, c: { x: 800, y: 0 } }, true);
  assert.deepEqual([p.a, p.c], [{ x: -400, y: 0 }, { x: 800, y: 0 }]);
  assert.equal(p.b.x, Math.round(400 - 400 * w(400)), 'b, as near a as c, follows a, the first held');
  const late = startDrag([node('a', 0, 0), node('b', 400, 0)], [link('a', 'b')], ['a']);
  dragTo(late, { a: { x: -200, y: 0 } }, false);
  const on = dragTo(late, { a: { x: -240, y: 0 } }, true);
  assert.equal(on.b.x, Math.round(400 - 40 * w(600)), 'from where they stood when the chain came on');
});

test('a plain drag pushes none, onto another or not (TODO 974); a chain drag pushes it, and that one pushes on; none goes through a held one', () => {
  const nodes = [node('a', 0, 0), node('b', 400, 0), node('c', 700, 0)];
  assert.deepEqual(dragTo(startDrag(nodes, [], ['a']), { a: { x: 380, y: 0 } }, false), { a: { x: 380, y: 0 } });
  const p = dragTo(startDrag(nodes, [], ['a']), { a: { x: 380, y: 0 } }, true);
  assert.ok(centres(p, 'a', 'b') >= 199.5 && centres(p, 'b', 'c') >= 199.5, JSON.stringify(p));
  const both = dragTo(startDrag(nodes, [], ['a', 'b']), { a: { x: 350, y: 0 }, b: { x: 400, y: 0 } }, true);
  assert.deepEqual(both.b, { x: 400, y: 0 }, 'two held nodes may come as near as the reader puts them');
});

test('two that began nearer than their radii stay as near: a chain drag pushes no one apart for being close', () => {
  const drag = startDrag([node('a', 0, 0), node('b', 0, 120), node('c', 0, 240)], [], ['a']);
  assert.deepEqual(Object.keys(dragTo(drag, { a: { x: 10, y: 0 } }, true)), ['a']);
  // Moved nearer, step by step as a drag goes: each pushes on, no nearer than they began.
  let nearer;
  for (let y = 4; y <= 60; y += 4) nearer = dragTo(drag, { a: { x: 0, y } }, true);
  assert.deepEqual([centres(nearer, 'a', 'b'), centres(nearer, 'b', 'c')], [120, 120]);
});

test('2,000 nodes: a step is fast, the chain measured in it', () => {
  const nodes = Array.from({ length: 2000 }, (_, i) => node(`n${i}`, (i % 50) * 400, Math.floor(i / 50) * 300));
  const links = nodes.slice(1).map((n, i) => link(`n${i}`, n.id));
  const drag = startDrag(nodes, links, ['n0']);
  const t = performance.now();
  for (let x = -20; x >= -400; x -= 20) dragTo(drag, { n0: { x, y: 0 } }, true);
  const each = (performance.now() - t) / 20;
  assert.ok(each < 16, `${each.toFixed(1)}ms a step`);
});
