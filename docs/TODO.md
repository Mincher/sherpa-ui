# TODO

The list of open work. One file. Add to it, tick items off, do not start a second one.

Status: `[ ]` open · `[~]` in progress. A DONE item leaves the body and gets one
line under **Done**, at the bottom — git and `docs/TRAPS.md` keep the detail.

**A bug is queued like any other item.** Will, 2026-09-26: bugs do not demand
immediate attention. Add it here, in its place in the order, and carry on.

---

## At a glance

**64 open.** Reassessed 2026-09-29, after the Query (73), the provider (85)
and the page definition (92) were built: what is left of the foundation first
— the audit, the rename, the one builder — then the bugs, then the filter
features, which now stand on it. Numbers are ids, not order; the table IS the
order.

| Pri | # | Item | Kind |
|---:|---:|---|---|
| | | **B — The foundation: what is left** | |
| 1 | 86 | AUDIT — every component's functions and events: one request, one response, standardised in `SherpaElement` | explore |
| 2a | 103 | Rows with no key get one from the data layer — Sherpa's own, never sent out | foundation |
| 3 | 38 | One model, one builder, one owner — what is left | refactor |
| 4 | 74 | EXPLORE — the Query builds every group, sort and filter menu; a menu shows its sub-query | explore |
| 5 | 37 | Components are AGNOSTIC of the data and of the example app | refactor |
| | | **C — Contained bugs** | |
| 6 | 104 | A number filter never applies what is typed or dragged | bug |
| 7 | 45 | A picked date does not show in the chip | bug |
| 8 | 82 | A number chip set by a View shows no value on its face | bug |
| 9 | 83 | Calendar menu: a picked date leaves Apply and Discard looking off — yet they work | bug |
| 10 | 94 | A number (and range) filter menu needs Apply and Cancel buttons | bug |
| 11 | 43 | The toolbar ⋯ overflow menu shows nothing | bug |
| 12 | 16 | Favourite and Save apply to the Context, not the View | bug |
| 13 | 54 | A one-value filter's row in the Filters menu: its tick means On | bug |
| 14 | 95 | Firefox: a remote chip holding a draft is not marked pending | bug |
| 15 | 96 | A grid with few columns leaves an empty band on the right of its card | bug |
| 16 | 64 | A collapsed accordion section fills with the down (+2) surface | quick |
| 16a | 100 | The Assistant panel shows no heading | quick |
| 16b | 106 | A click between a menu's items reaches what is behind it — an accordion toggles | bug |
| | | **D — Filters: Will's features, on the foundation** | |
| 17 | 99 | EXPLORE — a FILTERSET: filters in serial, in parallel, or both; and a group of chips | explore |
| 18 | 89 | Every filter added to the panel starts SIMPLE: chips, one chip with a menu, or a number input or range | feature |
| 18a | 102 | Simple AND Advanced answers are both kept, so a filter switches mode at any time | foundation |
| 19 | 90 | Any filter switches to ADVANCED: condition rows, with options per field type | feature |
| 20 | 21d | EXPLORE — conditions for a DATE field | explore |
| 21 | 98 | One action row per panel filter — Reset, Apply, Discard; Apply all and Discard all in a footer; the actions column goes | feature |
| 21a | 105 | "Save filters" saves EVERY scope under one name; a "Saved" chip shows it, warns when edited, and undoes it | feature |
| 22 | 97 | A filter panel section shows an icon for WHAT it filters: View, Chart, Grid, Form, List | quick |
| 23 | 60 | Once applied, a chip's badge shows the number of results | feature |
| 24 | 49 | A preset Advanced chip shows its conditions, read-only | feature |
| 25 | 50 | A reader's saved Advanced chip shows its conditions, editable | feature |
| 26 | 48 | A child menu opens on hover or click of its row | feature |
| 27 | 21c | A condition's matches must ALL highlight | feature |
| 28 | 21f | "Send to view filters" | feature |
| 29 | 21b | Which header chips carry over between views | feature |
| 30 | 20b | The Date filter should be a view-scope date RANGE | feature |
| 31 | 52 | EXPLORE — a data viz scope in the filter panel | explore |
| | | **E — Views and navigation** | |
| 32 | 15 | Save a View, and the Save split-button menu | feature |
| 33 | 17b | At the mobile breakpoint the nav becomes a menu | feature |
| 34 | 34 | Figma: use the Navigation terms | figma |
| 35 | 79 | Nav header: Settings and Pin are one Button group in an Actions slot | component |
| | | **F — Data states and charts** | |
| 36 | 58 | Loading, empty and error states in a container | feature |
| 37 | 9b | A Data Viz header, for metrics and chart containers | component |
| 38 | 80 | Container and Data Viz headers: Figma's new button styling and grouping | component |
| 39 | 14 | An example of real-time data | feature |
| 40 | 59 | EXPLORE, later — Will's own loading pattern | explore |
| | | **G — Overlay panels** | |
| 41 | 22 | The `Ask N-zo` panel — wider, and resizable | feature |
| 42 | 23 | A focused grid row opens a details panel | feature |
| | | **H — The accessibility gate** | |
| 43 | 24 | Playwright tests accessibility — WCAG 2.1 AA | gate |
| | | **I — The big builds** | |
| 44 | 67 | A UTILITY layer: `sherpa-router`, on the Navigation API | feature |
| 45 | 68 | `sherpa-templater`: templates fetched and swapped live, out of `SherpaElement` | refactor |
| 46 | 27 | A consumer can supply their OWN templates and CSS | feature |
| 47 | 25 | `sherpa-layout-canvas` + minimap | component |
| 48 | 26 | A `Grouped` mode for the content area, and plain grid templates? | feature |
| | | **J — Tidy-ups and renames** | |
| 49 | 11 | `sherpa-group`: what is left | tidy |
| 50 | 28 | A Figma component is NOT always a web component | tidy |
| 51 | 30 | Do we still need `icon-paths.ts` and `render-icon.ts`? | tidy |
| 52 | 33 | Density as step offsets, and a breakpoint step | tokens |
| 53 | 36 | CSS: compiled where it should inherit? | tidy |
| 54 | 11d | `data-type` means nine things; `data-empty` means three | tidy |
| 55 | 84 | Use the platform: Intl for money, units and deltas; Temporal in the calendar | refactor |
| 56 | 81 | Component contracts move from YAML to JSON | refactor |
| 57 | 29 | Rename `src/index.ts` to `src/app.ts` — dead last | rename |
| | | **K — Agentic UI: much later** | |
| 58 | 76 | WebMCP: agents do UI tasks through Sherpa's own contracts — a core system | explore |
| 59 | 77 | CONTRACTED UX patterns, so a generated experience is consistent and useful | explore |
| 60 | 78 | A node-based WORKFLOW creator: make, edit and view patterns and generated workflows | explore |

