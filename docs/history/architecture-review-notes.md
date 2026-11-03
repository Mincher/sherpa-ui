# Architecture review — side notes (2026-11-03)

Working notes behind [docs/ARCHITECTURE-REVIEW.md](../ARCHITECTURE-REVIEW.md). Raw
facts, measured or read, so a later pass can return to an area without reading it
again. Each line says where it came from.

## Measured (commit 88c327c3)

- **Size:** 47,439 lines of TypeScript in `src/` (icons aside), 20,438 of CSS, 4,694
  of HTML. 68 components; `core/data` 49 files, `core/ui` 34, `core/browser` 17,
  `core/worker` 2. 34 scripts, 190 e2e specs, 165 Node tests.
- **The five largest files:** `sherpa-quick-filter-toolbar.ts` 2,909 ·
  `sherpa-data-grid.ts` 2,670 · `sherpa-menu.ts` 2,525 · `data-source.ts` 2,165 ·
  `sherpa-provider.ts` 1,974. Then `query-context.ts` 1,450, `sherpa-quick-filter.ts`
  1,443, `sherpa-element.ts` 1,251.
- **Weight per import (raw JS, the `check:weight` baseline):** a badge 255,935 B
  (11 files), a button 265,576 B (13), `data.js` 195,931 B (54), `app.js` 695,956 B
  (97), `index.js` 1,254,388 B. The grid 596,928 B; the filter toolbar 590,623 B.
- **Why a badge weighs 256 KB:** `dist/core/ui/sherpa-element.js` is 241 KB, of which
  ONE string is 232,901 characters — the shared sheets, inlined. Nearly all of it is
  `src/core/sherpa-style-modes.css`: 227,934 B raw, **7,925 B gzip, 3,369 B brotli**.
  3,449 lines, 128 rules; each rule re-maps ~25 `--sherpa-style-*` tokens to one
  Style mode (1,330 `--_status-*` lines alone). Pins per tag: `sherpa-quick-filter` 15,
  `sherpa-button` 11, `sherpa-calendar-cell` 4, `sherpa-switch` 3 …
- **So:** the wire cost is small (brotli 3.4 KB); the costs are PARSE (once per
  page, a shared `CSSStyleSheet`) and the CASCADE — every pin adopted into every
  shadow root. And `check:weight` gates raw bytes, which overstate the wire 30–70×
  for this kind of text; it says nothing of parse or style time.
- **Stores:** ArrayStore, EventStore, HeldStore, IdbStore, JsonStore, LocalStore,
  RequestStore, RestStore, SessionStore, SocketStore; wrappers `statusFields`,
  `keepCache`, `keepOutbox`, `fakeRemote`, `localRecords`.
- **Docs:** `TRAPS.md` 20,502 lines (735 traps), `TODO.md` 13,844 lines (48 rows open),
  `TRAPS-INDEX.md` 1,133.

## Native features in the three test engines (probed 2026-11-03)

