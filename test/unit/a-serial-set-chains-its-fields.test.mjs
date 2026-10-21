/**
 * A SERIAL filter set chains its fields — TODO 99, then 349 (Q2 A). Each field
 * below the top offers only the values the rows hold at its place — under every
 * filter before it, once one narrows — and a pick the chain rules out is set
 * aside. The top is never cut. Whatever `limitOptions` says.
 *
 *   node --test test/unit/a-serial-set-chains-its-fields.test.mjs
 *
 * TRAP T-a-filter-set-groups-or-chains
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { ArrayStore, DataSource, bindSource, VIEW } from '../../dist/data.js';

/** The customers each region holds. */
const REGION_ORGS = {
  EMEA: ['Contoso', 'Adventure Works'],
  AMER: ['Contoso', 'Adventure Works', 'Tailspin'],
  APAC: ['Contoso', 'Adventure Works', 'Litware'],
  LATAM: ['Contoso', 'Tailspin'],
};
const ROWS = Object.entries(REGION_ORGS).flatMap(([region, orgs]) => orgs.map((customer) => ({ region, customer })))
  .map((r, id) => ({ id, ...r }));
const sorted = (o) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, [...v].sort()]));
const tick = () => new Promise((r) => setTimeout(r, 0));

/** A bar over the View: its readings, and what it is drawn. */
class Bar extends EventTarget {
  constructor(readings) { super(); this.held = readings; this.offered = []; }
  get readings() { return this.held; }
  get heldFields() { return ['customer', 'region']; }
  drawScope() {}
  drawOffered(offered, scope) { this.offered.push({ scope, offered: sorted(offered) }); }
  setAttribute() {}
  removeAttribute() {}
  toggleAttribute() {}
  populate() {}
  report() { this.dispatchEvent(new CustomEvent('quick-filter-change', { detail: { readings: this.readings, holds: this.heldFields } })); }
}

async function setup(readings, { mode = 'serial', limit = false } = {}) {
  const source = new DataSource({ store: new ArrayStore(ROWS, { key: 'id' }), limitOptions: limit });
  await source.declareFromRows(['customer', 'region']);
  source.declareSets(VIEW, [{ id: 'account', mode, fields: ['customer', 'region', 'tier'] }]);
  const bar = new Bar(readings);
  bindSource(source, bar, { steerOnly: true, scope: VIEW });
  bar.report();
  await source.load();
  // The set-aside pass, the load it may ask for, and the draw after it.
  for (let i = 0; i < 6; i++) await source.load().then(tick);
  return { source, bar };
}

test('a field offers what the fields above it leave; the top of the chain offers all', async () => {
  const { source } = await setup({ customer: { picked: ['Litware'] } });
  assert.deepEqual(await source.offered(VIEW), { region: ['APAC'] });
});

test('a pick the chain rules out is SET ASIDE: kept in the Query, out of the rows', async () => {
  // Adventure Works has no LATAM rows; it has EMEA ones.
  const { source } = await setup({ customer: { picked: ['Adventure Works'] }, region: { picked: ['LATAM', 'EMEA'] } });
  assert.equal(source.debugState().total, 1);
  assert.deepEqual(source.debugState().aside, { view: { region: ['LATAM'] } });
  assert.deepEqual(source.query.applied.scopes.view.readings.region.picked, ['LATAM', 'EMEA']);
  assert.deepEqual(sorted(await source.offered(VIEW)).region, ['AMER', 'APAC', 'EMEA']);
});

test('every pick the chain rules out: the field stays in force, at 0 (Will, 2026-10-20)', async () => {
  const { source } = await setup({ customer: { picked: ['Adventure Works'] }, region: { picked: ['LATAM'] } });
  assert.equal(source.debugState().total, 0);
  assert.deepEqual(source.debugState().aside, {});
  assert.deepEqual(await source.results(VIEW), { customer: 3, region: 0 });
});

test('a field is never ruled out by one BELOW it — even with Limit on, and Region the later answer', async () => {
  const { source } = await setup({ customer: { picked: ['Adventure Works'] }, region: { picked: ['LATAM', 'EMEA'] } }, { limit: true });
  // Customer is before Region: it stands, and LATAM goes.
  assert.equal(source.debugState().total, 1);
  assert.deepEqual(source.debugState().aside, { view: { region: ['LATAM'] } });
});

test('a filter before the set limits the chain, though the top is unanswered', async () => {
  const { source } = await setup({});
  // A whole filter set by hand is the View's base: it stands before the set.
  source.setFilter(['region', 'in', ['EMEA', 'AMER']]);
  await source.load();
  assert.deepEqual(sorted(await source.offered(VIEW)), { region: ['AMER', 'EMEA'] });
});

test('a component scope\'s chain starts inside the View', async () => {
  const source = new DataSource({ store: new ArrayStore(ROWS, { key: 'id' }) });
  await source.declareFromRows(['customer', 'region']);
  source.offer('data', ['customer', 'region']);
  source.declareSets('data', [{ id: 'acct', mode: 'serial', fields: ['customer', 'region'] }]);
  bindSource(source, { populate() {}, setAttribute() {}, removeAttribute() {}, addEventListener() {}, removeEventListener() {} }, { scope: 'data' });
  await source.setQuery({ v: 1, scopes: {
    view: { holds: [], readings: {} },
    data: { holds: ['customer', 'region'], readings: {} },
  } });
  // What the View leaves — here a filter set by hand — narrows the chain, though its top is unanswered.
  source.setFilter(['customer', 'eq', 'Tailspin']);
  await source.load();
  assert.deepEqual(sorted(await source.offered('data')), { region: ['AMER', 'LATAM'] });
});

test('a PARALLEL set only groups: it offers no less, and sets nothing aside', async () => {
  const { source } = await setup({ customer: { picked: ['Adventure Works'] }, region: { picked: ['LATAM'] } }, { mode: 'parallel' });
  assert.deepEqual(await source.offered(VIEW), {});
  assert.equal(source.debugState().total, 0);
});

test('a bound bar is drawn what its chain offers', async () => {
  const { bar } = await setup({ customer: { picked: ['Tailspin'] } });
  assert.deepEqual(bar.offered.at(-1), { scope: VIEW, offered: { region: ['AMER', 'LATAM'] } });
});
