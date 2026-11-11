# Traps — Menus, tips and overlays

One of the eleven areas of [the traps](../TRAPS.md): each entry is here because its
first `Site:` is in this area (`npm run check:traps` holds it so). 80 entries.

### T-indeterminate-reports-false

A native checkbox that is `indeterminate` reports `checked === false` after a
click.

So trusting the box turned "some are picked" into "clear them" — and the row then
**stuck at NONE**, because clearing an already-empty set is a no-op that the next
click repeats. A two-click intermittent bug.

Read the SET, not the box. `indeterminate` is also a property, never an
attribute.

- Site: `src/components/sherpa-menu/menu-list.ts`

### T-one-tab-stop-per-set

**A set of items — tabs, a chart's marks, a calendar's days — is ONE tab stop,
and the arrows, Home and End move it** (TODO 284; ARIA's composite widgets).
`rovingFocus()` in `core/ui/roving-focus.ts` keeps it, so no component writes its
own roving tabindex.

- Items are FOUND AGAIN at every key and every focus, by a selector: a set that
  re-draws needs no re-wiring.
- **A re-stamp removes the focused node, and focus drops to `<body>`.** So
  `restamp(draw)` reads `activeElement` BEFORE it draws, finds the same item by
  its key after, and refocuses it with `preventScroll`.
- Wire it in `onRender`, once per stamp, with no signal: its listeners are on the
  component's own nodes (`T-abort-controller-per-connect`), and a re-stamp makes
  a new container.
- A handled key is `preventDefault`ed, and the helper — and any listener above
  it — checks `defaultPrevented` first, so an inner set's move is never taken
  twice. Alt, Ctrl and Meta pass through: Alt+ArrowLeft is the browser's Back.
- Slotted light-DOM items are not supported.

- Site: `src/core/ui/roving-focus.ts`
- Site: `src/components/sherpa-tabs/sherpa-tabs.ts`
- Site: `src/components/sherpa-radial-chart/sherpa-radial-chart.ts`
- Site: `src/components/sherpa-gauge-chart/sherpa-gauge-chart.ts`
- Site: `src/components/sherpa-barchart/sherpa-barchart.ts`
- Site: `src/components/sherpa-line-chart/sherpa-line-chart.ts`
- Site: `test/e2e/reforged-chart-keyboard.spec.ts`
- Site: `src/components/sherpa-menu/sherpa-menu.ts`

## Events and listeners

### T-abort-controller-per-connect

`#ac` is aborted on disconnect and **replaced on every connect**.

`connectedCallback` fires again after `disconnectedCallback` — moving an element
in the DOM does exactly that — so ONE controller for the element's whole life
would leave a re-attached component wired to nothing, **silently**.

**Read `this.signal` in `onConnect`, never in `onRender`.** `onRender` runs
ONCE, so a signal read there is aborted by the first move and never replaced.
That froze `data-has-*` on every moved component, and killed the slider's
inputs and the tooltip's anchor (2026-10-14). Never cache it in a field.

**A listener on the element's OWN nodes — its host, or its shadow tree — takes
no signal and is never removed.** It cannot leak: it goes with the node. nav
and dialog removed their host listeners in `onDisconnect` and never added them
back. Only a listener on something ELSE — the document, the window, another
element — needs the signal, so it is wired in `onConnect`.

Related: a variant re-stamp does NOT abort it. See `T-restamp-does-not-abort`.

- Site: `src/core/ui/sherpa-element.ts`
- Site: `src/components/sherpa-slider/sherpa-slider.ts`
- Site: `src/components/sherpa-dialog/sherpa-dialog.ts`
- Site: `src/components/sherpa-layout-grid/sherpa-layout-grid.ts`
- Site: `test/e2e/reforged-layout-grid.spec.ts`
- Site: `test/e2e/reforged-a-moved-element-keeps-its-listeners.spec.ts`

### T-restamp-does-not-abort

A variant re-stamp re-runs `onRender`, which re-adds the component's HOST
listeners — but `addEventListener` **discards a repeat** of the same
(type, listener, capture) triple, and every host listener in this library is a
stable arrow FIELD (`this.#onClick`). Measured: a re-stamped `sherpa-nav-item`
emits `item-click` once.

So `#stamp` does NOT abort `#ac`. Aborting looked prudent and was wrong twice:
it fixes nothing the dedup does not already handle, and it would drop what a
component wired in `onConnect`, which does not run again.

A component that needs `this.signal` should wire in `onRender`, never `onConnect`.

- Site: `src/core/ui/sherpa-element.ts`
- Site: `src/components/sherpa-menu/sherpa-menu.ts`
- Site: `src/components/sherpa-menu/menu-conditions.ts`

---

## Numbers, measurement and timing

### T-an-overlay-panel-resizes-from-its-left-edge

**An overlay panel is 40rem wide by default, never under 20rem nor past 92vw,
and its LEFT edge resizes it** — Will, TODO 22 (it was 30rem, too narrow for
the Ask N-zo chat). The edge is a thin `role="separator"` strip over the
border: a drag makes the panel as wide as the pointer is from its right edge;
ArrowLeft widens and ArrowRight narrows by 16 px (the edge moves the way the
key points), so a keyboard can do what a pointer does. The width lives in
`--_width` on the host, and the CSS `clamp()` is the truth: after each move
the panel writes back the width it DREW, so a key steps from there and a
drag past the floor does not store a width it cannot show. Each resize ends
in `panel-resize { width }`. No Figma design for the handle; it shows only
under the pointer or focus.

- Site: `src/components/sherpa-overlay-panel/sherpa-overlay-panel.ts`
- Site: `src/components/sherpa-overlay-panel/sherpa-overlay-panel.html`
- Site: `src/components/sherpa-overlay-panel/sherpa-overlay-panel.css`
- Site: `test/e2e/reforged-overlay-panel.spec.ts`

### T-a-panel-has-four-modes

**A panel has ONE mode, `data-mode`: fixed, overlay, floating or tab** (Will, 2026-11-09). It replaces `data-fixed`,
`data-overlay`, `data-floating`, `data-minimised` and the Pop in / Pop out move into the shell. Fixed is flat and takes its
area's room; overlay draws over the content with a shadow, the area giving its room back; tab is the strip on the area's edge
(`T-a-minimised-panel-is-a-tab`); floating is off its area, in the host's float layer (`T-a-floating-panel-is-a-state`).
Fixed, overlay and tab are of an AREA: with no host a panel is an overlay on the window's edge, or floating or a tab, and its
Fixed and Overlay buttons are not drawn. The default is fixed in an area. `data-side` (`start`, else `end`) is the ONE orientation.

**The AREA owns how its panels present.** A panel's header buttons, its tab and `minimise()` do not set its mode: they ASK,
with `panel-mode-change { mode, restore? }` (a request, cancelable), and the `sherpa-layout-panels` that holds the panel writes
`data-mode` on the panels in that area (`T-an-area-holds-two-panels-stacked`: fixed panels STACK, overlay and tab are a GROUP,
one open at a time; Will, 2026-11-10). Floating is the exception: it is one panel's own, and takes it out of the area (it is
slotted in `panel-float`, the host's float layer). A floating panel asking to dock, or dropped, joins the area AS IT IS: beside a
fixed panel, fixed; in a group, open, the others its tabs; and not at all where the area holds two. With no area to answer, a
panel writes its own. A tab remembers what it was (`was`), and opens to it (`restore`); in a group with one open, it opens in
the group. `area.dock(panel, side, place)` is the door a drop uses.

**A host places a panel by its slot**: the panel sets its own `slot` from its side and mode (`panel-start`, `panel-end`, or
`panel-float`), as a child of a canvas, a panel area or the app shell. Nothing moves in the DOM: there is no Pop.

- Site: `src/components/sherpa-overlay-panel/sherpa-overlay-panel.ts`
- Site: `src/components/sherpa-overlay-panel/sherpa-overlay-panel.html`
- Site: `src/components/sherpa-overlay-panel/sherpa-overlay-panel.css`
- Site: `src/components/sherpa-layout-panels/sherpa-layout-panels.ts`
- Site: `test/e2e/reforged-overlay-panel.spec.ts`

### T-a-floating-panel-is-a-state

**Floating is one of a panel's four MODES** (`data-mode="floating"`, `T-a-panel-has-four-modes`; Will,
TODO 769; plan `docs/history/plan-769-floating-panels.md`). It lifts a panel off its area, and is the door:
set it and it floats, ask for another mode and it docks back, in its area's own mode. `data-floatable` shows the
Float / Dock button; a press asks with `panel-mode-change { mode }`. The Fixed and Overlay buttons go while it
floats, as Dock says where it goes; Float goes while it is maximised.

- **A floating panel leaves its area for the host's float layer**: it stays a child of the host, with `slot="panel-float"`
  (the panel sets it), so nothing moves in the DOM, and the area gives its room back at once. The float layer is the whole
  layout and lets the press through but on a box's own. Alone, with no host, it floats in the window.
- **Floating** is drawn over the panels open on the edge (z-index 102 and up, the tab's one stack:
  `T-a-pressed-panel-comes-to-the-front`). Docked back on the edge, it takes it again.
- **The box** is `data-x`, `data-y`, `data-width` and `data-height`, in px of the
  window. CSS draws it through `--_float-*` and owns the clamp: never under
  `--sherpa-panel-float-min-width` by `-min-height` (20rem by 12rem), never past
  the window. So a smaller window re-clamps it live, and a bigger one gives its
  place back, as the attributes are what was ASKED. At the end of a move or a
  resize the panel writes back what the clamp DREW, so a key steps from there, and
  reports `panel-move { x, y }` or `panel-resize { width, height }`. The box is
  kept while docked; the first float lifts it in place, 16px in on each side.
- **The header bar moves it**, by `dragXY` in `src/core/ui/drag-xy.ts`, beside
  `resizeByEdge`; a press on one of its controls is that control's. A 4px slop,
  so a click on the title moves nothing. The grip is for the KEYS alone (Will,
  TODO 931): it takes the arrows (Shift: four steps), is never a target, and
  shows only while it has their focus; a pointer on the bar sees no grip, the
  cursor says it. Unfocused it is clipped to a pixel, never `display: none` or
  `visibility: hidden`: a box that is not drawn takes no focus, so the keys could
  never reach it. The corner grows to the window's edge from where the panel is, never
  past it, or the clamp would push its left edge instead.
