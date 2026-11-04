/**
 * A STORE'S JOURNAL — 561. Opt in with `journal: N`: the last N updates, each the row before
 * and after, step back with undo() and forward with redo(), each an ordinary update the
 * readers hear. A new edit after an undo clears the redo tail; the cap drops the oldest; an
 * insert or a remove ends it; with no option a store keeps nothing.
 * TRAP T-a-store-keeps-its-history
 *
 *   node --test test/unit/a-store-journal-steps-back-and-forward.test.mjs
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { ArrayStore, Journal } from '../../dist/data.js';

const rows = () => [{ id: 1, name: 'Ada', seats: 10 }, { id: 2, name: 'Bo', seats: 20 }];
const row = async (s, id) => (await s.byKey(id));

test('Journal: back and forward in order; a push after a step back clears what was stepped back from', () => {
  const j = new Journal(10);
  j.push({ before: 0, after: 1 });
  j.push({ before: 1, after: 2 });
  j.push({ before: 2, after: 3 });
  assert.deepEqual([j.back()?.after, j.back()?.after], [3, 2]);
  assert.equal(j.canForward, true);
  assert.equal(j.forward()?.after, 2);
  j.push({ before: 2, after: 9 });
  assert.equal(j.canForward, false);
  assert.equal(j.size, 3);
  assert.deepEqual([j.back()?.after, j.back()?.after, j.back()?.after], [9, 2, 1]);
});

test('Journal: the cap drops the OLDEST; merge folds a change into the last', () => {
  const j = new Journal(2);
  for (let i = 0; i < 4; i++) j.push({ before: i, after: i + 1 });
  assert.equal(j.size, 2);
  assert.equal(j.back()?.before, 3);
  assert.equal(j.back()?.before, 2);
  assert.equal(j.back(), undefined);
  j.clear();
  j.push({ before: 0, after: 1 });
  j.push({ before: 1, after: 2 }, (last, next) => ({ before: last.before, after: next.after }));
  assert.equal(j.size, 1);
  assert.deepEqual(j.back(), { before: 0, after: 2 });
});

test('a store with a journal: undo and redo are updates the readers hear; the rows come back whole', async () => {
  const s = new ArrayStore(rows(), { journal: 5 });
  const heard = [];
  s.addEventListener('change', (e) => heard.push(e.detail.type + ':' + e.detail.key));
  await s.update(1, { name: 'Ann' });
  await s.update(1, { seats: 11 });
  assert.deepEqual([s.canUndo, s.canRedo], [true, false]);
  assert.equal(await s.undo(), true);
  assert.deepEqual(await row(s, 1), { id: 1, name: 'Ann', seats: 10 });
  assert.equal(await s.undo(), true);
  assert.deepEqual(await row(s, 1), { id: 1, name: 'Ada', seats: 10 });
  assert.equal(await s.undo(), false);
  assert.equal(await s.redo(), true);
  assert.equal(await s.redo(), true);
  assert.deepEqual(await row(s, 1), { id: 1, name: 'Ann', seats: 11 });
  assert.equal(await s.redo(), false);
  // Two edits, two undos, two redos: each one announced as an update.
  assert.deepEqual(heard, Array(6).fill('update:1'));
});

test('a new edit after an undo clears the redo tail; the cap drops the oldest edit', async () => {
  const s = new ArrayStore(rows(), { journal: 2 });
  await s.update(1, { seats: 1 });
  await s.update(1, { seats: 2 });
  await s.update(1, { seats: 3 });
  await s.undo();
  await s.update(1, { seats: 4 });
  assert.equal(s.canRedo, false);
  assert.equal(await s.undo(), true);
  assert.equal((await row(s, 1)).seats, 2);
  assert.equal(await s.undo(), true);
  assert.equal((await row(s, 1)).seats, 1);
  // The cap was 2: the first edit (10 to 1) is gone, so seats cannot go back to 10.
  assert.equal(await s.undo(), false);
});

test('an insert or a remove ends the journal: it cannot vouch past them', async () => {
  const s = new ArrayStore(rows(), { journal: 5 });
  await s.update(1, { seats: 1 });
  await s.insert({ id: 3, name: 'Cy', seats: 30 });
  assert.deepEqual([s.canUndo, await s.undo()], [false, false]);
  await s.update(1, { seats: 2 });
  await s.remove(3);
  assert.equal(s.canUndo, false);
});

test('off by default: a store keeps no journal, and undo says there is nothing', async () => {
  const s = new ArrayStore(rows());
  await s.update(1, { seats: 1 });
  assert.deepEqual([s.canUndo, s.canRedo, await s.undo(), await s.redo()], [false, false, false, false]);
});
