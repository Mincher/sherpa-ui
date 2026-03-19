# sherpa-tag

> **Category:** core · **Base class:** SherpaElement

Compact label component with variant and status support.

## Attributes

| Attribute | Type | Description | Default | Values |
| --------- | ---- | ----------- | ------- | ------ |
| `data-variant` | enum | primary \| secondary | — | `primary`, `secondary` |
| `data-status` | enum | critical \| info \| success \| warning \| urgent | — | `critical`, `info`, `success`, `warning`, `urgent` |
| `data-collapsed` | boolean | Renders as small circular indicator | — | — |

## Slots

| Slot | Description |
| ---- | ----------- |
| `(default)` | Default slot for tag label content |

Slot usage:

```html
<sherpa-tag>
  <!-- Default slot -->
  <p>Content goes here</p>
</sherpa-tag>
```

## CSS Parts

Style internal elements from outside the shadow DOM:

- `tag`
- `close`

```css
sherpa-tag::part(tag) {
  /* custom styles */
}
```

## Internal CSS Custom Properties

These `--_` prefixed properties are used internally and can be
influenced by setting `data-*` attributes or status on ancestors:

- `--_status-`
- `--_status-border`
- `--_status-surface`
- `--_status-text`
- `--_tag-border-default`
- `--_tag-border-rounding`
- `--_tag-fill-solid-bg`
- `--_tag-fill-transparent-bg`
- `--_tag-text-default`
- `--_tag-text-on-transparent`

## Usage

### Basic

```html
<sherpa-tag data-variant="primary" data-status="critical">
  <!-- Default slot content -->
  <p>Your content here</p>
</sherpa-tag>
```

### Variants

```html
<sherpa-tag data-variant="primary"></sherpa-tag>
<sherpa-tag data-variant="secondary"></sherpa-tag>
```

## Import

```js
// Individual import
import "sherpa-ui/components/sherpa-tag/sherpa-tag.js";

// Or import everything
import "sherpa-ui";
```

## Files

| File | Purpose |
| ---- | ------- |
| [`sherpa-tag.js`](sherpa-tag.js) | Component class, lifecycle, events |
| [`sherpa-tag.css`](sherpa-tag.css) | Styles, variants, states |
| [`sherpa-tag.html`](sherpa-tag.html) | Shadow DOM template(s) |
