/**
 * The read plan: each row of the decision, on plain inputs. TRAP T-a-read-is-planned
 *
 *   node --test test/unit/the-read-plan.test.mjs
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { planRead } from '../../dist/core/data/read-plan.js';

const base = {
  need: { cap: 100 },
  held: { set: null, never: false, over: 0, failedAt: 0 },
  history: { announcesAll: true, since: 0 },
  reach: { tried: false },
};
const at = (patch) => planRead({ ...base, ...patch, held: { ...base.held, ...patch.held } });
const set = (more = {}) => ({ size: 10, gen: 1, due: false, ...more });

test('no set: fetch it, unless the store refuses one or a read failed at this cap', () => {
  assert.deepEqual(at({}), { plan: 'fetch', behind: false });
  assert.deepEqual(at({ held: { never: true } }), { plan: 'store', behind: false });
  assert.deepEqual(at({ held: { over: 100 } }), { plan: 'store', behind: false });
  assert.deepEqual(at({ held: { over: 50 } }), { plan: 'fetch', behind: false });
  assert.deepEqual(at({ held: { failedAt: 100 } }), { plan: 'store', behind: false });
  // A smaller cap than the one that failed may still try.
  assert.deepEqual(at({ held: { failedAt: 500 } }), { plan: 'fetch', behind: false });
});

test('a set too big for the page, or due with no read that may be sent: the store', () => {
  assert.deepEqual(at({ held: { set: set({ size: 101 }) } }), { plan: 'store', behind: false });
  assert.deepEqual(at({ held: { set: set({ due: true }), over: 100 } }), { plan: 'store', behind: false });
  assert.deepEqual(at({ held: { set: set({ due: true }), never: true } }), { plan: 'store', behind: false });
});

test('a due set is read first; a failed read keeps it, unconfirmed, and checks behind once', () => {
  assert.deepEqual(at({ held: { set: set({ due: true }) } }), { plan: 'fetch', behind: false });
  assert.deepEqual(at({ held: { set: set({ due: true }), failedAt: 100 } }), { plan: 'held-stale', behind: true });
  assert.deepEqual(at({ held: { set: set(), failedAt: 100 }, reach: { tried: true } }), { plan: 'held-stale', behind: false });
});

test('a set held before the page, over a store that may miss a writer: shown at once, checked behind', () => {
  const history = { announcesAll: false, since: 1 };
  assert.deepEqual(at({ held: { set: set({ gen: 1 }) }, history }), { plan: 'held-stale', behind: true });
  assert.deepEqual(at({ held: { set: set({ gen: 1 }) }, history, reach: { tried: true } }), { plan: 'held-stale', behind: false });
  // Read since the page was made: current.
  assert.deepEqual(at({ held: { set: set({ gen: 2 }) }, history }), { plan: 'held', behind: false });
});

test('a store whose every change comes through it: its set is current', () => {
  assert.deepEqual(at({ held: { set: set() } }), { plan: 'held', behind: false });
});
