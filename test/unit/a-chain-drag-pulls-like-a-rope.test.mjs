/**
 * A CHAIN DRAG PULLS LIKE A ROPE: ⌘ or Ctrl held, a dragged node pulls the nodes it joins along behind it, and theirs
 * behind them; each connector is a rope as long as it was, slack when pushed (Will, plan 918 D1 A). Every drag: no two
 * nodes come closer than their radii, half each one's largest side, and one pushed pushes on (D2 A). A held node is
 * never pulled or pushed; two that began nearer stay as near; 2,000 nodes stay fast.
 *
 *   node --test test/unit/a-chain-drag-pulls-like-a-rope.test.mjs
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

const core = new URL('../../dist/core/data/', import.meta.url);
const { dragTo, radiusOf, startDrag } = await import(new URL('node-chain.js', core));

/** A node 200 wide and 100 tall: its radius is 100. */
const node = (id, x, y, w = 200, h = 100) => ({ id, x, y, w, h });
/** A connector from a node's right middle to the next one's left middle. */
const link = (from, to) => ({ from, to, fromAt: [200, 50], toAt: [0, 50] });
const gap = (p, a, b) => Math.hypot(p[b].x - p[a].x - 200, p[b].y - p[a].y);
const centres = (p, a, b) => Math.hypot(p[b].x - p[a].x, p[b].y - p[a].y);

test('a radius is half the largest side', () => {
  assert.deepEqual([radiusOf({ w: 200, h: 100 }), radiusOf({ w: 120, h: 300 })], [100, 150]);
});

test('chain off: the joined node stays; chain on: it follows, its connector as long as it was', () => {
  const nodes = [node('a', 0, 0), node('b', 400, 0)];
  const off = dragTo(startDrag(nodes, [link('a', 'b')], ['a']), { a: { x: -300, y: 0 } }, false);
  assert.deepEqual(Object.keys(off), ['a']);
  const drag = startDrag(nodes, [link('a', 'b')], ['a']);
  const on = dragTo(drag, { a: { x: -300, y: 0 } }, true);
  assert.deepEqual(on.b, { x: 100, y: 0 });
  assert.equal(Math.round(gap(on, 'a', 'b')), 200);
});

test('a rope goes slack when pushed: the joined node stays till the radii push it', () => {
  const drag = startDrag([node('a', 0, 0), node('b', 600, 0)], [link('a', 'b')], ['a']);
  assert.deepEqual(Object.keys(dragTo(drag, { a: { x: 200, y: 0 } }, true)), ['a']);
  // Nearer than their radii (100 + 100), centre to centre: b is pushed on.
  const near = dragTo(drag, { a: { x: 500, y: 0 } }, true);
  assert.ok(centres(near, 'a', 'b') >= 199.5, String(centres(near, 'a', 'b')));
});

test('theirs follow behind them: a line of three, all pulled', () => {
  const drag = startDrag([node('a', 0, 0), node('b', 400, 0), node('c', 800, 0)], [link('a', 'b'), link('b', 'c')], ['a']);
  let p;
  for (let x = -40; x >= -400; x -= 40) p = dragTo(drag, { a: { x, y: 0 } }, true);
  assert.deepEqual([p.b.x, p.c.x], [0, 400]);
  // Up as well: the line trails behind, each rope as long as it was.
  for (let y = 40; y <= 400; y += 40) p = dragTo(drag, { a: { x: -400, y } }, true);
  assert.ok(gap(p, 'a', 'b') <= 200.5 && gap(p, 'b', 'c') <= 200.5);
  assert.ok(p.b.y > 0 && p.c.y > 0 && p.c.y < p.b.y, JSON.stringify(p));
});

test('a held node is never pulled or pushed; the chain turned on later measures its ropes then', () => {
  const drag = startDrag([node('a', 0, 0), node('b', 400, 0), node('c', 800, 0)], [link('a', 'b'), link('b', 'c')], ['a', 'c']);
  const p = dragTo(drag, { a: { x: -400, y: 0 }, c: { x: 800, y: 0 } }, true);
  assert.deepEqual([p.a, p.c], [{ x: -400, y: 0 }, { x: 800, y: 0 }]);
  assert.ok('b' in p, 'b, pulled both ways, moved');
  const late = startDrag([node('a', 0, 0), node('b', 400, 0)], [link('a', 'b')], ['a']);
  dragTo(late, { a: { x: -200, y: 0 } }, false);
  const on = dragTo(late, { a: { x: -240, y: 0 } }, true);
  assert.equal(Math.round(gap(on, 'a', 'b')), 400, 'as long as it was when the chain came on');
});

test('a loop settles: each rope as long as it was, or near', () => {
  const nodes = [node('a', 0, 0), node('b', 400, 0), node('c', 400, 300)];
  const links = [link('a', 'b'), link('b', 'c'), { from: 'c', to: 'a', fromAt: [0, 50], toAt: [200, 50] }];
  const drag = startDrag(nodes, links, ['a']);
  let p;
  for (let x = -40; x >= -600; x -= 40) p = dragTo(drag, { a: { x, y: 0 } }, true);
  assert.ok(p.b.x < 400 && p.c.x < 400, JSON.stringify(p));
});

test('every drag: a node dragged onto another pushes it, and that one pushes on; none goes through a held one', () => {
  const nodes = [node('a', 0, 0), node('b', 400, 0), node('c', 700, 0)];
  const p = dragTo(startDrag(nodes, [], ['a']), { a: { x: 380, y: 0 } }, false);
  assert.ok(centres(p, 'a', 'b') >= 199.5 && centres(p, 'b', 'c') >= 199.5, JSON.stringify(p));
  const both = dragTo(startDrag(nodes, [], ['a', 'b']), { a: { x: 350, y: 0 }, b: { x: 400, y: 0 } }, false);
  assert.deepEqual(both.b, { x: 400, y: 0 }, 'two held nodes may come as near as the reader puts them');
});

test('two that began nearer than their radii stay as near: a drag pushes no one apart for being close', () => {
  const drag = startDrag([node('a', 0, 0), node('b', 0, 120), node('c', 0, 240)], [], ['a']);
  assert.deepEqual(Object.keys(dragTo(drag, { a: { x: 10, y: 0 } }, false)), ['a']);
  // Moved nearer, step by step as a drag goes: each pushes on, no nearer than they began.
  let nearer;
  for (let y = 4; y <= 60; y += 4) nearer = dragTo(drag, { a: { x: 0, y } }, false);
  assert.deepEqual([centres(nearer, 'a', 'b'), centres(nearer, 'b', 'c')], [120, 120]);
});

test('2,000 nodes: a step is fast', () => {
  const nodes = Array.from({ length: 2000 }, (_, i) => node(`n${i}`, (i % 50) * 400, Math.floor(i / 50) * 300));
  const links = nodes.slice(1).map((n, i) => link(`n${i}`, n.id));
  const drag = startDrag(nodes, links, ['n0']);
  const t = performance.now();
  for (let x = -20; x >= -400; x -= 20) dragTo(drag, { n0: { x, y: 0 } }, true);
  const each = (performance.now() - t) / 20;
  assert.ok(each < 16, `${each.toFixed(1)}ms a step`);
});
