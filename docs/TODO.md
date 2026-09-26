# TODO

The list of open work. One file. Add to it, tick items off, do not start a second one.

Status: `[ ]` open · `[~]` in progress. A DONE item leaves the body and gets one
line under **Done**, at the bottom — git and `docs/TRAPS.md` keep the detail.

**A bug is queued like any other item.** Will, 2026-09-26: bugs do not demand
immediate attention. Add it here, in its place in the order, and carry on.

---

## At a glance

**50 open.** Reviewed 2026-09-26: one list (the draft `todo-filter-2609.md`
is merged in), 3 items culled or merged, the rest re-ordered. Numbers are ids,
not order — the table IS the order.

| Pri | # | Item | Kind |
|---:|---:|---|---|
| | | **A — Quick wins** | |
| 1 | 40 | A switch has no accessible name | quick |
| 2 | 17 | Breadcrumbs are for workflow, not for the nav | quick |
| 3 | 54 | An Added Filters row drills only if it has many values | quick |
| 4 | 57 | The filter panel's width is a hard-coded 400px | quick |
| | | **B — Bugs: the app says one thing and does another** | |
| 5 | 41 | A conditional filter applies for Owner only | bug |
| 6 | 63 | A conditions-only field shows the Conditional switch | bug |
| 7 | 56 | A view change leaves a lit chip that filters nothing | bug |
| 8 | 21e | A reload keeps a filter nothing on screen shows | bug |
| 9 | 55 | The At risk view's own column filter never applies | bug |
| 10 | 44 | A column heading's menu does not show what is set | bug |
| 11 | 42 | A legend toggle filters the whole view | bug |
| 12 | 61 | Add customer saves with required fields empty | bug |
| 13 | 43 | The toolbar ⋯ overflow menu shows nothing | bug |
| 14 | 45 | A picked date does not show in the chip | bug |
| 15 | 16 | Favourite and Save apply to the Context, not the View | bug |
| | | **C — Filters: Will's features** | |
| 16 | 62 | Apply and Discard only for a REMOTE fetch; a debug flag spoofs one | feature |
| 17 | 46 | A PENDING state: changed, not yet applied | feature |
| 18 | 60 | Once applied, a chip's badge shows the number of results | feature |
| 19 | 49 | A preset conditional chip shows its conditions, read-only | feature |
| 20 | 50 | A custom conditional chip shows its conditions, editable | feature |
| 21 | 47 | More than 20 values: one chip, not a run | feature |
| 22 | 48 | A child menu opens on hover or click of its row | feature |
| 23 | 21c | A condition's matches must ALL highlight | feature |
| 24 | 21f | "Send to view filters" | feature |
| 25 | 21b | Which header chips carry over between views | feature |
| 26 | 20b | The Date filter should be a view-scope date RANGE | feature |
| 27 | 21d | EXPLORE — conditions for a DATE field | explore |
| 28 | 52 | EXPLORE — a data viz scope in the filter panel | explore |
| | | **D — The filter family, finished** | |
| 29 | 38 | One model, one builder, one owner — what is left | refactor |
| 30 | 37 | Components are AGNOSTIC of the data and of the example app | refactor |
| | | **E — Views and navigation** | |
| 31 | 15 | Save a View, and the Save split-button menu | feature |
| 32 | 17b | At the mobile breakpoint the nav becomes a menu | feature |
| 33 | 34 | Figma: use the Navigation terms | figma |
| | | **F — Data states and charts** | |
| 34 | 58 | Loading, empty and error states in a container | feature |
| 35 | 9b | A Data Viz header, for metrics and chart containers | component |
| 36 | 14 | An example of real-time data | feature |
| 37 | 59 | EXPLORE, later — Will's own loading pattern | explore |
| | | **G — Overlay panels** | |
| 38 | 22 | The `Ask N-zo` panel — wider, and resizable | feature |
| 39 | 23 | A focused grid row opens a details panel | feature |
| | | **H — The accessibility gate** | |
| 40 | 24 | Playwright tests accessibility — WCAG 2.1 AA | gate |
| | | **I — The big builds** | |
| 41 | 25 | `sherpa-layout-canvas` + minimap | component |
| 42 | 26 | A `Grouped` mode for the content area, and plain grid templates? | feature |
| 43 | 27 | A consumer can supply their OWN templates and CSS | feature |
| | | **J — Tidy-ups and renames** | |
| 44 | 11 | `sherpa-group`: what is left | tidy |
| 45 | 28 | A Figma component is NOT always a web component | tidy |
| 46 | 30 | Do we still need `icon-paths.ts` and `render-icon.ts`? | tidy |
| 47 | 33 | Density as step offsets, and a breakpoint step | tokens |
| 48 | 36 | CSS: compiled where it should inherit? | tidy |
| 49 | 11d | `data-type` means nine things; `data-empty` means three | tidy |
| 50 | 29 | Rename `src/index.ts` to `src/app.ts` — dead last | rename |

**Why this order.**

1. **A — quick wins.** Each is under an hour and needs no design. 57 needs one
   answer from Will first: 3 columns or 4.
2. **B — bugs, the ones that LIE first.** A chip lit that filters nothing, or
   rows filtered by something no chip shows, teaches a reader to distrust
   every filter. 41–21e are that. Five of them are one cause — two controls
   holding one field — so fix them as 38 step 3 (see 38), not as patches.
