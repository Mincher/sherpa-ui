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

**Since 2026-09-27 no host queues.** `SherpaElement.clone()` IMPORTS its copy
into the page's document (`document.importNode`), so every component in it
upgrades at once; the grid imports its heading cells the same way; and
`menuFor()` makes a menu with `createElement`, already upgraded. A method a
host calls before appending — a menu's `items()` — now just works, and the
three `#pendingItems` queues are gone. A copy made with `cloneNode` from a
template's content still lives in its inert document and does NOT upgrade —
`customElements.upgrade()` cannot help it there.

- Site: `src/core/ui/sherpa-element.ts`
- Site: `src/components/sherpa-quick-filter-toolbar/sherpa-quick-filter-toolbar.ts`
- Site: `src/components/sherpa-data-grid/sherpa-data-grid.ts`
- Site: `src/components/sherpa-menu/sherpa-menu.ts`
- Site: `test/e2e/reforged-app-header.spec.ts`
- Site: `src/components/sherpa-filter-panel/sherpa-filter-panel.ts`
- Site: `src/core/ui/filter-menu.ts`
- Site: `src/components/sherpa-gauge-chart/sherpa-gauge-chart.ts`
- Site: `src/core/ui/saved-filter-menu.ts`

### T-tokens-css-never-reaches-shadow

A bare `[data-status]` rule in `tokens.css` is loaded into the **document**. It
reaches a light-DOM element and **never** one inside a shadow root. The
`--_status-*` values inherit across the boundary; the SELECTOR that sets them
does not.

So the projector writes the same pins a second time, into
`src/core/sherpa-style-modes.css`, which every shadow root adopts: each
`[data-status]` block and each `[data-look][data-status]` compound. A pin now
works at any depth, as a mode pin does in Figma, and the favourite star's
hand-copied active colours were deleted.

A bare `[data-look]` is **left out** of that sheet. It sets the look's DEFAULT
mode, so inside a status parent it would reset the status passed down. In the
page, `tokens.css` still does exactly that — a known gap, not a model.

- Site: `src/components/sherpa-quick-filter-toolbar/sherpa-quick-filter-toolbar.ts`
- Site: `src/index.ts`
- Site: `src/core/sherpa-style-modes.css`
- Site: `scripts/project-tokens.mjs`
- Site: `test/e2e/reforged-quick-filter-toolbar.spec.ts`
- Site: `test/e2e/reforged-style-modes.spec.ts`

### T-a-state-colour-binds-the-style-mode

In Figma a component binds a **Style** variable and the instance pins a MODE —
`Style=active` for an on chip, `Transparent=active` for a current nav row. Code
that painted the same state from the Theme ramp looked right and could never
follow Figma: on 2026-09-24 Will moved `style-surface/base [active]` and only
the chip moved. Measured then: 49% of component colours read Theme directly.

**The system, as Figma does it:**

- **Bind the public name** — `var(--sherpa-style-surface-base)`, the variable
  Figma binds for that layer. `base` / `+1` / `+2` are default / hover / down.
- **A pin re-points the public names** at a mode's own tokens
  (`--sherpa-style-active-surface-base`, `--sherpa-style-transparent-active-…`,
  `--sherpa-style-default-…`). `[data-status]` and `[data-look]` are pins.
- **A component state is a pin, as data** — `scripts/figma-data/state-pins.yaml`.
  No state colour is written in a component. A HOST pin is a plain
  `tag[state]` rule in both sheets, never `:host(…)`: a rule from outside the
  component beats every `:host()` rule, so the page's `[data-look="saturated"]`
  hid a button's open state. As plain rules they meet the look and status pins
  in one tree, and specificity decides — look + state beats look alone. A pin on
  a PART is `:host(tag) .part`, in the adopted sheet.
- **A FLAG is not a pin.** The data grid marks an acting column with
  `data-status="active"` but paints nothing, so its YAML pins that heading
  back to `default`; without it the tint leaked into the chips and the menu.

`--_status-*` is still set by every pin, for components not yet moved — and
unset (`initial`) by a default pin, because "default" is not "no status" to a
fallback chain.

`lint:css`: `theme-active` fails a Theme "active" read outright; `theme-colour`
counts every Theme colour read per component against
`scripts/lint-css-baseline.json`, which may only fall
(`node scripts/lint-css.mjs --update-baseline`). `/* theme-direct */` on the same
line marks a place Figma binds Theme too — the nav brand block, the upload drop
zone — or has no design, like the app-header loading bar.

Verified end to end on 2026-09-24: every Style colour variable × 8 modes × 3
looks, computed in the browser against Figma's own resolve — 264 of 264 in
light, 264 of 264 in dark.

- Site: `src/components/sherpa-quick-filter/sherpa-quick-filter.css`
- Site: `src/components/sherpa-nav-item/sherpa-nav-item.css`
- Site: `src/components/sherpa-button/sherpa-button.css`
- Site: `src/components/sherpa-tabs/sherpa-tabs.css`
- Site: `src/components/sherpa-list-item/sherpa-list-item.css`
- Site: `src/components/sherpa-calendar-cell/sherpa-calendar-cell.css`
- Site: `scripts/lint-css.mjs`
- Site: `scripts/project-tokens.mjs`
- Site: `test/e2e/reforged-style-modes.spec.ts`
- Site: `test/e2e/reforged-nav-item.spec.ts`
- Site: `test/e2e/reforged-quick-filter.spec.ts`
- Site: `test/e2e/reforged-calendar-cell.spec.ts`
- Site: `test/e2e/reforged-button.spec.ts`
- Site: `src/components/sherpa-chip/sherpa-chip.css`
- Site: `src/components/sherpa-data-grid/sherpa-data-grid.css`
- Site: `src/components/sherpa-badge/sherpa-badge.css`

### T-scope-does-not-stop-inheritance

`@scope` limits what a rule **matches**, not how far the value it sets
**inherits**.

A custom property set on a chip's host inherits into the `<sherpa-menu>` slotted
inside it and turns that card transparent too. Scoping the rule does not help.
The fix is to set a real property on the element that should change, never to
re-point a shared token on an ancestor.

When the ancestor MUST re-point it, reset it on the descendant — a reset
inherits too. A metric pins its status on its host, so every chart tip and the
`sherpa-tooltip` bubble pin Style=default in `scripts/figma-data/state-pins.yaml`.

- Site: `src/components/sherpa-quick-filter/sherpa-quick-filter.ts`
- Site: `src/components/sherpa-tooltip/sherpa-tooltip.css`

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

### T-firefox-never-rereads-a-has-after-host

In Firefox 155, a `:has()` rule whose selector begins with `:host(…)` matches
at first paint and is never read again. `el.matches()` says true; the computed
style does not change until something else restyles the element.

```css
:host(:not([data-select="single"])) .row:has(.row-multi[checked]) { … }  /* stale */
.row:has(.row-multi[checked]) { … }                                     /* re-read */
```

Measured alone, one rule per page: the bare form updates, and `:host`,
`:host([attr])` and `:host(:not(…))` before it do not. A ticked grid row kept
its old fill, and an unticked one its selected fill. Chromium and WebKit
re-read both forms.

So a state a `:host()` would gate is marked ON THE ELEMENT by its owner — the
grid writes `data-selected` on the row from the shown box — and CSS selects
that.

- Site: `src/components/sherpa-data-grid/sherpa-data-grid.ts`
- Site: `src/components/sherpa-data-grid/sherpa-data-grid.css`
- Site: `test/e2e/reforged-data-grid.spec.ts`


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

- Site: `src/core/ui/sherpa-element.ts`
- Site: `src/components/sherpa-slider/sherpa-slider.ts`
- Site: `src/components/sherpa-layout-grid/sherpa-layout-grid.ts`
- Site: `test/e2e/reforged-layout-grid.spec.ts`

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

- Site: `src/core/ui/sherpa-element.ts`
- Site: `src/components/sherpa-menu/sherpa-menu.ts`

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

- Site: `src/core/ui/sherpa-element.ts`

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

- Site: `src/core/data/data-source.ts`

### T-schema-sample-cost

A read schema costs real time on a bulk load: **10,000 rows 6ms, 100,000 rows
56ms**, about 23× an unguarded load, scaling linearly.

Sampling checks the first N rows, because a backend's rows are wrong in a SHAPE,
not one at a time. But rows beyond the sample pass **UNCHECKED**, so a schema
that RENAMES or COERCES must **not** be sampled — the two halves of one response
would disagree. Sample only when the schema purely VALIDATES.

Writes are always checked in full.

- Site: `src/core/data/base-store.ts`

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
- Site: `src/core/ui/render-icon.ts`

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

**All of that is now for a REMOTE source only.** Will, 2026-09-27 (TODO 62,
choice A): Apply is only for a fetch that leaves the data layer. LOCALLY every
pick applies at once — multi-select and ranges too — and the menu is built
`data-commit-fixed`, so the Range switch cannot turn Apply on. A bound source
over a remote store sets `data-remote` on the bar, and `menuFor(def,
{ remote })` then applies the select-mode rule above. A bar with no source
counts as local.

- Site: `src/components/sherpa-quick-filter-toolbar/sherpa-quick-filter-toolbar.ts`
- Site: `test/e2e/reforged-quick-filter-toolbar.spec.ts`
- Site: `src/components/sherpa-menu/sherpa-menu.ts`
- Site: `src/core/ui/filter-menu.ts`

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
   no arithmetic that predicts how many will fit. The Filters button that holds
   them is always drawn, so it is in every measure.

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

The move itself is `MenuDrill`, shared by the bar and the panel. The panel
drills into a menu it BUILDS for a run of values (`T-a-shut-scope-folds-like-a-bar`).

- Site: `src/components/sherpa-quick-filter-toolbar/sherpa-quick-filter-toolbar.ts`
- Site: `src/components/sherpa-filter-panel/sherpa-filter-panel.ts`
- Site: `src/core/ui/filters-button.ts`

### T-drill-flags-travel-and-replace

`DRILL_FLAGS` (`data-commit`, `data-range`, `data-select`, `data-search`) are
the menu attributes that belong to a FILTER rather than to the Filters menu.
They travel with the rows on a drill and go home with them, so a filter's mode
is never left on the Filters list and the list's never lands on a filter.

Every flag is **restored to what the TARGET had, not merged**: an attribute the
list carried and the filter does not must go, or the filter inherits a mode it
never asked for. On the way out the Filters menu gets its OWN settings back
(`T-one-filters-button`).

`data-type` left the list on 2026-09-22. A drilled calendar still draws whole —
month stepper, full grid, its own Apply — measured 2026-09-25 in the panel.

- Site: `src/core/ui/filters-button.ts`

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
Formatting it has four separate traps. They were the toolbar's, in
`#syncDateLabel`; the wording is `filterFace`'s now, from `formatDate`, so the
CHIP draws its own date wherever it sits (`T-a-chip-says-its-own-answer`):

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
- Site: `src/core/data/filter-face.ts`


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

### T-an-overlay-panel-resizes-from-its-left-edge

**An overlay panel is 40rem wide by default, never under 20rem nor past 92vw,
and its LEFT edge resizes it** — Will, TODO 22 (it was 30rem, too narrow for
the Ask N-zo chat). The edge is a thin `role="separator"` strip over the
border: a drag makes the panel as wide as the pointer is from its right edge;
ArrowLeft widens and ArrowRight narrows by 16 px (the edge moves the way the
key points), so a keyboard can do what a pointer does. The width lives in
`--_width` on the host, and the CSS `clamp()` is the truth: after each move
the panel writes back the width it DREW, so a key steps from there and a
drag past the floor does not store a width it cannot show. Each resize ends
in `panel-resize { width }`. No Figma design for the handle; it shows only
under the pointer or focus.

- Site: `src/components/sherpa-overlay-panel/sherpa-overlay-panel.ts`
- Site: `src/components/sherpa-overlay-panel/sherpa-overlay-panel.html`
- Site: `src/components/sherpa-overlay-panel/sherpa-overlay-panel.css`
- Site: `test/e2e/reforged-overlay-panel.spec.ts`

### T-a-menu-takes-no-grouping

**A menu opened from a GROUPED button wore that button's grouping** — TODO
119, Will: the filter panel header's Reset menu had the `end` style. Grouping
is eight INHERITED custom properties (`--sherpa-border-*`), and a slotted
`sherpa-menu` is a child of its button, so it inherited them: its card drew
with square left corners. A menu is its own surface, so its `:host` states
the solo values, and nothing above it reaches the card. Every grouped button
with a menu had this — the toolbar's Reset and Save groups too.

- Site: `src/components/sherpa-menu/sherpa-menu.css`
- Site: `test/e2e/reforged-menu.spec.ts`

### T-a-number-input-wears-sherpas-steppers

**A number a reader types goes in `sherpa-input-text data-type="number"`** —
TODO 127, Will: *"We've already fixed this before but seem to reintroduce the
mistake."* It is Figma's `Input Number` (937:39395): the Input Field, its
value right-aligned, and two `Button / Type=icon` in the Transparent look,
`chevron-up` and `chevron-down`. An empty one says "Enter a value".

The control is still `<input type="number">`, for the platform's own check,
arrow keys and `stepUp()`; its native spinner is hidden in CSS. The steppers
are composed `sherpa-button`s that call `stepUp()` / `stepDown()` and report
`input` and `change` as a keystroke would — and nothing at a bound, where the
value did not move. They are out of the tab order (`data-no-tab`, new on
`sherpa-button`), because ArrowUp and ArrowDown in the field do the same.
`mirrorAttrs` removes what the host does not carry, so the number type puts
back its `type`, its `inputmode` and its placeholder after each mirror.

**Why it came back.** A `sherpa-input-number` component existed and was pruned
(`47dc974e`); each place that needed a number then wrote a bare native input.
So it is GATED: `test/unit/a-number-input-is-sherpas.test.mjs` fails on any
component template that holds a bare `<input type="number">`. ONE is allowed:
the number field itself. Will, 2026-09-30: *"all numerical inputs should use
Sherpa's style"* — so the filter menu's value, the slider's value boxes and
the pagination's page box are all this field. (Figma draws the pagination's
page box with no steppers; Will's word is followed.)

**A stepper with nowhere to go is inactive**: Increase at `max`, Decrease at
`min`. An empty field can step either way.

**A NARROW field gives the room to its digits.** The field is its own query
container; under 9rem its steppers are 24px and under 6rem 20px, set through
the button's own `--sherpa-button-size-height`. Not `::part(trigger)`: WebKit
applies no `::part()` rule inside a container query — the gap changed and the
buttons did not. Contained, the field has no width of its own, so it keeps a
10rem floor, which a composer with a width of its own sets to 0.

**A composer stops the field's events.** The field reports `input` and
`change` with `{ value }`, composed. The slider, the pagination and the menu
each answer it and report their OWN event, so they stop it — and act only on
the field's own event, never the native one that arrives with it.

**The slider's fields sit UNDER the track, in one row, half each** — Will,
2026-09-30 — at any width, so two never stack. A lone field takes the second
half.

- Site: `src/components/sherpa-input-text/sherpa-input-text.ts`
- Site: `src/components/sherpa-input-text/sherpa-input-text.html`
- Site: `src/components/sherpa-input-text/sherpa-input-text.css`
- Site: `src/components/sherpa-menu/sherpa-menu.html`
- Site: `src/components/sherpa-slider/sherpa-slider.html`
- Site: `src/components/sherpa-pagination/sherpa-pagination.html`
- Site: `test/e2e/reforged-input-number.spec.ts`
- Site: `test/unit/a-number-input-is-sherpas.test.mjs`

### T-a-chip-says-its-own-answer

**A filter chip's face — its value, its tooltip, its matches — is the CHIP's
own, wherever it is drawn** — TODO 130, Will: "Filter panel chips don't
display tooltips. This functionality should be on the filter chip component
and not on the filter-toolbar or filter-panel components." The tooltip was the
chip's already, but it read only a LIST menu, and three things it needed were
somewhere else:

- **A number and a date said nothing.** The chip handed `fieldState` an empty
  value list (`values: []`) for a menu with no rows, which says "nothing can
  be picked", so nothing was. It names the TYPE instead, and the picks are
  the values. `filterFace` words two ends as a range — `37 to 120` — and a
  day as a day.
- **A date's label was the TOOLBAR's** (`#syncDateLabel`), so a date chip in
  the panel showed no days at all. The wording is `filterFace`'s, from
  `formatDate`; the chip redraws on its calendar's own pick.
- **Group and Sort were steered by the toolbar**, by hand, from
  `data-sort-field`. The panel had no such code, so its Group and Sort chips
  never followed a sort set on the toolbar or a grid heading. The chip has
  `arrangeBy(field, direction)`; a bar and the panel both call it from the
  same three attributes.

The tip is the answer in words, then ` - X matches` while the chip shows its
results — and for a sort, which WAY: `Name, descending` (TODO 125). The
source draws results to the panel too, scope by scope, so its one-chip fields
and saved filters say theirs. A panel VALUE chip is one value of a run and
has no count of its own yet (TODO 133).

**The chip has ONE door for its answer too**: `reading`, get and set, and
`clear()`. Reading a chip's answer, drawing one, emptying one and asking if it
is on were each written in the toolbar and again in the panel, and each asked
"a list, a number or a date?" — five of the seven holes in TODO 137 were one
of those four done differently in two places. The toolbar had its own
typed-answer check, which knew nothing of Advanced rows; packing a saved
filter emptied a list field and left a number holding its value. Now:

- `chip.reading` is the menu's whole answer, with `suspended` while the chip
  is off — and `null` for a chip that answers no field (a toggle, a selector,
  Group, Sort). Setting it draws the answer, on or off, and the face. SILENT.
- `chip.clear(op)` empties every kind and switches off; `op` is the condition
  a list goes back to, which only its host's def knows.
- `chip.answered` — a pick, a day, a number, typing or an answered row.

What stays the hosts': the toolbar's rebuild (`#pendingAnswers`) and its
drill, where a chip's rows are away in the Filters menu; and the panel's RUN
of value chips, which has no one chip — its field reads the inline menu's own
`reading`, the same door one level down. The panel's date is one chip, and
uses the chip's.

- Site: `src/components/sherpa-quick-filter/sherpa-quick-filter.ts`
- Site: `src/components/sherpa-quick-filter-toolbar/sherpa-quick-filter-toolbar.ts`
- Site: `src/core/data/filter-face.ts`
- Site: `src/components/sherpa-quick-filter/sherpa-quick-filter.html`
- Site: `test/e2e/reforged-chip-tips.spec.ts`
- Site: `test/unit/filter-face.test.mjs`
- Site: `src/components/sherpa-filter-panel/sherpa-filter-panel.ts`

### T-a-panel-follows-the-query-open-or-shut

**ONE owner holds every filter answer: the Query, in the `DataSource`.** A
toolbar, the header bar, the filter panel and a grid heading are VIEWS of it.
Each reports what a reader did; the source writes it to the Query and draws
it back into every bound control — `drawReading` for one field, `drawScope`
or `drawScopes` for a whole scope. No control is asked what another holds.

**The panel follows it open OR shut** — TODO 137, Will: "Numeric range filter
values don't match between the filter-panel and filter-toolbar." A shut panel
used to skip every `drawReading`, "refilled when it opens" — and the refill
was the PAGE's, which went when the provider took the page over. So it opened
on whatever it was last drawn with: the toolbar said Seats 37 to 120, the
panel 4 to 240. Worse, its next change reported from that old state and wrote
it over the Query — typing 60 made the range 60 to 240, and the 120 was gone.
A view that can go stale is a second owner. The guard is gone: a shut panel
is drawn as a bar is.

**The gate** is `test/e2e/reforged-filter-coordination.spec.ts`: one Records
page, forty steps across every kind of answer, and after each step every
control must hold what the Query holds. When a filter control is added or
changed, add its step there. It supersedes the "refilled on open" half of
`T-an-open-panel-follows-the-data-layer`.

- Site: `src/components/sherpa-filter-panel/sherpa-filter-panel.ts`
- Site: `src/components/sherpa-filter-panel/sherpa-filter-panel.html`

### T-a-suspended-answer-is-drawn-as-off

**A chip switched OFF keeps its answer and applies none of it — and the source
DRAWS that, with `suspended: true`.** It used to skip a suspended field when
it drew, because a bar drew every reading as ON. So the chip that was pressed
knew, and nothing else did: the panel went on showing `Status: active` while
no row was filtered by it. Now a bar draws the answer and then switches the
chip off (`#drawChip`), and the panel — which has no "off" for a run of value
chips — shows no answer, in `setFieldReading` and in `drawScopes` alike. The
Query keeps the value, for the chip. A DATE in the panel is one chip, which
does have an off, so it keeps its days.

- Site: `src/core/data/data-source.ts`
- Site: `src/components/sherpa-filter-panel/sherpa-filter-panel.ts`
- Site: `test/unit/query.test.mjs`

### T-empty-is-every-kind-of-answer

**Reset and Clear EMPTY a field whatever answers it** — a list's ticks and
rows, a number's two shapes, a date's days. Each host emptied only what it
first knew: the toolbar's Reset cleared list chips and merely switched a
number chip OFF, value kept, so the Query held a suspended answer after a
Reset; the panel's Reset and a field's Clear unticked value chips and cleared
rows, and left a number field as it was. One door each now — the toolbar's
`#emptyChip`, the panel's `#empty` — and both write `{ picked: [] }` to the
menu, which empties every body it owns. `values = []` is NOT that for a
number: it empties the shape in force and keeps the other
(`T-both-shapes-are-kept`).

- Site: `src/components/sherpa-quick-filter-toolbar/sherpa-quick-filter-toolbar.ts`
- Site: `src/components/sherpa-filter-panel/sherpa-filter-panel.ts`
- Site: `src/components/sherpa-quick-filter/sherpa-quick-filter.ts`

### T-a-panel-date-answers-with-its-days

**A date set in the filter panel filtered nothing.** In the panel a field is a
run of value chips, and its answer is the ticked chips' values. A date is ONE
chip with a calendar in its menu — so its "value" was its own id, and the
panel sent `{ picked: ['created'], range: true }`. The Query stored it, no
row matched a day called `created`, and the header's Date chip came back
empty. A date answers with its menu's own reading, as a number does, and the
source's answer is drawn into that chip: its days, and whether it is on.

- Site: `src/components/sherpa-filter-panel/sherpa-filter-panel.ts`

### T-a-bar-is-drawn-the-scope-as-it-ends

**A bar is drawn a COPY of its scope, a moment later** — `drawScope` waits for
its chips to settle. So it must be asked for AFTER the last write of a report.
The panel's whole report — a Reset — names `presets` first, and the source
drew the bars there, mid-loop: the copy still held Status and Seats, the loop
then cleared them, and two frames on the bar put them back, silently. The
Query was empty and the toolbar said otherwise. `#answerScopes` draws the
bars once, at the end.

- Site: `src/core/data/data-source.ts`

### T-both-shapes-are-kept

**A number filter has two shapes — one value, or two ends — and its reading
keeps BOTH** — TODO 132, Will: switching back to Simple "does not retain any
original simple values". The shape in force is `picked` (or `text`) with
`range`; the other is `kept: { picked, op, text }`, remembered and never
applied. It is in the READING, not only in the menu, because a filter panel
REBUILDS a field's menu when its answer changes: a value held only in the old
menu's input is gone. `answers()` counts a `kept` answer, so a range with
nothing moved still holds the value typed before, and `READING_KEYS` carries
the key — a key left off that list is dropped silently.

In the menu: `#bodyReading()` writes both; `set reading` draws both and takes
the shape from `range`; a bare `values =` writes only the shape it names — two
are the ends, one the value, and none empties the shape in force without
switching it. Cancel restores the whole reading, so the shape goes back too.
The same idea as `T-both-answers-are-kept`, for Simple and Advanced.

A HOST passes the whole reading on, never its values: the toolbar's
`setChipReading` cut a number down to values, so a range from the panel came
back in whatever shape the chip's menu was in. And "none names no shape"
holds for a DATE too — a cleared range calendar came back as a single day.

- Site: `src/core/data/filter-state.ts`
- Site: `src/core/data/data-source.ts`
- Site: `src/components/sherpa-menu/sherpa-menu.ts`
- Site: `src/components/sherpa-quick-filter/sherpa-quick-filter.ts`
- Site: `src/components/sherpa-filter-panel/sherpa-filter-panel.ts`
- Site: `test/unit/both-shapes-are-kept.test.mjs`

### T-the-router-owns-the-url

**`sherpa-router` is the ONE owner of the URL, on the Navigation API** — TODO
67, the first part of the utility layer. A link, `router.go()` and the
browser's Back all REQUEST a navigation. The router hears every one in the
`navigate` event, intercepts it so the page never reloads, and reports
`route-change { route, previous, changed, type, waitUntil }`. Nothing else
touches `history`. The example app had four `pushState` / `replaceState`
sites, a `popstate` listener, and two click listeners that stopped a link's
reload by hand; all are gone, and one `route-change` listener makes the screen
match the URL.

**A route is the search parameters the router OWNS** — `data-params`, each a
`name` or a `name=default`. Any other parameter (`?live`) is kept as it is. The
arithmetic is `src/core/browser/route.ts`, pure, proved in Node.

**An OVERLAY parameter opens over the page** — `data-overlay="settings"`. A
link that names only overlay parameters (`?settings=profile`) means less than
it says: on its own it would drop the Context under it. The router keeps the
base it left out, and goes to the WHOLE URL instead, so the address bar, a
reload and Back all say the same thing. A link that names a base parameter is
the whole base: its View is its first, and the overlay shuts. Back and forward
are never settled again — that URL was settled when it was made.

**`changed` is what a listener acts on.** Settings opening is `['settings']`,
so the Context under it is not reloaded.

**The Navigation API is REQUIRED; there is no `history` fallback.** Probed
2026-09-30: Chromium 153, Firefox 155 and WebKit 26.6 all have it, with
`intercept()`.

Four things that look wrong and are not. Listening starts in
`connectedCallback`, not after the first render — a press before the template
arrives would reload the page. Focus and scroll are `manual`: a View pick is a
navigation, and must move neither. A navigation to the URL it is on changes
nothing and reports nothing. And only a REAL link navigates: a nav row's
hidden `<button>` no longer does, which three tests were pressing.

One behaviour changed: a Context row pressed while on one of its later Views
goes to its first View, because that is what its href says.

- Site: `src/components/sherpa-router/sherpa-router.ts`
- Site: `src/components/sherpa-router/sherpa-router.html`
- Site: `src/core/browser/route.ts`
- Site: `test/unit/route.test.mjs`
- Site: `test/e2e/reforged-router.spec.ts`

### T-a-menu-is-a-dialog-of-native-controls

**`sherpa-menu`'s card is `role="dialog"`, not `role="menu"`** — TODO 117. An
ARIA menu may hold only menu items, and this one holds native checkboxes,
radios, inputs, buttons and a footer with Apply: real form controls, which
keep their own native semantics and need none written over them. So the card
is a small non-modal dialog, ALWAYS named — its heading, else the host's
`aria-label`, else "Menu" — and every trigger says `aria-haspopup="dialog"`.
The same finding, the same answer, in four more places: a chart legend is a
GROUP of toggle buttons (a `listitem` may not take `aria-pressed`); a transfer
list's panes are plain lists of checkbox rows, not listboxes; a bar or line
chart's plot is a GROUP, because an `img` hides the named marks it holds; and
`sherpa-list` is `role="list"` on a `<div>`, since a `<ul>` may hold only
`<li>` and a slotted row is a custom element — the list names each slotted
row a `listitem`. A calendar's cells sit in `role="row"` boxes that are
`display: contents`, so they still lie on the grid.

- Site: `src/components/sherpa-menu/sherpa-menu.ts`

### T-the-a11y-gate-reads-shadow-roots

**The accessibility gate is axe-core over ONE FIXTURE per component, WCAG 2.1
level AA** — TODO 24. `test/a11y/fixtures.mjs` holds a realistic instance of
every one, written as a page writes it; `test/e2e/a11y.spec.ts` draws each in the
harness and runs axe on it. Three things make a green result mean something.
**It is proved to read a shadow root**: a test puts an unnamed `<button>`
inside one and expects axe to report it, with a target that crosses the
boundary. A checker that reads only the light DOM sees almost nothing of a
Sherpa component and passes everything. **A name is asserted by ROLE**
(`getByRole('switch', { name })`), never by reading `aria-label` back — the
attribute was there all along on hosts where it named nothing
(`T-a-host-label-must-reach-its-control`). **Every component must have a
fixture**, so a new one cannot skip the gate.

The output is a REPORT per component in `test/a11y/reports/` (not tracked):
what is wrong, the criterion it breaks, and how to correct it. The failures
known today are in `test/a11y/baseline.json`, as a count per rule, and the
gate fails when a count is not EQUAL — a rise is a regression, and a fall
must be recorded (`npm run test:a11y:update`) so it cannot come back unseen.
Chromium only, in one worker: the rules are the same in every engine, and one
baseline file cannot hold three answers or take two writers.

Two lessons from the first run. An id reference (`aria-controls`,
`aria-labelledby`) cannot cross a shadow boundary, so a tab names its light-DOM
panel by TEXT. And a row whose label is hidden — a collapsed nav rail — has no
name at all unless the row carries `aria-label`.

- Site: `test/e2e/a11y.spec.ts`
- Site: `test/a11y/fixtures.mjs`

### T-one-overlay-panel-at-a-time

**Opening an overlay panel shuts every other one** — TODO 23. They all sit on
the right edge, so two open at once draw one over the other. It works as a
native `popover="auto"` does: the panel keeps a static set of the panels open
now and hides the rest on `show()`. A set, not a `document` query, so a panel
inside a shadow root is found too. A shut panel still fires `panel-close`, so
its host hears it. The Assistant and the Records details panel are the pair.

- Site: `src/components/sherpa-overlay-panel/sherpa-overlay-panel.ts`
- Site: `test/e2e/reforged-records-details.spec.ts`

### T-a-current-row-opens-its-details

**A row click opens that record in the app's details panel** — TODO 23. The
grid holds the CURRENT row BY KEY (`currentKey`), so a re-populate, which is
what an edit causes, keeps it. It was a row OBJECT, cleared on every populate.
A caller can do what a click does: `currentKey = key` sets it (silent, as
`select()` is), `neighbour(by)` reads the row above or below in drawn order,
and `stepCurrent(by)` moves to it. The panel's up and down chevrons use those,
and each disables at an end of the page. The panel lives in `index.html`, beside
the Assistant, and the Context fills it: the heading is the record's name, and
the body is every DECLARED field under its label, formatted by its type. A
drilldown is where a trail belongs, so the header's trail reads
`Records › <name>` while it is open. Its first crumb shuts the panel. A crumb
is a real `<a href="?…">`, so `index.html` stops the reload on the real click,
as it does for the nav.

- Site: `test/e2e/reforged-records-details.spec.ts`

### T-a-container-shows-its-datas-state

**A container shows what its DATA is doing, in place of its body** — Will,
TODO 58: loading (a spinner and "Loading…"), no data (the data illustration),
no MATCHES (the search one, and Clear filters), and an error (its own words,
Retry as the CTA because it resolves it, Dismiss as a plain button). Each has
a DEFAULT, composed from `sherpa-loader`, `sherpa-empty-state` and
`sherpa-button`, shown by `data-state` (or `data-loading`); a slotted state
still replaces its default. Loading wins over the rest. "No data" and "no
matches" are two states on purpose: a filter that matched nothing is not an
empty table (`sherpa-a-zero-row-view-reads-as-a-broken-filter`). Retry and
Clear filters are REQUESTS (`data-refresh`, `filters-clear`); Dismiss is the
card's own — its overlay goes, the last data stays.

**The PROVIDER draws it, so no page writes it.** It watches each source's
`loading`, `change` and `error` — BEFORE it answers anyone, as an answer
binds and a bind starts the first load — and writes the card of every
component it answers. Loading shows only after 300 ms, so a quick load never
flashes. Loading and a failure reach every data component's card; empty and
no matches a ROWS component's only, as a chart under the View alone still has
its rows. It answers `data-refresh` (a card's Retry, a bar's Refresh) with a
forced load, and `filters-clear` by resetting every bar. A store that cannot
answer at `openSource()` no longer stops the page: `declareFromRows` reports
`values-unread`, and the first load shows the failure on its card.

**KEEP THE CONTENT is the second look** — Will's own, TODO 59, a trial in
Settings › Experiments. The provider's `data-keep-content` goes onto every
card it draws a state on. Then nothing replaces the body: loading is an
indeterminate bar along the header's bottom edge, and the body takes no
pointer; a state is a `sherpa-callout` banner above the body, with the same
Retry, Dismiss and Clear filters. The overlay never shows. Its own buttons,
not the callout's close: a callout REMOVES itself on dismiss, and the next
failure would have no banner.

- Site: `src/components/sherpa-container/sherpa-container.ts`
- Site: `src/components/sherpa-container/sherpa-container.html`
- Site: `src/components/sherpa-container/sherpa-container.css`
- Site: `test/e2e/reforged-container.spec.ts`
- Site: `src/components/sherpa-provider/sherpa-provider.ts`
- Site: `src/core/data/data-source.ts`

### T-the-nav-is-a-menu-on-a-phone

**On a phone the nav is a MENU, and it is the SAME `sherpa-nav`** — TODO 17b.
Below 768 px — the layout grid's own mobile mode — the shell hides
the rail with `visibility`, not `display` — a top-layer element under a
`display: none` ancestor is not drawn — and drops its inset; the header shows
a menu button right of the Context title, which asks (`nav-menu-request`) and
the SHELL opens the rail's `openMenu()`.

**The shell decides, and TELLS the header** (TODO 164). Each once read its own
width at 480 px, and the header is narrower than the shell by the rail: from
481 to 520 the button showed beside a rail that was still there, and a
desktop window, which stops near 500, never got the menu at all. Now the
shell's one query sets `--sherpa-app-header-nav-menu` on its header area, and
the button's `display` is that property — inherited, because a container
query cannot name a container across a shadow root with any certainty, and
an attribute would need JS. The header's FILTERS still go at its own 480. The nav then goes into the TOP LAYER
(`showPopover()` on its own host, so no containment or stacking clips it),
over the whole screen, open, with no Pin; Settings at the bottom and a Cancel
that goes nowhere. An Area only opens; a Context row closes it as it goes;
Escape closes it. One element in two presentations, so the rail and the menu
cannot disagree about the current row or an open Area.

- Site: `src/components/sherpa-nav/sherpa-nav.ts`
- Site: `src/components/sherpa-nav/sherpa-nav.html`
- Site: `src/components/sherpa-nav/sherpa-nav.css`
- Site: `src/components/sherpa-app-shell/sherpa-app-shell.ts`
- Site: `src/components/sherpa-app-shell/sherpa-app-shell.css`
- Site: `src/components/sherpa-app-header/sherpa-app-header.ts`
- Site: `src/components/sherpa-app-header/sherpa-app-header.html`
- Site: `src/components/sherpa-app-header/sherpa-app-header.css`

### T-a-second-container-type-drops-the-first

**`container-type: inline-size scroll-state` is ONE declaration, and an engine
that does not know `scroll-state` drops all of it** — the element is then no
container, and every size query on it is dead. The app header's did exactly
that in Firefox and WebKit: its 480 px rule (the filters go) never ran there,
found building the phone menu (TODO 17b). Write the plain type FIRST and the
pair SECOND, as a CSS function takes its longhand first
(`T-a-css-function-needs-its-longhand-first`): an engine keeps the last line
it understands. The shell and the grid use `scroll-state` alone, so they have
no size queries to lose.

- Site: `src/components/sherpa-app-header/sherpa-app-header.css`

### T-a-saved-view-is-the-readers-own

**A reader saves, saves over and deletes only their OWN Views; a preset is
never touched** — TODO 15. The View bar's Save and its ▾ ("Save view as",
"Delete view") are REQUESTS (`view-save`, `view-save-as`, `view-delete`); the
SHELL answers them for every page with one name dialog and one confirm, and
the provider does the work: `saveView(name)` saves a NEW View — a name any
View has gets ` - Copy-001`, then `-002` (`uniqueViewLabel`); `saveView()`
with no name saves over the reader's View on screen and answers nothing on a
preset, so Save on a preset asks for a name instead; `deleteView()` deletes
the reader's View and goes to the first. The provider marks the View bar
`data-custom-view` while one of the reader's is on screen — "Delete view"
shows only then, critical — and the View chip lists the reader's under
"Custom views", at the bottom. The Dashboard's own save handler is gone.

- Site: `src/components/sherpa-provider/sherpa-provider.ts`
- Site: `src/core/browser/persist-view.ts`
- Site: `src/components/sherpa-quick-filter-toolbar/sherpa-quick-filter-toolbar.ts`
- Site: `src/components/sherpa-quick-filter-toolbar/sherpa-quick-filter-toolbar.html`
- Site: `src/components/sherpa-quick-filter-toolbar/sherpa-quick-filter-toolbar.css`
- Site: `test/unit/parity-sweep.test.mjs`

### T-a-range-is-bounded-by-the-data

**The View's date is a RANGE, and a range is BOUNDED by the data, not dotted
by it** — Will, TODO 20b: a top-level date range slices the whole view.
`describe(VIEW)` marks a date field `range: true`, so its menu opens with its
Range on; a component's date stays one day, the common case there. A single
day may only be one that has records (`data-available`); a RANGE spans days,
so the calendar takes only its ENDS from that list — the first and last days
with records — and any day between, records or not, can start or end it. An
empty list is still "nothing has records".

- Site: `src/components/sherpa-calendar/sherpa-calendar.ts`
- Site: `src/core/data/data-source.ts`
- Site: `test/unit/page-definition.test.mjs`
- Site: `test/e2e/reforged-calendar.spec.ts`

### T-a-field-can-carry-over-views

**A header chip resets on a View change unless the View sets it — or unless
its field CARRIES OVER** (Will, TODO 21b: *"which chips carry over should be
CONFIGURABLE"*). `carryOver: true` in a field's declaration (the page JSON
takes it) keeps its answer through a View that does not answer it; a View
that does answer it wins. Two paths honour it: a JSON View (`setQuery` with
`holds: 'keep'`, in `#definition`) and an old snapshot View (`clearAll({
carry: true })`, then `setState`, whose `#clearReadings` keeps it). A RESTORE
is exact, and Reset still clears everything: only a View change carries.
Nothing on Records carries over yet — the default is Will's.

- Site: `src/core/data/data-source.ts`
- Site: `src/components/sherpa-quick-filter-toolbar/sherpa-quick-filter-toolbar.ts`
- Site: `src/core/browser/persist-view.ts`
- Site: `test/unit/page-definition.test.mjs`
- Site: `test/e2e/reforged-carry-over.spec.ts`

### T-send-to-view-filters

**"Send to view filters" raises a component's field to the View** — Will, TODO
21f: beside Clear in a component scope's field header in the panel (the View's
own fields have none). It is the panel's ordinary `filter-add-request`, with
the View's scope: the View HOLDS the field, its answer goes with it
(`#rehome`), and the chip below keeps its place, suspended, saying where its
filter went (`T-up-is-open-down-is-closed`). So the rows do not move, and the
header gets ONE chip — the View's Add list stops offering it.

**And down** — Will, TODO 120: a View field has "Send to `<scope name>`",
with a down arrow, in the same button group. It is the same request the
other way — `{ scope: <the scope>, ids, from: 'view' }` — and the View LETS
GO: the field is held below first, so its answer moves there and is not
cleared. EVERY OTHER scope below lets go of it before that (168): a scope the
field came up from kept its place, so the field showed there again as it
landed elsewhere, and the answer could re-home to either. A filter is in ONE
scope at a time. Then the answer is written AGAIN, whole: the bar below is freed as
the View lets go, and reports the answer it kept from before the field went
up — an old one, which put a filter sent down in Advanced back to Simple.

The SOURCE names the scopes (`describe('view')` → `sendTo`, a list), never
the panel: each scope that has the field — a component's offer, or a chart's
own scope — the one it came up from first. ONE, and the button sends it and
says where. MORE, and the button opens a menu of them: the reader picks. The
source does not guess, and a guess would move a reader's filter to a
component they did not mean.

It first offered a button only for ONE scope, or for where the field came up
from — which it remembers for a session. On Records a chart's field is the
grid's too, so after a reload there were two scopes, no memory, and no way
down: Will, TODO 158.

- Site: `src/components/sherpa-filter-panel/sherpa-filter-panel.ts`
- Site: `src/components/sherpa-filter-panel/sherpa-filter-panel.html`
- Site: `src/core/data/data-source.ts`
- Site: `test/unit/send-down.test.mjs`

### T-a-condition-marks-every-match

**A field answered by a chain of conditions marks EVERY string in it** — Will,
TODO 21c: *"there will be multiple strings to match and highlight. Not just
one."* `filterNeedles` kept one needle per field and the grid marked the first
row's first hit, so `Contains "ab" or Starts with "R"` marked only "ab".
Now every substring clause becomes a needle (an identical one once), and
`markNeedles` marks each hit of each: a `contains` every time it appears, a
`startswith` at the start and an `endswith` at the END (it used to mark the
first hit wherever that was). Overlapping or touching hits JOIN into one
`<mark>`, so two marks never split one span.

- Site: `src/core/data/store.ts`
- Site: `src/core/ui/sherpa-element.ts`
- Site: `src/components/sherpa-data-grid/sherpa-data-grid.ts`
- Site: `test/e2e/reforged-filter-conditions.spec.ts`

### T-a-chip-counts-its-own-results

**A chip's badge is the number of rows ITS OWN answer matches** — Will, TODO
60, decided 2026-09-26: not the whole filter's total (one number on every
chip), and no longer a count of picks or `fx` (the tip says those, and the
button's `aria-description` says it to a screen reader). Counted within what
the chip's scope can see: a component chip within the rows the View allows.
`source.results(scope)` counts from the APPLIED Query — `store.totalCount()`
per answered field or saved filter — after every load, and draws them onto
each scope-bound bar (`drawResults`); a later load's count wins. A chip never
told its results, and with no menu, leaves `data-count` to its host, as
before.

**ON OR OFF** — Will, TODO 123: a chip switched off keeps its badge, and only
one with no values and no conditions has none. So the source counts a FIELD's
answer that is off too — what it WOULD match. A SAVED filter is counted only
while it is on (166): its count is not always known before it runs. Pending
still shows none (46): a draft has no results yet. The TIP says its matches only while the chip is on; off, it says
nothing.

**An off answer that changes moves no rows, so no load follows** — and the
count was only ever drawn after a load. Emptied, the chip kept its old
number. `#recompose` draws the results itself when the SHARED filter stood
still and the applied Query did not — a chart's own answer is the same case.

**In the panel, a field's HEADER wears it** — Will, TODO 133: a field drawn
as a run of chips, or as a body, has no one chip to carry the number, so its
badge sits right of the title. A chart's own scope is counted too. The panel
KEEPS each scope's last results and draws them again after a redraw: a redraw
builds new headers and chips, and no load follows it.

**In the panel, each PICKED value chip wears its own count** — Will, TODO
172: *"For multi value filters in the filter panel each chip should show
their own count badge."* A field drawn as a run has no one chip, so its
header wears the field's count (133); each picked chip now wears the rows
that ONE value matches, within what its scope can see
(`source.valueResults(scope)`, by field then value, drawn by
`drawValueResults`). A chip that is not picked wears none, as a saved filter
that is off wears none (166). Only a list answer in force has values: rows,
a range, a field that is off or held above have none. The one value is
counted with NO list beside it — against a one-value field's whole list it
reads as "everything", which is no filter (`T-everything-on-is-no-filter`).

**The header is ONE count, never a sum** — TODO 173. It counts the rows ANY of
the field's values match, once each. A row holds one value of a field, so for
picked values it equals the sum of the chips; two conditions that match the
same row count that row once.

- Site: `test/unit/a-field-counts-unique-rows.test.mjs`
- Site: `src/core/data/data-source.ts`
- Site: `src/components/sherpa-quick-filter/sherpa-quick-filter.ts`
- Site: `src/components/sherpa-quick-filter-toolbar/sherpa-quick-filter-toolbar.ts`
- Site: `test/unit/page-definition.test.mjs`
- Site: `test/e2e/reforged-chip-results.spec.ts`
- Site: `src/components/sherpa-filter-panel/sherpa-filter-panel.ts`
- Site: `src/components/sherpa-filter-panel/sherpa-filter-panel.css`

### T-a-scope-says-what-it-shows

**A filter panel section's icon names WHAT its filters narrow** — the View
(`monitor`), or the content one component shows: a grid (`table-columns`), a
chart, a form (`file-lines`), a list (`list`). Will, TODO 97; in its header,
caret, icon, label. The kind comes from the COMPONENT: its `asks.shows`, which
the provider passes to `source.bind()`, and `describe(scope)` reports as
`shows` — never a tag name, so a new grid-like component says what it is
itself. Figma has no chart glyph of its own yet, so a chart's section wears
`reports` (three bars), and `table-columns` stands in for a table glyph.

- Site: `src/core/data/data-source.ts`
- Site: `src/core/ui/context.ts`
- Site: `src/components/sherpa-filter-panel/sherpa-filter-panel.ts`
- Site: `test/unit/page-definition.test.mjs`

### T-a-view-keeps-a-draft

**A View keeps a DRAFT: the filters a reader left on it, unsaved** — Will,
TODO 144: *"Filter configurations should survive view swaps during a session,
even if not saved as a definition … if they could persist across sessions,
too … configurable options for filtering (on by default)."* A pick used to
put the View's own filters on, so what the reader had set on the View they
left was gone.

`src/core/browser/view-drafts.ts` keeps one map per page, View id →
`{ query, sig }`, in the tab's storage — and the shared one too in `always`.
`sig` is the View's own definition as it was when the draft was made: a
draft over another definition is DROPPED, so a changed preset never hides
behind an old draft. The provider takes a `drafts` option — a function
asked at every write, so a setting applies at once; none means no drafts.

Four things that are not obvious:

- **Only the READER's changes write it.** A pick and a reset write the
  source too, and heard then, the NEW View's filters were saved under the
  OLD View's name (its id changes only after the pick's async write). While
  the provider writes (`#writing`), nothing is heard as the reader's, and it
  stays so for two frames, as a redrawn bar reports late.
- **A pick FLUSHES first**: a change still waiting for its frame is written,
  under the View it was made on, before the pick's own write.
- **A draft is read INSIDE the pick** (`onViewPicked`'s `draft` hook), in
  place of the View's Query, so the View's own filters never flash. It is a
  RESTORE, so it is exact: a carry-over field does not follow into it.
- **Reset all to default, Save and Delete clear it**: the View's own filters
  are on, or the filters have a home.

- Site: `src/components/sherpa-provider/sherpa-provider.ts`
- Site: `src/core/browser/persist-view.ts`
- Site: `src/core/browser/view-drafts.ts`

### T-reset-to-default-is-the-views-own

**Reset puts every filter back to ITS own default; Reset to default puts the
page back as the View on screen DEFINES it** — Will, TODO 109. Only the
provider knows that: the bar and the panel send `view-reset` (an intent) from
the menu beside Reset, and `provider.resetView()` answers — the page's first
Query (kept at `open()`, before any kept one), then the View's Query as a
pick puts it on. So a filter the reader ADDED since goes, as it is not the
View's. A page may call `resetView()` itself. Reset and its ▾ are one
`.sherpa-group`, like Save and its ▾; folded, the ⋮ lists both.

**The row reads "Reset all to default", and the ask is CANCELABLE** — Will,
TODO 129: it *"should throw a confirmation sherpa dialog informing the user
that it will reset all filters across all scopes to the view default"*, with
a switch to *"Save filters before reset"* and a name. A dialog is the APP's,
as the Save view ones are, so the library only makes room for it: the
provider answers `view-reset` unless it was prevented, and an app that asks
first listens in CAPTURE on the provider, prevents it, and calls
`resetView()` when the reader says yes. The save is
`provider.saveView(name, { stay: true })`: what is on screen is kept as the
reader's own View, and the page STAYS on its View — a plain save moves to
the saved one, and a reset after that would put back what was just saved.
Not saved means not reset. When 105's saved filter sets are ruled, the save
moves to them.

- Site: `src/components/sherpa-provider/sherpa-provider.ts`
- Site: `src/components/sherpa-quick-filter-toolbar/sherpa-quick-filter-toolbar.ts`
- Site: `src/components/sherpa-quick-filter-toolbar/sherpa-quick-filter-toolbar.html`
- Site: `src/components/sherpa-filter-panel/sherpa-filter-panel.ts`
- Site: `src/components/sherpa-filter-panel/sherpa-filter-panel.html`
- Site: `test/e2e/reforged-reset-to-default.spec.ts`

### T-a-value-before-the-first-render-is-held

**A value set before a component's first render is HELD, and written in at
the end of `onRender`.** `SherpaElement` fetches the template, so the elements
a setter writes into do not exist for a while after the element does — a
composer's `value` set then went nowhere, and read back as `""` (TODO 113).
Where a native control owns the live value once drawn (a textarea), hold only
the early one: the getter answers it until the control exists. Where the
component's elements ARE its state, keep the state as data instead —
`T-a-value-is-data-the-ticks-are-drawn`.

- Site: `src/components/sherpa-prompt-composer/sherpa-prompt-composer.ts`
- Site: `test/e2e/reforged-prompt-composer.spec.ts`

### T-a-value-is-data-the-ticks-are-drawn

**`sherpa-select-group`'s value is its own DATA (`#picked`), and the child
boxes' ticks are drawn from it** — Will's "state first, then render" (TODO
113). It lived IN the boxes: a value set before `populate()` had no box to
tick, and every re-draw made new, unticked boxes, so both were lost with
nothing said. The setter stores and draws; `#render` draws again; a reader's
tick writes back. Until anything sets it, `#picked` is null and a SLOTTED
child's own tick is the answer, as before.

- Site: `src/components/sherpa-select-group/sherpa-select-group.ts`
- Site: `test/e2e/reforged-select-group.spec.ts`

### T-a-reflow-that-moves-nothing-keeps-its-menus

**A bar's re-fold that folds the same chips at the same step leaves its open
menus alone.** It shut the Filters menu and built a new one on EVERY resize —
a late frame, a scrollbar, a font — so a menu opened just before one was
thrown away under the reader, and a row held from it named nothing. WebKit
runs the bar's last settling re-fold a frame later than Chromium, so there
it happened every time (TODO 114). The fold is still measured from scratch
(`T-reflow-resets-before-measuring`); only the close and the rebuild wait
for a real change. The chips are compared by ELEMENT, so a re-render, which
makes new ones, still rebuilds.

- Site: `src/components/sherpa-quick-filter-toolbar/sherpa-quick-filter-toolbar.ts`
- Site: `test/e2e/reforged-quick-filter-toolbar.spec.ts`

### T-a-gap-click-is-the-menus-own

**A click in a popover menu that lands on no control is the menu's own.** The
card is drawn in the top layer, but in the DOM the menu is still inside its
host — so a click on the padding or between rows bubbled to an accordion's
`<summary>` and toggled it (TODO 106), and would reach any click listener
behind it. The menu calls `preventDefault()` (no `<summary>` or link acts) and
`stopPropagation()` (no listener hears it). A row is a native control, so the
control is the click's target and does its job; an inline menu is not drawn
over anything, so it is left alone.

- Site: `src/components/sherpa-menu/sherpa-menu.ts`
- Site: `test/e2e/reforged-menu-gap-click.spec.ts`

### T-the-baseline-is-taken-at-show

**A committing menu takes its baseline — what Cancel restores — in `show()`,
the moment the card opens.** Not in `toggle`: the browser fires that as a TASK
later, and a tick in the gap was taken INTO the baseline, so it was not a draft
— `dirty` read false and a remote chip was never pending (TODO 95). Firefox
runs the task later than Chromium, so only Firefox showed it. `toggle` still
takes one for an open that did not come through `show()`; a close clears the
flag.

- Site: `src/components/sherpa-menu/sherpa-menu.ts`

### T-the-more-menu-holds-what-folded

**The ⋮ button opens a menu of every action that has FOLDED away at this
width, and a row does what its button does.** TODO 43: it opened nothing — it
only sent `filter-overflow`, which nothing heard. The order is Will's: Suggest
filters, Reset filters, the page's own buttons (the panel switch), a divider,
then Favorite, Save view, Save view as, Refresh view.

"Folded" is read from the page: a button whose computed `display` is `none`
— the container queries and `data-collapse` both fold, and one test covers
both. The menu is built on each open, like the grid's actions menu.

Building it found a CSS bug: the view type's own `display: inline-flex` for
★ · Save · ▾ came AFTER the fold steps with the same weight, so on a view bar
the group NEVER folded. Its block sits before the steps now, and the width
rule names the view type too.

**The filter PANEL has one too** — Will, TODO 178: after the host's own
toggle, holding Reset and Reset all to default once the panel is narrow
(≤ 380px), and the host's own buttons when they fold. **Both ⋮ menus end in
the host's own option**, "Limit matching filters", a check row, shown while
the host says it offers one (`data-limit-options="on|off"`, written by the
provider) — so the bar's ⋮ shows at any width then. Ticking it REPORTS
`limit-options-change`; the provider owns the setting, and the app keeps it.

- Site: `src/components/sherpa-quick-filter-toolbar/sherpa-quick-filter-toolbar.ts`
- Site: `src/components/sherpa-quick-filter-toolbar/sherpa-quick-filter-toolbar.html`
- Site: `src/components/sherpa-quick-filter-toolbar/sherpa-quick-filter-toolbar.css`
- Site: `test/e2e/reforged-quick-filter-toolbar.spec.ts`
- Site: `src/components/sherpa-filter-panel/sherpa-filter-panel.ts`
- Site: `src/components/sherpa-filter-panel/sherpa-filter-panel.html`
- Site: `src/components/sherpa-filter-panel/sherpa-filter-panel.css`
- Site: `test/e2e/reforged-filter-panel-component.spec.ts`

### T-a-number-is-reset-not-cleared

A number menu's footer button is **Reset**, not Clear — Will, TODO 134: its
field goes empty and its slider's handles go back to the bounds, in BOTH
shapes, and the filter goes with them at once, as Clear's does.

Clear had done NOTHING to a number. Its sweeps are
`this.querySelectorAll('input' | 'sherpa-calendar' | 'sherpa-slider')` — the
menu's SLOTTED children — and the number body moved into the menu's own
shadow root (`T-a-menu-owns-its-own-bodies`). The button emitted `menu-clear`
and a `menu-change` that still carried both ends, so the chip stayed on.

Both buttons exist in the template and CSS shows one: `.reset` where
`data-body="number"`, `.clear` everywhere else.

- Site: `src/components/sherpa-menu/sherpa-menu.ts`
- Site: `test/e2e/reforged-number-filter-reports.spec.ts`


### T-a-number-waits-for-apply

**A number filter waits for Apply — single or range, local or remote — and
Cancel puts back what was applied.** Will, TODO 94: *"Numerical (and range)
filter menus need apply/cancel buttons."* A number is TYPED, so there is no
moment its answer is obviously finished. A pick applies at once locally (62);
a number is the one exception. `menuFor()` gives every number menu
`data-commit` and `data-commit-fixed`, so the Range switch cannot turn Apply
off. A definition that NAMES `commit` still wins.

- Site: `src/core/ui/filter-menu.ts`
- Site: `test/e2e/reforged-number-filter-reports.spec.ts`
- Site: `test/e2e/reforged-quick-filter-toolbar.spec.ts`

### T-a-disabled-button-acts-on-nothing

**A disabled `sherpa-button` refuses the click, as a native button does.** It
toggled `disabled` on its inner `<button>`, so a click on the inner control
did nothing — but a click on the HOST still reached every listener bound
there, and a menu's footer binds its Apply as `click` on the host. So Will's
calendar footer "looked inactive, yet they are still clickable and they work"
(TODO 83): paint, not behaviour.

A capture listener on the host stops the click while `disabled` — no host
listener, no ancestor, no `button-click`. Capture, because at the target a
capturing listener runs before every other, whoever bound it first.

A test that pressed Apply on a menu it never OPENED only passed because of
this: a shut committing menu's footer is off (`dirty` needs `open`). Five tests
open their menu first now, as a reader must — and a draft set from code
(`values`, `conditions`, `mode`, typed text) tells the footer too.

- Site: `src/components/sherpa-button/sherpa-button.ts`
- Site: `test/e2e/reforged-a-calendar-pick-wakes-the-footer.spec.ts`
- Site: `test/e2e/reforged-quick-filter-toolbar.spec.ts`
- Site: `test/e2e/reforged-filter-conditions.spec.ts`
- Site: `test/e2e/reforged-grid-keeps-both-answers.spec.ts`
- Site: `test/e2e/reforged-data-grid.spec.ts`

### T-a-date-reads-one-way

**A day, or a range of days, reads ONE way, from one DOM-free formatter.**
Will, TODO 45: `DD Mmm YYYY`; a range says each part once — `03 to 15 Sep
2026` within a month, `03 Sep to 15 Oct 2026` within a year, `18 Dec 2026 to
03 Jan 2027` across years. `formatDate()` in `src/core/data/format-date.ts`;
more formats join it there.

Two things it must keep: the day is read and formatted in UTC — parsed as
local time, a browser west of Greenwich showed the day before — and the parts
come from `formatToParts`, not `toLocaleDateString`, whose order follows the
locale ("Sep 03" in the US). The month NAME follows the locale; the order does
not.

- Site: `src/core/data/format-date.ts`
- Site: `src/data.ts`
- Site: `test/unit/format-date.test.mjs`
- Site: `test/e2e/reforged-quick-filter-toolbar.spec.ts`
- Site: `src/core/data/filter-face.ts`
- Site: `test/unit/filter-face.test.mjs`

### T-a-made-up-key-never-leaves-the-data-layer

**A row with no key field gets a key from the data layer, and the key is kept
BESIDE the row, never on it.** Will, 2026-09-29 (TODO 103): *"Keys are only
for Sherpa's capabilities so we need to make sure we don't pollute any data we
are ever sending out of the data layer to external sources."*

`row-key.ts` holds a `WeakMap` from each row object to its key: the row's own
key field when it has one, else a MADE-UP key, `sherpa:<load>:<n>`. Nothing is
written on the row, so the key cannot leak into JSON, a store write, an export
or a saved View's rows.

**A store keys its rows on the way OUT** (`BaseStore.checkRows` → `keyed()`),
so every store gives every row a key. `ArrayStore` hands out a COPY on every
load, so it keys its own rows once and carries each key to the copy —
otherwise a keyless row got a new key per load and a selection vanished on a
sort. A store that re-reads its rows (Local, Rest, Idb) can only make one up
per load for a keyless row: stable while the rows are, as TODO 103 said.

**A made-up key names a row for THIS page load only.** `<load>` is new each
load, so an old saved key can never pick a new row that happens to reuse its
number: `grid.select()` drops a stale one and reports `stale-made-up-key`,
rather than restore the wrong rows. The grid selects by key always now, and
`selection-change` sends keys, not positions.

- Site: `src/core/data/row-key.ts`
- Site: `src/core/data/base-store.ts`
- Site: `src/data.ts`
- Site: `src/components/sherpa-data-grid/sherpa-data-grid.ts`
- Site: `test/unit/a-keyless-row-gets-a-key.test.mjs`
- Site: `test/e2e/reforged-a-keyless-row-selects-by-key.spec.ts`

### T-both-answers-are-kept

**A reading keeps BOTH answers, and `mode` says which one filters.** Will,
2026-09-29 (TODO 102): *"Both simple and advanced mode conditions need to be
tracked and stored to allow switching at any point."* The picks — and a typed
`op` / `text` from a number body — are Simple's answer; the `conditions` rows
are Advanced's. `fieldState()` compiles only the one in force, so a switch
changes what filters and loses nothing.

A reading with no `mode` was written before both were kept, and keeps the old
rule: rows win where there are any. A saved View or filter from before still
means what it meant.

`mirror` says the rows are still a copy of the picks: the first switch carries
X and Y over as `Equals X` OR `Equals Y`, and a change to the picks redraws
them — until the reader edits a row.

The data source copies a reading through `READING_KEYS`. A key left off that
list is dropped with no error, so `mode` and `mirror` are on it.

**A host reads and writes the menu's answer as `menu.reading`, never its
parts.** The bar read `data-op` and the typed box — row one's echo — even in
Simple mode, so a reader who typed "D" in a row and switched back sent
"starts with D" as Simple's answer; the source's redraw then forced the chip
back to Advanced and dropped the second row. That was Will's bug. The chip's
face reads the same reading, and `filterFace()` speaks for the answer in force:
Advanced for its first ROW, Simple for its picks.

In the PANEL, Simple's answer is the field's value CHIPS and Advanced's is its
menu's rows. The panel's own switch carries the chips over, and while the rows
still mirror them a chip click redraws them. The panel forced a field with rows
into Advanced on every redraw too — the same bug as the bar's — and now follows
the reading's mode.

An old reading still means what it meant: `readingRows()` turns its one typed
condition, or its non-default op over picks ("is not A and is not B"), into
rows — and those picks are the op's, so they are NOT also ticked as Simple's
answer: "is not churned" ticking churned would filter for the opposite. A
number chip reads its body's reading whatever its menu's type, or "> 2"
filtered and its face stayed blank (TODO 82). And on a rebuild the READER'S kept answer wins over the def's opening
one, or a def's typed condition came back on every rebuild.

- Site: `src/core/data/filter-state.ts`
- Site: `src/core/data/data-source.ts`
- Site: `test/unit/both-answers-are-kept.test.mjs`
- Site: `src/components/sherpa-menu/sherpa-menu.ts`
- Site: `test/e2e/reforged-menu-keeps-both-answers.spec.ts`
- Site: `src/components/sherpa-quick-filter/sherpa-quick-filter.ts`
- Site: `src/core/data/filter-face.ts`
- Site: `test/e2e/reforged-filter-conditions.spec.ts`
- Site: `src/components/sherpa-filter-panel/sherpa-filter-panel.ts`
- Site: `test/e2e/reforged-panel-keeps-both-answers.spec.ts`
- Site: `src/components/sherpa-data-grid/sherpa-data-grid.ts`
- Site: `test/e2e/reforged-grid-keeps-both-answers.spec.ts`

### T-one-number-is-a-pick-under-equals

**One typed number is a PICK under `=`, and typed TEXT only under an op that
takes text** (`<`, `>`, `≤`, `≥`). `OP_TAKES.eq` is `list`, so `fieldState()`
reads `{ op: 'eq', text: '100' }` as unanswered: the reading reached the source
and filtered nothing. The bar sent a single number that way from the day its
body moved into the menu — TODO 104 found it on the Records page, where 100
rows stayed 100.

The menu decides it once, in its own `reading` (`#bodyReading()`), for the bar
and the panel: `{ picked: ['100'], op: 'eq', range: false }` under `=`, and
`{ op: 'gt', text: '100' }` under `>`. Restoring a chip reads `text` first,
then `picked`, so both shapes round-trip. The test binds a real source and
counts ROWS, because the event alone was not enough to prove it.

- Site: `src/components/sherpa-menu/sherpa-menu.ts`
- Site: `test/e2e/reforged-number-filter-reports.spec.ts`

### T-a-menu-owns-its-own-bodies

A menu's BODY — the Range switch, the number field and slider — lives in
`sherpa-menu`'s own shadow root, and `data-body` picks one.

Before this, each host handed one over as a slotted child. A slotted child is
styled by whoever handed it over, so the SAME Range switch existed twice with
two spellings and two sets of rules:

    qf-range-row / qf-range-switch / qf-row-label            (toolbar)
    head-filter-range / …-range-switch / …-range-label       (grid)

Same three elements, same `data-row`, same switch, same word. Will, 2026-09-25:
*"Perhaps we should keep all menu templates in the menu component's HTML file.
That way we always have a single source to pull, or base new templates, from."*

The menu also takes the rules that went with the body: the ends CLAMP the field
as well as the slider, and a RANGE defers, because the pick is not finished on
its first end. `data-commit-fixed` says a host named `commit` itself and
outranks that.

**THE CALENDAR IS THE EXCEPTION, and it is not a small one.** A date body stays
a SLOTTED child. `sherpa-calendar` projects its stepper into the menu's
`header` slot, and slot assignment only reaches a host's LIGHT DOM — inside the
menu's shadow root it has nothing to project into, and the menu's header comes
up empty. Measured: the test for it fails with the projected header null.
TRAP T-projected-slot-content-crosses-two-shadow-boundaries

So the switch above a calendar is the menu's; the calendar below it is the
host's. That reads like an inconsistency and is a platform limit.

- Site: `src/components/sherpa-quick-filter/sherpa-quick-filter.ts`
- Site: `src/components/sherpa-menu/sherpa-menu.html`
- Site: `src/components/sherpa-menu/sherpa-menu.css`
- Site: `src/components/sherpa-menu/sherpa-menu.ts`
- Site: `src/components/sherpa-quick-filter-toolbar/sherpa-quick-filter-toolbar.ts`
- Site: `src/components/sherpa-quick-filter-toolbar/sherpa-quick-filter-toolbar.html`
- Site: `test/e2e/reforged-quick-filter-toolbar.spec.ts`
- Site: `src/components/sherpa-data-grid/sherpa-data-grid.ts`
- Site: `test/e2e/reforged-data-grid.spec.ts`
- Site: `src/core/ui/filter-menu.ts`
- Site: `test/e2e/reforged-filter-panel-component.spec.ts`

### T-projected-slot-content-crosses-two-shadow-boundaries

A component that projects content into its HOST's slot can only do so from the
host's LIGHT DOM. Move it into the host's shadow root and the projection stops
— silently, with an empty slot rather than an error.

`sherpa-calendar` puts its month stepper into `sherpa-menu`'s `header` slot.
That is why a date body cannot move into the menu's shadow root with the number
body: it would have nothing to project into.
TRAP T-a-menu-owns-its-own-bodies

- Site: `src/components/sherpa-menu/sherpa-menu.html`
- Site: `src/core/ui/filter-menu.ts`

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
the definition pinned it, and it is REPORTED — the filter's SHAPE changed, so
what it means changed with it, and a host reading `values` needs to hear that
even though no value moved. The menu says it as it says a value change: a
plain `change` for an inline host, its draft marked dirty for Apply, and
`menu-change` where it does not wait. When the menu took over its own bodies
the flip kept only `menu-range-change`, which nothing hears, so a switch to
Range filtered nothing until an end was moved — TODO 131. Each shape keeps
what it held: `T-both-shapes-are-kept`.

`sherpa-switch` re-dispatches its native `change` as a COMPOSED one, which is
why this reaches the toolbar where a bare checkbox's would not.

`time` joins this list later — the same calendar with `data-has-time`, not a new
template.

- Site: `src/components/sherpa-quick-filter-toolbar/sherpa-quick-filter-toolbar.ts`
- Site: `src/components/sherpa-menu/sherpa-menu.css`
- Site: `src/components/sherpa-menu/sherpa-menu.html`
- Site: `src/components/sherpa-menu/sherpa-menu.ts`
- Site: `test/e2e/reforged-number-filter-reports.spec.ts`

---

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

- Site: `test/e2e/reforged-quick-filter-toolbar.spec.ts`
- Site: `src/components/sherpa-quick-filter/sherpa-quick-filter.ts`

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


(none — `T-tokens-css-never-reaches-shadow` already exists and already lists this file as a Site. This extraction only compresses the surrounding prose; the citation already present is kept verbatim.)

- Site: `src/components/sherpa-quick-filter/sherpa-quick-filter.ts`

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
- Site: `src/core/data/cycle.ts`
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

The STATEFUL/stateless split is section 4 of `docs/DATA-SOURCE-RULES.md`. This
is what happens without it.

The same sort was written three times — grid, toolbar, and the app wiring them —
and the compares were NOT identical, so "item 2" and "item 10" ordered
differently depending which control you used. One value, no disagreement.

Binding is two-way out of parts that already existed: `source → component` is
`populate(rows)` plus `data-*` attribute writes; `component → source` is the
component's own ratified noun-verb events (`sort-change`, `page-change`…). One
filter change re-populates every bound component, so the grid's own header arrow
and the toolbar's Sort chip become two views of one value.

- Site: `src/core/data/data-source.ts`

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

- Site: `src/core/data/data-source.ts`

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

- Site: `src/core/browser/persist-view.ts`
- Site: `src/core/data/data-source.ts`
- Site: `src/core/data/bind-selection.ts`
- Site: `src/components/sherpa-layout-grid/grouped-grid.ts`

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

- Site: `src/core/data/data-source.ts`

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

- Site: `src/core/data/data-source.ts`

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

- Site: `src/core/data/data-source.ts`

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

- Site: `src/core/data/data-source.ts`

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

**"Answered" holds only while NOTHING ELSE is in flight.** A request whose key
matches `#lastLoadKey` was skipped even when a DIFFERENT load was in flight —
and that load then landed and overwrote the answer, so the request was lost for
good. Found on the running page in Firefox, raising Status to the header:

    done       status = active        the last finished load
    in flight  status cleared         the grid, re-announcing without it
    asked      status = active again  the header taking it → SKIPPED
    landed     status cleared         100 rows, and nothing asked again

Chromium batched the two writes into one load, so only Firefox showed it. The
shortcut is `key === #lastLoadKey && #loaded && !#inFlight` now;
`test/unit/a-request-back-to-the-last-answer-still-runs.test.mjs` gates a load
back to the last answer, and that a true no-op still skips.

- Site: `src/core/data/data-source.ts`
- Site: `test/unit/a-request-back-to-the-last-answer-still-runs.test.mjs`

### T-parts-order-must-be-stable

`#parts` is a **Map**, so a key is REPLACED rather than appended and iteration
order is stable.

The composed filter must not re-order itself between loads. If it did,
`#stateKey()` would see a change where there is none and the identical-key skip
(`T-no-op-load-guard`) would stop working — every no-op contribution would cost
a full load again.

- Site: `src/core/data/data-source.ts`

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

- Site: `src/core/data/data-source.ts`

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

- Site: `src/core/data/data-source.ts`

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

- Site: `src/core/data/data-source.ts`

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

- Site: `src/core/data/data-source.ts`

### T-error-is-a-state-not-a-throw

**The rule is in `docs/DATA-SOURCE-RULES.md`, section 6:** a failed load is a
state, and a setter never throws.

What belongs here is the ordering nobody would guess. Both the catch and the finally
re-check the in-flight ticket (`T-in-flight-ticket-discards-stale`), so a stale
failure cannot raise an `error` for a load that has already been superseded, and
cannot clear a newer load's loading flag.

A page can also fall PAST THE END when a filter narrows the set. It is re-clamped
and reloaded ONCE — FORCED, because `#lastLoadKey` was just written and the
re-clamp must re-read whatever the new page holds — rather than showing an empty
page.

- Site: `src/core/data/data-source.ts`

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

- Site: `src/core/data/data-source.ts`
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

- Site: `src/core/browser/persist-view.ts`

### T-storage-access-throws

Web Storage **throws on ACCESS** — not on read, on touching the global — in a
private window, with site data blocked, and during preview or thumbnail
capture.

A failure means the state is not KEPT. It never means the page breaks.

`src/core/browser/web-storage.ts` is the only place that knows this. Before it,
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

- Site: `src/core/browser/web-storage.ts`
- Site: `src/core/browser/persist-view.ts`
- Site: `src/core/browser/saved-filters.ts`
- Site: `src/core/browser/session.ts`
- Site: `src/core/browser/idb-store.ts`
- Site: `src/core/data/stores.ts`
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

- Site: `src/core/browser/persist-view.ts`

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

- Site: `src/core/browser/persist-view.ts`
- Site: `src/core/browser/view-sync.ts`

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
state refers to are on their way, then each element. An element that has not
drawn yet (`hasRendered` false) gets its state once `rendered` settles — a grid
cannot filter a column it does not have yet, and a composer wrote its value
into a textarea that did not exist, so it was lost (TODO 113). A drawn element
is applied at once. That deferral is also why the report can only name what it
knows NOW: a not-yet-drawn element's skips are added to it when they land.

The same rule governs `onViewPicked`, which reports gaps and never throws; the
default is a `console.warn`, because a definition that could not be fully applied
is worth saying out loud rather than leaving a reader to wonder why half the
screen moved.

- Site: `src/core/browser/persist-view.ts`
- Site: `test/e2e/reforged-view-definition.spec.ts`

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

- Site: `src/core/browser/persist-view.ts`

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

- Site: `src/core/browser/persist-view.ts`

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

- Site: `src/core/browser/persist-view.ts`

### T-library-re-read-on-every-pick

`onViewPicked`'s `views` may be a FUNCTION, and should be whenever the set can
grow.

A library GROWS — a reader saves a view and it joins the set — and a listener
holding the object it was wired with would never see one. **The dashboard's Save
button wired the presets and then could not restore anything the reader had
saved.** So the library is RE-READ on every pick. Pass the object only for a
fixed set of presets.

- Site: `src/core/browser/persist-view.ts`

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

- Site: `src/core/browser/persist-view.ts`
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

- Site: `src/core/browser/persist-view.ts`

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

- Site: `src/core/browser/persist-view.ts`
- Site: `src/core/browser/web-storage.ts`
- Site: `src/core/browser/saved-filters.ts`

### T-store-is-stateless

**The rule is in `docs/DATA-SOURCE-RULES.md`, section 4:** a store is stateless,
and sorting, filtering, grouping and paging belong to the `DataSource`.

What belongs here is the part that surprises. Every store extends `EventTarget`, so "tell everyone the records changed" is the
platform's own `dispatchEvent` rather than a subscriber list written by hand. A
`change` detail names what happened so a listener can be cheap about it, but a
DataSource simply RELOADS: deciding whether a changed row still matches the
current filter, and where it now sorts, is exactly the work the source already
does, and re-deriving is cheaper than getting that wrong.

- Site: `src/core/data/store.ts`

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

- Site: `src/core/data/store.ts`

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

- Site: `src/core/data/store.ts`
- Site: `src/components/sherpa-menu/sherpa-menu.ts`
- Site: `src/components/sherpa-menu/sherpa-menu.css`
- Site: `src/components/sherpa-menu/sherpa-menu.html`

### T-an-asked-load-is-awaited

`source.load()` asked a second time, while the SAME question is still out,
returns that load's own promise. It used to return the result in hand — the
one from BEFORE the load — so `await source.load()` came back with no rows
while the first load was still in flight.

Nothing saw it while a local store answered in one microtask: the first load
always won the race. The store's check moving ahead of its page cut
(`T-a-refused-row-never-shortens-a-page`) added two ticks, and 27 tests that
bind, then `await load()`, read an empty page. The race was always there; a
store over a network loses it every time.

- Site: `src/core/data/data-source.ts`


### T-a-refused-row-never-shortens-a-page

A local store CHECKS its rows first, then searches, sorts and cuts the page
(`BaseStore.page`). It did it the other way round: `applyOptions` cut 25
rows, and `checkRows` then dropped the ones the schema refused — so each
refused row left its page one short, and the total ("it drops with the rows")
changed from page to page, moving the pager's page count with it.

It shows only on a store that has LIVED. A fresh seed is all valid; a
database that an older build wrote to holds rows today's schema refuses — a
customer saved with no organisation, before that was required. Will, TODO
160: "Row count was set to 25. Not all data grid pages had 25 rows." No test
and no clean browser could see it.

`dropped` and `issues` are now of the WHOLE set, said on every page. The cost
is a check of every row on each load, where it was one page; `sample` still
bounds it (`T-schema-sample-cost`). A REMOTE store is paged by its server, so
it can only check the page it was sent.

- Site: `src/core/data/base-store.ts`
- Site: `test/unit/refused-row-page.test.mjs`
- Site: `test/e2e/reforged-idb-store.spec.ts`


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

- Site: `src/core/data/store.ts`
- Site: `src/core/data/base-store.ts`
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

- Site: `src/core/data/store.ts`
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

- Site: `src/core/data/store.ts`

### T-loose-equal-is-case-insensitive

`looseEqual` compares for FILTERING, not for sorting.

A filter value arrives as a STRING far more often than not — from an attribute, a
query string, a chip's `value`. `'pro' === 'Pro'` is false and would quietly
filter EVERYTHING away, so string comparison here is case-insensitive. A
strictly-typed comparison stays available through `lt`/`gt`.

`between` is inclusive AND order-insensitive: a date range picked backwards is a
range, not an empty result. The two ends are swapped into order before the
comparison rather than rejected.

- Site: `src/core/data/store.ts`

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

- Site: `src/core/data/store.ts`

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
- Site: `src/components/sherpa-quick-filter-toolbar/sherpa-quick-filter-toolbar.ts`
- Site: `src/core/data/data-source.ts`
- Site: `src/core/data/filter-state.ts`
- Site: `test/unit/field-selection.test.mjs`
- Site: `test/unit/filter-state.test.mjs`
- Site: `test/e2e/reforged-filter-scope.spec.ts`
- Site: `src/components/sherpa-quick-filter/sherpa-quick-filter.ts`
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
- Site: `src/components/sherpa-menu/sherpa-menu.ts`
- Site: `test/e2e/reforged-data-grid.spec.ts`

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

### T-a-silent-write-still-needs-a-way-to-report

A SILENT setter needs a companion that says "now read me".

Silence is right: `setChipValues`, `setColumnFilter`, `select` and `values`
all write without emitting, so a host that set a value is not echoed back into
its own handler and a filter is not applied twice. But silence is only half the
contract. A host that writes one control and needs the VIEW to re-query has no
way to ask for that, and the two drift apart while both look correct.

The legend binding is the case that proved it. Switching a row back on cleared
its own `legend:plan` part and wrote "nothing ticked" onto the mirrored chip —
correctly, since everything-on is no filter. The chip went quiet, so the view
kept the clause it had built from the chip's LAST state, `plan in (the other
three)`, and the row came back reading zero. Every visible control said "no
plan filter" while the query still held one.

`SherpaQuickFilterToolbar.report()` is the door: it re-announces the whole bar,
exactly as a reader's own change would. The binding writes the chip, then says
so.

**This is a shape, not one bug.** `sherpa-app-header.values` and the grid's
`setColumnFilter` / `clearColumnFilter` / `select` are silent with no
counterpart. Each is a place a host can write state that nothing downstream
will ever hear about.

**`DataSource.select()` is the answer for a FIELD**, and the reason the legend
no longer mirrors a chip at all. It writes the field's selection, re-queries,
and then emits `selection-change` — one write, one announcement, and every
control over that field re-reads `selection(field)` instead of being pushed to.
The silent setters above are what those controls are DRAWN with, downstream of
the announcement, which is exactly where silence belongs.
TRAP T-one-field-one-filter-menu

See `T-grid-read-without-write-is-half-an-api` for the other half of the same
idea — a value you can read and not write.

- Site: `src/components/sherpa-quick-filter-toolbar/sherpa-quick-filter-toolbar.ts`

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

- Site: `src/core/ui/sherpa-element.ts`

### T-cloning-prototypes-have-no-id

`parseTemplates` maps `<template id="...">` → innerHTML, and returns `null`
when there are NO id'd templates (a single flat template), so the caller can
fall back to the raw markup.

Cloning prototypes are `<template class="...">` with **NO `id`**, and are
deliberately ignored here — they belong to the component's own body, not to its
variant set. An `id` on a row prototype would make SherpaElement's
multi-template parser pick it up as a whole tree to stamp, so the component
would render one row and nothing else.

- Site: `src/core/ui/templater.ts`

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

- Site: `src/core/ui/sherpa-element.ts`

### T-a-needle-comes-from-either-direction

What a view HIGHLIGHTS is what it FILTERED BY, whichever control set the
filter. The grid marked only from its own column menus, so a toolbar chip
reading "Contains Ravi" narrowed a hundred rows to twenty-two and pointed at
nothing — the grid cannot see the bar that holds the chip.

`filterNeedles()` reads them off the filter itself, in the data layer, and
`DataSource.push()` writes `data-needles` beside `data-filter-fields`. One
attribute, `field:op:value` per entry, NEWLINE separated — a comma or a space
is exactly what a reader types into a filter.

Only the SUBSTRING family appears. `eq` matched the whole value, so a mark
would circle everything; `ne` and `notcontains` matched by NOT being there, so
there is nothing to circle. That rule is `MARKABLE_OPS` in `sherpa-element.ts`,
next to `markNeedle()`, which is the one decision every caller shares:
needle-or-nothing, then `markMatch`. See `T-mark-match-is-one-shape`.

- Site: `src/core/data/store.ts`
- Site: `src/core/data/data-source.ts`
- Site: `src/core/ui/sherpa-element.ts`
- Site: `src/components/sherpa-data-grid/sherpa-data-grid.ts`
- Site: `src/components/sherpa-data-grid/sherpa-data-grid.html`
- Site: `test/e2e/reforged-filter-conditions.spec.ts`

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

- Site: `src/core/ui/sherpa-element.ts`

### T-declared-only-means-css-owns-it

`PropKind` is the same three-way split the generated `<name>.component.json`
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

- Site: `src/core/ui/sherpa-element.ts`

### T-harness-serves-font-awesome-locally

> **HISTORY — 2026-09-23.** Font Awesome is GONE. The icons are Figma SVGs
> baked into `icon-paths.ts`, so there is no webfont to serve, no `<link>` in
> the harness and no CDN entry in `sharedStyles`. Measured before removal: the
> CDN sheet was adopted into every shadow root, putting **1,935 `.fa-*` rules**
> into each of 59 roots that matched **nothing**, at 3 network requests per
> page. Kept because the LESSON survives — a shared stylesheet is fetched once
> per page per context, and reading that as a code problem cost a week.

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

- Site: `playwright.config.ts`

### T-icon-box-is-not-the-glyph

**An icon's BOX and its DRAWING are two sizes, not one.** A Figma icon is a
`content/size/*` square holding art that differs per icon: `filter` (17:4701) is
10.5 x 9.625 inside its 14 frame, `triangle-down` is 7 x 4.375, and only 20 of
the 214 fill all 14. The square is the layout contract and never moves; the art
inside it varies.

**Will's rule, RESTATED 2026-09-24 — the art renders at the size it was
DRAWN.** In Figma each icon sits in a square frame with no fill or border, a
pure bounding box; the glyph is drawn to design inside it and scales with it.
So the frame IS the viewBox, and a glyph drawn at half the frame renders at
half. `.sherpa-icon-box` in `src/core/sherpa-icon.css` owns the square
(`--_icon-size`, `flex-shrink: 0`, inherited colour);
`preserveAspectRatio="xMidYMid meet"` keeps the art 1:1 and inside.

**The rule this replaces said the longest axis was 100% of the square**, and
the renderer implemented it by setting the viewBox to the art's own INK bbox.
That re-fit every drawing and threw the design away: measured across all 214,
only 19 are drawn at 100%, so 195 were inflated — `filter` by 1.33x, and
`triangle-down` from 7 units wide to 14, twice its Figma size. It was reported
as "the caret glyph is too big in its container", which is exactly what it was.

The ink bbox is still generated, because a test or a tool may reasonably ask
how much of its frame an icon uses. It no longer decides what renders.

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
`scripts/generate-icons.mjs` (`npm run icons`) into `src/core/ui/icon-paths.ts`
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
- Site: `src/core/ui/render-icon.ts`
- Site: `src/core/ui/icon-paths.ts`
- Site: `scripts/generate-icons.mjs`
- Site: `test/e2e/reforged-num-coercion.spec.ts`
- Site: `src/core/ui/render-icon.ts`
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

- Site: `src/core/ui/sherpa-element.ts`

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

- Site: `src/core/ui/sherpa-element.ts`

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

- Site: `src/core/ui/sherpa-element.ts`

### T-variant-attrs-or-one-way-door

`static variantAttrs` names the attributes `templateId` reads, so changing one
RE-STAMPS the tree. A multi-template component MUST list them.

The base class cannot work them out: `templateId` is an INSTANCE getter, and
`observedAttributes` is read off the CONSTRUCTOR before any instance exists.

Left empty it is a silent ONE-WAY DOOR — the variant is whatever the element
was BORN with. That is what `data-multiline` did on `sherpa-input-text`: the
textarea template existed and was unreachable after first render.

- Site: `src/core/ui/sherpa-element.ts`
- Site: `src/components/sherpa-menu/sherpa-menu.ts`
- Site: `src/components/sherpa-input-text/sherpa-input-text.ts`
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

- Site: `src/core/ui/sherpa-element.ts`
- Site: `src/core/ui/templater.ts`

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

- Site: `src/core/ui/sherpa-element.ts`

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

- Site: `src/core/ui/sherpa-element.ts`
- Site: `src/core/ui/templater.ts`

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

- Site: `src/core/ui/sherpa-element.ts`
- Site: `src/components/sherpa-app-header/sherpa-app-header.ts`

### T-set-removes-on-falsy

`this.set(attr, value)` is the declared JS→CSS write path — the counterpart of
`this.dataset['len'] = String(count)`, which `sherpa-sparkline` does by hand to
tell its CSS how many points it drew.

`null`, `undefined` and `false` REMOVE the attribute, so `:host([data-x])`
stops matching. `true` sets it EMPTY — a bare boolean attribute. Writing
`"false"` or `"null"` instead would leave the selector matching forever, which
is the whole failure this rule prevents.

- Site: `src/core/ui/sherpa-element.ts`

### T-empty-write-lets-css-collapse

Writing a declared `content` prop treats ABSENT, EMPTY and A MISSING TARGET as
the same thing: write `''`.

That is what lets the component's own `:empty` / `data-has-*` CSS collapse the
node. **The base class never hides anything itself** — CSS owns visibility, so
there is no `display: none` and no `.hidden` toggle anywhere in here.

A `number` prop whose parse fails resolves to `NaN`, and `'NaN'` is written as
`''` for the same reason: an empty node collapses, the literal string "NaN"
does not.

- Site: `src/core/ui/sherpa-element.ts`

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

- Site: `src/core/ui/sherpa-element.ts`
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

A FORWARDED slot — `<slot slot="metadata">`, handed on to a child
component — is the one node read WITH `flatten`: it counts only for what it
carries. Read as a plain element, an empty one was "filled", and the overlay
panel drew an empty metadata strip under every heading.

- Site: `src/core/ui/sherpa-element.ts`
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

- Site: `src/core/ui/sherpa-element.ts`

### T-render-list-keeps-fill-in-the-caller

**`renderList` is folded into `renderItems`** (2026-09-29, the API audit's
A2): its `fill` is now `renderItems`' `after`. The rule stands.

`renderItems` does the four steps every data-driven list repeats: clear the
container, clone the prototype per item, fill, append. What each row then
BECOMES is the caller's business and stays in `after` — a roving tabindex, an
`aria-current`, a per-column type. Only the plumbing is shared. Its clone is
IMPORTED, as `clone()`'s is, so a component in an item upgrades at once and
its icons draw.

The template is looked up ONCE and reused for the whole run, so a long list
costs one shadow query rather than one per row.

`clear: 'own-children'` removes only nodes matching `ownSel` instead of
emptying the container. `sherpa-list` needs it: its rows sit beside a `<slot>`,
and `replaceChildren()` would take the slot with them. `renderItems` takes the
same option for the same reason.

The index passed to `after` is the LOOP position. A component stamping a
DIFFERENT index — `sherpa-barchart` writes each datum's original position while
iterating a filtered list — writes it inside `after` from its own data.

- Site: `src/core/ui/sherpa-element.ts`

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

- Site: `src/core/ui/sherpa-element.ts`

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

### T-a-trigger-click-follows-light-dismiss

A trigger button cannot decide "open or shut?" by asking its own menu. The
native popover **light-dismisses on `pointerdown`**, which lands BEFORE the
`click` — so by the time the handler runs an open menu already reports shut,
and `toggle()` re-opens the thing the user just closed.

The button reads its own `data-open` flag instead. That is set from
`menu-open` / `menu-close`, so it is still true at `pointerdown`, and the
handler clears it before deciding.

It then calls `hide()` — it does not merely decline to `show()`. A click that
did NOT dismiss leaves the menu open, and only the explicit `hide()` closes it.
Declining alone passed the real-pointer case and left the menu stuck open under
a synthetic click.

`data-open` is also what CSS reads for the pressed look: real focus has moved
inside the menu, so `:focus-visible` on the trigger is false.

**Swept 2026-09-24, and three components had re-introduced it.** `sherpa-button`
solved this once; anything that calls `menu.toggle()` from its own click handler
gets it back. Measured live — each opened on click 1 and no later click could
shut it:

| component | what it did | fix |
|---|---|---|
| `sherpa-chart-legend` | menu was a SIBLING of the button | slot it INTO the button |
| `sherpa-quick-filter` | `menu.toggle(this)` on a native caret | read its own `data-open` |
| `sherpa-notifications` | proxied `toggle()` straight through | track `#open` from the menu events |

`sherpa-data-grid.openColumnFilter()` reached past its chip to the menu and got
the bug through that door. It now asks the CHIP — which owns the safe open —
and passes the anchor along, because a toolbar chip borrows this menu and must
see it over ITSELF (`T-grid-toolbar-chip-borrows-the-menu`).

**The rule:** a component that owns a menu never calls `toggle()` from a click.
It slots the menu into a `sherpa-button`, or it tracks its own open flag.

- Site: `src/components/sherpa-button/sherpa-button.ts`
- Site: `test/e2e/reforged-button.spec.ts`
- Site: `src/components/sherpa-chart-legend/sherpa-chart-legend.ts`
- Site: `src/components/sherpa-chart-legend/sherpa-chart-legend.html`
- Site: `test/e2e/reforged-chart-legend.spec.ts`
- Site: `src/components/sherpa-quick-filter/sherpa-quick-filter.ts`
- Site: `src/components/sherpa-notifications/sherpa-notifications.ts`
- Site: `src/components/sherpa-data-grid/sherpa-data-grid.ts`

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
- Site: `src/components/sherpa-filter-panel/sherpa-filter-panel.ts`

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

A list of FILTERS has none: `data-no-select-all`, from a def's
`selectAll: false`. Adding every filter at once is never the answer, and under
"Added filters" it read as selecting only those. Will, 2026-09-25.

- Site: `src/components/sherpa-menu/sherpa-menu.ts`
- Site: `src/components/sherpa-menu/sherpa-menu.html`
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
- Site: `src/core/ui/filter-menu.ts`

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
- Site: `test/e2e/reforged-quick-filter-toolbar.spec.ts`

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

### T-one-state-per-filtered-field

A field is drawn in several places at once, and each control used to WORK OUT
what it showed — so the same field could read several ways. A chip, its menu, a
column heading, that heading's menu, the chip's caret and its badge were six
answers to one question.

Measured before this module existed: **39 places wrote field state** and **31
wrote value state**. Every filter bug in this session was one symptom of that —
a chip ON while its menu held nothing, a column menu offering three values
where the chip offered four, a value spelled `gold` in one and `Gold` in the
other, a legend row that came back holding zero.

`fieldState(facts, reading)` is the one answer, and it is DOM-free:

| | |
|---|---|
| `field` | which column |
| `fieldState` | `off` / `active` / `suspended` |
| `values` | EVERY value the field has |
| `valueStates` | `picked` / `unpicked` / `unavailable` |

The rules it settles, once:

- EVERYTHING picked is `off` — the same rows as no filter, and only one of
  them should look like a filter (`T-everything-on-is-no-filter`)
- a TYPED condition is `active` with nothing ticked
- a value no remaining row carries is `unavailable`, never dropped
  (`T-unavailable-value-sorts-below-a-divider`)
- comparison is the QUERY's, so casing cannot break a pick
  (`T-one-comparison-rule-for-query-and-ui`)
- `suspended` keeps the values and applies nothing
  (`T-grid-suspend-is-not-clear`)

**ADOPTED, not merely available.** `sherpa-quick-filter` reads its badge,
caret, count and tooltip from `filterFace()`; `sherpa-quick-filter-toolbar`
exposes `states` and derives `clauses` from it; `bindLegendFilter` reports a
`state` too — a legend's "hidden" is the INVERSE of "picked", the same fact
stored the other way round, so a legend and a chip over one field report the
same value states. Their CLAUSES differ in shape and agree in meaning: the
legend writes the NOT form, which is shorter for one hidden value out of four. A module nobody calls is a
second answer waiting to happen, which is what these were for four commits.

`stateClause()` turns one state into a `FilterClause` — one pick is `eq`,
several become `in`, because `eq` against a list can never match.
`filterFace()` turns it into what a control DRAWS: the on/off, the badge sign,
the value, the count and the tooltip. A control that computes any of these
itself is a second answer, and the two drift.

**IT IS NOT A FILTER MODULE.** The same four facts describe any control over a
set of values — a tab strip, a nav, a chart legend, a select group, a transfer
list, a calendar's days. Nineteen components hold selection state, and the
question is identical in all of them: which values exist, which are chosen, and
which cannot be chosen right now. `stateClause()` is the only part that speaks
filters; the rest is selection. A transfer list is one state read twice — its
picked values on the right, its unpicked on the left.

- Site: `src/components/sherpa-quick-filter-toolbar/sherpa-quick-filter-toolbar.ts`
- Site: `src/components/sherpa-quick-filter/sherpa-quick-filter.ts`
- Site: `src/core/data/filter-face.ts`
- Site: `src/data.ts`
- Site: `test/e2e/reforged-filter-conditions.spec.ts`
- Site: `test/unit/filter-state.test.mjs`
- Site: `src/core/data/filter-state.ts`
### T-one-field-one-filter-menu

A filter CHIP and a COLUMN HEADING ask the same question of the same field, so
they open the same menu — `sherpa-menu`'s `filter` template.

They did not. The chip's menu was a list of values with no conditions at all;
the heading's was a hand-built body with a condition and a text box and no
list. One field, two answers, and no way to say "Tier contains go" from the
toolbar or to pick a value from the heading.

The menu is a TEMPLATE, not something either caller builds. `data-type="filter"`
is a third value on the Menu set's own Type axis, beside `list` and `calendar`,
so a plain menu stamps no condition markup whatsoever — nothing to hide, nothing
to reason about. The grid's own 161-line text body is gone; it sets the type and
appends the column's distinct values as rows.

Two consequences worth knowing:

- `data-type` is a VARIANT attribute, so setting it RE-STAMPS the shadow tree.
  Anything the menu holds in its DOM is lost across that, which is why the typed
  value lives in `data-value`. See `T-variant-attrs-or-one-way-door`.
- a NUMBER column keeps its own body: its answer is a slider or a range, not a
  list of values, and `between` is a mode rather than a seventh condition.

**THE SAME MENU IS NOT THE SAME ANSWER.** Both controls drew the right rows and
each kept its OWN ticks, so picking `Pro` on the chip left the heading blank —
and the two writers put two clauses over one field into the query. With a
legend over the same field that made three: `plan notin [...]` AND `plan eq
Pro` AND `plan eq Free`, which matches nothing. Every control looked right and
the grid showed zero rows.

The fix is that the SOURCE owns the field, not any control:

| | |
|---|---|
| `declareValues(field, values)` | every value, so each control offers the same rows — and the same STRINGS |
| `select(field, picked)` | the one write; re-queries, then emits `selection-change` |
| `selection(field)` | a `FilterState`, the one answer each control draws from |

The filter is composed from the FIELDS plus the named `contribute` parts, so a
field can only ever contribute one clause. A control that also contributes by
hand must exclude what the source owns — a chip reports both its picks AND a
ready clause, and stripping only the picks let the clause ride in anyway.

`bindLegendFilter` lost its `chip:` option to this: a legend and a chip over
one field have nothing to keep in step once both read `selection(field)`. The
binding went from 194 lines to 152.

- Site: `src/components/sherpa-data-grid/sherpa-data-grid.ts`
- Site: `src/components/sherpa-menu/sherpa-menu.css`
- Site: `src/components/sherpa-menu/sherpa-menu.html`
- Site: `src/components/sherpa-menu/sherpa-menu.ts`
- Site: `src/components/sherpa-quick-filter-toolbar/sherpa-quick-filter-toolbar.ts`
- Site: `src/core/data/data-source.ts`
- Site: `src/core/data/bind-selection.ts`
- Site: `src/data.ts`
- Site: `test/e2e/reforged-data-grid.spec.ts`
- Site: `test/e2e/reforged-filter-conditions.spec.ts`
- Site: `test/e2e/reforged-view-definition.spec.ts`
- Site: `test/unit/bind-selection.test.mjs`
- Site: `test/unit/field-selection.test.mjs`
- Site: `src/core/ui/filter-menu.ts`
- Site: `src/components/sherpa-filter-panel/sherpa-filter-panel.ts`
- Site: `src/core/ui/saved-filter-menu.ts`

### T-an-operator-decides-pick-or-type

A filter menu's CONDITION dropdown leads the card, above the search box, and is
what decides the body beneath it.

`eq` and `ne` over a field with known values are a LIST: the reader picks Gold
rather than typing it, and a typo cannot silently match nothing. `contains`,
`startswith` and the rest are a typed fragment — no list can hold every
substring. `OP_TAKES` in `store.ts` is that rule, beside `OP_LABELS` and
`OPS_FOR_TYPE`, because a second copy is a second vocabulary.

`eq` LEADS `OPS_FOR_TYPE.text` and is `DEFAULT_OP`, so it is what both menus
open on. The column heading's menu defaulted to `contains` before this, which
made one field answer differently depending on which menu the reader reached
for.

**Both bodies are stamped, and CSS reveals one** off the menu's `data-takes`.
Rebuilding on each flip would throw away whichever half was not showing, so a
reader who ticks Gold, looks at Contains and flips back would find the tick
gone. Measured: the ticks and the typed text both survive a round trip.

The `<select>`'s native `change` is the other half of the trap. It BUBBLES but
is not COMPOSED, so it stops at the toolbar's shadow boundary and a listener on
the host never fires — the range-switch handlers beside it work only because
`sherpa-switch` re-dispatches composed. The listener goes on the SHADOW ROOT.
See `T-native-change-stops-at-the-host`.

The event carries `clauses`: each condition chip as a ready `FilterClause`, the
same shape `column-filter-change` reports, so one field filtered from either
menu reaches the data layer identically. One pick is `eq`; several become `in`,
because `eq` against a list can never match.

**A TYPED answer is a filter, so a chip switches on without a tick.** Deriving
`data-current` from ticked rows alone left "Starts with Go" showing as an OFF
chip that filtered nothing. THREE places derived it, and the last one found was
the toolbar's own commit path: the chip set itself ON and the bar set it back
OFF in the same Apply, which a mutation trace caught and reading the code did
not. Anywhere `data-current` is derived has to ask for the typed answer too — the condition never reached the query, because the
bar reported `values` and a typed answer is not in there. Three things had to
agree: the chip's own on-state, the bar relaying `condition-change`, and the
view reading `clauses` in place of re-deriving them from `values`.

**The BADGE marks the condition, the caret keeps the value.** A prefix ate the
caret's width — "Does not equal: Gold" truncates where "Gold" would not — so
the mark goes in the count badge instead. The condition menu shows the WORD
only (`OP_LABELS` in `store.ts`); there is no per-operator sign. `eq` is the
default, so it gets no mark: a mark on every ordinary chip is noise.

A badge shows a COUNT when several values are picked — the count is the thing a
reader cannot get elsewhere, since the caret already shows the value. And a
sign announces as nothing, so the badge's `aria-label` carries the WORD.
Writing it is ordered AFTER `#syncCountTip`, which owns the count's own label
and would otherwise wipe it.

- Site: `src/core/data/store.ts`
- Site: `src/components/sherpa-quick-filter-toolbar/sherpa-quick-filter-toolbar.ts`
- Site: `test/e2e/reforged-data-grid.spec.ts`
- Site: `test/e2e/reforged-filter-conditions.spec.ts`
- Site: `src/components/sherpa-menu/sherpa-menu.ts`
- Site: `src/components/sherpa-menu/sherpa-menu.css`
- Site: `src/components/sherpa-menu/sherpa-menu.html`
- Site: `src/components/sherpa-quick-filter/sherpa-quick-filter.ts`
- Site: `src/core/ui/filter-menu.ts`
### T-native-change-stops-at-the-host

A native `change` is **NOT COMPOSED**: it stops at `sherpa-menu`, the shadow
host its rows are slotted into, and never reaches the toolbar that stamped
them. So the menu re-emits it as `menu-change`, and every value shape has to be
recognised HERE.

A NUMBER body is not slotted: it lives in the menu's OWN shadow root
(`T-a-menu-owns-its-own-bodies`), so a host listener hears none of it. The
field's native change stops at the shadow root; the slider's composed change
arrives retargeted to the menu itself. So the menu listens on `.body-number`,
reports it as `menu-change`, and hands the field's change on to the host's
tree, as a row's would. When the body moved inside on 2026-09-25 this broke
silently (TODO 104): the chip HELD a typed or dragged value and sent nothing,
and the test that read the value stayed green. A test of a report watches the
EVENT.

The bar and the panel read a number body as `menu.reading`, and the panel takes
a dragged handle once, when it is let go — as a bar chip does.

The same non-composed `change` is why select-all is handled in the menu
(`T-select-all-ticks-boxes-not-values`), and why `sherpa-switch` re-dispatches
its own as composed (`T-range-switch-swaps-not-rebuilds`).

- Site: `src/components/sherpa-menu/sherpa-menu.ts`
- Site: `test/e2e/reforged-number-filter-reports.spec.ts`

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
- Site: `src/components/sherpa-menu/sherpa-menu.ts`
### T-value-label-is-the-callers-words

`valueLabel` is the text shown in the CARET button — the chip's PICKED VALUE.

Public for a host that draws a value the chip cannot derive. The chip writes
its own for every answer it holds — a date's days too, which were once the
toolbar's to format (`T-a-chip-says-its-own-answer`).

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

A LOCKED chip's menu is **not a list of ITS values** — a data grid's column
chip holds the grid's condition, which the grid owns. Nothing in there may
re-point its label, its badge or its on/off state.

It still RELAYS `quick-filter-change`, because the toolbar is listening for
exactly that. And a body click still emits `quick-filter-click` without
flipping `data-current` — the state is the host's to set, so a host that wants
the click can act on it (opening the menu, say) without the chip having guessed
first.

This is the `data-locked` half of the state-ownership rule: `data-<thing>` in,
`<thing>-change` out, and `data-locked` when the host owns the value.

- Site: `src/components/sherpa-quick-filter/sherpa-quick-filter.ts`
- Site: `src/components/sherpa-quick-filter-toolbar/sherpa-quick-filter-toolbar.ts`
- Site: `test/e2e/reforged-quick-filter-toolbar.spec.ts`

**A PERSISTENT chip is a locked chip.** "Always on, and its body does not flip
it" — the toolbar's own words at its `data-persistent` site — is exactly what
`data-locked` means. Until 2026-09-23 the toolbar set only `data-persistent`,
so the chip flipped itself off and the toolbar wrote it back on the next line:
*"A persistent chip has ALREADY flipped itself off by now, so put it back."*

Measured with a real mouse click on a persistent chip with no menu: **two
`data-current` writes for one click**. With `data-locked` set alongside:
**zero**, and the chip stays current. One owner, as the convention says.

`data-persistent` still earns its place — it says the chip stays on the bar when
off, which is a different fact from who owns its state.

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
  is not a list of its values: a data grid's column-filter menu holds a
  condition and a typed value. Either
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

Both sets are written, and the reason is **not** the one this trap used to
give. It said the calendar's own CSS still reads the flags for those two grids.
Measured 2026-09-23: it reads **none** of them. `data-state` is the only paint
source anywhere, exactly as the heading says.

The flags stay because they are a **query surface**, which is a different job.
Eight assertions in `reforged-calendar.spec.ts` use them to count what the grid
drew, and each one is a single selector where `data-state` needs the values
OR'd:

```
[data-in-range]                                  one selector
[data-state="range-mid"], [data-state="range-start"], …   three
```

So: `data-state` PAINTS, the flags are read by TESTS, and no CSS reads the
flags. A flag that renders nothing is not automatically dead — check `test/`
and `../Sherpa Demos/app/` before removing one. Removing `.label` from `sherpa-tabs`
earlier in this same audit failed for exactly that reason.

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
| `OUTLINE = 0.5` | 1px on a 200px chart, ALIGNED INSIDE as in Figma. SVG has no inside stroke, so the path is drawn half a stroke in from the true band edges — the same trick `sherpa-radial-chart` uses |
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
- Site: `src/core/data/format-tick.ts`

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
- Site: `src/components/sherpa-switch/sherpa-switch.ts`
- Site: `src/components/sherpa-select-radio/sherpa-select-radio.ts`
- Site: `src/components/sherpa-select-checkbox/sherpa-select-checkbox.ts`
- Site: `src/core/ui/form-value.ts`

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

**What real code does instead**, from `../Sherpa Demos/app/contexts/chat.js`:

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

- Site: `src/core/ui/apply-state.ts`

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

- Site: `src/core/ui/apply-state.ts`
- Site: `src/core/ui/apply-state.ts`
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

- Site: `src/core/ui/apply-state.ts`

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

- Site: `src/core/ui/apply-state.ts`

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

- Site: `src/core/browser/persist-view.ts`
- Site: `test/unit/headless-data-layer.test.mjs`

### T-saved-markup-is-untrusted-input

**A saved view's content is MARKUP, and it is PARSED, never assigned.**

The format question answered itself: every authored screen in this repo is
already an HTML template dropped into `sherpa-app-shell`
(`../Sherpa Demos/app/templates/*.html`, four of them, none calling `renderView`). A saved
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

- Site: `src/core/browser/view-markup.ts`
- Site: `src/core/browser/persist-view.ts`
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

- Site: `src/core/data/live-stores.ts`

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

- Site: `src/core/data/live-stores.ts`

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

- Site: `src/core/data/live-stores.ts`

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

- Site: `src/core/data/live-stores.ts`

### T-narrowing-constructor-is-not-useless

`EventStore` and `SocketStore` each declare a constructor whose whole body is
`super(options)`, with an eslint disable for `no-useless-constructor`. **It is not
useless.** Without it the class inherits `LiveStore`'s signature and would accept a
bare `LiveStoreOptions` — so a caller could construct one with none of the fields
that make it that kind of store, and TypeScript would allow it. The only job is
NARROWING the parameter type.

Delete either one and the type error moves from the call site to nowhere.

- Site: `src/core/data/live-stores.ts`

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

- Site: `src/core/data/live-stores.ts`

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

- Site: `src/core/data/validate.ts`

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

- Site: `src/core/data/validate.ts`

### T-email-check-is-deliberately-loose

The `email()` rule is `something@something.something` and nothing stricter.

A stricter regex rejects addresses that are real — RFC 5322 allows quoted strings
and comments — and the only way to know an address works is to send to it. This
catches typing a name into the email box, which is what a client-side check is
for.

`url()` takes the same line from the other end: it uses `URL.canParse`, the
platform's own parser, so there is no regex to get wrong.

- Site: `src/core/data/validate.ts`

### T-one-function-places-label-and-gridline

Both the axis label and its gridline are placed with `tickPercent(index, steps)`,
on the same box, so they cannot disagree.

Two separate calculations is exactly how the previous versions drifted: the
gridlines drew N−1 interior lines while the axis laid out N+1 flex boundaries.

`formatTick` is shared for the same reason — the barchart and the line chart cannot
format the same number two different ways.

- Site: `src/core/data/format-tick.ts`

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

- Site: `src/core/data/format-tick.ts`

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

- Site: `src/core/data/format-tick.ts`

### T-series-count-is-ten-not-eleven

`SERIES_COUNT` is **10** — ten sequences of ten steps, with `series/1..10` reading
one step each, since the Data Viz collection was rebuilt (2026-09-15).

It was **eleven**, and the wrap lived as a bare `% 11` in four separate components
— so a change to the palette silently left charts asking for a variable that no
longer existed. An undefined custom property paints NOTHING at all, with no error,
which is why the wrap is one exported constant and both `seriesVar` and
`seriesBorderVar` go through it. An eleventh series reuses the first hue.

**ZERO was the hole the constant did not close.** The wrap guarded a number
too BIG and not one too small, so `colorIndex: 0` asked for
`--sherpa-data-viz-series-0` — the same undefined property, the same silent
nothing, reached from the other end. `seriesSlot` wraps from either direction
now: 0 is slot 10 exactly as 11 is slot 1, because the sequence is a ring.
A fraction truncates and a non-number is slot 1, so there is no input that
paints nothing.

`seriesBorderVar` falls back to the series fill, and the collection's `border`
aliases to colour 5 of whichever sequence is active: a mark's FILL moves along its
ramp, its BORDER does not. The border is the series' identity, so it stays put
whatever the fill is doing — and it is what keeps a translucent mark legible on any
surface.

- Site: `src/core/data/chart-datum.ts`
- Site: `src/core/data/format-tick.ts`
- Site: `test/unit/format-tick.test.mjs`

### T-one-total-for-the-ring-and-the-label

THREE sums lived across two components and disagreed about what counts.

A donut's RING clamped negatives to zero; its own CENTRE LABEL did not. Three
slices of 10, −5 and 20 drew a total of 30 under a label reading 25. A chart
legend's roll-up had a third rule again.

`datumTotal(data, { clamp })` is the one answer, in `chart-datum.ts` beside the
shape it sums. `clamp` has NO DEFAULT, because the two questions are genuinely
different and both are right:

| caller | clamp | why |
|---|---|---|
| a ring, a bar height | `true` | a negative arc is not a shape |
| a printed total | `false` | −5 is what the data says |

`datumValue` is the coercion underneath: a legend widens `value` to
`string | number`, so a numeric string counts and anything else is 0 rather
than a NaN that poisons the sum.

- Site: `src/components/sherpa-chart-legend/sherpa-chart-legend.ts`
- Site: `src/components/sherpa-radial-chart/sherpa-radial-chart.ts`
- Site: `src/core/data/chart-datum.ts`
- Site: `src/data.ts`
- Site: `test/unit/chart-datum.test.mjs`

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

- Site: `src/core/data/chart-datum.ts`

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

- Site: `src/core/data/chart-datum.ts`

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

- Site: `src/core/data/stores.ts`
- Site: `src/core/data/base-store.ts`

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

- Site: `src/core/data/stores.ts`
- Site: `src/core/data/base-store.ts`
- Site: `src/core/browser/idb-store.ts`

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

- Site: `src/core/data/stores.ts`
- Site: `src/core/data/base-store.ts`

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

- Site: `src/core/data/stores.ts`

### T-numeric-keys-compare-as-strings

A key arrives as a string far more often than not — from an attribute, a URL, a
`data-id`. `'7' === 7` is false and would report a row as MISSING, so `sameKey`
compares numbers and numeric strings as equal by stringifying both. Everything else
is strict, and `null`/`undefined` never match anything.

Every `findIndex`/`find` over the key field goes through it, so no two stores
can disagree about whether a row exists. That was a claim before it was a fact:
`stores.ts` and `idb-store.ts` each carried a byte-identical private copy. It
lives in `store.ts` now, beside `looseEqual` and `valueSet`.

It is NOT `looseEqual`, deliberately: a key is case-SENSITIVE, because two rows
keyed `Ada` and `ada` are two rows, while values compare case-insensitively
(`T-one-comparison-rule-for-query-and-ui`). Two rules, side by side, neither
calling the other.

- Site: `src/core/browser/idb-store.ts`
- Site: `src/core/data/store.ts`
- Site: `src/core/data/stores.ts`
- Site: `test/unit/value-types.test.mjs`

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

- Site: `src/core/data/stores.ts`

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

- Site: `src/core/data/stores.ts`

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

- Site: `src/core/data/stores.ts`

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

- Site: `src/core/browser/idb-store.ts`
- Site: `test/e2e/reforged-idb-store.spec.ts`
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

- Site: `src/core/browser/idb-store.ts`

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

- Site: `src/core/browser/idb-store.ts`

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

- Site: `src/core/browser/idb-store.ts`

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

- Site: `src/core/browser/idb-store.ts`
- Site: `test/e2e/reforged-idb-store.spec.ts`

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

- Site: `src/core/browser/view-sync.ts`
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

- Site: `src/core/browser/view-sync.ts`

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

- Site: `src/core/browser/session.ts`

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
understand is DROPPED rather than half-applied — and the unreadable key is
forgotten, so the next write starts clean.

That took a `guard`. Until it existed this paragraph was a claim the code did
not keep: `persist` caught a JSON PARSE error and nothing else, so a value that
parsed into the WRONG SHAPE was restored in full. A boolean survives that gap.
A list of `{view,label}` rows re-shaped between releases does not — it reaches
the nav rail as rows with no label. `guard` is optional, and without one the old
behaviour stands: any parsed value is restored.

This exists because the alternative is what every app was writing: a key constant, a
try/catch to read, a try/catch to write, and a wrapper to keep the two in step. Four
pieces to get right per preference, and the examples were teaching it.

- Site: `src/core/browser/session.ts`
- Site: `test/unit/session-list.test.mjs`

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

- Site: `src/core/ui/shared-constants.ts`

### T-non-value-rows-is-one-selector

`NON_VALUE_ROWS` is `'.qf-all'` — the rows in a filter menu that are NOT values.
Select all is a control OVER the set: counted in, it reports its own "on" as a
picked value, and the badge reads one too high with everything ticked.

ONE DEFINITION because the readers had DRIFTED: `sherpa-menu` excluded two row
shapes while the toolbar and quick-filter excluded one. The second, `.qf-toggle`
— a folded on/off chip's tick — went on 2026-09-25, when a folded chip became a
row with a caret (`T-a-row-opens-its-child-menu`).

- Site: `src/core/ui/shared-constants.ts`

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

- Site: `src/core/data/pointer.ts`

### T-pointer-escape-decode-order

RFC 6901 escapes: `~1` is `/` and `~0` is `~`.

**ORDER MATTERS — `~1` first, then `~0`.** Reversed, a literal `~1` in a key would
decode to `~` and then to `/`, which is a different key.

- Site: `src/core/data/pointer.ts`

### T-pointer-overlap-is-both-directions

`pointersOverlap` is **TRUE EITHER WAY ROUND**, which is the whole subtlety.

A subscriber on `/theme` must hear a write to `/theme/mode` — its branch changed.
A subscriber on `/theme/mode` must hear a write to `/theme` — its value may have
been replaced wholesale. **Checking one direction only leaves half the subscribers
stale.**

That is also why a pointer beats a flat key wherever one value has many readers — a
view definition's `$state` bindings, the session store's subscriptions: a subscriber
can watch a BRANCH and hear about anything beneath it.

- Site: `src/core/data/pointer.ts`

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
- Site: `src/components/sherpa-filter-panel/sherpa-filter-panel.ts`
- Site: `test/e2e/reforged-filter-panel-component.spec.ts`

### T-group-and-sort-are-component-scope

`organise({ group, sort })` REFUSES on a `data-type="view"` toolbar: it sets an
empty organise set and draws nothing.

Group and Sort are not filters, and they have no view-level meaning. A view
holds a POPULATION; "sorted by name" is a property of a table, not of a
population. Two components inside one view sort differently and are both right,
so a view-level Sort chip would have to pick one component to obey and silently
ignore the rest.

The header toolbar was already correct BY OMISSION — no caller ever passed it an
organise set — which is not the same as being correct BY RULE. The guard makes a
future caller's mistake visible as nothing drawn, rather than as a chip that
steers one arbitrary component.

- Site: `src/components/sherpa-quick-filter-toolbar/sherpa-quick-filter-toolbar.ts`
- Site: `src/components/sherpa-filter-panel/sherpa-filter-panel.ts`
- Site: `test/e2e/reforged-filter-panel-component.spec.ts`
- Site: `src/core/data/data-source.ts`

### T-a-bar-offers-only-what-its-scope-holds

A toolbar's ADD chip offers what `available([...])` gave it, and NOTHING when
nobody called it. The button is then disabled — correct behaviour, and an
invisible bug when the omission was accidental.

`sherpa-app-header.populate()` accepted `filters` but had no way to pass an
available list, so the header's Add button was permanently disabled: the reader
could add filters to the grid and never to the view. `populate({ available })`
and `header.available([...])` close that, and the list is applied AFTER the
chips so the menu is built over the bar it will add to.

The two scopes must not offer the same field twice, and a field already on
either bar is never offered again — `offerable()` in `src/core/data/filter-scope.ts`
is the DOM-free rule; the caller supplies the two held-id lists.

- Site: `src/components/sherpa-app-header/sherpa-app-header.ts`
- Site: `src/core/data/data-source.ts`

### T-a-superseded-chip-suspends-it-is-never-removed

When the VIEW takes a field the component bar already held, the component chip
goes `data-superseded`: greyed, not clickable, and STILL THERE. It is never
removed.

Removing it throws away what the reader picked. This is the same rule as
suspend-vs-clear everywhere else in the system: "off" keeps the value, "gone"
deletes it. Collapsing the two has already cost a user their typed filter once.

Three parts make it work:

- `values` SKIPS a superseded chip, so it stops narrowing on top of the view
- `pickedValues` still reports it, so the pick survives the whole round trip
- `supersede([...ids])` takes the WHOLE view field list each time, so a chip not
  named is restored — which makes the call idempotent and means a host can send
  the list after every change without tracking what it sent last

**A bar's Reset leaves it alone** (`clearAll`). It emptied every chip, so a
chip the View held lost the value it showed and read "off" while the View
went on filtering. Will, TODO 167.

- Site: `src/components/sherpa-quick-filter-toolbar/sherpa-quick-filter-toolbar.ts`
- Site: `src/components/sherpa-quick-filter/sherpa-quick-filter.ts`
- Site: `src/components/sherpa-quick-filter/sherpa-quick-filter.css`
- Site: `src/core/data/data-source.ts`
- Site: `test/e2e/reforged-quick-filter-toolbar.spec.ts`

### T-a-ruled-out-value-is-greyed

**A value the other filters rule out stays in its list, greyed out, and
cannot be picked** — Will, TODO 174, choosing 110's B. A value already picked
stays ticked, greyed, and free to untick — set aside and not applied
(`T-a-later-answer-sets-an-earlier-pick-aside`). Only while the source's
`limitOptions` is on (Settings › Application, off by default); off, nothing
is limited.

**The SOURCE says what is left** — `source.present(scope)`: each list field's
values the rows still hold under the OTHER answers in its scope, and a
component scope's within the View's (the trickle down). A field's own answer
never limits it, so Customer limits Region and Region limits Customer. It
compiles the applied Query without that field's reading, so suspended
answers, presets and "the View wins" behave as they do for rows. One pass per
distinct limiting filter, once per applied Query; a store with `distinct()`
is asked instead of read row by row.

**Each control is TOLD** — `drawPresent(present, scope)` on a bound bar, panel
or grid — and passes it to `menu.present`, which greys and disables the rows
(silently, no event); a panel's run of value chips gets `data-unavailable`.
Select all never ticks a ruled-out row. A grid heading used to mark values
"available" from the PAGE it was given; one page cannot say what the source
holds, so that is gone.

**A chart LEGEND too** — Will, TODO 179: a legend picks through
`bindSelection`, not a bound scope, so the source ANNOUNCES each pass
(`present`, by scope — a chart's own scope included) and the provider hands
its legend the field's list. A ruled-out legend row is inactive, says why in
its `title`, and refuses a press, as its chip does in the panel.

**It says why** — Will, TODO 176: a ruled-out chip's tooltip and a row's
`aria-description` — and a menu row's `title`, on hover — read "Limited by your
other filters: no matches." A disabled
chip says "Not available here." A chip the View took says where it went
(`T-an-inactive-chip-says-where-its-filter-went`).

- Site: `src/core/data/data-source.ts`
- Site: `src/core/data/store.ts`
- Site: `src/core/ui/shared-constants.ts`
- Site: `src/components/sherpa-menu/sherpa-menu.ts`
- Site: `src/components/sherpa-quick-filter-toolbar/sherpa-quick-filter-toolbar.ts`
- Site: `src/components/sherpa-filter-panel/sherpa-filter-panel.ts`
- Site: `src/components/sherpa-data-grid/sherpa-data-grid.ts`
- Site: `src/components/sherpa-quick-filter/sherpa-quick-filter.ts`
- Site: `src/components/sherpa-quick-filter/sherpa-quick-filter.html`
- Site: `src/components/sherpa-provider/sherpa-provider.ts`
- Site: `test/unit/present-limits-each-field.test.mjs`
- Site: `src/components/sherpa-chart-legend/sherpa-chart-legend.ts`

### T-an-and-row-offers-what-the-rows-before-it-leave

**In Advanced rows, AND is serial and OR is parallel** — Will, TODO 110:
*"AND row options should be restricted by preceding conditional row
conditions."* He chose B: a value the rows before it rule out is listed,
greyed and refused (a disabled `<option>`), saying "No matches with the rows
above." — never the row's own pick. AND binds tighter than OR, so a row looks
back only as far as the last OR; an OR row offers every value.

**No data is asked for.** Every row is on the SAME field, so what the rows
before leave is the field's own values that pass them — `rowOffer()`, DOM-free
in `filter-state.ts`, run against a one-field row with the store's own
`matchesFilter`. The menu re-offers on every row change.

- Site: `src/core/data/filter-state.ts`
- Site: `src/components/sherpa-menu/sherpa-menu.ts`
- Site: `src/components/sherpa-input-text/sherpa-input-text.ts`
- Site: `test/unit/filter-state.test.mjs`
- Site: `test/e2e/reforged-filter-conditions.spec.ts`

### T-a-later-answer-sets-an-earlier-pick-aside

**A later answer wins** — Will, TODO 180: *"Customer A is selected but made
unviable by Region C being activated … possible if Customer B makes Region C
viable again."* Customer A and B are picked; B makes Region C viable; the
reader picks C; A has no C rows. A is SET ASIDE: it stays in the reading (a
saved View, a draft and the URL keep it), it leaves the compiled filter, and
it is drawn greyed — still ticked, free to untick. B stays in force. Let C go
and A is back.

**Newest first, so it settles.** The source keeps the order fields CHANGED in
(`#recency`). Newest first, each list field keeps the picks the rows still
hold under the answers after it; the rest are set aside, and the next older
field is limited by what was kept. The View first, then each component scope
under the View's kept answers. It depends only on the readings, that order and
the rows — never on what was set aside before — so a second pass gives the
same answer and nothing loops: when it MOVES, the source compiles again
(`CompileFacts.drop`) and the load that follows draws the rest.

Only Simple list answers can be set aside; a range, a date or Advanced rows
stay whole and limit the older fields as they are. Only while `limitOptions`
is on.

A chip whose every pick is set aside is greyed too, and says "Limited by your other
filters: not applied." Off and ruled out, a value chip is refused;
on, it may be let go. A chip with a menu always opens it.

- Site: `src/core/data/data-source.ts`
- Site: `src/core/data/query.ts`
- Site: `src/core/ui/shared-constants.ts`
- Site: `test/unit/present-limits-each-field.test.mjs`

### T-unavailable-value-sorts-below-a-divider

`QuickFilterOption.available: false` means still SELECTABLE, but no row carries
it under the filters ALREADY applied — so ticking it changes nothing visible.
Absent means available.

Such a value is still LISTED rather than DROPPED, for two reasons:

- a value that VANISHES reads as a bug in the list
- a user cannot broaden a filter back out through a list that hid the way —
  dropping the unreachable values makes the current filter a one-way door

**It is never re-sorted.** Until 2026-09-22 an unavailable value was dimmed
and re-sorted below a divider. Will's ruling: "Absolutely unnecessary. The
checkboxes communicate all of that." One list, the caller's order. The rule
this trap exists for is DO NOT DROP. Since TODO 174 (Will chose 110's B), a
value the other filters rule out IS drawn greyed and refused, in its place —
only while "limit options" is on, and never one the reader picked:
`T-a-ruled-out-value-is-greyed`.

**A COLUMN heading's menu follows the same rule**, and could not at first: it
built its list from `this.#rows`, which is the PAGE the grid was handed. Filter
on another field and three of four owners vanished from the Owner menu. Only
the host knows the whole column, so it hands it over in `data-column-values`.

The WHOLE column comes from the data layer: the grid asks for each column's
filter (`DataAsk.filters`), whose options are the field's whole list
(`T-a-heading-opens-the-chips-menu`). `data-column-values` stays for a host
with no provider.

- Site: `src/components/sherpa-data-grid/sherpa-data-grid.html`
- Site: `src/components/sherpa-menu/sherpa-menu.ts`
- Site: `test/e2e/reforged-provider.spec.ts`
- Site: `test/e2e/reforged-filter-conditions.spec.ts`
- Site: `test/unit/filter-state.test.mjs`
- Site: `src/core/data/filter-state.ts`
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

- Site: `src/core/ui/filter-menu.ts`
- Site: `src/components/sherpa-menu/sherpa-menu.ts`
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

### T-favourite-star-swaps-its-glyph

The favourite STAR's `data-favourite` attribute is the state and CSS paints from
it — but the GLYPH swaps too, outline → solid.

That is not decoration: the state has to survive for **anyone who cannot tell the
brand purple from the default ink**, so colour alone cannot carry it.
`aria-pressed` carries the same fact to a screen reader, which is why the star is
a TOGGLE button rather than a plain one.

For three months it swapped NOTHING. The two states were written as
`fa-solid fa-star` and `fa-regular fa-star`, and `iconName()` strips `solid`
and `regular` as weight tokens before resolving — so both spellings resolved to
the one `star` drawing. The attribute changed on every click and the path never
did. The icons are Figma's, and the set holds `star` AND `star-filled` as two
separate drawings, so the fix is to NAME them:

```ts
btn.setAttribute('data-icon-start', on ? 'star-filled' : 'star');
```

A test that reads `data-icon-start` cannot catch this. The test reads the
rendered `<path d>`.

- Site: `src/components/sherpa-quick-filter-toolbar/sherpa-quick-filter-toolbar.ts`
- Site: `test/e2e/reforged-quick-filter-toolbar.spec.ts`
- Test: `test/e2e/reforged-nav-favorites-recents.spec.ts`

### T-the-star-reports-it-does-not-decide

The ★ used to DERIVE its own on/off — it read its own `data-favourite`, flipped
it, and painted. That is right only while the toolbar is the sole owner of the
favourites list, and it never is: a favourite is a row in the nav rail, saved
across sessions, and a reader can remove it from the rail with the toolbar
nowhere near.

`data-favourite` was also **not observed**, so a host that set it got no
repaint. The attribute looked like an input and behaved like an output, which
is what hid the first half.

So the split is the standard one:

| | |
|---|---|
| `data-favourite` | the value, IN — observed, and `#syncFavouriteFromAttr` paints it |
| `view-favorite` | the INTENT, out — a request, not a notification |
| `data-locked` | the host owns the list; the bar reports and never self-sets |

Unlocked, the bar still flips its own attribute, so a page with no favourites
list keeps working exactly as before.

- Site: `src/components/sherpa-quick-filter-toolbar/sherpa-quick-filter-toolbar.ts`
- See also: `T-session-list-is-a-view-not-a-copy` — where the list itself lives

### T-an-expandable-row-is-not-a-destination

A nav row with children GROUPS them. It is not a page.

The whole row toggles — not only the chevron. Clicking the body used to
navigate, so `Favorites` and `Recent` would have opened a view if either had
ever carried an `href`, and the two behaviours sat a few pixels apart on the
same row.

An expandable row also drops its `href` even when one is configured. A row
rendered as `<a href>` that goes nowhere lies to a middle-click, to "open in
new tab", and to a screen reader reading out a link.

This is a component rule, not a config convention, because a config can always
be written wrong: a row GAINS children at runtime (Favorites does, on the first
★) and must stop being a link at the same moment.

- Site: `src/components/sherpa-nav-item/sherpa-nav-item.ts`

### T-session-list-is-a-view-not-a-copy

`session.list(pointer)` returns a VIEW over the stored array, not a copy of it.
Nothing is cached: `all` reads the pointer every time and hands back a fresh
copy, and every write goes through `SessionStore.set`, so subscribers fire and
a persisted pointer reaches storage.

That matters because the obvious alternative — hold the array, mutate it, write
it back — silently loses whatever another writer did in between, and never
notifies anyone.

`all` returning a COPY is the other half. A caller that pushes onto it changes
nothing, which is what you want: the list is edited through `add` / `remove` /
`toggle` or not at all.

Three options carry the difference between a Favourites rail and a Recents one:

| | |
|---|---|
| `by` | the field that IDENTIFIES an entry, so a re-add replaces rather than doubles |
| `max` | keep at most N — the OLDEST end is trimmed, whichever end that is |
| `front` | newest FIRST (Recents). Default false — newest last |

Recents is `{ by: 'view', max: 5, front: true }`. Favourites is `{ by: 'view' }`.
Same class.

Without `by`, identity is deep equality by `JSON.stringify` — right for a stored
entry, which is plain JSON by definition, and wrong for anything holding a
function or a Date.

- Site: `src/core/browser/session.ts`
- Site: `test/unit/session-list.test.mjs`
- Test: `test/unit/session-list.test.mjs`

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
- Site: `src/components/sherpa-data-grid/sherpa-data-grid.html`
### T-grid-collapsed-group-is-one-slot

**A SHUT group is ONE line on screen, so it costs ONE slot of the page.**

A page of 25 used to fill with 25 RECORDS. Group by tier, shut Gold, and the
reader got a panel holding one heading and twenty-four hidden rows — a page that
looks empty, with a pager insisting there are ten more like it. The rows were
there; CSS was hiding them; the count had already been spent.

So the grid cuts the page itself:

| | costs |
|---|---|
| a row | 1 |
| an open group's heading | nothing |
| a shut group | 1 — the heading, and nothing for its rows |

**A page is `data-page-size` ROWS, grouped or not** — Will, TODO 152: "Data
grid pages don't respect the row count value set in the pagination." The
first cut counted every heading as a line, so a page of 25 held 24 or 23 rows
and a grouped view had one page more than the same rows ungrouped. With every
group open, the pages now match the ungrouped ones.

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

- Site: `src/core/data/data-source.ts`
- Site: `test/e2e/reforged-data-source.spec.ts`

### T-grouped-paging-belongs-to-the-view

**STORE paging and VISUAL paging are not the same thing**, and a grouped view is
where they come apart.

`skip`/`take` counts RECORDS. A grouped page counts what is ON SCREEN — a
row, or a shut group as one — and which groups are shut is a fact that lives in
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

- Site: `src/core/data/data-source.ts`

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

- Site: `src/core/ui/sherpa-element.ts`

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

- Site: `src/core/ui/sherpa-element.ts`

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

- Site: `src/core/browser/persist-view.ts`

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

- Site: `src/core/browser/persist-view.ts`

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

- Site: `src/core/browser/persist-view.ts`

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

- Site: `src/core/browser/persist-view.ts`

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

- Site: `src/core/data/data-source.ts`

### T-result-is-the-hosts-half

`rows`/`total` are what a COMPONENT needs. `result` is for a HOST: a schema's
`dropped` and `issues` are only readable here (`T-dropped-rows-must-be-countable`
is why they exist at all).

It returns a COPY of the container, so a caller cannot steer the source by
writing to the object it was handed.

- Site: `src/core/data/data-source.ts`

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

**A category left out is a chart drawn from FEWER rows**, never a `display:
none` on the drawn `<g>` / bar / slice. Since 2026-09-29 (the API audit, A3)
the charts have no hide doors at all — `setBarHidden`, `setSeriesHidden`,
`setSliceHidden` and their getters are gone, and every provider push cleared
them anyway. A legend's pick narrows ITS chart through the provider, which
hands the chart the rows that are left.

The scale is derived from the rows it is GIVEN, so the three charts say it in
their own terms:

- **line chart** — the y-extent covers the series drawn, so leaving one out
  re-scales the axis.
- **barchart** — the y-max comes from the bars it is given, so the rest use the
  full height; with no bars, no axis.
- **donut** — the total covers the slices it is given, so the ring always
  CLOSES. A donut reads as parts OF A WHOLE; a hole where a slice used to be
  would misreport the rest.

A mark's COLOUR comes from its `colorIndex` — the category's slot in the
declared order — never its position, so leaving one out never shifts another's
hue (`T-a-category-keeps-its-colour`).

- Site: `src/components/sherpa-line-chart/sherpa-line-chart.ts`
- Site: `src/components/sherpa-barchart/sherpa-barchart.ts`
- Site: `src/components/sherpa-radial-chart/sherpa-radial-chart.ts`
- Site: `test/e2e/reforged-line-chart.spec.ts`
- Site: `test/e2e/reforged-radial-chart.spec.ts`

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

- Site: `src/components/sherpa-sparkline/sherpa-sparkline.ts`
- Site: `src/core/ui/chart-parts.ts`

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

- Site: `src/core/ui/chart-parts.ts`

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

`sherpa-radial-chart`'s `RadialSlice` is the third alias and is deliberately NOT
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
- Site: `src/components/sherpa-metric/sherpa-metric.css`

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

- Site: `src/components/sherpa-radial-chart/sherpa-radial-chart.ts`

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

**Both footer controls are `inert`.** The CARD is the control — the host has
the role, the tab stop and `aria-checked` — so a live radio inside it is a
control nested in a control, and an unnamed one. They only SHOW the state; a
press on one falls through to the card. TODO 117.

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

**The checkbox and the radio differ in border WIDTH, not colour.** They look
like one control, so the natural move is one rule. Figma binds them apart:

| | stroke colour | stroke width |
|---|---|---|
| `Checkbox (Atom)` | `style-border/base +1` | `border/width/sm` · **0.5px** |
| `Radio (Atom)` | `style-border/base` | `border/width/base` · 1px |

The NAME is history. Until 2026-09-24 `style-border/base` resolved to the pale
`border/default/+1` (#e8e8f6). Since the Style tier was synced by variable id,
`base` and `+1` both resolve to `border/default/+2` (#b3b3c3) — in live Figma
and in `tokens.css` alike. So bind the Style name Figma binds, and never pick a
Theme step from a comment: a comment about a token is not a reading of it.

The width changes the geometry inside it. The checked indicator is inset 2px
and must land at 14 on a 20 box; `inset` measures from the PADDING box, so it is
immune — but arithmetic from the content box would draw 15 at a 0.5px border.

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
- Site: `src/components/sherpa-data-grid/sherpa-data-grid.html`
- Site: `test/e2e/reforged-filter-conditions.spec.ts`

### T-every-element-in-the-template

Every element a component will EVER show exists in its `.html` from the start.
CSS reveals and hides; JS never calls `createElement()` and never writes
structural `innerHTML`.

Two shapes that swap — the plain checkbox and the advanced one, a number
filter's single value and its range, a condition menu's value rows and its text
box — are BOTH stamped, and one selector decides which is seen. Rebuilding the
body on each flip throws away whatever the reader put into the half that was
not showing: a ticked row, a typed fragment, a half-entered range.

It is also why `data-advanced` and friends can be flipped at any time with no
re-render: there is nothing to build, only a rule to match.

The exception is REPEATING data, which cannot be known in advance. That is a
cloning prototype — `<template class="row-tpl">` with no `id`, so
SherpaElement's multi-template parser leaves it alone.

- Site: `src/components/sherpa-data-grid/sherpa-data-grid.html`

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

- Site: `src/core/ui/sherpa-element.ts`

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
- Site: `src/components/sherpa-select-radio/sherpa-select-radio.ts`
- Site: `test/e2e/reforged-form-controls.spec.ts`

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

- Site: `src/core/browser/persist-view.ts`
- Site: `src/components/sherpa-provider/sherpa-provider.ts`

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

**Since provider P3b the chip's DEFINITION says it** — `field` names the field
it answers (the Date chip, the record's time), and `field: null` says it
answers none here. The bar reports its answers BY FIELD and skips a persistent
selector, so it reaches the Query with no page mapping at all.

- Site: `src/components/sherpa-quick-filter-toolbar/sherpa-quick-filter-toolbar.ts`

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

### T-a-menu-with-no-trigger-lands-at-the-origin

`#place()` measures the TRIGGER, because CSS anchoring cannot cross a shadow
root (`T-anchor-cross-root`). With no trigger it returns early, and the card
keeps `left: 0; top: 0` — the top-left of the viewport, over whatever is there.

It is silent. The card opens, it is readable, and every row works; it is simply
in the wrong place. Measured: `show()` with no argument left the card at
`["0px","0px"]` and it never moved, at +0ms through +2500ms. Not a race — there
was nothing to measure.

`show(trigger)` is the normal path, and a click always has one. The gap is
`open = true`, which calls `show()` bare, and any caller that forgets. The menu
now falls back to the nearest drawn box: the element it is slotted into, else
its own parent. `#trigger` is cleared on close, so the fallback is recomputed
per open and never outlives the trigger that replaced it.

- Site: `src/components/sherpa-menu/sherpa-menu.ts`
- Site: `test/e2e/reforged-menu.spec.ts`

### T-the-grid-is-two-grids

The rule was "the 8px grid, with a 4px sub-grid for text". Measured 2026-09-24
against every `space-*` and `size-*` value in all three density modes, that is
not what the tokens do:

| scale | off 4px | off 8px |
|---|---|---|
| space / size, all 3 modes | **none** | 4, 12, 20, 28, 36 |
| font (icons alias it) | 10, 14, 30, 42 | — (it is a 2px scale) |

So spacing is a **4px** scale — 8px is only its even half — and text is a
separate **2px** scale. Two grids, not one grid with a sub-grid, and neither is
8px.

The old lint rule was `v % 2 === 0`, which passed everything either scale can
produce and so reported zero off-grid literals for months. Tightening it to the
real grids surfaced 52 sites; 24 were icon boxes judged against the wrong grid,
26 were `space-3xs`, a real 2px token, and **2** were genuine drawn geometry.

Three things follow, and each is a way to get this wrong:

- **An icon is sized from the TYPE scale**, so `inline-size: var(--sherpa-theme-size-icon-2xs)`
  is a text value wearing a layout property. Judge by the token in the VALUE,
  not by the property name.
- **A px inside `var(--token, 12px)` is the token's own value.** Whether it is
  on the grid is the scale's question, not the component's.
- **`space-3xs` is 2px and is correct.** It is the sanctioned edge case, not
  drift.

The steps are emitted from the scales themselves — a GCD over the values — so a
re-export that moves a scale moves the grid and the lint with it. They are
never typed in.

- Site: `scripts/project-tokens.mjs`
- Site: `scripts/lint-css.mjs`

### T-a-density-mode-is-one-step

A density mode is **one step along the primitive scale** — compact −1,
comfortable +1, clamped at both ends. Measured 2026-09-24 across space and size,
both modes: **45 exact, 7 clamped, 0 wrong**.

It reads as arbitrary in the numbers, and that is the trap. Compact's ratios run
0.250 → 0.875 and its differences run −2 → −16, so it looks like neither a
multiplier nor a shift. It is a shift; the gaps in the scale simply widen
(2, 4, 8) as it climbs.

**Measure against the PRIMITIVE scale, not the space scale.** An earlier pass
measured against `space`, got "10 of 13", and concluded the rule had exceptions.
It does not: `space` skips `28` and `36`, which are real primitive steps, so a
shift landing on one looked wrong. The aliases point at `primitives/scale`, and
against that there are no exceptions.

```
primitives/scale   0  2  4  8  12  16  20  24  28  32  36  40  48  56  64
space skips                            ^^      ^^
```

**0 is the absence of a step, not the smallest one.** `none` stays `none` in
every mode, and the smallest real step never collapses to zero — a gate that
treats 0 as index 0 reports three false failures.

The scale is now emitted as `--sherpa-scale-*` (the one exception to inlining
primitives) so a density block ALIASES one step along rather than restating a
number, and `project-tokens.mjs` gates the rule — proven by breaking one cache
value, which reported `12px → 10px, but one step is 8px`.


**A density overrides SPACE and SIZE only — 27 values each** (Figma's
`variableOverrides`, read live 2026-09-30). The hand-kept file had carried
119: the other 92 were a stale copy of the ramp, and five of them painted an
OLD success green under `[data-density]`, light and dark. The file keeps only
what the collection overrides, and `check:extensions` counts it. With no
colour in a density, no dark re-point is emitted either.
- Site: `scripts/project-tokens.mjs`
- Site: `scripts/check-extensions.mjs`

### T-a-gauge-composes-the-ring

`sherpa-radial-chart` (was `sherpa-radial-chart`) owns the ring — donut, pie, and
the arc variables `data-sweep-start`, `data-sweep` and `data-inner`. The gauge
uses the same pen and keeps its own needle, zones, scale and caption.

**It composes at the DRAWING layer, not the DOM**, and the measurement is why:

| | |
|---|---|
| shared CSS classes | 7 of 24 — **29%** |
| gauge-only | `needle` `hub` `hub-cap` `scale` `zone` `caption` + 6 more |

A nested `<sherpa-radial-chart>` cannot work either, and it is worth knowing
before trying: the gauge's SVG is `viewBox="0 0 100 50"` with
`aspect-ratio: 2` — the TOP HALF of the ring's box — while the ring is
`0 0 100 100` at `aspect-ratio: 1`. A child brings its own square box and its
own shadow root, so the parent's crop cannot reach it. Composing in the DOM
would mean the gauge reaching into the child's layout.

What they DO share is `ringSegmentPath()`, which already takes every variable
either needs, and the geometry constants beside it.

**One of those constants was written twice.** The gauge computed its hole as
`CENTRE - 15` and the ring as `CENTRE * 0.7`. Both are 35.25 at a 100-unit box
— one value with two spellings, which drift apart the moment either moves. They
now share `RADIAL_INNER_RATIO`.

- Site: `src/core/ui/shared-constants.ts`
- Site: `src/components/sherpa-radial-chart/sherpa-radial-chart.ts`
- Site: `src/components/sherpa-gauge-chart/sherpa-gauge-chart.ts`
- Site: `test/e2e/reforged-radial-chart.spec.ts`

### T-an-override-collection-is-keyed-by-its-parent

`figma.extensions.json` caches ten Figma collections that the DTCG export
cannot carry. Nothing in the repo writes it, and it went eight days staler than
the export before anyone noticed. The obvious fix — read the values back through
the plugin API — **does not work**, and fails in the way that looks like success.

An override collection's variables key `valuesByMode` by their **parent**
collection's mode ids. Their own mode ids appear nowhere in the chain. Measured
2026-09-24, all ten:

| collection | its own mode id | the key its variables actually use |
|---|---|---|
| Transparent | `…951:35766/951:90` | `18:2` (Style) |
| Saturated | `…953:35878/953:98` | `18:2` (Style) |
| compact | `…94:1014/94:0` | `6:1` (Display Mode) |
| grid-top | `…1200:30207/1200:452` | `1181:11` (Grouping) |

**10 of 10 showed `sawOwnMode: false`.** Transparent and Saturated even alias
the SAME variable (`VariableID:956:36558`) under the same keys, so a read
returns one value for both — while the cache has them differing in 54 of 96.

**SOLVED 2026-09-24 — the values ARE readable, on the COLLECTION.** They are
not on the variable, which is what made every read below fail:

```js
(await figma.variables.getVariableCollectionByIdAsync(id)).variableOverrides
// -> { [variableId]: { [thisCollectionsOwnModeId]: VARIABLE_ALIAS | {color, opacity} } }
```

Keyed by the collection's OWN mode ids — the ones that appear nowhere in any
variable. Verified on `Transparent`: 9 overridden variables, and
`style-content/base` genuinely differs per mode. `T-a-look-override-is-not-on-the-variable`
carries the shape.

Everything below is the dead end that came first, kept because each step looks
like it should work:

- **`mode.parentModeId` exists** and gives the mapping (`951:90` → `18:2`), so
  the keying is not a mystery. Reading through it still returns the same alias
  for both collections — the mapping is right, the override is not there.
- **`resolveForConsumer`** on a frame pinned to the override mode returns
  `null`, for every mode of both collections.
- **A scan of all 776 local variables** found **zero** keyed by an override
  collection's own mode ids. The values are not in the variable data anywhere
  in the file.

Restarting Figma and the bridge plugin changes none of it — the values were
never on the VARIABLE, and that is the whole lesson: three reads agreeing does
not mean the data is absent, only that you are asking the wrong object.

So a capture looks complete, carries real hex values, and is silently the BASE
collection's values with every override gone.

**Will's ruling 2026-09-24: do not build a regenerator.** Read what a task
needs live through the figma-console MCP — now possible for real, via
`variableOverrides` — and hand-patch the file when a value changes.

A hand-patch is exactly where a collection can quietly collapse onto its
sibling, so `npm run check:extensions` guards the shape a good file has: every
collection present and non-empty, and every sibling pair that must differ still
differing by the measured count. Proven by collapsing Saturated onto
Transparent, which it names.

Those counts are MEASURED, not guessed — I first wrote 102 for
compact/comfortable, and the checker reported the correct file as drifted. A
wrong constant in a gate reads as a fault in the data.

**Two real bugs were found on the way**, and both are worth keeping:

- **Figma opacity is 0–100, not 0–1.** Dividing by 100 is required.
- **A nested `COMPOSE_COLOR` must return CHANNELS, not a hex string.** Returning
  a string makes the outer expression's `'r' in col` test fail, and its alpha is
  dropped in silence — which is how `style-surface/shadow` read `#0c0b11`
  instead of `#0c0b114d`.

Unblocking this needs whatever originally produced the cache — a Figma plugin
with UI, reading the document with an override mode actually applied.

- Site: `scripts/check-extensions.mjs`

### T-a-host-cannot-hold-aria-expanded

A `sherpa-button` that opens a menu keeps `aria-expanded` on its INNER
`.trigger`, because that is the real `<button>`. An author who writes
`aria-expanded="false"` on the HOST creates a second, frozen copy — and the host
is what a screen reader meets first, so an open menu announces as closed.

Measured on `sherpa-chart-legend`'s breakdown control: host `"false"` while the
inner trigger read `"true"`.

The button now strips a host-level `aria-expanded` when its menu toggles, and
the template that wrote one no longer does. `sherpa-quick-filter-toolbar` had it
right already — it sets `aria-haspopup` on the host (a static fact) and leaves
`aria-expanded` to the button (a changing one).

`sherpa-container-header` keeps a host `aria-expanded` and is NOT this trap: its
own TS maintains it, and it is a collapse toggle rather than a menu.

- Site: `src/components/sherpa-button/sherpa-button.ts`

### T-an-allow-list-is-a-filter-not-an-order

An allow-list says WHICH, never in what sequence. Returning the list's order
silently replaces whatever order the items already had — a component that sorts
its own options would have that sort overwritten by a caller's typing order, and
nothing would report it.

`allow(items, list)` therefore filters `items` and keeps THEIR order. The test
writes its list backwards on purpose.

**No list allows everything.** `null` and `undefined` mean "no list", so a
component that never hears about this behaves exactly as before. An EMPTY array
is a list that names no one, and allows nothing — the two are different, and
collapsing them would either break every existing caller or make an empty list
useless.

An item is named by `id`, then `value`, then `field`, then `valueKey` — first
present wins, so a filter def and the bare field name it is listed under still
meet. A list entry naming nothing is REPORTED by `unknownEntries()` rather than
thrown: a stale entry should not stop the other nine working.

`nextState(states, current)` is the same primitive on the STATES axis, and it is
why a two-state toggle and a tri-state cycle are the same control — the
component steps the list it was given and does not care how long it is. An
unknown current state starts the cycle rather than stranding the control, which
is what happens when a value is removed from the list while something still
holds it.

- Site: `src/core/data/allow.ts`
- Site: `test/unit/allow-list.test.mjs`
- Site: `src/components/sherpa-quick-filter-toolbar/sherpa-quick-filter-toolbar.ts`
- Site: `test/e2e/reforged-quick-filter-toolbar.spec.ts`

### T-a-filter-applies-down-its-scope

Two scopes, and before this they shared one slot.

| scope | reaches | writes |
|---|---|---|
| **view** | every component in the View — it cascades DOWN | the FIELD's one selection, `select()` |
| **component** | that component only | a NAMED PART, `contribute()` |

`select(field, …)` is keyed by field alone, so a second writer does not narrow,
it **replaces**. Measured: a View chip picked `mac + win`, a legend switched
`mac` off, and the chip's own state came back as `win` — the reader's choice
overwritten, and the chip re-drew showing the legend's answer as if they had
made it.

A named part fixes the whole rule at once, because parts are ANDed with every
field selection:

- it can only **narrow further** — `mac+win` then `win` gives `win`;
- it can **never widen past the View** — a legend asking for a series the View
  excluded gets nothing, not that series back;
- two components over one field **intersect** rather than fight, provided each
  names its own `key`;
- the View's own state is **untouched**.

**A component binding draws its OWN answer, not the field's.** The View's is a
different, wider question, and drawing it on a component control would claim the
reader picked something they did not. It also means `selection-change` never
fires for a part, so the binding redraws itself on write.

**A component scope REFUSES a source with no `contribute()`** rather than
falling back to `select()` — that fallback is the exact clobber this scope
exists to prevent.

`scope` defaults to `view`, so every existing binding is unchanged.

- Site: `src/core/data/bind-selection.ts`
- Site: `src/core/data/data-source.ts`
- Site: `test/e2e/reforged-filter-scope.spec.ts`

### T-one-filters-button

**ONE "Filters" button holds every filter: the chips folded off the run for want
of room, every filter a reader may add, and the saved ones.** Will, 2026-09-25:
*"We should merge the overflow 'More' button and the 'Add filter' button … into
1 button"* — in the action group, labelled "Filters", with a plus on the left.

Its menu, top to bottom:

| section | rows | a row does |
|---|---|---|
| Added filters | every filter it holds a reader can take off, ticked — and every chip folded away, with a caret | the tick removes, on Apply; the caret opens its child menu |
| Available filters | what it may add | adds, on Apply |
| Saved filters | the saved filters it may add | adds, on Apply |

**A filter is in ONE of them.** Will, 2026-09-25: *"If it's in Added Filters
then it shouldn't be in Available or Custom filters."* (Custom is "Saved filters" since TODO 105.) A folded chip is an ADDED
filter, so it is a row there, not in a section of its own — there was a "More
filters" section above, and Will folded it in the same day
(`T-a-row-opens-its-child-menu`). A folded chip that cannot be taken off has no
box; its row is the caret's alone.

Its badge counts the folded chips, and it reads active while one of them is on
(`T-the-filters-button-is-a-door-not-a-filter`).

**A drill borrows the menu, and gives it back.** Drilling copies the folded
chip's own settings onto the Filters menu — its Apply, its search, one pick or
many — so the Filters menu SAVES its own first and restores them on the way
out, with its heading. The old More menu had no settings of its own to lose.
And while drilled, a pick is that chip's: `#onAddCommit` reports the bar
instead of reading the rows as filters to add or remove. The bar's own Save
waits outside a drill.

**A fold rebuilds the menu**, so it closes first (`#closeOverflow`), as the
More menu did. A chip rebuilt by `#render` is folded again before it is shown,
so a stale fold lists nothing: only connected chips are listed.

**The words, the list and the drill are ONE module**,
`core/ui/filters-button.ts`, because the filter panel has the same button
(`T-a-shut-scope-folds-like-a-bar`). Two copies of this drifted every time
one was touched.

- Site: `src/components/sherpa-quick-filter-toolbar/sherpa-quick-filter-toolbar.ts`
- Site: `src/components/sherpa-quick-filter-toolbar/sherpa-quick-filter-toolbar.html`
- Site: `src/core/ui/filters-button.ts`
- Site: `test/e2e/reforged-one-filters-button.spec.ts`

### T-a-divider-needs-a-neighbour-on-both-sides

**A toolbar divider shows only with something on both sides of it.** Will,
2026-09-26. The three dividers — after the View zone, after the Organise zone,
and in the action group — each went on standing alone:

| divider | alone when |
|---|---|
| View zone's | no Organise zone and no chip shown after it — a panel took them all |
| Organise zone's | no chip shown after it |
| the action group's | panel mode hides every action before it |

CSS only: the rules read what the chip run SHOWS — a chip neither folded away
nor drawn by a panel — through `.bar:has()`, because `:host(:has())` fails in
Chromium. A folded chip is not display:none, so it must be named, not assumed.

- Site: `src/components/sherpa-quick-filter-toolbar/sherpa-quick-filter-toolbar.css`
- Site: `test/e2e/reforged-toolbar-dividers.spec.ts`

### T-add-condition-sits-below-the-rows

**Add condition is a labelled button in the default look, BELOW the last
condition row.** Every row ends in Remove; a lone row has none, as there is
nothing to drop, and Clear is how a reader says "no filter".

Will, 2026-09-25, first asked for a plus at the end of the last row, with
Remove only on the rows before it. On 2026-09-26: *"The add condition button
being on the end of the last input row needs to change. Put the button below
the last input row."* So it went back, labelled "Add condition", no longer the
transparent look.

Pressing it puts focus in the new row's condition field — once that field has
drawn, as it renders on its own clock.

- Site: `src/components/sherpa-menu/sherpa-menu.ts`
- Site: `src/components/sherpa-menu/sherpa-menu.css`
- Site: `test/e2e/reforged-filter-conditions.spec.ts`

### T-a-reopened-dialog-hears-a-late-close

**A `sherpa-dialog` shut and opened again at once must stay open.** The native
`<dialog>` fires `close` on a QUEUED task, so it lands after the second
`show()`. The dialog wrote `open` off when it heard it, and that attribute
change shut the dialog again — with its new question on it.

So `#onClose` does nothing while the native dialog is open. The close that was
undone before it landed is not reported: the dialog is not closed.

Found by the Records page's Save filter dialog: Cancel, then Save filter again
at once, and the dialog vanished — or stayed, with its question dropped.

- Site: `test/e2e/reforged-dialog.spec.ts`
- Site: `src/core/ui/disclosure.ts`

### T-a-row-opens-its-child-menu

**A menu row can open a CHILD MENU: a caret at its end.** Will, 2026-09-25: the
Filters menu's Added filters *"show a child menu caret (and child menu of values
of course) during reflow of the filter chips"* — one section, in place of a
second "More filters" section for the folded.

A `MenuItem` with `drill: true` gets the caret and a `count` badge, and the
menu reports `menu-drill { value }`; the HOST drills, as it knows where the
child menu is. `pickable: false` gives a row with no box — a filter that
cannot be taken off.

**The whole row is the door** (TODO 48), as in an OS menu: a click anywhere
on it but its box, a pointer that RESTS on it for 500 ms, or ArrowRight
(ArrowLeft goes back). A pointer PASSING over opens nothing — the drill is in
place, and a pass once drilled the list away. A touch never hovers.

**Nothing but the box ticks the box.** The row is a `<label>`, and a click on
a label ticks its box; the menu calls `preventDefault` on it. The box is a
different answer — added or not — from what the child menu holds.

**An on/off chip has no menu to open**, so its child menu is BUILT for the
drill: one row, "On" (Will's pick). In the bar it applies at once, as the
chip's body does; in the panel it waits for Apply, as a press on the chip
does. It is dropped on the way out.

**`::slotted` reaches the row, never its children**, so the row is a GRID —
box, label, count, caret — and needs no rule on any child. An empty
`sherpa-badge` draws nothing (`:host(:empty)`), so a count of 0 shows no badge.

- Site: `src/components/sherpa-menu/sherpa-menu.ts`
- Site: `src/components/sherpa-menu/sherpa-menu.html`
- Site: `src/components/sherpa-menu/sherpa-menu.css`
- Site: `src/components/sherpa-quick-filter-toolbar/sherpa-quick-filter-toolbar.ts`
- Site: `src/components/sherpa-quick-filter-toolbar/sherpa-quick-filter-toolbar.html`
- Site: `src/components/sherpa-filter-panel/sherpa-filter-panel.ts`
- Site: `test/e2e/reforged-menu-child-rows.spec.ts`
- Site: `test/e2e/reforged-quick-filter-toolbar.spec.ts`
- Site: `test/e2e/reforged-one-filters-button.spec.ts`
- Site: `test/e2e/reforged-panel-filters-button.spec.ts`

### T-an-open-panel-follows-the-data-layer

**An open filter panel follows every field another control changes.** It was
filled ONCE, when it opened. A chart legend or a column heading then changed
a field, the data and the bar followed, and the panel still showed the old
answer — so its next Apply, with nothing touched, put that answer back.
Measured on the Records page: 25 rows went back to 100.

The page steers the panel from the same `selection-change` it steers the bar
from, with `setFieldReading(id, reading)`. ONE field, not a refill: a refill
redraws every field and throws away the reader's unapplied picks. The steer
is that field's last Apply too, so Discard keeps it.

Will asked, 2026-09-25, whether the swap at the breakpoint needs a re-query.
Measured after the Apply fixes (`T-a-chip-press-applies-its-menus-draft`):
the swap itself keeps every answer both ways — the bar is steered on Apply,
and the panel is refilled when it comes back. The panel open was the hole.

- Site: `src/components/sherpa-filter-panel/sherpa-filter-panel.ts`
- Site: `src/core/data/data-source.ts`

### T-a-shut-scope-folds-like-a-bar

**A SHUT scope in the filter panel hides its filters the way a narrow bar
folds its chips, so the panel's Filters button does what the bar's does.** Will,
2026-09-25: *"make the Add Filters button in the filter panel behave the same
as the toolbar version BUT shows More Filters when the accordion is
collapsed."*

Shut, every filter the scope draws is listed under **Added filters**, in its
order, each with a caret into its child menu — a preset's is one row, "On"
(`T-a-row-opens-its-child-menu`). The badge counts them and the button reads
active while one of them is on. Open, there are no carets, no badge and no
active state: an open scope speaks for itself.

A caret drills IN PLACE, as the bar's does, but the panel has fewer menus to
borrow. Group, Sort and a date are ONE chip each, with a menu: the drill moves
those rows. A run of values has no menu at all — its values ARE its chips — so
the panel BUILDS one from the same def, ticked as the chips are
(`T-one-field-one-filter-menu`), and drops it on the way out. A field answered
by a body of its own — a number, a condition — keeps that body in the menu's
shadow, which a drill cannot move, so its door OPENS THE SCOPE on the field.

**Which scopes are shut is the panel's own**, kept across a redraw: nothing
outside can see it, and a populate re-opened every scope the reader had shut.

Since 124 the button is ONE, in the panel's header: its badge and its active
state sum every shut scope, and a toggle rebuilds the whole list.

- Site: `src/components/sherpa-filter-panel/sherpa-filter-panel.ts`
- Site: `test/e2e/reforged-panel-filters-button.spec.ts`

### T-a-drilled-pick-goes-home-first

**The panel puts a drilled filter's rows back BEFORE it reports the pick.**

A chip reads its answer from its OWN menu. While drilled, that menu is empty —
the rows are in the Filters menu — so a pick reported there reached a chip
that read nothing, and its face and its report were both wrong. Home first,
then the same `menu-change` is sent from the chip's own menu, and the chip
and the panel take it exactly as a pick made there.

A run's built menu is not a chip's, so its pick ticks the chips instead. Its
Apply is the panel's Apply (`T-a-chip-menu-apply-is-the-panels-apply`).

- Site: `src/components/sherpa-filter-panel/sherpa-filter-panel.ts`

### T-the-filters-button-is-a-door-not-a-filter

**The Filters button is a DOOR to filters, not a filter.** It reads active —
`data-status="active"` — while a chip folded INTO it is on, and off otherwise.

That is the one state on a filter bar that could never be wrong in the reader's
favour: a bar showing an active filter that is not applied says the rows are
narrowed when they are not. The More chip it replaced once carried
`data-current` hard-coded in its template, and always drew as applied.

The toolbar writes it in `#syncFoldedBadges()`, which runs on every change —
not only when the fold is recomputed, or ticking a folded row would not move it.

**The BADGE is a different count and does not move.** `data-badge` says how
many filters are folded away, not how many are on — two questions, and a
reader needs both. It is a `sherpa-badge`, pinned `default` like every Badge
instance, so the button's own active tint never reaches it.

The panel's one Filters button is the same door, over every SHUT scope
(`T-a-shut-scope-folds-like-a-bar`).

- Site: `src/components/sherpa-quick-filter-toolbar/sherpa-quick-filter-toolbar.ts`
- Site: `src/components/sherpa-filter-panel/sherpa-filter-panel.ts`
- Site: `test/e2e/reforged-quick-filter-toolbar.spec.ts`

### T-only-five-filter-chips-carry-an-icon

A component-scoped filter chip carries NO glyph. Only five filters do, and they
are the ones a reader finds by shape rather than by reading:

| filter | icon |
|---|---|
| Views | `desktop` |
| Regions | `globe` |
| Customer / Organisation | `buildings` |
| Date filters | `calendar` |
| Time filters | `time` |

An icon on every chip is an icon on none: a row of glyphs is a texture, and the
five that mean something stop being visible. `plan` wore `price-tag` and
`openTickets` wore `ticket` — both decorative, both dropped 2026-09-24.

**Two names in the table are not the icon's name.** `monitor` and `desktop` are
byte-identical files — the same drawing exported twice — and the toolbar fixes
the view selector's glyph itself rather than taking it from the chip def. There
is no `office`; `buildings` is the set's word for it.

- Site: `src/core/data/data-source.ts`

### T-a-native-select-keeps-its-own-shape

A `<select>` at `appearance: auto` is drawn by the ENGINE, and the engine's
shape wins over the CSS. The pagination's row-count select and the page field
sit side by side; measured, they disagreed — WebKit rounded the select to 5px
and the input to 4px, whatever the stylesheet said. Chromium gave 4px for both,
so the difference was invisible in one engine.

`appearance: none` fixes the shape and takes two things with it:

- **The caret.** The engine's arrow goes, and a `<select>` cannot carry a
  `::after` — so the glyph has to be a `background-image`. It is the same
  triangle-down `sherpa-input-text` masks in for its select type.
- **The border.** The declared `border-color` had never drawn, because the
  native control supplied its own; there was no `border-width` at all. Both are
  now stated per-edge, as every other field does it.

**WebKit's READ-BACK of that border is unreliable.** `getComputedStyle` returns
`currentcolor` on a first read and the declared value only after a forced style
recalc — writing any inline value to the same property flips it. The paint is
right; the probe is not. So the test asserts the select's SHAPE, and takes the
border colour from the page field beside it.

- Site: `src/components/sherpa-pagination/sherpa-pagination.css`
- Site: `test/e2e/reforged-pagination.spec.ts`

### T-many-conditions-are-one-reading

A reader may give one field SEVERAL conditions — `contains "an" OR starts with
"B"` — and every row after the first says how it joins the one before it. That
is still ONE reading of ONE field, so it stays in the field's single slot and
`stateClause()` returns one filter: a CLAUSE for one row, a GROUP for several.

Splitting it across two writers would be the bug `T-one-state-per-filtered-field`
already names, and a control drawing the field would have to ask twice.

**`and` binds tighter than `or`.** `A or B and C` is `A or (B and C)` — the
precedence every other language uses. Reading the rows left to right without it
gives `(A or B) and C`, a different question from the one the reader wrote.

**A half-built row narrows nothing, and is dropped.** A row whose op has no
value yet — no text typed, nothing picked — is not a filter. A field whose rows
are all half-built reads `off`, so a menu mid-edit does not narrow the data
under the reader's hands.

**One surviving row returns a CLAUSE, not a one-member group.** `['or', x]` is
valid and a caller ANDs it either way, but someone debugging a filter should see
the shape they built.

`op`/`text` remain the single-condition form and are what every existing caller
writes. A reading carries EITHER — never both.

- Site: `src/core/data/filter-state.ts`
- Site: `test/unit/filter-conditions.test.mjs`
- Site: `src/components/sherpa-quick-filter/sherpa-quick-filter.ts`
- Site: `src/components/sherpa-menu/sherpa-menu.html`
- Site: `test/e2e/reforged-filter-conditions.spec.ts`
- Site: `src/components/sherpa-menu/sherpa-menu.ts`
- Site: `src/core/data/data-source.ts`
- Site: `src/core/ui/filter-menu.ts`
- Site: `src/components/sherpa-data-grid/sherpa-data-grid.ts`

### T-an-inactive-chip-says-where-its-filter-went

A chip whose field another control has taken goes grey with an EMPTY tooltip,
which reads as "your filter vanished". It has not: the View owns the field, and
the chip's own picks are still there waiting for the field to come free.

A superseded chip now says so, and says it in two halves because a reader wants
both:

| | |
|---|---|
| no picks of its own | `Filter moved to View scope.` |
| picks it still holds | `Filter moved to View scope. This chip holds active, churned.` |

**It names the scope the filter MOVED to** — Will, 2026-09-30 (TODO 126).
`movedTo(scope)` writes the words for a chip and a panel alike, from
`data-applied-at` and `appliedAt`. A scope's heading may end in "filters"
("View filters"); the sentence says "View scope". With no name it says "a
higher scope".

The tooltip follows `data-superseded` and `data-applied-at` from `onChange`,
because neither touches the VALUES and nothing else re-syncs it.

- Site: `src/components/sherpa-quick-filter/sherpa-quick-filter.ts`
- Site: `src/components/sherpa-quick-filter-toolbar/sherpa-quick-filter-toolbar.ts`
- Site: `test/e2e/reforged-quick-filter.spec.ts`
- Site: `src/core/data/data-source.ts`
- Site: `src/components/sherpa-filter-panel/sherpa-filter-panel.ts`
- Site: `src/core/ui/shared-constants.ts`
- Site: `test/unit/moved-to.test.mjs`

### T-a-restored-filter-still-needs-its-chip

`setColumnFilter()` is SILENT by design — echoing `column-filter-change` back
would clear the clause twice. So a saved view that restores a column filter
fires no event, and the chip an interaction would have put on the bar never
appears: the grid narrows and nothing on screen says why.

Reported as *"the Status column has a filter applied by default that isn't
visible in the toolbar chips or anywhere else"*. Measured on `?context=records`
after picking `At risk`: `grid.columnClause('status')` held
`['status','ne','churned']`, the heading showed its `!=` badge, and the toolbar
carried no `col:` chip at all.

**A `FIELD_CHIPS` field is NOT automatically covered by its own chip.** That
chip draws a SELECTION, which is all `source.select` can hold, so it reports a
pick list and nothing else. `ne churned` is not a pick list — so a field with
its own chip still needs a `col:` chip for a condition the chip cannot express.
That is the same split the live `column-filter-change` handler already makes,
and the restore path has to make it too.

**The label had no public reader.** `columnClause(field)` was public and the
wording was not, so a host could see the clause and had nothing to put on a
chip. `columnLabel(field)` closes that — `T-grid-read-without-write-is-half-an-api`
is the same shape of gap.

- Site: `src/components/sherpa-data-grid/sherpa-data-grid.ts`

### T-a-filter-menu-has-two-modes

A filter menu asks ONE question two ways, and they are not two menus.

**SIMPLE** is a search over ticked rows. **ADVANCED** is the And/Or rows. An
icon button — f(x), named **Advanced** — at the end of the header moves
between them, in the menu and in a panel field's header alike; it is ON
(`aria-pressed`) in Advanced. It was that button first, then a switch
(2026-09-26), and the button again — Will, 2026-09-30, TODO 141.

Both stay STAMPED. Flipping a mode is a change of VIEW, not a reset: the ticks
survive a trip through Advanced mode, and the typed rows survive a trip back.
A mode that cleared the other would make the button a destructive control
wearing no warning.

`data-mode` = `simple` | `advanced` (the old `select` | `condition` and `default` | `custom` are read). The rows live in `.condition-rows`, and
each row is `[And|Or] [condition] [value]`.

- Site: `src/components/sherpa-menu/sherpa-menu.css`
- Site: `src/components/sherpa-menu/sherpa-menu.html`
- Site: `src/components/sherpa-menu/sherpa-menu.ts`
- Site: `src/components/sherpa-quick-filter/sherpa-quick-filter.ts`

---

### T-a-number-has-advanced-rows

**A number that opts in (`advanced: true`) has Advanced condition rows**, as
a list does — Will, TODO 90: *"Any filter should be able to be toggled to
'Advanced' … We'll need different conditional options for numeric, and date,
field types."* Its menu is a FILTER menu with `data-body="number"`: in
Simple it draws the same number body as any number chip (no operator
select: conditions go in rows), and in Advanced the rows take its place, with
the NUMBER questions (`OPS_FOR_TYPE.number`: =, ≠, >, ≥, <, ≤).

Four things that are not obvious:

- **Every row is TYPED** — a number has no list to pick from. So its `=`
  and `≠` rows take a typed value too, and answer as their one pick
  (`picked: [n]`), as the body's one value does
  (`T-one-number-is-a-pick-under-equals`); the others answer with `text`.
- **`data-op` is the BODY's.** A list menu mirrors row one into `data-op` and
  `data-value` (`T-row-one-is-data-op`); a number menu must not, or editing a
  row changed its Simple answer's operator.
- **Going Advanced carries the body over**, whoever flips it — the menu's
  own button or a panel's f(x), so it happens in the `mode` setter: one value
  under its op, or a range as At least AND At most. Back in Simple the body is
  as it was: both answers are kept (`T-both-answers-are-kept`).
- **A reading's rows are only its own `conditions`.** `readingRows()` turns a
  Simple `> 2` into a row, and with no mode named its rows decide — which
  flipped every typed number into Advanced.

Dates are not done: their questions wait on TODO 21d.

- Site: `src/components/sherpa-menu/sherpa-menu.css`
- Site: `src/components/sherpa-menu/sherpa-menu.html`
- Site: `src/components/sherpa-menu/sherpa-menu.ts`
- Site: `src/components/sherpa-quick-filter/sherpa-quick-filter.ts`
- Site: `src/core/ui/filter-menu.ts`
- Site: `test/e2e/reforged-number-advanced.spec.ts`
- Site: `src/core/ui/saved-filter-menu.ts`

### T-conditions-are-opt-in-per-field

Conditions are OFF by default. A field answered by ticking a closed set of
three — Region, Customer, Status — gets a plain list and no mode button.

`Contains` over four regions all visible on screen is a control that cannot
help the reader, and offering it says the list might be incomplete when it is
not. A field opts in with `advanced: true` on its def; the toolbar writes
`data-advanced` and the menu shows the button.

Two doors, both shut: the CLICK is refused, and so is a host writing
`data-mode="advanced"` — `#enforceMode()` strips it in `#sync`. A hidden
button with a live mode is a control a reader cannot reach but a script can.

A TEXT GRID COLUMN is the exception and always opts in. A column of free text
is exactly what a reader asks "starts with" of.

- Site: `src/components/sherpa-menu/sherpa-menu.css`
- Site: `src/components/sherpa-menu/sherpa-menu.html`
- Site: `src/components/sherpa-menu/sherpa-menu.ts`
- Site: `src/core/ui/filter-kind.ts`
- Site: `test/e2e/reforged-filter-conditions.spec.ts`

---
- Site: `src/components/sherpa-filter-panel/sherpa-filter-panel.ts`
- Site: `test/e2e/reforged-filter-panel-component.spec.ts`
- Site: `src/core/ui/filter-menu.ts`

### T-a-condition-badge-says-that-not-which

A per-operator sign can say which operator ONE row holds. A field holding
`Contains "ab" or Equals churned` has no single operator, so any one sign over
it is wrong, and the reader believes it.

So no mark ever names an operator. A grid HEADING wears ONE glyph — `fx`, the
spreadsheet's formula sign — which says only THAT conditions apply. A CHIP's
badge is its RESULTS since TODO 60 (`T-a-chip-counts-its-own-results`), so it
wears no condition mark at all. The tooltip says HOW MANY
(`T-a-condition-tip-counts-its-rows`); the chip's value and accessible name
spell the chain, `Contains: ab or Equals: churned`, from `spellConditions()`.

The accessible name stays the WORD, never the mark: a sign announces as
nothing, and `fx` announces as noise.

- Site: `src/core/data/filter-face.ts`
- Site: `test/e2e/reforged-filter-conditions.spec.ts`

---
- Site: `src/components/sherpa-quick-filter/sherpa-quick-filter.ts`
- Site: `src/data.ts`
- Site: `test/unit/filter-state.test.mjs`
- Site: `src/components/sherpa-data-grid/sherpa-data-grid.ts`

### T-an-active-chip-is-heavier-and-more-strongly-drawn

An ON filter chip takes a `1px` border; an off one is `0.5px`. It does **not**
change weight.

Colour alone was carrying the whole on/off signal, and on a bar of twelve chips
a reader scanning for "which of these is doing something" had one channel to
read. The stroke is the second, and it survives a colour-blind reader and a bad
monitor.

Will, 2026-09-24: *"I think I'd like to increase the font weight (emphasised
token?) and border thickness (1px) on active chips."*

**The weight half was reverted, 2026-09-25.** Will: *"Let's remove the increase
in filter chip text weight when active. It's a bit annoying."* Text that
changes weight as it toggles re-flows its own chip, so a bar of twelve shifts
under the pointer — which the stroke does not do. The stroke stays.

- Site: `src/components/sherpa-quick-filter/sherpa-quick-filter.css`

---

### T-a-condition-is-a-draft-too

A committing menu holds its condition ROWS until Apply, exactly as it holds its
ticked rows.

Without this a condition applied on every keystroke — `C`, `Co`, `Con` — each
re-querying the whole view, and none of them cancellable. Will, 2026-09-24:
"Conditional filters are being applied immediately on change instead of on
clicking Apply."

`#emitConditions()` returns early when `#commits`, and Apply calls it with
`force`. Cancel and a plain close restore `#conditionBaseline`, captured on
open beside `#baseline`.

**Two things make the restore harder than it looks.** `hidePopover()` fires
`toggle` ASYNCHRONOUSLY, so `#applying` is already false when the close runs —
`#settledByAction` is a second flag that survives the gap. And `conditions =`
REBUILDS every row, whose value select then fills asynchronously, so restoring
IDENTICAL rows still blanked the answer for a tick; the setter returns early
when nothing differs.

- Site: `src/components/sherpa-menu/sherpa-menu.ts`
- Site: `test/e2e/reforged-filter-conditions.spec.ts`

---

### T-a-mode-switch-carries-the-answer-over

Pressing the mode button with three values ticked seeds three ORed rows.

A reader who ticks values and then reaches for conditions is saying "now let me
refine THAT". Opening on a blank `Equals <first option>` throws their answer
away and does not say so.

`#seedFromPicks()` runs only when the rows hold nothing of their own, so a
second trip into condition mode never overwrites real work.

- Site: `src/components/sherpa-menu/sherpa-menu.ts`

---

### T-an-untouched-select-is-not-an-answer

A `<select>` shows its first option whether or not anyone touched it.

So reading `.value` made every untouched condition row report a pick — and
`#seedFromPicks` then believed the rows were already answered and carried
nothing over. The row records what the READER chose in `data-want`, written
only from a change event on the value select.

The same fact needs a PLACEHOLDER: a `<select>` has no `placeholder`
attribute, so an empty `Select…` first option is both the prompt and the proof
the row is unanswered. Will, 2026-09-24: "Conditional equal dropdowns, if not
populated from carry over, should default to a placeholder 'Select…' label."

`data-condition="advanced"` follows the same rule — it means ANSWERED rows, not
merely present ones, because a menu in Advanced mode always holds one row.

- Site: `src/components/sherpa-menu/sherpa-menu.ts`
- Site: `src/core/data/filter-state.ts`

---

### T-a-late-built-menu-takes-the-answer-as-it-stands

A panel field drawn as chips has NO menu. One is built the first time the
field flips to Advanced — and it used to be filled from `def.state`, the
answer as the source DREW it, a tick after it rendered.

That is right at draw and wrong at a flip. A field the Query holds as "Simple,
with rows kept" — every field that was flipped back, then moved across a scope
— was drawn Simple; its f(x) built the menu, set Advanced, and the late fill
wrote `mode: 'simple'` back over it. The button read ON, the Query read
Simple, and the next move drew it Simple: Will, TODO 151.

So `#giveMenu(…, restore)` fills from the draw-time state only AT DRAW. A
menu built later takes the answer as it stands NOW, set by whoever built it:
the flip gives it the rows the Query kept and the chips as they are ticked;
a source's steer gives it its own reading.

- Site: `src/components/sherpa-filter-panel/sherpa-filter-panel.ts`


### T-a-rebuilt-row-reads-empty-for-a-tick

A rebuilt condition row reports NO answer until its value select has filled.

`populate()` on a composed `sherpa-input-text` settles asynchronously, so for
one tick the row holds no pick — and a chip reading it then switches itself OFF
while it is filtering. The chip re-reads on the next frame (`#recheckConditions`)
and the toolbar re-emits (`#conditionFrame`).

**The recheck only ever turns a chip ON.** Re-applying unconditionally made it
fight the reader: switching a conditioned chip off flipped it straight back on.

**A panel field flipped to Advanced is the same case.** Its menu is built at
the flip, so an immediate report read "Advanced, no rows" and dropped the
filter until the next edit. The flip reports a frame after the menu has
rendered (`#reportSoon`).

- Site: `src/components/sherpa-quick-filter/sherpa-quick-filter.ts`
- Site: `src/components/sherpa-quick-filter-toolbar/sherpa-quick-filter-toolbar.ts`
- Site: `src/components/sherpa-menu/sherpa-menu.ts`
- Site: `src/components/sherpa-filter-panel/sherpa-filter-panel.ts`
- Site: `test/e2e/reforged-quick-filter-toolbar.spec.ts`

---

### T-a-value-select-waits-for-the-rows

Row ONE's `Equals` select opened EMPTY while row two, added afterwards, was
full.

`#syncConditions` stamps row one before the menu's own value rows arrive, and
`#valueOptions()` reads those rows. `#refillPicks()` on `slotchange` re-sends
the options to every row, keeping each row's own `data-want`.

- Site: `src/components/sherpa-menu/sherpa-menu.ts`
- Site: `test/e2e/reforged-filter-conditions.spec.ts`

---

### T-clear-empties-both-modes

Clear empties the ticks AND the condition rows.

A menu with two modes holds its answer in two places, and clearing one left a
"cleared" chip that was still filtering. Will, 2026-09-24: "Clicking Clear
should reset both list and conditional selections and values."

Clear is an action ON THE FILTER, not an edit to a draft, so it reports
immediately even on a committing menu — `#emitConditions(true)`.

- Site: `src/components/sherpa-menu/sherpa-menu.ts`

---

### T-toggling-a-conditioned-chip-suspends-its-condition

A conditioned chip's BODY toggles, and off SUSPENDS.

Two things blocked it. The body-click handler treated any chip with no ticks as
EMPTY and opened its menu instead of toggling — a conditioned chip has no ticks
and is not empty, its rows are its answer. And `states` reported an off chip's
conditions as `[]`, which reads as "no filter" rather than "not applying": the
chip could then never switch back on, because it needed a clause to go on and
the clause needed it on. It reports `suspended: true` instead, which is how
every other off chip already behaved.

Will, 2026-09-24: "Toggling a conditional chip should toggle whether that
condition is applied."

- Site: `src/components/sherpa-quick-filter/sherpa-quick-filter.ts`

---

### T-a-composed-child-takes-an-attribute-not-text

`kind: 'content'` on a prop whose `to` is a COMPOSED component writes text into
it — and text replaces every child it has.

`sherpa-filter-panel` declared `data-heading` that way, pointing at its
`sherpa-container-header`. The base class wrote "Filters" into the header and
deleted the search field slotted inside it. Nothing errored: the header still
said Filters, and the search was simply gone.

So a composed child takes an ATTRIBUTE. Declare the prop `kind: 'style'` and
pass it along in a sync method.

`kind: 'content'` is for a plain node the component owns — a `<span>`, a
`<p>` — where there is nothing else in it to lose.

---
- Site: `src/components/sherpa-filter-panel/sherpa-filter-panel.ts`

### T-a-chip-rewrites-its-own-label

`sherpa-quick-filter` rewrites its own `data-label` to "Field: Value" the
moment exactly one value is picked.

So anything that reads a chip's label back gets what the CHIP decided to show,
not what the caller passed. A filter panel searching on `data-label` stopped
matching a picked chip by its own name — the chip was called `Unassigned` and
the attribute said something else.

The panel records what it gave in `data-search` and matches on that. Give a
chip a label and keep your own copy.

---
- Site: `src/components/sherpa-filter-panel/sherpa-filter-panel.ts`

### T-a-chip-with-no-field-is-a-preset

A filter chip with NO MENU is a PRESET, not a field.

`At risk`, `Open tickets`, `Unassigned` — one question the data answers yes or
no, with no field behind it and no values to pick. In a filter panel they lead
their scope in ONE `Presets` section, not one section each: they are separate
questions that happen to share a shape, and a header per chip says they are
four fields when they are none.

A preset gets no Clear and no Remove — there is no field to act on — and its
own label is what a search matches, exactly as a value's is.

---
- Site: `src/components/sherpa-filter-panel/sherpa-filter-panel.ts`
- Site: `test/e2e/reforged-filter-panel-component.spec.ts`

### T-a-scope-is-named-for-its-content

A filter panel's component scope is named after the CONTENT it filters —
"Customer records", not "This context".

A reader with two grids on one page has to know which one a section answers
for, and "this context" answers for neither. The caller passes the name
(`names: { data: 'Customer records' }`); the generic word is only the fallback.

The VIEW scope keeps its own name, because there is exactly one of it.

---
- Site: `src/components/sherpa-filter-panel/sherpa-filter-panel.ts`
- Site: `test/e2e/reforged-filter-panel-component.spec.ts`
- Site: `src/components/sherpa-provider/sherpa-provider.ts`

### T-a-panel-adds-through-the-bar-that-owns-the-list

A filter panel's Add button does not keep its own list of available fields.

`sherpa-quick-filter-toolbar` owns it, so the panel reads `bar.offering` and
adds through `bar.addFilters(ids)` — the same door the bar's own Add button
uses. Two lists would drift the first time either one changed.

Both halves are read-backs the bar did not have: `available()` was a setter
with no getter, and `#addFilters` was private. "A host that SET something needs
to ask what the component now holds" — `T-state-ownership`.

**ONE button, in the PANEL's header, for every scope** — Will, TODO 124:
*"This will consolidate the filter menu for all scopes into 1 menu. We
already show the scope for filters in the menu item description … Filters
will get added to their default scope. It's then up to the user to move
their scope."* It lived in each scope's accordion header until then. A row's
value is `scope:id` — a chart's own field can share its id with a scope's —
and its description names its scope. An Available field is listed ONCE, in
its DEFAULT scope: the first component scope that offers it, else the View.
A commit sends each ask to the scope its row names. Toolbars keep their own.

**ONE FIELD, ONE SCOPE.** A field held by BOTH bars would draw twice, and a
reader cannot tell which of the two is in force — the same reason the records
bar has no Region chip. View leads, because its filters set the population the
Context bar narrows within.

---
**Since provider P3c the panel adds through the SOURCE**, which holds the
field in its scope and draws that scope's bar from the Query — the bar is still
the one list on screen, and it is told, never asked.

- Site: `src/components/sherpa-quick-filter-toolbar/sherpa-quick-filter-toolbar.ts`
- Site: `src/components/sherpa-filter-panel/sherpa-filter-panel.ts`
- Site: `test/e2e/reforged-filter-panel-component.spec.ts`

### T-an-accordion-action-is-not-a-toggle

`sherpa-accordion` has an `actions` slot in its summary row, and a click on one
must NOT open or shut the disclosure.

The slot is inside the `<summary>`, which is a handle by definition — so
without `preventDefault()` on the slot, pressing a button there did its own job
AND flipped the accordion. `preventDefault` rather than `stopPropagation`: the
event still has to reach the button.

**And a host should put nothing a reader can PRESS there.** A `<summary>` is
a button, and a button may not hold buttons: axe reports it
(`nested-interactive`), and it was the last structural failure in the
accessibility baseline (TODO 117). The filter panel kept two there. Its
`Filters` is in the panel's own header now (124), and `Save filter` is the
first row of the scope's BODY.

---
- Site: `src/components/sherpa-accordion/sherpa-accordion.ts`
- Site: `src/components/sherpa-accordion/sherpa-accordion.html`
- Site: `src/components/sherpa-filter-panel/sherpa-filter-panel.html`

### T-a-composed-chrome-row-takes-its-inline-padding-from-its-container

`sherpa-container-footer` sets `padding-inline: var(--_pad-inline, 0px)` — it
DEFAULTS TO ZERO and expects its container to supply the value.

`sherpa-container` and `sherpa-dialog` both do. `sherpa-panel` never did, so
every panel with a composed footer had its buttons flush against the card edge.
Will saw it three times before it was chased down, in three different places,
because the footer looked right everywhere a container held it.

The fix belongs on the CONTAINER, not on each footer: one `--_pad-inline` on
`:host`, and every composed chrome row inside inherits it.

**Before restyling a composed child from outside, check what it is asking its
parent for.** A component that reads a custom property is telling you where the
value belongs.

---
- Site: `src/components/sherpa-panel/sherpa-panel.css`
- Site: `src/components/sherpa-menu/sherpa-menu.css`
- Site: `src/components/sherpa-container-footer/sherpa-container-footer.css`
- Site: `test/e2e/reforged-container-footer.spec.ts`

### T-a-panel-chrome-row-never-shrinks

`sherpa-panel`'s `.header` and `.footer` are flex items in a column, and a flex
item's default `flex-shrink` is `1`.

So a long body SQUASHED the header: 85px of heading and search became 14px, and
the search field was pushed to x = −49, outside the panel. The BODY is what
scrolls; the chrome rows are fixed.

`flex: 0 0 auto` on both, and `overflow: auto` on the body.

---
- Site: `src/components/sherpa-panel/sherpa-panel.css`

### T-a-component-with-data-icon-draws-its-own

`upgradeIcons()` sweeps a stamped tree for `[data-icon]` and turns each match
into an SVG in an icon box. A `sherpa-*` ELEMENT with `data-icon` must be
skipped.

`data-icon` is `sherpa-container-header`'s own public API — the glyph it draws
beside its title. The sweep found the header itself, replaced its children with
an SVG and gave it `sherpa-icon-box`, which is `inline-flex` at 14px square. A
composed header collapsed to an icon and dropped the search field slotted
inside it.

Nothing errored. The header was still there, still 14px, and its content was
gone.

---
- Site: `src/core/ui/render-icon.ts`

### T-a-chip-menu-apply-is-the-panels-apply

Pressing Apply in a CHIP's own menu inside the filter panel is the panel
applying.

Group, Sort and Date are chips with popovers, so their footer Apply lands on
the menu rather than on the panel's own footer — and a reader who pressed Apply
expects the same thing to happen wherever they pressed it. The panel relays:
the chip's on/off follows the pick, an organise chip also reports its own
`group-change` or `sort-change`, and the field is REPORTED as any change is.
Since 2026-09-27 the panel has no footer (TODO 62): every change reports its
own field as it is made, so a chip menu's Apply is simply that field's change.

---
- Site: `src/components/sherpa-filter-panel/sherpa-filter-panel.ts`

### T-a-chip-menu-in-the-panel-commits

A FILTER menu drawn as a CHIP inside the filter panel gets `data-commit`. An
ARRANGEMENT does not.

Everything else in the panel waits for the panel's own Apply, so a date that
landed on every click would be the one filter that did not.

Group and Sort are the other half of the rule. They do not narrow the rows —
they say how the rows are laid out — and they apply as they are picked, on a
bar and in a panel alike. Forcing `data-commit` on them put an Apply button
under a radio list: the column ticked, the chip stayed off, and the table never
regrouped. `T-a-chip-knows-what-kind-it-is`.

It is the panel's to set, not the chip's: the same menu on a toolbar commits or
not by its own `select` mode. `T-commit-follows-select-mode`.

---
- Site: `src/components/sherpa-filter-panel/sherpa-filter-panel.ts`

### T-a-hidden-sibling-still-counts-as-first-child

`.sherpa-group` squares a run's inner corners by POSITION — `:first-child` and
`:last-child` — and a `display: none` child still holds its position.

The rule for any `.sherpa-group`: a control that is not there must not be in
the DOM, or the group states its ends per flag.

**A CONDITION ROW states BOTH ends.** Three of its five children are
conditional — the join is hidden on row one, the Remove on a lone row, and the
answer is a select or a text box — so neither `:first-child` nor `:last-child`
is the control a reader can see. The two ends are written out per flag rather
than left to position.

- Site: `src/components/sherpa-menu/sherpa-menu.css`

### T-an-accordion-chevron-rides-the-heading-row

`sherpa-accordion`'s summary row is `align-items: start`, not `center`.

Its titles are a COLUMN — a heading, a description, and whatever a host slots
under them — so centring put the chevron and the trailing actions halfway down
a two-row header instead of on the row that names the section.

The chevron keeps its OWN drawn size and centres itself within the heading's
line height. Setting `block-size` on it instead made it 20px and broke the
icon's own contract — `T-icon-box-is-not-the-glyph`.

---
- Site: `src/components/sherpa-accordion/sherpa-accordion.css`

### T-a-slotted-row-is-outside-its-own-popover

`sherpa-menu`'s card is `popover="manual"`, and the menu owns its own dismiss.

A native `popover="auto"` light-dismisses on a pointerdown OUTSIDE its own DOM
tree — and the menu's rows are SLOTTED. They RENDER inside the card, but in the
DOM they are children of `<sherpa-menu>`, a sibling of the popover. So ticking a
row was an outside click: the menu shut with nothing chosen.

`#onOutsidePointer` uses the COMPOSED path, which says what is really inside:
this element, its card, or the trigger that opened it. Escape is handled the
same way.

Measured with a deep hit test — `elementFromPoint` through every shadow root
returned the `input` itself, and the menu still closed.

---
- Site: `src/components/sherpa-menu/sherpa-menu.ts`
- Site: `src/components/sherpa-menu/sherpa-menu.html`

### T-a-click-in-a-slotted-menu-is-not-a-press

`sherpa-button` opens a `slot="menu"` child on click. That menu is a LIGHT-DOM
child, so every click inside it BUBBLES to the button — which read each one as
a second press and shut the menu.

So the button ignores a click whose composed path includes its menu. Half of
the "Add filter closes when I click a row" bug was here; the other half was
`T-a-slotted-row-is-outside-its-own-popover`, and each one alone still closed
the menu.

---
- Site: `src/components/sherpa-button/sherpa-button.ts`

### T-panel-mode-hides-what-the-panel-answers

`sherpa-quick-filter-toolbar[data-panel-mode]` hides AI, Reset and Add filter;
the provider takes its own panel switch out of the bar. A bar that is not
`data-type="view"` goes entirely.

A filter PANEL carries all of them: Add filter is each scope's own action, and
a component bar has nothing left once the panel draws its fields. Two of each
is two answers to one question, and a reader cannot tell which is in force.

The VIEW bar stays, because three chips never move into the panel — the View
selector is not a filter, and Customer and Region are global.
`T-the-view-chip-stays-on-the-header`.

---
- Site: `src/components/sherpa-quick-filter-toolbar/sherpa-quick-filter-toolbar.ts`
- Site: `src/components/sherpa-quick-filter-toolbar/sherpa-quick-filter-toolbar.css`
- Site: `src/components/sherpa-quick-filter-toolbar/sherpa-quick-filter-toolbar.html`
- Site: `src/components/sherpa-provider/sherpa-provider.ts`

### T-a-panel-flush-between-surfaces-draws-two-edges

`sherpa-panel` draws LEFT and RIGHT borders only — `border-block-style: none`
and `border-radius: 0` — because it is built to sit FLUSH between other in-flow
surfaces.

A filter panel is the other case: a standalone card beside the content. It
looked clipped top and bottom in every screenshot, and the border was never
being drawn at all. Three attempts went into "fixing" a clip that did not
exist.

Will: "Use a regular container instead of a panel and all this bs goes away."
He was right. `sherpa-container` is a card — four edges, rounding, header,
footer — and it supplies its composed footer's `--_pad-inline` already.

**Check what a surface component is FOR before restyling it into another one.**

---
- Site: `src/components/sherpa-filter-panel/sherpa-filter-panel.html`

### T-a-composed-child-hides-with-important

`display: none` on a COMPOSED child does nothing. Its own `:host` rule wins.

A component's shadow sheet styles its own host, and that beats a parent's
descendant rule on the same element — so `:host([data-inline]) .footer { display: none }`
read as applied and painted a footer, because `sherpa-container-footer` sets
`:host { display: none }` and `:host([data-has-content-slot]) { display: block }`
in its own sheet.

Nothing warns. `getComputedStyle` reports `block`, the rule is in the built
CSS, and the selector matches.

`display: none !important` is the honest answer, and it is the only place in
this repo that needs one. Any other property is fine — this is specific to
`display`, which a component must set on its own host to exist at all.

---
- Site: `src/components/sherpa-menu/sherpa-menu.css`

### T-only-group-and-sort-stay-one-chip

In a filter panel, GROUP and SORT are one chip with their own menu. Every
other field — single-select included — explodes into a run of value chips.

Will got here in two steps, and the second reverses the first. "Group and Sort
can still be chips… Actually, that's true for any single select chip" became "I
was wrong about single select filter menus. We need to explode them. It's just
group and sort that can be kept like regular filter chips."

The rule that holds: **the whole point of the panel is that a reader sees the
values without opening anything.** A filter field answers WHICH rows, and its
values are what the reader came for, however many they may pick. Group and Sort
answer HOW the rows are arranged — not a filter at all — and read as the two
controls a toolbar already shows.

So the split is by JOB, not by `select`. An Advanced field's rows go in the
accordion section too, in its own `.field-body`, replacing the chips.

---

 Site: `src/components/sherpa-filter-panel/sherpa-filter-panel.ts`
- Site: `test/e2e/reforged-filter-panel-component.spec.ts`
- Site: `src/components/sherpa-filter-panel/sherpa-filter-panel.ts`

### T-an-edge-resizes-its-box

**One helper resizes a box by its EDGE: `resizeByEdge` in
`src/core/ui/edge-resize.ts`.** The overlay panel's left edge had its own
drag and keys; the app shell's two panel areas needed the same (Will, TODO
146: *"Allow the side of the panel areas … to be dragged to resize like we
can do with the overlay panel"*). So it is ONE imported helper, never a base
class. The component says how wide the box is drawn and writes the width it
is asked for; its CSS owns the clamp, and the width written back is what the
clamp DREW, so a key moves from there.

- `grows` says which way the edge widens: the start area's edge is its end
  (+1), the end area's and the overlay panel's is their start (−1). A key
  moves the edge the way it points, so ArrowRight widens one and narrows the
  other. Home and End go to the clamp's ends.
- It states `aria-valuenow`, `aria-valuemin` and `aria-valuemax` — the old
  handle never said its range — and holds `data-dragging` while held, so the
  indicator stays when the pointer leaves the strip.
- Firefox THROWS on `setPointerCapture` for a pointer it did not start (a
  synthetic one), which ended the drag before it began: the capture is tried.

The shell's area: `flex` takes `--_asked-<side>` (the drag, or the host's
`data-panel-<side>-width`), `min-inline-size` its min (464px) and
`max-inline-size: 33%` of the row. The min wins where they cross: at 1280
33% of the row is 409px, so an area gives only from about 1446px wide. The
handle is in the area's own inset, so it is the AREA's edge, not the
panel's. The shell REPORTS on release (`panel-area-resize`); the example app
keeps the width in its session and hands it back.

- Site: `src/components/sherpa-app-shell/sherpa-app-shell.css`
- Site: `src/components/sherpa-app-shell/sherpa-app-shell.html`
- Site: `src/components/sherpa-app-shell/sherpa-app-shell.ts`
- Site: `src/components/sherpa-overlay-panel/sherpa-overlay-panel.ts`
- Site: `src/core/ui/edge-resize.ts`
- Site: `test/e2e/reforged-app-shell.spec.ts`

### T-the-shell-owns-the-panel-areas

`sherpa-app-shell` has `panel-start` and `panel-end` slots beside the Context.

A panel is APP CHROME: it survives a Context change, and where it sits beside
the content is the shell's question, not each Context template's. Before this
the filter panel lived inside `records.html`, wrapped in a `sherpa-stack` that
every other Context would have had to copy.

**An empty area takes NO room**, so a Context that slots neither is exactly as
it was.

**The panel carries the layout grid's own inset, the row does not.** `.sherpa-grid`
already applies `--sherpa-layout-grid-padding`, so padding the row insets the
Context twice — but the panel is not in that grid and has no inset of its own.
Without it the panel's top and bottom overshoot the cards beside it by 16 at
each end and its edges are cut by the frame, which is exactly what it looked
like: a clipped border.

**An area is THREE grid columns wide.** Will, 2026-09-26. Worked out in CSS
from the grid's own tokens — the column the body row would hold, `(100% − pad
− (cols − 1) × gap) / cols`, times three, plus two gutters and the area's own
inset — so the panel card measures exactly a 3-column card of the page with
the panel shut (294 / 374 / 454 at 1280 / 1600 / 1920). The Context keeps its
own grid in what is left: narrower, never re-counted. `--sherpa-panel-area-width`
still overrides it. It had been a 400px fallback, as the token was defined
nowhere.

**…and never under 464px** — Will, TODO 163: *"Increase the min width of panel
areas … to 150% of their current min width."* The area has no min of its own;
its narrowest is the 310px it is at 1280, where a panel first shows, and 150%
of that is 465, 464 on the 4px grid. So the card is 448 at 1280 and at 1600,
and the three columns take over near 1900. It is a MIN, not the width: the
first build multiplied the width at every size, and Will sent it back.
`--sherpa-panel-area-min-width` overrides it.

- Site: `src/components/sherpa-app-shell/sherpa-app-shell.css`
- Site: `src/components/sherpa-app-shell/sherpa-app-shell.html`
- Site: `src/components/sherpa-app-shell/sherpa-app-shell.ts`

---

### T-a-slotted-rows-css-follows-the-menu-not-the-chip

`sherpa-quick-filter-toolbar` clones rows into a chip's MENU — a number field's
input and slider, a range switch — and styled them `.chip .qf-number-*`.

That menu may be drawn somewhere else entirely: a filter panel borrows it. None
of those rules reached the panel, so a number field showed BOTH shapes at once
and the bare `<input type="number">` kept its native spinner beside the slider.

Two halves to the fix, because a slotted row is in nobody's shadow:

- the toolbar's rules DROP `.chip` — they belong to the rows, not to where the
  menu happens to sit;
- and the panel repeats the two `display` lines, because the toolbar's sheet is
  not shared and does not reach the panel's own shadow root.

`::slotted()` cannot close the gap: it matches a slotted element, never its
CHILDREN, and `.qf-number-one` is inside `.qf-number`.

---
- Site: `src/components/sherpa-filter-panel/sherpa-filter-panel.css`

### T-two-chips-in-one-section-need-their-own-id

The filter panel's Organise section holds TWO chips — Group by and Sort by —
because they answer one question and a header per control reads as noise.

Every other section holds ONE field, so the panel found a chip's `Held` by
asking which section CONTAINS it:

```ts
[...this.#held.values()].find((h) => h.values.contains(chip))
```

With two chips in one container that returns the FIRST every time. Measured:
picking a column in the SORT menu emitted `group-change`, and the grid grouped
by it. The Sort chip could not sort at all.

`#held` was right — `scope:group` and `scope:sort`, each with its own `def.id`.
Only the lookup was wrong.

The chip carries its id in `data-value`, so ask the chip and fall back to the
container test for everything else.

**A container test identifies a section, never a control.** It reads as correct
for as long as every section holds one thing.

- Site: `src/components/sherpa-filter-panel/sherpa-filter-panel.ts`

### T-an-organise-chip-is-named-for-its-job-not-its-field

Group and Sort chips are called `group` and `sort`. The COLUMN they arrange by
lives in their menu, and changes; the chip's own name does not.

The filter panel read a chip's field the way it reads every other one — from
the chip's own `data-value`. For these two that is the literal string `sort`,
so a body click reported `sort-change { field: 'sort' }` and the grid tried to
order by a column called "sort". Measured: `data-sort-field="sort"`.

The field comes from the MENU (`menu.values[0]`), falling back to whichever
option was drawn `selected`.

**And the BODY cycles.** A Group chip toggles; a Sort chip steps asc → desc →
suspended → asc, from `nextSort()` in the data layer, which the toolbar's chip
already used. The panel had no cycle at all: one click switched the sort off,
the next set it to the wrong field.

Suspended is not cleared — `setSort(null)` moves the column to the source's own
memory so one more click resumes it. TRAP T-grid-suspend-is-not-clear

- Site: `test/e2e/reforged-filter-panel-component.spec.ts`
- Site: `src/components/sherpa-quick-filter/sherpa-quick-filter.ts`

### T-a-wall-of-values-is-not-a-filter

A text column's heading menu lists the column's distinct values to tick, with a
search box above them. That is right for Status (4 values) and wrong for Email
(100): the search box only FINDS in the wall, it never filters the rows.

Measured on the running page — the search itself works, 101 rows down to 2 on
"aisha" — which is exactly why the bug was confusing. Will: *"The search input
in the email column filter doesn't work."* It worked; it just did not do what a
reader typing an address expects.

Such a column is answered by TYPING — `advanced: 'only'`, opening on
`contains`. See TRAP T-a-filter-answers-by-values-conditions-or-both for the
three states and how they are configured.

**The HOST decides**, never the grid: how many values is too many is a question
about the data. `../Sherpa Demos/app/contexts/records.js` has one rule, `PICKABLE_AT_MOST`,
read by the bar's Add menu AND by the grid's headings, so the same column can
never be a list in one place and a box in the other.

- Site: `test/e2e/reforged-data-grid.spec.ts`

### T-a-scope-is-a-place-not-a-reach

A SCOPE is a named place a filter lives — a header bar, a grid's bar, a panel
section. It is not how far a filter narrows; that is `reach`.
TRAP T-three-things-called-scope

It lives in the DATA LAYER because two controls must agree on it and **neither
may know the other exists**. Will, 2026-09-25: *"The Panel and Bar should not
be aware of each other. This is core to sherpa component agnosticism. The data
layer is the coordinator."*

Before this the panel searched the document for a toolbar, read its shadow root
and called `heldIds` on it. That is what `scope(name)` replaces.

`scopeOf(field)` is what SUPERSEDING is, said once: a field the `view` scope
holds is not the `data` bar's to narrow, and neither bar has to know the other
is there.

Two details that are easy to get wrong:

- **`hold()` on an unchanged list fires nothing.** A bar re-renders on
  `scope-change`, so a no-op that wakes it is a redraw loop waiting to happen.
- **`scope()` answers a COPY.** A caller that mutates the answer must not reach
  into the registry through it.

- Site: `src/core/data/data-source.ts`
- Site: `test/unit/scope-registry.test.mjs`

### T-the-fold-measures-a-chip-that-has-not-drawn-itself

`#reflow()` folds chips from the end until the run fits. The loop is correct
and complete — it cannot rest overflowing. So a bar that DOES rest overflowing
means a width changed after the last measurement.

It is the chips. A cloned `sherpa-quick-filter` stamps its own label and icon
on its first render, so a run measured at the end of `#render()` is narrower
than the run a reader sees. Measured in Firefox, a 300px bar:

    rest    50/48  folded=3      ← one chip short, two pixels over
    replay  48/48  folded=4      ← the same loop, 400ms later

`chip#active` is **50px in a 48px track**, and at reflow time it was not yet.

**Two frames after `rendered`, not one.** `rendered` resolving says the shadow
root exists; the first stamp lands in a later turn and its LAYOUT in the turn
after that. This is `T-a-rebuilt-bar-reads-empty-until-its-menus-stamp` in its
layout form, and it wants the same double `requestAnimationFrame`.

**Why it looked like a test flake.** It failed roughly one run in six, always
under parallel load, always as `rests overflowing: 50 > 48 (folded 3)`. The
test is right to use a plain wait rather than a loop that pumps frames until
the fold settles — that loop would have hidden this. 24 runs across three
browsers after the fix, no failures.

Two wrong theories are worth naming, because both were plausible and both were
measured away: the **font** (`T-the-fold-measures-whatever-font-is-loaded` —
`document.fonts.status` was `loaded` in the failing case), and the More chip's
**count badge**, which costs 20px but sits outside `.chips` and so changes its
`clientWidth` not at all.

- Site: `src/components/sherpa-quick-filter-toolbar/sherpa-quick-filter-toolbar.ts`
- Site: `test/e2e/reforged-quick-filter-toolbar.spec.ts`

### T-a-broken-assumption-reports

**A guard that expresses a DECISION stays silent. A guard that expresses a
BROKEN ASSUMPTION reports.** Never the reverse — a warning a reader cannot act
on is noise that hides the real one.

```ts
if (!this.#room) return;          // a DECISION. No room for the panel.
if (i < 0) return;                 // a FAULT. The caller named a filter that
                                   //          is not on this bar.
```

Measured across the filter family: **82 early returns**, and roughly a third
are the second kind. They returned early like the first, so a host that named
a field nothing offered got an empty screen and no explanation.

`src/core/data/report.ts` is the ONE channel:

| | |
|---|---|
| `report({ code, message, at })` | say that an assumption broke. Never throws |
| `onReport(fn)` | route it — a toast, a log, a test's array. Returns its undo |
| default | `console.warn('sherpa [code] message key=value')` |

**`console.warn` is the default, not the mechanism.** An app that cannot
intercept a warning cannot silence or forward one either.

**A broken SINK must not break the page.** The app asked to hear about a
problem; its handler throwing is a second problem, not this one's — so the
report falls through to the default and is still said.

**Every report names the thing.** *"A filter could not be drawn"* is not a bug
report; *"undrawable-filter scope=data id=ghost"* is.

**And `Report` is not `Issue`.** `validate.ts` already owns that word, where it
means a value a schema refused. This is a runtime assumption that broke.

A thrown error still means the CALLER made a mistake — `apply: a component
reach needs a key` is right to throw. A fault in the data or the DOM is
reported: an app should not crash because one chip lost its menu.

- Site: `src/core/data/report.ts`
- Site: `src/data.ts`
- Site: `src/core/data/data-source.ts`
- Site: `src/components/sherpa-quick-filter-toolbar/sherpa-quick-filter-toolbar.ts`
- Site: `src/components/sherpa-filter-panel/sherpa-filter-panel.ts`
- Site: `test/unit/a-broken-assumption-reports.test.mjs`
- Site: `test/e2e/reforged-a-broken-assumption-reports.spec.ts`
- Site: `src/core/ui/templater.ts`
- Site: `src/core/ui/saved-filter-menu.ts`

### T-a-bug-report-should-be-a-paste

`source.debugState()` returns everything the source thinks is true in one
JSON-safe object: rows, total, page, sort, group, search, filter, every
selection, every named part, every scope, every declared field, and what is
bound.

Measured when it was written: the whole of `src/` had **one** `console.error`
and three `console.warn`, against **55 silent `if (!x) return;`** in the filter
family and data layer alone. Three bug reports in one day cost an hour each and
were never reproduced — the system knew and had no way to say.

**It is also what a test should assert against.** Counting rows in the DOM is
how a page size of 25 made a working filter look broken, and a bug that did not
exist got reported. `debugState().total` is the number; `.row` elements are a
page of it.

DOM-free, like the rest of `sherpa-ui/data`, so a node test reads it.

- Site: `src/core/data/data-source.ts`
- Site: `test/unit/scope-registry.test.mjs`

### T-three-things-called-scope

One word was doing three unrelated jobs, and the third had no home at all:

| where | values | what it meant |
|---|---|---|
| `ApplyAt.scope` | `view` / `component` | how far a filter REACHES |
| `BindOptions.scope` | `page` / `all` | which ROWS a bound element is pushed |
| an app's own defs | `view` / `data` | WHICH SURFACE holds a filter |

The first two are renamed `reach` and `rows`. `scope` is left to mean the
third, which is Will's: *"Scoping of filters should live in the data layer."*

This is the same disease as `kind`, which meant the value type in one place and
the filter's kind in another until `kindOf()` settled it. A word that names two
axes will be read as the wrong one, and the reader will not know they did.

- Site: `src/core/data/data-source.ts`
- Site: `src/core/data/bind-selection.ts`
- Site: `test/unit/scope-registry.test.mjs`

### T-a-chip-knows-what-kind-it-is

Will, 2026-09-25: *"Group is a thing. Sort is a thing. Boolean filters are a
thing. Single select value filters are a thing. Multi select value filters are
a thing. Compound Conditional filters are a thing. **Organise is not.** It's
just a label on the screen."*

So a chip carries `data-kind` — what it IS — and owns the gesture that follows
from it: **group** toggles, **sort** cycles asc → desc → suspended → asc
through `nextSort()`. Both report by their own names. A container only places
the chip and, where it knows something the chip cannot, annotates the report:
the panel adds `scope`.

Before this the same behaviour was written twice, and the two drifted every
time one was touched — four bug reports in one day. Measured before the move:

| file | organise-aware lines |
|---|---|
| `sherpa-quick-filter-toolbar.ts` | 75 |
| `sherpa-filter-panel.ts` | 50 |
| `sherpa-quick-filter.ts` | **6** |

`data-organise` was the earlier name and it encoded the wrong idea — a chip
named for the heading a panel happened to draw above it.

A host that draws the choice as a run of options rather than a menu names the
column in `data-column`; a menu, where there is one, is the answer.

- Site: `src/components/sherpa-quick-filter/sherpa-quick-filter.ts`
- Site: `src/components/sherpa-quick-filter/sherpa-quick-filter.html`
- Site: `src/components/sherpa-quick-filter-toolbar/sherpa-quick-filter-toolbar.ts`
- Site: `src/components/sherpa-filter-panel/sherpa-filter-panel.ts`
- Site: `test/e2e/reforged-organise-chip-never-amber.spec.ts`
- Site: `test/e2e/reforged-filter-panel-component.spec.ts`
- Site: `src/core/ui/filter-kind.ts`
- Site: `test/unit/parity-sweep.test.mjs`

### T-off-is-not-forgotten

**Switching a chip OFF must never clear what it holds.** Off is a state; gone
is an instruction. Collapsing the two costs a reader their answer and makes the
chip impossible to switch back on.

It came back because TWO hosts painted the chip. `#syncSortLabel` kept the
column — *"a suspended sort keeps its column, so the caret still names it"* —
and `#syncGroupLabel`, four methods away, blanked it:

    target.valueLabel = chip.hasAttribute('data-current') ? column?.label ?? '' : '';

So Group forgot its column while Sort remembered, from one ternary.

The chip draws ITSELF now, from `data-current`, `data-direction` and its menu.
A host says what the state IS and never paints the caret or the glyph, so there
is no second opinion to disagree with. Both painters are deleted.

TRAP T-grid-suspend-is-not-clear is the same rule in the data layer.

**IT APPLIES TO EVERY CHIP, AND IT SHOWS THE VALUE.** Will, 2026-09-25:
*"An off chip should still show it's value. That applies to all chips
regardless of purpose. Value is only hidden when it is cleared to none/null."*

So a switched-off chip keeps its caret text and its count badge. Measured on
the running page, `plan` ticked Free and Pro and then switched off:

    ON   caret="Free…" count=2  bg #F2DFFF  border #C046FF   pages=2
    off  caret="Free…" count=2  bg #E8E8F6  border #B3B3C3   pages=4

The filter stops; the answer stays, and the two states are told apart by the
surface, not by hiding the value. An organise chip is the same rule: its caret
still names the column it would resume on.

- Site: `src/components/sherpa-quick-filter/sherpa-quick-filter.ts`
- Site: `test/e2e/reforged-quick-filter.spec.ts`
- Site: `src/components/sherpa-quick-filter/sherpa-quick-filter.html`

### T-a-conditions-only-menu-cannot-be-drilled

The Filters menu drills into a folded filter by MOVING that filter's light-DOM
rows into itself: `into.replaceChildren(...from.childNodes)`.

An advanced-only menu has no light-DOM children. Its answer is the condition
ROWS, which live in its own shadow DOM and are driven by `data-advanced-only`
and `data-mode` — attributes the Filters menu does not have. So drilling put a
blank card on screen.

Three reports, one cause. Will: *"Still can't open the menu from a conditional
filter chip in the toolbar"*, *"Seems like the Email filter doesn't get set to
active"*, and *"I entered a value into the Emails conditional inputs and clicked
apply but it had no effect on filtering the data."* It could never be answered,
so it never went active, so it never filtered.

Measured: the same chip driven directly works end to end — open, type, apply,
25 rows to 2. Only the FOLDED path failed, which is why it looked like three
bugs.

A menu with nothing to drill is SHOWN instead, anchored to the Filters button. The
rows are not the answer, so moving them is the wrong gesture. A saved filter's
card is shown there too: its rows are field MENUS, and moved into the Filters
menu their events were the Filters menu's.

- Site: `src/components/sherpa-quick-filter-toolbar/sherpa-quick-filter-toolbar.ts`
- Site: `test/e2e/reforged-quick-filter-toolbar.spec.ts`
- Site: `test/e2e/reforged-one-filters-button.spec.ts`

### T-a-filter-answers-by-values-conditions-or-both

A filter is answered three ways, and the field says which:

| `advanced` | the menu offers | for |
|---|---|---|
| absent / `false` | a list of values to tick | a closed set — Status, Plan |
| `true` | BOTH, with a switch between them | Owner: a short list, and "starts with" |
| `'only'` | the condition rows alone | a wall — 240 emails nobody ticks |

Will, 2026-09-25: *"We should be able to configure a filter to be default,
conditional, or both. I think it makes sense for Email data to always be a
conditional filter, only, that defaults to 'Contains'."*

ONE field, widened from a boolean, so nothing that already said `true` moved.
`op` says which condition it opens on. `sherpa-menu` takes it as
`data-advanced-only`, which IMPLIES `data-advanced`, forces
`data-mode="advanced"`, refuses to leave it, and hides the mode switch —
there is no list behind it. Its CSS rule must come AFTER the one that shows the
switch and be as specific, or the later rule wins and the button comes back.

This REPLACED a bespoke one-box body on the grid (`filter: 'text'`) written an
hour earlier. Two mechanisms for "this column is typed, not ticked" is one too
many, and the condition rows already do it better — an operator, and an
or-chain.

**The PANEL asks the same question.** It drew its Advanced button for any
truthy `advancedOf()`, and `'only'` is truthy — so Email showed a switch with
nothing behind it (Will, 2026-09-26). The switch is for `advanced === true` only.

- Site: `src/components/sherpa-filter-panel/sherpa-filter-panel.ts`
- Site: `src/components/sherpa-menu/sherpa-menu.ts`
- Site: `src/components/sherpa-menu/sherpa-menu.css`
- Site: `src/components/sherpa-menu/sherpa-menu.html`
- Site: `src/core/ui/filter-kind.ts`
- Site: `test/e2e/reforged-data-grid.spec.ts`
- Site: `test/e2e/reforged-filter-conditions.spec.ts`
- Site: `src/core/ui/filter-menu.ts`


### T-a-find-asks-its-host-to-step

**A Find cannot see what it searches, so it ASKS.** Will, TODO 136: *"a Find
input, that locates string matches and allows the user to jump to the
next/previous match using 2 stepper buttons."* `sherpa-input-text
data-type="find"` is the search field with two steppers; Previous, Next,
Enter and Shift+Enter send `find-step { direction, value }`, and — with
`data-replace` — the pencil's menu sends `find-replace { value,
replacement, all }`. The HOST moves the match: the grid's `findStep()`.

- **The search is published as NEEDLES** — `field:contains:term` on each
  field the source searches, `*` for every field — so a view marks what it
  found, as it marks a filter's condition. The grid adds `*` needles to every
  text column.
- **A step off the page's last match ASKS for the next page**
  (`page-change`) and lands on its first once it is drawn; before the first,
  the previous page's last — round from the end, as a browser's own find.
  Any redraw starts again at the first.
- **The replace menu sits OUTSIDE the field's `<label>`.** A click on a
  label's plain content activates its control: the focus left the
  replacement field for the Find field.
- **The replacement field's `input` and `change` stop at the menu.** They
  are composed, and reached the Find's host as its own.
- `data-matches="0"` — the host found none — makes the steppers and Replace
  inactive. Replace all opens a dialog first; only its confirm asks.

- Site: `src/components/sherpa-input-text/sherpa-input-text.ts`
- Site: `src/components/sherpa-input-text/sherpa-input-text.html`
- Site: `src/components/sherpa-input-text/sherpa-input-text.css`
- Site: `src/components/sherpa-data-grid/sherpa-data-grid.ts`
- Site: `src/components/sherpa-data-grid/sherpa-data-grid.css`
- Site: `src/core/data/data-source.ts`
- Site: `test/e2e/reforged-input-find.spec.ts`
### T-a-section-heading-is-not-a-field

The filter panel's `Organise` section holds Group and Sort. They share one
`.field-values` container, and each is `select: 'single'`, so the single-select
sweep — "one of many, untick the siblings" — cleared the OTHER control.

Will: *"if I deactivate Sort then Group is also deactivated and bugs out.
Group and Sort are still 2 separate filters, they're just organised under a
custom header called 'Organise'. Organise is not the field for the filters in
any way."*

It bugs out twice over: the grid stays grouped while the chip reads OFF, so the
next click on Group toggles it the wrong way.

The sweep now clears only chips that resolve to the SAME `Held` — the same
field. Two controls in one run have different `data-value`, so neither touches
the other.

- Site: `src/components/sherpa-filter-panel/sherpa-filter-panel.ts`
- Site: `test/e2e/reforged-filter-panel-component.spec.ts`

### T-an-external-chip-caret-must-open-its-condition

`addExternalFilter()` put a chip on the bar carrying a finished phrase —
"Contains: ana" — and set `data-menu` so the caret would draw and read it. It
never gave the chip a menu. Its own comment said so: *"no `options`, so no
menu — just a caret reading this."*

A caret that opens nothing is drawn exactly like every caret that does. Will:
*"When a conditional filter is applied, I can't open the filter chip menu in
the filter toolbar for that conditional filter."* Measured on the running page:
`col:name  menu=false  data-current data-menu data-full-value`.

`data-menu` cannot simply come off — the caret is where `valueLabel` writes the
phrase, so hiding it hides the filter. The caller names the CONDITION instead
(`op`, `text`), and the chip gets a real filter menu that opens on it. The
machinery was already there: `data-advanced`, `data-op`, `data-value`.

**And the colour half.** `sherpa-data-grid.#lightFilterChip` gave a
condition-answered column the `fx` glyph and left it in the plain active
purple, because nothing wrote the chip's condition. The glyph and the chip's
`data-condition` now come from the same `state.condition`. (The colour went
again in TODO 156: an Advanced chip is active, as a Simple one.)
TRAP T-a-conditioned-chip-reads-as-active

- Site: `src/components/sherpa-data-grid/sherpa-data-grid.ts`
- Site: `test/e2e/reforged-data-grid.spec.ts`

### T-a-condition-only-field-still-has-a-menu

A chip with no `options` is a TOGGLE — that is the rule, and it is right for
"At risk" or "Unassigned", which name no field.

But a chip with `advanced: true` names a field and answers it by TYPING. It
carries no options because nobody ticks 240 distinct emails; it still needs a
menu, and it was falling through to the toggle branch and getting none. So a
high-cardinality text column could not be filtered at all — it silently became
a switch that did nothing.

`kind: 'date'` and `kind: 'number'` were already exempt for the same reason:
their content is not a list of values either. `advanced` joins them.

This is what stopped `../Sherpa Demos/app/contexts/records.js` offering every column. It
had hand-listed four of fourteen, with hand-written slider bounds that drifted
from the rows; the list is now built from `columns`, minus whatever a scope
already holds, with a value list where the set is small enough to read and a
condition where it is not. The `allowFields()` whitelist still decides on top.

- Site: `src/components/sherpa-quick-filter-toolbar/sherpa-quick-filter-toolbar.ts`
- Site: `test/e2e/reforged-quick-filter-toolbar.spec.ts`

### T-one-query-builder-in-the-data-layer

A reading becomes a query in exactly ONE place: `stateClause()`, reached through
`apply()` or `select()`. Anything else is a second builder, and a second builder
does not know what the first learned.

`DataSource.#steer` had one. `quick-filter-change` ran a private
`filterFromChips()` that turned `{ field: [values] }` into `in` clauses — no
field type, so a number column compared as text; no range, so two picks on a
slider meant a LIST; no conditions at all. Every fix to `stateClause` missed it.

Worse, both it and the grid's `filter-change` called **`setFilter()`**, which
replaces the WHOLE query — so typing in one column heading wiped every chip's
selection and every component contribution.

The proof it was dead weight: `../Sherpa Demos/app/contexts/records.js` had to switch it
off, twice, with `ignore: ['quick-filter-change']` and `ignore: ['filter-change']`.
An app working around the data layer is the data layer being wrong.

Both now go through the one door. A control with a `readings` getter is ASKED
for it; one without has its `{ field: [values] }` read as READINGS, never as a
clause. `picksClause` then had no callers left in `data-source.ts` at all.

**The shape, stated once:** UI takes input → sends parameters to the data layer
→ the data layer transforms → it publishes a data change → UI reads the new
data back. Transforming never writes to the raw rows; only create, update and
remove do. `test/unit/raw-data-is-untouched.test.mjs` holds that half.

- Site: `src/core/data/data-source.ts`
- Site: `test/unit/raw-data-is-untouched.test.mjs`
- Site: `test/unit/one-query-builder.test.mjs`
- Site: `test/reforged/harness.html`

### T-an-organise-chip-has-no-values

`data-empty` means ON BUT FILTERING NOTHING, and `state-pins.yaml` paints
`[data-current][data-empty]` AMBER. An organise chip never filters, so the
question does not apply to it — but it IS a `sherpa-quick-filter` with a menu,
and that menu picks a COLUMN. `menu.values` reads ticked inputs, so a Sort chip
with no column chosen reports zero values and the chip is judged empty.

Will, three times: *"Still seeing weird warning status styling being applied to
chips randomly"*, then *"I loaded the page, removed a data grid filter from the
panel, and the sort chip got a yellow border applied."*

The trigger is that `data-current` has **26 writers outside the chip** — 16 in
the toolbar, 10 in the panel — and only `#toggleGroup` checked the menu first.
`#cycleSort` did not: with no column, `nextSort('', '', 'asc')` answers `desc`,
so the chip lit up sorting by nothing. Any of the other 24 can do the same.

Chasing the writers is the wrong fix; there is a 27th tomorrow. The chip is
marked `data-organise` where it is BUILT, and the empty test skips it the way
it already skips `data-persistent` and `data-locked`.

- Site: `src/components/sherpa-quick-filter/sherpa-quick-filter.ts`
- Site: `test/e2e/reforged-organise-chip-never-amber.spec.ts`

### T-the-add-menu-is-the-whole-list

A filter panel's scope had an Add menu of what was LEFT to add, and a bin icon
on every field row. Two controls, two places, one question.

The Add menu is the whole list instead: every filter the scope can hold, with
the held ones ticked. Ticking a row adds it; unticking removes it. What changed
is the difference between what the menu now says and what the panel is drawing,
so a reader never hunts for where a filter is removed.

**The TOOLBAR now does this too.** Its Add menu listed only what was LEFT to
add, so a tick added a chip and nothing took one off, and the menu said nothing
about what the bar was already holding. Will: *"Add filter button, in the
toolbar, doesn't have the add and remove capability. Menu item selection state
should indicate whether the filter is added or removed from the chip row."*

One catch: `populate()` is DEFERRED, so a host calling `available()` straight
after it built the menu from an empty run and nothing was ticked. The menu is
rebuilt at the end of `#render()`, because what it lists now follows the run.

Only a REMOVABLE field is listed. A scope's own fixed filters stay off the menu
— a tick that cannot be cleared is a lie, and disabling it would say the same
thing more quietly.

The TOOLBAR's chip menus keep their own Remove in the footer. A chip is the
filter, so removing it from its own menu is where a reader looks; the panel is
a list of them, so the list is where they are managed. Will's ruling
2026-09-24.

- Site: `src/components/sherpa-filter-panel/sherpa-filter-panel.ts`
- Site: `test/e2e/reforged-filter-panel-component.spec.ts`
- Site: `src/components/sherpa-quick-filter-toolbar/sherpa-quick-filter-toolbar.ts`
- Site: `test/e2e/reforged-quick-filter-toolbar.spec.ts`
- Site: `src/core/ui/filters-button.ts`
- Site: `src/components/sherpa-filter-panel/sherpa-filter-panel.html`

### T-the-field-type-decides-the-clause

The data layer had no idea what KIND a field was. `OPS_FOR_TYPE` named three
(`text`, `number`, `date`) and the grid passed a column's type into its own
builder, but `DataSource` held none — so it could not know that two picks on
`seats` mean a RANGE rather than two equalities.

Every app then had to know it. `../Sherpa Demos/app/contexts/records.js` carried a
`numberFields` set, a `dateFields` set, and 20 lines turning picks into
`between` / `eq Number(x)`. That one gap grew **three** query builders:
`stateClause`, the grid's `#columnClause`, and the app's `filterFromChips`.

`declareField(field, { type, label })` closes it, and three rules move into the
data layer where they belong:

- **Two picks are a range.** A number sorts NUMERICALLY — as text, `["1000","9"]`
  puts 1000 first and the range matches nothing.
- **A range field has no value LIST.** Its picks ARE its values, so `fieldState`
  reads them from the reading rather than a declared domain, and a number field
  no longer reads as `off` for having nothing ticked.
- **Conditions answer a field.** `select()` deleted a reading whose only answer
  was condition rows — no picks, no typed text — so an or-chain built in a menu
  never applied at all. That is why conditions travelled by a separate road.

**A UI sends parameters; it never builds a query.** If a component needs to know
a field's type to filter it, the type is in the wrong place.

- Site: `src/core/data/filter-state.ts`
- Site: `src/core/data/data-source.ts`
- Site: `test/unit/field-type.test.mjs`
- Site: `src/data.ts`
- Site: `src/components/sherpa-quick-filter-toolbar/sherpa-quick-filter-toolbar.ts`
- Site: `src/components/sherpa-data-grid/sherpa-data-grid.ts`

### T-the-panel-reports-its-own-reading

The filter panel reports WHAT THE READER DID — picked values and conditions —
and the data layer decides what it means. It does not ask another component,
and it does not reach into one.

**This replaces `T-the-panel-asks-the-bar-it-does-not-answer-for-it`, which was
half right.** That one correctly said the panel must not DERIVE a second
answer, then prescribed the wrong cure: ask the toolbar. So the panel grew
`#barOf` (a `document.querySelectorAll` for a toolbar), `#chipOf` (a reach into
its shadow root), `#bars()`, and `#markConditioned` — which ticked the BAR's
chips so the bar's own `readings` would see the panel's conditions — and then
called `bar.report()` to make it re-emit.

Will, 2026-09-25: *"The Panel and Bar should not be aware of each other. This
is core to sherpa component agnosticism. The data layer is the coordinator."*

`values` was ticks only, which is why the fix-up existed: a field in CONDITION
mode has no ticked chips, so Apply committed nothing. The panel has `readings`
now — picked, conditions and typed text, per scope and field — so there is
nothing left to fix up. All four reaching methods are deleted, and neither
component names the other.

- Site: `src/components/sherpa-filter-panel/sherpa-filter-panel.ts`
- Site: `test/unit/parity-sweep.test.mjs`
- Site: `test/e2e/reforged-filter-panel-component.spec.ts`
- Site: `src/core/data/data-source.ts`

### T-closest-stops-at-the-shadow-boundary

`Element.closest()` walks `parentElement`, and a shadow root is not one. A walk
that starts inside a component's shadow DOM stops at the shadow root and
returns `null` — it never reaches the host, let alone the host's ancestors.

Measured: the filter panel looked for a chip's toolbar with
`chip.closest('sherpa-quick-filter-toolbar')`. The chip is in the toolbar's own
shadow root, so the call returned `null` every time, and nothing downstream ran.

A root walk crosses it — at each step, a `ShadowRoot` hands over its `host`:

```ts
node = node instanceof ShadowRoot ? node.host : node.parentNode;
```

`composedPath()` does the same job for an EVENT. `closest()` is correct only
inside one tree.

- Site: `src/core/ui/sherpa-element.ts`

### T-a-borrowed-menu-is-still-its-chips

`sherpa-quick-filter.menu` was `this.querySelector('[slot="menu"]')`.

A filter panel BORROWS the menu: it strips the `slot` and appends the element
somewhere else entirely. The query then found nothing, so the chip reported no
values and no conditions — while its menu was on screen, answered, in the
panel.

The chip remembers the menu when it first sees it, and returns the remembered
one while it is still connected. A menu that has genuinely gone still reads as
`null`.

- Site: `src/components/sherpa-quick-filter/sherpa-quick-filter.ts`

### T-two-conditions-over-one-field-are-alternatives

A second condition row defaulted its join to `and`. Over ONE field that matches
nothing, always: `owner eq Dana AND owner eq Ravi` has no rows, and a reader
who added a row to widen their filter watched the grid empty.

Measured: `["and", ["owner","eq","Dana Whitlock"], ["owner","eq","Ravi Menon"]]`
→ 0 rows. With `or` → 25 rows over 2 pages.

`#seedFromPicks` already knew this — carrying ticked values into condition mode
joins them with `or`. Only a row the READER added disagreed, so the same two
values meant different things depending on how they got there.

`and` is still there to be chosen, and it is the right answer for ranges
(`> 10 AND < 50`). It is the wrong DEFAULT.

- Site: `src/components/sherpa-menu/sherpa-menu.ts`

### T-a-borrowed-menu-leaves-its-toolbars-listeners-behind

`sherpa-filter-panel` BORROWS a chip's own `<sherpa-menu>` and appends it into
a field body. The menu is then genuinely out of the toolbar's tree — measured,
a click on its range switch has the composed path
`SHERPA-SWITCH → SHERPA-MENU → SHERPA-FILTER-PANEL → SHERPA-APP-SHELL`, and
`bar.contains(menu)` is `false` for every bar on the page.

So every listener the toolbar bound on ITSELF goes silent for that menu. The
Range switch was the visible one: flipping it changed nothing, with no error.

**Bind on the MENU for anything a borrowed menu owns.** The listener travels
with the element, so the rule keeps working wherever the menu is drawn, and the
toolbar still owns the rule.

The same move fixes the reads inside those handlers: `sw.closest('.chip')`
found nothing once borrowed, so the chip's id is written onto the menu
(`data-chip-id`) while it is still on its chip, and read from there.

A listener on the bar is correct for anything the CHIPS fire — they never move.
It is wrong for a menu.

- Site: `src/components/sherpa-menu/sherpa-menu.ts`

**FIXED STRUCTURALLY, 2026-09-25.** The Range switch was the last host-bound
listener on a borrowable menu; `sherpa-menu` owns it now, so there is nothing
left for a borrow to strand. TRAP T-a-menu-owns-its-own-bodies

### T-an-fr-track-floors-at-min-content

An `fr` track does NOT shrink to zero. Its floor is `auto`, which is the
content's min-content width — so a row of `2fr 3fr auto` in a box narrower than
that content overflows the box rather than squeezing.

Measured on a two-row condition layout in the filter panel: the rows box had
`clientWidth 294` and `scrollWidth 378`, and the 16px Remove button was simply
clipped off the end. Nothing scrolled and nothing reported an error.

`minmax(0, 2fr)` sets the floor to zero, and each child needs
`min-inline-size: 0` for the same reason one level down — a `<select>` or an
`<input>` has its own intrinsic minimum.

**A grid that must fit needs both.** The track's floor and the item's floor are
two separate defaults, and fixing one alone still overflows.

- Site: `src/components/sherpa-menu/sherpa-menu.css`

### T-an-inline-condition-row-keeps-its-tracks

A condition row inline keeps the TOOLBAR's grouped tracks. The first fix here
stacked it one control per line, and that was the wrong answer to a real
measurement.

The measurement: the row had 214px and its second track collapsed to zero, so
the value select drew nothing but a caret. The reading was "a panel column is
too narrow". The CAUSE was elsewhere — `.field` is a two-column grid,
`1fr auto`, and the ACTIONS column took 80 of the field's 294px. The body was
never the column's width; it was the column minus the buttons.

So the host gives the rows the whole column instead: in condition mode `.field`
puts the actions on the LABEL row and spans the body across both tracks. The
row gets 294px, the `fr` tracks narrow, and the four controls stay one grouped
object exactly as they are in the chip menu.

**A collapsed track is a width problem, and the width is rarely where you are
looking.** Measure the CHAIN — the row, its body, its box — not just the row.

- Site: `src/components/sherpa-menu/sherpa-menu.css`
- Site: `src/components/sherpa-filter-panel/sherpa-filter-panel.css`

### T-an-inline-menu-drops-the-chrome-its-host-owns

`sherpa-menu[data-inline]` hides its `use-condition` button and its footer.

Inline, the menu is inside something that already has both: a filter panel's
FIELD HEADER carries the list/condition switch, and the panel has ONE footer
whose Apply commits every field at once. A second of each is two answers to one
question, and a reader cannot tell which Apply applies.

The MENU owns the rule, not the host. Inline is the menu's own mode, so what it
drops in that mode is its own business — a host reaching in with `::part` would
have to repeat the list everywhere it draws one.

---
- Site: `src/components/sherpa-menu/sherpa-menu.css`

### T-an-inline-menu-is-the-same-menu

`sherpa-menu[data-inline]` is the same card, drawn in the FLOW instead of the
top layer.

A filter PANEL has to show a field's condition rows, its number input, its
range switch and its slider — every one of which the MENU already owns. Drawing
a second copy of each means the next fix to either one has to be made twice.

So the panel builds a `sherpa-menu` like everyone else and flags it inline.
`data-inline` undoes the four things the floating card needs:

| | |
|---|---|
| the `popover` attribute | REMOVED, so `:popover-open` never matches |
| `display` | `flex`, since the UA no longer shows it |
| `position` | `static` — `fixed` plus viewport coordinates put it at 0,0 |
| the card's own edges | no border, no padding, no shadow: it is PART of the panel now |

`show()` and `hide()` become no-ops: there is nothing to open, and nothing to
place.

The attribute is in the TEMPLATE, so `#syncInline` REMOVES it rather than never
writing it — and putting it back restores the floating card, which is how one
element serves a chip and a panel.

- Site: `src/core/ui/filter-menu.ts`
- Site: `src/components/sherpa-menu/sherpa-menu.ts`
- Site: `src/components/sherpa-filter-panel/sherpa-filter-panel.ts`
- Site: `src/components/sherpa-menu/sherpa-menu.css`
- Site: `src/components/sherpa-filter-panel/sherpa-filter-panel.css`
- Site: `src/components/sherpa-menu/sherpa-menu.html`
- Site: `src/components/sherpa-filter-panel/sherpa-filter-panel.html`
- Site: `test/e2e/reforged-filter-panel-component.spec.ts`
- Site: `src/core/ui/saved-filter-menu.ts`

### T-a-percentage-floor-needs-a-definite-parent

`minmax(min(var(--_plot-height), 100%), 1fr)` in `sherpa-barchart.css` reads as
"180px, but yield when the host is shorter". In a host with NO height it
collapses the plot to nothing.

A percentage inside a track sizing function resolves against the grid
container's block size. When that size is indefinite — the normal case for a
chart dropped into a page — the percentage cannot resolve, the `min()` falls to
zero, and the 180px floor is gone.

Measured: a `sherpa-barchart` with only `inline-size: 400px` set was **35px
tall**, plot 23px, bars 13px. The only test that caught it was a TOOLTIP test,
which failed on "the tip sits above the bar" because there was no room above
the bar. Nothing in the chart suite noticed the chart had no height.

A BARE floor is wrong too. It cannot shrink, so the Records card (225px host,
one row shorter than the Dashboard's) drew its x-axis labels over the legend:
the `.chart-body` box shrank to 145px, but its 180px row overflowed it.

The fix is a flex BASIS, not a track floor. `.chart-body` takes
`flex: 1 1 <plot + x-axis row>` and rows `minmax(0, 1fr) auto`. A basis is the
natural size: an unsized host gets it in full, a short host shrinks it, a tall
one grows it. Measured the same in Chromium, Firefox and WebKit.

A grid item has no flex basis, so the VERTICAL-legend mode (the host is a grid)
keeps the bare floor. Without it, that chart falls to a 3px plot.

- Site: `src/components/sherpa-barchart/sherpa-barchart.css`
- Site: `test/e2e/reforged-chart-tooltips.spec.ts`
- Site: `test/e2e/reforged-chart-legend-slot.spec.ts`

### T-a-filter-report-is-the-whole-answer

`quick-filter-change` is a control saying what it now filters by — ALL of it,
not a delta. A field it answered last time and does not name now has been
turned off, and the source clears it.

`apply()` alone cannot do this: it walks the readings it was given, so
`apply({})` changed nothing. Two tests caught it —

    chips({})   →  rows 1 of 8, and `data-filter-fields` still "plan region"

— a reader who cleared every chip and watched the table stay filtered.

The clearing is per BOUND COMPONENT. `#bound` remembers the field set each
control last reported, so two bars over one source each clear only their own
fields; a view bar reporting three fields never wipes the grid bar's two.

The alternative — clearing every field the source holds — is the bug this
avoids, and it only shows up with two controls on one page.

A bar bound with a `scope` (or a host calling `source.answer(scope, …)`) is
that scope's whole answer instead: it clears the readings that LIVE in its
scope. So a field raised to the View — whose answer moves with it — is no
longer the grid bar's to clear, and the bar's next report cannot wipe it.

- Site: `src/core/data/data-source.ts`
- Site: `test/e2e/reforged-data-source.spec.ts`

### T-a-group-is-a-data-layer-concept

A GROUP is a data concept, exactly as a data PAGE is. The grid draws one and
collapses it; that does not make the grid its owner.

Will, 2026-09-25: *"Is a group just a sort with no direction? It's also an
association of data records by a value… what if we want to do something with
the group as a whole? There's no object or single entity to reference."* He was
right. `applyOptions` turned `group: 'customer'` into a leading `SortSpec` and
handed the view flat rows (`T-pipeline-order-and-no-grouping`). The only group
that existed anywhere was a `<tr data-group-key>` the grid built while walking
those rows, counting with a filter over whatever rows it held.

So nothing outside that grid could name a group, ask how many there were, or
act on one — and a paged grid's count was a page count.

`DataSource.groups(field?)` answers it: `{ key, value, count }` per group, over
every MATCHING row rather than the page. `groupSummaries(rows, field)` is the
same answer for a caller with rows and no source. The grid takes `groups` in
`populate()` and falls back to counting only when nobody told it — which is a
grid populated by hand, with no source behind it.

**The split is the one paging already uses.** Will: *"It's similar to Paging.
There are data pages and data grid visual pages."* The store counts RECORDS;
the grid pages SCREEN LINES and reports that back
(`T-grouped-paging-belongs-to-the-view`). Groups divide the same way: the data
layer says which groups exist and how big they are, the grid decides which
headings fit on screen and which are shut.

Measured on the running page, grouped by Plan: the source named four groups —
Enterprise 24, Free 25, Pro 24, Starter 27 — and the grid drew the one that
fitted its visual page, carrying the source's count of 24.

**A count is of the rows SHOWN** (Will, TODO 165). Two ways it was not. The
source counted from `#allRows` whenever a summary was bound beside the grid —
and those are the VIEW's rows, without the grid's own scope
(`T-only-the-view-trickles-down`) — so a filter on the Records bar left every
badge at its total. Now `groups()` counts the load itself, which is whole
whenever it is grouped or unpaged, and turns to `#allRows` only for a page.
And the grid's own FILTER ROW hides rows the data layer never hears of: while
it holds a filter, the grid counts what it shows.

- Site: `src/core/data/store.ts`
- Site: `src/core/data/data-source.ts`
- Site: `src/components/sherpa-data-grid/sherpa-data-grid.ts`
- Site: `test/unit/groups-are-a-data-concept.test.mjs`
- Site: `src/components/sherpa-provider/sherpa-provider.ts`
- Site: `test/unit/parity-sweep.test.mjs`

### T-a-panel-builds-its-own-menus

A second view of a field builds its OWN `<sherpa-menu>`. It never takes the
first view's.

The filter panel used to BORROW the toolbar's menu — move the element into its
own field body and give it back on close. One element in two places looks like
the strongest possible guarantee that the two agree. It cost six bugs:

| what broke | why |
|---|---|
| the chip lost its menu | the panel was holding it |
| Sort's cycle died | `column` reads the ticked row of a menu that was away |
| a field became a PRESET | the host read the bar, found no menu, and `menu: undefined` reads as "no field" |
| a second Presets section, then a third | every redraw repeated it |
| the range toggle was dead | the listener was bound on the toolbar, not the moved element |
| Close left the toolbars menuless | three ways out gave the menu back; the reader's own Close did not |

Every one is the same mistake: an element has ONE parent, so moving it is a
change to the component it came from.

`menuFor(def)` in `src/core/ui/filter-menu.ts` is the one place a filter
definition becomes a menu, so a bar, a panel and a column heading draw the same
control without sharing the same element. What they DO share is the answer:
`toolbar.held` hands over each def with the reading in force, and the panel
seeds its own menu from that.

- Site: `src/core/ui/filter-menu.ts`
- Site: `src/components/sherpa-filter-panel/sherpa-filter-panel.ts`
- Site: `src/components/sherpa-quick-filter-toolbar/sherpa-quick-filter-toolbar.ts`
- Site: `test/e2e/reforged-filter-panel-component.spec.ts`

### T-the-panel-is-the-toolbar-in-a-column

A filter PANEL shows the same filters the toolbars hold, laid out as a column.
It is not a second filter system, and it draws nothing of its own.

One accordion per SCOPE. Inside each, a field is a `sherpa-section-header` with
Clear and Remove in its `actions` slot, above a wrapping run of boolean chips —
one per value. ONE search and ONE footer for the whole panel: Apply commits
every field at once, Discard reverts to the last Apply.

**`chip.values =` is a SILENT write.** It ticks the menu's rows and nothing
downstream hears, so Apply also fires `menu-change` — the same event a reader
clicking Apply in the menu's own footer would fire.

**A field with NO VALUE ROWS is not drawn.** A date or a number range is not a
set of chips, and there is nothing honest to show for it, so it keeps its chip
on the toolbar.

**Everything is COMPOSED.** The first build hand-rolled five `<div>`s and sixty
lines of CSS for the heading rows, the value runs and the gaps. Will: "Use the
sherpa components. That's the whole point of sherpa." What is left in the
example's own `<style>` is only what no component owns: a search that HIDES a
chip, and the gap between two composed stacks.

**The panel sits OUTSIDE the layout grid**, in an inline `sherpa-stack`.
`data-col-span="full"` is a hardcoded `span 12` per breakpoint, so a `full`
child cannot know a sibling column is beside it — the records card sat straight
under the panel. Narrowing the GRID's own box is what makes `full` mean full.

---
- Site: `src/components/sherpa-filter-panel/sherpa-filter-panel.ts`
- Site: `src/components/sherpa-filter-panel/sherpa-filter-panel.html`
- Site: `test/e2e/reforged-filter-panel-component.spec.ts`

### T-the-view-chip-stays-on-the-header

One chip is never drawn in the filter panel: `view`. It is not a filter at
all — it is what the filters apply WITHIN.

`customer` and `region` stayed on the header too, as GLOBAL filters, until
Will, 2026-09-26: *"Let's move the Customer and Region filters to the View
scope in the filter panel."* They are in its View filters now.

Every OTHER field the panel draws is hidden on its bar (`data-panelled`,
written by the host). Two controls over one field make a reader guess which is
in force — the same reason there is no Region chip on the records bar.

`data-panelled` is plain `display: none`, unlike `data-folded-away`: a folded
chip's MENU is still live as a submenu, and a menu in a `display: none` host
measures 0×0 and lands in the viewport corner. A panelled chip's menu is not in
use at all, because the panel draws value chips rather than the menu.

---
- Site: `src/components/sherpa-quick-filter/sherpa-quick-filter.ts`
- Site: `src/components/sherpa-quick-filter-toolbar/sherpa-quick-filter-toolbar.css`
- Site: `src/components/sherpa-quick-filter/sherpa-quick-filter.html`

### T-the-panel-is-desktop-only

**A panel area needs ROOM: the Context beside it keeps a tablet's width
(768px).** So the shell's body must hold 768 plus the area's min (464) —
1232px. Filtering goes back to the toolbars where it does not, which is what
they are for.

**The SHELL measures it, by its own body** — TODO 146, level 1. The panel used
to measure the WINDOW (`matchMedia`, 1280). A pinned nav takes 320px of the
window, so at 1280 the panel still showed and left the Context 496px. Now
`sherpa-app-shell` watches `.body` (a `ResizeObserver`), hides both areas
under `data-no-room`, and reports `panel-room-change`. The PROVIDER owns the
mode, so it shuts the panel (`hide('width')` — not a choice) and gives it back
when there is room and the reader still wants it. A panel with no shell
around it has no width rule: that is its host's to say.

While Settings is open the nav is wide, but the overlay covers the Context:
the shell ignores the room then, or leaving Settings would shut and reopen
the panel under it.

- Site: `src/components/sherpa-app-shell/sherpa-app-shell.ts`
- Site: `src/components/sherpa-app-shell/sherpa-app-shell.css`
- Site: `src/components/sherpa-provider/sherpa-provider.ts`
- Site: `src/components/sherpa-filter-panel/sherpa-filter-panel.ts`
- Site: `src/components/sherpa-filter-panel/sherpa-filter-panel.html`

### T-a-conditioned-chip-answers-with-its-clause

A chip in CONDITION mode has NO ticked values, so `values` says nothing about
it — and a host that reads `values` alone will clear the field from that
silence.

The records handler loops every field chip and, finding nothing in `values`,
called `select(field, [])`. Measured: `data-current` was **true** when
`condition-change` fired and **false** one microtask later, because the host
had answered the event by clearing the very field the chip was filtering.

So the host skips a field whose CLAUSE is present:

```js
const clauses = e.detail.clauses ?? {};
for (const field of FIELD_CHIPS) {
  if (clauses[field]) continue;   // the clause IS the answer
  ...
}
```

And `pushChips` then has to let that clause RIDE, because nothing else carries
it — a field chip's clause is normally stripped there, since `select()` owns
it. A chip answering with TICKS is still stripped: its picks and its clause
would AND into `eq Pro` AND `eq Free`, which matches nothing.

The two halves are one rule, and half of it is silently wrong: skipping the
clear without letting the clause ride gives a lit chip that filters nothing.

**And the toolbar's `states` getter has to read the rows.** It built its
`fieldState` from `op` and `text` only, so `stateClause` saw no conditions and
returned nothing — a chip full of answered rows reported an EMPTY clause. That
one is the quietest of the three: the chip looks right, the badge is right, the
menu is right, and the grid does not move.

- Site: `src/core/data/data-source.ts`
- Site: `src/components/sherpa-quick-filter-toolbar/sherpa-quick-filter-toolbar.ts`

---
- Site: `test/e2e/reforged-filter-conditions.spec.ts`

### T-a-conditioned-chip-reads-as-active

A chip answering with CONDITIONS wears the ACTIVE mode, as a chip answering
with ticks does. It takes NO colour of its own — Will, 2026-09-30, TODO 156:
"use the default active styling for advanced filters instead of diverging to
use the info styling." It was info, then success (2026-09-26), then info
again (138), each for a day.

So there is no state pin and no CSS for `data-condition`. The attribute stays,
because three things still read it:

- a grid heading shows the `fx` glyph for an Advanced column;
- an Advanced chip is never `data-empty` — a condition is an answer, so the
  amber "on but filtering by nothing" warning would be a lie;
- a test can ask which kind a chip is.

**Which one a chip is, is the STATE's to say** — `state.condition`, see
`T-one-condition-system`. `data-condition` is written by the chip in
`#syncCondition`.

The same colour runs through to the cells: a `mark.match` in the grid is
`--sherpa-style-active-border-base-1`, so a reader follows ONE colour from the
chip that found the match to the text it matched. Change one, change the
other.

- Site: `src/components/sherpa-quick-filter/sherpa-quick-filter.html`
- Site: `src/components/sherpa-quick-filter/sherpa-quick-filter.ts`
- Site: `src/components/sherpa-data-grid/sherpa-data-grid.css`
- Site: `src/components/sherpa-data-grid/sherpa-data-grid.ts`
- Site: `test/e2e/reforged-one-condition-system.spec.ts`

---

### T-a-new-chip-opens-in-default-not-warning

A chip added from the Add menu arrives OFF.

It used to arrive `active: true`, "so the reason you added it is visible
immediately". But a chip on with no values is exactly the state
`data-empty` paints AMBER — so the reader pressed Add, got what they asked
for, and was shown a warning about it.

They add the chip, then answer it. The chip lights when it has an answer.

- Site: `src/components/sherpa-quick-filter-toolbar/sherpa-quick-filter-toolbar.ts`
- Site: `test/e2e/reforged-quick-filter-toolbar.spec.ts`

---

### T-a-rebuilt-bar-reads-empty-until-its-menus-stamp

`#render()` rebuilds every chip, and a rebuilt bar reads `values: {}` for one
tick — on a bar full of ticked rows.

`items()` on a freshly cloned `<sherpa-menu>` stamps NOTHING. The element has
no shadow template until it upgrades, so `#stampItems` returns early, keeps the
list, and stamps at `onRender`. `#flushItems()` runs inside `#render`, but the
stamping it triggers has not happened when `#render` returns.

So `#removeFilter` emitted `quick-filter-change` with `values: {}` and
`picked: {}`. The host answered it the only way it could — `select(field, [])`
for every field — and the reader watched every OTHER filter on the bar clear
itself because they took ONE chip off.

Measured: capture said `status on=true picks=active`, the write said
`write status prior=true`, and the emit said `values={}`. Every step was
right; only the ORDER was wrong.

`#settled()` awaits each chip's `rendered` and then each menu's, and
`#removeFilter` / `#addFilters` emit through it. The bug is silent, it looks
like a filter reset, and nothing in the remove path is wrong on its own.

**The same fact bites a RELOAD.** A reader who left the filter panel open
loads the page, the bars populate, and a restore in a `queueMicrotask` reads
chips with no menus — so the panel drew menu bodies instead of chips in every
section. Measured: `[["status",0,true],["plan",0,true]]` — zero chips, menu
drawn. Wait TWO frames; one is not enough, because the upgrade and the first
stamp land in different turns.

```js
await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
```

After: `[["status",4,false],["plan",4,false],["tier",4,false],["owner",4,false]]`.

- Site: `src/components/sherpa-quick-filter-toolbar/sherpa-quick-filter-toolbar.ts`

---

**AND THE AMBER WARNING RIDES ON IT.** A chip that is ON while its menu holds
no values is the contradiction `state-pins.yaml` paints `warning`
(`&[data-current][data-empty]`). A rebuilt menu reads zero values until it
stamps, so `#syncEmpty` could set that flag from a premature read and paint an
unrelated chip as broken. Saying NOT empty is always safe; saying EMPTY waits
for the menu's own `rendered` and one frame after it, and a later check
cancels an earlier one.

- Site: `src/components/sherpa-quick-filter/sherpa-quick-filter.ts`

### T-equals-answers-with-the-fields-own-values

In condition mode, `Equals` does NOT give a text box.

A reader who picks `Equals` on a Status field is choosing among `active`,
`churned`, `trial` — the values that field has. A free text box there invites
them to type `Active` and get nothing, with no clue why.

So `OP_TAKES[op] === 'list'` shows `.condition-pick`, a select of the field's
own values, read from the menu's own rows. Only a TYPING op shows the box.
The flag is on the ROW (`data-takes`), not the host, so one row can be a typed
`Contains` while the next picks from the list.

- Site: `src/components/sherpa-menu/sherpa-menu.ts`
- Site: `test/e2e/reforged-filter-conditions.spec.ts`

---

### T-a-select-does-not-hug-its-own-text

The And/Or select in a condition row sat in an `auto` grid track and shrank to
its caret — "And" clipped to nothing.

A `<select>` reports an intrinsic width its own longest option does not
guarantee, especially with `appearance` restyled. Give it a FIXED track.

- Site: `src/components/sherpa-menu/sherpa-menu.css`

---

### T-a-full-range-is-still-a-range

A NUMBER filter's slider opened at the column's own min and max, and the menu
read that pair as "no filter":

```ts
return lo === min && hi === max ? [] : [String(lo), String(hi)]   // WRONG
```

It is right for a chip the reader never opened, and wrong for every other case
that lands on the same pair. A reader who drags to 1..240 on purpose, or drags
out and back, gets an empty report: the chip never goes active and the filter
never applies. Measured live — `sub 10..200` reported `["10","200"]`, `full
1..240` reported `[]`, with the chip identical in both.

The state being read was never the VALUE. It was whether the reader had touched
the slider, which the value cannot carry. The slider now wears `data-touched`,
set in its OWN `onChange` — the toolbar seeds the bounds before the element is
upgraded, so any later write to an end is a real change. Clear restores the
bounds first and drops the flag second, because the restore re-sets it.

- Site: `src/components/sherpa-menu/sherpa-menu.ts`
- Site: `src/components/sherpa-slider/sherpa-slider.ts`
- Site: `test/e2e/reforged-data-grid.spec.ts`

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
- Site: `src/core/ui/filter-menu.ts`

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
- Site: `test/e2e/reforged-metric.spec.ts`

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

`src/core/data/aggregate.ts` holds it now: `aggregateBy`, `countBy`, `bandBy`,
`seriesBy`, `reduceRows`. Pure, DOM-free (on the lint boundary), and tested in
plain Node.

**It is NOT a new pipeline.** These run on rows a store has already filtered,
sorted and searched. Aggregation is what happens to the answer, not another way
of asking the question — `applyOptions` still owns the query, and `LoadResult`
still returns rows.

- Site: `src/core/data/aggregate.ts`
- Site: `src/components/sherpa-provider/sherpa-provider.ts`

### T-one-scale-for-every-chart

Three charts worked out their own value axis, three different ways:

| chart | floor | ceiling |
|---|---|---|
| line | `Math.min(0, …)` | `Math.max(1, …)` |
| bar | none at all | `Math.max(1, …)` |
| sparkline | `Math.min(…)` | `Math.max(…)` |

So a bar and a sparkline over the same numbers drew different heights, and
nothing said which was right.

`chartScale(values, { min?, max?, zero? })` is the one answer: `{ min, max,
span, percent(v) }`, with `percent` clamped at both ends. The FLOOR is the
difference that matters and it is a real choice, not an accident — a bar
measured from zero is the only honest bar, while a sparkline shows a SHAPE and
fits its own range (`zero: false`).

It survives what a chart actually gets handed: an empty set, every value the
same, a NaN among them, and an explicit end of either kind.

- Site: `src/components/sherpa-barchart/sherpa-barchart.ts`
- Site: `src/components/sherpa-line-chart/sherpa-line-chart.ts`
- Site: `src/components/sherpa-sparkline/sherpa-sparkline.ts`
- Site: `src/core/data/format-tick.ts`
- Site: `test/unit/chart-scale.test.mjs`

### T-the-top-gridline-rounds-to-its-magnitude

Will, 2026-09-23: *"The top gridline in a chart's value axis should round to
the nearest unit at that magnitude… all other gridlines between 0 and the max
value should divide that range equally"* — and then *"it should always round
up. So 403 becomes 500."*

**Rounding the TOP alone is not enough.** 403 rounds to 500, and four equal
bands of that are 125, 250 and 375. Nobody reads an axis in 125s, so the top
was round and every line under it was not.

The STEP is what gets rounded — to 1, 2, 2½ or 5 times a power of ten — and the
BAND COUNT moves with it. 403 becomes FIVE bands of 100, not four of 125. A
step of 2½ is kept on purpose: 25s and 250s are quarters, which is how a reader
already divides 100 and 1000.

Always up, so no bar reaches the ceiling, and the tightest fitting top wins so
the plot is not half empty.

An EXPLICIT `data-max` is never rounded: a caller who names a max meant it.
`data-ticks` is the PREFERRED band count, not a fixed one — the scale may use
one either side of it to land on round numbers.

Measured live after the change:

```
dashboard bar    0 125 250 375 500   ->   0 100 200 300 400 500
dashboard line   0  50 100 150 200   ->   0  20  40  60  80 100 120
```

- Site: `src/core/data/format-tick.ts`
- Site: `test/unit/chart-scale.test.mjs`
- Site: `src/core/ui/chart-parts.ts`

### T-a-bar-hangs-from-the-zero-line

A bar measured from the plot floor, so a NEGATIVE value drew an empty column
and said nothing at all.

Now the scale fits the data, and where it dips below zero the baseline lifts
off the floor: `--_zero` is how far up zero sits, `data-below-zero` says the
chart is in that mode, and a negative bar hangs beneath the line.

**Flex cannot place it.** A bar that starts part-way up the plot has no flex
expression — the first attempt used `margin-block-end`, and the column's
remaining space squashed the tallest bar to 98px where it wanted 144. Only in
this mode the bar is positioned against its column instead: `inset-block-end`
for a positive one, and `inset-block-start` for a negative, whose TOP edge is
the line. A chart of positive values keeps the flex layout untouched.

Measured on a 180px plot with `[-5, 10, 20]`: the line at 36px (a fifth of the
way up, since −5 is a fifth of the 25 span), the negative bar from 36 down to
0, and 20 drawing exactly twice 10.

- Site: `src/components/sherpa-barchart/sherpa-barchart.css`
- Site: `src/components/sherpa-barchart/sherpa-barchart.ts`
- Site: `test/e2e/reforged-barchart.spec.ts`

### T-one-verb-proxies-to-the-native-one

Four components open and close, and each wraps a different platform API:

| component | wraps | the native verb |
|---|---|---|
| dialog, overlay-panel | `<dialog>` | `close()` |
| menu, notifications | `popover` | `hidePopover()` |

Left alone, that leaks into the public surface: an app author writes
`dialog.close()` on one line and `notifications.hide()` on the next, for the
same intent. `../Sherpa Demos/app/` did exactly that.

**Sherpa's pair is `show()` / `hide()`**, and every one of the four accepts
both that and `close()`. The alias delegates — it never re-implements — so
there is one place the work happens:

```ts
hide(): void { … }                 // the logic
close(): void { this.hide(); }     // the platform spelling
```

The native API is still there and still used INSIDE; nothing is reinvented.
What is added is one vocabulary so a caller does not have to know which
platform primitive a component happens to wrap.

**`dismiss()` is not a synonym.** On callout and toast it REMOVES the element
from the DOM. Folding it into `hide()` would give a caller a method that
sometimes hides and sometimes destroys.

- Site: `src/components/sherpa-menu/sherpa-menu.ts`
- Site: `src/components/sherpa-notifications/sherpa-notifications.ts`
- Site: `test/e2e/reforged-open-close-verbs.spec.ts`
- Site: `src/core/ui/disclosure.ts`

### T-an-elevation-pin-cannot-reach-a-shadow-root

`--sherpa-shadow-sm/md/lg` resolved to `0px 0px 0px 0px` — an invisible shadow
— inside every component, at every elevation.

The aliases were built from `--sherpa-elevation-offset-x/-y/blur/spread`. Those
default to `size-none` on `:root` and take a real value only from
`[data-elevation="sm|md|lg"]`, a BARE attribute selector in `tokens.css`. A bare
selector cannot cross a shadow boundary, so inside a component the four
geometry values were always zero and the alias built a shadow of nothing.

Measured, not reasoned about: `getComputedStyle` on a `sherpa-container` host
returned `0px 0px 0px 0px` for `--sherpa-shadow-sm` with and without
`data-elevation` set.

**The fault was invisible because everyone worked around it.** Nine components
hand-wrote a `box-shadow`, each with a comment explaining that a
`[data-elevation]` pin never reaches the shadow root. All nine landed on the
Figma geometry anyway, so nothing looked wrong — the token was simply never
used. `grep var(--sherpa-shadow-` across `src/components/` returned zero.

The projector already knew: its `MODE_ALIAS_TARGETS` comment says
*"`var(--sherpa-elevation-blur)` resolves against :root, i.e. the PRIMARY mode
— `passthrough`, all zeros — so the shadow silently vanished"*. It patched the
Navigation collection only.

The aliases now carry Elevation's own per-mode geometry as literals — 2/2/8/-4,
8/8/16/-4, 8/8/32/-8, read from the Figma dump, identical to what the nine
components had written by hand. The COLOUR stays a `var` so a status re-point
still moves every shadow together.

`data-elevation` remains unwired: no component declares it and no example sets
it. Making it work needs a per-component `:host([data-elevation])` rule, which
is a separate decision.

- Site: `scripts/project-tokens.mjs`

### T-rendered-settles-even-when-the-markup-does-not

`#bootstrap()` awaits the component's stylesheet and its `.html` together, then
stamps and calls `#resolveRendered()`. An unguarded `await` skipped that last
call whenever the markup fetch REJECTED, so `rendered` stayed pending for the
life of the page.

There are **557** `await el.rendered` sites across `src/`, `test/` and
`../Sherpa Demos/app/`. Every one hung — no error, no timeout, no warning.

Measured, not argued. Two failure modes behave differently and only one was a
hang:

| the server does | `fetch` | before the fix |
|---|---|---|
| drops the connection | REJECTS | `rendered` pending forever |
| answers 404 | RESOLVES | stamped the error page as the template |

The 404 case is why `loadHtml` now checks `r.ok`: `fetch` treats any response
as success, so `r.text()` handed back whatever the server wrote — silently,
with no template and no complaint.

`#bootstrap` now catches, logs the component's own tag name, and stamps empty.
A blank element is a fault a person can see; a promise that never settles is
not.

`#adoptStyles` already had this defence (`allSettled`, see
T-shared-sheets-settle-independently). The markup leg never got one.

- Site: `src/core/ui/sherpa-element.ts`
- Site: `test/e2e/reforged-bootstrap-failure.spec.ts`

### T-an-event-name-is-not-always-a-literal

`generate-component-spec.mjs` learns what a component fires by scanning its TS
for `emit('name')`. Two components do not write the name at the call, and a
literal-only scan read them as silent:

```ts
emit(open ? 'menu-open' : 'menu-close', {})   // a ternary
emit(event, {})                               // a name from a table
```

`sherpa-app-header` published **one of its nine events** that way. The other
eight were invisible to the spec, to the MCP, and to any agent reading either —
while the `Fires:` comment named eight further events that existed nowhere, so
the intersection that guards against invented events came out empty.

The scan now also reads the literals inside an `emit()` ARGUMENT, and the second
column of a `['.selector', 'noun-verb']` pair. The selector half anchors the
table rule, so an ordinary array of strings cannot match it.

DO NOT widen this to every string in the file. That was the first attempt: it
swept up `data-anchor` and `aria-describedby` and invented events across all 58
components — the exact bug the intersection exists to prevent. 2401 lines of
phantom contract, from one over-broad regex.

Two smaller cases of the same family, both fixed in the comment rather than the
scanner: a `Fires:` line reading `menu-open / menu-close` is one name, not two,
and an event missing from the comment is dropped however clearly the code emits
it.

- Site: `scripts/generate-component-spec.mjs`
- Site: `src/components/sherpa-filter-panel/sherpa-filter-panel.ts`

### T-a-metric-condenses-by-wrapping

A metric tile drops its sparkline at narrow widths, and NO breakpoint says so.

The card is a WRAPPING flex row that CLIPS. The figures block is bounded
120–160px and the sparkline carries a 120px floor of its own. When the card
cannot give the sparkline its floor, the sparkline wraps to a second line and
the clip hides it, leaving value and trend. The threshold falls out of the
arithmetic — 16 host padding + 160 figures + 8 gap + 120 sparkline = 304px —
so it moves on its own if any of those tokens change.

This replaced `@container sherpa-metric (max-width: 220px)`, a guessed number
that had no relationship to what the tile actually holds.

THE CARD NEEDS AN EXPLICIT ONE-LINE HEIGHT (`--_line`, from the value and trend
line-heights). A wrapping flex box measures its WRAPPED height, so the tile grew
88 -> 96px the moment the sparkline wrapped, and `min-block-size: max-content`
does not help — it measures the wrapped height too.

Value and delta both ellipse on one line for the same reason: a wrap would push
the trend out of the card and past the clip.

- Site: `scripts/project-tokens.mjs`
- Site: `src/components/sherpa-metric/sherpa-metric.css`
- Site: `test/e2e/reforged-metric.spec.ts`

### T-a-row-span-is-keyed-by-value

`sherpa-container`'s height rule lists its values in the selector. A bare
`:host([data-row-span])` with a `var(--_rows, 6)` fallback looks equivalent and
is not: any value the value-rules do not name falls through to the default and
renders a 6-row card, silently.

Two live bugs came from that, both measured at 464px where 6 rows is 464px:

- `data-rows="5"` in a saved view (`dashboard-views.js`) — 5 was never a
  declared value, so a card meant to be 384px tall drew 464px for months.
- `data-rows="fit"` — the GRID's row MODE landed on a container, matched the
  bare selector, and became a 6-row card. The names no longer collide: the
  grid keeps `data-rows`, the container took `data-row-span`.

The `props` declaration cannot catch this. `kind: 'style'` means CSS selects on
it and the base class writes nothing, so nothing validates the value at runtime.
The selector IS the validation.

- Site: `src/components/sherpa-container/sherpa-container.css`

### T-a-stranded-container-fills-its-row

When the last container of a width class sits alone on its final row, it takes
what is left rather than stranding a gap. Measured on Records at tablet: the
gauge used 406 of 828px, half the row empty.

`:nth-child(An + 1 of S)` is what makes this possible. The `of S` argument
counts only siblings matching S — only items of the SAME width — which is
exactly what `sibling-count()` refuses to do (it counts every child of the
grid, so at tablet the four metric tiles made the three charts uncountable).
`A` is `across`, how many fit side by side, so `An + 1` means "starts a row".

Three parts, all required:

| part | says |
|---|---|
| `:nth-last-child(1 of S)` | I am the last of my width |
| `:nth-child(An + 1 of S)` | I start a row, so I am alone on it |
| `:not(:nth-child(1 of S))` | I am not the ONLY one of my width |

The third keeps a LONE container at its declared width. Without it a grid
holding one of each class stretched every single item to full width, since each
was simultaneously first and last of its kind.

RANGE-SCOPED, NOT `min-width`. A `min-width` block stays true at every wider
size, so the tablet rule (`2n + 1`) was still matching at desktop and stretched
a third-width chart to the whole row — measured at 65% row fill where thirds
were wanted. Each band is `(min-width: A) and (max-width: B - 1)`.

Two things CSS still cannot do here, both measured rather than assumed:

- **Count within a RUN.** Indices count among all matching siblings, so a
  different width sitting BETWEEN two mediums desynchronises the parity. Fine
  while each width's containers are contiguous, which is how views are written.
- **`minmax()` in a span.** It is a track-sizing function and a span is an
  integer; the parser rejects `grid-column: span minmax(4, 8)`. `span N / -1`
  does not stretch either — the item already ended at the last line.

`mod()` and `rem()` DO work in all three engines (measured 2026-09-23, an
earlier note in this file said otherwise). They were not needed: the `of S`
selector answers the question directly, needs no `@property` registration, and
is more widely supported than `sibling-index()`.

- Site: `scripts/project-tokens.mjs`
- Site: `test/e2e/reforged-layout-grid.spec.ts`

### T-a-container-width-is-named-not-counted

`data-col-span` takes a NAME, never a number. A view says what a card IS and
each breakpoint decides how many columns that takes:

| name | mobile (4) | tablet (8) | desktop/wide (12) |
|---|---|---|---|
| full | 4 | 8 | 12 |
| reading | 4 | 8 | **8** |
| large | 4 | 8 | **6** |
| medium | 4 | **4** | **4** |
| small | 4 | **4** | **3** |
| xsmall | **1** | **2** | **3** |

Tablet reads as two columns and mobile as one — except `xsmall`, which holds
4-up all the way down for a row of metric tiles that CONDENSE rather than wrap
(TRAP T-a-metric-condenses-by-wrapping).

STATED, NOT DERIVED. An earlier version computed the span from the column count
(`floor(cols / across)`), which reads elegantly and cannot express `reading` —
two thirds is not `12/N` for any integer N. It also hid the one thing a reader
needs to check against the design. The table above is the contract; the numbers
live in `COL_SPANS` in the projector.

A NUMBER was the old API (`data-span="3"`). It is gone because it made the
author hold the column count in their head, and it silently skipped the
responsive collapse a name gives.

- Site: `scripts/project-tokens.mjs`
- Site: `test/e2e/reforged-layout-grid.spec.ts`

### T-a-context-steps-by-its-own-width

**Inside the app shell, the layout grid steps by the CONTEXT's width, not the
window's** — TODO 146, level 2. The Context element (the shell's light-DOM
child with no `slot`) is a container, `sherpa-context`, and
`project-tokens.mjs` emits a container twin of every layout band: the column
count, the named spans, the stranded-row fill and fit mode. So the Context
reflows when a pinned nav or an open panel area takes room.

**The container is the LIGHT-DOM Context, declared in `tokens.css` — not the
shell's `.context-frame`.** Measured 2026-10-01: a page rule matched a
container in the shell's shadow tree in Chromium and Firefox, but in WebKit
only for SOME descendants — the Context's own children never matched, so the
grid stayed at 12 columns. A container name set from the shadow tree
(`::slotted()`) matched nothing in WebKit. A document rule on the light-DOM
element works in all three.

**The bands are the viewport's less the shut rail's 40px** (Will, A): 728,
1240 and 1880. So with nothing open, every layout is the same as before at
the same window width. One seam: below 768 the shell hides the rail, so a
728–767px window now gets the tablet band.

**The viewport rules SKIP the Context** (`:where(:not(sherpa-app-shell >
:not([slot]) …))`), or a desktop stranded-row rule would still fire in a
tablet-wide Context. Outside the Context — a page with no shell, or the
Settings overlay — the viewport rules are the only ones.

- Site: `scripts/project-tokens.mjs`

### T-fit-is-a-desktop-mode

`data-rows="fit"` applies from 1280 up and nowhere else.

At tablet and mobile a view is READ BY SCROLLING: pinning it to the fold would
squeeze every card on the way down, and the one that takes the remainder would
sit at its floor with everything above it crushed. Below the breakpoint the
rule simply does not apply, so the grid behaves as the default does.

Below it, `data-row-count` does nothing on a fit grid — the equal-row rule
skips it. Applied, every `1fr` row would grow as tall as the tallest card.

- Site: `scripts/project-tokens.mjs`
- Site: `test/e2e/reforged-layout-grid.spec.ts`

### T-a-content-grid-has-two-row-modes

`.sherpa-grid` is a layout MIXIN — it works in any sized box, with or without
an app shell, and `data-rows` picks how its rows are sized:

| | |
|---|---|
| (none) | rows hug their content and the grid OVERFLOWS its parent — how every view behaved before these existed |
| `fixed` | every row one grid row high; the grid fills its parent and SCROLLS |
| `fit` | every row one grid row high; the grid fills its parent exactly, and the LAST row takes the rest |

`block-size: 100%` is what makes `overflow` mean anything in `fixed`: without
it the grid grew to 656px inside a 500px parent and scrolled nothing.

**WHEN A FIT GRID CANNOT FIT, IT SCROLLS.** The rows above the filler may
already exceed the area — three `data-rows="6"` cards at 464px each in a 768px
window need 1288px. Crushing the filler to 2px loses content, so it has a FLOOR
of two grid rows and `overflow-y: auto` takes over below that. The page then
behaves like the default mode at that size, which is the honest answer.

The DEFAULT is neither, so nothing that existed before changed.

- Site: `scripts/project-tokens.mjs`
- Site: `test/e2e/reforged-layout-grid.spec.ts`

### T-a-fit-grid-needs-its-row-count

A grid item can never be taller than its ROW, so filling the remainder means
the LAST row must be `1fr` — and CSS has no way to name the last auto row. So
the count is AUTHORED: `data-row-count` counts every row, the last included,
and the grid is `repeat(count - 1, row-height) 1fr`.

Every row is one `size/row` tall — one metric — and every child states its
spans. Nothing is measured, so no child's content can size a row.

**It was measured until 2026-09-24, and that was the bug.** JS counted the
distinct TOPS above the filler. A card spanning six rows has ONE top, so on
Records the count came back 2 where the rows were 7: the `1fr` row fell inside
the charts, they took the slack, and the last card dropped into an implicit
`auto` row and hugged its content.

Seven shapes were measured before the count existed. Every one failed:

| tried | result |
|---|---|
| `grid-auto-rows: min-content` | filler 18px — a min-content row cannot grow |
| `grid-auto-rows: auto` | 242px — every row splits the slack equally |
| `grid-auto-rows: minmax(64px, auto)` | the same 242px |
| `grid-auto-rows: min-content 1fr` | the pattern REPEATS — right only on an even row |
| `grid-row: sibling-index() / -1` | supported, but that is a CHILD index: four metrics on one row make index 5 = row 2 |
| `align-self: stretch` + `height: 100%` | 18px — it stretches WITHIN its own row |
| flex-wrap, spans as basis | 242px — `align-content` splits between LINES |

`repeat(calc(n - 1), …)` works in all three engines. `repeat(0, …)` does not —
it drops the whole template — so a count of 1 is its own rule.

- Site: `scripts/project-tokens.mjs`
- Site: `src/components/sherpa-layout-grid/grouped-grid.ts`
- Site: `test/e2e/reforged-layout-grid.spec.ts`


### T-a-fit-grid-needs-a-sized-parent

`block-size: 100%` needs an unbroken chain of sized ancestors, and an app
shell built to SCROLL does not have one.

`sherpa-app-shell` had `min-block-size: 100vh` on its frame, so the shell GREW
with its content; a view's `100%` then resolved against that growth — 1809px
inside a 900px area — and a fit grid had nothing to measure.

Will's ruling: **the shell always fits the viewport; the CONTENT decides
whether it scrolls or fits.** So the frame caps at `100%`, `.view` passes the
height through, and a scrolling view simply overflows `.content` as it always
did. There is no `data-fit` on the shell — that put the choice at the wrong
level.

`.content` is a FLEX COLUMN, which is the half that is easy to miss: as a
plain block, a `block-size: 100%` view took the whole scroller and started
BELOW the 120px sticky header, so it ran a header's height past the fold.
`.view` takes what the header leaves instead.

**And the slotted Context must GROW to fill its frame** (`.context-frame
::slotted(*) { flex: 1 1 auto; min-block-size: 0 }`). Left at its content's
height, a fit grid's `100%` measured the CONTENT: the Records card was 586px
with ten rows and 632px with fifty, and the pager moved with it. The rule was
dropped when the scroller moved to `.context-frame` (142) and nothing failed,
because every test page was taller than its frame. Will, TODO 153.

- Site: `src/components/sherpa-app-shell/sherpa-app-shell.css`
- Site: `test/e2e/reforged-layout-grid.spec.ts`
- Site: `test/e2e/reforged-app-shell.spec.ts`

### T-a-band-label-names-what-it-counts

`bandBy` cuts a continuous field into bands. They are HALF-OPEN — `[0,20)`,
`[20,40)` — except the last, which owns its top edge, because that is what a
histogram means and a value has to land somewhere.

The LABELS said otherwise. With edges `0,20,40` they read "0-20" and "21-40",
so a value of exactly 20 was counted in the second band while the first bar
claimed it. A reader looking up 20 read the wrong bar, and every boundary
value in the dashboard's storage histogram — 20, 40, 60, 80 — was off by one
bar in exactly the same way.

Nothing about the counting was wrong. The label was, and a label is the only
part a reader can see, which is why this survived: the bars were the right
height all along.

Every band but the last now stops ONE BELOW its top edge — "0-19", "20-39",
"40-60". A caller's own `labels` option still wins, and is the right answer
when the bands mean something the numbers do not say.

- Site: `src/core/data/aggregate.ts`
- Site: `test/unit/aggregate.test.mjs`
- Site: `test/unit/band-labels.test.mjs`

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

- Site: `src/core/data/aggregate.ts`

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

- Site: `src/components/sherpa-data-grid/sherpa-data-grid.ts`
- Site: `src/core/data/aggregate.ts`
- Site: `test/e2e/reforged-data-grid.spec.ts`
- Site: `test/unit/band-labels.test.mjs`
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

- Site: `src/core/data/aggregate.ts`
- Site: `src/core/ui/chart-parts.ts`

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

- Site: `src/core/data/aggregate.ts`

### T-a-series-has-a-value-at-every-point

`seriesBy` returns a number for every point on the x-axis, including points no
row matched. A quiet Tuesday is `0`, not absent.

A line chart with a hole in it lies about its shape: the remaining points join
up across the gap, so a day with no activity reads as a straight line between
its neighbours rather than a drop to zero. The x-axis is the caller's — the
days, the buckets, the steps — and the series has to fill it.

- Site: `src/core/data/aggregate.ts`

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

- Site: `src/core/data/base-store.ts`
- Site: `src/core/browser/idb-store.ts`
- Site: `src/core/data/validate.ts`
- Site: `src/core/data/stores.ts`

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

- Site: `src/core/data/data-source.ts`
- Site: `src/components/sherpa-data-grid/sherpa-data-grid.ts`
- Site: `src/core/data/cycle.ts`
- Site: `test/unit/suspended-sort.test.mjs`
- Site: `test/unit/cycle.test.mjs`
- Site: `src/core/ui/sherpa-element.ts`
- Site: `src/components/sherpa-quick-filter/sherpa-quick-filter.ts`

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

- Site: `src/core/data/data-source.ts`
- Site: `src/components/sherpa-data-grid/sherpa-data-grid.ts`
- Site: `src/components/sherpa-pagination/sherpa-pagination.ts`
- Site: `scripts/check-ownership.mjs`
- Site: `src/core/ui/sherpa-element.ts`

### T-one-cycle-for-one-value

The sort cycle — `asc → desc → suspended → asc` — was written TWICE: once in
the data grid's column header, once in the toolbar's Sort chip. The two
drifted, and the drift was invisible until someone clicked three times: the
grid DELETED the column on its third click while the chip SUSPENDED it.

That is two controls of one value disagreeing about what their shared third
state keeps, which is precisely what
`T-a-chip-body-cycles-its-states` ratified an answer to. A rule each component
re-reads from a document is a rule that drifts; a function is not.

`src/core/data/cycle.ts` holds it: `nextSort`, `sortDirectionAttr`,
`sortDirectionFrom`, `nextToggle`. Pure, DOM-free, on the lint boundary —
they take the current state and return the next one. **Reading it off an
attribute and writing the result back is not their job**, because for a bound
component that belongs to the source (`T-bind-locks-what-it-owns`).

`nextToggle` is one line and is there on purpose: the two-state and three-state
cases then read the same way at every call site, and "off is a state, not a
delete" is stated once for both.

- Site: `src/core/data/cycle.ts`
- Site: `src/components/sherpa-data-grid/sherpa-data-grid.ts`
- Site: `src/components/sherpa-quick-filter-toolbar/sherpa-quick-filter-toolbar.ts`
- Site: `test/unit/cycle.test.mjs`
- Site: `src/components/sherpa-quick-filter/sherpa-quick-filter.ts`

### T-a-trigger-shows-what-it-opened

A button that opens something and goes on looking closed reads as broken.

`sherpa-button` already draws `data-open` — the accent ring — for a menu it
OWNS as a slotted child. The header's notifications panel is not that: it lives
in the HOST, beside the header, so nothing inside the component could know it
had opened. The bell opened a panel four times a day and never once said so.

The fix is the system's own convention, not a new mechanism: `data-*` carries
state IN, an event carries intent OUT. The header emits `notifications-open`;
the host owns the panel, so the HOST sets `data-notifications-open` back, and
the header mirrors it onto the button it owns.

```js
appHeader.addEventListener('notifications-open', () => panel.toggle(bell));
panel.addEventListener('menu-open',  () => appHeader.toggleAttribute('data-notifications-open', true));
panel.addEventListener('menu-close', () => appHeader.toggleAttribute('data-notifications-open', false));
```

**Look for this wherever a trigger and its surface are separated.** The state
belongs to whoever owns the surface, and the trigger has to be told.

- Site: `src/components/sherpa-app-header/sherpa-app-header.ts`
- Site: `src/components/sherpa-app-header/sherpa-app-header.html`
- Site: `test/e2e/reforged-app-header.spec.ts`

### T-a-css-function-needs-its-longhand-first

A CSS `@function` renders NOTHING in an engine that lacks it — not a fallback,
not an error, just an unset property. Measured in Firefox 155: a focus ring
written as `--ring(2px)` simply does not draw.

That is why this library had no function library, and the ruling that forbade
one was written before anyone tried the guard.

**`@supports` closes it.** Two blocks, always in this order:

```css
/* 1. The longhand. Every engine, always. */
&:hover { background: color-mix(in oklab, var(--_surface) 92%, currentColor); }

/* 2. The function. SECOND, so it wins only where it works. */
@supports (background: --shade(red, 8%)) {
  &:hover { background: --shade(var(--_surface), 8%); }
}
```

Measured in all three engines, including inside an ADOPTED shadow sheet, which
is the demanding case because `@import` dies there:

| engine | `@function` rule | renders |
|---|---|---|
| Chromium 1xx | kept, `CSSFunctionRule` | via the function |
| WebKit | kept, `CSSFunctionRule` | via the function |
| Firefox 155 | **dropped from the sheet** | via the longhand |

Firefox discarding the rule is what makes this safe: there is nothing left to
half-apply. All three land on the same colour to five decimal places.

**What a function is FOR here.** Two of them name a step where components had
drifted:

| function | for | scale |
|---|---|---|
| `--shade(--surface, --amount)` | a control with a surface of its OWN | 8% hover, 16% pressed |
| `--tint(--amount)` | one BORROWING the surface beneath it | 16% hover, 24% pressed |

**Superseded for hover and down where a component binds Style** (Will's rule,
2026-09-24): `base` / `+1` / `+2` are default / hover / down, so those bind the
Style step and need no function. See `T-a-state-colour-binds-the-style-mode`.

`--shade` replaced raw percentages that had drifted to 92%, 94% and 84%.
`--tint` replaced four IDENTICAL close buttons — tag, chip, toast, callout —
hovering at 22%, 18%, 22% and 14%. The function is not shorter; it is NAMED,
which is the same reason `--sherpa-focus-ring` is a custom property rather than
48 copies of one value (`T-one-value-one-declaration`).

**Why not a custom property instead?** A property holds one value. This takes
ARGUMENTS — a different surface and a different step per call — which a
property cannot express.

- Site: `src/core/sherpa-base.css`
- Site: `playwright.config.ts`
- Site: `test/e2e/reforged-css-functions.spec.ts`
- Site: `src/components/sherpa-menu/sherpa-menu.css`
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

`.sherpa-truncate`, `.sherpa-inert` and `.sherpa-border-corners` went in as
CLASSES for the opposite reason: they apply to inner nodes, where a class is
reachable, and they are whole rules rather than one value.

**`.sherpa-border-corners` is the twin of `.sherpa-border-edges`** — the four
radii beside the four widths, and the other half of what `[data-group]` writes.
The same four lines existed 26 times across 21 components. Fourteen sites took
the class; the rest keep their block and must, for the reasons above: a bare
`:host` (button, container, nav-item), a CONDITIONAL selector
(`:host([data-state="range-end"]) .content`, `&:focus-visible`) which a class
cannot express, and `::slotted(...)`, which styles someone else's element.

**`.sherpa-inert` carries only the two INTERACTION declarations.** The colours
stay per-component, because each picks a different inactive token — and never
`opacity`, which compounds in dark mode.

- Site: `src/core/sherpa-base.css`
- Site: `src/components/sherpa-data-grid/sherpa-data-grid.css`

### T-motion-is-owned-here

**`CLAUDE.md` told components not to write a `prefers-reduced-motion` block
because "motion gating is owned globally". Nothing owned it.** Searched
`src/`, `src/styles/` and `../Sherpa Demos/app/`: zero matches. Every animation in the
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

### T-anchoring-is-generic

The anchor-positioning machinery in `sherpa-base.css` was named `.chart-tip`,
`.chart-mark`, `.chart-anchor-point`. None of it is chart-specific: it is
`position-anchor` plus `position-try-fallbacks` plus a zero-size anchor point,
which any component could use to place a tip beside any trigger.

It now answers to `.sherpa-tip`, `.sherpa-anchor`, `.sherpa-anchor-point` and
`.sherpa-anchor-el`, **with the `chart-*` names kept as aliases**. Not renamed
outright: five chart components name them across ~38 sites, and one is in a
`.component.json` that the spec round-trip gate reads — so a rename is a
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
- Site: `src/components/sherpa-layout-grid/sherpa-layout-grid.ts`
- Site: `src/components/sherpa-layout-grid/sherpa-layout-grid.html`
- Site: `test/e2e/reforged-layout-grid.spec.ts`
- Site: `src/components/sherpa-group/sherpa-group.css`
- Site: `test/e2e/reforged-group.spec.ts`

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

`round(down, …)` is INTEGER DIVISION, which is what a span needs; `mod()` and
`rem()` do work in all three engines, they answer a different question.
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
- Site: `src/components/sherpa-group/sherpa-group.css`

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
- Site: `src/components/sherpa-group/sherpa-group.css`

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
- Site: `src/components/sherpa-input-text/sherpa-input-text.css`
- Site: `src/components/sherpa-menu/sherpa-menu.html`
- Site: `src/core/ui/sherpa-element.ts`
- Site: `src/components/sherpa-group/sherpa-group.css`

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
- Site: `src/components/sherpa-group/sherpa-group.css`
- Site: `test/e2e/reforged-group.spec.ts`

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

`../Sherpa Demos/app/contexts/dashboard.js` predated this and was correct only by accident:
its source declares no `pageSize`, so nothing was ever sliced. It now says
`scope: 'all'` outright, because that luck is one added pageSize from running
out.

- Site: `src/core/data/data-source.ts`
- Site: `test/unit/summary-scope.test.mjs`

### T-a-legend-row-goes-inactive-it-never-vanishes

A filter that empties a category must leave its legend row in place, at zero
and drawn inactive. It must not drop the row.

`aggregateBy` omits an empty category by default, which is right for a chart —
a zero slice is a degenerate path and a zero bar is a gap. It is wrong for a
LEGEND, which is a list of what EXISTS, and it is the control the reader uses
to switch that category back on. Drop the row and the way back goes with it.

So the legend and the chart take the same `order` but different `includeEmpty`:
the legend keeps every declared category, the chart draws only what it has.
They can still share identity per array, because each call returns its own.

`data-empty` on a row is what a FILTER did; `aria-pressed="false"` is what the
READER did. Both paint the same inactive ink, and they are not the same fact: a
row can be pressed ON and hold nothing.

See `T-a-legend-toggle-is-a-filter` for the other half — a legend click writes
`notin` into the source rather than hiding a slice.

- Site: `src/core/data/aggregate.ts`
- Site: `src/components/sherpa-chart-legend/sherpa-chart-legend.ts`
- Site: `src/components/sherpa-chart-legend/sherpa-chart-legend.css`
- Site: `test/e2e/reforged-chart-legend.spec.ts`
- Site: `test/unit/filter-state.test.mjs`
### T-a-legend-toggle-is-a-filter

Turning a legend row off used to call `setSliceHidden(i)` — a DRAWING trick on
one chart. That bar vanished and nothing else on the page knew: the other
charts, the metric tiles, the grid and its pager all carried on counting the
rows the reader had just said to exclude.

A legend toggle is a **filter**, scoped to the view. One click writes the
FIELD's selection, and every bound component re-reads. Measured on Records:
clicking "churned" took the metric from 100 to 75, recounted the DONUT legend
to 18/20/18/19 and dropped the grid from four pages to three.

**There is no legend module.** Will, 2026-09-22: *"legend filtering is just
filtering. visibility & state is a component concern."* `legend-filter.ts`
held the read/draw/write loop every control over a field needs, plus one
legend rule, in a data-layer file named after one component. It is deleted.
The loop is `bindSelection` in `filter-state.ts`; a caller supplies the
control's own `read` and `draw`:

```js
bindSelection(legend, source, {
  field: 'status',
  values: states,
  read: (l) => states.filter((v) => !l.off.includes(v)),
  draw: (l, picked) => { l.off = picked.length ? states.filter((v) => !picked.includes(v)) : []; },
  event: 'legend-item-click',
  signal,
});
```

Three things the rule gets right, each with a test:

- **A chip over the same field needs no wiring at all.** Both read
  `source.selection(field)`; the mirroring path (`chip:`, `report()`, and a
  `legend:<field>` named part) is gone with the module. A separate part per
  writer is what let `plan ne Free` and `plan eq Free` sit in one query.
- **Nothing picked means no constraint**, not "hide everything".
- **What is VISIBLE is the component's own state.** `sherpa-chart-legend`
  keeps its `off` set, its roll-up rows and its floor — see
  `T-a-legend-keeps-one-row-on`.

`../Sherpa Demos/app/contexts/dashboard.js` is converted too — clicking "Disk" takes its
Alerts tile from 1284 to 881 and recounts the donut legend to sum to 881. Its
LINE legend is the one that stays a per-chart hide: those labels name two
SERIES ("Sessions" is every non-critical row), not values of one field, so
there is nothing to filter on and inventing a field would be a lie.

- Site: `src/components/sherpa-provider/sherpa-provider.ts`
- Site: `src/components/sherpa-chart-legend/sherpa-chart-legend.ts`

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
invisible to the TS, to the generated `.component.json`, and to any agent
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
- Site: `src/core/ui/sherpa-element.ts`

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

`src/core/ui/sherpa-element.ts` now exports two objects:

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

- Site: `src/core/ui/sherpa-element.ts`
- Site: `scripts/check-ownership.mjs`

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

### T-a-value-can-be-an-object

Will's rule, 2026-09-22: **"A value can be a string, number, or object (which
is also a set of fields and values)."**

`text()` — the one function the whole comparison layer routes through — was
`String(v).toLowerCase()`. For an object that is `"[object object]"`, so:

- **any two objects compared EQUAL.** `['owner','eq',{id:'r'}]` matched every
  row that had an owner at all, not the ones with that owner.
- **picking one marked them all.** `fieldState` over object values returned
  every row `picked` after one was chosen.

Neither said anything. The filter ran, the menu ticked, and both were wrong.

`stableText` is the fix: an object is its own fields and values, sorted by key
so two equal objects always produce the same text, and applied recursively
because a value inside an object is a value too. An array is its items in
order. A `Date` is a VALUE, not a bag of fields, so it is its timestamp.

**Sorting was never affected** — `sortRows` compares with `readField` and the
shared collator, and both a number and a dotted path (`owner.name`) have always
worked. Two probes of mine reported otherwise and both were the probe's fault:
`setSort` takes a FIELD NAME, not an array of specs.

**A KEY can be an object too.** `sameKey` compared `String(a) === String(b)`,
so a compound key (`{org:'acme', no:2}`) matched the FIRST row asked for and
`byKey` returned the wrong record silently. It routes through `valueKey` now.
A NUMERIC key still compares as a string on purpose — a key arrives from an
attribute or a URL far more often than not, and `'7' === 7` is false.
See `T-numeric-keys-compare-as-strings`.

**`oneOf` ACCEPTED ANYTHING.** A schema rule built from objects compared them
as `String(v)` too, so `oneOf([RAVI, DANA])` passed an entirely unrelated
object — a validation rule that lets everything through is worse than none. It
routes through `valueKey` now, and `'2'` still passes `oneOf([1, 2, 3])`,
which is the point of comparing as an attribute would.

**Sorting BY an object field** left the order untouched, because every row
compared equal. `compareValues` routes through `valueKey`, so it is at least
deterministic — though a dotted path (`owner.name`) is what a caller usually
wants, and that always worked.

**A number keeps its type through the query** and loses it in `fieldState`,
which maps every value through `String`. That is deliberate for a menu row,
whose value has to be a string to live in an attribute — but a control wanting
to right-align or sort numerically must read the row, not the state.

- Site: `src/core/data/aggregate.ts`
- Site: `src/core/data/data-source.ts`
- Site: `src/core/data/filter-state.ts`
- Site: `src/core/data/store.ts`
- Site: `src/core/data/validate.ts`
- Site: `src/data.ts`
- Site: `test/unit/value-types.test.mjs`

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

- Site: `src/components/sherpa-menu/sherpa-menu.ts`
- Site: `src/components/sherpa-quick-filter/sherpa-quick-filter.ts`
- Site: `src/core/data/filter-state.ts`
- Site: `src/core/data/store.ts`
- Site: `test/unit/filter-state.test.mjs`
- Site: `src/core/data/data-source.ts`
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

- Site: `src/components/sherpa-quick-filter-toolbar/sherpa-quick-filter-toolbar.ts`
- Site: `src/core/data/bind-selection.ts`
- Site: `test/unit/bind-selection.test.mjs`
- Site: `test/unit/field-selection.test.mjs`
- Site: `test/unit/filter-state.test.mjs`
- Site: `src/core/data/filter-state.ts`
- Site: `src/components/sherpa-chart-legend/sherpa-chart-legend.ts`
- Site: `src/components/sherpa-quick-filter/sherpa-quick-filter.ts`
- Site: `src/core/data/data-source.ts`
### T-a-breakdown-pick-is-a-legend-pick

Unticking a folded category in the "Other" breakdown menu did NOTHING to the
view. The chart kept its slice, the tiles kept their count, and the menu closed
looking as if it had worked.

Two halves, both missing:

- the legend emitted `legend-breakdown-change` and **nothing in the app
  listened**. It was a public event with no subscriber anywhere but its own
  test.
- the legend never updated its own `off` set, so a caller reading `legend.off`
  — which is how `bindSelection` draws the field — saw no change either.

A breakdown pick IS a legend pick: the folded rows go into `off` like any
other, and the row re-reports itself as `legend-item-click` with its
`indices`. One event for a caller to bind, and the off-set stays the one
answer. `legend-breakdown-change` still fires for a caller who wants the
narrower detail.

- Site: `src/components/sherpa-chart-legend/sherpa-chart-legend.ts`
- Site: `test/e2e/reforged-chart-legend.spec.ts`

### T-a-gauge-names-its-zones-once

**A gauge's zone is NAMED on the gauge, and its tooltip and its legend row
both say that name** — TODO 128, Will: *"Gauge tooltips should match the
segment name as shown in the legend."* The two had different owners: the tip
said the zone's STATUS word (`Success`, `Warning`, `Critical`), and the
legend was filled by hand in the page's script (`Low (0–20)`, `Watch
(20–40)`), so they could not agree, and the ranges were typed twice.

A band in `data-zones` takes a third part — `0-20:success:Low`, or `label` in
the JSON form. The tip reads `Low` · `0–20%` (the range carries the gauge's
unit), and the gauge FILLS its slotted legend with the same two — label and
value — so a legend row is `Low 0–20%`.

Only NAMED zones fill a legend: a gauge with no names leaves its legend to
its host, as before, and a band with no name keeps its status word. The fill
is skipped when the rows have not changed, as every value write comes
through the same sync.

- Site: `src/components/sherpa-gauge-chart/sherpa-gauge-chart.ts`
- Site: `test/e2e/reforged-gauge-chart.spec.ts`

### T-a-narrow-chart-stacks-its-legend

**Below 22rem of its own width, a chart puts a legend that was BESIDE it
below it, and a legend STRIP becomes a list** — Will, TODO 162: *"go from
horizontal layout to vertical layout as their container gets narrower. Use
container queries."* A chart already stacked is left alone. 22rem, so the
Records page at 1280 with the filter panel shut (a 363px chart) is as it was.

Three things that are not obvious:

- **The HOST is the container, and a container cannot restyle itself.** The
  bar, line and gauge charts put the side-by-side grid on `:host`, so the
  narrow query cannot take the grid away. It re-places what is IN the grid
  instead: the plot and the legend each span both columns, and the legend
  takes a third row.
- **The rule must be LAST.** The plot's `grid-column: 1` lived in each
  chart's own sheet, which is adopted after its family's — so it beat the
  family's narrow rule. It is in the family sheets now, above the query.
- **The legend is TOLD, it does not measure.** Beside a chart it hugs its
  content, and an inline-size container has no content width: as its own
  container it would collapse. The chart's query sets
  `--sherpa-chart-legend-columns: 1` on its slotted legend, and the legend's
  3-by-2 grid reads its column count from that.

`::slotted()` inside an `@container` on the host works in Chromium, WebKit
and Firefox — measured, by the tests below.

- Site: `src/core/sherpa-chart-axes.css`
- Site: `src/core/sherpa-chart-segments.css`
- Site: `src/components/sherpa-radial-chart/sherpa-radial-chart.css`
- Site: `src/components/sherpa-chart-legend/sherpa-chart-legend.css`
- Site: `test/e2e/reforged-chart-legend-slot.spec.ts`

### T-a-horizontal-legend-is-three-by-two

A horizontal legend was a wrapping flex row, so it put a different number of
entries on each line at every width — three here, five there, and a lone one
stranded below.

It is a 3x2 GRID: six cells, which is `MAX_ITEMS`, so the last cell is always
the roll-up with its breakdown menu. `1fr` columns rather than `auto`, because
three equal cells are what keep the second row's entries under the first row's.
Entries are centred in their cell, since a two-row grid leaves a cell taller
than its entry wherever a label wraps.

**And the grid is capped and centred.** Will, 2026-09-26: across a 12-column
card the three cells sat a third of the page apart, too far to read as one
key. `max-inline-size: 40rem` — rem, so it follows the text size, as the tip's
`16rem` does — and `margin-inline: auto`. Narrower than that, it fills.

- Site: `src/components/sherpa-chart-legend/sherpa-chart-legend.css`
- Site: `test/e2e/reforged-chart-legend.spec.ts`

### T-the-breakdown-button-shares-the-other-row

The legend's grid had THREE tracks — swatch, label, value — and the roll-up
needed a fourth for its menu button. With `grid-column: 1 / -1` the toggle
spanned all three and the button wrapped to the line BELOW, which reads as a
seventh row that is not there.

The legend declares four tracks. An ordinary entry takes the first three and
leaves the button's empty; the roll-up takes all four.

The comment claiming a "FOURTH implicit column" was describing something that
never happened — an implicit track is only created by an item placed past the
explicit ones, and `1 / -1` is not.

- Site: `src/components/sherpa-chart-legend/sherpa-chart-legend.css`
- Site: `test/e2e/reforged-chart-legend.spec.ts`

### T-a-legend-keeps-one-row-on

Will, same message: *"at least 1 must be active at all times so we need to
prevent toggling of the last active legend item."*

Hiding the last row leaves an empty chart beside an empty grid and no obvious
way back — and it is not a question anyone asks. The click is REFUSED and the
legend is put back as it was, rather than left dimmed over an unchanged filter.

**THE LEGEND REFUSES IT, not the caller.** Until 2026-09-22 the floor lived in
a `legend-filter` module in the data layer, which meant a filter rule guarded a
VISIBILITY question. Will: *"legend filtering is just filtering. visibility &
state is a component concern."* It is now in `sherpa-chart-legend`, beside the
off-set and the roll-up rows it has to count — so any caller gets it, not only
one that used the right binding.

Two doors reach the same state and both are guarded: the click, and a host
writing `legend.off`. A refused click reports NOTHING — no `legend-item-click`,
no `aria-pressed` change — because a dimmed row over an unchanged filter is the
lie the rule exists to prevent.

A roll-up row counts as the categories it FOLDED, never as its own "Other"
label, which is a value of nothing.

- Site: `src/components/sherpa-chart-legend/sherpa-chart-legend.ts`
- Site: `test/e2e/reforged-chart-legend.spec.ts`

### T-a-spec-on-disk-must-be-the-spec-the-source-makes

`spec:check` generated a FRESH spec from the source and validated and
round-tripped THAT — and never compared it with the `.component.json` on disk.
So a committed spec that no longer described its component passed every
commit.

Found 2026-09-25, twice in one day: the toolbar's spec lacked the new `held`
getter, and the filter panel's still advertised `release()`, deleted in 3c-ii.
Both were caught only because the code map made me regenerate by hand. The
first full run of the new check found three more — `sherpa-app-shell` and
`sherpa-barchart` stale in committed code, `sherpa-accordion` stale in another
session's uncommitted CSS.

So `--check` now has a third half, **fresh**: a generated spec on disk must
equal what the generator makes from the source now. A hand-authored spec (no
GENERATED header) is exempt, as it always was from `--all` writes.

**`--staged` in the hook.** Freshness is checked only for a component the
commit touches. Anyone's half-done CSS makes its spec stale until regenerated,
and a hook that checked every component blocked every commit on another
session's work in progress. The full `npm run spec:check` still checks all 61.

**Proving it needs a real staged change.** Writing the committed version back
and staging it stages NOTHING — the first test of this passed for that reason.

- Site: `scripts/generate-component-spec.mjs`

### T-a-file-says-what-it-holds

Every file's header ends in a `Map:` — one line per export, what it is and
does. `npm run map [path]` prints them all; it is the higher-plane map for
deciding where code goes and what already exists.

Will, 2026-09-25: *"Perhaps keep a lightweight record of each file, variable,
and function that describes what they are, what they do, and why… This can be
used as a higher plane traversal map when deeming where code should go, what
can be refactored, combined, etc. You will need to update this as the final
step of any change. 1 large file might not be the best for context & token use
so maybe something in the file header."*

**Why it is needed, measured.** §15 of `FILTER-REVIEW.md` found 207 exported
names in `src/core` that nothing indexed — and new code re-learned lessons
that `nextSort` and `sortDirectionFrom` already carried in `cycle.ts`, three
folders away. The map is the answer to "does this already exist?" in one
command: 297 lines for the whole data and UI core, instead of 30 files.

**What goes where**, so it stays lightweight:

| | lives in |
|---|---|
| a file's purpose | the header's first line — already the convention |
| an export | one `Map:` line in that file's header |
| a component's props, events, methods | its `.component.json` — generated and gated already, so NOT repeated |
| a `#private` member | a one-line comment above it, in place |
| the WHY of anything non-obvious | `docs/TRAPS.md`, cited |

**Gated both ways**, like the traps: an export missing from its Map fails, and
a Map line whose name is no longer exported fails — so it cannot rot. A line
longer than 110 characters fails; that is a paragraph. `check:map --staged` in
the hook makes a CHANGED file carry its map, which is how updating it becomes
the final step of every change.

**A ratchet for the rest.** 91 files had no Map when this landed, and 283
`#private` members had no comment. Both were then done by hand the same day —
one file and 12 members remain, all in the two components another session was
editing, and `scripts/code-map-baseline.json` holds exactly those. The numbers
may only fall; `node scripts/code-map.mjs --privates` lists what is left.

**An export LIST is exports too.** `export { generateSpec, toYaml };` at the
bottom of a file read as "exports nothing", so the file never needed a Map —
the same blind spot as the spec gate's, found the same day. A name in a local
list counts when this file DECLARES it; one it only imported is a re-export,
mapped in its own file.

**The drafts are drafts.** `map:write` fills a line from the JSDoc above the
export, and 60 of 297 came out blank, cut off, or wrong — a section banner
(`── Grouped aggregation ──`) read as a description, *"Read it back."*, a
type's line describing the one below it. Every line gets a human pass.

- Site: `scripts/code-map.mjs`

### T-one-condition-system

**Every answer a filter can have is condition rows, compiled by one function,
and its TYPE — Simple or Advanced — is decided once.**

Will, 2026-09-25: *"Default filter modes are also technically conditional
filters… So we can use the same engine regardless of filtering mode… We should
call it a Custom Condition Filter. Default is a Default Condition Filter. We
use the blue info styling to represent active Custom Condition Filters.
Bringing everything into the same condition composition system will help us
deal with any discrepancies and bugs."*

**There were three answer shapes, not two** — ticked picks, ONE typed
condition (`op` + `text`), and a chain of rows — and `stateClause` had a
branch for each. The bar sends all of them at once, so each reader of the state
had to guess which counted.

`fieldState()` now builds **`state.rows`** — the whole answer as rows:

| the reader | becomes |
|---|---|
| ticked one value | `{ op: 'eq', picked: [x] }` — EQUALS X |
| ticked several in ONE field | `{ op: 'eq', picked: [x, y] }` — EQUALS X **OR** EQUALS Y, so `in` |
| dragged a range | `{ op: 'between', picked: [lo, hi] }` |
| typed a condition | `{ op, text }` |
| built a chain | the rows, as they are |

`stateClause` compiles `rows` and nothing else, through one `rowClause`. The
three branches are gone.

**`state.condition`** is `'simple'`, `'advanced'` or `null`. Simple is the
field's own body answering with the default op — ticks, a slider, a day.
Advanced is anything else: a named op, typed text, or rows. **Both** the chip's
info-blue and its `fx` badge read it. They used to decide it two ways — the
blue from the MENU's mode, the badge from the state — so a typed condition in
list mode wore `fx` and no blue. Fixing that exposed the opposite: a chip
answered by a typed condition from the start drew its blue and never its fx,
because the badge was drawn only once a reader touched the chip. Both are drawn
from one state, at one moment, now — and only for a chip with a menu, because
on a chip without one `data-count` is the host's to set.

Proved first: all 247 existing unit tests passed on the single compiler before
anything read the new fields.

**The chip says it too**, as `data-condition="simple" | "advanced"` — absent
when it holds none. It is written again when the menu STAMPS its rows
(`menu-items`): a ticked answer cannot be read before that, so a chip ticked
by its def said nothing at all.

**And so does the grid.** `#lightFilterChip` asks `fieldState()` for its
column's condition, so a heading's `fx` and green follow the same rule as a
toolbar chip — "Is not" is Advanced there too.
TRAP T-a-held-clause-op-is-not-a-reading-op

The public attributes speak these words since 2026-09-25, and still hear the old
ones. TRAP T-a-renamed-attribute-keeps-its-old-name

- Site: `src/core/data/filter-state.ts`
- Site: `src/core/data/filter-face.ts`
- Site: `src/data.ts`
- Site: `src/components/sherpa-quick-filter/sherpa-quick-filter.ts`
- Site: `src/components/sherpa-menu/sherpa-menu.ts`
- Site: `src/components/sherpa-filter-panel/sherpa-filter-panel.ts`
- Site: `src/components/sherpa-data-grid/sherpa-data-grid.ts`
- Site: `test/unit/one-condition-system.test.mjs`
- Site: `test/e2e/reforged-one-condition-system.spec.ts`

### T-a-renamed-attribute-keeps-its-old-name

**A public attribute that is renamed still hears its old name.** The filter
modes were renamed twice: to Default and Custom Condition Filter (Will,
2026-09-25), then to Simple and Advanced (Will, 2026-09-27, TODO 75).

| first | 2026-09-25 | now, on `sherpa-menu` |
|---|---|---|
| `data-conditional` | `data-custom` | `data-advanced` |
| `data-conditions-only` | `data-custom-only` | `data-advanced-only` |
| `data-mode="select"` | `data-mode="default"` | `data-mode="simple"` |
| `data-mode="condition"` | `data-mode="custom"` | `data-mode="advanced"` |

Two kinds of alias, and they take two different doors:

- **An old NAME is kept, and the new one written beside it.** `#enforceMode()`
  adds `data-advanced` beside any old opt-in (`OLD_OPT_INS`), so
  `#offersAdvanced()`, `#advancedOnly()` and the CSS read one name, and a host
  that set `data-conditional` still reads it back. The old names are
  `observed`, so a late write is heard too.
- **A VALUE is rewritten.** `#enforceMode()` turns any old mode into `simple`
  / `advanced` (`OLD_MODES`), and the `mode` setter takes any of them. The
  menu already rewrote `data-mode` — advanced-only forces it, an un-offered
  Advanced is removed — and ONE spelling in the DOM gives the CSS and every
  reader one value to match.

**No alias for what a component WRITES.** An alias protects a host's writes.
The chip's `data-condition` (it was a boolean, `data-conditioned`), the
`filter-mode-change` detail and the panel's `filter-condition-change` detail
(`mode`, was `conditional: boolean`) are reports, and their readers follow the
new words.

**And the def.** A filter def says `advanced: true | 'only'`, the same word as
the menu, and that kind is `'advanced'`. Both are a host's writes, so both keep
their old spellings: `advancedOf()` reads `advanced`, then `custom`, then
`conditions`, and `kindOf()` believes `kind: 'custom'` and `'conditional'`
(`OLD_KINDS`). A chip's `data-kind="custom"` is still a saved filter. The new
key wins where a def names both. `OffersAdvanced` declares the key ONCE — four
def types each declared `conditions` for themselves.

- Site: `src/components/sherpa-menu/sherpa-menu.ts`
- Site: `src/components/sherpa-menu/sherpa-menu.css`
- Site: `src/components/sherpa-menu/sherpa-menu.html`
- Site: `src/core/ui/filter-kind.ts`
- Site: `test/e2e/reforged-advanced-condition-words.spec.ts`
- Site: `test/unit/the-def-speaks-the-new-words.test.mjs`
- Site: `src/components/sherpa-quick-filter/sherpa-quick-filter.ts`

### T-a-view-keeps-the-saved-filter-chips

A View pick (`setQuery(query, { holds: 'keep' })`) keeps the chips a scope
holds that the View does not name. It kept the FIELD chips and not the SAVED
filters: a View's scope replaced `presets` whole, so a View that named none —
"All customers" — took every saved filter chip off the bar, and "Reset to
default", which picks the View again, did the same. A page showed three saved
filters at rest and none after the first View pick.

Each saved filter a scope holds stays on its bar, OFF unless the View turns
it on.

- Site: `src/core/data/data-source.ts`
- Site: `test/unit/page-definition.test.mjs`


### T-a-saved-chip-lists-its-conditions

**Every saved filter's chip has a menu, and the menu LISTS its conditions** —
TODO 49, Will: *"Any preset or saved filter chip should have a menu button to
show a menu with the conditions applied."* Read-only lines, a heading per
field (`HEALTH` · Less than 60; `OWNER` · Equals Unassigned), on a bar and in
the panel. Only a reader's OWN filter had a menu before, and it held two
actions and no words.

- **The words are made once**, in `filter-face.ts`: `conditionLines(state)`
  is a line per row in force, and `sayReadings(readings, factsOf)` is a saved
  filter field by field. Several picks are ONE line (`Is one of Pro, Free`);
  a field that answers nothing — every value ticked — has no line.
- **The SOURCE says them** (`source.say(readings)`, and `says` on each preset
  it describes), because it knows a field's name, type and values. A bar
  knows only the fields it holds: left to it, `openTickets` has no name.
  Unbound, a control words the readings itself from its own defs.
- **Each field shows its OWN menu**, read-only. TODO 181, Will: *"The
  preset/saved filter menus should show the condition input rows, in read
  only mode, rather than just text labels."* `saved-filter-menu.ts` builds it
  with `menuFor`: inline, `data-readonly`, on its Advanced rows. A Simple
  answer is drawn as its picks, as OR'd rows; a date shows its calendar.
- **The field name is a direct `p.menu-section`**, so the menu's own
  `::slotted` look styles it. A field the control has no def for, or an
  on/off or selector one, stays a `p.menu-line` of words: no box, nothing to
  press.
- **A `.saved-field` group stops every event its menu sends** — none is the
  card's or the chip's — and carries the words as its `aria-description`,
  because inert rows say nothing.
- **A card drawn before its defs arrive** draws them in place when they do
  (`available()`): a field that was words becomes its menu.
- **The chip is still a TOGGLE.** A menu used to mean "a value chip": the
  bar's `active` list left such a chip out, and its `values` setter switched
  it off. Both ask the def now (`#isSaved`).

- Site: `src/components/sherpa-filter-panel/sherpa-filter-panel.html`
- Site: `src/components/sherpa-filter-panel/sherpa-filter-panel.ts`
- Site: `src/components/sherpa-menu/sherpa-menu.css`
- Site: `src/components/sherpa-menu/sherpa-menu.html`
- Site: `src/components/sherpa-menu/sherpa-menu.ts`
- Site: `src/components/sherpa-quick-filter-toolbar/sherpa-quick-filter-toolbar.html`
- Site: `src/components/sherpa-quick-filter-toolbar/sherpa-quick-filter-toolbar.ts`
- Site: `src/core/data/data-source.ts`
- Site: `src/core/data/filter-face.ts`
- Site: `src/core/ui/filter-menu.ts`
- Site: `src/data.ts`
- Site: `test/e2e/reforged-saved-filter.spec.ts`
- Site: `test/unit/filter-face.test.mjs`
- Site: `src/core/ui/saved-filter-menu.ts`
- Site: `test/e2e/reforged-saved-filter-edit.spec.ts`

### T-a-saved-filter-is-its-readings

**A saved filter is a name and its READINGS, field by field — never a
clause.** Will, 2026-09-25: presets *"are actually compound conditional filters
that (potentially) use more than 1 field and those fields values"*, and a
reader must be able to save and edit their own.

Readings, because readings are what the fields HELD. Edit puts them back into
those fields (§16.6, pack / unpack); a clause cannot be re-opened in any UI. So
`{ health: { op: 'lt', text: '60' } }`, not `['health', 'lt', 60]` — and the
data layer compiles it, with the field's type, as it compiles every reading.

**It applies as ONE named part.** A def with `readings` is a toggle of kind
`advanced`. The bar reports every ON one in `savedReadings`, by chip id, and a
bound source applies each with `apply(readings, { reach: 'component', key:
'saved:<id>' })` — so two saved filters AND, one over two fields is one part,
and one switched off takes its part with it (`bind.saved`).

**The chip draws it.** An `advanced` chip with no FILTER menu holds a given answer
(`#given()`), so it reads as `data-condition="advanced"` and wears `fx` from
the start, and the info-blue when on. It has no field menu to derive either from.

Before this the page held a `TOGGLES` map of id → clause and contributed the
ON ones itself, so a preset was a chip in one file and a query in another.

- Site: `src/core/ui/filter-kind.ts`
- Site: `src/components/sherpa-quick-filter-toolbar/sherpa-quick-filter-toolbar.ts`
- Site: `src/components/sherpa-quick-filter/sherpa-quick-filter.ts`
- Site: `src/components/sherpa-quick-filter/sherpa-quick-filter.html`
- Site: `src/core/data/data-source.ts`
- Site: `src/components/sherpa-filter-panel/sherpa-filter-panel.ts`
- Site: `src/core/browser/saved-filters.ts`
- Site: `src/core/data/filter-state.ts`
- Site: `src/data.ts`
- Site: `test/e2e/reforged-saved-filter.spec.ts`
- Site: `test/unit/a-saved-filter-is-its-readings.test.mjs`

### T-a-saved-filter-keeps-its-edit

**A reader's own saved filter can be CHANGED from its menu, and the change is
an EDIT: applied now, not saved.** Will, TODO 50: *"rows that can be edited.
On a filter the reader SAVED that is applied, an edit is a temporary DRAFT;
the saved filter does not change. When the draft differs, the menu … offer[s]
Save."* Called an EDIT in the code: the source's `#draft` and a View's drafts
(144) already use the other word.

- **The QUERY owns it** — `scopes[id].edits[presetId]`, beside `presets`. An
  ON saved filter compiles from its edit; the library keeps what was saved.
  So a reload, a View save and a second view all see it — once the provider
  hears `preset-edit` and keeps the Query, as it keeps a switch. A bar and the panel
  only REPORT one (`preset-edit`), and are drawn it back
  (`drawScope`'s `edits`, `describe`'s `edited`).
- **No change is no edit.** An edit equal to what was saved is dropped — by
  `editPreset`, and by `declarePreset` when the change is saved. It goes
  with its filter: taken off the bar, or deleted.
- **Edit filter edits IN PLACE** (TODO 181). It carries `data-stay-open`
  (`T-an-action-row-can-keep-its-menu-open`) and lifts each field menu's
  `data-readonly`; Save filter and Discard changes show, Edit and Delete step
  aside. Its rows are the field's own menu (`T-a-saved-chip-lists-its-conditions`).
- **The change is a DRAFT until editing ends**: the card closes, Save filter
  is pressed, or the bar or the panel rebuilds under it (`#render`, `#draw`
  — the panel redraws every scope on each source draw). Then ONE
  `preset-edit`, folding in only the fields that moved, each read with its
  type — a date read as text was dropped. Nothing moved, nothing is sent.
  Discard puts the saved rows back.
- **Its source draws it back IN PLACE** (`drawScope`'s `edits`): the card is
  not rebuilt, so an open one stays open.
- **Only a reader's OWN saved filter (`editable`) offers Edit filter and
  Delete filter**; an app preset is the app's. **Delete is not Remove**:
  Remove takes a chip off the bar to wait in the Add menu; Delete takes it out
  of both, and `filter-delete` tells the host to forget it.
- Unpack — the answer put back into its fields — is gone. Edit filter shows
  the rows where they are, which is what TODO 49 asked for.
- **Read the card OPEN in a test.** WebKit keeps a stale computed style for a
  row inside a shut card: Edit filter read as hidden after editing ended.
- **ON FIRST, then the edit.** A filter that is off comes on as its change
  is applied. The source draws the scope a moment later from a COPY; sent
  the other way round, the copy had it off and switched it off again.
- **Saved under a NEW name**, the change is spent: its old filter goes back
  to what it saved, and off (`packFilter`).
- **It wears the pending look** (`data-edited`), not `data-pending`: a
  pending chip draws no count, and an edited one is applied.
- A number saved as rows has no `mode`, so its rows decide it, as a list's
  do. It opened Simple, with its rows hidden.

Not built: Save in the panel section's header. Will ruled in 117 that a
scope's header holds nothing to press; Save is in the chip's own menu.

- Site: `src/core/data/query.ts`
- Site: `src/core/data/data-source.ts`
- Site: `src/core/ui/filter-menu.ts`
- Site: `src/components/sherpa-provider/sherpa-provider.ts`
- Site: `src/components/sherpa-quick-filter-toolbar/sherpa-quick-filter-toolbar.ts`
- Site: `src/components/sherpa-quick-filter-toolbar/sherpa-quick-filter-toolbar.html`
- Site: `src/components/sherpa-quick-filter/sherpa-quick-filter.ts`
- Site: `src/components/sherpa-quick-filter/sherpa-quick-filter.html`
- Site: `src/components/sherpa-quick-filter/sherpa-quick-filter.css`
- Site: `src/components/sherpa-filter-panel/sherpa-filter-panel.ts`
- Site: `src/components/sherpa-filter-panel/sherpa-filter-panel.html`
- Site: `test/e2e/reforged-saved-filter-edit.spec.ts`
- Site: `test/unit/a-saved-filter-keeps-its-edit.test.mjs`
- Site: `src/core/ui/saved-filter-menu.ts`
- Site: `src/components/sherpa-quick-filter-toolbar/sherpa-quick-filter-toolbar.css`
- Site: `test/e2e/reforged-saved-filter.spec.ts`
- Site: `src/components/sherpa-filter-panel/sherpa-filter-panel.css`

### T-save-packs-the-fields-into-one-chip

**Save moves the answered fields into ONE chip, which comes on, and the fields
clear — pack.** Will, 2026-09-25, choosing *"Pack / unpack"*. Nothing filters
twice, and no second editor is needed: Edit puts the answer back (unpack).

**The bar ASKS; the host keeps.** A host that saves filters sets
`data-saveable` on the bar. "Save filter" then shows only where there is
something to save — in the menu of a chip holding an Advanced filter, and in
the Add menu once any field is on — and fires `filter-save { readings }`, each
field as `savedReading()` gives it. The host names it, stores it
(`saveFilterAs`), and hands it back with `packFilter({ id, label, readings })`.

`packFilter` clears the fields FIRST, then rebuilds — the rebuild carries every
other chip's answer across (`T-a-rebuild-keeps-every-answer`) — switches the
saved chip ON even where it was already on the bar and off, and fires ONE
event, so the source sees the part arrive and the fields go in one report.

**A saved chip cannot take a FIELD's id** — two chips with one id — so
`packFilter` reports `id-taken`. The Records page names its own
`custom:<id>`.

A ticked, DEFAULT answer is not saveable from its own chip: the ask was to turn
a CONDITION into a chip. The Add menu packs it with the rest.

- Site: `src/components/sherpa-quick-filter-toolbar/sherpa-quick-filter-toolbar.ts`
- Site: `src/components/sherpa-quick-filter-toolbar/sherpa-quick-filter-toolbar.html`
- Site: `src/components/sherpa-menu/sherpa-menu.ts`
- Site: `src/components/sherpa-menu/sherpa-menu.html`
- Site: `test/e2e/reforged-saved-filter.spec.ts`

### T-the-panel-saves-a-whole-scope

**The panel answers for the bar in panel mode — the bar is hidden then — so it
needs every door the bar has for saved filters.** Will, 2026-09-25: *"We can
also allow creating multi-field conditional boolean chips from a whole filter
scope."*

- **A whole SCOPE saves as one chip.** With `data-saveable`, a scope that has
  an answered field shows "Save filter", and pressing it fires `filter-save {
  scope, readings }`: every answered field, as `savedReading()` gives it —
  never the Presets, which are saved filters already, and never Group or Sort.
- **A saved preset wears `fx`.** A preset carrying `readings` is drawn with
  kind `advanced`, and a chip with no filter menu then reads as Advanced by itself
  (`T-a-saved-filter-is-its-readings`).
- **A reader's own preset offers Edit filter and Delete filter.** Edit filter
  edits its rows in place, through the same helper the bar uses
  (`T-a-saved-filter-keeps-its-edit`); nothing is asked. Delete the panel
  ASKS for — `filter-delete` — as it asks for Add and Remove. The BAR owns the
  list (`T-a-panel-adds-through-the-bar-that-owns-the-list`), so the host
  answers through `packFilter` and `deleteFilter` and refills the panel.

**Two holes this found in what the panel is told.** The bar's `held` gave a
chip with no field reading — a toggle, a saved filter — the `active` of its def,
not whether it was on; and the Records page's `asPanelField` did not pass
`active` at all, so every preset in the panel read off, whatever the bar said.

- Site: `src/components/sherpa-filter-panel/sherpa-filter-panel.ts`
- Site: `src/components/sherpa-filter-panel/sherpa-filter-panel.html`
- Site: `test/e2e/reforged-saved-filter.spec.ts`

### T-saved-filters-are-the-custom-section

**Saved filters are offered LAST in the Filters menu, under "Saved filters".**
Will, 2026-09-25: *"add them to the add filters menu under a 'Custom' section
at the bottom"*; renamed "Saved filters" on 2026-09-29 (TODO 105). Only the ones not added: a held saved filter is under Added
filters, with every other filter the bar holds (`T-one-filters-button`).

A def with `readings` IS a saved filter, so the bar needs no second list: the
host hands them over through `available()` beside the fields. A saved chip
taken off the bar goes back there by itself (`#removeFilter`).

**The heading is the MENU's**, not the bar's: `MenuItem.section` names the
section an item is in, and the menu draws a heading row where it changes. Its
search hides a heading when nothing under it matches — a heading is never
matched on its own name, so "Saved filters" over no rows cannot happen.

**One added from there comes ON.** A new field chip comes off, because on with
no answer is the amber warning (`T-a-new-chip-opens-in-default-not-warning`);
a saved filter IS its answer.

The heading row is a `.menu-row`, so a re-stamp removes it with the rows it
heads.

- Site: `src/components/sherpa-menu/sherpa-menu.ts`
- Site: `src/components/sherpa-menu/sherpa-menu.css`
- Site: `src/components/sherpa-quick-filter-toolbar/sherpa-quick-filter-toolbar.ts`
- Site: `test/e2e/reforged-saved-filter.spec.ts`
- Site: `src/core/ui/filters-button.ts`
- Site: `src/components/sherpa-provider/sherpa-provider.ts`

### T-row-one-is-data-op

**A filter menu's FIRST condition row is `data-op` and `data-value`.**
`#syncConditions` rebuilds row one from those two on every sync — any
attribute the menu observes — which is how a re-stamp keeps what was typed.

So rows set from outside, with the two left behind, lasted only until anything
moved. `setChipReading` wrote "contains Da" as rows while `data-op` still said
`eq`, and the next sync turned it into an empty equals. Measured on the Records
page: the Owner chip read `conditions: [{ op: 'eq' }]` 300ms later. Found when
Save flagged the menu (`data-saveable`), which is a sync — but the panel and
`#keepAnswer` write rows the same way.

`set conditions` now writes row one's op and typed value back to the two
attributes, so the menu's own record and its rows agree.

- Site: `src/components/sherpa-menu/sherpa-menu.ts`
- Site: `test/e2e/reforged-menu-row-one.spec.ts`
- Site: `test/e2e/reforged-a-chip-press-applies-its-draft.spec.ts`

### T-a-rebuild-keeps-every-answer

**A rebuild of the bar must carry each chip's WHOLE answer — its op, what was
typed, and its condition rows — not only on/off and ticks.**

`#render` rebuilds the chip run whenever a filter is added or taken away, and
a new menu starts from its def. `T-render-captures-live-state` carried on/off
and the ticks across; nothing carried the rest. Measured: a chip answering
"Owner contains Da OR is Ravi" read `conditions: []` after "Plan" was added
beside it. So adding one filter silently took another one's condition away.

**And the event said so first.** A menu that has not drawn DROPS rows —
`set conditions()` returns when its shadow region is not there — and the
rebuild's own `quick-filter-change` goes out before any menu has drawn. So even
a restore that waited would have been too late: the source had been told the
rows were gone.

So `#render` reads `readings` BEFORE it rebuilds, and `#keepAnswer` holds each
chip's op, typing and rows in `#pendingAnswers`. `readings` answers from there
while the new menu draws, so a report sent at once still has them; once the
menu has drawn they go into it, and the chip is set on or off as it was, which
re-draws its face. A later rebuild takes over from an earlier one.

This was found building pack (`§16.6`), which rebuilds the bar — it would have
taken every OTHER chip's Advanced condition with it.

- Site: `src/components/sherpa-quick-filter-toolbar/sherpa-quick-filter-toolbar.ts`
- Site: `test/e2e/reforged-a-rebuild-keeps-every-answer.spec.ts`

### T-a-saved-filter-lives-with-its-data

**A saved filter is kept per DATA, not per page.** Will, 2026-09-25:
*"These saved custom filter configurations won't be able to transcend data
sources/stores."* Its readings name fields, and other records may not have them.

So `saveFilterAs(data, label, readings)` takes the NAME of the records it
filters — the store, not the page — and every page over those records sees the
same set, while a page over other records sees none. Otherwise it is the
saved-view door: localStorage by default so every tab shares it, a
`sherpa:filters:` prefix, and the whole set handed back from every write.

**The same name saves over the old one** (`T-derived-id-makes-resave-an-update`)
— which is how Edit, then Save, updates a filter rather than making a second.
The id rule is `labelId()` in `web-storage.ts`, shared with saved views; a
second copy of it was the first step to two ids for one name.

**A broken entry is DROPPED on read**, one at a time: a set is trusted in shape
and never in content, and a bar handed `{ label: 3 }` would draw a chip with no
answer.

- Site: `src/core/browser/saved-filters.ts`
- Site: `test/e2e/reforged-saved-filter.spec.ts`
- Site: `src/components/sherpa-provider/sherpa-provider.ts`

### T-a-held-clause-op-is-not-a-reading-op

**The grid held a CLAUSE op, and handed it to the data layer as a READING op.**

A column filter keeps the op its clause has: several ticks under `eq` are
`in`, under `ne` are `notin`, and two ends are `between`. `#columnReading()`
passed that op to `readingClause()` unchanged. But a reading's op is what the
reader picked in the dropdown — `eq` or `ne` — and `picksClause()` makes
`notin` only from `ne`. Given `notin`, several picks became `in`.

So "Is not Pro, Free" reached the host as `['plan', 'in', ['Pro', 'Free']]`:
exactly the rows the reader excluded. Measured in the browser —
`columnClause('plan')` returned `in`.

It hid behind the menu. The column's own dropdown was fed through the same
mapping (`in` → `eq`, `notin` → `ne`), so the menu read right; only the
clause the HOST got was wrong.

`readingOp()` is that mapping, once, for both. It also makes the column's
`state.condition` honest: `between` is a clause op, not an Advanced one, so a
range reads Simple, as it does on a toolbar chip.

- Site: `src/components/sherpa-data-grid/sherpa-data-grid.ts`
- Site: `test/e2e/reforged-advanced-condition-words.spec.ts`

### T-up-is-open-down-is-closed

What may be filtered WHERE. Will, 2026-09-25:

> *"Any component field can be applied to the view scope as a filter. Only
> component fields can be added to that component's scoped filters."*
>
> *"A filter can't exist in both the view and component scope so adding to one
> removes it from the other. However, the same filter can exist across
> multiple component scopes."*

Four rules, and they are not symmetric:

| | |
|---|---|
| **UP is open** | the view may hold any field ANY component has |
| **DOWN is closed** | a component may hold only its OWN fields |
| **VIEW / COMPONENT exclusive** | raising a filter takes it out of EVERY component |
| **COMPONENT / COMPONENT not** | two grids may both filter `owner` |

The registry needed a second fact to say it. `hold()` records what a scope is
filtering NOW; `offer(name, fields)` records what a component HAS. They are
different questions, and answering "may it hold this?" from "is it holding
this?" would forbid every first filter.

| | |
|---|---|
| `offer(name, fields)` | a component's own fields. The view needs none |
| `fields(name)` | its own, or for the view the union of every component's |
| `canHold(name, field)` | `name === VIEW_SCOPE` or the component has it |
| `move(field, from, to)` | ONE call, ONE `scope-change` naming every scope it touched |

**`move()` is one call because the removal is not optional.** Two `hold()`s
can be interrupted between them, and a field filtered in both the view and a
component has nobody owning it. Its single event means no listener ever sees
the field in both places, or in neither.

**A refusal is not half a move.** A component asked to hold a field it does
not have changes NOTHING and reports `scope-refused` — see
`T-a-broken-assumption-reports`.

`VIEW_SCOPE` is `'view'`, the same word as `reach: 'view'`, exported so no
caller spells it twice.

**Raising carries the answer.** Before this, raising Status from the grid gave
the header an EMPTY, off chip and greyed the grid's, while the rows stayed
filtered by a pick no visible chip showed. The app now reads the grid's
reading BEFORE superseding, `move()`s the field, writes the reading onto the
new header chip with `setChipReading`, and has both bars `report()`.
**Lowering** lets the field go: the grid chip comes back with its OWN kept
picks. And the selection mirror must never write into a SUPERSEDED chip — it
was writing the grid's emptied answer into it on every raise.

**The Add menu says where a field lives.** A row can carry a `note` — "in
Customer records" — drawn muted by `::slotted(.menu-row[data-note])::after`,
the one part of a slotted row the menu's sheet can reach, and read out through
`aria-description`. Measured the same in all three engines.

- Site: `src/core/data/data-source.ts`
- Site: `src/data.ts`
- Site: `test/unit/up-is-open-down-is-closed.test.mjs`
- Site: `test/e2e/reforged-menu-row-note.spec.ts`

### T-a-record-has-a-time-of-its-own

**Every record says WHEN it is from, the way it says WHO it is.** A store names
both: `{ key: 'email', time: 'created' }`.

Will, 2026-09-25: *"The view scope filters in the examples have a 'Created
date' filter that targets the 'Created' field. This should just be a generic
Date filter to filter all view data by a specific date or date range. This
means that every data record needs a generic timestamp for this to work. It's
useful for other reasons, too. It also allows all data to have a history of
values."*

Before this the VIEW's date chip only worked because the Records dataset
happened to have a column called `created`. The header mapped
`dateRange → 'created'` by hand, the chip was labelled "Created date", and the
app declared `created` a date itself. Point a second dataset at the same header
and the chip filtered nothing, silently.

Now:

| | |
|---|---|
| `StoreOptions.time` / `Store.time` | which field is the record's time. **No default** — a store with no time has none, rather than a guess |
| `DataSource` | declares that field a date on construction, and exposes `timeField` |
| `debugState().time` | the field, or `null` — which explains a Date filter that narrows nothing |
| the header chip | "Date", bound to `source.timeField` |

**No default is deliberate.** `'created'` would be the exact assumption this
removes: a dataset whose records are stamped `occurredAt` would get a Date
filter over a column it does not have, and no error.

What it buys, unscheduled: a record with a known time can be ORDERED newest
first without naming a column, COMPARED to itself (a metric's delta, a
sparkline's series), and BOUNDED "as at" a date — which is what a history of
values is. `FILTER-REVIEW.md` §7 step 4c and §19 carry the rest.

- Site: `src/core/data/store.ts`
- Site: `src/core/data/base-store.ts`
- Site: `src/core/data/data-source.ts`
- Site: `test/unit/a-record-has-a-time-of-its-own.test.mjs`

### T-a-date-chip-names-its-field

Two faults in the Records example's header date chip, both of which made it
look broken when the machinery underneath was fine.

**It was labelled "Date range".** A chip names the FIELD it filters — "Created
date" — because a reader cannot act on one that does not say which date.
`Region` and `Customer` beside it both name their field; this one named its
shape.

**Superseded 2026-09-25 for the VIEW chip.** It is labelled "Date" now, because
it filters the RECORD'S TIME rather than a column called `created` — see
`T-a-record-has-a-time-of-its-own`. The rule still holds for a component-scope
date chip over one named column.

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

- Site: `src/core/data/data-source.ts`

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

- Site: `src/core/ui/sherpa-element.ts`
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

- Site: `src/core/ui/sherpa-element.ts`
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

- Site: `src/core/ui/sherpa-element.ts`
- Site: `src/components/sherpa-menu/sherpa-menu.ts`
- Site: `src/components/sherpa-tooltip/sherpa-tooltip.ts`
- Site: `test/e2e/reforged-menu.spec.ts`

### T-a-tooltip-is-not-an-axis

An axis COMPACTS because it carries four labels and has no room: `1.3M`, not
`1250500`. A tooltip carries ONE label and exists **because** the reader wants
the number.

**And the compaction itself had an edge.** Rounding crosses the threshold the
test just passed: 999,999 is under a million, so the M tier was skipped, and a
tenth of a K rounded it to 1000 — the axis read **"1000K"**. Same one tier
down, where 999.5 read "1000" rather than "1K". `formatTick` tries the units
SMALLEST first and hands a value that rounds out of its own tier to the next;
largest-first cannot work, because the bigger tier is skipped before the
smaller one discovers the overflow.

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

- Site: `src/components/sherpa-radial-chart/sherpa-radial-chart.ts`
- Site: `src/components/sherpa-metric/sherpa-metric.ts`
- Site: `src/components/sherpa-sparkline/sherpa-sparkline.ts`
- Site: `src/core/data/format-tick.ts`
- Site: `test/e2e/reforged-barchart.spec.ts`
- Site: `test/unit/format-tick.test.mjs`
- Site: `src/core/ui/chart-parts.ts`
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

- Site: `src/core/data/aggregate.ts`
- Site: `src/components/sherpa-metric/sherpa-metric.ts`
- Site: `test/e2e/reforged-metric.spec.ts`

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

One press is not a walk-away: the chip's own body APPLIES its open draft
(`T-a-chip-press-applies-its-menus-draft`). A saved filter's in-place edit
has no Apply, so a close KEEPS it, as an edit (`T-a-saved-filter-keeps-its-edit`).

- Site: `src/components/sherpa-menu/sherpa-menu.ts`
- Site: `test/e2e/reforged-menu.spec.ts`

### T-a-chip-press-applies-its-menus-draft

**A press on a chip's body, while its menu is open with a draft, APPLIES the
draft.** Will, 2026-09-25: values typed in condition rows were not applied
when he *activated the chip*.

The press shut the menu, and a committing menu throws its draft away when it
shuts any way but Apply (`T-a-draft-dies-with-its-menu`). So a reader typed
"contains Da", pressed the chip to turn it on, and got nothing — no filter,
and the rows they typed gone.

The menu says whether it holds one — `dirty`: open, committing, and its ticks
or rows differ from what it opened with — and `apply()` is its Apply button.
The chip asks, and applies. With nothing drafted, a press does what it did.

- Site: `src/components/sherpa-menu/sherpa-menu.ts`
- Site: `src/components/sherpa-quick-filter/sherpa-quick-filter.ts`
- Site: `test/e2e/reforged-a-chip-press-applies-its-draft.spec.ts`

### T-a-chart-datum-is-reachable-without-a-pointer

A chart's tooltip carries the NUMBER. If only `:hover` reveals it, the number
is pointer-only — the chart draws data a keyboard reader cannot get at.

`sherpa-barchart` and `sherpa-line-chart` already made each mark a `<button>`,
so both were fine. `sherpa-radial-chart` and `sherpa-gauge-chart` lit their tips
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

- Site: `src/components/sherpa-radial-chart/sherpa-radial-chart.ts`
- Site: `src/components/sherpa-radial-chart/sherpa-radial-chart.css`
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

- Site: `src/components/sherpa-radial-chart/sherpa-radial-chart.ts`
- Site: `test/e2e/reforged-radial-chart.spec.ts`

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

Since 2026-09-25 each is a saved filter that carries its own answer, and
the page holds no clause for it. TRAP T-a-saved-filter-is-its-readings

- Site: `src/core/data/page-definition.ts`

### T-component-extends-view-never-alters-it

**The rule lives in `docs/DATA-SOURCE-RULES.md`, section 6** — two scopes, one
field one scope, and a superseded chip. It is a data-layer rule, so it belongs
with the other data-layer rules rather than in a trap.

What belongs HERE is why there is no module for it.

`filter-scope.ts` was 121 lines and three functions written before anything
called them, and nothing ever did: Records has one `DataSource`, so there was
no second scope to follow. The rule needs no module — a component source takes
the view's filter as one named part, which `DataSource.contribute()` already
does, and the wiring is three lines.

Guessing an API in advance cost more than waiting for the caller. `promotions()`
returned `{ id, values }`, which silently dropped the op and the typed text, so
a field promoted while holding "Starts with Go" would have arrived in the view
saying only "Go". Nothing caught it, because nothing ran it.

See `T-a-superseded-chip-suspends-it-is-never-removed`, which IS implemented,
on the half a component owns.

- Site: `src/core/data/data-source.ts`

### T-a-constructed-event-is-not-a-dispatched-one

`new CustomEvent(...)` builds an object. Only `dispatchEvent` makes it public.

The spec generator scanned for `new CustomEvent('name'` and wrote every hit
into the contract as an event. `sherpa-data-grid` constructs
`new CustomEvent('menu-clear', { detail: {}, bubbles: false })` and passes it
straight to a handler as a plain argument — it is never dispatched — so the
grid's contract carried a tenth event that no listener could ever receive.

`bubbles: true` is the tell, and it is already the house rule: every public
Sherpa event sets it, and `emit()` sets it for you. So the scan now requires
`bubbles: true` on the constructor call. A private event object built for a
handler does not set it, and is correctly left out of the contract.

- Site: `scripts/generate-component-spec.mjs`

### T-kind-says-how-not-whether

A prop's `kind` says **how** it is realised. `observed` says **whether** the
component watches it. They are independent, and for a long time one field
carried both meanings.

`compileDef` derived the observed list from `kind !== 'style'`, because the spec
had no other channel for it. So the generator was forced to write `kind:
content` onto any attribute a component observed — including CSS-only ones,
which write no text at all. Measured before the fix: **156 props across 39
components** claimed `kind: content` with nothing in their TS to back it.

Nothing rendered wrong. What was wrong is what a reader was told: the MCP
server, and any agent reading a spec, saw 156 attributes that write text into
the shadow DOM and do not.

Three changes close it:

- the schema gained `observed`, and `kind`'s description now says it is not a
  statement about observation;
- `compileDef` reads `observed` when a spec carries one, falling back to the old
  `kind !== 'style'` signal for a spec written before the field existed;
- `parsePropKinds` reads `static override props`, which is the only honest
  source for `kind` — an entry with a `to:` selector IS content, because that is
  what `to` means to the base class. The TS beats a prior spec's inferred kind.

Afterwards: 43 `kind: content` props remain, and every one is backed by a real
declaration.

- Site: `scripts/lib/ts-facts.mjs`
- Site: `scripts/lib/generation/compile-def.mjs`
- Site: `scripts/generate-component-spec.mjs`

### T-a-shared-enum-is-not-every-enum

`SHARED_PROPS` says its entries have a shape "identical wherever they appear".
For `data-size` that is true of the three components that import it —
`empty-state`, `loader` and `section-header` all ship `sm | md | lg` — and NOT
true of the library as a whole.

`sherpa-button` ships **five**: `2xs xs sm lg xl`. It does not import
`SHARED_PROPS`, and it must not: adopting the shared entry would hand the
system's most-used control an enum missing three of its sizes.

The two never meet in code today, so nothing is broken. What the audit found is
an invitation: a future component that reaches for the shared entry because the
name matches inherits the smaller vocabulary silently, and nothing at runtime
validates an enum.

Two related facts worth keeping together:

- **`md` was missing from the shared entry.** All three importers document it as
  the default, and their CSS draws it on the bare `:host` — `sherpa-loader.css`
  says so in its own comment, `/* Sizes (unset = md) */`. The specs were right
  (they read the HTML comment); only the TS declaration was short. Listing a
  default in the enum is the house pattern — `data-sort-direction` already
  carries `''` for the same reason.
- **A size enum is per-tier, not global.** A control and a container do not have
  the same size vocabulary, in the same way that `data-label` and
  `data-heading` split by tier.

- Site: `src/core/ui/sherpa-element.ts`
- Site: `src/components/sherpa-button/sherpa-button.ts`

### T-a-generated-region-still-declares-api

`check-props` used to slice a component's CSS at
`/* == end sherpa:tokens == */` and scan only what lay below, borrowing the rule
from `lint:css`.

That rule is right for LINTING — everything above the marker is Figma's, and
hand-editing it is undone by the next projection. It is wrong for a CONTRACT. A
`:host([data-size])` rule is public API wherever it sits, and the projection
puts several there: `data-size` on `sherpa-button` (the five-value enum, at line
15 of a file whose marker is at line 60) and `data-state` on
`sherpa-input-text` were both invisible to the gate for that reason.

Scan the whole file. Edit the region in Figma.

- Site: `scripts/check-props.mjs`

### T-a-read-is-public-api-a-write-is-not

`this.hasAttribute('data-locked')` is a host's instruction arriving. The
component did not put it there, so the attribute is public API and belongs in
the spec — the same event as reading `this.dataset`, which the gate already
caught.

`this.setAttribute('data-copied', '')` is not. 25 components toggle their own
transient state this way — `data-resizing`, `data-leaving`, `data-dragover` —
and a gate that flagged those would be asking a component to declare its own
private flags as API.

So the read half of `*Attribute()` is gated and the write half is not.
Measured when the rule was written: 43 undeclared attributes in total, splitting
14 read-only, 25 write-only and 4 both. The 14 were the real gap, and five of
them were `data-locked` — the attribute the whole state-ownership convention
rests on, undeclared by every component that obeys it.

**The `data-has-*` skip survives this rule**, which was not obvious. All seven
hand-written ones — `data-has-files`, `data-has-value`, `data-has-y-axis`,
`data-has-values`, `data-has-query`, `data-has-organise` — are written by the
component and read only by its own CSS. Never read from a host, so never public
API, so correctly exempt. The audit had listed the skip as a third hole; it is
not one.

- Site: `scripts/check-props.mjs`

### T-writing-a-child-is-not-owning-yourself

`check-ownership` flags a component that writes a value the `DataSource` owns.
Its write regex was unanchored, so `chip.setAttribute('data-current', …)` read
the same as `this.setAttribute('data-current', …)`.

They are opposites. A parent writing a CHILD's attribute is configuring
something it owns — and the two components that do it most,
`sherpa-quick-filter-toolbar` and `sherpa-data-grid`, declare those chips
`data-locked` **in their own markup** precisely so that they can. The grid says
so beside the declaration: a chip derives its on-state from checked rows, and
this menu has none, so unlocked it switches itself off the instant Apply closes.

Measured across the tree: **25 `data-current` writes, 22 of them to a child**.
The remaining 3 are all inside a `set current(v)` accessor, which the gate
already exempts — a setter is the host's own door for writing the value.

So adding `data-current` to `DATA_PROPS` with the old regex would have reported
22 faults and zero real ones. The regex now requires `this.`, and covers
`toggleAttribute` and `removeAttribute` as well as `setAttribute` — a gap that
had hidden real self-writes, verified by planting one and watching it fail.

- Site: `scripts/check-ownership.mjs`

### T-scroll-state-is-chromium-only

`container-type: scroll-state` and `@container scroll-state(stuck: top)` are
**Chromium only**. Measured in all three engines 2026-09-23: Firefox and WebKit
drop the property and report `containerType: "normal"`.

`sherpa-app-header` uses it, where it is itself in a scroller, to take a drop
shadow once content slides underneath, with no JS. That degrades correctly —
the header is still `position: sticky`, still `z-index: 1`, still opaque, in
every engine. Only the shadow is missing. The data grid's pinned edges use
`scrollable` the same way.

A test must not assert the property in every engine. Assert that the guard
and the engine AGREE:

```ts
expect(containerType.includes('scroll-state')).toBe(CSS.supports('container-type', 'scroll-state'));
```

That catches Chromium losing the feature as well as an engine gaining it,
which a hardcoded expectation cannot.

In the APP SHELL the header is no longer in the scroller, so it is never
stuck: the shell draws the shadow another way (`T-only-the-context-scrolls`).

- Site: `src/components/sherpa-app-header/sherpa-app-header.css`

### T-only-the-context-scrolls

**In `sherpa-app-shell` only the CONTEXT scrolls. The header and both panel
areas stay where they are** — TODO 142, Will: the filter panel area
"shouldn't scroll with the other page content … it needs to be outside of
that scrollable wrapper". `.content` was the scroller, holding the header
(sticky) and the body row — panels and Context together — so a long page took
the filter panel up with it. The scroller is `.context-frame` now. The DOM
did not change: `.content` is `overflow: hidden`, a column of the header and
the body row, and each panel area fills the row's height and scrolls inside
itself.

**The header's shadow** came from `scroll-state(stuck: top)` on a sticky
header, and a header outside the scroller is never stuck. It follows the
scroller's TIMELINE instead: `.context-frame` names a scroll timeline,
`.content` lifts it into scope (`timeline-scope`) so a non-descendant can use
it, and the slotted header's `box-shadow` is an animation over the first
pixel of scroll. No JS. It is inside `@supports`, because without a scroll
timeline the same animation runs on the CLOCK and leaves the shadow on for
good. Chromium and WebKit have it; Firefox 155 does not, and draws no shadow.

**The shadow FADES, and the timeline cannot do that itself** (TODO 161). An
animation over one pixel of scroll is a snap, and a transition cannot follow
an animation on its own element. So the timeline animates a PROPERTY on the
header's area — `--_header-shadow`, unregistered, so it flips — and the
slotted header's `box-shadow` reads it and carries the transition. The
property needs a value to start FROM: with none, WebKit runs the animation
to the end and never applies the keyframe.

**A scroll-driven animation never FINISHES.** `__settled()` waited for every
animation's `finished` promise, and every test on a page with this one hung.
It waits for animations on the document's own timeline only.

- Site: `src/components/sherpa-app-shell/sherpa-app-shell.css`
- Site: `src/components/sherpa-app-shell/sherpa-app-shell.html`
- Site: `test/e2e/reforged-app-shell.spec.ts`

### T-a-hairline-resolves-by-density

The border token is `0.5px`, and what a browser resolves that to depends on the
DISPLAY, not only on the engine. Measured in all four combinations:

| engine | dpr 1 | dpr 2 |
|---|---|---|
| Chromium | 1px | 1px |
| WebKit | 1px | **0.5px** |

WebKit at `deviceScaleFactor: 2` is the honest one — half a CSS pixel is exactly
one device pixel there, so there is nothing to round up. Playwright's
`devices['Desktop Safari']` sets `deviceScaleFactor: 2`, which is why only the
webkit project saw it, and why it looked like a flaky failure that "belonged to
border-token work".

`reforged-border-edges.spec.ts` hardcoded `1px/1px/1px/1px` and reported all 20
sites as broken on webkit. It now resolves the token once in the page and
compares every site against that, plus a bound that keeps the real regression
caught: a `border-style` with no width falls back to `medium` (3px), which is
what the test was written for. Verified by planting `border-width: medium` on
`sherpa-tag` and watching it fail.

- Site: `test/e2e/reforged-border-edges.spec.ts`

### T-a-grid-group-needs-css-if

`.sherpa-group-grid` computes each cell's column and row in a VALUE, then picks
its edges with CSS `if()` and `style()` queries. `if()` is **Chromium and WebKit
only** — Firefox has none.

`sherpa-grouping.css` already handles this, and says so beside the gate: *"The
`@supports` gate is for `if()`; without it every cell keeps the outer box below,
which is correct, just not joined."* So in Firefox a grid draws six separate
boxes rather than one joined block. That is the intended fallback, not a bug.

A ROW or a COLUMN group does not need `if()` — those use `:first-child` /
`:last-child` — which is why only the two grid tests failed.

The tests now branch on `CSS.supports('width', 'if(style(--x: 1): 1px; else: 2px)')`
and assert the documented fallback where it is absent, rather than asserting the
joined result everywhere.

- Site: `test/e2e/reforged-grouping.spec.ts`
- Site: `src/components/sherpa-group/sherpa-group.css`
- Site: `test/e2e/reforged-group.spec.ts`

### T-settled-waits-for-renders-not-transitions

`__settled()` waits for every `sherpa-*` element's `rendered` promise, drains
the microtask queue between passes, and then waits two animation frames. None of
that waits for a CSS **transition**.

`sherpa-nav` animates its own `inline-size` over 160ms as it settles to the
collapsed 40px. A measurement taken after those two frames can still catch the
host mid-flight — 292px, or 232px, on the way to 40 — and the search row inside
it then measures 216px instead of 24px.

It looked like flakiness because it only appears under CONCURRENCY. Measured
with twelve pages driven at once, same code, only the harness differing:

| | bad runs |
|---|---|
| before | **4 of 12** — `host: 232, searchW: 216` |
| after | 0 of 12 |

`__settled()` now also awaits `document.getAnimations()`. A rejection means the
animation was cancelled, which is settled too, so each is caught.

A test that measures a box on a component with a `transition` cannot rely on
frames alone. `Animation.finished` is the only thing that waits for one.

- Site: `test/reforged/harness.html`

### T-an-svg-path-box-rounds-by-a-hundredth

`getBoundingClientRect()` on an SVG `<path>` does not agree to the last decimal
across engines. Measured over all six button sizes:

| engine | worst delta from the token |
|---|---|
| Chromium | +0.0001 |
| WebKit | +0.0001 |
| Firefox | **+0.05** |

`reforged-icon-sizes.spec.ts` used `toBeCloseTo(14, 1)`, which demands a
difference **strictly below 0.05** — so Firefox failed by 0.00003px on a test
about whether an icon fills its box.

It now asserts the difference is at most 0.1px. That keeps what the test is for:
a wrong token is pixels out, not hundredths. Verified by forcing `.icon-start`
to 9px and watching the box assertions fail.

- Site: `test/e2e/reforged-icon-sizes.spec.ts`

### T-an-icon-is-known-by-the-set-not-its-spelling

Ask `hasIcon(value)`. Never test the string's SHAPE.

`sherpa-nav`'s `#applyIcon` decided with `/\bfa-/`: a value containing `fa-`
was an icon, anything else was a raw glyph character to print as text. That
worked for exactly as long as every icon name carried the prefix.

When the names were migrated to the Figma set — `fa-solid fa-cubes` → `group` —
every name failed the test and fell through to the text branch. The nav's brand
tile printed the word **"group"** where the product mark should be.

**Nothing failed.** No error, no empty box: a name is a perfectly valid string
to render as text, so the wrong branch produced a plausible result. Will found
it by looking at the running app.

The set is the only authority on what is an icon:

```ts
if (hasIcon(value)) { renderIcon(box, value); }
else { host.textContent = value; }   // a raw glyph — an emoji, a letter mark
```

`SherpaElement.writeIcon` already had this shape, which is why only the one
hand-rolled copy broke. `#applyIcon` cannot simply call `writeIcon` — see
`T-brand-icon-must-empty-its-host` — but it can ask the same question.

Covered by a test that renders both branches: a name must paint an SVG and
leave no text, and `★` must stay text.

- Site: `src/components/sherpa-nav/sherpa-nav.ts`
- Site: `test/e2e/reforged-nav.spec.ts`
- Site: `test/e2e/reforged-icons.spec.ts`

### T-a-cloned-prototype-needs-its-icons-upgraded

`upgradeIcons(this.root)` runs ONCE, in `#stamp`. An icon declared inside a
cloning prototype — `<template class="row-tpl">` — is not in the root when that
runs, so the clone is appended holding a bare `<i data-icon="…">` and nothing
draws.

Measured in the live app: **39 blank icons in `sherpa-data-grid`** — 25 row
actions triggers and 14 filter-cell clear buttons, plus the group chevron once a
grouped view is opened.

**Invisible to every other test.** The element is present, carries the right
`data-icon`, and is the right size. Only the drawing is missing, so a test that
asserts the trigger exists, or that its box is 14px, passes.

`upgradeClonedIcons(node)` on `SherpaElement` fixes it, and `clone()` calls it
for you. A component that clones a `<template>`'s content directly —
`sherpa-data-grid` does, at five sites, because it needs the `<tr>` rather than
a wrapper — has to call it itself.

Idempotent: `upgradeIcons` skips an element that already holds an SVG, so a
second call costs a `querySelectorAll` and nothing else.

- Site: `src/core/ui/sherpa-element.ts`
- Site: `src/components/sherpa-data-grid/sherpa-data-grid.ts`
- Site: `test/e2e/reforged-icons.spec.ts`

### T-scroll-width-under-clip-is-engine-dependent

`overflow: clip` makes `scrollWidth` disagree across engines. Measured on one
truncated grid cell, 160px wide:

| engine | `scrollWidth` |
|---|---|
| Chromium | 377 |
| WebKit | 381 |
| Firefox | **159** — the CLIPPED width |

Everything that matters is identical in all three — the column is 160px,
`text-overflow: ellipsis`, `white-space: nowrap`, `overflow: clip` — so the
rendering is right and only the PROPERTY differs.

Measure the drawing instead. A `Range` over the node's contents reports
373 / 374 / 373 in the three engines:

```ts
const range = document.createRange();
range.selectNodeContents(cell);
range.getBoundingClientRect().width > cell.getBoundingClientRect().width + 1
```

- Site: `test/e2e/reforged-data-grid.spec.ts`

### T-a-text-range-box-differs-by-half-a-pixel

Two labels on one text line, measured with a `Range`, do not agree to the pixel
across engines. Measured on the quick-filter chip and its caret:

| engine | delta |
|---|---|
| Chromium | 0 |
| Firefox | 0 |
| WebKit | **0.5** — at dpr 1 AND dpr 2, so it is not density |

`toBeLessThan(0.5)` therefore failed on the boundary by nothing at all.

The two faults such a test exists to catch are exact and are asserted
separately: a different FACE (a `<button>` does not inherit the page font) and a
different LINE-HEIGHT (14 vs 20 puts the baselines in different places inside
boxes that share a midpoint). Half a pixel on a 20px line is neither.

- Site: `test/e2e/reforged-quick-filter.spec.ts`

### T-a-col-element-has-no-computed-width-in-webkit

`getComputedStyle(colEl).width` on a `<col>` inside a fixed table:

| engine | reports |
|---|---|
| Chromium | 56px |
| Firefox | 56px |
| WebKit | **0px** |

The PAINTED cell is 56px in all three, so the layout is correct everywhere and
only the property disagrees. Measure what is drawn:

```ts
Math.round(sr.querySelector('.select-cell')!.getBoundingClientRect().width)
```

**But an EMPTY grid paints 0 in every engine** — no body rows, so the table has
no width to hand the column. A test about the column DECLARATION reverting
(advanced 56 → plain 32) is asking a different question, and the honest probe
there is the custom property the rule reads, `--_select-w`, which every engine
resolves.

Two questions, two probes: what is DRAWN, and what is DECLARED.

- Site: `test/e2e/reforged-data-grid.spec.ts`

### T-the-fold-measures-whatever-font-is-loaded

A component that MEASURES text gets a different answer before the real font
arrives, and it does not re-measure on its own.

`sherpa-quick-filter-toolbar` folds chips until the bar stops overflowing.
Measured against fallback metrics it folded **3**; once the body font landed the
same bar needed **4**, so it came to rest overflowing and the test read it as a
fold bug. The values before and after, on one 300px bar:

```
before fonts   over: 2   folded: 3
after  fonts   over: 0   folded: 4
```

The harness used to wait for two **Font Awesome** faces — icon glyphs, which
size nothing — and never for the body font, which is what sizes a label. It now
waits on `document.fonts.ready`, because Inter is not declared by the page at
all when it comes from the OS, so there is no named face to `fonts.load()`.

The ceiling stays: `fonts.ready` has no timeout of its own, and losing the race
only costs a text measurement.

- Site: `test/reforged/harness.html`

### T-a-native-control-brings-its-own-margin

A native control carries UA spacing nobody chose, and it is **not the same per
engine** — so the same component is a different size depending on the browser.
Measured on bare elements in all three:

| element | Chromium | Firefox | WebKit |
|---|---|---|---|
| `<input>` margin | `3px 3px 3px 4px` | `3px 3px 3px 4px` | **`3px 2px 3px 2px`** |
| `<button>` padding | `1px 6px` | **`1px 4px`** | **`0 6px 1px`** |
| `<option>` padding | `0 2px 1px 2px` | `2px 4px` | **`5.2px 12.1px 5.2px 8.25px`** |
| `<option>` gap | **7px** | — | — |

`sherpa-button` sets `padding-inline` and never `padding-block`, which is how a
UA value reached the trigger: its height differed per engine and nothing said
so.

`sherpa-base.css` zeroes them, at specificity 0 via `:where()`, so any component
rule still wins without `!important`:

```css
:where(input, fieldset) { margin: 0; }
:where(input, button, option, select) { padding: 0; }
:where(option) { gap: 0; }
```

Measured across the running app, spacing and sizing only (font metrics are
token-driven and exempt): **2,812 off-grid values → 276**, a 90% drop, with
every visible input identical in size before and after. What remains is 272
deliberate `2px` — the sanctioned sub-grid edge case — and 4 fractional
bar-chart data positions, which must stay exact.

This is why `round()` is not the tool for static spacing: a value you never
named cannot be rounded, because CSS has no self-reference. `round()` is for
DYNAMIC content that computes a fractional size.

- Site: `src/core/sherpa-base.css`

### T-round-is-for-dynamic-sizes-only

CSS `round()` works identically in Chromium, Firefox and WebKit — verified,
including on a value read from a custom property (`49.95px` → `48px` at a
`round(…, 8px)`). So it is available. It is just rarely the right answer.

**Will's ruling:** the sizing and spacing ranges are already aliased through the
tokens. `round()` is needed only when the content is DYNAMIC and computes a
fractional size.

Two reasons it cannot police static spacing:

1. **CSS has no self-reference.** `round(margin-top, 4px)` is not valid — you
   can only round a value you have already named, and a value you are naming is
   one you could have taken from a token instead.
2. **The drift was not in authored CSS at all.** `lint:css` reports zero
   off-grid literals. Measured in the running app, 2,571 of 2,812 off-grid
   values were UA defaults on native controls, which is a reset, not a rounding
   problem — `T-a-native-control-brings-its-own-margin`.

Measured across the app after that reset, the only JS-written pixel value is
`sherpa-data-grid`'s `--_pin-offset`, which is already on-grid **and must keep
its sub-pixel precision**: rounding it reintroduces the hairline that
`T-grid-pin-offset-needs-subpixel` exists to prevent.

Slider percentages and the sparkline's point count are not sizes and must not
be snapped either — a slider at 37% belongs at 37%.

So: reach for `round()` when dynamic content produces a fractional SIZE that
should sit on the grid. Do not wrap tokens in it, and do not wrap a measured
offset that is deliberately sub-pixel.

- Site: `src/core/sherpa-grouping.css`

### T-a-wrapping-span-hides-its-own-row

`grid-column-start` does not report the track auto-placement chose. For an item
declared `grid-column: span 4` it reports **`span 4`** — measured in all three
engines — so CSS alone cannot tell which item is first or last in its row.

That is fine while every item is one column wide. It breaks the moment a span
wraps, which is the normal case for a layout grid: three `medium` thirds and
one `full` row are spans of 4, 4, 4 and 12 against 12 tracks, so
`sibling-index()` divided by the column count gives the wrong row for every one
of them.

`sherpa-group`'s grid mode is safe because its children are all one cell wide.
`sherpa-layout-grid`'s are not, so `data-grouped` MEASURES instead:
`measureGroupedGrid()` buckets children by their laid-out `top` — half a pixel
of rounding is the same row — and writes `data-group="grid-top-start"` and the
rest from that.

- Site: `src/components/sherpa-layout-grid/grouped-grid.ts`
- Site: `src/components/sherpa-layout-grid/sherpa-layout-grid.ts`
- Site: `src/index.ts`
- Site: `test/e2e/reforged-layout-grid.spec.ts`

### T-a-document-rule-outranks-an-adopted-host-rule

A DOCUMENT class beats an adopted `:host` rule, at any specificity. Measured
both ways: a `.doc-rule { column-gap: 16px }` in the page wins over
`:host { column-gap: 99px }` in an adopted sheet, and still wins when the
adopted rule is tightened to `:host(.doc-rule)`.

This is the twin of `T-a-document-class-cannot-reach-a-shadow-root`, in the
other direction: a document rule reaches the HOST of a shadow root perfectly
well, and outranks what that root adopts.

`sherpa-layout-grid` hits it because its tracks come from `.sherpa-grid` in the
generated `tokens.css`, which the host WEARS. `data-grouped` therefore cannot
set `column-gap: 0` from the component's own sheet. It re-points what the
document rule READS instead:

```css
:host([data-grouped]) {
  --sherpa-layout-grid-gap-horizontal: 0px;
  --sherpa-layout-grid-gap-vertical: 0px;
}
```

A custom property inherits, so the document rule resolves it at the host and
the gutters go. Whenever a component wears a document class, the property is
the only lever it has.

- Site: `src/components/sherpa-layout-grid/sherpa-layout-grid.css`
- Site: `test/e2e/reforged-layout-grid.spec.ts`

### T-a-look-override-is-not-on-the-variable

A LOOK collection — `Transparent`, `Saturated` — does not own its variables. Its
`variableIds` point at the **Style** collection's, keyed by Style's mode ids, so
reading a look through the VARIABLE returns the base value and every look looks
the same.

The override is on the **collection**:
`(await figma.variables.getVariableCollectionByIdAsync(id)).variableOverrides`
gives `{ [variableId]: { [lookModeId]: alias | { color, opacity } } }`. It holds
only what the look overrides; the rest is the parent's value in the same mode.

So `figma.extensions.json` stores the two looks as exactly that — refs, sparse —
and the projector emits every gap as `var(--sherpa-style-<mode>-…)`, the parent.
Before 2026-09-24 they were light-mode hex from a probe: no dark mode, and 39
values stale against Figma.

Name each target by its variable ID, in the EXPORT's words. The export is older
than Figma: `957:36740` is `content/body/base-fixed` in the export and
`content/body/inverse-fixed` live, and a new `base-fixed` exists only live. A
live name resolves to the wrong token or to nothing, silently — so
`project-tokens.mjs` warns when a look reads a name nothing declares.

`figma_export_tokens` still cannot produce a look, and its `lastSyncedValue` is a
cache of its own — a "fresh" export can assert a stale alias.

- Site: `scripts/project-tokens.mjs`

### T-a-datum-focus-ring-is-for-the-keyboard-only

A chart datum carries `tabindex="0"` so a reader with no pointer can reach it —
`T-a-chart-datum-is-reachable-without-a-pointer`. The cost is that CLICKING one
leaves it focused, and the browser paints its default ring: measured on a donut
slice, `rgb(0, 95, 204) auto 5px`, a blue halo across the chart.

`:focus` without `:focus-visible` IS the mouse case. Measured after a real mouse
click on a slice: `matches(':focus')` true, `matches(':focus-visible')` false —
and the UA outline was painted anyway.

So suppress that one, and DRAW the keyboard ring rather than leaving it to the
UA:

```css
.slice:focus:not(:focus-visible) { outline: none; }
.slice:focus-visible {
  outline: none;
  stroke: var(--sherpa-theme-border-accent-2, #3b4ccd);
  stroke-width: 2;
}
```

A `stroke`, not a `box-shadow`: an SVG `<path>` has no box to shadow, and the
inset-ring idiom the controls use does not apply.

Both radial charts need it — donut `.slice` and gauge `.zone`.

- Site: `src/components/sherpa-radial-chart/sherpa-radial-chart.css`
- Site: `src/components/sherpa-gauge-chart/sherpa-gauge-chart.css`
- Site: `test/e2e/reforged-radial-chart.spec.ts`

### T-a-pie-slice-has-no-rounded-corner

`sherpa-radial-chart` passed `radius: CORNER` to `ringSegmentPath()` for every
slice, including `data-type="pie"`. A donut's corners round because they sit on
two ARCS; a pie slice's two straight edges meet at the CENTRE, and a radius
there rounds the point off.

Measured: a pie path began `M 50.0000 49.0000` — one unit short of the centre of
the 100-unit box — and carried an `A 1 1` corner arc. After `radius: pie ? 0 :
CORNER` it begins `M 50.0000 50.0000` with no corner arc, and the donut is
unchanged at six arcs including its rounding.

Will stated the rule: *"Pie segments will have 0 inner radius and no corner
rounding on segments."* The inner radius was already right; the rounding was
not.

- Site: `src/components/sherpa-radial-chart/sherpa-radial-chart.ts`
- Site: `test/e2e/reforged-radial-chart.spec.ts`

### T-every-close-reports-or-the-toolbars-stay-hidden

`sherpa-filter-panel` has **two ways to close**: the reader clicks the header
`×`, or the window narrows past the panel's minimum and the width path closes
it. Only the first one emitted `filter-panel-close`, because `close()` was
written as the button handler's helper and the width path called it directly.

So a narrow window left the panel gone and the host still in panel mode: the
toolbars stayed hidden, and there was no control on screen to filter with.
Measured at 900px — `{panelOpen:false, dataBar:"none", panelled:1}`.

**Every close reports, and it says WHY.** `close(reason)` always emits, and the
host branches on the reason: a `reader` close writes the mode to `toolbars`; a
`width` close does not, so widening restores what the reader chose. The widen
side needs its own event — now the shell's `panel-room-change`
(`T-the-panel-is-desktop-only`) — because nothing else tells the host there is
room again.

The general shape: a component with two paths into the same state must emit from
the state change, never from one path's handler. The second path is always the
one nobody tests.

- Site: `src/components/sherpa-filter-panel/sherpa-filter-panel.ts`
- Site: `src/components/sherpa-provider/sherpa-provider.ts`


### T-apply-and-discard-wait-for-a-change

**Apply and Discard exist only for a field whose change waits — and only
once it has changed.** Will, 2026-09-26 (off until a change) and 2026-09-27
(TODO 62: only for a REMOTE fetch). The panel's footer, and the snapshot it
kept of every field, are GONE: locally a change applies as it is made; over a
remote source a changed field shows its OWN small Apply and Discard, beside
Clear, from the source's `data-pending` field list. Its Apply commits that
field alone (`commit({ field })`), its Discard puts back the applied answer
— picks, rows and typed text (`discard({ field })`).

A field that only ARRANGES (group, sort) is left out of the snapshot; it acts
at once and has nothing to apply.

**Step 6 of the Query moves the rule into the data layer.** Apply is only for
a REMOTE fetch (Will, 2026-09-26), and remote is a fact about the STORE
(`store.remote`; `spoofRemote()` makes one for now). Over a remote store the
source keeps a DRAFT Query beside the applied one: every write lands in the
draft, the rows wait, and `commit(scope?)` sends it; `discard(scope?)` puts
the applied answers back and draws them. `pending(field)` and `dirty(scope?)`
are the difference, pushed to each bound control as `data-pending` (a field
list) and `data-dirty`. Over a local store the draft IS the applied Query —
one object — so nothing is ever pending. A scope that narrows one component
(a legend) applies at once even on a remote store: its rows are already here.

- Site: `src/components/sherpa-filter-panel/sherpa-filter-panel.ts`
- Site: `src/core/data/data-source.ts`
- Site: `src/core/data/spoof-remote.ts`
- Site: `src/core/data/store.ts`
- Site: `src/data.ts`
- Site: `test/unit/query.test.mjs`
- Site: `test/e2e/reforged-filter-panel-component.spec.ts`
- Site: `src/components/sherpa-filter-panel/sherpa-filter-panel.css`

### T-a-view-is-json

**A saved View is JSON — its Query, applied onto a clean slate, with its
defaults SHOWN on the chips.** Will, 2026-09-26 (70: *"default filter fields,
values, and states need to be bundled in a view definition"*) and 2026-09-27:
*"JSON is the de facto universal standard for configuration data … we can
much more readily send and receive content from other services."* So views,
preset views and a filter's conditions are JSON; HTML templates stay for a
component's own insides, and `sherpa-templater` (68) will build a view's
layout from JSON. This reverses QUERY-DESIGN's decision 1A (markup + Query).

A `SavedView` is `{ label, query, ui }`: `query` a `QueryDefaults` — each
scope names only what it sets — and `ui` the element state that is not data.
`setQuery(view.query, { holds: 'keep' })` puts it on: a scope the view gives
no `holds` keeps its chips, a field the view ANSWERS is held (so its chip
shows it — the At risk view's Open tickets arrives as a chip), every other
answer is cleared, and its sort, group and search set the source's own and
leave the Query. A restore (no `keep`) is exact.

Two things this found. A NUMBER chip never reported — the bar's `readings`
skipped every body menu, so a Seats range showed on its chip and filtered
nothing; one number under an operator is TYPED text (`{ op: 'gt', text: '2'
}`), because picks on a number with no list build no clause. And the old
views hid their filters in a `view` part no chip showed; that part is gone.


7b, the Dashboard: its header answers the View scope, so a Region pick by hand
filters the charts (it filtered nothing before — only a View could), and its
own axes (severity, storage) sit in a `page` scope no bar answers. A host must
`hold` its header's chips in the View scope, or a view drawn onto the bar
removes them. `saveViewAs` saves JSON for a source with a Query, and a
content view's `after` now gets `rendered` — the Capacity view's charts had
never been bound.
- Site: `src/components/sherpa-quick-filter-toolbar/sherpa-quick-filter-toolbar.ts`
- Site: `src/core/browser/persist-view.ts`
- Site: `src/core/data/data-source.ts`
- Site: `src/core/data/query.ts`
- Site: `test/unit/query.test.mjs`
- Site: `src/components/sherpa-provider/sherpa-provider.ts`

### T-navigating-sets-up-the-page

**Moving to a page sets up its filters and data — not only its template.**
TODO 92, audited 2026-09-27 (`PROVIDER-DESIGN.md` §10). Two things a page
used to leave behind:

- **A page with NO data shuts the panel** — `provide({ sources: {} })` closes
  it with reason `page`, which is not the reader's choice: the mode is kept,
  and the next page with filters opens the panel again. On Chat the panel had
  stayed open, showing the last page's filters, which did nothing there.
- **Every page with data keeps its Query**, under its own session key, on the
  View it was made on. The Dashboard passed no session, key or View to
  `provide()`, so its filters were lost on a trip away and back.

Since 2026-09-29 a page is a DEFINITION the router hands the provider
(`T-a-page-is-its-definition`), so no Context passes these by hand.

- Site: `src/components/sherpa-provider/sherpa-provider.ts`
- Site: `test/e2e/reforged-provider.spec.ts`

### T-the-mode-switch-is-the-pages-own

**No bar and no panel carries the switch between toolbars and panel — the
page does.** Will, 2026-09-25 (TODO 37): *"toggling to the filter panel, from
the filter toolbar, should be a custom button added to the actions slot."* A
component that switches a mode it knows nothing of is not agnostic.

The provider owns the mode, so it gives the buttons: "View as filter panel" in
each bar's `actions` slot while a panel is on the page (a bar with no panel
has none), taken OUT while the panel answers — the panel carries its own way
back — and "Filter in the toolbars instead" in the panel's `actions` slot,
which forwards into its header. Both come from the provider's template and
answer to the provider alone; `filter-configure` is gone. A host's buttons in
the bar's slot fold away at narrow widths, as the old switch did.

- Site: `src/components/sherpa-provider/sherpa-provider.ts`
- Site: `src/components/sherpa-provider/sherpa-provider.html`
- Site: `src/components/sherpa-filter-panel/sherpa-filter-panel.html`
- Site: `test/e2e/reforged-provider.spec.ts`
- Site: `test/e2e/reforged-quick-filter-toolbar.spec.ts`

### T-the-provider-owns-the-panel-mode

**TOOLBARS or PANEL is the provider's, for every page in its subtree.** TODO
91, 2026-09-27. Will: *"The app shell should be able to toggle between Filter
Toolbar and Filter Panel modes for any View that is showing in the content
area."* Before it, Records wired it by hand — `togglePanel`, `setPanelMode`,
the session key, and the close, reopen and restore listeners — and the
Dashboard's Configure button did nothing.

The provider hears its OWN mode buttons (`T-the-mode-switch-is-the-pages-own`)
the panel's `filter-panel-close`, and the shell's `panel-room-change`. It opens or shuts every panel
that asked, and steps every bar that asked back (`data-panel-mode`) — a bar
on a page loaded later takes the mode when it asks. The APP keeps the choice:
it sets `provider.filterMode` from its session, and saves each
`filter-mode-change` — a reader's change only; a window too narrow is not a
choice, and the panel comes back when it is wide again.

A panel asks for `view data` on every page; a scope a page does not have —
nothing held, nothing to offer — is not drawn, so the Dashboard's panel shows
its View filters alone.

- Site: `src/components/sherpa-provider/sherpa-provider.ts`
- Site: `test/e2e/reforged-provider.spec.ts`

### T-a-page-goes-out-as-json

**A page's whole state goes out as JSON and comes back: `provider.export()` /
`provider.import(state)`, over `source.export()` / `source.import(state)`.**
Provider P5, 2026-09-27. A source's state is its Query as APPLIED, its sort,
group and search in the View scope (the shape a View's JSON already uses),
and every saved filter it names — readings and label — so a service that
takes it in needs no library of ours. The provider's adds the View on screen.
A round trip gives the same rows; that is the test.

Three things to know. Import is EXACT: `setQuery`, not a View's keep — a
restore, not a pick. The View it brings is shown on the chip that showed the
old one, and the pick listener is told, or a later pick of the OLD View is
mistaken for the one on screen and ignored. And the source half is DOM-free,
so an MCP or WebMCP tool can read and write a page's question without a
browser (TODO 76).

- Site: `src/components/sherpa-provider/sherpa-provider.ts`
- Site: `src/core/data/data-source.ts`
- Site: `test/e2e/reforged-provider.spec.ts`
- Site: `test/unit/headless-data-layer.test.mjs`

### T-a-provider-keeps-the-views

**The provider keeps a page's Views: `provide({ sources, views, view,
session, key })`.** Provider P4, 2026-09-27. It puts the session's Query back
— only on the View it was made on — or else the URL's View (the FIRST View is
the page as it loads, so it is not applied again); it hears a View pick from
anything inside it, as the View chip reports one, and puts that View's Query
on; it draws a View's own content into the element marked
`data-view-content`, whose components ask like any other; and it keeps the
Query in the session once per frame. `provide()` settles when the start Query
is on, so a page awaits it before its first load.

Before it, each Context wired `onViewPicked` itself with its own `applied`,
`into` and `after`, and Records kept and restored the Query by hand; the
Dashboard bound a View's content in an `after` hook. Now a View's JSON says it
all: its Query, its content, and its `ui` — a content grid's columns and key
are its CONFIGURATION (`T-configuration-is-not-data`), set through the View.

Three things to know. `onViewPicked` sets the View chip through the element
that REPORTED the pick — a host above it has no chips. The Views are over the
subtree's ONE source; a subtree with several gets none. And the provider fires
`view-change` with the View's id, and its content's elements by id, for a
page that still wants them.

- Site: `src/components/sherpa-provider/sherpa-provider.ts`
- Site: `test/e2e/reforged-provider.spec.ts`

### T-a-component-default-outlives-a-view

**A component's OWN filter — `data-readings`, the Query's readings by field as
JSON — narrows that component alone, and a View pick keeps it.** Provider
P3e, 2026-09-27. The Dashboard's Critical tile counts critical alerts only;
before this it was bound by hand, because a component filter written into the
Query vanished at the first View pick: `setQuery` replaces the whole Query, and
a View is a clean slate.

The provider reads the attribute (the component's own, never inherited) and
calls `source.declareDefault('own:<id>', readings, { only: el })`: a scope
that narrows that one component, like a legend's. The source keeps it as a
DEFAULT and puts it back under any Query that does not name that scope — a
View, or a restore from before the component joined. A View's JSON may name
the scope to change it. When the component leaves, its default goes with it.

Narrowing one component needs a bound `rows: 'all'` component — a summary —
or `write` reports `component-part-on-a-page`. Bad JSON reports
`provider-bad-readings`, and the component filters nothing of its own.

- Site: `src/components/sherpa-provider/sherpa-provider.ts`
- Site: `src/core/data/data-source.ts`
- Site: `test/e2e/reforged-provider-summary.spec.ts`
- Site: `test/unit/headless-data-layer.test.mjs`

### T-a-heading-asks-through-the-source

**A grid's column heading answers through the source, and is told what the
View holds.** Provider P3d, 2026-09-27. Before it, Records listened for
`column-filter-change` itself, selected the field, committed, and drew the
field's normal chip onto the bar by hand (`showChip`) — and a second listener
(`syncHeadings`) read the Query on every change to tell the grid which
headings the View held.

`column-filter-change` is a steering event now, for a grid bound to a scope:
the heading's reading is its field's, and a field no scope holds is held in
the grid's scope first — so its bar is drawn the field's normal chip, from
the Query. A field the View holds is sent to every grid below it with its
APPLIED answer (`supersedeColumns`), shown read-only; the source sends it
when the View's holds change, when a View answer is drawn, and on commit.

Only a SCOPED grid: an unscoped one is a page's to wire, as before.

- Site: `src/core/data/data-source.ts`
- Site: `test/unit/headless-data-layer.test.mjs`

### T-a-panel-asks-for-its-scopes

**The filter panel ASKS for its scopes (`data-scope="view data"`), and the
source draws each WHOLE from the Query — `describe(scope)`: what it holds and
answers, its presets by name, what it may add, how its rows are arranged. It
hears the panel's answers, Add, Remove, Apply and Discard itself.** Provider
P3c, 2026-09-27. Before it, Records built the panel from the BARS —
`fillPanel` read `bar.held` and `bar.offering`, mapped each def with
`asPanelField`, and routed every panel event back through `barFor(scope)`,
refilling two frames later because a rebuilt bar reads empty.

A field a scope ABOVE holds keeps its place in the scope below — its heading,
and the line a raised chip's tooltip says (`movedTo`), no values
(Will, TODO 87 and 88). A request the panel makes of a scope is drawn onto
that scope's bar from the Query (`drawScope`), so the bar and the panel are
two views of one answer. The panel is redrawn once per moment, when what a
scope holds or its presets change — never on an answer, which `drawReading`
draws.

Panel mode is CSS now: a bar in panel mode shows only its persistent chip
(the View), so a field the panel adds is hidden on the header without a page
reaching into the bar's shadow root.

- Site: `src/components/sherpa-filter-panel/sherpa-filter-panel.ts`
- Site: `src/core/data/data-source.ts`
- Site: `test/unit/headless-data-layer.test.mjs`

### T-a-bar-reports-its-holds

**A filter bar that asks for its scope REPORTS what it holds, and the source
keeps each scope's holds from those reports.** Provider P3b, 2026-09-27.
Before it, Records kept them by hand: `syncScopes` read each bar's chips,
called `hold()` twice, greyed the grid's raised chips and refreshed the header's
Add list — and the header's chips reached the Query only through a page
listener that mapped their ids to fields.

A bar's `heldFields` is its chips' fields — not a persistent selector, not a
saved filter, not a chip that answers no field here. The source holds them on
the bar's report and on its `filter-add` / `filter-remove`. When the View's
holds change, an answer that moved scope is drawn where it lives now
(raising carries the answer), and each bar below is told what the View holds
(`supersede`) — one whose set changed reports again, so it lets go of the
raised field or brings its own kept answer back.

Three things that bit on the way:

- **A chip just added has not stamped its menu.** The raised answer is drawn
  when the bar settles — queued BEFORE the add's own report, which otherwise
  reported the new chip empty and cleared the answer it had carried.
- **An Add list is what the BAR has no chip for**, not what the scope does not
  hold. A restore holds the field first; an Add list built from the scope then
  dropped its def, and the bar could not draw the chip.
- **A chip that answers no field is no scope's** (`field: null`, the
  Dashboard's Date): `drawScope` never takes it off, or the header bar's
  rebuild reset its View chip.

The initial holds are declared once in the page — the chips each bar starts
with — because a bar that has not populated yet would report none, and an
empty hold forgets its scope.

- Site: `src/components/sherpa-quick-filter-toolbar/sherpa-quick-filter-toolbar.ts`
- Site: `src/core/data/data-source.ts`

### T-only-the-view-trickles-down

**Only the View scope's filters reach every component. A component scope —
the grid's bar, the grid's headings — narrows the components IN it, and never
a chart or a tile beside them.** Will, 2026-09-27 (TODO 93): *"Changing data
grid scoped filters is still affecting data viz content and metric content.
This is trickle across/up behaviour which we don't want."*

It was one filter for everything: `compile()` put every scope's answer that
did not name a component into one shared filter, and the source loaded the
charts' full row set under it — so a Status pick on the grid's bar took the
Customers tile from 100 to 24.

`compile()` now keeps them apart: `filter` (the View and every component
scope — what a PAGE of rows is under), `view` (the View alone) and
`scoped[id]` (each component scope's own). The source loads a summary's rows
(`rows: 'all'`) under `view`; a summary bound INTO a component scope adds that
scope's answer in memory.

A field's answer goes to the scope that HOLDS it. One that no component scope
holds lives at the View — and so reaches everything — which is right, and is
why a test must `hold` the field in the grid's scope first.

**A scope NO component answers is the page's, and trickles down with the
View.** The Dashboard's "Critical only" View keeps `severity` in a `page`
scope — no chip shows it, so no bar's report can clear it — and the first
version of this fix made `page` a component scope nobody drew: the View
filtered nothing. `compile()` now takes `components` (the scopes a bound
component answers); only those stay apart. A bind or unbind that changes the
set recompiles, when the scope answers anything.

- Site: `src/core/data/data-source.ts`
- Site: `src/core/data/query.ts`
- Site: `test/e2e/reforged-provider-summary.spec.ts`
- Site: `test/unit/query.test.mjs`

### T-a-field-is-declared-once

**A field's filter — its name, its kind, how a control answers it — is
declared ONCE on the source, and every bar, panel and heading draws it from
`source.filterDef(field)`.** Provider P3a, 2026-09-27. Before it, Records built
each field's def three ways: `DATA_FILTERS` for the bar's own chips,
`fieldDef` for the Add lists, and the panel copied both through
`asPanelField`. Owner offered conditions in one and not the other.

`declareField(field, { label, type, select, advanced, op, min, max, step })`
says it; `declareValues` gives its options, as the rows hold them. A number
or a date gets `kind`, and a control of its own; a field that is `advanced:
'only'` offers no list. `declareScope(scope, { label })` names a scope as a
reader sees it, and `addable(scope)` is what it may still add — each noting
where it lives now, because adding it MOVES it.

Removable is NOT here: whether a chip may be taken off is the bar's policy,
not a fact about the field.

- Site: `src/core/data/data-source.ts`
- Site: `test/unit/headless-data-layer.test.mjs`

### T-configuration-is-not-data

**What a page sets ONCE is configuration; what a provider pushes on every
change is data. A component declares the first in `static config`, and the
base class keeps them apart.** §9 item 9, 2026-09-27 — P1 had split them by
hand in the grid (three setters, a merge, a coalescing flag), and every
component that asks would have copied it.

`static config = { columns: [], key: null, actions: [] }` makes each name a
property. A setting redraws with the last DATA beside it; data that names a
config key sets it; data that does not (a provider's rows) keeps what the page
set. Three setters in one moment redraw ONCE — each would otherwise draw the
config the one before had not drawn yet, which is the race P1 met.

A `declare columns: GridColumn[]` line gives TypeScript the type and emits
nothing: a real class field would shadow the base's accessor. The spec
generator reads `static config` for the component's properties.

- Site: `scripts/lib/ts-facts.mjs`
- Site: `src/components/sherpa-data-grid/sherpa-data-grid.ts`
- Site: `src/core/ui/sherpa-element.ts`
- Site: `src/components/sherpa-provider/sherpa-provider.ts`
- Site: `src/core/data/page-definition.ts`

### T-a-component-declares-its-summary

**A chart or tile says what it needs of the rows in its ATTRIBUTES, and its
provider hands back that shape.** Provider P2, 2026-09-27. Before it, every
Context wrote an `as` adapter per chart and tile — `countBy`, `seriesBy`,
`tile()`, `money()`, `overMonths()` — about 110 lines in Records and most of
the Dashboard.

| shape (`static asks`) | declared by | hands back | who |
|---|---|---|---|
| `aggregate` | `data-aggregate` (+ `data-field`) | one number — or `{ value, values, deltaPercent }` with `data-over-field` | metric, gauge |
| `segments` | `data-segment-field` | one datum per value | bar, donut, legend |
| `series` | `data-over-field` (+ `data-segment-field`) | `{ labels, series }` — one line per value | line |

`summarise()` in `aggregate.ts` is the one DOM-free door; the provider only
reads the attributes into its JSON. Five things to know:

- **Nothing declared, nothing asked.** A chart with no declaration is a page's
  to populate by hand, as before — the escape hatch for a bespoke summary (the
  Records gauge shows RISK, `100 − mean(health)`).
- **A child reads the nearest declaration above it.** A legend in a chart's
  `legend` slot uses its chart's field, a nested pager its grid's
  `data-source`, like CSS inheritance. It stops at the provider.
- **Order is the field's DECLARED values** (`declareValues`), so a category
  keeps its slot and colour, and a series its points. Declare them BEFORE
  `provide()`: a legend picks from them when it is answered, and one answered
  with none reports `provider-picks-undeclared` and only shows. With no
  declared points, a bucketed series fills every step from first to last.
- **A legend's pick narrows its chart alone** — through its `picked` door,
  wired by `bindSelection` with component reach.
- **A component's OWN filter is `data-readings`** — see
  `T-a-component-default-outlives-a-view`.

A new declaration asks again: the base class leaves and re-asks when a
`SUMMARY_PROPS` attribute, `data-source` or `data-scope` changes.

- Site: `src/components/sherpa-provider/sherpa-provider.ts`
- Site: `src/core/ui/sherpa-element.ts`
- Site: `test/e2e/reforged-provider-summary.spec.ts`

### T-a-format-is-the-platforms

**A number's format is the platform's own `Intl.NumberFormatOptions`, as JSON
— never a mini-language of ours.** Will, 2026-09-27: *"No need to reinvent
foundational things that we already get for free."* `sherpa-metric` reads
`data-format='{"style":"currency","currency":"USD","maximumFractionDigits":0}'`
and hands it to `Intl.NumberFormat` in the reader's locale. Undeclared, it
uses the library's one format (`formatValue`). JSON that does not parse, or
options Intl refuses, report `metric-bad-format` and fall back — never a blank
tile. The data layer never formats: it returns the number
(`T-an-aggregate-returns-the-number`).

**Exact strings differ by engine and locale** (`1.3M` in Node, `1.3m` in a
browser), so a test compares against `Intl`'s own output in the same page,
never a literal.

- Site: `src/components/sherpa-metric/sherpa-metric.ts`

### T-a-component-asks-its-provider

**A component ASKS; the nearest `sherpa-provider` above it ANSWERS.** Will,
2026-09-27 (the Context Protocol, choice A; designed in FILTER-REVIEW §9–§12
on 2026-09-25 and never built until P1). Before it, nothing could reach the
data layer from a component — it is DOM-free, so it is not in the tree — and
every page wired every component by hand with `source.bind(el, { as, … })`.

A component that declares `static asks` (`{ shape: 'rows' | 'all' | 'state',
own? }`) dispatches a `context-request` (bubbles, composed — it crosses shadow
roots upward) when it connects, and stops on disconnect. The provider
resolves the source its subtree offers (`data-source` names one only where
it offers two; an unnamed ask of two, or a name not offered, is a loud
report, never a guess), binds the component with `deliver` — the data comes
through the callback it asked with — and answers again on `provide()`, so a
Context that swaps its source swaps it for everything still asking.

Three things to know. A request made before any source WAITS, and one from
an element gone from the page is dropped, never bound. An element a page
binds by hand is left alone, not bound twice. And a grid's columns, key and
actions are CONFIGURATION, not data (`T-configuration-is-not-data`).

- Site: `src/components/sherpa-data-grid/sherpa-data-grid.ts`
- Site: `src/components/sherpa-pagination/sherpa-pagination.ts`
- Site: `src/components/sherpa-provider/sherpa-provider.html`
- Site: `src/components/sherpa-provider/sherpa-provider.ts`
- Site: `src/core/data/data-source.ts`
- Site: `src/core/ui/context.ts`
- Site: `src/core/ui/sherpa-element.ts`
- Site: `src/index.ts`
- Site: `test/e2e/reforged-provider.spec.ts`
- Site: `test/unit/headless-data-layer.test.mjs`
- Site: `src/components/sherpa-quick-filter-toolbar/sherpa-quick-filter-toolbar.ts`

### T-the-footer-owns-nothing-to-save

**A footer's commit and revert pair is OFF until something changed — and the
FOOTER does it, not each host.** Will, 2026-09-26 (TODO 66): *"so that all
menus etc can inherit this common behaviour."* The filter panel built its own
(`#syncDirty`, gone with its footer in step 6c), and `sherpa-menu` had a
`dirty` getter its footer never used.

A host REPORTS `data-dirty="true|false"` on its `sherpa-container-footer`;
the footer turns off the controls marked `data-footer="commit"` and
`data-footer="revert"` — declared, never guessed from a label. Absent, the
footer leaves them alone, so a footer whose host does not report is
unchanged; and when a host stops reporting, only what the footer itself
turned off comes back on.

`sherpa-menu` reports for a COMMITTING menu, on open and on every tick or
keystroke — at once, not a microtask later: an Apply pressed in the same
moment as the tick must already be on.

A calendar's pick is neither `input` nor `change` — it is `datetime-change`
or `range-select` — so the menu re-reads its draft on those too, or a picked
day left the footer's pair off (TODO 83).

- Site: `src/components/sherpa-container-footer/sherpa-container-footer.html`
- Site: `src/components/sherpa-container-footer/sherpa-container-footer.ts`
- Site: `src/components/sherpa-menu/sherpa-menu.ts`
- Site: `test/e2e/reforged-menu.spec.ts`
- Site: `test/e2e/reforged-a-calendar-pick-wakes-the-footer.spec.ts`

### T-a-pending-chip-has-no-fill

**A chip whose change is not applied yet is PENDING: the active purple EDGE,
and NO fill.** Will, 2026-09-26 (TODO 46): a chip that goes straight to active
before its change applies misleads the reader. An Advanced chip is the same
— it turns green only once applied.

Only a change that WAITS can be pending, and after TODO 62 only a remote one
waits: locally a pick applies at once and goes straight to active. So a chip
is pending when its own OPEN menu holds a draft (`menu.dirty`, which is only
ever true for a committing menu), or when its bound source lists its field in
the bar's `data-pending` — a panel edit waiting for its Apply.

The fill is a PIN (`'&[data-pending]': default` in state-pins.yaml, written
three times so it outranks the on and the condition pins); the edge borrows
`--sherpa-style-active-border-base-1`, as the AI chip's does. The BAR is the
one writer of the chip's flag: two writers of one attribute each undo the
other's answer.

- Site: `src/components/sherpa-quick-filter-toolbar/sherpa-quick-filter-toolbar.ts`
- Site: `src/components/sherpa-quick-filter/sherpa-quick-filter.css`
- Site: `src/components/sherpa-quick-filter/sherpa-quick-filter.html`
- Site: `test/e2e/reforged-pending-chip.spec.ts`
- Site: `src/components/sherpa-quick-filter/sherpa-quick-filter.ts`

### T-a-condition-tip-counts-its-rows

**An Advanced chip's tooltip says how many conditions apply:** `1 condition
applied`, `3 conditions applied`. Will, 2026-09-26. It used to spell the chain,
which the chip's own value already does; the `fx` button is where a reader
reads the rows themselves.

It counts `state.rows` — the ANSWERED rows only. A half-built row narrows
nothing, so counting it would promise a filter that is not there.

- Site: `src/core/data/filter-face.ts`
- Site: `test/unit/filter-state.test.mjs`
- Site: `test/unit/filter-face.test.mjs`

### T-a-host-label-must-reach-its-control

**An `aria-label` on a Sherpa host names NOTHING.** Measured 2026-09-26 on the
running page: the panel's Reset all and to-toolbar buttons read as unnamed
`button`s, and every switch as an unnamed `switch`. The host is a custom
element with no role, so the platform drops its label, and the real control
inside the shadow root has none of its own. 59 sites in the templates and
examples, plus 18 in code, were written this way — the natural way to write
it.

So a component DECLARES which inner control a host label names —
`static labelTarget` — and the base class copies the host's `aria-label`
there, follows every change, and removes it when the host's is removed. It
only ever removes a label it wrote, so a component that names its own control
keeps it. Five declare one: button (`.trigger`), input-text, select-checkbox,
select-radio (`.control`) and switch (`.input`).

**`aria-pressed` travels with it** (TODO 79): a toggle button's state is as
dead on the host as its name. The nav's Pin and Settings, and the bar's ★,
set it on a composed `sherpa-button`; the base class copies it to the same
control, and removes it when the host's is removed.

The test asks the accessibility tree (`getByRole(…, { name })`), not the
attribute: an attribute check passes on exactly the bug.

- Site: `src/core/ui/sherpa-element.ts`
- Site: `src/components/sherpa-button/sherpa-button.ts`
- Site: `src/components/sherpa-input-text/sherpa-input-text.ts`
- Site: `src/components/sherpa-select-checkbox/sherpa-select-checkbox.ts`
- Site: `src/components/sherpa-select-radio/sherpa-select-radio.ts`
- Site: `src/components/sherpa-switch/sherpa-switch.ts`
- Site: `test/e2e/reforged-host-label.spec.ts`
- Site: `test/e2e/reforged-quick-filter-toolbar.spec.ts`

### T-a-canvas-owns-its-view

**An infinite canvas OWNS its view — the pan and the zoom — as a grid owns
its scroll, and REPORTS each move** (`canvas-change { x, y, zoom }`). Will,
TODO 25. A host that must set it uses `panTo`, `zoomTo`, `fit()` or
`data-zoom`; the canvas writes `data-zoom` back, rounded to three places,
and a change to the value it just wrote is not heard as a host's.

- **The view is three custom properties** on the host — `--_x`, `--_y`,
  `--_zoom` — and everything that moves reads them: the plane's transform,
  the crosshair grid's mask position and size. The grid is a MASK over a
  token colour, so the crosses follow the theme.
- **Content says where it sits** with `--x` and `--y` on the plane — CSS,
  no JS placement.
- **A drag pans only off the content**, unless the Pan tool is on
  (`data-panning`, which also turns the content's own pointer events off) or
  it is the middle button. Ctrl or ⌘ with the wheel — a trackpad's pinch —
  zooms about the pointer; a plain wheel pans.
- **The minimap is PART of the canvas.** A second element would be a second
  owner of one value. It draws each piece of content and the view, scaled
  to the box round both; a press or a drag on it puts the view's middle there.
- `setPointerCapture` throws on a synthetic pointer in Firefox; both drags
  catch it and follow the pointer's own events.

- Site: `src/components/sherpa-layout-canvas/sherpa-layout-canvas.ts`
- Site: `src/components/sherpa-layout-canvas/sherpa-layout-canvas.html`
- Site: `src/components/sherpa-layout-canvas/sherpa-layout-canvas.css`
- Site: `test/e2e/reforged-layout-canvas.spec.ts`

### T-a-templater-owns-the-files

**A component's markup and sheets come from ONE imported helper,
`src/core/ui/templater.ts` — not the base class.** Will, TODO 68: *"it would
be good to be able to offload that and slim the base UI component down"*,
and 27: a consumer gives a component their OWN template, and CSS that
EXTENDS the default rather than replacing it.

- **Fetched once, by URL.** Every element of a kind shares one parsed
  template map and one `CSSStyleSheet` per file.
- **`useTemplate(tag, { html, css })`** draws every `tag` from your markup,
  and adds your sheets AFTER its own, so they win. Set it before the elements
  draw; one already drawn takes it on `SherpaElement.reload(tag)`.
- **What your markup lacks is REPORTED, never thrown**: each template id,
  part, slot name and class of the component's own — its code reaches for
  them. A class is on the list because `this.$('.x')` finds nothing without it.
- **A reload changes a sheet IN PLACE.** `replaceSync` on the one shared
  object restyles every element that adopted it; nothing is drawn again.
  New MARKUP is stamped again, as a variant re-stamp is, so a component whose
  `onRender` draws from its own state comes back as it was.
  `SherpaElement.reload()` with no tag reloads the shared sheets too.
- **The example app reloads live** while `npm run build:watch` runs: the
  examples server watches `dist/` and sends `/live/files`, and the page
  calls `SherpaElement.reload(tag)`. Restart the server once to get the route.

- Site: `src/core/ui/templater.ts`
- Site: `src/core/ui/sherpa-element.ts`
- Site: `test/e2e/reforged-templater.spec.ts`

### T-a-heading-opens-the-chips-menu

**A grid heading opens the CHIP's menu — the one `menuFor()` builds from the
source's own def of the field.** Will, TODO 86 (2026-10-01, A): one field,
one menu, wherever it is asked. The grid ASKS its provider for each
filterable column's `filters` (`DataAsk.filters`), and the provider sends
`source.filterDef(field)`: the Advanced offer, the whole value list with its
names, a date's days. A grid with no source builds the def from the column,
where a text column still offers conditions.

What moved with it:

- **A number heading has no operator select in Simple.** Simple is one value
  (equals) or a range; "at least" is an Advanced ROW, where the field offers
  Advanced — as on the chip.
- **A text heading offers conditions only where its field does.** It used to
  offer them on every text column.
- **The menu reads and writes every body** through `reading` — a date's
  calendar too — so the grid's own calendar code, its dead Range switch
  handler and two templates are gone. Clear is `reading = {}`.
- **A value is shown by its NAME** (`AMER` reads "Americas"), as on the chip.

- Site: `src/components/sherpa-data-grid/sherpa-data-grid.ts`
- Site: `src/components/sherpa-provider/sherpa-provider.ts`
- Site: `src/core/ui/context.ts`
- Site: `test/e2e/reforged-data-grid.spec.ts`

### T-a-tip-lives-in-the-top-layer

A tip — a button's, a chart mark's — is a `popover`, and is LIFTED to the top
layer while it shows. Will, TODO 157: "Tooltips should be at the top level in
CSS so that they sit above everything else."

`position: fixed` was not enough. A fixed box is held by the nearest ancestor
with layout containment, and every card is one (`container-type` gives it) —
so a tip was cut at its card's or its panel's edge. "Send Region to Customer
records" read "Send Region to Custome". The top layer has no ancestor.

**CSS still shows and places it; JS only lifts it.** `sherpa-anchor.css`
decides `display` off `:hover` / `:focus-visible` and places it by CSS anchor
positioning, as before — an anchor and its tip share a shadow root, so the
name resolves from the top layer too. `core/ui/top-layer-tips.ts` hears
`pointerover` and `focusin` on the DOCUMENT, once, finds the anchor under the
deepest target and calls `showPopover()`. With no JS the tip still shows, in
the page. The browser's own popover box (`inset: 0`, `overflow: auto`) is
undone in the shared rule, or the tip is placed by it instead.

**It drops a frame after `pointerout`.** Firefox still matches `:hover` while
the event is heard, so a check made at once left every tip open.

`sherpa-tooltip` lifts its own bubble, with `data-floating`.

- Site: `src/core/ui/top-layer-tips.ts`
- Site: `src/core/ui/sherpa-element.ts`
- Site: `src/core/sherpa-anchor.css`
- Site: `test/e2e/reforged-button-tip.spec.ts`


### T-every-button-says-its-action

**A `sherpa-button` with no visible label shows a tip that says what it
does** — its name (`aria-label`). Will, 2026-09-26. A LABELLED button already
says it, so a tip would repeat it: only `data-tip` gives one a tip. A button
with no name shows none; one whose menu is open shows none; a host that
composes the button and says the action itself sets `data-no-tip`.

It is the SHARED anchored tip (`.sherpa-tip` in `sherpa-anchor.css`), not a
nested `sherpa-tooltip` per button: pure CSS on `:hover` / `:focus-visible`,
anchored to the button's own `.trigger`. With no room above — a button at the
top of the page — `position-try-fallbacks` moves it to the side; a test that
asserts "above" must give the button room first.

**The tip carries its own colour boundary.** It inherits the host's custom
properties like any child, so a saturated button's white ink became its
bubble. `.sherpa-tip` therefore binds the DEFAULT mode's own names
(`--sherpa-style-default-content-base`, `…-default-surface-shadow`), which no
pin re-points — so every host's tip, a chart's too, is immune. `@scope` alone
does not do this: it limits what a rule MATCHES, never what a child INHERITS,
and a top-layer popover inherits the same way.

- Site: `src/components/sherpa-button/sherpa-button.ts`
- Site: `src/components/sherpa-button/sherpa-button.css`
- Site: `src/core/sherpa-anchor.css`
- Site: `test/e2e/reforged-button-tip.spec.ts`

### T-a-silent-steer-still-redraws-its-chip

**A steer is silent, so the chip must be TOLD to redraw.** Measured
2026-09-26: after the filter panel's Apply, the rows were filtered and every
bar chip was `data-current` and `data-condition="advanced"` — but Owner showed no
value and no tip, and Email's tip read only `Contains`. The chip draws its face
when its menu fires an event, and `setChipReading` / a rebuild's
`#keepAnswer` set `menu.conditions` from code, which fires none — on purpose,
so a steer never echoes back as a reader's intent.

So the chip has `refresh()`: it redraws the face (value, tip, badge, condition)
off the menu two frames later — a rebuilt row fills a frame late
(`T-a-rebuilt-row-reads-empty-for-a-tick`) — and never turns the chip on or
off, which stays the host's. Both silent paths call it.

- Site: `src/components/sherpa-quick-filter/sherpa-quick-filter.ts`
- Site: `src/components/sherpa-quick-filter-toolbar/sherpa-quick-filter-toolbar.ts`
- Site: `test/e2e/reforged-quick-filter-toolbar.spec.ts`
- Site: `src/components/sherpa-filter-panel/sherpa-filter-panel.ts`

### T-a-view-change-resets-the-header-chips

**Picking a View resets the header chips the view does not set.** Will,
2026-09-24: *"App header filters shouldn't carry over between preset or custom
views unless already set in the initial view definition."* Measured
2026-09-26: Region = EMEA (27 rows), then My accounts — the Region chip stayed
lit, but `setState` had already dropped its `global` part: 12 rows, all of
Ravi's. A chip that says it filters and does not.

`onViewPicked` resets the bar that reported the pick — `clearAll()` — BEFORE
the snapshot applies, so a view that states a chip (the Dashboard's EMEA
operations sets Region) still sets it. The View chip is persistent and keeps
its pick (`T-persistent-chip-is-a-selector`). A synthetic event from a host
that is no bar has nothing to reset.

Which chips may SURVIVE a view change is a per-chip flag still to build —
TODO 21b. This is its default.

- Site: `src/core/browser/persist-view.ts`

### T-a-reload-replays-the-readers-answers

**Filters survive a reload by restoring the reader's QUERY — their answers,
in their own terms — never a compiled filter.** Will, 2026-09-24: filters and
Advanced filters survive a refresh and a trip away and back, for the
session. Measured 2026-09-26 before the fix: `persistView` kept the source's
COMBINED filter — Region = EMEA + Status = active came back as 4 rows with
every chip empty. A filter no one could see or clear.

The session keeps `source.query.applied`. `source.setQuery()` puts it back and
DRAWS each bound bar its scope (`drawScope`, silent) — nothing replays a
control (step 3 of docs/QUERY-DESIGN.md). `persistView(…, { filter: false })`
keeps sort, group, page and the grid's own state, never the filter.

Four orderings make it work:

- **The URL's View is applied by the Context at init** (`init(root, { view })`).
  A host that picked it after init would reset the header chips just restored
  (`T-a-view-change-resets-the-header-chips`).
- **The kept Query belongs to ONE View.** It is restored only on the View it
  was made on; a View change is a clean slate. Will, 2026-09-26; a view's OWN
  default filters belong in its definition (TODO 70).
- **The grid's column filters are read back FIRST**, so their chips are on the
  bar before it is drawn.
- **Every saved filter's readings are declared first** (`declarePreset`). The
  Query says only that a preset is ON; without its readings it restores lit
  and filters nothing.

The session path must be `persist()`ed in the app (`/filters/records`), or it
lives in memory and dies with the page.

- Site: `src/components/sherpa-quick-filter-toolbar/sherpa-quick-filter-toolbar.ts`
- Site: `src/core/browser/persist-view.ts`
- Site: `src/core/data/data-source.ts`
- Site: `src/components/sherpa-provider/sherpa-provider.ts`

### T-a-heading-menu-opens-on-what-it-holds

**A column heading's menu opens on the answer it holds.** Will, 2026-09-26:
heading menus did not show what was set, so a reader could apply a filter that
contradicts the one in force. A column held a condition — `owner contains Da`,
set from outside by the chip mirror — and its menu opened in list mode, on an
unticked list of values, with the condition row hidden behind the mode.

The heading hands its menu the whole reading it holds (`menu.reading`), and the
menu opens in the mode the reading names — or, for a reading with no mode,
Advanced where only rows answer (`T-both-answers-are-kept`). A chain and a
View-held answer open the same way.

- Site: `src/components/sherpa-data-grid/sherpa-data-grid.ts`
- Site: `test/e2e/reforged-data-grid.spec.ts`

### T-a-heading-holds-a-whole-reading

**A grid heading holds a whole reading, not one condition.** The old
`ColumnFilter` held an op and a value or picks, so:

- a CHAIN set from outside (`['or', ['owner','contains','Da'], ['owner','startswith','R']]`,
  from the chip mirror) was read as `[field, op, value]` — an op of the first
  sub-clause and "picks" of the second: `["owner","in",["owner","startswith","R"]]`;
- a chain typed INTO the heading applied only its first row.

Since TODO 102 it holds the menu's `FieldReading` itself — both answers, the
mode and the mirror — and `ColumnFilter` is gone. The clause and the label
come from the data layer (`readingClause`, `spellConditions`), and
`clauseConditions()` turns a chained clause back into its rows — the inverse
of the chain, `A or (B and C)`. A shape the rows cannot say is reported, never
guessed. A redraw is held AS IT IS: through a clause, only the answer in force
came back.

The rows reach the menu only once it has DRAWN. The heading upgrades its menu
and sets `menu.reading`, and the menu keeps a reading given before it drew
and applies it at the end of its first render (`#flushChains()` is gone).

- Site: `src/core/data/filter-state.ts`
- Site: `src/data.ts`
- Site: `src/components/sherpa-data-grid/sherpa-data-grid.ts`
- Site: `test/unit/filter-state.test.mjs`
- Site: `test/e2e/reforged-data-grid.spec.ts`

### T-an-icon-button-still-slots-its-menu

**An icon-only `sherpa-button` must still slot its menu.** The button has two
templates; only the default one had `<slot name="menu">`. The chart legend's
Other row puts its Breakdown menu in an ICON button (since ad7f91be, which
moved it in to fix the light-dismiss race), so from then on the menu had no
slot: it opened — the button read `data-open`, the popover read
`:popover-open` — and drew nothing, 0x0. Will saw it as "the Other menu
doesn't display any more".

Every state said open, which is why a state test could never catch it — the
test reads the popover's BOX.

- Site: `src/components/sherpa-button/sherpa-button.html`
- Site: `test/e2e/reforged-chart-legend.spec.ts`

### T-a-conditioned-field-opens-on-its-rows

**A field already answered by conditions is DRAWN on them, and every rebuild
keeps them.** Will, 2026-09-26: with Owner answered by `contains Da`, adding a
second Advanced filter — Email — and applying it reset Owner. Three gaps,
one per surface, and each looked like the other two:

| surface | the gap |
|---|---|
| the toolbar | adding a field REBUILDS the bar; `#keepAnswer` let go of Owner's kept rows as its menu drew, one frame before the rebuilt rows FILLED, and the report in that gap said "unanswered" — the source dropped Owner and the mirror switched the chip off |
| the panel's draw | a field with options is drawn as value chips and gets a menu only when Advanced is flipped — so a refill drew Owner as plain chips, rows gone, and its Apply reported it unanswered |
| the panel's flush | rows written into a menu before it has DRAWN go nowhere — Owner came back a blank `equals` |

So: a rebuilt chip's answer is held two frames past its menu's draw; a field
whose state has conditions opens in Advanced mode as it is drawn; and the
panel writes rows and typed text only once each menu has drawn, then takes
its snapshot again so Apply and Discard still read "unchanged".

- Site: `src/components/sherpa-filter-panel/sherpa-filter-panel.ts`
- Site: `test/e2e/reforged-filter-panel-component.spec.ts`
- Site: `src/core/ui/filter-menu.ts`

### T-a-view-held-heading-shows-and-refuses

**A grid heading whose field a HIGHER scope holds shows that answer, and
refuses changes.** Will, 2026-09-26: Region = EMEA in the header lit the grid's
Region heading (the query's `data-filter-fields`), but its menu showed nothing
ticked — so a reader could pick a contradicting value there. His ruling:
shown, but held higher.

`supersedeColumns(readings, appliedAt)` names the fields a higher scope holds,
each with its answer. Such a heading draws that answer — handed to its menu as
a reading, as its own is — with the chip's superseded look and tip ("Filter moved to View scope. This chip
holds EMEA."), and its menu `data-readonly`: rows and conditions `inert`, no
footer, no Add condition, no Advanced button. The heading's own filter is
never set by it (`columnClause` stays null), so nothing applies twice. A field
not named is released.

The host calls it whenever the header's answers change (Records'
`syncHeadings`). A heading that ALREADY held its own filter when the View took
the field applies none of it: the Query answers a View-held field in the View
alone (`compile`, "one field, one scope"), and the grid marks the View's
matches, not the heading's own. The heading keeps its answer for when the View
lets the field go.

- Site: `src/components/sherpa-data-grid/sherpa-data-grid.ts`
- Site: `src/core/data/query.ts`
- Site: `src/components/sherpa-menu/sherpa-menu.ts`
- Site: `src/components/sherpa-menu/sherpa-menu.css`
- Site: `src/core/data/data-source.ts`
- Site: `test/e2e/reforged-data-grid.spec.ts`

### T-a-component-part-narrows-one-component

**A `component` part on the SHARED source is the View's reach under another
name.** Will, 2026-09-26: *"Chart legend toggling is behaving like View scope
filtering. They should only affect their chart."* `bindSelection(…, { reach:
'component' })` contributed a named part to the source — and every component
bound to that ONE source obeys every part, so switching a series off in the
bar chart's legend narrowed the grid, the metrics and the donut too.

So a legend's answer is a SCOPE in the Query that `narrows` its one chart:
`source.write(scope, field, reading, { only: el })`, which
`bindSelection(…, { only })` calls. `compile()` keeps it out of the shared
filter and returns it under `only[bindId]`; `#push` applies it to that
component's rows, and the push guard re-pushes when it changes. A bind's id is
`bind({ id })`, else the element's own id. The component must be bound
`rows: 'all'` — filtering one PAGE would lie about its total — so a write for a
paged bind is refused and reported. A narrowing scope is its component's
alone: `scopeOf()` skips it, so a field-keyed `select()` never lands there. A legend passes its chart, the element
whose `legend` slot it sits in. Measured on Records: the bar chart 4 → 3 bars,
the grid stays at 100, the donut at 4 slices.

The stub source the older scope tests use records `contributions` and never
applies them, which is why none of them caught it; the new test uses a real
`DataSource` with a chart and a grid bound.

- Site: `src/core/data/data-source.ts`
- Site: `src/core/data/query.ts`
- Site: `src/core/data/bind-selection.ts`
- Site: `test/e2e/reforged-filter-scope.spec.ts`
- Site: `src/components/sherpa-provider/sherpa-provider.ts`

### T-a-chart-scope-is-its-legend-field

A chart has a scope of its own in the filter panel, and it is ONE Simple
filter: the legend's field, a chip per legend item, each with its series'
swatch. No Advanced, nothing to add, nothing to save. Will, TODO 52.

It is the scope the legend already writes (`picks:<legend id>`, narrowing its
chart alone), DECLARED: `source.declarePart(scope, { field, only, label })`.
Three things follow from the declaring, and each was a hole without it:

- **It is drawn before it is answered.** An unanswered scope is pruned from the
  Query, so `describe()` reads the declaration, never `holds`.
- **A write from anywhere narrows the one chart.** The panel has no pointer to
  the chart; `write()` finds `only` in the declaration. Without it the scope
  came back WIDE and narrowed every component.
- **Both views are told.** The legend hears `selection-change`; a panel is
  drawn `drawReading(field, reading, scope)` — and takes it BY SCOPE, because
  a chart's field is often the grid's or the View's too.

A panel draws the parts after the View and before every other scope. The
swatch is the value's place in the field's declared values, from 1 — the same
number the chart paints by.

SENT UP, the answer goes to the View with its field and the chart lets go of
it; its section then says where the filter went. The View draws only a field
it knows, so declaring a part declares its field.

- Site: `src/core/data/data-source.ts`
- Site: `src/components/sherpa-provider/sherpa-provider.ts`
- Site: `src/components/sherpa-filter-panel/sherpa-filter-panel.ts`
- Site: `src/components/sherpa-quick-filter/sherpa-quick-filter.html`
- Site: `test/unit/chart-scope.test.mjs`

### T-a-legend-follows-the-view-when-it-holds-the-field

A legend narrows its own chart (`T-a-component-part-narrows-one-component`) —
UNTIL the View holds its field. Then the View's answer is the one in force, so
the legend shows IT, and a press changes IT: every component narrows, and the
View's chips follow. Will, TODO 159.

Before, a legend always wrote its chart's own scope. With the field sent up,
the View said "Disk" while the legend showed every item on, and a legend
press narrowed one chart under a View filter nobody had changed from there.

`bindSelection` asks at each draw and each write — `source.holds('view',
field)` — so nothing is cached, and it hears `scope-change` to redraw when
the View takes the field or lets it go. Taken, the binding DROPS its own
answer: two answers to one field, one of them hidden, is the bug. A press
writes plain picks; rows the View kept stay kept, in Simple mode.

- Site: `src/core/data/bind-selection.ts`
- Site: `test/unit/chart-scope.test.mjs`


### T-one-query-one-owner

**A page's data is under ONE Query, in the reader's terms, and a filter is
only ever its OUTPUT.** docs/QUERY-DESIGN.md. Nearly every filter bug of
2026-09-26 — 41, 55, 56, 21e, 44, 72, 42 — was one answer held in two places
that disagreed: a chip and the source, a heading and a selection, a compiled
filter restored over empty chips.

A `Query` holds scopes; each scope holds fields, each field's `FieldReading`,
the saved filters that are on, and — for one scope — sort, group and search.
`compile(query, facts)` is the ONE place it becomes a filter, and it is pure:
a field the View holds is answered there alone, a suspended reading applies
nothing, and a scope that `narrows` reaches only those components. The
compiled filter is never saved; the Query is.

Step 1 of the build proves the move is invisible: a Query holding today's
answers keeps exactly the rows today's DataSource keeps for the same answers.

Step 2: the DataSource holds it (`source.query.applied`). Each reading lives
in the scope that holds its field — the View first, else the one component
scope, else the View, which narrows everyone. A `hold` or `move` carries the
reading with its field, so the rows never change on a move. The named parts
(`contribute`) are still compiled clauses, ANDed on top, until steps 4–5.

Step 4a: the Records header answers the View scope (`source.answer`) — its
compiled `global` part is gone, so its picks are readings in the Query.
4b–4c: a bind's `scope` makes the source DRAW that control each answer in it
(`drawReading`), so the bar and the open panel need no mirror. A scoped bar's
saved filters are `presets` in its scope, on or off; their readings sit in
the source's library (`declarePreset`), never in the Query.
Step 3: the session keeps the Query; `setQuery` restores it and draws each
bound bar (`drawScope`) — see `T-a-reload-replays-the-readers-answers`.
5a: a legend's answer is a scope that `narrows` its chart (`source.write`);
`ownParts` is gone, and the legend now survives a reload with the rest.
5b: a column heading is a view of its field's reading too — the grid is
bound to the `data` scope and drawn (`drawReading`); its commit is a
`select`, and a field with no chip gets its NORMAL chip (Will, 2026-09-27:
no `col:` chips). A field a scope lets go of, held nowhere else, loses its
answer — removing a chip is a clear. The draw carries the WHOLE answer: an
operator dropped reads "is not churned" as "churned", and a typed text
dropped reads "contains an" as nothing.

- Site: `src/components/sherpa-quick-filter-toolbar/sherpa-quick-filter-toolbar.ts`
- Site: `src/components/sherpa-data-grid/sherpa-data-grid.ts`
- Site: `src/core/data/data-source.ts`
- Site: `src/core/data/query.ts`
- Site: `src/data.ts`
- Site: `test/e2e/reforged-filter-scope.spec.ts`
- Site: `test/unit/query.test.mjs`

### T-the-data-says-what-a-field-may-hold

**A field's possible values come from the DATA, never from the page.** Will,
2026-09-29 (`PAGE-DEFINITION.md` §3). A set — Status — is an ordered array; a
range — Seats — is a number's two ends.

- **The store's schema says it**, with the rules that already check each
  record: `oneOf([...])` for a set, `number()` with `min()` and `max()` for a
  range. A schema made by `rules()` carries them as `domains`, the store gives
  them as `store.domains`, and a `DataSource` declares them when it is made.
  One list checks a write, fills a filter, and keeps a category's colour.
- **A min or max is an END only beside `number()`.** On text, the same rules
  measure a LENGTH, so `rules()` drops them there.
- **Nothing said: the rows say it.** `source.declareFromRows(fields)` gives a
  set its unique values, sorted, and a number its lowest and highest — one load
  of every row, and only when a field needs it.
- **An array, not a set or an object**, because order carries meaning.

- Site: `src/core/data/validate.ts`
- Site: `src/core/data/base-store.ts`
- Site: `src/core/data/store.ts`
- Site: `src/core/data/data-source.ts`
- Site: `src/core/data/page-definition.ts`
- Site: `test/unit/page-definition.test.mjs`

### T-a-page-is-its-definition

**A page is set up from ONE JSON document**, not from code in its Context.
TODO 92, gap G4 (`PAGE-DEFINITION.md`). `provider.open(definition, { stores,
views, view, session })` builds the source over the app's store (`openSource`,
DOM-free), draws every filter bar from its scope as the source describes it —
the View chip first — gives each bar its Add list, and provides it all with the
Query kept under `/filters/<id>`. A reader's saved Views join the shipped ones
by the page's id, so `saveView(label)` needs nothing from the page.

- **Chips come from the scope, never a second list.** A bar's chips are
  `source.describe(scope).filters`; its Add list is `addable()` by the chips it
  HAS, so a restore can draw a held field's chip.
- **The bars are drawn BEFORE the Query**, so a kept one lands on its chips.
- **A `provide()` without the opened source ends the page**: its listeners stop.
- **The ROUTER opens it** (`../Sherpa Demos/app/index.html`), after the markup is in and
  the store is seeded, and hands the source to the Context's `init`. A
  definition's `ui` configures its components by id BEFORE they are answered.

- Site: `src/core/data/page-definition.ts`
- Site: `src/components/sherpa-provider/sherpa-provider.ts`
- Site: `test/unit/page-definition.test.mjs`
- Site: `src/data.ts`

### T-a-spec-reads-the-class-by-its-parser

**A spec's methods and properties are read by TypeScript's own parser**, from
the class `customElements.define()` registers — never by a pattern over the
file. The API audit (TODO 86, 2026-09-29) found what the patterns did:

- **False members.** A two-space `name(args):` line inside a `type` literal
  read as a method, and any `get name()` in the file as a property — so the
  provider's spec listed `populate` and `elements`, and the button's `show` and
  `hide`. None of them exist, and the MCP's `component_api` advertised them.
- **Cut summaries.** Only a comment's first line was kept: 32 of 67 method
  descriptions stopped mid-sentence.
- **A description that never refreshed.** `$description` was carried from the
  last spec before the source's header was read, so the provider's still said
  "region" after the rename to "subtree". The header's first paragraph now
  wins.

A `protected` member (`templateId`) is the base class's contract with a
subclass, not public API, so it is left out.

- Site: `scripts/lib/ts-facts.mjs`
- Site: `test/unit/class-api.test.mjs`

### T-a-form-value-follows-every-write

**A form control tells its form what it holds after EVERY write** — a
keystroke, a `value` set from code, an attribute (`required`, `pattern`), a
select's options filled late — or the form reads a stale answer. Found by the
API audit (TODO 86): `sherpa-input-text` told its form only on `input` and
`change`, so the Add customer dialog's Customer select, filled after it
rendered, read EMPTY to a form, and an Edit's name and email, set from code,
read empty too. `form.reportValidity()` would have refused every save.

The four form controls (`sherpa-input-text`, `-select-checkbox`,
`-select-radio`, `sherpa-switch`) each import `FormValue`
(`src/core/ui/form-value.ts`) — a helper, never a base class — and call it
from every path that moves their value. A checkbox, a switch or a radio
submits its value when ticked and nothing when not; a radio's REQUIRED is its
group's (`T-radios-in-shadow-roots-are-not-one-group`).

- Site: `src/components/sherpa-input-text/sherpa-input-text.ts`
- Site: `src/components/sherpa-select-checkbox/sherpa-select-checkbox.ts`
- Site: `src/components/sherpa-switch/sherpa-switch.ts`
- Site: `test/e2e/reforged-form-controls.spec.ts`

### T-an-unanswered-row-survives-a-redraw

**A condition row the reader has not answered yet is their work in progress,
and a redraw keeps it.** TODO 101, 2026-09-29. Every report goes to the source,
and the source draws the field's answer back onto EVERY bar over its scope —
the one that reported too — with its ANSWERED rows only (`rowAnswered`, an
empty row is none). The menu's `conditions` setter rebuilt its rows whenever
they differed from what it was given, so a new blank row vanished: at once in
a chip's menu (Add condition did nothing), and in the panel once the row's
condition changed.

The setter now compares ANSWERED rows only: an answer that matches the rows
the reader has answered keeps every row, blank ones too, and row one's
`data-op` follows the row shown. An answer that differs — a View, a saved
filter, a Clear from outside — still rebuilds.

- Site: `src/components/sherpa-menu/sherpa-menu.ts`

### T-a-nested-menu-answers-for-itself

**A menu inside another menu's rows is its own menu.** TODO 181, 2026-10-01. A
saved filter's card holds one read-only `sherpa-menu` per field. The outer menu
read its rows with `querySelectorAll('input')`, which reaches DOWN into every
nested menu: their ticks counted as the outer's answer, a nested tick fired the
outer's `menu-change`, and the outer's Clear unticked them. Two single-select
menus also shared one radio `name`, so ticking in one unticked the other.

Every light-DOM read now goes through `#own()`, which keeps a node only when
its NEAREST menu is this one. The change and click handlers drop an event from
a nested menu, and each menu names its radios with its own group. The chip
reads its menu's inputs the same way.

- Site: `src/components/sherpa-menu/sherpa-menu.ts`
- Site: `src/components/sherpa-quick-filter/sherpa-quick-filter.ts`
- Site: `test/e2e/reforged-menu.spec.ts`
- Site: `test/e2e/reforged-saved-filter-edit.spec.ts`

### T-an-action-row-can-keep-its-menu-open

**An action row closes its card, unless it says not to.** TODO 181,
2026-10-01. "Edit filter" turns a saved filter's rows editable IN the card, so
closing the card on the click hid the very rows it opened. A `<button>` with
`data-stay-open` still reports its `menu-select`; the card stays up. Every other
action row closes it as before.

- Site: `src/components/sherpa-menu/sherpa-menu.ts`
- Site: `src/components/sherpa-menu/sherpa-menu.html`
- Site: `test/e2e/reforged-menu.spec.ts`
- Site: `src/components/sherpa-quick-filter-toolbar/sherpa-quick-filter-toolbar.html`
- Site: `src/components/sherpa-filter-panel/sherpa-filter-panel.html`
