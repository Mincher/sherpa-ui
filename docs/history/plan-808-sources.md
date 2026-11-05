# Plan 808 — a Source node in every graph, several per graph; and 809, a synopsis per kind

**Status: BUILT, 2026-11-05, lane `lane/sources-808`.** It builds on plan 713 (the one registry), plan 783
(Will's chain "Source › Field › Condition › Output") and plan 746 (entity types and their families).

## What Will asked

Will, 2026-11-05:

> TODO 808: "I should be able to add a Source node to a graph. Multiple Sources are allowed."
>
> TODO 809: "Node descriptions in the panel are too long. A simple synopsis of the type is enough."

Measured on :4200: Workflows and Preset Filters offer only **Store** under Sources; the Query editor's
panel has no Sources at all. A family's panel line lists its types (Value: "Text, Integer, Decimal, Date,
True/false, List").

## Picks

| | Pick | Why |
|---|---|---|
| One kind or two | **ONE kind, `source` (Source).** The Store kind goes: the Source names its store (its Store row) and sends that store's rows on its Rows row | Will's word, and his chain in 783 starts at Source. The panel's category is already Sources. Two nodes for one thing, a Store then a Source, is the chain a clean system drops. One meaning: a Source is a `SourceDefinition`, the store a page reads and how (T-one-node-registry) |
| Its rows | Every graph: **Rows** and **Store**. The Query editor adds the page's own after them: Page size, Search fields, Apply on | A Query node adds its own rows after the kind's, as a scope adds its fields. Page size and Apply on mean nothing in a workflow |
| Where it is offered | Every graph's panel, under **Sources**: Workflows, Preset Filters, Custom Nodes' inner graphs, and the Query editor | Graphs stay open. A Preset Filter takes the Sources family; a Workflow and a Custom Node take every family; the Query's panel now lists Sources |
| Several | No one-only rule anywhere. A placed node's id is the next free `source-N`, so ids stay unique | Will: "Multiple Sources are allowed" |
| A second Source in the Query editor | **It is placed and warns**: "The page reads customers. This Source is not the page's: the Query reads nothing from it." `placeRequest` answers `{ keep }` for it, as it answers `{ request }` for a Field. The editor keeps it in its DRAFT for the tab, beside the places and bends; Undo and Redo step it; Delete removes it; its Store row picks any store the app registered. Save writes the page's definition only, so it is never saved | The page reads ONE store. A Source that reads another store for a Field's choices is a join the Query cannot hold: that waits for Will (below). The Query stays the one door for the Query: the kept Source never asks it anything |
| A saved `store` node | **None is read.** An old graph's `store` node is a kind that is not one, as any rename (T-a-rename-drops-the-old-name). Demos' shipped graphs and fixtures move to `source`; a reader's own copy on :4200 needs Reset all | No legacy in the node editor (Will) |
| 809: the line | **ONE synopsis per kind, its `description`**: a few words, one line, in node-kinds.ts. The panel's line is it, never the list of the family's types. Search still finds a type by its name, and a found item's line is that type's own help | One place says what a kind is. Will's example: Math, "Numbers in, one number out" |

## Demos

The Workflows View ships a third workflow, **Customers and devices**: a Source of customers and a Source of
devices, each counted, the counts added and sent to the Output. The Query editor is given the app's stores,
so a second Source there can pick devices.

## For Will

- A second Source in a page's Query could, later, read another store for a Field's values (a join: "the
  customers who own a device"). That needs the Query to hold a second store; today it warns.
- Reset all on :4200 once: the reader's saved graphs still hold the old `store` node.
