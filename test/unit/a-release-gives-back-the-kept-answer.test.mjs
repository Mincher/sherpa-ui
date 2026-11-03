/**
 * A RELEASE GIVES BACK THE KEPT ANSWER — 366 step 19, Will's D2 A. When the
 * View takes a field a component scope holds, that scope keeps its own answer
 * in the Query, not in force; when the View lets go, it comes back — with no
 * bar bound to remember it. A send down drops it: the View's answer wins.
 * TRAP T-a-superseded-chip-suspends-it-is-never-removed
 *
 *   node --test test/unit/a-release-gives-back-the-kept-answer.test.mjs
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { ArrayStore, DataSource, VIEW } from '../../dist/data.js';

const ROWS = [{ id: 1, plan: 'Pro' }, { id: 2, plan: 'Free' }, { id: 3, plan: 'Team' }];
const make = () => {
  const source = new DataSource({ store: new ArrayStore(ROWS, { key: 'id' }) });
  source.query.offer('data', ['plan']);
  source.query.ask({ scope: 'data', hold: ['plan'] });
  source.query.ask({ scope: 'data', field: 'plan', reading: { picked: ['Pro'] } });
  return source.query;
};

test('raised, the answer goes up and the scope below keeps its own', () => {
  const query = make();
  query.ask({ scope: VIEW, hold: ['plan'] });
  assert.deepEqual(query.reading(VIEW, 'plan').picked, ['Pro'], 'a raise carries the answer');
  assert.deepEqual(query.applied.scopes.data.superseded, { plan: { picked: ['Pro'] } }, 'and the scope keeps its own');
});

test('let go, the scope below gets its own answer back, though the View changed it', () => {
  const query = make();
  query.ask({ scope: VIEW, hold: ['plan'] });
  query.ask({ scope: VIEW, field: 'plan', reading: { picked: ['Free'] } });
  query.ask({ scope: VIEW, hold: [] });
  assert.deepEqual(query.reading('data', 'plan').picked, ['Pro']);
  assert.equal(query.applied.scopes.data.superseded, undefined, 'and keeps none now');
});

test('a scope that had no answer keeps {}, and is cleared when the View lets go', () => {
  const query = make();
  query.ask({ scope: 'data', field: 'plan', reading: null });
  query.ask({ scope: VIEW, hold: ['plan'] });
  assert.deepEqual(query.applied.scopes.data.superseded, { plan: {} });
  query.ask({ scope: VIEW, field: 'plan', reading: { picked: ['Team'] } });
  query.ask({ scope: VIEW, hold: [] });
  assert.equal(query.reading('data', 'plan'), undefined);
});

test('sent down, the View\'s answer wins and the kept one is dropped', () => {
  const query = make();
  query.ask({ scope: VIEW, hold: ['plan'] });
  query.ask({ scope: VIEW, field: 'plan', reading: { picked: ['Free'] } });
  query.ask({ scope: 'data', take: ['plan'], from: VIEW });
  assert.deepEqual(query.reading('data', 'plan').picked, ['Free']);
  assert.equal(query.applied.scopes.data.superseded, undefined);
});
