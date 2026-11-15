/**
 * A page's QUERY is a DOCUMENT the one node editor reads and writes (plan 885). Read: its derived graph as a v2 definition,
 * with the layout a reader gave it. Written: a RECONCILE — a row's new value, a new connection and a new node are the Query's own
 * requests (a chip's door); the layout (its places, in the one place set, and its ties, frames and stages) never reaches the Query; a cut connection or a
 * removed reading is refused, in words. Draw, edit, reconcile, ask, draw again: the edit is there. Will, 2026-11-10
 *
 *   node --test test/unit/a-query-is-a-document.test.mjs
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

const core = new URL('../../dist/core/data/', import.meta.url);
const { queryLensGraph } = await import(new URL('query-graph.js', core));
const { queryGraph } = await import(new URL('query-lens.js', core));
const { queryDefinition, reconcileQuery, rowRequest, layoutOf, laidOut, isGraphLayout } = await import(new URL('query-document.js', core));
const { ArrayStore } = await import(new URL('stores.js', core));
const { openSource } = await import(new URL('page-definition.js', core));
const { NODE_KINDS } = await import(new URL('node-kinds.js', core));
const { editWorkflow } = await import(new URL('workflow.js', core));
const { LANES_BY_FAMILY } = await import(new URL('node-lanes.js', core));

const page = {
  v: 1, id: 'records',
  source: {
    store: 'customers', pageSize: 25,
    fields: { seats: { label: 'Seats', type: 'number' }, plan: { label: 'Plan' } },
    scopes: { view: { label: 'View', holds: ['seats'], where: { seats: { or: [{ lt: 5 }, { gt: 5, lt: 100 }] } } } },
  },
};
const rows = [{ id: 1, plan: 'Pro', seats: 120 }, { id: 2, plan: 'Free', seats: 4 }];

const opened = async () => {
  const source = await openSource(page.source, new ArrayStore(rows, { key: 'id' }));
  const facts = { type: (f) => page.source.fields[f]?.type };
  const q = source.query;
  const place = { holds: (s) => q.scope(s), fields: () => Object.keys(page.source.fields), presets: (s) => q.presets(s), on: (s, id) => q.presetOn(s, id), kept: [], store: 'customers' };
  let layout = {};
  const graph = () => laidOut(queryGraph(q.draft, page, facts), layout);
  const read = () => queryDefinition('records', queryLensGraph(q.draft, page, facts), layout);
  /** Write a definition: reconcile it, ask each request, keep the layout. What it refused comes back. */
  const write = (next) => {
    const done = reconcileQuery(read(), next, graph(), { ...facts, place, kept: [] });
    // As the document does: each row against the Query as the last one left it.
    for (const row of done.edits) {
      const asked = rowRequest(graph(), row, { ...facts, kept: [] });
      if (asked?.request) q.ask(asked.request);
    }
    for (const request of done.requests) q.ask(request);
    layout = done.layout;
    return done;
  };
  return { q, read, write, layout: () => layout };
};
const values = (def, id) => def.nodes.find((n) => n.id === id)?.values;

test('read: the Query\'s nodes and connections, each node\'s rows as its values', async () => {
  const { read } = await opened();
  const def = read();
  assert.equal(def.v, 3);
  assert.deepEqual(values(def, 'when-view-seats.1'), { type: 'lt', b: 5 });
  // The root's Pass goes into its chip on View Filters (plans 960 U4.8, 971 §9).
  assert.ok(def.connections.some((r) => r.from === 'when-view-seats/pass' && r.to === 'view-filters/seats'));
});

test('a row\'s new value is the Query\'s request, and reads back', async () => {
  const { read, write, q } = await opened();
  const done = write(editWorkflow(read(), { node: 'when-view-seats.1', row: 'b', value: '7' }, NODE_KINDS));
  assert.deepEqual(done.edits, [{ node: 'when-view-seats.1', row: 'b', value: '7' }]);
  assert.deepEqual(done.refused, []);
  assert.deepEqual(values(read(), 'when-view-seats.1'), { type: 'lt', b: 7 });
  assert.equal(q.draft.scopes.view.readings.seats.tree.or[0].value, 7);
});

