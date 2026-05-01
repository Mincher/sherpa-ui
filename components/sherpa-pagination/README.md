# sherpa-pagination

> **Category:** data-display · **Base class:** SherpaElement

Standalone pagination bar with page navigation and page-size selector.

## Attributes

| Attribute | Type | Description | Default | Values |
| --------- | ---- | ----------- | ------- | ------ |
| `data-page` | number | Current 1-based page | `1` | — |
| `data-page-size` | number | Rows per page | `25` | — |
| `data-total-rows` | number | Total row count (required) | — | — |
| `data-allowed-sizes` | string | Comma-separated page-size options (default: "10,25,50,100") | — | — |
| `data-density` | enum | Display density | — | — |

## Events

### `page-change`


**Propagation:** bubbles

**Detail:**

```js
event.detail = {
  page: number,
  pageSize: number,
  totalPages: number,
};
```

```js
element.addEventListener("page-change", (e) => {
  console.log(e.detail.page);
});
```

## Methods

| Method | Description |
| ------ | ----------- |
| `goToPage(n)` | Navigate to specific page (clamped) |
| `setTotalRows(n)` | Update total rows + clamp page |

### `goToPage(n)`

Navigate to specific page (clamped)

**Parameters:**

- `n` (`any`) — 

### `setTotalRows(n)`

Update total rows + clamp page

**Parameters:**

- `n` (`any`) — 

## Properties

| Property | Type | Description | Access |
| -------- | ---- | ----------- | ------ |
| `page` | `number` | Current page (getter/setter) | read/write |
| `pageSize` | `number` | Rows per page (getter/setter) | read/write |
| `totalRows` | `number` | Total row count (getter/setter) | read/write |
| `totalPages` | `number` | Computed total pages (getter-only) | read/write |
| `allowedSizes` | `number[]` | Parsed page-size options (getter-only) | read/write |

## CSS Parts

Style internal elements from outside the shadow DOM:

- `results`
- `info`
- `pager`

```css
sherpa-pagination::part(results) {
  /* custom styles */
}
```

## Internal CSS Custom Properties

These `--_` prefixed properties are used internally and can be
influenced by setting `data-*` attributes or status on ancestors:

- `--_btn-size`
- `--_pagination-bg`
- `--_pagination-border`
- `--_pagination-gap`
- `--_pagination-h`

## Usage

### Basic

```html
<sherpa-pagination data-allowed-sizes="value"></sherpa-pagination>
```

## Import

```js
// Individual import
import "sherpa-ui/components/sherpa-pagination/sherpa-pagination.js";

// Or import everything
import "sherpa-ui";
```

## Files

| File | Purpose |
| ---- | ------- |
| [`sherpa-pagination.js`](sherpa-pagination.js) | Component class, lifecycle, events |
| [`sherpa-pagination.css`](sherpa-pagination.css) | Styles, variants, states |
| [`sherpa-pagination.html`](sherpa-pagination.html) | Shadow DOM template(s) |