3. **C — Will's filter features, in dependency order.** Remote-only Apply
   (62) before pending (46), since it decides which fields can pend; pending
   before result counts (60), since a pending chip has no count yet; the read-only
   `fx` menu (49) before the editable one (50); 56 before 21b; the date
   formatter (45) before the date range (20b) before date conditions (21d).
4. **D — the rest of the filter family**, once B has moved what it can.
5. **E–G** are independent of each other; do them in any order.
6. **H — the accessibility gate** comes after the work that changes markup, so
   its report does not go stale, and before I, so new components must pass it.
7. **I and J last.** 29 dead last: it touches every import.

---

## A — Quick wins

### `[ ]` 40 — A switch has no accessible name

`sherpa-switch` does not pass an `aria-label` to its inner `role="switch"`
input, and its visible text is a sibling span. So the Range and Conditional
switches are unnamed to a screen reader. Mirror `aria-label` onto the input,
or label the input by the text beside it.

### `[ ]` 17 — Breadcrumbs are for workflow, not for the nav

Breadcrumbs must not show movement between Contexts — the nav does that. They
are for a workflow redirect or a drilldown, e.g. a link in a grid cell opens a
details Context.

**Still wrong, measured 2026-09-26, and small.** Records and Assistant set a
`Home › Records` / `Home › Assistant` trail (`examples/contexts/records.js`,
`chat.js`) — Home is the Dashboard Context, so the trail IS nav movement.
Drop both; Dashboard already sets `[]`. The first real trail comes with a
drilldown (23).

### `[ ]` 54 — BUG: an Added Filters row drills only if it has many values

Will: a row in the Filters menu's Added section gets a child menu only when
its field has MULTIPLE values. A one-value field (a preset, a toggle) has
nothing to drill into. See `DRILL_FLAGS` and `filtersMenuItems()` in
`src/core/ui/filters-button.ts`.

### `[ ]` 57 — The filter panel's width is a hard-coded 400px

Found by the 2026-09-26 audit. The shell's panel areas read
`--sherpa-panel-area-width`, which is defined NOWHERE
(`sherpa-app-shell.css:130`), so it is always its 400px fallback. The comment
there says 4 columns.

**Will, 2026-09-26: 3 columns — and KEEP the shell's panel areas.** *"We need
to consider the other containers in the view and their responsiveness. The
left/right panel areas that we have might be the better solution (it works
well right now, tbh)."* So the panel stays in the app shell's left area,
OUTSIDE the content's layout grid, and the grid's containers keep their own
breakpoints. The change is the width: define the token as 3 of the layout
grid's columns plus their gutters, per breakpoint. Then check, with the panel
open, that every container in Records and Dashboard still re-flows as it does
with the panel shut — the grid is narrower, not re-counted. Fix the comment
to say 3.

### `[ ]` 41 — BUG: a conditional filter applies for Owner only

Will: *"Conditional filters don't apply or go active at all for any field other
than Owner."* Owner is the only chip def with `custom: true`
(`examples/contexts/records.js`); every other conditioned field arrives through
the Filters (Add) menu or a column heading. Look first at how an ADDED field,
or a heading's condition, reaches the source.

Reproduce on the running page and read the TOTAL
(`source.debugState().total`), never the drawn page. Try the same field as a
toolbar chip, a panel field and a column heading. Fix 63 in the same pass.

**A lead, measured 2026-09-26.** The panel's Apply (`records.js`) sends the
four `FIELD_CHIPS` — Status, Plan, Tier, OWNER — through `source.select()`,
and every other field through `bar.setChipReading()`. That sets
`menu.conditions` SILENTLY: the chip's value and tooltip are not redrawn
(a probe read an empty tip and value after it). Owner working and the rest not
is exactly that split.

### `[ ]` 63 — BUG: a conditions-only field shows the Conditional switch

Will, 2026-09-26: the panel's Email field shows the Conditional switch, but
Email is CONDITIONS-ONLY — there is no list to switch to. The menu already
hides its own switch for `data-custom-only`
(`T-a-filter-answers-by-values-conditions-or-both`); the panel does not. Its
`data-custom-ok` is `!!customOf(def)` (`sherpa-filter-panel.ts`), and
`customOf()` answers `'only'` for Email, which is truthy. So: no switch for
`'only'`, and the field opens in custom mode with its rows showing.

**Fix it with 41**, as Will suggests — both are how a conditioned field is
drawn and answered, and a test that walks every conditioned field's panel,
chip and heading covers both.

### `[ ]` 56 — BUG: a view change leaves a lit chip that filters nothing

Found by the 2026-09-26 audit. Region = EMEA (27 rows), then the My accounts
view: the Region chip stays `data-current`, but its `global` part is dropped.
12 rows — all of Ravi's; EMEA would be 5. A lit chip must filter, or go off.
21b decides whether the chip SHOULD survive; this is that it must not lie.

### `[ ]` 21e — BUG: a reload keeps a filter nothing on screen shows

Will, 2026-09-24:

> Filters & conditional filters need to survive page refreshes and navigating
> away and coming back. So they need to be compiled and stored in the data
> layer. They don't need to survive the session.

**Half-built, and wrong.** Measured 2026-09-26: `persistView` stores the whole
filter as ONE flat query. Region = EMEA + Status = active (4 rows), reload:
still 4 rows, but parts `{}`, selections `{}`, and no chip lit. Navigating
away and back is the same. The rows obey a filter the reader cannot see or
clear.

