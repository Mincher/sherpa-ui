# Task queue — for review

Written for: Will, to amend.

Everything currently queued on `sherpa-data-layer`, in one place. Amend this
file freely — reorder it, cut things, add things, write notes in it.

Six items (D1–D6) were only ever said in conversation and had never been written
down anywhere. They are in here now.

**Ordering is a suggestion, not a plan.** Nothing has started.

---

## At a glance

| # | Item | Size | Why now |
|---|---|---|---|
| ~~**B5**~~ | ~~Grid header chips don't light from the app header~~ | — | **DONE** `pending` |
| ~~**B1**~~ | ~~"X items selected" is in the wrong place~~ | — | **DONE** `b3db74ed` |
| ~~**B2**~~ | ~~Last row has no bottom border~~ | — | **DONE** `b3db74ed` |
| ~~**B3**~~ | ~~Empty chip's body should open its menu~~ | — | **DONE** `f35df4b4` |
| **B6** | Saturated button ignores a critical status | M | Measured; obvious fix fails |
| ~~**B7**~~ | ~~Group checkbox icon doesn't update~~ | — | **DONE** `dc18aca3` |
| ~~**B8**~~ | ~~Contextual toolbar actions need 8px spacing~~ | — | **DONE** `dc18aca3` |
| ~~**B9**~~ | ~~Numeric filter chips should default to range~~ | — | **DONE** `dc18aca3` |
| ~~**D5**~~ | ~~Dialog footer horizontal padding~~ | — | **DONE** `97d7bb25` |
| ~~**D3**~~ | ~~Delete needs a confirm dialog + a real mutation~~ | — | **DONE** `3b3d6242` |
| ~~**D4**~~ | ~~Error handling for failed mutations~~ | — | **DONE** `3b3d6242` |
| ~~**D1**~~ | ~~Checkbox styling in grid selection cells~~ | — | **DONE** — verified, already correct |
| **B4** | Data-viz tooltips lose decimals | S | Same cause as C |
| ~~**C**~~ | ~~Data viz built from the data layer~~ | — | **DONE** `eb8d15a1` |
| **E** | Assess `src/core/` for duplication and platform-native work | XL | Asked 2026-09-21 |
| **D2** | 4 data-viz containers on Records | L | Needs C first |
| **A** | Generalise grouping / sorting / filtering | XL | Architectural; B5 feeds it |
| **D6** | Trim data-grid comments into per-component docs | M | Housekeeping |
| **0** | No chart is keyboard-reachable | M | Accessibility, measured |
| **1** | Bundle toolbar + pagination into the grid | L | Fixes the Sort-chip split |
| **2** | Pinned columns | — | **Possibly done** — verify |
| **3** | Sparkline sub-pixel gaps | S | Has a known gotcha |
| **4** | App header design review | M | No specifics given |
| **5** | Add Customer does not add data | — | **Possibly done** — verify |

---

## Reported by you, not yet written down until now

### ~~D1. Checkbox styling in the grid selection cells~~ — DONE, verified correct

Measured against Figma node by node. Every number agrees:

| | Figma | Measured |
|---|---|---|
| box | 20x20, radius 2, white, #b3b3c3 | same |
| indicator | 14x14 #3b4ccd | same |
| tick | 11x10 white | same |
| wrapper | 24x24, radius `4 0 0 4` | same |
| caret | 24x24, flush | same |

It had been fixed by the component swap and your three Figma tweaks. The seam
edges read back as `1px` in a probe, which looks wrong and is not — Chromium
rounds every sub-pixel border up. Recorded as
`T-a-sub-pixel-border-reads-back-as-1px`.

### D2. Four data-viz containers on the Records view

> "Add 4 data viz containers with widgets above the data grid container on the
> Records view. Make the visualisations share data with the records so that
> global filtering can be demonstrated to affect multiple components. Also 2 way
> bind the legend item toggling to filtering out the relevant data on the view.
> These filters should be added as custom filter chips on the app header filter
> toolbar."

**Blocked by C.** Without it this gets a second copy of all four aggregation
helpers. Note the app-header filters now reach the query, which is the half this
needs to demonstrate.

### ~~D3. Delete needs a confirmation dialog and a real mutation~~ — DONE `3b3d6242`

