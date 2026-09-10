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
      status: 'success',
      values: [1180, 1195, 1210, 1188, 1230, 1255, 1249, 1270, 1284],
    },
    'm-alerts': {
      // Alerts falling is GOOD, but 37 open is still worth attention.
      name: 'Open alerts', value: '37', deltaPercent: -12.5, trend: 'down',
      status: 'warning',
      values: [61, 58, 54, 49, 52, 45, 41, 39, 37],
    },
    'm-uptime': {
      name: 'Fleet uptime', value: '99.2%', deltaPercent: 0.4, trend: 'up',
      status: 'success',
      values: [98.4, 98.7, 98.5, 99.0, 98.9, 99.1, 99.0, 99.3, 99.2],
    },
    'm-patch': {
      // 87% is climbing but not there yet — an informational reading.
      name: 'Patch compliance', value: '87%', deltaPercent: 5.6, trend: 'up',
      status: 'info',
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
  for (const [id, data] of Object.entries(metrics)) {
    const tile = root.querySelector(`#${id}`);
    // data-status drives the WHOLE tile through the --_status-* cascade: the
    // surface, the delta ink and the embedded sparkline's stroke. Custom
    // properties inherit across the shadow boundary, so setting it here is enough
    // — the sparkline inside needs no wiring of its own.
    if (data.status) tile?.setAttribute('data-status', data.status);
    tile?.populate(data);
  }

  // Charts.
  $('#bar')?.populate(barData);
  $('#donut')?.populate(donutData);
  $('#donut-legend')?.populate(
    donutData.map((d) => ({ label: d.label, value: d.value, colorIndex: d.colorIndex })),
  );
  $('#gauge')?.populate(70);
  $('#line')?.populate(lineData);
  $('#line-legend')?.populate(lineLegend);
  $('#kv')?.populate(summary);

  // ── Legends toggle their chart ──────────────────────────────────────
  // A legend does not know what it labels, so the page joins them up: the legend
  // reports which row was toggled, and the chart is told to hide that series.
  // Hiding RE-RENDERS the chart (rather than just dimming the row) because both
  // charts derive their scale from the visible data — the line's y-axis and the
  // donut's shares would otherwise be computed from series nobody can see.
  $('#donut-legend')?.addEventListener('legend-item-click', (e) => {
    $('#donut')?.setSliceHidden(e.detail.index, !e.detail.active);
  });
  $('#line-legend')?.addEventListener('legend-item-click', (e) => {
    $('#line')?.setSeriesHidden(e.detail.index, !e.detail.active);
  });

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
