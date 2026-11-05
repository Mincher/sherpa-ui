/**
 * A STATUS IS A CHAIN OF CONDITIONS — plan 713 M5, plan 783 D6. A status field draws one row per value and,
 * per `when`, a Field per field it names, a test per rule and an Or, chained by False — into the next value's
 * Fields — in the order the status takes the first match; a preset's and a saved filter's conditions draw the
 * same way, read only. The load lights each root with the rows that took it. TRAP T-a-condition-is-a-tree-of-nodes
 *
 *   node --test test/unit/a-status-is-a-chain-of-conditions.test.mjs
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ArrayStore, onTrace, queryGraph, queryGraphFaults, statusTallies, traceQuerySteps, traceStep } from '../../dist/data.js';
import { statusFields } from '../../dist/core/data/status-field.js';
import { ROWS } from '../../dist/core/data/node-kinds.js';

/** Demos' Health: the first rule that matches. */
const health = {
  type: 'status', label: 'Health',
  values: [
    { value: 'At risk', status: 'critical', when: [{ score: { lt: 60 } }, { openTickets: { gte: 5 } }] },
    { value: 'Watch', status: 'warning', when: [{ score: { lt: 80 } }, { openTickets: { gt: 0 } }] },
    { value: 'Healthy', status: 'success' },
  ],
};
// 43 at risk, 20 watch, 37 healthy.
const rows = Array.from({ length: 100 }, (_, i) => (i < 43 ? { id: i, score: 40, openTickets: 0 } : i < 63 ? { id: i, score: 70, openTickets: 0 } : { id: i, score: 95, openTickets: 0 }));
const page = { v: 1, id: 'customers', source: { store: 'customers', fields: { score: { label: 'Score', type: 'number' }, openTickets: { label: 'Open tickets', type: 'number' } } } };
const store = statusFields(new ArrayStore(rows, { key: 'id' }), { health });
const g = queryGraph({ v: 1, scopes: {} }, page, { domains: store.domains });
const node = (id) => g.nodes.find((n) => n.id === id);
const into = (to) => g.routes.filter((r) => r.to === to).map((r) => r.from);

