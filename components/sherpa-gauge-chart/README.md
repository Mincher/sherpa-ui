# sherpa-gauge-chart

> **Category:** data-viz · **Base class:** SherpaElement

Semicircle gauge using CSS conic-gradient.

## Attributes

| Attribute | Type | Description | Default | Values |
| --------- | ---- | ----------- | ------- | ------ |
| `data-title` | string | Chart heading text | — | — |
| `data-value` | number | Numeric value 0–100 | — | — |
| `data-min` | string | Min range label (default: "0%") | — | — |
| `data-max` | string | Max range label (default: "100%") | — | — |
| `data-label` | string | Descriptive text below value | — | — |
| `data-loading` | boolean | Show loading state | — | — |
| `data-variant` | enum | solid \| series | — | `solid`, `series` |

## Methods

| Method | Description |
| ------ | ----------- |
| `setSegments(segments)` | Series variant: set arc segments [{ value, color? }] |

### `setSegments(segments)`

Series variant: set arc segments [{ value, color? }]

**Parameters:**

- `segments` (`any`) — 

## Internal CSS Custom Properties

These `--_` prefixed properties are used internally and can be
influenced by setting `data-*` attributes or status on ancestors:

- `--_angle`
- `--_fill-angle`
- `--_fill-gradient`
- `--_fill-pct`

## Usage

### Basic

```html
<sherpa-gauge-chart data-title="Example Title" data-min="value" data-max="value" data-label="Example Label"></sherpa-gauge-chart>
```

### Variants

```html
<sherpa-gauge-chart data-variant="solid" data-label="Solid"></sherpa-gauge-chart>
<sherpa-gauge-chart data-variant="series" data-label="Series"></sherpa-gauge-chart>
```

## Import

```js
// Individual import
import "sherpa-ui/components/sherpa-gauge-chart/sherpa-gauge-chart.js";

// Or import everything
import "sherpa-ui";
```

## Files

| File | Purpose |
| ---- | ------- |
| [`sherpa-gauge-chart.js`](sherpa-gauge-chart.js) | Component class, lifecycle, events |
| [`sherpa-gauge-chart.css`](sherpa-gauge-chart.css) | Styles, variants, states |
| [`sherpa-gauge-chart.html`](sherpa-gauge-chart.html) | Shadow DOM template(s) |