The mutation half was already right — `store.remove()` was a real data-layer
call. Added the confirm dialog, and the bulk actions moved back beside the CTA.

**Left open as B6:** the Delete button in that critical dialog still paints
accent blue.

### ~~D4. Error handling for failed data-layer mutations~~ — DONE `3b3d6242` (for delete)

The shape, now settled and tested: fail PER ITEM, carry the store's own reason
into the toast, never update the screen by hand, and keep the failed records
selected so the reader can retry.

**Still owed:** the same treatment for `insert` and `update`. The add/edit save
path has no `try` around it.

### ~~D5. Dialog footer horizontal padding~~ — DONE `97d7bb25`

The footer's zero inline padding is deliberate (a menu card has its own 8px).
Figma's Dialog pins `padding/sm` on its footer INSTANCE — a pin belongs to
whoever places the instance, so it went in the dialog.

**Also found and fixed:** the footer's top divider was drawn near-black
(#35353d) against the pale one the header draws. Figma binds #b3b3c3. Third
member of the `style-border` drift family.

### D6. Trim the data-grid comments into per-component docs

> "There are also a LOT of verbose comments in the data grid files. Comment
> explanations should be succinct. In depth explanations should be defered to
> technical documentation. We could add a sherpa-component-name-doc.md file to
> each component for this in depth documentation."

Note this cuts across `docs/TRAPS.md`, which is gated both ways — a trap cited
in code must exist in the doc and vice versa. Decide how a `-doc.md` relates to
TRAPS before moving text, or the gate will fight it.

---

## Raised 2026-09-21

### B6. A saturated button ignores a critical status — MEASURED 2026-09-21

Found while building the delete confirmation. In a `data-status="critical"`
dialog the heading and the Cancel button go red, and the **Delete button stays
accent blue**.

It is not that the cascade misses the button — it reads it. It reads the WRONG
STEP:

| token | critical value | what it is |
|---|---|---|
| `--_status-surface` | `surface-default-base` — **white** | the CARD's surface |
| `--_status-surface-strong` | `surface-critical-1` — red | the FILL step |

`data-look="saturated"` takes `--_status-surface`, which is white, so its own
`#3b4ccd` fallback wins. The gauge, progress bar and nav-item badge all use
`--_status-surface-strong` for exactly this reason.

**The obvious one-line fix does not work — I tried it and reverted.** Pointing
saturated at `--_status-surface-strong` / `--_status-text-on-color` turned EVERY
saturated button dark navy (#1e189c) with near-black ink, status or not. Those
two tokens are defined ONLY inside a `[data-status]` block, so outside one they
inherit whatever ancestor last set them rather than falling through to the
fallback — `var()` only uses its fallback when the property is genuinely unset,
and an inherited value is set. `sherpa-data-grid` already works around this by
resetting both to `initial` (line 546).

So this needs the fallback chain thought through, not a token swap. Either the
strong tokens get a neutral default at `:root`, or the button reads them through
something that can tell "no status" from "status, white surface".

Not urgent: the confirm dialog reads as critical through its heading, its ink
and its border. Only the primary button's fill is wrong.

### B7. A group checkbox stays indeterminate-looking after being clicked

> "If a group row checkbox is indeterminate then clicking it (which selects all)
> doesn't change the icon to checked."

The selection is probably right and only the icon is stale. Note the group boxes
are now `sherpa-select-checkbox` components, and the native rule is that clicking
an indeterminate checkbox resolves it to CHECKED — so this may be the host
writing `indeterminate` back after the click, not the component.

### B8. Contextual toolbar actions need 8px spacing

> "Contextual toolbar actions, in the Toolbar, should have 8px of spacing (use
> spacing token)."

The bulk actions the view stamps into `#bulk-actions`. Use the token, not a
literal — `--sherpa-display-mode-space-xs` is the 8.

### B9. Numeric filter chips should default to range

> "Numerical filter chips should default to having range set to true in their
> menu."

The grid's number column filter already has a range switch
(`.head-filter-range-switch`); this is about which way it starts. Check the
toolbar's numeric chips take the same default.

### ~~B5. Grid header chips don't light from the app header~~ — DONE

Half of it had already closed when the app-header filters were wired: the
`<th>` took `data-status="active"` correctly. But the heading is deliberately
NOT tinted (the CSS says so at length — "the column says so through its CHIPS"),
so the chip is the only visible signal and it stayed blank.

`#isFiltered` already knew the answer and it was being spent on the `<th>`
alone. The half that hid it: `#renderHead` never called
`#syncColumnFilterStatus`, so on any re-render the flag survived and the
rebuilt chip came back empty.

### ~~B1. "X items selected" is in the wrong place~~ — DONE `b3db74ed`

Moved to the toolbar's TRAILING zone, which Figma describes as holding "the item
count". The Add button no longer moves when a row is ticked.

### ~~B2. Last row cells have no bottom border~~ — DONE `b3db74ed`

It was the reverse of how it read: the last row draws no rule ON PURPOSE (the
grid's host draws the table's own bottom frame), and the pinned cells were
drawing an extra one. They now follow the same `:not(:last-child)` exception.

**Follow-up you spotted and I fixed** (`03bd4f1d`): that scoping also removed
the Actions HEADER's border, which had been arriving by accident from the same
blanket rule. It states its own now, as `.select-head` already did.

### ~~B3. An empty chip's body should open its menu~~ — DONE `f35df4b4`

Two boundaries kept it narrow: a chip HOLDING a value still cycles (off is a
state, not a delete), and a chip with no menu at all is untouched.

### B4. Data-viz tooltips lose their decimals

> "Tooltips on data viz should use the same unit magnitudes as the main value
> label (e.g metric value label, donut total value label etc.) to accurately
> portray value changes. Right now they seem to be truncated to whole numbers so
> decimal nuance is lost."

**Same root cause as C.** `meanOf()` does `Math.round` inside the aggregation —
a presentation decision made in the wrong place. The value label and the tooltip
must read the same formatter, not two that agree by luck.

### E — ASSESSMENT DONE 2026-09-21. One fix landed; findings below.

**Answering "how many of core's scripts need to be unique": 17 of 18, and the
18th has already been merged.** The file count is not the problem; it was one
missing export.

#### What was actually wrong — FIXED (`7261cae9`)

`IdbStore` could not reach `BaseStore`, because `BaseStore` lived inside
`stores.ts` and was not exported. So it re-implemented the shared half —
`totalCount` character for character, `check`, `checkRows`, `announce`, four
constructor fields `StoreOptions` already declared, and **its own error class**.

That last one was a live bug, not just duplication. `IdbValidationError` had the
same fields, the same message, and `this.name` set to the very same string
`'ValidationError'` — but was a different class, so the documented
`catch (e) { if (e instanceof ValidationError) }` was **false for every
IndexedDB refusal** while the log said otherwise. Measured before the fix.

`BaseStore` + `StoreOptions` now live in `base-store.ts`; all five stores extend
it. `ValidationError` moved to `validate.ts`. See
`T-one-class-to-catch`.

#### The five questions, answered by measurement

1. **Slot-presence → `data-has-*`: KEEP.** Tested in Chromium:
   `:host(:has(> [slot="foot"]))` is **dropped by the parser** — it is not in
   `styleSheets[0].cssRules` at all. `slot[name=x]:has(*)` parses but can only
   style the slot itself, not the rest of the shadow tree. The platform has no
   replacement; the attribute is the mechanism.
2. **Attribute coercion + declared-prop sync: KEEP.** `attributeChangedCallback`
   only *tells* you an attribute changed. `kind: content` WRITES text into the
   shadow DOM, which no platform API does. No overlap.
3. **Bootstrap: KEEP.** Fetching CSS/HTML for an unbundled library has no
   declarative equivalent. All three caches (`htmlCache`, `templateCache`,
   `sheetCache`) are module-level, so it is one fetch per URL for the whole app
   — already correct.
4. **Shadow queries: KEEP.** `$()`/`$$()` are two lines each and nothing has
   accreted around them.
5. **The five stores: ONE REAL FINDING, now fixed.** See above.

#### Why the other 17 modules stay separate

The DOM-free lint boundary is the real constraint, and it cuts through the
middle of this directory:

| DOM-free (9) | needs a DOM (9) |
|---|---|
| store, base-store, validate, pointer, chart-datum, format-tick, live-stores, data-source, aggregate | sherpa-element, stores, idb-store, persist-view, session, view-sync, view-markup, apply-state, icons |

Merging across that line costs the property the whole data layer exists for — a
server, a test and an MCP tool import the left column. Two that look mergeable
and are not:

- **`pointer.ts` → `session.ts`** (one internal consumer). But `pointer` is
  publicly exported from BOTH entry points and is DOM-free; `session` uses
  `localStorage`. The merge drags pointer arithmetic across the boundary.
- **`view-markup.ts` → `persist-view.ts`** (one internal consumer). Will's
  ruling 2026-09-21: the allow-lists STAY. They guard saved-view markup
  arriving from IndexedDB or a server, which is a different thing from
  authored content, so this is a security boundary and deserves its own file.

#### Still worth doing, not yet done

- **`sherpa-element.ts` is 808 lines in 8 sections.** Nothing in it is
  redundant, but the file is the largest in the repo. If it is split, split by
  SECTION (bootstrap / props / slots / events), not by guesswork.
- **`data-source.ts` at 683 lines** was not examined in depth. Item A
  (generalising grouping/sorting/filtering) will touch it anyway — assess it
  there rather than twice.

### E (original ask, for reference)

**The ask, verbatim:** "I'd like to assess all of the scripts in 'core' folder
to refactor them to reduce duplication and complexity. I feel like there's a lot
of code that is doing the work of native web component lifecycle or
functionality as well as other platform native functionality."

17 modules, 5,348 lines. The two biggest are where the suspicion points:

| module | lines | what it does |
|---|---|---|
| `sherpa-element.ts` | 808 | the base class — 8 named sections |
| `data-source.ts` | 683 | query state + binding |
| `stores.ts` | 603 | Array/Json/Rest/Local stores |
| `persist-view.ts` | 518 | saved views |
| `idb-store.ts` | 505 | IndexedDB |
| `live-stores.ts` | 360 | Event/Socket stores |
| `store.ts` | 349 | the query engine |
| (10 more) | 1,522 | |

`sherpa-element.ts`'s own sections: native lifecycle, bootstrap, slot presence,
the data path, attribute coercion, declared-prop sync, shadow queries + events,
lifecycle hooks.

**Where to look first, in the spirit of the ask** — each of these is a QUESTION,
not a finding:

1. **Slot-presence → `data-has-{slot}`.** The platform has `::slotted()` and
   `slotchange`; CSS can often select on a filled slot directly. Does the
   attribute earn its keep, or is it a JS mirror of something CSS can already
   see? (Note `T-a-data-has-attribute-must-not-share-a-slot-name` exists, which
   suggests it has at least one sharp edge.)
2. **Attribute coercion + declared-prop sync** (≈100 lines). This is the
   `static props` machinery. Some of it is genuinely ours — `kind: content`
   writing text into the shadow DOM has no platform equivalent. But the
   coercion half may overlap `attributeChangedCallback` more than it adds.
3. **Bootstrap.** Template fetch + `adoptedStyleSheets` + first render. How much
   is orchestration the platform would do given declarative shadow DOM or a
   plain `<template>` clone?
4. **Shadow queries.** `this.$()` / `this.$$()` are thin and earn their keep by
   making `shadowRoot.querySelector` unwritable — but check nothing heavier has
   accreted around them.
5. **Across modules, not just within one.** `stores.ts` + `idb-store.ts` +
   `live-stores.ts` are 1,468 lines implementing one interface five ways; the
   shared half (validation, the change event, `applyOptions` delegation) may be
   statable once.

**Two cautions, from this session's evidence:**

- **Measure before cutting.** `sherpa-audit-2026-09-17` records three findings
  in a previous audit that turned out to be wrong, and the rule that came out of
  it: a second implementation of a check is a second answer.
- **Some of the "duplication" is load-bearing.** `CLAUDE.md` says the per-edge
  border chain looks like duplication in 21 components and is not, because the
  edges genuinely differ. Expect the same shape here: ask what breaks before
  concluding something is redundant.

The gates are the safety net — 568 browser tests, 46 node tests, round-trip
specs, the DOM-free lint boundary and `check-traps`. A refactor that keeps all
of those green has not changed behaviour.

### ~~C. Data viz must be built FROM the data layer~~ — DONE `eb8d15a1`

> "Data viz should be built from data in the data layer and not bespoke."

`src/core/aggregate.ts` — `aggregateBy`, `countBy`, `bandBy`, `seriesBy`,
`reduceRows`. All four costs closed, including `run_query` now answering "count
by category".

**Two real bugs surfaced on the way**, both caught by tests before any chart saw
them: `Number(null)` is 0 and finite, so the obvious guard counted every missing
value as a nought (passes a sum, fails a mean); and the histogram's
`Math.min(4, …)` clamp put a full disk in the last band by accident while
silently counting an out-of-range 150 as a full disk too.

**Still owed from B4:** the aggregation no longer rounds, so the real number
reaches the charts. Whether each chart's tooltip and value label then FORMAT it
the same way is a separate pass.

Every chart's aggregation is hand-written in the example. The data layer defines
the SHAPE (`ChartDatum`) but nothing that PRODUCES one.

| helper | produces | read by |
|---|---|---|
| `countBy(rows, field, order)` | one bar/slice per value | bar chart, donut |
| `seriesByDay(rows, name, colorIndex)` | one named line series | line chart |
| `meanOf(rows, field)` | one 0–100 number | gauge |
| `byBand` (inline) | five storage bands | histogram |

Four costs: every new view copies it; a server can't pre-aggregate (and the
DOM-free half exists precisely so it can); MCP's `run_query` can't answer "count
by category"; and the rounding bug above.

