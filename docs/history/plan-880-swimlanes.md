# Plan 880 — swimlanes in the node editor

Source: the Harness session (acp-module), `.working-notes/14-swimlanes.md`, Will 2026-11-09. Planned only; nothing built.

## What is asked
Lanes (horizontal bands, one per actor or data layer), optional stages (columns), junction bands, org-saved lane presets, and lane rules that compile into ghost nodes. A node sits in exactly one lane. Lanes organise; only a rule changes what runs.

## Clashes with what exists, and the answer to each

1. **A node's `y` relative to its lane.** Everything reads absolute plane x and y: `node-arrange`, tie places, a frame's box, route curves, the minimap, `onPlane`. A relative y puts a lane offset in all of them. **Answer: keep absolute x and y in the JSON.** A lane's band is computed from the lanes' order and heights. Reordering or resizing a lane is one host edit that shifts its nodes (one undo step).
2. **Who owns membership.** A frame lists its nodes and a tie lists its routes: graph-level arrays, nodes untouched (TRAP `T-a-frame-is-drawn-round-its-nodes`). The proposal puts `node.lane` on the node. **Answer: `node.lane`, one id, is right for "exactly one"** (a lane list could hold a node twice, and `check` would then have to refuse it). Frames stay as they are. A lane and a frame may overlap; draw order lanes, frames, routes, nodes.
3. **Ghost nodes stored in the workflow.** Sherpa's saved definition is the author's truth (`finalGraph`, "Draft keeps, Save writes final"). Storing ghosts means regenerating and re-saving them whenever a lane, a rule or a match changes, with ids that must stay stable. **Answer: do not store them.** A pure `expandLaneRules(graph)` in the data layer derives them from `lanes[].rule` at draw time and at run time, with ids `rule:<lane>:<node>`. They splice the route into the matching node. A run, `nodeFlow` and Simulate all read the expanded graph, so a ghost runs and shows in run views. The editor draws `origin: { rule }` on the drawn node only.
4. **A lane preset as an entity.** An entity is an envelope with a graph, and D1 says any entity can be placed as a node (`asNode`). A preset has no graph and must not be placeable. **Answer: a small keeper of its own (`lane-presets`), beside the Custom Node keeper and using the same read-only presets / reader's own shape.** If Will wants it listed among entities, the type needs a `placeable: false` flag first. The graph keeps its own copy of the lanes, as decided.
5. **Tidy layout.** `arrangeNodes` lays out by flow columns and fewest crossings. With lanes it needs a band constraint: rows are chosen inside the node's lane, columns inside its stage. A new option, not a second algorithm.
6. **Collapsed lanes.** Routes attach at the lane edge, but `node-sockets.ts` only knows real sockets. A stub needs a synthetic socket position per route end. Route engine change, small.
7. **Stage status in a run.** There is no per-stage state. A node has `data-step`. A stage's status is derived from the nodes in it (running, done, failed). Not stored. Cost is a sum a host supplies.
8. **Page Query graph.** Lanes are for workflows and entity graphs. The Query graph is drawn from a page definition, so it takes none. The editor option is `lanes` on a workflow editor only.
9. **Reports, not derives (PRINCIPLES 21).** `data-count` is the host's to write. `data-rule` is the host's text. The lane reports `lane-move`, `lane-collapse` and `lane-menu` as requests.

## Names
- `sherpa-node-lane` is good (`sherpa-node-frame` is the sibling). `sherpa-node-stage` for the strip, as the notes suggest.
- Events `lane-move`, `lane-collapse`, `lane-select`, `lane-menu` and `node-lane-change` fit noun-verb (PRINCIPLES 18). Use `lane-menu-select`: a menu event ends `-select`.
- `data-type="lane|junction"` is fine (the Type axis). `data-origin="rule"` on `sherpa-node` is fine as a read-only look.
- Say "Lane" in the Lexicon: it is not a Section, Area, Context or View (PRINCIPLES 19). Add a row.
- Avoid "stage" meaning a run step: the run's word stays "step".

## Will's answers (2026-11-09, via Harness)
- Lane rules are a CONCEPT only: Will has none. Rules and ghost nodes are an OPTIONAL, LATER part: keep the model open (`lane.rule?`, `expandLaneRules`) but do not schedule or build them in the first lanes work.
- A rule on a junction band is a "maybe": do not block it in the model, do not design for it yet.
- Core now: lanes, junction bands, stages, presets, collapse and the drop target.

## Steps (each its own commit; first three are data layer, DOM-free)
1. `node-lanes.ts`: `NodeLane`, `laneFaults`, `lanesAmong` (a lane left with no nodes stays; removing a lane moves nodes to none), `nodeOfLane`. Workflow v2 gains optional `lanes`, `stages` and `node.lane`; schema and `check` updated.
2. LATER, only when Will has a rule: `expandLaneRules`, the ghost expansion (shape, ids, a run sees the ghost). The first work only leaves `lane.rule` optional and unread.
3. Lane presets keeper and the `lane-preset` JSON; Off, By actor and By data layer shipped read only.
4. `sherpa-node-lane` and `sherpa-node-stage` (five files each, spec, example), canvas draw order, drop highlight, `node-lane-change`.
5. Editor: drop to change lane, lane menu, rename, reorder (Alt+Up/Down), collapse, tidy-in-lane, minimap bands. (The ghost look waits with step 2.)
6. Run mode: stage strip status.

## Open for Will
- Where a preset's save and share goes: org-shared is a server keeper and waits on TODO 170.