Chromium 153, Firefox 155, WebKit 26.6, by `scratchpad/probe-native.mjs` (feature
tests; style queries tested by their EFFECT, the rest by `CSS.supports`, a parsed
rule, or the API's presence).

| Feature | Cr | FF | WK | Note |
|---|---|---|---|---|
| Custom-property style queries `@container style(--m: x)` | ✅ | ✅ | ✅ | **measured by effect** — a mode can be ONE property |
| Anchor positioning, Popover, invokers (`commandfor`) | ✅ | ✅ | ✅ | |
| `field-sizing`, `:has()`, `:state()`, `@scope`, typed `attr()` | ✅ | ✅ | ✅ | typed `attr()` maps `data-*` to lengths in CSS |
| View Transitions, `<details name>`, `hidden=until-found` | ✅ | ✅ | ✅ | |
| Declarative Shadow DOM (`shadowrootmode`) | ✅ | ✅ | ✅ | row 223 |
| Navigation API, URLPattern | ✅ | ✅ | ✅ | |
| Set methods, Iterator helpers, `Object.groupBy`, `Array.fromAsync`, `AbortSignal.any` | ✅ | ✅ | ✅ | |
| **Temporal** | ✅ | ✅ | ✅ | WebKit 26.6 has it — `core/ui/temporal.ts`, the iOS stand-in, may go once the support floor allows |
| CSS `@function`, `if()` | ✅ | ❌ | ✅ | `T-a-css-function-needs-its-longhand-first` stands |
| Scoped custom element registries | ✅ | ❌ | ✅ | |
| Customizable `<select>` (`appearance: base-select`) | ✅ | ❌ | ✅ | |
| CSS module scripts (`with { type: 'css' }`) | ✅ | ✅ | ❌ | so the build's inlined sheets stay, for now |
| `scheduler.yield` | ✅ | ✅ | ❌ | |
| `interestfor` | ✅ | ❌ | ❌ | |
| scroll-state queries | ? | ? | ? | the probe only parsed the rule; memory (measured before): Chromium only |
| Web Locks | — | — | — | the probe page was not a secure context; Demos uses them in all three |

**Prototype — one-property modes by style query** (`scratchpad/probe-stylequery.mjs`,
all three engines): a shadow root with `:host([data-current]) { --mode: active }` and ONE
shared `@container style(--mode: active) { .inner { --tok: var(--active-…) } }` re-maps
the INNER parts' tokens — ✅ Chromium, Firefox, WebKit. It does NOT reach `:host` itself
(a style query inside the shadow root never matches the host). So the 128 pin rules could
become ~8 mode blocks plus one line per pin, where each component paints its look on an
inner part, not its host. Components that paint on `:host` would move that paint inward
first.

## Open TODO rows that bear on the architecture (read 2026-11-03)

- **692 = 595** — nested Advanced conditions (two rows, one piece of work).
- **548** — presentation swapping: built; Will wants it unified and standardised.
- **518** — review of all the filtering code (🚧).
- **78, 555, 616, 671, 556–562, 569** — nodes: components, the Query node editor,
  the node engine (`runWorkflow`, HELD), a graph that shows a workflow as it runs.
- **170** — the data layer on client, server or both (plan, not soon). Sherpa never
  handles auth. The Service Worker already spoofs remote stores.
- **223** — server rendering with Declarative Shadow DOM (later): first, how
  templates and definitions are delivered.
- **77** — UX patterns by contract: a lightweight decision model, MCP tools and
  skills for agents building UI to pattern and layout specs.
- **652** — every step done (S9 stopped by its own rule): the row can close.

## Notes per area

(filled in as each area is read)

### Utility layer (agent report, 2026-11-03; P = `sherpa-provider.ts`)

- **The provider holds ~15 jobs** (its header says "a thin DOM door"): answering asks
  (1252–1433), page open/close (814–965), 24 settings pairs (242–702) + `#offerLimit`
  (717–744), the summary spec (1495–1532), Show as swapping + pivots + grids made from
  charts (1611–1850, ~240 lines), hover highlight (438–477), legend picks (1858–1941),
  card states (1141–1219), reach (915–956), notices (192, 1099–1132), toolbar shown
  (1546–1574), chart titles (1579–1600), App Context (651–687), `definition.ui` (1063–1089),
  `data-where` (1453). `#pivotOf`/`#madeTable` are pure rows→table: data layer.
- **Duck typing:** `'drawScope' in el` ×5, `drawPresent`, `columnClause`, `drawHighlight`,
  and tag names (1567, 1896). Components should DECLARE capabilities (`static asks`).
- **Doc vs code:** PROVIDER-DESIGN §3 says an unprovided key travels up; `#onRequest`
  stops every request (P:1255). Nested providers cannot fall through.
- **Settings reach components 7 ways:** bar attributes (P:717), source properties
  (P:780; data-source.ts:2000), `querySelectorAll` writes (P:624), stored callbacks
  (415, 430), `<html>` attributes (Demos index.html:737–757), `definition.ui` →
  `applyState`, `session.overlay` (session.ts:105). A new setting = field + getter/setter
  + attribute + Demos table row + component prop. Context subscribe (context.ts:37)
  exists and is ignored.
- **Steering events** (bind-source.ts:198–218): 13. `QueryRequest` kinds (query.ts:212):
  10 + list. Outside both: 8 provider events (P:206–233), 5 provider-page events
  (157–179), legend-hover, a second column-filter-change (P:1410).
- **Presentation written 4 ways:** `presentation-change` (headers), `{presentation}`
  request (toolbar), sort/group rerouted on a slot (bind-source 283–303), direct
  `query.present` (node-graph.ts:440). The Node Editor bypasses the slot rerouting for
  sort/group/search (node-graph.ts:436–438) — possible bug.
- **Show as (548):** `Presentation` in the Query (query.ts:95–127), `PRESENTATION_KINDS`,
  `presented()`; UI `SHOWN_BY` tag map + `shownAs()` (P:122–136), `shown-*-tpl`
  templates, `#swapped` `replaceWith` (1613–1665); special cases: gauge→grid only,
  `LINE_ONLY`, radial by `data-type`, pivots, legend moves, retitling. Demos repeats
  the kind map (index.html:851).
- **A page's state is kept in 9 places**, in 3 JSON shapes (`ProviderState` v2,
  `ViewSnapshot` v2, `keptEntry`); "draft" means two things.
