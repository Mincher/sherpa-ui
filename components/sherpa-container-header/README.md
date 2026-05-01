# sherpa-container-header

> **Category:** core · **Base class:** SherpaElement

Header row for sherpa-container. Renders title, description, and optional action buttons (drag handle, open-external, overflow menu). Built to be slotted as a light-DOM child of sherpa-container, but works inside any host element. Events from the embedded sherpa-button (menu-open, menu-close, buttonclick) bubble and compose out of the header's shadow DOM and continue through its host into any ancestor — no re-dispatching required.

## Attributes

| Attribute | Type | Description | Default | Values |
| --------- | ---- | ----------- | ------- | ------ |
| `data-title` | string | Heading text | — | — |
| `data-description` | string | Secondary text (hidden when empty) | — | — |
| `data-open-external` | boolean | Show the open-external button | — | — |
| `data-menu-button` | boolean | Show the overflow menu button | — | — |
| `data-drag-handle` | boolean | Show the drag handle | — | — |

## Usage

### Basic

```html
<sherpa-container-header data-title="Example Title" data-description="A brief description"></sherpa-container-header>
```

## Import

```js
// Individual import
import "sherpa-ui/components/sherpa-container-header/sherpa-container-header.js";

// Or import everything
import "sherpa-ui";
```

## Files

| File | Purpose |
| ---- | ------- |
| [`sherpa-container-header.js`](sherpa-container-header.js) | Component class, lifecycle, events |
| [`sherpa-container-header.css`](sherpa-container-header.css) | Styles, variants, states |
| [`sherpa-container-header.html`](sherpa-container-header.html) | Shadow DOM template(s) |
