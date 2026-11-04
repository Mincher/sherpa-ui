# Plan 713 — the node model: typed sockets, True and False, the Condition node

Will, 2026-11-04 (TODO 713), in short: a **Condition** node that picks a field,
compares its values with given parameters, and passes the output on. Nodes output
a **value**, an **object** or a **true/false boolean**. A row has an output socket
for a value or an object; the **header** has one for **True**; a new **footer** has
one for **False**. Inputs take a value, an object, a boolean, or **any**. Each
type has its own **colour and shape**. A socket may take or send **several
connections**. A row that shows a text field where a **picklist** is wanted gets
one, and a **text Value node** plugged into it overrides the pick.

**Status: PLAN, 2026-11-04.** It is the base for N4 (`runWorkflow`, TODO 616).
Nothing here is built until Will says: 616's hold covers it.

Earlier rulings this plan keeps: one registry, `NODE_KINDS` (plan-695 N1); the
Query graph is derived, and every edit is an `ask()`
([plan-78-query-editor](plan-78-query-editor.md)); a routed input MIRRORS what
comes in, read only ([plan-78-workflow-data](plan-78-workflow-data.md) §5);
`traceStep` lights a node by its id ([plan-695](plan-695-architecture.md) N2).

## The idea in one line

**Rows carry WHAT** (a value or an object). **The header and the footer carry
WHETHER** (True or False).

```text
             When ▶ ┌──────────────────────────────────┐ ▶ True        HEADER: When in, True out
                    │  ƒ  At risk          (Condition) │
                    ├──────────────────────────────────┤
             Rows ◆ │  Rows                            │               a ROW: the data rows come in
                    │  Join      [ Any of          ▾ ] │               a picklist
                  ● │  Field     [ Score           ▾ ] │ ●             a row may send its value on
                  ● │  Operator  [ Less than       ▾ ] │
                  ● │  Value     [ 60                ] │
                    │  · · · · · · · · · · · · · · · · │               the next condition of the group
                  ● │  Field     [ Tickets         ▾ ] │
                  ▶ │  Group                           │               a nested group's True (many)
                    │  Matches: 43                     │ ●
                    ├──────────────────────────────────┤
                    │  + Condition                     │ ▶ False       FOOTER: False out
                    └──────────────────────────────────┘
  ● value (circle)   ◆ object (diamond)   ▶ boolean (triangle)   ■ any (square, inputs only)
```

---

## 1. Where it stands

Measured 2026-11-04: `queryGraph` on Demos' Records definition and
`workflowGraph` on Demos' `app/workflows/active-customers.json`, run in Node.

**Sixteen kinds, two socket types.** `SocketCarries` is `'value' | 'object'`: a
circle or a diamond, both in one grey (`--sherpa-style-content-secondary`). Only an
output takes the pointer. An input takes one route. The data rows go header to
header.

| Kind | Graph | Header in → out | Its rows (control; sockets) |
|---|---|---|---|
| store | both | — → ◆ | Store (store) |
| status | query | ◆ → ◆ | one row per value: words only, no control |
| source | query | ◆ → ◆ | Page size (number), Search fields (text), Apply on (text) |
| scope | query | ◆ → ◆ | Filters (switch); one row per preset and held field, ● in |
| condition | query | — → ● | Field (field), Condition (op), Value (text, or ticks) |
| preset, saved | query | — → ● | On (switch); each field it writes: words only |
| arrange | query | ◆ → ◆ | Sort (field), Direction, Group (field), Search (text) |
| presentation | query | ◆ → ◆ | Show as, Primary, Secondary, Group, Sort |
| component | query | ◆ → — | none |
| value | workflow | — | Value (text) ● out |
| pick | workflow | ◆ → — | Field (field) ● out |
| filter | workflow | ◆ → ◆ | Field, Condition (op), Value (text, ● in), Matches (● out) |
| sort, group | workflow | ◆ → ◆ | Field, Direction / Field |
| count | workflow | ◆ → — | Count (● out) |
| output | workflow | ◆ → — | none |

**Rows that show a text field where a picklist is wanted:**

1. Query › **Store** › Store: a read-only TEXT field. `queryGraph` gives it no choices.
2. Query › **Source** › Search fields: text, "name, email, owner". Wanted: ticks of the fields.
3. Query › **Source** › Apply on: text, "change". Wanted: Change or Input (the page.v1 enum).
4. Query › **Condition** › Value, where the field's values are not known. "In the
   last" is typed as "7 day" in one field: wanted, a number and a Unit picklist.
   "Between" is typed as "a, b": wanted, From and To.
