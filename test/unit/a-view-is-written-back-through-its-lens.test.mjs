/**
 * A VIEW IS WRITTEN BACK THROUGH ITS LENS (plan 960 U4.6a): a View's graph is its page's Query with the View put on it,
 * and the graph written back is the View, its `query` as the Query holds it then. One writer, `statedQuery`, makes a
 * View's `query`: the graph's Save and the View chip's Save (`viewQueryOf`) write the same.
 *
 *   node --test test/unit/a-view-is-written-back-through-its-lens.test.mjs
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ArrayStore, NODE_KINDS, editWorkflow, lensOf, openSource, viewWithQuery } from '../../dist/data.js';
import { viewQueryOf } from '../../dist/core/browser/persist-view.js';

const page = {
  v: 1, id: 'deals',
  source: {
    store: 'deals', fields: { stage: { values: ['open', 'won', 'lost'] }, seats: { type: 'number' }, name: {} },
    scopes: { data: { label: 'Data', holds: ['stage'] } },
  },
};
const rows = Array.from({ length: 12 }, (_, i) => ({ id: i + 1, name: `D${i}`, stage: ['open', 'won', 'lost'][i % 3], seats: i * 5 }));
/** A View of the page: the big ones, the biggest first. */
const view = { label: 'Big ones', query: { v: 1, scopes: { data: { where: { seats: { gt: 10 } }, sort: [{ field: 'seats', direction: 'desc' }] } } } };

/** The page opened with a View put on it, as its View chip puts it. */
async function opened(on) {
  const source = await openSource(page.source, new ArrayStore(rows, { key: 'id' }));
  await source.load();
  await source.query.setQuery(on.query, { holds: 'keep' });
  await source.load();
  return source;
}

test('a View drawn and written back as it is puts the same Query on its page', async () => {
  const source = await opened(view);
  const facts = { query: source.query, page };
  const lens = lensOf('view');
  const { workflow } = lens.toGraph(view, facts);
  assert.ok(workflow.nodes.some((n) => n.id === 'when-data-seats'), 'its filter is drawn');
  const back = lens.fromGraph(view, workflow, facts);
  assert.equal(back.definition.label, 'Big ones');
  const again = await opened(back.definition);
  assert.deepEqual(again.query.draft, source.query.draft);
  assert.equal(again.total, source.total);
  source.close();
  again.close();
});

test('an edit to its filter, its sort and its search lands in the View\'s query, each typed by its field', async () => {
  const source = await opened(view);
  const facts = { query: source.query, page };
  const lens = lensOf('view');
  let graph = lens.toGraph(view, facts).workflow;
  for (const edit of [
    { node: 'when-data-seats', row: 'b', value: '20' },
    { node: 'organise-data', row: 'sort', value: 'name' },
    { node: 'organise-data', row: 'direction', value: 'asc' },
    { node: 'organise-data', row: 'search', value: 'D1' },
  ]) graph = editWorkflow(graph, edit, NODE_KINDS);
  const { definition } = lens.fromGraph(view, graph, facts);
  const data = definition.query.scopes.data;
  assert.deepEqual(data.where, { seats: { gt: 20 } });
  assert.deepEqual(data.sort, [{ field: 'name', direction: 'asc' }]);
  assert.equal(data.search, 'D1');
  // What it says is what a page opened on it shows: the same rows, and the same View written from it again.
  const again = await opened(definition);
  assert.equal(again.total, source.total);
  assert.deepEqual(lens.fromGraph(definition, lens.toGraph(definition, { query: again.query, page }).workflow, { query: again.query, page }).definition, definition);
  source.close();
  again.close();
});

test('the graph\'s Save and the View chip\'s Save write one query', async () => {
  const source = await opened(view);
  const type = (field) => page.source.fields[field]?.type;
  assert.deepEqual(viewWithQuery(view, source.query.applied, { type }).query, viewQueryOf(source));
  source.close();
});

test('a View is drawn on its page: without it, the lens says so', async () => {
  const source = await opened(view);
  assert.throws(() => lensOf('view').toGraph(view, { query: source.query }), /A View is drawn on its page/);
  source.close();
});
