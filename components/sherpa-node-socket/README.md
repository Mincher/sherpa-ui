# sherpa-node-socket

> **Category:** core · **Base class:** SherpaElement

sherpa-node-socket.js — Connection-point primitive for sherpa-node. Pure presentational element. Emits a single high-level event on pointerdown so the canvas/connection-manager can drive drag-to-connect.

## Attributes

| Attribute | Type | Description | Default | Values |
| --------- | ---- | ----------- | ------- | ------ |
| `data-direction` | enum | "in" \| "out" | — | — |
| `data-location` | enum | "header" \| "row" (auto-set by parent slot) | — | — |
| `data-multi` | boolean | Input accepts multiple connections | — | — |
| `data-connected` | boolean | Filled with accent color | — | — |
| `data-port-name` | string | Port identifier | — | — |
| `data-status` | enum | "default" \| "true" \| "false" | — | — |
| `data-connection-count` | number | Set by canvas; drives multi-input height growth | — | — |

## Events

### `sherpa-socket-pointerdown`


**Propagation:** bubbles, composed

**Detail:** none

```js
element.addEventListener("sherpa-socket-pointerdown", (e) => {
  // handle event
});
```

## Internal CSS Custom Properties

These `--_` prefixed properties are used internally and can be
influenced by setting `data-*` attributes or status on ancestors:

- `--_count`
- `--_socket-fill`
- `--_socket-stroke`

## Usage

### Basic

```html
<sherpa-node-socket data-port-name="value"></sherpa-node-socket>
```

## Import

```js
// Individual import
import "sherpa-ui/components/sherpa-node-socket/sherpa-node-socket.js";

// Or import everything
import "sherpa-ui";
```

## Files

| File | Purpose |
| ---- | ------- |
| [`sherpa-node-socket.js`](sherpa-node-socket.js) | Component class, lifecycle, events |
| [`sherpa-node-socket.css`](sherpa-node-socket.css) | Styles, variants, states |
| [`sherpa-node-socket.html`](sherpa-node-socket.html) | Shadow DOM template(s) |
