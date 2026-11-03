/**
 * WHAT IS NEW WAITS UNTIL IT IS TAKEN — plan 687 U1. A page holds its news in one
 * `Updates`: a new version, each store's rows, the lost saves. A dismiss hides a
 * kind until its next notice; taking it in clears it.
 * TRAP T-a-notice-is-heard-never-ordered
 *
 *   node --test test/unit/what-is-new-waits-until-taken.test.mjs
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { Updates } from '../../dist/data.js';

/** Every change an `Updates` says. */
function heard(updates) {
  const said = [];
  updates.addEventListener('change', (event) => said.push(event.detail));
  return said;
}

test('a new version shows; dismissed, it hides until the next', () => {
  const updates = new Updates();
  assert.equal(updates.shows('app'), false);
  updates.hear({ kind: 'app' });
  assert.equal(updates.shows('app'), true);
  updates.dismiss('app');
  assert.equal(updates.shows('app'), false);
  assert.equal(updates.waiting.app, true, 'dismissed is not gone');
  updates.hear({ kind: 'app' });
  assert.equal(updates.shows('app'), true);
});

test('each store\'s rows wait on their own; taken, one store or all', () => {
  const updates = new Updates();
  updates.hear({ kind: 'data', store: 'customers', rows: 3 });
  updates.hear({ kind: 'data', store: 'alerts' });
  assert.deepEqual([...updates.waiting.data], [['customers', 3], ['alerts', undefined]]);
  updates.take('data', 'customers');
  assert.deepEqual([...updates.waiting.data.keys()], ['alerts']);
  assert.equal(updates.shows('data'), true);
  updates.take('data');
  assert.equal(updates.shows('data'), false);
});

test('a lost save said again is one; seen, it goes and says so', () => {
  const updates = new Updates();
  const said = heard(updates);
  const lost = { kind: 'lost', id: 'customers|a@b.c|1', key: 'a@b.c', why: 'conflict' };
  updates.hear(lost);
  updates.hear({ ...lost });
  assert.equal(updates.waiting.lost.length, 1);
  assert.equal(said.length, 1);
  updates.take('lost', lost.id);
  assert.equal(updates.shows('lost'), false);
  assert.deepEqual(said.at(-1), { taken: { kind: 'lost', key: lost.id } });
});

test('a change says the notice it heard', () => {
  const updates = new Updates();
  const said = heard(updates);
  updates.hear({ kind: 'data', store: 'customers' });
  assert.deepEqual(said, [{ notice: { kind: 'data', store: 'customers' } }]);
  updates.dismiss('data');
  updates.dismiss('data');
  assert.equal(said.length, 2, 'a second dismiss is no change');
});
