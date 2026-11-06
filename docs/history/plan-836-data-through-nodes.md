# Plan 836 — see the data go through the nodes

**Status: PLAN ONLY, 2026-11-06, lane `lane/data-flow-836`.** No code yet. It builds on plan 695 (N4, held), plan 808
(Sources), plan 779 (portals), plan 783 (Field), plan 834 (Output category, not built) and the data layer's rules
engine plan (`DATA-LAYER-PLAN`).

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

Yes, it makes sense. The plan below keeps every point and says where I had to choose.

## 1. Today

| What | Where | What it shows |
|---|---|---|
| Incoming and Outgoing JSON in the inspector | `nodeFlow` (`node-flow.ts`) | The graph's DEFINITION as it flows: a Condition says its test tree; a Field says its field name; a Source says its store. **No row is read.** |
| A node's light | `watchSteps` (`node-graph.ts`), the trace stream (`trace.ts`), plans 671 and 808 | A node lights while a real page load runs: its time and its row count. The rows are the PAGE's, from its own Query. |
| What a graph does with rows | Nothing. A workflow is saved and checked. A Preset Filter compiles to a `Filter` (`conditionAt`) and the page runs it. | |
| N4, `runWorkflow` | HELD (Will, 2026-10-30, TODO 616) | |

So today nothing shows what the rows look like after each node. The JSON in the inspector is the node's meaning, not
the data.

### Is this N4?

**No.** N4 is a RUNNER: it does things (writes, notifications, batch writes, cancel). This plan is a SIMULATOR: it
only READS rows and computes what each node would say. It writes nothing, sends nothing, and changes no store. I pick
a pure simulator in the data layer, and N4 stays held. When N4 comes, it can run the same simulator as its dry run.
The simulator takes the first slice of N4 (its "dry run" and "trace") and none of its effects.

Pick (decision 1): **simulator, not N4** (A). The other choice is to call this N4 step one and un-hold it (B). I do not
pick B: Will held N4, and a simulator needs none of its effects.

## 2. The cache: where the fetched rows live

One cache per graph, per tab, in memory.