**What to store is the COMPILED form, per field** — each field's picks,
conditions and suspended flag, plus the named `contribute()` parts. That is
what a reload must give back to the chips, and what `ViewSnapshot` will want.

| | |
|---|---|
| WRITE | on every `quick-filter-change` / `condition-change`, keyed by Context |
| READ | at Context load, BEFORE `bind()` — a bar painted then re-filtered flashes |

SessionStore, not IdbStore: a reload keeps it, closing the tab does not. The
panel-or-toolbar mode already persists this way (`session '/filters/mode'`,
24c3a57c) — done.

### `[ ]` 55 — BUG: the At risk view's own column filter never applies

Found by the 2026-09-26 audit. At risk sets
`grid.setColumnFilter(status, ne churned)`, and 9ms later the selection
handler (`examples/contexts/records.js` ~783) calls
`setColumnFilter(status, null)`. So At risk shows 20 rows where it should show
13. And a `col:status` chip stays on the bar, `data-current` with no value,
still lit after going back to All customers.

(The old bug — All → At risk → All left 1 page of 4 — is fixed.)

### `[ ]` 44 — BUG: a column heading's menu does not show what is set

A heading's filter menu does not show the ticked values or the conditions
already set on its field, at view or component scope. So a reader can apply a
filter that contradicts the one in force. The heading must read the state the
chip and the panel read — a second view ASKS the first.

### `[ ]` 42 — BUG: a legend toggle filters the whole view

Will: *"Chart legend toggling is behaving like View scope filtering. They
should only affect their chart."* This was fixed on 2026-09-24
(`bindSelection` `scope: 'component'`, `T-a-filter-applies-down-its-scope`),
so something has undone it. Find what, and add the test that would have
caught it.

### `[ ]` 61 — BUG: Add customer saves with required fields empty

Will, 2026-09-26: the Add customer dialog let him save with Name and Email
empty. `#f-name` and `#f-email` carry `required`
(`examples/templates/records.html`), and `sherpa-input-text` has `validate()`,
`checkValidity()` and `data-error` — but the Save handler
(`examples/contexts/records.js`, `#save-btn`) asks none of them. Worse, it
FILLS the blanks: a blank name becomes `New customer`, a blank email a made-up
`new.customer@example.com`.

**Use and handle required-field logic, once, for every form.** Save checks
every field, shows each one's error, focuses the first invalid one, and saves
nothing until all pass. Prefer the platform: a native `<form>` and
`reportValidity()` reach a shadow-DOM input only if it is form-associated
(`ElementInternals`) — check `sherpa-input-text` first. The fallbacks go.

**And did it save at all?** Will could not tell. `store.insert` runs, but the
new row is created TODAY with status `trial`: the header's Date chip (2024
data), the current view, the sort or the page can each hide it. Measure with
`source.debugState().total` before and after. Then make the result visible —
the toast says where the row went, or the grid shows it.

### `[ ]` 43 — BUG: the toolbar ⋯ overflow menu shows nothing

The ⋮ `overflow` button ("More actions") opens no items. With every action
overflowed, the menu is, from the top:

- Suggest filters
- Reset filters
- Show Filter Panel
- *(divider)*
- Favorite
- Save view
- Save view as
- Refresh view

### `[ ]` 45 — BUG: a picked date does not show in the chip

After a pick in the calendar the chip's right half stays empty. The formats:

| picked | reads |
|---|---|
| one day | `DD Mmm YYYY` |
| a range | `DD Mmm YYYY to DD Mmm YYYY` |
| a range in one year | `DD Mmm to DD Mmm YYYY` |
| a range in one month | `DD to DD Mmm YYYY` |

Build ONE shared formatter in the data layer, DOM-free, beside
`format-tick.ts`, so every date label reads the same. More formats will join
it later; this is the first. (The range chip reads `02 Jan - 11 Dec, 2024`
today — a third spelling.)

### `[ ]` 16 — BUG: Favourite and Save apply to the Context, not the View

The ★ stars the Context (`examples/index.html` ~396, the `view-favorite`
listener), so it applies to every View in that Context. It must apply to the
one View.

---

## C — Filters: Will's features

### `[ ]` 62 — Apply and Discard only for a REMOTE fetch; a debug flag spoofs one

Will, 2026-09-26: *"Apply and Discard are actions that are only needed if
there is a data fetch that reaches outside the Data Layer. If the change is
just shaping data that's already in the data layer then there's no need."*

- **The panel footer goes.** A field whose change needs a remote fetch shows a
  small, ICON-ONLY Apply and Discard at the right of its section header row,
  beside Clear. Every other field applies as it is changed.
- **The same rule reaches a chip's menu.** Its Apply/Cancel (`commit: true`,
  `data-commit` — Owner and Region today) is only for a remote field too.
- **"Remote" is a fact about the FILTER**, so it is on the filter def and
  asked of the data layer — never guessed by a component.

**There is no remote source, so spoof one.** A DEBUG attribute/property on a
filter pretends that its change fetches from a remote source — a delay, and
optionally a failure. Sprinkle it into the example filters so both paths are
always on screen. 58 (loading, empty and error states) reuses the same flag to
drive its loading and failure states.

Before 46: a pending state only exists on a field that has an Apply, and this
item decides which fields those are. `T-apply-and-discard-wait-for-a-change`
changes with it.

### `[ ]` 46 — A PENDING state: changed, not yet applied

