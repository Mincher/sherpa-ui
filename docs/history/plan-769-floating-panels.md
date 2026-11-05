# Plan 769 — a floating panel is a state of a panel

Will, 2026-11-05: "A floating panel should just be a state of a fixed, or overlay,
panel which is toggled from a button in the header. Floating panels should also be
draggable, to position them anywhere, and show a drag handle in the header on hover.
Returning a floating panel to docked should put it back in it's original location."
And: "Floating panels should support resizing, too, with a min width & height. Show a
resize handle on the bottom right on hover."

## The words

Three places a panel can be. Two are DOCKED, one is not.

| Word | Is |
|---|---|
| **Overlay** | docked on the window's right edge, over the page (the overlay panel's default) |
| **Fixed** | docked in the app shell's end panel area, in the flow (`data-fixed`) |
| **Floating** | free: anywhere in the window, dragged by its header, resized by its corner (`data-floating`) |

Floating is a state OF an overlay or a fixed panel: `data-fixed` says where it docks,
`data-floating` says it is lifted off for now. Dock puts it back there.

## Which panels

| Panel | This lane? |
|---|---|
| `sherpa-overlay-panel` on the right edge | **Yes** |
| `sherpa-overlay-panel` fixed in the shell's end area | **Yes**, the same code: floating, it leaves the area as Pop out does, and the area gives the Context its width back through the watch it has. The shell needs no change |
| The node inspector | **Yes**, free: it is an overlay panel (Demos sets `data-floatable`) |
| The filter column in the start area (`sherpa-quick-filter-toolbar`) | **Waits (769b)**. It is not a panel with a header: it needs the overlay panel to pop into the START area too, or a header button of its own |
| The Nodes card (`sherpa-node-panel` in the canvas's `panel` slot) | **Waits (769c)**. It can use the same helper (below), with the canvas as its bounds, but needs a header button and the canvas to drop `has-panel` while it floats, so the banners take the full top. No second implementation: the helper is shared |

## Decisions, with my pick

| # | Decision | Pick |
|---|---|---|
| D1 | The state's name | **`data-floating`** (boolean): the state AND the door, as `data-fixed` is. Set it and the panel floats; remove it and it docks. Free: the tooltip's `data-floating` went in plan 364. CSS reads `:state(floating)`, set once the panel has left the area |
| D2 | The button's flag | **`data-floatable`** shows it, as `data-poppable` shows Pop |
| D3 | The box | **`data-x`, `data-y`** (px from the window's top left; the node's names for a place) and **`data-width`, `data-height`** (px). Where and how big it floats. The panel writes them at the end of each move or resize, from what it DREW, and keeps them while docked. A host hands them back |
| D4 | The header button | Icon `browser`, "Float"; floating, `sidebar-flip`, "Dock". Order: the host's actions, then Float, Pop, the Maximise·External pair, then Close |
| D5 | Pop in / Pop out | **Stays**: it says where the panel DOCKS. Hidden while floating. Float is hidden while maximised; Maximise stays while floating (Minimise brings it back to its place) |
| D6 | Drag | **The whole header bar** moves it, not its buttons; the cursor is `grab`. A grip (`drag-handle-vertical`, the node's look) shows on hover and focus, first in the toolbar. A press moves 4px before it is a drag, so a click on the title does nothing |
| D7 | Bounds | **Inside the window**, by a CSS `clamp()`. A window made smaller re-clamps it live; the place asked is kept, so a bigger window gives it back |
| D8 | Resize | **The bottom-right corner**, the node's look (two diagonal lines), shown on hover, focus and while held. The left edge goes while floating |
| D9 | Min and max | Min **20rem × 12rem** (320 × 192px, the overlay panel's own floor): `--sherpa-panel-float-min-width` and `--sherpa-panel-float-min-height`, knobs with fallbacks, as the shell's `--sherpa-panel-area-min-width`. No Figma token holds a panel size. Max: the window |
| D10 | The first float | **Lifts in place**: its docked box, 16px in on each side (the layout grid's padding), so it visibly lifts. Later floats: the kept box |
| D11 | Dock | **Back where it came from**: the right edge at its docked width (`--_width`, untouched by floating), or the fixed area (`data-fixed` is kept, so it pops back in). The floating box is kept for next time |
| D12 | One at a time | Floating **leaves the right edge**, as a fixed panel does: another panel opening there does not shut it. Docked back on the edge, it takes the edge again. A floating panel is drawn over the edge (z-index 102). Raise-on-press between two floating panels waits |
| D13 | Remembered | The panel REPORTS, the host keeps (PRINCIPLES 21). Demos: SessionStore `/panels/float/<id>` = `{ floating, x, y, width, height }`, `persist(…, { shared: false })`: the tab's own |
| D14 | Events | `panel-float { floating }` on a press; `panel-move { x, y }` on release or a key; `panel-resize { width, height }` from the corner, and from the edge, which now says its height too. Setting an attribute reports nothing, as with `data-fixed` |
| D15 | Keys (parity) | The grip is a tab stop (`role="button"`, "Move panel"): the arrows move it 16px, Shift 64px. The corner is a tab stop ("Resize panel"): Right and Left widen and narrow, Down and Up grow and shrink, the same steps. Both exist only while floating. No modifier, so no `primaryKey` |
| D16 | Forced colours, motion | The grip and the corner's lines are CanvasText; the panel keeps its border. No transition is added, so there is no motion to gate |
| D17 | A11y | Each handle has a label and a `title` naming its keys; the focus ring is inside the box; a press on Float or Dock keeps focus on the button (the move keeps it, as Pop does) |
| D18 | Shared piece (D5) | **`src/core/ui/drag-xy.ts`**: `dragXY(handle, { measure, apply, keys, step, starts, slop })`, a 2D pointer drag plus the arrows, beside `edge-resize.ts`. The overlay panel uses it twice (move, corner). The node panel (769c) takes it as is; the node's own drag could, once it takes a zoom |

## Build order

1. `drag-xy.ts`, with a node unit test of nothing (it needs a DOM): proved through the panel's specs.
2. `sherpa-overlay-panel`: the props, the button, the grip and the corner in the template, the
   CSS (`:state(floating)`, the clamp), `#place` taking floating into account, the box.
3. Specs (real pointer and keys, three engines): toggle; drag by the header; bounds; resize to
   the min and no smaller; dock to the edge and to the area, each at its own place and size;
   keys; the events. The overlay-panel, app-shell and node specs again.
4. Demos: `data-floatable` on the Assistant, the details and both inspectors; the box kept in the
   session; a spec that floats the Assistant from the area and docks it back.
5. Spec, manifest, reference, a trap (`T-a-floating-panel-is-a-state`), the map.

## What was built, and what waits

Built: D1 to D18 on `sherpa-overlay-panel`, and `drag-xy.ts`. Demos: Ask N-zo, the Records
details and both inspectors are `data-floatable`; `app/panel-float.js` keeps each box for the tab.

- **769b — the filter column floats.** It is a `sherpa-quick-filter-toolbar` in the START area,
  with no container header. The short way: let an overlay panel pop into either area
  (`data-fixed="start"`), and wrap the column in one; it then floats by this same code.
- **769c — the Nodes card floats on the canvas. Built** (2026-11-05, with 786 and 784).
  `sherpa-node-panel` takes `data-floatable`, `data-floating` and the box, the same Float /
  Dock button, grip and corner, and the same events. The SAME code: `src/core/ui/float-box.ts`
  (draw, lift, and the bar and corner by `dragXY`) and `src/core/sherpa-float.css` (the clamp,
  the grip, the corner, picked by class), which the overlay panel now uses too. Its room is its
  canvas: floating, the canvas gives its `panel` slot the whole canvas and drops `has-panel`,
  so the banners, the toolbar and the minimap take their room back. The first float lifts in
  place, its shadow up a step; its floor is 16rem by 12rem.
- **Raise on press.** Two floating panels draw in page order; a press does not bring one to the
  front yet.
