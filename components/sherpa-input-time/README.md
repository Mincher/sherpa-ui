# sherpa-input-time

> **Category:** form · **Base class:** SherpaInputBase

Time input using the native browser time picker. Inherits label, description, helper, layout, validation from SherpaInputBase.

## Attributes

| Attribute | Type | Description | Default | Values |
| --------- | ---- | ----------- | ------- | ------ |
| `min` | string | Minimum selectable time (HH:MM) | — | — |
| `max` | string | Maximum selectable time (HH:MM) | — | — |
| `step` | number | Step increment in seconds | — | — |

## Events

### `input`


**Propagation:** bubbles, composed

**Detail:**

```js
event.detail = {
  value: string,
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
  value: string,
};
```

```js
element.addEventListener("change", (e) => {
  console.log(e.detail.value);
});
```

## Properties

| Property | Type | Description | Access |
| -------- | ---- | ----------- | ------ |
| `min` | `string` | Getter/setter for min attribute | read/write |
| `max` | `string` | Getter/setter for max attribute | read/write |
| `step` | `string` | Getter/setter for step attribute | read/write |

## Usage

### Basic

```html
<sherpa-input-time min="value" max="value"></sherpa-input-time>
```

## Import

```js
// Individual import
import "sherpa-ui/components/sherpa-input-time/sherpa-input-time.js";

// Or import everything
import "sherpa-ui";
```

## Files

| File | Purpose |
| ---- | ------- |
| [`sherpa-input-time.js`](sherpa-input-time.js) | Component class, lifecycle, events |
| [`sherpa-input-time.css`](sherpa-input-time.css) | Styles, variants, states |
| [`sherpa-input-time.html`](sherpa-input-time.html) | Shadow DOM template(s) |
