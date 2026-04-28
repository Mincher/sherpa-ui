# sherpa-product-bar-v2

> **Category:** navigation · **Base class:** SherpaElement

Light-themed product bar (Apr 2026 redesign). Replaces the dark
`sherpa-product-bar` for surfaces that adopt the new product chrome.

48 px tall surface, white background, 1 px hairline bottom rule. Provides
a system-name trigger, optional tabs, central search, and a right-aligned
action cluster (icon-only buttons + Ask N-zo button).

## Attributes

| Attribute | Type | Description | Default |
| --------- | ---- | ----------- | ------- |
| `data-product-name` | string | System / product display name | — |
| `data-time` | string | Time string (e.g. `09:00`) | `--:--` |
| `data-show-system` | `"true"`/`"false"` | Toggle the brand stack | `true` |
| `data-show-time` | `"true"`/`"false"` | Toggle the time line | `true` |

## Slots

| Slot | Description |
| ---- | ----------- |
| `tabs` | Optional product sub-nav |
| `search` | Search control (defaults to `<sherpa-input-search>`) |
| `actions` | Right-aligned icon buttons + Ask N-zo entry point |

## Events

`systemtriggerclick` — bubbles, composed, `detail: { name: string }`.
Fired when the system-name trigger is activated.

## Usage

```html
<sherpa-product-bar-v2 data-product-name="N-central" data-time="09:00">
  <sherpa-button
    slot="actions"
    data-variant="secondary"
    data-icon-start="&#xf890;"
    data-label="Ask N-zo"></sherpa-button>
  <span slot="actions" class="actions-divider"></span>
  <sherpa-button slot="actions" data-variant="tertiary" data-icon-start="&#xf492;" aria-label="Lab"></sherpa-button>
  <sherpa-button slot="actions" data-variant="tertiary" data-icon-start="&#xf0f3;" aria-label="Notifications"></sherpa-button>
  <sherpa-button slot="actions" data-variant="tertiary" data-icon-start="&#xf2bd;" aria-label="Profile"></sherpa-button>
  <sherpa-button slot="actions" data-variant="tertiary" data-icon-start="&#xf059;" aria-label="Help"></sherpa-button>
  <sherpa-button slot="actions" data-variant="tertiary" data-icon-start="&#xf009;" aria-label="App switcher"></sherpa-button>
</sherpa-product-bar-v2>
```

## Files

| File | Purpose |
| ---- | ------- |
| `sherpa-product-bar-v2.js` | Component class |
| `sherpa-product-bar-v2.css` | Styles |
| `sherpa-product-bar-v2.html` | Shadow DOM template |
