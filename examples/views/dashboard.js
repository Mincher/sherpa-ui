/**
 * examples/views/dashboard.js — the dashboard view's logic.
 *
 * Exported as init(root): populates the metric tiles + charts + summary that
 * live inside `root` (the app-shell content region the router injected into).
 * The shared nav/header live once in index.html; this view only touches its
 * own content + wires a couple of demo listeners. Behaviour is identical to
 * the old standalone dashboard.html.
 */
import {
  ArrayStore, DataSource, viewOptions, onViewPicked,
  loadSavedViews, saveViewAs,
} from '../../dist/index.js';
import { globalFilters } from './global-filters.js';
import { DASHBOARD_VIEWS } from './dashboard-views.js';
import {
  alerts, countBy, seriesByDay, meanOf, CATEGORY_ORDER, OS_ORDER,
} from './dashboard-data.js';

export async function init(root) {
  /* THE LIBRARY = presets + whatever this reader saved.
     One object, because a saved view and a preset are the same shape and the
     chip should not care which is which. The presets come first so a reader's
     own views read as additions to them. */
  let views = { ...DASHBOARD_VIEWS, ...loadSavedViews('dashboard') };

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
    filters: globalFilters(viewOptions(views)),
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
  // ONE LINE, because picking a saved view is not this page's idea. `onViewPicked`
  // reads the View chip's id, applies that `ViewSnapshot`, and reports what a
  // stale definition could not restore. The records page makes the same call.
  //
  // ONE WRITE, EIGHT COMPONENTS: the snapshot narrows the records and every
  // chart re-summarises what is left — bars, donut, the gauge's mean, both line
  // series and the two legends — while the header's chips move from the SAME
  // definition, so the bar cannot claim the data is unfiltered while the charts
  // disagree.
  // A FUNCTION, not the object: the library grows when the reader saves a view,
  // and a listener holding the set it was wired with would never see one.
  unbinds.push(onViewPicked(header, () => views, { source, elements: { header } }));

  /* SAVE THIS VIEW. The button was wired to console.log — a control that
     promises something and does nothing.

     `captureView` reads the state back through the same API a definition
     writes it through, so what is saved is exactly what can be restored. The
     `reads` map names WHICH properties are view state: the header's chips are,
     a scroll position is not, and only this page knows the difference.

     The new view goes into the library and the chip is re-populated in the
     same breath — a saved view nobody can pick is not saved. */
  header?.addEventListener('view-save', () => {
    const label = prompt('Name this view');
    if (!label) return;
    views = {
      ...views,
      ...saveViewAs('dashboard', label, { source, elements: { header } }, {
        header: ['values'],
      }),
    };
    // The chip should now READ the view just saved — a reader who names what
    // they are looking at is still looking at it.
    const id = label.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    /* RE-POPULATE, THEN PUT THE CHIPS BACK. `populate` rebuilds the bar from
       the defs, so every chip returns to its declared state — which wipes what
       the reader had just picked and named. Saving a view must not change the
       view.

       Read BEFORE the rebuild and written after, through the same `values` API
       a definition uses. The capture itself was already correct; this is the
       demo putting the screen back the way it found it. */
    const picked = header.values;
    /* AWAIT populate(), not `rendered`. `rendered` resolved when the header
       first drew — long ago — so a restore hung off it ran BEFORE the rebuilt
       chips existed and wrote into nothing. populate()'s own promise settles
       once the data is in the DOM, which is what a caller reading back its own
       write has to wait for. The base class says so; I used the wrong one. */
    void Promise.resolve(
      header.populate({ ...headerConfig, filters: globalFilters(viewOptions(views, id)) }),
    ).then(() => { header.values = picked; });
  });
  header?.addEventListener('view-favorite', (e) => console.log('view-favorite', e.detail));
  header?.addEventListener('data-refresh', () => console.log('data-refresh'));

  await source.load();

  /* The router calls whatever init() returns when it swaps away. Without this
     the source keeps pushing into eight components that have left the DOM. */
  return () => {
    for (const off of unbinds) off();
  };
}