- **Native:** used — Navigation API, `:state()`, popover, `<dialog>`, `commandfor`,
  `structuredClone` (34), EventTarget. Unused — URLPattern, scoped registries, `@scope`
  (2 files). bindSource's `steered` WeakSet + `composedPath` (bind-source.ts:81) re-does
  what `stopPropagation` at the inner binding gives.
- **Node editor needs:** `provider.describe()` of every binding (`SourceBinding.debug()`
  gives only id/rows/readonly/steerOnly); a trace bus (request in, change out, load
  start/end, deliver per binding) — `report()` is errors only, `query-change` has `by`
  not the request; rules as DATA; one edit path (`ask()`).

### Hosts and browser (agent report, 2026-11-03)

- **Demos wires its stores twice, differently:** sw.js:27–35, 49–51
  `HeldStore(fakeRemote(…), {outbox})`; the page's fallback (index.html:812–843) a bare
  `fakeRemote` (no held set, outbox, `waits`); `customers-scale`'s fallback
  `createDataHandler({stores:{}})` answers 404; the Dashboard reads `customerStore`
  directly (contexts/dashboard.js:58); the store NAME stands for the debug mode
  (index.html:903). → one `defineStores()` both hosts import, one name per store.
- **`handle()` drops the request:** stores get `LoadOptions` only (data-handler.ts:174,
  188–230). Auth headers stop at the worker; Demos' spoof header is a module global any
  tab overwrites (sw.js:20–24); row 170 needs a per-request context (`stores: (req) =>`).
- **The conflict check is lost across the protocol:** `RequestStore.update/remove` ignore
  `WriteOptions` (request-store.ts:152, 158); the handler never reads
  `If-Unmodified-Since`; `RestStore` sends it (stores.ts:312). D3 breaks once Host C exists.
- **No Node host:** server/index.mjs mounts nothing at `/sherpa/data/` and bridges
  Express↔`Response` by hand (76–84). Missing: a Node adapter, CORS (OPTIONS answers
  `Allow` only, :171; a refused preflight reads as offline, request-store.ts:168),
  `application/problem+json` (today `{error}`, :260), POST for state-changing acts
  (`?recheck`, `?take`, :162, 191, 196), `no-store`, a guarded `since` (:200), ONE version
  marker (header :168 and body `v` :89).
- **Sign-out:** `clearKept()` clears the calling context only (cache-keep.ts:162–172); the
  worker's set and port survive and write the copy back; outbox and notices never clear.
- **Two notice vocabularies:** `UpdateNotice` (notices.ts:19) and `FeedNotice`
  (updates-feed.ts:16); `rows` documented as "moved" but HeldStore sends the set's size
  (held-store.ts:114); `FeedNotice.build`/`.at` never read.
- **Push vs feed:** push rechecks or says a notice for a store holding no set
  (serve-data.ts:98); the feed's `?recheck` for one is a silent no-op (data-handler.ts:192).
- **Leader election twice:** `shareFeed` and `followUpdates` share the `sherpa-feed:`
  namespace — `shareFeed(x,'updates')` collides.
