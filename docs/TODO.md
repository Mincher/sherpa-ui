# TODO

The list of open work. One file. Add to it, tick items off, do not start a second one.

Status: `[ ]` open · `[~]` in progress. A DONE item leaves the body and gets one
line under **Done**, at the bottom — git and `docs/TRAPS.md` keep the detail.

**A bug is queued like any other item.** Will, 2026-09-26: bugs do not demand
immediate attention. Add it here, in its place in the order, and carry on.

---

## At a glance

**60 open.** Reassessed 2026-09-26: the bugs that lie first, then the
FOUNDATION — the one compiled query, the view definition and when Apply runs —
before the filter features that stand on it. Numbers are ids, not order; the
table IS the order.

| Pri | # | Item | Kind |
|---:|---:|---|---|
| | | **B — The foundation: design, then build** | |
| 1 | 73 | EXPLORE — one compiled QUERY, built as the reader sets it up, run on Apply | explore |
| 2 | 85 | `sherpa-provider`: a component ASKS for data, a scope, a query, a View or a template | foundation |
| 2b | 86 | AUDIT — every component's functions and events: one request, one response, standardised in `SherpaElement` | explore |
| 2c | 91 | The APP SHELL switches Filter toolbar and Filter panel modes, for any View in the content area | foundation |
| 2d | 92 | Navigating SETS UP the content — its definitions, data layer, filters and state — not only swaps the template | foundation |
| 3 | 70 | EXPLORE — a view definition bundles its filters; one JSON renders the page | explore |
| 4 | 74 | EXPLORE — the Query builds every group, sort and filter menu; a menu shows its sub-query | explore |
| 5 | 75 | Filter modes are SIMPLE and ADVANCED, not Default and Conditional — every file | refactor |
| 6 | 38 | One model, one builder, one owner — what is left | refactor |
| 7 | 37 | Components are AGNOSTIC of the data and of the example app | refactor |
| | | **C — Contained bugs** | |
| 8 | 64 | A collapsed accordion section fills with the down (+2) surface | quick |
| 9 | 61 | Add customer saves with required fields empty | bug |
| 10 | 43 | The toolbar ⋯ overflow menu shows nothing | bug |
| 11 | 45 | A picked date does not show in the chip | bug |
| 12 | 82 | A number chip set by a View shows no value on its face | bug |
| 13 | 83 | Calendar menu: a picked date leaves Apply and Discard looking off — yet they work | bug |
| 14 | 16 | Favourite and Save apply to the Context, not the View | bug |
| 15 | 54 | A one-value filter's row in the Filters menu: its tick means On | bug |
| 15aa | 94 | A number (and range) filter menu needs Apply and Cancel buttons | bug |
| 15ab | 95 | Firefox: a remote chip holding a draft is not marked pending | bug |
| | | **D — Filters: Will's features, on the foundation** | |
| 15c | 89 | Every filter added to the panel starts SIMPLE: chips, one chip with a menu, or a number input or range | feature |
| 15d | 90 | Any filter switches to ADVANCED: condition rows, with options per field type | feature |
| 16 | 60 | Once applied, a chip's badge shows the number of results | feature |
| 17 | 49 | A preset conditional chip shows its conditions, read-only | feature |
| 18 | 50 | A custom conditional chip shows its conditions, editable | feature |
| 19 | 47 | More than 20 values: one chip, not a run | feature |
| 20 | 48 | A child menu opens on hover or click of its row | feature |
| 21 | 21c | A condition's matches must ALL highlight | feature |
| 22 | 21f | "Send to view filters" | feature |
| 23 | 21b | Which header chips carry over between views | feature |
| 24 | 20b | The Date filter should be a view-scope date RANGE | feature |
| 25 | 21d | EXPLORE — conditions for a DATE field | explore |
| 26 | 52 | EXPLORE — a data viz scope in the filter panel | explore |
| | | **E — Views and navigation** | |
| 27 | 15 | Save a View, and the Save split-button menu | feature |
| 28 | 17b | At the mobile breakpoint the nav becomes a menu | feature |
| 29 | 34 | Figma: use the Navigation terms | figma |
| 30 | 79 | Nav header: Settings and Pin are one Button group in an Actions slot | component |
| | | **F — Data states and charts** | |
| 31 | 58 | Loading, empty and error states in a container | feature |
| 32 | 9b | A Data Viz header, for metrics and chart containers | component |
| 33 | 80 | Container and Data Viz headers: Figma's new button styling and grouping | component |
| 34 | 14 | An example of real-time data | feature |
| 35 | 59 | EXPLORE, later — Will's own loading pattern | explore |
| | | **G — Overlay panels** | |
| 36 | 22 | The `Ask N-zo` panel — wider, and resizable | feature |
| 37 | 23 | A focused grid row opens a details panel | feature |
| | | **H — The accessibility gate** | |
| 38 | 24 | Playwright tests accessibility — WCAG 2.1 AA | gate |
| | | **I — The big builds** | |
| 39 | 67 | A UTILITY layer: `sherpa-router`, on the Navigation API | feature |
| 40 | 68 | `sherpa-templater`: templates fetched and swapped live, out of `SherpaElement` | refactor |
| 41 | 27 | A consumer can supply their OWN templates and CSS | feature |
| 42 | 25 | `sherpa-layout-canvas` + minimap | component |
| 43 | 26 | A `Grouped` mode for the content area, and plain grid templates? | feature |
| | | **J — Tidy-ups and renames** | |
| 44 | 11 | `sherpa-group`: what is left | tidy |
| 45 | 28 | A Figma component is NOT always a web component | tidy |
| 46 | 30 | Do we still need `icon-paths.ts` and `render-icon.ts`? | tidy |
| 47 | 33 | Density as step offsets, and a breakpoint step | tokens |
| 48 | 36 | CSS: compiled where it should inherit? | tidy |
| 49 | 11d | `data-type` means nine things; `data-empty` means three | tidy |
| 50 | 84 | Use the platform: Intl for money, units and deltas; Temporal in the calendar | refactor |
| 51 | 81 | Component contracts move from YAML to JSON | refactor |
| 52 | 29 | Rename `src/index.ts` to `src/app.ts` — dead last | rename |
| | | **K — Agentic UI: much later** | |
| 53 | 76 | WebMCP: agents do UI tasks through Sherpa's own contracts — a core system | explore |
| 54 | 77 | CONTRACTED UX patterns, so a generated experience is consistent and useful | explore |
| 55 | 78 | A node-based WORKFLOW creator: make, edit and view patterns and generated workflows | explore |

