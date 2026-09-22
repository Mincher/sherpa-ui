# TRAPS

Facts that cost hours, moved out of the source so the code reads as code.

**Every entry here is cited from the code** as `// TRAP T-<id> — <summary>`, and
`npm run check:traps` fails the commit if a pointer and an entry disagree. That
gate is the whole reason this file is allowed to exist: a comment cannot lie
about the line beneath it, a doc can, and this repo has already had a check that
reported 22 failures and exited 0 for three months.

**If you are about to "simplify" something that looks redundant, search this file
first.** Most of what is here is the record of the obvious approach being wrong.

---

## Shadow DOM and the platform

### T-anchor-cross-root

CSS anchor positioning **cannot cross a shadow root**. `anchor-name` resolves
inside ONE tree, and a trigger is always in a different shadow root from the card
it opens — so `position-anchor` finds nothing.

It does not fail loudly. Re-probed on **Chromium 153**: the property is
*supported*, and the card silently renders at the viewport's far corner. Feature
detection cannot catch this, because the feature IS there.

So every floating card measures its trigger with `getBoundingClientRect()` and
writes viewport coordinates the card consumes as `position: fixed` offsets. That
measurement layer looks like reinventing the platform. It is not.

- Site: `src/components/sherpa-menu/sherpa-menu.ts`
- Site: `src/components/sherpa-quick-filter/sherpa-quick-filter.ts`
- Site: `src/components/sherpa-tooltip/sherpa-tooltip.ts`

### T-custom-element-upgrade

A custom element cloned from a `<template>` **has not upgraded yet**. Its class
constructor has not run, so it is a plain `HTMLElement`.

Therefore:

- a **property** write (`el.valueLabel = 'x'`) lands on the plain element and is
  **lost** when it upgrades
- an **attribute** write survives, because upgrading replays
  `attributeChangedCallback` for whatever is already there

Silent, and timing-dependent. `sherpa-quick-filter-toolbar` hit it and works
around it with a deferred replay queue (`customLabels`), holding property writes
until after the whole run is appended. `renderItems()` avoids it by construction:
attributes only, written before append.

- Site: `src/core/sherpa-element.ts`
- Site: `src/components/sherpa-quick-filter-toolbar/sherpa-quick-filter-toolbar.ts`

### T-tokens-css-never-reaches-shadow

A bare `[data-status]` rule in `tokens.css` is loaded into the **document** and
is not in `sharedStyles`. It reaches a light-DOM element — verified, it resolves
`#f2dfff` there — and **never** one inside a shadow root.

So a component that wants a status tint restates it in its own sheet. The
`--_status-*` cascade works because those are inherited custom properties; the
SELECTOR that sets them does not cross the boundary.

- Site: `src/components/sherpa-quick-filter-toolbar/sherpa-quick-filter-toolbar.ts`

### T-scope-does-not-stop-inheritance

`@scope` limits what a rule **matches**, not how far the value it sets
**inherits**.

A custom property set on a chip's host inherits into the `<sherpa-menu>` slotted
inside it and turns that card transparent too. Scoping the rule does not help.
The fix is to set a real property on the element that should change, never to
re-point a shared token on an ancestor.

- Site: `src/components/sherpa-quick-filter/sherpa-quick-filter.ts`

### T-indeterminate-reports-false

A native checkbox that is `indeterminate` reports `checked === false` after a
click.

So trusting the box turned "some are picked" into "clear them" — and the row then
**stuck at NONE**, because clearing an already-empty set is a no-op that the next
click repeats. A two-click intermittent bug.

Read the SET, not the box. `indeterminate` is also a property, never an
attribute.

- Site: `src/components/sherpa-menu/sherpa-menu.ts`

### T-col-width-not-inline-size

On a `<col>` in a fixed-layout table, use `width`, **not** `inline-size`.

Chromium does not feed the logical property into fixed-table column sizing: a
`<col>` styled with `inline-size` **measured 381px against a set 160px**.

A modernisation sweep replacing physical properties with logical ones would
silently destroy column sizing here.

- Site: `src/components/sherpa-data-grid/sherpa-data-grid.ts`

---

## Events and listeners

### T-capture-beats-registration-order

`stopImmediatePropagation` only stops listeners registered **after** the one
calling it. A host that wired its handler before the component had rendered still
ran first and saw the raw event.

An organise chip's own `quick-filter-change` carries `{ values: ['name'] }`, a
bare array, where a host reading the TOOLBAR's event expects
`{ values: {id: [...]}, active }`. A view that turned one into the other matched
nothing and **the grid emptied on every sort**.

Capture runs before EVERY bubble listener whenever it was added, so the order the
host happened to use stops mattering. Registration order also decides order
*within* capture — see `T-swallow-flag-not-listener`.

- Site: `src/components/sherpa-quick-filter-toolbar/sherpa-quick-filter-toolbar.ts`

### T-swallow-flag-not-listener

A finished resize-drag fires a synthetic `click`, which would sort the column.

The fix is a FLAG, not a rival listener: `#onHeaderClick` is capture-phase on the
same element and was **registered first**, so it sorted the column before any
swallowing listener could run. Registration order decides capture order.

- Site: `src/components/sherpa-data-grid/sherpa-data-grid.ts`

### T-abort-controller-per-connect

`#ac` is aborted on disconnect and **replaced on every connect**.

`connectedCallback` fires again after `disconnectedCallback` — moving an element
in the DOM does exactly that — so ONE controller for the element's whole life
would leave a re-attached component wired to nothing, **silently**.

Read `this.signal` inside `onRender`/`onConnect`; never cache it in a field.

Related: a variant re-stamp does NOT abort it. See `T-restamp-does-not-abort`.

- Site: `src/core/sherpa-element.ts`
- Site: `src/components/sherpa-slider/sherpa-slider.ts`

### T-restamp-does-not-abort

A variant re-stamp re-runs `onRender`, which re-adds the component's HOST
listeners — but `addEventListener` **discards a repeat** of the same
(type, listener, capture) triple, and every host listener in this library is a
stable arrow FIELD (`this.#onClick`). Measured: a re-stamped `sherpa-nav-item`
emits `item-click` once.

So `#stamp` does NOT abort `#ac`. Aborting looked prudent and was wrong twice:
it fixes nothing the dedup does not already handle, and it would drop what a
component wired in `onConnect`, which does not run again.

A component that needs `this.signal` should wire in `onRender`, never `onConnect`.

- Site: `src/core/sherpa-element.ts`

---

## Numbers, measurement and timing

### T-number-coercion

Parsing a numeric attribute by hand went wrong four ways:

| expression | result | what broke |
|---|---|---|
| `Number('')` | `0`, not `NaN` | `data-min=""` pinned a chart's y-floor to 0; `data-ticks=""` silently meant "no axis" |
| `Number('' ?? 100)` | `0` | `??` catches `undefined`, never `''` |
| `parseInt('0') \|\| 1` | `1` | `\|\|` folds `0`, `''` and garbage together |
| `Number(null)` | `0` | an absent attribute read as index 0, acting on the FIRST row |

`coerceNum` treats anything that is not a finite number — absent, empty,
whitespace, unparseable — as ABSENT. A real `0` survives.

Do not "simplify" it back to `Number(x) || fallback`.

- Site: `src/core/sherpa-element.ts`

### T-resize-reschedule-never-drop

A rAF-batched resize handler must **cancel and re-queue**, never `return` when a
frame is already pending.

Returning throws away the LATEST width. On initial layout the observer fires
twice — an intermediate width, then the real one — and the second was discarded,
so the fold ran on a `clientWidth` of **92 where the truth was 48**. It folded
three chips, stopped, and left the bar overflowing by 2px **about five runs in
six**. Every "flaky fold" symptom traces here.

Cancelling keeps the one-measure-per-frame guarantee while measuring the width
that actually won.

- Site: `src/components/sherpa-quick-filter-toolbar/sherpa-quick-filter-toolbar.ts`

### T-no-op-load-guard

Twenty filter writes with the SAME value cost the same **667ms** as twenty real
ones, and produced **120 populates across six bound components** for zero change
on screen.

The guard compares the rows array by identity. A store that mutated its rows in
place would defeat it — which is why `ArrayStore` copies (`[...rows]`) rather
than sorting the caller's array. That is a cross-module contract recorded
nowhere else.

- Site: `src/core/data-source.ts`

### T-schema-sample-cost

A read schema costs real time on a bulk load: **10,000 rows 6ms, 100,000 rows
56ms**, about 23× an unguarded load, scaling linearly.

Sampling checks the first N rows, because a backend's rows are wrong in a SHAPE,
not one at a time. But rows beyond the sample pass **UNCHECKED**, so a schema
that RENAMES or COERCES must **not** be sampled — the two halves of one response
would disagree. Sample only when the schema purely VALIDATES.

Writes are always checked in full.

- Site: `src/core/base-store.ts`

---

## Design system

### T-gauge-status-is-named

A gauge's status colours are **named** (`--sherpa-status-<name>-fill`), never
resolved by POSITION into the data-viz series.

Positional lookup was the shipped bug: the palette became ONE STATUS PER
SEQUENCE, so sequence 1 is the whole green ramp and sequence 2 the whole amber
one. A gauge painting success/warning/critical asked for series 1, 2 and 4 —
**three shades of green**.

A status is a MODE in that palette and a gauge paints several at once, so it
cannot pin one.

- Site: `src/components/sherpa-gauge-chart/sherpa-gauge-chart.ts`

### T-fa-pro-renders-nothing

Font Awesome **Pro** glyphs render nothing at all in this webfont — no width, no
warning, no error. `fa-light` is Pro; `fa-regular` and `fa-solid` are free.

Probe in a SHADOW ROOT and test the resolved `content` for `none`; a working
glyph never resolves to `none`.

`sort-none` was `fa-bars`, which IS the hamburger-menu glyph — three equal rules,
reading as a menu affordance rather than "this column can be sorted". `fa-sort`
is the neutral pair the state actually means.

- Site: `src/components/sherpa-data-grid/sherpa-data-grid.ts`
- Site: `src/core/render-icon.ts`

### T-actions-were-a-slot

The action cluster is BUILT IN, not slotted (Figma Filter Toolbar 150:3688):
Add · AI · undo · configure · │ · refresh · ⋮, plus a snapped
`[★ │ Save │ ▾]` for `data-type="view"`.

It WAS an `actions` slot. Every host then had to rebuild the same seven
buttons, so it moved inside. `data-no-actions` hides it; the slot survives for
host extras and renders first.

- Site: `src/components/sherpa-quick-filter-toolbar/sherpa-quick-filter-toolbar.ts`

### T-persistent-chip-is-a-selector

`persistent` marks a chip that cannot be switched OFF — a SELECTOR rather than
a toggle. THE CANONICAL STATEMENT for it lives here; call sites cite it.

The view chip is the case: "no view" is not a state the page can be in, so its
menu changes WHICH one and its body has nothing to turn off. In one place:

| rule | where |
|---|---|
| never off — a body click flips it back on | `#onChipClick` |
| never cleared — its menu gets no Clear | `#addMenu` |
| never removed — removing it would strand the page | `#addRemove` |
| survives reset — `clearAll` skips it, PICK included | `clearAll` |
| on when empty — an empty pick is still a view | `#onOrganiseChange` |
| follows a pick — a definition may name the view it is | `values` setter |

A persistent chip always holds exactly one value, so if neither the live picks
nor the definition names one, `#addMenu` defaults to the FIRST option. Without
that the view chip could load with no radio checked — on at 0 values — which
the chip reads as "on but filtering by nothing" and paints WARNING. That was
the intermittent amber view chip: whether it appeared depended only on whether
the host remembered to mark an option `selected`.

- Site: `src/components/sherpa-quick-filter-toolbar/sherpa-quick-filter-toolbar.ts`

### T-commit-follows-select-mode

Whether a chip's menu DEFERS its picks behind an Apply/Cancel footer follows
the SELECT MODE by default, because the mode decides whether a pick is
FINISHED.

- SINGLE is done on the tick — a footer charges two clicks for a free selection
- MULTI is still being built — each tick would fire a query on the way to an
  answer

`commit` in `QuickFilterDef` overrides, and only against that. A host that
named `commit` meant it either way, so the Range switch must NOT move it
(`#chipDefers`) — the switch only supplies the default the definition left out.

A DATE or NUMBER chip counts as single whatever its `select` says: a calendar
picks one day and a field holds one number, so the pick is finished the moment
it is made. IN RANGE MODE it is not — a span has two ends, and applying on the
first would filter to a range the user has not finished naming. So a range
defers, and the Range switch moves the menu between the two modes at runtime.

- Site: `src/components/sherpa-quick-filter-toolbar/sherpa-quick-filter-toolbar.ts`

(none — `T-custom-element-upgrade` already exists and already lists this file as a Site.)

### T-reflow-resets-before-measuring

`#reflow` fits the bar to its width. ONE LINE, always: the answer to "these do
not fit" is to collapse, not to wrap onto a second row. Order is the USER's
priority — the ACTIONS fold first (a chip is what the bar is for; Save/Refresh
live in the ⋮), and only a fully folded cluster that still overflows starts
folding chips, from the END so the unfold order is the exact reverse.

Three things it must do in order, each one a bug if skipped:

1. **UN-DRILL FIRST.** `sherpa-menu` closes itself on a viewport resize, but
   this reflow also runs when only the BAR changed — a panel opening, the nav
   collapsing. The fold about to happen can take away the very chip whose rows
   are drilled into the overflow menu, and the rows are MOVED, not copied, so a
   chip that folds mid-drill carries another filter's rows off with it.
2. **Reset to nothing folded**, then add back only what the measurements
   demand. Measuring against the CURRENT fold RATCHETS: a bar that once
   narrowed could never widen again, because each pass would see the collapsed
   layout as the one that fits.
3. **Re-measure after every single fold.** A chip's width is its own; there is
   no arithmetic that predicts how many will fit. The overflow chip is itself a
   chip, so folding the last one and revealing it can be a net LOSS of room.

`scrollWidth > clientWidth` on the clipped run is the overflow test, read AFTER
the resets, which force the layout the browser would have drawn with
everything visible. `COLLAPSE_STEPS = 3`: step 1 the view group, 2 refresh and
configure, 3 everything but Add and the ⋮ itself. Each step subsumes the ones
before it and CSS reads it off the host.

- Site: `src/components/sherpa-quick-filter-toolbar/sherpa-quick-filter-toolbar.ts`

### T-overflowing-needs-1px-slack

`#overflowing()` compares `chips.scrollWidth > chips.clientWidth + 1`.

The **1px of slack is load-bearing**: a sub-pixel layout rounds `scrollWidth`
up, so a bar that fits exactly would otherwise fold a chip for nothing, every
frame.

Reading `scrollWidth` also FORCES the pending layout, so an attribute written
on the line above is already reflected. That is what lets the collapse loop add
one step at a time and stop at the first that fits, rather than applying all
three and folding an action cluster that only needed its widest run taken off.

- Site: `src/components/sherpa-quick-filter-toolbar/sherpa-quick-filter-toolbar.ts`

### T-drill-moves-not-clones

The overflow menu drills IN PLACE rather than opening a second card beside
itself: its list is replaced by the chosen filter's rows and the header grows a
back arrow and a breadcrumb. One card, so there is no second box to position,
nothing to close when the pointer crosses a gap, and no way for the two to
disagree about what is ticked.

**The rows are MOVED, not copied.** A clone would be a second set of inputs
over the same filter, and whichever the user touched the other would be stale.
Moving brings the Range switch, the value rows and everything else across
intact, and Back is the same move in reverse. Three consequences:

- `#chipPicks` reads a drilled chip's picks FROM the overflow menu. There is one
  set of inputs and that is where it is right now, so reading the chip's own
  emptied menu would say "nothing picked" for a filter the user is editing.
- `#closeOverflow` puts the rows home BEFORE the fold changes, or a chip that
  folds away this pass takes another filter's rows with it.
- `#drillOut` re-syncs the badges in a `queueMicrotask`, because the badges are
  stamped back into the menu on the following line and would otherwise be read
  before they exist.

Drill is one level deep, never a chain: an existing drill is undone first.

- Site: `src/components/sherpa-quick-filter-toolbar/sherpa-quick-filter-toolbar.ts`

### T-drill-flags-travel-and-replace

`DRILL_FLAGS` (`data-commit`, `data-range`, `data-select`, `data-search`,
`data-type`) are the menu attributes that belong to a FILTER rather than to the
overflow card. They travel with the rows on a drill and go home with them, so a
filter's mode is never left on the overflow list and the overflow list's never
lands on a filter.

`data-type` is in the list because a calendar needs its own LAYOUT. Without it
a calendar dropped into a list-shaped menu had its grid crushed to a
**hairline** — and the flag then stayed behind on the way home, so the filter's
own menu was distorted too.

Every flag is **restored to what the TARGET had, not merged**: an attribute the
overflow list carried and the filter does not must go, or the filter inherits a
mode it never asked for. On the way home the overflow list is stripped of all
five — it is a plain list of doors: no draft to apply, no search, no calendar.

- Site: `src/components/sherpa-quick-filter-toolbar/sherpa-quick-filter-toolbar.ts`

### T-path-not-target-finds-chip-host

Match the **tag** `sherpa-quick-filter` on the composed path, never `.chip`.

A `sherpa-quick-filter` wraps its own inner `<div class="chip">`, which sits
LOWER in the path and therefore matches FIRST. That inner div carries no
`data-id`, so:

- `#onDatePicked` — `#chipPicks` on the bare div finds no calendar, so the label
  was rebuilt from an empty pick list every time
- `#onMenuSelect` — the id lookup found nothing and **every remove silently
  bailed**

The real path is
`sherpa-menu › slot › span › div.chip › #shadow › sherpa-quick-filter.chip › …`,
so the chip host IS still reachable — just not first. `pathFind` exists for
this; `target` is wrong for any composed event here.

- Site: `src/components/sherpa-quick-filter-toolbar/sherpa-quick-filter-toolbar.ts`

### T-date-label-reads-in-full

A date chip's pick is an ISO string, which is not what a bar should read.
Formatting it has four separate traps, all in `#syncDateLabel`:

1. **Parsed as UTC, so FORMATTED as UTC.** Otherwise a browser west of
   Greenwich renders the previous day.
2. **DAY THEN MONTH, always** — "03 Sep", never "Sep 03". `toLocaleDateString`
   orders the parts by locale, so a US reader got the month first and the shape
   the design asks for was lost. `formatToParts` gives the localised MONTH NAME
   (which should follow the reader's locale) while the code keeps the order
   (which should not).
3. **IN FULL, never abbreviated:** "03 Sep – 18 Oct, 2026". A date range is the
   one filter whose value cannot be guessed from a count — "2" says nothing
   about which two days — so it reads out rather than hiding behind a badge and
   a hover tip. Hence `data-full-value` on every date chip.
4. **NO COUNT BADGE**, and the year is stated **once at the end** when both ends
   share it (the common case). A range crossing new year states it on each end,
   because "18 Dec – 03 Jan, 2027" would put the wrong year on the first day.

The base label is remembered on the chip, because a second pick would otherwise
format a label that already carried the first one.

- Site: `src/components/sherpa-quick-filter-toolbar/sherpa-quick-filter-toolbar.ts`

### T-render-captures-live-state

`#render()` CAPTURES WHAT IS ON SCREEN FIRST, before `list.replaceChildren()`.

A rebuild reads `#filters`, whose options still carry their POPULATED flags — so
**adding one filter reset every other chip's picks**. The live DOM is the only
record of what the user did since. The captured map is `id → { on, picked }`,
and the chip's LIVE state wins over its definition's; a chip the user has never
touched has no live entry and falls back to `active`.

The one exception is `data-reset-on-populate`: the caller is saying the
definition is the whole truth, which is what a saved view hands over.

At the end `#render()` calls `#onResize()` by hand. The `ResizeObserver` only
fires on a SIZE change, and populating a bar that was already its final width
is not one — without the call, a bar loaded with eleven chips stayed
overflowing until the window happened to be resized.

- Site: `src/components/sherpa-quick-filter-toolbar/sherpa-quick-filter-toolbar.ts`

### T-range-switch-swaps-not-rebuilds

A NUMBER or DATE chip's menu leads with a Range switch: ONE filter, two shapes
("equals this" / "between these two"). Two chips would make the user pick the
shape before knowing which they want.

The flip writes `data-range` on the MENU. **NOTHING is rebuilt** — both the
field and the two-ended slider exist from the start and CSS reveals one — so a
value typed on one side survives a flip back. The calendar reads the same flag
as its own `data-type`: `range` is a two-click start→end selection with the days
between banded, and its previous single pick is left alone, because re-picking
is how a range is started anyway.

The switch comes FIRST, above the calendar: it decides what the calendar below
it IS, so reading it after the grid would be backwards.

Flipping also moves `data-commit` (see `T-commit-follows-select-mode`) unless
the definition pinned it, and emits `quick-filter-change` — the filter's SHAPE
changed, so what it means changed with it, and a host reading `values` needs to
hear that even though no value moved.

`sherpa-switch` re-dispatches its native `change` as a COMPOSED one, which is
why this reaches the toolbar where a bare checkbox's would not.

`time` joins this list later — the same calendar with `data-has-time`, not a new
template.

- Site: `src/components/sherpa-quick-filter-toolbar/sherpa-quick-filter-toolbar.ts`
- Site: `src/components/sherpa-data-grid/sherpa-data-grid.ts`

### T-group-chip-body-toggles-grouping

**An organise chip needs its own branch in `#onChipClick`, and Group did not
have one.**

The handler finds the Sort chip by `data-id`, cycles it, and returns. Everything
after that looks for `.chip` — and an organise chip is a `.organise-chip`. So a
click on the Group chip's body flipped its own `data-current` off, made it look
ungrouped, and **told nobody**. The grid stayed grouped while the chip said it
was not.

Reported as "the Group chip doesn't toggle grouping", and it was exactly that:
the chip toggled, and nothing downstream heard.

It is a TWO-state toggle, not the tri-state Sort is (`T-sort-is-tri-state`).
Grouping is running or it is not, so turning it off **clears the pick** — a chip
remembering a column it is not grouping by would report a grouping that is not
running, and `groupField` reads that radio.

**Turning it ON with nothing picked keeps it OFF.** The host writes
`data-group-field=""` straight back and `#syncGroupFromAttrs` corrects the chip
a tick later, which reads as a flicker. A column is chosen in the menu; the body
only switches an existing pick on and off.

The chip REPORTS `group-change` as every chip reports. The host owns the
grouping and writes the attribute back — `T-grid-reports-never-combines`, the
same rule the grid's own actions follow.

- Site: `src/components/sherpa-quick-filter-toolbar/sherpa-quick-filter-toolbar.ts`
- Site: `test/e2e/reforged-quick-filter-toolbar.spec.ts`

### T-sort-is-tri-state

The Sort chip's BODY cycles ascending → descending → suspended → ascending.
Suspended **keeps the column** (the suspend ≠ clear rule); only the MENU changes
which column. The chip stays ON for the two live directions and goes OFF for
suspended, so the bar shows at a glance whether the sort is doing anything.

Three things that each broke it:

- **The chip has ALREADY flipped its own `data-current`** by the time
  `quick-filter-click` arrives (a chip is a two-state toggle by default), so
  `#cycleSort` must undo that first. Without it the flip and the cycle fought
  each other and the chip never left ascending: every click flipped it off, then
  the cycle's "suspended → on" branch put it straight back.
- **The direction must rewind to `asc` on the way into suspended.** Leaving
  `desc` in place meant click 4 read desc→suspend and click 5 read
  suspend→on-at-desc, so the chip ping-ponged between descending and off and
  never returned to ascending. The COLUMN still survives — that is what makes
  "off" temporary rather than a reset — only the direction rewinds.
- **OFF gets its OWN glyph.** It used to wear the ascending arrow, so a
  suspended sort looked identical to an active ascending one; the whole point of
  a tri-state icon is that the three states look different.

`sortField` returns null while suspended even though the chip still remembers
the column — a suspended sort must not order anything, and a host reading it
should see "no sort", not a sort it is expected to ignore. `sortSuspended`
reports the in-between state.

The CHIP label says "Sort" and never moves; the COLUMN reads in the caret button
(Figma State=menu, 150:3408). Folded together as "Sort: Region" it re-flowed the
bar on every pick.

- Site: `src/components/sherpa-quick-filter-toolbar/sherpa-quick-filter-toolbar.ts`

(none — `T-tokens-css-never-reaches-shadow` already exists and already lists this file as a Site. This extraction only compresses the surrounding prose; the citation already present is kept verbatim.)

### T-a-chip-body-cycles-its-states

**A chip's body cycles that chip's states. Off is a STATE, not a delete.**

Ratified 2026-09-21, reversing an earlier ruling that had Group clear its pick
on empty while Sort suspended. That made Group the only chip in the bar with its
own behaviour, on the reasoning that "grouping has no third state" — true, and
irrelevant: how MANY states a chip has and whether the last one throws the pick
away are different questions.

| chip | states its body cycles |
|---|---|
| a filter chip | active &rarr; inactive |
| Group | active &rarr; inactive |
| Sort | active-ascending &rarr; active-descending &rarr; inactive |

**None of them clears.** One more click brings the same thing back without
re-picking it from the menu — the rule `T-grid-suspend-is-not-clear` already
stated for column filters, and the one that cost a user their typed filter when
it was got wrong there.

`data-sort-field`, `data-sort-direction` and `data-group-field` are observed
because the bar's chips and a grid's column headers are two views of ONE value.
Without observing them the link ran one way: the chip steered the grid, and
sorting from a column header left the chip saying nothing. `groupField` was
likewise readable and completely UNWRITABLE, so a saved view could restore a
sort and not a grouping — the parity sweep found it.

Both chips derive their column from their menu's ticked radio, so syncing means
ticking that radio. A label write would be overwritten by `#syncSortLabel`
anyway.

**NEITHER emits an event.** The write came from outside, and echoing it back
would bounce the value between a host wired both ways.

**`groupField` still returns null when the chip is OFF**, whatever its menu
holds — that half of the old ruling stands, and is what makes suspending safe.
It used to read the menu alone, so a Group chip switched off still reported the
column it used to group by, and a host wiring it into a query kept grouping by
a chip the reader had just turned off. `sortField` already guarded this way.

The one case that is NOT a suspend: a chip that has never had a pick. Turning
it on would light a chip that groups nothing, the host would write the empty
attribute straight back, and the chip would correct itself a tick later — a
flicker. It stays off, and the menu is where a column is chosen.

- Site: `src/components/sherpa-quick-filter-toolbar/sherpa-quick-filter-toolbar.ts`
- Site: `src/components/sherpa-quick-filter/sherpa-quick-filter.ts`
- Site: `src/core/cycle.ts`
- Site: `src/components/sherpa-data-grid/sherpa-data-grid.ts`

### T-add-menu-batches

The Add control is a Filter Chip pinned `State=menu` — the button IS the
trigger, with no caret. Adding a filter always meant "show me the options", so a
body/caret split was two controls doing one job.

Its menu is the **one menu that KEEPS its Apply footer** now that chips
auto-apply, and it is MULTI-select:

- adding filters is a batch job — a user setting up a view wants three of them,
  and a single-select menu made that three separate open-pick-apply rounds
- each tick STAMPS A CHIP onto the bar, so applying per tick would rebuild the
  run three times mid-selection and close the list out from under the user

Its commit is heard as `menu-change`, NOT `quick-filter-change`: the menu hangs
off a `sherpa-button`, and only a CHIP re-emits its menu's commit under the
quick-filter name. A menu on a plain button reports for itself.

A picked filter arrives ON — a filter you just chose should be doing something —
and REMOVABLE, because a chip the user put on the bar is one they may take off
again. ONE `filter-add` for the batch, not one per filter, so a host re-queries
once. With nothing left to add the button is `disabled` rather than lying about
what it can do.

`#removeFilter` sends a chip BACK to the Add menu rather than letting it vanish:
a user who removes one by mistake, or narrows a view then widens it again,
should find it where they got it. Its picked values are dropped — "remove" means
remove, not "hide and remember".

- Site: `src/components/sherpa-quick-filter-toolbar/sherpa-quick-filter-toolbar.ts`

### T-one-comparator-one-source

A DataSource is the STATEFUL half of the data layer: it holds the filter, sort,
group, search and page, applies them on every load, and tells everyone bound to
it when the result changes. A Store holds records and remembers nothing.

The same sort was written three times — grid, toolbar, and the app wiring them —
and the compares were NOT identical, so "item 2" and "item 10" ordered
differently depending which control you used. One value, no disagreement.

Binding is two-way out of parts that already existed: `source → component` is
`populate(rows)` plus `data-*` attribute writes; `component → source` is the
component's own ratified noun-verb events (`sort-change`, `page-change`…). One
filter change re-populates every bound component, so the grid's own header arrow
and the toolbar's Sort chip become two views of one value.

- Site: `src/core/data-source.ts`

### T-into-merges-on-the-element

`into` writes into ONE NAMED PART of a component's payload, not all of it.

A component fed by TWO sources — a series per backend, a socket per stream —
otherwise keeps only the last writer's payload. It is the same last-write-wins
problem `ignore` patches on the event side.

```js
ours.bind(chart,   { into: 'series.0', as: (r) => toSeries(r, 'Ours') });
market.bind(chart, { into: 'series.1', as: (r) => toSeries(r, 'Market') });
```

A dotted path describes the payload rather than changing the component: a
numeric segment builds an ARRAY, a named one an OBJECT.

**THE MERGE LIVES ON THE ELEMENT**, because neither source can see the other —
each writes its part into a shared draft and the whole draft is populated. The
draft key is a Symbol so it cannot collide with anything a component or host
puts on its own element; a WeakMap would be equivalent. The draft is MUTATED and
handed back, not rebuilt, so a component holding the previous object still sees
the update; the rows-identity guard upstream already decides whether a push is
worth making at all.

- Site: `src/core/data-source.ts`

### T-signal-not-a-teardown-list

`bind({ signal })` unbinds when the signal aborts — the PLATFORM'S OWN teardown
token, so there is one thing to abort rather than a list of functions to
remember.

```js
const ac = new AbortController();
source.bind(chart, { readonly: true, signal: ac.signal });
source.bind(grid,  { signal: ac.signal });
ac.abort();   // both gone
```

A list of unbind functions is a list someone forgets: a second one appeared on
the dashboard, the teardown dropped it, and leaving the page left the source
pushing rows into a detached grid.

An ALREADY-ABORTED signal binds nothing, and hands back a no-op rather than a
function that would unbind something the call never did. The abort listener is
`once`, so an abort cannot leave a listener on the signal for an element that is
already gone — and it drops the BINDING, not just the event listeners, because
the binding is what makes the source push rows.

The same token is reused by `persistView` and `onViewPicked`, so one controller
tears down every binding, listener and persister a view made.

- Site: `src/core/data-source.ts`
- Site: `src/core/persist-view.ts`
- Site: `src/core/legend-filter.ts`

### T-steer-only-populate-means-chips

`steerOnly` lets a component's events reach the source while NO rows are ever
pushed back to it — the mirror of `readonly`.

The quick-filter toolbar is the case. Its `populate()` means "here are your
CHIPS", not "here are your rows", so a plain bind overwrote the bar with records
and it came back holding only Group and Sort. Without `steerOnly` such a
component has to be hand-wired with a listener per event, which is the
six-handler tangle the whole layer exists to remove.

It still receives the STATE attributes (`data-sort-field` and the rest), so the
toolbar's Sort chip and the grid's header arrow stay two views of one value.
`#push` therefore writes every attribute BEFORE it returns early for a
steer-only bind.

- Site: `src/core/data-source.ts`

### T-ignore-is-the-scalpel

`ignore` names events from one component the source must NOT act on. `readonly`
is all-or-nothing; this is the scalpel.

The case it exists for is a view that translates ONE of a component's events
itself: the records page turns the quick-filter toolbar's chips into a filter by
hand, because only it knows that two picks on a date column mean a range — and
only it can combine those chips with the data grid's column filters.

Without it both write `filter` and the LAST one wins. The source hears
`quick-filter-change`, sets the filter from the chips alone, and throws away
whatever else the view had folded in. Naming the event leaves `sort-change` and
`group-change` working as they always did.

```js
source.bind(qft, { steerOnly: true, ignore: ['quick-filter-change'] });
```

An ignored event gets **no listener at all**, rather than a listener that
returns early — so a view that owns an event owns it outright, with no chance of
the source having already acted by the time the view's own handler runs.

- Site: `src/core/data-source.ts`

### T-adapter-lives-at-the-binding

`as` reshapes the rows before they reach ONE component.

Components ask for different shapes: a chart wants `[{ label, value }]`, the data
grid wants `{ columns, rows }`. Forcing one shape on every component would mean
changing 21 of them, so the ADAPTER lives at the binding, where the mismatch
actually is.

```js
source.bind(grid,  { as: (rows) => ({ columns, rows }) });
source.bind(chart, { as: (rows) => rows.map(toSlice) });
```

It also receives the source, so an adapter can read the total or the state — a
"N of M" summary needs both.

This is why the no-op push guard compares the ROWS ARRAY and never the adapted
payload: an `as` adapter builds a new object every call, so comparing its output
would never match. See `T-no-op-load-guard`.

- Site: `src/core/data-source.ts`

### T-steering-events-are-a-closed-list

`STEERING_EVENTS` is the CLOSED list of events a bound component may send up to
the source: `sort-change`, `group-change`, `quick-filter-change`,
`filter-change`, `page-change`, `page-size-change`, `search-change`.

Only these. A component fires plenty more (`row-click`, `bar-click`) that are the
app's business, not the source's — a source that listened to everything would
turn every click into a reload.

The detail shapes `#steer` reads are the components' own, already ratified. It
reads them; it does not ask components to send anything new. So adding an event
here is a decision about what steers a query, never about what a component
emits.

- Site: `src/core/data-source.ts`

### T-in-flight-ticket-discards-stale

A source is steered by controls a person can use quickly — three filter chips in
a second — and each change starts a load. `#inFlight` holds a Symbol ticket for
the LATEST one so a slower earlier response is DISCARDED rather than overwriting
a newer one. That is the classic out-of-order bug: a slow first filter landing
after a fast second one shows the wrong rows.

Three fields, and they are deliberately separate:

- `#inFlight` — the ticket. Checked after the await, in the catch, and in the
  finally, so a stale response cannot publish, cannot raise an `error`, and
  cannot clear another load's loading flag.
- `#inFlightKey` — the key of the load in flight. Needed because…
- `#lastLoadKey` — the key of the last COMPLETED load, written only after a
  response wins the race. A discarded response must not make the next identical
  request skip.

A burst of identical writes all run BEFORE the first finishes, so the completed
key cannot stop them and the in-flight key can. Without it, 20 identical writes
in one tick produced 20 store reads even though the first was already fetching
the answer.

- Site: `src/core/data-source.ts`

### T-parts-order-must-be-stable

`#parts` is a **Map**, so a key is REPLACED rather than appended and iteration
order is stable.

The composed filter must not re-order itself between loads. If it did,
`#stateKey()` would see a change where there is none and the identical-key skip
(`T-no-op-load-guard`) would stop working — every no-op contribution would cost
a full load again.

- Site: `src/core/data-source.ts`

### T-set-state-merges-page-last

`setState()` is MERGED, not replaced: a caller restoring a filter and a sort must
not silently reset the page size to null. Every field is optional and what is
not named keeps the value it had. It coalesces within a tick like the six
setters, so one call is ONE load whatever was set (see `#schedule`).

Two rules inside it:

1. **A restored `filter` REPLACES, and clears the named parts with it** — the
   same claim `setFilter` makes. A saved view says what the whole query is;
   leaving a stale contribution behind would AND something the definition never
   mentioned into it. A host that composes by contribution restores the PARTS
   instead: `contribute('view', snapshot.source.filter)` after this.
2. **PAGE LAST, and not clamped here.** The total it would be clamped against
   belongs to the PREVIOUS filter. The load below re-clamps against the new one,
   which is the only honest moment to do it.

It does NOT persist. Where state is kept, and whether it survives a reload, is
the host's call (sessionStorage, a URL, a server table) — a source that wrote to
storage would choose for every app that binds one. That is why
`persist-view.ts` is a separate helper.

- Site: `src/core/data-source.ts`

### T-contribute-beats-last-writer

`setFilter` replaces the WHOLE filter — the blunt instrument, and still the right
one when a single writer owns the whole query. `contribute(key, filter)` owns ONE
NAMED PART:

```js
source.contribute('chips',   filterFromChips(...));
source.contribute('columns', ['and', ...clauses]);
source.contribute('view',    preset.filter);
```

Every part is ANDed. A key is replaced by its next contribution and removed by
`undefined`, so each writer changes only what it owns and cannot clobber
another's.

A real screen filters from several altitudes — app header, view toolbar, column
headings, a saved view — all writing one `filter`. With `setFilter` alone the
LAST WRITER WINS, so every view rebuilds the whole filter by hand from variables
it keeps in step itself; the records example had four.

Provenance survives as a bonus: "clear just the column filters" is
`contribute('columns', undefined)`, not a recomposition.

**`setFilter` CLEARS every contribution**, because the two are different claims
about the same value and quietly ANDing them would make `setFilter` not mean what
it says.

- Site: `src/core/data-source.ts`

### T-coalesce-microtask-not-debounce

Every setter calls `#schedule()` rather than `load()` directly, coalescing the
writes in one tick into a single load.

A person typing produces a filter per keystroke, and each is a DIFFERENT
question — so the identical-key guard (`T-no-op-load-guard`) cannot help. Six
keystrokes over 20,000 rows meant six full filter-and-sort passes, five of whose
answers were thrown away before anyone saw them.

**A microtask, not a timer.** It waits for the current synchronous run to finish
and no longer: a view that sets a filter, a sort and a page in one handler gets
ONE load, and a keystroke still queries on its own tick. A debounce would be a
policy about how fast people type, which is the caller's to decide, not this
layer's.

`load()` stays immediate and public: a caller that awaits it means it.

- Site: `src/core/data-source.ts`

### T-push-writes-state-as-attributes

`#push` writes the view state as ATTRIBUTES, which is what makes a shared sort
visible without a JS branch anywhere: the grid's header arrow is drawn from
`data-sort-field` / `data-sort-direction` in CSS, so writing them here makes the
toolbar's Sort chip and the grid's own header two views of one value.

`data-filter-fields` carries WHICH fields the filter touches, not the filter
itself. A grid marks those columns' headers active, so a filter set from the
toolbar ABOVE the grid still shows up on the columns it is narrowing. Without it
the grid only ever knew about filters typed into its own header row, and a chip
change silently shrank the table with nothing to say why. `filterFields()` in
`store.ts` flattens the filter tree to produce it.

`undefined` REMOVES an attribute rather than writing an empty one, so CSS stops
matching.

- Site: `src/core/data-source.ts`

### T-error-is-a-state-not-a-throw

`load()` emits `loading` first so a bound `sherpa-container` can show its
overlay, then `change` — or `error`, which is a **STATE, not a throw**: a failed
load must not take down the caller that merely changed a filter. A setter is a
statement of intent, and a backend being down is not a programming error at the
call site that typed into a box.

So the catch dispatches `error` and returns the PREVIOUS result, leaving the last
good rows on screen rather than blanking the view. Both the catch and the finally
re-check the in-flight ticket (`T-in-flight-ticket-discards-stale`), so a stale
failure cannot raise an `error` for a load that has already been superseded, and
cannot clear a newer load's loading flag.

A page can also fall PAST THE END when a filter narrows the set. It is re-clamped
and reloaded ONCE — FORCED, because `#lastLoadKey` was just written and the
re-clamp must re-read whatever the new page holds — rather than showing an empty
page.

- Site: `src/core/data-source.ts`

### T-toggle-chips-have-no-field

`filterFromChips` turns a quick-filter toolbar's change detail into a Filter. The
detail is `{ active: string[], values: Record<string, string[]> }` — `active`
names the toggle chips that are ON, `values` the menu chips' picks. Each chip's
id IS its field, by construction in the toolbar.

A chip narrows with **OR** across its own values, and chips narrow with **AND**
across each other: "Plan is Pro or Enterprise, AND Region is EMEA". One pick is
an `eq`, several an `in`.

**Toggle chips are deliberately NOT turned into a clause here.** They have no
field of their own — the toolbar's own example maps them onto one column, a
status — and a source cannot guess which. They are still reported so an app can
act on them: `active` reaches the app through the event as it always did. A view
that knows the column translates them itself, which is exactly what `ignore`
exists for (`T-ignore-is-the-scalpel`).

- Site: `src/core/data-source.ts`
- Site: `src/components/sherpa-quick-filter-toolbar/sherpa-quick-filter-toolbar.ts`

### T-persist-defaults-per-tab

`persistView` keeps a DataSource's view state across a page reload. An accidental
refresh throws away every filter, sort and page a person set, and they start
again.

It is a HELPER, not a feature of `DataSource`. Where a view state is kept — and
whether it should survive a reload at all — is the host's decision: a dashboard
may want it, a wizard may not, and a saved-views table on a server is a third
answer. A source that wrote to storage itself would make that choice for every
app that ever binds one (see `T-set-state-merges-page-last`).

**`sessionStorage` BY DEFAULT**, and that is the important part: two tabs on the
same screen filtered differently is a feature, not a bug, and `localStorage`
would make them fight. `{ shared: true }` is for the rarer case where a filter
genuinely belongs to the person rather than to the tab.

`saveViewAs` defaults the OTHER WAY — SHARED (`localStorage`) — and deliberately:
a view a reader took the trouble to NAME should outlive the tab, where "where was
I" state should not.

- Site: `src/core/persist-view.ts`

### T-storage-access-throws

Web Storage **throws on ACCESS** — not on read, on touching the global — in a
private window, with site data blocked, and during preview or thumbnail
capture.

A failure means the state is not KEPT. It never means the page breaks.

`src/core/web-storage.ts` is the only place that knows this. Before it,
`persist-view.ts` and `session.ts` carried a **byte-identical** `storage()`
function plus their own try/catch at every call site: **nineteen catch blocks
across three files** guarding one quirk. Three remain, and none of them is
about storage.

| | |
|---|---|
| `readText` / `writeText` | raw strings; a blocked store reads `null` and writes nothing |
| `readJson(kind, key, fallback, guard?)` | parses, and **FORGETS the key** when it cannot be understood |
| `writeJson` | drops a value that will not serialise rather than throwing |
| `removeKey` | its own try — removing can throw too |
| `isPlainObject` | the shape guard, because that is all a stored value can be trusted to be |

**A stored object is trustworthy in SHAPE, never in content.** It outlives the
code that wrote it, and a hand-edited one is a plain string. `readJson` takes a
guard for that reason; without one, any parsed value passes, which is right for
a caller taking `unknown` and wrong for one that is not.

Verified in the browser by redefining `localStorage` to throw on every get:
all five functions returned their fallback and none threw. A value stored as
`not json at all` returned the fallback AND left the key removed; a value the
guard rejected did the same; a value the guard accepted was kept.

- Site: `src/core/web-storage.ts`
- Site: `src/core/persist-view.ts`
- Site: `src/core/session.ts`
- Site: `src/core/idb-store.ts`
- Site: `src/core/stores.ts`
- Site: `test/e2e/reforged-web-storage.spec.ts`

### T-one-snapshot-not-a-key-per-concern

ONE SNAPSHOT, not a key per concern. It was heading for four — source state,
column filters, selection, chips — four shapes and four restore paths for one
idea. A saved view, a preset, a deep link and an agent's MCP request are the
SAME object; that is the point of having one shape.

**WHAT EACH ELEMENT CONTRIBUTES is the caller's function**, because only the
caller knows which properties are view state and which are incidental — guessing
would restore someone's scroll position a week later. Each returns an
`ElementNode.state` block, so a saved view and a preset interchange. The same
rule is why `captureView`'s `reads` map is required and why omitting it makes an
element contribute nothing.

`ViewSnapshot.v` is the version of the SHAPE, not of the data. A saved view
outlives the code that made it, and an unrecognised version is ignored WHOLE
rather than half-applied, because a definition applied in part leaves a screen in
a state nobody designed.

- Site: `src/core/persist-view.ts`

### T-restore-before-first-load

RESTORE FIRST, before anything is wired, so the source loads ONCE with the
remembered state rather than loading empty and then loading again.

`setState` coalesces within a tick (`T-coalesce-microtask-not-debounce`), so a
restore that sets a filter, a sort and a page is still one load — but only if it
happens before the source has answered its first question.

The save side is the mirror: it hangs off the source's **`change`**, which fires
after a load COMPLETES — the one moment the state is both settled and known to be
loadable. Saving on a setter would record a query that might still fail. A host
whose view has no source calls the returned `save` itself.

`DataSource extends EventTarget`, so `addEventListener` honours the
`AbortSignal` natively — no second way to say "stop" (see
`T-signal-not-a-teardown-list`).

- Site: `src/core/persist-view.ts`
- Site: `src/core/view-sync.ts`

### T-apply-degrades-never-throws

`applyViewSnapshot` DEGRADES rather than throws. A saved view outlives its code —
a component renamed, a column dropped, a method gone — and one stale key must not
stop the rest being restored. What could not be applied comes back in the report,
so a host can tell the user rather than leave them guessing.

```js
const report = applyViewSnapshot(snapshot, { source, elements: { grid } });
if (report.missingElements.length) … // tell someone
```

**ORDER MATTERS and is fixed here:** the SOURCE first, so the rows a component's
state refers to are on their way, then each element. Within an element,
`applyState` waits for `rendered` — a grid cannot filter a column it does not
have yet. That deferral is also why the report can only name what it knows NOW:
it cannot say what a not-yet-rendered element will skip.

The same rule governs `onViewPicked`, which reports gaps and never throws; the
default is a `console.warn`, because a definition that could not be fully applied
is worth saying out loud rather than leaving a reader to wonder why half the
screen moved.

- Site: `src/core/persist-view.ts`

### T-capture-reads-only-what-is-named

WHAT `captureView` READS is named per element, because only the caller knows
which of a component's properties are view state and which are incidental. A
grid's column filters belong in a saved view; its scroll position does not.

```js
captureView({ elements: { grid } }, { grid: ['columnClause', 'selectedKeys'] })
```

**Omit the map and each element contributes nothing** — deliberately, because
guessing would put transient state in a saved view and a reader would find their
scroll position restored a week later.

A property whose value is a FUNCTION is skipped: `columnClause` needs a field
argument, so a caller wanting it must name the setter form instead. Skipping
beats storing `"[object Function]"`.

`saveViewAs` takes the same `reads` map for the same reason.

- Site: `src/core/persist-view.ts`

### T-view-library-is-one-vocabulary

A page rarely has ONE saved view; it has a SET, offered in a chip, and picking one
applies it. Both example pages wrote that by hand and wrote it the same way — the
chip options derived from the set, a listener reading `detail.values.view[0]`, an
apply, and a warn when a stale definition could not be fully restored.

Four small pieces of one idea, copied. **The third copy is where a vocabulary
starts to drift**, so it lives here instead.

The chip's options are DERIVED from the views themselves (`viewOptions`). A
hand-written option list is a second place the label lives, and the two drift: a
view renamed in one file still reads by its old name in the chip. `currentId`
defaults to the FIRST view, because a set with nothing selected leaves the chip
blank and a reader looking at data no view claims — which is also what
`T-persistent-chip-is-a-selector` guards on the toolbar side.

- Site: `src/core/persist-view.ts`

### T-view-content-is-a-view-definition

A `SavedView.content` carries that view's OWN CONTENT AND LAYOUT, for when it
differs from its neighbours'. A preset is not always the same screen with
different rows: "Capacity planning" may want a histogram and a forecast table
where "Fleet overview" wants metric tiles and a donut.

**OPTIONAL, and most views omit it** — a set of views over ONE screen is the
common and cheap case, where nothing is torn down and `snapshot.elements`
configures what is already there.

It is a `ViewDefinition`, the shape `renderView` builds. A second shape for "a
screen as data" would be a second thing to learn, serialise and get wrong.

The snapshot still applies AFTERWARDS, so a view can build its own grid AND
arrive with a column already filtered. `saveViewAs` stores `content` for the
same reason: a view of a screen the reader BUILT has to remember that screen, or
re-opening it would restore the state onto whatever was there instead.

- Site: `src/core/persist-view.ts`

### T-library-re-read-on-every-pick

`onViewPicked`'s `views` may be a FUNCTION, and should be whenever the set can
grow.

A library GROWS — a reader saves a view and it joins the set — and a listener
holding the object it was wired with would never see one. **The dashboard's Save
button wired the presets and then could not restore anything the reader had
saved.** So the library is RE-READ on every pick. Pass the object only for a
fixed set of presets.

- Site: `src/core/persist-view.ts`

### T-values-carries-two-shapes

`onViewPicked` listens for THE BAR'S `quick-filter-change`, not a single chip's,
and gates on `detail.scope !== 'bar'`.

`values` carries TWO SHAPES on this one event name — a bare `string[]` from a
chip, a `Record<id, string[]>` from the toolbar — and reading one as the other is
a bug that has already shipped once: **a view turned a sort pick into a filter and
emptied the grid.** Same family as
`T-capture-beats-registration-order`.

This USED to be safe by accident: `['name']['view']` is `undefined`, so a chip's
array fell through the next line. Accidental safety is the kind that stops
working when a shape changes slightly.

It then READS `detail.values.view[0]`, the View chip's id — the one convention a
view toolbar has. A change naming no view is IGNORED rather than treated as "no
view", because you are always in some view and the other chips on that bar fire
the same event.

- Site: `src/core/persist-view.ts`
- Site: `src/components/sherpa-quick-filter-toolbar/sherpa-quick-filter-toolbar.ts`

### T-content-first-original-once

CONTENT FIRST, when a picked view brings its own. It is built BEFORE the snapshot
because the snapshot configures what is ON SCREEN, and for this view that is what
we are about to create. Applying first would set state on the OUTGOING screen and
then throw it away.

The host says WHERE via `into`. Without it the content is built and handed back
unplaced in `pick.rendered`, which is honest: this function knows what a view
wants, not where a page keeps it.

**REMEMBER WHAT WAS THERE, once, before the FIRST replacement.** A set of views
is usually MIXED: most share the page's own content and one or two bring their
own. Without this, the first view that brought content kept the screen for good —
picking any other view moved the data while capacity's grid stayed on display,
which is the exact lie this whole feature exists to prevent. Captured on the
FIRST swap only, so it holds the PAGE'S own content rather than the previous
view's.

`replaceChildren`, not `append`: switching view REPLACES the content, and a view
that leaves its predecessor's charts on screen is two views at once. Going back,
the original nodes are RE-ATTACHED, not rebuilt — they are the same elements the
page bound at init, so every bind still points at them and nothing has to be
re-wired.

Elements a view just built are then addressable by the ids it used, so the
snapshot can configure them: they did not exist when the listener was wired, so
`targets.elements` could not have named them.

- Site: `src/core/persist-view.ts`

### T-derived-id-makes-resave-an-update

A saved view's id is DERIVED from its label — lowercase, words joined by a hyphen
— rather than generated. That is what makes saving the same name twice an
**UPDATE**. A random id would leave a reader with two "Q3 capacity" rows and no
way to tell them apart.

A label of pure punctuation still needs an id, so the slug falls back to the RAW
label; that keeps it addressable rather than colliding on an empty key.

`deleteSavedView` REBUILDS the store without the id rather than
`delete views[id]`. A dynamic delete on a parsed-JSON object is the one shape
that can carry a prototype key through — and this object came from storage, which
a person can edit (`T-storage-access-throws`).

- Site: `src/core/persist-view.ts`

### T-store-is-stateless

A Store is STATELESS: it reads and writes records and remembers nothing about how
they are being viewed. Sorting, filtering, grouping and paging are the
DataSource's job, so ONE store can back several views of the same records without
them fighting over a shared cursor.

That split is **DevExtreme's**, which Apex already uses — so the mental model
transfers. What is NOT borrowed is the size: no OData, no remote grouping, no
query-builder language. A store answers `load(options)` and four CRUD calls, and
the interface is identical whatever backs it, so a view moves from an in-memory
array to an HTTP endpoint without touching the components.

Every store extends `EventTarget`, so "tell everyone the records changed" is the
platform's own `dispatchEvent` rather than a subscriber list written by hand. A
`change` detail names what happened so a listener can be cheap about it, but a
DataSource simply RELOADS: deciding whether a changed row still matches the
current filter, and where it now sorts, is exactly the work the source already
does, and re-deriving is cheaper than getting that wrong.

- Site: `src/core/store.ts`

### T-filter-is-data-not-a-predicate

A filter is `[field, op, value]` — DATA — rather than a function, because a
filter has to survive being SENT TO A SERVER: a RestStore turns it into a query
string, an ArrayStore runs it in memory, and both read the SAME declaration. A
predicate function could only ever run on the client.

Groups nest: `['and', [...], [...]]`, and `or` is the same shape.

`OP_LABELS` sits beside `FilterOp` on purpose: the KEYS ARE the operators, so a
control builds its picker from this map and whatever it reports back is already a
clause the store understands. No translation table exists to drift, and every
query-building surface shares it — the data grid's column menu today, a Filter
Panel later. **A second copy anywhere is a second vocabulary.**

- Site: `src/core/store.ts`
- Site: `src/components/sherpa-data-grid/sherpa-data-grid.ts`

### T-ops-follow-the-column-type

`OPS_FOR_TYPE` is DevExtreme's binary operations, split by what the question
MEANS. Offering "greater than" on a name column invites a comparison the reader
cannot reason about; offering "starts with" on a spend column is not a question
at all.

`between` is absent from BOTH lists: it is the RANGE mode, because a span needs
two inputs and a single condition list cannot grow one. That is the same
distinction the toolbar's Range switch makes — see
`T-range-switch-swaps-not-rebuilds`.

A `date` offers NO operator list at all: a date is answered by clicking a
calendar.

- Site: `src/core/store.ts`
- Site: `src/components/sherpa-data-grid/sherpa-data-grid.ts`

### T-dropped-rows-must-be-countable

`LoadResult.dropped` is the count of rows the store's schema REFUSED and so did
not hand over. It is ABSENT when nothing was dropped — the normal case — so a
host can test for the field rather than compare a count to zero.

A read cannot throw the way a write does: one bad row in a thousand must not
empty a grid. **But a silent drop is worse than a bad row**, because a schema
quietly rejecting 40% of a response looks like a backend outage. So the count
travels WITH the rows and a host can surface it.

`issues` carries why — the FIRST FEW ONLY. A broken backend produces one issue
per row, and ten thousand copies of "name is required" tell a host nothing the
first one did not.

This is the only path by which a schema's refusals are readable, which is why
`DataSource.result` hands back the whole `LoadResult` and not just `rows` and
`total`.

- Site: `src/core/store.ts`
- Site: `src/core/base-store.ts`
- Site: `test/e2e/reforged-idb-store.spec.ts`

### T-one-collator-for-the-library

ONE comparator for the whole library. The reason is recorded in the data-layer
plan: the grid, the quick-filter toolbar and the example app each had their own
compare, and they DISAGREED — one passed `{ numeric: true }` and one did not, so
"item 2" and "item 10" ordered differently depending on which control you used.

A single `Intl.Collator` instance is reused for the whole sort. `localeCompare`
re-derives the locale rules on every call, which is markedly slower across a few
hundred rows.

Two rules the comparator encodes, both easy to "simplify" wrongly:

- **Nulls sort LAST in either direction.** "No value" is not a small value, and
  flipping the sort should not march the blanks to the top. So `sortRows` must
  NOT apply its direction multiplier to a null comparison — a blank belongs at
  the bottom whichever way the column runs.
- **`toSorted`, never `sort`.** The caller's array must not be reordered under
  it, because a store's records are shared by every source reading them. That is
  the same cross-module contract `T-no-op-load-guard` depends on: the push guard
  compares rows by identity, so a store that sorted in place would defeat it.

Null `direction` is treated as ascending, matching `data-sort-direction`.

- Site: `src/core/store.ts`
- Site: `src/components/sherpa-data-grid/sherpa-data-grid.ts`

### T-filter-fields-flattens-the-tree

`filterFields()` returns every FIELD one filter touches, in the order it first
appears.

A filter is a TREE, so a bound component cannot just read `filter[0]` to find out
which of its columns are being narrowed. This flattens it. It is used to tell the
grid which headers to mark active — the column doing something to the view has to
say so, and only the source knows what the filter is (see
`T-push-writes-state-as-attributes`, which writes the result as
`data-filter-fields`).

A field can appear in MORE THAN ONE clause — a range is two — and the header only
needs to know THAT it is filtered, not how many times. So the list is
de-duplicated.

- Site: `src/core/store.ts`

### T-loose-equal-is-case-insensitive

`looseEqual` compares for FILTERING, not for sorting.

A filter value arrives as a STRING far more often than not — from an attribute, a
query string, a chip's `value`. `'pro' === 'Pro'` is false and would quietly
filter EVERYTHING away, so string comparison here is case-insensitive. A
strictly-typed comparison stays available through `lt`/`gt`.

`between` is inclusive AND order-insensitive: a date range picked backwards is a
range, not an empty result. The two ends are swapped into order before the
comparison rather than rejected.

- Site: `src/core/store.ts`

### T-pipeline-order-and-no-grouping

`applyOptions` runs search → filter → sort, then pages. **The order is not
arbitrary.** Narrowing comes first so the sort runs over fewer rows; paging comes
LAST because the page is a window onto the final order, and `total` has to count
the MATCHES, not the page.

**Grouping is deliberately NOT applied here.** A grouped view still needs the
FLAT rows — `sherpa-data-grid` sorts by the group field and stamps a heading row
when the value changes — so the group field is applied as a LEADING SORT and the
consumer decides what to draw. That leading spec puts rows sharing a group value
adjacent so a consumer can find each group in one pass, and the caller's own sort
specs then order rows WITHIN their group.

`groupRows` exists for a consumer that does want the buckets, and preserves the
order rows ARRIVE in: rows are grouped AFTER sorting, so the groups come out in
sort order and the rows within each keep theirs. `Map.groupBy` keeps insertion
order, which is exactly that.

- Site: `src/core/store.ts`

### T-grid-active-flag-is-not-a-tint

A column ACTING on the view — sorted, or narrowed by a filter — is FLAGGED with
the Style `active` mode (`data-status="active"`) on its HEADING, never on the
filter cell. That row already says what it is doing: the text is in the box the
user just typed into.

**THE FLAG IS NOT A TINT.** The heading's two chips each show their own
on-state, and a tinted heading behind them said the same word twice. The
attribute stays as the system-wide door a host reads and may style; this
component's CSS declines to paint it.

`data-filter-fields` is how a filter set OUTSIDE the grid reaches the headers.
`populate()` hands the grid only the surviving rows, so it cannot work out which
column did it — the data source writes the field names here (see
`T-push-writes-state-as-attributes`, which writes them, and
`T-filter-fields-flattens-the-tree`, which derives them). Without it a chip
change just shrank the table, saying nothing.

- Site: `src/components/sherpa-data-grid/sherpa-data-grid.ts`

### T-grid-reports-never-combines

The grid does NOT filter its own rows off a column filter. It holds ONE
column's clause and has no idea what else is filtering the view, so combining
the clauses belongs to whoever owns the query — a DataSource, or the page.

The grid instead lights the column (see `T-grid-active-flag-is-not-a-tint`) and
says what was asked for. `#columnFilters` holds one `ColumnFilter` per field for
the same reason it is held rather than applied: keeping it is what lets a
re-opened menu show the pair already set, and what survives the header rebuild
that every sort causes.

- Site: `src/components/sherpa-data-grid/sherpa-data-grid.ts`

### T-grid-key-or-position-lies

`GridConfig.key` names the field that identifies a row — `'id'`, `'email'`,
whatever the records use. The same thing a Store's `key` option names.

Without one a selection can only be described by POSITION, and a position
changes meaning the moment a sort or a filter does — so a saved selection would
silently come back pointing at different rows. With one, a selection is a list
of keys and survives anything.

It is optional: a grid given no key behaves exactly as it always did, and
`selectedKeys` returns empty rather than approximating.

- Site: `src/components/sherpa-data-grid/sherpa-data-grid.ts`

### T-grid-range-keeps-both-shapes

`ColumnFilter.range` says which shape a column filter is: a single `op` +
`value`, or a `between` over `from`..`to`. **Both are kept rather than a tagged
union**, so flipping the Range switch and flipping back finds what was typed on
the other side still there.

This is the grid's half of `T-range-switch-swaps-not-rebuilds` — the toolbar
keeps both shapes in the DOM, and the grid keeps both in the held clause.

- Site: `src/components/sherpa-data-grid/sherpa-data-grid.ts`

### T-grid-suspend-is-not-clear

`ColumnFilter.suspended` means SET but not applied — the reader toggled its
toolbar chip off. A chip's body is a TOGGLE: off means "stop applying this", not
"delete it".

The clause is kept, so toggling back on restores it without retyping, and
`columnClause()` still returns it — the caller asking is the one putting it back
into the query. But the heading stops reading active, because the column is
narrowing nothing right now and **a lit column that filters nothing is a lie**.
The MATCH MARKS go with it: a suspended filter is hiding no rows, so marking the
ones that would have matched claims something untrue.

Deleting is `clearColumnFilter`, which is what the menu's Remove button does.
This is the suspend ≠ clear rule as a COLUMN sees it; `T-sort-is-tri-state` and
`T-a-chip-body-cycles-its-states` are the same rule for the toolbar's chips.

- Site: `src/components/sherpa-data-grid/sherpa-data-grid.ts`

### T-grid-column-width-bounds

`MIN_COL_WIDTH = 96`, `MAX_COL_WIDTH = 480`, `DEFAULT_COL_WIDTH = 160`. All
three are on the 8px grid, and each number is a measurement, not a taste:

- **96** is about six characters of the 14px body face plus its padding.
  Narrower than that and a heading is pure ellipsis.
- **480** is wide enough for a long address without one column owning the panel.
- **160** fits a name, a date or a mid-length status without clipping, which is
  most of what a grid holds.

Every route into a width is clamped, so a caller's `width: 4` cannot produce a
column too thin to read.

- Site: `src/components/sherpa-data-grid/sherpa-data-grid.ts`

### T-grid-header-needs-capture

`.head-row`'s click listener is CAPTURE-phase. The sort control is a chip, and a
chip's caret handler calls `stopPropagation()` — it is guarding its own menu
from the body's toggle. **A bubbling listener here would never see the click that
IS the sort.**

Registration order then decides order within capture, which is what
`T-swallow-flag-not-listener` depends on. The same platform fact as
`T-capture-beats-registration-order`, reached from the other side: there capture
was needed to run BEFORE a host's listener, here to run at all.

- Site: `src/components/sherpa-data-grid/sherpa-data-grid.ts`

### T-grid-chip-vocabulary-stops-here

A header filter button IS a `<sherpa-quick-filter>`, so it emits the chip's own
composed events — `quick-filter-change` and `quick-filter-click`. Those are the
TOOLBAR's vocabulary: **a DataSource bound to this grid hears
`quick-filter-change` and sets the whole filter from it, wiping everything else
the view had folded in.**

So they are swallowed at the header row (`#stopChipEvent`, matching both
`.head-filter` and `.head-sort`). The grid speaks `column-filter-change`, which
says which COLUMN and carries a ready clause. Anything else leaking out would be
a second, rival dialect for the same gesture.

The chip is reused for its MENU — its cross-shadow placement
(`T-anchor-cross-root`) and its Apply footer — not for its vocabulary.
`T-steering-events-are-a-closed-list` is the source's side of the same boundary.

- Site: `src/components/sherpa-data-grid/sherpa-data-grid.ts`

### T-grid-populate-keeps-column-filters

`renderData` treats its two filter maps differently, and must.

The header-row `#filters` are CLEARED outright: fresh data may name columns that
no longer exist, and silently hiding rows against an invisible filter would look
like data loss.

**`#columnFilters` drop only where the COLUMN has gone.** They cannot be cleared
outright, because a column filter is what CAUSES a re-populate: the grid reports
the clause, the host queries, and the rows come back through here. Wiping the map
on arrival threw away the filter that had just been applied, so the heading went
dark and the chip unlit **the instant the rows it asked for appeared**. The grid
does not narrow its own rows, so a stale entry would not hide anything — but it
would light a column that is gone and re-stamp a menu for a field the data no
longer has.

The SELECTION is then re-resolved by KEY. New records are new objects, so nothing
selected by OBJECT identity can still be present, but a selection asked for by
key can. That is what lets a saved view restore a selection at all — a snapshot
applies before the source has populated, so `select()` had nothing to match and
silently selected nothing (`T-restore-before-first-load` is the source's half of
that race). It also means a filter that hides a selected row and shows it again
does not lose the tick.

- Site: `src/components/sherpa-data-grid/sherpa-data-grid.ts`

### T-grid-select-all-is-derived

The select-all box is DERIVED from what is selected, never reset.

Clearing it on render — as `#render` and `#applyFilter` both used to — **threw
the user's selection away on every sort, every filter keystroke and every
quick-filter toggle.** A filter changes which records are VISIBLE, not which are
chosen. The focused row survives the same way, because it is held as a record
rather than a position.

`indeterminate` is a property, never an attribute, and a box that is
indeterminate reports `checked === false` — see `T-indeterminate-reports-false`
for what trusting that box costs.

- Site: `src/components/sherpa-data-grid/sherpa-data-grid.ts`

### T-grid-pin-offset-is-measured

`#syncPinned` settles the frozen leading columns, and both of its jobs need the
DOM:

1. SELECTION cells join the frozen block, but only while `data-selectable`
   reveals them — a `display: none` cell must not claim the start offset. That is
   why `data-selectable` is observed even though CSS owns its reveal.
2. The second pinned column's offset is the MEASURED selection-cell width. The
   data column auto-sizes, so no CSS value can say "clear whatever is pinned
   before me". JS writes the number as the host custom property `--_pin-offset`
   — state, not a style decision.

How that width is READ is its own trap — see
`T-grid-pin-offset-needs-subpixel`.

`data-pin-last` names the LAST pinned cell — the only one that draws the scroll
shadow, so a two-column freeze shows one edge and not two.

- Site: `src/components/sherpa-data-grid/sherpa-data-grid.ts`

### T-grid-pin-offset-needs-subpixel

Read the pinned select cell with `getBoundingClientRect().width`, **never
`offsetWidth`**.

The select cell is a 0.5px-bordered 32px box, so its real laid-out width is
FRACTIONAL. `offsetWidth` rounds to an integer, and the lost fraction left **a
hairline of the scrolling column visible under the pin** — a one-pixel seam that
looks like a rendering artefact rather than a measurement bug.

The same reason `T-col-width-not-inline-size` exists one function away: table
column geometry here is sub-pixel and does not survive being rounded or
re-expressed.

- Site: `src/components/sherpa-data-grid/sherpa-data-grid.ts`

### T-grid-sort-glyph-needs-a-third-state

The sort glyph is a TRI-STATE, read from the shared `ORGANISE_ICONS` map that the
quick-filter toolbar also reads — a column header and a toolbar chip are two
views of ONE sort and must never disagree about what "descending" looks like.

A sortable column that is NOT the current sort shows `sort-none`, so it reads as
"you can sort by this" before anyone clicks. **The old pure-CSS triangle had no
third state**: it could only be up or down, so an unsorted column showed nothing
and looked unsortable.

The chip is LOCKED, so the grid sets its on-state — on for the two live
directions, off for "not the sort column", which is what the toolbar's own Sort
chip does for its suspended step.

See `T-fa-pro-renders-nothing` for why `sort-none` is `fa-sort` and not
`fa-bars`.

- Site: `src/components/sherpa-data-grid/sherpa-data-grid.ts`

(none — cites existing traps)

NOTE: Neither `T-filter-is-data-not-a-predicate` nor
`T-ops-follow-the-column-type` lists this file yet. Both are in the
SITE LINES TO ADD MANUALLY section at the top.

`T-filter-is-data-not-a-predicate` already states the exact fact this comment
carried — "the KEYS ARE the operators, so a control builds its picker from this
map and whatever it reports back is already a clause the store understands. No
translation table exists to drift … the data grid's column menu today, a Filter
Panel later." Writing it again here would be the second copy that trap warns
about. `T-ops-follow-the-column-type` owns the per-type split.

### T-grid-slider-spans-real-values

A NUMBER column's range slider is given `min`/`max` from the column's REAL
values (floor of the minimum, ceil of the maximum, over the finite ones).

Left at the slider's own 0..100 default, a spend column would open with **every
row crushed at the far left** and no way to pick between them.

A fresh range then opens spanning the WHOLE column, so the filter starts by
excluding nothing — opening at 0..0 would empty the view before the reader had
asked it anything.

- Site: `src/components/sherpa-data-grid/sherpa-data-grid.ts`

### T-grid-number-clause-must-coerce

A NUMBER column's filter ends are COERCED to numbers before they become a
clause.

`compareValues` only compares numerically when BOTH sides are numbers. A string
filter against numeric rows falls through to the text collator, where **"100"
sorts below "9"** — so "greater than 9" silently misses every three-digit row and
looks like a bug in the data. **The grid is what knows the column's type, so it
is what must say so**: the store cannot infer it, and
`T-loose-equal-is-case-insensitive` is the store deliberately being lenient in
the other direction.

A blank or unparseable entry is left as typed rather than turned into `NaN`,
which would match nothing at all with no way to see why.

`between` is the RANGE shape and its value is the two ends, both cast the same
way.

- Site: `src/components/sherpa-data-grid/sherpa-data-grid.ts`

### T-grid-read-without-write-is-half-an-api

`setColumnFilter` is the counterpart of `columnClause()`: **a value you can read
and not write is half an API.** Reload a filtered column without it and you find
it lit with an EMPTY menu — the rows are right while the control lies. The parity
sweep is what found this shape, as it found `groupField` in
`T-a-chip-body-cycles-its-states`.

```
grid.setColumnFilter('name', ['name', 'contains', 'ana']);
grid.setColumnFilter('spend', ['spend', 'between', [10, 50]]);
grid.setColumnFilter('name', null);        // same as clearColumnFilter
```

It takes the same store FilterClause that `column-filter-change` reports, so the
round trip IS the parity rule.

**SILENT**, like `select()` and `clearColumnFilter()`: echoing would make a host
that routes the event into its query filter twice. Nothing to filter by is not a
filter, so a restored empty clause behaves like a cleared one.

The HEADER is rebuilt rather than reached into — `#addColumnFilter` restores each
menu from `#columnFilters`, so there is one path that writes a menu and it is the
one a re-render uses.

- Site: `src/components/sherpa-data-grid/sherpa-data-grid.ts`

### T-grid-mark-is-substring-only

A filtered column says WHICH rows survived; the `<mark>` in a cell says why THIS
one did.

**TEXT only.** A number or date matches as a whole value — "between 10 and 50"
does not match a SUBSTRING of 42, and underlining the "4" would claim a
precision the filter does not have.

**Only the SUBSTRING conditions** leave something to point at: `contains`,
`startswith`, `endswith`. `eq` matched the whole cell, so marking it would
underline every character; `ne` and `notcontains` matched by NOT being there, and
there is nothing to mark. A suspended clause marks nothing either
(`T-grid-suspend-is-not-clear`).

The mark uses the CELL's own casing, not the needle's — the reader typed "ana"
and the row says "Ana", and the row is the truth. `markMatch()` slices the
haystack for exactly that reason; see `sherpa-element.ts` for the text-node and
casing rulings it owns. The grid and `sherpa-nav-item` both wrote this once, and
that duplication is what the shared helper replaced.

- Site: `src/components/sherpa-data-grid/sherpa-data-grid.ts`

### T-grid-thead-sticks-as-one-block

There is **no sticky-offset measurement** in this grid, deliberately. The WHOLE
`<thead>` sticks as one block, so its two rows stay in normal flow relative to
each other and nothing has to know the label row's height.

Measuring it and offsetting the filter row was the bug: **a sticky offset is
measured from the SCROLLPORT, so it applied at scroll 0 too** and left a phantom
empty band between the two header rows.

Do not reintroduce a measured offset here.

- Site: `src/components/sherpa-data-grid/sherpa-data-grid.ts`

### T-grid-filter-row-uses-store-filterrows

The secondary header row's filters are built as a real FILTER TREE and handed to
the store's `filterRows`, so the row means exactly what a `contains` clause means
everywhere else.

It used to hand-roll the substring match, which is one more place for "what does
contains mean" to drift — the same duplication
`T-filter-is-data-not-a-predicate` forbids. Substring rather than prefix because
a table filter is a "find" — typing "example" should find an address that merely
contains it — and values are stringified first so a numeric column filters as
readily as a text one.

A blank input never reaches here: `#applyFilter` drops an empty needle, so no
clause matches everything by accident. One clause goes through bare; several are
wrapped in `['and', ...]`.

- Site: `src/components/sherpa-data-grid/sherpa-data-grid.ts`

(none — cites existing traps)

NOTE: `T-one-collator-for-the-library` does not list this file yet — it is in
the SITE LINES TO ADD MANUALLY section at the top.
`T-pipeline-order-and-no-grouping` does not list it either, but I have NOT
requested a Site line for it: the citation below names only
`T-one-collator-for-the-library`, so nothing is owed. I mention the pipeline
trap in the prose because the reader will want it, not as a citation.

Both halves of this docblock are already in the doc:
`T-one-collator-for-the-library` owns the null-pinning and the "weaker of two
copies" history ("one passed `{ numeric: true }` and one did not, so item 2 and
item 10 ordered differently"), and `T-pipeline-order-and-no-grouping` owns the
GROUP-FIRST leading-sort rule and the one-pass boundary scan. A third copy here
is what those traps exist to prevent.

### T-grid-sort-is-tri-state

A column header's sort is TRI-STATE:

```
not this column  →  ascending
ascending        →  descending
descending       →  SUSPENDED (column kept, nothing ordered)
suspended        →  ascending again
```

**SUSPENDED, not deleted** — corrected 2026-09-21. It used to delete the column,
which broke `T-a-chip-body-cycles-its-states` ("off is a state, not a delete")
and made this control and the toolbar's Sort chip disagree about what their
shared third state keeps. See `T-a-suspended-sort-is-one-owners-job` for the
wire format and why the memory lives on the source.

The third step is what the toolbar had and this did not: it cycled asc → desc →
asc, so **once a column was sorted there was no way back to unsorted** without
picking a different one. Two controls for one value must agree about how many
states that value has.

`sort-change` therefore carries `field: null, direction: null` on the third
click.

**ONLY ONE COLUMN AT A TIME.** `data-sort-field` holds a single field, so sorting
a new column replaces the old one rather than stacking.

**Not the same third state as the chip's.** `T-sort-is-tri-state` is the
toolbar's version, whose third step SUSPENDS — it keeps the column, because the
chip's menu still holds it. A header has no menu to remember a column in, so its
third step CLEARS. Same count of states, different meaning; do not unify them.

- Site: `src/components/sherpa-data-grid/sherpa-data-grid.ts`

### T-grid-grip-captures-the-pointer

A resize drag captures the pointer ON THE GRIP (`setPointerCapture`), so the
gesture follows the pointer even when it outruns the 8px strip or leaves the grid
entirely. **Without capture a fast drag dropped the column at whatever width it
had when the cursor escaped.**

`pointerdown` also calls `preventDefault()` to stop the text-selection drag and
`stopPropagation()` to keep the event off the header. **Neither stops the CLICK**
— the browser still synthesises one on pointerup and the `<th>`'s sort handler
listens for that — which is why `#onGripUp` swallows the next click as well
(`T-swallow-flag-not-listener`).

The drag's start width is the MEASURED `getBoundingClientRect().width`, not the
configured one: a column can be wider than its `<col>` says when the table has
slack to share, and starting from the config value made the column **jump on the
first pixel of movement**.

`pointermove` writes the `<col>` width DIRECTLY rather than re-rendering. A full
`#render()` on every move would rebuild every row of the body sixty times a
second; the colgroup is the only thing a width changes.

- Site: `src/components/sherpa-data-grid/sherpa-data-grid.ts`

### T-grid-select-remembers-wanted-keys

`select(keys)` REMEMBERS the keys in `#wantedKeys`, it does not merely resolve
them. **A saved view can arrive BEFORE the rows** — a source populates
asynchronously, and a restore that ran first matched against an empty list and
silently selected nothing (`T-restore-before-first-load` is the source's half).
Holding the keys lets `renderData` re-resolve them the moment the rows land, and
lets a filter hide a selected row and show it again without losing the tick.

`null` is meaningfully different from `[]`: empty means "select nothing", null
means "the user's own ticks are in charge".

It REPLACES rather than adds — restoring a view means "this is what is
selected". Unmatched keys are IGNORED, not thrown: a saved view outlives its
records, and one deleted row must not stop the other four coming back
(`T-apply-degrades-never-throws` is the same ruling for a whole snapshot).
**SILENT**, like the other setters — echoing would make a host that routes
`selection-change` back into its state select twice.

The boxes are stamped from `#selected` on every render, so a rebuild is how the
ticks are written; there is one path that sets them, not two.

- Site: `src/components/sherpa-data-grid/sherpa-data-grid.ts`

### T-grid-filter-fields-match-whole

`data-filter-fields` is space-separated and each name must be matched WHOLE.

A bare `includes()` on the raw string would light `status` for a filter on
`substatus`. Split on whitespace and compare the whole token.

The attribute itself is written by the source
(`T-push-writes-state-as-attributes`) from the flattened filter tree
(`T-filter-fields-flattens-the-tree`), which de-duplicates — so a field appearing
in two clauses arrives once, and the header only needs to know THAT it is
filtered.

- Site: `src/components/sherpa-data-grid/sherpa-data-grid.ts`

### T-grid-no-matches-is-not-empty

"No matches" is NOT `data-empty`. `data-empty` hides the whole `<table>`, which
would take the filter input the user is typing in with it.

`data-no-matches` is a separate flag, set when the visible count is 0 but the
grid still holds rows. CSS keeps the header and filter row up and shows the
message under them.

- Site: `src/components/sherpa-data-grid/sherpa-data-grid.ts`

### T-base-class-does-four-things

`SherpaElement` does FOUR things and nothing more:

1. Fetch the component's HTML template (cached once per class) and its CSS.
2. Adopt stylesheets into the shadow root (shared, deduped).
3. Run a guarded lifecycle: `onRender` → `onConnect`, plus `onChange` /
   `onDisconnect`.
4. Expose `populate()` → `renderData()` as the single data path.

Everything a component can be SEEN DOING lives in its CSS, selected off `data-*`
attributes. JS is the last resort — this class exists so a component author
never has to write plumbing, only behaviour.

The contract for a subclass:

```ts
static css      = new URL('./sherpa-foo.css',  import.meta.url);
static html     = new URL('./sherpa-foo.html', import.meta.url);
static props    = { 'data-heading': { type: 'string', kind: 'content', to: '.title' } };
static observed = ['disabled'];             // native attrs + own-handling ones
onRender()                 // shadow ready — cache refs, wire host listeners (once)
onChange(name, old, val)   // an observed attribute changed (after first render)
onConnect()                // once, after the first render completes
onDisconnect()             // teardown — timers, observers
renderData(data)           // populate() payload
```

- Site: `src/core/sherpa-element.ts`

### T-cloning-prototypes-have-no-id

`parseTemplates` maps `<template id="...">` → innerHTML, and returns `null`
when there are NO id'd templates (a single flat template), so the caller can
fall back to the raw markup.

Cloning prototypes are `<template class="...">` with **NO `id`**, and are
deliberately ignored here — they belong to the component's own body, not to its
variant set. An `id` on a row prototype would make SherpaElement's
multi-template parser pick it up as a whole tree to stamp, so the component
would render one row and nothing else.

- Site: `src/core/sherpa-element.ts`

### T-coerce-and-clamp-are-shared

`coerceNum` and `clampNum` are EXPORTED, so the data layer parses a record
field by exactly the same rule a component parses an attribute — the
`format-tick.ts` precedent: one shared function so two callers cannot read the
same value two different ways.

Six components had written their own `#clamp`, and they were NOT the same
function. Each wrapped a real `Math.min(max, Math.max(min, …))` in its own
extras: progress-bar parses a string first, pagination truncates, data-grid
rounds and falls back to a default width. Merging them would have been wrong;
sharing the BOUNDS is not.

ABSENT means null, undefined, empty, whitespace-only or unparseable. A real 0
is a value, not an absence. The clamp runs only on a value that PARSED — a
fallback is returned as given, so a caller's chosen default is never silently
moved by its own bounds. See `T-number-coercion` for the four ways a hand-
written parse went wrong.

- Site: `src/core/sherpa-element.ts`

### T-mark-match-is-one-shape

`markMatch` rebuilds an element as before + `<mark class="match">` + after,
around ONE hit — one shape for a search highlight. The data grid and nav-item
wrote the same five lines, and the grid's comment admitted it had copied
nav-item's.

TEXT NODES, never `innerHTML`: a `<mark>` is CONTENT, and a label containing
`<` would otherwise parse as markup.

THE MARK TAKES THE HAYSTACK'S CASING, so "ana" against "Ana" leaves "Ana"
itself — which is why it slices the haystack rather than writing the needle
back.

It returns the `<mark>`: nav-item wraps it in a `Range` for the Custom
Highlight layer, and a caller that only wants it drawn ignores the return.

- Site: `src/core/sherpa-element.ts`

### T-declared-only-means-css-owns-it

`PropKind` is the same three-way split the generated `<name>.component.yaml`
uses, so the code and the contract agree:

| kind | meaning |
|---|---|
| `content` | JS writes it into the shadow DOM — the base class does it |
| `style` | CSS selects on it; JS never reads it. DECLARED ONLY |
| `visibility` | presence toggles a CSS rule. Declared only, like style |

Only `content` generates any work. `style` and `visibility` exist so the
attribute is TYPED and observable — a JS→CSS write path (`this.set()`), and a
place to hang non-CSS use later — **without** tempting anyone to add a JS
branch for something CSS already handles correctly. Declaring `data-status` is
not licence to add a JS status branch.

- Site: `src/core/sherpa-element.ts`

### T-harness-serves-font-awesome-locally

**`npm test` used to fail a RANDOM 1-18 tests per run, and the failing set
changed every time.** Six runs of identical code gave 18, 12, 6, 15, 1 and 7
failures, with the suite taking anywhere from 55 seconds to 5.5 minutes.

Every failure was the same shape: a 30-second `page.goto` timeout in a
`beforeEach`, loading `test/reforged/harness.html`. No assertion ever failed.
Running any affected spec ALONE passed it.

**The cause was Font Awesome, fetched from cdnjs on every page load** — twice:

| where | why |
|---|---|
| the harness `<link>` | the document `@font-face`, which is what DRAWS a glyph |
| `SherpaElement.sharedStyles` | the `.fa-*::before` CLASS RULES, adopted into every shadow root — a document `<link>` does not reach one |

That is 103KB plus webfont files, per page, times 553 tests, across eight
browser contexts that each have their own cache. Repointing only the `<link>`
fixes half of it; the `sharedStyles` fetch is the one that is easy to miss.

Both now point at `/node_modules/@fortawesome/fontawesome-free/css/all.min.css`
— the **same 6.5.2 release, verified byte-for-byte against the CDN's** (103,009
bytes, `diff` clean). So the tests see identical CSS with no network at all, and
run offline.

Result: **~27 seconds, 559/559, six runs out of seven.**

**`src/index.ts` still points at the CDN, deliberately.** That is correct for a
real app — a consumer has no `node_modules` to serve from. Only the harness has
a local copy and 553 page loads, so only the harness rewrites the URL.

The `<link>` must stay a `<link>` rather than an `installIcons()` call: that
function appends the element and returns at once, so the module would race the
stylesheet and `document.fonts.load()` would resolve against a face the parser
had not yet registered.

`playwright.config.ts` also carries `retries: 1` **everywhere, not only in CI**.
It is a NET for the seventh run, not the fix — the fix is above, and went in
first. It is deliberately 1 and not 3: a test that needs three goes is telling
you something, and this must not become the place that muffles it.

Related: `T-fa-pro-icons-fail-silently` is why the harness needs the REAL font
rather than a stub — a Pro glyph is absent from the free webfont and renders as
nothing, with no warning anywhere.

- Site: `test/reforged/harness.html`
- Site: `playwright.config.ts`

### T-icon-box-is-not-the-glyph

**An icon's BOX and its DRAWING are two sizes, not one.** A Figma icon is a
`content/size/*` square holding art that differs per icon: `filter` (17:4701) is
10.5 x 9.625 inside its 14 frame, `triangle-down` is 7 x 4.375, and only 20 of
the 214 fill all 14. The square is the layout contract and never moves; the art
inside it varies.

Will's rule: **the drawing's LONGEST axis is 100% of the square**, it keeps its
1:1 aspect, and it never paints outside. `.sherpa-icon-box` in
`src/core/sherpa-icon.css` owns the square (`--_icon-size`, `flex-shrink: 0`,
inherited colour); the fit is an SVG `viewBox` set to the art's own INK bbox
plus `preserveAspectRatio="xMidYMid meet"`.

**Three approaches failed before that one, each measured:**

`font-size` cannot do it. Font Awesome at `font-size == box` paints about
**101%** of the box — `fa-house` overflowed a 14px box at 15.75px wide — and
each glyph needs a DIFFERENT size to reach 100%: filter 14.00px, house 12.28px,
caret-down 21.88px. A flat ratio is wrong for every icon but one.

`minmax()` cannot do it. It is a Grid track function; `CSS.supports('width',
'minmax(0, 100%)')` is **false**. It is not valid in `width` or `font-size`.

`getBBox()` on SVG `<text>` cannot do it. It returns the font's line metrics,
not the glyph's ink, so fitting to it gave 59–100% while looking correct in a
screenshot. The ink has to be measured off the path.

It is invisible in the numbers a reviewer checks. Chip height, icon width and
icon height were all exactly right; only the art inside was wrong.

**The icons are Figma's**, exported to `src/icons/` and compiled by
`scripts/generate-icons.mjs` (`npm run icons`) into `src/core/icon-paths.ts`
with each ink bbox. Font Awesome NAMES still resolve, through `ICON_ALIASES`,
to the Figma drawing that means the same thing — `house` is Figma's `home`,
`xmark` its `cross` — so 88 call sites did not have to be rewritten.

**A drawing cannot be chosen by a CSS `content:` the way a webfont glyph was.**
Toast, callout and the quick-filter caret picked their icon in CSS off
`[data-status]`. All members are now stamped and CSS reveals ONE, so the choice
stays CSS-owned and no JS branches on the status.

**A component that rewrites `className` erases the class.** `sherpa-input-text`
rebuilds its icon's whole class list in `#syncIcon`, so the shared box class has
to be restated in that string; the template alone is not enough. It failed as a
16px icon in a 14px box, with the CSS looking correct.

**An unknown name draws NOTHING, deliberately** — an empty wrapper is visible to
a test, where `T-fa-pro-icons-fail-silently` was not. That is why the tests
measure the PATH: the wrapper is its full size either way.

- Site: `src/core/sherpa-icon.css`
- Site: `src/core/render-icon.ts`
- Site: `src/core/render-icon.ts`
- Site: `src/core/sherpa-icon.css`
- Site: `src/components/sherpa-input-text/sherpa-input-text.ts`
- Site: `test/e2e/reforged-icon-sizes.spec.ts`

### T-icon-value-takes-two-forms

An icon attribute's value has always been allowed to be EITHER a Font Awesome
class list (`"fa-solid fa-tag"`) or a single raw glyph character (`"+"`), so
`as: 'icon'` on a declared prop accepts both.

Without it an FA class list is printed as LITERAL TEXT — which is exactly what
chip, tag, list-item and container-header used to do. The failure is silent:
the words "fa-solid fa-tag" appear where the glyph should be.

FA draws from a `::before` on a class, so an FA value has to become CLASSES
while a raw character becomes TEXT. `writeIcon` is the one policy; there were
three.

- Site: `src/core/sherpa-element.ts`

### T-the-base-class-names-nothing-visual

**A name on `SherpaElement` is read by all 58 components, so it must not imply
one of them.**

`renderRows()` and `cloneRow()` were the counter-example. Twelve components
stamp items from a prototype:

| | what it stamps |
|---|---|
| `sherpa-barchart` | bars |
| `sherpa-tabs` | tabs |
| `sherpa-breadcrumbs` | crumbs |
| `sherpa-chart-legend` | swatches |
| `sherpa-progress-step-tracker` | steps |
| `sherpa-file-upload` | files |
| `sherpa-notifications` | notifications |
| `sherpa-pagination` | page options |
| `sherpa-data-grid` | **rows** |
| `sherpa-list` &middot; `sherpa-key-value-list` &middot; `sherpa-transfer-list` | list entries |

One of the twelve has rows. The other eleven had to read past a name that
described a table.

So the base class says `renderItems`, `cloneItem`, `ItemTemplate` — and its
internals say `#fillItem`, `ITEM_TEXT`, `ITEM_ATTR`. **An ITEM is whatever the
component repeats.** The method's own signature already used that word
(`items`, `item`, `index`); only the name disagreed.

**What did NOT need changing, and why that matters:**

- the template **ATTRIBUTES** (`data-text`, `data-icon`, `data-attr-*`,
  `data-when-*`) were already presentation-free
- `populate(data: unknown)` was already shape-agnostic
- `DataSource`'s `rows`, `setSort`, `setPage` are **query** words, not UI words.
  A `Row` there is a RECORD — a chart has rows of data and draws none

So the leak was narrow: the base class's own vocabulary, and nothing else. A
component naming its OWN parts is fine and stays — `sherpa-chart-legend` has
real rollup rows, and `T-rollup-row-has-its-own-prototype` keeps its name.

- Site: `src/core/sherpa-element.ts`

### T-item-template-cannot-compute

`renderItems()` fills a cloned prototype from the item's own fields, driven by
attributes in the template rather than a `fill` callback:

| attribute | effect |
|---|---|
| `data-text="label"` | `textContent` ← `item.label` |
| `data-icon="glyph"` | `writeIcon()` ← `item.glyph` (FA class list or one glyph) |
| `data-attr-value="id"` | `setAttribute('value', item.id)` |
| `data-when-current="on"` | the bare attribute `data-current` exists if `item.on` is truthy |
| `data-index="data-index"` | `setAttribute('data-index', String(loop position))` |

A field may carry `??` fallbacks — `data-text="header??field"` is the aliasing
six stamp sites hand-wrote.

IT DELIBERATELY CANNOT COMPUTE: no maths, no formatting, no reading component
state. A derived row keeps its `fill` callback, because a template that could
compute would be an expression language.

- Site: `src/core/sherpa-element.ts`

### T-variant-attrs-or-one-way-door

`static variantAttrs` names the attributes `templateId` reads, so changing one
RE-STAMPS the tree. A multi-template component MUST list them.

The base class cannot work them out: `templateId` is an INSTANCE getter, and
`observedAttributes` is read off the CONSTRUCTOR before any instance exists.

Left empty it is a silent ONE-WAY DOOR — the variant is whatever the element
was BORN with. That is what `data-multiline` did on `sherpa-input-text`: the
textarea template existed and was unreachable after first render.

- Site: `src/core/sherpa-element.ts`

### T-template-id-read-once-was-permanent

`#stampedTemplate` records the template id currently STAMPED, so a later
attribute change can tell whether the component now wants a different tree.

`templateId` used to be read ONCE, at first render, so a component kept its
FIRST tree for life. It LOOKED right on `sherpa-button` — a declared prop
writes the icon either way — while the label, badge and menu slots the icon
variant does not have simply stayed.

This is also why `#resolveTemplate` returns the id ALONGSIDE the body, and why
the fallback path returns the FIRST template's REAL id rather than null: a
variant component that fell back would otherwise look like it had no template
and never re-stamp.

- Site: `src/core/sherpa-element.ts`

### T-restamp-runs-after-on-change

In `attributeChangedCallback` the variant re-stamp runs **LAST, after
`onChange`**.

The component has just reacted to the attribute against the tree it STILL HAS.
If that attribute also changes WHICH tree it wants, re-stamping now lets the
component's setup run again on the new one — re-stamping first would have run
`onChange` against a tree that was about to be thrown away, and its cached refs
would be dead nodes.

`#restampIfVariantChanged` is cheap on the common path: `templateId` returns
null for the 53 single-template components, and the ids match for a variant
component whose variant did not change, so it is one getter call and a string
compare. The map is parsed at FIRST RENDER and cached per URL, so a re-stamp
costs no fetch and no re-parse.

A declared prop re-syncs itself first, and `onChange` still fires afterwards, so
a component can do extra work for the same attribute (sync an `aria-*` value,
re-measure) without also having to write the text. A prop that FALLS BACK to the
changed attribute re-syncs too — `data-label` falling back to `data-heading`
has to re-sync when `data-heading` is what changed.

- Site: `src/core/sherpa-element.ts`

### T-shared-sheets-settle-independently

`#adoptStyles` **yields a microtask first**, so top-level module init —
`index.ts` setting `SherpaElement.sharedStyles` — has run before the list is
read. An element PRESENT IN THE INITIAL HTML can upgrade before that assignment
executes, and would then adopt an empty shared list: no base sheet, no Font
Awesome.

The sheets are then loaded with `Promise.allSettled`, not `Promise.all`. A
failed or slow SHARED sheet — a cross-origin CDN like Font Awesome — must NOT
drop the others. Each settles independently and whatever loaded is kept, so a
CDN outage costs the icons and nothing else.

Styles are awaited BEFORE any DOM is written, which is what prevents a flash of
unstyled content; the HTML fetch runs in parallel with them.

- Site: `src/core/sherpa-element.ts`

### T-populate-settles-after-render-data

`populate()` returns a promise that settles once `renderData()` HAS RUN.

`rendered` only says the shadow TREE exists; `populate()` chains onto it, so
awaiting `rendered` can resolve BEFORE the data is in the DOM. A caller that
reads back what it just populated must await `populate()`, not `rendered`.
Fire-and-forget callers can keep ignoring it.

That is why `renderData` MAY RETURN A PROMISE. Most components render
synchronously and return nothing. A COMPOSING one does not: an app header's
data lands in slotted children, so its own `renderData` finishing says nothing
about whether the chips exist. Returning the children's promises is what keeps
`populate()`'s contract true — it settles when the data is in the DOM — for a
component whose DOM is somebody else's.

- Site: `src/core/sherpa-element.ts`
- Site: `src/components/sherpa-app-header/sherpa-app-header.ts`

### T-set-removes-on-falsy

`this.set(attr, value)` is the declared JS→CSS write path — the counterpart of
`this.dataset['len'] = String(count)`, which `sherpa-sparkline` does by hand to
tell its CSS how many points it drew.

`null`, `undefined` and `false` REMOVE the attribute, so `:host([data-x])`
stops matching. `true` sets it EMPTY — a bare boolean attribute. Writing
`"false"` or `"null"` instead would leave the selector matching forever, which
is the whole failure this rule prevents.

- Site: `src/core/sherpa-element.ts`

### T-empty-write-lets-css-collapse

Writing a declared `content` prop treats ABSENT, EMPTY and A MISSING TARGET as
the same thing: write `''`.

That is what lets the component's own `:empty` / `data-has-*` CSS collapse the
node. **The base class never hides anything itself** — CSS owns visibility, so
there is no `display: none` and no `.hidden` toggle anywhere in here.

A `number` prop whose parse fails resolves to `NaN`, and `'NaN'` is written as
`''` for the same reason: an empty node collapses, the literal string "NaN"
does not.

- Site: `src/core/sherpa-element.ts`

### T-composed-path-not-target

`pathFind` returns the first element on a COMPOSED event's path that matches —
the reliable way to ask "what was actually clicked".

`event.target` RETARGETS at a shadow boundary: a click inside a child arrives
at the HOST, so `target.closest('.row')` misses the row it came from.
`composedPath()` is the un-retargeted list.

It was written out **26 times across 9 components**, in three spellings that
had drifted — `tagName ===` in one handler, `localName ===` in another. Both
work; having two is how a third appears.

A component whose rows are in its OWN tree keeps `target.closest()` — nothing
crossed a boundary. `sherpa-data-grid` does that in 11 places.

Matching a TAG rather than an inner class also matters — see
`T-path-not-target-finds-chip-host`.

- Site: `src/core/sherpa-element.ts`
- Site: `src/components/sherpa-nav-item/sherpa-nav-item.ts`
- Site: `src/components/sherpa-pagination/sherpa-pagination.ts`

### T-slot-guards-only-when-filled

`skipWhen` names a selector INSIDE a declared prop's target, guarding content
the component owns — a `<mark>` a search highlight left, or a projected
`[slot]` attribute — that a `textContent` write would erase.

Two cases, and the difference matters: a PLAIN element guards by merely
existing, but a `<slot>` guards only when a consumer has actually FILLED it. A
`<slot>` in the template is the NORMAL state, not an override — treating its
presence as a guard would stop the attribute working at all. Hence
`assignedNodes()` is checked rather than the tag alone.

The same distinction governs `#reflectSlot`: `assignedNodes()` WITHOUT
`flatten` returns only what the light DOM actually assigned, never the slot's
own fallback content, which `flatten: true` would count as "present" and
collapse by the slot's own `data-has-*` rule.

- Site: `src/core/sherpa-element.ts`
- Site: `src/components/sherpa-toast/sherpa-toast.ts`

### T-clone-returns-null-never-asserts

`clone()` is the one way to stamp a repeating row, and it returns `null` when
the template is missing or empty.

Three null policies were in use — an early return, a `!` on the LOOKUP (which
throws the moment a template is renamed), and an unguarded optional chain — and
every one of them then asserted `content.firstElementChild!` regardless.

THAT ASSERTION IS THE REAL HAZARD: a template whose first node is a comment or
whitespace-only text yields `null!`, and the crash lands at the next property
access, far from the cause.

`content` is also missing on a NON-`<template>` element, so a selector that
matched the wrong node fails here rather than throwing somewhere downstream. A
caller that cannot proceed without the row should return early; there is
nothing to assert.

- Site: `src/core/sherpa-element.ts`

### T-render-list-keeps-fill-in-the-caller

`renderList` does the four steps every data-driven list repeats: clear the
container, clone the prototype per item, fill, append. What each row then
BECOMES is the caller's business and stays in `fill` — a roving tabindex, an
`aria-current`, a per-column type. Only the plumbing is shared.

The template is looked up ONCE and reused for the whole run, so a long list
costs one shadow query rather than one per row.

`clear: 'own-children'` removes only nodes matching `ownSel` instead of
emptying the container. `sherpa-list` needs it: its rows sit beside a `<slot>`,
and `replaceChildren()` would take the slot with them. `renderItems` takes the
same option for the same reason.

The index passed to `fill` is the LOOP position. A component stamping a
DIFFERENT index — `sherpa-barchart` writes each datum's original position while
iterating a filtered list — writes it inside `fill` from its own data.

- Site: `src/core/sherpa-element.ts`

### T-row-fragment-cloned-whole

`renderItems` clones the whole `<template>` FRAGMENT, not its
`firstElementChild`: a semantic pair like `<dt>` + `<dd>` is two SIBLING roots,
and stamping only the first would silently drop the value half of every row.

`after` then gets the FIRST root — the row element for a single-root prototype,
which is every case that needs it. It is the escape hatch for the ONE derived
value a declarative template cannot compute (`T-item-template-cannot-compute`);
reach for it before abandoning the row to a hand-written `fill`.

`#fillRow` sweeps the row ROOT as well as its descendants, because the root can
carry the attributes too, and it snapshots `[...el.attributes]` — the loop
removes each directive as it consumes it, and a live `NamedNodeMap` would skip
entries when one is taken out mid-iteration.

- Site: `src/core/sherpa-element.ts`

### T-menu-rows-stay-native-controls

`sherpa-menu`'s rows stay REAL FORM CONTROLS, slotted from the light DOM, so
keyboard and screen-reader behaviour come free:

| kind | markup |
|---|---|
| values | `<label><input type="checkbox\|radio" value="…" /> Label</label>` |
| actions | `<button type="button" value="…">Label</button>` |

Because they are LIGHT DOM the menu listens on its HOST and lets the events
bubble up. That is also why a native `change` — which is NOT composed — stops
at this element and never reaches the toolbar that stamped the rows: see
`T-native-change-stops-at-the-host`.

- Site: `src/components/sherpa-menu/sherpa-menu.ts`

### T-footer-row-raises-on-any-flag

`data-commit` shows the Cancel/Apply pair and DEFERS every change until Apply.
Without it, every row tick commits immediately.

It does **NOT** alone decide whether the footer ROW appears. Today, Clear and
Remove share that row and each raises it on its own flag, so an auto-applying
calendar menu still has a footer holding Today and Remove.

Reading `data-commit` as "has a footer" would hide Today and Remove from every
menu that applies as it goes — which is every calendar menu by default.

- Site: `src/components/sherpa-menu/sherpa-menu.ts`

### T-menu-composes-real-components

`sherpa-menu` COMPOSES real components rather than drawing their parts, and
imports each one itself because it cannot rely on the page having done so:

| part | component | why |
|---|---|---|
| drill trail | `sherpa-breadcrumbs` | `sherpa-app-header` does the same; a second hand-rolled trail would drift from it |
| search field | `sherpa-input-text` | the Menu node instances the composed Input Field (atom), not a hand-rolled `<input>` |
| Apply / Cancel | `sherpa-button` | real buttons, so the menu must register them |
| the footer | `sherpa-container-footer` | it IS Figma's Container Footer instance, not an action row of the menu's own |

The search is listened to on the COMPONENT, never by reaching into its shadow
root for the raw `<input>`: `sherpa-input-text` re-dispatches the inner
control's `input`.

- Site: `src/components/sherpa-menu/sherpa-menu.ts`

### T-cancel-baseline-captured-on-open

`#baseline` holds the values the menu OPENED with, for Cancel to restore.

Captured on OPEN rather than on first change: a user who ticks, unticks and
then cancels must land back where they started, not at the state after the
first edit.

`#onApply` rewrites it, so the draft becomes the committed state and a later
Cancel cannot undo it. `#onCancel` restores it and THEN reports — a listener
reading `values` in the handler must see the RESTORED set, not the discarded
one.

- Site: `src/components/sherpa-menu/sherpa-menu.ts`

### T-menu-search-is-a-substring-find

A menu's search narrows the rows to those whose text CONTAINS what was typed —
SUBSTRING, case-insensitively, on the row's own text. A menu search is a
"find", so typing "ows" should still reach "Windows"; matching from the START
would make a long label unreachable by its distinctive part.

It filters the rows it ALREADY HAS: no re-query, and a row hidden by a search
KEEPS whatever is ticked on it and comes back with it. That is what makes
searching safe inside a committing menu — you can narrow, tick, clear the
search, tick again, and Apply once.

`data-no-matches` is set ONLY WHILE SEARCHING: an empty menu with no query is
empty because the caller passed no rows, which is a different thing from
"nothing found".

JS writes the flag; CSS owns the hiding.

- Site: `src/components/sherpa-menu/sherpa-menu.ts`

### T-show-then-measure

`show()` points the select-all row at the set BEFORE the card is painted, then
shows the popover, THEN measures.

A CLOSED popover is `display: none`, so its own size reads as **0** and a
pre-show measurement cannot flip correctly — the card would always think it had
room below.

The select-all sync has to happen on open for a different reason: the rows are
slotted light DOM that a host stamps, so there is no render pass of ours to
hang it on. Opening is the moment the set is known, and without it a menu opens
with its box blank rather than reading all / some / none.

- Site: `src/components/sherpa-menu/sherpa-menu.ts`

### T-menu-value-is-not-always-rows

A menu's `values` is usually its CHECKED ROWS — but a menu whose body is not a
list of rows still has a value, and two shapes report for themselves.

**NUMBER.** No rows at all: its content is one field, or a two-ended slider
when its Range switch is on. A range spanning the WHOLE of its bounds excludes
nothing, so it reports NO value — otherwise a filter that is not filtering
would read as active.

**CALENDAR.** A calendar holds its pick in its own ATTRIBUTES, not in checked
inputs — so a date menu reported NO values, and every chip fed by one read as
"on but filtering nothing": the amber warning state, on a filter that was
working. A RANGE reports both ends and only once BOTH are picked; half a span
is not a span, and reporting one end would read as a single-day filter.

Both report strings, like every row value, so a consumer reads ONE array
whatever the menu is.

- Site: `src/components/sherpa-menu/sherpa-menu.ts`

### T-select-all-is-not-a-value

The SELECT-ALL row is excluded from `#inputs()`. It is a control OVER the set,
not a member of it: counted in, `values` would carry a phantom `"qf-all"`
entry, Apply would commit it as a picked value, and the count badge would be
ONE TOO HIGH with everything ticked.

`NON_VALUE_ROWS` is the shared selector for what is excluded and why.

Its LABEL never moves either: the row used to say "Clear all" once everything
was on, which made it both the select-all control AND the menu's clear — a
second place to do what the footer's Clear button does, and one that moved
under the reader depending on what was ticked. `ALL_LABEL` is "Select all",
always.

- Site: `src/components/sherpa-menu/sherpa-menu.ts`
- Site: `src/components/sherpa-quick-filter-toolbar/sherpa-quick-filter-toolbar.ts`

### T-drill-crumbs-carry-no-href

The drill trail is a real `<sherpa-breadcrumbs>`, which draws the separator and
the current-crumb treatment itself, so there is nothing to compose beyond the
data: two crumbs, where it came from then where it is. A second hand-rolled
trail would drift from the component, as `sherpa-app-header` already found.

**NO `href` on either crumb.** The trail here navigates nothing — it goes back
a level inside a menu that must STAY OPEN — and an `<a href="#">` both appended
a hash to the URL and DISMISSED the popover on the way out.
`sherpa-breadcrumbs` fires `breadcrumb-select` for an href-less crumb just the
same, which is the whole signal needed.

The PARENT crumb is the same way out as the back arrow, so a select on it is
handled by `#onBack`; only the first crumb is a link, because the last is where
you are.

- Site: `src/components/sherpa-menu/sherpa-menu.ts`

### T-calendar-header-has-no-heading

The heading TEXT is a declared prop, but `data-heading` stays OBSERVED because
it also names the card for a screen reader and names the radio group below it.

A CALENDAR shows NO heading — its header holds the month stepper and nothing
else (Figma 1156:29240: the two variants' headers are exclusive). The name
still has to reach a screen reader, so it moves to the card's own `aria-label`
rather than being silently dropped with the text.

Single-select menus are radio rows and get a SHARED NAME
(`sherpa-menu-<heading>`), so the browser enforces "one at a time" for us
rather than JS unticking siblings.

- Site: `src/components/sherpa-menu/sherpa-menu.ts`
- Site: `src/components/sherpa-quick-filter-toolbar/sherpa-quick-filter-toolbar.ts`

### T-bounds-clamp-to-the-viewport

A menu card is clamped inside the VIEWPORT by default, or inside a host's
`data-bounds` — a CSS selector for the region the menu belongs to, such as an
app's content area. A menu that hangs over the nav or out of a panel reads as
belonging to neither, and the window's edges say nothing about where the
content actually stops.

VIEWPORT COORDINATES THROUGHOUT, because the card is `position: fixed` in the
top layer. `getBoundingClientRect()` gives exactly that and works across shadow
boundaries where a CSS anchor name does not (`T-anchor-cross-root`).

The selector resolves from the DOCUMENT, so it can name a box in the app's own
tree. One that matches nothing — or a zero-sized box — falls back to the
viewport rather than trapping the card in nothing.

And the box is never WIDER than the viewport: a container that scrolls out of
view would otherwise let the card follow it off the screen.

- Site: `src/components/sherpa-menu/sherpa-menu.ts`

### T-card-max-height-follows-the-side

`#place()` caps the card to the room it actually has ON THE SIDE IT LANDED ON,
writing `--_max-h`, and lets `.rows` scroll inside that.

Without it a long list — a Sort menu offers TWO ROWS PER COLUMN — ran off the
bottom of the screen and took the Apply/Cancel footer with it. The CSS cap was
a flat `60vh`, which knows nothing about where the trigger sits. It flips to
the roomier side when neither fits comfortably, with a floor of 120px.

It must also never run off the TOP: the vertical flip can put a tall card above
the trigger and past the start edge, which is where a DRILLED CALENDAR landed —
taller than the list it replaced, with the same y it was placed at.

- Site: `src/components/sherpa-menu/sherpa-menu.ts`

### T-open-menu-resize-closes

While a menu is OPEN it follows its trigger on SCROLL — `capture`, because
scrolls in an ancestor do not bubble — but a RESIZE **closes** it.

A repositioned card is fine when only the trigger moved. A resize can rebuild
what is UNDERNEATH it: a toolbar folds chips away, a grid re-columns, a
container query swaps a layout. The card would then be pointing at something
that is no longer there, or holding rows that have been moved out from under it
(`T-drill-moves-not-clones`). Closing is honest and puts everything back where
it belongs.

THE CARD'S OWN SIZE can change while it is open, and then the placement it was
given no longer fits. A date menu's Range switch turns one month into two —
**274px becomes 485** — and the card kept its left edge and ran straight off
the screen. A number menu's Range switch does the same in miniature.

So a `ResizeObserver` watches THE CARD rather than re-placing from each control
that might grow it: the menu cannot know what a host slotted into it, and every
future body that changes size gets this for free.

The Cancel baseline is snapshotted here too —
`T-cancel-baseline-captured-on-open`.

- Site: `src/components/sherpa-menu/sherpa-menu.ts`

### T-select-all-ticks-boxes-not-values

Select-all is handled IN THE MENU rather than in the toolbar that stamps the
row, because a native `change` is NOT COMPOSED: it stops at this element, which
is the shadow host the rows are slotted into, and never reaches the toolbar.
See `T-native-change-stops-at-the-host`.

It writes the OTHER ROWS' `checked` state and lets the ordinary change path
carry it, rather than setting `values` directly: a COMMITTING menu holds a
DRAFT, and writing the set here would commit a selection the user has not
applied. Ticking the boxes is what the user would have done by hand, so the
draft, the count and Cancel all behave as they always did.

Unticking it EMPTIES the set, the way any checkbox unticks what it turned on —
but the row never RELABELS itself to "Clear all", because emptying the menu is
the footer's Clear button and one action belongs in one place
(`T-select-all-is-not-a-value`).

- Site: `src/components/sherpa-menu/sherpa-menu.ts`

### T-indeterminate-is-a-property

`#syncSelectAll` points the select-all row at the set it describes: TICKED for
all, INDETERMINATE for some, EMPTY for none.

`indeterminate` is a **PROPERTY, not an attribute**. There is no
`indeterminate=""` in HTML, so it has to be written on the element EVERY TIME
the set moves — a declared `data-*` cannot express it and CSS cannot set it.

That is also why the box can never be trusted to report the set: see
`T-indeterminate-reports-false`.

- Site: `src/components/sherpa-menu/sherpa-menu.ts`

### T-rows-changed-re-places-next-frame

The slotted ROWS can be replaced wholesale — the overflow menu drills in by
swapping its list for another filter's (`T-drill-moves-not-clones`) — so the
select-all row's state has to follow them. `slotchange` fires exactly when they
move in or out, which `show()` alone does not cover: a drill happens AFTER it.

It also RE-PLACES the card. A drill swaps a 240px list for content of its own
size — a calendar is half as wide again — and the card was positioned while it
was still the list. Left alone it kept the old x and ran off the side of the
screen. Measured on the NEXT FRAME, so the new rows have been laid out.

- Site: `src/components/sherpa-menu/sherpa-menu.ts`

### T-menu-back-is-a-report

The back arrow REPORTS; it does not act. The menu does not know what it drilled
INTO, only that it did: the rows came from somewhere else and only that
somewhere can take them home (`T-drill-moves-not-clones`).

`menu-back` is COMPOSED, which the button's own `click` is not — the click
starts inside this shadow root and would never reach the component that filled
the menu. The handler stops propagation for the same reason.

- Site: `src/components/sherpa-menu/sherpa-menu.ts`

### T-native-change-stops-at-the-host

A native `change` is **NOT COMPOSED**: it stops at `sherpa-menu`, the shadow
host its rows are slotted into, and never reaches the toolbar that stamped
them. So the menu re-emits it as `menu-change`, and every value shape has to be
recognised HERE.

A menu's content is not always a list of boxes. A NUMBER filter slots a plain
`<input type="number">` and a `sherpa-slider`, and their native change is not
composed either. Without recognising them, typing a value moved NOTHING
downstream at all.

The same non-composed `change` is why select-all is handled in the menu
(`T-select-all-ticks-boxes-not-values`), and why `sherpa-switch` re-dispatches
its own as composed (`T-range-switch-swaps-not-rebuilds`).

- Site: `src/components/sherpa-menu/sherpa-menu.ts`
- Site: `src/components/sherpa-quick-filter-toolbar/sherpa-quick-filter-toolbar.ts`

### T-clear-empties-both-body-shapes

Clear empties BOTH kinds of content a menu can hold: the value rows'
checkboxes, AND a slotted calendar's `data-value` / `data-value-start` /
`data-value-end` attributes. Clearing only the inputs left a date menu still
holding its pick (`T-menu-value-is-not-always-rows`).

A COMMITTING menu stays OPEN — clearing is a change to the DRAFT, not a
decision, so the reader can pick again or Cancel out of it. Without
`data-commit` there is no draft, so it reports the emptied state at once, the
same way a tick does.

- Site: `src/components/sherpa-menu/sherpa-menu.ts`

### T-today-and-remove-are-menu-chrome

Today and Remove are the menu's FOOTER form of actions that are otherwise
rows.

**Today.** The BUTTON is the menu's — Figma puts Today in the Calendar footer's
`left` slot — while the BEHAVIOUR is the calendar's, so it calls the calendar's
public `today()` rather than reaching into it. It stays OPEN, like a day click:
Today PICKS a date, it does not commit one. Apply still does that.

**Remove.** It emits exactly what a `<button value="remove">` row emits
(`menu-select` with `{ value: 'remove', label: 'Remove' }`), so a host listens
for ONE event whichever shape its menu is. A calendar menu has no rows, and
this is how it still offers the action.

- Site: `src/components/sherpa-menu/sherpa-menu.ts`

### T-chip-menu-is-a-boolean-state

`sherpa-quick-filter` is a filter chip you can toggle, with an optional value
menu. Clicking the chip BODY flips it on or off and fires `quick-filter-click`.

`data-menu` is Figma's `State` axis on "Filter Chip (atom)" (**154:3904**):
absent = simple, present = the chip and a caret SNAPPED into one 24-tall unit.
It is a **BOOLEAN, not an enum**, because the second value is the only
difference.

The caret opens a slotted `<sherpa-menu>` — checkboxes for multi-select, radios
for single. A native popover measuring its own placement off the caret
(`T-anchor-cross-root`, `T-menu-anchors-to-the-chip`).

CSS owns the look; JS writes the label, count and icon and relays the picks.

- Site: `src/components/sherpa-quick-filter/sherpa-quick-filter.ts`

### T-icon-only-is-purely-css

Three of the chip's boolean attributes are PURE PRESENTATION — the shadow DOM
is unchanged, so a chip can flip either way at runtime.

**`data-plain`** — an icon-only chip with NO CHROME while resting: no face, no
ring, just the glyph. It is a real property on the CARET, never a re-point of
`--sherpa-style-surface-base` (`T-scope-does-not-stop-inheritance`). A chip
that is ON keeps its full accent face.

**`data-icon-only`** — the chip reduced to its menu button: body, count,
indicator and value label all hidden, the caret squared off and its glyph
swapped for a funnel. For a filter affordance whose FIELD is named by something
else — the data grid's column header is the case it exists for.

**`data-persistent`** — a SELECTOR, not a toggle: always on, never empty. Set
by the toolbar (`T-persistent-chip-is-a-selector`).

`data-locked` is the fourth and is NOT presentation: a locked chip's count
badge counts FOLDED FILTERS rather than picked values, it still opens its menu
and reports what happened inside it, and it is styled by whatever
`data-current` the host chose — it simply never sets that itself
(`T-locked-chip-relays-and-nothing-else`).

- Site: `src/components/sherpa-quick-filter/sherpa-quick-filter.ts`

### T-chip-empty-check-waits-for-onconnect

The empty check reads the SLOTTED menu, which is a LIGHT-DOM child — so it has
to wait for `onConnect`. At `onRender` time a chip written as markup may not
have had its children parsed yet, and an empty read there would flag a chip
that does in fact hold values.

A chip can also arrive with values ALREADY TICKED — from markup, or the
toolbar's own `options: [{ selected: true }]` — and **no menu event ever fires
for those**. Without replaying them at connect the caret label stayed blank
until the user opened the menu.

- Site: `src/components/sherpa-quick-filter/sherpa-quick-filter.ts`

### T-value-label-is-the-callers-words

`valueLabel` is the text shown in the CARET button — the chip's PICKED VALUE.

Public because the value is not always the chip's own to derive: a DATE chip's
pick is an ISO string that has to be formatted to the reader's locale, and the
TOOLBAR owns that formatting (`T-date-label-reads-in-full`). The chip owns the
ELEMENT; the caller owns the WORDS.

Empty collapses the button back to a bare caret (`.caret-label:empty` in CSS),
so there is no separate "hide the label" flag.

- Site: `src/components/sherpa-quick-filter/sherpa-quick-filter.ts`

### T-chip-values-round-trip-silently

`values` is the chip's picked values — the same list `quick-filter-change`
reports — and it is READ/WRITE.

**PARITY:** what a reader picks in the menu, a caller must be able to set. A
saved view, a deep link and an agent all need this door, and before it existed
a view could narrow the DATA while the chip sat blank — the bar then lies about
what is being shown.

The chip does NOT store its state: label, badge, tooltip and on/off all derive
from the menu's ticked rows. So ticking from outside is HALF THE JOB — the first
version left the chip reading "Region", lit but silent. Every sync a click runs,
the setter runs too, through the same `#applySelection`: the same five writes in
the same order, so a click and a call cannot drift.

It READS BACK rather than trusting the ask — a value naming no row never landed,
and is ignored. The "All" row is skipped, because it is a control that derives
from the rest (`T-select-all-is-not-a-value`).

**SILENT.** A click reports an INTENT; this is the ANSWER to one. Echoing would
make a host routing it into its query filter twice.

- Site: `src/components/sherpa-quick-filter/sherpa-quick-filter.ts`

### T-one-pick-reads-field-and-value

A VALUE chip that is ON with no values filters nothing out, so CSS paints it
WARNING off `data-empty` (`T-empty-flag-needs-rows-to-count`). A plain TOGGLE
chip never gets it — on/off is its whole meaning.

At EXACTLY ONE pick the chip reads "Field: Value": it fits, and it says what
the chip filters TO. Two or more revert to the bare field name with the count
badge carrying the number, so **the badge only ever reads 2 or higher**. At one
pick the label already names the value, so a "1" beside it is pure noise — and
on a single-select chip the badge could never read anything else.

The field name is remembered in `#field` before a single pick rewrites the
visible label. Without it, going from one pick to two — or back to none — would
have nothing to restore, because the field name would already have been
overwritten in `data-label`.

- Site: `src/components/sherpa-quick-filter/sherpa-quick-filter.ts`

### T-icon-writes-to-both-slots

`data-icon-start` is written into **BOTH** icon slots: `.icon` leads the chip
BODY, and `.caret-icon` sits in the CARET for a `data-icon-only` chip, whose
body is hidden. CSS picks which is visible.

It cannot be the hardcoded funnel: a SORT control needs three different glyphs,
so it writes `data-icon-start` like anything else.

It goes through the base class's `writeIcon`, not a fourth copy of the same
if/else. That also STRIPS previously-applied `fa-*` classes, which the
hand-rolled version did not — so a chip whose glyph changes cannot end up
wearing two (`T-icon-value-takes-two-forms`).

- Site: `src/components/sherpa-quick-filter/sherpa-quick-filter.ts`

### T-menu-anchors-to-the-chip

The chip's menu is anchored to the **CHIP**, not to the caret that was clicked.
The menu belongs to the whole chip, so its leading edge lines up with the
chip's; anchored to the caret it started at the little arrow on the far right
and the card hung off the end of what it belonged to.

The caret click also stops propagation — opening the menu must not toggle the
chip.

Placement itself is measured, not declared: `T-anchor-cross-root`.

- Site: `src/components/sherpa-quick-filter/sherpa-quick-filter.ts`

### T-locked-chip-relays-and-nothing-else

A LOCKED chip's menu is **not a list of ITS values** — the toolbar's More chip
stands for "these filters are folded in here", so its rows belong to other
chips. Nothing in there may re-point its label, its badge or its on/off state.

It still RELAYS `quick-filter-change`, because the toolbar is listening for
exactly that. And a body click still emits `quick-filter-click` without
flipping `data-current` — the state is the host's to set, so a host that wants
the click can act on it (opening the menu, say) without the chip having guessed
first.

This is the `data-locked` half of the state-ownership rule: `data-<thing>` in,
`<thing>-change` out, and `data-locked` when the host owns the value.

- Site: `src/components/sherpa-quick-filter/sherpa-quick-filter.ts`

### T-empty-flag-needs-rows-to-count

`data-empty` flags "on, but filtering by nothing" so CSS can paint the chip
WARNING. A VALUE chip only — a plain toggle has no values to hold.

It reads the menu's CHECKED ROWS, not the last event's detail: a chip can be
switched on from OUTSIDE with no menu event having fired.

Two kinds of chip are exempt, and the flag is the amber-paint bug in both:

- **PERSISTENT.** It is a selector, so "on with nothing picked" is a chip still
  WAITING FOR ITS ROWS. Painting it amber was the intermittent view-chip
  warning — the flag was read before the rows existed to count
  (`T-persistent-chip-is-a-selector`).
- **LOCKED.** It cannot be judged this way at all, because a locked chip's menu
  is not a list of its values: the More chip's rows stand for other filters, and
  a data grid's column-filter menu holds a condition and a typed value. Either
  way "no rows ticked" says nothing about whether the chip is filtering, and
  reading it as "on but empty" painted a WORKING filter in the amber warning
  state — the exact colour that means "this is doing nothing"
  (`T-locked-chip-relays-and-nothing-else`).

- Site: `src/components/sherpa-quick-filter/sherpa-quick-filter.ts`

### T-caret-carries-the-value-not-the-label

The chip keeps the FIELD name; the picked value reads in the CARET button.
Figma's `State=menu` gives the caret its own `label` property (150:3408).
Folded together as "Field: Value" the field name moved and RE-FLOWED THE WHOLE
BAR on every pick.

| picks | caret label |
|---|---|
| nothing | empty → the button collapses to a bare caret |
| one | that value |
| two or more | the FIRST value plus an ellipsis, with the count badge carrying the number |

The ellipsis says "more here" without guessing how many fit; the exact list is
on the badge's hover tip and in its `aria-label`. A count says HOW MANY but
never WHICH, which is why the tip exists at all — and the same list goes on the
badge's `aria-label`, because the tooltip carries it visually and that is the
route to AT.

The VISIBLE text of a menu row is used, never its raw value — a chip must read
"Region: EMEA", never "Region: emea" — falling back to the raw value when the
row carries no text of its own.

- Site: `src/components/sherpa-quick-filter/sherpa-quick-filter.ts`

### T-calendar-anchors-where-the-data-is

`data-available` is a SET of ISO days, not a span. `data-min`/`data-max`
describe a range, which is the wrong shape for "only these days have records":
a column of order dates is a scatter, and a span would leave every empty day
between them selectable. Absent means EVERY day is selectable, and
`data-available=""` (empty, not missing) genuinely means none are.

The set also decides which month an UNPICKED calendar OPENS ON. Opening on
today when today holds none of the available days shows a grid where every cell
is disabled — nothing to click, and no hint the days are elsewhere. A chip
driven by such a calendar could never take a value at all, so it sat in the
amber "on but filtering nothing" state looking broken.

So the anchor is the LATEST available day: the most recent data, and the end a
reader usually wants. Stepping back from there is one click; finding a
populated month two years away is not. ISO strings sort chronologically as
text, so `max` is a plain string compare.

- Site: `src/components/sherpa-calendar/sherpa-calendar.ts`

### T-slot-assigns-direct-children-only

`slot="header"` only assigns a **DIRECT CHILD of the slot's own host**. A node
one level deeper — inside the calendar, inside the menu — is never assigned,
which is exactly what happened: the projected month stepper existed, its
listeners worked, and it rendered NOWHERE.

So `#projectHeader` clones the light-DOM prototype into the PARENT element, not
into the calendar. The clone carries `slot="header"`, so a `sherpa-menu`
renders it in its own header region — the Figma Calendar node's first of three.
It is idempotent, because a re-render must not stack a second stepper.

That move splits the header across a shadow boundary, which is why `#headerEls`
returns a LIST rather than an element: a calendar has ONE header, but with
`data-embedded` it is a sibling in the parent rather than a descendant here, so
every listener and the label sync must reach either side. A list keeps both
cases on one code path instead of branching at each call.

- Site: `src/components/sherpa-calendar/sherpa-calendar.ts`

### T-picking-stops-the-grid-following

`onChange` re-anchors the view to whatever value arrives. That is RIGHT for a
host setting one — the day should be on screen — and WRONG for the user's own
click, where the day is already on screen and moving to it moves everything
else.

The shipped bug: picking a start date in a RANGE calendar's right-hand month
scrolled that month to the left, so the days they were about to click as the
end were suddenly somewhere else. Stepping is theirs to do.

`#picking` is the one-bit guard, set only around `#pickRange`. It is cleared in
a `finally`, so an early return or a listener that throws still clears it — a
stuck flag would leave the calendar ignoring its host for good.

- Site: `src/components/sherpa-calendar/sherpa-calendar.ts`

### T-two-months-share-one-grid

A RANGE calendar draws TWO months side by side — Figma's `Type=range`
(268:13874) is a 15-track grid: seven day columns, a divider, seven more. A
range is a span between two dates, and picking one whose ends fall in different
months through a single month that has to be stepped is the case the second
month exists for.

Both months go into **ONE grid**, not two, so every cell is a real `1fr` of the
same track set and the two halves cannot drift apart by a pixel.

Which means every cell must be PLACED explicitly. `#stampMonth` walks a `slot`
0..6 that wraps into the next ROW, and writes `gridColumn` (`column + slot`, 1
for the left month and 9 for the right, leaving track 8 as Figma's divider) and
`gridRow` on each. Left to auto-flow the two months STACKED: September's five
rows then October's five, **nine deep instead of five across**. A month with a
blank-led first week would also slide into its neighbour.

`data-two-up` is what CSS reads for the 15-track template, written on the GRID
and the caption row rather than the host — the month and year views share the
host and must be untouched by it. `Date` normalises December + 1 to January of
the next year on its own.

- Site: `src/components/sherpa-calendar/sherpa-calendar.ts`

### T-cell-state-is-the-only-paint

`data-state` is `sherpa-calendar-cell`'s own API, mirroring the node's `State`
axis, and **the only thing the cell paints from**. `data-today` and
`data-selected` alone set no state, and the cell drew plain — which is why the
current month and the current year looked like every other one in the month and
year grids.

Both sets are written: the flags stay alongside `data-state` because the
calendar's own CSS still reads them for those two grids.

Order is **TODAY first, SELECTED second** in all three grids, so a cell that is
both reads as selected.

The range half is THREE states where the node draws one: the two ENDS keep
their outer corners and square the ones that meet the band, so an end is
`range-start` or `range-end` and the band between is `range-mid`. A single-day
range is both ends at once, so it stays `selected` and fully rounded.

- Site: `src/components/sherpa-calendar/sherpa-calendar.ts`

### T-gauge-band-is-a-closed-path

Each gauge band is **ONE CLOSED `<path>`** — a ring segment with all four
corners rounded, built by the same `ringSegmentPath()` that draws a donut slice,
over the half circle from 9 o'clock to 3 o'clock.

Two rejected implementations, in order:

1. **Conic-gradient divs.** No per-band element at all, so a zone's hit target
   had to be a separate HTML wedge clipped to an 8-point polygon — which made
   the hollow centre hittable and missed the band's outer edge.
2. **A stroked circle whose dash exposed its own span.** It fixed the hit target
   but not the paint: a stroke is a thick LINE, so it has two caps and no
   corners. It could carry no border round the whole band (only a second arc
   along the two long edges) and no corner rounding at all. Its dash also had to
   be pushed half a circumference along to reach the gauge's zero, because
   rotating it instead resolved `transform-origin` against the circle's own fill
   box and swung the whole ring off centre.

A closed path does the paint and the hit target in one element, exactly as the
donut does, and needs neither workaround — a transform would skew the rounded
corners anyway.

The geometry constants live in TS, not CSS, because an SVG `d` cannot read a
custom property:

| | |
|---|---|
| `RING_WIDTH = 15` | the donut's band: `innerRadius` 0.7 on a 100-unit circle, the outer 30%. It was **9** (Figma's older `innerRadius` 0.82), which read as a thin hoop beside the donut on the same dashboard row |
| `CORNER = 1` | the donut's 2px on a 200px chart; `ringSegmentPath()` clamps it down for a band too thin or too short |
| `OUTLINE = 0.5` | 1px on a 200px chart, ALIGNED INSIDE as in Figma. SVG has no inside stroke, so the path is drawn half a stroke in from the true band edges — the same trick `sherpa-donut-chart` uses |
| `START_DEG = 270`, `SPAN_DEG = 180` | clockwise from 12 o'clock: 9 o'clock round the top to 3 o'clock (270 + 180 = 450, which is 90 wrapped past the top) |

JS still hands CSS the needle angle; the big number, caption and scale are text.

- Site: `src/components/sherpa-gauge-chart/sherpa-gauge-chart.ts`

### T-zones-paint-in-full

A gauge's ZONES paint **in full**, whatever the value. A zone is a THRESHOLD —
it says what a reading in that range would mean — so it is part of the SCALE,
not part of the reading. The NEEDLE says where the value falls.

Clipping the colour at the value would grey out the very band the reader is
about to enter, which is the one they most need to see.

With NO zones there is a single band as long as the value, coloured from CSS
(`--_fill`, which already resolves `data-status`). THAT is a reading, not a
scale, so it does stop at the value.

The FILLER is one grey band over whatever the bands leave uncovered, so the
gauge always reads full width rather than stopping short: zones covering the
whole scale need none, zones stopping at 80 or a bare value of 25 get grey for
the rest. It replaced a full half-circle track drawn underneath everything —
the bands already cover the gauge up to their end, so the only part of that
track that ever SHOWED was the leftover, and drawing just that removes a second
copy of the half-circle geometry, which is where it kept going wrong. The
remainder is chrome, not data: CSS greys it, drops its pointer target and gives
it no hover dot, so it never claims a tooltip.

Also the reason the middle scale tick is a TICK. It used to print
`data-label ?? the value`, which put the reading at the top centre of the arc —
a place that means "half way". On the Figma component the needle happens to sit
at 50 too, so the two readings agreed and the bug stayed hidden. There are
three ticks — min, the MIDPOINT, max — and `data-unit` suffixes all three
(Figma's gauge reads 0% / 50% / 100%).

- Site: `src/components/sherpa-gauge-chart/sherpa-gauge-chart.ts`

### T-hotspots-follow-what-was-drawn

The hover dots are stamped from the zones `#renderArcs` **actually drew**, which
it returns for the purpose — never from the declared `data-zones` list. A
zero-width zone is SKIPPED, so a tip stamped from the declared list would point
at a band that does not exist and every later index would slip by one.

`#renderArcs` therefore counts with its own `index`, not `forEach`'s: `forEach`'s
index would leave a hole wherever a band was skipped, while the hover layer
indexes its dots from 0 with no holes — so tip N would pair with band N+1. The
index is the only thing pairing an arc with its tip; CSS cannot derive it.

The dot and its tip are **SIBLINGS**, both cloned out of the same fragment. The
tip cannot be a descendant of the dot: an absolutely-positioned ancestor breaks
anchor positioning for a fixed tip, and the dot must be absolute to sit on its
band. Both carry the anchor NAME `--gauge-zone-<i>` — the dot declares it, the
tip points at it. Without it the tip has no anchor, `position-area` is
meaningless and the browser parks the tip wherever it likes.

The ONLY numbers JS gives CSS are the angle and the colour: `cos()`/`sin()` in
the CSS turn the angle into a position on the ring, so the dots follow the gauge
at any size with nothing measured here. The tip is pushed OUTWARD along its
band's radius (`radialArea`) so neighbouring zones' tips diverge instead of
stacking.

The accessible name goes on the **ARC**, which is what a pointer and a screen
reader's virtual cursor land on. The `<svg>` is `aria-hidden`, so the band needs
`role="img"` to be announced at all.

- Site: `src/components/sherpa-gauge-chart/sherpa-gauge-chart.ts`

### T-legend-caps-at-six-and-rolls-up

A legend draws at most `MAX_ITEMS = 6` rows. Beyond six it stops being a key —
nobody matches the eleventh shade of purple to its label, and beside a chart it
grows taller than the chart. Five named categories plus an "Other" total keeps
the shape readable and still accounts for every value: the numbers add up to
the same whole.

The roll-up only happens when it BUYS something. With exactly `MAX_ITEMS + 1`
entries "Other" would stand for one category, so the sixth is left named.

Only NUMERIC values are summed. A legend of labels with no values gets an
"Other" row with no value rather than a meaningless 0. Its swatch takes
`colorIndex: MAX_ITEMS` — the next hue after the named ones — so "Other" never
reuses a colour that already means something.

Because of all this, a consumer toggling a chart must prefer
**`detail.indices` over `detail.index`**: the "Other" row stands for several
series, and `index` alone would hide one and leave the rest drawn under a row
that says they are off. When the row comes back ON it reports only the
categories the reader had left active, so restoring the group does not silently
un-hide something they switched off in the breakdown.

The folded categories are kept WITH their original indices (`#rolled`), because
the breakdown menu has to name the right series back to the chart and the row
itself only knows a total.

- Site: `src/components/sherpa-chart-legend/sherpa-chart-legend.ts`

### T-legend-status-swatch-shares-the-band-tokens

A STATUS swatch reads the **same token pair the band it names does**:
`--sherpa-status-<name>-fill` (the status sequence's mid step at 50%) and
`--sherpa-status-<name>` (that sequence's border). A key that does not match the
thing it labels is worse than no key.

It used to light the `--_status-*` cascade via `data-status`, which is a
DIFFERENT token set — so the swatch and the gauge band it named were painted
from two unrelated sources and drifted apart.

A non-status item takes the categorical hue by 1-based index
(`seriesVar`/`seriesBorderVar`), wrapping at the palette size. Naming, never
position, is also how the gauge resolves its own zone colours — see
`T-gauge-status-is-named`.

- Site: `src/components/sherpa-chart-legend/sherpa-chart-legend.ts`

### T-rollup-row-has-its-own-prototype

The LAST row of a capped legend needs a second control beside its toggle, so it
comes from its own prototype (`template.rollup-tpl`) rather than
`template.item-tpl`. That prototype is a WRAPPER, not a bare button: a menu
button nested inside a button is invalid HTML and the browser un-nests it.

Because the prototype VARIES per row, this component clones each row itself
rather than going through `renderList`. In a roll-up the toggle is a CHILD of
the wrapper; otherwise it IS the wrapper, so the row resolves `entry` once and
writes everything to that.

The menu button's own click must `stopPropagation()`: it is a SIBLING of the
toggle, so its click would otherwise also toggle the row it sits in.

The breakdown is CHECKBOX rows plus `data-commit`, which is the point — the
reader ticks several categories and the menu stays open until Apply rather than
closing after every click. `sherpa-menu` already holds the rows as a draft and
restores them on Cancel, so nothing here manages that. Each checkbox's
`value` is the SOURCE index, so Apply can name the right series back to the
chart without a second lookup.

- Site: `src/components/sherpa-chart-legend/sherpa-chart-legend.ts`

### T-legend-suspend-remembers-the-set

The "Other" row's own toggle SUSPENDS its whole group. Its breakdown checkboxes
must follow it — leaving them ticked under a row that says "off" is a lie.

But the per-item choices are **NOT CLEARED**. They live in `#rolledActive`, so
switching the row back on restores exactly the set the reader last applied
rather than turning everything on. `#syncBreakdownBoxes` only ticks and unticks
the boxes and never touches that set, which is what makes the round trip
lossless. Suspended → every box off. Restored → back to the remembered set.

Same suspend-but-remember rule the Sort chip and the value-filter chips use:
suspend ≠ clear.

Applying the breakdown of a SUSPENDED group therefore turns the row back ON —
ticking anything in it means the reader wants it back, and Apply would
otherwise record a set that nothing displays. An empty set leaves the row off,
which is the same statement.

`aria-pressed` is BOTH the accessible state and the CSS hook for the dimmed
look, so the two cannot disagree; it replaced a `data-current` attribute that
duplicated it.

- Site: `src/components/sherpa-chart-legend/sherpa-chart-legend.ts`

### T-readonly-legend-is-a-key-not-a-filter

`data-readonly` makes a legend a pure KEY: no toggling, no button semantics. A
gauge's rows name THRESHOLDS rather than a series, so there is nothing to hide.

The row gets `role="presentation"` and `tabindex="-1"`, and its `aria-pressed`
is removed — a keyboard user must not be handed a control that does nothing.
`disabled` would be WRONG: the row is not unavailable, it was never
interactive.

The click handler guards on the attribute too, not only CSS, so pointer and
keyboard behave the same.

- Site: `src/components/sherpa-chart-legend/sherpa-chart-legend.ts`

### T-shadow-input-needs-element-internals

`static formAssociated = true` plus `attachInternals()` is not optional here.
Without it the field is INVISIBLE to the form around it: its value is left out
of `FormData`, `form.reset()` does not clear it, and `form.checkValidity()`
reports nothing about it. The real `<input>` is inside a shadow root, and a
form cannot see through one — that is the gap `ElementInternals` closes.

`#syncValue` then does two separate things through it:

- `setFormValue` puts the value into `FormData` under the host's `name`.
- `setValidity` is what `form.checkValidity()` and a submit both read.

The **third argument** to `setValidity` is the ANCHOR, and it is the inner
control, so the browser scrolls to and focuses the real box when a submit is
blocked. Without it the focus lands on the host and the caret is nowhere.

The flag is `customError` when the message came from OUR rules. The native
flags (`valueMissing`, `patternMismatch`) describe the browser's own checks, and
claiming one of those would misreport why the field failed. With no message of
ours it defers to the control's OWN native validity, which is already doing
`required`, `pattern`, `minlength` and the rest for free.

- Site: `src/components/sherpa-input-text/sherpa-input-text.ts`

### T-describedby-must-not-be-a-live-region

`aria-describedby` is what makes the hint and the error text reach someone who
cannot see them beside the box. The ids are per INSTANCE, because two fields on
a page would otherwise both claim `#description` and a reader would be told the
wrong thing. Both ids are named, in reading order: the hint explains the field,
the error says what went wrong with it. An empty one is harmless — a
`describedby` pointing at empty text announces nothing.

**What is NOT there: `role="alert"` or `aria-live` on the message.** Putting
either on the element `aria-describedby` points at causes DOUBLE-SPEAK in JAWS
and NVDA — the live region fires, then the description fires again on focus —
and has been seen to make VoiceOver drop the association entirely. A live region
belongs on a form-level summary, once, on a failed submit.

`aria-invalid` is the other half of the announcement: `describedby` says WHAT is
wrong, `aria-invalid` says THAT something is.

- Site: `src/components/sherpa-input-text/sherpa-input-text.ts`

### T-validate-on-blur-then-every-keystroke

Validation runs **on BLUR, not on every keystroke**. Telling someone their email
is wrong while they are still typing the `@` is nagging; telling them when they
leave the field is help.

Once a field HAS ERRED the rule inverts: `#onInput` re-checks on every
keystroke, so the message disappears the moment they fix it rather than
lingering until they leave the field. That is the whole condition —
`if (this.dataset['error'])`.

`#onInput` also re-syncs the FORM's copy of the value on every keystroke, so a
submit mid-typing sends what is on screen rather than what was there at the last
blur.

Inside `validate()`, **NATIVE CONSTRAINTS RUN FIRST**. `required`, `pattern` and
`minlength` are mirrored onto the real control and the browser already checks
them: it is free, it is localised by the browser, and a field with `required`
should say the browser's own "Please fill in this field" rather than a second
wording of our own. `data-rules` runs after, and is where a rule the platform
has no idea about goes.

- Site: `src/components/sherpa-input-text/sherpa-input-text.ts`

### T-rules-are-named-not-carried

`data-rules` NAMES a rule set rather than carrying it: an attribute is a string,
and a rule is a function. Naming keeps the markup declarative while the rules
stay real code — and two fields checking the same thing share one definition
rather than two copies that can drift.

    SherpaInputText.defineRules('email', [required(), email()]);
    <sherpa-input-text data-rules="email">

An **unknown name is NOT an error**. A field naming a rule set the app has not
registered yet — script order, a lazy view — must stay usable rather than
refusing every value. The store's own guard is the line that has to hold.

- Site: `src/components/sherpa-input-text/sherpa-input-text.ts`

### T-input-icon-sink-is-data-glyph

`#syncIcon` accepts either icon form, matching `sherpa-button`: a Font Awesome
CLASS LIST (`"fa-solid fa-magnifying-glass"`) or a raw CHARACTER (`"+"`).

Only the character path may go through `data-glyph`, whose CSS is
`content: attr(data-glyph)`. Handed a class list it printed the class list AS
TEXT — which is exactly what a menu's search field showed. The two components
took different forms until this was fixed, which is a trap for anyone composing
one into the other: the same attribute name meant two different things.

It is **NOT `SherpaElement.writeIcon`**, deliberately. `writeIcon`'s glyph sink
is `textContent`; this component's is the `data-glyph` ATTRIBUTE, because its
CSS draws the character with `content: attr(data-glyph)` (the
`.icon[data-glyph]::before` rule). Migrating would empty that attribute and the
raw-character icons would vanish.

- Site: `src/components/sherpa-input-text/sherpa-input-text.ts`

### T-nav-child-rows-carry-no-icon

EVERY top-level nav item carries a leading icon; a CHILD item **never** does.
The design tells a child apart by its INDENT, so a second icon column would
only add noise.

An `icon` set on a child entry is therefore **deliberately DROPPED** rather than
honoured — `#buildRows` only writes it when `depth === 1`. That is why
`NavRowInfo.icon` is `undefined` on a child row, and a consumer mirroring the
selection (the app header does) must then show NO icon rather than keep the last
one.

`entry(id)` reads that back off the stamped ROW, not off the config, so it is
true for a rail filled any way — `populate()`, or hand-authored rows in the
light DOM.

The label and the icon also ride along on `nav-select`: a consumer that mirrors
the selection should not have to re-look-up the row, and must not have to keep
its own copy of the nav config in step.

Prefer nesting with `children` over setting `tier` by hand. Depth maps to the
Figma indent tiers (8 / 32 / 48), and only `children` lets the rail collapse
them with their parent and hide them in the 40px rail — which a flat list of
hand-tiered rows cannot express.

- Site: `src/components/sherpa-nav/sherpa-nav.ts`

### T-nav-state-writes-only-the-attribute

`#setState` writes `data-nav-state` and emits `nav-state-change`, and that is
ALL it does. Every transition funnels through it so the event fires exactly once
and the two header buttons stay in step with the attribute.

Two bugs came from breaking that:

1. **The `state` setter wrote the attribute directly.** `nav-state-change` then
   never fired, so the app-shell's content inset never moved and every host had
   to re-dispatch the event by hand. It goes through `#setState` now, so a host
   setting the mode is announced exactly as the rail's own pin and settings
   buttons are.
2. **The settings re-render lived in `#setState`.** A host that sets
   `nav.dataset.navState` by hand — which the example app does, to follow the
   URL — got no swap, and ended up in settings mode still showing the product
   tree. `onChange` owns that re-render now, so both paths behave the same.

`onChange` re-stamps on the SETTINGS EDGE ONLY. `#renderQuick` and
`#renderSections` had always branched on the mode, but nothing re-ran them when
the mode changed. The other four modes share one list, and re-rendering on every
hover would throw away each parent's expanded state.

SETTINGS shows a DIFFERENT list — its own pages, and NO quick items. Home /
Recent / Favorites are shortcuts into the PRODUCT tree, and settings is a
different place; offering them there would jump the user out of the section they
are configuring.

- Site: `src/components/sherpa-nav/sherpa-nav.ts`

### T-parent-chain-walk-not-a-selector

The rail is stamped as a **FLAT list of rows**, because the Figma rail is one
flat column of 24-tall rows and INDENTATION alone conveys depth — there is no
nested container to draw. Each row records `data-parent` and `data-depth`.

So "is this child showing?" is a WALK UP the `data-parent` chain, and not
something a selector can express. A row shows when EVERY ancestor above it is
expanded. The children are flat SIBLINGS of their parent, so `:has()` could only
tell that SOME sibling is shut and would hide unrelated branches. Deriving it
here also means a closed GRANDparent correctly hides a grandchild whose own
parent is open, with no cascade of extra state to keep in step.

`#syncRowVisibility` writes `data-hidden` and CSS acts on it; JS never toggles
display. It is re-derived after every stamp and every chevron toggle, and runs
once at the end of `#renderSections` because parents start closed, so their
children must start hidden.

- Site: `src/components/sherpa-nav/sherpa-nav.ts`

### T-brand-icon-must-empty-its-host

`#applyIcon` is **NOT `SherpaElement.writeIcon`**, and this is the one place
that is correct.

`writeIcon` styles the element it is GIVEN. `.brand-icon` WRAPS a
`<slot name="brand-icon">` holding a default `<i class="fa-solid fa-cubes">`, so
adding classes to the wrapper would leave that fallback showing BESIDE the real
mark. The host must be emptied first, which is why this builds a child — the one
sanctioned `createElement` in the component layer.

A slotted icon still wins: `#renderBrand` only applies the config's icon when
the wrapper holds no `[slot]` child of its own.

- Site: `src/components/sherpa-nav/sherpa-nav.ts`

### T-nav-search-uses-a-real-highlight

Typing narrows the rail to matching rows and highlights the matched text with
the **CSS Custom Highlight API** — a real `Highlight` of `Range`s, styled by
`::highlight(sherpa-nav-match)`. No marker elements are injected, so the rows'
own DOM and their Font Awesome icons are untouched.

Each row highlights its OWN label, through `sherpa-nav-item`'s `highlight()`: a
custom highlight is NOT PAINTED for shadow text unless it is registered and
styled INSIDE that same tree.

CSS owns the hiding; JS only marks the row with `data-filtered-out`. A section
with no surviving rows carries the same flag, so its label and rule hide too.

- Site: `src/components/sherpa-nav/sherpa-nav.ts`

### T-header-actions-are-composed-buttons

Every header action is a composed `sherpa-button`, exactly as Figma instances
them. The header used to hand-roll eight plain `<button>` elements with ~50
lines of CSS re-implementing the component — which is precisely how the two
drifted apart.

So the listeners bind **`button-click`, not the native `click`**.
`sherpa-button` suppresses its own event when disabled, where a raw `click`
listener would still fire on the host element. The component's event is the
honest signal.

`ACTIONS` is listed in FIGMA'S ORDER (App Header 150:3690 `Actions` slot), so
the list reads like the bar does. There is no chat button — the code had
invented one.

- Site: `src/components/sherpa-app-header/sherpa-app-header.ts`

(none — cites the EXISTING trap; see SITE LINES TO ADD MANUALLY above)

### T-header-owns-the-filter-bar-surface

The quick-filter toolbar is slotted in the LIGHT DOM, so a host CAN reach it
with a `querySelector`. It should not have to: the header is what a view holds a
reference to, and a saved view that must know the toolbar's TAG NAME to set a
filter is a view coupled to this header's internals. So the header re-exposes
`values` — the toolbar's picks, or `{}` when no toolbar is slotted.

**PARITY.** Anything a reader can click here, a caller must be able to call — a
saved view, a deep link, a test, an agent with no pointer.

The `values` setter **REPLACES** the set: a chip the caller does not name is
switched off, because a view definition is a whole statement about the bar, not
a patch on whatever was showing before it. It is silent, like the toolbar's own
setter — the caller already knows.

`#stamp` never CREATES a child. The consumer must slot the empty host
(`<sherpa-breadcrumbs slot="breadcrumbs">`), and `populate()` only feeds it. A
child that has not upgraded yet has no `rendered` to wait on, so the registry
gets a turn first via `queueMicrotask` — see `T-custom-element-upgrade`.

- Site: `src/components/sherpa-app-header/sherpa-app-header.ts`

### T-one-way-to-build-an-element

**`document.createElement` plus `dataset`. That is the whole API.**

`render-element.ts` held two things that looked related and were not:

| | what it did | app callers |
|---|---|---|
| `applyState(el, state)` | configure a live element through its own methods and accessors | **1 — the live saved-view path** |
| `renderElement(node)` | build an element from a JSON node: `{ type, props, data, slots, children, state }` | **0** |

`applyState` is load-bearing: `records.js` builds state blocks for
`persistView`, and `persist-view.ts` applies them — that is how a saved view
restores a grid's column filters. It moved to `apply-state.ts` and stays.

`renderElement` was a JSON dialect for describing a tree — a second way to say
what markup already says, with `props` for attributes, `slots` for slots and
`children` for children. Four tests called it. Nothing else ever did.

**What real code does instead**, from `examples/views/chat.js`:

```js
const el = document.createElement('sherpa-chat-message');
el.dataset.type = type;
el.dataset.message = message;
thread.insertBefore(el, typing);
```

Six lines, no dialect, and it was written by someone who had `renderElement`
available and did not reach for it. That is the evidence, not the argument.

**Three questions, three deletions, one rule.** The shell
(`renderView` rebuilt `sherpa-app-shell`), the wiring (`$state` was an
attribute write beside `DataSource.bind` —
`T-attributes-are-the-state-channel`), and now the builder. Each was a second
way to do something the platform or this system already did once.

What is left, end to end:

| | |
|---|---|
| a view's SHAPE | markup, in the app shell |
| a component's ATTRIBUTES | `el.dataset.x = v`, or a bound `DataSource` |
| a component's METHODS | `applyState` — the parity door a saved view goes through |
| a component's DATA | `populate()` |

`Populatable` moved to `apply-state.ts` with it: it is the one shape every
bound component shares (`T-populatable-declared-four-times`), and
`data-source.ts` imports it as a type.

- Site: `src/core/apply-state.ts`

### T-state-is-the-saved-view-half

`props` sets attributes and `data` sets the populate payload. Neither can express
what a component exposes as a METHOD or an accessor — a grid's column filters
(`setColumnFilter`), its selection (`select`), a chart's hidden series
(`hiddenSeries`), a transfer list's chosen values. That is the half a SAVED VIEW
needs, so `state` is the field that carries it.

A reader who filters a column and reloads should find it filtered; a preset
called "Overdue invoices" should arrive configured; an agent should be able to ask
for a view by describing it. All three are the same data.

```
{ type: 'sherpa-data-grid',
  data: { columns, rows },
  state: { columnFilters: { name: ['name', 'contains', 'ana'] } } }
```

Each key is a property or method NAME on the element. A method is CALLED with the
value (spread when it is an array of arguments); an accessor is ASSIGNED. Applied
after `populate()`, because a grid cannot filter a column it does not have yet.

A key the component does not expose is SKIPPED, not thrown: a saved view outlives
the code that made it, and one stale key must not stop the rest being applied.
`renderElement`'s return says how to learn what was skipped. Same reason a bad ROW
is dropped and counted rather than thrown.

`ViewElement.state` in render-view.ts is the same field, and it was MISSING there
at first — so a view definition could build a whole unique layout and then not set
a grid's column filter, which is the thing view definitions exist for.

- Site: `src/core/apply-state.ts`
- Site: `src/core/apply-state.ts`
- Site: `test/e2e/reforged-view-definition.spec.ts`
- Site: `src/index.ts`

### T-populatable-declared-four-times

`Populatable` is `HTMLElement` plus `populate?` and `rendered?`. The optional
members are what lets a plain `HTMLElement` be passed where one is expected, and
be skipped rather than crash.

`rendered` MATTERS AND WAS MISSING from render-element's copy, while data-source,
render-view and app-header each declared their own copy WITH it. Four declarations
of one idea, and the shortest one was silently a different contract — which is why
`renderElement` populated synchronously while everything else waited for the
element to exist. `el.rendered` now reads straight off the interface; it used to
need an inline `as { rendered?: … }` cast, because THIS file's copy was the one
missing the member.

- Site: `src/core/apply-state.ts`

### T-state-value-may-be-a-call-list

A `state` value for a METHOD is its ARGUMENT LIST, so `setColumnFilter` takes two
and `select` takes one — which is why a single-argument method wanting an array is
written as a nested array.

The method is CALLED REPEATEDLY when the value is an array of argument lists. A
`state` block is a map, so one method cannot appear twice — and `setColumnFilter`
has to run once per filtered column. Nesting the calls is the honest answer;
inventing a `setColumnFilter:name` key would be a second vocabulary nothing else
understands.

The two are told apart by whether EVERY entry is itself an array AND there is more
than one: `[['name', clause], ['plan', clause]]` is two calls, `[['a@x']]` is one
call whose single argument is an array. A single nested array stays one call, which
keeps the common case unambiguous.

- Site: `src/core/apply-state.ts`

### T-attributes-are-the-state-channel

**State travels as an ATTRIBUTE, and there is exactly one mechanism for it.**

```
DataSource  →  setAttr(el, 'data-sort-field', 'name')
                          ↓
grid        →  this.dataset.sortField
```

That is the contract for all 58 components: attributes carry state IN, events
carry intent OUT. So a second mechanism for the same job is a second answer.

`renderView` had one. Its `$state` binding compiled to exactly this:

```js
el.setAttribute(name, String(v));   // render-view.ts
```

An attribute. On top of it, `$state` added re-set-on-change and `writes` added
write-on-event — set a value, listen for a change, set it again. **That is
`DataSource.bind()`**, which also knows the query behind it and has
`readonly`, `steerOnly` and `ignore`, none of which `$state` had.

The audit settled which one was real:

| | app code | tests |
|---|---|---|
| `$state` construction sites | **0** | 3 |
| `writes:` arrays | **0** | 2 |
| `renderView()` calls | **1**, unreachable | 4 |
| `DataSource.bind()` | **7** | 25 |

The one `renderView` call sat in `persist-view.ts`, reached only when
`SavedView.content` was an OBJECT. Every `content:` in the repo is markup, so
nothing reached it. the data-layer plan (retired) had already said so out loud:
*"`DataSource` is that idea applied to records rather than to a view blob, and
the two should share the mechanism."*

So `render-view.ts` and `view-definition.ts` are gone, and with them `$state`,
`writes`, `RenderedView`, the `StateStore` alias and `ViewDefinition` itself.
What is left is one of each:

| | |
|---|---|
| a view's SHAPE | markup — `T-saved-markup-is-untrusted-input` |
| a view's STATE | `DataSource.bind()` — attributes in, events out |
| a view's own API state | `applyState` — `T-state-is-the-saved-view-half` |
| what an app knows about itself | `SessionStore`, standalone. The real app uses it for theme mode and never needed a view around it |

`renderElement` stays: one node, one element, no registry. It is what
`applyState` and the examples use, and it never claimed to wire anything.

- Site: `src/core/persist-view.ts`
- Site: `test/unit/headless-data-layer.test.mjs`

### T-saved-markup-is-untrusted-input

**A saved view's content is MARKUP, and it is PARSED, never assigned.**

The format question answered itself: every authored screen in this repo is
already an HTML template dropped into `sherpa-app-shell`
(`examples/templates/*.html`, four of them, none calling `renderView`). A saved
view is the same thing a USER made instead of an author, so it is the same
format. One way to describe a view, not two.

**But the string does not come from this codebase.** It comes out of
`localStorage`, out of IndexedDB, or off a server — and a person can edit all
three. `innerHTML` on it runs whatever it contains. So
`core/view-markup.ts` parses it through an allow-list:

| | |
|---|---|
| any `sherpa-*` element | **allowed** — they are the vocabulary |
| layout and text tags | **allowed** — `div`, `span`, `section`, `ul`, headings, `strong`… |
| `data-*` | **allowed** — the public API of every component here |
| `class`, `id`, `slot`, `part`, ARIA | allowed |
| `<script>`, `<iframe>`, `<img>`, `<a>`, `<form>`, `<input>`, `<svg>` | **dropped, with the subtree** |
| `on*` | **dropped** — an inline handler is a script |
| `style` | **dropped** — it carries `url()`, and every visual here is a token or a `data-*` |

Three things make this hold, and each is easy to get wrong:

**1. `DOMParser`, not `innerHTML`.** The parsed document is INERT by
specification: no script runs, no image loads, no stylesheet fetches — even for
the nodes about to be dropped. Assigning first and cleaning after has already
lost.

**2. Elements are BUILT FRESH, never adopted.** `createElement(tag)` plus the
attributes that pass, so only the allow-list ever crosses into the live
document. Importing the parsed node would carry whatever the parser attached.

**3. `on*` is refused EXPLICITLY**, not by omission. `onclick` is absent from
the allow-list and would fail anyway — until someone widens a rule. This fails
on purpose, which survives that.

`setHTML` and the Sanitizer API would do some of this, but they are Chromium-only
today, and a view needs a far narrower vocabulary than a general sanitiser
targets. A small allow-list is an easier promise to keep.

**Drops are REPORTED, never silent** — `parseViewMarkup` returns them and
`onViewPicked` warns. A view that quietly lost half its content reads as a
rendering bug, and the reader has no way to know it was refused.
`checkViewMarkup` answers the same question WITHOUT building, for a host
deciding whether to accept a saved view at all.

**A `ViewDefinition` object is still accepted**, for the one thing markup cannot
express: the `$state` bindings and `writes` wiring in
`T-a-view-definition-is-data-the-render-is-not`. Markup describes a SHAPE; the
object describes a shape plus its reactive plumbing. Most views only need the
shape — the `capacity` preset's 40-line object became twelve lines of HTML.

The snapshot still addresses elements BY ID, through their own API, exactly as
before: markup carries real `id` attributes, and `onViewPicked` collects them
from the host after the swap.

- Site: `src/core/view-markup.ts`
- Site: `src/core/persist-view.ts`
- Site: `test/e2e/reforged-view-markup.spec.ts`
- Site: `src/index.ts`

### T-sse-over-websocket-for-a-feed

`live-stores.ts` records the SERVER pushes. Every other store PULLS: something
asks, the store answers. These two are the other direction — the server speaks
first, and whatever is bound redraws.

| | |
|---|---|
| `SocketStore` | WebSocket. TWO WAY — a live cursor, a collaborative edit, an ack. Does NOT reconnect by itself, so this store backs off and retries. |
| `EventStore` | Server-Sent Events. ONE WAY, server → browser, over ordinary HTTP. Reconnects by itself, replays what was missed via `Last-Event-ID`, and passes through proxies that block WebSocket. |

SSE over WebSocket for a plain arriving feed, for three reasons that all matter:
it is ordinary HTTP so proxies and CDNs do not block it, the browser RECONNECTS on
its own, and `Last-Event-ID` lets the server replay what was missed while the
connection was down — which is exactly what a notification list must not lose.

Both are native. Neither adds a dependency, and both are real Stores, so a
DataSource binds to them exactly as it binds to an ArrayStore.

The records live in an `ArrayStore`, because everything AFTER receiving them —
sorting, filtering, paging, the schema guard, copy-in/copy-out — is already
written and correct. `LiveStore` is only about the wire.

- Site: `src/core/live-stores.ts`

### T-live-store-into-shares-one-feed

`into` feeds an EXISTING `ArrayStore` rather than making a new one.

Several connections into ONE feed — alerts, builds and deploys arriving on three
sockets and appearing in one list — is impossible otherwise, because each live
store creates its own `ArrayStore` and a DataSource can bind only one of them:

```
const feed = new ArrayStore([], { key: 'id', maxRows: 200 });
new SocketStore({ url: alertsUrl,  into: feed });
new SocketStore({ url: buildsUrl,  into: feed });
new DataSource({ store: feed });   // one query over all three
```

No new concept: the change re-dispatch already treats inner and outer as one
store, so this only changes WHERE the inner one comes from. A store passed here is
NOT owned — `rows` and `key` are its own (they may already hold another socket's
messages), and nothing here disconnects it.

- Site: `src/core/live-stores.ts`

### T-push-handler-never-throws

Everything a wire can go wrong with funnels through `LiveStore.receive` and
`#apply`: bad JSON, a shape nobody expected, a type this store does not handle, a
push the SCHEMA refused. **None of them throw**, because a throw inside a socket
handler kills the handler and the page goes quiet with no sign of why. They
dispatch an `error` event naming the stage instead.

A message that is not JSON is still a message — it reports and the connection
carries on rather than the feed dying on one bad line.

`undefined` from `parse()` is how a store says "not mine": a store on a shared
channel ignoring a message meant for another. A server rarely sends exactly what a
store wants — a notification feed might wrap its list in `{ data: [...] }`, or send
a type this app does not care about — and `parse` is where that is untangled.

A refused push landing here is the point of putting the guard on the store: a bad
record from a server is stopped exactly where a bad record from a form is.

`connection` is a third stage, and `setConnected` dispatches its own `connection`
event so a UI can show "reconnecting…" rather than guessing from silence.

- Site: `src/core/live-stores.ts`

### T-eventsource-error-is-not-fatal

An `error` from `EventSource` is NOT fatal. EventSource reconnects by itself, so an
error usually means "the connection dropped and I am retrying" rather than "give
up" — closing it would throw away the retry the browser is already doing. The store
reports it and marks itself disconnected, and nothing else.

`WebSocket` is the opposite: it does NOT reconnect by itself, which is why
`SocketStore` owns a backoff. `SocketStore.BACKOFF_MS` is `[500, 1000, 2000, 5000,
10000]`, capped at the last step, and a successful `open` RESETS the counter — a
long-lived page that drops once an hour must not creep up to a ten-second wait. A
deliberate `disconnect()` must not reconnect, which is what the `#closing` flag
separates from a drop.

- Site: `src/core/live-stores.ts`

### T-narrowing-constructor-is-not-useless

`EventStore` and `SocketStore` each declare a constructor whose whole body is
`super(options)`, with an eslint disable for `no-useless-constructor`. **It is not
useless.** Without it the class inherits `LiveStore`'s signature and would accept a
bare `LiveStoreOptions` — so a caller could construct one with none of the fields
that make it that kind of store, and TypeScript would allow it. The only job is
NARROWING the parameter type.

Delete either one and the type error moves from the call site to nowhere.

- Site: `src/core/live-stores.ts`

### T-socket-send-refuses-rather-than-queues

`SocketStore.send` returns **false** when the socket is not open, rather than
throwing or queueing.

A caller that must not lose the message should hear so and decide. A silent queue
that drains on reconnect delivers stale messages in a new context — a cursor
position from thirty seconds ago, an ack for a record that has since changed.

This is the half `EventStore` cannot do at all.

A `LiveStore` write (`insert`/`update`/`remove`) is separately LOCAL: it changes
what is on screen and does NOT travel to the server — the server is the one
pushing, and the store has no route back to it. A caller that needs the change to
stick sends it their own way (a POST, a `SocketStore.send`) and lets the next push
confirm it.

- Site: `src/core/live-stores.ts`

### T-standard-schema-is-duck-typed

`standardschema.dev` is a community INTERFACE CONVENTION — not a spec, not a TC39
proposal — under which a schema advertises a `~standard` property holding a
`validate` function. Zod, Valibot and ArkType all implement it.

It is duck-typed, so Sherpa accepts any of them WITHOUT importing anything and
without gaining a dependency. The interface here is DECLARED, never imported.
`rules()` builds a schema of the same shape, so a caller who wants nothing extra
uses the built-in and a caller who already has Zod passes that instead — through
the same door:

```
new ArrayStore(rows, { schema: rules({ email: [required(), email()] }) })
new ArrayStore(rows, { schema: zodSchema })
```

Two details of that contract are honoured and matter downstream:

- `validate()` may return a result OR a promise of one. Every caller must handle
  both — which is also what makes an async rule ("is this username taken?") work
  through the same door as a synchronous one.
- An issue is `{ message, path? }`, and `path` is an ARRAY because a value can be
  nested (`['address', 'postcode']`). Sherpa's own `Issue` stays compatible rather
  than inventing a different shape.
- `issues` ABSENT means valid, and the parsed `value` is then present.
  Deliberately not a `valid: boolean` — a schema may COERCE (`"42"` → `42`), and
  the caller needs what it settled on rather than only whether it passed.

- Site: `src/core/validate.ts`

### T-every-rule-but-required-passes-absent

Every rule PASSES an absent value. Only `required()` objects to emptiness.

That is what lets `[min(3)]` mean "if you write something, write three
characters" and `[required(), min(3)]` mean "write something, and make it three" —
a field can be optional and still be constrained when filled.

"Absent" counts empty string, because a text input that has been cleared holds
`''` and a reader means the same thing by it as by never typing. An empty array
counts too. Zero and `false` do NOT count — they are answers.

Rules on one field run IN ORDER and stop at the FIRST failure. An empty field
should say "Required", not "Required" and "Must be at least 3 characters" — the
second is noise when the first is the reason. `validateField` does the same for one
field on its own, using the same rules and messages, so the form and the field
cannot disagree about what is allowed.

A rule that cannot judge should not object either: `sizeOf` returns null for
anything that is not a number, string or array, so `min`/`max` pass rather than
inventing a comparison.

- Site: `src/core/validate.ts`

### T-email-check-is-deliberately-loose

The `email()` rule is `something@something.something` and nothing stricter.

A stricter regex rejects addresses that are real — RFC 5322 allows quoted strings
and comments — and the only way to know an address works is to send to it. This
catches typing a name into the email box, which is what a client-side check is
for.

`url()` takes the same line from the other end: it uses `URL.canParse`, the
platform's own parser, so there is no regex to get wrong.

- Site: `src/core/validate.ts`

### T-one-function-places-label-and-gridline

Both the axis label and its gridline are placed with `tickPercent(index, steps)`,
on the same box, so they cannot disagree.

Two separate calculations is exactly how the previous versions drifted: the
gridlines drew N−1 interior lines while the axis laid out N+1 flex boundaries.

`formatTick` is shared for the same reason — the barchart and the line chart cannot
format the same number two different ways.

- Site: `src/core/format-tick.ts`

### T-radial-tip-pushes-outward

A radial chart's markers fan out from a centre, so a tooltip pushed outward along
the marker's own radius can never overlap its neighbours' — they diverge by
construction. That is cheaper and steadier than measuring boxes and nudging the
ones that collide.

`position-area` offers a 3x3 grid of areas around an anchor. `radialArea` maps an
angle to whichever of the 8 outer cells faces away from the centre, so the tip sits
on the far side of its marker with the marker between it and the ring.

The circle is split into 8 octants CENTRED on the compass points, and the angle is
offset by half an octant (22.5°) before flooring — 0° (up) must land squarely in
`block-start`, not on a boundary. Angles run CLOCKWISE from 12 o'clock throughout
this module, matching how both the donut and the gauge already place their marks.

- Site: `src/core/format-tick.ts`

### T-ring-segment-needs-two-radius-clamps

`ringSegmentPath` replaces the stroked-circle-with-a-dash trick the donut used to
draw. A stroke is a thick LINE: it has two caps and no corners, so it can carry
neither a border right round the slice nor a radius on all four corners. Figma's
slice is an arc with `cornerRadius: 2` and a 1px stroke on every edge, which only a
real closed path can express. One element, one hit target, one hover — `fill` tints
the body and `stroke` traces the whole boundary.

The corner radius is clamped **TWICE**:

1. to a quarter of the BAND's thickness, and
2. to a quarter of the SEGMENT's own arc length, measured at the INNER radius
   where the arc is shortest.

Without the second clamp a thin slice asks for more rounding than its arc is long,
the corner arcs cross over each other, and the path folds inside out and paints a
**bow tie**.

Two more shapes that are not the general case:

- A segment covering the FULL circle (`span >= 359.999`) has no corners to round
  and no radial edges to draw, so it is emitted as two plain circles — outer, then
  inner reversed — which `fill-rule: evenodd` hollows out. The rounded-corner path
  has nothing to attach to and would collapse.
- A PIE (`inner <= 0`) has a single centre point for its inner "arc", so its
  corners collapse there and the inner half of the outline is skipped.

- Site: `src/core/format-tick.ts`

### T-series-count-is-ten-not-eleven

`SERIES_COUNT` is **10** — ten sequences of ten steps, with `series/1..10` reading
one step each, since the Data Viz collection was rebuilt (2026-09-15).

It was **eleven**, and the wrap lived as a bare `% 11` in four separate components
— so a change to the palette silently left charts asking for a variable that no
longer existed. An undefined custom property paints NOTHING at all, with no error,
which is why the wrap is one exported constant and both `seriesVar` and
`seriesBorderVar` go through it. An eleventh series reuses the first hue.

`seriesBorderVar` falls back to the series fill, and the collection's `border`
aliases to colour 5 of whichever sequence is active: a mark's FILL moves along its
ramp, its BORDER does not. The border is the series' identity, so it stays put
whatever the fill is doing — and it is what keeps a translucent mark legible on any
surface.

- Site: `src/core/format-tick.ts`

### T-one-datum-shape-for-chart-and-legend

`BarDatum`, `DonutSlice` and `LegendItem` were three names for the same three
fields. A legend sits BESIDE a chart showing the SAME data, so crossing between
them should be free — and it was not:

```
barData.map((d) => ({ label: d.label, value: d.value, colorIndex: d.colorIndex }))
```

…in `dashboard.js`, a copy of a shape to itself, field for field, purely to cross a
type boundary that should not have existed.

Three names also defeat `#push`'s skip-if-unchanged guard: it compares the rows
array by IDENTITY, and an adapter that rebuilds the array to change its type never
matches. ONE shape means a chart and its legend can share one array, and the guard
holds.

`LegendDatum` is `ChartDatum` with `value` WIDENED: a chart needs a NUMBER to draw
it, a legend may print a preformatted string ("£1.2k", "42%") because it only
prints it. The legend widens rather than every chart loosening its own.

- Site: `src/core/chart-datum.ts`

### T-populate-vocabulary-is-label-value-description

Surveyed 2026-09-17 across all **22** components that implement `renderData`.
Thirteen declare a named shape, and three words carry most of them:

| word | count | meaning |
|---|---|---|
| `label` | 7 of 13 | the thing's name, as a reader sees it |
| `value` | 4 of 13 | its measurement or its form value |
| `description` | 3 of 13 | the secondary line under the label |

Two components DEVIATED, and both translated their own vocabulary in the one line
where the spellings met:

- `sherpa-metric` — `name` → `dataset['label']`
- `sherpa-notifications` — `title` → `dataset['label']`

Both now take `label` and keep the old word as a deprecated alias.

THE RULE, for any new populate shape:

```
label        NOT name, title, heading, text or caption
value        NOT amount or count
description  NOT helper, sublabel, detail or body
id           the thing's identity, when a caller needs to address it
icon         a Font Awesome class list — see SherpaElement.writeIcon
```

It matches the ATTRIBUTE vocabulary (`data-label`, `data-description`,
`data-icon-start`) on purpose: a component's two doors should not use two words for
one idea. NAMING-STANDARD D9 says the same thing for attributes; this is that rule
reaching the data path.

A shape is free to ADD fields nothing else has — a metric's `trend`, a
notification's `unread`. What it must not do is rename one of these.

- Site: `src/core/chart-datum.ts`

### T-schema-guard-belongs-at-the-store

`StoreOptions.schema` checks every row a store WRITES and refuses the ones that
fail. A Standard Schema — `rules({...})` from validate.ts, or a Zod / Valibot /
ArkType schema; duck-typed, so passing one adds no dependency
(`T-standard-schema-is-duck-typed`).

The guard belongs at the STORE rather than at the form, because a form is not the
only way a record arrives: a REST response, a paste, a script and a second UI all
reach the same records, and **a rule enforced in one screen is not a rule**. The
form should still validate — it is where a person can be told what is wrong while
they can still fix it — but this is the line nothing crosses.

`check()` THROWS on failure rather than returning `false`. An invalid write is an
error the caller has to handle, and a boolean return is the kind of thing a caller
forgets to read — the record would then silently not be saved while the UI said it
was. It returns the schema's own PARSED value, because a schema may coerce (`"42"`
→ `42`) and the store should record what the schema settled on rather than what
arrived. No schema means no check, so this cannot break an existing caller.

`ValidationError` carries the ISSUES, not just a message, so a form can put each
one beside the field it belongs to; a single "invalid" string would force the UI to
guess. Its `message` is for a log or an unhandled throw.

Three places apply it, and each does so once:

- `ArrayStore.insert` / `LocalStore.insert` — CHECKED FIRST, so a refused row is
  never stored and never announced.
- `RestStore.insert` — checked BEFORE sending (a round trip to learn what the
  client already knew is a wasted request, and a server that accepts a bad row
  leaves the UI showing something the rules forbid) **and again on the way back**
  (a response is data from somewhere else). The server's own row wins when it sends
  one, since it may have filled in an id.
- `JsonStore` — its inner `ArrayStore` holds no schema of its own, so the check
  happens once in `JsonStore.load`, never twice.

- Site: `src/core/stores.ts`
- Site: `src/core/base-store.ts`

### T-max-rows-is-oldest-out-by-insertion

`StoreOptions.maxRows` keeps at most N rows, dropping the OLDEST first. A socket
delivering an alert a second fills a tab's memory overnight, and nobody scrolls to
hour three.

OLDEST-OUT by **INSERTION ORDER**, not by a field — the store does not know which
field means "when". The cap is about how much is kept, not what is shown; a view
wanting another order sorts.

It applies on INSERT, and trims what the constructor or `setRows()` hands over too
— **a cap only some writes honour is not a cap**. On insert the trim runs BEFORE
the announce, so a listener that reads the store sees the same rows the store will
hand out. A live feed inserts for ever; that is where an uncapped store would grow
without bound.

- Site: `src/core/stores.ts`
- Site: `src/core/base-store.ts`
- Site: `src/core/idb-store.ts`

### T-read-check-drops-where-a-write-throws

`checkRows()` is the read counterpart of `check()`, and deliberately NOT the same
shape.

A WRITE throws — one row, handed over on purpose, and wrong. A READ cannot: one bad
row in a thousand would empty a grid. So a refused row is **DROPPED and COUNTED**,
and `dropped` travels on the `LoadResult` (`T-dropped-rows-must-be-countable`),
because a schema quietly rejecting 40% of a response looks like a backend outage.

Three consequences that are easy to undo by accident:

- The PARSED value is kept, not the input — renaming `customer_name` to `name` and
  coercing `"900"` to `900` is the point of a read schema.
- The TOTAL drops with the rows. A pager counting rows that were never shown would
  offer a page that renders empty.
- `issues` carries the FIRST FEW ONLY (5). A broken backend produces one issue per
  row, and a host wants to know WHAT is wrong, not to receive ten thousand copies.

`RestStore.load` is **the least trustworthy path in the system** — rows from
somewhere else, over a wire, shaped by a backend this code does not own. If a schema
is going to be applied anywhere on a read, it is there.

- Site: `src/core/stores.ts`
- Site: `src/core/base-store.ts`

### T-array-store-copies-both-ways

`ArrayStore` COPIES the array in, and every row it hands out is a copy too.

A consumer mutating a row it was given must not silently rewrite the store's own
record — that is the bug where a grid's edit appears to work and then vanishes on
the next reload, because the "change" was never actually recorded.

`update()` MERGES rather than replaces: an update carries the fields that changed,
and a caller sending one field must not blank the rest. The MERGED row is what gets
checked, not the patch — a schema sees whole records, so checking `{ seats: 4 }`
alone would fail every `required` rule for a field the update simply did not
mention. `LocalStore.update` does the same.

`RestStore` splits it the other way round: the RESPONSE is checked, the patch is
not, for the same reason — a PATCH body is a fragment, and what comes back IS the
whole record.

- Site: `src/core/stores.ts`

### T-numeric-keys-compare-as-strings

A key arrives as a string far more often than not — from an attribute, a URL, a
`data-id`. `'7' === 7` is false and would report a row as MISSING, so `sameKey`
compares numbers and numeric strings as equal by stringifying both. Everything else
is strict, and `null`/`undefined` never match anything.

Every `findIndex`/`find` over the key field in this module goes through it, so
`ArrayStore` and `LocalStore` cannot disagree about whether a row exists.

- Site: `src/core/stores.ts`
- Site: `src/core/idb-store.ts`

### T-fetch-does-not-reject-on-404

`fetch` does NOT reject on 404 or 500 — it resolves with `ok === false`. A missing
endpoint would otherwise read as an empty result set, which is the worst possible
failure for a grid: it looks like "no records" rather than "the server is down".

So `JsonStore.#fetch` throws on `!response.ok`, and `RestStore.#request` throws an
`HttpError` carrying the status so a caller can branch on it. `RestStore.byKey`
branches on exactly that: a **404 means "no such row", which is an ANSWER**, not a
failure, and it returns `undefined`.

Two more platform details in the same path:

- `AbortSignal.timeout(...)` gives every request a deadline; the default is 30000ms.
- **204 No Content** is the usual answer to a DELETE and has no body to parse, so
  that status (and a `content-length: 0`) returns without calling `.json()`.

- Site: `src/core/stores.ts`

### T-rest-update-is-patch-not-put

`RestStore.update` sends **PATCH**, not PUT.

An update carries the fields that CHANGED. PUT means "replace the whole record",
which would blank everything the caller did not send — the same mistake as a
non-merging `ArrayStore.update` (`T-array-store-copies-both-ways`), one layer out.

The RESPONSE is checked against the schema and the patch is not: a PATCH body is a
fragment, and a schema sees whole records, so checking `{ seats: 4 }` would fail
every `required` rule for a field this update simply did not mention. What comes
back IS the whole record, and that is what reaches the UI.

The SERVER does the filtering, sorting and paging for a `RestStore` — that is the
point of a remote store, and re-doing it on the client would page through data the
client does not have. So `load` passes the options through as query parameters and
trusts what comes back, believing a server that reports its own total and falling
back to the page length (the honest answer for an unknown corpus) when it does not.

- Site: `src/core/stores.ts`

### T-local-store-is-not-for-bulk-data

`LocalStore` is for saved views, column state and preferences — **NOT for bulk
data**. Web Storage is synchronous and blocks the main thread, holds strings only,
and caps around **5MB**. It exists because "remember this user's saved views" is a
real need that does not deserve a server.

Every access is wrapped, because storage THROWS in a private window, with site data
blocked, and during preview or thumbnail capture (`T-storage-access-throws`). A
store that cannot read behaves as EMPTY rather than taking the page down with it,
and unreadable or corrupt storage reads as empty too — the page must still work when
a user has cleared site data mid-session. A failed `setItem` (quota, or storage
revoked) has nothing useful to do; the in-memory result of the call is still returned
to the caller.

- Site: `src/core/stores.ts`

### T-idb-is-the-only-real-local-store

There are now FOUR local stores, and only one of them holds records:

| | holds | cap | sync? |
|---|---|---|---|
| `ArrayStore` | records, for one page load | memory | yes |
| `LocalStore` | preferences and saved views | ~5MB | yes |
| `SessionStore` | what the app knows about itself | ~5MB | yes |
| **`IdbStore`** | **records, durably** | **disk** | **no** |

`LocalStore` exists because "remember this user's saved views" does not deserve
a server (`T-local-store-is-not-for-bulk-data`). `IdbStore` exists because
"keep ten thousand customers on this device" does not either — and a grouped
grid now needs every matching row in hand at once
(`T-grouped-paging-belongs-to-the-view`), which Web Storage cannot carry.

**AN ABSENT `IdbStore` REJECTS; IT DOES NOT READ AS EMPTY.** This is the one
place the layer deliberately breaks the guard-and-degrade rule every other
storage path follows, and it is the difference between a preference and a
record:

- a missing **preference** is a default, so `LocalStore` reading as empty is the
  right answer and the page carries on
- a missing **record** is data loss, so a store that silently kept nothing and
  reported success would let an app write a customer into a void and call it
  saved

So `#db()` rejects with `IndexedDB is unavailable`, and `IdbStore.available` is
the door a caller checks BEFORE building one. In Node that is false and the
headless test proves every method rejects rather than resolving to a lie.

A failed open is **not cached** — one rejection in a private window must not
poison a session that is later granted storage.

- Site: `src/core/idb-store.ts`
- Site: `test/e2e/reforged-idb-store.spec.ts`
- Site: `test/e2e/reforged-records-persist.spec.ts`
- Site: `test/unit/headless-data-layer.test.mjs`
- Site: `src/data.ts`

### T-idb-open-is-a-handshake-not-a-call

`indexedDB.open()` is a request, a version negotiation and possibly a schema
migration. Three consequences, all of which have bitten every codebase that has
used it:

**1. The connection is held as a PROMISE, not a database.** Twenty concurrent
loads on first paint would otherwise fire twenty `open()` calls and race twenty
upgrade transactions. One promise, shared.

**2. Indexes are built ONLY inside `onupgradeneeded`.** Adding a field to
`indexes` on an existing database does nothing at all — the index is silently
absent and every filter on it quietly reads the whole store. **Bump `version`
when `indexes` changes.** The constructor cannot detect this: it has no way to
know what the last version declared without opening, which is the thing it is
deciding whether to do.

**3. Another tab can ask for a higher version**, and is blocked until this one
lets go. `onversionchange` closes the connection and drops the cached promise,
so the next call re-opens at the new version. A tab that ignores this hangs the
other one indefinitely.

- Site: `src/core/idb-store.ts`

### T-idb-index-narrows-it-never-answers-it

**An index is a PRE-FILTER, never the answer.** `#readRows` uses one to read a
slice instead of the whole store; `applyOptions` then filters, sorts, searches
and pages exactly as it does for every other store.

That is what makes an index safe to add or remove: it changes how much is read,
never what comes back. `reforged-idb-store.spec.ts` asserts this directly, by
running every filter shape against an indexed store and an unindexed one and
demanding identical rows.

`#rangeFor` therefore **refuses far more than it accepts**, because a wrong
range drops matching rows and a missing one only costs time:

| | narrows |
|---|---|
| `eq`, `gt`, `gte`, `lt`, `lte`, `between` on an indexed field | yes |
| an `and` group | by any ONE arm; the rest still run in `applyOptions` |
| an `or` group | **no** — a row matching the second arm may sit outside the first arm's range |
| `contains`, `startswith`, `endswith` | **no** — see below |
| an un-indexed field, a null value, a value IndexedDB rejects as a key | no |

`startswith` looks expressible as `IDBKeyRange.bound(v, v + '\uffff')` and is
not: it would need the store's collation to match `applyOptions`'s
case-insensitive comparison, and it does not. A "Gold" row would be missed by a
search for "gold".

- Site: `src/core/idb-store.ts`

**A STRING takes no range at all.** Added 2026-09-22, after every menu chip in
the Records example returned 0 rows for a single pick while two picks worked.

`applyOptions` lower-cases both sides; an IndexedDB index is byte-exact. So
`IDBKeyRange.only('gold')` seeked past every row holding `'Gold'` — the index
ANSWERED the query instead of narrowing it, which is the one thing this trap
exists to forbid. Two values built an `in`, which takes no range, so it fell
back to a full scan and was right.

The same applies to `gt`/`lt`/`between` on a string, and to an array whose
members are strings. Numbers and dates still narrow.

The `startswith` comment already named the exact cause — "the store's collation
is case-SENSITIVE, applyOptions is not" — for one operator, while the rest of
the switch kept the same mistake.

- Site: `test/e2e/reforged-idb-store.spec.ts`

### T-idb-clear-is-not-a-reset

`clear()` deletes every RECORD. The object store and its indexes survive.

So it is not a way out of `T-idb-open-is-a-handshake-not-a-call`: a changed
`indexes` list still needs a `version` bump, whether or not the store was
cleared first. Deleting the whole database is the only true reset, and this
class deliberately does not offer one — a method that destroys another store's
data because they happen to share a database name is not a method worth having.

- Site: `src/core/idb-store.ts`

### T-idb-bulk-is-one-transaction

2,000 rows through `insert()` is 2,000 transactions and 2,000 `change` events,
and a bound `DataSource` reloads on every one of them. `putAll` is one of each.

**Every `await` that is not a request of this transaction happens BEFORE the
transaction opens.** An IndexedDB transaction auto-commits the moment it stops
having work, and awaiting anything else — a schema's async `validate` — is
exactly that pause. So `putAll` checks every row first, then opens the
transaction and writes without awaiting anything but its own completion.

This is the seam a **sync down from a server** writes through, and what seeds a
store on first run. `replace: true` clears first, for a full refresh where a row
the server deleted must not survive locally.

- Site: `src/core/idb-store.ts`
- Site: `test/e2e/reforged-idb-store.spec.ts`
- Site: `test/e2e/reforged-records-persist.spec.ts`

### T-local-first-then-onward

A view's state lives in THREE tiers, and each exists because the one below it
cannot do that job:

| tier | holds | why not the one below |
|---|---|---|
| Web Storage | the CURRENT view, per tab | it is the only **synchronous** one |
| IndexedDB | every saved view, durably | it is the only one **without a ~5MB cap** |
| a server | views that follow the user | it is the only one **another device sees** |

`T-restore-before-first-load` requires the current view to be readable BEFORE
the first load, or the page queries twice and blinks. IndexedDB is async and can
never satisfy that. So `persistView` keeps its synchronous Web-Storage restore
untouched and `syncViews` sits BEHIND it — this is why adding IndexedDB did not
change `persist-view.ts` at all.

**LOCAL WINS on a clash**, and the merge order in `restore()` is the reverse of
what looks natural — remote first, so local overwrites it:

```js
{ ...remote, ...(await fromIdb()), ...loadSavedViews(page) }
```

A view the user edited on this device and has not pushed yet must not be
replaced by the server's older copy. Reverse those spreads and the user's work
vanishes on the next reload.

**A FAILED PUSH IS NOT A FAILED SAVE.** The durable copy is written on `touch()`
immediately; only the WIRE is debounced. A rejecting server is reported through
`onError` and never thrown, because the view is already saved and the user is
not waiting on the network. Nor is it retried on a timer — a retry loop against
a rejecting server is a request storm nobody asked for, and the next `touch`
carries the same snapshot anyway.

An absent tier is not an error. With no IndexedDB, no storage and no remote —
which is Node — every method still answers, with `{}`.

- Site: `src/core/view-sync.ts`
- Site: `test/e2e/reforged-idb-store.spec.ts`
- Site: `test/unit/headless-data-layer.test.mjs`
- Site: `src/data.ts`

### T-sync-pushes-a-snapshot-not-a-diff

`ViewRemote.push` takes the WHOLE set of a page's views, not a change list.

A diff would need a merge on the server, a conflict policy, and a per-view
version — three mechanisms to solve a problem that does not exist at this size.
A page's saved views are kilobytes, a user edits them rarely, and the last write
winning is what a person expects from "my saved views".

The push is **debounced**, not batched: a burst of edits inside one interval is
ONE request carrying the final state, rather than one request per edit. Default
30 seconds — "fairly regularly", not "immediately", because nothing downstream
is waiting on it.

`ViewRemote` is an interface rather than a `RestStore` because a host's view
endpoint is its own, and the two calls it needs are far narrower than a Store's
five. `restViewRemote` is a ready-made HTTP one (GET to pull, PUT to push, and a
404 read as "nothing saved yet") so that every host does not write the same
twenty lines.

- Site: `src/core/view-sync.ts`

### T-session-store-is-the-third-tier

`SessionStore` is the THIRD TIER of the data layer. A STORE holds records, a DATA
SOURCE holds one query over them, and this holds everything else an app knows about
itself: which theme is on, which customer is selected, which panel is open, who is
signed in.

It was already written — as `StateStore` in `render-view.ts`
(`T-state-store-is-the-session-store`). Same class, addressable name, plus the one
capability an app actually needs from it.

ADDRESSED BY JSON POINTER (`/theme/mode`), not by a flat key, so a subscriber can
watch a BRANCH and hear about anything beneath it. That is what lets one value have
many readers without them knowing about each other.

```
const session = new SessionStore({ theme: { mode: 'light' } });
session.persist('/theme/mode');          // remembered across reloads
session.subscribe('/theme', (v) => …);   // hears /theme/mode too
session.set('/theme/mode', 'dark');
```

A `set` writes THROUGH to storage for the pointer or any ANCESTOR of it: setting
`/theme` must persist a `/theme/mode` that was registered, or a branch write would
silently lose what a leaf write keeps.

- Site: `src/core/session.ts`

### T-session-persist-defaults-shared

`SessionStore.persist` defaults to `shared: true` — **localStorage**, across tabs —
and that is the OPPOSITE of `persistView`'s default
(`T-persist-defaults-per-tab`), deliberately.

A view's state is about one screen in one tab; a session preference is about the
PERSON, and a theme that re-picks itself in a second tab is a bug the reader has to
fix by hand every time.

It RESTORES IMMEDIATELY if a stored value exists, so the caller does not have to
read it back — a theme picked last week should already be on before anything
subscribes. It returns whether it restored, for a caller that wants to tell a
first-time visitor apart from a returning one.

A stored value outlives the code that wrote it, so a shape this version does not
understand is DROPPED rather than half-applied.

This exists because the alternative is what every app was writing: a key constant, a
try/catch to read, a try/catch to write, and a wrapper to keep the two in step. Four
pieces to get right per preference, and the examples were teaching it.

- Site: `src/core/session.ts`

### T-shared-values-two-components-must-agree-on

`icons.ts` holds values that MORE THAN ONE component must agree on. Mostly Font
Awesome glyphs, which is what the filename says and what it started as.
`NON_VALUE_ROWS` joined them at the bottom: it is a SELECTOR, not a glyph, but it is
here for exactly the same reason — two components had each written their own copy and
the copies had drifted. The file is named for its first inhabitant; the RULE is "a
value two components must not disagree about". Rename it if the non-glyph half ever
outgrows the glyphs.

A glyph belongs here when TWO OR MORE components draw the same concept. The sort
arrows are the case it exists for: a column header and a toolbar chip are two views
of ONE sort, and if they disagree about what "descending" looks like the reader is
told the two controls are different things.

They WERE duplicated — a `static icons` on `sherpa-data-grid` and a `static #icons`
on `sherpa-quick-filter-toolbar`, each holding its own copy of the same four
strings. A test existed to catch the drift, which is the clearest possible sign the
duplication was the problem.

A glyph used by ONE component stays in that component. This is a shared vocabulary,
not a dumping ground for every icon in the system.

- Site: `src/core/icons.ts`

### T-non-value-rows-is-one-selector

`NON_VALUE_ROWS` is `'.qf-all, .qf-toggle'` — the rows in a filter menu that are NOT
values. Two checkbox shapes stand for something other than a value, and counting
either one as a pick is a visible bug:

| row | what it is |
|---|---|
| `.qf-all` | Select all — a control OVER the set. Counted in, it reports its own "on" as a picked value and the badge reads one too high with everything ticked. |
| `.qf-toggle` | a folded BOOLEAN filter — it stands for a whole CHIP, and the toolbar reports it as one, not as a value of this menu. |

ONE DEFINITION because the two readers had DRIFTED: `sherpa-menu` excluded both,
while the toolbar and quick-filter excluded only `.qf-all`. Harmless at the time —
`.qf-toggle` rows only ever live in the overflow chip's menu, which the toolbar's
chip loop does not reach — but the two were one refactor apart from disagreeing about
what a pick is.

- Site: `src/core/icons.ts`

### T-pointer-stays-out-of-session

**DO NOT MERGE `pointer.ts` INTO `session.ts`**, though `session.ts` is its only
internal importer and an audit will suggest it.

`pointer.ts` is on the DOM-FREE list in `.eslintrc.json` — a server, a test or an
MCP tool imports it — while `session.ts` reaches for `localStorage` directly and is
browser-only by design. Folding one into the other would move guarded code into an
unguarded file and quietly lose the guarantee. **One file per boundary is the
point.**

It was extracted FROM `render-view.ts` when `SessionStore` needed the same three
functions. They are RFC 6901's, not ours, so there is exactly one right
implementation and no reason for two.

- Site: `src/core/pointer.ts`

### T-pointer-escape-decode-order

RFC 6901 escapes: `~1` is `/` and `~0` is `~`.

**ORDER MATTERS — `~1` first, then `~0`.** Reversed, a literal `~1` in a key would
decode to `~` and then to `/`, which is a different key.

- Site: `src/core/pointer.ts`

### T-pointer-overlap-is-both-directions

`pointersOverlap` is **TRUE EITHER WAY ROUND**, which is the whole subtlety.

A subscriber on `/theme` must hear a write to `/theme/mode` — its branch changed.
A subscriber on `/theme/mode` must hear a write to `/theme` — its value may have
been replaced wholesale. **Checking one direction only leaves half the subscribers
stale.**

That is also why a pointer beats a flat key wherever one value has many readers — a
view definition's `$state` bindings, the session store's subscriptions: a subscriber
can watch a BRANCH and hear about anything beneath it.

- Site: `src/core/pointer.ts`

### T-organise-chips-lead-the-bar

The ORGANISE chips — Group and Sort, from `organise({ group, sort })` — LEAD the
bar and have their own zone and their own events.

They change how rows are ARRANGED, not which rows survive. Mixing them into the
filter set would put them in `active` and make `quick-filter-change` LIE about
what is being filtered. They are also single-choice where a filter chip is a
toggle: a grid is grouped by one column and sorted by one column at a time,
which is why both are `data-menu` chips with SINGLE-select (radio) rows.

Sort offers each column TWICE — ascending and descending — as `field:asc` /
`field:desc`, so one radio row carries the whole answer and the two halves of a
sort can never disagree with each other.

Sort's BODY is tri-state and suspending KEEPS the column — `T-sort-is-tri-state`.
A value-MENU filter chip toggles the same way: ON filters by its picks, OFF
ignores the field WITHOUT clearing them, so `values` is what is applied and
`pickedValues` what is remembered.

- Site: `src/components/sherpa-quick-filter-toolbar/sherpa-quick-filter-toolbar.ts`

### T-unavailable-value-sorts-below-a-divider

`QuickFilterOption.available: false` means still SELECTABLE, but no row carries
it under the filters ALREADY applied — so ticking it changes nothing visible.
Absent means available.

Such a value is sorted BELOW A DIVIDER rather than DROPPED, for two reasons:

- a value that VANISHES reads as a bug in the list
- a user cannot broaden a filter back out through a list that hid the way —
  dropping the unreachable values makes the current filter a one-way door

- Site: `src/components/sherpa-quick-filter-toolbar/sherpa-quick-filter-toolbar.ts`

### T-number-and-date-lead-with-a-range-switch

`QuickFilterDef.kind` picks what a chip's menu holds:

| kind | the menu |
|---|---|
| `values` (default) | checkbox / radio rows built from `options` |
| `number` | a value field, or a two-ended slider when Range is on |
| `date` | a calendar — one day, or two when Range is on |

NUMBER and DATE lead with a RANGE SWITCH: one filter, two shapes ("equals this"
/ "between these two"). **Two separate chips would make the user pick the shape
before knowing which they want**, which is the wrong order — you find out you
need a span while looking at a single value.

`time` joins this list later, as the same calendar with `data-has-time`, NOT as a
new template.

The switch moving the menu between the two modes at runtime is
`T-range-switch-swaps-not-rebuilds`; what it does to the Apply footer is
`T-commit-follows-select-mode`.

- Site: `src/components/sherpa-quick-filter-toolbar/sherpa-quick-filter-toolbar.ts`

### T-toggle-chip-has-no-count

There is deliberately NO `count` in `QuickFilterDef`.

A badge on a plain TOGGLE chip could only mean "how many rows match", and the
host often cannot know that up front — a server-side query has not answered yet
when the bar is built, so the badge would either be blank or wrong on first
paint.

The badge is reserved for **"how many VALUES are picked"**, which a MENU chip
sets itself from its own ticked rows and therefore always knows.

- Site: `src/components/sherpa-quick-filter-toolbar/sherpa-quick-filter-toolbar.ts`

### T-values-reports-on-chips-in-one-shape

`values` reports ON chips ONLY, so a caller can iterate every entry as something
to filter by with NO on/off check of its own. An OFF chip keeps its picks — they
are remembered, not applied — and `pickedValues` is the door to those.

A SINGLE-select chip still reports an ARRAY. One shape for both modes, so a
caller never has to branch on the chip's select mode; a DATE chip reports its
calendar's day as a single-entry array for the same reason, and a range will
report two.

The SETTER is the parity half and REPLACES the whole set: a chip the definition
does not name goes OFF, but its picks survive. It is SILENT, or a host routing
`quick-filter-change` into its query applies the filter twice. A value naming no
option is IGNORED — a saved view outlives the options it was made from
(`T-apply-degrades-never-throws`). Before the setter existed, a view could narrow
the DATA while the bar said nothing was filtered, and **a filter nobody can see
is a filter nobody can undo.**

- Site: `src/components/sherpa-quick-filter-toolbar/sherpa-quick-filter-toolbar.ts`

### T-every-chip-menu-gets-clear-and-search

EVERY chip menu gets CLEAR, as the icon button in the menu's HEADER.

It used to be a self-relabelling "Select all / Clear all" ROW, which **MOVED
under the reader** depending on what was ticked, and which left single-select
menus with no clear at all. One action, one place. `T-select-all-is-not-a-value`
is the row that remains, and why its label never moves either.

A PERSISTENT chip gets none: it holds exactly one value, so there is nothing a
clear could leave it at — `T-persistent-chip-is-a-selector`.

EVERY value menu also gets a SEARCH. A filter's values are the user's own data —
regions, owners, plans — so the list is as long as their data is, and scrolling a
hundred owners to find one is the case it exists for. A CALENDAR menu is the
exception (`T-calendar-header-has-no-heading`).

- Site: `src/components/sherpa-quick-filter-toolbar/sherpa-quick-filter-toolbar.ts`

### T-remove-is-opt-in-and-a-footer-button

A chip menu's "Remove" is a FOOTER BUTTON, not a list row: a CALENDAR menu has
no list at all, and a button never SCROLLS AWAY. FILTER chips only — never the
organise chips or the Add chip.

It is **OPT-IN (`def.removable`) because it DELETES the chip**, and the safe
default for a destructive action is to keep it. A PERSISTENT chip is never
removable, because removing it would strand the page —
`T-persistent-chip-is-a-selector`.

It emits `menu-select` with `value="remove"`, exactly what the old ROW emitted,
so `#onMenuSelect` was unchanged by the move and a host listens for ONE event
whichever shape its menu is — `T-today-and-remove-are-menu-chrome`.

- Site: `src/components/sherpa-quick-filter-toolbar/sherpa-quick-filter-toolbar.ts`

### T-remove-matches-the-tag-not-the-class

`#onMenuSelect` finds the chip on the EVENT PATH, not on `target`
(`T-composed-path-not-target`), and the path still holds it because the menu is
SLOTTED INTO the chip:

```
sherpa-menu › slot › span › div.chip › #shadow › sherpa-quick-filter.chip › …
```

**Matched on the TAG, not on `.chip`.** The quick-filter's OWN shadow root
contains a `<div class="chip">` too, and it comes FIRST on the path — so matching
the class found that inner div, which carries no `data-id`, and **every remove
silently bailed.**

- Site: `src/components/sherpa-quick-filter-toolbar/sherpa-quick-filter-toolbar.ts`

### T-custom-chips-are-reported-separately

A CUSTOM chip's value was TYPED rather than picked — the data grid's column
filters are the case. So it carries no rows to read back, and its id plus its
on/off state are the whole of what it says.

It appears in NEITHER of the other two lists on `quick-filter-change`:

- `active` skips anything with a menu, so the caret draws
- `values` reads TICKED ROWS, which a custom chip has none of

Without the `custom` entry a host had **no way to see one at all** — turning one
OFF said nothing, and the column it came from stayed filtered and lit. A host
that put one on the bar reads `customFilters` to learn it has been switched off,
and clears whatever set it.

That is why `addCustomFilter` exists as its own door: a filter narrowing the view
with no chip to say so is one nobody can undo. The label arrives WHOLE ("Contains:
ana") because the value is not one of a list, so the chip carries NO menu. The
same `id` REPLACES rather than adding a second, a null/empty `value` removes, and
`filter-remove` carries the id back so the grid can clear that column's menu
(`T-grid-clear-from-outside-is-silent`).

- Site: `src/components/sherpa-quick-filter-toolbar/sherpa-quick-filter-toolbar.ts`

### T-favourite-star-swaps-its-glyph

The favourite STAR's `data-favourite` attribute is the state and CSS paints from
it — but the GLYPH swaps too, outline → solid.

That is not decoration: the state has to survive for **anyone who cannot tell the
brand purple from the default ink**, so colour alone cannot carry it.
`aria-pressed` carries the same fact to a screen reader, which is why the star is
a TOGGLE button rather than a plain one.

- Site: `src/components/sherpa-quick-filter-toolbar/sherpa-quick-filter-toolbar.ts`

### T-clear-all-resets-organise-too

`clearAll` is what the undo button means: not "undo the last thing" but **"back
to no filters"**.

ORGANISE CHIPS ARE INCLUDED. A grouping is as much a view state as a filter, and
leaving them behind made the reset LOOK BROKEN — the reader pressed reset and the
grid was still bunched.

It fires the three change events AFTERWARDS, not per chip, so a host re-queries
once per concern rather than once per chip cleared.

A PERSISTENT chip survives the reset, PICK INCLUDED: resetting the filters does
not mean leaving the view you are in — `T-persistent-chip-is-a-selector`.

- Site: `src/components/sherpa-quick-filter-toolbar/sherpa-quick-filter-toolbar.ts`

### T-organise-glyphs-are-named-not-inline

The organise glyphs mirror the Figma icons page (`group`, `sort-none`,
`sort-ascending`, `sort-descending`) and are FA APPROXIMATIONS of the Apex
artwork — there is no local icon set on this branch.

**NAMED, never inline**, because three places set a sort glyph and DRIFTED: the
off-state once wore the ASCENDING ARROW, which made a suspended sort look
identical to a live one.

The sort names are `wide-short` / `short-wide`, NOT `a-z` / `z-a`: a Sort chip can
order a NUMBER column, where an A-Z badge reads as wrong.

Group and the three sort states come from `core/icons.ts`, **not from a copy kept
here.** They WERE copied here, with a comment to keep the two in step and a spec
to guard the pair — the long way round to having one copy. A sort chip and a
column header are two views of ONE sort, so they read one map.

The VIEW selector's icon is the exception and stays HERE, because only this
component draws it. It is FIXED, like Group's and Sort's: it says "you are looking
at a saved view" on every screen, so it must not borrow the page's icon — the
examples each passed their own nav glyph, which made one control look like five.

- Site: `src/components/sherpa-quick-filter-toolbar/sherpa-quick-filter-toolbar.ts`

### T-grid-group-drops-the-column

`data-group-field` bunches rows by one column, each bunch under a collapsible
group row (Figma Grid Cell `Type=group`).

**The grouped column DROPS OUT of the header and the body** — its value IS the
heading, so drawing it in every row of a group repeats the heading once per row.

The two sort attributes then mean two different things at once:

| | orders |
|---|---|
| groups | always A→Z, unless `data-sort-field` names the GROUPED column |
| rows | `data-sort-field` / `data-sort-direction`, WITHIN each group |

So when `data-sort-field` names the same column as `data-group-field`,
`data-sort-direction` orders the GROUPS. There is nothing left for it to order
inside one — every row in a group holds the same value for that column.

The two opt-in features that mirror the Figma Grid Cell (926:34253) are
`data-selectable` (a leading checkbox column, a select-all in the header, and
`selection-change`) and `data-filterable` (a secondary header row of per-column
filter inputs, and `filter-change`).

- Site: `src/components/sherpa-data-grid/sherpa-data-grid.ts`

### T-advanced-checkbox-is-a-snapped-pair

`Checkbox - Advanced` is **two bordered boxes touching**, not one box with a
button beside it. Figma's own numbers say so:

| | corners | border left / right |
|---|---|---|
| `Wrapper - Checkbox` | `4 0 0 4` | 0.5 / **0.25** |
| `Button` | `0 4 4 0` | **0.25** / 0.5 |

Rounded on the outer edges, square where they meet, and **0.25 on each side of
the seam** — two halves of one hairline rather than two full strokes. Drop the
wrapper and you get a checkbox with a detached button, which is what the first
attempt shipped.

The wrapper is a real element with `.sherpa-border-edges`, and `.group` carries
`.sherpa-snap-group`. Three things about that are easy to get wrong:

**The joining is BY POSITION, not by `[data-snap]`.** That attribute is a plain
selector in `tokens.css`, which reaches the document and never a shadow root
(`T-datasnap-not-in-shadow`). It stays on each half as the honest description;
`.sherpa-snap-group` writes the four corner variables, and those DO cross a
shadow boundary — which is how the caret's inner `sherpa-button` gets its
square inner corner without a selector reaching into it.

**The `<slot>` must be OUTSIDE the group.** `.sherpa-snap-group > :last-child`
rounds the last child, and a slot sitting there took that role — leaving the
caret square on both edges and the pair looking clipped. The menu is a popover
in the top layer anyway, so it has no business in a layout group.

**The gap is 0 and FLUSH.** `--sherpa-structure-space-snapped` is an alias for
`space/none`; the seam is thinned by the two 0.25 weights, never by a negative
margin or an overlap. `T-two-snapped-tokens` says this and has had to say it
more than once.

A plain checkbox is untouched: `.box` is `display: contents` until
`data-advanced` is set, so the wrapper generates no box at all.

- Site: `src/components/sherpa-select-checkbox/sherpa-select-checkbox.css`
- Site: `test/e2e/reforged-data-grid.spec.ts`

### T-advanced-checkbox-widens-the-select-column

The grid's header checkbox is `Checkbox - Advanced` (Figma 1334:8173): the same
box, plus a caret whose menu carries the selection scenarios. It is **48 wide
in Figma and 56 rendered**, against a selection column of **32**.

So the caret drew off the end of its cell and sat hidden behind the first data
column — visible in a screenshot, invisible to every DOM assertion, because the
element was there and `display: flex` the whole time.

The column follows the control: `--_select-w` is 32 normally and 60 when the
variant is on. The body's plain checkboxes simply centre in the wider cell.

**KEYED OFF AN ATTRIBUTE ON THE HOST, not `:host(:has(…))`.** That selector
does not PARSE — `sherpa-container`, `sherpa-barchart` and `sherpa-gauge-chart`
each carry their own note about it. `#render` writes `data-advanced-select` on
the grid beside the `data-advanced` it writes on the checkbox, and CSS reads
the one it can see.

The variant itself only appears when there ARE rows: "Select all" against an
empty grid is a control that does nothing.

- Site: `src/components/sherpa-data-grid/sherpa-data-grid.css`
- Site: `test/e2e/reforged-data-grid.spec.ts`

### T-select-all-is-the-visible-rows

**`page` and `all` differ only when the grid is paging**, and neither reaches a
record a filter is hiding.

| scenario | takes |
|---|---|
| Select all on page | the rows the body DREW — one page when the grid pages |
| Select all rows | every row that survives the current filters |
| Clear selection | nothing |

On an unpaged grid the first two are the same set, and offering both anyway is
more honest than hiding one: a reader who pages through 4 pages needs to know
which of the two they are getting, and a grid that quietly merged them would
teach the wrong thing the first time paging was switched on.

**Neither is "every record in the store."** A selection the reader cannot see
is one they cannot undo — the same rule `#onSelectAll` has always followed, and
the reason it walks `#visibleRows()` rather than `#rows`.

The advanced checkbox REPORTS the scenario and the grid carries it out: the
component knows about one checkbox, and "all rows" means nothing to it. The
grid owns the rows, so the grid decides.

- Site: `src/components/sherpa-data-grid/sherpa-data-grid.ts`
- Site: `test/e2e/reforged-data-grid.spec.ts`

### T-grid-actions-are-declared-once-used-twice

**One list of actions, two surfaces that draw it.**

A grid's row menu and a host's bulk toolbar offer the same things, so they are
declared once — in `populate()`, beside the rows they act on:

```js
populate({
  columns, rows, key: 'email',
  actions: [
    { id: 'edit',   label: 'Edit',   icon: 'fa-regular fa-pen' },
    { id: 'delete', label: 'Delete', icon: 'fa-regular fa-trash',
      multi: true, danger: true },
  ],
})
```

A toolbar that kept its own copy would disagree with the menu the first time
either changed, and nothing would catch it. So the toolbar asks:

```js
grid.actionsFor(count)   //  1 row  → every action
                         //  2+     → only the `multi` ones
                         //  0      → none
```

**`multi` is the field that earns its place.** Deleting five customers is one
action; editing five is not. Without it a bulk bar either offers an edit that
cannot work, or the host re-derives which actions are safe — which is exactly
the deriving-what-you-do-not-own bug in `T-grid-reports-never-combines`.

**The grid REPORTS and does not act.** `row-action` carries
`{ id, records }`; removing the record is the store's job and the host's
decision. A grid that deleted the row itself would be the same mistake wearing
a different hat.

The column is revealed by the DATA, not by an attribute a host must remember:
`populate()` sets `data-actions` when the list is non-empty, and CSS selects on
it. A grid that declares no action looks exactly as it did before the feature.

- Site: `src/components/sherpa-data-grid/sherpa-data-grid.ts`
- Site: `test/e2e/reforged-data-grid.spec.ts`

### T-grid-actions-pin-to-the-trailing-edge

The actions column is the **trailing twin of the selection column**: same fixed
width, same come-and-go `<col>`, opposite edge.

Two things differ, and both are simpler than the leading side:

**It needs no measured offset.** The leading block can be two columns deep — a
selection cell, then the first data column — so the second must clear the
first's MEASURED width (`T-grid-pin-offset-is-measured`). Only one column ever
pins to the trailing edge, so `inset-inline-end: 0` is the whole answer.

**Its cell is MOVED, not created.** The template already holds it; `#renderBody`
appends the data cells between the two pinned ones, then re-appends the actions
cell to put it last. `appendChild` on a node that is already a child re-parents
it — which is why there is no `createElement` here, and why the rule about every
element existing in the template from the start still holds.

A group row's `colSpan` counts it: `columns + 1 + (actions ? 1 : 0)`. One that
stopped short would leave the pinned cell floating over a gap.

- Site: `src/components/sherpa-data-grid/sherpa-data-grid.css`
- Site: `src/components/sherpa-data-grid/sherpa-data-grid.ts`

### T-one-actions-menu-for-every-row

**One `<sherpa-menu>` serves every row.** A hundred rows would otherwise stamp a
hundred popovers into the top layer, each with its own listeners, for a menu
only one of which can ever be open.

So the menu is a single element in the template, outside the body, and the row
it belongs to is remembered as a RECORD — not an index, because one menu is
shared and an index stops meaning the same thing after a sort.

Two consequences worth knowing:

- the menu is **re-stamped on each open**. The list is the same today, but a
  per-row filter would live here, and re-stamping costs one clone of a handful
  of rows.
- the trigger click is **delegated from the body**, because the body is replaced
  on every render and a per-trigger listener would be re-bound a hundred times.
  The menu itself is outside the body, so it gets a direct listener.

**`#onRowClick` guards the actions cell itself**, rather than relying on
`stopPropagation` in the actions handler. Both listeners sit on `.body`, so they
fire in REGISTRATION order and `#onRowClick` is first — stopping the event later
would be too late, and `row-click` would already have gone out. The
`stopPropagation` stays anyway, for a HOST listener on the grid, which has no
such guard.

- Site: `src/components/sherpa-data-grid/sherpa-data-grid.ts`
- Site: `test/e2e/reforged-data-grid.spec.ts`

### T-grid-collapsed-group-is-one-slot

**A SHUT group is ONE line on screen, so it costs ONE slot of the page.**

A page of 25 used to fill with 25 RECORDS. Group by tier, shut Gold, and the
reader got a panel holding one heading and twenty-four hidden rows — a page that
looks empty, with a pager insisting there are ten more like it. The rows were
there; CSS was hiding them; the count had already been spent.

So the grid cuts the page itself, in SCREEN LINES:

| | costs |
|---|---|
| a shut group | 1 — the heading, and nothing for its rows |
| an open group | 1 + one per row |

`#pageStarts` walks the visible rows once and records the index each page opens
at. A page is then a plain slice, and `data-index` stays an index into the FULL
visible list (`#renderBody` adds the slice's `offset`) — so selection, row-click
and `#syncFocused` keep resolving against the same list they always did. Change
that and a click on page 2 returns a page-1 record.

**A group split by a page boundary redraws its heading**, because a page that
opened mid-group with no heading would not say which group it was showing. The
`group-count` is the group's REAL size across every page, not the part this page
drew — the heading answers "how many are in Gold", not "how many fit here".

Only an OPEN group can be split. A shut one is a single line and cannot be.

**Folding RE-CUTS the page**, so `#toggleGroup` calls `#renderBody()` and not
just `#syncGroupVisibility()`. Shutting a group frees slots and the next rows
move up onto this page; opening one pushes the tail off. A visibility sync alone
leaves the hole this trap exists to remove — and because the body is replaced,
the ticks, the select-all and the focus tint all have to be re-derived after it.

None of this runs ungrouped (`#paginates`): there the store's window IS the page,
and slicing it again would hide rows nobody folded.

- Site: `src/components/sherpa-data-grid/sherpa-data-grid.ts`
- Site: `test/e2e/reforged-data-grid.spec.ts`

### T-grouped-page-change-publishes-without-loading

**A page change while GROUPED needs no load — and asking for one loses it.**

The chain, which took a live app to find:

1. `#loadOptions` sends no `skip`/`take` while grouped, because the grid cuts
   the page itself (`T-grouped-paging-belongs-to-the-view`)
2. so `#stateKey()` — which is `JSON.stringify(#loadOptions())` — is IDENTICAL
   for page 1 and page 2
3. so the no-op load guard skips the load, correctly: the question really has
   not changed
4. and `#publish()` lives inside `load()`, so it never runs

The pager moved, `data-page` on the grid stayed at 1, and the body kept
drawing the same rows. No error, nothing in the console, and the ungrouped path
worked perfectly — which is what made it look like "pagination is broken"
rather than "grouped pagination is broken".

`setPage` now publishes directly when a group is set, and schedules a load only
when one is not. The guard is right; what was wrong is that a VIEW-level change
was being routed through a DATA-level mechanism.

**The same shape can bite any state that is the view's and not the store's.**
If a future value changes what is DRAWN without changing what is FETCHED, it
needs this branch too — `#stateKey` will not see it.

- Site: `src/core/data-source.ts`
- Site: `test/e2e/reforged-data-source.spec.ts`

### T-grouped-paging-belongs-to-the-view

**STORE paging and VISUAL paging are not the same thing**, and a grouped view is
where they come apart.

`skip`/`take` counts RECORDS. A page of screen lines counts LINES, and which
lines exist depends on which groups the reader has folded — a fact that lives in
the grid's `#collapsed`, has never been sent to a store, and should not be.

So while `group` is set, `DataSource`:

| | |
|---|---|
| `#loadOptions` | sends NO `skip`/`take` — every matching row goes to the grid |
| `totalPages` | returns what the grid REPORTED (`#viewPages`), not `total / size` |
| post-load re-clamp | is skipped — re-loading would ask the identical question |

The grid reports with `grid-pages-change` (`{ pages, page }`). It is a REPORT in
the `T-grid-reports-never-combines` sense: the host still owns `data-page`, and
the grid never writes it. The source clamps the current page against the new
count and re-publishes; it does NOT load, because the rows in hand are already
every matching row.

`#viewPages` is cleared by `setGroup` and by `setState`'s group branch — a count
measured against the old grouping describes groups that no longer exist.

The cost is honest and bounded: a grouped view holds the whole result set in the
browser. That is the price of letting the reader fold, and it is the same price
the grid's own sort and column filters already pay.

- Site: `src/core/data-source.ts`

### T-grid-untyped-column-gets-no-filter-button

The filter CHIP is in the header template already; JS adds only the MENU, because
only JS knows the column's type and name.

`text`, `number` and `date` each get one. **Any other type gets NO button at
all** — an affordance that opens nothing is worse than none, so a column the grid
cannot build a control for shows no control rather than a dead chip.

This is why `#addColumnFilter` is the one path that writes a menu, and why a
re-render uses it too (`T-grid-read-without-write-is-half-an-api`).

- Site: `src/components/sherpa-data-grid/sherpa-data-grid.ts`

### T-grid-empty-clause-is-null

`#readColumnFilter` returns NULL for an EMPTY value as much as for a cleared
menu.

"Contains nothing" matches every row, so applying it would light the column and
change the view not at all — **which reads as the filter being broken**, not as a
filter that does nothing.

A RANGE needs BOTH ends for the same reason: one end alone is a "greater than"
the reader did not ask for. `T-grid-number-clause-must-coerce` is the other half
of reading a number column safely.

- Site: `src/components/sherpa-data-grid/sherpa-data-grid.ts`

### T-grid-toolbar-chip-borrows-the-menu

A reader who sees "Name · Contains: ana" on the toolbar bar will click it to
change it — so the toolbar chip BORROWS this grid's column menu rather than
building a second one. Same controls, same Apply, same Remove, and **no way for
the two to disagree.**

```js
qft.addEventListener('quick-filter-click', (e) => {
  const id = …;                       // 'col:name'
  grid.openColumnFilter(id.slice(4), e.target);
});
```

`openColumnFilter` takes the element to ANCHOR against, and the menu measures its
box: a CSS anchor name cannot cross the shadow boundary between the toolbar chip
and this grid — `T-anchor-cross-root`.

The chip is reused for its MENU, never for its event vocabulary —
`T-grid-chip-vocabulary-stops-here`.

- Site: `src/components/sherpa-data-grid/sherpa-data-grid.ts`

### T-grid-clear-from-outside-is-silent

A toolbar chip is REMOVABLE, so a column filter can come off at either end —
and removing it there has to reach back into the grid, **or the column stays lit
over a clause the bar no longer shows.**

```js
toolbar.addEventListener('filter-remove', (e) => {
  const field = e.detail.id.replace(/^col:/, '');
  grid.clearColumnFilter(field);
});
```

It does NOT re-fire `column-filter-change`: the caller is the one who asked, so
telling them what they just did would be an echo, and a host that routes the
event back into its query would clear it TWICE. Same silence as `select()` and
`setColumnFilter` — `T-grid-read-without-write-is-half-an-api`.

Pass NOTHING to clear every column at once, which is what a toolbar's "clear
all" means.

- Site: `src/components/sherpa-data-grid/sherpa-data-grid.ts`

### T-write-icon-is-protected-not-private

`writeIcon` is PROTECTED rather than private, and that is deliberate: `as: 'icon'`
cannot cover a RUNTIME target choice (`sherpa-nav`, `sherpa-nav-item`), one glyph
written into TWO slots (`sherpa-quick-filter`) or `sherpa-app-header`'s own
`#sync`. Those four reach for this method.

So: **reach for THIS; never build an `<i>`.** Four components had built a child
`<i>` with `createElement`, which CLAUDE.md forbids outright — classes go on the
TARGET ITSELF instead. Only previously-applied `fa-*` classes are stripped, so a
re-render never accumulates two icons.

The two accepted value forms are `T-icon-value-takes-two-forms`.

- Site: `src/core/sherpa-element.ts`

### T-clone-item-is-for-two-destinations

`cloneItem` exists for a component that cannot use a SINGLE container, which is
why `renderItems` alone was not enough.

`sherpa-transfer-list` is the case: each item goes to the source pane or the
target pane depending on its own `selected` field, so there is no one container
to stamp into.

The row's FIELDS are still declared on the prototype (`T-item-template-cannot-compute`);
only the CHOICE OF PARENT stays in code. That is the boundary — a second reason to
reach for this instead of `renderItems` would mean the declarative vocabulary is
missing something.

- Site: `src/core/sherpa-element.ts`

### T-persist-view-returns-a-teardown

`persistView` restores on the way IN, then saves on every change:

```js
const off = persistView('records',
  { source, elements: { grid } },
  { grid: () => ({ setColumnFilter: …, select: [grid.selectedKeys] }) });
```

It returns a function that STOPS SAVING, the same way `bind()`'s does — a caller
should not have to remember which of our functions hand back a teardown and
which do not. `T-signal-not-a-teardown-list` is the component-side form of the
same rule.

The third argument is per-element and is a FUNCTION, evaluated at save time, so
it reads live state rather than whatever was true when the wiring ran.

- Site: `src/core/persist-view.ts`

### T-capture-is-the-save-button

`captureView` reads the current state BACK into a definition — the other half of
applying one.

It is what a "Save this view" button calls, and what an AGENT calls to describe
what it is looking at: **a saved view is useless if only a developer can write
one.** That is the same parity argument as `T-grid-read-without-write-is-half-an-api`,
read from the other end.

```js
const snapshot = captureView({ source, elements: { grid, chart } });
captureView({ elements: { grid } }, { grid: ['columnClause', 'selectedKeys'] })
```

Omitting the per-element `reads` map reads NOTHING from that element — see
`T-capture-reads-only-what-is-named`.

- Site: `src/core/persist-view.ts`

### T-on-view-picked-replaces-hand-wiring

`onViewPicked` is the listener BOTH example pages had written by hand, in one
place:

```js
const off = onViewPicked(header, VIEWS, { source, elements: { grid } });
```

It returns an unsubscribe, like `bind()` and `persistView`, so a view that leaves
the DOM stops listening — see `T-persist-view-returns-a-teardown` for why every
one of these hands a teardown back.

Two callbacks split the work: `onIncomplete` REPLACES the default warn
(`T-apply-degrades-never-throws`), and `after` does the page-specific half.

- Site: `src/core/persist-view.ts`

### T-save-view-as-returns-the-whole-set

`saveViewAs` returns the FULL view store, not just the view it saved, so a caller
can re-populate the View chip in the same breath — **a saved view nobody can pick
is not saved.**

```js
const views = saveViewAs('dashboard', 'Q3 capacity',
  { source, elements: { header } }, { header: ['values'] });
```

`reads` names which of each element's properties are view state, exactly as
`captureView` takes it (`T-capture-reads-only-what-is-named`). The id is DERIVED
from the label, so saving "Q3 capacity" twice UPDATES it rather than making a
second — `T-derived-id-makes-resave-an-update`.

It persists SHARED, unlike `persistView`, which defaults per tab — see
`T-persist-defaults-per-tab`.

- Site: `src/core/persist-view.ts`

### T-view-state-lives-in-one-object

The file header's worked example is the whole shape of the module in five lines,
and it is kept here rather than in the source so the source starts at its first
declaration:

```js
const sales = new DataSource({ store });
sales.bind(grid);                        // rows in, sort/filter out
sales.bind(toolbar);                     // chips in, filter out
sales.bind(pager);                       // page in, total out
sales.bind(chart, { readonly: true });   // sees the data, never steers it
```

Every control bound to one source reads and writes the SAME view state, which is
why `T-one-comparator-one-source` holds. `readonly` is the blunt form of
`T-ignore-is-the-scalpel`.

- Site: `src/core/data-source.ts`

### T-result-is-the-hosts-half

`rows`/`total` are what a COMPONENT needs. `result` is for a HOST: a schema's
`dropped` and `issues` are only readable here (`T-dropped-rows-must-be-countable`
is why they exist at all).

It returns a COPY of the container, so a caller cannot steer the source by
writing to the object it was handed.

- Site: `src/core/data-source.ts`

### T-calendar-view-is-not-the-figma-type

`sherpa-calendar` carries TWO axes that both look like "which calendar is this",
and only one of them is Figma's.

`data-type` (`single | range`) mirrors the Figma Calendar `Type` axis. `single`
holds one day in `data-value` as `YYYY-MM-DD`; `range` is a two-click
start→end selection holding `data-value-start` / `data-value-end`, with the days
between marked `data-in-range` and the two ends `data-range-end`.

`data-view` (`day | month | year`) is the CODE'S OWN zoom mechanism — the
equivalent of the Figma Calendar's Grid-collection swap, i.e. which grid the
component shows. It is **NOT** the Figma Type axis and is intentionally kept.
Clicking the header label zooms out (day → month → year); picking a month or
year zooms back in. The prev/next arrows then step by a month, a year, or a
decade to match. All three views share ONE cell template and CSS shows whichever
view is active.

`hasTime` (`data-has-time`) mirrors the Figma boolean and shows a native
`<input type="time">` in the footer; `data-value` then carries
`YYYY-MM-DDThh:mm` in single mode, while the grid still keys off the date part.

- Site: `src/components/sherpa-calendar/sherpa-calendar.ts`

### T-range-header-names-both-months

A RANGE calendar draws TWO months, so its stepper label has to name both.

Stepping the header moves the PAIR, so a label reading only the left month would
say the wrong thing about half of what is on screen — and there is no second
header to correct it, because the two months share one grid (see
`T-two-months-share-one-grid`).

The year is stated ONCE when the two months share it, which is eleven months in
twelve: `January – February 2026`, and only `December 2025 – January 2026` at the
turn. Printing it twice every time reads as two separate calendars.

- Site: `src/components/sherpa-calendar/sherpa-calendar.ts`

### T-embedded-footer-needs-a-public-verb

`sherpa-calendar.today()` is PUBLIC, and it looks like it should be private —
`#onToday` right beneath it does the work and nothing in this component calls the
public one.

The reason is EMBEDDING. When a calendar is embedded, the Today button is not in
this shadow root at all: it belongs to the HOST's footer, because Figma's
Calendar footer puts Today in the Container Footer's `left` slot. The host has to
be able to reach the behaviour, and the only alternative is reaching into private
state.

Same shape as `T-slot-assigns-direct-children-only` — an embedded calendar's
chrome lives on the other side of the boundary, so anything that chrome drives
needs a door.

- Site: `src/components/sherpa-calendar/sherpa-calendar.ts`

### T-nav-item-writes-to-both-rows

A `sherpa-nav-item` template holds **TWO** activation rows — a `<button>` row and
an `<a href>` row — and CSS shows exactly one, via `:host([data-href])`.

So `this.$('.label')` / `this.$('.badge')` returns only the FIRST, which on a
LINK row is the HIDDEN `<button>` row. The bug it caused was invisible in the
best way: the visible badge stayed empty while a zero-width offscreen one held
the text, and `highlight()` appeared to do nothing on link rows because it had
marked the hidden label.

**Every write to a row's content goes to `$$`, not `$`** — the icon, the label,
the badge, the promo heading, the promo description, the `aria-current`, and the
search `<mark>`.

The one that CANNOT go through the shared `setAll` helper is the icon: icons are
Font Awesome class lists (`fa-solid fa-house`), so writing one as `textContent`
renders the class names. It goes through `writeIcon()` per element instead.

- Site: `src/components/sherpa-nav-item/sherpa-nav-item.ts`

### T-custom-highlight-not-painted-in-shadow

`sherpa-nav-item.highlight()` uses **TWO** mechanisms for one search hit, and
that is deliberate — do not delete either.

1. **The CSS Custom Highlight API** — the right tool, and the one Will asked for.
   Each row registers its OWN uniquely-named highlight (`sherpa-item-<n>`) and
   adopts the matching `::highlight()` rule into its OWN shadow root, because a
   single SHARED `Highlight` holding ranges from many shadow trees paints
   nothing.
2. **A real `<mark>` around the matched text** — the VISIBLE result today.

Verified on **Chromium 153**: the engine does not paint custom highlights for
text inside a shadow root, *however the highlight is registered*. A hard-coded
`::highlight()` paints on light-DOM text and is silently ignored here. `<mark>`
is also the semantic element for a search hit, so assistive tech announces it.

When the engine gains shadow-DOM highlight painting, (1) lights up for free and
(2) can be dropped without touching a caller.

The `::highlight()` rule paints the TRANSPARENT ACTIVE purple
(`--sherpa-theme-surface-active-transparent`, `#c046ff4d`) on
`--sherpa-theme-content-body-base` (`#0c0b11`) — the same tint as the `<mark>`
fallback in the CSS, so whichever one the engine paints, the hit looks identical.

`onDisconnect` deletes the row's entry so no orphan is left in the
document-level registry.

- Site: `src/components/sherpa-nav-item/sherpa-nav-item.ts`

### T-hiding-a-series-rescales-the-axis

Hiding a series from a chart legend is a **RE-RENDER**, never a `display: none`
on the drawn `<g>` / bar / slice.

The scale is derived from the VISIBLE values, so a hidden series left in the
extent keeps the axis stretched to data nobody can see and squashes every
remaining mark against the bottom of the canvas. The three charts each say it in
their own terms:

- **line chart** — the y-extent covers only the visible series, so hiding one
  re-scales the axis.
- **barchart** — the y-max comes from the bars that are LEFT, so the rest use the
  full height. The axis flag is counted from the SHOWN bars too: hiding every
  category must take the axis with them, not leave a scale labelling nothing.
- **donut** — the total covers only the visible slices, so the ring always
  CLOSES. A donut reads as parts OF A WHOLE, so a hole where a slice used to be
  would misreport the remaining proportions.

In all three the mark's COLOUR INDEX is still derived from its ORIGINAL position,
and the skip happens AFTER indexing — so unhiding a mark brings back the same
hue rather than shifting every colour along the ramp. The barchart carries the
original index onto the node as well, so `bar-click` still names the datum the
caller gave it even when earlier categories are hidden.

Fresh data CLEARS the hidden set in every one of them: the old indices point at
different marks, so a stale hide would silently drop the wrong category.

- Site: `src/components/sherpa-line-chart/sherpa-line-chart.ts`
- Site: `src/components/sherpa-barchart/sherpa-barchart.ts`
- Site: `src/components/sherpa-donut-chart/sherpa-donut-chart.ts`

### T-hidden-set-is-view-state-and-replaces

`hiddenSeries` / `hiddenBars` are read **AND** write, and that is the whole point.

Clicking a legend swatch to hide a series is real VIEW STATE: it is what this
reader wants to look at, and it belongs in a saved view beside the filter and the
sort. Both were a GETTER ONLY, so that choice could be read and never put back —
half an API. Same shape as `T-grid-read-without-write-is-half-an-api`.

The setter **REPLACES** rather than adds, like every other restore in this
library: a saved view says "this is what is hidden", not "also hide these". An
empty array shows everything.

Out-of-range indices are **KEPT** rather than filtered — the data may not have
arrived yet, and an index that matches nothing hides nothing. Only non-integers
and negatives are dropped.

- Site: `src/components/sherpa-line-chart/sherpa-line-chart.ts`
- Site: `src/components/sherpa-barchart/sherpa-barchart.ts`

### T-nan-is-the-not-given-sentinel

A bound that is DERIVED when absent takes `NaN` as its `num()` default, not `0`
and not a static number. There is nothing to fall back to: an absent
`data-min`/`data-max` means "work it out from the data", and only `NaN` says
that without also being a legal value.

`num()` is also what makes it safe. It treats an **EMPTY** attribute as absent,
where `Number('')` is `0` — which used to pin a line chart's floor to 0 the
moment a template emitted `data-min=""`. The same mistake in
`sherpa-pagination` made `data-page-size="0"` read back as 0 and hand the caller
a divide-by-zero, which is why that one passes `min: 1` as well.

Sites and their derived fallbacks:

- **line chart** — `min` falls back to `Math.min(0, …all)`, `max` to
  `Math.max(1, …all)`, over the VISIBLE series only.
- **barchart** — an absent (or non-positive) `data-max` is
  `Math.max(1, …shown)`.
- **pagination** — an absent `data-page-size` is chosen from the options list,
  preferring 25.

- Site: `src/components/sherpa-line-chart/sherpa-line-chart.ts`
- Site: `src/components/sherpa-barchart/sherpa-barchart.ts`
- Site: `src/components/sherpa-pagination/sherpa-pagination.ts`

### T-gridlines-run-to-the-top-label

The gridline loop runs to `bands` **INCLUSIVE**, so the TOPMOST axis label gets a
line, and starts at `i = 1`, so the bottom one does not.

It used to stop at `bands - 1`, on the reasoning that 0% and 100% are the plot's
own edges. Only the BOTTOM edge is actually drawn (the x-axis rule), so the
highest value was the one label on the axis with nothing beside it. `i = 0` stays
excluded for the same reason from the other end: that line would sit exactly
under the x-axis rule.

Both the lines and the labels are placed by `tickPercent(i, bands)` off the same
`#tickSteps()` count, so the two cannot drift. The SVG's y runs DOWNWARD, so a
percentage measured UP from the bottom is inverted (`100 - tickPercent(…)`).

- Site: `src/components/sherpa-line-chart/sherpa-line-chart.ts`

### T-chart-tip-is-a-sibling-of-its-dot

Every chart hover tooltip is a **SIBLING** of its dot, never a descendant, and
JS supplies exactly one thing about it: the anchor NAME.

**Why siblings.** The dot must be `position: absolute` to sit on its own mark, and
an absolutely-positioned ANCESTOR breaks anchor positioning for a `fixed` tip. So
the whole fragment is cloned and `dot` and `tip` are appended side by side.

**Why the anchor name comes from JS.** CSS cannot derive a per-mark
`anchor-name`. Without one the tip has NO anchor at all, `position-area` is then
meaningless, and the browser parks the tip wherever it likes — which is why every
donut tip appeared beside its dot instead of above it. The name goes on **BOTH**:
the dot DECLARES it, the tip POINTS at it.

Everything else about the placement is declarative — see `.chart-tip` in
`core/sherpa-base.css`. Nothing here measures anything.

Per chart:

- **line chart** — the dots reuse the SAME x/y percentages the polyline was drawn
  from, so a dot can never sit anywhere but on its own point. They are HTML, not
  SVG, because an SVG element cannot be a CSS anchor. A dot lives in the
  `.hotspots` layer, OUTSIDE the `<g>` carrying the series' properties, so it
  inherits nothing — without an explicit `--_border` its `var(--_border, …)` fell
  through to the fallback and every dot painted the same grey. The tip's label is
  the series NAME plus the x label, because a value alone is ambiguous on a
  multi-series chart.
- **barchart** — the tip lives on the bar COLUMN, so there is no separate dot
  and the anchor name is the ONE thing JS supplies; everything else about the
  placement is declarative.
- **donut** — the ONLY number JS gives CSS is the slice's MID-ANGLE, measured
  from 12 o'clock to match the arcs; `cos()`/`sin()` in the CSS turn it into a
  position, so the dot follows the ring at any size. `radialArea(mid)` pushes the
  tip OUTWARD along the slice's radius so it clears the ring rather than covering
  the data it describes. The TIP carries the slice index too, because the slice
  is inside `<svg>` and cannot be reached by a sibling selector.
- **sparkline** — the dots position themselves in CSS off the same `--_vN`
  bridge the line uses and are paired with their tips by index, so JS writes only
  the tip TEXT.

- Site: `src/components/sherpa-line-chart/sherpa-line-chart.ts`
- Site: `src/components/sherpa-barchart/sherpa-barchart.ts`
- Site: `src/components/sherpa-donut-chart/sherpa-donut-chart.ts`
- Site: `src/components/sherpa-sparkline/sherpa-sparkline.ts`

### T-y-axis-width-is-fixed-not-measured

The y-axis column's width is **FIXED in CSS** and long labels truncate. Nothing
about it is measured in JS.

Sizing it from the data made the plot WIGGLE whenever a value crossed a digit
boundary — a live chart that re-scales on its own then shifts its whole plot
sideways as the numbers tick.

The axis PRESENCE is written rather than inferred, for the same reason
`T-empty-write-lets-css-collapse` exists: an absent `data-ticks` must not mean
"no axis", and a `data-ticks="0"` must. So `data-has-y-axis` is toggled
explicitly, and `#tickSteps()` passes `min: 0` rather than testing `>= 0` — a
NEGATIVE count then clamps to "no ticks" instead of silently falling back to the
default of 4 (which matches the Figma Chart Axis).

The barchart clears the ticks BEFORE its early return, or a `data-ticks="0"`
would leave the previous scale on screen labelling nothing.

One label per division BOUNDARY — `steps + 1` of them — each placed at the SAME
percentage `tickPercent()` gives its gridline, so the two cannot drift. The
barchart also hands `--_bands` to CSS, because its gridline gradient repeats
every 1/bands of the plot: the lines and the labels come off that ONE number.

The line chart's span is `min..max`, NOT `0..max`: its y-scale is derived from
its own extent, so an axis running from 0 would label gridlines that are not
where the lines actually sit. Both charts stamp DESCENDING, because the axis is
inverted relative to the DOM's flow — the highest value is at the TOP of the plot
but the FIRST child in the column.

- Site: `src/components/sherpa-line-chart/sherpa-line-chart.ts`
- Site: `src/components/sherpa-barchart/sherpa-barchart.ts`

### T-chart-datum-aliases-are-not-copies

`BarDatum`, `DonutSlice` and `LegendItem` are **ALIASES**, not copies, of the
shared shapes in `core/chart-datum.ts`. Do not "tidy" one into its own interface.

A bar, a donut slice and a legend row are the same three fields, and three names
for one shape meant crossing between them cost a `.map()` that rebuilt each
object identically. The names stay because each reads better at its own call
site.

`LegendItem` aliases `LegendDatum` rather than `ChartDatum`, because a legend
sits BESIDE a chart showing the same data, so a `ChartDatum` should pass straight
into one — and it does: `LegendDatum` is `ChartDatum` plus the two things only a
legend has, a value it may PRINT rather than plot, and a status swatch.

`sherpa-donut-chart`'s `DonutSlice` is the third alias and is deliberately NOT
cited there: its one-line JSDoc is the exported type's first prose line, which
the spec generator reads into git-tracked YAML.

- Site: `src/components/sherpa-barchart/sherpa-barchart.ts`
- Site: `src/components/sherpa-chart-legend/sherpa-chart-legend.ts`

### T-slider-second-thumb-is-revealed-not-built

`sherpa-slider` always holds **TWO** native `<input type="range">` elements, plus
two editable number fields. Range mode REVEALS the second of each; it never
builds one. So there is no `createElement`, and no template switch — the same
rule as `T-variant-attrs-or-one-way-door`.

Which input owns what:

- **single mode** — `#input` is the whole control; `#endInput` sits hidden,
  exactly as it always did. `--_pct-start` is written as `0%`, so the fill runs
  from the rail's head as it always has.
- **range mode** — `#input` owns the LOW end and `#endInput` the HIGH one.
  `#valueField` is the HIGH end's number field and `#startField` the low one's.

Every input is given the **SAME** `min`/`max`/`step`, so both rails map a
percentage to the same position and the two thumbs can be compared directly.
Both values are written even while one is being dragged, which is what keeps a
thumb from being pushed past its partner.

Each handler branches on `#isRange` ONCE rather than the template carrying two
sets, because the first input is the whole control in one mode and the low end in
the other.

The eight listeners are registered with the base class's `signal` instead of
eight paired `removeEventListener` calls — see
`T-abort-controller-per-connect`. There is then no teardown list to keep in step,
and nothing to forget when a ninth is added.

- Site: `src/components/sherpa-slider/sherpa-slider.ts`

### T-range-reads-ordered-but-drags-clamped

`sherpa-slider`'s two ends are handled **DIFFERENTLY** on the way out and on the
way in, and the asymmetry is the point.

**Reading `range` ORDERS the pair, low first**, whichever way the user dragged: a
range whose start is above its end is not a range, and every consumer would
otherwise have to sort it again. An ABSENT end defaults to the corresponding
bound, so a half-set range reads as "everything from here" rather than as a
broken one.

**Dragging CLAMPS the ends against each other rather than swapping them.**
Dragging the low thumb past the high one stops it AT the high one. Swapping would
hand the user a thumb they are no longer holding, and the pointer would carry on
moving the other end.

So `set range` sorts, and `#setEnd` clamps — they are not two spellings of the
same thing and must not be collapsed.

- Site: `src/components/sherpa-slider/sherpa-slider.ts`

### T-num-is-stricter-than-parsefloat

`sherpa-slider`'s `min`/`max`/`step` go through `num()`, which is **STRICTER**
than the `parseFloat` they used to use: `parseFloat('12px')` reads 12, `num()`
rejects it.

That is deliberate. A bound that is not a number is an AUTHOR ERROR, and quietly
reading half of it hides the mistake. These are native attribute names
(`min`/`max`/`step`), un-prefixed per the naming contract.

A `step` of 0 or less FALLS BACK to 1 rather than clamping: it cannot advance the
slider at all, and clamping would silently pick a step the author never named.

- Site: `src/components/sherpa-slider/sherpa-slider.ts`

### T-never-fight-a-focused-field

A `sherpa-slider` number field is **LEFT ALONE while it is focused**, and a
part-typed value is ignored until commit.

`#put()` returns early when the element is `shadowRoot.activeElement`, so a sync
can never rewrite what someone is in the middle of typing. `#partial()` treats
`''`, `'-'` and anything ending `'.'` as an intermediate state and skips the
`input` handler entirely — otherwise typing `-12` clamps to the minimum at the
`-`, and typing `1.5` clamps to 1 at the `1.`.

The COMMIT handler (`change`) then SNAPS the field to whatever the clamp settled
on, because the typed number may have been below the range's low end or outside
the bounds entirely. That snap is the only place a focused field is written.

- Site: `src/components/sherpa-slider/sherpa-slider.ts`

### T-populate-label-not-name

`sherpa-metric`'s populate shape takes **`label`**, matching the attribute
(`data-label`) and every other populate shape in the library — `label` is the
word in 7 of 13.

It used to take `name` and write it straight into `dataset['label']`, translating
its own vocabulary in the one line where both spellings met. `name` is still read
(and marked `@deprecated`) so nothing breaks, with `label` winning when both are
given.

This is the component-level half of
`T-populate-vocabulary-is-label-value-description`.

- Site: `src/components/sherpa-metric/sherpa-metric.ts`

### T-metric-status-follows-the-trend

**STATUS IS TIED TO THE TREND** (Will's rule), so `sherpa-metric` sets its own
`data-status` — a caller passing one would be duplicating something the data
already says, and the two could then disagree.

    up    → success   (a rise is good news)
    down  → critical  (a fall is bad news)
    flat  → default   (nothing to report)
    none  → default   (a raw data point with no relevant trend)

"Default" means **NO `data-status` at all**, not `data-status="default"`. The
`--_status-*` cascade only emits for a NAMED status, so REMOVING the attribute is
what returns the tile to its neutral surface and ink — the same reason
`T-empty-write-lets-css-collapse` exists.

The trend itself is derived from `deltaPercent` when it is not given explicitly
(`> 0` up, `< 0` down, `0` flat, absent or non-finite → none).

- Site: `src/components/sherpa-metric/sherpa-metric.ts`

### T-donut-slice-is-a-closed-path

Each donut slice is **ONE CLOSED `<path>`** — a ring segment with all four
corners rounded, built by `ringSegmentPath()`. It used to be a STROKED CIRCLE
whose dash exposed only its own span, and that could express NEITHER of the two
things Figma asks for.

A stroke is a thick LINE: it has two caps and no corners. So it could not carry a
border round the whole slice (only along the two long edges, as a second arc
drawn on top), and it could not round the four corners at all. A closed path does
both in ONE element: `fill` tints the body at 60%, `stroke` traces the entire
boundary, and the corner arcs are part of the outline. Same primitive, same
reason, as `T-gauge-band-is-a-closed-path`.

The geometry, all in viewBox units of a 100×100 box (so every number is a
percentage of it), matching Figma's five ELLIPSE arcs with `arcData.innerRadius`
0.7, `cornerRadius` 2, a 1px stroke and a 60% fill:

- `CORNER = 1` — Figma's `cornerRadius` 2 on a 200px chart.
  `ringSegmentPath()` clamps it down for a slice too thin or too short to hold
  it.
- `OUTLINE = 0.5` — 1px on a 200px chart, ALIGNED INSIDE. SVG has no inside
  stroke (it always straddles the path), so the path is drawn half a stroke in
  from the TRUE edges and the stroke then lands inside the band, exactly as Figma
  paints it. That is why `outer` is `CENTRE - OUTLINE / 2` and `inner` is
  `CENTRE * 0.7 + OUTLINE / 2` — Figma's `innerRadius` 0.7 makes the band the
  outer 30%, and a `pie` fills to the centre instead.
- `MIN_SHARE = 0.005` — a slice never shrinks below this SHARE, so a 0.1% slice
  is still a visible sliver rather than a zero-width path the browser drops
  entirely.

Slices **TOUCH** — no gap, as in Figma, where the 2px rounding alone separates
them. The old flat-capped 1-unit gap was standing in for that rounding.

There is **no `-90deg` transform**: `ringSegmentPath()` measures CLOCKWISE FROM
12 O'CLOCK already, which is where Figma's `startingAngle` of -1.5708 rad puts
the first slice. No transform means the rounded corners stay true.

The `<path>` is cloned from INSIDE the template's `<svg>`, not the wrapper — the
wrapper exists only so the HTML parser puts the path in the SVG namespace.

The slice's `--_border` is its own token: colour 5 of the series' sequence, held
at FULL strength. A mark's FILL moves along its ramp; its BORDER does not.

- Site: `src/components/sherpa-donut-chart/sherpa-donut-chart.ts`

### T-sparkline-headroom-is-a-share-of-the-box

A sparkline's normalisation window is PADDED, and the padding is a fraction of
the **BOX**, not of the data's spread.

Normalising to exactly `min..max` puts the lowest value at 0% — flat against the
bottom edge — so the area fill has nothing to fill under it and the trend reads
as a line clipped at the floor.

A fraction of the SPREAD was the obvious fix and is wrong: it gave the same 11.5%
every time, which on a 28px sparkline is only **3.2px** of fill — a sliver. What
governs how the fill looks is its share of the box.

So `LINE_SHARE = 0.62`. The extra range is `spread / share - spread`, split
**0.8 below** the minimum (that is the fill) and the rest above the peak (so the
line does not touch the top edge either). At 0.62 the line uses the top ~62% of
the box and the lowest point sits ~30% up, so roughly a third of the height is
fill. The trend still reads clearly; a larger share would flatten it.

Only the most recent `SLOTS` (8) values are kept, giving 7 segments between 8
fixed point slots. The COUNT goes to CSS as `--_len` because CSS cannot count for
itself, and the hover dots space themselves with `--_i / (--_len - 1)` — so that
one number is all they need, and no per-dot x position comes from JS.

- Site: `src/components/sherpa-sparkline/sherpa-sparkline.ts`

### T-pages-are-one-based-and-default-to-25

Two `sherpa-pagination` numbers that look arbitrary and are not.

**Pages are 1-BASED**, so 1 is both the default and the FLOOR. 0 and a negative
are not "a page" at all, and clamping them UP is the only sane reading — hence
`min: 1` on both `data-page` and `data-total-pages`.

**The default page size is 25, not the first option.** 10 rows is a thin slice of
a real table: it fills less than half a panel and makes paging the main way to
read the data. A host can still name any size with `data-page-size`, and an
options set that does not OFFER 25 falls back to its own first option. The
constant is public as `SherpaPagination.DEFAULT_PAGE_SIZE`.

`#clamp` states the **NaN** case rather than leaning on `Math.trunc(n) || 1`.
That idiom folds 0, NaN and -0 together — the exact trick `coerceNum`'s own doc
comment calls out as the reason it exists. It happened to be harmless here (page
0 is invalid anyway, so both paths give 1), but it hid its reasoning behind a
coincidence.

- Site: `src/components/sherpa-pagination/sherpa-pagination.ts`

### T-select-card-keeps-both-footer-controls

A `sherpa-select-card` footer holds **BOTH** pre-placed select controls — a
`sherpa-select-radio` AND a `sherpa-select-checkbox` — and CSS shows exactly one,
off `data-select-mode` (radio by default, checkbox for multi-select).

`#syncControl()` mirrors the card's `name` / `value` / `disabled` / `selected`
onto **both**, not just the visible one. Keeping both in step means switching
`data-select-mode` never surfaces a STALE control. When a consumer slots their
own footer there are no `.footer-control`s at all, so the whole method is a no-op
and that control is theirs to wire — the card still reports selection through its
`change` event.

**Radio grouping is done by hand, document-wide**, because native grouping cannot
cross shadow roots: selecting one card queries
`sherpa-select-card[name="…"]` (via `CSS.escape`) and deselects its siblings.
`sherpa-select-radio` does the same thing for the same reason.

`#toggle()` follows the semantics rather than the attribute: a RADIO card's
toggle means "select" — you cannot unselect one by re-clicking — while a CHECKBOX
card flips. The host's `role` and `aria-checked` follow the mode and the state
for the same reason.

A click that lands ON a footer control is ignored by the card's own handler
(checked with `composedPath`), because that control already fires its own
`change` into `#onControlChange`; without the guard the card double-toggles.

- Site: `src/components/sherpa-select-card/sherpa-select-card.ts`

### T-css-owns-the-leave-duration

`sherpa-toast` removes itself on **`animationend`**, so CSS owns the leave
timing and JS never needs to know it.

It used to be `setTimeout(…, LEAVE_MS)` with a **160** that had to be kept in
step with the `sherpa-toast-out` keyframes by hand — two copies of ONE number,
and a race if either moved. `animationend` is the platform's own answer: the
animation says when it is done. The listener is `once`.

`LEAVE_FALLBACK_MS = 1000` is a **SAFETY NET, not a duration.** It covers only
the case where the animation never runs AT ALL — `display: none`, a
reduced-motion setting that cancels it, a browser that skips animations on a
hidden tab — where waiting for an event that will not fire would leave the node
in the DOM forever. It is generous on purpose: it must never beat a real
animation to the finish. A `done` flag makes whichever arrives first the only
one that acts.

The `toast-dismiss` event fires IMMEDIATELY, before the animation, so app code
is not kept waiting on it.

The auto-dismiss delay goes through `num()`, not `Number()`: an EMPTY
`data-duration` used to read as 0, which the `> 0` test then treated as "no
auto-dismiss" — a toast that never left. The default is 5000.

- Site: `src/components/sherpa-toast/sherpa-toast.ts`

### T-style-border-base-is-default-1

**The checkbox and the radio do not share a border colour or a border width.**
They look like the same control at a glance, so the natural move is to give
them one rule. Figma binds them differently:

| | stroke colour | resolves to | stroke width | resolves to |
|---|---|---|---|---|
| `Checkbox (Atom)` | `style-border/base +1` | `border/default/+2` · `#b3b3c3` | `border/width/sm` | **0.5px** |
| `Radio (Atom)` | `style-border/base` | `border/default/+1` · `#e8e8f6` | `border/width/base` | 1px |

So `style-border/base` is the **pale** one and `style-border/base +1` is the
grey — one ramp step apart, on a sub-pixel stroke. Nothing about the names says
which control takes which, and nothing in a screenshot shows the difference.

Two further things make this easy to get wrong:

1. `tokens.css` maps the generated `--sherpa-style-border-base` to
   `--sherpa-theme-border-default-2`, which disagrees with the live Figma
   chain. That file is generated, so it is not hand-edited — but it also cannot
   be used to settle which Theme token a component should consume. **Resolve
   the alias chain in Figma and bind the Theme token it actually lands on.**
2. The stroke width changes the geometry of what is inside it. The checked
   indicator is inset 2px and must land at 14 on a 20 box; `inset` measures
   from the PADDING box, so it is immune — but any arithmetic that starts from
   the content box is not, and would draw 15 at a 0.5px border.

A THIRD member of the same family: `style-border/base +1` also resolves to
Theme `border/default/+2` (#b3b3c3) in Figma, while the generated
`--sherpa-style-border-base-1` in `tokens.css` points at `border/default/+3` —
one step darker again. `sherpa-container-footer` consumed it and drew a
near-black rule under every dialog and menu footer, against the pale one the
header draws. Its comment claimed both resolved to #e8e8f6 and its fallback
said #35353d; neither was the bound colour. A comment about a token is not a
reading of it.

- Site: `src/components/sherpa-select-checkbox/sherpa-select-checkbox.css`
- Site: `src/components/sherpa-select-radio/sherpa-select-radio.css`
- Site: `src/components/sherpa-container-footer/sherpa-container-footer.css`

### T-checkbox-stroke-is-sm

The checkbox border is `border/width/sm` — **0.5px**, via Primitives
`border/stroke/200`. Not the 1px `border/width/base` that most bordered
components take, and that this drew.

It is a sub-pixel stroke on a 20px box. On a 1x display it renders as a lighter
1px line rather than a thinner one, so the change shows up as a subtly paler
box and reads as a colour bug, not a width one.

- Site: `src/components/sherpa-select-checkbox/sherpa-select-checkbox.css`

### T-compose-never-reimplement

The data grid drew its row selection with a bare `<input type="checkbox">` and
an `accent-color`, so every tick in the grid was the **browser's own** checkbox
wearing one custom colour — round on some platforms, square on others, and
matching the Figma checkbox on none of them. A whole component re-implemented by
omission: `sherpa-select-checkbox` already existed, and the header's select-all
was already using it.

The swap is drop-in because the component exposes `checked` and `indeterminate`
as properties and re-emits `change` from the HOST, which is the shape the grid's
handlers already read. What is NOT drop-in: SINGLE select mode used to write
`box.type = 'radio'` on the input. A custom element has no such property, and
mutating a control's type is a structural change either way. Both controls now
sit in the row template and CSS reveals one —
`T-every-element-in-the-template`.

- Site: `src/components/sherpa-data-grid/sherpa-data-grid.ts`
- Site: `src/components/sherpa-data-grid/sherpa-data-grid.css`

### T-a-property-set-before-upgrade-shadows-its-accessor

`box.checked = true` did nothing, silently, forever.

A custom element is upgraded when the browser reaches it — not when it is
created. `document.importNode` on a `<template>` gives back elements that are
NOT yet upgraded, and a grid that stamps rows sets their state in the same tick.
That assignment lands as a plain **own data property** on the instance. When the
upgrade happens moments later, the prototype's accessor is installed behind a
property that now shadows it: the setter never runs again, the getter is never
asked, and reading the property back returns the stale value that was written —
so the bug looks like it worked.

This is why the grid's ticks came back on a re-render but not on a programmatic
select, and why `host.checked` returned `true` while the inner `<input>` was
`false` and the box was drawn empty.

The fix is the standard **property upgrade**: on connect, for every own key that
some prototype defines as an accessor, capture the value, `delete` the own
property so the accessor is reachable again, and re-assign — which now runs the
setter. `SherpaElement.connectedCallback` does this for every component before
anything else reads state, because any component with a JS property has the same
hole.

Note it is not enough to only fix the component that was caught: the grid is one
caller, and the next one will stamp a different element.

- Site: `src/core/sherpa-element.ts`

### T-checkbox-rounding-is-flat-sm

The checkbox corners are **one flat token**, `border/rounding/sm` (2px) — not
the per-corner `rounding/top-left` … `rounding/bottom-right` chain that the
Grouping collection drives.

That difference is load-bearing. `.sherpa-snap-group` squares a child's inner
corners by writing those four custom properties, and custom properties inherit
straight through a shadow boundary. While the control read them, the advanced
checkbox's snap group reached past the wrapper and squared two corners of the
checkbox's own drawn box — which needed a reset rule on `.field` / `.control`
to undo. A flat value reads none of them, so the reset went away with the
cause.

Read this as the general rule: **a control that is snapped inside a wrapper
should not itself consume the per-corner rounding variables.** The wrapper
snaps; the thing inside it keeps its own shape.

- Site: `src/components/sherpa-select-checkbox/sherpa-select-checkbox.css`

### T-selection-lives-in-the-keys-not-the-objects

Ticking rows and turning the page lost the ticks.

The grid holds its selection two ways, and only one of them survives:

| | what it holds | survives a sort / group | survives a PAGE change |
|---|---|---|---|
| `#selected` | record OBJECTS | yes — same objects, reordered | **no** — the store hands back new ones |
| `#wantedKeys` | key STRINGS | yes | yes |

`#resolveSelection()` already rebuilt `#selected` from `#wantedKeys` on every
populate. The hole was that **nothing wrote `#wantedKeys` except the `select()`
API** — a user's own tick only ever touched `#selected`, so the next populate
cleared it and refilled from keys that had never heard of it.

`#rememberSelection()` closes it at the one choke point every interactive path
already ran through, `#emitSelection()`. Two things about it are easy to get
wrong:

1. **It MERGES.** The grid holds one page, so a record chosen on page 1 is
   simply absent from `#rows` while page 2 is up. Replacing the keys with
   "what is selected now" would discard it. Keys for rows the grid can see come
   from `#selected`; keys for rows it cannot are carried over untouched.
2. **A CLEAR therefore has to say so explicitly.** "Clear selection", and
   unticking the header box, both mean *everything* — but they only empty
   `#selected`, and the merge would hand every off-page key straight back. Both
   null `#wantedKeys` as well. `select()` replaces outright for the same
   reason, and that is the difference between it and a user's tick.

**Without a `key` in `populate()` none of this can work** — there is no durable
name for a record — so `#rememberSelection()` returns early and selection stays
page-local. That is a data contract, not a bug, and
`T-grid-key-or-position-lies` is the other half of it.

- Site: `src/components/sherpa-data-grid/sherpa-data-grid.ts`

### T-a-test-must-click-what-the-listener-is-on

`element.click()` on a custom element HOST usually does nothing.

A Sherpa component listens on a node inside its own shadow root, not on itself:
`sherpa-button` on `.trigger`, `sherpa-select-checkbox` and
`sherpa-select-radio` on `.control`, `sherpa-quick-filter` on `.body`. A
synthetic `click()` on the host dispatches at the host and does not retarget
INTO the shadow tree, so it reaches no listener — and it fails quietly, because
`click()` returns nothing and the assertion that follows simply reads the
unchanged state.

This turns a working component into a "broken" one in a test, and it has cost
several tests on this branch. It bites hardest right after a bare `<input>` is
replaced by a component: the same selector still matches, the same `.click()`
still runs, and only the behaviour disappears.

```ts
box.click();                                              // reaches nothing
box.shadowRoot!.querySelector('.control')!.click();       // reaches the listener
```

A real user's click does retarget, so this is a synthetic-event problem only —
Playwright's own `locator.click()` is fine.

- Site: `test/e2e/reforged-data-grid.spec.ts`
- Site: `test/e2e/reforged-view-chips.spec.ts`

### T-radios-in-shadow-roots-are-not-one-group

A radio group needs its members in ONE tree. Wrap each radio in its own
component and the browser no longer sees a group at all.

`<input type="radio" name="x">` unticks its siblings because they share a name
*and* a root. `sherpa-select-radio` puts each input inside its own shadow root,
so the browser sees one group of one, per row — every radio stays ticked, and
nothing warns. Setting the same `name` on all of them does not help; the name
is only half the rule.

So the HOST has to enforce single selection. The data grid's `data-select
="single"` mode unticks the other rows itself, in the same place it clears
`#selected`.

This was free before, which is what makes it easy to miss: the grid's rows were
bare `<input>`s in one shadow tree, the browser did the unticking, and a comment
in the code said so. Replacing the input with a component silently removed the
behaviour that comment described.

- Site: `src/components/sherpa-data-grid/sherpa-data-grid.ts`

### T-the-tick-needs-the-fixed-ramp

The checkmark went BLACK in dark mode.

It was painted with `--sherpa-theme-content-body-4`, which resolves to
`neutral-color-1` — `#FFFFFF` in light and `#0C0B11` in dark. That is correct
for text on the page, which SHOULD flip. It is wrong for ink sitting on a
coloured fill, which must not: the checkbox indicator stays accent blue in both
modes, so its tick has to stay white in both.

The `fixed` ramp exists for exactly this. `neutral-fixed-color-*` does not
re-point under `[data-mode]`, and nine components already spell it as
`--sherpa-theme-content-body-base-fixed` — a badge on a status pill, the nav's
selected row, the switch's knob label. Figma says the same thing a different
way: `style-content/inverse` now aliases Theme `content/body/inverse-fixed`,
which composes `Display Mode/color/neutral/fixed/color 1`.

**Ask which half is fixed.** Ink on a surface that flips should flip with it.
Ink on a surface that does NOT flip must not. Getting this wrong is invisible in
light mode, which is where it gets reviewed.

- Site: `src/components/sherpa-select-checkbox/sherpa-select-checkbox.css`

### T-a-chip-filters-the-values-the-data-has

The app header's Region chip offered `emea` / `amer` / `apac`. Both demo
datasets hold `EMEA` / `AMER` / `APAC` / `LATAM`.

So picking EMEA built `['region', 'eq', 'emea']`, which matched no record. The
chip lit up, the toolbar reported the pick, the source ran the query — and
nothing moved. Every part worked; the two lists simply were not the same list.
LATAM had no chip at all, so a quarter of the data was unreachable.

`records-data.js` already states the rule, for plans: *"the list of plans that
EXIST is a fact about the records, not about the form, and a form with its own
copy would offer a plan no record could have."* The Region chip was that second
copy. It now takes the values as an argument, from the module that owns them.

**A chip's `value` is what the record holds; its `label` is only what a reader
sees.** Those are allowed to differ — `AMER` shows as "Americas" — which is
exactly why this hid: the labels looked right on screen the whole time.

The `emea` saved view had the same split INSIDE one object, under a comment
saying the chip and the filter were "ONE FACT said twice… so they cannot
drift": its filter said `'EMEA'` and its chip said `'emea'`. A comment is not a
mechanism.

- Site: `examples/views/global-filters.js`
- Site: `examples/views/records.js`
- Site: `examples/views/records-data.js`
- Site: `examples/views/dashboard.js`
- Site: `examples/views/dashboard-data.js`
- Site: `examples/views/dashboard-views.js`

### T-a-persistent-chip-reports-on-every-change

Picking a Region re-applied the whole current view, a microtask later.

`sherpa-quick-filter-toolbar` reports the bar's WHOLE state on every change:
one `quick-filter-change` carrying `values` for every chip that has a value.
The View chip is `persistent` — a reader is always in some view — so
`values.view` is present on every one of those events, whatever the reader
actually touched.

`onViewPicked` read `values.view` and applied that view. Every time. So
choosing a Region made it re-apply the view already on screen, and
`applyViewSnapshot` restores a snapshot's filter as the WHOLE query — which
cleared the named `contribute` parts and threw away the region the reader had
just set. Three symptoms, one cause:

| what was seen | why |
|---|---|
| the header's filters did nothing | the filter was set, then wiped |
| the grid's own column chips never lit | the grid was re-populated from a snapshot that had no column filters |
| the selection column came unpinned | a full re-render, and the pin is re-applied per render |

It now remembers which view is applied and returns early when the id has not
changed. That needs a starting value, because the FIRST header change of a
session would otherwise re-apply the view the page is already showing — so
`onViewPicked` takes `applied`, the same id the caller passes to `viewOptions`
to mark the selected chip.

**The general shape:** a bar reports its whole state, so a handler reading one
chip out of it cannot tell whether that chip is what moved. Either compare
against what you last acted on, or read `picked` — which names only what
changed — rather than `values`.

- Site: `src/core/persist-view.ts`
- Site: `examples/views/records.js`
- Site: `examples/views/dashboard.js`

### T-the-header-chips-must-reach-the-query

The app header's Customer, Region and Date-range chips were wired to nothing.

`global-filters.js` opens with a clear account of what they do — they "trickle
DOWN: whatever they narrow to is the population each view's own charts, grids
and metrics then work within". Both example views found the header, populated
it, and handed it to `onViewPicked` for its View chip. Neither listened for the
other three. So a reader picked a region, the chip lit, the toolbar emitted its
event, and no data moved.

It had never worked, which is what made it hard to see: there was no regression,
no error, and the chips looked exactly as they should.

The fix is the `contribute` split the page already used for its other three
writers — the header gets its own key and ANDs with the view bar's chips, the
grid's column filters and a saved view's clause, without any of them knowing
about the others.

**A view must also say WHICH FIELD each header chip narrows.** A header chip is
named for a business question, and the field answering it differs per page:
"Customer" is this product's word for an ORGANISATION, so on the records page it
is the `customer` field — not the record's own `name`, and not `owner`, which is
the member of staff looking after the account. A chip the page does not map
narrows nothing, rather than building a clause against a field no record has.

- Site: `examples/views/records.js`

### T-the-last-row-draws-no-rule

The last body row draws NO bottom rule, on purpose: the grid's host draws the
table's own bottom frame, and a last-row rule sits directly on it as a doubled
line. `.row:not(:last-child) .cell` is where that exception lives.

A PINNED cell paints its own background, so the row's rule cannot reach it and
it has to restate the border itself. Both pinned cells did — unconditionally.
So on the last row they drew a rule where every ordinary cell correctly drew
none, and the bottom edge became a short stub under the selection column that
stopped dead where the data cells began. It read as a missing border on the data
cells; it was an extra one on the pinned cells.

**Any cell that restates the row rule must restate the exception with it.**
`.row:not(:last-child) > .select-cell`, not `.select-cell`.

- Site: `src/components/sherpa-data-grid/sherpa-data-grid.css`

### T-an-instance-pin-is-the-hosts-to-apply

`sherpa-container-footer` has ZERO inline padding, on purpose: it sits inside a
menu card that already has its own 8px, and a second gutter would indent the
buttons inside it. Will tightened it 16 → 8 → 0 to get that.

A DIALOG has no such gutter, so the same footer put its buttons flush against
the dialog's edge while the body sat inset 16. Figma says the same thing in its
own vocabulary: the Dialog (1003:33675) pins `padding/sm` on both sides of its
Container Footer INSTANCE, against the component's own `padding/none`.

**A pin belongs to whoever places the instance** — so it lands in the dialog,
not in the footer, whose default is right everywhere else.

Two ways to pass it, and only one works:

```css
.footer ::slotted(sherpa-container-footer)::part(row) { … }  /* DROPPED, silently */
.footer ::slotted(sherpa-container-footer) { --_pad-inline: 4px; }  /* works */
```

`::part` cannot follow `::slotted`, and the rule is discarded with no warning —
the measured padding simply does not change. A custom property inherits straight
through both shadow boundaries, which is the one thing that does cross them. The
component reads `var(--_pad-inline, <its own default>)`.

And it is the component's OWN private knob, not `--sherpa-theme-padding-none`.
Redefining a shared token to mean something other than zero is a lie told to
every descendant that reads it.

- Site: `src/components/sherpa-dialog/sherpa-dialog.css`
- Site: `src/components/sherpa-container-footer/sherpa-container-footer.css`

### T-two-urls-are-two-modules

The examples server serves `examples/views/records-data.js` at BOTH
`/views/records-data.js` and `/examples/views/records-data.js`. A browser keys
its module registry on the URL, so importing the two gives **two separate module
instances** — two `customerStore`s, two sets of records, no connection between
them.

A test that patched `store.remove` on `/examples/views/…` made a store nothing
held refuse a delete, while the view's own store deleted the rows for real. The
assertion then reported the rows as missing, which looked like the error
handling failing when it was the test reaching the wrong object.

**Import the URL the VIEW imports.** `/views/records.js` does
`import … from './records-data.js'`, which resolves to `/views/records-data.js`.

This is not specific to the examples: any server that maps one file to two paths
does it, and nothing warns. The symptom is a patched or seeded module having no
effect at all.

- Site: `test/e2e/reforged-view-chips.spec.ts`

### T-the-records-store-persists-between-runs

The Records example uses an `IdbStore`, so its records live in IndexedDB and
**survive a page load, a test run, and the next test run**. A test that hardcodes
"Aisha Cohen" passes once and fails forever afterwards, because an earlier run
really deleted her.

Read the names under test at the start of the test and compare against what was
read, never against a literal. The same applies to counts: assert a delta, not a
total.

- Site: `test/e2e/reforged-view-chips.spec.ts`

### T-a-failed-mutation-must-reach-the-reader

`void deleteRecords(records)` — a rejected promise reaching nothing.

The store's `remove()` is a real mutation and can refuse: a network that is
down, a record another session already deleted, a rule the store enforces. The
only caller discarded the promise, so a refusal produced no toast, no console
warning and no change on screen. The row simply stayed, which reads as a
rendering bug rather than a failure.

Three things a mutation flow owes the reader, and all three were missing:

1. **Per-item failure, not all-or-nothing.** A bulk delete of five where two
   refuse must say "could not delete 2 of 5", not throw on the first and leave
   the other three in an unknown state. Each `remove` is awaited in its own
   `try`.
2. **The REASON.** "Something went wrong" is not actionable; the store's own
   message is. It goes in the toast's value line.
3. **Leave the screen honest.** Never update it by hand. The store announces
   its own change and every bound view reloads, so a record that did not delete
   is still there — and it stays SELECTED, so the reader can retry without
   re-picking it.

`DataSource` already treats a failed LOAD as a state rather than a throw. A
mutation deserves the same care, and had none.

- Site: `examples/views/records.js`
- Site: `test/e2e/reforged-view-chips.spec.ts`

### T-a-row-holds-two-selection-boxes

Every body row stamps BOTH a `sherpa-select-checkbox` and a
`sherpa-select-radio`, and CSS reveals one — so `.row-select` matches **two
elements per row**, not one.

Anything that COUNTS or READS must ask for the visible box (`.row-multi` or
`.row-one`, via `#rowBox()` / `#rowBoxes()`). Only a write that genuinely means
"set them both" uses the broad selector.

Four callers had it wrong, and each failed differently — which is what made it
hard to see as one bug:

| caller | what went wrong |
|---|---|
| `#syncGroupSelects` | counted 44 ticks against 22 rows, so a group box never read as full |
| `#syncSelectAll` | saw 50 boxes for 25 rows, so the header box was never "all" |
| `#emitSelection` | reported every selected row **twice** |
| `#selectGroup` | wrote to the hidden control in single mode |

The tests had the same fault: `.row-select` in a spec counts double too.

- Site: `src/components/sherpa-data-grid/sherpa-data-grid.ts`

### T-a-click-does-not-clear-indeterminate

`indeterminate` is a **JS-only property**. A user's click flips `checked` and
leaves `indeterminate` exactly as it was — the browser does not clear it.

So a mixed checkbox the reader clicked became `checked: true, indeterminate:
true`, and CSS draws the dash over the tick: the box still said "some" the
moment after the reader said "all". Measured on the live inner input, before and
after.

`sherpa-select-checkbox` carried a comment saying "native toggling clears
indeterminate", which is the opposite of what happens. It removed only the host
ATTRIBUTE, and CSS selects `:indeterminate` on the PROPERTY — so the attribute
went and the dash stayed.

The component now clears both in its own change handler, because a user's click
is exactly the gesture that ends the mixed state.

- Site: `src/components/sherpa-select-checkbox/sherpa-select-checkbox.ts`

### T-a-default-is-not-an-override

A NUMBER filter opens as a RANGE — "between 10 and 240 seats" is almost always
the ask, and the slider is already sized to the column's real min and max, so
the range excludes nothing until it is dragged. A DATE opens as a single day.

The subtlety is how that default is written:

```ts
def.range ?? def.kind === 'number'      // a DEFAULT — an explicit false wins
def.range || def.kind === 'number'      // an OVERRIDE — false is overruled
held ? !!held.range : kind === 'number' // a HELD clause always wins
```

`||` would force every number chip to a range even where a view declared
`range: false`, and would drag a SAVED single-value filter back to a range every
time the reader reopened it. A default applies when nothing was said; it never
overrules something that was.

Two places apply it and must agree: the switch's own state, and the `picksOne`
flag that decides whether the menu defers to an Apply button. They read the same
expression rather than repeating the condition.

- Site: `src/components/sherpa-data-grid/sherpa-data-grid.ts`
- Site: `src/components/sherpa-quick-filter-toolbar/sherpa-quick-filter-toolbar.ts`

### T-a-sub-pixel-border-reads-back-as-1px

`getComputedStyle().borderTopWidth` returns the USED value, and Chromium rounds
every sub-pixel border up to one device pixel. So `0.5px` and `0.25px` both read
back as `"1px"`, and a probe cannot tell them apart — or tell either from a real
1px border.

This matters here because the design uses sub-pixel strokes deliberately: a
hairline is `border/width/sm` (0.5), and a snapped PAIR splits one hairline into
two 0.25 halves so the seam between two touching controls is not drawn twice.
Measuring the advanced checkbox reported `1px | 1px | 1px | 1px` on a wrapper
whose declared edges are `0.5 0.25 0.5 0.5` — which looks like the seam is
broken when it is exactly right.

**Read the custom property, not the border.** `getPropertyValue
('--sherpa-border-right')` returns the declared `0.25px`. Verify with a
throwaway element if in doubt: a div with 0.5/0.25/1/2px edges reports
`1px 1px 1px 2px`.

- Site: `src/core/sherpa-grouping.css`
- Site: `test/e2e/reforged-grouping.spec.ts`

### T-an-empty-chip-opens-its-menu

A chip's body cycles its states (`T-a-chip-body-cycles-its-states`). With
nothing picked there is nothing to cycle: toggling an empty chip on and then off
changes no filter, so clicking its body did nothing at all — and the reader's
next move was always the caret anyway.

So an EMPTY chip's body opens its menu instead. Two boundaries make this a
narrow rule rather than a new behaviour:

| chip | body click |
|---|---|
| has a menu, no values picked | OPENS the menu |
| has a menu, holds a value | cycles — off is a state, not a delete |
| has NO menu (a status segment) | cycles, as before |

The second line is the one to protect. Turning a value chip off is real and
useful, and it keeps its pick so one more click brings it back without a trip to
the menu. "Empty" is read from `this.values`, which covers all three menu kinds
— ticked rows, a number, a date range — so a typed chip counts as filled too.

The click is also `stopPropagation`'d, exactly as the caret's is: opening a menu
is not a toggle, and a host listening on the bar has no reason to see it as one.

- Site: `src/components/sherpa-quick-filter/sherpa-quick-filter.ts`
- Site: `test/e2e/reforged-quick-filter.spec.ts`

### T-the-column-chip-is-the-only-signal

The grid's heading is deliberately NOT tinted when a column is acting — the CSS
carries a long note explaining why ("the column says so through its CHIPS", and
two highlights competing down a header row read as noise). The `<th>` still
takes `data-status="active"` as the system-wide door, but nothing paints it.

So the filter chip is the only thing a reader can see, and only the chip's OWN
menu ever lit it. A filter arriving through the QUERY — the app header
narrowing every view to one region — left the column looking completely
untouched.

`#isFiltered` already knew the whole answer: this column's own clause, the
header-row filters, and `data-filter-fields`, which `DataSource` writes on every
bound element from the composed filter. It was computed and then spent on the
`<th>` alone.

Two places light it now, both from that one answer:

| where | why |
|---|---|
| `#syncColumnFilterStatus` | a clause changed without a re-render |
| `#renderHead` | the head row is REBUILT, so the chip is brand new and blank |

The second is the one that hid the bug. `#renderHead` never called
`#syncColumnFilterStatus` — it set the `<th>` flag inline — so on any re-render
the flag survived on the heading and the chip beside it came back empty.

The chip is `data-locked`: the GRID owns its on-state. Writing it here is the
host doing its job, not the chip deriving something it does not own.

- Site: `src/components/sherpa-data-grid/sherpa-data-grid.ts`
- Site: `test/e2e/reforged-data-grid.spec.ts`

### T-aggregation-is-data

Turning rows into the shape a chart draws is a DATA-LAYER job, not a view's.

Every chart's aggregation used to be hand-written in the example — `countBy`,
`seriesByDay`, `meanOf` and an inline `byBand` in `dashboard-data.js`. So the
SHAPE was shared (`ChartDatum` lives in `src/core/`) and the arithmetic was not.
Four things it cost:

1. **Every new view re-implements it.** The Records page's charts needed the
   same four functions and would have got a second copy.
2. **A server cannot pre-aggregate.** `sherpa-ui/data` is the DOM-free half a
   server, a test or an MCP tool imports — that is its whole reason for
   existing. Arithmetic that only runs in a browser example cannot be pushed to
   a backend.
3. **`run_query` could not answer "count by category".** The MCP data tools
   wrap the data layer so their answers are the app's answers; they could
   filter and sort and nothing else.
4. **Presentation leaked into the arithmetic.** `meanOf` did `Math.round`, so
   the gauge's real value (49.977…) was destroyed before anything could format
   it — and the tooltip could never disagree with the label because neither had
   the number.

`src/core/aggregate.ts` holds it now: `aggregateBy`, `countBy`, `bandBy`,
`seriesBy`, `reduceRows`. Pure, DOM-free (on the lint boundary), and tested in
plain Node.

**It is NOT a new pipeline.** These run on rows a store has already filtered,
sorted and searched. Aggregation is what happens to the answer, not another way
of asking the question — `applyOptions` still owns the query, and `LoadResult`
still returns rows.

- Site: `src/core/aggregate.ts`
- Site: `examples/views/dashboard.js`

### T-an-aggregate-returns-the-number

Nothing in `aggregate.ts` rounds or formats. A mean of 49.977… is returned as
49.977…, not 50.

`meanOf` used to round, which looked harmless: a gauge shows a whole percentage
anyway. But the rounding happened in the ARITHMETIC, so the real number was gone
before anything could choose how to show it — the value label and the tooltip
were formatting the same already-destroyed figure, and neither could show the
decimal nuance a reader was looking for.

**Round where you print, never where you measure.** An aggregate's job is to be
right; a formatter's job is to be readable.

Two related choices in the same module:

- An **empty set reduces to 0**, not null or NaN. A chart with no data draws
  nothing, which is what 0 means here.
- A **missing value is skipped**, not counted as zero — see
  `T-number-of-null-is-zero`.

- Site: `src/core/aggregate.ts`
- Site: `examples/views/dashboard.js`
- Site: `examples/views/records.js`

### T-number-of-null-is-zero

`Number(null)` is `0`, and `0` is finite. So the obvious guard —

```ts
const n = Number(readField(row, field));
if (Number.isFinite(n)) out.push(n);   // WRONG
```

— quietly counts every missing value as a real nought.

It passes a SUM, because adding nought changes nothing, and fails a MEAN, by
dividing by a bigger set than it actually measured. Caught by a test written
before any chart saw it: `[{n:10},{n:null},{},{n:'x'},{n:20}]` gave a mean of 10
instead of 15, because `null` was collected and `undefined` was not.

`null` and `''` are rejected explicitly before the coercion. `undefined` falls
out anyway (`Number(undefined)` is NaN), which is exactly why this is easy to
miss: the shape that looks like it proves the guard works does prove it, for the
wrong value.

A missing health score is not a health score of nought, and averaging it in
drags the mean toward zero in proportion to how much data is absent.

- Site: `src/core/aggregate.ts`

### T-a-category-keeps-its-colour

Without a declared order, categories come out of an aggregation in first-seen
order — which is count order once anything sorts them. A filter that drops two
rows then makes a category change position AND colour, so the chart appears to
recolour itself when only its ranking moved. Two charts of the same field
disagree about which colour a category is.

`AggregateOptions.order` pins both: a category keeps its slot and its
`colorIndex` whatever the data does, because the index comes from the declared
order and not from the output position.

```ts
countBy(rows, 'sev', { order: ['critical', 'warning', 'info'] })
// every critical row filtered away → warning is FIRST, and still colour 2
```

`includeEmpty` is the other half, and is off by default: an empty bar for a
category nothing matched is noise, unless the categories are a fixed scale
(severity levels, storage bands) where a missing one is itself the finding.

- Site: `src/core/aggregate.ts`
- Site: `examples/views/dashboard-data.js`
- Site: `examples/views/records.js`

### T-the-last-band-includes-its-top

A histogram's bands are half-open — `[0, 20)` — except the last, which includes
its top edge, so a value at exactly the maximum lands in the final band by RULE
rather than by accident.

The hand-rolled version got there by accident:

```js
counts[Math.min(4, Math.floor(r.storage / 20))]++   // 100 / 20 = 5, clamped to 4
```

The clamp is doing the work, and it also silently swallows anything ABOVE the
scale — a storage reading of 150 would be counted as a full disk. `bandBy`
drops values outside the declared edges instead, because folding them into the
end bands misreports both the count and the scale.

- Site: `src/core/aggregate.ts`
- Site: `examples/views/dashboard.js`

### T-a-series-has-a-value-at-every-point

`seriesBy` returns a number for every point on the x-axis, including points no
row matched. A quiet Tuesday is `0`, not absent.

A line chart with a hole in it lies about its shape: the remaining points join
up across the gap, so a day with no activity reads as a straight line between
its neighbours rather than a drop to zero. The x-axis is the caller's — the
days, the buckets, the steps — and the series has to fill it.

- Site: `src/core/aggregate.ts`

### T-one-class-to-catch

`IdbStore` threw `IdbValidationError`: the same fields, the same message, and
`this.name` set to the very same string `'ValidationError'` — but a DIFFERENT
class. So the documented way to handle a refused write —

```ts
catch (e) { if (e instanceof ValidationError) showIssues(e.issues); }
```

— was **false for every IndexedDB refusal**, while the error itself said
`ValidationError` in every log line. Measured: `new IdbValidationError([…])
instanceof ValidationError` returned `false`.

It happened because `BaseStore` lived inside `stores.ts` and was not exported,
so `idb-store.ts` could not reach it and re-implemented the shared half:
`totalCount` (character for character), `check`, `checkRows`, `announce`, and
its own error class — about 43 lines, plus four constructor fields
(`key`, `schema`, `sample`, `maxRows`) that `StoreOptions` already declared.

`BaseStore` and `StoreOptions` now live in `base-store.ts` and every store
extends it, including `IdbStore`. `ValidationError` moved to `validate.ts`,
which owns `Issue` and which both halves already imported.
`IdbValidationError` is kept as a deprecated ALIAS of the real class, so
nothing that imported it breaks and an `instanceof` on either name now answers
true.

**The general shape:** a duplicated class is worse than duplicated code,
because the copy is `instanceof`-incompatible with the original while being
indistinguishable in a log. If two modules need the same class, it belongs in
the module they both already import.

- Site: `src/core/base-store.ts`
- Site: `src/core/idb-store.ts`
- Site: `src/core/validate.ts`
- Site: `src/core/stores.ts`

### T-a-suspended-sort-is-one-owners-job

A sort has TWO halves, and they belong to different things:

| | |
|---|---|
| `state.sort` | the QUERY — empty while suspended, because the store must not order anything |
| `state.sortSuspended` | the UI half — the column a control still shows, so one more click resumes it |

**Both live on the DataSource**, and that is the whole point. The source owns
every bound element's `data-*` (`T-attributes-are-the-state-channel`), so a
component that kept its own suspended column in `data-sort-field` had it wiped
by the very next push, one microtask later. Measured: the grid set the
attribute, `#push` ran, `setAttr(el, 'data-sort-field', undefined)` removed it,
and the third click read as a clear.

That is why the grid and the toolbar's Sort chip disagreed about their shared
third state. Both cycled three ways — but the grid DELETED the column and the
chip SUSPENDED it, which broke the ratified rule that a control's states cycle
and none of them clears (`T-a-chip-body-cycles-its-states`).

**The wire format is an EMPTY `data-sort-direction`.** The field says WHICH
column; the direction says whether it is being applied:

| pushed | means |
|---|---|
| `field="n" direction="asc"` | sorting, ascending |
| `field="n" direction=""` | suspended — show the column, order nothing |
| neither attribute | no sort at all |

Three things read it and all three must agree: `#sortRows` (does not sort),
`#renderHead` (glyph back to `sortNone`, `data-sort` removed), and the toolbar's
`#syncSortFromAttrs` (chip off, direction rewound to `asc` so a resume starts
ascending rather than at the stale `desc`).

`setSort(null)` suspends; `clearSort()` forgets. A caller that means "throw it
away" must say so — and a NEW sort drops the memory rather than shadowing it,
or resuming would jump to a column the reader had moved on from.

- Site: `src/core/data-source.ts`
- Site: `src/components/sherpa-data-grid/sherpa-data-grid.ts`
- Site: `src/components/sherpa-quick-filter-toolbar/sherpa-quick-filter-toolbar.ts`
- Site: `src/core/cycle.ts`
- Site: `test/unit/suspended-sort.test.mjs`
- Site: `test/unit/cycle.test.mjs`
- Site: `src/core/sherpa-element.ts`

### T-bind-locks-what-it-owns

`DataSource.bind()` sets `data-locked` on the element, and `unbind()` removes it.

`data-locked` is this system's own answer to "a host owns this value": a locked
component **reports its interaction and stops writing its own state**. It
existed, it was documented as one third of the state-ownership convention
(`data-<thing>` in, `<thing>-change` out, `data-locked` when the host owns it),
and it was honoured by exactly **one component of 58** — while nothing set it
automatically.

So every bound component was both reporter and owner of the same value. Traced
live before the fix: one click on a grid column header wrote
`data-sort-field` itself, emitted `sort-change`, and then the source wrote the
same two attributes again a microtask later. Two writers, one value — the shape
`T-state-ownership` exists to prevent.

**The self-write is not simply deleted.** A component with no source has no
other owner, and must still work: every data-grid test drives an UNBOUND grid.
So a steering component writes its own state only when nothing else will:

```ts
if (!this.hasAttribute('data-locked')) { …write it… }
this.emit('sort-change', { … });   // the INTENT, always
```

`readonly` binds are not locked — such an element receives rows and steers
nothing, so it owns whatever it had.

A LIVE AUDIT found three components writing an attribute the source owns, not
one: the data grid's header, `sherpa-pagination.goToPage` (the interactive
path — its `page`/`pageSize` SETTERS are a different thing, a host writing the
value it owns), and `sherpa-grid-cell`'s two-state sort toggle. Grouping and
filtering were already clean: every component use of `data-group-field` and
`data-filter-fields` is a READ.

- Site: `src/core/data-source.ts`
- Site: `src/components/sherpa-data-grid/sherpa-data-grid.ts`
- Site: `src/components/sherpa-pagination/sherpa-pagination.ts`
- Site: `src/components/sherpa-grid-cell/sherpa-grid-cell.ts`
- Site: `scripts/check-ownership.mjs`
- Site: `src/core/sherpa-element.ts`

### T-one-cycle-for-one-value

The sort cycle — `asc → desc → suspended → asc` — was written TWICE: once in
the data grid's column header, once in the toolbar's Sort chip. The two
drifted, and the drift was invisible until someone clicked three times: the
grid DELETED the column on its third click while the chip SUSPENDED it.

That is two controls of one value disagreeing about what their shared third
state keeps, which is precisely what
`T-a-chip-body-cycles-its-states` ratified an answer to. A rule each component
re-reads from a document is a rule that drifts; a function is not.

`src/core/cycle.ts` holds it: `nextSort`, `sortDirectionAttr`,
`sortDirectionFrom`, `nextToggle`. Pure, DOM-free, on the lint boundary —
they take the current state and return the next one. **Reading it off an
attribute and writing the result back is not their job**, because for a bound
component that belongs to the source (`T-bind-locks-what-it-owns`).

`nextToggle` is one line and is there on purpose: the two-state and three-state
cases then read the same way at every call site, and "off is a state, not a
delete" is stated once for both.

- Site: `src/core/cycle.ts`
- Site: `src/components/sherpa-data-grid/sherpa-data-grid.ts`
- Site: `src/components/sherpa-quick-filter-toolbar/sherpa-quick-filter-toolbar.ts`
- Site: `test/unit/cycle.test.mjs`

### T-one-value-one-declaration

The focus indicator was written by hand at **48 sites across 29 files** —
`box-shadow: inset 0 0 0 2px var(--sherpa-theme-border-accent-2, #3b4ccd)`,
verbatim each time. `CLAUDE.md` already said "this exact token and fallback,
verbatim", which is the shape of a rule nothing enforces: the doc had named the
WRONG token for months, and everyone who followed it got a ring drawn in the
fallback colour only.

It is a **custom property on `:host` in `sherpa-base.css`**, not a class:

- A bare `:host` cannot wear a class from its own sheet — the note on
  `.sherpa-border-edges` records the same problem, and seven sites there still
  write the widths inline because of it.
- The 48 selectors are all DIFFERENT (`&:focus-visible`, `.upload:focus-visible`,
  `::slotted(:is(label, button):focus-visible)`). The declarations repeat; the
  rule does not. A class can only share a rule.
- Custom properties inherit through every shadow boundary, so one declaration in
  the adopted sheet reaches all 58 components. Verified in Chromium before the
  change, and after: a real keyboard focus renders
  `rgb(59, 76, 205) 0px 0px 0px 2px inset`, identical to before.

`.sherpa-truncate` and `.sherpa-inert` went in as CLASSES for the opposite
reason: they apply to inner nodes, where a class is reachable, and they are
whole rules rather than one value.

**`.sherpa-inert` carries only the two INTERACTION declarations.** The colours
stay per-component, because each picks a different inactive token — and never
`opacity`, which compounds in dark mode.

- Site: `src/core/sherpa-base.css`
- Site: `src/components/sherpa-data-grid/sherpa-data-grid.css`

### T-motion-is-owned-here

**`CLAUDE.md` told components not to write a `prefers-reduced-motion` block
because "motion gating is owned globally". Nothing owned it.** Searched
`src/`, `src/styles/` and `examples/`: zero matches. Every animation in the
library ignored the setting, and the rule that forbade a local fix was the
reason nobody added one.

The gate is in `sherpa-base.css`, which every shadow root adopts. It sets
`animation-duration` rather than `animation: none`, so a paused animation lands
on its END state instead of snapping back to its start — and `!important`,
because a component's own rule outranks a shared sheet's and this has to win
everywhere. Verified in Chromium with `reducedMotion: 'reduce'`: the loader's
spin and the data grid's row transition both drop to `1e-05s`, including on
`::after`.

Two other things live there for the same reason:

- **`@keyframes sherpa-spin`.** `sherpa-container` and `sherpa-loader` each
  defined one rotation, byte-identical. A keyframe in an adopted sheet is
  reachable from a component's own rules — verified: the loader animates
  `sherpa-spin` at `0.8s` with no local definition.
- **A duration scale** — `--sherpa-motion-fast|base|slow`. 84 timing values
  across the components, 72 of them 100ms or 120ms. The outliers are real (80ms
  for a row hover, 300ms for a bar growing), which is why it is a named scale
  and not one value.

A toast's slide and a progress bar's sweep stay local: both are specific to
their component's geometry.

- Site: `src/core/sherpa-motion.css`
- Site: `src/components/sherpa-loader/sherpa-loader.css`
- Site: `src/components/sherpa-container/sherpa-container.css`

### T-anchoring-is-generic

The anchor-positioning machinery in `sherpa-base.css` was named `.chart-tip`,
`.chart-mark`, `.chart-anchor-point`. None of it is chart-specific: it is
`position-anchor` plus `position-try-fallbacks` plus a zero-size anchor point,
which any component could use to place a tip beside any trigger.

It now answers to `.sherpa-tip`, `.sherpa-anchor`, `.sherpa-anchor-point` and
`.sherpa-anchor-el`, **with the `chart-*` names kept as aliases**. Not renamed
outright: five chart components name them across ~38 sites, and one is in a
`.component.yaml` that the spec round-trip gate reads — so a rename is a
migration, and the alias is what makes it a safe one.

Two constraints the machinery carries, worth knowing before reusing it:

- **An anchor cannot cross a shadow boundary.** Trigger and tip must share one
  root. That is why `--_anchor` is supplied by JS: an anchor name cannot be
  derived in CSS.
- **An SVG element cannot be a CSS anchor in Chromium**, which is what the
  zero-size anchor point exists for.

- Site: `src/core/sherpa-anchor.css`

### T-a-document-class-cannot-reach-a-shadow-root

`tokens.css` is `<link>`ed into the page. A **custom property** declared there
inherits across a shadow boundary, so `var(--sherpa-theme-content-size-h1)`
works inside a component. A **class rule** does not: a shadow root matches
selectors against its own adopted sheets only.

The generator had been emitting 27 `.sherpa-text-*` role classes into the theme
layer of `tokens.css`. Measured in Chromium, the same class gave:

```
.sherpa-text-h1 in the document:  24px / 600
.sherpa-text-h1 in a shadow root: 14px / 400   (the inherited default)
.sherpa-text-mono-* in a shadow root: Inter, not ui-monospace
```

Zero of the 58 components used them — which is the tell. A class nobody can
reach looks exactly like a class nobody wanted.

They now generate into `src/core/sherpa-typography.css`, which
`SherpaElement.sharedStyles` adopts into every shadow root beside
`sherpa-base.css`. `tokens.css` emits none of them.

The split between the two folders is the rule to keep: **`src/styles/` is what
the APP links, `src/core/` is what a COMPONENT adopts.** A class belongs in
`core`; a token belongs in `styles`.

- Site: `scripts/project-tokens.mjs`
- Site: `src/core/sherpa-typography.css`
- Site: `src/index.ts`
- Site: `src/core/sherpa-group-positions.css`

### T-import-dies-in-an-adopted-sheet

Shared CSS is split by subject — base, typography, anchoring, motion — and the
obvious way to join them is one entry sheet that `@import`s the rest. It does
not work, and it does not say so.

Measured in Chromium against a constructable sheet whose text begins
`@import url("/b.css");`:

```
sheet.replace(css)      → resolved. No throw, no warning.
[...sheet.cssRules]     → 1 rule. The @import is not even listed.
the imported .from-b    → rgb(0,0,0) / 16px — the defaults. Never applied.
```

`CSSStyleSheet.replace()` drops `@import` by specification; a constructable
sheet has no base URL to resolve one against. The failure is silent, which
makes it the same shape as the bug above it: styles that are simply absent.

So `SherpaElement.sharedStyles` lists **one URL per file**, in cascade order.
The base class already fetches a list and adopts them all — splitting a sheet
costs one line there and nothing else. A new shared stylesheet must be added to
that array or nothing adopts it.

- Site: `src/index.ts`
- Site: `src/core/sherpa-base.css`

### T-a-grid-group-computes-its-own-position

Grouping has three axes in Figma, and `tokens.css` projects all 21 positions.
`sherpa-grouping.css` gives horizontal and vertical a wrapper class that works
by position (`:first-child`, `:last-child`). Grid needs the COLUMN COUNT, and
the obvious route fails:

**`:nth-child()` will not take a `var()`.** Measured: of seven
`.sherpa-group-grid` rules written as `:nth-child(var(--cols) n + 1)`, the
browser kept **three** — every `var()` selector was dropped from `cssRules`
with no error. The surviving `:first-child` rule made one cell look correct by
luck, which is how it nearly shipped.

The position is computed in a VALUE instead, where `sibling-index()` IS
allowed. Set `--cols` on the wrapper; each cell derives the rest:

```css
--sherpa-group-index: calc(sibling-index() - 1);
--sherpa-group-col: calc(var(--sherpa-group-index)
  - var(--cols) * round(down, calc(var(--sherpa-group-index) / var(--cols)), 1));
--sherpa-group-row: round(down, calc(var(--sherpa-group-index) / var(--cols)), 1);
--sherpa-group-last-row: calc(round(up, calc(sibling-count() / var(--cols)), 1) - 1);
```

`round(down, …)` stands in for `mod()`, which Chromium does not have.
`if(style(--sherpa-group-col: 0): …; else: …)` then picks each edge. Verified
in Chromium 153 and WebKit 26 on a 3x2 grid and on 7 cells in 3 columns — the
partial last row lands correctly, because `--sherpa-group-last-row` comes from
`sibling-count()`.

So a re-order, an insert or a delete needs nothing from JS. Behind the
`@supports (width: if(...))` gate every cell keeps a full outer box, which is
correct, just not joined.

The class was also doing half a job before this: it squared corners but never
set the border WIDTHS, so two neighbours each drew a full hairline and doubled
it. `.sherpa-group` now sets both.

- Site: `src/core/sherpa-grouping.css`
- Site: `test/e2e/reforged-grouping.spec.ts`

### T-at-property-needs-the-document

**`@property` in an adopted stylesheet does not register.** It parses, it lists
in `cssRules` as a `CSSPropertyRule`, and `CSS.supports('--x', '1')` returns
**true**. None of that is registration: the value stays an untyped string, so
arithmetic never computes and `if(style(--x: 0))` never matches.

Measured. The same cells, same sheet, same shadow root:

```
adopted sheet only:           "calc(sibling-index() - 1)"   ← raw text
then registered in document:  "0", "1", "2"                 ← same cells
```

So the five `--sherpa-group-*` used by `.sherpa-group-grid` are registered in
`tokens.css` (a document `<link>`), while the RULES that use them stay in the
adopted sheet. `scripts/project-tokens.mjs` emits the block.

This is the third member of a family worth naming together, because they fail
the same silent way and were each found by measuring rather than reading:
`@import` is dropped from an adopted sheet
(T-import-dies-in-an-adopted-sheet), a document class rule cannot reach a
shadow root (T-a-document-class-cannot-reach-a-shadow-root), and `@property`
cannot register from one.

`src/` used to hold 16 more of these in component sheets — sparkline (10),
slider (3), gauge (2), barchart (1) — every one commented "typed so it
animates". **They were deleted 2026-09-22.** Three things were true of all of
them:

- They never registered, being in adopted sheets.
- Nothing animates a custom property anywhere in `src/` — grepped.
- JS writes each as a FINISHED string (`"5"`, `"30%"`, `"18deg"`) and the CSS
  only reads it back, so no type was needed.

Proof they did nothing: a browser snapshot of `--_v0`, `--_min`, `--_range`,
`--_len`, `--_pct`, `--_fill-pct`, `--_angle` and `--_h` was taken before and
after removal and came back **byte-identical**. 576 tests unchanged.

The lesson is the comment, not the code: sixteen blocks claimed to enable an
animation that does not exist, in a place the feature cannot work. A comment
that explains a mechanism is worth checking against whether the mechanism runs.

- Site: `src/core/sherpa-grouping.css`
- Site: `scripts/project-tokens.mjs`
- Site: `src/components/sherpa-sparkline/sherpa-sparkline.css`
- Site: `src/components/sherpa-slider/sherpa-slider.css`
- Site: `src/components/sherpa-gauge-chart/sherpa-gauge-chart.css`
- Site: `src/components/sherpa-barchart/sherpa-barchart.css`
- Site: `test/e2e/reforged-grouping.spec.ts`

### T-grouping-is-an-attribute-and-a-class

Grouping — making a row, column or grid of controls read as ONE object — has
two doors, and both are real:

| | |
|---|---|
| `data-group="start"` | the POSITION, stated. Works from an HTML template or a JS property change, with no CSS of its own. The 21 Figma positions: `solo`/`start`/`mid`/`end`, `vertical-*`, `grid-{top,mid,bottom}-*` |
| `.sherpa-group` on a wrapper | DERIVES the same thing by position, so a re-order, insert or delete needs nothing |

The attribute is the configuration channel and matches every other Sherpa API:
`data-*` in, CSS responds. The class is for a container that owns its children
and would otherwise re-stamp attributes on every change.

**The blocks are emitted TWICE, and that is deliberate.** A bare
`[data-group="start"]` in `tokens.css` can never match an element inside a
shadow root; the same rule in an adopted sheet can never match one in the page.
A host app groups controls in its own markup and a component groups them in its
template, so `scripts/project-tokens.mjs` writes the generated blocks to both
`tokens.css` and `src/core/sherpa-group-positions.css`. Removing either half
silently un-joins one of the two.

**Two renames cleared the way.**

`data-snap` is gone. It was written at 38 sites across 5 components and styled
by **nothing** — grepped: not one CSS rule anywhere selected on it, and seven
component comments existed only to explain that the `[data-snap]` rules in
`tokens.css` never reached a shadow root. Its values also named the SIDE that
was snapped rather than the position, so `data-snap="right"` meant the item sat
at the START of a row. Migrated: `right`→`start`, `left`→`end`, `all`→`mid`.

`sherpa-data-grid` used `data-group` for something else entirely — the group
KEY of a row, an arbitrary value like `"EMEA"` or a status. That collided: a key
of `"end"`, `"mid"` or `"solo"` would have silently restyled that row's borders.
It is now `data-group-key`, which is internal — 8 `dataset` sites plus one CSS
selector in a test, and nothing outside the component reads it.

- Site: `scripts/project-tokens.mjs`
- Site: `src/core/sherpa-group-positions.css`
- Site: `src/core/sherpa-grouping.css`

### T-a-shared-edge-is-halved-on-both-sides

Will's ruling, 2026-09-15. An edge SHARED with a neighbour is aliased one step
down the width ramp — `sm` 0.5px → `xs` 0.25px — on **both** items. The two
halves meet at zero spacing and read as one full-weight stroke.

It is not drawn once by one side, and never overlapped negatively. Getting this
wrong is invisible in a screenshot and invisible to `getComputedStyle`, which
floors every sub-pixel border to `"1px"`
(T-a-sub-pixel-border-reads-back-as-1px) — so a joint of 0.75px reads exactly
like a correct one. Read the custom property.

A corner is round only when BOTH of its edges are outer.

`.sherpa-group` got this wrong on its first pass: it halved only the start edge
and let the neighbour keep a full one. The `[data-group]` tokens, which come
from Figma, are what caught it.

- Site: `src/core/sherpa-grouping.css`

### T-a-summary-binds-to-all-the-rows

`DataSource.bind()` hands a component `#result.rows`, which is **the page** —
`applyOptions` slices to `skip`/`take` and reports the pre-slice count
separately as `total`. That is right for a grid and wrong for every summary: a
chart bound the default way on a 25-row page of 100 records counts 25, draws a
perfectly reasonable picture, and is silently wrong.

`scope: 'all'` is the fix. The adapter is handed every row matching the filter,
unpaged:

```js
source.bind(chart, { readonly: true, scope: 'all', as: (rows) => countBy(rows, 'status') });
```

Three things make it safe:

- **It costs nothing when unused.** The second, unwindowed store call happens
  only while some bind asks for it (`#wantsAllRows`), and is skipped entirely
  when the query was never windowed — no `pageSize`, or grouped, where the page
  already IS everything. A node test asserts every store call still carries its
  window when no summary is bound.
- **A LATE bind still fills.** Binding a summary after the first load would
  otherwise find `#allRows` empty and draw blank, because nothing would ask
  again; `bind` forces a reload in that one case.
- **The skip-if-unchanged guard follows the scope.** It compares the array this
  particular bind receives, not `#result.rows` — otherwise a summary would be
  skipped whenever the page array happened to be unchanged.

`examples/views/dashboard.js` predated this and was correct only by accident:
its source declares no `pageSize`, so nothing was ever sliced. It now says
`scope: 'all'` outright, because that luck is one added pageSize from running
out.

- Site: `src/core/data-source.ts`
- Site: `test/unit/summary-scope.test.mjs`
- Site: `examples/views/records.js`
- Site: `examples/views/dashboard.js`

### T-a-legend-toggle-is-a-filter

Turning a legend row off used to call `setSliceHidden(i)` — a DRAWING trick on
one chart. That bar vanished and nothing else on the page knew: the other
charts, the metric tiles, the grid and its pager all carried on counting the
rows the reader had just said to exclude.

A legend toggle is a **filter**, scoped to the view. `bindLegendFilter` writes
it as a named part:

```js
bindLegendFilter(legend, source, {
  field: 'status', values: states, chip: { el: qft, id: 'status' }, signal,
});
```

One click then writes `['status', 'ne', 'churned']` (or `notin` for several)
into `source.contribute('legend:status', …)`, and every bound component
re-reads. Measured on Records: clicking "churned" took the metric from 100 to
75, recounted the DONUT legend to 18/20/18/19 and dropped the grid from four
pages to three.

Four things the rule gets right, each with a test:

- **An empty set removes the part**, rather than adding a clause nothing fails.
- **The key is `legend:<field>`**, so two legends over different fields never
  overwrite each other, and neither disturbs the chips' own part.
- **A chip over the same field is the SAME state wearing a menu.** The menu
  lists what is still ON, because a filter names what it keeps; picking in it
  dims the legend in kind.
- **Nothing ticked means no constraint**, not "hide everything" — the reading
  the rest of the toolbar already uses.

`examples/views/dashboard.js` is converted too — clicking "Disk" takes its
Alerts tile from 1284 to 881 and recounts the donut legend to sum to 881. Its
LINE legend is the one that stays a per-chart hide: those labels name two
SERIES ("Sessions" is every non-critical row), not values of one field, so
there is nothing to filter on and inventing a field would be a lie.

- Site: `src/core/legend-filter.ts`
- Site: `src/data.ts`
- Site: `test/unit/legend-filter.test.mjs`
- Site: `examples/views/records.js`
- Site: `examples/views/dashboard.js`

### T-a-legend-remembers-its-off-set-by-label

`sherpa-chart-legend` had no memory and no public door. `#render()` never wrote
`aria-pressed`, so **every re-populate silently cleared the toggles** — which a
source push does on any filter change. And nothing outside could set them, so a
chip over the same field had no way to push back.

It now keeps an off-set and exposes it as `legend.off`.

**By LABEL, not by index.** A re-populate re-orders and re-counts: a filter that
removes a category shifts every index below it, so an index-keyed set would
dim the wrong row. `countBy` puts the field VALUE in `label`, which is also
exactly what the filter needs — no lookup table.

The getter is the read-back door the ownership rule asks for: a host that SET
something needs to ask what the component now holds.

**A roll-up row records what it FOLDED.** Its own label is "Other", which is a
value of nothing: recording that dims the row and narrows nothing, which is
exactly what the dashboard did on the first pass — clicking Other left the
count at 1284 and `off` reading `["Other"]`. It now records the real
categories, and reads as ON while any of them is.

- Site: `src/components/sherpa-chart-legend/sherpa-chart-legend.ts`
- Site: `test/e2e/reforged-chart-legend.spec.ts`

### T-a-host-attribute-is-declared-once

A `:host([data-x])` rule is a PUBLIC API: a host sets the attribute and the
component restyles. Undeclared, it is a contract between the CSS and nothing —
invisible to the TS, to the generated `.component.yaml`, and to any agent
reading either.

**65 of them were in that state, across 31 of 58 components.** Measured the
moment anything looked: `data-align`, `data-gap` and five more on
`sherpa-stack`; eight on `sherpa-app-header`; four on `sherpa-list-item`. Only
27 components declared `static props` at all, holding 45 entries between them.

They are now declared as `kind: 'style'`, which generates no DOM writes — it
says the attribute is REAL. 576 Playwright tests stayed green, which is the
point: the gap was never visible as a bug, only as a missing contract.

`scripts/check-props.mjs` gates it. Three things it deliberately does not flag,
because each is already named somewhere true:

| | |
|---|---|
| `data-has-*` | the base class writes it from slot presence |
| `[data-x]` with no `:host()` | an inner element — component-private |
| `data-status`, `data-look`, `data-elevation`, `data-density`, `data-theme` | CASCADES. An ANCESTOR sets these and any component may read them, so declaring one would claim ownership it does not have |

That last row is why `sherpa-select-checkbox` and `sherpa-select-radio` still
carry an undeclared `:host([data-status])` and are right to.

**The READ half, added 2026-09-22.** `this.dataset['x']` is the same public
attribute arriving, so it carries the same obligation. Measured across the 58:
**392 sites reach a component's own attributes six different ways** — 183
`dataset` reads, 101 `hasAttribute`, 52 `toggleAttribute`, 36 `setAttribute`,
18 `getAttribute`, and `this.set()` exactly twice.

169 of the 183 reads named an attribute the component already declared, which
is the declaration pass holding. Nine did not, and are now declared:

| | |
|---|---|
| `data-bounds` ×3 | a selector for the box a popover must stay inside, passed DOWN by the host. One meaning in three components, so it went to `SHARED_PROPS` |
| `data-total-pages` | already in `DATA_PROPS`; the grid now reads from there rather than growing a copy |
| `data-select`, `data-anchor`, `data-value`, `data-heading`, `data-has-caption` | one component each |

`observed` and `variantAttrs` count as declarations — both name the attribute
in the same file, and three `data-type` reads that first looked like gaps were
already declared as variant attributes.

The gate checks only `this.dataset`. A local `cal.dataset['value']` is another
element's business, and counting it reported five phantom gaps.

- Site: `scripts/check-props.mjs`
- Site: `src/core/sherpa-element.ts`

### T-a-bare-name-must-be-used-not-mentioned

The spec generator reads the `Public API:` comment, where a wrapped prose
sentence reads exactly like an entry — `stretch — ONE wide control fills the
row` is the tail of `data-align`'s description. So a bare (non-`data-*`) name
must be FOUND in the code, in one of the spellings that means use: a CSS
selector `[name`, an HTML attribute `name=`, a single-quoted `'name'`, or a
`dataset` read.

Declaring `data-align`'s values broke that guard. Every enum value arrives
single-quoted — `values: ['start', 'end', 'between', 'stretch']` — which is
the one spelling the check trusts, so the phantom `stretch` prop passed the
test that exists to catch it, and `sherpa-container-footer` grew a second prop
literally named `stretch`.

The fix blanks `values: [...]` lists before the search. A DOUBLE-quoted match
was already excluded for the same reason: `"stretch"` is a VALUE in
`[data-align="stretch"]`.

Worth remembering as a shape: a guard that reads the source for evidence gets
weaker every time the source gains a new place to spell something.

- Site: `scripts/generate-component-spec.mjs`

### T-the-shared-vocabulary-is-declared-once

An attribute more than one component declares is a SHARED contract, and it was
being spelled once per component. Measured across the 58: `data-heading` in 9,
`data-type` in 8, `data-size` and `data-legend` in 3 each.

Two of those groups are fine as they are. A `kind: 'content'` entry differs
only in its `to:` selector — `.title` vs `.heading-text` vs `.heading` — and
that selector IS the component's own DOM, so nine copies of
`type: 'string', kind: 'content'` are repetition, not duplication. Moving them
would mean the base class guessing at a class name.

The `kind: 'style'` ones are not fine, because a copy can be WRONG and nothing
says so. `sherpa-grid-cell` declared `data-sort-direction` with values
`['asc']` — missing `desc`, and missing the empty string that means SUSPENDED
(T-a-suspended-sort-is-one-owners-job). Its generated spec said so too, which
is what an agent reads.

`src/core/sherpa-element.ts` now exports two objects:

| | |
|---|---|
| `DATA_PROPS` | the seven attributes `DataSource.#push` writes on every bound component, plus `data-locked`. A component declares one to say it READS it |
| `SHARED_PROPS` | style attributes whose shape is identical wherever they appear — `data-size`, `data-orientation`, `data-legend` |

`scripts/check-ownership.mjs` reads `DATA_PROPS` out of that file rather than
keeping its own list, which was a fifth copy of the same seven names. Verified
live: adding an eighth entry made the gate report eight.

Three `data-orientation` declarations WIDENED as a result, from one value to
both. That is a fix: each CSS selects on one value and treats the other as the
default expressed by the attribute's absence, so declaring only the selected
one under-described the API.

- Site: `src/core/sherpa-element.ts`
- Site: `scripts/check-ownership.mjs`
- Site: `src/components/sherpa-grid-cell/sherpa-grid-cell.ts`

### T-a-suspended-legend-row-keeps-its-place

Will, 2026-09-22: *"I just want it to be set to an inactive state so that it
can be toggled back on. Kinda like how we can toggle filter chips without
losing the chip or set value."*

Once a legend toggle became a FILTER (T-a-legend-toggle-is-a-filter), turning a
row off deleted it. The chain is short and each link is correct on its own:

1. The click writes `['status', 'ne', 'churned']` into the source.
2. The source pushes the filtered rows.
3. `countBy` returns one datum per category **present in those rows** —
   `includeEmpty` is off by default, because an empty bar for a category
   nothing matched is normally noise.
4. `churned` has no rows, so it is absent, so the legend drops it.

A row that is gone cannot be switched back on. Measured: clicking "churned"
left three rows of four, while `legend.off` still correctly read
`["churned"]` — the STATE was right and only the drawing was wrong.

The legend now remembers the last datum it saw for each label and re-inserts a
suspended one, in its original place, at the value it last held. So the row
reads `churned 25`, greyed, rather than `churned 0` or nothing — the same way a
filter chip keeps its set value when you switch it off.

**Not fixed with `includeEmpty: true`.** That would show `churned 0`, which is
a different claim: zero records match, rather than this category is excluded
from the question. And it would put the burden on every caller.

This is the suspend-versus-clear rule in a new place. "Off" keeps the value;
"gone" deletes it. Collapsing them has now cost a typed filter, a sort column
and a legend row.

- Site: `src/components/sherpa-chart-legend/sherpa-chart-legend.ts`
- Site: `test/e2e/reforged-chart-legend.spec.ts`

### T-one-comparison-rule-for-query-and-ui

The data layer compares LOOSELY: `looseEqual` lower-cases both sides, so
`['plan', 'in', ['free']]` matches a row holding `'Free'`. That is deliberate,
and it is why the Records example can lower-case its chip option values and
still filter correctly.

Three components compared EXACTLY — `sherpa-quick-filter`, `sherpa-menu`, and
the legend binding. So a value travelling BACK from the query never matched its
own control:

- The Plan chip's menu rows are `free`, `starter`, `pro`.
- A legend toggle handed the chip `['Free', 'Starter', 'Enterprise']`.
- `new Set(next).has('free')` is false, so nothing ticked. The chip stayed off
  and empty while the filter it described was running.

The inverse was worse. Chip picks (`'free'`) tested against legend values
(`'Free'`) matched nothing, so the binding hid EVERY row: 100 records became 0.

`looseEqual` and `valueSet` are now exported from `store.ts` and used by all
three. One rule, in the layer that owns the question.

The shape to remember: a comparison duplicated between the query and the UI is
a contract with no gate on it, and it only breaks on the return journey — the
outbound path works, which is what makes it hard to see.

- Site: `src/core/store.ts`
- Site: `src/core/legend-filter.ts`
- Site: `src/components/sherpa-quick-filter/sherpa-quick-filter.ts`
- Site: `src/components/sherpa-menu/sherpa-menu.ts`

### T-one-field-does-not-own-the-whole-map

`sherpa-quick-filter-toolbar`'s `values` setter takes the WHOLE map, and a chip
the map does not name is switched off. Right for a view restoring its entire
filter state; wrong for anything owning one field.

A legend bound to `plan` wrote `{ plan: [...] }`, which switched off the Status
chip beside it. Measured: the Status chip went ON, then off again the moment an
unrelated legend moved, with its own values untouched.

`setChipValues(id, picks)` sets one chip and leaves the rest alone. `undefined`
leaves it untouched; an empty list clears it — see
T-everything-on-is-no-filter.

- Site: `src/components/sherpa-quick-filter-toolbar/sherpa-quick-filter-toolbar.ts`
- Site: `src/core/legend-filter.ts`
- Site: `test/unit/legend-filter.test.mjs`

### T-everything-on-is-no-filter

Will, 2026-09-22: *"when all legend items are active then we can clear the
filter chip selection and turn the filter chip off. Same outcome but a
different visual representation."*

Every value selected and no filter at all return the same rows, so only one of
them should LOOK like a filter. The binding used to tick all four values, which
left a chip reading "3 Plan Enterprise…" while nothing was being excluded.

Clearing takes two steps, and `current = false` alone is not enough: the chip
keeps its badge and value label, so it reads as set while claiming to be off.
`values = []` unticks every row and re-derives the face; the `current = false`
that follows is what makes it read as unset.

- Site: `src/core/legend-filter.ts`
- Site: `src/components/sherpa-quick-filter-toolbar/sherpa-quick-filter-toolbar.ts`
- Site: `test/unit/legend-filter.test.mjs`

### T-a-legend-keeps-one-row-on

Will, same message: *"at least 1 must be active at all times so we need to
prevent toggling of the last active legend item."*

Hiding the last row leaves an empty chart beside an empty grid and no obvious
way back — and it is not a question anyone asks. The click is REFUSED and the
legend is put back as it was, rather than left dimmed over an unchanged filter.

The floor is applied in three places, because all three can reach the same
state: the legend click, a chip pick that unticks everything, and the
programmatic `set()`.

- Site: `src/core/legend-filter.ts`
- Site: `test/unit/legend-filter.test.mjs`

### T-a-date-chip-names-its-field

Two faults in the Records example's header date chip, both of which made it
look broken when the machinery underneath was fine.

**It was labelled "Date range".** A chip names the FIELD it filters — "Created
date" — because a reader cannot act on one that does not say which date.
`Region` and `Customer` beside it both name their field; this one named its
shape.

**Its calendar offered days the data does not have.** `globalFilters` defaulted
`availableDates` to the last 90 days, while every `created` date in Records
falls in 2024. So only days no record could match were pickable, and the chip
could not narrow anything — the definition of meaningless.

`globalFilters(views, regions, customers, dates)` now takes the dates, and
Records passes `[...new Set(customers.map((c) => c.created))].sort()` — the
days its own records actually carry. Verified: 2024-01-01 to 2024-06-30 gives
52 of 100.

Two things checked while chasing this, both FINE and worth recording so the
next reader does not chase them again:

- **The Customer chip is not broken; it COMMITS.** A multi-select menu defers
  behind Apply by default (T-commit-follows-select-mode), so ticking a row and
  walking away does nothing. Picking Northwind then pressing Apply gives 10 of
  100.
- **A date chip does not report through `chip.values`.** Its picks live on the
  nested `sherpa-calendar` as `data-value-start` / `data-value-end`, which
  `#chipPicks` reads. Setting `chip.values` on one looks like it worked and
  reports nothing.

- Site: `examples/views/global-filters.js`
- Site: `examples/views/records.js`

### T-any-component-can-be-bound

Will, 2026-09-22: *"Any UI component should be able to ask the data layer. It's
not restricted to certain components… The same goes for showing data. Granted
the data may just be 1 text label, or even no data at all gets shown, but the
capability should be there for any UI component."*

Half of that was already true and half was not, which is the interesting part.

**ASKING was always generic.** `bind()` never checked a type. Measured: a plain
`sherpa-button`, bound and handed a `sort-change`, steered the query, took
`data-locked`, and received `data-sort-field="tier"` back. There is no
allow-list anywhere — `STEERING_EVENTS` names the events, not the elements
permitted to send them.

**SHOWING was not.** `renderData` defaulted to a no-op, and only 23 of 58
components overrode it. The other 35 could be bound, would receive a payload,
and would draw nothing — so the capability looked component-specific when only
the rendering was.

The base class now has a default: a payload's keys are written onto the
attributes the component DECLARES, and the existing prop sync does the rest.
`{ heading: '40 records' }` becomes `data-heading`, which `sherpa-section-header`
already declares as `kind: 'content'` with `to: '.title'`.

Three constraints make it safe:

- **Only DECLARED keys land.** A payload shaped for a grid, handed to a header,
  writes its `heading` and drops `totalPages`, `columns` and the rest. Without
  that, one adapter's keys become another component's attributes.
- **A component with its own `renderData` is untouched.** This is what it
  replaces, not something it must call.
- **A component declaring nothing shows nothing**, which is correct.
  `sherpa-progress-bar` has no props; `sherpa-tag` takes its label as slotted
  content. Neither is a gap.

The camelCase → kebab mapping matches the props system: `iconStart` becomes
`data-icon-start`, and a key already spelled `data-*` is taken as written.

- Site: `src/core/sherpa-element.ts`
- Site: `test/e2e/reforged-any-component-binds.spec.ts`

### T-mirroring-skips-value

A component wrapping a real `<input>` keeps the two in step by copying native
attributes down. Three wrote the same loop — `sherpa-select-checkbox`,
`sherpa-select-radio` and `sherpa-input-text` — so it is now
`SherpaElement.mirrorAttrs(control, attrs)`.

**`value` is skipped, deliberately.** It is a PROPERTY on a live control, and
writing the attribute after the reader has typed puts the old text back. Each
caller assigns `control.value` itself, with its own default: `'on'` for a
checkbox, `''` for a radio, the typed text for an input.

The LIST stays with the caller. An input mirrors `placeholder`, `pattern`,
`minlength` and `maxlength`; a checkbox mirrors four attributes. Moving the
list would mean one component silently mirroring attributes that mean nothing
to it.

What a wider sweep found, recorded so it is not re-run: across 58 components
there are **110 runs of four or more identical lines shared by two or more**,
and after `mirrorAttrs` the largest remaining is three lines of boilerplate
shared by `sherpa-chip` and `sherpa-tag` — a `templateId` getter and a remove
handler that fire different events. Both components are 30–40 lines; a shared
base would cost more than it saves.

`this.clone()` appears at 39 sites in 6 components, and they do genuinely
different work — a legend swatch, an empty state, a nested nav row. That was
already settled on 2026-09-17 when `renderRows`/`cloneRow` was built, measured
to fit only 8 of 28 stamp sites, and removed again.

- Site: `src/core/sherpa-element.ts`
- Site: `src/components/sherpa-select-checkbox/sherpa-select-checkbox.ts`
- Site: `src/components/sherpa-select-radio/sherpa-select-radio.ts`
- Site: `src/components/sherpa-input-text/sherpa-input-text.ts`

### T-an-alias-is-declared-by-its-owner

A back-compat alias belongs to the entry that reads it, not to an entry of its
own. `sherpa-list-item` takes `data-label` and accepts `data-heading` as the
older spelling:

```ts
'data-label': { type: 'string', kind: 'content', to: '.title', all: true,
                fallbackAttr: 'data-heading' },
```

The 2026-09-22 declaration sweep added a SECOND entry for `data-heading`
writing the same `.title` — and without `all: true`, so it wrote only the first
of the two nodes that exist in that template, leaving the pair disagreeing
whenever the alias was used.

`scripts/check-props.mjs` now counts a `fallbackAttr` as a declaration, which
is what it is: the attribute is named in the same file and handled by the entry
that owns the target.

This is the shape of the sweep's one real risk — a gate that asks "is this
name declared?" invites an answer that satisfies the gate rather than the
contract.

- Site: `src/components/sherpa-list-item/sherpa-list-item.ts`
- Site: `scripts/check-props.mjs`

### T-a-layout-read-belongs-in-a-frame

`sherpa-menu` re-places itself on scroll so an open card follows its trigger.
`#place()` reads two boxes — the trigger's and the card's — and it was bound
with a plain listener, so it ran **per scroll EVENT** rather than per frame.

Measured on an open chip menu in the Records example: **50 scroll events
produced 100 `getBoundingClientRect()` calls**. After throttling, **2**.

`SherpaElement.onFrame(target, type, handler, options)` coalesces to one call
per animation frame. `on()` is the same without the throttle, for a handler
that reads no layout — `sherpa-tooltip` HIDES on scroll rather than re-placing,
so it takes `on()`.

Both carry the element's disconnect signal, so nothing needs removing. That
replaced 22 hand-paired add/remove sites across seven files, two of which
removed unconditionally on disconnect whether or not anything had been added.

**`while` is the second lifetime.** A popover's viewport listeners live while
it is OPEN, not while the element exists, so the caller passes its own signal
and the base class ANDs the two with `AbortSignal.any`. Without it, the
listeners would outlive every close.

One measuring note, because it wasted a pass here: **an `AbortSignal` removal
does not call `removeEventListener`**, so wrapping those two methods to count
live listeners reports a leak that is not there. Count them through CDP's
`DOMDebugger.getEventListeners` instead — which showed zero scroll and resize
listeners on `window` both before and after five open/close cycles.

- Site: `src/core/sherpa-element.ts`
- Site: `src/components/sherpa-menu/sherpa-menu.ts`
- Site: `src/components/sherpa-tooltip/sherpa-tooltip.ts`
- Site: `test/e2e/reforged-menu.spec.ts`

### T-a-tooltip-is-not-an-axis

An axis COMPACTS because it carries four labels and has no room: `1.3M`, not
`1250500`. A tooltip carries ONE label and exists **because** the reader wants
the number.

Four charts shared `formatTick` for both, so a bar worth 1,234 read as
**"1.2K"** in the one place precision was asked for. Measured on the dashboard
before the fix:

```
tips: ["1.2K", "1.3M", "7.3"]      values: 1234, 1250500, 7.25
axis: ["0", "312.6K", "625.3K", "937.9K", "1.3M"]
```

`formatValue` is the tooltip's formatter. It groups — 1250500 is unreadable
without separators — and keeps decimals as they arrive, because `reduceRows`
returns a mean unrounded on purpose and rounding is a presentation decision the
caller has already made.

The axis still compacts. Both are correct for their own job; sharing one
function was the mistake.

- Site: `src/core/format-tick.ts`
- Site: `src/components/sherpa-barchart/sherpa-barchart.ts`
- Site: `src/components/sherpa-line-chart/sherpa-line-chart.ts`
- Site: `src/components/sherpa-donut-chart/sherpa-donut-chart.ts`
- Site: `src/components/sherpa-sparkline/sherpa-sparkline.ts`
- Site: `test/e2e/reforged-barchart.spec.ts`

### T-a-delta-is-derived-not-declared

`sherpa-metric` derives its TREND from `deltaPercent` and its STATUS from the
trend (T-metric-status-follows-the-trend). So a tile handed only a `label` and
a `value` is grey — there is nothing to colour.

That is what happened when the dashboard's tiles stopped being a hardcoded
table and became adapters over the source: each passed a label, a value and a
sparkline series, and every tile lost its status ink.

`deltaPercent(values)` in `aggregate.ts` computes it from the series the tile
already draws — first point to last. `null` when there is nothing to compare:
fewer than two points, or a first point of zero, where the change is undefined
rather than infinite.

**And round it.** The component interpolated the raw number, which never showed
because every earlier caller passed a tidy literal like `3.1`. A derived delta
arrived and the tile read `-0.6211180124223602%`. **Two decimals** (Will,
2026-09-22), in the component, because a percentage is a presentation value.

- Site: `src/core/aggregate.ts`
- Site: `src/components/sherpa-metric/sherpa-metric.ts`
- Site: `examples/views/dashboard.js`

### T-a-draft-dies-with-its-menu

A committing menu holds its ticks as a DRAFT until Apply
(T-commit-follows-select-mode). Cancel restored the baseline; closing any other
way — Escape, clicking away — did not.

So a reader who ticked "Northwind" and walked away left the chip holding
`["Northwind"]` with `current` false: it LOOKED set and filtered nothing. Worse
than no result, because the control disagreed with the data.

The close branch of `#onToggle` now restores the baseline, guarded by an
`#applying` flag so Apply and Cancel — which both call `hide()` — keep the
values they just decided.

- Site: `src/components/sherpa-menu/sherpa-menu.ts`
- Site: `test/e2e/reforged-menu.spec.ts`

### T-a-chart-datum-is-reachable-without-a-pointer

A chart's tooltip carries the NUMBER. If only `:hover` reveals it, the number
is pointer-only — the chart draws data a keyboard reader cannot get at.

`sherpa-barchart` and `sherpa-line-chart` already made each mark a `<button>`,
so both were fine. `sherpa-donut-chart` and `sherpa-gauge-chart` lit their tips
from `:hover` on an SVG arc with no `tabindex`, so **zero** of their data was
reachable. Measured before the fix:

```
#bar   8 focusable   #line  16 focusable
#donut 0             #gauge  0
```

The gauge's own comment said the accessible name went "on the ARC, which is
what a reader reaches" — the name was there and nothing could reach it.

Both now set `tabindex="0"` alongside the `role="img"` and `aria-label` the arc
already carried, and their `:has()` chains match `:is(:hover, :focus-visible)`.
An SVG `<path>` takes focus from `tabindex` perfectly well; it is only as a CSS
ANCHOR that it fails (T-anchoring-is-generic), which is what the separate
zero-size hotspot exists for.

`role="img"`, not `button`: the path IS the datum, not a control that does
something.

- Site: `src/components/sherpa-donut-chart/sherpa-donut-chart.ts`
- Site: `src/components/sherpa-donut-chart/sherpa-donut-chart.css`
- Site: `src/components/sherpa-gauge-chart/sherpa-gauge-chart.ts`
- Site: `src/components/sherpa-gauge-chart/sherpa-gauge-chart.css`
- Site: `test/e2e/reforged-chart-keyboard.spec.ts`

### T-a-total-says-so-in-its-label

A metric tile takes a `values` series, so it can show the LAST reading — what
a current-state tile means — or the SUM, for things that accumulate. `show:
'last' | 'total'` picks, defaulting to `last`.

**A total prefixes its own label.** Two tiles reading "Alerts 1,284" and
"Alerts 37" are indistinguishable on screen; "Total alerts" and "Alerts" are
not. A label that already begins with "Total" is left alone, so nothing reads
"Total total spend".

**An explicit `value` always wins.** Deriving over the caller's own number
would silently disagree with it; `show` only answers when nothing else has.

The derived number is grouped, because a total runs large — a series of
1000, 2500 and 900 reads `4,400`.

- Site: `src/components/sherpa-metric/sherpa-metric.ts`
- Site: `test/e2e/reforged-metric.spec.ts`

### T-the-scale-is-as-wide-as-the-ring

`sherpa-gauge-chart` puts min · caption · max on one row beneath the arc, and
that row took the HOST's width while the ring takes `.gauge-wrap`'s — capped at
`--_max-size` and holding a 2:1 ratio.

So in a host wider than 320px the ring sits centred with space either side, and
the 0% and 100% labels landed out in that space, clear of the arc they label.
Measured on the dashboard: the ring spanned **908–1228** while the labels sat
at **889** and **1247**. The 50% tick looked right because it is centred, which
is the same place under either width.

The scale now carries the same `max-inline-size`. After: both labels sit
exactly at the ring's edges, overhang zero.

- Site: `src/components/sherpa-gauge-chart/sherpa-gauge-chart.css`

### T-the-centre-totals-what-the-ring-draws

A donut's centre reads the TOTAL of the slices it draws, unless the host named
its own `data-label`.

It used to be a plain attribute, so the dashboard carried `data-label="1,284"`
— a string that stayed put while the ring beneath it redrew on every filter.
The Records donut, added later, simply had none and showed nothing.

Deriving it means the number and the ring can never disagree. A HIDDEN slice
leaves the total, because the ring no longer counts it either: three slices of
40, 35 and 25 read `100`, and hiding the first reads `60`.

`data-label` still wins when a host names the centre, and an empty ring claims
nothing rather than `0`.

- Site: `src/components/sherpa-donut-chart/sherpa-donut-chart.ts`
- Site: `test/e2e/reforged-donut-chart.spec.ts`

### T-a-toggle-is-a-clause-not-a-value

A TOGGLE chip is a whole clause the reader flips on or off — a question the
data answers yes or no. A MENU chip picks values of a field.

The Records example had four toggles named `Active`, `Trial`, `Suspended` and
`Churned` sitting beside a `Status` menu chip: one field with two controls on
one bar, and no way to tell which was in force.

They are now three toggles over fields no menu covers — `openTickets > 0`,
`health < 60`, `owner = Unassigned` — reading "Open tickets", "At risk" and
"Unassigned". Measured: 90, 27 and 27 of 100.

Each ON toggle contributes its own clause, ANDed with the rest, so two toggles
NARROW. The old status set ORed instead, because four values of one field
cannot all be true at once — which is another sign they were a menu wearing
toggles.

- Site: `examples/views/records.js`

### T-component-extends-view-never-alters-it

Two filtering scopes on one screen.

A **VIEW** filter narrows everything bound to the view's source — the charts,
the tiles, the grid. A **COMPONENT** filter narrows one component and leaves
the rest alone: a reader hunting through a table does not want the charts
beside it to move.

    component rows = view filter AND component filter

`followView(view, component)` makes the second source contribute the first's
WHOLE filter as one named part. That is what keeps the two from fighting: a
view change replaces one part and cannot touch the component's own, so a
component filter survives the view being cleared entirely.

**A field lives in exactly one scope.** `offerable()` decides what each toolbar
may add:

| held | offered to the view | offered to the component |
|---|---|---|
| view has it | no | no |
| component has it | **yes** — that is how it moves up | no |
| neither | yes | yes |

**Adding a component's field to the view MOVES it**, carrying the value the
reader already picked. `promotions()` says what must move; the caller does the
moving. A field held with NO value picked still counts as held — the chip is on
that bar, and promoting it takes the chip.

Nothing in the module knows what a "view" or a "component" is: they are two
sources, one following the other. A card extending a dashboard, or a panel
extending a card, is the same relationship with different words.

- Site: `src/core/filter-scope.ts`
- Site: `src/data.ts`
- Site: `test/unit/filter-scope.test.mjs`
