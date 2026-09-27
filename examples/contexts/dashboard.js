/**
 * The dashboard Context. init(root) populates the metric tiles, charts and
 * summary inside `root`; the nav and header live once in index.html.
 *
 * Map:
 * - init — bind the dashboard Context — charts, tiles and legends — to one source
 */
import {
  ArrayStore, DataSource, VIEW_SCOPE, viewOptions, onViewPicked,
  loadSavedViews, saveViewAs,
  // Aggregation lives in the data layer, not here. TRAP T-aggregation-is-data.
  bandBy, summarise,
} from '../../dist/index.js';
import { globalFilters } from './global-filters.js';
import { namePrompt } from './ask-name.js';
import { DASHBOARD_VIEWS } from './dashboard-views.js';
import { customerStore, customersReady } from './records-data.js';
import {
  alerts, CATEGORY_ORDER, OS_ORDER, DAY_ORDER, SEVERITY_ORDER, STORAGE_EDGES, customerOrgs,
} from './dashboard-data.js';

export async function init(root) {
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
  const source = new DataSource({ store: new ArrayStore(alerts(), { key: 'id' }) });
  source.declareField('storage', { type: 'number' });
  // A category keeps its slot and colour; a quiet day keeps its point.
  // TRAP T-a-category-keeps-its-colour
  source.declareValues('category', CATEGORY_ORDER);
  source.declareValues('os', OS_ORDER);
  source.declareValues('day', DAY_ORDER);
  source.declareValues('severity', SEVERITY_ORDER);

  // Two lifetimes, two AbortControllers. `page` lasts while this Context is
  // mounted; `content` is shorter, because a Context's own elements are replaced
  // and a source pushing into a detached element leaks.
  const page = new AbortController();
  let content = new AbortController();

  const provider = document.querySelector('sherpa-provider');
  provider?.provide({ sources: { alerts: source } });
  // Gone with the Context, so the next one's components never reach this source.
  page.signal.addEventListener('abort', () => provider?.provide({ sources: {} }), { once: true });

  const bindContent = (el, as) => {
    if (el) source.bind(el, { readonly: true, as, signal: content.signal });
  };
  const dropContentBinds = () => {
    content.abort();
    content = new AbortController();
  };

  /* CRITICAL narrows its OWN rows, and a component's own filter is the Query's
     to hold (provider P3). Until then it is bound by hand, through the same
     summary a declaration gets. TRAP T-a-summary-binds-to-all-the-rows */
  const critical = $('#m-alerts');
  if (critical) {
    source.bind(critical, {
      readonly: true, rows: 'all', signal: page.signal,
      as: (rows, src) => summarise(rows.filter((r) => r.severity === 'critical'),
        { shape: 'aggregate', over: 'day' }, (f) => src.valuesFor(f)),
    });
  }

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

  /* THE HEADER'S CHIPS ARE THE VIEW SCOPE — the source draws them, and they
     answer it. Region and Customer are fields every alert carries; the Date
     chip names none, so it narrows nothing. TRAP T-one-query-one-owner */
  const viewBar = header?.querySelector('sherpa-quick-filter-toolbar[slot="filters"]');
  if (viewBar) source.bind(viewBar, { readonly: true, steerOnly: true, scope: VIEW_SCOPE, signal: page.signal });
  // The chips it holds, so a view drawn onto it keeps them.
  const holdHeader = () => source.hold(VIEW_SCOPE, (viewBar?.heldIds ?? []).filter((id) => id !== 'view'));
  holdHeader();
  const HEADER_FIELDS = new Set(['region', 'customer']);
  header?.addEventListener('quick-filter-change', (e) => {
    // TRAP T-values-carries-two-shapes — the BAR's event.
    if (e.detail?.scope !== 'bar') return;
    const readings = {};
    for (const [id, values] of Object.entries(e.detail.values ?? {})) {
      if (HEADER_FIELDS.has(id) && values?.length) readings[id] = { picked: values };
    }
    source.answer(VIEW_SCOPE, readings);
  }, { signal: page.signal });

  // ── The VIEW toolbar: picking a saved view ─────────────────────────────
  // `onViewPicked` reads the View chip's id and puts that view's JSON Query on;
  // the records page makes the same call. One write re-summarises all eight
  // components, and the header's chips are drawn from the SAME Query.
  // A FUNCTION, not the object: the library grows when a reader saves a view.
  // A view's own content goes into the region the template's charts occupy; a
  // view WITHOUT content leaves them alone.
  const contentRegion = root.querySelector('.sherpa-grid');

  // A histogram, not a donut: storage is continuous. The last band owns its
  // top edge. TRAP T-the-last-band-includes-its-top.
  const byBand = (rows) => bandBy(rows, 'storage', STORAGE_EDGES);

  onViewPicked(header, () => views, { source, elements: { header } }, {
    into: contentRegion,
    signal: page.signal,
    // The view already on screen — without this the first header change of a
    // session re-applies it and wipes the reader's pick.
    // TRAP T-a-persistent-chip-reports-on-every-change.
    applied: Object.keys(views)[0],
    after: ({ rendered }) => {
      // No content means the page's own charts and their binds stay.
      if (!rendered) return;
      dropContentBinds();

      // Addressed by the ids the DEFINITION used — these elements did not
      // exist when this page wired its binds. An unused id is simply absent.
      bindContent(rendered.elements['hist'], byBand);
      bindContent(rendered.elements['fullest'], (rows) => ({
        key: 'id',
        columns: [
          { field: 'id', label: 'Device', type: 'number' },
          { field: 'region', label: 'Region' },
          { field: 'os', label: 'OS' },
          { field: 'category', label: 'Category' },
          { field: 'storage', label: 'Storage %', type: 'number' },
        ],
        // The source already filtered and sorted; re-sorting here would be a
        // second opinion about the same query.
        rows: rows.slice(0, 50),
      }));
    },
  });

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
      holdHeader();
      // The saved view names ITSELF in the View chip.
      header.values = { view: [id] };
      await source.setQuery(kept);
      // Reported, so the URL and the nav follow the view just saved.
      viewBar?.report();
    });
  });
  header?.addEventListener('view-favorite', (e) => console.log('view-favorite', e.detail));
  header?.addEventListener('data-refresh', () => console.log('data-refresh'));

  await source.load();

  // The router calls whatever init() returns when it swaps away. ONE ABORT
  // covers every bind and the view-picker's listener; a list is a thing to
  // forget.
  return () => {
    page.abort();
    content.abort();
  };
}
