# sherpa-section-header

> **Category:** page-level · **Base class:** SherpaElement

Section heading with slots for badge, description, and actions.

## Attributes

| Attribute | Type | Description | Default | Values |
| --------- | ---- | ----------- | ------- | ------ |
| `data-label` | string | Section title text | — | — |
| `data-heading-level` | enum | primary \| secondary \| tertiary | — | `primary`, `secondary`, `tertiary` |
| `data-divider` | boolean | Show bottom divider | — | — |

## Slots

| Slot | Description |
| ---- | ----------- |
| `heading` | Custom heading element (replaces default) |
| `badge` | Badge/tag next to heading |
| `description` | Description text below heading |
| `actions` | Action buttons on the right side |

Slot usage:

```html
<sherpa-section-header>
  <div slot="heading"><!-- Custom heading element (replaces default) --></div>
  <div slot="badge"><!-- Badge/tag next to heading --></div>
  <div slot="description"><!-- Description text below heading --></div>
  <div slot="actions"><!-- Action buttons on the right side --></div>
</sherpa-section-header>
```

## Properties

| Property | Type | Description | Access |
| -------- | ---- | ----------- | ------ |
| `heading` | `string` | Getter/setter for data-label | read/write |
| `headingType` | `string` | Getter/setter for data-heading-level | read/write |
| `hasDivider` | `boolean` | Getter/setter for data-divider | read/write |

## CSS Parts

Style internal elements from outside the shadow DOM:

- `container`
- `content`
- `left`
- `heading-row`
- `badge`
- `description`
- `actions`
- `divider`

```css
sherpa-section-header::part(container) {
  /* custom styles */
}
```

## Internal CSS Custom Properties

These `--_` prefixed properties are used internally and can be
influenced by setting `data-*` attributes or status on ancestors:

- `--_content-gap`
- `--_heading-color`
- `--_heading-font-size`
- `--_heading-letter-spacing`
- `--_heading-line-height`
- `--_heading-text-transform`

## Usage

### Basic

```html
<sherpa-section-header data-label="Example Label" data-heading-level="primary">
  <span slot="heading"><!-- Custom heading element (replaces default) --></span>
  <span slot="badge"><!-- Badge/tag next to heading --></span>
</sherpa-section-header>
```

## Import

```js
// Individual import
import "sherpa-ui/components/sherpa-section-header/sherpa-section-header.js";

// Or import everything
import "sherpa-ui";
```

## Files

| File | Purpose |
| ---- | ------- |
| [`sherpa-section-header.js`](sherpa-section-header.js) | Component class, lifecycle, events |
| [`sherpa-section-header.css`](sherpa-section-header.css) | Styles, variants, states |
| [`sherpa-section-header.html`](sherpa-section-header.html) | Shadow DOM template(s) |