| Question | Pick | Why |
|---|---|---|
| Key | The graph's id plus its Source's store id (a graph with two Sources has one entry for each) | A Source owns its rows (plan 808). Two graphs that read one store share ONE entry, so a second graph needs no second fetch |
| Where | A `Map` in the page, in memory. Not the session, not IndexedDB | Rows can be large. Only SAVED filters cross tabs (Will's rule); a draft and its rows are per tab |
| What is held | The rows the fetch plan asked for (section 4), each a copy, keyed as the store keys them, plus: the plan it was fetched by, the time, the row count, and the store's change mark | The plan is how we know if the cache still answers a new question |
| Size | At most 100,000 rows and 50 MB by estimate (`JSON.stringify` of the first 100 rows, scaled). Over the limit: the fetch stops at the limit, says "Cached the first 100,000 of 412,000" and marks the cache PARTIAL | Will's data layer plan: 100k in the browser. A partial cache is honest: a simulation says it ran on a partial set |
| Reuse | `HeldSet` (`held-set.ts`) already holds a remote store's whole set and answers filters on the client. The cache is a `HeldSet` per entry | Do not write a second row holder. Its `load`, `scan` and `distinct` are the engine for the simulator |
| Invalidation | Never by itself. The cache goes stale in four cases, and each says so: (1) the graph changes so it needs MORE than was fetched (a new field, a wider filter): the cache is "not enough" until a Refetch; (2) the store says rows changed (`StoreChanges`): a quiet notice, "Newer data is waiting", as the app banners do; (3) the tab closes: gone; (4) Reset cache: gone | Will: "doesn't have to refetch on every change". A change that needs LESS (a tighter filter, fewer fields) never invalidates |
| Refetch | A button beside Fetch, "Refetch", that drops that graph's entries and fetches again by the plan of NOW. Fetch is the first press; the same button reads Refetch once a cache exists | The reader asks for a new fetch; nothing fetches by itself |
| Never | No fetch on open, on edit, on Save, on Undo, on a timer or on a store's push | Will's rule |

Pick (decision 2): **in memory per tab, 100k rows / 50 MB, a partial flag past the limit** (A). The other choice is to
keep the rows in IndexedDB so they last a reload (B). I do not pick B: the first slice gets its value from speed and
privacy; B can come later behind the same interface.

## 3. The simulator

A pure, DOM-free function in the data layer, `src/core/data/node-simulate.ts`:

```
simulateGraph(graph, rowsBySource, facts) → { at: { [socket or node id]: { incoming, outgoing } }, faults, took }
```

- **In:** the drawn graph (nodes, routes, ties, frames, as `workflowGraph` reads it), the cached rows by Source, and
  the same `facts` the editor already hands `workflowGraph` (fields, `fieldsOf`, `rowsFrom`, the library of Custom
  Nodes, the clock).
- **Out:** for each node, the data that comes IN on each input socket and goes OUT on each output socket. A socket
  carries one of the kinds `socketType` already says: rows, a value, a boolean, an object (a record) or a list. A
  node's warning (`node-input.ts`) is carried through, so a node that reads null says why, as the editor says now.
- **No effect.** It never calls a store's write, never asks a store (the cache is its only input), and never reads a
  clock except the one in `facts`. The same input gives the same output.

### What it reuses (nothing is written twice)

| Need | Reuse |
|---|---|
| What reaches an input and what it reads | `givenAt`, `readInput`, `COERCIONS`, `coerce` (`node-input.ts`) |
| A test (Condition, Time, Tag) on one row | `leafOf` and `conditionAt` (`node-flow.ts`) give a `Filter` tree; `where.ts` / `walk.ts` run a `Filter` on rows. A Condition's outgoing rows are the rows the `Filter` keeps |
| And / Or, True and False forks | The same tree; a fork's two outputs are the rows that pass and the rows that fail |
| A Field | `columnOf` gives the column (or one record's value); a dotted field is read by `readField` |
| Math, Text, Collection (count, sort, group) | The pure functions the rows already use: sort by `SortSpec` and group by the `groups()` the source uses; count is the length |
| Portals | `portalFlow` (`node-portals.ts`), once, so an Out sends what reaches every In of its name |
| Custom Nodes | `innerOf` runs the body as the same graph, its Group Input fed from the use's inputs |
| A loop | A loop is refused by the check already; the simulator also stops at a visited node |

### Order and speed

- Topological order along the kept routes (`keptRoutes`). Each node runs once. A node whose input has not changed since
  the last run is **not run again** (see "Simulate" below), so editing the last node costs the last node only.
- **Rows are not copied between nodes.** A node's outgoing rows are a list of INDEXES into the cached set (a
  `Uint32Array`), as `HeldSet.scan` already does. A Condition makes a smaller index list; a Sort makes a reordered one.
  Only a node that makes NEW records (Math, Text, Field to a value) makes new values, and those are columns, not
  copies of rows. The grid reads a page of indexes and builds only the rows on screen.
- Target, from the data layer plan: 100,000 rows through a 10-node graph in under 250 ms in Chromium, and under 1 s on
  a phone-class CPU at 4×. The unit test measures it and the bench gate (`check:bench`) holds it.
- Where it runs: first on the page's thread. If it passes 100 ms at 100k rows it moves to the worker the page already
  has (plan 652), and nothing in the function changes, because it is pure.

Pick (decision 3): **index lists, not row copies** (A). The other choice is plain row arrays per node (B), which is
simpler and 10 times the memory at 100k rows. Not picked.

## 4. The fetch plan: the whole graph becomes ONE question to the Source

When the reader presses Fetch, the editor reads the WHOLE graph once and makes ONE `LoadOptions` for each Source.
This is a pure function too, `planFetch(graph, facts) → { [source]: LoadOptions & { complete: boolean, why: string[] } }`.

| Part of `LoadOptions` | Where it comes from | Rule |
|---|---|---|
| `filter` | The Conditions on every path from the Source to an Output | A filter is pushed down only if it sits on EVERY path from that Source (an AND along one path; an OR over several paths). A Condition that only one of two paths has cannot be pushed; the other path needs the rows it drops. A Condition that tests a computed value (Math, Time between two fields in a different store) stays out. The rest of the filter is simulated on the cache |
| `fields` | Every field a node on a path reads or sends (Field rows, Condition leaves, Sort and Group fields, the Output's) plus the key | The union. If an Output sends the whole record (the raw JSON), it needs ALL fields: then `fields` is left out. A store that cannot project sends whole rows already (`projects` is its flag) |
| `sort` | A Sort node nearest the Output, only if nothing between it and the Source needs another order | Pushed so a `take` keeps the right rows |
| `take` / `skip` | A Limit on every path (Collection, or a Source's page size) | Pushed only with the sort that gives it meaning. The cache cap applies as well |
| `group` | Not pushed | Groups are made on the client from the cache (plan: a group is a data concept) |
| `search` | A Search node, if it joins the filter on every path | As filter |
| `now` | `facts.now`, held so a relative date means the same on every run | `T-a-rule-names-its-clock-and-its-language` |
| `signal` / `trace` | The Fetch button's own abort and the trace stream | Cancel is the button. The fetch lights its Source node as a page load does |

- **What is returned with the plan:** `complete` says whether the cache can answer the whole graph; `why` lists in
  words each part that was NOT pushed down and why ("Health is computed from two stores: filtered on your side"). The
  Fetch tip shows it: "Will fetch Devices where type is Laptop, 6 fields". The reader sees the cost BEFORE the press.
- **A later edit and the cache.** Each edit asks the plan again (cheap, pure). If the new plan is a SUBSET of the plan
  the cache was fetched by (same Source, a filter at least as tight, fields within), the cache still answers, and
  Simulate runs on it. If not, the Simulate button says "Needs a new fetch: this change needs the field Owner" and the
  Refetch button lights. Nothing fetches until the click.
- **Remote and local stores.** A store that answers `load` with a filter and a projection (an `ArrayStore`, an
  `IdbStore`, a remote store with `projects`) gets the pushed-down question. A remote store that cannot filter on its
  side is asked for a whole set once, as `HeldReads` does today, and the plan says so. In both cases the reader's press
  is the only trigger, and `planRead` is not used (its job is the page's reads, which are automatic).
- **Page size.** The fetch is paged inside the store as it is today (`take` per request) and joined; the 100,000 cap
  stops it. The progress shows on the Source node's light as rows come in.
- **Two Sources.** One plan and one fetch each, run together; each caches alone.

Pick (decision 4): **push down only what is true on every path** (A). The other choice is to push a filter down when
ANY path has it and fetch the other paths again by their own plan (B): more exact, and several fetches for one press.
Not picked: Will wants one fetch.

## 5. The path rule: when Fetch and Simulate are allowed

A complete path is a chain of kept routes from a Source's output to an Output node's input, each hop through a node
that has the socket for it.

| Case | Rule |
|---|---|
| Portals | An In and an Out of one name count as joined (plan 779): a path may go Source › … › In, then Out › … › Output. `portalFlow` already resolves the hop; the path check uses it |
| Custom Nodes | A use counts as a node with a path through it if its definition has a path from its Group Input to its Group Output. A use whose body is cut is not a path |
| Frames | Frames change no data. A path goes through a framed node as through any |
| A route with a fault | A route that the check refuses is not kept, so it is not a path. A route that only WARNS (a mismatch that reads null) is kept: the path exists, the node says null |
| Many Sources | At least one Source with at least one path to at least one Output. A Source with no path is not fetched (the plan skips it and says so) |
| No Source, or no Output, or no path | Fetch and Simulate are INACTIVE. Their tip says which: "No path from a Source to an Output: join Source › … › Output" (806: an inactive tool says why; 825 ties the reason to the button for a screen reader) |
| A Preset Filter graph | Its Output is the Group Output. The same rule, and it has a Source |
| A Custom Node being edited | Its Group Input is its Source. The rows for it are the open graph's cache for that use, or a Fetch of the outer graph. First slice: the buttons are inactive inside a definition, with the tip "Open the graph that uses it" |

### The raw JSON Output, "above all other output types"

Will: a graph should always have a raw JSON output node. I pick:

- The **Value Output** of plan 834 becomes the first item of the Output category and is called **JSON output**: it takes
  anything and shows it as JSON, as the inspector's panes show a node's JSON now. It has **no rows** to set. It is the
  default Output (`output` today is exactly this node, so no saved graph changes).
- A graph is **never without one for the simulator's sake**: the simulator reads an Output, so a graph with only a
  Presentation Output (grid, chart) works as well: a path to ANY Output is a path. But "always has a raw JSON output"
  needs one more thing: **a new graph is made with a JSON output already on it** (New graph… places one), and the node
  panel lists it first under Output. The reader may delete it. The graph then needs another Output for the buttons to
  be active. We do not force one in, because "off is not gone" and a forced node would be written into a saved graph
  that the reader did not make.
- **A second raw-JSON view without a node.** Every node's inspector shows its own Incoming and Outgoing, so the reader
  can see the JSON at any socket without a JSON output node on the graph. The Output node is the graph's answer; the
  panes are the reader's look.

Pick (decision 5): **a new graph starts with a JSON output; a path to ANY Output enables the buttons; the reader may
delete the JSON output** (A). The other choice is to make the JSON output undeletable and put one in every graph on
load (B). Not picked: it would write nodes into graphs that did not have them.

## 6. The UI

| Where | What |
|---|---|
| **Toolbar** | Two buttons after Unfurl: **Fetch** (icon: a cloud with an arrow; reads Refetch once a cache exists) and **Simulate** (icon: a play triangle). `data-can-fetch`, `data-can-simulate` from the editor, as the other tools. Inactive with a tip that says why (section 5). A third state on the toolbar: `data-simulating` while it runs, `data-cached` with the row count in the Fetch tip |
| **A node's inspector** | A **Data** tab beside the node's rows (the inspector already has Incoming and Outgoing JSON tabs from 745: they get a switch **Definition / Data**). Data shows, per socket, the rows as a **grid** (the library's `sherpa-data-grid`, bound to the index list, a page at a time, 50 rows) with a **JSON** toggle for the raw view (`sherpa-code-block`). A value or boolean shows as one line. A record shows as JSON |
| **On the canvas** | Each node's light (671/808) also shows the simulated row counts: "412 → 87" (in, out), and the time it took. A node with a warning keeps its warning look. The numbers show only after a Simulate and say "stale" in the tip after an edit that has not been simulated |
| **The first Output** | The graph's header shows the raw JSON Output's rows count and a button, "Open data", which opens its Data tab |
| **Size on screen** | 100k rows are never drawn: the grid shows a page of indexes, as the page's own grid does |
| **Simulate** | Press Simulate: the simulator runs on the cache. After an edit with a cache, Simulate runs only from the first changed node on (section 3). **No auto-run** on an edit: Will asked for a press. A switch, "Simulate as I edit", off by default, may come later (decision 6) |
| **Fetch** | Press Fetch: the plan is made, its words show in the tip and the Source node's light shows progress; the cache fills; then Simulate runs once as part of the press (the reader asked to see data). Cancel is the same button, as a fetch has a signal |
| **Read only** | A preset graph can be fetched and simulated (it reads, it writes nothing). The buttons are active there |
| **Query editor** | A page's filter graph has the page's own rows already. Its Data tab reads the PAGE'S source, as 808 lights do; no Fetch button there. First slice: not built (decision 7) |

### Keyboard parity (PRINCIPLES 21)

- Fetch and Simulate are toolbar buttons: Tab to them, Enter or Space. The toolbar already takes arrow keys.
- `Ctrl/Cmd+Enter` on the canvas = Simulate (one `primaryKey` helper). `Shift+Ctrl/Cmd+Enter` = Fetch.
- The Data tab is a tab (arrow keys); its grid is the library grid, which takes keys. The JSON toggle is a switch.
- A host with no pointer calls `fetchGraph(canvas)` and `simulateGraph(canvas)`, the way `unfurlGraph(canvas)` is called.
- The tips say the keys, as the other tools do.

## 7. Decisions

1. Simulator or N4? **A: a pure simulator, N4 stays held.** B: un-hold N4 and call this step one.
2. Cache. **A: memory per tab, 100,000 rows / 50 MB, partial flag.** B: IndexedDB, lasts a reload.
3. Rows between nodes. **A: index lists into the cache.** B: row arrays per node.
4. Fetch plan. **A: push down only what holds on every path.** B: push down per path with several fetches.
5. Raw JSON output. **A: new graphs start with one; a path to any Output enables the buttons; it may be deleted.**
   B: undeletable and added to every graph on load.
6. Simulate after an edit. **A: only on the press.** B: a "Simulate as I edit" switch, on by default.
7. Query editor. **A: not in this plan; its graph already shows the page's rows through the page.** B: add a Data tab
   there as well, reading the page's source.
8. A fetch's limit. **A: the cap stops it and the cache says PARTIAL.** B: ask the reader before a fetch that the plan
   thinks is over the cap (needs a count; a remote store may not give one).

Questions that cannot be decided here: the exact words of the tips (Will to read them); and whether a Presentation
Output (834) should reuse the Data tab's grid (I say yes, one grid).

## 8. Build order

Each phase is a commit pair (code and tests) on the lane. Sizes are lines of code, not counting tests.

| Phase | What | Size | The tests it must pass |
|---|---|---|---|
| P1 | **The path rule.** `hasPath(graph, kinds, facts)` and its words, in the data layer. Fetch and Simulate buttons on the toolbar, inactive with their tip; `data-can-fetch`, `data-can-simulate` | ~150 | Node: a graph with a path, none, cut by a fault, through a portal, through a Custom Node, through a frame; two Sources, one unjoined. Spec in 3 engines: the buttons are off with the tip, on after a route is drawn, off after it is cut; keys reach them |
| P2 | **The simulator, rows through Source, Field, Condition, Output.** `node-simulate.ts` with index lists; the five kinds that make the Demos graphs | ~450 | Node: each of the five against `conditionAt`'s `Filter` run by `where.ts` on the same rows (the simulator must agree with the filter engine on 20 random rows sets); the same in, the same out; a null input warns as the editor warns. Bench: 100k rows, 5 nodes, under 100 ms |
| P3 | **The cache.** A per-graph, per-tab `HeldSet` map; Refetch; invalidation; the 100k cap and the partial flag. No plan yet: Fetch reads the whole set | ~200 | Node: a second graph over one store shares the entry; a tighter change keeps it; a wider one marks it "not enough"; the cap; Reset cache. Spec: Fetch, then Simulate with the network off still answers |
| P4 | **The fetch plan.** `planFetch`: filter, fields, sort, take pushed down by the rules above; `why` in words. The Fetch tip shows it | ~350 | Node: a filter on every path is pushed, on one path only is not; fields are the union; the raw JSON output leaves `fields` out; a computed field stays out; a plan that is a subset of the cache's still answers. Against `ArrayStore` and a fake remote: the store receives ONE `load` with exactly those options. Bench: a 1M-row store gets the filter, not the rows |
| P5 | **The data panes.** The inspector's Definition / Data switch, the grid on index lists and the JSON toggle; the row counts and time on the node lights | ~400 | Spec in 3 engines, real pointer and keys: Fetch, then every node's pane shows rows; the counts add up along the path (a Condition's out is at most its in); Undo of an edit keeps the cache; the stale tip. Axe: the new tab has no new fault |
| P6 | **The rest of the kinds.** Math, Text, Time, Tag, Collection (sort, group, count), portals, Custom Nodes in the simulator; the JSON output as the first of Output (with 834's first slice, or alone if 834 is not built) | ~500 | Node: each kind against its own existing pure function; the Demos graphs (all four) simulate with no fault; a portal graph; a Custom Node use. Bench: 100k rows, a 10-node graph, under 250 ms |
| P7 | **Demos.** A shipped graph that is worth fetching (Devices that need attention, already shipped); a Learn paragraph if Will asks | ~50 | Demos spec in 3 engines: Fetch on Devices, Simulate, the counts match `debugState().total` of the Devices page for the same condition (the same filter, run two ways) |

Every phase also runs the gates (type-check, lint, spec:check, check:traps, check:map, check:docs, check:bench,
check:weight, check:size), the node suite, the node specs in three engines and a planted fault per new test; a trap
(`T-a-simulation-reads-the-cache-and-writes-nothing`, with the five rules: pure, no fetch without a press, index
lists, push down what holds on every path, a partial cache says so) is written in P2 and grown in each phase.

**Order of risk:** P2 (agreement with the filter engine) and P4 (the plan) carry the risk. P1 can go to Will first,
because it changes only two inactive buttons. I would show Will P1 and P2 before P3 on.

## 9. Not in this plan

- Writing, sending, notifying, batch writes, cancel of a run: N4.
- Presentation and Notification Outputs: 834 (this plan gives them the Data grid).
- Fetching for a Custom Node's definition alone.
- Fetching by a timer, by a push or on open: Will said never.
