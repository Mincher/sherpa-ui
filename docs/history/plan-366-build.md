# 366 — the build plan

Read-only plan, 2026-10-20. It folds in the saved-filter design
([plan-366-saved-filters.md](plan-366-saved-filters.md)), Will's rulings, and
every finding of the two checks of [plan-366-design.md](plan-366-design.md).
Line numbers are from the HEAD the run read; check each one when you build.

## Will's rulings it builds on

- 366 B: one QueryContext per app Context holds the only Query.
- D1 A: one Apply for the whole Context when a source is remote.
- D2 A: a superseded chip's own answer is kept in the Query.
- A saved filter is ONE query definition. Picking it LOADS its fields, values
  and on/off into the ordinary chips. No saved-filter chip anywhere.
- All filtering, grouping and sorting feed the QueryContext; it tells every
  component; every input that shows a Query value follows it, hidden too (377).

## Questions for Will

### There is no Saved chip now. How do Save and Delete know which saved filter to use?

- **A: by match**: The Filters menu ticks each saved filter whose filters are on screen now. There is one Save, and it always asks for a name. A name you already used asks before it replaces. Delete deletes a ticked filter of your own. The tab keeps nothing.
- **B: last applied**: The tab keeps the last saved filter you applied. Save saves over it, also after you change the chips. Delete deletes it. One per-tab key stays.

Pick: A: by match
**Will: A, by match.**

### You apply a saved filter. What happens to a scope that it does not name?

- **A: keep it**: That scope keeps its chips and values, as today (TODO 105). In a scope that the filter names, a field it does not name is cleared.
- **B: clear it**: Every scope matches the saved filter exactly. A scope it does not name is cleared.

Pick: A: keep it
**Will: B, clear it.** Every scope matches the saved filter exactly.

### A saved filter is ticked in the Filters menu, and you untick it. What happens?

- **A: nothing**: Nothing changes, and the row is ticked again. It stays ticked while its filters are on screen. To change the filters, change the chips.
- **B: clear**: The filters of the scopes it names are cleared.

Pick: A: nothing
**Will: B, clear.** Unticking clears the filters of the scopes it names.

### TODO 320 waits for your test run and for 302 and 311. Commits 20-22 do 320's work. What do we do?

- **A: 366 does it**: Commits 20-22 do 320's work now, and 320 closes with 366.
- **B: wait**: Commits 20-22 wait for your test run and for 302 and 311. S1 to 19 go first.

Pick: A: 366 does it
Not asked yet: it matters only at commit 20.

## Commits

### S1 provider(366): no Saved chip. A saved filter loads, the Filters menu ticks each one on screen, and Save asks for a name

ProviderPage (src/components/sherpa-provider/provider-page.ts):
- Delete these: #savedSet, #putOn and #edited (:261-275); dismissFilters (:225-236) and its filters-dismiss listener (:143-145); begin()'s loadApplied read (:102-105); `before` (:219); and the `savedFilters` getter (:249-252).
- applyFilters(id) becomes flush, then source.setQuery(mergeSet(applied, set.query)) (:214-223). It keeps nothing.
- saveFilters(label: string) needs a name; the no-name path (:200) goes. A name that is already used replaces that set (labelId).
- deleteFilters(id: string) needs an id.
- New #matched() gives the ids of the sets whose filters are on screen. It uses sameFilters over the scopes each set names (saved-filters.ts:85-91). Each set's `where` is normalised once, through source.readingsOf then source.whereOf (data-source.ts:1003-1010), and cached by id plus JSON. The screen's side is viewQueryOf, memoised on JSON.stringify(source.query.applied). Nothing runs while no set is saved.
- savedFilterSets becomes {id, label, on}[].
- #saySaved (:278-289) marks `on` for each set that matches.

saved-filters.ts: delete ON_PREFIX, AppliedFilters, loadApplied and keepApplied (:39-40, :93-118), and their Map lines.

sherpa-provider.ts: delete dismissFilters (:446-448) and savedFilters (:456-458). saveFilters takes (label: string) and deleteFilters takes (id: string).

filters-button.ts SavedSets (:150-208):
- It loses #chip and draw(). SavedSet loses `edited`.
- pick() applies only a row newly ticked against what it was told (as OneRows.flip, :233-237). An untick does nothing.
- New follow(menu) re-ticks the matching rows after each Apply (as OneRows.follow, :240-252).

more-menu.ts saveRows (:57-61) becomes [['filters-save'], ...(on ? [['filters-delete']] : [])]. sherpa-filter-more.html loses the filters-save-as row (:13), and :12 reads 'Save filters…'.

Toolbar:
- Delete .saved-zone and .saved-chip (html:102-105, part `saved`), css:189-191, the data-saved prop (ts:102), :320-321, the draw at :1108 and the dismiss branch at :1654.
- Delete html:46, :69 (filters-dismiss) and :71 (filters-save-as), and case :1596.
- html:70 says filters-save asks for a name. filters-delete sends the first matched id (:1600). saveRows takes the `on` of a matched set (:1626).

Panel:
- Delete .saved-chip (html:128-129), the data-saved prop (ts:141), :211-212, :225 and the dismiss branch at :1645.
- Delete html:41, :62 and :64, and the 'Save filters as' row (html:111).
- .save-delete and .save-more show on a private :state(saved-on) (css:39-41; T-private-state-is-a-custom-state). :1752-1753 lose filters-save-as.

Twin change: Demos app/index.html:443-476 (one filters-save handler, as in changes).

Docs: APP-GUIDE.md:285-305 (served).

TRAPs: rewrite T-saved-filters-are-every-scope (docs/TRAPS.md:14999) and the 'unticked, it is dismissed' line of T-saved-filters-are-the-last-section (:15041-15064).

**Tests:** Written first. Both FAIL today:
- test/e2e/reforged-provider-saves-filters.spec.ts: 'with sessionStorage cleared, a reload ticks the set whose filters are on screen'.
- 'an untick leaves the row ticked and the filters as they are'.

Port:
- reforged-provider-saves-filters.spec.ts, all 4 tests. chip() (:33-36) becomes the row tick plus savedFilterSets. :63-66 saves again by name. :82 expects the row ticked again. 'an edit marks it' becomes 'an edit unticks it'. The Dismiss steps (:106-118) go. The heard list (:192-195) drops filters-dismiss and filters-save-as.
- test/unit/parity-sweep.test.mjs:91-92 (savedFilters goes; savedFilterSets says `on`).
- test/unit/every-emitted-event-is-in-its-spec.test.mjs: must stay green.
- Demos test/e2e/reforged-saved-filter.spec.ts tests 1-2 (:16 the Provider type, :43-44 chip(), :77 the Save row, :86-100 the cross).

After a build, run Starter (the-starter-boots.spec.ts, the-starter.test.mjs) and Gallery (npm test).

**Gates:** - Peer gate (see changes).
- check:bench IDENTICAL. No act runs a provider. The toolbar and panel specs the fakes read lose only a prop, an event and a part.
- spec:check for the toolbar, panel AND provider, then npm run manifest and npm run reference.
- check:props, lint:css, check:ownership.
- check:size and check:weight FALL; record the fall.
- test:a11y: run test:a11y:update only on a fall.
- check:traps, check:docs.
- check:map: provider-page.ts, saved-filters.ts, filters-button.ts, more-menu.ts, sherpa-provider.ts, the toolbar, the panel.
- npm test in 3 engines plus test:node. Demos npm test after a build, never during a full run.

### S2 page(366): a page's saved filters are query definitions, listed and applied with the reader's

Types and exports:
- query.ts gains SavedFilter {label; query: QueryDefaults}, moved from saved-filters.ts:24-27, which imports it.
- data.ts exports the type. app.ts:38 drops it (index.ts has `export *` from both).

page-definition.ts:
- Add PageDefinition.savedFilters?: Record<string, SavedFilter> at the top level (:56-63).
- Delete ScopeDefinition.presets (:24-25) and SourceDefinition.presets (:49-51; this removes the only citation of T-a-toggle-is-a-clause-not-a-value).
- Delete openSource's declarePreset loop and 'preset-without-where' (:78-88), and the answer() call at :108.

schemas/page.v1.json: drop :44-48, :98 and :120-130, and add savedFilters.

sherpa-provider.ts open() (:286-304): OpenedPage gains savedFilters. An entry that is not {label, query v1} is reported as 'saved-filter-invalid' and left out.

ProviderPage:
- The library is {...page.savedFilters, ...loadSavedFilters(page)}, as viewLibrary is (persist-view.ts:515-517). A reader's set under a page id is the reader's own.
- savedFilterSets gains `own`.
- saveFilters(name) makes the name unique against the page's own labels (uniqueViewLabel, as at :154).
- deleteFilters refuses a page's own. #matched includes the page's own.

filters-button.ts SavedSets.listed (:181-184): lists the page's own always, and the reader's only on a data-saveable host. saveRows offers Delete only while a set of the reader's own matches.

MCP validate_page (mcp-server/tools/data.js:816-835) checks savedFilters: v1, the scopes exist, each `where` parses, and a field not in `fields` is noted.

