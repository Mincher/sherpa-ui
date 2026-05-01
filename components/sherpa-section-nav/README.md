# sherpa-section-nav

> **Category:** core · **Base class:** SherpaElement

Secondary navigation panel: a heading with optional back button, followed by a vertical list of grouped, selectable items. Designed for Settings-style layouts where the panel sits beside a content area and switches what is rendered there.

## Attributes

| Attribute | Type | Description | Default | Values |
| --------- | ---- | ----------- | ------- | ------ |
| `data-heading` | string | Panel heading text | — | — |
| `data-show-back` | string | "true" reveals the back button | — | — |
| `data-active-id` | string | Currently active item id | — | — |
| `data-sections` | string | JSON-encoded sections array | — | — |

## Slots

| Slot | Description |
| ---- | ----------- |
| `header-end` | Trailing slot in the header (e.g. icon button) |

Slot usage:

```html
<sherpa-section-nav>
  <div slot="header-end"><!-- Trailing slot in the header (e.g. icon button) --></div>
</sherpa-section-nav>
```

## Events

### `section-nav-back`


**Propagation:** bubbles, composed

**Detail:** none

```js
element.addEventListener("section-nav-back", (e) => {
  // handle event
});
```

### `section-nav-select`


**Propagation:** bubbles, composed

**Detail:**

```js
event.detail = {
  id: string,
  item: object,
};
```

```js
element.addEventListener("section-nav-select", (e) => {
  console.log(e.detail.id);
});
```

## Methods

| Method | Description |
| ------ | ----------- |
| `setSections(sections)` | Replace the rendered groups + items |
| `setActive(id)` | Mark the item with the given id active |
| `getActiveId()` | Returns the currently active id |

### `setSections(sections)`

Replace the rendered groups + items

**Parameters:**

- `sections` (`any`) — 

### `setActive(id)`

Mark the item with the given id active

**Parameters:**

- `id` (`any`) — 

## CSS Parts

Style internal elements from outside the shadow DOM:

- `header`
- `back`
- `heading`
- `header-end`
- `sections`

```css
sherpa-section-nav::part(header) {
  /* custom styles */
}
```

## Usage

### Basic

```html
<sherpa-section-nav data-heading="value" data-show-back="value" data-active-id="value">
  <span slot="header-end"><!-- Trailing slot in the header (e.g. icon button) --></span>
</sherpa-section-nav>
```

## Import

```js
// Individual import
import "sherpa-ui/components/sherpa-section-nav/sherpa-section-nav.js";

// Or import everything
import "sherpa-ui";
```

## Files

| File | Purpose |
| ---- | ------- |
| [`sherpa-section-nav.js`](sherpa-section-nav.js) | Component class, lifecycle, events |
| [`sherpa-section-nav.css`](sherpa-section-nav.css) | Styles, variants, states |
| [`sherpa-section-nav.html`](sherpa-section-nav.html) | Shadow DOM template(s) |
