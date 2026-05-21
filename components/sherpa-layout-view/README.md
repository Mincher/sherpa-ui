# sherpa-layout-view

> **Category:** shell · **Base class:** SherpaElement

Body-content view layout. An embedded <sherpa-view-header> sits at the top, optional left/right side rails flank a scrollable content column. The whole region is bounded to the viewport height by default so the rails stay anchored and only the content column scrolls.

## Attributes

| Attribute | Type | Description | Default | Values |
| --------- | ---- | ----------- | ------- | ------ |
| `data-heading` | string | Header title (shown when present) | — | — |
| `data-export-title` | string | Forwarded to embedded view-header | — | — |
| `data-fill` | enum | viewport \| parent | `viewport` | `viewport`, `parent` |
| `data-pad` | boolean | Apply padding inside the content column | — | — |
| `data-gap` | enum | sm \| base \| lg — gap between | — | `sm`, `base`, `lg` |
| `data-src-html` | string |  | — | — |
| `data-src-json` | string |  | — | — |

## Slots

| Slot | Description |
| ---- | ----------- |
| `(default)` | Body content (stacked vertically) |
| `header-actions` | Forwarded to the embedded view-header's |
| `side-panel-start` | Leading rail (typically sherpa-panel) |
| `side-panel-end` | Trailing rail (typically sherpa-panel) |

Slot usage:

```html
<sherpa-layout-view>
  <!-- Default slot -->
  <p>Content goes here</p>
  <div slot="header-actions"><!-- Forwarded to the embedded view-header's --></div>
  <div slot="side-panel-start"><!-- Leading rail (typically sherpa-panel) --></div>
  <div slot="side-panel-end"><!-- Trailing rail (typically sherpa-panel) --></div>
</sherpa-layout-view>
```

## CSS Parts

Style internal elements from outside the shadow DOM:

- `header`
- `body`
- `content`

```css
sherpa-layout-view::part(header) {
  /* custom styles */
}
```

## Usage

### Basic

```html
<sherpa-layout-view data-heading="value" data-export-title="value" data-fill="viewport">
  <!-- Default slot content -->
  <p>Your content here</p>
  <span slot="header-actions"><!-- Forwarded to the embedded view-header's --></span>
  <span slot="side-panel-start"><!-- Leading rail (typically sherpa-panel) --></span>
</sherpa-layout-view>
```

## Import

```js
// Individual import
import "sherpa-ui/components/sherpa-layout-view/sherpa-layout-view.js";

// Or import everything
import "sherpa-ui";
```

## Files

| File | Purpose |
| ---- | ------- |
| [`sherpa-layout-view.js`](sherpa-layout-view.js) | Component class, lifecycle, events |
| [`sherpa-layout-view.css`](sherpa-layout-view.css) | Styles, variants, states |
| [`sherpa-layout-view.html`](sherpa-layout-view.html) | Shadow DOM template(s) |
