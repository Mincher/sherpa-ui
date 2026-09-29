/**
 * THE DEF SPEAKS THE NEW WORDS — and still hears the old ones.
 *
 * A filter def says `custom: true | 'only'`: a Custom Condition Filter beside
 * its values, or instead of them. It said `conditions`, and that kind was
 * `conditional`. Both old words are still read.
 *
 *   node --test test/unit/the-def-speaks-the-new-words.test.mjs
 *
 * TRAP T-a-renamed-attribute-keeps-its-old-name
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { FILTER_KINDS, advancedOf, hasOwnBody, kindOf } from '../../dist/core/ui/filter-kind.js';

test('a def says custom, and its kind is custom', () => {
  assert.equal(kindOf({ id: 'email', custom: 'only' }), 'advanced');
  assert.equal(advancedOf({ advanced: true }), true);
  assert.equal(advancedOf({ advanced: 'only' }), 'only');
  // The name before 2026-09-29 (TODO 75), still read.
  assert.equal(advancedOf({ custom: true }), true);
  assert.equal(advancedOf({ custom: 'only' }), 'only');
  assert.equal(advancedOf({}), false);
  assert.ok(FILTER_KINDS.includes('advanced'));
  assert.ok(!FILTER_KINDS.includes('conditional'));
  assert.equal(hasOwnBody('advanced'), true);
  // Beside a list of values, the kind is still what the list is.
  assert.equal(kindOf({ id: 'owner', custom: true, select: 'single', options: [{}] }), 'single');
});

test('the old key and the old kind are still read', () => {
  assert.equal(kindOf({ id: 'email', conditions: 'only' }), 'advanced');
  assert.equal(kindOf({ id: 'email', kind: 'conditional' }), 'advanced');
  // …and the word before this one. TODO 75
  assert.equal(kindOf({ id: 'email', kind: 'custom' }), 'advanced');
  assert.equal(advancedOf({ conditions: true }), true);
  assert.equal(advancedOf({ conditions: 'only' }), 'only');
  // The NEW key wins where a def names both.
  assert.equal(advancedOf({ custom: false, conditions: true }), false);
});
