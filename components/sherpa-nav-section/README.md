# sherpa-nav-section

> **Category:** nav · **Base class:** SherpaElement

Secondary navigation panel: a heading with optional back button, followed by a vertical list of grouped, selectable items. Designed for Settings-style layouts where the panel sits beside a content area and switches what is rendered there.

## Attributes

| Attribute | Type | Description | Default | Values |
| --------- | ---- | ----------- | ------- | ------ |
| `data-heading` | string | Panel heading text | — | — |
| `data-show-back` | string | "true" reveals the back button | — | — |
| `data-active-id` | string | Currently active item id | — | — |
| `data-sections` | string | JSON-encoded sections array | — | — |
| `data-src-html` | string |  | — | — |
| `data-src-json` | string |  | — | — |

## Slots

| Slot | Description |
| ---- | ----------- |
| `header-end` | Trailing slot in the header (e.g. icon button) |

Slot usage:

```html
<sherpa-nav-section>
  <div slot="header-end"><!-- Trailing slot in the header (e.g. icon button) --></div>
</sherpa-nav-section>
```

## Events

### `nav-section-back`


**Propagation:** bubbles, composed

**Detail:** none

```js
element.addEventListener("nav-section-back", (e) => {
  // handle event
});
```

### `nav-section-select`


**Propagation:** bubbles, composed

**Detail:**

```js
event.detail = {
  id: string,
  item: object,
};
```

```js
element.addEventListener("nav-section-select", (e) => {
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
sherpa-nav-section::part(header) {
  /* custom styles */
}
```

## Usage

### Basic

```html
<sherpa-nav-section data-heading="value" data-show-back="value" data-active-id="value">
  <span slot="header-end"><!-- Trailing slot in the header (e.g. icon button) --></span>
</sherpa-nav-section>
```

## Import

```js
// Individual import
import "sherpa-ui/components/sherpa-nav-section/sherpa-nav-section.js";

// Or import everything
import "sherpa-ui";
```

## Files

| File | Purpose |
| ---- | ------- |
| [`sherpa-nav-section.js`](sherpa-nav-section.js) | Component class, lifecycle, events |
| [`sherpa-nav-section.css`](sherpa-nav-section.css) | Styles, variants, states |
| [`sherpa-nav-section.html`](sherpa-nav-section.html) | Shadow DOM template(s) |