- **A release outside the window is lost in Firefox** (Playwright's, at least):
  a move with no button held ends the drag where it got to, so the handle is
  never left held.
- **Every panel floats by the SAME code** (769c; the Nodes panel is an overlay panel since 846): `float-box.ts` draws the box
  from the four attributes, lifts it, and wires the bar and the corner by
  `dragXY`; `sherpa-float.css` (a family sheet, picked by `.sherpa-float`, `-bar`,
  `-grip` and `-corner`) owns the clamp, the grip and the corner. Each component
  keeps its own events and says where its box sits: fixed in the window, or
  absolute in the float layer of its host. `--_float-*` are written on the BOX, never the host, so
  a canvas watching its children's `style` hears nothing of a drag.
- **Its room is its PANEL AREA's layout** (TODO 796, `T-a-panel-area-is-a-layout`).
  The card stays slotted: floating, its area takes no width and covers the whole
  layout, the canvas, with `pointer-events: none`, so a press beside the card
  reaches the view; its box takes its own back, and the host no longer sets any
  (inherited from the area, it passes them). The layout hears `data-mode` by
  its MutationObserver, as a host may set it with no event: the banners, the
  toolbar and the minimap take their room back. `roomOf()` finds that layout up
  the flat tree. Docked, the card is flush and flat; the first float lifts it 16px
  in on each side, its shadow `lg`; its floor is 16rem by 12rem, so a card of 18rem
  lifts to the floor and never jumps.

- Site: `src/components/sherpa-overlay-panel/sherpa-overlay-panel.ts`
- Site: `src/components/sherpa-overlay-panel/sherpa-overlay-panel.html`
- Site: `src/components/sherpa-overlay-panel/sherpa-overlay-panel.css`
- Site: `src/core/ui/drag-xy.ts`
- Site: `src/core/ui/float-box.ts`
- Site: `src/core/sherpa-float.css`
- Site: `src/components/sherpa-layout-panels/sherpa-layout-panels.html`
- Site: `src/components/sherpa-layout-panels/sherpa-layout-panels.css`
- Site: `test/e2e/reforged-overlay-panel-float.spec.ts`

### T-a-minimised-panel-is-a-tab

**Minimised is a MODE of an overlay panel: `data-mode="tab"`, a tab turned on its side, snapped flush to the edge of its
area, with a drop shadow** (Will, 2026-11-06). `data-minimisable` shows the header's Minimise button; a press
asks for `tab` with `panel-mode-change`, and the area writes it on every panel in it; the tab asks for what the panel was
(`was`), so it opens as it was.

- **A tab stays in its area**, which is the strip: as wide as the tabs when every panel in it is one, so the content sits beside
  them. In a host the tab is absolute in the layout; alone, `position: fixed` on the window's edge. Tabs stack down
  the edge in the order they were shrunk (`--_tab-index`).
- **`data-updated`** turns the tab active and gives it a "!" (no count yet). `notify()` sets
  it, and so does a new `data-heading` while it is a tab. Opening clears it.
- **The Node Editor's details panel is always there** (Will, 2026-11-06): the editor shows it as a tab at the
  start (`data-mode="tab"`), with an empty state (`sherpa-empty-state`, "No node selected") in it; a pick FILLS
  it and never opens it; a click on blank canvas puts the empty state back, and the panel is never hidden by
  the editor, only by its teardown.
- **One panel keeps its state** through `hide()` and `show()`: shut while a tab, it opens as a tab again
  (the node inspector is shown and hidden on a pick, and keeps where the reader left it).

- Site: `src/components/sherpa-overlay-panel/sherpa-overlay-panel.ts`
- Site: `src/components/sherpa-overlay-panel/sherpa-overlay-panel.html`
- **A panel in a canvas or the shell does the same**, on the edge of its area: with no fixed panel the layout gives the area's room back
  but for the strip, and the tab, absolute in the layout, takes the press (`T-a-panel-slotted-in-a-layout-is-docked-there`).

- Site: `src/components/sherpa-overlay-panel/sherpa-overlay-panel.css`
- Site: `src/components/sherpa-layout-panels/sherpa-layout-panels.ts`
- Site: `test/e2e/reforged-overlay-panel-minimise.spec.ts`

### T-an-area-holds-two-panels-stacked

**An area holds TWO panels at most** (Will, 2026-11-09). FIXED, they are a STACK: two rows of the area, each half its height with
the card gap between (`:state(start-stack)`). OVERLAY or TAB, they are a GROUP (Will, 2026-11-10): each panel its own tab on the
edge, and ONE open at a time — one opened as an overlay tabs the other, so two overlays never lie on each other. A third panel
slotted there is hidden, and said so once in the console. The area writes the modes (`T-a-panel-has-four-modes`): fixed on both;
an overlay on the one asked and tab on the other; a tab on the one asked, and on a fixed one beside it (a stack shrinks together).
A panel that floats leaves it; one that docks or is dropped joins it as it is.

- **Overlay or tab: the area gives its room back.** With no fixed panel the area covers the layout and lets the press through
  (`:state(*-floating)`); with a tab it is the strip, as wide as the tabs, so the content sits beside them, and a group's open
  overlay stands beside the tabs (`--_tabs-inset`), never over them. A peek stays where its tab was, so the pointer stays on it.
- **A tab is the edge's**: each tab stacks down the edge; opening one in a group opens it there, whatever it was before it shrank.
- **Shown** means open: a shut panel takes no row.

- Site: `src/components/sherpa-overlay-panel/sherpa-overlay-panel.ts`
- Site: `src/components/sherpa-layout-panels/sherpa-layout-panels.ts`
- Site: `src/components/sherpa-layout-panels/sherpa-layout-panels.css`
- Site: `test/e2e/reforged-panel-area-tabs.spec.ts`

### T-a-dragged-panel-docks-where-the-area-lights-up

**Dragging a FLOATING panel by its header lights up the area it would dock in, like a window-tiling assistant** (Will,
2026-11-09). The panel reports where the POINTER is (`panel-drag { x, y, phase: move | end | cancel }`, from `dragXY`'s
`track`, through `FloatBox`'s `dragged`); the layout it floats over decides, and draws the zones from its own template.

- **A distance threshold, ONE place**: `--sherpa-panel-dock-threshold` on the layout (4rem). Within it of the layout's left or
  right edge (and over its height) an area lights; further, nothing. The nearer edge wins in a narrow layout.
- **What lights.** An empty side: ONE card at its edge, the width an area would take (`.zone-solo-*`). A side with ONE fixed
  panel: the area splits as it will stack, and the NEW half is lit (`.zone-*`, first or last row of the area), by the pointer's
  height: the upper half of the layout is above the panel there, the lower below. A side whose panel is an overlay or a tab has
  no room to share: a card at the edge, and the drop joins its GROUP, open, the other its tab. A side with TWO lights nothing (max 2).
- **A drop on it docks**: `dock(panel, side, place)`, in the area's current mode, `data-side` set; the layout reports
  `panel-dock { side, place: top | bottom | only }` and the shell and the canvas say it again as their own. A drop elsewhere
  leaves it floating. **Escape** clears the zones and the drop lands nowhere; the panel stays where it was dragged to.
- **A reader with no pointer** docks a floating panel with its header's Fixed button, or `requestMode('fixed')`: it joins
  the area its `data-side` names, as the second panel where one is there (`T-a-panel-has-four-modes`).
- The zones take no press (`pointer-events: none`), draw with `--sherpa-style-indicator-accent`, and are `Highlight` in forced colours.

- Site: `src/components/sherpa-layout-panels/sherpa-layout-panels.ts`
- Site: `src/components/sherpa-layout-panels/sherpa-layout-panels.css`
- Site: `src/components/sherpa-layout-panels/sherpa-layout-panels.html`
- Site: `src/components/sherpa-overlay-panel/sherpa-overlay-panel.ts`
- Site: `src/components/sherpa-overlay-panel/sherpa-overlay-panel.html`
- Site: `src/core/ui/float-box.ts`
- Site: `test/e2e/reforged-panel-dock-assist.spec.ts`

### T-a-node-list-is-a-panels-content

**The Nodes panel is an overlay panel with `sherpa-node-list` in it** (Will, TODO 846: ONE panel system). The old
`sherpa-node-panel` was its own `sherpa-container` card with its own copy of float, dock, minimise, the grip and
the corner (`FloatBox`); the overlay panel already had every state, so the card is gone and the list is the
panel's content: `populate(paletteOf(kinds))`, `node-add`, `askAdd()`, the tabs, the search, the sticky headings and
the drag off the panel. The panel is slotted into the canvas's `panel` slot (`T-a-panel-slotted-in-a-layout-is-docked-there`),
`data-padding="none"` (the list fills the body), `data-floatable`, `data-minimisable`. The floating floor is the
panel's 20rem, not the card's 16rem. The panel keys read the overlay panel (`minimise()`, `front()`, `minimised`,
`side`, `tabbed`, `shown`).

- **A menu a panel's content opens needs its anchor and its ghost FIXED.** "Add a node" is a top-layer popover
  anchored to a point; the point was an absolute element inside the list, and the panel's `overflow: hidden` body
  (and the canvas's) clipped it. The card painted, and a press on it fell through to the page. Measured by
  `elementsFromPoint` and a real click: the anchor and the drag's ghost are `position: fixed`, in window coordinates.

- Site: `src/components/sherpa-node-list/sherpa-node-list.ts`
- Site: `src/components/sherpa-node-list/sherpa-node-list.css`
- Site: `src/components/sherpa-overlay-panel/sherpa-overlay-panel.css`
- Site: `src/components/sherpa-overlay-panel/sherpa-overlay-panel.ts`
- Site: `test/e2e/reforged-overlay-panel-padding.spec.ts`

### T-an-overlaid-panel-keeps-its-side

**A panel docked to the start area, and overlaid out of it, stays on the START edge** (Will, TODO 858: the filter panel
came up on the right). Pop (Dock as overlay) took `data-fixed` off a panel in the shell's area, and a panel with no
`data-fixed` is the right-edge overlay, so it jumped across the window; the app kept `fixed: false`, so every reload
put it there. `data-side` (`start` | `end`) is the orientation, and a panel overlaid with
`data-side="start"` takes the start edge. The app keeps it beside `fixed`, and its own markup names the side too,
for a state kept before this existed.

- Site: `src/components/sherpa-overlay-panel/sherpa-overlay-panel.ts`
- Site: `src/components/sherpa-overlay-panel/sherpa-overlay-panel.css`
- Site: `test/e2e/reforged-overlay-panel-side.spec.ts`

### T-a-panel-owns-its-search-row

**A panel's search is the PANEL's, in its header** (Will, TODO 860). `data-searchable` stamps a `sherpa-input-text` row, the
header's full width, into the header's metadata slot (`stampOnce`); `data-search-placeholder` is its placeholder and
label. The panel owns the input, its clear (x) and Escape, and says `panel-search { value }` as it changes; `search` reads
it, and set, types it. No content holds a search box: the filter panel hears `panel-search` and finds in every section,
the node list narrows its items by it. The old filter-panel clone in the `description` slot, and the node list's own box, are gone.

- Site: `src/components/sherpa-overlay-panel/sherpa-overlay-panel.ts`
- Site: `src/components/sherpa-overlay-panel/sherpa-overlay-panel.css`

### T-a-panel-folds-its-groups-into-the-more-menu

**A narrow panel folds its button groups into one "More actions" menu, a group at a time** (Will, 2026-11-06, TODO 865). The
header measures its own TITLE: while the title has less than 112px, the next group goes, in the order modes, docks, then the
content's own actions; the title is the last thing cut short. A folded group's controls become rows of the menu, and a row
presses the control it stands for (its inner button: a press on the host is no control press). The measure RESETS first, then
re-measures after each fold, as the filter bar's reflow does (`T-reflow-resets-before-measuring`). The menu is loaded the first
time something folds. The content's own ⋮ (the `overflow` slot) is a separate group and never folds.

- Site: `src/components/sherpa-overlay-panel/sherpa-overlay-panel.ts`
- Site: `test/e2e/reforged-overlay-panel-fold.spec.ts`

### T-a-panel-divides-only-between-shown-groups

**A header divider is drawn only BETWEEN two groups that each show a control** (Will, TODO 860: an orphan divider before the
minimise button). The groups are the content's `actions`, the panel's own buttons, the page's `actions-end` and the ⋮,
then close. A clone the content hides is no control, which CSS cannot read from a slot, so the panel says it with
`:state(shows-actions)` and `:state(shows-end)`, set from its direct children's `hidden` and `slot`; the rest is CSS.

- Site: `src/components/sherpa-overlay-panel/sherpa-overlay-panel.ts`
- Site: `src/components/sherpa-overlay-panel/sherpa-overlay-panel.css`
- Site: `test/e2e/reforged-filter-panel.spec.ts`

### T-a-panel-slotted-in-a-layout-is-docked-there

**An overlay panel SLOTTED into a canvas's `panel` slot, or a panel area's own, is docked there by its
markup** (Will, TODO 846: ONE panel system, the Nodes card onto the overlay panel). It does not pop (no shell to
move into): `#slotted()` reads its parent and slot, and the panel is `in-layout`. Docked, it is `in-area`:
static, flush, no shadow, the area's width. Floating, it is `position: absolute` and its room is that
layout (`roomOf`), not the window; the area under it covers the layout and passes the press through, but on
the box (`pointer-events: auto`). Minimised, its tab is `absolute` in the layout, on that area's edge
(the left for the canvas's `panel` slot), stacked per layout; the layout gives its width back, as for floating.

**`panel-close { reason }`** says why a panel shut: `reader` (the default), `width` or `page`, from
`hide(reason)`, where the filter column's own `filter-panel-close` said it (TODO 847). The header gained a
`badge` slot beside the title (a count: the filter panel's applied filters).

- Site: `src/components/sherpa-overlay-panel/sherpa-overlay-panel.ts`
- Site: `src/components/sherpa-overlay-panel/sherpa-overlay-panel.html`
- Site: `src/components/sherpa-overlay-panel/sherpa-overlay-panel.css`
- Site: `test/e2e/reforged-overlay-panel-in-a-layout.spec.ts`

### T-a-panel-peeks-from-its-tab

**A panel is FIXED or an OVERLAY, and a tab may peek it open** (Will, 2026-11-06). Docked, a panel is either FIXED
(flat: no shadow, no rounding; it takes its area's room) or an OVERLAY on the content (a shadow and a rounded
leading edge; its area gives the room back). `Pop` toggles them in every panel: on the window, `data-fixed` is the
shell's area (absent: an overlay on the edge); slotted in a layout, `data-overlay` is the overlay (absent: fixed).
TWO docking buttons set them (Will, 2026-11-06, TODOs 854, 864): a tab shown on hover, or a FIXED panel, **Dock as overlay**; an
overlay, **Dock as fixed**; the one of the state it is in is off. There is never a hover and fixed together: a hover opens over the content. The
box keeps its width across the swap (the overlay takes its area's width; the area takes the overlay's). `dockState`
says which of `floating`, `tab`, `hover`, `overlay`, `fixed` it is; Float lifts it, and Dock puts it back as it was.

- **`data-hover-open`**: while the pointer is on a minimised panel's TAB, the panel shows as a docked overlay at its
  edge (`:state(peeking)`); the pointer leaving the tab and the panel shuts it to the tab after 250ms, unless the
  focus is in it. It never changes `data-minimised`: pressing the tab still opens it for good.
- A slotted panel counts as floating for its layout's room while it is an overlay, a tab or floating
  (`T-a-panel-area-is-a-layout`).

- Site: `src/components/sherpa-overlay-panel/sherpa-overlay-panel.ts`
- Site: `src/components/sherpa-overlay-panel/sherpa-overlay-panel.css`
- Site: `test/e2e/reforged-panel-overlay.spec.ts`

### T-a-pressed-panel-comes-to-the-front

**Every floating box in the tab is in ONE stack: a press on one, or a focus into
it, brings it to the front** — Will, TODO 787c. `float-box.ts` keeps the stack (a
static list, back to front) and writes each box's place as `--_float-order`;
`sherpa-float.css` draws `z-index: calc(102 + order)`, over a panel docked on the
right edge (101). Floating puts a box at the front; opened floating, it comes
forward; docked, it leaves the stack. A focus raises it too, so a keyboard reader
brings one forward with Tab. The order is the page's, for the tab: not kept over
a reload. A box gone from the page leaves at the next raise.

**It orders boxes that share a stacking context.** So nothing between a floating
box and its neighbours may make one: the canvas lost its `isolation` and its
`container-type` (the stage is the container now), and the panel-area layout and
a floating area make none (`T-a-panel-area-is-a-layout`). Measured: the Nodes card
floating in its canvas and an overlay panel floating beside it each come in front
of the other when pressed. **A page is no stacking context of its own** (Will, TODO
823): the outlet no longer isolates each element of a Context
(`T-a-reach-banner-takes-no-room`), so on the Node Editor page, and on a page's
filter graph, which is that page (822), the floating card and the inspector beside
it each come to the front on a press or a focus, and the inspector still covers the
app header (746 E4). Moving the inspector into the canvas's box had shared the
order but put it UNDER the header. **A box in another context cannot pass it**: one
inside the shell's content (which isolates) never rises over one floating in the
window, as the Node Editor's own inspector and the Assistant.

- Site: `src/core/ui/float-box.ts`
- Site: `src/core/sherpa-float.css`
- Site: `src/components/sherpa-overlay-panel/sherpa-overlay-panel.ts`
- Site: `src/components/sherpa-layout-panels/sherpa-layout-panels.css`
- Site: `src/components/sherpa-layout-canvas/sherpa-layout-canvas.css`
- Site: `test/e2e/reforged-layout-panels.spec.ts`
- Site: `test/e2e/reforged-outlet-layers.spec.ts`

### T-a-tree-rule-beats-slotted

**A rule in the tree a slotted element lives in beats the component's own
`::slotted` rule — whatever its specificity** (Will, 2026-10-15, TODO 301). A
menu's `<button>` rows are light DOM of whoever slots them: the toolbar's or the
panel's shadow root. The base sheet, adopted into every shadow root, said
`:where(input, button, option, select) { padding: 0 }` — specificity ZERO — and
it won over the menu's `padding: 8px` on `::slotted(button)`: the outer tree's
context wins. So "Save view as" and "Delete view" had no horizontal padding in
an app, and a bare page showed nothing wrong. The reset now skips a menu's
direct `<button>`.

**Hover is grey.** The rows shaded a `--_surface` the toolbar's own buttons had
set, and the row's own `currentColor`, so some hovers were tinted by the host
and a red row's by its red. The menu pins its own `--_surface`, and a row
mixes it with the neutral body ink.

**How it was found:** a probe on a plain menu said all was well. A scan of every
menu in the running app, listing rows with no inline padding and rows whose
hover was not neutral, found both.

- Site: `src/core/sherpa-base.css`
- Site: `src/components/sherpa-menu/sherpa-menu.css`
- Site: `test/e2e/reforged-a-menu-row-in-a-toolbar.spec.ts`

### T-a-menu-takes-no-grouping

**A menu opened from a GROUPED button wore that button's grouping** — TODO
119, Will: the filter panel header's Reset menu had the `end` style. Grouping
is eight INHERITED custom properties (`--sherpa-border-*`), and a slotted
`sherpa-menu` is a child of its button, so it inherited them: its card drew
with square left corners. A menu is its own surface, so its `:host` states
the solo values, and nothing above it reaches the card. Every grouped button
with a menu had this — the toolbar's Reset and Save groups too.

- Site: `src/components/sherpa-menu/sherpa-menu.css`
- Site: `test/e2e/reforged-menu.spec.ts`

### T-a-number-input-wears-sherpas-steppers

**A number a reader types goes in `sherpa-input-text data-type="number"`** —
TODO 127, Will: *"We've already fixed this before but seem to reintroduce the
mistake."* It is Figma's `Input Number` (937:39395): the Input Field, its
value right-aligned, and two `Button / Type=icon` in the Transparent look,
`chevron-up` and `chevron-down`. An empty one says "Enter a value".

The control is still `<input type="number">`, for the platform's own check,
arrow keys and `stepUp()`; its native spinner is hidden in CSS. The steppers
are composed `sherpa-button`s that call `stepUp()` / `stepDown()` and report
`input` and `change` as a keystroke would — and nothing at a bound, where the
value did not move. They are out of the tab order (`data-no-tab`, new on
`sherpa-button`), because ArrowUp and ArrowDown in the field do the same.
`mirrorAttrs` removes what the host does not carry, so the number type puts
back its `type`, its `inputmode` and its placeholder after each mirror.

**Why it came back.** A `sherpa-input-number` component existed and was pruned
(`47dc974e`); each place that needed a number then wrote a bare native input.
So it is GATED: `test/unit/a-number-input-is-sherpas.test.mjs` fails on any
component template that holds a bare `<input type="number">`. ONE is allowed:
the number field itself. Will, 2026-09-30: *"all numerical inputs should use
Sherpa's style"* — so the filter menu's value, the slider's value boxes and
the pagination's page box are all this field. (Figma draws the pagination's
page box with no steppers; Will's word is followed.)

**A stepper with nowhere to go is inactive**: Increase at `max`, Decrease at
`min`. An empty field can step either way.

**A NARROW field gives the room to its digits.** The field is its own query
container; under 9rem its steppers are 24px and under 6rem 20px, set through
the button's own `--sherpa-button-size-height`. Not `::part(trigger)`: WebKit
applies no `::part()` rule inside a container query — the gap changed and the
buttons did not. Contained, the field has no width of its own, so it keeps a
10rem floor, which a composer with a width of its own sets to 0.

**A composer stops the field's events.** The field reports `input` and
`change` with `{ value }`, composed. The slider, the pagination and the menu
each answer it and report their OWN event, so they stop it — and act only on
the field's own event, never the native one that arrives with it.

**The slider's fields sit UNDER the track, in one row, half each** — Will,
2026-09-30 — at any width, so two never stack. A lone field takes the second
half.

- Site: `src/components/sherpa-input-text/sherpa-input-text.ts`
- Site: `src/components/sherpa-input-text/sherpa-input-text.html`
- Site: `src/components/sherpa-input-text/sherpa-input-text.css`
- Site: `src/components/sherpa-menu/sherpa-menu.html`
- Site: `src/components/sherpa-slider/sherpa-slider.html`
- Site: `src/components/sherpa-pagination/sherpa-pagination.html`
- Site: `test/e2e/reforged-input-number.spec.ts`
- Site: `test/unit/a-number-input-is-sherpas.test.mjs`

### T-a-menu-is-a-dialog-of-native-controls

**`sherpa-menu`'s card is `role="dialog"`, not `role="menu"`** — TODO 117. An
ARIA menu may hold only menu items, and this one holds native checkboxes,
radios, inputs, buttons and a footer with Apply: real form controls, which
keep their own native semantics and need none written over them. So the card
is a small non-modal dialog, ALWAYS named — its heading, else the host's
`aria-label`, else "Menu" — and every trigger says `aria-haspopup="dialog"`.
The same finding, the same answer, in four more places: a chart legend is a
GROUP of toggle buttons (a `listitem` may not take `aria-pressed`); a transfer
list's panes are plain lists of checkbox rows, not listboxes; a bar or line
chart's plot is a GROUP, because an `img` hides the named marks it holds; and
`sherpa-list` is `role="list"` on a `<div>`, since a `<ul>` may hold only
`<li>` and a slotted row is a custom element — the list names each slotted
row a `listitem`. A calendar's cells sit in `role="row"` boxes that are
`display: contents`, so they still lie on the grid.

- Site: `src/components/sherpa-menu/sherpa-menu.ts`

### T-a-page-sheet-is-for-what-a-component-puts-in-the-page

**A component that puts light DOM in the PAGE styles it with a page sheet, not
TS** (TODO 344). `SherpaToast.show()` puts a toast in a shared stack on
`<body>`; no shadow sheet reaches that stack, so its layout was `style.cssText`
in TS. Now the stack is cloned from the toast's template, and its CSS is
`sherpa-toast-stack.css`, named by `static pageCss`.

The base ADOPTS a `pageCss` into `document.adoptedStyleSheets`, once (one
shared sheet object), after the page's own, and AWAITS it with its own sheets
before the first stamp, so the stack never draws unstyled in a fetched build.
It adopts again if a page replaced the list wholesale. Its rules sit in
`@layer components` and are narrow (`body > .sherpa-toast-stack`), so a page's
own CSS wins and an app's own container with the class is left alone.

A toast in the stack says so with `:state(stacked)`, not a public attribute:
`:host` cannot see its parent, and a custom state is private host state. Its
rule comes BEFORE `:state(leaving)`, so a leaving toast still takes no pointer.
`show()` still makes one `<sherpa-toast>` with `createElement`: one component,
no structure. A constructed sheet needs no `'unsafe-inline'`, so it runs under
the strict CSP.

**The second use: a NAME that several shadow roots share.** WebKit matches a
timeline name only inside one tree, so the metric group names its timelines in
a page sheet, on its own hosts (TODO 402,
`T-a-metric-group-knows-it-is-stuck`). Use it for that, never for what a
`:host` rule can say.

- Site: `src/core/ui/templater.ts`
- Site: `src/core/ui/sherpa-element.ts`
- Site: `src/components/sherpa-toast/sherpa-toast.ts`
- Site: `src/components/sherpa-toast/sherpa-toast-stack.css`
- Site: `src/components/sherpa-metric-group/sherpa-metric-group-page.css`
- Site: `scripts/lint-css.mjs`
- Site: `test/e2e/reforged-toast.spec.ts`

### T-a-gap-click-is-the-menus-own

**A click in a popover menu that lands on no control is the menu's own.** The
card is drawn in the top layer, but in the DOM the menu is still inside its
host — so a click on the padding or between rows bubbled to an accordion's
`<summary>` and toggled it (TODO 106), and would reach any click listener
behind it. The menu calls `preventDefault()` (no `<summary>` or link acts) and
`stopPropagation()` (no listener hears it). A row is a native control, so the
control is the click's target and does its job; an inline menu is not drawn
over anything, so it is left alone.

- Site: `src/components/sherpa-menu/sherpa-menu.ts`
- Site: `test/e2e/reforged-menu-gap-click.spec.ts`

### T-the-baseline-is-taken-at-show

**A committing menu takes its baseline — what Cancel restores — in `show()`,
the moment the card opens.** Not in `toggle`: the browser fires that as a TASK
later, and a tick in the gap was taken INTO the baseline, so it was not a draft
— `dirty` read false and a remote chip was never pending (TODO 95). Firefox
runs the task later than Chromium, so only Firefox showed it. `toggle` still
takes one for an open that did not come through `show()`; a close clears the
flag.

An open menu's listeners start in `show()` for the same reason. An Escape in the
gap reached no listener, and the menu stayed open (found by `reforged-nav`, which
failed 1 run in 3).

- Site: `src/components/sherpa-data-grid/grid-filters.ts`
- Site: `src/components/sherpa-menu/sherpa-menu.ts`

### T-a-number-is-reset-not-cleared

A number menu's footer button is **Reset**, not Clear — Will, TODO 134: its
field goes empty and its slider's handles go back to the bounds, in BOTH
shapes, and the filter goes with them at once, as Clear's does.

Clear had done NOTHING to a number. Its sweeps are
`this.querySelectorAll('input' | 'sherpa-calendar' | 'sherpa-slider')` — the
menu's SLOTTED children — and the number body moved into the menu's own
shadow root (`T-a-menu-owns-its-own-bodies`). The button emitted `menu-clear`
and a `menu-change` that still carried both ends, so the chip stayed on.

Both buttons exist in the template and CSS shows one: `.reset` where
`data-body="number"`, `.clear` everywhere else.

- Site: `src/components/sherpa-menu/sherpa-menu.ts`
- Site: `test/e2e/reforged-number-filter-reports.spec.ts`

### T-one-number-is-a-pick-under-equals

**One typed number is a PICK under `=`, and typed TEXT only under an op that
takes text** (`<`, `>`, `≤`, `≥`). `OP_TAKES.eq` is `list`, so `fieldState()`
reads `{ op: 'eq', text: '100' }` as unanswered: the reading reached the source
and filtered nothing. The bar sent a single number that way from the day its
body moved into the menu — TODO 104 found it on the Records page, where 100
rows stayed 100.

The menu decides it once, in its own `reading` (`#bodyReading()`), for the bar
and the panel: `{ picked: ['100'], op: 'eq', range: false }` under `=`, and
`{ op: 'gt', text: '100' }` under `>`. Restoring a chip reads `text` first,
then `picked`, so both shapes round-trip. The test binds a real source and
counts ROWS, because the event alone was not enough to prove it.

**And any field with NO list to pick from** — Will, TODO 112: *"This bug
applies to any advanced filter's condition input that has a dropdown (select)
for an 'equals' condition. The list isn't populated."* A field that answers by
conditions only (`advanced: 'only'`) lists no values, so its Equals select was
empty — WebKit would not even open it. Its Equals and Not equals are TYPED
now, as a number's are, and answer as the one value they pick
(`#typesItsPicks()`). Rows ask again whenever the values come or go.

**A number lists its values too** — Will, TODO 668: *"Advanced filter 'EQUALS' rows
are not showing a Select input to choose from a list of unique values in the filter
field."* An Advanced number keeps the distinct values its rows hold, in number order,
as `listed` in its filter definition — NOT `options`, which a grid and a bar draw as
rows to tick, so its Simple body grew a list under the number box. The menu takes
them as `listed`, and its Equals and Not equals pick from them; `>`, `<` and Between
stay typed. The catalogue keeps them apart from the field's domain, so it is still a
number to every chip, count and clause. A number with no values yet still types.

- Site: `src/components/sherpa-menu/sherpa-menu.ts`
- Site: `src/components/sherpa-menu/menu-conditions.ts`
- Site: `src/components/sherpa-menu/menu-number.ts`
- Site: `test/e2e/reforged-number-filter-reports.spec.ts`
- Site: `test/e2e/reforged-advanced-rows.spec.ts`

### T-projected-slot-content-crosses-two-shadow-boundaries

A component that projects content into its HOST's slot can only do so from the
host's LIGHT DOM. Move it into the host's shadow root and the projection stops
— silently, with an empty slot rather than an error.

`sherpa-calendar` puts its month stepper into `sherpa-menu`'s `header` slot.
That is why a date body cannot move into the menu's shadow root with the number
body: it would have nothing to project into. The menu stamps it into its light
DOM instead. TRAP T-a-menu-owns-its-own-bodies

- Site: `src/components/sherpa-menu/sherpa-menu.html`

### T-range-switch-swaps-not-rebuilds

A NUMBER or DATE chip's menu leads with a Range switch: ONE filter, two shapes
("equals this" / "between these two"). Two chips would make the user pick the
shape before knowing which they want.

The flip writes `data-range` on the MENU. **NOTHING is rebuilt** — both the
field and the two-ended slider exist from the start and CSS reveals one — so a
value typed on one side survives a flip back. The calendar reads the same flag
as its own `data-type`: `range` is a two-click start→end selection with the days
between banded, and its previous single pick is left alone, because re-picking
is how a range is started anyway.

The switch comes FIRST, above the calendar: it decides what the calendar below
it IS, so reading it after the grid would be backwards.

Flipping also moves `data-commit` (see `T-commit-follows-select-mode`) unless
the definition pinned it, and it is REPORTED — the filter's SHAPE changed, so
what it means changed with it, and a host reading `values` needs to hear that
even though no value moved. The menu says it as it says a value change: a
plain `change` for an inline host, its draft marked dirty for Apply, and
`menu-change` where it does not wait. When the menu took over its own bodies
the flip kept only `menu-range-change`, which nothing hears, so a switch to
Range filtered nothing until an end was moved — TODO 131. Since TODO 375 the
switch is a DATE's only: a number's range is an Advanced row.

`sherpa-switch` re-dispatches its native `change` as a COMPOSED one, which is
why this reaches the toolbar where a bare checkbox's would not.

`time` joins this list later — the same calendar with `data-has-time`, not a new
template.

- Site: `src/components/sherpa-menu/sherpa-menu.ts`

---

### T-variant-attrs-or-one-way-door

`static variantAttrs` names the attributes `templateId` reads, so changing one
RE-STAMPS the tree. A multi-template component MUST list them.

The base class cannot work them out: `templateId` is an INSTANCE getter, and
`observedAttributes` is read off the CONSTRUCTOR before any instance exists.

Left empty it is a silent ONE-WAY DOOR — the variant is whatever the element
was BORN with. That is what `data-multiline` did on `sherpa-input-text`: the
textarea template existed and was unreachable after first render.

- Site: `src/core/ui/sherpa-element.ts`
- Site: `src/components/sherpa-menu/sherpa-menu.ts`
- Site: `src/components/sherpa-input-text/sherpa-input-text.ts`

### T-slot-guards-only-when-filled

**A prop's text never goes INTO a box that holds a `<slot>`.** A `textContent`
or icon write replaces the box's children, the slot with them. It was guarded
by `skipWhen`, which skipped the write only while the slot was FILLED — so it
failed every other way (all found 2026-10-14):

- container-header's guard was `[slot]`, which a `<slot>` never matches: its
  icon slot was erased on the first render, so a slotted icon NEVER showed.
- toast and gauge: content slotted AFTER the first render had no slot to go to.
- a slot holding only whitespace counts as filled, so the toast's own heading
  was skipped and showed nothing.

So the text goes in a span BESIDE the slot (`.glyph`, `.heading-text`,
`.caption-text`), and CSS hides it on `data-has-<slot>`. Slotted content wins
whenever it arrives, and `skipWhen` is gone.

The same distinction governs `#reflectSlot`: `assignedNodes()` WITHOUT
`flatten` returns only what the light DOM actually assigned, never the slot's
own fallback content, which `flatten: true` would count as "present" and
collapse by the slot's own `data-has-*` rule.

A FORWARDED slot — `<slot slot="metadata">`, handed on to a child
component — is the one node read WITH `flatten`: it counts only for what it
carries. Read as a plain element, an empty one was "filled", and the overlay
panel drew an empty metadata strip under every heading.

- Site: `src/core/ui/sherpa-element.ts`
- Site: `src/components/sherpa-toast/sherpa-toast.ts`
- Site: `src/components/sherpa-container-header/sherpa-container-header.ts`
- Site: `src/components/sherpa-gauge-chart/sherpa-gauge-chart.ts`
- Site: `test/e2e/reforged-num-coercion.spec.ts`
- Site: `test/e2e/reforged-a-slot-survives-its-text.spec.ts`

### T-menu-rows-stay-native-controls

`sherpa-menu`'s rows stay REAL FORM CONTROLS, slotted from the light DOM, so
keyboard and screen-reader behaviour come free:

| kind | markup |
|---|---|
| values | `<label><input type="checkbox\|radio" value="…" /> Label</label>` |
| actions | `<button type="button" value="…">Label</button>` |

Because they are LIGHT DOM the menu listens on its HOST and lets the events
bubble up. That is also why a native `change` — which is NOT composed — stops
at this element and never reaches the toolbar that stamped the rows: see
`T-native-change-stops-at-the-host`.

- Site: `src/components/sherpa-menu/sherpa-menu.ts`
- Site: `src/components/sherpa-data-grid/grid-actions.ts`

### T-footer-row-raises-on-any-flag

`data-commit` shows the Cancel/Apply pair and DEFERS every change until Apply.
Without it, every row tick commits immediately.

It does **NOT** alone decide whether the footer ROW appears. Today, Clear and
Remove share that row and each raises it on its own flag, so an auto-applying
calendar menu still has a footer holding Today and Remove.

Reading `data-commit` as "has a footer" would hide Today and Remove from every
menu that applies as it goes — which is every calendar menu by default.

- Site: `src/components/sherpa-menu/sherpa-menu.ts`

### T-cancel-baseline-captured-on-open

`#baseline` holds the values the menu OPENED with, for Cancel to restore.

Captured on OPEN rather than on first change: a user who ticks, unticks and
then cancels must land back where they started, not at the state after the
first edit.

`#onApply` rewrites it, so the draft becomes the committed state and a later
Cancel cannot undo it. `#onCancel` restores it and THEN reports — a listener
reading `values` in the handler must see the RESTORED set, not the discarded
one.

- Site: `src/components/sherpa-menu/sherpa-menu.ts`

### T-menu-search-is-a-substring-find

A menu's search narrows the rows to those whose text CONTAINS what was typed —
SUBSTRING, case-insensitively, on the row's own text. A menu search is a
"find", so typing "ows" should still reach "Windows"; matching from the START
would make a long label unreachable by its distinctive part.

It filters the rows it ALREADY HAS: no re-query, and a row hidden by a search
KEEPS whatever is ticked on it and comes back with it. That is what makes
searching safe inside a committing menu — you can narrow, tick, clear the
search, tick again, and Apply once.

`data-no-matches` is set ONLY WHILE SEARCHING: an empty menu with no query is
empty because the caller passed no rows, which is a different thing from
"nothing found".

JS writes the flag; CSS owns the hiding.

- Site: `src/components/sherpa-menu/sherpa-menu.ts`
- Site: `src/components/sherpa-menu/menu-list.ts`

### T-show-then-measure

`show()` points the select-all row at the set BEFORE the card is painted, then
shows the popover.

The rows are slotted light DOM that a host stamps, so there is no render pass of
ours to hang the sync on. Opening is the moment the set is known, and without it
a menu opens with its box blank rather than reading all / some / none.

The card is placed by the platform (`T-anchor-cross-root`), so nothing is
measured before or after the show — but a closed popover still reads 0 wide, so
anything that does measure the card (a bounded card's nudge) runs after it.

- Site: `src/components/sherpa-menu/sherpa-menu.ts`

### T-menu-value-is-not-always-rows

A menu's `values` is usually its CHECKED ROWS — but a menu whose body is not a
list of rows still has a value, and two shapes report for themselves.

**NUMBER.** No rows at all: its content is one field, or a two-ended slider
when its Range switch is on. A range spanning the WHOLE of its bounds excludes
nothing, so it reports NO value — otherwise a filter that is not filtering
would read as active.

**CALENDAR.** A calendar holds its pick in its own ATTRIBUTES, not in checked
inputs — so a date menu reported NO values, and every chip fed by one read as
"on but filtering nothing": the amber warning state, on a filter that was
working. A RANGE reports both ends and only once BOTH are picked; half a span
is not a span, and reporting one end would read as a single-day filter.

Both report strings, like every row value, so a consumer reads ONE array
whatever the menu is.

- Site: `src/components/sherpa-menu/sherpa-menu.ts`

### T-select-all-is-not-a-value

The SELECT-ALL row is excluded from `MenuList.inputs()`. It is a control OVER the set,
not a member of it: counted in, `values` would carry a phantom `"qf-all"`
entry, Apply would commit it as a picked value, and the count badge would be
ONE TOO HIGH with everything ticked.

`NON_VALUE_ROWS` is the shared selector for what is excluded and why.

Its LABEL never moves either: a row that says "Clear all" once everything is on
is both the select-all control AND the menu's clear — a second place to do what
the footer's Clear button does, and one that moves under the reader depending
on what is ticked. The row's words are its
template's, "Select all", and nothing rewrites them (TODO 344).

A list of FILTERS has none: `data-no-select-all`, from a def's
`selectAll: false`. Adding every filter at once is never the answer, and under
"Added filters" it read as selecting only those. Will, 2026-09-25.

- Site: `src/components/sherpa-menu/sherpa-menu.html`
- Site: `src/components/sherpa-menu/menu-list.ts`

### T-drill-crumbs-carry-no-href

The drill trail is a real `<sherpa-breadcrumbs>`, which draws the separator and
the current-crumb treatment itself, so there is nothing to compose beyond the
data: two crumbs, where it came from then where it is. A second hand-rolled
trail would drift from the component, as `sherpa-app-header` already found.

**NO `href` on either crumb.** The trail here navigates nothing — it goes back
a level inside a menu that must STAY OPEN — and an `<a href="#">` both appended
a hash to the URL and DISMISSED the popover on the way out.
`sherpa-breadcrumbs` fires `breadcrumb-select` for an href-less crumb just the
same, which is the whole signal needed.

The PARENT crumb is the same way out as the back arrow, so a select on it is
handled by `#onBack`; only the first crumb is a link, because the last is where
you are.

- Site: `src/components/sherpa-menu/sherpa-menu.ts`

### T-bounds-clamp-to-the-viewport

A menu card stays inside the VIEWPORT by default, or inside a host's
`data-bounds` — a CSS selector for the region the menu belongs to, such as an
app's content area. A menu that hangs over the nav or out of a panel reads as
belonging to neither, and the window's edges say nothing about where the
content actually stops.

The viewport is mostly the platform's: an anchored card is shifted to stay
inside its containing block, which for a top-layer card IS the viewport. Not when
its TRIGGER is out of the viewport — a chip `addFilters` just folded is measured
at x = −9950 — for then the area under it is out of it too, the card fits that
area, and nothing shifts: the card opened 10,000px off-screen. And a bounds box
is no containing block, in any engine. So the shell reads the card once as it
shows, against the bounds box or the viewport, and writes `--_nudge-x` /
`--_nudge-y` — a `translate` one gap inside — only when it must move; a bounded
card again on a scroll (once a frame) and as it grows.

The selector resolves from the menu's OWN tree out to the document, each shadow
root's host in turn, so it can name a box in a shadow root or in the app's own
tree. It read only the document, and inside a shadow root found nothing. One
that matches nothing — or a zero-sized box — leaves the card where the platform
put it.

And the box is never WIDER than the viewport: a container that scrolls out of
view would otherwise let the card follow it off the screen.

- Site: `src/components/sherpa-menu/menu-shell.ts`
- Site: `src/components/sherpa-menu/sherpa-menu.css`
- Site: `test/e2e/reforged-menu.spec.ts`

### T-card-max-height-follows-the-side

The card is capped to the room it has ON THE SIDE IT LANDED ON, and `.rows`
scrolls inside that.

Without it a long list — a Sort menu offers TWO ROWS PER COLUMN — ran off the
bottom of the screen and took the Apply/Cancel footer with it. A flat `60vh`
knows nothing about where the trigger sits.

In CSS now: `max-block-size: max(100% − 2 gaps, 50vh − half the anchor − 2
gaps)`. Inside a `position-area`, `100%` is the room on that side. The second
term is the trick: the roomier side always has at least half the viewport beside
the trigger, so a card too tall for below fails its first option and lands above,
capped to the room there — the old rule ("below unless it does not fit, then the
roomier side") without measuring. A plain `100%` cap fits every option by
shrinking, so the card never flipped and opened 8px tall at the foot.

It never runs off the TOP: the platform shifts it inside the viewport, which is
where a DRILLED CALENDAR landed — taller than the list it replaced.

- Site: `src/components/sherpa-menu/sherpa-menu.css`

### T-open-menu-resize-closes

While a menu is OPEN its card follows its trigger on SCROLL — the platform moves
an anchored box — but a RESIZE **closes** it.

A card that follows is fine when only the trigger moved. A resize can rebuild
what is UNDERNEATH it: a toolbar folds chips away, a grid re-columns, a
container query swaps a layout. The card would then be pointing at something
that is no longer there, or holding rows that have been moved out from under it
(`T-drill-moves-not-clones`). Closing is honest and puts everything back where
it belongs.

THE CARD'S OWN SIZE can change while it is open — a date menu's Range switch
turns one month into two, 274px into 485 — and the platform places it again, as
it does any anchored box. A bounded card (`T-bounds-clamp-to-the-viewport`) has a
`ResizeObserver` on the card for its nudge.

The Cancel baseline is snapshotted here too —
`T-cancel-baseline-captured-on-open`.

- Site: `test/e2e/reforged-quick-filter-toolbar.spec.ts`
- Site: `src/components/sherpa-menu/menu-shell.ts`

### T-select-all-ticks-boxes-not-values

Select-all is handled IN THE MENU rather than in the toolbar that stamps the
row, because a native `change` is NOT COMPOSED: it stops at this element, which
is the shadow host the rows are slotted into, and never reaches the toolbar.
See `T-native-change-stops-at-the-host`.

It writes the OTHER ROWS' `checked` state and lets the ordinary change path
carry it, rather than setting `values` directly: a COMMITTING menu holds a
DRAFT, and writing the set here would commit a selection the user has not
applied. Ticking the boxes is what the user would have done by hand, so the
draft, the count and Cancel all behave as they always did.

Unticking it EMPTIES the set, the way any checkbox unticks what it turned on —
but the row never RELABELS itself to "Clear all", because emptying the menu is
the footer's Clear button and one action belongs in one place
(`T-select-all-is-not-a-value`).

- Site: `src/components/sherpa-menu/menu-list.ts`

### T-indeterminate-is-a-property

`MenuList.syncSelectAll` points the select-all row at the set it describes: TICKED for
all, INDETERMINATE for some, EMPTY for none.

`indeterminate` is a **PROPERTY, not an attribute**. There is no
`indeterminate=""` in HTML, so it has to be written on the element EVERY TIME
the set moves — a declared `data-*` cannot express it and CSS cannot set it.

That is also why the box can never be trusted to report the set: see
`T-indeterminate-reports-false`.

- Site: `src/components/sherpa-menu/menu-list.ts`

### T-rows-changed-re-places-next-frame

The slotted ROWS can be replaced wholesale — the overflow menu drills in by
swapping its list for another filter's (`T-drill-moves-not-clones`) — so the
select-all row's state has to follow them. `slotchange` fires exactly when they
move in or out, which `show()` alone does not cover: a drill happens AFTER it.

A drill swaps a 240px list for content of its own size — a calendar is half as
wide again. The platform places an anchored card again as it grows; a BOUNDED
card is nudged into its box again on the NEXT FRAME, once the new rows are laid
out (`T-bounds-clamp-to-the-viewport`).

- Site: `src/components/sherpa-menu/sherpa-menu.ts`
- Site: `src/components/sherpa-menu/menu-shell.ts`

### T-menu-back-is-a-report

The back arrow REPORTS; it does not act. The menu does not know what it drilled
INTO, only that it did: the rows came from somewhere else and only that
somewhere can take them home (`T-drill-moves-not-clones`).

`menu-back` is COMPOSED, which the button's own `click` is not — the click
starts inside this shadow root and would never reach the component that filled
the menu. The handler stops propagation for the same reason.

- Site: `src/components/sherpa-menu/sherpa-menu.ts`

### T-native-change-stops-at-the-host

A native `change` is **NOT COMPOSED**: it stops at `sherpa-menu`, the shadow
host its rows are slotted into, and never reaches the toolbar that stamped
them. So the menu re-emits it as `menu-change`, and every value shape has to be
recognised HERE.

A NUMBER body is not slotted: it lives in the menu's OWN shadow root
(`T-a-menu-owns-its-own-bodies`), so a host listener hears none of it. The
field's native change stops at the shadow root; the slider's composed change
arrives retargeted to the menu itself. So the menu listens on `.body-number`,
reports it as `menu-change`, and hands the field's change on to the host's
tree, as a row's would. When the body moved inside on 2026-09-25 this broke
silently (TODO 104): the chip HELD a typed or dragged value and sent nothing,
and the test that read the value stayed green. A test of a report watches the
EVENT.

The bar and the panel read a number body as `menu.reading`, and the panel takes
a dragged handle once, when it is let go — as a bar chip does.

The same non-composed `change` is why select-all is handled in the menu
(`T-select-all-ticks-boxes-not-values`), and why `sherpa-switch` re-dispatches
its own as composed (`T-range-switch-swaps-not-rebuilds`).

- Site: `src/components/sherpa-menu/sherpa-menu.ts`
- Site: `test/e2e/reforged-number-filter-reports.spec.ts`

### T-clear-empties-both-body-shapes

Clear empties BOTH kinds of content a menu can hold: the value rows'
checkboxes, AND a slotted calendar's `data-value` / `data-value-start` /
`data-value-end` attributes. Clearing only the inputs left a date menu still
holding its pick (`T-menu-value-is-not-always-rows`).

A COMMITTING menu stays OPEN — clearing is a change to the DRAFT, not a
decision, so the reader can pick again or Cancel out of it. Without
`data-commit` there is no draft, so it reports the emptied state at once, the
same way a tick does.

- Site: `src/components/sherpa-menu/sherpa-menu.ts`
- Site: `src/components/sherpa-menu/menu-date.ts`
- Site: `src/components/sherpa-menu/menu-list.ts`

### T-today-and-remove-are-menu-chrome

Today and Remove are the menu's FOOTER form of actions that are otherwise
rows.

**Today.** The BUTTON is the menu's — Figma puts Today in the Calendar footer's
`left` slot — while the BEHAVIOUR is the calendar's, so it calls the calendar's
public `today()` rather than reaching into it. It stays OPEN, like a day click:
Today PICKS a date, it does not commit one. Apply still does that.

**Remove.** It emits exactly what a `<button value="remove">` row emits
(`menu-select` with `{ value: 'remove', label: 'Remove' }`), so a host listens
for ONE event whichever shape its menu is. A calendar menu has no rows, and
this is how it still offers the action.

- Site: `src/components/sherpa-menu/sherpa-menu.ts`
- Site: `src/components/sherpa-menu/menu-date.ts`

### T-an-advanced-row-rules-out-nothing

**An Advanced row offers every value of its field, always** — Will, TODO 469:
*"I think we need to ignore invalidating values completely when in advanced
filter mode."* "Equals A And Equals B" had its second row greyed but for A.

So two old rules are undone, in the rows only: an AND row no longer offers
just what the rows above it leave (TODO 110 B, `rowOffer()`, deleted), and a
value the filters before the field rule out is no longer greyed there (349).
The Simple list still greys and refuses (`T-a-ruled-out-value-is-greyed`).

- Site: `test/e2e/reforged-filter-conditions.spec.ts`
- Site: `src/components/sherpa-menu/menu-conditions.ts`

### T-css-owns-the-leave-duration

`sherpa-toast` removes itself on **`animationend`**, so CSS owns the leave
timing and JS never needs to know it.

A `setTimeout` with a number kept in step with the `sherpa-toast-out` keyframes
by hand is two copies of ONE number, and a race if either moves. `animationend` is the platform's own answer: the
animation says when it is done. The listener is `once`.

`LEAVE_FALLBACK_MS = 1000` is a **SAFETY NET, not a duration.** It covers only
the case where the animation never runs AT ALL — `display: none`, a
reduced-motion setting that cancels it, a browser that skips animations on a
hidden tab — where waiting for an event that will not fire would leave the node
in the DOM forever. It is generous on purpose: it must never beat a real
animation to the finish. A `done` flag makes whichever arrives first the only
one that acts.

The `toast-dismiss` event fires IMMEDIATELY, before the animation, so app code
is not kept waiting on it.

The auto-dismiss delay goes through `num()`, not `Number()`: through `Number()` an
EMPTY `data-duration` reads as 0, which the `> 0` test treats as "no
auto-dismiss" — a toast that never leaves. The default is 5000.

- Site: `src/components/sherpa-toast/sherpa-toast.ts`

### T-an-instance-pin-is-the-hosts-to-apply

`sherpa-container-footer` has ZERO inline padding, on purpose: it sits inside a
menu card that already has its own 8px, and a second gutter would indent the
buttons inside it. Will tightened it 16 → 8 → 0 to get that.

A DIALOG has no such gutter, so the same footer put its buttons flush against
the dialog's edge while the body sat inset 16. Figma says the same thing in its
own vocabulary: the Dialog (1003:33675) pins `padding/sm` on both sides of its
Container Footer INSTANCE, against the component's own `padding/none`.

**A pin belongs to whoever places the instance** — so it lands in the dialog,
not in the footer, whose default is right everywhere else.

Two ways to pass it, and only one works:

```css
.footer ::slotted(sherpa-container-footer)::part(row) { … }  /* DROPPED, silently */
.footer ::slotted(sherpa-container-footer) { --_pad-inline: 4px; }  /* works */
```

`::part` cannot follow `::slotted`, and the rule is discarded with no warning —
the measured padding simply does not change. A custom property inherits straight
through both shadow boundaries, which is the one thing that does cross them. The
component reads `var(--_pad-inline, <its own default>)`.

And it is the component's OWN private knob, not `--sherpa-theme-padding-none`.
Redefining a shared token to mean something other than zero is a lie told to
every descendant that reads it.

- Site: `src/components/sherpa-dialog/sherpa-dialog.css`

### T-a-menu-with-no-trigger-lands-at-the-origin

A card is anchored to its TRIGGER (`T-anchor-cross-root`). With no trigger there
is no anchor, and the card sits at the top-left of the viewport, over whatever is
there.

It is silent. The card opens, it is readable, and every row works; it is simply
in the wrong place. Measured: `show()` with no argument left the card at 0, 0,
and it never moved.

`show(trigger)` is the normal path, and a click always has one. The gap is
`open = true`, which calls `show()` bare, and any caller that forgets. The menu
falls back to the nearest drawn box: the element it is slotted into, else its own
parent. The trigger is cleared on close, so the fallback is found again per open
and never outlives the trigger that replaced it.

- Site: `test/e2e/reforged-menu.spec.ts`
- Site: `src/components/sherpa-menu/menu-shell.ts`

### T-add-condition-sits-below-the-rows

**Add condition is a labelled button in the default look, BELOW the last
condition row.** Every row ends in Remove; a lone row has none, as there is
nothing to drop, and Clear is how a reader says "no filter".

Will, 2026-09-25, first asked for a plus at the end of the last row, with
Remove only on the rows before it. On 2026-09-26: *"The add condition button
being on the end of the last input row needs to change. Put the button below
the last input row."* So it went back, labelled "Add condition", no longer the
transparent look.

Pressing it puts focus in the new row's condition field — once that field has
drawn, as it renders on its own clock.

- Site: `src/components/sherpa-menu/sherpa-menu.ts`
- Site: `src/components/sherpa-menu/sherpa-menu.css`
- Site: `src/components/sherpa-menu/sherpa-menu.html`
- Site: `test/e2e/reforged-filter-conditions.spec.ts`

### T-a-reopened-dialog-hears-a-late-close

**A `sherpa-dialog` shut and opened again at once must stay open.** The native
`<dialog>` fires `close` on a QUEUED task, so it lands after the second
`show()`. The dialog wrote `open` off when it heard it, and that attribute
change shut the dialog again — with its new question on it.

So `#onClose` does nothing while the native dialog is open. The close that was
undone before it landed is not reported: the dialog is not closed.

Found by the Records page's Save filter dialog: Cancel, then Save filter again
at once, and the dialog vanished — or stayed, with its question dropped.

- Site: `test/e2e/reforged-dialog.spec.ts`
- Site: `src/core/ui/disclosure.ts`

### T-a-tree-menu-keeps-its-ticks-as-data

TODO 369 — Will: a value can hold child values (a Customer's Sites), and its
menu is a TREE with checkboxes. Items with a `parent` are a tiered list; the
rows stay ONE flat list in light DOM, a child set in by `data-depth`.

**The ticks are DATA** (`TreePicks`, `src/core/ui/tree-picks.ts`), and the boxes
are drawn from it: a parent is picked whole, or some of its children are, as
paths. A parent box is on, some (`indeterminate`) or off. Ticking every child
does NOT pick the parent — it stays at some (Q1 A: a parent matches every one of
its rows, a siteless one too). Unticking one child of a picked parent picks the
others. A child under a picked parent says nothing more, so `values` is always
the normal form. Select all ticks every parent; Clear empties the data too.

**Sites open IN PLACE** (Q5). A shut parent's children are not drawn until it
first opens — their ticks live in the data meanwhile. Open or shut is the
menu's own, kept across `items()`, as the nav keeps its Areas; the walk up the
chain is `hiddenRows` (`T-parent-chain-walk-not-a-selector`). A search reads
the DATA: a child that matches shows with its parent held open until the search
clears.

**The BOX says the tree, not the twisty.** A `sherpa-button` cannot hold
`aria-expanded` for its inner button (`T-a-host-cannot-hold-aria-expanded`), and
an id cannot cross its shadow root. So the parent's checkbox carries
`aria-expanded` and `aria-controls` (ARIA 1.2 allows both on a checkbox), and
ArrowRight / ArrowLeft open and shut it; the twisty is a pointer's door,
`aria-hidden` and out of the tab order. A child's box is described by its
parent's label. A click on the twisty never ticks the row it sits in.

**A chip reads the DATA too** (`menu.itemData`): a shut parent's children are
not drawn, so its stamped boxes cannot say them. Its face groups by parent —
"Contoso, Northwind: London" (Q3) — from each value's parent alone, since a chip
knows the parents and not the child's field.

- Site: `src/core/ui/tree-picks.ts`
- Site: `src/components/sherpa-menu/sherpa-menu.ts`
- Site: `src/components/sherpa-menu/menu-list.ts`
- Site: `test/unit/a-tree-keeps-its-ticks-as-data.test.mjs`
- Site: `test/e2e/reforged-menu-tree.spec.ts`
- Site: `test/e2e/reforged-a-tiered-chip.spec.ts`

### T-a-condition-is-a-draft-too

A committing menu holds its condition ROWS until Apply, exactly as it holds its
ticked rows.

Without this a condition applied on every keystroke — `C`, `Co`, `Con` — each
re-querying the whole view, and none of them cancellable. Will, 2026-09-24:
"Conditional filters are being applied immediately on change instead of on
clicking Apply."

`#emitConditions()` returns early when `#commits`, and Apply calls it with
`force`. Cancel and a plain close restore `#conditionBaseline`, captured on
open beside `#baseline`.

**Two things make the restore harder than it looks.** `hidePopover()` fires
`toggle` ASYNCHRONOUSLY, so `#applying` is already false when the close runs —
`#settledByAction` is a second flag that survives the gap. And `conditions =`
REBUILDS every row, whose value select then fills asynchronously, so restoring
IDENTICAL rows still blanked the answer for a tick; the setter returns early
when nothing differs.

- Site: `src/components/sherpa-menu/sherpa-menu.ts`
- Site: `test/e2e/reforged-filter-conditions.spec.ts`

---

### T-a-value-select-waits-for-the-rows

Row ONE's `Equals` select opened EMPTY while row two, added afterwards, was
full.

The condition editor stamps row one before the menu's own value rows arrive, and
`#valueOptions()` reads those rows. `refill()` on `slotchange` re-sends the
options to every row, keeping each row's own `data-want`.

- Site: `src/components/sherpa-menu/sherpa-menu.ts`
- Site: `test/e2e/reforged-filter-conditions.spec.ts`

---

### T-clear-empties-both-modes

Clear empties the ticks AND the condition rows.

A menu with two modes holds its answer in two places, and clearing one left a
"cleared" chip that was still filtering. Will, 2026-09-24: "Clicking Clear
should reset both list and conditional selections and values."

Clear is an action ON THE FILTER, not an edit to a draft, so it reports
immediately even on a committing menu — `#emitConditions(true)`.

- Site: `src/components/sherpa-menu/sherpa-menu.ts`

---

### T-a-composed-chrome-row-takes-its-inline-padding-from-its-container

`sherpa-container-footer` sets `padding-inline: var(--_pad-inline, 0px)` — it
DEFAULTS TO ZERO and expects its container to supply the value.

`sherpa-container` and `sherpa-dialog` both do. `sherpa-panel` never did, so
every panel with a composed footer had its buttons flush against the card edge.
Will saw it three times before it was chased down, in three different places,
because the footer looked right everywhere a container held it.

The fix belongs on the CONTAINER, not on each footer: one `--_pad-inline` on
`:host`, and every composed chrome row inside inherits it.

**Before restyling a composed child from outside, check what it is asking its
parent for.** A component that reads a custom property is telling you where the
value belongs.

---
- Site: `src/components/sherpa-panel/sherpa-panel.css`
- Site: `src/components/sherpa-menu/sherpa-menu.css`
- Site: `src/components/sherpa-container-footer/sherpa-container-footer.css`
- Site: `test/e2e/reforged-container-footer.spec.ts`
- Site: `src/components/sherpa-overlay-panel/sherpa-overlay-panel.css`
- Site: `src/components/sherpa-node/sherpa-node.css`

### T-a-panel-chrome-row-never-shrinks

`sherpa-panel`'s `.header` and `.footer` are flex items in a column, and a flex
item's default `flex-shrink` is `1`.

So a long body SQUASHED the header: 85px of heading and search became 14px, and
the search field was pushed to x = −49, outside the panel. The BODY is what
scrolls; the chrome rows are fixed.

`flex: 0 0 auto` on both, and `overflow: auto` on the body.

---
- Site: `src/components/sherpa-panel/sherpa-panel.css`

### T-a-hidden-sibling-still-counts-as-first-child

`.sherpa-group` squares a run's inner corners by POSITION — `:first-child` and
`:last-child` — and a `display: none` child still holds its position.

The rule for any `.sherpa-group`: a control that is not there must not be in
the DOM, or the group states its ends per flag.

**A CONDITION ROW states BOTH ends.** Three of its five children are
conditional — the join is hidden on row one, the Remove on a lone row, and the
answer is a select or a text box — so neither `:first-child` nor `:last-child`
is the control a reader can see. The two ends are written out per flag rather
than left to position.

- Site: `src/components/sherpa-menu/sherpa-menu.css`

### T-a-slotted-row-is-outside-its-own-popover

`sherpa-menu`'s card is `popover="manual"`, and the menu owns its own dismiss.

A native `popover="auto"` light-dismisses on a pointerdown OUTSIDE its own DOM
tree — and the menu's rows are SLOTTED. They RENDER inside the card, but in the
DOM they are children of `<sherpa-menu>`, a sibling of the popover. So ticking a
row was an outside click: the menu shut with nothing chosen.

`#onOutsidePointer` uses the COMPOSED path, which says what is really inside:
this element, its card, or the trigger that opened it. Escape is handled the
same way.

Measured with a deep hit test — `elementFromPoint` through every shadow root
returned the `input` itself, and the menu still closed.

---
- Site: `src/components/sherpa-menu/sherpa-menu.html`
- Site: `src/components/sherpa-menu/menu-shell.ts`

### T-a-composed-child-hides-with-important

`display: none` on a COMPOSED child does nothing. Its own `:host` rule wins.

A component's shadow sheet styles its own host, and that beats a parent's
descendant rule on the same element — so `:host([data-inline]) .footer { display: none }`
read as applied and painted a footer, because `sherpa-container-footer` sets
`:host { display: none }` and `:host([data-has-content-slot]) { display: block }`
in its own sheet.

Nothing warns. `getComputedStyle` reports `block`, the rule is in the built
CSS, and the selector matches.

`display: none !important` is the honest answer, and it is the only place in
this repo that needs one. Any other property is fine — this is specific to
`display`, which a component must set on its own host to exist at all.

---
- Site: `src/components/sherpa-menu/sherpa-menu.css`

### T-an-edge-resizes-its-box

**One helper resizes a box by its EDGE: `resizeByEdge` in
`src/core/ui/edge-resize.ts`.** The overlay panel's left edge had its own
drag and keys; the app shell's two panel areas needed the same (Will, TODO
146: *"Allow the side of the panel areas … to be dragged to resize like we
can do with the overlay panel"*). So it is ONE imported helper, never a base
class. The component says how wide the box is drawn and writes the width it
is asked for; its CSS owns the clamp, and the width written back is what the
clamp DREW, so a key moves from there.

- `grows` says which way the edge widens: the start area's edge is its end
  (+1), the end area's and the overlay panel's is their start (−1). A key
  moves the edge the way it points, so ArrowRight widens one and narrows the
  other. Home and End go to the clamp's ends.
- It states `aria-valuenow`, `aria-valuemin` and `aria-valuemax` — the old
  handle never said its range — and holds `data-dragging` while held, so the
  indicator stays when the pointer leaves the strip.
- Firefox THROWS on `setPointerCapture` for a pointer it did not start (a
  synthetic one), which ended the drag before it began: the capture is tried.

A panel area's edge is `sherpa-layout-panels`', which the shell and the canvas
compose (`T-a-panel-area-is-a-layout`): `flex` takes `--_asked-<side>` (the
drag, or the host's `data-panel-<side>-width`), `min-inline-size` its min
(464px) and `max-inline-size` its max (33% of the row; the canvas's card, 16rem
and 60%). The min wins where they cross: at 1280 33% of the row is 409px, so an
area gives only from about 1446px wide. The docked panel is flush, so the
AREA's edge is the panel's own: the handle is a strip ASTRIDE it, half over the
panel, half over the content, with a 2px line down its middle. The layout's
`panel-area-resize` stops at its host, which reports its own (PRINCIPLES 18):
the shell, or the canvas, each of which takes `data-panel-start-width` and `data-panel-end-width` back. The example app
keeps the width in its session and hands it back.

**Either axis, in the box's own units** (TODO 177). The layout grid's gutters
move a HEIGHT too: `axis: 'y'` reads `clientY` and the Up and Down keys. Its
`step` is a function, read at each press, because a grid's pitch follows its
width and density. `describe` states the separator's values in columns or
rows, with an `aria-valuetext`, rather than px. And every edge says its value
when it is WIRED, not only once focused: a focusable separator with no
`aria-valuenow` is announced with nothing.

A cancelled drag replays the last size it reached, not a fresh measure (a
grid's handle can be gone by then). One pointer drives a drag; a second one
held on the same edge is ignored. A `describe` that returns null leaves the
last values standing.

- Site: `src/components/sherpa-overlay-panel/sherpa-overlay-panel.ts`
- Site: `src/core/ui/edge-resize.ts`
- Site: `src/components/sherpa-layout-panels/sherpa-layout-panels.ts`
- Site: `src/components/sherpa-layout-panels/sherpa-layout-panels.html`
- Site: `src/components/sherpa-layout-panels/sherpa-layout-panels.css`
- Site: `src/components/sherpa-layout-canvas/sherpa-layout-canvas.ts`
- Site: `test/e2e/reforged-app-shell.spec.ts`
- Site: `test/e2e/reforged-edge-resize.spec.ts`
- Site: `src/components/sherpa-node-stage/sherpa-node-stage.html`
- Site: `src/components/sherpa-node-stage/sherpa-node-stage.css`

### T-two-conditions-over-one-field-are-alternatives

A second condition row defaulted its join to `and`. Over ONE field that matches
nothing, always: `owner eq Dana AND owner eq Ravi` has no rows, and a reader
who added a row to widen their filter watched the grid empty.

Measured: `["and", ["owner","eq","Dana Whitlock"], ["owner","eq","Ravi Menon"]]`
→ 0 rows. With `or` → 25 rows over 2 pages.

`#seedFromPicks` already knew this — carrying ticked values into condition mode
joins them with `or`. Only a row the READER added disagreed, so the same two
values meant different things depending on how they got there.

`and` is still there to be chosen, and it is the right answer for ranges
(`> 10 AND < 50`). It is the wrong DEFAULT.

- Site: `src/components/sherpa-menu/menu-conditions.ts`

### T-a-borrowed-menu-leaves-its-toolbars-listeners-behind

The old `sherpa-filter-panel` (old) BORROWED a chip's own `<sherpa-menu>` and appended it into
a field body. The menu is then genuinely out of the toolbar's tree — measured,
a click on its range switch has the composed path
`SHERPA-SWITCH → SHERPA-MENU → SHERPA-FILTER-PANEL → SHERPA-APP-SHELL`, and
`bar.contains(menu)` is `false` for every bar on the page.

So every listener the toolbar bound on ITSELF goes silent for that menu. The
Range switch was the visible one: flipping it changed nothing, with no error.

**Bind on the MENU for anything a borrowed menu owns.** The listener travels
with the element, so the rule keeps working wherever the menu is drawn, and the
toolbar still owns the rule.

The same move fixes the reads inside those handlers: `sw.closest('.chip')`
found nothing once borrowed, so the chip's id is written onto the menu
(`data-chip-id`) while it is still on its chip, and read from there.

A listener on the bar is correct for anything the CHIPS fire — they never move.
It is wrong for a menu.

- Site: `src/components/sherpa-menu/sherpa-menu.ts`

**FIXED STRUCTURALLY, 2026-09-25.** The Range switch was the last host-bound
listener on a borrowable menu; `sherpa-menu` owns it now, so there is nothing
left for a borrow to strand. TRAP T-a-menu-owns-its-own-bodies

### T-an-fr-track-floors-at-min-content

An `fr` track does NOT shrink to zero. Its floor is `auto`, which is the
content's min-content width — so a row of `2fr 3fr auto` in a box narrower than
that content overflows the box rather than squeezing.

Measured on a two-row condition layout in the filter panel: the rows box had
`clientWidth 294` and `scrollWidth 378`, and the 16px Remove button was simply
clipped off the end. Nothing scrolled and nothing reported an error.

`minmax(0, 2fr)` sets the floor to zero, and each child needs
`min-inline-size: 0` for the same reason one level down — a `<select>` or an
`<input>` has its own intrinsic minimum.

**A grid that must fit needs both.** The track's floor and the item's floor are
two separate defaults, and fixing one alone still overflows.

- Site: `src/components/sherpa-menu/sherpa-menu.css`

### T-an-inline-condition-row-keeps-its-tracks

A condition row inline keeps the TOOLBAR's grouped tracks. The first fix here
stacked it one control per line, and that was the wrong answer to a real
measurement.

The measurement: the row had 214px and its second track collapsed to zero, so
the value select drew nothing but a caret. The reading was "a panel column is
too narrow". The CAUSE was elsewhere — `.field` is a two-column grid,
`1fr auto`, and the ACTIONS column took 80 of the field's 294px. The body was
never the column's width; it was the column minus the buttons.

So the host gives the rows the whole column instead: in condition mode `.field`
puts the actions on the LABEL row and spans the body across both tracks. The
row gets 294px, the `fr` tracks narrow, and the four controls stay one grouped
object exactly as they are in the chip menu.

**A collapsed track is a width problem, and the width is rarely where you are
looking.** Measure the CHAIN — the row, its body, its box — not just the row.

- Site: `src/components/sherpa-menu/sherpa-menu.css`

### T-an-inline-menu-drops-the-chrome-its-host-owns

`sherpa-menu[data-inline]` hides its `use-condition` button and its footer.

Inline, the menu is inside something that already has both: a column
section's ⋮ carries the Simple/Advanced switch, and its scope has ONE Apply
that commits every field at once. A second of each is two answers to one
question, and a reader cannot tell which Apply applies.

The MENU owns the rule, not the host. Inline is the menu's own mode, so what it
drops in that mode is its own business — a host reaching in with `::part` would
have to repeat the list everywhere it draws one.

---
- Site: `src/components/sherpa-menu/sherpa-menu.css`

### T-equals-answers-with-the-fields-own-values

In condition mode, `Equals` does NOT give a text box.

A reader who picks `Equals` on a Status field is choosing among `active`,
`churned`, `trial` — the values that field has. A free text box there invites
them to type `Active` and get nothing, with no clue why.

So `OP_TAKES[op] === 'list'` shows `.condition-pick`, a select of the field's
own values, read from the menu's own rows. Only a TYPING op shows the box.
The flag is on the ROW (`data-takes`), not the host, so one row can be a typed
`Contains` while the next picks from the list.

- Site: `test/e2e/reforged-filter-conditions.spec.ts`
- Site: `src/components/sherpa-menu/menu-conditions.ts`

---

### T-a-select-does-not-hug-its-own-text

The And/Or select in a condition row sat in an `auto` grid track and shrank to
its caret — "And" clipped to nothing.

A `<select>` reports an intrinsic width its own longest option does not
guarantee, especially with `appearance` restyled. Give it a FIXED track.

- Site: `src/components/sherpa-menu/sherpa-menu.css`

---

### T-a-full-range-is-still-a-range

A NUMBER filter's slider opened at the column's own min and max, and the menu
read that pair as "no filter":

```ts
return lo === min && hi === max ? [] : [String(lo), String(hi)]   // WRONG
```

It is right for a chip the reader never opened, and wrong for every other case
that lands on the same pair. A reader who drags to 1..240 on purpose, or drags
out and back, gets an empty report: the chip never goes active and the filter
never applies. Measured live — `sub 10..200` reported `["10","200"]`, `full
1..240` reported `[]`, with the chip identical in both.

The state being read was never the VALUE. It was whether the reader had touched
the slider, which the value cannot carry. The slider now wears `data-touched`,
set in its OWN `onChange` — the toolbar seeds the bounds before the element is
upgraded, so any later write to an end is a real change. Clear restores the
bounds first and drops the flag second, because the restore re-sets it.

Since TODO 375 a number's slider is in its Between row, and the row's two boxes
are the answer: an untouched slider shows the whole span, and empty boxes
answer nothing.

- Site: `src/components/sherpa-menu/sherpa-menu.ts`
- Site: `src/components/sherpa-slider/sherpa-slider.ts`

### T-one-verb-proxies-to-the-native-one

Four components open and close, and each wraps a different platform API:

| component | wraps | the native verb |
|---|---|---|
| dialog, overlay-panel | `<dialog>` | `close()` |
| menu, notifications | `popover` | `hidePopover()` |

Left alone, that leaks into the public surface: an app author writes
`dialog.close()` on one line and `notifications.hide()` on the next, for the
same intent. `../Sherpa Demos/app/` did exactly that.

**Sherpa's pair is `show()` / `hide()`**, and every one of the four accepts
both that and `close()`. The alias delegates — it never re-implements — so
there is one place the work happens:

```ts
hide(): void { … }                 // the logic
close(): void { this.hide(); }     // the platform spelling
```

The native API is still there and still used INSIDE; nothing is reinvented.
What is added is one vocabulary so a caller does not have to know which
platform primitive a component happens to wrap.

**`dismiss()` is not a synonym.** On callout and toast it REMOVES the element
from the DOM. Folding it into `hide()` would give a caller a method that
sometimes hides and sometimes destroys.

- Site: `src/components/sherpa-menu/sherpa-menu.ts`
- Site: `src/components/sherpa-notifications/sherpa-notifications.ts`
- Site: `test/e2e/reforged-open-close-verbs.spec.ts`
- Site: `src/core/ui/disclosure.ts`

### T-a-css-function-needs-its-longhand-first

A CSS `@function` renders NOTHING in an engine that lacks it — not a fallback,
not an error, just an unset property. Measured in Firefox 155: a focus ring
written as `--ring(2px)` simply does not draw.

That is why this library had no function library, and the ruling that forbade
one was written before anyone tried the guard.

**`@supports` closes it.** Two blocks, always in this order:

```css
/* 1. The longhand. Every engine, always. */
&:hover { background: color-mix(in oklab, var(--_surface) 92%, currentColor); }

/* 2. The function. SECOND, so it wins only where it works. */
@supports (background: --shade(red, 8%)) {
  &:hover { background: --shade(var(--_surface), 8%); }
}
```

Measured in all three engines, including inside an ADOPTED shadow sheet, which
is the demanding case because `@import` dies there:

| engine | `@function` rule | renders |
|---|---|---|
| Chromium 1xx | kept, `CSSFunctionRule` | via the function |
| WebKit | kept, `CSSFunctionRule` | via the function |
| Firefox 155 | **dropped from the sheet** | via the longhand |

Firefox discarding the rule is what makes this safe: there is nothing left to
half-apply. All three land on the same colour to five decimal places.

**None exists today.** `--shade()` and `--tint()` named the hover and down
steps where components had drifted (92%, 94%, 84%; four close buttons at 22%,
18%, 22% and 14%). Style `base` / `+1` / `+2` then became default / hover /
down (Will, 2026-09-24, `T-a-state-colour-binds-the-style-mode`), nothing
called them, and they were deleted with their probe (Will, TODO 334). The rule
stands for the next one.

**Why not a custom property instead?** A property holds one value. This takes
ARGUMENTS — a different surface and a different step per call — which a
property cannot express.

- Site: `playwright.config.ts`
- Site: `src/components/sherpa-menu/sherpa-menu.css`

### T-grouping-is-an-attribute-and-a-class

Grouping — making a row, column or grid of controls read as ONE object — has
two doors, and both are real:

| | |
|---|---|
| `data-group="start"` | the POSITION, stated. Works from an HTML template or a JS property change, with no CSS of its own. The 21 Figma positions: `solo`/`start`/`mid`/`end`, `vertical-*`, `grid-{top,mid,bottom}-*` |
| `.sherpa-group` on a wrapper | DERIVES the same thing by position, so a re-order, insert or delete needs nothing |

The attribute is the configuration channel and matches every other Sherpa API:
`data-*` in, CSS responds. The class is for a container that owns its children
and would otherwise re-stamp attributes on every change.

**The blocks are emitted TWICE, and that is deliberate.** A bare
`[data-group="start"]` in `tokens.css` can never match an element inside a
shadow root; the same rule in an adopted sheet can never match one in the page.
A host app groups controls in its own markup and a component groups them in its
template, so `scripts/project-tokens.mjs` writes the generated blocks to both
`tokens.css` and `src/core/sherpa-group-positions.css`. Removing either half
silently un-joins one of the two.

**Two renames cleared the way.**

`data-snap` is gone. It was written at 38 sites across 5 components and styled
by **nothing** — grepped: not one CSS rule anywhere selected on it, and seven
component comments existed only to explain that the `[data-snap]` rules in
`tokens.css` never reached a shadow root. Its values also named the SIDE that
was snapped rather than the position, so `data-snap="right"` meant the item sat
at the START of a row. Migrated: `right`→`start`, `left`→`end`, `all`→`mid`.

`sherpa-data-grid` used `data-group` for something else entirely — the group
KEY of a row, an arbitrary value like `"EMEA"` or a status. That collided: a key
of `"end"`, `"mid"` or `"solo"` would have silently restyled that row's borders.
It is now `data-group-key`, which is internal — 8 `dataset` sites plus one CSS
selector in a test, and nothing outside the component reads it.

A row that lands in ANOTHER component's light DOM is a `<sherpa-group>`: its
`::slotted()` rules travel with it, where a class's rules cannot reach (the
calendar's projected stepper, TODO 344).

- Site: `src/components/sherpa-calendar/sherpa-calendar.ts`
- Site: `scripts/project-tokens.mjs`
- Site: `src/core/sherpa-group-positions.css`
- Site: `src/core/sherpa-grouping.css`
- Site: `src/components/sherpa-input-text/sherpa-input-text.css`
- Site: `src/components/sherpa-menu/sherpa-menu.html`
- Site: `src/components/sherpa-group/sherpa-group.css`

### T-row-one-is-data-op

**A filter menu's FIRST condition row is `data-op` and `data-value`.**
`ConditionEditor.sync` rebuilds row one from those two on every sync — any
attribute the menu observes — which is how a re-stamp keeps what was typed.

So rows set from outside, with the two left behind, lasted only until anything
moved. `setChipReading` wrote "contains Da" as rows while `data-op` still said
`eq`, and the next sync turned it into an empty equals. Measured on the Records
page: the Owner chip read `conditions: [{ op: 'eq' }]` 300ms later. Found when
Save flagged the menu (`data-saveable`), which is a sync — but the panel and
`#keepAnswer` write rows the same way.

`set conditions` now writes row one's op and typed value back to the two
attributes, so the menu's own record and its rows agree. So does a row's
Remove: a dropped FIRST row left its op and text in the two attributes, and
the next sync drew it back.

The typed value is a TYPED PICK too, where no list shows it (Advanced only):
an "Is" row on Name holds its value in the box. Mirroring "" for it (an `eq`
takes a list) let the next sync empty the box, and the row then read as
unanswered: a grid cell's "Is Aisha" vanished from the bar's chip (TODO 373).
While its box is not drawn, such a row reads the pick it was given (`want`).

- Site: `test/e2e/reforged-menu-row-one.spec.ts`
- Site: `test/e2e/reforged-a-chip-press-applies-its-draft.spec.ts`
- Site: `src/components/sherpa-menu/menu-conditions.ts`

### T-a-layout-read-belongs-in-a-frame

A scroll listener that READS LAYOUT runs per frame, not per EVENT. `sherpa-menu`
once re-placed its card on scroll, reading two boxes, with a plain listener —
measured on an open chip menu in the Records example: **50 scroll events
produced 100 `getBoundingClientRect()` calls**. After throttling, **2**. The
platform places the card now (`T-anchor-cross-root`): a scroll reads nothing,
and only a bounded card's nudge still listens, once a frame.

`SherpaElement.onFrame(target, type, handler, options)` coalesces to one call
per animation frame. `on()` is the same without the throttle, for a handler
that reads no layout.

Both carry the element's disconnect signal, so nothing needs removing. That
replaced 22 hand-paired add/remove sites across seven files, two of which
removed unconditionally on disconnect whether or not anything had been added.

**`while` is the second lifetime.** A popover's viewport listeners live while
it is OPEN, not while the element exists, so the caller passes its own signal
and the base class ANDs the two with `AbortSignal.any`. Without it, the
listeners would outlive every close.

One measuring note, because it wasted a pass here: **an `AbortSignal` removal
does not call `removeEventListener`**, so wrapping those two methods to count
live listeners reports a leak that is not there. Count them through CDP's
`DOMDebugger.getEventListeners` instead — which showed zero scroll and resize
listeners on `window` both before and after five open/close cycles.

- Site: `src/core/ui/sherpa-element.ts`
- Site: `test/e2e/reforged-menu.spec.ts`
- Site: `src/components/sherpa-menu/menu-shell.ts`

### T-a-draft-dies-with-its-menu

A committing menu holds its ticks as a DRAFT until Apply
(T-commit-follows-select-mode). Cancel restored the baseline; closing any other
way — Escape, clicking away — did not.

So a reader who ticked "Northwind" and walked away left the chip holding
`["Northwind"]` with `current` false: it LOOKED set and filtered nothing. Worse
than no result, because the control disagreed with the data.

The close branch of `#onToggle` now restores the baseline, guarded by an
`#applying` flag so Apply and Cancel — which both call `hide()` — keep the
values they just decided.

One press is not a walk-away: the chip's own body APPLIES its open draft
(`T-a-chip-press-applies-its-menus-draft`).

- Site: `src/components/sherpa-menu/sherpa-menu.ts`
- Site: `test/e2e/reforged-menu.spec.ts`

### T-the-footer-owns-nothing-to-save

**A footer's commit and revert pair is OFF until something changed — and the
FOOTER does it, not each host.** Will, 2026-09-26 (TODO 66): *"so that all
menus etc can inherit this common behaviour."* The filter panel built its own
(`#syncDirty`, gone with its footer in step 6c), and `sherpa-menu` had a
`dirty` getter its footer never used.

A host REPORTS `data-dirty="true|false"` on its `sherpa-container-footer`;
the footer turns off the controls marked `data-footer="commit"` and
`data-footer="revert"` — declared, never guessed from a label. Absent, the
footer leaves them alone, so a footer whose host does not report is
unchanged; and when a host stops reporting, only what the footer itself
turned off comes back on.

`sherpa-menu` reports for a COMMITTING menu, on open and on every tick or
keystroke — at once, not a microtask later: an Apply pressed in the same
moment as the tick must already be on.

A calendar's pick is neither `input` nor `change` — it is `datetime-change`
or `range-select` — so the menu re-reads its draft on those too, or a picked
day left the footer's pair off (TODO 83).

- Site: `src/components/sherpa-container-footer/sherpa-container-footer.html`
- Site: `src/components/sherpa-container-footer/sherpa-container-footer.ts`
- Site: `src/components/sherpa-menu/sherpa-menu.ts`
- Site: `test/e2e/reforged-menu.spec.ts`
- Site: `test/e2e/reforged-a-calendar-pick-wakes-the-footer.spec.ts`

### T-a-tip-lives-in-the-top-layer

A tip — a button's, a chart mark's — is a `popover`, and is LIFTED to the top
layer while it shows. Will, TODO 157: "Tooltips should be at the top level in
CSS so that they sit above everything else."

`position: fixed` was not enough. A fixed box is held by the nearest ancestor
with layout containment, and every card is one (`container-type` gives it) —
so a tip was cut at its card's or its panel's edge. "Send Region to Customer
records" read "Send Region to Custome". The top layer has no ancestor.

**A tip shows ONLY while it is open** (TODO 364): `.sherpa-tip:popover-open`
is the one rule that shows it, so it can never show in place, where a box
clips it. CSS places it, by anchor positioning — an anchor and its tip share a
shadow root, so the name resolves from the top layer too. The browser's own
popover box (`inset: 0`, `overflow: auto`) is undone in the shared rule, or
the tip is placed by it instead.

Until 364, CSS showed a tip off `:hover` / `:focus-visible` and JS only
LIFTED it. Wherever the lift missed, the tip still showed, in the page, and its
card cut it. It missed whenever the pointer landed first on a part in another
tree: a button's `sherpa-badge`, or a slotted label (`closest()` stops at a
shadow or slot boundary). Measured in all three engines: shown, not open,
clipped.

**Each shadow root that holds an anchor hears its own tips, once; the document
hears none** (TODOs 381, 364; a root with no anchor listens to nothing, plan 695
P6). A `pointerover`, `pointerout`, `focusin` or `focusout` whose target and
related target are in ONE shadow root stops at that root: outside it, both ends
are the same host, so the browser dispatches nothing further. Heard on the
document, the first donut slice hovered showed its tip and the next showed
none. The root is always on the path, so `liftTipsIn` is all there is. It walks
`composedPath()` to the first anchor in ITS root, and stops at an element with
a `popover` (a menu the anchor holds is not the anchor).

**A tip is found four ways:** the first tip after its anchor among its
siblings (a chip's after both its buttons), one inside it, for a chart SEGMENT
(an SVG path, which no selector crosses) the tip of its `data-index` (TODO 283),
or the one its anchor is `aria-describedby`. That last is SHARED by many
anchors — the grid's one tag tip (TODO 490) — and the lift moves the anchor
name to the anchor that opens it, so the words reach a screen reader too.

**One tip is open at a time,** and a tip its host's CSS hides — empty,
`data-no-tip`, under an open menu — is shut again, never held open, and shuts no
other. That is read a FRAME after the hover, when the style is worked out anyway:
read in the handler it forced a style pass on every hover — 1 ms median in
WebKit (60 hovers, 87 ms), under 0.1 ms in Chromium and Firefox. Plan 695 P6.
Keyboard focus opens a tip only when it shows (`:focus-visible`): a press
opened it already, by hover.

**It drops a frame after `pointerout`.** Firefox still matches `:hover` while
the event is heard, so a check made at once left every tip open. Still focused
means the deepest focused element is inside the anchor AS DRAWN (through slots).
The cost: a re-render under a still pointer shows no tip until the pointer
moves.

`sherpa-tooltip`'s bubble is this tip too: `T-a-tooltip-is-always-in-the-top-layer`.

- Site: `src/core/ui/top-layer-tips.ts`
- Site: `src/core/ui/sherpa-element.ts`
- Site: `src/core/sherpa-anchor.css`
- Site: `test/e2e/reforged-button-tip.spec.ts`

### T-a-tooltip-is-always-in-the-top-layer

**A `sherpa-tooltip` bubble is a popover that the element opens, always**
(Will, 2026-10-15, TODO 300: *"Not all tooltips are on the CSS top layer and
are getting clipped"*). It had two modes. `data-floating` lifted the bubble;
the ordinary mode was "pure CSS", showing it off `:hover` in place. But the
bubble carried `popover="manual"` for the floating mode, and a closed popover
is `display: none` to the browser: the ordinary rule set `visibility`, and
nothing set `display`, so **an ordinary tooltip never showed at all** — and
where it was meant to show, a box with `overflow` would have cut it.
Nothing in the library used the ordinary mode, so only an app met it.

The ordinary mode is gone, and `data-floating` with it (`T-a-rename-drops-the-old-name`).

**Since TODO 364 its bubble IS the shared tip** — one tooltip system for every
component (Will: *"1 tooltip system for all components rather than any
duplication and deviation"*). The bubble is a `.sherpa-tip` after its
`.sherpa-anchor`, so its root's listeners open it and CSS anchors it
(`T-a-tip-lives-in-the-top-layer`); `data-placement` is only the preferred
`--_area`. Its own engine went: listeners on its anchor, measured placement,
hide-on-scroll (a tip now follows its anchor), the arrow and its `side-*`
states, `data-anchor` and `showFor()`. The chip and the grid's tag tip, which
used those two, carry the shared tip in their own roots. A `sherpa-button`
inside one takes `data-no-tip`, or the button's own tip wins: its root hears
last, and one tip is open at a time.

- Site: `src/components/sherpa-tooltip/sherpa-tooltip.ts`
- Site: `src/components/sherpa-tooltip/sherpa-tooltip.css`
- Site: `test/e2e/reforged-tooltip.spec.ts`

### T-an-unanswered-row-survives-a-redraw

**A condition row the reader has not answered yet is their work in progress,
and a redraw keeps it.** TODO 101, 2026-09-29. Every report goes to the source,
and the source draws the field's answer back onto EVERY bar over its scope —
the one that reported too — with its ANSWERED parts only (`answeredCondition`:
an empty row is none). Rebuilding the rows whenever they differ from what it is
given loses a new blank row: at once in a chip's menu (Add condition does
nothing), and later once the row's condition changes.

So `ConditionEditor.draw` compares ANSWERED parts only: an answer that matches the rows
the reader has answered keeps every row, blank ones too, and row one's
`data-op` follows the row shown. An answer that differs — a View, a saved
filter, a Clear from outside — still rebuilds.

- Site: `src/components/sherpa-menu/menu-conditions.ts`

### T-an-action-row-can-keep-its-menu-open

**An action row closes its card, unless it says not to.** TODO 181,
2026-10-01. "Edit filter" turns a saved filter's rows editable IN the card, so
closing the card on the click hid the very rows it opened. A `<button>` with
`data-stay-open` still reports its `menu-select`; the card stays up. Every other
action row closes it as before.

- Site: `src/components/sherpa-menu/sherpa-menu.ts`
- Site: `src/components/sherpa-menu/sherpa-menu.html`
- Site: `test/e2e/reforged-menu.spec.ts`

### T-a-dialog-answers-its-question

**A dialog asks the question its own markup holds** (TODO 191). `prompt(value)`
puts `value` in its first field and resolves what the field holds when its
LAST footer button is pressed — an empty answer keeps it open — and null for
any other button, Escape or a close. `confirm({ heading, words, action,
critical })` resolves true for the last button, false for anything else.
Sherpa Demos wired each of five dialogs by hand, in `ask-name.js`.

The markup stays the app's — HTML first, and its ids are what its tests
press. `confirm()` writes only what it is given: the Records delete dialog's
critical button stays critical, so a dialog asked two ways passes `critical`
both times.

It listens for `click`, not `button-click`: a press on a `sherpa-button`'s host
is a press too. It SHUTS before it resolves, so what the answer starts — a
delete that reloads the grid — never runs under an open dialog. A second
question answers the first with its "no".

- Site: `src/components/sherpa-dialog/sherpa-dialog.ts`
- Site: `test/e2e/reforged-dialog.spec.ts`

### T-a-mode-switch-carries-the-answer-over

Pressing the mode button with three values ticked seeds three ORed rows.

A reader who ticks values and then reaches for conditions is saying "now let me
refine THAT". Opening on a blank `Equals <first option>` throws their answer
away and does not say so.

`#seedFromPicks()` runs only when the rows hold nothing of their own, so a
second trip into condition mode never overwrites real work.

- Site: `src/components/sherpa-menu/sherpa-menu.ts`

---

### T-an-untouched-select-is-not-an-answer

A `<select>` shows its first option whether or not anyone touched it.

So reading `.value` made every untouched condition row report a pick — and
`#seedFromPicks` then believed the rows were already answered and carried
nothing over. The row records what the READER chose in `data-want`, written
only from a change event on the value select.

The same fact needs a PLACEHOLDER: a `<select>` has no `placeholder`
attribute, so an empty `Select…` first option is both the prompt and the proof
the row is unanswered. Will, 2026-09-24: "Conditional equal dropdowns, if not
populated from carry over, should default to a placeholder 'Select…' label."

`data-condition="advanced"` follows the same rule — it means ANSWERED rows, not
merely present ones, because a menu in Advanced mode always holds one row.

- Site: `src/components/sherpa-menu/menu-conditions.ts`

---

### T-a-held-clause-op-is-not-a-reading-op

**The grid held a CLAUSE op, and handed it to the data layer as a READING op.**

A column filter keeps the op its clause has: several ticks under `eq` are
`in`, under `ne` are `notin`, and two ends are `between`. Passed to
`readingClause()` unchanged, that op is wrong: a reading's op is what the
reader picked in the dropdown — `eq` or `ne` — and `picksClause()` makes
`notin` only from `ne`. Given `notin`, several picks became `in`.

So "Is not Pro, Free" reached the host as `['plan', 'in', ['Pro', 'Free']]`:
exactly the rows the reader excluded. Measured in the browser —
`columnClause('plan')` returned `in`.

It hid behind the menu. The menu draws a clause op the same way — `in` as `eq`
rows, `notin` as `ne` ones (`spread`) — so the menu read right; only the clause
the HOST got was wrong.

`treeReading()` is that mapping, once, for both: a clause comes back as the
reading a control holds. It also makes the column's
`state.condition` honest: `between` is a clause op, not an Advanced one, so a
range reads Simple, as it does on a toolbar chip.

- Site: `src/components/sherpa-menu/menu-conditions.ts`
- Site: `test/e2e/reforged-advanced-condition-words.spec.ts`

### T-a-condition-tree-draws-whole

The menu draws ONE condition tree as it was said: each group as a group of rows
with its own And or Or, nested as deep as it goes, and reads back the same tree.
A flat menu could not: two groups, a group not leading, or a part kept off had
no rows to say them, so the menu held such a tree aside, unseen, until the reader
edited a row — and then dropped it.

Two things a row cannot say are drawn so it can. A leaf of several picks — `in`,
`notin`, a list under `eq` — is one row a value, ORed (`notin`: `ne` rows ANDed);
a group of the same join flattens into its parent (`spread`). The keep test
compares both sides spread, so a host that hands the same `in` back does not
rebuild the rows. And an op the menu does not offer is offered on its own row,
not swapped for the first one. A part kept `off` is drawn in the secondary ink
and stays off.

- Site: `src/components/sherpa-menu/menu-conditions.ts`
- Site: `test/e2e/reforged-one-condition-tree.spec.ts`

### T-a-menu-is-reached-by-keys-from-its-trigger

**Only Chromium moves Tab from a popover's invoker into the popover** (its popover
focus navigation). Measured 2026-11-05 on a chip's menu: Tab from the open caret
reached Select all in Chromium 153, and went past the card to the next control in
Firefox 155 and WebKit 26.6. Once inside, Tab and Shift+Tab work in all three. And
Escape lost the focus everywhere: `hidePopover()` gives it back only from inside the
popover's own tree, and the rows are SLOTTED — children of the menu, not of the card.

So the menu owns its keys, in `menu-shell`, the same in every engine — the WAI-ARIA
menu button, for a card that is a dialog of native controls
(`T-a-menu-is-a-dialog-of-native-controls`):

- **The opener** is the control in the trigger that has the focus when the card
  opens, or that takes it while open. It is the way in, and the focus comes back to it.
- **A keyboard open** — the opener is a button that shows its ring
  (`:focus-visible`), as Enter or Space leaves it — puts the focus on the first row.
  A pointer's press does not, and a text field that opens a menu keeps its focus.
- **ArrowDown or ArrowUp on the shut trigger** presses its button, as a click would,
  and lands on the first or last row. Only the button of the trigger the menu is
  SLOTTED into, and only one that says `aria-haspopup` (itself or its host): a
  chip's caret, never its body, whose press toggles the filter.
- **From the opener**, Tab goes to the card's first stop and the arrows to a row.
  Chromium's own move is the same one, prevented, so it is never taken twice.
  Shift+Tab from that first stop comes back to the opener.
- **Between rows**, ArrowDown and ArrowUp move, Home and End go to the ends; they
  wrap. The focus only moves: a radio's own arrows would pick, and a selector
  shuts on its pick. Space ticks, Enter presses an action row.
- **Escape, or any shut with the focus in the card or nowhere**, puts it back on the
  opener. A press outside does not: the press takes the focus where it lands.
- **A Tab that takes the focus out of the card and its trigger** — past the last
  row — shuts it. Only a Tab: in WebKit a press on a row of a tag field's menu
  focused one of the field's tags, outside the card, and shutting on that lost the
  tick (measured, `reforged-input-tags`).

- Site: `src/components/sherpa-menu/menu-shell.ts`
- Site: `src/components/sherpa-menu/menu-list.ts`
- Site: `src/components/sherpa-nav/sherpa-nav.ts`
- Site: `test/e2e/reforged-a-menu-opens-by-its-keys.spec.ts`

### T-an-anchor-drawn-as-contents-has-no-box

An anchor drawn as `display: contents` has no box, so it anchors NOTHING: its
`anchor-name` names no box, its tip's `position-anchor` finds none, and its
`getBoundingClientRect()` is 0 × 0 at the window's corner. A collapsed node's row
draws its socket tabs as contents (its sockets stand in the node's stacks), and
each row socket's tip opened at the TOP LEFT of the view (Will, TODO 920); the
header's, a box, stayed put. Measured: the tip reads the window's corner, and
`keepNear` took that as the anchor and sat it there.

Two halves, so a tip finds its socket however the row is drawn: collapsed, the
row names the SOCKET with the tab's anchor; and `keepNear` measures an anchor
with no box by its first child that has one.

- Site: `src/core/ui/top-layer-tips.ts`
- Site: `src/components/sherpa-node-row/sherpa-node-row.css`
- Site: `test/e2e/reforged-node-collapse.spec.ts`

### T-firefox-restyles-no-has-focus-visible

Firefox does not restyle a rule whose `:has()` holds `:focus-visible`, inside a shadow root: measured (Firefox, TODO 931),
the floating panel's grip had the keys' focus and matched `:focus-visible`, the header matched
`:has(> .grip:focus-visible)` in a `matches()` call, and the rule's custom property still read empty — the title never
made room for the grip. Chromium and WebKit restyled it. So the panel sets a state on the grip's focus and blur
(`grip-shown`, its `:focus-visible` read then), and the CSS selects the state. The grip's OWN `:focus-visible` rule works:
only the `:has()` is not re-checked.

- Site: `src/components/sherpa-overlay-panel/sherpa-overlay-panel.ts`
- Site: `test/e2e/reforged-overlay-panel-minimise.spec.ts`

