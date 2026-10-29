# Plan 78 — a workflow on the data layer: load it, edit it, run it

Will, 2026-10-29: *"Then we will take a look at how we can leverage the data
layer to load definitions, edit routing and values, and execute a workflow
built through the Node Editor interface."* And TODO 551: *"Node positions, and
properties, should survive a page reload and only be lost on session end
unless the user has saved to the definition."*

**Status: RULED, 2026-10-29 — Will picked A for D1, D2, D3 and D4 (§7). Building W1–W5.**

## 1. What the data layer already has

Most of this is built. A workflow reuses it; it does not write a second copy.

| Need | Already in the data layer |
|---|---|
| A definition is JSON, and is checked | page definitions (`page-definition.ts`, `schemas/page.v1.json`), `validate.ts` |
| Where a definition is kept and saved | every `Store` — `ArrayStore`, `LocalStore`, `JsonStore`, `RestStore` — and `store.update` |
| Edits kept per tab, across a reload, gone at session end (551) | `SessionStore.persist(pointer, { shared: false })` — `sessionStorage`, as the filters' drafts are (`T-persist-defaults-per-tab`) |
| Read and write one value in a definition | `pointer.ts` — `getPointer`, `setPointer` |
| A Condition row's choices and words | `FilterOp`, `OPS_FOR_TYPE`, `OP_LABELS`, `DATE_OP_LABELS` (`store.ts`) |
| A Key row's choices | the field catalogue (`field-catalogue.ts`) |
| Run a Filter node | `filterTest` / `filterRows` with the clause `[key, op, value]` |
| Run Sort, Group, Count, Pick a key | `sortRows`, `groupRows`, `aggregate.ts`, `readField` |
| One run per tick, however many edits | `timing.ts` |

The sandbox's own Condition list is a second copy of `OP_LABELS`. W2 removes it.

## 2. The workflow definition

One JSON document, checked by a new `schemas/workflow.v1.json`.

```json
{
  "v": 1,
  "id": "active-customers",
  "label": "Active customers",
  "nodes": [
    { "id": "start",  "kind": "source", "x": 0,   "y": 0,   "store": "customers" },
    { "id": "status", "kind": "value",  "x": 0,   "y": 160, "values": { "value": "active" } },
    { "id": "filter", "kind": "filter", "x": 360, "y": 0,   "values": { "key": "status", "op": "eq" } },
    { "id": "end",    "kind": "output", "x": 720, "y": 0 }
  ],
  "routes": [
    { "from": "start",        "to": "filter" },
    { "from": "status/value", "to": "filter/value" },
    { "from": "filter",       "to": "end" }
  ]
}
```

- A SOCKET is `node` (the header's, the whole node) or `node/row` (a row's,
  by its field's `name`). `from` is an output socket, `to` an input socket.
- A node holds only what the reader can change: its place, its name and its
  values. What a node IS comes from its KIND.

## 3. A node KIND

A kind says a node's header (icon, name), its rows (name, label, field, and
which sockets each has, value or object), and how it RUNS. Each kind is data,
plus one `run` function.

| Kind | Rows | Runs |
|---|---|---|
| `source` | — ; out: object (the rows) | a store's rows |
| `value` | Value (text) → out: value | the typed value |
| `pick` | in: object → Key (select) → out: value | `readField` |
| `filter` | Key, Condition, Value (in: value), Matches (out: value) | `filterRows` with `[key, op, value]` |
| `sort`, `group`, `count` | Key, Direction / — | `sortRows`, `groupRows`, `aggregate` |
| `output` | in: object | the result, for a grid to show |

## 4. Draft, save and reload (TODO 551)

```
definition (in a Store) ──open──▶ DRAFT (SessionStore, this tab) ──Save──▶ definition
                                    ▲  every edit writes here                │
                                    └──── a reload draws from here ◀─────────┘
```

- Opening a workflow reads its definition. If this tab has a DRAFT of it, the
  draft wins: a reload loses nothing.
- Every edit — a move, a value, a route — is a plain function on the draft
  (`workflow-edits.ts`, as `query-edits.ts` is), kept at
  `/workflows/<id>` with `shared: false`. The tab's session ending drops it.
- **Save** writes the draft to the store and drops the draft. **Discard**
  drops the draft. The App Header's Save is this page's Save.

## 5. Routes

- A route joins an output socket to an input socket of the same kind (value to
  value, object to object). An input takes one route; an output, many.
- `checkWorkflow` reports what is wrong, never throws: a route to a gone
  socket, two routes into one input, a kind mismatch, a loop.
- A CONNECTED input's field shows the value that comes in, and cannot be
  typed in. Cut the route, and the typed value is back (off is not gone).

## 6. Running

- `runWorkflow(definition, { kinds, stores })` runs each node once, in route
  order, and returns each socket's value and the issues. It is DOM-free, in
  `src/core/data/`, so a server, a test or the MCP runs it too.
- The page runs again after each edit, once per tick, and writes each value
  where it shows: the Value row's incoming value, Matches' count, the output
  in a grid.

## 7. The decisions — Will

| | A (my pick) | B |
|---|---|---|
| **D1** Where a definition lives | A row in a Store, keyed by `id`: Demos uses a `LocalStore` now and a `RestStore` later. Save is `store.update` | A JSON file in Demos' `app/definitions/`, as a page's is. Save writes to the reader's own storage only |
| **D2** Who ships the kinds | The library ships the generic kinds of §3, each over its own data function. An app adds its own: Sherpa stays app agnostic | The library ships only the engine. The app writes every kind |
| **D3** Who draws and binds | A helper, `bindWorkflow(canvas, flow)`, in the app layer beside `bindSource`. It draws the nodes from the draft, hears `node-move`, `node-select` and each field, writes the draft, and runs. The components stay presentation only | A new `sherpa-node-editor` component that owns the canvas, the nodes and the inspector |
| **D4** How a route is made | A drag from an output socket to an input socket, and a drag off cuts it. With keys: Enter on a socket starts a route, the arrows pick a target, Enter joins. The socket becomes `sherpa-node-socket`, the line `sherpa-connector` | Routes are picked in the inspector only, as selects |

## 8. The work, one commit each

| Step | Builds | Proves |
|---|---|---|
| W1 | `schemas/workflow.v1.json`; `workflow.ts`: the types, the kinds as data, `checkWorkflow` | node tests: a good definition passes; each fault is reported |
| W2 | Demos loads `active-customers.json`; the nodes, rows and routes are DRAWN from it; Condition from `OP_LABELS`, Key from the field catalogue | the sandbox looks as now, from JSON; Chromium spec |
| W3 | `workflow-edits.ts`; the draft in `SessionStore` (551); Save and Discard | a move, a value and a route survive a reload; a new session starts from the definition; Save keeps them |
| W4 | `sherpa-node-socket`, `sherpa-connector`; connect and cut, by pointer and by keys; a connected field shows its input | Chromium spec; a11y |
| W5 | `runWorkflow`; live values in the rows; the output in a grid | node tests over the customers' rows; the counts match a Records filter of the same clause |

Not in this plan: running on a server (TODO 170 waits for Will), and a
workflow an agent writes (it writes this same JSON, later).
