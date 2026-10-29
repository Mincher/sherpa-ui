/**
 * A SUMMARY GROUPS AND SORTS — Will, TODO 548 (plan phase A). A chart grouped by
 * another field draws each segment SUBDIVIDED by it: the data layer hands each
 * segment its `parts`, as it hands a grid its groups. Sort orders the segments
 * by value; none keeps their declared order. A part keeps its group value's
 * colour, and a segment its own, wherever it sorts to.
 * TRAP T-a-group-is-a-data-layer-concept
 *
 *   node --test test/unit/a-summary-groups-and-sorts.test.mjs
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { summarise } from '../../dist/core/data/aggregate.js';

const ROWS = [
  { id: 1, status: 'active', plan: 'Pro', seats: 10 },
  { id: 2, status: 'active', plan: 'Pro', seats: 5 },
  { id: 3, status: 'active', plan: 'Free', seats: 1 },
  { id: 4, status: 'trial', plan: 'Free', seats: 2 },
  { id: 5, status: 'churned', plan: 'Pro', seats: 7 },
];
const DOMAIN = { status: ['active', 'trial', 'churned'], plan: ['Free', 'Pro'] };
const domain = (field) => DOMAIN[field] ?? [];

test('grouped, each segment carries its parts — by the group field, in its declared order and colour', () => {
  const out = summarise(ROWS, { shape: 'segments', segment: 'status', group: 'plan' }, domain);
  assert.deepEqual(out.map((s) => [s.label, s.value, s.colorIndex]), [['active', 3, 1], ['trial', 1, 2], ['churned', 1, 3]]);
  assert.deepEqual(out[0].parts, [{ label: 'Free', value: 1, colorIndex: 1 }, { label: 'Pro', value: 2, colorIndex: 2 }]);
  // A part a segment has no rows of is not drawn; its colour stays its value's.
  assert.deepEqual(out[2].parts, [{ label: 'Pro', value: 1, colorIndex: 2 }]);
});

test('a measured field is summed in each part, and the parts add up to their segment', () => {
  const out = summarise(ROWS, { shape: 'segments', segment: 'status', group: 'plan', aggregate: 'sum', field: 'seats' }, domain);
  const active = out.find((s) => s.label === 'active');
  assert.equal(active.value, 16);
  assert.deepEqual(active.parts.map((p) => [p.label, p.value]), [['Free', 1], ['Pro', 15]]);
  assert.equal(active.parts.reduce((n, p) => n + p.value, 0), active.value);
});

test('sorted, the segments run by value — each keeps its own colour; none keeps the declared order', () => {
  const by = (sort) => summarise(ROWS, { shape: 'segments', segment: 'status', aggregate: 'sum', field: 'seats', ...(sort ? { sort } : {}) }, domain)
    .map((s) => `${s.label}:${s.value}:${s.colorIndex}`);
  assert.deepEqual(by('desc'), ['active:16:1', 'churned:7:3', 'trial:2:2']);
  assert.deepEqual(by('asc'), ['trial:2:2', 'churned:7:3', 'active:16:1']);
  assert.deepEqual(by(), ['active:16:1', 'trial:2:2', 'churned:7:3']);
});

test('ungrouped, a segment has no parts — nothing changes for a chart that does not ask', () => {
  const out = summarise(ROWS, { shape: 'segments', segment: 'status' }, domain);
  assert.equal(out.some((s) => 'parts' in s), false);
});

test('a distinct count\'s parts add up to it: each value counted once, in the group most of its rows are in (Will, TODO 548)', () => {
  // Acme has two Pro rows and one Free row in "active": it is one customer, a Pro one.
  const rows = [
    { id: 1, status: 'active', plan: 'Pro', customer: 'Acme' },
    { id: 2, status: 'active', plan: 'Pro', customer: 'Acme' },
    { id: 3, status: 'active', plan: 'Free', customer: 'Acme' },
    { id: 4, status: 'active', plan: 'Free', customer: 'Globex' },
    // A tie goes to the first plan in order: Free.
    { id: 5, status: 'active', plan: 'Pro', customer: 'Initech' },
    { id: 6, status: 'active', plan: 'Free', customer: 'Initech' },
  ];
  const [active] = summarise(rows, { shape: 'segments', segment: 'status', group: 'plan', aggregate: 'distinct', field: 'customer' }, domain);
  assert.equal(active.value, 3);
  assert.deepEqual(active.parts.map((p) => [p.label, p.value, p.colorIndex]), [['Free', 2, 1], ['Pro', 1, 2]]);
  assert.equal(active.parts.reduce((n, p) => n + p.value, 0), active.value);
});

test('stacked by a Secondary, each bar holds its pieces — in that field\'s colours — and each piece its parts by the group (Will, TODO 548)', () => {
  const out = summarise(ROWS, { shape: 'segments', segment: 'plan', stack: 'status', group: 'seats' }, domain);
  const pro = out.find((s) => s.label === 'Pro');
  // A bar a plan, its row count; stacked by status, in the status order and colours.
  assert.equal(pro.value, 3);
  assert.deepEqual(pro.stack.map((p) => [p.label, p.value, p.colorIndex]), [['active', 2, 1], ['churned', 1, 3]]);
  assert.equal(pro.stack.reduce((n, p) => n + p.value, 0), pro.value);
  // Each piece's sections, by the group.
  assert.deepEqual(pro.stack[0].parts.map((p) => [p.label, p.value]), [['10', 1], ['5', 1]]);
  // No group: pieces, no parts.
  const plain = summarise(ROWS, { shape: 'segments', segment: 'plan', stack: 'status' }, domain);
  assert.equal(plain.some((s) => s.stack.some((p) => 'parts' in p)), false);
});
