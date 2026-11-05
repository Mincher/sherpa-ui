# Plan 796 — one panel-area layout (with 787b and 787c)

Will, 2026-11-05: "A docked panel should be flush with the top, left, and bottom of the
canvas area. There should be no shadow either." And: "We could have a dedicated panel area
system like the layout grid to reuse functionality." 787 (769's follow-ups): (b) the filter
column floats; (c) RAISE ON PRESS: a pressed floating panel comes to the front.

Rules that stand (769): floating is a STATE of a fixed or an overlay panel, toggled from its
header; it drags by its header, resizes by its corner, and docks back where it came from.
Fixed panels (in a panel area) and overlay panels (over the content) stay apart in words.

## The words

| Word | Is |
|---|---|
| **Panel area** | a column beside the content that a docked panel fills: `start` or `end` |
| **Docked** | in its area: flush to the area's top, side and bottom; the area takes its width |
| **Floating** | lifted out of its area, which gives its width back and becomes its ROOM |

## Decisions, with my pick

| # | Decision | Pick |
|---|---|---|
| D1 | One layout | **A component, `sherpa-layout-panels`**, beside `sherpa-layout-grid` and `sherpa-layout-canvas`: a start area, the content, an end area. The shell's body and the canvas COMPOSE it, forwarding their slots into it. A component, not a sheet and a helper, as the layout grid is one, and an app can use it alone |
| D2 | Docked look | **Flush and flat**: the panel fills its area, no inset, no shadow, no rounding. The AREA draws the divider (the border token, 1px) on its inner edge, so any panel gets it; a panel drops its own card edge while docked |
| D3 | The shell's areas | **Flush too**, one meaning of docked: the 16px / 8px inset goes. The area keeps Will's width (three columns, min 464, max 33%) |
| D4 | Width | **The area owns it.** `--sherpa-panel-area-width`, `-min-width` (as today) and a new `-max-width` (33%); the canvas sets 18rem, 16rem, 60%. `data-panel-start-width` and `-end-width` in; `panel-area-resize { side, width }` out on release and each key. Each host stops the layout's event and reports its own (PRINCIPLES 18) |
| D5 | The edge | **`resizeByEdge`** on a strip straddling the divider, 4px either side; a 2px accent line in its middle on hover, focus and drag; arrows, Home and End |
| D6 | Open | An area shows while its panel is OPEN: an element with an `open` property by its attribute (an overlay panel, a filter column); any other while not `hidden` (the Nodes card). Shut, absent, or no room: no area, no width |
| D7 | Floating | A slotted panel with `data-floating` STAYS slotted: its area takes no width and covers the layout, its room; clicks pass through it but on the panel's box. The overlay panel floats as today, by leaving its area for the window |
| D8 | Room | **Stays the shell's rule** (a tablet's width beside the area's min, and not while Settings covers it); the shell sets `data-no-room` on its layout. The canvas has none: its Nodes card never hides |
| D9 | The canvas's view | **The view stays the whole canvas, UNDER the layout**: the plane never moves when the card docks, floats or is resized, and the node code's plane maths is untouched. The banners, toolbar, minimap and controls sit in the layout's content cell, beside the card; Fit, the zoom's centre and the minimap's frame read that cell. `has-panel`, `panel-floating`, `--_beside`, `.floating` and the two 44rem container rules go |
| D10 | Order | The start area first, as it is drawn first; then the banners, the view, the toolbar, the controls |
| D11 | Raise on press (787c) | **One stack for the tab, in `float-box.ts`**: a press or a focus inside a floating box brings it to the front; floating puts it at the front; docking takes it out. `z-index: 102 + its place`. It orders boxes that share a stacking context: the canvas, the layout and its areas make none, so the Nodes card and the inspector share one. Not kept over a reload |
| D12 | Pop into start | **`data-fixed="start"`**; bare or `end` is the end area. Pop out remembers the area, so Pop in goes back to it; `panel-pop { fixed, side }` |
| D13 | 787b | **The filter column floats by `float-box`**, as the Nodes card does: Float / Dock, the grip and the corner in its header, `data-floatable`, `data-floating`, the box. Its room is the shell's body |
| D14 | Keys, a11y | The edge is a `separator` with its values; the grip and corner keep their keys; focus raises a box, so a keyboard reader brings one forward too. Forced colours: the divider `CanvasText`, the line `Highlight` |

## Replaced, and deleted

- The shell's own `.panel-start` / `.panel-end` asides, their edges, `#resizable`, `#askWidth`,
  `#watchPanel` and `data-panel-start-open` / `-end-open` (the layout keeps `:state()`s).
- The canvas's `.floating`, `has-panel`, `panel-floating`, `--_beside`, its 44rem rules, the
  minimap's move, and its `data-floating` watch (the layout's).
- The node panel's `:host { pointer-events: auto }` and its docked shadow.
- The overlay panel's floating `z-index: 102` (the stack's).

## Build order

1. `sherpa-layout-panels`: template, CSS, the watch, the edges, the floating room; spec, example.
2. The shell on it; then the canvas, the card flush and flat, the content cell.
3. `float-box.ts`: the room by the layout; the stack. The overlay panel's `data-fixed="start"`.
4. 787b on the filter column.
5. Specs by real pointer and keys, three engines; the shell, overlay-panel, canvas, node-panel and
   node specs; Demos: Records, the Node Editor and the Query editor.
6. Traps, guide, generated files, the map.