A chip that goes straight to active before its change is applied misleads the
reader. Between the change and Apply, a chip is PENDING: an active purple
BORDER, no fill. A conditional chip is the same — it turns green only once
applied. Only a committing (Apply) field has a pending state — after 62, that is a
REMOTE one; a field that applies at once goes straight to active.

A state is a pin, as data (`scripts/figma-data/state-pins.yaml`), not a
colour rule in the chip. Check what the pin's surface resolves to first.

### `[ ]` 60 — Once applied, a chip's badge shows the number of results

Will, 2026-09-26: when a filter change is APPLIED and its results are fetched,
the chip's badge shows the NUMBER OF RESULTS. It replaces what the badge says
today — a count of picks, or `fx` (`T-a-condition-badge-says-that-not-which`,
which changes with it) — and it replaces Will's first ask, a count of
conditions (the tip says that now). The picks stay in the tip.

**Decided, Will 2026-09-26: the rows THIS chip's own answer matches** — not
the whole filter's total, which would put one number on every chip. Counted
out of what the chip's scope can see: a component chip counts within the
rows the View already allows. A pending chip (46) has no results yet, so it
shows no number until Apply. Read the count from the source
(`debugState().total` is the measure; the pager reports pages only).

### `[ ]` 49 — A preset conditional chip shows its conditions, read-only

A PRESET conditional chip (a saved filter the app ships) gets the `fx` button
in the Success look. It opens a menu of its condition rows, read-only. It sits
on the chip in the toolbar, in the section header in the panel, and on a column
heading — only those three. Everywhere else a filter changes mode with the
Conditional switch (done 2026-09-26).

**Later, with 50:** Success is the look of a WORKING condition. Warning and
critical are free for a condition that cannot apply, or a filter that failed
to — Will's note, not asked for yet.

### `[ ]` 50 — A custom conditional chip shows its conditions, editable

The same `fx` button, with rows that can be edited. On a SAVED custom filter
that is applied, an edit is a temporary DRAFT; the saved filter does not
change. When the draft differs, the menu and the panel section header offer
Save. Needs 49, and 46's pending look for the draft.

### `[ ]` 47 — More than 20 values: one chip, not a run

A panel field with more than 20 values draws the toolbar's single chip, with a
dropdown of its values, not one chip per value. It is the flag 38's builder
already needs: whether values EXPLODE into a run or stay behind a menu.

### `[ ]` 48 — A child menu opens on hover or click of its parent row

Not from a caret button nested in the row: the whole row is the door, as in an
OS menu. The panel's drill is click-only on purpose (a passing pointer drilled
the list away), so give hover a short delay, or rule per host.

### `[ ]` 21c — A condition's matches must ALL highlight

Will, 2026-09-24: *"there will be multiple strings to match and highlight. Not
just one."*

`.cell mark.match` marks ONE substring. `filterNeedles` keeps one needle per
field (`store.ts:255`, `seen.has(field)`), and the grid marks one hit
(`sherpa-data-grid.ts` `markNeedle`). A field answered by
`Contains "ab" or Starts with "R"` has two strings; a three-row chain has
three. The mark is already Success green, matching the chip
(`T-a-conditioned-chip-reads-as-success`), so only the FINDING changes.

### `[ ]` 21f — "Send to view filters"

Will, 2026-09-24:

> Add an option to 'Send to view filters' for local scope filters. This will
> elevate them from their component toolbar to the app-header toolbar and allow
> it trickle down across all view components/data. Include this next to clear
> and remove buttons in the panel.

A third action in a data-scope field's header, beside Clear. `source.move()`
is the one call that does the promotion, and the header's `filter-add`
already uses it. The values travel with the field — a field promoted while
filtering by `active` keeps that. Promoting Status must not give the header
TWO Status chips: the move consumes the header's available entry.

The reverse trip is not asked for. Leave it until it is.

### `[ ]` 21b — Which header chips carry over between views

Will, 2026-09-24:

> App header filters shouldn't carry over between preset or custom views unless
> already set in the initial view definition. The View chip is obviously a
> different scenario altogether. Which chips carry over should be CONFIGURABLE
> though, in case we do want to persist things like Customer and Region later.

A chip def gains one flag, two answers: reset on a view change (the default),
or SURVIVE it. The View chip is neither; it IS the thing that changed. No flag
exists yet. Fix 56 first: today a chip survives in LOOK and not in FACT.

### `[ ]` 20b — The Date filter should be a view-scope date RANGE

Will, 2026-09-23: a top-level date range that slices the records across the
whole view. It is at view scope now — "Date", over `source.timeField`
(cae7e964) — but still `kind: 'date'`, single by default with a Range switch,
over a list of `availableDates` (`examples/contexts/global-filters.js`).

A VIEW-scope date wants range by default; a component-scope one keeps single,
where one day is the common case. Settle whether `kind: 'date'` gains a range
variant or the chip takes the menu's `data-range`. A range wants bounds —
`dates[0]` and `dates.at(-1)` — not a set of days.

### `[ ]` 21d — EXPLORE: conditions for a DATE field

Will, 2026-09-24. **Design before code.** A date is not a string, and the text
ops say nothing about one:

| condition | takes |
|---|---|
| On | a date |
| Before / After | a date **and** a time |
| Between | two dates **and** two times |
| Last X / Next X | a DURATION — `7 days`, `3 months` |
| Includes | a toggle per weekday? |

Will: *"Much more complicated than current conditional filters."* A row shows
ONE control per `OP_TAKES` answer (`list`, `text`, `range`); these want a
calendar, a time (no control exists), two of each, or a number-and-unit. And
`Includes` may be a second axis, not a condition. `OPS_FOR_TYPE['date']` is
`[]` on purpose today; this item reopens that.

