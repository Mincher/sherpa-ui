/**
 * Fetch and Simulate need a PATH: a chain of kept connections from a Source to an Output, through portals and through a use of
 * a Custom Node whose inside joins its Group Input to its Group Output; frames change nothing. Without one, the words say
 * which part is missing. Will, TODO 836 · docs/history/plan-836-data-through-nodes.md · TRAP T-a-simulation-reads-the-cache-and-writes-nothing
 *
 *   node --test test/unit/a-graph-has-a-path-from-a-source-to-an-output.test.mjs
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

const core = new URL('../../dist/core/data/', import.meta.url);
const { pathRead } = await import(new URL('node-paths.js', core));
const { workflowGraph } = await import(new URL('workflow.js', core));

const R = (from, to) => ({ from, to });
const N = (id, kind, values) => ({ id, kind, x: 0, y: 0, ...(values ? { values } : {}) });
const graphOf = (nodes, connections, more = {}) => workflowGraph({ v: 3, id: 'p', nodes, connections, ...more });

const SRC = N('s', 'source', { store: 'users' });
const FIELD = N('f', 'field', { field: 'status' });
const COND = N('c', 'condition', { type: 'eq', b: 'active' });
const OUT = N('o', 'output');

test('a Source joined to an Output is a path; its Source is named', () => {
  const g = graphOf([SRC, FIELD, COND, OUT], [R('s/rows', 'f'), R('f/field', 'c'), R('c/rows', 'o')]);
  assert.deepEqual(pathRead(g), { ok: true, sources: ['s'], unjoined: [] });
});

test('no Source, no Output, or no path: Fetch and Simulate say which', () => {
  assert.equal(pathRead(graphOf([OUT], [])).why, 'Add a Source first');
  assert.equal(pathRead(graphOf([SRC], [])).why, 'Add an Output first');
  const cut = pathRead(graphOf([SRC, FIELD, OUT], [R('s/rows', 'f')]));
  assert.equal(cut.ok, false);
  assert.equal(cut.why, 'Join a Source to an Output');
  assert.deepEqual(cut.unjoined, ['s']);
});

test('a connection cut in the middle breaks the path; a connection that only warns keeps it', () => {
  const nodes = [SRC, FIELD, COND, OUT];
  assert.equal(pathRead(graphOf(nodes, [R('s/rows', 'f'), R('c/rows', 'o')])).ok, false);
  // A Value into the Field's header reads null and warns, but the connection is kept.
  const warned = graphOf([SRC, N('v', 'value', { type: 'text', value: 'x' }), FIELD, OUT], [R('s/rows', 'f'), R('v/value', 'f'), R('f/field', 'o')]);
  assert.equal(pathRead(warned).ok, true);
});

test('two Sources: the one that reaches an Output is fetched, the other is left and named', () => {
  const lone = N('t', 'source', { store: 'devices' });
  const g = graphOf([SRC, lone, FIELD, OUT], [R('s/rows', 'f'), R('f/field', 'o')]);
  assert.deepEqual(pathRead(g), { ok: true, sources: ['s'], unjoined: ['t'] });
});

test('a path goes through a portal: an In and an Out of one name are joined, with no line between them', () => {
  const nodes = [SRC, N('in', 'portal', { type: 'in', name: 'rows' }), N('out', 'portal', { type: 'out', name: 'rows' }), OUT];
  const joined = graphOf(nodes, [R('s/rows', 'in'), R('out/@s/rows', 'o')]);
  assert.equal(pathRead(joined).ok, true);
  // Another name: the Out has no row from this Source, so it is no hop.
  const named = graphOf([SRC, N('in', 'portal', { type: 'in', name: 'rows' }), N('out', 'portal', { type: 'out', name: 'other' }), OUT], [R('s/rows', 'in'), R('out/@s/rows', 'o')]);
  assert.equal(pathRead(named).ok, false);
});

test('a path goes through a frame as through any node', () => {
  const g = graphOf([SRC, FIELD, OUT], [R('s/rows', 'f'), R('f/field', 'o')], { frames: [{ id: 'fr', nodes: ['f', 'o'] }] });
  assert.equal(pathRead(g).ok, true);
});

test('a use of a Custom Node is a hop only if its inside joins its Group Input to its Group Output', () => {
  const g = graphOf([SRC, OUT], []);
  const withUse = { ...g, nodes: [...g.nodes, { ...g.nodes[0], id: 'u', kind: 'custom', rows: [], category: undefined }], connections: [R('s/rows', 'u'), R('u', 'o')] };
  const inside = (joined) => ({ nodes: [{ id: '#in', rows: [] }, { id: '#out', rows: [] }], connections: joined ? [R('#in/x', '#out/y')] : [] });
  assert.equal(pathRead(withUse, { inner: (n) => (n.id === 'u' ? inside(true) : undefined) }).ok, true);
  assert.equal(pathRead(withUse, { inner: (n) => (n.id === 'u' ? inside(false) : undefined) }).ok, false);
  // With no word of its inside, a use is no hop.
  assert.equal(pathRead(withUse).ok, true, 'a use nothing draws is read as a plain node');
});
