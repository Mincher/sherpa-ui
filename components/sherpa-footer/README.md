# sherpa-footer

> **Category:** page-level · **Base class:** SherpaElement

Reusable footer with multiple template variants. Template selected via data-type attribute.

## Templates

Set via `data-type` attribute:

- `action-bar`
- `slot`

## Attributes

| Attribute | Type | Description | Default | Values |
| --------- | ---- | ----------- | ------- | ------ |
| `data-type` | enum | action-bar \| slot (default: slot) | — | `action-bar`, `slot` |
| `data-cancel-label` | string | Cancel button text (action-bar) | — | — |
| `data-apply-label` | string | Apply button text (action-bar) | — | — |
| `data-show-cancel` | boolean | Show cancel button (default: true) | — | — |
| `data-show-apply` | boolean | Show apply button (default: true) | — | — |
| `data-apply-closes` | boolean | Apply auto-closes parent (default: true) | — | — |

## Slots

| Slot | Description |
| ---- | ----------- |
| `start` | Content aligned to the left (action-bar) |
| `(default)` | Passthrough content (slot variant) |

Slot usage:

```html
<sherpa-footer>
  <!-- Default slot -->
  <p>Content goes here</p>
  <div slot="start"><!-- Content aligned to the left (action-bar) --></div>
</sherpa-footer>
```

## Events

### `footer-cancel`


**Propagation:** bubbles, composed

**Detail:** none

```js
element.addEventListener("footer-cancel", (e) => {
  // handle event
});
```

### `footer-apply`


**Propagation:** bubbles, composed

**Detail:**

```js
event.detail = {
  closes: boolean,
};
```

```js
element.addEventListener("footer-apply", (e) => {
  console.log(e.detail.closes);
});
```

## Properties

| Property | Type | Description | Access |
| -------- | ---- | ----------- | ------ |
| `type` | `string` | Getter/setter for data-type | read/write |
| `cancelLabel` | `string` | Getter/setter for data-cancel-label | read/write |
| `applyLabel` | `string` | Getter/setter for data-apply-label | read/write |
| `showCancel` | `boolean` | Getter/setter for data-show-cancel | read/write |
| `showApply` | `boolean` | Getter/setter for data-show-apply | read/write |
| `applyCloses` | `boolean` | Getter/setter for data-apply-closes | read/write |

## CSS Parts

Style internal elements from outside the shadow DOM:

- `footer`

```css
sherpa-footer::part(footer) {
  /* custom styles */
}
```

## Internal CSS Custom Properties

These `--_` prefixed properties are used internally and can be
influenced by setting `data-*` attributes or status on ancestors:

- `--_border-width`
- `--_gap`
- `--_padding`
- `--_padding-sm`

## Usage

### Basic

```html
<sherpa-footer data-type="action-bar" data-cancel-label="value" data-apply-label="value">
  <!-- Default slot content -->
  <p>Your content here</p>
  <span slot="start"><!-- Content aligned to the left (action-bar) --></span>
</sherpa-footer>
```

## Import

```js
// Individual import
import "sherpa-ui/components/sherpa-footer/sherpa-footer.js";

// Or import everything
import "sherpa-ui";
```

## Files

| File | Purpose |
| ---- | ------- |
| [`sherpa-footer.js`](sherpa-footer.js) | Component class, lifecycle, events |
| [`sherpa-footer.css`](sherpa-footer.css) | Styles, variants, states |
| [`sherpa-footer.html`](sherpa-footer.html) | Shadow DOM template(s) |
