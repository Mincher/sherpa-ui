/**
 * examples/views/dashboard.js — the dashboard view's logic.
 *
 * Exported as init(root): populates the metric tiles + charts + summary that
 * live inside `root` (the app-shell content region the router injected into).
 * The shared nav/header live once in index.html; this view only touches its
 * own content + wires a couple of demo listeners. Behaviour is identical to
 * the old standalone dashboard.html.
 */
import { ArrayStore, DataSource, applyViewSnapshot } from '../../dist/index.js';
import { globalFilters } from './global-filters.js';
import { DASHBOARD_VIEWS, DASHBOARD_VIEW_OPTIONS } from './dashboard-views.js';
import {
  alerts, countBy, seriesByDay, meanOf, CATEGORY_ORDER, OS_ORDER,
} from './dashboard-data.js';

export async function init(root) {
  // ── Header config: breadcrumb trail + a couple of quick filters. ──────
  const headerConfig = {
    /* NO BREADCRUMB. This view IS home — the Home nav item opens it — so a trail
       would have to start and end in the same place ("Home > Dashboard" named
       one page twice). A crumb trail says how you got somewhere; at the root
       there is no path to show. The view's own name is on the heading. */
    breadcrumb: [],
    // The header's toolbar is the VIEW-level one (data-type="view" in
    // index.html), so it carries SAVED VIEWS — the preset arrangements of this
    // page — not the data filters that narrow what a chart shows.
    //
    // That split is the whole point of the two toolbars: a VIEW is a saved
    // arrangement ("Critical only", "EMEA operations"), which is why this bar
    // and not the data bar carries Save and favourite. Picking one re-applies
    // every setting it remembers. Data filters live with the data they filter.
    //
    // ONE chip, single-select: you are looking at exactly one view at a time.
    // THE GLOBAL FILTERS — View, Customer, Region and Date range. They sit
    // above every page and trickle DOWN: whatever they narrow to is the
    // population this dashboard's charts then work within. See global-filters.js.
    // The options come FROM the views, so a label cannot drift from the view
    // it names — the list and the definitions are one source.
    filters: globalFilters(DASHBOARD_VIEW_OPTIONS),
  };

  // ── Metric tiles (with sparkline series). ───────────────────────────
  const metrics = {
    'm-endpoints': {
      name: 'Active endpoints', value: '1,284', deltaPercent: 3.1, trend: 'up',
      values: [1180, 1195, 1210, 1188, 1230, 1255, 1249, 1270, 1284],
    },
    'm-alerts': {
      name: 'Open alerts', value: '37', deltaPercent: -12.5, trend: 'down',
      values: [61, 58, 54, 49, 52, 45, 41, 39, 37],
    },
    'm-uptime': {
      name: 'Fleet uptime', value: '99.2%', deltaPercent: 0.4, trend: 'up',
      values: [98.4, 98.7, 98.5, 99.0, 98.9, 99.1, 99.0, 99.3, 99.2],
    },
    'm-patch': {
      name: 'Patch compliance', value: '87%', deltaPercent: 5.6, trend: 'up',
      values: [74, 76, 79, 78, 81, 83, 84, 86, 87],
    },
  };




  // ── Summary key/value stats. ────────────────────────────────────────
  const summary = [
    { key: 'Sites monitored', value: '42' },
    { key: 'Devices online',  value: '1,238 / 1,284' },
    { key: 'Mean response',   value: '142 ms' },
    { key: 'Tickets today',   value: '19' },
    { key: 'Automations run', value: '3,472' },
    { key: 'Last sync',       value: '2 min ago' },
  ];

  // ── Wait for the view's elements to define, then populate. ──────────
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

  // Shared header (lives in index.html). Set a dashboard breadcrumb + filters.
  const header = document.querySelector('sherpa-app-shell sherpa-app-header');
  header?.populate(headerConfig);
  header?.setAttribute('data-notifications', '4');

  // Metric tiles.
  // Status is NOT set here: the metric derives it from its own trend (up →
  // success, down → critical, flat → none), so a hand-set status would duplicate
  // what the data already says and the two could disagree.
  for (const [id, data] of Object.entries(metrics)) {
    root.querySelector(`#${id}`)?.populate(data);
  }

  /* ── ONE SOURCE, EIGHT BOUND COMPONENTS ─────────────────────────────

     The capability this whole layer exists for: a filter set ONCE fans out to
     every visualisation on the page.

     It used to be eight hand-written `populate()` calls over pre-aggregated
     arrays — eight bars, five slices, a gauge reading 70 — none of which any
     filter could touch, because the totals WERE the data. Now the records are
     the data and every chart is a different SUMMARY of them, computed by its
     own `as` adapter.

     Each bind is readonly: a chart shows the data, it does not steer it. Only
     the header's toolbar does that. */
  const source = new DataSource({ store: new ArrayStore(alerts(), { key: 'id' }) });
  const unbinds = [];
  const show = (sel, as) => {
    const el = $(sel);
    if (el) unbinds.push(source.bind(el, { readonly: true, as }));
  };

  /* A chart and its legend take the SAME ARRAY — a legend row IS a chart datum
     (see core/chart-datum.ts), so there is nothing to reshape between them.
     Sharing it also lets the source's skip-if-unchanged guard hold, since it
     compares by identity and a rebuilt array never matches. */
  const byCategory = (rows) => countBy(rows, 'category', CATEGORY_ORDER);
  const byOs = (rows) => countBy(rows, 'os', OS_ORDER);

  show('#bar', byCategory);
  show('#bar-legend', byCategory);
  show('#donut', byOs);
  show('#donut-legend', byOs);

  // The gauge reads one NUMBER — the mean storage across whatever survived the
  // filter. An aggregate is still just an adapter.
  show('#gauge', (rows) => meanOf(rows, 'storage'));
  // …and the gauge's names its THRESHOLD ZONES, which are what its bands mean.
  // The colour indices are deliberately absent: a zone's colour is a STATUS
  // (success / warning / critical), not a categorical series hue.
  $('#gauge-legend')?.populate([
    { label: 'Healthy (0–60%)', status: 'success' },
    { label: 'Warning (60–85%)', status: 'warning' },
    { label: 'Critical (85–100%)', status: 'critical' },
  ]);
  /* TWO SERIES from the SAME rows, split on severity — the case that shows an
     adapter doing real work rather than passing a payload through. Both series
     re-count when the filter changes, so the line moves with everything else. */
  show('#line', (rows) => ({
    labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun', 'Mon'],
    series: [
      seriesByDay(rows.filter((r) => r.severity !== 'critical'), 'Sessions', 1),
      seriesByDay(rows.filter((r) => r.severity === 'critical'), 'Incidents', 2),
    ],
  }));
  show('#line-legend', () => [
    { label: 'Sessions', colorIndex: 1 },
    { label: 'Incidents', colorIndex: 2 },
  ]);
  $('#kv')?.populate(summary);

  // ── Legends toggle their chart ──────────────────────────────────────
  // A legend does not know what it labels, so the page joins them up: the legend
  // reports which row was toggled, and the chart is told to hide that series.
  // Hiding RE-RENDERS the chart (rather than just dimming the row) because both
  // charts derive their scale from the visible data — the line's y-axis and the
  // donut's shares would otherwise be computed from series nobody can see.
  // `indices`, not `index`: a legend caps at six rows and rolls the tail into an
  // "Other" row, so one row can stand for several series. Toggling by index alone
  // would hide one of them and leave the rest drawn under a row that says off.
  $('#donut-legend')?.addEventListener('legend-item-click', (e) => {
    for (const i of e.detail.indices) $('#donut')?.setSliceHidden(i, !e.detail.active);
  });
  $('#line-legend')?.addEventListener('legend-item-click', (e) => {
    for (const i of e.detail.indices) $('#line')?.setSeriesHidden(i, !e.detail.active);
  });
  $('#bar-legend')?.addEventListener('legend-item-click', (e) => {
    for (const i of e.detail.indices) $('#bar')?.setBarHidden(i, !e.detail.active);
  });
  // The "Other" row's breakdown menu: apply the edited set in one pass. The
  // legend reports BOTH lists, so there is nothing to diff here.
  $('#bar-legend')?.addEventListener('legend-breakdown-change', (e) => {
    for (const i of e.detail.active) $('#bar')?.setBarHidden(i, false);
    for (const i of e.detail.hidden) $('#bar')?.setBarHidden(i, true);
  });
  // The gauge legend is a KEY, not a filter: its rows name thresholds, and there
  // is nothing to hide — a gauge shows one value, and dropping a zone would
  // change what the reading means rather than what is displayed.

  // ── A little interactivity so the demo is live. ─────────────────────
  // Bar clicks log to the console (bar-click is the barchart's event).
  $('#bar')?.addEventListener('bar-click', (e) => {
    console.log('bar-click', e.detail);
  });

  // ── The VIEW toolbar: picking a saved view ─────────────────────────────
  // The header's toolbar is data-type="view", so a change here means "show me a
  // different saved arrangement" — not "filter the data".
  //
  // ONE CALL. `applyViewSnapshot` is the same function the records page uses,
  // reading the same `ViewSnapshot` shape, because a saved view is one idea and
  // deserves one implementation. It sets the SOURCE first — so the rows are on
  // their way before anything reads them — then each named element through its
  // own public API.
  //
  // This page used to hand-apply a `{ filter, chips }` object of its own. It
  // said the same things in a vocabulary only this file knew, so a deep link, a
  // stored view or an agent could not have expressed one.
  header?.addEventListener('quick-filter-change', (e) => {
    const picked = e.detail.values?.view?.[0];
    if (!picked) return;
    const view = DASHBOARD_VIEWS[picked];
    if (!view) return;

    /* ONE WRITE, EIGHT COMPONENTS. Picking a view narrows the records, and
       every chart re-summarises what is left: the bars, the donut, the gauge's
       mean, both line series and the two legends. The header's chips move with
       them, from the SAME definition, so the bar cannot claim the data is
       unfiltered while the charts disagree.

       Setting the chips fires no event, so this does not come back round as a
       second filter. */
    const report = applyViewSnapshot(view.snapshot, { source, elements: { header } });

    /* A saved view OUTLIVES its code. A renamed component or a dropped method
       is reported, not thrown — the rest of the view still applies, and the app
       gets to say what it could not restore rather than leave the reader
       guessing. The demo logs it; a product would tell someone. */
    if (report.missingElements.length || Object.keys(report.skipped).length) {
      console.warn('view applied with gaps', report);
    }
  });

  // The cluster's own actions, for the example's sake.
  header?.addEventListener('view-save', () => console.log('view-save'));
  header?.addEventListener('view-favorite', (e) => console.log('view-favorite', e.detail));
  header?.addEventListener('data-refresh', () => console.log('data-refresh'));

  await source.load();

  /* The router calls whatever init() returns when it swaps away. Without this
     the source keeps pushing into eight components that have left the DOM. */
  return () => {
    for (const off of unbinds) off();
  };
}
