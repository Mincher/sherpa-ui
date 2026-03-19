# sherpa-data-viz-container

> **Category:** data-viz · **Base class:** SherpaElement

Dashboard card with header, metrics, and content area. Content-agnostic — never imports or creates viz components directly. Resize support via ResizeBehavior mixin.

## Templates

Available templates:

- `default`
- `filter-menu`

## Attributes

| Attribute | Type | Description | Default | Values |
| --------- | ---- | ----------- | ------- | ------ |
| `data-variant` | enum | fit \| resizable \| fill (default: fit) | — | `fit`, `resizable`, `fill` |
| `data-title` | string | Container heading text | — | — |
| `data-description` | string | Container description | — | — |
| `data-col-span` | number | Column span: 3 \| 6 \| 9 \| 12 (resizable) | — | — |
| `data-row-span` | number | Row span: 1–6 (resizable) | — | — |
| `data-menu-open` | boolean | Menu state | — | — |
| `data-editable` | boolean | Edit mode (enables resize grip) | — | — |
| `data-open-external` | boolean | Show open-external button | — | — |
| `data-menu-button` | boolean | Show menu button | — | — |
| `data-drag-handle` | boolean | Show drag handle | — | — |

## Slots

| Slot | Description |
| ---- | ----------- |
| `(default)` | Consumer content: sherpa-metric children + viz children |

Slot usage:

```html
<sherpa-data-viz-container>
  <!-- Default slot -->
  <p>Content goes here</p>
</sherpa-data-viz-container>
```

## Internal CSS Custom Properties

These `--_` prefixed properties are used internally and can be
influenced by setting `data-*` attributes or status on ancestors:

- `--_chart-direction`
- `--_chart-legend-align`
- `--_chart-legend-direction`
- `--_chart-legend-justify`
- `--_chart-legend-margin-top`
- `--_chart-legend-width`
- `--_chart-legend-wrap`
- `--_editable-display`

## Usage

### Basic

```html
<sherpa-data-viz-container data-variant="fit" data-title="Example Title" data-description="A brief description">
  <!-- Default slot content -->
  <p>Your content here</p>
</sherpa-data-viz-container>
```

### Variants

```html
<sherpa-data-viz-container data-variant="fit"></sherpa-data-viz-container>
<sherpa-data-viz-container data-variant="resizable"></sherpa-data-viz-container>
<sherpa-data-viz-container data-variant="fill"></sherpa-data-viz-container>
```

## Import

```js
// Individual import
import "sherpa-ui/components/sherpa-data-viz-container/sherpa-data-viz-container.js";

// Or import everything
import "sherpa-ui";
```

## Files

| File | Purpose |
| ---- | ------- |
| [`sherpa-data-viz-container.js`](sherpa-data-viz-container.js) | Component class, lifecycle, events |
| [`sherpa-data-viz-container.css`](sherpa-data-viz-container.css) | Styles, variants, states |
| [`sherpa-data-viz-container.html`](sherpa-data-viz-container.html) | Shadow DOM template(s) |
