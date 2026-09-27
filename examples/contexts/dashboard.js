/**
 * The dashboard Context. init(root) populates the metric tiles, charts and
 * summary inside `root`; the nav and header live once in index.html.
 *
 * Map:
 * - init — bind the dashboard Context — charts, tiles and legends — to one source
 */
import {
  ArrayStore, DataSource, VIEW_SCOPE, viewOptions,
  loadSavedViews, saveViewAs,
} from '../../dist/index.js';
import { globalFilters } from './global-filters.js';
import { namePrompt } from './ask-name.js';
import { DASHBOARD_VIEWS } from './dashboard-views.js';
import { customerStore, customersReady } from './records-data.js';
import {
  alerts, CATEGORY_ORDER, OS_ORDER, DAY_ORDER, SEVERITY_ORDER, customerOrgs,
} from './dashboard-data.js';

export async function init(root, { session, view } = {}) {
  // Presets first, so a reader's saved views read as additions to them.
  let views = { ...DASHBOARD_VIEWS, ...loadSavedViews('dashboard') };

  const headerConfig = {
    // No breadcrumb: this view IS home, so a trail would name one page twice.
    breadcrumb: [],
    // The header's toolbar is data-type="view", so it carries SAVED VIEWS —
    // arrangements of this page — not the data filters a chart reads.
    // Options come FROM the views, so a label cannot drift from its view.
    // TRAP T-a-chip-filters-the-values-the-data-has.
    filters: globalFilters(viewOptions(views), undefined, customerOrgs),
  };




  // Summary read from the SAME store the Records page uses, so adding a
  // customer there moves these numbers.
  const customerSummary = (rows) => {
    const count = (field, value) => rows.filter((r) => r[field] === value).length;
    const seats = rows.reduce((n, r) => n + (Number(r.seats) || 0), 0);
    return [
      { key: 'Customers',   value: String(rows.length) },
      { key: 'Active',      value: String(count('status', 'active')) },
      { key: 'Trials',      value: String(count('status', 'trial')) },
      { key: 'Churned',     value: String(count('status', 'churned')) },
      { key: 'Seats sold',  value: seats.toLocaleString() },
      { key: 'Enterprise',  value: String(count('plan', 'Enterprise')) },
    ];
  };

  // Wait for the Context's elements to define, then populate.
  await Promise.all([
    customElements.whenDefined('sherpa-app-header'),
    customElements.whenDefined('sherpa-metric'),
    customElements.whenDefined('sherpa-barchart'),
    customElements.whenDefined('sherpa-radial-chart'),
    customElements.whenDefined('sherpa-gauge-chart'),
    customElements.whenDefined('sherpa-line-chart'),
    customElements.whenDefined('sherpa-chart-legend'),
    customElements.whenDefined('sherpa-container-header'),
    customElements.whenDefined('sherpa-key-value-list'),
  ]);

  const $ = (sel) => root.querySelector(sel);

  // Shared header — it lives in index.html, not in this Context's root.
  const header = document.querySelector('sherpa-app-shell > sherpa-app-header');
  // Awaited, so a host picking a View after init() finds the chips.
  await header?.populate(headerConfig);
  header?.setAttribute('data-notifications', '4');

  /* ONE SOURCE, and the PROVIDER answers the page: each chart and tile
     DECLARES what it needs of the rows in dashboard.html and asks, so a filter
     set once re-summarises every one. TRAP T-a-component-declares-its-summary */
  const rows = alerts();
  const source = new DataSource({ store: new ArrayStore(rows, { key: 'id' }) });
  source.declareField('storage', { type: 'number' });
  /* The header's fields, declared once — the panel draws them from these.
     TRAP T-a-field-is-declared-once */
  source.declareScope(VIEW_SCOPE, { label: 'View filters' });
  for (const [field, label] of [['region', 'Region'], ['customer', 'Customer']]) {
    source.declareField(field, { label, select: 'multiple' });
    source.declareValues(field, [...new Set(rows.map((r) => r[field]))].sort());
  }
  // A category keeps its slot and colour; a quiet day keeps its point.
  // TRAP T-a-category-keeps-its-colour
  source.declareValues('category', CATEGORY_ORDER);
  source.declareValues('os', OS_ORDER);
  source.declareValues('day', DAY_ORDER);
  source.declareValues('severity', SEVERITY_ORDER);

  // ONE lifetime: while this Context is mounted.
  const page = new AbortController();

  /* THE PROVIDER has the source AND the Views: it hears a View pick, puts its
     Query on, and draws a View's own content into `data-view-content` — whose
     components ask for their data like the rest. A FUNCTION, not the object:
     the library grows when a reader saves a view.
     TRAP T-a-provider-keeps-the-views */
  const provider = document.querySelector('sherpa-provider');
  /* …and keeps its Query for the session, on the View it was made on, as
     Records does. TRAP T-navigating-sets-up-the-page */
  const restored = provider?.provide({
    sources: { alerts: source }, views: () => views, view, session, key: '/filters/dashboard',
  });
  // Gone with the Context, so the next one's components never reach this source.
  page.signal.addEventListener('abort', () => provider?.provide({ sources: {} }), { once: true });

  // The gauge legend names THRESHOLD ZONES. No colour indices: a zone's colour
  // is a status, not a categorical series hue.
  $('#gauge-legend')?.populate([
    { label: 'Healthy (0–60%)', status: 'success' },
    { label: 'Warning (60–85%)', status: 'warning' },
    { label: 'Critical (85–100%)', status: 'critical' },
  ]);
  // A second DataSource over the shared customer store — a different store to
  // the one the charts read, which is the point of the demonstration.
  const customerSource = new DataSource({ store: customerStore });
  const kv = $('#kv');
  // SEED FIRST, THEN BIND. The customer store is IndexedDB, and `bind()`
  // populates straight away — binding first paints "Customers 0". Not awaited
  // at the top of init: the rest of the page reads a different store.
  if (kv) {
    void customersReady.then(() => {
      if (page.signal.aborted) return;
      customerSource.bind(kv, { readonly: true, as: customerSummary, signal: page.signal });
      return customerSource.load();
    });
  }

  /* Legends are FILTERS of their own chart: each reads its chart's field and
     asks, and the provider wires the pick. TRAP T-a-legend-toggle-is-a-filter
     The gauge legend is a KEY, not a filter — a gauge shows one value. */

  // A little interactivity so the demo is live.
  $('#bar')?.addEventListener('bar-click', (e) => {
    console.log('bar-click', e.detail);
  });

  /* THE HEADER'S CHIPS ARE THE VIEW SCOPE: its bar asks (`data-scope="view"`),
     the source draws it and hears it. Region and Customer are fields every
     alert carries; the Date chip names none here, so it narrows nothing.
     TRAP T-one-query-one-owner · TRAP T-a-bar-reports-its-holds */
  const viewBar = header?.querySelector('sherpa-quick-filter-toolbar[slot="filters"]');
  source.hold(VIEW_SCOPE, ['region', 'customer']);

  // SAVE THIS VIEW — as JSON: the Query on screen and how its rows are arranged.
  // TRAP T-a-view-is-json
  const askViewName = namePrompt(root.querySelector('#save-view'), page.signal);
  header?.addEventListener('view-save', async () => {
    // The page's own dialog, never the browser's prompt(). Will, 2026-09-25.
    const label = await askViewName();
    if (!label) return;
    const id = label.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    views = { ...views, ...saveViewAs('dashboard', label, { source }) };
    /* RE-POPULATE, THEN DRAW THE QUERY BACK: `populate` rebuilds the bar from
       the defs, wiping its chips. The Query is read BEFORE, because a rebuilt
       bar's first report is empty. Await populate(), NOT `rendered` — that
       resolved when the header first drew. */
    const kept = source.query.applied;
    void Promise.resolve(
      header.populate({ ...headerConfig, filters: globalFilters(viewOptions(views, id), undefined, customerOrgs) }),
    ).then(async () => {
      // The saved view names ITSELF in the View chip.
      header.values = { view: [id] };
      await source.setQuery(kept);
      // Reported, so the URL and the nav follow the view just saved.
      viewBar?.report();
    });
  });
  header?.addEventListener('view-favorite', (e) => console.log('view-favorite', e.detail));
  header?.addEventListener('data-refresh', () => console.log('data-refresh'));

  await restored;
  await source.load();

  // The router calls whatever init() returns when it swaps away. ONE ABORT
  // covers every bind and the view-picker's listener; a list is a thing to
  // forget.
  return () => page.abort();
}
