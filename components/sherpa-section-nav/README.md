# sherpa-section-nav

> **Category:** navigation · **Base class:** SherpaElement

Secondary navigation panel: a heading with optional back button, followed by a vertical list of grouped, selectable items. Designed for Settings-style layouts where the panel sits beside a content area and switches what is rendered there.

## Attributes

| Attribute | Type | Description |
| --------- | ---- | ----------- |
| `data-heading` | string | Panel heading text |
| `data-show-back` | boolean (`"true"`) | Reveals the back button |
| `data-active-id` | string | Currently active item id |
| `data-sections` | string (JSON) | Declarative sections array |

## Slots

| Slot | Description |
| ---- | ----------- |
| `header-end` | Trailing slot in the header (e.g. icon button) |

## Events

### `section-nav-back`

Fired when the back button is activated.

**Propagation:** bubbles, composed
**Detail:** none

### `section-nav-select`

Fired when an item is activated.

**Propagation:** bubbles, composed
**Detail:**
```js
event.detail = { id: string, action?: string, item: object };
```

## Methods

| Method | Description |
| ------ | ----------- |
| `setSections(sections)` | Replace the rendered groups + items |
| `setActive(id)` | Mark the item with the given id active |
| `getActiveId()` | Returns the currently active id |

### Section / item shape

```js
[
  {
    label: "User",
    items: [
      { id: "profile", label: "Profile" },
      { id: "security", label: "Security", icon: "fa-regular fa-shield" },
      { type: "header", label: "Jane Doe", description: "jane@acme.com" },
      { id: "sign-out", label: "Sign out", action: "sign-out" },
    ],
  },
]
```

## CSS Parts

| Part | Description |
| ---- | ----------- |
| `header` | Outer header row |
| `back` | Back button |
| `heading` | Panel title |
| `header-end` | Trailing slot wrapper |
| `sections` | Scrollable list region |

## Usage

```html
<sherpa-section-nav data-heading="Settings" data-show-back="true">
</sherpa-section-nav>

<script type="module">
  import "sherpa-ui/components/sherpa-section-nav/sherpa-section-nav.js";

  const nav = document.querySelector("sherpa-section-nav");
  nav.setSections([
    { label: "User",
      items: [
        { id: "profile",  label: "Profile" },
        { id: "security", label: "Security" },
      ] },
  ]);
  nav.setActive("profile");
  nav.addEventListener("section-nav-select", (e) => {
    console.log(e.detail.id);
  });
</script>
```

## Files

| File | Purpose |
| ---- | ------- |
| [`sherpa-section-nav.js`](sherpa-section-nav.js) | Component class, lifecycle, events |
| [`sherpa-section-nav.css`](sherpa-section-nav.css) | Styles, variants, states |
| [`sherpa-section-nav.html`](sherpa-section-nav.html) | Shadow DOM template |
