/**
 * The dashboard Context. init(root) populates the metric tiles, charts and
 * summary inside `root`; the nav and header live once in index.html.
 */
import {
  ArrayStore, DataSource, viewOptions, onViewPicked,
  loadSavedViews, saveViewAs,
  // Aggregation lives in the data layer, not here. TRAP T-aggregation-is-data.
  countBy, bandBy, seriesBy, reduceRows, deltaPercent, bindSelection,
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

  // ONE SOURCE, EIGHT BOUND COMPONENTS: a filter set once fans out to every
  // visualisation. Each chart is a different summary of the same records,
  // computed by its own `as` adapter. Every bind is readonly — a chart shows
  // the data, only the header's toolbar steers it.
  const source = new DataSource({ store: new ArrayStore(alerts(), { key: 'id' }) });

  // Two lifetimes, two AbortControllers. `page` lasts while this Context is
  // mounted; `content` is shorter, because a Context's own elements are replaced
  // and a source pushing into a detached element leaks.
  const page = new AbortController();
  let content = new AbortController();

  /* Every one of these is a SUMMARY, so `rows: 'all'`: the default bind hands
     over the page, and this source declares no pageSize only by luck — one day
     it will, and a chart counting a window looks perfectly reasonable.
     TRAP T-a-summary-binds-to-all-the-rows */
  const show = (sel, as) => {
    const el = $(sel);
    if (el) source.bind(el, { readonly: true, rows: 'all', as, signal: page.signal });
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

  /* METRIC TILES, derived. They used to be a hardcoded table populated before
     the source even existed, so a filter never touched them. Each is now the
     same rows reduced a different way, and the sparkline is a real series over
     the day field rather than a drawn squiggle. */
  /* `deltaPercent` from the series the tile already draws. A tile handed only
     a label and a value is GREY: it derives its trend from the delta and its
     status from the trend, so without one there is nothing to colour.
     TRAP T-a-delta-is-derived-not-declared */
  const tile = (label, value, values) => ({
    label, value, values, deltaPercent: deltaPercent(values) ?? undefined,
  });

  show('#m-endpoints', (rows) =>
    tile('Alerts', rows.length, seriesBy(rows, 'day', DAY_ORDER, 'Alerts').values));
  show('#m-alerts', (rows) => {
    const critical = rows.filter((r) => r.severity === 'critical');
    return tile('Critical', critical.length,
      seriesBy(critical, 'day', DAY_ORDER, 'Critical').values);
  });
  show('#m-uptime', (rows) =>
    tile('Mean storage', `${Math.round(reduceRows(rows, 'mean', 'storage'))}%`,
      DAY_ORDER.map((d) =>
        Math.round(reduceRows(rows.filter((r) => r.day === d), 'mean', 'storage')))));
  show('#m-patch', (rows) =>
    tile('Categories', countBy(rows, 'category').length,
      countBy(rows, 'category', { order: CATEGORY_ORDER }).map((d) => d.value)));

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

  /* ── Legends are FILTERS ─────────────────────────────────────────────
     These used to call setBarHidden() / setSliceHidden(): the bar vanished
     from that ONE chart and nothing else on the page knew, so the tiles and
     the other charts kept counting rows the reader had just excluded.

     Each legend writes the SELECTION of the field its labels are values of,
     so every bound component re-reads together.
     TRAP T-a-legend-toggle-is-a-filter */
  /* `bindSelection` is the SAME loop a chip or a column heading uses — legend
     filtering is just filtering, and a legend's visible state is its own. */
  const bindLegend = (el, field, values) => el && bindSelection(el, source, {
    field,
    values,
    // Read the LEGEND, not the event: a roll-up row stands for several values.
    read: (l) => values.filter((v) => !l.off.includes(v)),
    draw: (l, picked) => {
      l.off = picked.length ? values.filter((v) => !picked.includes(v)) : [];
    },
    event: 'legend-item-click',
    /* COMPONENT reach: a series switched off filters THIS chart and nothing
       else — not the grid, not a sibling chart. It is still subject to the
       View filter, which does cascade down.
       TRAP T-a-filter-applies-down-its-scope */
    reach: 'component',
    // One part per legend, or the second would replace the first.
    key: `legend:${el.id || field}`,
    signal: page.signal,
  });
  bindLegend($('#bar-legend'), 'category', CATEGORY_ORDER);
  bindLegend($('#donut-legend'), 'os', OS_ORDER);
  /* The LINE legend names two SERIES, not values of one field — "Sessions" is
     every non-critical row. So it stays a per-chart hide: there is no single
     field whose values those labels are, and inventing one would be a lie.
     TRAP T-a-legend-toggle-is-a-filter */
  $('#line-legend')?.addEventListener('legend-item-click', (e) => {
    for (const i of e.detail.indices) $('#line')?.setSeriesHidden(i, !e.detail.active);
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
    const id = label.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    // The saved view names ITSELF in the View chip, or picking it shows the one it was saved from.
    const picked = { ...header.values, view: [id] };
    views = {
      ...views,
      ...saveViewAs('dashboard', label, { source, elements: { header: { values: picked } } }, {
        header: ['values'],
      }),
    };
    // RE-POPULATE, THEN PUT THE CHIPS BACK: `populate` rebuilds the bar from
    // the defs, wiping what the reader just picked. Read before, write after.
    // Await populate(), NOT `rendered` — `rendered` resolved when the header
    // first drew, so a restore hung off it runs before the rebuilt chips exist.
    void Promise.resolve(
      header.populate({ ...headerConfig, filters: globalFilters(viewOptions(views, id), undefined, customerOrgs) }),
    ).then(() => {
      header.values = picked;
      // Reported, so the URL and the nav follow the view just saved.
      header.querySelector('sherpa-quick-filter-toolbar')?.report();
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
