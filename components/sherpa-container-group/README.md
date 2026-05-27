# sherpa-container-group

> **Category:** container · **Base class:** SherpaElement

Subgrid tile cluster for sherpa-layout-grid. Wraps a set of <sherpa-container> tiles inside a <sherpa-layout-grid>, so they render as a single bordered region with seamless internal alignment to the parent grid's column tracks. The host element IS the subgrid container — slotted children participate in the host's grid via slot transparency. Border and corner clipping are owned by the component's CSS. Group title: the FIRST slotted <sherpa-container>'s own <sherpa-container-header> acts as the title for the whole group. The group labels each tile with a managed `data-group-position` attribute (`first` | `follow`). Follower tiles' header content is visually muted (visibility: hidden) while the header band keeps its natural height — so every tile's content baseline aligns across rows. See sherpa-container.css / sherpa-container-header.css for the visual mechanism (cascaded --_cg-header-vis / --_cg-header-sep). Cascading custom properties set on :host (inherit through shadow DOM into slotted light-DOM children): --_cg-border-width: 0 → child containers render borderless --_cg-border-radius: 0 → child containers render without corner rounding Usage: <sherpa-layout-grid> <sherpa-container-group data-col-span="12"> <sherpa-container data-col-span="3"> <sherpa-container-header slot="header" data-title="KPIs"></sherpa-container-header> … </sherpa-container> <sherpa-container data-col-span="3">…</sherpa-container> <sherpa-container data-col-span="3">…</sherpa-container> <sherpa-container data-col-span="3">…</sherpa-container> </sherpa-container-group> </sherpa-layout-grid> Only meaningful as a direct child of <sherpa-layout-grid> — subgrid requires the host to be a grid item of a CSS grid container.

## Attributes

| Attribute | Type | Description | Default | Values |
| --------- | ---- | ----------- | ------- | ------ |
| `data-col-span` | enum | 2 \| 3 \| 4 \| 6 \| 8 \| 9 \| 12 — span across | — | `2`, `3`, `4`, `6`, `8`, `9`, `12` |
| `data-row-span` | number | Automatically computed and written | — | — |
| `data-src-html` | string |  | — | — |
| `data-src-json` | string |  | — | — |

## Slots

| Slot | Description |
| ---- | ----------- |
| `(default)` | One or more <sherpa-container> tiles. Each may carry |

Slot usage:

```html
<sherpa-container-group>
  <!-- Default slot -->
  <p>Content goes here</p>
</sherpa-container-group>
```

## Internal CSS Custom Properties

These `--_` prefixed properties are used internally and can be
influenced by setting `data-*` attributes or status on ancestors:

- `--_cg-border-radius`
- `--_cg-border-width`
- `--_cg-header-sep`
- `--_cg-header-vis`

## Usage

### Basic

```html
<sherpa-container-group data-col-span="2" data-src-html="value" data-src-json="value">
  <!-- Default slot content -->
  <p>Your content here</p>
</sherpa-container-group>
```

## Import

```js
// Individual import
import "sherpa-ui/components/sherpa-container-group/sherpa-container-group.js";

// Or import everything
import "sherpa-ui";
```

## Files

| File | Purpose |
| ---- | ------- |
| [`sherpa-container-group.js`](sherpa-container-group.js) | Component class, lifecycle, events |
| [`sherpa-container-group.css`](sherpa-container-group.css) | Styles, variants, states |
| [`sherpa-container-group.html`](sherpa-container-group.html) | Shadow DOM template(s) |
