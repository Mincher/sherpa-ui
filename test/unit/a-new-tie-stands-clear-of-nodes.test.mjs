/**
 * A NEW zip tie that would stand behind a node stands beside it instead: on the side of that node with the most room
 * between it and the other nodes, half way into the room, TIE_CLEAR at most; never across the x range the tie may take.
 * One clear of every node stays where it is. Will, TODO 882
 *
 *   node --test test/unit/a-new-tie-stands-clear-of-nodes.test.mjs
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

const { clearOfNodes, TIE_CLEAR } = await import(new URL('../../dist/core/data/tie-place.js', import.meta.url));

const box = (left, top, w = 200, h = 100) => ({ left, top, right: left + w, bottom: top + h });

test('a tie clear of every node stays where it is', () => {
  assert.deepEqual(clearOfNodes({ x: 500, y: 500 }, 28, [box(0, 0)]), { x: 500, y: 500 });
});

test('behind a node, it moves to the side with the most room: here below, where nothing is', () => {
  // A node left and right of the hit one, and one just above it: the room is below.
  const hit = box(300, 300);
  const boxes = [hit, box(0, 300), box(600, 300), box(300, 150)];
  const at = clearOfNodes({ x: 400, y: 350 }, 28, boxes);
  assert.equal(at.x, 400);
  assert.equal(at.y, hit.bottom + TIE_CLEAR);
});

test('the room is shared: half way into a narrow gap, and never across the tie\'s x range', () => {
  const hit = box(300, 300);
  // Room: left 40 (a node at 60..260), right 400, above 20, below 30: right wins, TIE_CLEAR off.
  const boxes = [hit, box(60, 300), box(900, 300), box(300, 180), box(300, 430)];
  assert.deepEqual(clearOfNodes({ x: 400, y: 350 }, 28, boxes), { x: 500 + TIE_CLEAR, y: 350 });
  // The tie may not go past x 520: right is not offered, the next most room (left) is taken.
  assert.deepEqual(clearOfNodes({ x: 400, y: 350 }, 28, boxes, { min: 0, max: 520 }), { x: 300 - 20, y: 350 });
});
