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

test('preset() reads back declarePreset, as a copy', () => {
  const source = open();
  source.declarePreset('emea', { region: { picked: ['EMEA'] } }, { label: 'EMEA' });
  const got = source.preset('emea');
  assert.deepEqual(got, { label: 'EMEA', readings: { region: { picked: ['EMEA'] } } });
  got.readings.region.picked.push('AMER');
  assert.deepEqual(source.preset('emea').readings.region.picked, ['EMEA']);
  source.declarePreset('emea', undefined);
  assert.equal(source.preset('emea'), undefined);
});

test('partFacts() reads back declarePart; `only` is the element itself', () => {
  const source = open();
  const chart = {};
  source.declarePart('picks:region', { field: 'region', only: chart });
  const got = source.partFacts('picks:region');
  assert.equal(got.field, 'region');
  assert.equal(got.only, chart);
  source.declarePart('picks:region', undefined);
  assert.equal(source.partFacts('picks:region'), undefined);
});

test('defaultFor() reads back declareDefault, as a copy', () => {
  const source = open();
  source.declareDefault('own:tile', { region: { picked: ['EMEA'] } });
  const got = source.defaultFor('own:tile');
  assert.deepEqual(got, { region: { picked: ['EMEA'] } });
  got.region.picked.push('AMER');
  assert.deepEqual(source.defaultFor('own:tile').region.picked, ['EMEA']);
  source.declareDefault('own:tile', undefined);
  assert.equal(source.defaultFor('own:tile'), undefined);
});

test('contribution() reads back contribute, as a copy', () => {
  const source = open();
  source.contribute('legend', ['region', 'ne', 'APAC']);
  assert.deepEqual(source.contribution('legend'), ['region', 'ne', 'APAC']);
  assert.deepEqual(source.contributions, ['legend']);
  source.contribution('legend').push('x');
  assert.deepEqual(source.contribution('legend'), ['region', 'ne', 'APAC']);
  source.contribute('legend', undefined);
  assert.equal(source.contribution('legend'), undefined);
});

test('scopeFacts() reads back declareScope, not the fallbacks', () => {
  const source = open();
  assert.deepEqual(source.scopeFacts('grid'), {});
  assert.equal(source.scopeLabel('grid'), 'grid');
  source.declareScope('grid', { label: 'Records', arranges: true });
  assert.deepEqual(source.scopeFacts('grid'), { label: 'Records', arranges: true });
});
