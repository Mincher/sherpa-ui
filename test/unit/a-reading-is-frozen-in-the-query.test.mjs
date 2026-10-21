/**
 * A READING IS FROZEN IN THE QUERY — 366 step 6 (finishes 319). What a caller
 * hands in is copied; what the source hands out is the Query's own, frozen, so
 * no caller can change the Query by editing what it was given.
 * TRAP T-a-reading-is-frozen-in-the-query
 *
 *   node --test test/unit/a-reading-is-frozen-in-the-query.test.mjs
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { ArrayStore, DataSource, bindSource, spoofRemote } from '../../dist/data.js';

const ROWS = [{ id: 1, region: 'EMEA', owner: 'Dana' }, { id: 2, region: 'AMER', owner: 'Ravi' }];
const make = (remote = false) => {
  const store = new ArrayStore(ROWS, { key: 'id' });
  return new DataSource({ store: remote ? spoofRemote(store, { delay: 0 }) : store });
};

test('select copies the caller\'s rows: a change to them leaves the Query as it was', async () => {
  const source = make();
  const rows = [{ op: 'contains', text: 'Da' }];
  source.select('owner', [], { mode: 'advanced', conditions: rows });
  rows[0].text = 'Ra';
  rows.push({ op: 'eq', picked: ['x'], join: 'or' });
  assert.deepEqual(source.query.applied.scopes.view.readings.owner.conditions, [{ op: 'contains', text: 'Da' }]);
});

/** A grid below the View: what supersedeColumns hands it. */
function grid(source) {
  const got = [];
  const el = Object.assign(new EventTarget(), {
    setAttribute() {}, removeAttribute() {}, hasAttribute: () => false, populate() {},
    supersedeColumns: (readings) => got.push(readings),
  });
  bindSource(source, el, { scope: 'data' });
  return got;
}
const throwsOnWrite = (got) => {
  const readings = got.at(-1);
  assert.deepEqual(readings?.region?.picked, ['EMEA']);
  assert.throws(() => { readings.region.picked.push('APAC'); }, TypeError);
};

test('after setQuery, what a grid is handed cannot change the Query', async () => {
  const source = make();
  const got = grid(source);
  await source.setQuery({ v: 1, scopes: { view: { holds: ['region'], readings: { region: { picked: ['EMEA'] } } } } });
  throwsOnWrite(got);
});

test('after a remote commit, what a grid is handed cannot change the Query', async () => {
  const source = make(true);
  const got = grid(source);
  source.hold('view', ['region']);
  source.select('region', ['EMEA']);
  source.commit();
  throwsOnWrite(got);
});

test('after the Switch goes off, the reading it turned off is frozen too', async () => {
  const source = make();
  source.hold('view', ['region']);
  source.select('region', ['EMEA']);
  source.suspendScope('view');
  const off = source.query.reading('view', 'region');
  assert.equal(off.suspended, true);
  assert.throws(() => { off.picked.push('APAC'); }, TypeError);
});

test('reading() hands out the same object twice', () => {
  const source = make();
  source.select('owner', ['Dana']);
  assert.equal(source.query.reading('view', 'owner'), source.query.reading('view', 'owner'));
});
