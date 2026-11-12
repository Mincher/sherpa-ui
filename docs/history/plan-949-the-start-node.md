# Plan 949: The way in and the way out — the Start node and the Output Trigger

Will, 2026-11-12 (relayed by the peer sherpa-demos-67): "I realise that for Trigger nodes to work, a graph should
probably have a 'Start' node that has an input for triggers. This start node is a catch all representation of the
coworker entry point. I don't think it needs to 'do' anything."

Will, 2026-11-12, later (relayed by the peer): "I noticed that you made Coworker graphs into custom nodes in the Nodes Panel
in the Node editor. At this stage, I don't think that 'Coworkers' will be reusable nodes. It should be Experts & Runbooks
that are reusable within Coworker graphs. A Coworker may call another Coworker but we shouldn't nest it's graph as a node in
another Coworkers graph. Instead we should have 'Output Trigger' nodes that can be set to 'Run Coworker' and an available
Coworker is then chosen from a dropdown. This opens up the ability to trigger other things from the end of a graph run as
well as starting a graph from a trigger. We will need to prevent infinite loop scenarios where the input and output
triggers are cyclical. A warning and block of the node will be needed."

**Will, 2026-11-12: D1 A (the Trigger's header True), D2 A (the Start sends nothing), D3 B (always there), D4 B (the
library ships event types too), D5 A (a loop warns and blocks its nodes; the graph saves).**

## Today (measured 2026-11-12)

- **A Trigger (941) has no header socket.** What it heard leaves only by its type's rows (Asked by, At, Message …). Since
  plan 944 a header sends a boolean or nothing, so its header sends nothing.
- **A Trigger is a Start node** (`isStart`: a Source or a Trigger). PRINCIPLES 19: "Start node: where a Route starts: a
  Source or a Trigger; inside a Custom Node, its Group Input".
- **In Demos, each Coworker graph has one schedule Trigger, alone.** Its rows go nowhere. The data starts at a Source
  (Devices), and its Routes run from there to the Outputs.
- **A Custom Node's body has an entry point already:** its Group Input (`#in`). A top graph has none.
- **Every entity is a node** (746 E5): `asNode` offers each one in the Nodes panel. Demos' 12 seed Coworkers fill its
  Custom tab, and one Coworker can be placed in another's graph.
- **No Output starts anything.** The Output families (917) notify, request, write and end a run. A row picks from a fixed
  list, the store's fields, or the app's catalog (`catalogChoices`); none picks an entity.

## The build

**The way in: the Start (D1 A, D2 A, D3 B).**

1. **Every top graph has a Start**, always there and not removable, as a Custom Node's body has its Group Input. It is
   `#start`: drawn from the graph each time, at the left; its connections are kept, and the node is not. A graph with a
   Group Input has none: that is its entry point.
2. **Each Trigger joins it:** a Trigger's header sends **True** when it fires (a header sends a boolean, plan 944). The
   Start's header takes many. It has no settings and sends nothing. A Trigger not joined to it warns: "Connect it to the
   Start". A warning blocks nothing.
3. **The words** (PRINCIPLES 19). **Start**: a top graph's entry point; its Triggers join it; it sends nothing. A Route
   still starts at a Source or a Trigger, by its rows: the Start is no Start node.
4. **Simulate** says at the Start what would start it: "Would start on Task schedule · Every day". It runs nothing.

**The way out: the Output Trigger.**

5. **A type may say its entities are not reusable:** `reusable: false` (`node-type.v1`, `registerEntityType`). They are
   not in the Nodes panel, and a graph that places one is refused, in words: "a Coworker is not reusable: start it with an
   Output Trigger". Experts and Runbooks stay reusable.
6. **An Output Trigger family**, in Output (917): it starts something when the run reaches it. The library ships one
   type for each event a graph can make a Trigger hear (D4 B): **UI event** (Event), **Task status** (Task, Status) and
   **AI message** (From, Says). A User action, a schedule and an API response come from outside, so no Output makes
   them. An app adds its own: Demos adds **Run Coworker**.
7. **A row that picks an entity:** `control: 'entity'`, `of: '<type>'`. Its choices are the shelf's entities of that
   type, in step with the shelf, as a dropdown. Run Coworker's Coworker row is one.
8. **No loop (D5 A).** Each Output Trigger is a line from its graph to what it starts: the entity its entity row
   picks, or each graph with a Trigger that hears its event (the same type, and each row the Trigger names the same;
   a row it leaves blank hears any). A ring of lines across the shelf (A starts A; A starts B, B starts A) is a loop.
   Each Output Trigger in it warns and is blocked: it starts nothing. The graph still saves.

## Decisions for Will

**All five decided (above).**

- **D1. How a Trigger joins the Start.**
  - **A (recommended):** the Trigger's header sends **True** when it fires (a header sends a boolean, plan 944). One
    line from each Trigger, of any type, into the Start.
  - **B:** the Start takes one of the Trigger's rows: what it heard (Asked by, At, Message …). The line starts at a
    different row for each type.
- **D2. What the Start sends on.**
  - **A (recommended):** **nothing**, as you said: it is the entry point only. The data still starts at a Source, and
    a Trigger's rows still give what it heard.
  - **B:** what it heard, on one row, **Event**, from whichever Trigger fired: a Prompt can read who asked.
- **D3. Where the Start comes from.**
  - **A (recommended):** the reader places it from the Nodes panel, as any node: one per graph.
  - **B:** every top graph has one, always there and not removable, as a Custom Node's body has its Group Input.
- **D4. The Output Trigger's types.**
  - **A (recommended):** the library ships the family with **no types**; an app adds its own (Demos: Run Coworker),
    each with a row that picks an entity. The loop check reads those rows.
  - **B:** the library also ships one type per event a Trigger hears (UI event, Task status, AI message), so one graph
    can start another graph's Trigger. The loop check then follows events too.
- **D5. What a loop does.**
  - **A (recommended):** each Output Trigger in the ring **warns and is blocked**: it will not start anything. The graph
    still saves (a graph stays open).
  - **B:** it warns, and the **Save is refused**, in words, until the loop is broken.

## Steps

1. Data: `#start`, the Trigger's header True, the warning; `reusable`; the Output Trigger family; the `entity` row; the
   loop check (D5); the schemas; PRINCIPLES 19.
2. Editor: the Start drawn in each top graph; the panel leaves out what is not reusable; the entity dropdown; Simulate's
   line; tips in few words.
3. Tests in three engines; then the names to the peer, who does Demos: Coworkers not reusable, Run Coworker, a Start and
   Output Triggers in the seed Coworkers, N-zo's rules.