**Why this order** (reassessed 2026-09-26).

- **A — the bugs that lie: all fixed 2026-09-26** (72, 44c, 42). A new one of these goes back to the top.
- **B — The foundation: design, then build.** Most of this session's bugs were ONE cause — a filter held in several places that disagree. Design the one compiled query (73), the view definition that bundles its defaults (70) and when Apply runs (62) as ONE design; then build 38 on it, with 66's shared footer. The filter features below all stand on it.
- **C — Contained bugs.** Each is fixable in its own component or page. 64 waits for the other session's accordion edits.
- **D — Filters: Will's features, on the foundation.** In dependency order: pending (46) before result counts (60); the read-only `fx` menu (49) before the editable one (50); the date range (20b) before date conditions (21d).
- **E — Views and navigation.** 15 writes 70's shape back.
- **F — Data states and charts.** 58 uses 62's debug flag to show its states.
- **H — The accessibility gate.** After the markup settles, before new components, so they must pass it.
- **I — The big builds.** 68 and 27 are one door.
- **J — Tidy-ups and renames.** 29 dead last: it touches every import.

---

## B — The foundation: design, then build

### `[~]` 73 — EXPLORE: one compiled QUERY, built as the reader sets it up, run on Apply

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

### `[ ]` 85 — `sherpa-provider`: a component ASKS for data, a scope, a query, a View or a template

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
filter is `data-readings`, and a View pick keeps it. **P3 is done:
`records.js` 1163 → 692 lines since P2 began, `dashboard.js` 331 → 225 (the
size gate's count, comments in).** **Next: P4**
— the View chip asks; the provider keeps the Views and the session Query.

### `[ ]` 86 — AUDIT: every component's functions and events — one request, one response, standardised in `SherpaElement`

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

### `[ ]` 89 — Every filter added to the panel starts SIMPLE

Will, 2026-09-27: *"Let's start all filters added to the panel in 'Simple'
mode."* Its content is one of three, by the field:

| the field has | Simple draws |
|---|---|
| 16 values or fewer | each value as its own chip — exploded |
| more than 16 values, or it is a date | ONE chip with a menu — a list, or a calendar menu for a date |
| numbers | a number input, or range slider inputs |

**16 replaces 47's 20** — one line for the bar and the panel, set once (the
builder's explode-or-menu flag, 38). Mode words: TODO 75.

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

### `[ ]` 91 — The APP SHELL switches Filter toolbar and Filter panel modes, for any View in the content area

Will, 2026-09-27: *"The app shell should be able to toggle between Filter
Toolbar and Filter Panel modes for any View that is showing in the content
area."*

Today Records wires it by hand: `togglePanel`, `setPanelMode`,
`syncPanelled`, the reopen and restore code, and the session's
`/filters/mode`. The shell already owns WHERE the panel sits
(`T-the-shell-owns-the-panel-areas`), so it owns the MODE too — for whatever
content it shows, with no page code. With provider P3c the panel asks for its
own scopes, so the shell needs only to open it.

### `[ ]` 92 — Navigating SETS UP the content — its definitions, data layer, filters and state — not only swaps the template

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

### `[ ]` 94 — A number (and range) filter menu needs Apply and Cancel buttons

Will, 2026-09-27: *"Numerical (and range) filter menus need apply/cancel
buttons."* A number is TYPED, so applying each keystroke filters on "1" on
the way to "150". Locally a PICK applies at once (Will's ruling on 62, "No
Apply locally"); a number body is the exception — it waits for Apply, and
Cancel puts back what was applied. The calendar's footer is the pattern, and
83 is its bug, so fix the two together.

### `[ ]` 95 — Firefox: a remote chip holding a draft is not marked pending

Found 2026-09-27 by the full Firefox run: `test/e2e/reforged-pending-chip.spec.ts:10`
fails in Firefox every time — after a tick in a remote chip's open menu, the
chip has no `data-pending`. Chromium and WebKit pass. Not the provider work:
the toolbar as committed before P3b fails the same way. Start at the menu's
`dirty` and the bar's `#queuePending` (TODO 46, `T-a-pending-chip-has-no-fill`).

### `[ ]` 70 — EXPLORE: a view definition bundles its filters; one JSON renders the page

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

### `[ ]` 74 — EXPLORE: the Query builds every group, sort and filter menu; a menu shows its sub-query

Will, 2026-09-27: *"The query language, and single query object, can be used
to construct group, sort, and filter menus both in their simple list
presentation mode and the conditional mode. It also allows us to expose the
sub-query, that defines the conditions, for any filter menu."*

So a menu is DRAWN from its field's slice of the Query — its values, its
picks, its rows — in either mode, and the bar, the panel and a heading stop
building their own. And any filter menu can SHOW the sub-query behind it: the
conditions it compiles to, readable, perhaps editable. Explore with 49 and 50
(a conditional chip shows its conditions), which are this seen from a chip.

**No query LANGUAGE — JSON.** Will, 2026-09-27: *"I don't think we should
construct a query language for it. We're probably best served using JSON. As
long as the whole situation is captured and can be recreated then we're
good."* The sub-query IS the field's slice of the Query — its `FieldReading`,
condition rows and all — shown and saved as JSON, and restored by
`setQuery`. No grammar, no parser, no second spelling of a condition.

### `[ ]` 75 — Filter modes are SIMPLE and ADVANCED, not Default and Conditional — every file

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

**Left from 44c:** a heading that ALREADY held its own filter when the View
took its field keeps applying it — one field in one scope says it should be
suspended, as a chip is (`T-a-view-held-heading-shows-and-refuses`). **The
pattern behind 44b and 44c** — two controls holding one field and disagreeing,
in the glue `records.js` carries by hand. Fix it at its
cause: MOVE the state into the source rather than patching the glue. The bug
fix and this step are then the same commit.

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

## C — Contained bugs

### `[ ]` 64 — A collapsed accordion section fills with the down (+2) surface

Will, 2026-09-26: a COLLAPSED `sherpa-accordion` section takes the Style
surface's DOWN step — `base +2`, `--sherpa-style-surface-base-2` — as its
background fill. (base / +1 / +2 are default / hover / down.) Bind the Style
name, never a Theme colour: a state is the mode's own step. Open sections keep
today's fill. **Wait for the other session**: `sherpa-accordion.css` has its
uncommitted edits in the working tree.

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

---

## D — Filters: Will's features, on the foundation

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
dropdown of its values, not one chip per value. **89 moves the line to 16**, for the bar
and the panel alike. It is the flag 38's builder
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
or SURVIVE it. The View chip is neither; it IS the thing that changed. **The
default is built** (56, 2026-09-26): `onViewPicked` resets the reporting bar
before a view applies (`T-a-view-change-resets-the-header-chips`). What is
left is the flag: `clearAll()` skips a chip that SURVIVES, and its part stays
applied through `setState`, which clears every part today.

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

A legend toggle IS a filter (42, done: `only` narrows one component), so a chart could have its own component
scope in the panel. It may want chips for its AXES or its AGGREGATION, the way
the grid has Group and Sort. Larger; design first. After 42, and after 38
step 3, which puts scopes in the data layer.

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
23 lines of the page touching the URL. Nothing in `src/` routes.

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
| `examples/contexts/records.js` `money()` | `` `$${Math.round(n).toLocaleString('en-GB')}` `` | `Intl.NumberFormat` currency |
| `sherpa-file-upload.ts` | `` `${(bytes / 1048576).toFixed(1)} MB` `` | `Intl.NumberFormat` unit `megabyte` |
| `sherpa-metric.ts` | the delta rounded with `toFixed(2)` | `Intl.NumberFormat` percent, `signDisplay` |
| `global-filters.js`, `records.js` | ISO days and months built with `padStart` | `Temporal.PlainDate` / `PlainYearMonth` (examples run in a browser) |
| `sherpa-calendar.ts` | ten `Date` sites of day maths | `Temporal` — a component only runs in a browser |

The DOM-free data layer stays off `Temporal` and `Math.sumPrecise` until Node
has them. Step 8 of the Query is where formats arrive as `Intl` options in
JSON, so do the metric and money there.

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

**2026-09-27, the provider (85)**
- 93: a grid-scope filter narrowed the charts and tiles too — only the View trickles down now; a summary is under the View alone — `T-only-the-view-trickles-down`
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