5. Query › **Condition** on a nested reading: read-only text, "2 conditions". Wanted: the tree itself (§4).
6. Query › **Presentation** on the View: every row is read-only text. Wanted: the same picklists, read only.
7. Workflow › **Filter** › Value: text. Wanted: the field's values, from the store.
8. Workflow › **Value** › Value: text with no type. It stays text (it IS the
   override, §5), but it needs a Type picklist beside it.

And rows that are only **words**: each Status value, and each field a Preset or
Saved filter writes.

**The Health node.** In the Node Editor (beta), on Records, the node "Health"
(kind `status`) shows three rows, each a string: At risk, "Score less than 60 or
Tickets at least 5"; Watch, "Score less than 80 or Tickets greater than 0";
Healthy, "every row the values before it left".

It comes from Demos' `customerHealth` (`app/stores/records-data.js`):
`statusFields(store, { health })` puts each value's `when` into
`store.domains.health.when` as one condition tree. `queryGraph` turns each tree
into words with `said()`. It lists strings because the graph has no Condition node
for a whole tree and no boolean socket to say "this value holds when…". The
"first value that matches" rule is not drawn at all: it lives only in the word
"before".

---

## 2. The socket types

| Type | Carries | Shape | Colour: the socket pins this Style mode | Sides |
|---|---|---|---|---|
| **value** | one value: text, a number, a date, a list | ● circle | `info`, its `--sherpa-style-indicator-accent` (blue) | in, out |
| **object** | a record, or rows | ◆ diamond | `active`, its `--sherpa-style-indicator-accent` (indigo) | in, out |
| **boolean** | true or false, for each data row | ▶ triangle, pointing the way the data goes | `success`, its `--sherpa-style-indicator-accent` (green) | in, out |
| **any** | whatever comes in | ■ square, not turned | none: the body ink it has today, `--sherpa-style-content-secondary` | in only |

- A fault colour (`critical`, `warning`, `urgent`) is never a type colour. It stays free to mark a fault.
- Each pin is a part pin in `scripts/figma-data/state-pins.yaml`
  (`'&[data-input-socket="value"] .socket-in': info`). It is not a colour rule (rule 8).
- An unrouted socket is hollow: its colour on the edge. A routed one is filled.
- A route line takes the colour of its output.

**Which input takes which output:** a value input takes a value, an object input
an object, a boolean input a boolean. An `any` input takes all three. To change a
type, put a node on the route: Pick (object → value), Count (object → value),
Condition (value or object → boolean).

**The rule for any.** A kind uses `any` only where its run reads every type the
same way: an Output, or a later Log or Store write. It keeps its square and its
grey when routed. Its words say what came in.

**Many connections.** An output always sends many. An input takes many only where
its row says how they join (`many` in the registry, D4):

| Input | Many routes join as |
|---|---|
| value | a list, in route order: three Value nodes into "Is one of" give three values |
| boolean (a row) | the node's own join: All of or Any of |
| boolean (When) | any of them: a data row any branch lets through |
| object | one set, each data row once (by its key), in route order |
| any | as the type that comes in; two types at once are refused |

Any other input takes one. A new route replaces the one there, as now.

**Never colour alone.** The shape says the type. Each socket has a tip with its
name and type ("True: a boolean"). The inspector says each route in words
("From Value › Value"). In forced colours, the colours go and the shapes stay.

**Where the type is said: one place.** `NODE_KINDS` says each socket's type.
`SocketCarries` becomes `SocketType = 'value' | 'object' | 'boolean' | 'any'`; the
old name goes in the same change (it is exported from `sherpa-ui/data`). A
workflow's JSON names sockets only, never types. `workflowFaults` checks each
route with one function, `accepts(output, input)`. In `schemas/defs.v1.json`, only
the words of `route` change, and `socket` also takes `node/#false`, the footer's
(`#` marks a part that is not a row, as the Query graph's `#filters` does).

---

## 3. Outputs: the row, the header and the footer

- **A row's output** sends a value or an object: its own value (a Field row sends
  the field name), or what the node made (Matches sends a count; Rows sends the
  data rows).
