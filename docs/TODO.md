# TODO

The list of open work. One file. Add to it, tick items off, do not start a second one.

Status: `[ ]` open · `[~]` in progress · `[x]` done

---

## The order to do them in

43 items. Ordered so that nothing is built twice.

Includes the six findings the 2026-09-23 component audit left open; its other 13
are done. `docs/COMPONENT-AUDIT.md` keeps the measurements behind every one.

Three rules set the order:

1. A decision that other work depends on comes FIRST. Build on a wrong model and
   you build twice.
2. A cheap fix that is already understood comes before a big build.
3. A big build comes last, and only after the thing it stands on is settled.

### Wave 1 — decide the model (nothing else is safe until these land)

| # | Item | Why first |
|---|---|---|
| 1 | ~~Context vs View~~ DECIDED 2026-09-24 — CLAUDE.md "Navigation terms" | Views, Save, Favourite, breadcrumbs and filter scope ALL sit on this. Every later item reads differently if the model is wrong. |
| 2 | Filter scope — down, never up | The panel, the menu rework and the allow-list all need the scope rule fixed. |
| 3 | Style/Transparent tokens | BLOCKED on your Figma export. Unblock it early — the button border item may turn out to be the same fault. |

### Wave 2 — cheap, understood, unblocks judgement

Small fixes. Each is a day or less. They also make the app honest to look at,
which matters for the design work in Wave 4.

| # | Item |
|---|---|
| 4 | The `More` chip shows active when it is not |
| 5 | Metric item — no surface or border colour |
| 6 | Every metric item uses the xsmall container class |
| 7 | Only five filter chips carry an icon |
| 8 | Fixed-height row uses a hard-coded gutter |
| 9 | Pagination row-count select is not a Sherpa select |

### Wave 2b — the Data Viz header

| # | Item |
|---|---|
| 9b | A Data Viz header, for metrics and chart containers |

After the metric fixes (5, 6), because it changes the same components. Before
the new components in Wave 10, so the canvas inherits it.

### Wave 3 — the consistency sweep

Do this as ONE pass, not two. Both items are the same job: find the hand-rolled
thing and delete it.

| # | Item |
|---|---|
| 10 | Notifications button — and sweep every component for the same fault |
| 11 | Button borders do not inherit the status colour |

Doing the sweep before Wave 4 means the new components inherit clean behaviour
instead of copying a fault.

### Wave 3b — the audit's leftovers

The component audit (2026-09-23) closed 13 of 15 findings. Six things it did NOT
close are below. They sit here because they are all "find the inconsistency and
rule on it" — the same job as Wave 3, and the new components in Wave 10 should
inherit the answers.

| # | Item |
|---|---|
| 11b | ~~`sherpa-group` — a wrapper component~~ **BUILT 2026-09-23** |
| 11c | ~~Shared constants — sweep~~ **DONE 2026-09-23 — 5 folded in** |
| 11d | `data-type` means nine things; `data-empty` means three |
| 11e | ~~Event detail shapes~~ **SWEPT 2026-09-23 — nothing to fix** |
| 11f | ~~3 toggle chips: owner or reporter?~~ **FIXED 2026-09-23 — it was the PERSISTENT chips** |
| 11g | `sherpa-nav-section` — measured; it is item 28's question |

### Wave 4 — the data-to-UI faults

These three are one family: the data layer moves, the component does not follow.
Fix them together and the cause is probably shared.

| # | Item |
|---|---|
| 12 | Metric trend does not update after a data-layer change |
| 13 | Sparkline does not follow its record deltas |
| 14 | An example of real-time data (WebSocket) |

Item 14 last of the three — it is the proof that 12 and 13 are really fixed.

### Wave 5 — the View lifecycle

Needs Wave 1 item 1 to have landed.

| # | Item |
|---|---|
| 15 | Save a View, and the Save split-button menu |
| 16 | Favourite and Save apply to the Context, not the View |
| 17 | Breadcrumbs are for workflow, not for the nav |
| 17b | At the mobile breakpoint the nav becomes a menu |

### Wave 6 — the allow-list primitive

| # | Item |
|---|---|
| 18 | An optional allow-list on ANY component axis |

On its own, because the filter menu rework (item 19) uses it. Build the
primitive, then build on it.

### Wave 7 — the filter surface

| # | Item |
|---|---|
| 19 | Rework the filter menu — two modes, and MANY conditions |
| 20 | An inactive chip must say where its filter is applied |
| 20b | The Created-date filter should be a top-level date RANGE |
| 20c | **BUG** — a range filter refuses its default max; the chip stays inactive |
| 21 | A filter PANEL, as an alternative to the toolbars |

Item 21 is undesigned. Do it last of the three, once the menu is settled — the
panel shows the same controls in a different frame.

### Wave 8 — overlay panels

| # | Item |
|---|---|
| 22 | `Ask N-zo` panel — width, and drag the left edge to resize |
| 23 | A focused grid row opens a details panel on the right |

22 before 23. Item 23 needs the resizing panel that 22 builds.

### Wave 9 — the accessibility gate

| # | Item |
|---|---|
| 24 | Playwright tests accessibility — WCAG 2.1 AA |

Here, and not earlier. Waves 1-8 change markup in most components, so an earlier
report goes stale. Here it also becomes the gate that Wave 10's new components
must pass.

### Wave 10 — the big builds

| # | Item |
|---|---|
| 25 | `sherpa-layout-canvas` + minimap |
| 26 | A `Grouped` mode for the content area |
| 27 | A consumer can supply their OWN templates and CSS |

### Wave 11 — the renames and the fold

Last, because they touch everything and block nothing.

| # | Item |
|---|---|
| 28 | A Figma component is NOT always a web component (sweep, then fold `sherpa-grid-cell`) |
| 29 | Rename `src/index.ts` to `src/app.ts` |
| 30 | Do we still need `icon-paths.ts` and `render-icon.ts`? |
| ~~31~~ | ~~The grid should be a TOKEN~~ — DONE 2026-09-24. It is TWO grids, 4px + 2px |
| 32 | Fold donut + gauge into ONE radial chart |
| 33 | Two scaling multipliers, in place of the remapped density modes |
| 34 | Figma: use the Navigation terms |

Item 29 dead last. It is a rename across the whole repo, so it is cheapest when
no other work is in flight.

### If you only do three things

1. ~~**Context vs View** (item 1).~~ Decided 2026-09-24.
2. **The consistency sweep** (items 10-11). It stops the next fault being copied.
3. **The allow-list** (item 18). It is one primitive that makes four later items
   smaller.

---

## Consistency — no hand-rolled behaviour

### `[ ]` The notifications button does not behave like other menu buttons

The notifications button opens a menu in its own way. It must use the behaviour
already established for a button that opens a menu.

