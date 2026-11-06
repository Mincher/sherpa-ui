/**
 * A PRESET FILTER IS A PRESET OF ITS STORE — Will, TODO 776 (plan 776). A Preset Filter entity's graph
 * is read as ONE condition by the reader the Outgoing JSON shows (`conditionAt`), each comparison as the
 * Query editor reads an edited one, then each field's own in the plain form: the shape a page's preset
 * has, declared through the same door. So the readings it writes are the ones the Query editor reads
 * back; one placed inside another flattens; "Any" of two fields is said in words; a page lists only its
 * store's; and a press is `query.ask({ preset })`, giving the rows the Status chip's Active gives.
 *
 *   node --test test/unit/a-preset-filter-is-a-preset-of-its-store.test.mjs
 *
 * TRAP T-a-preset-filter-is-a-preset-of-its-store
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { ArrayStore, bindSource, openSource } from '../../dist/data.js';

const data = new URL('../../dist/core/data/', import.meta.url);
const { presetOfEntity, presetsOver, sourceOf } = await import(new URL('preset-filter.js', data));
const { presetReadings } = await import(new URL('page-definition.js', data));
const { queryGraph, graphRequest, placeRequest } = await import(new URL('query-graph.js', data));
const { sameAnswer } = await import(new URL('query.js', data));
const { conditionAt, nodeFlow } = await import(new URL('node-flow.js', data));
const { workflowGraph, workflowFaults } = await import(new URL('workflow.js', data));
const { whereOfTree } = await import(new URL('where.js', data));
const { NODE_KINDS } = await import(new URL('node-kinds.js', data));
const { kindsOf, innerOf } = await import(new URL('node-library.js', data));
const { libraryOf } = await import(new URL('entity-types.js', data));

const ROWS = [
  { id: 1, status: 'active', plan: 'Pro', seats: 10 },
  { id: 2, status: 'active', plan: 'Free', seats: 2 },
  { id: 3, status: 'trial', plan: 'Pro', seats: 8 },
  { id: 4, status: 'churned', plan: 'Pro', seats: 1 },
  { id: 5, status: 'active', plan: 'Pro', seats: 3 },
];
const FIELDS = { status: { label: 'Status' }, plan: { label: 'Plan' }, seats: { label: 'Seats', type: 'number' } };

/** A Field node on one field. */
const fieldNode = (id, field, x = 200, y = 0) => ({ id, kind: 'field', x, y, values: { field } });
/** A Condition of one operator, its Value B given. */
const test_ = (id, type, b, x = 400, y = 0) => ({ id, kind: 'condition', x, y, values: { type, ...(b === undefined ? {} : { b }) } });
/** Demos' own, rebuilt (plan 783 D9): Source › Field (Status) › Condition (Equals active) › Where. */
const active = {
  v: 1, type: 'preset-filter', id: 'active-customers', label: 'Active customers', settings: { source: 'customers' },
  graph: {
    nodes: [{ id: 'start', kind: 'source', x: 0, y: 0, values: { store: 'customers' } }, fieldNode('field', 'status'), test_('status', 'eq', 'active')],
    routes: [{ from: 'start/rows', to: 'field' }, { from: 'field/field', to: 'status' }, { from: 'status', to: '#out/where' }],
  },
};
/** A Preset Filter whose nodes and routes are given, over customers. */
const filter = (id, nodes, routes, extra = {}) => ({ v: 1, type: 'preset-filter', id, label: id, settings: { source: 'customers' }, graph: { nodes, routes }, ...extra });
/** Pro, And Active customers placed beside it. */
const proActive = filter('pro-active', [
  { id: 'use', kind: 'preset-filter:active-customers', x: 0, y: 240 }, fieldNode('plan', 'plan'), test_('pro', 'eq', 'Pro'), test_('and', 'and', undefined, 600),
], [{ from: 'plan/field', to: 'pro' }, { from: 'pro', to: 'and' }, { from: 'use', to: 'and' }, { from: 'and', to: '#out/where' }]);

