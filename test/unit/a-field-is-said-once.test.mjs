/**
 * A FIELD IS SAID ONCE — Will, plan 960 U2: a type file (type.v1) says what each field's data is, and the store's
 * rules, what a page knows of each field and a grid's columns are made from it. A page's own fields say only what
 * its controls do. A type file passes, or fails in words; a field the graph holds is read from it.
 *
 *   node --test test/unit/a-field-is-said-once.test.mjs
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { schemaCheck } from '../../scripts/lib/schema-check.mjs';

import {
  ArrayStore, openSource, readFrom, statusFields, typeColumns, typeFaults, typeFields, typeSchema, typeStatusFields, typeStoreOptions, validate,
} from '../../dist/data.js';

const DEVICE = {
  $schema: 'https://sherpa-ui.dev/schemas/type.v1.json', v: 1,
  id: 'device', label: 'Device', icon: 'computer', category: 'Records', time: 'enrolled',
  fields: {
    id: { label: 'Asset' },
    name: { label: 'Name', required: true, min: 2 },
    status: { label: 'Status', values: ['online', 'offline'], statuses: { online: 'success', offline: 'critical' } },
    risk: { type: 'number', label: 'Risk', min: 0, max: 100 },
    owner: { label: 'Owner', format: 'email' },
    enrolled: { type: 'date', label: 'Enrolled' },
    antivirus: { type: 'boolean', label: 'Antivirus', labels: { true: 'On', false: 'Off' } },
    health: {
      type: 'status', label: 'Health', description: 'Worked out from its risk.',
      values: [{ value: 'At risk', status: 'critical', when: [{ risk: { gte: 70 } }] }, { value: 'Healthy', status: 'success' }],
    },
  },
  data: 'data/devices.json',
};
const ROWS = [
  { id: 'd1', name: 'Alpha', status: 'online', risk: 80, owner: 'a@x.io', enrolled: '2026-01-02', antivirus: true },
  { id: 'd2', name: 'Bravo', status: 'offline', risk: 10, owner: 'b@x.io', enrolled: '2026-02-03', antivirus: false },
];
const ofSchema = schemaCheck('type.v1.json');
const make = (change) => change(structuredClone(DEVICE));

test('a type file passes its schema and typeFaults', () => {
  assert.deepEqual(ofSchema(DEVICE), []);
  assert.deepEqual(typeFaults(DEVICE), []);
});

test('a broken type fails in words, in the schema and in typeFaults alike', () => {
  const both = [
    [(t) => { t.columns = []; return t; }, /"columns", which a type does not keep/],
    [(t) => { delete t.fields; return t; }, /it has no fields/],
    [(t) => { t.fields.risk.type = 'list'; return t; }, /its type, "list", is none of/],
    [(t) => { t.fields.status.values = [{ online: 1 }]; return t; }, /are not text/],
    [(t) => { t.fields.name.width = 220; return t; }, /"width", which a field does not keep/],
    [(t) => { t.fields.health.values = []; return t; }, /a status field lists its values/],
    [(t) => { t.fields.owner.from = '/when'; return t; }, /its from is a node's id/],
    [(t) => { t.type = 'device'; return t; }, /"type", which a type does not keep/],
  ];
  for (const [change, words] of both) {
    const broken = make(change);
    assert.ok(ofSchema(broken).length, `the schema refuses ${words}`);
    assert.match(typeFaults(broken).join('\n'), words);
  }
  // What JSON Schema cannot say: one key read beside another.
  const only = [
    [(t) => { t.key = 'serial'; return t; }, /its key, "serial", is no field/],
    [(t) => { t.time = 'name'; return t; }, /its time, "name", is not a date field/],
    [(t) => { t.fields.status.statuses.lost = 'info'; return t; }, /statuses name "lost", which is none of its values/],
    [(t) => { t.fields.risk.min = 200; return t; }, /its min is more than its max/],
    [(t) => { t.fields.risk.format = 'email'; return t; }, /a number has no format/],
    [(t) => { t.fields.name.time = true; return t; }, /only a date holds a time of day/],
  ];
  for (const [change, words] of only) assert.match(typeFaults(make(change)).join('\n'), words);
});

test('the store\'s rules are made from the fields', async () => {
  const schema = typeSchema(DEVICE);
  const issues = async (row) => Object.fromEntries(((await validate(schema, row)).issues ?? []).map((i) => [i.path[0], i.message]));
  assert.deepEqual(await issues(ROWS[0]), {});
  const wrong = await issues({ name: 'A', status: 'lost', risk: 120, owner: 'nobody', antivirus: 'maybe' });
  assert.deepEqual(Object.keys(wrong).sort(), ['antivirus', 'id', 'name', 'owner', 'risk', 'status']);
  assert.equal(wrong.id, 'Required', 'the key is required');
  assert.match(wrong.status, /one of: online, offline/);
  assert.match(wrong.risk, /at most 100/);
  // A status is worked out, so it has no rule; statusFields refuses a write that names it.
  assert.equal(schema.rules.health, undefined);
  assert.deepEqual(typeStoreOptions(DEVICE).key, 'id');
  assert.deepEqual(typeStoreOptions(DEVICE).time, 'enrolled');
});

test('a page knows each field from its type, and says only what its controls do', async () => {
  const store = statusFields(new ArrayStore(ROWS, typeStoreOptions(DEVICE)), typeStatusFields(DEVICE));
  const source = await openSource({ store: 'devices', fields: { name: { advanced: 'only', op: 'contains' }, status: { label: 'State' } } }, store);
  const def = (field) => source.filterDef(field);
  assert.equal(def('name').label, 'Name');
  assert.equal(def('name').advanced, 'only', 'the page says its control');
  assert.equal(def('status').label, 'State', 'the page\'s own word wins');
  assert.deepEqual(def('status').options.map((o) => [o.value, o.swatch]), [['online', 'success'], ['offline', 'critical']]);
  assert.equal(def('risk').kind, 'number');
  assert.equal(def('enrolled').kind, 'date');
  assert.equal(source.timeField, 'enrolled');
  assert.deepEqual(def('antivirus').options.map((o) => o.label), ['On', 'Off']);
  assert.equal(def('health').label, 'Health');
  assert.equal(def('health').description, 'Worked out from its risk.');
  assert.deepEqual(def('health').options.map((o) => [o.value, o.swatch]), [['At risk', 'critical'], ['Healthy', 'success']]);
  source.dispose?.();
});

test('a reader with no source open reads each field as the type and the page say it together', () => {
  const page = { name: { advanced: 'only', op: 'contains' }, status: { label: 'State' }, site: { label: 'Site', select: 'single' } };
  const fields = typeFields(DEVICE, page);
  assert.deepEqual(Object.keys(fields), ['id', 'name', 'status', 'risk', 'owner', 'enrolled', 'antivirus', 'health', 'site']);
  assert.deepEqual(fields.name, { label: 'Name', advanced: 'only', op: 'contains' });
  assert.deepEqual(fields.status, { values: ['online', 'offline'], label: 'State', statuses: { online: 'success', offline: 'critical' } });
  assert.deepEqual(fields.risk, { type: 'number', min: 0, max: 100, label: 'Risk' });
  assert.deepEqual(fields.health, {
    label: 'Health', description: 'Worked out from its risk.', values: ['At risk', 'Healthy'], statuses: { 'At risk': 'critical', Healthy: 'success' },
  });
  assert.deepEqual(fields.site, { label: 'Site', select: 'single' }, 'a field only the page names is the page\'s');
});

test('a grid\'s columns are made from the fields, in their order, but the key', () => {
  assert.deepEqual(typeColumns(DEVICE), [
    { field: 'name', header: 'Name', sortable: true },
    { field: 'status', header: 'Status', sortable: true },
    { field: 'risk', header: 'Risk', sortable: true, type: 'number' },
    { field: 'owner', header: 'Owner', sortable: true },
    { field: 'enrolled', header: 'Enrolled', sortable: true, type: 'date' },
    { field: 'antivirus', header: 'Antivirus', sortable: true },
    { field: 'health', header: 'Health', sortable: true },
  ]);
});

test('a field the graph holds is read from it, never kept beside it', () => {
  const COWORKER = {
    v: 1, id: 'coworker', label: 'Coworker',
    fields: { id: {}, label: { label: 'Name' }, every: { label: 'Runs', values: ['day', 'week'], from: 'when/every' } },
  };
  assert.deepEqual(typeFaults(COWORKER), []);
  assert.deepEqual(ofSchema(COWORKER), []);
  const graph = { nodes: [{ id: 'when', kind: 'trigger', values: { type: 'schedule', every: 'week', at: '02:00' } }] };
  assert.equal(readFrom(graph, 'when/every'), 'week');
  assert.deepEqual(readFrom(graph, 'when'), { type: 'schedule', every: 'week', at: '02:00' });
  assert.equal(readFrom(graph, 'gone/every'), undefined);
  assert.equal(readFrom(graph, 'when/every/day'), undefined);
  const schema = typeSchema(COWORKER);
  assert.equal(schema.rules.every, undefined, 'it is never written, so it has no rule');
  assert.deepEqual(schema.domains.every, { label: 'Runs', values: ['day', 'week'] });
});
