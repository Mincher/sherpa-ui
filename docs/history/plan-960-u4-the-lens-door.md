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
| U4.4b, in detail (2026-11-13, after Will's D2: one node, with a sub-graph; BUILT 2026-11-13 with sherpa-ui-a9's review: the body at the top, `query: { where }`, and his type flag `graph.query`) | `entity.v2`: a `graph`, or, for a Filter, `settings.where` (entity-filter.v1). ONE door, `entityGraph(entity)`: its graph, else the one its lens draws from its Where (`whereGraph`: a Source, a Field and a Condition per field, an And to `#out/where`, as Filters are drawn today, D3 B). The nine files that read `entity.graph` read it there. The `filter` lens writes back a Where when the graph says one losslessly (Source, Field, Condition, And, Or only), else the graph; a Where's layout is a side record, as the Query's. `filterOf(preset or saved filter, source)` makes a Filter of the other shapes; `presetOfEntity` reads one back | unit: the four shapes are one Filter, drawn and written back the same; a graph with a Math node stays a graph | U4.4a; sherpa-ui-a9 reviews the envelope |
| **U4.7** The Field node's rows (Will, 2026-11-13, D1: "Field nodes can have multiple, conditional, rows that can expose more options like values") | One door for every kind: a row may UNFOLD rows from what it picks (`unfolds`). The Field's field row unfolds a row per value its field declares (its type's or page's `values`; a status field's values, with their looks), drawn by `workflowGraph` and `queryGraph` alike. In the Query graph a status field is ONE Field node: the Status field kind and its chain of Checks go (its rule is the type's; how a reader reaches it waits). TODO 914 (one Field node, several fields) comes after, each field unfolding its own | unit: a Field on a field with values unfolds them, in both graphs; e2e: Health is one node | E1 (Will) |
| U4.7a The unfold door, in detail (2026-11-13; BUILT 2026-11-13 for workflows: the Query graph's Fields wait for U4.7b) | A row kind may say `unfolds: 'values'` (the Field's `field` row). Its node then has one OUTPUT row per value its picked field declares (`pickedField`: the type's or page's `values`; at most 12, else none and the hint says how many), named `v-<slug>` (the socket pattern takes no spaces: "At risk" is `v-at-risk`, a clash `-2`), labelled by the value's own words (a type's `labels`), read only, output `value`; a status field's values wear their looks. ONE door for a node's output rows, `outputRow(kind, node, name)`: the kind's own, else an unfolded one by its prefix, so a connection from one is checked, typed and sent where every output is (`socketType`, `sentFrom`, node-input, the check) with no facts; with facts, a `v-` row its field does not declare is a fault, in words. Simulate sends the value itself. In the Query graph the rows show only: a Condition there takes no connection into Value B | unit: a Field unfolds its field's values and no other field's; a new pick unfolds the new field's; none for a name or an email; a connection from `v-at-risk` into a Condition's Value B is sound and Simulate reads "At risk"; e2e: the rows draw, with their sockets | E1 A |
| U4.7b A status field is one Field node (D1) | In the Query graph a status field is ONE Field node, its values its rows (U4.7a); the Status field kind, its Check chain and its tests go. Waits: how a reader reaches the rule (the type's), so it is not lost from sight | — | U4.7a; Will |
| **U4.8** A View's graph (Will, 2026-11-13, D4: "a View Filters input and a Content input"; the Content node IS the Presentation node, A; build after U4.7, A); Q1 to Q3 answered) | Three nodes in place of today's chain (Source › View Context › a data-scope node with a row per preset and field › Organise › Presentation › grid). **View Filters** (the View scope's bar): its chips in order, each a field held with or without a pick, its filters Switch; a field's tree joins its chip, a Filter use (D2) joins as a preset. **Presentation** (the Content; one per card): its rows come from a Source through the nodes on the way, its local filters among them (Will, Q1); its bar (held chips, their order, its Switch) as rows; how its rows are shown. **View**: two inputs only, View Filters (one) and Content (many); no rows. Each edit is still the Query's own request, by the node's `ref`: a field moved between scopes is its tree's True moved from View Filters to a Presentation, or back (`connectionRequest`, send to View or return); chip order is the rows' order (`{ scope, order }`); the Switch is `{ scope, suspended }`; a held field with no pick is a chip with nothing joined; a preset is `{ scope, preset, on }`; sort, group, search and axes are the Organise's (U4.2) | unit: a page's Query drawn in the three nodes, each request read back the same; e2e: Coworkers' graph has the shape | U4.7 |
| U4.8a The three nodes (BUILT 2026-11-13, lane 960-u48: "U4.8a, as built" below) | `view-filters` and `view` kinds; `presentation` gains its chips, its Switch and its Content output; queryGraph draws them; the scope node and the View Context chain go; reconcile reads the new refs | as U4.8 | U4.8 |
| U4.8b A page's Views in the graph chip (was U4.6b; BUILT 2026-11-13: "U4.8b, as built" below) | The `query` graph View's chip offers each page's Views under it; one opened is drawn with that View put on its Query (VIEW_LENS, U4.6a). Save writes a reader's own View to the keeper; a preset View is read only, and Save as makes a reader's own | e2e: a reader's View edited in the graph and saved comes back on its page | U4.8a |
| U4.9 A Notification's To takes recipients (BUILT 2026-11-13, on sherpa-ui-a9's `recipient` flag; a To once typed warns unused; Will, 2026-11-13: "The 'To' input in a Notification node should take in rows containing data on the recipients. Recipients can be Users, Groups, Roles, AI Agents, or Coworkers"; "Right now To expects a value which doesn't make any sense") | To becomes an input of ROWS (`input: 'object'`, `needs: 'rows'`), not text. The library names no recipient type: an app's type says it is one, `recipient: true` (type.v1, sherpa-ui-a9's), one door, `recipientTypes()`. Rows into To from a store whose type is no recipient warn, naming the app's recipient types ("To takes rows of Users, Groups, Roles or Coworkers"); its `would` counts them ("Would send a notification to 3 recipients"). Demos marks user, group, role and coworker (Will, after: "Nevermind about AI Agents as recipients.") | unit: To takes rows; a non-recipient store warns in words; Simulate counts; e2e: a Users Source into To | a9's flag |
| U4.9b A Source picks rows (Will, 2026-11-13: "Source picks rows", for ONE fixed recipient such as "Service desk"; BUILT 2026-11-13) | The Source kind's optional many pick, Rows (`control: 'rows'`, `picked`): its store's rows shown by the type's `title`, kept by its `key`; none picked, every row. Its choices come from the app through one fact, `storeRows(store)`; `rowPicks(type, rows)` makes them. Simulate sends only the picked rows. A page's Query graph offers no Rows pick: a page reads all its rows, and its Query filters them | unit: the pick's choices; Simulate sends the picked; none, every row; the Query's Source has none | U4.9 |


