/**
 * CONDITIONS FOR A DATE — TODO 90 with 21d. On, Before, After and Between are
 * the ops a store answers already; In the last and In the next stay RELATIVE
 * in the clause and in a saved View, and are worked out when matched.
 *
 *   node --test test/unit/date-conditions.test.mjs
 *
 * TRAP T-a-relative-date-stays-relative
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  ArrayStore, DataSource, absoluteDates, durationSpan, matchesFilter, readingsOf, whereOf,
} from '../../dist/data.js';
import { spellConditions } from '../../dist/core/data/filter-face.js';
import { fieldState, readingClause } from '../../dist/core/data/filter-state.js';

const TODAY = new Date(Date.UTC(2026, 9, 13, 15, 0));
const ago = (days) => new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);
const rows = (conditions) => ({ conditions, mode: 'advanced' });

test('a span from today is whole days, in UTC', () => {
  assert.deepEqual(durationSpan('last', { n: 7, unit: 'day' }, TODAY), ['2026-10-06', '2026-10-13']);
  assert.deepEqual(durationSpan('next', { n: 2, unit: 'week' }, TODAY), ['2026-10-13', '2026-10-27']);
  assert.deepEqual(durationSpan('last', { n: 1, unit: 'month' }, TODAY), ['2026-09-13', '2026-10-13']);
});

test('a relative clause is the between it means today, for a store that cannot work one out', () => {
  const filter = ['and', ['created', 'last', { n: 7, unit: 'day' }], ['plan', 'eq', 'Pro']];
  assert.deepEqual(absoluteDates(filter, TODAY),
    ['and', ['created', 'between', ['2026-10-06', '2026-10-13T23:59:59.999']], ['plan', 'eq', 'Pro']]);
  // Matched here, it is worked out at once — a time on its last day still counts.
  assert.equal(matchesFilter({ created: ago(3) }, ['created', 'last', { n: 7, unit: 'day' }]), true);
  assert.equal(matchesFilter({ created: `${ago(0)}T10:00` }, ['created', 'last', { n: 7, unit: 'day' }]), true);
  assert.equal(matchesFilter({ created: ago(10) }, ['created', 'last', { n: 7, unit: 'day' }]), false);
});

test('each date row is the clause it says; one with no count says nothing', () => {
  const clause = (row, time = false) => readingClause({ field: 'created', type: 'date', time }, rows([row]));
  assert.deepEqual(clause({ op: 'eq', picked: ['2026-09-03'] }), ['created', 'eq', '2026-09-03']);
  assert.deepEqual(clause({ op: 'lt', text: '2026-09-03' }), ['created', 'lt', '2026-09-03']);
  assert.deepEqual(clause({ op: 'gt', text: '2026-09-03' }), ['created', 'gt', '2026-09-03']);
  assert.deepEqual(clause({ op: 'between', picked: ['2026-09-30', '2026-09-01'] }),
    ['created', 'between', ['2026-09-01', '2026-09-30']]);
  assert.deepEqual(clause({ op: 'last', text: '7', unit: 'week' }), ['created', 'last', { n: 7, unit: 'week' }]);
  assert.deepEqual(clause({ op: 'next', text: '3' }), ['created', 'next', { n: 3, unit: 'day' }]);
  assert.equal(clause({ op: 'last', text: '' }), undefined);
  // A field that holds TIMES: a day alone is all of that day.
  assert.deepEqual(clause({ op: 'eq', picked: ['2026-09-03'] }, true),
    ['created', 'between', ['2026-09-03', '2026-09-03T23:59:59.999']]);
  assert.deepEqual(clause({ op: 'gt', text: '2026-09-03' }, true), ['created', 'gt', '2026-09-03T23:59:59.999']);
  // …and a MINUTE is all of that minute, as a day is all of that day. TODO 112
  assert.deepEqual(clause({ op: 'gt', text: '2026-09-03T14:00' }, true), ['created', 'gt', '2026-09-03T14:00:59.999']);
  assert.deepEqual(clause({ op: 'eq', picked: ['2026-09-03T14:00'] }, true),
    ['created', 'between', ['2026-09-03T14:00', '2026-09-03T14:00:59.999']]);
  assert.deepEqual(clause({ op: 'lt', text: '2026-09-03T14:00' }, true), ['created', 'lt', '2026-09-03T14:00']);
  // Between reaches the END of its last day, or its last minute.
  assert.deepEqual(clause({ op: 'between', picked: ['2026-09-30', '2026-09-01'] }, true),
    ['created', 'between', ['2026-09-01', '2026-09-30T23:59:59.999']]);
  assert.deepEqual(clause({ op: 'between', picked: ['2026-09-01T09:00', '2026-09-30T18:00'] }, true),
    ['created', 'between', ['2026-09-01T09:00', '2026-09-30T18:00:59.999']]);
  // A value with its seconds is exact.
  assert.deepEqual(clause({ op: 'gt', text: '2026-09-03T14:00:30' }, true), ['created', 'gt', '2026-09-03T14:00:30']);
});

test('a saved View keeps "in the last 7 days" relative, and reads it back as a row', () => {
  const facts = () => ({ type: 'date' });
  const where = whereOf({ created: rows([{ op: 'last', text: '7', unit: 'day' }]) }, facts);
  assert.deepEqual(where, { created: { last: 7 } });
  assert.deepEqual(whereOf({ created: rows([{ op: 'next', text: '2', unit: 'month' }]) }, facts),
    { created: { next: 2, unit: 'month' } });
  assert.deepEqual(readingsOf({ created: { next: 2, unit: 'month' } }, facts),
    { created: rows([{ op: 'next', text: '2', unit: 'month' }]) });
});

test('a date row reads in its own words', () => {
  const state = fieldState({ field: 'created', type: 'date' }, rows([
    { op: 'lt', text: '2026-09-03' },
    { join: 'or', op: 'last', text: '7', unit: 'day' },
    { join: 'or', op: 'eq', picked: ['2026-10-01'] },
  ]));
  assert.equal(spellConditions(state), 'Before: 03 Sep 2026 or In the last: 7 days or On: 01 Oct 2026');
});

test('a source filters by a date from today', async () => {
  const source = new DataSource({ store: new ArrayStore(
    [{ id: 1, created: ago(2) }, { id: 2, created: ago(20) }, { id: 3, created: ago(5) }], { key: 'id' }) });
  source.declareField('created', { type: 'date', advanced: true });
  source.query.setReading('view', 'created', { ...rows([{ op: 'last', text: '7', unit: 'day' }]), picked: [] });
  await source.load();
  assert.equal(source.debugState().total, 2);
});
