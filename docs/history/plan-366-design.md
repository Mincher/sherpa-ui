# Plan 366 — the QueryContext design

Read-only design, 2026-10-20: three readers, three designs (migration-first,
API-first, risk-first), one synthesis, two checkers. The picture is in
[plan-366-query-context.md](plan-366-query-context.md); the map in
[plan-366-query-context-map.md](plan-366-query-context-map.md).

**Status: NOT ready to build as written.** The checkers found 7 commits that
would break tests or behaviour (§9). A revision folds their fixes in first.
Line numbers are as of 2026-10-20 and drift (345 3.4 moved data-source.ts by
about 30 lines after line 1695).

## 1. Name

QueryContext: one Query per app Context. The order of the risk-first design, with the source as the context's first member

## 2. Why this shape

I scored the three designs on the six asks.

FEWEST MOVING PARTS.
- The API design won the reach. `source.query` IS the context, so the roughly 60 reads of `.query.applied` stay unchanged and no new provider key is needed. One query-change replaces two events that had only 5 listeners. Callers move family by family with no forwards, so there are no aliases and no 470-site move at the end.
- The migration design won the safest first context commit: a member handle that keeps method bodies byte-identical. It also won on events: it reuses quick-filter-change instead of adding four new events, and the panel already sends one field on it.
- The risk design's second control registry (control-binding.ts) is dropped. Draws stay in each source's SourceBinding and read the context.

EVERY STEP SHIPPABLE WITH TESTS GREEN.
- The risk design won, so its order is the spine:
  1. Delete the doors no page uses.
  2. Close 319.
  3. Make hold() and move() recompile, and move the arrangement into the Query, BEFORE the context exists.
  4. Build the context with one member.
  5. Switch the controls to requests.
  6. Add several sources last.
- Most commits come with a test written first that fails today.

THE BENCH MAY ONLY FALL.
- I took the risk design's direct member call made before the event. It makes the order true by construction.
- New in this design: a change that moves only the arrangement compiles nothing. So moving sort into the Query does not raise the sort act.
- The baseline shows that raise's 4 compiles all come from the bar's re-report (source-binding.ts:252). That is why hold() must recompile before the re-report goes.

CLOSES THE TWO-WAY LOOP.
- All three designs do. The risk design's live slice for drawScope is one callback, while the API design's revision check would be needed at every paint site.
- A separate `superseded` record beats the API design's idea of keeping the answer in the scope's own readings. That idea breaks 'one reading per field': setReading clears every scope (query-edits.ts:124-128).

DOM-FREE. All three are. The member handle replaces the migration design's lint-restricted internal import.

MATCHES WILL'S WORDS. One QueryContext per app Context. Sources keep no Query. Controls read their slice and send one-field requests. Will's B doors stay as thin calls.

WHAT I REJECTED.
- The API design's one merged catalogue. 'Everything ticked is no filter' is judged against each store's own values (filter-state.ts:319, 342-347), so field values stay per source and only the Query moves.
- The migration design's permanent delegates, because Will rules out aliases.
- The API design's rename of `scope` to `by`. The rename is not needed: the panel's request carries its Query scope inside `request`.

## 3. The QueryContext

WHERE IT LIVES. A new file, src/core/data/query-context.ts, holds `class QueryContext extends EventTarget`. The folder lint makes it DOM-free the day it lands: eslint.config.js:56-67 bans document, window, storage, requestAnimationFrame and navigator there. It is exported from sherpa-ui/data beside DataSource. No display component imports it (T-the-app-layer-is-opt-in). A control gets its slice drawn through the source it is bound to.

HOW MANY. One per app Context. sherpa-provider.open() makes it with `new QueryContext()` before openSource (sherpa-provider.ts:293) and passes it in: `openSource(def, store, { query })`. A source joins the context it is given. A source given none makes a private one. So these keep working unchanged:
- the 59 test files that call `new DataSource(...)`
- the MCP's run_query (mcp-server/tools/data.js:335)
- the bench (scripts/check-bench.mjs:188)
- Demos' hand-made sources (dashboard.js:56, index.html:520)

HOW CODE REACHES IT. `source.query` IS the context. Today `source.query` returns a copy of {applied, draft} (data-source.ts:296-298). The context has `applied` and `draft` getters, so the roughly 60 reads of `source.query.applied` (tests, the bench, Demos specs) stay unchanged. Every reader of `source.query` reads `.applied`, `.draft` or `{ applied } =`, all of which still work. Page code also gets it as `ContextInit.query` (app-definition.ts:60-77, passed at sherpa-outlet.ts:382). There is no new provider key.

WHAT IT HOLDS. It holds the only copy of each of these:
- The Query, `applied` and `draft` (from data-source.ts:194, 200). The draft IS applied unless a member's store is remote.
- sort, group and a new sortSuspended in the one arranging scope, and search in the View (QUERY-DESIGN.md:52; ScopeQuery at query.ts:64-67).
- The saved-filter library and its labels (data-source.ts:203, 216), and the component defaults (:219).
- The scope registry: labels and arranges (:221, :1040), sets (:1078), offers (:1335), and each part's {field, label, owner bind id}. That last one is the declaration half of #narrowing (:224).
- A new `ScopeQuery.superseded`: a component scope's own answer for each field the View holds over it (decision 2).
- The bind-id counter that `narrows` names. It moves here from source-binding.ts:83, 94, so ids are unique across sources.
- Its members, and a `version` that moves on every change and every declaration.
It holds no rows, no field values, no counts and no pages.

API: READS (Query only).
- `applied` and `draft` return one structuredClone each, as today.
- `reading(scope, field)`, `preset(id)` and `defaultFor(scope)` return the frozen original, never a copy. This is 319 A, now enforced instead of a comment (data-source.ts:746-748).
- Plain reads: `scope(name)`, `scopes`, `holds`, `scopeOf`, `fields`, `canHold`, `scopeFacts`, `scopeLabel`, `arranges`, `sets`, `partFacts`, `pending(field)`, `dirty(scope?)`, `version`, `remote`, `debugState()`.
- `export(): QueryState` is today's SourceState renamed (data-source-types.ts:91-95).

API: REQUESTS. Each is one change.
- `setReading(scope, field, reading | null)`: lands at the field's home. A part scope narrows its owner. A field no scope holds is first held in `scope` when it may be (answerColumn's rule, data-source.ts:2290-2291). Picked keys map to raw values through the members' field facts (T-a-value-can-be-an-object).
- `suspend(scope, field | null, off)`: one chip off or on, with its answer kept. `null` is the scope's Switch.
- `setPreset(scope, id, on)`.
- `reset(scopes, { carry?, organise? })`: Clear all and Reset all. This is the only door that clears what it does not name, and it clears only readings homed in those scopes.
- `take(scope, ids, from?)`, `release(scope, id)`, `hold`, `move`.
- `setSort(scope, field | null, dir?)`, `resumeSort`, `clearSort`, `setGroup(scope, field | null)`, `setSearch(text)`.
- `commit(at?)` and `discard(at?)`, where at is {field}, {scope} or {scope, preset}.
- `setQuery(query, { holds?: 'keep' })`: the one whole write, used for a restore, a View or a saved set. `import(state)`.
- `batch(fn)`: the doors called inside it make one change.
A request that changes nothing is a no-op: no member hears it, no event fires and nothing compiles. Every door deep-copies a reading on the way in and freezes it, with a new ownReading helper. That closes the IN leak at data-source.ts:566 and :1126, where answerOf copies one layer (query.ts:172-176).

API: DECLARATIONS. declarePreset, declareDefault, declarePart, declareScope, declareSets and offer.

API: MEMBERS. Only DataSource calls `join(member)`. It returns a handle with { live(), mintId(), leave() }. `live()` is the live {applied, draft}. It is typed read-only and never cloned, so a load costs no clone (T-the-bench-counts-and-never-times). Only the handle reaches it; there is no exported internal door and no lint exception. In commit 6 the handle is writable, so the source's method bodies stay byte-identical. From commit 8 it is read-only.

HOW A CHANGE GOES OUT. Three steps, in this order:
1. The context edits its Query with query-edits.ts, which already takes the Query first (query-edits.ts:2-4).
2. It calls each member's `heard(change)` directly and synchronously.
3. It dispatches ONE event, `query-change` { fields, scopes }.
The direct call makes two orders true by construction: 'selection after the requery' (data-source.ts:1133) and 'defaults fixed before the first compile' (:628). It also keeps the bench counts. `query-change` replaces the source's scope-change and selection-change (data-source.ts:396-398, 580, 1134, 1225, 1291, 1344, 1385, 1551). Their only listeners are bind-selection.ts:183-184 and provider-page.ts:119-124, 451. It also ends the name clash with the grid's row selection-change (sherpa-data-grid.ts:2027).

WHICH READS ARE THE CONTEXT'S. A read that needs only the Query and the page's declarations belongs to the context. A read that needs a field's type, its values or the rows stays a projection on the source: describe, selection, filterDef, addable, say, whereOf, readingsOf, atDefault, answered, results and groups. An edit that needs field facts asks its members, using the first member that has the field. That covers select's key-to-raw mapping (data-source.ts:1124-1126) and setQuery's `where` to readings and carryOver (:1506-1514). In a context of one, that member is the source, so nothing changes.

## 4. Sources

WHAT A SOURCE KEEPS: data work only.
- store, page and pageSize (data-source.ts:258-259), #viewPages (:171), searchFields (:148).
- Loads: #loadOptions, load and #ask (:1646-1692, :1831-1925); the held set, the cache and the plan (:229-241); reach, failure, recheck and close.
- The walk and #setAside (:1955-2146), and the counts: results, valueResults, present and offered.
- The compiled caches #filter, #viewFilter, #scoped and #only (:206-212, :651). Only #compileNow writes them (:1454-1467). They are recompiled from the context and are never a second truth (T-one-query-one-owner).
- Its whole FieldCatalogue (:214): types, labels, values and row domains. It must stay per source. 'Everything ticked is no filter' and range-or-list are judged against THIS store's values (filter-state.ts:313, 319, 342-347), and fromRows reads its own rows (field-catalogue.ts:169).
- Its whole SourceBinding: the pushes, and the draws of the controls bound through it (source-binding.ts:151-268). The draws read the context. There is no second control registry.
- The projections: describe, selection, filterDef, addable, say, whereOf, readingsOf, atDefault and answered.

