# sherpa-nav-item

> **Category:** navigation · **Base class:** SherpaElement

Attribute-driven navigation item. Minimal JS — icon synced via data-icon, rest is declarative. Selection and interaction managed by parent sherpa-nav. Chevron rotation via CSS ::part(chevron).

## Templates

Available templates:

- `item`
- `divider`

## Attributes

| Attribute | Type | Description | Default | Values |
| --------- | ---- | ----------- | ------- | ------ |
| `data-icon` | string | FontAwesome icon class (e.g. "fa-home") | — | — |
| `data-badge` | string | Badge text rendered via internal sherpa-tag | — | — |
| `data-variant` | enum | section \| subsection \| child | — | `section`, `subsection`, `child` |
| `data-state` | enum | selected | — | — |

## Slots

| Slot | Description |
| ---- | ----------- |
| `(default)` | Label text content |

Slot usage:

```html
<sherpa-nav-item>
  <!-- Default slot -->
  <p>Content goes here</p>
</sherpa-nav-item>
```

## CSS Parts

Style internal elements from outside the shadow DOM:

- `indicator`
- `drag`
- `icon`
- `label`
- `tag`
- `chevron`
- `delete`

```css
sherpa-nav-item::part(indicator) {
  /* custom styles */
}
```

## Internal CSS Custom Properties

These `--_` prefixed properties are used internally and can be
influenced by setting `data-*` attributes or status on ancestors:

- `--_depth`
- `--_indent`
- `--_item-h`
- `--_label-weight`
- `--_ripple-i`

## Usage

### Basic

```html
<sherpa-nav-item data-icon="value" data-badge="value" data-variant="section">
  <!-- Default slot content -->
  <p>Your content here</p>
</sherpa-nav-item>
```

### Variants

```html
<sherpa-nav-item data-variant="section"></sherpa-nav-item>
<sherpa-nav-item data-variant="subsection"></sherpa-nav-item>
<sherpa-nav-item data-variant="child"></sherpa-nav-item>
```

## Import

```js
// Individual import
import "sherpa-ui/components/sherpa-nav-item/sherpa-nav-item.js";

// Or import everything
import "sherpa-ui";
```

## Files

| File | Purpose |
| ---- | ------- |
| [`sherpa-nav-item.js`](sherpa-nav-item.js) | Component class, lifecycle, events |
| [`sherpa-nav-item.css`](sherpa-nav-item.css) | Styles, variants, states |
| [`sherpa-nav-item.html`](sherpa-nav-item.html) | Shadow DOM template(s) |
