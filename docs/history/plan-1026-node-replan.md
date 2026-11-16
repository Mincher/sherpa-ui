# Plan 1026 — the node work, replanned

**Will approved it, 2026-11-16, with two picks: "1. A. 2. A."** Drafted by sherpa-demos-3d from a read of the ledger and
the plans on 4791ecf99 and after (35 open node rows, about 60 built and waiting for Will's look, 8 done in substance);
written here by sherpa-ui-56. The ledger's "Node editor, in this order" group follows it.

**The rule: small, foundational, high-impact first.**

## Will's two picks

1. **A — one naming pass.** "Core Nodes" (1025), "Graph Editor" (966) and "Sections" (906) are renamed together, in one
   window with no lane open, in Tier 2, before new kinds add files that would need renaming again.
2. **A — release the run engine's hold.** 616 (the node engine) starts after Tier 2. It unblocks 671, 78 N4, 1003 (a
   Coworker run's details) and 556.

## Tier 0 — clear the decks

- Close the rows done in substance, to the archive: **740** (the node look, its sockets and the resize handle, built in
  later rows), **874** (connected sockets: 998 and 1016), **989** (a test fault: 1007), **956** (956a here, 956b in
  Demos: prompt-refs.js is gone), **1005** (merged; N-zo reads `graphRules`).
- Trim what is left: **841** keeps only P7 and its question (P1–P6 built); **971**'s words say its §9 is built (the
  Boolean gate and True's removal); **999** keeps only the one swapped socket pair on reforged-node-unfurl's tangled graph.
- **The look list** (below): each row built and waiting for Will's look, one line each, so he ticks them and they archive.
- **Merge 1008c** (the agent-tools door, c1–c3), on sherpa-demos-3d's green.

## Tier 1 — quick fixes

- **1025**: the Nodes panel's three tabs — Core Nodes, Node Graphs, Custom Node Graphs (Will's bug). The tabs and their
  words here; the code names that say "preset node" go in Tier 2's naming pass.
- **1018 + 1019** in one lane: the Collapse-all icon; the node toolbar's order.
- The Undo-why gap: an act's undo answers why it cannot (done in 1008c, 1bcb4e9b2).
- **986d**.
- Will's quick picks: **925** (A, close), **737** (A, leave), **892**.
- **999**'s swapped pair, where it is quick.

## Tier 2 — foundations

- **One naming pass** (pick 1 A): Core Nodes, 966 "Graph Editor", 906 "Sections", together, no lane open.
- **1008a**: one list of stores and fields (1024 needs it).
- **1006**: `bindNodeEditor`, one door that hosts the editor on an entity shelf; it takes **970** too. Demos' node-editor.js
  showed how fragile the host code is: three binds per open (fixed in Demos, 141aff2).
- **1017**: its plan and swatch picture first (1020 and 761 need it).
- **992b**: the words for the kinds still to come, before 991.

## Tier 3 — new nodes

