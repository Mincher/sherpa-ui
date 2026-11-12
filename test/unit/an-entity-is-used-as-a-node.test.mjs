/**
 * AN ENTITY IS USED AS A NODE: a saved Preset Filter — any entity — is a node the panel offers, by the
 * kind `<type>:<id>`, and a use of it is an INSTANCE: it records its version, runs nested, and when
 * the entity is saved again it shows the change and updates, keeping its own values (D11). An edit
 * inside goes back to its entity, of its own type; a copy keeps its settings. The panel offers what
 * the graph's type takes, and no node that would hold it in a loop. Will, plan 746 E5 (D1, D8, D11).
 * TRAP T-an-entity-is-used-as-a-node
 *
 *   node --test test/unit/an-entity-is-used-as-a-node.test.mjs
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { graph } from '../../scripts/check-weight.mjs';

const core = new URL('../../dist/core/', import.meta.url);
const { PageKeeper, memoryTier } = await import(new URL('browser/page-state.js', core));
const { offeredKinds, asNode, registerEntityType } = await import(new URL('data/entity-types.js', core));
const { entityFaults } = await import(new URL('data/entity-check.js', core));
const { entityKind, entityRefOf, nodeEntityOf } = await import(new URL('data/entity.js', core));
const lib = await import(new URL('data/node-library.js', core));
const { NODE_KINDS, paletteOf } = await import(new URL('data/node-kinds.js', core));
const { onReport } = await import(new URL('data/report.js', core));

/** Records whose status is one value — Source › Field › Condition — sent to the Preset Filter's Where. */
const filter = (id, label, value = 'active', extra = {}) => ({
  v: 2, type: 'preset-filter', id, label,
  graph: {
    nodes: [
      { id: 'start', kind: 'source', x: 0, y: 0, values: { store: 'customers' } },
      { id: 'status', kind: 'condition', x: 540, y: 0, values: { type: 'eq', b: value } },
      { id: 'field', kind: 'field', x: 270, y: 0, values: { field: 'status' } },
    ],
    // The test's True into the Group Output: no node has a True socket (plan 944).
    connections: [{ from: 'start/rows', to: 'field' }, { from: 'field/field', to: 'status' }, { from: 'status/true', to: '#out/where' }],
  },
  settings: { source: 'customers' }, ...extra,
});
/** A Preset Filter whose graph places one node of a kind. */
const placing = (id, kind) => ({ ...filter(id, id.toUpperCase()), graph: { nodes: [{ id: 'use', kind, x: 0, y: 0 }], connections: [{ from: 'use', to: '#out/where' }] } });
const keeper = () => new PageKeeper({ tab: memoryTier(), local: memoryTier() });
const heard = async (run) => {
  const said = [];
  const off = onReport((r) => said.push(r.message));
  try { return { result: await run(), said }; } finally { off(); }
};
/** A workflow that places a use of a kind, as the editor places one: its version and `was` recorded. */
const flowOf = (library, kind, ids = ['pick']) => ({
  v: 3, id: 'flow',
  nodes: [...ids.map((id, i) => lib.useOf(library, kind, { id, x: 0, y: i * 200 })), { id: 'end', kind: 'result', x: 360, y: 0 }],
  connections: ids.map((id) => ({ from: id, to: 'end' })),
});

test('every entity is a node the panel offers, by its use\'s kind; a preset is read only, and its own settings ride with it', async () => {
  const k = keeper();
  k.entityPresets = [filter('active', 'Active')];
  await k.entities.save(filter('trials', 'Trials', 'trial'));
  const library = k.nodeLibrary();
  assert.deepEqual(Object.keys(library.nodes), ['preset-filter:active', 'preset-filter:trials']);
  assert.equal(library.nodes['preset-filter:active'].preset, true);
  assert.equal(library.nodes['preset-filter:trials'].preset, undefined);
  assert.deepEqual(library.nodes['preset-filter:trials'].settings, { source: 'customers' });
  // Its box: a Where out, a filter's icon, under Custom Nodes in the panel.
  const kinds = { ...NODE_KINDS, ...lib.kindsOf(library) };
  assert.deepEqual(kinds['preset-filter:trials'].rows.map((r) => [r.name, r.output]), [['where', 'boolean']]);
  const custom = paletteOf(kinds).find((g) => g.category === 'Custom Nodes');
  assert.deepEqual(custom.items.map((i) => [i.id, i.kind.icon]), [['preset-filter:active', 'filter'], ['preset-filter:trials', 'filter']]);
  // The kind and the entity, both ways round.
  assert.deepEqual(entityRefOf('preset-filter:trials'), { type: 'preset-filter', id: 'trials' });
  assert.deepEqual(entityRefOf('has-role'), { type: 'node', id: 'has-role' });
  assert.equal(entityKind(entityRefOf('preset-filter:trials')), 'preset-filter:trials');
  const back = nodeEntityOf('preset-filter:trials', asNode(k.entities.get('trials')));
  const { origin: _o, ...kept } = k.entities.get('trials');
  assert.deepEqual(back, kept);
});

