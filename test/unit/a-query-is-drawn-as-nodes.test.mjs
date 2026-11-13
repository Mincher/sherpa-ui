/**
 * A PAGE'S QUERY IS DRAWN AS NODES: its Source; View Filters, the View's bar,
 * each held field a chip its filter's True joins; each card's Presentation, its
 * own filters' Pass and its Organise on its rows' path, its bar its rows; and the
 * View they go into (plan 960 U4.8) — derived from the live Query, never kept;
 * presets, saved filters, status fields and superseded answers too. Each edit is
 * the command a chip asks, and Save writes the page definition. Will, TODO 555 ·
 * plan 695 N1 · plan 713 M3. TRAP T-the-node-editor-asks-the-query
 *
 *   node --test test/unit/a-query-is-drawn-as-nodes.test.mjs
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { schemaCheck } from '../../scripts/lib/schema-check.mjs';

const core = new URL('../../dist/core/data/', import.meta.url);
const { queryGraph, editedCondition, graphRequest, connectionRequest, orderRequest } = await import(new URL('query-graph.js', core));
const { readingsOf, treeReading, whereOf } = await import(new URL('where.js', core));
const { ArrayStore } = await import(new URL('stores.js', core));
const { checkPage, openSource, pageWithQuery } = await import(new URL('page-definition.js', core));
const { editQuery, isPureEdit } = await import(new URL('query-edits.js', core));
const { statusFields } = await import(new URL('status-field.js', core));
const { onReport } = await import(new URL('report.js', core));
const { ROWS, accepts, socketOf, socketType } = await import(new URL('node-kinds.js', core));

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
/** A node's rows by name, but those that only send: Results, a test's Pass, Fail and True, a Content (plans 944, 971). */
const own = (n) => n.rows.filter((r) => !r.property);
const values = (id) => Object.fromEntries(own(node(id)).map((r) => [r.name, r.value]));
const row = (id, name) => node(id).rows.find((r) => r.name === name);

test('the Records page\'s Query: its Source, View Filters, each card\'s path and Presentation, and the View (plan 960 U4.8)', () => {
  assert.deepEqual(graph.nodes.map((n) => `${n.kind}:${n.id}`), [
    'source:source',
    'field:field-view-region', 'condition:when-view-region', 'view-filters:view-filters', 'presentation:presentation-r-donut', 'presentation:presentation-r-line',
    'field:field-data-status', 'condition:when-data-status', 'organise:organise-data', 'presentation:presentation-data',
    'organise:organise-r-bar', 'presentation:presentation-r-bar',
    'view:view',
  ]);
  // Every Field reads the page's rows; a View filter's True joins its chip; a card's own filter's Pass is on its rows' path,
  // then its Organise, then its Presentation; View Filters and each Content go into the View. No scope or component node.
  assert.deepEqual(graph.connections.map((r) => `${r.from} → ${r.to}`), [
    'source/rows → field-view-region', 'field-view-region/field → when-view-region', 'when-view-region/true → view-filters/region',
    'view-filters/filters → view/filters',
    'source/rows → presentation-r-donut', 'presentation-r-donut/content → view/content', 'source/rows → presentation-r-line', 'presentation-r-line/content → view/content',
    'source/rows → field-data-status', 'field-data-status/field → when-data-status', 'when-data-status/pass → organise-data', 'organise-data/rows → presentation-data', 'presentation-data/content → view/content',
    'source/rows → organise-r-bar', 'organise-r-bar/rows → presentation-r-bar', 'presentation-r-bar/content → view/content',
  ]);
});