### U4.8, the wiring (2026-11-13, from Will's D4 and Q1 to Q3; to check before it is built)

```
Source ─rows─► Field ─► Condition ─True─► View Filters  [its row for that field]     a View filter (a chip on the View's bar)
Filter use (a preset) ─True─────────────► View Filters  [its row for that preset]
Organise (the View's) ──────────────────► View Filters                               Q2 A: it arranges every card
View Filters ───────────────────────────► View  [View Filters input]

Source ─rows─► Field ─► Condition ─Results─► Presentation ─► View  [Content, one per card]   Q1: filtered on the way
               (two filters of its own: each Condition's Results into an And; the And's Results into the Presentation)
Organise (the card's) ─► Presentation
Presentation's rows: its bar (Q3 A): its Switch, each chip it holds in order, with or without a pick
```

- A card's local filters are its Conditions on its rows' path: a Condition's RESULTS are the rows that pass, and an And's
  Results the rows in all of its inputs (plan 944): one system, no new filter node. A card with no filter of its own
  takes the Source's rows straight. (Corrected 2026-11-13: a Check is no filter. It sends ALL its Data on Yes or No, by
  one truth, so a Check would pass every row where any passes.)
- Moving a field between scopes is moving its tree: its True into View Filters (the View's), or its Results onto the
  card's rows' path (its own): `connectionRequest`, as today's send to View and Return.
- Chip order is the order of a bar's rows; the Switch, its first row; a chip with no pick, a row with nothing joined.

**Three points (sherpa-demos-67, 2026-11-13), answered:**

- **(a) Which Source a View filter's Field reads.** A page has ONE source (its `store` or `type`; every Demos page so),
  and every card of a page is a scope of it: a page's graph has one Source, and every Field reads it. A Source a reader
  places beside it (TODO 808) is no part of the Query. A field the Source has not got warns as a Field does today.
- **(b) No Check (CORRECTED 2026-11-13).** A Check branches all its Data by one truth; it filters no rows. A card's own
  filters are its Conditions' Results on the rows' path, and two or more join in ONE And, whose Results are the rows in
  all of them (an And already takes many inputs). No change to the Check. The earlier answer (a Check taking several
  tests) is withdrawn.
- **(c) A chip and the filter it shows, said once.** Both are drawn from ONE reading of the Query, the one truth, so they
  cannot disagree. A filter joins where it FILTERS: a View filter's True into its chip's row on View Filters; a card's
  own filter's Results onto the card's rows' path. A card's chip on its Presentation names its field and says its pick in words (its
  hint), from that same reading, and takes no line.

### U4.8a, as built (2026-11-13, lane 960-u48; plan 971's Pass read for every "Results" above)

**Ids** (`QUERY_NODE`), each with its kind and `ref`:

- `view-filters` (`viewFilters`), kind `view-filters`, ref `{ scope: 'view' }`.
- `presentation-<id>` (`presentation(id)`), kind `presentation`, ref `{ scope, component? }`: a card's, the one that carries
  its bar, by its scope (`bar(scope)`); any other Content (a View component, a card's second component) by its own id.
- `view`, kind `view`, no ref.
- `and-<scope>` (`and(scope)`), kind `condition`, type And, ref `{ scope }`: a card's two or more filters joined.
- Gone: `scope-<id>`, `component-<id>` and `show-<id>`; the kinds `scope` and `component`.

**Rows.** View Filters: Filters (the Switch, `#filters`); a chip per held field, in order (its field's name, input any,
its pick in words as its value, read only); a row per preset (`@<id>`, input boolean); then its output, View Filters
(`filters`). Its header takes the View's Organise. Presentation: where it carries its card's bar, the same Switch, chips
(no socket) and presets; then Show as and Segment order; then its output, Content (`content`). Its header takes the
card's rows. View: View Filters (`filters`, one) and Content (`content`, many), and nothing else.

**Lines.** Every Query Field reads the page's rows (its status fields' Results, else the Source's), but a status
chain's. A View filter's True goes into its chip; a card's own filter's Pass into the card's And (two or more), then its
Organise, then its Presentation; a card with neither takes the rows straight. The View's Organise takes the rows and
sends its Results into View Filters. A preset goes into its bar's `@<id>`. View Filters into the View's View Filters;
each Presentation's Content into its Content. A Query test draws its kind's Pass, Fail and True.

**Edits → requests.** A Switch, on View Filters or a Presentation: `{ scope, suspended }`. A preset's On: `{ scope,
preset, on }`. A tree's root, its True or Pass, into a View Filters chip: `{ scope, field, reading: null }` then
`{ scope: 'view', field: <the chip>, reading }`; onto a card's path (the header of its Presentation, Organise or And):
the same field moved into that card; the same scope and field ask nothing. A bar's chips written in another order:
`{ scope, order }` (`orderRequest`, which the reconcile reads). Show as and Segment order: `{ scope, presentation }`.
A Field placed: `{ scope, hold }`, a chip with nothing joined. The Organise's rows as U4.2.

**The picks** (❓, each with the other option):

- ❓ A chip's pick in words is its VALUE, read only, and its hint says who changes it: a row with no control draws its
  value ("Region: equals(EMEA)") and never its hint, and the values put the chips' order in the definition. Other: a
  hint alone, and no order read from a graph.
- ❓ A chip with no pick keeps no value, so an order written moves only the picked chips among their places. No
  editor gesture reorders a node's rows yet: a definition written whole (the lens, an agent) can. Other: a word for
  "no pick".
- ❓ A bar's rows are its Switch, its chips, then its presets (the brief's order). Other: presets first, as the scope
  node had them.
- ❓ A card's superseded answer's True joins its chip, the one chip on a card that takes a line, where it joined the
  scope node. Other: drawn with no line.
- ❓ The View's Organise reads the page's rows. Other: drawn with nothing in.
- ❓ A card with no component still gets its Presentation: its bar has nowhere else. A scope's bar is on one
  Presentation: the component named as the scope, else its first.
- ❓ A filter switched off stays on its card's path, as off filters stayed joined to their scope.
- ❓ A load's trace lights a scope's step on the node that carries its bar (`bar(scope)`).

### U4.8b, as built (2026-11-13, lane 960-u48b, sherpa-ui-e8; Demos' side sherpa-demos-67's)

- **The chip.** The `query` graph View's Page chip lists a section per page and, under it, a row per View: its presets,
  read only, then the reader's own (`pageRows`, from `GraphPage.views`). A row's value is `<page>/<view>`
  (`pageViewOf` reads it). A bare `<page>`, as Open in Node Editor sends, opens the View the page was left on; its row
  is the one picked.
- **Opened.** The outlet opens the page on that View (`provider.open(…, { view })`), so its live Query has the View on
  it: the VIEW_LENS's graph. `OpenGraph.id` is the row's value, and its `origin` the View's, so the Context is told
  again when the View changes. `OpenPage.view` names it.
- **Save.** The header's View actions show on a page's Query too, in a View's words: Save view, Save view as, Delete
  view. `data-query` goes (it only hid them), and `data-graph` is an entity's graph alone. A preset is read only (Save
  off); Delete only on a reader's own. Two outlet doors, answered by the app's Context: `savePageView(label?)`, over the
  reader's own View, or a new one named (`provider.saveView`, its `query` by `statedQuery`), which the chip opens; and
  `deletePageView()`, which opens the page's first View after.
- ❓ No confirm on Save: a graph's Save writes as an entity's does. Other: "Save over X?", as the page's own Save asks.
- ❓ A View opened from the graph is kept as the View the page was left on, as the provider keeps any opened View.
  Other: the graph opens it and the page's own stays.

## Will's decisions

- **U4.2, 2026-11-13:** "Decision: A. Perhaps just a single 'Organise' node that lets you set Axes, Grouping, and
  Sorting parameters. Saves on bloating the graph with lots of smaller nodes." So: axes in a workflow too (A), and ONE
  Organise node, not four. Its rows: Sort and Direction, Group, Search, and Primary, Secondary and Segments (a chart's
  X axis, Y axis and each segment's parts: the Query's `presentation.primary`, `secondary` and `group`). Each row picks
  a field of the rows that reach it, or takes a Field joined to it. A row left empty does nothing.

- **U4.7, E1, Will 2026-11-13: A.** A Field node's value row GIVES that value (join it to a Condition's Value B);
  filtering stays the Condition's (D3 B). And (Will: "It's values for the selected field though, right? Not just any
  value on the row"): a Field node's value rows are the values of the field picked on THAT node only, as its type (or
  page) declares them; never values from the row's other fields; a field that declares no values (a name, an email)
  unfolds no value rows; a new pick unfolds that field's values in place of the last. The question was:
- **U4.7, E1 (asked 2026-11-13):** what a Field's value row does. **A** (my pick): it GIVES that value: join it to a
  Condition's Value B, or any row that takes a value. Filtering stays the Condition's (D3 B), so there is one way to
  filter. **B**: it SENDS the rows whose field is that value, a Branch as a Check's Yes and No: the Field node filters
  too, a second way. My other picks, say if wrong: a field with more than 12 values unfolds none, and its hint says how
  many; a value row is read only (its values are its field's).

- **U4.8, Q1, Will 2026-11-13:** "Rows come frome Sources and can be filtered, or manipulated, between the Source and
  Presentation node." So a Presentation's rows are what a Source sends, through any nodes on the way (Conditions,
  Filters, Organise, Math…): a card's local filters are those nodes, on its rows' path, not rows of the Presentation.
  The View Filters node goes into the View node, which puts it over every Content. A card's bar (its held chips, their
  order, its Switch) stays the Presentation's rows. The question was:
- **U4.8, Q1 (asked 2026-11-13):** where each Presentation's rows come from. **A** (my pick): from the Source; the View
  node puts its View Filters over every Content, so neither knows the other (Will: "the view node won't necessarily know
  the filters, or content, going into it"). **B**: through the View Filters node (Source › View Filters › each
  Presentation), View Filters also into the View.
- **U4.8, Q2, Will 2026-11-13: A.** A View-wide sort, group or search is an Organise node joined into the View Filters
  node; it arranges every card. **Q3 (the bar), Will: A.** A card's filter bar (its chips, their order, its Switch)
  stays as rows on the Presentation node; the filtering itself is the nodes on the path. The question was:
- **U4.8, Q2 (asked 2026-11-13):** a sort, group or search for the whole View. **A** (my pick): an Organise joined into
  the View Filters node arranges every card, as the View scope arranges today. **B**: only a card's own Organise, joined
  into its Presentation.

## The picks (Will: "go with your picks"; say if one is wrong)

- **One Organise per scope** in a Query graph, always drawn, as Arrange is today: its rows are what the reader sets.
- **The MCP's old tools go** in U4.5: one statement per act, by type.
- **U4.2 lands in two parts:** the Query graph first (Arrange and the Presentation's axes into Organise), then the
  workflow (Sort and Group into Organise, with Search and the axes in Simulate). Each with its Demos side.

## Coordination

- U4.1 to U4.3 touch the data layer's lens, `node-kinds.ts` (Organise only), `query-graph.ts`, `query-document.ts`,
  `query-editor.ts` and `node-graph.ts`; not `entity-types.ts`, which is U2's.
- Each merge that changes Demos waits for its Demos side in a worktree pair (the peer sherpa-demos-67).
