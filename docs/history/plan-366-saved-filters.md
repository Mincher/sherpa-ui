# 366 — saved filters as one query definition

Read-only design, 2026-10-20, at HEAD `f5ba0e07` (sherpa-ui) and `d2dc721` (Demos).
Line numbers are from that HEAD.

## Will's rulings

- *"Saved filters need to be reworked to provide a single query definition to the
  single query component."*
- *"Saved filters shouldn't show as a chip in the filter panel header (or filter
  toolbar) when selected. Selecting a saved filter definition should just apply
  the state, fields, and values to the filter chip components to match the query
  definition."*

The second ruling picks option A below (it LOADS), and it ALSO removes the
reader's Saved chip, its ` *` edited mark, its Dismiss cross and `before`. Where
the design below keeps that chip, the ruling wins. The revised commit plan
(`plan-366-build.md`) folds this in.

## Today

All lines are at HEAD f5ba0e07 (sherpa-ui) and d2dc721 (Demos). Today there are TWO kinds of saved filter. They share a menu section and nothing else.

KIND 1: A PAGE'S SAVED FILTERS ("presets"). A toggle chip, read by id from a library.
- DECLARE. The page definition holds `source.presets: {id: {label, where}}` (page-definition.ts:49-51) and `scopes.<s>.presets: [ids]` (:24-25). The schema has them at schemas/page.v1.json:44-48, 98 and 120-130. Demos records.json:41 and :44-48 use them, and so does Starter template/view-schemas/records.json:16-20.
- openSource turns each `where` into readings and declares them on the SOURCE: `source.declarePreset(id, source.readingsOf(where), {label})` (page-definition.ts:78-88). It reports `preset-without-where`. It puts each scope's presets on, switched off, through `source.answer(scope, {}, {id: false})` (:108).
- STORE. Each source keeps its own library: `#presets` (readings by field) and `#presetFacts` (label) (data-source.ts:203, 216). declarePreset is at :719-735 and recomposes and draws. `preset(id)` returns a copy (:739-742). The Query keeps only `ScopeQuery.presets: {id: on}` (query.ts:54) and `suspended.presets` (query.ts:63). So the Query cannot be read without the side library. That is why export() bundles the library: `SourceState {v, query, presets}` (data-source-types.ts:91-95; data-source.ts:310-317). import() declares the presets first (:326-328).
- APPLY. compile: `scopeClauses` ANDs each ON preset's readings through `CompileFacts.preset` (query.ts:93, 153-163, 219-231). An unknown preset reports `unknown-preset`. The facts come from data-source.ts:1475.
- ON/OFF.
  - A bar chip's on/off goes out in the whole answer: the toolbar's `presets` getter (toolbar.ts:1237-1246) and its emit (:1133).
  - steer passes it on (bind-source.ts:210-229) to `answerScope`. answerScope teaches the library any unknown id (data-source.ts:2290-2315, :2303). It then calls `answer(scope, readings, presets)`, which replaces the scope's presets map (:699-715).
  - An unscoped bar uses `saved:<id>` parts instead (answerUnscoped :2332-2346).
  - The panel sends a pseudo-field `presets: {picked: on}` (panel.ts:326-342). answerScopes → #setPresets handles it (data-source.ts:840-856).
  - Add from the Filters menu: #take turns a preset on (:874-885). Remove: release (:935-945).
  - The Switch keeps them in `suspended.presets` (data-source.ts:1208, 1219; keepOff query-edits.ts:81, 87-91).
  - prune keeps a scope that holds only presets (query-edits.ts:48).
  - A View keeps each held preset chip, switched off (definitionOf query-edits.ts:281-288; TRAP T-a-view-keeps-the-saved-filter-chips).
  - A View may turn one on by id (Demos records-views.json:28, `presets: {at-risk: true}`).
- COUNT AND WALK.
  - answerOrder puts presets first (source-counts.ts:41-58, Will D2 A).
  - planWalk makes a step per preset that counts only while on (:123, 138-144; TODO 166).
  - answered() is at data-source.ts:370, answersOf at query-edits.ts:322, and debugState's `presets` at data-source.ts:1413.
