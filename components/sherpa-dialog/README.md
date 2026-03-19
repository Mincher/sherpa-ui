# sherpa-dialog

> **Category:** layout · **Base class:** SherpaElement

Modal dialog built on the native HTML <dialog> element. Uses SherpaElement multi-template support. The default template includes a native <header> with a <dl> for title/subtitle and a close button, plus a sherpa-footer for footer content.

## Attributes

| Attribute | Type | Description | Default | Values |
| --------- | ---- | ----------- | ------- | ------ |
| `data-label` | string | Dialog title text | — | — |
| `data-subtitle` | string | Dialog subtitle text | — | — |
| `data-size` | enum | small \| medium \| large \| full | — | `small`, `medium`, `large`, `full` |
| `data-open` | boolean | Dialog visibility | — | — |
| `data-dismissible` | boolean | Shows close button (default: true) | — | — |

## Slots

| Slot | Description |
| ---- | ----------- |
| `(default)` | Default slot for dialog body content |
| `heading` | Custom heading content (replaces attribute-driven title) |
| `footer` | Footer action content (inside sherpa-footer) |

Slot usage:

```html
<sherpa-dialog>
  <!-- Default slot -->
  <p>Content goes here</p>
  <div slot="heading"><!-- Custom heading content (replaces attribute-driven title) --></div>
  <div slot="footer"><!-- Footer action content (inside sherpa-footer) --></div>
</sherpa-dialog>
```

## Events

### `open`

Fired when dialog is opened

**Propagation:** bubbles, composed

**Detail:** none

```js
element.addEventListener("open", (e) => {
  // handle event
});
```

### `close`

Fired when dialog is closed

**Propagation:** bubbles, composed

**Detail:** none

```js
element.addEventListener("close", (e) => {
  // handle event
});
```

## Methods

| Method | Description |
| ------ | ----------- |
| `show()` | Programmatically open the dialog |
| `hide()` | Programmatically close the dialog |
| `toggle()` | Toggle dialog visibility |

## Properties

| Property | Type | Description | Access |
| -------- | ---- | ----------- | ------ |
| `heading` | `string` | Title text (read/write) | read/write |
| `subtitle` | `string` | Subtitle text (read/write) | read/write |
| `size` | `string` | Dialog size preset (read/write) | read/write |
| `open` | `boolean` | Open state (read/write) | read/write |
| `dismissible` | `boolean` | Close button visibility (read/write) | read/write |

## CSS Parts

Style internal elements from outside the shadow DOM:

- `dialog`
- `header`
- `content`
- `footer`

```css
sherpa-dialog::part(dialog) {
  /* custom styles */
}
```

## Internal CSS Custom Properties

These `--_` prefixed properties are used internally and can be
influenced by setting `data-*` attributes or status on ancestors:

- `--_border-color`
- `--_border-width`
- `--_duration`
- `--_easing`
- `--_rounding`
- `--_shadow`
- `--_status-border`
- `--_surface`
- `--_text`

## Usage

### Basic

```html
<sherpa-dialog data-label="Example Label" data-subtitle="value" data-size="small">
  <!-- Default slot content -->
  <p>Your content here</p>
  <span slot="heading"><!-- Custom heading content (replaces attribute-driven title) --></span>
  <span slot="footer"><!-- Footer action content (inside sherpa-footer) --></span>
</sherpa-dialog>
```

### Sizes

```html
<sherpa-dialog data-size="small" data-label="Small"></sherpa-dialog>
<sherpa-dialog data-size="medium" data-label="Medium"></sherpa-dialog>
<sherpa-dialog data-size="large" data-label="Large"></sherpa-dialog>
<sherpa-dialog data-size="full" data-label="Full"></sherpa-dialog>
```

## Import

```js
// Individual import
import "sherpa-ui/components/sherpa-dialog/sherpa-dialog.js";

// Or import everything
import "sherpa-ui";
```

## Files

| File | Purpose |
| ---- | ------- |
| [`sherpa-dialog.js`](sherpa-dialog.js) | Component class, lifecycle, events |
| [`sherpa-dialog.css`](sherpa-dialog.css) | Styles, variants, states |
| [`sherpa-dialog.html`](sherpa-dialog.html) | Shadow DOM template(s) |
