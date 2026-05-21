# sherpa-container

> **Category:** container · **Base class:** SherpaElement

Universal container for dashboard composition and standalone card layouts. Owns sizing variants, a named container query scope, state overlays (loading/empty/error), optional interactivity and selection state.

## Attributes

| Attribute | Type | Description | Default | Values |
| --------- | ---- | ----------- | ------- | ------ |
| `data-variant` | enum | fit \| resizable \| fill \| worksheet | `fit` | `fit`, `resizable`, `fill`, `worksheet` |
| `data-col-span` | number | Column span: 3 \| 6 \| 9 \| 12 (resizable) | — | — |
| `data-row-span` | number | Row span: 1–6 (resizable) | — | — |
| `data-editable` | boolean | Edit mode (enables resize grip) | — | — |
| `data-menu-open` | boolean | Reflected while a descendant menu is open | — | — |
| `data-state` | enum | ready \| loading \| empty \| error | — | `ready`, `loading`, `empty`, `error` |
| `data-interactive` | boolean | Makes the container a clickable surface | — | — |
| `data-selectable` | boolean | Makes the container a selectable radio option | — | — |
| `data-selected` | boolean | Selected / active state | — | — |
| `data-elevation` | enum | none \| sm \| md \| lg | — | `none`, `sm`, `md`, `lg` |
| `disabled` | boolean | Native disabled state | — | — |
| `data-src-html` | string |  | — | — |
| `data-src-json` | string |  | — | — |

## Slots

| Slot | Description |
| ---- | ----------- |
| `(default)` | Main content (dashboard children or card body) |
| `header` | Card-style header (use sherpa-header); edge-to-edge with separator |
| `footer` | Card-style footer (use sherpa-footer or sherpa-button) |
| `loading` | Shown when data-state="loading" |
| `empty` | Shown when data-state="empty" |
| `error` | Shown when data-state="error" |

Slot usage:

```html
<sherpa-container>
  <!-- Default slot -->
  <p>Content goes here</p>
  <div slot="header"><!-- Card-style header (use sherpa-header); edge-to-edge with separator --></div>
  <div slot="footer"><!-- Card-style footer (use sherpa-footer or sherpa-button) --></div>
  <div slot="loading"><!-- Shown when data-state="loading" --></div>
  <div slot="empty"><!-- Shown when data-state="empty" --></div>
  <div slot="error"><!-- Shown when data-state="error" --></div>
</sherpa-container>
```

## Events

### `card-click`

Fired when an interactive container is clicked or keyboard-activated

**Propagation:** bubbles, composed

**Detail:** none

```js
element.addEventListener("card-click", (e) => {
  // handle event
});
```

### `card-select`

Fired when a selectable container's selection changes

**Propagation:** bubbles, composed

**Detail:**

```js
event.detail = {
  selected: boolean,
};
```

```js
element.addEventListener("card-select", (e) => {
  console.log(e.detail.selected);
});
```

### `container-increase-cols`

Bubbled from injected resize menu items

**Propagation:** bubbles

**Detail:** none

```js
element.addEventListener("container-increase-cols", (e) => {
  // handle event
});
```

### `container-decrease-cols`

Bubbled from injected resize menu items

**Propagation:** bubbles

**Detail:** none

```js
element.addEventListener("container-decrease-cols", (e) => {
  // handle event
});
```

### `container-increase-rows`

Bubbled from injected resize menu items

**Propagation:** bubbles

**Detail:** none

```js
element.addEventListener("container-increase-rows", (e) => {
  // handle event
});
```

### `container-decrease-rows`

Bubbled from injected resize menu items

**Propagation:** bubbles

**Detail:** none

```js
element.addEventListener("container-decrease-rows", (e) => {
  // handle event
});
```

## Properties

| Property | Type | Description | Access |
| -------- | ---- | ----------- | ------ |
| `selected` | `boolean` | Selected state (read/write) | read/write |
| `interactive` | `boolean` | Clickable state (read/write) | read/write |
| `selectable` | `boolean` | Selectable state (read/write) | read/write |
| `disabled` | `boolean` | Disabled state (read/write) | read/write |
| `elevation` | `string` | Shadow level (read/write) | read/write |

## CSS Parts

Style internal elements from outside the shadow DOM:

- `header`
- `content`

```css
sherpa-container::part(header) {
  /* custom styles */
}
```

## Internal CSS Custom Properties

These `--_` prefixed properties are used internally and can be
influenced by setting `data-*` attributes or status on ancestors:

- `--_editable-display`
- `--_selected-border`
- `--_selected-surface`
- `--_selected-text`
- `--_status-border`

## Usage

### Basic

```html
<sherpa-container data-variant="fit" data-state="ready" data-elevation="none">
  <!-- Default slot content -->
  <p>Your content here</p>
  <span slot="header"><!-- Card-style header (use sherpa-header); edge-to-edge with separator --></span>
  <span slot="footer"><!-- Card-style footer (use sherpa-footer or sherpa-button) --></span>
</sherpa-container>
```

### Variants

```html
<sherpa-container data-variant="fit"></sherpa-container>
<sherpa-container data-variant="resizable"></sherpa-container>
<sherpa-container data-variant="fill"></sherpa-container>
<sherpa-container data-variant="worksheet"></sherpa-container>
```

### Disabled

```html
<sherpa-container disabled></sherpa-container>
```

## Import

```js
// Individual import
import "sherpa-ui/components/sherpa-container/sherpa-container.js";

// Or import everything
import "sherpa-ui";
```

## Files

| File | Purpose |
| ---- | ------- |
| [`sherpa-container.js`](sherpa-container.js) | Component class, lifecycle, events |
| [`sherpa-container.css`](sherpa-container.css) | Styles, variants, states |
| [`sherpa-container.html`](sherpa-container.html) | Shadow DOM template(s) |
