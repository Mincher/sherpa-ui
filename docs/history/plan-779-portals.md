# Plan 779 — portals: an In and an Out joined by a name, with no line between them

**Status: BUILT, 2026-11-05, lane `lane/portals-779`.** It builds on plan 713 (sockets), plan 749 (families),
plan 783 (Field, `conditionAt`) and plan 778 (frames, a model of graph-level data).

## What Will asked

Will, 2026-11-05 (TODO 779):

> "Portal nodes: Connect any node to the 'in' portal node and have it come out of any output portal node with
> the same name/id. There can be multiple input and output portal nodes with the same name so we can create
> many-to-1, 1-to-many, and many-to-many scenarios. There are no connectors between input and output portal
> nodes. This makes them very useful for organising the node graph and keeping connector clutter low.
> Selecting any portal node should highlight all of it's matching nodes."

## Picks

| | Pick | Why |
|---|---|---|
| Kinds | ONE family, `portal` (Portal), types **In** and **Out**, in **Utils**. A workflow's alone (a Preset Filter takes Utils) | One node and a Type select, as Value and Math are. The Query editor draws a Query, never kept: no portals, as no frames |
| Sockets | In: its header takes anything, one route. Out: its header sends, its type the type of what reaches its Ins (one type, else any) | Every node's data comes in on its header (713 D1). Many-to-1 is several Ins of one name |
| The name | A `name` row, a select of every name the graph's portals hold, then **New name…**, whose value is the next free `Portal N`. The inspector's **Rename** renames a name on every portal that holds it, one step | Picking joins a link in one act; Rename keeps the links. A picklist has no typed entry |
| What an Out sends | What reaches EVERY In of its name, each its own send: as if each source were routed straight to where the Out goes | One rule for every type |
| 1-to-many | Each Out of the name sends it: rows, a value, a boolean | |
| many-to-1 | Into an input that takes several (And, Or, a list): each is one of its routes, a part of the And, a value of the list. Into one that takes one: it reads null and warns, "Sort takes one; 2 reach it through the portal "rows"" | Will's rule: a mismatch reads null and warns; Save does not wait. Picking the first would hide a choice |
| many-to-many | Each Out, each In's | |
| Readers | ONE resolver, `portalFlow` (node-portals.ts). workflow.ts reads it once per graph (`flowOf`): `sentFrom`, the warnings, the row reads, the field a node reads, the faults. node-flow.ts resolves once at `conditionAt` and `nodeFlow`, so the Outgoing JSON and the Preset Filter compile both follow it. The drawing reads the drawn routes | No reader can miss a hop: none reads routes past it. TRAP T-a-portal-hop-is-resolved-once |
| Loops | A loop through portals is a loop: the check reads the routes as the data flows. A route, a name picked or a Rename that makes one is refused, as a route is. Portals that send into their own name say so | |
| An Out with no In | It warns, "No In portal is named "x": it sends nothing", and an input only it reaches reads null | Open graph |
| Save as Custom Node | A name is LOCAL to a graph: a definition's body is its own. Picked nodes that hold some of a name's portals, and not all, are refused in words | A link cut in two would change what flows |
| Ungroup | The body's names come out; one the graph holds already takes the next free number, `rows 2` | Nothing links that did not |
| Lines | None between portals: the routes into an In and out of an Out are drawn as any route | |
| Highlight | Picking a portal sets `data-linked` on every other portal of its name, In and Out alike. `sherpa-node` pins it to the active mode, as `data-current` (state-pins.yaml). The Name row's line says how many match: "Sends to 2 Out portals" | Every picked thing looks the same; a pin, never a colour rule |

## Built

| File | What |
|---|---|
| `src/core/data/node-portals.ts` | the resolver, the names, the matches, Rename, the group and ungroup rules |
| `src/core/data/node-kinds.ts` | the `portal` family, the `portal` row control and its choices |
| `src/core/data/workflow.ts` | `flowOf`: every reader on the flow; the Out's type; the warnings; `renamePortal` |
| `src/core/data/node-flow.ts` | `conditionAt` and `nodeFlow` read through portals |
| `src/core/data/node-group.ts` | Save as Custom Node refuses a cut name; Ungroup renumbers a clash |
| `src/core/ui/node-graph.ts` | `data-linked` on a pick; Rename in the inspector; a name that makes a loop refused |
| `sherpa-node` | `data-linked`, pinned active |
| Demos | a second shipped workflow: one Store's rows through a portal to a Count and to a Field › Condition |
