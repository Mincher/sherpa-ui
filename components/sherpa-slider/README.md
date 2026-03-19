# sherpa-slider

> **Category:** form · **Base class:** SherpaElement

Single or dual-handle range slider with optional numeric inputs. Pointer event drag with setPointerCapture. Keyboard arrows with step.

## Attributes

| Attribute | Type | Description | Default | Values |
| --------- | ---- | ----------- | ------- | ------ |
| `data-label` | string | Label text above the slider | — | — |
| `data-type` | enum | single \| range | `single` | `single`, `range` |
| `data-min` | number | Minimum value | `0` | — |
| `data-max` | number | Maximum value | `100` | — |
| `data-step` | number | Step increment | `1` | — |
| `data-value` | string | Current value (single mode) | — | — |
| `data-value-low` | string | Low handle value (range mode) | — | — |
| `data-value-high` | string | High handle value (range mode) | — | — |
| `data-show-inputs` | boolean | Show numeric input fields beside track | — | — |
| `data-show-labels` | boolean | Show min/max increment labels | — | — |
| `disabled` | boolean | Disabled state | — | — |

## Events

### `input`


**Propagation:** bubbles, composed

**Detail:**

```js
event.detail = {
  value: number } (single) or { low: number,
  high: number } (range),
};
```

```js
element.addEventListener("input", (e) => {
  console.log(e.detail.value);
});
```

### `change`


**Propagation:** bubbles, composed

**Detail:**

```js
event.detail = {
  value: number } (single) or { low: number,
  high: number } (range),
};
```

```js
element.addEventListener("change", (e) => {
  console.log(e.detail.value);
});
```

## Internal CSS Custom Properties

These `--_` prefixed properties are used internally and can be
influenced by setting `data-*` attributes or status on ancestors:

- `--_handle-size`
- `--_high-pct`
- `--_input-width`
- `--_low-pct`
- `--_status-surface-strong`
- `--_track-height`

## Usage

### Basic

```html
<sherpa-slider data-label="Example Label" data-type="single" data-value="value"></sherpa-slider>
```

### Disabled

```html
<sherpa-slider data-label="Disabled" disabled></sherpa-slider>
```

## Import

```js
// Individual import
import "sherpa-ui/components/sherpa-slider/sherpa-slider.js";

// Or import everything
import "sherpa-ui";
```

## Files

| File | Purpose |
| ---- | ------- |
| [`sherpa-slider.js`](sherpa-slider.js) | Component class, lifecycle, events |
| [`sherpa-slider.css`](sherpa-slider.css) | Styles, variants, states |
| [`sherpa-slider.html`](sherpa-slider.html) | Shadow DOM template(s) |
