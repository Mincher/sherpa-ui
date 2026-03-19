# sherpa-sparkline

> **Category:** data-viz · **Base class:** SherpaElement

CSS-driven sparkline. JS sets raw data values as CSS custom properties; CSS handles normalisation via calc() and visual rendering (clip-path polygons per segment).

## Attributes

| Attribute | Type | Description | Default | Values |
| --------- | ---- | ----------- | ------- | ------ |
| `data-values` | string | Comma-separated or JSON array (e.g. "10,25,15,30") | — | — |
| `data-variant` | enum | bar (default: line) | — | — |
| `data-unit` | string | Unit label for tooltip display | — | — |

## Methods

| Method | Description |
| ------ | ----------- |
| `setValues(values)` | Set sparkline data points |

### `setValues(values)`

Set sparkline data points

**Parameters:**

- `values` (`any`) — 

## Internal CSS Custom Properties

These `--_` prefixed properties are used internally and can be
influenced by setting `data-*` attributes or status on ancestors:

- `--_anim-duration`
- `--_anim-easing`
- `--_border-color`
- `--_i`
- `--_min`
- `--_n-end`
- `--_n-start`
- `--_point-hover-factor`
- `--_point-offset`
- `--_point-scale`
- `--_point-size`
- `--_progress-end`
- `--_progress-start`
- `--_range`
- `--_ripple-delay-step`
- `--_stroke-width`
- `--_v`
- `--_v-end`
- `--_v-start`
- `--_v0`
- ... and 13 more

## Usage

### Basic

```html
<sherpa-sparkline data-values="value" data-unit="value"></sherpa-sparkline>
```

## Import

```js
// Individual import
import "sherpa-ui/components/sherpa-sparkline/sherpa-sparkline.js";

// Or import everything
import "sherpa-ui";
```

## Files

| File | Purpose |
| ---- | ------- |
| [`sherpa-sparkline.js`](sherpa-sparkline.js) | Component class, lifecycle, events |
| [`sherpa-sparkline.css`](sherpa-sparkline.css) | Styles, variants, states |
| [`sherpa-sparkline.html`](sherpa-sparkline.html) | Shadow DOM template(s) |
