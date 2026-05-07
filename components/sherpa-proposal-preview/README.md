# sherpa-proposal-preview

> **Category:** core · **Base class:** SherpaElement

Agent proposal renderer.

## Attributes

| Attribute | Type | Description | Default | Values |
| --------- | ---- | ----------- | ------- | ------ |
| `data-rationale` | string | Italic rationale shown above the ops. | — | — |

## Slots

| Slot | Description |
| ---- | ----------- |
| `ops` | One <sherpa-proposal-op> per change. |
| `raw` | Raw proposal payload (typically a <pre>). |
| `decision` | Decision controls (typically <sherpa-button> trio). |

Slot usage:

```html
<sherpa-proposal-preview>
  <div slot="ops"><!-- One <sherpa-proposal-op> per change. --></div>
  <div slot="raw"><!-- Raw proposal payload (typically a <pre>). --></div>
  <div slot="decision"><!-- Decision controls (typically <sherpa-button> trio). --></div>
</sherpa-proposal-preview>
```

## Properties

| Property | Type | Description | Access |
| -------- | ---- | ----------- | ------ |
| `rationale` | `string` | Getter/setter for data-rationale. | read/write |

## CSS Parts

Style internal elements from outside the shadow DOM:

- `proposal`
- `rationale`
- `ops`
- `raw`
- `decision`

```css
sherpa-proposal-preview::part(proposal) {
  /* custom styles */
}
```

## Usage

### Basic

```html
<sherpa-proposal-preview data-rationale="value">
  <span slot="ops"><!-- One <sherpa-proposal-op> per change. --></span>
  <span slot="raw"><!-- Raw proposal payload (typically a <pre>). --></span>
</sherpa-proposal-preview>
```

## Import

```js
// Individual import
import "sherpa-ui/components/sherpa-proposal-preview/sherpa-proposal-preview.js";

// Or import everything
import "sherpa-ui";
```

## Files

| File | Purpose |
| ---- | ------- |
| [`sherpa-proposal-preview.js`](sherpa-proposal-preview.js) | Component class, lifecycle, events |
| [`sherpa-proposal-preview.css`](sherpa-proposal-preview.css) | Styles, variants, states |
| [`sherpa-proposal-preview.html`](sherpa-proposal-preview.html) | Shadow DOM template(s) |
