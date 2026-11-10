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
| ❓ | 30g | 880 | **PLAN ONLY (Will via the Harness session, 2026-11-09): swimlanes in the node editor** — lanes, stages, junction bands, org lane presets, lane rules as derived ghost nodes. Plan and clashes: [plan-880](history/plan-880-swimlanes.md). Core first (lanes, junctions, stages, presets, collapse, drop target); rules and ghost nodes are a later, optional part (Will: no rules yet, concepting) | nodes |
| 🚧 | 30g1 | 886 | **BUILT 2026-11-10 with 887, awaiting a look in Demos.** **→ part of 887.** NODES (Will, 2026-11-10) — move a row's OUTPUT socket out of the node row into a socket wrapper on the node's end edge, as the input sockets are on its start edge: the row's field gets the width back, and an output socket is easier to see | nodes |
| 🚧 | 30g2 | 887 | **BUILT 2026-11-10, awaiting a look in Demos** (TRAP T-a-node-is-three-columns). **PLAN: [plan-887](history/plan-887-node-grid.md) — Will, 2026-11-10: sockets outside the card; a wrapper a socket, expanded; one strip a side, collapsed (as now).** NODES (Will, 2026-11-10) — a node is a GRID of 3 columns: input sockets, node rows, output sockets, in place of sockets offset from their row. "We put sockets in cells where we need them and gaps where we don't. CSS can handle this." A True output socket goes in the cell right of the header. A False output socket takes a row added at the bottom, only as tall as the socket and its wrapper. "All nodes will now also have a wrapper that we can style to connect them to the node body." Takes in 886; keep the collapsed stacks' order (header, rows, footer) | nodes |
| 🚧 | 30g3 | 888 | **BUILT 2026-11-10, awaiting a look in Demos** (Will: a tie is a point in the flow; TRAP T-unfurl-keeps-the-flow). NODES, Unfurl (Will, 2026-11-10, relayed by the Harness Figma session) — "Use zip ties as anchor points, like source, output, and central nodes when performing the unfurl. This prevents previously organised ties and connectors from being too negatively affected by unfurling." | nodes |
| 🚧 | 30g4 | 889 | **BUILT 2026-11-10, awaiting a look in Demos:** `data-joined` on sherpa-node, the active border (`--sherpa-style-active-border-base-1`) on its own fill; `markJoined` in node-graph, `downstreamOf` in node-kinds. NODES, highlight (Will, 2026-11-10) — the ACTIVE border shows what is joined: (1) a connector picked → the nodes it joins; (2) a node picked → every node DOWNSTREAM of it; (3) a row's input field focused → each node joined to that row | nodes |
| ⬜ | 30g5 | 890 | NODES, the rest of the node review (2026-11-10; done: f7ea43c65, 0e30d2d0c, 6a151d017, 4c0c4594b). Each to MEASURE first: a stored workflow's nested writes still draw once each (Break all: N draws; a placed node: 3); `topKinds()`/`doc.kinds` rebuilt ~15 times a draw; `drawGraph`'s three `routes.some` scans per node; its sync `placeFrames` (the rAF draw places frames again); `query.draft` is a `structuredClone` ~11 times an edit; `statusTallies` scans the store per load; `laneBands` is O(n²) with lanes on; a kept Source placed by a reader may draw at the default spot (CHECK). WebKit: `reforged-node-look` "756: picked by the pointer…" fails at its inspector-tab click (Sources stays active), on the commit before 887 too (2026-11-11). Failing on 1275c9d4c, BEFORE 852 (measured 2026-11-11 in a worktree, again at a low load): Firefox `reforged-node-stages` :187 (a frame let go with Shift keeps its nodes in stage-1) and `reforged-node-tags-inspector` :134 (Backspace on a tag chip takes nothing off); WebKit `reforged-node-tags-inspector` :90, :134, :147, :172 (a click times out), `reforged-node-connected-socket` :33 (the white inset), `reforged-node-fetch-caches-the-rows` :247, `reforged-node-tab-scrolls` :63, `reforged-node-polish` :126, `reforged-node-custom` :197, `reforged-node-undo` :275 (the last three by load, maybe). Will's two calls, both A (2026-11-10), DONE: the v1 workflow read and schemas/workflow.v1.json are gone (the MCP serves each contract's newest version now: it served only v1s, so never workflow.v2); the Query's node panel offers no Condition or Status (`QUERY_DRAWN_ONLY`). | nodes |
| ⬜ | 30g6 | 891 | **AFTER 852 (HTML-in-Canvas); a PLAN and Will's yes before code, as for 887.** NODES, typed OUTPUT nodes (Will, 2026-11-11, relayed by the Harness Figma session; source acp-module `.working-notes/32-output-nodes.md`, Figma board "OUT-00 · Output node types", CG-05/CG-05b, RB2-E5): ONE Output node, many types (title = Output, a Type field first, the description says what it does here; the output category's look, the header icon by family); Notify merges in as type Notification (the old item an alias in the panel); an Output may sit mid-graph, its properties feeding on; Simulate never fires one, its caption says what it WOULD do. Families: Notification (channels, to, title, message, link, priority); Content (on a view, AI chat artefact, generated file); Response (toast, alert — a stub, AI chat reply, API response); Request (another agent, ticket); Run result. A registry the host app adds to (agent and ticket are host-specific). Message fields take text with values ({customer.name}, purple tokens), a WYSIWYG Markdown editor with Insert value and a Preview in the Details panel, or an input socket; a value no route gives warns. A grouped Type picker; a type change keeps the shared fields and cuts routes to sockets that go, with a warning. Details panel: Node tab (type, fields, Send a test), Output tab (preview, where each property is routed). Tell the Harness session the TODO number and plan path | nodes |
| 🚧 | 30h | 551 | **695 N1 (2026-11-03):** a moved node keeps its place for the tab and goes when the session ends; a workflow's Save keeps it. Places in a saved PAGE definition: not built (N1 pick A: session only). NODES (Will, 2026-10-29) — a node's place and properties survive a reload, and go only when the session ends — unless the reader saved them to the definition (not built yet). In plan-78-workflow-data.md §4 (W3); Will ruled A on D1–D4 | feature |
| ⬜ | 30k | 554 | DEMOS (Will, 2026-10-29) — Customers, Sites, Region and Date Range are held at the VIEW Context scope: they cannot be moved down to a local scope. A local scope may still add these fields and their filters, but its options come from what the View scope's filter on that field allows | demos |
| 🚧 | 30l | 555 | **695 N1 (2026-11-03):** one registry; the graph adds presets, saved filters, status fields, superseded; every edit an `ask()`; Save fires `definition-save`. **→ plan-695 N1.** NODE EDITOR FOR QUERIES (Will, 2026-10-29) — view, edit and build a page's Query as nodes: Store, Source, Scope (its held fields as rows), Condition, Arrange (sort, group, search), Presentation, Component. Opened from the filter toolbar's overflow menu as "Node Editor (beta)". The editor ASKS: a change is a QueryRequest, as a chip's is. PLAN: docs/history/plan-78-query-editor.md (Q1–Q5; Q1 ruled A, Will 2026-10-29: a maximised overlay panel over the page, for now). The wait on 548 is LIFTED (Will, 2026-10-30, D5): presentation switching is not key to building graphs with presentation nodes. **Q1 DONE 2026-10-29:** `QUERY_KINDS` and `queryGraph()` — the Query drawn as nodes and routes, by depth; node tests `a-query-is-drawn-as-nodes`. **Q2 DONE 2026-10-29:** a toolbar's `data-node-editor` offers "Node Editor (beta)" last in its ⋮ menu, and a pick fires `node-editor-open`; `drawGraph()` and `bindQueryEditor()` (app layer) draw the page's Query on a canvas, read only, and follow each change; Demos opens it in a maximised overlay from the View bar and the panel column. Proved: a chip pressed behind the open editor adds its Condition node. **Q3 DONE 2026-10-29:** the editor EDITS through a chip's doors — a condition's operator (its field type's, by `OP_LABELS`) and value, Sort, Group, and each scope's filter Switch; the Source, a condition's Field and Presentation stay read only (Q4). Proved in Demos: Status = Trial from a chip (25 rows), then Does not equal in the editor — the page's Query reads `{ ne: 'trial' }` and shows 75 rows. **Q3+ DONE 2026-10-29 (Will):** a click on a node opens its INSPECTOR over the editor — its rows again and their From and To, and for a grid or chart a live copy of it, drawn from the Query; every field edits but a routed one (it mirrors what comes in) and one nothing outside takes yet (it says why); a field with known values is ticked — Is one of / Is not one of; a slot's Presentation is its Show as. Proved in Demos: ticks give `{ in: ['active', 'trial'] }` and 49 rows; By plan's copy draws its donut; the grid's Show as Bar swaps the page's grid for a bar chart. **Connect DONE 2026-10-29:** a drag from an output socket draws a dashed line; let go on an input socket, the host is asked — for the Query, a condition MOVES to the same field in another scope, or goes to another field keeping the values that fit; anything else is refused and reported. Proved in Demos: Status dragged onto Plan is refused ("Nothing Status picks is a value of plan"), and the Query is unchanged | feature |
| ⬜ | 30m | 556 | LATER, after 555's core (Will, 2026-10-29) — fuzzy AI nodes, to turn contextual processing into a decision-model-like output; and MCP, Tool, Skill, Context and Memory nodes. Kinds on the same engine (`runWorkflow`) | explore |
| ⬜ | 30v | 565 | LEGEND, after 548's core (Will, 2026-10-29) — a legend item may have several rows. Row 1 is always the segment: its swatch, its name, its total. Each row after it is one group: its label and its value, with no swatch | charts |
| ⬜ | 30y | 568 | PRESENTATION, later if needed (Will, 2026-10-29) — a definition may hide the reader's Primary and Secondary chips, so a page controls what its chart shows | feature |
| ⬜ | 30zza | 596 | FILTERS, later (Will, 2026-10-30) — Highlight on hover fires only on a value chip or a menu row. A whole field's matches are of no use: that lights the whole dataset | filters |
| ⬜ | 30zzf | 602 | PRESETS, later (Will, 2026-10-30) — a setting that allows changing those values. A change keeps every downstream filter and value active and turns the preset off: an override deconstructs the preset without losing its conditions across the query. With 601 | feature |
| ❓ | 30zzt | 616 | **→ plan-695 N4.** DATA LAYER, Step 6 — the node engine: W5 `runWorkflow` over the pure functions, with a trace, cancel, dry run, batch writes and typed sockets; after Step 4. HELD (Will, 2026-10-30): "Don't implement anything for the node editor just yet. I want to plan it out for a bit." Nothing here, in 78 or in 555 is built until he says. PLAN: docs/DATA-LAYER-PLAN.md, docs/history/plan-78-workflow-data.md | feature |
| ⬜ | 30zzw | 619 | FILTERS, minor (Will, 2026-10-30) — the Organise chips should not be exempt from folding into a toolbar's overflow menu | filters |
| ⬜ | 30zzzn2 | 650 | PANELS (2026-10-30, found in 636) — the panel areas' room rule counts ONE area: with the filter panel and a fixed panel both in, the Context gets 312px at a 1280 window and 632px at 1600, under the 768px it should keep. `T-the-panel-is-desktop-only` | bug |
| ❓ | 30zzzt6 | 659 | CHARTS (found in 654) — a donut's centre adds up its slices (`T-the-centre-totals-what-the-ring-draws`). Counted, one customer with people in two plans is in two slices, so Records' donut reads 29 customers for 8. ❓ Will: A (my pick) — counted, the centre says the distinct number, 8, so it never claims more customers than there are; B — the centre adds up the slices, 29, and its words change from "customers" | charts |
| ⬜ | 30zzztz | 689 | DATA LAYER (Will, 2026-11-02, after 652 and 687) — status fields (683) may serve other things too: a preset filter, and an Organise criterion (Primary, Secondary, Group). Look into it once the Service Worker work is settled. Will: *"these status fields might be useful with other things like preset filters, organise criteria… We should look into this after the Service Worker stuff is settled."* | data |
| 🚧 | 30zzztzr | 695 | ARCHITECTURE (Will, 2026-11-03) — **D1–D6 all A (Will, 2026-11-03); the order of execution: [plan-695](history/plan-695-architecture.md)** — **T1 ✅ 2026-11-03** (TODO open work alone, done in the archive; the traps split by area); **Wave 1 ✅ 2026-11-03**: S1 + 694, H1 + S3, P1 (in part: the host pins wait for P7), D2, T2 — each lane's notes in the plan; U1 (wave 2) started early, as nothing waits on it; **Wave 2 ✅ 2026-11-03**: U1, S2, S4, H3, D1; U2, P3, N1 and P2 started early, as what they wait on landed; **Wave 3 ✅ 2026-11-03**: S5, U2, U3, P2, P3, H2; N1 (wave 4) done early; **Waves 4–5 ✅ 2026-11-04**: U4, P4, P5, H5, N1, N2, P6, P7 — **plan 695 is done but N4** (TODO 616, held by Will); the deferred rows: 700, 701, T3, 223, 170, 77; then five waves of lanes in parallel; D7 A (Will): lanes BUILD in parallel, each in its own worktree pair; the peer keeps its rows outside the lanes' files. The full review: [ARCHITECTURE-REVIEW.md](ARCHITECTURE-REVIEW.md), notes in [history/architecture-review-notes.md](history/architecture-review-notes.md). Five ideas said many ways: a condition (9 shapes), a command (13 events + 10 requests), a setting (7 paths), a page's state (9 keepers), what happened (no trace). A roadmap in six phases — Phase 1, the spine (one condition tree, one command vocabulary, one trace, store capabilities said once), unlocks 692, 548, 518, the node work and 170; ten bugs (§8, the first is 694). **Decisions for Will, D1–D6** (§12): the condition model, commands, settings, state pins, docs, the nine components no app uses | architecture |
| 🚧 | 30zzztzw | 700 | **PLAN: [plan-700-agents](history/plan-700-agents.md) (with 77 and 223); Will, 2026-11-04: A for Q1–Q9. G0 ✅ (`d05b300e`); G1 ✅ (`851b269c`, the read tier; the old server deleted); G2 ✅ (`df7054aa`, the check tier); G3 ✅ (`50660526`, the query tier); G4 ✅ (`fca0f53e`, patterns); G5 ✅ (`355bd85b`, see); G6 waits on N4, G7 on Will; **the rest is PARKED: node work comes first (Will, 2026-11-04)**; only G6 (runs) waits on N4.** MCP (Will, 2026-11-03) — REBUILD the MCP server from scratch: the old one harks back to early in the project. On the new spine (one condition tree, one command door, one definition model, the trace): compose tools — `generate_page`, `validate_page` against the specs, `preview_page`, `check_usage` — and a pattern decision model for row 77. A tool Sherpa provides later. Ships NO Figma build tooling (Will, 2026-11-03: pulling and processing tokens from Figma is this project's utility, never a consumer's): `scripts/figma-data/name-map.yaml` leaves `package.json` `files`, and the rules doc's Figma half is not served. AFTER the node engine and the refactor ([plan-695](history/plan-695-architecture.md), N1–N4) | tooling |
| ⬜ | 30zzztzx | 701 | PLATFORM (from the review, 2026-11-03) — features to adopt once every engine has them, checked each quarter by the native probe (review §9): CSS `@function` and `if()`, scoped element registries, customizable `<select>` (Firefox); CSS module scripts — then drop the inlined sheets (WebKit); `scheduler.yield` (WebKit); `interestfor` (Firefox, WebKit); the Temporal stand-in (`core/ui/temporal.ts`) once the support floor allows | platform |
| ⬜ | 30zzu4 | 708 | PERF (found by 704's lane) — WebKit's main thread is busy about 1.4 s after a panel press (two tasks of ~670 ms); Chromium has no gap over 60 ms. Profile it | perf |
| ⬜ | 30zzu6 | 710 | TRAPS (T3's code half, 2026-11-04; the docs half is done, `a0e34847`) — each needs a CODE citation changed: (1) merge the duplicate pair `T-tokens-css-never-reaches-shadow` and `T-a-document-class-cannot-reach-a-shadow-root` (cited in project-tokens.mjs, sherpa-element.ts, the three generated shared sheets, layout-grid.html, group.css and four specs); (2) `T-grid-header-needs-capture` lost its reason with P4 — measure whether capture is still needed (the comment at `sherpa-data-grid.ts:419` says "the chip's"); (3) `T-an-open-panel-follows-the-data-layer` names the deleted panel (`source-binding.ts:323`); (4) a stale comment at `filter-state.ts:109` (the chip's "info-blue and fx badge"); (5) about 138 mentions of the legacy panel (deleted in 476) and a few older names (`#syncDateLabel`, `setFieldReading`, `bindLegendFilter`, `pushChips`, `#pendingItems`, `#syncSortLabel`, `#resolveTemplate`); `T-grid-key-or-position-lies` says a keyless grid reports no keys, but it now falls back to the data layer's key | docs |
| ⏸️ | 30zzu8 | 712 | **HELD (Will, 2026-11-04): until the data layer and filter reworks are in a good place.** SPARKLINE (Will, 2026-11-04) — a setting, ON by default: 'Use Sparkline points as Date Range preset filters'. On, clicking a sparkline point TEMPORARILY overrides the View / App Context date range with that point's time span; it is treated as a PRESET, so the Date chip takes its look and state from the preset logic that exists. Clicking anywhere on that sparkline, or on the Date chip, while the override is on removes it. While it is on, that sparkline's other points FADE, and every other component follows the temporary range — the other metric cards' values and segment counts change. Will, 2026-11-04: a click on a DIFFERENT point also removes the override (A: any click on the sparkline removes it); after a reload the override is gone (A: it is temporary). After 705's fix lands (it changes the sparkline and the provider's summary path). Keyboard parity: a point is pickable without a pointer (PRINCIPLES 21) | feature |
| 🚧 | 30zzu9 | 713 | NODES (Will, 2026-11-04) — **M1 ✅ (`8b30a9f4`, the types); M2 ✅ (`6bde3d34`, sockets drawn), M3 ✅ (`b85610e1`, rows carry the data, workflow v2); M6 ✅ (`c0664f82`, picklists, the override, 557–559); M4 ✅ (`f1e11818`, the Condition node; `filter` is gone); M5 ✅ (`57b931c6`, status, presets and saved filters as Condition nodes); M7 + M8 ✅ (`fd1c3ff5`, categories and the node panel, a card 32px from the canvas edges); M9 ✅ (`f00c7ab9`, the Custom Node definition, instances, nested checks, the update diff); M12 ✅ (`2bf14a1a`, saved Custom Nodes: app.v1 `nodes`, the keeper's `nodes`, the panel lists them); **Will, 2026-11-04: "go with your picks for now; we'll correct later" — the open small choices (M4 Field row kept, M5 status counts kept, M8 pointer-only "Add a node", M9 `was` copy kept, 732 a routed True/False decides the switch, M12 `flush()` waits for the database, 730 flush end labels) stand; 721 part 3b (remove the panel header's Filters button) is NOT in that list: it waits for his go.** M10 + M11 ✅ (`04571da8`/`48b0fe97`, open a Custom Node under breadcrumbs, Save as Custom Node / Ungroup, the update indicator + diff + split button) — **the node model, plan-713 M1–M12, is built**; 560 + 561 ✅ (toolbar, undo and redo); 562 ✅ (the zip tie); 734 ✅ (the toolbar at the bottom centre; the Query editor's toolbar and panel) — **every node-editor item (557–562) is done; only N4, the runner, is held** (Will, 2026-11-04: node work first).** **PLAN: [plan-713](history/plan-713-node-model.md) — M1–M6. Will, 2026-11-04: D1 B but agnostic (the header input takes any type; the node's rules decide); D2 truthy (not 0, null, none, false); D3 A (the condition type is a row picklist); D4 per socket (`many`); D5 A; D6 B (False red); D7 A; D8 A, and convert the saved v1 graphs.** the node model, before N4 (TODO 616): (1) a CONDITION node — pick a field, compare its values against given parameters, pass the output on (Demos' Health node today lists its data conditions as strings); (2) a node OUTPUTS a value, an object or a true/false boolean: an input row has an output socket for a value or an object; a node's HEADER has an output socket for True; a node's FOOTER (new; it will have other uses) has one for False; (3) input sockets take an explicit value, an object, a boolean, or 'any' where it fits; (4) every socket type is colour- AND shape-coded, inputs and outputs; (5) a socket may take or send several connections; (6) rows that show a text input where a picklist is expected become picklists, and a picklist can be overridden by plugging a text value node into its input. PLAN first (a doc for Will): docs/history/plan-713-node-model.md | feature |
| ⬜ | 30zzu9f | 719 | NODES (Will, 2026-11-04, with 713) — (1) GROUP a graph into its own reusable node, preset or custom: simple nodes, combined, become powerful and flexible; (2) a floating PANEL on the left of the editor's canvas: a categorised list of every preset and custom node, to place and test them by hand; (3) a saved node is a JSON definition, saved as saved Views and saved filters are. Guide (old, before the data layer, with gaps): Will's Figma `UaNDhhl1fawHB0K9KqJFxA` (ACP Module), page "Node Graph Exploration", node 2872:32139. **PLANNED: [plan-713 §9](history/plan-713-node-model.md) — M7–M12; Will, 2026-11-04, answered D9–D17: a "Custom Node" ("Save as Custom Node"); instances with their own inputs and parameters, and an update flow (an indicator, a diff, Update instance / on graph / all); D12 B, nested; a card Panel on the canvas; an array is an object.** Multi-select picklists (Will, 2026-11-04): a multi-select row outputs an OBJECT, the set of picks (§9.5) | feature |
| ⬜ | 30zzu9g | 720 | FILTERS (found by 715's lane, 2026-11-04) — the toolbar's own `#render` still MOVES every chip it keeps, the shape that lost a press in 715 (`T-a-chip-moved-under-a-press-loses-its-click`): place chips without moving one that is already in its place | bug |
| ⬜ | 30zzu9h | 721 | PANEL (Will, 2026-11-04) — (1) the panel-mode toggle shows in EVERY filter toolbar, chart toolbars too, and still respects "Include View Context in the panel"; (2) a chart's Organise chips (Primary, Secondary, Group, Sort) and its Filters button make the move from toolbar to panel — **Will's ruling, 2026-11-04: the toolbar (or panel section) belongs to the PRESENTATION (Show as, Primary, Secondary, Group, Sort — as plan-713's Presentation node); the card is only a container that sets the presentation type and is told its title label. Type the data presentation content that way;** (3) each panel accordion has its OWN Filters button in its header, not one in the panel header — and none when the accordion holds only ONE field section (its values are already open) | feature |
| ⬜ | 30zzu9i | 722 | BUG (Will, 2026-11-04) — the panel's Organise and Preset sections lack the light-grey hover fill the other sections have | bug |
| ❓ | 30zzu9j | 723 | EXPLORE (Will, 2026-11-04) — are Organise and Preset just the new Advanced/Conditional fields? If so, refactor them into that format, so every section in the panel (and the toolbar?) runs on the same logic. Read-only study first: what Organise and Preset hold today vs. a conditional field; one decision for Will. Fixes 722's cause too, if the hover fill comes with the shared section  **STUDY DONE, 2026-11-04 (Will chose A: 723 first).** (a) PRESET: yes, nearly — `T-a-preset-is-its-own-part` already says it is a wrapper round stacked Advanced conditions (`{id,label,where}`), its rows ride in `byPreset` beside the answer, and its chip is a boolean. What differs is only its chip and scope placement. (b) ORGANISE: no — Group, Sort, Primary, Secondary are ARRANGEMENTS (`group/sort/chartFields` on the scope description), they make no clause. They are the Presentation (plan-713's node: Show as, Primary, Secondary, Group, Sort). (c) So the shared shape is one SECTION contract — a header, then items, each item a field, a preset or an arrangement — not one condition format. (d) 722's cause: the hover fill is `.chips > .chip[data-layout="section"]:hover` (toolbar css:640); Organise chips sit in `.organise-zone`, not `.chips`, and a preset chip has no `data-layout="section"`. **Will chose A, 2026-11-04. PLAN: [plan-723](history/plan-723-section-contract.md) — 5 steps.** | explore |
| ❓ | 30zzu9v | 737 | NODE EDITOR (found by 735's lane, 2026-11-05) — picking connectors by keyboard: built `C` (the connectors of the picked or focused nodes) and Escape. Not built: Shift+Arrow to extend a pick, or Tab to a route. A: leave it / B: build them. Pick A until Will asks | decision |
| 🚧 | 30zzu9x | 739 | NODE EDITOR (Will, 2026-11-05) — box-selection keys: SHIFT while dragging overrides the one-kind rule and picks BOTH the fully enclosed nodes and the crossed connectors; CTRL while dragging REMOVES the connectors and the fully enclosed nodes it covers from the current selection | feature |
| 🚧 | 30zzu9y | 740 | NODE EDITOR (Will, 2026-11-05) — NODE LOOK from his Figma (ACP Module `UaNDhhl1fawHB0K9KqJFxA`, page Node Graph Exploration, node 2872:32139; each column is a node TYPE/category with a label above it): different border radii and background fill tokens for Sources, Groups (Custom Nodes), Output and AI nodes; the SOCKETS: True and False are different shapes from each other, an INPUT socket is a D shape, a socket that takes MANY inputs is DOUBLE height. And a RESIZE handle at a node's bottom right on hover: drag to resize up to 200% of its height or width, non-uniform unless Ctrl is held (then uniform) | feature |
| 🚧 | 30zzua746 | 746 | **Will, 2026-11-05: yes, plan it (a plan lane is running; it builds on [vision-entities](history/vision-entities.md)).** NODE EDITOR (Will, 2026-11-05) — GRAPHS AS VIEWS: (1) the app header has no custom Save of its own in the Node Editor: the existing Save View button becomes 'Save' and 'Save Graph As'; (2) the app header's Views chip lists every PRESET and CUSTOM NODE GRAPH: they are Views with a canvas and node content instead of the usual layout-grid content. PLAN first (what a saved graph is: a workflow definition, a View, a Custom Node? how it relates to saved Custom Nodes (719/M12) and to PageState views; who owns the header: sherpa-ui-53 did the crumbs) | feature |
| 🚧 | 30zzua751 | 751 | **PLAN [plan-746](history/plan-746-entities-and-graph-views.md): Will, 2026-11-05: the 10 decisions are in (4 changed: a preset View per entity type + a SECOND chip for graph definitions); building E1–E4. E1 + E2 ✅ (`46d508bb`, `ac42081b`: `entity.v1.json`, `entity-types.ts` with `preset-filter` and `node`, `checkEntity`, `asNode`, `EntityShelf` over the keeper part `entities` (database v3: `nodes` became `entities`), app.v1 `entities`, `NodeShelf` a view of it); E3 + E4 ✅ (`f8f29ebc`, `03f43448`; Demos `349a6aa`, `50a1396`: a View's `graph: { type }`, one View per type (Workflows, Preset Filters, Custom Nodes), the graph chip right of the View chip (presets, My graphs, New graph…), `?view=&graph=`, the header's Save / Save graph as / Delete graph on a graph View, Demos' `#node-save` gone); E5 ✅ (`ffa3d8d1`, `86d182d0`, `e260a7e8`; Demos `fa23c8a`…`36f5b2f`: every saved entity is a node the panel offers (`offeredKinds`, by the graph type's families), placed as an instance through `useOf`, opened read only or edited, the D11 update flow; `nodeEntityOf`, `entityRefOf`; `entity-check.ts` split from the light registry; Will 11-05 B: graphs stay OPEN, any entity anywhere, see 764); E6 next. Will 11-05 (E4): A — the Context that holds the canvas answers Save, Save graph as and Delete, with shared helpers, as built.** ENTITIES (Will, 2026-11-05) — node graphs build reusable, deterministic ENTITIES of a TYPE (View, UI Card, Preset Filter, Notification now; UI Pattern, Form, Workflow, Script, Scheduling, Policy, Monitor, Report, Agent Harness later): solid generics for creating entities of a type, building their graphs, CRUD management of them, and standards and interoperability. LOGGED in [vision-entities](history/vision-entities.md); Will deals with the open decisions first, THEN we plan (the phase-2 node plan: 749, 746) | plan |
| ✅ | 30zzua753 | 753 | Will, 2026-11-05: 'Smaller items: your picks' — the Query editor's Save-as-Custom-Node button stays disabled, not hidden; the tab strip's gap stays; tips do not open on keyboard focus of a node header (sockets are `aria-hidden`); the section rule stays (plain rows run together, one part per group); 'False' keeps its tip; M4's Field row and M5's status counts, M8's pointer-only 'Add a node', M9's `was` copy, 732's switch, M12's flush, 730's end labels, 744/750: as built | decision |
| ⬜ | 30zzua760 | 760 | DEMOS (Will, 2026-11-05) — the filter graphs Demos already has do not fit the new model: when ready (after 749 P4–P5 and 751 E3–E4), RECREATE them from scratch on the families and entities, not converted | demos |
| ⬜ | 30zzua825 | 825 | A11Y (found by 806) — a screen reader hears an inactive tool as "dimmed" but not WHY: its tip is `aria-hidden`. Tie the reason to the button (`aria-describedby` to the tip's words, or an `aria-description`) | bug |
| ⬜ | 30zzua830 | 830 | NODE EDITOR (Will, 2026-11-06) — "In the Source node, the output socket comes from the Row section header rather than the select input row as expected." The Source's Rows OUTPUT socket sits on the Store select row (the row that makes it), not on the "Rows" section header | bug |
| ⬜ | 30zzua831 | 831 | NODE EDITOR (Will, 2026-11-06) — "not all nodes need a true/false socket. At this stage it's probably just Condition nodes. Don't completely remove the ability for other nodes to support this. Just hide them for now." Keep `branches` as a kind option; turn it ON only for Condition (the Logic family); every other kind draws no True/False and no footer, but can opt in again | feature |
| ⬜ | 30zzua832 | 832 | LAYERS (Will, 2026-11-06, answering 823's question: "a combination of component and app awareness of layers") — (1) COMPONENT: a component seals its own inner stacking only where it has layers that could escape (the grid); (2) APP: ONE named layer scale for what floats over a page — content, sticky bars, banners, docked panels, floating panels (raised on press within their band), menus, dialogs, tips — as tokens, written once in sherpa-ui's docs and used by every component and the outlet; no loose z-index numbers. Builds on 823 | feature |
| ⬜ | 30zzua833 | 833 | NODE PANEL (Will, 2026-11-06) — "The node descriptions are not great." Rewrite every kind's one-line synopsis (809) as a plain job in Will's words, e.g. Source: "Connect a data source"; Field: "Target a field from a connected Source"; Value: "Primitive value variables"; Condition: "Logical checks of a value against a condition"; and so on for every kind and family (Math, Time, Collection, Text, Tag, Portal, Output…). One place (`node-kinds.ts`), 6 words or fewer where it can be; a short test that each reads as a job, not a list of types | feature |
| ⬜ | 30zzua834 | 834 | NODE EDITOR (Will, 2026-11-06) — PLAN then build: "the output node is not a singular type. Output is a category that covers Notifications, Presentation (which can be broken down even further into grid, chart, view, report etc.), Value Output and such." `output` becomes the OUTPUT category of several families/types (Notification, Presentation > grid / chart / view / report…, Value Output), each with its own rows, as the families in plan-749; the panel lists them under Output; plan which exist now (Value Output = today's Output; Presentation and Notification are entity-type work: plan-746 E6–E8) | feature |
| ⬜ | 30zzua835 | 835 | NODE EDITOR (Will, 2026-11-06) — PLAN then build: "The Collection node should be split into 2 distinct Sort, and Group. Sort and Group should be in an Organise category. The Count option, from Collection, should be a property row on any node that could provide it. A property row is an output only row in a node that provides a property (raw or calculated) from the node's data or calculations from it's code logic." So: kinds `sort` and `group` (the Collection family goes) in a new category Organise; a new ROW KIND, the property row (output only, raw or calculated, one place in the kinds), Count its first, on every node that can say it (Will: "So 'Field' could have a 'Count' property"): a Source's row count, a Field's count of values, a Group's count per group, a Condition's matches. Pick: only Count now, the row kind general. Also changes plan-749 P3 and 783's F5 | feature |
| ⬜ | 30zzua836 | 836 | NODE EDITOR / DATA (Will, 2026-11-06) — PLAN then build: (1) see the INCOMING and OUTGOING data (the real rows) at each node of a graph — not the node's JSON definition; (2) never fetch automatically: the reader's first FETCH caches the rows, then SIMULATE any change against the cache, with no refetch; (3) a fetch reads the WHOLE graph first and sets the query parameters (filters, fields, limits) so only the rows needed are fetched; (4) Fetch and Simulate are enabled ONLY if at least one complete path joins a Source to an Output; every graph always has a raw JSON output, above all other output types (cf. 834). Pick: with no path the buttons are inactive and their tip says why (806). Builds on 764's `readInput`, 776's `conditionAt` and the data layer's query | feature |
| ⬜ | 30zzua837 | 837 | NODE EDITOR (Will, 2026-11-06) — in the app header's filter toolbar, REPURPOSE "Reset all view filters" as "Reset node graph": it puts the graph back to its definition as it was when the editor loaded (its starting definition; a Draft, nothing saved). It has its own label, "Reset node graph". Drop the scoped "Reset all": the Node Editor has ONE view scope and no local scopes. Cf. 764/`sherpa-draft-keeps-save-writes-final`; a lane takes it after 831/832/835 | feature |
| ⬜ | 30zzua838 | 838 | NODE PANEL (Will, 2026-11-06) — take the node's X,Y position OUT of the details panel. It is debug info, not for general use of the editor. Keep it reachable for debugging only if that costs nothing (a `debugState()` read, not a row) | minor |
| ⬜ | 30zzua839 | 839 | NODE EDITOR / UNFURL (Will, 2026-11-06, screenshot) — a graph with a portal pair unfurls with its Sources on the RIGHT and its Outputs on the LEFT. A graph reads LEFT to RIGHT: Sources always unfurl to the left, Outputs to the right. Use that as three bands (left = Sources, centre = the rest, right = Outputs) to place nodes; it may also cut the crossings. A Portal IN always unfurls LEFT of centre and a Portal OUT RIGHT of centre — a portal pair never flips the order. Cf. 569/827 (`node-unfurl.ts`) | minor |
| ⬜ | 30zzua840 | 840 | NODES PANEL (Will, 2026-11-06) — it is hard to link a node in the Nodes panel to its node on the canvas. Add a LIST ITEM VARIANT for nodes that takes the node's own fill, border and corner radii, so a row in the panel looks like its node (same kind colours as the canvas node). Cf. 833 (the lines), f1660e0ae (Preset and Custom tabs) | feature |
| ⬜ | 30zzua841 | 841 | NODE EDITOR / DATA (836 follow-up, Will 2026-11-06) — 836 P1 (path rule, Fetch and Simulate buttons) and P2 (`node-simulate.ts`) are MERGED. Next: P3 the IndexedDB cache and the Fetch press, P4 the Data tab, P5 the canvas counts, P6 Math and the other kinds, P7 polish. OPEN: does the page-filter graph's node get a Data tab (answer 7, Will "not sure"). Plan: docs/history/plan-836-data-through-nodes.md | feature |
| ❓ | 30zzua842 | 842 | NODE EDITOR — THE LAST ITEM, after ALL other Node Editor work (Will, 2026-11-06): REVIEW AND OPTIMISE. A real graph may hold hundreds of nodes or more, so measure it (a 500- and a 2,000-node graph: draw, drag, unfurl, simulate, save) and fix what is slow. Also CLEAN UP: legacy implementations, duplication and over-engineering across the node code. Nodes and graphs are the foundation: they define whole views down to if-this-then-that recipes, so they must work well with the data layer and be easy for a developer building on Sherpa AND for a user of a Sherpa app. Cover the data layer, the utility layer and the presentation layer; all must stay efficient. Plan first (measure), show Will before large deletions | review |
| ⬜ | 30zzua843 | 843 | NODE EDITOR / TASKS (Will, 2026-11-06) — Fetch and Simulate are ASYNC: while one runs, SHOW it (a busy state on its button), BLOCK a second press, and tell the reader when it ends (a toast and/or a notification item in the app header). Do the small version now on 836 P3, with a seam the Task Manager (844) can take over. Cf. 836, 806 | feature |
| ❓ | 30zzua844 | 844 | TASK MANAGER (Will, 2026-11-06) — PLAN FIRST. ONE central, standard queue for async work. A task = a definition (which node graph to run, or another tool that is not a graph), who asked, and any schedule. It tracks state (a graph may emit named states, preset or custom), the state history and the outcome (ok or not). A task IS a graph: it wraps the graph it runs as a temp Custom Node in the middle of its own flow, so ONE graph decides how completion notices go out. Many tasks may run at once: DEBOUNCE notices into a summary every so often. An inner graph's own notices are ignored in favour of the task's (explore: wire only its raw JSON to the Custom Node's output, or bubble status/errors/outputs). The manager is QUERYABLE by apps, components, agents and users, any time. Keep a light run HISTORY now; the proper one later. First user: Fetch and Simulate (843). This is N4's ground (executing a graph is not simulating it). WILL ANSWERED: (1) the inner graph sends ONLY its raw JSON to the Custom Node output; the task graph owns every notice. (2) Build Fetch and Simulate on it FIRST, but the solution is GENERIC, reusable and scalable: it knows nothing of the process it queues | feature |
| ⬜ | 30zzua845 | 845 | NODE EDITOR / DATA (Will, 2026-11-06) — the RUNNING look. (1) A Source node SHOWS that it is fetching, while the Fetch button is temporarily inactive. (2) In a simulation the CURRENT node wears an ACTIVE BORDER and an appended TAB on its top edge, as at the top of the design https://www.figma.com/design/UaNDhhl1fawHB0K9KqJFxA/ACP-Module?node-id=2872-23914 (not yellow and black). The tab holds the PLAY icon and "Simulating... 1s", where 1s is the seconds elapsed. (3) The fetch indication on a Source node uses the SAME approach (tab with "Fetching... 1s"). Built as one generic "running" look on a node, driven by the task seam of 843/844. Style by Style-mode pins, not bespoke colours | feature |
| ⬜ | 30zzua846 | 846 | NODES PANEL (Will, 2026-11-06) — the DRAG HANDLE on the Nodes panel's header is in completely the wrong place. And `sherpa-node-panel` is its OWN component (a `sherpa-container` card with its own float, dock and minimise code via `FloatBox`), not a Sherpa panel: make it the Sherpa panel component (`sherpa-overlay-panel` family, fixed/floating/minimised states) with the node list as its content, so there is ONE panel system. Cf. 769, 796, 840, f1660e0ae, 36632f2e3 | bug |
| ⬜ | 30zzua847 | 847 | PANELS (Will, via the panel session, 2026-11-06) — PORT the FILTER PANEL out of `sherpa-quick-filter-toolbar` into a `sherpa-overlay-panel` filled with the filter-panel content, with NO change to its function or style; then CLEAR the toolbar's panel mode. PLAN FIRST (a refactor). Tabbed panel areas are in (T-an-area-holds-two-panels-stacked): any panel may share an area, a tab each. Goes with 846 (Nodes panel onto the overlay panel). WILL: get it DONE (846 first, then 847). The filter panel header needs NO "Filters" button: that is handled per filter section (scope) in the panel content. ALSO (Will): the "Show as toolbar" and overflow (⋮) buttons go AFTER the minimise and float/dock buttons; the panel CONTENT area gets generic PADDING across ALL panels (accordion sections are flush with the edge and block the panel border), and any per-variant panel padding is REMOVED (keep `data-padding="none"` only where a content fills the body, as the node list does) | refactor |
| ⬜ | 30zzua848 | 848 | PANEL AREAS (Will, 2026-11-06) — when a Panel Area holds panels in TAB mode, draw a thin, light grey border on the OUTSIDE edge of the area (the edge that faces the canvas). A border token by Style pin, not a bespoke colour. Cf. T-an-area-holds-two-panels-stacked, 796 | minor |
| ⬜ | 30zzua849 | 849 | PANELS + NODES (Will, 2026-11-06) — (1) a panel's DRAG HANDLE reserves NO space: when it appears it NUDGES the header content to the right (no empty gap when it is hidden). (2) A NODE's drag handle attaches to the LEFT side of the node header as a tab ROTATED 90 degrees, as tall as the header, on the LEFT side (a tab on its edge, like the running tab of 845). Pointer and keyboard moves stay the same | minor |
| ⬜ | 30zzua850 | 850 | PANELS (Will, 2026-11-06) — in a panel's header put the MINIMISE, DOCK and NEW TAB buttons into ONE BUTTON GROUP (`sherpa-button-group`), and style the CLOSE button as a DEFAULT button (it has a border) so it does not look out of place. Do it in the one panel component (cf. 846) | minor |
| ⬜ | 30zzua851 | 851 | PANEL AREAS (Will, via the panel session, 2026-11-06) — the tabbed-area border (848) does NOT show in Will's real views although the panel session's harness draws it (`.area::after` in `sherpa-layout-panels.css`, commit e807f5496; pixel check in `reforged-panel-area-tabs`). Check and fix across BOTH the layout grid (app shell) and the CANVAS views (`sherpa-layout-canvas`, panels at 18rem, the Nodes card), on a tabbed START area as well as an END one, and with a floating area (`start-floating`/`end-floating` hide `.area::after`). Suspects: the canvas area's `z-index: auto` and the canvas's clipping; the start side's tab row on the other column. Reproduce with two docked overlay panels (`data-fixed`) in the shell's end area, and in a canvas, then read the PIXEL on the real Demos page (Node Editor). WILL SAW (screenshot, still no border): the NODES panel MINIMISED as a tab on the LEFT, between the nav's right edge and the canvas: he expects the line to run down the area's outside edge there, so a MINIMISED tab counts as "tab mode": ANY panel in tab mode triggers the border, even a SINGLE one (the Nodes card, not an overlay panel) | bug |
| 🚧 | 30zzua852 | 852 | **Will, 2026-11-11: draw nodes with Chrome's HTML-in-Canvas API; sherpa-canvas wraps a real `<canvas>` whose attributes templates set. SPIKE MEASURED and hand-checked: [plan-852](history/plan-852-html-in-canvas.md) — faster in every act at 2,000 nodes, zoom 2,106 ms → 71 ms a step. Will: "let's make it so" — building, steps 1–6 in the plan; steps 1–5 BUILT (2026-11-11): the node canvas's plane and its lines are drawn into a real canvas in Chrome 157.** NODE EDITOR / PERFORMANCE (Will, 2026-11-06): could the node graph gain a lot of speed from the HTML-in-Canvas API (https://developer.chrome.com/docs/web-platform/html-in-canvas)? Fold it into 842 (review and optimise at scale). A SPIKE, measured, not assumed: draw 500 and 2,000 nodes with it against today's DOM and compare draw, drag, zoom and input time. Check first: browser support (our three test engines; a fallback if one lacks it), accessibility and keyboard focus of nodes drawn into a canvas, text selection and hit-testing, and that real controls inside a node (select, input) still work. PRINCIPLES: progressive enhancement, HTML/CSS first, JS last | spike |
| ⬜ | 30zzua853 | 853 | TESTS — three `test:node` tests FAIL in the main tree and are SKIPPED in every lane worktree (no `../Sherpa Demos` beside a lane's checkout): `an app's type is used as a node too…` (entity-types), `workflow_graph is workflowGraph…` and `edit_workflow is editWorkflow…` (`the-mcp-query-tier.test.mjs`). Cause: they read Demos' `app/workflows/*.json`, which since 760 is an ENTITY (`type: workflow`, `graph: {nodes, routes}`), not a v2 workflow definition. Fix the tests to read the entity's graph (`entityWorkflow`/the entity reader), and make the lanes' runs see a Demos (point the test at the lane's own demos-* pair) so a skip cannot hide a failure again. Check that no other `{ skip }` hides a red test | bug |
| ⬜ | 30zzua854 | 854 | PANELS (Will, 2026-11-06) — MERGE "Keep Open" with "Pop in/out" into ONE TRI-STATE cycle button on the overlay panel: `tab-hover-overlay` (minimised tab, opens on hover as an overlay) → button says "Dock as overlay" (formerly Keep Open); `docked-overlay` → "Dock as inline"; `docked-fixed` → "Dock as overlay". There is NEVER a "hover fixed" state. Minimise returns to the tab scenario. Float sets the Float scenario; DOCKING a Float returns it to its PREVIOUS docked state. And MATCH the panel's WIDTH when toggling between docked-overlay and docked-fixed. A state machine (one `data-panel-state`?), not flags; the panel session owns it | feature |
| ❓ | 30zzua855 | 855 | PANELS (Will, 2026-11-06) — "I never did get the Open in New Tab functionality for Panels". Today the overlay panel only FIRES `panel-external` (button shown by `data-external`); Demos' `app/panel-tabs.js` sets it only for a STANDALONE set of panels that have a channel, and nothing opens a tab for the Nodes or Filter panel. Build it for ALL panels: the button opens that panel's content as its own page in a new browser tab, live-linked to the app (same stores, the panel's state), and the panel in the main window shows it is open elsewhere. WILL ANSWERED: (1) ALL panels are built from the SAME panel component FIRST (856), then the logic is written ONCE. (2) The new tab shows ONLY the panel content, full screen, in a DRILL-DOWN mode: `data-dock-state="drill-down"` overlays the panel full screen in the SAME tab; `new-tab` is the same look in a new browser tab | feature |
| ⬜ | 30zzua856 | 856 | PANELS (Will, 2026-11-06) — PLAN FIRST. (1) EVERY panel in Sherpa is built from the SAME panel component (`sherpa-overlay-panel`, the one Will calls the sherpa panel): find each panel that is not (the details/inspector panels, the Assistant, any `sherpa-container` card used as a panel, what is left of the filter column) and move it onto it, deleting the copy. Then 855 (Open in New Tab) is written ONCE. (2) REPLACE the four legacy attributes `data-fixed`, `data-overlay`, `data-minimised`, `data-floating` with ONE HTML attribute `data-dock-state` in the template (not only the JS `dockState`): values `floating`, `tab`, `hover`, `overlay`, `fixed`, plus NEW `drill-down` (overlays the panel FULL SCREEN in the same tab; "we had this before and it was forgotten") and `new-tab` (looks the same, in a new browser tab). CSS selects on it; Demos' keepPanel/restorePanel, the layouts and ~40 specs move over in the same change; no alias (T-a-rename-drops-the-old-name). SEQUENCE: after the 847 lane (Demos swap, provider, clean-out) lands, so the filter panel is migrated with the rest | refactor |
| ⬜ | 30zzua857 | 857 | PANELS (Will, 2026-11-06) — an overlay panel in the LEFT (start) panel area has its RESIZE EDGE HANDLE on the wrong side: it must be on the RIGHT edge (the edge facing the canvas). Right area keeps it on the left. Measure by pixel on the Node Editor's Nodes panel docked left, fixed and overlay | bug |
| ⬜ | 30zzua858 | 858 | PANELS (Will, 2026-11-06) — (1) the FILTER PANEL is in the RIGHT panel area; it belongs in the LEFT (start) one. Demos' markup says `slot="panel-start"` `data-fixed="start"`, so MEASURE where it sits on Records (a kept state from `restorePanel`, `app/panel-float.js`, may hold the old `end`; the Pop toggle may flip it) and fix the cause. (2) The LEFT panel area still CHANGES SIZE when the filter panel is not in it. A panel AREA must ADAPT to hold its content at the CONTENT'S WIDTH: no explicit width values on an area (`sherpa-layout-panels`, the shell's areas, the canvas). A panel keeps its own width; the area follows it; an empty area is zero wide | bug |
| ⬜ | 30zzua859 | 859 | PANELS (Will, 2026-11-06) — (1) CHANGED MIND on 858: Will prefers the filter panel in the RIGHT (end) panel area. Make the side a SETTING in the app (Demos' Settings: "Filter panel in the right panel area") and turn it ON by default; off puts it in the left (start) area. The overlay panel's `data-side` fix (858) stays. (2) NO separate panel-AREA and panel handling rules for LAYOUT-GRID based views and CANVAS based views: ONE set of rules, one component, shared by both (`sherpa-layout-panels` and `sherpa-layout-canvas` share the area code: sizing, tabs, minimise rail, floating, the 33% max, the border). "Less is more. Reuse is king." Fold into plan 856 and delete the duplicate code | refactor |
| ⬜ | 30zzua860 | 860 | PANELS (Will, 2026-11-06) — the SEARCH input does NOT FILL the filter panel's header. Use the SAME sherpa panel component for ALL panels (no panel-specific header code): the panel takes INJECTED ACTION BUTTON TEMPLATES for different scenarios (the `adoptHeader` door of 847), and an ATTRIBUTE on the panel (e.g. `data-searchable`) shows a SEARCH INPUT ROW in its header that spans the header's full width. The filter panel, the Nodes list and any future panel use that one row; the search event and value are the panel's own (`panel-search`), no copy per content. ALSO: the filter panel header shows an ORPHAN DIVIDER before the minimise-to-tab button (the panel's divider after its `actions` slot, drawn once content adds actions): draw a divider only BETWEEN two non-empty groups | bug |
| ⬜ | 30zzua861 | 861 | PANELS (Will, 2026-11-06) — a panel that is FLOATED from a panel OPEN ON HOVER (a tab's peek) still runs the mouse-out check that hides the hover panel, so it hides when the pointer leaves. A FLOATING panel must not: drop the hover-out (and the press-outside/Escape shut) the moment it floats. Measure: hover a tab, press Float, move the pointer away: the panel stays. Spec it in the overlay panel's `hover` → `floating` path | bug |
| ❓ | 30zzua862 | 862 | PANELS — EXPLORE (Will, 2026-11-06) — can HTML TEMPLATE SWITCHING change a panel between a FULL panel (fixed, overlay, floating) and a MINIMISED one (the tab)? Swap the inner HTML (a `<template>` per `data-dock-state`: `full` and `tab`) and let CSS do the rest, instead of one shadow tree full of state branches. "The more we can do with HTML and CSS the better. The simpler and leaner the code the better." A SPIKE with numbers: lines of TS and CSS before and after, state kept across the swap (scroll, focus, the content's open sections), a11y (focus return, the tab's name), and the swap's cost. Fold the result into plan 856 (`data-dock-state`). WILL, LATER: we may not need a tab at all: in the `tab` state HIDE everything but the CONTAINER HEADER, hide most of the header too, size it to FIT THE LABEL, and ROTATE it in the panel area: one component, mostly CSS, no second tab component (compare this against the template swap). WILL: with this way the HOVER target never switches from a tab to an overlay panel: the SAME box grows from the rotated label to the overlay on hover, so no second element and no hand-over | spike |
| ⬜ | 30zzua863 | 863 | PANELS (Will, via the panel session, 2026-11-06) — DRAG a panel to the LEFT edge of the content area and release: it drops into the LEFT panel area; the same for the RIGHT edge and the right area. THE USER PICKS THE AREA, so the left-side / right-side SETTING GOES AWAY (859's Demos setting "Filter panel in the right panel area" and `filterPanelRight` are removed; the kept state remembers the side the reader chose; `data-side` stays as that state). TWO OR MORE panels in one area ALWAYS show the TABS. Ties to plan 856 (the dock side `data-dock-side`) and way (b) of 862; the panel session builds it after way (b) and 858 part 2 / 859. ALSO (Will): the PANEL MODE (fixed, overlay, tab) set on ONE panel in a panel area applies to ALL panels in THAT AREA. Floating, drill-down and new-tab are NOT part of the rule (a panel keeps those for itself). Fits plan 856: the AREA holds the mode, the panel keeps only floating, drill-down and new-tab | feature |
| ⬜ | 30zzua864 | 864 | PANELS (Will, via the panel session, 2026-11-06) — (1) the NODE panel header's DRAG HANDLE is not TOP-LEFT aligned: align it top-left (the grip leads the header, its top and left on the header's top-left, as the node's grip is). (2) REPLACE the ONE contextual dock button of 854 ("Dock as overlay" / "Dock as inline") with TWO SEPARATE buttons: "Dock as overlay" and "Dock as fixed" (the current one is shown disabled or pressed). Built by the panel session in its way-b worktree (`../sherpa-ui-way-b`) with the tab work; the button group and `dockState` follow | minor |
| ⬜ | 30zzua865 | 865 | PANELS (Will, via the panel session, 2026-11-06) — the panel HEADER BUTTON GROUPS, in this order, a DIVIDER and a GAP between each group: (1) CUSTOM ACTIONS (may be several groups); (2) Dock as Overlay, Dock as Fixed; (3) Minimise, Maximise (full page drill down), New tab; (4) the OVERFLOW menu; (5) Close. When the panel is TOO NARROW for the buttons and the title, FOLD the groups into the overflow menu, ONE GROUP AT A TIME ("progressively"). The FILTER TOOLBAR already does this: REUSE it, write NO new code. Joins 864 and the one `data-dock-state` of plan 856; builds in the way-b worktree after the tab fix | feature |
| ⬜ | 30zzua866 | 866 | FILTER PANEL (Will, 2026-11-06) — in the filter PANEL show the FIELD LABELS on the ORGANISE category chips (the Group and Sort chips: today a chip shows only its value or icon, as in a narrow bar; the panel has room, so it reads "Sort by · Name" / "Group by · Status"). Only in the panel (roomy), not in the toolbar bars. Read the chip's `data-label`/field label the way the other chips do; no new attribute if an existing one fits. Measure first on Records with the panel open. WILL ANSWERED: in PANEL mode each Organise chip shows its FIELD NAME in its LEFT HALF (the chip's name part); the section label (the panel's label-column heading) is "Organise" | feature |
| ⬜ | 30zzua867 | 867 | PANEL AREAS (Will, 2026-11-06) — a weird DOUBLE BORDER between the content area and the filter panel in the RECORDS view (the panel on the right): likely the line 848/851 drew on the area's outside edge (`.area::after`, `start-rail`/`end-rail`) PLUS the panel's own border or the content's. ONE line only. Measure the pixel columns across that edge on Records (panel fixed, overlay, tab), find each source of a line, and delete the extra. Same check on the Node Editor's left edge (nav to canvas). WILL ANSWERED: the Records card ends FLUSH at the area line, with no card border on the edge that faces a panel (one rule on the area's neighbour) | bug |
| ⬜ | 30zzua868 | 868 | FILTER TOOLBAR (847 P4 left over, 2026-11-06) — the quick filter toolbar is NOT yet the landscape bar only: its PORTRAIT and FLAT sections stay, because the filter panel's sections ARE `<sherpa-quick-filter-toolbar data-orientation="portrait">`. Move them into their own SECTION component (`sherpa-filter-section`?) the panel uses, and delete `data-orientation`/`data-flat` and the portrait templates and CSS from the toolbar (the portrait code is woven through the chip, Organise and drag logic). Plan first; behaviour and look unchanged (the P0 baselines are the oracle). 847 P4 deleted about 800 lines already | refactor |
| ⬜ | 30zzua869 | 869 | FILTER TOOLBAR (Will, 2026-11-06) — the "Filters as Panel" toggle (the provider's mode button, "Filter in the panel" / "Filter in the toolbars instead") must live in the APP HEADER's filter toolbar (the View/page-level toolbar), not only in data grid toolbars; and NOT in LOCAL-scoped filter toolbars (a card's or grid's own toolbar). One home, the page-level bar; in panel mode it is the panel's custom action (865 puts custom actions first). Cf. 847, 865 | feature |
| ⬜ | 30zzua870 | 870 | FILTER TOOLBAR (Will, 2026-11-06) — remove "Limit to matching" and "Hide invalid filters" from the FILTER PANEL's overflow (⋮) and from LOCAL-scope filter toolbars' overflows. The VIEW scope's settings set them for ALL scopes on the page (one place: the page-level/View ⋮; the scopes follow it). Delete the per-scope rows and their code paths (clean up) | feature |
| ⬜ | 30zzua871 | 871 | PANEL AREAS (Will, 2026-11-06) — the panel AREA for INLINE DOCKED panels is INSET into the content area by 16px on ALL sides (a 16px gap to the nav/header/window edge and to the content); the DOCKED-FIXED panel has 4 ROUNDED CORNERS. NOTE the conflict with 867 (the card flush at the area's one line): an inset, rounded panel is its own card, so the area LINE (848/851) and the flush-card rule probably go away for fixed panels; settle it with 859/856 and tell Will what is kept. One rule for the grid and the canvas (859) | feature |
| ⬜ | 30zzua872 | 872 | PANELS (Will, 2026-11-06) — with the new panel rules, a panel in TAB mode that is HOVERED (or pressed/tapped) shows ONLY the OVERLAY mode, never the LAST OPEN mode (fixed, floating...). The tab's peek is always `data-dock-state="hover"` = an overlay; "Dock as fixed" is the way to fix it. The kept state does not decide the peek; it only decides what a press on a docked button does next. Cf. 854, 862 (way b: the hover is the same box), 856 | bug |
| ⬜ | 30zzua873 | 873 | PANEL AREAS (Will, 2026-11-06) — the 33% MAX WIDTH of a docked panel (857) ignores the space the panels on the OPPOSITE side need: with a left and a right panel both docked they can take 66% and starve the content (and with the 16px inset of 871). The max must come from the ROOM LEFT: the two areas share the room, so `max = (room - the opposite area's width - the content's minimum) / 1`, never over a third by itself; the content keeps a minimum width. One rule in the shared area code (859) | bug |
| ⬜ | 30zzua874 | 874 | NODE EDITOR / SOCKETS (Will, 2026-11-06) — CONNECTED sockets do not look as expected. A connected socket is drawn as: (1) a 1px BORDER (the socket's colour), (2) a 1px WHITE INSET inside it, (3) the connected socket's FILL in the SOCKET'S SHAPE (circle, triangle or diamond by type) inside the white. Read the socket pixels (a spec by pixel columns across a connected circle, triangle and diamond), then fix the one socket rule in `sherpa-node-row`/`sherpa-node` CSS (Style pins, no bespoke colours; mind the 799 pixel specs). ALSO (Will): the TRUE socket's TRIANGLE is poor: use a CIRCLE instead (my reading: the boolean socket shape becomes a circle everywhere, one rule; its colour still says boolean; say so if this reads wrong, and narrow it to the Condition's True and False). WILL SAW: a connected socket shows NO FILL: white or a single colour out to the border: the fill shape is missing. WILL (screenshot): still wrong: the connected sockets are a coloured ring with a WHITE centre. Two ideas to compare: (a) the connector END ELEMENT (the socket end) sits ABOVE the nodes and the connector LINE sits BEHIND them; (b) the socket owns a FILL "THUMB" part, shown when connected and hidden when not (CSS from a connected state). My pick: (b), one DOM part, CSS only | bug |
| ⬜ | 30zzua875 | 875 | DEPTH (Will, 2026-11-06) — the NAV and the APP HEADER do NOT need a DROP shadow over the page: the CANVAS CONTAINER (the content area the nav, header and panel areas frame) needs an INNER shadow instead (an inset shadow on its top and left/right edges, so the content reads as sunk into the frame). Remove any drop shadow the nav and the app header cast onto the content (Elevation tokens, `passthrough` where it was `sm`...), add one inset shadow on the canvas/content container with an Elevation token (no bespoke value; dark mode via the mode layer), one rule for the layout grid and the canvas. Read both in a screenshot before and after | feature |
| ⬜ | 30zzua876 | 876 | PANEL TABS (Will, 2026-11-06) — the minimised panel TABS are NOT flush to the area's side: they take the same PADDING INSET inline panels use (871: 16px). ALL of a tab's corners are ROUNDED, unless there are MULTIPLE tabs in one area: then they sit in a CONTROL GROUP (`sherpa-group`) and use the group's position styling (Grouping solo/start/mid/end: the shared edges square, the outer corners round) to STITCH together. One rule in the shared area code (859), no tab-only corner CSS. Goes with 871 and the CSS-tab spike (862 way b). ALSO (Will): an INSET tab is no longer rotated 90 degrees: it reads HORIZONTALLY (normal text), a small rounded button on the area edge; drop the vertical writing-mode/rotation | feature |
| ⬜ | 30zzua814 | 814 | TESTS — Demos `reforged-card-toolbars.spec.ts:225` ("Site's heading in the grid matches Customer's…") flaked in three full runs (776, 785, 779); find the race | test |
| ⬜ | 30zzua818 | 818 | PRESETS (793 pick) — one way to ship an app preset: move page.v1 `scopes.<s>.presets` (Records' three, Devices' four) into entities.json as Preset Filters, and delete `scopes.<s>.presets` | cleanup |
| ⬜ | 30zzua820 | 820 | DEMOS (798 pick) — export `formatFieldValue` from `sherpa-ui/data` and use it in the Devices and Records details panels, so a value reads one way on the page | feature |
| ⬜ | 30zzua821 | 821 | NAV (804 pick) — `nav-select` carries `href`, so `outlet-nav.ts`'s guard works and only the page change writes the title (a public event change: spec, docs) | feature |
| ⬜ | 30zzua761 | 761 | NODE EDITOR (Will, 2026-11-05: A) — an AI node gets its OWN resting tint, so its picked look (the active fill) differs from its resting one. Figma gives AI `surface/brand-lighter` (#f8ebff), the active fill itself; no AI kind exists yet, so the tint is picked with Will when the first AI kind lands | feature |
| ⬜ | 30zzu9l | 725 | TESTS (found by 718's lane, 2026-11-04) — Demos `reforged-filter-chips-green.spec.ts:43` fails 2–3 in 60 in Firefox under parallel load, old build and new | test |
| ⏸️ | 30zzu9o | 728 | **PARKED (Will, 2026-11-04): node work before MCP work — "the MCP is for AI agents to use much later"; a lane was stopped while it read.** MCP (found by plan-700's G4, 2026-11-04) — **Will, 2026-11-04: B — each spec STATES what its component is; the MCP's guess and its 6 exceptions go.** a slot check must know what a component IS (text, icon, control…, the `data-accepts` words): A, the MCP works it out from the tag's last word, a `name` prop, the category and a list of 6 exceptions (built) / B, each spec STATES it, read from the class as G0 reads `asks`, so the exceptions go. Pick B: one owner, no guess | decision |
| ❓ | 30zzu9q | 730 | CHARTS (found by 717's lane, 2026-11-04) — a line's END labels sit flush with the plot and get half a step of room, so they cut to "…" first: A, keep it (the line meets the y-axis; as built) / B, move the points to the cell centres ("between tick marks"), so every label gets a full step but the line no longer meets the y-axis. Pick A | decision |
| ❓ | 30zzu9r | 883 | **PLAN: [plan-883-figma-feedback](history/plan-883-figma-feedback.md).** FIGMA (Will, 2026-11-10) — feed the code and Demos back into the Sherpa-UI Figma library: components, variants, states, styling, layouts, patterns, and concept pages (data layer, presentation layer, queries and scopes, layouts). The diff, read live: 75 code components against 80 in Figma; 18 code only (layout, nodes, Filter Panel), 43 twins where the code shows more, 143 state pins with 3 shown, every docs frame stale, no concept or pattern page. Tooling T1–T4, then phases P0–P11. After 885 (one node editor; Will, 2026-11-10) — 885 is done. Waits on Will: D1–D5 in the plan's §10 | figma |
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
