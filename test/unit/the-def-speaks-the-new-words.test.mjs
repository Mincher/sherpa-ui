/**
 * THE DEF SPEAKS THE NEW WORDS, and only those.
 *
 * A filter def says `advanced: true | 'only'`: Advanced conditions beside its
 * values, or instead of them. It said `custom`, and before that `conditions`,
 * whose kind was `conditional`. The old words do nothing now.
 *
 *   node --test test/unit/the-def-speaks-the-new-words.test.mjs
 *
 * TRAP T-a-rename-drops-the-old-name
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { FILTER_KINDS, advancedOf, hasOwnBody, kindOf } from '../../dist/core/ui/filter-kind.js';

test('a def says advanced, and its kind is advanced', () => {
  assert.equal(kindOf({ id: 'email', advanced: 'only' }), 'advanced');
  assert.equal(advancedOf({ advanced: true }), true);
  assert.equal(advancedOf({ advanced: 'only' }), 'only');
  assert.equal(advancedOf({}), false);
  assert.ok(FILTER_KINDS.includes('advanced'));
  assert.ok(!FILTER_KINDS.includes('conditional'));
  assert.equal(hasOwnBody('advanced'), true);
  // Beside a list of values, the kind is still what the list is.
  assert.equal(kindOf({ id: 'owner', advanced: true, select: 'single', options: [{}] }), 'single');
});

test('the old keys and the old kinds do nothing', () => {
  for (const old of [{ custom: 'only' }, { conditions: 'only' }, { kind: 'conditional' }, { kind: 'custom' }]) {
    assert.equal(kindOf({ id: 'email', ...old }), 'boolean', JSON.stringify(old));
  }
  assert.equal(advancedOf({ custom: true }), false);
  assert.equal(advancedOf({ conditions: 'only' }), false);
});
