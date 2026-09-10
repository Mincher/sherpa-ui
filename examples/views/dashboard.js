/**
 * examples/views/dashboard.js — the dashboard view's logic.
 *
 * Exported as init(root): populates the metric tiles + charts + summary that
 * live inside `root` (the app-shell content region the router injected into).
 * The shared nav/header live once in index.html; this view only touches its
 * own content + wires a couple of demo listeners. Behaviour is identical to
 * the old standalone dashboard.html.
 */
export async function init(root) {
  // ── Header config: breadcrumb trail + a couple of quick filters. ──────
  const headerConfig = {
    breadcrumb: [
      { label: 'Home', href: '#home' },
      { label: 'Monitoring', href: '#monitoring' },
      { label: 'Dashboard' },
    ],
    // Chips with `options` get a caret and a value menu (a real popover of
    // checkbox/radio rows). Without options a chip is a plain on/off toggle.
    filters: [
      { id: 'all',      label: 'All sites', active: true, count: 42 },
      { id: 'critical', label: 'Critical',  count: 3 },
      { id: 'offline',  label: 'Offline',   count: 8 },
      // MULTI-select: pick any number of regions.
      { id: 'region', label: 'Region', icon: 'fa-solid fa-globe', select: 'multiple', options: [
        { value: 'emea', label: 'EMEA', selected: true },
        { value: 'amer', label: 'Americas' },
        { value: 'apac', label: 'APAC' },
      ] },
      // SINGLE-select: exactly one window at a time (radio rows).
      { id: 'window', label: 'Time window', icon: 'fa-solid fa-clock', select: 'single', options: [
        { value: '1h',  label: 'Last hour' },
        { value: '24h', label: 'Last 24 hours', selected: true },
        { value: '7d',  label: 'Last 7 days' },
      ] },
    ],
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

  // ── Bar chart: 8 alert categories (raw data-viz colours via colorIndex). ──
  const barData = [
    { label: 'Disk',      value: 42, colorIndex: 1 },
    { label: 'CPU',       value: 31, colorIndex: 2 },
    { label: 'Memory',    value: 28, colorIndex: 3 },
    { label: 'Network',   value: 22, colorIndex: 4 },
    { label: 'Security',  value: 19, colorIndex: 5 },
    { label: 'Services',  value: 14, colorIndex: 6 },
    { label: 'Backup',    value: 11, colorIndex: 7 },
    { label: 'Antivirus', value: 8,  colorIndex: 8 },
  ];

  // ── Donut: 5 OS slices. ─────────────────────────────────────────────
  const donutData = [
    { label: 'Windows 11', value: 612, colorIndex: 1 },
    { label: 'Windows 10', value: 388, colorIndex: 2 },
    { label: 'macOS',      value: 174, colorIndex: 3 },
    { label: 'Linux',      value: 84,  colorIndex: 4 },
    { label: 'Other',      value: 26,  colorIndex: 5 },
  ];

  // ── Line chart: 2 series over 8 months. ─────────────────────────────
  const lineData = {
    labels: ['Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep'],
    series: [
      { name: 'Sessions',  values: [820, 932, 901, 934, 1290, 1330, 1220, 1410] },
      { name: 'Incidents', values: [62, 55, 71, 48, 90, 76, 58, 44] },
    ],
  };
  const lineLegend = [
    { label: 'Sessions',  colorIndex: 1 },
    { label: 'Incidents', colorIndex: 2 },
  ];

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
  header?.setAttribute('data-heading', 'Dashboard');
  header?.setAttribute('data-notifications', '4');

  // Metric tiles.
  // Status is NOT set here: the metric derives it from its own trend (up →
  // success, down → critical, flat → none), so a hand-set status would duplicate
  // what the data already says and the two could disagree.
  for (const [id, data] of Object.entries(metrics)) {
    root.querySelector(`#${id}`)?.populate(data);
  }

  // Charts.
  $('#bar')?.populate(barData);
  $('#donut')?.populate(donutData);
  $('#donut-legend')?.populate(
    donutData.map((d) => ({ label: d.label, value: d.value, colorIndex: d.colorIndex })),
  );
  // Every chart gets a legend: a colour is only readable if the reader can name
  // it. The bar chart's legend names its categories…
  $('#bar-legend')?.populate(
    barData.map((d) => ({ label: d.label, value: d.value, colorIndex: d.colorIndex })),
  );
  $('#gauge')?.populate(70);
  // …and the gauge's names its THRESHOLD ZONES, which are what its bands mean.
  // The colour indices are deliberately absent: a zone's colour is a STATUS
  // (success / warning / critical), not a categorical series hue.
  $('#gauge-legend')?.populate([
    { label: 'Healthy (0–60%)', status: 'success' },
    { label: 'Warning (60–85%)', status: 'warning' },
    { label: 'Critical (85–100%)', status: 'critical' },
  ]);
  $('#line')?.populate(lineData);
  $('#line-legend')?.populate(lineLegend);
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

  // Quick-filter changes on the shared header — visible feedback.
  header?.addEventListener('quick-filter-change', (e) => {
    console.log('quick-filter-change', e.detail);
  });
}
