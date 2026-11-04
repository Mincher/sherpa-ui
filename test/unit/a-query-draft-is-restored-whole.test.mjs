/**
 * The Query editor steps its draft back and forward by putting a COPY of the draft in through the
 * Query's own whole restore: one `query-change`, the copy itself in the draft, the held values kept.
 * TRAP T-an-edit-is-a-step
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { QueryContext, Journal, VIEW } from '../../dist/data.js';

test('a draft copy put back restores the Query in one query-change, and a held value stays', async () => {
  const query = new QueryContext();
  query.ask({ scope: VIEW, hold: ['a'] });
  query.ask({ scope: VIEW, field: 'a', reading: { picked: ['1'] } });
  const before = query.draft;
  query.ask({ scope: VIEW, field: 'a', reading: { picked: ['1', '2'] } });
  query.ask({ scope: VIEW, field: 'a', suspended: true });
  const after = query.draft;
  let changes = 0;
  query.addEventListener('query-change', () => changes++);
  await query.setQuery(before, { by: 'undo' });
  assert.equal(changes, 1);
  assert.deepEqual(query.draft, before);
  await query.setQuery(after, { by: 'undo' });
  assert.deepEqual(query.draft.scopes[VIEW].readings.a.picked, ['1', '2']);
  assert.deepEqual(query.draft, after, 'off is not gone: the suspended reading comes back as it was');
});

test('the journal of drafts: capped, oldest first out; a change after a step back drops the redo tail', () => {
  const journal = new Journal(3);
  for (let i = 1; i <= 5; i++) journal.push({ before: i - 1, after: i });
  assert.equal(journal.size, 3);
  journal.back();
  journal.back();
  assert.equal(journal.back().before, 2, 'the two oldest changes dropped');
  assert.equal(journal.canForward, true);
  journal.push({ before: 2, after: 9 });
  assert.equal(journal.canForward, false);
  assert.equal(journal.peekBack().after, 9);
});
