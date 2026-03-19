# sherpa-menu

> **Category:** navigation · **Base class:** SherpaElement

Menu component (per-instance, no singleton). Light DOM <ul>/<li>/<sherpa-menu-item> content projected through <slot>. Uses popover="auto" for top-layer promotion and light-dismiss. CSS anchor positioning with JS fallback.

## Templates

Available templates:

- `default`
- `filter`

## Slots

| Slot | Description |
| ---- | ----------- |
| `(default)` | Menu content: <ul>/<li>/<sherpa-menu-item> elements |

Slot usage:

```html
<sherpa-menu>
  <!-- Default slot -->
  <p>Content goes here</p>
</sherpa-menu>
```

## Events

### `menu-select`


**Propagation:** bubbles, composed

**Detail:**

```js
event.detail = {
  item: Element,
  action: string,
  value: string,
  label: string,
};
```

```js
element.addEventListener("menu-select", (e) => {
  console.log(e.detail.item);
});
```

### `menu-close`


**Propagation:** bubbles, composed

**Detail:** none

```js
element.addEventListener("menu-close", (e) => {
  // handle event
});
```

## Methods

| Method | Description |
| ------ | ----------- |
| `show(anchor)` | Open and position the menu relative to anchor element |
| `hide()` | Close the menu |
| `getMenuTemplate(id)` | Return menu template HTML by id |

### `show(anchor)`

Open and position the menu relative to anchor element

**Parameters:**

- `anchor` (`any`) — 

### `getMenuTemplate(id)`

Return menu template HTML by id

**Parameters:**

- `id` (`any`) — 

## Properties

| Property | Type | Description | Access |
| -------- | ---- | ----------- | ------ |
| `open` | `boolean` | Whether the menu is currently visible | read/write |
| `source` | `Element` | The anchor element that opened the menu | read/write |
| `ready` | `Promise` | (static) Resolves when menu templates are loaded | read/write |

## CSS Parts

Style internal elements from outside the shadow DOM:

- `surface`

```css
sherpa-menu::part(surface) {
  /* custom styles */
}
```

## Internal CSS Custom Properties

These `--_` prefixed properties are used internally and can be
influenced by setting `data-*` attributes or status on ancestors:

- `--_border-color`
- `--_border-width`
- `--_gap`
- `--_gap-sm`
- `--_padding`
- `--_rounding`
- `--_shadow`
- `--_surface`
- `--_text`

## Usage

### Basic

```html
<sherpa-menu>
  <!-- Default slot content -->
  <p>Your content here</p>
</sherpa-menu>
```

## Import

```js
// Individual import
import "sherpa-ui/components/sherpa-menu/sherpa-menu.js";

// Or import everything
import "sherpa-ui";
```

## Files

| File | Purpose |
| ---- | ------- |
| [`sherpa-menu.js`](sherpa-menu.js) | Component class, lifecycle, events |
| [`sherpa-menu.css`](sherpa-menu.css) | Styles, variants, states |
| [`sherpa-menu.html`](sherpa-menu.html) | Shadow DOM template(s) |