WHAT IT DROPS.
- Moved to the context: #applied, #draft, #presets, #presetFacts, #defaults, #scopeLabels, #arranges, #sets, #offers, #binds, and the declaration half of #narrowing. The element map stays in the source, for write's rows:'all' check (:553-562) and #hostOf (:1964).
- Moved into the Query first (commit 5): sort, group, search and sortSuspended from #state (:146). #arrange and #arrangedBy (:1517-1529, :1048) and export's put-back of the arrangement (:304-308) go with them.
- Deleted:
  - #parts with contribute, contributions, contribution and apply (:186, :537-541, :654-662, :677-692)
  - answer, answerScope, answerScopes, answerColumn and answerUnscoped (:698-714, :847-869, :2259-2315)
  - setFilter and setState (:518-525, :409-437), and options.filter, sort and group (data-source-types.ts:174-180)
  - the #viewFilter null sentinel (:210, :418, :523, :1868, :1959, :1988, :2068)
  - WalkFacts.parts and WalkFacts.hand (source-counts.ts:101-104)
- No forwards: each Query door leaves DataSource in the same commit that moves it, and its callers move to `source.query.X` in that commit. There are no aliases.

HOW IT HEARS A CHANGE. heard(change) does three things:
1. It compiles live().applied with this source's facts: one compile per change. When only the arrangement moved, it compiles nothing. A pure arrangementOf(query, facts) in query.ts serves both compile and this case, so a sort act stays at 0 compiles.
2. It runs today's follow-ups in today's order:
   - a reading is drawn to each control over its home (#draw, :1148-1164)
   - bars and the panel are drawn where holds or presets moved
   - superseded and pending are synced
   - components whose `only` moved are pushed (pushTo)
3. It coalesces the load per tick (T-coalesce-microtask-not-debounce).
#walkKey (:1955-1961) adds the context's version, because today a declaration moves only #age (:595, :723, :1053). hold() and move() now recompile (commit 4).

COMPILING ONLY WHAT IT SERVES. This is the last code commit. CompileFacts (query.ts:89-104) is filled like this:
- field: its own catalogue
- preset and fixed: the context
- drop: its own #setAside (:2105), so T-a-ruled-out-value-is-greyed holds per source
- components: the union of every member's bound scopes. Without this, a scope bound on source A counts as a page scope on B and trickles down to it (query.ts:262; T-only-the-view-trickles-down).
Two facts are new:
- mine(scope): true for the View, for a page scope, and for a component scope that a control bound through THIS source answers.
- has(field): true for its catalogue's declared fields, store.domains (store.ts:237) and store.time. A source that declares no fields has every field, which is today's rule.
scopeClauses, presetClauses and planWalk (query.ts:153-163, 212-233; source-counts.ts:120-208) skip a scope that is not mine and a reading on a field the source lacks. Today eq, in and between on a missing field match NOTHING (store.ts:384-423), so the dashboard's 'Critical only' View (severity) would draw 'Customers 0'. A skip is listed in debugState().skipped. It is never sent through report(): it is expected, and the bench fails an act on any report (check-bench.mjs:308). The arrangement comes from the first arranging scope that is mine, so two grids on two sources never trip two-arranging-scopes (query.ts:269-279). In a context of one, mine and has are always true, and the compile is byte-identical.

REMOTE DRAFT AND APPLY. The context holds both copies. `remote` is true when any member's store is remote (decision 1).
- Every source compiles `applied`. A draft edit loads nothing. It only moves pending and dirty, which the binding writes as data-pending and data-dirty (bind-source.ts:90-93).
- A local-only context keeps one object, as today (data-source.ts:200).
- Apply is per act. A chip's or a heading's Apply commits only its own field, a saved-filter toggle commits that preset, and the Switch commits its scope. Today a bar's or a heading's Apply commits everything (:2277, :2294), including the panel's waiting edits.
- A part that narrows one component still applies at once, remote too (:576).
- The arrangement is written into both copies, so it never waits for Apply, as today.

WALK AND COUNTS. Each source walks its own rows over the scopes that are mine. It draws counts, present values and offered values only to the controls bound through it (:2112-2142). Rows stay shared per store through StoreCache and are never filters (store-cache.ts:1-5). debugState() keeps its keys: the source merges the context's keys (query, draft, dirty, presets, scopes, offers) into its own, so the 17 Demos reads of debugState() stay green.

## 5. Controls

THE RULE. A bound control (data-locked, bind-source.ts:71) PAINTS what it is drawn and keeps no answer of its own. It sends ONE request per reader act. Two things break any loop:
1. A paint never goes through a public door, so a draw can never turn into a request.
2. The context drops a request whose answer is the same.
So an echo dies in one round.

ONE EVENT, NO NEW NAMES. The bar and the panel already share quick-filter-change, and the panel's already means 'one field changed' (sherpa-filter-panel.ts:1716-1730). Both now send { scope: 'bar' | 'panel', request, values, active? }.
- `request` is a QueryRequest, a DOM-free type in query.ts. It is one of {field, reading}, {field, suspended}, {preset, on}, {suspended} or {reset: {carry, organise}}, or a list of them, which counts as one change. The panel's request names its Query scope.
- `values` stays for the View chip (persist-view.ts:427, sherpa-outlet.ts:331) and for hosts.
- The bar's whole answer (readings, presets, holds) leaves the event. Hosts read it back from the getters.
- steer() (bind-source.ts:205-231) routes `request` to the context's door. It takes the scope from the request or from the bind.
- STEERING_EVENTS (bind-source.ts:152-173) does not change.

TOOLBAR, bound.
Reads:
- drawScope(desc, live): the binding passes `() => source.describe(scope)`, and the bar paints live() after its settle and its two frames (toolbar.ts:1365-1366). A reader's change made during that wait is already in the slice. So #edits, #editedAt and #edited go (:1113-1121, :477, :1327-1328, :1374, :1380, :1385, :1896).
- drawReading paints privately: #drawChip stops calling setChipReading (:603-627 → :476-486).
- A per-chip 'last painted' record skips a paint of the same answer and leaves an open committing menu's draft alone, as the grid's #drawn does (sherpa-data-grid.ts:576, 683-693).
- Every filter chip is locked, not only persistent ones (:742-748). On or off comes only from the paint: answered and not suspended. The bar stops writing data-current itself (:1902-1906, :1918, :254). A locked chip's click carries its OLD state (sherpa-quick-filter.ts:613-614), so the bar sends !chip.current.
Sends:
- menu commit, in the capture swap (:1879-1910): {field, reading}
- condition (:849, :857) and date pick (:248-255): {field, reading}. #conditionFrame stays.
- chip body (:1016): {field, suspended} or {preset, on}
- one-value Add rows (:1643, :1677): a list of requests
- Switch (:1020-1024): {suspended}
- Clear all (:1720-1742): {reset}
- add and remove (:1518, :1542): filter-add {ids} and filter-remove {id}, routed to take and release as the panel's are (bind-source.ts:237-251). They carry no `holds`, and no whole emit follows them (:1520, :1546).
- drawScope's resume and handover (:1386-1391): one {suspended: false}

PANEL.
- It sends {scope, field, reading} per field, as now.
- A saved filter sends {scope, preset, on}, in place of the 'presets' pseudo-field (:681-689).
- Reset all sends ONE {scopes, reset: {organise}} (:1783-1793).
- drawReading paints privately and stops calling setFieldReading (:432-434).

GRID HEADING.
- column-filter-change stays (Will's B, because it names one field).
- When locked, #onColumnFilterCommit (:825-880) writes neither #columnFilters nor #drawn before it reports. drawReading fills them.
- drawReading also paints privately. Today it calls the public clearColumnFilter (:1041).
- steer turns the event into setReading(bindScope, field, reading), holding the field first if no scope holds it, then commit({field}).

LEGEND.
- It already sends one field: bindSelection writes its part with `only` (bind-selection.ts:157) and draws through the silent `picked` setter (sherpa-provider.ts:845; sherpa-chart-legend.ts:178).
- It moves onto the context's doors and listens for query-change.
- Its own #off flip (:347-357) stays: one field, one chart.

SORT, GROUP, PAGE, APPLY AND DISCARD, RAISE AND LOWER: these already send one value. A locked chip writes no data-current or direction (quick-filter.ts:481, 513); writeView draws them.

GUARDS THAT GO.
- Toolbar: #edits, #editedAt and #edited; #pendingAnswers and #keepAnswer for a bound bar (:871-908, :1203); the resume, handover and panel-mode re-emits (:1386-1391, :1093-1099).
- Panel: #said (:152, :420, :1012, :1721-1725), and #early for a bound panel (:733, :389-390).
- Source: answerScopes' 'bars last' order (data-source.ts:865-867); Bound.answered and Bound.saved (source-binding.ts:54-57); supersede's report() (:252); #lower's overwrite (data-source.ts:918-926).
- Provider: #quietly and #unquietSoon (provider-page.ts:485-497, 526-532), and the raw host quick-filter-change listener (:453).

GUARDS THAT STAY. They are not loop guards.
- #conditionFrame and the panel's #reportSoon, because a composed row fills async (T-a-rebuilt-row-reads-empty-for-a-tick).
- The grid's #drawn.
- The menu's own #early, #heldValues and #heldRows (sherpa-menu.ts:254-270).
- drawScope's settle and its two frames. They now cost only latency, and TODO 302 removes each one with its own proof.
- #held, for an unbound bar.

DOORS THAT STAY (Will's B, docs/TODO.md:1585). When locked, each door sends the one request the reader's act would send:
- setChipReading sends {field, reading}.
- setChipValues(id, picks) sends {field, reading: {picked}}, and [] clears. The View chip is the exception: it stays a silent DOM write.
- `values =` (toolbar.ts:394-430; sherpa-app-header.ts:127-130) sends a list: each named chip's picks, and {suspended} for each unnamed chip that is on. Its picks survive, as today.
- `filtersSuspended =` sends {suspended}.
- setColumnFilter, clearColumnFilter and suspendColumnFilter (grid.ts:941-953, :1070, :1101) send column-filter-change.
- setFieldReading (panel.ts:380) sends {scope, field, reading}.
report() on a bound bar sends {values} with no request. It still carries the View pick, so the outlet's navigation (sherpa-outlet.ts:434-435) and the 12 Demos specs that call setChip…() then report() keep working. When unlocked, every door stays a silent DOM write, as today. The read-backs stay: readings, values, presets, heldFields, superseded, columnClause and columnReading. They read what was painted, which is the Query. persist-view.ts:459's whole-map `bar.values = {...}` becomes setChipValues(VIEW_CHIP, [id]).

## 6. Persistence

Everything goes through the context. Storage stays in core/browser and ProviderPage, behind the provider, because the data layer touches no storage (eslint.config.js:56-67).

SESSION.
- The key is the same: `/filters/<definition.id>` (sherpa-provider.ts:315). The value is the same: `{ view, query: query.applied }` (provider-page.ts:432, 450).
- The Query now carries sort, group, search and superseded answers, so a reader's sort survives a reload. Today it does not: the kept Query has no sort, and the keeper never hears a sort (:451-453).
- Old kept sessions still restore, because the new keys are optional.
- The keeper listens to the context's query-change and writes once a frame. requestAnimationFrame is allowed in the app layer.
- #writing stays only as a SYNCHRONOUS flag around the provider's own setQuery call. The provider's own change is heard inside that call, and no bar reports late any more, so the two-frame tail goes (:485-497, :526-532).
- T-a-view-keeps-a-draft keeps all four of its orderings: a pick flushes first; the draft is read inside the pick; Reset, Save and Delete clear it; only the reader's changes write it. applyFilters and dismissFilters are not muted today, so they still write the draft.

VIEWS.
- onViewPicked (persist-view.ts:420-490) calls `targets.source.query.setQuery(draft ?? view.query, { holds: 'keep' })` and keeps its `applied` guard (T-a-persistent-chip-reports-on-every-change).
- With `keep`, a View that names no sort keeps the reader's sort, as #arrange does today. A component scope's own answer for a field the new View holds is kept as superseded.
- viewQueryOf (:554-563) reads `source.query.export()` and `source.whereOf`. Nothing is put back, because the arrangement is already in its scope.
- saveViewAs keeps its files and keys.
- Which View is on screen stays with the View chip and ProviderPage (#view, provider-page.ts:529-535). Moving it into the context is a later TODO.

DRAFTS PER VIEW. The keys and the signature are the same (view-drafts.ts:41-75). #keepDraft writes viewQueryOf(source) (provider-page.ts:480).

SAVED FILTER SETS.
- The storage is the same (saved-filters.ts:100-117).
- filtersOf (saved-filters.ts:73-80) also drops sortSuspended and superseded.
- mergeSet (query-edits.ts:300-308) keeps the arrangement of any scope it replaces.
- Dismiss puts `before` back with the arrangement now on screen, so it still never moves the sort.

RESET. `initial` is query.applied when the page opens (sherpa-provider.ts:304), and it now carries the page's arrangement. So Reset to default also resets the sort. T-reset-to-default-is-the-views-own already counts 'the rows arranged' as something to reset.

URL. Unchanged. The router owns context, view and settings. The Query is not in the URL.

EXPORT AND IMPORT.
- query.export() and query.import() use QueryState { v: 1, query, presets }, which is today's SourceState renamed (data-source-types.ts:91-95).
- ProviderState (sherpa-provider.ts:68-72, 642-665) becomes { v: 2, view?, query: QueryState }. Nothing per source was ever in it except the Query.
- A v1 import is reported as unknown-state (D4: no shims).
- Import stays exact: it declares the presets, then calls setQuery with no keep (T-a-page-goes-out-as-json).

PERSISTVIEW. It keeps element state only, such as the grid's selection. Its `source` option, and the save and restore of the compiled filter, go (persist-view.ts:77-85, 154, 202-209; T-one-query-one-owner). Demos records.js:78-80 drops `source` in the same change. The stale `{ filter: false }` text in T-a-reload-replays-the-readers-answers is fixed.

MCP.
- run_query (mcp-server/tools/data.js:335-347) builds a source with a private context. It applies the plain `where` with source.query.setQuery({ v: 1, scopes: { view: { where } } }).
- Its compiled `filter` input and the setFilter line it prints (:444-445) go (T-one-way-to-write-a-condition).
- sherpa://data-rules (DATA-SOURCE-RULES.md:358-368) teaches the context and stops teaching contribute and setFilter.
- QueryContext is exported from sherpa-ui/data and is JSON in and JSON out, so a tool or a server can hold one later. TODO 170 waits, and this does not block it.

## 7. Commits

### 1. data(366): the doors no page uses go: named parts and the unscoped bar

Delete:
- #parts, contribute, contributions, contribution and apply (data-source.ts:186, 537-541, 654-662, 677-692). apply has no caller in src (only a comment at toolbar.ts:1161), and answer() inlines its loop.
- answerUnscoped, with Bound.answered and Bound.saved (data-source.ts:2301-2315; source-binding.ts:54-57).
- WalkFacts.parts (source-counts.ts:101-102), and #parts in #compileNow, #walkKey and debugState (:1456-1458, :1958, :1414).
Also:
- steer's unscoped-bar branch (bind-source.ts:228-229) reports `bar-without-scope`.
- bindSelection with no `only` reports and binds nothing. Selector loses `contribute` (bind-selection.ts:28-41, 136, 158, 193).
- DATA-SOURCE-RULES stops teaching contribute.
No sibling uses any of these. Every Demos and Starter bar has a data-scope (Demos index.html:61, templates/records.html:99).

**Proof:** - Port the 7 test files that call `.contribute(` to write() or declarePart, or delete the tests with the path.
- type-check, lint, npm test in 3 engines plus test:node; Demos npm test after a build, never during a full run.
- check:bench IDENTICAL: the bench page has no parts.
- check:traps (retire T-contribute-beats-last-writer and T-parts-order-must-be-stable), check:map, check:size (falls).

### 2. data(366): the hand-set filter and setState go

Delete:
- setFilter (data-source.ts:518-525) and the whole of setState (:409-437). setSort, setGroup, setSearch, setPage and setPageSize already cover the rest of setState.
- DataSourceOptions.filter, sort and group (data-source-types.ts:174-180). One test uses sort (reforged-data-source.spec.ts:284).
- The #viewFilter null sentinel (:210, 418, 523, 1868, 1959, 1988, 2068) and WalkFacts.hand (source-counts.ts:103-104, 132).
- persistView's `source` option and its keeper (persist-view.ts:77-85, 154, 202-209). Demos records.js:78-80 drops it in a twin change.
`state` stays as a read-only OUTPUT, because records.js:343 reads state.filter.
MCP run_query takes the plain `where` and calls setQuery. The code it prints changes to match (data.js:335-347, 444-445). DATA-SOURCE-RULES :358-368 changes too.

**Proof:** - Delete reforged-data-source.spec.ts:700-760, which pins the path that goes.
- Port the 8 setFilter test files and the 5 setState test files to setQuery with `where`.
- check:mcp-pack.
- npm test in 3 engines; Demos green.
- check:bench IDENTICAL: the bench never calls these doors.
- check:traps, check:map, check:size (falls).

### 3. data(366): a reading is copied in and frozen out (finish 319)

Add ownReading(r): a deep copy of the answer keys (picked, conditions and their rows, kept, range, present), deep-frozen. It does not use structuredClone, so the clone count stays flat.
Use it at every door that keeps a reading: select (:1126), write (:566), declarePreset (:724) and declareDefault.
The library's readings, supersedeColumns, #draw and selection() now hand out frozen objects instead of the live ones (map §4).
First sweep every caller that edits what it reads: grid.ts:835, 877, 995, 1047; toolbar.ts:1506; panel.ts:599; saved-filter-menu.ts:144-149.
No edit in src/core/data changes a reading in place. keepOff, suspendScope and setReading replace readings, and query-edits.ts:273 deletes a key on a copy.

**Proof:** New test/unit/a-reading-is-copied-in-and-frozen-out.test.mjs:
- select with condition rows, then change the caller's rows: query.applied must not change. This FAILS today (answerOf copies one layer, query.ts:172-176).
- A write to an object that supersedeColumns handed out throws.
Also:
- npm test in 3 engines and Demos. Any missed write fails loudly.
- check:bench: loads and compiles identical. Record clones only if they FALL, where a read no longer needs to clone.

### 4. data(366): a hold or a move recompiles, and a raise re-reads the unpaged rows

- hold() and move() call #recompose when a home moved (:1273-1298, 1372-1387). Today they do not. The bar's re-report hides this (supersede(…, true), source-binding.ts:252 → answerScope). Evidence: records/raise costs 4 compiles today, and all four come from that re-report.
- declareField, declareValues and declareFromRows recompose when the Query answers that field (:954-993).
- When an unpaged or `into` bind exists, the load key also carries the view filter and the scoped filters. Then a raise that leaves the shared filter's JSON unchanged still re-reads the unpaged set. Today the no-op guard can skip it (:1676).
This must land before supersede's report goes (commit 11).

**Proof:** Write these tests first and see them fail:
- New test/unit/a-raise-narrows-at-once.test.mjs: records.page.json with only a panel ([view, data]) and an unscoped rows:'all' chart. Raise status from data with no bar bound. Every row the chart is given must carry the picked status. PLAUSIBLE that it fails today.
- A Query restored before declareFromRows compiles with the type read from the rows.
Also:
- send-down and up-is-open-down-is-closed green; Demos send-to-view-filters and chart-scope green.
- check:bench: record records/raise and remote/raise gaining one compile, on purpose, with the reason. They fall at commit 11.

### 5. data(366): sort, group and search are in the Query (QUERY-DESIGN rule 1)

- ScopeQuery gains sortSuspended (query.ts:64-67).
- definitionOf stops stripping the arrangement (query-edits.ts:249-257). With `keep`, a View that names no sort keeps the reader's sort.
- setSort, setGroup, resumeSort, clearSort and setSearch (:480-516, 1582-1585) write the arranging scope (search: the View). They write both copies, so the arrangement never waits for Apply, as today. Writing it in one scope clears it in the others, as #arrangedBy does today. They fire scope-change, so the keeper hears a sort.
- A pure arrangementOf(query, facts) in query.ts serves compile, and serves the source alone when only the arrangement moved. So a sort compiles nothing.
- search no longer counts as arranging (query.ts:269).
- #state keeps only page and pageSize. #arrange, #arrangedBy and export's put-back go (:146, 304-308, 1048, 1517-1529).
- mergeSet keeps the arrangement of any scope it replaces, and Dismiss keeps the arrangement on screen ('never the sort').
- Reset to default now also resets the sort.

**Proof:** - New unit test the-arrangement-is-in-the-query: setSort('customer', 'asc', 'data') lands in query.applied.scopes.data.sort. It FAILS today.
- New Demos e2e reforged-a-reload-keeps-the-sort: sort Records, reload, and the sort is still there. PLAUSIBLE that it fails today (provider-page.ts:432, 451-453).
- Green: suspended-sort, a-scope-arranges-its-own-rows, groups-are-a-data-concept, reforged-provider-saves-filters; Demos reset-to-default, reset-at-default, records-persist and save-view. Update their JSON where they compare query.applied.
- check:bench: sort and search stay at 0 compiles. Record only if something moved, with the reason.
- check:traps: update T-group-and-sort-are-component-scope, T-a-suspended-sort-is-one-owners-job and T-a-reload-replays-the-readers-answers.

### 6. data(366): QueryContext: the Query and its declarations leave the source (a context of one)

- New src/core/data/query-context.ts, exported from src/data.ts. It holds applied and draft, the library and its labels, the defaults, the scope registry, the part declarations, the bind-id counter and the members.
- `new DataSource({ store, query? })`. With no `query`, the source makes a private context.
- `source.query` IS the context. Its `applied` and `draft` getters return one copy each.
- query.join(member) returns a writable handle. DataSource's private fields become accessors over it, and every method body stays byte-identical, as `get #remote()` already is at :1501.
- SourceBinding mints ids through the handle.
Land this only after the 345 phase 3 edits in data-source.ts are committed.

**Proof:** NO behaviour change:
- Every sherpa-ui test passes UNEDITED: every reader of source.query reads .applied, .draft or `{ applied } =`. Demos passes unedited too.
- check:bench IDENTICAL on every act, clones included. One clone per `query.applied` read, as before.
- lint (the DOM-free folder rule), type-check, check:map.
- the-package-surface lists QueryContext.
- check:weight and check:size growth recorded on purpose.

### 7. data(366): the Query's reads and declarations are the context's (callers move, no forwards)

Move these onto QueryContext: reading, scope, scopes, holds, scopeOf, fields, canHold, preset, defaultFor, partFacts, scopeFacts, scopeLabel, arranges, sets, pending, dirty, export and import, plus declarePreset, declareDefault, declarePart, declareScope, declareSets and offer.
Their callers move from `source.X` to `source.query.X` in this commit, and DataSource loses each name. Callers:
- page-definition.ts:78-108
- sherpa-provider.ts:642-665, 757-774, 828-868
- provider-page.ts
- bind-selection
- check-bench.mjs
- the tests
- about 50 Demos sites, as window.sherpa.source.query.X
SourceState is renamed QueryState. debugState merges the context's keys.

**Proof:** - check:bench IDENTICAL on every act.
- Every test edit is a call-site rename only, made by one reviewed script; .mjs misses fail at run time.
- npm test in 3 engines, Demos npm test, check:mcp-pack, check:map.
- parity-sweep KNOWN map updated.
- New test/unit/query-context.test.mjs drives each read and declaration with no source (the rule at query-edits.ts:2-4).

### 8. data(366): the Query's edits are the context's; members hear each change directly

Move select, write, hold, move, take/request, release, suspendScope, suspendSelection, setSort, setGroup, setSearch, commit, discard and setQuery onto the context, with their callers and no forwards. If the diff is big, land it as three commits by family.
Each edit:
1. edits the Query
2. calls each member's heard(change) synchronously
3. returns
The source's heard() runs today's follow-ups in today's order. Field facts (byKey, readingsOf, carriesOver) come from the members. The handle narrows to a read-only live().

**Proof:** - check:bench IDENTICAL: same loads, compiles and clones on every act.
- npm test in 3 engines, Demos, check:mcp-pack, check:map.
- New test: an edit made on the context directly recompiles, reloads and redraws its source.

### 9. data(366): one event, query-change, from the context

- The source stops firing scope-change and selection-change. The context fires one `query-change { fields, scopes }` after every member has heard the change.
- The listeners move: bind-selection.ts:183-184 and provider-page.ts:119-124, 451.
- #walkKey adds query.version (:1955-1961).

**Proof:** - check:bench IDENTICAL.
- a-count-runs-again-only-when-something-moved gains a case: a declarePreset on the context moves the walk.
- npm test, Demos.

### 10. data(366): one-field doors, and steer routes a request

- The context gains setReading (with answerColumn's hold-if-unheld, :2290-2291), suspend, setPreset, reset, batch, and commit({field}|{scope}|{scope, preset}).
- A request with the same answer is a no-op: no change, no event, no compile.
- The QueryRequest type goes in query.ts.
- steer() routes `detail.request` from a bar or the panel to these doors. It routes a bar's filter-add {ids} and filter-remove {id} to take and release, as it does the panel's. A detail with no `request` keeps today's whole-answer path.
- No control emits `request` yet.

**Proof:** New unit tests:
- one-field-requests: each door. A no-op makes no compile and no event. Off then on gives the same reading back. reset leaves other scopes alone.
- an-echo-is-a-no-op: a fake control re-sends every draw as a request, and the context settles in one round.
- a-bar-apply-commits-its-own-field: on a remote store, the panel's pending `plan` stays pending after a bar request for `status` is applied. The same story FAILS on today's whole-answer path (data-source.ts:2277).
Also: check:bench unchanged (no fake sends `request`), npm test, Demos.

### 11. data(366): a superseded chip's own answer is in the Query

Decision 2 A. Add ScopeQuery.superseded: { [field]: the component scope's own answer, or {} for none }.
- When the View takes a field a component scope holds (hold, move, or a View pick with keep), that scope's answer is kept there. A raise still CARRIES the answer up.
- When the View lets go, the scope's own answer comes back, or the field clears for {}.
- A send-down writes the View's answer and drops the kept one.
- compile never reads it. describe lists it with appliedAt.
Delete supersede's report() (source-binding.ts:252) and #lower's overwrite (data-source.ts:918-926).

**Proof:** - send-down, up-is-open-down-is-closed, chart-scope.
- Demos raising-a-filter-carries-its-value, send-to-view-filters, the-view-limits-a-component-scope, reset-to-default (update its JSON).
- New unit test: release gives back the kept answer with no bar bound.
- check:bench: raise compiles fall (the re-report is gone). Record on purpose.
- Rewrite T-a-superseded-chip-suspends-it-is-never-removed and T-send-to-view-filters.

### 12. panel(366): one request per act

- #report sends {scope:'panel', request:{scope, field, reading}}.
- The 'presets' pseudo-field becomes {scope, preset, on} (panel.ts:681-689).
- Reset all sends one {scopes, reset:{organise:true}} (:1783-1793).
- drawReading paints privately (:432-434). setFieldReading, when locked, sends a request.
- Delete answerScopes with its 'bars last' order (data-source.ts:847-869), #said, and #early for a bound panel.
- Keep #reportSoon.

**Proof:** - spec:check, manifest, reference.
- reforged-filter-panel-component, panel-keeps-both-answers, panel-filters-button, panel-long-list.
- headless-data-layer:987 rewritten to the request.
- Demos panel-apply, panel-keeps-both-answers, reset-at-default, send-to-view-filters, view-drafts.
- check:bench: record the panel acts if they move.

### 13. toolbar(366): a bound bar paints from its live slice, and every chip is locked

- Lock every filter chip in a bound bar (toolbar.ts:742-748). The bar stops writing data-current itself (:1902-1906, :1918, :254).
- #drawChip paints privately (:603-627).
- drawScope(desc, live) paints live() after its waits. drawBars and drawEveryBar pass it (source-binding.ts:201-212).
- A per-chip 'last painted' record works as the grid's #drawn does.
- Delete #edits, #editedAt and #edited.
- The whole answer still goes out in this commit.

**Proof:** - Demos reforged-a-stale-draw-keeps-the-bars-own-change re-expressed to the live reader: the same race, green without #editedAt.
- Demos panel-apply:100 passes 10 times in 10 per engine (354's proof).
- New e2e reforged-an-open-menu-keeps-its-draft: a remote bar with a menu open; the panel changes another field; the draft stays. PLAUSIBLE that it fails today.
- check:ownership, the toolbar specs, a-rebuild-keeps-every-answer.
- check:bench unchanged.

### 14. toolbar(366): a bound bar sends one request per act; the whole answer goes

- #emitChange becomes { scope:'bar', request, values, active }, one per act (see controls).
- When locked, the doors send requests. report() sends no request. setChipValues(VIEW_CHIP) stays silent.
- Delete steer's whole-answer path, answer() and answerScope() (data-source.ts:698-714, 2259-2285), and the bound #pendingAnswers and #keepAnswer.
- persist-view.ts:459 uses setChipValues.
- The bench fakes send requests (check-bench.mjs:146-189, 211-238).

**Proof:** - New unit test a-rebuilt-bar-cannot-clear-a-field: a bound bar event with no request changes nothing. It FAILS today, because answer() clears what is not named (:703-704).
- Every toolbar spec and parity-sweep.
- Demos chip-results, view-chips, limit-options, serial-account-set, filter-coordination, nav-view-hierarchy, view-link, records-persist.
- check:bench re-recorded on purpose. Compiles fall (readers' estimate: pick 4→1, repick 4→0, clear 5→1). Clones must not rise.
- Retire T-a-filter-report-is-the-whole-answer and T-a-rebuilt-bar-reads-empty-until-its-menus-stamp.

### 15. grid(366): a bound heading asks, then is drawn

- When locked, #onColumnFilterCommit (grid.ts:825-880) writes neither #columnFilters nor #drawn before it emits. drawReading fills them, and paints privately (it calls clearColumnFilter today, :1041).
- When locked, setColumnFilter, clearColumnFilter and suspendColumnFilter emit column-filter-change.
- steer turns it into setReading plus commit({field}).
- Delete answerColumn (data-source.ts:2289-2296).
- bindSelection's Selector reads the context.

**Proof:** - reforged-data-grid, grid-keeps-both-answers, bind-selection.test, chart-scope.test.
- Demos view-chips (setColumnFilter, columnClause), filter-coordination, chart-scope.
- check:bench: the heading act is equal or lower.

### 16. provider(366): the provider holds the Context's QueryContext; the keeper hears it

- open() makes `new QueryContext()` and calls openSource(def, store, { query }) (sherpa-provider.ts:293).
- OpenedPage gains `query`, and `initial` = query.applied (:304).
- ProviderPage's Query calls read it (provider-page.ts:157-171, 203, 219-235, 274, 314-315, 420-450, 480).
- The keeper hears query-change once a frame. #writing becomes a synchronous flag. #quietly, #unquietSoon and the host listener go.
- ContextInit.query is added (app-definition.ts:60-77); the outlet passes it.
- ProviderState becomes v2 { v:2, view?, query }, and a v1 import is reported (D4).

**Proof:** - Demos view-drafts (the four orderings of T-a-view-keeps-a-draft), records-persist, saved-filter, reset-*, a-reload-shows-the-kept-rows.
- New Demos e2e a-change-right-after-a-pick-is-kept. PLAUSIBLE that it fails today: keep() ignores changes while #writing is set (:439).
- reforged-provider export and import (:292-337) rewritten to v2.
- check:map; the-package-surface.

### 17. data(366): several sources share one QueryContext

Decisions 1 and 3.
- CompileFacts gains mine and has, and `components` comes from every member.
- scopeClauses, presetClauses and planWalk skip a scope that is not mine and a reading on a field the source does not have. Each skip is listed in debugState().skipped.
- The arrangement comes from the source's own arranging scope.
- `remote` follows decision 1.
- The provider's 'Views over ONE source' gate (sherpa-provider.ts:265-267) checks instead that every source shares one QueryContext.
- No Demos page joins a second source in this commit.

**Proof:** New test/unit/two-sources-one-query.test.mjs:
- A's component scope never narrows B.
- A View `severity` reading leaves a customers source whole.
- `region` narrows both.
- Each source sorts its own rows without two-arranging-scopes.
- Bind ids are unique.
- The remote rule holds.
Also: reforged-provider's two-source case (:159-211), and check:bench IDENTICAL on single-source pages.

### 18. docs(366): one Query per app Context

- QUERY-DESIGN rule 1 (:52) becomes 'one Query per app Context'. page stays per source. §8 (:284-310) states the request protocol.
- Update PROVIDER-DESIGN §3-4, PAGE-DEFINITION, DATA-SOURCE-RULES and APP-GUIDE.
- New TRAPs: T-a-context-holds-the-only-query, T-a-control-sends-one-request, T-a-source-compiles-only-what-it-has.
- Rewrite T-a-provider-keeps-the-views and T-a-page-goes-out-as-json.
- TODO 366 marked ✅, with its row kept.
Each earlier commit already updated the TRAPs it touched and ran map:write last.

**Proof:** check:traps, check:map, check:docs, spec:check, manifest, reference.

## 8. Risks

- A PEER'S WORK IS UNCOMMITTED. 345 phase 3 edits in data-source.ts are in the working tree now: #onStoreChange, #walkKey and #walkAge (git diff). They are on the lines that commits 4 and 6-9 rewrite. Every line cited here is at HEAD. Start commit 4 only after that work lands. Check ListAgents first, never stash, and stage only when `git diff --cached` is empty.
- ORDER. Members hear each change by a direct, synchronous call made before the event. A microtask anywhere breaks two orders: 'selection after the requery' (data-source.ts:1133) and 'defaults fixed before the first compile' (:628). It also moves the bench counts.
- THE MISSING RECOMPILE IN hold() AND move() was read from the code. The bench supports it: records/raise costs 4 compiles, and the data bar's re-report pays for all of them, while hold() compiles none. Commit 4 must land before commit 11 removes that re-report, or View summaries go stale after a raise. The part where the unpaged rows are re-read is PLAUSIBLE, so its test is written first.
- FROZEN READINGS (commit 3) throw a TypeError on any write in a strict module. That is loud, but it could reach a reader on a path no test covers. Sweep the callers first: grid.ts:835, 877, 995, 1047; toolbar.ts:1506; panel.ts:599; saved-filter-menu.ts:144-149.
- SUPERSEDED IN THE QUERY (commit 11) is the most intricate rule, with four parts:
- a raise carries the answer up AND keeps the old one
- a let-go gives the old one back
- a send-down drops it
- a View pick keeps it
It also changes the Query JSON, so specs that compare query.applied (Demos reset-to-default:89, :125) must be updated to the same story, not deleted.
- THE ARRANGEMENT IN THE QUERY changes what a reader sees: a reload keeps the sort, and Reset to default resets it. Every whole write that is built from a filter-only Query must carry the arrangement on screen: mergeSet, Dismiss and a View keep. If one misses it, the sort flips.
- BENCH RECORDS, each made on purpose with its reason:
- commit 4: raise gains one compile, which falls again at commit 11
- commit 3: clones may fall
- commit 12: the panel acts
- commit 14: compiles fall
Commits 6-9 and 17 must be IDENTICAL. If a count moves there, it is a bug in the re-plumb: find it, do not record it.
- A BOUND BAR'S FIRST PAINT. With private paints, a draw that arrives before the chips stamp must not be lost. drawReading's settle path (toolbar.ts:611-614) stays, and a bound bar builds from its live slice.
- DOORS THAT SEND WHEN LOCKED reverse T-a-silent-write-still-needs-a-way-to-report for bound controls. A host that listens to its own bar now hears its own write; the loop ends at the no-op. No app code writes a bar door except the View chip, which stays silent.
- THE CONDITION RE-READ. A request read in the same tick that a composed row fills can still drop that one field for a frame, which costs two loads (T-a-rebuilt-row-reads-empty-for-a-tick). The harm is narrowed from wiping the whole scope to one field. #conditionFrame stays.
- LIMITS WITH SEVERAL SOURCES:
- A View bar's counts come only from the source it is bound through.
- A View's `where` is read with the field types of the first member that has the field.
- The keys `picks:<el.id||field>` and `own:<id>` (sherpa-provider.ts:840, 757-774) are unique only within one source.
- PUBLIC API BREAKS WITH NO SHIM (D4): setFilter, setState, contribute, apply, the answer* doors, options.filter/sort/group, persistView's `source`, ProviderState v1, run_query's `filter`, the bar event's readings, presets and holds, and the SourceState name. Each commit moves its callers, the MCP's teaching text and DATA-SOURCE-RULES in the same change.
- TEST CHURN. About 390 calls of the form source.<Query door> in sherpa-ui and about 50 in Demos move in commits 7-8. Each commit moves only its own family. Demos reads sherpa-ui's dist, so build after each commit, never during a full run.
- TWO PATHS IN EACH FILTER CONTROL. Bound, it paints and sends requests. Unbound, it keeps its own answer and its doors stay silent. The parity sweep and the toolbar specs must cover both, or the unbound path rots.
- DEMOS' DASHBOARD keeps its customer source private in this work. Joining it is one line (dashboard.js:56: `query: ctx.query`), and it is Will's to ask for. It would let the EMEA View narrow the customer summary, and 'Critical only' would skip it.

## 8b. Decisions for Will

**Will, 2026-10-20: D1 A, D2 A, D3 A.**

- 1. Remote and local sources in one Context. No page mixes them today. A: the Context keeps a draft when ANY of its sources is remote, and every source reads the applied Query, so there is one Apply for the whole Context. B: each source reads the copy its own store calls for. A local source filters at once while a remote one waits for Apply, so the panel says 'pending' for a field the local chart already shows. My pick: A. It is one rule a reader can see, and it is what happens today in a Context with one source.
- 2. Where a superseded chip's own answer lives, when the View takes a field from a bar. A: in the Query, as ScopeQuery.superseded. The bar keeps nothing, the bar's re-report and #lower's overwrite go, and the answer survives a reload and a View pick. B: in the bar, as now. The bar keeps that one answer and sends it back as one request when the View lets go, and it is lost on a reload. My pick: A. It is the last answer a control holds of its own, and your ruling says controls keep none.
- 3. A saved filter that names a field a source does not have. This only happens when a Context has two sources. Your diagram already says a source ignores a reading on a field it lacks. A: skip the WHOLE saved filter on that source, so it never applies half its meaning. B: skip only the missing field and apply the rest. My pick: A.

## 9. The checkers

### Refute

**Unsafe as written:**

- Commit 1 (the doors no page uses go). At least 8 tests that are not listed break. The unscoped-bar path that answerUnscoped serves is used by reforged-saved-filter.spec.ts, a-saved-filter-is-its-readings.test.mjs, reforged-number-advanced.spec.ts:90, reforged-number-filter-reports.spec.ts:183 and reforged-data-source.spec.ts:175. Object.keys(d.parts) at reforged-filter-scope.spec.ts:296 throws, and query.test.mjs:234 and reforged-filter-scope.spec.ts:141 and :172 read src.contributions. As worded, 'bindSelection with no only binds nothing' also disables every default view-reach binding (bind-selection.test.mjs).
- Commit 2 (setFilter and setState go). The suspended-sort restore (suspended-sort.test.mjs:101) has no door to port to before commit 5, and setPage cannot restore a page before the first load (data-source.ts:1598 clamps). So 'port the 5 setState files' is not possible as described.
- Commit 3 (frozen readings). Its proof ('a write to what supersedeColumns handed out throws') holds only on the select path. Readings that arrive by setQuery, or that a remote commit copies (query-edits.ts:190, 197, 251), stay unfrozen, so the guarantee and its test are only partly true.
- Commit 5 (sort, group and search in the Query). As written it raises gated scans: #walkKey includes #applied (data-source.ts:1988), so the sort and search acts re-walk. It also loses arrangements, because prune() (query-edits.ts:45-53) deletes a scope that holds only a sort or search on the next filter edit. Its proof expects only '0 compiles'.
- Commit 7 (reads and declarations move to the context). declarePart, declareDefault (which calls write()), offer and declarePreset carry source-side follow-ups (walkSoon, drawScopesSoon, scope-change, recompose), and nothing is in place to deliver them before commit 8 adds heard(). 'check:bench IDENTICAL' is not achievable unless that channel is moved earlier.
- Commit 13 (every chip locked, the bar paints from its live slice). In this commit the whole answer still goes out, but locked chips no longer derive `current` (sherpa-quick-filter.ts:684-687, :613) and the bar stops writing data-current (toolbar.ts:1897-1903). #answers then reports a just-picked off chip as `suspended: true` (sherpa-quick-filter.ts:322-325; toolbar.ts:1205), and a chip-body toggle sends an unchanged answer, which does nothing. A reader's first pick and every chip on/off break until commit 14.
- Commit 14 (one request per act; the whole answer goes). It deletes answer(), which openSource needs at page-definition.ts:108 to put saved filters onto scopes, switched off. That caller and 9 test files that call answer, answerScope or answerColumn directly are not in its list.

**Wrong:**

- **Risk 1: 'A PEER'S WORK IS UNCOMMITTED. 345 phase 3 edits in data-source.ts are in the working tree now … Every line cited here is at HEAD. Start commit 4 only after that work lands.'** — The work has landed. The working tree is clean and the 345 3.4 work is commit ff34596d. That commit added about 30 lines to data-source.ts, so every citation after about line 1695 is now off by about 30 lines. The gate the design waits for is already met, and its line map is stale. (`git status --porcelain` prints nothing. ff34596d 'perf(data): 345 3.4' changes data-source.ts by +61/-43 (#onStoreChange :1698, #trusts, #walkAge :1729). 720261b7 'phase 3 done'. Where the lines are now: #walkKey data-source.ts:1985-1991 (design says 1955-1961); answerScope :2290 and answerColumn :2320-2327 (design 2259-2296); answerUnscoped :2332-2346 (design 2301-2315); #setAside :2136 (design 2105); #takeAside :2097 (design 2065); the #viewFilter null sentinel at 210, 419, 524, 1898, 1989, 2018, 2099 (design 1868, 1959, 1988, 2068).)
- **'reading(scope, field), preset(id) and defaultFor(scope) return the frozen original, never a copy. This is 319 A, now enforced instead of a comment (data-source.ts:746-748).'** — All three return structuredClone copies today. 319 A (no copy on the way out) covers only describe()'s saved-filter readings. So this is a behaviour change, and it lowers the clone count, not an enforcement of an existing rule. Commit 7, which moves these reads, still claims 'check:bench IDENTICAL'. (defaultFor: data-source.ts:639-643 `structuredClone(held.readings)`. reading: :646-649 `structuredClone(held)`, commented 'A copy.' preset: :738-742 `readings: structuredClone(readings)`. The comment at :746-748 is on describe(), which hands out `this.#presets.get(id)` at :773 and :801.)
- **Commit 1: 'bindSelection with no `only` reports and binds nothing. Selector loses `contribute`.'** — bindSelection's DEFAULT reach is 'view'. That reach never takes `only` and writes through select(). As worded, the rule would disable every view-reach binding. Only the component-reach binding without `only` uses contribute. (bind-selection.ts:103 `reach = options.reach ?? 'view'`. :112-113 needs contribute only when `reach === 'component'`. :137 and :165 are the view path, with no `only`. test/unit/bind-selection.test.mjs:47-55 binds with no reach and no only.)
- **Commit 1 proof: 'Port the 7 test files that call `.contribute(` … or delete the tests with the path.' And: 'No sibling uses any of these.'** — The 7 files that call .contribute( are only part of the test work. Many other tests drive the deleted paths through an UNSCOPED bar (answerUnscoped, `saved:` parts), through `contributions`, or through debugState().parts. They break in commit 1 and are not listed. (test/e2e/reforged-saved-filter.spec.ts:37-75: unscoped bar, expects parts ['saved:at-risk']. test/unit/a-saved-filter-is-its-readings.test.mjs:70-95: debugState().parts. test/e2e/reforged-filter-scope.spec.ts:141 and :172 read src.contributions, and :296 calls `Object.keys(d.parts)`, which throws once parts leaves debugState; :115-200 bind component reach with no only. test/unit/query.test.mjs:234 reads src.contributions. Unscoped bars whose report must filter: reforged-number-advanced.spec.ts:90, reforged-number-filter-reports.spec.ts:183, reforged-data-source.spec.ts:175.)
- **Commit 1: 'apply has no caller in src (only a comment at toolbar.ts:1161)'.** — apply() has two callers in src: answer() and answerUnscoped(). Both go or change in the same commit, so this does no harm, but the statement is false. (data-source.ts:709 `this.apply(readings)` in answer(). :2337 and :2344 `this.apply(…)` in answerUnscoped().)
- **Commit 2: 'setSort, setGroup, setSearch, setPage and setPageSize already cover the rest of setState.'** — They do not cover two things. First, setPage clamps against the CURRENT totalPages, so a restore to page N before a load lands on page 1. setState writes page last and unclamped (T-set-state-merges-page-last). Second, no door sets sortSuspended directly. sortSuspended reaches the Query only in commit 5, so a test that restores a suspended sort has nothing to port to in commit 2. (data-source.ts:1598 `Math.min(…, this.totalPages)`. setState :430-432 'PAGE LAST, and not clamped'. :423-426 sets sortSuspended. test/unit/suspended-sort.test.mjs:101 `s.setState({ sort: [], sortSuspended: {...} })`. headless-data-layer.test.mjs:372 'setState restores a whole view in ONE load'.)
- **Commit 9: 'query-change replaces the source's scope-change and selection-change … Their only listeners are bind-selection.ts:183-184 and provider-page.ts:119-124, 451.'** — That is true in src only. Unit tests also listen on the source and assert on these events, and one asserts the detail shape (`{ scopes: touched }`). Commit 9's proof lists none of them. (test/unit/scope-registry.test.mjs:71; test/unit/up-is-open-down-is-closed.test.mjs:58 (`events.push(e.detail)`) and :107; test/unit/field-selection.test.mjs:130 (`e.detail.field`).)
- **Controls: 'SORT, GROUP … A locked chip writes no data-current or direction (quick-filter.ts:481, 513); writeView draws them.'** — Today the organise chip writes both with no data-locked check. No commit in the plan changes sherpa-quick-filter.ts's #arrange or #applySort, so this stays a two-way write. (sherpa-quick-filter.ts:481 `this.current = !this.current` (group branch of #arrange); :513-514 `this.set('data-direction', …); this.current = direction !== null;` in #applySort. Neither checks data-locked.)
- **'arranges' is listed among the plain context reads ('A read that needs only the Query and the page's declarations belongs to the context').** — arranges() falls back to a fact of the source's binding: whether a grid or list is bound into the scope. That breaks the design's own rule, and in a context with several sources the answer depends on which source is asked. (data-source.ts:1036-1038 `this.#arranges.get(scope) ?? (scope !== VIEW && this.#binding.showsRows(scope))`; source-binding.ts:146-148.)
- **Commit 3: after ownReading, 'The library's readings, supersedeColumns, #draw and selection() now hand out frozen objects', and its proof says 'A write to an object that supersedeColumns handed out throws.'** — Only select, write, declarePreset and declareDefault freeze. Readings that arrive by setQuery (any View pick, restore or reload), and readings that commit copies into #applied on a remote source, are fresh unfrozen clones. supersedeColumns reads #applied, so it hands out unfrozen objects after any setQuery or remote Apply. The test passes only on the select path. (query-edits.ts:251 `structuredClone(given.scopes)` in definitionOf, and :270 for the carry-over copy. data-source.ts:393-394 `#applied = next; #draft = … structuredClone(next)`. copyField :190 and copyScope :197 use structuredClone. #syncColumns :1302 reads viewHeldReadings(this.#applied).)
- **'… so the 17 Demos reads of debugState() stay green' and 'the 12 Demos specs that call setChip…() then report()'.** — The counts are wrong. There are 67 debugState() calls in Demos tests and app, not 17. Of the Demos specs that call setChipValues or setChipReading, 10 call report(), not 12. (`grep -rnE 'debugState\(\)' test app` in ../Sherpa Demos gives 67 lines; 17 is only `window.sherpa.source.debugState(`. 10 files match `setChip(Values|Reading)\(` and report().)
- **'DOORS THAT STAY (Will's B, docs/TODO.md:1585)'.** — The citation is wrong. TODO.md:1585 is the 2026-10-01 ruling on grid headings opening the chip's menu. (Ruling B is at docs/TODO.md:1612-1613 ('KEPT by Will's B (2026-10-13)') and :1628 ('✅ Will, 2026-10-13: B — the doors stay').)
- **'`applied` and `draft` return one structuredClone each, as today.'** — Today `source.query` makes ONE structuredClone of both together. On a local source that keeps applied === draft inside the copy. Split getters clone twice for `{applied, draft}` and lose that identity. No caller depends on it today, but 'as today' is wrong. (data-source.ts:296-298 `return structuredClone({ applied: this.#applied, draft: this.#draft });` with the comment 'On a local source the two are one object, and so are their copies.')

**Missed:**

- Commit 5 must change the walk key. #walkKey serialises #applied whole, and every load ends in #rewalk. Once sort, group and search are in #applied, each sort, group or search act re-walks: walkInOrder runs and counts as a scan. Today records/sort and records/search reuse the walk (scans 2 each). The design expects only '0 compiles' and does not foresee scans rising, which the gate forbids. data-source.ts:1988, :1937, :2044-2047; check-bench.mjs:31 (scans is gated).
- Commit 5 must change prune(). prune deletes any scope with no holds, readings, presets or suspended, and it ignores sort, group and search. select, write, setReading, answer and release all prune. So a sort or search written to a scope that holds nothing (a grid's scope with no bar, or a View that holds no fields) is silently dropped by the next filter edit. Commit 11's `superseded` has the same problem. query-edits.ts:45-53.
- Commit 9's `version` in #walkKey moves on declarations that do not move the walk key today, such as declareScope (which has no #age++, data-source.ts:1021-1024). Together with the point above, 'check:bench IDENTICAL' for commit 9 is not shown.
- Commit 14 deletes answer(), but openSource still calls it to put each scope's saved filters on, switched off. page-definition.ts:108 `source.answer(scope, {}, …presets → false)`. That call site is not in the commit's list. Commit 14 also deletes answer and answerScope, which 9 test files call directly: send-down, page-definition, a-bar-report-never-rewrites-a-saved-filter, a-count-runs-again-only-when-something-moved, a-store-has-one-cache, query, headless-data-layer, reforged-provider-summary, reforged-saved-filter.
- Commit 7 moves declarations onto the context before the heard() channel exists (commit 8), but those declarations have source-side follow-ups. declarePart calls declareField, #walkSoon and drawScopesSoon (data-source.ts:594-602). declareDefault calls write(), an edit that stays on the source until commit 8 (:624-635). offer dispatches scope-change and #walkSoon (:1340-1348). declarePreset recomposes and draws (:723-734). The design gives no path for these in commit 7, yet requires the bench to be IDENTICAL.
- A bound bar's request must not carry the chip's off-state by accident. chip.reading adds `suspended: true` whenever !current (sherpa-quick-filter.ts:322-325), and #answers sends `suspended: !!reading.suspended` (toolbar.ts:1205). With every chip locked and the bar no longer writing data-current, a menu commit's {field, reading} must strip or override `suspended`, or a reader's first pick on an off chip lands switched off. Today the guard is the bar's data-current write before the emit (toolbar.ts:1891-1903).
- ProviderState v2 holds a single `query`, but the provider can still be given several sources that do not share one context, for example `provide({ sources: { customers, invoices } })` in reforged-provider.spec.ts:171 and :202. export() writes each source today (sherpa-provider.ts:642-646). The design does not say what v2 exports in that case.
- MCP run_query: removing its `filter` input removes its stated job, which is checking the `[field, op, value]` grammar a store receives, with and, or and not across fields (mcp-server/tools/data.js:250-257). The plain `where` form is per field and cannot say a cross-field or, or a not (where.ts:21-35). run_query could call store.load({ filter }) directly instead. The design does not mention this loss.
- persistView saves only on the source's 'change' event (persist-view.ts:96-100). 'Demos records.js:78-80 drops `source`' must mean the `{ source: false }` OPTION and not the `source` target. Dropping the target silently ends saving of the grid selection. Also, the page restore across a reload (setState's page-last) has no new home, because page is not in the Query.
- The provider's 'synchronous #writing flag around its own setQuery call' has no place to live for a View pick. That setQuery is called inside persist-view's onViewPicked listener (persist-view.ts:461), between the provider's `before` (sets #writing) and its `after`, which runs only after put.then and applyElements (:462-466; provider-page.ts:521-533). A hook in persist-view is needed, and the design does not name one.
- The DataSource constructor resets the draft for a remote store: `if (this.#remote) this.#draft = { v: 1, scopes: {} }` (data-source.ts:248). Through the writable handle of commit 6, a second remote source that joins a shared context (commits 16-17) would wipe that context's draft. This is not addressed.
- No commit in the list changes the organise chip's own writes, `this.current` and `data-direction` (sherpa-quick-filter.ts:481, :513-514). They are needed for the stated rule 'a locked chip writes no data-current or direction'.

### What was missed

**Unsafe as written:**

- Commit 1: at least 8 test files outside the 7 it ports fail: a-saved-filter-is-its-readings.test.mjs, reforged-saved-filter.spec.ts, reforged-filter-scope.spec.ts, query.test.mjs:44/234, reforged-number-advanced.spec.ts:90, reforged-number-filter-reports.spec.ts:183, reforged-data-source.spec.ts:175/398-416/580. They bind unscoped bars, call apply() or read parts and contributions.
- Commit 2: suspended-sort.test.mjs:99-111 restores a mid-suspend sort through setState, and there is no door for that until commit 5 adds sortSuspended. Deleting setState also breaks type-check at onViewPicked's `targets.source.setState` type (persist-view.ts:335, used at provider-page.ts:514), which is not in the commit.
- Commit 3: the planned 'write to what supersedeColumns handed out throws' test fails on a remote source. commit(), copyField, copyScope and setQuery put readings into #applied that are not frozen (data-source.ts:1537, :394; query-edits.ts:190, 197).
- Commit 5: the gated `scans` count rises on every sort and search act, because #walkKey stringifies #applied (data-source.ts:1988). prune() deletes scopes that only arrange (query-edits.ts:48-50). The many #state readers break. Dismiss of a set saved from the screen resets the sort (provider-page.ts:234). A restored search has no box to show it.
- Commit 7: declarePreset, declareDefault and declarePart move to the context, but their bodies need #recompose, drawScopesSoon, #walkSoon, write() and declareField on the source (data-source.ts:595-636, 719-735), and the heard() channel only comes in commit 8. import() also moves here while setQuery moves in commit 8.
- Commit 8: run_query calls source.setSort, setGroup and setSearch (mcp-server/tools/data.js:338-346) and prints them, so check:mcp-pack fails unless the MCP changes. onViewPicked's optional setQuery (persist-view.ts:336, :453) silently stops applying View Queries, and type-check does not catch it.
- Commit 9: test/unit/scope-registry.test.mjs:71, up-is-open-down-is-closed.test.mjs:58,107 and field-selection.test.mjs:130 listen to the source's scope-change and selection-change, which this commit removes.
- Commit 12: deleting #early for a bound panel breaks 367's shut-panel follow (sherpa-filter-panel.ts:387-391, 432-434; T-a-panel-follows-the-query-open-or-shut). A shut panel opens on a stale description.
- Commit 13: locking every filter chip turns off data-condition, data-filters-nothing and #applySelection on menu change (sherpa-quick-filter.ts:684-687, 714-760). The handover sent as {suspended:false} turns the Switch on instead of handing the pre-bind answers over (toolbar.ts:1387-1391).
- Commit 14: deletes answer() while openSource still calls it (page-definition.ts:108), along with 9+ test files. The saved-filter teaching path (data-source.ts:2303) has no replacement. The spec, manifest and reference regeneration that the pre-commit hook enforces is not planned.
- Commit 16: a synchronous #writing cannot be built on onViewPicked's async before/after hooks (persist-view.ts:439-466) without an API change the commit does not list.

**Wrong:**

- **Risk 1: 'A PEER'S WORK IS UNCOMMITTED. 345 phase 3 edits in data-source.ts are in the working tree now … Every line cited here is at HEAD.' Commit 6: 'Land this only after the 345 phase 3 edits in data-source.ts are committed.'** — The work is already committed and the working tree is clean, so this blocker no longer applies. Commit ff34596d (345 3.4) added about 30 lines near data-source.ts:1695, so every data-source.ts citation after that line is about 30 lines low at HEAD. The design also does not account for what that commit added: #walkAge, #allAge, #heard and #trusts, and the walk's `reads`. (`git status`: 'nothing to commit, working tree clean'. `git show ff34596d` changes data-source.ts by +61/-? lines. At HEAD: #walkKey is at data-source.ts:1985-1991 (the design says :1955-1961); #setAside is at :2136 (design: :2105); #drawWalk is at :2143-2173 (design: :2112-2142); answerScope/answerColumn/answerUnscoped are at :2290-2346 (design: :2259-2315); the bar and heading commit() calls are at :2308 and :2325 (design: :2277, :2294); the viewFilter sentinel is at :1898, :1989, :2018 and :2099 (design: :1868, :1959, :1988, :2068); #ask is at :1861-1955 (design: :1831-1925).)
- **The bench 'counts loads/counts/compiles/clones per act'. Commit 5: 'sort and search stay at 0 compiles'. Commits 6-9: 'IDENTICAL'.** — The gate also counts distinct, rows and scans. #walkKey serialises the whole #applied Query, so once sort and search live in the Query, every sort or search act changes the walk key. A new walk then runs, and the gated `scans` count rises on records/sort, records/search, remote/*, rest/*. Keeping the act at zero compiles does not prevent this. Commit 9's walk-key `version` has the same effect unless it ignores changes that only rearrange rows. (scripts/check-bench.mjs:33 sets GATED = ['loads','counts','distinct','rows','compiles','clones','scans']. data-source.ts:1988 JSON-stringifies this.#applied into #walkKey. data-source.ts:2150-2152: #drawWalk's key includes #walkKey ('a sort, a page or a search moves nothing'). scripts/bench-baseline.json has records/sort scans 2 and records/search scans 2, i.e. no walk today. ArrayStore.scan is at stores.ts:91, and passOver/walkInOrder are counted as scans at check-bench.mjs:66-77.)
- **Commit 1 proof: 'Port the 7 test files that call `.contribute(`'.** — Deleting answerUnscoped, apply, contributions/debugState().parts and bindSelection's contribute path also breaks tests that never call `.contribute(`. They bind a bar with no scope, read parts or contributions, or call apply(). (test/unit/a-saved-filter-is-its-readings.test.mjs:68-95 (an unscoped bar; asserts debugState().parts). test/e2e/reforged-saved-filter.spec.ts:37,54. test/e2e/reforged-filter-scope.spec.ts:141-179 (bindSelection reach:'component' with no only → src.contributions) and :296 (Object.keys(d.parts)). test/unit/query.test.mjs:44 (src.apply reach:'component') and :234 (src.contributions). Unscoped bars that assert filtering: reforged-number-advanced.spec.ts:90, reforged-number-filter-reports.spec.ts:183, reforged-data-source.spec.ts:398-416 (quick-filter-change on an unscoped bind).)
- **SORT/GROUP: 'these already send one value. A locked chip writes no data-current or direction (quick-filter.ts:481, 513); writeView draws them.'** — This is not true today, and no commit changes it. The organise chip writes `current` and `data-direction` itself, with no data-locked guard. Organise chips are also never locked: only persistent chips get data-locked. (sherpa-quick-filter.ts:481 `this.current = !this.current`, :494 `this.current = !!field`, :513 `this.set('data-direction', …)` and :514, none checking data-locked (only the body click at :613 does). sherpa-quick-filter-toolbar.ts:745-748 sets data-locked only for f.persistent.)
- **Commit 13: 'Lock every filter chip in a bound bar … On or off comes only from the paint.' Nothing else changes.** — data-locked does more than stop a chip from flipping. A locked chip's menu change only relays the event. #answersForItself() is false for a locked chip, so #syncEmpty and #syncCondition return early. As a result, every chip in a bound bar would lose data-condition and data-filters-nothing (the amber warning). quick-filter.ts is not in the commit. (sherpa-quick-filter.ts:684-687: a locked chip relays and skips #applySelection. :746-749: #answersForItself returns !data-persistent && !data-locked && !arranges. :714-724 and :756-760: #syncEmpty/#syncCondition are gated by it. reforged-saved-filter.spec.ts:42 reads data-condition.)
- **Toolbar: 'drawScope's resume and handover (:1386-1391): one {suspended: false}'.** — The handover branch runs while the scope IS suspended. It turns the bar's own pre-bind switched-off chips on and reports them, so the source's keepOff lists them as its own. A {suspended:false} request would turn the scope's Switch back on, and it carries none of the handed-over readings. (sherpa-quick-filter-toolbar.ts:1329-1330 (handover = #switchedOff), :1386-1391: `else if (handover?.length && scope.suspended) { … chip.current = true; this.#emitChange(); }`.)
- **Panel (commit 12): delete '#early for a bound panel (:733, :389-390)'.** — Since commit 376ffcd1 (TODO 367), #early is how a SHUT panel keeps every reading drawn to it. drawScopes is only re-sent when holds or presets move, so a shut bound panel without #early opens on a stale description. The design gives the toolbar a live slice but gives the panel none. (sherpa-filter-panel.ts:268-277 (#drawOrWait/#stale). :387-391 (setFieldReading stores into #early while #stale). :432-434 (drawReading draws 'OPEN OR SHUT'). :306 and :344 (readings/#describedReadings merge #early). source-binding.ts:216-227 (drawScopesSoon) is called from hold/declare paths, not from select.)
- **Commit 3: 'Every door deep-copies a reading on the way in and freezes it … supersedeColumns, #draw and selection() now hand out frozen objects'; new test 'A write to an object that supersedeColumns handed out throws'.** — Readings reach #applied through structuredClone and spread copies, which are not frozen. On a remote source, supersedeColumns gets clones of #applied that are not frozen, so the planned test fails there. Suspended readings are rebuilt by spread with an unfrozen outer object. (data-source.ts:1537 `this.#applied = structuredClone(this.#draft)`, :394 `structuredClone(next)`, :1216-1217 (suspendScope spread). query-edits.ts:190 and :197 (copyField/copyScope structuredClone), :84 (keepOff `{ ...reading, suspended: true }`), :247 (definitionOf structuredClone). data-source.ts:1303 supersedeColumns(viewHeldReadings(this.#applied)).)
- **Persistence: '#writing stays only as a SYNCHRONOUS flag around the provider's own setQuery call.'** — For a View pick, the provider does not make the setQuery call. onViewPicked makes it, between its before() and after() hooks, and after() runs only once setQuery's promise resolves (after drawEveryBar). There is no synchronous hook after the call, so persist-view's API must change, and the plan does not list that. (persist-view.ts:439 (before), :461-466 (setQuery, then after in put.then). provider-page.ts:524-532 (before sets #writing; after → #unquietSoon). provider-page.ts:313-316 and :168-171: resetView and saveView await two setQuery calls inside #quietly.)
- **MCP: run_query 'applies the plain where with source.query.setQuery(...)', and only its compiled `filter` input and setFilter line go (data.js:335-347, 444-445).** — This misses most of what run_query depends on. The aggregate branch loads the ArrayStore directly with parsed.filter. The input schema and the README document `filter`. A `where` cannot express the cross-field and/or/not that `filter` accepts today. run_query also calls and prints setSort, setGroup and setSearch, which leave DataSource in commit 8. (mcp-server/tools/data.js:254-257 (the filter schema and its and/or example). :297-306 (walkOps over and/or/not). :403-404 (the aggregate load uses parsed.filter). :338-346 and :446-451 (setSort/setSearch/setGroup). mcp-server/README.md:103 lists `filter?`.)
- **Counts: 'the 17 Demos reads of debugState()', 'about 50 Demos sites', 'Will's B, docs/TODO.md:1585'.** — All three are off. The design undercounts the debugState() reads and overcounts the door call sites. Ruling B sits at different lines. (In ../Sherpa Demos/app and test, debugState() appears on 67 lines in 21 files. Calls to the moved doors number 31 (select 9, scope 9, reading 6, hold 5, setSearch 1, setQuery 1). Ruling B is at docs/TODO.md:1632-1648 ('✅ Will, 2026-10-13: B — the doors stay').)

**Missed:**

- prune() deletes any scope with no holds, no readings, no presets and no Switch (query-edits.ts:45-53). After commit 5, a sort written into a grid scope with no filters, or a search in a View with no holds, is deleted by the next prune. prune is called from setReading :127, write :574, answer :712, release :939, suspendScope :1220, clearReadings :137 and rehome :151. The same happens to sortSuspended (commit 5) and superseded (commit 11).
- Commit 5 leaves #state with only page and pageSize, but many places still read sort, group or search from #state: the `state` getter (data-source.ts:291-293); sherpa-provider.ts rows `as` reading `src.state.group`; reforged-data-source.spec.ts:186,197 reading source.state.sort; the change event's detail.state :1934; #loadOptions :1648; #boundView :2383; totalPages :468; groups() :1177,1193; #ask :1897,1921,1928; setPage :1602; atDefault :356; answered :365; describe :818-819; debugState :1405-1407.
- Search gets no draw path. Once search is in the Query, a session or View restore brings it back, but Demos' find box keeps its own text (Sherpa Demos/app/contexts/records.js:232-238), and writeView pushes no search (bind-source.ts:106-115).
- Where an unscoped sort lands after commit 5 is not said. arranger() returns undefined for a grid or the MCP with no scope (bind-source.ts:184-187); today export() falls back to VIEW (data-source.ts:307).
- openSource puts each scope's saved filters on OFF with source.answer(scope, {}, …) (page-definition.ts:108). Commit 14 deletes answer() and names no replacement.
- answerScope teaches the library a saved filter it has never heard of (data-source.ts:2303). Requests have no path for this. take() treats an id that is not in the library as a FIELD (#take :875-877), so a hand-bound bar's own saved filter would become a held field.
- Commit 8 moves select, write, suspendScope, suspendSelection and request onto the context. Commit 10 then adds setReading, suspend and take for the same acts, and nothing deletes the first set. That leaves two doors per act, against D4's 'no aliases' (T-a-rename-drops-the-old-name).
- Two paths need a member's SourceBinding, and the context API does not say how it reaches one: declareDefault's `only` (sherpa-provider.ts:770 `{ only: el }`) and write's bind lookup, rows:'all' check and narrows id (data-source.ts:554-565). setReading takes no `only`. These paths are live: Demos sets data-where at app/templates/dashboard.html:19.
- viewQueryOf turns only `readings` into `where`, and passes `...rest` through as it is (persist-view.ts:557-561). So ScopeQuery.superseded (raw FieldReadings) would go into saved Views, drafts and sessions, against T-one-way-to-write-a-condition. mergeSet replaces a scope whole (query-edits.ts:304), which drops its superseded.
- Dismiss of a set saved from the screen calls setQuery(structuredClone(opened.initial)) (provider-page.ts:233-235). After commit 5, initial carries the page's arrangement, so this branch resets the reader's sort. The design fixes only the `before` branch.
- onViewPicked's source type requires setState and makes setQuery optional (persist-view.ts:334-337). Commit 2 breaks type-check at provider-page.ts:514-517. After commit 8, `targets.source?.setQuery` is undefined, and the check at :453 silently falls to the non-JSON clearAll path (:470-477).
- The grid's header filter row stays outside the one Query. It declares own:['filter-change'] (sherpa-data-grid.ts:155), and populate clears #filters (:365). For a hand bind, steer's filter-change still calls select (bind-source.ts:274-286). It is in no export, count or persistence.
- QUERY-DESIGN rule 1 (docs/QUERY-DESIGN.md:52-53) also lists page, segment and aggregate. The design cites rule 1 but moves only sort, group and search.
- Commit 9 does not port the tests that listen to the source's scope-change or selection-change: test/unit/scope-registry.test.mjs:71; up-is-open-down-is-closed.test.mjs:58,107 (asserts that one event names every scope touched); field-selection.test.mjs:130.
- Commit 14's proof leaves out the tests that call source.answer() or answerScope() directly: send-down.test.mjs:71,112; page-definition.test.mjs:239,244; a-count-runs-again-only-when-something-moved.test.mjs:31,63; a-store-has-one-cache.test.mjs:116; query.test.mjs:171-180; headless-data-layer.test.mjs:1022-1093; reforged-provider-summary.spec.ts:149-155; a-bar-report-never-rewrites-a-saved-filter.test.mjs.
- Commit 12 does not list reforged-advanced-condition-words.spec.ts:163, which reads the panel event's detail.readings.
- Commit 14 changes the toolbar's quick-filter-change detail (typed in sherpa-quick-filter-toolbar.component.json:754-766) and the filter-add/filter-remove detail. Neither its proof nor commit 13's lists spec:check, manifest or reference, and the pre-commit hook blocks all three (.githooks/pre-commit:42, 189, 198). The bench fakes are read from these specs (check-bench.mjs:35-36).
- check:size runs on every commit (.githooks/pre-commit:168). Recording growth is planned only for commits 1, 2 and 6, though commits 3, 4, 5, 10, 11 and 17 grow files.
- ProviderState v2 holds a single `query`. It cannot carry several sources given by hand through provide(), each with its own private context (sherpa-provider.ts:642-647 loops over sources; reforged-provider.spec.ts:171,202).
- With several sources, each openSource declares scopes, holds, offers, presets and sets into the one context (page-definition.ts:77-108). A second definition would overwrite the first one's holds and sets, and preset ids would collide. The design does not cover this.
- has(field) is built from declared fields, store.domains and store.time. That misses fields that exist only in the rows: lean.page.json declares 10 of its 15 fields. A View reading on such a field would be skipped on a source that has it.
- The provider makes the context before any source joins (sherpa-provider.ts:293). How a one-object local context splits into applied and draft when a remote member joins is not specified, nor the reverse on leave. close() (data-source.ts:1780) does not call leave().
- No commit's proof includes the Sherpa Starter tests (../Sherpa Starter/test/e2e/the-starter-boots.spec.ts) or the Gallery tests, though both run against sherpa-ui.
- TODO 320's row (docs/TODO.md:343) says its behaviour changes come 'after Will's test run and 302/311'. Commits 12-14 do 320's work without that gate.
- No lint rule enforces 'no display component imports QueryContext': eslint.config.js:75-90 does not name core/data/query-context.js. QueryContext is data layer, not app layer, so T-the-app-layer-is-opt-in does not cover it.
- On a remote store, the plan does not say whether a locked door's request (setChipValues, setChipReading, values=) commits or only edits the draft. Today report() → answerScope → commit() applies it (data-source.ts:2308).
