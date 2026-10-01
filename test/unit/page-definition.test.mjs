/**
 * A PAGE IS ITS DEFINITION, and a field's values come from the DATA — the
 * store's schema, or else its rows. docs/PAGE-DEFINITION.md
 * TRAP T-a-page-is-its-definition · TRAP T-the-data-says-what-a-field-may-hold
 *
 *   node --test test/unit/page-definition.test.mjs
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import Ajv2020 from 'ajv/dist/2020.js';

const core = new URL('../../dist/core/data/', import.meta.url);
const { ArrayStore } = await import(new URL('stores.js', core));
const { DataSource } = await import(new URL('data-source.js', core));
const { rules, oneOf, number, min, max, required } = await import(new URL('validate.js', core));
const { openSource } = await import(new URL('page-definition.js', core));

const ROOT = new URL('../../', import.meta.url);
const json = async (path) => JSON.parse(await readFile(new URL(path, ROOT), 'utf8'));

// The app's own definitions are checked in Sherpa Demos; this one is a copy of its Records page.
test('a real page definition passes the page schema', async () => {
  const Ajv = Ajv2020.default ?? Ajv2020;
  const check = new Ajv({ allErrors: true }).compile(await json('schemas/page.v1.json'));
  const ok = check(await json('test/unit/fixtures/records.page.json'));
  assert.ok(ok, JSON.stringify(check.errors));
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

/* Will, TODO 172: "For multi value filters in the filter panel each chip
   should show their own count badge." TRAP T-a-chip-counts-its-own-results */
test('each PICKED value has a count of its own — and only a list answer in force has values', async () => {
  const store = new ArrayStore([
    { region: 'EMEA', status: 'open', seats: 5 }, { region: 'EMEA', status: 'shut', seats: 9 },
    { region: 'AMER', status: 'open', seats: 5 }, { region: 'AMER', status: 'open', seats: 1 },
    { region: 'APAC', status: 'open', seats: 5 },
  ]);
  const source = await openSource({
    store: 'rows',
    fields: { region: { label: 'Region' }, status: { label: 'Status' }, seats: { label: 'Seats', type: 'number' } },
    scopes: { view: { label: 'View filters', holds: ['region'] }, data: { label: 'Alerts', holds: ['status', 'seats'] } },
  }, store);
  source.bind({
    populate() {}, setAttribute() {}, removeAttribute() {}, addEventListener() {}, removeEventListener() {},
  }, { scope: 'data' });
  await source.setQuery({ v: 1, scopes: {
    view: { holds: ['region'], readings: { region: { picked: ['EMEA', 'AMER'] } } },
    data: { holds: ['status', 'seats'], readings: { status: { picked: ['open', 'shut'] }, seats: { picked: ['5', '9'], range: true } } },
  } });
  // The View's two values: each over everything. The field's own count is both.
  assert.deepEqual(await source.valueResults('view'), { region: { EMEA: 2, AMER: 2 } });
  assert.deepEqual(await source.results('view'), { region: 4 });
  /* A component's values: each within the View's rows. `status` has two values
     and both are picked — as a field that filters nothing, but each chip still
     counts its own. A RANGE has no values to count. */
  assert.deepEqual(await source.valueResults('data'), { status: { open: 3, shut: 1 } });

  // Rows answer it: no values. Off: none. Emptied: none.
  source.select('status', [], { mode: 'advanced', conditions: [{ op: 'contains', text: 'op' }] });
  assert.deepEqual(await source.valueResults('data'), {});
  source.suspendSelection('region');
  assert.deepEqual(await source.valueResults('view'), {});
  source.select('region', []);
  assert.deepEqual(await source.valueResults('view'), {});
});

test('a chip counts the rows ITS OWN answer matches, within what its scope can see', async () => {
  // TRAP T-a-chip-counts-its-own-results
  const store = new ArrayStore([
    { region: 'EMEA', status: 'open' }, { region: 'EMEA', status: 'shut' },
    { region: 'AMER', status: 'open' }, { region: 'AMER', status: 'open' },
  ]);
  const source = await openSource({
    store: 'rows',
    fields: { region: { label: 'Region' }, status: { label: 'Status' } },
    scopes: { view: { label: 'View filters', holds: ['region'] }, data: { label: 'Alerts', holds: ['status'] } },
  }, store);
  // Bound, `data` is a COMPONENT's scope: its answers are not the page's.
  source.bind({
    populate() {}, setAttribute() {}, removeAttribute() {}, addEventListener() {}, removeEventListener() {},
  }, { scope: 'data' });
  await source.setQuery({ v: 1, scopes: {
    view: { holds: ['region'], readings: { region: { picked: ['EMEA'] } } },
    data: { holds: ['status'], readings: { status: { picked: ['open'] } } },
  } });
  // The View's chip: its own answer over everything.
  assert.deepEqual(await source.results('view'), { region: 2 });
  // A component's chip: its own answer, within the View's EMEA rows — not 3.
  assert.deepEqual(await source.results('data'), { status: 1 });

  /* OFF keeps its number: what the answer WOULD match. Will, TODO 123. An
     off View answer narrows nothing, so the chip below counts over every row. */
  source.suspendSelection('region');
  assert.deepEqual(await source.results('view'), { region: 2 });
  assert.deepEqual(await source.results('data'), { status: 3 });
  // A SAVED filter is counted only while it is ON. Will, TODO 166.
  source.declarePreset('shut', { status: { picked: ['shut'] } }, { label: 'Shut' });
  source.answer('data', { status: { picked: ['open'] } }, { shut: false });
  assert.deepEqual(await source.results('data'), { status: 3 });
  // EMPTIED, a field has no number.
  source.select('status', []);
  assert.deepEqual(await source.results('data'), {});
  source.answer('data', {}, { shut: true });
  assert.deepEqual(await source.results('data'), { shut: 1 });
});