**Worth deciding first:** aggregation is probably a QUERY, not a transform — if
it goes through `Store.load()`, a `RestStore` can push it to the server while
`ArrayStore` computes locally. A free function over `rows` cannot. And
`countBy`'s fixed-order rule must survive: sorting by count makes a category
change colour when only its rank moved.

### A — MEASURED 2026-09-21. The data layer is already generic; the COMPONENTS are not.

**Will's statement of the target, verbatim:** "UI components should fire change
events to the data layer, which then collates or transforms the data as needed,
then broadcasts the change/availability for all listening UI components to adapt
to."

**That is already what happens.** Traced live: one click on a grid column header
produced `sort-change` → the source collated it → it broadcast to all three
bound components (grid, toolbar, pager), each getting five `data-*` attributes.
No component talked to another. The data layer has ONE event list
(`STEERING_EVENTS`, 8 entries), ONE `#steer` and ONE `#push`.

So the work is not in `data-source.ts`. It is that components do not yet hold up
their end.

#### What was wrong, and is now fixed (`4455f6e1`)

The grid's third sort click DELETED the column; the Sort chip SUSPENDED it. Both
cycled three ways and disagreed about what the third state keeps — the "known
issue" below, and a breach of `T-a-chip-body-cycles-its-states`.

The grid could not simply keep the column, because **the source owns every bound
element's `data-*`** and wiped it on the next push, one microtask later. So
suspension moved to the one owner: `ViewState.sortSuspended`. See
`T-a-suspended-sort-is-one-owners-job`.

