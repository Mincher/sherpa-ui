---
name: compose-data-view
description: 'Compose data-heavy views in Sherpa UI. Use when: adding a data grid or table; setting up column configuration with setColumnConfig and setData; configuring row actions; composing filter-bar for search and filtering; building a dashboard with charts (bar chart, line chart, donut chart, gauge chart, sparkline); setting up pagination; configuring toolbar with search and export; handling sort-change, page-change, or row-action events.'
---

# Compose Data View

## When to Use
- Building a list or table page with `sherpa-data-grid`
- Adding charts to a dashboard (bar, line, donut, gauge, sparkline)
- Wiring filter-bar, global search, column-select, pagination
- Handling sort, filter, page-change, and row-action events

## Starting Patterns (MCP)
```
get_pattern({ id: "list-view" })       ← filterable table + pagination
get_pattern({ id: "dashboard-grid" })  ← metric cards + charts + grid
get_pattern({ id: "view-with-rails" }) ← sticky side panel + scrollable grid
```

---

## Data Grid Setup

### Minimal Setup
```html
<sherpa-data-grid id="grid" data-show-pagination></sherpa-data-grid>
```

```js
const grid = document.getElementById('grid');

// 1. Set column config BEFORE setData() — overrides type inference
grid.setColumnConfig({
  status:   { type: 'status', statusMap: { active: 'success', inactive: 'critical', pending: 'warning' } },
  risk:     { type: 'status', statusMap: { high: 'critical', medium: 'warning', low: 'success' } },
  profileUrl: { type: 'link' },
  count:    { type: 'number' },
  verified: { type: 'boolean' },
  price:    { type: 'currency' },
  joinedAt: { type: 'date' },
});

// 2. Set data
grid.setData({
  columns: [
    { field: 'name',     label: 'Name' },
    { field: 'status',   label: 'Status' },
    { field: 'count',    label: 'Count' },
    { field: 'verified', label: 'Verified' },
    { field: 'joinedAt', label: 'Joined' },
  ],
  rows: [
    { name: 'Device A', status: 'active',   count: 42, verified: true,  joinedAt: '2024-03-15' },
    { name: 'Device B', status: 'pending',  count: 7,  verified: false, joinedAt: '2024-08-01' },
  ],
  orderBy: 'name',
  orderDirection: 'asc',
});
```

### Column Types for `setColumnConfig`

| Type | Rendered as |
|------|------------|
| `string` (default) | Plain text |
| `number` / `int` / `float` / `decimal` | Right-aligned number |
| `currency` | Formatted currency |
| `percent` | Right-aligned + `%` |
| `boolean` | Checkmark / cross icon |
| `date` | Formatted date (ISO input) |
| `datetime` / `timestamp` | Formatted date + time |
| `status` | Coloured badge — requires `statusMap` |
| `link` | Clickable — field value used as href |

### Key Grid Attributes

| Attribute | Type | Notes |
|-----------|------|-------|
| `data-show-pagination` | boolean | Pagination footer |
| `data-selectable` | boolean | Row checkboxes for bulk actions |
| `data-loading` | boolean | Loading overlay |
| `data-segment-field` | string | Group rows by this field |
| `data-segment-mode` | `expanded\|collapsed` | Default group state |
| `data-sort-field` | string | Initial sort column |
| `data-sort-direction` | `asc\|desc` | Initial sort direction |
| `data-page-size` | number | Rows per page (default: 25) |

---

## Row Actions

```js
// Define the ⋯ row menu
grid.setActionMenuItems([
  {
    label: 'Actions',    // Section label (optional)
    items: [
      { value: 'edit',   label: 'Edit',   icon: '&#xf044;' },
      { value: 'clone',  label: 'Clone',  icon: '&#xf0c5;' },
      { value: 'delete', label: 'Delete', icon: '&#xf2ed;', status: 'critical' },
    ],
  },
]);

// Listen for row-action
grid.addEventListener('row-action', (e) => {
  const { action, rowData, selectedRows } = e.detail;
  if (action === 'edit')   flow.startEdit(rowData);
  if (action === 'delete') flow.startDelete([rowData.id]);
});
```

## Toolbar Leading Slot

Inject an Add button (or other primary action) into the built-in grid toolbar:

