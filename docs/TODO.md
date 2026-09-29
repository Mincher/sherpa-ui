# TODO

The list of open work. One file. Add to it, tick items off, do not start a second one.

Status: `[ ]` open · `[~]` in progress. A DONE item leaves the body and gets one
line under **Done**, at the bottom — git and `docs/TRAPS.md` keep the detail.

**A bug is queued like any other item.** Will, 2026-09-26: bugs do not demand
immediate attention. Add it here, in its place in the order, and carry on.

---

## At a glance

**49 open.** Reassessed 2026-09-29, after the Query (73), the provider (85)
and the page definition (92) were built: what is left of the foundation first
— the audit, the rename, the one builder — then the bugs, then the filter
features, which now stand on it. Numbers are ids, not order; the table IS the
order.

**Status:** ✅ done · 🚧 in progress · ⬜ not started · ❓ waits on a ruling from Will.
A done item KEEPS its row and its section, marked ✅ — nothing is deleted.

| | Pri | # | Item | Kind |
|:-:|---:|---:|---|---|
| | | | **B — The foundation: what is left** | |
| 🚧 | 1 | 86 | AUDIT — every component's functions and events: one request, one response, standardised in `SherpaElement` | explore |
| ✅ | 1a | 102 | Simple AND Advanced answers are both kept, so a filter switches mode at any time | foundation |
| ✅ | 2a | 103 | Rows with no key get one from the data layer — Sherpa's own, never sent out | foundation |
| 🚧 | 3 | 38 | One model, one builder, one owner — what is left | refactor |
| ✅ | 4 | 74 | EXPLORE — the Query builds every group, sort and filter menu; a menu shows its sub-query | explore |
| 🚧 | 5 | 37 | Components are AGNOSTIC of the data and of the example app | refactor |
| 🚧 | 5a | 113 | EXPLORE — state first, then render, in every component; a skeleton while the first render waits | explore |
| | | | **C — Contained bugs** | |
| ❓ | 6 | 112 | An Equals row in Advanced will not open its value list | bug |
| ✅ | 7 | 45 | A picked date does not show in the chip | bug |
| ✅ | 8 | 82 | A number chip set by a View shows no value on its face | bug |
| ✅ | 9 | 83 | Calendar menu: a picked date leaves Apply and Discard looking off — yet they work | bug |
| ✅ | 10 | 94 | A number (and range) filter menu needs Apply and Cancel buttons | bug |
| ✅ | 11 | 43 | The toolbar ⋯ overflow menu shows nothing | bug |
| ✅ | 12 | 16 | Favourite and Save apply to the Context, not the View | bug |
| ❓ | 13 | 54 | A one-value filter's row in the Filters menu: its tick means On | bug |
| ✅ | 14 | 95 | Firefox: a remote chip holding a draft is not marked pending | bug |
| ❓ | 15 | 96 | A grid with few columns leaves an empty band on the right of its card | bug |
| ✅ | 16 | 64 | A collapsed accordion section fills with the down (+2) surface | quick |
| ✅ | 16a | 100 | The Assistant panel shows no heading | quick |
| ✅ | 16b | 106 | A click between a menu's items reaches what is behind it — an accordion toggles | bug |
| ✅ | 16c | 108 | A Filters menu row's scope is a DESCRIPTION under its label, with no "in" | quick |
| ✅ | 16d | 114 | About 1 time in 20, a folded Advanced-only filter's row in the Filters menu opens nothing | bug |
| | | | **D — Filters: Will's features, on the foundation** | |
| ❓ | 17 | 99 | EXPLORE — a FILTERSET: filters in serial, in parallel, or both; and a group of chips | explore |
| ⬜ | 18 | 89 | Every filter added to the panel starts SIMPLE: chips, one chip with a menu, or a number input or range | feature |
| ⬜ | 19 | 90 | Any filter switches to ADVANCED: condition rows, with options per field type | feature |
| ⬜ | 19a | 110 | In Advanced rows, AND is serial and OR is parallel: an AND row offers only what the rows before it leave | feature |
| ❓ | 20 | 21d | EXPLORE — conditions for a DATE field | explore |
| ⬜ | 21 | 98 | One action row per panel filter — Reset, Apply, Discard; Apply all and Discard all in a footer; the actions column goes | feature |
| ❓ | 21a | 105 | "Save filters" saves EVERY scope under one name; a "Saved" chip shows it, warns when edited, and undoes it | feature |
| ✅ | 21b | 109 | Reset has a label, and a menu button: "Reset to default" puts back the View's own filters | feature |
| ✅ | 22 | 97 | A filter panel section shows an icon for WHAT it filters: View, Chart, Grid, Form, List | quick |
| ❓ | 22a | 115 | Figma: a chart glyph and a table glyph for the panel's section icons | figma |
| ✅ | 23 | 60 | Once applied, a chip's badge shows the number of results | feature |
| ❓ | 24 | 49 | A preset Advanced chip shows its conditions, read-only | feature |
| ⬜ | 25 | 50 | A reader's saved Advanced chip shows its conditions, editable | feature |
| ✅ | 26 | 48 | A child menu opens on hover or click of its row | feature |
| ✅ | 27 | 21c | A condition's matches must ALL highlight | feature |
| ✅ | 28 | 21f | "Send to view filters" | feature |
| ✅ | 29 | 21b | Which header chips carry over between views | feature |
| ✅ | 30 | 20b | The Date filter should be a view-scope date RANGE | feature |
| ❓ | 31 | 52 | EXPLORE — a data viz scope in the filter panel | explore |
| ❓ | 31a | 107 | A filter can apply LIVE, debounced — an opt-in; the default stays once per act | feature |
| | | | **E — Views and navigation** | |
| ✅ | 32 | 15 | Save a View, and the Save split-button menu | feature |
| ✅ | 33 | 17b | At the mobile breakpoint the nav becomes a menu | feature |
| ⬜ | 33a | 116 | `sherpa-nav` binds to a Store: its entries as data, drawn and redrawn | refactor |
| ⬜ | 34 | 34 | Figma: use the Navigation terms | figma |
| ⬜ | 35 | 79 | Nav header: Settings and Pin are one Button group in an Actions slot | component |
| | | | **F — Data states and charts** | |
| ⬜ | 36 | 58 | Loading, empty and error states in a container | feature |
| ⬜ | 37 | 9b | A Data Viz header, for metrics and chart containers | component |
| ⬜ | 38 | 80 | Container and Data Viz headers: Figma's new button styling and grouping | component |
| ⬜ | 39 | 14 | An example of real-time data | feature |
| ⬜ | 40 | 59 | EXPLORE, later — Will's own loading pattern | explore |
| | | | **G — Overlay panels** | |
| ⬜ | 41 | 22 | The `Ask N-zo` panel — wider, and resizable | feature |
| ⬜ | 42 | 23 | A focused grid row opens a details panel | feature |
| | | | **H — The accessibility gate** | |
| ⬜ | 43 | 24 | Playwright tests accessibility — WCAG 2.1 AA | gate |
| | | | **I — The big builds** | |
| ⬜ | 44 | 67 | A UTILITY layer: `sherpa-router`, on the Navigation API | feature |
| ⬜ | 45 | 68 | `sherpa-templater`: templates fetched and swapped live, out of `SherpaElement` | refactor |
| ⬜ | 46 | 27 | A consumer can supply their OWN templates and CSS | feature |
| ⬜ | 47 | 25 | `sherpa-layout-canvas` + minimap | component |
| ⬜ | 48 | 26 | A `Grouped` mode for the content area, and plain grid templates? | feature |
| | | | **J — Tidy-ups and renames** | |
| ⬜ | 49 | 11 | `sherpa-group`: what is left | tidy |
| ⬜ | 50 | 28 | A Figma component is NOT always a web component | tidy |
| ⬜ | 51 | 30 | Do we still need `icon-paths.ts` and `render-icon.ts`? | tidy |
| ⬜ | 52 | 33 | Density as step offsets, and a breakpoint step | tokens |
| ⬜ | 53 | 36 | CSS: compiled where it should inherit? | tidy |
| ⬜ | 54 | 11d | `data-type` means nine things; `data-empty` means three | tidy |
| ⬜ | 55 | 84 | Use the platform: Intl for money, units and deltas; Temporal in the calendar | refactor |
| ⬜ | 56 | 81 | Component contracts move from YAML to JSON | refactor |
| ⬜ | 56a | 111 | A spec types every JS property as `string` — `reading`, `conditions`, `open` | tidy |
| ⬜ | 57 | 29 | Rename `src/index.ts` to `src/app.ts` — dead last | rename |
| | | | **K — Agentic UI: much later** | |
| ⬜ | 58 | 76 | WebMCP: agents do UI tasks through Sherpa's own contracts — a core system | explore |
| ⬜ | 59 | 77 | CONTRACTED UX patterns, so a generated experience is consistent and useful | explore |
| ⬜ | 60 | 78 | A node-based WORKFLOW creator: make, edit and view patterns and generated workflows | explore |
| | | | **✅ Done — newest first** | |
| ✅ | – | 104 | A number filter never applies what is typed or dragged | bug |
| ✅ | – | 75 | Filter modes are SIMPLE and ADVANCED, not Default and Conditional — every file | refactor |
| ✅ | – | 101 | ADVANCED: a condition row will not add in a chip's menu; in the panel, changing a row's condition drops the row | bug |
| ✅ | – | 61 | Add customer saves with required fields empty | bug |
| ✅ | – | 92 | Navigating SETS UP the content — its definitions, data layer, filters and state — not only swaps the template | foundation |
| ✅ | – | 85 | `sherpa-provider`: a component ASKS for data, a scope, a query, a View or a template | foundation |
| ✅ | – | 73 | EXPLORE — one compiled QUERY, built as the reader sets it up, run on Apply | explore |
| ✅ | – | 70 | EXPLORE — a view definition bundles its filters; one JSON renders the page | explore |
| ✅ | – | 47 | More than 20 values: one chip, not a run | feature |
| ✅ | – | 93 | A grid-scope filter narrows the charts and tiles too | bug |
| ✅ | – | 91 | The APP SHELL switches Filter toolbar and Filter panel modes, for any View in the content area | foundation |
| ✅ | – | 62 | Apply and Discard only for a REMOTE fetch; a debug flag spoofs one | feature |
| ✅ | – | 46 | A PENDING state: changed, not yet applied | feature |
| ✅ | – | 66 | The footer owns "nothing to save": Save and Cancel wait for a change | feature |
| ✅ | – | 39 | The panel header gets Reset all filters | quick |
| ✅ | – | 53 | A conditional chip's tip says "X conditions applied" | quick |
| ✅ | – | 40 | A switch has no accessible name | quick |
| ✅ | – | 17 | Breadcrumbs are for workflow, not for the nav | quick |
| ✅ | – | 57 | The filter panel's width is a hard-coded 400px | quick |
| ✅ | – | 65 | A horizontal legend has a max width, and is centred | quick |
| ✅ | – | 41 | A conditional filter applies for Owner only | bug |
| ✅ | – | 63 | A conditions-only field shows the Conditional switch | bug |
| ✅ | – | 69 | The main header has a back button | bug |
| ✅ | – | 56 | A view change leaves a lit chip that filters nothing | bug |
| ✅ | – | 21e | A reload keeps a filter nothing on screen shows | bug |
| ✅ | – | 55 | The At risk view's own column filter never applies | bug |
| ✅ | – | 44b | A heading holds a whole reading, so a CHAIN shows and applies | bug |
| ✅ | – | 71 | The chart legend's Other menu does not open; check it filters the chart | bug |
| ✅ | – | 72 | Adding a second conditional filter resets the first | bug |
| ✅ | – | 44c | A heading shows an answer held at VIEW scope | bug |
| ✅ | – | 42 | A legend toggle filters the whole view | bug |

