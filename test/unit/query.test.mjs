/**
 * THE QUERY — one state, in the reader's terms, compiled on demand.
 *
 * Step 1 of docs/QUERY-DESIGN.md: `compile()` exists and is PURE, and a Query
 * holding today's answers keeps exactly the rows today's DataSource keeps for
 * the same answers — so the source can move onto it without a change anyone
 * can see. Step 2: the source holds it. TRAP T-one-query-one-owner
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

const { compile, VIEW, DataSource, ArrayStore, filterRows, spoofRemote } =
  await import(new URL('../../dist/data.js', import.meta.url));

const ROWS = [
  { id: 1, region: 'EMEA', status: 'active', owner: 'Dana Whitlock', health: 40 },
  { id: 2, region: 'EMEA', status: 'trial', owner: 'Ravi Menon', health: 80 },
  { id: 3, region: 'APAC', status: 'active', owner: 'Dana Whitlock', health: 90 },
  { id: 4, region: 'EMEA', status: 'active', owner: 'Nassim Haddad', health: 55 },
  { id: 5, region: 'AMER', status: 'churned', owner: 'Unassigned', health: 20 },
];
const ids = (filter) => filterRows(ROWS, filter).map((r) => r.id);

const RECORDS = {
  v: 1,
  scopes: {
    [VIEW]: { holds: ['region'], readings: { region: { picked: ['EMEA'] } } },
    grid: {
      holds: ['status', 'owner'],
      readings: {
        status: { picked: ['active'] },
        owner: { conditions: [{ op: 'contains', text: 'Da' }, { op: 'startswith', text: 'N', join: 'or' }] },
      },
      sort: [{ field: 'health', direction: 'asc' }],
      group: null,
    },
  },
};

test('a Query keeps the rows today\'s DataSource keeps for the same answers', async () => {
  const src = new DataSource({ store: new ArrayStore(ROWS, { key: 'id' }) });
  await src.ready;
  // TODAY: the header as a named part, the grid's fields as selections.
  src.apply({ region: { picked: ['EMEA'] } }, { reach: 'component', key: 'global' });
  src.select('status', ['active']);
  src.select('owner', [], RECORDS.scopes.grid.readings.owner);
  const compiled = compile(RECORDS);
  assert.deepEqual(ids(compiled.filter), ids(src.state.filter));
  assert.deepEqual(ids(compiled.filter), [1, 4]);
  assert.deepEqual(compiled.sort, [{ field: 'health', direction: 'asc' }]);
});

test('compile is pure — the same Query gives the same result, and is not changed', () => {
  const before = JSON.stringify(RECORDS);
  assert.deepEqual(compile(RECORDS), compile(RECORDS));
  assert.equal(JSON.stringify(RECORDS), before);
});

test('a SUSPENDED reading keeps its answer and applies none of it', () => {
  const q = { v: 1, scopes: { grid: { holds: ['status'], readings: { status: { picked: ['trial'] } } } } };
  assert.deepEqual(ids(compile(q).filter), [2]);
  q.scopes.grid.readings.status.suspended = true;
  // Every row again — and the answer is still there to switch back on.
  assert.equal(compile(q).filter, undefined);
  assert.deepEqual(q.scopes.grid.readings.status.picked, ['trial']);
});

test('a field the VIEW holds is answered there alone — a component scope\'s reading applies nothing', () => {
  const q = structuredClone(RECORDS);
  q.scopes.grid.holds.push('region');
  q.scopes.grid.readings.region = { picked: ['APAC'] };
  // EMEA from the view; the grid's APAC would have emptied the result.
  assert.deepEqual(ids(compile(q).filter), [1, 4]);
});

test('a scope that NARROWS one component reaches it alone', () => {
  const q = structuredClone(RECORDS);
  q.scopes['bar-chart'] = { holds: ['status'], readings: { status: { picked: ['trial'] } }, narrows: ['r-bar'] };
  const c = compile(q);
  // The shared filter is unchanged…
  assert.deepEqual(ids(c.filter), [1, 4]);
  // …and the chart's own part is its alone.
  assert.deepEqual(Object.keys(c.only), ['r-bar']);
  assert.deepEqual(ids(c.only['r-bar']), [2]);
});

test('a preset that is ON applies its saved readings; one that is off, nothing', () => {
  const q = { v: 1, scopes: { grid: { holds: [], readings: {}, presets: { 'at-risk': true, 'mine': false } } } };
  const presets = { 'at-risk': { health: { op: 'lt', text: '60' } }, mine: { owner: { picked: ['Ravi Menon'] } } };
  const c = compile(q, {
    preset: (id) => presets[id],
    field: (f) => (f === 'health' ? { type: 'number' } : {}),
  });
  assert.deepEqual(ids(c.filter), [1, 4, 5]);
});

test('an empty Query filters nothing and arranges nothing', () => {
  assert.deepEqual(compile({ v: 1, scopes: {} }), { scoped: {}, only: {}, sort: [], group: null, search: '' });
});

/* ONLY THE VIEW TRICKLES DOWN. A component scope narrows a page of its own
   rows, never a summary beside it. TRAP T-only-the-view-trickles-down */
