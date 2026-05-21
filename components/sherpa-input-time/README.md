# sherpa-input-time

> **Category:** input · **Base class:** SherpaInputBase

Time input using the native browser time picker. Inherits label, description, helper, layout, validation from SherpaInputBase.

## Attributes

| Attribute | Type | Description | Default | Values |
| --------- | ---- | ----------- | ------- | ------ |
| `min` | string | Minimum selectable time (HH:MM) | — | — |
| `max` | string | Maximum selectable time (HH:MM) | — | — |
| `step` | number | Step increment in seconds | — | — |
| `data-label` | string |  | — | — |
| `data-description` | string |  | — | — |
| `data-helper` | string |  | — | — |
| `data-layout` | string |  | — | — |
| `disabled` | string |  | — | — |
| `readonly` | string |  | — | — |
| `required` | string |  | — | — |
| `name` | string |  | — | — |
| `value` | string |  | — | — |
| `placeholder` | string |  | — | — |
| `pattern` | string |  | — | — |
| `minlength` | string |  | — | — |
| `maxlength` | string |  | — | — |
| `novalidate` | string |  | — | — |
| `data-status` | string |  | — | — |
| `data-src-html` | string |  | — | — |
| `data-src-json` | string |  | — | — |

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
<sherpa-input-time min="value" max="value" data-label="Example Label"></sherpa-input-time>
```

### Disabled

```html
<sherpa-input-time data-label="Disabled" disabled></sherpa-input-time>
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
