# sherpa-panel

> **Category:** container · **Base class:** SherpaElement

Inline column or overlay drawer with header, optional toolbar, optional search row, scrollable content area, and optional action-bar footer. Inline panels collapse to a narrow strip with a chevron toggle and an optional vertical restore label. Use the built-in `data-search` flag (or a `slot="search"` override) to turn the panel into a searchable list panel.

## Templates

Available templates:

- `default`
- `ai`

## Attributes

| Attribute | Type | Description | Default | Values |
| --------- | ---- | ----------- | ------- | ------ |
| `data-variant` | enum | inline \| overlay \| ai | — | `inline`, `overlay`, `ai` |
| `data-position` | enum | left \| right \| both | — | `left`, `right`, `both` |
| `data-expanded` | boolean | Expanded (visible) state | — | — |
| `data-heading` | string | Heading text | — | — |
| `data-restore-label` | string | Vertical label shown on the collapsed strip | — | — |
| `data-width` | string | Custom width (CSS value) | — | — |
| `data-bordered` | boolean | Adds a rounded outer border | — | — |
| `data-flush` | boolean | Removes content padding (slotted child owns gutters) | — | — |
| `data-search` | boolean | Renders a built-in search row and filters slotted items | — | — |
| `data-search-match` | string | CSS selector for searchable items (default: `sherpa-list-item`) | — | — |
| `data-empty` | string | Empty-state message when search yields zero matches (default: `No results`) | — | — |
| `data-can-archive` | boolean | (AI variant) Enables the archive button | — | — |
| `data-busy` | boolean | (AI variant) Disables new-chat and archive buttons | — | — |

## Slots

| Slot | Description |
| ---- | ----------- |
| `(default)` | Default slot for panel body content |
| `controls` | Header control buttons (placed before the collapse button) |
| `metadata` | Metadata row below the heading |
| `search` | Overrides the built-in search field (sherpa-input-search) |
| `toolbar` | Toolbar row between the header and the content area |
| `actions` | Action bar pinned to the bottom of the panel |
| `suggestions` | (AI variant) Prompt suggestions shown when thread is empty |
| `composer` | (AI variant) Prompt-composer pinned above the footer |
| `footer` | (AI variant) Disclaimer / branding text |

Slot usage:

```html
<sherpa-panel>
  <!-- Default slot -->
  <p>Content goes here</p>
  <div slot="controls"><!-- Header control buttons (placed before the collapse button) --></div>
  <div slot="metadata"><!-- Metadata row below the heading --></div>
  <div slot="search"><!-- Overrides the built-in search field (sherpa-input-search) --></div>
  <div slot="toolbar"><!-- Toolbar row between the header and the content area --></div>
  <div slot="actions"><!-- Action bar pinned to the bottom of the panel --></div>
  <div slot="suggestions"><!-- (AI variant) Prompt suggestions shown when thread is empty --></div>
  <div slot="composer"><!-- (AI variant) Prompt-composer pinned above the footer --></div>
  <div slot="footer"><!-- (AI variant) Disclaimer / branding text --></div>
</sherpa-panel>
```

## Events

### `panel-toggle`

Fired when expanded state changes

**Propagation:** bubbles, composed

**Detail:**

```js
event.detail = {
  expanded: boolean,
};
```

```js
element.addEventListener("panel-toggle", (e) => {
  console.log(e.detail.expanded);
});
```

### `panel-close`

Fired when the collapse / close button is clicked

**Propagation:** bubbles, composed

**Detail:** none

```js
element.addEventListener("panel-close", (e) => {
  // handle event
});
```

### `panel-search`

Fired when the search filter changes

**Propagation:** bubbles, composed

**Detail:**

```js
event.detail = {
  value: string,
  matchCount: number,
};
```

```js
element.addEventListener("panel-search", (e) => {
  console.log(e.detail.value);
});
```

### `ai-panel-new-chat`

(AI variant) New-chat button clicked

**Propagation:** bubbles, composed

**Detail:** none

```js
element.addEventListener("ai-panel-new-chat", (e) => {
  // handle event
});
```

### `ai-panel-archive`

(AI variant) Archive button clicked

**Propagation:** bubbles, composed

**Detail:** none

```js
element.addEventListener("ai-panel-archive", (e) => {
  // handle event
});
```

## Methods

| Method | Description |
| ------ | ----------- |
| `clearSearch()` | Clear the search field and reset visibility |
| `open()` | Set data-expanded (AI variant convenience) |
| `close()` | Remove data-expanded and fire panel-close |
| `toggle()` | Toggle data-expanded |

## CSS Parts

Style internal elements from outside the shadow DOM:

- `header`
- `title`
- `toolbar`
- `body`
- `empty`
- `footer`
- `new-chat-btn`
- `archive-btn`
- `thread`
- `suggestions`
- `composer`

```css
sherpa-panel::part(header) {
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
<sherpa-panel data-variant="inline" data-position="left" data-heading="value">
  <!-- Default slot content -->
  <p>Your content here</p>
  <span slot="controls"><!-- Header control buttons (placed before the collapse button) --></span>
  <span slot="metadata"><!-- Metadata row below the heading --></span>
</sherpa-panel>
```

### Variants

```html
<sherpa-panel data-variant="inline"></sherpa-panel>
<sherpa-panel data-variant="overlay"></sherpa-panel>
<sherpa-panel data-variant="ai"></sherpa-panel>
```

## Import

```js
// Individual import
import "sherpa-ui/components/sherpa-panel/sherpa-panel.js";

// Or import everything
import "sherpa-ui";
```

## Files

| File | Purpose |
| ---- | ------- |
| [`sherpa-panel.js`](sherpa-panel.js) | Component class, lifecycle, events |
| [`sherpa-panel.css`](sherpa-panel.css) | Styles, variants, states |
| [`sherpa-panel.html`](sherpa-panel.html) | Shadow DOM template(s) |