### `[ ]` 52 — EXPLORE, later: a data viz scope in the filter panel

A legend toggle IS a filter (see 42), so a chart could have its own component
scope in the panel. It may want chips for its AXES or its AGGREGATION, the way
the grid has Group and Sort. Larger; design first. After 42, and after 38
step 3, which puts scopes in the data layer.

---

## D — The filter family, finished

### `[~]` 38 — One model, one builder, one owner: what is left

Will, 2026-09-25: *"I'm juggling bugs here between the filter panel and filter
toolbar when the overlap is considerable so the code should be singular, and
reused, where possible."* The full review is `docs/FILTER-REVIEW.md`.

Will's taxonomy stands: **six KINDS** — group, sort, boolean, single, multi,
conditional. "Organise" is a label, never a kind.

**Done:** 1 the chip owns its kind · 2 one derivation of a kind
(`core/ui/filter-kind.ts`) · 5 sort/group state collapsed (fe8eba65) · 5.5
error reporting, `report()` / `onReport()` (7c1a36d3) · 6 `filter-state.ts`
split into state, face and `bind-selection` (4f747cae).

**Step 3 — the data layer coordinates — is PART done.** The scope registry
(`scope`/`hold`/`holds`/`scopeOf`/`move`), `debugState()`, the panel no
longer reaching into the bar (789fe50b), and menu borrowing gone
(`menuFor()`). Left:

- The panel is bound to NO `DataSource`. `records.js` carries readings between
  the panel and the bars by hand (~472-510), and still reads the header bar's
  shadow root (~419). Both go when the panel binds.
- Auto-registration does not exist: a component should find its source by a
  request on connect that the nearest source answers (decided 2026-09-25).
- "Scope" still means three things — query reach (`view`/`component`), which
  rows a bind is pushed (`page`/`all`), and the app's surfaces (`view`/`data`).
  Rename them apart.