test('the panel offers what the graph\'s type takes, and no node that would hold it in a loop, at any depth', () => {
  const entities = [placing('outer', 'preset-filter:inner'), filter('inner', 'Inner'), placing('top', 'preset-filter:outer'), placing('topmost', 'preset-filter:top'), filter('apart', 'Apart')];
  const library = { v: 1, nodes: Object.fromEntries(entities.map((e) => [entityKind(e), asNode(e)])) };
  const kinds = { ...NODE_KINDS, ...lib.kindsOf(library) };
  const offered = (host) => Object.keys(offeredKinds(kinds, host, library.nodes));
  const inOuter = offered('preset-filter:outer');
  // A Preset Filter takes a Source and a Condition, never an Output: its families.
  assert.ok(inOuter.includes('source') && inOuter.includes('condition'));
  assert.ok(!inOuter.includes('result'));
  // Any entity's node is offered (D1), but its own and the two that hold it, one through the other.
  assert.deepEqual(inOuter.filter((id) => id.includes(':')).sort(), ['preset-filter:apart', 'preset-filter:inner']);
  // A Custom Node's type takes every family; a plain workflow is offered all.
  assert.ok(offered('some-node').includes('result'));
  assert.deepEqual(offered(undefined), Object.keys(kinds));
  // The check says the same of a family: what the panel leaves out, a save refuses.
  const sent = { ...filter('sent', 'Sent'), graph: { nodes: [...filter('x', 'x').graph.nodes, { id: 'end', kind: 'result', x: 720, y: 0 }], connections: filter('x', 'x').graph.connections } };
  assert.match(entityFaults(sent).join('\n'), /places "end", of the family "Output"/);
});

test('a use flattens: placed, it records its version; inside, it is the entity\'s graph with its Group Output; its faults come through by path', () => {
  const trials = filter('trials', 'Trials', 'trial');
  const library = { v: 1, nodes: { 'preset-filter:trials': asNode(trials) } };
  const flow = flowOf(library, 'preset-filter:trials');
  assert.equal(flow.nodes[0].version, lib.versionOf(asNode(trials)));
  assert.deepEqual(lib.workflowFaultsDeep(flow, library), []);
  const inner = lib.innerOf(flow.nodes[0], library);
  assert.deepEqual(inner.workflow.nodes.map((n) => n.id), ['#in', 'start', 'status', 'field', '#out']);
  assert.deepEqual(inner.kinds['#group-output'].rows.map((r) => r.name), ['where']);
  // A fault inside is the same fault a use shows, named by the path to it.
  const broken = { ...trials, graph: { ...trials.graph, connections: [...trials.graph.connections, { from: 'start/rows', to: 'status/nothing' }] } };
  const own = entityFaults(broken).find((f) => /nothing/.test(f));
  const used = lib.workflowFaultsDeep(flow, { v: 1, nodes: { 'preset-filter:trials': asNode(broken) } }).find((f) => /nothing/.test(f));
  assert.ok(own && used, `${own} | ${used}`);
  assert.match(used, /^Trials: /);
});

test('an edit inside goes back to its entity, of its own type, its settings kept; a family its type does not take is refused in words; a preset is read only', async () => {
  const k = keeper();
  k.entityPresets = [filter('active', 'Active')];
  await k.entities.save(filter('trials', 'Trials', 'trial'));
  const edited = lib.editDefinition(k.nodeLibrary(), 'preset-filter:trials', {
    nodes: filter('t', 't', 'lead').graph.nodes,
  });
  assert.equal(await k.saveNode('preset-filter:trials', edited.nodes['preset-filter:trials']), true);
  const kept = k.entities.get('trials');
  assert.deepEqual([kept.type, kept.settings, kept.graph.nodes[1].values.b], ['preset-filter', { source: 'customers' }, 'lead']);
  // An Output inside a Preset Filter: refused, and said.
  const withOutput = lib.editDefinition(k.nodeLibrary(), 'preset-filter:trials', {
    nodes: [...kept.graph.nodes, { id: 'end', kind: 'result', x: 720, y: 0 }],
  });
  const { result, said } = await heard(() => k.saveNode('preset-filter:trials', withOutput.nodes['preset-filter:trials']));
  assert.equal(result, false);
  assert.match(said.join('\n'), /of the family "Output", which a Preset Filter does not take/);
  assert.equal(k.entities.get('trials').graph.nodes.length, 3);
  const preset = await heard(() => k.saveNode('preset-filter:active', k.nodeLibrary().nodes['preset-filter:active']));
  assert.equal(preset.result, false);
  assert.match(preset.said.join('\n'), /preset, which is read only/);
});

