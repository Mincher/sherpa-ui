# Plan 856 — one panel, one state attribute

Written for: Will. Status: PLAN, nothing built. Asked 2026-11-06 (TODO 855, 856). Build starts when the integrator says the
847 swap (the filter panel onto the overlay panel) has landed, so the filter panel moves with the rest.

## What was asked

**(A)** Replace the four attributes `data-fixed`, `data-overlay`, `data-minimised`, `data-floating` with ONE attribute,
`data-dock-state`, in the markup (not only in JS), with the values `floating`, `tab`, `hover`, `overlay`, `fixed`, and two new
ones: `drill-down` (the panel fills the window in the SAME tab) and `new-tab` (it looks the same, in a new browser tab). CSS
selects on it. Demos' saved state, the layouts and the specs move in the same change. No alias.

**(B)** Every panel is built from the same component, `sherpa-overlay-panel`; a copy is deleted. Then 855, Open in New Tab,
which shows ONLY the panel content, full screen, as a drill-down, is written once.

## The panels today

| Panel | Built on | Moves |
|---|---|---|
| Assistant, Details, Node details (inspector), Nodes (node list) in Demos | `sherpa-overlay-panel` | none: already on it |
| Filter column | `sherpa-quick-filter-toolbar` (portrait, column) | the 847 lane is putting it on `sherpa-overlay-panel` now; migrated here once it lands |
| `sherpa-node-panel` | deleted in 846 | none |
| `sherpa-panel` (an inline `<section>` card) | itself | decision D4 below; it is not docked, floated or tabbed anywhere in Demos |
| `sherpa-dialog` (modal), Settings overlay, `sherpa-notifications` (a menu) | their own | not panels: they are modal or menus, and stay |
| Starter, Gallery | none | nothing to move |

So after 847, every docked panel in the apps is an overlay panel. The work in (B) is mostly (A) plus 855.

## The attribute map, old to new

| Old | New | Notes |
|---|---|---|
| `data-fixed` (and `="start"`) | `data-dock-state="fixed"` + `data-dock-side="start"` | the side was folded into the value; it becomes its own attribute (D1) |
| `data-overlay` | `data-dock-state="overlay"` | the router's own `data-overlay` (names of overlay routes) is a different thing and is NOT touched |
| `data-minimised` | `data-dock-state="tab"` | |
| (the peek, an internal state) | `data-dock-state="hover"` | transient; never saved |
| `data-floating` | `data-dock-state="floating"` | `data-x`, `data-y`, `data-width`, `data-height` stay: they are the box, not the state |
| `data-maximised` | `data-dock-state="drill-down"` | it already is the full-screen drill-down with a trail (D2) |
| (new) | `data-dock-state="new-tab"` | the panel as the page of a new tab |
| (no state) | the LAST docked state, `fixed` or `overlay` | a floating, tab or drill-down panel returns to it: kept as `data-dock-was` (private to the panel; saved with the rest) |

Never `hover` and `fixed` together: a hover opens a panel over the content (a fixed panel hovered shows as `hover`, and its
docking button docks it as `overlay`). `collapsed` is not a dock state and stays `data-collapsed`.

## What changes

- `sherpa-overlay-panel`: `.ts`, `.css`, `.html`, the spec: one `data-dock-state`; `dockState` reads and writes it; the buttons
  (Minimise, Float, Dock as overlay / inline, drill-down, open in new tab) are transitions between its values; the CSS selects
  on it instead of `:state()` flags and four attributes.
- `sherpa-layout-panels` and `sherpa-layout-canvas`: read `data-dock-state` for "this area gives its room back"
  (`floating`, `tab`, `overlay`, `hover`, `drill-down`).
- The filter panel (`sherpa-filter-panel`), after 847.
- `sherpa-float.css`, `node-graph.ts` (the inspector starts as a `tab`), the panel keys (`panel-keys.ts`).
- Demos: `index.html`, `panel-float.js` (`restorePanel`, `keepPanel`: one value instead of five), `panel-tabs.js`, `records.html`.
- Docs: the traps (`T-a-floating-panel-is-a-state`, `T-a-minimised-panel-is-a-tab`, `T-a-panel-peeks-from-its-tab`, the area traps).
- Specs (14 in sherpa-ui, 6 in Demos, plus the parity sweep): `layer-bands`, `layout-panels`, `node-box-select`, `node-panel`,
  `outlet-layers`, `overlay-panel`, `-float`, `-minimise`, `panel-area-edge`, `-area-tabs`, `panel-keys`, `panel-overlay`,
  `router` (only its own `data-overlay`, which stays); Demos `node-panel`, `page-layers`, `panel-area-edge`, `panel-float`,
  `panel-tabs`, `records-details`.

## 855 Open in New Tab, written once

- The panel reports `panel-external`; the app opens `?panel=<id>`; that page sets the panel's `data-dock-state="new-tab"` and
  the shell shows only it: no header, no nav, no other panel, the content filling the window as a drill-down (D3).
- The other tab keeps the row in step (the BroadcastChannel in Demos' `panel-tabs.js` today); that sync is app code and stays
  in the app, but the page mode is the library's, so no app writes it again.

## Order

1. WAIT for 847 to land (the integrator says when). Work in a lane worktree; the commits are small but merge as one change,
   since there is no alias and a half-migrated tree would not pass.
2. P1 `sherpa-overlay-panel`: the attribute, `dockState`, the CSS, its spec and tests.
3. P2 the layouts, the float CSS, `node-graph.ts`, `panel-keys.ts`.
4. P3 the filter panel.
5. P4 Demos: markup, `restorePanel` / `keepPanel` (and a one-time read of the old kept keys so a reader's state is not lost).
6. P5 specs and traps; manifests and references regenerate.
7. P6 `drill-down` and `new-tab`, then 855.

## Decisions for you (two options each)

- **D1. The side.** `data-dock-side="start|end"` as its own attribute (my pick), or fold it into the value (`fixed-start`).
- **D2. Maximised.** `data-maximised` becomes the `drill-down` value (my pick: one state), or stays a second flag on top.
- **D3. The new-tab page.** The shell owns it, as `data-panel-only="<id>"` (my pick: written once), or the app keeps its own
  CSS and script, as Demos does now.
- **D4. `sherpa-panel` (the inline card).** Keep it as the card it is (my pick: it is not a docked panel), or fold it into
  the overlay panel as an `inline` state.

## Risks

- A reader's saved panel state (five kept values per panel) must still restore: P4 reads the old shape once, then writes the new.
- `data-dock-state` changes are the single write path, so the layouts' mutation watchers (`data-floating`, `data-minimised`,
  `data-overlay`) all move to it in the same commit as the panel.
