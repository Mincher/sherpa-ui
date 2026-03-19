# sherpa-popover

> **Category:** core · **Base class:** SherpaElement

General-purpose floating content container with header.

## Attributes

| Attribute | Type | Description | Default | Values |
| --------- | ---- | ----------- | ------- | ------ |
| `data-heading` | string | Header title text | — | — |
| `data-open` | boolean | Shows the popover | — | — |
| `data-anchor` | string | CSS anchor name to position against | — | — |
| `data-position` | enum | top \| bottom \| left \| right | — | `top`, `bottom`, `left`, `right` |

## Slots

| Slot | Description |
| ---- | ----------- |
| `(default)` | Default slot for body content |
| `icon` | Header icon slot |
| `header-end` | Header trailing content slot |

Slot usage:

```html
<sherpa-popover>
  <!-- Default slot -->
  <p>Content goes here</p>
  <div slot="icon"><!-- Header icon slot --></div>
  <div slot="header-end"><!-- Header trailing content slot --></div>
</sherpa-popover>
```

## Events

### `popover-close`

Fired when close button or click-outside dismisses

**Propagation:** bubbles, composed

**Detail:** none

```js
element.addEventListener("popover-close", (e) => {
  // handle event
});
```

## Internal CSS Custom Properties

These `--_` prefixed properties are used internally and can be
influenced by setting `data-*` attributes or status on ancestors:

- `--_popover-anchor`

## Usage

### Basic

```html
<sherpa-popover data-heading="value" data-anchor="value" data-position="top">
  <!-- Default slot content -->
  <p>Your content here</p>
  <span slot="icon"><!-- Header icon slot --></span>
  <span slot="header-end"><!-- Header trailing content slot --></span>
</sherpa-popover>
```

## Import

```js
// Individual import
import "sherpa-ui/components/sherpa-popover/sherpa-popover.js";

// Or import everything
import "sherpa-ui";
```

## Files

| File | Purpose |
| ---- | ------- |
| [`sherpa-popover.js`](sherpa-popover.js) | Component class, lifecycle, events |
| [`sherpa-popover.css`](sherpa-popover.css) | Styles, variants, states |
| [`sherpa-popover.html`](sherpa-popover.html) | Shadow DOM template(s) |
