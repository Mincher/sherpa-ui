# Plan 78 — the Node Editor for QUERIES

Will, 2026-10-29: *"Let's be able to view, edit, and build out queries using the
Node Editor. We'll need nodes/node rows for all of the elements like Data
Stores, Data Sources, Scopes, Fields, Conditions, Operations, Presentation… We
should be able to access the workflow from the filter-toolbars overflow menu.
Label the menu item "Node Editor (beta)". … Let's plan for this but wait for
the presentation switching work to be completed by the other agent first."*

**Status: BUILT, Q1–Q5 (Q1 ruled A, Will, 2026-10-29; the wait on 548 lifted, D5). Plan 695 N1
(2026-11-03) drew presets, saved filters, status fields and superseded answers too, made every
edit a command (`graphRequest`), kept places per tab (Q5) and wrote Save to the page definition
(`pageWithQuery`). Places in the definition wait for a key in page.v1.**

## 1. The one rule: the editor ASKS, it never keeps a copy

The Node Editor is ONE MORE VIEW of the page's Query, beside the filter
toolbar and the panel. It draws what the Query says, and a change in it is a
`QueryRequest` sent through the source, as a chip's is. It never holds a Query
of its own. Six filter bugs came from a second view, the old panel, that
derived what the bar answered; this one asks.

So the graph is DERIVED, not stored: `queryGraph(query, definition)` makes the
nodes and routes from the live Query and the page definition, each time the
Query changes. Only the nodes' places are the editor's own.

## 2. What becomes a node

Read left to right, the way the data flows:

```
Store ─▶ Source ─▶ View scope ─┬─▶ data scope ─▶ Arrange ─▶ Presentation ─▶ Grid
                     ▲         └─▶ chart scope ─────────────▶ Presentation ─▶ Bar chart
     Condition ──────┘  (one per answered field, into the scope that holds it)
```

| Node kind | Its rows (field → sockets) | It is, in the data layer |
|---|---|---|
| **Store** | its name; out: object (rows) | a registered `Store` |
| **Source** | Page size, Search fields, Apply on; in: object, out: object | the page definition's `source` |
| **Scope** | one row per HELD field, in order; the filter Switch; in: object, out: object | a `ScopeQuery`: `holds`, `suspended`, `narrows` |
| **Condition** | Field, Operator (`OP_LABELS`), Value(s); out: into its scope's field row | one field's reading — `FieldReading`, `where.ts` |
| **Arrange** (the operations) | Sort field and direction, Group field, Search | the scope's `Arrangement` |
| **Presentation** | Kind (bar, donut, pie, grid), Primary, Secondary, Group, Sort | a slot's `Presentation` (548) |
| **Component** | its id and label; in: object | the grid, chart or metric the scope narrows |

Fields are not nodes of their own: a field is a ROW of the scope that holds it,
and its condition plugs into that row. Moving a field to another scope is
moving its row there — the same `moveHold` the toolbar's Send to View uses.

## 3. What a reader can do in it

| Act | The request it sends | Same as |
|---|---|---|
| Change a condition's operator or value | the field's reading | a chip's menu |
| Add a condition: drag from a field row | a new reading | Add filter |
| Cut a condition's route | the field is switched off — kept, not gone | a chip off |
| Move a field row to another scope | `moveHold` | Send to View / Return to |
| Change Sort, Group, Search | the scope's arrangement | the Sort and Group chips |
| Change a presentation | the slot's presentation | the chart card's menu (548) |
| Switch a scope off | the scope's `suspended` | the bar's filter Switch |

Every act the editor offers, a toolbar already offers (parity), so no act is
new to the data layer: the editor is a new FACE.

## 4. Where it opens

The filter toolbar's overflow menu gets **Node Editor (beta)**. It opens the
editor for THAT page's Query.

| | A (my pick) | B |
|---|---|---|
| **Q1** Where the editor shows | A maximised overlay panel over the page: the page stays behind it, live, and shut, the reader is where they were | It goes to the Node Editor Context with this page's Query |

**Will, 2026-10-29: A, for now.**

The inspector does what the workflow's does (plan-78-workflow-data.md §6b):
every row of the selected node again — a scope's held fields, a condition's
operator and value — each marked when a route drives it or takes its value.

## 5. The places of the nodes

A Query has no places. The editor lays the graph out in columns by depth (as
the sketch in §2), and a node the reader moves keeps its place for the tab, as
TODO 551 keeps a workflow's (`SessionStore`, `shared: false`). Saving places
into the page definition comes with Save (later).

## 6. The work, one commit each — after 548

It reuses the workflow plan's parts (plan-78-workflow-data.md): the node
components, `sherpa-node-socket` and `sherpa-connector` (W4), the binding
(W3), and the kinds as data (W1).

| Step | Builds | Proves |
|---|---|---|
| Q1 | `QUERY_KINDS`; `queryGraph(query, definition)`: the nodes and routes, laid out by depth. DOM-free | node tests: the Records page's Query gives the graph of §2 |
| Q2 | "Node Editor (beta)" in the overflow menu; the overlay draws the graph, read only, and follows each change of the Query | a chip changed on the page moves the editor; Chromium spec |
| Q3 | edits: a condition's operator and value, Sort and Group, the Switch — each a `QueryRequest` | the toolbar shows what the editor did, and the reverse |
| Q4 | building: add and cut conditions, move a field between scopes, change a presentation | each act matches its toolbar twin |
| Q5 | places kept per tab | a reload keeps a moved node |

## 7. Later — its own TODO, after the core

Fuzzy AI nodes, to turn contextual processing into a decision-model-like
output; and MCP, Tool, Skill, Context and Memory nodes. They are kinds an app
or the library adds, on the same engine (`runWorkflow`, W5).
