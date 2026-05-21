# sherpa-message

> **Category:** feedback · **Base class:** SherpaElement

Banner / inline message with status variants.

## Attributes

| Attribute | Type | Description | Default | Values |
| --------- | ---- | ----------- | ------- | ------ |
| `data-status` | enum | success \| critical \| warning \| info \| urgent | — | `success`, `critical`, `warning`, `info`, `urgent` |
| `data-label` | string | Message text | — | — |
| `data-action-label` | string | Inline action link text | — | — |
| `data-action-href` | string | Inline action link href | — | — |
| `data-action-icon` | string | FA classes for trailing link icon | — | — |
| `data-dismissible` | boolean | Show close button | — | — |
| `data-src-html` | string |  | — | — |
| `data-src-json` | string |  | — | — |

## Events

### `close`


**Propagation:** bubbles, composed

**Detail:** none

```js
element.addEventListener("close", (e) => {
  // handle event
});
```

### `action`


**Propagation:** bubbles, composed

**Detail:**

```js
event.detail = {
  href: string,
};
```

```js
element.addEventListener("action", (e) => {
  console.log(e.detail.href);
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
- `label`
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
- `--_padding-block`
- `--_padding-inline`
- `--_status-`
- `--_status-border`
- `--_status-surface-strong`
- `--_status-surface-subtle`
- `--_text-font-size`

## Usage

### Basic

```html
<sherpa-message data-status="success" data-label="Example Label" data-action-label="value"></sherpa-message>
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
