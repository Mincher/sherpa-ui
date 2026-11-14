/**
 * A GRAPH READS AS TEXT (plan 960 U5, the text lens): its steps in words, stage by stage, in the order and numbers
 * `graphSteps` gives; a test of one value with where its Pass and Fail go, its Fail an error; a split of a column with
 * where its rows go; a retry. Each kind in its own words, an app's by `registerStepWords`; `graphKey` changes with what the
 * graph does, not where its nodes stand.
 * TRAP T-a-text-names-what-it-means
 *
 *   node --test test/unit/a-graph-reads-as-text.test.mjs
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { graphKey, graphText, outputWords, registerStepWords, stepWords } from '../../dist/data.js';

const N = (id, kind, x, y, stage, values, more = {}) => ({ id, kind, x, y, stage, ...(values ? { values } : {}), ...more });
/** Find: the devices, their health, those at risk. Act: fix each, try again, then tell; none at risk, say so. */
const graph = () => ({
  stages: [{ id: 'find', label: 'Find', x: 0 }, { id: 'act', label: 'Act', x: 1000 }],
  nodes: [
    N('s', 'source', 0, 0, 'find', { store: 'devices' }), N('f', 'field', 300, 0, 'find', { field: 'health' }),
    N('risk', 'condition', 600, 0, 'find', { type: 'eq', b: 'At risk' }, { heading: 'At risk' }),
    N('fix', 'runbook', 1100, 0, 'act', { instructions: 'Fix the device.' }, { heading: 'Fix' }),
    N('ok', 'condition', 1400, 0, 'act', { type: 'gt', b: 0 }, { heading: 'Fixed?' }),
    N('again', 'runbook', 1700, 200, 'act', { instructions: 'Try again once.' }, { heading: 'Retry once' }),
    N('tell', 'notify', 1700, 0, 'act', { type: 'notification', title: 'Fixed' }),
    N('none', 'condition', 1100, 400, 'act', { type: 'empty' }, { heading: 'None at risk' }),
    N('calm', 'notify', 1400, 400, 'act', { type: 'notification', title: 'All healthy' }),
  ],
  connections: [
    { from: 's/rows', to: 'f' }, { from: 'f/field', to: 'risk' }, { from: 'risk/pass', to: 'fix' }, { from: 'risk/pass', to: 'none' },
    { from: 'fix/true', to: 'ok' }, { from: 'ok/pass', to: 'tell' }, { from: 'ok/fail', to: 'again' }, { from: 'none/pass', to: 'calm' },
  ],
});

test('a graph reads as its steps in words, stage by stage: a column split, a test of one value with its Pass and Fail', () => {
  const read = graphText(graph());
  assert.deepEqual(read.stages, [
    '1. Find',
    '   1.1 source.',
    '   1.2 Read each row\'s {{field:health}}.',
    '   1.3 At risk: keep the rows whose {{field:health}} is At risk.',
    '2. Act',
    '   2.1 Fix: Fix the device.',
    '   2.2 None at risk: when nothing comes in.',
    '       PASS: go to {{step:2.4}} notify.',
    '   2.3 Fixed?: when what comes in is more than 0.',
    '       PASS: go to {{step:2.5}} notify.',
    '       FAIL: go to {{step:2.6}} Retry once.',
    '   2.4 notify: {{action:notification}}, "All healthy".',
    '   2.5 notify: {{action:notification}}, "Fixed".',
    '   2.6 Retry once: Try again once.',
  ]);
  // The one-value Fail is an error; a step whose words say again is a retry, first.
  assert.deepEqual(read.errors, ['- A retry: {{step:2.6}} Retry once.', '- If not Fixed ({{step:2.3}}): go to {{step:2.6}} Retry once.']);
  assert.equal(read.steps.length, 9);
});

test('an app says its own kind, or a use of its type, in words; an Output takes the app\'s words after its action', () => {
  const ticket = N('t', 'request', 0, 0, undefined, { type: 'ticket', board: 'Ops', summary: 'Patch failed' });
  const back = registerStepWords('request', (n) => (n.values?.board ? outputWords(n, [`on the ${n.values.board} board`]) : undefined));
  const ask = registerStepWords('expert', (n) => `${n.heading ?? 'expert'}: ask {{expert:${n.kind.split(':')[1]}}}.`);
  try {
    assert.equal(stepWords(ticket, {}), 'request: {{action:ticket}}, on the Ops board, "Patch failed".');
    assert.equal(stepWords(N('e', 'expert:net', 0, 0), {}), 'expert: ask {{expert:net}}.');
    assert.equal(stepWords(N('r', 'workflow:patch', 0, 0), {}), 'workflow: run {{workflow:patch}}.');
  } finally {
    back();
    ask();
  }
  assert.equal(stepWords(ticket, {}), 'request: {{action:ticket}}, "Patch failed".', 'taken back');
});

test('graphKey changes with what a graph does, not with where its nodes stand', () => {
  const g = graph();
  const moved = { ...g, nodes: g.nodes.map((n) => ({ ...n, x: n.x + 50 })) };
  const changed = { ...g, nodes: g.nodes.map((n) => (n.id === 'risk' ? { ...n, values: { type: 'eq', b: 'Critical' } } : n)) };
  assert.equal(graphKey(moved), graphKey(g));
  assert.notEqual(graphKey(changed), graphKey(g));
  assert.equal(typeof graphKey(), 'string');
});
