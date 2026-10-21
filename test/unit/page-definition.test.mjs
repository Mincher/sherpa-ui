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
const { bindSource } = await import(new URL('../ui/bind-source.js', core));
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
  const distinct = store.distinct.bind(store);
  store.load = (o) => { loads++; return load(o); };
  store.distinct = (f, o) => { loads++; return distinct(f, o); };
  const source = new DataSource({ store, autoLoad: false });
  await source.declareFromRows(['status']);
  assert.equal(loads, 0);
  assert.deepEqual(source.valuesFor('status'), ['active', 'trial']);
});

test('openSource builds the page\'s source: fields, labels, scopes and holds', async () => {
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
      data: { label: 'Alerts', offers: 'all' },
    },
  }, store);
  assert.deepEqual(source.query.scope('view'), ['customer', 'region']);
  assert.equal(source.query.scopeLabel('data'), 'Alerts');
  const region = source.filterDef('region');
  // The schema's order, and the reader's name for a value.
  assert.deepEqual(region.options, [
    { value: 'EMEA', label: 'EMEA' }, { value: 'AMER', label: 'Americas' }, { value: 'APAC', label: 'APAC' },
  ]);
  assert.equal(source.filterDef('customer').icon, 'buildings');
  assert.deepEqual(source.valuesFor('customer'), ['Contoso', 'Northwind']);
  // It holds nothing at the start: every field is on offer.
  assert.deepEqual(source.describe('data').filters, []);
});

test('a scope lists its filter SETS; a field in two, or one it does not hold, is said', async () => {
  const { onReport } = await import(new URL('report.js', core));
  const said = [];
  const stop = onReport((r) => said.push([r.code, r.at?.field]));
  const rows = [{ id: 1, region: 'AMER', customer: 'Contoso', tier: 'Pro' }];
  const source = await openSource({
    store: 'alerts',
    fields: { customer: { label: 'Customer' }, region: { label: 'Region' }, tier: { label: 'Tier' } },
    scopes: {
      view: {
        holds: ['customer', 'region'],
        sets: [
          { id: 'account', label: 'Account', mode: 'serial', fields: ['customer', 'region', 'tier'] },
          { id: 'again', fields: ['region'] },
        ],
      },
    },
  }, new ArrayStore(rows));
  stop();
  // TRAP T-a-filter-set-groups-or-chains
  assert.deepEqual(said, [['set-field-not-held', 'tier'], ['field-in-two-sets', 'region']]);
  assert.deepEqual(source.query.sets('view'), [
    { id: 'account', label: 'Account', mode: 'serial', fields: ['customer', 'region', 'tier'] },
    { id: 'again', fields: [] },
  ]);
  assert.deepEqual(source.describe('view').sets, source.query.sets('view'));
  assert.equal(source.describe('data').sets, undefined);
});

/* Will, D2 A (TODOs 347–349): ONE order, the source's — the fields it holds,
   each set together where its first field stands.
   TRAP T-one-walk-counts-and-limits-in-order */
test('describe() gives a scope\'s filters in the ONE order: its fields, each set together', async () => {
  const store = new ArrayStore([{ a: 1, b: 2, c: 3, d: 4 }]);
  const source = await openSource({
    store: 'rows',
    fields: { a: { label: 'A' }, b: { label: 'B' }, c: { label: 'C' }, d: { label: 'D' } },
    scopes: { data: { label: 'Rows', holds: ['a', 'c', 'd', 'b'], sets: [{ id: 's', fields: ['b', 'c'] }] } },
  }, store);
  assert.deepEqual(source.describe('data').filters.map((f) => f.id), ['a', 'b', 'c', 'd']);
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
  const off = bindSource(source, grid, { scope: 'data', shows: 'grid' });
  assert.equal(source.describe('data').shows, 'grid');
  off();
  assert.equal(source.describe('data').shows, undefined, 'unbound, it says nothing');
});