- **Five rechecks, no dedupe:** tab shown (per source per tab, sherpa-provider.ts:955),
  feed, gap, push, Refresh (data-source.ts:1584). One shared `#shown` in HeldStore: one
  tab's Refresh moves every tab's rows (held-store.ts:118–124) (Likely).
- **Seven persistence places:** IndexedDB `sherpa` (views), `sherpa-cache`,
  `sherpa-outbox`, `sherpa-notices`, the app's own DB; localStorage (persist-view,
  saved-filters, session, seed marks); sessionStorage (view-drafts, `keepAdded`); Cache API.
- **Bug: two stores cannot share an IndexedDB database:** IdbStore defaults to `sherpa`
  (idb-store.ts:37) but upgrades only its own object store at version 1 (145–155).
- **Bug: in the worker `seedVersion` never re-seeds** — the mark lives in localStorage
  (web-storage.ts:34; idb-store.ts:64–73).
- **Kept set = one record of up to 50k rows**, rewritten whole (cache-keep.ts:131).
- **Native missing:** navigation preload; `navigator.storage.persist()`/`estimate()`;
  Periodic Background Sync (vs `watchForUpdates` polling, updates.ts:61); a
  `pushManager.subscribe` helper; `Readable.fromWeb`. Notification click ignores its
  `url` (serve-data.ts:108–110).
- **`/sherpa/data/` written 6 times** (data-handler.ts:156, request-store.ts:210,
  serve-data.ts:139, follow-updates.ts:30, app-files.ts:66, sw.js:14) → one `DATA_BASE`.
- **Options no caller sets:** `strategy:'fast'`, `timeout`; `KeepOptions` version/maxAge/
  maxRows; `HeldStoreOptions.cap`; `updatesFeed` keep/beat; `followUpdates` url/base;
  `watchForUpdates` every.
- **Demos builds what Sherpa should offer:** the build-stamped sw.js + deploy hook + file
  watch (index.mjs:46–103) — Sherpa requires it (updates.ts:51) but ships no server half;
  worker registration with a client id (index.html:880–888); the spoof header.
- **Each `RequestStore` opens a BroadcastChannel and never closes it** (request-store.ts:74).
- **No trace stream:** `report()` is errors only; store events, `reach-change`,
  `Updates`, 3 channels scattered; the worker's steps emit nothing. Needed: a
  `sherpa-trace` channel, `onTrace`, spans `{host, step, store, id, parent, t}`, a request
  id (`traceparent`) set by `RequestStore` and echoed by `handle()`.
- **Row 223:** `parseViewMarkup`/`checkViewMarkup` need `DOMParser` (view-markup.ts:97,
  142); `loadViewLibrary` reads `document.baseURI` (view-files.ts:19); no route serves
  definitions.

### Data layer (agent report, 2026-11-03; paths under `src/core/data/`)

- **One filter idea, ~9 shapes:** `Filter` tuple tree, the wire form (store.ts:185–187,
  data-handler.ts:40); `Condition`/`Where` (where.ts:22–34, schema `$defs/condition`);
  `FieldReading` (filter-state.ts:171); flat `FieldCondition` rows (:217); derived
  `FilterState` (:83); `ScopeQuery.readings` (query.ts:73); `ViewScope.superseded` —
  `Where | Record<string, FieldReading>` in one slot (query.ts:248); presets in 3 shapes
  (page-definition.ts:38 → query-context.ts:946 → filter-state.ts:213); status `when`
  (status-field.ts:29), copied untyped into `FieldDomain.when` (validate.ts:110), parsed by
  hand in `zonesOf` (field-catalogue.ts:237–245); the workflow node's own `{key,op,value}`
  (workflow.ts:66–74).
- **Converters:** `clauseOf` (where.ts:139), `clauseConditions` (filter-state.ts:611),
  `rowReading` (where.ts:100), `fieldState`→`stateClause`→`chainRows`→`conditionOf`
  (where.ts:40–55); the node graph's comma-split `editedCondition` breaks on a comma in a
  value (query-graph.ts:146–149).
- **Detours:** `whereFilter` (status-field.ts:68–71) goes Where→readings→`presetClause`→
  `fieldState`→Filter though the private `clauseOf` gives a Filter; `presetTouches`
  (filter-state.ts:336–338) builds a fake `FilterState` to test one value.