async function page() {
  const source = await openSource({ store: 'customers', fields: FIELDS, scopes: { data: { label: 'Rows', holds: ['status', 'plan'] } } }, new ArrayStore(ROWS, { key: 'id' }));
  bindSource(source, { populate() {}, setAttribute() {}, removeAttribute() {}, addEventListener() {}, removeEventListener() {} }, { scope: 'data' });
  await source.load();
  return source;
}
const total = (source) => source.debugState().total;

test('its graph is read as the condition its Where says, the shape a page\'s own preset has, its id its use\'s kind', () => {
  assert.deepEqual(presetOfEntity(active), { preset: { id: 'preset-filter:active-customers', label: 'Active customers', where: { status: { eq: 'active' } } } });
  // A Value routed into Value B is read as the canvas draws it: mirrored. So is one routed into the Field's row.
  const routed = filter('routed', [
    { id: 'val', kind: 'value', x: 0, y: 200, values: { value: 'trial' } }, fieldNode('f', 'status'), test_('c', 'eq'),
  ], [{ from: 'f/field', to: 'c' }, { from: 'val/value', to: 'c/b' }, { from: 'c', to: '#out/where' }]);
  assert.deepEqual(presetOfEntity(routed).preset.where, { status: { eq: 'trial' } });
  const named = filter('named', [{ id: 'name', kind: 'value', x: 0, y: 200, values: { value: 'plan' } }, fieldNode('f', 'status'), test_('c', 'eq', 'Pro')],
    [{ from: 'name/value', to: 'f/field' }, { from: 'f/field', to: 'c' }, { from: 'c', to: '#out/where' }]);
  assert.deepEqual(presetOfEntity(named).preset.where, { plan: { eq: 'Pro' } });
  // And over two fields is two readings: a scope ANDs its readings. Text as a row holds it is read as the Query reads it.
  const list = filter('list', [fieldNode('fs', 'status'), fieldNode('fn', 'seats'), test_('in', 'in', ['active', 'trial']), test_('gt', 'gt', '5'), test_('and', 'and', undefined, 600)],
    [{ from: 'fs/field', to: 'in' }, { from: 'fn/field', to: 'gt' }, { from: 'in', to: 'and' }, { from: 'gt', to: 'and' }, { from: 'and', to: '#out/where' }]);
  assert.deepEqual(presetOfEntity(list).preset.where, { status: { in: ['active', 'trial'] }, seats: { gt: '5' } });
});

