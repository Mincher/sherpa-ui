# sherpa-loader

> **Category:** core · **Base class:** SherpaElement

Animated loading indicator with spinner and optional label. Sets role="status" and aria-live="polite" on the host so assistive technology announces when the loader appears or its label changes.

## Attributes

| Attribute | Type | Description | Default | Values |
| --------- | ---- | ----------- | ------- | ------ |
| `data-label` | string | Loading text beside the spinner | — | — |
| `data-orientation` | enum | horizontal \| vertical | — | `horizontal`, `vertical` |
| `data-size` | enum | small \| default \| large | — | `small`, `default`, `large` |
| `data-panel` | boolean | Surface background panel mode | — | — |

## Internal CSS Custom Properties

These `--_` prefixed properties are used internally and can be
influenced by setting `data-*` attributes or status on ancestors:

- `--_spinner-size`
- `--_spinner-weight`
- `--_status-border`

## Usage

### Basic

```html
<sherpa-loader data-label="Example Label" data-orientation="horizontal" data-size="small"></sherpa-loader>
```

### Sizes

```html
<sherpa-loader data-size="small" data-label="Small"></sherpa-loader>
<sherpa-loader data-size="default" data-label="Default"></sherpa-loader>
<sherpa-loader data-size="large" data-label="Large"></sherpa-loader>
```

## Import

```js
// Individual import
import "sherpa-ui/components/sherpa-loader/sherpa-loader.js";

// Or import everything
import "sherpa-ui";
```

## Files

| File | Purpose |
| ---- | ------- |
| [`sherpa-loader.js`](sherpa-loader.js) | Component class, lifecycle, events |
| [`sherpa-loader.css`](sherpa-loader.css) | Styles, variants, states |
| [`sherpa-loader.html`](sherpa-loader.html) | Shadow DOM template(s) |
