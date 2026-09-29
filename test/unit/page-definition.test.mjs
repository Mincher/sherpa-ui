/**
 * A PAGE IS ITS DEFINITION, and a field's values come from the DATA — the
 * store's schema, or else its rows. docs/PAGE-DEFINITION.md
 * TRAP T-a-page-is-its-definition · TRAP T-the-data-says-what-a-field-may-hold
 *
 *   node --test test/unit/page-definition.test.mjs
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import Ajv2020 from 'ajv/dist/2020.js';

const core = new URL('../../dist/core/data/', import.meta.url);
const { ArrayStore } = await import(new URL('stores.js', core));
const { DataSource } = await import(new URL('data-source.js', core));
const { rules, oneOf, number, min, max, required } = await import(new URL('validate.js', core));
const { openSource } = await import(new URL('page-definition.js', core));

const ROOT = new URL('../../', import.meta.url);
const json = async (path) => JSON.parse(await readFile(new URL(path, ROOT), 'utf8'));

test('every definition in examples/definitions/ passes the page schema', async () => {
  const Ajv = Ajv2020.default ?? Ajv2020;
  const check = new Ajv({ allErrors: true }).compile(await json('schemas/page.v1.json'));
  const files = (await readdir(new URL('examples/definitions/', ROOT))).filter((f) => f.endsWith('.json'));
  assert.ok(files.length > 0, 'no definitions found');
  for (const file of files) {
    const ok = check(await json(`examples/definitions/${file}`));
    assert.ok(ok, `${file}: ${JSON.stringify(check.errors)}`);
  }
});

test('a schema says each field\'s domain; a min on text is a length, not an end', () => {
  const schema = rules({
    status: [required(), oneOf(['active', 'trial', 'churned'])],
    seats: [number(), min(1), max(500)],
    name: [required(), min(2)],
  });
  assert.deepEqual(schema.domains, {
    status: { values: ['active', 'trial', 'churned'] },
    seats: { type: 'number', min: 1, max: 500 },
  });
});

test('a source over a store with a schema offers its values in ORDER, and knows a number', () => {
  const store = new ArrayStore([{ id: 1, status: 'trial', seats: 4 }], {
    schema: rules({ status: oneOf(['active', 'trial', 'churned']), seats: [number(), min(1), max(500)] }),
  });
  const source = new DataSource({ store, autoLoad: false });
  // Every value the data MAY hold, not only the one row's.
  assert.deepEqual(source.valuesFor('status'), ['active', 'trial', 'churned']);
  assert.deepEqual(source.fieldFacts('seats'), { type: 'number', min: 1, max: 500 });
});

test('nothing said: the rows give a set its unique values, sorted, and a number its ends', async () => {
  const rows = [
    { id: 1, owner: 'Ravi', seats: 12 }, { id: 2, owner: 'Dana', seats: 240 },
    { id: 3, owner: 'Ravi', seats: 3 }, { id: 4, owner: '', seats: null },
  ];
  const source = new DataSource({ store: new ArrayStore(rows), autoLoad: false });
  source.declareField('seats', { type: 'number' });
  await source.declareFromRows(['owner', 'seats']);
  assert.deepEqual(source.valuesFor('owner'), ['Dana', 'Ravi']);
  assert.deepEqual(source.fieldFacts('seats'), { type: 'number', min: 3, max: 240, step: 1 });
});

test('a field the schema gave is never read from the rows', async () => {
  let loads = 0;
  const store = new ArrayStore([{ id: 1, status: 'trial' }], { schema: rules({ status: oneOf(['active', 'trial']) }) });
  const load = store.load.bind(store);
  store.load = (o) => { loads++; return load(o); };
  const source = new DataSource({ store, autoLoad: false });
  await source.declareFromRows(['status']);
  assert.equal(loads, 0);
  assert.deepEqual(source.valuesFor('status'), ['active', 'trial']);
});

test('openSource builds the page\'s source: fields, labels, scopes, holds and presets', async () => {
  const rows = [
    { id: 1, region: 'AMER', customer: 'Contoso', tickets: 2 },
    { id: 2, region: 'EMEA', customer: 'Northwind', tickets: 0 },
  ];
  const store = new ArrayStore(rows, { schema: rules({ region: oneOf(['EMEA', 'AMER', 'APAC']) }) });
  const source = await openSource({
    store: 'alerts',
    fields: {
      customer: { label: 'Customer', select: 'multiple', icon: 'buildings' },
      region: { label: 'Region', select: 'multiple', labels: { AMER: 'Americas' } },
    },
    scopes: {
      view: { label: 'View filters', holds: ['customer', 'region'] },
      data: { label: 'Alerts', offers: 'all', presets: ['busy'] },
    },
    presets: { busy: { label: 'Has tickets', readings: { tickets: { op: 'gt', text: '0' } } } },
  }, store);
  assert.deepEqual(source.scope('view'), ['customer', 'region']);
  assert.equal(source.scopeLabel('data'), 'Alerts');
  const region = source.filterDef('region');
  // The schema's order, and the reader's name for a value.
  assert.deepEqual(region.options, [
    { value: 'EMEA', label: 'EMEA' }, { value: 'AMER', label: 'Americas' }, { value: 'APAC', label: 'APAC' },
  ]);
  assert.equal(source.filterDef('customer').icon, 'buildings');
  assert.deepEqual(source.valuesFor('customer'), ['Contoso', 'Northwind']);
  const data = source.describe('data');
  assert.deepEqual(data.filters.map((f) => [f.id, f.active]), [['busy', false]]);
});

test('a scope says what it narrows: the View is the view, a bound component names its own', async () => {
  // TRAP T-a-scope-says-what-it-shows
  const store = new ArrayStore([{ region: 'EMEA', status: 'open' }]);
  const source = await openSource({
    store: 'rows',
    fields: { region: { label: 'Region' }, status: { label: 'Status' } },
    scopes: { view: { label: 'View filters', holds: ['region'] }, data: { label: 'Alerts', holds: ['status'] } },
  }, store);
  const grid = {
    populate() {}, setAttribute() {}, removeAttribute() {}, addEventListener() {}, removeEventListener() {},
  };
  assert.equal(source.describe('view').shows, 'view');
  assert.equal(source.describe('data').shows, undefined, 'nothing bound says what it shows');
  const off = source.bind(grid, { scope: 'data', shows: 'grid' });
  assert.equal(source.describe('data').shows, 'grid');
  off();
  assert.equal(source.describe('data').shows, undefined, 'unbound, it says nothing');
});
