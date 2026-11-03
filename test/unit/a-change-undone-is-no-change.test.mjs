/**
 * A CHANGE UNDONE IS NO CHANGE — TODO 518 (D1). A scope waits for Apply: change
 * one field and put it back, and the scope reads clean, as each field does. The
 * order the fields were written in, or the picks, is no change.
 *
 *   node --test test/unit/a-change-undone-is-no-change.test.mjs
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { QueryContext, VIEW } from '../../dist/data.js';

test('a field changed and put back leaves its waiting scope clean', () => {
  const query = new QueryContext();
  query.ask({ scope: VIEW, hold: ['a', 'b'] });
  query.ask({ scope: VIEW, field: 'a', reading: { picked: ['1'] } });
  query.ask({ scope: VIEW, field: 'b', reading: { picked: ['2'] } });
  query.wait(VIEW);
  query.ask({ scope: VIEW, field: 'a', reading: { picked: ['9'] } });
  assert.equal(query.dirty(VIEW), true);
  assert.equal(query.pending('a'), true);
  query.ask({ scope: VIEW, field: 'a', reading: { picked: ['1'] } });
  assert.equal(query.pending('a'), false);
  assert.equal(query.pending('b'), false);
  assert.equal(query.dirty(VIEW), false, 'the same answers, written in another order');
  assert.equal(query.dirty(), false);
});

test('picks in another order are no change; a field added or taken away is', () => {
  const query = new QueryContext();
  query.ask({ scope: VIEW, hold: ['a', 'b'] });
  query.ask({ scope: VIEW, field: 'a', reading: { picked: ['1', '2'] } });
  query.wait(VIEW);
  query.ask({ scope: VIEW, field: 'a', reading: { picked: ['2', '1'] } });
  assert.equal(query.dirty(VIEW), false);
  query.ask({ scope: VIEW, field: 'b', reading: { picked: ['3'] } });
  assert.equal(query.dirty(VIEW), true);
  query.ask({ scope: VIEW, field: 'b', reading: null });
  assert.equal(query.dirty(VIEW), false);
  query.ask({ scope: VIEW, field: 'a', reading: null });
  assert.equal(query.dirty(VIEW), true);
});
