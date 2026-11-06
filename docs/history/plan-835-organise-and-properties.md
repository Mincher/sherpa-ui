# Plan 835 — Sort and Group in Organise; a property row, Count first

**Status: BUILT, 2026-11-06, lane `lane/organise-835`.**

## What Will asked

Will, 2026-11-06 (TODO 835): "The Collection node should be split into 2 distinct Sort, and Group. Sort and Group should be
in an Organise category. The Count option, from Collection, should be a property row on any node that could provide it. A
property row is an output only row in a node that provides a property (raw or calculated) from the node's data or
calculations from it's code logic." Then: "So 'Field' could have a 'Count' property, for example."

## Picks

| | Pick | Why |
|---|---|---|
| Kinds | `sort` and `group`, two kinds, each a plain kind (no family): header takes any and needs a Field (783 F5 stays: Sort and Group by take the Field on the header). `collection` and its Count type go | Will's words |
| Category | **Organise** replaces Collections in the panel, after Time; a Preset Filter's families say Organise | |
| The row kind | `RowKind.property: true` and ONE builder, `propertyRow(name, label, gives)`, in node-kinds.ts: an output only row, no control, no value, so no socket in. It sends a given (`gives`) read from the node's data, never typed | One definition. Everything that reads an output row already reads it: `givenAt`, warnings (764), coercion (781), a portal's row label "Field › Count", Unfurl's output sockets |
| Count's first uses | **Source** (the rows read), **Field** (the values in its column), **Group** (rows per group), **Condition**'s comparisons (the rows that match). Sort has none: it is the rows it was given | Only Count now; the row kind is general so Sum, Min and Max follow on `gives` |
| The word | A property row is labelled by its property, "Count"; its tip says whose: "How many rows come out" | |
| Old graphs | Nothing converts: a saved `collection` reads with the fault "of the kind "collection", which is not one". Demos' shipped graphs are rebuilt | Will: a clean system |
| The Query editor | Draws a Source, Field and Condition with their Count row, output only, unrouted | A property row routes like any output |
| Run | None: a count is a number only a run gives (N4). Before one, the row sends `{ kind: 'number' }` with no value, as a Result does | As Math's Result |
