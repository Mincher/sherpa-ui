# Plan 752 — move picked nodes together, arrange them on a grid

Will, 2026-11-05. (1) Drag one of several picked nodes: all move, same delta.
(2) A toolbar action arranges the picked nodes on a grid: no overlap if we can,
equal gaps from a spacing token, ties spread evenly in the gaps, bends reset.

## 1. Multi-drag

- The node still moves ITSELF and says `node-move`. The canvas hears it: if that node is
  picked and two or more are picked, the others get the same delta (their `data-x/y`), the
  lines redraw, and the host hears ONE `onMoveMany` (all places) instead of `onMove`.
- A drag on an UNPICKED node while others are picked picks only it, then moves it.
- Edit `{place}`: node places, tie places, and bends, in one pure step:
  a tie whose routes ALL join picked nodes moves by the delta; a route with BOTH ends picked
  has its `via` shifted by the delta; one end picked, `via` stays (the draw-time clamp 750 holds it).
- ONE journal step: tag `move:many` (the same tag merges inside a second, as a bend drag does).
- Query editor: places go to the session in one write.
- Keys: nothing uses arrows on the canvas itself unless a tie or bend is picked, so with
  nodes picked and the canvas focused: Ctrl/Cmd+Arrow moves them 8px (Shift 32px).

## 2. Arrange (pure: `src/core/data/node-arrange.ts`)

```
 before (messy)            after: columns by flow, rows by barycentre
   B   A                   col0     gap    col1     gap    col2
      C    D                [A]  ------->  [C] -----+-->  [E]
   E                        [B]  ------->  [D] ----/
```

1. Only routes with BOTH ends picked count. A cycle (bad file): a depth-first walk in id
   order drops the edge that closes it, so the walk ends.
2. Column = longest path from a source along those routes. Sources left.
3. Rows: a long edge gets a dummy node in each column it crosses. Start from the current
   y (tie: id); sweep down then up by barycentre, 4 rounds. Keep the order with the fewest
   crossings of the straight lines drawn between node centres; the input's own order is a
   candidate, so the result is never worse than the input's ORDER.
4. Place on a grid (Will, 756): column x = previous x + widest node in it + `gapX`; row y =
   previous y + tallest node in it + `gapY`; each node at its cell's top left, so the top edges
   of a row and the left edges of a column line up. All snapped UP to the 4px grid. The block's
   top-left (min x, min y, snapped) is where the picked nodes' was.
5. Gaps: ONE token, `--sherpa-display-mode-space-5xl`, three times (`ARRANGE_GAP_STEPS = 3`, Will 756:
   168px), read from the canvas (getComputedStyle,
   one fallback constant in node-graph.ts). The data function takes numbers.
6. Ties: a tie whose routes all join picked nodes goes into the gap before its shortest
   route's target column; several in one gap are spaced equally along x; y = mean of its
   routes' y at that x; then clamped by `tieLimit` (no room: the limit's single point).
   Any other tie touching a moved node is only clamped.
7. Bends: `via` of every route touching a picked node is cleared (`unbend`).
8. Edit `{place}` carries it all: ONE step, undo restores places, ties, bends exactly.

## 3. UI

Toolbar button `arrange` (`data-can-arrange`, set when two or more picked), icon `arrange`
(new 14x14). `onArrange` host option on both editors. Group Input/Output are locked
(derived places), so they stay.

## Tests

Node: layers, order, crossings (Demos' graphs, random DAGs), equal spacing, grid, anchor,
ties, one column, a cycle, the `place` edit and its faults. Specs: real pointer and keys.
