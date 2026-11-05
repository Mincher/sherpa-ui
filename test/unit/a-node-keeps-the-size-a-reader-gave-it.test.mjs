/**
 * A node's SIZE is a part of the workflow: `size: { w, h }`, in times its natural size, 1 to 2 each way,
 * beside `x` and `y`. The pure edit `{ resize }` sets it (natural size keeps none), a size outside 1 to 2
 * is a fault in words, a v1 reads none, a Custom Node body keeps it, and the draw hands it on. Will, TODO 740.
 *
 *   node --test test/unit/a-node-keeps-the-size-a-reader-gave-it.test.mjs
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { schemaCheck } from '../../scripts/lib/schema-check.mjs';

const core = new URL('../../dist/core/data/', import.meta.url);
const { editWorkflow, readWorkflow, workflowFaults, workflowGraph } = await import(new URL('workflow.js', core));
const { groupNodes } = await import(new URL('node-group.js', core));

const flow = () => ({
  v: 2, id: 'f',
  nodes: [{ id: 's', kind: 'source', x: 0, y: 0, values: { store: 'users' } }, { id: 'e', kind: 'output', x: 400, y: 0 }],
  routes: [{ from: 's/rows', to: 'e' }],
});

test('a resize sets the size, and the natural size keeps none', () => {
  const big = editWorkflow(flow(), { resize: { node: 's', w: 1.5, h: 1.25 } });
  assert.deepEqual(big.nodes[0].size, { w: 1.5, h: 1.25 });
  assert.equal(big.nodes[1].size, undefined);
  assert.equal('size' in editWorkflow(big, { resize: { node: 's', w: 1, h: 1 } }).nodes[0], false);
});

test('a size outside 1 to 2 is a fault in words; one inside is none', () => {
  const faults = workflowFaults(editWorkflow(flow(), { resize: { node: 's', w: 2.5, h: 0.5 } }));
  assert.equal(faults.length, 1);
  assert.match(faults[0], /the node "s" is sized 2.5 by 0.5 times its natural size, and a size runs from 1 to 2/);
  assert.deepEqual(workflowFaults(editWorkflow(flow(), { resize: { node: 's', w: 2, h: 1 } })), []);
});

test('the schema takes the size, in v2 and in a Custom Node body, and refuses 3', () => {
  const ok = editWorkflow(flow(), { resize: { node: 's', w: 1.4, h: 1.1 } });
  assert.deepEqual(schemaCheck('workflow.v2.json')(JSON.parse(JSON.stringify(ok))), []);
  assert.notDeepEqual(schemaCheck('workflow.v2.json')(editWorkflow(flow(), { resize: { node: 's', w: 3, h: 1 } })), []);
});

test('a v1 reads none, and the read keeps a v2 size', () => {
  assert.equal(readWorkflow({ ...flow(), v: 1 }).workflow.nodes[0].size, undefined);
  const ok = editWorkflow(flow(), { resize: { node: 's', w: 1.4, h: 1.1 } });
  assert.deepEqual(readWorkflow(ok).workflow.nodes[0].size, { w: 1.4, h: 1.1 });
});

test('the drawn node carries its size and its kind\'s category', () => {
  const g = workflowGraph(editWorkflow(flow(), { resize: { node: 's', w: 1.4, h: 1.1 } }));
  const s = g.nodes.find((n) => n.id === 's');
  assert.deepEqual(s.size, { w: 1.4, h: 1.1 });
  assert.equal(s.category, 'Sources');
  assert.equal(g.nodes.find((n) => n.id === 'e').category, 'Output');
});

test('a Custom Node body keeps the size of the nodes it was made from', () => {
  const w = editWorkflow(flow(), { resize: { node: 'e', w: 1.6, h: 1.2 } });
  const made = groupNodes(w, ['e'], { v: 1, nodes: {} }, { label: 'Ending' }, undefined, {});
  assert.ok(!made.fault, made.fault);
  assert.deepEqual(made.library.nodes[made.id].nodes[0].size, { w: 1.6, h: 1.2 });
});
