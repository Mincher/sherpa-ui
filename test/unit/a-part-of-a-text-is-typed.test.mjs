/**
 * A PART OF A TEXT IS TYPED — TODO 1002 (Will, 2026-11-14: "For 'Contains' conditions we don't need Value A. Value B can
 * become Value A. It shouldn't show any options unless values are connected to it, via a values output, or entered into
 * the field manually."). Contains, Does not contain, Starts with and Ends with test their header, the data, always: no
 * Value A of 994 (a line into one is another type's, kept and drawn nowhere). Their one value row is titled Value A:
 * text, typed or joined, never a pick of the field's values.
 * TRAP T-a-part-of-a-text-is-typed
 *
 *   node --test test/unit/a-part-of-a-text-is-typed.test.mjs
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { workflowFaults, workflowGraph } from '../../dist/data.js';
import { NODE_KINDS, resolveKind } from '../../dist/core/data/node-kinds.js';
import { simulateGraph } from '../../dist/core/data/node-simulate.js';

const PART = ['contains', 'notcontains', 'startswith', 'endswith'];
const fieldsOf = { users: { status: { label: 'Status', values: ['active', 'inactive', 'trial'] } } };
const rows = [{ id: 1, status: 'active' }, { id: 2, status: 'inactive' }, { id: 3, status: 'trial' }];
const N = (id, kind, values) => ({ id, kind, x: 0, y: 0, ...(values ? { values } : {}) });
const C = (from, to) => ({ from, to });
const flow = (type, b, more = [], wires = []) => ({
  v: 3, id: 'part',
  nodes: [N('s', 'source', { store: 'users' }), N('f', 'field', { field: 'status' }), N('c', 'condition', { type, ...(b === undefined ? {} : { b }) }), ...more],
  connections: [C('s/rows', 'f'), C('f/field', 'c'), ...wires],
});

test('each text match has Pass, Fail and one value row, titled Value A: text, no Value A of 994', () => {
  for (const op of PART) {
    const kind = resolveKind(NODE_KINDS.condition, op);
    assert.deepEqual(kind.rows.map((r) => [r.name, r.label, r.control, r.ofField]), [
      ['type', 'Check', 'type', undefined], ['pass', 'Pass', undefined, undefined], ['fail', 'Fail', undefined, undefined], ['b', 'Value A', 'text', undefined],
    ], op);
    assert.match(NODE_KINDS.condition.types[op].help, /Value A$/, op);
  }
  // Equals keeps its Value A (994) and its Value B, a pick of the field's values.
  assert.deepEqual(resolveKind(NODE_KINDS.condition, 'eq').rows.map((r) => r.name), ['type', 'pass', 'fail', 'a', 'b']);
});

test('drawn, a Contains offers no choices of the field\'s values, where Equals does; a 994 `a` on it is kept for Equals, drawn nowhere', () => {
  const b = (type, value) => workflowGraph(flow(type, value), { fieldsOf }).nodes.find((n) => n.id === 'c').rows.find((r) => r.name === 'b');
  assert.deepEqual([b('contains', 'act').control, b('contains', 'act').choices, b('eq', 'active').choices.map((c) => c.value)], ['text', undefined, ['active', 'inactive', 'trial']]);
  // A line into Value A is another type's: kept, as switching back to Equals brings it back (off is not gone), and drawn
  // nowhere; the run tests the header.
  const old = flow('contains', 'act', [N('v', 'value', { value: 'x' })], [C('v/value', 'c/a')]);
  const drawn = workflowGraph(old, { fieldsOf });
  assert.deepEqual([workflowFaults(old, NODE_KINDS, { fieldsOf }), drawn.connections.some((c) => c.to === 'c/a')], [[], false]);
  assert.deepEqual(simulateGraph(drawn, { users: rows }).nodes.c.outgoing.find((s) => s.socket === 'c/pass').rows.map((r) => r.id), [1, 2]);
});

test('a run: what comes in is tested against Value A, typed or joined', () => {
  const pass = (w) => simulateGraph(workflowGraph(w, { fieldsOf }), { users: rows }).nodes.c.outgoing.find((s) => s.socket === 'c/pass').rows.map((r) => r.id);
  assert.deepEqual([pass(flow('contains', 'act')), pass(flow('startswith', 'in')), pass(flow('endswith', 'al')), pass(flow('notcontains', 'act'))], [[1, 2], [2], [3], [3]]);
  // Joined: a Value sends it, and the row reads it.
  assert.deepEqual(pass(flow('contains', undefined, [N('v', 'value', { value: 'tri' })], [C('v/value', 'c/b')])), [3]);
});
