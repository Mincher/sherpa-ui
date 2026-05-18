# sherpa-breadcrumbs

> **Category:** control · **Base class:** SherpaElement

Navigation breadcrumb trail. The default template renders a <nav><ol> of crumbs (anchors + a current-page span).

## Attributes

| Attribute | Type | Description | Default | Values |
| --------- | ---- | ----------- | ------- | ------ |
| `data-src` | string | URL of an alternative breadcrumbs template HTML | — | — |
| `data-items` | json | JSON array of {label: string, href?: string} | — | — |

## Events

### `breadcrumb-click`


**Propagation:** bubbles, composed

**Detail:**

```js
event.detail = {
  index: number,
  href: string,
  label: string,
  current: boolean,
};
```

```js
element.addEventListener("breadcrumb-click", (e) => {
  console.log(e.detail.index);
});
```

## Usage

### Basic

```html
<sherpa-breadcrumbs data-src="value"></sherpa-breadcrumbs>
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
