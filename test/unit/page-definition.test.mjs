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
import { schemaCheck } from '../../scripts/lib/schema-check.mjs';

const core = new URL('../../dist/core/data/', import.meta.url);
const { ArrayStore } = await import(new URL('stores.js', core));
const { DataSource } = await import(new URL('data-source.js', core));
const { bindSource } = await import(new URL('../ui/bind-source.js', core));
const { rules, oneOf, number, min, max, required } = await import(new URL('validate.js', core));
const { checkPage, openSource } = await import(new URL('page-definition.js', core));

const ROOT = new URL('../../', import.meta.url);
const json = async (path) => JSON.parse(await readFile(new URL(path, ROOT), 'utf8'));

// The app's own definitions are checked in Sherpa Demos; this one is a copy of its Records page.
test('a real page definition passes the page schema', async () => {
  const check = schemaCheck('page.v1.json');
  assert.deepEqual(check(await json('test/unit/fixtures/records.page.json')), []);
  // A page's own saved filters are its scopes' presets now (plan 960 U4.4c): page.v1 has no `savedFilters`.
  assert.notDeepEqual(check({ v: 1, id: 'p', savedFilters: {} }), []);
  // A condition nests, and All is an answer: the schema says what the parser reads.
  const nested = { v: 1, id: 'p', source: { store: 'rows', scopes: { view: { where: {
    seats: { or: [{ lt: 10 }, { and: [{ gt: 50 }, { lt: 60 }] }] }, region: { all: true },
  } } } } };
  assert.deepEqual(check(nested), []);
  assert.notDeepEqual(check({ ...nested, source: { store: 'rows', scopes: { view: { where: { seats: { over: 3 } } } } } }), []);
  // A status field is the store's, as statusFields takes it: each value's when, a list of wheres.
  const status = schemaCheck('defs.v1.json#/$defs/statusField');
  assert.deepEqual(status({ type: 'status', label: 'Health', values: [
    { value: 'At risk', status: 'critical', when: [{ score: { lt: 60 } }, { openTickets: { gte: 5 } }] }, { value: 'Healthy', status: 'success' },
  ] }), []);
  assert.notDeepEqual(status({ type: 'status', values: [{ value: 'At risk', when: { score: { lt: 60 } } }] }), []);
});

// A page's Views library has its schema too: views.v1.json, each View a defs.v1.json view.
test('a views library passes its schema; one with a View that has no label does not', async () => {
  const check = schemaCheck('views.v1.json');
  assert.deepEqual(check(await json('test/reforged/views/demo-views.json')), []);
  assert.deepEqual(check(await json('test/reforged/views/broken-views.json')), ["/nameless must have required property 'label'"]);
  assert.deepEqual(schemaCheck('defs.v1.json#/$defs/view')({ label: 'Mine', query: { v: 1, scopes: { data: {
    where: { seats: { gt: 9 } }, sort: [{ field: 'seats', direction: 'desc' }], group: null, search: '',
  } } }, ui: { grid: { select: [[]] } } }), []);
});

/* The one check of a page's names, as it opens: DOM-free, one pass, and every
   builder after it quiet. TRAP T-a-page-is-checked-as-it-opens */
