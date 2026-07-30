# Sherpa-UI Deprecation Register

**Owner:** Phase 0.3 (audit) → removals executed in the phase noted per item.
**Policy:** deprecated in a 2.x minor, removed in the next major (3.0.0). Each entry records the replacement, current usage, blocker, and target removal phase. Nothing is removed while still referenced by a live component/pattern.

| Item | Type | Replacement | Deprecated since | Current real usage | Blocker to removal | Remove in |
|---|---|---|---|---|---|---|
| `sherpa-product-bar` (v1) | component | `sherpa-product-bar-v2` → then `sherpa-app-header` | v2.x | **Orphaned** — only its own `export` in `components/index.ts:55` + the category registry. The app-shell slot named `product-bar` takes **v2**, not v1. | None (safe now), but superseded wholesale by App Header. | **Phase 3** (App Shell v2) — remove together with the shell rework so the App Header lands as the single replacement. |
| ~~`sherpa-node-header`~~ | component | `sherpa-node-row` (`data-variant="header"`) | v2.1.0 | — | — | ✅ **REMOVED (Phase 5)** — was fully orphaned; deleted the folder + `index.ts` export + 3 category-map entries. |
| `sherpa-node-socket` `data-multi` attr | attribute | `data-variant` (`multiple` / `step-multiple`) | v2.x | **Wider than first recorded** (the earlier note was wrong): authored directly on **9 sockets** in `sherpa-node-templates.html`; read live by JS in `sherpa-node.ts` (`getPortPositions`) and `sherpa-node-canvas.ts` (port-lane geometry). The `data-variant`→`data-multi` "CSS compat" claim is **stale** — no CSS reads `[data-multi]`. (`sherpa-node-row`'s `data-multi` was dead surface — **removed in Phase 5**.) | Migrate 9 template authorings + repoint 2 JS readers to derive multi from `data-variant`, then delete `#syncVariantToMulti()`. | **Deferred within Phase 5 / to node-graph hardening** — higher risk (changes authored markup + edge geometry); needs visual verification of multi-input nodes. |

## Node-graph event renames (Phase 5, breaking)
The node-graph family's `sherpa-*`-prefixed event **strings** were migrated to unprefixed `noun-verb` per the Phase 0.5 naming contract (element names stay `sherpa-*`). 14 events renamed at their dispatch sites, the 4 internal `sherpa-node-canvas` listeners, the `@fires` JSDoc, and the typed event map in `components/utilities/types.ts`:

`sherpa-node-pointerdown → node-pointerdown`, `sherpa-node-subtype-change → node-subtype-change`, `sherpa-node-value-change → node-value-change`, `sherpa-node-drilldown → node-drilldown`, `sherpa-socket-pointerdown → socket-pointerdown`, `sherpa-node-select → node-select`, `sherpa-node-delete → node-delete`, `sherpa-edge-{create,update,delete,select} → edge-{create,update,delete,select}`, `sherpa-canvas-subgraph-{enter,exit} → canvas-subgraph-{enter,exit}`, `sherpa-viewport-change → viewport-change`.

**Consumer action:** update any `addEventListener("sherpa-node-…")` to the unprefixed name.

## Notes
- **Why not remove the orphaned components now?** `sherpa-product-bar` (v1) is safe to delete today but is the *first domino* of App Shell v2; keeping it until its full removal keeps that migration self-contained. `sherpa-node-header` was removed in Phase 5.
- **Do not re-add these to any new work.** New components/patterns must target the replacements (`sherpa-product-bar-v2`/App Header, `sherpa-node-row`, `data-variant`).
- **Migration guides** (owed at removal time): product-bar v1→App Header (Phase 3), node-header→node-row (already drafted in `docs/migrations/node-header-to-node-row.md`), `data-multi`→`data-variant` (Phase 5).

## Verification snippet
Re-check orphan status before removing:
```
grep -rln "<sherpa-product-bar[ >]" components patterns test --include="*.html" | grep -v /sherpa-product-bar/
grep -rln "<sherpa-node-header" components patterns test --include="*.html" | grep -v /sherpa-node-header/
```
Empty results (besides the components' own folders) = safe to remove.
