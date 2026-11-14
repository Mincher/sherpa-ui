/**
 * A CATEGORY IS A COLUMN THE MODEL MAKES — plan 992 O6 A (Will, 2026-11-14: Classify is a Prompt answer type, Category; a
 * Fork sends the rows on by it). An AI node that Expects a Category picks its Categories; its Answer is a column on each
 * row, one of them, so a Fork's Ways pick from them. No Classify node, and no second router.
 * TRAP T-a-category-is-a-column-the-model-makes
 *
 *   node --test test/unit/a-category-is-a-column-the-model-makes.test.mjs
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { graphText, workflowFaults, workflowGraph } from '../../dist/data.js';
import { NODE_KINDS, resolveKind } from '../../dist/core/data/node-kinds.js';
import { simulateGraph } from '../../dist/core/data/node-simulate.js';

const fieldsOf = { tickets: { subject: { label: 'Subject' } } };
const tickets = [1, 2, 3, 4, 5].map((id) => ({ id, subject: `Ticket ${id}` }));
const N = (id, kind, values) => ({ id, kind, x: 0, y: 0, ...(values ? { values } : {}) });
const C = (from, to) => ({ from, to });
/** Tickets into a Prompt that Expects a Category, its Answer into a Fork of two Ways. */
const flow = (categories = ['Patch', 'Access', 'Hardware']) => ({
  v: 3, id: 'classify',
  nodes: [
    N('s', 'source', { store: 'tickets' }), N('m', 'model', { provider: 'anthropic', model: 'sonnet' }),
    { ...N('q', 'prompt', { type: 'category', prompt: 'What does the ticket ask for?', categories }), heading: 'Kind of ask' },
    N('f', 'fork', { ways: ['Patch', 'Access'] }), N('a', 'result'), N('b', 'result'), N('o', 'result'),
  ],
  connections: [C('s/rows', 'q'), C('m/model', 'q/model'), C('q/answer', 'f'), C('f/v-patch', 'a'), C('f/v-access', 'b'), C('f/otherwise', 'o')],
});

test('each AI node Expects a Category: its Categories, then an Answer that is a column it makes', () => {
  for (const id of ['prompt', 'runbook', 'skill']) {
    const kind = resolveKind(NODE_KINDS[id], 'category');
    const [categories, answer] = kind.rows.slice(-2);
    assert.deepEqual([NODE_KINDS[id].types.category.label, categories.name, categories.control, categories.multiple], ['Category', 'categories', 'tags', true], id);
    assert.deepEqual([answer.name, answer.output, answer.gives, answer.makes, answer.property], ['answer', 'object', 'field', 'categories', true], id);
  }
});

test('the text lens says the Categories an AI node answers by', () => {
  assert.match(graphText(flow()).stages.join('\n'), /Kind of ask: ask "What does the ticket ask for\?"; for each row, one of Patch, Access, Hardware\./);
});

test('a Fork after a Category answer picks its Ways from the Categories; nothing warns', () => {
  const w = flow();
  const f = workflowGraph(w, { fieldsOf }).nodes.find((n) => n.id === 'f');
  assert.deepEqual(f.rows.find((r) => r.name === 'ways').choices.map((c) => c.value), ['Patch', 'Access', 'Hardware']);
  assert.deepEqual([workflowFaults(w, NODE_KINDS, { fieldsOf }), f.warnings], [[], undefined]);
});

test('Simulate: each row takes a Category in turn, so each way after it runs; none picked says so', () => {
  const sim = simulateGraph(workflowGraph(flow(), { fieldsOf }), { tickets });
  const ids = (socket) => sim.nodes.f.outgoing.find((s) => s.socket === `f/${socket}`).rows.map((r) => r.id);
  assert.deepEqual([ids('v-patch'), ids('v-access'), ids('otherwise')], [[1, 4], [2, 5], [3]]);
  const none = simulateGraph(workflowGraph(flow([]), { fieldsOf }), { tickets });
  assert.equal(none.nodes.q.outgoing.find((s) => s.socket === 'q/answer').note, 'No Categories picked');
});
