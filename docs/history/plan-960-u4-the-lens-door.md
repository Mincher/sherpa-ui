# Plan 960 U4: the lens door

Will, 2026-11-13: "Go with your picks for now" (plan 960 D1 to D6 A; U2 and U4 side by side). U4 is sherpa-ui-e8's;
sherpa-ui-a9 leads U2 (`type.v1`). Plan 960 section 2.4 says what the door is; this says the build, in order.

**The door.** In the data layer, DOM free: `registerLens(type, { toGraph, fromGraph })`. `toGraph(definition, facts)`
draws a definition as a graph (a v3 workflow the one editor edits). `fromGraph(before, graph, facts)` writes the graph
back: the definition it says now, or the faults that refuse it, in words. The JSON is the one truth (D1); a graph is
always made from it. Where the definition is not a graph (a Query, a View), the graph's layout is a side record.

## Steps

| Step | Builds | Proves | After |
|---|---|---|---|
| **U4.1** The door | `lens.ts`: `GraphLens`, `registerLens`, `lensOf`. Every entity type's lens is the identity by default: `toGraph` is `graphWorkflow`, `fromGraph` is `graphOfWorkflow` checked by `entityFaults`. A registered lens wins | unit: an entity goes to a graph and back the same; a fault refuses in words; a registered lens wins and is taken back | — |
| **U4.2** The Organise node | ONE **Organise** node in every graph (Will, below): rows for sorting (Sort, Direction), grouping (Group), Search, and the axes (Primary, Secondary, Segments). The workflow's Sort and Group kinds and the Query graph's Arrange go into it, and the Query's Presentation node keeps only how the rows are shown (a chart's kind, its segments' order, Secondary off). In a Query graph it is one per scope, edited by the requests a chip sends (arrangement and presentation alike); in a workflow it arranges the rows Simulate sends on and names the axes a chart reads | unit and e2e: a page's sort, group, search and axes drawn on its Organise node, edited there, read back the same; a workflow sorts, groups and searches its rows by it; no Sort, Group or Arrange kind left | U4.1 |
| **U4.3** The Query lens (BUILT 2026-11-13, in part: a scope's `sort`, `group` and `search` are a page's, opened and saved; the lens registration moves to U4.5, where a live Query is open, as only sort, group, search and presentation replay purely today) | The data layer registers the `query` lens: `toGraph` is `queryDefinition`; `fromGraph` runs the reconciled requests on a copy of the Query, then `pageWithQuery`, now WITH sort, group and search; a View's `query` is written back the same way. The editor's `GraphDocument` for a Query becomes a thin use of it | e2e: a page's filters edited in the graph and saved come back the same from the JSON; a View saved from the graph keeps its sort, group and search | U4.2 |
| **U4.4** The Filter type | `preset-filter` → `filter` (LEXICON §13), one change with Demos' presets. D6: a Filter keeps a Where where a Where can say it, else its graph. A Filter is a Custom Node used in a View definition, as in its filter toolbar (Will). An entity may be temporary: the tab's or the session's, on the shelf only when saved | unit: the four shapes (a View's `query`, a savedFilter, a preset, a Preset Filter) are one type; e2e: a Filter placed in a View's toolbar | **U2** (it renames inside entity-types.ts) |
| U4.4a The rename | LEXICON §13's moves, one change with Demos: the type `preset-filter` → `filter`, `PRESET_FILTER` → `FILTER`, `preset-filter.ts` → `filter.ts`, `entity-preset-filter.v1.json` → `entity-filter.v1.json`, a use's kind `preset-filter:<id>` → `filter:<id>`, Demos' presets. A reader's old saved one is not converted (clean system): the shelf reports it | `git grep preset-filter` finds only history; every spec green, Demos' too | U4.5 |
| U4.4b A Filter keeps a Where (D6) | `entity-filter.v1`: a `where` or a `graph`. Its lens draws a Where as its graph, and writes back a Where when the graph says one (`presetOfEntity`'s reader), else keeps the graph. A page's `presets` and a reader's saved filters are Filters in the Where form, read through one door | unit: each of the four shapes is one Filter, drawn and written back the same; a graph a Where cannot say stays a graph | U4.4a |
| U4.4c A temporary Filter | The shelf door takes a tier: a Filter made on a page is the tab's or the session's, and goes on the shelf only when saved (plan 960 2.3) | unit: a temporary Filter is used, then dropped, never on the shelf; e2e: Save puts it there | U4.4b |
| U4.4d A Filter in a View's toolbar | A View definition names the Filters its filter toolbar offers; the toolbar draws each as a chip a reader turns on | e2e: a Filter placed in a View's toolbar filters its rows | U4.4b |
| **U4.5** The MCP through the door (BUILT 2026-11-13: `definition_graph` and `edit_definition_graph`, any type by its lens; the Query's lens registered in `query-lens.ts`, which the editor's Query document now uses for its write-back too) | One pair of tools by type: `definition_graph(type, definition)` and `edit_definition_graph(type, definition, edits)`. `workflow_graph`, `edit_workflow`, `query_graph` and `edit_query_graph` go, in the same change (no aliases) | the MCP tiers' tests on each type | U4.3 |
| **U4.6** A View's filters written back (Will, 2026-11-13: A, beside U3) | The part U4.3 moved out. A View's `query` is written from the Query by ONE writer, `statedQuery`, in the data layer: the View chip's Save (`viewQueryOf`) and the graph's Save alike. The `view` lens is the Query lens with another Save: a View's `query` from the Query as the graph left it, its sort, group and search with it | — | U4.5 |
| U4.6a The data layer and the MCP | `statedQuery` (query.ts), `viewWithQuery` (page-definition.ts), the `view` lens (query-lens.ts, one maker for both lenses). The MCP's `definition_graph` and `edit_definition_graph` take a `view` beside a page: the page opened on that View, and the View written back: the author's path for a preset View in a views.v1 file | unit: a View's query drawn and written back the same; an edit to its sort, a filter and a search lands in its `query`; `viewQueryOf` is `statedQuery` | U4.5 |
| U4.6b The editor | The `query` graph View's chip offers each page's Views under it; one opened is the page with that View put on its Query. Save writes a reader's own View back to the keeper; a preset View is read only, and Save as makes a reader's own | e2e: a reader's View edited in the graph and saved comes back on its page with its filters, sort, group and search | U4.6a |
| U4.4b, in detail (2026-11-13, after Will's D2: one node, with a sub-graph) | `entity.v2`: a `graph`, or, for a Filter, `settings.where` (entity-filter.v1). ONE door, `entityGraph(entity)`: its graph, else the one its lens draws from its Where (`whereGraph`: a Source, a Field and a Condition per field, an And to `#out/where`, as Filters are drawn today, D3 B). The nine files that read `entity.graph` read it there. The `filter` lens writes back a Where when the graph says one losslessly (Source, Field, Condition, And, Or only), else the graph; a Where's layout is a side record, as the Query's. `filterOf(preset or saved filter, source)` makes a Filter of the other shapes; `presetOfEntity` reads one back | unit: the four shapes are one Filter, drawn and written back the same; a graph with a Math node stays a graph | U4.4a; sherpa-ui-a9 reviews the envelope |
| **U4.7** The Field node's rows (Will, 2026-11-13, D1: "Field nodes can have multiple, conditional, rows that can expose more options like values") | One door for every kind: a row may UNFOLD rows from what it picks (`unfolds`). The Field's field row unfolds a row per value its field declares (its type's or page's `values`; a status field's values, with their looks), drawn by `workflowGraph` and `queryGraph` alike. In the Query graph a status field is ONE Field node: the Status field kind and its chain of Checks go (its rule is the type's; how a reader reaches it waits). TODO 914 (one Field node, several fields) comes after, each field unfolding its own | unit: a Field on a field with values unfolds them, in both graphs; e2e: Health is one node | E1 (Will) |

## Will's decisions

- **U4.2, 2026-11-13:** "Decision: A. Perhaps just a single 'Organise' node that lets you set Axes, Grouping, and
  Sorting parameters. Saves on bloating the graph with lots of smaller nodes." So: axes in a workflow too (A), and ONE
  Organise node, not four. Its rows: Sort and Direction, Group, Search, and Primary, Secondary and Segments (a chart's
  X axis, Y axis and each segment's parts: the Query's `presentation.primary`, `secondary` and `group`). Each row picks
  a field of the rows that reach it, or takes a Field joined to it. A row left empty does nothing.

- **U4.7, E1, open (2026-11-13):** what a Field's value row does. **A** (my pick): it GIVES that value: join it to a
  Condition's Value B, or any row that takes a value. Filtering stays the Condition's (D3 B), so there is one way to
  filter. **B**: it SENDS the rows whose field is that value, a Branch as a Check's Yes and No: the Field node filters
  too, a second way. My other picks, say if wrong: a field with more than 12 values unfolds none, and its hint says how
  many; a value row is read only (its values are its field's).

## The picks (Will: "go with your picks"; say if one is wrong)

- **One Organise per scope** in a Query graph, always drawn, as Arrange is today: its rows are what the reader sets.
- **The MCP's old tools go** in U4.5: one statement per act, by type.
- **U4.2 lands in two parts:** the Query graph first (Arrange and the Presentation's axes into Organise), then the
  workflow (Sort and Group into Organise, with Search and the axes in Simulate). Each with its Demos side.

## Coordination

- U4.1 to U4.3 touch the data layer's lens, `node-kinds.ts` (Organise only), `query-graph.ts`, `query-document.ts`,
  `query-editor.ts` and `node-graph.ts`; not `entity-types.ts`, which is U2's.
- Each merge that changes Demos waits for its Demos side in a worktree pair (the peer sherpa-demos-67).