- DRAW.
  - describe() lists each held preset with label, readings, active and says, and offers unheld ones below the View (data-source.ts:770-776, 780, 798-801). The words come from say/#says (:830-837).
  - Toolbar: a def with `readings` becomes a toggle with a card (toolbar.ts:756-761). The card code is at :928-958, and drawScope places and turns presets on at :1349-1363 and :1384-1385. Added saved chips go last (:1505-1513).
  - Chip: `#given()` gives `fx` (sherpa-quick-filter.ts:763-767).
  - Panel: a 'presets' section (panel.ts:673-683), its cards (:1553-1567), its row toggles (:1653-1663) and #presetChip (:1173-1175).
  - The card itself is src/core/ui/saved-filter-menu.ts (whole file, TODO 49/181).
  - The Filters menu's Saved section lists offered presets (filters-button.ts:111-112).
  - Types: FilterDef/FieldFilter `readings` and `says` (data-source-types.ts:82-85; filter-def.ts:80-82), and HeldFilter.active (:101-102).
- SAVE, PERSIST, DISMISS. A reader cannot save or delete one; it ships with the page. Its on/off persists only inside a Query: the per-tab kept Query `/filters/<id>` (sherpa-provider.ts:315; provider-page.ts:432), View drafts, or a saved View or set whose scope carries `presets`. The keeper listens to the raw quick-filter-change only because a preset toggle fires no selection-change (provider-page.ts:452-453).
- Bench: the fixture test/unit/fixtures/records.page.json has 3 off presets, and the fakes carry presets (check-bench.mjs:151-154, 177, 189, 213). The MCP's validate_page checks them (mcp-server/tools/data.js:816-835).

KIND 2: A READER'S SAVED FILTER SETS. Already a query definition, loaded into the chips.
- DECLARE AND STORE. `SavedFilter {label, query: QueryDefaults}` (saved-filters.ts:24-27). It is kept per page in localStorage `sherpa:filter-sets:<page>` (:39, 48-70; TRAP T-saved-filters-are-every-scope). These are the only filters that cross tabs and sessions (TODO 370).
- SAVE.
  - The bar's ⋮ (toolbar.ts:1595-1600; more-menu.ts:58-59) and the panel header (panel.ts:207, 1750-1751) emit filters-save, filters-save-as or filters-delete.
  - The host names and confirms (Demos index.html:447-475) and calls provider.saveFilters or deleteFilters (sherpa-provider.ts:434-453).
  - ProviderPage.saveFilters stores `filtersOf(viewQueryOf(source))`, which is every scope's `where` and holds, plus the `presets` on/off map, with no arrangement (provider-page.ts:197-210; saved-filters.ts:73-80; persist-view.ts:554-563).
- APPLY. A Saved-section row (filters-button.ts:113-114, SavedSets.pick :201-208) emits filters-apply (toolbar.ts:1651-1654; panel.ts:1642-1643). ProviderPage.applyFilters (provider-page.ts:212-223) calls `source.setQuery(mergeSet(applied, set.query))`. Each scope the set names takes its filters, and the rest stay (query-edits.ts:300-307). It lands in both copies at once, remote too (data-source.ts:385-406).
- ON. ProviderPage keeps `#savedSet {id, label, query, before}` (provider-page.ts:261-268). The tab remembers it in sessionStorage `sherpa:filter-set-on:<page>` (saved-filters.ts:100-118; begin provider-page.ts:99-106).
- DRAW. #saySaved sets `savedSets` on every bar and panel (provider-page.ts:277-289). Only a `data-saveable` host lists them (filters-button.ts:181-196). The Saved chip shows the name, plus ` *` and the warning look when #edited (sameFilters: `where` plus the ON presets, provider-page.ts:270-275; saved-filters.ts:85-91).
- DISMISS. The chip's cross emits filters-dismiss (toolbar.ts:320; panel.ts:209), and dismissFilters (provider-page.ts:225-236) puts `before` back. A set saved from the screen goes back to `initial` and then the View's filters.
- COUNT AND WALK. None of its own. Once applied, its conditions are ordinary readings (and preset ids).

