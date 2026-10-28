# Review 518 — the filtering code (2026-10-28)

Will: *"Let's review all of the filtering code and behaviour. There's been lots
of waves of improvements and fixes that I suspect will have conflicts,
duplication, and unnecessary complexity. Let's optimise as best as we can
without affecting the sherpa architecture or functionality. We should also
ensure that all UI components work in isolation with the data layer components
and don't rely on other UI components to function."*

Three read-only reviewers: D (the data layer), U (the filter UI), R (each
component alone). Line numbers are as of commit d90aad69 and drift. "Probed"
means the reviewer ran the case against `dist/`. Each finding is checked again,
with a failing test where it is a bug, before it is changed.

## Phases

- **0 — Will's bugs:** 519 (the grid's search narrows the charts), 520 (the
  highlight stays in its filter's scope).
- **1 — bugs against rules already made:** a test first, then the fix.
- **2 — simpler, the same behaviour:** dead code, duplicates, extra redraws.
- **3 — each component alone** (R): waits for Will's two choices.
- **❓ — Will's rulings:** U1, U9, and the two R choices.

## D — the data layer

| id | phase | kind | finding | sites |
|---|---|---|---|---|
| D1 | ✅ 1 | conflict, probed | `dirty()` compares by JSON text (key order), `pending()` by `sameReading`: change a field and back, and the scope is dirty with no field pending | query-context.ts `dirty`, `pending`; query-edits.ts `setReading` re-adds the key last |
| D2 | 1 | conflict, probed | the walk rules out a pick that matches rows — a banded field's number pick (tallied as bands only), a blank pick (never tallied) — and 512's `letGo` deletes it | walk.ts `keyOf`; filter-state.ts `bandsClause`; source-counts.ts `step.picks`; data-source.ts letGo |
| D3 | 2 | complex | the set-aside drop (`CompileFacts.drop`, `withoutDropped`, `step.less`, the re-scan, the compile again) changes no row since 512's `letGo`; it makes the load wrong in D2's cases | query.ts, source-counts.ts, walk.ts, data-source.ts; TRAP T-a-ruled-out-value-is-greyed |
| D4 | 3 (unused: `data-filterable`; settled by R2) | conflict, probed | the grid's filter row writes `{op:'contains',text}` at the VIEW, replacing the field's whole answer (its picks lost); the heading writes the grid's own scope | bind-source.ts `filter-change`; sherpa-data-grid.ts emits it |
| D5 | 2 | conflict, probed | "Advanced" judged three ways: `modeOf` (one-condition form is advanced), `fieldState.mode` (simple), `FilterState.condition` (op ≠ eq) | filter-state.ts `modeOf`, `fieldState`; where.ts |
| D6 | ✅ 1 | conflict, probed | `letGo` writes the applied picks' remainder into the DRAFT too, skipping `#write`'s prune: a waiting draft loses an unapplied pick and keeps an empty reading | query-context.ts `letGo` |
| D7 | ✅ 1 | conflict, probed | `pickedFor` lights Simple picks while the field is Advanced | data-source.ts `pickedFor` → source-binding.ts |
| D8 | 2 | dead, probed | `compile()` works out sort/group/search and a `two-arranging-scopes` report nobody reads; it disagrees with `arrangementOf` | query.ts `compile` |
| D9 | ✅ 1 | conflict, probed | `FieldCatalogue.facts()` drops a field's own value labels: `selection()` and `filterFace` show the raw value | field-catalogue.ts `facts` |
| D10 | 1 | conflict, probed | a pick outside the declared values: compile drops it, the walk counts it | filter-state.ts `declared`; source-counts.ts `each` |
| D11 | 2 | dead | `savedReading` has no caller | filter-state.ts |
| D12 | 2 | dead | number-range leftovers after 375: a branch that cannot run, redundant terms, a doc that contradicts the code | filter-state.ts `range` |
| D13 | 2 | dead | `asRows`/`withRows`/`withoutRows` take a `type` no caller passes | filter-state.ts |
| D14 | 1 | duplicate | "does a reading answer?" six ways; a half range is "answered" yet compiles to nothing, and blocks a fetching list's start (403) | query.ts `readingAnswered`; filter-state.ts `rowAnswered` |
| D15 | 2 | duplicate | four case-blind membership helpers; `holdsKey` scans the whole tally per pick | filter-state.ts, walk.ts, store.ts, source-counts.ts |
| D16 | 2 | duplicate | "split rows at each `or`" twice | filter-state.ts `runsOf`, `chainRows` |
| D17 | 2 | duplicate | the four arrangement keys listed about nine times | query.ts, query-edits.ts, query-context.ts |
| D18 | — | duplicate | "is it a list?" in four places; `openOnFirst` skips a banded number | field-catalogue.ts `isList`; data-source.ts |
| D19 | — | two names | two "starts": the page's and the first-value one; `reset()` ignores the page's | query-context.ts |
| D20 | 2 | one word, three meanings | "off": a FieldState, a tiered parent's kept picks, a suspended Condition | filter-state.ts, where.ts |
| D21 | 2 | two shapes | picks stored as keys by `#write`, as raw values by `#select`; bindSelection reads with `String` | query-context.ts; bind-selection.ts |
| D22 | 1 | conflict | the context's `has` is the catalogue's narrow one; with two sources a field known by its values falls to member 0 | data-source.ts; query-context.ts `#knows` |
| D23 | 2 | duplicate | `answered()` and `appliedCount()` repeat one predicate | data-source.ts |
| D24 | 2 | dead | `Walk.ends`, `BoundControl.superseded`/`report`, public `pathOf`/`sameRow`; `search-change` has no emitter | walk.ts, data-source-types.ts, bind-source.ts |
| D25 | 2 | stale | four comments | query-edits.ts, store.ts, filter-face.ts, query.ts |

## U — the filter UI

| id | phase | kind | finding | sites |
|---|---|---|---|---|
| U1 | ❓ | conflict | the panel's Sites menu picks the PARENT when every site is ticked; 369 Q1 A says it must not, and the bar's tree and the grid heading keep paths | sherpa-quick-filter.ts `#onKidsChange`; tree-picks.ts |
| U2 | ✅ 1 | writers | a locked chip turns itself on when a condition row changes (`#onCondition` → `#applySelection`, no lock check) | sherpa-quick-filter.ts |
| U3 | 2 | writers | the toolbar writes the chip's `data-current` again after the chip did; dates go another way | toolbar `#onChipChange`, `#onDatePicked` |
| U4 | 2 | writers | the grid writes a heading chip's `data-condition`, which the chip writes itself | sherpa-data-grid.ts `#lightFilterChip` |
| U5 | ✅ 1 | conflict | `onConnect` writes a pick count over the results badge; the html doc still describes the old badge | sherpa-quick-filter.ts onConnect |
| U6 | 1 | conflict | a value chip and a menu row give different reasons for one ruled-out value; `available: false` is refused in the menu, not on the chip | filter-host.ts `limitField`; sherpa-menu.ts |
| U7 | 1 | duplicate | "answered" six ways in the UI; a number or list chip given an Advanced reading before its menu draws is switched off | sherpa-quick-filter.ts `reading` setter; sherpa-data-grid.ts `answersAnything` |
| U8 | 2 | duplicate | the grid writes its own filter label, unlike the chip's `filterFace`; nothing reads it | sherpa-data-grid.ts `#columnFilterLabel` |
| U9 | ❓ | conflict | Apply with one end of a date range: a heading clears the field, a chip filters that day | sherpa-data-grid.ts `#readColumnFilter`; filter-state.ts |
| U10 | 2 | complex | one menu change redraws the chip's face about 5 times (`#state`, `#writeTip`, `#syncEmpty`) | sherpa-quick-filter.ts `#applySelection` |
| U11 | 2 | complex, high risk | four held-state layers in the toolbar, older than the menu's own early state; each to be removed only with proof | toolbar `#held`, `#heldDraws`, `#pendingAnswers`, `#painted` |
| U12 | 2 | complex | add, remove and allow render the bar twice; `drawScope` can render it 5+ times | toolbar `allowFields`, `#addFilters`, `#removeFilter`, `drawScope` |
| U13 | 2 | duplicate | the Filters menu is built two ways (bar, column); the bar runs chip code on its Edit button | toolbar; toolbar-column.ts |
| U14 | 2 | duplicate | two `SavedSets` and two headers per toolbar; `data-saveable` redraws only the bar's | toolbar; toolbar-column.ts |
| U15 | 1 | conflict | a column's Reset is enabled by scopes it does not reset | provider-page.ts `data-nothing-to-reset` |
| U16 | 2 | duplicate | about 18 near-identical provider setters | sherpa-provider.ts |
| U17 | 2 | dead | `data-folded`, `menu-range-change`, `FilterDef.asChip`, three save rows in `FILTER_ACTIONS`, `markField`'s `drafting`, `close()`, `HeldFilter.appliedAt` | toolbar, sherpa-menu.ts, filter-def.ts, more-menu.ts, filter-host.ts, data-source.ts |
| U18 | 2 | contract | props declared `kind: 'style'` that only JS reads; `data-filters-nothing` written but not declared | chip and toolbar props |
| U19 | 2 | duplicate | the toolbar finds a chip's menu and organise state its own ways, not `chip.menu`/`column`/`direction` | toolbar |
| U20 | 1 | conflict | the `empties` rule three ways; the toolbar re-renders every chip on its change and loses open drafts | filter-menu.ts; sherpa-data-grid.ts; toolbar |
| U21 | 2 | complex | every bar act works out `active` and `values` that only the View chip's entry is read from | toolbar; sherpa-outlet.ts; persist-view.ts |
| U22 | — | writers, unsure | `clearAll` empties locked chips itself; the column's Reset only asks | toolbar `clearAll`; toolbar-column.ts |
| U23 | 2 | writers | the chip keeps its own copy of the menu's `all` | sherpa-quick-filter.ts |
| U24 | — | latent | two ways to read a bar's scope (own vs inherited `data-scope`) | provider-mode.ts; sherpa-provider.ts |
| U25 | 2 | stale | doc lines, a "ONE door for both hosts" left from the panel, `filter-panel` in check-traps | several |

## R — each component alone

| id | phase | finding |
|---|---|---|
| R1 | 3 | a bar bound alone is not drawn at bind (no chips) and its Add list stays empty: only the provider draws it |
| R2 | 3 ❓ | only the provider turns a component's `static asks` into a bind; alone, charts, metrics and the legend ignore their own attributes, the legend cannot filter, a grid heading lists one page's values |
| R3 | 3 | a lone value chip sends no request; a menu's reading has no path in |
| R4 | 3 ❓ | the defaults Will ratified ON (517, 500, 501, 490) are written only by the provider; alone a component has the old ones |
| R5 | 1 | a bare `bindSource(src, grid)` wipes the grid's columns |
| R6 | 3 | the outlet needs a provider, silently, and a header View chip to follow `?view=` |
| R7 | 1 | a bar alone offers "Reset all on view", which nothing answers |

Allowed compositions (a real `sherpa-*` child through its public API) are not
reliance. A rule to weigh: TODO 388, "a grid is never wired by hand".