test('Health is 3 value rows, and per `when` a Field per field, a test per rule and an Or, chained by False into the next value\'s Fields', () => {
  const status = node('status-health');
  assert.deepEqual(status.rows.filter((r) => r.name !== ROWS.name).map((r) => [r.name, r.input, r.value]), [
    ['At risk', 'boolean', 'critical'], ['Watch', 'boolean', 'warning'], ['Healthy', 'boolean', 'success'],
  ]);
  const roots = g.nodes.filter((n) => n.kind === 'condition' && !/\.\d+$/.test(n.id));
  assert.deepEqual(roots.map((n) => [n.id, n.heading, n.branches, n.input, n.rows[0].value]), [
    ['status-health.At risk', 'At risk', true, 'boolean', 'or'], ['status-health.Watch', 'Watch', true, 'boolean', 'or'],
  ]);
  const fields = g.nodes.filter((n) => n.kind === 'field');
  assert.deepEqual(fields.map((n) => [n.id, n.rows[0].value, n.input]), [
    ['field-status-health.At risk-score', 'score', undefined], ['field-status-health.At risk-openTickets', 'openTickets', undefined],
    ['field-status-health.Watch-score', 'score', 'any'], ['field-status-health.Watch-openTickets', 'openTickets', 'any'],
  ]);
  // Each root's True into its value; At risk's False into each of Watch's Fields; Watch's False into the value no `when` names.
  assert.deepEqual(g.routes.filter((r) => /^status-health\.[^.]+(\/#false)?$/.test(r.from)), [
    { from: 'status-health.At risk', to: 'status-health/At risk' },
    { from: 'status-health.At risk/#false', to: 'field-status-health.Watch-score' },
    { from: 'status-health.At risk/#false', to: 'field-status-health.Watch-openTickets' },
    { from: 'status-health.Watch', to: 'status-health/Watch' },
    { from: 'status-health.Watch/#false', to: 'status-health/Healthy' },
  ]);
  assert.deepEqual(into('status-health.At risk.1'), ['field-status-health.At risk-score/field']);
  assert.deepEqual(queryGraphFaults(g, store.domains), []);
});

test('each `when` is its value\'s, read only: any of its rules, the store\'s to change', () => {
  const tests = ['status-health.At risk.1', 'status-health.At risk.2'].map((id) => node(id).rows.map((r) => r.value));
  assert.deepEqual(tests, [['lt', 60], ['gte', 5]]);
  const drawn = g.nodes.filter((n) => n.id.includes('At risk') && n.kind !== 'status');
  assert.ok(drawn.every((n) => n.rows.every((r) => !r.editable && /store/.test(r.hint))), 'every row read only');
  assert.ok(drawn.every((n) => n.ref.scope === undefined), 'no scope: no edit asks the Query');
  assert.equal(into('status-health/Watch').length, 1);
});

test('the load lights At risk with its 43 rows, Watch with its 20, from the store\'s own counts', async () => {
  const tally = await statusTallies(store, store.domains);
  assert.deepEqual(tally, { health: { 'At risk': 43, Watch: 20 } });
  const spans = [];
  const off = onTrace((s) => spans.push(s));
  try {
    const load = traceStep('load', { graph: 'customers' });
    traceQuerySteps({ v: 1, scopes: {} }, { walk: { results: {} }, statuses: tally }, load);
  } finally { off(); }
  const lit = spans.filter((s) => s.detail?.node?.startsWith('status-health') && s.detail.state === 'done').map((s) => [s.detail.node, s.detail.rows]);
  assert.deepEqual(lit, [['status-health', 63], ['status-health.At risk', 43], ['status-health.Watch', 20]]);
});

test('a PRESET\'s and a SAVED FILTER\'s conditions are Condition nodes, read only, routed into their row', () => {
  const def = { ...page, source: { ...page.source, scopes: { data: { presets: [{ id: 'big', label: 'Big', where: { score: { gt: 90 } } }] } } }, savedFilters: { low: { label: 'Low', query: { v: 1, scopes: { view: { where: { score: { lt: 50 } } } } } } } };
  const d = queryGraph({ v: 1, scopes: { data: { holds: [], readings: {} } } }, def);
  const big = d.nodes.find((n) => n.id === 'when-preset-data-big-score');
  const low = d.nodes.find((n) => n.id === 'when-saved-low-view:score');
  for (const n of [big, low]) assert.ok(n.kind === 'condition' && n.rows.filter((r) => r.name !== ROWS.name).every((r) => !r.editable), n.id);
  assert.ok(d.routes.some((r) => r.from === big.id && r.to === 'preset-data-big/score'));
  assert.ok(d.routes.some((r) => r.from === low.id && r.to === 'saved-low/view:score'));
  assert.deepEqual(queryGraphFaults(d), []);
});

test('planted faults: a `when` that is no condition, a False into nothing, a False from a node that does not fork', () => {
  const bad = { ...store.domains, health: { ...store.domains.health, when: { 'At risk': 'score < 60', Watch: store.domains.health.when.Watch } } };
  const drawn = queryGraph({ v: 1, scopes: {} }, page, { domains: bad });
  assert.deepEqual(drawn.nodes.filter((n) => n.kind === 'condition').map((n) => n.id), ['status-health.Watch', 'status-health.Watch.1', 'status-health.Watch.2'], 'a bad `when` draws no node');
  assert.ok(queryGraphFaults(drawn, bad).some((f) => /"At risk" is not a condition/.test(f)));
  const dangling = { nodes: g.nodes, routes: [...g.routes, { from: 'status-health.Watch/#false', to: 'status-health.Ghost' }] };
  assert.ok(queryGraphFaults(dangling).some((f) => /status-health\.Ghost/.test(f)));
  const wrong = { nodes: g.nodes, routes: [...g.routes, { from: 'source/#false', to: 'status-health.Watch' }] };
  assert.ok(queryGraphFaults(wrong).some((f) => /no False/.test(f)));
  const row = { nodes: g.nodes, routes: [...g.routes, { from: 'status-health.Watch/#false', to: 'status-health/Nope' }] };
  assert.ok(queryGraphFaults(row).some((f) => /row/.test(f)));
});
