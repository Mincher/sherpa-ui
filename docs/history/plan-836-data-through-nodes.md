# Plan 836 — see the data go through the nodes

**Status: P1 and P2 BUILT 2026-11-06 (lane `lane/data-flow-836`); P3 on wait for Will's word.** Will answered the eight
decisions the same day; this plan is written to his answers. It builds on plan 695 (N4, held), plan 808 (Sources), plan
779 (portals), plan 783 (Field), plan 834 (Output category, not built) and the data layer's rules engine plan.

## What Will asked

Will, 2026-11-06:

> "We should also be able to see the incoming, and outgoing, JSON data as it passes through each node. This is the
> data from any sources passing through each stage of the graph. It's not the same as the node JSON definition. We
> won't fetch source data automatically. The user will trigger the first fetch which will cache the data. The user
> can then simulate any changes against this data but doesn't have to refetch on every change. When the user clicks
> 'fetch' for a graph then we should try to take all of the graph into consideration in order to set any query
> parameters that limit the data being retrieved. This will avoid large amounts of data being fetched
> unnecessarily. Perhaps we only allow a 'fetch' or subsequent 'simulation' runs if the graph has at least 1 path
> connected all the way from input to at least 1 output (A graph should always have a raw JSON output node, I think,
> over and above all other output types). Make sense?"

## Will's answers (2026-11-06) — these rule the plan

| # | Answer |
|---|---|
| 1 | A SIMULATOR. N4 stays held |
| 2 | The cache is in IndexedDB, NOT memory. Some Sources are already pulled into IndexedDB for Views: reuse that store and its code. A Source not there is just "not fetched yet" |
| 3 | A ROW LIST per node, not index lists. Keep it simple |
| 4 | DROP the push-down idea. Do not work the graph backwards to filter the fetch. Use the existing row and size bounds only. One fetch per Source, as the Source already limits it |
| 5 | The JSON output is just the data as JSON after it passes through each node. It is NOT a node the user works with. They only view it in the node's details (the Data tab). No deletable JSON output node. Output stays a category (834). A graph needs at least ONE path from a Source to an Output for Fetch and Simulate to be active |
| 6 | Simulate runs only on an explicit press, or an agent's trigger. Never "as I edit" |
| 7 | NOT decided: the page-filter graph's Data tab. Left out for now; an open question below |
| 8 | A fetch stops at the cap, 100,000 rows or 50 MB, and the cache is marked PARTIAL. It does not ask first |

## 1. Today

| What | Where | What it shows |
|---|---|---|
| Incoming and Outgoing JSON in the inspector | `nodeFlow` (`node-flow.ts`) | The graph's DEFINITION as it flows: a Condition says its test tree; a Field its field name; a Source its store. **No row is read.** |
| A node's light | `watchSteps` (`node-graph.ts`), the trace stream, plans 671 and 808 | A node lights while a real page load runs: its time and its row count. The rows are the PAGE's, from its own Query |
| What a graph does with rows | Nothing. A workflow is saved and checked. A Preset Filter compiles to a `Filter` (`conditionAt`) and the page runs it | |
| N4, `runWorkflow` | HELD (Will, 2026-10-30, TODO 616) | |

So nothing shows what the rows look like after each node. The JSON in the inspector is the node's meaning, not the data.

### Simulator, not N4 (answer 1)

N4 is a RUNNER: it does things (writes, notifications, batch writes, cancel). This is a SIMULATOR: it only READS rows and
works out what each node would say. It writes nothing, sends nothing, changes no store. When N4 comes it can run the same
simulator as its dry run.

## 2. The cache (answers 2, 8)

Rows are kept in IndexedDB, in the one Sherpa database, and read back from there.

