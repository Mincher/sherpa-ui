# Plan 1004: one door draws every graph's nodes — a page's filter graph is built apart

Will, 2026-11-15: "Filter graphs don't have the node type name prefixed in the title. I'm worried that filter graphs
and other graphs are using different systems or implementations. We should look into this."

**Status: looked into, and he is right (sherpa-demos-67; the inventory by sherpa-ui-e8; the traps by sherpa-ui-a9,
2026-11-15). Will, 2026-11-15: start it next, after the nodes already queued. 1004a built by sherpa-ui-e8 (the Time leaf's Pass and Fail drawn twice). 1004e built by sherpa-ui-a9 (one place set; it fixed Swimlanes off in a Query graph). Owners: sherpa-ui-e8 (the drawing), sherpa-ui-a9 (the Query lens), sherpa-demos-67 (the
plan, Demos' pages).**

## 1. What is wrong

Both draw on one canvas and editor (node-graph.ts, `bindWorkflow`), but each BUILDS its drawn nodes apart:

- A kept graph (a workflow, a Runbook, a Coworker, a Filter entity, and what opens inside a node) is drawn by
  `workflowGraph` (workflow.ts).
- A page's Query canvas is `doc.graph()` = `queryDrawn` → `queryGraph` (query-graph.ts) + `laidOut`. It never goes
  through `workflowGraph`, and makes its DrawnGraph itself, its rows written out by hand.

So a rule added to workflow.ts's drawing is missing from a page's filter graph unless it was added twice. Will's bug is
one of them: `kindHeading` (the kind's name before a node's own title) is written by workflow.ts alone (inventory N3).
Others: the app's own kinds (G2), 17 warning rules (N9), ignored inputs, closed and driven rows, faults, a Fork's
ways, and Value A's "(Optional)" row (R21). And one likely bug (R28): a Time test in a Query keeps Time › Duration's
Pass and Fail in its rows, then has them added again, so they may be drawn twice.

Good: `treeGraph`, `whereGraph` and `statusRule` already give kinds and values that `workflowGraph` draws, so the one
door exists for trees.

## 2. The rule

**The lens says what the Query MEANS; the one drawing draws it.** The Query lens gives a graph definition: kinds,
values, own headings and words, and what each node is to the Query (`ref`), with the graph's type, `query`.
`workflowGraph` draws any graph by its type, as it draws a workflow. An edit still goes back as the command it asks.

## 3. The traps (sherpa-ui-a9; the drawing side is sherpa-ui-e8's)

| # | Trap | The way out | Owner |
|---|---|---|---|
| T1 | `workflowGraph` adds a Start to every top graph (workflow.ts:651-662); a Query holds none | a "no Start" switch by the graph's TYPE, never an `if` for the Query | e8 |
| T2 | `workflowFaults` refuses a kind whose `graphs` lacks `workflow` (workflow.ts:328): every Query-only kind would fault | the checks take the graph's type (`query`), as the node panel does (node-kinds.ts:816) | e8 |
| T3 | every edit maps back through `node.ref` (scope, field, tree, path, preset, kept, status, component, superseded) | the drawing carries `ref` through untouched, or an edit maps to nothing, with no error | a9 |
| T4 | the lens marks rows read only with a hint ("Its chip changes it") and draws a suspended filter Off | the definition carries `editable`, its hint and `off`; else a reader's edit is dropped with no word | a9 |
| T5 | `reconcileQuery` diffs two definitions to find what the reader changed | it reads the lens's own definition, never the drawn one (which adds defaults, kind headings, warnings) | a9 |
| T6 | two place sets: query-document.ts's GraphLayout and 1001a's GraphPlaces | GraphLayout uses `placesOf`, `withPlaces`, `connectionKey`; in a Query, frames and a node's stage stay layout (a Query cannot hold them) | a9 |
| T7 | the page's live counts find each node by its `QUERY_NODE` id | the drawing keeps the lens's ids as given, never re-ids or re-orders them | a9, e8 |

## 4. Phases

| Phase | Does | Owner |
|---|---|---|
| 1004a | Measure R28 (a Time test's Pass and Fail drawn twice in a Query graph), a test first, then fix it | e8 |
| 1004b | `workflowGraph` by the graph's type: the Start (T1), the kind checks (T2), the kind registry with the app's types (G2) | e8 |
| 1004c | The lens gives a definition: kinds, values, own words, `ref`, `editable`, hints and `off` (T3, T4); ids kept (T7); reconcile reads it (T5) | a9 |
| 1004d | `queryDrawn` is `workflowGraph` of that definition; the rows written by hand go (R1, R20, R25). Each Query-only piece (PAGE_ROWS, the bar's chips and presets, Organise and Presentation rows, Equals read as ticks, EVERY, Off, superseded trees) becomes a kind's own rows or a value the lens gives | e8, a9 |
| 1004e | One place set (T6) | a9 |
| 1004f | Demos: each page's filter graph in its specs (titles now "Field: Health"); Will looks | sherpa-demos-67 |

## Appendix: the inventory (sherpa-ui-e8, on main 59427c503)

Made by sherpa-ui-e8 (a read-only agent read both builders; e8 checked N3 and R28), on main 59427c503. "wf" =
src/core/data/workflow.ts, "q" = src/core/data/query-graph.ts. Line numbers are from that commit.

### How each graph is drawn

- The Query editor's top canvas is `doc.graph()` (src/core/ui/query-editor.ts:100-102) = `queryDrawn` → `queryGraph` +
  `laidOut`. It never goes through `workflowGraph` (src/core/ui/node-graph.ts:2973). `workflowGraph` draws only what is
  opened inside a node (`path.length`), and Filter entities (filter.ts:96).
- `treeGraph`, `whereGraph`, `statusRule` (q:309-391) already emit WorkflowNodes (kind, values, own heading) that
  `workflowGraph` draws: the "kinds and values, one drawing" path exists already.
- Two different local `rowsOf`: wf:187 adds portal Out rows; q:461 returns a kind's rows filtered by `row.graphs`.

### Graph level

| # | Field | Rule | wf | q / lens | Verdict |
|---|---|---|---|---|---|
| G1 | nodes | an unknown kind is not drawn | 731 | no (`NODE_KINDS[kind]!`, 527) | wf only |
| G2 | kinds | registry | 650-651 `withStartKind(nodeKinds())` | 527 literal `NODE_KINDS` | DIFF: q misses app types and the Start kind |
| G3 | nodes | the Start placed | 654 `withStart` | no | wf only |
| G4 | connections | which are drawn | 657 live ones (another type's and portal orphans dropped) | by hand, 549-724 | DIFF |
| G5 | `via` | bends | in the definition | query-document.ts:60 (`laidOut`, `layout.bends`) | DIFF source |
| G6 | ties | | 931 `tiesAmong` | query-document.ts:71, query-editor.ts:102 | DIFF place |
| G7 | frames | | 932 `framesAmong` | query-document.ts:72, query-editor.ts:102 | DIFF place |
| G8 | portal Out rows | a row per connection into an In | 187-210 | no | wf only |

### Node level

| # | Field | Rule | wf | q / lens | Verdict |
|---|---|---|---|---|---|
| N1 | heading, icon, description, sockets, many, category, would | from the kind, by type | 929 `kindNode` via `kindOfNode`/`resolveKind` | 527 `kindNode(resolveKind(...))` | SAME |
| N2 | heading (own) | | 922 `node.heading` | built from the Query: field labels 548-686, preset 663, scope 695, View 721; none on source, organise, view-filters, view | DIFF |
| N3 | **kindHeading** | the kind's name before an own title | 920-922 | **never** | wf only: Will's bug |
| N4 | description | own synopsis | 922 `node.description` | q's own words: 554, 650, 663, 668, 678, 686, 695 | DIFF |
| N5 | icon | override | no | 663 `'filter'` for a Filter preset | q only |
| N6 | x, y | place | 929 | 731-738 columns, then `placed` (query-document.ts:59) | DIFF |
| N7 | size | | 929 | from layout via `placed` | DIFF source |
| N8 | ref | edit routing | no | every node | q only (must pass through, a9 T3) |
| N9 | warnings | | 753-919 (17 rules, below) | 590 only: a kept Source "not the page's" | DIFF |
| N10 | ignored | inputs its type does not fit | 739-749, 923 | no | wf only |
| N11 | would | "Blocked: it would start a loop" | 924 | no | wf only |
| N12 | started | a Source the Start reaches | 926 | no | wf only |
| N13 | header output | the Boolean's, as what passes | 928 | no | wf only |
| N14 | kind.graphs | drawn outside its graphs | not gated in drawing (only faults, 328) | not gated (draws Time at 565) | SAME |

wf warnings that q has none of: unstarted Trigger and loop (754); Value A with a column (757); input reads null (758-766,
771, 848); portal (773); opWarning (777-778); type does not fit (779-782); message values not reached (796); an idle row
still connected (826); no fields known (835); join a Model (861); a required pick (863); Runbook instructions (866); a
storeless Field (872); a stranger field (873); a value kept on a connection-only row (909); recipients from another store
(917).

### Row level

| # | Field | Rule | wf | q / lens | Verdict |
|---|---|---|---|---|---|
| R1 | rows | where they come from | 791 `rowsOfNode(kind, values)` | `rowsOf` 461-464 for some; by hand: `leafRows` 262-292, field 547, status 604-607, chips 641-644, presets 648/662, PAGE_ROWS 210-214, Operation 559/694 | DIFF |
| R2 | rows | filtered by `row.graphs` | no | 463 | q only |
| R3 | rows | a Fork's unfolded rows | 791 | no | wf only |
| R4 | rows | a `valuesOf` row hidden with no choices | 905 | n/a | wf only |
| R5 | value | | 836, then 878-902 (mirrored, brought, null, primary) | from the Query's state | DIFF |
| R6 | editable | | 836 (connection lock is the renderer's) | per row, by hand | DIFF |
| R7 | hint | | 819, 831, 834, 875, 884-901 | its own words (FROM_DEFINITION, FROM_STORE, OPENS_RULE, CHIP, SUPERSEDED, Off, EVERY_FILTER, SHARED…) | DIFF, no overlap |
| R8 | Type row | label, value, hint, choices | typeLabel "Check"; 819; `typeChoices` filtered by fit 783 → 814 | "Operation"; no help hint; operator lists 280-281, JOINS 251 | DIFF |
| R9 | type, b | Equals on a known field drawn as Is one of ticks | no | 278-287 | q only |
| R10 | control | `typedControl` | 803: `ofField` rows with no values | 285: always on Value B/Start/End | shared helper, DIFF trigger |
| R11 | control, multiple | values→text with none; tags→ticks with values | 804-805 | builds the end control directly (287, 289) | similar, DIFF mechanism |
| R12 | choices | | 812-817 `rowChoices` (fields, stores, types, values, count, provider, portals, entities) | `rowChoices` for some; by hand for field 547, keys, picks, ops | partly shared |
| R13 | unit words | follow the count | 807 | 271 | SAME |
| R14 | closed | | 821 | never | wf only |
| R15 | fault | `rowFault`/`shapedRow`/`typedWants` | 838-844 | never | wf only |
| R16 | driven rows | `drivenSwitch`/`mirrored` | 884, 893, 897-902 | no | wf only |
| R17 | value null | only unusable input | 878, 887 | no | wf only |
| R18 | idle | | 824, 836 | no | wf only |
| R19 | Pass/Fail output | by what is sent | 829 | TEST_ROWS as the kind gives | wf only |
| R20 | sockets stripped | | no | `owned` 456; organise 446; leaf rows 271, 286-291 | q only |
| R21 | (Optional) | Value A drawn | kind row via 791 | not drawn (`leafRows` replaces rows) | DIFF |
| R22 | beside | Source Rows beside Store | 836 | 581 same; but `owned` strips Store's input (456) | SAME, Store input DIFF |
| R23 | setting | off the canvas | renderer (node-graph.ts:444) | same | SAME |
| R24 | every | Source Fields words | 833-835 | row dropped (463) | wf only |
| R25 | Field row | | kind row + hint 875 + reach choices 809 + warnings 870-873 + Values row | by hand 547: no input, no recalls, `ctx.fields`, no hint, no Values row | DIFF |
| R26 | message, model, provider, portal, entity rows | | 794-797, 811, 815-816, 875 | no | wf only |
| R27 | b as JSON | an object value | no | 290 | q only |
| R28 | **likely bug** (by reading, checked by e8) | Time leaf: q:270 keeps `pass` and `fail` (filters only `control !== 'type'`; Time › Duration's rows are type, pass, fail, when, n, unit), gives them `value: span.unit, editable: true` (271), then q:565 appends TEST_ROWS.time again: Pass and Fail twice. treeGraph 335 stores pass/fail values too | n/a | 270-271, 565, 335 | q only, to measure |

### Only the Query builder has

Source PAGE_ROWS (210-214, 582-585); kept Sources (588-591); the status Field node with a rule row per value (599-609); the
bar's Switch, chips and `@preset` rows (641-648); preset nodes and their written rows (652-669); the cards' And (692-698);
Organise rows (440-452); Presentation rows with "Default (kind)" (415-425); Equals read back as ticks (278-287); EVERY
(275, 624); Off (556); superseded trees (684-689); read-only preset trees (595, 668); the column layout (731-738); `ref`
on every node.

### Helpers shared already

`kindNode` (node-kinds.ts:1253), `resolveKind` (801), `rowChoices` (1090), `typedControl` (479); also `rowOf`,
`socketOf`, `ROWS`, `TEST_KINDS`, `LIST_OPS`; `tiesAmong` and `framesAmong`. The renderer (node-graph.ts) serves both:
`rowTitle`, the setting filter, beside, `kindHeading` (1562), category, idle, closed, fault, hint.

Only workflow.ts uses: `rowsOfNode`, `typeOf`, `typeChoices`, `mirrored`, `drivenSwitch`, `rowFault`, `fixedChoices`,
`kindOfNode`, `nodeTitle`, `needOf`/`readInput`, `fieldWords`, `portalHint`.
