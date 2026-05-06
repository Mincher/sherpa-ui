# sherpa-content-section

> **Category:** core · **Base class:** SherpaElement

In-flow content section anchored to the left or right of a layout column. Fills the available height, owns its own header (heading + actions), an optional toolbar row, and a scrollable body. Minimisable to a narrow strip on the side it is anchored to.

## Attributes

| Attribute | Type | Description | Default | Values |
| --------- | ---- | ----------- | ------- | ------ |
| `data` | enum | position=right]   left \| right — anchored side | — | `left`, `right` |
| `data` | string | heading]          Header text | — | — |
| `data` | flag | minimised]        Collapsed to a narrow strip | — | — |
| `data-restore` | string | label]    Optional label shown on the | — | — |

## Slots

| Slot | Description |
| ---- | ----------- |
| `(default)` | Body content |
| `toolbar` | Toolbar row beneath the header |
| `search` | Sticky search input pinned to the top of the body |
| `actions` | Header trailing actions (buttons / menu) |

Slot usage:

```html
<sherpa-content-section>
  <!-- Default slot -->
  <p>Content goes here</p>
  <div slot="toolbar"><!-- Toolbar row beneath the header --></div>
  <div slot="search"><!-- Sticky search input pinned to the top of the body --></div>
  <div slot="actions"><!-- Header trailing actions (buttons / menu) --></div>
</sherpa-content-section>
```

## Events

### `section-minimise-change`


**Propagation:** bubbles, composed

**Detail:**

```js
event.detail = {
  minimised: boolean,
};
```

```js
element.addEventListener("section-minimise-change", (e) => {
  console.log(e.detail.minimised);
});
```

## Methods

| Method | Description |
| ------ | ----------- |
| `minimise()` | Collapse the section |
| `restore()` | Expand the section |
| `toggle()` | Toggle minimised state |

## CSS Parts

Style internal elements from outside the shadow DOM:

- `header`
- `title`
- `toolbar`
- `body`
- `search`

```css
sherpa-content-section::part(header) {
  /* custom styles */
}
```

## Internal CSS Custom Properties

These `--_` prefixed properties are used internally and can be
influenced by setting `data-*` attributes or status on ancestors:

- `--_section-min-strip`
- `--_section-width`

## Usage

### Basic

```html
<sherpa-content-section data="left" data="value" data-restore="value">
  <!-- Default slot content -->
  <p>Your content here</p>
  <span slot="toolbar"><!-- Toolbar row beneath the header --></span>
  <span slot="search"><!-- Sticky search input pinned to the top of the body --></span>
</sherpa-content-section>
```

## Import

```js
// Individual import
import "sherpa-ui/components/sherpa-content-section/sherpa-content-section.js";

// Or import everything
import "sherpa-ui";
```

## Files

| File | Purpose |
| ---- | ------- |
| [`sherpa-content-section.js`](sherpa-content-section.js) | Component class, lifecycle, events |
| [`sherpa-content-section.css`](sherpa-content-section.css) | Styles, variants, states |
| [`sherpa-content-section.html`](sherpa-content-section.html) | Shadow DOM template(s) |
