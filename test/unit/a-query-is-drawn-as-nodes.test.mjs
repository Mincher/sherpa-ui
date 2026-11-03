/**
 * A PAGE'S QUERY IS DRAWN AS NODES: Store, Source, each scope with its held
 * fields as rows, a Condition into each answered field, Arrange, Presentation
 * and the components — derived from the live Query, never kept; presets, saved
 * filters, status fields and superseded answers too. Each edit is the command a
 * chip asks, and Save writes the page definition. Will, TODO 555 · plan 695 N1.
 * TRAP T-the-node-editor-asks-the-query
 *
 *   node --test test/unit/a-query-is-drawn-as-nodes.test.mjs
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { schemaCheck } from '../../scripts/lib/schema-check.mjs';

const core = new URL('../../dist/core/data/', import.meta.url);
const { queryGraph, editedCondition, graphRequest, routeRequest } = await import(new URL('query-graph.js', core));
const { readingsOf, treeReading, whereOf } = await import(new URL('where.js', core));
const { ArrayStore } = await import(new URL('stores.js', core));
const { checkPage, openSource, pageWithQuery } = await import(new URL('page-definition.js', core));
const { editQuery, isPureEdit } = await import(new URL('query-edits.js', core));
const { statusFields } = await import(new URL('status-field.js', core));
const { onReport } = await import(new URL('report.js', core));

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
  assert.deepEqual(values('store'), { store: 'customers' });
  assert.deepEqual(values('source'), { pageSize: 25, search: 'name, email', applyOn: 'change' });
  // The filter Switch first, then each held field with a socket for its condition.
  assert.deepEqual(node('scope-view').rows.map((r) => [r.name, r.label, r.input, r.control, r.value]), [
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
  assert.deepEqual(editedCondition('in', 'EMEA, APAC'), { op: 'in', value: ['EMEA', 'APAC'] });
  assert.deepEqual(editedCondition('gt', '5', 'number'), { op: 'gt', value: 5 });
  assert.deepEqual(editedCondition('last', '12 months'), { op: 'last', value: { n: 12, unit: 'month' } });
  assert.deepEqual(editedCondition('eq', ' active '), { op: 'eq', value: 'active' });
  // The round trip a chip makes: rows → condition → reading → the plain form.
  for (const [op, text, said] of [['notin', 'EMEA, APAC', { notin: ['EMEA', 'APAC'] }], ['contains', 'north', { contains: 'north' }]]) {
    const reading = treeReading(editedCondition(op, text));
    assert.deepEqual(whereOf({ region: reading }).region, said);
  }
});

test('a picked value with a comma in it stays ONE value', () => {
  // The values a row picked are each whole; only a list typed as text splits at its commas.
  assert.deepEqual(editedCondition('in', ['Smith, John', 'Acme, Inc.']), { op: 'in', value: ['Smith, John', 'Acme, Inc.'] });
  assert.deepEqual(editedCondition('eq', ['Smith, John']), { op: 'eq', value: 'Smith, John' });
  assert.deepEqual(editedCondition('eq', 'Smith, John'), { op: 'eq', value: 'Smith, John' });
  assert.deepEqual(treeReading(editedCondition('in', ['Smith, John', 'Acme, Inc.'])), { picked: ['Smith, John', 'Acme, Inc.'] });
});

test('a field whose values are known is PICKED, as its chip picks: Is one of or Is not one of, ticks', () => {
  const values = (field) => (field === 'status' ? ['active', 'trial', 'churned'] : undefined);
  const picked = queryGraph({ v: 1, scopes: { view: { holds: ['status', 'name'], readings: readingsOf({ status: { eq: 'trial' }, name: { contains: 'north' } }) } } },
    definition, { values });
  const rows = (id) => Object.fromEntries(picked.nodes.find((n) => n.id === id).rows.map((r) => [r.name, [r.control, r.value]]));
  // Equals is Is one of with one tick: it reads back as that.
  assert.deepEqual(rows('when-view-status'), { field: ['field', 'status'], op: ['op', 'in'], value: ['values', ['trial']] });
  assert.deepEqual(picked.nodes.find((n) => n.id === 'when-view-status').rows[1].choices.map((c) => c.label), ['Is one of', 'Is not one of']);
  // A field with no known values is typed.
  assert.deepEqual(rows('when-view-name').value, ['text', 'north']);
  assert.deepEqual(editedCondition('in', ['trial', 'active']), { op: 'in', value: ['trial', 'active'] });
});


/* ── Presets, saved filters, status fields, superseded answers — plan 695 N1 ── */

