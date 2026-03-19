# sherpa-data-grid

> **Category:** data-display · **Base class:** SherpaElement

Advanced data grid with grouping, selection, sorting, and pagination. Extends ContentAttributesMixin(SherpaElement) for data pipeline. Uses native <table> for sticky headers and full-width row backgrounds.

## Templates

Available templates:

- `default`
- `filter-menu`

## Attributes

| Attribute | Type | Description | Default | Values |
| --------- | ---- | ----------- | ------- | ------ |
| `data-loading` | boolean | Show loading state | — | — |
| `data-segment-field` | string | Field used for row grouping | — | — |
| `data-segment-mode` | enum | Segment display mode | — | — |
| `data-sort-field` | string | Currently sorted column field | — | — |
| `data-sort-direction` | enum | asc \| desc | — | `asc`, `desc` |
| `data-page` | number | Current page (1-based) | — | — |
| `data-page-size` | number | Rows per page | — | — |
| `data-selectable` | boolean | Enable row selection | — | — |
| `data-show-actions` | boolean | Show row action column | — | — |
| `data-show-secondary-headers` | boolean | Show secondary column headers | — | — |
| `data-show-pagination` | boolean | Show pagination bar | — | — |

## Slots

| Slot | Description |
| ---- | ----------- |
| `toolbar-leading` | Consumer-provided primary action for toolbar |

Slot usage:

```html
<sherpa-data-grid>
  <div slot="toolbar-leading"><!-- Consumer-provided primary action for toolbar --></div>
</sherpa-data-grid>
```

## Events

### `selectionchange`


**Propagation:** bubbles

**Detail:**

```js
event.detail = {
  selected: string[],
  count: number,
};
```

```js
element.addEventListener("selectionchange", (e) => {
  console.log(e.detail.selected);
});
```

### `sortchange`


**Propagation:** bubbles

**Detail:**

```js
event.detail = {
  field: string,
  direction: "asc" | "desc",
};
```

```js
element.addEventListener("sortchange", (e) => {
  console.log(e.detail.field);
});
```

### `pagechange`


**Propagation:** bubbles

**Detail:**

```js
event.detail = {
  page: number,
  pageSize: number,
};
```

```js
element.addEventListener("pagechange", (e) => {
  console.log(e.detail.page);
});
```

### `groupexpand`


**Propagation:** bubbles

**Detail:**

```js
event.detail = {
  groupValue: string,
  field: string,
};
```

```js
element.addEventListener("groupexpand", (e) => {
  console.log(e.detail.groupValue);
});
```

### `groupcollapse`


**Propagation:** bubbles

**Detail:**

```js
event.detail = {
  groupValue: string,
  field: string,
};
```

```js
element.addEventListener("groupcollapse", (e) => {
  console.log(e.detail.groupValue);
});
```

### `rowaction`


**Propagation:** bubbles

**Detail:**

```js
event.detail = {
  rowId: string,
  rowData: object,
};
```

```js
element.addEventListener("rowaction", (e) => {
  console.log(e.detail.rowId);
});
```

### `gridexport`


**Propagation:** bubbles, composed

**Detail:** none

```js
element.addEventListener("gridexport", (e) => {
  // handle event
});
```

## Methods

| Method | Description |
| ------ | ----------- |
| `setColumnConfig(config)` | Set column type/status map config |
| `setData(config)` | Main data pipeline entry |
| `expandAllGroups()` | Expand all group rows |
| `collapseAllGroups()` | Collapse all group rows |
| `getSelectedRows()` | Returns selected row IDs |
| `getSelectedRowData()` | Returns data for selected rows |
| `clearSelection()` | Clear all selections |
| `getData()` | Returns transferable config |
| `getColumns()` | Returns column definitions |
| `getCompoundQuery()` | Returns { group, sort, filters, columnFilters, globalSearch } |
| `setExternalFilters(f)` | Apply external filters from FilterCoordinator |

### `setColumnConfig(config)`

Set column type/status map config

**Parameters:**

- `config` (`any`) — 

### `setData(config)`

Main data pipeline entry

**Parameters:**

- `config` (`any`) — 

### `setExternalFilters(f)`

Apply external filters from FilterCoordinator

**Parameters:**

- `f` (`any`) — 

## CSS Parts

Style internal elements from outside the shadow DOM:

- `pagination`

```css
sherpa-data-grid::part(pagination) {
  /* custom styles */
}
```

## Internal CSS Custom Properties

These `--_` prefixed properties are used internally and can be
influenced by setting `data-*` attributes or status on ancestors:

- `--_action-col-w`
- `--_border`
- `--_border-color`
- `--_border-right`
- `--_cell-bg`
- `--_cell-h`
- `--_cell-min-w`
- `--_cell-px`
- `--_group-parent-bg`
- `--_header-bg`
- `--_header-h`
- `--_pin-offset`
- `--_selection-col-w`
- `--_stripe-bg`

## Usage

### Basic

```html
<sherpa-data-grid data-segment-field="value" data-sort-field="value">
  <span slot="toolbar-leading"><!-- Consumer-provided primary action for toolbar --></span>
</sherpa-data-grid>
```

## Import

```js
// Individual import
import "sherpa-ui/components/sherpa-data-grid/sherpa-data-grid.js";

// Or import everything
import "sherpa-ui";
```

## Files

| File | Purpose |
| ---- | ------- |
| [`sherpa-data-grid.js`](sherpa-data-grid.js) | Component class, lifecycle, events |
| [`sherpa-data-grid.css`](sherpa-data-grid.css) | Styles, variants, states |
| [`sherpa-data-grid.html`](sherpa-data-grid.html) | Shadow DOM template(s) |
