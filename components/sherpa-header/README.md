# sherpa-header

> **Category:** container · **Base class:** SherpaElement

Header row for sherpa-container. Renders title, description, and optional action buttons (drag handle, open-external, overflow menu). Built to be slotted as a light-DOM child of sherpa-container, but works inside any host element. Events from the embedded sherpa-button (menu-open, menu-close, buttonclick) bubble and compose out of the header's shadow DOM and continue through its host into any ancestor — no re-dispatching required.

## Attributes

| Attribute | Type | Description | Default | Values |
| --------- | ---- | ----------- | ------- | ------ |
| `data-title` | string | Heading text | — | — |
| `data-description` | string | Secondary text (hidden when empty) | — | — |
| `data-open-external` | boolean | Show the open-external button | — | — |
| `data-menu-button` | boolean | Show the overflow menu button | — | — |
| `data-drag-handle` | boolean | Show the drag handle | — | — |
| `data-src-html` | string |  | — | — |
| `data-src-json` | string |  | — | — |

## Internal CSS Custom Properties

These `--_` prefixed properties are used internally and can be
influenced by setting `data-*` attributes or status on ancestors:

- `--_selected-text`

## Usage

### Basic

```html
<sherpa-header data-title="Example Title" data-description="A brief description" data-src-html="value"></sherpa-header>
```

## Import

```js
// Individual import
import "sherpa-ui/components/sherpa-header/sherpa-header.js";

// Or import everything
import "sherpa-ui";
```

## Files

| File | Purpose |
| ---- | ------- |
| [`sherpa-header.js`](sherpa-header.js) | Component class, lifecycle, events |
| [`sherpa-header.css`](sherpa-header.css) | Styles, variants, states |
| [`sherpa-header.html`](sherpa-header.html) | Shadow DOM template(s) |
