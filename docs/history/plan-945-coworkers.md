# Plan 945: Coworkers in Sherpa Demos, made with N-zo; and 946: N-zo everywhere

Will, 2026-11-12: "I think we just need to build Coworkers into Sherpa Demos. This is purely for UI/X demonstration so
we should use generated dummy data to populate the app. Don't use any of the acp-module code or implementation in
Sherpa Demos. … Build these views to follow Sherpa-UI and Sherpa Demos conventions for views and content." Asked of
N-zo: "schedule patch deployment to a customer's devices". N-zo asks if it should be a Coworker; then, quietly, it writes
a standard Runbook prompt, makes the graph that describes it (Stages, Inputs, Checks, Conditions, Outputs, and Routes for
errors and retries), keeps both as a Runbook node, puts that in a new Coworker with its own graph, adds Expert nodes and
a Prompt node that finds the best hours to deploy; it replies with the prompt, and with actions to view, edit and
schedule the Coworker. And (946): "the N-zo panel state, and content, wasn't confined to a single view and went with the
user around the whole application", with what is on screen known to it, "so that they could operate the app, and any of
its functionality … from anywhere".

All in Demos. sherpa-ui changes nothing for it. The library's doors serve it: the entity shelf, entity types, the
Custom Node doors (942), the Trigger (941), the Check (944) and the AI nodes (926).

## What the acp-module says (read, no code taken)

- A **Coworker** has ONE Runbook, its Experts, a trigger (on demand, a schedule or an event), guardrails (the lowest
  risk that needs a person to approve), a trust level (manual, assisted, autonomous), a status (draft, active, paused,
  archived) and its Runs.
- An **Expert** is an agent for one narrow domain: a model, a system prompt, the MCP tools it may use, a risk ceiling.
  N-able makes them; an MSP picks them for a Coworker.
- A **Runbook**'s prompt (its "intent") is free text there. Will wants it standard and methodical (D2).
- A **Run** has a status (running, waiting for approval, completed, failed, …) and stages, each with its attempts.

## Decisions for Will

**Will, 2026-11-12: D1 A, D2 B (his words below).**

- **D1. Where a Coworker opens.** A: its own page, with a URL (`?context=coworkers&coworker=<id>`) and tabs. B: the
  Details panel, maximised.
- **D2. How a Runbook's prompt and its graph stay the same.** Will: "AI writes prompts, or converts user written
  prompts, into a format that is quite standardised and methodical. This is then translated to Nodes in a Graph.
  Changes to the Graph are read by an agent, on save, and the standardised prompt is regenerated to match." With Claude
  off, the app writes the same form from the graph, marked as the app's, so the two never disagree.

Picked by sherpa-demos-67, to change if Will says: dummy data from a fixed seed, made the reader's own on the first
load, as the workflows are (D3); an Expert node takes a Question and gives an Answer (D4); a Runbook gains a Failed
output beside Found, for its error Routes (D5); N-zo's reply may carry action buttons, through a tool (D6).

## The build: 945, Coworkers

1. **Types** (Demos, `registerEntityType`):
   - `coworker`: a graph of any node, its settings its customers, status, trust level, schedule and guardrails. The
     Node Editor gets a Coworkers View.
   - `expert`: a stand-in agent, a node with a Question in and an Answer out; its domain, model and risk ceiling. Four
     preset Experts, and an Experts View.
   - `runbook` (936): a Failed output beside Found; its settings keep its standard prompt and risk level.
2. **Dummy data**, generated from a fixed seed: about twelve Coworkers across the Records customers, each with its
   Runbook, Experts, schedule and twenty Runs.
3. **The Coworkers Context**: a grid over a store that follows the shelf (one truth: the entities), Views by status, and
   the Details panel for a row.
4. **The Coworker page** (D1): its header (name, status, Edit graph, Schedule, Run now) and tabs: Overview, Data,
   Experts, Runbook, Schedule, Runs. Data, Experts and Runbook are READ from its graph: its Sources, its Expert and
   Runbook nodes. Edit graph opens it in the Node Editor, where it is edited, simulated and saved.
5. **The standard Runbook prompt** (D2): one form, its sections Goal, Inputs, Stages (each step, its check and where
   each answer goes), Retries and errors, Outputs, Guardrails. On a Save of a Runbook, or of a Coworker that holds one,
   an agent rewrites the prompt from the graph (Claude, one ask, no tools); with Claude off, the app writes it.
6. **N-zo makes a Coworker**: tools to keep a Coworker and its schedule, and to offer the reader actions (D6). Its
   rules: offer a Coworker first; write the prompt in the standard form; make the Runbook from it; the reply shows the
   prompt with Open, Edit graph and Schedule.

## The build: 946, N-zo everywhere

1. **One conversation for the app.** Its thread and Claude's session outlive a reload, and the panel and the full-page
   Assistant show the same one. The panel stays open, or shut, over a reload.
2. **What is on screen**: a tool that says the page, its View and filters, the rows picked, the record in Details, the
   panel or dialog open, the nodes picked in the Node Editor, the Coworker shown, and what the reader last pressed.
3. **WebMCP** where the browser has it (`navigator.modelContext`): the tab offers the same tools there, so an agent in
   the browser may call them. Our own MCP stays the way N-zo asks.

## Steps

1. 945 data: the types, the seed, the store; tests.
2. 945 views: the Coworkers Context and the Coworker page; the Node Editor Views; tests in three engines.
3. 945 prompt: the standard form, the app's writer, the agent's rewrite on Save; tests.
4. 945 N-zo: the Coworker tools, reply actions and rules; tests with the fake Claude, then one try with the real one.
5. 946: one conversation, what is on screen, WebMCP; tests.
