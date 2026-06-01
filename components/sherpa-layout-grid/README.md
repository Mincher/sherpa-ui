# sherpa-layout-grid

> **Category:** shell · **Base class:** SherpaElement

Responsive dashboard grid. Slotted <sherpa-container data-variant="resizable"> children take grid spans from their data-col-span / data-row-span attributes.

## Attributes

| Attribute | Type | Description | Default | Values |
| --------- | ---- | ----------- | ------- | ------ |
| `data-row-height` | string | CSS length for grid-auto-rows (default: 160px) | — | — |
| `data-content` | enum | "static" — opts out of grid; stacks children | — | — |
| `data-editable` | boolean | Enables drag-to-reposition for slotted containers | — | — |
| `data-heading` | string | Heading text shown on the grid header strip | — | — |
| `data-export-title` | string | Title used when exporting the grid (PDF / image) | — | — |

## Slots

| Slot | Description |
| ---- | ----------- |
| `(default)` | sherpa-container children |

Slot usage:

```html
<sherpa-layout-grid>
  <!-- Default slot -->
  <p>Content goes here</p>
</sherpa-layout-grid>
```

## Events

### `layout-reorder`

Fires after a successful reposition.

**Propagation:** bubbles, composed

**Detail:**

```js
event.detail = {
  from: number,
  to: number,
  order: string[] }  // order is the,
};
```

```js
element.addEventListener("layout-reorder", (e) => {
  console.log(e.detail.from);
});
```

## CSS Parts

Style internal elements from outside the shadow DOM:

- `header`
- `surface`

```css
sherpa-layout-grid::part(header) {
  /* custom styles */
}
```

## Usage

### Basic

```html
<sherpa-layout-grid data-row-height="value" data-heading="value">
  <!-- Default slot content -->
  <p>Your content here</p>
</sherpa-layout-grid>
```

## Import

```js
// Individual import
import "sherpa-ui/components/sherpa-layout-grid/sherpa-layout-grid.js";

// Or import everything
import "sherpa-ui";
```

## Files

| File | Purpose |
| ---- | ------- |
| [`sherpa-layout-grid.js`](sherpa-layout-grid.js) | Component class, lifecycle, events |
| [`sherpa-layout-grid.css`](sherpa-layout-grid.css) | Styles, variants, states |
| [`sherpa-layout-grid.html`](sherpa-layout-grid.html) | Shadow DOM template(s) |
