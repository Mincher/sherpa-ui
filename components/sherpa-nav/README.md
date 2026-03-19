# sherpa-nav

> **Category:** navigation · **Base class:** SherpaElement

Collapsible navigation sidebar with search and edit modes. Loads an HTML nav template via renderFromUrl() (default: sherpa-nav.html, override via data-src). CSS Highlight API for search (::highlight(nav-search-match)).

## Attributes

| Attribute | Type | Description | Default | Values |
| --------- | ---- | ----------- | ------- | ------ |
| `data-src` | string | URL for the nav template HTML (default: sherpa-nav.html) | — | — |
| `data-active-target` | string | Selector or ID of the currently active nav item | — | — |

## Events

### `navhome`


**Propagation:** bubbles, composed

**Detail:** none

```js
element.addEventListener("navhome", (e) => {
  // handle event
});
```

### `navsettings`


**Propagation:** bubbles, composed

**Detail:** none

```js
element.addEventListener("navsettings", (e) => {
  // handle event
});
```

### `navitemclick`


**Propagation:** bubbles, composed

**Detail:**

```js
event.detail = {
  itemId: string,
  sectionId: string,
  route: string,
  label: string,
};
```

```js
element.addEventListener("navitemclick", (e) => {
  console.log(e.detail.itemId);
});
```

### `navitemdelete`


**Propagation:** bubbles, composed

**Detail:**

```js
event.detail = {
  itemId: string,
  sectionId: string,
};
```

```js
element.addEventListener("navitemdelete", (e) => {
  console.log(e.detail.itemId);
});
```

### `navpinchange`


**Propagation:** bubbles, composed

**Detail:**

```js
event.detail = {
  pinned: boolean,
};
```

```js
element.addEventListener("navpinchange", (e) => {
  console.log(e.detail.pinned);
});
```

### `navmodechange`


**Propagation:** bubbles, composed

**Detail:**

```js
event.detail = {
  mode: string,
  previousMode: string,
};
```

```js
element.addEventListener("navmodechange", (e) => {
  console.log(e.detail.mode);
});
```

### `navsectionexpand`


**Propagation:** bubbles, composed

**Detail:**

```js
event.detail = {
  sectionId: string,
};
```

```js
element.addEventListener("navsectionexpand", (e) => {
  console.log(e.detail.sectionId);
});
```

### `navsectionreorder`


**Propagation:** bubbles, composed

**Detail:**

```js
event.detail = {
  groupIndex: number,
  sectionOrder: Array,
};
```

```js
element.addEventListener("navsectionreorder", (e) => {
  console.log(e.detail.groupIndex);
});
```

### `navfavoritechange`


**Propagation:** bubbles, composed

**Detail:**

```js
event.detail = {
  itemId: string,
  label: string,
  favorite: boolean,
};
```

```js
element.addEventListener("navfavoritechange", (e) => {
  console.log(e.detail.itemId);
});
```

### `naveditconfirm`


**Propagation:** bubbles, composed

**Detail:** none

```js
element.addEventListener("naveditconfirm", (e) => {
  // handle event
});
```

### `naveditcancel`


**Propagation:** bubbles, composed

**Detail:** none

```js
element.addEventListener("naveditcancel", (e) => {
  // handle event
});
```

## Methods

| Method | Description |
| ------ | ----------- |
| `startSearch` | Enter search mode |
| `endSearch` | Exit search mode |
| `setActiveLink(href)` | Highlight the link matching href |
| `setActiveItem(itemId)` | Highlight the item matching itemId |
| `isFavorite(itemId)` | Returns boolean |
| `setFavorite(itemId, label, favorite)` | Toggle favorite state |
| `addToRecent(route, label, icon)` | Push item to recent list |

### `setActiveLink(href)`

Highlight the link matching href

**Parameters:**

- `href` (`any`) — 

### `setActiveItem(itemId)`

Highlight the item matching itemId

**Parameters:**

- `itemId` (`any`) — 

### `isFavorite(itemId)`

Returns boolean

**Parameters:**

- `itemId` (`any`) — 

### `setFavorite(itemId, label, favorite)`

Toggle favorite state

**Parameters:**

- `itemId` (`any`) — 
- `label` (`any`) — 
- `favorite` (`any`) — 

### `addToRecent(route, label, icon)`

Push item to recent list

**Parameters:**

- `route` (`any`) — 
- `label` (`any`) — 
- `icon` (`any`) — 

## Properties

| Property | Type | Description | Access |
| -------- | ---- | ----------- | ------ |
| `isPinned` | `boolean` | Whether the sidebar is pinned open | read/write |
| `isSearching` | `boolean` | Whether search mode is active | read/write |
| `isEditing` | `boolean` | Whether edit mode is active | read/write |
| `mode` | `string` | Current mode: "default" \| "search" \| "edit" | read/write |

## Internal CSS Custom Properties

These `--_` prefixed properties are used internally and can be
influenced by setting `data-*` attributes or status on ancestors:

- `--_depth`
- `--_indent`
- `--_item-h`
- `--_label-weight`
- `--_ripple-i`
- `--_w-collapsed`
- `--_w-expanded`

## Usage

### Basic

```html
<sherpa-nav data-src="value" data-active-target="value"></sherpa-nav>
```

## Import

```js
// Individual import
import "sherpa-ui/components/sherpa-nav/sherpa-nav.js";

// Or import everything
import "sherpa-ui";
```

## Files

| File | Purpose |
| ---- | ------- |
| [`sherpa-nav.js`](sherpa-nav.js) | Component class, lifecycle, events |
| [`sherpa-nav.css`](sherpa-nav.css) | Styles, variants, states |
| [`sherpa-nav.html`](sherpa-nav.html) | Shadow DOM template(s) |
