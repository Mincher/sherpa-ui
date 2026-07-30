# Phase 4 — Quick Filter Toolbar + Chips

**Date:** 2026-07-30
**Delivered:** the App Shell v2 filtering surface — `sherpa-quick-filter` (chip) + `sherpa-quick-filter-toolbar` — which **fully replaces** `sherpa-filter-bar` (now deleted). Slots into the Phase 3 app-header `filters` region.

## What shipped

### `sherpa-quick-filter` — the chip
Funnel icon + label/value + optional count badge + chevron menu + optional dismiss ×. Per the Figma "Quick Filter" component set.
- `data-type`: `default` | `ai` | `populated` (colour/border treatment); `data-active`, `data-thinking` (AI pulse), `data-dismissible`, `data-no-menu`, `data-count`.
- `"Label: Value"` label convention (1 value inline, >1 → count badge) via `setValue()`.
- Events: `quick-filter-click`, `quick-filter-menu-open`, `quick-filter-dismiss`, `quick-filter-ai-accept` (AI chips: clicking the body accepts an AI-suggested filter).
- Category `control` / molecule.

### `sherpa-quick-filter-toolbar` — the strip
A drop-in replacement for `sherpa-filter-bar`, composing `sherpa-quick-filter` chips via a cloning prototype (no `createElement` for structural chip DOM). `data-type="view|data"`.
- **Preserved the entire filter-bar data contract** so consumers didn't change behaviour: `getFilters()` → `FilterSpec[]`, `setAvailableColumns(columns, rows)`, `data-src-json`, `data-preset-filters`, `data-embedded`, `data-global` (+ Time Range chip), `data-density`, sort/segment behaviour chips, operator inference, and the `filter-change` / `container-filter-change` / `global-filter-change` events.
- Chip option menus open a shared `sherpa-container-overlay` with `sherpa-overlay-item` options + **live row counts** (e.g. `Active (1)`).
- Category `data` / organism.

## The filter-bar removal (bigger reach than planned)

`sherpa-filter-bar` was embedded far more widely than the plan assumed — not just the data grid, but **3 chart components and a shared mixin** too. All migrated (same embedded API → mechanical tag/import swaps):

| Consumer | How it used filter-bar | Migrated |
|---|---|---|
| `sherpa-data-grid` | `slot="filters"`, `setAvailableColumns`, `getFilters`, `_syncFilterBarState` | ✅ |
| `sherpa-barchart` / `-line-chart` / `-donut-chart` | embedded `data-type="local"` filter UI | ✅ |
| `content-attributes-mixin` | shadow-root query `sherpa-filter-bar` (shared by charts — **would have silently broken chart filters**) | ✅ fixed |
| `patterns/layouts/{list-view,view-with-rails,app-shell}` | pattern markup | ✅ |
| `sticker-sheet` | demo | ✅ |

Then `components/sherpa-filter-bar/` was **deleted**, its `index.ts` export and 3 category-map entries removed.

### Migration guide (filter-bar → quick-filter-toolbar)
It's a **drop-in**: rename the tag and the import. The public surface is identical —
```html
<!-- before -->  <sherpa-filter-bar data-embedded slot="filters">…</sherpa-filter-bar>
<!-- after  -->  <sherpa-quick-filter-toolbar data-embedded slot="filters">…</sherpa-quick-filter-toolbar>
```
`setAvailableColumns(columns, rows)`, `getFilters()`, `removeFilterChip(field)`, `data-src-json`, `data-preset-filters`, `data-global`, `data-embedded`, `data-type="local"`, and the `filter-change`/`container-filter-change`/`global-filter-change` events all carry over unchanged. New: `data-type="view|data"` and the AI chip states.

## Verification
- type-check ✓ · 0 lint errors · 0 TS suppressions · MCP schemas correct.
- **In-browser E2E:** chip menu → select option → `getFilters()` returns the exact FilterSpec `{field:"status", type:"text", operator:"in", values:["Active"], value:"Active"}` with live row counts in the menu.
- **Data-grid verified:** embeds the new toolbar, renders rows, no errors.
- **App-header composition verified:** the full App Shell v2 header (breadcrumbs + title + quick-filter toolbar in the `filters` slot + actions) renders correctly — screenshot-confirmed against Figma.
- Demos added to the sticker sheet (`#quick-filter` chips + toolbar; `#app-header` shows the toolbar in the filters slot).

## Follow-ups (not blocking)
- The toolbar's option **menu** uses `createElement` for the `sherpa-container-overlay` + `sherpa-overlay-item`s (2 sites). This matches how other components create overlays (button, product-bar-v2) and is data-driven menu content, not structural chip DOM — but converting to a cloning prototype is a possible future tidy-up.
- `global-filter-change` is a `document`-level broadcast with no `bubbles` (moot at document root) — same intentional exception the old filter-bar had (documented in PHASE-0-CONFORMANCE.md).
- **AI chip integration** (Thinking/Suggested states → AI proposal model) is stubbed on the chip; wiring it to the AI surface is Phase 5.
