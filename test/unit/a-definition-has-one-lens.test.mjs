/**
 * A DEFINITION HAS ONE LENS (plan 960 U4.1): one door, per type, draws a definition as a graph and writes the graph back,
 * or refuses in words. Every entity type's lens is the identity: an entity goes to a graph and back the same, a Custom
 * Node's with its Group Input and Output drawn and dropped again. A registered lens wins; a second one for a type is
 * refused; taken back, the type has its own again. A type that is no entity and has none registered has no lens.
 *
 *   node --test test/unit/a-definition-has-one-lens.test.mjs
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

const core = new URL('../../dist/core/data/', import.meta.url);
const { lensOf, registerLens } = await import(new URL('lens.js', core));
const { onReport } = await import(new URL('report.js', core));
const { GROUP_INPUT, GROUP_OUTPUT } = await import(new URL('node-library.js', core));

const nodes = [{ id: 'f', kind: 'field', x: 0, y: 0, values: { field: 'role' } }];
/** A Custom Node: Rows in, the Role out, in a stage. */
const HAS_ROLE = {
  v: 2, type: 'node', id: 'has-role', label: 'Has role',
  graph: { nodes: nodes.map((n) => ({ ...n, stage: 'find' })), connections: [{ from: '#in/rows', to: 'f' }, { from: 'f/field', to: '#out/role' }], stages: [{ id: 'find', label: 'Find', x: -40 }] },
  settings: { inputs: [{ name: 'rows', label: 'Rows', type: 'object' }], outputs: [{ name: 'role', label: 'Role', type: 'value' }] },
};

test('an entity\'s lens is the identity: drawn with its Group Input and Output, and back the same', () => {
  const lens = lensOf('node');
  const { workflow, kinds } = lens.toGraph(HAS_ROLE);
  assert.deepEqual(workflow.nodes.map((n) => n.id).sort(), ['#in', '#out', 'f']);
  assert.ok(kinds[GROUP_INPUT] && kinds[GROUP_OUTPUT], 'the body\'s group kinds come with it');
  const back = lens.fromGraph(HAS_ROLE, workflow);
  assert.deepEqual(back, { definition: HAS_ROLE });
  // An edit on the graph is the definition's.
  const moved = lens.fromGraph(HAS_ROLE, { ...workflow, nodes: workflow.nodes.map((n) => (n.id === 'f' ? { ...n, x: 120 } : n)) });
  assert.equal(moved.definition.graph.nodes[0].x, 120);
});

test('a graph that cannot be kept is refused in words, as the shelf\'s check says it', () => {
  const { workflow } = lensOf('node').toGraph(HAS_ROLE);
  const odd = lensOf('node').fromGraph(HAS_ROLE, { ...workflow, nodes: [...workflow.nodes, { id: 'x', kind: 'nope', x: 0, y: 0 }] });
  assert.ok(odd.faults.some((f) => f.includes('"nope"')), odd.faults?.join('; '));
  assert.equal(odd.definition, undefined);
});

test('a registered lens wins, a second is refused, and taken back the type has its own; a type of nothing has none', () => {
  const page = { toGraph: () => ({ workflow: { v: 3, id: 'p', nodes: [] } }), fromGraph: (before) => ({ definition: before }) };
  assert.equal(lensOf('a-page'), undefined);
  const back = registerLens('a-page', page);
  assert.equal(lensOf('a-page'), page);
  const said = [];
  const off = onReport((r) => said.push(r.code));
  try {
    assert.equal(registerLens('a-page', page), undefined);
  } finally {
    off();
  }
  assert.deepEqual(said, ['lens']);
  back();
  assert.equal(lensOf('a-page'), undefined);
  // A type of entity may be given another lens, and has the identity again when it is taken back.
  const undo = registerLens('node', page);
  assert.equal(lensOf('node'), page);
  undo();
  assert.notEqual(lensOf('node'), page);
});
