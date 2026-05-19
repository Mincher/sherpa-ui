# sherpa-panel

> **Category:** container · **Base class:** SherpaElement
>
> Use `sherpa-dialog` for true modal overlays.

Side-anchored panel that lives **inline in a layout** — filters, details,
inspectors, list rails, in-flow content sections. Two variants:

- `inline` — takes part in the flex/grid layout and can **collapse to a 40 px
  rail** via a chevron toggle. Restores via a chevron on the strip (optionally
  labelled vertically with `data-restore-label`).
- `overlay` — `position: fixed`, floats above content on one edge of the
  viewport. The header button is an × close instead of a chevron.

A panel is **also the canonical "searchable list panel"** and the canonical
**in-flow content section** (replaces the deprecated `sherpa-list-panel` and
`sherpa-content-section` components). Use `data-search` for filterable lists,
`data-flush` for edge-to-edge content, and the `toolbar` slot for a secondary
row between the header and body.

## Anatomy

```
┌──────────────────────────────┐
│ Heading        [controls] ›  │  ← header row (› / ‹ collapse chevron;
│ metadata slot                │    × close on overlay variant)
│ [search]                     │  ← shown when data-search is set
├──────────────────────────────┤
│ toolbar slot                 │  ← secondary row (only when populated)
├──────────────────────────────┤
│                              │
│ default slot (scrollable)    │  ← data-flush removes the body padding
│                              │
├──────────────────────────────┤
│ actions slot                 │  ← footer (only shown when populated)
└──────────────────────────────┘

Collapsed (inline):
┌────┐
│ ‹  │  ← chevron points INWARD (toward content);
│ R  │    optional vertical restore label below it.
│ e  │
│ s  │
│ t  │
└────┘
```

## Attributes

| Attribute              | Type    | Description                                                | Default              | Values                  |
| ---------------------- | ------- | ---------------------------------------------------------- | -------------------- | ----------------------- |
| `data-variant`         | enum    | Layout mode                                                | `inline`             | `inline`, `overlay`     |
| `data-position`        | enum    | Edge to anchor to (drives chevron direction)               | `right`              | `left`, `right`, `both` |
| `data-expanded`        | boolean | Expanded (visible) state                                   | —                    | —                       |
| `data-heading`         | string  | Heading text                                               | —                    | —                       |
| `data-restore-label`   | string  | Vertical label shown on the collapsed strip (falls back to heading) | —           | —                       |
| `data-width`           | string  | Custom panel width (CSS value)                             | `480px`              | —                       |
| `data-bordered`        | boolean | Adds a rounded outer border (use as inset card)            | —                    | —                       |
| `data-flush`           | boolean | Removes the content padding so a list/grid/chart can stretch | —                  | —                       |
| `data-search`          | boolean | Render the built-in search row and filter slotted items    | —                    | —                       |
| `data-search-match`    | string  | CSS selector identifying searchable rows                   | `sherpa-list-item`   | —                       |
| `data-empty`           | string  | Empty-state message (shown when `data-empty-visible` set)  | `No results`         | —                       |

When `data-expanded` is absent on the `inline` variant, the panel collapses to a
40 px rail with a chevron expand trigger. The `overlay` variant hides entirely
when not expanded.

## Slots

| Slot        | Description                                                       |
| ----------- | ----------------------------------------------------------------- |
| `(default)` | Panel body content (scrollable)                                   |
| `controls`  | Header controls placed **before** the built-in collapse/close button |
| `metadata`  | Subtle metadata row directly under the heading                    |
| `search`    | Overrides the built-in `sherpa-input-search` (paired with `data-search`) |
| `toolbar`   | Secondary row between the header and the content area             |
| `actions`   | Action-bar footer pinned to the bottom of the panel               |

```html
<sherpa-panel data-variant="inline" data-heading="Asset details" data-expanded data-width="320">
  <sherpa-button slot="controls" data-type="icon" data-icon-start="fa-solid fa-pen" aria-label="Edit"></sherpa-button>
  <div slot="metadata">Updated 2 min ago</div>

  <!-- default slot: body content -->
  <sherpa-key-value-list>…</sherpa-key-value-list>

  <sherpa-button slot="actions" data-variant="secondary" data-label="Cancel"></sherpa-button>
  <sherpa-button slot="actions" data-variant="primary" data-label="Save"></sherpa-button>
</sherpa-panel>
```

