# sherpa-callout

> **Category:** feedback · **Base class:** SherpaElement

Inline contextual callout with status variants and expandable/dismissible body.

## Attributes

| Attribute | Type | Description | Default | Values |
| --------- | ---- | ----------- | ------- | ------ |
| `data-status` | enum | info \| warning \| critical \| success \| neutral \| tip | — | `info`, `warning`, `critical`, `success`, `neutral`, `tip` |
| `data-heading` | string | Heading text | — | — |
| `data-expanded` | boolean | Body visible | — | — |
| `data-dismissible` | boolean | Show toggle button | — | — |
| `data-icon` | string | Override status icon (FA class) | — | — |

## Slots

| Slot | Description |
| ---- | ----------- |
| `heading` | Override heading text |
| `(default)` | Body content |
| `action` | Optional action link/button |

Slot usage:

```html
<sherpa-callout>
  <!-- Default slot -->
  <p>Content goes here</p>
  <div slot="heading"><!-- Override heading text --></div>
  <div slot="action"><!-- Optional action link/button --></div>
</sherpa-callout>
```

## Events

### `callout-toggle`


**Propagation:** bubbles, composed

**Detail:**

```js
event.detail = {
  expanded: boolean,
};
```

```js
element.addEventListener("callout-toggle", (e) => {
  console.log(e.detail.expanded);
});
```

### `callout-dismiss`


**Propagation:** bubbles, composed

**Detail:** none

```js
element.addEventListener("callout-dismiss", (e) => {
  // handle event
});
```

## Methods

| Method | Description |
| ------ | ----------- |
| `toggle()` | Toggle expanded state |
| `dismiss()` | Dispatch dismiss event and remove element |

## Properties

| Property | Type | Description | Access |
| -------- | ---- | ----------- | ------ |
| `expanded` | `boolean` | Getter/setter for data-expanded | read/write |

## Internal CSS Custom Properties

These `--_` prefixed properties are used internally and can be
influenced by setting `data-*` attributes or status on ancestors:

- `--_callout-`
- `--_callout-bg`
- `--_callout-heading`
- `--_callout-icon`

## Usage

### Basic

```html
<sherpa-callout data-status="info" data-heading="value" data-icon="value">
  <!-- Default slot content -->
  <p>Your content here</p>
  <span slot="heading"><!-- Override heading text --></span>
  <span slot="action"><!-- Optional action link/button --></span>
</sherpa-callout>
```

## Import

```js
// Individual import
import "sherpa-ui/components/sherpa-callout/sherpa-callout.js";

// Or import everything
import "sherpa-ui";
```

## Files

| File | Purpose |
| ---- | ------- |
| [`sherpa-callout.js`](sherpa-callout.js) | Component class, lifecycle, events |
| [`sherpa-callout.css`](sherpa-callout.css) | Styles, variants, states |
| [`sherpa-callout.html`](sherpa-callout.html) | Shadow DOM template(s) |
