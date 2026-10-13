/**
 * A SERIAL filter set chains its fields — TODO 99. Each field offers only the
 * values the rows hold under the answers of the fields ABOVE it, and a pick
 * the chain rules out is set aside. Whatever `limitOptions` says.
 *
 *   node --test test/unit/a-serial-set-chains-its-fields.test.mjs
 *
 * TRAP T-a-filter-set-groups-or-chains
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { ArrayStore, DataSource, bindSource, VIEW_SCOPE } from '../../dist/data.js';

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
  get presets() { return {}; }
  get heldFields() { return ['customer', 'region']; }
  drawScope() {}
  drawOffered(offered, scope) { this.offered.push({ scope, offered: sorted(offered) }); }
  setAttribute() {}
  removeAttribute() {}
  toggleAttribute() {}
  populate() {}
  report() { this.dispatchEvent(new CustomEvent('quick-filter-change', { detail: {} })); }
}

async function setup(readings, { mode = 'serial', limit = false } = {}) {
  const source = new DataSource({ store: new ArrayStore(ROWS, { key: 'id' }), limitOptions: limit });
  await source.declareFromRows(['customer', 'region']);
  source.declareSets(VIEW_SCOPE, [{ id: 'account', mode, fields: ['customer', 'region', 'tier'] }]);
  const bar = new Bar(readings);
  bindSource(source, bar, { steerOnly: true, scope: VIEW_SCOPE });
  bar.report();
  await source.load();
  // The set-aside pass, the load it may ask for, and the draw after it.
  for (let i = 0; i < 6; i++) await source.load().then(tick);
  return { source, bar };
}

test('a field offers what the fields above it leave; the top of the chain offers all', async () => {
  const { source } = await setup({ customer: { picked: ['Litware'] } });
  assert.deepEqual(await source.offered(VIEW_SCOPE), { region: ['APAC'] });
});

test('a pick the chain rules out is SET ASIDE: kept in the Query, out of the rows', async () => {
  // Adventure Works has no LATAM rows.
  const { source } = await setup({ customer: { picked: ['Adventure Works'] }, region: { picked: ['LATAM'] } });
  assert.equal(source.debugState().total, 3);
  assert.deepEqual(source.query.applied.scopes.view.readings.region.picked, ['LATAM']);
  assert.deepEqual(sorted(await source.offered(VIEW_SCOPE)).region, ['AMER', 'APAC', 'EMEA']);
});

test('a field is never ruled out by one BELOW it — even with Limit on, and Region the later answer', async () => {
  const { source } = await setup({ customer: { picked: ['Adventure Works'] }, region: { picked: ['LATAM'] } }, { limit: true });
  // In parallel, LATAM would win and Adventure Works go (TODO 180). The chain keeps Customer.
  assert.equal(source.debugState().total, 3);
});

test('a PARALLEL set only groups: it offers no less, and sets nothing aside', async () => {
  const { source } = await setup({ customer: { picked: ['Adventure Works'] }, region: { picked: ['LATAM'] } }, { mode: 'parallel' });
  assert.deepEqual(await source.offered(VIEW_SCOPE), {});
  assert.equal(source.debugState().total, 0);
});

test('a bound bar is drawn what its chain offers', async () => {
  const { bar } = await setup({ customer: { picked: ['Tailspin'] } });
  assert.deepEqual(bar.offered.at(-1), { scope: VIEW_SCOPE, offered: { region: ['AMER', 'LATAM'] } });
});
