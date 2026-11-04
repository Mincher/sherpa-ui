/**
 * A BOX dragged on a canvas picks every node whose box it TOUCHES and every route whose sampled path
 * it crosses — the rule of Figma's and Blender's node editors, not "fully enclosed". Pure geometry.
 * Will, TODO 735.
 *
 *   node --test test/unit/a-box-picks-what-it-touches.test.mjs
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

const { touches, crosses, boxPick } = await import(new URL('../../dist/core/ui/box-pick.js', import.meta.url));

const box = (left, top, right, bottom) => ({ left, top, right, bottom });

test('a box touching a node picks it; one beside it misses; an edge counts', () => {
  const node = box(100, 100, 340, 200);
  assert.equal(touches(box(0, 0, 120, 120), node), true);
  assert.equal(touches(box(0, 0, 99, 300), node), false);
  assert.equal(touches(box(340, 150, 400, 160), node), true);
  assert.equal(touches(box(150, 120, 200, 140), node), true);
});

test('a box crossing a route sampled as points picks it; passing beside it does not', () => {
  // A curve out of (0,0) over to (200,100), sampled coarsely.
  const dots = [[0, 0], [50, 0], [100, 50], [150, 100], [200, 100]];
  assert.equal(crosses(box(90, 40, 110, 60), dots), true);
  // Through the middle of a segment, with no sample inside the box.
  assert.equal(crosses(box(70, 0, 80, 100), dots), true);
  assert.equal(crosses(box(0, 60, 40, 120), dots), false);
  assert.equal(crosses(box(300, 0, 400, 100), dots), false);
});

test('a box crosses each piece of a tied route: in, through the slot, out', () => {
  const tied = [[0, 0], [100, 0], [100, 40], [200, 40]];
  assert.equal(crosses(box(95, 10, 105, 30), tied), true);
  assert.equal(crosses(box(150, 0, 190, 20), tied), false);
});

test('boxPick answers the nodes it touches, else the routes it crosses — never both — in the order given', () => {
  const nodes = [['a', box(0, 0, 100, 50)], ['b', box(0, 200, 100, 250)], ['c', box(0, 400, 100, 450)]];
  const lanes = [1, 2, 3].map((n) => ({ route: `r${n}`, dots: [[100, (n - 1) * 200 + 25], [400, (n - 1) * 200 + 25]] }));
  const got = boxPick(box(200, 0, 260, 460), nodes, lanes);
  assert.deepEqual(got, { nodes: [], routes: ['r1', 'r2', 'r3'] });
  // It touches nodes a and b AND crosses routes r1 and r2: only the nodes are picked.
  assert.deepEqual(boxPick(box(50, 20, 150, 230), nodes, lanes), { nodes: ['a', 'b'], routes: [] });
  // Part of a route is enough: a box over the middle of one.
  assert.deepEqual(boxPick(box(250, 190, 260, 260), nodes, lanes), { nodes: [], routes: ['r2'] });
  assert.deepEqual(boxPick(box(500, 0, 600, 100), nodes, lanes), { nodes: [], routes: [] });
});