| Question | Pick | Why |
|---|---|---|
| What is reused | The `sets` store of the database (`SetRecord`: name, version, key, savedAt, rows, dropped) and `cache-keep.ts` (`keepCache`), which already keep a remote store's held set between sessions. A LOCAL store (`IdbStore`) already keeps its rows in the database: its rows ARE its cache. No second store, no second writer | Will: "reuse that store and its code" |
| Key | The Source's STORE. Two graphs that read one store share the one entry; so does a View that already kept it | A Source owns its rows (plan 808) |
| "Not fetched yet" | A store with no `SetRecord` (and no local rows) has no cache: the Source node says "Not fetched yet", and the data tab says the same. Not a fault, not a warning | Will |
| Fetch | One `store.load` per Source, paged inside the store, joined, written to the `sets` record. The press is the only trigger | Answers 2, 4 |
| Bounds (answers 4, 8) | The Source's own: the store's page size and `maxRows`, and the cap of 100,000 rows or 50 MB by estimate (`JSON.stringify` of the first 100 rows, scaled). At the cap the fetch STOPS and the record says `dropped` and the cache is PARTIAL: the data tab and the node say "Cached the first 100,000 of 412,000", and a simulation says it ran on a partial set. No question first | Will |
| Nothing pushed down | The graph is not read backwards. No filter, no field list, no sort from the graph goes to the store. The graph runs on the cached rows | Answer 4 |
| Per tab | The record is the device's (it is how Views keep a store); a graph's simulation, its results and the "stale" marks are per tab, in memory | Only SAVED things cross tabs; a draft does not |
| Invalidation | Never by itself. Stale: (1) the store says its rows moved (`StoreChanges`): a quiet notice, "Newer data is waiting", as the app banners do; (2) a sign-out clears it (`clearKept`); (3) the Reset cache button | Will: no refetch on every change. A graph change never needs a refetch, as the graph is not read backwards |
| Refetch | The Fetch button reads Refetch once a cache exists. It drops that store's record and fetches again | |
| Never | No fetch on open, on edit, on Save, on Undo, on a timer, on a store's push | Will |

## 3. The simulator (answers 3, 6)

A pure, DOM-free function in the data layer, `src/core/data/node-simulate.ts`:

```
simulateGraph(graph, rowsByStore, facts) → { nodes: { [id]: { incoming, outgoing } }, faults, ms }
```

- **In:** the drawn graph (`DrawnGraph`, as `workflowGraph` draws it), the cached rows by store id, and `facts` (a clock,
  `inner` for a Custom Node's inside).
- **Out:** for each node, the data that comes IN on each socket and goes OUT on each. A socket is a **slot**: `rows` (a
  row LIST, answer 3), `field` (a column name) or `value`. A slot also says where it comes from.
- **No effect.** It never asks a store, never writes, reads no clock but `facts.now`. The same input gives the same output.
- **Row lists.** Each node's outgoing rows are an array of the SAME row objects as the cache holds (a Condition keeps or
  drops rows, it does not copy them). So a node costs one pass and one array of pointers.
- **Run order.** Along the kept routes, as the data flows (`portalFlow`). Each node runs once.
- **Only on a press** (answer 6): the editor calls `simulateGraph` from the Simulate button, a key or an agent's call
  (`simulateGraph(canvas)`, the door the MCP tool later wraps). It never runs on an edit.

### What it reuses (nothing is written twice)

| Need | Reuse |
|---|---|
| A Condition, Time or Tag test | `leafOf` (`node-flow.ts`) says the test as a leaf; `filterTest` (`store.ts`) runs it on rows: the same engine a page's filter runs. A Condition's `rows` are the rows into its Field that pass; its False is those that fail |
| And and Or | The rows of the parts, joined: And keeps what every part kept, Or what any part kept |
| A Field | Passes its rows on and sends its field name |
| Portals | `portalFlow`, once: an Out's route comes from its In's source, so the rows flow with no portal code of its own |
| Custom Nodes | P6: `innerOf` runs the body as the same graph |
| Math, Text, Collection (sort, group, count) | P6: the pure functions rows already use |
| What a socket can read | `readInput`, `COERCIONS` (P6 for value sockets) |