test('a component scope compiles apart from the View: a page sees both, a summary the View alone', () => {
  const c = compile({ v: 1, scopes: {
    view: { holds: ['region'], readings: { region: { picked: ['EMEA'] } } },
    data: { holds: ['status'], readings: { status: { picked: ['active'] } } },
  } });
  assert.deepEqual(c.view, ['region', 'eq', 'EMEA']);
  assert.deepEqual(c.scoped, { data: ['status', 'eq', 'active'] });
  assert.deepEqual(c.filter, ['and', ['region', 'eq', 'EMEA'], ['status', 'eq', 'active']]);
});

/* A scope NO component answers is the page's: a View's own axes with no chip
   ("Critical only") reach every component. TRAP T-only-the-view-trickles-down */
test('a scope no component answers trickles down with the View', () => {
  const c = compile({ v: 1, scopes: {
    page: { holds: [], readings: { severity: { picked: ['critical'] } } },
    data: { holds: ['status'], readings: { status: { picked: ['active'] } } },
  } }, { components: new Set(['data']) });
  assert.deepEqual(c.view, ['severity', 'eq', 'critical']);
  assert.deepEqual(Object.keys(c.scoped), ['data']);
});

/* ── Step 2: the source holds the Query ─────────────────────────────── */

test('the source keeps each reading in the scope that holds its field, and compiles its filter from them', async () => {
  const src = new DataSource({ store: new ArrayStore(ROWS, { key: 'id' }) });
  await src.ready;
  src.hold('grid', ['status']);
  src.select('status', ['active']);
  // A field no bar holds is the View's — it narrows everyone.
  src.select('owner', ['Dana Whitlock']);
  const { applied } = src.query;
  assert.deepEqual(applied.scopes.grid.readings, { status: { picked: ['active'] } });
  assert.deepEqual(Object.keys(applied.scopes[VIEW].readings), ['owner']);
  assert.deepEqual(ids(src.state.filter), ids(compile(applied).filter));
  assert.deepEqual(ids(src.state.filter), [1, 3]);
});

test('moving a field moves its reading with it — and the rows do not change', async () => {
  const src = new DataSource({ store: new ArrayStore(ROWS, { key: 'id' }) });
  await src.ready;
  src.offer('grid', ['status']);
  src.hold('grid', ['status']);
  src.select('status', ['trial']);
  const before = ids(src.state.filter);
  src.move('status', 'grid', VIEW);
  const { applied } = src.query;
  assert.equal(applied.scopes.grid, undefined, 'a scope that holds and answers nothing is forgotten');
  assert.deepEqual(applied.scopes[VIEW], { holds: ['status'], readings: { status: { picked: ['trial'] } } });
  assert.deepEqual(ids(src.state.filter), before);
  // Clearing the field clears it from the Query, not just from the filter.
  src.select('status', []);
  assert.deepEqual(src.query.applied.scopes[VIEW].readings, {});
  assert.equal(src.state.filter, undefined);
});

test('the Query a source hands out is a copy — writing to it steers nothing', async () => {
  const src = new DataSource({ store: new ArrayStore(ROWS, { key: 'id' }) });
  await src.ready;
  src.select('region', ['APAC']);
  src.query.applied.scopes[VIEW].readings.region.picked = ['EMEA'];
  assert.deepEqual(src.selection('region').rows[0].picked, ['APAC']);
});