- **The header** keeps its two sockets, with new meanings. Its OUTPUT is **True**.
  Its INPUT is **When** (D1): a boolean. A node whose When has a route works only
  on what that branch lets through.
- **The footer** is new. It composes `sherpa-container-footer`, as the header
  composes `sherpa-container-header`. Its output is **False**. Later it may hold
  "+ Condition" (M4), the step's time and rows (now a caption over the card), a
  failed step's message and "Run from here" (both N4).
- **The data rows move from the header to a row**, **Rows** (◆ in, ◆ out), first
  on each kind that takes or gives them. A Store's Store row sends them; Source,
  Scope, Arrange and Presentation pass them on.

**What True and False mean: a fork in the road.** Each data row goes down one road.
On a Condition, True takes the data rows that hold, and False takes the rest. With
one value or one record, only one road is taken. On a node that is not a condition
(D2): True when it gave something (data rows came out, or a value); False when it
gave nothing. A fault is neither: the run stops there, and the node lights
`failed` (N2). Output and Component have no True and no False.

---

## 4. The Condition node

**One kind for both graphs.** The Query's `condition` and the workflow's `filter`
are one idea. `condition` serves both graphs, and `filter` goes (plan-695: one
shape per idea). Its `model` is `Condition`, the one tree in `store.ts`.

**One node is one group of the tree** (D3):

| Row | Control | Sockets |
|---|---|---|
| Rows | none | ◆ in (workflow only: in the Query, its scope gives the data rows) |
| Join | picklist: All of, Any of. Shown only with two or more conditions | — |
| Field | picklist: the source's fields (`source.fields`) | ● in, ● out |
| Operator | picklist: `OPS_FOR_TYPE[type]`, read by `OP_LABELS` and `DATE_OP_LABELS`; Is one of and Is not one of where the values are known | ● in |
| Value | by `OP_TAKES`: **list**, a picklist of the field's values (ticks for Is one of); **text**, a field typed by `typedValue` (for In the last: a number and a Unit picklist); **range**, From and To | ● in (many for a list) |
| …Field, Operator, Value again | one set per condition in the group, a subtle rule between sets | |
| Group | none | ▶ in, many: each nested group's True |
| Matches | none: how many data rows hold | ● out |

- Header: When ▶ in, True ▶ out. Footer: "+ Condition" and False ▶ out.
- **Nesting, as 692 allows:** `A or (B and C)` is two nodes: "Any of: A, Group",
  and "All of: B, C", whose True goes into the first one's Group row. One join per
  node, as the condition editor has (plan-695 P3).
- **An `off` part** is drawn greyed and kept, as the menu draws it.
- **In the Query graph,** each edit asks through `graphRequest`: the edited tree,
  made into a reading by `treeReading`. Nothing is new to the data layer. The
  True of a field's Condition goes into its scope's field row, which takes a
  boolean now. Presets and saved filters send their True into their `@` rows the
  same way.

**The Health node, as Conditions.** The status node keeps its Rows row (in and
out: each data row with its Health) and one row per value, each a boolean input.
A Condition node per `when`. False chains them: Watch is tested only on the data
rows that At risk did not take, as `statusFields` works it out. Each value row
shows its look (`critical`, `warning`, `success`), from `domain.statuses`.

```mermaid
flowchart LR
  subgraph health["Status field: Health"]
    rows["◆ Rows ◆"]
    vr["▶ At risk (critical)"]
    vw["▶ Watch (warning)"]
    vh["▶ Healthy (success)"]
  end
  store["Store: customers<br/>◆ Rows"] -- "◆" --> rows
  rows -- "◆" --> source["Source<br/>◆ Rows"]
  risk["Condition: At risk<br/>Any of: Score less than 60, Tickets at least 5"]
  watch["Condition: Watch<br/>Any of: Score less than 80, Tickets more than 0"]
  risk -- "▶ True" --> vr
  risk -- "▶ False → When" --> watch
  watch -- "▶ True" --> vw
  watch -- "▶ False" --> vh
```

These nodes are **read only**: the app's store owns them (the hint stays "The
app's store works it out: statusFields()"). To edit a status in the editor, the
status must first be a definition (defs.v1 has `statusField`). That is later, and
not in this plan. Each field a preset or saved filter writes becomes a Condition
node the same way, read only where the definition owns it.

---

## 5. Picklists and overrides

