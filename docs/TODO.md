# TODO

The list of open work. One file. Add to it, tick items off, do not start a second one.

Status: `[ ]` open · `[~]` in progress · `[x]` done

---

## The order to do them in

37 items. Ordered so that nothing is built twice.

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
| 1 | Area vs View | Views, Save, Favourite, breadcrumbs and filter scope ALL sit on this. Every later item reads differently if the model is wrong. |
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
| 11b | Grouping — two files, and 160 unused lines |
| 11c | Shared constants — sweep for anything a second component must agree on |
| 11d | `data-type` means nine things; `data-empty` means three |
| 11e | Event detail shapes disagree across 75 events |
| 11f | 3 toggle chips: owner or reporter? |
| 11g | `sherpa-nav-section` is a component nothing uses |

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
| 16 | Favourite and Save apply to the Area, not the View |
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

Item 29 dead last. It is a rename across the whole repo, so it is cheapest when
no other work is in flight.

### If you only do three things

1. **Area vs View** (item 1). Everything else bends around it.
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

### `[ ]` A filter PANEL, as an alternative to the toolbars

A panel in the content area, toggled from the options button (the sliders icon).

- 3 columns wide, on the left. It fills all rows.
- Sections for the View filter and for every component-level filter.
- At tablet and phone widths, filtering goes back to the toolbars.
- The user can put it back to toolbars.

Not designed yet. Do this one by trying things.

---

## Views

### `[ ]` A nav item goes to an AREA, not a View

The nav has been calling its items `Views`. They are `Areas`. A `View` is what
the View chip in the App Header selects.

- A View is a preset, or one the user saved.
- A View has its own layout and its own content.
- A View can have its own Data Sources and Stores.
- Views under one Area DO NOT have to share data.

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

### `[ ]` Favourite and Save apply to the Area, not the View

Favouriting or saving a View applies to every View in that Area. It must apply
only to the one View.

---

## Navigation

### `[ ]` At the mobile breakpoint the nav becomes a menu

At mobile width the left nav rail is GONE. A menu takes its place.

**The trigger.** A menu button in the App Header, to the RIGHT of the Area title.

**The rail.** Hidden. The padding it puts on the App Header and on the content
area goes to `0`. No empty gutter left behind.

**The menu.**

- It fills the WHOLE viewport when open.
- No `Pin` option. Pinning means nothing here.
- `Settings` is a menu item, at the BOTTOM of the list.
- The footer holds a `Cancel` button. It closes the menu and redirects nowhere.

**Pressing a nav item that targets an Area** closes the menu AND performs the
redirect.

**Put the nav on the data layer while you are here.** The rail and this menu are
TWO renderings of ONE nav model. Do not let each draw itself its own way.

Checked 2026-09-23: `sherpa-nav` has `renderData()` (line 131), so
`populate(config)` works — but it never calls `bind()`. It is a one-shot draw,
not a live binding. `sherpa-nav-item` touches the data layer not at all.

Bind the nav to a Store and both renderings follow one source. A change to the
Areas then reaches the rail and the menu together.

### `[ ]` Breadcrumbs are for workflow, not for the nav

Breadcrumbs must not show movement between Areas — the nav does that.
Breadcrumbs are for a workflow redirect or a drilldown, e.g. a link in a grid
cell opens a details View.

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

---

## Architecture — component boundaries

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

### `[ ]` Grouping — two files, and 160 unused lines

`src/core/sherpa-grouping.css` (173 lines, hand-written) and
`src/core/sherpa-group-positions.css` (231 lines, generated) both exist, and the
generated blocks are ALSO written into `tokens.css`. Measured 2026-09-23.

**The two files are not duplicates.** They are two doors onto one idea:

| | what | sites |
|---|---|---|
| `data-group="start"` | the position STATED — works from a template or a JS property | **15** |
| `.sherpa-group` on a wrapper | the position DERIVED, so a re-order needs nothing | **8** |

`T-grouping-is-an-attribute-and-a-class` explains why the generated blocks are
emitted twice: a bare `[data-group]` rule in `tokens.css` cannot reach a shadow
root, and the same rule in an adopted sheet cannot reach the page. Removing
either copy silently un-joins one of the two. That part is sound.

