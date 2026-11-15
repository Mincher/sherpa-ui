/**
 * AN AGENT READS THE KINDS — Will, TODO 1005: an agent's words for a node are said once, by its kind, and one library function
 * gives every agent the graph rules from them, as graphText gives the reading. N-zo's prompt and the library's MCP
 * (`sherpa://graph-rules`) both read `graphRules`. TRAP T-an-agent-reads-the-kinds
 *
 *   node --test test/unit/an-agent-reads-the-kinds.test.mjs
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

const core = new URL('../../dist/core/data/', import.meta.url);
const { NODE_KINDS, graphRules } = await import(new URL('node-kinds.js', core));

test('every kind a workflow draws says how an agent joins it', () => {
  const silent = Object.entries(NODE_KINDS).filter(([, k]) => k.graphs.includes('workflow') && !k.agent?.trim()).map(([id]) => id);
  assert.deepEqual(silent, [], 'a new kind says its words, once, by its kind');
});

test('the rules are made from the kinds: each workflow kind with its words and its types, a type\'s own words, no Query-only kind', () => {
  const text = graphRules();
  for (const [id, k] of Object.entries(NODE_KINDS).filter(([, k]) => k.graphs.includes('workflow'))) {
    assert.ok(text.includes(`(kind "${id}"): ${k.agent}`), id);
  }
  assert.ok(text.includes(`Its types (values.type): "and", "or"`));
  assert.ok(text.includes(`- Contains ("contains"): It has no Value A`));
  assert.ok(text.includes(`- Count ("count"): Rows into "<math>/rows"`));
  assert.ok(!text.includes('(kind "view-filters")'), 'a Query-only kind is no agent\'s to wire');
  assert.ok(!text.includes('"all"'), 'nor a Query-only type');
});

test('an app\'s kind reaches every agent: with its own words, else its line', () => {
  const ticket = { heading: 'Ticket', icon: 'ticket', description: 'Open a ticket for each row', rows: [], model: 'ticket', graphs: ['workflow'], category: 'Output' };
  assert.ok(graphRules({ ...NODE_KINDS, ticket }).includes('- Ticket (kind "ticket"): Open a ticket for each row'));
  assert.ok(graphRules({ ...NODE_KINDS, ticket: { ...ticket, agent: 'Rows into its header; one ticket a row.' } }).includes('- Ticket (kind "ticket"): Rows into its header; one ticket a row.'));
});
