# Traps — Filters

One of the eleven areas of [the traps](../TRAPS.md): each entry is here because its
first `Site:` is in this area (`npm run check:traps` holds it so). 103 entries.

### T-anchor-cross-root

An `anchor-name` resolves inside ONE tree, and a trigger is always in a
different shadow root from the card it opens — so a NAMED anchor finds nothing.
It does not fail loudly: the property is supported, and the card silently
renders at the viewport's far corner.

An anchor BY REFERENCE does cross: `card.showPopover({ source: trigger })` makes
the trigger the card's implicit anchor, and `position-anchor: auto` reads it.
Measured 2026-11-03 in Chromium 153, Firefox 155 and WebKit 26.6, 192 cases per
engine — a trigger in the page and in a shadow root, near each edge and in the
middle, four card sizes, `data-align` start and end, `data-placement="right"`:
every card inside the viewport and within 4px of the old measured placement, a
synchronous read straight after `showPopover()` included, and the card follows
its trigger on a page scroll, an inner scroller's and a wheel with no script.

So the card is placed by CSS: `position-area` under the trigger, `flip-block`
above it, and two `@position-try` options that pin it to the viewport's edge
when it is wider than the room beside its trigger's — without them, an inline
overflow made every option fail, and a card at a bottom corner covered its
trigger. A `@position-try` rule works in an adopted sheet in all three.

- Site: `src/components/sherpa-menu/menu-shell.ts`
- Site: `src/components/sherpa-menu/sherpa-menu.css`
- Site: `test/e2e/reforged-menu.spec.ts`
- Site: `src/components/sherpa-quick-filter/chip-press.ts`

### T-custom-element-upgrade

A custom element cloned from a `<template>` **has not upgraded yet**. Its class
constructor has not run, so it is a plain `HTMLElement`.

Therefore:

- a **property** write (`el.valueLabel = 'x'`) lands on the plain element and is
  **lost** when it upgrades
- an **attribute** write survives, because upgrading replays
  `attributeChangedCallback` for whatever is already there

Silent, and timing-dependent. `renderItems()` avoids it by construction:
attributes only, written before append.

**Since 2026-09-27 no host queues.** `SherpaElement.clone()` IMPORTS its copy
into the page's document (`document.importNode`), so every component in it
upgrades at once; the grid imports its heading cells the same way; and
`menuFor()` makes a menu with `createElement`, already upgraded. A method a
host calls before appending — a menu's `items()` — now just works, and the
three `#pendingItems` queues are gone. A copy made with `cloneNode` from a
template's content still lives in its inert document and does NOT upgrade —
`customElements.upgrade()` cannot help it there.

**A component's own type says nothing about upgrade.** The filter family is
typed by each part's class (`SherpaMenu`, `SherpaQuickFilter`, TODO 282), not
by hand-written `HTMLElement & {…}` copies, and imports it `import type` only, so
no run-time edge is added. Keep the `?.()` on a slotted or freshly cloned child:
the type is what it WILL be, not proof that it is upgraded yet.

- Site: `src/core/ui/sherpa-element.ts`
- Site: `src/components/sherpa-quick-filter-toolbar/sherpa-quick-filter-toolbar.ts`
- Site: `src/components/sherpa-data-grid/sherpa-data-grid.ts`
- Site: `src/components/sherpa-menu/sherpa-menu.ts`
- Site: `src/components/sherpa-menu/menu-conditions.ts`
- Site: `src/components/sherpa-menu/menu-list.ts`
- Site: `test/e2e/reforged-app-header.spec.ts`
- Site: `src/core/ui/filter-menu.ts`
- Site: `src/components/sherpa-gauge-chart/sherpa-gauge-chart.ts`
- Site: `src/components/sherpa-data-grid/grid-filters.ts`
- Site: `src/components/sherpa-quick-filter/chip-answer.ts`

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
  No state colour is written in a component. A HOST pin is one line in its own
  sheet, `--_mode`, and its mode's shared block re-maps what the host holds by a
  style query, so the page's `[data-look="saturated"]` on the host cannot hide
  its open state. A pin on a PART is `:host(tag) .part`, a whole block, in its
  component's own sheet (`T-a-host-state-pin-lives-where-the-host-is`).
- **A FLAG is not a pin.** The data grid marks an acting column with
  `data-status="active"` but paints nothing, so its YAML pins that heading
  back to `default`; without it the tint leaked into the chips and the menu.

