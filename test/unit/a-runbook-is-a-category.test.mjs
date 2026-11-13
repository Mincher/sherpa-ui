/**
 * A RUNBOOK IS A CATEGORY (Will, plan 936; D1 B, D2 A, D3 A). Runbooks stands in the Nodes panel after Custom Nodes. A
 * Custom Node or an entity takes a category when it is saved: Custom Nodes (none), Runbooks, or one an app's entity type
 * names. An entity's own category wins, then a node's settings', then its type's, as Demos' Runbook type gives Runbooks.
 *
 *   node --test test/unit/a-runbook-is-a-category.test.mjs
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { schemaCheck } from '../../scripts/lib/schema-check.mjs';

const core = new URL('../../dist/core/data/', import.meta.url);
const { NODE_CATEGORIES, NODE_KINDS, paletteOf } = await import(new URL('node-kinds.js', core));
const { kindsOf } = await import(new URL('node-library.js', core));
const { groupNodes } = await import(new URL('node-group.js', core));
const { definitionOf, nodeEntityOf } = await import(new URL('entity.js', core));
const { asNode, savedCategories } = await import(new URL('entity-types.js', core));

const RUNBOOK = { id: 'runbook', label: 'Runbook', category: 'Runbooks', graph: { runs: false, inputs: [{ name: 'rows', label: 'Rows', type: 'object' }], outputs: [{ name: 'found', label: 'Found', type: 'object' }] } };
const steps = (category) => ({
  v: 3, type: 'runbook', id: 'patch-review', label: 'Patch review', ...(category ? { category } : {}),
  graph: { nodes: [{ id: 'sort', kind: 'organise', x: 0, y: 0, values: { sort: 'name' } }], connections: [{ from: '#in/rows', to: 'sort' }, { from: 'sort/rows', to: '#out/found' }] },
});

test('Runbooks stands after Custom Nodes; savedCategories is Custom Nodes, Runbooks and each an app\'s types name', () => {
  assert.deepEqual(NODE_CATEGORIES.slice(2, 4), ['Custom Nodes', 'Runbooks']);
  assert.deepEqual(savedCategories({}), ['Custom Nodes', 'Runbooks']);
  assert.deepEqual(savedCategories({ a: { category: 'Agents', graph: {} }, b: { category: 'Runbooks', graph: {} }, c: { graph: {} }, rows: { category: 'Records' } }), ['Custom Nodes', 'Runbooks', 'Agents'], 'a row type\'s category lists rows, not nodes');
});

test('an entity\'s category: its own, else its type\'s; a node\'s settings say a node\'s; the schema takes it', () => {
  const types = { runbook: RUNBOOK };
  assert.equal(asNode(steps(), types).category, 'Runbooks', 'its type\'s');
  assert.equal(asNode(steps('Checks'), types).category, 'Checks', 'its own wins');
  assert.equal(asNode(steps(), { runbook: { ...RUNBOOK, category: undefined } }).category, undefined, 'none: Custom Nodes, as before');
  assert.equal(definitionOf({ v: 3, type: 'node', id: 'n', label: 'N', graph: { nodes: [] }, settings: { inputs: [], outputs: [], category: 'Runbooks' } }).category, 'Runbooks');
  assert.deepEqual(schemaCheck('entity.v3.json')(steps('Runbooks')), []);
});

test('a definition of a category other than a node\'s saves it at the top, and reads back the same', () => {
  const definition = { ...asNode(steps(), { runbook: RUNBOOK }), category: 'Runbooks' };
  const entity = nodeEntityOf('runbook:patch-review', definition);
  assert.deepEqual([entity.type, entity.category, entity.settings?.category], ['runbook', 'Runbooks', undefined]);
  assert.equal(definitionOf(entity).category, 'Runbooks');
});

test('Save as Custom Node with Runbooks: its kind stands under Runbooks in the panel', () => {
  const workflow = {
    v: 3, id: 'w',
    nodes: [{ id: 's', kind: 'source', x: 0, y: 0, values: { store: 'users' } }, { id: 'a', kind: 'organise', x: 300, y: 0, values: { sort: 'name' } }, { id: 'b', kind: 'organise', x: 600, y: 0, values: { group: 'status' } }],
    connections: [{ from: 's/rows', to: 'a' }, { from: 'a/rows', to: 'b' }],
  };
  const made = groupNodes(workflow, ['a', 'b'], { v: 1, nodes: {} }, { label: 'My steps', category: 'Runbooks' });
  assert.equal(made.library.nodes[made.id].category, 'Runbooks');
  const runbooks = paletteOf({ ...NODE_KINDS, ...kindsOf(made.library) }).find((g) => g.category === 'Runbooks');
  assert.deepEqual(runbooks.items.map((i) => i.kind.heading), ['My steps']);
});