test('A or (B and C) on Seats is ONE reading: one Field into three Conditions, an And and an Or', () => {
  const seats = filter('seats', [
    fieldNode('f', 'seats'), test_('a', 'lt', 5), test_('b', 'gt', 5, 400, 200), test_('c', 'lt', 100, 400, 400), test_('and', 'and', undefined, 600, 300), test_('or', 'or', undefined, 800),
  ], [
    { from: 'f/field', to: 'a' }, { from: 'f/field', to: 'b' }, { from: 'f/field', to: 'c' }, { from: 'b', to: 'and' }, { from: 'c', to: 'and' },
    { from: 'a', to: 'or' }, { from: 'and', to: 'or' }, { from: 'or', to: '#out/where' },
  ]);
  const { where } = presetOfEntity(seats).preset;
  assert.deepEqual(Object.keys(where), ['seats']);
  assert.deepEqual(where, whereOfTree({ or: [{ field: 'seats', op: 'lt', value: 5 }, { and: [{ field: 'seats', op: 'gt', value: 5 }, { field: 'seats', op: 'lt', value: 100 }] }] }).where);
  // The rows a test lets through carry it: Source › Field › Active › Rows › Field › Pro is Active and Pro.
  const chain = filter('chain', [
    { id: 'start', kind: 'source', x: 0, y: 0, values: { store: 'customers' } }, fieldNode('fs', 'status'), test_('act', 'eq', 'active'), fieldNode('fp', 'plan', 600), test_('pro', 'eq', 'Pro', 800),
  ], [{ from: 'start/rows', to: 'fs' }, { from: 'fs/field', to: 'act' }, { from: 'act/rows', to: 'fp' }, { from: 'fp/field', to: 'pro' }, { from: 'pro', to: '#out/where' }]);
  assert.deepEqual(presetOfEntity(chain).preset.where, { status: { eq: 'active' }, plan: { eq: 'Pro' } });
  // Time and a Tag are leaves too, each on the Field on its header.
  const dated = filter('dated', [fieldNode('f', 'joined'), { id: 't', kind: 'time', x: 400, y: 0, values: { type: 'duration', when: 'last', n: 7, unit: 'day' } }], [{ from: 'f/field', to: 't' }, { from: 't', to: '#out/where' }]);
  assert.deepEqual(presetOfEntity(dated).preset.where, { joined: { last: 7 } }, 'the plain form: a day is the default unit');
  const weeks = { ...dated, graph: { ...dated.graph, nodes: [dated.graph.nodes[0], { ...dated.graph.nodes[1], values: { type: 'duration', when: 'next', n: 2, unit: 'week' } }] } };
  assert.deepEqual(presetOfEntity(weeks).preset.where, { joined: { next: 2, unit: 'week' } });
  const between = { ...dated, graph: { ...dated.graph, nodes: [dated.graph.nodes[0], { ...dated.graph.nodes[1], values: { type: 'between', start: '2024-01-01', end: '2024-01-31' } }] } };
  assert.deepEqual(presetOfEntity(between).preset.where, { joined: { between: ['2024-01-01', '2024-01-31'] } });
  const tagged = filter('tagged', [fieldNode('f', 'plan'), { id: 'g', kind: 'tag', x: 400, y: 0, values: { value: ['Pro', 'Team'] } }], [{ from: 'f/field', to: 'g' }, { from: 'g', to: '#out/where' }]);
  assert.deepEqual(presetOfEntity(tagged).preset.where, { plan: { in: ['Pro', 'Team'] } });
});

test('its readings are the ones the Query editor reads back for the same condition', async () => {
  const source = await page();
  const { where } = presetOfEntity(active).preset;
  const compiled = presetReadings(source, where);
  // The Query editor draws the same answer as a reader's own, and an edit that changes nothing reads it back.
  source.query.ask({ scope: 'data', field: 'status', reading: compiled.status, commit: true });
  const definition = { v: 1, id: 'records', source: { store: 'customers', fields: FIELDS } };
  const graph = queryGraph(source.query.draft, definition, { values: (f) => [...new Set(ROWS.map((r) => String(r[f])))] });
  const node = graph.nodes.find((n) => n.id === 'when-data-status');
  const row = node.rows.find((r) => r.name === 'b');
  const back = graphRequest({ node, row, value: row.value });
  assert.equal(back.field, 'status');
  assert.ok(sameAnswer(back.reading, compiled.status), JSON.stringify([back.reading, compiled.status]));
});

