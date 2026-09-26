/**
 * THE QUERY — one state, in the reader's terms, compiled on demand.
 *
 * Step 1 of docs/QUERY-DESIGN.md: `compile()` exists and is PURE, and a Query
 * holding today's answers keeps exactly the rows today's DataSource keeps for
 * the same answers — so the source can move onto it without a change anyone
 * can see. TRAP T-one-query-one-owner
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

const { compile, VIEW, DataSource, ArrayStore, filterRows } =
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
  assert.deepEqual(compile({ v: 1, scopes: {} }), { only: {}, sort: [], group: null, search: '' });
});
