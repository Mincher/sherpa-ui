# sherpa-view-header

> **Category:** page-level · **Base class:** SherpaElement

View header toolbar with toggles and settings. Manages heading, favorites, feedback popover, and export intent.

## Attributes

| Attribute | Type | Description | Default | Values |
| --------- | ---- | ----------- | ------- | ------ |
| `data-label` | string | View heading text | — | — |
| `data-show-debug-toggles` | boolean | Show debug toggle controls | — | — |
| `data-favorite` | boolean | Favorite state | — | — |
| `data-edit-mode` | boolean | Edit mode active | — | — |
| `data-back-button` | boolean | Show built-in back button | — | — |
| `data-export-title` | string | Title for PDF export | — | — |

## Events

### `edit-mode-change`


**Propagation:** bubbles, composed

**Detail:**

```js
event.detail = {
  editMode: boolean,
};
```

```js
element.addEventListener("edit-mode-change", (e) => {
  console.log(e.detail.editMode);
});
```

### `view-export`


**Propagation:** bubbles, composed

**Detail:**

```js
event.detail = {
  title: string,
};
```

```js
element.addEventListener("view-export", (e) => {
  console.log(e.detail.title);
});
```

### `favorite-toggle`


**Propagation:** bubbles, composed

**Detail:**

```js
event.detail = {
  viewId: string,
  favorite: boolean,
};
```

```js
element.addEventListener("favorite-toggle", (e) => {
  console.log(e.detail.viewId);
});
```

### `view-header-back`


**Propagation:** bubbles, composed

**Detail:** none

```js
element.addEventListener("view-header-back", (e) => {
  // handle event
});
```

## Methods

| Method | Description |
| ------ | ----------- |
| `setHeading(name)` | Set heading text |
| `getHeading()` | Get heading text |
| `setViewId(id)` | Set view identifier |
| `getViewId()` | Get view identifier |
| `setFavorite(on)` | Set favorite state |
| `isFavorite()` | Returns boolean |

### `setHeading(name)`

Set heading text

**Parameters:**

- `name` (`any`) — 

### `setViewId(id)`

Set view identifier

**Parameters:**

- `id` (`any`) — 

### `setFavorite(on)`

Set favorite state

**Parameters:**

- `on` (`any`) — 

## Internal CSS Custom Properties

These `--_` prefixed properties are used internally and can be
influenced by setting `data-*` attributes or status on ancestors:

- `--_feedback-left`
- `--_feedback-top`
- `--_icon-color`

## Usage

### Basic

```html
<sherpa-view-header data-label="Example Label" data-export-title="value"></sherpa-view-header>
```

## Import

```js
// Individual import
import "sherpa-ui/components/sherpa-view-header/sherpa-view-header.js";

// Or import everything
import "sherpa-ui";
```

## Files

| File | Purpose |
| ---- | ------- |
| [`sherpa-view-header.js`](sherpa-view-header.js) | Component class, lifecycle, events |
| [`sherpa-view-header.css`](sherpa-view-header.css) | Styles, variants, states |
| [`sherpa-view-header.html`](sherpa-view-header.html) | Shadow DOM template(s) |
