# Plan 826 — a portal In takes many; each Out draws a row per connection

**Status: BUILT, 2026-11-05, lane `lane/portal-rows-826`.** It replaces plan 779's "an Out sends what reaches every
In" and its many-to-1 null rule. Plan 779's name, highlight, Rename and local names stay.

## What Will asked

Will, 2026-11-05 (TODO 826):

> "A portal input should be able to take in multiple connections. Associated portal outs should show each input node
> row as input rows in the output portal node."

## Picks

| | Pick | Why |
|---|---|---|
| The In | Its header takes MANY routes, of any type | Will's words |
| The Out | ONE ROW per route into any In of its name, in order, each once; labelled from its source ("Source › Rows", "Condition › True") and typed by it; an output socket each, routed on alone | As a Group Input does since 763 |
| The Out's header | Sends NOTHING: it has no socket. A route from it is a fault | As 765 made the Group Input's. One way to route a row |
| A row's id | `@` and its source's address: `o/@source-1/rows` | Stable: the same route back is the same row. No numbering to drift |
| A route in cut | Its row goes. The routes out of it are kept in the draft, unseen and no fault, and Save leaves them out. The route back, or Undo, and they draw again | Will's rule: the draft keeps what an edit orphans; Save writes the final graph |
| The resolver | `portalFlow`, the ONE: a route from an Out's row is one route from that row's source, the name on it. An Out's row into an In of another name chains | Every reader reads it; none can miss a hop |
| What reads through a row | `sentFrom`, a row's read, the field a node reads, the warnings, the faults, `conditionAt`, the Outgoing JSON, a Preset Filter's compile: each reads the row as its source | As if routed straight |
| Many-to-1 | Several rows, each routed alone; no null rule | A row is one route |
| Rename | Every portal of the name; the rows and their routes stay | Rows are named by their sources, not the name |
| A name picked away | The Out's rows go, their routes kept unseen; picked back, they draw again | The same keep |
| Loops | A loop through a row is a loop. A route, a name or a Rename that makes one is refused, a name that revives a kept row too | |
| An Out no In names | Warns, and has no rows | |
| Save as Custom Node | A pick that cuts a name in two is refused. A row whose source is outside becomes `@#in/<input>`, the Group Input row its route now comes in by | A name is local to its graph |
| Ungroup | Each route the use's input took is its own row again, by its source; a name the graph holds takes the next free number | The inverse |
| Highlight | As 779: `data-linked`, the active pin | |
| Deleted | 779's `nulls`, `dropped`, `loops`, `nullWords`, the Out's header output and its `any` socket, `portalSends`, `fitOf`'s any | Replaced |
