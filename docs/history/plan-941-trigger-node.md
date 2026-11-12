# Plan 941: The Trigger node

Will, 2026-11-11: "We should have a Trigger node that allows the user to choose a trigger type (user action, UI event,
Task schedule, Task status, AI message, API response) that acts as a listener. This will be used in a Coworkers … to
listen for the trigger conditions and start the node graph process. A Task is a concept that we don't need to worry about
just yet. They are essentially queued, or scheduled, async jobs for centralised handling and tracking. We're just adding
it to illustrate that they can be used to trigger a Coworker's graph execution."

## What the peer said (acp-module-82, Harness)

- A **Coworker** wraps a Runbook, a model and Experts, with a trigger, guardrails and a trust level. Each version has
  ONE top-level graph.
- **The server listens, not the UI.** The Trigger node stores only its config: its type, and what it listens for.
  Simulate may fake one.
- The runtime has three kinds: `on_demand`, `scheduled` and `event` (`TriggerConfig`). A Coworker that a trigger starts
  cannot also run on demand.
- In Figma, the graph's start node is **"Event"**, in Sources, with no input socket.

## Today

- A Route starts at a **Start node**: a Source, or a Custom Node's Group Input (`isSource`, PRINCIPLES 19).
- Nothing in a graph says how a graph starts. Simulate starts at the Sources.
- Sherpa runs no graph (N4 is held). Simulate never fires an Output, and an AI node answers with a stand-in (926).

## The build

1. **A Trigger kind, a family with Will's six types.** Each type maps to one runtime kind, and the node stores it:
   | Type | Runtime kind | Its rows (what it listens for) | Its properties (what it sends) |
   |---|---|---|---|
   | User action | on_demand | Label (the button's words) | Asked by |
   | UI event | event | Event (the app's list) | Event, At |
   | Task schedule | scheduled | Every, At (or a cron line) | At |
   | Task status | event | Task, Status | Task, Status |
   | AI message | event | From (an agent), Says | Message, From |
   | API response | event | Endpoint, Status code | Response, Status code |
2. **A Start node.** No input socket. Its header sends the event as an object. A Route may start at it (`isSource`),
   and PRINCIPLES 19 says so: "Start node: a Source, a Trigger; inside a Custom Node, its Group Input".
3. **The app says what can be heard**, as the AI catalog does (926 D1): `registerTriggerCatalog({ events, tasks,
   agents, endpoints })`. Sherpa ships none. With none registered, a row is typed text.
4. **Simulate fakes it.** A Trigger sends a stand-in event by its type, as an AI node does. It says what it would hear:
   "Would start on Task status: Patch run · Failed".
5. **The listener is not built.** The definition holds the config, and a server reads it. A Task is named only.

## Decisions for Will

**Will, 2026-11-11: D1 B (a new Triggers category), D2 B (many Triggers; any one starts the graph).**

**Built 2026-11-12.** One change from step 2: since plan 944 a header sends a boolean or nothing, so a Trigger's header
sends nothing; what it heard leaves by its rows, and a Route starts there by them. The AI catalog holds the Trigger
lists too, read by one `catalogChoices`.

- **D1. Where the Trigger sits in the Nodes panel.**
  - **A (recommended):** in **Sources**, beside the Source, as Figma's "Event" does. Both start a Route.
  - **B:** a new **Triggers** category, first in the list.
- **D2. How many Triggers a graph may hold.**
  - **A (recommended):** **one**. A second one warns: "A graph starts from one Trigger". This matches the runtime
    today: one trigger per Coworker version.
  - **B:** **many**. Any one of them starts the graph.

## Steps

1. The data layer: the Trigger family and its rows; `isSource`; `registerTriggerCatalog`; the one-Trigger warning (D2);
   Simulate's stand-in event.
2. The editor: the panel item (D1), the node's look by its category, tips in few words.
3. The schemas: the workflow and entity schemas take a Trigger node. The MCP serves them.
4. Tests in three engines. Demos registers a small catalog, and one shipped graph starts from a Trigger.
