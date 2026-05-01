# sherpa-product-bar-v2

> **Category:** core · **Base class:** SherpaElement

Light-themed product bar (Apr 2026 redesign). System name trigger + time, optional tabs, central search, right-aligned actions.

## Attributes

| Attribute | Type | Description | Default | Values |
| --------- | ---- | ----------- | ------- | ------ |
| `data-product-name` | string | System / product display name | — | — |
| `data-time` | string | Time string ("09:00") | — | — |
| `data-show-system` | string | "false" hides the brand stack | — | — |
| `data-show-time` | string | "false" hides the time line | — | — |

## Slots

| Slot | Description |
| ---- | ----------- |
| `tabs` | Optional product sub-nav (sets data-has-tabs when populated) |
| `search` | Search control; falls back to a default sherpa-input-search |
| `actions` | Right-aligned icon buttons + Ask N-zo entry point |

Slot usage:

```html
<sherpa-product-bar-v2>
  <div slot="tabs"><!-- Optional product sub-nav (sets data-has-tabs when populated) --></div>
  <div slot="search"><!-- Search control; falls back to a default sherpa-input-search --></div>
  <div slot="actions"><!-- Right-aligned icon buttons + Ask N-zo entry point --></div>
</sherpa-product-bar-v2>
```

## Events

### `systemtriggerclick`


**Propagation:** bubbles, composed

**Detail:**

```js
event.detail = {
  name: string,
};
```

```js
element.addEventListener("systemtriggerclick", (e) => {
  console.log(e.detail.name);
});
```

## CSS Parts

Style internal elements from outside the shadow DOM:

- `brand`
- `tabs`
- `search`
- `actions`

```css
sherpa-product-bar-v2::part(brand) {
  /* custom styles */
}
```

## Usage

### Basic

```html
<sherpa-product-bar-v2 data-product-name="value" data-time="value" data-show-system="value">
  <span slot="tabs"><!-- Optional product sub-nav (sets data-has-tabs when populated) --></span>
  <span slot="search"><!-- Search control; falls back to a default sherpa-input-search --></span>
</sherpa-product-bar-v2>
```

## Import

```js
// Individual import
import "sherpa-ui/components/sherpa-product-bar-v2/sherpa-product-bar-v2.js";

// Or import everything
import "sherpa-ui";
```

## Files

| File | Purpose |
| ---- | ------- |
| [`sherpa-product-bar-v2.js`](sherpa-product-bar-v2.js) | Component class, lifecycle, events |
| [`sherpa-product-bar-v2.css`](sherpa-product-bar-v2.css) | Styles, variants, states |
| [`sherpa-product-bar-v2.html`](sherpa-product-bar-v2.html) | Shadow DOM template(s) |