Check EVERY component for the same fault, not only the App Header. Find any
button that is hand-rolled, or that deviates from the common behaviour.

### `[ ]` Button borders do not inherit the status colour

A button border does not take the `[data-status]` colour correctly.

Check for hand-rolled CSS that the component CSS or the framework CSS already
handles. Remove it; let the cascade do the work.

---

## Filters

### `[ ]` The `More` chip shows active when it is not

The overflow chip goes active when NONE of its child filters are active. It must
go active only when ONE OR MORE child filters are active.

### `[ ]` The data toolbar is clipped away below 800px tall

Measured 2026-09-24 at 1280x720 on `?context=records`: the data toolbar's
`Add filter` button sits at y=773 with `document.scrollHeight` also 720. So the
button is off-screen AND the page does not scroll — `elementFromPoint` returns
null and no click can reach it. At 1600x1100 the same button is at y=785 and
works.

The app shell is a fixed-height fit grid, so a row that does not fit is clipped
rather than scrolled. Whatever the fix, the rule is: nothing interactive may be
clipped out of reach at a supported height.

Two ways out, to choose when the work starts:
- The content area scrolls when its rows exceed the viewport.
- The grid card gives up height first, so the toolbars always fit.

### `[ ]` Fold the `More` overflow into the `Add filter` button

Two buttons at the end of the bar do nearly the same job. `More` holds the chips
that did not fit; `Add filter` holds the chips not yet on the bar. Both open a
menu, both are a list of filters, both end with the reader picking one.

Merge them into ONE button. Its menu has two parts: the filters already on the
bar but folded away, and the filters available to add.

Open questions, to settle when the work starts:
- Does a folded chip still DRILL (its own rows, one level in), while an
  available one only ADDS?
- What does the button say when only one of the two sets is non-empty?
- The badge on `More` counts ACTIVE folded filters — does the merged button keep
  that count, and does it count the addable ones too?

Related: the `More` chip's active state is already an open item above.

### `[ ]` An inactive chip must say where its filter is applied

The tooltip on an inactive filter chip tells the user nothing. If the App Header
applies that filter, the tooltip must say so.

### `[ ]` Rework the filter menu — two modes, and MANY conditions

Today the filter menu has a condition dropdown, and the chosen condition symbol
shows in the badge. Replace all of it.

**The badge.** Drop the per-condition symbol. Show ONE symbol that says only
"conditions are applied", like Excel's `f(x)` icon but for conditions. The right
glyph is not decided — pick one and show it.

**The default mode — selection.** The menu opens as a plain list:

- A search input at the top.
- Menu items with checkboxes.

**The condition mode.** An icon-only `Use condition` button in the menu header
switches to it. It shows:

- The condition select and its input.
- An `Add condition` button.

`Add condition` appends a row. Every row after the first STARTS with a chaining
select — `And` or `Or`. So a row is:

```
[And|Or] [condition] [value]
```

The first row has no chaining select.

**`Equals` stays a condition.** For `Equals`, the second input is NOT a text
box. It is a select menu of the values for that field.

### `[ ]` Only five filter chips carry an icon

A component-scoped filter chip needs NO icon. Drop them.

Only these five carry one:

| Filter | Icon |
|---|---|
| Views | monitor |
| Regions | globe |
| Customer / Organisation | office |
| Date filters | calendar |
| Time filters | clock |

### `[ ]` A filter applies DOWN its scope only, never up

Two scopes. The same filter in each scope gives a different result.

| Scope | What it touches |
|---|---|
| View | every piece of content in the View — it cascades DOWN |
| Component | that component or container only, plus its own parts (a grid filter also reaches the column header components) |

- A component filter NEVER trickles UP to the View or to a sibling.
- A component filter is already blocked when the View scope applies that same
  filter. Keep that.

**A LEGEND TOGGLE is a component-scope filter.** Will, 2026-09-23. Switching a
series off in `sherpa-chart-legend` filters THAT chart and nothing else — it
does not trickle down to a sibling chart, a grid or a metric. And it is still
subject to the View filter, which does cascade down: a series the View has
already filtered out cannot be switched back on by its legend.

So it is an instance of this rule, not a separate feature. The mechanism is
already right — the legend emits `legend-item-click` and the PAGE calls the
filter, which is why `bindLegendFilter` was deleted in favour of
`bindSelection` (`T-readonly-legend-is-a-key-not-a-filter`). What is missing is
the scope being STATED and enforced, the same as every other component filter.

Check the same question for every control that filters its own component: a
grid column filter, a metric's own scope, a chart's segment mode.

### `[ ]` BUG — a range filter refuses its default max, and the chip stays inactive

Will, 2026-09-23, two faults in one flow:

1. **The default MAX range is not accepted.** Picking the full span the filter
   offers is rejected, so the widest selection is the one you cannot make.
2. **The chip does not go active on Apply.** `data-current` is not set, so the
   bar reads as unfiltered while the filter is applied.

Where to start, from a scan 2026-09-23:

- `sherpa-quick-filter-toolbar.ts:909` — `#onRangeToggle` swaps the menu between
  its two shapes with `menu.toggleAttribute('data-range', on)`.
- `:891` sets `data-range` when a chip is stamped in range mode.
- `#onDatePicked` handles both `datetime-change` and `range-select` (`:395-396`),
  so a date range and a single date arrive on different events.
- `#onRangeToggle` listens for a bare `change` (`:398`) — the comment notes a
  `sherpa-switch` re-dispatches composed while a bare checkbox does not, which
  is a likely place for one of the two paths to be missed.

Only ONE range-capable chip exists in the Records example today — `Created date`
— and its menu carries no `data-range`, so the second fault may only show after
the Range switch is flipped. Reproduce that first: flip Range, pick the full
span, press Apply, and watch `data-current` on the chip.

Fault 2 is the same shape as the persistent-chip finding in 11f: a chip that
should be current and is not. Check whether the Apply path writes
`data-current` at all, or whether it writes and something clears it.

### `[ ]` The Created-date filter should be a top-level date RANGE

Will, 2026-09-23: it should be a top-level date range filter that slices the
records to a subset across the whole view.

**Where it is today.** `examples/contexts/global-filters.js:74` — it IS already at
view scope, in `globalFilters()`, so the scope half is right. What is wrong is
the SHAPE:

| | today | wanted |
|---|---|---|
| kind | `date` | a date RANGE |
| opens as | SINGLE, with a Range switch to flip | a range |
| offers | `availableDates` — the discrete days the data carries | a span |

The chip's own comment argues for single: *"opening in range mode makes the
common case — one day — take two clicks and a mode change."* That reasoning
holds for a COMPONENT-scope date chip. It does not hold for a view-level slice,
where "records created between X and Y" is the common case and a single day is
the rare one.

