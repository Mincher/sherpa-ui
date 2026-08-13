# Phase 3 — App Shell v2

**Date:** 2026-07-30
**Delivered:** the new application chrome — `sherpa-app-header` (net-new), the app-shell recomposed to host it, and the nav events fixed to actually cross the shadow boundary. Built on existing Core tokens (the App Shell v2 Figma-branch tokens reconcile when that branch merges to Core).

## What shipped

### `sherpa-app-header` — NEW (the v2 baseline header)
Merges the old **product-bar app-actions** with the **view-header** (title / breadcrumbs / favourite). Structure from the Figma "App Header" (1600×120), three stacked regions:

| Region | Contents |
|---|---|
| **Top** | back button · breadcrumbs (data-driven) · `app-actions` slot (AI trigger, notifications, help, user) |
| **View** | title icon · view title · info affordance · favourite · `filters` slot (Quick Filter Toolbar, Phase 4) · `view-actions` slot (save, refresh) |
| **Loading** | 2px indeterminate progress strip (`data-loading`) |

- **API:** `data-label`, `data-breadcrumbs` (JSON), `data-back-button`, `data-show-favorite`/`data-favorite`, `data-loading`, `data-info`, `data-export-title`.
- **Events (backwards-compatible with view-header):** `view-header-back`, `favorite-toggle`, `breadcrumb-click`, `view-export` — all bubbles+composed.
- **Slots:** `app-actions`, `filters`, `view-actions`, `title-icon`.
- Breadcrumbs clone a `<template class="crumb-tpl">` prototype (no createElement/innerHTML).
- Category `shell` / tier 1 / structure.

### `sherpa-app-shell` — recomposed
Added an **`app-header` slot** row between product-bar and content, so the shell now composes: nav rail + (optional product-bar) + app-header + main content. The row auto-hides when empty (`data-has-app-header`), so **existing shells are unaffected — fully backwards-compatible**. Added `data-accepts` slot contracts.

### `sherpa-nav` — composed-events fix
Nav's `#emit` set `bubbles:true` but **omitted `composed:true`**, so all 13 nav events (`navitemclick`, `navpinchange`, `navmodechange`, …) died at the nav's shadow root — never reaching `sherpa-app-shell` or app code. Fixed; verified in-browser that `navitemclick` now reaches a document-level listener. (The nav's maximised/minimised, sections, promo, and edit-mode already implement the v2 behaviour, so no rewrite was needed — only this correctness fix.)

## Migration guide

### product-bar (v1/v2) + view-header → app-header

**Old (v1 pattern):**
```html
<sherpa-app-shell>
  <sherpa-nav slot="nav" data-src-html="/nav.html"></sherpa-nav>
  <sherpa-product-bar-v2 slot="product-bar" data-product-name="My App">
    <span slot="actions">…app actions…</span>
  </sherpa-product-bar-v2>
  <sherpa-layout-grid>
    <sherpa-view-header slot="view-header" data-label="Dashboard"></sherpa-view-header>
    …content…
  </sherpa-layout-grid>
</sherpa-app-shell>
```

**New (App Shell v2):**
```html
<sherpa-app-shell>
  <sherpa-nav slot="nav" data-src-html="/nav.html"></sherpa-nav>
  <sherpa-app-header slot="app-header"
    data-label="Dashboard"
    data-back-button data-show-favorite>
    <div slot="app-actions">…app actions (AI, notifications, help, user)…</div>
    <sherpa-quick-filter-toolbar slot="filters">…</sherpa-quick-filter-toolbar> <!-- Phase 4 -->
    <div slot="view-actions">…save, refresh…</div>
  </sherpa-app-header>
  <sherpa-layout-grid>…content…</sherpa-layout-grid>
</sherpa-app-shell>
```

**Event mapping (no code change needed):** `view-header-back`, `favorite-toggle`, `view-export`, `breadcrumb-click` keep the same names on `sherpa-app-header`. `data-label`, `data-breadcrumbs`, `data-back-button`, `setBreadcrumbs()`, `setFavorite()`/`isFavorite()` all carry over.

**Not migrated automatically:** view-header's inline view-selection picker (`view-selection-change`) — if you rely on it, keep `sherpa-view-header` for that view, or wait for the picker to move into app-header if demand warrants.

### Retained for legacy
- `sherpa-view-header` — kept for legacy UI recreation only; **`sherpa-app-header` is the new baseline** for all new work.
- `sherpa-product-bar` (v1) — still deprecated (see [DEPRECATIONS.md](DEPRECATIONS.md)); removal unchanged.

## Deferred (correctly)
- **Quick Filter Toolbar + chips** — Phase 4; the app-header exposes the `filters` slot for them now.
- **App Shell v2 branch tokens** (`navigation-menu`, `filter-bar` collections) — reconcile when the Figma branch merges to Core; app-header uses existing Core tokens + hardcoded fallbacks meanwhile.
- **Nav v2 visual deltas** — the current nav already implements the v2 interaction model (pinned/collapsed, sections, product nav); any purely-visual refinements from the branch are a follow-up, not blocking.

## Verification
Type-check ✓ · 0 lint errors · 0 TS suppressions · MCP schemas correct · app-header + app-shell recomposition verified in a real browser (breadcrumbs, title, favourite, slot composition, nav event crossing shadow). Demo added to the sticker sheet (`#app-header`).
