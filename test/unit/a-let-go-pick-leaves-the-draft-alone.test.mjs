/**
 * A PICK LET GO LEAVES THE READER'S DRAFT ALONE — TODO 518 (D6). The filters
 * before a field rule a pick out: it leaves what is APPLIED (512 A), and the
 * draft too while the draft is still the applied answer. A draft the reader
 * changed and has not applied is theirs: it keeps what they picked.
 *
 *   node --test test/unit/a-let-go-pick-leaves-the-draft-alone.test.mjs
 *
 * TRAP T-a-ruled-out-value-is-greyed
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { QueryContext, VIEW } from '../../dist/data.js';

const picks = (query, which) => query[which].scopes[VIEW]?.readings.region?.picked ?? null;

test('a waiting draft the reader changed keeps its picks; the applied answer lets go', () => {
  const query = new QueryContext();
  query.ask({ scope: VIEW, hold: ['region'] });
  query.ask({ scope: VIEW, field: 'region', reading: { picked: ['EU', 'US'] } });
  query.wait(VIEW);
  query.ask({ scope: VIEW, field: 'region', reading: { picked: ['US'] } });
  query.ask({ scope: VIEW, field: 'region', letGo: ['US'] });
  assert.deepEqual(picks(query, 'applied'), ['EU']);
  assert.deepEqual(picks(query, 'draft'), ['US']);
});

test('a draft still as applied lets go with it', () => {
  const query = new QueryContext();
  query.ask({ scope: VIEW, hold: ['region'] });
  query.ask({ scope: VIEW, field: 'region', reading: { picked: ['EU', 'US'] } });
  query.wait(VIEW);
  query.ask({ scope: VIEW, field: 'region', letGo: ['US'] });
  assert.deepEqual(picks(query, 'applied'), ['EU']);
  assert.deepEqual(picks(query, 'draft'), ['EU']);
  assert.equal(query.dirty(VIEW), false);
});

test('where nothing waits, the one answer lets go', () => {
  const query = new QueryContext();
  query.ask({ scope: VIEW, hold: ['region'] });
  query.ask({ scope: VIEW, field: 'region', reading: { picked: ['EU', 'US'] } });
  query.ask({ scope: VIEW, field: 'region', letGo: ['US'] });
  assert.deepEqual(picks(query, 'applied'), ['EU']);
});
