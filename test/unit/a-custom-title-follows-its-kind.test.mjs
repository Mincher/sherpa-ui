/**
 * A CUSTOM TITLE FOLLOWS ITS KIND (Will, 2026-11-11): a node may have a title of its own, and the
 * reader always sees what the node is — "Field: Device type", "Condition: Under 8 GB RAM". A title
 * that already starts with its kind is as it is; none, the node keeps the title it had. The data
 * keeps the node's own title: the drawn node carries its kind's name beside it, and the header says both.
 * TRAP T-a-custom-title-follows-its-kind
 *
 *   node --test test/unit/a-custom-title-follows-its-kind.test.mjs
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

const core = new URL('../../dist/core/data/', import.meta.url);
const { nodeTitle } = await import(new URL('node-title.js', core));
const { workflowGraph } = await import(new URL('workflow.js', core));

test('a title of its own follows the kind; one that is the kind or starts with it, and none, are as they were', () => {
  assert.equal(nodeTitle('Field', 'Device type'), 'Field: Device type');
  assert.equal(nodeTitle('Field', 'Field: Device type'), 'Field: Device type');
  assert.equal(nodeTitle('Field', 'field: device type'), 'field: device type');
  assert.equal(nodeTitle('Field', 'Field'), 'Field');
  assert.equal(nodeTitle('Field', '  '), 'Field');
  assert.equal(nodeTitle('Field', undefined), 'Field');
});

test('the graph keeps the node\'s own title and gives its kind beside it: a Condition\'s, never its check; an untitled node gets none', () => {
  const g = workflowGraph({ v: 3, id: 't', nodes: [
    { id: 's', kind: 'source', x: 0, y: 0, values: { store: 'devices' } },
    { id: 'f', kind: 'field', x: 360, y: 0, heading: 'Device type', values: { field: 'type' } },
    { id: 'c', kind: 'condition', x: 720, y: 0, heading: 'Under 8 GB RAM', values: { type: 'lt' } },
  ], connections: [{ from: 's/rows', to: 'f' }, { from: 'f/field', to: 'c' }] });
  const at = (id) => g.nodes.find((n) => n.id === id);
  assert.deepEqual([at('f').heading, at('f').kindHeading], ['Device type', 'Field']);
  assert.deepEqual([at('c').heading, at('c').kindHeading], ['Under 8 GB RAM', 'Condition']);
  assert.equal(at('s').kindHeading, undefined);
  assert.equal(nodeTitle(at('c').kindHeading, at('c').heading), 'Condition: Under 8 GB RAM');
});
