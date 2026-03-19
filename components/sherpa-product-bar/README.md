# sherpa-product-bar

> **Category:** navigation · **Base class:** SherpaElement

Top-level product branding bar with icon, name, navigation, and actions.

## Attributes

| Attribute | Type | Description | Default | Values |
| --------- | ---- | ----------- | ------- | ------ |
| `data-product-name` | string | Product display name | — | — |
| `data-product-icon` | string | Font Awesome icon class (e.g. "fa-cube") | — | — |

## Slots

| Slot | Description |
| ---- | ----------- |
| `icon` | Custom product icon content |
| `(default)` | Navigation items |
| `actions` | Right-aligned action buttons |

Slot usage:

```html
<sherpa-product-bar>
  <!-- Default slot -->
  <p>Content goes here</p>
  <div slot="icon"><!-- Custom product icon content --></div>
  <div slot="actions"><!-- Right-aligned action buttons --></div>
</sherpa-product-bar>
```

## Usage

### Basic

```html
<sherpa-product-bar data-product-name="value" data-product-icon="value">
  <!-- Default slot content -->
  <p>Your content here</p>
  <span slot="icon"><!-- Custom product icon content --></span>
  <span slot="actions"><!-- Right-aligned action buttons --></span>
</sherpa-product-bar>
```

## Import

```js
// Individual import
import "sherpa-ui/components/sherpa-product-bar/sherpa-product-bar.js";

// Or import everything
import "sherpa-ui";
```

## Files

| File | Purpose |
| ---- | ------- |
| [`sherpa-product-bar.js`](sherpa-product-bar.js) | Component class, lifecycle, events |
| [`sherpa-product-bar.css`](sherpa-product-bar.css) | Styles, variants, states |
| [`sherpa-product-bar.html`](sherpa-product-bar.html) | Shadow DOM template(s) |
