# sherpa-input-select

> **Category:** input · **Base class:** SherpaInputBase

Dropdown select input using native <select>. Options provided via light DOM <option> elements or programmatically via setOptions(). Inherits label, description, helper, layout, validation from SherpaInputBase.

## Templates

Available templates:

- `default`
- `tree`

## Attributes

| Attribute | Type | Description | Default | Values |
| --------- | ---- | ----------- | ------- | ------ |
| `data-template` | enum | default \| tree (hierarchical picker) | — | `default`, `tree` |
| `data-tree` | json | (tree) Node forest [{value,label,children?,disabled?}] | — | — |
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
| `setOptions(options)` | Set option list. Accepts either: |
| `setTree(nodes)` | (tree) Set the node forest |

### `setOptions(options)`

Set option list. Accepts either:

**Parameters:**

- `options` (`any`) — 

### `setTree(nodes)`

(tree) Set the node forest

**Parameters:**

- `nodes` (`any`) — 

## Usage

### Basic

```html
<sherpa-input-select data-template="default" data-label="Example Label" data-description="A brief description"></sherpa-input-select>
```

### Disabled

```html
<sherpa-input-select data-label="Disabled" disabled></sherpa-input-select>
```

## Import

```js
// Individual import
import "sherpa-ui/components/sherpa-input-select/sherpa-input-select.js";

// Or import everything
import "sherpa-ui";
```

## Files

| File | Purpose |
| ---- | ------- |
| [`sherpa-input-select.js`](sherpa-input-select.js) | Component class, lifecycle, events |
| [`sherpa-input-select.css`](sherpa-input-select.css) | Styles, variants, states |
| [`sherpa-input-select.html`](sherpa-input-select.html) | Shadow DOM template(s) |