test('checkPage says each broken name in a page, and nothing of a sound one', async () => {
  const { onReport } = await import(new URL('report.js', core));
  const heard = (page) => {
    const said = [];
    const stop = onReport((r) => said.push(r.code));
    try { return { ok: checkPage(page), said }; } finally { stop(); }
  };
  assert.deepEqual(heard(await json('test/unit/fixtures/records.page.json')), { ok: true, said: [] });
  assert.deepEqual(heard({ v: 3, id: 'p' }), { ok: false, said: ['page-definition'] });
  const broken = {
    v: 1, id: 'p',
    source: {
      store: 'rows',
      fields: { customer: { child: 'site' }, seats: { type: 'number' } },
      scopes: {
        data: {
          holds: ['seats'],
          sets: [{ id: 's', fields: ['seats', 'plan'] }],
          presets: [{ id: 'big', label: 'Big', where: { seats: { gt: 9 } } }, { id: 'big', label: 'Bigger', where: { seats: { gt: 99 } } }],
        },
      },
    },
  };
  assert.deepEqual(heard(broken), { ok: false, said: ['child-not-declared', 'set-field-not-held', 'preset-twice'] });
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
  const def = {
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
  };
  assert.equal(checkPage({ v: 1, id: 'p', source: def }), false);
  const source = await openSource(def, new ArrayStore(rows));
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

test('a scope names the component it narrows by its tag, and no kind', async () => {
  // TRAP T-a-scope-says-what-it-shows
  const store = new ArrayStore([{ region: 'EMEA', status: 'open' }]);
  const source = await openSource({
    store: 'rows',
    fields: { region: { label: 'Region' }, status: { label: 'Status' } },
    scopes: { view: { label: 'View filters', holds: ['region'] }, data: { label: 'Alerts', holds: ['status'] } },
  }, store);
  const grid = {
    localName: 'sherpa-data-grid', populate() {}, setAttribute() {}, removeAttribute() {}, addEventListener() {}, removeEventListener() {},
  };
  assert.equal(source.describe('data').component, undefined, 'nothing bound');
  const off = bindSource(source, grid, { scope: 'data' });
  assert.equal(source.describe('data').component, 'sherpa-data-grid');
  // The data layer knows no kind of component. Will, TODO 341
  assert.equal('shows' in source.describe('data'), false);
  assert.equal('shows' in source.describe('view'), false);
  off();
  assert.equal(source.describe('data').component, undefined, 'unbound, it names none');
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
    data: { holds: ['status', 'seats'], readings: { status: { picked: ['open', 'shut'] }, seats: { mode: 'advanced', tree: { op: 'between', value: ['5', '9'] } } } },
  } });
  // The View's two values: each over everything. The field's own count is both.
  assert.deepEqual(await source.valueResults('view'), { region: { EMEA: 2, AMER: 2 } });
  assert.deepEqual(await source.results('view'), { region: 4 });
  /* A component's values: each within the View's rows. `status` has two values
     and both are picked — as a field that filters nothing, but each chip still
     counts its own. A RANGE — a Between row (TODO 375) — has no values to count. */
  assert.deepEqual(await source.valueResults('data'), { status: { open: 3, shut: 1 } });

  // Rows answer it: no values. Off: none. Emptied: none.
  source.query.ask({ scope: 'view', field: 'status', reading: { mode: 'advanced', tree: { op: 'contains', value: 'op' }, picked: [] } });
  assert.deepEqual(await source.valueResults('data'), {});
  source.query.ask({ scope: 'view', field: 'region', suspended: true });
  assert.deepEqual(await source.valueResults('view'), {});
  source.query.ask({ scope: 'view', field: 'region', reading: { picked: [] } });
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
  source.query.ask({ scope: 'view', field: 'region', suspended: true });
  assert.deepEqual(await source.results('view'), { region: 2 });
  assert.deepEqual(await source.results('data'), { status: 3 });
  // EMPTIED, a field has no number.
  source.query.ask({ scope: 'view', field: 'status', reading: { picked: [] } });
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
  // A View list fetches, so it resets to its start, never to every row. TODO 403
  assert.deepEqual(view.readings.region, { picked: ['EMEA'] }, 'Region resets to its start');
  // A View that answers the field itself wins.
  await source.query.setQuery({ v: 1, scopes: { view: { readings: { customer: { picked: ['Fabrikam'] } } } } }, { holds: 'keep' });
  assert.deepEqual(source.query.applied.scopes.view.readings.customer, { picked: ['Fabrikam'] });
  // A RESTORE is exact: nothing is carried into it — but a View list it leaves empty takes its start. TODO 403
  await source.query.setQuery({ v: 1, scopes: { view: { holds: ['customer', 'region'], readings: {} } } });
  assert.deepEqual(source.query.applied.scopes.view.readings.customer, { picked: ['Contoso'] });
});

test('a date is a RANGE only when its field says so, in the View too (TODO 397)', async () => {
  // TRAP T-a-range-is-bounded-by-the-data
  const store = new ArrayStore([{ created: '2024-01-02', due: '2024-01-09', seen: '2024-02-03' }]);
  const source = await openSource({
    store: 'rows',
    fields: {
      created: { label: 'Date', type: 'date', range: true },
      due: { label: 'Due', type: 'date' },
      seen: { label: 'Last seen', type: 'date' },
    },
    scopes: { view: { label: 'View filters', holds: ['created', 'due'] }, data: { label: 'Alerts', holds: ['seen'] } },
  }, store);
  const view = source.describe('view').filters;
  assert.equal(view.find((f) => f.id === 'created').range, true);
  assert.equal(view.find((f) => f.id === 'due').range, undefined);
  assert.equal(source.describe('data').filters.find((f) => f.id === 'seen').range, undefined);
});

