# sherpa-list

> **Category:** core · **Base class:** SherpaElement

Grouping container for sherpa-list-item children. Provides variant + density styling, an optional heading row with actions slot, and an automatic empty-state.

## Attributes

| Attribute | Type | Description | Default | Values |
| --------- | ---- | ----------- | ------- | ------ |
| `data` | enum | variant=default]   default \| bordered \| divided | — | `default`, `bordered`, `divided` |
| `data` | enum | density=default]   compact \| default \| comfortable | — | `compact`, `default`, `comfortable` |
| `data` | string | heading]           Optional list heading text | — | — |
| `data` | string | empty]             Empty-state message (shown when no | — | — |

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
<sherpa-list data="default" data="compact" data="value">
  <!-- Default slot content -->
  <p>Your content here</p>
  <span slot="actions"><!-- Header actions (buttons / menu) --></span>
</sherpa-list>
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
