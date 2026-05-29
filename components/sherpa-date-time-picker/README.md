# sherpa-date-time-picker

> **Category:** input · **Base class:** SherpaElement

Combined date + time picker popup panel.

## Attributes

| Attribute | Type | Description | Default | Values |
| --------- | ---- | ----------- | ------- | ------ |
| `value` | string | Current date-time value (YYYY-MM-DDTHH:mm) | — | — |
| `disabled` | boolean | Disabled state | — | — |
| `min` | string | Minimum selectable date-time (YYYY-MM-DDTHH:mm) | — | — |
| `max` | string | Maximum selectable date-time (YYYY-MM-DDTHH:mm) | — | — |
| `data-mode` | enum | 'date-time' (default) \| 'date' \| 'time' | — | — |
| `data-src-html` | string |  | — | — |
| `data-src-json` | string |  | — | — |

## Events

### `datetime-change`

User changed date or time

**Propagation:** bubbles, composed

**Detail:**

```js
event.detail = {
  value: string }   ISO datetime (YYYY-MM-DDTHH:mm),
};
```

```js
element.addEventListener("datetime-change", (e) => {
  console.log(e.detail.value);
});
```

### `datetime-submit`

Apply button clicked

**Propagation:** bubbles, composed

**Detail:**

```js
event.detail = {
  value: string,
};
```

```js
element.addEventListener("datetime-submit", (e) => {
  console.log(e.detail.value);
});
```

### `datetime-close`

Close button clicked

**Propagation:** bubbles, composed

**Detail:** none

```js
element.addEventListener("datetime-close", (e) => {
  // handle event
});
```

## Properties

| Property | Type | Description | Access |
| -------- | ---- | ----------- | ------ |
| `value` | `string` | Current date-time value (read/write) | read/write |

## Internal CSS Custom Properties

These `--_` prefixed properties are used internally and can be
influenced by setting `data-*` attributes or status on ancestors:

- `--_cg-border-radius`
- `--_cg-border-width`
- `--_cg-sep-block`
- `--_cg-sep-inline`
- `--_cg-separator-color`
- `--_grouped-rounding-end`
- `--_grouped-rounding-start`
- `--_grouped-spacing-offset`

## Usage

### Basic

```html
<sherpa-date-time-picker value="value" min="value" max="value"></sherpa-date-time-picker>
```

### Disabled

```html
<sherpa-date-time-picker disabled></sherpa-date-time-picker>
```

## Import

```js
// Individual import
import "sherpa-ui/components/sherpa-date-time-picker/sherpa-date-time-picker.js";

// Or import everything
import "sherpa-ui";
```

## Files

| File | Purpose |
| ---- | ------- |
| [`sherpa-date-time-picker.js`](sherpa-date-time-picker.js) | Component class, lifecycle, events |
| [`sherpa-date-time-picker.css`](sherpa-date-time-picker.css) | Styles, variants, states |
| [`sherpa-date-time-picker.html`](sherpa-date-time-picker.html) | Shadow DOM template(s) |
