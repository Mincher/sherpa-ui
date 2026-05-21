# sherpa-popover

> **Category:** overlay · **Base class:** SherpaElement

General-purpose floating content container with header.

## Templates

Available templates:

- `default`
- `paged`

## Attributes

| Attribute | Type | Description | Default | Values |
| --------- | ---- | ----------- | ------- | ------ |
| `data-heading` | string | Header title text | — | — |
| `data-open` | boolean | Shows the popover | — | — |
| `data-anchor` | string | CSS anchor name to position against | — | — |
| `data-position` | enum | top \| bottom \| left \| right | — | `top`, `bottom`, `left`, `right` |
| `data-template` | enum | default \| paged | — | `default`, `paged` |
| `data-page` | number | (paged) Active 0-based page index | — | — |
| `data-pages` | number | (paged) Total page count for the indicator | — | — |
| `data-animation` | enum | none (default) \| slide | — | — |
| `data-src-html` | string |  | — | — |
| `data-src-json` | string |  | — | — |

## Slots

| Slot | Description |
| ---- | ----------- |
| `(default)` | Default slot for body content (paged: <section data-page="N">) |
| `icon` | Header icon slot |
| `header-end` | Header trailing content slot |

Slot usage:

```html
<sherpa-popover>
  <!-- Default slot -->
  <p>Content goes here</p>
  <div slot="icon"><!-- Header icon slot --></div>
  <div slot="header-end"><!-- Header trailing content slot --></div>
</sherpa-popover>
```

## Events

### `popover-close`

Fired when close button or click-outside dismisses

**Propagation:** bubbles, composed

**Detail:** none

```js
element.addEventListener("popover-close", (e) => {
  // handle event
});
```

### `popover-page-change`

(paged) Fired after the active page changes.

**Propagation:** bubbles, composed

**Detail:**

```js
event.detail = {
  page: number,
  total: number,
};
```

```js
element.addEventListener("popover-page-change", (e) => {
  console.log(e.detail.page);
});
```

## Methods

| Method | Description |
| ------ | ----------- |
| `nextPage()` | (paged) Advance to the next page if available. |
| `prevPage()` | (paged) Step back to the previous page if available. |
| `setPage(index)` | (paged) Jump to a specific 0-based page. |

### `setPage(index)`

(paged) Jump to a specific 0-based page.

**Parameters:**

- `index` (`any`) — 

## Internal CSS Custom Properties

These `--_` prefixed properties are used internally and can be
influenced by setting `data-*` attributes or status on ancestors:

- `--_popover-anchor`

## Usage

### Basic

```html
<sherpa-popover data-heading="value" data-anchor="value" data-position="top">
  <!-- Default slot content -->
  <p>Your content here</p>
  <span slot="icon"><!-- Header icon slot --></span>
  <span slot="header-end"><!-- Header trailing content slot --></span>
</sherpa-popover>
```

## Import

```js
// Individual import
import "sherpa-ui/components/sherpa-popover/sherpa-popover.js";

// Or import everything
import "sherpa-ui";
```

## Files

| File | Purpose |
| ---- | ------- |
| [`sherpa-popover.js`](sherpa-popover.js) | Component class, lifecycle, events |
| [`sherpa-popover.css`](sherpa-popover.css) | Styles, variants, states |
| [`sherpa-popover.html`](sherpa-popover.html) | Shadow DOM template(s) |
