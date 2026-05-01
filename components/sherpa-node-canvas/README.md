# sherpa-node-canvas

> **Category:** core · **Base class:** SherpaElement

sherpa-node-canvas.js — Pan/zoom canvas hosting sherpa-node children. Owns: - viewport {x, y, zoom}: pan via middle-mouse OR space+left-drag, zoom via wheel (cursor-anchored, clamp 0.1–2.5). - edges: Array<{ from:{nodeId,portName}, to:{nodeId,portName}, control?:boolean }> rendered as bezier curves. - drag-to-connect: pointerdown on a slotted <sherpa-node-socket> starts an edge drag; pointerup over another socket completes it. - drag-to-redirect: pointerdown on an input socket that already has edge(s) picks up the end nearest the click. Drop on empty space deletes; drop on another valid socket updates. - hover/select state for edges (token-coloured), with hit-testing via 32-segment bezier polyline + 6 px perpendicular threshold. - multi-input sockets: connection count is mirrored to data-connection-count on the socket; endpoints are spaced evenly across the socket's vertical extent. - crosshair grid drawn beneath edges.

## Attributes

| Attribute | Type | Description | Default | Values |
| --------- | ---- | ----------- | ------- | ------ |
| `data-grid` | enum | "crosshair" (default) \| "none" | — | — |

## Events

### `sherpa-edge-create`


**Propagation:** bubbles, composed

**Detail:**

```js
event.detail = {
  from: {nodeId,
  to: {nodeId,
  control: boolean,
};
```

```js
element.addEventListener("sherpa-edge-create", (e) => {
  console.log(e.detail.from);
});
```

### `sherpa-edge-update`


**Propagation:** bubbles, composed

**Detail:** none

```js
element.addEventListener("sherpa-edge-update", (e) => {
  // handle event
});
```

### `sherpa-edge-delete`


**Propagation:** bubbles, composed

**Detail:** none

```js
element.addEventListener("sherpa-edge-delete", (e) => {
  // handle event
});
```

### `sherpa-edge-select`


**Propagation:** bubbles, composed

**Detail:** none

```js
element.addEventListener("sherpa-edge-select", (e) => {
  // handle event
});
```

### `sherpa-viewport-change`


**Propagation:** bubbles, composed

**Detail:** none

```js
element.addEventListener("sherpa-viewport-change", (e) => {
  // handle event
});
```

## Usage

### Basic

```html
<sherpa-node-canvas></sherpa-node-canvas>
```

## Import

```js
// Individual import
import "sherpa-ui/components/sherpa-node-canvas/sherpa-node-canvas.js";

// Or import everything
import "sherpa-ui";
```

## Files

| File | Purpose |
| ---- | ------- |
| [`sherpa-node-canvas.js`](sherpa-node-canvas.js) | Component class, lifecycle, events |
| [`sherpa-node-canvas.css`](sherpa-node-canvas.css) | Styles, variants, states |
| [`sherpa-node-canvas.html`](sherpa-node-canvas.html) | Shadow DOM template(s) |