test('a scope\'s whole answer clears what it no longer names — never a field raised out of it', async () => {
  const src = new DataSource({ store: new ArrayStore(ROWS, { key: 'id' }) });
  await src.ready;
  src.offer('grid', ['status', 'region']);
  src.hold('grid', ['status', 'region']);
  src.answer('grid', { status: { picked: ['active'] }, region: { picked: ['EMEA'] } });
  assert.deepEqual(ids(src.state.filter), [1, 4]);
  // Region is RAISED: its answer goes with it, and the grid's next report
  // does not name it.
  src.move('region', 'grid', VIEW);
  src.answer('grid', { status: { picked: ['active'] } });
  assert.deepEqual(src.query.applied.scopes[VIEW].readings, { region: { picked: ['EMEA'] } });
  assert.deepEqual(ids(src.state.filter), [1, 4]);
  // Its own field, dropped from its report, is cleared.
  src.answer('grid', {});
  assert.equal(src.query.applied.scopes.grid.readings.status, undefined);
  assert.deepEqual(ids(src.state.filter), [1, 2, 4]);
});

test('a bar bound with a scope is DRAWN each answer in its scope, whoever set it', async () => {
  const src = new DataSource({ store: new ArrayStore(ROWS, { key: 'id' }) });
  const drawn = [];
  const bar = Object.assign(new EventTarget(), {
    setAttribute() {}, removeAttribute() {}, hasAttribute: () => false,
    drawReading: (field, reading) => drawn.push([field, reading]),
  });
  src.bind(bar, { steerOnly: true, scope: 'grid' });
  src.hold('grid', ['status']);
  // A heading, a legend or the panel — not the bar — answers Status.
  src.select('status', [], { conditions: [{ op: 'contains', text: 'tri' }] });
  // Region is the View's, so this bar is not told.
  src.select('region', ['EMEA']);
  assert.deepEqual(drawn, [['status', { picked: [], conditions: [{ op: 'contains', text: 'tri' }] }]]);
  /* SUSPENDED is drawn too, and SAYS it is off — so a panel does not go on
     showing an answer that filters nothing. TRAP T-a-suspended-answer-is-drawn-as-off */
  src.suspendSelection('status');
  assert.equal(drawn.length, 2);
  assert.deepEqual(drawn[1], ['status', {
    picked: [], conditions: [{ op: 'contains', text: 'tri' }], suspended: true,
  }]);
});

test('a control bound over SEVERAL scopes — the panel — is drawn each, told which', async () => {
  const src = new DataSource({ store: new ArrayStore(ROWS, { key: 'id' }) });
  const drawn = [];
  const panel = Object.assign(new EventTarget(), {
    setAttribute() {}, removeAttribute() {}, hasAttribute: () => false,
    drawReading: (field, _reading, scope) => drawn.push([field, scope]),
  });
  src.bind(panel, { readonly: true, steerOnly: true, scope: [VIEW, 'grid'] });
  src.hold('grid', ['status']);
  src.select('status', ['active']);
  src.select('region', ['EMEA']);
  assert.deepEqual(drawn, [['status', 'grid'], ['region', VIEW]]);
});

test('a scoped bar\'s saved filters are PRESETS in the Query — on or off, readings in the library', async () => {
  const src = new DataSource({ store: new ArrayStore(ROWS, { key: 'id' }) });
  src.declareField('health', { type: 'number' });
  const presets = { 'at-risk': { on: true, readings: { health: { op: 'lt', text: '60' } } } };
  const bar = Object.assign(new EventTarget(), {
    setAttribute() {}, removeAttribute() {}, hasAttribute: () => false,
    readings: {}, presets,
  });
  src.bind(bar, { steerOnly: true, scope: 'grid' });
  bar.dispatchEvent(new CustomEvent('quick-filter-change', { detail: {} }));
  assert.deepEqual(src.query.applied.scopes.grid.presets, { 'at-risk': true });
  assert.deepEqual(ids(src.state.filter), [1, 4, 5]);
  assert.deepEqual(src.contributions, [], 'no compiled part');
  // OFF keeps it held, and filters nothing.
  presets['at-risk'].on = false;
  bar.dispatchEvent(new CustomEvent('quick-filter-change', { detail: {} }));
  assert.deepEqual(src.query.applied.scopes.grid.presets, { 'at-risk': false });
  assert.equal(src.state.filter, undefined);
});

