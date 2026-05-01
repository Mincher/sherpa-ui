# sherpa-node-row

> **Category:** core · **Base class:** SherpaElement

sherpa-node-row.js — Generic field row for sherpa-node bodies. Pure layout component. Holds slots; emits no events. Slot presence is auto-mirrored on the host as data-has-{slotname} via SherpaElement's default onSlotChange handler.

## Attributes

| Attribute | Type | Description | Default | Values |
| --------- | ---- | ----------- | ------- | ------ |
| `data-multi` | boolean | Visually expand for multi-input rows | — | — |

## Slots

| Slot | Description |
| ---- | ----------- |
| `label` | Field label |
| `control` | Input/select/chip group |
| `helper` | Optional helper text |
| `input-socket` | Slot in the LEFT gutter |
| `output-socket` | Slot in the RIGHT gutter |

Slot usage:

```html
<sherpa-node-row>
  <div slot="label"><!-- Field label --></div>
  <div slot="control"><!-- Input/select/chip group --></div>
  <div slot="helper"><!-- Optional helper text --></div>
  <div slot="input-socket"><!-- Slot in the LEFT gutter --></div>
  <div slot="output-socket"><!-- Slot in the RIGHT gutter --></div>
</sherpa-node-row>
```

## Usage

### Basic

```html
<sherpa-node-row>
  <span slot="label"><!-- Field label --></span>
  <span slot="control"><!-- Input/select/chip group --></span>
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
