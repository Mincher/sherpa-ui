# Data Grid Configuration Reference

## setColumnConfig(config)

Call **before** `setData()` to override inferred column rendering. Only include fields that need non-default types.

```js
grid.setColumnConfig({
  fieldName: {
    type?: string,                        // Override rendered type
    statusMap?: Record<string, string>,   // Maps raw values → sherpa status names
  }
});
```

### Column Types

| Type | Rendered as | Notes |
|------|------------|-------|
| `string` (default) | Plain text | Used when type is omitted |
| `number` | Right-aligned number | Aliases: `int`, `integer`, `float`, `decimal` |
| `currency` | Formatted currency value | e.g. `$1,234.56` |
| `percent` | Right-aligned + `%` suffix | |
| `boolean` | Icon (checkmark / empty) | |
| `date` | Formatted date | ISO 8601 string input |
| `datetime` | Formatted date + time | Alias: `timestamp` |
| `status` | Coloured status badge | Requires `statusMap` |
| `link` | Clickable anchor | Field value used as `href` |
| `year` | 4-digit year | |

### statusMap Example

Maps raw field values to Sherpa status identifier strings (`critical`, `warning`, `success`, `info`, `urgent`):

```js
grid.setColumnConfig({
  severity: {
    type: 'status',
    statusMap: {
      critical: 'critical',
      high:     'critical',
      medium:   'warning',
      low:      'info',
      resolved: 'success',
    },
  },
  health: {
    type: 'status',
    statusMap: {
      healthy:   'success',
      degraded:  'warning',
      unhealthy: 'critical',
      unknown:   'info',
    },
  },
});
```

---

## setData(config)

```js
grid.setData({
  columns: [
    { field: string, label: string },
    // Additional column options:
    { field: string, label: string, width?: number, sortable?: boolean, hidden?: boolean },
  ],
  rows: Array<Record<string, any>>,   // Each row is a plain object

  // Optional
  orderBy?: string,                   // Default sort field
  orderDirection?: 'asc' | 'desc',    // Default: 'asc'
  segmentBy?: string,                 // Group rows by this field
  segmentMode?: 'expanded' | 'collapsed',  // Default group state
});
```

---

## setActionMenuItems(sections)

Sets the ⋯ row-level actions menu. Call after `setData()`.

```js
grid.setActionMenuItems([
  {
    label: 'Actions',         // Optional section header
    items: [
      { value: 'edit',   label: 'Edit',   icon: '&#xf044;' },
      { value: 'clone',  label: 'Clone',  icon: '&#xf0c5;' },
      { value: 'view',   label: 'View',   icon: '&#xf06e;' },
      // Destructive actions: use status: 'critical'
      { value: 'delete', label: 'Delete', icon: '&#xf2ed;', status: 'critical' },
    ],
  },
  // Second section (optional separator)
  {
    label: 'More',
    items: [
      { value: 'export', label: 'Export as CSV', icon: '&#xf56e;' },
    ],
  },
]);
```

---

## row-action Event

```js
grid.addEventListener('row-action', (e) => {
  const {
    action:       string,    // The item `value` that was clicked
    rowData:      Object,    // Full data object for that row
    selectedRows: string[],  // Currently selected row IDs (when data-selectable)
  } = e.detail;

  if (action === 'edit')   flow.startEdit(rowData);
  if (action === 'delete') flow.startDelete([rowData.id], `Delete "${rowData.name}"?`);
});
```

---

## Key Attributes

| Attribute | Type | Default | Notes |
|-----------|------|---------|-------|
| `data-show-pagination` | boolean | — | Shows pagination footer |
| `data-selectable` | boolean | — | Row checkboxes for bulk selection |
| `data-loading` | boolean | — | Loading overlay |
| `data-segment-field` | string | — | Groups rows by field value |
| `data-segment-mode` | `expanded\|collapsed` | `expanded` | Default group open/closed |
| `data-sort-field` | string | — | Initial sort column |
| `data-sort-direction` | `asc\|desc` | `asc` | Initial sort direction |
| `data-page` | number | `1` | Current page |
| `data-page-size` | number | `25` | Rows per page |
| `data-show-actions` | boolean | — | Shows bulk Actions menu (requires `data-selectable`) |
| `data-show-secondary-headers` | boolean | — | Shows sub-header row |
| `data-preset-filters` | JSON string | — | Array of preset filter configs |

---

## Toolbar Slots

| Slot | Content |
|------|---------|
| `toolbar-leading` | Primary action (e.g. Add button) — placed at the start of the toolbar |

The built-in toolbar also automatically includes: global search field, column-select menu, export button, and overflow actions menu.

```html
<sherpa-data-grid data-show-pagination data-selectable data-show-actions>
  <sherpa-button slot="toolbar-leading"
                 data-label="Add" data-variant="primary"
                 data-icon-start="&#xf067;"></sherpa-button>
</sherpa-data-grid>
```
