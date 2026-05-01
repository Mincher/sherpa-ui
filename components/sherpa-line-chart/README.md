# sherpa-line-chart

> **Category:** data-viz · **Base class:** SherpaElement

Line / area chart using CSS clip-path segments. JS sets raw data as CSS custom properties; CSS normalises via calc() and renders clip-path polygons. Zero polygon computation in JS.

## Templates

Available templates:

- `default`
- `filter-menu`

## Attributes

| Attribute | Type | Description | Default | Values |
| --------- | ---- | ----------- | ------- | ------ |
| `data-title` | string | Chart heading text | — | — |
| `data-loading` | boolean | Show loading state | — | — |
| `data-variant` | enum | line \| area | — | `line`, `area` |
| `data-segment-field` | string | Field for series grouping | — | — |
| `data-segment-mode` | enum | Segment display mode | — | — |
| `data-sort-field` | string | Sort field | — | — |
| `data-sort-direction` | enum | asc \| desc | — | `asc`, `desc` |

## Methods

| Method | Description |
| ------ | ----------- |
| `setData(data)` | Set chart data: { labels, series: [{ name, values }] } or config |

### `setData(data)`

Set chart data: { labels, series: [{ name, values }] } or config

**Parameters:**

- `data` (`any`) — 

## Internal CSS Custom Properties

These `--_` prefixed properties are used internally and can be
influenced by setting `data-*` attributes or status on ancestors:

- `--_anim-duration`
- `--_anim-easing`
- `--_chart-legend-align`
- `--_chart-legend-direction`
- `--_chart-legend-justify`
- `--_chart-legend-margin-top`
- `--_chart-legend-width`
- `--_chart-legend-wrap`
- `--_gc`
- `--_i`
- `--_min`
- `--_n-end`
- `--_n-start`
- `--_offset`
- `--_progress-end`
- `--_progress-start`
- `--_range`
- `--_ripple-delay-step`
- `--_slope-factor`
- `--_stroke-width`
- ... and 15 more

## Usage

### Basic

```html
<sherpa-line-chart data-title="Example Title" data-variant="line" data-segment-field="value"></sherpa-line-chart>
```

### Variants

```html
<sherpa-line-chart data-variant="line"></sherpa-line-chart>
<sherpa-line-chart data-variant="area"></sherpa-line-chart>
```

## Import

```js
// Individual import
import "sherpa-ui/components/sherpa-line-chart/sherpa-line-chart.js";

// Or import everything
import "sherpa-ui";
```

## Files

| File | Purpose |
| ---- | ------- |
| [`sherpa-line-chart.js`](sherpa-line-chart.js) | Component class, lifecycle, events |
| [`sherpa-line-chart.css`](sherpa-line-chart.css) | Styles, variants, states |
| [`sherpa-line-chart.html`](sherpa-line-chart.html) | Shadow DOM template(s) |
