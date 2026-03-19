# sherpa-breadcrumbs

> **Category:** navigation · **Base class:** SherpaElement

Navigation breadcrumb trail with optional collapse. Reads slotted children (anchors/spans) and renders a styled list with chevron separators. Middle items collapse behind "…" when count exceeds data-max-items.

## Attributes

| Attribute | Type | Description | Default | Values |
| --------- | ---- | ----------- | ------- | ------ |
| `data-max-items` | number | Maximum visible items before collapsing (default: unlimited) | — | — |

## Slots

| Slot | Description |
| ---- | ----------- |
| `(default)` | Breadcrumb items: <a href="…"> or <span> |

Slot usage:

```html
<sherpa-breadcrumbs>
  <!-- Default slot -->
  <p>Content goes here</p>
</sherpa-breadcrumbs>
```

## Events

### `breadcrumb-click`


**Propagation:** bubbles, composed

**Detail:**

```js
event.detail = {
  index: number,
  href: string,
  label: string,
};
```

```js
element.addEventListener("breadcrumb-click", (e) => {
  console.log(e.detail.index);
});
```

## Properties

| Property | Type | Description | Access |
| -------- | ---- | ----------- | ------ |
| `maxItems` | `number` | Getter/setter for data-max-items | read/write |

## Usage

### Basic

```html
<sherpa-breadcrumbs>
  <!-- Default slot content -->
  <p>Your content here</p>
</sherpa-breadcrumbs>
```

## Import

```js
// Individual import
import "sherpa-ui/components/sherpa-breadcrumbs/sherpa-breadcrumbs.js";

// Or import everything
import "sherpa-ui";
```

## Files

| File | Purpose |
| ---- | ------- |
| [`sherpa-breadcrumbs.js`](sherpa-breadcrumbs.js) | Component class, lifecycle, events |
| [`sherpa-breadcrumbs.css`](sherpa-breadcrumbs.css) | Styles, variants, states |
| [`sherpa-breadcrumbs.html`](sherpa-breadcrumbs.html) | Shadow DOM template(s) |
