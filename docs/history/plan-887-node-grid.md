# Plan 887 — a node is a grid

Will, 2026-11-10 (TODO 887, which takes in 886): "reformat the structure of nodes, their rows, and sockets, to be a grid
layout instead of positioning sockets offset relative to the row. So all nodes will be 3 columns. Input Sockets, Node
Rows, Output Sockets. We put sockets in cells where we need them and gaps where we don't. CSS can handle this. True
output sockets go in the cell to the right of the header. False output sockets will need a row added at the bottom but
that row only needs to be as high as the output socket (and its wrapper). All nodes will now also have a wrapper that we
can style to connect them to the node body." And 886: an output socket out of the row, into a wrapper as an input is: the
field gets the width back, and the output is easier to see.

## What is there now

- `sherpa-node` draws a card: its header (the drag handle, with the header's two sockets inside it), its rows in a slot,
  and a fork's footer (the False socket). `sherpa-node-row` is one row: a label or a field, and its two sockets. The
  graph puts rows in grey boxes (`div.section`): Type; Parameters; Properties.
- Every socket is placed by OFFSETS: `position: absolute` and an `inset` from its row, its header or its footer.
- An input socket sits in a DOCK (a half-round tab of the box's grey) on the grey box's start edge, 8px inside the card.
  An output socket sits INSIDE the row's end padding: the row pads 24px for it, and the field loses that width.
- Collapsed, every socket stands in one stack a side. The graph COUNTS each side (`data-inputs`, `data-outputs`, and the
  routed counts) and gives each row its places (`data-input-at`, `data-output-at`, and the routed ones) in
  `stackPlaces()`, once per node per draw; the CSS does the sums (`--_stack-*`), and two spans draw the stacks' docks.

## The model: one grid of 3 columns

```
 in      the card                       out
┌────┬───────────────────────────────┬────┐
│ ◖  │ ▶ Header: icon, name, line   ⋯ │ ●  │  row 1: the header; True is the header's output
├────┼───────────────────────────────┼────┤
│ ◖  │   Type      [ Equals     ▾ ]  │    │  a row: its sockets in the side cells, a gap where it has none
│    │   Value     [ 42          ]  │ ●  │
│ ◖  │   Rows                        │ ◆  │
├────┼───────────────────────────────┼────┤
│    │                               │ ▢  │  a fork: one more row, only as tall as False and its wrapper
└────┴───────────────────────────────┴────┘
```

- **The node's root is the grid**: `grid-template-columns: <track> 1fr <track>`. A track is a socket and its wrapper:
  28px (the 16px socket and its 6px press area each side), the size the stacks use now.
- **The card is the middle column**: its border, fill and corners are a part of their own, behind the cells
  (`grid-column: 2; grid-row: 1 / -1`). The tab on its top edge (`data-caption`) and the resize corner stay on the card.
- **The header is row 1**: the input socket, the header, the output (True on a fork). The header's sockets move OUT of
  the header element (the role=button drag handle) to be its siblings, so the button is still a box.
- **A row spans the 3 columns** (`subgrid`), and so does a grey box. A row's cells: its input socket, its content (the
  label above the field, as now), its output socket. A row with no socket on a side leaves that cell empty: "a gap where
  we don't". The grid lines every socket up the node's edge, row by row; nothing is placed by an offset.
- **A socket sits on its control's line**: the field's last line, one control high, as now (a label alone: its middle).
- **A fork's False** is one more row: the output cell only, as tall as the socket and its wrapper.
- **Each socket has a WRAPPER** (`part="dock"`), the thing a look styles to join it to the card: by default the card's
  fill and border on its three outer sides and none on the card's side, round on the outside, as the input's dock is now.

## Collapsed: one strip a side, as now

Will's answer is B when a node is collapsed: one strip a side, from its first socket to its last. That is today's
collapsed node, so it stays: every socket stands in one stack a side, in order (header, rows, False), each 28px under
the last from the header's middle, on one strip of the card's fill and border; the graph gives each side's count and each
socket's place (`stackPlaces`). Only its anchor moves: the stacks stand in the side columns, against the card's edge.

Packing the grid itself (`grid-auto-flow: row dense`, the rows `display: contents`) was looked at and set aside: CSS
cannot count sockets across the rows' shadow roots, so a strip could not end at its last socket, and a 56px header row
breaks the 28px steps from the header's middle.

## What goes

- Every EXPANDED socket offset (`inset-*`, the negative margins) in sherpa-node.css, sherpa-node-row.css and
  sherpa-node-sockets.css: a cell places it.
- The row's 24px end padding for an output socket: the field takes that width back (886).
- The header's sockets inside the drag handle: they are its siblings.

## Decisions — Will, 2026-11-10: 1 A; 2 A, "but B when nodes are collapsed"

Will answered 1 A and 2 A here, and in the Harness session (relayed by acp-module-d7): "1. A. 2. A but B when nodes are
collapsed." Asked which flips when collapsed, he picked "only the wrapper". So: the socket columns stand outside the
card, expanded or collapsed; an expanded node has a wrapper a socket, a gap between; a collapsed node keeps one strip a
side (above).

1. **Where the socket columns stand.**
   - A: outside the card. The card keeps its width, and the field gets the output's 24px back; each wrapper is a tab
     joined to the card's edge. The node is 56px wider in all (2 × 28px).
   - B: inside the card. The card is the grid; the side columns are its edge padding. The node keeps its width.
   - I would go with **A**: it is what "a wrapper we can style to connect them to the node body" reads as, and it is
     how the input's dock and the collapsed stacks look now.
2. **One wrapper a socket, or one a side.**
   - A: one a socket, a gap between ("gaps where we don't").
   - B: one strip a side, from its first socket to its last.
   - I would go with **A**: a gap says "no socket here", and collapsed, the packed sockets read as one strip anyway.

## Steps (each its own commit; the node specs and the gates green after each)

1. **The grid and the card**: sherpa-node's root is the grid; the card is its middle column; the header's sockets are
   its siblings in row 1; the False row. The sockets' family sheet loses its offsets.
2. **A row is a subgrid**: sherpa-node-row's cells, its sockets in wrappers; a grey box is a subgrid too, its fill on
   the middle column only (its own slice on each row, or `::slotted(.section)::before` if all three engines draw it —
   measured first). The output's end padding goes.
3. **Collapsed keeps its stacks**: they stand in the side columns, against the card's edge; the rows and the grey boxes
   are `display: contents` there, as now.
4. **Measure**: every route still meets its socket (the route tests, in three engines); the screenshots of a node, a fork and a collapsed node, before and after.
5. **Docs and Figma**: the specs, the reference, the trap for the grid (`T-a-node-is-a-grid`), and the structure sent to
   the Harness Figma session (acp-module-d7), which waits for this plan, and to sherpa-ui-6b (plan 883).

## Risks

- **Routes read each socket's box on the screen** (`socketRect`): a socket in a cell is still a box, so the routes do
  not change. A wider node (decision 1 A) moves every output 56px right: Arrange and Unfurl read node widths from the
  graph's `nodeWidth`, which must say the same.
- **Subgrid** is in all three engines; a row alone (its own example, with no grid round it) falls back to a row of three
  cells.
- **`display: contents` on a role=button** drops it from the accessibility tree in some engines: so the header element
  keeps its box, and only plain elements (a row, a grey box, the slot) are `contents`.

## Out of scope here

TODO 889 (the active border shows what is joined) and 888 (ties as Unfurl anchors): their own items, after this.