**One list per control, in one place.** Today `workflowGraph` and `queryGraph`
each build their choices (`DIRECTIONS` is written twice). One function in
`node-kinds.ts`, `rowChoices(row, facts)`, gives every list. Both graphs call it.

| Row | Its list | From |
|---|---|---|
| Field, Sort, Group, Primary, Secondary | the fields | `source.fields`; the Query adds what a scope holds |
| Search fields | ticks of the fields | `source.fields` |
| Operator | the type's operators | `OPS_FOR_TYPE`, `OP_LABELS`, `DATE_OP_LABELS` |
| Value (list) | the field's values | Query: `DataSource.valuesFor`; workflow: a new `WorkflowFacts.values`, from the store's `distinct` |
| Unit (In the last, In the next) | day, week, month, year | `Duration` |
| Direction | Ascending, Descending | one list |
| Show as | Default, Bar, Donut, Pie, Grid | `PRESENTATION_KINDS` |
| Apply on | Change, Input | page.v1's enum |
| Store | the app's stores | `WorkflowFacts.stores`; the Query gets the same fact |
| Join | All of, Any of | the tree's `and`, `or` |
| Value › Type | Text, Number, Date, True/false | `FieldType`, and boolean |

**An override: plug a text Value node into a picklist.** Every picklist row gets a
● input. A Value node routed into it overrides the pick, by Will's rule of
2026-10-29: a routed row MIRRORS what comes in, read only (D7). The row shows it
so:

- its input socket is filled, and a route line comes in;
- its picklist is read only and shows the custom value, with "Custom" after it
  (`workflowGraph` already adds an own value that a list does not have);
- the line under it says "Custom value, from Value › Value", on the canvas and in the inspector;
- cut the route, and the row's own pick is back. The draft kept it: off is not gone.

A Value node's value is known when the graph is drawn, so the canvas shows it
before N4 runs. A value that a node works out waits for N4.

**To make one:** drag out of a picklist's input socket onto the bare canvas. A
Value node is made there, with the row's value, routed in. With no pointer
(rule 21), the inspector row's "Custom value" button does the same. A workflow
gets two new edits: `{ add: WorkflowNode }` and `{ remove: id }`. **In the Query
graph** a Value node has no home (the Query holds only readings), so the graph
DRAWS one: a condition value the field's values lack is a derived Value node,
routed in. Each edit to it asks the reading.

---

## 6. How it maps to the code

| File | What changes |
|---|---|
| `src/core/data/node-kinds.ts` | `SocketType` (in place of `SocketCarries`); `accepts()`; `RowKind.many`; `NodeKind.branches` (True and False); a Rows row on each data kind; `condition` for both graphs, `filter` gone; `rowChoices()` |
| `src/core/data/workflow.ts` | `workflowFaults` checks by `accepts()` and `many`; routes into `node/#false`; v2, a v1 read once (D8); `editWorkflow` adds, removes, and keeps several routes into a `many` input; `WorkflowFacts.values` |
| `src/core/data/query-graph.ts` | routes go Rows to Rows; True into boolean rows; a reading's whole tree as Condition nodes (the "2 conditions" text goes); status values, presets and saved filters as Condition nodes; derived Value nodes; `QUERY_NODE` names a status value's node |
| `src/core/ui/node-graph.ts` | draws the footer and its socket; route lines typed by colour; picklists from `rowChoices`; a routed row shows the custom value; the drag out of an input socket; the inspector's "Custom value" |
| `sherpa-node`, `sherpa-node-row`, `src/core/sherpa-node-sockets.css` | four shapes; a part pin per type; hollow or filled; the footer slot (`sherpa-container-footer`) and its False socket; a tip per socket; forced colours. `SHARED_PROPS['data-input-socket']` and `['data-output-socket']` take the new values |
| `schemas/defs.v1.json`, `schemas/workflow.v1.json` | the `socket` pattern takes `#false`; the words of `route`; workflow `v: 2` |
| Demos | `app/workflows/active-customers.json` in v2, its Filter a Condition; the Node Editor's specs |

**What of N4 this plan covers.** 616 lists "typed sockets" in N4's scope. This
plan does that part whole: the types, their checks, their look, how many routes
join, and the rules a run must follow (the fork, When, the joins). It also gives
each Condition and status value a node id for `traceStep`.