- **Nesting is blocked in exactly two places:** `clauseConditions` gives up on >1 group
  (filter-state.ts:619–622, TODO 595); where.ts:79–85 reports `unreadable-condition` and
  drops it, though the type and the schema allow nesting.
- **One tree:** an object-form tree beside `Filter` — `{and|or:[…]} | {field?, op,
  value, off?, id?}`; `Filter` stays the compiled/wire form; Advanced rows a per-field
  subtree; presets, status `when`, saved filters, the node editor share it; `Where`
  sugar parsed once; `FieldReading` keeps only the Simple control's state.
- **Schema drift:** `$defs/condition` has no `all` and forbids extras; `Condition.all`
  exists (where.ts:29).
- **Store capabilities said 3 ways:** 8 flags + `stale` (state, not a capability) +
  `history` (an in-process object) + 6 optional methods (store.ts:244–312); `holds`
  implies `recheck`/`take`.
- **Remote is not used as local:** DataSource checks `store.holds` 7× (data-source.ts:1426,
  1473, 1485, 1498, 1507, 1581, 1617) and keeps its own `StoreCache`/`HeldReads` → always
  put a remote store behind `HeldStore` (in page or worker); DataSource drops holding.
- **Remote loses capabilities:** no `distinct` over the wire (counts download rows,
  source-counts.ts:31); no `history` over the wire (the "redo only what moved" check,
  data-source.ts:1419–1444, always fails remotely); `send()`, `waiting`/`queued`/`lost`
  not in the Store type.
- **Wrappers copy flags by hand and drift:** `statusFields` (status-field.ts:163–173) drops
  `holds`/`stale`/`recheck`/`take`/`send`/`scan`/`history`; `fakeRemote` (fake-remote.ts:65–76)
  drops `totalFirst`/`holds` → one `wrapStore`.
- **No cancelling:** `LoadOptions` has no `signal`; stale loads are discarded, never aborted.
- **"take" means four things:** page size, `Store.take()`, `QueryContext.take`, `Updates.take`.
- **`sameRows` JSON-stringifies whole sets** (held-store.ts:315). `HeldStore.update/remove`
  drop `WriteOptions` (192, 200).
- **DataSource ~120 members:** paging, tickets, reach, held reads, compile cache, walk
  counts, `describe` view-models, UI toggles `showAs`/`axisChips` (2000–2012). Seams:
  reads (1347–1600), counts (1759–2046), view-model (`describe`, `selection`, `fieldStatus`).
- **QueryContext mixes 4 jobs:** edits in place (query-edits.ts:124 returns void),
  declarations, member fan-out, UI element references (`parts.only: BoundControl`,
  `bindOf(el)`, 128, 197) → pure `(q, act) → q` edits + declarations + members.
- **`QueryRequest` is in the wrong layer:** dispatched by `ask()` in ui/bind-source.ts:254;
  omits sort/group/search/hold/move/setQuery (go through `steer`). Move `ask` into
  QueryContext and complete the type: ONE door for the node editor, MCP, agents.
- **Node engine:** `NODE_KINDS` + `checkWorkflow` (workflow.ts), no `run`; pure steps ready:
  `compile` (query.ts:472), `planRead` (read-plan.ts:40), `fieldState`, `filterRows`/
  `sortRows`/`groupRows`/`applyOptions`, `summarise`, `planWalk`/`walkInOrder`,
  `absoluteDates`. Missing: typed sockets (only `'value'|'object'`, workflow.ts:25), a
  trace, cancelling, edits returning a new Query (undo), nested trees.
- **Native:** used well — `Map.groupBy` (store.ts:729), `toSorted`, one `Intl.Collator`,
  `AbortSignal.timeout`, BroadcastChannel, Web Locks, `WeakRef`, `URL.canParse`. Hand-rolled
  Set ops: data-source.ts:2118 (`symmetricDifference`), query-context.ts:1093, 1265
  (`union`), ~13 `filter(x => !set.has(x))`. `Intl.DateTimeFormat.formatRange` could replace
  format-date.ts:33–42.
