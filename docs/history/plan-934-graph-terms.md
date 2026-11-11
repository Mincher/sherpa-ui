# Plan 934: graph terms — Connection, Connector, Route, Branch

Will, 2026-11-11. Row [934](../TODO.md). **Ruled, and building: Will, 2026-11-11, *"Go with your picks for now"* —
D1–D5 are each A.**
Will chose a FULL rename (option A): words, code names and the saved key change in one planned change, with no alias
left behind (`T-a-rename-drops-the-old-name`).

## The ask

Will's words:

- *"A Connector indicates a Connection, not a Route."*
- *"A Route is a full path from Start node (e.g. Source) to an End Node (e.g. Output)."*
- *"A Branch is one of many Routes from a node due to multiple Connections."*
- *"We need to refactor this throughout sherpa-ui and sherpa demos. Otherwise the structure of the graphs will be
  miscommunicated by agents etc."*

## The words

One row per idea, for `docs/LEXICON.md` and PRINCIPLES 19.

| Word | Is | Today's name |
|---|---|---|
| **Connection** | One link from a node's socket to a node, or to one of its sockets: `{ from: 'node/socket', to: 'node[/socket]' }`. | route |
| **Connector** | The line drawn for one Connection. Its bends and zip ties are the line's. | route (in drawing code); connector (in comments) |
| **Route** | A full path along Connections, from a Start node to an End node. | path (`node-paths.ts`) |
| **Start node** | Where a Route starts: a Source; inside a Custom Node, its Group Input (D5). | `isSource` |
| **End node** | Where a Route ends: an Output; inside a Custom Node, its Group Output (D5). | `isOutput` |
| **Branch** | One of the Routes that leave a node with more than one outgoing Connection. | none |

The URL router's **route** (`sherpa-router`, `router.route`, the outlet) is another meaning. It keeps its word.

## Today (inventory, 2026-11-11)

| Where | Graph-link uses |
|---|---|
| `src/` | about 1,575 in 69 files; `node-graph.ts` 447, `workflow.ts` 246, `node-group.ts` 70, `node-portals.ts` 50, `query-graph.ts` 47, `node-kinds.ts` 40 |
| `test/` | about 1,354 in 103 files (unit 885, e2e 469); 116 test names; 3 file names |
| `docs/` (not history) | about 316 in 26 files; `traps/data-layer.md` about 105 |
| `schemas/`, `mcp-server/`, `scripts/` | 26, 43, 60 |
| Sherpa Demos | about 250: 6 shipped workflows, `entities.json`, `node-editor.js`, N-zo, 18 test files |

**Public names.** Types `NodeRoute`, `FlowRoute`, `RouteAnswer`; functions `keptRoutes`, `routeRequest` (all through
`sherpa-ui/data`); `markRoutes`, `pickedRoutes`; a `routes` property on 11 exported types; `WorkflowEdit`'s `route`,
`tie.routes`, `tieAdd.route`, `bend.route`, `unbend.route`; `DrawOptions` callbacks `onReroute`, `onBreak`, `onTie`, …
Files `route-bends.ts`, `route-path.ts`, `sherpa-node-routes.css`.

**Component API.** 10 attributes (`data-input-routed`, `data-output-routed`, `data-false-routed`, `data-inputs-routed`,
`data-outputs-routed`, `data-input-at-routed`, `data-output-at-routed`, `data-picked-routes`, …), 3 CSS states, 7 private
properties, the classes `svg.graph-routes` and `g.graph-route` (many specs select them), the report codes
`workflow-route` and `query-route`, and the words "Cut route from…" and "Routes". No part, slot or event uses the word.

**Saved data.**

| Where | Holds | Version |
|---|---|---|
| IndexedDB `sherpa-ui`, store `entities` | `entity.graph.routes` | entity v1 |
| Shipped files (Demos `app/workflows/*.json`, `app/entities.json`; library fixtures) | `graph.routes` | entity v1 |
| sessionStorage `sherpa:session:/workflows/<id>` | the editor's draft, `routes` | workflow v2. Its guard DROPS any value that is not v2 |
| sessionStorage `/node-edits/<id>` | edited Custom Node definitions, `routes` | v1 |
| `schemas/defs.v1.json` | `route`, `innerRoute`, `tie.routes`, `innerTie.routes`, `nodeDefinition.routes` | — |

There is no read-time migration today. The v1 → v2 workflow read was removed in `085dd2187` (2026-11-10). Its shape is
the template: `git show 085dd2187^:src/core/data/workflow.ts`.

## Clashes, and the rulings they need

**D1 — the portal's "connection row".** `connectionRow` / `connectionOf` (`node-portals.ts`, public) name a row that
holds a source's address, `@customers`. That is not a graph Connection.
**A (recommended): address row** — `addressRow`, `addressOf`. B: source row — `sourceRow`, `sourceOf`.

**D2 — Route and Branch as things the code computes.** Today nothing lists a graph's full Routes, and nothing names
a Branch. **A (recommended): add** `routesOf(graph)` (each Route as its node ids, Start to End) and
`branchesAt(graph, node)` (the Routes that leave a node with several outgoing Connections), DOM-free, beside
`routeRead`. The MCP's graph tools and N-zo's `read_graph` describe a graph by them, so an agent says "two Routes
branch at the Condition", not "two routes". B: the words only.

**D3 — a Condition's `branches`.** `NodeKind.branches` and `data-branches` mean a True/False fork. A fork is where two
Branches start, so the word fits the new meaning. **A (recommended): keep it.** B: rename to `forks`.

**D4 — Demos' Ticket output row `connection`.** It names the ticket system's account. It is a saved values key.
**A (recommended): `integration`, "Integration".** B: `account`, "Account".

