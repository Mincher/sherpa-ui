# Vision — node graphs build reusable entities (Will, 2026-11-05)

Logged as Will wrote it, before any planning. Will first deals with the open decisions
(plan-749's D1–D9, the Views and Save row 746, and the smaller ones in the TODO); then the
planning starts (TODO 750). Nothing here is a decision. It is the direction.

## The idea

Node graphs can build different THINGS, not only filters. Each thing is a reusable,
deterministic ENTITY of a TYPE: a graph plus the type's own settings. An entity can use
another: a UI Card uses a Preset Filter (a graph saved as a Custom Node), and a View uses
that UI Card.

**What an app could build and reuse today** (Will's list):

| Entity | What it holds |
|---|---|
| View definition | The View type (a Layout grid for example), the UI Cards it shows, each card's column and row span |
| UI Card definition | Presentation type, data source, filter options |
| Preset Filter definition | Source, fields, conditions |
| Notification | The kind (email, in app, mobile), recipients, name, description |

**Future entities** (Will's list):

| Entity | What it holds |
|---|---|
| UI Pattern | A series of interface steps from A to B with the outcomes the user needs (click a trigger, show a dialog, complete a form, submit, show the outcome in a toast) |
| Form | Fields, conditional fields, optional vs required, the submit action, the output |
| Workflow | A business process, e.g. user onboarding: add the user to a role and a group, assign licences, email other staff |
| Script | Run commands, handle the responses, present the outcomes |
| Scheduling | Do something at a moment or on a cycle; notify; track status |
| Policy | "A graph kinda is a policy": sources, conditions, exceptions, scheduling, actions. Conditional access, on- and off-boarding. Very broad: at least a Policy TYPE is a useful entity to build on |
| Monitor | Connect a device or source, set trigger conditions, use a schedule, present the output or an alert |
| Report | Gather, compile and present data in a defined format |
| Agent Harness | Choose a service and a model, add guardrails, connections and tooling, NODE GRAPHS FOR DETERMINISTIC OUTPUT, token spend limits |

## What Will asks for

"Solid generics for creating entities of a type, building out their graphs, CRUD management
of those graphs and entities, and solid standards and interoperability."

## The foundation Will sees already

Definitions (JSON, checked by a schema), HTML templates, the data layer, service workers,
nodes. "It's all starting to come together, but we need to plan!"

## Questions the planning has to answer (mine, not Will's)

1. What an ENTITY is in the code: one definition shape (`{ type, id, label, graph, settings }`)
   or one schema per type? How a type is declared (a registry, like `NODE_KINDS`).
2. How an entity USES another (a reference by id; a node of the entity's kind, like a Custom
   Node's use): versions and the update flow (D11 of plan-713) for entities.
3. CRUD: where entities live (the keeper's named parts like saved nodes? the app's server?),
   who may edit (per user later), import and export.
4. The graph per type: which node families a type allows, and the type's own input and
   output sockets (a Preset Filter outputs a condition; a UI Card outputs a presentation).
5. The runner (N4): which entity types RUN (Workflow, Script, Schedule, Monitor, Agent
   Harness) and which are only DEFINED (View, Card, Filter).
6. The editor: one canvas for all types, the type picker, the Views chip listing entities
   (TODO 746: graphs as views).
7. Standards: a schema per type, a shared envelope, and the MCP's tools for them (plan 700
   is parked until nodes are done).