- **BUG (measured):** `durationSpan` (store.ts:160–169) uses `setUTCMonth`: "last 1 month"
  on 2027-03-31 → 2027-03-03 (should be 02-28); "next 1 month" from 01-31 → 03-03; "last 1
  year" from 2028-02-29 → 2027-03-01. Temporal clamps. Node 24 has no Temporal. → TODO 694.
- **Little dead code:** `summariseZoned` (own file only), `allow.ts` `nextState` (tests),
  `passOver`, `isSchema`/`unknownEntries` (tests). Two deep-copy schemes (`copyDeep`
  query.ts:337 vs 27 `structuredClone`); two plain-object guards (query.ts:237,
  web-storage.ts:112). Shims: `readingRows` reads pre-list readings (filter-state.ts:266–282);
  `superseded` two types. `FieldReading.present` is derived yet an answer key (query.ts:325).

### Definitions, nodes, MCP, tooling (agent report, 2026-11-03)

- **~12 definition kinds, checked 3 ways:** app.json (schema + `checkApp`, names only,
  app-definition.ts:88); page definition (schema; NO `checkPage` in the library — its name
  checks live in the MCP, mcp-server/tools/data.js:828–849); views library (no schema,
  loaded unchecked, view-files.ts:20); `ViewSnapshot` v2 (persist-view.ts:107); saved
  filters (query.ts:230); presets (page-definition.ts:37); status fields (TypeScript only,
  set up in Demos JS; page.v1's field `type` allows text/number/date only, :56); workflow
  (schema + `checkWorkflow`, workflow.ts:137); component spec + example; token and Figma
  files (`tokens.config.json` read by nothing). Schemas run only in tests, `spec:check` and
  the MCP's `validate_page`; at run time only names are checked.
- **Overlaps:** per-component state by id ×3 (`PageDefinition.ui` — `{type: object}`,
  never checked against the spec; `SavedView.ui`; `ViewSnapshot.elements`); named condition
  sets ×4 (saved filter, View query, preset, status `when`); `$defs/condition` not `$ref`'d
  by workflow.v1 (values untyped, :39). Starter files its page definition under
  `view-schemas/`.
- **Nodes:** `queryGraph` (query-graph.ts:176) is derived from the Query (one truth) but has
  its own registry `QUERY_KINDS` (:27) beside workflow's `NODE_KINDS`: two registries,
  `source` means two things (workflow.ts:54 vs query-graph.ts:29). `bindQueryEditor`
  (node-graph.ts:409): scope/condition via `ask()` (:423, 433); arrange calls
  `setSort`/`setGroup`/`setSearch` directly (436–438); presentation `query.present` (:440);
  page size `source.setPageSize` (:420); routes move a condition (446–469); positions only
  in the DOM (311–314). Demos' Node Editor (contexts/node-editor.js) is stand-in markup with
  its own connectors (a copy of node-graph.ts:166–189) and its own ops `equals`/`greater`.
  Missing: presets, saved filters, status fields, superseded in the graph; edits written
  back to the definition; a trace. `planWalk`/`walk.ts` give ordered steps with counts —
  per-node row counts for free. plan-78-query-editor.md:10 header stale ("WAITS for 548").
- **MCP:** 19 tools, 5 resources, 3 prompts. Can read specs/defs/tokens, validate/compile
  defs, validate page/app, run a query over rows, scaffold from the Starter, drive a
  component on localhost. Gaps for 77: the pattern system was REMOVED (prompts/index.js:8–9);
  no pattern/layout schema or decision tool; no page-definition generator; `validate_page`
  ignores workflows, views, `ui` vs specs; `check-usage` is not an MCP tool; no resource
  serves page/app/workflow schemas; no preview tool (drive needs the Gallery on :4500).
- **Generated:** `*.component.json` (712 KB), custom-elements.json (383 KB),
  vscode.html-data.json (126 KB), docs/components/ (69 files, 6,587 lines), token CSS, 217
  icon modules, TRAPS-INDEX, `Map:` headers, 5 baselines. The spec committed in 4 forms +
  the MCP's `specToDef` 5th; round-trip coded twice (roundtrip-component.mjs and
  generate-component-spec.mjs:941); `spec:validate` ⊂ `spec:check`, Ajv compiled twice;
  `check:mcp` ⊂ `check:map`; `check:manifest` + `check:reference` → one `check:generated`.
