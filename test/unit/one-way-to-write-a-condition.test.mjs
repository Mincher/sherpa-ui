/**
 * ONE WAY TO WRITE A CONDITION in a definition or a View: `{ openTickets: { gt: 0 } }`,
 * numbers as numbers. Readings stay inside. TODO 197 · TRAP T-one-way-to-write-a-condition
 *
 *   node --test test/unit/one-way-to-write-a-condition.test.mjs
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  ArrayStore, DataSource, onReport, readingsOf, savedFiltersOf, whereOf,
} from '../../dist/data.js';

const TYPES = { openTickets: 'number', health: 'number', created: 'date' };
const facts = (field) => (TYPES[field] ? { type: TYPES[field] } : {});

test('each answer a control holds is ONE plain condition, and reads back as it was', () => {
  const readings = {
    openTickets: { op: 'gt', text: '2' },
    owner: { picked: ['Ravi Menon'] },
    status: { op: 'ne', picked: ['churned'] },
    plan: { picked: ['Pro', 'Enterprise'] },
    created: { picked: ['2024-07-01', '2024-09-30'], range: true },
    name: { op: 'contains', text: 'acme' },
  };
  const where = whereOf(readings, facts);
  assert.deepEqual(where, {
    openTickets: { gt: 2 },
    owner: { eq: 'Ravi Menon' },
    status: { ne: 'churned' },
    plan: { in: ['Pro', 'Enterprise'] },
    created: { between: ['2024-07-01', '2024-09-30'] },
    name: { contains: 'acme' },
  });
  assert.deepEqual(readingsOf(where, facts), readings);
});

test('Advanced rows: several ops all hold, `or` takes a list, and AND binds tighter', () => {
  const both = { conditions: [{ op: 'gte', text: '10' }, { join: 'and', op: 'lt', text: '60' }] };
  const either = { conditions: [{ op: 'lt', text: '10' }, { join: 'or', op: 'gt', text: '90' }] };
  const mixed = { conditions: [
    { op: 'lt', text: '10' }, { join: 'or', op: 'gt', text: '50' }, { join: 'and', op: 'lt', text: '60' },
  ] };
  const where = whereOf({ health: both, openTickets: either, seats: mixed }, () => ({ type: 'number' }));
  assert.deepEqual(where, {
    health: { gte: 10, lt: 60 },
    openTickets: { or: [{ lt: 10 }, { gt: 90 }] },
    seats: { or: [{ lt: 10 }, { gt: 50, lt: 60 }] },
  });
  assert.deepEqual(readingsOf(where), { health: both, openTickets: either, seats: mixed });
  // The same op twice cannot share one object, so it is a list.
  const twice = { conditions: [{ op: 'contains', text: 'a' }, { join: 'and', op: 'contains', text: 'b' }] };
  assert.deepEqual(whereOf({ name: twice }), { name: { and: [{ contains: 'a' }, { contains: 'b' }] } });
  assert.deepEqual(readingsOf(whereOf({ name: twice })), { name: twice });
});

test('off is kept, not applied; no answer is no condition', () => {
  assert.deepEqual(whereOf({ status: { picked: ['trial'], suspended: true }, plan: {} }),
    { status: { eq: 'trial', off: true } });
  assert.deepEqual(readingsOf({ status: { eq: 'trial', off: true } }),
    { status: { picked: ['trial'], suspended: true } });
});

test('two values on a number field are a LIST, and its range is a Between row', () => {
  assert.deepEqual(readingsOf({ seats: { in: [5, 9] } }, () => ({ type: 'number' })),
    { seats: { picked: [5, 9] } });
  // A number's range is an Advanced row (TODO 375); a date's is its two ends.
  assert.deepEqual(readingsOf({ seats: { between: [5, 9] } }, () => ({ type: 'number' })),
    { seats: { conditions: [{ op: 'between', picked: [5, 9] }], mode: 'advanced' } });
  assert.deepEqual(readingsOf({ seats: { notbetween: [5, 9] } }, () => ({ type: 'number' })),
    { seats: { conditions: [{ op: 'notbetween', picked: [5, 9] }], mode: 'advanced' } });
  assert.deepEqual(readingsOf({ made: { between: ['2026-01-05', '2026-02-06'] } }, () => ({ type: 'date' })),
    { made: { picked: ['2026-01-05', '2026-02-06'], range: true } });
});

test('a reading in the old form is not read — it is reported, and filters nothing', () => {
  // Sherpa keeps no shim for an app's old stored data (Will, D4).
  const seen = [];
  const undo = onReport((r) => seen.push(r.code));
  try {
    const read = readingsOf({ owner: { op: 'eq', picked: ['Unassigned'] }, health: { op: 'lt', text: '60' } });
    assert.deepEqual(read, { owner: {}, health: {} });
  } finally {
    undo();
  }
  assert.ok(seen.length && seen.every((code) => code === 'unknown-op'));
});

test('what rows cannot show, and what is not an op, reports', () => {
  const seen = [];
  const undo = onReport((r) => seen.push(r.code));
  try {
    assert.deepEqual(readingsOf({ health: { gt: 0, or: [{ lt: 10 }, { gt: 90 }] } }), {});
    assert.deepEqual(readingsOf({ health: { lt: 60, over: 3 } }), { health: { op: 'lt', text: '60' } });
  } finally {
    undo();
  }
  assert.deepEqual(seen, ['unreadable-condition', 'unknown-op']);
});

test('a source reads a View\'s `where` by its field types, and says its Query back the same way', async () => {
  const store = new ArrayStore([
    { id: 1, openTickets: 0, status: 'active' }, { id: 2, openTickets: 3, status: 'active' },
    { id: 3, openTickets: 5, status: 'churned' },
  ]);
  const source = new DataSource({ store });
  source.declareField('openTickets', { type: 'number' });
  await source.setQuery({ v: 1, scopes: { view: { where: { openTickets: { gt: 2 }, status: { ne: 'churned' } } } } },
    { holds: 'keep' });
  const view = source.query.applied.scopes.view;
  assert.deepEqual(view.readings, { openTickets: { op: 'gt', text: '2' }, status: { op: 'ne', picked: ['churned'] } });
  assert.deepEqual(view.holds, ['openTickets', 'status']);
  assert.deepEqual(source.whereOf(view.readings), { openTickets: { gt: 2 }, status: { ne: 'churned' } });
  const { rows } = await source.load();
  assert.deepEqual(rows.map((r) => r.id), [2]);
});

test('a page\'s saved filter is a query definition, its `where` in the plain form; one that is not reports', () => {
  const seen = [];
  const undo = onReport((r) => seen.push(r.code));
  let kept;
  try {
    kept = savedFiltersOf({
      v: 1, id: 'p',
      savedFilters: {
        'at-risk': { label: 'At risk', query: { v: 1, scopes: { data: { where: { health: { lt: 60 } } } } } },
        old: { label: 'Old', where: { health: { lt: 60 } } },
      },
    });
  } finally {
    undo();
  }
  assert.deepEqual(Object.keys(kept), ['at-risk']);
  assert.deepEqual(seen, ['saved-filter-invalid']);
});