**D5 — Start and End nodes.** **A (recommended):** a Start node is a Source, and inside a Custom Node its Group
Input; an End node is an Output, and inside a Custom Node its Group Output. A Value or a Field with no incoming
Connection starts no Route: it feeds one. B: any node with no incoming Connection starts a Route, and any node with
no outgoing Connection ends one.

## The rename, layer by layer

**Data, saved and on the wire.** `graph.routes` → `graph.connections`; `route` → `connection` (an edit, a bend, a
tie's); `tie.routes` → `tie.connections`; `innerRoute` → `innerConnection`; `nodeDefinition.routes` → `connections`.
Entity v1 → **v2**, workflow v2 → **v3**, `defs.v1.json` → **v2**, each a new schema file. A versioned read converts
the old ONCE: an entity v1 (IndexedDB, a shipped file, an import), a v2 draft and a `/node-edits/` definition are read
as the new version, and written back in it. The draft guard accepts a v2 and converts it: a reader's unsaved draft is
never dropped. The old key is read only by that migration: it is never written, and no API takes it.

**Types and functions.** `NodeRoute` → `NodeConnection`, `FlowRoute` → `FlowConnection`, `RouteAnswer` →
`ConnectionAnswer`, `keptRoutes` → `keptConnections`, `routeRequest` → `connectionRequest`, `markRoutes` /
`pickedRoutes` → `markConnections` / `pickedConnections`; every `routes` property → `connections`; the callbacks
`onReroute` → `onReconnect`, and the rest by the same rule. The drawn line is the Connector, so the drawing files
take that word: `route-bends.ts` → `connector-bends.ts`, `route-path.ts` → `connector-path.ts`,
`sherpa-node-routes.css` → `sherpa-node-connectors.css`.

**Component API.** "Has a Connection" is `connected`: `data-input-routed` → `data-input-connected`, and so on for the
10 attributes, the 3 states (`false-routed` → `false-connected`, `not-input-routed` → `not-input-connected`, …) and the
7 private properties. `data-picked-routes` → `data-picked-connections`. The drawn lines: `svg.graph-routes` →
`svg.graph-connectors`, `g.graph-route` → `g.graph-connector`. `[data-unrouted]` → `[data-unconnected]`. Report codes
`workflow-route` → `workflow-connection`, `query-route` → `query-connection`. Words: "Cut route from…" → "Cut
connection from…", "Routes" → "Connections". The specs, `custom-elements.json` and `vscode.html-data.json` regenerate.

**path → Route.** After the rename above frees the word: `node-paths.ts` → `node-routes.ts`, `PathRead` →
`RouteRead`, `pathRead` → `routeRead`, `PathFacts` → `RouteFacts`, the toolbar's `data-path-why` →
`data-route-why`, and the "path" tests. With D2 A, `routesOf` and `branchesAt` join them.

**MCP.** `edit_workflow`'s edit key `route` → `connection`; `workflow_graph` takes `{v:3, id, nodes, connections}`;
`query_graph` says "N connections"; the descriptions, the README, `skills/explain-page`, and the schema resource's
text (v2 → v3; the resource already serves the newest file).

**Docs and traps.** The LEXICON rows, PRINCIPLES 19, the traps' prose (no trap id holds the graph word), APP-GUIDE and
DATA-SOURCE-RULES. The component reference regenerates. `docs/history/` stays as written: it is the record.

**Tests.** The hits, the 116 test names, and 3 file names: `a-route-bends-…` → `a-connector-bends-…`,
`any-route-joins-any-input` → `any-connection-joins-any-input`, `a-zip-tie-funnels-routes` →
`a-zip-tie-funnels-connections`. The router's tests keep theirs.

**Sherpa Demos.** The 6 shipped workflows and `entities.json` in the new form, `node-editor.js`, N-zo (`save_graph`
takes `connections`; its system prompt and tools say Connection, Route and Branch, and with D2 A `read_graph` gives
the Routes and Branches), the tests, `docs/TRAPS.md`, and D4.

## Steps

Each step is one commit with both suites green. A step that changes the wire changes both repos together.

| Step | Does | Proves it |
|---|---|---|
| S0 | The LEXICON rows and PRINCIPLES 19, with D1–D5 ruled | Will's yes |
| S1 | Data: the types, functions and keys; entity v2, workflow v3, defs v2; the versioned read; the shipped files of both repos | a v1 entity in IndexedDB, a v2 draft and a v1 node edit, read after the change, keep every Connection; `npm test`, Demos `npm run test:node` |
| S2 | Drawing and components: the attributes, states, classes, report codes and words; the specs regenerated | the e2e suites, three engines |
| S3 | path → Route; with D2 A, `routesOf` and `branchesAt` | unit tests over the shipped workflows: their Routes and Branches |
| S4 | The MCP server | its tests; `check-mcp-pack` |
| S5 | Docs and traps | `check:traps`, `check:docs` |
| S6 | Demos: `node-editor.js`, N-zo, D4, the tests, TRAPS | Demos `npm test`; N-zo describes a graph by its Routes |
| S7 | A gate, so the old word does not come back: "route" in graph files fails `lint`, the router's files excluded | the gate fails on a planted "route", and passes after |

## Risks

- **Another session edits `node-graph.ts` most days.** S1–S2 need it free, or one session does them. Each step starts
  from a clean tree and says so on the ledger.
- **A reader's unsaved draft.** Today a draft that is not v2 is dropped without a word. The migration converts it, and
  S1's test proves it.
- **Volume.** About 3,000 changes in tests and code, mechanical but many. The router's files are excluded by name,
  and each step's diff is read whole before it is committed.
