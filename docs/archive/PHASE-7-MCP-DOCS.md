# Phase 7 — MCP server + Documentation uplift

**Date:** 2026-07-30
**Nature:** ongoing/parallel. Surveyed the MCP + lint + pattern + docs state, then closed the real gaps (much of the schema-accuracy deliverable was already satisfied because the MCP parses schemas lazily from JSDoc, which was kept accurate across every prior phase).

## 7.1 Schema accuracy — already satisfied ✅
All net-new components (`sherpa-tree`, `sherpa-app-header`, `sherpa-quick-filter`, `sherpa-quick-filter-toolbar`) are queryable via `query_component`, example-backed, and present in `list_components`; removed components (`sherpa-filter-bar`, `sherpa-node-header`) are gone. The MCP's lazy JSDoc parsing meant no separate wiring was needed — the `@fires`/`@attr` accuracy work in Phases 0/2/3/4/5 fed it automatically.

## 7.4 Validation tooling — JS anti-pattern lint ✅
The CSS lint (`scripts/lint-component-css.mjs`) **already** enforces the CSS golden rules: `host-chained-pseudo`, `&`-in-`:host`, `disabled-opacity`, `redeclare-hidden`/`-icon-reset`. The gap was the **JS** side.

- Added `no-restricted-syntax` ESLint rules banning `.hidden =` and `.style.display`/`.style.visibility =` assignments (the CSS-owns-visibility golden rule). Verified the rule catches a real violation; `*.examples.ts` exempt (they demo consumer-side app code). `classList`/`createElement` deliberately NOT ESLint-banned (legit SVG/guard uses) — they stay in `scripts/conformance-audit.mjs` as a judgment-call audit.
- **Fixed a pre-existing red gate:** `npm run lint` had been failing on `main` (6 `no-non-null-assertion` errors + 2 return-type warnings). Replaced safe `!` with `?.`/guards, added explicit return types — no behavioural change. `npm run lint` is now 0/0.

## 7.2 Patterns — App Shell v2 as a first-class pattern ✅
Added `patterns/layouts/app-shell-v2.html` — the modern composition (`sherpa-app-shell` → nav + `sherpa-app-header` + `sherpa-quick-filter-toolbar` + `sherpa-layout-grid`), distinct from the legacy `app-shell` pattern (hand-rolled grid + product-bar-v2 + view-header, retained). Regenerated `patterns/index.json` (14 patterns); verified MCP `get_pattern` resolves it.

## 7.3 Docs — stale-reference cleanup ✅
Migration guides already existed from prior phases (product-bar/view-header → app-header in `PHASE-3`, filter-bar → toolbar in `PHASE-4`, node-header → node-row in `DEPRECATIONS`/`docs/migrations`). The gap was **stale references to removed components**, now fixed repo-wide:
- `mcp-server/README.md` — 3 `sherpa-filter-bar` example refs → `sherpa-quick-filter-toolbar`; `compose_view` example → `app-shell-v2` + app-header.
- `mcp-server/lib/schema-parser.js` — removed the `sherpa-filter-bar` tier-map entry; added `sherpa-quick-filter-toolbar` + `sherpa-app-header`.
- `mcp-server/data/css-utilities/sherpa-utility-classes.json` — `sherpa-view-header-group` usage example → toolbar, with an App-Shell-v2 note.
- `patterns/README.md` + `patterns/layouts/README.md` — filter-bar → quick-filter-toolbar.

Repo-wide sweep confirms **zero functional references** to the removed components remain (phase docs intentionally mention the removal as history).

## Verification
type-check ✓ · `npm run lint` 0/0 (was red) · `npm run lint:css` 0 errors · Playwright suite 143/143 · MCP responds + resolves the new pattern.

## Deferred (Phase 8)
The **structural** HTML-template validator (DOM-parsing `validate_template` with slot-nesting enforcement) is the Phase 8 workstream — it builds on the Phase 0.4 `data-accepts` slot contracts. Today's `validate_usage` remains regex-based; Phase 8 replaces it.
