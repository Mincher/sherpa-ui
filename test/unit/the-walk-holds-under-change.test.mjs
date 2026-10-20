/**
 * THE WALK, under change — the review of 347–349 C5 and C6. A walk the Query
 * has moved past sets nothing aside; a hand filter is never compiled away; a
 * failed walk sets nothing aside and is not asked again until something moves;
 * a closed source walks nothing; the rows a source read to declare its fields
 * are the walk's; asked step by step, one filter's tallies are one request.
 * TRAP T-one-walk-counts-and-limits-in-order
 *
 *   node --test test/unit/the-walk-holds-under-change.test.mjs
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { ArrayStore, DataSource, bindSource, VIEW } from '../../dist/data.js';
import { planWalk, walkStepwise } from '../../dist/core/data/source-counts.js';

const REGION_ORGS = {
  EMEA: ['Contoso', 'Adventure Works'],
  AMER: ['Contoso', 'Adventure Works', 'Tailspin'],
  APAC: ['Contoso', 'Adventure Works', 'Litware'],
  LATAM: ['Contoso', 'Tailspin'],
};
const ROWS = Object.entries(REGION_ORGS).flatMap(([region, orgs]) =>
  orgs.map((customer) => ({ region, customer, status: customer === 'Litware' ? 'trial' : 'active' })))
  .map((r, id) => ({ id, ...r }));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const ticks = async (n = 8) => { for (let i = 0; i < n; i++) await sleep(0); };

class Bar extends EventTarget {
  constructor(readings, chips) { super(); this.held = readings; this.chips = chips; this.drawn = []; }
  get readings() { return this.held; }
  get presets() { return {}; }
  get heldFields() { return this.chips; }
  drawResults(r) { this.drawn.push(r); }
  drawScope() {} drawPresent() {} setAttribute() {} removeAttribute() {} toggleAttribute() {} populate() {}
  report() { this.dispatchEvent(new CustomEvent('quick-filter-change', { detail: { readings: this.readings, presets: this.presets, holds: this.heldFields } })); }
}

/** A remote store not held: its counts and tallies are requests, slow while told. */
function slowRemote() {
  const inner = new ArrayStore(ROWS, { key: 'id' });
  const seen = { loads: [], slow: false, fail: false, distinct: 0, asks: 0 };
  const wait = () => sleep(seen.slow ? 150 : 1);
  const store = Object.assign(new EventTarget(), {
    remote: true, key: 'id',
    async load(o) { seen.loads.push(JSON.stringify(o?.filter ?? null)); await sleep(1); return inner.load(o); },
    async totalCount(o) { seen.asks++; await wait(); if (seen.fail) throw new TypeError('down'); return inner.totalCount(o); },
    async distinct(f, o) { seen.distinct++; seen.asks++; await wait(); if (seen.fail) throw new TypeError('down'); return inner.distinct(f, o); },
    byKey: (k) => inner.byKey(k), insert: (v) => inner.insert(v), update: (k, v) => inner.update(k, v), remove: (k) => inner.remove(k),
  });
  return { store, seen };
}

async function viewBar(source, readings = {}) {
  source.declareValues('customer', Object.values(REGION_ORGS).flat().filter((c, i, a) => a.indexOf(c) === i));
  source.declareValues('region', Object.keys(REGION_ORGS));
  const bar = new Bar(readings, ['customer', 'region']);
  bindSource(source, bar, { steerOnly: true, scope: VIEW });
  bar.report();
  await source.load();
  await ticks();
  return bar;
}

test('a walk the Query has moved past sets nothing aside, and asks for no load', async () => {
  const { store, seen } = slowRemote();
  const source = new DataSource({ store, limitOptions: true, holdRows: 0 });
  const bar = await viewBar(source);
  const changes = [];
  source.addEventListener('change', (e) => changes.push(e.detail.total));
  // S0: Adventure Works then LATAM and EMEA — its slow walk would set LATAM aside.
  seen.slow = true;
  bar.held = { customer: { picked: ['Adventure Works'] }, region: { picked: ['LATAM', 'EMEA'] } };
  bar.report();
  await sleep(30);
  seen.slow = false;
  // S1: Contoso then LATAM — nothing to set aside.
  bar.held = { customer: { picked: ['Contoso'] }, region: { picked: ['LATAM'] } };
  bar.report();
  await sleep(120);
  const loads = seen.loads.length;
  const changed = changes.length;
  await sleep(700);
  assert.equal(seen.loads.length, loads, `extra loads: ${seen.loads.slice(loads)}`);
  assert.equal(changes.length, changed);
  assert.equal(source.total, 1);
  assert.deepEqual(source.debugState().aside, {});
});

test('a filter set by hand is never compiled away by a set-aside', async () => {
  const source = new DataSource({ store: new ArrayStore(ROWS, { key: 'id' }), limitOptions: true });
  await viewBar(source, { customer: { picked: ['Adventure Works'] }, region: { picked: ['LATAM', 'EMEA'] } });
  assert.deepEqual(source.debugState().aside, { view: { region: ['LATAM'] } });
  source.setFilter(['customer', 'eq', 'Tailspin']);
  await source.load();
  await ticks();
  assert.equal(source.total, 2);
  assert.deepEqual(source.debugState().filter, ['customer', 'eq', 'Tailspin']);
});

