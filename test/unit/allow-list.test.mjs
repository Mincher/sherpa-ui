/**
 * THE ALLOW-LIST, ON ANY AXIS.
 *
 * One primitive for fields, values, states and actions. The two rules that
 * matter are easy to get wrong and invisible when they are:
 *
 *   - NO LIST allows everything. A component that never hears about this must
 *     behave exactly as it did, so `null` cannot mean "nothing".
 *   - A list says WHICH, never in what ORDER. Returning the list's order would
 *     silently replace a component's own sort with a caller's typing order.
 *
 *   node --test test/unit/allow-list.test.mjs
 *
 * TRAP T-an-allow-list-is-a-filter-not-an-order
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  allow,
  isAllowed,
  allowKey,
  unknownEntries,
  nextState,
} from '../../dist/data.js';

/* ── No list allows everything ──────────────────────────────────────── */

test('no list allows everything — the default cannot mean "nothing"', () => {
  const items = ['a', 'b', 'c'];
  assert.deepEqual(allow(items, null), items);
  assert.deepEqual(allow(items, undefined), items);
  assert.equal(isAllowed('anything', null), true);
  assert.equal(isAllowed('anything', undefined), true);

  // A copy, not the same array — a caller must not be able to mutate the source.
  assert.notEqual(allow(items, null), items);
});

test('an EMPTY list allows nothing — it is a list, and it names no one', () => {
  assert.deepEqual(allow(['a', 'b'], []), []);
  assert.equal(isAllowed('a', []), false);
});

/* ── It filters; it does not re-order ───────────────────────────────── */

test('the result keeps the ITEMS order, not the list order', () => {
  const items = ['alpha', 'beta', 'gamma'];
  // The list is written backwards on purpose.
  assert.deepEqual(allow(items, ['gamma', 'alpha']), ['alpha', 'gamma']);
});

test('a duplicate in the list does not duplicate the item', () => {
  assert.deepEqual(allow(['a', 'b'], ['a', 'a', 'a']), ['a']);
});

/* ── Identity ───────────────────────────────────────────────────────── */

test('an item is named by id, then value, then field', () => {
  assert.equal(allowKey({ id: 'x', value: 'y', field: 'z' }), 'x');
  assert.equal(allowKey({ value: 'y', field: 'z' }), 'y');
  assert.equal(allowKey({ field: 'z' }), 'z');
  assert.equal(allowKey('bare'), 'bare');
});

test('an object item meets a bare string on the list', () => {
  const defs = [
    { id: 'seats', label: 'Seats' },
    { id: 'spend', label: 'Spend' },
  ];
  assert.deepEqual(allow(defs, ['spend']), [{ id: 'spend', label: 'Spend' }]);
});

test('a filter def and the field it is listed under still meet', () => {
  // `id` wins, so a def listed by its own id matches whichever shape is passed.
  const defs = [{ id: 'region', field: 'region', label: 'Region' }];
  assert.equal(allow(defs, ['region']).length, 1);
  assert.equal(allow(defs, [{ id: 'region' }]).length, 1);
});

/* ── A list entry with nothing behind it ────────────────────────────── */

test('an entry naming nothing is REPORTED, and the rest still work', () => {
  const items = ['a', 'b'];
  // `zzz` is a typo, or a field that has gone.
  assert.deepEqual(allow(items, ['a', 'zzz']), ['a']);
  assert.deepEqual(unknownEntries(items, ['a', 'zzz']), ['zzz']);
  // No list, nothing to report.
  assert.deepEqual(unknownEntries(items, null), []);
  // Reported ONCE, however often it is written.
  assert.deepEqual(unknownEntries(items, ['zzz', 'zzz']), ['zzz']);
});

/* ── States: a toggle and a cycle are the same control ──────────────── */

test('a two-state list and a three-state list step the same way', () => {
  const toggle = ['off', 'on'];
  assert.equal(nextState(toggle, 'off'), 'on');
  assert.equal(nextState(toggle, 'on'), 'off');

  const tri = ['asc', 'desc', 'off'];
  assert.equal(nextState(tri, 'asc'), 'desc');
  assert.equal(nextState(tri, 'desc'), 'off');
  assert.equal(nextState(tri, 'off'), 'asc');
});

test('an unknown current state starts the cycle, never strands the control', () => {
  // The value was removed from the list while the control still held it.
  assert.equal(nextState(['a', 'b'], 'gone'), 'a');
  assert.equal(nextState(['a', 'b'], null), 'a');
  assert.equal(nextState(['a', 'b'], undefined), 'a');
});

test('an empty state list has no state to be in', () => {
  assert.equal(nextState([], 'a'), undefined);
});

test('states may be objects, matched by the same key', () => {
  const states = [{ id: 'off' }, { id: 'on' }];
  assert.deepEqual(nextState(states, { id: 'off' }), { id: 'on' });
  assert.deepEqual(nextState(states, 'on'), { id: 'off' });
});