```html
<sherpa-data-grid data-show-pagination>
  <sherpa-button slot="toolbar-leading"
                 data-label="Add Device" data-variant="primary"
                 data-icon-start="&#xf067;"></sherpa-button>
</sherpa-data-grid>
```

The grid toolbar also includes built-in: global search, column-select menu, export button, and overflow menu.

## Grouping (Segmentation)

```html
<sherpa-data-grid data-segment-field="category"
                  data-segment-mode="collapsed"></sherpa-data-grid>
```

Or via JS:
```js
grid.setData({
  columns: [...],
  rows: [...],
  segmentBy: 'category',
  segmentMode: 'collapsed',
});
```

---

## Chart Selection Guide

| Use case | Component | `setData()` shape |
|----------|-----------|-------------------|
| Category comparisons, stacked bars, time series by category | `sherpa-barchart` | `{ columns: [{field, label, type: 'category'|'value'}], rows: [...] }` |
| Continuous trend over time | `sherpa-line-chart` | `{ columns: [...], rows: [...] }` |
| Part-to-whole distribution | `sherpa-donut-chart` | `{ columns: [...], rows: [...] }` |
| Single KPI with threshold gauge | `sherpa-gauge-chart` | `{ value, min, max, thresholds }` |
| Inline mini-trend in a metric card | `sherpa-sparkline` | `{ rows: [{timestamp, value}] }` |

### Bar Chart Example
```js
const chart = document.querySelector('sherpa-barchart');
chart.setData({
  columns: [
    { field: 'category', label: 'Platform', type: 'category' },
    { field: 'value',    label: 'Devices',  type: 'value' },
  ],
  rows: [
    { category: 'Windows', value: 340 },
    { category: 'macOS',   value: 127 },
    { category: 'Linux',   value: 58  },
  ],
});
```

---

## Dashboard Layout

```html
<sherpa-layout-grid>

  <!-- Metrics row: 4 × col-3 = full width -->
  <sherpa-container data-col-span="3">
    <sherpa-container-header data-title="Total Devices"></sherpa-container-header>
    <sherpa-metric></sherpa-metric>
  </sherpa-container>
  <sherpa-container data-col-span="3">
    <sherpa-container-header data-title="Active"></sherpa-container-header>
    <sherpa-metric></sherpa-metric>
  </sherpa-container>
  <sherpa-container data-col-span="3">
    <sherpa-container-header data-title="Pending"></sherpa-container-header>
    <sherpa-metric></sherpa-metric>
  </sherpa-container>
  <sherpa-container data-col-span="3">
    <sherpa-container-header data-title="Offline"></sherpa-container-header>
    <sherpa-metric></sherpa-metric>
  </sherpa-container>

  <!-- Charts row: two half-width panels -->
  <sherpa-container data-col-span="6" data-row-span="2">
    <sherpa-container-header data-title="Traffic by Platform" data-menu-button="true"></sherpa-container-header>
    <sherpa-barchart></sherpa-barchart>
  </sherpa-container>
  <sherpa-container data-col-span="6" data-row-span="2">
    <sherpa-container-header data-title="Distribution" data-menu-button="true"></sherpa-container-header>
    <sherpa-donut-chart></sherpa-donut-chart>
  </sherpa-container>

  <!-- Full-width detail table -->
  <sherpa-container data-col-span="12" data-row-span="3">
    <sherpa-container-header data-title="All Devices" data-menu-button="true"></sherpa-container-header>
    <sherpa-data-grid data-show-pagination></sherpa-data-grid>
  </sherpa-container>

</sherpa-layout-grid>
```

`data-col-span` options: `3` | `6` | `9` | `12`

---

## Filter Bar

```html
<!-- Above a standalone grid -->
<sherpa-filter-bar></sherpa-filter-bar>
<sherpa-data-grid></sherpa-data-grid>

<!-- App-level (above all views) -->
<sherpa-filter-bar data-global></sherpa-filter-bar>
```

### Preset Filters (declarative)

```html
<sherpa-data-grid
  data-preset-filters='[{"field":"status","label":"Status","values":["active","inactive"]}]'>
</sherpa-data-grid>
```

---

See [references/data-grid-config.md](./references/data-grid-config.md) for the full `setColumnConfig`, `setData`, and `setActionMenuItems` API reference.