/* Will, TODO 172: "For multi value filters in the filter panel each chip
   should show their own count badge." TRAP T-a-chip-counts-within-the-filters-before-it */
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
  bindSource(source, {
    populate() {}, setAttribute() {}, removeAttribute() {}, addEventListener() {}, removeEventListener() {},
  }, { scope: 'data' });
  await source.query.setQuery({ v: 1, scopes: {
    view: { holds: ['region'], readings: { region: { picked: ['EMEA', 'AMER'] } } },
    data: { holds: ['status', 'seats'], readings: { status: { picked: ['open', 'shut'] }, seats: { mode: 'advanced', conditions: [{ op: 'between', picked: ['5', '9'] }] } } },
  } });
  // The View's two values: each over everything. The field's own count is both.
  assert.deepEqual(await source.valueResults('view'), { region: { EMEA: 2, AMER: 2 } });
  assert.deepEqual(await source.results('view'), { region: 4 });
  /* A component's values: each within the View's rows. `status` has two values
     and both are picked — as a field that filters nothing, but each chip still
     counts its own. A RANGE — a Between row (TODO 375) — has no values to count. */
  assert.deepEqual(await source.valueResults('data'), { status: { open: 3, shut: 1 } });

  // Rows answer it: no values. Off: none. Emptied: none.
  source.query.select('status', [], { mode: 'advanced', conditions: [{ op: 'contains', text: 'op' }] });
  assert.deepEqual(await source.valueResults('data'), {});
  source.query.suspendSelection('region');
  assert.deepEqual(await source.valueResults('view'), {});
  source.query.select('region', []);
  assert.deepEqual(await source.valueResults('view'), {});
});

test('a chip counts the rows ITS OWN answer matches, within what its scope can see', async () => {
  // TRAP T-a-chip-counts-within-the-filters-before-it
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
  bindSource(source, {
    populate() {}, setAttribute() {}, removeAttribute() {}, addEventListener() {}, removeEventListener() {},
  }, { scope: 'data' });
  await source.query.setQuery({ v: 1, scopes: {
    view: { holds: ['region'], readings: { region: { picked: ['EMEA'] } } },
    data: { holds: ['status'], readings: { status: { picked: ['open'] } } },
  } });
  // The View's chip: its own answer over everything.
  assert.deepEqual(await source.results('view'), { region: 2 });
  // A component's chip: its own answer, within the View's EMEA rows — not 3.
  assert.deepEqual(await source.results('data'), { status: 1 });

  /* OFF keeps its number: what the answer WOULD match. Will, TODO 123. An
     off View answer narrows nothing, so the chip below counts over every row. */
  source.query.suspendSelection('region');
  assert.deepEqual(await source.results('view'), { region: 2 });
  assert.deepEqual(await source.results('data'), { status: 3 });
  // EMPTIED, a field has no number.
  source.query.select('status', []);
  assert.deepEqual(await source.results('data'), {});
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
  await source.query.setQuery({ v: 1, scopes: {
    view: { holds: ['customer', 'region'], readings: { customer: { picked: ['Contoso'] }, region: { picked: ['EMEA'] } } },
  } });
  await source.query.setQuery({ v: 1, scopes: { data: { readings: { status: { picked: ['open'] } } } } }, { holds: 'keep' });
  const view = source.query.applied.scopes.view;
  assert.deepEqual(view.readings.customer, { picked: ['Contoso'] }, 'Customer carries over');
  assert.equal(view.readings.region, undefined, 'Region resets, as by default');
  // A View that answers the field itself wins.
  await source.query.setQuery({ v: 1, scopes: { view: { readings: { customer: { picked: ['Fabrikam'] } } } } }, { holds: 'keep' });
  assert.deepEqual(source.query.applied.scopes.view.readings.customer, { picked: ['Fabrikam'] });
  // A RESTORE is exact: nothing is carried into it.
  await source.query.setQuery({ v: 1, scopes: { view: { holds: ['customer', 'region'], readings: {} } } });
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
