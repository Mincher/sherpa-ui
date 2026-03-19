# sherpa-menu-item

> **Category:** navigation · **Base class:** SherpaElement

Attribute-driven menu item with multiple template variants. Templates: default, checkbox, radio, toggle, heading.

## Templates

Set via `data-type` attribute:

- `default`
- `checkbox`
- `radio`
- `toggle`
- `heading`

## Attributes

| Attribute | Type | Description | Default | Values |
| --------- | ---- | ----------- | ------- | ------ |
| `data-type` | enum | checkbox \| radio \| toggle \| heading (default: action) | — | `checkbox`, `radio`, `toggle`, `heading` |
| `data-action` | string | Action identifier dispatched in menu-select | — | — |
| `value` | string | Value associated with this item | — | — |
| `data-selection` | enum | single \| multiple | — | `single`, `multiple` |
| `checked` | boolean | Whether checkbox/radio/toggle is checked | — | — |
| `disabled` | boolean | Whether the item is disabled | — | — |
| `data-description` | string | Secondary description text | — | — |
| `data-group` | string | Group identifier for radio grouping | — | — |
| `data-keep-open` | boolean | Keep menu open after selection | — | — |
| `data-has-submenu` | boolean | Whether the item opens a submenu | — | — |
| `name` | string | Form-compatible name for radio/checkbox | — | — |

## Slots

| Slot | Description |
| ---- | ----------- |
| `(default)` | Label text content |

Slot usage:

```html
<sherpa-menu-item>
  <!-- Default slot -->
  <p>Content goes here</p>
</sherpa-menu-item>
```

## Properties

| Property | Type | Description | Access |
| -------- | ---- | ----------- | ------ |
| `inputElement` | `Element` | Reference to internal input (checkbox/radio/switch) | read/write |

## CSS Parts

Style internal elements from outside the shadow DOM:

- `label`
- `description`
- `chevron`
- `input`
- `toggle`

```css
sherpa-menu-item::part(label) {
  /* custom styles */
}
```

## Internal CSS Custom Properties

These `--_` prefixed properties are used internally and can be
influenced by setting `data-*` attributes or status on ancestors:

- `--_font-sm`
- `--_gap`
- `--_padding-x`
- `--_padding-y`
- `--_rounding`
- `--_text-secondary`

## Usage

### Basic

```html
<sherpa-menu-item data-type="checkbox" data-action="value" value="value">
  <!-- Default slot content -->
  <p>Your content here</p>
</sherpa-menu-item>
```

### Disabled

```html
<sherpa-menu-item disabled></sherpa-menu-item>
```

## Import

```js
// Individual import
import "sherpa-ui/components/sherpa-menu-item/sherpa-menu-item.js";

// Or import everything
import "sherpa-ui";
```

## Files

| File | Purpose |
| ---- | ------- |
| [`sherpa-menu-item.js`](sherpa-menu-item.js) | Component class, lifecycle, events |
| [`sherpa-menu-item.css`](sherpa-menu-item.css) | Styles, variants, states |
| [`sherpa-menu-item.html`](sherpa-menu-item.html) | Shadow DOM template(s) |
