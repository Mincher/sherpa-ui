# sherpa-list-item

> **Category:** data-display · **Base class:** SherpaElement

Versatile list item with leading, content, and trailing areas. Supports labels, descriptions, icons, drag handles, and slotted trailing actions.

## Attributes

| Attribute | Type | Description | Default | Values |
| --------- | ---- | ----------- | ------- | ------ |
| `data-label` | string | Primary text | — | — |
| `data-description` | string | Secondary helper text | — | — |
| `data-icon` | string | FontAwesome class for leading icon | — | — |
| `data-active` | boolean | Active/selected visual state | — | — |
| `data-interactive` | boolean | Enables hover/click behaviour | — | — |
| `data-draggable` | boolean | Shows drag handle | — | — |
| `disabled` | boolean | Disabled state | — | — |

## Slots

| Slot | Description |
| ---- | ----------- |
| `leading` | Custom leading content (avatar, icon override) |
| `(default)` | Custom content below label/description |
| `trailing` | Trailing action buttons or badges |

Slot usage:

```html
<sherpa-list-item>
  <!-- Default slot -->
  <p>Content goes here</p>
  <div slot="leading"><!-- Custom leading content (avatar, icon override) --></div>
  <div slot="trailing"><!-- Trailing action buttons or badges --></div>
</sherpa-list-item>
```

## Events

### `list-item-click`


**Propagation:** bubbles, composed

**Detail:**

```js
event.detail = {
  label: string,
};
```

```js
element.addEventListener("list-item-click", (e) => {
  console.log(e.detail.label);
});
```

## Properties

| Property | Type | Description | Access |
| -------- | ---- | ----------- | ------ |
| `label` | `string` | Getter/setter for data-label | read/write |
| `description` | `string` | Getter/setter for data-description | read/write |
| `active` | `boolean` | Getter/setter for data-active | read/write |

## CSS Parts

Style internal elements from outside the shadow DOM:

- `container`
- `leading`
- `content`
- `trailing`

```css
sherpa-list-item::part(container) {
  /* custom styles */
}
```

## Usage

### Basic

```html
<sherpa-list-item data-label="Example Label" data-description="A brief description" data-icon="value">
  <!-- Default slot content -->
  <p>Your content here</p>
  <span slot="leading"><!-- Custom leading content (avatar, icon override) --></span>
  <span slot="trailing"><!-- Trailing action buttons or badges --></span>
</sherpa-list-item>
```

### Disabled

```html
<sherpa-list-item data-label="Disabled" disabled></sherpa-list-item>
```

## Import

```js
// Individual import
import "sherpa-ui/components/sherpa-list-item/sherpa-list-item.js";

// Or import everything
import "sherpa-ui";
```

## Files

| File | Purpose |
| ---- | ------- |
| [`sherpa-list-item.js`](sherpa-list-item.js) | Component class, lifecycle, events |
| [`sherpa-list-item.css`](sherpa-list-item.css) | Styles, variants, states |
| [`sherpa-list-item.html`](sherpa-list-item.html) | Shadow DOM template(s) |
