/**
 * A FILTER KEEPS ITS WHERE (plan 960 U4.4b, D6): a Filter keeps a Where where a Where says it all, else its graph. One
 * body, never both. Its lens draws its graph from its Where (`whereGraph`, as the Query graph draws a test), and writes a
 * graph back as a Where while the graph holds only what a Where says. A page's preset, a saved filter and a Filter are
 * one type: each is a Filter that keeps its Where (`filterOf`). Every read of an entity's graph is one door, `entityGraph`.
 *
 *   node --test test/unit/a-filter-keeps-its-where.test.mjs
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  NODE_KINDS, bodyOf, definitionDiff, editWorkflow, entityFaults, entityGraph, filterOf, isEntity, lensOf, libraryOf,
  presetOfEntity, saveGraph, saveGraphAs, whereGraph,
} from '../../dist/data.js';

const { PageKeeper, memoryTier } = await import(new URL('../../dist/core/browser/page-state.js', import.meta.url));

/** A Filter over customers that keeps its Where. */
const keeping = (where, id = 'f') => ({ v: 3, type: 'filter', id, label: 'F', query: { where }, settings: { source: 'customers' } });

const WHERES = [
  { status: { eq: 'active' } },
  { status: { ne: 'churned' } },
  { plan: { in: ['Pro', 'Enterprise'] } },
  { seats: { gt: 10 } },
  { name: { contains: 'Ac' } },
  { created: { last: 3, unit: 'month' } },
  { score: { between: [10, 20] } },
  { status: { or: [{ eq: 'active' }, { eq: 'trial' }] } },
  { openTickets: { gt: 2 }, status: { ne: 'churned' } },
];

test('a Where is drawn as a Filter\'s graph, a Source, a Field and a test each, and read back the same', () => {
  for (const where of WHERES) {
    const graph = whereGraph(where, { source: 'customers' });
    assert.ok(graph.nodes.every((n) => ['source', 'field', 'condition', 'time'].includes(n.kind)), JSON.stringify(where));
    assert.deepEqual(entityGraph(keeping(where)), graph, 'entityGraph draws its query body');
    const read = presetOfEntity({ v: 3, type: 'filter', id: 'f', label: 'F', graph, settings: { source: 'customers' } });
    assert.deepEqual(read.preset?.where, where, JSON.stringify(read));
  }
});

test('its lens draws it from its Where, and writes it back as a Where while one says it all', () => {
  const lens = lensOf('filter');
  const before = keeping({ status: { eq: 'active' } });
  const { workflow } = lens.toGraph(before);
  assert.deepEqual(lens.fromGraph(before, workflow), { definition: before });
  // An edit on the graph is the Where's.
  const test_ = workflow.nodes.find((n) => n.kind === 'condition');
  const edited = editWorkflow(workflow, { node: test_.id, row: 'b', value: 'trial' }, NODE_KINDS);
  const { definition } = lens.fromGraph(before, edited);
  assert.deepEqual(definition.query, { where: { status: { eq: 'trial' } } });
  assert.equal(definition.graph, undefined, 'one body, never both');
});

test('a graph a Where cannot say stays a graph: a constant from a Value node', () => {
  const lens = lensOf('filter');
  const before = keeping({ status: { eq: 'active' } });
  const { workflow } = lens.toGraph(before);
  const test_ = workflow.nodes.find((n) => n.kind === 'condition');
  const withValue = {
    ...workflow,
    nodes: [...workflow.nodes, { id: 'value', kind: 'value', x: 360, y: 300, type: 'text', values: { value: 'trial' } }],
    connections: [...workflow.connections, { from: 'value/value', to: `${test_.id}/b` }],
  };
  const { definition } = lens.fromGraph(before, withValue);
  assert.equal(definition.query, undefined);
  assert.ok(definition.graph.nodes.some((n) => n.kind === 'value'));
});

test('a page\'s preset, a saved filter and a Filter are one type: each a Filter that keeps its Where', () => {
  const where = { plan: { eq: 'Pro' } };
  const fromPreset = filterOf({ id: 'pro', label: 'Pro plans', where }, 'customers').filter;
  const fromSaved = filterOf({ id: 'pro', label: 'Pro plans', query: { v: 1, scopes: { data: { where } } } }, 'customers').filter;
  assert.deepEqual(fromPreset, fromSaved);
  assert.deepEqual(fromPreset, { v: 3, type: 'filter', id: 'pro', label: 'Pro plans', query: { where }, settings: { source: 'customers' } });
  // A Filter that keeps a graph is written back as the same Filter, once its graph says the Where.
  const { workflow } = lensOf('filter').toGraph(fromPreset);
  const drawn = { ...fromPreset, query: undefined, graph: entityGraph(fromPreset) };
  delete drawn.query;
  assert.deepEqual(lensOf('filter').fromGraph(drawn, workflow).definition, fromPreset);
  assert.deepEqual(presetOfEntity(fromPreset).preset, { id: 'filter:pro', label: 'Pro plans', where });
  // A saved filter in two scopes is no one Filter.
  const two = filterOf({ id: 'x', label: 'Two', query: { v: 1, scopes: { view: { where }, data: { where } } } }, 'customers');
  assert.match(two.fault, /more than one scope/);
});

