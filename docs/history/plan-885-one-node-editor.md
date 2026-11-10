# Plan 885 — one node editor

Will, 2026-11-10: "It was never my intention to have multiple implementations of node graphs, editing, or the node editor."
And: definitions should pass between the data layer and the node editor in one universal, consistent way — input > process >
output. A node graph says the sources, the conditions and how the result is shown, and tells both the data layer and the
presentation layer what to do with the output. It shows how the data changes as it passes each node, once it has rows.
Do this BEFORE the Figma alignment (plan 883), which folds it in.

## What is there now

Two editors in `src/core/ui/node-graph.ts`, sharing only the drawing (`drawGraph`):

| | `bindWorkflow` (~1300 lines) | `bindQueryEditor` (~380 lines) |
|---|---|---|
| Draws | a stored workflow definition (or an entity's graph) | a page's Query, DERIVED each change (`queryGraph`) |
| An edit | a new definition, `editWorkflow` | a request to the Query (`graphRequest`, `routeRequest`, `placeRequest`) |
| Layout (places, sizes, bends) | in the definition | in the session, beside the Query |
| Undo | snapshots of the draft and the library | snapshots of the Query's draft and the kept Sources; a chip's change is a step too |
| Tools | all | Undo, Redo, Arrange, Unfurl, Collapse all, Hide unconnected |

On the Records filter graph a reader finds no zip tie, frame, stages, lanes, copy/paste, Alt-drag or Fetch/Play.

## The model: one editor, a pluggable DOCUMENT

The editor edits ONE thing, a `GraphDocument`. It reads a workflow definition from it and writes a new one back. What the
document does with it is the document's:

```
editor ── write(next definition) ──▶ document ──▶ the data layer (a stored draft, or Query requests)
editor ◀── read() / 'change' ──────── document ◀── the data layer (a chip, another tab, a refresh)
```

- `read()`: the definition as the editor draws it — v2 workflow JSON: nodes, routes, values, and the layout (places, sizes,
  bends, ties, frames, stages, lanes).
- `write(next, tag)`: the editor's whole next definition. The document applies what it can and says what it refused.
- `snapshot()` and `restore(snap)`: what Undo keeps and puts back — the document's own state.
- A `change` event: something else changed the document. The editor redraws and keeps it as an Undo step.
- `kinds`, `palette`, `readOnly()`, `save()`, and what the inspector adds (a component's live copy).

Two documents ship:

1. **Workflow document** — a stored workflow (and a Custom Node's inside, an entity's graph). `write` keeps `next` as the
   draft, as today. Nothing a reader sees changes.
2. **Query document** — a page's Query. `read` is the Query as a definition (the derived nodes and routes, plus the layout
   kept in the session). `write` is a RECONCILE in the data layer: it compares the definition before and after and asks the
   Query for each change, through the same doors a chip asks through:
   - a row's value → `graphRequest`;
   - a new route → `routeRequest`;
   - a new node → `placeRequest` (its scope from the route it joins, else the View);
   - a cut route or a removed reading → refused, as today, in words; a kept Source → removed;
   - layout (places, sizes, bends, ties, frames, stages, lanes) → kept in the session, as places and bends are now.

So EVERY tool works on the filter graph, because every tool already ends in a definition write. Tools that make no sense
for a Query say so (disabled, with the reason in the tip), not by being absent.

## Steps (each its own commit; the gates and the node specs green after each)

1. **Data: the Query as a definition, and back.** `queryDefinition(query, page, facts, layout) → WorkflowDefinition` and
   `reconcileQuery(before, after, facts) → { requests, kept, layout, refused }`, DOM-free, beside `query-graph.ts`. Unit
   tests: each edit kind round-trips (draw → edit → reconcile → apply → draw is the edited one); layout never reaches the Query.
2. **Data: one layout record.** `GraphLayout` (places, sizes, bends, ties, frames, stages, lanes, a node's stage), read
   from and written into a definition. The workflow keeps it in its JSON; the Query document keeps it in the session.
3. **UI: the seam.** `bindWorkflow` speaks only to a `GraphDocument`; the workflow document is today's behaviour, moved
   behind it. No change a reader can see; the whole node suite passes unchanged.
4. **UI: the Query document.** `bindQueryEditor(canvas, source, options)` keeps its signature and becomes
   `bindWorkflow(canvas, queryDocument(source, options), options)`. Its own body is DELETED. What only a Query has moves
   into the document: kept Sources, Preset Filters in the panel, a component's live copy in the inspector, the step
   lights (`watchQuery`), Save as the page definition.
5. **Tools on the filter graph.** Zip tie, frame, stages, lanes, copy/paste and Alt-drag work there. Fetch and Play: the
   Query's own rows are the data, so Play shows them flowing through each node (plan 836's panes), or says why not yet.
   Save as Custom Node makes a Preset Filter entity, or says why not yet.
6. **Docs.** TRAPs (one editor, the document seam), APP-GUIDE, the Map; the old body is gone.

## Risks

- **Ids.** The Query names its own nodes (`QUERY_NODE`). A node the editor adds as `sort-1` comes back from the Query with
  its own id; the editor follows the Query's (the pick moves to it), never the other way.
- **Undo.** A step on the Query is a WHOLE restore (`restoreDraft`), as now: a reconcile is never replayed backwards.
- **A change from outside** (a chip, Apply, another tab) is a `change` event, and an Undo step, as the filter editor does now.
- **Size.** `node-graph.ts` is ~3900 lines; the seam and the document go in their own files, and the deleted body pays
  for them.

## Out of scope here

Plan 880's lane rules; the client/server split (TODO 170); any new node kind.
