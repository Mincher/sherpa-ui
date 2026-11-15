/**
 * A LENS SAYS WHAT A NODE IS — plan 1004c. A page's Query, through its lens, is a definition that says what each node
 * MEANS: its kind, values and own words, what it is to the Query (`ref`, T3), the rows a reader may change and each row's
 * words (T4), Off, its own icon and its warnings; its ids are QUERY_NODE's, in the order drawn (T7). One builder makes the definition and the drawing,
 * node by node. A reconcile reads the definition, never the drawing (T5), so the one drawing (1004d) may add what it
 * likes.
 *
 *   node --test test/unit/a-lens-says-what-a-node-is.test.mjs
 *
 * TRAP T-the-node-editor-asks-the-query
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

const core = new URL('../../dist/core/data/', import.meta.url);
const { queryLensGraph } = await import(new URL('query-graph.js', core));
const { queryDefinition, reconcileQuery } = await import(new URL('query-document.js', core));
const { queryDrawingFacts } = await import(new URL('query-lens.js', core));
const { workflowGraph } = await import(new URL('workflow.js', core));
const { readingsOf } = await import(new URL('where.js', core));

const page = {
  v: 1, id: 'records',
  source: { store: 'customers', pageSize: 25, search: ['name'], fields: { region: { label: 'Region' }, status: { label: 'Status' }, plan: { label: 'Plan' } } },
};
const region = readingsOf({ region: { in: ['EMEA', 'APAC'] } }).region;
const query = {
  v: 1,
  scopes: {
    // The View's Region filter is suspended: kept, not applied.
    view: { holds: ['region'], readings: { region: { ...region, suspended: true } } },
    // A card's own: an Or, its Pro part turned off.
    data: { holds: ['plan'], readings: readingsOf({ plan: { or: [{ eq: 'Pro', off: true }, { eq: 'Free' }] } }), sort: [{ field: 'plan', direction: 'asc' }] },
  },
};
const components = [{ id: 'grid', label: 'Customer records', scope: 'data' }, { id: 'trend', label: 'Over time', scope: 'view' }];
// A Filter on the View's bar, and a Source the reader placed that the page does not read.
const presets = (scope) => (scope === 'view' ? [{ id: 'filter:trials', label: 'Trials', readings: {} }] : []);
const lensed = queryLensGraph(query, page, { components, presets, kept: [{ id: 'source-2', store: 'devices' }] });
const meant = (id) => lensed.nodes.find((n) => n.id === id);

test('one builder makes both: each node the lens says is a node drawn, by its QUERY_NODE id, in order, at its place (T7)', () => {
  assert.deepEqual(lensed.nodes.map((n) => [n.id, n.kind, n.x, n.y]), lensed.drawn.nodes.map((n) => [n.id, n.kind, n.x, n.y]));
  assert.equal(lensed.connections, lensed.drawn.connections);
  for (const id of ['source', 'view-filters', 'when-view-region', 'field-view-region', 'presentation-data', 'organise-data', 'view']) assert.ok(meant(id), id);
});

test('what each node is to the Query, its own words, the rows a reader may change and each row\'s words are the definition\'s (T3, T4)', () => {
  for (const drawn of lensed.drawn.nodes) {
    const n = meant(drawn.id);
    assert.deepEqual(n.ref, drawn.ref, `${drawn.id}: its ref`);
    assert.deepEqual(n.editable, drawn.rows.filter((r) => r.editable).map((r) => r.name), `${drawn.id}: what a reader may change`);
    assert.deepEqual(n.hints ?? {}, Object.fromEntries(drawn.rows.filter((r) => r.hint).map((r) => [r.name, r.hint])), `${drawn.id}: its rows' words`);
  }
  // A chip is its Condition's to change; the page's store, its definition's; its page size, the reader's.
  assert.deepEqual([meant('view-filters').editable.includes('region'), meant('view-filters').hints.region], [false, 'Its Condition changes it.']);
  assert.deepEqual([meant('source').editable, meant('source').hints.store], [['pageSize'], 'The page definition sets it: Save writes the definition.']);
  // Its own words, never its kind's: a Field's is its field's label; the View Filters say what the bar holds.
  assert.deepEqual([meant('field-view-region').heading, meant('when-view-region').heading, meant('view-filters').heading], ['Region', 'Region', undefined]);
  assert.equal(meant('view-filters').description, '1 held');
  assert.deepEqual(meant('when-view-region').values, { type: 'in', b: ['EMEA', 'APAC'] });
  // A Filter's own icon; a kept Source's warning.
  assert.deepEqual([meant('preset-view-filter:trials').icon, meant('preset-view-filter:trials').heading], ['filter', 'Trials']);
  assert.deepEqual(meant('source-2').warnings, [{ words: 'The page reads customers. This Source is not the page\'s: the Query reads nothing from it.' }]);
  assert.deepEqual([lensed.nodes.filter((n) => n.icon).map((n) => n.id), lensed.nodes.filter((n) => n.warnings).map((n) => n.id)], [['preset-view-filter:trials'], ['source-2']]);
});

test('Off: a filter suspended, and a part turned off, each on its own node; the rest is in force (T4)', () => {
  assert.equal(meant('when-view-region').off, true, 'the View\'s Region, suspended');
  assert.equal(meant('when-data-plan.1').off, true, 'the card\'s Pro, turned off');
  assert.deepEqual([meant('when-data-plan').off, meant('when-data-plan.2').off, meant('field-view-region').off], [undefined, undefined, undefined]);
});

test('a reconcile refuses a row the lens keeps read only, in its words, whatever the drawing says (T5)', () => {
  const before = queryDefinition('records', lensed, {});
  const set = (def, id, row, value) => ({ ...def, nodes: def.nodes.map((n) => (n.id === id ? { ...n, values: { ...n.values, [row]: value } } : n)) });
  // A drawing that lets every row change, as one that adds its own rows might: the lens still says which may.
  const loose = { ...lensed.drawn, nodes: lensed.drawn.nodes.map((n) => ({ ...n, rows: n.rows.map((r) => ({ ...r, editable: true })) })) };
  const facts = { type: () => undefined, kept: [], place: { holds: () => [], fields: () => [], presets: () => [], on: () => false, kept: [] } };
  const chip = reconcileQuery(before, set(before, 'view-filters', 'region', 'Everywhere'), loose, facts);
  assert.deepEqual([chip.edits, chip.refused], [[], [{ code: 'query-row', message: 'No command takes "Region" on "View Filters": Its Condition changes it.' }]]);
  const size = reconcileQuery(before, set(before, 'source', 'pageSize', 50), loose, facts);
  assert.deepEqual([size.edits, size.refused], [[{ node: 'source', row: 'pageSize', value: 50 }], []]);
});

test('the rows of its kind a node leaves out are said: a kept Source\'s page rows, the Switch where the bar is not (1004 D3, D8)', () => {
  assert.deepEqual(meant('source-2').omit, ['pageSize', 'search', 'applyOn']);
  assert.equal(meant('source').omit, undefined, 'the page\'s Source has them');
  assert.deepEqual([meant('presentation-trend').omit, meant('presentation-data').omit], [['#filters'], undefined]);
});

test('what the one drawing reads beside the definition: the page\'s fields and a status field, so none warns falsely (1004 D2)', () => {
  const domains = { health: { values: ['Good', 'Poor'], when: { Good: { plan: { eq: 'Pro' } } } } };
  const facts = queryDrawingFacts(page, { query: { draft: query }, domains, stores: ['customers'] });
  assert.deepEqual(Object.keys(facts.fieldsOf.customers).sort(), ['health', 'plan', 'region', 'status']);
  assert.deepEqual(facts.fieldsOf.customers.health, { values: ['Good', 'Poor'] });
  const withStatus = queryLensGraph(query, page, { components, domains });
  const drawn = workflowGraph(queryDefinition('records', withStatus, {}), facts);
  assert.equal(drawn.nodes.find((n) => n.id === 'status-health')?.warnings, undefined);
});