test('one body, never both; a type that keeps no query is told so', () => {
  const where = { status: { eq: 'active' } };
  assert.equal(isEntity(keeping(where)), true);
  assert.equal(isEntity({ ...keeping(where), graph: { nodes: [] } }), false, 'both bodies');
  assert.equal(isEntity({ v: 3, type: 'filter', id: 'f', label: 'F' }), false, 'no body');
  assert.deepEqual(entityFaults(keeping(where)), []);
  const node = { v: 3, type: 'node', id: 'n', label: 'N', query: { where } };
  assert.ok(entityFaults(node).some((f) => /keeps a query, which a .* does not/.test(f)), entityFaults(node).join('; '));
});

test('the shelf keeps a Filter\'s Where as it is', async () => {
  const k = new PageKeeper({ tab: memoryTier(), local: memoryTier() });
  const filter = keeping({ seats: { gt: 10 } }, 'big');
  assert.equal(await k.entities.save(filter), true);
  const kept = k.entities.get('big');
  assert.deepEqual(kept.query, filter.query);
  assert.equal(kept.graph, undefined);
});

test('a save takes the body its lens wrote back, in place of the one it had: one body, never both', async () => {
  const k = new PageKeeper({ tab: memoryTier(), local: memoryTier() });
  const where = { seats: { gt: 10 } };
  const asGraph = { ...keeping(where, 'big'), query: undefined, graph: whereGraph(where, { source: 'customers' }) };
  delete asGraph.query;
  assert.equal(await k.entities.save(asGraph), true);
  // The lens writes it back as a Where: the save keeps that, and its graph goes.
  const { definition } = lensOf('filter').fromGraph(asGraph, lensOf('filter').toGraph(asGraph).workflow);
  assert.equal(await saveGraph(k.entities, 'big', bodyOf(definition)), true);
  assert.deepEqual(k.entities.get('big').query, { where });
  assert.equal(k.entities.get('big').graph, undefined);
  // Saved as a copy, the copy keeps the body given; the graph given back makes it a graph again, with no query.
  const copy = await saveGraphAs(k.entities, 'big', { graph: asGraph.graph }, { label: 'Big copy' });
  assert.deepEqual(k.entities.get(copy).graph, asGraph.graph);
  assert.equal(k.entities.get(copy).query, undefined);
});

test('a use\'s Update says what the Filter says now, field by field, not the nodes its drawing gave ids', () => {
  // Placed while it kept its own graph: a Field "status" and a test "trial".
  const graph = {
    nodes: [{ id: 'status', kind: 'field', x: 0, y: 0, values: { field: 'status' } }, { id: 'trial', kind: 'condition', x: 360, y: 0, values: { type: 'eq', b: 'trial' } }],
    connections: [{ from: 'status/field', to: 'trial' }, { from: 'trial/pass', to: '#out/where' }],
  };
  const before = { v: 3, type: 'filter', id: 'trials', label: 'Trials', graph, settings: { source: 'customers' } };
  const was = libraryOf([before]).nodes['filter:trials'];
  // Saved again as its Where, one value changed: its drawing's ids are new.
  const after = keeping({ status: { eq: 'suspended' } }, 'trials');
  const diff = definitionDiff({ kind: 'filter:trials', version: 'old', was }, libraryOf([{ ...after, label: 'Trials' }]));
  assert.deepEqual(diff.said, [{ key: 'status', value: 'equals trial to equals suspended' }]);
});

test('a reader\'s old saved sets move over as Filters, once: one per scope that holds an answer, each id free (Will, plan 960 U4.4c)', async () => {
  const { filtersOfSaved } = await import('../../dist/data.js');
  const sets = {
    trials: { label: 'Trials', query: { v: 1, scopes: { data: { where: { status: { in: ['trial'] } } } } } },
    both: { label: 'Big trials', query: { v: 1, scopes: { view: { where: { status: { in: ['trial'] } } }, data: { where: { seats: { gt: 100 } } }, empty: {} } } },
    none: { label: 'Nothing', query: { v: 1, scopes: { data: {} } } },
  };
  const made = filtersOfSaved(sets, 'customers', { view: { label: 'View' }, data: { label: 'Rows' } }, ['trials']);
  assert.deepEqual(made.map((f) => [f.id, f.label, f.type, f.settings.source, f.query.where]), [
    ['trials-2', 'Trials', 'filter', 'customers', { status: { in: ['trial'] } }],
    ['big-trials-view', 'Big trials · View', 'filter', 'customers', { status: { in: ['trial'] } }],
    ['big-trials-rows', 'Big trials · Rows', 'filter', 'customers', { seats: { gt: 100 } }],
  ]);
});
