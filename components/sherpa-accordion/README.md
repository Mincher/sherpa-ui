# sherpa-accordion

> **Category:** layout · **Base class:** SherpaElement

Collapsible content panel using native <details>/<summary>. The browser handles expand/collapse natively. JS only syncs the data-label and data-icon attributes into the shadow DOM.

## Attributes

| Attribute | Type | Description | Default | Values |
| --------- | ---- | ----------- | ------- | ------ |
| `data-label` | string | Heading text for the summary row | — | — |
| `data-icon` | string | FontAwesome unicode for optional leading icon | — | — |
| `open` | boolean | Native details open/expanded state | — | — |
| `disabled` | boolean | Prevents interaction | — | — |

## Slots

| Slot | Description |
| ---- | ----------- |
| `(default)` | Default slot for panel content revealed when expanded |
| `actions` | Trailing action buttons in the summary row |

Slot usage:

```html
<sherpa-accordion>
  <!-- Default slot -->
  <p>Content goes here</p>
  <div slot="actions"><!-- Trailing action buttons in the summary row --></div>
</sherpa-accordion>
```

## CSS Parts

Style internal elements from outside the shadow DOM:

- `details`
- `trigger`
- `panel`

```css
sherpa-accordion::part(details) {
  /* custom styles */
}
```

## Usage

### Basic

```html
<sherpa-accordion data-label="Example Label" data-icon="value">
  <!-- Default slot content -->
  <p>Your content here</p>
  <span slot="actions"><!-- Trailing action buttons in the summary row --></span>
</sherpa-accordion>
```

### Disabled

```html
<sherpa-accordion data-label="Disabled" disabled></sherpa-accordion>
```

## Import

```js
// Individual import
import "sherpa-ui/components/sherpa-accordion/sherpa-accordion.js";

// Or import everything
import "sherpa-ui";
```

## Files

| File | Purpose |
| ---- | ------- |
| [`sherpa-accordion.js`](sherpa-accordion.js) | Component class, lifecycle, events |
| [`sherpa-accordion.css`](sherpa-accordion.css) | Styles, variants, states |
| [`sherpa-accordion.html`](sherpa-accordion.html) | Shadow DOM template(s) |
