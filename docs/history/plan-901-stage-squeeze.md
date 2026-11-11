# Plan 901: a stage made narrower pushes its nodes in

Will, 2026-11-11: "a second setting, under 900's, Allow stage resizes to move nodes: a stage made narrower than its nodes
need pushes them in. Reuse the Unfurl logic to nudge and redistribute them; perhaps the squeeze spreads back along the
graph as a gradual unfurl."

## Today (900)

- The edge between two stages drags. The stage before grows as the stage after shrinks, and no node moves.
- The edge stops where a stage's nodes need room. Stages are packed tight, so it often cannot move at all.

## The build

- **A new setting**, "Allow stage resizes to move nodes", at `/nodes/resizeStagesMoveNodes`, ON by default (D2 B). It is
  under Allow stage resizing, and it does nothing when that one is off.
- **With it on, the edge goes past the nodes:**
  - The shrinking stage's nodes nearest the edge move in.
  - A node that meets the next one pushes it on, in order, with the gap kept.
  - The edge stops at the narrowest the stage can be: its widest node and its pads.
- **The drag is drawn as it goes, and Undo takes it back in one step.** The nodes move by the same transition as Unfurl
  (902).
- **Connections and ties follow the nodes**, as they do on any move.

## Decisions for Will

**Will, 2026-11-11: D1 A (push), D2 B (on by default).**


- **D1. How the nodes move.**
  - **A (recommended):** a PUSH. Each node keeps its order and its height. Nodes move only across, and only as far as the
    edge pushes them. It is easy to predict, and it is quick at 2,000 nodes.
  - **B:** run Unfurl inside the stage, and lay its nodes out again as they fit. It is tidier, but every drag step
    re-lays the stage, and nodes jump about.
  - The squeeze that spreads back along the graph is 919's constraint engine (connector lengths and node radii). With A,
    that comes later, as 919.
- **D2. Is the new setting on or off by default?**
  - **A (recommended): off.** It moves the reader's nodes, so the reader turns it on.
  - **B: on**, as Allow stage resizing is.

My pick, where Will does not say otherwise: pushed into one column, two nodes may overlap until 918 gives nodes their radii.

## Steps

1. The data layer: `squeezeStage(workflow, id, w)`, beside `resizeStage`. It pushes the nodes and returns their moves.
   Unit tests for order, gaps, the floor and Undo.
2. The editor: the setting, the stage edge's range, and the drag drawn with the moves. Tests in three engines.
3. Demos: the switch under Allow stage resizing.
