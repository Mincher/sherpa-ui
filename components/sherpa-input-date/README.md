# sherpa-input-date

> **Category:** form · **Base class:** SherpaInputBase

Date input using the native browser date picker. Inherits label, description, helper, layout, validation from SherpaInputBase.

## Attributes

| Attribute | Type | Description | Default | Values |
| --------- | ---- | ----------- | ------- | ------ |
| `min` | string | Minimum selectable date (YYYY-MM-DD) | — | — |
| `max` | string | Maximum selectable date (YYYY-MM-DD) | — | — |

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
| `valueAsDate` | `Date|null` | Current value as Date object (getter-only) | read/write |

## Usage

### Basic

```html
<sherpa-input-date min="value" max="value"></sherpa-input-date>
```

## Import

```js
// Individual import
import "sherpa-ui/components/sherpa-input-date/sherpa-input-date.js";

// Or import everything
import "sherpa-ui";
```

## Files

| File | Purpose |
| ---- | ------- |
| [`sherpa-input-date.js`](sherpa-input-date.js) | Component class, lifecycle, events |
| [`sherpa-input-date.css`](sherpa-input-date.css) | Styles, variants, states |
| [`sherpa-input-date.html`](sherpa-input-date.html) | Shadow DOM template(s) |