**Why this order** (reassessed 2026-09-29).

- **B — what is left of the foundation.** 86 first: an ASSESSMENT for Will to
  rule on, so it costs no code while he reads it. 75 (done) came before any
  filter feature, so 89, 90, 98 and 99 are built in the new words. 38's one builder
  is built WITH 89 (see D).
- **C — Contained bugs.** Each is fixable in its own component or page. In
  pairs where one fix serves both: 104 first (nothing a number menu does
  reaches the source), then 45 and 82 (a chip's face after a silent
  set), 83 and 94 (a menu's footer).
- **D — Filters.** The panel is rebuilt ONCE: 99 designs how filters group
  first, then 89 (Simple, with 38 step 4's one builder), 102 (both modes'
  answers kept), 90 (Advanced) and 21d (its date half), then 98 (the action
  row, on 90). Then 60; 49 before
  50; 20b before any date condition ships.
- **E — Views and navigation.** 15's save is built (`provider.saveView`); what
  is left is Records' dialog and the split button.
- **F** uses the remote flag to show its states. **H** comes after the markup
  settles, before new components, so they must pass it. **I**: 68 and 27 are
  one door; 67 takes over the router's `open()`. **J**: 29 dead last — it
  touches every import.

---

## B — The foundation: what is left

### `[~]` 86 — AUDIT: every component's functions and events — one request, one response, standardised in `SherpaElement`

**Assessed and decided 2026-09-29 — `docs/COMPONENT-API-AUDIT.md`.** About
1,300 copied lines in six families; seven build steps (A1–A7), one commit
each. Will's rulings are its §6: chip and tag stay two components; `-select`
means picked one; meters take a number; sort and group keep their scope (with
99); two shared chart sheets.

Will, 2026-09-27: *"Once the provider approach is completed, it might be a
good idea to take a look at all of the functions and events for all UI
components to see where there is logical duplication but name, or
implementation, divergence. If it can make generic requests, expects generic
responses, and can be standardised in sherpa-element (communicating with
sherpa-provider etc.) then we should make those optimisations. Take care to
not only add code but rewrite, or refactor, existing code. We can also remove
redundant code, too. Do the assessment first, for review, before executing
these changes."*

After P5. Assessment FIRST, for Will's review; nothing is changed before he
rules. `PROVIDER-DESIGN.md` §9 is its first pass (the filter family, the
base class, the wrapped controls, the charts). Still to cover: every public
method and every event of all 63 components, side by side — same job,
different name or different code.

**Open from §9, and part of this:** 4 (the grid builds its filter menu by
hand, and the page sets its `data-column-values` — read both from the
source), 5 and 7 (ONE event shape, `{ readings, presets }`, which retires the
grid's `ColumnFilter`), 10 (the wrapped native control, four times), 12
(chart axes), 14 (the app-header re-exposes the bar) and 15 (leftovers). Item
8 is 68; item 11 is 84.

### `[ ]` 74 — EXPLORE: the Query builds every group, sort and filter menu; a menu shows its sub-query

Will, 2026-09-27: *"The query language, and single query object, can be used
to construct group, sort, and filter menus both in their simple list
presentation mode and the conditional mode. It also allows us to expose the
sub-query, that defines the conditions, for any filter menu."*

So a menu is DRAWN from its field's slice of the Query — its values, its
picks, its rows — in either mode, and the bar, the panel and a heading stop
building their own. And any filter menu can SHOW the sub-query behind it: the
conditions it compiles to, readable, perhaps editable. Explore with 49 and 50
(an Advanced chip shows its conditions), which are this seen from a chip.

**No query LANGUAGE — JSON.** Will, 2026-09-27: *"I don't think we should
construct a query language for it. We're probably best served using JSON. As
long as the whole situation is captured and can be recreated then we're
good."* The sub-query IS the field's slice of the Query — its `FieldReading`,
condition rows and all — shown and saved as JSON, and restored by
`setQuery`. No grammar, no parser, no second spelling of a condition.

### `[ ]` 103 — Rows with no key get one from the data layer — Sherpa's own, never sent out

Will, 2026-09-29: *"If we get grid data without keys then the data layer
should give it keys. Means selection always works with keys. Keys are only
for Sherpa's capabilities so we need to make sure we don't pollute any data
we are ever sending out of the data layer to external sources (databases
etc.)."*

Today a grid with no `key` cannot name a row: `selectedKeys` is EMPTY, and
`selection-change` sends row POSITIONS as `selected` (left open by the API
audit's A6, `docs/COMPONENT-API-AUDIT.md`).

- **The data layer gives a keyless row a key**, so selection — and anything
  else that names a row — always works by key, and `selection-change` sends
  keys.
- **The key never leaves the data layer.** Not in a store's insert or update,
  not in `export()`, not in a saved View's JSON, not in anything sent to an
  external source. A field on the row would leak through every one of those,
  so it is kept BESIDE the row (a symbol, or a map by row), never on it.
- **Settle first:** how long a made-up key lives. A key the data never had is
  stable only while the rows are, so a saved View keeps a selection only over
  a real key — say so rather than restore the wrong rows.

### `[~]` 38 — One model, one builder, one owner: what is left

Will, 2026-09-25: *"I'm juggling bugs here between the filter panel and filter
toolbar when the overlap is considerable so the code should be singular, and
reused, where possible."* The full review is `docs/FILTER-REVIEW.md`.

Will's taxonomy stands: **six KINDS** — group, sort, boolean, single, multi,
advanced. "Organise" is a label, never a kind.

**Done:** steps 1, 2, 5, 5.5 and 6; step 3 — the data layer coordinates — is
done by the provider (85): the panel asks for its scopes, every component finds
its source by asking, and `records.js` carries nothing between the panel and
the bars. A component declares the data it needs (P2). The size gate is
built (`npm run check:size`).

**Left:**

- **Step 4 — ONE field-row builder.** The panel keeps its own `#draw`,
  `#drawSection` and `#drawField`. The bar and the panel differ by the layout
  DIRECTION and whether values EXPLODE into a run — two flags (89's 16-value
  line is the second), not two implementations. Do it WITH 89, which redraws
  the panel's fields anyway, and 99, which groups them.
- **"Scope" still means three things** — query reach (`view` / a component
  scope), which rows a bind is pushed (`page` / `all`), and the app's surfaces
  (`view` / `data`). Rename them apart.
- **Left from 44c:** a heading that ALREADY held its own filter when the View
  took its field keeps applying it — one field in one scope says it should be
  suspended, as a chip is (`T-a-view-held-heading-shows-and-refuses`).

Rules for the work: MOVE code, never rewrite it; delete the replaced path in
the same commit; no helper with one caller; state the budget up front and
report the actual.

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
   know a field is called `openTickets`. Measure what still does. The grid's
   heading values are set by the PAGE (`data-column-values`, in `records.js`)
   — the source has them (86, §9 item 4).
3. **Extension, not forking** — item 27 is the mechanism.
4. **Split the example app into its own repo**, LAST. Anything it cannot do
   from outside the library is a boundary the library has not drawn. Its
   pages are JSON now (`examples/definitions/`, Will 2026-09-29), so the folder
   moves with it.

---

## C — Contained bugs

### `[ ]` 64 — A collapsed accordion section fills with the down (+2) surface

Will, 2026-09-26: a COLLAPSED `sherpa-accordion` section takes the Style
surface's DOWN step — `base +2`, `--sherpa-style-surface-base-2` — as its
background fill. (base / +1 / +2 are default / hover / down.) Bind the Style
name, never a Theme colour: a state is the mode's own step. Open sections keep
today's fill.

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

### `[ ]` 82 — BUG: a number chip set by a View shows no value on its face

Found in step 7 (2026-09-27). The At risk view gives the bar an Open tickets
chip with `> 2`: the chip holds it (its menu reads `2`, op `gt`), the rows
obey it (13), and a report keeps it — but the chip's face shows no value.
The number body's value reaches the menu without the chip's label being
re-derived for a number. Same family as 45 (a picked date showed nothing),
fixed for dates by `#syncDateLabel`.

### `[ ]` 83 — BUG: a calendar menu's picked date leaves Apply and Discard looking off

Will, 2026-09-27: selecting a date does not remove the inactive styling from
the calendar menu's Apply and Discard — yet they are still clickable and they
work. TWO faults:

- **From step 6e (23094c86).** `sherpa-menu` re-reads its draft for the footer
  on `input` and `change` only; a calendar pick fires `datetime-change` and
  `range-select`, so the footer is never told the draft changed and keeps its
  pair `disabled`. Listen for those too (`T-the-footer-owns-nothing-to-save`).
- **A disabled button still acts.** A `sherpa-button` with `disabled` looks
  inactive but a click still reaches its handler — the look and the behaviour
  disagree. The button must refuse the click while disabled, or the footer's
  "off" is only paint.

### `[ ]` 104 — BUG: a number filter never applies what is typed or dragged

Will, 2026-09-29: *"Numerical range filters aren't applied on value changes
via input fields or slider handles."*

Proved in a probe: drag a slider handle, or type in the number field, and no
`menu-change` and no `quick-filter-change` leaves the chip. The chip HOLDS the
value — `readings` shows it — but nothing tells the source.

Cause: 45b2f136 (2026-09-25) moved the number body INTO the menu's shadow root
(`T-a-menu-owns-its-own-bodies`), and `#onChange` still listens on the HOST.
The field's native `change` is not composed, so it stops at the shadow root.
The slider's composed `change` arrives retargeted to the menu, so the
`SHERPA-SLIDER` check never matches. `T-native-change-stops-at-the-host` still
describes a SLOTTED body.

The chip test "a NUMBER chip flips between a single field and a two-ended
slider" stayed green because it reads `el.readings`, which ASKS the menu. The
fix's test watches the event. The grid heading's menu and the panel use the
same body — check both. Before 94, which changes the same path.

### `[ ]` 106 — BUG: a click between a menu's items reaches what is behind it

Will, 2026-09-29: *"Clicking the space between menu items causes the
accordion behind the menu to expand or collapse. The menu needs to block this
from happening. I suspect it could allow clicking of any element behind a menu
and not just accordions."*

Likely cause, not yet proved: a click BUBBLES through the DOM, not through
what is drawn. A popover menu is drawn in the top layer, but in the DOM it is
still inside the accordion's header, so a click on the card's empty space
reaches the header. A row click is handled; a gap click is not. Check every
host that holds a menu, not only the accordion.

### `[ ]` 94 — A number (and range) filter menu needs Apply and Cancel buttons

Will, 2026-09-27: *"Numerical (and range) filter menus need apply/cancel
buttons."* A number is TYPED, so applying each keystroke filters on "1" on
the way to "150". Locally a PICK applies at once (Will's ruling on 62, "No
Apply locally"); a number body is the exception — it waits for Apply, and
Cancel puts back what was applied. The calendar's footer is the pattern, and
83 is its bug, so fix the two together.

### `[ ]` 16 — BUG: Favourite and Save apply to the Context, not the View

The ★ stars the Context (`examples/index.html` ~396, the `view-favorite`
listener), so it applies to every View in that Context. It must apply to the
one View.

### `[ ]` 54 — BUG: a one-value filter's row in the Filters menu: its tick means On

Will: a row in the Filters menu's Added section gets a child menu only when
its field has MULTIPLE values. A one-value filter (a preset, a toggle) has
nothing to drill into — today it drills into a menu of one row, `On`
(`onOffMenu()` in `src/core/ui/filters-button.ts`, `DRILL_FLAGS`,
`filtersMenuItems()`).

**Will's rule, 2026-09-26: a tick on a value means that value is ON — in
every filter.** A one-value filter's row IS its value, so its tick turns it
on; there is no caret. A filter that is OFF with its value on is the same as
an inactive chip holding a value — suspended, not cleared.

This changes what a tick means in the Added section, where it means HELD
today (untick removes). Settle, when it starts: how a one-value filter is
removed from this menu, and whether a multi-value row's tick keeps meaning
held. Update `T-the-add-menu-is-the-whole-list` and the test "a folded BOOLEAN
filter opens On".

### `[ ]` 95 — Firefox: a remote chip holding a draft is not marked pending

Found 2026-09-27 by the full Firefox run: `test/e2e/reforged-pending-chip.spec.ts:10`
fails in Firefox every time — after a tick in a remote chip's open menu, the
chip has no `data-pending`. Chromium and WebKit pass. Not the provider work:
the toolbar as committed before P3b fails the same way. Start at the menu's
`dirty` and the bar's `#queuePending` (TODO 46, `T-a-pending-chip-has-no-fill`).

### `[ ]` 96 — A grid with few columns leaves an empty band on the right of its card

Seen 2026-09-27 in the Dashboard's Capacity planning View: five columns at the
default 160px make an 800px table in a 1350px card. The grid is a FIXED table
whose width is the sum of its `<col>`s (`inline-size: 0`,
`T-col-width-not-inline-size`), so a column never grows to fill. Decide what
fills the slack — the last column, or every column in proportion — without
breaking a dragged width or the pinned edges.

### `[ ]` 100 — The Assistant panel shows no heading

Found by the API audit (86), 2026-09-29, and confirmed in the browser: the
Assistant `sherpa-overlay-panel` in `examples/index.html` sets
`data-title="Assistant"`, but the overlay panel reads only `data-heading`
(`sherpa-overlay-panel.ts`, its `observed` list). A CONTAINER takes
`data-heading` (CLAUDE.md, the tier rule). Rename the attribute in the page,
and check no other page sets `data-title` on a container that reads
`data-heading`.

---

## D — Filters: Will's features, on the foundation

### `[ ]` 99 — EXPLORE: a FILTERSET — filters in SERIAL, in PARALLEL, or both; and a group of chips

Will, 2026-09-29: *"Customers and Regions are closely related. 1 customer can
operate in many regions. A region can only contain a customers data for that
region. This isn't something that Sherpa logic needs to contend with
literally. However, it would be good to have the option to configure filters
to run in serial, parallel, or both modes."*

| mode | a filter's options |
|---|---|
| **parallel** — the default, and today | every value, whatever the other filters pick |
| **serial** | only the values the rows still have after the picks ABOVE it in the chain |
| **both** | a serial group sits beside filters that run in parallel |

*"A nice way to achieve serial groups is some sort of wrapper element like the
native HTML fieldset… Perhaps a filterset element? Actually, we can also use
this to group filters/chips together, too."*

- **`filterset`** groups filters — and chips: it can also put Group and Sort
  under "Organise".
- **`data-filter-mode="serial"`** chains the filters in it;
  **`data-filter-mode="parallel"`** runs them side by side. No filterset, or no
  attribute, is parallel, as today.
- **The example app:** Customer and Region in serial, everything else in
  parallel. Sherpa never knows that a customer has many regions — the ROWS
  answer it, through the chain.

**Design first**, for Will's review:

1. **The JSON.** A scope's sets in the page definition — for example
   `"sets": [{ "mode": "serial", "fields": ["customer", "region"] }]` — so the
   markup and the definition say one thing (`T-a-page-is-its-definition`).
2. **The data layer.** A field in a serial set takes its options from the rows
   the fields ABOVE it allow — `filterDef()` for that field, narrowed. Show an
   unavailable value dimmed below a divider
   (`T-unavailable-value-sorts-below-a-divider`), or remove it?
3. **A pick that is no longer offered.** Region = APAC, then Customer = one
   with no APAC rows: keep the pick, suspend it, or drop it? Suspend is not
   clear — never lose a reader's answer silently.
4. **Sort and group keep their scope** in the source (Will, 2026-09-29,
   ruling 4 of the API audit) — design it here, with the filterset.
5. **The bar and the panel draw a set as ONE group** — 38 step 4's one
   builder, and `.sherpa-group` for the joins. Do it before 89 redraws the
   panel, so the panel is rebuilt once.

### `[ ]` 89 — Every filter added to the panel starts SIMPLE

Will, 2026-09-27: *"Let's start all filters added to the panel in 'Simple'
mode."* Its content is one of three, by the field:

| the field has | Simple draws |
|---|---|
| 16 values or fewer | each value as its own chip — exploded |
| more than 16 values, or it is a date | ONE chip with a menu — a list, or a calendar menu for a date |
| numbers | a number input, or range slider inputs |

**16 replaces 47's 20** — one line for the bar and the panel, set once (the
builder's explode-or-menu flag, 38 step 4). 47 (more than 20 values, one chip)
is merged here. Mode words: TODO 75.

### `[ ]` 102 — Simple AND Advanced answers are both kept, so a filter switches mode at any time

Will, 2026-09-29: *"Switching to an advanced filter, in the filter toolbar
chip menu, prevents me from toggling back to a simple filter if a value has
been input. Both simple and advanced mode conditions need to be tracked and
stored to allow switching at any point. May require rework to the query
building in the data layer as well as component fixes."*

Today the menu's mode switch carries the picks INTO the condition rows
(`#seedFromPicks`, `T-a-mode-switch-carries-the-answer-over`) and nothing
keeps them going back — one answer, two views of it.

- **The reading holds BOTH answers and which mode is in force.** A
  `FieldReading` keeps its `picked` list and its condition rows side by side,
  and a `mode`. The Query compiles only the mode in force; switching changes
  the mode and loses nothing.
- **The switch is never blocked**, whatever either mode holds. Switching back
  shows Simple's own picks.

**Will, 2026-09-29, later:** *"The initial switch from simple filter to
advanced should carry over the conditions. e.g. X and Y are selected becomes
Equals X OR Equals Y. As soon as the advanced conditions deviate from the
simple conditions then that mirroring should be disabled. Users should still
be free to toggle between simple and advanced modes at any point and have
their parameters maintained."*

- **Advanced MIRRORS Simple until the reader changes it.** The first switch
  turns picks X and Y into `Equals X` OR `Equals Y` (today's
  `#seedFromPicks`). While the rows are still that mirror, a change to the
  picks re-draws them.
- **The first edit to a row ends the mirror**, for good: from then on each
  mode keeps its own answer, and switching shows it. The reading records
  whether the rows still mirror the picks.
- **Every writer and reader of a reading follows**: the menu, the bar, the
  panel, a grid heading, a saved filter and a saved View (JSON), and the
  session's kept Query. Design it with 90, which builds Advanced on it, and
  with 75's rename (the mode is `simple` / `advanced`).

### `[ ]` 90 — Any filter switches to ADVANCED: condition rows, with options per field type

Will, 2026-09-27: *"Any filter should be able to be toggled to 'Advanced',
using simple switch, to build a multi condition scenario using conditional
input rows. We'll need different conditional options for numeric, and date,
field types."*

A plain switch on every filter turns Simple into Advanced: condition input
rows, several of them. The operators follow the field's TYPE — text, number
and date each get their own list (21d is the date half). Switching back to
Simple keeps what it can show and says what it cannot, never drops a
condition silently. **The word is Advanced** — Will chose it over
*Complex*, 2026-09-27 (75).

### `[ ]` 98 — One action row per panel filter — Reset, Apply, Discard; Apply all and Discard all in a footer; the actions column goes

Will, 2026-09-29: *"If there is at least 1 advanced (conditional) filter in
the filter panel then we should show Apply and Discard buttons in the same row
as the Add condition button but on the right side. Clicking these will apply
or discard changes to that specific filter only. We should also show a footer
at the bottom of the panel to Apply All or Discard All changes. We can just
tweak the labels (and any required logic) on the panel footer that we used to
use for applying filters."*

- **Per filter:** an Advanced filter shows Apply and Discard at the RIGHT of
  its Add condition row. They apply or discard THAT filter only.
- **Whole panel:** a footer with Apply all and Discard all, shown while at
  least one Advanced filter is in the panel.
- **The footer comes back**: it was removed in `c92adec0` (step 6c, "no
  footer; a field applies as it changes"). Take its markup back from there and
  change the labels. A Simple filter still applies as it changes.
- Build on 90 (Advanced mode). The source already hears `filter-apply` and
  `filter-discard`; a per-field one must name its field.

**Update, Will 2026-09-29:** *"Let's also move the reset filter button from the
section header to the last row alongside Apply/Discard… We can keep this as an
icon only button for now. Increase its size to match the other buttons on the
row. We can also add this row, with the updated remove button, to simple
filter sections. That way we have 1 action row, per section, regardless of
simple or advanced filter mode. With this change we can also get rid of the
column that we had reserved in the filter panel for actions on the right side.
This gives us some more horizontal space for content."*

- **ONE action row per field section**, last in the section, in Simple AND
  Advanced mode. It holds the Reset button (`.field-clear`,
  `arrow-rotate-left`, icon only) and, where the field has them, Apply and
  Discard at the right. In Advanced mode it is the Add condition row.
- **Reset leaves the section header** and takes the row's button size, not
  `data-size="sm"`. The remote Apply and Discard icons (`.field-apply`,
  `.field-discard`) leave the header too.
- **The actions column goes**: the panel's reserved right-hand column
  (`.field-acts`, from `24c3a57c`) is deleted, and its width goes to the content.

### `[ ]` 105 — "Save filters" saves EVERY scope under one name; a "Saved" chip shows it

Will, 2026-09-29: *"'Save filter', in the filter panel and filter toolbar,
creates a Preset advance filter chip to reuse later. However this button should
be a 'Save filters' (plural) button that saves a definition of the current
state of the filter scopes."* … *"We have definition saving mechanisms for
Views already. Perhaps there's overlap and reusable functionality here."*

Today "Save filter" packs ONE scope's fields into one preset Advanced chip
(`filter-save`, `packFilter`; `T-save-packs-the-fields-into-one-chip`,
`T-a-saved-filter-is-its-readings`).

| | Will's rule |
|---|---|
| **Save filters** | Saves ONE definition: the state of ALL scopes, under the name the reader gives. One button, in the panel HEADER (its toolbar actions menu) — no Save per scope |
| **Save as** | A grouped menu button right of Save, as for Views |
| View labels | `Save view` and `Save view as` (see 15) |
| Filters menu | The section is `Saved filters`, not `Custom filters` (`CUSTOM_SECTION`, `T-saved-filters-are-the-custom-section`) |
| The chip | The applied definition is an ACTIVE chip in the panel header. Field label `Saved`, value its name |
| Edited after applying | The chip turns WARNING and its value gets ` *`. Save again, or Save as, clears both until the next edit |
| Overwrite | A dialog asks to confirm |
| Dismiss | The chip's right button DISMISSES — it is not a menu. Dismiss takes the definition off the scopes and puts them back as they were BEFORE it was applied |

Build with 15: one Save split button, one name dialog, one overwrite confirm,
and one store shape — a saved filter set is the filter half of a View
definition (JSON, `T-a-page-is-its-definition`). Dismiss needs the Query as it
was at apply time; the provider already keeps it under `/filters/<id>`.

Settle when it starts:
- Will wrote "all contexts". Read as all filter SCOPES (the panel's sections),
  not nav Contexts — confirm.
- What becomes of the saved preset chips already stored: read them as
  one-scope definitions, or drop them.
- Still kept per DATA (`T-a-saved-filter-lives-with-its-data`)?

### `[ ]` 97 — A filter panel section shows an icon for WHAT it filters

Will, 2026-09-29: *"The accordion header for filter panel sections should have
an icon before the heading label, and after caret, that indicates the type of
content being filtered."*

| section filters | icon |
|---|---|
| the View | `monitor` |
| a chart | a chart icon |
| a data grid | a grid or table icon |
| a form | `file-lines` |
| a list | `list` |

The order in the header is caret, icon, label. `monitor`, `file-lines` and
`list` are in `src/core/ui/icon-paths.ts`. **No chart icon and no table icon are
there** (only `table-columns`), so get them from Figma first. The KIND comes
from the component that the scope's fields belong to, so the source must
report it with each scope (`describe(scope)`). The panel must not find it by
tag name.

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

### `[ ]` 49 — A preset Advanced chip shows its conditions, read-only

A PRESET Advanced chip (a saved filter the app ships) gets the `fx` button
in the Success look. It opens a menu of its condition rows, read-only. It sits
on the chip in the toolbar, in the section header in the panel, and on a column
heading — only those three. Everywhere else a filter changes mode with the
Advanced switch (done 2026-09-26).

**Later, with 50:** Success is the look of a WORKING condition. Warning and
critical are free for a condition that cannot apply, or a filter that failed
to — Will's note, not asked for yet.

### `[ ]` 50 — A reader's saved Advanced chip shows its conditions, editable

The same `fx` button, with rows that can be edited. On a filter the reader SAVED
that is applied, an edit is a temporary DRAFT; the saved filter does not
change. When the draft differs, the menu and the panel section header offer
Save. Needs 49, and 46's pending look for the draft.

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
or SURVIVE it. The View chip is neither; it IS the thing that changed. **The
default is built** (56, 2026-09-26): `onViewPicked` resets the reporting bar
before a view applies (`T-a-view-change-resets-the-header-chips`). What is
left is the flag: `clearAll()` skips a chip that SURVIVES, and its part stays
applied through `setState`, which clears every part today.

### `[ ]` 20b — The Date filter should be a view-scope date RANGE

Will, 2026-09-23: a top-level date range that slices the records across the
whole view. It is at view scope now — "Date", over `source.timeField`
(cae7e964) — but still `kind: 'date'`, single by default with a Range switch,
over a list of `availableDates` — the days the records carry (`declareFromRows`).

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

A legend toggle IS a filter (42, done: `only` narrows one component), so a chart could have its own component
scope in the panel. It may want chips for its AXES or its AGGREGATION, the way
the grid has Group and Sort. Larger; design first. After 42, and after 38
step 3, which puts scopes in the data layer.

---

## E — Views and navigation

### `[ ]` 15 — Save a View, and the Save split-button menu

Measured 2026-09-29: `provider.saveView(label)` saves the current View of
ANY page opened from a definition, and puts it on the View chip (D1). Only the
Dashboard calls it (`dashboard.js`, after its name dialog); Records has no
`view-save` handler and no name dialog (G3 in `PROVIDER-DESIGN.md` §10).
`viewOptions` is a flat list.

**Save** writes the current View — layout, content and its WHOLE filter
configuration — to a view definition. **Load** from the View chip's menu, in a
`Custom Views` section at the BOTTOM. **A name clash** in `Presets` or
`Custom Views` appends ` - Copy-001`.

**Labels** (Will, 2026-09-29): `Save view` and `Save view as`. Build with 105,
which needs the same split button, name dialog and overwrite confirm.

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

### `[ ]` 79 — Nav header: Settings and Pin are one Button group in an Actions slot

Will, 2026-09-27, from Figma: in the Navigation Panel's header the Settings
and Pinning buttons are now GROUPED and use the DEFAULT button style. Settings
takes the Grouping START class, Pinning the Grouping END class — Settings
first, then Pin, the reverse of the code today. Button size is unchanged. The
group is a SLOT called `Actions`, so more buttons can join it later.

Today `sherpa-nav.html` draws both as raw `<button class="hdr-btn …">`. So:
COMPOSE two `sherpa-button`s (never a re-drawn button), wrapped in
`.sherpa-group` (start/end by position), inside a `<slot name="actions">` in
the header — the default content being these two. Resync the nav's spec and
check the pixels against Figma.

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

### `[ ]` 80 — Container and Data Viz headers: Figma's new button styling and grouping

Will, 2026-09-27: *"I've also tweaked the Container Headers and Data Viz
Headers in Figma. Mainly adjusting button styling and grouping. We need to
adjust the components in the codebase."* Read both from Figma live — the
buttons' look, size and which ones are GROUPED (`.sherpa-group`, start/end by
position) — and bring `sherpa-container-header` into line. The Data Viz
header does not exist in code yet (9b), so it is BUILT from the new Figma,
not the old notes above. Same kind of change as 79 (the nav header's Actions
group): compose `sherpa-button`s, group them, keep them in a slot.

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
A drilldown like this is where a breadcrumb trail belongs — the first real one.

---

## H — The accessibility gate

### `[ ]` 24 — Playwright must test accessibility — WCAG 2.1 AA

Every component, level AA. None today; `axe-core` is not a dependency.

**The output is a REPORT, one per component**: for each failure, what is
wrong, which criterion it breaks, and HOW to correct it.

Prove the checker reaches inside a shadow root before trusting a green
result — one that reads the light DOM sees almost nothing of a Sherpa
component. Its first finding is fixed: a HOST `aria-label` named nothing
(`T-a-host-label-must-reach-its-control`). Assert names with `getByRole(…,
{ name })`, never the attribute.

---

## I — The big builds

### `[ ]` 67 — A UTILITY layer: `sherpa-router`, on the Navigation API

Will, 2026-09-26: *"We have a presentation layer and data layer that are
working great together. We need to further enhance sherpa with a utility
layer. The first candidate … will be a Sherpa Router web component for
handling navigation. It should use the Navigation API extensively."*

**Where routing lives today: the example app.** `examples/index.html` does it
by hand — `history.pushState` / `replaceState` at four sites, a `popstate`
listener, `urlFor()`, `contextFromURL()`, `hrefParam()` and `loadContext()`,
23 lines of the page touching the URL. Nothing in `src/` routes. Since
2026-09-29 `loadContext()` also OPENS each page from its definition
(`provider.open()`) — so a router is the one place that takes a URL to a
page: its definition, its View, its data.

**The router owns the URL**, one owner for one value: which Context, which
View, and whether Settings is open over them (`?context=records&view=risk&settings=profile`,
CLAUDE.md "Navigation terms"). A nav row, a breadcrumb, the View chip and
browser Back all REQUEST a navigation; the router intercepts it
(`navigation.addEventListener('navigate', e => e.intercept(…))`), updates the
URL, and reports what changed. The shell and the Context listen; none of them
touches `history`. Settings-over-a-Context stays one navigation with two
parts, so leaving Settings never reloads the Context.

To settle when it starts: the Navigation API is not in every engine the tests
run (check Chromium, Firefox and WebKit on the day), so decide the fallback —
`history` + `popstate` behind the same surface, or require it. And where a
utility lives: a component in `sherpa-ui`, or a third entry point beside
`sherpa-ui/data` — it needs a DOM, so not the DOM-free one. This is also most
of 37's step 4: an example app that routes through the library can leave it.

### `[ ]` 68 — `sherpa-templater`: templates fetched and swapped live, out of `SherpaElement`

Will, 2026-09-26: Sherpa's equivalent of hot reloading is fetching and
modifying HTML templates — *"this might be mashing 2 concerns together. So I'm
open to having a Sherpa Templater component that does this. I think we do all
of the template stuff in sherpa-element currently so it would be good to be
able to offload that and slim the base UI component down."*

**What would move out of `sherpa-element.ts` (948 lines):** `loadHtml()` and
`loadSheet()`, the `templateCache`, `#resolveTemplate`, `#stamp` /
`#restampIfVariantChanged` and `variantAttrs`, and `#adoptStyles`. What stays:
props, slots, `emit`, `$` / `$$`, the lifecycle — the part every component
needs. `T-rendered-settles-even-when-the-markup-does-not` and
`T-template-id-read-once-was-permanent` move with the code.

**Hot reload** is then the templater's job: re-fetch a changed template or
sheet, and re-stamp every live instance of that component — keeping its
attributes, slotted content and state, as a variant re-stamp does today. 27
(a consumer's OWN templates and CSS) is the same door from the other side:
"use this template instead" and "this template changed" are one mechanism.
Do 27 with it.

### `[ ]` 27 — A consumer can supply their OWN templates and CSS

Someone building with Sherpa-UI must be able to give a component their own
HTML template, and their own CSS that EXTENDS the default rather than
replacing it. Make it possible, and easy.

In `src/core/ui/sherpa-element.ts`, `static css` / `static html` are plain
`URL`s a subclass can re-point, and the template cache is keyed by `href`. Half
the door is open. Missing: a "default, then mine" CSS order; an API that is not
subclass-and-redefine; and a check that a custom template still provides the
parts, slots and classes the JS and CSS expect — the `.component.yaml`
anatomy is the natural thing to check against. Do it with 68: "use my template" and "the
template changed" are one mechanism.

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

### `[ ]` 84 — Use the platform: Intl for money, units and deltas; Temporal in the calendar

Will, 2026-09-27: *"No need to reinvent foundational things that we already
get for free."* Measured support is in `QUERY-DESIGN.md` §4. What the repo
hand-rolls today:

| site | today | the platform |
|---|---|---|
| `sherpa-file-upload.ts` | `` `${(bytes / 1048576).toFixed(1)} MB` `` | `Intl.NumberFormat` unit `megabyte` |
| `sherpa-metric.ts` | the delta rounded with `toFixed(2)` | `Intl.NumberFormat` percent, `signDisplay` |
| `sherpa-calendar.ts` | ten `Date` sites of day maths | `Temporal` — a component only runs in a browser |

The DOM-free data layer stays off `Temporal` and `Math.sumPrecise` until Node
has them. The metric's VALUE takes `Intl` options as JSON since provider P2
(`data-format`); its delta and the upload size do not yet.

### `[ ]` 81 — Component contracts move from YAML to JSON

Will, 2026-09-27: *"We can probably accept moving the component YAML contracts
to JSON, too."* The same rule as views and queries: JSON is what other
services send and receive. Each `sherpa-<name>.component.yaml` becomes
`.component.json`, still GENERATED, still validated against
`schemas/component.v1.json` (already JSON Schema). What reads the YAML today:
`generate-component-spec`, `validate-component`, `roundtrip-component`,
`resync-figma`, `compile-def`, `code-map`, `figma-harvest-colours`,
`scripts/lib/component-ref.mjs` and `generation/data.mjs`, and the MCP
server (`server.js`, `tools/discover.js`). One sweep, with `spec:check`
proving every contract round-trips the same before and after. The
hand-maintained YAML in `scripts/figma-data/` is a separate question.

### `[ ]` 29 — Rename `src/index.ts` to `src/app.ts`

It does not hold an index: it registers every component and installs the icons
and tokens — it SCAFFOLDS a Sherpa app. Knock-on: `package.json` `main`
(`./dist/index.js`) and `exports`, the build and `dist/` name, every
`sherpa-ui` import in `examples/`, `sandbox/` and `test/`, and the MCP server if
it reads the entry by name. Keep `src/data.ts`. **Dead last** — cheapest when
nothing else is in flight.

---

## K — Agentic UI: much later

Will, 2026-09-27: *"We built an MCP to help with the Sherpa development
pipeline and it's been useful. However, I'd like to support WebMCP as part of
the sherpa framework so that we can create agentic UI components and have them
be able to use agents to perform UI tasks for the user."* Big pieces of work,
all inside the Sherpa Product System's own standards. Each is a CORE, GENERIC
system — like the data layer, or routing and template swapping — never a
feature of one app.

### `[ ]` 76 — WebMCP: agents do UI tasks through Sherpa's own contracts

Agentic UI components: a component exposes what an agent may do with it, and
an agent does it for the reader. Will's examples — *"generating data viz and
adding it to a dashboard, creating filter queries based on user request,
generating reports from data pulled back into the Sherpa data layer, and other
cool stuff that I've not even thought of yet."*

What is already there to build on: the MCP server (`mcp-server/`, its drive
tier reaches a live element by name and method), the component specs
(`*.component.yaml`, a component's callable surface), and the QUERY (step 1–6
of 73) — a filter request an agent makes is a Query, validated and compiled
like any other, never a clause it writes itself.

### `[ ]` 77 — CONTRACTED UX patterns, so a generated experience is consistent

*"We will also need well defined, contracted, UX patterns so that any
generated experiences by agents are consistent and useful."* A pattern is
data with a contract, as a component is: what it is for, which components it
composes, which states it has, what an agent may change. An agent composes
patterns; it never invents a layout. The CRUD flow, Settings pages as forms,
and the filter scopes are the first ones this repo already has in prose.

### `[ ]` 78 — A node-based WORKFLOW creator

*"A node based workflow creator that can be used to create, edit, and view the
core patterns, as well as any generated workflows in an app, so that we can
merge agentic, generative, thinking with deterministic, contracted,
experiences and outcomes."* It draws on the canvas — 25,
`sherpa-layout-canvas`, which is why Will asked for one. Nodes are patterns
and steps; edges are what flows between them; a generated workflow is shown
and edited the same way as a designed one.

## Done

One line each. The detail is in git and in the trap named.

**2026-09-29, the component API audit (86)**
- 75: the filter modes are **Simple** and **Advanced** in every file — values (75a), the opt-in key `advanced`, the menu's `data-advanced` / `data-advanced-only` and the labels (75b), then docs, TRAPS and test titles (75c). Every old word is still HEARD, so a saved View or filter keeps working — `T-a-renamed-attribute-keeps-its-old-name`
- 101: an Advanced condition row would not add in a chip's menu, and in the panel a row's condition change dropped it — the source draws every field's answer back with its ANSWERED rows only, and the menu rebuilt from that; now an answer that matches the rows the reader has answered keeps every row — `T-an-unanswered-row-survives-a-redraw`
- 61: Add customer saves with required fields empty — the dialog is a real `<form>`; the four form controls take part in it (`FormValue`), Save submits it, and the browser refuses an empty required field and points at it; nothing is filled in for the reader, and the toast says when the page's filters hide the new record — `T-a-form-value-follows-every-write`

**2026-09-29, the page definition (92)**
- 92: navigating sets up the page — the router opens each Context from `examples/definitions/<name>.json` through `provider.open()`: its source, fields, scopes, saved filters, the header's chips, each bar's Add list, the grid's configuration and the kept Query. D1 `edec11a6`, D2 `ce3aaa4f`, D3 `eeb5e37a` — `T-a-page-is-its-definition`
- A field's possible values come from the DATA: the store's schema (`oneOf`, `number()` with `min`/`max`), or else its rows (`declareFromRows`) — Will's decision — `T-the-data-says-what-a-field-may-hold`
- 85: the provider, P1–P5 — a component ASKS and the nearest provider answers; `records.js` 1163 → 326 lines, `dashboard.js` 331 → 107 — `T-a-component-asks-its-provider`, `docs/PROVIDER-DESIGN.md`
- 73: one Query, steps 1–8 — step 8 (segment and aggregate) became provider P2's declared summaries — `T-one-query-one-owner`, `docs/QUERY-DESIGN.md`
- 70: a View is ONE JSON definition, `{ label, query, ui }`, applied onto a clean slate. Its layout as JSON is 68's; saving it is 15's — `T-a-view-is-json`
- 47: more than 20 values, one chip — merged into 89, at 16

**2026-09-27, the provider (85)**
- 93: a grid-scope filter narrowed the charts and tiles too — only the View trickles down now; a summary is under the View alone — `T-only-the-view-trickles-down`
- 91: the provider owns TOOLBARS or PANEL for every page — Configure opens the panel on the Dashboard too; the app keeps the choice — `T-the-provider-owns-the-panel-mode`
- 87 and 88: a field raised to the View stays in its component scope's Filters list, its section keeps its heading and says "Filter applied at higher scope." — provider P3c, `T-a-panel-asks-for-its-scopes`

**2026-09-27, the Query — steps 1 to 6 (73)**
- Steps 1–5: one Query, held by the source, compiled on demand; bars, the open panel, the header, legends and headings are drawn from it; the session saves and restores it — 827cadd8 to b59363d4, `T-one-query-one-owner`
- Choice A: a heading filter wears its field's NORMAL chip; the `col:` and external chips are gone — 731d2bc3, c5d6e513
- Removing a chip clears its filter (it had moved to the View and kept filtering) — 731d2bc3
- 62: Apply only for a REMOTE fetch — locally every pick applies at once; `?remote` spoofs a remote store; the panel's footer is gone, a remote field has its own Apply and Discard — 7c7cdf5c, 9294cfd6, c92adec0, `T-apply-and-discard-wait-for-a-change`, `T-commit-follows-select-mode`
- 46: a pending chip wears the active edge and no fill — 6050eddf, `T-a-pending-chip-has-no-fill`
- 66: the footer owns "nothing to save" — a committing menu's Apply and Cancel wait for a change — 23094c86, `T-the-footer-owns-nothing-to-save`
- Step 7: saved Views are JSON, their defaults on the chips — Records c6166719, Dashboard 6001eb63, `T-a-view-is-json`
- A number chip filters (a Seats range showed and narrowed nothing); the Dashboard's header chips filter; the Capacity view's charts draw — c6166719, 6001eb63

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
- 40: a host's `aria-label` names its inner control — button, input, checkbox, radio, switch; 59 template sites + 18 in code were unnamed — `T-a-host-label-must-reach-its-control`
- A button with no visible label shows a tip that says its action; `data-tip` sets one, `data-no-tip` turns it off — `T-every-button-says-its-action`
- Toolbar icon actions named in Will's words: Suggest filters, Reset all filters, View as filter panel, Add to / Remove from Favorites, Save view options
- 17: no breadcrumb trail on Records or Assistant — moving between Contexts is the nav's to show
- 57: a shell panel area is exactly three grid columns wide, worked out in CSS; the shell's panel areas stay — `T-the-shell-owns-the-panel-areas`
- 65: a horizontal legend is capped at 40rem and centred; narrow, it fills — `T-a-horizontal-legend-is-three-by-two`
- 41: conditions DID filter — Owner, Name and Email, in the toolbar and the panel (Owner Contains Da: 100 → 10). What failed was the chip's FACE after a panel Apply: no value, a stale tip. A silent steer now calls the chip's `refresh()` — `T-a-silent-steer-still-redraws-its-chip`
- 63: a conditions-only field (Email) has no Conditional switch in the panel; its rows show from the start
- 69: no back button on the main header — it went back between Contexts, which is the nav's job, as with the breadcrumbs; Settings keeps its own
- 56: a view change resets the header chips the new view does not set — Region no longer stays lit over My accounts; this is 21b's default — `T-a-view-change-resets-the-header-chips`
- 21e: filters survive a reload and a trip away, for the session, on the View they were made on — each bar keeps its `answers` and replays them with `restoreAnswers()`; the combined query is never restored; a View change empties both bars' filter chips — `T-a-reload-replays-the-readers-answers`
- 55: At risk keeps its own `status ne churned` (13 rows, was 20); going back to All drops the old `col:status` chip — `T-an-empty-selection-never-wipes-a-condition`
- 44 (first half): a heading holding a condition opens its menu on the condition, not on an unticked list — `T-a-heading-menu-opens-on-what-it-holds`
- 44b: a heading holds a whole reading — a chain set from outside or typed in shows and applies whole; `clauseConditions()` turns a chained clause back into rows — `T-a-heading-holds-a-whole-reading`
- 71: the legend's Other menu draws again — an icon button had no menu slot since ad7f91be; unticking a folded category and Apply takes the bar chart 16 → 14 bars — `T-an-icon-button-still-slots-its-menu`
- 72: adding a second conditional filter keeps the first — the toolbar holds a rebuilt chip's answer until its rows fill; the panel draws a conditioned field on its rows and writes them once each menu has drawn — `T-a-conditioned-field-opens-on-its-rows`
- 44c: a heading whose field the View holds shows the View's answer — ticked, greyed, read-only (`sherpa-menu data-readonly`) — via `grid.supersedeColumns()` — `T-a-view-held-heading-shows-and-refuses`
- 42: a legend narrows ITS chart only — a part can name the one component it narrows (`contribute(key, filter, { only })`), kept out of the shared query; Records' bar chart 4 → 3 bars, the grid stays at 100 — `T-a-component-part-narrows-one-component`

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
