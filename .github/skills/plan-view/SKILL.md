---
name: plan-view
description: 'Before building a new page, screen, or view; when creating a layout from scratch; when choosing between layout patterns; before calling get_pattern or composing a view.'
---

# Plan View

**Plan the layout before writing a line of markup.** Three rounds of questions identify the right pattern and content inventory; you confirm the blueprint before generation starts.

---

## Round 1 — Purpose and scale (always ask, max 3 questions)

1. What is the primary purpose of this view? (browse and filter records / view a single record in detail / configure settings / monitor a dashboard / something else)
2. What are the 1–3 main things users will *do* here? (e.g. add records, filter a list, view charts, edit a form, navigate to sub-pages)
3. Roughly how much data? (a single record / tens of rows / hundreds of rows / mixed metrics + charts)

**Skip questions already answered by the user's description.**

---

## Pattern Recommendation

After Round 1, commit to a pattern and state the reason:

| Scenario | Recommended pattern | MCP call |
|---|---|---|
| Browse + filter + row actions | `list-view` | `get_pattern({ id: 'list-view' })` |
| Monitor KPIs + charts | `dashboard-grid` | `get_pattern({ id: 'dashboard-grid' })` |
| Single record with related sections | `detail-view` | `get_pattern({ id: 'detail-view' })` |
| Editable settings / profile form | `settings-form` | `get_pattern({ id: 'settings-form' })` |
| Scrollable content + sticky side panel | `view-with-rails` | `get_pattern({ id: 'view-with-rails' })` |
| Full app shell with navigation | `app-shell` | `get_pattern({ id: 'app-shell' })` |

Show reasoning: "I'm recommending `list-view` because you have hundreds of filterable rows and row-level actions — if you also need KPI metrics above the grid we can use `dashboard-grid` instead."

---

## Round 2 — Pattern-specific questions (conditional)

Ask only the branch that matches the chosen pattern:

**list-view:** What columns should the grid show? Any row actions (edit, delete, clone)? Filters by which fields?

**dashboard-grid:** How many KPI metric cards? Which chart types for which data? Is there a data grid below the charts?

**detail-view:** What sections or tabs? Are any fields editable inline or via a dialog?

**settings-form:** What groups of settings? Save per-section or a single Save All button?

**view-with-rails:** What goes in the rail vs main content? Is the rail fixed width or collapsible?

---

## Round 3 — Cross-cutting (ask only if not already known)

- Navigation context: needs back button, breadcrumbs, or is it a top-level view?
- Role-based visibility: any actions hidden for read-only users?
- View header: include `sherpa-view-header` or does the host page provide one?

---

## Output: View Blueprint

Before generating, output a blueprint and **wait for explicit confirmation**:

```
Layout pattern: list-view
Shell components:
  - sherpa-view-header (data-label="Devices")
  - sherpa-filter-bar
  - sherpa-data-grid (data-show-pagination, data-selectable)
Primary actions: Add Device button (toolbar-leading slot) → triggers Add flow
Row actions: Edit, Delete
Filters: by status, by device type
Empty state: sherpa-empty-state with "Add Device" CTA
MCP call: get_pattern({ id: 'list-view' }) for full HTML structure

Shall I generate the full view markup using this structure?
```

---

## After confirmation

1. Call `get_pattern({ id: 'pattern-id' })` for the structural HTML
2. For each component used, verify attributes with `query_component('sherpa-tag')`
3. Generate the complete view
4. Run `validate_usage(html)` and fix every warning before returning