const page = {
  v: 1, id: 'records',
  source: {
    store: 'customers', pageSize: 25,
    fields: { status: { label: 'Status' }, plan: { label: 'Plan' }, seats: { label: 'Seats', type: 'number' } },
    scopes: {
      view: { label: 'View', holds: ['status'], where: { status: { in: ['active'] } } },
      data: { label: 'Customers', holds: ['plan', 'seats'], presets: [{ id: 'big', label: 'Big accounts', where: { seats: { gt: 100 } } }] },
    },
  },
  savedFilters: { trials: { label: 'Trials', query: { v: 1, scopes: { view: { where: { status: { in: ['trial'] } } } } } } },
};
const rows = [
  { id: 1, status: 'active', plan: 'Pro', seats: 120 },
  { id: 2, status: 'trial', plan: 'Free', seats: 4 },
  { id: 3, status: 'active', plan: 'Free', seats: 8 },
];
/** A page opened as the provider opens it, and the facts its editor draws with. */
async function opened() {
  const source = await openSource(page.source, new ArrayStore(rows, { key: 'id' }));
  const facts = { presets: (s) => source.query.presets(s), values: (f) => source.valuesFor(f).map(String), type: (f) => page.source.fields[f]?.type };
  const draw = (more = {}) => queryGraph(source.query.draft, page, { ...facts, pageSize: source.state.pageSize, ...more });
  return { source, facts, draw };
}
const nodeIn = (g, id) => g.nodes.find((n) => n.id === id);
const valuesIn = (g, id) => Object.fromEntries(nodeIn(g, id).rows.map((r) => [r.name, r.value]));

test('a PRESET is a node into its scope\'s row: its on, from the Query, and what it writes', async () => {
  const { source, facts, draw } = await opened();
  const off = draw();
  assert.deepEqual(nodeIn(off, 'scope-data').rows.map((r) => r.name), ['#filters', '@big', 'plan', 'seats']);
  assert.deepEqual(valuesIn(off, 'preset-data-big'), { on: false, seats: 'greater than 100' });
  assert.deepEqual(nodeIn(off, 'preset-data-big').ref, { scope: 'data', preset: 'big' });
  assert.ok(off.routes.some((r) => r.from === 'preset-data-big' && r.to === 'scope-data/@big'));
  // Its on is the command a chip asks; drawn again, it is on, and its rows are its own, not a condition's.
  const preset = nodeIn(off, 'preset-data-big');
  source.query.ask(graphRequest({ node: preset, row: preset.rows[0], value: true }, facts));
  const on = draw();
  assert.equal(valuesIn(on, 'preset-data-big').on, true);
  assert.equal(nodeIn(on, 'when-data-seats'), undefined);
  // With no live declarations, the definition's presets draw the same node.
  assert.deepEqual(valuesIn(queryGraph(source.query.draft, page), 'preset-data-big'), valuesIn(on, 'preset-data-big'));
});

test('a SAVED FILTER is a node: on no bar it says what it would add, and no route; on a bar it is a preset', async () => {
  const { draw } = await opened();
  const g = draw();
  const saved = nodeIn(g, 'saved-trials');
  assert.equal(saved.kind, 'saved');
  assert.deepEqual(saved.rows.map((r) => [r.name, r.value, !!r.editable]), [['on', false, false], ['view:status', 'equals trial', false]]);
  assert.ok(!g.routes.some((r) => r.from === 'saved-trials' || r.to === 'saved-trials'));
  // Added to a bar, it is a preset `saved:<id>`: drawn as the saved kind, routed into its scope.
  const onBar = draw({ presets: (s) => (s === 'view' ? [{ id: 'saved:trials', label: 'Trials', readings: readingsOf({ status: { in: ['trial'] } }) }] : []) });
  assert.equal(nodeIn(onBar, 'saved-trials'), undefined);
  assert.equal(nodeIn(onBar, 'preset-view-saved:trials').kind, 'saved');
  assert.ok(onBar.routes.some((r) => r.to === 'scope-view/@saved:trials'));
});

test('a STATUS FIELD is a node between the store and the source: each value, and when a row has it', () => {
  const store = statusFields(new ArrayStore(rows, { key: 'id' }), {
    health: { type: 'status', label: 'Health', values: [{ value: 'at risk', status: 'critical', when: [{ seats: { lt: 10 } }] }, { value: 'healthy', status: 'success' }] },
  });
  const g = queryGraph({ v: 1, scopes: {} }, page, { domains: store.domains });
  assert.deepEqual(nodeIn(g, 'status-health').rows.map((r) => [r.label, r.value, !!r.editable]), [
    ['at risk', 'Seats less than 10', false], ['healthy', 'every row the values before it left', false],
  ]);
  assert.deepEqual(g.routes.slice(0, 2), [{ from: 'store', to: 'status-health' }, { from: 'status-health', to: 'source' }]);
  assert.ok(nodeIn(g, 'store').x < nodeIn(g, 'status-health').x && nodeIn(g, 'status-health').x < nodeIn(g, 'source').x);
});

