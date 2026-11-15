# Plan 1001: a node's place saves itself; a graph is unfurled when it opens (rows 1000, 1001)

Will, 2026-11-14:

- "When a graph is loaded in the canvas view it should get an unfurl applied once ready." And: "Exiting Swimlane mode
  should apply an Unfurl to the graph, also." (row 1000)
- "Node position edits, unfurls, swimlane toggles don't count as edits requiring a save. They apply and save
  automatically." (row 1001)

**Status: written by sherpa-demos-67, with sherpa-ui-a9's traps (2026-11-14). Will picked D1 A, D2 A, D3 B (in his words:
section 4), D4 A (2026-11-14). 1001a built (sherpa-ui-a9, 2026-11-14): the place set in graph-layout.ts, the hash, draftChanged
and D1's roll back; a node's size is in the place set too, as `NodePlaces` holds it and graphKey leaves it out. Owners: sherpa-ui-e8 (the canvas), sherpa-ui-a9 (the draft and the version hash), sherpa-demos-67 (Demos' specs).
After the node work of plans 991 and 992.**

## 1. The rule

**Save is for what a graph DOES. Where it is drawn saves itself.** A node moved, an Unfurl, and Swimlane mode on or off
are kept at once on the graph the reader keeps: no unsaved change, no Save lit, no tab draft. Unfurl has one door: the
toolbar's, on opening a graph, and on leaving Swimlane mode.

## 2. Today

- A move is a draft change like any other: the tab keeps a draft (`sherpa:session:/workflows/<id>`), and Save is lit.
- A version's hash counts where its nodes sit (entity-versions.ts: "a roll back puts them back too").
- graphKey (graph-text.ts) leaves places out, but it reads the stage LABELS, not the `stage` each node names.
- `lanes` (Swimlane mode) and each stage's x and width are fields of the definition.

## 3. The traps (sherpa-ui-a9)

| # | Trap | The way out | Owner |
|---|---|---|---|
| T1 | A new hash flags every kept entity: draftChanged compares the STORED newest hash (places in it) with one made now | draftChanged hashes `newest.definition` again with the same function, or the stored hashes are retrofitted on load (entity-shelf.ts:88 compares stored hashes only: safe) | a9 |
| T2 | graphKey does not see a node's `stage`: a move across a stage line changes the run order, and graphKey stays the same | graphKey adds `node.stage` (D2) | e8 |
| T3 | `lanes` and stage x and width are in the definition, so a Swimlane toggle changes the hash | ONE helper names the place set (node x and y, tie x and y, bend points, stage x and width, lanes); hashOfDefinition, graphKey and the save-by-itself path all use it | a9 (hash), e8 |
| T4 | Save writes the tab draft's WHOLE graph: a place kept at once must go into the draft too, or Save puts the old place back. A place is written onto the KEPT graph, never the draft's (the draft may hold what checkEntity refuses); a node only in the draft keeps its place in the draft | as said | e8 |
| T5 | With row 1000, opening a graph would write the shelf (watch fires in other tabs) | write only when a place changed; never for a preset (D3), a version shown read only, or a use's inner graph | e8 |
| T6 | Roll back puts a version's whole definition, places too, into the draft: the nodes jump back | D1 | a9 |
| T7 | A drag saved each frame runs checkEntity each frame | save when the drag ends | e8 |

Good: with no tab draft on a move, an agent's change, publish and roll back are no longer refused after a move alone
(T-a-draft-hides-a-save), if a drag makes no draft when it starts.

## 4. Will's picks (2026-11-14: D1 A, D2 A, D3 B, D4 A)

- **D1 A:** a place is no part of a published version; a roll back keeps today's places.
- **D2 A:** a move into another stage is an edit: its place saves itself, its stage waits for Save.
- **D3 B, in Will's words: "Position edits are only kept for the session and are discarded when the session ends."** A
  preset's places are never written to the shelf: a move, an Unfurl or a Swimlane toggle on a preset is kept in the tab's
  session alone (`sessionStorage`), and a new session draws it as shipped, then unfurls it by D4.
- **D4 A:** a graph is unfurled on opening only if nobody laid it out by hand; a move marks it so, the toolbar's Unfurl
  clears the mark, and leaving Swimlane mode always unfurls. A preset's mark is the session's too (D3).

- **Zip ties (Will, 2026-11-15, asked in the 1001b pair):** making or removing a zip tie is layout: it saves itself, as a
  move or a bend does. Frames stay edits: a frame has a title of its own.

The questions, as they were asked:


- **D1: Is a place part of a published version?** A (my pick): no. A version holds what the graph does; the places are
  the entity's alone, the last ones kept. A roll back keeps today's places for each node still there (T6). B: yes, a
  version keeps its places, and a roll back moves the nodes back.
- **D2: A node moved into another stage.** A (my pick): an edit, as it changes the run order and a Runbook's STAGES: its
  place saves itself, its stage waits for Save (T2, T4). B: it saves itself too, and an app-written prompt is written
  again by itself.
- **D3: A preset's places** (a preset is read only). A (my pick): the reader's own, kept beside the preset in this
  browser; the preset stays as shipped. B: never kept: each open unfurls it again.
- **D4: Unfurl on opening, and a graph you laid out by hand** (rows 1000 and 1001 meet here: places save themselves, so
  an Unfurl on every open would undo the reader's own layout each time). A (my pick): it unfurls only a graph nobody has
  laid out by hand. A move marks the graph "laid out by hand"; the toolbar's Unfurl clears the mark. Leaving Swimlane
  mode always unfurls. B: every open unfurls; a hand layout lasts until the graph is closed.

## 5. Phases (after the picks)

| Phase | Does |
|---|---|
| 1001a | The place set, said once (T3); the hash and draftChanged (T1); D1's roll back (T6) — a9 |
| 1001b | The canvas: a move, an Unfurl and a Swimlane toggle save themselves when they end, onto the kept graph and the draft (T4, T7); D2; D3 — e8 **In part, 2026-11-15 (sherpa-ui-e8): the kept graph takes its places at once (`places-change`), the tab keeps no draft for places alone, Reset keeps where nodes stand, graphKey reads each node's stage (D2). Next: D3 B (a preset moved, kept for the session) and a Custom Node's inner graph** |
| 1001c | Row 1000: Unfurl on opening and on leaving Swimlane mode, by D4, writing only when a place changed (T5) — e8 |
| 1001d | Demos: the specs that read a Save or a draft after a move, and the graphs' views — sherpa-demos-67 |
