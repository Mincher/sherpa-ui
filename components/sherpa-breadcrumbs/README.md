# sherpa-breadcrumbs

> **Category:** control · **Base class:** SherpaElement

Navigation breadcrumb trail rendered as a flat flex row of crumb links and separator spans.

## Attributes

| Attribute | Type | Description | Default | Values |
| --------- | ---- | ----------- | ------- | ------ |
| `data-src-html` | string | URL of an HTML template file to replace the shadow DOM | — | — |
| `data-src-json` | string | URL of a JSON file: [{label: string, href?: string}] | — | — |

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
<sherpa-breadcrumbs data-src-html="value" data-src-json="value"></sherpa-breadcrumbs>
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
