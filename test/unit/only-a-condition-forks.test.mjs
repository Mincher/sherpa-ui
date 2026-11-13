/**
 * ONLY A CHECK BRANCHES — Will, plan 944 (D1 A): no node has a True or a False socket now. A Condition's True is a
 * property, 1 or 0, in every type, and an AI node's in its True/false type. The Check is the one node with two ways:
 * its Yes and its No send what reaches its Data on the way taken; the other way sends "Not taken". A check that is no
 * Condition (Time, Tag, a Preset, a Saved filter, a use of a Custom Node) still sends one boolean from its header, `Out`.
 *
 *   node --test test/unit/only-a-condition-forks.test.mjs
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

test('no kind branches, in any type, nor a Custom Node use; a Condition has a True row in every type, an AI node in True/false (plan 944)', () => {
  const each = Object.values(NODE_KINDS).flatMap((k) => Object.keys(k.types ?? { one: 1 }).map((t) => resolveKind(k, t)));
  assert.deepEqual(each.filter((k) => 'branches' in k).map((k) => k.heading), []);
  assert.equal('branches' in nodeKindOf({ v: 1, label: 'Mine', inputs: [], outputs: [], nodes: [] }), false);
  for (const type of Object.keys(NODE_KINDS.condition.types)) {
    const row = resolveKind(NODE_KINDS.condition, type).rows.find((r) => r.name === 'true');
    assert.deepEqual(row && { label: row.label, output: row.output, property: row.property }, { label: 'True', output: 'value', property: true }, type);
  }
  for (const id of ['prompt', 'runbook', 'skill']) {
    assert.deepEqual(Object.keys(NODE_KINDS[id].types).filter((t) => resolveKind(NODE_KINDS[id], t).rows.some((r) => r.name === 'true')), ['boolean'], id);
  }
});

test('a check that is no Condition sends a boolean from its header; a Condition, a Check and the rest send nothing from it; none has a False', () => {
  const sends = (id) => socketType(resolveKind(NODE_KINDS[id]), undefined, 'output');
  assert.deepEqual(Object.fromEntries(['condition', 'check', 'time', 'tag', 'preset', 'saved', 'source', 'value', 'field', 'math', 'organise', 'text'].map((id) => [id, sends(id)])), {
    condition: undefined, check: undefined, time: 'boolean', tag: 'boolean', preset: 'boolean', saved: 'boolean', source: undefined, value: undefined, field: undefined, math: undefined, organise: undefined, text: undefined,
  });
  for (const id of Object.keys(NODE_KINDS)) assert.equal(socketType(resolveKind(NODE_KINDS[id]), '#false', 'output'), undefined, `${id}: no False (plan 944)`);
});

test('a drawn node says it: none has `branches`; a connection from a Condition\'s header or a False is refused in words', () => {
  const g = workflowGraph(flow([node('s', 'source', { store: 'users' }), node('v', 'value'), node('m', 'math'), node('c', 'condition'), node('k', 'check'), node('t', 'time')], []));
  assert.deepEqual(g.nodes.filter((n) => 'branches' in n).map((n) => n.id), []);
  const into = (from) => workflowFaults(flow([node('s', 'source', { store: 'users' }), node('v', 'value'), node('m', 'math'), node('c', 'condition'), node('k', 'check'), node('j', 'condition', { type: 'and' })], [{ from, to: 'j' }]));
  for (const from of ['s', 'v/#false', 'm', 'c', 'c/#false', 'k', 'k/#false']) assert.deepEqual(into(from), [`a connection leaves "${from}", which is no output socket`], from);
  // A Condition's True, a Time's Out and a Check's Yes and No join And.
  assert.deepEqual(workflowFaults(flow([node('c', 'condition'), node('t', 'time'), node('k', 'check'), node('j', 'condition', { type: 'and' })],
    [{ from: 'c/true', to: 'j' }, { from: 't', to: 'j' }, { from: 'k/yes', to: 'j' }, { from: 'k/no', to: 'j' }])), []);
});

test('a kind that still says `branches: true` draws no True and no False: the option is gone (plan 944)', () => {
  const kinds = { ...NODE_KINDS, gate: { heading: 'Gate', icon: 'flag', input: 'any', branches: true, rows: [], model: 'gate', graphs: ['workflow'] } };
  const w = flow([node('g', 'gate'), node('j', 'condition', { type: 'and' })], [{ from: 'g', to: 'j' }, { from: 'g/#false', to: 'j' }]);
  assert.deepEqual(workflowFaults(w, kinds), ['a connection leaves "g", which is no output socket', 'a connection leaves "g/#false", which is no output socket']);
  assert.equal(kindNode(kinds, 'gate', 'g', []).branches, undefined);
  assert.deepEqual(nodeFlow(workflowGraph(w, {}, kinds), 'g').outgoing, []);
  assert.deepEqual(nodeFlow(workflowGraph(flow([node('t', 'time')], []), {}, kinds), 't').outgoing.map((o) => o.socket), ['Out']);
});

test('a Check is the one node with two ways: its test on its header, Yes and No send its Data on the way taken; the other is not taken', () => {
  const rows = NODE_KINDS.check.rows.map((r) => ({ name: r.name, label: r.label, ...(r.input ? { input: r.input } : {}), ...(r.output ? { output: r.output, passes: r.passes } : {}) }));
  assert.deepEqual(rows, [
    { name: 'data', label: 'Data', input: 'any' },
    { name: 'yes', label: 'Yes', output: 'object', passes: 'data' },
    { name: 'no', label: 'No', output: 'object', passes: 'data' },
  ]);
  assert.deepEqual([NODE_KINDS.check.heading, NODE_KINDS.check.icon, NODE_KINDS.check.category, NODE_KINDS.check.input], ['Check', 'diverging-arrows', 'Logic', 'any']);
  const ns = [node('s', 'source', { store: 'users' }), node('f', 'field', { field: 'age' }), node('c', 'condition', { type: 'gt', b: 30 }), node('k', 'check'), node('y', 'organise'), node('n', 'organise')];
  const cs = [{ from: 's/rows', to: 'f' }, { from: 'f/field', to: 'c' }, { from: 'c/true', to: 'k' }, { from: 's/rows', to: 'k/data' }, { from: 'k/yes', to: 'y' }, { from: 'k/no', to: 'n' }];
  assert.deepEqual(workflowFaults(flow(ns, cs)), []);
  const g = workflowGraph(flow(ns, cs));
  assert.deepEqual(nodeFlow(g, 'k').incoming.map((i) => [i.socket, i.from]), [['In', ['Condition › True']], ['Data', ['Source › Results']]]);
  assert.deepEqual(nodeFlow(g, 'k').outgoing.map((o) => [o.socket, o.to]), [['Yes', ['Organise']], ['No', ['Organise']]]);
  const users = [{ id: 1, age: 40 }, { id: 2, age: 20 }];
  const sim = simulateGraph(g, { users });
  assert.deepEqual(sim.nodes.c.outgoing.find((s) => s.label === 'True').value, 1);
  const [yes, no] = sim.nodes.k.outgoing;
  assert.deepEqual([yes.rows, no.note, no.notTaken], [users, 'Not taken', true]);
  // What the untaken way feeds does not run.
  assert.deepEqual([sim.nodes.y.notTaken, sim.nodes.n.notTaken], [undefined, true]);
});