test('setQuery restores the WHOLE Query and draws each bound scope — nothing replays a control', async () => {
  const kept = new DataSource({ store: new ArrayStore(ROWS, { key: 'id' }) });
  kept.hold('grid', ['status']);
  // A bar's reading carries its label and values; only the ANSWER is kept.
  kept.select('status', ['active'], { label: 'Status', values: ['active', 'trial'] });
  kept.select('region', ['EMEA']);
  const saved = JSON.parse(JSON.stringify(kept.query.applied));
  assert.deepEqual(saved.scopes.grid.readings.status, { picked: ['active'] });

  const src = new DataSource({ store: new ArrayStore(ROWS, { key: 'id' }) });
  const drawn = [];
  const bar = Object.assign(new EventTarget(), {
    setAttribute() {}, removeAttribute() {}, hasAttribute: () => false,
    drawScope: async (slice, scope) => { drawn.push([scope, slice]); },
  });
  src.bind(bar, { steerOnly: true, scope: 'grid' });
  await src.setQuery(saved);
  assert.deepEqual(src.query.applied, saved);
  assert.deepEqual(ids(src.state.filter), [1, 4]);
  assert.deepEqual(drawn, [['grid', saved.scopes.grid]]);
  // Not a v1 Query: refused, and nothing changes.
  await src.setQuery({ scopes: {} });
  assert.deepEqual(src.query.applied, saved);
});

test('a field a scope lets go of, held nowhere else, loses its answer — removing a chip is a clear', async () => {
  const src = new DataSource({ store: new ArrayStore(ROWS, { key: 'id' }) });
  src.hold('grid', ['status', 'region']);
  src.select('status', ['active']);
  src.select('region', ['EMEA']);
  // Region moves UP: still held, so its answer goes with it.
  src.hold(VIEW, ['region']);
  src.hold('grid', ['status']);
  assert.deepEqual(src.query.applied.scopes[VIEW].readings, { region: { picked: ['EMEA'] } });
  // Status is let go of and held nowhere: gone, and the rows come back.
  src.hold('grid', []);
  assert.equal(src.reading(VIEW, 'status'), undefined);
  assert.equal(src.selection('status').fieldState, 'off');
  assert.deepEqual(ids(src.state.filter), [1, 2, 4]);
});

test('an EMPTY condition row is no answer — a cleared menu keeps one', async () => {
  const src = new DataSource({ store: new ArrayStore(ROWS, { key: 'id' }) });
  src.select('owner', [], { op: 'contains', text: '', conditions: [{ op: 'eq' }], suspended: true });
  assert.equal(src.reading(VIEW, 'owner'), undefined);
  assert.deepEqual(src.selectedFields, []);
});

/* ── Step 6: draft and applied, on a REMOTE source ─────────────────────
   TRAP T-apply-and-discard-wait-for-a-change */

const remote = async (fail = 0) => {
  const src = new DataSource({ store: spoofRemote(new ArrayStore(ROWS, { key: 'id' }), { delay: 0, fail }) });
  await src.load();
  return src;
};

test('a LOCAL source applies at once — nothing is ever pending', async () => {
  const src = new DataSource({ store: new ArrayStore(ROWS, { key: 'id' }) });
  src.select('status', ['trial']);
  assert.deepEqual(ids(src.state.filter), [2]);
  assert.equal(src.pending('status'), false);
  assert.equal(src.dirty(), false);
});

test('a REMOTE source edits a draft: pending until commit, and the rows wait', async () => {
  const src = await remote();
  src.hold('grid', ['status']);
  src.select('status', ['trial']);
  // The reader sees the draft; the rows are still under the applied Query.
  assert.deepEqual(src.selection('status').values.filter((v) => v.state === 'picked').map((v) => v.value), ['trial']);
  assert.equal(src.state.filter, undefined);
  assert.equal(src.pending('status'), true);
  assert.equal(src.dirty('grid'), true);
  assert.equal(src.dirty(VIEW), false);
  src.commit({ scope: 'grid' });
  assert.deepEqual(ids(src.state.filter), [2]);
  assert.equal(src.pending('status'), false);
  assert.equal(src.dirty(), false);
});

