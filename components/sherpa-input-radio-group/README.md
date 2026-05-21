# sherpa-input-radio-group

> **Category:** input · **Base class:** SherpaElement

Group of radios with shared label, description, helper and a single selected value.

## Attributes

| Attribute | Type | Description | Default | Values |
| --------- | ---- | ----------- | ------- | ------ |
| `name` | string | Field name; cascaded to children | — | — |
| `data-label` | string | Group legend | — | — |
| `data-description` | string | Sub-label below the legend | — | — |
| `data-helper` | string | Helper text below the options | — | — |
| `data-orientation` | enum | vertical (default) \| horizontal | — | — |
| `data-options` | json | [{value,label,description?,disabled?}] | — | — |
| `data-value` | string | Currently selected value | — | — |
| `data-status` | enum | critical \| warning \| success \| info \| urgent | — | `critical`, `warning`, `success`, `info`, `urgent` |
| `disabled` | boolean |  | — | — |
| `required` | boolean |  | — | — |
| `data-src-html` | string |  | — | — |
| `data-src-json` | string |  | — | — |

## Events

### `change`

Selection changed.

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
| `getValue()` | Returns current value or null. |
| `setValue(v)` | Replace current value. |
| `clear()` | Deselect all. |

### `setValue(v)`

Replace current value.

**Parameters:**

- `v` (`any`) — 

## Properties

| Property | Type | Description | Access |
| -------- | ---- | ----------- | ------ |
| `value` | `string` | Currently selected value | read/write |

## CSS Parts

Style internal elements from outside the shadow DOM:

- `wrapper`
- `options`

```css
sherpa-input-radio-group::part(wrapper) {
  /* custom styles */
}
```

## Internal CSS Custom Properties

These `--_` prefixed properties are used internally and can be
influenced by setting `data-*` attributes or status on ancestors:

- `--_status-`
- `--_status-text`

## Usage

### Basic

```html
<sherpa-input-radio-group name="value" data-label="Example Label" data-description="A brief description"></sherpa-input-radio-group>
```

### Disabled

```html
<sherpa-input-radio-group data-label="Disabled" disabled></sherpa-input-radio-group>
```

## Import

```js
// Individual import
import "sherpa-ui/components/sherpa-input-radio-group/sherpa-input-radio-group.js";

// Or import everything
import "sherpa-ui";
```

## Files

| File | Purpose |
| ---- | ------- |
| [`sherpa-input-radio-group.js`](sherpa-input-radio-group.js) | Component class, lifecycle, events |
| [`sherpa-input-radio-group.css`](sherpa-input-radio-group.css) | Styles, variants, states |
| [`sherpa-input-radio-group.html`](sherpa-input-radio-group.html) | Shadow DOM template(s) |
