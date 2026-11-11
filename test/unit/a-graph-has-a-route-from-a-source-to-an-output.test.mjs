/**
 * Fetch and Simulate need a ROUTE: a full path along kept Connections from a Source (a Start node) to an Output (an End node), through portals and through a use of
 * a Custom Node whose inside joins its Group Input to its Group Output; frames change nothing. Without one, the words say
 * which part is missing. Will, TODO 836; plan 934 · TRAP T-a-route-is-start-to-end · docs/history/plan-836-data-through-nodes.md · TRAP T-a-simulation-reads-the-cache-and-writes-nothing
 *
 *   node --test test/unit/a-graph-has-a-route-from-a-source-to-an-output.test.mjs
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

const core = new URL('../../dist/core/data/', import.meta.url);
const { branchesAt, routeRead, routesOf } = await import(new URL('node-routes.js', core));
const { workflowGraph } = await import(new URL('workflow.js', core));

const R = (from, to) => ({ from, to });
const N = (id, kind, values) => ({ id, kind, x: 0, y: 0, ...(values ? { values } : {}) });
const graphOf = (nodes, connections, more = {}) => workflowGraph({ v: 3, id: 'p', nodes, connections, ...more });

const SRC = N('s', 'source', { store: 'users' });
const FIELD = N('f', 'field', { field: 'status' });
const COND = N('c', 'condition', { type: 'eq', b: 'active' });
const OUT = N('o', 'output');

test('a Source joined to an Output is a Route; its Source is named', () => {
  const g = graphOf([SRC, FIELD, COND, OUT], [R('s/rows', 'f'), R('f/field', 'c'), R('c/rows', 'o')]);
  assert.deepEqual(routeRead(g), { ok: true, sources: ['s'], unjoined: [] });
});

test('no Source, no Output, or no Route: Fetch and Simulate say which', () => {
  assert.equal(routeRead(graphOf([OUT], [])).why, 'Add a Source first');
  assert.equal(routeRead(graphOf([SRC], [])).why, 'Add an Output first');
  const cut = routeRead(graphOf([SRC, FIELD, OUT], [R('s/rows', 'f')]));
  assert.equal(cut.ok, false);
  assert.equal(cut.why, 'Join a Source to an Output');
  assert.deepEqual(cut.unjoined, ['s']);
});

test('a connection cut in the middle breaks the Route; a connection that only warns keeps it', () => {
  const nodes = [SRC, FIELD, COND, OUT];
  assert.equal(routeRead(graphOf(nodes, [R('s/rows', 'f'), R('c/rows', 'o')])).ok, false);
  // A Value into the Field's header reads null and warns, but the connection is kept.
  const warned = graphOf([SRC, N('v', 'value', { type: 'text', value: 'x' }), FIELD, OUT], [R('s/rows', 'f'), R('v/value', 'f'), R('f/field', 'o')]);
  assert.equal(routeRead(warned).ok, true);
});

test('two Sources: the one that reaches an Output is fetched, the other is left and named', () => {
  const lone = N('t', 'source', { store: 'devices' });
  const g = graphOf([SRC, lone, FIELD, OUT], [R('s/rows', 'f'), R('f/field', 'o')]);
  assert.deepEqual(routeRead(g), { ok: true, sources: ['s'], unjoined: ['t'] });
});

test('a Route goes through a portal: an In and an Out of one name are joined, with no line between them', () => {
  const nodes = [SRC, N('in', 'portal', { type: 'in', name: 'rows' }), N('out', 'portal', { type: 'out', name: 'rows' }), OUT];
  const joined = graphOf(nodes, [R('s/rows', 'in'), R('out/@s/rows', 'o')]);
  assert.equal(routeRead(joined).ok, true);
  // Another name: the Out has no row from this Source, so it is no hop.
  const named = graphOf([SRC, N('in', 'portal', { type: 'in', name: 'rows' }), N('out', 'portal', { type: 'out', name: 'other' }), OUT], [R('s/rows', 'in'), R('out/@s/rows', 'o')]);
  assert.equal(routeRead(named).ok, false);
});

test('a Route goes through a frame as through any node', () => {
  const g = graphOf([SRC, FIELD, OUT], [R('s/rows', 'f'), R('f/field', 'o')], { frames: [{ id: 'fr', nodes: ['f', 'o'] }] });
  assert.equal(routeRead(g).ok, true);
});

test('a use of a Custom Node is a hop only if its inside joins its Group Input to its Group Output', () => {
  const g = graphOf([SRC, OUT], []);
  const withUse = { ...g, nodes: [...g.nodes, { ...g.nodes[0], id: 'u', kind: 'custom', rows: [], category: undefined }], connections: [R('s/rows', 'u'), R('u', 'o')] };
  const inside = (joined) => ({ nodes: [{ id: '#in', rows: [] }, { id: '#out', rows: [] }], connections: joined ? [R('#in/x', '#out/y')] : [] });
  assert.equal(routeRead(withUse, { inner: (n) => (n.id === 'u' ? inside(true) : undefined) }).ok, true);
  assert.equal(routeRead(withUse, { inner: (n) => (n.id === 'u' ? inside(false) : undefined) }).ok, false);
  // With no word of its inside, a use is no hop.
  assert.equal(routeRead(withUse).ok, true, 'a use nothing draws is read as a plain node');
});

test('routesOf lists each Route, Start node to End node; a Value or a Field fed in starts none (plan 934)', () => {
  const VAL = N('v', 'value', { type: 'text', value: 'active' });
  const g = graphOf([SRC, FIELD, VAL, COND, OUT], [R('s/rows', 'f'), R('f/field', 'c'), R('v/value', 'c/b'), R('c/rows', 'o')]);
  assert.deepEqual(routesOf(g), [['s', 'f', 'c', 'o']]);
  assert.deepEqual(routesOf(graphOf([SRC, FIELD, OUT], [R('s/rows', 'f')])), [], 'no End node reached, no Route');
});

test('branchesAt names where Routes part: the Routes through a node, by the node each goes to next (plan 934)', () => {
  const OUT2 = N('o2', 'output');
  const g = graphOf([SRC, FIELD, COND, OUT, OUT2], [R('s/rows', 'f'), R('f/field', 'c'), R('c/rows', 'o'), R('c/rows', 'o2')]);
  assert.deepEqual(routesOf(g), [['s', 'f', 'c', 'o'], ['s', 'f', 'c', 'o2']]);
  assert.deepEqual(branchesAt(g, 'c'), [{ to: 'o', routes: [['s', 'f', 'c', 'o']] }, { to: 'o2', routes: [['s', 'f', 'c', 'o2']] }]);
  assert.deepEqual(branchesAt(g, 'f'), [], 'one way on: no Branch');
});
