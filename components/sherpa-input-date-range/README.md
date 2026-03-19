# sherpa-input-date-range

> **Category:** form · **Base class:** SherpaInputBase

Date range picker composing two native date inputs (start / end). Inherits label, description, helper, layout, validation from SherpaInputBase. Start ≤ end constraint soft-enforced via min/max on native inputs.

## Attributes

| Attribute | Type | Description | Default | Values |
| --------- | ---- | ----------- | ------- | ------ |
| `data-value-start` | string | Start date (YYYY-MM-DD) | — | — |
| `data-value-end` | string | End date (YYYY-MM-DD) | — | — |
| `min` | string | Minimum selectable date (YYYY-MM-DD) | — | — |
| `max` | string | Maximum selectable date (YYYY-MM-DD) | — | — |

## Events

### `change`


**Propagation:** bubbles, composed

**Detail:**

```js
event.detail = {
  start: string|null,
  end: string|null,
};
```

```js
element.addEventListener("change", (e) => {
  console.log(e.detail.start);
});
```

### `input`


**Propagation:** bubbles, composed

**Detail:**

```js
event.detail = {
  start: string|null,
  end: string|null,
};
```

```js
element.addEventListener("input", (e) => {
  console.log(e.detail.start);
});
```

## Properties

| Property | Type | Description | Access |
| -------- | ---- | ----------- | ------ |
| `valueStart` | `string` | Getter/setter for data-value-start | read/write |
| `valueEnd` | `string` | Getter/setter for data-value-end | read/write |
| `startAsDate` | `Date|null` | Start value as Date (getter-only) | read/write |
| `endAsDate` | `Date|null` | End value as Date (getter-only) | read/write |

## Usage

### Basic

```html
<sherpa-input-date-range data-value-start="value" data-value-end="value" min="value"></sherpa-input-date-range>
```

## Import

```js
// Individual import
import "sherpa-ui/components/sherpa-input-date-range/sherpa-input-date-range.js";

// Or import everything
import "sherpa-ui";
```

## Files

| File | Purpose |
| ---- | ------- |
| [`sherpa-input-date-range.js`](sherpa-input-date-range.js) | Component class, lifecycle, events |
| [`sherpa-input-date-range.css`](sherpa-input-date-range.css) | Styles, variants, states |
| [`sherpa-input-date-range.html`](sherpa-input-date-range.html) | Shadow DOM template(s) |
