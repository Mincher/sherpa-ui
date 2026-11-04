# TODO

The list of open work. One file. Add to it, tick items off, do not start a second one.

**A bug is queued like any other item.** Will, 2026-09-26: bugs do not demand
immediate attention. Add it here, in its place in the order, and carry on.

---

## At a glance

**Open:** every ⬜, 🚧, ❓ and ⏸️ row — all of them in the table's first three
groups since the review of 2026-10-27: **Next** (in order), **Waits on Will**,
and **Later**. Numbers are ids, not order; the table IS the order. The code
review's open rows (group L) are in those groups now; its plan is
`docs/CODE-REVIEW-PLAN.md`.

**Status:** ✅ done · 🚧 in progress · ⬜ not started · ❓ waits on a ruling from Will.
An item's section heading says the same: `[x]` ✅ · `[~]` 🚧 · `[ ]` ⬜ · `[ ]` ❓.

**A done item MOVES — its row and its section — to
[history/TODO-ARCHIVE.md](history/TODO-ARCHIVE.md), marked ✅. Nothing is deleted** (Will,
2026-09-29; the archive, 2026-11-03, plan-695 T1). Its section gets a `**✅ Done <date>:**`
line, and it moves when it is done.

| | Pri | # | Item | Kind |
|:-:|---:|---:|---|---|
| | | | **Next — open work, in this order** (Will asked for a review, 2026-10-27) | |
| 🚧 | 29c | 518 | **→ plan-695 S1–S5, P2–P6.** REVIEW (Will, 2026-10-28) — all the filtering code and behaviour: many waves of fixes left conflicts, duplication and needless complexity. Optimise without changing the architecture or what it does; and every UI component works ALONE with the data layer, never relying on another UI component | refactor |
| ⬜ | 29l | 528 | BUG (Will, 2026-10-29, after 523) — panel-mode sections cannot be drag-reordered even with the setting on. On, each section shows a drag handle left of its title; dragging the handle reorders the filters. The handle showing must not move the title label | bug |
| ⬜ | 29n | 530 | SETTING (Will, 2026-10-29, after 523) — show the filter overflow (⋮) buttons only on hover, in the filter toolbar's panel mode | filters |
| ⬜ | 29p | 532 | FEATURE (Will, 2026-10-29, after 523) — on each settings page, beside the Jump to chip, a Search input spanning the form's width: typing searches the page's content and hides every settings list item that does not match | feature |
| ⬜ | 29r | 535 | SETTINGS (Will, 2026-10-29) — some items are on the wrong page. Multi Value Columns go to a NEW Data Grids page; the Data Grid settings move from Appearance to Data Grids; Show On/Off shapes moves from Appearance to Accessibility. Then assess EVERY other setting's page and section: move each one out of place, or make a new page for it | settings |
| ❓ | 29s | 536 | HOTKEYS (Will, 2026-10-29) — a Hotkeys settings page: toggle the hotkey settings and map keys to app and component acts; a first set of hotkeys for Sherpa components that make sense in an app. Approach (Will leans to A): A, one central hotkey handler that hears the keys and tells the components that listen; B, hotkeys as a generic SherpaElement door, each component declaring its own. Native first: use a web API where one does the job. Found: no native key MAP exists (`accesskey` cannot be remapped and its modifier differs by browser); the Invoker Commands API (`command`/`commandfor`, a `command` event, custom `--names`) is the native way to SEND an act to a component; `aria-keyshortcuts` announces a key. A key listener needs `document`, so A cannot live in the DOM-free data layer (rule 13): it goes in the app layer, beside the router and the provider; the keymap itself is data, kept in a SessionStore | feature |
| ⬜ | 29t | 537 | MOBILE (Will, 2026-10-29), at the mobile breakpoint: (1) the nav's hamburger button sits LEFT of the app header icon; (2) the Settings toggle stays in the nav header, not a nav item at the nav's foot; (3) the Pin button becomes a Close button with a cross icon, and the nav footer's Cancel button goes; (4) a larger global sizing and spacing step, for a bigger look and tap area — rounded with `round()` and other CSS functions, no sub-pixel values (Will: "the 8px grid with 4px subgrid"; PRINCIPLES rule 6 says 4px spacing and 2px text — confirm with Will when started); (5) every chart legend horizontal, below its chart; (6) the app header's action buttons (top row, right) fold into an overflow menu button — as RESPONSIVE behaviour at any width, the way the filter toolbar folds its actions | mobile |
| ⬜ | 29v | 539 | FIGMA, after 538 (Will: A, 2026-10-29) — Figma's "Tooltip (atom)" loses its arrow, as the code's tips have none | figma |
| 🚧 | 29w | 540 | **BUILT 2026-11-04, awaiting a look in Demos: `data-bucket="auto"` + `data-over-field` on a metric.** Rule (Will, 2026-11-04): the largest unit that fits 3 whole times; a smaller one where none does (6 weeks beats 2 months, 8 months beats 3 quarters, 9 days beats 2 weeks). A number field sums, any other counts rows; each tip says its time span; the sparkline holds 14. `segments.ts`. SPARKLINE (Will, 2026-10-29) — its segments follow the date range the View scope's date conditions resolve to: a single day, 12 segments of 2 hours; several days, one per day; a single week, 7 (one per day); 2 weeks, 14 (one per day); more than 2 weeks, one per week; within a single month, one per week; across several months, one per month. Each segment's tooltip says its time span (weeks may use week numbers). To settle when started: which rule wins where two meet (6 weeks across two months: per week or per month?) | feature |
| ⬜ | 29x | 541 | AFTER 523 — its two riskiest steps, each proved in the running app, one at a time: S7, a grid heading's Sort button runs the Sort chip's own cycle and glyphs (its event stopped at the grid and sent again as the grid's) — since 695 P4 (2026-11-04) a heading's Sort and Group are `sherpa-button`s with `aria-pressed`, not chips; U11, the bar's four layers of held state (`#held`, `#heldDraws`, `#pendingAnswers`, `#painted`), older than the menu's own early state, each removed only with its own proof | refactor |
| ⬜ | 29y | 542 | SETTINGS (Will, 2026-10-29) — split "Show customer sites" in two: "Show customer Sites" shows Site as its OWN filter field, chip or section, right after Customer; "Consolidate Customer and Site selection" shows the Sites in the Customer menu as a tree, as now | settings |
| ⬜ | 30b | 545 | GRID (Will, 2026-10-29) — a multi-value column's cells show filter CHIPS, not tags | grid |
| ⬜ | 30c | 546 | GRID (Will, 2026-10-29) — a multi-value column's filter menu leads with the Advanced condition rows: today a reader cannot type a string for Name there | grid |
| ⬜ | 30d | 547 | SETTING (Will, 2026-10-29) — "Single Edit Filters button in panel". ON: the panel's one Edit button, as now. OFF: each accordion header has its own Edit on its right, a menu of that scope's filters only; a chart's section has none | filters |
| 🚧 | 30h | 551 | **695 N1 (2026-11-03):** a moved node keeps its place for the tab and goes when the session ends; a workflow's Save keeps it. Places in a saved PAGE definition: not built (N1 pick A: session only). NODES (Will, 2026-10-29) — a node's place and properties survive a reload, and go only when the session ends — unless the reader saved them to the definition (not built yet). In plan-78-workflow-data.md §4 (W3); Will ruled A on D1–D4 | feature |
| ⬜ | 30k | 554 | DEMOS (Will, 2026-10-29) — Customers, Sites, Region and Date Range are held at the VIEW Context scope: they cannot be moved down to a local scope. A local scope may still add these fields and their filters, but its options come from what the View scope's filter on that field allows | demos |
| 🚧 | 30l | 555 | **695 N1 (2026-11-03):** one registry; the graph adds presets, saved filters, status fields, superseded; every edit an `ask()`; Save fires `definition-save`. **→ plan-695 N1.** NODE EDITOR FOR QUERIES (Will, 2026-10-29) — view, edit and build a page's Query as nodes: Store, Source, Scope (its held fields as rows), Condition, Arrange (sort, group, search), Presentation, Component. Opened from the filter toolbar's overflow menu as "Node Editor (beta)". The editor ASKS: a change is a QueryRequest, as a chip's is. PLAN: docs/history/plan-78-query-editor.md (Q1–Q5; Q1 ruled A, Will 2026-10-29: a maximised overlay panel over the page, for now). The wait on 548 is LIFTED (Will, 2026-10-30, D5): presentation switching is not key to building graphs with presentation nodes. **Q1 DONE 2026-10-29:** `QUERY_KINDS` and `queryGraph()` — the Query drawn as nodes and routes, by depth; node tests `a-query-is-drawn-as-nodes`. **Q2 DONE 2026-10-29:** a toolbar's `data-node-editor` offers "Node Editor (beta)" last in its ⋮ menu, and a pick fires `node-editor-open`; `drawGraph()` and `bindQueryEditor()` (app layer) draw the page's Query on a canvas, read only, and follow each change; Demos opens it in a maximised overlay from the View bar and the panel column. Proved: a chip pressed behind the open editor adds its Condition node. **Q3 DONE 2026-10-29:** the editor EDITS through a chip's doors — a condition's operator (its field type's, by `OP_LABELS`) and value, Sort, Group, and each scope's filter Switch; the Source, a condition's Field and Presentation stay read only (Q4). Proved in Demos: Status = Trial from a chip (25 rows), then Does not equal in the editor — the page's Query reads `{ ne: 'trial' }` and shows 75 rows. **Q3+ DONE 2026-10-29 (Will):** a click on a node opens its INSPECTOR over the editor — its rows again and their From and To, and for a grid or chart a live copy of it, drawn from the Query; every field edits but a routed one (it mirrors what comes in) and one nothing outside takes yet (it says why); a field with known values is ticked — Is one of / Is not one of; a slot's Presentation is its Show as. Proved in Demos: ticks give `{ in: ['active', 'trial'] }` and 49 rows; By plan's copy draws its donut; the grid's Show as Bar swaps the page's grid for a bar chart. **Connect DONE 2026-10-29:** a drag from an output socket draws a dashed line; let go on an input socket, the host is asked — for the Query, a condition MOVES to the same field in another scope, or goes to another field keeping the values that fit; anything else is refused and reported. Proved in Demos: Status dragged onto Plan is refused ("Nothing Status picks is a value of plan"), and the Query is unchanged | feature |
| ⬜ | 30m | 556 | LATER, after 555's core (Will, 2026-10-29) — fuzzy AI nodes, to turn contextual processing into a decision-model-like output; and MCP, Tool, Skill, Context and Memory nodes. Kinds on the same engine (`runWorkflow`) | explore |
| ⬜ | 30n | 557 | NODE EDITOR, AFTER the workflow is on the data layer (78 W2–W5, 555) (Will, 2026-10-29) — a connector's end dragged off a socket and dropped on another socket REROUTES it | feature |
| ⬜ | 30o | 558 | NODE EDITOR, AFTER the workflow is on the data layer (78 W2–W5, 555) (Will, 2026-10-29) — a connector's end released over the bare canvas BREAKS the route; so does a click on a connector, then Delete or Backspace | feature |
| ⬜ | 30p | 559 | NODE EDITOR, AFTER the workflow is on the data layer (78 W2–W5, 555) (Will, 2026-10-29) — a click on a blank part of the canvas deselects every node and shuts the overlay panel | feature |
| ⬜ | 30q | 560 | NODE EDITOR, AFTER the workflow is on the data layer (78 W2–W5, 555) (Will, 2026-10-29) — a floating TOOLBAR at the canvas's top left: a horizontal group of icon buttons, in the style and offset of the canvas controls (bottom right). In it: a placeholder Save, then Undo and Redo | feature |
| ⬜ | 30r | 561 | NODE EDITOR, AFTER the workflow is on the data layer (78 W2–W5, 555) (Will, 2026-10-29) — UNDO and REDO, the toolbar's (560): each edit is a plain function on the draft (plan-78-workflow-data §4), so each one can be stepped back and forward. Will: leverage the data layer's change history (`T-a-store-keeps-its-history`). It is FOLDED and cannot step back alone, but each update already holds the row before and after: an opt-in, capped JOURNAL there gives `store.undo()` and `store.redo()` to any store — the draft's, and a Records edit's. Plan §4 | feature |
| ⬜ | 30s | 562 | NODE EDITOR, AFTER the workflow is on the data layer (78 W2–W5, 555) (Will, 2026-10-29) — a ZIP TIE tool in the toolbar (560). With it on, a line dragged across one or more connectors adds a zip tie, at right angles to them, that funnels them through it with a small gap between each. A dragged tie moves, and its connectors route through it as it moves. It can never go past the horizontal place of the nodes its SHORTEST tied connector joins. A connector may pass through any number of ties | feature |
| ⬜ | 30v | 565 | LEGEND, after 548's core (Will, 2026-10-29) — a legend item may have several rows. Row 1 is always the segment: its swatch, its name, its total. Each row after it is one group: its label and its value, with no swatch | charts |
| ⬜ | 30y | 568 | PRESENTATION, later if needed (Will, 2026-10-29) — a definition may hide the reader's Primary and Secondary chips, so a page controls what its chart shows | feature |
| ⬜ | 30z | 569 | EXPERIMENT, later (Will, 2026-10-29) — an UNFURL GRAPH tool in the canvas toolbar (560): lay the nodes out by an iterative, WEIGHTED VORONOI — an invisible cell per node, the node's centre at its cell's centroid; a cell's weight its connections in and out, each connection on a socket counted; two connected nodes' cells must bisect. Anchor the node with the most connections at the centre (weight × its connections); spread its neighbours evenly round it, weighted by their connections, each nearer or further by its weight ratio to the anchor (a closer ratio, further away), turning them to keep a Delaunay edge; then each next generation, moving an earlier one where a weight needs it. The result: a weighted Delaunay triangulation of the whole graph — a physics-like unfurl, fast and cheap. Will's words in 78's section | explore |
| ⬜ | 30zza | 596 | FILTERS, later (Will, 2026-10-30) — Highlight on hover fires only on a value chip or a menu row. A whole field's matches are of no use: that lights the whole dataset | filters |
| ⬜ | 30zzf | 602 | PRESETS, later (Will, 2026-10-30) — a setting that allows changing those values. A change keeps every downstream filter and value active and turns the preset off: an override deconstructs the preset without losing its conditions across the query. With 601 | feature |
| ❓ | 30zzt | 616 | **→ plan-695 N4.** DATA LAYER, Step 6 — the node engine: W5 `runWorkflow` over the pure functions, with a trace, cancel, dry run, batch writes and typed sockets; after Step 4. HELD (Will, 2026-10-30): "Don't implement anything for the node editor just yet. I want to plan it out for a bit." Nothing here, in 78 or in 555 is built until he says. PLAN: docs/DATA-LAYER-PLAN.md, docs/history/plan-78-workflow-data.md | feature |
| ⬜ | 30zzw | 619 | FILTERS, minor (Will, 2026-10-30) — the Organise chips should not be exempt from folding into a toolbar's overflow menu | filters |
| ⬜ | 30zzzn2 | 650 | PANELS (2026-10-30, found in 636) — the panel areas' room rule counts ONE area: with the filter panel and a fixed panel both in, the Context gets 312px at a 1280 window and 632px at 1600, under the 768px it should keep. `T-the-panel-is-desktop-only` | bug |
| ❓ | 30zzzt6 | 659 | CHARTS (found in 654) — a donut's centre adds up its slices (`T-the-centre-totals-what-the-ring-draws`). Counted, one customer with people in two plans is in two slices, so Records' donut reads 29 customers for 8. ❓ Will: A (my pick) — counted, the centre says the distinct number, 8, so it never claims more customers than there are; B — the centre adds up the slices, 29, and its words change from "customers" | charts |
| ⬜ | 30zzztz | 689 | DATA LAYER (Will, 2026-11-02, after 652 and 687) — status fields (683) may serve other things too: a preset filter, and an Organise criterion (Primary, Secondary, Group). Look into it once the Service Worker work is settled. Will: *"these status fields might be useful with other things like preset filters, organise criteria… We should look into this after the Service Worker stuff is settled."* | data |
| 🚧 | 30zzztzr | 695 | ARCHITECTURE (Will, 2026-11-03) — **D1–D6 all A (Will, 2026-11-03); the order of execution: [plan-695](history/plan-695-architecture.md)** — **T1 ✅ 2026-11-03** (TODO open work alone, done in the archive; the traps split by area); **Wave 1 ✅ 2026-11-03**: S1 + 694, H1 + S3, P1 (in part: the host pins wait for P7), D2, T2 — each lane's notes in the plan; U1 (wave 2) started early, as nothing waits on it; **Wave 2 ✅ 2026-11-03**: U1, S2, S4, H3, D1; U2, P3, N1 and P2 started early, as what they wait on landed; **Wave 3 ✅ 2026-11-03**: S5, U2, U3, P2, P3, H2; N1 (wave 4) done early; **Waves 4–5 ✅ 2026-11-04**: U4, P4, P5, H5, N1, N2, P6, P7 — **plan 695 is done but N4** (TODO 616, held by Will); the deferred rows: 700, 701, T3, 223, 170, 77; then five waves of lanes in parallel; D7 A (Will): lanes BUILD in parallel, each in its own worktree pair; the peer keeps its rows outside the lanes' files. The full review: [ARCHITECTURE-REVIEW.md](ARCHITECTURE-REVIEW.md), notes in [history/architecture-review-notes.md](history/architecture-review-notes.md). Five ideas said many ways: a condition (9 shapes), a command (13 events + 10 requests), a setting (7 paths), a page's state (9 keepers), what happened (no trace). A roadmap in six phases — Phase 1, the spine (one condition tree, one command vocabulary, one trace, store capabilities said once), unlocks 692, 548, 518, the node work and 170; ten bugs (§8, the first is 694). **Decisions for Will, D1–D6** (§12): the condition model, commands, settings, state pins, docs, the nine components no app uses | architecture |
| 🚧 | 30zzztzw | 700 | **PLAN: [plan-700-agents](history/plan-700-agents.md) (with 77 and 223); Will, 2026-11-04: A for Q1–Q9. G0 ✅ (`d05b300e`); G1 ✅ (`851b269c`, the read tier; the old server deleted); G2 ✅ (`df7054aa`, the check tier); G3 ✅ (`50660526`, the query tier); G4 + G5 next; only G6 (runs) waits on N4.** MCP (Will, 2026-11-03) — REBUILD the MCP server from scratch: the old one harks back to early in the project. On the new spine (one condition tree, one command door, one definition model, the trace): compose tools — `generate_page`, `validate_page` against the specs, `preview_page`, `check_usage` — and a pattern decision model for row 77. A tool Sherpa provides later. Ships NO Figma build tooling (Will, 2026-11-03: pulling and processing tokens from Figma is this project's utility, never a consumer's): `scripts/figma-data/name-map.yaml` leaves `package.json` `files`, and the rules doc's Figma half is not served. AFTER the node engine and the refactor ([plan-695](history/plan-695-architecture.md), N1–N4) | tooling |
| ⬜ | 30zzztzx | 701 | PLATFORM (from the review, 2026-11-03) — features to adopt once every engine has them, checked each quarter by the native probe (review §9): CSS `@function` and `if()`, scoped element registries, customizable `<select>` (Firefox); CSS module scripts — then drop the inlined sheets (WebKit); `scheduler.yield` (WebKit); `interestfor` (Firefox, WebKit); the Temporal stand-in (`core/ui/temporal.ts`) once the support floor allows | platform |
| ⬜ | 30zzu4 | 708 | PERF (found by 704's lane) — WebKit's main thread is busy about 1.4 s after a panel press (two tasks of ~670 ms); Chromium has no gap over 60 ms. Profile it | perf |
| ⬜ | 30zzu6 | 710 | TRAPS (T3's code half, 2026-11-04; the docs half is done, `a0e34847`) — each needs a CODE citation changed: (1) merge the duplicate pair `T-tokens-css-never-reaches-shadow` and `T-a-document-class-cannot-reach-a-shadow-root` (cited in project-tokens.mjs, sherpa-element.ts, the three generated shared sheets, layout-grid.html, group.css and four specs); (2) `T-grid-header-needs-capture` lost its reason with P4 — measure whether capture is still needed (the comment at `sherpa-data-grid.ts:419` says "the chip's"); (3) `T-an-open-panel-follows-the-data-layer` names the deleted panel (`source-binding.ts:323`); (4) a stale comment at `filter-state.ts:109` (the chip's "info-blue and fx badge"); (5) about 138 mentions of the legacy panel (deleted in 476) and a few older names (`#syncDateLabel`, `setFieldReading`, `bindLegendFilter`, `pushChips`, `#pendingItems`, `#syncSortLabel`, `#resolveTemplate`); `T-grid-key-or-position-lies` says a keyless grid reports no keys, but it now falls back to the data layer's key | docs |
| ⏸️ | 30zzu8 | 712 | **HELD (Will, 2026-11-04): until the data layer and filter reworks are in a good place.** SPARKLINE (Will, 2026-11-04) — a setting, ON by default: 'Use Sparkline points as Date Range preset filters'. On, clicking a sparkline point TEMPORARILY overrides the View / App Context date range with that point's time span; it is treated as a PRESET, so the Date chip takes its look and state from the preset logic that exists. Clicking anywhere on that sparkline, or on the Date chip, while the override is on removes it. While it is on, that sparkline's other points FADE, and every other component follows the temporary range — the other metric cards' values and segment counts change. Will, 2026-11-04: a click on a DIFFERENT point also removes the override (A: any click on the sparkline removes it); after a reload the override is gone (A: it is temporary). After 705's fix lands (it changes the sparkline and the provider's summary path). Keyboard parity: a point is pickable without a pointer (PRINCIPLES 21) | feature |
| ⬜ | 30zzu9 | 713 | NODES (Will, 2026-11-04) — **PLAN: [plan-713](history/plan-713-node-model.md) — M1–M6. Will, 2026-11-04: D1 B but agnostic (the header input takes any type; the node's rules decide); D2 truthy (not 0, null, none, false); D3 A (the condition type is a row picklist); D4 per socket (`many`); D5 A; D6 B (False red); D7 A; D8 A, and convert the saved v1 graphs.** the node model, before N4 (TODO 616): (1) a CONDITION node — pick a field, compare its values against given parameters, pass the output on (Demos' Health node today lists its data conditions as strings); (2) a node OUTPUTS a value, an object or a true/false boolean: an input row has an output socket for a value or an object; a node's HEADER has an output socket for True; a node's FOOTER (new; it will have other uses) has one for False; (3) input sockets take an explicit value, an object, a boolean, or 'any' where it fits; (4) every socket type is colour- AND shape-coded, inputs and outputs; (5) a socket may take or send several connections; (6) rows that show a text input where a picklist is expected become picklists, and a picklist can be overridden by plugging a text value node into its input. PLAN first (a doc for Will): docs/history/plan-713-node-model.md | feature |
| ⬜ | 30zzu9c | 716 | DATE RANGE (found by 705's lane; Will, 2026-11-04) — **(1) A: `last N` days keeps N days, not N+1** — the filter (688's "from the same day") and the axis (540) agree, so the first point holds one day; a store.ts change, with its specs. (2) A: long axis labels keep "…", the tip says the whole span. (3) Keep "January 2024" for a fixed bucket too: **plain English wherever a reader sees a date; structured formats only for raw data and calculations** | feature |
| ⬜ | 30zzu9d | 717 | CHARTS (found by 705's lane, 2026-11-04) — the line chart centres its x-labels in equal cells, not under their points | bug |
| ❓ | 30zzu9f | 719 | NODES (Will, 2026-11-04, with 713) — (1) GROUP a graph into its own reusable node, preset or custom: simple nodes, combined, become powerful and flexible; (2) a floating PANEL on the left of the editor's canvas: a categorised list of every preset and custom node, to place and test them by hand; (3) a saved node is a JSON definition, saved as saved Views and saved filters are. Guide (old, before the data layer, with gaps): Will's Figma `UaNDhhl1fawHB0K9KqJFxA` (ACP Module), page "Node Graph Exploration", node 2872:32139. **PLANNED: [plan-713 §9](history/plan-713-node-model.md) — M7–M12; D9–D17 wait for Will.** Multi-select picklists (Will, 2026-11-04): a multi-select row outputs an OBJECT, the set of picks (§9.5) | feature |
| ⬜ | 30zzu9g | 720 | FILTERS (found by 715's lane, 2026-11-04) — the toolbar's own `#render` still MOVES every chip it keeps, the shape that lost a press in 715 (`T-a-chip-moved-under-a-press-loses-its-click`): place chips without moving one that is already in its place | bug |
| ⬜ | 30zzu9h | 721 | PANEL (Will, 2026-11-04) — (1) the panel-mode toggle shows in EVERY filter toolbar, chart toolbars too, and still respects "Include View Context in the panel"; (2) a chart's Organise chips (Primary, Secondary, Group, Sort) and its Filters button make the move from toolbar to panel — **Will's ruling, 2026-11-04: the toolbar (or panel section) belongs to the PRESENTATION (Show as, Primary, Secondary, Group, Sort — as plan-713's Presentation node); the card is only a container that sets the presentation type and is told its title label. Type the data presentation content that way;** (3) each panel accordion has its OWN Filters button in its header, not one in the panel header — and none when the accordion holds only ONE field section (its values are already open) | feature |
| ⬜ | 30zzu9i | 722 | BUG (Will, 2026-11-04) — the panel's Organise and Preset sections lack the light-grey hover fill the other sections have | bug |
| ❓ | 30zzu9j | 723 | EXPLORE (Will, 2026-11-04) — are Organise and Preset just the new Advanced/Conditional fields? If so, refactor them into that format, so every section in the panel (and the toolbar?) runs on the same logic. Read-only study first: what Organise and Preset hold today vs. a conditional field; one decision for Will. Fixes 722's cause too, if the hover fill comes with the shared section  **STUDY DONE, 2026-11-04 (Will chose A: 723 first).** (a) PRESET: yes, nearly — `T-a-preset-is-its-own-part` already says it is a wrapper round stacked Advanced conditions (`{id,label,where}`), its rows ride in `byPreset` beside the answer, and its chip is a boolean. What differs is only its chip and scope placement. (b) ORGANISE: no — Group, Sort, Primary, Secondary are ARRANGEMENTS (`group/sort/chartFields` on the scope description), they make no clause. They are the Presentation (plan-713's node: Show as, Primary, Secondary, Group, Sort). (c) So the shared shape is one SECTION contract — a header, then items, each item a field, a preset or an arrangement — not one condition format. (d) 722's cause: the hover fill is `.chips > .chip[data-layout="section"]:hover` (toolbar css:640); Organise chips sit in `.organise-zone`, not `.chips`, and a preset chip has no `data-layout="section"`. **Pick for Will:** A — one section contract, 722 fixed by it; or B — keep three kinds, widen 640's selector now. | explore |
| ⬜ | 30zzu9k | 724 | TESTS (found by 718's lane, 2026-11-04) — Demos `reforged-filter-column.spec.ts:27` expects the chart title "By status", but since 711 it is "Customer by Status" (in all 3 engines, on the old build too): the spec is stale | test |
| ⬜ | 30zzu9l | 725 | TESTS (found by 718's lane, 2026-11-04) — Demos `reforged-filter-chips-green.spec.ts:43` fails 2–3 in 60 in Firefox under parallel load, old build and new | test |
| ⬜ | 30zzu9m | 726 | BUG (found by 718's lane, 2026-11-04, measured) — over a HELD set, a server field's kept keys hide a newly added row until a Refresh | bug |
| ❓ | 30zzu9n | 727 | DATA (found by 707's lane, 2026-11-04) — a server field over a HELD set: A, keep the instant answer from the held rows, then the server's keys (2 compiles per Apply) / B, wait for the server's keys (1 compile, the rows wait one round trip). Pick A | decision |
| ⏸️ | 34 | 470 | TEST — WebKit flake: leaving Settings (Back or Esc) restores the Context and its View times out now and then (Demos `reforged-settings-overlay:55`); passes on retry, seen in two full runs 2026-10-26 | tests |
| ⏸️ | 36 | 429 | DEMOS — a SHAREABLE build of Sherpa Demos: the receiver opens index.html, with nothing to install. After 425–428 (Will, 2026-10-23). Paused: Will, 2026-10-23, "discard for now. We'll do it later" — both commits reverted | demos |
| | | | **Later — held or deferred by Will, or big and last** | |
| ⏸️ | 37 | 350 | PERFORMANCE — Sherpa is slow under 4x CPU throttling: find the costs, the fixes and the options. 10-22: GOOD at 4x on localhost, gate `check:perf` in Demos; the slow load is the network (221 requests). D1 A, built 10-22: `dist/bundle/`, 33 requests — Will: better than it was; not a priority now | explore |
| ⏸️ | 38 | 379 | FILTERS — 375's DATE half, held by Will: a date range as an Advanced Between, the View's Date chip, and Contains / Does not contain picking a weekday, Weekdays or Weekends. Will, 2026-10-27: "Skip 379 for now" | filters |
| ⬜ | 40 | 392 | 369's LAST part — a remote store NOT held reads one customer's sites when its row first opens (Q4 A). It needs a twisty on a parent whose children are unread, a new menu event relayed by the bar, the panel and the grid, and a source door. No app has such a store (Demos holds its data). **A (pick):** wait until a real remote tiered store needs it. **B:** build it now. **Will, 2026-10-21: A** — waits | filters |
| ⬜ | 42 | 223 | **→ plan-695 after D1 and P6.** DEFERRED — server rendering with declarative shadow DOM, after 208 | explore |
| ⬜ | 43 | 76 | FUTURE (Will, 2026-10-14) — WebMCP: agents do UI tasks through Sherpa's own contracts — not critical now | explore |
| ⬜ | 44 | 77 | **→ plan-695 with 700.** LATER, important — UX patterns DEFINED by contract, so a consumer adds its own; never baked into Sherpa | explore |
| 🚧 | 45 | 78 | **695 N1 (2026-11-03):** W2–W4 built (one registry, `bindWorkflow`, Save); W5 is N4. **→ plan-695 N1–N4.** LATER, large — node components and their logic in Sherpa; the workflow creator is an app on the canvas and nodes. The sandbox is up: Demos' Node Editor (2026-10-29) | explore |
| 🚧 | 45a | 671 | **695 N2 (2026-11-03):** a node lights while its step runs, with its time, rows and host (page or worker), from the one trace stream; any code reports a step with `traceStep`. Left: running a workflow (N4) and a dry run. **→ plan-695 N2.** LATER, explore and plan (Will, 2026-11-02) — the Node Editor graph SHOWS a workflow as it runs: the Service Worker's steps across the Presentation layer, the Data layer and the Backend; the node of the current step lit; decision points and branches; the time a step took, on its node. For ANY deterministic workflow drawn as Sherpa nodes. Run it, or simulate it with no writes. A workflow handler component handles every workflow one way, as the Query handler does queries: the Service Worker, any code or an AI agent tells it state, progress and timing, and it tells any Node Editor that listens. Not before the Service Worker (652) and the data layer are solid. With 78 and 616, which Will is planning | explore |
| ⬜ | 46 | 170 | **→ plan-695 H5 (its plan), then 170.** **H5 ✅ 2026-11-03: the Node host is built and 170's PLAN is written — `docs/ARCHITECTURE.md` §8** (after H5 the stores run on the server, the Query on the client, a held set of up to 100,000 rows between; 170 would move `DataSource` itself to the server, only for larger sets). MAJOR, LAST, and only when Will says — the data layer runs on the client, the server, or both, whole or in parts | explore |
| ⬜ | 47 | 514 | DATA (from 341, Will 2026-10-27: 3 B, its own item) — two colour words in formatted data: `colorIndex` (aggregate.ts, on `ChartDatum`) and a part's `swatch` (data-source.ts). Each is the value's place in its field's declared order, 1-based: name it that, an ordinal, and let the chart pick the colour. Large public churn: `ChartDatum` and every chart | refactor |
| ⬜ | 48 | 522 | LOOK, later (Will, 2026-10-28) — with the accessibility setting on ("Show state by shape", `html[data-toggle-shapes]`, TODO 497/503), the checkbox inside a chip is a bit too small and its check icon is hard to read | look |
| ⬜ | 48a | 534 | FEATURE, later (Will, 2026-10-29) — a setting to RESIZE the Navigation's width. On, a handle shows in the gutter between the Navigation and the Content. Collapsed: dragging the handle right pins the nav and sizes it between 50% and 100% of its pinned width. Pinned: dragging below 50% of its pinned width collapses it. The offset that sizes the Content by the nav's width and mode follows the resized width. HTML and CSS first, JS last (progressive enhancement) | feature |

**Why this order** (reassessed 2026-09-29, after the Query (73), the provider
(85) and the page definition (92) were built: what was left of the foundation
first, then the bugs, then the filter features).

- **B — what is left of the foundation.** 86 first: an ASSESSMENT for Will to
  rule on, so it costs no code while he reads it. Its last step, A7, is built
  WITH 102 (agreed 2026-09-29): the menu owns the reading, so both answers are
  kept in one place. 75 (done) came before any filter feature, so 89, 90, 98
  and 99 are built in the new words. 38's one builder is built WITH 89 (see D).
- **C — Contained bugs.** Each is fixable in its own component or page. In
  pairs where one fix serves both: 45 and 82 (a chip's face after a silent
  set), 83 and 94 (a menu's footer).
- **C2 — Consumers** (2026-10-12). Will: *"Sherpa needs to be easy for
  consumers (developers and agents) to work with. Its components also need to
  support individual components being used with other frameworks as well as
  serving up its own app layer/boilerplate for pure sherpa app projects."*
  Three runs, in order. FIRST the small items that wait on no ruling (c1–c9),
  then the fixtures that prove them (218). THEN the framework track, on 195's
  manifest: typings, events, markup, forms, inline text, tokens, the guide, the
  adapters. LAST the app layer, which waits on 183's choices: one grammar (197),
  `app.json` (190), the library parts (191), the opt-in entry (221), the outlet
  (194), the app guide (193), the MCP (192), the starter (222). 196 is XL and
  runs beside or after the app layer, as 183 chose. The re-check is
  `docs/history/CONSUMER-REVIEW.md` §5–6.
- **D — Filters.** The panel is rebuilt ONCE: 99 designs how filters group
  first, then 89 (Simple, with 38 step 4's one builder), 90 (Advanced, on
  102's two kept answers) and 21d (its date half), then 98 (the action
  row, on 90). Then 60; 49 before
  50; 20b before any date condition ships.
- **E — Views and navigation.** 15's save is built (`provider.saveView`); what
  is left is Records' dialog and the split button.
- **F** uses the remote flag to show its states. **H** comes after the markup
  settles, before new components, so they must pass it. **I**: 68 and 27 are
  one door; 67 takes over the router's `open()`. **J**: 29 dead last — it
  touches every import.
- **K — Agentic UI** waits; each row says until when.
- **L — The code review** (2026-10-14) is the work in hand:
  `docs/CODE-REVIEW-PLAN.md`, ruled by Will. Its rows run in the plan's order; a
  bug or gap found while reading joins at the end.

---

## A — In hand

### `[~]` ❓ 350 — PERFORMANCE: what costs, what can be faster, and the options

Will, 2026-10-19: *"I set cpu throttling to 4x in dev tools and the performance
of Sherpa-UI is miserable. We need to investigate what the performance hits
are, how sherpa can be optimised, and what our options are."* **Deferred until
the data layer is explored and changed (345–349)**, as some of that may help.

**The biggest hit, measured by Will (2026-10-19):** Interaction to Next Paint
(INP) of about **600 ms** under 4x throttling, and it comes from the **quick
filter toolbar** — the reason 350 sits after the data layer and filter work.

**The target (Will, 2026-10-19): GOOD performance even at 4x CPU throttling.**
"Good" is the Core Web Vitals line: **LCP ≤ 2.5 s, INP ≤ 200 ms, CLS ≤ 0.1**,
held here as LAB targets at 4x. Today: LCP 6.18 s, INP ~600 ms, CLS 0.01 (Will,
measured — well inside good; keep it there). 350 ends with a
gate that holds them — Playwright at `Emulation.setCPUThrottlingRate` 4,
reading LCP, INP and CLS from a `PerformanceObserver` on Demos' Records page and
the toolbar's acts — as `check:bench` holds the data layer.

**Will's rule while 345–349 are built:** where a performance fix is in reach
of that work, make it then. 350 is still done as its own exercise.

**Page load, measured by Will (2026-10-19):** opening Demos' Records › All
customers gives a Largest Contentful Paint (LCP) of **6.18 s** — rated poor.
*"Definitely lots of work to do regarding optimisation."* Measured at 4x CPU
throttling, as the INP was (Will confirmed). Leads to measure first, not yet proven:

- Demos imports `sherpa-ui` as `/dist/index.js`, which pulls **143 modules,
  963 KB** of JS before any icon (counted 2026-10-19, static imports only), each
  its own request: nothing is bundled.
- The Records Context waits for the store's seed (`ready`), then `openSource()`
  reads the rows and their values before any component is answered.
- Each element parses its template and adopts up to nine shared sheets, plus
  family sheets, and the Records page draws a bar, a panel, charts, metrics and
  a grid of 25 rows.

In scope, as Will named it:

- what costs time, measured under 4x throttling, not guessed;
- how Sherpa can be faster, and the options, each with its trade-off;
- REDUNDANT code and LEGACY code;
- CONVOLUTED implementations or solutions;
- COMPOSITION bottlenecks (a component made of components made of components).

What is known already, to start from (not yet measured under throttling):

- `check:weight` says one button imports 13 files, 19.8 KB brotli (266 KB raw),
  and `index.js` is 313 KB brotli (1.26 MB raw): the base class and the shared
  sheets ship with every component (2026-11-03, 695 T2).
- `check:bench` counts the data layer's loads, counts, compiles and clones per
  act; 291 made a value pick go from 10 loads to 2, and its steps 7–8 (one test
  per filter, one compile per act) wait for a run. 287 and 288 split and share
  the data-source code.
- Each element parses its template and adopts up to nine shared sheets, plus
  family sheets; a filter bar composes chips, menus, inputs and buttons, each a
  shadow root of its own.

How to measure: Playwright's CDP session can throttle (`Emulation.setCPUThrottlingRate`,
rate 4) and record a trace, so a slow path becomes a repeatable number in a gate,
as `check:bench` does for the data layer.

**Measured 2026-10-20, after 347–349, 352 and 355** — Demos `perf/`, headless
Chromium, 4x CPU, no network throttling, against :4200:

| | toolbars mode | panel mode | target |
|---|---:|---:|---:|
| LCP (`cls.mjs`, 3 runs) | 1,308–1,668 ms | 1,016–1,108 ms | ≤ 2,500 |
| CLS | 0.011 | 0.013 | ≤ 0.1 |
| worst INP (`inp.mjs`, median of 5) | 176 ms, saved filter on | 112 ms, tick a value | ≤ 200 |

Every act is GOOD in both modes. `inp.mjs` now has panel acts (it hung before:
its acts pressed the bars, which step back in panel mode). **Not the same
measure as Will's 6.18 s**, which was in his own browser: a DevTools run with a
cold cache or network throttling can differ. Will to check by eye. Left: the
Firefox `reforged-a-reopen-shows-at-once` timing under 3-engine load, and the
"saved filter on" profile (the base class's stamp is the most self time). A
flake seen once in a full Demos run (2026-10-20, Chromium, passed on retry and
5 of 5 alone): `reforged-view-chips.spec.ts:445` — after a reload the heading's
Advanced filter read `null` while its chip was on. And `reforged-nav-pin-persist.spec.ts:63` (a
pinned rail after a full reload), once; neither failed in 108 repeats alone.
After 367 and 368, one saved-filter click still builds about 100 elements: the
grid's 25 rows (each with its checkbox and that box's button), one bar menu's
body (a number slider, inputs, a footer — `sherpa-menu` inside `.act`), and each
chart legend's 4 entries with their tooltips. The bar parts wait for 366's
commits 13–14, which rewrite how a bar paints; row reuse in the grid is its own
item if a measure asks for it (the click is 56 ms at 4x).

**Measured 2026-10-22, after 345 and 366** — the same scripts, Chromium, 4x
CPU, against :4200: LCP 980 ms (toolbars) and 864 ms (panel), CLS 0.011 and
0.013, worst INP 96 ms (a panel tick; it was 176 ms). Every act is GOOD.

✅ **The gate exists:** Demos' own script `check:perf` (its perf/gate.mjs) opens
Records in both modes at 4x CPU and fails over the GOOD line — LCP 2.5 s, CLS
0.1, INP 200 ms per act, the median of 3. It needs :4200 up, and runs alone,
never beside a test run. Not in `npm test`: a loaded machine moves the numbers.
Note: INP counts until the next paint, so work an act starts after it (a
load, a publish) is not in the number.

**The gap to Will's 6.18 s is the NETWORK, not the CPU.** With an empty cache,
Records asks for 221 files — 211 scripts — and the browser finds each import
only after the file before it lands, uncompressed (1,435 KB). Measured with
three copies of Demos on a probe server (4x CPU, empty cache, LCP of 2 runs):

| | as served today | gzip only | sherpa-ui bundled + gzip |
|---|---:|---:|---:|
| Fast 4G (60 ms, 9 Mb/s) | 3.45 s | 3.15 s | **1.6 s** |
| Slow 4G (150 ms, 1.6 Mb/s) | 10.2 s | 7.2 s | 3.8 s |
| requests · bytes | 221 · 1,435 KB | 221 · 415 KB | 74 · 307 KB |

On localhost (no latency) all three are about 1.0 s. Compression alone helps
little: the chain of requests costs the time. The bundle was esbuild over
`dist/index.js` and `dist/data.js`, split, minified; each icon stays a small
lazy chunk; `index.js` is 174 KB gzipped. The 74 requests left are Demos' own
files (its Context, templates, definitions, stores) and the icons.

**✅ D1 — how an app loads Sherpa: Will, 2026-10-22, A** (*"let's move the
bundling to sherpa rather than the consumer apps"*). **A (my pick):** sherpa-ui's build also
writes a BUNDLE per entry (`dist/bundle/`, split, minified; a new export such
as `sherpa-ui/bundle`), Demos' import map points at it, and Demos' server
compresses. An app with its own bundler keeps the modules as today. Cost: a
second copy in `dist/`, a few seconds of build. Measured: Fast 4G 3.45 s →
1.6 s (GOOD). **B:** keep the modules, and the build writes a
`modulepreload` list per entry, so the browser asks for every file at once;
plus compression. Less change, but still 221 requests (6 at a time on
HTTP/1.1), and not measured yet.

**What A means for an app** (Will asked, 2026-10-22). The build adds one step:
esbuild joins each entry (`index`, `data`, `app`, `components`) into
`dist/bundle/`, split so the entries share their common code and each icon
stays a small lazy file; about 1.8 MB more in `dist/`. New exports
`sherpa-ui/bundle`, `/bundle/data`, `/bundle/app`, with today's types. An app
WITH a bundler changes nothing. An app WITHOUT one (Demos, Gallery, every
Starter app — all use an import map to `dist/index.js` today) changes one
import-map line; its code does not change, and the Starter template starts on
the bundle. A page uses the bundle OR the files, never both (two copies of
every class); `check-usage` would warn. One component alone, and live reload,
stay on the files. Compression is the app server's: Demos turns it on.

**✅ Built 2026-10-22.** `npm run build` writes `dist/bundle/` (esbuild, split,
minified); exports `sherpa-ui/bundle`, `/bundle/data`, `/bundle/app`,
`/bundle/components`. The 73 icons the components draw ride inside it as data
(`registerIcons`); an app's own icons stay lazy. A dev build writes
pass-throughs, so live reload still works. Demos, Gallery and the Starter
template map to it; Demos' server compresses text (brotli or gzip) and keeps a
hashed chunk for good. Records, 4x CPU, Demos on its own server:

| | requests | fast 4G cold | fast 4G warm | slow 4G cold |
|---|---:|---:|---:|---:|
| before | 221 | 3.45 s | — | 10.2 s |
| after | 33 | 2.1 s | 1.4 s | 4.0 s |

TRAP `T-a-page-loads-the-bundle`. **Will:** restart Demos' :4200 server to get
its compression; the bundle itself is live already.

### `[ ]` ⬜ 364 — BUG: a Button's tooltip is clipped; one tooltip system (DEFERRED)

Will, 2026-10-20: *"Button tooltips are not at the CSS top level and as a result
get clipped by other components or container bounds. I suspect this is to do
with tooltip anchoring to buttons being done differently to other components
as other component tooltips don't have this issue. It would be great if we just
had 1 tooltip system for all components rather than any duplication and
deviation."* When convenient.

**Deferred, much later** (Will, 2026-10-20: *"Focus on 345, and other data and
performance improvements, as a priority."*). A read-only design ran first; its
maps, design and check are in `docs/history/plan-364-tooltips.md` for then. The
cause it found: the tip's lift listens on the `document`, and a pointer or Tab
moving between two parts inside ONE component never reaches the `document`, so
CSS shows the tip in place, where its box clips it.


### `[~]` 🚧 518 — REVIEW: the filtering code, and each component alone

Will, 2026-10-28: review all the filtering code and behaviour for conflicts,
duplication and needless complexity; optimise without changing the
architecture or what it does; and every UI component works ALONE with the data
layer. Three read-only reviewers; their 57 findings, each with its phase, are
in [history/review-518-filters.md](history/review-518-filters.md). Phase 0 is
Will's 519 and 520; 1 the bugs against rules already made; 2 the same
behaviour, simpler; 3 each component alone, after Will's two choices.

**❓ For Will:** R2, R4 (revised 2026-10-29), U1, U9 and 521's question — each
with its background and my pick in
[history/report-518-523.md](history/report-518-523.md), the report of this work.

### `[ ]` ❓ 489 — SETTING: "Select none shows all data", off by default

Will, 2026-10-27: *"Add a filtering setting to have 'Select none shows all
data'. Have this setting off by default. When off, if Select All isn't ticked
for a filter then no data is returned for that filter. The user has to select 1
or all for this to return data. When on, Selecting no items in a filter menu
shows all of the data for that field. Set the Customer and Regions filters, in
all Sherpa Demo view definitions, to have Select All active by default."*

NOTE: OFF is the opposite of 480 (the last value let go shows every row). On is
480's rule. Will, 2026-10-27, A: while OFF, nothing ticked is NO rows however it
came — Select none or the last value let go; the chip stays on at 0. ON, nothing
ticked is every row (480).

**Plan, 2026-10-27.** Today only a list whose picks FETCH says none, and only
by Select all off: the toolbar hands `fetches` to `menuFor()`, the menu wears
`data-fetches`, and the chip and the menu read it for nothing else.

| # | Step | Where |
|---|---|---|
| 1 | `fetches` / `data-fetches` become `empties` / `data-empties`: "nothing ticked here is no rows". The toolbar sets it unless its bar wears `data-none-shows-all` | `filter-menu.ts`, toolbar, `sherpa-menu`, `sherpa-quick-filter` |
| 2 | The menu says `none` on EVERY reader act that leaves a multi list empty — a row let go and an Apply, not only Select all. Clear is not one: it removes the filter | `sherpa-menu` |
| 3 | A grid heading's list does the same: an Apply with nothing ticked holds `{ picked: [], none: true }`, ON at 0 | `sherpa-data-grid` |
| 4 | `provider.noneShowsAll` (off by default) writes `data-none-shows-all` on each bar, panel and grid | `sherpa-provider` |
| 5 | Demos: Settings › Filtering › "Select none shows all data", `/filters/noneShowsAll: false`. Customer and Region already open with Select all ticked (`"start": "all"` in both schemas) — checked on screen | Demos |
| 6 | Tests: 480's "last value let go shows every row" holds only with the setting ON; OFF gives none | sherpa-ui + Demos |

**Part 1, done (2026-10-27)** — steps 1–4 and 6, and the switch of step 5. A
grid cell's filter chip follows it too: pressed twice, its value let go, no rows.

**Part 2, done (2026-10-27, Will B).** ALL is a flag, the mirror of none —
`{ picked: [], all: true }` — not a list of every value: a list went stale (a
new value unticked; a chained Region kept the regions the Customer has not,
ticked and greyed). Customer and Region open on it, ON, reading All. Demos tests
that pick from no answer start there with `fromNoAnswer(page)`. TRAP
`T-all-is-an-answer`.

❓ **Part 2 (asked).** Probed on :4200: Customer and Region open with NOTHING ticked —
`"start": "all"` means "no filter", drawn as no ticks. Will wants Select all on.
But Will's 2026-09-22 rule (TRAP `T-everything-on-is-no-filter`) is that every
value ticked must LOOK like no filter: the chip off. **A (my pick):** every value
ticked, the chip OFF — all ticked filters nothing, as 09-22 says. **B:** every
value ticked, the chip ON, reading All — a choice in force.

### `[ ]` ⬜ 484 — LAYOUT: a sticky metrics row sits above the layout grid

Will, 2026-10-27: *"When a metrics row is sticky, I think we need to move it out
of the layout grid and place it above it inside the content area. With this done
we can let the layout-grids scroll under inner shadow conditions handle the
shadow effect. We no longer need a drop shadow on the metrics row when scrolled
under."*

**Found 2026-10-27.** The row is the layout grid's first item, sticky in the
app shell's Context frame (the one scroller, `T-only-the-context-scrolls`), with
its own shadow strip. It cannot simply leave the grid: its column count, gap and
row height are the grid's (`:is(.sherpa-grid, sherpa-layout-grid)` re-points
them per width; outside one it reads the 4-column root and draws joined).
**❓ Asked Will:**
- **A:** Demos only — a stack holds the metrics row (fixed, in a one-row grid)
  and below it the grid in its own scrolling box, with that box's scroll shadow.
- **B (my pick):** the app shell gets a FIXED region above the Context's scroll
  area; a page puts its metrics row there, and the shell's own scroll shadow
  shades what scrolls under it. Any page, one system.

### `[ ]` ⏸️ 470 — TEST: a WebKit flake leaving Settings

Seen 2026-10-26 in two full Demos runs: `reforged-settings-overlay:55`
(leaving Settings by Back, or by Esc, restores the Context and its View) times
out in WebKit and passes on retry. Find what it waits on.

**Parked, 2026-10-26** — Will: *"ok for now"*.

### `[ ]` ⬜ 429 — DEMOS: a shareable build that opens from index.html

Will, 2026-10-23: *"Once finished with these filter-toolbar, and sherpa demo,
changes: Make the Sherpa Demos app a shareable build that can be run locally
without any installation. Ideally the receiver of this build can just open
index.html and have the app run."* Note: Chrome blocks ES module scripts and
`fetch()` from a `file://` page, so the build must inline its modules (one
classic script) and its JSON and templates.

Built 2026-10-23, then discarded: in Sherpa Demos, its `build:share` script wrote `share/index.html`
— the whole app in one 1.6 MB file: one inline module, the tokens CSS, and
every file app.json names. The outlet takes them as `files` (a module's
exports, any other file's text) and fetches none; the Demos script moved from
index.html to `app/main.js` so it can be bundled. Opened from disk it works in
Chrome and Firefox; Safari loads the page again on each route change. A Demos
test builds it and opens it from disk in three engines. Its trap note went
with the revert; the revert of the revert brings it back.

Will, 2026-10-23, after it was built: *"Hold off on the Sherpa Demos to
share build for now."* Then: *"429 - discard for now. We'll do it later."* So
both commits are REVERTED (sherpa-ui 471b50a8, Demos d7d3914). Later: revert
the two reverts, and it is back — the outlet's `files`, `fileText()`, the
Demos script in `app/main.js` and its `build:share`.

## C2 — Consumers: frameworks, apps and agents

Planned 2026-10-12 from three read-only reviews: 183's problems re-checked
against the code, and a new one for other frameworks. Findings and file:line
evidence are `docs/history/CONSUMER-REVIEW.md` §5–6. Each item says what it fixes;
the review holds the detail.

### `[ ]` ⬜ 223 — DEFERRED: server rendering with declarative shadow DOM

A `sherpa-ui/ssr` that renders `<template shadowrootmode>`, and a constructor
that keeps a declarative root instead of re-stamping it. Needs 208. Until
someone needs SEO or pages without JS.

## I — The big builds

### `[ ]` ⬜ 170 — MAJOR, later: the data layer on the client, the server, or both

**Do not start this until Will says.** Everything else comes first.

Will, 2026-09-30: *"Consumers of sherpa should be able to choose to run the
whole, or parts of, the data layer on the client and/or server side.*

*For example Sources and Stores could live on the server, while Filter/Query
components could be client side.*

*Or a filter/query component could run on both sides. Client side handling
immediate front end changes. Server side handling the shaping of data before
sending responses.*

*Everything else can come before this exploration. Note it but don't start it
until I say."*

What is there to start from, when he does: `sherpa-ui/data` already has no
DOM (the lint boundary and a node test hold it), and the Query is plain JSON.

---

## K — Agentic UI: much later

Will, 2026-09-27: *"We built an MCP to help with the Sherpa development
pipeline and it's been useful. However, I'd like to support WebMCP as part of
the sherpa framework so that we can create agentic UI components and have them
be able to use agents to perform UI tasks for the user."* Big pieces of work,
all inside the Sherpa Product System's own standards. Each is a CORE, GENERIC
system — like the data layer, or routing and template swapping — never a
feature of one app.

### `[ ]` ⬜ 76 — WebMCP: agents do UI tasks through Sherpa's own contracts

**DEFERRED.** Will, 2026-09-30: *"we can defer the WebMCP aspect for now."*
Not to be started in the churn; it waits for his word.
**Will, 2026-10-14:** *"WebMCP can be a future feature. Not critical for
sherpa at this time."*

Agentic UI components: a component exposes what an agent may do with it, and
an agent does it for the reader. Will's examples — *"generating data viz and
adding it to a dashboard, creating filter queries based on user request,
generating reports from data pulled back into the Sherpa data layer, and other
cool stuff that I've not even thought of yet."*

What is already there to build on: the MCP server (`mcp-server/`, its drive
tier reaches a live element by name and method), the component specs
(`*.component.yaml`, a component's callable surface), and the QUERY (step 1–6
of 73) — a filter request an agent makes is a Query, validated and compiled
like any other, never a clause it writes itself.

### `[ ]` ⬜ 77 — CONTRACTED UX patterns, so a generated experience is consistent

*"We will also need well defined, contracted, UX patterns so that any
generated experiences by agents are consistent and useful."*

**Will, 2026-10-14:** *"UX patterns will come later, too, but will be
important. These must not be baked into sherpa but rather be definable, in
some sort of contract, so that consumers of sherpa can add their own patterns
and use them."* So Sherpa ships the CONTRACT for a pattern, and a consumer's
patterns are data under it — Sherpa's own are examples, not the only ones.

A pattern is
data with a contract, as a component is: what it is for, which components it
composes, which states it has, what an agent may change. An agent composes
patterns; it never invents a layout. The CRUD flow, Settings pages as forms,
and the filter scopes are the first ones this repo already has in prose.

### `[~]` 🚧 78 — A node-based WORKFLOW creator

*"A node based workflow creator that can be used to create, edit, and view the
core patterns, as well as any generated workflows in an app, so that we can
merge agentic, generative, thinking with deterministic, contracted,
experiences and outcomes."* It draws on the canvas — 25,
`sherpa-layout-canvas`, which is why Will asked for one. Nodes are patterns
and steps; edges are what flows between them; a generated workflow is shown
and edited the same way as a designed one.

**Will, 2026-10-14:** *"The node based workflow creator is an app using the
canvas and node components. We haven't created the node components or their
logic in sherpa. So that is what we'll have to do here. Again, large piece of
work to do later."* So the Sherpa work is the NODE components and their
logic, beside `sherpa-layout-canvas`; the creator itself is an app built on
them.

**🚧 The sandbox, 2026-10-29 (Will: *"setting up the sandbox for working on
this together"*).** Demos' Node Editor Context (`?context=node-editor`, nav
section Workflows; Demos `2f93abe`): the canvas, three stand-in nodes and two
connectors. A node is a `sherpa-container` card, sized `block-size: auto` as
the plane gives it no height; a connector is an SVG path that
`contexts/node-editor.js` draws between its two nodes. Swap each stand-in for
the real component as it is built.

**Round 2, 2026-10-29 (Will).** The crosshair is half as thick and half as
dark. A minimap drag keeps its hold on the frame, the map holds still while it
drags, and the frame stops at the map's edge. **`sherpa-node`** is the first
node component (Will: *"consolidate all of the reusable node functionality like
dragging, inspecting"*): a drag on its header or the arrow keys move it, and it
reports `node-move`; a press reports `node-select`, and the host writes
`data-current`, which pins Style=active (`T-a-node-moves-itself-and-reports`).
Demos selects a pressed node and opens an inspector overlay panel: Name,
Description, X and Y write the node, and ID, Inputs and Outputs describe it.
The connectors are still stand-ins.

**Round 3, 2026-10-29 (Will) — rows and sockets.** Plan:
[plan-78-node-rows.md](history/plan-78-node-rows.md). What a node showed is its
HEADER; below it, its rows. **`sherpa-node-row`**: an input socket, a field (a
`sherpa-input-text`: text, select or number) and an output socket, each
optional; a row with no field names itself with `data-label`.
`data-input-socket` and `data-output-socket` (`value`, a circle | `object`, a
diamond) are on the node for its header and on a row (`SHARED_PROPS`); each
draws them from `sherpa-node-sockets.css`, on the card's edges, and
`socketRect(side)` says where one is. A drag is no press: its closing click
selects nothing (Will). Demos' Filter node picks a Key and a Condition, takes a
Value from a Value node's row, and reports Matches; its stand-in connectors now
join sockets. NEXT (Will): the data layer — load a definition, edit routes and
values, run the flow.

**Round 4, 2026-10-29 — the data layer: a PLAN.**
[plan-78-workflow-data.md](history/plan-78-workflow-data.md): a workflow is one
JSON definition (nodes, their values, routes between sockets), checked by a
schema; node KINDS run over the data layer's own functions (`filterRows`,
`sortRows`, `readField`…); edits go to a per-tab DRAFT in `SessionStore`
(551), and Save writes the definition. **Will, 2026-10-29: A, A, A, A** — a
definition is a row in a Store; the library ships the generic kinds; a
`bindWorkflow()` helper draws and binds; a route is a drag from socket to
socket. Steps W1–W5, one commit each.

**W1 DONE 2026-10-29.** `schemas/workflow.v1.json`; `src/core/data/workflow.ts`:
the types, `NODE_KINDS` (source, value, pick, filter, sort, group, count,
output) as data, `socketOf`, and `checkWorkflow`, which reports each fault —
a duplicate id, an unknown kind, a value for no row, a route to no socket, a
value joined to an object, two routes into one input, a loop — and never
throws. `T-a-workflow-is-its-definition`; node tests
`a-workflow-is-its-definition`. **Then Will (2026-10-29): queries in the Node
Editor — TODO 555, after 548; AI and agent nodes — TODO 556, later.** W2–W5
wait with 555: they share its binding, sockets and connectors.

**Will, 2026-10-29 — queued for AFTER the workflow is on the data layer:**
557 reroute a connector by dragging its end to another socket; 558 break one by
releasing it over the canvas, or by Delete or Backspace on a clicked one; 559 a
click on blank canvas deselects and shuts the panel; 560 a top-left canvas
toolbar with a placeholder Save; 561 Undo and Redo; 562 the Zip Tie tool.

**Will, 2026-10-29 — added to the plan (§6b, in W3 and W4):** the inspector
shows every row of the node again, as one value with the canvas's row; a row
an incoming route drives is read-only and says "From …", and a row whose value
goes out says "To …", with the socket marks beside it.
**Will, 2026-10-29 — an experiment for later, TODO 569 (Unfurl graph), in his words:**
*"Add an unfurl graph tool to the toolbar. It should iteratively create an
invisible weighted voronoi cell for each node on the canvas. Node centre points
are positioned at the centroid for each cell. Adjust the weight of a cell
centroid based on the number of connectors attached to it (both in and out). Be
sure to count multiple connections on the same socket. A connection between 2
nodes means that their cells must bisect. Start at the node with most
connections. Place it's centroid at the centre and multiply it's weight by the
number of connections. We will use this centroid as an anchor for unfurling.
Then equally distribute each connected node's centroid around the start
centroid. Set their weights based on total connections. Then, using the weight
ratio between each centroid and the start centroid, move each secondary centroid
closer or further away from the start centroid. Closer weight ratios move
further away. Maintain a delauney edge by adjusting the secondary centroid
angles in relation to the start centroid if needed. Then do the next iteration
of node centroids. If a node weight requires a previous generations centroids
to move then we should do that. Each iteration of centroids and weights forces
new accommodations for them. Eventually we should have a weighted delauney
triangulation for all nodes in the graph. Having an anchored centroid and
weighted max delauney edge lengths means this is almost like a physics driven
unfurling. Using voronoi to set the distribution and balance will hopefully
make this fast and cheap to do."*

**Will, 2026-10-29 — §5:** a text row with a routed input MIRRORS the
incoming value and is read only; a change is made only by an operation node on
the route. The row's own typed value is kept, hidden, and back when the route
is cut.
