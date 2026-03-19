# sherpa-input-search

> **Category:** form · **Base class:** SherpaInputBase

Search input with magnifying glass icon and clear button. Inherits label, description, helper, layout, validation from SherpaInputBase.

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
<sherpa-input-search></sherpa-input-search>
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
