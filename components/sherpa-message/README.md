# sherpa-message

> **Category:** feedback · **Base class:** SherpaElement

Alert / notification message with status variants.

## Attributes

| Attribute | Type | Description | Default | Values |
| --------- | ---- | ----------- | ------- | ------ |
| `data-status` | enum | success \| critical \| warning \| info \| urgent | — | `success`, `critical`, `warning`, `info`, `urgent` |
| `data-dismissible` | boolean | Show close button | — | — |

## Slots

| Slot | Description |
| ---- | ----------- |
| `heading` | Optional heading text |
| `(default)` | Message content |
| `action` | Action link or button |

Slot usage:

```html
<sherpa-message>
  <!-- Default slot -->
  <p>Content goes here</p>
  <div slot="heading"><!-- Optional heading text --></div>
  <div slot="action"><!-- Action link or button --></div>
</sherpa-message>
```

## Events

### `close`


**Propagation:** bubbles, composed

**Detail:** none

```js
element.addEventListener("close", (e) => {
  // handle event
});
```

## Methods

| Method | Description |
| ------ | ----------- |
| `dismiss()` | Dispatch close event and remove element |

## Properties

| Property | Type | Description | Access |
| -------- | ---- | ----------- | ------ |
| `status` | `string` | Getter/setter for data-status | read/write |
| `dismissible` | `boolean` | Getter/setter for data-dismissible | read/write |

## CSS Parts

Style internal elements from outside the shadow DOM:

- `icon`
- `content`
- `heading`
- `body`
- `action`
- `close`

```css
sherpa-message::part(icon) {
  /* custom styles */
}
```

## Internal CSS Custom Properties

These `--_` prefixed properties are used internally and can be
influenced by setting `data-*` attributes or status on ancestors:

- `--_gap`
- `--_link-color`
- `--_padding-block`
- `--_padding-inline`
- `--_status-border`
- `--_status-icon`
- `--_status-surface`
- `--_text-font-size`

## Usage

### Basic

```html
<sherpa-message data-status="success">
  <!-- Default slot content -->
  <p>Your content here</p>
  <span slot="heading"><!-- Optional heading text --></span>
  <span slot="action"><!-- Action link or button --></span>
</sherpa-message>
```

## Import

```js
// Individual import
import "sherpa-ui/components/sherpa-message/sherpa-message.js";

// Or import everything
import "sherpa-ui";
```

## Files

| File | Purpose |
| ---- | ------- |
| [`sherpa-message.js`](sherpa-message.js) | Component class, lifecycle, events |
| [`sherpa-message.css`](sherpa-message.css) | Styles, variants, states |
| [`sherpa-message.html`](sherpa-message.html) | Shadow DOM template(s) |