- **Hook:** .githooks/pre-commit runs 15 steps; not in it: `check:extensions`,
  `check:weight`, `check:mcp-pack`; no npm script: check-tokens, figma-harvest-colours,
  resync-figma, roundtrip-component, compile-def, figma-extract-component.js. **No CI.**
- **Templates (223):** a production build inlines each `new URL('./x.html|css')`
  (build-reforged.mjs:102–123) and deletes the files from dist (155–160); dev fetches. The
  outlet fetches template + page definition, sets `innerHTML`, `provider.open`, `populate()`
  (sherpa-outlet.ts:380–400). DSD needs: the constructor keeps an existing shadow root
  (today it always `attachShadow`s, sherpa-element.ts:426); `<style>` text (adopted sheets
  cannot serialise); a DOM shim for `renderData`; 42 files use ElementInternals/`:state()`
  (not serialisable); templates read from `src/` (shipped). Already: `define()` is a no-op on
  a server (sherpa-element.ts:236); templates are HTML, definitions JSON.
- **Docs:** TODO.md 664 of 716 rows ✅ (93%), ~12,300 of 13,844 lines in done sections — the
  "nothing is deleted" rule (TODO.md:22–26). TRAPS.md 735 entries × ~28 lines; ~97 (13%)
  history wording; ~10 cite deleted files; one fully stale (T-component-extends-view-never-
  alters-it, :16246); one duplicate pair (:79 and :13904). Leaner: docs/traps/<area>.md (the
  index's 11 areas) with check-traps over many files; rule · why · probe per entry; TODO to
  its ~52 open rows + an archive.

### Presentation layer (agent report, 2026-11-03)

- **Pins:** sherpa-style-modes.css lines 10–569 = the 22 shared `[data-status]` and
  `[data-look][data-status]` rules (~40 KB); from 570 ~106 rules (188 KB) keyed
  `:host(sherpa-x…)` or to a class — each matches ONE component's root, yet every root
  adopts and tests them. Fix that works everywhere now: `project-tokens.mjs` writes each
  component's pins into its own generated token region (rule 20 allows it); the 22 stay
  shared; class-keyed pins (`.sherpa-button`, `.menu-row`, `.cell-tag`) into family sheets.
  Then style queries (my prototype: inner parts ✅ in all three; not `:host`).
- **The filter-host contract twice:** `BoundControl` (data-source-types.ts:298–330), 11
  optional draws; the grid implements them alone (`drawPresent` :880, `drawOffered` :898,
  `#markPresent` :909, `supersede` :1124, `drawReading` :1190); the toolbar separately
  (:1022, 1032, 1089, 1108, 1205); toolbar-column.ts a third partial copy → a
  `FilterHostController` keyed by field.
- **`sherpa-quick-filter` does every filter job:** bar chip, panel section, legend row
  (chart-legend.html:24, 35), grid cell filter (data-grid.html:147), and each grid heading
  holds three (filter, sort, group; data-grid.html:191–200). Split: sort/group toggles →
  `sherpa-button` `aria-pressed`; legend key → a light element; jump → nav.
- **`sherpa-menu` is five components:** popover shell + JS placement (:1222–1260,
  1937–2110); list/tree/select-all/drill/search (:1105–1200, 1557–1800, 2112–2260);
  condition editor (:563–1105); number body (:1308–1366); date body (:700–740, 1799);
  draft/apply/discard (:2360–2480). Imports filter ops from the data layer (:19–25).
  `showPopover({source})`/an invoker anchors by element reference (anchor positioning in all
  three) → likely drops `#bounds`, `#place`, `#reposition`, the ResizeObserver (~170 lines).
  `data-bounds` runs `document.querySelector` (:1946): blind inside a shadow root.
- **The grid decides data:** sorts itself unlocked (`#visibleRows` :2114, `#sortRows`
  :2124), pages itself (`#pageStarts` :1971, `#pageWindow` :1992), counts groups (:1936),
  reads distinct values (:923), slider min/max by `reduceRows` (:858), clauses→readings
  (:1063–1124) → a "column facts" ask of the DataSource. File seams: column filters
  681–1335, cell tags 1540–1860, find 1852–1920, group/paging 1920–2050 + 2272–2320,
  selection 2378–2660, row actions 2049–2110, resize 2319–2378, sub-grids 1345–1430.
- **Toolbar seams:** fit/fold (:254–570) → a general overflow-fold utility; organise chips
  (:2680–2900) → toolbar-organise.ts; actions (:2469–2680) → more-menu.ts; values/readings
  (:686–1300) → the controller; `#reflow` collapse steps (:269) → `@container` rules (Likely).
- **Show as:** `sherpa-provider.ts:126–140` tag map; `shownAs()` by `localName`;
  `#swapped`/`#chartFor` (:1612–1680) copy attributes through `LINE_ONLY`/`KEPT_ACROSS`,
  then `replaceWith` (:1662); `core/ui/show-as.ts:11–12` imports components into core — the
  layers inverted → `static presents` + a registry + `startViewTransition`.
- **Tooltips:** `liftTipsIn` adds 4 listeners per root (sherpa-element.ts:428) and calls
  `getComputedStyle` on every hover (top-layer-tips.ts:82); tip markup repeated
  (button.html:41, 51; quick-filter.html:134; nav-item.html:60; each chart); `sherpa-tooltip`
  used by the toolbar only; button and chip tips `aria-hidden`.
- **Base class:** doors used once or twice: `config` (:365–476, ~70 lines, data-grid only),
  `commands` (dialog, overlay-panel), `aria` (callout, loader), `pageCss` (2);
  `checkValidity`/`reportValidity` on every element (:648–659). THREE small binding
  languages: props `to:` (`#syncProp` :1128), item directives (`#fillItem` :1177),
  `data-swap-on` (swap.ts). 197 style + 18 visibility + 104 behaviour prop declarations do
  no runtime work (:50) yet are all observed (:381): every change runs sync, swaps,
  `onChange`, the restamp check. `rendered` waits on icon loading (:907). `sherpa-badge.ts`
  is 12 lines with a shadow root and 9 shared sheets → a look class.
- **Native:** used — popover, invokers (button.ts:203), `<dialog>`, `:state()` (176),
  form-associated (9), scroll-state, `<details>`, `inert`. Unused — View Transitions (0),
  DSD (0), `hidden=until-found` (collapsed groups, find). `field-sizing` would replace
  prompt-composer.ts:115's auto-grow (my probe: supported in all three).
- **Icons:** 217 per-icon JS modules (884 KB) → pre-cropped SVG + CSS `mask-image` or a
  `<use>` sprite, no JS per icon (Likely).
- **Components no app uses:** `sherpa-chip`, `sherpa-tag`, `sherpa-nav-section`,
  `sherpa-panel`, `sherpa-tabs`, `sherpa-file-upload`, `sherpa-transfer-list`,
  `sherpa-progress-step-tracker`, `sherpa-select-card` (~2,050 lines) — not in Demos nor in
  another component; the Gallery HAS stories for them (checked: `stories/sherpa-chip`,
  `sherpa-tabs`). Library stock, not dead code.
- **Generated:** 68 `.component.json` = 712 KB, 25k lines, repeated in the HTML Public API
  headers and `example.json`; npm ships src + dist + JSON. `src` carries 2,184 TRAP citations.
- **Probe vs agent:** the agent read typed `attr()` and `@function` as Chromium-only; my
  probe in the repo's engines found typed `attr()` and `field-sizing` parse in Firefox 155
  and WebKit 26.6, `@function` in WebKit 26.6 — by `CSS.supports`, so "parses", not
  "measured by effect".

### Realisations about work done this week

- **My own 690/691 settings followed the fan-out pattern** (`data-allow-solo`,
  `data-solo-across`, `data-solo-header`, `<html data-no-action-descriptions>`,
  `<html data-description-tips>`): two of the seven ways. They move with the settings model.
- **687 left two notice vocabularies** (`UpdateNotice`, `FeedNotice`) and a namespace clash:
  `followUpdates` holds `sherpa-feed:updates`, the lock `shareFeed(feed, 'updates')` would
  take. A real bug if an app names a live feed "updates".
- **683's `zonesOf` re-parses `when` by hand** — one condition tree removes it.
