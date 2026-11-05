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

/** Demos' own: Store, then a Condition, Status Equals active, into the Where. */
const active = {
  v: 1, type: 'preset-filter', id: 'active-customers', label: 'Active customers', settings: { source: 'customers' },
  graph: {
    nodes: [
      { id: 'start', kind: 'store', x: 0, y: 0, values: { store: 'customers' } },
      { id: 'status', kind: 'condition', x: 360, y: 0, values: { type: 'rows', field: 'status', op: 'eq', value: 'active' } },
    ],
    routes: [{ from: 'start/rows', to: 'status' }, { from: 'status', to: '#out/where' }],
  },
};
/** A Preset Filter whose nodes and routes are given, over customers. */
const filter = (id, nodes, routes, extra = {}) => ({ v: 1, type: 'preset-filter', id, label: id, settings: { source: 'customers' }, graph: { nodes, routes }, ...extra });
/** Pro, with Active customers placed in its Group row. */
const proActive = filter('pro-active', [
  { id: 'use', kind: 'preset-filter:active-customers', x: 0, y: 240 },
  { id: 'pro', kind: 'condition', x: 360, y: 0, values: { field: 'plan', op: 'eq', value: 'Pro' } },
], [{ from: 'use', to: 'pro/group-2' }, { from: 'pro', to: '#out/where' }]);

async function page() {
  const source = await openSource({ store: 'customers', fields: FIELDS, scopes: { data: { label: 'Rows', holds: ['status', 'plan'] } } }, new ArrayStore(ROWS, { key: 'id' }));
  bindSource(source, { populate() {}, setAttribute() {}, removeAttribute() {}, addEventListener() {}, removeEventListener() {} }, { scope: 'data' });
  await source.load();
  return source;
}
const total = (source) => source.debugState().total;

test('its graph is read as the condition its Where says, the shape a page\'s own preset has, its id its use\'s kind', () => {
  assert.deepEqual(presetOfEntity(active), { preset: { id: 'preset-filter:active-customers', label: 'Active customers', where: { status: { eq: 'active' } } } });
  // A Value routed into the Condition's Value is read as the canvas draws it: mirrored.
  const routed = filter('routed', [
    { id: 'val', kind: 'value', x: 0, y: 200, values: { value: 'trial' } },
    { id: 'c', kind: 'condition', x: 360, y: 0, values: { field: 'status', op: 'eq' } },
  ], [{ from: 'val/value', to: 'c/value' }, { from: 'c', to: '#out/where' }]);
  assert.deepEqual(presetOfEntity(routed).preset.where, { status: { eq: 'trial' } });
  // Text in a list's row is split as the Query editor splits it; a number field's text is typed by its page.
  const list = filter('list', [{ id: 'c', kind: 'condition', x: 0, y: 0, values: { join: 'and', field: 'status', op: 'in', value: ['active', 'trial'], 'field-2': 'seats', 'op-2': 'gt', 'value-2': '5' } }], [{ from: 'c', to: '#out/where' }]);
  assert.deepEqual(presetOfEntity(list).preset.where, { status: { in: ['active', 'trial'] }, seats: { gt: '5' } });
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
  const row = node.rows.find((r) => r.name === 'value');
  const back = graphRequest({ node, row, value: row.value });
  assert.equal(back.field, 'status');
  assert.ok(sameAnswer(back.reading, compiled.status), JSON.stringify([back.reading, compiled.status]));
});

