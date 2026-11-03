/**
 * ONE WAY TO WRITE A CONDITION in a definition or a View: `{ openTickets: { gt: 0 } }`,
 * numbers as numbers. Readings stay inside. TODO 197 · TRAP T-one-way-to-write-a-condition
 *
 *   node --test test/unit/one-way-to-write-a-condition.test.mjs
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  ArrayStore, DataSource, checkPage, onReport, readingsOf, savedFiltersOf, whereOf,
} from '../../dist/data.js';

const TYPES = { openTickets: 'number', health: 'number', created: 'date' };
const facts = (field) => (TYPES[field] ? { type: TYPES[field] } : {});

test('each answer a control holds is ONE plain condition, and reads back as it was', () => {
  const readings = {
    openTickets: { op: 'gt', text: '2' },
    owner: { picked: ['Ravi Menon'] },
    // A list's other ops are its Advanced answer: a tree. TRAP T-one-condition-tree
    status: { tree: { op: 'ne', value: 'churned' }, mode: 'advanced' },
    plan: { picked: ['Pro', 'Enterprise'] },
    created: { picked: ['2024-07-01', '2024-09-30'], range: true },
    name: { tree: { op: 'contains', value: 'acme' }, mode: 'advanced' },
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

test('Advanced rows: several ops all hold, `or` takes a list, and they read left to right', () => {
  const both = { tree: { and: [{ op: 'gte', value: '10' }, { op: 'lt', value: '60' }] } };
  const either = { tree: { or: [{ op: 'lt', value: '10' }, { op: 'gt', value: '90' }] } };
  const mixed = { tree: { and: [{ or: [{ op: 'lt', value: '10' }, { op: 'gt', value: '50' }] }, { op: 'lt', value: '60' }] } };
  const number = () => ({ type: 'number' });
  const where = whereOf({ health: both, openTickets: either, seats: mixed }, number);
  assert.deepEqual(where, {
    health: { gte: 10, lt: 60 },
    openTickets: { or: [{ lt: 10 }, { gt: 90 }] },
    seats: { and: [{ or: [{ lt: 10 }, { gt: 50 }] }, { lt: 60 }] },
  });
  // Read back, the tree holds its numbers as numbers.
  assert.deepEqual(readingsOf(where, number), {
    health: { tree: { and: [{ op: 'gte', value: 10 }, { op: 'lt', value: 60 }] }, mode: 'advanced' },
    openTickets: { tree: { or: [{ op: 'lt', value: 10 }, { op: 'gt', value: 90 }] }, mode: 'advanced' },
    seats: { tree: { and: [{ or: [{ op: 'lt', value: 10 }, { op: 'gt', value: 50 }] }, { op: 'lt', value: 60 }] }, mode: 'advanced' },
  });
  assert.deepEqual(whereOf(readingsOf(where, number), number), where);
  // The same op twice cannot share one object, so it is a list.
  const twice = { tree: { and: [{ op: 'contains', value: 'a' }, { op: 'contains', value: 'b' }] }, mode: 'advanced' };
  assert.deepEqual(whereOf({ name: twice }), { name: { and: [{ contains: 'a' }, { contains: 'b' }] } });
  assert.deepEqual(readingsOf(whereOf({ name: twice })), { name: twice });
});

test('a condition nests as deep as it says, and reads back whole — A or (B and C) and (A and B) or (C and D)', () => {
  // TRAP T-one-condition-tree · TODO 692 (its data half)
  const number = () => ({ type: 'number' });
  const nested = {
    seats: { or: [{ lt: 10 }, { and: [{ gt: 50 }, { lt: 60 }] }] },
    score: { or: [{ gt: 0, lt: 10 }, { gt: 50, lt: 90 }] },
  };
  const readings = readingsOf(nested, number);
  assert.deepEqual(readings.seats, {
    tree: { or: [{ op: 'lt', value: 10 }, { and: [{ op: 'gt', value: 50 }, { op: 'lt', value: 60 }] }] }, mode: 'advanced',
  });
  assert.deepEqual(readings.score.tree, {
    or: [{ and: [{ op: 'gt', value: 0 }, { op: 'lt', value: 10 }] }, { and: [{ op: 'gt', value: 50 }, { op: 'lt', value: 90 }] }],
  });
  // Written back, distinct ops share one object: the same condition.
  assert.deepEqual(whereOf(readings, number), { ...nested, seats: { or: [{ lt: 10 }, { gt: 50, lt: 60 }] } });
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
    { seats: { tree: { op: 'between', value: [5, 9] }, mode: 'advanced' } });
  assert.deepEqual(readingsOf({ seats: { notbetween: [5, 9] } }, () => ({ type: 'number' })),
    { seats: { tree: { op: 'notbetween', value: [5, 9] }, mode: 'advanced' } });
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

test('what is not an op reports, and is left out; a nested condition is read whole', () => {
  const seen = [];
  const undo = onReport((r) => seen.push(r.code));
  try {
    assert.equal(readingsOf({ health: { or: [{ gt: 0, lt: 10 }, { gt: 50, lt: 90 }] } }).health.mode, 'advanced');
    assert.deepEqual(readingsOf({ health: { lt: 60, over: 3 } }, () => ({ type: 'number' })), { health: { op: 'lt', text: '60' } });
  } finally {
    undo();
  }
  assert.deepEqual(seen, ['unknown-op']);
});

test('a source reads a View\'s `where` by its field types, and says its Query back the same way', async () => {
  const store = new ArrayStore([
    { id: 1, openTickets: 0, status: 'active' }, { id: 2, openTickets: 3, status: 'active' },
    { id: 3, openTickets: 5, status: 'churned' },
  ]);
  const source = new DataSource({ store });
  source.declareField('openTickets', { type: 'number' });
  await source.query.setQuery({ v: 1, scopes: { view: { where: { openTickets: { gt: 2 }, status: { ne: 'churned' } } } } },
    { holds: 'keep' });
  const view = source.query.applied.scopes.view;
  assert.deepEqual(view.readings, { openTickets: { op: 'gt', text: '2' }, status: { tree: { op: 'ne', value: 'churned' }, mode: 'advanced' } });
  assert.deepEqual(view.holds, ['openTickets', 'status']);
  assert.deepEqual(source.whereOf(view.readings), { openTickets: { gt: 2 }, status: { ne: 'churned' } });
  const { rows } = await source.load();
  assert.deepEqual(rows.map((r) => r.id), [2]);
});

test('a page\'s saved filter is a query definition, its `where` in the plain form; one that is not reports', () => {
  const seen = [];
  const undo = onReport((r) => seen.push(r.code));
  const page = {
    v: 1, id: 'p',
    savedFilters: {
      'at-risk': { label: 'At risk', query: { v: 1, scopes: { view: { where: { health: { lt: 60 } } } } } },
      old: { label: 'Old', where: { health: { lt: 60 } } },
    },
  };
  let kept;
  try {
    kept = savedFiltersOf(page);
    assert.deepEqual(seen, [], 'the reader leaves it out; checkPage says it');
    assert.equal(checkPage(page), false);
  } finally {
    undo();
  }
  assert.deepEqual(Object.keys(kept), ['at-risk']);
  assert.deepEqual(seen, ['saved-filter-invalid']);
});
