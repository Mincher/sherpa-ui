# TODO 350 — leaner code: the audit of 2026-10-22

Will, 2026-10-22: *"Now is probably a good time to also check the JS and CSS for
redundancies and inefficiencies. Leaner, cleaner, still fully functional code is
ideal."* Four read-only audits (data layer, UI core, component TS, CSS), each
finding checked against the code. Fixed in batches, each one commit, each
proved by the gates, the bench and the specs it touches.

## Batch 1 — bugs the audit found

| # | Bug | Where | Fix |
|---|---|---|---|
| B1 | A rebuilt grid body loses the current-row tint: 11 sites re-render rows without `#syncCurrent` (a filter keystroke, `drawReading`, `select()`) | `sherpa-data-grid.ts` | one `#drawBody()` that does all four syncs |
| B2 | A JsonStore checks each row twice per load, copies the set, and never reports the rows its schema refused | `stores.ts` JsonStore | load and scan through the inner store |
| B3 | The panel sends group-change and sort-change twice per pick, the second without a direction | `sherpa-filter-panel.ts` `#onAddCommit` | drop the organise emit there |
| B4 | The bar sends two requests per condition edit; the first can read empty | `sherpa-quick-filter-toolbar.ts` `#onConditionChanged` | keep the deferred one |
| B5 | The provider keeps every past Context's filter bars alive (a Map keyed by element) | `provider-mode.ts` `#toggles` | a WeakMap |
| ~~B6~~ | ~~The menu runs `#syncDirty` twice per event~~ — NOT waste: the host listener runs after a tree takes its tick. Removing it left a tree menu's Apply off (found by a second session, reverted) | `sherpa-menu.ts` | keep both |

## Batch 2 — per-element cost in the base class (the biggest runtime win)

| # | Waste | Fix |
|---|---|---|
| E1 | Each element parses its template again from a string (`innerHTML`) | keep the parsed `<template>`, stamp a deep clone |
| E2 | Each element rebuilds its file and sheet lists (~40 allocations) | cache per tag once every sheet loaded |
| E3 | Two whole-tree queries per stamp (`[data-swap-on]`, `[data-icon]`) most templates do not need | answer once per template |
| E4 | Content props queried twice, the prop map walked twice | one pass per stamp |
| E5 | ~10 objects per element for features ~60 of 66 classes never use (AbortController, internals for an empty slot, config objects) | create each on first use |
| E6 | Each element waits on every icon the page ever loaded | wait on the in-flight ones only |
| E7 | `#fillItem` copies every node's attributes per item | skip nodes with none |

## Batch 3 — redraw churn in components

| # | Waste | Where |
|---|---|---|
| C1 | The calendar restamps its whole grid 2–3 times per pick (42–84 cells each) | `sherpa-calendar.ts` |
| C2 | The chip reads its state with an O(n²) scan, 5 times per pick | `sherpa-quick-filter.ts` `#state` |
| C3 | The chip rebuilds both icon SVGs on almost every attribute change | `sherpa-quick-filter.ts` `#syncText` |
| C4 | Bar and line charts redraw on every attribute change | `sherpa-barchart.ts`, `sherpa-line-chart.ts` |
| C5 | The bar draws the Filters menu twice per add or remove; `drawScope` rebuilds the chip run once per removed field | `sherpa-quick-filter-toolbar.ts` |
| C6 | The grid lights every heading twice per head render | `sherpa-data-grid.ts` |
| C7 | The legend rebuilds every row when given the same list | `sherpa-chart-legend.ts` |
| C8 | `publish()` rebuilds the same view once per bound component | `source-binding.ts` |
| C9 | A tiered field's paths are rebuilt on every `facts()` call | `field-catalogue.ts` |
| C10 | A new `Intl.DateTimeFormat` per date drawn | `format-date.ts` |
| C11 | Saved Views and sets read and parsed from storage on every call | outlet, provider-page, session |

## Batch 4 — dead code and duplication (no behaviour change)

Dead: `allow.ts`'s three test-only exports; `Walk.spent`; `Compiled.sort/group/search`;
`savedReading`; `OrderEntry.kind`; the toolbar's two organise branches no chip
reaches; the chip's borrowed-menu fallback; the panel's three write-then-read
flags; `IconArt.ink` (6.7 KB shipped); `rovingFocus`'s `initial`; small unread
interface members. Duplicated: seven copies of the form-control lifecycle (to
base doors); the ⋮ menu wiring in bar and panel; telling a menu what is
present (3 sites); a named set in Web Storage (3 copies); the outlet's Context
and Settings lifecycles; `this.set(a, x)` written as an if/else (8 sites);
attributes that follow one host attribute, to `data-swap-*` (5 sites); the
button's badge and icons, to `props` with `to`; the slider's 8 handlers.

## Batch 4b — CSS (the fourth audit)

About 1,100 lines, ~500 of them comments: re-declarations of what a shared class
on the same element already sets (`.sherpa-border-edges`, `.sherpa-icon-box`);
zeroes and `:host` font/colour the base sheet already gives; default values
written out; fades and cursors that can never show (`display: none`,
`pointer-events: none`); `@supports` guards around `color-mix()` used unguarded
elsewhere; vendor prefixes no target needs; the grid's divider written 9 times;
bar and line charts repeating their family sheet; `sherpa-group.css`
re-implementing `sherpa-grouping.css` (~100 lines); checkbox, radio and switch
repeating one label column; two unread `--sherpa-card-*` properties and an unused
`.sherpa-inert`. Bugs it found: a focused promo nav item drew two rings after the
focus-ring change (fixed); two "hide when empty" rules that can never fire
(`.footer:not(:has(*))` in the nav, `.filters:not(:has(*))` in the app header —
each always holds its slot); an active grid heading is tinted though its comment
says unpainted (check on screen); five `var(--sherpa-shadow-*)` without a fallback.

## Batch 5 — comments

About 400 lines of history, measurements and worked examples, cut to one line
each with every `TRAP` citation kept (PRINCIPLES 22): the base class is 33%
comments, `data-source.ts` 29%, `shared-constants.ts` 67%.

## Decisions for Will

| # | Question | My pick |
|---|---|---|
| W1 | Remove public doors no one uses: `installTokens()`, `bindSource`'s `into`, `QueryContext.move()`, the `search-change` event; and the allow-list's `isAllowed`, `unknownEntries`, `nextState`, kept on purpose for later work (TODO 10721) | A — remove the first four; keep the allow-list three for their planned callers |
| W2 | The Style pins: every component carries all 39 components' state pins (~135 KB of the 190 KB shared sheet). Move each component's pins into its own CSS | A — move them |
| W3 | The grid's span and count rules live in `tokens.css` (~220 lines). Move them into `sherpa-layout-grid.css`, one rule each with typed `attr()` | A — move them; the breakpoint bands keep their `@media` there |

## What the tokens cost (measured)

- Every CSS file is already minified (cssnano): `tokens.css` 264 KB → 213 KB, and
  15 KB on the wire compressed — it repeats itself.
- Components read 554 of its 895 names (1,744 of 2,300 declarations). A
  used-only file would save about a quarter: 2–3 KB compressed.
- The Style layer is 62% of it, and the same pins ship a second time in the JS
  (the shared `sherpa-style-modes.css`, 190 KB). That is the token weight worth
  cutting (W2).
- It is fetched once per page; a single-page app keeps it all session; a reload
  asks the browser cache (a `304`), or nothing at all with a long cache.
