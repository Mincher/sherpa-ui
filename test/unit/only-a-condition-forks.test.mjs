/**
 * ONLY A CONDITION FORKS — Will, 2026-11-06 (TODO 831): "not all nodes need a true/false socket. At this stage it's
 * probably just Condition nodes. Don't completely remove the ability for other nodes to support this. Just hide
 * them for now." `branches` stays a kind option: on for Condition alone, so it alone draws True on its header and a
 * False footer; any other kind draws none and can opt in again. A check that is no Condition (Time, Tag, a Preset,
 * a Saved filter, a use of a Custom Node) sends one boolean from its header, as `Out`, with no False.
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

const node = (id, kind, values) => ({ id, kind, x: 0, y: 0, ...(values ? { values } : {}) });
const flow = (nodes, routes) => ({ v: 2, id: 'w', nodes, routes });

test('Condition alone forks, in every type; every other shipped kind, type and Custom Node use does not', () => {
  const forks = Object.entries(NODE_KINDS).filter(([id, k]) => Object.keys(k.types ?? { one: 1 }).some((t) => resolveKind(k, t).branches)).map(([id]) => id);
  assert.deepEqual(forks, ['condition']);
  for (const type of Object.keys(NODE_KINDS.condition.types)) assert.equal(resolveKind(NODE_KINDS.condition, type).branches, true, type);
  assert.equal(nodeKindOf({ v: 1, label: 'Mine', inputs: [], outputs: [], nodes: [] }).branches, undefined);
});

test('a check sends a boolean from its header and no False; the rest send nothing from it', () => {
  const sends = (id) => socketType(resolveKind(NODE_KINDS[id]), undefined, 'output');
  assert.deepEqual(Object.fromEntries(['condition', 'time', 'tag', 'preset', 'saved', 'source', 'value', 'field', 'math', 'collection', 'text'].map((id) => [id, sends(id)])), {
    condition: 'boolean', time: 'boolean', tag: 'boolean', preset: 'boolean', saved: 'boolean', source: undefined, value: undefined, field: undefined, math: undefined, collection: undefined, text: undefined,
  });
  for (const id of Object.keys(NODE_KINDS)) assert.equal(socketType(resolveKind(NODE_KINDS[id]), '#false', 'output'), id === 'condition' ? 'boolean' : undefined, `${id}: its False`);
});

test('a drawn node says it: only a Condition has `branches`; a True or a False route from another is refused in words', () => {
  const g = workflowGraph(flow([node('s', 'source', { store: 'users' }), node('v', 'value'), node('m', 'math'), node('c', 'condition'), node('t', 'time')], []));
  assert.deepEqual(g.nodes.filter((n) => n.branches).map((n) => n.id), ['c']);
  for (const [from, words] of [['s', 'a route leaves "s", which is no output socket'], ['v/#false', 'a route leaves "v/#false", which is no output socket'], ['m', 'a route leaves "m", which is no output socket']]) {
    assert.deepEqual(workflowFaults(flow([node('s', 'source', { store: 'users' }), node('v', 'value'), node('m', 'math'), node('c', 'condition')], [{ from, to: 'c' }])), [words], from);
  }
  // A Condition's True and False, and a Time's Out, join And as booleans.
  assert.deepEqual(workflowFaults(flow([node('c', 'condition'), node('t', 'time'), node('j', 'condition', { type: 'and' })], [{ from: 'c', to: 'j' }, { from: 'c/#false', to: 'j' }, { from: 't', to: 'j' }])), []);
});

test('any kind can opt in again: `branches: true` draws True and False, routes both, and says them', () => {
  const kinds = { ...NODE_KINDS, gate: { heading: 'Gate', icon: 'flag', input: 'any', branches: true, rows: [], model: 'gate', graphs: ['workflow'] } };
  const w = flow([node('g', 'gate'), node('j', 'condition', { type: 'and' })], [{ from: 'g', to: 'j' }, { from: 'g/#false', to: 'j' }]);
  assert.deepEqual(workflowFaults(w, kinds), []);
  assert.equal(kindNode(kinds, 'gate', 'g', []).branches, true);
  const drawn = workflowGraph(w, {}, kinds);
  assert.deepEqual(nodeFlow(drawn, 'g').outgoing.map((o) => o.socket), ['True', 'False']);
  assert.deepEqual(nodeFlow(workflowGraph(flow([node('t', 'time')], []), {}, kinds), 't').outgoing.map((o) => o.socket), ['Out']);
});
