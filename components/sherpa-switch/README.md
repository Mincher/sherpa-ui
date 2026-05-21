# sherpa-switch

> **Category:** control · **Base class:** SherpaElement

Toggle switch component.

## Attributes

| Attribute | Type | Description | Default | Values |
| --------- | ---- | ----------- | ------- | ------ |
| `data-state` | enum | on \| off | — | `on`, `off` |
| `disabled` | boolean | Native disabled state | — | — |
| `data-src-html` | string |  | — | — |
| `data-src-json` | string |  | — | — |

## Events

### `change`

Fired when toggle state changes

**Propagation:** bubbles, composed

**Detail:**

```js
event.detail = {
  checked: boolean,
  state: string,
};
```

```js
element.addEventListener("change", (e) => {
  console.log(e.detail.checked);
});
```

## Properties

| Property | Type | Description | Access |
| -------- | ---- | ----------- | ------ |
| `state` | `string` | Current state: "on" or "off" (read/write) | read/write |
| `checked` | `boolean` | Whether switch is on (read/write) | read/write |
| `disabled` | `boolean` | Disabled state (read/write) | read/write |

## Internal CSS Custom Properties

These `--_` prefixed properties are used internally and can be
influenced by setting `data-*` attributes or status on ancestors:

- `--_switch-border-control`
- `--_switch-border-outer`
- `--_switch-control-size`
- `--_switch-fill-active`
- `--_switch-fill-default`
- `--_switch-fill-inactive`

## Usage

### Basic

```html
<sherpa-switch data-state="on" data-src-html="value" data-src-json="value"></sherpa-switch>
```

### Disabled

```html
<sherpa-switch disabled></sherpa-switch>
```

## Import

```js
// Individual import
import "sherpa-ui/components/sherpa-switch/sherpa-switch.js";

// Or import everything
import "sherpa-ui";
```

## Files

| File | Purpose |
| ---- | ------- |
| [`sherpa-switch.js`](sherpa-switch.js) | Component class, lifecycle, events |
| [`sherpa-switch.css`](sherpa-switch.css) | Styles, variants, states |
| [`sherpa-switch.html`](sherpa-switch.html) | Shadow DOM template(s) |