Of the old `--_status-*` door, two names are left, set by every pin and unset
(`initial`) by a default one, because "default" is not "no status" to a
fallback chain: `--_status-surface-strong` (the gauge's fill, the tag's dot) and
`--_status-data-viz-border` (the sparkline's line). They stay (plan 695 P7).

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
- Site: `src/core/sherpa-button-look.css`
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

### T-private-state-is-a-custom-state

**A component's PRIVATE host state is a custom state — `:host(:state(name))` —
never a `data-*` attribute** (Will, D3, 2026-10-14). An attribute is public API:
a host may set it, the spec lists it, and an agent reads the spec. A state a
component writes about ITSELF — copied, dragging over, resizing, empty, no
matches — is none of that.

- **Write it with `this.toggleState(name, on)`**, read it with
  `this.hasState(name)`, as `toggleAttribute` and `hasAttribute`. CSS selects
  `:host(:state(name))`. A page or a test still can, from outside:
  `el.matches(':state(empty)')`, `sherpa-file-upload:state(dragover)`.
- **One `ElementInternals`.** A page may call `attachInternals()` ONCE per
  element, and a form control needs it too (`FormValue`). So `SherpaElement`
  owns it, as `this.internals`, attached on first use; `FormValue` takes it.
  A second `attachInternals()` throws.
- **A valued state is several states.** The toolbar's collapse step 2 sets
  `collapse-1` AND `collapse-2`, so each CSS rule names one state, as the steps
  add up.
- **`check:props` closes the door.** A `:host([data-x])` rule must be DECLARED
  in `static props`. A quoted `'data-x'` anywhere in the TS is not a
  declaration: passing on that let 15 private flags look declared (2026-10-14).
- **`data-has-*` moved last (TODO 275, 2026-10-15).** The base sets a
  `has-<slot>` state for every slot (`has-content-slot` for the default one),
  and 27 stylesheets select `:host(:state(has-icon))`. Nine more private flags
  moved first — `has-y-axis`, `has-query`, `has-files`, `has-organise`,
  `has-value`, `dragging`, `panning` and `leaving` — and the gate's `data-has-`
  exemption went, so a hand-written one is checked like any other. The metric's
  `data-has-values` is DECLARED instead: an app watches it. A state is read
  from outside as `el.matches(':state(has-icon)')`.

- Site: `src/core/ui/sherpa-element.ts`
- Site: `src/core/ui/form-value.ts`
- Site: `src/components/sherpa-quick-filter-toolbar/sherpa-quick-filter-toolbar.ts`
- Site: `scripts/check-props.mjs`

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
| reads on in its VALUE half only: its label never fills (Will, TODO 667) | `state-pins.yaml`, its `.caret` pin |
| a Group-kind one — a chart's Primary, a held Secondary — opens its menu on a body press | `#onClick` in `sherpa-quick-filter` |

A persistent chip always holds exactly one value, so if neither the live picks
nor the definition names one, `#addMenu` defaults to the FIRST option. Without
that the view chip could load with no radio checked — on at 0 values — which
the chip reads as "on but filtering by nothing" and paints WARNING. That was
the intermittent amber view chip: whether it appeared depended only on whether
the host remembered to mark an option `selected`.


**The bar marks it `data-selector` too, and its own rules read that.** A FILTER
always on is drawn `data-persistent` as well, and is no selector: it answers its
field (TODO 703, `T-a-fixed-field-stays-held`).

**It keeps its pick through `data-reset-on-populate`, while its def is the same.** A changed def names the pick: saving or deleting a View moves the chip so. A reset is of the filters, and a selector answers none. A View that changed what the View scope holds rebuilt the bar, and the chip fell back to the first View. Will, TODO 599.

- Site: `src/components/sherpa-quick-filter-toolbar/sherpa-quick-filter-toolbar.ts`
- Site: `src/core/ui/filter-def.ts`

### T-commit-follows-select-mode

Whether a chip's menu DEFERS its picks behind an Apply/Cancel footer follows
the SELECT MODE by default, because the mode decides whether a pick is
FINISHED.

- SINGLE is done on the tick — a footer charges two clicks for a free selection
- MULTI is still being built — each tick would fire a query on the way to an
  answer

`commit` in `FilterDef` overrides, and only against that. A host that
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

**A DATE always waits for Apply** (Will, 2026-10-22, TODO 405): a new day is
likely a new fetch, local or not. Fixed, so the Range switch leaves it; a
definition's `commit: false` or a LIVE source turns it off. Its picks are a
draft until Apply: the bar asks for nothing on a pick in a committing menu.

- Site: `src/components/sherpa-quick-filter-toolbar/sherpa-quick-filter-toolbar.ts`
- Site: `test/e2e/reforged-quick-filter-toolbar.spec.ts`
- Site: `src/components/sherpa-menu/sherpa-menu.ts`
- Site: `src/components/sherpa-menu/menu-date.ts`
- Site: `src/core/ui/filter-menu.ts`
- Site: `src/core/ui/filter-def.ts`

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

Match the FIELD chip on the composed path — the toolbar's `CHIP`
(`.chips > .chip`, through `#chipOf`) — never a bare `.chip`. (It was the tag
`sherpa-quick-filter` until TODO 415; that also matched a section's value
chip, which is a `sherpa-quick-filter` too.)

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

### T-empty-is-every-kind-of-answer

**Reset and Clear EMPTY a field whatever answers it** — a list's ticks and
rows, a number's two shapes, a date's days. Each host emptied only what it
first knew: the toolbar's Reset cleared list chips and merely switched a
number chip OFF, value kept, so the Query held a suspended answer after a
Reset; the panel's Reset and a field's Clear unticked value chips and cleared
rows, and left a number field as it was. One door each now — the toolbar's
`#emptyChip`, the panel's `#empty` — and both write `{ picked: [] }` to the
menu, which empties every body it owns.

- Site: `src/components/sherpa-quick-filter-toolbar/sherpa-quick-filter-toolbar.ts`
- Site: `src/components/sherpa-quick-filter/chip-answer.ts`

### T-a-family-shares-markup

**Markup a shared helper needs lives in a FAMILY file, not in TS** (Will, TODO
344). `menuFor()` builds a field's menu for the toolbar, the panel and the
grid; its menu is `template.filter-menu-tpl` in `src/core/sherpa-filter-menu.html`.
The ⋮ menu was a family too, while the bar and the panel both drew it; with the
panel gone (476) it is the bar's own, in `toolbar-rows.html` and the bar's
sheet (TODO 523): the menu, and every row it can draw, words included, picked
by `value`, in ONE `template.more-rows-tpl`.

A host lists the family file FIRST in its `static html`, as a family sheet is
listed first in `static css`:

```ts
static override html = [FILTER_MENU_HTML, new URL('./sherpa-data-grid.html', import.meta.url)];
```

The base stamps each family file's first template AFTER its own body, on every
stamp, re-stamp and reload; the build inlines the file as it does any other.
The helper is handed the host's ROOT and clones from it (`menuFor(root, def)`).
A family file that fails to load is reported and left out; `useTemplate()`
replaces only the component's own file. The spec reads `<name>.html` only, so a
family's markup is not a component's anatomy.

- Site: `src/core/ui/templater.ts`
- Site: `src/core/ui/sherpa-element.ts`
- Site: `src/core/ui/filter-menu.ts`
- Site: `test/e2e/reforged-date-conditions.spec.ts`
- Site: `test/e2e/reforged-advanced-rows.spec.ts`
- Site: `scripts/check-size.mjs`
- Site: `scripts/check-traps.mjs`
- Site: `src/core/sherpa-filter-menu.html`
- Site: `src/components/sherpa-quick-filter-toolbar/toolbar-rows.html`
- Site: `src/core/sherpa-show-as.html`
- Site: `src/core/sherpa-tip.html`
- Site: `src/core/ui/description-tips.ts`

### T-a-value-before-the-first-render-is-held

**A value set before a component's first render is HELD, and written in at
the end of `onRender`.** `SherpaElement` fetches the template, so the elements
a setter writes into do not exist for a while after the element does — a
composer's `value` set then went nowhere, and read back as `""` (TODO 113).
Where a native control owns the live value once drawn (a textarea), hold only
the early one: the getter answers it until the control exists. Where the
component's elements ARE its state, keep the state as data instead —
`T-a-value-is-data-the-ticks-are-drawn`.

`sherpa-menu` holds three: `values` until its rows exist (their stamp draws
them over each item's `selected`) — a date's until its calendar is stamped, its
shape said at once — and `condition` and `setCount` until it draws. Once drawn, its rows stay the live answer, because a drill MOVES them
into another menu (`T-drill-moves-not-clones`). The last write wins: items
that name their own picks drop a held one. `sherpa-quick-filter` sets its
picks THROUGH the menu, so they are held there too, and holds its own
`valueLabel` until it draws. `sherpa-quick-filter-toolbar` holds `values`,
`setChipValues`, `setChipReading` and `supersede` given before `populate()`
drew a chip, and `#render()` replays them in order; it keeps the last
`drawResults` for rebuilt chips.

`sherpa-chart-legend` keeps a host's `picked` as DATA and redraws its
off-set each time rows arrive (TODO 229). A reload put the kept Query's pick
on before any row, and the rows came in parts — so the pick was read against
three labels as "all on", and the fourth, arriving later, was on. A reader's
click, or an `off` write, replaces the kept pick.

**A select's value before its options** (2026-10-13): `sherpa-input-text`
as a select wrote a value straight into its inner `<select>`, which dropped
one it had no option for — and showed its FIRST once they came. Since an
input's `rendered` waits for its icons, a menu's condition row lost its
"contains" that way. It holds the value, reports it, and applies it when its
options arrive; the reader's own pick drops it.

**A panel's field before the panel is drawn** (TODO 113): `setFieldReading`
before the first `populate()` is HELD by `scope:field` — `readings` reports
it, and the field draws it when it comes. After a populate, a field the panel
does not draw is not its to hold.

- Site: `src/components/sherpa-prompt-composer/sherpa-prompt-composer.ts`
- Site: `test/e2e/reforged-prompt-composer.spec.ts`
- Site: `src/components/sherpa-menu/sherpa-menu.ts`
- Site: `src/components/sherpa-menu/menu-list.ts`
- Site: `test/e2e/reforged-menu-state-first.spec.ts`
- Site: `test/e2e/reforged-quick-filter-state-first.spec.ts`
- Site: `src/components/sherpa-quick-filter-toolbar/sherpa-quick-filter-toolbar.ts`
- Site: `test/e2e/reforged-quick-filter-toolbar-state-first.spec.ts`
- Site: `src/components/sherpa-chart-legend/sherpa-chart-legend.ts`
- Site: `test/e2e/reforged-chart-legend.spec.ts`
- Site: `src/components/sherpa-input-text/sherpa-input-text.ts`
- Site: `test/e2e/reforged-quick-filter-toolbar.spec.ts`
- Site: `src/components/sherpa-quick-filter/chip-answer.ts`
- Site: `src/components/sherpa-quick-filter/chip-says.ts`

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

### T-the-more-menu-holds-what-folded

**The ⋮ button opens a menu of every action that has FOLDED away at this
width, and a row does what its button does.** TODO 43: it opened nothing — it
only sent `filter-overflow`, which nothing heard. The order is Will's: Suggest
filters, Reset filters, the page's own buttons (the panel switch), a divider,
then Favorite, Save view, Save view as, Refresh view.

"Folded" is read from the page: a button whose computed `display` is `none`
— the container queries and `data-collapse` both fold, and one test covers
both. The menu is built on each open, like the grid's actions menu.

**Reset is not a ⋮ row.** TODO 430 put Reset filters and Reset to view defaults at
the head of a TOOLBAR's ⋮; TODO 454 moved them back to the head of its Edit
menu (`drawFilterActions(…, false)`: no save rows), drawn again as it opens so
each says whether there is anything to reset. The ⋮ keeps the save rows.

Building it found a CSS bug: the view type's own `display: inline-flex` for
★ · Save · ▾ came AFTER the fold steps with the same weight, so on a view bar
the group NEVER folded. Its block sits before the steps now, and the width
rule names the view type too.

**The filter PANEL has one too** — Will, TODO 178: after the host's own
toggle, holding Reset and Reset to view defaults once the panel is narrow
(≤ 380px), and the host's own buttons when they fold. **Both ⋮ menus end in
the host's own option**, "Limit to matching filters", a check row, shown while
the host says it offers one (`data-limit-options="on|off"`, written by the
provider) — so the bar's ⋮ shows at any width then. Ticking it REPORTS
`limit-options-change`; the provider owns the setting, and the app keeps it.


**With no row to show it is not shown** (`offersMore`, Will, TODO 566). What folds decides that, so a reflow measures with the ⋮ in place and decides after: its rows may come with what folds.

- Site: `src/components/sherpa-quick-filter-toolbar/sherpa-quick-filter-toolbar.ts`
- Site: `test/e2e/reforged-quick-filter-toolbar.spec.ts`
- Site: `src/core/ui/more-menu.ts`
- Site: `src/components/sherpa-quick-filter-toolbar/toolbar-rows.html`
- Site: `src/components/sherpa-quick-filter-toolbar/sherpa-quick-filter-toolbar.css`
- Site: `src/components/sherpa-quick-filter-toolbar/toolbar-rows.html`

### T-a-number-waits-for-apply

**A number filter waits for Apply — single or range, local or remote — and
Cancel puts back what was applied.** Will, TODO 94: *"Numerical (and range)
filter menus need apply/cancel buttons."* A number is TYPED, so there is no
moment its answer is obviously finished. A pick applies at once locally (62);
a number is the one exception. `menuFor()` gives every number menu
`data-commit` and `data-commit-fixed`, so the Range switch cannot turn Apply
off. A definition that NAMES `commit` still wins. Over a LIVE source (TODO
107) a number applies as it moves instead.

- Site: `src/core/ui/filter-menu.ts`
- Site: `test/e2e/reforged-number-filter-reports.spec.ts`
- Site: `test/e2e/reforged-quick-filter-toolbar.spec.ts`

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

**The calendar is the menu's too — stamped into its LIGHT DOM.** A date body
is a SLOTTED child: `sherpa-calendar` projects its stepper into the menu's
`header` slot, and slot assignment only reaches a host's LIGHT DOM — inside the
menu's shadow root it would have nothing to project into. So the menu clones
`template.menu-calendar-tpl` into its own light DOM on `data-body="date"`, as
it stamps its rows (TODO 344), in both its templates. A value given before the
calendar exists is HELD, and the shape is said at once.
TRAP T-projected-slot-content-crosses-two-shadow-boundaries

- Site: `src/components/sherpa-menu/sherpa-menu.html`
- Site: `src/components/sherpa-menu/sherpa-menu.css`
- Site: `src/components/sherpa-menu/sherpa-menu.ts`
- Site: `src/components/sherpa-menu/menu-date.ts`
- Site: `src/components/sherpa-menu/menu-number.ts`
- Site: `src/components/sherpa-quick-filter-toolbar/sherpa-quick-filter-toolbar.ts`
- Site: `test/e2e/reforged-quick-filter-toolbar.spec.ts`
- Site: `src/components/sherpa-data-grid/grid-filters.ts`
- Site: `test/e2e/reforged-data-grid.spec.ts`
- Site: `src/core/ui/filter-menu.ts`
- Site: `src/components/sherpa-quick-filter/chip-answer.ts`

### T-group-chip-body-toggles-grouping

**A Group or Sort chip owns its body click** (`#arrange`); the bar's
`#onChipClick` never sees it. Once, the bar's handler found only the Sort chip,
so a click on the Group chip's body flipped it off and **told nobody**: the
grid stayed grouped while the chip said it was not.

It is a TWO-state toggle, not the tri-state Sort is (`T-sort-is-tri-state`).
Turning it off KEEPS the pick (`T-a-chip-body-cycles-its-states`): `group-change`
carries `field: null`, and the bar's `groupField` reads the chip — on, and its
column.

**With nothing picked, the body opens the menu.** A column is chosen in the
menu; the body only switches an existing pick on and off.

The chip REPORTS `group-change` as every chip reports. The host owns the
grouping and writes the attribute back — `T-grid-reports-never-combines`, the
same rule the grid's own actions follow.

- Site: `test/e2e/reforged-quick-filter-toolbar.spec.ts`
- Site: `src/components/sherpa-quick-filter/chip-arrange.ts`

### T-sort-is-tri-state

The Sort chip's BODY cycles ascending → descending → suspended → ascending.
Suspended **keeps the column** (the suspend ≠ clear rule); only the MENU changes
which column. The chip stays ON for the two live directions and goes OFF for
suspended, so the bar shows at a glance whether the sort is doing anything.

Three things that each broke it:

- **The chip cycles before anything flips**: `ChipArrange.press` → `nextSort`
  → the new sort. A chip that flips its own `data-current` first fights the
  cycle, and never leaves ascending.
- **The direction must rewind to `asc` on the way into suspended.** Leaving
  `desc` in place meant click 4 read desc→suspend and click 5 read
  suspend→on-at-desc, so the chip ping-ponged between descending and off and
  never returned to ascending. The COLUMN still survives — that is what makes
  "off" temporary rather than a reset — only the direction rewinds.
- **OFF gets its OWN glyph.** Wearing the ascending arrow, a suspended sort
  looks identical to an active ascending one; the whole point of
  a tri-state icon is that the three states look different.

`sortField` returns null while suspended even though the chip still remembers
the column — a suspended sort must not order anything, and a host reading it
should see "no sort", not a sort it is expected to ignore. `sortSuspended`
reports the in-between state.

The CHIP label says "Sort" and never moves; the COLUMN reads in the caret button
(Figma State=menu, 150:3408). Folded together as "Sort: Region" it re-flowed the
bar on every pick.

- Site: `src/components/sherpa-quick-filter/chip-arrange.ts`

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
- Site: `src/core/ui/filters-button.ts`

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

- Site: `src/components/sherpa-quick-filter-toolbar/sherpa-quick-filter-toolbar.ts`

### T-a-tip-in-lines

**Where the page says, a tip reads in LINES: the Name, the Description, the Value,
then the rest** (Will, TODO 691 S3, D2 A: buttons and filter chips). The
`descriptionTips` look setting says so on `<html data-description-tips>` — while
`actionDescriptions` is on too; ONE watcher (`watchTipLines`) tells each
button and chip, which writes its tip again (`writeTip`). Off, its one line as
before goes in its first line, and the rest stay empty — it reads as it did.

**The lines are ONE family file,** `src/core/sherpa-tip.html`: a button, a chip
and a legend list it first in their static html, and `writeTip` puts its
`.tip-name`, `.tip-description`, `.tip-value`, `.tip-more` in the tip at the
first write — so the tip has to be in its root by then (plan 695 P6). A line with nothing to
say hides, and a tip whose every line is empty hides
(`.sherpa-tip:has(> .tip-line):not(:has(> .tip-line:not(:empty)))`), as the
`:empty` rule hides a tip without lines. A labelled button with no description
shows no tip, in lines or not; with one, its name and its description.

**A chip's description is its FIELD's**, declared in the page definition
(`description`), carried by the catalogue into its filter def, and written on the
chip as `data-description`.

- Site: `src/core/ui/description-tips.ts`
- Site: `src/core/sherpa-anchor.css`
- Site: `src/core/sherpa-tip.html`
- Site: `test/e2e/reforged-an-action-says-what-it-does.spec.ts`
- Site: `src/components/sherpa-quick-filter/chip-says.ts`
- Site: `src/components/sherpa-chart-legend/sherpa-chart-legend.ts`

### T-an-action-says-what-it-does

**An action button says what it does, ONCE, in `data-description`** (Will, TODO
691, D1 A): the menu it opens shows it under its heading (`sherpa-menu`'s
`data-description` → `.description`, which the button writes as it opens it), and
its tooltip reads the same string (S3). A menu code opens — the ⋮ (`openMore`) — takes
its trigger's. Sherpa's own buttons say theirs in their templates (S2): Filters,
Saved, ⋮, a section's ⋮, the View's options, Show as, the canvas options, the
legend's Breakdown. The heading and the line sit in one `.titles`
box in the header's `heading` area: a grid row of their own would be an empty
track, and a doubled gap, wherever a menu has no description.

**On by default; the page turns it off** with the `actionDescriptions` look setting,
which puts `--sherpa-action-description: none` on the page's root, inherited into
every shadow root.

- Site: `src/components/sherpa-menu/sherpa-menu.ts`
- Site: `src/components/sherpa-menu/sherpa-menu.css`
- Site: `src/components/sherpa-button/sherpa-button.ts`
- Site: `src/core/ui/more-menu.ts`
- Site: `test/e2e/reforged-an-action-says-what-it-does.spec.ts`

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

`SherpaQuickFilterToolbar.report()` was the door, re-announcing the whole bar.
Since 366 step 21 a BOUND bar's doors — `setChipValues`, `setChipReading`,
`values =`, `filtersSuspended =` — paint, then ask for the chip's answer
themselves; `report()` asks nothing and carries the View pick. The View chip's
door stays silent.

**This is a shape, not one bug.** `sherpa-app-header.values` and the grid's
`setColumnFilter` / `clearColumnFilter` / `select` are silent with no
counterpart. Each is a place a host can write state that nothing downstream
will ever hear about.

**`query.ask({ field, reading })` is the answer for a FIELD**, and the reason the legend
no longer mirrors a chip at all. It writes the field's selection, re-queries,
and then `query-change` names the field — one write, one announcement, and every
control over that field re-reads `selection(field)` instead of being pushed to.
The silent setters above are what those controls are DRAWN with, downstream of
the announcement, which is exactly where silence belongs.
TRAP T-one-field-one-filter-menu

See `T-grid-read-without-write-is-half-an-api` for the other half of the same
idea — a value you can read and not write.

- Site: `src/components/sherpa-quick-filter-toolbar/sherpa-quick-filter-toolbar.ts`

### T-a-trigger-click-follows-light-dismiss

A trigger button cannot decide "open or shut?" by asking its own menu. The
native popover **light-dismisses on `pointerdown`**, which lands BEFORE the
`click` — so by the time the handler runs an open menu already reports shut,
and `toggle()` re-opens the thing the user just closed.

The button reads its own `data-open` flag instead. That is set from
`menu-open` / `menu-close`, so it is still true at `pointerdown`, and the
handler clears it before deciding. Removing a popover shuts it and fires NO
`toggle`, so a chip moved while its menu is open clears the flag as it leaves
(TODO 599: a View pick moved the View chip, and its next press did nothing).

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

**A flag goes stale when its menu is swapped.** A host that rebuilds its menu —
the Filters button, when a saved set is taken — removes the old one as it
shuts, and that menu's `menu-close` is heard nowhere: the button kept
`data-open`, so the next press hid a menu already shut, and the reader pressed
twice. The button's menu slot's `slotchange` sets the flag from the menu now
in the slot (366 S2).

- Site: `src/components/sherpa-button/sherpa-button.ts`
- Site: `test/e2e/reforged-button.spec.ts`
- Site: `src/components/sherpa-chart-legend/sherpa-chart-legend.ts`
- Site: `src/components/sherpa-chart-legend/sherpa-chart-legend.html`
- Site: `test/e2e/reforged-chart-legend.spec.ts`
- Site: `src/components/sherpa-quick-filter/sherpa-quick-filter.ts`
- Site: `src/components/sherpa-notifications/sherpa-notifications.ts`
- Site: `src/components/sherpa-data-grid/sherpa-data-grid.ts`
- Site: `src/components/sherpa-quick-filter/chip-press.ts`

### T-a-chip-moved-under-a-press-loses-its-click

**A press whose chip is moved, or whose text is written again, between pointer
down and up has no click** (TODO 715). A section's sync re-appended every value
chip to keep the menu's order, and a sync comes with every count, pick and
applied answer. Measured in Demos, WebKit, 8 workers: the press landed on the
chart's value chip, a sync took the chip out and put it back 160 ms later, and
the release on the same node fired no `click` (13 of 160). A count that changes
rewrote the chip's label too: its text node replaced, the press is lost the
same way, in Chromium as well as WebKit.

So a sync moves only a value chip that is out of the menu's order, and removes
the gone ones first, so none stands between two that stay. The chip writes its
label, caret text and glyph only where they differ. A write that changes what a
reader sees still replaces its node: that is a real change, and rare under a
press.

The bar's own `#render` still MOVES every chip it keeps (`list.replaceChildren()`,
then each one appended again).

- Site: `src/components/sherpa-quick-filter/chip-section.ts`
- Site: `src/components/sherpa-quick-filter/sherpa-quick-filter.ts`
- Site: `src/components/sherpa-quick-filter/chip-says.ts`
- Site: `test/e2e/reforged-quick-filter.spec.ts`

### T-menu-composes-real-components

`sherpa-menu` COMPOSES real components rather than drawing their parts, and
imports each one itself because it cannot rely on the page having done so:

| part | component | why |
|---|---|---|
| drill trail | `sherpa-breadcrumbs` | `sherpa-app-header` does the same; a second hand-rolled trail would drift from it |
| search field | `sherpa-input-text` | the Menu node instances the composed Input Field (atom), not a hand-rolled `<input>` |
| Apply / Cancel | `sherpa-button` | real buttons, so the menu must register them |
| the footer | `sherpa-container-footer` | it IS Figma's Container Footer instance, not an action row of the menu's own |
| number and date bodies | `sherpa-slider`, `sherpa-switch`, `sherpa-calendar` | imported by `menuFor()`, which asks for those bodies — not by the menu, so a text field's options menu does not load a calendar. The panel had none of them, so its number and date filters never drew alone (found 2026-10-15) |

The search is listened to on the COMPONENT, never by reaching into its shadow
root for the raw `<input>`: `sherpa-input-text` re-dispatches the inner
control's `input`.

- Site: `src/components/sherpa-menu/sherpa-menu.ts`
- Site: `src/core/ui/filter-menu.ts`

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
else — the data grid's heading and its cell chip are the cases it exists for.

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

A SECTION reads its layout and its menu's rows at `onRender`: a menu that drew
first told no chip (TODO 704).

- Site: `src/components/sherpa-quick-filter/sherpa-quick-filter.ts`
- Site: `src/components/sherpa-menu/sherpa-menu.ts`
- Site: `src/components/sherpa-menu/menu-list.ts`

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

- Site: `src/components/sherpa-quick-filter/chip-answer.ts`

### T-one-pick-reads-field-and-value

A VALUE chip that is ON with no values filters nothing out, so CSS paints it
WARNING off `data-filters-nothing` (`T-empty-flag-needs-rows-to-count`). A plain TOGGLE
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

It cannot be the hardcoded funnel: a grid cell's chip wears a cross while its
value is on, and a heading's an `fx` for a condition, so it writes
`data-icon-start` like anything else.

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

- Site: `src/components/sherpa-quick-filter/chip-press.ts`

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

- Site: `src/components/sherpa-quick-filter-toolbar/sherpa-quick-filter-toolbar.ts`
- Site: `test/e2e/reforged-quick-filter-toolbar.spec.ts`
- Site: `test/e2e/reforged-quick-filter.spec.ts`
- Site: `src/components/sherpa-quick-filter/chip-arrange.ts`
- Site: `src/components/sherpa-quick-filter/chip-press.ts`

**A PERSISTENT chip is a locked chip.** "Always on, and its body does not flip
it" — the toolbar's own words at its `data-persistent` site — is exactly what
`data-locked` means. With `data-persistent` alone the chip flips itself off and
the toolbar writes it back on the next line.

Measured with a real mouse click on a persistent chip with no menu: **two
`data-current` writes for one click**. With `data-locked` set alongside:
**zero**, and the chip stays current. One owner, as the convention says.

`data-persistent` still earns its place — it says the chip stays on the bar when
off, which is a different fact from who owns its state.

**366 step 22: in a BOUND bar every chip whose state the source keeps is
locked** — each field chip and Group and Sort. Its click, its menu and its
condition rows ask (a row too, TODO 518); the source draws it back. A toggle answers no field, so nothing would ever draw
it: it stays unlocked.

### T-empty-flag-needs-rows-to-count

`data-filters-nothing` flags "on, but filtering by nothing" so CSS can paint the chip
WARNING. A VALUE chip only — a plain toggle has no values to hold.

It reads the menu's CHECKED ROWS, not the last event's detail: a chip can be
switched on from OUTSIDE with no menu event having fired.

Two kinds of chip are exempt, and the flag is the amber-paint bug in both:

- **PERSISTENT.** It is a selector, so "on with nothing picked" is a chip still
  WAITING FOR ITS ROWS. Painting it amber was the intermittent view-chip
  warning — the flag was read before the rows existed to count
  (`T-persistent-chip-is-a-selector`).
- **LOCKED, until 366 step 22.** A data grid's column-filter menu held a
  condition and a typed value, and reading "no rows ticked" as "on but empty"
  painted a WORKING filter amber. The flag reads typed answers and Advanced
  rows now, and every chip of a bound bar is locked, so a locked chip is
  judged like any other (`T-locked-chip-relays-and-nothing-else`).

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

- Site: `src/components/sherpa-quick-filter/chip-says.ts`

### T-a-legend-row-is-a-key-chip

**A legend's row IS a filter chip** — Will, TODO 149: *"legend items could
just be a boolean filter chip variant."* Each row is a `sherpa-quick-filter
data-type="key"` (swatch and label) and the legend's own `.value` beside it,
in a shared column. A click on the number does nothing.

**A key's ON is SHOWN, not picked.** At rest every key chip is on, where a
panel chip at rest is off. Will chose to leave each so (TODO 149, A): the
legend says what the chart shows; the panel says what you picked. So a
ruled-out key chip that is ON is refused, and says "no matches" — it has no
pick to set aside and let go.

The chip is `data-locked`: it reports the press, and the legend decides — one
row always stays on (`T-a-legend-keeps-one-row-on`). The chip says
`aria-pressed` from its `data-current`. A row a filter EMPTIED is the legend's
own state, so the legend dims it through the chip's `::part(body)` and
`::part(swatch)`.

**With `data-chips` a row is a VALUE chip**, as a filter panel draws it: `provider.legendChips`, Will, TODO 586 — where its card has no filter toolbar; with one, the chips go there (TODO 670). Its number is the chip's count; a value that is no number, a band's range, stays beside it. Beside a chart the 7:3 split's legend track floors at its min-content, so chips keep their names; a key row is contained, floors at 0, and truncates as before. A read-only legend is no filter, so each row is a light key, no chip (`T-readonly-legend-is-a-key-not-a-filter`).

- Site: `src/components/sherpa-chart-legend/sherpa-chart-legend.ts`
- Site: `src/components/sherpa-chart-legend/sherpa-chart-legend.css`
- Site: `src/components/sherpa-quick-filter/sherpa-quick-filter.ts`
- Site: `src/components/sherpa-quick-filter/sherpa-quick-filter.css`

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

### T-number-and-date-lead-with-a-range-switch

`FilterDef.kind` picks what a chip's menu holds:

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


**Since TODO 375 only a DATE does.** Will, 2026-10-20: *"For numerical and date
fields a 'range' is an advanced filter… We no longer need the range toggle."* A
number's Simple body is one value, and its range is an Advanced row: Between or
Not between, two boxes and a slider under them. (A date keeps its switch for
now: TODO 379.)
- Site: `src/core/ui/filter-def.ts`

### T-toggle-chip-has-no-count

There is deliberately NO `count` in `FilterDef`.

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

A self-relabelling "Select all / Clear all" ROW **MOVES under the reader**
depending on what is ticked, and leaves single-select menus with no clear at
all. One action, one place. `T-select-all-is-not-a-value`
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

**Matched as the field chip (`CHIP`, `.chips > .chip`), not on a bare `.chip`.** The quick-filter's OWN shadow root
contains a `<div class="chip">` too, and it comes FIRST on the path — so matching
the class found that inner div, which carries no `data-id`, and **every remove
silently bailed.**

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

Group and the three sort states come from `ORGANISE_ICONS` in
`core/ui/shared-constants.ts`, **not from a copy kept here** — a copy with a
comment to keep the two in step, and a spec to guard the pair, is the long way
round to one copy. A sort chip and a column header are two views of ONE sort, so
they read one map.

The VIEW selector's icon is the exception and stays HERE, because only this
component draws it. It is FIXED, like Group's and Sort's: it says "you are looking
at a saved view" on every screen, so it must not borrow the page's icon — the
examples each passed their own nav glyph, which made one control look like five.

- Site: `src/components/sherpa-quick-filter-toolbar/sherpa-quick-filter-toolbar.ts`

### T-clone-item-is-for-two-destinations

`cloneItem` exists for a component that cannot use a SINGLE container, which is
why `renderItems` alone was not enough.

`sherpa-transfer-list` is the case: each item goes to the source pane or the
target pane depending on its own `selected` field, so there is no one container
to stamp into.

Three reasons use it today, each about WHERE an item goes, never what it says:

- **two destinations** — `sherpa-transfer-list`: an item goes to the source or the
  target pane by its own `selected` field;
- **something between items** — `sherpa-progress-step-tracker`: a connector is
  stamped between two steps, so the steps share their container with another
  prototype;
- **a container outside the shadow root** — a jump chip (`sherpa-quick-filter`):
  its rows go into its slotted menu, which `renderItems`' selector cannot reach;
  and a select group's options go into its own light DOM (TODO 344).

The row's FIELDS are still declared on the prototype (`T-item-template-cannot-compute`);
only the CHOICE OF PARENT stays in code. A fourth reason that is not about the
parent would mean the declarative vocabulary is missing something.

- Site: `src/core/ui/sherpa-element.ts`
- Site: `src/components/sherpa-select-group/sherpa-select-group.ts`
- Site: `src/components/sherpa-quick-filter/chip-press.ts`

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

### T-one-filters-button

**ONE "Filters" button holds every filter: the chips folded off the run for want
of room, every filter a reader may add, and the saved ones.** Will, 2026-09-25:
*"We should merge the overflow 'More' button and the 'Add filter' button … into
1 button"* — in the action group. It reads "Filters", with a pencil (Will, TODOs
445, 681); the menu it opens is headed "Filters" too, and so does a column's own button.

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

It has NO badge (Will, TODO 447: it counted the wrong thing); it reads active
while a folded chip is on (`T-the-filters-button-is-a-door-not-a-filter`). The
classic panel's button keeps its own badge, at its own call site.

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

**Or the filters APPLIED, where the app counts them** (Will, TODO 436):
`provider.countApplied` marks every control `data-count-applied`, and after
each load the provider writes `data-applied` — `source.appliedCount()` over
what the control answers: a bar its scope, a column its scopes and their
charts'. A column says it beside its "Filters" title; the Edit button says
nothing (TODO 447).

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

**A ONE-value filter has no child menu** — an on/off chip, a preset. Its row
IS its value, so its box is its on/off, with no caret (Will, TODO 54: "a tick
on a value means that value is ON — in every filter").

**`::slotted` reaches the row, never its children**, so the row is a GRID —
box, label, count, caret — and needs no rule on any child. An empty
`sherpa-badge` draws nothing (`:host(:empty)`), so a count of 0 shows no badge.

- Site: `src/components/sherpa-menu/sherpa-menu.ts`
- Site: `src/components/sherpa-menu/sherpa-menu.html`
- Site: `src/components/sherpa-menu/sherpa-menu.css`
- Site: `src/components/sherpa-menu/menu-list.ts`
- Site: `src/components/sherpa-quick-filter-toolbar/sherpa-quick-filter-toolbar.ts`
- Site: `test/e2e/reforged-menu-child-rows.spec.ts`
- Site: `test/e2e/reforged-quick-filter-toolbar.spec.ts`
- Site: `test/e2e/reforged-one-filters-button.spec.ts`

### T-a-toolbar-moves-by-arrow-and-keeps-its-tabs

**A `role="toolbar"` moves between its controls on Left, Right, Home and End,
and Tab still visits every one.** TODO 318, Will (A, 2026-10-22). The APG's one
Tab stop was option B: it would take every chip, button and box out of the Tab
order. `toolbarKeys(bar)` walks the bar's controls in reading order, through
its slots, never inside a control; it focuses each one's own target — itself, a
host that delegates focus, or the first stop in its shadow root (a
`sherpa-button`'s inner button, a chip's `.body`). A control keeps the keys it
uses: a text or number box all four arrows and Home and End (a number steps on
Up and Down), a select Up and Down (Will: they walk its items), and an open
menu, list or dialog its own. Up and Down never move between controls, so a
chip or a menu button keeps them too.

- Site: `src/core/ui/roving-focus.ts`
- Site: `src/components/sherpa-toolbar/sherpa-toolbar.ts`
- Site: `src/components/sherpa-quick-filter-toolbar/sherpa-quick-filter-toolbar.ts`
- Site: `src/components/sherpa-layout-canvas/sherpa-layout-canvas.ts`
- Site: `test/e2e/reforged-a-toolbar-moves-by-arrow.spec.ts`

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
- Site: `test/e2e/reforged-quick-filter-toolbar.spec.ts`

### T-a-filter-menu-has-two-modes

A filter menu asks ONE question two ways, and they are not two menus.

**SIMPLE** is a search over ticked rows. **ADVANCED** is the And/Or rows. An
f(x) control, named **Advanced**, at the end of the header moves between
them; it is ON in Advanced. In the menu it is an icon button (`aria-pressed`).
In a panel field it is the "Advanced" tick row of the field's ⋮ menu (Will,
2026-10-22, TODO 420).

Both stay STAMPED. Flipping a mode is a change of VIEW, not a reset: the ticks
survive a trip through Advanced mode, and the typed rows survive a trip back.
A mode that cleared the other would make the button a destructive control
wearing no warning.

`data-mode` = `simple` | `advanced` (the old `select` | `condition` and `default` | `custom` are read). The rows live in `.condition-rows`, and
each row is `[And|Or] [condition] [value]`.

- Site: `src/components/sherpa-menu/sherpa-menu.css`
- Site: `src/components/sherpa-menu/sherpa-menu.html`
- Site: `src/components/sherpa-menu/sherpa-menu.ts`
- Site: `src/components/sherpa-menu/menu-conditions.ts`
- Site: `src/components/sherpa-quick-filter/chip-answer.ts`

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
- **A reading's tree is only its own `tree`.** A Simple `> 2` turned into a row
  flips every typed number into Advanced, because with no mode named the tree
  decides (`modeOf`).

Dates are not done: their questions wait on TODO 21d.

- Site: `src/components/sherpa-menu/sherpa-menu.css`
- Site: `src/components/sherpa-menu/sherpa-menu.html`
- Site: `src/components/sherpa-menu/sherpa-menu.ts`
- Site: `src/components/sherpa-menu/menu-conditions.ts`
- Site: `src/core/ui/filter-menu.ts`
- Site: `test/e2e/reforged-number-advanced.spec.ts`
- Site: `src/components/sherpa-quick-filter/chip-answer.ts`

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

A NUMBER is the other exception, and opts OUT: it offers Advanced unless its
def says `advanced: false` (`advancedOf`). Its range is an Advanced row —
Between or Not between — since its Simple body is one value. Will, TODO 375:
*"For numerical and date fields a 'range' is an advanced filter."* (A date
keeps its Range switch for now: 379.)

- Site: `src/components/sherpa-menu/sherpa-menu.css`
- Site: `src/components/sherpa-menu/sherpa-menu.html`
- Site: `src/components/sherpa-menu/sherpa-menu.ts`
- Site: `src/core/ui/filter-kind.ts`
- Site: `test/e2e/reforged-filter-conditions.spec.ts`

---
- Site: `src/core/ui/filter-menu.ts`
- Site: `src/components/sherpa-menu/sherpa-menu.css`
- Site: `src/components/sherpa-menu/sherpa-menu.html`
- Site: `src/components/sherpa-menu/sherpa-menu.ts`

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

- Site: `src/core/ui/filter-host.ts`
- Site: `src/components/sherpa-quick-filter-toolbar/sherpa-quick-filter-toolbar.ts`
- Site: `test/e2e/reforged-quick-filter-toolbar.spec.ts`
- Site: `src/components/sherpa-menu/menu-conditions.ts`
- Site: `src/components/sherpa-quick-filter/chip-arrange.ts`

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

- Site: `src/components/sherpa-quick-filter/chip-press.ts`

---

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

So the split is by JOB, not by `select`. A field answered by conditions alone
stays one chip: it has no values to lay out.

**Except a LONG list** — Will, TODO 89: more than 16 values (`EXPLODE_AT`,
`oneChipList()` in `filter-kind.ts`) is ONE chip with its values in its menu,
as a date is. A run of forty chips is a wall, not a list read at a glance. Its
picks, its answer and its Advanced switch are the chip's and its menu's, never
the field header's: read as a run, the chip's own id was sent as the pick.

---

- Site: `src/core/ui/filter-kind.ts`

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

Suspended is not cleared — `ask({ sort: null })` moves the column to the source's own
memory so one more click resumes it. TRAP T-grid-suspend-is-not-clear

- Site: `src/components/sherpa-quick-filter/chip-arrange.ts`

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
| `sherpa-filter-panel.ts` (old) | 50 |
| `sherpa-quick-filter.ts` | **6** |

`data-organise` was the earlier name and it encoded the wrong idea — a chip
named for the heading a panel happened to draw above it.

A host that draws the choice as a run of options rather than a menu names the
column in `data-column`; a menu, where there is one, is the answer.

- Site: `src/components/sherpa-quick-filter/sherpa-quick-filter.ts`
- Site: `src/components/sherpa-quick-filter/sherpa-quick-filter.html`
- Site: `src/components/sherpa-quick-filter-toolbar/sherpa-quick-filter-toolbar.ts`
- Site: `test/e2e/reforged-organise-chip-never-amber.spec.ts`
- Site: `src/core/ui/filter-kind.ts`
- Site: `test/unit/parity-sweep.test.mjs`
- Site: `src/core/ui/filter-def.ts`
- Site: `src/components/sherpa-quick-filter/chip-arrange.ts`
- Site: `src/components/sherpa-quick-filter/chip-press.ts`

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
- Site: `src/components/sherpa-quick-filter/chip-arrange.ts`

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

A TREE is shown too (TODO 391): its ticks, its open parents and its unshown
children are its own menu's DATA, so a parent moved into the Filters menu could
not open — its children stamped into the emptied home. In the panel, a tiered
field's door opens its scope instead: each customer is a chip there, with its
own sites menu.

- Site: `src/components/sherpa-quick-filter-toolbar/sherpa-quick-filter-toolbar.ts`
- Site: `test/e2e/reforged-a-drilled-tree.spec.ts`
- Site: `test/e2e/reforged-quick-filter-toolbar.spec.ts`

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

- Site: `src/components/sherpa-menu/sherpa-menu.ts`
- Site: `src/components/sherpa-menu/sherpa-menu.css`
- Site: `src/components/sherpa-menu/sherpa-menu.html`
- Site: `src/core/ui/filter-kind.ts`
- Site: `test/e2e/reforged-data-grid.spec.ts`
- Site: `test/e2e/reforged-filter-conditions.spec.ts`
- Site: `src/core/ui/filter-menu.ts`

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

### T-an-organise-chip-has-no-values

`data-filters-nothing` means ON BUT FILTERING NOTHING, and `state-pins.yaml` paints
`[data-current][data-filters-nothing]` AMBER. An organise chip never filters, so the
question does not apply to it — but it IS a `sherpa-quick-filter` with a menu,
and that menu picks a COLUMN. `menu.values` reads ticked inputs, so a Sort chip
with no column chosen reports zero values and the chip is judged empty.

Will, three times: *"Still seeing weird warning status styling being applied to
chips randomly"*, then *"I loaded the page, removed a data grid filter from the
panel, and the sort chip got a yellow border applied."*

The trigger is that `data-current` has **26 writers outside the chip** — 16 in
the toolbar, 10 in the panel — and only Group's toggle checked the menu first.
Sort's cycle did not: with no column, `nextSort('', '', 'asc')` answers `desc`,
so the chip lit up sorting by nothing. Any of the other 24 can do the same.

Chasing the writers is the wrong fix; there is a 27th tomorrow. The chip is
marked `data-organise` where it is BUILT, and the empty test skips it the way
it already skips `data-persistent` and `data-locked`.

- Site: `src/components/sherpa-quick-filter/sherpa-quick-filter.ts`
- Site: `test/e2e/reforged-organise-chip-never-amber.spec.ts`
- Site: `src/components/sherpa-quick-filter/chip-arrange.ts`

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

**A ONE-value row's tick is its ON, not its held** — an on/off chip, a preset
(Will, TODO 54, his pick A). So its untick cannot remove it: its chip's own
Remove does. A × at the row's end did, until Will took it out (TODO 380, his
pick: the tick keeps switching a FOLDED chip). A row with values keeps "ticked
is held". Two rules keep the tick honest:

- **Apply flips only a row the reader CHANGED.** The bar and the panel keep
  what each row was told. A chip pressed elsewhere while the menu was shut
  leaves a stale tick, and comparing the tick with the chip turned it back.
- **A chip moved elsewhere re-ticks the shut menu's row**, so the reader sees the
  chip as it is. An open menu is left alone: it holds the reader's draft. The
  bar's watch on its chips' `data-current` does it, whoever wrote it: about 20
  writers in the bar, and a draw that turns a preset on after its waits had
  left the row unticked while the chip was on (TODO 714).

The TOOLBAR's chip menus keep their own Remove in the footer. A chip is the
filter, so removing it from its own menu is where a reader looks; the panel is
a list of them, so the list is where they are managed. Will's ruling
2026-09-24.


**A SPENT field is greyed** (TODO 349): one the filters before it leave no value
for — the source tallies a field no chip holds where it would stand
(`T-one-walk-counts-and-limits-in-order`), and an empty list is spent. Greyed
and refused in the list; gone while "Hide unmatching filters" is on. A held
row is never greyed. The bar and the panel draw the list again only when what
is spent moved.
- Site: `src/components/sherpa-quick-filter-toolbar/sherpa-quick-filter-toolbar.ts`
- Site: `test/e2e/reforged-quick-filter-toolbar.spec.ts`
- Site: `src/core/ui/filters-button.ts`
- Site: `test/e2e/reforged-one-filters-button.spec.ts`
- Site: `src/components/sherpa-quick-filter-toolbar/toolbar-column.ts`

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

The attribute is in the TEMPLATE, so `MenuShell.syncInline` REMOVES it rather than never
writing it — and putting it back restores the floating card, which is how one
element serves a chip and a panel.

A panel SECTION uses the same switch (Will, TODO 455): while its field is in
Advanced, the section chip sets `data-inline` on its own menu, so the rows sit
under the heading in place of the values, answered or not; Simple puts the card
back. The menu's host is `display: contents`, so in the section's grid the CARD
is the item — it spans the row itself — and inline it drops its empty heading
row from the header grid. In a LABEL-COLUMN section (three columns: title,
answer, actions) the section's `::slotted(sherpa-menu[data-inline])` makes the
host the item instead, in the answer's column, beside the title: a rule from
outside beats the menu's own `:host`. Will, TODO 525

- Site: `src/core/ui/filter-menu.ts`
- Site: `src/components/sherpa-menu/sherpa-menu.ts`
- Site: `src/components/sherpa-menu/sherpa-menu.css`
- Site: `src/components/sherpa-menu/sherpa-menu.html`
- Site: `src/components/sherpa-menu/menu-shell.ts`
- Site: `src/components/sherpa-quick-filter/sherpa-quick-filter.css`
- Site: `src/components/sherpa-quick-filter/chip-section.ts`

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
- Site: `src/core/ui/filter-def.ts`

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
- Site: `src/core/ui/filter-def.ts`

### T-a-filter-column-floats

**The filter column floats out of its panel area, as the Nodes card floats in
its canvas, by the same code** — Will, TODO 787b. A column (`data-column`, or
several scopes) with `data-floatable` shows Float / Dock last in its header;
`data-floating`, `data-x`, `data-y`, `data-width` and `data-height` are the box,
as the overlay panel's and the node panel's, and it reports `panel-float`,
`panel-move` and `panel-resize`. Its `.box` wraps the column's container and the
corner, so the corner never scrolls with the body; the grip is first in the
header. `float-box.ts` draws, lifts (16px in) and moves it, and
`sherpa-float.css` is listed first in the toolbar's sheets
(`T-a-floating-panel-is-a-state`).

It stays slotted in the shell's start area, which takes no width while it floats
and is its room: the shell's body (`T-a-panel-area-is-a-layout`). So the Context
reflows to the full body, and the provider's open and shut and the room rule work
on it unchanged. Docked, it is flush and flat: no edge, no rounding, no shadow,
and the area draws the divider. It joins the tab's one stack
(`T-a-pressed-panel-comes-to-the-front`), with boxes in the shell's content only.

- Site: `src/components/sherpa-quick-filter-toolbar/sherpa-quick-filter-toolbar.ts`
- Site: `src/components/sherpa-quick-filter-toolbar/sherpa-quick-filter-toolbar.html`
- Site: `src/components/sherpa-quick-filter-toolbar/sherpa-quick-filter-toolbar.css`

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
- Site: `src/components/sherpa-quick-filter-toolbar/sherpa-quick-filter-toolbar.css`

### T-a-conditioned-chip-reads-as-active

A chip answering with CONDITIONS wears the ACTIVE mode, as a chip answering
with ticks does. It takes NO colour of its own — Will, 2026-09-30, TODO 156:
"use the default active styling for advanced filters instead of diverging to
use the info styling."

So there is no state pin and no CSS for `data-condition`. The attribute stays,
because three things still read it:

- a grid heading shows the `fx` glyph for an Advanced column;
- an Advanced chip is never `data-filters-nothing` — a condition is an answer, so the
  amber "on but filtering by nothing" warning would be a lie;
- a test can ask which kind a chip is.

**Which one a chip is, is the STATE's to say** — `state.condition`, see
`T-one-condition-system`. `data-condition` is written by the chip in
`#syncCondition`.

The same colour runs through to the cells: a `mark.match` in the grid is
the on chip's `--sherpa-filter-on-border-base-1`, else the active mode's, so a
reader follows ONE colour from the chip that found the match to the text it
matched — green too, where a page re-points the chips (TODO 468).

- Site: `src/components/sherpa-quick-filter/sherpa-quick-filter.html`
- Site: `src/components/sherpa-quick-filter/sherpa-quick-filter.ts`
- Site: `src/components/sherpa-data-grid/sherpa-data-grid.css`
- Site: `src/components/sherpa-data-grid/grid-filters.ts`
- Site: `test/e2e/reforged-one-condition-system.spec.ts`

---

### T-a-new-chip-opens-in-default-not-warning

A chip added from the Add menu arrives OFF.

A chip on with no values is exactly the state `data-filters-nothing` paints
AMBER: arriving on, the reader presses Add, gets what they asked for, and is
shown a warning about it.

They add the chip, then answer it. The chip lights when it has an answer.

- Site: `src/components/sherpa-quick-filter-toolbar/sherpa-quick-filter-toolbar.ts`
- Site: `test/e2e/reforged-quick-filter-toolbar.spec.ts`

---

### T-a-rebuilt-bar-reads-empty-until-its-menus-stamp

`#render()` rebuilds every chip, and a rebuilt bar reads `values: {}` for one
tick — on a bar full of ticked rows.

`items()` on a freshly cloned `<sherpa-menu>` stamps NOTHING. The element has
no shadow template until it upgrades, so `items()` keeps the list and stamps the
rest at `onRender` — which has not happened when `#render` returns.

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

**The root, fixed 2026-10-12 (TODO 113):** a menu that has not stamped yet
answers `values` from its items' own `selected`, and the bar asks the MENU for
a chip's picks instead of reading `input:checked` itself. So a rebuilt bar
reads its picks in the same task. The waits above are older than this, and
some may now be removable — each needs its own proof. A BOUND bar paints from
its live slice after them (366 step 22), so a wait costs it latency only.

- Site: `src/components/sherpa-quick-filter-toolbar/sherpa-quick-filter-toolbar.ts`
- Site: `src/components/sherpa-menu/menu-list.ts`

---

**AND THE AMBER WARNING RIDES ON IT.** A chip that is ON while its menu holds
no values is the contradiction `state-pins.yaml` paints `warning`
(`&[data-current][data-filters-nothing]`). A rebuilt menu reads zero values until it
stamps, so `#syncEmpty` could set that flag from a premature read and paint an
unrelated chip as broken. Saying NOT empty is always safe; saying EMPTY waits
for the menu's own `rendered` and one frame after it, and a later check
cancels an earlier one.

- Site: `src/components/sherpa-quick-filter/sherpa-quick-filter.ts`
- Site: `test/e2e/reforged-quick-filter-toolbar-state-first.spec.ts`
- Site: `src/components/sherpa-menu/menu-list.ts`
- Site: `src/core/ui/filter-host-controller.ts`

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
| a DATE, no day picked | turns ON at its default day, Today (Will, TODO 394) |
| has a menu, holds a value | cycles — off is a state, not a delete |
| has NO menu (a status segment) | cycles, as before |

The second line is the one to protect. Turning a value chip off is real and
useful, and it keeps its pick so one more click brings it back without a trip to
the menu. "Empty" is read from `this.values`, which covers all three menu kinds
— ticked rows, a number, a date range — so a typed chip counts as filled too.

The click is also `stopPropagation`'d, exactly as the caret's is: opening a menu
is not a toggle, and a host listening on the bar has no reason to see it as one.

A date is never empty to look at: its face reads Today while it holds nothing.
So its press is a pick, not a flip: `quick-filter-click` carries `picked`, and
the bar asks for the day, as the state holds none to resume.

- Site: `test/e2e/reforged-quick-filter.spec.ts`
- Site: `test/e2e/reforged-menu-calendar.spec.ts`
- Site: `src/components/sherpa-quick-filter/chip-press.ts`

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

### T-the-panel-is-the-bar-in-portrait

Will, TODO 425: *"The elements are the same across both so they should really
just be 2 presentations of the same component … a flip between landscape and
portrait mode (still consolidating all toolbars and moving the content to the
panel area for panel mode)."*

So the filter toolbar has an ORIENTATION, and panel mode is the toolbar too.
Will: *"Both modes are variants of the filter toolbar component"* — the old
`sherpa-filter-panel` (old) was legacy, and TODO 476 deleted it.

`data-orientation="portrait"` over ONE scope stamps the `portrait` template:
the scope is an accordion, as a panel's scope is — its name and icon, a badge of
its matches while shut, Apply and Discard on its header row — holding the
Switch, Group and Sort, then each field. A LIST field's chip is a SECTION
(`data-layout="section"`): its toggle part the heading, and a VALUE chip per
menu row whose press picks that row through the menu (`values`, `apply()`) —
so the field chip stays the one owner, and none, waits, pending (only what
changed) and Limit hold in portrait as in landscape. A tiered value chip
carries its own Sites menu; the field chip catches its change in CAPTURE.

Over SEVERAL scopes (`data-scope="view data"`) it stamps the `column`
template: ONE header — Save <name>, one Filters menu for every scope, the
page's buttons, ⋮, the search above every scope — over the View Context, a
rule, then the Local Context: a portrait toolbar per component scope
(`toolbar-column.ts`; Will, TODO 435). The View's is no accordion: `data-flat`
stamps the `flat` template, a section header with Apply and Discard over its
fields. The templates every variant clones — a chip, Group and Sort, Move, a
section's ⋮, the words — are one family file, `toolbar-rows.html`, so a
variant costs only its own markup. It asks for its scopes and is drawn
(`drawScopes`), opens and shuts, as a panel does. The provider tells a column
from a bar by what it ASKED — several scopes — not by the methods it has
(`isColumn`), since a toolbar has both `drawScope` and `drawScopes`. A column
hears only its header: its sections' events stop at its host. A section asks
for its own scope; one made once the page's bars are drawn is drawn as they
were (`joined`); it never steps back for panel mode and gets no mode button.

- Site: `src/components/sherpa-quick-filter-toolbar/toolbar-column.ts`

### T-a-shut-column-draws-nothing

**A toolbar column draws its sections only once it is OPEN** — TODO 425. The
column is the panel area's occupant on every page, shut in toolbars mode. Each
section is a toolbar that asks the provider for its scope, and drawing one asks
for data — so a shut column cost a trip back to Records over a slow store
about 700 ms (Firefox: 270 ms with the classic panel, 990 with the column;
Demos `reforged-a-reopen-shows-at-once`). Shut, `drawScopes` only keeps the
scopes; `open` draws them. The classic panel does the same (`#stale`).

- Site: `src/components/sherpa-quick-filter-toolbar/toolbar-column.ts`
- Site: `src/components/sherpa-quick-filter-toolbar/sherpa-quick-filter-toolbar.ts`

### T-saved-filters-are-the-last-section

**Saved filters were offered LAST in the Filters menu; since 11-06 they are the Saved menu's.**
Will, 11-06: the Filters menu adds and removes only. The sets are rows of the Save
group's Saved menu, always (`data-saved-menu` is deleted); the history below stands.
Will, 2026-09-25: *"add them to the add filters menu under a 'Custom' section
at the bottom"*; renamed "Saved filters" on 2026-09-29 (TODO 105), and this
trap, `T-saved-filters-are-the-custom-section` until then, on 2026-10-14. A
saved filter is no chip since 366: each row is a SET, a page's own or a
reader's (`T-saved-filters-are-every-scope`).

**The heading is the MENU's**, not the bar's: `MenuItem.section` names the
section an item is in, and the menu draws a heading row where it changes. Its
search hides a heading when nothing under it matches — a heading is never
matched on its own name, so "Saved filters" over no rows cannot happen.

**Each set is a row** (TODO 105): its
tick TAKES it, the ONE taken is ticked, and unticked, the scopes it names lose
their filters. A set is no chip: picking one asks the host
(`T-saved-filters-are-every-scope`).

The heading row is a `.menu-row`, so a re-stamp removes it with the rows it
heads.

- Site: `src/components/sherpa-menu/sherpa-menu.ts`
- Site: `src/components/sherpa-menu/sherpa-menu.css`
- Site: `src/core/ui/filters-button.ts`

### T-a-rebuild-keeps-every-answer

**A rebuild of the bar must carry each chip's WHOLE answer — its op, what was
typed, and its condition rows — not only on/off and ticks.**

**Since TODO 415 most of a rebuild rebuilds nothing:** a chip built from the
same def (less its told answer), under the same menu flags, is MOVED into place
— its menu, answer and draft with it (`#chipKey`, `#built`). What follows is
for a chip that IS remade: a new field, or one whose def changed.

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

- Site: `src/core/ui/filter-host.ts`
- Site: `src/components/sherpa-quick-filter-toolbar/sherpa-quick-filter-toolbar.ts`
- Site: `test/e2e/reforged-a-rebuild-keeps-every-answer.spec.ts`
- Site: `test/e2e/reforged-quick-filter-toolbar.spec.ts`

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
- Site: `test/e2e/reforged-a-chip-press-applies-its-draft.spec.ts`
- Site: `src/components/sherpa-quick-filter/chip-press.ts`

### T-a-stuck-header-casts-a-shadow

**A sticky header, stuck with content scrolled under it, casts a shadow**
(Will, TODO 421: *"All possible with CSS."*). The data grid's: an 8px strip of
the scroll shadow's ink under each cell of the header's LAST row (the filter row
while `data-filterable`, else the heading row), absolutely placed at the cell's
foot, so the cells draw one even edge. A `box-shadow` per cell cannot: each
fades at its own sides, and a pinned cell's paints over its neighbour. The
strip fades in over the first 16px of the grid's scroll, with 401's keyframes
(`T-a-scroll-shadow-is-drawn-over-the-content`); Firefox has no scroll timeline
and shows none. The last pinned cell's strip runs over its see-through edge,
or a 1px gap splits the shadow.

A hidden cell never animates: `getComputedStyle` reads its strip at 0. Read a
SHOWN cell — the select column is hidden on a grid that does not select.

**ONE edge, not a strip per cell** (Will, TODO 481). Every header cell's strip
hung below the header, so a column scrolled sideways under a pinned one hung its
strip over the pinned body cell too — one per column passed, stacked darker
than the rest (measured: 204 to 170). Lifting the pinned body cells over them
cannot work: the sticky `<thead>` is one stacking layer, so a body cell level
with it covered the pinned header cells too. So the strip under the scrolling
columns is the scroll box's own `::before`, sticky at the header's foot
(`--_head-h`, measured with the column widths, and on a header resize) at
`z-index: 1` — under the pinned body cells (2), which hide it — and only a
PINNED header cell, and Actions, keeps a strip of its own, over them.

**The panel's Local Context headers** stick inside the column, which scrolls
for all of them, so its scroll says nothing about ONE header. Each scope
names a VIEW timeline (`view-timeline: --sherpa-scope block`), and its
header's strip (`::part(header)::after`) fades in over `exit-crossing 0` to
`16px`: from when the scope's top passes the column's top — exactly when its
header sticks. A header further down casts none. Chromium and WebKit; Firefox
has no view timeline and shows none.


**With the app's scroll shadows on** (`data-scroll-shadow`), the shared sheet's
top edge is stronger than the grid's own rule, and it pinned the edge at the
box's top — under the opaque header, so it never showed (Will, TODO 499). The
shared rule reads `--_scroll-shadow-top` (0 by default), and the grid sets it to
`--_head-h`, its header's foot.
- Site: `src/components/sherpa-data-grid/sherpa-data-grid.css`
- Site: `src/components/sherpa-data-grid/grid-widths.ts`
- Site: `test/e2e/reforged-scroll-shadow.spec.ts`
- Site: `src/components/sherpa-quick-filter-toolbar/sherpa-quick-filter-toolbar.css`

### T-a-section-is-headed-once

**A portrait toolbar's chips sit in SECTIONS, each headed once** (Will, TODO
438: *"We need to support 1 or more filter chips being in a named section"*).
A field names its section in the page definition (`"section": "When"`); the
chips of one section sit TOGETHER, so the fields' order is the page's to keep.
A chip in no named section is a section of its own, named for its field — a
LIST field heads itself (its section chip's own heading), and the persistent
View chip is a picker, not a filter. Group and Sort are "Organise", a word in
the markup.

The toolbar marks the first chip of each run (`data-section-start`, the name)
after every layout, so a re-order or an orientation change marks again; CSS
draws it as the chip's `::before`, in a column over the chip, in the list
heading's look. Landscape draws no heading. The column's search hides a
chip with `display: none`, and the heading's `display: flex` is the more
specific rule: it skips a chip the search hides, or the search shows it.

- Site: `src/components/sherpa-quick-filter-toolbar/sherpa-quick-filter-toolbar.ts`
- Site: `src/components/sherpa-quick-filter-toolbar/sherpa-quick-filter-toolbar.css`

### T-a-stale-draw-keeps-the-bars-own-change

TODO 356. A bar's `drawScope(description)` reads the scope, then WAITS — its
menus stamp, then two frames — and only then draws each chip from that
description. A chip the bar changes meanwhile (a reader's tick, or
`setChipReading()` + `report()`) is NEWER than the description, and the draw
cleared it: the source kept the filter (100 → 24 rows) while the chip read off.
A grid bound late redraws its scope's bars, so a page that was still binding hit
it; Firefox's later frames made it show there first.

So a draw reads the scope LIVE after its waits — the binding hands it `live`,
`() => source.describe(scope)` — and paints that: a change made while it
waited is already in the Query, so it is in the paint. 366 step 22 replaced the
bar's count of its own changes (`#edited`) with this.

And a draw paints no chip it already shows: the bar keeps what it last drew
per chip (`''` for empty). A chip whose menu is open with a draft is left
alone, so another field's change does not throw the reader's ticks away.

- Site: `src/components/sherpa-quick-filter-toolbar/sherpa-quick-filter-toolbar.ts`
- Site: `test/e2e/reforged-an-open-menu-keeps-its-draft.spec.ts`

### T-a-row-remembers-what-it-was-given

**A condition row keeps its op and join as DATA** (code review 280). A rebuilt
row's op select is filled a frame or two later, and a select with no options
reads `''`: at the moment the menu said `rendered`, its row said `{ op: '' }`,
and the chip, the bar and the panel each waited — on frames, up to four —
and asked again (`T-a-rebuilt-row-reads-empty-for-a-tick`,
`T-a-rebuilt-bar-reads-empty-until-its-menus-stamp`). The menu already kept a
row's pick as `row.dataset.want`; it keeps `op` and `join` the same way. The
row writes them when it is filled and when the reader answers, row one's sync
writes them, and the editor's `read()` reads them, falling back to the control only
for a row that holds none. A waiter that was a guess at "the select has filled"
can then read at once: the chip's start-up check and `refresh()` lost their
frames.

**The probe that mattered:** reading a menu the harness had already rendered
showed nothing wrong, and a first look said the cause was gone. The wrong
read only shows at the moment `menu.rendered` resolves for a chip the bar has
just built.

- Site: `src/components/sherpa-quick-filter/sherpa-quick-filter.ts`
- Site: `test/e2e/reforged-a-row-remembers-what-it-was-given.spec.ts`
- Site: `src/components/sherpa-menu/menu-conditions.ts`

### T-a-silent-steer-still-redraws-its-chip

**A steer is silent, so the chip must be TOLD to redraw.** Measured
2026-09-26: after the filter panel's Apply, the rows were filtered and every
bar chip was `data-current` and `data-condition="advanced"` — but Owner showed no
value and no tip, and Email's tip read only `Contains`. The chip draws its face
when its menu fires an event, and `setChipReading` / a rebuild's
`#keepAnswer` set the menu's answer from code, which fires none — on purpose,
so a steer never echoes back as a reader's intent.

So the chip has `refresh()`: it redraws the face (value, tip, badge, condition)
off the menu two frames later — a rebuilt row fills a frame late
(`T-a-rebuilt-row-reads-empty-for-a-tick`) — and never turns the chip on or
off, which stays the host's. Both silent paths call it.

- Site: `src/core/ui/filter-host.ts`
- Site: `src/components/sherpa-quick-filter/sherpa-quick-filter.ts`
- Site: `test/e2e/reforged-quick-filter-toolbar.spec.ts`
- Site: `src/components/sherpa-quick-filter/chip-answer.ts`

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

- Site: `src/core/ui/filter-menu.ts`

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
- Site: `src/components/sherpa-menu/menu-list.ts`
- Site: `test/e2e/reforged-menu.spec.ts`
- Site: `src/components/sherpa-quick-filter/chip-answer.ts`

### T-each-field-can-apply-on-its-own

**With Single Apply & Discard off, each field applies on its own** (Will, TODO
451; `provider.singleApply = false` → `data-field-apply` on each bar). The
scope still WAITS — every pick is a draft in the Query, as with one Apply —
but the bar's one Apply and Discard go. A chip's menu shows Apply beside its
Discard (`data-apply` on a waiting menu); in a panel section, Apply and Discard
sit on its heading row, before its ⋮, while a value of it is pending. Apply
sends that field's answer with `commit` (`query.ask({ field, commit: true })`): the rest
of the scope still waits. Discard is 406's `filter-discard { field }`.

**Only an OPEN menu's Apply commits.** A section's value press picks through
its field's SHUT menu and calls `apply()`, which says `menu-apply` too; that
pick must wait for the section's own Apply.

**A section says it with a custom state**, `:state(values-pending)`: its
heading is never pending, only its values. `.chip:has(> .value[data-pending])
> .field-apply` matched in Firefox 155, yet Firefox did not restyle the
sibling when a value's `data-pending` changed — not even on a restyle of the
chip — so the pair stayed hidden until a full restyle.

- Site: `src/components/sherpa-quick-filter-toolbar/sherpa-quick-filter-toolbar.ts`
- Site: `src/components/sherpa-quick-filter-toolbar/sherpa-quick-filter-toolbar.css`
- Site: `src/components/sherpa-quick-filter/chip-section.ts`

### T-a-filter-is-dragged-into-its-place

**A chip is dragged along its bar, or a panel section down its column, into
its place in the query** (Will, TODO 452; `provider.reorderFilters` →
`data-reorder` on each bar). `core/ui/drag-order.ts` wires it: a press that
moves 4px is a drag, the item follows by `--_drag-x` / `--_drag-y`, the item it
would land beside is `data-drop="before|after"`, and the click the release
makes is eaten, so a drag never toggles the chip. Alt and an arrow move a
focused item one place: no pointer needed. The View chip, a folded chip and one
superseded stay where they are — and so does a PRESET (Will): a field the page
definition holds in that scope (`source.declarePresets`, `HeldFilter.preset`).
Only what a reader ADDED moves, among its own kind; a preset is never a drop
target, so an added filter never lands among them.

The bar asks `{ order: [...fields] }`; the QueryContext's `order()` puts those
fields in that order in the places they hold, in BOTH copies (an order is no
answer to Apply), and tells `order` — not `hold`. A `hold` that moves nothing
is also a field added back, and a re-walk on every such hold cost the bench 13
scans; an `order` re-walks alone, as each count is taken in that order.

- Site: `src/core/ui/drag-order.ts`
- Site: `src/components/sherpa-quick-filter-toolbar/sherpa-quick-filter-toolbar.ts`

### T-a-shut-scope-wears-its-chips-fill

**A shut panel scope with a chip on wears the chips' on fill on its header** —
Will, TODO 494. It is a state pin, `active @filter-on`, so it is the chips' own
colour and follows a page's re-point (green). It pins the ACCORDION, keyed on
`:state(chips-on)`, which the toolbar keeps from a MutationObserver on its
chips' `data-current`. Not `:has()`: Firefox 155 never re-checks
`:host(…) sherpa-accordion:has(.chip[data-current])` when a chip inside
changes — the rule only matched after an unrelated restyle. And not through
`::part(header)`: shut, the body is hidden, so pinning the accordion changes
nothing else; its badge and its Apply and Discard pin default.

- Site: `src/components/sherpa-quick-filter-toolbar/sherpa-quick-filter-toolbar.ts`
- Site: `test/e2e/reforged-quick-filter-toolbar.spec.ts`

### T-a-toggle-shows-its-state-by-a-shape

**A toggle shows its state by a SHAPE, not by its fill alone, where the page
asks** — Will, TODO 497: *"any UI element that toggles must have a visual element
that indicates to the user its on/off state … Ideally this is a text label …
In these instances we should show a checkmark icon."* The `toggleShapes` look
setting puts ONE custom property on the page's root, `--sherpa-toggle-shape:
inline-flex`; it inherits into every shadow root, and each toggle's tick reads
`display: var(--sherpa-toggle-shape, none)`. No style query: Firefox has none for a
custom property, and a property is the one shape that reaches a bare host
(`T-one-value-one-declaration`). A page with no provider sets the property itself.

**The shape is the Checkbox's BOX, in BOTH states** (Will, TODO 503: A, *"but we
need an off icon, too"*): empty while off, ticked while on. It is the
Checkbox's own look, lifted into `sherpa-checkbox-look.css` as `.sherpa-checkbox`
— the checkbox component's control wears it, and so does each shape, an empty
span. Not the component itself: each one stamps a label and its own caret
button, and a grid page draws 300 tags. A shape is ticked by the control it sits
in — `[aria-pressed="true"] > .sherpa-checkbox` (a chip's body, a tag) — or by
`data-checked`, which the Switch's template sets from `checked`
(`data-when-data-checked="checked"`). Its size is `--_checkbox-size`, set by the toggle.

Who wears one: a filter chip that toggles — a bar's, a panel's value chip, a
legend's item — but not a picker (always on), a section's heading (its values
are the toggles) or an icon-only button; the SIMPLE Switch's knob (the default
Switch already says ON or OFF); and a grid cell's TAG (TODO 490). A menu row and
a checkbox are boxes already. Chip and the Tag component have no on state today,
so nothing to mark.

- Site: `src/components/sherpa-quick-filter/sherpa-quick-filter.css`
- Site: `src/components/sherpa-switch/sherpa-switch.css`
- Site: `src/components/sherpa-data-grid/sherpa-data-grid.css`
- Site: `src/core/sherpa-checkbox-look.css`
- Site: `test/e2e/reforged-toggle-shapes.spec.ts`

### T-a-redrawn-bar-keeps-the-focus

**A bar drawn again keeps the focus on the same chip's same button** (TODO 801).
`#render` empties the run and appends each chip again, moved or built anew, and a
removed node takes the focus with it, to `<body>`. Measured 2026-11-05 in all three
engines: a View picked by the keys on a page whose View bar draws its chips again
for the new View (the outlet's graph Views, the Node Editor; Learn filtering, whose
View changes its filters) left the focus on `<body>`, ~350 ms after the menu had put
it back on the caret. On Records, whose bar is not drawn again, it stayed there.

So `#render` reads, BEFORE it draws, which chip holds the focus — by its id — and
which of its buttons, by `part` (`body` or `caret`; in its menu, the caret that opened
it). After, it focuses that part of the chip with that id, as `restamp` does for a set
(`T-one-tab-stop-per-set`). A chip built anew stamps a turn later, so that waits for its
`rendered`, and a later draw takes the wait over. Only while the focus is still
nowhere: a reader who moved on in the wait keeps where they went.

- Site: `src/components/sherpa-quick-filter-toolbar/sherpa-quick-filter-toolbar.ts`
- Site: `test/e2e/reforged-a-redrawn-bar-keeps-the-focus.spec.ts`