test('a SUPERSEDED answer is drawn kept, not in force: read only, into its scope\'s row', () => {
  const g = queryGraph({ v: 1, scopes: {
    view: { holds: ['status'], readings: readingsOf({ status: { in: ['active'] } }) },
    data: { holds: ['status'], readings: {}, superseded: readingsOf({ status: { in: ['trial'] } }) },
  } }, page);
  const kept = nodeIn(g, 'kept-data-status');
  assert.equal(kept.description, 'Superseded: kept, not in force.');
  assert.ok(kept.rows.every((r) => !r.editable && /View holds/.test(r.hint)));
  assert.ok(g.routes.some((r) => r.from === 'kept-data-status' && r.to === 'scope-data/status'));
  // It moves nowhere: a route from it is refused.
  assert.ok('refused' in routeRequest(g, { from: 'kept-data-status', to: 'scope-view/status' }));
});

test('every edit is the command a chip asks — a value typed by its field, the Switch, a preset, Sort, a page size', async () => {
  const { facts, draw } = await opened();
  const g = draw();
  const ask = (id, name, value) => {
    const node = nodeIn(g, id);
    return graphRequest({ node, row: node.rows.find((r) => r.name === name), value }, facts);
  };
  assert.deepEqual(ask('scope-data', '#filters', false), { scope: 'data', suspended: true });
  assert.deepEqual(ask('preset-data-big', 'on', true), { scope: 'data', preset: 'big', on: true });
  assert.deepEqual(ask('source', 'pageSize', '50'), { pageSize: 50 });
  assert.equal(ask('source', 'pageSize', 'many'), undefined);
  assert.equal(ask('source', 'search', 'name'), undefined, 'the definition\'s: no command takes it');
  const seats = queryGraph({ v: 1, scopes: { data: { holds: ['seats'], readings: readingsOf({ seats: { gt: 5 } }) } } }, page);
  const when = nodeIn(seats, 'when-data-seats');
  const typed = graphRequest({ node: when, row: when.rows[2], value: '70' }, facts);
  assert.deepEqual(whereOf({ seats: typed.reading }, () => ({ type: 'number' })).seats, { gt: 70 }, 'a number field\'s 70 is 70');
});

test('SAVE round-trips a page definition: definition → graph → edit → definition, checked, and the edits are in it', async () => {
  const { source, facts, draw } = await opened();
  // The reader picks Is not one of on the View's Status, turns Big accounts on, and shows 50 rows.
  const g = draw({ components: [{ id: 'data', label: 'By plan', kind: 'bar' }] });
  for (const [id, name, value] of [['when-view-status', 'op', 'notin'], ['preset-data-big', 'on', true], ['source', 'pageSize', '50']]) {
    const node = nodeIn(g, id);
    source.query.ask(graphRequest({ node, row: node.rows.find((r) => r.name === name), value }, facts));
  }
  // A slot's presentation is a PURE edit: editQuery gives the Query after it, the one given untouched.
  const show = nodeIn(g, 'show-data');
  const shown = graphRequest({ node: show, row: show.rows.find((r) => r.name === 'primary'), value: 'plan' }, facts);
  assert.ok(isPureEdit(shown));
  const before = structuredClone(source.query.draft);
  const edited = editQuery(source.query.draft, shown);
  assert.deepEqual(source.query.draft, before);
  const saved = pageWithQuery(page, edited, { pageSize: source.state.pageSize });
  const heard = [];
  const undo = onReport((r) => heard.push(r.message));
  try {
    assert.equal(checkPage(saved), true, heard.join(' | '));
  } finally { undo(); }
  assert.deepEqual(schemaCheck('page.v1.json')(saved), []);
  assert.deepEqual(saved.source.scopes.view, { label: 'View', holds: ['status'], where: { status: { notin: ['active'] } } });
  // The preset's rows are its own: the definition keeps it declared, and writes none of them as a start.
  assert.deepEqual(saved.source.scopes.data, { ...page.source.scopes.data, presentation: { primary: 'plan' } });
  assert.equal(saved.source.pageSize, 50);
  assert.deepEqual(saved.savedFilters, page.savedFilters);
  assert.equal(page.source.pageSize, 25, 'the definition given is untouched');
  // Opened again, it draws the edit.
  const again = await openSource(saved.source, new ArrayStore(rows, { key: 'id' }));
  assert.deepEqual(valuesIn(queryGraph(again.query.draft, saved, { values: (f) => again.valuesFor(f).map(String) }), 'when-view-status').op, 'notin');
});
