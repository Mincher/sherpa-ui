# Plan 569 — Unfurl graph: lay every node out round the most connected one

**Status: PLANNED, 2026-11-05, lane `lane/unfurl-569`.** It builds on plan 752 (Arrange, the `{place}` edit,
`crossings`), plan 778 (frames) and plan 562 (zip ties). Portals (779) are built in another lane.

## What Will asked

Will, 2026-11-05: *"We definitely need the node graph unfurling as graphs can get dense and confusing with a lot
of crossing connectors."*

Will, 2026-10-29 (TODO 569), in short: a toolbar tool. A weighted cell per node; a node's centre at its cell's
centroid. A cell's weight is its connectors, in and out, each route counted (several on one socket count each).
Two connected nodes' cells must touch. Start at the node with the most connections, at the centre, its weight
times its connections: the anchor. Spread its neighbours evenly round it, each weighted by its connections, nearer
or farther by its weight ratio to the anchor ("closer weight ratios move further away"), turned to keep a Delaunay
edge. Then the next generation; move an earlier one where a weight needs it. "Almost like a physics driven
unfurling", fast and cheap. His full words are in `docs/TODO.md`, under TODO 569.

## The algorithm, in steps

A pure function, `unfurlNodes(graph, ids, options)` in `src/core/data/node-unfurl.ts`. No DOM, no random number.
The same graph and boxes in give the same places out. The places a node had do not change where it goes, so a
second Unfurl gives the same layout (idempotent).

1. **Cells.** One cell per node. A frame is ONE cell: its box is its nodes' box with the frame's pad and header.
2. **Weights.** A cell's weight is its route ends: each route in and each route out, once each. Three routes on one
   socket count three. A route inside one cell (inside a frame) counts for no cell.