test('the layout never reaches the Query: a move, a tie, a frame, stages and lanes are kept beside it and read back', async () => {
  const { read, write, q } = await opened();
  const was = JSON.stringify(q.draft);
  let def = editWorkflow(read(), { node: 'field-view-seats', set: { x: 999, y: 444 } }, NODE_KINDS);
  def = editWorkflow(def, { tie: { connections: def.connections.slice(0, 2), x: 300, y: 100 } }, NODE_KINDS);
  def = editWorkflow(def, { frame: { nodes: ['when-view-seats.1', 'when-view-seats.2'] } }, NODE_KINDS);
  def = editWorkflow(def, { addStage: { label: 'Decide' } }, NODE_KINDS);
  def = editWorkflow(def, { lanes: LANES_BY_FAMILY }, NODE_KINDS);
  const done = write(def);
  assert.deepEqual([done.edits, done.requests], [[], []]);
  assert.equal(JSON.stringify(q.draft), was, 'the Query is as it was');
  const back = read();
  assert.deepEqual([back.nodes.find((n) => n.id === 'field-view-seats').x, back.nodes.find((n) => n.id === 'field-view-seats').y], [999, 444]);
  assert.equal(back.ties.length, 1);
  assert.equal(back.frames.length, 1);
  assert.deepEqual(back.stages.map((s) => s.label), ['Stage 1', 'Decide']);
  assert.equal(back.lanes.length, LANES_BY_FAMILY.length);
  assert.ok(isGraphLayout(JSON.parse(JSON.stringify(layoutOf(back)))), 'the layout is kept as JSON');
});

test('its places are the one place set: Swimlanes off puts each node back, the unfurl mark is kept, a wrong shape is dropped (1004e)', async () => {
  const { read, write } = await opened();
  const at = (def) => def.nodes.map((n) => [n.id, n.x, n.y]);
  const first = at(read());
  write(editWorkflow(read(), { lanes: LANES_BY_FAMILY }, NODE_KINDS));
  // The lanes move a node; off, it goes back where it stood before them.
  write(editWorkflow(read(), { node: 'field-view-seats', set: { x: 999, y: 444 } }, NODE_KINDS));
  write(editWorkflow(read(), { lanes: null }, NODE_KINDS));
  assert.deepEqual(at(read()), first);
  write({ ...read(), unfurl: true });
  assert.equal(read().unfurl, true, 'the unfurl mark travels with its places (plan 1001 D4)');
  assert.equal(isGraphLayout({ places: { 'field-view-seats': { x: 1, y: 2 } } }), false, 'a place set of another shape');
});

test('a cut connection, or a removed reading, is refused in words, and the Query is as it was', async () => {
  const { read, write, q } = await opened();
  const was = JSON.stringify(q.draft);
  // A part's Pass into its Or (plan 971 §9).
  const cut = write(editWorkflow(read(), { cut: { from: 'when-view-seats.1/pass', to: 'when-view-seats' } }, NODE_KINDS));
  assert.deepEqual(cut.refused.map((r) => r.code), ['query-connection']);
  const gone = write(editWorkflow(read(), { remove: 'when-view-seats.2.1' }, NODE_KINDS));
  assert.deepEqual(gone.refused.map((r) => r.code), ['query-remove']);
  assert.equal(JSON.stringify(q.draft), was);
});

test('a new node is placed through the Query: a Field holds the scope\'s next field', async () => {
  const { read, write, q } = await opened();
  const done = write(editWorkflow(read(), { add: { id: 'field-1', kind: 'field', x: 0, y: 0 } }, NODE_KINDS));
  assert.deepEqual(done.refused, []);
  assert.equal(done.requests.length, 1);
  assert.deepEqual(q.scope('view'), ['seats', 'plan'], 'the scope holds its next field, Plan');
  assert.ok(!read().nodes.some((n) => n.id === 'field-1'), 'the editor\'s own id is never the Query\'s');
});

test('a row cleared on the Arrange node asks for none, never the word "undefined"', async () => {
  const { read, write, q } = await opened();
  q.ask({ scope: 'view', search: 'Pr' });
  write(editWorkflow(read(), { node: 'organise-view', row: 'search', value: '' }, NODE_KINDS));
  assert.equal(q.draft.scopes.view.search ?? '', '');
  assert.ok(!read().nodes.some((n) => n.id === 'organise-view'), 'nothing is arranged now');
});