- **1024** (one Entity node kind), **1023** (Date and Time), **1013** (Set Status, Custom Values).
- **991b–e** (For each, Wait, Error socket; Unique, Top N; Approval; Guardrail, On failure), then **991f**.
- **1020** (a connection's issue on its line).
- **993**: review every shipped graph, with the retrofit of the new nodes, as Will asked.

## Tier 4 — later

- **616** the run engine (pick 2 A: its hold released; it starts after Tier 2), then **1003**, **997**, **556**,
  **1008d, e, f**, **942** step 4, **960** U6–U8, **919** (waits on D1), **914** (a pick), **842** (last), **841** P7.

## The look list

Drafted from each row's own words (sherpa-ui-56, 2026-11-16).

Tick a row when it looks right; it then moves to the archive. Each line says what changed and where to look.

### Layout and Unfurl

- [ ] **888** Unfurl keeps zip ties in place, as anchors — look: Graph Editor (http://localhost:4200/?context=node-editor): on a graph with zip ties, press Unfurl
- [ ] **902** Unfurl and Arrange move nodes smoothly, not jump — look: Graph Editor: press Unfurl or Arrange; lines fade out, then come back
- [ ] **918** Chain drag: ⌘-drag pulls the joined nodes along — look: Settings › Node Editor › Nodes (on); Graph Editor: ⌘-drag a node. (975 later changed the pull.)
- [ ] **950** Unfurl keeps each node inside its own stage — look: Graph Editor, Contoso patching: press Unfurl; no node on another, each stage fits its nodes
- [ ] **955** The Start is laid out like any node — look: Graph Editor, Device triage or Contoso patching: press Unfurl; Trigger, Start, Source in flow order
- [ ] **958** A graph an agent made lays itself out once — look: Graph Editor: open a graph N-zo just made; it unfurls and saves on first show
- [ ] **974** A plain drag no longer pushes other nodes — look: Graph Editor: drag a node without ⌘; only it moves (a growing stage still pushes the next)
- [ ] **975** The ⌘-drag pull gets weaker with distance — look: Graph Editor: ⌘-drag a node; far nodes move less. Settings page: chain falloff (distance or connections)
- [ ] **1000** A graph unfurls on open, and when Swimlanes ends — look: Graph Editor: open a graph; turn Swimlane mode off. It opens no smaller than 35% zoom

### Lines, bends and ties

- [ ] **973** Zip ties keep apart, each in its own section — look: Graph Editor: drag a zip tie along its lines; it stays between 20% and 80% of its section
- [ ] **999** Bends are smooth; Unfurl spaces line middles too — look: Graph Editor: press Unfurl; drag a bend to a sharp angle, no kink. Setting "unfurlMidpoints" is on
- [ ] **1010** Unfurled lines sweep round nodes, one bend each — look: Graph Editor: press Unfurl; lines go round nodes they do not join, no squiggles

### Stages and swimlanes

- [ ] **893** Stage menu on the header's right; names follow place — look: Graph Editor: a stage header's menu: Add stage before/after, Move left/right; top-right Add is gone
- [ ] **898** Stage fill made lighter (you later said: no fill) — look: Graph Editor: a stage band; check it against "no fill, keep the bar and dashed edges"
- [ ] **901** Narrowing a stage pushes its nodes in — look: Settings › Node Editor › Stages (on); Graph Editor: drag a stage edge narrower than its nodes; one Undo
- [ ] **904** Stage colours from data-viz; a swatch picker — look: Graph Editor: add a stage, open its Edit dialog; Colour is a grid of ten swatches
- [ ] **938** Swimlanes offered inside a Custom Node — look: Graph Editor: open a Custom Node's sub-graph; turn on Swimlanes
- [ ] **947** Stages work inside a Custom Node — look: Graph Editor: open a Runbook or Custom Node; add and move stages. Save as Custom Node on staged nodes works
- [ ] **957** A new stage takes the first unused colour — look: Graph Editor: Add stage a few times; colours go in turn, none twice till all are used
- [ ] **976** Each stage holds its nodes on open, sub-graphs too — look: Graph Editor: open a Runbook through its node; each stage band holds its own nodes
- [ ] **985** ⌘-drag a stage's left edge moves the whole stage — look: Graph Editor: ⌘-drag a stage's left edge; it and every stage right of it move, widths kept

### Node look and sockets

- [ ] **886** Output sockets sit on the node's right edge — look: Graph Editor: any node's output sockets; the row's field is wider now
- [ ] **887** A node is three columns: inputs, rows, outputs — look: Graph Editor: a node expanded (sockets outside the card) and collapsed (one strip a side)
- [ ] **889** The active border shows what is joined — look: Graph Editor: pick a line; pick a node (all downstream light up); click into a row's field
- [ ] **895** A socket's tip opens on its own side — look: Graph Editor: hover an input socket (tip on the left), then an output (tip on the right)
- [ ] **897** A bright colour strip per node category — look: Graph Editor: Nodes panel items (2px left edge); canvas nodes (2px under the header)
- [ ] **907** Portals: In is blue, Out is orange — look: Graph Editor: the header of an In portal and an Out portal
- [ ] **954** Drill-down button on a node; trail on the canvas — look: Graph Editor: press a Custom Node's folder icon ("Open graph"); Back and breadcrumbs are top left
- [ ] **998** Socket colours far apart; each type its own shape — look: Graph Editor: value = teal circle, object = violet diamond, boolean = magenta square; light and dark
- [ ] **1011** A picked node and its downstream nodes cast a shadow — look: Graph Editor: pick a node; it lifts more (md) than the nodes downstream (sm)
- [ ] **1012** A collapsed node has all corners at 4px — look: Graph Editor: collapse nodes of each category; corners all match, and come back on expand
- [ ] **1014** A boolean socket fills on the Start's line — look: Graph Editor, Device triage: the Source's boolean square is filled under the pink line

### Panel, toolbar and menus

- [ ] **894** Toolbar tips in a few words — look: Graph Editor: hover the toolbar: "Fetch data", "Simulate", "Pause simulation", "Stop simulation"
- [ ] **905** F zooms to the picked nodes, or the whole graph — look: Graph Editor: pick nodes, press F; pick none, press F; two new view buttons. Frame nodes is now Shift+S
- [ ] **936** Nodes panel tabs by maker; Save as Custom Node asks a Category — look: Graph Editor: the Nodes panel. Note: 1025 makes the tabs three, and 1008b moved Runbooks to the app
- [ ] **967** A Definition tab shows the node's JSON — look: Graph Editor: pick a node; Details panel › Definition tab
- [ ] **968** Drop a line on the canvas to get a menu — look: Graph Editor: drag from a socket to empty canvas; recent kinds first, then picks like "Field › Status"

### Rows, fields and values

- [ ] **940** A Condition's Operation list fits what comes in — look: Graph Editor: a Condition's Operation select; an ignored input has a dashed line and a tip
- [ ] **943** Message rows are text areas in the node — look: Graph Editor: a node's Message row (a Title row is a one-line box)
- [ ] **953** Text areas grow, scroll, and show focus and caret — look: Graph Editor, Device triage: click a Prompt's text, type, scroll it. Question: cap a node's at 8 lines?
- [ ] **962** Selects in a read-only node cannot change — look: Graph Editor: a locked Runbook: click a select, press the arrow keys; the value stays
- [ ] **969** A Source node has a Fields pick, "All" at the start — look: Graph Editor: a Source node's Fields dropdown; untick some, then Simulate
- [ ] **971** Tests give Pass and Fail; Branch is folded into Condition — look: Graph Editor: a Condition's Pass and Fail rows; no Check or Branch node
- [ ] **983** Status value rows show their row count — look: Graph Editor: a status field's node; each value row ends with "… N rows"
- [ ] **984** Optional rows say "(Optional)" — look: Graph Editor: a Field's Values, a Source's Fields, the Start's Model: their titles and tips
- [ ] **990** A joined row shows what comes in, read only — look: Graph Editor, Contoso patching: the Notification's Message says "From … › Answer"; Simulate, see the text
- [ ] **994** A Condition's Data row is gone; Value A added — look: Graph Editor, Device triage: a Condition takes its data at the header; Value A sits above Value B
- [ ] **1002** Contains has one value row, with no preset choices — look: Graph Editor: set a Condition to Contains; one "Value A" box, empty till you type or join one

### Data, stores and entities

- [ ] **959** A graph reads as numbered steps, by stage — look: a Runbook's prompt text, once Demos reads it from the new steps (the peer's move)
- [ ] **972** Versions, Publish, Roll back and Clone for every entity — look: Graph Editor: Graph details tab: Version, Publish, History; Clone. Account button picks the user
- [ ] **1009** Moving a seeded graph no longer blocks new seeds — look: move a seeded Coworker's nodes; later seeds still arrive. A copy you removed may come back once

### Agents and MCP

- [ ] **945** A Coworkers page; N-zo makes a Coworker — look: Coworkers page: open a Coworker's tabs; ask N-zo to schedule a patch deployment
- [ ] **946** N-zo: one chat for the whole app, kept on reload — look: N-zo panel and the full-page Assistant: chat, then reload; the same chat in both
- [ ] **951** One Model node; the Start's Model serves all AI nodes — look: Graph Editor: pick nothing, see Graph details (models listed); an AI node says "From the Start"
- [ ] **964** N-zo can do any act, here or on another page — look: Users page: Invite; on Devices, ask N-zo to invite a user; on Records, to schedule a Coworker

### Other

- [ ] **896** ⌘ + wheel zooms in 10% steps, smoothly — look: Graph Editor: hold ⌘ and scroll on the canvas
- [ ] **917** One Output node per family — look: Graph Editor: Nodes panel: Notification, Content, Response, Run result; no Notify item
- [ ] **941** A Trigger node, in its own Triggers category — look: Graph Editor: Nodes panel › Triggers: drop one, pick a Type, then Simulate
- [ ] **949** Every graph has a Start; Output Triggers; no loops — look: Graph Editor: Triggers join the Start; an Output Trigger that loops back warns "Blocked"

### Not a look

- None. Every row has a built change to see.
- Questions still open: 953 (cap a node's text area at 8 lines?), 1000 (retire `unfurl` and `beforeLanes`?), 1011 (one shadow level?), 898 (no fill).
