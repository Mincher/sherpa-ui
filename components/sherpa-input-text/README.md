# sherpa-input-text

> **Category:** form · **Base class:** SherpaInputBase

Basic text input. Inherits label, description, helper, layout, validation, and value management from SherpaInputBase.

## Attributes

| Attribute | Type | Description | Default | Values |
| --------- | ---- | ----------- | ------- | ------ |
| `data-label` | string | Label text (inherited) | — | — |
| `data-description` | string | Description / error text (inherited) | — | — |
| `data-helper` | string | Helper text (inherited) | — | — |
| `data-layout` | enum | stacked \| horizontal (inherited) | — | `stacked`, `horizontal` |
| `disabled` | boolean | Disabled state (inherited) | — | — |
| `readonly` | boolean | Read-only state (inherited) | — | — |
| `required` | boolean | Required constraint (inherited) | — | — |
| `name` | string | Form field name (inherited) | — | — |
| `value` | string | Current value (inherited) | — | — |
| `placeholder` | string | Placeholder text (inherited) | — | — |
| `pattern` | string | Validation regex (inherited) | — | — |
| `minlength` | number | Minimum character length (inherited) | — | — |
| `maxlength` | number | Maximum character length (inherited) | — | — |
| `novalidate` | boolean | Disable built-in validation (inherited) | — | — |

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

## Usage

### Basic

```html
<sherpa-input-text data-label="Example Label" data-description="A brief description" data-helper="value"></sherpa-input-text>
```

### Disabled

```html
<sherpa-input-text data-label="Disabled" disabled></sherpa-input-text>
```

## Import

```js
// Individual import
import "sherpa-ui/components/sherpa-input-text/sherpa-input-text.js";

// Or import everything
import "sherpa-ui";
```

## Files

| File | Purpose |
| ---- | ------- |
| [`sherpa-input-text.js`](sherpa-input-text.js) | Component class, lifecycle, events |
| [`sherpa-input-text.css`](sherpa-input-text.css) | Styles, variants, states |
| [`sherpa-input-text.html`](sherpa-input-text.html) | Shadow DOM template(s) |
