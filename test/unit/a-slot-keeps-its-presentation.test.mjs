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

import { ArrayStore, DataSource, QueryContext, bindSource } from '../../dist/data.js';

const ROWS = [{ id: 1, status: 'active', plan: 'Pro' }, { id: 2, status: 'trial', plan: 'Free' }];

test('present() keeps what differs, clears a key given nothing, and forgets an empty slot', () => {
  const query = new QueryContext();
  const heard = [];
  query.addEventListener('query-change', (e) => heard.push(e.detail.scopes));
  query.ask({ scope: 'by-status', presentation: { group: 'plan', sort: 'desc' } });
  assert.deepEqual(query.presentation('by-status'), { group: 'plan', sort: 'desc' });
  assert.deepEqual(heard.at(-1), ['by-status']);
  query.ask({ scope: 'by-status', presentation: { sort: undefined } });
  assert.deepEqual(query.presentation('by-status'), { group: 'plan' });
  query.ask({ scope: 'by-status', presentation: { group: undefined } });
  assert.deepEqual(query.presentation('by-status'), {});
  assert.equal('by-status' in query.applied.scopes, false);
});

test('a presentation rides in the Query: export carries it, and a restore puts it back', async () => {
  const source = new DataSource({ store: new ArrayStore(ROWS, { key: 'id' }) });
  source.query.ask({ scope: 'by-status', presentation: { kind: 'donut', secondary: 'status', group: 'plan' } });
  const saved = source.query.export();
  assert.deepEqual(saved.query.scopes['by-status'].presentation, { kind: 'donut', secondary: 'status', group: 'plan' });
  const again = new DataSource({ store: new ArrayStore(ROWS, { key: 'id' }) });
  await again.query.import(saved);
  assert.deepEqual(again.query.presentation('by-status'), { kind: 'donut', secondary: 'status', group: 'plan' });
});

test('it is not the row arrangement: a grid\'s sort stays, and the slot\'s group sorts no row', async () => {
  const source = new DataSource({ store: new ArrayStore(ROWS, { key: 'id' }) });
  source.query.ask({ scope: 'data', sort: 'status', direction: 'desc' });
  source.query.ask({ scope: 'by-status', presentation: { group: 'plan', sort: 'asc' } });
  await source.load();
  assert.deepEqual(source.state.sort, [{ field: 'status', direction: 'desc' }]);
  assert.equal(source.state.group, null);
  assert.deepEqual(source.query.applied.scopes.data.sort, [{ field: 'status', direction: 'desc' }]);
});

test('a Secondary switched off is kept, and not shown — the definition\'s neither; on again, it is back (Will, TODO 666)', () => {
  const query = new QueryContext();
  query.declarePresentation('data', { grid: { secondary: 'plan' } });
  query.ask({ scope: 'data', presentation: { secondary: 'status', off: 'secondary' } });
  assert.deepEqual(query.presented('data', 'grid'), {});
  assert.deepEqual(query.presentation('data'), { secondary: 'status', off: 'secondary' });
  query.ask({ scope: 'data', presentation: { secondary: 'status', off: undefined } });
  assert.deepEqual(query.presented('data', 'grid'), { secondary: 'status' });
});

test('describe() names an off Secondary\'s field, so its chip keeps it (Will, TODO 666)', async () => {
  const source = new DataSource({ store: new ArrayStore(ROWS, { key: 'id' }) });
  source.declareField('status', { label: 'Status' });
  source.declareField('plan', { label: 'Plan' });
  source.query.offer('data', ['status', 'plan']);
  bindSource(source, Object.assign(new EventTarget(), { setAttribute() {}, removeAttribute() {}, hasAttribute: () => false, populate() {} }), { scope: 'data' });
  await source.load();
  source.query.ask({ scope: 'data', presentation: { secondary: 'plan', off: 'secondary' } });
  const scope = source.describe('data');
  assert.equal(scope.secondaryField, undefined);
  assert.equal(scope.secondaryOff, 'plan');
});
