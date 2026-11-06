/**
 * A SOURCE IS WHERE ROWS COME FROM, in every graph (Will, TODO 808): one kind, the Store kind gone; every graph type's
 * panel offers it, several per graph. A page reads one store, so a second Source in its Query is the editor's: kept and
 * warned, never asked of the Query. And each kind's line in the panel is one short synopsis (TODO 809).
 * TRAP T-a-second-source-is-kept · TRAP T-one-node-registry
 *
 *   node --test test/unit/a-source-is-where-rows-come-from.test.mjs
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

const core = new URL('../../dist/core/data/', import.meta.url);
const { NODE_KINDS, paletteOf } = await import(new URL('node-kinds.js', core));
const { offeredKinds, registerEntityType } = await import(new URL('entity-types.js', core));
const { editWorkflow, workflowFaults, workflowGraph } = await import(new URL('workflow.js', core));
const { entityFaults } = await import(new URL('entity-check.js', core));
const { graphRequest, keptEdit, placeRequest, queryGraph, routeRequest } = await import(new URL('query-graph.js', core));
const { pageWithQuery } = await import(new URL('page-definition.js', core));

const inPanel = (palette) => palette.flatMap((g) => g.items.map((i) => `${g.category}:${i.id}`));

test('every graph type\'s panel offers a Source, under Sources: a workflow, a Preset Filter, a Custom Node, an app\'s type, the Query', () => {
  assert.equal(NODE_KINDS.store, undefined, 'the Store kind is gone');
  assert.deepEqual([NODE_KINDS.source.heading, NODE_KINDS.source.category, NODE_KINDS.source.graphs], ['Source', 'Sources', ['query', 'workflow']]);
  assert.deepEqual(NODE_KINDS.source.rows.map((r) => [r.name, r.control ?? null]), [['rows', null], ['store', 'store'], ['count', null]]);
  const off = registerEntityType({ id: 'workflow', label: 'Workflow', runs: true });
  try {
    for (const host of [undefined, 'preset-filter:trials', 'mine', 'workflow:flow']) {
      assert.ok(inPanel(paletteOf(offeredKinds(NODE_KINDS, host, {}))).includes('Sources:source'), `${host ?? 'a workflow of no entity'} offers Source`);
    }
  } finally {
    off();
  }
  // The Query's panel lists Sources first now, as a workflow's does.
  const query = paletteOf(NODE_KINDS, 'query');
  assert.deepEqual([query[0].category, query[0].items.map((i) => i.id)], ['Sources', ['source']]);
});

test('two Sources in one graph: customers and devices, each its own id and store, no fault', () => {
  const empty = { v: 2, id: 'both', nodes: [], routes: [] };
  const both = [['source-1', 'customers'], ['source-2', 'devices']].reduce(
    (w, [id, store], i) => editWorkflow(w, { add: { id, kind: 'source', x: 0, y: i * 200, values: { store } } }), empty,
  );
  const facts = { stores: ['customers', 'devices'] };
  assert.deepEqual(workflowFaults(both), []);
  const drawn = workflowGraph(both, facts).nodes;
  assert.deepEqual(drawn.map((n) => [n.id, n.heading, n.rows.find((r) => r.name === 'store').value]), [['source-1', 'Source', 'customers'], ['source-2', 'Source', 'devices']]);
  assert.deepEqual(drawn[1].rows.find((r) => r.name === 'store').choices.map((c) => c.value), ['customers', 'devices']);
  // As an entity of a type, too; only a second node of the SAME id is a fault.
  assert.deepEqual(entityFaults({ v: 1, type: 'node', id: 'both', label: 'Both', graph: { nodes: both.nodes, routes: [] }, settings: { inputs: [], outputs: [] } }), []);
  assert.ok(workflowFaults({ ...both, nodes: [...both.nodes, both.nodes[0]] }).includes('two nodes are "source-1"'));
});

const page = { v: 1, id: 'records', source: { store: 'customers', fields: { status: { label: 'Status' } } } };
const query = { v: 1, scopes: { view: { holds: ['status'], readings: {} } } };
const place = (kept = [], stores = ['customers', 'devices']) => placeRequest('source', 'view', {
  holds: () => ['status'], fields: () => ['status'], presets: () => [], on: () => false, store: 'customers', stores, kept,
});

test('a second Source in a Query is KEPT, never asked of it: the next free id, the first store the page does not read', () => {
  assert.deepEqual(place(), { keep: { id: 'source-2', store: 'devices' } });
  assert.deepEqual(place([{ id: 'source-2', store: 'devices' }]), { keep: { id: 'source-3', store: 'devices' } });
  // The app registered no other store: it names the page's own, and is still not the page's.
  assert.deepEqual(place([], ['customers']), { keep: { id: 'source-2', store: 'customers' } });
  assert.equal('request' in place(), false, 'it asks the Query nothing');
});

test('a kept Source is drawn under the page\'s and warns; its Store is the reader\'s; no route leaves it; Save writes the page\'s own', () => {
  const kept = [{ id: 'source-2', store: 'devices' }];
  const g = queryGraph(query, page, { stores: ['customers', 'devices'], kept });
  const [own, second] = ['source', 'source-2'].map((id) => g.nodes.find((n) => n.id === id));
  assert.deepEqual([second.kind, second.heading, second.ref, second.branches, second.x === own.x && second.y > own.y], ['source', 'Source', { kept: 'source-2' }, undefined, true]);
  assert.deepEqual(second.warnings, [{ words: 'The page reads customers. This Source is not the page\'s: the Query reads nothing from it.' }]);
  assert.equal(own.warnings, undefined, 'the page\'s own says nothing');
  const store = second.rows.find((r) => r.name === 'store');
  assert.deepEqual([store.value, store.editable, store.input, store.choices.map((c) => c.value)], ['devices', true, undefined, ['customers', 'devices']]);
  assert.equal(own.rows.find((r) => r.name === 'store').editable, undefined, 'the page\'s store is its definition\'s');
  // Its Store row's edit is the editor's; never a command for the Query.
  const edit = { node: second, row: store, value: 'customers' };
  assert.deepEqual(keptEdit(kept, edit), [{ id: 'source-2', store: 'customers' }]);
  assert.equal(graphRequest(edit), undefined);
  assert.equal(keptEdit(kept, { node: own, row: own.rows.find((r) => r.name === 'store'), value: 'devices' }), undefined);
  assert.equal(keptEdit(kept, { ...edit, row: second.rows[0] }), undefined, 'only its Store row');
  assert.match(routeRequest(g, { from: 'source-2/rows', to: 'scope-view/status' }).refused, /is not the page's Source: the Query reads nothing from it/);
  // Nothing routes into or out of it.
  assert.deepEqual(g.routes.filter((r) => r.from.startsWith('source-2') || r.to.startsWith('source-2')), []);
  // Save writes the page's definition: its store, and nothing of the kept Source.
  assert.deepEqual(pageWithQuery(page, query).source.store, 'customers');
  assert.ok(!JSON.stringify(pageWithQuery(page, query)).includes('devices'));
});

test('each kind\'s line is ONE short job in plain words: a few words, one line, no article first, never its types', () => {
  for (const [id, kind] of Object.entries(NODE_KINDS)) {
    if (kind.category) assert.ok(kind.description, `${id}: a panel kind has a synopsis`);
    if (!kind.description) continue;
    const words = kind.description.split(/\s+/).length;
    assert.ok(words <= 8 && kind.description.length <= 48 && !/\n/.test(kind.description), `${id}: "${kind.description}" is ${words} words`);
    // A job, said as one: no article first, no full stop (Will, TODO 833).
    assert.ok(!/^(a|an|the|one)\s/i.test(kind.description) && !kind.description.endsWith('.'), `${id}: "${kind.description}" reads as a job`);
    const types = Object.values(kind.types ?? {}).map((t) => t.label);
    assert.ok(types.filter((t) => kind.description.includes(t)).length < 2, `${id}: its line lists no types`);
  }
  // Will's own words (TODO 833).
  assert.deepEqual(Object.fromEntries(['source', 'field', 'value', 'condition', 'math'].map((id) => [id, NODE_KINDS[id].description])), {
    source: 'Connect a data source', field: 'Target a field from a connected Source', value: 'Primitive value variables',
    condition: 'Logical checks of a value against a condition', math: 'Numbers in, one number out',
  });
});
