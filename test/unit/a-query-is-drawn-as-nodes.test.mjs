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
const { queryGraph, editedCondition } = await import(new URL('query-graph.js', core));
const { readingsOf, whereOf } = await import(new URL('where.js', core));

const definition = {
  v: 1, id: 'records',
  source: {
    store: 'customers', pageSize: 25, search: ['name', 'email'],
    fields: { region: { label: 'Region' }, status: { label: 'Status' } },
    scopes: { view: { label: 'View Context' } },
  },
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
  // Two charts on the View: each its own Presentation, of its own kind.
  { id: 'r-donut', label: 'By plan', kind: 'donut', scope: 'view' },
  { id: 'r-line', label: 'Over time', scope: 'view' },
];
const graph = queryGraph(query, definition, { components });
const node = (id) => graph.nodes.find((n) => n.id === id);
const values = (id) => Object.fromEntries(node(id).rows.map((r) => [r.name, r.value]));

test('the Records page\'s Query: Store, Source, each scope, its conditions, Arrange, Presentation, each component', () => {
  assert.deepEqual(graph.nodes.map((n) => `${n.kind}:${n.id}`), [
    'store:store', 'source:source',
    'scope:scope-view', 'condition:when-view-region', 'presentation:show-r-donut', 'component:component-r-donut', 'component:component-r-line',
    'scope:scope-data', 'condition:when-data-status', 'arrange:arrange-data', 'component:component-grid',
    'scope:scope-r-bar', 'presentation:show-r-bar', 'component:component-r-bar',
  ]);
  assert.deepEqual(graph.routes.map((r) => `${r.from} → ${r.to}`), [
    'store → source', 'source → scope-view', 'when-view-region → scope-view/region',
    'scope-view → show-r-donut', 'show-r-donut → component-r-donut', 'scope-view → component-r-line',
    'scope-view → scope-data', 'when-data-status → scope-data/status', 'scope-data → arrange-data', 'arrange-data → component-grid',
    'scope-view → scope-r-bar', 'scope-r-bar → show-r-bar', 'show-r-bar → component-r-bar',
  ]);
});

test('each node shows what the Query and the definition say', () => {
  assert.equal(node('store').heading, 'customers');
  assert.deepEqual(values('source'), { pageSize: 25, search: 'name, email', applyOn: 'change' });
  // The filter Switch first, then each held field with a socket for its condition.
  assert.deepEqual(node('scope-view').rows.map((r) => [r.name, r.label, r.input, r.field, r.value]), [
    ['#filters', 'Filters', undefined, 'switch', true], ['region', 'Region', 'value', undefined, undefined], ['created', 'created', 'value', undefined, undefined],
  ]);
  // A scope's name is the definition's, else its one component's, else its id.
  assert.deepEqual([node('scope-view').heading, node('scope-data').heading, node('scope-r-bar').heading], ['View Context', 'Customer records', 'By status']);
  assert.equal(values('show-r-donut').kind, 'donut');
  assert.deepEqual(values('when-view-region'), { field: 'region', op: 'in', value: 'EMEA, APAC' });
  assert.deepEqual([node('when-view-region').heading, node('when-data-status').description], ['Region', 'Off: kept, not applied.']);
  assert.deepEqual(values('arrange-data'), { sort: 'name', direction: 'desc', group: 'plan', search: '' });
  assert.deepEqual([node('when-view-region').ref, node('arrange-data').ref, node('scope-data').ref], [{ scope: 'view', field: 'region' }, { scope: 'data' }, { scope: 'data' }]);
  // Its own slot: every row a key a select holds; '' is the definition's.
  assert.deepEqual(values('show-r-bar'), { kind: 'donut', primary: '', secondary: 'status', group: '', sort: '' });
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

test('what a reader may change: everything a door takes — read only only what nothing outside takes yet', () => {
  const editable = (id) => Object.fromEntries(node(id).rows.map((r) => [r.name, !!r.editable]));
  assert.deepEqual(editable('when-view-region'), { field: true, op: true, value: true });
  assert.deepEqual(editable('arrange-data'), { sort: true, direction: true, group: true, search: true });
  assert.deepEqual(editable('scope-view')['#filters'], true);
  // The page size changes live; the rest of the Source is the definition's, and says so.
  assert.deepEqual(editable('source'), { pageSize: true, search: false, applyOn: false });
  assert.match(node('source').rows[1].hint, /page definition/);
  // A slot's presentation changes; one on the View has no slot to keep it, and says so.
  assert.deepEqual(Object.values(editable('show-r-bar')), [true, true, true, true, true]);
  assert.deepEqual(Object.values(editable('show-r-donut')), [false, false, false, false, false]);
  assert.match(node('show-r-donut').rows[0].hint, /shares the View/);
  // A pick list's operators, by their words; a number field's are its type's.
  assert.deepEqual(node('when-view-region').rows[1].choices.map((c) => c.value), ['in', 'notin', 'eq', 'ne']);
  const typed = queryGraph({ v: 1, scopes: { view: { holds: ['seats'], readings: readingsOf({ seats: { gt: 5 } }) } } },
    { ...definition, source: { ...definition.source, fields: { seats: { type: 'number' } } } });
  assert.deepEqual(typed.nodes.find((n) => n.id === 'when-view-seats').rows[1].choices.map((c) => c.label),
    ['Equals', 'Does not equal', 'Greater than', 'At least', 'Less than', 'At most', 'Between', 'Not between']);
  assert.deepEqual(node('arrange-data').rows[1].choices, [{ value: 'asc', label: 'Ascending' }, { value: 'desc', label: 'Descending' }]);
  assert.equal(node('arrange-data').rows[0].choices[0].label, 'None');
});

test('an edited condition reads back as the condition its rows say', () => {
  assert.deepEqual(editedCondition('in', 'EMEA, APAC'), { in: ['EMEA', 'APAC'] });
  assert.deepEqual(editedCondition('gt', '5', 'number'), { gt: 5 });
  assert.deepEqual(editedCondition('last', '12 months'), { last: 12, unit: 'month' });
  assert.deepEqual(editedCondition('eq', ' active '), { eq: 'active' });
  // The round trip a chip makes: rows → condition → reading → the plain form.
  for (const [op, text] of [['notin', 'EMEA, APAC'], ['contains', 'north']]) {
    const reading = readingsOf({ region: editedCondition(op, text) }).region;
    assert.deepEqual(whereOf({ region: reading }).region, editedCondition(op, text));
  }
});

test('a field whose values are known is PICKED, as its chip picks: Is one of or Is not one of, ticks', () => {
  const values = (field) => (field === 'status' ? ['active', 'trial', 'churned'] : undefined);
  const picked = queryGraph({ v: 1, scopes: { view: { holds: ['status', 'name'], readings: readingsOf({ status: { eq: 'trial' }, name: { contains: 'north' } }) } } },
    definition, { values });
  const rows = (id) => Object.fromEntries(picked.nodes.find((n) => n.id === id).rows.map((r) => [r.name, [r.field, r.value]]));
  // Equals is Is one of with one tick: it reads back as that.
  assert.deepEqual(rows('when-view-status'), { field: ['key', 'status'], op: ['condition', 'in'], value: ['values', ['trial']] });
  assert.deepEqual(picked.nodes.find((n) => n.id === 'when-view-status').rows[1].choices.map((c) => c.label), ['Is one of', 'Is not one of']);
  // A field with no known values is typed.
  assert.deepEqual(rows('when-view-name').value, ['text', 'north']);
  assert.deepEqual(editedCondition('in', ['trial', 'active']), { in: ['trial', 'active'] });
});

