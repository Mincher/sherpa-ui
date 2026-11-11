/**
 * A CONDITION LISTS WHAT FITS (Will, TODO 940): what comes in on its header picks the Operations it lists. Values only (text,
 * a number), the operations that work on them; objects only (rows), those that work on data; a mixture, every one that fits
 * one of them, and an input the pick does not fit is IGNORED — dashed, and why in its tip (D2 A). Where no input fits the
 * pick, the pick stays, and the node warns (D1 A).
 *
 *   node --test test/unit/a-condition-lists-what-fits.test.mjs
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

const core = new URL('../../dist/core/data/', import.meta.url);
const { workflowFaults, workflowGraph } = await import(new URL('workflow.js', core));
const { simulateGraph } = await import(new URL('node-simulate.js', core));
const { nodeFlow } = await import(new URL('node-flow.js', core));

const N = (id, kind, values) => ({ id, kind, x: 0, y: 0, ...(values ? { values } : {}) });
const C = (from, to) => ({ from, to });
const flow = (nodes, connections) => ({ v: 3, id: 'fits', nodes, connections });
const source = N('s', 'source', { store: 'users' });
const value = (type, v) => N('v', 'value', { type, value: v });
const cond = (type) => N('c', 'condition', type ? { type } : undefined);
const drawn = (w) => workflowGraph(w).nodes.find((n) => n.id === 'c');
const listed = (w) => drawn(w).rows.find((r) => r.name === 'type').choices.map((c) => c.value);

const ALL = ['and', 'or', 'gt', 'gte', 'lt', 'lte', 'eq', 'ne', 'not', 'empty', 'contains', 'notcontains', 'startswith', 'endswith', 'in', 'notin', 'between', 'notbetween'];
const TEXT = ['and', 'or', 'eq', 'ne', 'empty', 'contains', 'notcontains', 'startswith', 'endswith', 'in', 'notin'];
const NUMBER = ['and', 'or', 'gt', 'gte', 'lt', 'lte', 'eq', 'ne', 'not', 'empty', 'in', 'notin', 'between', 'notbetween'];

test('values only: the operations that work on them, by type; data only: And, Or and Is empty; nothing in: every one', () => {
  assert.deepEqual(listed(flow([cond('or')], [])), ALL);
  assert.deepEqual(listed(flow([value('text', 'Pro'), cond('or')], [C('v/value', 'c')])), TEXT);
  assert.deepEqual(listed(flow([value('integer', '5'), cond('or')], [C('v/value', 'c')])), NUMBER);
  assert.deepEqual(listed(flow([value('date', '2026-01-01'), cond('or')], [C('v/value', 'c')])), ['and', 'or', 'gt', 'lt', 'eq', 'empty', 'in', 'notin', 'between']);
  assert.deepEqual(listed(flow([value('boolean', 'true'), cond('or')], [C('v/value', 'c')])), ['and', 'or', 'eq', 'ne', 'not', 'empty']);
  assert.deepEqual(listed(flow([source, cond('or')], [C('s/rows', 'c')])), ['and', 'or', 'empty']);
});

test('a mixture lists every operation one of them fits, in the list\'s own order', () => {
  const w = flow([source, value('integer', '5'), cond('or')], [C('v/value', 'c'), C('s/rows', 'c')]);
  assert.deepEqual(listed(w), NUMBER);
  assert.equal(drawn(w).ignored, undefined, 'Or fits every input');
});

test('D1: a pick no input fits stays, listed, and the node warns', () => {
  const w = flow([value('text', 'Pro'), cond('gt')], [C('v/value', 'c')]);
  assert.ok(listed(w).includes('gt'), 'the pick stays listed');
  assert.deepEqual(drawn(w).warnings, [{ words: 'Greater than takes a number or a date; it was given text' }]);
  assert.deepEqual(workflowFaults(w), [], 'a warning, never a fault');
});

test('D2: in a mixture, an input the pick does not fit is ignored — no warning; Simulate and the Incoming JSON skip it', () => {
  const rows = [{ id: 1 }, { id: 2 }];
  const w = flow([source, value('integer', '5'), cond('gt')], [C('v/value', 'c'), C('s/rows', 'c')]);
  const c = drawn(w);
  assert.deepEqual([c.ignored, c.warnings], [{ from: ['s/rows'], words: 'Ignored: Greater than takes a number or a date' }, undefined]);
  const g = workflowGraph(w);
  const heard = simulateGraph(g, { users: rows }).nodes.c.incoming.find((s) => s.socket === 'c');
  assert.deepEqual([heard.from, heard.rows], [['v/value'], undefined]);
  const incoming = nodeFlow(g, 'c').incoming[0];
  assert.deepEqual([incoming.ignored, incoming.why], [['Source › Results'], 'Ignored: Greater than takes a number or a date']);
});
