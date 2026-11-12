# Plan 942: Custom Nodes, one way

Will, 2026-11-11, made plain 2026-11-12: "a standardised, single, way to create categories and types of custom nodes using
a JSON definition and node component". People and AI agents create, read, update and delete them the same way: in the
UI, by MCP tools, and by N-zo, which only calls the same doors. N-zo gets no node type of its own.

**Will, 2026-11-12: D1 A (the entity), D2 A (a JSON type is a sub-graph type), D3 A (check and describe), D4 A (sockets
renamed, retyped, removed).**

## Today (measured 2026-11-12)

- **Two shapes for one Custom Node.** A node-library definition (`schemas/nodes.v1.json`, `NodeDefinition`) and an entity
  of type `node` (`entity.v2` with `entity-node.v2` settings). Three converters join them (`asNode`, `definitionOf`,
  `nodeEntityOf`). No file holds nodes.v1 now: the library is built in memory from the entities (`libraryOf`).
- **Two shelves.** `EntityShelf` (`keeper.entities`) and a node view of it (`keeper.saveNode`, `removeNode`,
  `watchNodes`); `joinLibrary` is dead code. On one Demos Save, each changed Custom Node is saved TWICE.
- **Category in three places**, read in opposite orders: the entity's own, a `node`'s settings, its type's.
- **A TYPE is JS only.** `registerEntityType` (Demos' Runbook: fixed sockets, the Runbooks category) and `NodeKind`s
  (`NODE_KINDS`, `registerNodeTypes`). No JSON schema says a type.
- **The acts:** Save as Custom Node (`groupNodes`), Save graph as, New graph, Copy to my nodes, Update instances, Delete
  graph. Most doors are DOM-free and checked, but not all (`editDefinition`, `copyToMine` check nothing), and a Custom
  Node's sockets cannot be renamed, retyped or removed after it is made.
- **Agents.** The MCP serves the schemas, but no tool makes, reads or checks a Custom Node, and its workflow tools fault
  every use of one. N-zo saves `type: 'workflow'` only, and its node list leaves Custom Nodes out.

## The build

1. **One shape: the entity.** A Custom Node is an entity (`entity.v2`): `{ type, id, label, category?, tags?, graph,
   settings? }`. Its category is its own, else its type's; a `node`'s settings keep its sockets only. `NodeDefinition`
   stays as the editor's in-memory view; `nodes.v1.json`, the node shelf (`saveNode`, `removeNode`, `watchNodes`),
   `joinLibrary` and the second save go.
2. **A TYPE of Custom Node by JSON** (`node-type.v1.json`): `{ id, label, icon?, category?, inputs?, outputs?,
   families? }`. A Runbook is one: Runbooks, rows in, found out. An app lists its types in `app.json` (`types`) or
   registers them (`registerEntityType` takes the same JSON). The `node` type is the open one: each entity says its own
   sockets.
3. **A category** is a name: the shipped ones, and any a type or an entity names. The Nodes panel lists it, in its order.
4. **Doors, one per act, in the data layer**, checked as Save checks (`entityFaults`), each with its words when it refuses:
   `createNode(shelf, json)`, `readNode(shelf, id)`, `updateNode(shelf, id, change)` (its label, tags, category, sockets,
   graph), `deleteNode(shelf, id)` (`whyKept` first). Save as Custom Node, Save graph as, New graph and Copy to my nodes
   call them. A preset is read only; `canEdit` (936) says the rest.
5. **The UI** keeps its screens, through the doors; a Custom Node's sockets get rename, retype and remove.
6. **MCP** (see D3) and **N-zo** call the doors. N-zo's `save_graph` takes a `type`, and its node list gives Custom Nodes.

## Decisions for Will

- **D1. The one shape.**
  - **A (recommended):** the ENTITY. Demos, N-zo and the keeper store entities already; a node library is only built in
    memory. nodes.v1 and the node shelf go.
  - **B:** the node library (nodes.v1): entities stay for workflows and Preset Filters only.
- **D2. What a "type" can be.**
  - **A (recommended):** a TYPE is a JSON entity type: a category, an icon and fixed sockets, and each node of it is a
    sub-graph (as a Runbook). What a node does is its sub-graph, so no code is needed.
  - **B:** also a node KIND by JSON, with rows and controls and no sub-graph, drawn by sherpa-node and run by the app's
    own code. More open, but a runner must exist for each one.
- **D3. What the MCP tools do.**
  - **A (recommended):** check and describe: `check_custom_node(json)` says faults in words; the workflow tools take
    entities, so a use of one is no fault; an agent writes the JSON into the app's entities file itself.
  - **B:** also edit the app's entities file on disk: create, update and delete a preset there.
- **D4. Sockets after a Custom Node is made.**
  - **A (recommended):** rename, retype and remove an input or output, each one step, uses updated as Update does.
  - **B:** not now: a new socket comes only by a connection on a use's header, as today.

## Steps

1. Data: the one shape; `node-type.v1.json`; the four doors and their checks; category read one way; the node shelf, the
   second save, nodes.v1 and dead code gone. Tests for each door's refusals.
2. Editor: every act through the doors; the socket edits (D4).
3. MCP (D3) and its README; N-zo after the doors land: the peer sherpa-demos-67 builds its tool on them.
4. Demos: types from JSON (its Runbook), one save; specs. APP-GUIDE's Custom Nodes section.
