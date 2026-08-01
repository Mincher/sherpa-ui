# Sherpa-UI Deprecation Register

**Owner:** Phase 0.3 (audit) → removals executed in the phase noted per item.
**Policy:** deprecated in a 2.x minor, removed in the next major (3.0.0). Each entry records the replacement, current usage, blocker, and target removal phase. Nothing is removed while still referenced by a live component/pattern.

| Item | Type | Replacement | Deprecated since | Current real usage | Blocker to removal | Remove in |
|---|---|---|---|---|---|---|
| `sherpa-product-bar` (v1) | component | `sherpa-product-bar-v2` → then `sherpa-app-header` | v2.x | **Orphaned** — only its own `export` in `components/index.ts:55` + the category registry. The app-shell slot named `product-bar` takes **v2**, not v1. | None (safe now), but superseded wholesale by App Header. | **Phase 3** (App Shell v2) — remove together with the shell rework so the App Header lands as the single replacement. |
| ~~node-graph family~~ (`sherpa-node`, `-canvas`, `-row`, `-socket`) | components | — (to be rebuilt from scratch) | v2.x | — | — | ✅ **REMOVED** — the whole family + its utilities (`node-compute.ts`, `node-kinds/`), `index.ts` exports, category-map entries, node-only types (`Edge`/`EdgeEndpoint`/`Viewport`) and node/edge/canvas/socket events in `SherpaEventMap`, and `node-graph.spec.ts` were deleted. Any prior `data-multi`→`data-variant` migration is moot. |
| `setOptions()` (transfer-list) | method | `populate()` | v2.1.0 | Thin alias → `populate()`. Referenced by `sherpa-transfer-list.examples.ts`. | Repoint examples + any consumers to `populate()`. | 3.0.0 |
| `setItems()` (chart-legend) | method | `populate()` | v2.1.0 | Thin alias → `populate()`. | Repoint consumers to `populate()`. | 3.0.0 |
| `setSteps()` (progress-step-tracker) | method | `populate()` | v2.1.0 | Thin alias → `populate()`. | Repoint consumers to `populate()`. | 3.0.0 |
| `setSections()` (nav-section) | method | `populate()` | v2.1.0 | Thin alias → `populate()`. | Repoint consumers to `populate()`. | 3.0.0 |
| `setNodes()` (tree) | method | `populate()` | v2.1.0 | Thin alias → `populate()`. | Repoint consumers to `populate()`. | 3.0.0 |
| `setValues()` (sparkline) | method | `populate()` | v2.1.0 | Thin alias → `populate()`. | Repoint consumers to `populate()`. | 3.0.0 |


## sherpa-nav event renames (breaking)
The nav family's concatenated event **strings** were migrated to the ratified `noun-verb`
form (per the App-Shell-v2 audit). 13 events renamed at their dispatch sites, the `@fires`
JSDoc, and the two consumers (`sherpa-app-shell`, sandbox):

`navitemclick → nav-item-click`, `navitemdelete → nav-item-delete`, `navpinchange → nav-pin-change`,
`navmodechange → nav-mode-change`, `navsettings → nav-settings`, `navsectionexpand → nav-section-expand`,
`navsectionreorder → nav-section-reorder`, `navfavoritechange → nav-favorite-change`,
`navpromodismiss → nav-promo-dismiss`, `naveditcancel → nav-edit-cancel`, `naveditconfirm → nav-edit-confirm`,
`naveditreset → nav-edit-reset`, `navhome → nav-home`.

**Consumer action:** update any `addEventListener("navitemclick" | "navpinchange" | …)` to the hyphenated name.

## Notes
- **Why not remove the orphaned components now?** `sherpa-product-bar` (v1) is safe to delete today but is the *first domino* of App Shell v2; keeping it until its full removal keeps that migration self-contained.
- **Do not re-add these to any new work.** New components/patterns must target the replacements (`sherpa-product-bar-v2`/App Header). The node-graph family has been removed and will be rebuilt from scratch — do not depend on the old elements or their events.
- **Migration guides** (owed at removal time): product-bar v1→App Header (Phase 3).

## Verification snippet
Re-check orphan status before removing:
```
grep -rln "<sherpa-product-bar[ >]" components patterns test --include="*.html" | grep -v /sherpa-product-bar/
```
Empty results (besides the components' own folders) = safe to remove.
