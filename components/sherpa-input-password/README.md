# sherpa-input-password

> **Category:** form · **Base class:** SherpaInputBase

Password input with show/hide toggle button. Inherits label, description, helper, layout, validation from SherpaInputBase.

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
| `visible` | `boolean` | Whether password text is currently shown in plain text | read/write |

## Usage

### Basic

```html
<sherpa-input-password></sherpa-input-password>
```

## Import

```js
// Individual import
import "sherpa-ui/components/sherpa-input-password/sherpa-input-password.js";

// Or import everything
import "sherpa-ui";
```

## Files

| File | Purpose |
| ---- | ------- |
| [`sherpa-input-password.js`](sherpa-input-password.js) | Component class, lifecycle, events |
| [`sherpa-input-password.css`](sherpa-input-password.css) | Styles, variants, states |
| [`sherpa-input-password.html`](sherpa-input-password.html) | Shadow DOM template(s) |
