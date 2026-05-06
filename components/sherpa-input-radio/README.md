# sherpa-input-radio

> **Category:** core · **Base class:** SherpaElement

Atomic radio primitive. Single radio with label-on-the-right. Use multiple instances sharing a `name` to form a logical group, or wrap in `sherpa-input-radio-group` which manages the shared name + value coordination.

## Attributes

| Attribute | Type | Description | Default | Values |
| --------- | ---- | ----------- | ------- | ------ |
| `name` | string | Form field name (radios sharing a name group together) | — | — |
| `value` | string | Value submitted when selected | — | — |
| `checked` | boolean | Initial / current selected state | — | — |
| `disabled` | boolean | Disabled state | — | — |
| `required` | boolean | Required constraint | — | — |
| `data-label` | string | Inline label text | — | — |
| `data-description` | string | Helper line below the label | — | — |
| `data-status` | enum | critical \| warning \| success \| info \| urgent | — | `critical`, `warning`, `success`, `info`, `urgent` |

## Events

### `change`

User selected this radio.

**Propagation:** bubbles, composed

**Detail:**

```js
event.detail = {
  checked: boolean,
  value: string,
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
| `value` | `string` | Submitted value | read/write |

## Usage

### Basic

```html
<sherpa-input-radio name="value" value="value" data-label="Example Label"></sherpa-input-radio>
```

### Disabled

```html
<sherpa-input-radio data-label="Disabled" disabled></sherpa-input-radio>
```

## Import

```js
// Individual import
import "sherpa-ui/components/sherpa-input-radio/sherpa-input-radio.js";

// Or import everything
import "sherpa-ui";
```

## Files

| File | Purpose |
| ---- | ------- |
| [`sherpa-input-radio.js`](sherpa-input-radio.js) | Component class, lifecycle, events |
| [`sherpa-input-radio.css`](sherpa-input-radio.css) | Styles, variants, states |
| [`sherpa-input-radio.html`](sherpa-input-radio.html) | Shadow DOM template(s) |
