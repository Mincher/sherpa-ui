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
const advanced = (tree) => ({ tree, mode: 'advanced' });

test('a span from today is whole days, in UTC: N units, today among them (TODO 716)', () => {
  assert.deepEqual(durationSpan('last', { n: 7, unit: 'day' }, TODAY), ['2026-10-07', '2026-10-13']);
  assert.deepEqual(durationSpan('next', { n: 2, unit: 'week' }, TODAY), ['2026-10-13', '2026-10-26']);
  assert.deepEqual(durationSpan('last', { n: 1, unit: 'month' }, TODAY), ['2026-09-14', '2026-10-13']);
  // A year is twelve months. Will, TODO 688
  assert.deepEqual(durationSpan('last', { n: 1, unit: 'year' }, TODAY), ['2025-10-14', '2026-10-13']);
  assert.deepEqual(durationSpan('next', { n: 2, unit: 'year' }, TODAY), ['2026-10-13', '2028-10-12']);
  // None is today alone.
  assert.deepEqual(durationSpan('last', { n: 0, unit: 'day' }, TODAY), ['2026-10-13', '2026-10-13']);
});

test('a month or a year from a day its month does not have lands on that month\'s last day (TODO 694)', () => {
  const on = (iso) => new Date(`${iso}T12:00:00Z`);
  // As Temporal clamps: 31 March less a month is 28 February, never 3 March — so the month is 1 to 31 March.
  assert.deepEqual(durationSpan('last', { n: 1, unit: 'month' }, on('2027-03-31')), ['2027-03-01', '2027-03-31']);
  // 31 January and a month is 28 February: the month runs to the day before.
  assert.deepEqual(durationSpan('next', { n: 1, unit: 'month' }, on('2027-01-31')), ['2027-01-31', '2027-02-27']);
  assert.deepEqual(durationSpan('next', { n: 1, unit: 'month' }, on('2028-01-31')), ['2028-01-31', '2028-02-28']);
  assert.deepEqual(durationSpan('last', { n: 1, unit: 'year' }, on('2028-02-29')), ['2027-03-01', '2028-02-29']);
  assert.deepEqual(durationSpan('next', { n: 4, unit: 'year' }, on('2028-02-29')), ['2028-02-29', '2032-02-28']);
  // Across a year's end, and a day every month has.
  assert.deepEqual(durationSpan('last', { n: 2, unit: 'month' }, on('2027-01-31')), ['2026-12-01', '2027-01-31']);
  assert.deepEqual(durationSpan('next', { n: 13, unit: 'month' }, on('2026-12-15')), ['2026-12-15', '2028-01-14']);
  assert.deepEqual(durationSpan('last', { n: 1, unit: 'month' }, on('2027-05-31')), ['2027-05-01', '2027-05-31']);
});

test('a relative clause is the between it means today, for a store that cannot work one out', () => {
  const filter = ['and', ['created', 'last', { n: 7, unit: 'day' }], ['plan', 'eq', 'Pro']];
  assert.deepEqual(absoluteDates(filter, TODAY),
    ['and', ['created', 'between', ['2026-10-07', '2026-10-13T23:59:59.999']], ['plan', 'eq', 'Pro']]);
  // Matched here, it is worked out at once — a time on its last day still counts.
  assert.equal(matchesFilter({ created: ago(3) }, ['created', 'last', { n: 7, unit: 'day' }]), true);
  assert.equal(matchesFilter({ created: `${ago(0)}T10:00` }, ['created', 'last', { n: 7, unit: 'day' }]), true);
  assert.equal(matchesFilter({ created: ago(10) }, ['created', 'last', { n: 7, unit: 'day' }]), false);
  // Seven days, today among them: the sixth day back is in, the seventh is not. TODO 716
  assert.equal(matchesFilter({ created: ago(6) }, ['created', 'last', { n: 7, unit: 'day' }]), true);
  assert.equal(matchesFilter({ created: ago(7) }, ['created', 'last', { n: 7, unit: 'day' }]), false);
});

