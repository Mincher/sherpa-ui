/**
 * A DEFINITION HAS ONE BODY AND ONE ENVELOPE (plan 960 U1): a graph's body (its nodes, connections, ties, frames, stages,
 * lanes) is said once, defs.v1 `graph`, and its header once, defs.v1 `envelope`. workflow.v3, entity.v2 and a Custom
 * Node's nodeDefinition each $ref them, pin their own `v`, and still refuse a key they do not have. A top workflow's
 * connections may not use a Group Input or Output; an entity's and a body's may. Will, TODO 960
 * · docs/history/plan-960-one-system-for-definitions.md
 *
 *   node --test test/unit/a-definition-has-one-body-and-one-envelope.test.mjs
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { schemaCheck } from '../../scripts/lib/schema-check.mjs';

const schema = (file) => JSON.parse(readFileSync(new URL(`../../schemas/${file}`, import.meta.url), 'utf8'));
const BODY = ['nodes', 'connections', 'ties', 'frames', 'stages', 'lanes', 'beforeLanes', 'unfurl'];
const nodes = [{ id: 'a', kind: 'source', x: 0, y: 0, values: { store: 'users' } }, { id: 'b', kind: 'result', x: 360, y: 0 }];

test('the body and the header are each said once, in defs.v1, and each definition $refs them', () => {
  const defs = schema('defs.v1.json').$defs;
  assert.deepEqual(Object.keys(defs.graph.properties), BODY);
  assert.deepEqual(Object.keys(defs.envelope.properties), ['$schema', 'v', 'type', 'id', 'label', 'description', 'tags']);
  // No definition says a body key or a header key of its own type again.
  const workflow = schema('workflow.v3.json');
  const entity = schema('entity.v2.json');
  assert.deepEqual(workflow.allOf.map((p) => p.$ref), ['defs.v1.json#/$defs/envelope', 'defs.v1.json#/$defs/graph']);
  assert.deepEqual(entity.allOf.map((p) => p.$ref), ['defs.v1.json#/$defs/envelope']);
  assert.equal(entity.properties.graph.$ref, 'defs.v1.json#/$defs/graph');
  assert.deepEqual(defs.nodeDefinition.allOf.map((p) => p.$ref), ['#/$defs/envelope', '#/$defs/graph']);
  for (const [name, props] of [['nodeDefinition', defs.nodeDefinition.properties], ['entity.v2', entity.properties]]) {
    for (const key of [...BODY, 'label', 'description', 'tags', '$schema']) assert.equal(props[key], undefined, `${name} says ${key} again`);
  }
});

test('each still checks as it did: its own v, the keys it needs, and no key it has not', () => {
  const workflow = schemaCheck('workflow.v3.json');
  const entity = schemaCheck('entity.v2.json');
  const node = schemaCheck('defs.v1.json#/$defs/nodeDefinition');
  const graph = { nodes, connections: [{ from: 'a/rows', to: 'b' }] };
  assert.deepEqual(workflow({ v: 3, id: 'w', label: 'W', ...graph }), []);
  assert.deepEqual(entity({ v: 2, type: 'workflow', id: 'w', label: 'W', tags: ['ops'], graph }), []);
  assert.deepEqual(node({ v: 1, label: 'N', tags: ['ops'], inputs: [], outputs: [], ...graph }), []);
  // Its own v, pinned.
  assert.notDeepEqual(workflow({ v: 2, id: 'w', ...graph }), []);
  assert.notDeepEqual(entity({ v: 1, type: 'workflow', id: 'w', label: 'W', graph }), []);
  // A key none of them has, at the top or in the body.
  assert.ok(workflow({ v: 3, id: 'w', ...graph, routes: [] }).some((e) => e.includes('unevaluated')));
  assert.ok(entity({ v: 2, type: 'workflow', id: 'w', label: 'W', graph: { ...graph, routes: [] } }).some((e) => e.includes('unevaluated')));
  assert.ok(node({ v: 1, label: 'N', inputs: [], outputs: [], ...graph, owner: 'me' }).some((e) => e.includes('unevaluated')));
  // The keys each needs.
  assert.notDeepEqual(entity({ v: 2, id: 'w', label: 'W', graph }), [], 'an entity needs its type');
  assert.notDeepEqual(workflow({ v: 3, nodes }), [], 'a workflow needs its id');
});

test('a top workflow\'s connections may not use a Group Input or Output; an entity\'s and a body\'s may', () => {
  const inner = { nodes, connections: [{ from: '#in/rows', to: 'b' }] };
  assert.notDeepEqual(schemaCheck('workflow.v3.json')({ v: 3, id: 'w', ...inner }), []);
  assert.deepEqual(schemaCheck('entity.v2.json')({ v: 2, type: 'node', id: 'n', label: 'N', graph: inner }), []);
  assert.deepEqual(schemaCheck('defs.v1.json#/$defs/nodeDefinition')({ v: 1, label: 'N', inputs: [{ name: 'rows', type: 'object' }], outputs: [], ...inner }), []);
});