**What N4 still needs:** `runWorkflow` itself. It runs each kind by its `model`, in
route order. It carries each branch as the data rows it lets through, matched by
row key. It writes live values into the rows (Matches, a routed Value). It also
needs cancel (an `AbortSignal`), a dry run, batch writes, and a `traceStep` per
node under one trace.

---

## 7. Phases

| Phase | Builds | Proves | Size |
|---|---|---|---|
| **M1** Types | `SocketType`, `accepts()`, `many`, `branches`, the `#false` address, `rowChoices()`; the checks | node tests: each type joins only what it takes; many routes join by their row | S |
| **M2** Sockets drawn | four shapes, the part pins, hollow or filled, the footer with False, tips, forced colours, route colours; specs, examples | `reforged-node.spec.ts` reads PIXELS for each shape; the a11y gate (`npm run test:a11y`) at or under its baseline | M |
| **M3** Rows carry WHAT | every data kind's Rows row; When and True on the header; False on the footer; `queryGraph` routes; workflow v2 and the v1 read | `a-query-is-drawn-as-nodes`; `a-workflow-is-its-definition` reads a v1 file as v2; Demos' Node Editor draws as before | L |
| **M4** The Condition node | one `condition` kind; Join, conditions, Group, Matches, True and False; a reading's whole tree drawn and edited through `ask()`; `filter` goes | node tests: `A or (B and C)` is two nodes, and an edit reads back the same tree; Demos: Active and Trial ticked still gives 49 rows | L |
| **M5** Status, presets and saved filters as conditions | the Health chain of §4; the conditions of presets and saved filters; read only | node tests: Health is 3 value rows and 2 Conditions, chained by False; the trace lights At risk with its 43 rows | M |
| **M6** Picklists and overrides | the rows of §1 as picklists; the Value node's Type; the custom value drawn; add and remove a node; the drag and the inspector button | Demos: a Value node "active" into Filter › Value shows "active Custom", read only; cut the route, and the own pick is back | M |

**Lanes.** M1 goes first and alone: every lane reads its types. Then M2 (the
components and CSS) and M3 (the data files and `node-graph.ts`) build at the same
time. Then M4 and M6, at the same time: they share `rowChoices()` from M1; M4 owns
the Condition's rows, M6 every other row and the override. M5 follows M4 in its lane.

```mermaid
flowchart LR
  M1["M1 Types · S"] --> M2["M2 Sockets drawn · M<br/>components, CSS, pins"]
  M1 --> M3["M3 Rows carry WHAT · L<br/>node-kinds, workflow, query-graph, node-graph"]
  M3 --> M4["M4 Condition · L<br/>workflow, query-graph"]
  M3 --> M6["M6 Picklists, overrides · M<br/>node-graph, Demos"]
  M2 --> M6
  M4 --> M5["M5 Status as conditions · M"]
  M5 --> N4["N4 runWorkflow (616)"]
  M6 --> N4
```

**What waits on N4:** everything that RUNS — live values in the rows, Matches as a
number, each branch lit with the data rows that took it, When that gates a run,
cancel, a dry run, batch writes (§6). M1–M6 only draw, check and edit.

---

## 8. Decisions for Will

| # | Question | A (my pick) | B |
|---|---|---|---|
| D1 | The header's input | **When**, a boolean: the header and footer say WHETHER, the rows say WHAT | It stays the data input; True and False go only into boolean rows, and cannot start a node |
| D2 | True and False on a node that is not a condition | True: it gave something (data rows, a value); False: it gave nothing; a fault stops the run | True: it ran; False: it failed (an error road) |
| D3 | A Condition node's shape | One node is one group: its join, then each condition's Field, Operator and Value; a nested group is its own node, into a Group row | One node is one condition; a separate All of / Any of node joins many |
| D4 | Many routes into one input | Only where the row says how they join: a list, All of or Any of, one set | Every input takes many, joined by its type |
| D5 | A socket's colour | It pins its type's Style mode, so a picked or running node does not change it | It follows its node's mode, as now (plan-78 node rows, decision 3) |
| D6 | The colour of True and False | Both the boolean green triangle: their place and their tips tell them apart | True green (`success`), False red (`critical`) |
| D7 | A custom value | The routed row mirrors it, read only, with "Custom"; cut the route and its own pick is back | The custom value joins the picklist, and stays after the route is cut |
| D8 | The workflows saved before this | Workflow v2: a v1 is read once into v2 (its header routes move to Rows rows) | v1 stays: a header route still means data rows (an alias) |
