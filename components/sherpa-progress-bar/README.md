# sherpa-progress-bar

> **Category:** feedback · **Base class:** SherpaElement

Horizontal progress indicator — determinate or indeterminate. Sets role="progressbar" with appropriate ARIA values.

## Attributes

| Attribute | Type | Description | Default | Values |
| --------- | ---- | ----------- | ------- | ------ |
| `data-label` | string | Task label above the bar | — | — |
| `data-value` | number | 0–100 percentage (determinate) | — | — |
| `data-variant` | enum | determinate \| indeterminate | `determinate` | `determinate`, `indeterminate` |
| `data-status-text` | string | Override auto-generated status text | — | — |

## Internal CSS Custom Properties

These `--_` prefixed properties are used internally and can be
influenced by setting `data-*` attributes or status on ancestors:

- `--_progress`
- `--_status-surface-strong`

## Usage

### Basic

```html
<sherpa-progress-bar data-label="Example Label" data-variant="determinate" data-status-text="value"></sherpa-progress-bar>
```

### Variants

```html
<sherpa-progress-bar data-variant="determinate" data-label="Determinate"></sherpa-progress-bar>
<sherpa-progress-bar data-variant="indeterminate" data-label="Indeterminate"></sherpa-progress-bar>
```

## Import

```js
// Individual import
import "sherpa-ui/components/sherpa-progress-bar/sherpa-progress-bar.js";

// Or import everything
import "sherpa-ui";
```

## Files

| File | Purpose |
| ---- | ------- |
| [`sherpa-progress-bar.js`](sherpa-progress-bar.js) | Component class, lifecycle, events |
| [`sherpa-progress-bar.css`](sherpa-progress-bar.css) | Styles, variants, states |
| [`sherpa-progress-bar.html`](sherpa-progress-bar.html) | Shadow DOM template(s) |
