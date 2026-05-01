# sherpa-barchart

> **Category:** data-viz · **Base class:** SherpaElement

Adaptive bar chart with automatic orientation. Supports stacked bars, category limiting, and responsive legend. Extends ContentAttributesMixin(SherpaElement) for data pipeline.

## Templates

Available templates:

- `default`
- `filter-menu`

## Attributes

| Attribute | Type | Description | Default | Values |
| --------- | ---- | ----------- | ------- | ------ |
| `data-loading` | boolean | Show loading state | — | — |
| `data-stacked` | boolean | Stack bars by segment | — | — |
| `data-title` | string | Chart heading text | — | — |
| `data-orientation` | enum | horizontal \| vertical (auto-selected) | — | `horizontal`, `vertical` |
| `data-segment-field` | string | Field for bar grouping | — | — |
| `data-segment-mode` | enum | Segment display mode | — | — |
| `data-sort-field` | string | Sort field | — | — |
| `data-sort-direction` | enum | asc \| desc | — | `asc`, `desc` |

## Events

### `sortchange`


**Propagation:** bubbles, composed

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

### `presentationchange`


**Propagation:** bubbles, composed

**Detail:**

```js
event.detail = {
  type: string,
  data: object,
};
```

```js
element.addEventListener("presentationchange", (e) => {
  console.log(e.detail.type);
});
```

## Methods

| Method | Description |
| ------ | ----------- |
| `getData()` | Returns transferable config |
| `setData(data)` | Set chart data and render |
| `getCategoryField()` | Resolved category field name |

### `setData(data)`

Set chart data and render

**Parameters:**

- `data` (`any`) — 

## Internal CSS Custom Properties

These `--_` prefixed properties are used internally and can be
influenced by setting `data-*` attributes or status on ancestors:

- `--_chart-legend-align`
- `--_chart-legend-direction`
- `--_chart-legend-justify`
- `--_chart-legend-margin-top`
- `--_chart-legend-width`
- `--_chart-legend-wrap`
- `--_data-viz-color`
- `--_i`
- `--_label-width`
- `--_ripple-delay-step`
- `--_segment-size`

## Usage

### Basic

```html
<sherpa-barchart data-title="Example Title" data-orientation="horizontal" data-segment-field="value"></sherpa-barchart>
```

## Import

```js
// Individual import
import "sherpa-ui/components/sherpa-barchart/sherpa-barchart.js";

// Or import everything
import "sherpa-ui";
```

## Files

| File | Purpose |
| ---- | ------- |
| [`sherpa-barchart.js`](sherpa-barchart.js) | Component class, lifecycle, events |
| [`sherpa-barchart.css`](sherpa-barchart.css) | Styles, variants, states |
| [`sherpa-barchart.html`](sherpa-barchart.html) | Shadow DOM template(s) |
