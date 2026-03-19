# sherpa-tooltip

> **Category:** core · **Base class:** SherpaElement

Singleton tooltip with CSS anchor positioning fallback. Operates as a singleton: one tooltip instance shared across the page. Use the exported Tooltip API or declarative data-tooltip attributes.

## Attributes

| Attribute | Type | Description | Default | Values |
| --------- | ---- | ----------- | ------- | ------ |
| `data-visible` | boolean | Whether the tooltip is currently shown | — | — |
| `data-position` | enum | top \| bottom \| left \| right | — | `top`, `bottom`, `left`, `right` |

## Methods

| Method | Description |
| ------ | ----------- |
| `setText(text)` | Set tooltip content text |
| `getText()` | Get current tooltip text |
| `setPosition(pos)` | Set preferred position |
| `getPosition()` | Get current position |
| `setVisible(visible)` | Show or hide the tooltip |
| `isVisible()` | Check if tooltip is shown |
| `showFor(anchor, text, options)` | Position and show for an anchor element |
| `hide()` | Hide the tooltip |

### `setText(text)`

Set tooltip content text

**Parameters:**

- `text` (`any`) — 

### `setPosition(pos)`

Set preferred position

**Parameters:**

- `pos` (`any`) — 

### `setVisible(visible)`

Show or hide the tooltip

**Parameters:**

- `visible` (`any`) — 

### `showFor(anchor, text, options)`

Position and show for an anchor element

**Parameters:**

- `anchor` (`any`) — 
- `text` (`any`) — 
- `options` (`any`) — 

## Usage

### Basic

```html
<sherpa-tooltip data-position="top"></sherpa-tooltip>
```

## Import

```js
// Individual import
import "sherpa-ui/components/sherpa-tooltip/sherpa-tooltip.js";

// Or import everything
import "sherpa-ui";
```

## Files

| File | Purpose |
| ---- | ------- |
| [`sherpa-tooltip.js`](sherpa-tooltip.js) | Component class, lifecycle, events |
| [`sherpa-tooltip.css`](sherpa-tooltip.css) | Styles, variants, states |
| [`sherpa-tooltip.html`](sherpa-tooltip.html) | Shadow DOM template(s) |