test('the rows come in on a header, of any type, and leave by a row: Results, a test\'s Pass, a Content, the View Filters', () => {
  for (const n of graph.nodes) {
    assert.equal(n.output, undefined, `${n.id}: no header sends`);
    // The Source is where the rows come from, and the View where they end: nothing comes in on either header.
    if (n.kind === 'source' || n.kind === 'view') assert.deepEqual([n.input, n.branches], [undefined, undefined], n.id);
    else assert.equal(n.input, 'any', `${n.id}: its header takes any`);
    if (['source', 'organise'].includes(n.kind)) assert.equal(n.rows[0].name, ROWS.name, `${n.id}: its Rows row, first`);
  }
  // A test takes its Field's column on its header, and sends its Pass (the rows that hold) and its True, 1 or 0 (plan 971).
  const when = node('when-view-region');
  assert.deepEqual(['pass', 'fail', 'true'].map((r) => socketType(when, r, 'output')), ['object', 'object', 'value']);
  assert.deepEqual([node('field-view-region').input, socketType(node('field-view-region'), 'field', 'output')], ['any', 'object']);
  // A chip on View Filters takes what a True sends; a card's chip takes no line.
  assert.ok(accepts(socketType(when, 'true', 'output'), row('view-filters', 'region').input));
  assert.equal(row('presentation-data', 'status').input, undefined);
  // The View: View Filters, one, and Content, many; no rows of its own, nothing out.
  assert.deepEqual(node('view').rows.map((r) => [r.name, r.input, !!r.many, r.output]), [['filters', 'object', false, undefined], ['content', 'object', true, undefined]]);
});

test('each node shows what the Query and the definition say', () => {
  // One Source: its store, then how the page reads it (TODO 808).
  assert.equal(node('source').heading, 'Source');
  // No Count row now (plan 944).
  assert.deepEqual(values('source'), { store: 'customers', pageSize: 25, search: ['name', 'email'], applyOn: 'change' });
  // The Switch, then each held field, a chip saying its pick in words, then the output into the View.
  assert.deepEqual(node('view-filters').rows.map((r) => [r.name, r.label, r.input, r.control, r.value]), [
    ['#filters', 'Filters', 'boolean', 'switch', true], ['region', 'Region', 'any', undefined, 'equals(EMEA, APAC)'], ['created', 'created', 'any', undefined, undefined],
    ['filters', 'View Filters', undefined, undefined, undefined],
  ]);
  // A card's Presentation: its bar — the Switch and its chips, an off one said so — then how it shows its rows, then its Content.
  assert.deepEqual(node('presentation-data').rows.map((r) => [r.name, r.value]), [
    ['#filters', true], ['status', 'Off: equals(active)'], ['plan', undefined], ['kind', ''], ['sort', ''], ['content', undefined],
  ]);
  // A Content is named by its component; the View's by the kind.
  assert.deepEqual([node('view-filters').heading, node('presentation-data').heading, node('presentation-r-bar').heading, node('view').heading], ['View Filters', 'Customer records', 'By status', 'View']);
  assert.equal(values('presentation-r-donut').kind, 'donut');
  // Is one of with no values to pick from: its words are tags. Plan 749 P4
  assert.deepEqual(values('when-view-region'), { type: 'in', b: ['EMEA', 'APAC'] });
  assert.deepEqual(values('field-view-region'), { field: 'region' });
  assert.deepEqual([node('when-view-region').heading, node('field-view-region').heading, node('when-data-status').description], ['Region', 'Region', 'Off: kept, not applied.']);
  // Its sort, group and search, and its slot's axes (plan 960 U4.2: one Organise node).
  assert.deepEqual(values('organise-data'), { sort: 'name', direction: 'desc', group: 'plan', search: '', primary: '', secondary: '', segments: '' });
  const tree = JSON.stringify({ op: 'in', value: ['EMEA', 'APAC'] });
  assert.deepEqual([node('when-view-region').ref, node('field-view-region').ref, node('organise-data').ref, node('view-filters').ref, node('presentation-data').ref, node('view').ref], [
    { scope: 'view', field: 'region', path: '', tree }, { scope: 'view', field: 'region', tree }, { scope: 'data' }, { scope: 'view' }, { scope: 'data', component: 'grid' }, undefined,
  ]);
  // Its own slot: every row a key a select holds; '' is the definition's.
  // A card's chart: its kind and its segments' order on the Presentation; its axes on its Organise node (plan 960 U4.2).
  assert.deepEqual(values('presentation-r-bar'), { '#filters': true, kind: 'donut', sort: '' });
  assert.deepEqual(values('organise-r-bar'), { sort: '', direction: 'asc', group: '', search: '', primary: '', secondary: 'status', segments: '' });
});

