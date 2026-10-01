/**
 * WHAT THE OTHER ANSWERS LEAVE — TODO 174, with 110's ruling B. With
 * `limitOptions` on, each list field's values are the ones the rows still hold
 * under the OTHER answers in its scope; a component scope's are within the
 * View's too. A field's own answer never limits it.
 *
 *   node --test test/unit/present-limits-each-field.test.mjs
 *
 * TRAP T-a-ruled-out-value-is-greyed
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { ArrayStore, DataSource, VIEW_SCOPE } from '../../dist/data.js';

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
  get presets() { return {}; }
  get heldFields() { return this.chips; }
  drawScope() {}
  drawPresent(present, scope) { this.drawn.push({ scope, present: sorted(present) }); }
  setAttribute() {}
  removeAttribute() {}
  toggleAttribute() {}
  populate() {}
  report() { this.dispatchEvent(new CustomEvent('quick-filter-change', { detail: {} })); }
}

async function setup({ view = {}, data = null, limit = true } = {}) {
  const source = new DataSource({ store: new ArrayStore(ROWS, { key: 'id' }), limitOptions: limit });
  await source.declareFromRows(['customer', 'region', 'status']);
  const bar = new Bar(view, ['customer', 'region']);
  source.bind(bar, { steerOnly: true, scope: VIEW_SCOPE });
  bar.report();
  let grid = null;
  if (data) {
    source.offer('data', ['status']);
    grid = new Bar(data, ['status']);
    source.bind(grid, { steerOnly: true, scope: 'data' });
    grid.report();
  }
  await source.load();
  // Let the set-aside pass and the draw that follows it run.
  for (let i = 0; i < 6; i++) await tick();
  return { source, bar, grid };
}

test('off, nothing is limited', async () => {
  const { source } = await setup({ view: { customer: { picked: ['Adventure Works'] } }, limit: false });
  assert.deepEqual(await source.present(VIEW_SCOPE), {});
});

test('a Customer pick limits Region; its own answer never limits Customer', async () => {
  const { source } = await setup({ view: { customer: { picked: ['Adventure Works'] } } });
  const p = sorted(await source.present(VIEW_SCOPE));
  assert.deepEqual(p.region, ['AMER', 'APAC', 'EMEA']);
  assert.deepEqual(p.customer, ['Adventure Works', 'Contoso', 'Litware', 'Tailspin']);
});

test('both ways: Region limits Customer, and Customer limits Region', async () => {
  const { source } = await setup({ view: { customer: { picked: ['Contoso'] }, region: { picked: ['LATAM'] } } });
  const p = sorted(await source.present(VIEW_SCOPE));
  assert.deepEqual(p.customer, ['Contoso', 'Tailspin']);
  assert.deepEqual(p.region, ['AMER', 'APAC', 'EMEA', 'LATAM']);
  const q = sorted((await setup({ view: { customer: { picked: ['Tailspin'] } } }).then(({ source: s }) => s.present(VIEW_SCOPE))));
  assert.deepEqual(q.region, ['AMER', 'LATAM']);
});

test('two answers that share no rows: the later one stands, the earlier is set aside', async () => {
  const { source } = await setup({ view: { customer: { picked: ['Adventure Works'] }, region: { picked: ['LATAM'] } } });
  // Region is the later answer: LATAM stands, so every LATAM row shows.
  assert.equal(source.debugState().total, 2);
  const p = sorted(await source.present(VIEW_SCOPE));
  assert.deepEqual(p.customer, ['Contoso', 'Tailspin']);
  // Adventure Works applies nothing, so Region is not limited by it.
  assert.deepEqual(p.region, ['AMER', 'APAC', 'EMEA', 'LATAM']);
});

test('the View limits a component scope, never the other way round', async () => {
  const { source } = await setup({ view: { customer: { picked: ['Litware'] } }, data: { status: { picked: ['active'] } } });
  // Litware's rows are all trials, so the grid's Status offers trial alone.
  assert.deepEqual(sorted(await source.present('data')).status, ['trial']);
  // The grid's own answer narrows nothing the View offers.
  assert.deepEqual(sorted(await source.present(VIEW_SCOPE)).customer, ['Adventure Works', 'Contoso', 'Litware', 'Tailspin']);
});

test('a suspended answer limits nothing', async () => {
  const { source } = await setup({ view: { customer: { picked: ['Litware'], suspended: true } } });
  assert.deepEqual(sorted(await source.present(VIEW_SCOPE)).region, ['AMER', 'APAC', 'EMEA', 'LATAM']);
});

test('each bound bar is drawn what is left in its scope; turned off, it is told nothing is limited', async () => {
  const { source, bar } = await setup({ view: { customer: { picked: ['Litware'] } } });
  await tick(); await tick();
  assert.deepEqual(bar.drawn.at(-1), { scope: VIEW_SCOPE, present: {
    customer: ['Adventure Works', 'Contoso', 'Litware', 'Tailspin'], region: ['APAC'] } });
  source.limitOptions = false;
  await tick(); await tick();
  assert.deepEqual(bar.drawn.at(-1), { scope: VIEW_SCOPE, present: {} });
});

test('a store that answers distinct values is asked, not read row by row', async () => {
  const store = new ArrayStore(ROWS, { key: 'id' });
  const asked = [];
  store.distinct = async (fields, options) => {
    asked.push(fields);
    const { rows } = await store.load(options);
    return Object.fromEntries(fields.map((f) => [f, rows.map((r) => r[f])]));
  };
  const source = new DataSource({ store, limitOptions: true });
  await source.declareFromRows(['customer', 'region']);
  const bar = new Bar({ customer: { picked: ['Tailspin'] } }, ['customer', 'region']);
  source.bind(bar, { steerOnly: true, scope: VIEW_SCOPE });
  bar.report();
  await source.load();
  assert.deepEqual(sorted(await source.present(VIEW_SCOPE)).region, ['AMER', 'LATAM']);
  assert.ok(asked.some((f) => f.includes('region')));
});

/* TODO 180 — Will: "Customer A is selected but made unviable by Region C
   being activated … possible if Customer B makes Region C viable again." The
   LATER answer wins: the earlier pick is set aside — kept, not applied.
   TRAP T-a-later-answer-sets-an-earlier-pick-aside */
test('a later answer sets aside an earlier pick it rules out; the rows leave it out', async () => {
  // Adventure Works has no LATAM rows; Contoso has.
  const { source, bar } = await setup({ view: { customer: { picked: ['Adventure Works', 'Contoso'] } } });
  await tick(); await tick();
  assert.equal(source.debugState().total, 7);
  // LATAM is offered: Contoso makes it viable.
  assert.ok((await source.present(VIEW_SCOPE)).region.includes('LATAM'));

  bar.held = { customer: { picked: ['Adventure Works', 'Contoso'] }, region: { picked: ['LATAM'] } };
  bar.report();
  await source.load();
  for (let i = 0; i < 6; i++) await tick();
  // Contoso's LATAM row only: Adventure Works is set aside, not applied.
  assert.equal(source.debugState().total, 1);
  // The reader's picks are KEPT in the Query.
  assert.deepEqual(source.query.applied.scopes.view.readings.customer.picked, ['Adventure Works', 'Contoso']);
  // And what is left says so: Adventure Works is no longer present.
  assert.ok(!(await source.present(VIEW_SCOPE)).customer.includes('Adventure Works'));

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
