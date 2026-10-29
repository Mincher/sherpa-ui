/**
 * A SLOT KEEPS ITS PRESENTATION — Will, TODO 548 (plan phase C): a chart or a
 * grid's kind, a chart's two fields, its parts and its order live in its OWN
 * scope, in the Query, so a saved View and a reload keep them (Will: A). They
 * are not the row arrangement: a grid's sort elsewhere is untouched.
 *
 *   node --test test/unit/a-slot-keeps-its-presentation.test.mjs
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { ArrayStore, DataSource, QueryContext } from '../../dist/data.js';

const ROWS = [{ id: 1, status: 'active', plan: 'Pro' }, { id: 2, status: 'trial', plan: 'Free' }];

test('present() keeps what differs, clears a key given nothing, and forgets an empty slot', () => {
  const query = new QueryContext();
  const heard = [];
  query.addEventListener('query-change', (e) => heard.push(e.detail.scopes));
  query.present('by-status', { group: 'plan', sort: 'desc' });
  assert.deepEqual(query.presentation('by-status'), { group: 'plan', sort: 'desc' });
  assert.deepEqual(heard.at(-1), ['by-status']);
  query.present('by-status', { sort: undefined });
  assert.deepEqual(query.presentation('by-status'), { group: 'plan' });
  query.present('by-status', { group: undefined });
  assert.deepEqual(query.presentation('by-status'), {});
  assert.equal('by-status' in query.applied.scopes, false);
});

test('a presentation rides in the Query: export carries it, and a restore puts it back', async () => {
  const source = new DataSource({ store: new ArrayStore(ROWS, { key: 'id' }) });
  source.query.present('by-status', { kind: 'donut', secondary: 'status', group: 'plan' });
  const saved = source.query.export();
  assert.deepEqual(saved.query.scopes['by-status'].presentation, { kind: 'donut', secondary: 'status', group: 'plan' });
  const again = new DataSource({ store: new ArrayStore(ROWS, { key: 'id' }) });
  await again.query.import(saved);
  assert.deepEqual(again.query.presentation('by-status'), { kind: 'donut', secondary: 'status', group: 'plan' });
});

test('it is not the row arrangement: a grid\'s sort stays, and the slot\'s group sorts no row', async () => {
  const source = new DataSource({ store: new ArrayStore(ROWS, { key: 'id' }) });
  source.query.setSort('status', 'desc', 'data');
  source.query.present('by-status', { group: 'plan', sort: 'asc' });
  await source.load();
  assert.deepEqual(source.state.sort, [{ field: 'status', direction: 'desc' }]);
  assert.equal(source.state.group, null);
  assert.deepEqual(source.query.applied.scopes.data.sort, [{ field: 'status', direction: 'desc' }]);
});
