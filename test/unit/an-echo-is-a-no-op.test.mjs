/**
 * AN ECHO IS A NO-OP — 366 step 18. A control that sends back every answer it
 * is drawn, as a request, changes nothing: the context drops a request whose
 * answer is already in force, so the loop dies in one round.
 * TRAP T-one-query-one-owner
 *
 *   node --test test/unit/an-echo-is-a-no-op.test.mjs
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { ArrayStore, DataSource, QueryContext, VIEW } from '../../dist/data.js';

test('a control that echoes every draw as a request settles in one round', () => {
  const query = new QueryContext();
  new DataSource({ store: new ArrayStore([{ id: 1, plan: 'Pro' }], { key: 'id' }), query });
  query.hold(VIEW, ['plan']);
  let told = 0;
  // The echo: each time its field moves, it sends back what it was drawn.
  query.addEventListener('query-change', (e) => {
    if (!e.detail.fields.includes('plan') || ++told > 10) return;
    query.setReading(VIEW, 'plan', query.reading(VIEW, 'plan') ?? null);
  });
  query.setReading(VIEW, 'plan', { picked: ['Pro'] });
  assert.equal(told, 1, 'the echo changed nothing, so nothing was told again');
});