test('a failed walk sets nothing aside, and is not asked again until something moves', async () => {
  const { store, seen } = slowRemote();
  const source = new DataSource({ store, limitOptions: true, holdRows: 0, pageSize: 2 });
  const bar = await viewBar(source, { customer: { picked: ['Adventure Works'] }, region: { picked: ['LATAM', 'EMEA'] } });
  assert.deepEqual(source.debugState().aside, { view: { region: ['LATAM'] } });
  seen.fail = true;
  bar.held = { customer: { picked: ['Adventure Works'] }, region: { picked: ['LATAM', 'EMEA', 'APAC'] } };
  bar.report();
  await sleep(40);
  // The older Query's set-aside is gone: every region picked applies.
  assert.deepEqual(source.debugState().aside, {});
  const asked = seen.distinct;
  source.setPage(2);
  await sleep(40);
  assert.equal(seen.distinct, asked, 'a page turn asks nothing of a walk that failed');
});

test('a closed source walks nothing', async () => {
  const { store, seen } = slowRemote();
  const source = new DataSource({ store, limitOptions: true, holdRows: 0 });
  await viewBar(source, { customer: { picked: ['Tailspin'] } });
  source.close();
  const asked = seen.asks;
  source.limitOptions = false;
  await source.present(VIEW);
  await source.results(VIEW);
  await ticks();
  assert.equal(seen.asks, asked);
});

test('the rows read to declare the fields are the walk\'s: no second whole read on open', async () => {
  const inner = new ArrayStore(ROWS, { key: 'id' });
  let whole = 0;
  // A local store with no scan and no distinct, as IndexedDB is.
  const store = Object.assign(new EventTarget(), {
    key: 'id', reportsTotal: true,
    load: (o = {}) => { if (!o.filter && o.take == null) whole++; return inner.load(o); },
    totalCount: (o) => inner.totalCount(o), byKey: (k) => inner.byKey(k),
    insert: (v) => inner.insert(v), update: (k, v) => inner.update(k, v), remove: (k) => inner.remove(k),
  });
  const source = new DataSource({ store, limitOptions: true });
  await source.declareFromRows(['customer', 'region']);
  assert.equal(whole, 1);
  const bar = new Bar({ customer: { picked: ['Tailspin'] } }, ['customer', 'region']);
  bindSource(source, bar, { steerOnly: true, scope: VIEW });
  bar.report();
  await source.load();
  await ticks();
  assert.deepEqual([...(await source.present(VIEW)).region].sort(), ['AMER', 'LATAM']);
  assert.equal(whole, 1);
});

test('a page scope no component answers is counted, and its lists are not ruled by its own answer', async () => {
  const source = new DataSource({ store: new ArrayStore(ROWS, { key: 'id' }), limitOptions: true });
  source.declareValues('status', ['active', 'trial']);
  await viewBar(source);
  await source.setQuery({ v: 1, scopes: { view: { holds: ['customer', 'region'], readings: {} }, page: { holds: ['status'], readings: { status: { picked: ['trial'] } } } } });
  await ticks();
  assert.deepEqual(await source.results('page'), { status: 1 });
  assert.deepEqual(await source.present('page'), {});
});

test('a legend declared after the last load is told what the View leaves it', async () => {
  const source = new DataSource({ store: new ArrayStore(ROWS, { key: 'id' }) });
  await viewBar(source, { customer: { picked: ['Litware'] } });
  const chart = { populate() {}, setAttribute() {}, removeAttribute() {}, addEventListener() {}, removeEventListener() {} };
  bindSource(source, chart, { readonly: true, rows: 'all' });
  source.declareValues('status', ['active', 'trial']);
  await source.load();
  await ticks(12);
  const heard = [];
  source.addEventListener('present', (e) => heard.push(e.detail.byScope));
  source.declarePart('legend', { field: 'status', only: chart });
  await ticks(12);
  // Litware's rows are all trials: with Limit off, the View still greys "active" (Q1 A).
  assert.deepEqual(heard.at(-1)?.legend, { status: ['trial'] });
});

test('asked step by step, tallies under one filter go as one request, and a failure is heard', async () => {
  let asked = 0;
  const store = new ArrayStore(ROWS, { key: 'id' });
  const distinct = store.distinct.bind(store);
  store.distinct = (f, o) => { asked++; return distinct(f, o); };
  // Two held fields and a tap, nothing answered: all three under no filter.
  const plan = planWalk({ v: 1, scopes: { view: { holds: ['customer', 'region'], readings: {} } } }, {
    field: () => ({}), isList: () => true, plainPicks: () => true, presets: () => undefined, sets: () => [],
    fields: () => ['customer', 'region', 'status'], components: new Set(), fixed: new Set(), parts: [],
    narrowing: new Map(), limit: true, now: new Date(),
  });
  const walk = await walkStepwise(store, plan);
  assert.equal(asked, 1);
  assert.deepEqual([...walk.present.view.region].sort(), ['AMER', 'APAC', 'EMEA', 'LATAM']);
  // A store that fails: the walk fails — and no rejection goes unheard.
  const unheard = [];
  const listen = (e) => unheard.push(e);
  process.on('unhandledRejection', listen);
  store.distinct = () => Promise.reject(new TypeError('down'));
  await assert.rejects(walkStepwise(store, plan));
  await sleep(20);
  process.off('unhandledRejection', listen);
  assert.deepEqual(unheard, []);
});