test('a carry-over field keeps its answer through a View change; any other resets', async () => {
  // TRAP T-a-field-can-carry-over-views
  const store = new ArrayStore([{ region: 'EMEA', customer: 'Contoso', status: 'open' }]);
  const source = await openSource({
    store: 'rows',
    fields: {
      customer: { label: 'Customer', carryOver: true },
      region: { label: 'Region' },
      status: { label: 'Status' },
    },
    scopes: { view: { label: 'View filters', holds: ['customer', 'region'] }, data: { label: 'Alerts', holds: ['status'] } },
  }, store);
  // What the reader has on, then a View that answers only Status.
  await source.setQuery({ v: 1, scopes: {
    view: { holds: ['customer', 'region'], readings: { customer: { picked: ['Contoso'] }, region: { picked: ['EMEA'] } } },
  } });
  await source.setQuery({ v: 1, scopes: { data: { readings: { status: { picked: ['open'] } } } } }, { holds: 'keep' });
  const view = source.query.applied.scopes.view;
  assert.deepEqual(view.readings.customer, { picked: ['Contoso'] }, 'Customer carries over');
  assert.equal(view.readings.region, undefined, 'Region resets, as by default');
  // A View that answers the field itself wins.
  await source.setQuery({ v: 1, scopes: { view: { readings: { customer: { picked: ['Fabrikam'] } } } } }, { holds: 'keep' });
  assert.deepEqual(source.query.applied.scopes.view.readings.customer, { picked: ['Fabrikam'] });
  // A RESTORE is exact: nothing is carried into it.
  await source.setQuery({ v: 1, scopes: { view: { holds: ['customer', 'region'], readings: {} } } });
  assert.equal(source.query.applied.scopes.view.readings.customer, undefined);
});

test('the View\'s date is a RANGE; a component\'s date stays one day', async () => {
  // TRAP T-a-range-is-bounded-by-the-data
  const store = new ArrayStore([{ created: '2024-01-02', seen: '2024-02-03' }]);
  const source = await openSource({
    store: 'rows',
    fields: { created: { label: 'Date', type: 'date' }, seen: { label: 'Last seen', type: 'date' } },
    scopes: { view: { label: 'View filters', holds: ['created'] }, data: { label: 'Alerts', holds: ['seen'] } },
  }, store);
  assert.equal(source.describe('view').filters.find((f) => f.id === 'created').range, true);
  assert.equal(source.describe('data').filters.find((f) => f.id === 'seen').range, undefined);
});

/* Found with TODO 167, fixed as 169: "Reset to default", and any View pick,
   took a bar's saved filter chips off it — a View kept the FIELD chips a scope
   holds and not its saved filters. TRAP T-a-view-keeps-the-saved-filter-chips */
test('a View keeps a scope\'s saved filter chips: each OFF, unless the View turns it on', async () => {
  const store = new ArrayStore([{ status: 'open', health: 40 }, { status: 'shut', health: 90 }]);
  const source = await openSource({
    store: 'rows',
    fields: { status: { label: 'Status' }, health: { label: 'Health', type: 'number' } },
    scopes: { data: { label: 'Alerts', holds: ['status'], presets: ['at-risk', 'shut'] } },
    presets: {
      'at-risk': { label: 'At risk', readings: { health: { op: 'lt', text: '60' } } },
      shut: { label: 'Shut', readings: { status: { picked: ['shut'] } } },
    },
  }, store);
  const presets = () => source.query.applied.scopes.data.presets;
  assert.deepEqual(presets(), { 'at-risk': false, shut: false });

  // A View that names NONE: both chips stay, off.
  await source.setQuery({ v: 1, scopes: { data: { sort: [], group: null, search: '' } } }, { holds: 'keep' });
  assert.deepEqual(presets(), { 'at-risk': false, shut: false });
  assert.deepEqual(source.describe('data').filters.map((f) => [f.id, f.active ?? null]),
    [['at-risk', false], ['shut', false], ['status', null]]);

  // A View that turns ONE on: that one on, the other still there.
  await source.setQuery({ v: 1, scopes: { data: { presets: { 'at-risk': true } } } }, { holds: 'keep' });
  assert.deepEqual(presets(), { 'at-risk': true, shut: false });

  // And back: the first is off again, and neither has gone.
  await source.setQuery({ v: 1, scopes: { data: { sort: [], group: null, search: '' } } }, { holds: 'keep' });
  assert.deepEqual(presets(), { 'at-risk': false, shut: false });
});
