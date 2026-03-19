# sherpa-input-number

> **Category:** form · **Base class:** SherpaInputBase

Numerical input with stepper buttons. Inherits label, description, helper, layout, validation, and value management from SherpaInputBase.

## Attributes

| Attribute | Type | Description | Default | Values |
| --------- | ---- | ----------- | ------- | ------ |
| `min` | number | Minimum allowed value | — | — |
| `max` | number | Maximum allowed value | — | — |
| `step` | number | Step increment (default: 1) | — | — |

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

## Methods

| Method | Description |
| ------ | ----------- |
| `stepUp(n=1)` | Increment value by n steps |
| `stepDown(n=1)` | Decrement value by n steps |

### `stepUp(n=1)`

Increment value by n steps

**Parameters:**

- `n=1` (`any`) — 

### `stepDown(n=1)`

Decrement value by n steps

**Parameters:**

- `n=1` (`any`) — 

## Properties

| Property | Type | Description | Access |
| -------- | ---- | ----------- | ------ |
| `min` | `string` | Getter/setter for min attribute | read/write |
| `max` | `string` | Getter/setter for max attribute | read/write |
| `step` | `string` | Getter/setter for step attribute | read/write |
| `valueAsNumber` | `number` | Current value as a number (getter-only) | read/write |

## Usage

### Basic

```html
<sherpa-input-number></sherpa-input-number>
```

## Import

```js
// Individual import
import "sherpa-ui/components/sherpa-input-number/sherpa-input-number.js";

// Or import everything
import "sherpa-ui";
```

## Files

| File | Purpose |
| ---- | ------- |
| [`sherpa-input-number.js`](sherpa-input-number.js) | Component class, lifecycle, events |
| [`sherpa-input-number.css`](sherpa-input-number.css) | Styles, variants, states |
| [`sherpa-input-number.html`](sherpa-input-number.html) | Shadow DOM template(s) |
