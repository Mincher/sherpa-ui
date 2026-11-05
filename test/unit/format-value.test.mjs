/**
 * A VALUE READS IN WORDS — TODO 791: a field's value as a grid's cell draws it.
 *
 *   node --test test/unit/format-value.test.mjs
 *
 * TRAP T-a-cell-draws-words-not-its-value
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { formatFieldValue } from '../../dist/core/data/format-value.js';

test('a value its field names reads by that name: a boolean by its key, never the prototype', () => {
  const labels = { true: 'On', false: 'Off', AMER: 'Americas' };
  assert.equal(formatFieldValue(true, { labels }), 'On');
  assert.equal(formatFieldValue(false, { labels }), 'Off');
  assert.equal(formatFieldValue('AMER', { labels }), 'Americas');
  // Unnamed, as its chip lists it.
  assert.equal(formatFieldValue(true), 'true');
  assert.equal(formatFieldValue('constructor', { labels }), 'constructor');
});

test('a day reads the one way, in UTC; with a time, its time too; not a day, as given', () => {
  assert.equal(formatFieldValue('2026-11-04', { type: 'date' }), '04 Nov 2026');
  assert.equal(formatFieldValue('2026-01-01T23:30:00Z', { type: 'date' }), '01 Jan 2026');
  assert.equal(formatFieldValue('2026-01-05T09:30:00Z', { type: 'date', time: true }), '05 Jan 2026, 09:30');
  assert.equal(formatFieldValue(new Date(Date.UTC(2026, 0, 5))), '05 Jan 2026');
  assert.equal(formatFieldValue('soon', { type: 'date' }), 'soon');
  assert.equal(formatFieldValue(new Date(Number.NaN)), '');
});

test('a list reads as a list, each part as its field reads it; an object by its parts', () => {
  assert.equal(formatFieldValue(['VIP', 'Legacy']), 'VIP, Legacy');
  assert.equal(formatFieldValue(['2026-01-05', '2026-02-01'], { type: 'date' }), '05 Jan 2026, 01 Feb 2026');
  assert.equal(formatFieldValue([true, false], { labels: { true: 'On', false: 'Off' } }), 'On, Off');
  assert.equal(formatFieldValue({ building: 'B2', floor: 0, note: '' }), 'building: B2, floor: 0');
  // A named object — a tiered pick — reads by its name.
  assert.equal(formatFieldValue({ customer: 'Contoso', site: 'Leeds' }, { labels: { '{customer:Contoso,site:Leeds}': 'Leeds' } }), 'Leeds');
});

test('none reads as nothing; a 0 and a number as themselves', () => {
  for (const none of [null, undefined, '', []]) assert.equal(formatFieldValue(none), '');
  assert.equal(formatFieldValue(0), '0');
  assert.equal(formatFieldValue(48213, { type: 'number' }), '48213');
});
