# Plan 951: One model for the whole graph

Will, 2026-11-12 (relayed by the peer sherpa-demos-67): "Provider and Model tweaks:
- Can probably be 1 node with 2 input rows. Always need both.
- If a top level graph has this node plugged into it's Start node then every AI node in this graph AND nested sub-graphs
  will use this provider an model UNLESS explicity overridden with a provider and model connection specifically to an AI
  node.
- Graph metadata in the Details panel should show all Providers and Models used through the whole graph and sub-graphs
  with the primary choices as the first item.
- We should have a Graph Details tab for this metadata at all times in the panel. Will be the only tab when no node is
  selected."

**Will, 2026-11-12: D1 A (the Graph details tab last), D2 A (the models only).** **Builds on 949: the Start.**

## Today (measured 2026-11-12)

- **Two nodes for one choice** (926): a Provider node, then a Model node that takes it. Each AI node (Prompt, Runbook,
  Skill) has a Model row; with none joined it is null, and the node warns.
- **In Demos, every seed Coworker, Expert and Runbook** wires Provider → Model → each AI node's Model row.
- **The inspector with no node picked** shows an empty state, "No node selected", and no tabs. With a node picked:
  Details, and Output, JSON and Data where it has them.

## The build

1. **One Model node, two rows: Provider and Model.** Both are needed: with either one blank, the node warns. It sends the
   pair on, as the Model node does today. The Provider node goes; Demos' graphs change (the peer).
2. **The Start takes a Model** (a row on the Start): that pair is the graph's **primary** model.
3. **Every AI node uses the primary**, in this graph and in every Custom Node inside it, at any depth, unless a Model is
   joined to its own Model row. That is an override, in a sub-graph too. An AI node with neither warns, as today.
4. **An AI node says which it uses**: its Model row shows "Anthropic · Sonnet, from the Start" where it uses the primary.
5. **One door:** `graphModels(workflow, library)` gives the primary and every other pair used, in the graph and its
   sub-graphs, each with how many AI nodes use it. The tab reads it; so can an app (the peer's prompt writer).
6. **A Graph details tab, always** (D1): with no node picked it is the only tab; it lists the models (D2), the primary
   first.

## Decisions for Will

- **D1. Where the Graph details tab sits when a node is picked.**
  - **A (recommended):** **last**, after Details, Output, JSON and Data. The node's own Details stays first.
  - **B:** **first**, before the node's tabs.
- **D2. What the Graph details tab shows now.**
  - **A (recommended):** **the models only**: each Provider · Model, the primary first, and how many AI nodes use it.
  - **B:** also the graph's name, line and tags, its Triggers and its stages.

## Steps

1. Data: the one Model node; the Start's Model row; the primary read through sub-graphs; `graphModels`; the warnings;
   Simulate uses the same pick.
2. Editor: the Model row's words; the Graph details tab (D1, D2); tips in few words.
3. Tests in three engines; then the names to the peer, who changes Demos' graphs, presets and N-zo's rules.