So this is not "change the default everywhere" — it is that a VIEW-scope date
filter and a component-scope one want different defaults.

Things to settle:

1. **Does `kind: 'date'` gain a range variant**, or does the chip take
   `data-range` (which `sherpa-menu` already has — see its `data-range` prop)?
2. **`availableDates` is a SET of days.** A range wants bounds — min and max —
   which the same data gives for free (`dates[0]` and `dates.at(-1)`). The
   calendar already accepts both; `T-a-date-chip-names-its-field` records why
   the default last-90-days matched nothing here.
3. **It cascades DOWN.** Once it is a view-scope range, every component in the
   view reads the subset — which is the rule in "A filter applies DOWN its scope
   only", and the same ruling as the legend toggle.

### `[ ]` A filter PANEL, as an alternative to the toolbars

A panel in the content area, toggled from the options button (the sliders icon).

- 3 columns wide, on the left. It fills all rows.
- Sections for the View filter and for every component-level filter.
- At tablet and phone widths, filtering goes back to the toolbars.
- The user can put it back to toolbars.

Not designed yet. Do this one by trying things.

---

## Views

### `[x]` A nav item goes to a CONTEXT, not a View

Done in code 2026-09-24. The four terms are in CLAUDE.md "Navigation terms":
Section, Area, Context, View. A `View` is what the View chip in the App Header
selects.

- A View is a preset, or one the user saved.
- A View has its own layout and its own content.
- A View can have its own Data Sources and Stores.
- Views under one Context DO NOT have to share data.

### `[ ]` Save a View, and the Save split-button menu

**Save.** Clicking `Save` in the App Header writes the current View — its layout,
its content and its WHOLE filter configuration — to a view definition. The user
can load it again at any time.

**Load.** A saved View loads from the View filter chip menu, in a section at the
BOTTOM of that menu, labelled `Custom Views`.

**A name clash.** If a View of that name already exists, in `Presets` or in
`Custom Views`, append ` - Copy-001` to the name.

**The menu button, to the right of Save.** It shows two options:

| Option | What it does |
|---|---|
| `Save As` | A dialog. The user edits the View name, then saves. The user can cancel. |
| `Delete View` | Critical style. A dialog asks the user to confirm. ONLY a custom View can be deleted. |

### `[ ]` Favourite and Save apply to the Context, not the View

Favouriting or saving a View applies to every View in that Context. It must
apply only to the one View. Today the ★ stars the Context
(`examples/index.html`, the `view-favorite` listener).

---

## Navigation

### `[ ]` At the mobile breakpoint the nav becomes a menu

At mobile width the left nav rail is GONE. A menu takes its place.

**The trigger.** A menu button in the App Header, to the RIGHT of the Context title.

**The rail.** Hidden. The padding it puts on the App Header and on the content
area goes to `0`. No empty gutter left behind.

**The menu.**

- It fills the WHOLE viewport when open.
- No `Pin` option. Pinning means nothing here.
- `Settings` is a menu item, at the BOTTOM of the list.
- The footer holds a `Cancel` button. It closes the menu and redirects nowhere.

**Pressing a nav item that targets a Context** closes the menu AND performs the
redirect.

**Put the nav on the data layer while you are here.** The rail and this menu are
TWO renderings of ONE nav model. Do not let each draw itself its own way.

Checked 2026-09-23: `sherpa-nav` has `renderData()` (line 131), so
`populate(config)` works — but it never calls `bind()`. It is a one-shot draw,
not a live binding. `sherpa-nav-item` touches the data layer not at all.

Bind the nav to a Store and both renderings follow one source. A change to the
nav then reaches the rail and the menu together.

### `[x]` Settings opens as an overlay, and closing it puts you back

Done 2026-09-24. `sherpa-dialog data-type="overlay"` sits in the app shell's new
`overlay` slot and covers the header and content; the rail stays beside it. The
Context under it is never reloaded, so its View survives. The URL carries both:
`?context=records&settings=profile`. Proven by
`test/e2e/reforged-settings-overlay.spec.ts` — four ways out, one per test.

### `[ ]` Figma: use the Navigation terms

The code moved to Section / Area / Context / View on 2026-09-24 (CLAUDE.md
"Navigation terms"). Figma still uses the old words. Rename there, then resync:

- App Header: the `View title` layer is the Context title. Code parts are now
  `row-context` and `context-icon`.
- Navigation: a parent row is an Area; a leaf row is a Context. A Section is
  the label + divider only.
- Any `Views` section label, or frame named for a page, is a Context.
- Keep `View` only for the View chip and its View group (★ · Save · ▾).
- `sherpa-dialog` has a new `data-type="overlay"` (fills the app area, non-modal)
  and `sherpa-app-shell` a new `overlay` slot. Neither exists in Figma yet.
- Navigation: collapsed `nav-layout/width` is pinned to 40px. Bind it to
  `size/3xl` so the closed rail follows density (36 / 40 / 48), as the code
  already does. Then drop the override in `sherpa-nav.css`.

Each code-only difference above is also in that component's `_divergence` block.

### `[ ]` Breadcrumbs are for workflow, not for the nav

Breadcrumbs must not show movement between Contexts — the nav does that.
Breadcrumbs are for a workflow redirect or a drilldown, e.g. a link in a grid
cell opens a details Context.

---

## Overlay panels

### `[ ]` The `Ask N-zo` panel is too narrow, and cannot be resized

- Make the panel wider.
- The user can drag the LEFT edge to resize any overlay panel.
- Set a sensible minimum width.

### `[ ]` A focused grid row opens a details panel on the right

Focus a row in `sherpa-data-grid` → an overlay panel opens on the right with more
detail about that record.

- Any other open overlay panel closes first.
- The panel header has up and down chevron buttons.
- Those buttons step the focused row up and down the grid.

---

## Components

### `[ ]` A Data Viz header, for metrics and chart containers

New Figma design: `Data Viz Header`, node `1456:30467`, on page `✅ Headers`.
Use it for Metrics, and for any Container that holds a chart or other data viz.

Read from Figma 2026-09-23. It is 32px tall, horizontal, `gap/sm`, `padding/md`
on all four sides, with a `border/width/sm` bottom rule in `style-border/base +1`
and no fill.

Its parts, left to right:

| Part | What |
|---|---|
| Drag handle | a Button, icon only. Toggled by `hasDragHandle` |
| `left` | a SLOT. Holds the leading icon. Toggled by `hasIcon` |
| `Labels` | vertical, `gap:2` — the `title`, then a `metadata` SLOT |
| `actions` | a SLOT. Icon-only Buttons |

The title is the notable part. It is NOT the normal container heading:

- `content/font/body`, `content/weight/light`
- `content/size/small` (12px), `content/line-height/small` (16px)
- `content/body/+1`
- **UPPERCASE** (`textCase: UPPER`)

