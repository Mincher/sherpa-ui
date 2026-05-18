# sherpa-input-checkbox-group

> **Category:** input · **Base class:** SherpaElement

Group of checkboxes with shared label, description, helper, and an optional pre-stamped `weekdays` template.

## Templates

Available templates:

- `default`
- `weekdays`

## Attributes

| Attribute | Type | Description | Default | Values |
| --------- | ---- | ----------- | ------- | ------ |
| `name` | string | Group field name; cascaded to children | — | — |
| `data-label` | string | Group legend | — | — |
| `data-description` | string | Sub-label below the legend | — | — |
| `data-helper` | string | Helper text below the options | — | — |
| `data-orientation` | enum | vertical (default) \| horizontal | — | — |
| `data-options` | json | [{value,label,description?,disabled?}] | — | — |
| `data-value` | json | Currently selected values, e.g. ["1","3"] | — | — |
| `data-status` | enum | critical \| warning \| success \| info \| urgent | — | `critical`, `warning`, `success`, `info`, `urgent` |
| `data-template` | string | "default" (default) \| "weekdays" | — | — |
| `disabled` | boolean | Disable all children | — | — |
| `required` | boolean | At least one selection required | — | — |

## Events

### `change`

Selection changed.

**Propagation:** bubbles, composed

**Detail:**

```js
event.detail = {
  value: string[],
  values: string[],
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
| `getValue()` | Returns the current value array. |
| `setValue(arr)` | Replace the current value array. |
| `clear()` | Uncheck every option. |

### `setValue(arr)`

Replace the current value array.

**Parameters:**

- `arr` (`any`) — 

## Properties

| Property | Type | Description | Access |
| -------- | ---- | ----------- | ------ |
| `value` | `string[]` | Currently selected values (read/write) | read/write |

## CSS Parts

Style internal elements from outside the shadow DOM:

- `wrapper`
- `options`

```css
sherpa-input-checkbox-group::part(wrapper) {
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
<sherpa-input-checkbox-group name="value" data-label="Example Label" data-description="A brief description"></sherpa-input-checkbox-group>
```

### Disabled

```html
<sherpa-input-checkbox-group data-label="Disabled" disabled></sherpa-input-checkbox-group>
```

## Import

```js
// Individual import
import "sherpa-ui/components/sherpa-input-checkbox-group/sherpa-input-checkbox-group.js";

// Or import everything
import "sherpa-ui";
```

## Files

| File | Purpose |
| ---- | ------- |
| [`sherpa-input-checkbox-group.js`](sherpa-input-checkbox-group.js) | Component class, lifecycle, events |
| [`sherpa-input-checkbox-group.css`](sherpa-input-checkbox-group.css) | Styles, variants, states |
| [`sherpa-input-checkbox-group.html`](sherpa-input-checkbox-group.html) | Shadow DOM template(s) |