**Why this order** (reassessed 2026-09-29).

- **B — what is left of the foundation.** 86 first: an ASSESSMENT for Will to
  rule on, so it costs no code while he reads it. Its last step, A7, is built
  WITH 102 (agreed 2026-09-29): the menu owns the reading, so both answers are
  kept in one place. 75 (done) came before any filter feature, so 89, 90, 98
  and 99 are built in the new words. 38's one builder is built WITH 89 (see D).
- **C — Contained bugs.** Each is fixable in its own component or page. In
  pairs where one fix serves both: 45 and 82 (a chip's face after a silent
  set), 83 and 94 (a menu's footer).
- **D — Filters.** The panel is rebuilt ONCE: 99 designs how filters group
  first, then 89 (Simple, with 38 step 4's one builder), 90 (Advanced, on
  102's two kept answers) and 21d (its date half), then 98 (the action
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

### `[x]` ✅ 74 — EXPLORE: the Query builds every group, sort and filter menu; a menu shows its sub-query

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

**✅ Explored 2026-09-29 — the answer, as built in 102 and 103:**

- **A menu is drawn from its field's slice of the Query.** That slice is a
  `FieldReading` — both answers, the mode, the mirror — and it is the menu's
  own `menu.reading` (get and set). The source draws it (`drawReading`) into
  the bar, the panel and a grid heading, and each reads its menu the same way;
  the grid's own fourth spelling (`ColumnFilter`) is gone. No host builds an
  answer out of a menu's parts any more.
- **A group and sort menu** already draws from the Query's arrangement
  (`ScopeQuery.group` / `sort`); nothing new is needed there.
- **The sub-query is shown as the reading**, in the reader's words: the rows
  a chip or a heading holds (`spellConditions`) and, for a machine, its JSON.
  Showing and editing it on a chip is 49 (read-only, a preset) and 50
  (editable, the reader's own) — feature work in D, on this.
- **Left for A7 (86):** the grid's headings built by `menuFor()`, so every menu
  is made one way as well as read one way.

### `[x]` ✅ 103 — Rows with no key get one from the data layer — Sherpa's own, never sent out

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

**✅ Done 2026-09-29:** every store keys the rows it hands out — by the row's
own key field, or by a made-up `sherpa:<load>:<n>` held in a `WeakMap` BESIDE
the row (`src/core/data/row-key.ts`), so nothing is ever written on a row and
nothing leaks into JSON, a store write or an export. `ArrayStore` carries each
key from its own row to the copy it hands out, so a key is the same on every
load; a made-up key also finds, updates and removes its row. The grid selects
by key always, and `selection-change` sends keys. A made-up key lives for one
page load: a stale one from a saved View is dropped and reported
(`stale-made-up-key`), never matched to the wrong row.
`T-a-made-up-key-never-leaves-the-data-layer`

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
- ✅ **Left from 44c — done 2026-09-29:** a heading that ALREADY held its own
  filter when the View took its field applies none of it — the Query answers a
  View-held field in the View alone (`compile`) — and the grid now marks the
  View's matches, not the heading's old ones; the heading keeps its answer for
  when the View lets go (`T-a-view-held-heading-shows-and-refuses`).

Rules for the work: MOVE code, never rewrite it; delete the replaced path in
the same commit; no helper with one caller; state the budget up front and
report the actual.

### `[~]` 113 — EXPLORE: state first, then render, in every component; a skeleton while the first render waits

Will, 2026-09-29, asking why a menu dropped a reading set before it had drawn:
*"Wouldn't it make sense for all components to load, set state and conditions
etc, then render? Isn't this covered by the web component life cycle already?"*
Asked A "state first, in every component" / B "remove the wait (templates in
the built JS)", he chose **A**, and added: *"It would also be good if we could
display skeleton loading of content in case there are any delays in the
initial, state based, content rendering."*

**Why it is needed.** The platform's hooks run at once. Sherpa adds its own wait:
`SherpaElement` fetches each component's HTML and CSS, so the first render
comes later. And many components keep their state IN their elements — a ticked
box IS the pick, a row element IS the condition — so a value written before
those elements exist is lost. One cause behind a family of traps:
`T-custom-element-upgrade`, `T-a-rebuilt-row-reads-empty-for-a-tick`, the
"a composed field fills async" rule, and `menu.reading`'s early-reading hold
(102 step 3b).

**The model.** A component keeps its state as plain DATA and draws its elements
from it. A setter stores the data and asks for a draw; the first render draws
whatever is there, so nothing set early is lost, and a read never has to wait
for the page. A composed child is handed its data the same way.

**The skeleton.** While the first render waits, the component shows a skeleton
of its content, not an empty box. Design it with 58 (loading, empty and error
states) and 59 (Will's own loading pattern), so a component and a container
say "loading" one way.

Explore first: measure which components keep state in their elements, pick the
order (the menu first — A7 already moves its answer into `menu.reading`), and
say what `SherpaElement` gives every component (a state field and one draw).

**Measured 2026-09-29** (a read-only sweep of all 63 components):

- **36 have public state; 12 of them keep it in their elements, or partly** —
  in elements: app-header, filter-panel, menu, prompt-composer,
  quick-filter-toolbar, select-group; mixed: file-upload, input-text, nav,
  nav-item, notifications, quick-filter. The other 24 keep it in attributes
  or fields and are safe.
- **Riskiest five:** the toolbar (about 9 setters that write elements before
  they exist, 10 getters that read state out of them; every restore goes
  through it), the menu (`values`, `conditions`, `setCount`, `open`), the
  panel (`readings` read chips; `setFieldReading` writes an empty `#held`),
  the chip (`values`, `valueLabel`, `column`), and select-group (`value` is
  lost before populate and on every re-render).
- **Where early writes come from:** `applyState()` sets accessors at once;
  the provider's `#configure` awaits only `whenDefined`; `persist-view.ts`
  says "deferred to `rendered`" but `applyElements` does not await it (a bug
  to fix first); the source's `#draw` calls `drawReading` directly.
- **What the base class already has:** the `rendered` promise (always
  settles; `populate()` chains on it); `static config` with `#settings` —
  accessors that STORE and redraw after render, used only by the grid, the
  nearest thing to "state first"; attribute replay. No queue for method calls.
- **Models to copy:** the grid (state in fields, `#wantedKeys`), the menu's
  `#early` reading, progress-step-tracker's `rendered.then` setter.

**Proposed order:** fix `persist-view`'s missing await; then the menu, the
toolbar, the panel and the chip — the filter family, built with A7 — then
select-group, input-text and prompt-composer. The mechanism: `static config`
widened for every component (state in `#settings`, one draw), not a family
base class.
Keep each component standing alone — Will's rule, `docs/COMPONENT-API-AUDIT.md`
§5: it extends `SherpaElement` and nothing else, no family base class.

**✅ Step 1 done 2026-09-29 — `persist-view` waits.** A saved View applied to
a component that has not drawn yet now waits for its `rendered` (and for its
tag's definition); a drawn one is applied at once, so a report is still read
straight away. `SherpaElement` gained `hasRendered`, the answer NOW beside the
`rendered` promise. `onViewPicked` reports, and calls `after`, once every
element has its state — so the provider's `view-change` comes after a View's
content is configured. Proved on `sherpa-prompt-composer`, whose value was
lost before. **Not fixed by it**, as the sweep said: the toolbar's `values`
and select-group's `value` are still lost, because they write into elements
a later step (menus stamping, `populate()`) replaces — that is the component
work below, the filter family with A7.

**✅ select-group done 2026-09-29.** Its value is DATA (`#picked`) and the
ticks are drawn from it: a value set before `populate()` waits for the
options, a reader's tick survives new options, and a read before anything
drew answers what was set. Done by hand with a private field, as the grid
does — not the `static config` widening: select-group's `populate()` takes an
ARRAY, which `config` does not merge into. Widen `config` when three
components want the same shape. `T-a-value-is-data-the-ticks-are-drawn`

**✅ prompt-composer and input-text done 2026-09-29.** The composer HOLDS a
value set before its first render and writes it in at the end of `onRender`
— the textarea owns the live text once it exists
(`T-a-value-before-the-first-render-is-held`). input-text already kept an
early value (probed); nothing to do. **Left of 113:** the filter family —
menu, toolbar, panel, chip — built with A7 and 89; and the skeleton, with 58
and 59.

### `[~]` 37 — Components are AGNOSTIC of the data, and of the example app

Will, 2026-09-25:

> All sherpa UI components should be agnostic of the data. The data layer
> should provision and inform them. They also shouldn't have any bespoke logic
> in them specific to the example views. [...] For example toggling to the
> filter panel, from the filter toolbar, should be a custom button added to the
> actions slot [...] In fact, we should probably separate the example app to
> it's own codebase and have it use the sherpa-ui framework library as a
> dependency.

1. ✅ **Find the bespoke logic — done 2026-09-29 for the mode toggles.** Both
   were built in — `data-act="configure"` in the toolbar (emitting
   `filter-configure`) and `.to-toolbars` in the panel. The provider, which
   owns the mode, now puts its own button in each bar's `actions` slot while a
   panel is on the page, and in the panel's new `actions` slot; both built-in
   buttons and `filter-configure` are gone
   (`T-the-mode-switch-is-the-pages-own`).
2. **Components take PARAMETERS, never data shapes.** A component should not
   know a field is called `openTickets`. Measure what still does.
   ✅ **The grid's heading values — done 2026-09-29.** The PAGE set them
   (`data-column-values`, in `records.js`). Now the grid's request names the
   text columns that need a whole value list (`DataAsk.values`) and the
   provider sends them with every page of rows; `records.js` does nothing.
   ✅ **Measured 2026-09-29: no component names an example field** —
   `openTickets`, `spend`, `owner` and the rest appear in `src/components`
   only as the `data-status` attribute or in comments.
3. **Extension, not forking** — item 27 is the mechanism. **Waits on 27.**
4. **Split the example app into its own repo**, LAST. Anything it cannot do
   from outside the library is a boundary the library has not drawn. Its
   pages are JSON now (`examples/definitions/`, Will 2026-09-29), so the folder
   moves with it.

---

## C — Contained bugs

### `[x]` ✅ 64 — A collapsed accordion section fills with the down (+2) surface

Will, 2026-09-26: a COLLAPSED `sherpa-accordion` section takes the Style
surface's DOWN step — `base +2`, `--sherpa-style-surface-base-2` — as its
background fill. (base / +1 / +2 are default / hover / down.) Bind the Style
name, never a Theme colour: a state is the mode's own step. Open sections keep
today's fill.

**✅ Done 2026-09-29:** `.root:not([open])` binds
`--sherpa-style-surface-base-2` (`#b3b3c3` under the accordion's default pin);
open, the root paints nothing and the card's base shows. The filter panel's
shut scopes take it too. Test in `reforged-accordion.spec.ts`.

### `[x]` ✅ 43 — BUG: the toolbar ⋯ overflow menu shows nothing

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

**✅ Done 2026-09-29:** the ⋮ opens a menu of every action folded away at this
width, in that order, and a row does what its button does; the page's own
buttons (the panel switch) are listed with the filter actions. `filter-overflow`
is gone — nothing heard it. Found on the way: on a VIEW bar the ★ · Save · ▾
group never folded (its display rule came after the fold steps).
`T-the-more-menu-holds-what-folded`

### `[x]` ✅ 45 — BUG: a picked date does not show in the chip

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

**✅ Done 2026-09-29:** a picked date already showed (`#syncDateLabel`, fixed
before 82 was written). The format is now ONE DOM-free `formatDate()` in
`src/core/data/format-date.ts`, exported from `sherpa-ui/data`: `03 Sep 2026`;
`03 to 15 Sep 2026`; `03 Sep to 15 Oct 2026`; `18 Dec 2026 to 03 Jan 2027`.
Read in UTC, day first whatever the locale. `T-a-date-reads-one-way`

### `[x]` ✅ 82 — BUG: a number chip set by a View shows no value on its face

Found in step 7 (2026-09-27). The At risk view gives the bar an Open tickets
chip with `> 2`: the chip holds it (its menu reads `2`, op `gt`), the rows
obey it (13), and a report keeps it — but the chip's face shows no value.
The number body's value reaches the menu without the chip's label being
re-derived for a number. Same family as 45 (a picked date showed nothing),
fixed for dates by `#syncDateLabel`.

**✅ Done 2026-09-29:** the chip built its face from its menu's parts, and
only for a `filter` menu — a number chip's menu is not one, so "> 2" read as
"equals nothing ticked". A number body's face now comes from `menu.reading`,
whatever the menu's type: At risk's Tickets chip reads `2`. Found on the way,
same View: the old "Status is not churned" reading also ticked "churned" as
Simple's answer — the opposite filter; an op's picks are no longer Simple's.
`T-both-answers-are-kept`

### `[x]` ✅ 83 — BUG: a calendar menu's picked date leaves Apply and Discard looking off

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

**✅ Done 2026-09-29:** the menu re-reads its draft on `datetime-change` and
`range-select` too, so a picked day turns Apply and Discard on. A disabled
`sherpa-button` refuses the click on its host — no listener, no ancestor —
as a native button does (`T-a-disabled-button-acts-on-nothing`). That showed
two more gaps, now closed: a draft set from code (`values`, `conditions`,
`mode`, typed text) did not tell the footer, and a switch between Simple and
Advanced was not a change to the draft. Eight tests pressed Apply on a menu
they never opened; they open it first, as a reader must.

### `[ ]` 112 — BUG: an Equals row in Advanced will not open its value list

Will, 2026-09-29: *"Equals conditions in advanced filters don't allow a
selection from value. Dropdown doesn't show a menu on click."*

The row's value field is a `sherpa-input-text data-type="select"` filled by
`populate()` (`#fillRow`, `T-equals-answers-with-the-fields-own-values`).

**Probed 2026-09-29 on the Records page, with a real mouse click:** the select
is visible, on top at its centre, enabled, with 9 options. It OPENS (`:open`)
in the bar's Owner menu (Chromium) and in the panel's Owner field (Chromium and
WebKit); the menu stays open and the select keeps focus. Firefox reports
`:open` false — maybe only how Firefox reports it. **❓ Waits on Will:** which
surface (bar, panel or grid heading), which browser, and the steps.

### `[x]` ✅ 114 — BUG: about 1 time in 20, a folded Advanced-only filter's row opens nothing

Found 2026-09-29 while checking a flaky test: "a FOLDED advanced-only filter
opens its own menu, not a blank drill" (`reforged-quick-filter-toolbar.spec.ts`)
fails about 1 run in 15–20, on the code before 102 as well as after. Its fixed
120 ms wait is now a poll for the menu's `open` — and in a failing run the
chip's own menu is still shut after 60 frames. So it is not slow; it never
opens.

Pressing the row opens the chip's own menu while the Filters menu closes. Two
`auto` popovers in one moment, so a guess: the Filters menu's light-dismiss or
`hidePopover()` lands after the chip's menu opened and closes it too. Check
the order in `#onMenuSelect` / the drill path, and try the same with a real
pointer.

**✅ Done 2026-09-29:** not the drill. EVERY re-fold of the bar shut the
Filters menu and built a new one, even when it folded the same chips — so a
late re-fold threw away a menu opened just before it, and the test's row
named nothing. WebKit runs the bar's last settling re-fold a frame later, so
there it failed EVERY time (60 of 60); Chromium only under load. A re-fold
that moves nothing now leaves the open menus alone. WebKit 30/30, a new test
(fails on the old bar), Chromium 856/856.
`T-a-reflow-that-moves-nothing-keeps-its-menus`

### `[x]` ✅ 108 — A Filters menu row's scope is a DESCRIPTION under its label, with no "in"

Will, 2026-09-29: *"In filter menu items we have the scope of the filter on the
right side. This should be the description label on the row below the menu
item's main label. We can also remove the 'in' prefix from this label."*

Today the source writes ``note: `in ${scopeLabel}` `` (`data-source.ts`,
`addable`), and the menu draws `data-note` at the row's right. Make it the
row's description line — the same second line a menu row with a description
already has, if one exists; check the Figma Menu set first — and drop "in".

**✅ Done 2026-09-29:** Figma's Menu List Item has it: a `description` line,
12/16, 2px under the 14/20 label. A noted row is a two-row grid now, and its
`::after` note is the second row, in the label's column. The source writes
the scope's name alone. The colour stays Style `content-secondary` — the same
`rgb(53, 53, 61)` as Figma's Theme `content/body/+1`, with no new Theme read.

### `[x]` ✅ 106 — BUG: a click between a menu's items reaches what is behind it

Will, 2026-09-29: *"Clicking the space between menu items causes the
accordion behind the menu to expand or collapse. The menu needs to block this
from happening. I suspect it could allow clicking of any element behind a menu
and not just accordions."*

Likely cause, not yet proved: a click BUBBLES through the DOM, not through
what is drawn. A popover menu is drawn in the top layer, but in the DOM it is
still inside the accordion's header, so a click on the card's empty space
reaches the header. A row click is handled; a gap click is not. Check every
host that holds a menu, not only the accordion.

**✅ Done 2026-09-29:** the cause was as guessed. The fix is in the MENU, so
it holds for every host: a click in a popover menu that lands on no control
is the menu's own — `preventDefault()` so no `<summary>` or link acts,
`stopPropagation()` so no listener behind hears it. A row is a native
control, so it still does its job. Test (real pointer, three browsers):
padding and gap clicks toggle nothing and reach no host; a row still ticks.
`T-a-gap-click-is-the-menus-own`

### `[x]` ✅ 94 — A number (and range) filter menu needs Apply and Cancel buttons

Will, 2026-09-27: *"Numerical (and range) filter menus need apply/cancel
buttons."* A number is TYPED, so applying each keystroke filters on "1" on
the way to "150". Locally a PICK applies at once (Will's ruling on 62, "No
Apply locally"); a number body is the exception — it waits for Apply, and
Cancel puts back what was applied. The calendar's footer is the pattern, and
83 is its bug, so fix the two together.

Will, 2026-09-29, after 104: *"Regarding the slider changes, and perhaps any
filter selection/value changes, we might want to debounce the event to
update."* Today a number applies on `change` — a handle let go, Enter, or
leaving the field — so one act is one update, and there is nothing to debounce.
A LIVE drag (on `input`) would need one. **Will chose once per act**, with live
as a configurable option for later — that is 107.

**✅ Done 2026-09-29:** every number menu waits for Apply — single or range,
local or remote — and Cancel puts back what was applied (`menuFor()`:
`data-commit` + `data-commit-fixed`, so the Range switch cannot turn it off; a
definition that names `commit` still wins). Built on 83's footer fix. On the
Records page: typing 172 leaves 100 rows until Apply, then 1.
`T-a-number-waits-for-apply`

### `[x]` ✅ 16 — BUG: Favourite and Save apply to the Context, not the View

The ★ stars the Context (`examples/index.html` ~396, the `view-favorite`
listener), so it applies to every View in that Context. It must apply to the
one View.

**✅ Done 2026-09-29:** the ★ stars the View on screen — a favourite's key is
`context:view`, the first View's the Context alone — and re-syncs when another
View is picked; a View favourite reads `Records › At risk` in the rail and
opens that View. Favourites stored before keep meaning the first View. Save
is 15's. `T-a-favourite-is-a-view`

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

**❓ Will, 2026-09-29 — pick one.** A menu row has no remove button today
(`sherpa-menu`'s item row is a tick and a label). If the tick means On, the
row needs another way to take the filter off.

- **A (my pick):** a one-value row — tick = On. It gets a small × at its end
  that removes it. A multi-value row keeps tick = held (untick removes), as
  its row is a FILTER, not a value. Least change; one new row part.
- **B:** every Added row — tick = On (a multi-value row is ticked while it
  holds a pick), and every row gets the ×. One meaning in the whole section;
  more change, and the multi-value tick no longer removes.

### `[x]` ✅ 95 — Firefox: a remote chip holding a draft is not marked pending

Found 2026-09-27 by the full Firefox run: `test/e2e/reforged-pending-chip.spec.ts:10`
fails in Firefox every time — after a tick in a remote chip's open menu, the
chip has no `data-pending`. Chromium and WebKit pass. Not the provider work:
the toolbar as committed before P3b fails the same way. Start at the menu's
`dirty` and the bar's `#queuePending` (TODO 46, `T-a-pending-chip-has-no-fill`).

**✅ Done 2026-09-29:** the menu took its baseline in `toggle`, which Firefox
fires AFTER the tick — so the tick became the baseline, and was no draft. The
baseline is taken in `show()` now. The test passes in all three browsers.
`T-the-baseline-is-taken-at-show`

### `[ ]` 96 — A grid with few columns leaves an empty band on the right of its card

Seen 2026-09-27 in the Dashboard's Capacity planning View: five columns at the
default 160px make an 800px table in a 1350px card. The grid is a FIXED table
whose width is the sum of its `<col>`s (`inline-size: 0`,
`T-col-width-not-inline-size`), so a column never grows to fill. Decide what
fills the slack — the last column, or every column in proportion — without
breaking a dragged width or the pinned edges.

**❓ Will, 2026-09-29 — pick one.** Both keep the table at its columns' sum
when the card is narrower, so nothing changes where it already scrolls.

- **A (my pick):** every column the reader has NOT dragged grows in
  proportion to fill the card. A dragged column and the pinned edges keep
  their width. Reads as one table; a drag re-divides the rest, as most grids
  do.
- **B:** the last unpinned column takes all the slack. Simplest; the other
  columns never move, but one column can grow very wide.

### `[x]` ✅ 100 — The Assistant panel shows no heading

Found by the API audit (86), 2026-09-29, and confirmed in the browser: the
Assistant `sherpa-overlay-panel` in `examples/index.html` sets
`data-title="Assistant"`, but the overlay panel reads only `data-heading`
(`sherpa-overlay-panel.ts`, its `observed` list). A CONTAINER takes
`data-heading` (CLAUDE.md, the tier rule). Rename the attribute in the page,
and check no other page sets `data-title` on a container that reads
`data-heading`.

**✅ Done 2026-09-29:** the page sets `data-heading="Assistant"`; no other
page or template sets `data-title`. An app test reads the heading, and fails
on the old attribute.

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

**Design, 2026-09-29 — for Will's review.** Found first: every filter is
PARALLEL today. A field offers all its values (`filterDef()`), and the rows
are the AND of every pick. `available: false` exists on an option, but
nothing sets it. So SERIAL changes what a field OFFERS, never how rows
match. 110 (an AND row offers only what the rows before it leave) is the same
chain inside one field — build both on one helper.

1. **The JSON** — a scope lists its sets; a set's order IS the chain:
   ```json
   "view": { "holds": ["customer", "region", "created"],
             "sets": [{ "id": "account", "label": "Account", "mode": "serial",
                        "fields": ["customer", "region"] }] }
   ```
   `mode` defaults to `parallel` — a set that only GROUPS chips. A set's
   fields must be ones the scope holds; `openSource` reports one that is not.
   Organise is a set too, in a component's scope:
   `{ "label": "Organise", "organise": ["group", "sort"] }`.
2. **The data layer** — `source.optionsFor(field)`: a field in a serial set
   offers the values of the rows that the picks of the fields ABOVE it allow
   (only those — a parallel filter outside the set does not narrow it). One
   helper narrows rows by a list of readings; 110 reuses it for AND rows.
   The source redraws a field's options when a field above it changes. Local
   stores answer from their rows; a remote store needs one new call —
   distinct values of a field under a filter — added to
   `docs/DATA-SOURCE-RULES.md`. Narrowed-out values are REMOVED, not dimmed:
   serial exists to offer less, and the way back out is the field above.
3. **A pick no longer offered** — see ❓ below.
4. **Sort and group keep their scope** — the source keeps an arrangement PER
   scope, not one; a panel's `sort-change` reaches its own component
   (ruling 4). Built with 38's scope rename.
5. **Drawing** — see ❓ below. Either way the bar and the panel stamp a set
   from the JSON; nobody writes one by hand, so the definition stays the one
   list (`T-a-page-is-its-definition`).

**Build order:** 1 the JSON and `openSource` checks; 2 the narrowing, with
headless tests; 3 sort and group per scope; 4 the drawing, with 38 step 4 and
before 89; 5 the example app — Customer then Region, serial; 6 110 on the
same helper.

**❓ Will — two choices.**

- **Q3, a pick the chain no longer offers** (Region = APAC, then a Customer
  with no APAC rows):
  - **A (my pick): keep it, ticked and listed** — the DO NOT DROP rule
    (`T-unavailable-value-sorts-below-a-divider`). The rows may go to zero;
    the reader sees why, and unticks it. Nothing lost.
  - **B: drop it, and say so** — a toast "Region APAC removed — no rows for
    this Customer", with Undo.
- **Q5, how a set is drawn:**
  - **A (my pick): a `sherpa-filterset` component**, like `<fieldset>` —
    your idea. Stamped by the bar and the panel from the JSON: a label, its
    chips joined as one group, and a small chain mark when serial. One
    component, so the bar and the panel cannot draw a set two ways.
  - **B: no new component** — a `.sherpa-group` wrapper with a label, drawn
    by each of the bar and the panel.

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

### `[x]` ✅ 102 — Simple AND Advanced answers are both kept, so a filter switches mode at any time

**Progress, 2026-09-29.** ✅ Step 1: a reading keeps both answers, and `mode`
says which filters (a696700e). ✅ Step 2: `menu.reading`, and Advanced mirrors
Simple until a row is edited (c3b280b2). ✅ Step 3a: the bar and the chip read
and write through `menu.reading` — Will's "can't switch back" bug is fixed, on
the Records page too (22fbcb41). ✅ Step 3b: the panel — its chips are
Simple's answer, its menu's rows Advanced's; its switch carries the chips over
and they mirror until edited; a redraw keeps the reader's mode (75d23450). ✅
Step 3c: the grid heading holds the menu's whole reading — `ColumnFilter` is
gone — and a redraw is held as it is, not through a clause. **Left:** the rest
of A7 (one event per act, the headings on `menuFor()`, the 18 members go),
which is 86's.

**✅ Done 2026-09-29:** a filter keeps its Simple picks AND its Advanced rows,
and `mode` says which filters; the first switch to Advanced copies the picks
(X and Y become Equals X OR Equals Y) and keeps copying until a row is edited;
the switch works both ways in the bar, the panel and a grid heading, and a
redraw keeps the reader's mode. A saved View and the session's kept Query carry
both answers (`READING_KEYS`); a saved FILTER still saves the answer in force —
105 reworks saving. `T-both-answers-are-kept`

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

### `[ ]` 110 — In Advanced rows, AND is serial and OR is parallel

Will, 2026-09-29: *"Advanced filter conditions: AND is serial. OR is
parallel. So AND row options should be restricted by preceding conditional row
conditions."*

A row joined by AND narrows what the rows before it left, so its value list
offers only the values still present under them — the SERIAL idea of 99's
filterset, inside one field's rows. A row joined by OR starts again: every
value. AND binds tighter than OR (`T-many-conditions-are-one-reading`), so an
AND row looks back only as far as the last OR.

The data layer has the tool: `present` is the values a row still carries under
the other filters. Build with 90 (options per field type) and 99 (serial /
parallel for whole filters), so "serial" means one thing in both.

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

**✅ Step 1 done 2026-09-29:** the Filters menu's section is `Saved filters`
(`SAVED_SECTION`). The rest is built with 15 and waits on the choices below.

**❓ Will — two choices** (and I read "all contexts" as all filter SCOPES —
the panel's sections; say if you meant nav Contexts).

- **The saved preset chips already stored:**
  - **A (my pick): read each as a one-scope definition** — nothing a reader
    saved is lost; it applies to its one scope.
  - **B: drop them.**
- **Where a saved filter set is kept:**
  - **A (my pick): per PAGE, beside its Views** — it saves every scope, and
    the scopes are the page's, so it is the filter half of a View
    definition, stored the same way.
  - **B: per DATA, as saved filters are today**
    (`T-a-saved-filter-lives-with-its-data`) — every page over the same data
    sees it, but a scope another page lacks is dropped on apply.

### `[x]` ✅ 109 — Reset has a label, and a menu button: "Reset to default" puts back the View's own filters

Will, 2026-09-29: *"The reset button in the filter panel and toolbar should
have a label. It should also be in a button group with a secondary menu
button. This menu button shows a 'Reset to default' option that restores to
the Views initial defined filtering state. The current reset button just
resets all added filters to their default state like it does currently."*

| control | does |
|---|---|
| **Reset** (now with its label) | what it does today — every added filter back to its own default |
| its menu button → **Reset to default** | the scopes go back to the View's DEFINED state: its definition's `ui` and `readings`, or a saved View's Query as it was saved |

The same split button as Save view (15) and Save filters (105) — build the
three together. A default is not an empty value
(`T-a-default-is-not-an-empty-value`); the provider already holds the View's
own Query (`provider.open`, `T-a-page-is-its-definition`). Settle: whether
Reset to default also removes filters the reader ADDED since.

**✅ Done 2026-09-29.** Reset reads "Reset", joined with a ▾ in one
`.sherpa-group` (as Save and its ▾), in the bar and the panel header; the ▾'s
menu has "Reset to default", and folded, the ⋮ lists both. It sends
`view-reset`; `provider.resetView()` puts back the page's first Query (kept
at `open()`), then the View's own, as a pick does. **Settled by your words**
("the View's initial defined filtering state"): a filter the reader added
since goes. On Records: At risk 13 rows → Reset 100 → Reset to default 13,
the same Query, the added filter gone. 15 and 105 reuse the group.
`T-reset-to-default-is-the-views-own`

### `[x]` ✅ 97 — A filter panel section shows an icon for WHAT it filters

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

**✅ Done 2026-09-29.** `sherpa-accordion` takes `data-icon` (an icon before
its title); in the panel the order is caret, icon, label. A component says
what it shows in `asks.shows` (the grid `grid`, the four charts `chart`); the
provider passes it to `source.bind()`, and `describe(scope)` reports `shows`
(`view` for the View). On Records: View filters `monitor`, Customer records
`table-columns`. **Figma has no chart glyph and no table glyph** (searched the
whole file) — so a chart's section shows none, and `table-columns` stands in:
that is 115. `T-a-scope-says-what-it-shows`

### `[ ]` 115 — Figma: a chart glyph and a table glyph for the panel's section icons

Found building 97, 2026-09-29: Figma's Icons section (`17:3931`) has neither,
and nothing else in the file does. **❓ Will:** add a chart glyph — and a
table glyph, if `table-columns` is not the one you want for a grid — then
`npm run icons`, and one line each in `SHOWS_ICON`
(`sherpa-filter-panel.ts`).

### `[x]` ✅ 60 — Once applied, a chip's badge shows the number of results

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

**✅ Done 2026-09-29.** `source.results(scope)` counts, from the APPLIED
Query, the rows each answered field or saved filter matches — within the
View's rows for a component scope — with `store.totalCount()`; after every
load it draws them onto each scope-bound bar (`drawResults`), and the bar
hands each chip its `results`. The badge shows it only while the chip is on
and not pending, in the reader's digits (`1,234`); the picks count and `fx`
are gone from the chip (a grid heading keeps its `fx` glyph). The picks stay
in the tip, and now also reach a screen reader as the button's
`aria-description`. On Records › At risk (13 rows): At risk 27, Status 75,
Tickets 75. Not drawn: a bar bound with no scope, and the panel's values.
`T-a-chip-counts-its-own-results`

### `[ ]` 49 — A preset Advanced chip shows its conditions, read-only

A PRESET Advanced chip (a saved filter the app ships) gets the `fx` button
in the Success look. It opens a menu of its condition rows, read-only. It sits
on the chip in the toolbar, in the section header in the panel, and on a column
heading — only those three. Everywhere else a filter changes mode with the
Advanced switch (done 2026-09-26).

**Later, with 50:** Success is the look of a WORKING condition. Warning and
critical are free for a condition that cannot apply, or a filter that failed
to — Will's note, not asked for yet.

**❓ Will, 2026-09-29 — one choice.** A preset can span TWO fields (a test's
"Risky and unowned": Health < 60 AND Owner = Unassigned), but a menu's
condition rows belong to ONE field — they have no field column. The shipped
presets on Records are one field each.

- **A (my pick): one read-only menu, a heading per field** with its rows
  under it (`HEALTH` · Less than 60; `OWNER` · Equals Unassigned). One click
  shows the whole preset. The menu learns to stack a field's rows under a
  heading — 50 then edits the same shape.
- **B: the `fx` menu lists the preset's fields**, and a field's row drills
  into that field's own rows (as the Filters menu drills into a chip). No new
  menu shape; two clicks to read a two-field preset.

### `[ ]` 50 — A reader's saved Advanced chip shows its conditions, editable

The same `fx` button, with rows that can be edited. On a filter the reader SAVED
that is applied, an edit is a temporary DRAFT; the saved filter does not
change. When the draft differs, the menu and the panel section header offer
Save. Needs 49, and 46's pending look for the draft.

### `[x]` ✅ 48 — A child menu opens on hover or click of its parent row

Not from a caret button nested in the row: the whole row is the door, as in an
OS menu. The panel's drill is click-only on purpose (a passing pointer drilled
the list away), so give hover a short delay, or rule per host.

**✅ Done 2026-09-29.** In `sherpa-menu`, so every host has it: a click
anywhere on the row but its tick box, a pointer that RESTS on it for 500 ms,
or ArrowRight opens its child menu (ArrowLeft goes back). A pointer passing
over opens nothing, and a touch never hovers; the box still ticks and opens
nothing. The caret stays, as the mark and a focus target.
`T-a-row-opens-its-child-menu`

### `[x]` ✅ 21c — A condition's matches must ALL highlight

Will, 2026-09-24: *"there will be multiple strings to match and highlight. Not
just one."*

`.cell mark.match` marks ONE substring. `filterNeedles` keeps one needle per
field (`store.ts:255`, `seen.has(field)`), and the grid marks one hit
(`sherpa-data-grid.ts` `markNeedle`). A field answered by
`Contains "ab" or Starts with "R"` has two strings; a three-row chain has
three. The mark is already Success green, matching the chip
(`T-a-conditioned-chip-reads-as-success`), so only the FINDING changes.

**✅ Done 2026-09-29.** `filterNeedles` keeps every substring clause (an
identical one once); `markNeedles` (replacing `markNeedle`) marks each hit of
each — a `contains` every time, a `startswith` at the start and an `endswith`
at the end — joining hits that overlap or touch; the grid passes all of a
field's rows, not the first. `T-a-condition-marks-every-match`

### `[x]` ✅ 21f — "Send to view filters"

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

**✅ Done 2026-09-29.** An `arrow-up` button, "Send Status to view filters",
beside Clear on a component scope's field (Remove is gone from the panel
since; the View's own fields have none). It sends the panel's ordinary
`filter-add-request` with the View's scope — `source.move()` is not needed:
holding it in the View carries the answer and leaves the chip below
suspended. On Records › At risk: Status goes up with "not churned", the rows
stay 13, and the header has one Status chip. `T-send-to-view-filters`

### `[x]` ✅ 21b — Which header chips carry over between views

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

**✅ Done 2026-09-29.** The flag is `carryOver: true` on a field (its
declaration, so the page JSON takes it — the schema knows it). A JSON View
(`setQuery`, `holds: 'keep'`) keeps a carry-over field's answer unless it
answers the field itself; an old snapshot View keeps it too (`clearAll({
carry: true })`, and `setState` keeps its reading). Plain Reset and a restore
still clear it. **Nothing on Records carries over yet** — say which fields
(Customer and Region were your example), and it is one line each in
`records.json`. `T-a-field-can-carry-over-views`

### `[x]` ✅ 20b — The Date filter should be a view-scope date RANGE

Will, 2026-09-23: a top-level date range that slices the records across the
whole view. It is at view scope now — "Date", over `source.timeField`
(cae7e964) — but still `kind: 'date'`, single by default with a Range switch,
over a list of `availableDates` — the days the records carry (`declareFromRows`).

A VIEW-scope date wants range by default; a component-scope one keeps single,
where one day is the common case. Settle whether `kind: 'date'` gains a range
variant or the chip takes the menu's `data-range`. A range wants bounds —
`dates[0]` and `dates.at(-1)` — not a set of days.

**✅ Done 2026-09-29.** Settled: the chip takes the menu's range — no new
kind. `describe(VIEW)` marks a date field `range: true`, so the header's Date
opens with its Range on; a component's date stays one day. In range mode the
calendar takes only its BOUNDS from `data-available` (the first and last days
with records), so an empty day between can be an end. On Records: a range
over 2024-01-02 to 2024-12-11. `T-a-range-is-bounded-by-the-data`

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

**Design, 2026-09-29 — for Will's review.** Found first: a clause is data,
`[field, op, value]`, and most date conditions are ops the store already
answers. Only Last and Next are new — they must stay RELATIVE in a saved
View, or "last 7 days" freezes on the day it was saved. And no time control
is needed: `sherpa-input-text` passes `type` to its `<input>`, so
`type="date"` and `type="time"` are the platform's own pickers.

| condition | in the query | the row shows | saved as |
|---|---|---|---|
| On | `between` the day's start and end | a date | `"2026-09-03"` |
| Before | `lt` | a date, and a time | `"2026-09-03"` or `"2026-09-03T14:00"` |
| After | `gt` | a date, and a time | as Before |
| Between | `between` | two dates, two times | `["…", "…"]` |
| In the last N | `within`, turned into `between` when the Query is built | a number and a unit (days, weeks, months) | `{ "last": 7, "unit": "day" }` |
| In the next N | as Last, forward | as Last | `{ "next": 3, "unit": "month" }` |

- **Simple stays the calendar** (a day, or a range) — only Advanced gains
  these rows, on 102's two kept answers.
- **`OP_TAKES` gains `date`, `dates` and `duration`** beside `list`, `text`
  and `range`: each a `<template>` in the menu's condition row, composed from
  `sherpa-input-text` and `sherpa-select`.
- **Days are UTC**, as `formatDate` reads them (`T-a-date-reads-one-way`); a
  relative date is worked out once per load, with `Temporal` where the
  browser has it.
- **The chip's face** reads `Created: last 7 days`, `Created: before 03 Sep
  2026`, through `formatDate`.
- **Build after 20b** (the ledger's rule) and with 90.

**❓ Will — two choices.**

- **Includes (a weekday):**
  - **A (my pick): not now.** It is a second axis — the weekday OF a date —
    so it is a derived field a set filter answers, its own later item.
  - **B: a condition** with seven day toggles in the row.
- **The time input:**
  - **A (my pick): only where the field holds a time** —
    `declareField(f, { type: 'date', time: true })`. Records' `created` holds
    days (`2024-07-01`), so it shows none.
  - **B: always**, and a blank time means the day's start or end.

### `[ ]` 107 — A filter can apply LIVE, debounced — an opt-in; the default stays once per act

Will, 2026-09-29, choosing A of "once per act" / "live while dragging, with a
debounce": *"A but save it as a configurable option to support later. Apps
with large datasets in the data layer will probably thank us."*

The default does not change: a filter applies once per act — a handle let go,
Enter, leaving a field, a tick. The OPTION applies while the reader is still
moving, and waits a set time after the last move before it asks the data
again.

A place to start: components stay reporters — they already send `input`
while a value moves and `change` when it settles. The SOURCE owns the rule
(`applyOn: 'change' | 'input'`, `debounce` in ms), so one app can choose per
source, and a large or remote dataset keeps the default. Settle: per source,
per field, or both; and whether a remote source may choose live at all.

**❓ Will, 2026-09-29 — two choices** (it is an option "to support later", so
it waits on these rather than guess). How it would work: the source sets
`data-apply-on="input"` on what it binds, as it sets `data-remote`; a menu
then reports while a value moves, and the source waits `debounce` ms after
the last report before it loads.

- **Chosen for:**
  - **A (my pick): per source** — one line in the page JSON,
    `"source": { "applyOn": "input", "debounce": 300 }`.
  - **B: per source AND per field** — a slow field can stay on Apply.
- **A remote source:**
  - **A (my pick): stays on Apply** — live would send a request per pause,
    and remote already waits for Apply by design.
  - **B: may choose live too**, with the debounce.

### `[ ]` 52 — EXPLORE, later: a data viz scope in the filter panel

A legend toggle IS a filter (42, done: `only` narrows one component), so a chart could have its own component
scope in the panel. It may want chips for its AXES or its AGGREGATION, the way
the grid has Group and Sort. Larger; design first. After 42, and after 38
step 3, which puts scopes in the data layer.

**Design, 2026-09-29 — for Will's review** (42 and 38 step 3 are done).
Found: most of it exists. A scope with `narrows: ["bar"]` already filters one
component alone, and a legend's toggles already narrow their chart (42). A
chart says what it summarises in attributes — `data-segment-field`,
`data-aggregate` + `data-field`, `data-over-field` + `data-bucket` — which the
provider reads into its summary.

- **The scope:** a chart's own scope in the page JSON, `narrows` its id. The
  panel draws it as a section with the chart icon (97; the glyph is 115).
  Its filters narrow the chart alone; the legend's field is one of them.
- **Its arranging chips**, as Group and Sort are a grid's: **Segment by** (a
  field), **Measure** (Count, or Sum / Mean / Min / Max of a number field),
  **Over** (a date field, by day, month or year) — each only where the chart
  has that axis (a bar or donut segments, a line runs over).
- **Who owns them:** the chart REPORTS; the provider writes its attributes.
- **Build after** 99's drawing (a set can hold them, as Organise holds Group
  and Sort) and ruling 4's per-scope arrangement.

**❓ Will — two choices.**

- **Where a chart's arrangement is kept:**
  - **A (my pick): in the Query, per scope** — as sort and group are
    (ruling 4). A saved View keeps "segmented by OS", and a reload too.
  - **B: on the chart only** — the panel steers its attributes, and a View
    does not remember them.
- **Which chips first:**
  - **A (my pick): all three** — Segment by, Measure, Over — each where the
    chart has that axis.
  - **B: Segment by only**, and the rest when asked.

---

## E — Views and navigation

### `[x]` ✅ 15 — Save a View, and the Save split-button menu

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

**✅ Done 2026-09-29, on every page.** The Save ▾ opens "Save view as" and —
on the reader's own View only, critical — "Delete view". The SHELL answers
the three requests with one name dialog and one confirm (`ask-name.js`:
`namePrompt`, `confirmPrompt`); the Dashboard's own handler and dialog are
gone. The provider: `saveView(name)` saves a new View, a clashing name
getting ` - Copy-001`; `saveView()` saves over the reader's View on screen —
Save on a preset asks for a name; `deleteView()` deletes and goes to the
first View; the bar is marked `data-custom-view`. The View chip lists
`Presets`, then `Custom views` at the bottom. 105 reuses the dialogs.
`T-a-saved-view-is-the-readers-own`

### `[x]` ✅ 17b — At the mobile breakpoint the nav becomes a menu

Not started. At mobile width the rail is GONE and a menu takes its place.

- **The trigger:** a menu button in the App Header, RIGHT of the Context title.
- **The rail:** hidden, and its padding on the header and content goes to `0`.
- **The menu:** fills the viewport; no `Pin`; `Settings` at the BOTTOM; a
  footer `Cancel` that closes it and goes nowhere.
- **A Context row** closes the menu AND navigates.

**Put the nav on the data layer while you are here.** `sherpa-nav` has
`renderData()` but never calls `bind()` — a one-shot draw. Bind it to a Store,
so the rail and the menu are two renderings of one nav model.

**✅ Done 2026-09-29.** At 480 px — the header's own phone width, where its
filters go — the shell hides the rail (by `visibility`, so the menu can come
back) and drops its inset; the header shows a `menu` button right of the
Context title. The menu is the SAME `sherpa-nav`, `openMenu()`ed into the top
layer: the whole screen, open, no Pin, Settings at the bottom, Cancel that
goes nowhere; an Area only opens, a Context row closes it as it goes; Escape
closes it. One element in two presentations, so they cannot disagree — which
meets "one nav model" without a second copy; binding the nav to a Store is
now its own item, 116. **Found on the way:** the header's
`container-type: inline-size scroll-state` was dropped whole by Firefox and
WebKit, so its 480 px rule never ran there — fixed
(`T-a-second-container-type-drops-the-first`). No Figma design exists for
the phone; the look follows the rail's. `T-the-nav-is-a-menu-on-a-phone`

### `[ ]` 116 — `sherpa-nav` binds to a Store: its entries as data, drawn and redrawn

Split from 17b, 2026-09-29. `sherpa-nav` has `renderData()` but is never
bound — the app re-`populate()`s it by hand when Favorites or Recent change.
Bind it to a Store (its sections and entries as rows), so a change to the
data redraws it, as every other data component. The phone menu is the same
element (17b), so it follows for free.

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

### `[ ]` 111 — A spec types every JS property as `string`

Found in 102 step 2 (2026-09-29): `parseClassApi` (`scripts/lib/ts-facts.mjs`)
gives every getter and setter `type: 'string'`, so `sherpa-menu`'s spec says
`reading` and `conditions` are strings, and `open` and `dirty` too. A wrong
type in a contract is worse than an honest gap: read the accessor's own
annotation, and write `unknown` where there is none. Every spec's `jsProps`
moves when it lands.

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

## ✅ Done — the full record

Every finished item keeps its section: what was asked, then what was done.
Newest first. The ledger lists them too, with ✅.

### `[x]` ✅ 104 — BUG: a number filter never applies what is typed or dragged

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

**✅ Done 2026-09-29:** a number filter applied nothing that was typed or dragged — the body moved into the menu's shadow root and the menu listened only on its host; it now listens on its body, the panel reads a number through the bar's own `bodyReading()`, and one typed number is a pick under `=` — `T-native-change-stops-at-the-host`, `T-one-number-is-a-pick-under-equals`

### `[x]` ✅ 75 — Filter modes are SIMPLE and ADVANCED, not Default and Conditional — every file

**75a built 2026-09-29 — the mode VALUES:** `ConditionType` is `simple |
advanced`; a menu's `data-mode`, a chip's `data-condition`, a filter's kind
(`advanced`), the panel's and menu's mode events, and the Style pins
(state-pins.yaml, re-projected). Old words are still HEARD — `default`,
`custom`, `select`, `condition`, `conditional` — so a saved View or filter keeps
working. **75b built the same day:** the opt-in key is `advanced` (`custom`
and `conditions` still read), the menu's `data-advanced` / `data-advanced-only`
(old names heard), the page schema and `records.json`, the internal class names,
and the labels — the switch reads **Advanced**. **Left: 75c** — docs, TRAPS
and test titles.

Will, 2026-09-27: *"We need to move away from using the terms Default and
Conditional for filter modes. Instead we should use 'Simple' and 'Complex'."*

| mode | is |
|---|---|
| **Simple** | ONE field, with one or more values to choose from |
| **Advanced** | ONE OR MORE fields, with one or more values to choose from, and conditional parameters in use |

**Advanced, not Complex** — Will, later the same day, choosing A of "Advanced" /
"Complex" after writing "Advanced" in 90.

The new ontology goes into EVERY file: code (`mode: 'default' | 'custom'`,
`data-mode`, `condition: 'custom'`, `custom:` opt-ins), UI labels (the
"Conditional" switch), tests, docs, TRAPS and the specs. Do it in one sweep,
after step 6 of the Query, so the features in D (49, 50, 46) are built in
the new words. Note: Advanced allows SEVERAL fields — today a condition is
over one field, so the rename also opens that door.

**✅ Done 2026-09-29:** the filter modes are **Simple** and **Advanced** in every file — values (75a), the opt-in key `advanced`, the menu's `data-advanced` / `data-advanced-only` and the labels (75b), then docs, TRAPS and test titles (75c). Every old word is still HEARD, so a saved View or filter keeps working — `T-a-renamed-attribute-keeps-its-old-name`

### `[x]` ✅ 101 — ADVANCED: a condition row will not add in a chip's menu; in the panel, changing a row's condition drops the row

Will, 2026-09-29: *"I can't add more conditions to an advanced filter. In the
filter toolbar menu the row just doesn't add. In the filter panel, the row
adds, but changing the condition type results in the row being removed."*

Two faces, probably one cause. Start at `sherpa-menu`'s `#onAddCondition`
(`#addRow()` then `#emitConditions()`): the report goes to the source, and the
source draws the field's reading BACK onto the menu. A new row has no text
yet, so it is likely not part of the reading, and the redraw drops it — in
the chip at once, in the panel once its condition changes. An unanswered row
is the reader's work in progress, never an answer to throw away — the same
family as `T-a-rebuilt-bar-reads-empty-until-its-menus-stamp`.
A test for each face: add a row in a chip's menu, and change a new row's
condition in the panel.

**✅ Done 2026-09-29:** an Advanced condition row would not add in a chip's menu, and in the panel a row's condition change dropped it — the source draws every field's answer back with its ANSWERED rows only, and the menu rebuilt from that; now an answer that matches the rows the reader has answered keeps every row — `T-an-unanswered-row-survives-a-redraw`

### `[x]` ✅ 61 — BUG: Add customer saves with required fields empty

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

**✅ Done 2026-09-29:** Add customer saves with required fields empty — the dialog is a real `<form>`; the four form controls take part in it (`FormValue`), Save submits it, and the browser refuses an empty required field and points at it; nothing is filled in for the reader, and the toast says when the page's filters hide the new record — `T-a-form-value-follows-every-write`

### `[x]` ✅ 92 — Navigating SETS UP the content — its definitions, data layer, filters and state — not only swaps the template

Will, 2026-09-27: *"When the app shell navigates to new content we shouldn't
only be swapping the content area content/templates. We need to be getting
and setting the definitions, data layer etc. to ensure all the correct filters
are available, shown, and in the correct state. Same goes for all other view
content. We're probably already doing this somewhere but there are gaps. I
assume the new provider comes into play here."*

Today each Context's `init()` does it by hand — make a source, declare its
fields, give the provider its source, restore the session's Query, draw the
bars — and anything a Context forgets is a gap (the Dashboard gave the
provider no source until P2). Yes, the provider: a Context DEFINITION (JSON —
its sources, fields, scopes, Views and template) handed to it on navigation,
so it sets up the data layer, answers every component, and restores the
state. Provider P4 (definitions) and 70 (a view definition renders the page)
are its halves. First: audit where it is done today, and list the gaps.

**Audited 2026-09-27 — `PROVIDER-DESIGN.md` §10.** Two gaps fixed: a page with
no data shut the panel (G1), and the Dashboard keeps its Query (G2). Open: Save
view on Records (G3, TODO 15), and the Context DEFINITION that ends the
repeated setup in every Context (G4) — **designed in `docs/PAGE-DEFINITION.md`,
decided by Will 2026-09-29.** D1, D2 and D3 are built: the router
opens every page from `examples/definitions/<context>.json` through
`provider.open()`, and a Context's `init` gets its source.

**✅ Done 2026-09-29:** navigating sets up the page — the router opens each Context from `examples/definitions/<name>.json` through `provider.open()`: its source, fields, scopes, saved filters, the header's chips, each bar's Add list, the grid's configuration and the kept Query. D1 `edec11a6`, D2 `ce3aaa4f`, D3 `eeb5e37a` — `T-a-page-is-its-definition`

### `[x]` ✅ 85 — `sherpa-provider`: a component ASKS for data, a scope, a query, a View or a template

**Designed — `docs/PROVIDER-DESIGN.md`, for Will's review.** Will, 2026-09-27:
*"Why can't any component ask for data, a definition, a conditional query
definition or a template from the data layer?"* — the Context Protocol
(choice A), a provider over a subtree, and each request can subscribe. It was
designed in `FILTER-REVIEW.md` §9–§12 on 2026-09-25 and never built. Step 8
of the Query folds into its P2. Target: `records.js` 853 → ~250 lines of code,
`dashboard.js` 222 → ~50. Closes most of 37 and 38.

**P1 built `ffc48935`** — the provider, the Context Protocol, the grid and
pager ask. **P2 built** — charts, tiles and legends DECLARE what they need
(`aggregate`, `segments`, `series`); the pages lost their adapters. The
centralisation audit is `PROVIDER-DESIGN.md` §9, for review; its items 9
and 13 are done. **P3a and P3b built** — fields declared once on the
source; the bars ask for their scope and report their holds. **P3c built**
— the panel asks for its scopes, drawn whole by `describe()`. Also fixed on
the way: 93 (only the View trickles down), 87 and 88. **P3d built** — the
grid headings answer through the source. **P3e built** — a component's own
filter is `data-readings`, and a View pick keeps it. **P4 built** — the
provider keeps the Views and the session's Query; a View's content asks for
its data. **P3 and P4 are done:
`records.js` 1163 → 655 lines since P2 began, `dashboard.js` 331 → 170 (the
size gate's count, comments in).** **P5 built** —
a page's state goes out and comes back as JSON. **The provider plan (P1–P5) is
done.** **Next:** 91 (the shell owns panel mode) and 92 (navigating sets up
the content), then the §9 items that P3 unlocked, and 86 (the full audit).

**✅ Done 2026-09-29:** the provider, P1–P5 — a component ASKS and the nearest provider answers; `records.js` 1163 → 326 lines, `dashboard.js` 331 → 107 — `T-a-component-asks-its-provider`, `docs/PROVIDER-DESIGN.md`

### `[x]` ✅ 73 — EXPLORE: one compiled QUERY, built as the reader sets it up, run on Apply

Will, 2026-09-26: *"A query language that is compiled as conditions
(grouping, sorting, filtering, conditions, segmentation, aggregation etc.)
are built up. The data layer compiles this query then executes it when
triggered (e.g. user clicks apply). The aim here is to avoid reloads,
refreshes, state changes etc. causing a loss of set up parameters. The data
layer can probably also use this query to help inform other UI components
alongside the component state tracking feature. We probably have a
proto-version of this going already but it needs work if we do."*

**The proto-version, as it stands:**

| piece | where | what it is |
|---|---|---|
| `ViewState` | `data-source.ts` | filter, sort, group, search, page — one flat state |
| named parts + field readings | `DataSource` (`contribute`, `select`) | the filter is COMPOSED from them, and `state.filter` is the composed result |
| the clause grammar | `store.ts` (`Filter`, `andFilter`, `picksClause`) | the query's filter language |
| `FieldReading` → clause | `filter-state.ts` (`fieldState`, `readingClause`, `clauseConditions`) | a reader's answer as data, compiled one way |
| aggregation | `aggregate.ts` (`reduceRows`, `countBy`, `seriesBy`) | run by hand in the example's `as` closures |
| `debugState()`, `ViewSnapshot` | source, `persist-view.ts` | the query read back, and saved |

**What is missing:** the query is not ONE object. Filter parts, readings,
sort and group live in the source; segmentation and aggregation live in each
Context's code; and `state.filter` is the compiled OUTPUT, which is why a
restored one showed rows no chip explained (21e). A single query — every
parameter, in the reader's own terms, compiled on demand — could be the one
thing that is saved (21e), shared (70's view definition), applied on a
trigger (62's remote Apply), and read by every control to draw itself (38
step 3). Design it with 70; 62's "only a remote fetch needs Apply" decides
when it runs.

**Will, 2026-09-26: DESIGN FIRST.** One short design covering 73, 70 and 62
together — the query object, the view definition, and when Apply runs — as a
page Will reviews before any of it is built.

**The design is written: `docs/QUERY-DESIGN.md`** (2026-09-26). **Decided the
same day:** a View is markup + a JSON Query; "remote" is on the STORE, spoofed
by a wrapping store in the data layer; build steps 1–5 first (one owner), then
6–8. Building now, one step per commit.

**Steps 1 to 7 are built (2026-09-27)** — see `QUERY-DESIGN.md` §10 for what
each did and what is left. The source holds the Query; the bars, the open
panel, the header, the legends and the grid headings are drawn from it; the
session saves and restores it. Will's choice A: a heading filter wears its
field's normal chip, so the `col:` and external chips are gone. Step 6 gave a
remote store a draft, Apply only for a remote fetch, the pending chip and the
footer's "nothing to save" (62, 46, 66). Step 7: a saved View is JSON — its
Query onto a clean slate, its defaults on the chips — Records and the
Dashboard. **Next: step 8** — segment and aggregate in a component scope.

**✅ Done 2026-09-29:** one Query, steps 1–8 — step 8 (segment and aggregate) became provider P2's declared summaries — `T-one-query-one-owner`, `docs/QUERY-DESIGN.md`

### `[x]` ✅ 70 — EXPLORE: a view definition bundles its filters; one JSON renders the page

**Designed with 73 — see `docs/QUERY-DESIGN.md`.**

Will, 2026-09-26, ruling on 21e: a View change is a clean slate (both bars
empty their filter chips) — *"but default filter fields, values, and states
need to be bundled in a view definition. I'm not sure how we'd do that with
our templates. So perhaps we need a JSON definition that gets translated to a
template and data layer requests for all components. Something to
investigate."*

**What a view definition holds today** (`SavedView`, `persist-view.ts`): a
label; a `snapshot` — the source's state plus, per element, a map of public
METHOD CALLS (`applyViewSnapshot`; the Dashboard's EMEA view sets Region this
way); and optional `content` markup, parsed through an allow-list
(`parseViewMarkup`). What it CANNOT say: which filter chips each bar HOLDS,
nor their default values and on/off states — the Context's own code decides
those (`DATA_FILTERS` and `globalFilters()` in the Records example).

**The question:** one JSON definition per View that declares, for every
component, what it is, where it sits, which fields it offers, and each
field's default answer — and a translator that turns it into the template AND
the data-layer requests (`declareValues`, `hold`, `select`, `contribute`).
Then a View change applies the view's own defaults onto the clean slate, and
Save (15) writes the same shape back.

Settle before building: is the JSON a superset of `SavedView` or its
replacement; how it meets the templates (68's templater, 27's own
templates); and how much of it is 38's "a component DECLARES the data it
needs". Design first — 15 builds on the answer.

**Settled 2026-09-27: ONE JSON definition** (`T-a-view-is-json`). Built for
Records and the Dashboard in step 7 of 73: `{ label, query, ui }`, applied
onto a clean slate with its defaults on the chips; `saveViewAs` saves the same
shape. Left: a view's LAYOUT as JSON, which the Templater (68) turns into a
template — `content` markup stays until then — and Save a View (15).

**✅ Done 2026-09-29:** a View is ONE JSON definition, `{ label, query, ui }`, applied onto a clean slate. Its layout as JSON is 68's; saving it is 15's — `T-a-view-is-json`

### `[x]` ✅ 47 — More than 20 values: one chip, not a run

A panel field with more than 20 values draws the toolbar's single chip, with a
dropdown of its values, not one chip per value. **89 moves the line to 16**, for the bar
and the panel alike. It is the flag 38's builder
already needs: whether values EXPLODE into a run or stay behind a menu.

**✅ Done 2026-09-29:** more than 20 values, one chip — merged into 89, at 16

### `[x]` ✅ 93 — A grid-scope filter narrows the charts and tiles too

Found while building the provider (85), 2026-09-27, and fixed at once — it had
no section of its own. A filter set at GRID scope narrowed every summary on
the page, not only the grid. Only the View's filters should reach everything.
Commit 6bcc4f23.

**✅ Done 2026-09-27:** a grid-scope filter narrowed the charts and tiles too — only the View trickles down now; a summary is under the View alone — `T-only-the-view-trickles-down`

### `[x]` ✅ 91 — The APP SHELL switches Filter toolbar and Filter panel modes, for any View in the content area

Will, 2026-09-27: *"The app shell should be able to toggle between Filter
Toolbar and Filter Panel modes for any View that is showing in the content
area."*

Today Records wires it by hand: `togglePanel`, `setPanelMode`,
`syncPanelled`, the reopen and restore code, and the session's
`/filters/mode`. The shell already owns WHERE the panel sits
(`T-the-shell-owns-the-panel-areas`), so it owns the MODE too — for whatever
content it shows, with no page code. With provider P3c the panel asks for its
own scopes, so the shell needs only to open it.

**✅ Done 2026-09-27:** the provider owns TOOLBARS or PANEL for every page — Configure opens the panel on the Dashboard too; the app keeps the choice — `T-the-provider-owns-the-panel-mode`

### `[x]` ✅ 62 — Apply and Discard only for a REMOTE fetch; a debug flag spoofs one

**Designed with 73 — see `docs/QUERY-DESIGN.md`.**

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

**✅ Done 2026-09-27:** Apply only for a REMOTE fetch — locally every pick applies at once; `?remote` spoofs a remote store; the panel's footer is gone, a remote field has its own Apply and Discard — 7c7cdf5c, 9294cfd6, c92adec0, `T-apply-and-discard-wait-for-a-change`, `T-commit-follows-select-mode`

### `[x]` ✅ 46 — A PENDING state: changed, not yet applied

A chip that goes straight to active before its change is applied misleads the
reader. Between the change and Apply, a chip is PENDING: an active purple
BORDER, no fill. A conditional chip is the same — it turns green only once
applied. Only a committing (Apply) field has a pending state — after 62, that is a
REMOTE one; a field that applies at once goes straight to active.

A state is a pin, as data (`scripts/figma-data/state-pins.yaml`), not a
colour rule in the chip. Check what the pin's surface resolves to first.

**✅ Done 2026-09-27:** a pending chip wears the active edge and no fill — 6050eddf, `T-a-pending-chip-has-no-fill`

### `[x]` ✅ 66 — The footer owns "nothing to save": Save and Cancel wait for a change

Will, 2026-09-26: wire the inactive Save & Cancel (or Apply & Discard, or any
equivalent pair) into `sherpa-container-footer`, *"so that all menus etc can
inherit this common behaviour."* Today each host does it by hand, or not at
all: the filter panel built its own (`#syncDirty`,
`T-apply-and-discard-wait-for-a-change`), and `sherpa-menu` has a `dirty`
getter its footer does not use.

The FOOTER turns its commit and revert controls off while the host says
nothing has changed, and on when it has. The host only REPORTS dirty — one
attribute or property, e.g. `data-dirty` on the footer, or a `dirty` it asks
of its host — and never touches the buttons. Nine templates compose the
footer (calendar, dialog, container, filter panel, menu, nav, overlay-panel,
panel, select-card); each then drops its own copy. Which buttons are the pair
must be declared, not guessed from their labels.

Do it with 62: 62 decides WHICH fields have Apply and Discard at all, this
decides how any such pair behaves.

**✅ Done 2026-09-27:** the footer owns "nothing to save" — a committing menu's Apply and Cancel wait for a change — 23094c86, `T-the-footer-owns-nothing-to-save`

### `[x]` ✅ 39 — The panel header gets Reset all filters

A button in the filter panel's header that resets BOTH scopes, View and
component, in one press. It and the toggle-to-toolbar button (`.to-toolbars`)
take the DEFAULT button look, not transparent.

**✅ Done 2026-09-26:** the panel header's Reset all clears both scopes, and both header buttons wear the default look

### `[x]` ✅ 53 — A conditional chip's tip says "X conditions applied"

Will, 2026-09-26. The tooltip of a conditional chip reads `3 conditions
applied` (`1 condition applied` for one). Count ANSWERED rows only — an empty
row is not a condition. Today the tip spells the chain (`Contains: ab or
Equals: churned`, `spellConditions()`); the `fx` button (49, 50) is where the
rows themselves are read now. The badge is NOT a condition count — Will
changed that ask for 60.

**✅ Done 2026-09-26:** a conditional chip's tooltip says "X conditions applied" — `T-a-condition-tip-counts-its-rows`

### `[x]` ✅ 40 — A switch has no accessible name

`sherpa-switch` does not pass an `aria-label` to its inner `role="switch"`
input, and its visible text is a sibling span. So the Range and Conditional
switches are unnamed to a screen reader. Mirror `aria-label` onto the input,
or label the input by the text beside it.

**✅ Done 2026-09-26:** a host's `aria-label` names its inner control — button, input, checkbox, radio, switch; 59 template sites + 18 in code were unnamed — `T-a-host-label-must-reach-its-control`

### `[x]` ✅ 17 — Breadcrumbs are for workflow, not for the nav

Breadcrumbs must not show movement between Contexts — the nav does that. They
are for a workflow redirect or a drilldown, e.g. a link in a grid cell opens a
details Context.

**Still wrong, measured 2026-09-26, and small.** Records and Assistant set a
`Home › Records` / `Home › Assistant` trail (`examples/contexts/records.js`,
`chat.js`) — Home is the Dashboard Context, so the trail IS nav movement.
Drop both; Dashboard already sets `[]`. The first real trail comes with a
drilldown (23).

**✅ Done 2026-09-26:** no breadcrumb trail on Records or Assistant — moving between Contexts is the nav's to show

### `[x]` ✅ 57 — The filter panel's width is a hard-coded 400px

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

**✅ Done 2026-09-26:** a shell panel area is exactly three grid columns wide, worked out in CSS; the shell's panel areas stay — `T-the-shell-owns-the-panel-areas`

### `[x]` ✅ 65 — A horizontal legend has a max width, and is centred

Will, 2026-09-26: a horizontal `sherpa-chart-legend` spreads its entries across
a whole 12-column container — far too wide to read as one key. Give it a
max width and centre it horizontally in its container. A token for the width,
never a hand-typed px; check it in the Dashboard's wide charts.

**✅ Done 2026-09-26:** a horizontal legend is capped at 40rem and centred; narrow, it fills — `T-a-horizontal-legend-is-three-by-two`

### `[x]` ✅ 41 — BUG: a conditional filter applies for Owner only

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

**✅ Done 2026-09-26:** conditions DID filter — Owner, Name and Email, in the toolbar and the panel (Owner Contains Da: 100 → 10). What failed was the chip's FACE after a panel Apply: no value, a stale tip. A silent steer now calls the chip's `refresh()` — `T-a-silent-steer-still-redraws-its-chip`

### `[x]` ✅ 63 — BUG: a conditions-only field shows the Conditional switch

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

**✅ Done 2026-09-26:** a conditions-only field (Email) has no Conditional switch in the panel; its rows show from the start

### `[x]` ✅ 69 — The main header has a back button

From Will's list, 2026-09-26, and fixed at once — it had no section of its
own. The back button on the main header went back between Contexts, which is
the nav's job. Commit 5453f571.

**✅ Done 2026-09-26:** no back button on the main header — it went back between Contexts, which is the nav's job, as with the breadcrumbs; Settings keeps its own

### `[x]` ✅ 56 — BUG: a view change leaves a lit chip that filters nothing

Found by the 2026-09-26 audit. Region = EMEA (27 rows), then the My accounts
view: the Region chip stays `data-current`, but its `global` part is dropped.
12 rows — all of Ravi's; EMEA would be 5. A lit chip must filter, or go off.
21b decides whether the chip SHOULD survive; this is that it must not lie.

**✅ Done 2026-09-26:** a view change resets the header chips the new view does not set — Region no longer stays lit over My accounts; this is 21b's default — `T-a-view-change-resets-the-header-chips`

### `[x]` ✅ 21e — BUG: a reload keeps a filter nothing on screen shows

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

**✅ Done 2026-09-26:** filters survive a reload and a trip away, for the session, on the View they were made on — each bar keeps its `answers` and replays them with `restoreAnswers()`; the combined query is never restored; a View change empties both bars' filter chips — `T-a-reload-replays-the-readers-answers`

### `[x]` ✅ 55 — BUG: the At risk view's own column filter never applies

Found by the 2026-09-26 audit. At risk sets
`grid.setColumnFilter(status, ne churned)`, and 9ms later the selection
handler (`examples/contexts/records.js` ~783) calls
`setColumnFilter(status, null)`. So At risk shows 20 rows where it should show
13. And a `col:status` chip stays on the bar, `data-current` with no value,
still lit after going back to All customers.

(The old bug — All → At risk → All left 1 page of 4 — is fixed.)

**✅ Done 2026-09-26:** At risk keeps its own `status ne churned` (13 rows, was 20); going back to All drops the old `col:status` chip — `T-an-empty-selection-never-wipes-a-condition`

### `[x]` ✅ 44b — BUG: a heading holds a whole reading, so a CHAIN shows and applies

The single-condition half of 44 is done (a held condition opens its menu on
the condition, `T-a-heading-menu-opens-on-what-it-holds`). What is left: the
grid's `ColumnFilter` holds ONE condition — an op and a value or picks. So:

- a chain set from outside (`owner contains Da or starts with R`, from the
  chip mirror) is GARBLED — `setColumnFilter` reads `['or', a, b]` as an op
  and a list of picks;
- a chain a reader types INTO the heading applies only its first row
  (`#readColumnFilter` reads `op` and `conditionValue`).

The fix is the model: a column holds a whole `FieldReading` (picks, op, text,
conditions, range, suspended), as a chip does, and the clause comes from the
data layer's own `readingClause`. The grid then stops being a second filter
model.

**✅ Done 2026-09-26:** a heading holds a whole reading — a chain set from outside or typed in shows and applies whole; `clauseConditions()` turns a chained clause back into rows — `T-a-heading-holds-a-whole-reading`

### `[x]` ✅ 71 — BUG: the chart legend's Other menu does not open

Will, 2026-09-26: the Other row's breakdown menu no longer displays. Check,
too, that changing its selections shows and hides those segments in the chart
(`T-the-breakdown-button-shares-the-other-row`,
`T-legend-toggle-is-a-filter`). Suspect first: every `sherpa-button`'s
`.trigger` now carries `anchor-name` for its tip (2cbc6c6d) — check it does
not take the anchor a slotted menu positions against.

**✅ Done 2026-09-26:** the legend's Other menu draws again — an icon button had no menu slot since ad7f91be; unticking a folded category and Apply takes the bar chart 16 → 14 bars — `T-an-icon-button-still-slots-its-menu`

### `[x]` ✅ 72 — BUG: adding a second conditional filter resets the first

Will, 2026-09-26: with Owner already answered by a condition, he added a
second conditional filter — Email — and on Apply the Owner condition was
reset completely. Adding a field REBUILDS the bar (`#addFilters` → `#render`),
and a rebuilt menu reads empty until it stamps
(`T-a-rebuilt-bar-reads-empty-until-its-menus-stamp`); `#keepAnswer` carries
a chip's rows across a rebuild.

**Reproduced 2026-09-26, toolbar, through the real menus:** Owner Contains Da
→ 10 rows, chip on. Add Email → the rebuilt Owner chip comes back OFF — its
rows kept (`mode: custom`, `contains Da`), so it reads as SUSPENDED. Email
Contains `example` → the bar reports, the suspended Owner applies nothing:
100 rows. So the rebuild keeps the answer and loses the ON. Suspect the
rebuilt row reading empty for a tick (`T-a-rebuilt-row-reads-empty-for-a-tick`)
switching the chip off in `#applySelection`, with nothing turning it back on.
Check the panel too.

**✅ Done 2026-09-26:** adding a second conditional filter keeps the first — the toolbar holds a rebuilt chip's answer until its rows fill; the panel draws a conditioned field on its rows and writes them once each menu has drawn — `T-a-conditioned-field-opens-on-its-rows`

### `[x]` ✅ 44c — BUG: a heading shows an answer held at VIEW scope

Region = EMEA in the header lights the grid's Region heading — `#isFiltered`
counts the query's `data-filter-fields` — but its menu shows nothing ticked,
so a reader can pick a contradicting value there. The heading must show the
View's answer.

**Will's ruling, 2026-09-26: shown, but held higher.** As a component chip
whose field the View took (`T-a-superseded-chip-suspends-it-is-never-removed`):
the heading's menu shows EMEA ticked, greyed, with the tip "Filter applied at
higher scope", and it cannot be changed there — the reader changes it in the
header. One owner for one value. Build on 44b: the heading then just holds
the View's reading, read-only.

**✅ Done 2026-09-26:** a heading whose field the View holds shows the View's answer — ticked, greyed, read-only (`sherpa-menu data-readonly`) — via `grid.supersedeColumns()` — `T-a-view-held-heading-shows-and-refuses`

### `[x]` ✅ 42 — BUG: a legend toggle filters the whole view

Will: *"Chart legend toggling is behaving like View scope filtering. They
should only affect their chart."* This was fixed on 2026-09-24
(`bindSelection` `scope: 'component'`, `T-a-filter-applies-down-its-scope`),
so something has undone it. Find what, and add the test that would have
caught it.

**Likely cause, read 2026-09-26:** `reach: 'component'` CONTRIBUTES a named
part (`legend:<id>`) to the SOURCE — and every component bound to that one
source obeys every part. So "component" scope narrows the whole view, not
the chart. A per-component filter needs the part to reach only the component
that owns it (a part keyed to a bind, applied at that bind's push), or its own
source.

**✅ Done 2026-09-26:** a legend narrows ITS chart only — a part can name the one component it narrows (`contribute(key, filter, { only })`), kept out of the shared query; Records' bar chart 4 → 3 bars, the grid stays at 100 — `T-a-component-part-narrows-one-component`

## Done — the one-line log

One line each. The detail is in git and in the trap named.

**2026-09-29, the component API audit (86)**
- 16: the ★ stars the View, not its whole Context — `T-a-favourite-is-a-view`
- 95: a menu takes its Cancel baseline in `show()`, not in the late `toggle` — `T-the-baseline-is-taken-at-show`
- 54: ❓ how a one-value row is removed once its tick means On — two options in the item
- 96: ❓ what fills a narrow grid's slack — two options in the item
- 64: a shut accordion fills with the Style +2 surface
- 100: the Assistant panel shows its heading — `data-heading`, not `data-title`
- 106: a click in a menu's gap is the menu's own; no accordion behind it toggles — `T-a-gap-click-is-the-menus-own`
- 108: a Filters menu row's scope is its description line, with no "in"
- 114: a re-fold that moves nothing keeps the open Filters menu — `T-a-reflow-that-moves-nothing-keeps-its-menus`
- 113 step 1: a saved View waits for a component that has not drawn — `T-apply-degrades-never-throws`
- 113: select-group's value is data, and its ticks are drawn from it — `T-a-value-is-data-the-ticks-are-drawn`
- 113: prompt-composer holds a value set before its first render — `T-a-value-before-the-first-render-is-held`
- 99, 21d: designed; each waits on two choices from Will
- 105 step 1: the Filters menu's section is "Saved filters"; the rest waits on two choices
- 109: Reset is labelled, with a ▾ menu — Reset to default puts back the View's own filters — `T-reset-to-default-is-the-views-own`
- 97: a panel section shows an icon for what it filters — `T-a-scope-says-what-it-shows`; the chart glyph is 115, for Will in Figma
- 60: a chip's badge is the rows its own answer matches — `T-a-chip-counts-its-own-results`
- 49: ❓ how the fx menu shows a preset over two fields; 50 waits on it
- 48: a child menu opens from the whole row, a resting pointer or ArrowRight — `T-a-row-opens-its-child-menu`
- 21c: a chain of conditions marks every string it matched — `T-a-condition-marks-every-match`
- 21f: a panel field can be sent up to the view filters — `T-send-to-view-filters`
- 21b: a field can carry its answer over a View change (`carryOver`) — `T-a-field-can-carry-over-views`
- 20b: the View's Date is a range, bounded by the data — `T-a-range-is-bounded-by-the-data`
- 52, 107: designed / explained; each waits on two choices from Will
- 15: save, save as, save over and delete a View, on every page — `T-a-saved-view-is-the-readers-own`
- 17b: on a phone the nav is a whole-screen menu — `T-the-nav-is-a-menu-on-a-phone`; the Store binding is 116
- 43: the ⋮ menu holds every folded action, and a view bar's ★ · Save · ▾ folds at last — `T-the-more-menu-holds-what-folded`
- 94: a number menu waits for Apply, and Cancel puts back — `T-a-number-waits-for-apply`
- 83: a picked day turns the committing footer on, and a disabled button acts on nothing — `T-a-disabled-button-acts-on-nothing`
- 82: a number chip set by a View shows its value (`2` for "> 2"); an old "is not X" no longer ticks X as Simple's answer — `T-both-answers-are-kept`
- 45: a date reads one way — `formatDate()`, DOM-free, `03 to 15 Sep 2026` — `T-a-date-reads-one-way`
- 103: a keyless row gets a key from the data layer, kept beside the row and never on it; the grid selects by key and `selection-change` sends keys — `T-a-made-up-key-never-leaves-the-data-layer`
- 102: both answers kept — a filter switches between Simple and Advanced at any time and loses nothing; Advanced mirrors Simple until a row is edited; in the bar, the panel and a grid heading — `T-both-answers-are-kept`
- 104: a number filter applied nothing that was typed or dragged — the body moved into the menu's shadow root and the menu listened only on its host; it now listens on its body, the panel reads a number through the bar's own `bodyReading()`, and one typed number is a pick under `=` — `T-native-change-stops-at-the-host`, `T-one-number-is-a-pick-under-equals`
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
