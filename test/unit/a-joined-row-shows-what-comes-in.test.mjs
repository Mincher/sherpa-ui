/**
 * A JOINED ROW SHOWS WHAT COMES IN, READ ONLY — Will, TODO 990: "text output from a node should be shown in the text
 * input/area of the row it is connected to. These inputs/areas are then read only while connected to the incoming
 * value." Before a run it shows nothing and says where its value comes from; after a Simulate, the text that came in
 * (`facts.heard`). Its own words wait in the draft: cut the line, and they are back. TRAP T-a-joined-row-shows-what-comes-in
 *
 *   node --test test/unit/a-joined-row-shows-what-comes-in.test.mjs
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

const core = new URL('../../dist/core/data/', import.meta.url);
const { editWorkflow, workflowGraph } = await import(new URL('workflow.js', core));

const def = {
  v: 3, id: 'comms',
  nodes: [
    { id: 'ask', kind: 'prompt', x: 0, y: 0, values: { type: 'text', prompt: 'Write the customer a note' } },
    { id: 'n', kind: 'notify', x: 400, y: 0, values: { type: 'notification', message: 'My own words' } },
  ],
  connections: [{ from: 'ask/answer', to: 'n/message' }],
};
const message = (graph, facts) => workflowGraph(graph, facts).nodes.find((n) => n.id === 'n').rows.find((r) => r.name === 'message');

test('joined, before a run: it shows nothing, never its own words, and says where its value comes from', () => {
  const row = message(def);
  assert.deepEqual([row.value, row.custom, row.hint], [undefined, true, 'From Prompt › Answer']);
  assert.equal(def.nodes[1].values.message, 'My own words', 'the draft keeps them');
});

test('after a Simulate: the text that came in', () => {
  const row = message(def, { heard: { 'n/message': 'Your patch window moved to Friday.' } });
  assert.equal(row.value, 'Your patch window moved to Friday.');
});

test('cut, its own words are back, and what a run heard there is not shown', () => {
  const cut = editWorkflow(def, { cut: 'n/message' });
  const row = message(cut, { heard: { 'n/message': 'Your patch window moved to Friday.' } });
  assert.deepEqual([row.value, row.custom], ['My own words', undefined]);
});
