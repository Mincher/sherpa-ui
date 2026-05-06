# sherpa-list-panel

> **Category:** core · **Base class:** SherpaElement

Searchable panel that wraps consumer-projected list content. Composes sherpa-input-search at the top; the search field string-matches text within slotted children (similar to sherpa-nav search). Items whose text does not contain the filter are hidden via the native `hidden` attribute on the light-DOM element. Matched text is highlighted via the CSS Highlight API (`::highlight(list-panel-match)`).

## Attributes

| Attribute | Type | Description | Default | Values |
| --------- | ---- | ----------- | ------- | ------ |
| `data-match` | string | item] CSS selector identifying the | `sherpa-list` | — |
| `data` | string | empty="No results"]      Empty-state message shown when | — | — |
| `data` | flag | bordered]                Adds a rounded outer border. | — | — |

## Slots

| Slot | Description |
| ---- | ----------- |
| `(default)` | Panel body content (typically <sherpa-list> blocks |
| `search` | Optional override for the default sherpa-input-search. |

Slot usage:

```html
<sherpa-list-panel>
  <!-- Default slot -->
  <p>Content goes here</p>
  <div slot="search"><!-- Optional override for the default sherpa-input-search. --></div>
</sherpa-list-panel>
```

## Events

### `list-panel-search`


**Propagation:** bubbles, composed

**Detail:**

```js
event.detail = {
  value: string,
  matchCount: number,
};
```

```js
element.addEventListener("list-panel-search", (e) => {
  console.log(e.detail.value);
});
```

## Methods

| Method | Description |
| ------ | ----------- |
| `clearSearch()` | Clear the search field and reset visibility. |

## CSS Parts

Style internal elements from outside the shadow DOM:

- `body`
- `empty`

```css
sherpa-list-panel::part(body) {
  /* custom styles */
}
```

## Usage

### Basic

```html
<sherpa-list-panel data-match="value" data="value">
  <!-- Default slot content -->
  <p>Your content here</p>
  <span slot="search"><!-- Optional override for the default sherpa-input-search. --></span>
</sherpa-list-panel>
```

## Import

```js
// Individual import
import "sherpa-ui/components/sherpa-list-panel/sherpa-list-panel.js";

// Or import everything
import "sherpa-ui";
```

## Files

| File | Purpose |
| ---- | ------- |
| [`sherpa-list-panel.js`](sherpa-list-panel.js) | Component class, lifecycle, events |
| [`sherpa-list-panel.css`](sherpa-list-panel.css) | Styles, variants, states |
| [`sherpa-list-panel.html`](sherpa-list-panel.html) | Shadow DOM template(s) |
