# sherpa-input-search

> **Category:** input · **Base class:** SherpaInputBase

Search input with magnifying glass icon and clear button. Inherits label, description, helper, layout, validation from SherpaInputBase.

## Attributes

| Attribute | Type | Description | Default | Values |
| --------- | ---- | ----------- | ------- | ------ |
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

### `search`


**Propagation:** bubbles, composed

**Detail:**

```js
event.detail = {
  value: string,
};
```

```js
element.addEventListener("search", (e) => {
  console.log(e.detail.value);
});
```

## Methods

| Method | Description |
| ------ | ----------- |
| `clear()` | Clear the search field and fire search event |

## Usage

### Basic

```html
<sherpa-input-search data-label="Example Label" data-description="A brief description" data-helper="value"></sherpa-input-search>
```

### Disabled

```html
<sherpa-input-search data-label="Disabled" disabled></sherpa-input-search>
```

## Import

```js
// Individual import
import "sherpa-ui/components/sherpa-input-search/sherpa-input-search.js";

// Or import everything
import "sherpa-ui";
```

## Files

| File | Purpose |
| ---- | ------- |
| [`sherpa-input-search.js`](sherpa-input-search.js) | Component class, lifecycle, events |
| [`sherpa-input-search.css`](sherpa-input-search.css) | Styles, variants, states |
| [`sherpa-input-search.html`](sherpa-input-search.html) | Shadow DOM template(s) |
