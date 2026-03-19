# sherpa-filter-bar

> **Category:** page-level · **Base class:** SherpaElement

Horizontal filter bar with zoned layout. Supports global and local (container-scoped) modes. Template variants: default (global) | local.

## Templates

Available templates:

- `default`
- `local`

## Attributes

| Attribute | Type | Description | Default | Values |
| --------- | ---- | ----------- | ------- | ------ |
| `data-density` | enum | Display density variant | — | — |
| `data-active` | boolean | Whether filters are active | — | — |
| `data-preset-filters` | json | Preset filter configuration JSON | — | — |
| `data-available-fields` | json | Field definitions: [{ field, name, type }] | — | — |

## Slots

| Slot | Description |
| ---- | ----------- |
| `toggle` | Filter on/off toggle |
| `group` | Segment/group chip |
| `sort` | Sort chip |
| `presets` | Preset filter chips |
| `(default)` | User-added dynamic filter chips + Add button |
| `actions` | Clear / Apply / Save buttons |

Slot usage:

```html
<sherpa-filter-bar>
  <!-- Default slot -->
  <p>Content goes here</p>
  <div slot="toggle"><!-- Filter on/off toggle --></div>
  <div slot="group"><!-- Segment/group chip --></div>
  <div slot="sort"><!-- Sort chip --></div>
  <div slot="presets"><!-- Preset filter chips --></div>
  <div slot="actions"><!-- Clear / Apply / Save buttons --></div>
</sherpa-filter-bar>
```

## Events

### `filterchange`


**Propagation:** bubbles, composed

**Detail:**

```js
event.detail = {
  filters: Array,
};
```

```js
element.addEventListener("filterchange", (e) => {
  console.log(e.detail.filters);
});
```

### `filterclear`


**Propagation:** bubbles, composed

**Detail:** none

```js
element.addEventListener("filterclear", (e) => {
  // handle event
});
```

### `containerfilterchange`


**Propagation:** bubbles, composed

**Detail:**

```js
event.detail = {
  filters: Array,
};
```

```js
element.addEventListener("containerfilterchange", (e) => {
  console.log(e.detail.filters);
});
```

### `globalfilterchange`


**Propagation:** does not bubble

**Detail:**

```js
event.detail = {
  filters: Array,
};
```

```js
element.addEventListener("globalfilterchange", (e) => {
  console.log(e.detail.filters);
});
```

## Methods

| Method | Description |
| ------ | ----------- |
| `getFilters()` | Returns current filter array |
| `setAvailableColumns(columns, rows)` | Set columns and row data for menus |
| `removeFilterChip(field)` | Remove filter chip by field name |

### `setAvailableColumns(columns, rows)`

Set columns and row data for menus

**Parameters:**

- `columns` (`any`) — 
- `rows` (`any`) — 

### `removeFilterChip(field)`

Remove filter chip by field name

**Parameters:**

- `field` (`any`) — 

## Internal CSS Custom Properties

These `--_` prefixed properties are used internally and can be
influenced by setting `data-*` attributes or status on ancestors:

- `--_filter-bar-gap`
- `--_filter-bar-px`
- `--_filter-bar-py`

## Usage

### Basic

```html
<sherpa-filter-bar>
  <!-- Default slot content -->
  <p>Your content here</p>
  <span slot="toggle"><!-- Filter on/off toggle --></span>
  <span slot="group"><!-- Segment/group chip --></span>
</sherpa-filter-bar>
```

## Import

```js
// Individual import
import "sherpa-ui/components/sherpa-filter-bar/sherpa-filter-bar.js";

// Or import everything
import "sherpa-ui";
```

## Files

| File | Purpose |
| ---- | ------- |
| [`sherpa-filter-bar.js`](sherpa-filter-bar.js) | Component class, lifecycle, events |
| [`sherpa-filter-bar.css`](sherpa-filter-bar.css) | Styles, variants, states |
| [`sherpa-filter-bar.html`](sherpa-filter-bar.html) | Shadow DOM template(s) |
