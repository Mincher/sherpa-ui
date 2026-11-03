/**
 * A SWITCH OF MODE ASKS NO APPLY — Will, TODO 593. What is judged is the answer in
 * force: rows carried over from the picks say what the picks say. Rows that say
 * something else are a change, and still ask.
 *
 *   node --test test/unit/a-mode-switch-asks-no-apply.test.mjs
 *
 * TRAP T-both-answers-are-kept
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { sameAnswer } from '../../dist/core/data/query.js';

const SIMPLE = { picked: ['Pro', 'Free'], mode: 'simple' };
const ROWS = [{ op: 'eq', picked: ['Pro'] }, { op: 'eq', join: 'or', picked: ['Free'] }];

test('picks and the rows that mirror them are one answer, either way', () => {
  const advanced = { picked: ['Pro', 'Free'], conditions: ROWS, mode: 'advanced', mirror: true };
  assert.equal(sameAnswer(SIMPLE, advanced), true);
  assert.equal(sameAnswer(advanced, SIMPLE), true);
  // A band's rows are its ends, and mirror its pick all the same.
  assert.equal(sameAnswer({ picked: ['At risk'], mode: 'simple' },
    { picked: ['At risk'], tree: { op: 'lt', value: '60' }, mode: 'advanced', mirror: true }), true);
});

test('a number or a date carries its answer over with no mirror: the same rows, the same answer', () => {
  assert.equal(sameAnswer({ picked: ['2026-01-05'], mode: 'simple' },
    { picked: ['2026-01-05'], tree: { op: 'eq', value: '2026-01-05' }, mode: 'advanced' }), true);
  assert.equal(sameAnswer({ op: 'gt', text: '5', mode: 'simple' },
    { op: 'gt', text: '5', tree: { op: 'gt', value: '5' }, mode: 'advanced' }), true);
});

test('what the other mode keeps is no change; nothing answered is the same as nothing', () => {
  assert.equal(sameAnswer(SIMPLE, { ...SIMPLE, tree: { op: 'contains', value: 'x' } }), true);
  assert.equal(sameAnswer(undefined, { picked: [], mode: 'advanced', tree: undefined }), true);
  assert.equal(sameAnswer(undefined, { tree: undefined, mode: 'advanced' }), true, 'a row half built');
  assert.equal(sameAnswer({ picked: ['Pro', 'Free'] }, { picked: ['Free', 'Pro'] }), true, 'picks in any order');
});

test('a real change still asks', () => {
  assert.equal(sameAnswer(SIMPLE, { ...SIMPLE, picked: ['Pro'] }), false);
  // Rows the reader edited, or kept from before, say something else.
  assert.equal(sameAnswer(SIMPLE, { picked: ['Pro', 'Free'], tree: { op: 'eq', value: 'Pro' }, mode: 'advanced' }), false);
  assert.equal(sameAnswer(SIMPLE, { ...SIMPLE, suspended: true }), false);
  assert.equal(sameAnswer(SIMPLE, { ...SIMPLE, byPreset: { p: { label: 'P', scope: 'data', rows: [] } } }), false);
  assert.equal(sameAnswer(undefined, SIMPLE), false);
});