The `metadata` slot sits UNDER the title, `gap:12`, and holds an optional
description.

Compose the two Buttons from `sherpa-button`. Do not hand-roll them.

### `[ ]` The pagination row-count select is not a Sherpa select

The row-count select box in the pagination does not follow the `sherpa-input`
select design.

### `[ ]` A metric trend does not update after a data-layer change

The trend direction icon and the trend label on the metric component do not
update when the data layer transforms the records — a filter, for example. The
total value moves; the trend does not follow it.

### `[ ]` A sparkline does not follow its record deltas

The sparkline does not show the change in the record values, so it reads as
disconnected from the total value label above it.

### `[ ]` The metric item has no surface or border colour

Figma gives the metric item a surface colour and a border colour. The coded
component does not apply either.

### `[ ]` Every metric item uses the xsmall container class

Some do not.

---

## Testing

### `[ ]` Playwright must test accessibility — WCAG 2.1 AA

Target: WCAG 2.1 level AA, every component.

**Starting point, checked 2026-09-23:** none. 93 spec files in `test/e2e/`, not
one for accessibility. `axe-core` is NOT a dependency of this repo.

**The output is a REPORT, one per component.** A pass/fail list is not enough.
For each failure state:

- what is wrong,
- which WCAG 2.1 AA criterion it breaks, and
- HOW to correct it.

Watch out for the shadow DOM. A checker that reads only the light DOM sees
almost nothing of a Sherpa component. Prove it reaches inside a shadow root
before trusting a green result. See `sherpa-read-pixels-not-computed-style` —
a tool that reported the wrong thing cost three wrong diagnoses.

---

## New components

### `[ ]` `sherpa-layout-canvas` — an infinite canvas content area

A content area that pans and zooms without an edge.

- The surface carries a CROSSHAIR grid pattern.
- A floating button group sits at the BOTTOM RIGHT, over the canvas.

The button group holds four controls:

| Control | Does |
|---|---|
| Pan | the pan tool |
| Zoom in | step the zoom up |
| Zoom out | step the zoom down |
| Options | opens a menu |

Compose it from `sherpa-button` and the existing menu component. Do not
hand-roll either — see the Consistency group.

**A minimap, to navigate the canvas.** A small map of the whole canvas showing
where the viewport sits. The user moves the viewport from it.

Open question: its own component, or part of `sherpa-layout-canvas`?

Lean: PART OF the canvas. Nothing else will use it, and it needs the canvas's
pan and zoom state to draw itself. A separate element would have to be handed
that state, which is a second owner of one value — the recurring bug. See
`sherpa-state-ownership-and-parity`.

It becomes its own component only if a second host wants one.

---

## Data layer

### `[ ]` An example of real-time data

Show data that changes in real time — over WebSocket, or something like it —
coming through the data layer and into a piece of content in the UI.

---

## Architecture — allow-lists

### `[ ]` An optional allow-list on ANY component axis

One primitive, for every component. A component takes an optional allow-list of
what it may show or do. No list → everything is allowed. This is the default, so
nothing breaks.

It applies to four axes:

| Axis | Example |
|---|---|
| Fields | which data fields a filter toolbar offers |
| Values | which values a filter menu offers |
| States | which states a control may cycle through |
| Actions | which actions a component may perform |

Rules:

- A value must exist in the field's own value set to be allow-listed.
- A value that is not on the list is NOT shown.
- The list is a plain array of objects. Data, not code.

Why it is worth doing:

- A filter toolbar becomes easy to control — hand it a list.
- Contextual and access-based variation needs no per-component branch.
- A state list makes a boolean toggle and a tri-state cycle THE SAME control.
  Two states or three; the component does not care.

---

## Layout — the content area

### `[ ]` A fixed-height row uses a hard-coded gutter, not the token

In a fixed-height content area, the LAST content item does not use the spacing
token for the gutter between the row above it and itself.

So the spacing breaks the moment `compact` or `comfortable` density is applied —
the token moves, the hard-coded value does not.

### `[ ]` A `Grouped` mode for the content area

A new mode. When it is on, every container in the content area reads as ONE
stitched object.

- Every gutter goes to `0px`.
- Every content container uses the MID grouping rounding (`0px`) on its borders.
- Only the TOP-MOST container keeps its own rounding.

**Will's ruling: this is `sherpa-group` applied to the layout grid.** The
wrapper already derives grid position from `sibling-index()` and rounds only the
four outer corners — which is exactly what "one stitched object" means. Built
2026-09-23 and proved equivalent to the class in all three engines.

So the work is not a new mode's CSS. It is deciding how the two wrappers meet:
`<sherpa-layout-grid>` owns the tracks and `<sherpa-group data-direction="grid">`
owns the joins. Either the layout grid gains a `data-grouped` that turns its own
gaps to 0 and applies the group rules, or a group wraps a layout grid. Try both;
the first is likely, because the gutter is the layout grid's to give up.

---

## Architecture — component boundaries

### `[ ]` Fold donut + gauge into ONE radial chart

Will, 2026-09-23: *"the donut and gauge could be consolidated into a single
chart component (and also support pie charts) if we add an inner radius, sweep
start angle and sweep angle variables. Booleans for the gauge needle etc and
we're golden."*

**The drawing engine is ALREADY one thing**, and it already takes every
variable named. `RingSegmentOptions` in `src/core/data/format-tick.ts:204`:

| option | what it is |
|---|---|
| `inner` | inner radius — *"0 draws a solid wedge — a pie slice"*, its own comment |
| `outer` | outer radius |
| `startDeg` / `endDeg` | the sweep, clockwise from 12 o'clock |
| `radius` | corner rounding |

Both components call `ringSegmentPath()` with the same three geometry constants,
which is why those moved to `shared-constants.ts` as `RADIAL_CENTRE`,
`RADIAL_CORNER` and `RADIAL_OUTLINE` — a value that drifted in one would draw
two different rings from one function.

**And pie already exists.** `sherpa-donut-chart` takes
`data-type="donut | pie"`, where pie fills to the centre. So this is folding
TWO components, not building a third mode.

Will's rule for it — *"0 inner radius and no corner rounding on segments"* —
found a live bug on the way in: the inner radius was right, but `radius: CORNER`
went to every slice, so a pie's point was rounded off and its path began one
unit short of the centre. Fixed 2026-09-23,
`T-a-pie-slice-has-no-rounded-corner`. The consolidated component needs the same
rule: rounding belongs to a corner that sits on two ARCS, not to one where two
straight edges meet.

What is actually different, measured:

| | donut | gauge |
|---|---:|---:|
| TS | 188 | 290 |
| CSS | 161 | 304 |
| HTML | 55 | 103 |

The gauge's extra ~290 lines are its own features, not a different ring:
`data-value` with a needle, `data-min` / `data-max` bounds, `data-caption`, and
a `caption` slot. Those become the booleans and attributes Will describes.