**What is NOT sound is the size.** The generator emits all 21 positions from the
Figma Grouping matrix. Only four are used:

| position | real callers |
|---|---:|
| `start` · `end` | 6 each |
| `mid` | 3 |
| `solo` | 0 — generated only |
| the 16 `grid-*` and `vertical-*` | **0** |

So **160 of 200 generated lines are dead**, in two copies — ~320 lines adopted
into every one of 59 shadow roots for nothing.

Also note `sherpa-grouping.css` is not only grouping: it carries
`.sherpa-border-edges` and `.sherpa-border-corners`, which **21 components** use
and which replaced 26 hand-written copies. That half earns its place.

Three questions to answer, in order:

1. **Does Figma still need 21 positions?** The `grid-*` set exists for the
   `.sherpa-group-grid` CSS, which computes position from `sibling-index()` and
   needs no attribute at all. If nothing will ever state a grid position in
   markup, the generator should stop emitting those 12.
2. **Should the file split by JOB rather than by origin?** `border-edges` and
   `border-corners` are not grouping; they are the per-edge primitives grouping
   happens to use. A `sherpa-borders.css` would say so.
3. **Is `solo` worth keeping?** It is the default state with no rule needed.

Do not delete a door. Both are used, in nearly the same five components, and the
trap records what breaks if either copy goes.

### `[ ]` Shared constants — sweep for the rest

`src/core/ui/shared-constants.ts` holds two values today: `ORGANISE_ICONS` and
`NON_VALUE_ROWS`. It was renamed from `icons.ts` during the audit because three
of its four importers wanted the CSS selector, not the icons.

Sweep for anything else a SECOND component must agree on and fold it in. A value
two components each declare is a value that can drift — that is the whole reason
the file exists.

### `[ ]` `data-type` means nine things; `data-empty` means three

`data-type` selects: which control element, how many thumbs, pill vs rectangle,
square vs labelled, a look, a template variant, a scope, a cardinality, a role.

`data-empty` means: a message string (list), a host boolean (grid), a per-pane
boolean (transfer-list).

Neither is a bug — both are rulings. The question for `data-type` is whether it
should be reserved for TEMPLATE SELECTION, which is what four of its nine uses
already do.

### `[ ]` Event detail shapes disagree across 75 events

Two events carry the same name and a different shape:

| event | one component | the other |
|---|---|---|
| `sort-change` | `{field, direction}` (grid) | `{direction}` (grid-cell) |
| `group-toggle` | `{collapsed}` | `{expanded}` — **inverted sense** |
| `quick-filter-change` | three shapes under one name, and the HTML documents a fourth |

The grid and grid-cell pair was reconciled (commit `379e5fd2`). The sweep across
all 75 has not run.

### `[ ]` 3 toggle chips: owner or reporter?

The audit's "15 unguarded `data-current` writes" measured down to **3**. A chip
WITH a menu returns before the self-flip line, so only the three menu-less
toggle chips — `Open tickets`, `At risk`, `Unassigned` — can write their own
state. A real mouse click produces exactly ONE write, so the two owners do not
conflict today.

Still two owners on paper. Decide per site whether the toolbar owns the chip or
reports it. `check-ownership.mjs` now tells `this` from a child, so the gate
will not mislead you — `T-writing-a-child-is-not-owning-yourself`.

### `[ ]` `sherpa-nav-section` is a component nothing uses

`sherpa-nav` draws the same label-plus-rule itself. Measured: **zero**
references. Either compose it or fold it — the same question as item 28
(`sherpa-grid-cell`), so answer both in that sweep.

---

## Tokens

### `[ ]` Consume the tweaked Style/Transparent content aliases

The Style/Transparent content colour aliases changed in Figma. Apply the new
values across the CSS that uses them.

**Blocked.** `src/styles/tokens/figma.tokens.json` is stale — it does not hold
the tweak. Checked 2026-09-23: re-running `node scripts/project-tokens.mjs`
rewrote `tokens.css` byte-identical, so nothing has arrived.

Order of work:
1. Export the variables from Figma to `src/styles/tokens/figma.tokens.json`.
2. `node scripts/project-tokens.mjs`.
3. Apply the new `--_status-text` / `--_status-text-on-color` / `--_status-icon`
   values under `[data-look="transparent"]` across the component CSS that uses
   them.
