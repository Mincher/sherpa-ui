# Sherpa-UI Deprecation Register

**Owner:** Phase 0.3 (audit) → removals executed in the phase noted per item.
**Policy:** deprecated in a 2.x minor, removed in the next major (3.0.0). Each entry records the replacement, current usage, blocker, and target removal phase. Nothing is removed while still referenced by a live component/pattern.

| Item | Type | Replacement | Deprecated since | Current real usage | Blocker to removal | Remove in |
|---|---|---|---|---|---|---|
| `sherpa-product-bar` (v1) | component | `sherpa-product-bar-v2` → then `sherpa-app-header` | v2.x | **Orphaned** — only its own `export` in `components/index.ts:55` + the category registry. The app-shell slot named `product-bar` takes **v2**, not v1. | None (safe now), but superseded wholesale by App Header. | **Phase 3** (App Shell v2) — remove together with the shell rework so the App Header lands as the single replacement. |
| `sherpa-node-header` | component | `sherpa-node-row` (`data-variant="header"`) | v2.1.0 (→ remove v3.0.0) | **Orphaned** — `index.ts:102`, `component-categories.ts`; the `.node-header` in `sherpa-node.html:33` is a **CSS class**, not the element. | None. | **Phase 5** (Node Graph work) — remove with the node-graph maturation so all node components move in one pass. |
| `sherpa-node-socket` `data-multi` attr | attribute | `data-variant` (`multiple`) | v2.x | Only within `sherpa-node-socket` itself (ts/html/css). The `data-multi*` hits elsewhere were `data-multiline` on `sherpa-input-text` (unrelated). | None — contained to one component. | **Phase 5** — drop the attribute + its CSS/JS branch; `data-variant` already covers it. |

## Notes
- **Why not remove the orphaned components now?** Both `sherpa-product-bar` (v1) and `sherpa-node-header` are safe to delete today, but each is the *first domino* of a larger phase (App Shell v2 / Node Graph). Removing them there keeps each phase's migration guide self-contained and avoids a churny interim commit. If a clean-now is preferred, both are a 2-line `index.ts` + registry edit plus deleting the component folder.
- **Do not re-add these to any new work.** New components/patterns must target the replacements (`sherpa-product-bar-v2`/App Header, `sherpa-node-row`, `data-variant`).
- **Migration guides** (owed at removal time): product-bar v1→App Header (Phase 3), node-header→node-row (already drafted in `docs/migrations/node-header-to-node-row.md`), `data-multi`→`data-variant` (Phase 5).

## Verification snippet
Re-check orphan status before removing:
```
grep -rln "<sherpa-product-bar[ >]" components patterns test --include="*.html" | grep -v /sherpa-product-bar/
grep -rln "<sherpa-node-header" components patterns test --include="*.html" | grep -v /sherpa-node-header/
```
Empty results (besides the components' own folders) = safe to remove.
