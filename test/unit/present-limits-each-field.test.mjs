/**
 * WHAT THE FILTERS BEFORE IT LEAVE — TODO 174, then 349 (Will, D4 A). With
 * `limitOptions` on, each list field's values are the ones the rows still hold
 * under its scopes and the filters BEFORE it — one way only; a component
 * scope's are within the View's too. A field's own answer never limits it. Off,
 * only the View limits a component scope (347).
 *
 *   node --test test/unit/present-limits-each-field.test.mjs
 *
 * TRAP T-a-ruled-out-value-is-greyed
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { ArrayStore, DataSource, bindSource, spoofRemote, VIEW } from '../../dist/data.js';

/** The customers each region holds. */
const REGION_ORGS = {
  EMEA: ['Contoso', 'Adventure Works'],
  AMER: ['Contoso', 'Adventure Works', 'Tailspin'],
  APAC: ['Contoso', 'Adventure Works', 'Litware'],
  LATAM: ['Contoso', 'Tailspin'],
};
const ROWS = Object.entries(REGION_ORGS).flatMap(([region, orgs]) =>
  orgs.map((customer) => ({ region, customer, status: customer === 'Litware' ? 'trial' : 'active' })))
  .map((r, id) => ({ id, ...r }));
const sorted = (o) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, [...v].sort()]));
const tick = () => new Promise((r) => setTimeout(r, 0));

/** A bar over one scope: its chips, their readings, and what it is drawn. */
class Bar extends EventTarget {
  constructor(readings, chips) { super(); this.held = readings; this.chips = chips; this.drawn = []; }
  get readings() { return this.held; }
  get heldFields() { return this.chips; }
  drawScope() {}
  drawPresent(present, scope) { this.drawn.push({ scope, present: sorted(present) }); }
  setAttribute() {}
  removeAttribute() {}
  toggleAttribute() {}
  populate() {}
  report() { this.dispatchEvent(new CustomEvent('quick-filter-change', { detail: { readings: this.readings, holds: this.heldFields } })); }
}

async function setup({ view = {}, data = null, limit = true } = {}) {
  const source = new DataSource({ store: new ArrayStore(ROWS, { key: 'id' }), limitOptions: limit });
  await source.declareFromRows(['customer', 'region', 'status']);
  const bar = new Bar(view, ['customer', 'region']);
  bindSource(source, bar, { steerOnly: true, scope: VIEW });
  bar.report();
  let grid = null;
  if (data) {
    source.query.offer('data', ['status']);
    grid = new Bar(data, ['status']);
    bindSource(source, grid, { steerOnly: true, scope: 'data' });
    grid.report();
  }
  await source.load();
  // Let the set-aside pass and the draw that follows it run.
  for (let i = 0; i < 6; i++) await tick();
  return { source, bar, grid };
}

test('off, nothing is limited', async () => {
  const { source } = await setup({ view: { customer: { picked: ['Adventure Works'] } }, limit: false });
  assert.deepEqual(await source.present(VIEW), {});
});

test('off, only the View limits a component scope: it greys what the View leaves no row for', async () => {
  const { source } = await setup({ view: { customer: { picked: ['Litware'] } }, data: { status: { picked: ['trial'] } }, limit: false });
  assert.deepEqual(sorted(await source.present('data')).status, ['trial']);
  assert.deepEqual(await source.present(VIEW), {});
  assert.equal(source.debugState().total, 1);
});

test('every pick ruled out: the filter stays in force, and its chip counts 0 (Will, 2026-10-20)', async () => {
  const { source } = await setup({ view: { customer: { picked: ['Litware'] } }, data: { status: { picked: ['active'] } }, limit: false });
  assert.equal(source.debugState().total, 0);
  assert.deepEqual(source.debugState().aside, {});
  assert.deepEqual(await source.results('data'), { status: 0 });
});

