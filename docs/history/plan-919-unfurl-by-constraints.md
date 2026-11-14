# Plan 919: Unfurl by constraints

**Status: a plan, for Will's D1 (sherpa-ui-e8, 2026-11-14). Nothing is built.**

Will, 2026-11-11 (TODO 919): "918's mechanics — connector lengths kept, nodes held apart by their radii — with or in
place of today's Unfurl: no node overlaps, every node a route comes from stands to the left of where it goes, and the
layout spreads along the graph as the chain drag does. Measure it against today's Unfurl (crossings, backwards lines,
time at 2,000 nodes) before it replaces it."

## Today, measured

`unfurlNodes` (`node-unfurl.ts`, DOM-free) on flow-like graphs: layers of 1 to 6 nodes, each fed by 1 or 2 earlier
nodes, boxes 200 to 320 by 80 to 280 px, a seeded random. Lines are straight, from a node's right middle to the next
one's left middle; a crossing is two lines that share no node and cross.

| Nodes | Lines | Time | Overlaps | Crossings | Backward | Mean line |
|---:|---:|---:|---:|---:|---:|---:|
| 50 | 60 | 19 ms | 0 | 16 | 0 | 378 px |
| 200 | 237 | 46 ms | 0 | 62 | 0 | 575 px |
| 500 | 607 | 113 ms | 0 | 325 | 0 | 818 px |
| 2,000 | 2,429 | 1,634 ms | 0 | 457 | 0 | 489 px |

So today's Unfurl already keeps two of the three rules: no overlap, and no line goes back. What it does not do is the
third: it places by rings and layers, so a line's length is whatever the layers give. The chain drag's look, every
connector near one length and nodes kept apart by their radii, is what is new.

Demos' six workflows have 5 to 27 nodes. Measured with guessed boxes they say little; step 1 measures them in the
browser, with the boxes as drawn.

## The design

A **relax pass** (`node-relax.ts`, DOM-free), from a seed:

1. **The seed is today's Unfurl.** Its layers and its order, which cross least, are kept as the start.
2. **Each step**, for a fixed number of rounds:
   - **Flow (hard):** a node a line comes from stands left of where it goes: `x(to) ≥ x(from) + w(from) + gapX`.
   - **Length (soft):** each connector is pulled toward one rest length of the relax pass's own: Unfurl's column gap,
     `gapX`, between the two nodes' facing edges. The chain drag has none since 975, which made its pull a weight by
     distance (sherpa-ui-bd, 2026-11-14).
   - **Radii (hard):** no two nodes closer than their radii (`radiusOf`, half the largest side). A grid of cells, each
     two of the largest radius across, finds the near pairs, so 2,000 nodes cost about n, not n².
   - **Stages (hard):** each node stays in its stage's band (TODO 950); a frame moves as one, as in Unfurl.
3. **Then** every place snaps to the 4 px grid, as Unfurl's do.

It reuses the chain drag's radius (`radiusOf`) and its no-overlap push, so a drag and an Unfurl agree on what
"apart" means.

## D1 (for Will): with, or in place of?

- **A (my pick): one Unfurl, the relax pass after it.** The same button and key. It ships only if, on the table above
  and on Demos' graphs in the browser, it has no more crossings, no overlap, no line back, and takes at most twice the
  time. Else it stays unbuilt, and the numbers say why.
- **B: a second button,** "Unfurl by constraints", beside Unfurl; the reader picks each time.

## Steps (after D1)

| Step | Builds | Proves |
|---|---|---|
| 919a | The measure as a script (`scripts/measure-unfurl.mjs`): the table above, and Demos' graphs in the browser with drawn boxes | the numbers, each run the same |
| 919b | `node-relax.ts`: flow, length (its own rest length, `gapX`), radii and stages, on a seed | unit: no overlap, no line back, each node in its stage; a line's length within a band of the rest length |
| 919c | Unfurl runs it (A) or a second button does (B) | e2e: one Undo; the table again, side by side |

## Who

sherpa-ui-e8 writes it; sherpa-ui-bd built 918's chain drag (`node-chain.ts`, its ropes gone in 975) and 950's
stages, so bd reviews 919b before it is merged (bd: yes).
