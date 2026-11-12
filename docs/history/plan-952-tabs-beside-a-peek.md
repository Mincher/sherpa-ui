# Plan 952: The tabs stand beside a peek

Will, 2026-11-12: "When a panel tab is hovered over, all tabs should be placed on the left/right side (right and left
panel areas respectively) of the overlay panel that is opened. This is to allow the user to click other tabs while still
engaging with the panel." Plan only: other work comes first.

**Waits on Will: D1, D2.**

## Today (read in the code, 2026-11-12)

- **Each panel draws its own tab**, in its own shadow root. `#stack()` (static) stacks the tabs of one side of one room
  (the window, or the layout a panel is slotted in): it writes `--_tab-index` and `--_tab-top` on each tab
  (`sherpa-overlay-panel.ts:273`).
- **The tabs stand on the area's outer edge**: `right: 0` on the end side, `left: 0` on the start side; `fixed` on the
  window, `absolute` in a layout (`sherpa-overlay-panel.css:172–198`).
- **A hover peeks the panel** (`data-hover-open`; Demos sets it from `/panels/hoverOpen`, on by default). The peek is
  flush at that same edge, so it covers the other tabs, and its own tab is hidden (`.css:143`, `.css:165`).
- **The peek shuts at once when the pointer leaves the panel's box** (`#onPeekMove`, `.ts:647`). The other tabs are under
  the panel, so the reader cannot get to them while it is open.
- **An overlay that is OPEN (pressed, not a peek) is already beside the tabs:** it moves in by the strip
  (`--_tabs-inset`, `sherpa-layout-panels.css:96`), and the tabs stay at the edge. Only a peek covers them.
- The trap `T-a-panel-peeks-from-its-tab` says the peek shuts "after 250ms". The code shuts it at once.

## The build

1. **The tabs move to the peek's inner side.** In the end (right) area they stand on the panel's LEFT edge; in the start
   (left) area, on its RIGHT edge. The panel stays flush at the area's edge. All the tabs of that side move, in the same
   order and at the same height.
2. **One number tells where.** `#stack()` also writes `--_tab-shift` on each tab of the group: the peeking panel's
   `.root` width, or 0 when no panel peeks. The CSS reads it: `right: var(--_tab-shift, 0px)` on the end side,
   `left: …` on the start side. A tab cannot see another panel's width in CSS (each is in its own shadow root, and an
   anchor name does not cross a shadow root), so JS reads it ONE time for each peek, not for each frame. Stack again when
   a peek starts, when it ends, and when its resize edge lets go.
3. **The hovered tab stays in the group, drawn ON** (the active mode's base: base / +1 / +2). Delete the rule that hides
   it (`.css:165`). So no tab jumps up when another one shows.
4. **One peek for each room side.** A hover on tab B while A peeks shuts A and peeks B in the same step. The tabs do not go
   back to the edge between the two. Kept beside `#stack()`, in the same class: no component talks to another.
5. **The box the pointer may stay in is the panel AND its tabs:** one rectangle around both, so a gap between them is
   in it too. `#onPeekMove` and the check in `#onPeek` read that box. Out of it, the peek shuts, and the tabs go back to
   the edge.
6. **The tab's look does not change.** Its flat side and its edge line (`::before`) now meet the panel's inner edge,
   not the area's edge. The tabs stand over the content and beside the panel, never under it. No new motion.
7. **Touch:** a tap peeks (`#onTab`), and the tabs move the same way. A tap on another tab peeks that one. A press outside
   the panel and its tabs ends the peek. **Keyboard:** no change. A peek is for the pointer; Enter on a tab opens it for
   good.
8. **On the tab of 876.** 876 makes the tab horizontal, inset 16px, and stitched in a `sherpa-group`. This plan changes
   only where the group stands, so it holds for both tabs. Build it after 876 if 876 is next, so the CSS is written one
   time.

## Tests

- **sherpa-ui e2e** (in `test/e2e/reforged-panel-overlay.spec.ts`): two panels minimised on the END side. Hover tab 1:
  each tab's right edge is the panel's left edge (±1px), and both tabs show. Move to tab 2: panel 2 peeks, panel 1 is
  shut, and the tabs stay beside it. Move onto the content: no peek, and the tabs are back at the edge. The same on the
  START side (mirrored), on the window and in a layout.
- **Demos:** `reforged-panel-tabs` on Records: the filter panel and one more panel as tabs.
- **Gates:** `lint:css`, `check:props` (no new `data-*`: `--_tab-shift` is private, a peek is a `:state()`),
  `check:traps` (the words of `T-a-panel-peeks-from-its-tab`: the tabs stand beside the peek, and it shuts at once),
  `check:map`, `spec:check`.

## Files

- `src/components/sherpa-overlay-panel/sherpa-overlay-panel.ts` — `#stack`, `#peek`, `#onPeek`, `#onPeekMove`
- `src/components/sherpa-overlay-panel/sherpa-overlay-panel.css` — `.css:143–147`, `:165`, `:172–212`
- `src/components/sherpa-layout-panels/sherpa-layout-panels.css` — `:96` (`--_tabs-inset`), if D2 is A
- `docs/traps/menus-tips-overlays.md` — `T-a-panel-peeks-from-its-tab`

## Decisions for Will

**D1. You go from tab 1 to tab 2, and panel 2 has a different width. Then the tabs move under the pointer.**

- **A — the tabs follow each panel's edge.** Less code. Each panel keeps its own width. The pointer can fall off the
  tabs, but only when the widths differ. Measure first: the panels of one area may all have the area's width.
- **B — in one hover, each panel peeks at the width of the first one,** so the tabs stay still. More code, and a panel
  shows at a width that is not its own.

I would go with **A**.

**D2. An overlay that is OPEN (pressed, not hovered) keeps the tabs at the edge and moves in beside them. A peek will put
them on its inner side. That is two rules.**

- **A — one rule:** an open overlay also puts the tabs on its inner side, and stays flush at the edge. Delete
  `--_tabs-inset`.
- **B — only a peek moves the tabs.** An open overlay stays as it is now.

I would go with **A**: one rule, less code, and the same look in both.
