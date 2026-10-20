/**
 * A TREE KEEPS ITS TICKS AS DATA — TODO 369. A parent is picked whole, or some
 * of its children as paths. Ticking every child leaves the parent at some
 * (Will, Q1 A); unticking one child of a picked parent picks the others; a
 * child under a picked parent says nothing more. Select all is every parent.
 * TRAP T-a-tree-menu-keeps-its-ticks-as-data
 *
 *   node --test test/unit/a-tree-keeps-its-ticks-as-data.test.mjs
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { TreePicks } from '../../dist/core/ui/tree-picks.js';

const ITEMS = [
  { value: 'N' }, { value: 'N/a', parent: 'N' }, { value: 'N/b', parent: 'N' },
  { value: 'C' }, { value: 'C/a', parent: 'C' }, { value: 'T' },
];
const boxes = (t) => ITEMS.map((i) => t.box(i.value));

test('a child under a picked parent says nothing more', () => {
  assert.deepEqual(new TreePicks(ITEMS, ['N/a', 'N', 'C/a']).values, ['N', 'C/a']);
});

test('a parent box: on, some or off; its children follow it', () => {
  assert.deepEqual(boxes(new TreePicks(ITEMS, ['N', 'C/a'])), ['on', 'on', 'on', 'some', 'on', 'off']);
});

test('one child off a picked parent picks the others; every child on is still some', () => {
  const t = new TreePicks(ITEMS, ['N']);
  t.tick('N/a', false);
  assert.deepEqual(t.values, ['N/b']);
  t.tick('N/a', true);
  assert.deepEqual(t.values, ['N/a', 'N/b']);
  assert.equal(t.box('N'), 'some');
  t.tick('N', true);
  assert.deepEqual(t.values, ['N']);
  t.tick('N', false);
  assert.deepEqual(t.values, []);
});

test('Select all is every parent it may tick; its box says all, some or none', () => {
  const t = new TreePicks(ITEMS, ['C/a']);
  assert.equal(t.allBox(), 'some');
  t.all(true, (v) => v !== 'T');
  assert.deepEqual(t.values, ['N', 'C']);
  assert.equal(t.allBox((v) => v !== 'T'), 'on');
  t.all(false);
  assert.deepEqual(t.values, []);
  assert.equal(t.allBox(), 'off');
});
