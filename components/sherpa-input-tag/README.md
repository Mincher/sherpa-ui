# sherpa-input-tag

> **Category:** core · **Base class:** SherpaElement

Multi-tag input. Replaces DevExtreme DxTagBox for free-text tag entry. Behaviour: • Type, then press Enter (or the configured separator) to commit a chip. • Press Backspace in an empty field to remove the last chip. • Click ✕ on a chip to remove it. • `data-value` reflects the current array of tag values as JSON.

## Attributes

| Attribute | Type | Description | Default | Values |
| --------- | ---- | ----------- | ------- | ------ |
| `data-label` | string |  | — | — |
| `data-description` | string |  | — | — |
| `data-helper` | string |  | — | — |
| `data-layout` | enum | vertical (default) \| horizontal | — | — |
| `name` | string |  | — | — |
| `placeholder` | string |  | — | — |
| `disabled` | boolean |  | — | — |
| `readonly` | boolean |  | — | — |
| `required` | boolean | Empty array fails validation | — | — |
| `data-value` | json | Array of current tag strings | — | — |
| `data-separator` | string | Extra character that commits a chip | `","` | — |
| `data-allow-duplicates` | boolean | Allow repeated values | — | — |
| `data-max-tags` | number | Hard cap on tag count | — | — |

## Events

### `change`

Tag list changed (add or remove).

**Propagation:** bubbles, composed

**Detail:**

```js
event.detail = {
  value: string[],
  action: 'add'|'remove'|'set',
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
| `add(tag)` | Programmatically add a tag. |
| `remove(tag)` | Programmatically remove a tag. |
| `clear()` | Remove all tags. |

### `add(tag)`

Programmatically add a tag.

**Parameters:**

- `tag` (`any`) — 

### `remove(tag)`

Programmatically remove a tag.

**Parameters:**

- `tag` (`any`) — 

## Properties

| Property | Type | Description | Access |
| -------- | ---- | ----------- | ------ |
| `value` | `string[]` | Current tag list (read/write) | read/write |

## Usage

### Basic

```html
<sherpa-input-tag data-label="Example Label" data-description="A brief description" data-helper="value"></sherpa-input-tag>
```

### Disabled

```html
<sherpa-input-tag data-label="Disabled" disabled></sherpa-input-tag>
```

## Import

```js
// Individual import
import "sherpa-ui/components/sherpa-input-tag/sherpa-input-tag.js";

// Or import everything
import "sherpa-ui";
```

## Files

| File | Purpose |
| ---- | ------- |
| [`sherpa-input-tag.js`](sherpa-input-tag.js) | Component class, lifecycle, events |
| [`sherpa-input-tag.css`](sherpa-input-tag.css) | Styles, variants, states |
| [`sherpa-input-tag.html`](sherpa-input-tag.html) | Shadow DOM template(s) |
