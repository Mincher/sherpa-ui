# sherpa-button

> **Category:** control · **Base class:** SherpaElement

Multi-template button web component. Two templates (selected via data-type → get templateId()): default — Standard button: icon(s) + label + badge icon — Icon-only square button For compound button patterns (split, dismissable chip), compose separate sherpa-button elements inside a .grouped-component wrapper. The button is self-managing for its own visual state and broadcasts events so parent components (filter-bar, container) can orchestrate. Menu behaviour: Any button with data-menu="true" acts as a menu trigger. If data-menu-template is set, stamps the matching template from SherpaMenu.getMenuTemplate(id) then dispatches menu-populate.

## Templates

Set via `data-type` attribute:

- `default`
- `icon`

## Attributes

| Attribute | Type | Description | Default | Values |
| --------- | ---- | ----------- | ------- | ------ |
| `data-type` | enum | default \| icon | — | `default`, `icon` |
| `data-label` | string | Button text label | — | — |
| `data-variant` | enum | primary \| secondary \| tertiary \| tertiary-on-color | — | `primary`, `secondary`, `tertiary`, `tertiary-on-color` |
| `data-size` | enum | 2x-small \| x-small \| small \| base \| large (default: base) | — | `2x-small`, `x-small`, `small`, `base`, `large` |
| `data-active` | boolean | Active/pressed toggle state | — | — |
| `data-status` | enum | critical \| warning \| success \| info \| urgent | — | `critical`, `warning`, `success`, `info`, `urgent` |
| `data-icon-start` | string | Leading icon (Font Awesome unicode) | — | — |
| `data-icon-end` | string | Trailing icon (Font Awesome unicode) | — | — |
| `data-icon-weight` | enum | fa-solid \| fa-regular \| fa-light | — | `fa-solid`, `fa-regular`, `fa-light` |
| `data-count` | number | Badge count | — | — |
| `data-menu` | boolean | Enable menu trigger on any button type | — | — |
| `data-menu-position` | enum | Menu placement (top \| bottom \| left \| right) | — | `top`, `bottom`, `left`, `right` |
| `data-menu-template` | string | Menu template id to stamp from SherpaMenu | — | — |
| `disabled` | boolean | Native disabled state | — | — |
| `data-src-html` | string |  | — | — |
| `data-src-json` | string |  | — | — |

## Events

### `button-click`

Main button area clicked

**Propagation:** bubbles, composed

**Detail:** none

```js
element.addEventListener("button-click", (e) => {
  // handle event
});
```

### `menu-open`

Menu is about to show

**Propagation:** bubbles, composed

**Detail:** none

```js
element.addEventListener("menu-open", (e) => {
  // handle event
});
```

### `menu-close`

Menu was dismissed

**Propagation:** bubbles, composed

**Detail:** none

```js
element.addEventListener("menu-close", (e) => {
  // handle event
});
```

### `menu-select`

Menu item selected

**Propagation:** bubbles, composed

**Detail:**

```js
event.detail = {
  item: Element,
  action: string,
};
```

```js
element.addEventListener("menu-select", (e) => {
  console.log(e.detail.item);
});
```

### `menu-populate`

Menu stamped and ready for dynamic items

**Propagation:** bubbles, composed

**Detail:**

```js
event.detail = {
  menu: SherpaMenu,
};
```

```js
element.addEventListener("menu-populate", (e) => {
  console.log(e.detail.menu);
});
```

## Methods

| Method | Description |
| ------ | ----------- |
| `setMenuItems(items, opts)` | Populate menu with items array |
| `getSelectedValues()` | Get checked menu item values |
| `clearSelection()` | Clear all checked menu items |

### `setMenuItems(items, opts)`

Populate menu with items array

**Parameters:**

- `items` (`any`) — 
- `opts` (`any`) — 

## Properties

| Property | Type | Description | Access |
| -------- | ---- | ----------- | ------ |
| `disabled` | `boolean` | Disabled state (read/write) | read/write |
| `active` | `boolean` | Active/pressed state (read/write) | read/write |
| `label` | `string` | Button text label (read/write) | read/write |
| `templateId` | `string` | Active template id (read-only) | read-only |
| `menuElement` | `SherpaMenu` | The menu instance (read-only) | read-only |

## Internal CSS Custom Properties

These `--_` prefixed properties are used internally and can be
influenced by setting `data-*` attributes or status on ancestors:

- `--_ai-gradient`
- `--_border-hover`
- `--_button-padding`
- `--_button-size`
- `--_button-spacing`
- `--_cg-border-radius`
- `--_cg-border-width`
- `--_cg-sep-block`
- `--_cg-sep-inline`
- `--_cg-separator-color`
- `--_icon-color`
- `--_status-border`
- `--_status-surface`
- `--_status-surface-down`
- `--_status-surface-hover`
- `--_status-surface-strong`
- `--_status-surface-strong-down`
- `--_status-surface-strong-hover`
- `--_status-text`
- `--_status-text-on-color`
- ... and 4 more

## Usage

### Basic

```html
<sherpa-button data-type="default" data-label="Example Label" data-variant="primary"></sherpa-button>
```

### Variants

```html
<sherpa-button data-variant="primary" data-label="Primary"></sherpa-button>
<sherpa-button data-variant="secondary" data-label="Secondary"></sherpa-button>
<sherpa-button data-variant="tertiary" data-label="Tertiary"></sherpa-button>
<sherpa-button data-variant="tertiary-on-color" data-label="Tertiary-on-color"></sherpa-button>
```

### Sizes

```html
<sherpa-button data-size="2x-small" data-label="2x-small"></sherpa-button>
<sherpa-button data-size="x-small" data-label="X-small"></sherpa-button>
<sherpa-button data-size="small" data-label="Small"></sherpa-button>
<sherpa-button data-size="base" data-label="Base"></sherpa-button>
<sherpa-button data-size="large" data-label="Large"></sherpa-button>
```

### Disabled

```html
<sherpa-button data-label="Disabled" disabled></sherpa-button>
```

## Import

```js
// Individual import
import "sherpa-ui/components/sherpa-button/sherpa-button.js";

// Or import everything
import "sherpa-ui";
```

## Files

| File | Purpose |
| ---- | ------- |
| [`sherpa-button.js`](sherpa-button.js) | Component class, lifecycle, events |
| [`sherpa-button.css`](sherpa-button.css) | Styles, variants, states |
| [`sherpa-button.html`](sherpa-button.html) | Shadow DOM template(s) |
