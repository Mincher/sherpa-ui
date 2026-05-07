# sherpa-prompt-composer

> **Category:** core · **Base class:** SherpaElement

Auto-growing prompt textarea with circular send button. Designed for AI / chat surfaces.

## Attributes

| Attribute | Type | Description | Default | Values |
| --------- | ---- | ----------- | ------- | ------ |
| `data-placeholder` | string | Placeholder text. | — | — |
| `data-disabled` | boolean | Disables input + send. | — | — |
| `data-max-height` | number | Max textarea height in px (default 160). | — | — |

## Events

### `prompt-submit`

Fired on submit (Enter or send button) when

**Propagation:** bubbles

**Detail:** none

```js
element.addEventListener("prompt-submit", (e) => {
  // handle event
});
```

## Methods

| Method | Description |
| ------ | ----------- |
| `focus()` | Focus the textarea. |
| `clear()` | Clear and reset the textarea height. |
| `setBusy(boolean)` | Toggle disabled state. |

### `setBusy(boolean)`

Toggle disabled state.

**Parameters:**

- `boolean` (`any`) — 

## Properties

| Property | Type | Description | Access |
| -------- | ---- | ----------- | ------ |
| `value` | `string` | Current textarea value. | read/write |

## CSS Parts

Style internal elements from outside the shadow DOM:

- `composer`
- `input`
- `send`

```css
sherpa-prompt-composer::part(composer) {
  /* custom styles */
}
```

## Internal CSS Custom Properties

These `--_` prefixed properties are used internally and can be
influenced by setting `data-*` attributes or status on ancestors:

- `--_max-height`

## Usage

### Basic

```html
<sherpa-prompt-composer data-placeholder="value"></sherpa-prompt-composer>
```

## Import

```js
// Individual import
import "sherpa-ui/components/sherpa-prompt-composer/sherpa-prompt-composer.js";

// Or import everything
import "sherpa-ui";
```

## Files

| File | Purpose |
| ---- | ------- |
| [`sherpa-prompt-composer.js`](sherpa-prompt-composer.js) | Component class, lifecycle, events |
| [`sherpa-prompt-composer.css`](sherpa-prompt-composer.css) | Styles, variants, states |
| [`sherpa-prompt-composer.html`](sherpa-prompt-composer.html) | Shadow DOM template(s) |
