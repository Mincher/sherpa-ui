# sherpa-icon

> **Category:** media · **Base class:** SherpaElement

Atomic icon primitive. Renders either a Font Awesome glyph (default template) or a registered inline SVG (svg template). Replaces the ad-hoc `<i class="fa-... sherpa-icon">` pattern used elsewhere in the library and gives consumers a single, declarative way to reference icons by name.

## Templates

Available templates:

- `default`
- `svg`

## Attributes

| Attribute | Type | Description | Default | Values |
| --------- | ---- | ----------- | ------- | ------ |
| `name` | string | Icon identifier. If `SherpaIcon.register(name, svg)` | — | — |
| `data-weight` | enum | solid (default) \| regular \| light \| thin \| duotone \| brands | — | `regular`, `light`, `thin`, `duotone`, `brands` |
| `data-size` | enum | 3xs \| 2xs \| xs \| sm \| md \| lg \| xl \| 2xl \| 3xl \| 4xl \| 5xl \| 6xl | — | `3xs`, `2xs`, `xs`, `sm`, `md`, `lg`, `xl`, `2xl`, `3xl`, `4xl`, `5xl`, `6xl` |
| `data-status` | enum | critical \| warning \| success \| info \| urgent \| brand | — | `critical`, `warning`, `success`, `info`, `urgent`, `brand` |

## Methods

| Method | Description |
| ------ | ----------- |
| `static register(name, svgString) — Register a custom inline SVG icon.` |  |
| `static has(name)                  — Check whether a name is registered.` |  |
| `static unregister(name)            — Remove a registered icon.` |  |

## Properties

| Property | Type | Description | Access |
| -------- | ---- | ----------- | ------ |
| `name` | `string` | Mirrors the `name` attribute (read/write) | read/write |
| `weight` | `string` | Mirrors `data-weight` (read/write) | read/write |

## Internal CSS Custom Properties

These `--_` prefixed properties are used internally and can be
influenced by setting `data-*` attributes or status on ancestors:

- `--_status-text-`
- `--_status-text-strong`

## Usage

### Basic

```html
<sherpa-icon name="value" data-weight="regular" data-size="3xs"></sherpa-icon>
```

### Sizes

```html
<sherpa-icon data-size="3xs"></sherpa-icon>
<sherpa-icon data-size="2xs"></sherpa-icon>
<sherpa-icon data-size="xs"></sherpa-icon>
<sherpa-icon data-size="sm"></sherpa-icon>
<sherpa-icon data-size="md"></sherpa-icon>
<sherpa-icon data-size="lg"></sherpa-icon>
<sherpa-icon data-size="xl"></sherpa-icon>
<sherpa-icon data-size="2xl"></sherpa-icon>
<sherpa-icon data-size="3xl"></sherpa-icon>
<sherpa-icon data-size="4xl"></sherpa-icon>
<sherpa-icon data-size="5xl"></sherpa-icon>
<sherpa-icon data-size="6xl"></sherpa-icon>
```

## Import

```js
// Individual import
import "sherpa-ui/components/sherpa-icon/sherpa-icon.js";

// Or import everything
import "sherpa-ui";
```

## Files

| File | Purpose |
| ---- | ------- |
| [`sherpa-icon.js`](sherpa-icon.js) | Component class, lifecycle, events |
| [`sherpa-icon.css`](sherpa-icon.css) | Styles, variants, states |
| [`sherpa-icon.html`](sherpa-icon.html) | Shadow DOM template(s) |
