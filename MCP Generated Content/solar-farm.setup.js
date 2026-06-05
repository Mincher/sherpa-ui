// @ts-nocheck
// solar-farm.setup.js — wires real data into the Solar Farm page.
//
// Data shapes follow the ones the MCP server confirmed via query_component:
//   • sherpa-barchart   → setData({ columns, rows })
//   • sherpa-line-chart → setData({ columns, rows })
//   • sherpa-donut-chart→ setData({ columns, rows })
//   • sherpa-gauge-chart→ setSegments([{ value, color }])
//   • sherpa-data-grid  → setData({ columns, rows })
//
// The page does not render its own <sherpa-view-header>. Instead, the
// setup script configures the docs shell's view-header (the one in
// index.html that is a child of <sherpa-layout-grid>) via
// globalThis.docsView.setHeading / setTitleIcon / setActions.

const CAT_VALUE_COLS = [
  { field: 'category', name: 'Category', type: 'string' },
  { field: 'value',    name: 'Value',    type: 'number' },
];
const DATE_VALUE_COLS = [
  { field: 'date',  name: 'Time',  type: 'string' },
  { field: 'value', name: 'Value', type: 'number' },
];

// 24 hourly samples of total plant output (MW), with a midday peak and
// the typical afternoon cloud dip.
const HOURS = Array.from({ length: 24 }, (_, h) => {
  const fmt = (h) => `${String(h).padStart(2, '0')}:00`;
  const base = Math.max(0, Math.sin(((h - 6) / 12) * Math.PI));
  const cloudDip = h >= 14 && h <= 16 ? 0.78 : 1;
  return { date: fmt(h), value: Math.round(118 * base * cloudDip) };
});

// Pre-computed for the line chart's direct { labels, series } API.
const LINE_LABELS = HOURS.map(h => h.date);
const LINE_VALUES = HOURS.map(h => h.value);

// Per-array energy production for the day.
const ARRAYS = [
  { category: 'Array A — North',    value: 86.4 },
  { category: 'Array B — North',    value: 82.1 },
  { category: 'Array C — Central',  value: 79.8 },
  { category: 'Array D — Central',  value: 74.3 },
  { category: 'Array E — South',    value: 68.0 },
  { category: 'Array F — South',    value: 64.5 },
  { category: 'Array G — Tracker',  value: 31.1 },
];

// Energy source split for the day.
const MIX = [
  { category: 'PV generation',  value: 486.2 },
  { category: 'Battery export', value:  38.4 },
  { category: 'Grid import',    value:   0.0 },
  { category: 'Site load',      value: -22.8 },
];

// 5-row alarms feed.
const ALARMS_COLS = [
  { field: 'id',        name: 'ID',        type: 'string' },
  { field: 'severity',  name: 'Severity',  type: 'string' },
  { field: 'device',    name: 'Device',    type: 'string' },
  { field: 'message',   name: 'Message',   type: 'string' },
  { field: 'opened',    name: 'Opened',    type: 'string' },
];
const ALARMS_ROWS = [
  { id: 'A-2419', severity: 'critical', device: 'INV-04B',     message: 'String fuse blown on combiner 3',     opened: '08:42' },
  { id: 'A-2420', severity: 'warning',  device: 'Array C',     message: 'PR below 78% threshold for 30 min',   opened: '09:11' },
  { id: 'A-2421', severity: 'info',     device: 'Weather',     message: 'Cloud cover forecast 60% at 14:00',   opened: '09:18' },
  { id: 'A-2422', severity: 'warning',  device: 'Tracker-G7',  message: 'Backtracking active — wind > 12 m/s', opened: '09:34' },
  { id: 'A-2423', severity: 'info',     device: 'INV-12A',     message: 'Night-mode cool-down started',         opened: '09:55' },
];

const q = (root, sel) => root.querySelector(sel);

export default {
  'solar-farm-page': async (outlet) => {
    // Configure the docs shell's view-header — this is the only view-header
    // on the page. The router's default for mcp-demo pages set the page
    // group label; we override it with the specific site, plus the icon
    // and the page-specific action buttons.
    const view = globalThis.docsView;
    view.setHeading('Mojave Array — Site 04', [
      { label: 'Operations',   href: '#/' },
      { label: 'Solar Farms',  href: '#/' },
      { label: 'Mojave 04' },
    ]);
    view.setTitleIcon('<span class="fa-solid fa-solar-panel sherpa-icon" aria-hidden="true"></span>');
    view.setActions(`
      <sherpa-button data-variant="secondary" data-size="small"
        data-icon-start="fa-solid fa-arrow-up-right-from-square"
        data-label="Open in SCADA"></sherpa-button>
      <sherpa-button data-variant="primary" data-size="small"
        data-icon-start="fa-solid fa-file-export"
        data-label="Export shift report"></sherpa-button>
    `);

    // Wait for any sherpa components to finish rendering before setData().
    const elems = outlet.querySelectorAll('*');
    await Promise.all(
      [...elems]
        .filter(el => el.tagName?.startsWith('SHERPA-') && el.rendered)
        .map(el => el.rendered)
    );

    q(outlet, 'sherpa-line-chart')?.setData?.({ labels: LINE_LABELS, series: [{ name: 'Output (MW)', values: LINE_VALUES }] });
    q(outlet, 'sherpa-barchart')?.setData?.({ columns: CAT_VALUE_COLS, rows: ARRAYS });
    q(outlet, 'sherpa-donut-chart')?.setData?.({ columns: CAT_VALUE_COLS, rows: MIX });
    q(outlet, 'sherpa-gauge-chart')?.setSegments?.([
      { value: 86.7, color: 'var(--sherpa-surface-context-warning-strong-default)' },
      { value: 13.3, color: 'var(--sherpa-surface-container-default, #eee)' },
    ]);
    q(outlet, 'sherpa-data-grid')?.setData?.({ columns: ALARMS_COLS, rows: ALARMS_ROWS });
  },
};
