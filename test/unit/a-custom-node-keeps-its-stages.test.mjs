/**
 * A CUSTOM NODE KEEPS ITS STAGES: stages inside a Custom Node are its definition's, kept as its lanes are — in the
 * library, as an entity and back, and in the graph a use opens — and checked there as at the top. Save as Custom Node
 * takes the stages its nodes stand in. A stage is how the body is laid out, so no part of its version. TODO 947
 *
 *   node --test test/unit/a-custom-node-keeps-its-stages.test.mjs
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { schemaCheck } from '../../scripts/lib/schema-check.mjs';

const core = new URL('../../dist/core/data/', import.meta.url);
const { editDefinition, innerOf, versionOf, workflowFaultsDeep } = await import(new URL('node-library.js', core));
const { definitionOf, nodeEntityOf } = await import(new URL('entity.js', core));
const { entityFaults } = await import(new URL('entity-check.js', core));
const { groupNodes } = await import(new URL('node-group.js', core));

const STAGES = [{ id: 'plan', label: 'Plan', x: -40 }, { id: 'do', label: 'Do', x: 400 }];
const BODY = {
  v: 1, label: 'Org permissions', inputs: [{ name: 'users', label: 'Users', type: 'object' }], outputs: [{ name: 'allowed', label: 'Allowed', type: 'object' }],
  nodes: [{ id: 'role', kind: 'field', x: 0, y: 0, stage: 'plan', values: { field: 'role' } }, { id: 'has-role', kind: 'condition', x: 440, y: 0, stage: 'do', values: { type: 'eq' } }],
  connections: [{ from: '#in/users', to: 'role' }, { from: 'role/field', to: 'has-role' }, { from: 'has-role/rows', to: '#out/allowed' }],
};
const library = (definition = BODY) => ({ v: 1, nodes: { org: structuredClone(definition) } });
const staged = () => editDefinition(library(), 'org', { stages: STAGES });

test('a definition keeps its stages; the schemas take them', () => {
  assert.deepEqual(staged().nodes.org.stages, STAGES);
  assert.deepEqual(schemaCheck('defs.v1.json#/$defs/nodeDefinition')(staged().nodes.org), []);
  assert.deepEqual(schemaCheck('entity.v2.json')(nodeEntityOf('org', staged().nodes.org)), []);
});

test('as an entity and back, the stages come too, and its nodes find them: no fault', () => {
  const entity = nodeEntityOf('org', staged().nodes.org);
  assert.deepEqual(entity.graph.stages, STAGES);
  assert.deepEqual(definitionOf(entity).stages, STAGES);
  assert.deepEqual(entityFaults(entity), []);
  // A node in a stage the body has not is a fault, in words, as at the top.
  const lost = { ...entity, graph: { ...entity.graph, stages: [STAGES[0]] } };
  assert.ok(entityFaults(lost).some((f) => /the node "has-role" is in the stage "do", which is not there/.test(f)), JSON.stringify(entityFaults(lost)));
});

test('the graph a use opens has its stages; with none, it has none; none kept is no empty list', () => {
  const use = { id: 'perm', kind: 'org' };
  assert.deepEqual(innerOf(use, staged()).workflow.stages, STAGES);
  const plain = { ...BODY, nodes: BODY.nodes.map(({ stage: _s, ...n }) => n) };
  assert.equal('stages' in innerOf(use, library(plain)).workflow, false);
  assert.equal('stages' in editDefinition(staged(), 'org', { stages: [] }).nodes.org, false);
  assert.equal(editDefinition(staged(), 'org', { label: 'Org check' }).nodes.org.stages.length, 2, 'a change that names no stages keeps them');
});

test('stages are no part of its version: a node moved to another stage makes no use stale', () => {
  const moved = editDefinition(staged(), 'org', { nodes: BODY.nodes.map((n) => ({ ...n, stage: 'plan' })) }).nodes.org;
  assert.equal(versionOf(moved), versionOf(staged().nodes.org));
  assert.equal(versionOf(staged().nodes.org), versionOf(BODY));
});

test('Save as Custom Node takes the stages its nodes stand in; the use stands in a stage; it passes the checks', () => {
  const workflow = {
    v: 3, id: 'flow', stages: [...STAGES, { id: 'check', label: 'Check', x: 1260 }],
    nodes: [
      { id: 'start', kind: 'source', x: 0, y: 0, stage: 'plan', values: { store: 'customers' } },
      { id: 'seats', kind: 'field', x: 440, y: 0, stage: 'do', values: { field: 'seats' } },
      { id: 'few', kind: 'condition', x: 760, y: 0, stage: 'do', values: { type: 'lt', b: 5 } },
      { id: 'end', kind: 'result', x: 1300, y: 0, stage: 'check' },
    ],
    connections: [{ from: 'start/rows', to: 'seats' }, { from: 'seats/field', to: 'few' }, { from: 'few/rows', to: 'end' }],
  };
  const facts = { fieldsOf: { customers: { seats: { type: 'number' } } } };
  const made = groupNodes(workflow, ['start', 'seats'], { v: 1, nodes: {} }, { label: 'Seats' }, undefined, facts);
  assert.ok(!('fault' in made), made.fault);
  assert.deepEqual(made.library.nodes[made.id].stages.map((s) => s.id), ['plan', 'do']);
  assert.ok(STAGES.some((s) => s.id === made.workflow.nodes.find((n) => n.id === made.use).stage), 'the use is in a stage');
  assert.deepEqual(workflowFaultsDeep(made.workflow, made.library, undefined, facts), []);
});
