# sherpa-chat-message

> **Category:** core · **Base class:** SherpaElement

Chat bubble for AI / messaging surfaces.

## Attributes

| Attribute | Type | Description | Default | Values |
| --------- | ---- | ----------- | ------- | ------ |
| `data` | enum | role         "user" \| "ai" (default "ai"). | — | — |
| `data-avatar` | string | icon  Font Awesome class for the | — | — |

## Slots

| Slot | Description |
| ---- | ----------- |
| `avatar` | Custom avatar content. Suppresses the default icon. |
| `(default)` | Bubble body content. |

Slot usage:

```html
<sherpa-chat-message>
  <!-- Default slot -->
  <p>Content goes here</p>
  <div slot="avatar"><!-- Custom avatar content. Suppresses the default icon. --></div>
</sherpa-chat-message>
```

## Properties

| Property | Type | Description | Access |
| -------- | ---- | ----------- | ------ |
| `role` | `string` | Getter/setter for data-role. | read/write |

## CSS Parts

Style internal elements from outside the shadow DOM:

- `message`
- `avatar`
- `bubble`

```css
sherpa-chat-message::part(message) {
  /* custom styles */
}
```

## Usage

### Basic

```html
<sherpa-chat-message data-avatar="value">
  <!-- Default slot content -->
  <p>Your content here</p>
  <span slot="avatar"><!-- Custom avatar content. Suppresses the default icon. --></span>
</sherpa-chat-message>
```

## Import

```js
// Individual import
import "sherpa-ui/components/sherpa-chat-message/sherpa-chat-message.js";

// Or import everything
import "sherpa-ui";
```

## Files

| File | Purpose |
| ---- | ------- |
| [`sherpa-chat-message.js`](sherpa-chat-message.js) | Component class, lifecycle, events |
| [`sherpa-chat-message.css`](sherpa-chat-message.css) | Styles, variants, states |
| [`sherpa-chat-message.html`](sherpa-chat-message.html) | Shadow DOM template(s) |
