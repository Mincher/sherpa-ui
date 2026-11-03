// A grid draws what the data layer says of its rows: their order, its page while
// grouped, each group's count, a column's values and a number's ends. Plan 695 P4
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ColumnFacts } from '../../dist/core/data/column-facts.js';

const ROWS = [
  { name: 'Cara', tier: 'Gold', spend: 12.5 },
  { name: 'Abe', tier: 'Silver', spend: null },
  { name: 'Bea', tier: 'Gold', spend: 40.2 },
  { name: 'Dan', tier: 'Bronze', spend: '' },
  { name: 'Eve', tier: 'Silver', spend: 7 },
];
const names = (rows) => rows.map((r) => r.name);

test('rows given by hand are ordered here, their group first; a source\'s are drawn as given', () => {
  const facts = new ColumnFacts(ROWS);
  assert.deepEqual(names(facts.page({ order: true, sort: { field: 'name', direction: 'desc' } }).all), ['Eve', 'Dan', 'Cara', 'Bea', 'Abe']);
  assert.deepEqual(names(facts.page({ order: true, sort: { field: 'name', direction: 'asc' }, group: 'tier' }).all),
    ['Dan', 'Bea', 'Cara', 'Abe', 'Eve']);
  // By the grouped field itself, the groups turn round.
  assert.deepEqual(names(facts.page({ order: true, sort: { field: 'tier', direction: 'desc' }, group: 'tier' }).all),
    ['Abe', 'Eve', 'Cara', 'Bea', 'Dan']);
  assert.equal(facts.page({ group: 'tier' }).all, ROWS);
  assert.equal(facts.page({ order: true }).all, ROWS);
});

test('a grouped page is page-size ROWS: an open heading is free, a shut group is one slot', () => {
  const facts = new ColumnFacts(ROWS);
  const ask = { order: true, sort: { field: 'name' }, group: 'tier', size: 2 };
  // Bronze: Dan | Gold: Bea, Cara | Silver: Abe, Eve — three pages of two rows, the first one.
  const open = facts.page({ ...ask, page: 1 });
  assert.deepEqual([names(open.rows), open.offset, open.pages], [['Dan', 'Bea'], 0, 3]);
  // Gold shut: one slot, so Bronze and Gold share page 1, Silver is page 2.
  const shut = facts.page({ ...ask, page: 2, shut: new Set(['Gold']) });
  assert.deepEqual([names(shut.rows), shut.offset, shut.pages], [['Abe', 'Eve'], 3, 2]);
  // Clamped, never empty.
  assert.deepEqual(names(facts.page({ ...ask, page: 9 }).rows), ['Eve']);
  // Ungrouped, its page is the store's: every row.
  assert.deepEqual(facts.page({ size: 2 }).pages, 1);
  // Asked again, the same answer.
  assert.equal(facts.page({ ...ask, page: 1 }), facts.page({ ...ask, page: 1 }));
});

test('a group\'s count is the one its source told, else these rows\'', () => {
  const told = new ColumnFacts(ROWS.slice(0, 2), [{ key: 'Gold', value: 'Gold', count: 40 }]);
  assert.equal(told.count('tier', 'Gold'), 40);
  assert.equal(told.count('tier', 'Silver'), 1);
  assert.deepEqual(told.told, [{ key: 'Gold', value: 'Gold', count: 40 }]);
  assert.equal(new ColumnFacts(ROWS).told, null);
});

test('a column\'s values are distinct, none empty, in the library\'s order; a number\'s ends span its finite values', () => {
  const facts = new ColumnFacts(ROWS);
  assert.deepEqual(facts.values('tier'), ['Bronze', 'Gold', 'Silver']);
  assert.deepEqual(facts.values('spend'), ['7', '12.5', '40.2']);
  assert.deepEqual(facts.range('spend'), { min: 7, max: 41 });
  assert.equal(facts.range('name'), undefined);
  assert.equal(new ColumnFacts([{ spend: null }]).range('spend'), undefined);
});