THE FRACTURE. Kind 1's meaning lives in a per-source library outside the Query, and is joined to it by id. Kind 2 is a query definition, but it can name kind-1 ids, so it too depends on that library. Two shapes (`{label, where}` against `{label, query}`), two homes (the source against ProviderPage), and two ways to apply (a toggle ANDed in compile against a merge into the Query). The 366 plan carries all of it into the QueryContext: the library, declarePreset, preset(), setPreset, the {preset, on} request, commit({scope, preset}), QueryState.presets, and D3.

## The design

ONE SHAPE, ONE KIND. A saved filter is a name and a query definition. It is the filter half of a View, in the JSON a View already uses (QueryDefaults, `where` per field, TRAP T-one-way-to-write-a-condition):

  { "label": "At risk", "query": { "v": 1, "scopes": { "data": { "where": { "health": { "band": "At risk" } } } } } }

- The type `SavedFilter {label; query: QueryDefaults}` moves from saved-filters.ts into query.ts (DOM-free), so the page definition and the browser store share it.
- A page ships its own in `PageDefinition.savedFilters: {id: SavedFilter}`. This is top level, beside `source` and `ui`, because the Query is the Context's.
- `source.presets` and `scopes.<s>.presets` go in the same change (no alias, T-a-rename-drops-the-old-name).
- A reader's saved filters keep their storage, key and shape unchanged.

THE QUERYCONTEXT KNOWS NO SAVED FILTER. It holds no library, and the Query names no saved filter by id. ScopeQuery.presets, suspended.presets, the library, declarePreset, preset(), CompileFacts.preset and presetClauses all go. A saved filter reaches the context the way a View does: as ONE query definition through its one whole write. ProviderPage.applyFilters already does this: `query.setQuery(mergeSet(query.applied, saved.query))`. So the Query is self-contained JSON. export() is the Query alone, and QueryState / ProviderState v2 carry no `presets` map. import() declares nothing first.

TURNING ONE ON AND OFF. A page's saved filter now works exactly as a reader's set works today:
- ON (apply): its row in the Filters menu's Saved section asks `filters-apply {id}`. Each scope it names takes its filters (holds kept, plus the fields it names). The scopes it does not name stay as they are (mergeSet, Will's 105 rule). Its conditions now sit on the ordinary field chips, so the reader sees and edits each one. A second saved filter applied over the first merges the same way, and `before` stays the Query from before the first.
- OFF (Dismiss): the Saved chip's cross puts `before` back. An edit makes the chip read ` *` (sameFilters, now `where` only).
- It combines with other filters as readings do. In a scope it names, it REPLACES that scope's filters. In other scopes, filters AND as always.
- A remote Context applies it at once (setQuery writes both copies, as a View does, D1 A unchanged).

COUNTS AND THE WALK. There is nothing special to count. An applied saved filter is readings at its fields' homes, so answerOrder and planWalk count it as ordinary fields, in chip order. The preset kind of OrderEntry and the preset steps go. With several sources, the general `has(field)` rule of 366 §4 skips a reading on a field a source lacks. D3 (skip a saved filter whole) becomes moot, because no sealed saved filter is left in the Query to skip. Will should know this, because it retires a ruling he made today.

LISTING, SAVING, DELETING.
- ProviderPage's library is `{...page.savedFilters, ...loadSavedFilters(page)}`, as viewLibrary is for Views (persist-view.ts:515-517).
- Every bound bar and panel lists the page's own in the Saved section. A `data-saveable` host also lists the reader's own and offers Save, Save as and Delete. So Starter's unsaveable bar still offers "Big accounts".
- SavedSet gains `own` (the reader's), and so do `provider.savedFilters` and `savedFilterSets`.
- A page's own is never deleted (more-menu's filters-delete shows only when `on.own`) and never saved over. saveFilters() with no name over a page's own answers undefined, so the host asks for a name, as saveView does over a shipped View. A name a page's own already has is made unique with uniqueViewLabel.

