---
name: build-app-view
description: 'Build and compose a Sherpa UI app view or page. Use when: creating any new view or page; composing the app shell with navigation; building a dashboard, list, detail, settings, or split-rail layout; choosing a layout pattern; wiring sherpa-nav, sherpa-view-header, sherpa-layout-grid; applying tier-aware slot composition rules. Patterns: app-shell, dashboard-grid, detail-view, list-view, settings-form, view-with-rails, flex-truncate.'
---

# Build App View

## When to Use
- Creating a new app page or screen from scratch
- Adding a view inside an existing app shell
- Choosing between layout patterns (list, dashboard, detail, settings, rail)
- Wiring navigation, breadcrumbs, view headers, and content areas
- Troubleshooting slot composition (`data-accepts` tier mismatches)

## Step 1 — Pick a Layout Pattern

| Scenario | Pattern | Key Components |
|----------|---------|----------------|
| Full app with sidebar nav | `app-shell` | `sherpa-nav`, `sherpa-view-header`, `sherpa-layout-grid` |
| Dashboard with metrics + charts | `dashboard-grid` | `sherpa-layout-grid`, `sherpa-container`, `sherpa-metric`, charts |
| Single record detail with metadata | `detail-view` | `sherpa-view-header`, `sherpa-breadcrumbs`, `sherpa-tabs`, `sherpa-key-value-list` |
| Filterable table or list | `list-view` | `sherpa-view-header`, `sherpa-filter-bar`, `sherpa-data-grid` |
| Settings or profile form | `settings-form` | `sherpa-view-header`, `sherpa-section-header`, inputs, `sherpa-button` |
| Scrollable content with sticky side rails | `view-with-rails` | `sherpa-layout-grid`, `sherpa-view-header`, `sherpa-panel`, `sherpa-data-grid` |
| Toolbar that hides overflow items | `flex-truncate` | `.flex-truncate` CSS utility class |

See [references/layout-patterns.md](./references/layout-patterns.md) for full HTML structure and component list per pattern.

Fetch via MCP:
```
list_patterns
get_pattern({ id: "app-shell" })
compose_view({ layout: "list-view", components: ["sherpa-data-grid"] })
```

## Step 2 — Understand Tier Composition

Components declare a role and belong to a tier. A slot at tier N can only accept children at tier ≥ N.

| Tier | Roles | Examples |
|------|-------|---------|
| 1 | `shell`, `nav` | `sherpa-app-shell`, `sherpa-nav`, `sherpa-view-header`, `sherpa-layout-grid` |
| 2 | `container`, `overlay` | `sherpa-container`, `sherpa-dialog`, `sherpa-panel`, `sherpa-accordion` |
| 3 | `content` | `sherpa-toolbar`, `sherpa-tabs`, `sherpa-list`, `sherpa-section-header`, `sherpa-key-value-list` |
| 4 | `control`, `input`, `display`, `feedback`, `media`, `data` | buttons, inputs, metrics, charts, grids |

**Common mistakes:**
- Putting `sherpa-button` (tier 4) directly into a shell slot that expects tier 2 → wrap it in `sherpa-toolbar` (tier 3) or `sherpa-container` (tier 2)
- Nesting `sherpa-container` inside `sherpa-data-grid` (grid is tier 4, container is tier 2 — tier violation)

Use `validate_usage` MCP tool to audit your HTML against schema.

## Step 3 — App Shell Structure

```html
<sherpa-app-shell>
  <sherpa-nav slot="nav" data-pinned="false" data-searchable data-editable>
    <sherpa-nav-section data-label="Main">
      <sherpa-nav-item data-label="Dashboard" data-icon="&#xf3fd;"
                       data-route="/dashboard"></sherpa-nav-item>
      <sherpa-nav-item data-label="Devices" data-icon="&#xf108;"
                       data-route="/devices"></sherpa-nav-item>
    </sherpa-nav-section>
  </sherpa-nav>

  <sherpa-product-bar-v2 slot="product-bar" data-product-name="My App"></sherpa-product-bar-v2>

  <sherpa-layout-grid data-content="static" data-fill="viewport" data-pad data-gap="base">
    <sherpa-view-header slot="view-header" data-label="Page Title">
      <sherpa-toolbar slot="actions">
        <sherpa-button data-label="Add" data-variant="primary"
                       data-icon-start="&#xf067;"></sherpa-button>
      </sherpa-toolbar>
    </sherpa-view-header>

    <!-- Page content goes in the default slot of sherpa-layout-grid -->
    <sherpa-filter-bar data-global></sherpa-filter-bar>
    <sherpa-data-grid></sherpa-data-grid>
  </sherpa-layout-grid>
</sherpa-app-shell>
```