Proposed shape:

```html
<sherpa-radial-chart data-type="donut">   <!-- default -->
<sherpa-radial-chart data-type="pie">     <!-- inner: 0 -->
<sherpa-radial-chart data-type="gauge" data-value="60" data-min="0" data-max="100">
```

with `data-sweep-start` and `data-sweep` for the arc, since a gauge is a donut
that stops short — today that is hard-coded as the top half.

Three things to settle first:

1. **The name.** `sherpa-radial-chart` says what it draws. `sherpa-chart` is too
   broad — bar and line are not radial.
2. **Does it fold, or does the gauge compose the donut?** The same question as
   item 28 (a Figma component is not always a web component). A gauge that
   wraps a donut keeps both specs; a fold leaves one.
3. **The Figma side.** Donut and Gauge are separate components there. This is a
   CODE consolidation unless Figma follows — see the layout-grid ruling for the
   precedent that a code component need not map 1:1.

### `[ ]` Do we still need `icon-paths.ts` and `render-icon.ts`?

Will, twice: *"HTML & CSS should be handling this."*

**Measured 2026-09-23, and the first answer was "keep both".** Worth re-opening
with what has changed since, but start from these numbers rather than re-deriving
them.

`icon-paths.ts` (231 lines, 307KB, generated) carries the drawings AND each
one's INK BOX. The `.svg` files do not:

| | |
|---|---|
| `.svg` files saying `viewBox="0 0 14 14"` | **all 214** |
| whose real ink box is tighter | **206** |
| a 24px wrapper, using the ink box | fills it — 25.2px |
| a 24px wrapper, using the file's frame | **20.4px — 15% small** |

`dist/icons/` does not exist either: the files never ship, so a runtime fetch
would mean 214 requests and an async icon API in a zero-dependency library.

`render-icon.ts` (68 lines) is the writer. 48 of 76 icon sites take a name from
OUTSIDE the component — `data-icon-start="gear"` on a host — which a static
template cannot cover.

**What would change the answer.** Any of these makes the TS unnecessary:

1. **Ship the SVGs with a corrected `viewBox`.** If `generate-icons.mjs` wrote
   the ink box INTO each file, a `<img>` or an `<svg><use>` would fit correctly
   with no JS. 214 files, one generator change. This is the strongest option.
2. **One sprite sheet.** All 214 in a single `<symbol>` file, referenced by
   `<use href="#gear">`. One request, no per-icon module, and the viewBox lives
   on the symbol. But `<use>` across a shadow boundary needs checking.
3. **A CSS `mask-image` set.** Each icon a masked box, coloured by
   `background-color` so `currentColor` still works. No SVG in the DOM at all.

Measure before choosing. The thing that decides it is whether the chosen route
keeps the ink box — that is the whole reason the TS exists, and
`T-icon-box-is-not-the-glyph` records what a 15%-small icon looked like.

### `[ ]` A consumer can supply their OWN templates and CSS

Someone building an app with Sherpa-UI must be able to:

- give a component their own HTML template, in place of the default, and
- give it their own CSS file, which EXTENDS the default component CSS rather
  than replacing it.

Make it possible, and make it easy.

Where it stands today, in `src/core/ui/sherpa-element.ts`:

- `static css` and `static html` are plain `URL`s (lines 246, 249). A subclass
  can already re-point them, so half the door is open.
- `templateCache` is keyed by the template URL's `href` (line 64), so two URLs
  do not collide.
- `sharedStyles` (line 255) is a `URL[]` adopted into EVERY shadow root.

What is missing:

1. A supported way to EXTEND the CSS. Re-pointing `static css` replaces it;
   there is no "default, then mine" order.
2. A consumer-facing API. Today it means subclassing and re-defining the custom
   element, which is not easy.
3. A rule for what a custom template must still provide — the parts, the slots
   and the classes the component's JS and CSS expect. A template that drops one
   fails silently.

The `.component.yaml` spec already states the anatomy. It is the natural place
to check a custom template against.

### `[ ]` Rename `src/index.ts` to `src/app.ts`

`src/index.ts` does not hold an index. It registers every component, installs
the icons and installs the tokens — it SCAFFOLDS a Sherpa app. Name it for that.

Knock-on work, because it is the package entry point:

- `package.json` — the `exports` and `main` fields.
- The build script and the `dist/` output name.
- Every import of `sherpa-ui` in `examples/`, `sandbox/` and `test/`.
- The MCP server, if it reads the entry point by name.

Keep `sherpa-ui/data` (`src/data.ts`) as it is. That one is named right.

### `[ ]` A Figma component is NOT always a web component

We have been assuming that every Figma component becomes a `sherpa-*` custom
element. That is wrong. A sub-component is often only:

- a `<template>` inside its parent's `.html`, or
- a set of CSS classes.

`sherpa-grid-cell` is the clear case. It is a set of HTML templates and the CSS
that goes with them, used by the data grid. It does not need to be an element.

Work to do:
1. Sweep all 58 components. Mark each one: real element, template, or CSS only.
2. For each that is not a real element, say what it costs to fold it into its
   parent — the spec, the MCP, the tests, the Figma link.
3. Fold the clear ones in. Start with `sherpa-grid-cell`.

Note: a Figma component stays a Figma component either way. Only the CODE side
changes. The def keeps the Figma link.

---

## From the component audit

The audit closed 13 of 15 findings — the fixes are in git, and
`docs/COMPONENT-AUDIT.md` holds the measurements behind each one. These six are
what it left open.

### `[ ]` `sherpa-group` — a wrapper component, and grouping props on the base class

**BUILT 2026-09-23.** `<sherpa-group>` ships with `data-direction="row|column|grid"`
and `data-col-count`, proved equivalent to the `.sherpa-group` class in all
three engines, and `sherpa-pagination` is retrofitted — 4 `data-group`
attributes gone, geometry byte-identical. `data-group` is now declared in
`SHARED_PROPS`; it was used at 15 sites and declared by nothing.

**What is LEFT of this item**, and why it is still open:

1. The generated `grid-*` / `vertical-*` blocks — 160 of 200 lines, in two
   copies — can now go, because the wrapper derives those positions.
2. `.sherpa-border-edges` / `.sherpa-border-corners` belong in their own
   `sherpa-borders.css`. **21 components** use them and they are not grouping.
3. The rest of the callers (calendar, menu, quick-filter-toolbar,
   select-checkbox) still use the class.

---

**The original proposal, kept for the reasoning.** Make a group a WRAPPER COMPONENT
that applies position and gap to its own children, the same way
`sherpa-layout-grid` wraps the layout grid. Then a grouped row, column or grid
needs no per-item bookkeeping: the wrapper owns it.

