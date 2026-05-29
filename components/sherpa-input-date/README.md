# sherpa-input-date

> **Category:** input · **Base class:** SherpaInputBase

Typeable date input with an accessible calendar picker popup. The visible <input type="text"> owns the form value (YYYY-MM-DD) and inherits all label/description/helper/validation chrome from SherpaInputBase. A trailing calendar-icon button opens a custom popup for visual date selection. Typed values are validated against optional min / max via setCustomValidity().

## Attributes

| Attribute | Type | Description | Default | Values |
| --------- | ---- | ----------- | ------- | ------ |
| `min` | string | Minimum selectable date (YYYY-MM-DD) | — | — |
| `max` | string | Maximum selectable date (YYYY-MM-DD) | — | — |
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
| `valueAsDate` | `Date|null` | Current value as Date object (getter-only) | read/write |

## CSS Parts

Style internal elements from outside the shadow DOM:

- `trigger`

```css
sherpa-input-date::part(trigger) {
  /* custom styles */
}
```

## Usage

### Basic

```html
<sherpa-input-date min="value" max="value" data-label="Example Label"></sherpa-input-date>
```

### Disabled

```html
<sherpa-input-date data-label="Disabled" disabled></sherpa-input-date>
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