### List-panel composition

A bordered panel with a built-in search and a slotted list is the canonical
"list panel":

```html
<sherpa-panel data-bordered data-heading="Recent activity" data-search data-empty="No matching activity" data-width="420" data-expanded>
  <sherpa-list>
    <sherpa-list-item data-label="Deploy succeeded"  data-description="v2.4.1 — 2 mins ago"></sherpa-list-item>
    <sherpa-list-item data-label="High CPU resolved" data-description="api-gateway — 8 mins ago"></sherpa-list-item>
    <sherpa-list-item data-label="Backup completed"  data-description="primary db — 1 hr ago"></sherpa-list-item>
  </sherpa-list>
  <sherpa-button slot="actions" data-variant="tertiary" data-size="small" data-label="View all"></sherpa-button>
</sherpa-panel>
```

The search field string-matches `data-search-match` rows (default
`sherpa-list-item`) against their `textContent` plus `data-label`,
`data-description`, `data-value`, `aria-label`, and `title`. Non-matching rows
are hidden via the native `hidden` attribute; matched text is highlighted via
the CSS Highlight API (`::highlight(panel-search-match)`).

### Section composition (in-flow column)

For in-flow content sections inside a layout column — a settings rail, a
filters sidebar, a detail pane that participates in the page grid — use a
bordered panel with `data-position` controlling the chevron direction. Add a
`toolbar` slot for secondary actions and `data-flush` when slotted content
(table, list, chart) should own its own gutters.

```html
<sherpa-panel data-bordered data-heading="Account details" data-expanded>
  <sherpa-button slot="toolbar" data-variant="tertiary" data-size="small"
                 data-icon-start="fa-solid fa-arrow-rotate-right" data-label="Sync"></sherpa-button>
  <sherpa-input-text data-label="Display name" value="Alex Doe"></sherpa-input-text>
  <sherpa-input-text data-label="Email" value="alex@acme.io"></sherpa-input-text>
</sherpa-panel>
```

Collapsed sections show a chevron + optional vertical restore label:

```html
<sherpa-panel data-bordered data-position="left"
              data-heading="Advanced settings"
              data-restore-label="Advanced"></sherpa-panel>
```

## Events

### `panel-toggle`

Fired when expanded state changes.

```js
element.addEventListener("panel-toggle", (e) => {
  console.log(e.detail.expanded); // boolean
});
```

### `panel-close`

Fired when the built-in collapse / close button is clicked. On `inline`
variants this also collapses the panel to the rail; on `overlay` variants it
dismisses the drawer.

```js
element.addEventListener("panel-close", () => { /* … */ });
```

### `panel-search`

Fired when the built-in search filter changes.

```js
element.addEventListener("panel-search", (e) => {
  console.log(e.detail.value, e.detail.matchCount);
});
```

All events bubble and cross shadow boundaries (`composed: true`).

## Methods

| Method          | Description                                       |
| --------------- | ------------------------------------------------- |
| `clearSearch()` | Clear the built-in search field and reset visibility |

## Internal CSS Custom Properties

| Property         | Purpose                                            |
| ---------------- | -------------------------------------------------- |
| `--_panel-width` | Set via `data-width`; consumed by host `width`     |

## Import

```js
// Individual import
import "sherpa-ui/components/sherpa-panel/sherpa-panel.js";

// Or import everything
import "sherpa-ui";
```

## Files

| File                                                                 | Purpose                            |
| -------------------------------------------------------------------- | ---------------------------------- |
| [`sherpa-panel.js`](sherpa-panel.js)                   | Component class, lifecycle, events |
| [`sherpa-panel.css`](sherpa-panel.css)                 | Styles, variants, states           |
| [`sherpa-panel.html`](sherpa-panel.html)               | Shadow DOM template                |
| [`sherpa-panel.examples.html`](sherpa-panel.examples.html) | Live docs examples              |