`sherpa-element` gains the grouping props so ANY component can be grouped. Not
every component will be, but it is generic enough to be worth it.

#### Proved before proposing — measured 2026-09-23

A wrapper CAN style its slotted children by position. Three results, all three
engines:

| | result |
|---|---|
| Corners by position | `4px/0px` · `0px/0px` · `0px/4px` — ends keep their outer corners |
| The halved shared edge | `0.5/0.25` · `0.25/0.25` · `0.25/0.5` — the Figma pattern |
| GRID position from `sibling-index()` | `0,0 1,0 2,0 0,1 1,1 2,1` — exact in Chromium, Firefox AND WebKit |

Two things make it work, and both are already in place:

- `::slotted()` sets CUSTOM PROPERTIES, which inherit through the child's own
  shadow boundary. That is why the existing classes work at all.
- The five `--sherpa-group-*` are registered with `@property` in `tokens.css`,
  which is the DOCUMENT — so the maths resolves. Unregistered, the property
  stores the expression as text and nothing computes.
  `T-at-property-needs-the-document`.

An escape hatch exists: an inline style on a child beats the wrapper, so a
component that must not be grouped can say so.

#### What it replaces

`src/core/sherpa-grouping.css` (173 lines, hand-written) and
`src/core/sherpa-group-positions.css` (231 lines, generated), whose blocks are
ALSO written into `tokens.css`. Today there are two doors:

| | what | sites |
|---|---|---|
| `data-group="start"` | the position STATED | **15** |
| `.sherpa-group` on a wrapper | the position DERIVED | **8** |

`T-grouping-is-an-attribute-and-a-class` explains why the generated blocks are
emitted twice: a bare `[data-group]` rule in `tokens.css` cannot reach a shadow
root, and the same rule in an adopted sheet cannot reach the page. **A wrapper
COMPONENT collapses that** — its own shadow sheet reaches its slotted children
wherever they are, so one copy serves both cases.

**And it retires the dead weight.** The generator emits all 21 Figma positions;
only four have callers:

| position | real callers |
|---|---:|
| `start` · `end` | 6 each |
| `mid` | 3 |
| `solo` | 0 — generated only |
| the 16 `grid-*` and `vertical-*` | **0** |

**160 of 200 generated lines are dead**, in two copies — ~320 lines adopted into
all 59 shadow roots for nothing. A wrapper derives those positions instead of
enumerating them.

#### The work

1. **`sherpa-element`** — add the grouping props to `SHARED_PROPS`, which is
   already "shared style attributes whose shape is identical wherever they
   appear". `data-group` is declared by NOTHING today: 15 sites use it and it
   works only through a document CSS rule, so it is invisible to every spec.
2. **`sherpa-group`** — the wrapper. `data-direction="row|column|grid"` and
   `data-col-count` for the grid. Its shadow sheet does the `::slotted()` work.
3. **Keep the attribute door** for a host that states a position in its own
   markup — but the wrapper becomes the recommended way, and the generated
   `grid-*` / `vertical-*` blocks can go.
4. **`.sherpa-border-edges` and `.sherpa-border-corners` are NOT grouping.**
   They are the per-edge primitives grouping happens to use, and **21
   components** use them directly — they replaced 26 hand-written copies. Move
   them to their own `sherpa-borders.css` rather than leaving them in a file
   that will no longer be about grouping.

Name it `sherpa-group`, not `sherpa-grouping`: it is the thing, not the idea.
The same ruling as `sherpa-layout-grid`, which is a util component with no Figma
node — see `docs/COMPONENT-AUDIT.md` finding 15.

### `[x]` Shared constants — swept 2026-09-23

`src/core/ui/shared-constants.ts` holds two values today: `ORGANISE_ICONS` and
`NON_VALUE_ROWS`. It was renamed from `icons.ts` during the audit because three
of its four importers wanted the CSS selector, not the icons.

**Done.** Five more folded in, each verified identical in value AND use first:

| | shared by |
|---|---|
| `MIRRORED_CONTROL_ATTRS` | select-checkbox + select-radio |
| `RADIAL_CENTRE` · `RADIAL_CORNER` · `RADIAL_OUTLINE` | donut + gauge |
| `DEFAULT_TICKS` | barchart + line-chart |

The radial three mattered most: both charts hand them to `ringSegmentPath()`, so
a value that moved in one and not the other would draw two different rings from
one function.

NOT moved: `sherpa-input-text`'s `MIRRORED`. It is a SUPERSET — a text field
also mirrors `placeholder`, `pattern`, `inputmode` and the length limits. A
superset is not the same value.

### `[ ]` `data-type` means nine things; `data-empty` means three

`data-type` selects: which control element, how many thumbs, pill vs rectangle,
square vs labelled, a look, a template variant, a scope, a cardinality, a role.

`data-empty` means: a message string (list), a host boolean (grid), a per-pane
boolean (transfer-list).

Neither is a bug — both are rulings. The question for `data-type` is whether it
should be reserved for TEMPLATE SELECTION, which is what four of its nine uses
already do.

### `[x]` Event detail shapes — swept, and there was nothing to fix

Swept 2026-09-23 with the TypeScript AST rather than a regex. **3 events carry
more than one detail shape, and all three are correct.**

| event | shapes | verdict |
|---|---|---|
| `change` | 5 | **Correct.** A checkbox reports `checked`, a card `selected`, a switch `checked` alone. The native event's detail follows the control. |
| `item-click` | `{label}` vs `{href, label}` | **Correct.** `sherpa-list-item` has no `href` — measured, zero references. A nav item navigates; a list item does not. |
| `quick-filter-change` | `{scope, values}` vs two toolbar shapes | **Correct, and deliberate** — see below. |

**The audit's two headline examples were already fixed.** `sort-change` is
`{field, direction}` in all three emitters and `group-toggle` is
`{value, collapsed}` in both — commit `379e5fd2`. The `{expanded}` vs
`{collapsed}` inversion no longer exists.

**`quick-filter-change` is a TAGGED UNION, not drift.** `scope` says which
shape you have: `'chip'` carries a bare `string[]`, `'bar'` a
`Record<id, string[]>`. `T-values-carries-two-shapes` records why that matters —
reading one as the other once *"turned a sort pick into a filter and emptied the
grid."*

The chip's shape never escapes. Verified by dispatching one by hand at a chip:
the toolbar catches it in CAPTURE (`#onOrganiseChange`,
`T-capture-beats-registration-order`) and re-emits the `'bar'` shape, so a
document listener only ever sees the record. `examples/contexts/records.js:553`
does `Object.entries(e.detail.values)` with no `scope` guard and is safe for
that reason — though a guard there would cost nothing.

**A note on method.** Four regex passes reported 8 disagreeing events. Every one
of the extra five was a parser artefact — a ternary's `null` read as a key, a
multi-line object read as two. The AST reports 3. A regex over TypeScript
answers a question about the regex.

