# sherpa-node

> **Category:** content · **Base class:** SherpaElement

sherpa-node.js — Host element for a node-graph node. Mirrors data-x / data-y attributes to the --sherpa-node-x/y CSS vars so position is purely declarative and animatable. Exposes getPortPositions() so the host canvas can measure where each socket lives in node-local coordinates (unscaled, top-left origin). Sub-type system: • data-subtypes — JSON. Either a flat array [{value,label}] or a grouped array [{label, options:[{value,label}]}]. Grouped form renders <optgroup>s in the picker (e.g. "Preset" vs "Custom"). • data-subtype — Currently-selected sub-type value. • Light-DOM <template class="rows-tpl" data-kind="…" data-subtype="…"> children act as row-prototypes. On subtype change the matching template's content is cloned into light DOM, replacing any rows that came from a previous template clone (those are tagged data-template-row). Custom subtypes (consumer contract): The "Custom" group is a hook for consumers to inject saved-graph entries (e.g. user-saved subgraphs). Consumers populate it by overwriting data-subtypes with their own grouped JSON, e.g. node.dataset["subtypes"] = JSON.stringify([ { label: "Preset", options: presetSubtypes }, { label: "Custom", options: [ { value: "saved:abc123", label: "Monitor CPU usage" }, ]}, ]); When the user picks a "Custom" entry, the consumer should listen for sherpa-node-subtype-change, and — if the value matches a saved group — replace the source node with a `group`-kind node at the same position/id, then push the saved subgraph into it via canvas.pushSubgraph(). sherpa-ui ships only the picker mechanism; the saved-groups registry is the consumer's concern.

## Attributes

| Attribute | Type | Description | Default | Values |
| --------- | ---- | ----------- | ------- | ------ |
| `data-kind` | enum | One of: source \| group \| variable \| math \| | — | `source`, `group`, `variable`, `math` |
| `data-selected` | boolean | Highlights the node | — | — |
| `data-x` | number | X position in canvas-local px | — | — |
| `data-y` | number | Y position in canvas-local px | — | — |
| `data-w` | number | Optional min-width in px. Nodes are | — | — |
| `data-node-id` | string | Stable node identifier | — | — |
| `data-subtypes` | json | Flat Array<{value,label}> OR grouped | — | — |
| `data-subtype` | string | Current sub-type value | — | — |
| `data-subtype-label` | string | Optional label override displayed on the | — | — |

## Slots

| Slot | Description |
| ---- | ----------- |
| `header` | A <sherpa-node-row data-variant="header"> |
| `(default)` | Default: zero or more <sherpa-node-row>s (body variant) plus optional |
| `footer` | Optional footer |

Slot usage:

```html
<sherpa-node>
  <!-- Default slot -->
  <p>Content goes here</p>
  <div slot="header"><!-- A <sherpa-node-row data-variant="header"> --></div>
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

## Internal CSS Custom Properties

These `--_` prefixed properties are used internally and can be
influenced by setting `data-*` attributes or status on ancestors:

- `--_node-accent`

## Usage

### Basic

```html
<sherpa-node data-kind="source" data-node-id="value" data-subtype="value">
  <!-- Default slot content -->
  <p>Your content here</p>
  <span slot="header"><!-- A <sherpa-node-row data-variant="header"> --></span>
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
