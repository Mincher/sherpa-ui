/**
 * AN AXIS SHOWS AS COUNTS — Will, TODO 653. A chart is Primary by Secondary. The
 * axis shown as counts splits nothing: each value of the other is the number of its
 * distinct values there — Customers by Status, a bar a status, its height the
 * customers in it. With no other axis, or a chart that sums, both show as names.
 *
 *   node --test test/unit/an-axis-shows-as-counts.test.mjs
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { chartAxes, summarise, summariseMarked } from '../../dist/core/data/aggregate.js';

// People in customers: Acme has two, both active; Bolt has an active one and a trial one.
const ROWS = [
  { id: 1, customer: 'Acme', status: 'active', plan: 'Pro' },
  { id: 2, customer: 'Acme', status: 'active', plan: 'Free' },
  { id: 3, customer: 'Bolt', status: 'active', plan: 'Pro' },
  { id: 4, customer: 'Bolt', status: 'trial', plan: 'Pro' },
  { id: 5, customer: 'Core', status: 'churned', plan: 'Free' },
];

test('the Primary as counts: a segment a Secondary value, the number of distinct Primary values in it', () => {
  const axes = chartAxes('customer', 'status', 'primary');
  assert.deepEqual(axes, { segment: 'status', aggregate: 'distinct', field: 'customer' });
  const out = summarise(ROWS, { shape: 'segments', ...axes });
  // Three people are active, in two customers.
  assert.deepEqual(out.map((s) => [s.label, s.value]), [['active', 2], ['trial', 1], ['churned', 1]]);
});

test('the Secondary as counts: a segment a Primary value, the number of distinct Secondary values in it', () => {
  assert.deepEqual(chartAxes('customer', 'status', 'secondary'), { segment: 'customer', aggregate: 'distinct', field: 'status' });
});

test('as names, the Primary splits and the Secondary stacks, as before', () => {
  assert.deepEqual(chartAxes('customer', 'status'), { segment: 'customer', stack: 'status' });
  assert.deepEqual(chartAxes('status', undefined, null), { segment: 'status' });
});

test('with no other axis, or a chart that sums, an axis shown as counts shows as names', () => {
  assert.deepEqual(chartAxes('customer', undefined, 'primary'), { segment: 'customer' });
  assert.deepEqual(chartAxes('customer', 'status', 'primary', 'sum'), { segment: 'customer', stack: 'status' });
  assert.deepEqual(chartAxes('customer', 'status', 'primary', 'count'), { segment: 'status', aggregate: 'distinct', field: 'customer' });
});

test('the highlight counts its own distinct values in each segment', () => {
  const axes = chartAxes('customer', 'status', 'primary');
  const out = summariseMarked(ROWS, { shape: 'segments', ...axes }, () => [], () => ({}), (row) => row.plan === 'Pro');
  // Active Pro people are in Acme and Bolt; the one trial is Bolt's, on Pro.
  assert.deepEqual(out.map((s) => [s.label, s.value, s.matched]), [['active', 2, 2], ['trial', 1, 1], ['churned', 1, 0]]);
});
