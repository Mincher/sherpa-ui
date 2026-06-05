# Layout Patterns Quick Reference

Fetch any pattern via MCP: `get_pattern({ id: "<id>" })`
Or read directly: `patterns/layouts/<id>.html`

All 13 patterns indexed at `patterns/index.json`.

---

## `app-shell`
**Use when:** Building a full application with a collapsible sidebar nav.
**Components:** `sherpa-app-shell`, `sherpa-nav`, `sherpa-product-bar-v2`, `sherpa-layout-grid`, `sherpa-view-header`, `sherpa-filter-bar`
**CSS:** app shell reserves the nav rail; the main view uses `<sherpa-layout-grid data-content="static" data-fill="viewport">`

```
┌──nav──┬─────────────────────────────────┐
│       │  sherpa-product-bar-v2          │
│       │  ┌──────────────────────────┐   │
│       │  │  sherpa-layout-grid      │   │
│       │  │  view-header slot        │   │
│       │  │  default slot: content   │   │
│       │  └──────────────────────────┘   │
└───────┴─────────────────────────────────┘
```

Key attributes on `sherpa-nav`: `data-pinned="false"` (collapsed by default), `data-searchable`, `data-editable`

Key attributes on `sherpa-layout-grid`: `data-content="static"` for stacked page content, `data-fill="viewport"` to clamp the shell height, `data-pad`, `data-gap="base"`, `slot="view-header"`, `slot="side-panel-start"`, and `slot="side-panel-end"`

---

## `dashboard-grid`
**Use when:** Displaying metric cards, charts, and a detail table on one screen.
**Components:** `sherpa-layout-grid`, `sherpa-container`, `sherpa-container-header`, `sherpa-metric`, `sherpa-barchart`, `sherpa-donut-chart`, `sherpa-data-grid`

Grid span options on `sherpa-container`:
- `data-col-span="3|6|9|12"` — column width (12-col grid)
- `data-row-span="1–6"` — row height in grid units

Typical layout: metrics row (4 × `data-col-span="3"`), charts row (2 × `data-col-span="6"`), full-width table (`data-col-span="12"`)

---

## `detail-view`
**Use when:** Showing a single entity record with metadata, tabs, and actions.
**Components:** `sherpa-view-header`, `sherpa-breadcrumbs`, `sherpa-toolbar`, `sherpa-tabs`, `sherpa-key-value-list`, `sherpa-container`

Structure: breadcrumbs → view-header with edit/delete actions → key-value metadata block → tabs for content sub-panels

---

## `list-view`
**Use when:** Filterable table/list of records with CRUD actions.
**Components:** `sherpa-view-header`, `sherpa-filter-bar`, `sherpa-data-grid`, `sherpa-pagination`, `sherpa-toolbar`

Structure: view-header (Add button in `toolbar` slot) → filter-bar → data-grid → pagination footer

**Pairs with:** `generate-crud-flow` skill for Add / Edit / Delete wiring.

---

## `settings-form`
**Use when:** Settings or profile page with grouped form field sections.
**Components:** `sherpa-view-header`, `sherpa-section-header`, `sherpa-input-text`, `sherpa-input-select`, `sherpa-switch`, `sherpa-button`

Structure: view-header → repeating (`sherpa-section-header` + field group) → save/cancel button row at bottom

**Pairs with:** `compose-form` skill for input selection and FormManager.

---

## `view-with-rails`
**Use when:** Main scrollable content bounded by sticky side panels (e.g. filter rail + detail rail, node graph + property panel).
**Components:** `sherpa-layout-grid`, `sherpa-view-header`, `sherpa-panel`, `sherpa-data-grid`

`sherpa-layout-grid data-content="static"` slots:
- `slot="view-header"` — optional `sherpa-view-header` above the content area
- `slot="side-panel-start"` — left rail (optional)
- `slot="side-panel-end"` — right rail (optional)
- default slot — scrollable main content

Content area and rails scroll independently; use `data-fill="viewport"` to bound the entire layout to the viewport.

---

## `flex-truncate`
**Use when:** A toolbar or navigation bar should gracefully hide trailing items when container width is too narrow.
**Implementation:** CSS utility class `.flex-truncate` on a flex container (not a web component).
**Browser support:** Chromium 137+ only — uses `sibling-index()` and `CSS if(style())`.
**Attribute:** `data-min-child-width="180px"` on the `.flex-truncate` element

```html
<div class="flex-truncate" data-min-child-width="120px">
  <sherpa-button data-label="Primary action"></sherpa-button>
  <sherpa-button data-label="Secondary"></sherpa-button>
  <sherpa-button data-label="Tertiary"></sherpa-button>
  <!-- Trailing items hide first as container narrows -->
</div>
```

---

## Feedback Patterns (non-layout)

| Pattern | `id` | Use when |
|---------|------|---------|
| Loading skeleton | `loading-state` | Content area is fetching data |
| Empty state | `empty-state` | View loaded but no rows/results |
| Confirmation dialog | `confirmation-dialog` | Before destructive action |

See `feedback-and-states` skill for full usage guide.

## CRUD Flow Patterns

| Pattern | `id` | Use when |
|---------|------|---------|
| Add entity | `add` | Creating a new record via dialog form |
| Edit entity | `edit` | Editing an existing record via dialog form |
| Delete entity | `delete` | Deleting with confirmation dialog |

See `generate-crud-flow` skill for full wiring guide.