test('one placed inside another flattens: its use\'s True into And; the Outgoing JSON says the two joined', () => {
  assert.deepEqual(presetOfEntity(proActive, { entities: [active] }).preset.where, { plan: { eq: 'Pro' }, status: { eq: 'active' } });
  const both = filter('both', [
    { id: 'use', kind: 'preset-filter:pro-active', x: 0, y: 240 }, fieldNode('f', 'seats'), test_('big', 'gte', 5), test_('and', 'and', undefined, 600),
  ], [{ from: 'f/field', to: 'big' }, { from: 'use', to: 'and' }, { from: 'big', to: 'and' }, { from: 'and', to: '#out/where' }]);
  // Two deep: pro-active holds active-customers, and each is read inside.
  assert.deepEqual(presetOfEntity(both, { entities: [active, proActive] }).preset.where, { plan: { eq: 'Pro' }, status: { eq: 'active' }, seats: { gte: 5 } });
  // The canvas's Outgoing JSON reads the same: the And says Pro and the use's own.
  const library = libraryOf([active, proActive]);
  const kinds = { ...kindsOf(library), ...NODE_KINDS };
  const routes = proActive.graph.routes.filter((r) => !r.to.startsWith('#'));
  const drawn = workflowGraph({ v: 2, id: 'x', nodes: proActive.graph.nodes, routes }, {}, kinds);
  const inner = (node) => { const use = innerOf(node, library, kinds); return use && workflowGraph(use.workflow, {}, use.kinds); };
  assert.deepEqual(nodeFlow(drawn, 'and', { inner }).definition, { where: { and: [{ field: 'plan', op: 'eq', value: 'Pro' }, { field: 'status', op: 'eq', value: 'active' }] } });
  assert.deepEqual(nodeFlow(drawn, 'use', { inner }).definition, { where: { field: 'status', op: 'eq', value: 'active' } });
  // Without the inside, the use's True is a boolean only a run gives (TODO 780), named by where it comes from.
  assert.deepEqual(nodeFlow(drawn, 'and').definition, { where: { and: [{ field: 'plan', op: 'eq', value: 'Pro' }, { boolean: 'Active customers › True' }] } });
  assert.deepEqual(workflowFaults({ v: 2, id: 'x', nodes: proActive.graph.nodes, routes }, kinds), []);
  // And takes any boolean (TODO 780, plan 783 D4): a constant folds, and one that decides it, or a boolean only a run
  // gives, has no preset form, said in words.
  const withPart = (node, from, join = 'and') => filter('part', [node, fieldNode('plan', 'plan'), test_('pro', 'eq', 'Pro'), test_('j', join, undefined, 600)],
    [{ from: 'plan/field', to: 'pro' }, { from: 'pro', to: 'j' }, { from, to: 'j' }, { from: 'j', to: '#out/where' }]);
  const yes = { id: 'v', kind: 'value', x: 0, y: 240, values: { type: 'boolean', value: 'true' } };
  assert.deepEqual(presetOfEntity(withPart(yes, 'v/value')).preset.where, { plan: { eq: 'Pro' } }, 'Pro and true: Pro');
  assert.match(presetOfEntity(withPart(yes, 'v/value', 'or')).fault, /always holds, so it filters nothing/);
  // Never is Any of nothing on the field its test names: a preset on the bar that holds no row (TODO 816).
  assert.deepEqual(presetOfEntity(withPart({ ...yes, values: { type: 'boolean', value: 'false' } }, 'v/value')).preset.where, { plan: { or: [] } });
  assert.match(presetOfEntity(withPart({ id: 's', kind: 'source', x: 0, y: 240, values: { store: 'customers' } }, 's')).fault, /"Source › True" is a boolean only a run gives/);
});

