/**
 * AN OUTPUT ONLY SAYS WHAT IT WOULD DO: Simulate never fires one. Its light says what it would do, and the rows that reach
 * it; each property sends a stand-in, so the nodes it feeds run too. Plan 891, step 3.
 *
 *   node --test test/unit/an-output-only-says-what-it-would-do.test.mjs
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

const core = new URL('../../dist/core/data/', import.meta.url);
const { lightOf, simulateGraph } = await import(new URL('node-simulate.js', core));
const { workflowGraph } = await import(new URL('workflow.js', core));

const rows = { users: [{ id: 1 }, { id: 2 }, { id: 3 }] };
const flow = {
  v: 3, id: 'w',
  nodes: [
    { id: 's', kind: 'source', x: 0, y: 0, values: { store: 'users' } },
    { id: 'o', kind: 'output', x: 400, y: 0, values: { type: 'notification', message: 'Hi' } },
    { id: 'r', kind: 'output', x: 800, y: 0, values: { type: 'result', status: 'succeeded' } },
    { id: 'end', kind: 'output', x: 800, y: 300 },
  ],
  connections: [{ from: 's/rows', to: 'o' }, { from: 'o/message-id', to: 'r/summary' }, { from: 's/rows', to: 'end' }],
};

test('an Output\'s light says what it would do and the rows that reach it; it fires nothing', () => {
  const ran = simulateGraph(workflowGraph(flow), rows);
  assert.equal(ran.nodes.o.would, 'Would send a notification');
  assert.equal(lightOf(ran.nodes.o, 2), 'Would send a notification · 3 rows · 2 ms');
  // An Output kept with no type is a Run result, as it was: its rows still said.
  assert.equal(lightOf(ran.nodes.end, 0.5), 'Would end the run · 3 rows · <1 ms');
  assert.ok(!ran.faults.some((f) => /not simulated/.test(f)), ran.faults.join('; '));
});

test('each property sends a stand-in, so what it feeds runs too', () => {
  const ran = simulateGraph(workflowGraph(flow), rows);
  const out = (id, socket) => ran.nodes[id].outgoing.find((s) => s.socket === socket);
  assert.equal(out('o', 'o/sent').value, true);
  assert.equal(out('o', 'o/message-id').value, 'Message ID, simulated');
  assert.equal(ran.nodes.r.incoming.find((s) => s.socket === 'r/summary').value, 'Message ID, simulated');
});