test('a Customer pick limits Region; its own answer never limits Customer', async () => {
  const { source } = await setup({ view: { customer: { picked: ['Adventure Works'] } } });
  const p = sorted(await source.present(VIEW));
  assert.deepEqual(p.region, ['AMER', 'APAC', 'EMEA']);
  assert.deepEqual(p.customer, ['Adventure Works', 'Contoso', 'Litware', 'Tailspin']);
});

test('one way: Customer limits the Region after it; Region never limits the Customer before it', async () => {
  const { source } = await setup({ view: { customer: { picked: ['Contoso'] }, region: { picked: ['LATAM'] } } });
  const p = sorted(await source.present(VIEW));
  assert.deepEqual(p.customer, ['Adventure Works', 'Contoso', 'Litware', 'Tailspin']);
  assert.deepEqual(p.region, ['AMER', 'APAC', 'EMEA', 'LATAM']);
  const q = sorted((await setup({ view: { customer: { picked: ['Tailspin'] } } }).then(({ source: s }) => s.present(VIEW))));
  assert.deepEqual(q.region, ['AMER', 'LATAM']);
});

test('two answers that share no rows: the earlier stands, and the later stays in force at 0', async () => {
  const { source } = await setup({ view: { customer: { picked: ['Adventure Works'] }, region: { picked: ['LATAM'] } } });
  // Customer is before Region: Adventure Works stands; LATAM — none of its rows — stays, and the page is empty.
  assert.equal(source.debugState().total, 0);
  assert.deepEqual(await source.results(VIEW), { customer: 3, region: 0 });
  const p = sorted(await source.present(VIEW));
  assert.deepEqual(p.customer, ['Adventure Works', 'Contoso', 'Litware', 'Tailspin']);
  assert.deepEqual(p.region, ['AMER', 'APAC', 'EMEA']);
});

test('the View limits a component scope, never the other way round', async () => {
  const { source } = await setup({ view: { customer: { picked: ['Litware'] } }, data: { status: { picked: ['active'] } } });
  // Litware's rows are all trials, so the grid's Status offers trial alone.
  assert.deepEqual(sorted(await source.present('data')).status, ['trial']);
  // The grid's own answer narrows nothing the View offers.
  assert.deepEqual(sorted(await source.present(VIEW)).customer, ['Adventure Works', 'Contoso', 'Litware', 'Tailspin']);
});

test('a suspended answer limits nothing', async () => {
  const { source } = await setup({ view: { customer: { picked: ['Litware'], suspended: true } } });
  assert.deepEqual(sorted(await source.present(VIEW)).region, ['AMER', 'APAC', 'EMEA', 'LATAM']);
});

test('each bound bar is drawn what is left in its scope; turned off, it is told nothing is limited', async () => {
  const { source, bar } = await setup({ view: { customer: { picked: ['Litware'] } } });
  await tick(); await tick();
  assert.deepEqual(bar.drawn.at(-1), { scope: VIEW, present: {
    customer: ['Adventure Works', 'Contoso', 'Litware', 'Tailspin'], region: ['APAC'] } });
  source.limitOptions = false;
  await tick(); await tick();
  assert.deepEqual(bar.drawn.at(-1), { scope: VIEW, present: {} });
});

