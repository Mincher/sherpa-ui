# Plan 1008: nothing bespoke for one app — what Sherpa Demos does by hand moves into sherpa-ui

Will, 2026-11-15: "I want to ensure that this is all built off of the same core system and that there's nothing bespoke
going on just for Sherpa Demos. The whole inclusion of Graphs into the Data layer, alongside Sources, Stores, Filters,
and Queries, is to make it part of the foundation of a data driven, yet agnostic, application framework."

**Status: a read-only sweep of Demos (app/, server/) and the library (src/, mcp-server/) by sherpa-demos-67,
2026-11-15; two of its findings checked again by hand. One pick for Will (section 4). Nothing built. Owners:
sherpa-ui-e8 (nodes, the editor, agents), sherpa-ui-a9 (the data layer, the shelf, types), sherpa-demos-67 (the plan,
Demos moves onto each door).**

## 1. What is right today

The app gives its own content through the library's doors almost everywhere: its acts and flows (registerAct,
registerFlow), its node types (registerNodeTypes), its step words (registerStepWords), its type code (registerTypeCode),
its types as JSON (app/types/*.json), its AI catalogue, its stores (defineStores), its rights (the outlet's `may`).
Nodes, kinds, the drawing, the editor, Unfurl, places, versions, the Query lens and the stores are the library's.

## 2. What the app does by hand that any app would need

| # | Gap | Where in Demos (by the sweep) | The door it becomes | Owner |
|---|---|---|---|---|
| G1 | **Agent tools** (about 750 lines): page, source, query, act, flow and shelf tools, their handlers, a flow step drawn in the chat, hidden-text cleaning. Every library feature is taught here again by hand. **Bug, checked:** its own store map (actions.js:30-35) has no `user`, `group` or `role`, so off screen an agent is told "This app reads no store user" | experiments/nzo-claude/tools.js:133-259, actions.js, nzo-claude.js:109-135 and 485-512, clean.js | One library agent-tools door over the outlet (definitions and handlers), with 1005's words from each kind | e8, with 1005 |
| G2 | **No one list of stores, fields and store words**: five copies, already drifted; the record and device types patched with copied values (against PRINCIPLES 25) | index.html:745-750, actions.js:30-35, node-editor.js:56-69 and 82, prompt-facts.js:37-38 and 50, coworkers.js:20; records-data.js:26-34, devices-data.js:22-25 | The outlet's stores and each type's fields, read once; a customer is `ref: 'customer'` | a9 |
| G3 | **Seeding of graph entities, three ways**: the outlet's loading run again, Coworkers seeded with their own marks in localStorage, the shipped workflows saved once; types in entities.json get no store; the library's seedEntities does not follow uses | index.html:727-736, coworkers-data.js:142-159 and 288-296, entity-types.js:35-41 | The outlet's own loading takes seeds from code, a `row` hook, and marks in the session; seedEntities follows uses | a9 |
| G4 | **A text worked out from a graph, kept in step by app code** (a Runbook's prompt: a second truth, its key, an agent hook, its reference check with facts listed by hand) | runbook-prompt.js:66-79, runbook-sync.js, runbook-type.js:16-24, prompt-facts.js | A door for a setting derived from a graph (its key kept, in step or not, an agent hook), run by the library; the reference facts built from the shelf, the stores and the types | a9, e8 |
| G5 | **Records' Add, Edit and Delete bypass the record type's acts**: they write the store, never ask `may`, keep their own defaults | contexts/records.js:100-185 and 292-368 | The type's acts through outlet.act and a flow for the form; defaults in record.json | sherpa-demos-67 (the door exists) |
| G6 | **The node editor's host code** | contexts/node-editor.js | (row 1006, known) | e8 |
| G7 | **An agent's words for each node** | experiments/nzo-claude/tools.js | (row 1005, known) | e8 |
| G8 | Smaller: a Coworker's schedule kept twice (settings and its Trigger); the app knows the provider's Filter naming; uses read by splitting kind names; a type's editor View named by hand; filter ops copied; five copies of page size and Find wiring; a details panel and a row page per context | coworkers-data.js:299-304, index.html:478-492, coworkers-data.js:244-257, coworkers.js:171 and 180, tools.js:27-33, records/devices/coworkers/row-page.js | Each through the door the sweep names (a type field `from: '<trigger>/…'`, provider.saveFilters, usesOf, the type's View, the ops from defs.v1, a find and a details binding) | as each |

## 3. What the library knows that belongs to one app

| # | Leak | Where | The way out | Owner |
|---|---|---|---|---|
| L1 | **The shipped Alert type** says "on a device or customer", with On: Device or Customer (checked) | src/core/data/node-kinds.ts:426-431 | Drop `on`, or make it a row of an entity or a ref; an app adds its own through registerNodeTypes | e8 |
| L2 | **"Runbooks" hard-coded**: always offered, given the Custom lane and an ink; an Experts or Coworkers node gets neither | node-kinds.ts:896, entity-types.ts:38-42, node-lanes.ts:48, sherpa-node-look.css:47 | Read each graph type's `category` from entityTypes() | e8 |

No app paths or URLs are in library logic. The other domain words in the library are in examples, comments, tests and
default labels (fine).

## 3b. The traps (sherpa-ui-a9, 2026-11-15)

| # | For | Trap | The way out |
|---|---|---|---|
| T1 | G2 | A new list Demos keeps would be a sixth copy | Read the one list from what exists: the outlet's stores (defineStores) and each type's fields (typeFields, storeOfType) |
| T2 | G2 | A store with no type has no word in the library today | Say where its word comes from (its defineStores entry), or it becomes another copy |
| T3 | G2 | Reading every store's values at app start costs a request per field on a remote store | Read values lazily, one field at a time, as 986b does when a graph opens |
| T4 | G2 | A copied customer value becomes `ref: 'customer'` (995's refWhere narrows it), but a chip or a Field's Values on a ref field must show the other type's rows by their titles, and the field catalogue reads no ref's store today | A new door, a9's part |
| T5 | G2 | The server and the Service Worker need the same list | Keep it DOM-free, in the module both import |
| T6 | G3 | A use names an entity that is not there yet, and faults | Seeds go in use order: a used Custom Node before the graphs that use it |
| T7 | G3 | A type from entities.json has no store | Its store comes from the type registry (registerEntityType), never from a list beside it |
| T8 | G4 | A move would mark a derived text stale | Its key is what the graph does (hashOfDefinition, no places) |
| T9 | G4 | Reference facts listed by hand | They come from refFacts (988), through the stores and the shelf |

Found on the way (a9): TODO 1009, a seed's marks hashed the whole entity, places too, so one move froze a seeded copy for good; fixed at 9e9bdddfd (a mark hashes what the entity does). Demos' one-off app/retrofit-1009.html puts each unchanged seeded Coworker again with a mark of the new rule.

## 4. Will's pick

- **A (sherpa-demos-67's pick): do G1–G5 and L1–L2 next, before plan 991's other new nodes** (For each, Wait, Approval,
  Guardrail…). Each new node today adds to the copies by hand (G1, G2, G7), so the copies grow with every node.
- **B: after the new nodes.**

## 5. Phases (once picked)

| Phase | Does | Owner |
|---|---|---|
| 1008a | G2: one list of stores and fields (fixes G1's Users bug at its root) | a9 |
| 1008b | L1, L2: the Alert type and the Runbooks category | e8 |
| 1008c | G1 with 1005: one agent-tools door, the kinds' words | e8 |
| 1008d | G3: seeding, by the outlet | a9 |
| 1008e | G4: a derived setting, kept by the library | a9, e8 |
| 1008f | G5 and G8, and 1006: Demos onto each door | sherpa-demos-67, e8 |

## 6. 1008c's G1: one agent-tools door, a design (sherpa-ui-35, was e8; 2026-11-15)

**Read (N-zo, sherpa-demos side, read only):** 15 tools, their words in `tools.js` and their handlers in `actions.js`:
`get_app`, `on_screen`, `open_page`, `describe_page`, `read_rows`, `summarize`, `filter`, `use_preset`, `arrange`,
`clear_filters`, `node_kinds`, `flow`, `act`, `offer_actions`, `undo`; and the graph words, which 1005 now makes from the
kinds (`graphRules`). The handlers already call the library's doors (`openSource`, `nodeKinds`, `entityTypes`, the
outlet's acts): the door is mostly moving them, with their words, into the library.

**The door:** `agentTools(outlet)` gives `{ tools, run(name, input), rules() }`: each tool's input schema and words, a
handler over the outlet's own doors (its pages, a page's source, its acts and flows, the shelf), and the rules an agent
reads (the app's words, then `graphRules`). An app adds its own tools beside them; a tool it does not want, it leaves out.

| Tools | Whose | Why |
|---|---|---|
| `get_app`, `on_screen`, `describe_page`, `read_rows`, `summarize` | the library's | they read the outlet and a page's source |
| `open_page`, `filter`, `use_preset`, `arrange`, `clear_filters` | the library's | a page's Query and the router's doors |
| `node_kinds`, and the rules | the library's | the kinds and `graphRules` (1005) |
| `act`, `flow` | the library's | `outlet.act` and the flow lens; a flow's step is asked of the app (a callback) and answered back |
| `offer_actions`, the chat, the model call | the app's | its own screen and its own agent |

### The choices, for Will (my pick first)

- **D1, where the door lives.** A (my pick): `sherpa-ui/app`, beside the outlet: it needs the outlet and a page, which the
  data layer may not touch. B: the data layer, with an adapter in the app layer.
- **D2, Undo.** A (my pick): the app's: the door tells each change it made (`onChange`, with what was there before), so an
  app keeps its own history, as N-zo does. B: the door keeps a history of its own and offers an `undo` tool.
- **D3, the MCP.** A (my pick): the MCP keeps its own tools (it runs with no browser), and a tool both have takes the same
  words from one place. B: one set of tools for both, the MCP running them over a page it opens.

**Will's picks, 2026-11-16: D1 A, D2 A, D3 A.**

### Phases

| Phase | Builds | Who |
|---|---|---|
| 1008c1 | The door, its read tools (`get_app` … `summarize`, `node_kinds`, the rules), a test over a harness outlet | e8 |
| 1008c2 | Its tools that change what a page shows (`open_page` … `clear_filters`) | e8 |
| 1008c3 | `act` and `flow`, a flow's step by a callback | e8 |
| 1008c4 | N-zo onto the door: its `tools.js` and `actions.js` go, but its own | sherpa-demos-97 |