PERSISTED (TODO 370 holds, and nothing new is kept):
- Crosses tabs and sessions: only the reader's saved filters (localStorage `sherpa:filter-sets:<page>`) and saved Views.
- The page's own: shipped JSON, never stored.
- Per tab: which one is on, with `before` (sessionStorage `sherpa:filter-set-on:<page>`); the kept Query `/filters/<id>`; View drafts.
- Old stored data (D4, no shim): a `presets` key inside a stored set's, saved View's or kept Query's scope is dropped, with one `unknown-scope-key` report. definitionOf copies only ScopeQuery's own keys, and `suspended` is normalised to `{fields}`.

WHAT CODE GOES:
- Data layer:
  - data-source.ts: #presets, #presetFacts, declarePreset, preset, #says, say, #setPresets, the preset branches of answerScopes, #take, release, suspendScope, answer(…, presets), answerScope's presets and teaching, answerUnscoped's saved:<id> parts, export's presets map, import's declare, answered's preset test, debugState.presets and CompileFacts.preset.
  - query.ts: ScopeQuery.presets, suspended.presets, CompileFacts.preset, presetClauses, scopeClauses' preset loop and the `unknown-preset` report.
  - query-edits.ts: prune, keepOff, definitionOf and answersOf lose their preset branches.
  - source-counts.ts: the preset OrderEntry, the preset steps and WalkFacts.presets.
  - page-definition.ts: lines 24-25, 49-51, 78-88 and 108, and `preset-without-where`.
  - Types: SourceState.presets, HeldFilter.active, and FieldFilter `readings` and `says`.
- Controls:
  - Deleted whole: saved-filter-menu.ts.
  - Toolbar: the saved-chip code (:756-761, 928-958, 1237-1246, 1349-1363, 1384-1385, 1505-1513) and the event's `presets`.
  - Panel: the 'presets' section and cards (:326-342, 673-683, 1173-1175, 1553-1567, 1653-1663, `word('presets')`).
  - filters-button.ts:111-112, quick-filter's #given(), bind-source's presets pass, and the keeper's preset reason (provider-page.ts:452).
