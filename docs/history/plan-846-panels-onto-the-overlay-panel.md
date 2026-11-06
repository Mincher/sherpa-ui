# Plan 846 and 847 — the Nodes panel and the filter panel onto the overlay panel

Will, 2026-11-06. 846: `sherpa-node-panel` is its own card with its own float, dock and minimise code,
and its drag handle is in the wrong place; make it the Sherpa panel, the node list its content, ONE panel
system. 847: port the filter panel out of `sherpa-quick-filter-toolbar` into an overlay panel filled with
the filter-panel content, NO change to its function or style, then clear the toolbar's panel mode.

Read first: the panel session's commits 4635f8cb0, 94b0eb4d3, f1660e0ae, 36632f2e3, and the traps
`T-a-minimised-panel-is-a-tab`, `T-an-area-with-two-panels-is-tabbed`, `T-a-floating-panel-is-a-state`,
`T-a-panel-area-is-a-layout`, `T-the-layers-are-one-scale`, `T-a-filter-column-floats`.

## What is there now

| | Overlay panel (377 ts, 127 html, 272 css) | Nodes panel (351 ts, 106 html, 199 css) | Filter column (in the toolbar) |
|---|---|---|---|
| Box | a `<dialog>`, header by `sherpa-container-header`, grip first, Minimise, Float, Pop, Maximise, Close | its own `sherpa-container` card, the same header, its own Minimise and Float, its own `FloatBox` | `<template id="column">` in a 2931-line toolbar: a container, header, search, scopes |
| States | fixed (`data-fixed` start or end), floating, minimised tab, tabbed with others in one area | docked in the canvas's start area, floating, minimised tab on the LEFT edge of its canvas | docked in the shell's start area, floating (787b), no minimise |
| Content | any | tabs (Preset, Custom), search, categories, items, the drag out onto the canvas, the "Add a node" menu | the Filters menu, Save, Saved, ⋮, the search, the View and Local scopes: `toolbar-column.ts` (289) plus about 120 lines of CSS and the template |

The overlay panel already has all the states. The two others duplicate them, each by its own copy.

## The picks, 846

1. **One panel: the overlay panel is the box.** The node list becomes a content element,
   `sherpa-node-list`, in the overlay panel's default slot. It keeps what is the list's own:
   `populate(paletteOf(kinds))`, the tabs and search, the sticky headings, the drag of an item off the
   panel, `askAdd(context)` and the `node-add` event (detail unchanged). It loses the card, the header,
   Minimise, Float, the grip, the corner and `FloatBox`.
2. **The overlay panel docks in a canvas by its slot.** A panel slotted into `sherpa-layout-canvas`'s
   `panel` slot is already in the canvas's start area: it is in-area by markup and does not pop (no
   `data-poppable`). Its room is that layout (`roomOf`), so floating is `position: absolute` in the
   canvas, not `fixed` in the window; today the overlay panel's floating box is window-fixed.
3. **Minimise to the area's own edge.** The Nodes tab is on the LEFT edge of its canvas; the overlay
   panel's tab is on the window's right edge. The tab goes to the edge of its AREA's side, in its room.