test('what has no preset form is said in words: Or across two fields, an empty value, no condition, a test with no Field', () => {
  const any = filter('any', [fieldNode('fp', 'plan'), fieldNode('fs', 'status'), test_('pro', 'eq', 'Pro'), test_('trial', 'eq', 'trial'), test_('or', 'or', undefined, 600)],
    [{ from: 'fp/field', to: 'pro' }, { from: 'fs/field', to: 'trial' }, { from: 'pro', to: 'or' }, { from: 'trial', to: 'or' }, { from: 'or', to: '#out/where' }]);
  assert.deepEqual(presetOfEntity(any), { fault: 'the Preset Filter "any": it says Any of "plan" and "status", and each field holds its own condition' });
  // Any of ONE field is that field's own.
  assert.deepEqual(whereOfTree({ or: [{ field: 'plan', op: 'eq', value: 'Pro' }, { field: 'plan', op: 'eq', value: 'Free' }] }), { where: { plan: { or: [{ eq: 'Pro' }, { eq: 'Free' }] } } });
  const empty = filter('empty', [fieldNode('f', 'plan'), test_('c', 'eq')], [{ from: 'f/field', to: 'c' }, { from: 'c', to: '#out/where' }]);
  assert.deepEqual(presetOfEntity(empty), { fault: 'the Preset Filter "empty": its comparison of "plan" has no value' });
  assert.deepEqual(presetOfEntity(filter('none', [], [])), { fault: 'the Preset Filter "none" sends no condition to its Where' });
  // A comparison of values, with no Field on its header, says no condition (776 D11).
  const values = filter('values', [{ id: 'v', kind: 'value', x: 0, y: 0, values: { value: '1' } }, test_('m', 'gt', '2')], [{ from: 'v/value', to: 'm' }, { from: 'm', to: '#out/where' }]);
  assert.deepEqual(presetOfEntity(values), { fault: 'the Preset Filter "values": "Condition" tests no Field: route one in' });
  // A Field that sends nothing says why: a field its store lacks. With no Source, its rows are its settings' store's.
  const stranger = filter('stranger', [fieldNode('f', 'nope'), test_('c', 'eq', 'x')], [{ from: 'f/field', to: 'c' }, { from: 'c', to: '#out/where' }]);
  assert.match(presetOfEntity(stranger, { fieldsOf: { customers: FIELDS } }).fault, /"Condition" tests "Field", which sends nothing: "nope" is not a field of the rows that come in/);
  const not = filter('not', [fieldNode('f', 'plan'), test_('c', 'not')], [{ from: 'f/field', to: 'c' }, { from: 'c', to: '#out/where' }]);
  assert.match(presetOfEntity(not).fault, /"Condition" is Not, which a condition cannot say yet/);
  const falsy = filter('falsy', [fieldNode('f', 'plan'), test_('c', 'eq', 'Pro')], [{ from: 'f/field', to: 'c' }, { from: 'c/#false', to: '#out/where' }]);
  assert.match(presetOfEntity(falsy).fault ?? '', /False is the rows that do not hold/);
  // A loop reads nothing, and says so.
  assert.match(conditionAt({ nodes: [{ id: 'a', kind: 'condition', heading: 'A', rows: [{ name: 'type', value: 'and' }] }], routes: [{ from: 'a', to: 'a' }] }, 'a').faults[0], /reads itself, in a loop/);
});

test('a page lists only its store\'s: settings name the source, else its Store node; the app\'s then the reader\'s', () => {
  const orders = filter('orders', active.graph.nodes, active.graph.routes, { settings: { source: 'orders' } });
  const bare = { ...filter('bare', active.graph.nodes, active.graph.routes), settings: undefined };
  const node = { v: 1, type: 'node', id: 'a-node', label: 'A node', graph: { nodes: [], routes: [] }, settings: { inputs: [], outputs: [] } };
  assert.equal(sourceOf(bare), 'customers', 'its Store names it');
  const { presets, faults } = presetsOver('customers', [active, orders, bare, node, proActive]);
  assert.deepEqual(presets.map((p) => p.id), ['preset-filter:active-customers', 'preset-filter:bare', 'preset-filter:pro-active']);
  assert.deepEqual(faults, []);
});

test('a press is the Query\'s one door: on, the Status chip\'s Active rows; off, every row; the Query editor places it where it is declared', async () => {
  const source = await page();
  const all = total(source);
  const preset = presetOfEntity(active).preset;
  source.declarePresets('data', [{ id: preset.id, label: preset.label, readings: presetReadings(source, preset.where) }]);
  assert.deepEqual(source.describe('data').filters[0], { id: 'preset:preset-filter:active-customers', label: 'Active customers', preset: true, active: false });
  source.query.ask({ scope: 'data', preset: preset.id, on: true, commit: true });
  await source.load();
  const on = total(source);
  assert.equal(on, ROWS.filter((r) => r.status === 'active').length);
  assert.equal(source.query.presetOn('data', preset.id), true);
  source.query.ask({ scope: 'data', preset: preset.id, on: false, commit: true });
  await source.load();
  assert.equal(total(source), all);
  source.query.ask({ scope: 'data', field: 'status', reading: { picked: ['active'] }, commit: true });
  await source.load();
  assert.equal(total(source), on, 'the Status chip\'s Active gives the same rows');
  // Placed from the Query editor's panel: its own id switches it on; on already, refused in words; Preset skips it.
  const facts = { holds: () => [], fields: () => [], presets: (s) => source.query.presets(s), on: (s, id) => source.query.presetOn(s, id) };
  assert.deepEqual(placeRequest(preset.id, 'data', facts), { request: { scope: 'data', preset: preset.id, on: true } });
  assert.match(placeRequest('preset', 'data', facts).refused, /no preset left to switch on/);
  source.query.ask({ scope: 'data', preset: preset.id, on: true, commit: true });
  assert.deepEqual(placeRequest(preset.id, 'data', facts), { refused: '"Active customers" is on already: its chip is pressed.' });
});

