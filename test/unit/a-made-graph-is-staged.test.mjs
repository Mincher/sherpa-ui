/**
 * A MADE GRAPH IS STAGED — plan 964 N3c, with sherpa-ui-e8: a graph a writer gives (an act, the MCP) has every node in a
 * stage BEFORE there is a layout: the one it names; else its nearest named neighbour's, by x; with none named, the
 * columns cut at their widest gaps. The Start stands in the first; a Group Input or Output in none. After a layout, by
 * where a node stands, is fitStages's.
 *
 *   node --test test/unit/a-made-graph-is-staged.test.mjs
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { stageNodes } from '../../dist/data.js';

const STAGES = [{ id: 'gather', label: 'Gather', x: 0 }, { id: 'decide', label: 'Decide', x: 600 }, { id: 'act', label: 'Act', x: 1200 }];
const node = (id, x, stage) => ({ id, kind: 'value', x, y: 0, ...(stage ? { stage } : {}) });

test('a node that names its stage keeps it; every node staged, the same array, so a writer may call it always', () => {
  const nodes = [node('#start', 0, 'gather'), node('a', 100, 'gather'), node('b', 700, 'decide')];
  assert.equal(stageNodes(STAGES, nodes), nodes);
  assert.equal(stageNodes(undefined, nodes), nodes, 'a graph with no stages is left as it is');
});

test('the Start stands in the first stage; a Group Input or Output in none', () => {
  const nodes = [node('#start', 900, 'act'), node('#in', 0), node('a', 100, 'gather')];
  const staged = stageNodes(STAGES, nodes);
  assert.deepEqual(staged.map((n) => n.stage), ['gather', undefined, 'gather']);
  assert.equal(staged[1], nodes[1]);
});

test('a node that names none joins its nearest named neighbour\'s stage, by x', () => {
  const staged = stageNodes(STAGES, [node('a', 100, 'gather'), node('b', 1300, 'act'), node('c', 400), node('d', 1000)]);
  assert.deepEqual(staged.map((n) => [n.id, n.stage]), [['a', 'gather'], ['b', 'act'], ['c', 'gather'], ['d', 'act']]);
});

test('with none named, the columns are cut at their widest gaps, a group to a stage, left to right', () => {
  const staged = stageNodes(STAGES, [node('a', 0), node('b', 200), node('c', 900), node('d', 1000), node('e', 2000)]);
  assert.deepEqual(staged.map((n) => n.stage), ['gather', 'gather', 'decide', 'decide', 'act']);
});

test('the Start is placed by rule, never named: on a top graph it leads no node to its stage and takes no cut (e8)', () => {
  const staged = stageNodes(STAGES, [node('#start', -300), node('a', 0), node('b', 200), node('c', 900), node('d', 1000), node('e', 2000)]);
  assert.deepEqual(staged.map((n) => n.stage), ['gather', 'gather', 'gather', 'decide', 'decide', 'act']);
  const near = stageNodes(STAGES, [node('#start', 0, 'gather'), node('a', 1300, 'act'), node('b', 100)]);
  assert.equal(near[2].stage, 'act', 'its nearest named is a node the writer staged, not the Start');
});
