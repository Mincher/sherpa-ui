# sherpa-node-header

> **Category:** core · **Base class:** SherpaElement

sherpa-node-header.js — 48-tall header for sherpa-node. Provides: • Built-in icon shorthand via data-icon="fa-..." (FontAwesome class) • Built-in drill-down button via data-drill-down (used by Group nodes) • Auto-tags slotted sockets with data-location="header" so their CSS picks the correct shape from the locked matrix.

## Attributes

| Attribute | Type | Description | Default | Values |
| --------- | ---- | ----------- | ------- | ------ |
| `data-icon` | string | FontAwesome class (e.g. "fa-solid fa-cube") | — | — |
| `data-drill-down` | boolean | Show built-in drill-down button | — | — |

## Slots

| Slot | Description |
| ---- | ----------- |
| `icon` | Custom leading icon (overrides data-icon) |
| `title` | Header title text |
| `actions` | Trailing icons/buttons |
| `input-socket` | Slot in left gutter (control-flow input) |
| `output-socket` | Slot in right gutter (control-flow output) |

Slot usage:

```html
<sherpa-node-header>
  <div slot="icon"><!-- Custom leading icon (overrides data-icon) --></div>
  <div slot="title"><!-- Header title text --></div>
  <div slot="actions"><!-- Trailing icons/buttons --></div>
  <div slot="input-socket"><!-- Slot in left gutter (control-flow input) --></div>
  <div slot="output-socket"><!-- Slot in right gutter (control-flow output) --></div>
</sherpa-node-header>
```

## Events

### `sherpa-node-drilldown`


**Propagation:** bubbles, composed

**Detail:** none

```js
element.addEventListener("sherpa-node-drilldown", (e) => {
  // handle event
});
```

## Usage

### Basic

```html
<sherpa-node-header data-icon="value">
  <span slot="icon"><!-- Custom leading icon (overrides data-icon) --></span>
  <span slot="title"><!-- Header title text --></span>
</sherpa-node-header>
```

## Import

```js
// Individual import
import "sherpa-ui/components/sherpa-node-header/sherpa-node-header.js";

// Or import everything
import "sherpa-ui";
```

## Files

| File | Purpose |
| ---- | ------- |
| [`sherpa-node-header.js`](sherpa-node-header.js) | Component class, lifecycle, events |
| [`sherpa-node-header.css`](sherpa-node-header.css) | Styles, variants, states |
| [`sherpa-node-header.html`](sherpa-node-header.html) | Shadow DOM template(s) |
