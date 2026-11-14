/**
 * ONLY A TEST BRANCHES — Will, plans 944 (D1 A), 971 (§9: "Fold it into Condition"): no node has a True or a False socket,
 * and there is no Branch node. A Condition has no True (Will: "This removes the need for the 'True' property"); an AI node
 * has one in its True/false type. A test's Pass and Fail are its two ways: on ONE value, the way taken sends what reaches its Data, the other "Not
 * taken". A check that is no Condition (Time, Tag, a Preset, a use of a Custom Node) still sends one boolean
 * from its header, `Out`.
 *
 *   node --test test/unit/only-a-test-branches.test.mjs
 *
 * TRAP T-a-condition-is-a-tree-of-nodes
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

const core = new URL('../../dist/core/data/', import.meta.url);
const { NODE_KINDS, kindNode, resolveKind, socketType } = await import(new URL('node-kinds.js', core));
const { workflowFaults, workflowGraph } = await import(new URL('workflow.js', core));
const { nodeKindOf } = await import(new URL('node-library.js', core));
const { nodeFlow } = await import(new URL('node-flow.js', core));
const { simulateGraph } = await import(new URL('node-simulate.js', core));

const node = (id, kind, values) => ({ id, kind, x: 0, y: 0, ...(values ? { values } : {}) });
const flow = (nodes, connections) => ({ v: 3, id: 'w', nodes, connections });

test('no kind branches, in any type, nor a Custom Node use; a Condition has no True row in any type, an AI node has one in True/false', () => {
  const each = Object.values(NODE_KINDS).flatMap((k) => Object.keys(k.types ?? { one: 1 }).map((t) => resolveKind(k, t)));
  assert.deepEqual(each.filter((k) => 'branches' in k).map((k) => k.heading), []);
  assert.equal('branches' in nodeKindOf({ v: 1, label: 'Mine', inputs: [], outputs: [], nodes: [] }), false);
  // A Condition's Pass says its test (plan 971 §9).
  for (const type of Object.keys(NODE_KINDS.condition.types)) assert.equal(resolveKind(NODE_KINDS.condition, type).rows.find((r) => r.name === 'true'), undefined, type);
  for (const id of ['prompt', 'runbook', 'skill']) {
    assert.deepEqual(Object.keys(NODE_KINDS[id].types).filter((t) => resolveKind(NODE_KINDS[id], t).rows.some((r) => r.name === 'true')), ['boolean'], id);
  }
});

test('a check that is no Condition sends a boolean from its header; a Condition and the rest send nothing from it; none has a False', () => {
  const sends = (id) => socketType(resolveKind(NODE_KINDS[id]), undefined, 'output');
  assert.deepEqual(Object.fromEntries(['condition', 'time', 'tag', 'preset', 'source', 'value', 'field', 'math', 'organise', 'text'].map((id) => [id, sends(id)])), {
    condition: undefined, time: 'boolean', tag: 'boolean', preset: 'boolean', source: undefined, value: undefined, field: undefined, math: undefined, organise: undefined, text: undefined,
  });
  for (const id of Object.keys(NODE_KINDS)) assert.equal(socketType(resolveKind(NODE_KINDS[id]), '#false', 'output'), undefined, `${id}: no False (plan 944)`);
});

test('a drawn node says it: none has `branches`; a connection from a Condition\'s header or a False is refused in words', () => {
  const g = workflowGraph(flow([node('s', 'source', { store: 'users' }), node('v', 'value'), node('m', 'math'), node('c', 'condition'), node('t', 'time')], []));
  assert.deepEqual(g.nodes.filter((n) => 'branches' in n).map((n) => n.id), []);
  const into = (from) => workflowFaults(flow([node('s', 'source', { store: 'users' }), node('v', 'value'), node('m', 'math'), node('c', 'condition'), node('j', 'condition', { type: 'and' })], [{ from, to: 'j' }]));
  for (const from of ['s', 'v/#false', 'm', 'c', 'c/#false']) assert.deepEqual(into(from), [`a connection leaves "${from}", which is no output socket`], from);
  // A Condition's Pass, a Time's Out, and a test of one value's Pass and Fail join And.
  assert.deepEqual(workflowFaults(flow([node('c', 'condition'), node('t', 'time'), node('v', 'value', { type: 'integer', value: 5 }), node('k', 'condition', { type: 'gt', b: 1 }), node('j', 'condition', { type: 'and' })],
    [{ from: 'c/pass', to: 'j' }, { from: 't', to: 'j' }, { from: 'v/value', to: 'k' }, { from: 'k/pass', to: 'j' }, { from: 'k/fail', to: 'j' }])), []);
});

test('a kind that still says `branches: true` draws no True and no False: the option is gone (plan 944)', () => {
  const kinds = { ...NODE_KINDS, gate: { heading: 'Gate', icon: 'flag', input: 'any', branches: true, rows: [], model: 'gate', graphs: ['workflow'] } };
  const w = flow([node('g', 'gate'), node('j', 'condition', { type: 'and' })], [{ from: 'g', to: 'j' }, { from: 'g/#false', to: 'j' }]);
  assert.deepEqual(workflowFaults(w, kinds), ['a connection leaves "g", which is no output socket', 'a connection leaves "g/#false", which is no output socket']);
  assert.equal(kindNode(kinds, 'gate', 'g', []).branches, undefined);
  assert.deepEqual(nodeFlow(workflowGraph(w, {}, kinds), 'g').outgoing, []);
  // A Time sends its truth from its header, Out, and its rows by Pass and Fail (plan 971).
  assert.deepEqual(nodeFlow(workflowGraph(flow([node('t', 'time')], []), {}, kinds), 't').outgoing.map((o) => o.socket), ['Out', 'Pass', 'Fail']);
});

test('a test of one value has two ways: its value on its header, Pass and Fail send its Data on the way taken; the other is not taken', () => {
  const rows = resolveKind(NODE_KINDS.condition, 'gt').rows.filter((r) => ['pass', 'fail', 'data'].includes(r.name)).map((r) => ({ name: r.name, ...(r.input ? { input: r.input } : {}), ...(r.output ? { output: r.output, passes: r.passes } : {}) }));
  assert.deepEqual(rows, [
    { name: 'pass', output: 'object', passes: 'data' },
    { name: 'fail', output: 'object', passes: 'data' },
    { name: 'data', input: 'any' },
  ]);
  const ns = [node('s', 'source', { store: 'users' }), node('f', 'field', { field: 'age' }), node('c', 'condition', { type: 'gt', b: 30 }), node('m', 'math', { type: 'count' }), node('k', 'condition', { type: 'gt', b: 0 }), node('y', 'organise'), node('n', 'organise')];
  // The rows over 30 counted: ONE value on k's header (plan 971 §9).
  const cs = [{ from: 's/rows', to: 'f' }, { from: 'f/field', to: 'c' }, { from: 'c/pass', to: 'm/rows' }, { from: 'm/result', to: 'k' }, { from: 's/rows', to: 'k/data' }, { from: 'k/pass', to: 'y' }, { from: 'k/fail', to: 'n' }];
  assert.deepEqual(workflowFaults(flow(ns, cs)), []);
  const g = workflowGraph(flow(ns, cs));
  assert.deepEqual(nodeFlow(g, 'k').incoming.filter((i) => i.from.length).map((i) => [i.socket, i.from]), [['In', ['Math › Result']], ['Data', ['Source › Results']]]);
  assert.deepEqual(nodeFlow(g, 'k').outgoing.filter((o) => o.to.length).map((o) => [o.socket, o.to]), [['Pass', ['Organise']], ['Fail', ['Organise']]]);
  const users = [{ id: 1, age: 40 }, { id: 2, age: 20 }];
  const sim = simulateGraph(g, { users });
  assert.deepEqual(sim.nodes.m.outgoing.find((s) => s.label === 'Result').value, 1);
  const pass = sim.nodes.k.outgoing.find((s) => s.label === 'Pass');
  const fail = sim.nodes.k.outgoing.find((s) => s.label === 'Fail');
  assert.deepEqual([pass.rows, fail.note, fail.notTaken], [users, 'Not taken', true]);
  // What the untaken way feeds does not run.
  assert.deepEqual([sim.nodes.y.notTaken, sim.nodes.n.notTaken], [undefined, true]);
});
