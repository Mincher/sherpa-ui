# sherpa-card

> **Category:** layout · **Base class:** SherpaElement

Container component with header, content, and footer areas. Uses a native <header> with a <dl> for the card header area, supporting both attribute-based headings and slotted custom content.

## Attributes

| Attribute | Type | Description | Default | Values |
| --------- | ---- | ----------- | ------- | ------ |
| `data-label` | string | Card title text | — | — |
| `data-description` | string | Card subtitle text | — | — |
| `data-selected` | boolean | Selected/active state | — | — |
| `data-interactive` | boolean | Makes card clickable | — | — |
| `data-elevation` | enum | none \| sm \| md \| lg | — | `none`, `sm`, `md`, `lg` |
| `disabled` | boolean | Native disabled state | — | — |

## Slots

| Slot | Description |
| ---- | ----------- |
| `(default)` | Default slot for main card content |
| `header` | Custom heading content (replaces attribute-driven title) |
| `footer` | Card footer content |

Slot usage:

```html
<sherpa-card>
  <!-- Default slot -->
  <p>Content goes here</p>
  <div slot="header"><!-- Custom heading content (replaces attribute-driven title) --></div>
  <div slot="footer"><!-- Card footer content --></div>
</sherpa-card>
```

## Events

### `card-click`

Fired when interactive card is clicked or activated via keyboard

**Propagation:** bubbles, composed

**Detail:** none

```js
element.addEventListener("card-click", (e) => {
  // handle event
});
```

## Properties

| Property | Type | Description | Access |
| -------- | ---- | ----------- | ------ |
| `selected` | `boolean` | Selected state (read/write) | read/write |
| `interactive` | `boolean` | Clickable state (read/write) | read/write |
| `disabled` | `boolean` | Disabled state (read/write) | read/write |
| `elevation` | `string` | Shadow level (read/write) | read/write |
| `heading` | `string` | Title text (read/write) | read/write |
| `description` | `string` | Subtitle text (read/write) | read/write |

## CSS Parts

Style internal elements from outside the shadow DOM:

- `header`
- `content`
- `footer`

```css
sherpa-card::part(header) {
  /* custom styles */
}
```

## Internal CSS Custom Properties

These `--_` prefixed properties are used internally and can be
influenced by setting `data-*` attributes or status on ancestors:

- `--_status-border`

## Usage

### Basic

```html
<sherpa-card data-label="Example Label" data-description="A brief description" data-elevation="none">
  <!-- Default slot content -->
  <p>Your content here</p>
  <span slot="header"><!-- Custom heading content (replaces attribute-driven title) --></span>
  <span slot="footer"><!-- Card footer content --></span>
</sherpa-card>
```

### Disabled

```html
<sherpa-card data-label="Disabled" disabled></sherpa-card>
```

## Import

```js
// Individual import
import "sherpa-ui/components/sherpa-card/sherpa-card.js";

// Or import everything
import "sherpa-ui";
```

## Files

| File | Purpose |
| ---- | ------- |
| [`sherpa-card.js`](sherpa-card.js) | Component class, lifecycle, events |
| [`sherpa-card.css`](sherpa-card.css) | Styles, variants, states |
| [`sherpa-card.html`](sherpa-card.html) | Shadow DOM template(s) |
