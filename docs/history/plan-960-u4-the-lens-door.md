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
| **U4.5** The MCP through the door | One pair of tools by type: `definition_graph(type, definition)` and `edit_definition_graph(type, definition, edits)`. `workflow_graph`, `edit_workflow`, `query_graph` and `edit_query_graph` go, in the same change (no aliases) | the MCP tiers' tests on each type | U4.3 |

## Will's decisions

- **U4.2, 2026-11-13:** "Decision: A. Perhaps just a single 'Organise' node that lets you set Axes, Grouping, and
  Sorting parameters. Saves on bloating the graph with lots of smaller nodes." So: axes in a workflow too (A), and ONE
  Organise node, not four. Its rows: Sort and Direction, Group, Search, and Primary, Secondary and Segments (a chart's
  X axis, Y axis and each segment's parts: the Query's `presentation.primary`, `secondary` and `group`). Each row picks
  a field of the rows that reach it, or takes a Field joined to it. A row left empty does nothing.

## The picks (Will: "go with your picks"; say if one is wrong)

- **One Organise per scope** in a Query graph, always drawn, as Arrange is today: its rows are what the reader sets.
- **The MCP's old tools go** in U4.5: one statement per act, by type.
- **U4.2 lands in two parts:** the Query graph first (Arrange and the Presentation's axes into Organise), then the
  workflow (Sort and Group into Organise, with Search and the axes in Simulate). Each with its Demos side.

## Coordination

- U4.1 to U4.3 touch the data layer's lens, `node-kinds.ts` (Organise only), `query-graph.ts`, `query-document.ts`,
  `query-editor.ts` and `node-graph.ts`; not `entity-types.ts`, which is U2's.
- Each merge that changes Demos waits for its Demos side in a worktree pair (the peer sherpa-demos-67).