### `[x]` Toggle chips: owner or reporter? — fixed, and it was a different chip

**The audit's three menu-less toggle chips are fine.** Measured with a real
mouse click: one click, ONE `data-current` write. They are not persistent, so
the toolbar never overwrites them.

**The real two-owner case was the PERSISTENT chips**, which the audit did not
mention. The toolbar's own comment said "A selector: always on, and its body
does not flip it" — which is what `data-locked` means — but it set only
`data-persistent`, so the chip flipped itself off and the toolbar wrote it back
on the next line.

| | writes per click |
|---|---|
| before | **2** — the chip flips, the toolbar undoes it |
| after | **0**, and the chip stays current |

Fixed by setting `data-locked` alongside `data-persistent`. `data-persistent`
keeps its own job: it says the chip stays on the bar when off, which is a
different fact from who owns its state.

#### The original text, for the record



The audit's "15 unguarded `data-current` writes" measured down to **3**. A chip
WITH a menu returns before the self-flip line, so only the three menu-less
toggle chips — `Open tickets`, `At risk`, `Unassigned` — can write their own
state. A real mouse click produces exactly ONE write, so the two owners do not
conflict today.

Still two owners on paper. Decide per site whether the toolbar owns the chip or
reports it. `check-ownership.mjs` now tells `this` from a child, so the gate
will not mislead you — `T-writing-a-child-is-not-owning-yourself`.

### `[ ]` `sherpa-nav-section` is a component nothing uses

`sherpa-nav` draws the same label-plus-rule itself. Measured 2026-09-23: **zero**
components compose it, though it is exported, has 3 passing tests, and maps to a
real Figma node (`Navigation Section/default`, `32:43134`).

**It is not dead code** — the component works. `data-collapsed` correctly takes
the label from `display: block` to `none`; both sides draw the same hairline
from the same two tokens (`--sherpa-border-top` over
`--sherpa-theme-border-default-2`). What differs is the structure:

| | `sherpa-nav-section` | `sherpa-nav`'s own |
|---|---|---|
| label | `<span class="label">` | `<h2 class="section-label">` inside `<section>` |
| rule | a sibling `<span class="rule">` | an `::after` on the label |

**The blocker for composing is measured, and it is the shadow boundary.** The
nav collapses its label from `:host([data-nav-state="collapsed"]) .section-label`
— a rule in the NAV's sheet. Tested by putting a real `<sherpa-nav-section>`
inside a collapsed nav's shadow root: the child's label stayed
`rgb(53, 53, 61)` at 10px, untouched. A parent's `:host` rule cannot style a
child component's shadow content.

So composing costs one `setAttribute` — the nav mirrors its state onto each
section's own `data-collapsed`, which already works. That is cheap, and it is
the same shape as `sherpa-app-shell` mirroring the rail's state.

Three ways to go, and this is really item 28's question:

1. **Compose it.** The nav stamps `<sherpa-nav-section>` and mirrors
   `data-collapsed`. Two components, one drawing, and the Figma link stays
   meaningful.
2. **Fold it.** Delete the element, keep the templates and CSS inside
   `sherpa-nav`. Loses the standalone spec and 3 tests; the Figma component
   stays a Figma component, as the layout-grid ruling allows.
3. **Leave it.** It costs 65 lines and is correct.

Answer it with `sherpa-grid-cell` in item 28 — the same question, and the grid
is the bigger case.

---

## Tokens

### `[ ]` Two scaling multipliers, in place of the remapped density modes

Will, 2026-09-23: in Figma the Comfortable and Compact modes are remapped
aliases for every size and space variable — necessary there, but in code two
multipliers would do it.

| | what it does |
|---|---|
| **Breakpoint scaling** | scales sizing and spacing by breakpoint. Bigger on mobile and tablet, for touch targets. |
| **Mode scaling** | Compact and Comfortable, applied RELATIVE to the breakpoint scale. |

Breakpoint first, then mode.

#### What the modes actually are today — measured

Not a multiplier. The ratios are all over the place: compact runs 0.500 → 0.900
of default, comfortable 2.000 → 1.125. But laid against the scale itself it is
**a step shift**:

```
default scale   0  2  4  8  12  16  20  24  32  40  48  56  64
```

| | rule | holds for |
|---|---|---|
| compact | the PREVIOUS step | **10 of 13** |
| comfortable | the NEXT step | **9 of 13** |

The exceptions are smaller than they look, and one is fine. Re-measured against
BOTH scales:

| value | on the space scale | on the size scale | on the 4px sub-grid |
|---|---|---|---|
| `28px` | no | **yes** (`size-xl`) | yes |
| `36px` | no | no | yes |

So `28` is a real step that the space scale simply does not carry — a density
mode borrowing it is reasonable. Only `36` sits on neither scale.

#### And it must keep the grid — Will, 2026-09-23

This is the argument that settles step-vs-multiplier, and it is measurable.

**A multiplier leaves the grid immediately.** Applied to the space scale:

| multiplier | values off the 4px sub-grid |
|---|---|
| ×0.75 | 8 of 12 |
| ×0.8 | **10 of 12** — including `9.600000000000001` |
| ×0.875 | 10 of 12 |
| ×1.25 | 8 of 12 |

**A step shift cannot leave it**, because every result IS a scale value. And
both scales are already clean — measured, **zero off-grid steps**:

```
space   0  2  4  8  12  16  20  24  32  40  48  56  64
size    0  2  4  8  12  16  20  24  28  32  40  48  56  64
        └ 2px edge cases ┘ └── 4px sub-grid ──┘ └─ 8px grid ─┘
```

The gaps widen 2 → 4 → 8 as the scale climbs, which is what keeps a small step
on the sub-grid and a large one on the 8px grid.

So: **steps, not multipliers**, for both the breakpoint and the mode. `round()`
is not needed either — `T-round-is-for-dynamic-sizes-only` says it is for
dynamic content, and a step offset is not dynamic.

So "mode scaling" is better expressed as `--sherpa-scale-step: -1 | 0 | +1`
against one scale, not a multiplier against a value. A multiplier on `12px`
gives `10.8`; a step gives `8`, which is on the grid.

#### Breakpoint scaling does not exist yet

Measured: `--sherpa-layout-grid-gap-horizontal` and `-padding` resolve to
`--sherpa-display-mode-space-base` at **every** breakpoint — mobile, tablet,
desktop and wide all point at the same token. Only the COLUMN COUNT and the
grid's own geometry move.

So the touch-target half is new work, not a re-expression of something Figma
already does.

#### Order of work

1. **Settle the step rule.** `28px` is already a size step, so the space scale
   may simply be missing it; `36px` is on no scale and is the one real
   exception. A rule with exceptions is not a rule.