test('the rows are read ONCE per store change; a store with no scan is loaded, not asked per field', async () => {
  const inner = new ArrayStore(ROWS.map((r) => ({ ...r })), { key: 'id' });
  const whole = [];
  // A store with no scan and no distinct: the walk loads it, once.
  const store = Object.assign(new EventTarget(), {
    key: 'id', reportsTotal: true,
    load: (o = {}) => { if (!o.filter && o.take == null) whole.push(o); return inner.load(o); },
    totalCount: (o) => inner.totalCount(o), byKey: (k) => inner.byKey(k),
    insert: async (v) => { const r = await inner.insert(v); store.dispatchEvent(new CustomEvent('change', { detail: { type: 'insert' } })); return r; },
    update: (k, v) => inner.update(k, v), remove: (k) => inner.remove(k),
  });
  const source = new DataSource({ store, limitOptions: true });
  await source.declareFromRows(['customer', 'region']);
  const bar = new Bar({ customer: { picked: ['Tailspin'] } }, ['customer', 'region']);
  bindSource(source, bar, { steerOnly: true, scope: VIEW });
  bar.report();
  await source.load();
  for (let i = 0; i < 6; i++) await tick();
  whole.length = 0;
  assert.deepEqual(sorted(await source.present(VIEW)).region, ['AMER', 'LATAM']);
  assert.deepEqual(sorted(await source.present(VIEW)).customer, ['Adventure Works', 'Contoso', 'Litware', 'Tailspin']);
  assert.equal(whole.length, 0, 'the walk reads the rows it holds');
  await store.insert({ id: 99, region: 'APAC', customer: 'Tailspin', status: 'active' });
  for (let i = 0; i < 6; i++) await tick();
  assert.deepEqual(sorted(await source.present(VIEW)).region, ['AMER', 'APAC', 'LATAM']);
  assert.equal(whole.length, 1, 'one load after the change');
});

test('a remote store not held is asked step by step: its distinct values, per field', async () => {
  const inner = new ArrayStore(ROWS.map((r) => ({ ...r })), { key: 'id' });
  const asked = [];
  const distinct = inner.distinct.bind(inner);
  inner.distinct = (fields, o) => { asked.push(fields); return distinct(fields, o); };
  const source = new DataSource({ store: spoofRemote(inner, { delay: 0 }), limitOptions: true, holdRows: 0 });
  await source.declareFromRows(['customer', 'region']);
  asked.length = 0;
  const bar = new Bar({ customer: { picked: ['Tailspin'] } }, ['customer', 'region']);
  bindSource(source, bar, { steerOnly: true, scope: VIEW });
  bar.report();
  source.commit?.();
  await source.load();
  assert.deepEqual(sorted(await source.present(VIEW)).region, ['AMER', 'LATAM']);
  assert.ok(asked.some((f) => f.includes('region')));
});

/* TODO 180 asked that a LATER answer set an earlier pick aside; Will's D4 A
   (TODOs 347–349) put every limit in ONE order: the earlier pick stands, and
   limits the later. TRAP T-a-ruled-out-value-is-greyed */
test('a later answer never sets an earlier pick aside: the earlier limits it', async () => {
  // Adventure Works has no LATAM rows; Contoso has.
  const { source, bar } = await setup({ view: { customer: { picked: ['Adventure Works', 'Contoso'] } } });
  await tick(); await tick();
  assert.equal(source.debugState().total, 7);
  // LATAM is offered: Contoso makes it viable.
  assert.ok((await source.present(VIEW)).region.includes('LATAM'));

  bar.held = { customer: { picked: ['Adventure Works', 'Contoso'] }, region: { picked: ['LATAM'] } };
  bar.report();
  await source.load();
  for (let i = 0; i < 6; i++) await tick();
  // Contoso makes LATAM viable, so it stands: Contoso's LATAM row.
  assert.equal(source.debugState().total, 1);
  assert.deepEqual(source.debugState().aside, {});
  assert.deepEqual(source.query.applied.scopes.view.readings.customer.picked, ['Adventure Works', 'Contoso']);
  // Region is after Customer: it limits nothing before it.
  assert.ok((await source.present(VIEW)).customer.includes('Adventure Works'));

  // Region let go: Adventure Works is back in force.
  bar.held = { customer: { picked: ['Adventure Works', 'Contoso'] } };
  bar.report();
  await source.load();
  for (let i = 0; i < 6; i++) await tick();
  assert.equal(source.debugState().total, 7);
});

test('off, nothing is set aside', async () => {
  const { source } = await setup({ view: { customer: { picked: ['Adventure Works'] }, region: { picked: ['LATAM'] } }, limit: false });
  for (let i = 0; i < 6; i++) await tick();
  assert.equal(source.debugState().total, 0);
});
