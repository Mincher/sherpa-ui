# Phase 0.1 — Architecture Conformance Sweep

**Date:** 2026-07-30
**Scope:** all 73 `sherpa-*` components audited against the mechanically-detectable CLAUDE.md golden rules.
**Method:** regex sweep (see below) → manual classification of `createElement`/`innerHTML` findings (legit vs. structural violation).

## Headline: the codebase is clean

| Rule | Occurrences | Status |
|---|---|---|
| JS toggles `.hidden` | 0 | ✅ |
| JS sets `style.display`/`visibility` | 0 | ✅ |
| `classList` for visual state | 0 | ✅ |
| `--core-*` used directly in component CSS | 0 | ✅ |
| `opacity` for disabled | 0 | ✅ |
| `light-dark()` in component CSS | 0 | ✅ |
| `outline: --focus-ring()` (silent-fail) | 0 | ✅ |
| `:host:…()` chained host selector | 1 | ✅ **fixed** (see below) |
| CustomEvent missing `bubbles:true` | 1 | ✅ false-positive (document-level broadcast) |
| `createElement`/`innerHTML` structural | 48 raw → **21 real violations** across 8 components | ⚠️ triaged backlog below |

**56 of 73 components are fully clean.** The CSS-owns-visibility and token discipline are essentially perfect — the only structural debt is JS building repeating DOM instead of cloning `<template>` prototypes, and it's concentrated in a handful of data-driven components.

## Fixed in this pass

- **`sherpa-app-shell.css:35`** — `:host:has(…)` → `:host(:has(…))` (chained host form is broken in shadow DOM per CLAUDE.md; the functional form works). The adjacent `:host([data-nav-pinned="true"])` selector already covered the common case, so this was a latent bug for the slot-driven path.

## False positive (no action)

- **`sherpa-filter-bar.ts:898`** `global-filter-change` has no `bubbles:true` — but it's a `document.dispatchEvent` **global broadcast**, not a component-tree event. `bubbles` is meaningless at the document root. The "always bubbles:true" rule applies to events dispatched *from* the component. Documented as intentional. *(Moot anyway — filter-bar is replaced in Phase 4.)*

## Structural violation backlog (createElement/innerHTML → templates)

Ranked, **annotated with phase overlap** so we don't refactor code that's about to be replaced or rebuilt.

| Component | Violations | Lines | Recommendation |
|---|---|---|---|
| **sherpa-input-select** | 5 | tree build L231/237/244/254 + innerHTML L248 | ⏭️ **Defer to Phase 2.** The tree template is being replaced by the shared `sherpa-tree` primitive — build *that* correctly (template-cloned) rather than refactor code slated for removal. Native `<option>`/`<optgroup>` uses here are LEGIT. |
| **sherpa-filter-bar** | 4 | chip group L552/565/572/585 | ⏭️ **Defer to Phase 4.** `sherpa-filter-bar` is replaced by `sherpa-quick-filter-toolbar`; build the new chip with a cloning template from the start. |
| **sherpa-data-grid** | 5 | header/selection cells L674/677/700/732/752 | 🔧 **Fix opportunistically (Phase 6).** Borderline — fixed single header/selection/action `<th>`s (rows & cells already clone templates correctly). Add `.sel-header-tpl`/`.action-header-tpl` prototypes when the grid is next touched. Low urgency. |
| **sherpa-breadcrumbs** | 2 | crumb + separator L72/85 | ✅ **Fix now.** Small, unambiguous repeating-list violation. Add a `.crumb-tpl` cloning prototype. Reused by node-canvas (below). |
| **sherpa-calendar** | 2 | month/year grid cells L325/349 | ✅ **Fix now.** The day grid already uses `.cal-day-tpl` — mirror that pattern for month/year grids. Cheap, removes inconsistency. |
| **sherpa-input-tag** | 2 | chip build L150 + innerHTML L153 | ✅ **Fix now.** Add a `.tag-chip-tpl` prototype for the repeating chip + its label/remove internals. |
| **sherpa-select-group** | 1 | `_stampOptions` L129 | ✅ **Fix now.** Loop-stamps child controls from `data-options`; clone a prototype. Contained (attributes-only). |
| **sherpa-node-canvas** | 1 | crumb `<a>` loop L1618 | ✅ **Fix now (trivial).** Feed `data-items` JSON to the `sherpa-breadcrumbs` child instead of building `<a>`s — removes the create entirely. Pairs with the breadcrumbs fix. |

**Genuinely clean (no real violations):** sherpa-button, sherpa-code-block, sherpa-empty-state, sherpa-nav, sherpa-nav-item, sherpa-toast, sherpa-tooltip, sherpa-view-header — their creates are all legit (component instantiation, SVG strings, native option/optgroup, `<template>`-population, clipboard/probe utilities, guard fallbacks).

### Suggested execution order for the "Fix now" set (5 components)
1. **sherpa-breadcrumbs** (`.crumb-tpl`) → then **sherpa-node-canvas** (feed it `data-items`, delete the `<a>` loop) — do as a pair.
2. **sherpa-calendar** (month/year grids → `.cal-day-tpl`-style prototypes).
3. **sherpa-input-tag** (`.tag-chip-tpl`).
4. **sherpa-select-group** (`_stampOptions` → prototype clone).

Deferred: input-select (Phase 2), filter-bar (Phase 4), data-grid (Phase 6, opportunistic).

## CSS lint state (`npm run lint:css`)

After this pass: **0 errors, 277 warnings** across 80 files.

- **Fixed:** `sherpa-calendar.css:34` — redundant `:host([hidden]) { display: none }` (already provided by `sherpa-base.css`). Was the only lint *error*.
- **Remaining warnings (advisory, not blocking):**
  - `off-grid-pixel` ×274 — hardcoded px values off the 8/4/2/1 grid. Bulk cleanup candidate; fold into Phase 1 (token consolidation) since many should become space tokens.
  - `missing-jsdoc-header` ×3 — CSS files without the standard JSDoc header. Trivial; sweep during Phase 0.5 / Phase 7 docs.

## Reproducing this sweep

The regex audit lives at `scripts/conformance-audit.mjs` (see Phase 0 tooling). Run: `node scripts/conformance-audit.mjs .`
It flags raw occurrences per rule per component; the createElement/innerHTML rows require the manual legit-vs-violation classification captured above (SVG, fragments, native options, `<template>` population, and guard fallbacks are legitimate).