test('each date leaf is the clause it says; one with no count says nothing', () => {
  const clause = (tree, time = false) => readingClause({ field: 'created', type: 'date', time }, advanced(tree));
  assert.deepEqual(clause({ op: 'eq', value: '2026-09-03' }), ['created', 'eq', '2026-09-03']);
  assert.deepEqual(clause({ op: 'lt', value: '2026-09-03' }), ['created', 'lt', '2026-09-03']);
  assert.deepEqual(clause({ op: 'gt', value: '2026-09-03' }), ['created', 'gt', '2026-09-03']);
  assert.deepEqual(clause({ op: 'between', value: ['2026-09-30', '2026-09-01'] }),
    ['created', 'between', ['2026-09-01', '2026-09-30']]);
  assert.deepEqual(clause({ op: 'last', value: { n: 7, unit: 'week' } }), ['created', 'last', { n: 7, unit: 'week' }]);
  assert.deepEqual(clause({ op: 'next', value: { n: 3, unit: 'day' } }), ['created', 'next', { n: 3, unit: 'day' }]);
  assert.equal(clause({ op: 'last' }), undefined);
  // A field that holds TIMES: a day alone is all of that day.
  assert.deepEqual(clause({ op: 'eq', value: '2026-09-03' }, true),
    ['created', 'between', ['2026-09-03', '2026-09-03T23:59:59.999']]);
  assert.deepEqual(clause({ op: 'gt', value: '2026-09-03' }, true), ['created', 'gt', '2026-09-03T23:59:59.999']);
  // …and a MINUTE is all of that minute, as a day is all of that day. TODO 112
  assert.deepEqual(clause({ op: 'gt', value: '2026-09-03T14:00' }, true), ['created', 'gt', '2026-09-03T14:00:59.999']);
  assert.deepEqual(clause({ op: 'eq', value: '2026-09-03T14:00' }, true),
    ['created', 'between', ['2026-09-03T14:00', '2026-09-03T14:00:59.999']]);
  assert.deepEqual(clause({ op: 'lt', value: '2026-09-03T14:00' }, true), ['created', 'lt', '2026-09-03T14:00']);
  // Between reaches the END of its last day, or its last minute.
  assert.deepEqual(clause({ op: 'between', value: ['2026-09-30', '2026-09-01'] }, true),
    ['created', 'between', ['2026-09-01', '2026-09-30T23:59:59.999']]);
  assert.deepEqual(clause({ op: 'between', value: ['2026-09-01T09:00', '2026-09-30T18:00'] }, true),
    ['created', 'between', ['2026-09-01T09:00', '2026-09-30T18:00:59.999']]);
  // A value with its seconds is exact.
  assert.deepEqual(clause({ op: 'gt', value: '2026-09-03T14:00:30' }, true), ['created', 'gt', '2026-09-03T14:00:30']);
});

test('a saved View keeps "in the last 7 days" relative, and reads it back as a row', () => {
  const facts = () => ({ type: 'date' });
  const where = whereOf({ created: advanced({ op: 'last', value: { n: 7, unit: 'day' } }) }, facts);
  assert.deepEqual(where, { created: { last: 7 } });
  assert.deepEqual(whereOf({ created: advanced({ op: 'next', value: { n: 2, unit: 'month' } }) }, facts),
    { created: { next: 2, unit: 'month' } });
  assert.deepEqual(readingsOf({ created: { next: 2, unit: 'month' } }, facts),
    { created: advanced({ op: 'next', value: { n: 2, unit: 'month' } }) });
});

test('a date row reads in its own words', () => {
  const state = fieldState({ field: 'created', type: 'date' }, advanced({ or: [{ op: 'lt', value: '2026-09-03' }, { op: 'last', value: { n: 7, unit: 'day' } }, { op: 'eq', value: '2026-10-01' }] }));
  // Each condition's word and its value in brackets. Will, TODO 409
  assert.equal(spellConditions(state), 'before(03 Sep 2026) OR last(7 days) OR on(01 Oct 2026)');
  // …and Years, one and many. Will, TODO 688
  const years = (text) => spellConditions(fieldState({ field: 'created', type: 'date' }, advanced({ op: 'next', value: { n: Number(text), unit: 'year' } })));
  assert.equal(years('1'), 'next(1 year)');
  assert.equal(years('2'), 'next(2 years)');
});

test('a source filters by a date from today', async () => {
  const source = new DataSource({ store: new ArrayStore(
    [{ id: 1, created: ago(2) }, { id: 2, created: ago(20) }, { id: 3, created: ago(5) }], { key: 'id' }) });
  source.declareField('created', { type: 'date', advanced: true });
  source.query.ask({ scope: 'view', field: 'created', reading: { ...advanced({ op: 'last', value: { n: 7, unit: 'day' } }), picked: [] } });
  await source.load();
  assert.equal(source.debugState().total, 2);
});
