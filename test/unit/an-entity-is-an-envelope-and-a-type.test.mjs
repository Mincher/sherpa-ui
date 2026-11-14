/**
 * AN ENTITY IS AN ENVELOPE AND A TYPE: a graph saved under a type, an id and a name. One envelope
 * (entity.v3), a settings schema per type, and a registry in the data layer that an app adds to.
 * Each fault is named in words; a loop of entities is refused; a family outside the type is a
 * fault. ANY entity can be placed as a node in ANY graph (asNode), by the kind `<type>:<id>`, and a
 * use follows its definition (version, snapshot, diff, update) as a Custom Node's does.
 * Will, plan 746 E1 (D1, D2, D3, D8). TRAP T-an-entity-is-an-envelope-and-a-type
 *
 *   node --test test/unit/an-entity-is-an-envelope-and-a-type.test.mjs
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { schemaCheck } from '../../scripts/lib/schema-check.mjs';

const core = new URL('../../dist/core/data/', import.meta.url);
const T = await import(new URL('entity-types.js', core));
const C = await import(new URL('entity-check.js', core));
const E = await import(new URL('entity.js', core));
const lib = await import(new URL('node-library.js', core));
const { editWorkflow, workflowFaults } = await import(new URL('workflow.js', core));
const { NODE_KINDS } = await import(new URL('node-kinds.js', core));
const { onReport } = await import(new URL('report.js', core));

/** Customers whose status is active: a condition out. */
const ACTIVE = {
  v: 3, type: 'filter', id: 'active-customers', label: 'Active customers', description: 'Customers who are active.',
  graph: {
    nodes: [
      { id: 'start', kind: 'source', x: 0, y: 0, values: { store: 'customers' } },
      { id: 'status', kind: 'value', x: 0, y: 200, values: { value: 'active' } },
      { id: 'filter', kind: 'condition', x: 540, y: 0, values: { type: 'eq' } },
      { id: 'field', kind: 'field', x: 270, y: 0, values: { field: 'status' } },
    ],
    // The test's Pass into the Group Output (plan 971 §9).
    connections: [{ from: 'start/rows', to: 'field' }, { from: 'field/field', to: 'filter' }, { from: 'status/value', to: 'filter/b' }, { from: 'filter/pass', to: '#out/where' }],
  },
  settings: { source: 'customers' },
};
const make = (change = {}) => ({ ...structuredClone(ACTIVE), ...change });
/** A Filter that places another. */
const placing = (id, kind, extra = {}) => make({
  id, label: id.toUpperCase(),
  graph: { nodes: [{ id: 'inner', kind, x: 0, y: 0 }], connections: [{ from: 'inner', to: '#out/where' }] },
  ...extra,
});
const faults = (e, facts) => C.entityFaults(e, facts);
const heard = (run) => {
  const reports = [];
  const off = onReport((r) => reports.push(r));
  try { return { result: run(), reports }; } finally { off(); }
};

test('a good entity passes, in the shape the schema says; and so do the types\' settings', () => {
  assert.deepEqual(faults(make()), []);
  assert.equal(C.checkEntity(make()), true);
  assert.deepEqual(schemaCheck('entity.v3.json')(make()), []);
  assert.deepEqual(schemaCheck('entity-filter.v1.json')(make().settings), []);
  assert.ok(E.isEntity(make()));
  // The schema and the checks say the same of settings.
  for (const [type, settings] of [['filter', { source: 3 }], ['filter', { extra: 1 }], ['node', { inputs: [] }], ['node', { inputs: [], outputs: {} }]]) {
    assert.notDeepEqual(schemaCheck(`entity-${type}.v1.json`)(settings), [], `${type} ${JSON.stringify(settings)}`);
    assert.notDeepEqual(T.ENTITY_TYPES[type].settingsFaults(settings), []);
  }
});

