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
| **B5** | Grid header chips don't light from the app header | S | Finishes a bug you reported |
| ~~**B1**~~ | ~~"X items selected" is in the wrong place~~ | — | **DONE** `b3db74ed` |
| ~~**B2**~~ | ~~Last row has no bottom border~~ | — | **DONE** `b3db74ed` |
| **B3** | Empty chip's body should open its menu | S | One rule, one component |
| **B6** | Saturated button ignores a critical status | M | Measured; obvious fix fails |
| ~~**D5**~~ | ~~Dialog footer horizontal padding~~ | — | **DONE** `97d7bb25` |
| **D3** | Delete needs a confirm dialog + a real mutation | M | Data loss risk today |
| **D4** | Error handling for failed mutations | M | Pairs with D3 |
| **D1** | Checkbox styling in grid selection cells | S | May already be done — verify first |
| **B4** | Data-viz tooltips lose decimals | S | Same cause as C |
| **C** | Data viz built from the data layer | L | Blocks D2 |
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

### D1. Checkbox styling in the grid selection cells

> "Checkbox styling is still not correct in the advanced checkbox or in the grid
> selection cells. Should match the advanced and basic checkbox designs in
> Figma"

**Verify before starting.** Since you raised this, the grid's bare `<input>`s
were replaced with real `sherpa-select-checkbox` components, and the checkbox
took your three Figma tweaks (border colour `style-border/base +1`, width
`border/width/sm` 0.5, rounding `border/rounding/sm` 2). It may already be
right. Check against Figma before doing anything.

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

### D3. Delete needs a confirmation dialog and a real mutation

> "The 'Delete' action on the Toolbar should show a dialog, critical status,
> asking for confirmation of deletion. Also, deletion should be a data layer
> mutation before updating the client."

Two halves. The dialog is `sherpa-dialog` with `data-status="critical"`, opened
with `.show()` — not the native `showModal()`. The mutation half matters more:
delete must go through the Store and only update the screen once it succeeds.

### D4. Error handling for failed data-layer mutations

> "look at error handling when making changes on the data layer. If we try
> something and it fails then we need to handle it."

Pairs with D3 — a delete that fails is the first case. Worth deciding the
general shape once: what a failed `insert`/`update`/`remove` does to the screen,
and what the reader is told. `DataSource` already treats a failed LOAD as a
state rather than a throw; mutations should match.

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

### B5. Grid header chips don't light from the app header

**Measured after the header filters were wired.** Filtering by Region in the app
header narrows the grid correctly, and the Region column's own chip stays unlit.

The grid lights a column heading from `#columnFilters`, which only the grid's own
menu writes — a filter arriving through the query is invisible to it. Same shape
as item A.

This is the remaining half of your "binding only seems to be 1 way" report.

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

### B3. An empty chip's body should open its menu

> "When a filter chip has no value selected then clicking on the left side (with
> the field name) should open the chip's menu. This doesn't apply to an inactive
> chip with a value already set."

The body currently cycles the chip's states. This is the empty case only: with
nothing to toggle, toggling is a no-op, so the body opens the menu instead. A
chip that HOLDS a value keeps cycling.

### B4. Data-viz tooltips lose their decimals

> "Tooltips on data viz should use the same unit magnitudes as the main value
> label (e.g metric value label, donut total value label etc.) to accurately
> portray value changes. Right now they seem to be truncated to whole numbers so
> decimal nuance is lost."

**Same root cause as C.** `meanOf()` does `Math.round` inside the aggregation —
a presentation decision made in the wrong place. The value label and the tooltip
must read the same formatter, not two that agree by luck.

### C. Data viz must be built FROM the data layer

> "Data viz should be built from data in the data layer and not bespoke."

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

### A. Generalise grouping / sorting / filtering

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
