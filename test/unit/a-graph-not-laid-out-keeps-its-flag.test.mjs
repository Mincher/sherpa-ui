/**
 * A GRAPH NOT LAID OUT YET KEEPS ITS FLAG (TODO 958) wherever it goes, as its other layout parts do, until the editor
 * unfurls it: an entity's graph opened on a canvas (with sockets or none), a Custom Node made of it, and a graph kept
 * again. The editor drops the flag before its own Save, so a Save after the unfurl writes none. Found by the Demos swap:
 * every Demos graph is an entity, and graphWorkflow built its workflow afresh without the flag.
 *
 *   node --test test/unit/a-graph-not-laid-out-keeps-its-flag.test.mjs
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { schemaCheck } from '../../scripts/lib/schema-check.mjs';

const core = new URL('../../dist/core/data/', import.meta.url);
const { graphWorkflow, entityFaults } = await import(new URL('entity-check.js', core));
const { graphOfWorkflow } = await import(new URL('graph-views.js', core));
const { layoutParts } = await import(new URL('graph-layout.js', core));
const { asNode } = await import(new URL('entity-types.js', core));

const nodes = [{ id: 's', kind: 'source', x: 0, y: 0, values: { store: 'users' } }, { id: 'o', kind: 'result', x: 0, y: 0 }];
const made = (type, settings) => ({ v: 2, type, id: 'made', label: 'Made', graph: { nodes, connections: [{ from: 's/rows', to: 'o' }], unfurl: true }, ...(settings ? { settings } : {}) });

test('an entity\'s graph keeps the flag on its canvas: with no sockets, and as a Custom Node\'s inside', () => {
  assert.equal(graphWorkflow(made('workflow')).workflow.unfurl, true);
  const node = made('node', { inputs: [{ name: 'rows', type: 'object' }], outputs: [] });
  assert.equal(graphWorkflow(node).workflow.unfurl, true);
  assert.equal(asNode(node).unfurl, true);
});

test('a graph kept again keeps it until the editor drops it; one laid out has none; the check and the schema take it', () => {
  assert.equal(graphOfWorkflow({ nodes, connections: [], unfurl: true }).unfurl, true);
  assert.equal(graphOfWorkflow({ nodes, connections: [] }).unfurl, undefined);
  assert.deepEqual(layoutParts({ unfurl: undefined }), {});
  const node = made('node', { inputs: [], outputs: [] });
  assert.deepEqual(entityFaults(node), []);
  assert.deepEqual(schemaCheck('entity.v2.json')(node), []);
});
