# sherpa-transfer-list

> **Category:** data · **Base class:** SherpaElement

Two-pane shuttle (available <-> selected). Composes sherpa-list, sherpa-list-item, sherpa-input-checkbox, sherpa-input-search, sherpa-button.

## Attributes

| Attribute | Type | Description | Default | Values |
| --------- | ---- | ----------- | ------- | ------ |
| `data-source-heading` | string | Available pane heading | `Available` | — |
| `data-target-heading` | string | Selected pane heading | `Selected` | — |
| `data-search` | boolean | Show search inputs | — | — |

## Events

### `transfer-change`


**Propagation:** bubbles, composed

**Detail:**

```js
event.detail = {
  values: string[],
};
```

```js
element.addEventListener("transfer-change", (e) => {
  console.log(e.detail.values);
});
```

## Methods

| Method | Description |
| ------ | ----------- |
| `setOptions(options)` | options: [{ value, label, selected? }] |
| `getSelectedValues()` | Returns array of currently-selected values |

### `setOptions(options)`

options: [{ value, label, selected? }]

**Parameters:**

- `options` (`any`) — 

## Usage

### Basic

```html
<sherpa-transfer-list data-source-heading="value" data-target-heading="value"></sherpa-transfer-list>
```

## Import

```js
// Individual import
import "sherpa-ui/components/sherpa-transfer-list/sherpa-transfer-list.js";

// Or import everything
import "sherpa-ui";
```

## Files

| File | Purpose |
| ---- | ------- |
| [`sherpa-transfer-list.js`](sherpa-transfer-list.js) | Component class, lifecycle, events |
| [`sherpa-transfer-list.css`](sherpa-transfer-list.css) | Styles, variants, states |
| [`sherpa-transfer-list.html`](sherpa-transfer-list.html) | Shadow DOM template(s) |