test('D11: the entity saved again — each use says so, its diff names the change, and an update keeps its own values; Update all on the graph', async () => {
  const k = keeper();
  await k.entities.save(filter('trials', 'Trials', 'trial'));
  const before = k.nodeLibrary();
  let flow = flowOf(before, 'preset-filter:trials', ['one', 'two']);
  flow = { ...flow, nodes: flow.nodes.map((n) => (n.id === 'one' ? { ...n, heading: 'Trials, mine' } : n)) };
  assert.deepEqual(lib.staleUses(flow, before), []);
  // Saved again, from its own canvas, as Save writes it.
  await k.entities.save(filter('trials', 'Trials', 'lead'));
  const after = k.nodeLibrary();
  assert.deepEqual(lib.staleUses(flow, after), ['one', 'two']);
  const diff = lib.definitionDiff(flow.nodes[0], after);
  assert.deepEqual([diff.stale, diff.known, diff.nodes.changed], [true, true, ['status']]);
  const one = lib.updateInstance(flow, 'one', after);
  assert.deepEqual(lib.staleUses(one, after), ['two']);
  assert.equal(one.nodes.find((n) => n.id === 'one').heading, 'Trials, mine', 'its own values stay');
  assert.deepEqual(lib.staleUses(lib.updateAll(flow, 'preset-filter:trials', after), after), []);
  // A use made from now on follows the new one.
  assert.deepEqual(lib.staleUses(flowOf(after, 'preset-filter:trials'), after), []);
});

test('"Copy to my nodes" of a preset makes the reader\'s own of the same type, under a free id, its settings kept', async () => {
  const k = keeper();
  k.entityPresets = [filter('active', 'Active')];
  const taken = {
    v: 1, label: 'Taken', inputs: [{ name: 'rows', type: 'object' }], outputs: [],
    nodes: [{ id: 'c', kind: 'condition', x: 0, y: 0, values: { type: 'eq', b: 'x' } }],
    // An output made from the test's True property (plan 944).
    connections: [{ from: '#in/rows', to: 'c' }, { from: 'c/true', to: '#out' }],
  };
  assert.equal(await k.saveNode('active-copy', taken), true);
  const made = lib.copyToMine(k.nodeLibrary(), 'preset-filter:active');
  // An id names one entity of any type: a Custom Node holds active-copy.
  assert.equal(made.id, 'preset-filter:active-copy-2');
  assert.equal(await k.saveNode(made.id, made.library.nodes[made.id]), true);
  const copy = k.entities.get('active-copy-2');
  assert.deepEqual([copy.type, copy.label, copy.settings, copy.origin], ['preset-filter', 'Active copy', { source: 'customers' }, 'mine']);
  assert.equal(k.removeNode('active-copy-2'), false, 'a plain id names a Custom Node');
  assert.equal(k.removeNode('preset-filter:active-copy-2'), true);
});

test('an app\'s type is used as a node too; and the keeper\'s modules stay light: no node kind, no workflow', () => {
  const off = registerEntityType({ id: 'ui-card', label: 'UI Card', runs: false, icon: 'grid', families: ['Sources'], outputs: [{ name: 'present', type: 'object' }] });
  try {
    const card = { v: 2, type: 'ui-card', id: 'orders', label: 'Orders', graph: { nodes: [{ id: 'f', kind: 'preset-filter:trials', x: 0, y: 0 }], connections: [] } };
    const node = asNode(card);
    assert.deepEqual([node.icon, node.outputs.map((o) => o.name)], ['grid', ['present']]);
    // A card takes a Source, not a Condition; any entity's node, as a Preset Filter's.
    const library = { v: 1, nodes: { 'ui-card:orders': node, 'preset-filter:trials': asNode(filter('trials', 'Trials')) } };
    const offered = Object.keys(offeredKinds({ ...NODE_KINDS, ...lib.kindsOf(library) }, 'ui-card:orders', library.nodes));
    assert.ok(offered.includes('source') && !offered.includes('condition'));
    assert.deepEqual(offered.filter((id) => id.includes(':')), ['preset-filter:trials']);
  } finally {
    off();
  }
  const loads = [...graph(fileURLToPath(new URL('browser/page-state.js', core))).modules].map((f) => f.split('/dist/')[1]);
  assert.ok(loads.includes('core/data/entity-types.js'));
  for (const heavy of ['core/data/node-kinds.js', 'core/data/workflow.js', 'core/data/node-library.js', 'core/data/entity-check.js']) assert.ok(!loads.includes(heavy), heavy);
});
