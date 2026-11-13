/**
 * A CUSTOM NODE KEEPS ITS LANES: Swimlanes inside a Custom Node are its definition's, kept as its frames are — in the
 * library, as an entity and back, and in the graph a use opens. They are how the body is drawn, so no part of its
 * version. Off is none: no empty list, nor the places they would put back. TODO 938
 *
 *   node --test test/unit/a-custom-node-keeps-its-lanes.test.mjs
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { schemaCheck } from '../../scripts/lib/schema-check.mjs';

const core = new URL('../../dist/core/data/', import.meta.url);
const { editDefinition, innerOf, versionOf } = await import(new URL('node-library.js', core));
const { definitionOf, nodeEntityOf } = await import(new URL('entity.js', core));
const { LANES_BY_FAMILY } = await import(new URL('node-lanes.js', core));

const BODY = {
  v: 1, label: 'Org permissions', inputs: [{ name: 'users', label: 'Users', type: 'object' }], outputs: [{ name: 'allowed', label: 'Allowed', type: 'object' }],
  nodes: [{ id: 'role', kind: 'field', x: 0, y: 0, values: { field: 'role' } }, { id: 'has-role', kind: 'condition', x: 360, y: 0, values: { type: 'eq' } }],
  connections: [{ from: '#in/users', to: 'role' }, { from: 'role/field', to: 'has-role' }, { from: 'has-role/pass', to: '#out/allowed' }],
};
const BEFORE = { role: { x: 0, y: 0 }, 'has-role': { x: 360, y: 0 } };
const library = (definition = BODY) => ({ v: 1, nodes: { org: structuredClone(definition) } });
const laned = () => editDefinition(library(), 'org', { lanes: LANES_BY_FAMILY, beforeLanes: BEFORE });

test('a definition keeps its lanes, and the places they would put back; the schemas take both', () => {
  const org = laned().nodes.org;
  assert.deepEqual([org.lanes.length, org.beforeLanes], [LANES_BY_FAMILY.length, BEFORE]);
  assert.deepEqual(schemaCheck('defs.v1.json#/$defs/nodeDefinition')(laned().nodes.org), []);
  assert.deepEqual(schemaCheck('entity.v3.json')(nodeEntityOf('org', org)), []);
});

test('as an entity and back, the lanes come too', () => {
  const org = laned().nodes.org;
  const entity = nodeEntityOf('org', org);
  assert.deepEqual([entity.graph.lanes, entity.graph.beforeLanes], [org.lanes, BEFORE]);
  const back = definitionOf(entity);
  assert.deepEqual([back.lanes, back.beforeLanes], [org.lanes, BEFORE]);
});

test('the graph a use opens has its lanes; with none, it has none', () => {
  const use = { id: 'perm', kind: 'org' };
  const inner = innerOf(use, laned());
  assert.deepEqual([inner.workflow.lanes, inner.workflow.beforeLanes], [laned().nodes.org.lanes, BEFORE]);
  assert.deepEqual(['lanes', 'beforeLanes'].filter((k) => k in innerOf(use, library()).workflow), []);
});

test('Swimlanes off is none: no empty list is kept, nor the places', () => {
  const off = editDefinition(laned(), 'org', { lanes: [] }).nodes.org;
  assert.deepEqual(['lanes', 'beforeLanes'].filter((k) => k in off), []);
  assert.deepEqual(schemaCheck('defs.v1.json#/$defs/nodeDefinition')(off), []);
  // A change that names no lanes keeps them.
  assert.equal(editDefinition(laned(), 'org', { label: 'Org check' }).nodes.org.lanes.length, LANES_BY_FAMILY.length);
});

test('lanes are no part of its version: no use goes stale', () => {
  assert.equal(versionOf(laned().nodes.org), versionOf(BODY));
});