2. **Emit the scale ONCE** plus a step offset, rather than three full copies of
   every space and size token. `tokens.css` currently carries the whole scale
   three times.
3. **Add the breakpoint step.** One offset per breakpoint, applied before the
   mode's. Mobile and tablet step UP.
4. It composes with item 31: `--sherpa-grid-step` says what a step IS, and this
   says how many steps to move.

### `[x]` The grid is now TWO tokens — DONE 2026-09-24

Will, 2026-09-23: *"This will allow us to easily adjust them for new themes &
token sets in the future."*

**Today the grid is a number in a SCRIPT.** `scripts/lint-css.mjs:126` is the
whole rule:

```js
if (v <= 1 || v === 999) continue;   // strokes + the pill idiom
if (v % 2 === 0) continue;           // <- the grid, hard-coded
```

So the spacing SCALE lives in Figma and the grid it is meant to sit on lives in
a build script, and the script cannot read the tokens. A new theme moves one and
not the other.

**And the grid is 4px, not 8px.** Re-measured 2026-09-24 against the real
`tokens.css`, every `space-*` and `size-*` value in all three density modes:

| mode | off the 4px grid | off the 8px grid |
|---|---|---|
| compact | **none** | 4, 12, 20, 28, 36 |
| default | **none** | 4, 12, 20, 28, 36 |
| comfortable | **none** | 4, 12, 20, 28, 36 |

So the scale is NOT mixed, and compact is not a special case: all three modes
carry the same scale, every value sits on 4px, and the five that miss 8px are
simply the odd multiples of 4. **8px is the even half of a 4px scale**, not a
grid the scale sometimes leaves.

(An earlier note here claimed `space-sm` was 12/8/16 per mode and that `2xl` was
off-grid in two modes. Both were wrong — the real values are 8/16/16 and 28/36/36,
and none of them is off the 4px grid.)

That also explains the lint result honestly: `% 2` passes everything because the
scale is on 4px, not because the rule is too loose for a mixed scale.

**What to do.** Emit the grid from Figma as two properties, so a theme states
its own:

```css
--sherpa-grid-step: 8px;      /* sizing, spacing, radius */
--sherpa-grid-substep: 4px;   /* text and icon alignment */
```

Then:

1. `lint-css.mjs` READS them out of `tokens.css` instead of hard-coding `% 2`.
   One source, and a theme that changes the step changes the lint.
2. CSS can consume them directly where a value is computed rather than taken
   from the scale — `round(var(--_measured), var(--sherpa-grid-step))` is
   exactly the dynamic case `T-round-is-for-dynamic-sizes-only` describes.
3. The SCALE can then be checked against its own grid. `space-2xl: 36px` is not
   on an 8px step; today nothing says so.

Decide first whether the step is per-MODE (compact 4, default 8) or one value
the modes all sit on. The measurements above say per-mode, but that is Figma's
call, not the code's.

Base CSS or tokens? **Tokens.** `sherpa-base.css` is adopted into shadow roots;
the linter reads a file on disk, and `tokens.css` is the file it can read.

---

**Done 2026-09-24.** The open question above — per-mode or one value — was
answered by measuring: one value, because all three density modes carry the same
scale. But the measurement also changed the shape of the answer.

`@layer core` now emits two properties, DERIVED from the scales by a GCD over
their own values, never typed in:

```css
--sherpa-grid-space-step: 4px;   /* sizing, spacing, radius */
--sherpa-grid-text-step:  2px;   /* text, and the icons that alias it */
```

1. `lint-css.mjs` reads both out of `tokens.css` and picks per declaration.
2. The rule went from `v % 2` to the real grids. It surfaced 52 sites: 24 icon
   boxes judged against the wrong grid (fixed — judge by the token in the VALUE,
   not the property name), 26 `space-3xs`, a real 2px token (exempted — a px
   inside `var()` is the token's own value), and **2 genuine** drawn-geometry
   cases, now marked `/* off-grid-ok */`.
3. `project-tokens.mjs` checks each scale against the grid it produced. Silent
   today, as it must be; forcing the step to 8 made it report exactly
   `4, 12, 20, 28`, which is the proof it fires.

`lint:css` is at 0 errors, 0 warnings on a rule twice as strict, and the
projector is idempotent. `T-the-grid-is-two-grids` has the measurements.

Still open, and now visible: **`--sherpa-grid-*` is emitted but nothing CONSUMES
it yet.** Point 2 of the original plan — `round(var(--_measured), var(--sherpa-grid-space-step))`
for genuinely dynamic sizes — is the follow-on, and belongs with item 33.


### `[ ]` Consume the tweaked Style/Transparent content aliases

The Style/Transparent content colour aliases changed in Figma. Apply the new
values across the CSS that uses them.

**The block is NOT the variables export.** Re-checked 2026-09-23 against live
Figma, and the diagnosis was wrong.

The look tiers do not come from `figma.tokens.json` at all. They come from
`src/styles/tokens/figma.extensions.json`, which
`scripts/project-tokens.mjs:820` reads — *"Values are literal hex (extension
overrides don't serialise as refs)."* That file is dated **2026-09-15**, eight
days stale, and no script writes it.

**Measured drift, cache vs live: 11 values.** Exactly the ones this item names:

| variable | mode | cache | live |
|---|---|---|---|
| `style-content/base` | default | `#35353d` | `#0c0b11` |
| `style-content/base` | critical | `#701100` | `#b72200` |
| `style-content/base` | warning | `#a27500` | `#0c0b11` |
| `style-content/base` | active | `#8300b6` | `#240036` |
| `style-content/tertiary` | warning | `#35353d` | `#b3b3c3` |
| `style-indicator/accent` | info · critical · warning · urgent · success · active | all darker | all the mid ramp |

**Why it cannot be read back through the plugin API.** A look collection's
`variableIds` point at the STYLE collection's variables — their `valuesByMode`
is keyed by Style's mode ids (`18:2`, `951:27`…), not the look's own
(`951:90`…). Reading them live returns the BASE value, which is why
`Transparent` and `Saturated` come back identical when they are not: the cache
has `#ffffff00` for a transparent surface and `#3b4ccd` for a saturated one.

So the override lives at the collection's mode ids and the variable does not
carry it. Regenerating the cache needs whatever produced it — a Figma plugin
export, not `figma_export_tokens` and not `getVariableByIdAsync`.

Order of work:
1. **Find or rebuild the extension-cache exporter.** It is the blocker, and
   nothing in `scripts/` writes `figma.extensions.json`.
2. Regenerate the cache, then `node scripts/project-tokens.mjs`.
3. The 11 values above land in `[data-look="transparent"]` in `tokens.css`
   automatically — no component CSS needs touching, because the look block
   re-points `--_status-*` and the components already read those.
