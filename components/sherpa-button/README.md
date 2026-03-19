# sherpa-button

> **Category:** core · **Base class:** SherpaElement

Multi-template button web component. Four templates (selected via data-type → get templateId()): default — Standard button: icon(s) + label + badge + optional close icon — Icon-only square button button-menu — Button + menu trigger side by side (action menu) icon-menu — Icon-only menu trigger (overflow menus) The button is self-managing for its own visual state and broadcasts events so parent components (filter-bar, container) can orchestrate. Menu behaviour: button-menu and icon-menu types are inherently menu triggers — no data-menu attribute needed. For default/icon types, add data-menu="true". button-menu has two modes: unified (default) or split (data-split). If data-menu-template is set, stamps the matching template from SherpaMenu.getMenuTemplate(id) then dispatches menu-populate.

## Templates

Set via `data-type` attribute:

- `default`
- `icon`
- `button-menu`
- `icon-menu`

## Attributes

| Attribute | Type | Description | Default | Values |
| --------- | ---- | ----------- | ------- | ------ |
| `data-type` | enum | default \| icon \| button-menu \| icon-menu | — | `default`, `icon`, `button-menu`, `icon-menu` |
| `data-label` | string | Button text label | — | — |
| `data-variant` | enum | primary \| secondary \| tertiary \| ghost | — | `primary`, `secondary`, `tertiary`, `ghost` |
| `data-size` | enum | small \| medium \| large | — | `small`, `medium`, `large` |
| `data-active` | boolean | Active/pressed toggle state | — | — |
| `data-status` | enum | critical \| warning \| success \| info \| urgent | — | `critical`, `warning`, `success`, `info`, `urgent` |
| `data-icon-start` | string | Leading icon (Font Awesome unicode) | — | — |
| `data-icon-end` | string | Trailing icon (Font Awesome unicode) | — | — |
| `data-icon-weight` | enum | fa-solid \| fa-regular \| fa-light | — | `fa-solid`, `fa-regular`, `fa-light` |
| `data-dismissable` | boolean | Shows close/remove button (chip mode) | — | — |
| `data-count` | number | Badge count | — | — |
| `data-split` | boolean | Split button-menu into action + trigger | — | — |
| `data-menu` | boolean | Enable menu trigger on default/icon types | — | — |
| `data-menu-position` | enum | Menu placement (top \| bottom \| left \| right) | — | `top`, `bottom`, `left`, `right` |
| `data-menu-template` | string | Menu template id to stamp from SherpaMenu | — | — |
| `disabled` | boolean | Native disabled state | — | — |

## Events

### `buttonclick`

Main button area clicked

**Propagation:** bubbles, composed

**Detail:** none

```js
element.addEventListener("buttonclick", (e) => {
  // handle event
});
```

### `chipremove`

Close/dismiss button clicked

**Propagation:** bubbles, composed

**Detail:** none

```js
element.addEventListener("chipremove", (e) => {
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

- `--_border-hover`
- `--_button-padding`
- `--_button-size`
- `--_button-spacing`
- `--_cg-border-radius`
- `--_cg-border-width`
- `--_icon-color`
- `--_icon-weight`
- `--_status-border`
- `--_status-surface`
- `--_status-surface-down`
- `--_status-surface-hover`
- `--_status-surface-strong`
- `--_status-surface-strong-down`
- `--_status-surface-strong-hover`
- `--_status-text`
- `--_status-text-on-color`
- `--_surface`
- `--_surface-down`
- `--_surface-hover`
- ... and 1 more

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
<sherpa-button data-variant="ghost" data-label="Ghost"></sherpa-button>
```

### Sizes

```html
<sherpa-button data-size="small" data-label="Small"></sherpa-button>
<sherpa-button data-size="medium" data-label="Medium"></sherpa-button>
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
