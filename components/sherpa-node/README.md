# sherpa-node

> **Category:** core · **Base class:** SherpaElement

sherpa-node.js — Host element for a node-graph node. Mirrors data-x / data-y attributes to the --sherpa-node-x/y CSS vars so position is purely declarative and animatable. Exposes getPortPositions() so the host canvas can measure where each socket lives in node-local coordinates (unscaled, top-left origin). Sub-type system: • data-subtypes — JSON array [{value,label}] populates a built-in <select> beneath the header. • data-subtype — Currently-selected sub-type. • Light-DOM <template class="rows-tpl" data-kind="…" data-subtype="…"> children act as row-prototypes. On subtype change the matching template's content is cloned into light DOM, replacing any rows that came from a previous template clone (those are tagged data-template-row).

## Attributes

| Attribute | Type | Description | Default | Values |
| --------- | ---- | ----------- | ------- | ------ |
| `data-kind` | enum | One of: source \| group \| variable \| math \| | — | `source`, `group`, `variable`, `math` |
| `data-selected` | boolean | Highlights the node | — | — |
| `data-x` | number | X position in canvas-local px | — | — |
| `data-y` | number | Y position in canvas-local px | — | — |
| `data-w` | number | Width override in px (default 240) | — | — |
| `data-node-id` | string | Stable node identifier | — | — |
| `data-subtypes` | json | Array<{value,label}>; shows the dropdown | — | — |
| `data-subtype` | string | Current sub-type value | — | — |

## Slots

| Slot | Description |
| ---- | ----------- |
| `header` | A <sherpa-node-header> |
| `(default)` | Default: zero or more <sherpa-node-row>s plus optional |
| `footer` | Optional footer |

Slot usage:

```html
<sherpa-node>
  <!-- Default slot -->
  <p>Content goes here</p>
  <div slot="header"><!-- A <sherpa-node-header> --></div>
  <div slot="footer"><!-- Optional footer --></div>
</sherpa-node>
```

## Events

### `sherpa-node-pointerdown`


**Propagation:** bubbles, composed

**Detail:** none

```js
element.addEventListener("sherpa-node-pointerdown", (e) => {
  // handle event
});
```

### `sherpa-node-subtype-change`


**Propagation:** bubbles, composed

**Detail:** none

```js
element.addEventListener("sherpa-node-subtype-change", (e) => {
  // handle event
});
```

## Usage

### Basic

```html
<sherpa-node data-kind="source" data-node-id="value" data-subtype="value">
  <!-- Default slot content -->
  <p>Your content here</p>
  <span slot="header"><!-- A <sherpa-node-header> --></span>
  <span slot="footer"><!-- Optional footer --></span>
</sherpa-node>
```

## Import

```js
// Individual import
import "sherpa-ui/components/sherpa-node/sherpa-node.js";

// Or import everything
import "sherpa-ui";
```

## Files

| File | Purpose |
| ---- | ------- |
| [`sherpa-node.js`](sherpa-node.js) | Component class, lifecycle, events |
| [`sherpa-node.css`](sherpa-node.css) | Styles, variants, states |
| [`sherpa-node.html`](sherpa-node.html) | Shadow DOM template(s) |
