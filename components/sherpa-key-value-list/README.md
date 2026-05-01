# sherpa-key-value-list

> **Category:** data-display · **Base class:** SherpaElement

Semantic description list built on the native <dl> element. Content authored as <dt>/<dd> pairs. Layout, density, striping and borders controlled via host attributes and CSS.

## Attributes

| Attribute | Type | Description | Default | Values |
| --------- | ---- | ----------- | ------- | ------ |
| `data-layout` | enum | horizontal \| vertical (default: horizontal) | — | `horizontal`, `vertical` |
| `data-density` | enum | compact \| base \| comfortable (default: base) | — | `compact`, `base`, `comfortable` |
| `data-striped` | boolean | Alternate row backgrounds | — | — |
| `data-bordered` | boolean | Show borders (default: true) | — | — |
| `data-truncate` | boolean | Clip long values with ellipsis | — | — |
| `data-key-width` | string | Key column width (default: auto) | — | — |
| `data-type` | enum | Template variant | — | — |

## CSS Parts

Style internal elements from outside the shadow DOM:

- `list`

```css
sherpa-key-value-list::part(list) {
  /* custom styles */
}
```

## Internal CSS Custom Properties

These `--_` prefixed properties are used internally and can be
influenced by setting `data-*` attributes or status on ancestors:

- `--_key-width`
- `--_padding-block`

## Usage

### Basic

```html
<sherpa-key-value-list data-layout="horizontal" data-density="compact" data-key-width="value"></sherpa-key-value-list>
```

## Import

```js
// Individual import
import "sherpa-ui/components/sherpa-key-value-list/sherpa-key-value-list.js";

// Or import everything
import "sherpa-ui";
```

## Files

| File | Purpose |
| ---- | ------- |
| [`sherpa-key-value-list.js`](sherpa-key-value-list.js) | Component class, lifecycle, events |
| [`sherpa-key-value-list.css`](sherpa-key-value-list.css) | Styles, variants, states |
| [`sherpa-key-value-list.html`](sherpa-key-value-list.html) | Shadow DOM template(s) |