### Speed

- 100,000 rows through a graph of Source, Field, five Conditions and an Output in under 250 ms in Chromium (the data layer
  plan). The unit test measures it; `check:bench` holds it.
- A row list is a pointer array, so a Condition is one pass with the compiled `filterTest`. If a graph passes 100 ms at
  100k rows it moves into the page's worker (plan 652); the function is pure, so nothing in it changes.

## 4. The fetch (answer 4)

There is NO plan that works the graph backwards. A Fetch is: for each Source that has a path to an Output (section 5), one
`store.load` as the Source already limits it, paged, stopped at the cap, written to the cache. Press again for a new fetch.
A Source with no path is not fetched. Cancel is the same button (the fetch has an `AbortSignal`).

Why: a graph's filters are the reader's questions; the cache is the data they ask them of. Pushing a filter down would make
a cache that answers only one question, and a new Fetch for each edit. Will chose the plain thing.

What this costs: a very large store is fetched up to the cap, not narrowed. The partial mark says so. If that proves too
heavy, a later plan can push down, and nothing here stops it.

## 5. The path rule (answer 5)

A complete path is a chain of kept routes from a Source's output to an Output node's input, each hop through a node that has
the socket for it.

| Case | Rule |
|---|---|
| Portals | An In and an Out of one name are joined (plan 779): a path may go Source › In, then Out › Output. `portalFlow` already resolves the hop; the path check reads its routes |
| Custom Nodes | A use is a hop if its definition has a path from its Group Input (`#in`) to its Group Output (`#out`). A use whose body is cut is not |
| Frames | Frames change no data. A path goes through a framed node as through any |
| A route the editor refuses | It is not kept, so it is not a path. A route that only WARNS (it reads null) is kept: the path exists, the node says null |
| Many Sources | At least one Source with at least one path to at least one Output. A Source with none is skipped, and the tip says so |
| No path | Fetch and Simulate are INACTIVE (aria-disabled, as 806) and the tip says which part is missing: "Add a Source", "Add an Output", or "No path from a Source to an Output: join Source › … › Output" |
| A Preset Filter graph | Its Output is the Group Output. The same rule |
| Inside a Custom Node | Inactive: "Open the graph that uses it" (its Group Input has no rows of its own) |

### The JSON (answer 5)

There is no JSON output node and none to delete. "The data as JSON after each node" is a **view**: the node's **Data** tab
shows each socket's rows as a grid, with a JSON toggle for the raw text. Output stays the category of 834, with whatever
types it gets; this plan asks nothing of it but that an Output node is a path's end. The Data tab of an Output node is the
graph's answer, as JSON.

## 6. The UI (answer 6 and 7)

| Where | What |
|---|---|
| **Toolbar** | Two buttons after Unfurl: **Fetch** (icon `cloud`; reads Refetch once a cache exists) and **Simulate** (icon `play`). `data-can-fetch` and `data-can-simulate` from the editor; `data-path-why` carries the reason, which the tip says when the buttons are inactive. P1 builds the buttons, the rule and the tips; a press does nothing yet |
| **A node's inspector** | A **Data** tab beside the node's rows: per socket, the rows as a grid (`sherpa-data-grid` on the row list, a page of 50 at a time) with a JSON toggle (`sherpa-code-block`). A field or value shows as one line. (P5) |
| **On the canvas** | The node's light also says the simulated rows in and out, "412 → 87", and the time (P5). After an edit that has not been simulated the tip says "stale" |
| **Simulate** | Press Simulate: the simulator runs on the cache. A Source with no cache says "Not fetched yet" and its rows stay empty. No auto-run |
| **Fetch** | Press Fetch: each Source with a path is fetched to the cap and cached; then Simulate runs once, because the reader asked to see data |
| **Read only** | A preset graph can be fetched and simulated (it only reads) |
| **The page's filter graph** | Not decided (answer 7). It has no Fetch button and no Data tab in this plan |