#### The remaining gap, measured

**`data-locked` is implemented by 1 component out of 58.**

It is the system's own answer to "a host owns this value": a locked component
reports its interaction and stops writing its own state.
`sherpa-quick-filter` honours it. Nothing else does — and **`DataSource.bind()`
never sets it**, so binding a component does not lock it.

The consequence is visible in the trace: the grid writes `data-sort-field`
itself AND emits the intent, so the source writes the same value again. The grid
is both reporter and owner of one value, which is the exact shape
`T-state-ownership` warns about.

**It is not a simple bug, and must not be "fixed" by deleting the self-write.**
Every grid test runs the grid UNBOUND, with no `DataSource` — so the self-write
is what makes a standalone grid work at all. A component has to behave in both
worlds.

#### The shape of the work

1. **`bind()` sets `data-locked`, `unbind()` removes it.** One line in the data
   layer; the mechanism already exists.
2. **Components honour it**: bound → report the intent and let the broadcast
   come back; unbound → write their own state, exactly as now. The grid, the
   toolbar and the pager are the three that steer.
3. **A shared state-cycling helper.** `asc → desc → suspended → asc` is written
   twice (grid `#onSortClick`, toolbar `#cycleSort`) and the two drifted. The
   ratified rule — a body cycles its states, none of them clears — is one
   function, not a convention each component re-reads.
