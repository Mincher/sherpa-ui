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
  const two = face({ type: 'number' }, { picked: ['37', '120'], range: true });
  assert.equal(two.value, '37 to 120');
  assert.equal(two.tip, '37 to 120');
  assert.equal(two.current, true);

  const one = face({ type: 'number' }, { picked: ['12'], range: false });
  assert.equal(one.value, '12');
  assert.equal(one.tip, '12');

  // A typed op is a CONDITION, and its tip counts it. TRAP T-a-condition-tip-counts-its-rows
  const typed = face({ type: 'number' }, { picked: [], op: 'gte', text: '100', range: false });
  assert.equal(typed.value, '100');
  assert.equal(typed.tip, '1 condition applied');
});

test('an EMPTY value list is "nothing to pick" — the mistake the chip made', () => {
  assert.equal(face({ type: 'number', values: [] }, { picked: ['37', '120'], range: true }).tip, '');
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