### Keyboard parity (PRINCIPLES 21)

- Fetch and Simulate are toolbar buttons: Tab, then Enter or Space; the toolbar takes arrow keys.
- `Ctrl/Cmd+Enter` on the canvas is Simulate (the one `primaryKey` helper); `Shift+Ctrl/Cmd+Enter` is Fetch (P3 on).
- The Data tab is a tab; its grid takes keys; the JSON toggle is a switch.
- A host with no pointer, or an agent, calls `simulateGraph(canvas)` and `fetchGraph(canvas)`, as `unfurlGraph(canvas)` is called.

## 7. Open question

- **The page's filter graph (answer 7).** A page's own graph draws the page's Query over the page's own Source and rows.
  Should its nodes have a Data tab that reads those rows (no Fetch needed), or none? Left out for now.
- **The words of the tips** are Will's to read.

## 8. Build order

Each phase is code and tests together. Sizes are lines of code, not tests.

| Phase | What | Size | Tests it must pass |
|---|---|---|---|
| **P1 ✅** | **The path rule.** `pathRead` in `node-paths.ts` (data layer); the Fetch and Simulate buttons on the toolbar, inactive with the reason in the tip; `data-can-fetch`, `data-can-simulate`, `data-path-why`; the editor sets them on every draw | ~170 | Node: a path; none; a cut route; through a portal; through a Custom Node (cut and whole); through a frame; two Sources, one unjoined; the words. Spec in 3 engines: off with the tip, on after the route is drawn, off after it is cut; read only still on |
| **P2 ✅** | **The simulator** for Source, Field, Condition (test, And, Or, False) and Output: `node-simulate.ts`, row lists, no effects | ~230 | Node: each kind against `filterTest` on the same rows (20 random sets must agree with `filterRows` of the compiled `conditionAt` tree); the same in, the same out; "not fetched yet"; portals; 100k rows timed |
| P3 | **Fetch and the cache** in IndexedDB: reuse `sets` and `keepCache`; one capped `load` per Source; the partial mark; Refetch; "Newer data is waiting". The press runs Simulate once | ~220 | Node: a store with no record is "not fetched yet"; a second graph over one store shares it; the cap and the partial mark (`dropped`); Reset. Spec: Fetch, then Simulate with the store offline still answers; a reload keeps it |
| P4 | **Keys and the agent door:** `fetchGraph(canvas)`, `simulateGraph(canvas)`, `Ctrl/Cmd+Enter`, the tips with the keys | ~80 | Spec by keys alone; the parity sweep |
| P5 | **The data panes:** the Definition / Data switch, the grid on the row list, the JSON toggle, the counts and times on the node lights, "stale" | ~400 | Spec in 3 engines, pointer and keys: after Fetch every node's pane shows rows; a Condition's out is at most its in; an edit marks "stale"; Axe has no new fault |
| P6 | **The rest of the kinds:** Math, Text, Time, Tag, Collection (sort, group, count), value sockets, Custom Nodes | ~450 | Node: each kind against its own pure function; all Demos graphs simulate with no fault. Bench: 100k rows, a 10-node graph, under 250 ms |
| P7 | **Demos:** Devices that need attention, fetched and simulated | ~50 | Demos spec in 3 engines: the counts match `debugState().total` of the Devices page for the same condition |

Every phase also runs the gates, the node suite, the node specs in three engines, and a planted fault per new test. A trap,
`T-a-simulation-reads-the-cache-and-writes-nothing`, is written in P2 and grown in each phase.

## 9. Not in this plan

- Writing, sending, notifying, batch writes, cancel of a run: N4.
- Presentation and Notification Outputs: 834.
- A fetch narrowed by the graph: Will dropped it. It can come back as its own plan.
- Fetching for a Custom Node's definition alone.
- Fetching by a timer, a push or on open: never.
