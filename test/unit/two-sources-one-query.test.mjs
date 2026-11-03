/**
 * TWO SOURCES, ONE QUERY — 366 step 25. Sources that share a Context's
 * QueryContext each compile only what is theirs: another source's component
 * scope, and a field they lack, are skipped and listed; the View's answers
 * reach both; each sorts its own rows; bind ids never clash; and one remote
 * source makes every answer wait for Apply.
 * TRAP T-a-source-compiles-only-what-it-has
 *
 *   node --test test/unit/two-sources-one-query.test.mjs
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { ArrayStore, DataSource, QueryContext, VIEW, bindSource, fakeRemote } from '../../dist/data.js';

const ALERTS = [
  { id: 1, severity: 'critical', region: 'EMEA' }, { id: 2, severity: 'info', region: 'EMEA' },
  { id: 3, severity: 'critical', region: 'AMER' }, { id: 4, severity: 'warning', region: 'APAC' },
];
const CUSTOMERS = [
  { id: 1, name: 'Contoso', region: 'EMEA' }, { id: 2, name: 'Tailspin', region: 'AMER' },
  { id: 3, name: 'Litware', region: 'APAC' },
];

/** A grid: it shows rows in its scope. */
const grid = (id) => Object.assign(new EventTarget(), {
  id, setAttribute() {}, removeAttribute() {}, hasAttribute: () => false, populate() {},
});

/** Two sources over one Query, each with its own grid scope. */
async function page({ remote = false, declare = true } = {}) {
  const query = new QueryContext();
  const alerts = new DataSource({ store: new ArrayStore(ALERTS, { key: 'id' }), query });
  const store = new ArrayStore(CUSTOMERS, { key: 'id' });
  const customers = new DataSource({ store: remote ? fakeRemote(store, { delay: 0 }) : store, query });
  if (declare) {
    for (const f of ['severity', 'region']) alerts.declareField(f);
    for (const f of ['name', 'region']) customers.declareField(f);
  }
  query.offer('alerts', ['severity', 'region']);
  query.offer('customers', ['name', 'region']);
  bindSource(alerts, grid('alerts-grid'), { scope: 'alerts' });
  bindSource(customers, grid('customers-grid'), { scope: 'customers' });
  await Promise.all([alerts.load(), customers.load()]);
  return { query, alerts, customers };
}
const ids = (source) => source.rows.map((r) => r.id).sort();
const settle = async (...sources) => {
  await new Promise((r) => setTimeout(r, 0));
  await Promise.all(sources.map((s) => s.load()));
};

test('one source\'s component scope never narrows the other', async () => {
  const { query, alerts, customers } = await page();
  query.ask({ scope: 'alerts', hold: ['severity'] });
  query.ask({ scope: 'alerts', field: 'severity', reading: { picked: ['critical'] } });
  await settle(alerts, customers);
  assert.deepEqual(ids(alerts), [1, 3]);
  assert.deepEqual(ids(customers), [1, 2, 3]);
  assert.ok(customers.debugState().skipped.includes('alerts'), 'and it says what it left out');
});

test('a View reading on a field one source lacks leaves that source whole', async () => {
  const { query, alerts, customers } = await page();
  query.ask({ scope: VIEW, hold: ['severity'] });
  query.ask({ scope: VIEW, field: 'severity', reading: { picked: ['critical'] } });
  await settle(alerts, customers);
  assert.deepEqual(ids(alerts), [1, 3]);
  assert.deepEqual(ids(customers), [1, 2, 3]);
  assert.deepEqual(customers.debugState().skipped, ['view.severity']);
});

test('a View reading on a field both have narrows both', async () => {
  const { query, alerts, customers } = await page();
  query.ask({ scope: VIEW, hold: ['region'] });
  query.ask({ scope: VIEW, field: 'region', reading: { picked: ['EMEA'] } });
  await settle(alerts, customers);
  assert.deepEqual(ids(alerts), [1, 2]);
  assert.deepEqual(ids(customers), [1]);
});

test('each source sorts its own rows', async () => {
  const { query, alerts, customers } = await page();
  query.ask({ scope: 'alerts', sort: 'severity', direction: 'desc' });
  query.ask({ scope: 'customers', sort: 'name', direction: 'asc' });
  await settle(alerts, customers);
  assert.deepEqual(alerts.rows.map((r) => r.severity), ['warning', 'info', 'critical', 'critical']);
  assert.deepEqual(customers.rows.map((r) => r.name), ['Contoso', 'Litware', 'Tailspin']);
});

test('a clear, a suspend, a resume and a reset touch only their own source\'s sort (TODO 523 S3)', async () => {
  const { query, alerts, customers } = await page();
  query.ask({ scope: 'alerts', sort: 'severity', direction: 'desc' });
  query.ask({ scope: 'customers', sort: 'name', direction: 'asc' });
  const sorts = () => [alerts.state.sort, customers.state.sort].map((s) => s.map((one) => one.field).join() || '-');
  // Suspended in Customers: Alerts keeps its sort, and Customers resumes its OWN.
  query.ask({ scope: 'customers', sort: null, direction: 'asc' });
  assert.deepEqual(sorts(), ['severity', '-']);
  query.ask({ scope: 'customers', sort: customers.state.sortSuspended.field, direction: customers.state.sortSuspended.direction });
  assert.deepEqual(sorts(), ['severity', 'name']);
  query.ask({ scope: 'alerts', sort: null, clear: true });
  assert.deepEqual(sorts(), ['-', 'name']);
  query.ask({ scope: 'alerts', sort: 'severity', direction: 'desc' });
  // A reset of Customers clears its arrangement only.
  query.ask({ scope: 'customers', reset: { organise: true } });
  assert.deepEqual(sorts(), ['severity', '-']);
});

test('bind ids never clash across the sources', async () => {
  const { alerts, customers } = await page();
  const a = alerts.debugState().bound.map((b) => b.id);
  const c = customers.debugState().bound.map((b) => b.id);
  assert.equal(a.some((id) => c.includes(id)), false);
});

test('one remote source: every answer waits for Apply, local ones too', async () => {
  const { query, alerts, customers } = await page({ remote: true });
  assert.equal(query.remote, true);
  query.ask({ scope: VIEW, hold: ['region'] });
  query.ask({ scope: VIEW, field: 'region', reading: { picked: ['EMEA'] } });
  await settle(alerts, customers);
  assert.deepEqual(ids(alerts), [1, 2, 3, 4], 'the local source waits too');
  assert.equal(query.pending('region'), true);
  query.ask({ commit: true });
  await settle(alerts, customers);
  assert.deepEqual(ids(alerts), [1, 2]);
  assert.deepEqual(ids(customers), [1]);
});

test('a source that declares nothing still applies a View reading its rows hold', async () => {
  const { query, alerts, customers } = await page({ declare: false });
  query.ask({ scope: VIEW, hold: ['region'] });
  query.ask({ scope: VIEW, field: 'region', reading: { picked: ['AMER'] } });
  await settle(alerts, customers);
  assert.deepEqual(ids(alerts), [3]);
  assert.deepEqual(ids(customers), [2]);
  assert.deepEqual(customers.debugState().skipped, []);
});
