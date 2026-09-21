/**
 * The dashboard view. init(root) populates the metric tiles, charts and
 * summary inside `root`; the nav and header live once in index.html.
 */
import {
  ArrayStore, DataSource, viewOptions, onViewPicked,
  loadSavedViews, saveViewAs,
  // Aggregation lives in the data layer, not here. TRAP T-aggregation-is-data.
  countBy, bandBy, seriesBy, reduceRows,
} from '../../dist/index.js';
import { globalFilters } from './global-filters.js';
import { DASHBOARD_VIEWS } from './dashboard-views.js';
import { customerStore, customersReady } from './records-data.js';
import {
  alerts, CATEGORY_ORDER, OS_ORDER, DAY_ORDER, STORAGE_EDGES, customerOrgs,
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

  // ── Metric tiles (with sparkline series). ───────────────────────────
  const metrics = {
    'm-endpoints': {
      label: 'Active endpoints', value: '1,284', deltaPercent: 3.1, trend: 'up',
      values: [1180, 1195, 1210, 1188, 1230, 1255, 1249, 1270, 1284],
    },
    'm-alerts': {
      label: 'Open alerts', value: '37', deltaPercent: -12.5, trend: 'down',
      values: [61, 58, 54, 49, 52, 45, 41, 39, 37],
    },
    'm-uptime': {
      label: 'Fleet uptime', value: '99.2%', deltaPercent: 0.4, trend: 'up',
      values: [98.4, 98.7, 98.5, 99.0, 98.9, 99.1, 99.0, 99.3, 99.2],
    },
    'm-patch': {
      label: 'Patch compliance', value: '87%', deltaPercent: 5.6, trend: 'up',
      values: [74, 76, 79, 78, 81, 83, 84, 86, 87],
    },
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

  // Wait for the view's elements to define, then populate.
  await Promise.all([
    customElements.whenDefined('sherpa-app-header'),
    customElements.whenDefined('sherpa-metric'),
    customElements.whenDefined('sherpa-barchart'),
    customElements.whenDefined('sherpa-donut-chart'),
    customElements.whenDefined('sherpa-gauge-chart'),
    customElements.whenDefined('sherpa-line-chart'),
    customElements.whenDefined('sherpa-chart-legend'),
    customElements.whenDefined('sherpa-container-header'),
    customElements.whenDefined('sherpa-key-value-list'),
  ]);

  const $ = (sel) => root.querySelector(sel);

  // Shared header — it lives in index.html, not in this view's root.
  const header = document.querySelector('sherpa-app-shell sherpa-app-header');
  header?.populate(headerConfig);
  header?.setAttribute('data-notifications', '4');

  // No status here: the metric derives it from its own trend, and a hand-set
  // one could disagree with the data.
  for (const [id, data] of Object.entries(metrics)) {
    root.querySelector(`#${id}`)?.populate(data);
  }

  // ONE SOURCE, EIGHT BOUND COMPONENTS: a filter set once fans out to every
  // visualisation. Each chart is a different summary of the same records,
  // computed by its own `as` adapter. Every bind is readonly — a chart shows
  // the data, only the header's toolbar steers it.
  const source = new DataSource({ store: new ArrayStore(alerts(), { key: 'id' }) });

  // Two lifetimes, two AbortControllers. `page` lasts while this view is
  // mounted; `content` is shorter, because a view's own elements are replaced
  // and a source pushing into a detached element leaks.
  const page = new AbortController();
  let content = new AbortController();

  const show = (sel, as) => {
    const el = $(sel);
    if (el) source.bind(el, { readonly: true, as, signal: page.signal });
  };
  const bindContent = (el, as) => {
    if (el) source.bind(el, { readonly: true, as, signal: content.signal });
  };
  const dropContentBinds = () => {
    content.abort();
    content = new AbortController();
  };

  // A chart and its legend share ONE array — a legend row is a chart datum.
  // Sharing also keeps the source's skip-if-unchanged guard, which compares
  // by identity.
  const byCategory = (rows) => countBy(rows, 'category', { order: CATEGORY_ORDER });
  const byOs = (rows) => countBy(rows, 'os', { order: OS_ORDER });

  show('#bar', byCategory);
  show('#bar-legend', byCategory);
  show('#donut', byOs);
  show('#donut-legend', byOs);

  // The gauge reads one number, unrounded — rounding is presentation.
  // TRAP T-an-aggregate-returns-the-number.
  show('#gauge', (rows) => reduceRows(rows, 'mean', 'storage'));
  // The gauge legend names THRESHOLD ZONES. No colour indices: a zone's colour
  // is a status, not a categorical series hue.
  $('#gauge-legend')?.populate([
    { label: 'Healthy (0–60%)', status: 'success' },
    { label: 'Warning (60–85%)', status: 'warning' },
    { label: 'Critical (85–100%)', status: 'critical' },
  ]);
  // Two series from the same rows, split on severity; both re-count on filter.
  show('#line', (rows) => ({
    labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun', 'Mon'],
    series: [
      seriesBy(rows.filter((r) => r.severity !== 'critical'), 'day', DAY_ORDER,
        'Sessions', { colorIndex: 1 }),
      seriesBy(rows.filter((r) => r.severity === 'critical'), 'day', DAY_ORDER,
        'Incidents', { colorIndex: 2 }),
    ],
  }));
  show('#line-legend', () => [
    { label: 'Sessions', colorIndex: 1 },
    { label: 'Incidents', colorIndex: 2 },
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

  // ── Legends toggle their chart ──────────────────────────────────────
  // A legend does not know what it labels, so the page joins them up. Hiding
  // RE-RENDERS, because both charts derive their scale from visible data.
  // `indices`, not `index`: a legend rolls its tail into one "Other" row, so
  // one row can stand for several series.
  $('#donut-legend')?.addEventListener('legend-item-click', (e) => {
    for (const i of e.detail.indices) $('#donut')?.setSliceHidden(i, !e.detail.active);
  });
  $('#line-legend')?.addEventListener('legend-item-click', (e) => {
    for (const i of e.detail.indices) $('#line')?.setSeriesHidden(i, !e.detail.active);
  });
  $('#bar-legend')?.addEventListener('legend-item-click', (e) => {
    for (const i of e.detail.indices) $('#bar')?.setBarHidden(i, !e.detail.active);
  });
  // The legend reports BOTH lists, so there is nothing to diff here.
  $('#bar-legend')?.addEventListener('legend-breakdown-change', (e) => {
    for (const i of e.detail.active) $('#bar')?.setBarHidden(i, false);
    for (const i of e.detail.hidden) $('#bar')?.setBarHidden(i, true);
  });
  // The gauge legend is a KEY, not a filter — a gauge shows one value.

  // A little interactivity so the demo is live.
  $('#bar')?.addEventListener('bar-click', (e) => {
    console.log('bar-click', e.detail);
  });

  // ── The VIEW toolbar: picking a saved view ─────────────────────────────
  // `onViewPicked` reads the View chip's id and applies that snapshot; the
  // records page makes the same call. One write re-summarises all eight
  // components, and the header's chips move from the SAME definition.
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

  // SAVE THIS VIEW. `captureView` reads state back through the same API a
  // definition writes it through. The `reads` map names which properties are
  // view state — the header's chips are, a scroll position is not.
  header?.addEventListener('view-save', () => {
    const label = prompt('Name this view');
    if (!label) return;
    views = {
      ...views,
      ...saveViewAs('dashboard', label, { source, elements: { header } }, {
        header: ['values'],
      }),
    };
    // The chip should now read the view just saved.
    const id = label.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    // RE-POPULATE, THEN PUT THE CHIPS BACK: `populate` rebuilds the bar from
    // the defs, wiping what the reader just picked. Read before, write after.
    const picked = header.values;
    // Await populate(), NOT `rendered` — `rendered` resolved when the header
    // first drew, so a restore hung off it runs before the rebuilt chips exist.
    void Promise.resolve(
      header.populate({ ...headerConfig, filters: globalFilters(viewOptions(views, id), undefined, customerOrgs) }),
    ).then(() => { header.values = picked; });
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