test('each fault is named, in words', () => {
  const said = (e, facts) => faults(e, facts).join('\n');
  assert.match(said(null), /not an entity/);
  assert.match(said({ ...make(), label: ' ' }), /not an entity/);
  assert.match(said(make({ type: 'recipe' })), /type "recipe", which this app does not have/);
  assert.match(said(make({ settings: { source: 4 } })), /its source is not a name/);
  assert.match(said(make({ settings: { colour: 'red' } })), /the setting "colour", which this type does not keep/);
  assert.match(said(make({ graph: { ...ACTIVE.graph, connections: ACTIVE.graph.connections.slice(0, 2) } })), /sends nothing to its output "where"/);
  assert.match(said(make({ uses: [{ type: 'filter', id: 'gone' }] })), /uses the Filter "gone", which is not there/);
  assert.match(said(make({ graph: { nodes: [{ id: 'x', kind: 'filter:gone', x: 0, y: 0 }], connections: [{ from: 'x', to: '#out/where' }] } })), /a use of "filter:gone", which is not there/);
  // The graph's own faults come through, each as a Custom Node's would say them.
  assert.match(said(make({ graph: { nodes: [{ id: 'x', kind: 'nothing-like-it', x: 0, y: 0 }], connections: [{ from: 'x', to: '#out/where' }] } })), /"x"/);
  assert.match(said(make({ graph: { nodes: [{ id: '#in', kind: 'condition', x: 0, y: 0 }], connections: [{ from: '#in', to: '#out/where' }] } })), /a # name is the Group Input/);
  assert.match(said({ ...make(), type: 'node', settings: { inputs: [{ name: 'a', type: 'text' }], outputs: [] } }), /the Custom Node "active-customers" has the input "a" of the type "text"/);
  assert.ok(faults(make({ type: 'node', id: 'value', settings: { inputs: [], outputs: [] } })).some((f) => /shipped/.test(f)), 'a node entity may not take a shipped kind\'s id');
});

test('a family outside the type is a fault; a use of an entity is not bounded by it', () => {
  const sent = make({ graph: { nodes: [...ACTIVE.graph.nodes, { id: 'end', kind: 'result', x: 720, y: 0 }], connections: ACTIVE.graph.connections } });
  assert.match(faults(sent).join('\n'), /places "end", of the family "Output", which a Filter does not take: Sources, Variables, Math, Logic, Time, Organise, Utils/);
  // An Organise, of the Organise family: one a Filter takes.
  const sorted = make({ graph: { nodes: [...ACTIVE.graph.nodes, { id: 'order', kind: 'organise', x: 720, y: 200 }], connections: [...ACTIVE.graph.connections, { from: 'field/field', to: 'order' }] } });
  assert.deepEqual(faults(sorted), []);
  const sources = { id: 'sources-only', label: 'Sources only', graph: { runs: false, families: ['Sources'] } };
  assert.match(faults({ ...sorted, type: 'sources-only' }, { types: { 'sources-only': sources } }).join('\n'), /places "order", of the family "Organise"/);
  // A type with no families takes any; a `node` is one.
  assert.deepEqual(faults({ ...sent, type: 'node', settings: { inputs: [], outputs: [{ name: 'where', type: 'boolean' }] } }), []);
  const recent = make({ id: 'recent', label: 'Recent' });
  const uses = placing('outer', 'filter:recent');
  assert.deepEqual(faults(uses, { entities: [recent] }), []);
});

test('a cycle of entities is refused, said once, from either end; and one that holds itself', () => {
  const a = placing('a', 'filter:b', { label: 'A' });
  const b = placing('b', 'filter:a', { label: 'B' });
  for (const [one, other] of [[a, b], [b, a]]) {
    const found = faults(one, { entities: [other] }).filter((f) => /loop/.test(f));
    assert.equal(found.length, 1, found.join('|'));
    assert.match(found[0], /holds itself, in a loop: .* › .* › /);
  }
  assert.match(faults(placing('self', 'filter:self'), { entities: [] }).join('\n'), /loop/);
  // Three, through a declared `uses` alone.
  const x = make({ id: 'x', label: 'X', uses: [{ type: 'filter', id: 'y' }] });
  const y = make({ id: 'y', label: 'Y', uses: [{ type: 'filter', id: 'z' }] });
  const z = make({ id: 'z', label: 'Z', uses: [{ type: 'filter', id: 'x' }] });
  assert.match(faults(x, { entities: [y, z] }).join('\n'), /X › Y › Z › X/);
  // No loop where a chain only runs on.
  assert.deepEqual(faults(make({ id: 'top', uses: [{ type: 'filter', id: 'x' }] }), { entities: [make({ id: 'x', uses: [] })] }), []);
});

test('an app adds a type; a clash with a shipped one, or a type typeFaults refuses, is refused in words; taking it back takes it away', () => {
  const card = { id: 'ui-card', label: 'UI Card', graph: { runs: false, outputs: [{ name: 'present', type: 'object' }], families: ['Sources'] } };
  const { result: off, reports } = heard(() => [
    T.registerEntityType({ ...card, id: 'filter' }), T.registerEntityType({ ...card, id: 'Bad Name' }),
    T.registerEntityType({ ...card, graph: { ...card.graph, reusable: 'no' } }), T.registerEntityType({ id: 'bare', label: 'Bare' }), T.registerEntityType(card),
  ]);
  assert.deepEqual(off.slice(0, 4), [undefined, undefined, undefined, undefined]);
  const said = reports.filter((r) => r.code === 'entity-type').map((r) => r.message);
  assert.equal(said.length, 4);
  assert.match(said.join('\n'), /"filter" is a type the library ships/);
  assert.match(said.join('\n'), /graph: its reusable is not true or false/);
  assert.match(said.join('\n'), /"bare" is refused: it has no fields, and no graph/);
  assert.ok(T.entityTypes()['ui-card']);
  const e = { v: 3, type: 'ui-card', id: 'orders', label: 'Orders', graph: { nodes: [{ id: 'start', kind: 'source', x: 0, y: 0, values: { store: 'orders' } }], connections: [{ from: 'start/rows', to: '#out/present' }] } };
  assert.deepEqual(faults(e), []);
  off[4]();
  assert.match(faults(e).join('\n'), /type "ui-card", which this app does not have/);
  // Facts may carry the types instead of the registry: a test, a server.
  assert.deepEqual(faults(e, { types: { ...T.ENTITY_TYPES, 'ui-card': card } }), []);
});

test('any entity is a node in any graph: its kind is `<type>:<id>`, a use follows it, and the update flow is a Custom Node\'s', () => {
  const recent = make({ id: 'recent', label: 'Recent' });
  const kind = E.entityKind(recent);
  assert.equal(kind, 'filter:recent');
  assert.equal(E.entityKind({ type: 'node', id: 'org' }), 'org', 'a Custom Node keeps its plain id');
  const library = T.libraryOf([recent]);
  assert.deepEqual(Object.keys(library.nodes), [kind]);
  // The box: its sockets are its type's; its category is "Custom Nodes".
  const kinds = { ...NODE_KINDS, ...lib.kindsOf(library) };
  assert.equal(kinds[kind].model, 'graph');
  assert.deepEqual(kinds[kind].rows.map((r) => [r.name, r.output ?? r.input]), [['where', 'boolean']]);
  assert.equal(kinds[kind].category, 'Custom Nodes');
  assert.equal(T.asNode(recent).icon, 'filter');
  // Placed in a workflow of another type, it passes the workflow's own checks, and runs nested.
  const flow = { v: 3, id: 'flow', nodes: [{ id: 'pick', ...lib.useOf(library, kind, { id: 'pick', x: 0, y: 0 }) }, { id: 'end', kind: 'result', x: 360, y: 0 }], connections: [{ from: 'pick', to: 'end' }] };
  assert.deepEqual(lib.workflowFaultsDeep(flow, library), []);
  assert.ok(lib.innerOf(flow.nodes[0], library));
  // It follows the published number: none published, 1 (plan 972).
  assert.equal(flow.nodes[0].version, 1);
  assert.deepEqual(lib.staleUses(flow, library), []);
  // The entity changes and is PUBLISHED as version 2: the use shows a diff and an update brings it, keeping its values.
  const edited = { ...recent, graph: { ...recent.graph, nodes: recent.graph.nodes.map((n) => (n.id === 'status' ? { ...n, values: { value: 'trial' } } : n)) } };
  const drafted = T.libraryOf([edited]);
  const next = { ...drafted, nodes: { [kind]: { ...drafted.nodes[kind], version: 2 } } };
  assert.deepEqual(lib.staleUses(flow, next), ['pick']);
  assert.deepEqual(lib.definitionDiff(flow.nodes[0], next).nodes.changed, ['status']);
  assert.deepEqual(lib.staleUses(lib.updateInstance(flow, 'pick', next), next), []);
  // The entity that places it keeps the dependency, and the check reads it.
  const outer = placing('outer', kind, { uses: E.usesOf({ nodes: [{ id: 'inner', kind, x: 0, y: 0 }] }, [recent]) });
  assert.deepEqual(outer.uses, [{ type: 'filter', id: 'recent' }]);
  assert.deepEqual(faults(outer, { entities: [recent] }), []);
  assert.match(faults(outer, { entities: [] }).join('\n'), /uses the Filter "recent", which is not there/);
});

test('a Custom Node is the type `node`: the envelope wraps today\'s definition, and the two read back the same', () => {
  const definition = {
    v: 1, label: 'Org permissions', category: 'Logic', icon: 'lock', description: 'Who may.',
    inputs: [{ name: 'users', label: 'Users', type: 'object' }], outputs: [{ name: 'allowed', label: 'Allowed', type: 'object' }],
    nodes: [{ id: 'has-role', kind: 'condition', x: 200, y: 0, values: { type: 'eq' } }, { id: 'role', kind: 'field', x: 0, y: 0, values: { field: 'role' } }],
    // The header out, made from the test's Pass (plan 971 §9).
    connections: [{ from: '#in/users', to: 'role' }, { from: 'role/field', to: 'has-role' }, { from: 'has-role/pass', to: '#out/allowed' }, { from: 'has-role/pass', to: '#out' }],
  };
  const entity = E.nodeEntityOf('org-permissions', definition);
  assert.deepEqual(entity.settings.inputs, definition.inputs);
  assert.deepEqual(faults(entity), []);
  assert.deepEqual(schemaCheck('entity.v3.json')(entity), []);
  assert.deepEqual(schemaCheck('entity-node.v1.json')(entity.settings), []);
  assert.deepEqual(E.definitionOf(entity), definition);
  assert.deepEqual(E.definitionOf({ ...entity, origin: 'preset' }), { ...definition, preset: true });
  // The same box the library gives for the definition itself.
  assert.deepEqual(T.asNode(entity), { ...definition, icon: 'lock' });
  assert.equal(lib.versionOf(T.asNode(entity)), lib.versionOf(definition));
  // The library of one passes the library's own check.
  assert.deepEqual(lib.nodeLibraryFaults(T.libraryOf([entity])), []);
});

test('a workflow becomes an entity of a type, and is checked as one', () => {
  const workflow = { v: 3, id: 'active-customers', label: 'Active customers', nodes: ACTIVE.graph.nodes, connections: ACTIVE.graph.connections };
  const e = T.entityOf(workflow, 'filter', { source: 'customers' });
  assert.equal(e.id, 'active-customers');
  assert.deepEqual(faults(e), []);
  // The workflow's own checks still pass over the same nodes.
  assert.deepEqual(workflowFaults({ ...workflow, connections: workflow.connections.slice(0, 2) }, NODE_KINDS).filter((f) => /#out/.test(f)), []);
  assert.ok(editWorkflow);
});

test('a Save keeps the canvas\'s layout: stages, swimlanes and the places before them come back on the next load (933)', async () => {
  const { LANES_BY_FAMILY } = await import(new URL('node-lanes.js', core));
  let w = editWorkflow({ v: 3, id: 'laid', label: 'Laid out', nodes: [{ id: 's', kind: 'source', x: 0, y: 0, values: { store: 'users' } }, { id: 'v', kind: 'value', x: 400, y: 0 }], connections: [] }, { addStage: {} });
  w = editWorkflow(w, { lanes: LANES_BY_FAMILY });
  const entity = T.entityOf(w, 'workflow');
  assert.deepEqual(schemaCheck('entity.v3.json')(entity), []);
  assert.deepEqual([entity.graph.stages.length, entity.graph.lanes.length, Object.keys(entity.graph.beforeLanes)], [2, LANES_BY_FAMILY.length, ['s', 'v']]);
  // The editor's Save, the graph alone, keeps them too.
  const { graphOfWorkflow } = await import(new URL('graph-views.js', core));
  const saved = graphOfWorkflow(w);
  assert.deepEqual([saved.stages, saved.lanes, saved.beforeLanes], [w.stages, w.lanes, w.beforeLanes]);
  const back = C.graphWorkflow(entity).workflow;
  assert.deepEqual([back.stages, back.lanes, back.beforeLanes], [w.stages, w.lanes, w.beforeLanes]);
  // Off after the load: each node goes back.
  assert.deepEqual(editWorkflow(back, { lanes: null }).nodes.map((n) => [n.id, n.x, n.y]), [['s', 0, 0], ['v', 400, 0]]);
});
