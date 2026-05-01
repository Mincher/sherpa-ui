# sherpa-donut-chart

> **Category:** data-viz · **Base class:** SherpaElement

Donut / pie chart using CSS conic-gradient. Supports declarative query loading via ContentAttributesMixin or programmatic setData().

## Templates

Available templates:

- `default`
- `filter-menu`

## Attributes

| Attribute | Type | Description | Default | Values |
| --------- | ---- | ----------- | ------- | ------ |
| `data-title` | string | Chart heading text | — | — |
| `data-inner-label` | string | Centre big text | — | — |
| `data-inner-sublabel` | string | Centre small text | — | — |
| `data-loading` | boolean | Show loading state | — | — |
| `data-variant` | enum | donut \| pie | — | `donut`, `pie` |
| `data-segment-field` | string | Field for segment grouping | — | — |
| `data-segment-mode` | enum | Segment display mode | — | — |
| `data-sort-field` | string | Sort field | — | — |
| `data-sort-direction` | enum | asc \| desc | — | `asc`, `desc` |

## Methods

| Method | Description |
| ------ | ----------- |
| `setData(data)` | Set chart data: Array<{ label, value, color? }> or config |

### `setData(data)`

Set chart data: Array<{ label, value, color? }> or config

**Parameters:**

- `data` (`any`) — 

## Properties

| Property | Type | Description | Access |
| -------- | ---- | ----------- | ------ |
| `data` | `Array` | Current chart data (getter-only) | read/write |

## Internal CSS Custom Properties

These `--_` prefixed properties are used internally and can be
influenced by setting `data-*` attributes or status on ancestors:

- `--_chart-legend-align`
- `--_chart-legend-direction`
- `--_chart-legend-justify`
- `--_chart-legend-margin-top`
- `--_chart-legend-width`
- `--_chart-legend-wrap`
- `--_conic`
- `--_donut-size`

## Usage

### Basic

```html
<sherpa-donut-chart data-title="Example Title" data-inner-label="value" data-inner-sublabel="value" data-variant="donut"></sherpa-donut-chart>
```

### Variants

```html
<sherpa-donut-chart data-variant="donut"></sherpa-donut-chart>
<sherpa-donut-chart data-variant="pie"></sherpa-donut-chart>
```

## Import

```js
// Individual import
import "sherpa-ui/components/sherpa-donut-chart/sherpa-donut-chart.js";

// Or import everything
import "sherpa-ui";
```

## Files

| File | Purpose |
| ---- | ------- |
| [`sherpa-donut-chart.js`](sherpa-donut-chart.js) | Component class, lifecycle, events |
| [`sherpa-donut-chart.css`](sherpa-donut-chart.css) | Styles, variants, states |
| [`sherpa-donut-chart.html`](sherpa-donut-chart.html) | Shadow DOM template(s) |
