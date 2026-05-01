# sherpa-container

> **Category:** core · **Base class:** SherpaElement

Pure wrapper container for dashboard composition. Owns sizing (variant, col/row span) and exposes a named container query scope (`sherpa-container`) so descendant viz components (charts, grids) can adapt their internal layout via container queries.

## Attributes

| Attribute | Type | Description | Default | Values |
| --------- | ---- | ----------- | ------- | ------ |
| `data-variant` | enum | fit \| resizable \| fill | `fit` | `fit`, `resizable`, `fill` |
| `data-col-span` | number | Column span: 3 \| 6 \| 9 \| 12 (resizable) | — | — |
| `data-row-span` | number | Row span: 1–6 (resizable) | — | — |
| `data-editable` | boolean | Edit mode (enables resize grip) | — | — |
| `data-menu-open` | boolean | Reflected while a descendant menu is open | — | — |

## Slots

| Slot | Description |
| ---- | ----------- |
| `(default)` | Consumer composition: sherpa-container-header, |

Slot usage:

```html
<sherpa-container>
  <!-- Default slot -->
  <p>Content goes here</p>
</sherpa-container>
```

## Events

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

## Internal CSS Custom Properties

These `--_` prefixed properties are used internally and can be
influenced by setting `data-*` attributes or status on ancestors:

- `--_editable-display`

## Usage

### Basic

```html
<sherpa-container data-variant="fit">
  <!-- Default slot content -->
  <p>Your content here</p>
</sherpa-container>
```

### Variants

```html
<sherpa-container data-variant="fit"></sherpa-container>
<sherpa-container data-variant="resizable"></sherpa-container>
<sherpa-container data-variant="fill"></sherpa-container>
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