test('Discard puts the applied answer back over the draft, and draws it', async () => {
  const src = await remote();
  const drawn = [];
  const bar = Object.assign(new EventTarget(), {
    setAttribute() {}, removeAttribute() {}, hasAttribute: () => false,
    drawReading: (field, reading) => drawn.push([field, reading.picked]),
  });
  src.bind(bar, { steerOnly: true, scope: 'grid' });
  src.hold('grid', ['status']);
  src.select('status', ['active']);
  src.commit();
  src.select('status', ['trial']);
  assert.equal(src.pending('status'), true);
  drawn.length = 0;
  src.discard({ scope: 'grid' });
  assert.equal(src.pending('status'), false);
  assert.deepEqual(src.selection('status').values.filter((v) => v.state === 'picked').map((v) => v.value), ['active']);
  assert.deepEqual(drawn, [['status', ['active']]]);
});

test('a bound control is TOLD what is pending and whether its scope is dirty', async () => {
  const src = await remote();
  const attrs = {};
  const bar = Object.assign(new EventTarget(), {
    setAttribute: (n, v) => { attrs[n] = v; }, removeAttribute: (n) => { delete attrs[n]; }, hasAttribute: () => false,
  });
  src.bind(bar, { steerOnly: true, scope: 'grid' });
  src.hold('grid', ['status', 'owner']);
  src.select('status', ['trial']);
  assert.equal(attrs['data-pending'], 'status');
  assert.equal(attrs['data-dirty'], '');
  src.commit();
  assert.equal(attrs['data-pending'], undefined);
  assert.equal(attrs['data-dirty'], undefined);
});

test('a legend narrows its chart at once, even on a remote source — its rows are here already', async () => {
  const src = await remote();
  const chart = Object.assign(new EventTarget(), {
    id: 'chart', setAttribute() {}, removeAttribute() {}, hasAttribute: () => false, populate() {},
  });
  src.bind(chart, { readonly: true, rows: 'all' });
  src.write('legend', 'status', { picked: ['active'] }, { only: chart });
  assert.equal(src.dirty(), false);
  assert.deepEqual(Object.keys(src.debugState().only), ['chart']);
});

test('spoofRemote waits, fails when told, and marks the store remote', async () => {
  const slow = spoofRemote(new ArrayStore(ROWS, { key: 'id' }), { delay: 30 });
  assert.equal(slow.remote, true);
  const t = Date.now();
  assert.equal((await slow.load()).total, 5);
  assert.ok(Date.now() - t >= 25);
  const broken = spoofRemote(new ArrayStore(ROWS, { key: 'id' }), { delay: 0, fail: 1 });
  await assert.rejects(() => broken.load(), /the fetch failed/);
});

test('ONE field can be applied or discarded alone — the panel\'s per-field Apply', async () => {
  const src = await remote();
  src.hold('grid', ['status', 'owner']);
  src.select('status', ['trial']);
  src.select('owner', ['Dana Whitlock']);
  src.commit({ field: 'status' });
  assert.deepEqual(ids(src.state.filter), [2]);
  assert.equal(src.pending('status'), false);
  assert.equal(src.pending('owner'), true);
  src.discard({ field: 'owner' });
  assert.equal(src.pending('owner'), false);
  assert.equal(src.selection('owner').fieldState, 'off');
});

/* ── Step 7: a saved View is JSON ──────────────────────────────────────
   TRAP T-a-view-is-json */

test('a View\'s JSON goes onto a clean slate: chips kept, answers shown, rows arranged', async () => {
  const src = new DataSource({ store: new ArrayStore(ROWS, { key: 'id' }) });
  src.hold('grid', ['status', 'region']);
  src.select('region', ['APAC']);
  await src.setQuery({ v: 1, scopes: { grid: {
    readings: { owner: { picked: ['Dana Whitlock'] } },
    sort: [{ field: 'health', direction: 'desc' }],
  } } }, { holds: 'keep' });
  const { applied } = src.query;
  // The old answer is gone; the chips the scope held stay, and Owner joins them.
  assert.deepEqual(applied.scopes.grid.holds, ['status', 'region', 'owner']);
  assert.deepEqual(Object.keys(applied.scopes.grid.readings), ['owner']);
  assert.deepEqual(ids(src.state.filter), [1, 3]);
  // The arrangement is the source's, and not kept in the Query.
  assert.deepEqual(src.state.sort, [{ field: 'health', direction: 'desc' }]);
  assert.equal(applied.scopes.grid.sort, undefined);
});