Listen for nav clicks:
```js
nav.addEventListener('navitemclick', (e) => {
  const { route, label } = e.detail;
  // handle routing
});
```

## Step 4 — Populate the View

### Data list view
```html
<sherpa-layout-grid data-content="static" data-fill="viewport" data-pad data-gap="base">
  <sherpa-view-header slot="view-header" data-label="Records">
    <sherpa-toolbar slot="actions">
      <sherpa-button data-label="Add" data-variant="primary"></sherpa-button>
    </sherpa-toolbar>
  </sherpa-view-header>

  <sherpa-filter-bar></sherpa-filter-bar>
  <sherpa-data-grid data-show-pagination></sherpa-data-grid>
</sherpa-layout-grid>
```

### Dashboard
```html
<sherpa-layout-grid data-pad data-gap="base">
  <!-- Metrics row: 4 × quarter-width cards -->
  <sherpa-container data-col-span="3">
    <sherpa-container-header data-title="Total"></sherpa-container-header>
    <sherpa-metric></sherpa-metric>
  </sherpa-container>

  <!-- Charts row -->
  <sherpa-container data-col-span="6" data-row-span="2">
    <sherpa-container-header data-title="Trend"></sherpa-container-header>
    <sherpa-barchart></sherpa-barchart>
  </sherpa-container>

  <!-- Full-width detail table -->
  <sherpa-container data-col-span="12" data-row-span="3">
    <sherpa-container-header data-title="All Records"></sherpa-container-header>
    <sherpa-data-grid data-show-pagination></sherpa-data-grid>
  </sherpa-container>
</sherpa-layout-grid>
```

### Detail view
```html
<sherpa-view-header data-label="Record Name">
  <sherpa-breadcrumbs slot="breadcrumbs">
    <sherpa-button data-variant="tertiary" data-label="Back to list"></sherpa-button>
  </sherpa-breadcrumbs>
  <sherpa-toolbar slot="actions">
    <sherpa-button data-label="Edit"   data-variant="secondary"></sherpa-button>
    <sherpa-button data-label="Delete" data-variant="secondary"
                   data-status="critical"></sherpa-button>
  </sherpa-toolbar>
</sherpa-view-header>

<sherpa-key-value-list></sherpa-key-value-list>

<sherpa-tabs>
  <!-- Panels slotted as tab content -->
</sherpa-tabs>
```

### Settings form
```html
<sherpa-view-header data-label="Settings"></sherpa-view-header>
<sherpa-section-header data-label="General"></sherpa-section-header>
<sherpa-container>
  <sherpa-input-text data-label="Display name" name="display_name" required></sherpa-input-text>
  <sherpa-input-select data-label="Timezone" name="timezone">
    <option value="utc">UTC</option>
  </sherpa-input-select>
</sherpa-container>
```

## Step 5 — View-with-Rails

```html
<sherpa-layout-grid data-content="static" data-fill="viewport">
  <sherpa-view-header slot="view-header" data-label="Devices"></sherpa-view-header>
  <sherpa-panel slot="side-panel-start" data-label="Filters"></sherpa-panel>
  <!-- body: scrollable main content in the default slot -->
  <sherpa-data-grid data-show-pagination></sherpa-data-grid>
  <sherpa-panel slot="side-panel-end" data-label="Details"></sherpa-panel>
</sherpa-layout-grid>
```

## Common Mistakes

| ❌ Wrong | ✅ Right |
|---------|--------|
| `sherpa-button` directly in shell slot expecting tier 2 | Wrap in `sherpa-toolbar` or `sherpa-container` |
| Inline `style="display: grid"` for layout | Use a CSS class with token-based values |
| No `min-height: 0` on flex children | Add `min-height: 0` to flex/grid children that need to scroll |
| Page content placed directly in `<sherpa-app-shell>` | Put the view inside `<sherpa-layout-grid>` in the app shell's default slot |
| `sherpa-filter-bar` without context | Place it inside the main layout grid and use `data-global` for app-level filtering |
