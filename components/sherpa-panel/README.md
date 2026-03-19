# sherpa-panel

> **Category:** layout · **Base class:** SherpaElement

Slide-out or inline panel with header and content area.

## Attributes

| Attribute | Type | Description | Default | Values |
| --------- | ---- | ----------- | ------- | ------ |
| `data-variant` | enum | inline \| overlay | — | `inline`, `overlay` |
| `data-position` | enum | left \| right | — | `left`, `right` |
| `data-expanded` | boolean | Expanded (visible) state | — | — |
| `data-heading` | string | Heading text | — | — |
| `data-width` | string | Custom width (CSS value) | — | — |

## Slots

| Slot | Description |
| ---- | ----------- |
| `(default)` | Default slot for panel body content |
| `controls` | Header control buttons |
| `metadata` | Metadata content area |
| `actions` | Action bar content |

Slot usage:

```html
<sherpa-panel>
  <!-- Default slot -->
  <p>Content goes here</p>
  <div slot="controls"><!-- Header control buttons --></div>
  <div slot="metadata"><!-- Metadata content area --></div>
  <div slot="actions"><!-- Action bar content --></div>
</sherpa-panel>
```

## Events

### `panel-toggle`

Fired when expanded state changes

**Propagation:** bubbles, composed

**Detail:**

```js
event.detail = {
  expanded: boolean,
};
```

```js
element.addEventListener("panel-toggle", (e) => {
  console.log(e.detail.expanded);
});
```

### `panel-close`

Fired when the close button is clicked

**Propagation:** bubbles, composed

**Detail:** none

```js
element.addEventListener("panel-close", (e) => {
  // handle event
});
```

## Internal CSS Custom Properties

These `--_` prefixed properties are used internally and can be
influenced by setting `data-*` attributes or status on ancestors:

- `--_panel-width`

## Usage

### Basic

```html
<sherpa-panel data-variant="inline" data-position="left" data-heading="value">
  <!-- Default slot content -->
  <p>Your content here</p>
  <span slot="controls"><!-- Header control buttons --></span>
  <span slot="metadata"><!-- Metadata content area --></span>
</sherpa-panel>
```

### Variants

```html
<sherpa-panel data-variant="inline"></sherpa-panel>
<sherpa-panel data-variant="overlay"></sherpa-panel>
```

## Import

```js
// Individual import
import "sherpa-ui/components/sherpa-panel/sherpa-panel.js";

// Or import everything
import "sherpa-ui";
```

## Files

| File | Purpose |
| ---- | ------- |
| [`sherpa-panel.js`](sherpa-panel.js) | Component class, lifecycle, events |
| [`sherpa-panel.css`](sherpa-panel.css) | Styles, variants, states |
| [`sherpa-panel.html`](sherpa-panel.html) | Shadow DOM template(s) |
