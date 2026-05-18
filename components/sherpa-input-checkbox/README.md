# sherpa-input-checkbox

> **Category:** input · **Base class:** SherpaElement

Atomic checkbox primitive. Single checkbox with label-on-the-right. Designed for both standalone use (e.g. "I accept the terms") and as a child of `sherpa-input-checkbox-group`.

## Attributes

| Attribute | Type | Description | Default | Values |
| --------- | ---- | ----------- | ------- | ------ |
| `name` | string | Form field name | — | — |
| `value` | string | Submitted value when checked (default "on") | — | — |
| `checked` | boolean | Initial / current checked state | — | — |
| `indeterminate` | boolean | Mixed state (overrides checked visually) | — | — |
| `disabled` | boolean | Disabled state | — | — |
| `required` | boolean | Required constraint | — | — |
| `data-label` | string | Inline label text | — | — |
| `data-description` | string | Helper line below the label | — | — |
| `data-status` | enum | critical \| warning \| success \| info \| urgent | — | `critical`, `warning`, `success`, `info`, `urgent` |

## Events

### `change`

User toggled the checkbox.

**Propagation:** bubbles, composed

**Detail:**

```js
event.detail = {
  checked: boolean,
  value: string,
  indeterminate: boolean,
};
```

```js
element.addEventListener("change", (e) => {
  console.log(e.detail.checked);
});
```

## Methods

| Method | Description |
| ------ | ----------- |
| `focus()` | Move focus to the underlying native input. |

## Properties

| Property | Type | Description | Access |
| -------- | ---- | ----------- | ------ |
| `checked` | `boolean` | Read/write checked state | read/write |
| `indeterminate` | `boolean` | Read/write indeterminate state | read/write |
| `value` | `string` | Submitted value | read/write |

## Internal CSS Custom Properties

These `--_` prefixed properties are used internally and can be
influenced by setting `data-*` attributes or status on ancestors:

- `--_status-`
- `--_status-border`
- `--_status-surface-strong`
- `--_status-text`

## Usage

### Basic

```html
<sherpa-input-checkbox name="value" value="value" data-label="Example Label"></sherpa-input-checkbox>
```

### Disabled

```html
<sherpa-input-checkbox data-label="Disabled" disabled></sherpa-input-checkbox>
```

## Import

```js
// Individual import
import "sherpa-ui/components/sherpa-input-checkbox/sherpa-input-checkbox.js";

// Or import everything
import "sherpa-ui";
```

## Files

| File | Purpose |
| ---- | ------- |
| [`sherpa-input-checkbox.js`](sherpa-input-checkbox.js) | Component class, lifecycle, events |
| [`sherpa-input-checkbox.css`](sherpa-input-checkbox.css) | Styles, variants, states |
| [`sherpa-input-checkbox.html`](sherpa-input-checkbox.html) | Shadow DOM template(s) |