test('never is `[\'or\']`: on the bar, and on it holds no row, in the store, a kept filter and a chart free of the field; always stays off the bar', async () => {
  // TRAP T-an-empty-any-of-is-never
  const { conditionClause } = await import(new URL('filter-state.js', data));
  const { filterWithout, matchesFilter } = await import(new URL('store.js', data));
  const never = filter('never', [fieldNode('plan', 'plan'), test_('pro', 'eq', 'Pro'), { id: 'v', kind: 'value', x: 0, y: 240, values: { type: 'boolean', value: 'false' } }, test_('j', 'and', undefined, 600)],
    [{ from: 'plan/field', to: 'pro' }, { from: 'pro', to: 'j' }, { from: 'v/value', to: 'j' }, { from: 'j', to: '#out/where' }]);
  const made = presetOfEntity(never).preset;
  assert.deepEqual(made.where, { plan: { or: [] } });
  // Said as a tree it compiles to the filter that matches nothing; an unanswered group still narrows nothing.
  assert.deepEqual(conditionClause({ or: [] }, { field: 'plan' }), ['or']);
  // Never beside another reading, ANDed, stays never; under Any of it adds nothing.
  assert.deepEqual(conditionClause({ and: [{ or: [] }, { field: 'plan', op: 'eq', value: 'Pro' }] }), ['and', ['or'], ['plan', 'eq', 'Pro']]);
  assert.deepEqual(conditionClause({ or: [{ or: [] }, { field: 'plan', op: 'eq', value: 'Pro' }] }), ['plan', 'eq', 'Pro']);
  assert.equal(ROWS.some((row) => matchesFilter(row, ['or'])), false);
  // A chart free of a field keeps it: it names no field, so it is none's to drop.
  assert.deepEqual(filterWithout(['or'], new Set(['plan'])), ['or']);
  assert.deepEqual(filterWithout(['and', ['plan', 'eq', 'Pro'], ['or']], new Set(['plan'])), ['or']);
  const source = await page();
  source.declarePresets('data', [{ id: made.id, label: made.label, readings: presetReadings(source, made.where) }]);
  assert.deepEqual(source.describe('data').filters[0], { id: 'preset:preset-filter:never', label: 'never', preset: true, active: false });
  source.query.ask({ scope: 'data', preset: made.id, on: true, commit: true });
  await source.load();
  assert.equal(source.query.presetOn('data', made.id), true);
  assert.equal(total(source), 0, 'on, no row');
  source.query.ask({ scope: 'data', preset: made.id, on: false, commit: true });
  await source.load();
  assert.equal(total(source), ROWS.length, 'off, every row');
  // Always has no preset form: it narrows nothing, so it is left off the bar, said in words.
  assert.match(presetOfEntity(withTrue()).fault, /always holds, so it filters nothing/);
  function withTrue() {
    return filter('always', [fieldNode('plan', 'plan'), test_('pro', 'eq', 'Pro'), { id: 'v', kind: 'value', x: 0, y: 240, values: { type: 'boolean', value: 'true' } }, test_('j', 'or', undefined, 600)],
      [{ from: 'plan/field', to: 'pro' }, { from: 'pro', to: 'j' }, { from: 'v/value', to: 'j' }, { from: 'j', to: '#out/where' }]);
  }
});
