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

test('a grid\'s columns are made from the fields, in their order, but the key; the grid heads each with its label', () => {
  assert.deepEqual(typeColumns(DEVICE), [
    { field: 'name', sortable: true },
    { field: 'status', sortable: true },
    { field: 'risk', sortable: true, type: 'number' },
    { field: 'owner', sortable: true },
    { field: 'enrolled', sortable: true, type: 'date' },
    { field: 'antivirus', sortable: true },
    { field: 'health', sortable: true },
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

test('a graph thing says its graph part in the same type file; node-type.v1 is folded in', () => {
  const COWORKER = {
    v: 1, id: 'coworker', label: 'Coworker', icon: 'agent', category: 'Coworkers',
    fields: { every: { label: 'Runs', from: 'when/every' } },
    graph: { runs: true, reusable: false, inputs: [{ name: 'rows', label: 'Rows', type: 'object' }], families: ['Sources', 'AI'] },
  };
  assert.deepEqual(ofSchema(COWORKER), []);
  assert.deepEqual(typeFaults(COWORKER), [], 'its key is its entity\'s id, so need not be a field');
  const bare = { v: 1, id: 'flow', label: 'Flow', graph: {} };
  assert.deepEqual([ofSchema(bare), typeFaults(bare)], [[], []], 'a graph part alone is a type');
  const filter = { v: 1, id: 'rule', label: 'Rule', graph: { query: true, runs: false } };
  assert.deepEqual([ofSchema(filter), typeFaults(filter)], [[], []], 'its entities may keep a query body');
  const broken = [
    [{ ...bare, graph: { reusable: 'no' } }, /graph: its reusable is not true or false/],
    [{ ...bare, graph: { query: 'yes' } }, /graph: its query is not true or false/],
    [{ ...bare, graph: { inputs: [{ name: 'rows', type: 'rows' }] } }, /graph: its input "rows": its type is one of value, object, boolean/],
    [{ ...bare, graph: { outputs: [{ type: 'object' }] } }, /graph: its outputs 1 has no name/],
    [{ ...bare, graph: { families: 'Sources' } }, /graph: its families are a list of names/],
    [{ ...bare, graph: { sockets: [] } }, /graph: it has "sockets", which a graph part does not keep/],
    [{ v: 1, id: 'none', label: 'None' }, /it has no fields, and no graph/],
  ];
  for (const [type, words] of broken) {
    assert.ok(ofSchema(type).length, `the schema refuses ${words}`);
    assert.match(typeFaults(type).join('\n'), words);
  }
});

test('a page names its type: a reader of its JSON reads each field as the type and the page say it (pageFields)', async () => {
  const { pageFields, registerEntityType, checkPage, onReport } = await import('../../dist/data.js');
  const page = { store: 'devices', type: 'device', fields: { name: { advanced: 'only', op: 'contains' }, status: { label: 'State' } } };
  // From the registry, as the app's types are registered from app.json `types`.
  const off = registerEntityType(DEVICE);
  try {
    const fields = pageFields(page);
    assert.deepEqual(fields.name, { label: 'Name', advanced: 'only', op: 'contains' });
    assert.equal(fields.status.label, 'State');
    assert.equal(fields.risk.type, 'number');
    assert.equal(fields.health.label, 'Health');
  } finally {
    off();
  }
  // A type the app has not, or none named: the page's own fields alone.
  assert.deepEqual(pageFields(page), page.fields);
  assert.deepEqual(pageFields({ store: 'x' }), {});
  assert.deepEqual(pageFields(page, { device: DEVICE }).risk, { type: 'number', min: 0, max: 100, label: 'Risk' });
  // checkPage holds its name to a type's id.
  const said = [];
  const stop = onReport((r) => said.push(r.message));
  try {
    assert.equal(checkPage({ v: 1, id: 'p', source: { store: 'x', type: 'Device Type' } }), false);
  } finally {
    stop();
  }
  assert.match(said.join('\n'), /its source\.type is no type's id/);
});

test('an app\'s types load from their files and register by id; an entity of a row type is refused', async () => {
  const { entityTypes, entityFaults, onReport } = await import('../../dist/data.js');
  const { loadTypes } = await import('../../dist/core/browser/entity-files.js');
  const files = { 'type-a': { ...DEVICE, id: 'type-a' }, 'type-b': { ...DEVICE, id: 'other' }, 'type-c': null };
  const was = { fetch: globalThis.fetch, document: globalThis.document };
  globalThis.document = { baseURI: 'http://app.test/' };
  globalThis.fetch = async (url) => {
    const name = new URL(url).pathname.slice(1, -5);
    return files[name] === null ? { ok: false, status: 404 } : { ok: true, json: async () => files[name] };
  };
  const said = [];
  const stop = onReport((r) => said.push(r.message));
  try {
    await loadTypes({ 'type-a': 'type-a.json', 'type-b': 'type-b.json', 'type-c': 'type-c.json' });
  } finally {
    stop();
    Object.assign(globalThis, was);
  }
  assert.ok(entityTypes()['type-a'], 'registered by its id');
  assert.equal(entityTypes()['type-b'], undefined);
  assert.match(said.join('\n'), /loadTypes: the type under "type-b" has the id "other", so it is left out/);
  assert.match(said.join('\n'), /loadTypes: the type "type-c" could not be read \(404\)/);
  const entity = { v: 2, type: 'type-a', id: 'one', label: 'One', graph: { nodes: [] } };
  assert.match((await entityFaults(entity)).join('\n'), /is of the type "Device", which keeps no graph/);
});
