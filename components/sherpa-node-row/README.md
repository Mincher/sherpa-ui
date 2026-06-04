# sherpa-node-row

> **Category:** content · **Base class:** SherpaElement

sherpa-node-row.js — Unified row component for sherpa-node. Handles both header rows and body rows via data-variant attribute. Pure layout component. Holds slots; emits events only for header actions. Slot presence is auto-mirrored on the host as data-has-{slotname} via SherpaElement's default onSlotChange handler.

## Attributes

| Attribute | Type | Description | Default | Values |
| --------- | ---- | ----------- | ------- | ------ |
| `data-variant` | enum | "header" \| "body" (default: "body") | — | — |
| `data-multi` | boolean | Visually expand for multi-input rows | — | — |
| `data-icon` | string | FontAwesome class for built-in icon (header variant only) | — | — |
| `data-drill-down` | boolean | Show drill-down button (header variant only) | — | — |

## Slots

| Slot | Description |
| ---- | ----------- |
| `icon` | Custom leading icon (header variant only, overrides data-icon) |
| `title` | Header title text (header variant) |
| `actions` | Trailing icons/buttons (header variant) |
| `label` | Field label (body variant) |
| `control` | Input/select/chip group (body variant) |
| `helper` | Optional helper text (body variant) |
| `input-socket` | Slot in the LEFT gutter |
| `output-socket` | Slot in the RIGHT gutter |

Slot usage:

```html
<sherpa-node-row>
  <div slot="icon"><!-- Custom leading icon (header variant only, overrides data-icon) --></div>
  <div slot="title"><!-- Header title text (header variant) --></div>
  <div slot="actions"><!-- Trailing icons/buttons (header variant) --></div>
  <div slot="label"><!-- Field label (body variant) --></div>
  <div slot="control"><!-- Input/select/chip group (body variant) --></div>
  <div slot="helper"><!-- Optional helper text (body variant) --></div>
  <div slot="input-socket"><!-- Slot in the LEFT gutter --></div>
  <div slot="output-socket"><!-- Slot in the RIGHT gutter --></div>
</sherpa-node-row>
```

## Events

### `sherpa-node-drilldown (header variant only)`


**Propagation:** bubbles, composed

**Detail:** none

```js
element.addEventListener("sherpa-node-drilldown (header variant only)", (e) => {
  // handle event
});
```

## Usage

### Basic

```html
<sherpa-node-row data-icon="value">
  <span slot="icon"><!-- Custom leading icon (header variant only, overrides data-icon) --></span>
  <span slot="title"><!-- Header title text (header variant) --></span>
</sherpa-node-row>
```

## Import

```js
// Individual import
import "sherpa-ui/components/sherpa-node-row/sherpa-node-row.js";

// Or import everything
import "sherpa-ui";
```

## Files

| File | Purpose |
| ---- | ------- |
| [`sherpa-node-row.js`](sherpa-node-row.js) | Component class, lifecycle, events |
| [`sherpa-node-row.css`](sherpa-node-row.css) | Styles, variants, states |
| [`sherpa-node-row.html`](sherpa-node-row.html) | Shadow DOM template(s) |