4. **The drag handle (846's bug) is the overlay panel's grip,** leading the header, as 36632f2e3 made it.
   One header, so one place; no second fix.

## The picks, 847

5. **A content element, `sherpa-filter-panel (new)`,** takes `ToolbarColumn`'s logic out of the toolbar: the
   draw of one portrait toolbar per scope, the Filters menu for all of them, the saved sets, ⋮, the search,
   the applied count. It asks its provider for `scope` as the column did, and keeps `drawScopes`.
6. **The header controls go into the overlay panel's slots,** as the Ask N-zo chat re-slots its halves:
   the search into `description`, the Suggest, Filters, Save, Saved and ⋮ buttons into `actions`. The
   content element stamps them as slotted siblings of itself in the panel, and takes them away on leaving.
   The provider reads the panel's `open`, shows and hides it.
7. **The toolbar's column mode is deleted:** `<template id="column">`, `data-column`, `open`,
   `show/hide/toggle/close`, `drawScopes`, the `filter-panel-close` event, `ToolbarColumn`, the column CSS
   (line 578 to about 700), the float box and attributes 787b added to it, `isColumn` in the provider. The
   portrait and flat templates STAY: they are the scope sections the panel draws, one toolbar each.

## What moves, what is deleted

| Moves | From | To |
|---|---|---|
| node list, search, tabs, drag, Add a node | `sherpa-node-panel` | `sherpa-node-list` |
| float, dock, minimise, grip, corner, the tab | `sherpa-node-panel`, the toolbar column | the overlay panel (already there) |
| the column's logic | `toolbar-column.ts` | `sherpa-filter-panel (new)` |
| the filter panel's markup and styles | the toolbar's `column` template and CSS | `sherpa-filter-panel (new)` and the panel's slots |

**Deleted, in the same commits** (a refactor deletes what it replaced): the `sherpa-node-panel` folder (ts,
html, css, spec, example, reference page), its export in `components.ts`, its `FloatBox` wiring, its
minimised-tab CSS, `toolbar-column.ts`, the toolbar's column template, CSS, props and `filter-panel-close`,
the 787b attributes on the toolbar, `isColumn`, the spec files that drove the card (moved, below), the
trap sites that name them, and the `layers-baseline.json` entries of the deleted CSS.

## Events and attributes that change

- `sherpa-node-panel` is gone: `data-floatable`, `data-floating`, `data-minimisable`, `data-minimised`,
  `data-x/y/width/height`, `panel-float`, `panel-move`, `panel-resize`, `panel-minimise` are the OVERLAY
  panel's now (same names, same details). `node-add` and `askAdd` are `sherpa-node-list`'s.
- The toolbar loses `data-column`, `open`, `data-floatable`, `data-floating`, `data-x/y/width/height`,
  `panel-float/move/resize`, `filter-panel-close { reason }`.
- `panel-close` gains the reason: `{ reason: 'reader' | 'width' | 'page' }` (default `reader`), where
  `filter-panel-close` told the provider why; `hide(reason)` on the panel.
- The overlay panel's header gains a `badge` slot (the applied-count badge beside the title).
- The shell and the canvas hold an overlay panel in the same slots as before; `bindWorkflow({ panel })`
  takes the node list.
- No alias is kept (`T-a-rename-drops-the-old-name`); Demos and the specs follow in the same change.

## Specs to move

sherpa-ui: `reforged-node-panel`, `-node-panel-float`, `-node-panel-headings`, `-node-panel-row-looks-like-its-node`,
`-query-panel`, `-a-saved-node-shows-in-the-panel` and the node specs that name `sherpa-node-panel` (about 20
files by selector: it becomes `sherpa-node-list` inside the panel); the float, minimise and tab behaviour is
already the overlay panel's specs (`reforged-overlay-panel-float`, `-minimise`, `reforged-panel-area-tabs`),
so the Nodes-card copies of those are DELETED, not moved, and one new spec holds the canvas-docked case: flush,
floating inside the canvas and not past it, the tab on the canvas's edge. The unit tests
`the-node-panel-lists-the-workflow-kinds` and `a-custom-node-has-tags` change their selector. 847: the filter
column specs of the toolbar (`reforged-quick-filter-toolbar`'s column parts, `reforged-multi-field-column`,
`reforged-layout-panels`'s column parts), and `reforged-provider*` where it shows or hides the column.
Demos: 15 node specs, and 30 filter specs that open the panel (by the provider's mode switch, so most need
only a selector).

## Order

1. Overlay panel: in-area by slot, room = layout (absolute), tab on its area's edge, `badge` slot, `panel-close`
   reason. Specs for each, with the Nodes card still as it is. Gates, commit.
2. 846: `sherpa-node-list`; the canvas, `node-graph.ts`, the example and Demos' node editor on it; move the
   specs; delete `sherpa-node-panel`. Gates, three engines, commit.
3. 847: `sherpa-filter-panel (new)` beside the toolbar's column, the provider on it, Demos' index on it; move the
   specs; run the Records and Devices suites on it. Gates, commit.
4. Delete the toolbar's column mode, its attributes, event and CSS. Gates, a final full run, baselines
   (size should FALL), the trap sites and index, the map.

Each step is one commit and leaves the suite green, so Will can stop after any of them.

## Risks

- **The 832 layer scale.** A panel in the canvas is `absolute`, not `fixed`: its `z-index` is the floating
  band inside the canvas's own room, which must NOT be sealed (the canvas holds floating boxes, 823). The
  node list and the filter panel hold NO floating box and no number of their own, so they stay on the scale
  as plain content. The overlay panel's tab needs a layer: on the scale, `panels`, not a bare number
  (`check:layers`).
- **The sealed-toolbar rule.** The toolbar must NOT isolate while it holds a floating box (the fix in 832);
  once the column is gone it holds none, and may seal its sticky section headers. Each section toolbar inside
  the filter panel is then a sealed host in a panel that floats: they hold no floating box, so that is safe.
  The overlay panel itself is never sealed.
- **Menus in a panel.** Each chip's menu and the Filters menu are popovers in the top layer today; the dialog
  of the overlay panel is not. Both draw as now, but the `bounds` of a menu (`data-bounds`) names the panel's
  box, and its `dialog` is a different box than the column's `.box`: checked by the filter specs by pixels.
- **A `<dialog>` in a canvas.** `dialog.show()` is not the top layer, so `position: absolute` in the canvas
  works, but the canvas clips (`overflow: hidden`): a floating panel is held inside it by the clamp, as the
  card is; a menu from it is in the top layer.
- **Provider mode.** `isColumn`, `panels()`, `found()`, `show/hide(reason)` and `room()` are written for a
  bar with `open`. The content element must answer the same doors (`show`, `hide(reason)`, `open`) or the
  mode, the narrow window and the reader's Close break. Covered by `reforged-filter-panel-mode`.
- **Function and style must not change (847).** Every column spec is moved, not rewritten; a spec that
  needs a new number is a change to look at. Pixels of the panel before and after are compared on Records.
- **Tabbed areas.** Two panels in one area is the panel session's work; the filter panel and the Nodes panel
  are in different areas, so no change, but the filter panel in the shell's START area now shares it with any
  other panel the app docks there, as a tab.

## Decisions for Will

1. **The node list's name.**
   - A, my pick: `sherpa-node-list`, a new content element; `sherpa-node-panel` is deleted with no alias.
   - B: keep the tag `sherpa-node-panel` for the content, so an app's markup does not change, though the name
     is then wrong (it is not a panel).
2. **How the filter panel gets its header controls.**
   - A, my pick: `sherpa-filter-panel (new)` re-slots them into the overlay panel (`actions`, `description`), as
     the chat does. One panel, no new panel kind.
   - B: give the overlay panel a `data-type="filters"` template with the controls in it. That puts the
     filter's logic into the panel component.
3. **The overlay panel inside a canvas.**
   - A, my pick: it is in-area by being slotted, absolute in the layout's room, the tab on that area's edge.
   - B: the canvas keeps a thin wrapper that holds the panel and gives it the room. More code, no change to
     the panel.
4. **`data-panel-mode` on the bars.**
   - A, my pick: it stays: it is the BARS' half of the provider's mode (a bar steps back while a panel
     answers), and 847 clears only the panel's half from the toolbar.
   - B: rename it for what it says (`data-stepped-back`) in the same change.
5. **The applied-count badge.**
   - A, my pick: add a `badge` slot to the overlay panel's header, so the filter panel keeps it, unchanged.
   - B: drop the count from the title; a function change Will did not ask for.
6. **One lane or two.**
   - A, my pick: one lane, four commits, merged by step (846 can ship alone after step 2).
   - B: 846 and 847 as two lanes. 847 then waits on step 1's overlay panel work.

## Reconciled with plan-filter-panel-port.md (Will's naming rule: `sherpa-filter-panel (new)`)

**This file is the plan of record for 846 AND 847.** `plan-filter-panel-port.md` stays as the detail of
847's phases (P0 to P5) and its pixel baselines; where the two differ, this is who wins:

| | Where they differ | Wins |
|---|---|---|
| Header controls | both: the panel header's `actions` and `description` slots | same (Will's decision 1) |
| Name | both: `sherpa-filter-panel (new)` | same (Will's decision 2) |
| The scope SECTIONS | the port plan MOVES the portrait and flat code out of the toolbar into the new component; this plan first left them as toolbar templates | **the port plan**: the toolbar keeps only the landscape bar; the sections move (P1). The toolbar's `portrait` and `flat` templates, `data-orientation`, `data-flat` and the chip section look that only they use are deleted in P4 |
| `data-panel-mode` | the port plan deletes it in P4; Will approved keeping it (decision 4, A) | **this plan**: it is the BARS' half of the provider's mode, and a bar still steps back while a panel answers. What goes is the panel's half |
| Pixel baselines (P0) | only the port plan has them | **the port plan**: recorded before any 847 code, and every 847 commit reproduces them |
| Commits | the port plan has six phases | **this plan**: the four commits below, each green; P1 to P3 are one commit |

### The sequence (846 first, then 847)

1. **Done:** the overlay panel docks by its slot in a canvas, `badge`, `panel-close { reason }` (and 851).
2. **846:** `sherpa-node-list` in an overlay panel; `sherpa-node-panel` deleted. This proves a panel in a
   canvas with real content before the filter panel relies on the same box.
3. **847, P0 then P1 to P3:** pixel baselines of the filter panel (closed, open, accordion shut,
   floating, dark), then `sherpa-filter-panel (new)` built from the column and section code, the provider
   and Demos on it, the specs moved; the toolbar's column still in place until the baselines match.
4. **847, P4 and P5:** delete the toolbar's panel half (column, portrait, flat, `data-orientation`,
   `data-column`, `data-flat`, the 787b float attributes, `filter-panel-close`, `isColumn`), keep
   `data-panel-mode`; baselines; the full suite.

Why this order: 846 and 847 both change how a panel hosts content and both touch the overlay panel, the
provider's panel doors and the specs; 846 is the smaller and shows the overlay panel works in a canvas,
and 847's P0 baselines want the panel session's tab and header work (848 to 851) to have settled. The panel
session does not touch the filter toolbar, the provider or the filter column.