4. **Then filtering and grouping**, which have the same two-writer shape.

Not started. `T-a-suspended-sort-is-one-owners-job` is the worked example of the
answer for one value.

### A (original ask, for reference)

> "There are now a lot of components that can affect grouping, sorting, and
> filtering that could affect other components in a view. So we should look at
> genericising this functionality as much as possible into the sherpa-element
> (or wherever makes sense) and data layer components. This will allow us to add
> this functionality to any other component further down the line without
> worrying about bespoke implementations and conflicts."

Today each participant implements its own half:

| component | grouping | sorting | filtering |
|---|---|---|---|
| `sherpa-data-grid` | page starts, group rows, group select | header chips + `data-sort-*` | column filters |
| `sherpa-quick-filter-toolbar` | the Group chip + radios | the Sort chip's 3 states | the filter chips |
| `sherpa-quick-filter` | — | — | its own menu + `data-current` |
| `DataSource` | view pages, no skip/take while grouped | `setSort` | `setFilter` |

Nearly every bug in this area this week has been the same one wearing a
different hat: two of these deriving a value neither owns, or one suspending
where the other clears.

Look for: a shared vocabulary for "an enumerated state" (the chip-cycling rule
is re-implemented per chip type); one owner per value, declared rather than
remembered; the data-layer half is already generic, the mess is on the DOM side.
A generic path must not become a second one beside `applyState`.

