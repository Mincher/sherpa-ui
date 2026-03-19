# sherpa-nav-promo

> **Category:** navigation · **Base class:** SherpaElement

Promotional callout for the navigation footer. Accepts config via data attributes or imperatively via setConfig().

## Attributes

| Attribute | Type | Description | Default | Values |
| --------- | ---- | ----------- | ------- | ------ |
| `data-promo-title` | string | Promo heading text | — | — |
| `data-promo-message` | string | Promo body message | — | — |
| `data-promo-link-text` | string | CTA link label | — | — |
| `data-promo-link-url` | string | CTA link URL | — | — |
| `data-dismissed` | boolean | Whether the promo has been dismissed | — | — |

## Events

### `dismiss`


**Propagation:** bubbles, composed

**Detail:** none

```js
element.addEventListener("dismiss", (e) => {
  // handle event
});
```

## Methods

| Method | Description |
| ------ | ----------- |
| `setConfig(config)` | Set promo content: { title, message, link: { text, url } } |

### `setConfig(config)`

Set promo content: { title, message, link: { text, url } }

**Parameters:**

- `config` (`any`) — 

## Usage

### Basic

```html
<sherpa-nav-promo data-promo-title="value" data-promo-message="value" data-promo-link-text="value"></sherpa-nav-promo>
```

## Import

```js
// Individual import
import "sherpa-ui/components/sherpa-nav-promo/sherpa-nav-promo.js";

// Or import everything
import "sherpa-ui";
```

## Files

| File | Purpose |
| ---- | ------- |
| [`sherpa-nav-promo.js`](sherpa-nav-promo.js) | Component class, lifecycle, events |
| [`sherpa-nav-promo.css`](sherpa-nav-promo.css) | Styles, variants, states |
| [`sherpa-nav-promo.html`](sherpa-nav-promo.html) | Shadow DOM template(s) |
