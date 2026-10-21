/**
 * Every `declare…` door has a read-back: a host that SET something can ask
 * what the source now holds (TODO 292). A copy where the doc says so.
 *
 *   npm run build && node --test test/unit/every-declare-reads-back.test.mjs
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { ArrayStore, DataSource } from '../../dist/data.js';

const open = () => new DataSource({ store: new ArrayStore([{ id: 1, region: 'EMEA' }], { key: 'id' }), autoLoad: false });

test('partFacts() reads back declarePart; `only` is the element itself', () => {
  const source = open();
  const chart = {};
  source.declarePart('picks:region', { field: 'region', only: chart });
  const got = source.query.partFacts('picks:region');
  assert.equal(got.field, 'region');
  assert.equal(got.only, chart);
  source.declarePart('picks:region', undefined);
  assert.equal(source.query.partFacts('picks:region'), undefined);
});

test('defaultFor() reads back declareDefault, frozen: the same object, and a push throws', () => {
  const source = open();
  source.declareDefault('own:tile', { region: { picked: ['EMEA'] } });
  const got = source.query.defaultFor('own:tile');
  assert.deepEqual(got, { region: { picked: ['EMEA'] } });
  assert.equal(source.query.defaultFor('own:tile'), got);
  assert.throws(() => { got.region.picked.push('AMER'); }, TypeError);
  assert.deepEqual(source.query.defaultFor('own:tile').region.picked, ['EMEA']);
  source.declareDefault('own:tile', undefined);
  assert.equal(source.query.defaultFor('own:tile'), undefined);
});

test('scopeFacts() reads back declareScope, not the fallbacks', () => {
  const source = open();
  assert.deepEqual(source.query.scopeFacts('grid'), {});
  assert.equal(source.query.scopeLabel('grid'), 'grid');
  source.declareScope('grid', { label: 'Records', arranges: true });
  assert.deepEqual(source.query.scopeFacts('grid'), { label: 'Records', arranges: true });
});
