/**
 * A PATTERN IS A NEED AND A LAYOUT: its `when` is the data layer's own `where`,
 * and its layout is a component spec's anatomy node. pattern.v1.json defines
 * neither again. TODO 700 G0, plan 700 §3
 *
 *   node --test test/unit/a-pattern-is-a-need-and-a-layout.test.mjs
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { schemaCheck } from '../../scripts/lib/schema-check.mjs';

const check = schemaCheck('pattern.v1.json');

const RECORDS = {
  $schema: '../node_modules/sherpa-ui/schemas/pattern.v1.json',
  v: 1, id: 'records-list', label: 'Find and act on records',
  use: 'Many rows of one kind, which a reader narrows, sorts and acts on.',
  when: { task: { in: ['browse', 'find', 'triage'] }, rows: { gt: 50 } },
  rank: 10,
  layout: { el: 'sherpa-layout-grid', children: [
    { role: 'summary', el: 'sherpa-metric', each: 'statusField', max: 4 },
    { role: 'filters', el: 'sherpa-quick-filter-toolbar', attrs: { 'data-scope': 'data' } },
    { role: 'rows', el: 'sherpa-data-grid', attrs: { 'data-scope': 'data' } },
  ] },
  page: { scopes: { view: {}, data: { offers: 'all' } } },
  states: ['loading', 'empty', 'unreached', 'down'],
  agent: { may: ['columns', 'presets', 'summary'], keeps: ['filters', 'rows'] },
};

test('the plan\'s records list is a sound pattern', () => {
  assert.deepEqual(check(RECORDS), []);
  assert.deepEqual(schemaCheck('pattern.v1.json#/$defs/need')({
    task: 'triage', rows: 4200, fields: 9, dateFields: 1, numberFields: 3, statusFields: 1, childFields: 0, writes: true,
  }), []);
});

test('its when takes only the condition shape defs.v1.json says', () => {
  const broken = structuredClone(RECORDS);
  broken.when.rows = { above: 50 };
  assert.deepEqual(check(broken), ['/when/rows must NOT have additional properties']);
});

test('its layout takes only an anatomy node\'s keys and its own, at any depth; no <slot>', () => {
  const broken = structuredClone(RECORDS);
  broken.layout.children[2].children = [{ el: 'sherpa-button', colour: 'red' }];
  broken.layout.children[1].slot = '';
  assert.deepEqual(check(broken), [
    '/layout/children/1/slot boolean schema is false',
    '/layout/children/2/children/0 must NOT have unevaluated properties',
  ]);
});