Docs: APP-GUIDE.md:179-181 (the example page) and :248 (a View's JSON has no `presets`), and PAGE-DEFINITION.md.

Twin changes:
- Demos app/view-schemas/records.json:41 and :44-48.
- Demos app/views/records-views.json:28: health:{band:'At risk'} joins that View's data `where`.
- Demos app/index.html: the 'taken' check (:450) looks only at own sets.
- Demos perf/inp.mjs:14 and :24, and perf/profile.mjs:16.
- Starter template/view-schemas/records.json:16-20.
- test/unit/fixtures/records.page.json:38-48: the presets become top-level savedFilters.
- scripts/check-bench.mjs:
  - The report act sends REPORT only (:226, :234).
  - The fake's presets line goes (:213).
  - A new act, 'apply-saved', goes LAST in MAIN. It does setQuery(mergeSet(applied, fixture.savedFilters['at-risk'].query)), with mergeSet taken from the bundled src/core/data/query-edits.ts.

**Tests:** Written first, and FAILS today: in reforged-provider-saves-filters.spec.ts, 'a page's own saved filter is listed on an unsaveable bar, applies into the field chips, is ticked while it matches (its band normalised), and cannot be deleted or saved over'.

New: test/unit/the-mcp-data-tools.test.mjs runs validate_page with good and bad savedFilters through a fake server.

Port:
- test/unit/page-definition.test.mjs: :27 (the fixture against the schema), :78-100 and :146-147. Delete :287-318.
- test/unit/one-way-to-write-a-condition.test.mjs:115-130 ('preset-without-where' becomes 'saved-filter-invalid').
- test/unit/a-chip-counts-within-the-filters-before-it.test.mjs:25-41 and :69-70 (delete the preset case; TODO 166 is retired).
- Demos reforged-chip-results.spec.ts:29 ('at-risk' becomes 'health').
- Demos reforged-panel-apply.spec.ts:28-40 (apply 'At risk' from the Saved section, then the Health chip).
- Demos reforged-filter-coordination.spec.ts:160-171 and :237 (apply 'Has open tickets', then the openTickets chip).
- Demos reforged-saved-filter.spec.ts:145-170: delete.

Must stay green: Demos reforged-nav-view-hierarchy.spec.ts:86-89, reforged-nav-favorites-recents.spec.ts:387-408, Starter (both), Gallery.

**Gates:** - Peer gate.
- check:bench MOVES. Record it on purpose with the reason 'a saved filter is a whole write, not a toggle'. These acts FALL: open on records, remote, rest and notheld (3 fewer declarePreset recomposes and clones, and no answer() at page-definition.ts:108). report and every later act on those pages move, because At risk is no longer ANDed in. apply-saved is new. A rise in loads or clones anywhere else is a bug.
- spec:check for the provider (savedFilterSets' type), then manifest and reference.
- check:size and check:weight: record them.
- check:mcp, check:mcp-pack, check:docs, the-package-ships-its-schemas, the-package-surface.
- check:traps: retire T-a-toggle-is-a-clause-not-a-value. Update T-a-page-is-its-definition and T-one-way-to-write-a-condition.
- check:map: page-definition.ts, query.ts, provider-page.ts, saved-filters.ts, filters-button.ts, data.ts, app.ts.
- npm test, then Demos after a build, then Starter and Gallery.

### S3 data(366): the Query names no saved filter

query.ts:
- Delete ScopeQuery.presets (:53-54). suspended becomes {fields} (:61-63).
- Delete CompileFacts.preset (:92-93), presetClauses, the preset loop in scopeClauses, and 'unknown-preset'.

query-edits.ts:
- Delete the preset branches in prune (:48), keepOff (:63, :81, :87-92), definitionOf (:281-288) and answersOf (:318-323).
- definitionOf copies only ScopeQuery's own keys. Any other key, such as a stored `presets` in a set, a View, a draft or a kept Query, is dropped with ONE 'unknown-scope-key' report (D4).

source-counts.ts: delete the preset OrderEntry (:41-42, :52-58), the presets parameter of answerOrder, WalkFacts.presets (:92) and the preset steps (:123, :138-144).

data-source.ts:
- Delete #presets and #presetFacts (:202-203, :215-216).
- export and import lose the presets map (:310-317, :326-328).
- Delete these: answered's preset test (:370), answer's presets parameter (:699-715), declarePreset and preset (:717-742), describe's preset HeldFilters and offers (:770-776, :780, :798-801), say and #says (:828-837), #setPresets and the 'presets' branch of answerScopes (:840-856).
- Delete the preset branches of #take (:874-885), release (:935-945) and suspendScope (:1208, :1219).
- Delete debugState.presets (:1413), the compile fact (:1475), the walk fact (:2012), answerScope's presets and its library teaching (:2293-2312), and answerUnscoped's saved:<id> parts (:2335-2346).
- The doc at :2331 cites only T-a-filter-report-is-the-whole-answer.

Types (data-source-types.ts): SourceState becomes {v:1, query} (:91-95). Delete HeldFilter.active (:101-102) and FieldFilter.readings and says (:81-85).

bind-source.ts:210, :219-229: stop passing presets.

Docs: DATA-SOURCE-RULES.md:268 (declarePreset and preset(id) go), and QUERY-DESIGN.md:84 and :117.

**Tests:** Written first, and FAILS today: test/unit/a-saved-filter-is-a-query.test.mjs. setQuery with scopes.data.presets:{x:true} keeps no `presets` key, and reports 'unknown-scope-key' once.

Delete: test/unit/a-bar-report-never-rewrites-a-saved-filter.test.mjs, test/unit/a-saved-filter-is-its-readings.test.mjs, and test/e2e/reforged-saved-filter.spec.ts:37-75.

Port:
- every-declare-reads-back.test.mjs: delete :14-31.
- a-count-runs-again-only-when-something-moved.test.mjs:62-67 (use declareSets).
- filter-face.test.mjs:95-100 (source.say goes).
- headless-data-layer.test.mjs:960-995 and :1090.
- page-definition.test.mjs:238-244.
- query.test.mjs:87-91 and :225-230.
- a-walk-reads-only-what-it-names.test.mjs:30-37 and :95.
- filters-limit-in-order.test.mjs:34, :51, :55, :61 and :85-88 (answerOrder(q, sets, scope)).
- the-walk-holds-under-change.test.mjs:186.

Demos needs no change; no page has a preset after S2.

**Gates:** - check:bench IDENTICAL. After S2 no bench page declares a preset.
- check:size FALLS; record it.
- check:traps: retire T-a-view-keeps-the-saved-filter-chips (query-edits.ts:283). Rewrite T-one-walk-counts-and-limits-in-order and T-the-filter-switch-keeps-what-it-turned-off.
- check:docs.
- check:map: data-source.ts, query.ts, query-edits.ts, source-counts.ts, data-source-types.ts, bind-source.ts.
- lint, type-check, npm test, Demos, check:mcp-pack.

### S4 ui(366): no control draws a saved-filter chip

Delete src/core/ui/saved-filter-menu.ts whole.

Toolbar:
- Delete the imports (:16-17), #isSaved (:958-960) and its uses (:239, :368, :403, :679).
- Delete the readings-def branch (:756-761), #addSavedMenu, #drawSaved and #savedHost (:928-956), and the presets getter (:1237-1246) with its emit (:1133).
- Delete the preset code in drawScope and the redraw (:1253, :1349-1363, :1384-1385), the saved order in addFilters (:1505-1513) and the Saved-section split (:1419, :1464).
- Delete the saved-menu and saved-field templates (html:213-221).
- #setChipActive stays for the suspended path (:625); fix its doc (:455).

Panel:
- Delete the 'presets' section and the pseudo-field (:328-344, :454, :476-477, :525, :637-638, :675-709, :767, :779, :1053, :1075, :1123-1142, :1175-1177, :1199-1202, :1555-1575, :1655-1665).
- Delete html:213-221 and the 'presets' word.

quick-filter: delete #given() (:779-783) and its uses (:739, :772). The data-kind doc changes (html:77-82).

Other sources:
- filters-button.ts: delete :107-112 and ListedFilter.readings (:54-55).
- filter-def.ts: delete readings and says (:78-82), preset (:91-93) and the note at :29-32.
- filter-kind.ts:48. filter-state.ts:415 is re-cited to T-saved-filters-are-every-scope.
- filter-face.ts: delete sayReadings, SaidField and conditionLines (:155-200), and their exports (data.ts:252-256). sherpa-menu.css:380-381 and sherpa-menu.html:92's menu-line words go.
- scripts/check-bench.mjs: delete the control() fake's presets (:146-155, :176-178).
- test/e2e/harness.ts:105.

**Tests:** Delete the rest of test/e2e/reforged-saved-filter.spec.ts (:80 to the end).

Port:
- reforged-filter-panel-component.spec.ts: :22-23, :51-93, :263, :303-322, :326-357, :429 and :470-471.
- reforged-panel-filters-button.spec.ts: :12, :26-27, :37, :118, :127, :134-160, :269, :289, :323 and :334-385.
- reforged-one-filters-button.spec.ts: :29, :76, :92 and :205-236 (delete the card test).
- reforged-filterset.spec.ts:61-100 (SAVED defs go).
- parity-sweep.test.mjs:75.
- filter-face.test.mjs:69-100 (keep only the fieldState cases that are left).
- date-conditions.test.mjs:83 (conditionLines goes).
- The unit fakes' `presets`: a-change-walks-again-only-for-what-it-moved.test.mjs:26 and :30, a-field-counts-unique-rows.test.mjs:26 and :33, a-serial-set-chains-its-fields.test.mjs:32 and :40, present-limits-each-field.test.mjs:34 and :42, and the-walk-holds-under-change.test.mjs:32 and :36.
- Demos reforged-filter-coordination.spec.ts:96-98 (bar.presets).

Gallery and Starter must stay green.

**Gates:** - Peer gate on sherpa-quick-filter.ts.
- check:bench IDENTICAL; the fakes' presets have been {} since S2.
- spec:check, manifest and reference for the toolbar, panel, quick-filter and menu.
- check:props, lint:css, test:a11y (record only a fall).
- check:weight and check:size FALL; record them.
- check:traps: retire T-a-saved-filter-is-its-readings, T-a-saved-chip-lists-its-conditions and T-a-chip-with-no-field-is-a-preset, once every citation listed in changes has gone. Rewrite T-saved-filters-are-the-last-section.
- check:map: every file listed above.

### 5 data(366): the doors no page uses go: named parts and the unscoped bar

Delete these:
- #parts (data-source.ts:186), contribute (:538-541), contributions and contribution (:655-662), and apply (:678-692). answer (:706) inlines its loop.
- answerUnscoped (:2332-2346), with Bound.answered and Bound.saved (source-binding.ts:54-57).
- #parts in #compileNow (:1456-1458), #walkKey (:1988) and debugState (:1415), and WalkFacts.parts (source-counts.ts:101-102; data-source.ts:2017).
- this.#parts.clear() in setState (:412) and setFilter (:520), and setFilter's citation of T-contribute-beats-last-writer (:518).

Also:
- steer's unscoped branch (bind-source.ts:228-229) reports 'bar-without-scope'.
- bindSelection (bind-selection.ts:112-116): a component-reach bind with no `only` reports 'component-reach-without-only' and binds nothing. The default view reach is unchanged.
- Selector (:28-40) has REQUIRED select, selection, declareValues, write, reading and holds, and no contribute. sherpa-provider.ts:842 drops `as unknown as Selector`. Its no-host case (:851) reports.
- Panel html:18 binds with scope ['view','data']. Fix the toolbar comment at :1161.
- Docs: DATA-SOURCE-RULES.md:269 and QUERY-DESIGN.md:290-292 (apply).

**Tests:** Written first, and FAILS today: in a bind-source unit test, 'an unscoped bar's filter report is reported, never applied'.

Port the 7 .contribute( files to write() or declarePart, or delete:
- a-chip-counts-within-the-filters-before-it.test.mjs:91
- bind-selection.test.mjs:132-136 (and its fakes gain every Selector door)
- headless-data-layer.test.mjs:428-490
- field-selection.test.mjs:80
- a-serial-set-chains-its-fields.test.mjs:86 and :102
- every-declare-reads-back.test.mjs:58-63
- one-query-builder.test.mjs:84-102

Also:
- query.test.mjs:44 and :234.
- one-query-builder.test.mjs:45-58 and :60-76 (scope:'view').
- reforged-filter-scope.spec.ts: delete :40-148; rewrite :182-200 to the report; :296 drops d.parts. New: two legends with `only`, each narrowing its own chart.
- scope:'view' for the unscoped bars: reforged-number-advanced.spec.ts:83-95, reforged-number-filter-reports.spec.ts:176-183 and :251, reforged-data-source.spec.ts:389-428, and :616-700 (the grid at :638 gets scope:'data').
- reforged-data-source.spec.ts:165-200 and :570-590 are sort-only; just run them.

Demos, Starter and Gallery use none of these doors; run them.

**Gates:** - check:bench IDENTICAL (the bench bars are scoped; there are no parts).
- spec:check and reference for the panel (the html:18 example).
- check:size FALLS; record it.
- check:traps: retire T-contribute-beats-last-writer and T-parts-order-must-be-stable.
- check:map: data-source.ts, source-binding.ts, source-counts.ts, bind-source.ts, bind-selection.ts, sherpa-provider.ts.
- type-check, npm test (3 engines plus node), Demos after a build.

### 6 data(366): a reading is frozen in the Query (finish 319)

query.ts gains freezeReading(r), a deep freeze of the answer keys. It uses no structuredClone.

One pass over both copies' readings at the end of #recompose and of setQuery covers every write:
- select (:1126) and write (:566)
- declareDefault (:618-638)
- setQuery (:393-394)
- commit (:1537; copyField query-edits.ts:190, copyScope :197)
- keepOff (:84) and suspendScope (:1216-1217)
- definitionOf (:247, :270)

select and write deep-copy the caller's reading on the way in.

reading() (:646-649) and defaultFor() (:640-643) hand out the frozen original. Their callers outside data-source.ts are bind-selection.ts:135, :150 and :178, which only read or spread the result.

Sweep the callers that edit what they read: sherpa-data-grid.ts:835, :877, :995 and :1047 (the peer's uncommitted edit may move these), sherpa-filter-panel.ts:601, and bind-selection.ts:135, :150 and :178.

Docs: DATA-SOURCE-RULES.md:274 ('each read-back is a copy' becomes 'frozen').

**Tests:** Written first: test/unit/a-reading-is-frozen-in-the-query.test.mjs.
- After select with condition rows, a change to the caller's rows leaves query.applied as it was. This FAILS today.
- After setQuery, after a remote commit() and after the Switch goes off, a write to what supersedeColumns handed out throws. All three FAIL today.
- reading() returns the same object twice.

Port every-declare-reads-back.test.mjs:45-54: defaultFor returns the same object, and a push throws a TypeError.

Must stay green: grid-keeps-both-answers, both-answers-are-kept, both-shapes-are-kept, reforged-data-grid.

**Gates:** - Peer gate on sherpa-data-grid.ts.
- check:bench: loads and compiles IDENTICAL. Clones are identical or FALL; record only a fall.
- check:size grows; record it.
- check:traps: update the 319 TRAP text.
- check:map: query.ts, data-source.ts.

### 7 data(366): a hold or a move recompiles, and a raise re-reads the unpaged rows

- hold() (data-source.ts:1274-1300) and move() (:1373-1397) call #recompose when a home moved. Today the bar's re-report hides this (source-binding.ts:252).
- declareField, declareValues and declareFromRows (:955-995) recompose when the Query answers that field.
- When an unpaged or `into` bind exists, the load key (#stateKey :1642; the guard at :1680-1690) also carries the view filter and the scoped filters.

**Tests:** Written first:
- test/unit/a-raise-narrows-at-once.test.mjs (PLAUSIBLE that it fails today).
- A Query restored before declareFromRows compiles with the type read from the rows.

Must stay green: send-down, up-is-open-down-is-closed, Demos reforged-send-to-view-filters and chart-scope.

**Gates:** - check:bench: records/raise and remote/raise gain 1 compile. Record it on purpose with the reason 'hold recompiles'; commit 19 takes it back. Any other move is a bug.
- check:size: record it.
- check:map.

### 8 data(366): sort, group and a suspended sort are in the Query

- ScopeQuery gains sortSuspended (query.ts:64-67).
- definitionOf keeps the arrangement in its own scope (query-edits.ts:249-257).
- setSort, setGroup, resumeSort and clearSort (data-source.ts:481-516) write both copies. They write the scope given, else #arrangedIn() (:1045), else VIEW (:307). Writing one scope clears the others, and each fires scope-change.
- prune (query-edits.ts:45-53) keeps a scope that has sort, group or sortSuspended.
- #walkKey (:1985-1991) serialises the Query WITHOUT the arrangement.
- A pure arrangementOf(query) goes in query.ts. A change only to the arrangement compiles nothing.
- These #state readers move to arrangementOf: state (:291-293), atDefault (:356-361), answered (:365-366), totalPages (:465-478), groups (:1177, :1193), describe (:818-819), debugState (:1405-1407), #loadOptions (:1648), #ask (:1897, :1921, :1928), setPage (:1602), the change detail (:1934) and #boundView (:2382+).
- #state keeps page, pageSize and search. #arrange, #arrangedBy and export's put-back go (:304-308, :1518-1531).
- mergeSet keeps the arrangement of a scope it replaces. filtersOf drops sortSuspended.
- Reset to default resets the sort.
- DataSourceOptions.sort and group go (data-source-types.ts:174-180).

**Tests:** Written first:
- test/unit/the-arrangement-is-in-the-query.test.mjs: setSort lands in query.applied.scopes.data.sort, which FAILS today. A filter edit after a sort, in a scope that holds nothing, keeps the sort.
- Demos e2e reforged-a-reload-keeps-the-sort (PLAUSIBLE that it fails).

Port:
- suspended-sort.test.mjs (not :99-111; that waits for commit 11)
- a-scope-arranges-its-own-rows.test.mjs
- groups-are-a-data-concept.test.mjs
- reforged-data-source.spec.ts:186, :197 and :284 (options.sort)
- reforged-provider-saves-filters.spec.ts:74
- Demos reforged-reset-to-default (:89, :125), reforged-reset-at-default, records-persist and save-view

**Gates:** - check:bench: records/sort and remote/sort keep compiles 0 and scans 2. The reset act may move, because Reset resets the sort; record that with the reason. Everything else IDENTICAL.
- check:traps: T-group-and-sort-are-component-scope, T-a-suspended-sort-is-one-owners-job, T-a-reload-replays-the-readers-answers, T-reset-to-default-is-the-views-own.
- check:size: record it.
- check:map.

### 9 data(366): search is in the Query, with the arrangement, and the find box draws it

- setSearch (data-source.ts:1583-1588) writes both copies. Like sort, it writes the scope given, else #arrangedIn(), else VIEW. So Demos records-views.json:4, :16, :35 and :47 (search in `data`) are read where they are.
- definitionOf keeps search in its scope. #walkKey leaves search out. search no longer counts as arranging (query.ts:269). prune keeps a scope that has a search.
- #state keeps only page and pageSize.
- Twin change: Demos app/contexts/records.js:232-238 sets find.value from the Query's search on open and on each scope-change.

**Tests:** Written first:
- A unit test: a restored Query's search loads the searched rows.
- A Demos e2e: a reload keeps the find box's text and its rows.

Port the search cases in headless-data-layer.test.mjs.

**Gates:** - check:bench: the search act stays at 0 compiles and 2 scans. IDENTICAL.
- check:size: record it.
- check:map.

### 10 browser(366): a ViewSnapshot carries a query, and persistView keeps elements only

persist-view.ts:
- ViewSnapshot becomes {v: 2, query?: QueryDefaults, elements?} (:116-123).
- applySnapshot (:150-157) requires v === 2 and calls targets.source.setQuery(snapshot.query). Its target type is {setQuery(q): Promise<void>} (:136-146). A stored v1 is ignored whole (D4).
- captureView (:200-208) writes viewQueryOf(source).
- persistView drops the `source` option (:77-82) and the query half (:86). The `source` target stays, so it still saves the elements on 'change' (:96-100).

After this, setState has no src caller.

Twin change: Demos records.js:78-80 drops `{ source: false }`.

TRAP texts: T-restore-before-first-load, T-one-snapshot-not-a-key-per-concern and T-apply-degrades-never-throws.

**Tests:** Port reforged-view-definition.spec.ts:
- :80-171: setFilter at :114 becomes select('plan', ['Pro']), and the snapshot carries `query`.
- :229-317: `source:{filter, sort}` becomes `query:{v:1, scopes:{view:{where:{health:{lt:40}}, sort:[…]}}}`.
- :319-376: any snapshot.source.

Delete reforged-data-source.spec.ts:700-760 (persistView restoring a query).

Check reforged-idb-store.spec.ts:321.

**Gates:** - check:bench IDENTICAL.
- check:traps, check:map (persist-view.ts).
- check:weight (app entry).
- npm test, Demos.

### 11 data(366): the hand-set filter and setState go

Delete these:
- setFilter (data-source.ts:518-526) and DataSourceOptions.filter (data-source-types.ts:177-178).
- #filter (:261) and ViewState.filter (:157).
- The #viewFilter sentinel (:210, :419, :524, :1898, :1989, :2018, :2099) and WalkFacts.hand (source-counts.ts:103-104, :132).
- setState whole (:408-439).

onViewPicked's source type drops setState and makes setQuery REQUIRED (persist-view.ts:334-337). The clearAll path (:470-477) stays only for a View with no query.

The state getter stays read-only (Demos records.js:343).

MCP run_query (mcp-server/tools/data.js:250-460):
- `filter` keeps the store grammar and runs as store.load({filter, sort, search, skip, take}), as the aggregate branch does (:403-404).
- A new `where` input goes through a DataSource and setQuery.
- The printed code changes to match (:444-452). Update README:103 and DATA-SOURCE-RULES.

**Tests:** Port the setFilter calls to setQuery with `where`:
- reforged-data-source.spec.ts: all 15 sites
- reforged-idb-store.spec.ts:250
- a-request-back-to-the-last-answer-still-runs.test.mjs
- groups-are-a-data-concept.test.mjs
- headless-data-layer.test.mjs:72, :160, :165, :205, :209, :246, :262, :378, :410 and :479
- the-walk-holds-under-change.test.mjs

Port the setState calls:
- headless-data-layer.test.mjs:392, :415, :423, :492 and :573
- field-selection.test.mjs:138-141 (delete)
- summary-scope.test.mjs:53
- suspended-sort.test.mjs:99-111 (setQuery with sortSuspended)
- query.test.mjs:434-464

Also:
- value-types.test.mjs:73-86 moves to store.load({filter}).
- the-mcp-data-tools.test.mjs gains run_query with `filter` (or, a dotted path) and with `where`.
- Type-check the onViewPicked callers.

**Gates:** - check:bench IDENTICAL.
- check:mcp, check:mcp-pack.
- check:size FALLS; record it.
- check:traps: retire T-set-state-merges-page-last, and fix the citations of T-one-query-builder-in-the-data-layer.
- check:map.
- npm test, Demos.

### 12 data(366): QueryContext, the Query in a context of one

New src/core/data/query-context.ts, exported from data.ts. It holds:
- applied and draft
- the defaults, the scope registry and the part declarations
- the bind-id counter
- its members
It holds NO saved-filter library.

new DataSource({store, query?}). source.query IS the context.

join(member) returns a handle {live(), mintId(), showsRows(scope), bindOf(el), leave()}. The method bodies stay byte-identical.

arranges() falls back to 'a member shows rows in this scope' (:1036-1038).

The remote draft split moves from the constructor (:247) into join(). A remote member clones `applied` into a draft once, and never wipes a draft that exists. close() (:1780) calls leave().

eslint.config.js:75-90: a display component may not import query-context.js.

**Tests:** Every sherpa-ui, Demos, Starter and Gallery test passes UNEDITED.

New test/unit/query-context.test.mjs: a context with no source, and a remote join that splits the draft once.

the-package-surface lists QueryContext.

**Gates:** - check:bench IDENTICAL, clones included.
- lint, type-check.
- check:weight and check:size: record the growth.
- check:map.

### 13 data(366): the Query's reads are the context's

These move to QueryContext, and DataSource loses each name (there are no forwards): reading, scope, scopes, holds, scopeOf, fields, canHold, defaultFor, partFacts, scopeFacts, scopeLabel, arranges, sets, pending and dirty.

Selector (bind-selection.ts:28-40) is retyped: reading and holds come from the context. bind-selection.ts:125, :135, :150 and :178 move.

Callers: sherpa-provider.ts:757-774 and :828-868, provider-page.ts, scripts/check-bench.mjs, the tests and Demos.

Docs: DATA-SOURCE-RULES.md:262-271.

**Tests:** Port:
- both-answers-are-kept, both-shapes-are-kept, chart-scope, every-declare-reads-back, headless-data-layer, page-definition, query, scope-registry, send-down, up-is-open-down-is-closed
- a-scope-arranges-its-own-rows.test.mjs:37-42
- the e2e page.evaluate sites (grep)
- Demos: filter-coordination, send-to-view-filters, the-view-limits-a-component-scope, reset-to-default, view-drafts, panel-apply, and reforged-email-starts-simple.spec.ts:18
- parity-sweep KNOWN

New: query-context cases for each read.

**Gates:** - check:bench IDENTICAL.
- check:map, check:mcp-pack.

### 14 data(366): declarations are the context's, and members hear them

heard(change) lands here; the context calls each member synchronously. declarePart, declareDefault ({only} through bindOf), declareScope, declareSets and offer move.

Each follow-up runs in heard, in today's order:
- declarePart: :595-605
- declareDefault: :618-638
- offer: :1339-1352
- declareSets: :1053-1072
A `walk` flag moves #age only where it moves today.

Callers: page-definition.ts:91, :95 and :107; sherpa-provider.ts:772-773, :856 and :865.

**Tests:** Port:
- reforged-provider.spec.ts
- a-count-runs-again…, a-scope-arranges-its-own-rows, a-serial-set-chains-its-fields, a-store-has-one-cache, chart-scope, every-declare-reads-back, filter-face, groups-are-a-data-concept, headless-data-layer, present-limits-each-field, query, send-down, the-walk-holds-under-change, up-is-open-down-is-closed

**Gates:** - check:bench IDENTICAL. A move is a re-plumb bug: find it, do not record it.
- check:map.

### 15 data(366): the filter edits are the context's

Move select, write, hold, move, request, release, suspendScope, suspendSelection, commit and discard onto the context. They keep their names until commit 18. Each one edits the Query, calls heard on each member, and returns.

The handle narrows to a read-only live(). Field facts come from the first member that has the field.

Callers:
- bind-source.ts:241, :247, :250, :270, :271 and :284
- page-definition.ts:96
- bind-selection.ts:151, :157, :165, :178 and :192
- sherpa-provider.ts and provider-page.ts

**Tests:** Port:
- e2e: reforged-filter-scope, grid-keeps-its-heading, grid-select-all-pages, metric, number-filter-reports, provider-saves-filters, provider-summary, view-definition
- unit: a-count-runs-again, a-live-filter-waits-for-the-moves-to-stop, a-record-has-a-time-of-its-own, a-store-has-one-cache, a-threshold-is-a-fact-of-the-field, bind-selection, both-answers-are-kept, both-shapes-are-kept, chart-scope, date-conditions, field-selection, field-type, groups-are-a-data-concept, headless-data-layer, one-query-builder, page-definition, query, raw-data-is-untouched, scope-registry, send-down, up-is-open-down-is-closed, value-types
- Demos: the 9 select and 5 hold calls, and records.js

New: an edit on the context recompiles, reloads and redraws its source.

**Gates:** - check:bench IDENTICAL.
- check:mcp-pack, check:map.

### 16 data(366): the arrangement and the whole writes are the context's

- Move setSort, setGroup, resumeSort, clearSort, setSearch, setQuery, export and import together.
- SourceState is renamed QueryState {v:1, query}, with no alias: data-source-types.ts:91, data.ts:80, sherpa-provider.ts:28, :71 and :643.
- onViewPicked's targets.source becomes targets.query (persist-view.ts:334-337, :453-461), and so does applyViewSnapshot's target.
- viewQueryOf (:558) and ViewSource (:566-571) read source.query. Its callers: provider-page.ts:157, a-scope-arranges-its-own-rows.test.mjs:69, reforged-view-definition.spec.ts:605-616.

Other callers:
- provider-page.ts:170, :220, :314-315, :420-422 and :514-515
- sherpa-provider.ts:644 and :661
- bind-source.ts:197, :202 and :306
- MCP run_query's where path (data.js:338-347, :446-452)

Docs: DATA-SOURCE-RULES.md:337.

**Tests:** Port:
- mcp-server/tools/data.js, scripts/check-bench.mjs, the-mcp-data-tools.test.mjs
- e2e: reforged-data-source, grid-keeps-its-heading, provider-summary, view-definition, view-markup, reports-round-2
- unit: a-chip-counts-within…, a-count-runs-again…, a-failed-read-keeps-the-last-set, a-held-set-yields-when-it-cannot-answer:101, a-reopen-checks-behind:47 and :49, a-scope-arranges-its-own-rows, a-serial-set-chains-its-fields, a-store-has-one-cache, groups-are-a-data-concept, headless-data-layer, one-way-to-write-a-condition, page-definition, query, raw-data-is-untouched, scope-registry, send-down, suspended-sort, the-walk-holds-under-change
- Demos: setSearch and setQuery

**Gates:** - check:bench IDENTICAL.
- spec:check and reference for the provider if its export/import types are printed.
- check:mcp-pack, check:map.

### 17 data(366): one event, query-change, from the context

- The source stops firing scope-change and selection-change (data-source.ts:397, :399, :581, :1135, :1226, :1292, :1345, :1386, :1552). The context fires query-change {fields, scopes} after every member has heard.
- The listeners move: bind-selection.ts:183-184, provider-page.ts:117-131 and :451, and Demos records.js:232-238 (the find box from commit 9).
- #walkKey adds walkVersion, which moves only where #age moves today (:596, :724, :956, :969, :993, :1054, :1676, :1706, :1739), not on declareScope (:1021-1024).

**Tests:** Port:
- scope-registry.test.mjs:68-71
- up-is-open-down-is-closed.test.mjs:58 and :107
- field-selection.test.mjs:130

New case: declareScope moves no walk, and declareSets does.

Demos records.js:249 is the grid's own event; it stays.

**Gates:** - check:bench IDENTICAL.
- check:map.

### 18 data(366): one-field doors replace the edit doors

These replace the old doors; callers move and the old names go:
- setReading(scope, field, reading|null, {only?}) replaces select and write. answerColumn's hold-if-unheld (:2320-2327) lives here.
- suspend(scope, field|null, off) replaces suspendSelection and suspendScope. The toolbar's message at :1044 names source.query.suspend().
- take(scope, ids, from?) replaces request.

New: reset, batch, and commit({field}|{scope}). A request with the same answer is a no-op.

QueryRequest goes in query.ts, with `commit: true` for a bar's or a heading's act. steer routes detail.request, and filter-change (bind-source.ts:274-286) calls setReading.

bind-selection.ts and Selector move to setReading. Docs: QUERY-DESIGN.md:290-292.

**Tests:** Written first:
- one-field-requests
- an-echo-is-a-no-op
- a-bar-apply-commits-its-own-field. It FAILS on today's path (:2308).

Port every select, write, suspendSelection and request caller: commit 15's files, Demos' select() calls, and records.js.

**Gates:** - check:bench IDENTICAL.
- check:size: record it.
- check:map.

### 19 data(366): a superseded chip's own answer is in the Query (D2 A)

- ScopeQuery.superseded is added.
- Delete supersede's report() (source-binding.ts:252) and #lower's overwrite (data-source.ts:918-926).
- prune keeps a scope that has a superseded answer.
- viewQueryOf writes it in the where form, and definitionOf reads it back.
- filtersOf and mergeSet drop it.

**Tests:** Port:
- unit: send-down, up-is-open-down-is-closed, chart-scope
- Demos: raising-a-filter-carries-its-value, send-to-view-filters, the-view-limits-a-component-scope, reset-to-default (:89, :125)

New: release gives back the kept answer with no bar bound.

**Gates:** - check:bench: the raise compiles FALL (commit 7's +1 goes); record it.
- check:traps: T-a-superseded-chip-suspends-it-is-never-removed, T-send-to-view-filters.
- check:size, check:map.

### 20 panel(366): one request per act

- #report sends {scope:'panel', request:{scope, field, reading}}. Reset all sends one {reset:{organise:true}}.
- drawReading paints privately. setFieldReading sends a request when locked.
- Delete answerScopes and its 'bars last' order (data-source.ts:847-869), and #said.
- KEEP #early (367) and #reportSoon.

**Tests:** Port:
- reforged-filter-panel-component, panel-keeps-both-answers, panel-filters-button, panel-long-list
- reforged-advanced-condition-words.spec.ts:163
- headless-data-layer.test.mjs:987
- chart-scope.test.mjs:68-91 (the request detail)
- Demos: panel-apply, panel-keeps-both-answers, reset-at-default, send-to-view-filters, view-drafts

**Gates:** - Peer gate.
- spec:check, manifest, reference (the panel's event detail).
- check:bench: the panel acts expected IDENTICAL; record any move with its reason.
- check:size and check:weight.
- Gallery and Starter green.

### 21 toolbar(366): a bound bar sends one request per act; the whole answer goes

#emitChange sends {scope:'bar', request, values, active}. The chips are still unlocked.

What each act sends:
- Menu commit: {field, reading without suspended, commit}.
- Chip body: {field, suspended}.
- Switch: {suspended}.
- Clear all: {reset}.
- One-value Add: a list of requests.
- The handover (:1386-1391): a LIST of {field, reading}.

Delete these:
- steer's whole-answer path
- pickedReadings (bind-source.ts:218, :318-330) and its T-toggle-chips-have-no-field citation
- answer() (data-source.ts:699-715) and answerScope (:2290-2318)
- the bound #pendingAnswers and #keepAnswer

persist-view.ts:459 calls setChipValues. The bench fakes send requests.

**Tests:** Written first: a-rebuilt-bar-cannot-clear-a-field. It FAILS today (:703-704).

Port:
- send-down.test.mjs:71 and :112
- a-count-runs-again…:31 and :63
- a-store-has-one-cache.test.mjs:116
- query.test.mjs:171-180
- headless-data-layer.test.mjs:1022-1093
- the five fakes' report() (a-change-walks-again…:30, a-field-counts-unique-rows:33, a-serial-set-chains-its-fields:40, present-limits-each-field:42, the-walk-holds-under-change:36)
- reforged-data-source.spec.ts:389-428 and :616-700
- reforged-provider-summary.spec.ts:149-155
- every toolbar spec, parity-sweep
- Demos: chip-results, view-chips, limit-options, serial-account-set, filter-coordination, nav-view-hierarchy, view-link, records-persist

**Gates:** - spec:check, manifest, reference.
- check:bench re-recorded on purpose: compiles fall, and clones must not rise.
- check:traps: retire T-a-filter-report-is-the-whole-answer (data-source.ts:697, toolbar.ts:1131, reforged-data-source.spec.ts:388 all go).
- check:size.
- Gallery and Starter green.

### 22 toolbar(366): a bound bar paints from its live slice, and every chip is locked

- Lock every filter chip and organise chip in a bound bar (toolbar.ts:742-748). The bar stops writing data-current (:1897-1906, :1918, :254).
- #drawChip paints privately, and drawScope(desc, live) paints after its waits. A per-chip 'last painted' record is kept. Delete #edits, #editedAt and #edited.
- quick-filter.ts: a locked chip still syncs data-condition and data-filters-nothing (:697-700, :727-773). #arrange, #arrangeFromMenu and #applySort (:483-530) write no current or direction when locked. writeView draws them.

**Tests:** - Demos: reforged-a-stale-draw-keeps-the-bars-own-change, re-expressed. panel-apply:100 passes 10 times in 10 in each engine.
- New e2e: reforged-an-open-menu-keeps-its-draft.
- The toolbar organise specs, Demos view-chips sort, a-rebuild-keeps-every-answer, reforged-quick-filter-toolbar-state-first.spec.ts:73.

**Gates:** - Peer gate.
- check:ownership.
- spec:check, manifest, reference.
- check:bench IDENTICAL.
- check:traps: KEEP T-a-rebuilt-bar-reads-empty-until-its-menus-stamp (the unbound bar and sherpa-menu.ts:1163 still need it); rewrite it, and drop only the citations in deleted code.
- check:size.

### 23 grid(366): a bound heading asks, then is drawn

- When locked, #onColumnFilterCommit (grid.ts:825-880) writes neither #columnFilters nor #drawn.
- drawReading paints privately. When locked, the column doors emit column-filter-change.
- steer calls setReading, then commit({field}).
- Delete answerColumn (data-source.ts:2320-2327).

**Tests:** - reforged-data-grid, grid-keeps-both-answers, bind-selection.test, chart-scope.test
- Demos: view-chips, filter-coordination, chart-scope

**Gates:** - PEER GATE: sherpa-data-grid.{ts,css,html} and reforged-data-grid.spec.ts hold a peer's uncommitted work today. Do not start until that work is committed, or Will says.
- check:bench: the heading act is equal or lower.
- spec:check and reference if the text changes.
- check:size.

### 24 provider(366): the provider holds the Context's QueryContext; the keeper hears it

- open() makes a QueryContext and calls openSource(def, store, {query}) (sherpa-provider.ts:293). OpenedPage gains `query`.
- ContextInit.query is added (app-definition.ts:60-77).
- ProviderState v2 is {v:2, view?, queries:{name: QueryState}} (:642-665). A v1 import reports 'unknown-state'.
- Delete #writing, #quietly, #unquietSoon and the host quick-filter-change listener (provider-page.ts:438-453, :468, :483-497, :524-532). saveView (:168) and resetView (:313) call setQuery(q, {by:'provider'}). applyFilters passes by:'reader'. The keeper keeps reader changes, once a frame.

**Tests:** - reforged-reports-round-2.spec.ts:36-47 (a v1 import reports 'unknown-state')
- reforged-provider export and import, :171 and :202
- the-package-surface
- Demos: view-drafts, records-persist, saved-filter, reset-*, a-reload-shows-the-kept-rows
- New Demos e2e: a-change-right-after-a-pick-is-kept

**Gates:** - check:bench IDENTICAL.
- spec:check, manifest and reference for the provider (component.json:214-223; docs/components/sherpa-provider.md:56-57).
- check:traps: T-a-provider-keeps-the-views, T-a-page-goes-out-as-json.
- check:size, check:weight, check:map.
- Starter and Gallery green.

### 25 data(366): several sources share one QueryContext

- CompileFacts gains mine(scope) and has(field).
- has(field) = the declared fields, plus store.domains and store.time, plus the keys of loaded rows. It is true before the first load.
- scopeClauses and planWalk skip what is not mine and what a source lacks; each skip is listed in debugState().skipped.
- One definition per Context: a second openSource into a shared context is reported.
- The 'Views over ONE source' gate (sherpa-provider.ts:265-267) checks that every source shares one context.
- D3 is moot.

**Tests:** New test/unit/two-sources-one-query.test.mjs, with a lean-page View reading that must NOT be skipped.

Also reforged-provider.spec.ts:159-211.

**Gates:** - check:bench IDENTICAL on single-source pages.
- check:size, check:map.

### 26 docs(366): one Query per app Context

- QUERY-DESIGN rule 1 (:52-53): filters, sort, group and search are in the Query; page, pageSize, segment and aggregate stay with each source. §8 states the request protocol.
- Update PROVIDER-DESIGN, PAGE-DEFINITION, DATA-SOURCE-RULES and APP-GUIDE.
- New TRAPs: T-a-context-holds-the-only-query, T-a-control-sends-one-request, T-a-source-compiles-only-what-it-has.
- TODO 366 is marked ✅ and keeps its row.

**Tests:** None new.

**Gates:** check:traps, check:map, check:docs, spec:check, manifest, reference.

## Still open

- Q1 (by match) is my pick. Under it, a set that differs only in its holds, narrows or Switch list is still ticked, because sameFilters compares `where` (with off:true) only (saved-filters.ts:85-91). The builder says this in T-saved-filters-are-every-scope (S1).
- The memo key for #matched (S1) is JSON.stringify(source.query.applied). If Demos perf/inp.mjs shows it costs more than 5 ms at 4x, the builder keys it on the source's compile key instead, and says so.
- The bench's apply-saved act (S2) imports mergeSet from the bundled src/core/data/query-edits.ts. If check-bench bundles only src/data.ts, the builder exports mergeSet from data.ts (it is DOM-free), and the-package-surface lists it.
- test/unit/the-mcp-data-tools.test.mjs (S2) imports mcp-server/tools/data.js. zod resolves from the root. If lib/sherpa.js `at` cannot find dist/ from there, the builder runs the same calls inside check:mcp-pack instead.
- A saved filter may name a field that another scope holds now. mergeSet then holds it in both scopes (query-edits.ts:299-306). This already happens with a reader's sets. S2 adds a test, and reports 'a field held twice' if it shows.
- A legend's part scope in a saved filter or View names `bind-N` when the element has no id (source-binding.ts:94). That is today's behaviour, and 366 does not change it.
- persistView no longer keeps a Query (commit 10). A page with no provider loses its filters after a reload. The provider's keeper is the one door. This is a loss, said here.
- The page-last restore (T-set-state-merges-page-last) goes with setState (commit 11). A page that wants its page number back after a reload needs a new door, which is a later TODO.
- Under a provider, the grid's header filter row stays the grid's own (sherpa-data-grid.ts:155, :365). Only a hand bind writes it as a reading (commit 18).
- The bench numbers for S2's report act and the acts after it cannot be known before the run. The builder records them with --update-baseline and the reason, and checks that loads and clones do not rise.
- Demos' dashboard customer source stays private. Joining it is one line (dashboard.js:56), and that is Will's call.

## The last check: fix these when you build each commit

### verify:2:missed

- **unsafe:** S1: test/unit/every-emitted-event-is-in-its-spec.test.mjs:35-36 asserts bar.has('filters-save-as') and panel.has('filters-save-as'). S1 deletes that event (toolbar html:71 and case :1596, panel html:64 and :1752) but calls this test 'must stay green'. It fails. S1 must port :35-36.
- **unsafe:** S3 fails type-check. It deletes FieldFilter.readings/says (data-source-types.ts:81-85) and HeldFilter.active (:101-102), but the UI readers stay until S4. They are sherpa-quick-filter-toolbar.ts:1349-1350 and :1384 (scope.filters: HeldFilter[] from drawScope(scope: ScopeDescription), :1324) and sherpa-filter-panel.ts:779 (f: FieldFilter | HeldFilter). Also saved-filters.ts:88 (sameFilters reads scope?.presets on ViewScope, which loses `presets` when query.ts:53-54 goes) is in no commit's list, and S1's #matched depends on sameFilters. Either move these type deletions to S4, or move those lines into S3.
- **unsafe:** Commit 5: test/e2e/reforged-filter-scope.spec.ts:150-180 ('the default scope is VIEW') reads src.contributions.length (:172) and expects 0 (:179). That test is outside the deleted :40-148 and the rewritten :182-200, so it throws once `contributions` goes.
- **unsafe:** Commit 21 deletes the whole-answer path (bind-source.ts:218-225 → answerScope). Today that path carries a host's door writes on a bound (data-locked, bind-source.ts:71) bar to the Query through report(). No commit makes the toolbar's Ruling-B doors send their one request when bound: setChipReading, setChipValues, values= (and sherpa-app-header.ts:127-130, which passes it through) and filtersSuspended=. Commit 20 does this for the panel's setFieldReading, and commit 23 for the grid's column doors, but nothing does it for the bar. After 21, `setChip…()` then report() changes nothing. That breaks Demos reforged-panel-apply.spec.ts:106-119 and reforged-a-stale-draw-keeps-the-bars-own-change.spec.ts:22-23, neither of which is in 21's list. It also breaks Demos records-persist:188-200, chip-results:70-71, limit-options:23-24, serial-account-set:16-17 and view-chips:97/:384, and sherpa-ui reforged-number-advanced.spec.ts:87-95. Porting those tests does not keep Ruling B.
- **unsafe:** S2: Delete can name a page's own set. toolbar.ts:1600 and panel.ts:1753 send `this.#saved.on?.id`. toolbar.ts:1626 and panel.ts:1743 pass `!!this.#saved.on`, and the panel shows .save-delete on saved-on. After S2 the library is {...page.savedFilters, ...reader}, so the first `on` can be a page set. deleteFilters then refuses it, and Demos index.html's filters-delete confirms and then does nothing. S2 must use the first matched set with own:true at all four sites and for the panel state.
- **unsafe:** Gates the hook enforces are missing from commits 20, 21 and 23. Commit 20 deletes answerScopes. Its 'bars last' comment (data-source.ts:865-867) is the ONLY citation of TRAP T-a-bar-is-drawn-the-scope-as-it-ends, so check:traps fails. Its Map line (data-source.ts:45) also needs check:map, and neither gate is listed. Commit 21 deletes .answer and .answerScope, whose Map lines are data-source.ts:40 and :101, and lists no check:map. Commit 23 deletes answerColumn: its Map line (:102) and the TRAPS.md Site data-source.ts for T-a-heading-asks-through-the-source (:2319) must change, and it lists neither check:traps nor check:map.
- **wrong:** Commit 11 deletes ViewState.filter (data-source-types.ts:157) but also says 'the state getter stays read-only (Demos records.js:343)'. Demos app/contexts/records.js:343 reads source.state.filter for TODO 61's 'the filters on this page hide it' toast, and no Demos test pins that, so it would fail silently. query.test.mjs reads src.state.filter at :48, :136-137, :146, :151, :155, :172, :178, :182, :260, :280, :302, :313, :318, :386 and :409, and commit 11 ports only :434-464. Either keep ViewState.filter as the compiled output, or move those readers.
- **wrong:** S1 deletes saved-filters.ts ':93-118', but :93-98 is sortedJson, which sameFilters (:85-91) calls, and S1's #matched needs sameFilters. Delete only :40-41 (ON_PREFIX) and :100-118.
- **wrong:** The peer gate says it applies 'today' only to commits 6 and 23. git status now also shows peer edits in docs/TRAPS.md, docs/TRAPS-INDEX.md, docs/TODO.md, custom-elements.json, vscode.html-data.json, scripts/weight-baseline.json, src/components/sherpa-menu/sherpa-menu.ts and test/e2e/reforged-quick-filter.spec.ts. S1 already rewrites TRAPS.md, regenerates the index and the manifest, and records check:weight, so the gate applies from S1. Commit 22's sherpa-menu.ts:1163 citation is :1177 in the working tree.
- **wrong:** Some line citations are wrong. DATA-SOURCE-RULES.md: S3's ':268' is :270 (the declarePreset row), and commit 5's ':269' is :271 (the contribute row). Ruling B is at docs/TODO.md:1698 at HEAD (rows :1682-1683; :1809 in the tree), not :1731. TODO 320 is at :345 at HEAD (:350 in the tree), not :347. The Demos baseline is a949eed, not 5a84a7e (one commit later, which changed only reforged-records-details.spec.ts). The commit 6 sweep's 'sherpa-filter-panel.ts:601' is the '/* ── Drawing ── */' comment, not a site that edits a reading.
- **wrong:** 'the-package-surface test lists it' (the SavedFilter type, S2) cannot work. That test checks runtime names with `name in module` (the-package-surface.test.mjs:75-81), and a type is erased. Also, app.ts exports SavedFilter at :39, not :38.
- **wrong:** The bench open question is wrong. check-bench.mjs does not bundle src/data.ts: it bundles its own ENTRY (:41-47: openSource, ArrayStore, spoofRemote, onReport, bindSource). It also keeps only the fixture's `.source` (:198), so apply-saved needs an ENTRY line exporting mergeSet from query-edits.ts and a separate read of the page's top-level savedFilters.
- **wrong:** Counts and ranges in the port lists are off. reforged-data-source.spec.ts has 8 setFilter calls (:235, :272, :292, :372, :462, :464, :496, :714), not 15, and :714 is inside :700-760, which commit 10 deletes. S2's page-definition.test.mjs ranges :78-100 and :146-147 miss the asserts that fail: :106 ([['busy', false]]) and :148 (['p','a','b','c','d']).
- **missing:** Commit 5: the served DATA-SOURCE-RULES.md:365-378 ('The filter is NAMED PARTS') still teaches source.contribute (:370-373) and setFilter (:376-378). No commit names these lines; commit 11 says only 'DATA-SOURCE-RULES'.
- **missing:** Commit 24 adds ContextInit.query (app-definition.ts:60-77) but does not name its builder: sherpa-outlet.ts:382-384 (and the settings init at :286). The old design's 'the outlet passes it' was dropped.
- **missing:** Commit 16 moves setQuery off DataSource and retargets applyViewSnapshot to `query`. But persistView's restore at persist-view.ts:81 calls applyViewSnapshot(stored, targets) with targets.source, a DataSource. That call is not named.
- **missing:** S1 removes the Saved-chip lookup from SavedSets, but not its two constructor calls: toolbar.ts:562 and panel.ts:1770 (`new SavedSets(this, () => this.$('.saved-chip'))`).
- **missing:** S4 deletes saved-filter-menu.ts, but scripts/check-traps.mjs:103 still names 'saved-filter-menu' in the Filters area.
- **missing:** Commit 11 sends run_query's `filter` through store.load. That drops what only the DataSource gives: the group listing (mcp-server/tools/data.js:417-428 reads result.groups), totalPages and the page read-back (:351-358). The printed code (:444-452) must say this when `filter` comes with `group` or `page`.

### verify:2:refute

- **unsafe:** S1, and every commit until the peer's 373 work is committed. The peer gate is aimed at the wrong commits. The working tree holds uncommitted 373 edits in files that S1 must edit or regenerate: docs/TRAPS.md (+25 lines at :9959), docs/TRAPS-INDEX.md, docs/TODO.md, scripts/weight-baseline.json, custom-elements.json and vscode.html-data.json (git diff --stat). S1 rewrites a TRAP, runs manifest and records check:weight in exactly those files. Worse, .githooks/pre-commit:168 runs check:size over the WORKING TREE (no --staged). The peer's grid files are past their baseline: sherpa-data-grid.ts has 2346 lines against 2217 (scripts/size-baseline.json:21), .css 808 against 789 (:386), .html 258 against 253 (:464). So every commit is blocked until that growth is committed or recorded. `git add -p` is not available, so S1 cannot stage only its own hunks.
- **unsafe:** S1: test/unit/every-emitted-event-is-in-its-spec.test.mjs:35-36 asserts bar.has('filters-save-as') and panel.has('filters-save-as'). S1 deletes filters-save-as from both specs but lists this test as 'must stay green'. It fails, and needs a port (keep the emit-through-a-variable check on filters-save only).
- **unsafe:** S1 (PLAUSIBLE): SavedSets.follow(menu) is modelled on OneRows.follow, which returns at once while the menu is open (filters-button.ts:241). A committing sherpa-menu emits menu-change BEFORE hide() (sherpa-menu.ts:2005-2006) and has already re-based at :1999, and `open` is `:popover-open` (:1141-1143). So a follow called from #onAddCommit (toolbar.ts:1640-1680; panel.ts:1643) does nothing, and an unticked row stays unticked. The plan's own written-first test 'an untick leaves the row ticked' still fails. Follow has to run after the menu closes, or set values whether or not it is open.
- **unsafe:** S1: 'delete ON_PREFIX, AppliedFilters, loadApplied and keepApplied (:39-40, :93-118)'. saved-filters.ts:93-98 is sortedJson, which sameFilters (:85-91) calls, and #matched is built on sameFilters. Deleting the range as written breaks type-check and matching. The range is :100-118.
- **unsafe:** S3: type-check fails. S3 deletes FieldFilter.readings/says and HeldFilter.active (data-source-types.ts:81-85, :101-102) and ScopeQuery.presets (query.ts:53-54). Until S4, toolbar drawScope(scope: ScopeDescription) still reads f.readings (sherpa-quick-filter-toolbar.ts:1348-1349), destructures `active` (:1357) and reads f.active (:1384) on HeldFilter. saved-filters.ts:88 still reads scope?.presets on Partial<ViewScope>. Neither file is in S3, so 'data before UI' breaks tsc.
- **unsafe:** S3: check:traps fails. check-traps.mjs requires each TRAP's Site lines to name exactly the files that cite it. S3 removes every data-source.ts citation of T-a-saved-filter-is-its-readings (:202, :709, :718; :2331 is re-cited) and deletes test/unit/a-saved-filter-is-its-readings.test.mjs (it cites at :11). It also removes the T-a-saved-chip-lists-its-conditions citations at data-source.ts:829 and data-source-types.ts:84. S3's TRAP gate names neither set of Site updates.
- **unsafe:** S4: saved-filter-menu.ts is deleted whole, but filter-def.ts:14 (`import type { SavedAnswer } from './saved-filter-menu.js'`) and :33 (`saved?: SavedAnswer`) are not in S4's list, which names only 'the note at :29-32'. tsc fails.
- **unsafe:** Commit 5: test/e2e/reforged-filter-scope.spec.ts:150-180 ('the default scope is VIEW') reads src.contributions.length (:172) and expects 0 (:179). Commit 5 deletes `contributions` but ports only :40-148, :182-200 and :296, so this test throws a TypeError.
- **unsafe:** Commit 5: dropping `as unknown as Selector` at sherpa-provider.ts:842 does not type-check. Selector.write is a function-typed property with at?: {only?: EventTarget} (bind-selection.ts:36), and DataSource.write takes at: {only?: BoundControl} (data-source.ts:552). Under strictFunctionTypes the parameter is checked contravariantly, and EventTarget shares no property with the all-optional BoundControl (data-source-types.ts:250-276). The plan retypes which doors are required but never retypes `only`.
- **unsafe:** Commit 11: it deletes ViewState.filter (data-source-types.ts:157), but the `state` getter (data-source.ts:291-293) returns the COMPILED filter there (#compileNow writes it at :1464). Demos app/contexts/records.js:343 calls matchesFilter(record, source.state.filter). With undefined, matchesFilter returns true (store.ts:385), so the 'The filters on this page hide it' toast silently never shows, and no test covers it. test/unit/query.test.mjs:48 asserts src.state.filter and is not in commit 11's port list.
- **unsafe:** Commit 21: it deletes the whole-answer path while the bar's doors stay silent DOM writes (values= / setChipValues / setChipReading, toolbar.ts:393-486; report() was what made them heard, T-a-silent-write-still-needs-a-way-to-report). No revised commit schedules design §5's rule that a locked door sends its one request. After 21, a host's door + report() changes nothing, which breaks Ruling B's doors. These Demos specs fail: records-persist.spec.ts:188-199 and :246, panel-apply.spec.ts:106-118 (not in 21's list at all), chip-results.spec.ts:70, view-chips.spec.ts:97 (app-header values=) and :384, a-stale-draw-keeps-the-bars-own-change.spec.ts:22.
- **unsafe:** Commit 24 (PLAUSIBLE; carried over from the last check): it deletes #writing/#quietly/#unquietSoon and tags only saveView, resetView and applyFilters with `by`. A View pick's setQuery is made by onViewPicked (persist-view.ts:461), between before (provider-page.ts:524-527) and after (:529-535), and nothing tags it 'provider'. The keeper then keeps it as a reader change, and its frame write can land under the OLD #view (T-a-view-keeps-a-draft). The persist-view hook is still not named.
- **wrong:** BASELINE: 'Demos at 5a84a7e'. Demos HEAD is a949eed (sherpa-ui 373's test, which touched only test/e2e/reforged-records-details.spec.ts). '345 phase 3.4 commit ff34596d' is not in the last 5 commits, so treat that offset as unverified.
- **wrong:** The citations claimed to be 'at HEAD efff91ca' are working-tree lines that include the peer's uncommitted inserts. T-saved-filters-are-every-scope is at TRAPS.md:14974 at HEAD (plan :14999), and T-saved-filters-are-the-last-section at :15016 (plan :15041). TODO 320's row is at TODO.md:345 at HEAD (plan :347; tree :349). Ruling B ('✅ Will, 2026-10-13: B') is at TODO.md:1698 at HEAD (plan :1731; tree :1772). Smaller misses: DATA-SOURCE-RULES' declarePreset row is :270 (plan :268) and its contribute row :271 (plan :269); app.ts exports SavedFilter at :39 (plan :38); applySnapshot tests v at persist-view.ts:152 (plan :153).
- **wrong:** 'Today [the peer gate] applies to commit 6 and commit 23'. It applies to S1 and to every commit after it (see unsafe 1): the hook's working-tree check:size already fails on the peer's grid growth.
- **wrong:** S1: '#matched runs inside the existing once-a-frame #saySaved (provider-page.ts:119-131)'. #saySaved also runs synchronously on EVERY scope-change through #offer (listener at provider-page.ts:119; #offer :370-379 calls it at :378) and on every drawBars (:364). Each run builds `source.query`, which is a structuredClone of applied+draft (data-source.ts:296-298), before the JSON key. 'Nothing runs while no set is saved' also stops helping after S2 for any page that ships its own saved filters (Demos records ships 3).
- **wrong:** S2 test port: 'one-way-to-write-a-condition.test.mjs:115-130 (preset-without-where becomes saved-filter-invalid)'. That test is a node openSource test (:112-131). After S2, openSource no longer reads saved filters: they are top-level and read by sherpa-provider.open(), which is where 'saved-filter-invalid' is reported. The port cannot work as described. Either the check moves into a DOM-free page-definition helper, or the case becomes an e2e or an MCP validate_page case.
- **wrong:** Question 2, option A and kept item (c): 'in a scope the filter names, a field it does not name is cleared'. mergeSet REPLACES that scope's holds with the set's own `holds` whenever the set has them (query-edits.ts:304). Every reader-saved set has them: viewQueryOf passes holds through `...rest` (persist-view.ts:558-560) and filtersOf keeps them (saved-filters.ts:73-80). So that field's chip is REMOVED from the bar, not just cleared. Only a page's own set with no holds unions them.
- **wrong:** Commit 6 lists sherpa-filter-panel.ts:601 among the callers to sweep. That line is #draw() and edits no reading. The panel's real hand-outs of def.state are at :342, :980 (#fill restore) and :1496.
- **wrong:** Open note: 'If check-bench bundles only src/data.ts, the builder exports mergeSet from data.ts'. check-bench bundles its own ENTRY string (check-bench.mjs:41-47), so one line `export { mergeSet } from './src/core/data/query-edits.ts'` there is enough. S2 also has to read savedFilters from the page's top level, because open() keeps only `.source` (check-bench.mjs:198).
- **wrong:** S2/commit 12: 'the-package-surface lists SavedFilter / QueryContext'. SavedFilter is a type and that test only imports entries at runtime (the-package-surface.test.mjs:72-80), so it cannot list it. Commit 12 also claims 'every test passes UNEDITED' while editing the-package-surface.
- **missing:** S1 leaves the quick-filter's dismiss feature with no user: data-dismiss, quick-filter-dismiss and .caret-dismiss (sherpa-quick-filter.ts:51, :649-651; html:32-33, :97, :118; css:263-269; spec :238-243, :547, :625). Its only users were the two Saved chips. Either delete it (port reforged-swaps.spec.ts:34-43) or keep it and fix its doc ('The Saved chip. TODO 105'), as CLAUDE.md's 'a refactor deletes what it replaced' asks.
- **missing:** S1 public-API text that feeds the specs and docs/components: toolbar html:42-45 and panel html:37-40 (data-saveable still promises 'Save filters as' and 'the Saved chip'), panel html:63 (filters-save still says 'over the set on, else as a new one'), and the panel html:101-103 comment. The plan fixes only toolbar html:70.
- **missing:** S1 panel: .save-filters keeps data-group="start" (panel html:105), so once .save-more is hidden its end corners stay squared. The group attribute has to follow the :state(saved-on).
- **missing:** Commit 5 breaks its own served-docs gate. DATA-SOURCE-RULES.md:363-378 (sherpa://data-rules), 'The filter is NAMED PARTS', teaches source.contribute(...) and setFilter(). Commit 5 names only the table row.
- **missing:** Commit 9: once 'search no longer counts as arranging' (query.ts:269), compile and arrangementOf must read `search` from wherever it lives. Today compile takes it from the first arranging scope (query.ts:288). With search in `view` and sort in `data` it is dropped. Not stated.
- **missing:** S3's definitionOf allow-list ('copies only ScopeQuery's own keys') must also take sortSuspended (commit 8) and superseded (commit 19). Otherwise both are dropped with 'unknown-scope-key'. Neither commit says so.
- **missing:** Commit 23: the peer's uncommitted 373 cell chip (#onCellFilter in the working-tree sherpa-data-grid.ts) writes #columnFilters and THEN reports column-filter-change → answerColumn. Commit 23 deletes answerColumn and stops only #onColumnFilterCommit's write when locked. The cell-chip path (and 374, a cell chip on a View-held field) is not covered.
- **missing:** S2: MCP validate_page's description (mcp-server/tools/data.js:781), which is served to agents, still says 'a scope that shows a saved filter the page does not define'. page.v1.json also has no $def for a QueryDefaults, so the new savedFilters entry needs one (scopes with where, holds and suspended).
- **missing:** Questions missing. Commit 10 drops persistView's Query restore, so a page with no provider loses its filters on reload. Commit 11 drops setState's page-last restore with no new door. Both are behaviour losses of public API with no ruling from Will. The plan files them as 'open' notes; they are real choices for Will.

## How the plan answers the first checks

- BASELINE: every line is now cited at HEAD efff91ca (sherpa-ui) and 5a84a7e (Demos). Commit 372 moved sherpa-quick-filter.ts lines by 13 after :232 (#given is now :779, #arrange :483, #arrangeFromMenu :504, #applySort :524, #syncEmpty :728, #syncCondition :770). It moved sherpa-filter-panel.ts lines by 2 after :185. The toolbar and data-source.ts have not changed since 5b89bd4a. A peer's UNCOMMITTED work is in the tree now: sherpa-data-grid.{ts,css,html} and test/e2e/reforged-data-grid.spec.ts (git status). The earlier quick-filter edits landed as 372. Ruling B is at docs/TODO.md:1731. TODO 320 is at :347.
- NEW GATE on every commit (skeptic 1: 'peer check before S4, 20, 22'): first run `git status`. If a file the commit edits holds changes the builder did not make, run ListAgents, or ask Will. Never stash. Stage only the commit's own paths, and only while `git diff --cached` is empty. Today this applies to commit 6 (it sweeps sherpa-data-grid.ts) and to commit 23 (the grid).
- NEW GATE on every commit (skeptic 2, missing: 'served docs teach the doors that move'): each commit updates the lines of the docs the MCP serves that name a door it moves or deletes. The MCP serves APP-GUIDE.md and DATA-SOURCE-RULES.md (mcp-server/resources/index.js:20-28). It updates QUERY-DESIGN.md in the same commit too. Each commit names its lines: S1 APP-GUIDE:285-305; S2 APP-GUIDE:179-181 and :248; S3 DATA-SOURCE-RULES:268 and QUERY-DESIGN:84 and :117; 5 DATA-SOURCE-RULES:269 and QUERY-DESIGN:290-292; 6 DATA-SOURCE-RULES:274; 13 DATA-SOURCE-RULES:262-271; 16 DATA-SOURCE-RULES:337.
- Skeptics 1+2, unsafe ('S1 and S2 change the provider's spec but do not regenerate it'): the gates of S1, S2, 16 and 24 now run spec:check for sherpa-provider, then `npm run manifest` and `npm run reference`. The changes are in sherpa-provider.component.json:100, :184-202 and :247-252, custom-elements.json:7779 and :7938, and docs/components/sherpa-provider.md:35-36 and :51-57.
- Skeptics 1+2, wrong ('Q1 A keeps a Save that does nothing: a ticked set already equals the screen'): we agree. Under A there is ONE Save, and it always asks for a name. The `filters-save-as` event, its ⋮ row (sherpa-filter-more.html:13) and the panel's save-menu row (panel html:111) go, with no alias. The `filters-save` doc says 'asks for a name'. saveFilters(label) now NEEDS a name: the no-name path (provider-page.ts:200) goes. A name the reader already used replaces that set (labelId, T-derived-id-makes-resave-an-update). The Demos host confirms that first. Q1 now offers this against B (the tab keeps the last applied).
- Skeptic 1, wrong ('S1 says Demos index.html is comments only'): it is now a twin change in S1. Demos app/index.html:443-476 has one filters-save handler. It prompts with the label of the ticked set (savedFilterSets.find(s => s.on)), confirms a name that is taken, then calls saveFilters(name). The filters-save-as handler goes. filters-delete confirms, then deletes detail.id.
- Skeptic 1, unsafe ('provider-saves-filters :63-66 and :82 call saveFilters() after an edit'): S1 ports both. :63-66 saves again BY NAME ('Gold Pro'), which replaces the set. :82 then expects the Saved row ticked again. The chip() helper (:33-36) becomes the row's tick plus savedFilterSets.
- Skeptic 1, missing ('an untick changes no filter, so no event redraws the row'): S1 adds SavedSets.follow(menu). After each Filters-menu Apply, it re-ticks the rows of the sets that match, as OneRows.follow does (filters-button.ts:240-252). pick() applies only a row newly ticked against what it was told, as OneRows.flip does (:233-237). An untick changes nothing. A test for this is written first.
- Skeptic 2, missing ('#matched runs viewQueryOf on every frame'): S1 does no matching work while no saved filter exists. It normalises each set's `where` once (cached by id and JSON). It keys the screen's side on JSON.stringify(source.query.applied), so a frame that changes only the arrangement or a load costs one stringify. It runs inside the existing once-a-frame #saySaved (provider-page.ts:119-131). The Demos perf/inp.mjs act 'saved filter on' (moved in S2) measures it.
- Skeptic 1, unsafe ('app.ts:37-40 exports type SavedFilter from saved-filters.js'): in S2 the type moves to query.ts. data.ts exports it. app.ts:38 drops it, because index.ts uses `export *` from both entries and two exports would collide. the-package-surface test lists it.
- Skeptics 1+2, unsafe ('page-definition.test.mjs:291-318 fails at S2'): S2 deletes that test. Its TRAP, T-a-view-keeps-the-saved-filter-chips, keeps one citation at query-edits.ts:283 until S3 retires it.
- Skeptic 1, missing ('a reader set whose id equals a page id shadows the page's own'): this is kept on purpose, as viewLibrary does it for Views (persist-view.ts:515-517, T-view-library-is-one-vocabulary). That set is the reader's own (`own: true`), so Delete removes it and the page's own shows again. A new save can never collide, because saveFilters runs uniqueViewLabel against the page's own labels (as at provider-page.ts:154).
- Skeptics 1+2, unsafe and wrong ('the bench report act cannot send At risk as a health reading: data holds only status, plan, tier and owner; the presets line is :213'): S2 drops AT_RISK from the report act (check-bench.mjs:226 and :234). It sends REPORT only. It deletes the fake data bar's presets line (:213) and the control()'s presets (:146-155, :176-178 go in S4). It adds a new act, 'apply-saved', LAST in MAIN, so no earlier act moves. That act applies the fixture's savedFilters['at-risk'] by source.setQuery(mergeSet(applied, saved.query)). The report act and the acts after it on records, remote, rest and notheld move, and are recorded with the reason 'a saved filter is a whole write now, not a toggle'.
- Skeptic 2, wrong ('S2: PAGE-DEFINITION is not served'): S2 updates APP-GUIDE.md:179-181 and :248, which are served. It updates PAGE-DEFINITION.md as the page reference only. S3 updates DATA-SOURCE-RULES.md:268, which is served.
- Skeptics 1+2, missing ('Demos perf scripts drive the preset chip'): S2 twin-changes Demos perf/inp.mjs:14 and :24 and perf/profile.mjs:16. Each applies 'Has open tickets' from the Saved section of the Filters menu instead.
- Skeptic 1, unsafe ('S3: filters-limit-in-order :55 and :61 pass a presets function'): S3 ports both answerOrder calls to (q, sets, scope).
- Skeptic 2, missing ('every-declare-reads-back :26-31'): S3 deletes it, with :14-22.
- Skeptics 1+2, unsafe (the S4 test list was short): S4 now also ports these. reforged-one-filters-button.spec.ts:29, :76, :92 and :205-236 (the custom:mine def and its card are deleted). reforged-panel-filters-button.spec.ts:12, :37, :118, :127, :289, :323 and :334-385. reforged-filter-panel-component.spec.ts:79-93, :263, :303-322, :326-357, :429 and :470-471. reforged-filterset.spec.ts:61-100.
- Skeptic 1, unsafe ('S4 check:traps fails: citations remain'): S4 retires three TRAPs only after every citation is gone. T-a-chip-with-no-field-is-a-preset: panel.ts:767, filter-def.ts:92 and the spec's :79 all go. T-a-saved-filter-is-its-readings: data-source.ts:2331 is re-cited in S3. filter-state.ts:415 is re-cited to T-saved-filters-are-every-scope. filter-kind.ts:48, quick-filter.ts:778, quick-filter.html:82 (component.json:313 and docs/components/sherpa-quick-filter.md:42 regenerate) and filter-def.ts:78 go. T-a-saved-chip-lists-its-conditions: conditionLines, sayReadings and SaidField are deleted (no src user is left; filter-face.ts:160-200, data.ts:252-256). So are date-conditions.test.mjs:83, sherpa-menu.css:380-381, sherpa-menu.html:92's menu-line words and both saved-field templates.
- Skeptic 2, missing ('the toolbar's qf-saved-field-tpl'): S4 deletes toolbar html:213-221 as well as panel html:213-221.
- Skeptic 1, unsafe ('commit 5: #parts.clear() at :412 and :520 and the setFilter doc at :518 outlive #parts'): commit 5 deletes both clear() calls. It drops the T-contribute-beats-last-writer citation from setFilter's doc (:518). setFilter lives until commit 11.
- Skeptics 1+2, unsafe ('commit 5: unscoped bars in one-query-builder :45-81, number-filter-reports :251 and reforged-data-source :616-700'): commit 5 binds each with scope:'view', or 'data' for the grid at :638. These bars then go through answerScope, which is the path every page uses.
- Skeptics 1+2, unsafe and missing ('filter-scope :40-110 and :182-200 cannot be ported by adding only; the two-components story'): commit 5 deletes :40-148, because no page binds component reach without `only` (grep). It rewrites :182-200 to expect the 'component-reach-without-only' report and no bind. A new test tells the two-components story: two legends with `only`, over two charts bound rows:'all'. Each narrows its own chart, and the grid's rows stay the same.
- Skeptic 2, missing ('panel html:18 teaches an unscoped bind'): commit 5 changes it to `scope: ['view', 'data']`, then runs spec:check and reference.
- Skeptic 2, missing ('the Selector type has optional doors, and sherpa-provider.ts:842 casts through unknown'): commit 5 retypes Selector to required select, selection, declareValues, write, reading and holds, and deletes the cast. Commit 13 retypes it onto the QueryContext, so a moved door is a type error and cannot fail silently.
- Skeptic 2, missing ('the toolbar comment at :1161 names source.apply'): commit 5 fixes it.
- Skeptics 1+2, unsafe ('commits 6 and 11: applyViewSnapshot and captureView send a snapshot's filter through setState'): NEW commit 10. ViewSnapshot becomes v2 {v:2, query?: QueryDefaults, elements?}. It is captured with viewQueryOf and applied with setQuery. A stored v1 is ignored whole (D4; persist-view.ts:153 tests v). It lands after sort and search are in the Query (commits 8-9), so the snapshot keeps the arrangement. Only after that does commit 11 delete setFilter and setState.
- Skeptic 2, unsafe ('headless-data-layer :372-402 restores through setState in commit 6; more setFilter lines'): setState and setFilter now go TOGETHER in commit 11. It ports headless-data-layer :72, :160, :165, :205, :209, :246, :262, :378, :392, :410-423, :479, :492 and :573.
- Skeptic 2, missing ('value-types :73-86 tests the store grammar'): commit 11 moves it to store.load({filter}), where run_query keeps that grammar.
- Skeptic 2, wrong ('check:mcp-pack never sends filter or where'): S2 adds test/unit/the-mcp-data-tools.test.mjs. It registers mcp-server/tools/data.js on a fake server (registerTool, data.js:244) and calls validate_page with savedFilters. Commit 11 adds run_query with `filter` (an or, a dotted path) and with `where`. zod resolves from the root node_modules.
- Skeptic 2, unsafe ('commit 7: every-declare-reads-back :45-54 pushes into a frozen defaultFor'): commit 6 (the freeze) ports it to read back the same object and to expect a TypeError on push.
- Skeptic 1, wrong ('bind-selection.ts:135, :150 and :178 call source.reading'): commit 6 adds them to the sweep. They only read or spread the result, so a frozen original is safe there.
- Skeptic 1, missing ('Views write search in data; which scope does setSearch read?'): search lives with the arrangement. setSearch writes the scope given, else #arrangedIn(), else VIEW, the same rule as sort (commit 9). definitionOf keeps a search in its own scope. Demos records-views.json:4, :16, :35 and :47 are read where they are.
- Skeptic 2, missing ('the Demos find-box listener on scope-change'): commit 17 moves Demos records.js:232-238 to query-change.
- Skeptics 1+2, unsafe ('chart-scope.test.mjs:68-91 sends the panel's old detail'): commit 20 ports it to the request detail.
- Skeptics 1+2, unsafe ('five unit fakes and reforged-data-source :389-428 and :616-700 send the whole answer'): commit 21 ports each fake's report() to send requests. The files are a-change-walks-again-only-for-what-it-moved:30, a-field-counts-unique-rows:33, a-serial-set-chains-its-fields:40, present-limits-each-field:42 and the-walk-holds-under-change:36. It also ports both reforged-data-source tests.
- Skeptic 2, missing ('pickedReadings'): commit 21 deletes pickedReadings (bind-source.ts:218 and :318-330) with the whole-answer path. Its citation of T-toggle-chips-have-no-field (:329) goes. That TRAP stays, cited at toolbar.ts:365. T-values-carries-two-shapes is not cited there.
- Skeptic 1, unsafe ('commit 22 retiring T-a-rebuilt-bar-reads-empty-until-its-menus-stamp'): it is NOT retired, because the unbound bar (#held) and sherpa-menu.ts:1163 still read menus before they stamp. Commit 22 rewrites it to add that a bound bar paints from its slice. It removes only the citations inside deleted code.
- Skeptic 2, unsafe ('commit 24: reports-round-2 :36-47 imports v1; the provider spec'): commit 24 ports it to expect 'unknown-state' for a v1 import. It runs spec:check, manifest and reference for the provider (component.json:214-223; docs/components/sherpa-provider.md:56-57).
- Skeptic 2, missing ('commit 24: #quietly's callers'): commit 24 changes saveView (provider-page.ts:168) and resetView (:313) to setQuery(q, {by:'provider'}).
- Skeptic 2, missing (commit 14 callers): commit 14 names page-definition.ts:91, :95 and :107, and sherpa-provider.ts:772-773, :856 and :865.
- Skeptic 2, missing (commit 15 callers): commit 15 names bind-source.ts:241, :247, :250, :270, :271 and :284, page-definition.ts:96, and bind-selection.ts:151, :157, :165, :178 and :192.
- Skeptic 2, missing (commit 16 callers and tests): commit 16 names provider-page.ts:170, :220, :314-315, :420-422 and :514-515, and sherpa-provider.ts:28, :71, :643-644 and :661. data.ts:80 renames SourceState to QueryState, with no alias. It also names persist-view.ts:558 and the ViewSource type at :566-571, with its callers provider-page.ts:157, a-scope-arranges-its-own-rows.test.mjs:69 and reforged-view-definition.spec.ts:605-616. It names bind-source.ts:197, :202 and :306, and the tests a-reopen-checks-behind.test.mjs:47 and :49 and a-held-set-yields-when-it-cannot-answer.test.mjs:101.
- Skeptic 2, missing (commit 13 callers): commit 13 names a-scope-arranges-its-own-rows.test.mjs:37-42 and Demos reforged-email-starts-simple.spec.ts:18.
- Skeptic 2, missing ('toolbar :1044 says call source.suspendScope()'): commit 18 changes the message to name source.query.suspend().
- Skeptics 1+2, wrong (line citations): the lines are now apply at data-source.ts:706, :2340 and :2344; the constructor's draft reset at :247; declareDefault at sherpa-provider.ts:772-773; the events at :397, :399, :581, :1135, :1226, :1292, :1345, :1386 and :1552; and the panel at :211-212, :225 and :1645.
- Kept from the last revision, and still right: (a) the save already keeps the chips' holds and their on/off (viewQueryOf, persist-view.ts:557-560; whereOf writes off:true). (c) mergeSet keeps every scope the filter does not name, and clears a field the filter does not name inside a scope it names (query-edits.ts:299-306). (d) sherpa:filter-set-on:<page> goes. The order is data before UI (S3 before S4). D3 is moot.
