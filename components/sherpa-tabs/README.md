# sherpa-tabs

> **Category:** layout · **Base class:** SherpaElement

Tabbed content switcher with accessible keyboard navigation. Each direct light-DOM child with a data-tab-label attribute becomes a tab. The component creates shadow-DOM tab buttons from a cloning prototype and manages panel visibility by setting data-tab-active on the matching child.

## Attributes

| Attribute | Type | Description | Default | Values |
| --------- | ---- | ----------- | ------- | ------ |
| `data-active-tab` | number | Zero-based index of the selected tab | — | — |

## Slots

| Slot | Description |
| ---- | ----------- |
| `(default)` | Default slot for tab panel children (each must have data-tab-label) |

Slot usage:

```html
<sherpa-tabs>
  <!-- Default slot -->
  <p>Content goes here</p>
</sherpa-tabs>
```

## Events

### `tab-change`

Fired when the active tab changes

**Propagation:** bubbles, composed

**Detail:**

```js
event.detail = {
  index: number,
  label: string,
  previousIndex: number,
};
```

```js
element.addEventListener("tab-change", (e) => {
  console.log(e.detail.index);
});
```

## Methods

| Method | Description |
| ------ | ----------- |
| `selectTab(index)` | Programmatically select a tab by index |

### `selectTab(index)`

Programmatically select a tab by index

**Parameters:**

- `index` (`any`) — 

## Properties

| Property | Type | Description | Access |
| -------- | ---- | ----------- | ------ |
| `activeTab` | `number` | Currently selected tab index (read/write) | read/write |

## CSS Parts

Style internal elements from outside the shadow DOM:

- `tablist`
- `panel`

```css
sherpa-tabs::part(tablist) {
  /* custom styles */
}
```

## Usage

### Basic

```html
<sherpa-tabs>
  <!-- Default slot content -->
  <p>Your content here</p>
</sherpa-tabs>
```

## Import

```js
// Individual import
import "sherpa-ui/components/sherpa-tabs/sherpa-tabs.js";

// Or import everything
import "sherpa-ui";
```

## Files

| File | Purpose |
| ---- | ------- |
| [`sherpa-tabs.js`](sherpa-tabs.js) | Component class, lifecycle, events |
| [`sherpa-tabs.css`](sherpa-tabs.css) | Styles, variants, states |
| [`sherpa-tabs.html`](sherpa-tabs.html) | Shadow DOM template(s) |