**B5 feeds this** — do it first and learn from it.

---

## Older, already in the backlog

### 0. No chart is keyboard-reachable — MEASURED 2026-09-17

All five charts have **zero** tabbable elements. The sparkline has 8 buttons,
all of them inside `aria-hidden`.

### 1. Bundle the toolbar + pagination INTO `sherpa-data-grid`

You chose: "Grid owns both, slots for extras."

Solves the **known issue** below by construction: the grid's column-header sort
and the toolbar's Sort chip are two pieces of state that can disagree. Overlaps
item A — decide which shape wins before starting either.

### 2. Pinned columns

**Possibly done — verify.** The selection column and the actions column are both
pinned now, with a scroll-under border. The item also asks for a shadow on the
pinned edge, which may not be.

### 3. Sparkline sub-pixel gaps

Use CSS `round()` to close hairline seams between segments. **Known gotcha:**
`round()` is recorded in this codebase as a deliberate no-op, so check why before
assuming it works.

### 4. App header — another design review pass

You said: "still not to spec." No specifics given, so start by data-matching it
against Figma property by property rather than guessing.

### 5. Data grid: Add Customer does not add data

**Possibly done — verify.** The Records example now has a working add path
through the store. The item asks for five things: the whole record, where the
row lands against the active sort, whether a filter hides it, pagination totals,
and the same gap in edit/delete.

---

## Known issue (not queued — do not patch separately)

**The Sort chip is not linked to the grid's column-header sort.** Two separate
pieces of state that can disagree. This is what item 1 is meant to solve by
construction — patching it on its own would add a third opinion.

The tri-state cycle itself is already fixed.

---

## In progress

**Show ALL tooltips on chart hover — superseded.** Your final ruling: no visible
markers, one tooltip. Done for the donut, gauge and sparkline. **The line and bar
charts still use visible markers** — they need bringing in line.

---

## Owed from earlier passes

- Sweep every component's projected properties for mode/extension resolution
  faults. Fixed for the known cases; the full sweep was never done.
- ~20 components fail the def round-trip. Pre-existing, from the def generator's
  old regex faults (now fixed). The defs need regenerating and checking.

---

## Not queued, but blocking something

**The Figma DTCG token exporter is broken.** A fresh export writes the literal
string `"[object Object]"` for 234 of 776 leaves, losing both the alias
reference and the opacity half of every `COMPOSE_COLOR` wrapper. Running
`project-tokens.mjs` on that output would paint 300+ colours as garbage.

Nothing is blocked today — the one token change needed was applied by consuming
the ramp directly. But **the next real token change cannot be projected** until
this is fixed.
