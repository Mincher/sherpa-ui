# sherpa-proposal-op

> **Category:** core · **Base class:** SherpaElement

Single change row inside <sherpa-proposal-preview>.

## Attributes

| Attribute | Type | Description | Default | Values |
| --------- | ---- | ----------- | ------- | ------ |
| `data` | enum | op]     add \| remove \| update \| add-edge \| remove-edge | — | `add`, `remove`, `update`, `add-edge`, `remove-edge` |
| `data` | string | label]  Body text describing the change. | — | — |

## CSS Parts

Style internal elements from outside the shadow DOM:

- `tag`
- `label`

```css
sherpa-proposal-op::part(tag) {
  /* custom styles */
}
```

## Usage

### Basic

```html
<sherpa-proposal-op data="add" data="value"></sherpa-proposal-op>
```

## Import

```js
// Individual import
import "sherpa-ui/components/sherpa-proposal-op/sherpa-proposal-op.js";

// Or import everything
import "sherpa-ui";
```

## Files

| File | Purpose |
| ---- | ------- |
| [`sherpa-proposal-op.js`](sherpa-proposal-op.js) | Component class, lifecycle, events |
| [`sherpa-proposal-op.css`](sherpa-proposal-op.css) | Styles, variants, states |
| [`sherpa-proposal-op.html`](sherpa-proposal-op.html) | Shadow DOM template(s) |
