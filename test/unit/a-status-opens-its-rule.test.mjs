/**
 * A STATUS OPENS ITS RULE — plan 960 U4.7b (Will, 2026-11-14). In a page's Query graph a status field is ONE Field node
 * on the page's rows, a row per value saying its rule in words. The rule is its inside (`statusRule`), opened read only as
 * a preset Custom Node's is: the rows in at its Group Input; per `when` a Field per field it names, a test per rule and an
 * Or; its Pass out at its value, its Fail into the next value's Fields, in the order the status takes the first match. The
 * load lights each root with the rows that took it. A preset's conditions draw on the top canvas, read only.
 * TRAP T-a-status-opens-its-rule · TRAP T-a-condition-is-a-tree-of-nodes
 *
 *   node --test test/unit/a-status-opens-its-rule.test.mjs
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ArrayStore, conditionWords, onTrace, queryGraph, queryGraphFaults, statusRule, statusTallies, traceQuerySteps, traceStep } from '../../dist/data.js';
import { statusFields } from '../../dist/core/data/status-field.js';
import { innerOf } from '../../dist/core/data/node-library.js';
import { NODE_KINDS, ROWS } from '../../dist/core/data/node-kinds.js';

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
const into = (to) => g.connections.filter((r) => r.to === to).map((r) => r.from);
const LABELS = { score: 'Score', openTickets: 'Open tickets' };
const rule = statusRule('health', store.domains.health, { label: (f) => LABELS[f] ?? f });
const from = (to) => rule.connections.filter((r) => r.to === to).map((r) => r.from);

test('Health is ONE Field node on the page\'s rows: its field, read only, and a row per value saying its rule', () => {
  const status = node('status-health');
  assert.equal(status.kind, 'field');
  assert.deepEqual(into('status-health'), [`source/${ROWS.name}`]);
  assert.deepEqual(status.rows.map((r) => [r.name, r.value, !!r.editable]), [
    ['field', 'health', false],
    ['At risk', 'Score is less than 60 or Open tickets is at least 5', false],
    ['Watch', 'Score is less than 80 or Open tickets is more than 0', false],
    ['Healthy', 'Every row the values before it left.', false],
  ]);
  // Its value rows take nothing and send nothing: they show.
  assert.ok(status.rows.slice(1).every((r) => !r.input && !r.output), 'no socket on a value row');
  // No chain on the top canvas, and no Status kind.
  assert.deepEqual(g.nodes.filter((n) => n.kind === 'condition' || n.kind === 'status'), []);
  assert.equal(NODE_KINDS['status'], undefined);
  assert.deepEqual(queryGraphFaults(g, store.domains), []);
});

test('its rule is a preset inside: per `when` a Field per field and an Or, its Pass out at its value, its Fail into the next', () => {
  assert.equal(rule.preset, true);
  assert.deepEqual(rule.inputs.map((i) => i.name), [ROWS.name]);
  assert.deepEqual(rule.outputs.map((o) => o.name), ['At risk', 'Watch', 'Healthy']);
  const roots = rule.nodes.filter((n) => n.kind === 'condition' && !/\.\d+$/.test(n.id));
  assert.deepEqual(roots.map((n) => [n.id, n.heading, n.description, n.values.type]), [
    ['status-health.At risk', 'At risk', 'Score is less than 60 or Open tickets is at least 5', 'or'],
    ['status-health.Watch', 'Watch', 'Score is less than 80 or Open tickets is more than 0', 'or'],
  ]);
  assert.deepEqual(rule.nodes.filter((n) => n.kind === 'field').map((n) => [n.id, n.values.field]), [
    ['field-status-health.At risk-score', 'score'], ['field-status-health.At risk-openTickets', 'openTickets'],
    ['field-status-health.Watch-score', 'score'], ['field-status-health.Watch-openTickets', 'openTickets'],
  ]);
  // The rows in at the Group Input; At risk's Fail into each of Watch's Fields; Watch's Fail into the value no `when` names.
  assert.deepEqual(['field-status-health.At risk-score', 'field-status-health.At risk-openTickets'].map(from), [[`#in/${ROWS.name}`], [`#in/${ROWS.name}`]]);
  assert.deepEqual(['field-status-health.Watch-score', 'field-status-health.Watch-openTickets'].map(from), [['status-health.At risk/fail'], ['status-health.At risk/fail']]);
  assert.deepEqual(['#out/At risk', '#out/Watch', '#out/Healthy'].map(from), [['status-health.At risk/pass'], ['status-health.Watch/pass'], ['status-health.Watch/fail']]);
  // Each rule says its Operation and its Value B.
  assert.deepEqual(['status-health.At risk.1', 'status-health.At risk.2'].map((id) => rule.nodes.find((n) => n.id === id).values), [{ type: 'lt', b: 60 }, { type: 'gte', b: 5 }]);
  // It opens as a Custom Node's inside does: the body between a Group Input and a Group Output.
  const inner = innerOf({ id: 'status-health', kind: 'field' }, { v: 1, nodes: {} }, undefined, { held: rule });
  assert.deepEqual([inner.workflow.nodes[0].id, inner.workflow.nodes.at(-1).id], ['#in', '#out']);
  assert.equal(innerOf({ id: 'status-health', kind: 'field' }, { v: 1, nodes: {} }), undefined, 'a Field holds no inside of its own');
});

test('the load lights each value\'s row with its rows, and its root inside: At risk 43, Watch 20, Healthy 37 (TODO 983)', async () => {
  const tally = await statusTallies(store, store.domains);
  // Every value, the last too: the rows the rest left.
  assert.deepEqual(tally, { health: { 'At risk': 43, Watch: 20, Healthy: 37 } });
  const spans = [];
  const off = onTrace((s) => spans.push(s));
  try {
    const load = traceStep('load', { graph: 'customers' });
    traceQuerySteps({ v: 1, scopes: {} }, { walk: { results: {} }, statuses: tally }, load);
  } finally { off(); }
  const lit = spans.filter((s) => s.detail?.node?.startsWith('status-health') && s.detail.state === 'done').map((s) => [s.detail.node, s.detail.rows]);
  // The Field node with them all; each value's row (`node/row`), and its root inside, with its own.
  assert.deepEqual(lit, [
    ['status-health', 100], ['status-health/At risk', 43], ['status-health.At risk', 43],
    ['status-health/Watch', 20], ['status-health.Watch', 20], ['status-health/Healthy', 37], ['status-health.Healthy', 37],
  ]);
});

test('a PRESET\'s conditions are Condition nodes, read only, connected to their row', () => {
  const def = { ...page, source: { ...page.source, scopes: { data: { presets: [{ id: 'big', label: 'Big', where: { score: { gt: 90 } } }] } } } };
  const d = queryGraph({ v: 1, scopes: { data: { holds: [], readings: {} } } }, def);
  const big = d.nodes.find((n) => n.id === 'when-preset-data-big-score');
  assert.ok(big.kind === 'condition' && big.rows.filter((r) => r.name !== ROWS.name).every((r) => !r.editable), big.id);
  // From its Pass (plan 971 §9).
  assert.ok(d.connections.some((r) => r.from === `${big.id}/pass` && r.to === 'preset-data-big/score'));
  assert.deepEqual(queryGraphFaults(d), []);
});

test('planted faults: a `when` that is no condition is said, on its row and as a fault; a connection into nothing, or a row a node lacks', () => {
  const bad = { ...store.domains, health: { ...store.domains.health, when: { 'At risk': 'score < 60', Watch: store.domains.health.when.Watch } } };
  const drawn = queryGraph({ v: 1, scopes: {} }, page, { domains: bad });
  assert.equal(drawn.nodes.find((n) => n.id === 'status-health').rows.find((r) => r.name === 'At risk').value, 'Its `when` is not a condition.');
  assert.ok(queryGraphFaults(drawn, bad).some((f) => /"At risk" is not a condition/.test(f)));
  // Its rule draws no node for it: Watch's Fields take the rows from the Group Input.
  const broken = statusRule('health', bad.health);
  assert.deepEqual(broken.nodes.filter((n) => n.kind === 'condition').map((n) => n.id), ['status-health.Watch.1', 'status-health.Watch.2', 'status-health.Watch']);
  assert.deepEqual(broken.connections.filter((r) => r.to === 'field-status-health.Watch-score').map((r) => r.from), [`#in/${ROWS.name}`]);
  const dangling = { nodes: g.nodes, connections: [...g.connections, { from: 'source/rows', to: 'status-health.Ghost' }] };
  assert.ok(queryGraphFaults(dangling).some((f) => /status-health\.Ghost/.test(f)));
  // No node has a False now (plan 944): it is a row the Source does not have.
  const wrong = { nodes: g.nodes, connections: [...g.connections, { from: 'source/#false', to: 'status-health' }] };
  assert.ok(queryGraphFaults(wrong).includes('A connection from "source/#false" leaves a row "Source" does not have.'));
  const row = { nodes: g.nodes, connections: [...g.connections, { from: 'source/rows', to: 'status-health/Nope' }] };
  assert.ok(queryGraphFaults(row).some((f) => /into "status-health\/Nope" ends at a row/.test(f)));
});

test('only a worked-out status field holds a rule: a stored field with looks per value does not (sherpa-ui-a9, plan 960 U2)', () => {
  const looks = { plan: { statuses: { gold: 'success', basic: 'info' } }, health: { when: {}, statuses: { ok: 'success' } } };
  const drawn = queryGraph({ v: 1, scopes: {} }, page, { domains: looks });
  assert.deepEqual(drawn.nodes.filter((n) => n.ref?.status).map((n) => n.ref.field), ['health']);
});

test('a rule in words: each field by its label, a group inside another in brackets, a range and a span', () => {
  const label = (f) => LABELS[f] ?? f;
  assert.equal(conditionWords({ and: [{ field: 'score', op: 'gt', value: 10 }, { or: [{ field: 'openTickets', op: 'eq', value: 0 }, { field: 'plan', op: 'in', value: ['Pro', 'Team'] }] }] }, label),
    'Score is more than 10 and (Open tickets is 0 or plan is one of Pro, Team)');
  assert.equal(conditionWords({ field: 'score', op: 'between', value: [40, 60] }, label), 'Score is between 40 and 60');
  assert.equal(conditionWords({ field: 'seen', op: 'last', value: { n: 7, unit: 'day' } }), 'seen is in the last 7 days');
  assert.equal(conditionWords({ field: 'note', op: 'empty', value: '' }), 'note is empty');
});