3. **Parts.** Cells joined by routes are one part. Each part is laid out alone (steps 4–9), with its own anchor.
4. **The anchor.** The cell with the most connections. A tie: the one with the most different neighbours, then the
   lowest id. Its weight is its connections times its connections (Will's rule). It stays where it is on the plane.
5. **Generations and rings.** A walk out from the anchor gives each cell its generation, and a SIDE by the flow: a
   cell the anchor sends to goes right, a cell that sends to it goes left. So each cell has a signed ring: the
   anchor is ring 0, its outputs ring 1, its inputs ring −1, and so on. The rings are then made VALID: every route
   goes to a higher ring (a longest-path layering first, then each cell moves to the valid ring nearest its own).
   A loop's closing route is left out of this, as Arrange leaves it out.
6. **The order on each ring ("turned to keep a Delaunay edge").** Each ring is ordered by the barycentre of its
   cells' neighbours: going out from the anchor by the rings inside, coming back by the rings outside, four rounds.
   Every distinct order is a candidate.
7. **The centroid pull (the cells' balance).** Each cell's height moves toward the weighted centroid of its
   neighbours' heights; a neighbour pulls by its weight, so the anchor (its weight squared) holds its own ring
   close round it. The heights are then put back in the ring's order with their gaps kept: the nearest heights
   that keep the order and the gaps (an isotonic projection). 24 rounds. A cell never passes another on its ring,
   so the order of step 6 survives.
8. **The arcs ("nearer or farther by the weight ratio").** Ring r is an arc round the anchor. Its middle stands
   Arrange's gap past the ring inside it, and a little more as the ring is taller (an eighth of its height, at most
   one gap); its heights reach ±60° of the arc, so its ends bend back toward the anchor. A cell sits on its arc at
   its height, out by half a gap times its weight ratio to its heaviest neighbour: a ratio near 1 (a hub beside a
   hub) sits farther out, a leaf beside a hub sits in. Inputs fan out to the left, outputs to the right.
9. **Flow and no overlap, in x alone.** Ring by ring out from the anchor, each cell moves out (right, or left on
   the left side) only as far as it must: past each of its sources by Arrange's gap, and past every cell placed
   before it whose height band it shares. Heights never change here, so no two cells overlap and every route
   runs left to right.
10. **The best candidate.** Each candidate order of step 6 is drawn by steps 7–9; the one whose connectors cross
    least wins (the `crossings` of Arrange, over the drawn boxes); a tie keeps the first.
11. **Parts side by side.** The biggest part first, the rest to its right by Arrange's gap, tops level. Lone nodes
    (no route) stand in one column after them. The first part's anchor keeps its place.
12. **The grid.** Every place is snapped to the 4px grid. The gaps carry the grid's step, so the snap never takes a
    gap below Arrange's gap.
13. **Ties.** A zip tie whose routes all join moved nodes goes to the middle of its routes, held by `tieLimit`, as
    Arrange holds one. Bends reset, as Arrange resets them.

Will's words, mapped: "cell" and "weight" are steps 1–2; "start at the node with most connections … multiply its
weight" is step 4; "equally distribute each connected node … around the start centroid" is steps 5 and 7's first
spread; "closer weight ratios move further away" is step 8; "maintain a Delaunay edge by adjusting the angles" is
steps 6 and 7 (a linked pair stays adjacent, with no cell between them on a ring); "next iteration … move a previous
generation" is steps 7–9 (a full ring pushes its arc out, and every ring after it); "cells must bisect" is the
centroid pull (step 7) holding linked cells as near as their gaps allow.

## Picks

| | Pick | Why |
|---|---|---|
| Scope | The WHOLE graph, always. On with two or more nodes, off read only | Will: "a cell for each node on the canvas". Arrange is the tool for picked nodes |
| Flow | Inputs fan left, outputs right (a flow-aware unfurl) | A connector is drawn from an output on a node's right edge to an input on a left edge. A full circle draws half the lines backwards, in loops |
| A frame | Moves whole: ONE cell, its nodes keep their column | The reader made the column with Frame; unfurling inside would undo it |
| Portals (779) | NOT connected: an In and an Out of one name have no route, so neither pulls the other. Each sits by the nodes its own routes join | A portal exists to put two places far apart with no line; pulling them together undoes that |
| Parts | Each its own anchor, side by side, biggest first; lone nodes in one column after | Will's anchor is per graph; a part with no route to the anchor has no ring |
| Gaps | Arrange's: 3 × `--sherpa-display-mode-space-5xl` (168px), both ways | One spacing in the editor |
| Group Input, Group Output | Not moved (derived places), and their routes not counted | As Arrange |
| The edit | ONE `{place}` edit: nodes, ties, bends reset. ONE Undo step | As Arrange (TRAP T-an-edit-is-a-step) |
| After | Fit: the view fits the unfurled graph | It can grow past the view |
| Query editor | Unfurl too: the places are the tab's, as Arrange's there | One toolbar; its graph is drawn, never kept |
| No pointer | The toolbar's buttons take the keys; `unfurlGraph(canvas)` is the door a caller types | PRINCIPLES 21 |

## The measure

`crossings` (node-arrange.ts): how many pairs of straight lines, from a node's right edge to the next's left edge at
mid height, cross. Unfurl must not raise it on the test graphs, and should lower it on a dense one. Measured (gap 168, boxes 240
wide, 80–260 tall; the Devices graph with its drawn boxes):

| Graph | Nodes | Routes | Before | Unfurl | Arrange |
|---|---:|---:|---:|---:|---:|
| Demos' List active customers (tidy) | 5 | 4 | 0 | 0 | 0 |
| A diamond (messy) | 4 | 4 | 1 | 0 | 0 |
| A store, 4 fields, 4 conditions with values, an And (tidy) | 15 | 17 | 6 | 0 | 4 |
| A hub: 8 fields between a store and an And (messy) | 10 | 16 | 7 | 0 | 0 |
| Demos' Devices that need attention (shipped tangled) | 27 | 32 | 69 | 0 | 12 |
| A random DAG (messy) | 20 | 31 | 104 | 25 | 25 |
| A random DAG (messy) | 30 | 44 | 127 | 36 | 35 |
| A random DAG (messy) | 30 | 53 | 283 | 47 | 74 |
| A random DAG (messy) | 60 | 116 | 1583 | 442 | 504 |

Over the eight random DAGs of the node test, unfurl leaves 569 crossings and Arrange 699. No connector runs right
to left on any graph; no two nodes come closer than the gap. Time (node, M-series, a quiet machine): 20 nodes about
1 ms, 100 about 8 ms, 300 about 50–65 ms; under a load average of 32, 300 nodes took 120–130 ms.

**Measured on the way, and dropped.** A free spring-and-push relaxation (prototype 1): 3 crossings left on the tree
and 575 ms for 300 nodes. Pushing a node out along its ray from the anchor: 43 lines drawn backwards in 300 nodes.
A circle whose radius grows with the ring's height: the Devices graph 5108 px wide (now 2820). Balancing the rings'
heights by moving a node to a lighter ring it may stand in: 2000 px less tall, but the Devices graph crossed 15 times
and the tree twice. The Devices graph stays tall (5179 px): 14 nodes share the anchor's first ring, at Arrange's
gap, and a lighter ring would cross lines.

## Build

| File | What |
|---|---|
| `src/core/data/node-unfurl.ts` | `unfurlNodes`: the algorithm above. Pure |
| `src/core/ui/node-graph.ts` | `unfurlment(canvas)` reads the boxes and the frames' margins; `unfurlGraph(canvas)` places and hands the host the places; both editors take the `unfurl` action, Fit after; `data-can-unfurl` |
| `sherpa-node-toolbar` | An `unfurl` button, "Unfurl graph", after Arrange; `data-can-unfurl` |
| `src/icons/unfurl.svg` | A hub and four nodes on spokes, 14×14; `npm run icons` |
| `docs/traps/data-layer.md` | `T-unfurl-keeps-the-flow`: why rings, why x alone, why the frame is one cell |
| Demos | A second shipped workflow on the Devices data: "Devices that need attention", deliberately tangled |

## Tests

- Node: deterministic (twice, the same); idempotent; the anchor (most connections; the tie rule; it keeps its place);
  weights count each route on a socket; crossings do not rise on the tidy graphs and fall on the dense ones; no
  overlap and every gap at least Arrange's; the 4px grid; every route left to right; parts side by side and lone
  nodes in a column; a frame moves whole; a tie held in its limit; timings for 20, 100 and 300 nodes.
- e2e, three engines, real pointer: press Unfurl on a tangled graph: nodes move, none overlap, the drawn crossings
  fall, Fit shows them all, ONE Undo restores every place. Off on a read-only graph and with fewer than two nodes.
  The Query editor's Unfurl keeps the places for the tab.
- Demos, three engines: the dense Devices workflow opens with no fault; Unfurl lowers its drawn crossings; Undo.

## Questions for Will

1. **Flow.** (A, picked) inputs fan left and outputs right, so every line runs left to right; (B) the full circle of
   your words, lines in every direction.
2. **Scope.** (A, picked) the whole graph, always; (B) the picked nodes when two or more are picked, as Arrange.
