# sherpa-layout-grid

> **Category:** core · **Base class:** SherpaElement

Responsive dashboard grid. Slotted <sherpa-container data-variant="resizable"> children take grid spans from their data-col-span / data-row-span attributes.

## Attributes

| Attribute | Type | Description | Default | Values |
| --------- | ---- | ----------- | ------- | ------ |
| `data-row-height` | string | CSS length for grid-auto-rows (default: 160px) | — | — |
| `data-content` | enum | "static" — opts out of grid; stacks children | — | — |

## Slots

| Slot | Description |
| ---- | ----------- |
| `(default)` | sherpa-container children |

Slot usage:

```html
<sherpa-layout-grid>
  <!-- Default slot -->
  <p>Content goes here</p>
</sherpa-layout-grid>
```

## Usage

### Basic

```html
<sherpa-layout-grid data-row-height="value">
  <!-- Default slot content -->
  <p>Your content here</p>
</sherpa-layout-grid>
```

## Import

```js
// Individual import
import "sherpa-ui/components/sherpa-layout-grid/sherpa-layout-grid.js";

// Or import everything
import "sherpa-ui";
```

## Files

| File | Purpose |
| ---- | ------- |
| [`sherpa-layout-grid.js`](sherpa-layout-grid.js) | Component class, lifecycle, events |
| [`sherpa-layout-grid.css`](sherpa-layout-grid.css) | Styles, variants, states |
| [`sherpa-layout-grid.html`](sherpa-layout-grid.html) | Shadow DOM template(s) |
