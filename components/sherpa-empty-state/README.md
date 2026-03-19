# sherpa-empty-state

> **Category:** data-display · **Base class:** SherpaElement

Empty-state placeholder with illustration, heading, description, and action slots.

## Attributes

| Attribute | Type | Description | Default | Values |
| --------- | ---- | ----------- | ------- | ------ |
| `data-label` | string | Heading text | — | — |
| `data-description` | string | Description text | — | — |
| `data-illustration` | string | Built-in illustration name | — | — |
| `data-small-print` | string | Footer small-print text | — | — |

## Slots

| Slot | Description |
| ---- | ----------- |
| `illustration` | Custom illustration content |
| `heading` | Custom heading |
| `description` | Custom description |
| `(default)` | Arbitrary content between description and actions |
| `actions` | CTA buttons |
| `footer` | Footer content / small print |

Slot usage:

```html
<sherpa-empty-state>
  <!-- Default slot -->
  <p>Content goes here</p>
  <div slot="illustration"><!-- Custom illustration content --></div>
  <div slot="heading"><!-- Custom heading --></div>
  <div slot="description"><!-- Custom description --></div>
  <div slot="actions"><!-- CTA buttons --></div>
  <div slot="footer"><!-- Footer content / small print --></div>
</sherpa-empty-state>
```

## Properties

| Property | Type | Description | Access |
| -------- | ---- | ----------- | ------ |
| `heading` | `string` | Getter/setter for data-label | read/write |
| `description` | `string` | Getter/setter for data-description | read/write |
| `illustration` | `string` | Getter/setter for data-illustration | read/write |
| `smallPrint` | `string` | Getter/setter for data-small-print | read/write |

## Internal CSS Custom Properties

These `--_` prefixed properties are used internally and can be
influenced by setting `data-*` attributes or status on ancestors:

- `--_status-icon`

## Usage

### Basic

```html
<sherpa-empty-state data-label="Example Label" data-description="A brief description" data-illustration="value">
  <!-- Default slot content -->
  <p>Your content here</p>
  <span slot="illustration"><!-- Custom illustration content --></span>
  <span slot="heading"><!-- Custom heading --></span>
</sherpa-empty-state>
```

## Import

```js
// Individual import
import "sherpa-ui/components/sherpa-empty-state/sherpa-empty-state.js";

// Or import everything
import "sherpa-ui";
```

## Files

| File | Purpose |
| ---- | ------- |
| [`sherpa-empty-state.js`](sherpa-empty-state.js) | Component class, lifecycle, events |
| [`sherpa-empty-state.css`](sherpa-empty-state.css) | Styles, variants, states |
| [`sherpa-empty-state.html`](sherpa-empty-state.html) | Shadow DOM template(s) |