test('one placed inside another flattens: in a Group row, or through Logic And; the Outgoing JSON says the two joined', () => {
  assert.deepEqual(presetOfEntity(proActive, { entities: [active] }).preset.where, { plan: { eq: 'Pro' }, status: { eq: 'active' } });
  const both = filter('both', [
    { id: 'use', kind: 'preset-filter:pro-active', x: 0, y: 240 },
    { id: 'big', kind: 'condition', x: 0, y: 0, values: { field: 'seats', op: 'gte', value: 5 } },
    { id: 'and', kind: 'condition', x: 360, y: 0, values: { type: 'and' } },
  ], [{ from: 'use', to: 'and' }, { from: 'big', to: 'and' }, { from: 'and', to: '#out/where' }]);
  // Two deep: pro-active holds active-customers, and each is read inside.
  assert.deepEqual(presetOfEntity(both, { entities: [active, proActive] }).preset.where, { plan: { eq: 'Pro' }, status: { eq: 'active' }, seats: { gte: 5 } });
  // The canvas's Outgoing JSON reads the same: Pro's Condition says Pro and the use's own.
  const library = libraryOf([active, proActive]);
  const kinds = { ...kindsOf(library), ...NODE_KINDS };
  const drawn = workflowGraph({ v: 2, id: 'x', nodes: proActive.graph.nodes, routes: [{ from: 'use', to: 'pro/group-2' }] }, {}, kinds);
  const inner = (node) => { const use = innerOf(node, library, kinds); return use && workflowGraph(use.workflow, {}, use.kinds); };
  assert.deepEqual(nodeFlow(drawn, 'pro', { inner }).definition, { where: { and: [{ field: 'plan', op: 'eq', value: 'Pro' }, { field: 'status', op: 'eq', value: 'active' }] } });
  assert.deepEqual(nodeFlow(drawn, 'use', { inner }).definition, { where: { field: 'status', op: 'eq', value: 'active' } });
  // Without the inside, the use's True is a boolean only a run gives (TODO 780), named by where it comes from.
  assert.deepEqual(nodeFlow(drawn, 'pro').definition, { where: { and: [{ field: 'plan', op: 'eq', value: 'Pro' }, { boolean: 'Active customers › True' }] } });
  // A Group row takes any boolean (TODO 780): a Preset Filter's True brings its tree; a constant folds, and one that
  // decides it, or a boolean only a run gives, has no preset form, said in words.
  assert.deepEqual(workflowFaults({ v: 2, id: 'x', nodes: proActive.graph.nodes, routes: [{ from: 'use', to: 'pro/group-2' }] }, kinds), []);
  const pro = proActive.graph.nodes[1];
  const withPart = (node, from, join) => filter('part', [node, join ? { ...pro, values: { ...pro.values, join } } : pro], [{ from, to: 'pro/group-2' }, { from: 'pro', to: '#out/where' }]);
  const yes = { id: 'v', kind: 'value', x: 0, y: 240, values: { type: 'boolean', value: 'true' } };
  assert.deepEqual(presetOfEntity(withPart(yes, 'v/value')).preset.where, { plan: { eq: 'Pro' } }, 'Pro and true: Pro');
  assert.match(presetOfEntity(withPart(yes, 'v/value', 'or')).fault, /always holds, so it filters nothing/);
  assert.match(presetOfEntity(withPart({ ...yes, values: { type: 'boolean', value: 'false' } }, 'v/value')).fault, /never holds, so no row passes/);
  assert.match(presetOfEntity(withPart({ id: 's', kind: 'store', x: 0, y: 240, values: { store: 'customers' } }, 's')).fault, /"Store › True" is a boolean only a run gives/);
});

test('what has no preset form is said in words: Any of two fields, an empty value, no condition, a node that says none', () => {
  const any = filter('any', [{ id: 'c', kind: 'condition', x: 0, y: 0, values: { join: 'or', field: 'plan', op: 'eq', value: 'Pro', 'field-2': 'status', 'op-2': 'eq', 'value-2': 'trial' } }], [{ from: 'c', to: '#out/where' }]);
  assert.deepEqual(presetOfEntity(any), { fault: 'the Preset Filter "any": it says Any of "plan" and "status", and each field holds its own condition' });
  // Any of ONE field is that field's own.
  assert.deepEqual(whereOfTree({ or: [{ field: 'plan', op: 'eq', value: 'Pro' }, { field: 'plan', op: 'eq', value: 'Free' }] }), { where: { plan: { or: [{ eq: 'Pro' }, { eq: 'Free' }] } } });
  const empty = filter('empty', [{ id: 'c', kind: 'condition', x: 0, y: 0, values: { field: 'plan', op: 'eq' } }], [{ from: 'c', to: '#out/where' }]);
  assert.deepEqual(presetOfEntity(empty), { fault: 'the Preset Filter "empty": its comparison of "plan" has no value' });
  assert.deepEqual(presetOfEntity(filter('none', [], [])), { fault: 'the Preset Filter "none" sends no condition to its Where' });
  const math = filter('math', [{ id: 'm', kind: 'condition', x: 0, y: 0, values: { type: 'gt', a: '1', b: '2' } }], [{ from: 'm', to: '#out/where' }]);
  assert.match(presetOfEntity(math).fault, /compares values, not a field of rows: use Rows that hold/);
  const falsy = filter('falsy', [{ id: 'c', kind: 'condition', x: 0, y: 0, values: { field: 'plan', op: 'eq', value: 'Pro' } }], [{ from: 'c/#false', to: '#out/where' }]);
  assert.match(presetOfEntity(falsy).fault ?? '', /False is the rows that do not hold/);
  // A loop reads nothing, and says so.
  assert.match(conditionAt({ nodes: [{ id: 'a', kind: 'condition', heading: 'A', rows: [{ name: 'group', label: 'Group' }] }], routes: [{ from: 'a', to: 'a/group' }] }, 'a/group').faults[0], /reads itself, in a loop/);
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
