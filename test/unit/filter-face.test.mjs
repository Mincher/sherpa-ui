/**
 * HOW AN ANSWER READS — the words a chip, a tip or a label shows for a field.
 *
 * A range reads as a range and a day as a day, in the one place every control
 * asks. Will, TODO 130: number and date chips said nothing at all.
 *
 *   node --test test/unit/filter-face.test.mjs
 *
 * TRAP T-a-chip-says-its-own-answer · TRAP T-a-date-reads-one-way
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { fieldState, filterFace, formatDate } from '../../dist/data.js';

const face = (facts, reading) => filterFace(fieldState({ field: 'f', ...facts }, reading));

test('a number with no list: its picks are its values', () => {
  // A number's range is an Advanced Between row (TODO 375): it reads as its condition. TODO 409
  const two = face({ type: 'number' }, { conditions: [{ op: 'between', picked: ['37', '120'] }], mode: 'advanced' });
  assert.equal(two.value, 'between(37, 120)');
  assert.equal(two.tip, 'between(37, 120)');
  assert.equal(two.current, true);

  const one = face({ type: 'number' }, { picked: ['12'], range: false });
  assert.equal(one.value, '12');
  assert.equal(one.tip, '12');

  // A typed op is a CONDITION, and reads as one. TRAP T-an-advanced-answer-reads-as-its-conditions
  const typed = face({ type: 'number' }, { picked: [], op: 'gte', text: '100', range: false });
  assert.equal(typed.value, 'atLeast(100)');
  assert.equal(typed.tip, 'atLeast(100)');
});

test('an EMPTY value list is "nothing to pick" — the mistake the chip made', () => {
  assert.equal(face({ type: 'number', values: [] }, { picked: ['37'] }).tip, '');
});

test('a date reads as a day, and two as a span', () => {
  const span = face({ type: 'date' }, { picked: ['2024-01-05', '2024-02-06'], range: true });
  assert.equal(span.value, formatDate('2024-01-05', '2024-02-06'));
  assert.equal(span.tip, span.value);

  const day = face({ type: 'date' }, { picked: ['2024-01-05'], range: false });
  assert.equal(day.value, formatDate('2024-01-05'));
});

test('a list is unchanged: the first pick and an ellipsis, every pick in the tip', () => {
  const list = face({ values: ['active', 'trial', 'churned'] }, { picked: ['active', 'trial'] });
  assert.equal(list.value, 'active…');
  assert.equal(list.tip, 'active, trial');
});

/* Will, TODO 409: each condition before its value in brackets, the join
   between, `!` before a negative one. It was the values alone (TODO 139). */
test('chained rows read as their conditions: `startsWith(U) OR contains(an)`', () => {
  const typed = face({ values: ['Una', 'Dana'] }, { picked: [], mode: 'advanced', conditions: [
    { op: 'startswith', text: 'U' }, { op: 'contains', text: 'an', join: 'or' }] });
  assert.equal(typed.value, 'startsWith(U) OR contains(an)');
  assert.equal(typed.condition, '');
  assert.equal(typed.tip, typed.value);

  // A row that picks from the list shows its picks, by their labels.
  const picked = face({ values: ['a', 'b'], labels: { a: 'Alpha', b: 'Beta' } }, { picked: [], mode: 'advanced', conditions: [
    { op: 'eq', picked: ['a'] }, { op: 'ne', picked: ['b'], join: 'and' }] });
  assert.equal(picked.value, 'equals(Alpha) AND !equals(Beta)');
});