- Elsewhere: the bench fakes' presets and the MCP's preset check (it now checks savedFilters' scopes and `where`).
- TRAPs:
  - Retired: T-a-saved-filter-is-its-readings, T-a-saved-chip-lists-its-conditions, T-a-view-keeps-the-saved-filter-chips, T-a-toggle-is-a-clause-not-a-value and T-a-chip-with-no-field-is-a-preset.
  - Rewritten: T-saved-filters-are-every-scope, T-saved-filters-are-the-last-section, T-one-walk-counts-and-limits-in-order and T-one-way-to-write-a-condition.

WHAT THIS TAKES OUT OF THE 366 PLAN:
- §3 loses the library, preset(), setPreset, declarePreset and commit({scope, preset}).
- §5 loses the {preset, on} requests from the bar and the panel.
- §6 loses QueryState.presets.
- Checker findings that disappear:
  - commit 14's page-definition.ts:108 answer() caller
  - answerScope's teaching (:2303)
  - take() reading an unknown id as a field
  - the saved:<id> parts in commit 1
  - D3

WHAT WILL LOSES (named, so he can choose B):
- Two page toggles ANDing as sealed chips. Applying "At risk" over Status=Active in the data scope now clears Status.
- The per-preset counts (TODO 166).
- The read-only condition card (TODO 49/181). Nothing is sealed any more, so the field chips show every condition.
- A View turning a preset on by id. Demos' "risk" View inlines `health: {band: "At risk"}` in its `where` instead.

## The options it gave

- **A: one kind, it LOADS** (its pick; Will picked A): Every saved filter, the page's or the reader's, is {label, query: QueryDefaults}. Applying one hands its query to the QueryContext's one whole write (setQuery of mergeSet): each scope it names takes its filters, and they show on the ordinary field chips. Dismiss puts back what was there before. The Query names no saved filter, so there is no library, no preset steps and no D3. Page toggles, their counts and their cards go.
- **B: one shape, it TOGGLES**: Every saved filter is {label, query: QueryDefaults} in ONE library held by the QueryContext. The Query says which are on, and while one is on the context ANDs the `where` of each scope it names into that scope. A reader's set becomes a sealed toggle too: applying it no longer rewrites the chips, Dismiss is just off, and ` *` edited and `before` go. This keeps toggles, counts, cards and D3 A, but the Query still points at a library outside itself.

## Its first commit order (superseded by the revised plan)

- Revised order: S1-S3 land FIRST. They delete the preset surface that 366 commits 1, 7, 10, 12, 14 and 17 would otherwise move into the QueryContext.
- S1 page(366): a page's saved filters are query definitions, listed and applied with the reader's. Adds PageDefinition.savedFilters and SavedFilter in query.ts. Drops source.presets and scope.presets from page-definition.ts and the schema (the openSource lines 78-88 and 108 go). ProviderPage gets library = page + reader, `own`, and refusals on Delete and save-over. The MCP's validate_page and the records fixture change. Twin changes: Demos records.json and the risk View inline `where`, Starter records.json. Proof: npm test in 3 engines plus node; Demos (coordination, panel-apply, chip-results, nav-view-hierarchy, saved-filter, and the At risk View specs updated to a Health chip); Starter boots; check:bench IDENTICAL (off presets count nothing), recording any fall; check:mcp-pack.
- S2 ui(366): no control draws a saved-filter chip. Deletes saved-filter-menu.ts, the toolbar's and panel's preset code, quick-filter's #given, filters-button.ts:111-112, FilterDef readings and says, the bar event's `presets` and the bind-source pass. The bench fakes drop presets. Proof: spec:check, manifest and reference regenerated; the toolbar, panel and filters-button specs; parity-sweep; Demos green; check:weight and check:size fall, recorded.
- S3 data(366): the Query names no saved filter. ScopeQuery.presets, suspended.presets, the library, declarePreset, preset, say, presetClauses, the preset OrderEntry and walk steps, SourceState.presets and the answer* preset paths go. definitionOf drops unknown keys and reports `unknown-scope-key`. Proof: the 24 preset test files are ported or deleted (a-saved-filter-is-its-readings and a-bar-report-never-rewrites-a-saved-filter go); check:bench IDENTICAL or falling, recorded; check:traps retires 5 TRAPs and rewrites 4; check:map.
- 1 data(366): the doors no page uses go: named parts and the unscoped bar. The saved:<id> parts went in S3; port the 8 unlisted tests the checker named.
- 2 data(366): the hand-set filter and setState go. Keep setState until 5 gives sortSuspended a door, and keep a page restore.
- 3 data(366): a reading is copied in and frozen out (finish 319). The library is gone, so this covers only select, write, declareDefault, setQuery and commit copies.
- 4 data(366): a hold or a move recompiles, and a raise re-reads the unpaged rows.
- 5 data(366): sort, group and search are in the Query. Also change #walkKey and prune(), as the checker found.
- 6 data(366): QueryContext, a context of one. It has no saved-filter library.
- 7 data(366): the Query's reads and declarations are the context's. There is no preset(), and no declarePreset to carry.
- 8 data(366): the Query's edits are the context's; members hear each change directly.
- 9 data(366): one event, query-change, from the context.
- 10 data(366): one-field doors, and steer routes a request. There is no setPreset and no {preset, on}.
- 11 data(366): a superseded chip's own answer is in the Query (D2 A).
- 12 panel(366): one request per act. There is no 'presets' pseudo-field left to convert.
- 13 toolbar(366): a bound bar paints from its live slice, and every chip is locked.
- 14 toolbar(366): a bound bar sends one request per act, and the whole answer goes. page-definition.ts:108 already went in S1.
- 15 grid(366): a bound heading asks, then is drawn.
- 16 provider(366): the provider holds the Context's QueryContext. ProviderState v2 is {v: 2, view?, query}, and applyFilters and dismissFilters write through query.setQuery.
- 17 data(366): several sources share one QueryContext. D3 is moot: a reading on a field a source lacks is skipped by `has`.
- 18 docs(366): one Query per app Context. PAGE-DEFINITION, APP-GUIDE and DATA-SOURCE-RULES teach `savedFilters`.
