# sherpa-ai-panel

> **Category:** core · **Base class:** SherpaElement

Standalone chrome for AI / chat surfaces.

## Attributes

| Attribute | Type | Description | Default | Values |
| --------- | ---- | ----------- | ------- | ------ |
| `data-variant` | enum | "inline" \| "overlay" (default "overlay") | — | — |
| `data-position` | enum | "left" \| "right"     (default "right") | — | — |
| `data-expanded` | boolean | Visible state. | — | — |
| `data-heading` | string | Header title (default "Ask AI"). | — | — |
| `data-width` | string | Custom width (CSS value). | — | — |
| `data-can-archive` | boolean | Enables archive button. | — | — |
| `data-busy` | boolean | Disables new-chat + archive. | — | — |

## Events

### `ai-panel-new-chat`

Fired when the "new chat" button is clicked.

**Propagation:** bubbles, composed

**Detail:** none

```js
element.addEventListener("ai-panel-new-chat", (e) => {
  // handle event
});
```

### `ai-panel-archive`

Fired when the "archive" button is clicked.

**Propagation:** bubbles, composed

**Detail:** none

```js
element.addEventListener("ai-panel-archive", (e) => {
  // handle event
});
```

### `panel-close`

Fired when the close button is clicked.

**Propagation:** bubbles, composed

**Detail:** none

```js
element.addEventListener("panel-close", (e) => {
  // handle event
});
```

### `panel-toggle`

Fired when data-expanded changes.

**Propagation:** bubbles, composed

**Detail:** none

```js
element.addEventListener("panel-toggle", (e) => {
  // handle event
});
```

## Methods

| Method | Description |
| ------ | ----------- |
| `open()` | Set data-expanded. |
| `close()` | Remove data-expanded (and dispatch panel-close). |
| `toggle()` | Toggle data-expanded. |

## Properties

| Property | Type | Description | Access |
| -------- | ---- | ----------- | ------ |
| `expanded` | `boolean` | Getter/setter for data-expanded. | read/write |

## CSS Parts

Style internal elements from outside the shadow DOM:

- `panel`
- `header`
- `title`
- `controls`
- `new-chat-btn`
- `archive-btn`
- `close-btn`
- `thread`
- `suggestions`
- `composer`
- `footer`

```css
sherpa-ai-panel::part(panel) {
  /* custom styles */
}
```

## Internal CSS Custom Properties

These `--_` prefixed properties are used internally and can be
influenced by setting `data-*` attributes or status on ancestors:

- `--_panel-width`

## Usage

### Basic

```html
<sherpa-ai-panel data-heading="value"></sherpa-ai-panel>
```

## Import

```js
// Individual import
import "sherpa-ui/components/sherpa-ai-panel/sherpa-ai-panel.js";

// Or import everything
import "sherpa-ui";
```

## Files

| File | Purpose |
| ---- | ------- |
| [`sherpa-ai-panel.js`](sherpa-ai-panel.js) | Component class, lifecycle, events |
| [`sherpa-ai-panel.css`](sherpa-ai-panel.css) | Styles, variants, states |
| [`sherpa-ai-panel.html`](sherpa-ai-panel.html) | Shadow DOM template(s) |