test('every connection joins an output to an input that is there, and that accepts its type', () => {
  const type = (address, side) => {
    const { node: id, row: name } = socketOf(address);
    return node(id) && socketType(node(id), name, side);
  };
  for (const { from, to } of graph.connections) {
    assert.ok(type(from, 'output'), `${from} has no output`);
    assert.ok(type(to, 'input'), `${to} has no input`);
    assert.ok(accepts(type(from, 'output'), type(to, 'input')), `${from} → ${to}: ${type(from, 'output')} into ${type(to, 'input')}`);
  }
});

test('it reads left to right, and nothing in one column overlaps', () => {
  const x = (id) => node(id).x;
  assert.ok(x('source') < x('field-view-region') && x('field-view-region') < x('when-view-region') && x('when-view-region') < x('view-filters'));
  assert.ok(x('when-data-status') < x('organise-data') && x('organise-data') < x('presentation-data') && x('presentation-data') < x('view'));
  assert.equal(x('view-filters'), x('presentation-data'), 'View Filters stands with the Content');
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
  assert.equal(queryGraph(changed, definition, { components }).nodes.find((n) => n.id === 'when-view-region').rows[1].value, 'EMEA');
});

test('what a reader may change: everything a door takes — read only only what nothing outside takes yet', () => {
  const editable = (id) => Object.fromEntries(own(node(id)).map((r) => [r.name, !!r.editable]));
  assert.deepEqual([editable('when-view-region'), editable('field-view-region')], [{ type: true, b: true }, { field: true }]);
  assert.deepEqual(editable('organise-data'), { sort: true, direction: true, group: true, search: true, primary: true, secondary: true, segments: true });
  // A bar's Switch changes; its chips are their Conditions' to change.
  assert.deepEqual([editable('view-filters'), editable('presentation-data')], [
    { '#filters': true, region: false, created: false }, { '#filters': true, status: false, plan: false, kind: true, sort: true },
  ]);
  assert.match(row('view-filters', 'region').hint, /Its Condition changes it/);
  // The page size changes live; the rest of the Source is the definition's, and says so.
  assert.deepEqual(editable('source'), { store: false, pageSize: true, search: false, applyOn: false });
  assert.match(row('source', 'search').hint, /page definition/);
  assert.equal(row('source', 'rows').hint, undefined, 'its Rows row says nothing of the definition');
  // A slot's presentation changes; one on the View has no slot to keep it, and says so.
  assert.deepEqual(editable('presentation-r-bar'), { '#filters': true, kind: true, sort: true });
  assert.deepEqual(editable('presentation-r-donut'), { kind: false, sort: false });
  assert.match(row('presentation-r-donut', 'kind').hint, /shares the View/);
  // A pick list's operators, by their words; a number field's are its type's. The Field lists the fields the scope may hold.
  assert.deepEqual(node('when-view-region').rows[0].choices.map((c) => c.value), ['in', 'notin', 'eq', 'ne']);
  assert.deepEqual(node('field-view-region').rows[0].choices.map((c) => c.value), ['region', 'created']);
  const typed = queryGraph({ v: 1, scopes: { view: { holds: ['seats'], readings: readingsOf({ seats: { gt: 5 } }) } } },
    { ...definition, source: { ...definition.source, fields: { seats: { type: 'number' } } } });
  assert.deepEqual(typed.nodes.find((n) => n.id === 'when-view-seats').rows[0].choices.map((c) => c.label),
    ['Equals', 'Does not equal', 'Greater than', 'At least', 'Less than', 'At most', 'Between', 'Not between']);
  assert.deepEqual(row('organise-data', 'direction').choices, [{ value: 'asc', label: 'Ascending' }, { value: 'desc', label: 'Descending' }]);
  assert.equal(row('organise-data', 'sort').choices[0].label, 'None');
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
  const rows = (id) => Object.fromEntries(picked.nodes.find((n) => n.id === id).rows.filter((r) => !r.property).map((r) => [r.name, [r.control, r.value]]));
  // Equals is Is one of with one tick: it reads back as that.
  assert.deepEqual(rows('when-view-status'), { type: ['type', 'in'], b: ['values', ['trial']] });
  assert.deepEqual(picked.nodes.find((n) => n.id === 'when-view-status').rows[0].choices.map((c) => c.label), ['Is one of', 'Is not one of']);
  // A field with no known values is typed.
  assert.deepEqual(rows('when-view-name').b, ['text', 'north']);
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
const valuesIn = (g, id) => Object.fromEntries(own(nodeIn(g, id)).map((r) => [r.name, r.value]));

test('a PRESET is a node into its bar\'s row: its on, from the Query, and what it writes', async () => {
  const { source, facts, draw } = await opened();
  const off = draw();
  // A card with no component bound still has its Presentation: its bar is there, the Switch, its chips, then its presets.
  assert.deepEqual(nodeIn(off, 'presentation-data').rows.map((r) => r.name), ['#filters', 'plan', 'seats', '@big', 'kind', 'sort', 'content']);
  assert.deepEqual(valuesIn(off, 'preset-data-big'), { on: false, seats: undefined }, 'what it writes is a Condition node now, not a line of words');
  const wrote = nodeIn(off, 'when-preset-data-big-seats');
  assert.deepEqual([wrote.kind, wrote.rows.every((r) => !r.editable), wrote.ref.scope], ['condition', true, undefined], 'read only: the definition owns it');
  assert.ok(nodeIn(off, 'field-preset-data-big-seats').rows.every((r) => !r.editable), 'its Field too');
  assert.ok(off.connections.some((r) => r.from === 'when-preset-data-big-seats/true' && r.to === 'preset-data-big/seats'), 'from its True (plan 944)');
  assert.deepEqual(nodeIn(off, 'preset-data-big').ref, { scope: 'data', preset: 'big' });
  // Its True into its row: a boolean into a boolean.
  assert.ok(off.connections.some((r) => r.from === 'preset-data-big' && r.to === 'presentation-data/@big'));
  assert.deepEqual([nodeIn(off, 'preset-data-big').output, nodeIn(off, 'presentation-data').rows.find((r) => r.name === '@big').input], ['boolean', 'boolean']);
  // Its on is the command a chip asks; drawn again, it is on, and its rows are its own, not a condition's.
  const preset = nodeIn(off, 'preset-data-big');
  source.query.ask(graphRequest({ node: preset, row: preset.rows[0], value: true }, facts));
  const on = draw();
  assert.equal(valuesIn(on, 'preset-data-big').on, true);
  assert.equal(nodeIn(on, 'when-data-seats'), undefined);
  // With no live declarations, the definition's presets draw the same node.
  assert.deepEqual(valuesIn(queryGraph(source.query.draft, page), 'preset-data-big'), valuesIn(on, 'preset-data-big'));
});

test('a SAVED FILTER is a node: on no bar it says what it would add, and no connection; on a bar it is a preset', async () => {
  const { draw } = await opened();
  const g = draw();
  const saved = nodeIn(g, 'saved-trials');
  assert.equal(saved.kind, 'saved');
  assert.deepEqual(saved.rows.map((r) => [r.name, r.value, !!r.editable]), [['on', false, false], ['view:status', undefined, false]]);
  assert.ok(!g.connections.some((r) => r.from.startsWith('saved-trials/') || r.from === 'saved-trials' || r.to === 'saved-trials'), 'no connection out, none into the node itself');
  const wrote = nodeIn(g, 'when-saved-trials-view:status');
  assert.ok(wrote.kind === 'condition' && wrote.rows.every((r) => !r.editable), 'its condition is a Condition node, read only');
  assert.ok(g.connections.some((r) => r.from === 'field-saved-trials-view:status/field' && r.to === wrote.id), 'on its Field');
  assert.ok(g.connections.some((r) => r.from === `${wrote.id}/true` && r.to === 'saved-trials/view:status'), 'from its True (plan 944)');
  // Added to a bar, it is a preset `saved:<id>`: drawn as the saved kind, connected to its scope.
  const onBar = draw({ presets: (s) => (s === 'view' ? [{ id: 'saved:trials', label: 'Trials', readings: readingsOf({ status: { in: ['trial'] } }) }] : []) });
  assert.equal(nodeIn(onBar, 'saved-trials'), undefined);
  assert.equal(nodeIn(onBar, 'preset-view-saved:trials').kind, 'saved');
  assert.ok(onBar.connections.some((r) => r.to === 'view-filters/@saved:trials'));
});

test('a STATUS FIELD is a node between the Source and the cards: each value, and when a row has it', () => {
  const store = statusFields(new ArrayStore(rows, { key: 'id' }), {
    health: { type: 'status', label: 'Health', values: [{ value: 'at risk', status: 'critical', when: [{ seats: { lt: 10 } }] }, { value: 'healthy', status: 'success' }] },
  });
  const g = queryGraph({ v: 1, scopes: { view: { holds: [], readings: {} } } }, page, { domains: store.domains });
  assert.deepEqual(nodeIn(g, 'status-health').rows.map((r) => [r.label, r.value, !!r.editable]), [
    ['Results', undefined, false], ['at risk', 'critical', false], ['healthy', 'success', false],
  ]);
  // The Source's rows get their status, then reach each card: never the Source's straight. They are the first Branch's Data
  // too (plan 944).
  assert.deepEqual(g.connections.filter((r) => r.from === 'source/rows' || r.from === 'status-health/rows').map((r) => `${r.from} → ${r.to}`), [
    // The first value's Fields read them too, as every Query Field does.
    'source/rows → status-health', 'source/rows → field-status-health.at risk-seats', 'source/rows → branch-status-health.at risk/data',
    // Every Field reads them, a preset's and a saved filter's too.
    'status-health/rows → field-preset-data-big-seats', 'status-health/rows → presentation-data', 'status-health/rows → field-saved-trials-view:status',
  ]);
  assert.ok(nodeIn(g, 'source').x < nodeIn(g, 'status-health').x && nodeIn(g, 'status-health').x < nodeIn(g, 'presentation-data').x);
  // A Field reads the rows labelled.
  const held = queryGraph({ v: 1, scopes: { view: { holds: ['health'], readings: readingsOf({ health: { in: ['at risk'] } }) } } }, page, { domains: store.domains });
  assert.ok(held.connections.some((r) => r.from === 'status-health/rows' && r.to === 'field-view-health'));
});

test('a SUPERSEDED answer is drawn kept, not in force: read only, into its chip on the card\'s bar', () => {
  const g = queryGraph({ v: 1, scopes: {
    view: { holds: ['status'], readings: readingsOf({ status: { in: ['active'] } }) },
    data: { holds: ['status'], readings: {}, superseded: readingsOf({ status: { in: ['trial'] } }) },
  } }, page);
  const kept = nodeIn(g, 'kept-data-status');
  assert.equal(kept.description, 'Superseded: kept, not in force.');
  assert.ok([kept, nodeIn(g, 'field-kept-data-status-status')].every((n) => n.rows.filter((r) => !r.property).every((r) => !r.editable && /View holds/.test(r.hint))));
  // From its True (plan 944), into its chip: the one chip on a card that takes a line, as it is no filter on the path.
  assert.ok(g.connections.some((r) => r.from === 'kept-data-status/true' && r.to === 'presentation-data/status'));
  assert.deepEqual(nodeIn(g, 'presentation-data').rows.find((r) => r.name === 'status').input, 'any');
  // It moves nowhere: a connection from it is refused.
  assert.ok('refused' in connectionRequest(g, { from: 'kept-data-status/true', to: 'view-filters/status' }));
});

test('a field MOVES between scopes by its tree: a View filter onto a card\'s rows, a card\'s back into a chip of View Filters', () => {
  const moves = queryGraph({ v: 1, scopes: {
    view: { holds: ['status'], readings: readingsOf({ status: { in: ['active'] } }) },
    data: { holds: ['plan', 'seats'], readings: readingsOf({ plan: { in: ['Pro'] }, seats: { gt: 5 } }) },
  } }, page);
  const ask = (from, to) => connectionRequest(moves, { from, to });
  const moved = (r) => r.request.map(({ scope, field, reading }) => [scope, field, reading === null ? null : 'reading']);
  // A View filter's Pass (or its True) onto a card's rows' path: its Presentation, its Organise or its And. Same field, that card.
  for (const to of ['presentation-data', 'and-data']) assert.deepEqual(moved(ask('when-view-status/pass', to)), [['view', 'status', null], ['data', 'status', 'reading']], to);
  assert.deepEqual(moved(ask('when-view-status/true', 'presentation-data')), [['view', 'status', null], ['data', 'status', 'reading']]);
  // A card's filter back into a chip of View Filters: Send to View.
  assert.deepEqual(moved(ask('when-data-plan/pass', 'view-filters/status')), [['data', 'plan', null], ['view', 'status', 'reading']]);
  // Already there, nothing to do.
  assert.equal(ask('when-data-plan/pass', 'and-data'), null);
  // A card's chip takes no line; a row that is no True or Pass moves nothing; a View component's Content is no card's path.
  for (const [from, to] of [['when-view-status/true', 'presentation-data/plan'], ['when-view-status/fail', 'presentation-data'], ['when-view-status/#false', 'presentation-data'], ['when-view-status/pass', 'view-filters']]) {
    assert.match(ask(from, to).refused, /a filter's True goes into a chip of View Filters, its Pass onto a card's rows/, `${from} → ${to}`);
  }
});

test('a card\'s own filters, two or more, join in ONE And whose Pass goes on; one goes on alone', () => {
  const g = queryGraph({ v: 1, scopes: { data: { holds: ['plan', 'seats'], readings: readingsOf({ plan: { in: ['Pro'] }, seats: { gt: 5 } }) } } }, page);
  const and = nodeIn(g, 'and-data');
  assert.deepEqual([and.kind, and.rows.map((r) => [r.name, r.value, !!r.editable]), and.ref, and.description], [
    'condition', [['type', 'and', false], ['pass', undefined, false], ['fail', undefined, false], ['true', undefined, false]], { scope: 'data' }, 'All of 2 filters',
  ]);
  assert.deepEqual(g.connections.filter((r) => r.to === 'and-data' || r.from === 'and-data/pass').map((r) => `${r.from} → ${r.to}`), [
    'when-data-plan/pass → and-data', 'when-data-seats/pass → and-data', 'and-data/pass → presentation-data',
  ]);
  // Its Operation is no request: every filter of a card holds.
  assert.equal(graphRequest({ node: and, row: and.rows[0], value: 'or' }), undefined);
  const one = queryGraph({ v: 1, scopes: { data: { holds: ['plan'], readings: readingsOf({ plan: { in: ['Pro'] } }) } } }, page);
  assert.deepEqual([nodeIn(one, 'and-data'), one.connections.some((r) => r.from === 'when-data-plan/pass' && r.to === 'presentation-data')], [undefined, true]);
});

test('a bar\'s chips in another order are the Query\'s order; the drawn order asks nothing', () => {
  const g = queryGraph({ v: 1, scopes: { view: { holds: ['status', 'plan', 'seats'], readings: readingsOf({ status: { in: ['active'] }, seats: { gt: 5 } }) } } }, page);
  const bar = nodeIn(g, 'view-filters');
  assert.deepEqual(bar.rows.map((r) => r.name), ['#filters', 'status', 'plan', 'seats', 'filters']);
  assert.equal(orderRequest(bar, { '#filters': true, status: 'equals(active)', seats: 'greaterThan(5)' }), undefined);
  assert.deepEqual(orderRequest(bar, { seats: 'greaterThan(5)', '#filters': true, status: 'equals(active)' }), { scope: 'view', order: ['seats', 'status'] });
  // Asked, the picked chips change places; the one with no pick keeps its own.
  const holds = editQuery({ v: 1, scopes: { view: { holds: ['status', 'plan', 'seats'], readings: {} } } }, { scope: 'view', order: ['seats', 'status'] }).scopes.view.holds;
  assert.deepEqual(holds, ['seats', 'plan', 'status']);
  // A node with no bar has no order.
  assert.equal(orderRequest(nodeIn(g, 'when-view-status'), { b: 'x', type: 'in' }), undefined);
});

test('every edit is the command a chip asks — a value typed by its field, the Switch, a preset, Sort, a page size', async () => {
  const { facts, draw } = await opened();
  const g = draw();
  const ask = (id, name, value) => {
    const node = nodeIn(g, id);
    return graphRequest({ node, row: node.rows.find((r) => r.name === name), value }, facts);
  };
  assert.deepEqual(ask('presentation-data', '#filters', false), { scope: 'data', suspended: true });
  assert.deepEqual(ask('view-filters', '#filters', false), { scope: 'view', suspended: true });
  assert.equal(ask('presentation-data', 'plan', 'x'), undefined, 'a chip is its Condition\'s to change');
  assert.deepEqual(ask('preset-data-big', 'on', true), { scope: 'data', preset: 'big', on: true });
  assert.deepEqual(ask('source', 'pageSize', '50'), { pageSize: 50 });
  assert.equal(ask('source', 'pageSize', 'many'), undefined);
  assert.equal(ask('source', 'search', 'name'), undefined, 'the definition\'s: no command takes it');
  const seats = queryGraph({ v: 1, scopes: { data: { holds: ['seats'], readings: readingsOf({ seats: { gt: 5 } }) } } }, page);
  const when = nodeIn(seats, 'when-data-seats');
  const typed = graphRequest({ node: when, row: when.rows.find((r) => r.name === 'b'), value: '70' }, facts);
  assert.deepEqual(whereOf({ seats: typed.reading }, () => ({ type: 'number' })).seats, { gt: 70 }, 'a number field\'s 70 is 70');
});

test('SAVE round-trips a page definition: definition → graph → edit → definition, checked, and the edits are in it', async () => {
  const { source, facts, draw } = await opened();
  // The reader picks Is not one of on the View's Status, turns Big accounts on, and shows 50 rows.
  const g = draw({ components: [{ id: 'data', label: 'By plan', kind: 'bar' }] });
  for (const [id, name, value] of [['when-view-status', 'type', 'notin'], ['preset-data-big', 'on', true], ['source', 'pageSize', '50']]) {
    const node = nodeIn(g, id);
    source.query.ask(graphRequest({ node, row: node.rows.find((r) => r.name === name), value }, facts));
  }
  // A slot's presentation is a PURE edit: editQuery gives the Query after it, the one given untouched.
  const show = nodeIn(g, 'organise-data');
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
  assert.deepEqual(valuesIn(queryGraph(again.query.draft, saved, { values: (f) => again.valuesFor(f).map(String) }), 'when-view-status').type, 'notin');
});

test('a scope\'s arrangement is the page\'s too: it opens sorted, grouped and searched, and SAVE writes what the reader changed (plan 960 U4.3)', async () => {
  const people = [{ id: 1, name: 'Ann', plan: 'Pro' }, { id: 2, name: 'Bo', plan: 'Free' }, { id: 3, name: 'Cy', plan: 'Pro' }];
  const def = {
    v: 1, id: 'people',
    source: {
      store: 'people', fields: { name: { label: 'Name' }, plan: { label: 'Plan' } },
      scopes: { list: { label: 'List', arranges: true, sort: [{ field: 'name', direction: 'desc' }], group: 'plan', search: 'n' } },
    },
  };
  assert.deepEqual(schemaCheck('page.v1.json')(def), []);
  const source = await openSource(def.source, new ArrayStore(people, { key: 'id' }));
  const list = source.query.draft.scopes.list;
  assert.deepEqual([list.sort, list.group, list.search], [[{ field: 'name', direction: 'desc' }], 'plan', 'n']);
  // Drawn on its Organise node; Save writes it back as it is.
  const g = queryGraph(source.query.draft, def, {});
  assert.deepEqual(Object.fromEntries(nodeIn(g, 'organise-list').rows.filter((r) => ['sort', 'direction', 'group', 'search'].includes(r.name)).map((r) => [r.name, r.value])), { sort: 'name', direction: 'desc', group: 'plan', search: 'n' });
  assert.deepEqual(pageWithQuery(def, source.query.draft).source.scopes.list, def.source.scopes.list);
  // The reader sorts by Plan and clears the search, on the node: Save writes that.
  const organise = nodeIn(g, 'organise-list');
  source.query.ask(graphRequest({ node: organise, row: organise.rows.find((r) => r.name === 'sort'), value: 'plan' }, {}));
  source.query.ask(graphRequest({ node: organise, row: organise.rows.find((r) => r.name === 'search'), value: '' }, {}));
  const saved = pageWithQuery(def, source.query.draft);
  assert.deepEqual(saved.source.scopes.list, { label: 'List', arranges: true, sort: [{ field: 'plan', direction: 'desc' }], group: 'plan' });
  assert.equal(checkPage(saved), true);
  assert.deepEqual(schemaCheck('page.v1.json')(saved), []);
});

test('every value ticked is in force, and drawn as its own test, said as its chip says it (TODO 965)', async () => {
  const { openSource, pageWithQuery } = await import(new URL('page-definition.js', core));
  const { ALL } = await import(new URL('filter-face.js', core));
  const page = { v: 1, id: 'p', source: { store: 's', fields: { status: { values: ['a', 'b'] } }, scopes: { data: { label: 'Data', holds: ['status'] } } } };
  const source = await openSource(page.source, new ArrayStore([{ id: 1, status: 'a' }, { id: 2, status: null }], { key: 'id' }));
  await source.load();
  source.query.ask({ scope: 'data', field: 'status', reading: { all: true } });
  await source.load();
  assert.equal(source.total, 1, 'a row with no value drops');
  const graph = queryGraph(source.query.draft, page);
  const test_ = graph.nodes.find((n) => n.id === 'when-data-status');
  const op = test_.rows.find((r) => r.name === 'type');
  assert.deepEqual([op.value, op.choices.map((c) => c.label), op.editable], ['all', [ALL], false]);
  assert.ok(graph.connections.some((c) => c.from === 'when-data-status/pass' && c.to === 'presentation-data'), 'its Pass is on the card\'s rows');
  assert.equal(graph.nodes.find((n) => n.id === 'presentation-data').rows.find((r) => r.name === 'status').value, ALL, 'its chip says it');
  assert.deepEqual(pageWithQuery(page, source.query.draft).source.scopes.data.where, { status: { all: true } });
  source.close();
});
