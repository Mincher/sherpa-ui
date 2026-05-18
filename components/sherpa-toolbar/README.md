# sherpa-toolbar

> **Category:** content · **Base class:** SherpaElement

Generic horizontal toolbar with leading/center/trailing content zones and an optional filters row. Pure layout component — no data logic.

## Templates

Available templates:

- `default`
- `actions`

## Attributes

| Attribute | Type | Description | Default | Values |
| --------- | ---- | ----------- | ------- | ------ |
| `data-density` | enum | Display density variant | — | — |
| `data-template` | enum | Layout variant: default \| actions (default: default) | — | `default`, `actions` |

## Slots

| Slot | Description |
| ---- | ----------- |
| `leading` | Start zone (title, CTA buttons) |
| `center` | Center zone (search — grows to fill) |
| `trailing` | End zone (icon buttons, overflow menu) |
| `filters` | Below the toolbar row (filter bar, chips) |

Slot usage:

```html
<sherpa-toolbar>
  <div slot="leading"><!-- Start zone (title, CTA buttons) --></div>
  <div slot="center"><!-- Center zone (search — grows to fill) --></div>
  <div slot="trailing"><!-- End zone (icon buttons, overflow menu) --></div>
  <div slot="filters"><!-- Below the toolbar row (filter bar, chips) --></div>
</sherpa-toolbar>
```

## CSS Parts

Style internal elements from outside the shadow DOM:

- `toolbar`
- `filters`

```css
sherpa-toolbar::part(toolbar) {
  /* custom styles */
}
```

## Internal CSS Custom Properties

These `--_` prefixed properties are used internally and can be
influenced by setting `data-*` attributes or status on ancestors:

- `--_toolbar-gap`
- `--_toolbar-px`
- `--_toolbar-py`

## Usage

### Basic

```html
<sherpa-toolbar data-template="default">
  <span slot="leading"><!-- Start zone (title, CTA buttons) --></span>
  <span slot="center"><!-- Center zone (search — grows to fill) --></span>
</sherpa-toolbar>
```

## Import

```js
// Individual import
import "sherpa-ui/components/sherpa-toolbar/sherpa-toolbar.js";

// Or import everything
import "sherpa-ui";
```

## Files

| File | Purpose |
| ---- | ------- |
| [`sherpa-toolbar.js`](sherpa-toolbar.js) | Component class, lifecycle, events |
| [`sherpa-toolbar.css`](sherpa-toolbar.css) | Styles, variants, states |
| [`sherpa-toolbar.html`](sherpa-toolbar.html) | Shadow DOM template(s) |
