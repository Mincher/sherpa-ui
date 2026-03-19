# sherpa-toast

> **Category:** feedback · **Base class:** SherpaElement

Toast notification with auto-dismiss, status variants, and static factory methods for programmatic creation.

## Attributes

| Attribute | Type | Description | Default | Values |
| --------- | ---- | ----------- | ------- | ------ |
| `data-status` | enum | info \| success \| warning \| critical \| urgent | `info` | `info`, `success`, `warning`, `critical`, `urgent` |
| `data-label` | string | Toast heading text | — | — |
| `data-value` | string | Toast message content | — | — |
| `data-duration` | number | Auto-dismiss duration in ms | `5000` | — |
| `data-timer-dismiss` | boolean | Enable auto-dismiss | — | — |
| `data-show-close` | boolean | Show close button | `true` | — |
| `data-position` | enum | top-right \| top-left \| bottom-right \| bottom-left \| top-center \| bottom-center | — | `top-right`, `top-left`, `bottom-right`, `bottom-left`, `top-center`, `bottom-center` |

## Events

### `close`


**Propagation:** bubbles, composed

**Detail:** none

```js
element.addEventListener("close", (e) => {
  // handle event
});
```

### `action`


**Propagation:** bubbles, composed

**Detail:** none

```js
element.addEventListener("action", (e) => {
  // handle event
});
```

## Methods

| Method | Description |
| ------ | ----------- |
| `show()` | Show the toast |
| `hide()` | Hide with animation and remove |
| `setAction(text, callback)` | Add action button |
| `show(options)` | Create + show toast |
| `success(value, options)` | Success toast |
| `critical(value, options)` | Critical toast |
| `warning(value, options)` | Warning toast |
| `info(value, options)` | Info toast |

### `setAction(text, callback)`

Add action button

**Parameters:**

- `text` (`any`) — 
- `callback` (`any`) — 

### `show(options)`

Create + show toast

**Parameters:**

- `options` (`any`) — 

### `success(value, options)`

Success toast

**Parameters:**

- `value` (`any`) — 
- `options` (`any`) — 

### `critical(value, options)`

Critical toast

**Parameters:**

- `value` (`any`) — 
- `options` (`any`) — 

### `warning(value, options)`

Warning toast

**Parameters:**

- `value` (`any`) — 
- `options` (`any`) — 

### `info(value, options)`

Info toast

**Parameters:**

- `value` (`any`) — 
- `options` (`any`) — 

## Internal CSS Custom Properties

These `--_` prefixed properties are used internally and can be
influenced by setting `data-*` attributes or status on ancestors:

- `--_duration`
- `--_easing`
- `--_status-border`
- `--_status-icon`
- `--_status-surface`
- `--_toast-border-thickness-left`
- `--_transform-x`
- `--_transform-y`

## Usage

### Basic

```html
<sherpa-toast data-status="info" data-label="Example Label" data-value="value"></sherpa-toast>
```

## Import

```js
// Individual import
import "sherpa-ui/components/sherpa-toast/sherpa-toast.js";

// Or import everything
import "sherpa-ui";
```

## Files

| File | Purpose |
| ---- | ------- |
| [`sherpa-toast.js`](sherpa-toast.js) | Component class, lifecycle, events |
| [`sherpa-toast.css`](sherpa-toast.css) | Styles, variants, states |
| [`sherpa-toast.html`](sherpa-toast.html) | Shadow DOM template(s) |
