# sherpa-list

> **Category:** core · **Base class:** SherpaElement

Grouping container for sherpa-list-item children. Provides variant + density styling, an optional heading row with actions slot, and an automatic empty-state.

## Attributes

| Attribute | Type | Description | Default | Values |
| --------- | ---- | ----------- | ------- | ------ |
| `data-variant` | enum | default \| bordered \| divided | `default` | `default`, `bordered`, `divided` |
| `data-density` | enum | compact \| default \| comfortable | `default` | `compact`, `default`, `comfortable` |
| `data-heading` | string | Optional list heading text | — | — |
| `data-empty` | string | Empty-state message (shown when no | — | — |

## Slots

| Slot | Description |
| ---- | ----------- |
| `(default)` | sherpa-list-item children |
| `actions` | Header actions (buttons / menu) |

Slot usage:

```html
<sherpa-list>
  <!-- Default slot -->
  <p>Content goes here</p>
  <div slot="actions"><!-- Header actions (buttons / menu) --></div>
</sherpa-list>
```

## Properties

| Property | Type | Description | Access |
| -------- | ---- | ----------- | ------ |
| `items` | `sherpa-list-item[]` | Live list of light-DOM list items (getter-only) | read/write |

## Internal CSS Custom Properties

These `--_` prefixed properties are used internally and can be
influenced by setting `data-*` attributes or status on ancestors:

- `--_list-gap`
- `--_list-padding`

## Usage

### Basic

```html
<sherpa-list data-variant="default" data-density="compact" data-heading="value">
  <!-- Default slot content -->
  <p>Your content here</p>
  <span slot="actions"><!-- Header actions (buttons / menu) --></span>
</sherpa-list>
```

### Variants

```html
<sherpa-list data-variant="default"></sherpa-list>
<sherpa-list data-variant="bordered"></sherpa-list>
<sherpa-list data-variant="divided"></sherpa-list>
```

## Import

```js
// Individual import
import "sherpa-ui/components/sherpa-list/sherpa-list.js";

// Or import everything
import "sherpa-ui";
```

## Files

| File | Purpose |
| ---- | ------- |
| [`sherpa-list.js`](sherpa-list.js) | Component class, lifecycle, events |
| [`sherpa-list.css`](sherpa-list.css) | Styles, variants, states |
| [`sherpa-list.html`](sherpa-list.html) | Shadow DOM template(s) |
