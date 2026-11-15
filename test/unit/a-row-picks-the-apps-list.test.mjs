/**
 * A ROW PICKS THE APP'S LIST — plan 986, Part 3 (986c; Will, 2026-11-14: "check all node input rows across all nodes to make
 * sure their options, or input type, makes sense"). A row may name a list (`control: 'list'`, `of`), and the app gives its
 * lists in the editor's facts (`lists`), as it gives `stores` and the shelf's entities. Content › On a view names `views`.
 * TRAP T-a-row-takes-its-values-type
 *
 *   node --test test/unit/a-row-picks-the-apps-list.test.mjs
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

const core = new URL('../../dist/core/data/', import.meta.url);
const { NODE_KINDS, resolveKind } = await import(new URL('node-kinds.js', core));
const { workflowGraph } = await import(new URL('workflow.js', core));

const flow = (values) => ({ v: 3, id: 'g', nodes: [{ id: 'c', kind: 'content', x: 0, y: 0, values: { type: 'view', ...values } }], connections: [] });
const viewRow = (facts, values = {}) => workflowGraph(flow(values), facts).nodes.find((n) => n.id === 'c').rows.find((r) => r.name === 'view');

test('On a view picks one of the app\'s Views: a word or a value and its words, "Pick one" while none is picked', () => {
  const lists = { views: ['Overview', { value: 'risk', label: 'At risk' }] };
  const row = viewRow({ lists });
  assert.deepEqual(row.choices.map((c) => [c.value, c.label]), [['', 'Pick one'], ['Overview', 'Overview'], ['risk', 'At risk']]);
  assert.deepEqual(viewRow({ lists }, { view: 'risk' }).choices.map((c) => c.value), ['Overview', 'risk'], 'picked, no Pick one');
});

test('a list the app does not give leaves the row text, its value kept', () => {
  const row = viewRow({}, { view: 'Overview' });
  assert.deepEqual([row.control, row.value, row.choices], ['text', 'Overview', undefined]);
});

test('every row that names a list says which (`of`)', () => {
  const rows = Object.values(NODE_KINDS).flatMap((k) => [k, ...Object.keys(k.types ?? {}).map((t) => resolveKind(k, t))]).flatMap((k) => k.rows);
  const lists = rows.filter((r) => r.control === 'list');
  assert.ok(lists.length >= 1);
  assert.deepEqual(lists.filter((r) => !r.of).map((r) => r.name), []);
});
