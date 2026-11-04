/**
 * SAME INPUT, SAME OUTPUT — TODO 614. A rule must give one answer, so what it reads
 * beyond its input is named: the clock it reads and the language it sorts in. Left
 * alone, both are the reader's, as they were.
 *
 *   node --test test/unit/same-input-same-output.test.mjs
 *
 * TRAP T-a-rule-names-its-clock-and-its-language
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  ArrayStore, DataSource, RestStore, applyOptions, compile, filterRows, filterTest, matchesFilter, setCollation, sortRows
} from '../../dist/data.js';
import { walkStepwise } from '../../dist/core/data/source-counts.js';

const JUNE = new Date('2026-06-15T12:00:00Z');
const MAY = new Date('2026-05-03T12:00:00Z');
const ROWS = [{ id: 1, at: '2026-06-10', n: 5 }, { id: 2, at: '2026-05-01', n: 6 }, { id: 3, at: '2025-01-01', n: 7 }];
const LAST_WEEK = ['at', 'last', { n: 7, unit: 'day' }];
const ids = (rows) => rows.map((r) => r.id);
const settle = () => new Promise((r) => setTimeout(r, 30));

test('a relative date reads the clock it is given, however deep', () => {
  assert.deepEqual(ids(filterRows(ROWS, LAST_WEEK, JUNE)), [1]);
  assert.deepEqual(ids(filterRows(ROWS, LAST_WEEK, MAY)), [2]);
  assert.deepEqual(ids(filterRows(ROWS, ['and', LAST_WEEK, ['or', ['n', 'gt', 0]]], JUNE)), [1]);
  assert.equal(filterTest(LAST_WEEK, JUNE)(ROWS[0]), true);
  assert.equal(matchesFilter(ROWS[0], LAST_WEEK, MAY), false);
  assert.deepEqual(ids(applyOptions(ROWS, { filter: LAST_WEEK, now: JUNE }).rows), [1]);
});

test('a store sends the dates of the clock it is given', async () => {
  const asked = [];
  const real = globalThis.fetch;
  globalThis.fetch = async (url) => { asked.push(String(url)); return new Response('[]', { headers: { 'content-type': 'application/json' } }); };
  try {
    await new RestStore({ url: 'https://example.test/rows' }).load({ filter: LAST_WEEK, now: JUNE });
  } finally { globalThis.fetch = real; }
  // Seven days, today among them: from the 9th, not the 8th. TODO 716
  assert.match(asked[0], /2026-06-09/);
  assert.match(asked[0], /2026-06-15/);
});

test('a source told its clock reads it for its rows, and asks again when the day moves', async () => {
  let now = JUNE;
  const source = new DataSource({ store: new ArrayStore(ROWS, { key: 'id' }), now: () => now });
  source.query.offer('data', ['at']);
  source.query.ask({ scope: 'data', hold: ['at'] });
  source.query.ask({ scope: 'data', field: 'at', reading: { tree: { op: 'last', value: { n: 7, unit: 'day' } }, mode: 'advanced' } });
  source.query.ask({ scope: 'data', commit: true });
  await source.load();
  await settle();
  assert.deepEqual(ids(source.rows), [1]);
  now = MAY;
  await source.load();
  await settle();
  assert.deepEqual(ids(source.rows), [2]);
});

test('a walk asked of a store sends the dates of its own clock', async () => {
  const seen = [];
  const reads = {
    load: async (o) => { seen.push(o.filter); return { rows: [], total: 0 }; },
    totalCount: async (o) => { seen.push(o.filter); return 0; },
    capabilities: {},
  };
  const step = { field: 'at', clause: LAST_WEEK, on: true, counts: true, ruler: 'here' };
  await walkStepwise(reads, { now: JUNE, scopes: [{ scope: 'data', after: null, steps: [step], taps: [] }] });
  assert.ok(seen.length > 0);
  assert.ok(seen.every((f) => !JSON.stringify(f ?? []).includes('"last"')), JSON.stringify(seen));
});

test('the sort language is named, not the machine\'s: the same rows, the same order', () => {
  const rows = [{ w: 'z' }, { w: 'ä' }];
  const order = () => sortRows(rows, [{ field: 'w', direction: 'asc' }]).map((r) => r.w).join('');
  try {
    setCollation('sv');
    assert.equal(order(), 'zä');
    setCollation('de');
    assert.equal(order(), 'äz');
  } finally { setCollation(); }
});

test('literal: every value ticked is still a filter, for a rule; for a reader it is none', () => {
  const query = { v: 1, scopes: { view: { holds: ['plan'], readings: { plan: { picked: ['a', 'b'] } } } } };
  const values = ['a', 'b'];
  assert.equal(compile(query, { field: () => ({ values }) }).filter, undefined);
  assert.ok(compile(query, { field: () => ({ values, literal: true }) }).filter);
});

test('replay: one Query, one set of rows, one clock, byte-equal rows, from a Query sent as JSON', async () => {
  const run = async (query) => {
    const source = new DataSource({ store: new ArrayStore(ROWS.map((r) => ({ ...r })), { key: 'id' }), now: () => JUNE });
    source.query.offer('data', ['at', 'n']);
    await source.query.setQuery(query);
    await source.load();
    await settle();
    return { rows: JSON.stringify(source.rows), out: JSON.stringify(source.query.export()) };
  };
  const query = { v: 1, scopes: { data: { holds: ['at'], sort: [{ field: 'n', direction: 'desc' }], readings: { at: { tree: { op: 'last', value: { n: 60, unit: 'day' } }, mode: 'advanced' } } } } };
  const first = await run(JSON.parse(JSON.stringify(query)));
  const second = await run(JSON.parse(first.out).query);
  assert.deepEqual(JSON.parse(first.rows).map((r) => r.id), [2, 1]);
  assert.equal(second.rows, first.rows);
  assert.equal(second.out, first.out);
});