// TRAP T-one-condition-tree · TODO 692 (its data half): a condition nests as deep as a page says it.
test('a nested condition in a page definition filters right: a start, a preset and a status value, A or (B and C)', async () => {
  const rows = [
    { id: 1, seats: 5, plan: 'Free' }, { id: 2, seats: 55, plan: 'Pro' }, { id: 3, seats: 55, plan: 'Free' },
    { id: 4, seats: 70, plan: 'Pro' }, { id: 5, seats: 30, plan: 'Pro' }, { id: 6, seats: 8, plan: 'Pro' },
  ];
  const ids = (source) => source.rows.map((r) => r.id).sort((a, b) => a - b);
  // seats < 10, or (seats > 50 and seats < 60): 1, 2, 3, 6.
  const nested = { or: [{ lt: 10 }, { and: [{ gt: 50 }, { lt: 60 }] }] };
  const fields = { seats: { label: 'Seats', type: 'number', advanced: true }, plan: { label: 'Plan' } };
  // Seats alone: a held list with no start opens on its first value (TODO 403), which would narrow it too.
  const start = await openSource({
    store: 'rows', fields, scopes: { view: { holds: ['seats'], where: { seats: nested } } },
  }, new ArrayStore(rows, { key: 'id' }));
  await start.load();
  assert.deepEqual(ids(start), [1, 2, 3, 6]);
  assert.deepEqual(start.query.applied.scopes.view.readings.seats,
    { tree: { or: [{ op: 'lt', value: 10 }, { and: [{ op: 'gt', value: 50 }, { op: 'lt', value: 60 }] }] }, mode: 'advanced' });
  // Two groups, (A and B) or (C and D), which a flat menu cannot draw, filter as said: 2, 3, 4.
  const two = await openSource({
    store: 'rows', fields, scopes: { view: { holds: ['seats'], where: { seats: { or: [{ gt: 50, lt: 60 }, { gt: 60, lt: 80 }] } } } },
  }, new ArrayStore(rows, { key: 'id' }));
  await two.load();
  assert.deepEqual(ids(two), [2, 3, 4]);
  // A preset that nests: on, its tree ANDs with the field's answer.
  const preset = await openSource({
    store: 'rows', fields,
    scopes: { data: { holds: ['plan'], presets: [{ id: 'odd', label: 'Odd sizes', where: { seats: nested, plan: { eq: 'Pro' } } }] } },
  }, new ArrayStore(rows, { key: 'id' }));
  preset.query.ask({ scope: 'data', preset: 'odd', on: true, commit: true });
  await preset.load();
  assert.deepEqual(ids(preset), [2, 6]);
  // A status value whose `when` nests: parsed once, worked out by the data.
  const { statusFields } = await import(new URL('status-field.js', core));
  const sized = statusFields(new ArrayStore(rows, { key: 'id' }), {
    size: { type: 'status', values: [{ value: 'Odd', when: [{ seats: nested }] }, { value: 'Even' }] },
  });
  const { rows: given } = await sized.load({ filter: ['size', 'eq', 'Odd'] });
  assert.deepEqual(given.map((r) => r.id).sort((a, b) => a - b), [1, 2, 3, 6]);
});

// Will, TODO 464: a page's scope may START with answers, as a View writes them.
test('a scope\'s `where` is its answer at the start: in force, and what Reset puts back', async () => {
  const source = await openSource({
    store: 'rows',
    fields: { created: { label: 'Date', type: 'date' }, plan: { label: 'Plan' } },
    scopes: { view: { holds: ['created', 'plan'], where: { created: { last: 12, unit: 'month' }, plan: { eq: 'pro' } } } },
  }, new ArrayStore([{ id: 1, created: '2026-01-01', plan: 'pro' }], { key: 'id' }));
  const readings = source.query.applied.scopes.view.readings;
  assert.deepEqual(readings.created.tree, { op: 'last', value: { n: 12, unit: 'month' } });
  assert.deepEqual(readings.plan.picked, ['pro']);
  // A View that names only another scope keeps it — and that is the default. TRAP T-a-page-scope-starts-with-its-answers
  const start = source.query.applied;
  const view = { v: 1, scopes: { data: { sort: [], group: null, search: '' } } };
  await source.query.setQuery(view, { holds: 'keep' });
  assert.deepEqual(source.query.applied.scopes.view.readings.plan.picked, ['pro']);
  assert.equal(source.atDefault(start, view), true);
});
