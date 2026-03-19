# sherpa-chart-legend

> **Category:** data-viz · **Base class:** SherpaElement

Standalone chart legend with optional interactive link items.

## Attributes

| Attribute | Type | Description | Default | Values |
| --------- | ---- | ----------- | ------- | ------ |
| `data-orientation` | enum | horizontal \| vertical (default: horizontal) | — | `horizontal`, `vertical` |
| `data-loading` | boolean | Show loading state | — | — |

## Events

### `legend-item-click`


**Propagation:** bubbles, composed

**Detail:**

```js
event.detail = {
  index: number,
  label: string,
};
```

```js
element.addEventListener("legend-item-click", (e) => {
  console.log(e.detail.index);
});
```

## Methods

| Method | Description |
| ------ | ----------- |
| `setItems(items)` | Set legend items: [{ label, value?, color?, active?, link? }] |

### `setItems(items)`

Set legend items: [{ label, value?, color?, active?, link? }]

**Parameters:**

- `items` (`any`) — 

## Properties

| Property | Type | Description | Access |
| -------- | ---- | ----------- | ------ |
| `items` | `Array` | Current legend items (getter-only) | read/write |

## Usage

### Basic

```html
<sherpa-chart-legend data-orientation="horizontal"></sherpa-chart-legend>
```

## Import

```js
// Individual import
import "sherpa-ui/components/sherpa-chart-legend/sherpa-chart-legend.js";

// Or import everything
import "sherpa-ui";
```

## Files

| File | Purpose |
| ---- | ------- |
| [`sherpa-chart-legend.js`](sherpa-chart-legend.js) | Component class, lifecycle, events |
| [`sherpa-chart-legend.css`](sherpa-chart-legend.css) | Styles, variants, states |
| [`sherpa-chart-legend.html`](sherpa-chart-legend.html) | Shadow DOM template(s) |