**Step 4 — ONE field-row builder — is NOT done.** It was ticked at −21 lines
(b67266f8), but that is one chip builder per container. The panel keeps its
own `#draw`, `#drawSection` and `#drawField`. The two differ by the layout
DIRECTION and whether values EXPLODE into a run — two flags (and 47's), not
two implementations.

**The size gate was never built.** `scripts/size-baseline.json`, a per-component
line count that may only fall, as `lint:css` does for Theme reads. Since the
plan: the panel 898 → 1288 lines, the toolbar 1857 → 1982. Rules for the work:
MOVE code, never rewrite it; delete the replaced path in the same commit; no
helper with one caller; state the budget up front and report the actual.

**Five bugs in B are this step, wearing different clothes** — 41, 44, 55, 56
and 21e are each two controls holding one field and disagreeing, and four of
them live in the glue `records.js` carries by hand. Fix each at its cause:
where the cause is that glue, MOVE the state into the source rather than
patching the glue. The bug fix and this step are then the same commit.

**Then its own item:** a component DECLARES the data it needs (`data-field`,
`data-aggregate`, `data-series-by`) and the source composes it. The example
hand-builds 9 components through `as` closures over ~569 lines.

### `[ ]` 37 — Components are AGNOSTIC of the data, and of the example app

Will, 2026-09-25:

> All sherpa UI components should be agnostic of the data. The data layer
> should provision and inform them. They also shouldn't have any bespoke logic
> in them specific to the example views. [...] For example toggling to the
> filter panel, from the filter toolbar, should be a custom button added to the
> actions slot [...] In fact, we should probably separate the example app to
> it's own codebase and have it use the sherpa-ui framework library as a
> dependency.

1. **Find the bespoke logic.** Still true, measured 2026-09-26: both toggles
   are built in — `data-act="configure"` in the toolbar (emits
   `filter-configure`) and `.to-toolbars` in the panel. The toolbar's `actions`
   slot is not used for it.
2. **Components take PARAMETERS, never data shapes.** A component should not
   know a field is called `openTickets`. Measure what still does.
3. **Extension, not forking** — item 27 is the mechanism.
4. **Split the example app into its own repo**, LAST. Anything it cannot do
   from outside the library is a boundary the library has not drawn.

---

## E — Views and navigation

### `[ ]` 15 — Save a View, and the Save split-button menu

Not started, measured 2026-09-26: only Dashboard saves a view
(`dashboard.js`, asks in a dialog since f8dfd128); Records has no `view-save`
handler; `viewOptions` is a flat list.

**Save** writes the current View — layout, content and its WHOLE filter
configuration — to a view definition. **Load** from the View chip's menu, in a
`Custom Views` section at the BOTTOM. **A name clash** in `Presets` or
`Custom Views` appends ` - Copy-001`.

**The menu button, right of Save:**

| Option | What it does |
|---|---|
| `Save As` | A dialog. The user edits the View name, then saves or cancels. |
| `Delete View` | Critical style. A dialog asks to confirm. ONLY a custom View. |

### `[ ]` 17b — At the mobile breakpoint the nav becomes a menu

Not started. At mobile width the rail is GONE and a menu takes its place.

- **The trigger:** a menu button in the App Header, RIGHT of the Context title.
- **The rail:** hidden, and its padding on the header and content goes to `0`.
- **The menu:** fills the viewport; no `Pin`; `Settings` at the BOTTOM; a
  footer `Cancel` that closes it and goes nowhere.
- **A Context row** closes the menu AND navigates.

**Put the nav on the data layer while you are here.** `sherpa-nav` has
`renderData()` but never calls `bind()` — a one-shot draw. Bind it to a Store,
so the rail and the menu are two renderings of one nav model.

### `[ ]` 34 — Figma: use the Navigation terms

The code moved to Section / Area / Context / View on 2026-09-24 (CLAUDE.md
"Navigation terms"). Figma still uses the old words. Rename there, then resync:

- App Header: the `View title` layer is the Context title. Code parts are
  `row-context` and `context-icon`.
- Navigation: a parent row is an Area; a leaf row is a Context. A Section is
  the label + divider only.
- Any `Views` section label, or frame named for a page, is a Context.
- Keep `View` only for the View chip and its View group (★ · Save · ▾).
- `sherpa-dialog data-type="overlay"` and `sherpa-app-shell`'s `overlay` slot
  do not exist in Figma yet.
- Navigation: collapsed `nav-layout/width` is pinned to 40px. Bind it to
  `size/3xl` so the closed rail follows density (36 / 40 / 48), then drop the
  override in `sherpa-nav.css`.

Each code-only difference is also in that component's `_divergence` block.

---

## F — Data states and charts

### `[ ]` 58 — Loading, empty and error states in a container

Will, 2026-09-26: *"Gracefully handle data loading and loading, or no data,
errors."* It mirrors Apex for now; it is not his favourite pattern (see 59).

| state | the content area shows, IN PLACE of its content |
|---|---|
| loading | a spinner and a short loading message |
| no data | the relevant empty-state illustration and message |
| failure | the relevant illustration, the error message, and action buttons |

On a failure, an action that RESOLVES the issue (Retry) is the CTA; one that
does not (Dismiss) is a plain button.

**The parts exist; the wiring does not.** `sherpa-container` already has
`data-loading` and `loading` / `empty` / `error` slots; `sherpa-empty-state`
has `data-illustration` = `empty | search | data | error | …` and an `action`
slot; `sherpa-loader` is the spinner. What is missing is the DATA LAYER
driving them: a bound source reports loading, empty and failed, and the
container of each bound component follows — so no host writes
`data-loading` by hand. `LoadResult` and `report()` (38 step 5.5) are the
shapes to reuse, and 62's debug flag is how the example shows each state. "No data" must not fire on a filter that matched nothing —
that is a different message ("No matches", clear the filter), and a zero-row
view already reads as a broken filter.

### `[ ]` 9b — A Data Viz header, for metrics and chart containers

Figma `Data Viz Header`, node `1456:30467`, page `✅ Headers`. For Metrics,
and any Container that holds a chart. 32px tall, horizontal, `gap/sm`,
`padding/md` all round, a `border/width/sm` bottom rule in
`style-border/base +1`, no fill.

| Part | What |
|---|---|
| Drag handle | a Button, icon only. Toggled by `hasDragHandle` |
| `left` | a SLOT. The leading icon. Toggled by `hasIcon` |
| `Labels` | vertical, `gap:2` — the `title`, then a `metadata` SLOT |
| `actions` | a SLOT. Icon-only Buttons |

The title is NOT the normal heading: `content/font/body`, `weight/light`,
`size/small` (12px), `line-height/small` (16px), `content/body/+1`,
**UPPERCASE**. The filter panel's field titles use the same look
(`sherpa-text-small`, caps, light). Compose both Buttons from `sherpa-button`.

### `[ ]` 14 — An example of real-time data

Data that changes in real time — WebSocket, or like it — coming through the
data layer into a piece of content. Last of D: it proves 13 is really fixed.

### `[ ]` 59 — EXPLORE, later: Will's own loading pattern

Will, 2026-09-26, an alternative to 58 for later. Content is never replaced:

- **Loading:** an INDETERMINATE loading bar along the bottom of the container
  header (`sherpa-progress-bar data-indeterminate`), and the content locked to
  read-only while it runs.
- **Failure or no data:** a message BANNER in the content area that explains
  the error and says the PREVIOUS data is still shown. It carries Retry,
  Dismiss and the like.

Build 58 so its states are data, not markup, and this is a second rendering of
the same three states.

---

## G — Overlay panels

### `[ ]` 22 — The `Ask N-zo` panel is too narrow, and cannot be resized

- Make it wider, with a sensible minimum.
- The user can drag the LEFT edge to resize any overlay panel.

### `[ ]` 23 — A focused grid row opens a details panel on the right

Focus a row in `sherpa-data-grid` → an overlay panel opens on the right with
more about that record. Any other open overlay closes first. Its header has up
and down chevrons that step the focused row. Needs 22's resizing panel.

---

## H — The accessibility gate

### `[ ]` 24 — Playwright must test accessibility — WCAG 2.1 AA

Every component, level AA. None today; `axe-core` is not a dependency.

**The output is a REPORT, one per component**: for each failure, what is
wrong, which criterion it breaks, and HOW to correct it.

Prove the checker reaches inside a shadow root before trusting a green
result — one that reads the light DOM sees almost nothing of a Sherpa
component. 40 is a first finding for it.

---

## I — The big builds

### `[ ]` 25 — `sherpa-layout-canvas` — an infinite canvas content area

Pans and zooms without an edge, on a CROSSHAIR grid pattern. A floating button
group at the BOTTOM RIGHT: Pan, Zoom in, Zoom out, Options (a menu). Compose
from `sherpa-button` and the menu; do not hand-roll either.

**A minimap** shows the whole canvas and where the viewport sits; the user
moves the viewport from it. PART OF the canvas, not its own component: it needs
the canvas's pan and zoom, and a separate element would be a second owner of
one value. Split it out only if a second host wants one.

### `[ ]` 26 — A `Grouped` mode for the content area

Every container in the content area reads as ONE stitched object: gutters
`0px`, MID rounding on every container, only the top-most keeps its own.

**Will's ruling: this is `sherpa-group` applied to the layout grid.** The work
is how the two meet — `<sherpa-layout-grid>` owns the tracks, `<sherpa-group
data-direction="grid">` the joins. Likely: the layout grid gains a
`data-grouped` that gives up its gaps and applies the group rules.

**Ask first (Will, 2026-09-24): are we re-inventing the grid?** A scenario is
spread over `data-rows`, `data-row-count`, a named `data-col-span` and a
`data-row-span` per child, and JS for `data-grouped`. A named
`grid-template-areas` per scenario, each child naming its AREA, might replace
most of it. Find what it cannot do — spans re-scale per breakpoint; the fit
grid's last row takes the rest — before building either.

### `[ ]` 27 — A consumer can supply their OWN templates and CSS

Someone building with Sherpa-UI must be able to give a component their own
HTML template, and their own CSS that EXTENDS the default rather than
replacing it. Make it possible, and easy.

In `src/core/ui/sherpa-element.ts`, `static css` / `static html` are plain
`URL`s a subclass can re-point, and the template cache is keyed by `href`. Half
the door is open. Missing: a "default, then mine" CSS order; an API that is not
subclass-and-redefine; and a check that a custom template still provides the
parts, slots and classes the JS and CSS expect — the `.component.yaml`
anatomy is the natural thing to check against.

---

## J — Tidy-ups and renames

### `[ ]` 11 — `sherpa-group`: what is left

`<sherpa-group>` is BUILT (2026-09-23), but only `sherpa-pagination` uses it.
Measured 2026-09-26, all three still open:

1. The 16 generated `grid-*` / `vertical-*` blocks are still in
   `sherpa-group-positions.css` AND `tokens.css`, with 0 callers. The wrapper
   derives those positions; they can go.
2. `.sherpa-border-edges` / `.sherpa-border-corners` are not grouping — 21
   components use them. Move them to their own `sherpa-borders.css`.
3. The `.sherpa-group` class is still used in calendar, menu,
   quick-filter-toolbar and select-checkbox.

### `[ ]` 28 — A Figma component is NOT always a web component

A sub-component is often only a `<template>` in its parent's `.html`, or a set
of CSS classes. `sherpa-grid-cell` is the clear case.

1. Sweep all components: real element, template, or CSS only.
2. For each that is not a real element, cost the fold — spec, MCP, tests,
   Figma link.
3. Fold the clear ones. Start with `sherpa-grid-cell`.

**`sherpa-nav-section` is the same question** — still composed by nothing
(only exported and listed in the sandbox). `sherpa-nav` draws its own label
and rule. Compose it (the nav mirrors `data-collapsed` onto each section — one
`setAttribute`), fold it, or leave its 65 correct lines. A Figma component
stays a Figma component either way.

### `[ ]` 30 — Do we still need `icon-paths.ts` and `render-icon.ts`?

Will, twice: *"HTML & CSS should be handling this."*

**The first answer's main reason is STALE.** It was "the TS carries each
icon's INK BOX, and the files' 14x14 frame draws them 15% small". But
bbe7c2ef (2026-09-24) reversed that: an icon now renders at its 14x14 frame,
the same `viewBox` its `.svg` already has. So the files are enough as they
are, and `render-icon.ts`'s header comment (line 4) is now wrong.

What still stands: the `.svg` files do not ship (no `dist/icons/`), and 48 of
76 icon sites take a name from OUTSIDE the component
(`data-icon-start="gear"`), which a static template cannot cover. Options: a
sprite sheet (`<use href="#gear">` — check across a shadow root), or a CSS
`mask-image` set coloured by `background-color`. Measure, then choose.

### `[ ]` 33 — Density as step offsets, and a breakpoint step

Will, 2026-09-23: in code, two scalings would do what Figma's remapped modes
do — by BREAKPOINT (bigger on touch), then by MODE (compact / comfortable),
relative to it.

**The rule is measured and holds exactly: a density mode is ONE STEP on the
primitive scale** — compact −1, comfortable +1, clamped at both ends. Steps,
not multipliers: a multiplier leaves the 4px grid at once (×0.8 puts 10 of 12
space values off it), a step cannot.

1. **Emit the scale ONCE** plus a step offset, not three copies of every space
   and size token in `tokens.css`.
2. **Add the breakpoint step**, applied before the mode's. Mobile and tablet
   step UP. It does not exist yet: the layout grid's gap and padding are
   `space-base` at every breakpoint.
3. **Consume `--sherpa-grid-space-step`** — it is emitted and nothing reads
   it but `lint:css`. `round()` against it is for genuinely dynamic sizes only
   (`T-round-is-for-dynamic-sizes-only`).

The density values live in the hand-kept `figma.extensions.json`; read them
live through the figma-console MCP
(`T-an-override-collection-is-keyed-by-its-parent`).

### `[ ]` 36 — CSS: compiled where it should inherit?

Will, 2026-09-24: the system is designed on INHERITANCE, so why is so much CSS
compiled? Two generators: the state pins (`state-pins.yaml` → ~21 re-pointed
Style names per line, into `tokens.css` and `sherpa-style-modes.css`, because
CSS has no mixin) and the dist PostCSS transform. Find what can move into
`sherpa-base.css` / `sherpa-element` as inherited rules, and what genuinely
needs a generator.

### `[ ]` 11d — `data-type` means nine things; `data-empty` means three

`data-type` selects: which control element, how many thumbs, pill vs
rectangle, square vs labelled, a look, a template variant, a scope, a
cardinality, a role. `data-empty` is a message string (list), a host boolean
(grid), a per-pane boolean (transfer-list). Both are rulings, not bugs. The
question: reserve `data-type` for TEMPLATE SELECTION, as four of its nine uses
already do?

### `[ ]` 29 — Rename `src/index.ts` to `src/app.ts`

It does not hold an index: it registers every component and installs the icons
and tokens — it SCAFFOLDS a Sherpa app. Knock-on: `package.json` `main`
(`./dist/index.js`) and `exports`, the build and `dist/` name, every
`sherpa-ui` import in `examples/`, `sandbox/` and `test/`, and the MCP server if
it reads the entry by name. Keep `src/data.ts`. **Dead last** — cheapest when
nothing else is in flight.

---

## Done

One line each. The detail is in git and in the trap named.

**2026-09-26, Will's list**
- The superseded-chip tip reads "Filter applied at higher scope" — c0f5e32f, `T-an-inactive-chip-says-where-its-filter-went`
- The panel's to-toolbar button uses `fullscreen-exit` — 1e98a823
- Customer and Region moved to the panel's View filters — aba1f583
- Add condition is a labelled default button BELOW the rows — 5b40c4f3, `T-add-condition-sits-below-the-rows`
- A toolbar divider hides with nothing on one side — b80eb9f4, `T-a-divider-needs-a-neighbour-on-both-sides`
- A scope's chevron leads its heading; its buttons ride that row — 8e60cf78
- A field's label is caps and light, its buttons in its header — a161e054
- Apply and Discard wait for a change; a field header keeps one height — 3c1d306e, `T-apply-and-discard-wait-for-a-change`
- A conditioned chip reads as Success, not info — a24d020a, `T-a-conditioned-chip-reads-as-success`
- A Conditional switch moves a filter between its modes — 91fd57be, `T-a-filter-menu-has-two-modes`
- The Conditional switch is its own row, under the field header — 7c6bb862
- Organise and Presets carry no Conditional switch — 8623c084
- A disabled Today keeps its Today fill — 9baa9f57
- 39: the panel header's Reset all clears both scopes, and both header buttons wear the default look
- 53: a conditional chip's tooltip says "X conditions applied" — `T-a-condition-tip-counts-its-rows`

**Culled or merged in the 2026-09-26 review**
- 13, a sparkline did not follow its record deltas — each tile's sparkline and its delta are ONE series now (`T-a-delta-is-derived-not-declared`)
- 51, warning and critical for a condition — a note, folded into 49
- 35, plain grid templates — the question 26 asks first; merged into it
- The draft list `todo-filter-2609.md` — merged here, and deleted

**Found done or stale by the 2026-09-26 audit, and removed**
- The data toolbar clipped below 800px — fine at 1280x720 since 39b6537c
- Fold `More` into `Add filter` — ONE Filters button with Added / Available sections
- A filter PANEL as an alternative to the toolbars — built; its width is 57
- Switching back to a view left the last column filter — fixed; a new bug is 55
- A range filter refused its default max — does not reproduce (45163ad4)
- Button borders did not inherit the status colour — 52b5857f; buttons bind the Style pins
- A metric trend did not update — did not reproduce, twice
- A fixed-height row's hard-coded gutter — did not reproduce, twice
- 38's compound Owner condition did not widen — does not reproduce (Dana 10, Dana OR Nassim 17)
- Allow-list follow-ons (values, actions, `nextState`) — the primitive is there; wire each when a caller needs it

**2026-09-23 to 09-25**
- Context vs View — the naming, settled (CLAUDE.md "Navigation terms")
- A filter applies DOWN its scope only — `T-a-filter-applies-down-its-scope`
- Style/Transparent tokens consumed — 7f1f95a3
- The `More` chip showed active when it was not — `T-the-filters-button-is-a-door-not-a-filter`
- Metric item surface and border; every metric uses the xsmall container class
- Only five filter chips carry an icon — `T-only-five-filter-chips-carry-an-icon`
- Pagination row-count select is a Sherpa select — `T-a-native-select-keeps-its-own-shape`
- Notifications button, and three more menus that could never close — `T-a-trigger-click-follows-light-dismiss`
- An optional allow-list on any axis — `src/core/data/allow.ts`, `T-an-allow-list-is-a-filter-not-an-order`
- The filter menu's two modes and many conditions, and its shake-down — `T-a-filter-menu-has-two-modes`
- An inactive chip says where its filter went
- The grid is TWO tokens, 4px and 2px — `T-the-grid-is-two-grids`
- Donut folded into `sherpa-radial-chart`; the gauge composes the ring — `T-a-gauge-composes-the-ring`
- Settings opens as an overlay — `test/e2e/reforged-settings-overlay.spec.ts`
- A nav item goes to a Context
- Shared constants swept; event detail shapes swept; toggle chips' owner settled
- The panel-or-toolbar mode survives a reload — 24c3a57c
