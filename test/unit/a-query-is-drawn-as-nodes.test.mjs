/**
 * A PAGE'S QUERY IS DRAWN AS NODES: Store, Source, each scope with its held
 * fields as rows, a Condition into each answered field, Arrange, Presentation
 * and the components — derived from the live Query, never kept. Will, TODO 555.
 * TRAP T-the-node-editor-asks-the-query
 *
 *   node --test test/unit/a-query-is-drawn-as-nodes.test.mjs
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

const core = new URL('../../dist/core/data/', import.meta.url);
const { queryGraph } = await import(new URL('query-graph.js', core));
const { readingsOf } = await import(new URL('where.js', core));

const definition = {
  v: 1, id: 'records',
  source: { store: 'customers', pageSize: 25, search: ['name', 'email'], fields: { region: { label: 'Region' }, status: { label: 'Status' } } },
};
const query = {
  v: 1,
  scopes: {
    view: { holds: ['region', 'created'], readings: readingsOf({ region: { in: ['EMEA', 'APAC'] } }) },
    data: {
      holds: ['status', 'plan'], readings: readingsOf({ status: { eq: 'active', off: true } }),
      sort: [{ field: 'name', direction: 'desc' }], group: 'plan',
    },
    'r-bar': { holds: [], readings: {}, presentation: { kind: 'donut', secondary: 'status' } },
  },
};
const components = [
  { id: 'grid', label: 'Customer records', scope: 'data' },
  { id: 'r-bar', label: 'By status', kind: 'bar' },
];
const graph = queryGraph(query, definition, { components });
const node = (id) => graph.nodes.find((n) => n.id === id);
const values = (id) => Object.fromEntries(node(id).rows.map((r) => [r.name, r.value]));

test('the Records page\'s Query: Store, Source, each scope, its conditions, Arrange, Presentation, each component', () => {
  assert.deepEqual(graph.nodes.map((n) => `${n.kind}:${n.id}`), [
    'store:store', 'source:source',
    'scope:scope-view', 'condition:when-view-region',
    'scope:scope-data', 'condition:when-data-status', 'arrange:arrange-data', 'component:component-grid',
    'scope:scope-r-bar', 'presentation:show-r-bar', 'component:component-r-bar',
  ]);
  assert.deepEqual(graph.routes.map((r) => `${r.from} → ${r.to}`), [
    'store → source', 'source → scope-view', 'when-view-region → scope-view/region',
    'scope-view → scope-data', 'when-data-status → scope-data/status', 'scope-data → arrange-data', 'arrange-data → component-grid',
    'scope-view → scope-r-bar', 'scope-r-bar → show-r-bar', 'show-r-bar → component-r-bar',
  ]);
});

test('each node shows what the Query and the definition say', () => {
  assert.equal(node('store').heading, 'customers');
  assert.deepEqual(values('source'), { pageSize: 25, search: 'name, email', applyOn: 'change' });
  assert.deepEqual(node('scope-view').rows.map((r) => [r.name, r.label, r.input]), [['region', 'Region', 'value'], ['created', 'created', 'value']]);
  assert.deepEqual([node('scope-data').heading, node('scope-r-bar').heading], ['data', 'By status']);
  assert.deepEqual(values('when-view-region'), { field: 'region', op: 'in', value: 'EMEA, APAC' });
  assert.deepEqual([node('when-view-region').heading, node('when-data-status').description], ['Region', 'Off: kept, not applied.']);
  assert.deepEqual(values('arrange-data'), { sort: 'name', direction: 'desc', group: 'plan', search: undefined });
  assert.deepEqual(values('show-r-bar'), { kind: 'donut', primary: undefined, secondary: 'status', group: undefined, sort: undefined });
  assert.equal(node('component-grid').heading, 'Customer records');
});

test('every route joins an output to an input that is there', () => {
  const has = (address, side) => {
    const [id, row] = address.split('/');
    const n = node(id);
    return !!n && (row === undefined ? !!n[side] : !!n.rows.find((r) => r.name === row)?.[side]);
  };
  for (const { from, to } of graph.routes) {
    assert.ok(has(from, 'output'), `${from} has no output`);
    assert.ok(has(to, 'input'), `${to} has no input`);
  }
});

test('it reads left to right, and nothing in one column overlaps', () => {
  const x = (id) => node(id).x;
  assert.ok(x('store') < x('source') && x('source') < x('when-view-region') && x('when-view-region') < x('scope-view'));
  assert.ok(x('scope-view') < x('scope-data') && x('scope-data') < x('arrange-data') && x('arrange-data') < x('component-grid'));
  const columns = Object.groupBy(graph.nodes, (n) => n.x);
  for (const column of Object.values(columns)) {
    const ys = column.map((n) => n.y);
    assert.deepEqual(ys, [...ys].sort((a, b) => a - b));
    assert.equal(new Set(ys).size, ys.length);
  }
});

test('the graph is DERIVED: the same Query draws the same graph, and a changed one a changed graph', () => {
  assert.deepEqual(queryGraph(query, definition, { components }), graph);
  const changed = structuredClone(query);
  changed.scopes.view.readings = readingsOf({ region: { in: ['EMEA'] } });
  assert.equal(queryGraph(changed, definition, { components }).nodes.find((n) => n.id === 'when-view-region').rows[2].value, 'EMEA');
});
