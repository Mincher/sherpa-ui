/**
 * A RUNBOOK IS A CATEGORY (Will, plan 936; D1 B, D2 A, D3 A), an app's: its graph type names it (plan 1008 L2), and it
 * stands in the Nodes panel after Custom Nodes. A Custom Node or an entity takes a category when it is saved: Custom Nodes
 * (none), or one an app's graph type names. An entity's own category wins, then a node's settings', then its type's, as Demos' Runbook type gives Runbooks.
 *
 *   node --test test/unit/a-runbook-is-a-category.test.mjs
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { schemaCheck } from '../../scripts/lib/schema-check.mjs';

const core = new URL('../../dist/core/data/', import.meta.url);
const { NODE_CATEGORIES, NODE_KINDS, familyOf, paletteOf } = await import(new URL('node-kinds.js', core));
const { kindsOf } = await import(new URL('node-library.js', core));
const { groupNodes } = await import(new URL('node-group.js', core));
const { definitionOf, nodeEntityOf } = await import(new URL('entity.js', core));
const { asNode, savedCategories } = await import(new URL('entity-types.js', core));

const RUNBOOK = { id: 'runbook', label: 'Runbook', category: 'Runbooks', graph: { runs: false, inputs: [{ name: 'rows', label: 'Rows', type: 'object' }], outputs: [{ name: 'found', label: 'Found', type: 'object' }] } };
const steps = (category) => ({
  v: 3, type: 'runbook', id: 'patch-review', label: 'Patch review', ...(category ? { category } : {}),
  graph: { nodes: [{ id: 'sort', kind: 'organise', x: 0, y: 0, values: { sort: 'name' } }], connections: [{ from: '#in/rows', to: 'sort' }, { from: 'sort/rows', to: '#out/found' }] },
});

test('the library names no Runbooks: an app\'s graph type gives its category, which stands after Custom Nodes; savedCategories is Custom Nodes and each an app\'s graph types name (plan 1008 L2)', () => {
  assert.equal(NODE_CATEGORIES.includes('Runbooks'), false);
  assert.deepEqual(savedCategories({}), ['Custom Nodes']);
  assert.deepEqual(savedCategories({ a: { category: 'Agents', graph: {} }, b: { category: 'Runbooks', graph: {} }, c: { graph: {} }, rows: { category: 'Records' } }), ['Custom Nodes', 'Agents', 'Runbooks']);
  // A graph type's uses stand right after Custom Nodes; an app's other kinds after the library's.
  const use = { heading: 'Patch review', icon: 'book', rows: [], model: 'graph', graphs: ['workflow'], category: 'Runbooks' };
  const own = { heading: 'Ticket', icon: 'ticket', rows: [], model: 'ticket', graphs: ['workflow'], category: 'Requests' };
  const order = paletteOf({ ...NODE_KINDS, 'runbook:patch': use, ticket: own }).map((g) => g.category);
  assert.equal(order[order.indexOf('Custom Nodes') + 1], 'Runbooks');
  assert.equal(order.at(-1), 'Requests');
  // Its look and its lane are Custom Nodes' in a category of the app's own (an Expert's too); one saved in a library category
  // is that one's.
  assert.deepEqual([familyOf(use), familyOf({ ...use, category: 'Experts' }), familyOf({ ...use, category: 'AI' }), familyOf(own)], ['custom-nodes', 'custom-nodes', 'ai', 'requests']);
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
