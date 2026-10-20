/**
 * A SHUT PARENT HIDES ITS TREE — the walk up a flat tree's parent chain that
 * the nav and a menu's tree share (TODO 369). A shut grandparent hides a
 * grandchild whose own parent is open; a parent the map does not name is open;
 * a loop ends. TRAP T-parent-chain-walk-not-a-selector
 *
 *   node --test test/unit/a-shut-parent-hides-its-tree.test.mjs
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { hiddenRows } from '../../dist/core/ui/tree-rows.js';

const PARENT = new Map([['b', 'a'], ['c', 'b'], ['e', 'd'], ['g', 'f']]);
const IDS = ['a', 'b', 'c', 'd', 'e', 'f', 'g'];

test('a shut parent hides every row under it, at any depth', () => {
  const open = new Map([['a', false], ['b', true], ['d', true]]);
  assert.deepEqual([...hiddenRows(IDS, PARENT, open)].sort(), ['b', 'c']);
});

test('an open grandparent and a shut parent hide only the grandchild', () => {
  const open = new Map([['a', true], ['b', false]]);
  assert.deepEqual([...hiddenRows(IDS, PARENT, open)], ['c']);
});

test('a parent the open map does not name is open', () => {
  assert.deepEqual([...hiddenRows(IDS, PARENT, new Map())], []);
});

test('a loop in the parent chain ends', () => {
  const loop = new Map([['x', 'y'], ['y', 'x']]);
  assert.deepEqual([...hiddenRows(['x', 'y'], loop, new Map([['x', true], ['y', true]]))], []);
});
