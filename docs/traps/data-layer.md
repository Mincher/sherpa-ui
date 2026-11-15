# Traps — The data layer

One of the eleven areas of [the traps](../TRAPS.md): each entry is here because its
first `Site:` is in this area (`npm run check:traps` holds it so). 202 entries.

### T-no-op-load-guard

Twenty filter writes with the SAME value cost the same **667ms** as twenty real
ones, and produced **120 populates across six bound components** for zero change
on screen.

The guard compares the rows array by identity. A store that mutated its rows in
place would defeat it — which is why `ArrayStore` copies (`[...rows]`) rather
than sorting the caller's array. That is a cross-module contract recorded
nowhere else.

- Site: `src/core/data/source-binding.ts`
- Site: `src/core/data/source-reads.ts`

### T-schema-sample-cost

A read schema costs real time on a bulk load: **10,000 rows 6ms, 100,000 rows
56ms**, about 23× an unguarded load, scaling linearly.

Sampling checks the first N rows, because a backend's rows are wrong in a SHAPE,
not one at a time. But rows beyond the sample pass **UNCHECKED**, so a schema
that RENAMES or COERCES must **not** be sampled — the two halves of one response
would disagree. Sample only when the schema purely VALIDATES.

Writes are always checked in full.

- Site: `src/core/data/base-store.ts`

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

The tip is the shared one (`T-a-tip-lives-in-the-top-layer`, TODO 364), after
both its buttons, which are its anchors. CSS names the WHOLE chip as the place
it points to; a SECTION names its header, so its value chips never open it
(Will, TODO 437: *"The section tooltip should only show when hovering over the
section header"*) — a section has no caret to hover.

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
- Site: `src/components/sherpa-quick-filter/sherpa-quick-filter.css`
- Site: `test/e2e/reforged-chip-tips.spec.ts`
- Site: `test/unit/filter-face.test.mjs`
- Site: `src/components/sherpa-quick-filter/chip-answer.ts`
- Site: `src/components/sherpa-quick-filter/chip-says.ts`

### T-a-suspended-answer-is-drawn-as-off

**A chip switched OFF keeps its answer and applies none of it — and the source
DRAWS that, with `suspended: true`.** Skipping a suspended field when drawing
leaves only the pressed chip knowing: every other view goes on showing
`Status: active` while no row is filtered by it. So a bar draws the answer and
then switches the chip off (the toolbar's `paint` for its
`FilterHostController`). The Query keeps the value, for the chip.

- Site: `test/unit/query.test.mjs`
- Site: `src/core/data/source-view.ts`

### T-a-container-shows-its-datas-state

**A container shows what its DATA is doing, in place of its body** — Will,
TODO 58: loading (a spinner and "Loading…"), no data (the data illustration),
and an error (its own words, Retry as the CTA because it resolves it, Dismiss
as a plain button). Each has a DEFAULT, composed from `sherpa-loader`,
`sherpa-empty-state` and `sherpa-button`, shown by `data-state` (or
`data-loading`); a slotted state still replaces its default. Loading wins over
the rest. Retry is a REQUEST (`data-refresh`); Dismiss is the card's own — its
overlay goes, the last data stays.

**No MATCHES covers nothing** — Will, 2026-10-20 (359). `data-state="no-matches"`
is still written, and "no data" and "no matches" are still two states (a filter
that matched nothing is not an empty table,
`sherpa-a-zero-row-view-reads-as-a-broken-filter`). But the card's own filters
made it, and must stay in reach: a filter whose every pick is ruled out stays
active at 0 (`T-a-ruled-out-value-is-greyed`), and a cover over the card hid
that chip. The rows say it instead — a grid's "No rows match the current
filters." The old cover's Clear filters, and its `filters-clear`, are gone.

**The PROVIDER draws it, so no page writes it.** It watches each source's
`loading`, `change` and `error` — BEFORE it answers anyone, as an answer
binds and a bind starts the first load — and writes the card of every
component it answers. Loading shows only after 300 ms, so a quick load never
flashes. **A page OPENING is a load too** (TODO 343): `openSource()` reads a
remote store's whole set before the provider holds the source, so no
`loading` event reaches it. So `open()` marks every data card itself after
300 ms, and when the page is provided hands the cards the source draws to its
own loading; the rest are cleared. A page left while it opens ends at once,
so its timer never marks the next page's cards. Loading and a failure reach every data component's card; empty and
no matches a ROWS component's only, as a chart under the View alone still has
its rows. It answers `data-refresh` (a card's Retry, a bar's Refresh) with a
forced load. A store that cannot
answer at `openSource()` no longer stops the page: `declareFromRows` reports
`values-unread`, and the first load shows the failure on its card.

**KEEP THE CONTENT is the second look** — Will's own, TODO 59, a trial in
Settings › Experiments. The provider's `data-keep-content` goes onto every
card it draws a state on. Then nothing replaces the body: loading is an
indeterminate bar along the header's bottom edge, and the body takes no
pointer; a failure or no data is a `sherpa-callout` banner above the body,
with the same Retry and Dismiss. NO MATCHES HAS NO BANNER — Will, 2026-10-17,
TODO 342: he never asked for one, and the kept grid says it has no rows. The
overlay never shows. Its own buttons,
not the callout's close: a callout REMOVES itself on dismiss, and the next
failure would have no banner.

- Site: `src/components/sherpa-container/sherpa-container.ts`
- Site: `src/components/sherpa-container/sherpa-container.html`
- Site: `src/components/sherpa-container/sherpa-container.css`
- Site: `test/e2e/reforged-container.spec.ts`
- Site: `test/e2e/reforged-provider-opening.spec.ts`
- Site: `src/components/sherpa-provider/sherpa-provider.ts`
- Site: `src/core/data/field-catalogue.ts`
- Site: `src/components/sherpa-provider/provider-cards.ts`
- Site: `src/core/data/source-reads.ts`

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
- Site: `test/unit/page-definition.test.mjs`
- Site: `test/e2e/reforged-calendar.spec.ts`
- Site: `src/core/data/data-source-types.ts`

### T-a-field-can-carry-over-views

**A header chip resets on a View change unless the View sets it — or unless
its field CARRIES OVER** (Will, TODO 21b: *"which chips carry over should be
CONFIGURABLE"*). `carryOver: true` in a field's declaration (the page JSON
takes it) keeps its answer through a View that does not answer it; a View
that does answer it wins. Two paths honour it: a JSON View (`setQuery` with
`holds: 'keep'`, in `definitionOf()`) and a View with no Query (`clearAll({
carry: true })`). A RESTORE
is exact, and Reset still clears everything: only a View change carries.
Nothing on Records carries over yet — the default is Will's.

- Site: `src/components/sherpa-quick-filter-toolbar/sherpa-quick-filter-toolbar.ts`
- Site: `src/core/browser/persist-view.ts`
- Site: `test/unit/page-definition.test.mjs`
- Site: `test/e2e/reforged-carry-over.spec.ts`
- Site: `src/core/ui/filter-def.ts`
- Site: `src/core/data/data-source-types.ts`
- Site: `src/core/data/query-edits.ts`
- Site: `src/core/data/query-members.ts`

### T-send-to-view-filters

**"Send to view filters" raises a component's field to the View** — Will, TODO
21f: beside Clear in a component scope's field header in the panel (the View's
own fields have none). It is the panel's ordinary `filter-add` request, with
the View's scope: the View HOLDS the field, its answer goes with it
(`rehome()`), and the chip below keeps its place, suspended, saying where its
filter went (`T-up-is-open-down-is-closed`). So the rows do not move, and the
header gets ONE chip — the View's Add list stops offering it.

**And down** — Will, TODO 120: a View field has "Send to `<scope name>`",
with a down arrow, in the same button group. It is the same request the
other way — `{ scope: <the scope>, ids, from: 'view' }` — and the View LETS
GO: the field is held below first, so its answer moves there and is not
cleared. EVERY OTHER scope below lets go of it before that (168): a scope the
field came up from kept its place, so the field showed there again as it
landed elsewhere, and the answer could re-home to either. A filter is in ONE
scope at a time. What a scope KEPT from before the field went up is dropped
first, so the View's answer moves down whole — its mode and its rows. (The bar
below used to report its old one as it was freed, which put a filter sent
down in Advanced back to Simple; the kept answer is the Query's now, 366
step 19.)

**ONE Send to** (Will, TODO 346: *"We only need 1 'Send to ComponentName'
option … No need to cater for all possible routing"*). The SOURCE names it
(`describe('view')` → `sendTo`, one object), never the panel: the scope the
field came UP from, while that scope still has it; else the FIRST scope that
has it — a component's offer, in the page definition's order, then a chart's
own. The button sends it and says where. (TODO 158 once offered a menu of every
scope; 346 took it out.)

**The scope it came UP from is a RETURN** (Will, 2026-10-12, TODO 234). The
source marks `sendTo` with `origin`, and the panel words it "Return X to Y".
The source keeps it IN the Query — the View scope's `from` — so the kept Query
and a View's draft carry it through a reload (TODO 235); sent back down, it is
forgotten. `take()` and the `filter-add` request still take ANY scope, so a
caller with no pointer can send a field anywhere, and the 168 rule holds.

**The toolbar MOVES too** — Will, TODO 425 G1, G4, 450: in toolbar mode a
chip's menu has a ROW above its footer, "Move to View Context" (or "Move to /
Return to <scope>" on a View chip), in the menu's `actions` slot; a portrait
section says it in its ⋮. It was a footer button until TODO 450 — and never
drawn: the FILTER menu template had no `footer` slot, so the button had
nowhere to go. A menu row says `menu-select { value: 'move' }` from the MENU,
so its path holds no `.move`. A bar sends the same request,
`filter-add { scope, ids, from }`: bindSource reads a `filter-add` carrying
`from` as a request whatever the bar's own scope.

**Offering it is the app's choice**, off by default: `provider.moveFilters` → `data-move-filters`, Will, TODO 587. Off, `#moveLabel` says nothing, so neither a chip's menu nor a section's ⋮ has the row. Edit filters still adds a field at another scope.

- Site: `test/unit/send-down.test.mjs`
- Site: `src/core/data/query.ts`
- Site: `src/core/ui/filter-def.ts`
- Site: `src/core/ui/bind-source.ts`
- Site: `src/core/data/data-source-types.ts`
- Site: `src/core/data/query-edits.ts`
- Site: `src/components/sherpa-quick-filter-toolbar/sherpa-quick-filter-toolbar.ts`
- Site: `src/components/sherpa-quick-filter-toolbar/toolbar-rows.html`
- Site: `src/core/data/source-view.ts`

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
- Site: `src/core/ui/mark-text.ts`
- Site: `src/components/sherpa-data-grid/grid-cells.ts`
- Site: `test/e2e/reforged-filter-conditions.spec.ts`

### T-a-chip-counts-within-the-filters-before-it

**A chip's badge is the number of rows that REACH it and match its answer** —
Will, TODO 348: *"they should show the count of matches from the filtered
subset. So scopes and preceding filters will affect this."* The rows reach it
through its scopes — the parts and the page's own scopes, then the View for a
component chip, then a chart part's host — and every filter BEFORE it in the
one order (`T-one-walk-counts-and-limits-in-order`): saved filters, then
fields, each set together. So along a bar a count never rises, and the last
chip in force counts the rows the page shows. (Until TODO 348 a chip counted
its OWN answer within its scope — Will, TODO 60 — and the chips before it did
not count.) Not the whole filter's total on every chip, and no longer a count
of picks or `fx` (the tip says those). `source.results(scope)` reads the
APPLIED Query's walk, and draws each scope-bound bar (`drawResults`); a later
walk wins. A chip never told its results, and with no menu, leaves `data-count`
to its host.

**ON OR OFF** — Will, TODO 123: a chip switched off keeps its badge, and only
one with no values and no conditions has none. So the source counts a FIELD's
answer that is off too — what it WOULD match. A SAVED filter is counted only
while it is on (166): its count is not always known before it runs. Pending
still shows none (46): a draft has no results yet. The TIP says the same on or off — its answer and its matches (Will, 363):
on or off has no bearing on whether it shows.

**An off answer that changes moves no rows, so no load follows** — and the
count was only ever drawn after a load. Emptied, the chip kept its old
number. `#recompose` draws the results itself when the SHARED filter stood
still and the applied Query did not — a chart's own answer is the same case.

**In the panel, a field's HEADER wears it** — Will, TODO 133: a field drawn
as a run of chips, or as a body, has no one chip to carry the number, so its
badge sits right of the title. A chart's own scope is counted too. The panel
KEEPS each scope's last results and draws them again after a redraw: a redraw
builds new headers and chips, and no load follows it.

**A SHUT section says the rows its filters LEAVE** — the walk's `ends`, drawn
as `drawResults`' `end` while a filter there is in force; none in force, no
badge. Never the last chip's count: that chip may be OFF, and an off chip
counts what it WOULD match (TODO 523 F2). Step by step, a scope ends with its
last step in force's count, so no request is added for it.

**In the panel, each PICKED value chip wears its own count** — Will, TODO
172: *"For multi value filters in the filter panel each chip should show
their own count badge."* A field drawn as a run has no one chip, so its
header wears the field's count (133); each picked chip now wears the rows
that ONE value matches, within what its scope can see
(`source.valueResults(scope)`, by field then value, drawn by
`drawValueResults`). A chip that is not picked wears none, as a saved filter
that is off wears none (166). Only a list answer in force has values: rows,
a range, a field that is off or held above have none. The one value is
counted with NO list beside it: its own clause, whatever the field's list.

**The header is ONE count, never a sum** — TODO 173. It counts the rows ANY of
the field's values match, once each. A row holds one value of a field, so for
picked values it equals the sum of the chips; two conditions that match the
same row count that row once.

**A count runs again only when something it reads moved** (TODO 348 W1). ONE
walk per key — the applied Query, the setting, the parts, the bound scopes,
what each scope offers, and an AGE the source moves whenever the rows, a
field's facts or values, a saved filter, a part or a set may have changed (a
store `change` too, patched or not). A sort, a page or a search moves none of
these, so it counts nothing. On the bench, counts fell to 0 on every act: the
walk reads the rows once (`scan`, the held set, or one load) and passes over
them once per scope that counts.

- Site: `test/unit/a-field-counts-unique-rows.test.mjs`
- Site: `test/unit/a-count-runs-again-only-when-something-moved.test.mjs`
- Site: `src/core/data/data-source.ts`
- Site: `src/components/sherpa-quick-filter/sherpa-quick-filter.ts`
- Site: `src/components/sherpa-quick-filter-toolbar/sherpa-quick-filter-toolbar.ts`
- Site: `test/unit/page-definition.test.mjs`
- Site: `test/e2e/reforged-chip-results.spec.ts`
- Site: `test/unit/a-chip-counts-within-the-filters-before-it.test.mjs`
- Site: `src/core/ui/filter-host-controller.ts`
- Site: `src/core/data/source-walk.ts`
- Site: `src/components/sherpa-quick-filter/chip-says.ts`
- Site: `test/e2e/reforged-select-all-is-every-value.spec.ts`

### T-a-scope-says-what-it-shows

**A scope names the component its filters narrow, by its TAG** —
`describe(scope).component`, the first bind drawn rows in that scope. The
filter panel column says it under the scope's name ("Bar Chart", "Data Grid";
TODO 457) and wears no icon (Will, TODO 472). The TAG is the SINK's to say:
`bindSource` gives `BindSink.name()`, read live, so a chart Show as swapped is
named anew, and the data layer reads no element's tag (plan 695 P6).

**The data layer knows no KIND of component** (Will, TODO 341, 2 A). A
`shows: 'grid' | 'chart' | …` once went from each component's ask through
`bindSource()` into `describe()`; nothing read it after the classic panel and
its icons went, so it was removed outright. A bind says only data shapes:
`rows`, `steerOnly`, `scope`, `part`.

- Site: `src/core/data/source-binding.ts`
- Site: `test/unit/page-definition.test.mjs`
- Site: `src/core/data/data-source-types.ts`
- Site: `src/core/ui/bind-source.ts`

### T-a-filter-set-groups-or-chains

**A filter SET is fields a scope draws as one group** — Will, TODO 99. It is
in the page definition, `"sets": [{ "id", "label", "mode", "fields" }]` on a
scope, so the markup and the definition say one thing. `parallel`, the
default, only groups. `serial` CHAINS: each field below the top offers only
the values the rows hold at its place — under its scopes and every filter
BEFORE it in the one order, once anything before it narrows (Will, Q2 A, TODO
349) — never one after it. A component scope's chain starts inside the View.
The TOP is never cut: Limit greys it, or the View for a component scope. Every
filter is parallel without a set, as before.

`source.offered(scope)` says what each chained field offers, and a bound
control is told it (`drawOffered`). A value the chain does not offer is
REMOVED — serial exists to offer less, and the way back is the field above —
and a PICK it rules out is let go (`T-a-ruled-out-value-is-greyed`, Will,
TODO 512 A): out of the rows at once, then out of the Query. This runs whatever
Limit says. The source gathers a set's fields in `describe()`, in the one order
(`T-one-walk-counts-and-limits-in-order`).

**A set is only an ORDER on screen** — Will, TODO 240 and 241: *"I don't
like the 'Account' and link icon before Customer and Region filters in the
toolbar. I also don't like the nesting"*, then *"Don't group Customer and
Region filter chips in the toolbar."* The bar draws a set's chips together,
in the set's order, where its first stands — plain chips, not joined, with no
heading and no mark. The panel orders a set's fields the same way, with no
box. The chain is the data's alone. The source hands each its sets in
`describe()`; the provider gives the bar them before it fills it.

A field is in ONE set of a scope: `declareSets` keeps the first and reports
the second (`field-in-two-sets`). A set names fields the scope HOLDS;
`openSource` reports one it does not (`set-field-not-held`), as the reader
may still add it.

- Site: `src/core/data/data-source.ts`
- Site: `src/core/data/page-definition.ts`
- Site: `test/unit/page-definition.test.mjs`
- Site: `src/components/sherpa-quick-filter-toolbar/sherpa-quick-filter-toolbar.ts`
- Site: `src/components/sherpa-menu/sherpa-menu.ts`
- Site: `src/components/sherpa-menu/sherpa-menu.css`
- Site: `src/components/sherpa-menu/menu-list.ts`
- Site: `test/unit/a-serial-set-chains-its-fields.test.mjs`
- Site: `test/e2e/reforged-serial-set.spec.ts`
- Site: `test/e2e/reforged-filterset.spec.ts`
- Site: `src/core/data/data-source-types.ts`
- Site: `src/components/sherpa-provider/provider-page.ts`
- Site: `src/components/sherpa-data-grid/sherpa-data-grid.ts`
- Site: `src/core/data/query-context.ts`
- Site: `src/core/data/source-walk.ts`
- Site: `src/core/data/query-declarations.ts`

### T-one-walk-counts-and-limits-in-order

TODOs 347–349 — Will: a chip counts its matches *"from the filtered subset. So
scopes and preceding filters will affect this"*, and *"the above also goes for
viable field and value options in menus"*; the View first, a component scope
within it. Rulings D1–D5 A, Q1 A, Q2 A (`docs/history/plan-347-349-walk.md`).

**One order** (`answerOrder`): the fields a scope holds, each filter set
gathered where its first held field stands; then a reading no chip holds. A
saved filter is no step: taken, it is the field chips it fills (366). A serial set's held fields that
the View does not hold are its chain: the first is its top, the rest below.

**One plan** (`planWalk`), from the APPLIED Query: the View first, from every row,
behind a base step of the page's own scopes; then
each other scope from the View's end; then each chart part from its host's. A
step counts the rows that REACH it and match its answer — OFF counts and narrows
nothing (123); each plain pick counts its own (172). A list field is RULED — what greys it and sets its picks aside —
by the rows at its place with Limit on; with Limit off, a component scope's by
the View's end (347), the View's by nothing (D5 A). A chain's lower field offers
only what the rows at its place hold, once anything before it narrows (Q2 A). A
list field no chip holds is TAPPED where it would stand; one with no value left
is SPENT.

**One pass** (`walkInOrder`, `walk.ts`): each row runs the steps in order and
stops at the first in force it fails. A pick its ruler rules out is set aside,
and the rows from that step are scanned AGAIN with what is left — unless EVERY
pick is ruled out: then it stays in force, and counts 0
(`T-a-ruled-out-value-is-greyed`) — exact,
whatever loose matching (`in`, `T-loose-equal-is-case-insensitive`) does. Dates
are made absolute once, at the plan's `now`. A chart part's pick is never set
aside (Q1 A).

**A set not held** is asked step by step (`walkStepwise`): the same plan, as
`presentUnder` and `totalCount` requests. The property test holds all three —
the walk, a plain walk, and step by step — to one answer.

**Under change** (the review of C5 and C6): a walk the Query moved past while it
ran sets nothing aside — the walk for what stands now decides. A store change
walks again only when it moved a field the walk reads, or the rows
(`T-a-change-redoes-only-what-reads-it`).
A walk that FAILS sets nothing aside, keeps the last one drawn, and is kept for
its key: it is asked again when something moves — a filter, ANY store change, a
Refresh, a reach recheck — never on a page turn, so a failing server is not
asked again and again. A closed source walks nothing. The rows a source loaded
to declare its fields are the walk's too (IndexedDB has no `scan`). Asked step
by step, the tallies one filter shares are ONE request, the requests go
together, and a failure fails the walk with no rejection unheard.

**A step tests a row only while it is on or counts** (345 phase 3). `walkReads(plan)` names
the fields each scope tests and tallies: a change to any other field leaves the
walk as it is (`test/unit/a-walk-reads-only-what-it-names.test.mjs`, over Limit
on and off, a part, a hand filter, a chart part and a component's own scope).

**A tiered field is tallied at both tiers** (TODO 369). A step or tap on
Customer adds each row's Customer key AND its Customer–Site path key, written as
`valueKey` writes the pair with no object per row, so a site greys, counts and is
set aside as a customer is; `walkReads` names the child, so an edit to a site
alone walks again. Step by step a store tallies one field at a time and has no
pairs: there a path is present while its customer is, so it is never set aside
unless its customer is — the loose side, as a recheck must be
(`test/unit/a-tiered-field-counts-at-both-tiers.test.mjs`).

**The controls draw the same order.** `describe()` gives a scope's filters in it,
and a bar's `drawScope` puts its chips in it — the View chip and a chip that
answers no field stay first; a field added lands at the end.

- Site: `src/core/data/walk.ts`
- Site: `src/core/data/source-counts.ts`
- Site: `test/unit/a-walk-reads-only-what-it-names.test.mjs`
- Site: `test/unit/filters-limit-in-order.test.mjs`
- Site: `src/core/data/data-source.ts`
- Site: `src/components/sherpa-quick-filter-toolbar/sherpa-quick-filter-toolbar.ts`
- Site: `test/unit/page-definition.test.mjs`
- Site: `test/e2e/reforged-filterset.spec.ts`
- Site: `src/core/data/store.ts`
- Site: `test/unit/a-store-scan-reads-in-place.test.mjs`
- Site: `scripts/check-bench.mjs`
- Site: `test/unit/the-walk-holds-under-change.test.mjs`
- Site: `test/unit/an-advanced-answer-limits-what-follows.test.mjs`
- Site: `test/unit/a-tiered-field-counts-at-both-tiers.test.mjs`
- Site: `src/core/data/source-reads.ts`
- Site: `src/core/data/source-view.ts`
- Site: `src/core/data/source-walk.ts`

### T-reset-to-default-is-the-views-own

**Reset puts every filter back to ITS own default; Reset to default puts the
page back as the View on screen DEFINES it** — Will, TODO 109. Only the
provider knows that: the View's bar and the panel send `view-reset` (an intent)
from their "Reset to view defaults" row — a local bar has none (`resetRows`, Will,
TODO 524) — and `provider.resetView()` answers
— the page's first Query (kept at `open()`, before any kept one), then the
View's Query as a pick puts it on. So a filter the reader ADDED since goes, as
it is not the View's. A page may call `resetView()` itself. Both Resets, and
Save filters, are the filter TOOLBAR's ⋮ rows, first (Will, TODO 430), so its
⋮ always shows; the legacy panel still leads its Filters menu with them
(`drawFilterActions`, TODO 383). The Reset group is gone.

**The row reads "Reset to view defaults", and the ask is CANCELABLE** — Will,
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

**Neither Reset is offered where it would change nothing** (Will, 2026-10-12,
TODO 231). After every load and every scope change, the provider asks its
source — `atDefault(initial, view.query)`: what filters now, WHICH filters
each scope holds (one taken off, or moved, is a change — Will), and how the
rows are arranged — a sort the reader set since is a change, and Reset to
default clears it, as it is in the Query (366 step 8) — against
the page as defined with the View's own Query over it, compiled so the same
filter always reads the same; and `answered(scope)`: a reading that filters, a
saved filter on, the rows arranged. It sets `data-at-default` and
`data-nothing-to-reset` on each bar and panel, and their Reset rows follow
(a toolbar's ⋮ reads both as it opens). Asking applies nothing: the Query builder no longer arranges the rows
as it goes — `setQuery` applies what it returns.

**Nor is a Save** (Will, TODO 382): Save and the ⋮'s Save filters… are off while
`data-at-default` — the filters ARE the View's own, so a save would keep nothing
new. Save follows the attribute as it changes; the ⋮ reads it as it draws.

- Site: `src/components/sherpa-provider/sherpa-provider.ts`
- Site: `src/components/sherpa-quick-filter-toolbar/sherpa-quick-filter-toolbar.ts`
- Site: `test/e2e/reforged-reset-to-default.spec.ts`
- Site: `src/core/data/data-source.ts`
- Site: `test/e2e/reforged-reset-at-default.spec.ts`
- Site: `test/unit/query.test.mjs`
- Site: `src/components/sherpa-provider/provider-page.ts`
- Site: `src/components/sherpa-quick-filter-toolbar/toolbar-header.ts`
- Site: `test/unit/a-reset-is-offered-for-its-own-scopes.test.mjs`
- Site: `src/core/data/query-context.ts`

### T-a-relative-date-stays-relative

**"In the last 7 days" is kept RELATIVE** — TODO 21d, built in 90. A clause
is `[field, 'last', { n: 7, unit: 'day' }]`, and `next` the same forward, so a
saved View's `where` reads `{ "last": 7 }` and means the last seven days on
the day it is OPENED. Compiled to dates at once, it would freeze on the day
it was saved — and `whereOf` writes a View from the compiled clause, so the
freeze would be silent.

They are worked out when MATCHED: `filterTest` turns one into the
`between` it means today (`absoluteDates`) as it makes the filter's test —
once per pass over the rows, never per row (TODO 291) — in whole UTC days as a date
reads, with the last day's end so a value with a time still falls inside.
A `RestStore` sends the `between`, so a server never meets `last` or `next`.

**N units, today among them** (Will, A, TODO 716). `last 7 days` is today and
the six before it; `last 1 month` from 4 Nov is 5 Oct to 4 Nov; `next 2 weeks`
ends the day before the same weekday two weeks on. It kept N+1 days once — the
far end counted as well as today — while the time axis drew N segments, so the
first point held two days. A chart's range is `durationSpan`'s own (`rangeOf`),
so the filter and the axis cannot part again.

A field that holds TIMES (`time: true`) takes a day alone as all of it:
On is that day's span, After is after its end — and a MINUTE as all of that
minute, and the end of Between as the end of its last day or minute (TODO
112). Before is before the start; a value with its seconds is exact.

**In a menu**, a date that opts in (`advanced: true`) is a FILTER menu, as an
Advanced number is: the calendar stays its Simple body, and its rows ask On,
Before, After, Between, In the last and In the next — a day box (and a time
box with `data-time`), two for Between, a count and a unit. Its host
attributes stay the calendar's, never row one's. The switch carries the
calendar's day over as On, two days as Between.

- Site: `src/core/data/store.ts`
- Site: `src/core/data/stores.ts`
- Site: `src/core/data/filter-state.ts`
- Site: `src/core/data/where.ts`
- Site: `test/unit/date-conditions.test.mjs`
- Site: `test/e2e/reforged-date-conditions.spec.ts`

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
- Site: `test/e2e/reforged-data-grid.spec.ts`
- Site: `src/core/data/format-value.ts`

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
- Site: `src/core/data/held-set.ts`
- Site: `src/data.ts`
- Site: `src/components/sherpa-data-grid/sherpa-data-grid.ts`
- Site: `test/unit/a-keyless-row-gets-a-key.test.mjs`
- Site: `test/e2e/reforged-a-keyless-row-selects-by-key.spec.ts`
- Site: `src/components/sherpa-data-grid/grid-selection.ts`

### T-both-answers-are-kept

**A reading keeps BOTH answers, and `mode` says which one filters.** Will,
2026-09-29 (TODO 102): *"Both simple and advanced mode conditions need to be
tracked and stored to allow switching at any point."* The picks — and a typed
`op` / `text` from a number body — are Simple's answer; the `tree` is
Advanced's. `fieldState()` compiles only the one in force, so a switch
changes what filters and loses nothing.

A reading with no `mode` is read by `modeOf`: the tree wins where it answers. A
saved View or filter from before both were kept still means what it meant.

`mirror` says the rows are still a copy of the picks: the first switch carries
X and Y over as `Equals X` OR `Equals Y`, and a change to the picks redraws
them — until the reader edits a row.

`answerOf()` in query.ts copies a reading through `READING_KEYS`, which names
every key of `FieldReading`: a key added to the type and not the list is a type
error.

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

A list's other ops are conditions: `treeReading()` reads "is not churned" as
the Advanced tree, and its value is NOT also ticked as Simple's answer —
ticking churned would filter for the opposite. A
number chip reads its body's reading whatever its menu's type, or "> 2"
filtered and its face stayed blank (TODO 82). And on a rebuild the READER'S kept answer wins over the def's opening
one, or a def's typed condition came back on every rebuild.


**A switch of mode is judged by the answer in force** (`sameAnswer`, Will, TODO 593): rows carried over from the picks say what the picks say, so a switch alone asks no Apply and marks nothing pending. Rows that say something else still ask.

- Site: `test/unit/a-mode-switch-asks-no-apply.test.mjs`
- Site: `src/core/data/filter-state.ts`
- Site: `src/core/data/query.ts`
- Site: `test/unit/both-answers-are-kept.test.mjs`
- Site: `src/components/sherpa-menu/sherpa-menu.ts`
- Site: `test/e2e/reforged-menu-keeps-both-answers.spec.ts`
- Site: `src/core/data/filter-face.ts`
- Site: `test/e2e/reforged-filter-conditions.spec.ts`
- Site: `src/components/sherpa-data-grid/sherpa-data-grid.ts`
- Site: `test/e2e/reforged-grid-keeps-both-answers.spec.ts`
- Site: `src/components/sherpa-data-grid/grid-filters.ts`
- Site: `src/components/sherpa-quick-filter/chip-answer.ts`

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

Both chips derive their column from their menu's ticked radio: `arrangeBy`
names `data-column`, then ticks the radio, and `ChipArrange.draw` draws the caret.

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

- Site: `src/core/ui/filter-host.ts`
- Site: `src/core/data/cycle.ts`
- Site: `src/components/sherpa-data-grid/sherpa-data-grid.ts`
- Site: `src/components/sherpa-quick-filter/chip-arrange.ts`
- Site: `src/components/sherpa-quick-filter/chip-press.ts`

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

### T-signal-not-a-teardown-list

`bind({ signal })` unbinds when the signal aborts — the PLATFORM'S OWN teardown
token, so there is one thing to abort rather than a list of functions to
remember.

```js
const ac = new AbortController();
bindSource(source, chart, { readonly: true, signal: ac.signal });
bindSource(source, grid,  { signal: ac.signal });
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

The same token is reused by the keeper's `keepUi` and `onViewPicked`, so one
controller tears down every binding, listener and keeper a view made.

- Site: `src/core/browser/persist-view.ts`
- Site: `src/core/ui/bind-source.ts`
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
`SourceBinding.push` therefore writes every attribute BEFORE it returns early for a
steer-only bind.

- Site: `src/core/data/data-source-types.ts`
- Site: `src/core/data/source-binding.ts`

### T-adapter-lives-at-the-binding

`as` reshapes the rows before they reach ONE component.

Components ask for different shapes: a chart wants `[{ label, value }]`, the data
grid wants `{ columns, rows }`. Forcing one shape on every component would mean
changing 21 of them, so the ADAPTER lives at the binding, where the mismatch
actually is.

```js
bindSource(source, grid,  { as: (rows) => ({ columns, rows }) });
bindSource(source, chart, { as: (rows) => rows.map(toSlice) });
```

It also receives the source, so an adapter can read the total or the state — a
"N of M" summary needs both.

This is why the no-op push guard compares the ROWS ARRAY and never the adapted
payload: an `as` adapter builds a new object every call, so comparing its output
would never match. See `T-no-op-load-guard`.

- Site: `src/core/ui/bind-source.ts`
- Site: `src/core/data/source-binding.ts`

### T-in-flight-ticket-discards-stale

A source is steered by controls a person can use quickly — three filter chips in
a second — and each change starts a load. `#inFlight` is a `Latest` from
`timing.ts`, which holds a ticket for the LATEST one so a slower earlier response is DISCARDED rather than overwriting
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
shortcut is `key === #lastLoadKey && #loaded && !#inFlight.busy` now;
`test/unit/a-request-back-to-the-last-answer-still-runs.test.mjs` gates a load
back to the last answer, and that a true no-op still skips.

- Site: `test/unit/a-request-back-to-the-last-answer-still-runs.test.mjs`
- Site: `src/core/data/timing.ts`
- Site: `src/core/data/source-reads.ts`

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

**So the APP chooses one** — Will, TODO 107: `applyOn: 'input'` with
`debounce` ms, per source, in its page JSON. Its filters apply while a value
moves, and the source loads once the moves stop. The default stays the
microtask. A remote source is never live: it already waits for Apply.

`load()` stays immediate and public: a caller that awaits it means it.

- Site: `test/unit/a-live-filter-waits-for-the-moves-to-stop.test.mjs`
- Site: `test/e2e/reforged-number-filter-reports.spec.ts`
- Site: `src/core/data/data-source-types.ts`
- Site: `src/core/data/timing.ts`
- Site: `src/core/data/source-reads.ts`

### T-push-writes-state-as-attributes

`SourceBinding.push` hands the view state to the binder, which writes it as ATTRIBUTES.
That is what makes a shared sort visible without a JS branch anywhere: the
grid's header arrow is drawn from `data-sort-field` / `data-sort-direction` in
CSS, so writing them makes the toolbar's Sort chip and the grid's own header
two views of one value.

`data-filter-fields` carries WHICH fields the filter touches, not the filter
itself. A grid marks those columns' headers active, so a filter set from the
toolbar ABOVE the grid still shows up on the columns it is narrowing. Without it
the grid only ever knew about filters typed into its own header row, and a chip
change silently shrank the table with nothing to say why. `filterFields()` in
`store.ts` flattens the filter tree to produce it.

`undefined` REMOVES an attribute rather than writing an empty one, so CSS stops
matching.

- Site: `src/core/ui/bind-source.ts`
- Site: `src/core/data/data-source-types.ts`
- Site: `src/core/data/source-binding.ts`

### T-error-is-a-state-not-a-throw

**The rule is in `docs/DATA-SOURCE-RULES.md`, section 6:** a failed load is a
state, and a setter never throws.

The `error` event's detail is `{ error, failure }` — `failure` its KIND
(`T-a-failure-has-a-kind`); an unreached failure with nothing held makes the
source's `reach` `down` (`T-a-failed-read-keeps-the-last-set`).

What belongs here is the ordering nobody would guess. Both the catch and the finally
re-check the in-flight ticket (`T-in-flight-ticket-discards-stale`), so a stale
failure cannot raise an `error` for a load that has already been superseded, and
cannot clear a newer load's loading flag.

A page can also fall PAST THE END when a filter narrows the set. It is re-clamped
and reloaded ONCE — FORCED, because `#lastLoadKey` was just written and the
re-clamp must re-read whatever the new page holds — rather than showing an empty
page.

- Site: `src/core/data/data-source.ts`
- Site: `src/core/data/source-reads.ts`

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
- Site: `src/core/browser/session.ts`
- Site: `src/core/browser/database.ts`
- Site: `src/core/data/stores.ts`
- Site: `test/e2e/reforged-web-storage.spec.ts`
- Site: `src/core/browser/page-state.ts`

### T-store-is-stateless

**The rule is in `docs/DATA-SOURCE-RULES.md`, section 4:** a store is stateless,
and sorting, filtering, grouping and paging belong to the `DataSource`.

What belongs here is the part that surprises. Every store extends `EventTarget`, so "tell everyone the records changed" is the
platform's own `dispatchEvent` rather than a subscriber list written by hand. A
`change` detail names what happened so a listener can be cheap about it, but a
DataSource never decides alone whether a changed row still matches the current
filter, or where it now sorts: it asks again. A held set takes a keyed change
in place first (`T-a-held-set-takes-a-change-in-place`); anything else is read
again, because re-deriving is cheaper than getting that wrong.

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
- Site: `src/components/sherpa-menu/sherpa-menu.css`
- Site: `src/components/sherpa-menu/sherpa-menu.html`
- Site: `src/components/sherpa-menu/menu-number.ts`

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

A load OVERTAKEN by a newer ask waits for that ask, and resolves with its
answer: the rows the source then shows, whichever store read lands first. Its
own rows are thrown away unpublished, so they are not handed back either. It
returned the result in hand when its read landed first — the rows from BEFORE
both loads; once in WebKit, all 22 sites under a filter (TODO 706).

- Site: `src/core/data/source-reads.ts`
- Site: `test/unit/an-overtaken-load-answers-with-the-newest.test.mjs`

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
- Site: `src/core/data/held-set.ts`
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

A number or a Date beside text that can be one compares as that kind, not as text:
locale text passed 1.25 for `gt "1.5"`, and a typed value and a rule's value are text
(TODO 612).

- Site: `src/core/data/store.ts`
- Site: `src/core/data/column-facts.ts`
- Site: `src/core/data/aggregate.ts`
- Site: `test/e2e/reforged-filter-conditions.spec.ts`

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
- Site: `src/core/data/walk.ts`
- Site: `test/e2e/reforged-chart-legend.spec.ts`

### T-pipeline-order-and-no-grouping

`applyOptions` runs search → filter → sort, then pages. **The order is not
arbitrary.** Narrowing comes first so the sort runs over fewer rows; paging comes
LAST because the page is a window onto the final order, and `total` has to count
the MATCHES, not the page.

**Grouping is deliberately NOT applied here.** A grouped view still needs the
FLAT rows — `sherpa-data-grid` stamps a heading row when the value changes — so
the group field is applied as a LEADING SORT and the consumer decides what to
draw. That leading spec puts rows sharing a group value adjacent so a consumer
can find each group in one pass, and the caller's own sort specs then order rows
WITHIN their group.

**Sorted BY the grouped field, the groups go that way** (TODO 523). It was A to Z
here and the sort's way in the grid, so a bound grid drew Z to A over rows its
source had in A to Z, and `groups()` disagreed with both. The rule is here now,
once; a bound grid draws its rows as given and sorts only when it is alone.

`groupRows` exists for a consumer that does want the buckets, and preserves the
order rows ARRIVE in: rows are grouped AFTER sorting, so the groups come out in
sort order and the rows within each keep theirs. `Map.groupBy` keeps insertion
order, which is exactly that.

- Site: `src/core/data/store.ts`
- Site: `test/unit/a-group-follows-its-own-sort.test.mjs`

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
- Site: `src/core/data/filter-state.ts`
- Site: `test/unit/field-selection.test.mjs`
- Site: `test/unit/filter-state.test.mjs`
- Site: `test/e2e/reforged-filter-scope.spec.ts`
- Site: `src/core/ui/filter-host-controller.ts`
- Site: `src/core/data/source-view.ts`
- Site: `src/core/data/query-edits.ts`
- Site: `src/components/sherpa-data-grid/grid-filters.ts`
- Site: `src/components/sherpa-quick-filter/chip-answer.ts`
- Site: `src/components/sherpa-quick-filter/chip-arrange.ts`

### T-a-remote-source-holds-its-whole-set

Will's rule (TODO 340): the DATA LAYER decides whether a question goes to the
server or is answered on the client, and a chip toggle, a Sort or Group cycle
and the filter Switch are client updates. The client can answer only from a
COMPLETE set it already holds, and what it holds must not depend on which
component is bound (TODO 341).

So a remote source reads its store's whole set once — `load({ take: holdRows + 1 })`,
no filter: what the server's own shaping gives — and while it is held, every
load, count and distinct read asks `HeldSet`, which runs `applyOptions` and
`distinctOf`, the pipeline a local store runs. Every page comes from the one
set, so a page cut on the client never meets one the server sorted.

**Held only when provably whole.** The store's own facts are read FIRST, so a
store that never can be held is never sent the whole read: it `reportsTotal`
(a `RestStore` needs a `totalPath`) and checks every row (`sampled` false — a
raw tail would be filtered as if parsed). Then the read must come back whole:
a total that is a number (`totalUnknown` says when a `totalPath` read none), at
most `holdRows` rows, and every one of them (a server that caps a response
sends fewer than its total). Any of these refuses it for good; `held-set-refused`
says which, ONCE per source, and the store is asked as before.

**A failed whole read is not a failed source.** It is caught: every question
asks the store, as before, until a Refresh or a store change tries again — a
backend that rejects `take=50001`, or times out on it, still pages.

**Read again only when the rows may have changed:** a store `change` the set
cannot take in place (`T-a-held-set-takes-a-change-in-place`), a Refresh — a
public `load({ force: true })`. A read in flight is kept, and
`#hold()` reads ONCE more when it lands, however many changes came: twenty
saves cost two whole reads, not twenty. An ask that only repeats a question — a
summary bound late, a page re-clamp — uses `#reask()` and keeps the set. An ask
overtaken while it waited asks no one. Counts, Limit and the set-aside wait for
the hold as a load does, and walk the held set in place
(`T-one-walk-counts-and-limits-in-order`). What the schema refused on the read is said on every
held load. A page definition sets `holdRows` (`0` holds none).

The bench holds the rule: each act on its remote page after it opens must cost
0 loads, 0 counts and 0 distinct reads (`asked()`) — a rule, never a baseline.

- Site: `src/core/data/store-cache.ts`
- Site: `src/core/data/held-set.ts`
- Site: `src/core/data/data-source-types.ts`
- Site: `src/core/data/store.ts`
- Site: `src/core/data/page-definition.ts`
- Site: `scripts/check-bench.mjs`
- Site: `src/core/data/held-reads.ts`
- Site: `src/core/data/source-reads.ts`

### T-a-held-set-takes-a-change-in-place

345 phase 2. A held remote set was read again — whole — on EVERY store
`change`: each save on Demos `?remote` waited 800 ms, and the bench's remote
save read all 10,001 rows. A change that names its row is now taken in place by
`HeldSet.patch()`, and the source asks the set again with `#reask()` — not
`load({ force })`, which drops the set, and not `load()`, which skips a question
it has answered.

- **insert** — placed where the store's whole read would put it, and the rows
  a cap removed with it (`trimmed`) dropped.
- **update** — found by the announced key, which is the key BEFORE the change,
  and REPLACED by the row announced, which is the whole saved row: a field a
  whole read would not have is gone. A changed key moves the row
  (`T-a-changed-key-moves-the-row`).
- **remove** — spliced out.

**Each row is keyed as a whole read keys it** — by its own key field — so a grid
keeps a new or renamed row by the same key. Only `ArrayStore` keys the row it
announces; the patch keys every one.

**Where a new row goes is the store's to say:** `Store.rowOrder` is the order a
whole read returns rows in, asked no sort — `insertion` (ArrayStore, LocalStore,
JsonStore) or `key` (IdbStore, IndexedDB's order). A RestStore says it only
with its `rowOrder` option, and `fakeRemote` passes it on. Unsaid, an insert or
a changed key reads the whole set again: in an unsorted, paged view a guessed
place is a row on the wrong page.

**The patch is the store's cache's, made ONCE** for every page over the store
(`T-a-store-has-one-cache`), and every source hears it after.

**Anything it is not certain of reads the whole set again**, as before: a
change with no key (`setRows`, `putAll`, IdbStore `clear`), no row (a RestStore
whose server sent no reply announces none: the saved row is not known), a row
without its key field (an envelope), a row it does not hold, a key another row
has, a place it cannot tell, or a set grown past `holdRows`. A wrong patch is a
screen that lies, so the rule is: place it only when it is certain.

**A cap must say what it trimmed.** `ArrayStore` and `IdbStore` drop the oldest
rows past `maxRows` on an insert, silently; the held set kept them until the
next whole read. Both now list the keys in the insert's `trimmed`. A custom
store with a cap must do the same, or announce with no key.

A patched row can be one the server's own shaping would not send — another
tenant's, say. The next whole read (a Refresh) puts that right.

The bench's `add`, `save` and `delete` acts hold it: on the remote page each
asks the store nothing.

- Site: `src/core/data/store-cache.ts`
- Site: `src/core/data/held-set.ts`
- Site: `src/core/data/store.ts`
- Site: `src/core/data/stores.ts`
- Site: `test/unit/a-held-set-takes-a-change-in-place.test.mjs`
- Site: `test/e2e/reforged-idb-store.spec.ts`
- Site: `src/core/data/source-reads.ts`

### T-a-store-keeps-its-history

345 phase 3. A source treated every store `change` as "anything may have moved",
so a save to a field nothing on the page reads redid the walk and every draw.
Each store now keeps a HISTORY of this session's changes, by field, so a reader
can ask "did any field I read move since change N?".

- **One clock**, the store's `history.seq`: 0 when the store object is made —
  once a session (Will, 2026-10-19) — and one more for each change.
- **Folded** (Will, 2026-10-20, D1): each field keeps only the number of the
  last change that moved it. It never grows, and a question is one compare per
  field read. It cannot list the changes one by one.
- **Which fields:** `changedFields(before, after, sent)` compares the old row
  and the new as a filter compares them (`valueKey`, and the type). A value
  SENT as the same object the row held was changed in place, so its old value
  cannot be read: it counts as changed. A form that sends a nested object back
  unchanged moves that field too — the safe side.
- **What a change moves:** an insert, a remove, a trim or a changed key moves
  the ROWS, which every reader reads. A change with no key (`setRows`,
  `putAll`, `clear`) or an update that names no `fields` (a RestStore, which
  has no old row) moves EVERYTHING. A dot path answers to its top field.
- **It is noted before it is announced**, in `BaseStore.announce`, so a store
  that dispatches a `change` by hand is not in its History.
- **Every wrapper hands on the same History:** a live store its inner store's,
  `fakeRemote` the store's, and a held set passes the store's change on as
  `change` in its own `change` detail.

**It cannot step back by itself, so a store may also keep a JOURNAL** (561): an
opt-in `journal: N`, the last N updates as the row before and after, each noted in
`BaseStore.journaled` just before it is announced. `undo()` and `redo()` are
ordinary updates the readers hear, so the History moves as for any edit. Off, a
store holds nothing. An insert, a remove, a whole reload or an update the journal
did not see ends it: it cannot vouch past them. `canUndo` and `canRedo` say when.

A History is the TAB's: a write from another tab to IndexedDB or localStorage
is not in it (TODO 345, D2).

- Site: `src/core/data/store-history.ts`
- Site: `src/core/data/journal.ts`
- Site: `src/core/data/store.ts`
- Site: `src/core/data/base-store.ts`
- Site: `src/core/data/live-stores.ts`
- Site: `src/core/data/fake-remote.ts`
- Site: `src/data.ts`
- Site: `test/unit/a-store-keeps-its-history.test.mjs`
- Site: `test/unit/a-store-journal-steps-back-and-forward.test.mjs`
- Site: `test/e2e/reforged-idb-store.spec.ts`
- Site: `src/core/data/data-handler.ts`
- Site: `src/core/data/request-store.ts`

### T-a-change-redoes-only-what-reads-it

345 phase 3. A store change moved a source's `#age`, so EVERY change walked
again and redrew every count — a save to `lastSeen`, which nothing reads, cost
the same as one to a field each chip tallies. Now a source asks the store's
History (`T-a-store-keeps-its-history`) what moved since it last heard, and
redoes only what reads it.

- **The walk** keeps the fields it reads (`walkReads`: what its steps test and
  what they tally). It runs again — `#walkAge` moves, in its key — only when a
  change moved one of them, or the rows. A walk in flight is dropped the same
  way, and a walk that failed runs again on any change.
- **The page and the unpaged rows** are read again on every change, as before
  (`#allAge`, in the all-rows key). Taking an update into them in place waits
  for after 366 (Will, 2026-10-20, D3).
- **Trusted only when certain**, else everything moves as before: the store has
  a History, the History moved for this change (one sent by hand is not in it),
  the store says `announcesAll` (a store that may miss a writer — IndexedDB,
  localStorage, a server — is not trusted; TODO 345 D2), and a held source's
  cache took the change into a set it can vouch for (not `held-stale`, read from
  the plan NOW).
- A Refresh, a set landing and every `declare*` still move `#age`: everything.

- Site: `src/core/data/walk.ts`
- Site: `test/unit/a-change-walks-again-only-for-what-it-moved.test.mjs`
- Site: `src/core/data/source-reads.ts`
- Site: `src/core/data/source-walk.ts`

### T-a-kept-set-is-checked-each-session

345 phase 4.7 — Will's D2 B (the held set kept in IndexedDB, opt-in per remote
store) and W2 A (on a reload ONLINE, draw the kept rows at once and check behind).

`keepCache(store, { name, version?, maxAge?, maxRows? })` is the opt-in, in the
app's code where it makes the store — not a page definition (two pages could
disagree) and not a provider option (it would work only under one). One record
per store, in the one Sherpa database (`sets`, `T-one-browser-database`). `clearKept()` empties every one — and each set held in
memory — at sign-out, and stops each keep: nothing more is written under the old
name until `keepCache` is called again, with the new sign-in's name. The `name`
must carry the user or tenant: the rows outlive the session.

**A sign-out reaches the worker** (plan 695 H1, bug 10). `clearKept()` forgets this
context's sets (`forgetKept`), then asks the app's worker (`{ sherpa: 'sign-out' }`,
answered on a port) and settles once it is done — 3 s at most, as a worker from
before never answers. The worker forgets each `HeldStore` (`forget()`: its set, the
rows it shows, the writes that wait), its own keeps, and the kept notices; the
device loses every set, every outbox entry and every kept notice. Before, only the
calling context forgot: the worker's set wrote the copy back, its rows still
showed, and the last reader's waiting writes were sent for the next. A write that
waited is DROPPED: an app that cares asks `pending` first.

**Whether the next set is kept is the keep's** (plan 695 S4). `drop({ forget })`
forgets the copy and shows nothing kept again; it no longer stops the keep. A
page's keep closes (`forgetKept()`), and the app keeps again under the new
sign-in's name. A worker's goes on (`forgetKept({ keepOn: true })`): its
`keepCache` ran once, in its script, so before, a worker kept nothing more until it
started again — measured: the next set was held in memory, and never written.

- **Read at the start**, and the FIRST hold waits for it — at most 1 s, once: a
  copy that never comes holds up no later hold. One that lands during the wait
  is drawn at once too (the source plans again). The copy is
  gen 0: ALWAYS unconfirmed (`T-a-read-is-planned`), so the first page that uses
  the store draws it at once, `held-stale`, and reads behind it — the "checked
  again when the session starts" that keeps ground zero. A change heard while
  it was read marks it due. Its rows are KEYED again (`keyRow`): a key lives
  beside a row, and a copy drops it.
- **Never shown after** a refusal (401), a refusal for size or a sign-out: a copy
  that lands late is dropped.
- **Written** only for a set confirmed this session (gen ≥ 1, not due): after a
  whole read lands, after a change it takes — once quiet for 2 s, in idle time.
  An unconfirmed set writes nothing, and the last copy STAYS: a save made while
  the store cannot be read does not erase what an offline reload needs.
  Not over `maxRows` (50,000). A refusal (401) forgets it; so does a refusal for
  size; a full device forgets it, says `cache-keep-full` once and stops writing.
- **Dropped when stale in kind**: another `version`, another key field, or older
  than `maxAge` (7 days).
- **No IndexedDB** (Node, a blocked browser): `cache-keep-unavailable`, once —
  memory only. A store that is never held: `cache-keep-never-held`.

Demos keeps `remoteCustomers` (`?remote`): a reload draws the last rows before
the 800 ms read could, and offline it shows them with the warning banner.

- Site: `src/core/data/store-cache.ts`
- Site: `src/core/browser/cache-keep.ts`
- Site: `src/core/data/held-store.ts`
- Site: `src/core/worker/serve-data.ts`
- Site: `test/e2e/reforged-a-kept-set-survives-a-reload.spec.ts`
- Site: `test/unit/a-kept-set-in-node-is-a-miss.test.mjs`
- Site: `test/unit/a-sign-out-reaches-the-worker.test.mjs`
- Site: `test/unit/a-held-set-yields-when-it-cannot-answer.test.mjs`

### T-a-failed-read-keeps-the-last-set

345 phase 4.4 (D2 groundwork). A whole read that failed dropped the held set and
sent every question to the store — which was down too, so a page that HAD its
rows went to an error state. Now the KIND decides (`T-a-failure-has-a-kind`):

| The failed read | The set |
|---|---|
| not reached — `offline`, `timeout`, `server` | KEPT: answered from, `change { stale: true }`; `store-unreached` said once per flip |
| `refused` — 401, 403, 407 | DROPPED: nothing held is shown to someone no longer allowed to see it; the store is asked, and its error says so |
| `invalid`, `unknown` | dropped; the store is asked, as before |

**`source.reach`** is read from state, never from the last event: `down` after an
ask that failed unreached (nothing to show), until a `change`; `unreached` while
answering from a set the store could not confirm; else `ok`. A refusal is not
a reach failure — the store answered. `source.failure` gives the kind and the
store's own message; the `error` event carries it too.

**`source.recheck()`** — `down`: a fresh read; `unreached`: a read BEHIND the
rows shown (no loading state), which on success clears the failure and fires
`set`; `ok`: nothing. A page calls it on Retry, `online` and its tab shown
(phase 4.5).

- A failed Refresh WAS that page's check: it sends no second read at once.
- While the store cannot be reached, the kept set still takes a keyed change.
- A Refresh, a store change or a successful read clears the failure. A NEW page
  clears it only when no set is held; with one, its one try is behind the rows,
  so a failed Refresh never holds the next page up for the whole timeout.

- Site: `src/core/data/store-cache.ts`
- Site: `src/core/data/data-source.ts`
- Site: `test/unit/a-failed-read-keeps-the-last-set.test.mjs`
- Site: `src/core/data/source-reads.ts`

### T-a-read-is-planned

345 phase 4.3 — Will's series: can held data answer? is it current? can the
store be reached? One pure function, `planRead()` (`read-plan.ts`), decides
before every read, and `#reads` follows its `Plan`:

| The store's set | Plan |
|---|---|
| none — the store's facts refuse one, the cap is under a size refusal, or a read failed at this cap | `store` |
| none | `fetch` — read it first |
| bigger than this page's cap; or due, with no read that may be sent | `store` |
| due — a change it could not take, a Refresh | `fetch`, as before |
| the last read failed | `held-stale`, checked behind once |
| held before this page, over a store that may miss a writer (`announcesAll` unsaid) | `held-stale`, checked behind once |
| otherwise | `held` |

**A page opened again shows at once.** Its set comes from the store's cache
(`T-a-store-has-one-cache`), and over a store that cannot vouch for it — a
server another client writes — the first answer is `change { stale: true }`
with nothing asked, then ONE read behind it (`StoreCache.recheck`), then a
`change` with no `stale`. Demos `?remote` (800 ms reads): back to Records shows
its rows in well under 800 ms.

- **Never on a toggle (340).** The check behind is started once a page, by its
  first hold — at open, or its first load. A toggle while stale asks nothing.
- **Stale is read when published**, from the plan as the set stands then: a
  check that landed meanwhile confirmed the answer. A set that lands while an
  ask is in flight overtakes it, as that ask may have read the old set.
- A `fetch` that moves nothing (no read could be sent, and no kept copy landed)
  answers from the store, so the loop cannot spin.
- **A check that finds the set can no longer be held** — too big now, or refused
  for its facts — DROPS it: `set` fires and every page asks the store. A set
  that stayed would answer, stale, for good, with no banner.

The bench's `rest/` page (a fake remote that does not announce every change) holds the
rule exactly: `rest/open` and `rest/reopen` make ONE load each, every other act
none (`asked()`).

- Site: `src/core/data/read-plan.ts`
- Site: `src/core/data/data-source.ts`
- Site: `src/core/data/data-source-types.ts`
- Site: `src/core/data/store-cache.ts`
- Site: `scripts/check-bench.mjs`
- Site: `test/unit/the-read-plan.test.mjs`
- Site: `test/unit/a-reopen-checks-behind.test.mjs`
- Site: `test/unit/a-held-set-yields-when-it-cannot-answer.test.mjs`
- Site: `src/core/data/held-reads.ts`
- Site: `src/core/data/held-store.ts`

### T-a-store-has-one-cache

345 phase 4.2. Each page's `DataSource` held its OWN copy of a remote store's
whole set: every Context visit read it again (Demos `?remote`: 800 ms), each
save was patched into every copy, and an unkeyed change read the whole set once
PER open page. Now the set is the STORE's: `cacheOf(store)` gives one
`StoreCache` per store object (a `WeakMap`), and every source over it shares it.

- **One whole read**, shared — two pages opening at once make one.
- **Each change taken once.** The cache listens to its store for good, patches
  a keyed change into the set (`T-a-held-set-takes-a-change-in-place`), or marks
  the set DUE; then each source hears it from the cache and asks again — a due
  set is read once for all of them. A change made while no page is open is in
  the next page's first answer.
- **The set outlives the page.** `close()` no longer drops it, so a page opened
  again over the same store asks nothing (bench `remote/reopen`: 0 loads; the
  first open is 1 load of 10,000 rows). A closed source asks the store itself
  and never touches the shared set, so its Refresh cannot mark it due.
- **Trust needs `announcesAll`.** A store whose every change comes through it
  (`ArrayStore`; `fakeRemote` passes its store's say on) is trusted as held.
  Any other may have missed a writer — another tab, another client — so a set
  held before a page opened is shown at once, STALE, and read again behind it
  (`T-a-read-is-planned`).
- **One cap per page.** A page whose `holdRows` is under the set's size asks the
  store; the set stays for the others. A set refused for its size at one cap may
  still be held at a larger one.
- **The key is the store OBJECT**, never its name: a name could show one tenant's
  rows to the next. So an app makes each store once (`OutletOptions.stores`).
- Every remembered count moves with it: a `set` from the cache moves the
  source's `#age` (`T-a-chip-counts-within-the-filters-before-it`); a `change`
  moves the walk only when its reads moved (`T-a-change-redoes-only-what-reads-it`).

**What a review of 4.2 put right** (2026-10-19):

- **A failure is the cap's, and a new page tries again.** A failed whole read
  turned holding off for every later page until a Refresh; before 4.2 each page
  tried once. Now a page's first hold calls `retry()`, and the failure is kept
  with the cap it was sent at (`#failedAt`): a smaller cap may still try, at its
  own — a server may refuse only the big `take`.
- **One shared read, at the widest cap asked** (`#widest`), so the first page's
  smaller cap does not make the others wait for a read refused for its size. A
  page the set is too big for neither re-reads it nor trusts-checks it: it asks
  the store, and a set landing does not make it ask again.
- **A first hold never cancels a read already due**: two pages opening together
  over a store that may miss a writer make ONE whole read.
- **A Refresh tries a refusal again** — for size, or a reply that was not
  whole. The store's own facts (`reportsTotal`, `sampled`) refuse at no cost.
- **The read in flight is cleared by identity.** A custom store whose `load()`
  throws at once settled the read before it was kept, and the next `hold()`
  awaited that settled promise for ever: a frozen tab.

- Site: `src/core/data/store-cache.ts`
- Site: `src/core/data/store.ts`
- Site: `test/unit/a-store-has-one-cache.test.mjs`
- Site: `src/core/data/held-reads.ts`
- Site: `src/core/data/source-reads.ts`

### T-a-failure-has-a-kind

345 phase 4.1. A failed read is not one thing: a page keeps showing what it held
when the store could not be REACHED, and must not when the store REFUSED (a
401 is "you may not see this"). `failureOf(error)` reads the KIND from the
error's shape — an `HttpError`'s `status`, a platform name — and imports
nothing, so any store's errors count:

| Shape | Kind |
|---|---|
| `TimeoutError` (`AbortSignal.timeout`); status 408, 504, 524 | timeout |
| status 429, any other 5xx | server |
| status 401, 403, 407 | refused |
| any other status; `ValidationError`, `SyntaxError` | invalid |
| `TypeError` (fetch's network failure; a blocked CORS request too) | offline |
| anything else, `AbortError` too | unknown |

`unreached()` is offline, timeout or server. **Never `navigator.onLine`**: it
says the machine has a network, not that the store answers, and the lint bans
`navigator` in the DOM-free data layer. A `TypeError` from a bug in a custom
store reads as offline — the message is kept, so it can be told apart.

`fakeRemote` fails as fetch does, with a `TypeError`, and its `totalCount`
fails too. Its `delay` and `fail` may be functions, read at each load, so one
wrapper serves an app while a debug setting changes.

- Site: `src/core/data/failure.ts`
- Site: `src/core/data/fake-remote.ts`
- Site: `test/unit/a-failure-has-a-kind.test.mjs`
- Site: `test/unit/a-fake-remote-fails-when-told.test.mjs`
- Site: `src/core/data/source-reads.ts`

### T-a-closed-source-hears-nothing

A `DataSource` listens for its store's `change`, and asks again on each. The
provider makes a NEW source every time a page opens (`openSource()` in
`open()`), over the app's one store. Before TODO 351 nothing removed the old
listener, so every visit left one more source listening: each save reloaded
them all (a whole read each on a remote store), and none was ever freed.

**`close()` lets the store go:** it removes the listener and stops a live load
waiting; a closed source never holds again. It can still be asked — a caller
that kept it gets an answer from the store itself. The store's held set STAYS
for the next page (`T-a-store-has-one-cache`).

**The provider closes what it made, and only that.** `#made` holds each source
`open()` built. One is closed when a `provide()` no longer gives it (the next
page, `close()`), or when its open is overtaken before it was provided. A
source the APP passes to `provide()` is the app's: the provider never closes it.
A provider taken out of the page closes nothing — moved, it must still work.

**A wrapper made per open leaked too** (corrected 2026-10-19, 345 phase 4.1).
This note once said `fakeRemote`'s listener was no leak, as it was made once
per store. It was not: Demos' `stores()` made a NEW wrapper at every Context
open, and each one's relay on the inner store kept it — and everything it held
— alive. Now the relay holds its wrapper through a `WeakRef` and removes itself
at the first change after the wrapper is gone, and Demos makes ONE wrapper for
the app's life. An app hands its outlet the SAME store object each time
(`OutletOptions.stores`).

**The relay lives in a scope of its own** (`wrapStore`, plan 695 S4). V8 gives the
closures one function makes ONE shared context: a relay made beside a closure that
names the wrapper kept the wrapper alive, and none of 100 dropped wrappers was
freed. A source's own `HeldStore` is closed with it, and lets the shared set go.

- Site: `src/core/data/data-source.ts`
- Site: `src/core/data/wrap-store.ts`
- Site: `src/core/data/held-store.ts`
- Site: `src/components/sherpa-provider/sherpa-provider.ts`
- Site: `test/unit/a-closed-source-hears-nothing.test.mjs`
- Site: `test/e2e/reforged-provider-closes-its-sources.spec.ts`
- Site: `src/core/data/source-reads.ts`

### T-the-filter-switch-keeps-what-it-turned-off

Figma's data Filter Toolbar starts with a Switch. It is optional, for legacy
reasons, so a bar shows it only with `data-switchable` (Will, TODO 338). OFF
stops every filter in the bar at once and keeps each one's value — less the
picks the filters before it rule out (`T-a-ruled-out-value-is-greyed`, TODO 523
F3); ON brings back exactly the ones it stopped.

**The Query owns it**, not the bar: `ScopeQuery.suspended` lists the fields the
Switch turned off. Its presence IS "off". One flag would not
do: a chip that was already off before the Switch must stay off after it, so the
Switch has to remember which ones IT turned off. The bar never works the Switch
out from its chips.

**While a scope is off, nothing comes into force there.** `keepOff()` runs in
every recompose: an answer in force in an off scope is turned off and added to
the list. That one rule closes every race — a late report, a
heading pick, a View that names a field — so no reader needs a second check. The
bar greys its chips and makes them inert while off: only the Switch turns them
back on.

**Its sort and group go off and on with it** (Will, TODO 398): while a scope is
off, `arrangementOf()` gives its sort and group as not in force — kept on the
scope, so ON puts them back — and the flip tells the source the rows are
arranged again. Its search stays. The Switch sits left of the Group chip.

- A bar sends `suspended` only while it shows the Switch, so a hidden Switch
  never turns a scope off. A bar told to draw an off scope it cannot show, or
  one in panel mode (the panel has no Switch), turns it back on and reports.
- A scope switched off stays, even with nothing in it: `prune()` keeps it.
- Reset, a saved filter set and a new View replace the scope, so the Switch
  comes back on. A Reset report says `reset`: the source FORGETS the list —
  bringing it back would turn on again what the Reset cleared. The session and
  a saved View keep it.
- A listed field that LEAVES the scope — raised to the View, moved — leaves the
  Switch: it is on again where it went, or listed there if that scope is off.
- A bound bar (`data-locked`) never turns its own chips: its report goes to the
  source, which lists them. With no source, the bar keeps the list itself, and
  its own copy of keepOff turns off a chip that comes on while it is off.

- Site: `test/unit/the-switch-suspends-the-arrangement.test.mjs`
- Site: `src/core/data/query.ts`
- Site: `src/core/data/query-edits.ts`
- Site: `src/core/data/data-source-types.ts`
- Site: `src/components/sherpa-quick-filter-toolbar/sherpa-quick-filter-toolbar.ts`
- Site: `src/components/sherpa-quick-filter-toolbar/sherpa-quick-filter-toolbar.css`
- Site: `src/core/data/query-context.ts`

### T-a-solo-is-a-draft-of-one-tab

**Solo one filter, and every other answer in force goes off — whole** (Will, TODO
690): `query.ask({ scope, solo: field, across })` switches off each other answer in force
in its scope (every scope, `across`; a scope its Switch turned off is skipped) and
this one on, applied at once as the Switch is. It goes off RAW: not through
`suspend()`, whose going-off drops the picks the filters before it rule out, or a
value would come back smaller than it went. A second solo moves it.

**Ending it switches back on ONLY what it switched off** — `unsolo()`, the menu's
"Remove soloing", or the soloed chip's body. An answer the reader had off before
stays off; one the reader turned on meanwhile is left as it is.

**It is never saved** (Will: one tab, a temporary draft; D1 A, a reload ends it):
the solo lives in the `QueryContext` alone, and `export()` — a View save, a draft, a
kept entry, the provider's state — reads what it switched off as ON. A whole Query
put in (`setQuery`, `import`: a View, a draft) or a Reset ends it.

**On the page** (S2): the provider's `allowSolo` and `soloAcrossScopes` reach every
bar and panel as `data-allow-solo` and `data-solo-across`. A field chip's menu and a
section's ⋮ hold both rows, "Solo this filter" and "Remove soloing", and CSS shows the
one that applies; the bar asks `{ solo, across }` or `{ unsolo }`. The scope says its
`soloed` field, and the bar marks that chip `data-solo`: the `solo` icon in its icon's
place, and the `info` look (D2 A, a pin until Figma refines it). A soloed chip's body
does not toggle: it ends the solo, and stays on.

**In the menu's header** (S4, Will): with `soloInHeader` (`data-solo-header`), the
chip's menu holds no Solo rows; it is `data-soloable`, and shows an icon-only toggle
before its Advanced button, `aria-pressed` while `data-soloed`. Its press says
`menu-select` with `header: true`, and the bar leaves the menu open. A menu's
action rows are never its answer: a drill opens a menu whose only rows are Move or
Solo itself (`T-a-conditions-only-menu-cannot-be-drilled`).

- Site: `src/core/data/data-source-types.ts`
- Site: `src/components/sherpa-quick-filter-toolbar/sherpa-quick-filter-toolbar.ts`
- Site: `src/components/sherpa-menu/sherpa-menu.ts`
- Site: `test/unit/a-solo-is-a-draft-of-one-tab.test.mjs`
- Site: `test/e2e/reforged-a-solo-is-a-draft-of-one-tab.spec.ts`
- Site: `src/core/data/query-edits.ts`

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
- Site: `src/components/sherpa-data-grid/grid-cells.ts`
- Site: `src/components/sherpa-data-grid/sherpa-data-grid.html`
- Site: `test/e2e/reforged-filter-conditions.spec.ts`
- Site: `src/core/data/data-source-types.ts`
- Site: `src/core/data/source-view.ts`

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

- EVERYTHING picked is `active`: it filters, and a row with no value does not
  pass, as Select all (`T-all-is-an-answer`, Will, 2026-11-13)
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

- Site: `src/core/data/filter-face.ts`
- Site: `src/data.ts`
- Site: `test/e2e/reforged-filter-conditions.spec.ts`
- Site: `test/unit/filter-state.test.mjs`
- Site: `src/core/data/filter-state.ts`
- Site: `src/components/sherpa-quick-filter/chip-answer.ts`
- Site: `src/components/sherpa-quick-filter/chip-says.ts`

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
| `query.ask({ scope, field, reading })` | the one write; re-queries, then `query-change` names the field |
| `selection(field)` | a `FilterState`, the one answer each control draws from |

The filter is composed from the FIELDS' readings, scope by scope, so a field
can only ever give one clause. A control that also contributes by
hand must exclude what the source owns — a chip reports both its picks AND a
ready clause, and stripping only the picks let the clause ride in anyway.

`bindLegendFilter` lost its `chip:` option to this: a legend and a chip over
one field have nothing to keep in step once both read `selection(field)`. The
binding went from 194 lines to 152.

- Site: `src/components/sherpa-data-grid/grid-filters.ts`
- Site: `src/components/sherpa-menu/sherpa-menu.css`
- Site: `src/components/sherpa-menu/sherpa-menu.html`
- Site: `src/components/sherpa-menu/sherpa-menu.ts`
- Site: `src/components/sherpa-menu/menu-list.ts`
- Site: `src/components/sherpa-quick-filter-toolbar/sherpa-quick-filter-toolbar.ts`
- Site: `src/core/data/bind-selection.ts`
- Site: `src/data.ts`
- Site: `test/e2e/reforged-data-grid.spec.ts`
- Site: `test/e2e/reforged-filter-conditions.spec.ts`
- Site: `test/e2e/reforged-view-definition.spec.ts`
- Site: `test/unit/bind-selection.test.mjs`
- Site: `test/unit/field-selection.test.mjs`
- Site: `src/core/ui/filter-menu.ts`
- Site: `src/core/data/query-members.ts`

### T-an-operator-decides-pick-or-type

A filter menu's CONDITION dropdown leads the card, above the search box, and is
what decides the body beneath it.

`eq` and `ne` over a field with known values are a LIST: the reader picks Gold
rather than typing it, and a typo cannot silently match nothing. `contains`,
`startswith` and the rest are a typed fragment — no list can hold every
substring. `OP_TAKES` in `store.ts` is that rule, beside `OP_LABELS` and
`OPS_FOR_TYPE`, because a second copy is a second vocabulary.

`eq` LEADS `OPS_FOR_TYPE.text` and is `DEFAULT_OP`, so it is what both menus
open on. A heading menu that opens on `contains` makes one field answer
differently depending on which menu the reader reaches for.

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

**The caret keeps the value; no mark names the operator.** A prefix eats the
caret's width — "Does not equal: Gold" truncates where "Gold" would not. The
condition menu shows the WORD only (`OP_LABELS` in `store.ts`), and a chip's
badge is its results (`T-a-condition-badge-says-that-not-which`).

- Site: `src/core/data/store.ts`
- Site: `src/components/sherpa-quick-filter-toolbar/sherpa-quick-filter-toolbar.ts`
- Site: `test/e2e/reforged-data-grid.spec.ts`
- Site: `test/e2e/reforged-filter-conditions.spec.ts`
- Site: `src/components/sherpa-menu/sherpa-menu.ts`
- Site: `src/components/sherpa-menu/sherpa-menu.css`
- Site: `src/components/sherpa-menu/sherpa-menu.html`
- Site: `src/components/sherpa-menu/menu-conditions.ts`
- Site: `src/components/sherpa-quick-filter/sherpa-quick-filter.ts`
- Site: `src/core/ui/filter-menu.ts`

### T-legend-status-swatch-shares-the-band-tokens

A STATUS swatch reads the **same token pair the band it names does**:
`--sherpa-status-<name>-fill` (the status sequence's mid step at 50%) and
`--sherpa-status-<name>` (that sequence's border). A key that does not match the
thing it labels is worse than no key.

The `--_status-*` cascade via `data-status` is a DIFFERENT token set: a swatch
lit from it and the gauge band it names are painted from two unrelated sources,
and drift apart.

A non-status item takes the categorical hue by 1-based index
(`seriesVar`/`seriesBorderVar`), wrapping at the palette size. Naming, never
position, is also how the gauge resolves its own zone colours — see
`T-gauge-status-is-named`.

The key chip paints it: `data-swatch` takes a series number or a status name
(TODO 149).

- Site: `src/components/sherpa-chart-legend/sherpa-chart-legend.ts`
- Site: `src/core/data/format-tick.ts`
- Site: `src/components/sherpa-quick-filter/sherpa-quick-filter.ts`
- Site: `src/core/ui/chart-parts.ts`

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
- A PIE (`inner <= 0`) has a single point for its inner "arc", so its corners
  collapse there and the inner half of the outline is skipped. With gaps that
  point is where its two edges meet, off the centre; past a half circle they
  never meet, and the inner arc is a hub the gap's width
  (`T-a-chart-gap-is-real-space`).

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

Three names also defeat `SourceBinding.push`'s skip-if-unchanged guard: it compares the rows
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

`ArrayStore` COPIES the array in, and every row it hands out is a copy too. A
count hands out no rows, so it copies none.

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

So the one database's open (`openDatabase`) rejects with `IndexedDB is
unavailable`, and `IdbStore.available` is the door a caller checks BEFORE
building one. In Node that is false and the
headless test proves every method rejects rather than resolving to a lie.

A failed open is **not cached** — one rejection in a private window must not
poison a session that is later granted storage.

**A CACHE is the exception** (`keepCache`, `T-a-kept-set-is-checked-each-session`):
it is never the only copy, so no IndexedDB is a miss — memory only, said once —
never an error, and never a fallback to Web Storage.

- Site: `src/core/browser/idb-store.ts`
- Site: `src/core/browser/database.ts`
- Site: `test/e2e/reforged-idb-store.spec.ts`
- Site: `test/unit/headless-data-layer.test.mjs`
- Site: `src/data.ts`

### T-pointer-stays-out-of-session

**DO NOT MERGE `pointer.ts` INTO `session.ts`**, though `session.ts` is its only
internal importer and an audit will suggest it.

`pointer.ts` is on the DOM-FREE list in `eslint.config.js` — a server, a test or an
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

**Only SOME scopes arrange** — Will, TODO 99 step 4 (B): *"Only certain
component scopes, and possibly view scope, will have group and sort."*
`source.query.arranges(scope)` is what the scope declares (`arranges` in the page
JSON, or `declareScope`); left out, a scope a PAGE of rows is drawn in
arranges — a bind given `rows: 'page'` that is not steer-only (`pagedIn`) —
and the View and a summary's scope (`rows: 'all'`) do not. No component kind
decides it (Will, TODO 341, 1 A). A scope that starts to arrange when its
page joins redraws its bars and panel, and a bar's `drawScope` draws its Group
and Sort. So a bar bound by hand into a scope is `steerOnly`, as the provider
binds one, or that scope arranges.

**One arrangement, in the Query.** A source still has one sort, group and
page, loaded once. The sort, the group, a suspended sort and the search are
in the Query, in the ONE scope that arranges — the scope `sort-change`,
`group-change` or `search-change` names, or their binding does; written in
another scope, they move there. So only that scope's Organise chips show it —
the binder writes `data-sort-*` and `data-group-field` only on a control over
that scope (`BoundView.arrangedIn`, TODO 523 S6) — and a save, a saved View and a reload carry it (366 steps 8, 9). A View that names no arrangement keeps the one
on screen; one that names it — `sort: []` too — sets it. `export()` names it,
none too, so a View saved from it puts the rows back as they were. A change to
the arrangement compiles nothing and counts nothing: the walk reads the Query
without it (`withoutArrangement`) — a search narrows the rows, never a chip's
count. Two arranged grids on one source would need
a load each — not built until a page has two.

- Site: `src/components/sherpa-quick-filter-toolbar/sherpa-quick-filter-toolbar.ts`
- Site: `src/core/data/data-source.ts`
- Site: `test/unit/a-scope-arranges-its-own-rows.test.mjs`
- Site: `src/core/browser/persist-view.ts`
- Site: `src/core/data/query.ts`
- Site: `src/core/data/query-edits.ts`
- Site: `test/unit/the-arrangement-is-in-the-query.test.mjs`
- Site: `test/unit/the-search-is-in-the-query.test.mjs`
- Site: `src/core/data/query-context.ts`
- Site: `src/core/ui/bind-source.ts`
- Site: `src/core/data/source-view.ts`

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
either bar is never offered again — `addable(scope)` in `src/core/data/source-view.ts`
is the DOM-free rule, from what each scope holds.

- Site: `src/components/sherpa-app-header/sherpa-app-header.ts`
- Site: `src/core/data/data-source.ts`
- Site: `src/core/data/source-view.ts`

### T-a-superseded-chip-suspends-it-is-never-removed

When the VIEW takes a field the component bar already held, the component chip
goes `data-superseded`: greyed, not clickable, and STILL THERE. It is never
removed.

Removing it throws away what the reader picked. This is the same rule as
suspend-vs-clear everywhere else in the system: "off" keeps the value, "gone"
deletes it. Collapsing the two has already cost a user their typed filter once.

**Its answer is kept in the Query** (Will, D2 A; 366 step 19). When the View
takes a field a component scope holds, the answer still goes UP with it, and
the scope keeps its own in `ScopeQuery.superseded` — not in force, `{}` for
none — and `describe()` draws the chip that state. When the View lets go, the
scope gets it back, or the field clears for `{}`; a send down drops it, so the
View's answer wins. No bar re-reports to bring it back, and a page with no bar
bound gets it back the same. A saved filter keeps none; a View's JSON writes it
in the plain form.

Three parts make the chip work:

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
- Site: `test/e2e/reforged-quick-filter-toolbar.spec.ts`
- Site: `src/core/data/data-source-types.ts`
- Site: `src/core/data/source-binding.ts`
- Site: `src/core/data/query-edits.ts`
- Site: `src/core/data/query.ts`
- Site: `test/unit/a-release-gives-back-the-kept-answer.test.mjs`
- Site: `src/core/ui/filter-host-controller.ts`

### T-a-ruled-out-value-is-greyed

**A value the filters BEFORE it rule out stays in its list, greyed out, and
cannot be picked** — Will, TODO 174 (110's B), made ONE WAY by TODO 349 (D4 A):
a field's scopes and the filters before it in the one order limit it, never
the ones after. A value already picked is LET GO (Will, TODO 512 A): the walk
sets it aside — out of the compiled filter (`CompileFacts.drop`), so the load
is right — and the source then takes it out of the APPLIED reading
(`ask({ scope, field, letGo })`), asking no Apply. The draft follows only while it is
still the applied answer: a draft the reader changed and has not applied keeps
their picks (TODO 518; it was emptied). Until 512 it stayed in the
reading, ticked, greyed and disabled, and came back when the earlier filter
went: a chip named a pick that filtered nothing, and unticking the rest left
that pick alone holding the field at 0 rows (Will: *"some filters are still
active while being limited … the appearance of broken filters and mismatched
data"*). (Until 349 a LATER answer set an earlier pick aside — TODO 180,
newest first; the one order replaced it.)

**What rules a field** (`T-one-walk-counts-and-limits-in-order`) — a
grid heading too, but never an Advanced row (`T-an-advanced-row-rules-out-nothing`): with `limitOptions` on (Settings › Application, off by default), the rows at its
place. Off, a component scope's field is ruled by the View's subset (347) and
the View's by nothing — the View always limits a component scope. A chart part
is greyed by its host the same way, and its pick is never set aside (Q1 A).

**The SOURCE says what is left** — `source.present(scope)`, from the walk: each
list field's values as value keys; a field no chip holds is tallied where it
would stand. Compared as a filter compares, case aside (`holdsKey`, `ruleOut`):
a pick that matches rows is never ruled out. Only Simple list picks are set
aside; a range, a date or Advanced rows stay whole. The set-aside is taken
BEFORE the load where the walk asks no store (a held set, a store with `scan`,
rows kept since the last change), so the first load is right; a store asked
step by step is walked after, and loads again only if that moved the rows.

**Every pick ruled out: the filter STAYS in force** — Will, 2026-10-20: *"Instead
of setting filter chips with no valid values to inactive we should leave them
active … show a badge with count 0."* Only a pick BESIDE one that stands is set
aside. When none stands, nothing is: the chip stays active — never greyed —
wears 0, and the rows go to 0, so the reader sees the impact, opens the menu
(its picks ticked, greyed, "no matches"), clears or removes the filter, or
presses it OFF. Off and ruled out, a value chip is refused; a chip with a menu
always opens it.

**The FILTER stays active; a VALUE the context rules out reads inactive** — on
or off, ticked or not (Will, 2026-10-20: *"even if checked, to visually
communicate that it's limited by the context"*). A menu row is pinned to the
`inactive` Style mode (`.menu-row[data-unavailable]` in `state-pins.yaml` — a
class key, as the row is slotted light DOM), and its checkbox takes the
mode's accent (`accent-color`), so a ticked one is a grey tick. **Inactive is
not interactive** (Will, 2026-10-20): the row is disabled, ticked or not, with
no hover; a panel's value chip that is ruled out refuses a press, on or off; a
chip with a menu still opens it. The reader lets a ruled-out pick go with the
menu's Clear or Remove, the field's Reset, or the filter chip's off.

**Each control is TOLD** — `drawPresent(present, scope)` on a bound bar, panel
or grid — and passes it to `menu.present`, which greys and disables the rows
(silently, no event); a panel's run of value chips gets `data-unavailable`.
Select all never ticks a ruled-out row. A grid heading used to mark values
"available" from the PAGE it was given; one page cannot say what the source
holds, so that is gone.

**A chart LEGEND too** — Will, TODO 179: a legend picks through
`bindSelection`, not a bound scope, so the source ANNOUNCES each pass
(`present`, by scope — a chart's own scope included) and the provider hands
its legend the field's list. A ruled-out legend row is inactive, its key chip
says why, and it refuses a press, as its chip does in the panel.

**It says why** — Will, TODO 176: a ruled-out chip's tooltip and a row's
`aria-description` — and a menu row's `title`, on hover — read "Limited by your
other filters: no matches." A disabled
chip says "Not available here." A chip the View took says where it went
(`T-an-inactive-chip-says-where-its-filter-went`).

**Greyed by default, HIDDEN on request** — Will, TODO 205. While Limit is on,
the ⋮ also offers "Hide unmatching filters" (`hideUnmatched` on the provider,
`data-hide-unmatched` on a bar, a panel or a grid — its heading menus, TODO 305).
The menu then removes a ruled-out
row (`data-hide-unavailable` → `data-removed`) and the panel hides a
ruled-out value chip. A value still PICKED is never hidden, so it can be let
go. A portrait section's value chips are marked by `limitField` too — it once
marked only an unoffered one, and no rule hid even that (TODO 448).

**Ruled out and still ON, it may be LET GO, never taken back** (Will, TODO
462; it refused every press until then). A ticked row's box stays enabled and
a menu marks its rows again after each tick, so the one let go is refused —
and, hiding, goes — at once; an on value chip, or a chip whose every pick is
ruled out, takes one press to go off (`#refused()`, and no `pointer-events:
none` while `data-current`). Turned OFF — by its chip, the scope's Switch or
the Filters menu — an answer DROPS each pick the filters before it rule out, and
clears with none left: off otherwise keeps an answer, which left a pick in the
Query that could only come back matching nothing (TODO 465). The Query decides,
from its source's last walk (`QueryMember.ruledOut`), so every way off agrees
(Will, TODO 523 F3 A).

- Site: `src/core/ui/filter-host.ts`
- Site: `src/core/data/data-source.ts`
- Site: `src/core/data/store.ts`
- Site: `src/core/ui/shared-constants.ts`
- Site: `src/components/sherpa-menu/sherpa-menu.ts`
- Site: `src/components/sherpa-quick-filter-toolbar/sherpa-quick-filter-toolbar.ts`
- Site: `src/components/sherpa-data-grid/sherpa-data-grid.ts`
- Site: `src/components/sherpa-quick-filter/sherpa-quick-filter.ts`
- Site: `src/components/sherpa-quick-filter/sherpa-quick-filter.html`
- Site: `src/components/sherpa-provider/sherpa-provider.ts`
- Site: `test/unit/present-limits-each-field.test.mjs`
- Site: `test/unit/a-let-go-pick-leaves-the-draft-alone.test.mjs`
- Site: `test/unit/a-pick-that-matches-is-never-ruled-out.test.mjs`
- Site: `src/components/sherpa-chart-legend/sherpa-chart-legend.ts`
- Site: `src/core/ui/filter-def.ts`
- Site: `test/e2e/reforged-provider.spec.ts`
- Site: `src/core/data/filter-state.ts`
- Site: `src/core/data/data-source-types.ts`
- Site: `src/core/data/stores.ts`
- Site: `src/core/data/query.ts`
- Site: `src/core/data/source-counts.ts`
- Site: `src/core/data/walk.ts`
- Site: `test/e2e/reforged-quick-filter-toolbar.spec.ts`
- Site: `src/components/sherpa-menu/sherpa-menu.css`
- Site: `src/components/sherpa-menu/menu-list.ts`
- Site: `src/components/sherpa-provider/provider-legends.ts`
- Site: `src/core/ui/filter-host-controller.ts`
- Site: `src/core/data/source-walk.ts`
- Site: `src/core/data/query-edits.ts`
- Site: `src/components/sherpa-quick-filter/chip-section.ts`

### T-unavailable-value-sorts-below-a-divider

`FilterOption.available: false` means still SELECTABLE, but no row carries
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
the host knows the whole column, so it hands it over.

The WHOLE column comes from the data layer: the grid asks for each column's
filter (`DataAsk.filters`), whose options are the field's whole list
(`T-a-heading-opens-the-chips-menu`). A host with no provider passes the same
`filters` to `populate()`; the `data-column-values` attribute, a second door for
it that nothing wrote, went in TODO 523.

- Site: `test/e2e/reforged-provider.spec.ts`
- Site: `test/e2e/reforged-filter-conditions.spec.ts`
- Site: `test/unit/filter-state.test.mjs`
- Site: `src/core/data/filter-state.ts`
- Site: `src/components/sherpa-menu/menu-list.ts`

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
is one they cannot undo — the same rule the header's box follows
(`GridSelection.all`), and the reason it walks the visible rows rather than every
row held.

The advanced checkbox REPORTS the scenario and the grid carries it out: the
component knows about one checkbox, and "all rows" means nothing to it. The
grid owns the rows, so the grid decides.

**A grid its SOURCE pages holds one page** — ungrouped, the store's window IS
the page — so "Select all rows" there ticked one page (Will, TODO 238). The
grid ASKS instead: `select-all-request`, cancelable, with an `answer(rows)`
callback. The binder takes it and answers with `source.allRows(el)` — every
row under the filter that narrows that grid, unpaged — and the grid ticks
their keys, the ones on other pages too. With no source, nobody prevents the
ask, and the grid ticks what it holds, as before.

**"Select all on page" is THIS page, and only it** (Will, 365): a row chosen on
another page is let go — its key leaves `#wanted` too, or the merge in
`GridSelection.#changed` would hand it back.

- Site: `src/components/sherpa-data-grid/grid-selection.ts`
- Site: `test/e2e/reforged-data-grid.spec.ts`
- Site: `src/core/ui/bind-source.ts`
- Site: `src/core/data/data-source.ts`
- Site: `test/e2e/reforged-grid-select-all-pages.spec.ts`

### T-grouped-page-change-publishes-without-loading

**A page change while GROUPED needs no load — and asking for one loses it.**

The chain, which took a live app to find:

1. `#loadOptions` sends no `skip`/`take` while grouped, because the grid cuts
   the page itself (`T-grouped-paging-belongs-to-the-view`)
2. so `#stateKey()` — which is `JSON.stringify(#loadOptions())` — is IDENTICAL
   for page 1 and page 2
3. so the no-op load guard skips the load, correctly: the question really has
   not changed
4. and `SourceBinding.publish()` is called from inside `load()`, so it never runs

The pager moved, `data-page` on the grid stayed at 1, and the body kept
drawing the same rows. No error, nothing in the console, and the ungrouped path
worked perfectly — which is what made it look like "pagination is broken"
rather than "grouped pagination is broken".

A page asked (`ask({ page })`) now publishes directly when a group is set, and schedules a load only
when one is not. The guard is right; what was wrong is that a VIEW-level change
was being connected through a DATA-level mechanism.

**The same shape can bite any state that is the view's and not the store's.**
If a future value changes what is DRAWN without changing what is FETCHED, it
needs this branch too — `#stateKey` will not see it.

- Site: `test/e2e/reforged-data-source.spec.ts`
- Site: `src/core/data/source-reads.ts`

### T-grouped-paging-belongs-to-the-view

**STORE paging and VISUAL paging are not the same thing**, and a grouped view is
where they come apart.

`skip`/`take` counts RECORDS. A grouped page counts what is ON SCREEN — a
row, or a shut group as one — and which groups are shut is a fact that lives in
the grid (`GridGroups.#shut`), has never been sent to a store, and should not be.

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

`#viewPages` is cleared by a Group asked and by a `setQuery` that moves the group —
a count measured against the old grouping describes groups that no longer exist.

The cost is honest and bounded: a grouped view holds the whole result set in the
browser. That is the price of letting the reader fold.

- Site: `src/core/data/data-source.ts`
- Site: `src/core/ui/bind-source.ts`
- Site: `src/core/data/source-reads.ts`

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
- Site: `src/core/data/source-reads.ts`

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

| reach | reaches | writes |
|---|---|---|
| **view** | every component in the View — it cascades DOWN | the FIELD's one answer, `ask({ field, reading })` at its home |
| **component** | that component only (`only`) | its OWN scope, `ask({ scope, field, reading, only })` |

A field's answer at its home is keyed by field alone, so a second writer does not narrow,
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
reader picked something they did not. It also means a part's write is not the
field's selection, so the binding redraws itself on write.

**A component reach REFUSES a binding with no `only`** — it reports
`component-reach-without-only` and binds nothing — rather than falling back to
the field's one answer: that fallback is the exact clobber this scope exists to
prevent.

`reach` defaults to `view`, so every existing binding is unchanged.

- Site: `src/core/data/bind-selection.ts`
- Site: `test/e2e/reforged-filter-scope.spec.ts`
- Site: `src/core/data/query-edits.ts`

### T-a-date-picks-days-unless-it-says-range

**A date's picks are DAYS; they are two ENDS only when the reading or the
field's definition says `range: true`.** TODO 397, Will (2026-10-22). Two
defaults made every date a range: the source set `range` on every View date's
filter, and `fieldState` read an unflagged date reading's picks as ends when the
field had no value list — so a one-day pick meant "from that day on". A field
says it in its definition (`"range": true`), which `filterDef()` carries to every
menu (a range calendar) and the catalogue's facts carry to the clause. A
reading a range menu sends says `range: true` itself, as a saved `between` does.

- Site: `src/core/data/data-source-types.ts`
- Site: `src/core/data/filter-state.ts`
- Site: `test/e2e/reforged-a-date-picks-days.spec.ts`

### T-a-remote-store-says-what-changed

**A store that may miss a writer, and says `changes`, is asked what moved since
its mark — never on a toggle.** TODO 345 phase 9 (Will, D1 A). A held set over a
server another client writes was read whole again each time a page opened over
it. Now the cache keeps the store's MARK — asked as each whole read is sent — and
a check asks `changes(mark)`: nothing moved, and the set is confirmed; some
fields, and those columns alone are read again, joined by key; a row came or
went, or the store cannot tell (`fields: 'all'`), and the whole set is read. A
check runs when a page opens again (its behind check) and when the provider
rechecks — a Retry, `online`, the tab shown. Never inside a toggle (340): a
toggle can show data one step old. A change the cache heard is asked about
again at the next check; it costs a read then, never a wrong row.
`RestStore` says `changes` with a `changesUrl` (`GET …?since=<at>` →
`{ at, rows, fields }`); `fakeRemote` answers it from its store's History, and
its `missed` drops a change as another client's write. There is no timer: a page
that wants one calls `provider.recheck()`.

- Site: `src/core/data/store.ts`
- Site: `src/core/data/store-cache.ts`
- Site: `src/core/data/stores.ts`
- Site: `src/core/data/fake-remote.ts`
- Site: `src/core/data/data-source.ts`
- Site: `src/components/sherpa-provider/sherpa-provider.ts`
- Site: `test/unit/a-remote-store-says-what-changed.test.mjs`
- Site: `test/unit/a-reopen-checks-behind.test.mjs`
- Site: `test/unit/a-store-has-one-cache.test.mjs`
- Site: `scripts/check-bench.mjs`
- Site: `src/core/data/source-reads.ts`

### T-a-held-set-reads-the-pages-fields

**A held set reads the fields its pages ask for, and a column it lacks on its
own, joined to its rows by key.** TODO 345 phase 8. A store's one cache keeps
every field a page has asked for (null — every field, for good once any page
asks for all) and sends them with each read, where the store `projects` and
has a key. A page that needs a column the set lacks plans `fetch`: the cache
reads that column alone, `take` its cap, and `join`s it by key — a copy of each
row, never the store's own. A read that is not the same rows — a change the
cache never heard — makes the set due, and it is read again with every field.
Offline, a set without the column is shown as it is, unconfirmed.

A page's NEED is every field it declares (and a tiered child), what the Query
holds and answers, the sort, group, search and time fields, and what its
components name (`AttachFacts.fields` — the provider gives a grid's columns and
key, a summary's field, segment and over). A component given rows that names
none needs every field, and so does a search with no search fields. Only a
source opened from a page definition reads its need (`pageFields`); one made by
hand reads every field, as before, because app code may read any field of its
rows. A component bound later that lacks a column asks again, and its column is
read. A row a page is given may lack a field the page does not use: a whole
record is `store.byKey()`.

- Site: `src/core/data/held-set.ts`
- Site: `src/core/data/store-cache.ts`
- Site: `src/core/data/read-plan.ts`
- Site: `src/core/data/data-source.ts`
- Site: `src/core/data/data-source-types.ts`
- Site: `src/core/data/held-store.ts`
- Site: `src/core/data/source-binding.ts`
- Site: `src/components/sherpa-provider/sherpa-provider.ts`
- Site: `src/core/ui/context.ts`
- Site: `src/core/data/page-definition.ts`
- Site: `src/components/sherpa-data-grid/sherpa-data-grid.ts`
- Site: `test/unit/a-held-set-reads-the-pages-fields.test.mjs`

### T-a-projected-row-is-checked-on-what-it-was-sent

**A load may name its `fields`; a store that says `projects` sends each row's
key and those fields alone, and checks a projected row only on them.** TODO
345 phase 7. A whole-row check of a projected row fails every `required()`
field it was not sent, so the row is dropped as invalid when nothing is wrong
with it. `rules()` keeps its map of field checks (`rulesOf`), and a projected
row is run through `validateField` per field it carries. A schema from
another library can only judge a whole row, so a store with one says
`projects: false` and a caller sends whole rows to it. `RestStore` asks with
`fields=`; a faked remote passes on what its store says. Today only the
fetched field's ask (`T-a-server-field-is-asked-once-per-answer`) names
fields, and asks for the key alone.

- Site: `src/core/data/store.ts`
- Site: `src/core/data/base-store.ts`
- Site: `test/unit/a-load-projects-its-fields.test.mjs`

### T-a-server-field-is-asked-once-per-answer

**A field marked `fetch: "server"` is answered by the store — once per answer,
for the keys it matches.** TODO 345 phase 6 (Will, A: the names). A held set
filters on the client, which is what keeps a toggle, a Switch and a cycle free
of requests (340); a field whose meaning only the server knows cannot be
worked out that way. So its APPLIED answer is asked of the store once,
`load({ filter })`, and the keys that come back are its clause, `[key, 'in',
keys]`, which the held set runs like any other. The answer is the cache key:
off and on again reuse it, a new answer asks again. Until the keys come, the
clause as it reads. Its menus have Apply, so a tick is not a request.

**Only a set held HERE asks** — the source's own HeldStore, which runs every
clause on the client. A source that reads its store straight (a local store, a
remote one it holds none of, one that holds its set elsewhere) asks for no keys:
its load sends the clause to the very store the keys would come from, so they
are the same rows. Asked anyway, each Apply compiled twice and loaded twice —
the clause, then `email in [...]` — and a row added under the answer never
showed, the keys being kept (TODO 707). Held, the two compiles are the design:
the held set answers at once, the server's keys after.

**A write asks again** (TODO 726). Over a held set, kept keys hid a row added
under the answer until a Refresh, and kept one changed out of it. So a write the
source hears — an add, a change, or one its store cannot say — asks each kept
answer's keys again, an answer switched off too, the old keys serving until the
new come; the last ask wins. A remove asks nothing: a key no row has matches
nothing. A toggle, a Switch and a cycle still ask nothing.

It is turned ON from three places, and none can turn it off: the page
definition, a filtering component's `data-fetch-fields`, and a grid column's
`fetch` — the provider tells the source. A store that projects is asked for
the key alone.

- Site: `src/core/data/data-source-types.ts`
- Site: `src/core/data/data-source.ts`
- Site: `src/components/sherpa-provider/sherpa-provider.ts`
- Site: `test/unit/a-server-field-is-asked-once.test.mjs`
- Site: `scripts/check-bench.mjs`

### T-a-field-reads-its-values-when-needed

**A remote store a source does not hold is asked a field's values only when
the field is needed.** TODO 345 phase 5. Its page declares its scopes FIRST,
then reads values for what they hold and what the Query answers; every other
field waits in `#unread`. A field held later, answered, or shown as a grid's
filtered column (`readValues`) is read then — one `distinct` for every field
asked in a turn — and the bars, the panel and the grid are drawn again with
it. Until then its filter says `loading`.

Only there: a store it HOLDS answers `distinct` from the held set on the
client, and a local store has its rows already, so both read every field at
once, as before. The bench counts the fields asked (`fields`): the not-held
page's open asks for 7 fields of values, not 12, an added field asks for 1,
and the same field held again for none.

- Site: `src/core/data/data-source.ts`
- Site: `src/core/data/page-definition.ts`
- Site: `src/components/sherpa-provider/sherpa-provider.ts`
- Site: `src/components/sherpa-quick-filter-toolbar/sherpa-quick-filter-toolbar.ts`
- Site: `test/e2e/reforged-a-loading-menu.spec.ts`

### T-a-value-holds-child-values

**A field's values can hold child values: a Customer's Sites.** TODO 369. The
parent names its child once, in the page definition (`"child": "site"`); the
child is an ordinary field with no filter of its own. A pick is the parent, or
a PATH object naming both tiers, `{ customer, site }`, in the parent's one
reading — keyed by `valueKey`, so Northwind's London and Contoso's London are
two keys.

The children live APART from the parent's domain, in the catalogue's own map:
put in the domain, they leaked to every reader of a field's values — a legend,
a chart's categories, a summary — each of which then drew one category per
path. Only `filterDef` lists them, each after its parent and naming it.

A path compiles over both fields in the four ops any server runs: parents
`in`, each parent's child picks as `and(eq parent, in children)`, all OR'd.
It is split by the path's OWN fields, never by parsing a key string.

- Site: `src/core/data/field-catalogue.ts`
- Site: `src/core/data/filter-state.ts`

### T-a-path-is-judged-by-its-parent-when-stepwise

**A store asked step by step cannot see pairs, so a path stands or falls with
its parent.** TODO 369. A store that is not held tallies one field at a time
(`distinct`), so it can say which customers and which sites are left, never
which customer HAS which site. So, stepwise, a path is present while its
parent is, and is never set aside unless its parent is. That only ever keeps
a pick on, never drops one: a reader's path was once ruled out wholesale,
which changed their filter.

- Site: `src/core/data/source-counts.ts`

### T-a-parent-pick-is-the-parent

**A tiered field's parent picked is the PARENT: every row of it, rows with no
child too.** TODO 369, Will's Q1 A. A child pick is a PATH, `{ customer,
site }`, in the same field's reading; ticking every child does not pick the
parent. In the panel's column each parent is a value chip, drawn from the
picks, with its children as its own menu (TODO 425): ON while it or any child
of it is picked. A press turns it OFF and KEEPS its
picks (Will's Q2), so they move to the reading's `off` — picks kept and not in
force, which count as an answer and compile to nothing. The next press brings
them back; with none, the parent is picked whole.

Its BADGE counts what makes it ON. The walk counts each pick by its own key, so
a parent with only children picked had no count of its own, and its ON chip
showed no badge. A parent not picked itself now counts its picked children
together, under its own key.

- Site: `src/core/data/filter-state.ts`
- Site: `src/core/data/source-counts.ts`
- Site: `src/components/sherpa-data-grid/grid-cells.ts`
- Site: `test/e2e/reforged-a-tiered-grid.spec.ts`
- Site: `src/components/sherpa-quick-filter/chip-answer.ts`
- Site: `src/components/sherpa-quick-filter/chip-section.ts`

### T-an-open-panel-follows-the-data-layer

**An open control over several scopes follows every field another control
changes.** Filled ONCE, when it opens, it goes stale: a chart legend or a column
heading changes a field, the data and the bar follow, and it still shows the old
answer — so its next Apply, with nothing touched, puts that answer back.
Measured on the Records page: 25 rows went back to 100.

That control is the toolbar's portrait column. The binding draws each of its
scopes WHOLE, once per moment, whenever what a scope holds changes
(`drawScopesSoon`, then `drawScopes`).

- Site: `src/core/data/source-binding.ts`

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

- Site: `src/core/ui/filter-def.ts`
- Site: `src/core/data/data-source-types.ts`

### T-many-conditions-are-one-reading

A reader may give one field SEVERAL conditions — `contains "an" OR starts with
"B"` — and every row after the first says how it joins the one before it. That
is still ONE reading of ONE field, so it stays in the field's single slot — as
ONE tree, `reading.tree` (`T-one-condition-tree`) — and `stateClause()` returns
one filter: a CLAUSE for one condition, a GROUP for several.

Splitting it across two writers would be the bug `T-one-state-per-filtered-field`
already names, and a control drawing the field would have to ask twice.

**Rows read left to right.** `A or B and C` is `(A or B) and C`: each row joins
every row before it, as a reader reads a stack of rows. Will, TODO 594: `Equals Ravi
OR Equals Signe AND Contains "Khan"` let rows through with no Khan, when AND bound
tighter. The editor nests (TODO 692): a group's rows share one join, a group applies
only inside its parent, and `menu.condition` reads and writes the tree whole; the
data layer compiles it either way.

**A half-built row narrows nothing, and is dropped.** A row whose op has no
value yet — no text typed, nothing picked — is not a filter. A field whose rows
are all half-built reads `off`, so a menu mid-edit does not narrow the data
under the reader's hands.

**One surviving row returns a CLAUSE, not a one-member group.** `['or', x]` is
valid and a caller ANDs it either way, but someone debugging a filter should see
the shape they built.

`op`/`text` remain the single-condition form of a number's or a date's Simple
body. A list's other ops are its Advanced tree.

- Site: `src/core/data/filter-state.ts`
- Site: `src/data.ts`
- Site: `test/unit/filter-conditions.test.mjs`
- Site: `src/components/sherpa-menu/sherpa-menu.html`
- Site: `test/e2e/reforged-filter-conditions.spec.ts`
- Site: `src/components/sherpa-menu/sherpa-menu.ts`
- Site: `src/components/sherpa-menu/menu-conditions.ts`
- Site: `src/core/data/query.ts`
- Site: `src/components/sherpa-data-grid/grid-filters.ts`
- Site: `src/core/data/query-edits.ts`
- Site: `src/components/sherpa-quick-filter/chip-answer.ts`

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


**It must hear the pointer.** A greyed chip's `.body` and `.caret` take `pointer-events: none`, so a hover lands on `.chip`, which holds neither. While greyed, `.chip` is itself a `.sherpa-anchor`, so its tip opens. Will, TODO 585.

- Site: `src/components/sherpa-quick-filter/sherpa-quick-filter.ts`
- Site: `src/components/sherpa-quick-filter-toolbar/sherpa-quick-filter-toolbar.ts`
- Site: `test/e2e/reforged-quick-filter.spec.ts`
- Site: `src/core/ui/shared-constants.ts`
- Site: `test/unit/moved-to.test.mjs`
- Site: `src/core/data/source-binding.ts`
- Site: `src/components/sherpa-quick-filter/chip-says.ts`

### T-a-condition-badge-says-that-not-which

A per-operator sign can say which operator ONE row holds. A field holding
`Contains "ab" or Equals churned` has no single operator, so any one sign over
it is wrong, and the reader believes it.

So no mark ever names an operator. A grid HEADING wears ONE glyph — `fx`, the
spreadsheet's formula sign — which says only THAT conditions apply. A CHIP's
badge is its RESULTS since TODO 60 (`T-a-chip-counts-within-the-filters-before-it`), so it
wears no condition mark at all. The tooltip says HOW MANY
(`T-an-advanced-answer-reads-as-its-conditions`); the chip's value and accessible name
spell the chain, `Contains: ab or Equals: churned`, from `spellConditions()`.

The accessible name stays the WORD, never the mark: a sign announces as
nothing, and `fx` announces as noise.

- Site: `src/core/data/filter-face.ts`
- Site: `test/e2e/reforged-filter-conditions.spec.ts`
- Site: `src/data.ts`
- Site: `test/unit/filter-state.test.mjs`
- Site: `src/components/sherpa-data-grid/grid-filters.ts`
- Site: `src/components/sherpa-quick-filter/chip-answer.ts`

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
  `query-change`, so a no-op that wakes it is a redraw loop waiting to happen.
- **`scope()` answers a COPY.** A caller that mutates the answer must not reach
  into the registry through it.

- Site: `src/core/data/query-context.ts`
- Site: `test/unit/scope-registry.test.mjs`

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
| `onReport(fn)` | connect it — a toast, a log, a test's array. Returns its undo |
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

**Round 2, 2026-10-12 (TODO 224)** — each was silent before:
`provider-undefined-element` (and `open()` no longer waits for it for ever),
`provider-refused-setting` (told apart from a key the API lacks),
`provider-unknown-source`, `view-gaps` (a View opened by a link too, and to
`onReport`, not only the console), `sheet-failed` and `template-failed` (a
failed file is not cached, so the next element asks again), and a SPA
fallback's own page refused in place of a missing file. `LocalStore` keeps the
changed-key contract with the other stores.

- Site: `src/core/data/report.ts`
- Site: `src/data.ts`
- Site: `src/components/sherpa-quick-filter-toolbar/sherpa-quick-filter-toolbar.ts`
- Site: `test/unit/a-broken-assumption-reports.test.mjs`
- Site: `test/e2e/reforged-a-broken-assumption-reports.spec.ts`
- Site: `src/core/ui/templater.ts`
- Site: `src/core/browser/view-files.ts`
- Site: `test/e2e/reforged-reports-round-2.spec.ts`
- Site: `src/core/data/source-reads.ts`
- Site: `src/core/data/source-view.ts`

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

- Site: `src/core/data/bind-selection.ts`
- Site: `test/unit/scope-registry.test.mjs`

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
- Site: `src/components/sherpa-data-grid/grid-find.ts`
- Site: `src/components/sherpa-data-grid/sherpa-data-grid.css`
- Site: `test/e2e/reforged-input-find.spec.ts`
- Site: `src/core/data/source-view.ts`

### T-the-field-type-decides-the-clause

The data layer must know what KIND a field is (`text`, `number`, `date`): it
decides how an answer compiles — a date's two picks are a RANGE, not two
equalities, and a number's text is a number. Without it every app has to know,
and each grows a query builder of its own — there were three.

`declareField(field, { type, label })` says it, and three rules live in the data
layer:

- **A date's two picks are a range**; a number's range is an Advanced row (TODO
  375). A number sorts NUMERICALLY — as text, `["1000","9"]` puts 1000 first and
  a range matches nothing.
- **A range field has no value LIST.** Its picks ARE its values, so `fieldState`
  reads them from the reading rather than a declared domain, and a number field
  no longer reads as `off` for having nothing ticked.
- **Conditions answer a field.** A reading whose only answer is its tree — no
  picks, no typed text — still answers: dropped as empty, an or-chain built in a
  menu never applies.

**A UI sends parameters; it never builds a query.** If a component needs to know
a field's type to filter it, the type is in the wrong place.

- Site: `src/core/data/filter-state.ts`
- Site: `src/core/data/data-source.ts`
- Site: `test/unit/field-type.test.mjs`
- Site: `src/data.ts`
- Site: `src/components/sherpa-quick-filter-toolbar/sherpa-quick-filter-toolbar.ts`
- Site: `src/components/sherpa-data-grid/grid-filters.ts`
- Site: `src/core/data/field-catalogue.ts`

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
The grid counts for itself only when nobody told it.


**A chart's group is the same idea** (TODO 548): a summary with a `group` hands
each segment its `parts` — the segment's rows again, by the group field, in that
field's ONE order, so a value is one colour in every segment. The chart draws
them; it never works them out.
- Site: `src/core/data/store.ts`
- Site: `src/core/data/data-source.ts`
- Site: `src/components/sherpa-data-grid/sherpa-data-grid.ts`
- Site: `test/unit/groups-are-a-data-concept.test.mjs`
- Site: `src/components/sherpa-provider/sherpa-provider.ts`
- Site: `test/unit/parity-sweep.test.mjs`
- Site: `test/unit/a-summary-groups-and-sorts.test.mjs`
- Site: `src/core/data/source-reads.ts`
- Site: `src/core/data/column-facts.ts`
- Site: `src/components/sherpa-data-grid/grid-groups.ts`

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

- Site: `src/components/sherpa-quick-filter-toolbar/sherpa-quick-filter-toolbar.ts`

---
- Site: `test/e2e/reforged-filter-conditions.spec.ts`
- Site: `src/core/data/source-view.ts`

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

- Site: `src/core/data/column-facts.ts`
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
`IdbValidationError` was kept as a deprecated alias of the real class until
2026-10-14, and went with the other leftovers: catch `ValidationError`.

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

**Both live in the source's Query**, in the scope that arranges (366 step 8),
and that is the whole point: a reload brings both back. The source owns
every bound element's `data-*` (`T-attributes-are-the-state-channel`), so a
component that kept its own suspended column in `data-sort-field` had it wiped
by the very next push, one microtask later. Measured: the grid set the
attribute, `SourceBinding.push` ran, `setAttr(el, 'data-sort-field', undefined)` removed it,
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

Three things read it and all three must agree: the grid's page (`GridGroups`
asks `ColumnFacts` for no sort), `#drawHeadCell` (glyph back to `sortNone`,
`data-sort` removed), and the Sort
chip's `arrangeBy`, through `arrangeFrom` (chip off, direction rewound to `asc`
so a resume starts ascending rather than at the stale `desc`).

`ask({ sort: null })` suspends; `ask({ sort: null, clear: true })` forgets. A caller that means "throw it
away" must say so — and a NEW sort drops the memory rather than shadowing it,
or resuming would jump to a column the reader had moved on from.

- Site: `src/core/data/query.ts`
- Site: `src/components/sherpa-data-grid/sherpa-data-grid.ts`
- Site: `src/core/data/cycle.ts`
- Site: `test/unit/suspended-sort.test.mjs`
- Site: `test/unit/cycle.test.mjs`
- Site: `src/core/ui/sherpa-element.ts`
- Site: `src/core/data/data-source-types.ts`
- Site: `src/core/data/query-edits.ts`
- Site: `src/core/data/source-view.ts`
- Site: `src/components/sherpa-data-grid/grid-groups.ts`
- Site: `src/components/sherpa-quick-filter/chip-arrange.ts`

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
`sortDirectionFrom`. Pure, DOM-free, on the lint boundary —
they take the current state and return the next one. **Reading it off an
attribute and writing the result back is not their job**, because for a bound
component that belongs to the source (`T-bind-locks-what-it-owns`).


- Site: `src/core/data/cycle.ts`
- Site: `src/components/sherpa-data-grid/sherpa-data-grid.ts`
- Site: `src/components/sherpa-quick-filter-toolbar/sherpa-quick-filter-toolbar.ts`
- Site: `test/unit/cycle.test.mjs`
- Site: `src/components/sherpa-data-grid/grid-groups.ts`
- Site: `src/components/sherpa-quick-filter/chip-arrange.ts`

### T-a-summary-binds-to-all-the-rows

`bindSource()` hands a component `#result.rows`, which is **the page** —
`applyOptions` slices to `skip`/`take` and reports the pre-slice count
separately as `total`. That is right for a grid and wrong for every summary: a
chart bound the default way on a 25-row page of 100 records counts 25, draws a
perfectly reasonable picture, and is silently wrong.

`rows: 'all'` is the fix. The adapter is handed every row matching the filter,
unpaged:

```js
bindSource(source, chart, { readonly: true, rows: 'all', as: (rows) => countBy(rows, 'status') });
```

NOT `scope: 'all'`, which this entry said until 2026-10-01: `scope` names a
filter scope, so it type-checks, binds to a scope called "all", and counts one
page — the very bug. `bindSource()` now reports it (`scope-all`).

Three things make it safe:

- **It costs nothing when unused.** The second, unwindowed store call happens
  only while some bind asks for it (`SourceBinding.wantsAllRows()`), and is skipped entirely
  when the query was never windowed — no `pageSize`, or grouped, where the page
  already IS everything. A node test asserts every store call still carries its
  window when no summary is bound.
- **A LATE bind still fills.** Binding a summary after the first load would
  otherwise find `#allRows` empty and draw blank, because nothing would ask
  again; `bind` forces a reload in that one case.
- **The skip-if-unchanged guard follows the scope.** It compares the array this
  particular bind receives, not `#result.rows` — otherwise a summary would be
  skipped whenever the page array happened to be unchanged.

A page that asks through the provider gets the whole set for its summaries on
its own; a hand `bindSource()` says `rows: 'all'`, as Sherpa Demos' Records gauge
does.

The second read is asked again only for a new question over new rows (TODO 348
W1): it is keyed by its own load options and the source's age, so a page
turned, or a component scope's answer (the summary sees the View alone), keeps
the rows it has.

- Site: `src/core/data/data-source.ts`
- Site: `test/unit/summary-scope.test.mjs`
- Site: `src/core/ui/bind-source.ts`
- Site: `src/core/data/data-source-types.ts`
- Site: `src/core/data/source-binding.ts`
- Site: `src/core/data/source-reads.ts`

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

`data-empty` on a row is what a FILTER did; a chip with no `data-current` is
what the READER did. Both paint the same inactive ink, and they are not the
same fact: a row can be pressed ON and hold nothing.

See `T-a-legend-toggle-is-a-filter` for the other half — a legend click writes
`notin` into the source rather than hiding a slice.

- Site: `src/core/data/aggregate.ts`
- Site: `src/components/sherpa-chart-legend/sherpa-chart-legend.ts`
- Site: `src/components/sherpa-chart-legend/sherpa-chart-legend.css`
- Site: `test/e2e/reforged-chart-legend.spec.ts`
- Site: `test/unit/filter-state.test.mjs`

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
a Sort takes a FIELD NAME, not an array of specs.

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
- Site: `src/core/data/filter-state.ts`
- Site: `src/core/data/store.ts`
- Site: `src/core/data/validate.ts`
- Site: `src/data.ts`
- Site: `test/unit/value-types.test.mjs`
- Site: `src/core/data/field-catalogue.ts`
- Site: `src/core/data/query-members.ts`
- Site: `src/core/data/query-edits.ts`

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

- Site: `src/core/data/filter-state.ts`
- Site: `src/core/data/store.ts`
- Site: `test/unit/filter-state.test.mjs`
- Site: `src/components/sherpa-menu/menu-list.ts`
- Site: `src/core/data/source-view.ts`

### T-two-bars-over-one-scope

**A scope can have two bars, and a change through one must reach the other** —
TODO 426. Records' grid scope is drawn by its strip (`#qft`) and, in panel
mode, by the column's section. A bar's own add or remove REPORTS its holds
(`hold`), and the source drew only the panels again — the bar that asked shows
it already, and once there was one bar per scope. So a field added on the
strip never reached the section. On a `hold`, the source now draws each bar
over that scope whose `heldFields` differ from what the scope holds
(`drawBarsBehind`): the asking bar matches and is left alone, so an open menu
of its stays open.

- Site: `src/core/data/source-binding.ts`

### T-a-fetching-list-opens-on-its-first-value

Will, TODO 403: a fetching filter (Customer, Region) *"should also have its first
value selected by default and default to being active (unless the definition
specifies otherwise)"* — so a page never asks for every row as it opens. Will's
picks: Q1 A, every list the View holds plus any list on a remote source; Q2 A,
the field key `"start": "all"` opts out (`"first"` is the default).

`"start": "all"` now opens a list on ALL — every value ticked, on, no filter
(Will, TODO 489 B; TRAP `T-all-is-an-answer`).

`openSource` ends with `source.openOnFirst()`: each such held list with no
answer takes the FIRST value a row holds under the starts before it in its
scope — so Region opens on a region the chosen Customer has, never on none. The
first field's values are read already; each after it asks `presentUnder`.

The start is the QUERY's (`query.startWith`), taken in place as the page opens,
and taken again wherever the Query leaves that field unanswered: a View pick
(a View resets every field that does not carry over), a restore, and Reset —
so none of them asks for every row. An answer the reader made — off — is kept,
never replaced. (Nothing ticked is no answer: it filters nothing. Will, TODO 550.)

A control bound AFTER the Query holds answers is drawn them at the end of
`attach`, after the flags that rebuild a bar's chips (`data-waits`): drawn
before, a rebuilt chip lost its answer.

- Site: `src/core/data/data-source.ts`
- Site: `src/core/data/data-source-types.ts`
- Site: `src/core/data/query-context.ts`
- Site: `test/unit/a-list-can-start-with-every-value.test.mjs`
- Site: `src/core/data/query-declarations.ts`

### T-a-chart-gap-is-real-space

**The gap between a chart's segments is space, not a line.** Will, TODO 635: segments stand
1px apart and keep their full outline; sections 1px too (TODO 686), with a thinner one, 0.5px. A line of the
card's surface along the shared edge was tried first and sent back: it is painted over both
outlines, so it thins them. So each path moves in from its neighbour by half the gap and the
half of its outline that falls outside it.

**A segment has 1px of padding** (Will, TODO 693): its sections stand inside its outline,
not on it. A bar's parts are inset 1px; a ring's move in past the inner half of the segment's
outline, the 1px, and the outer half of their own. A pie's point and a band too thin to keep
a part are not padded; a whole ring has no edge at its start, so its last part and its first
keep a section's gap there.

An SVG draws in units and a gap is in pixels, so a ring reads its own size as it draws
(`unitsPerPixel`) and draws again when that changes (`redrawOnResize`).

**A gap is one width from the rim to the centre** (Will, 2026-11-02). Each straight edge
moves in SQUARE to its boundary (`startGap`, `endGap` on `ringSegmentPath`), not by an
angle. An angle made the gap taper: a pie's slices all met at the centre, so the gap there
was nothing. So a pie slice's point moves off the centre, along its middle, by
`gap / sin(span / 2)`. A slice over half the circle has no point — its edges never meet —
and the gaps' ends leave a hub the gap's width at the centre. A gap is capped so the point
stays inside half the radius: a very thin slice keeps a smaller gap, not a shape that is gone.

- Site: `src/components/sherpa-radial-chart/sherpa-radial-chart.ts`
- Site: `src/core/data/format-tick.ts`
- Site: `test/e2e/reforged-radial-chart.spec.ts`

### T-a-push-is-a-check-behind

**A push from the app's server says a store changed, and the worker checks behind**
(plan 652 S8). `serveData` reads a push as `PushSaid`: `{ store, notification }`.
A held store is read again behind (`recheck`), so its newer rows WAIT and the
data notice is said — the banner shows (`T-a-server-change-waits`); a store not
held says the notice itself. A `notification` is shown where the reader allowed
it, and its press focuses the tab that shows its `url`, else opens it in a new one:
an open tab is never moved off its work (plan 695 H1, bug 9). The app's server
sends the push, with its own keys: Sherpa ships the worker's half.

Measured 2026-11-02 in Chromium, the push delivered by DevTools
(`ServiceWorker.deliverPushMessage`): a record changed on the server unheard, the
push named its store, and the banner showed. **Headless Chromium refuses every
notification**, granted or not (`Notification.permission` stays `denied`), so the
test reads that the worker ASKS to show it. Firefox and WebKit have no way to
deliver a push in a test.

- Site: `src/core/worker/serve-data.ts`
- Site: `test/unit/a-push-is-a-check-behind.test.mjs`
- Site: `src/core/data/data-handler.ts`

### T-a-request-picks-its-stores

**An app's stores are said once, and each request picks its own** (plan 695 H2).
`defineStores(() => ({ … }))` is one module the page and the Service Worker both import;
it makes the stores at a host's first ask, so a page a worker answers makes none. A name
holds one store, or a choice — `{ stores: { local, remote }, pick: (request) => word }` —
and the APP's pick reads the request: its headers, its sign-in, its own say. Sherpa hands
the request on whole and reads none of it: the handler reads only its own protocol's
headers (`Sherpa-Data`, `Content-Type`, `traceparent`, `If-Unmodified-Since`), measured
by a spy on every header door.

Four things that are not obvious:

- **One name, several stores, each heard apart.** A change is said on `DATA_CHANNEL` as
  `{ store, as, change }`, and a store's facts say the `as` its request picked, so a
  request store hears only its own store of those under its name: a remote one that
  missed a server's write is not told it by the local one beside it.
- **A check behind is the name's.** `POST ?recheck` on a name — a page's, a push, the feed's
  word — checks every store under it: the feed's ask carries no app header, so a pick
  would name the default. A name none of whose stores holds a set says a `data` notice,
  where its host notifies.
- **One check at a time.** A tab shown, the feed, a gap, a push and a Refresh each ask.
  A `HeldStore`'s ask before its read is sent joins the check; one after waits for one
  more, which every later ask joins — what it heard may be newer than the read out (a
  pure join lost a sign-out's lost-save notice, measured). A `RequestStore` sends the
  asks of one moment as one request. A check settles as its read ends, even one a change
  overtook: before, it waited for a `set` that read never fires, and hung.
- **The worker holds each remote store itself** (`heldOf`, its writes waiting in
  `keepOutbox(name)`, or `name:as`); a store the app holds is served as it is. With no
  worker, the page reads the same definitions, its source holding its own set.

**A store may be made for each request** (plan 695 H5): a name's definition may be a
function, `(request) => store`, which the APP writes — a server wraps the request's own
sign-in into a store that sends it upstream. Sherpa still reads none of it (the same
spy, measured). Such a store is never held, never heard and never handed out: it is in
no `all()`, and `through()` leaves it as it is — a worker's held set per request would
read its source on every ask. A check behind has nothing of it to read.

- Site: `src/core/data/define-stores.ts`
- Site: `src/core/data/data-handler.ts`
- Site: `src/core/data/request-store.ts`
- Site: `src/data.ts`
- Site: `test/unit/a-request-picks-its-stores.test.mjs`
- Site: `test/unit/a-check-behind-is-asked-once.test.mjs`

### T-a-data-request-is-the-store-interface

**The data layer over HTTP is the `Store` interface, nothing more.** Plan 652, step S1.
`createDataHandler({ stores })` answers `QUERY` (a `load`, or `totalCount` with
`total: true`), `GET` (a row by key, the store's facts, or `?since=` its changes), `POST`,
`PATCH` and `DELETE`, under `/sherpa/data/<store>`; an act that changes state is a `POST`
(`T-an-act-is-a-post`). The page, a Service Worker and a server host the same function
(`T-a-node-host-is-the-same-handler`), so they cannot answer differently. Outside its path
it returns `null`, and its host passes the request on.

**One version marker** (plan 695 H5): the `Sherpa-Data` header, on every request and every
answer; a request without it is taken as this version, another is a 400. The query body
said a `v` too, and only a query has a body: it is gone, and a body's `v` is not read.
**No answer is kept by a cache** (`Cache-Control: no-store`): rows, facts, changes,
problems and acts are a store's, and may be one reader's alone. **A `since` is the store's
own mark**, opaque, as JSON: one that is not JSON is a 400 before the store is asked (it
threw inside the handler, a 500).

Four things that are not obvious:

- **A key travels as JSON** (`keySegment`), so `5` and `"5"` reach the store as they were
  sent. A REST URL's `String(key)` cannot tell them apart.
- **`now` travels as an ISO time**, because a relative date reads a clock
  (`T-a-rule-names-its-clock-and-its-language`). A read with no `now` reads the host's.
- **A row is JSON on the way back**, so a `Date` in a row arrives as text. The data layer
  compares a `Date` and ISO text as dates (TODO 612), but a component that wants a `Date`
  object must not assume one.
- **The browser's Cache API refuses a `QUERY`** in all three engines (measured 2026-11-02),
  so a worker caches answers itself, keyed by the body.
- **A field's values cross alone**: a `QUERY` with `distinct: [fields]` answers
  `{ values }`, read where the rows are — the store's own `distinct`, else its rows there.
  A `RequestStore` offers it where its store has one and is remote: a local store's
  rows are read once, for its values and its counts alike, and asked apart Demos'
  Records read every row twice more (measured, plan 695 H2).

A `POST` whose body is a query is answered as the `QUERY`: the fallback where a proxy refuses
the method, with the same body. Any other `POST` adds a row.

A bad body is refused before the store is asked: 400 when it is not JSON, 415 when it is
not `application/vnd.sherpa.query+json`, 422 when it is not a read. A store's own failure
comes back as a problem with its `Failure` kind, and its HTTP status where it had one
(`T-a-refusal-keeps-its-kind`).

- Site: `src/core/data/data-handler.ts`
- Site: `src/core/data/request-store.ts`
- Site: `test/unit/a-data-request-is-the-store-interface.test.mjs`
- Site: `test/unit/a-request-store-acts-as-its-store.test.mjs`

### T-a-refusal-keeps-its-kind

**A refusal crosses the protocol as `application/problem+json` (RFC 9457), with the
protocol's kind kept** (plan 695 H5): `{ type, title, status, detail, kind }`, and a
refused write's `issues`, by field. `type` is `tag:sherpa-ui,2026:<kind>` — a name, not a
page to fetch, as RFC 9457 allows. A `RequestStore` throws it as its store would: a
write's issues as a `ValidationError`, else an `HttpError` carrying the `kind`, which
`failureOf` reads before the status.

**An offline source is offline on the far side, not a failing server.** A store with no
status of its own crossed as a 500, so a worker whose source was down told its page
`server`, and the page's banner said the data failed rather than that it could not be
reached. Each kind now crosses as its own status where its store gave none — `offline`
503, `timeout` 504, `refused` 403, `conflict` 409, `invalid` 422, `server` and `unknown`
500 — and a store's own status passes through. The old `{ error: { kind, message } }`
body is gone.

- Site: `src/core/data/data-handler.ts`
- Site: `src/core/data/failure.ts`
- Site: `src/core/data/request-store.ts`
- Site: `test/unit/a-refusal-keeps-its-kind.test.mjs`

### T-an-act-is-a-post

**What changes a host's state is asked by `POST`** (plan 695 H5): a check behind —
`POST <base><store>?recheck`, or `POST <base>?recheck` for every store — and the newer
rows taken in, `POST <base><store>?take` → `{ took }`. A `GET` is safe: a prefetch, a
cache or a crawler may send one, and none may make a worker read its source again. The
`GET` forms are gone; one is refused, 405 with `Allow: POST`, and acts on nothing. The
act keeps its word in the URL, so a test that waits for `?recheck` still finds it. Every
asker sends `POST`: a `RequestStore`, the tab that follows the feed (`followUpdates`), a
push in the worker (`serveData`), and Demos' own worker.

- Site: `src/core/data/data-handler.ts`
- Site: `src/core/data/request-store.ts`
- Site: `src/core/browser/follow-updates.ts`
- Site: `test/unit/an-act-is-a-post.test.mjs`

### T-a-preflight-is-the-apps-to-answer

**A page on another origin asks by the app's own CORS policy** (plan 695 H5):
`createDataHandler({ stores, cors: { origins, headers, credentials, maxAge } })`. An
allowed origin's preflight says the connection's methods (`QUERY` among them), Sherpa's own
headers and the app's (`headers`: its sign-in, its own say), and its answers let the page
read `Sherpa-Data`, `Sherpa-Stale` and `traceparent`. A refused origin is refused, 403,
preflight and request alike, and no store is asked. A request from the handler's own
origin always may; with no `cors`, nothing of CORS is said, as for a page or a worker.

**A refused preflight is not offline.** The browser fails the fetch with the same
`TypeError` as a network that is down, so a `RequestStore` read a refusal as offline, and
kept retrying. Now, where a request to another origin fails that way (after a read's one
`POST` try, `T-a-query-falls-back-to-post`), it sends one plain `GET` in `no-cors` mode —
no preflight, an opaque answer: where that reaches the host, the policy refused this
origin, and the failure is `refused`; where it does not, offline. Measured 2026-11-03 in
Chromium, Firefox and WebKit against a Node host: allowed, `QUERY` and `PATCH` went
through their preflights with the app's header; refused, `refused`; a host gone,
`offline`. With the probe off, a refusal read `offline` (Chromium, WebKit). No probe runs
in Node, or to the page's own origin: there is no CORS there.

- Site: `src/core/data/data-handler.ts`
- Site: `src/core/data/request-store.ts`
- Site: `test/unit/a-preflight-is-the-apps-to-answer.test.mjs`
- Site: `test/e2e/reforged-a-server-answers-another-origin.spec.ts`

### T-a-worker-holds-the-set

**A remote store's ONE held set lives in the Service Worker, for every tab**
(plan 652 S5, D8). `new HeldStore(source)` holds its source's whole set through
`HeldReads` and answers every reader from it; it says `capabilities.holds`, so a page over it
(a `RequestStore`, through `openWorkerStore`) holds no second copy. Measured
2026-11-02 with Demos' remote mode (800 ms a read): tab one waited once, 805 ms;
tab two's every read came back in about 1 ms (Chromium; 813 and 128 ms at most in
WebKit; Firefox reports 0 for a worker's answer, so it cannot be read this way).

**It stays REMOTE to the page, as before (Will, D8: A).** Drafts and Apply, the
loading state and "Unable to reach data" all stay. The page learns why its rows
are unconfirmed from each answer's `Sherpa-Stale` header (`store.stale`); Retry
and Refresh ask the worker to read its source again (`POST …?recheck`), and the
page asks anew once that lands.

**A new page checks the worker's set once, behind** — where the store may miss a
writer (`announcesAll` unsaid) — as a page's own held set was checked on every
open: a worker lives on past a reload, so without it a page reloaded with the
server down showed old rows and no warning.

**The set holds the fields its readers ask for**, as a page's did: a copy kept by
a page holds that page's fields, and a worker that asked for every field read the
source again instead of showing it.

**A kept copy is looked for again until a set is read.** The worker started — and
looked for the copy — before the page that kept it had written it, and lived on;
the keep's port remembered its empty first look. Now an empty look looks again,
and a hold with nothing held and nothing read this session restores once more.

- Site: `src/core/data/held-store.ts`
- Site: `test/unit/a-worker-holds-the-set.test.mjs`

### T-a-remote-store-is-read-through-a-held-store

**One rule, in one place: `heldOf(store)`** (plan 695 S4). A source over a REMOTE
store reads it through a `HeldStore` it makes for itself — its own cap (`holdRows`),
its page's fields (`need`), and `waits: false`. None for a local store, for one that
holds its own set (`capabilities.holds`: a worker's, over requests), or for a page
that holds no rows (`holdRows: 0`), which asks the store. So a remote store is held
one way wherever it lives: in a worker, ONE `HeldStore` for every tab; in a page, one
per source, over the store's one `StoreCache`.

`DataSource` holds nothing itself — no `StoreCache`, no `HeldReads`, no `holds`
check. What it read of them it reads of its HeldStore:

- **A change** comes WITH its detail only where the set took it and the HeldStore can
  vouch for the set; else with none, as if every row moved — the old
  `taken && plan !== 'held-stale'`, decided once, by the holder.
- **A set landing** is a change with no detail, from a HeldStore that does not wait,
  where the set answers its reader: one too big for its cap, or none it used, moves
  nothing. A source asks again only once it has answered.
- **Rows in place**: `scan` and `distinct` are its set's while the set answers; `scan`
  is never its source's, which is remote. **Unconfirmed**: `stale` (its source
  unreached) and `unconfirmed` (a set it cannot vouch for yet). **A Refresh**:
  `letGo()`. **Its end**: `close()`.

A source over a store that holds ELSEWHERE keeps its doors: a Refresh takes the rows
that wait, else rechecks; a new page checks the set behind once (D8); a tab shown
checks behind, sending the writes that wait first. Its own holder is rechecked on a
tab shown only where the store may miss a writer and says what moved, as before.

The provider's bundle carries `HeldStore` now: about 2.4 KB brotli.

- Site: `src/core/data/held-store.ts`
- Site: `test/unit/a-remote-store-is-read-through-a-held-store.test.mjs`
- Site: `src/core/worker/serve-data.ts`
- Site: `src/core/data/source-reads.ts`

### T-a-store-says-what-it-can-do-once

**What a store can do is ONE typed object, `capabilities`** (plan 695 S4): `remote`,
`holds`, `projects`, `reportsTotal`, `totalFirst`, `sampled`, `rowOrder`,
`announcesAll`. Unsaid is no. Beside it stay its state (`stale`), its History, its
optional reads (`distinct`, `scan`, `changes`) and a holder's doors (`recheck`,
`take`, `send`, `forget`): a method's presence is its own statement. Before, the eight
flags sat loose on each store, and each wrapper copied them by hand and drifted —
`statusFields` dropped `holds`, `stale`, `recheck`, `take` and `send`, and
`fakeRemote` dropped `totalFirst`.

**Every wrapper is `wrapStore(inner, own)`.** What `own` does not say is the inner
store's, read when asked: key, time, capabilities, domains, History, `stale`, every
method, and the store's events (`change`, `waiting`, `queued`, `lost`). A wrapper that
cannot keep one says so by name, so a drop is a decision: `statusFields` says
`scan: undefined` (a row read in place has no status value) and `history: undefined`
(its History never names a status field, so a walk would trust it and miss a status
that moved); `fakeRemote` says `scan: undefined` (a remote store's rows are never read
in place). A member set on a wrapper later is its own.

**Over the wire they go whole** (`StoreFacts.capabilities`), and a `RequestStore`
says what its host's store said and nothing more. A `BaseStore` says what its schema
allows (`reportsTotal`, `projects`, `sampled`) under its own say; a `HeldStore` says
its source's, and `holds`. A reader reads them once: a `DataSource` at construction.
A test that changes one replaces the object.

- Site: `src/core/data/store.ts`
- Site: `src/core/data/wrap-store.ts`
- Site: `src/core/data/base-store.ts`
- Site: `src/core/data/request-store.ts`
- Site: `src/core/data/held-store.ts`
- Site: `src/data.ts`
- Site: `test/unit/a-store-says-what-it-can-do-once.test.mjs`
- Site: `src/core/data/source-reads.ts`

### T-a-superseded-read-stops

**Every read takes an `AbortSignal`** (`LoadOptions.signal`, plan 695 S4), and a store
passes it on: `RequestStore` on its `Request`, `RestStore` to `fetch` beside its
timeout (`AbortSignal.any`), `fakeRemote` to its wait. A `DataSource` gives each ask a
signal and aborts the ask a newer one supersedes, so a read that would be thrown away
stops at the network. Before, a superseded read was only discarded
(`T-in-flight-ticket-discards-stale`): it ran to its end.

- An aborted read is no error: the ask that superseded it answers. A closed source
  aborts its ask, and says nothing.
- **The signal is never part of the question.** `encodeQuery` leaves it out, and so
  does `orderKey`: `JSON.stringify` writes a signal as `{}`, so a load with one and a
  count without it asked two questions, and an `ArrayStore` ordered its rows again —
  measured: two scans more per open on the bench's not-held pages.
- A held set's whole read is SHARED, so it takes no reader's signal; a read its
  HeldStore passes on to its source does.

- Site: `src/core/data/store.ts`
- Site: `src/core/data/stores.ts`
- Site: `src/core/data/request-store.ts`
- Site: `src/core/data/fake-remote.ts`
- Site: `test/unit/a-superseded-read-stops.test.mjs`
- Site: `src/core/data/source-reads.ts`

### T-every-tab-hears-a-change

**One tab's write is every tab's news** (plan 652 S6). `serveData` says each
store's change on one `BroadcastChannel`, `DATA_CHANNEL` (`sherpa-data`), as
`{ store, change }`, and tells a page so in its facts (`notifies`). A
`RequestStore` over such a host listens, and announces each change for its store
to its page. Measured 2026-11-02: a customer added in one Records tab shows in
another — 100 rows, then 101, then 100 when removed — in all three engines.

**Its own writes too, once.** The worker's word reaches the tab that wrote, so a
`RequestStore` that hears its host announces none of its own writes itself; one
with no such host (the page's own handler) still does.

**A store that holds its own set is asked again, never read again**, on a change:
a forced load would have made the worker read its source.

**A channel lives as long as its page, or its worker** — and in Node it would
hold the test run open for ever: each is `unref()`'d where it can be. A
`RequestStore` whose owner ends before the page is closed by it (`close()`): its
channel shuts, and it says its own writes again (plan 695 H1, bug 8).

- Site: `src/core/data/request-store.ts`
- Site: `test/unit/every-tab-hears-a-change.test.mjs`
- Site: `src/core/data/data-handler.ts`

### T-a-notice-is-heard-never-ordered

**What is new is SAID as a fact, and HEARD by what asked to hear it** (Will, plan
652: *"The data layer, or service worker, shouldn't tell the app to show a banner.
The banner (or the consumers chosen UI component) should register as listening
for update notifications."*). The data side says a notice on `NOTICE_CHANNEL`
(`sherpa-notices`): `{ kind: 'data', store }` — newer data waits — with
`sayNotice()`. A new version is the page's own news: a NEW Service Worker taking
the page over (`controllerchange`, never the first one, which is no news).
`onUpdate(listener)` hears both.

**An element registers by its markup:** `data-listens="app"` or `"data"`. The
provider hears every notice and shows each listening element under it for that
kind (`hidden` off) — it names no banner, and the element's own words say what.
A listening `sherpa-callout` is `data-locked`, so its close REPORTS and it stays:
the provider hides it until the next notice. Its `data-duration` timer runs only
while it shows (`hidden` is watched), or a banner hidden at load timed out unseen.

**A page holds its news in one `Updates`** (plan 687 U1): the provider's `updates`
hears each notice (`hearUpdates`) and keeps what waits — a new version, each
store's rows, the lost saves. It draws every listening element from that, on each
change and on each page it opens, so a banner shows on the next page while its news
waits. A dismiss hides a kind until its next notice; a listening element's own
Refresh takes the rows in; `take('lost', id)` tells the worker the save was seen. A
kept notice said again is no news. An app reads `provider.updates` for its own list,
never its own `onUpdate`: each `onUpdate` asks the worker to say every kept notice
again.

**Demos:** two info banners at the top of each Context's layout grid, before the
metrics, across all 12 columns — Reload for a new version, Refresh data for
waiting rows — and a new version is an item in Notifications too, which stays
after its banner is dismissed and reloads when picked (Will, D5).

- Site: `src/core/data/notices.ts`
- Site: `src/core/browser/updates.ts`
- Site: `src/components/sherpa-provider/sherpa-provider.ts`
- Site: `src/core/data/updates.ts`
- Site: `test/unit/what-is-new-waits-until-taken.test.mjs`
- Site: `test/e2e/reforged-provider-news.spec.ts`
- Site: `src/components/sherpa-provider/provider-news.ts`

### T-a-server-change-waits

**Newer rows the source gives behind the ones shown WAIT, so no page moves under
its reader** (Will, plan 652 S6c). A `HeldStore` keeps its OWN copy of the rows
its readers see. After each read behind it compares the live set with that copy;
rows that differ wait, and it says `waiting`. `serveData` says that as a data
notice, `{ kind: 'data', store, rows }`, and the listening banner shows. Refresh
data takes them in: the page's Refresh asks `take()` first (`POST …?take`), and
reads the source again only when nothing waited. Measured 2026-11-02 in Demos'
remote mode: a customer's owner changed on the server; the grid kept the old
owner and the banner showed, and Refresh data showed the new owner, in all three
engines.

**It must be a COPY.** A store that says what moved (`changes()`, as
`fakeRemote` does from its History) has the changed fields joined into the SAME
set, in place. Measured: the set the readers saw changed under them, and no
`waiting` was ever said.

**Each check that finds rows waiting says so again**, so a tab opened since — or
one whose banner was dismissed — hears it. The rows shown are the same in every
tab, as there is one set; a Refresh in one tab takes the rows in for every tab.

**A write made through the app shows at once:** each change the store hears is
patched into the copy too. A write the copy cannot place makes the next set show
at once, as the write did. `new HeldStore(source, { waits: false })` takes newer
rows at once: a live board.

- Site: `src/core/data/held-store.ts`
- Site: `test/unit/a-server-change-waits.test.mjs`
- Site: `src/core/data/data-handler.ts`

### T-a-write-made-offline-waits

**A write made while the source is offline waits on the device, and is sent once**
(plan 652 S7a). `new HeldStore(source, { outbox: keepOutbox(name) })`: a write its
source cannot send — a `TypeError` from the fetch, `offline` — goes into the outbox,
is laid over the held set and the rows shown at once, and is said as a change to
every tab. The writer gets the row as it will be. Only `offline` waits: a timeout or
a server's failure may have landed, so it fails as before, and is never sent twice.

**Sent in order, once.** `send()` reads the outbox again under `alone()` — a Web
Lock, `sherpa-outbox:<name>` — so a second sender finds nothing left. It is called
when the worker starts, before each read behind (`recheck()` — a tab shown, back
online, Retry), and on Chromium's Background Sync (`OUTBOX_SYNC`, registered when a
write waits), which may run with every tab shut; a send still offline rejects, so
the browser tries the sync again. Firefox and WebKit have no Background Sync: there
the next start or check sends it.

**Laid over every set until sent.** A whole read behind replaces the set, so each
landing lays the waiting writes again; a worker that starts reads them from the
device and lays them over its first set.

**One the source refuses when sent is dropped and said** (`lost`, and a report):
the set is read again and shown at once, so no row shows a write that never landed.
D3's newer-write rule, and how the reader is told, are `T-a-newer-write-wins`.

**The kept entries share one object store** (`outbox`, in the one Sherpa database),
each keyed `[outbox, id]`: two outboxes can make one id in the same ms.

- Site: `src/core/data/outbox.ts`
- Site: `src/core/browser/outbox-keep.ts`
- Site: `src/core/data/held-store.ts`
- Site: `src/core/worker/serve-data.ts`
- Site: `test/unit/a-write-made-offline-waits.test.mjs`

### T-a-newer-write-wins

**A write made offline is sent with its own time, and a newer write wins** (Will,
plan 652 S7b, D3). `HeldStore.send()` passes `{ unmodifiedSince: entry.at }`;
`RestStore` sends it as `If-Unmodified-Since`, and a server refuses the write,
412, where the row changed after. `failureOf` reads 409 and 412 as `conflict`.
`fakeRemote` keeps when each row last changed — by any writer, heard or missed —
and refuses the same way. A store that cannot tell writes it anyway: then the
write made offline wins. An HTTP date has whole seconds, so a change in the same
second is not seen as newer.

**The rule holds over the wire** (plan 695 H1, bug 4). `RequestStore` sends a
write's time as `If-Unmodified-Since` too — one encoding, `writeHeaders`, which
`RestStore` uses — and `createDataHandler` reads it back for its store, as the END
of that second: HTTP compares whole seconds, so a change refuses the write only
from the next one. A 412 from the store answers 412, `conflict`. `HeldStore`
passes a write's time on to its source, and one that waits offline keeps it as its
`since`. Before, both dropped it: a held store over a request store — a worker over
a server — wrote over every newer change.

**Our own earlier write is no newer write.** An insert made offline lands, and
then the update made after it would be refused, as the row "changed after" it.
So when a write of ours lands, every later entry for that row is measured from
that time (`since`, kept on the device, as a send may stop midway).

**The reader is told, even with every tab shut** (Will, D9: A). `HeldStore` says
`lost` (`LostWrite`: its id, row, time and why). `serveData` KEEPS it as a notice,
`{ kind: 'lost', id, store, key, why }`, in IndexedDB (`notices`, in the one Sherpa database), says it
on `NOTICE_CHANNEL`, and says every kept one again when a page asks. A page asks
as `onUpdate` starts, by `postMessage` to its worker — a message starts a stopped
worker, and a channel cannot. `noticeSeen(id)` tells the worker to forget one.

**Demos:** a warning banner listens for `lost` on each Context, and each lost
notice is an item in Notifications, keyed by its id; picked, it is seen, and the
next page is not told. Measured 2026-11-02 in Demos' remote mode, all three
engines: the server's newer change stays, the banner shows, the item comes back
after a reload, and once picked the worker keeps none.

- Site: `src/core/data/store.ts`
- Site: `src/core/data/request-store.ts`
- Site: `src/core/data/data-handler.ts`
- Site: `src/core/data/fake-remote.ts`
- Site: `src/core/data/notices.ts`
- Site: `src/core/browser/notice-keep.ts`
- Site: `src/core/browser/updates.ts`
- Site: `src/core/worker/serve-data.ts`
- Site: `test/unit/a-newer-write-wins.test.mjs`

### T-one-feed-for-every-tab

**One live feed for every tab, held by a TAB, not the Service Worker** (plan 652
S8). A worker is stopped when it is idle, in every engine, and a feed held there
would drop with it. So `shareFeed(feed, name)`: the tab that holds the Web Lock
`sherpa-feed:<name>` opens the feed and passes each wire message on the channel
`sherpa-feed:<name>`; every other tab applies it with `feed.hear(raw)`, which
tells no one. When that tab shuts, the browser lets go of its lock, and the next
tab waiting takes it and opens the feed. With no Web Locks a tab opens its own,
as before. Measured 2026-11-02 in Demos' Dashboard (`?live`): two tabs, one
`/live/alerts` connection, both tiles follow it; the first tab shut, the second
opened the feed and went on — in all three engines.

**A message in the hand-over can be lost:** the next tab opens a new feed. A
Server-Sent Events server that keeps `Last-Event-ID` can replay it.

A live store says each message off the wire as `message` (its raw data) before it
applies it; `hear()` applies one without saying it, or two tabs would pass one
message back and forth.

**One election, one name each** (plan 695 H1, bug 7). `oneTab(name, { lead, hear })`
is the ONE leader election: the tab that holds the lock `name` runs `lead`, and
every tab talks on the channel `name`. `shareFeed` leads `sherpa-feed:<name>`;
`followUpdates` leads `sherpa-news`. Before, the news feed took
`sherpa-feed:updates`, so a feed shared as `updates` waited for its lock for ever,
and each wrote the election out again.

- Site: `src/core/data/live-stores.ts`
- Site: `src/core/browser/share-feed.ts`
- Site: `src/core/browser/one-tab.ts`
- Site: `test/unit/one-feed-for-every-tab.test.mjs`

### T-news-is-pushed-by-the-server

**The app's SERVER says what is new, on one small feed** (Will, plan 687, A: *"we
don't have to rely on polling"*). A Service Worker cannot find news by itself: the
browser stops it when idle, so it holds no timer and no connection. So the server
offers `updatesFeed()` — Server-Sent Events, at `UPDATES_PATH` (`/sherpa/updates`), the
one name the server and the follower share — and says each
notice on it: `{ kind: 'app', build }` or `{ kind: 'data', store }`. It says THAT
something is new, never the data.

**One tab follows it, and only ACTS** (`followUpdates()`, the tab that leads
`sherpa-news`, `T-one-feed-for-every-tab`): `app` asks the browser for the new worker
(`registration.update()`), which takes every tab over; `data` sends
`POST <base><store>?recheck` (`T-an-act-is-a-post`), so the worker reads that store again behind its held set,
and its newer rows wait. What either finds reaches every tab as a notice
(`T-a-notice-is-heard-never-ordered`), so the feed passes nothing on, unlike
`shareFeed`. A notice is a HINT: a tab whose build did not change finds the same
worker, and a store with nothing newer finds nothing, so one feed serves every
client.

**A follower that comes back hears what it missed — the replay IS the catch-up
check** (U3, Will: A): each event's id is `<boot>-<n>`, and the feed keeps its last
100. `Last-Event-ID` from this start of the server replays what came after it;
nothing missed, nothing sent. Where it cannot say it all — the server started since,
or let some go — it says ONE `{ kind: 'gap' }`, whose id is the latest, and the
follower checks everything once: the new worker, and `POST <base>?recheck` with no store
name, which rechecks every store the worker serves (one holding nothing returns at
once). Each store's check behind still asks only what moved since its own History
mark (`T-a-remote-store-says-what-changed`). A follower with no id hears only what
comes next. An idle stream says a comment every 25 s, so no proxy shuts it.

**Where no feed answers, every tab polls** (U4): `followUpdates()` starts each tab on
`watchForUpdates()`; the holder says `live` when its feed opens and `down` when it
is refused, on the channel `sherpa-news`, and a tab that opens later asks. A
refusal (a 404, not an event stream) shuts an `EventSource` for good; a dropped
connection retries by itself, and stays live. An app calls `followUpdates()` ALONE,
never `watchForUpdates()` beside it. Measured 2026-11-03 in Demos: the feed live, a
tab shown again polls 0 times, and a second tab 0 times; the feed refused, once.

- Site: `src/core/data/updates-feed.ts`
- Site: `src/core/browser/follow-updates.ts`
- Site: `src/core/data/data-handler.ts`
- Site: `src/core/server/worker-script.ts`
- Site: `test/unit/news-is-pushed-by-the-server.test.mjs`

### T-a-query-falls-back-to-post

**A read is a `QUERY` with its query as a BODY, so a long filter never breaks a
URL; where a server or a proxy refuses it, the same body goes as `POST`** (plan
652 S10). `RequestStore` sends `QUERY` (the Sherpa protocol, Host C's shape); a
405 or 501 sends the same body as `POST`, and every read after it is `POST` — the
handler takes a `POST` of a query as the query (S1). A read that fails at the
network tries `POST` once and keeps it only if that answers: a CORS preflight that
refuses `QUERY` looks exactly like offline, and offline must not stick.
`method: 'POST'` starts there.

**`RestStore`, for a server that is not Sherpa's, sends `GET` with query
parameters by default** — most take nothing else. `method: 'QUERY'` (or `'POST'`)
sends the Sherpa query as the body, with the same fallback; its answer is read
by `rowsPath` and `totalPath` as before. Measured in Node: a 20,000-character
filter went as a body, refused `QUERY` fell back to `POST`, and stayed there.

- Site: `src/core/data/request-store.ts`
- Site: `src/core/data/stores.ts`
- Site: `test/unit/a-query-falls-back-to-post.test.mjs`

### T-a-list-has-a-limit

**A field with more values than a filter lists offers its Advanced conditions
alone** (Will, plan 652 D10: A). `MOST_LISTED` is 200. Over it, `filterDef` gives
no options, `advanced: 'only'` and `op: 'contains'` (or the field's own op);
`isList` is false, so no walk tallies it and no chip counts it; `unlisted(field)`
says so, and a page's first answer skips it. The grid's own heading filter, where
no source defines one, stops at the same limit.

Measured 2026-11-02 in Demos' `?remote&rows=100000`, 4x CPU: the grid's Email
heading drew 100,001 menu rows — 437,000 elements on the page, every grid query
walking them. With the limit: LCP 13.5 s → 5.0 s, a preset pick 3.6 s → 0.36 s,
Apply 0.7 s → 0.2 s. At 100 rows nothing changes: Email has 100 values.

A number or a date is never cut: neither is a list. A legend that lays out a
field's values as chips (674) draws none for an unlisted field.

- Site: `src/core/data/field-catalogue.ts`
- Site: `src/components/sherpa-data-grid/grid-filters.ts`
- Site: `test/unit/a-list-has-a-limit.test.mjs`

### T-a-status-is-worked-out-by-the-data

**A status field's value is named by conditions on a row's OTHER fields, and the
data works it out** (Will, plan 683: *"It all comes from the data."*).
`statusFields(store, { health: { type: 'status', values: [...] } })` wraps any
store. Each value has `when`: a list of conditions in the one condition language
(`T-one-way-to-write-a-condition`) — the value matches when ANY holds, each when
ALL its fields do, as that language joins fields with AND alone. The first value
that matches is the row's; one with no `when` takes the rest; a row none take has
no value.

**Each value is made its own filter**: its conditions, and NOT any value before
it (De Morgan, each operator's opposite). Row values are tested with those same
filters, so a row's value and a filter on it never disagree — even on an empty
field, which neither side of `lt` takes. An operator with no opposite
(`startswith`) before another value is refused when the store is made.

**A filter on it is conditions on the fields it reads**: each clause on the field
is tested against every value's name — `ne`, `in`, `contains` alike — and becomes
the OR of those values' filters. The store under it never hears of the field, so
a server answers it. A field's kind is read from its condition: a number is a
number, `last`/`next` a date (made absolute for today), else as written — with
no kind, `60` compiled as the text "60".

**It replaced a number's `thresholds` and the `band` condition** (plan 683 S5, Will's
D3: A): a number's zones come only from a status field over it (`zonesOf`), and a
filter names a status value as any value. One way to name a value by a condition.

**It sorts and groups as any list field does, A to Z** — the store under it
cannot, so such a read is ordered over its matches here. It says its values in
order, each with its look, as its domain (`statuses`). A change to a field it
reads is a change to it, in a change event and in `changes()`. A write that names
it is refused. Under `fakeRemote` and a worker's `HeldStore`, the held rows carry
the value, and a page filters by it.

**On the page** (S2): a status field's domain says each value's look, and the
catalogue gives each option it as its `swatch`. A grid cell whose field's options
wear a look draws its status icon and its plain label, in a row (Will).

**A gauge's zones come from it** (S3): its domain also carries each value's
conditions (`when`), and `zonesOf(number)` finds the status field whose values are
each one condition alone on that number (`lt`/`lte`) — the last none — and makes
them zones, in order: At risk below 60, Watch below 80, Healthy the rest. The gauge
over `score` draws them; its legend picks the STATUS field's values, as any legend
does, and the gauge is free of that field. A status field the View holds opens on every value (`start: all`):
a list the View holds otherwise opens on its first, and Records opened on At risk
alone (measured).

- Site: `src/core/data/status-field.ts`
- Site: `src/core/data/field-catalogue.ts`
- Site: `src/components/sherpa-data-grid/sherpa-data-grid.ts`
- Site: `test/unit/a-status-is-worked-out-by-the-data.test.mjs`
- Site: `src/core/data/threshold.ts`
- Site: `src/core/data/aggregate.ts`
- Site: `src/core/ui/context.ts`
- Site: `src/components/sherpa-provider/sherpa-provider.ts`
- Site: `src/components/sherpa-gauge-chart/sherpa-gauge-chart.ts`
- Site: `src/components/sherpa-gauge-chart/sherpa-gauge-chart.html`
- Site: `test/e2e/reforged-gauge-chart.spec.ts`
- Site: `test/e2e/reforged-provider-summary.spec.ts`
- Site: `src/components/sherpa-data-grid/grid-cells.ts`

### T-one-condition-system

**Every answer a filter can have is condition rows, compiled by one function,
and its TYPE — Simple or Advanced — is decided once.**

Will, 2026-09-25: *"Default filter modes are also technically conditional
filters… So we can use the same engine regardless of filtering mode… We should
call it a Custom Condition Filter. Default is a Default Condition Filter. We
use the blue info styling to represent active Custom Condition Filters.
Bringing everything into the same condition composition system will help us
deal with any discrepancies and bugs."*

**There are three answer shapes** — ticked picks, ONE typed condition (`op` +
`text`), and a tree of rows — and the bar sends all of them at once, so a reader
of the state would have to guess which counted.

`fieldState()` builds **`state.answer`** — the whole answer in force as ONE tree
(`T-one-condition-tree`):

| the reader | becomes |
|---|---|
| ticked one value | an `eq` leaf — EQUALS X |
| ticked several in ONE field | EQUALS X **OR** EQUALS Y, so one `in` leaf |
| dragged a range | a `between` leaf |
| typed a condition | its own leaf, its `op` and the typed text |
| built a tree | the tree, as it is |

`stateClause` compiles `answer` and nothing else — each preset's tree ANDed to
it — through one `conditionClause`.

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

**And so does the grid.** `GridFilters.light` asks `fieldState()` for its
column's condition, so a heading's `fx` and green follow the same rule as a
toolbar chip — "Is not" is Advanced there too.
TRAP T-a-held-clause-op-is-not-a-reading-op

The public attributes speak these words since 2026-09-25; the old ones went on
2026-10-14 (`T-a-rename-drops-the-old-name`).

- Site: `src/core/data/filter-state.ts`
- Site: `src/core/data/filter-face.ts`
- Site: `src/data.ts`
- Site: `src/components/sherpa-quick-filter/sherpa-quick-filter.ts`
- Site: `src/components/sherpa-menu/sherpa-menu.ts`
- Site: `src/components/sherpa-data-grid/grid-filters.ts`
- Site: `test/unit/one-condition-system.test.mjs`
- Site: `test/e2e/reforged-one-condition-system.spec.ts`

### T-saved-filters-are-every-scope

**A reader's saved filters are FILTERS on the entity shelf** — Will, plan 960 U4.4c (A, 2026-11-14): Save filters writes
Filter entities, the one type (D6); the keeper's `filters`, the bars' `added`, the `saved:` presets and the page's own
`savedFilters` are gone. A page's own named filters are its scopes' `presets`.

- **Saving**: `filters-save` and `filters-save-as` ask the HOST for a name, which calls `provider.saveFilters(label)`.
  The filters on screen (`filtersOf(viewQueryOf(source))`, no arrangement) become one Filter per scope that holds an
  answer (`filtersOfSaved`): "<name>" for one scope, "<name> · <scope's label>" for each of several; each id free on
  the shelf. A filter the reader had off asks nothing, so it is no part of one; All is an answer
  (`T-all-is-an-answer`). Off `saveAnyScope`, ONE local scope's: the one named, or the bar's that asked (TODO 485).
- **A chip like any Filter**: each is a preset of its store's pages (`T-a-filter-is-a-preset-of-its-store`), so the
  shelf's watch lays it on the bar of the scope that holds its fields, off, as the bar's own filters still say the same.
  It is app-wide and crosses tabs, as every entity does.
- **Rename** (`renameFilters`) saves the new name, then publishes (a name is part of a version, plan 972): its id stays,
  so its chip and its uses keep it. **Delete** (`deleteFilters`) turns it off, then removes it; the shelf refuses while
  another entity uses it, and `whyKept` says why. Each is the reader's own Filter only.
- **Asked from its chip**: the provider declares a reader's own Filter's preset with `mine`, its entity id, which the
  source's describe carries to the bar. Its chip (a boolean, `data-kind="boolean"`: its body still turns it on) has a
  caret, and its menu holds Rename… and Delete: requests, `filter-rename` and `filter-delete` with `{ id }`, which the
  app answers through the provider; a filter panel says its sections' as its own. An app's preset has no menu. There is
  no Saved menu, and no `savedSets`.
- **The old ones move once**: an app's one-off page reads the old `sherpa:page:<key>.filters`, saves
  `filtersOfSaved(...)` to the shelf and deletes the key. The keeper ignores a key it has no part for, so an old one costs
  nothing else.

- Site: `src/core/browser/saved-filters.ts`
- Site: `src/core/data/query.ts`
- Site: `src/components/sherpa-provider/sherpa-provider.ts`
- Site: `src/components/sherpa-quick-filter-toolbar/sherpa-quick-filter-toolbar.ts`
- Site: `src/components/sherpa-quick-filter-toolbar/sherpa-quick-filter-toolbar.html`
- Site: `test/e2e/reforged-provider-saves-filters.spec.ts`
- Site: `src/components/sherpa-provider/provider-page.ts`
- Site: `src/components/sherpa-filter-panel/sherpa-filter-panel.ts`

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
| `canHold(name, field)` | `name === VIEW` or the component has it |
| `move(field, from, to)` | ONE call, ONE `query-change` naming every scope it touched |

**`move()` is one call because the removal is not optional.** Two `hold()`s
can be interrupted between them, and a field filtered in both the view and a
component has nobody owning it. Its single event means no listener ever sees
the field in both places, or in neither.

**A refusal is not half a move.** A component asked to hold a field it does
not have changes NOTHING and reports `scope-refused` — see
`T-a-broken-assumption-reports`.

`VIEW` is `'view'`, the same word as `reach: 'view'`, exported so no caller
spells it twice. (`VIEW_SCOPE` was a second name for it, gone 2026-10-14.)

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

- Site: `src/data.ts`
- Site: `test/unit/up-is-open-down-is-closed.test.mjs`
- Site: `test/e2e/reforged-menu-row-note.spec.ts`
- Site: `test/unit/a-raise-narrows-at-once.test.mjs`
- Site: `src/core/data/query-context.ts`
- Site: `test/unit/both-answers-are-kept.test.mjs`
- Site: `src/core/data/query-edits.ts`

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
values is. `docs/history/FILTER-REVIEW.md` §7 step 4c and §19 carry the rest.

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

- Site: `src/core/data/field-catalogue.ts`

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

### T-component-extends-view-never-alters-it

**The rule lives in `docs/DATA-SOURCE-RULES.md`, section 6** — two scopes, one
field one scope, and a superseded chip. It is a data-layer rule, so it belongs
with the other data-layer rules rather than in a trap.

What belongs HERE is why there is no module for it. Up is open and down is
closed — below the View, what the View holds is not offered, but what it fixes
(`T-a-scope-below-narrows-within-a-fixed-field`) — and that is one skip list in
the source's `addable()`; a component scope's answer is ANDed under the View's
in the one Query.

Guessing an API before its caller costs more than waiting for it: a module
written in advance once dropped a promoted field's op and typed text — "Starts
with Go" arrived as "Go" — and nothing caught it, because nothing ran it.

See `T-a-superseded-chip-suspends-it-is-never-removed`, which IS implemented,
on the half a component owns.

- Site: `src/core/data/source-view.ts`

### T-apply-and-discard-wait-for-a-change

**Apply and Discard exist only for a field whose change waits — and only
once it has changed.** Will, 2026-09-26 (off until a change) and 2026-09-27
(TODO 62: only for a REMOTE fetch). The panel's footer, and the snapshot it
kept of every field, are GONE: locally a change applies as it is made; over a
remote source a changed field shows its OWN Apply and Discard, at the right of
its ACTION ROW beside Reset (TODO 98), from the source's `data-pending` field
list. Its Apply commits that field alone (`commit({ field })`), its Discard
puts back the applied answer — picks, rows and typed text (`discard({ field
})`). While any change waits (`data-dirty`), the panel's footer is back with
Apply all and Discard all, which name no field: `commit()`, `discard()`.

A field that only ARRANGES (group, sort) is left out of the snapshot; it acts
at once and has nothing to apply.

**Step 6 of the Query moves the rule into the data layer.** Apply is only for
a REMOTE fetch (Will, 2026-09-26), and remote is a fact about the STORE
(`capabilities.remote`: `RestStore` says so, and `fakeRemote()` makes any store
act remote). Over a remote store the
source keeps a DRAFT Query beside the applied one: every write lands in the
draft, the rows wait, and `commit(scope?)` sends it; `discard(scope?)` puts
the applied answers back and draws them. `pending(field)` and `dirty(scope?)`
are the difference, pushed to each bound control as `data-pending` (a field
list) and `data-dirty`. Over a local store the draft IS the applied Query —
one object — so nothing is ever pending. A scope that narrows one component
(a legend) applies at once even on a remote store: its rows are already here.

**A LOCAL scope can wait too** (TODO 406): `query.wait(scope)` splits the draft
over a local store, and only that scope's answers wait; every other scope, and
what each scope holds, is copied onto `applied` at once, and a field that moves
scope carries its answer. The app waits its View, so a page fetches nothing
until its Apply. A bound control over a waiting scope wears `data-waits`.


**Every scope, where the app asks** (Will, TODO 436): `provider.applyEvery`
waits each scope the page DECLARES, not only the View; a chart's legend scope
stays live — its section has no Apply. Off sends what waits. `wait(scope,
false)` tells the bars again AFTER it stops waiting: the commit's own drawing
still said it waits, and a bar kept its Apply.

- Site: `test/unit/a-waiting-scope-holds-its-picks.test.mjs`
- Site: `test/e2e/reforged-the-view-waits-for-one-apply.spec.ts`
- Site: `src/core/data/data-source.ts`
- Site: `src/core/data/fake-remote.ts`
- Site: `src/core/data/store.ts`
- Site: `src/core/data/stores.ts`
- Site: `src/data.ts`
- Site: `test/unit/query.test.mjs`
- Site: `test/unit/headless-data-layer.test.mjs`
- Site: `src/core/ui/bind-source.ts`
- Site: `src/core/data/data-source-types.ts`
- Site: `src/core/data/query-context.ts`
- Site: `test/unit/a-bar-apply-commits-its-own-field.test.mjs`
- Site: `src/components/sherpa-provider/sherpa-provider.ts`
- Site: `src/core/data/query-members.ts`

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
answer is cleared, and its sort, group and search stay in the Query in the
scope that names them — none named, the rows stay as they are (366 steps 8,
9). A restore (no `keep`) is exact.

Two things this found. A NUMBER chip never reported — the bar's `readings`
skipped every body menu, so a Seats range showed on its chip and filtered
nothing; one number under an operator is TYPED text (`{ op: 'gt', text: '2'
}`), because picks on a number with no list build no clause. And the old
views hid their filters in a `view` part no chip showed; that part is gone.


7b, the Dashboard: its header answers the View scope, so a Region pick by hand
filters the charts (it filtered nothing before — only a View could), and its
own axes (severity, storage) sit in a `page` scope no bar answers. A host must
`hold` its header's chips in the View scope, or a view drawn onto the bar
removes them. A saved View is JSON for a source with a Query, and a
content view's `after` now gets `rendered` — the Capacity view's charts had
never been bound.
- Site: `src/components/sherpa-quick-filter-toolbar/sherpa-quick-filter-toolbar.ts`
- Site: `src/core/browser/persist-view.ts`
- Site: `src/core/data/query.ts`
- Site: `test/unit/query.test.mjs`
- Site: `src/components/sherpa-provider/sherpa-provider.ts`
- Site: `src/core/browser/view-files.ts`
- Site: `src/components/sherpa-provider/provider-page.ts`
- Site: `src/core/data/query-context.ts`

### T-a-page-goes-out-as-json

**A page's whole state goes out as JSON and comes back: `provider.export()` /
`provider.import(state)`, over `source.query.export()`.** Since 695 U3 it is the
page's one document, `PageState` `{ v: 3, view?, query?, draft? }` — the Query
every source shares, and what waits for Apply; any other shape (v2's `queries` by
source, v1's `sources`) is reported, `unknown-state`, and a Query with no one
Query to take it, `provider-no-query` (`T-one-page-one-document`).
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
- Site: `test/e2e/reforged-provider.spec.ts`
- Site: `test/unit/headless-data-layer.test.mjs`
- Site: `src/core/data/data-source-types.ts`
- Site: `src/core/data/query-context.ts`

### T-a-component-default-outlives-a-view

**A component's OWN filter — `data-where`, a condition by field as JSON
(`T-one-way-to-write-a-condition`) — narrows that component alone, and a View
pick keeps it.** Provider
P3e, 2026-09-27. The Dashboard's Critical tile counts critical alerts only;
before this it was bound by hand, because a component filter written into the
Query vanished at the first View pick: `setQuery` replaces the whole Query, and
a View is a clean slate.

The provider reads the attribute (the component's own, never inherited) into
readings and calls `source.query.declareDefault('own:<id>', readings, { only: el })`: a scope
that narrows that one component, like a legend's. The source keeps it as a
DEFAULT and puts it back under any Query that does not name that scope — a
View, or a restore from before the component joined. A View's JSON may name
the scope to change it. When the component leaves, its default goes with it.

**It holds on a field the View holds, too** (TODO 237). A field lives in one
scope, so `compile()` sets aside a component scope's answer to a View-held
field — right for a chip or a legend, which move UP. A component's own filter
is not a chip: it is what the tile IS. The source names its own scopes
`fixed`, and compile never sets one aside. The scope joins them BEFORE its
first write compiles — after, and the first compile had already dropped it,
with no report.

Narrowing one component needs a bound `rows: 'all'` component — a summary —
or `write` reports `component-part-on-a-page`. Bad JSON reports
`provider-bad-readings`, and the component filters nothing of its own.

- Site: `src/components/sherpa-provider/sherpa-provider.ts`
- Site: `test/e2e/reforged-provider-summary.spec.ts`
- Site: `test/unit/headless-data-layer.test.mjs`
- Site: `src/core/data/query.ts`
- Site: `src/core/data/query-edits.ts`
- Site: `src/core/data/query-context.ts`
- Site: `src/core/data/query-declarations.ts`

### T-a-heading-asks-through-the-source

**A grid's column heading answers through the source, and is told what the
View holds.** Provider P3d, 2026-09-27. Before it, Records listened for
`column-filter-change` itself, selected the field, committed, and drew the
field's normal chip onto the bar by hand (`showChip`) — and a second listener
(`syncHeadings`) read the Query on every change to tell the grid which
headings the View held.

`column-filter-change` is a steering event now, for a grid bound to a scope:
the heading's reading is its field's — `query.ask({ scope, field,
reading, commit: true })` — and a field no scope holds is held in
the grid's scope first, so its bar is drawn the field's normal chip, from the
Query. A BOUND heading asks, then is drawn: it writes neither its filters nor
what it drew before it reports, and `drawReading` fills them (366 step 23). A field the View holds is sent to every grid below it with its
APPLIED answer (`supersede`), shown read-only; the source sends it
when the View's holds change, when a View answer is drawn, and on commit.

Only a SCOPED grid: an unscoped one has no place for it in the Query, so its
answer is drawn straight back to it, and a page wires the rest.

- Site: `test/unit/headless-data-layer.test.mjs`
- Site: `src/core/ui/bind-source.ts`
- Site: `src/core/data/query-edits.ts`

### T-a-panel-asks-for-its-scopes

**The filter panel ASKS for its scopes (`data-scope="view data"`), and the
source draws each WHOLE from the Query — `describe(scope)`: what it holds and
answers, its presets by name, what it may add, how its rows are arranged. It
hears the panel's answers, Add, Remove, Apply and Discard itself.** Provider
P3c, 2026-09-27. Before it, Records built the panel from the BARS —
`fillPanel` read `bar.held` and `bar.offering`, mapped each def with
`asPanelField`, and connected every panel event back through `barFor(scope)`,
refilling two frames later because a rebuilt bar reads empty.

A field a scope ABOVE holds keeps its place in the scope below — its heading,
and the line a raised chip's tooltip says (`movedTo`), no values
(Will, TODO 87 and 88). A request the panel makes of a scope is drawn onto
that scope's bar from the same description (`drawScope`), so the bar and the
panel are two views of one answer. The panel is redrawn once per moment, when what a
scope holds or its presets change — never on an answer, which `drawReading`
draws.

Panel mode is CSS now: a bar in panel mode shows only its persistent chip
(the View), so a field the panel adds is hidden on the header without a page
reaching into the bar's shadow root.

- Site: `src/core/data/data-source.ts`
- Site: `test/unit/headless-data-layer.test.mjs`
- Site: `src/core/ui/bind-source.ts`
- Site: `src/core/data/data-source-types.ts`
- Site: `src/core/data/source-view.ts`

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

**Counts, menus and chains trickle down too** (TODOs 347–349): a component
chip counts within the View's subset, its menu is greyed by it — with Limit off
as well — and its serial chain starts inside it
(`T-one-walk-counts-and-limits-in-order`).

**So does a search** (Will, TODO 519: *"The data grid toolbar search input
filters at the view scope but it should be at the local scope."*). A summary's
load spread the page's load options and swapped only the filter, so it kept the
grid's search; and with no window the summary reused the page's rows, searched.
A search held in a component scope now stays out of a summary's rows, and counts
as a split, so the summary is asked on its own. A search at the View still
reaches everything.

- Site: `src/core/data/data-source.ts`
- Site: `src/core/data/query.ts`
- Site: `test/e2e/reforged-provider-summary.spec.ts`
- Site: `test/unit/query.test.mjs`
- Site: `test/unit/a-search-stays-in-its-scope.test.mjs`
- Site: `src/core/data/source-reads.ts`

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

**A type says it first** (plan 960 U2, 2026-11-13). A type file (`type.v1`)
says what each field's DATA is: its kind, name, line, values, their names and
looks, and its bounds. `typeSchema(type)` makes the store's rules and its
`domains` from them, and a source declares its store's domains before a page's
own fields, so a page says only what its controls do (`select`, `op`,
`advanced`, `section`, `range`), and its own word wins. A status field's name
and line ride its `statusFields` domain the same way. `typeColumns` makes a
grid's columns, and a column with no `header` is headed by its source's
label. `typeFields(type, page.source.fields)` answers both together for a
reader with no source open. A field the graph holds says `from`, and
`readFrom` reads it; nothing writes it, so it has no rule.

- Site: `src/core/data/data-source.ts`
- Site: `test/unit/headless-data-layer.test.mjs`
- Site: `src/core/data/data-source-types.ts`
- Site: `src/core/data/source-view.ts`
- Site: `src/core/data/type-definition.ts`
- Site: `src/data.ts`
- Site: `test/e2e/reforged-a-heading-says-its-field-label.spec.ts`

### T-configuration-is-not-data

**What a page sets ONCE is configuration; what a provider pushes on every
change is data.** §9 item 9, 2026-09-27 — P1 had split them by hand in the
grid (three setters, a merge, a coalescing flag). The grid is still the one
component with configuration, so it keeps them apart itself (plan 695 P6 moved
the door out of `SherpaElement`).

`columns`, `key` and `actions` are its properties. A setting redraws with the
last DATA beside it; data that names one of them sets it; data that does not (a
provider's rows) keeps what the page set. Three setters in one moment redraw
ONCE — each would otherwise draw the config the one before had not drawn yet,
which is the race P1 met. The spec reads them as the grid's own accessors.

The MCP's `validate_page` checks a `ui` before a page opens, against the specs:
each id an element in the markup, each key a property or a method its spec
lists, and none read-only. The provider says the same at run time
(`provider-unknown-setting`, `provider-refused-setting`), once it is too late.

- Site: `src/components/sherpa-data-grid/sherpa-data-grid.ts`
- Site: `src/components/sherpa-provider/sherpa-provider.ts`
- Site: `src/core/data/page-definition.ts`
- Site: `mcp-server/lib/check.js`

### T-no-rows-is-still-an-answer

**A day with no rows, or a range whose ends no row holds, is an answer: 0
matches, and the chip stays on.** Will, 2026-10-22: *"A chip with 0 matches,
that returned successfully, should still be active and green until the user
toggles it."* A field's `values` are the days its rows hold, and `fieldState`
counted a pick only when that list named it, so the View's Date picked Today,
matched nothing, and was dropped: no clause, 100 rows, the chip drawn off. Now a
RANGE's ends are its values (as its own comment always said), a DATE's day is
added to its list, and "every value ticked is no filter" never applies to a
date. A failed FETCH is not this: that is 411's critical chip.

- Site: `src/core/data/filter-state.ts`
- Site: `test/unit/no-rows-is-still-an-answer.test.mjs`

### T-a-pending-chip-reads-as-a-warning

**A chip whose change is not applied yet is PENDING: it wears the WARNING
look.** Will, 2026-10-22 (TODO 406): *"Use the warning style on filter chips
where the selected values have changed but not yet been applied."* It was the
active edge and no fill (TODO 46): a chip that goes straight to active before
its change applies misleads the reader. An Advanced chip is the same — it turns
on only once applied.

Only a change that WAITS can be pending: a remote one (TODO 62), or one in a
scope that waits for its bar's Apply — the View (TODO 406). Elsewhere a pick
applies at once and goes straight to active. So a chip
is pending when its own OPEN menu holds a draft (`menu.dirty`, which is only
ever true for a committing menu), or when its bound source lists its field in
the bar's `data-pending` — a panel edit waiting for its Apply.

The look is a PIN (`'&[data-pending]': warning` in state-pins.yaml, written
after the on pin so it outranks it); the chip's CSS only thickens the edge, as
an on chip's, and its tip starts "Unapplied changes - " (Will, TODO 406).

A DRAFT in a bar chip's own open menu is the CHIP's to show (TODO 415): it
hears its menu's events and sets `:state(drafting)`, pinned `warning` too, its
count held back and its tip led the same way. The bar no longer sweeps every
chip on six event types for it. `data-pending` is then the SOURCE's half only.

The chip's `data-pending` has ONE writer — its HOST, the bar or the panel — and
both write it through ONE door, `markField` (`filter-host.ts`): a panel field marks EVERY chip
of its run, its tier parents and its menus, as the bar marks its one chip. Until
424 the panel marked only a field drawn as one chip, so a run of values never
read as a warning, and its menus' Discard was always off. Two writers of one
attribute each undo the other's answer.

ONLY WHAT CHANGED (Will, 2026-10-22: *"Just the altered value chips need to be
styled."*). The source tells a bound control each waiting field's APPLIED answer
(`drawApplied`, beside `data-pending`), and a field marks only the chips whose
tick differs from it; one chip is its whole field.

- Site: `src/core/ui/filter-host.ts`
- Site: `src/core/data/data-source-types.ts`
- Site: `src/components/sherpa-quick-filter-toolbar/sherpa-quick-filter-toolbar.ts`
- Site: `src/components/sherpa-quick-filter/sherpa-quick-filter.css`
- Site: `src/components/sherpa-quick-filter/sherpa-quick-filter.html`
- Site: `test/e2e/reforged-pending-chip.spec.ts`
- Site: `src/components/sherpa-quick-filter/sherpa-quick-filter.ts`
- Site: `src/core/ui/shared-constants.ts`
- Site: `src/core/ui/filter-host-controller.ts`

### T-an-advanced-answer-reads-as-its-conditions

**An Advanced answer reads as its conditions — on the chip's face, in its tip
and on a grid heading:** each condition's word, its value in brackets, the join
between, `!` before a negative one: `equals(John) AND contains(Smith)`,
`!equals(John) OR !contains(Smith)`. Will, 2026-10-22 (TODO 409). A date's `eq`,
`lt` and `gt` read `on`, `before`, `after`; a typed count reads `last(7 days)`.

`spellConditions()` spells the answer's tree — its ANSWERED parts only. A
half-built row narrows nothing, so saying it would promise a filter that is not
there.

- Site: `src/core/data/filter-face.ts`
- Site: `test/unit/filter-state.test.mjs`
- Site: `test/unit/filter-face.test.mjs`

### T-a-reload-replays-the-readers-answers

**Filters survive a reload by restoring the reader's QUERY — their answers,
in their own terms — never a compiled filter.** Will, 2026-09-24: filters and
Advanced filters survive a refresh and a trip away and back, for the
session. Measured 2026-09-26 before the fix: the page kept the source's
COMBINED filter — Region = EMEA + Status = active came back as 4 rows with
every chip empty. A filter no one could see or clear.

The page's document keeps `source.query.applied` as its `query` — the answers,
and the sort, group and suspended sort with them (366 step 8) — and what waits for
Apply as its `draft`. `source.query.setQuery()` puts it back and DRAWS each bound
bar its scope (`drawScope`, silent) — nothing replays a control (step 3 of
docs/QUERY-DESIGN.md). Its `ui` keeps each component's own state — a grid's
selection — never the Query (366 step 10).

Three orderings make it work:

- **The URL's View is applied by the Context at init** (`init(root, { view })`).
  A host that picked it after init would reset the header chips just restored
  (`T-a-view-change-resets-the-header-chips`).
- **The kept Query belongs to ONE View.** It is restored only on the View it
  was made on; a View change is a clean slate. Will, 2026-09-26; a view's OWN
  default filters belong in its definition (TODO 70).
- **The grid's column filters are read back FIRST**, so their chips are on the
  bar before it is drawn.

The keeper keeps it in the tab's tier: a reload keeps it, another tab, window
or session does not. Only a filter the reader SAVES crosses those (Will,
2026-10-20, TODO 370; `T-only-a-named-part-crosses-tabs`).

- Site: `src/components/sherpa-quick-filter-toolbar/sherpa-quick-filter-toolbar.ts`
- Site: `src/core/data/data-source.ts`
- Site: `src/components/sherpa-provider/provider-page.ts`
- Site: `src/core/data/query-context.ts`

### T-a-heading-holds-a-whole-reading

**A grid heading holds a whole reading, not one condition.** The old
`ColumnFilter` held an op and a value or picks, so:

- a CHAIN set from outside (`['or', ['owner','contains','Da'], ['owner','startswith','R']]`,
  from the chip mirror) was read as `[field, op, value]` — an op of the first
  sub-clause and "picks" of the second: `["owner","in",["owner","startswith","R"]]`;
- a chain typed INTO the heading applied only its first row.

Since TODO 102 it holds the menu's `FieldReading` itself — both answers, the
mode and the mirror — and `ColumnFilter` is gone. The clause and the label
come from the data layer (`readingClause`, `spellConditions`). A clause set
from outside is read WHOLE: `filterCondition()` makes it the tree it is, and
`treeReading()` the reading — Simple where a Simple control says it, else
Advanced, nested as deep as it was (`T-one-condition-tree`). A redraw is held
AS IT IS: through a clause, only the answer in force came back.

The rows reach the menu only once it has DRAWN. The heading upgrades its menu
and sets `menu.reading`, and the menu keeps a reading given before it drew
and applies it at the end of its first render (`#flushChains()` is gone).

- Site: `src/core/data/where.ts`
- Site: `src/components/sherpa-data-grid/grid-filters.ts`
- Site: `test/unit/filter-state.test.mjs`
- Site: `test/e2e/reforged-data-grid.spec.ts`

### T-a-view-held-heading-shows-and-refuses

**A grid heading whose field a HIGHER scope holds shows that answer, and
refuses changes.** Will, 2026-09-26: Region = EMEA in the header lit the grid's
Region heading (the query's `data-filter-fields`), but its menu showed nothing
ticked — so a reader could pick a contradicting value there. His ruling:
shown, but held higher.

`supersede(readings, appliedAt)` names the fields a higher scope holds,
each with its answer. Such a heading draws that answer — handed to its menu as
a reading, as its own is — with the chip's superseded look and tip ("Filter moved to View scope. This chip
holds EMEA."), and its menu `data-readonly`: rows and conditions `inert`, no
footer, no Add condition, no Advanced button. A pointer opens that menu, as a
key does (Will, TODO 598). A bar's held chip refuses both. The heading's own filter is
never set by it (`columnClause` stays null), so nothing applies twice. A field
not named is released.

The source calls it whenever what the View holds changes
(`SourceBinding.supersede`). A heading that ALREADY held its own filter when the View took
the field applies none of it: the Query answers a View-held field in the View
alone (`compile`, "one field, one scope"), and the grid marks the View's
matches, not the heading's own. The heading keeps its answer for when the View
lets the field go.

**A tiered field's CHILD is held with its parent** (TODO 577, Will: A). Site has
no filter of its own (TODO 369), yet while a higher scope holds Customer its
heading shows what Customer's answer holds of it — each path's child — greyed and
refused. It is picked in the View's Customer chip. Let go, its heading has no
filter again.

A CELL's chip on such a field shows inactive and refuses before a pick (374),
and does not show on a value the View filters by: it has nothing to take off
there (Will, TODO 456).

- Site: `src/components/sherpa-data-grid/sherpa-data-grid.ts`
- Site: `src/core/data/query.ts`
- Site: `src/components/sherpa-menu/sherpa-menu.css`
- Site: `src/components/sherpa-menu/sherpa-menu.ts`
- Site: `src/components/sherpa-menu/sherpa-menu.ts`
- Site: `src/components/sherpa-menu/sherpa-menu.css`
- Site: `test/e2e/reforged-data-grid.spec.ts`
- Site: `test/e2e/reforged-menu-readonly-rows.spec.ts`
- Site: `src/core/data/source-binding.ts`
- Site: `src/components/sherpa-data-grid/grid-cells.ts`
- Site: `src/components/sherpa-data-grid/grid-filters.ts`

### T-a-component-part-narrows-one-component

**A `component` part on the SHARED source is the View's reach under another
name.** Will, 2026-09-26: *"Chart legend toggling is behaving like View scope
filtering. They should only affect their chart."* `bindSelection(…, { reach:
'component' })` contributed a named part to the source — and every component
bound to that ONE source obeys every part, so switching a series off in the
bar chart's legend narrowed the grid, the metrics and the donut too.

So a legend's answer is a SCOPE in the Query that `narrows` its one chart:
`source.query.write(scope, field, reading, { only: el })`, which
`bindSelection(…, { only })` calls. `compile()` keeps it out of the shared
filter and returns it under `only[bindId]`; `SourceBinding.push` applies it to that
component's rows, and the push guard re-pushes when it changes. A bind's id is
`bind({ id })`, else the element's own id. The component must be bound
`rows: 'all'` — filtering one PAGE would lie about its total — so a write for a
paged bind is refused and reported. A narrowing scope is its component's
alone: `scopeOf()` skips it, so a field's answer at its home never lands there. A legend passes its chart, the element
whose `legend` slot it sits in. Measured on Records: the bar chart 4 → 3 bars,
the grid stays at 100, the donut at 4 slices.

The stub source the older scope tests use records `contributions` and never
applies them, which is why none of them caught it; the new test uses a real
`DataSource` with a chart and a grid bound.

- Site: `src/core/data/query.ts`
- Site: `src/core/data/bind-selection.ts`
- Site: `test/e2e/reforged-filter-scope.spec.ts`
- Site: `src/components/sherpa-provider/provider-legends.ts`
- Site: `src/core/data/source-binding.ts`
- Site: `src/core/data/query-edits.ts`

### T-a-chart-scope-is-its-legend-field

A chart has a scope of its own in the filter panel, and it is ONE Simple
filter: the legend's field, a chip per legend item, each with its series'
swatch. No Advanced, nothing to add, nothing to save. Will, TODO 52.

It is the scope the legend already writes (`picks:<legend id>`, narrowing its
chart alone), DECLARED: `source.query.declarePart(scope, { field, only, label })`.
Three things follow from the declaring, and each was a hole without it:

- **It is drawn before it is answered.** An unanswered scope is pruned from the
  Query, so `describe()` reads the declaration, never `holds`.
- **A write from anywhere narrows the one chart.** The panel has no pointer to
  the chart; a reading asked finds `only` in the declaration. Without it the scope
  came back WIDE and narrowed every component.
- **Both views are told.** The legend hears `query-change`; a panel is
  drawn `drawReading(field, reading, scope)` — and takes it BY SCOPE, because
  a chart's field is often the grid's or the View's too.

A panel draws the parts after the View and before every other scope. The
swatch is the value's place in the field's declared values, from 1 — the same
number the chart paints by.

**Shown in its card's bar** (Will, TODO 670). With legend chips on and a filter
toolbar in its slot, the part is declared `shownIn: <slot>`. The slot's `describe()`
lists its one filter with `answeredIn: <part>`, so the bar's requests for it name
that scope and it still narrows its chart alone; the bar is drawn its answers, counts
and limits with its own. The chart takes `data-no-legend` and keeps no room for the
legend. With no bar, the legend draws the chips itself (`data-chips`, TODO 586).
In the bar it is its values alone (`data-layout="values"`, Will, TODO 674): a value
chip each, its swatch and a badge with its CHART's number, which the provider hands
the bar from the legend (`drawCounts`) — the walk's counts are rows, not what the
chart counts. It sits in the bar's one row and, short of room, folds whole into Edit
(TODO 675).

SENT UP, the answer goes to the View with its field and the chart lets go of
it; its section then says where the filter went. The View draws only a field
it knows, so declaring a part declares its field.

- Site: `src/components/sherpa-provider/provider-legends.ts`
- Site: `src/components/sherpa-quick-filter/sherpa-quick-filter.html`
- Site: `test/unit/chart-scope.test.mjs`
- Site: `src/core/data/data-source-types.ts`
- Site: `src/core/data/query-context.ts`
- Site: `src/components/sherpa-filter-panel/panel-column.ts`
- Site: `src/core/data/source-view.ts`
- Site: `src/core/data/query-declarations.ts`

### T-a-legend-follows-the-view-when-it-holds-the-field

A legend narrows its own chart (`T-a-component-part-narrows-one-component`) —
UNTIL the View holds its field. Then the View's answer is the one in force, so
the legend shows IT, and a press changes IT: every component narrows, and the
View's chips follow. Will, TODO 159.

Before, a legend always wrote its chart's own scope. With the field sent up,
the View said "Disk" while the legend showed every item on, and a legend
press narrowed one chart under a View filter nobody had changed from there.

`bindSelection` asks at each draw and each write — `source.query.holds('view',
field)` — so nothing is cached, and it hears `query-change` (a scope moved) to redraw when
the View takes the field or lets it go. Taken, the binding DROPS its own
answer: two answers to one field, one of them hidden, is the bug. A press
writes plain picks; rows the View kept stay kept, in Simple mode.

- Site: `src/core/data/bind-selection.ts`
- Site: `test/unit/chart-scope.test.mjs`

### T-a-reading-is-frozen-in-the-query

**What the source hands out is the Query's own, frozen; what it takes in is
copied** (366 step 6, finishing 319). `select()` and `write()` copied one layer,
so a caller's condition rows became the Query's, and `supersede` handed
a grid the APPLIED readings, which the grid kept: an edit on either side moved
the other, with no event.

So `copyReading` copies what comes in, all the way down; `ask()` freezes every
reading of the Query it puts in place (`freezeReading`, every write passes
there); `reading()` and `defaultFor()` hand out the frozen original, with no
clone. A caller that wants to change one spreads it and sends it back. An edit
to a frozen reading throws a `TypeError` in a module — loud, never silent.

- Site: `src/core/data/query.ts`
- Site: `test/unit/a-reading-is-frozen-in-the-query.test.mjs`
- Site: `src/core/data/query-context.ts`

### T-a-context-holds-the-only-query

**One Query per app Context, and the Context holds it.** 366. A
`QueryContext` holds the Query — applied and draft — and every declaration a
page makes about it: scopes, offers, parts, sets, defaults. A source keeps no
Query of its own; it JOINS the Context's (`new DataSource({ store, query })`)
and reads it live, and `source.query` is that Context. The provider makes one
per page it opens, and a Context's module gets it as `ctx.query`.

Before this, each source held its own Query, and four controls each held a
copy of their answer beside it; every bug of the filter rewrite was one holder
copying another wrongly. Every edit now goes through the Context's one door, each
member hears it at once, and the Context fires ONE `query-change` for it.

- Site: `src/core/data/query-context.ts`
- Site: `src/components/sherpa-provider/sherpa-provider.ts`

### T-a-source-compiles-only-what-it-has

**Sources that share one Context's Query each compile only what is theirs.**
366 step 25. A scope another source shows rows in is THAT source's: its
readings narrow that source alone, and its sort sorts that source alone. A
reading on a field a source lacks — a View's `severity` over a customers
source — is skipped there, not compiled into a filter that matches no row.
Each skip is listed in `debugState().skipped`: a scope's id, or `scope.field`.

What a source "has" is what it can know without guessing: a declared field,
declared values, its store's `domains` or `time`, or a key in a loaded row.
A load that matched no rows says nothing, so it never makes a field missing.
And the rule applies only with two sources or more: alone, a source applies
every reading, as before, and a page's bench is unchanged.

Sorting keeps one arranging scope per SOURCE: a sort in one source's scope
clears that source's arrangement and the page's, never the other source's.
With one source every scope is its own, so this is today's single scope.

- Site: `src/core/data/query.ts`
- Site: `src/core/data/source-counts.ts`
- Site: `src/core/data/data-source.ts`
- Site: `test/unit/two-sources-one-query.test.mjs`

### T-one-query-one-owner

**A page's data is under ONE Query, in the reader's terms, and a filter is
only ever its OUTPUT.** docs/QUERY-DESIGN.md. Nearly every filter bug of
2026-09-26 — 41, 55, 56, 21e, 44, 72, 42 — was one answer held in two places
that disagreed: a chip and the source, a heading and a selection, a compiled
filter restored over empty chips.

A `Query` holds scopes; each scope holds fields, each field's `FieldReading`,
and — for one scope — sort, group and search. It lives in a `QueryContext`
with what the page declares about it (366 step 12): `source.query` IS that
context, and a source given none makes its own. Every change is the context's: it
edits the Query, each source hears it and does its own work, and then ONE
`query-change { fields, scopes }` tells the page (366 step 17).
`compile(query, facts)` is the ONE place it becomes a filter, and it is pure:
a field the View holds is answered there alone, a suspended reading applies
nothing, and a scope that `narrows` reaches only those components. The
compiled filter is never saved; the Query is.

- Each reading lives in the scope that holds its field — the View first, else
  the one component scope, else the View, which narrows everyone. A `hold` or
  `move` carries the reading with its field, so the rows never change on a move.
- A bind's `scope` makes the source DRAW that control each answer in it
  (`drawReading`), so a bar and the portrait column need no mirror. A column
  heading is a view of its field's reading too: the grid is bound to the `data`
  scope and drawn the same way, and a field with no chip gets its NORMAL chip.
- A scoped bar's saved filters are `presets` in its scope, on or off; their
  readings sit in the source's library (`declarePreset`), never in the Query.
- A restored Query (`setQuery`) draws each bound bar (`drawScope`) — see
  `T-a-reload-replays-the-readers-answers`.
- A legend's answer is a scope that `narrows` its chart, and survives a reload
  with the rest.
- A field a scope lets go of, held nowhere else, loses its answer — removing a
  chip is a clear. The draw carries the WHOLE answer: an operator dropped reads
  "is not churned" as "churned", and a typed text dropped reads "contains an" as
  nothing.

**A bar sends ONE REQUEST per act, never its whole answer** (366 step 21). The
whole answer cleared every field it did not name, so a bar that reported while
a rebuilt menu was still empty wiped answers it showed. An event with no
`request` asks nothing; a list is one change, and its Applies go at its end.

- Site: `src/components/sherpa-quick-filter-toolbar/sherpa-quick-filter-toolbar.ts`
- Site: `src/components/sherpa-data-grid/sherpa-data-grid.ts`
- Site: `src/core/data/data-source.ts`
- Site: `src/core/data/query.ts`
- Site: `src/data.ts`
- Site: `test/e2e/reforged-filter-scope.spec.ts`
- Site: `test/unit/query.test.mjs`
- Site: `src/core/ui/bind-source.ts`
- Site: `src/core/data/query-context.ts`
- Site: `test/unit/query-context.test.mjs`
- Site: `test/unit/an-echo-is-a-no-op.test.mjs`
- Site: `test/unit/one-field-requests.test.mjs`
- Site: `test/e2e/reforged-data-source.spec.ts`
- Site: `test/unit/a-rebuilt-bar-cannot-clear-a-field.test.mjs`
- Site: `test/unit/an-unscoped-bar-is-reported.test.mjs`
- Site: `src/core/ui/filter-host-controller.ts`
- Site: `src/core/data/source-view.ts`
- Site: `src/core/data/query-members.ts`
- Site: `src/core/data/query-edits.ts`
- Site: `src/components/sherpa-data-grid/grid-filters.ts`

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
  set its unique values, sorted, and a number its lowest and highest — one
  `distinct()` ask, or one load of every row where the store has none, and only
  when a field needs it.
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
views, view, key })` builds the source over the app's store (`openSource`,
DOM-free), draws every filter bar from its scope as the source describes it —
the View chip first — gives each bar its Add list, and provides it all with the
Query its keeper kept under the page's name. A reader's saved Views join the
shipped ones by that name, so `saveView(label)` needs nothing from the page.

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

### T-a-page-is-checked-as-it-opens

**A page definition's names are checked ONCE, by `checkPage`, as it opens** —
plan 695 D1. Before it, the names were checked in several places at several times,
and a page that named a missing scope opened, and showed less, with nothing said.

- `checkPage(page)` is DOM-free and one pass over the JSON: a server, a test and the
  MCP call the same function. It reports each broken name and answers true when
  there is none. The provider calls it first in `open()`.
- The builders after it are QUIET: `openSource` leaves out what it cannot use and
  says nothing, so a page is never reported twice. Calling `openSource` by hand
  checks nothing: call `checkPage` first.
- What a schema says (a type, an op) is `schemas/page.v1.json`'s, run in tests and
  tools. `checkPage` checks the NAMES, which no schema can.

- Site: `src/core/data/page-definition.ts`
- Site: `test/unit/page-definition.test.mjs`

### T-a-fork-unfolds-its-picks

**A Fork sends rows on by ONE field's value, an output per value picked** (Will, plan 991 D6 A; plan 992: a Condition
is one test, Pass and Fail; a Fork many places. Will named it Fork, 2026-11-14, so a Route stays a full path from a
Start node to an End node, PRINCIPLES 19). A Field joins its header; its Ways row is one dropdown of ticks of that
field's values (as a Condition's Is one of); each value picked UNFOLDS an output row right after it (`v-<words>`, a
clash `-2`), and Otherwise comes last. One door, `rowsOfNode`, gives a node's rows with what its pick unfolds: the
drawing, a run (`forked`) and the text lens's forks all read it, and `socketType` knows a `v-` row is an output of rows.
A row goes the way of its value, a list cell the way of the first value it holds that is picked; the rest, Otherwise.

- This is the unfold door U4.7a built and 5626a8fcd took away (a Field's values became one dropdown): back for a
  node whose outputs ARE its picks, never for a value row.

- Site: `src/core/data/node-kinds.ts`
- Site: `src/core/data/node-simulate.ts`
- Site: `test/unit/a-fork-sends-rows-by-value.test.mjs`
- Site: `test/e2e/reforged-a-fork-has-an-output-per-way.spec.ts`

### T-format-is-the-one-text-door

**Text from values and rows is ONE type, Format** (Will, plan 992 O2: Append and Prepend went; plan 991a). Its
Template is a message, its values named as an Output's message names them (`{{value:<node>.<name>}}`), filled through
the one fill (`filled`). Rows that reach its Data: one text per row, each named value that row's field. Values only: one
text, each named value what its node sends. So Append is `"{{value:a.value}} Ltd"`, Prepend `"The {{value:a.value}}"`;
Split and Join stay, as they make and join lists.

- Site: `src/core/data/node-kinds.ts`
- Site: `src/core/data/node-simulate.ts`

### T-a-row-offers-its-stores-values

**A field that declares no values offers the values its store holds** (Will, plan 986 D1 A: "as soon as the graph is
drawn (no Fetch needed)"; "a source node isn't directly a Data Source. It's the Data Source via the Data Store in the
Data Layer"). `withStoreValues` (field-catalogue.ts) fills each undeclared field of each store through the catalogue's
one read, `fromRows`: the store's own `distinct` where it has one, else its rows, each value once, sorted, at most
`MOST_OFFERED` (500), the menu's search finding among them. Declared values lead, as declared. A number or a date is a
range and takes none. Every row that reads a field's values (`here`) has them then, in a workflow as in a Query.

- **The editor reads them once, as a graph opens**, then draws again. A store that changes is read again at the next
  open. An editor a canvas has since been bound to again draws nothing late (`boundOn`).
- **A multi-select's choices are in its menu of ticks**, not its native `<select>`: a spec opens the menu as a reader
  does (`select.control`, then `.picks-menu`) and reads its inputs.

- Site: `src/core/data/field-catalogue.ts`
- Site: `src/core/ui/node-graph.ts`
- Site: `test/unit/a-row-offers-its-stores-values.test.mjs`
- Site: `test/e2e/reforged-a-row-offers-its-stores-values.spec.ts`

### T-a-row-takes-its-values-type

**A node row takes its value in its type's control** (Will, plan 986, 2026-11-14: "check all node input rows across
all nodes to make sure their options, or input type, makes sense"). A Value's Integer and Decimal are a number (an
Integer's step 1), its Date a date, its True/false a switch. A Condition's Value B, Start and End (`ofField`) take the
type of the field that reaches them, by `typedControl`: a number, a date; a text field and a field with choices keep
their own. The workflow (`here`) and a page's Query graph (`leafRows`) both call it, so they agree.

- **Typed once, as stored** (`T-a-value-is-typed-once`): an Integer holds `5`, never `"5"`; a number row holding text
  is a fault, as any number row's is. The graphs that held text were retrofitted, not read both ways.
- **Each fault said once**: a Value's number and date are checked by their rows' controls; its own type check keeps
  only True/false.
- **A time of day is no date**: a Schedule's At (`"02:00"`) stays text until a time control exists.
- **The sweep** (`a-row-takes-its-values-type`) walks every row of every kind: a pick has choices, `ofField` sits only
  on a test's value, a number or a yes-or-no is never text, a day is a date.

- Site: `src/core/data/node-kinds.ts`
- Site: `src/core/data/workflow.ts`
- Site: `src/core/data/query-graph.ts`
- Site: `test/unit/a-row-takes-its-values-type.test.mjs`
- Site: `test/e2e/reforged-node-warning.spec.ts`

### T-a-part-of-a-text-is-typed

**Contains, Does not contain, Starts with and Ends with test their header, the data, always** (Will, TODO 1002: "For
'Contains' conditions we don't need Value A. Value B can become Value A. It shouldn't show any options unless values are
connected to it, via a values output, or entered into the field manually"; the same for the other three, sherpa-demos-67's
reading). They have no Value A of 994 (`PART_OPS` in `compareType`). Their one value row keeps its name, `b`, and is
titled Value A: text, typed or joined, never a pick of the field's values (no `ofField`), as a part of a text is seldom a
whole value. No graph is retrofitted: `b` is still `b`.

- **A line into Value A on one is another type's**: kept, as switching back to Equals brings it back (off is not gone),
  drawn nowhere, and the run tests the header. No fault.

- Site: `src/core/data/node-kinds.ts`
- Site: `test/unit/a-part-of-a-text-is-typed.test.mjs`

### T-the-data-comes-in-at-the-header

**A test's data comes in at its header, always** (Will, TODO 994: "Condition nodes have an optional data input but the
data should always come in via the header socket"; pick A). A comparison, Not and Is empty have Value A (`a`, optional),
above Value B: the value to test when it is not the data (an AI step's True, a Count). With no Value A, the test tests
its header, as before. On one value, Pass and Fail send what came into the header, whole (`passes: true`, `sender`,
Simulate's `make`). And and Or join what comes in at the header, so they have no Value A. There is no Data row and no
alias: `R → c/data` with `T → c` was retrofitted to `R → c` with `T → c/a`.

- **With Value A joined, the header is data**: it is read as it comes, never as the tested value, so rows there do not
  warn "connect a Field in".
- **A column is tested on the header**, where its rows split: a column into Value A warns, and its Query leaf is none
  (`leafOf`).
- **Joined to Value A, the header's data is carried, not flow** (`graphSteps`), as the Data row's was: a step goes where
  the value it tests comes from, so a Runbook's prompt reads as before.

- Site: `src/core/data/node-kinds.ts`
- Site: `src/core/data/workflow.ts`
- Site: `test/unit/a-test-of-one-value-decides.test.mjs`

### T-a-merge-joins-by-a-field-of-each

**A Merge joins two sets of rows by a field of each** (Will, plan 992 O3 A: one Merge, its outputs Matched, Only in A,
Only in B and Changed; no Compare). A Field of the A rows on its header, one of the B rows on its B row (each `needs:
'field'`), so each set is read by its own Source, through its own store (PRINCIPLES 25). Matched: each A row with each B
row whose field's value is the same (`valueKey`), the A row's columns over the B row's, a row per pair. Only in A and
Only in B: the rows that match none. Changed: the matched pairs whose Compare columns differ; none picked, every column
both hold but the two fields. An empty value matches none.

- **What it sends holds the fields of both sets** (`joins` on the kind): `fieldsReach` unions each side's, A's first, so
  a Field after it picks a B field and is no stranger. Every other node reads the first Source up its connections.
- **No join where a type says it**: a value every page reads from a related type is the type's `from` field (plan 960
  U2); a Merge is a join one graph makes.

- Site: `src/core/data/node-kinds.ts`
- Site: `src/core/data/node-simulate.ts`
- Site: `test/unit/a-merge-joins-by-a-field-of-each.test.mjs`
- Site: `test/e2e/reforged-a-merge-joins-two-sets.spec.ts`

### T-a-category-is-a-column-the-model-makes

**Classify is an AI node's answer type, Category** (Will, plan 992 O6 A: no Classify node, and no second router; a Fork
sends the rows on). A Prompt, a Runbook or a Skill that Expects a Category names its Categories; its Answer `makes` a
column (a row's `makes`, the row whose picks are its values): named by its node, labelled by its heading, so a Fork
on it picks its Ways from the Categories (`sender` sends the column, values and all).

- **Simulate never asks the model**: its stand-in gives each row a Category in turn, so each way after it runs. With
  none picked it says so.
- **The column is the node's own**: a Field after the Fork does not see it yet; the store's fields reach it, as before.

- Site: `src/core/data/node-kinds.ts`
- Site: `test/unit/a-category-is-a-column-the-model-makes.test.mjs`
- Site: `test/e2e/reforged-a-category-feeds-a-fork.spec.ts`

### T-a-retry-is-a-setting

**A retry is a setting of the step that fails, never a step of its own** (Will, plan 992 O7 A: where a Runbook retries the
same step, it becomes that step's Retry setting; its prompt's RETRIES AND ERRORS reads it; a different step on failure
stays wired). Each kind that can fail (the AI steps, the Outputs but the Run result) has Retries and a Wait (minutes, `retry-wait`; plan 991: "Try N times with a wait"): numbers from 0, optional, with no socket.
A row's `setting` keeps it in the node's Settings tab, after Details (and an Output's Output tab); the canvas never draws it (`drawRows`).
`graphText` says each step's Retries in its errors: "A retry: step 2.1 Install patches, up to 1 more time, after a 10 minute wait".

- **Words are no setting**: a step named "Try again" was read as a retry from its words; that guess is gone with the
  wired retry steps, which the shipped Runbooks moved to the setting.

- Site: `src/core/data/node-kinds.ts`
- Site: `test/unit/a-retry-is-a-setting.test.mjs`
- Site: `test/e2e/reforged-a-retry-is-a-setting.spec.ts`

### T-a-value-is-typed-once

**A condition's value is typed ONCE, by its field's type, where it comes in** —
plan 695 D1. A number field's text `"70"` becomes `70` at each door: a menu's
condition row (its editor), a definition's plain form (`readingsOf`), a preset
(`presetReadings`) and a Simple reading's answer (`fieldState`). All call
`typedValue`. The compile (`leafClause`) casts nothing.

Typed anywhere later, one answer has two shapes: a host's
`setColumnFilter('storage', ['storage', 'gt', 70])` keeps `70` in the tree, a
reader who types 70 in the same menu keeps `"70"`, a comparison of the two says
they differ, and a View saved from the reader's writes `{ "gt": "70" }`. A preset
read with no field facts holds `"60"`, and a date preset's two ends become
`in [a, b]`, two days, not a range.

- Type at the door, never in a helper a lane may delete: `typedValue(type, value)`
  is the one cast.
- A Simple number reading keeps its `text` as typed: it is the control's, and is
  typed when it becomes a tree.
- A tree kept before this change, with a string, is typed by `fieldState` as it is
  read, its presets' trees too.
- A value that is not a number stays as given: `"n/a"` on a number field is text.

- Site: `src/core/data/filter-state.ts`
- Site: `src/core/data/where.ts`
- Site: `src/core/data/page-definition.ts`
- Site: `src/data.ts`
- Site: `test/unit/a-value-is-typed-once.test.mjs`
- Site: `src/components/sherpa-menu/menu-conditions.ts`
- Site: `test/e2e/reforged-number-advanced.spec.ts`
- Site: `src/core/data/query-graph.ts`
- Site: `src/core/data/workflow.ts`

### T-an-operator-shapes-its-value

**A comparison's Value is ONE value under Equals, and a tag LIST under Is one of and Is not
one of: the operator shapes the row.** Plan 749 P4; an array is an object (D17), so the list's
socket is an `object`. The operator is the Condition's type (plan 783 D4), so `resolveKind` gives
Is one of its own Value B — `control: 'tags'`, `multiple`, an `object` input — and every reader
sees the shape; nothing else learns of operators.

- **A change carries the value.** On a type change (an operator is one), `editWorkflow` moves a
  row's value between its shapes: one value becomes the list of its comma parts; a list
  becomes its one item, or several joined by commas. Going back gives it again. A Value's
  Text and List do the same.
- **A connection stays joined through a change of shape** (Will, TODO 770: any connection joins any
  input). A Text connected to Equals' Value B, then Is one of picked: the connection is drawn,
  Values reads null and the node warns ("Values takes a list; it was given "Pro""); Save writes
  it, and Equals again reads it. A List into Is one of, then Equals, the same. Only a socket
  that is GONE keeps its connection in the draft (`keptConnections`).
- **A file from before tags** is no longer read (Will, TODO 777): a tags row holding one value
  is a fault ("which is no list"), as any list row's is.

- Site: `src/core/data/node-kinds.ts`
- Site: `src/core/data/workflow.ts`
- Site: `test/unit/a-node-row-says-its-own-fault.test.mjs`

### T-a-multi-select-is-one-row

**A multi-select in a node is ONE row: the node's own dropdown input, opening a menu of ticks.** Never a row per
choice, never a chip. Will, 2026-11-13: *"It should be just 1 dropdown with a mulit-select menu on a single node row."*
*"In nodes this is the preferred approach for multi select scenarios."* *"In Source nodes, the Field selection is being
shown as a chip. Again, it should be a dropdown input. Same goes for Notification channel selection. I've no idea why
you decided to use chips instead of following precedent."*

- **The precedent is the single pick.** Every row with `multiple` (a Field's Values, a Source's Fields, a Notification's
  Channels, a Condition's Is one of where its values are known, a flow's step of several in the outlet's dialog) draws
  with the SAME dropdown a single pick uses:
  sherpa-input-text's select, with `multiple`, its menu the tags field's menu of ticks. One input, one door.
- **The Field's Values** (`valuesOf: 'field'`) offers only the values its OWN field declares, and draws only where it
  declares some. It sends what is picked: one value, or the list (`pickSent`, the one rule for a pick of several);
  none picked, nothing, and its hint says so. A pick its field no longer declares is a fault, shown (`rowFault`).
- It replaced U4.7a's row per value (`unfold`, the `v-` rows) and the node's multi-select chip (sherpa-quick-filter):
  both are gone.
- **Select all leads the menu**, as a filter chip's (Will, 2026-11-14: "'Select all' needs to be an option in the Fields
  input on Source nodes and the Values input on Field nodes"): the menu's own row, all, some (mixed) or none. It ticks
  the boxes; the row keeps its meaning: a Source's Fields all ticked keeps none (All); a Field's Values all ticked
  keeps every value, an answer (TODO 965).
- **A row where none means every choice** says `every` (a Source's Fields, TODO 969: "defaults to All"). Nothing is
  kept, so a field the store gains later is in it too; the editor DRAWS every choice ticked (`ticks`), and every choice
  ticked again keeps none (`read`). The data layer's drawn value stays what is kept, so Simulate and the reach read the
  truth (`fieldsSent`). Any pick of several with every one of two or more ticked says "All" on its face, as a chip's
  Select all.

- Site: `src/core/data/node-kinds.ts`
- Site: `src/core/data/node-input.ts`
- Site: `src/core/data/node-simulate.ts`
- Site: `src/core/data/workflow.ts`
- Site: `src/core/ui/node-graph.ts`
- Site: `src/components/sherpa-input-text/sherpa-input-text.ts`
- Site: `src/components/sherpa-input-text/input-picks.ts`
- Site: `src/components/sherpa-input-text/sherpa-input-text.html`
- Site: `src/components/sherpa-outlet/sherpa-outlet.html`
- Site: `test/unit/a-field-is-a-node.test.mjs`
- Site: `test/unit/a-logic-type-is-an-operator.test.mjs`
- Site: `test/unit/a-node-row-says-its-own-fault.test.mjs`
- Site: `test/e2e/reforged-node-row-controls.spec.ts`

### T-a-row-says-its-own-fault

**A value its row cannot hold is a fault of the ROW, said in words in the row, red.** Plan 749
P4. `rowFault` is the one statement of what a control cannot say: a stranger in a CLOSED tags
list (a field whose values are known), a Start or End that is no date, a number off its
`step` (Places, a span's Value: whole) or under its `min`. `workflowFaults` names it (`the
node "c"'s Value: …`) where a value is held and where a connection BRINGS it from a node that
holds it (`the connection "l/value" → "c/value": …`), and `workflowGraph` puts the same words on
the row as `fault`, for its own value or the one mirrored in. So the drawing and the check
never disagree, a connection that would bring a stranger is refused (`take()`), and Save
refuses while one stands.

- **It is never an orphan.** A row a type change hid, or a connection the other operator takes,
  is the draft's (`T-an-operator-shapes-its-value`): no fault, no warning.
- **Drawn in the field's own message**, `data-error`, which `sherpa-input-text` leaves to its
  host (`T-a-host-error-is-the-hosts`): a click in and out does not wipe it.
- **A number row with no `step` takes any number** (`step="any"`): the platform's own step
  is 1, and called 3.14 invalid on a blur. A count's `min` and `step` are mirrored, so its
  steppers stop at the bound.
- **A date is ISO in the data and words for the reader.** The field shows `formatDateTime`
  (`12 Jan 2024, 09:30`, the one day format, `T-a-date-reads-one-way`); a typed date, in those
  words or ISO, is read back by `readDateTime`, and one it cannot read is kept as typed, so
  its fault can say it. The calendar is fetched with the first date row.
- **A Unit's words follow the count beside it**, from the platform (`Intl.NumberFormat`,
  unit style): "1 day", "7 days".

- Site: `src/core/data/node-kinds.ts`
- Site: `src/core/data/workflow.ts`
- Site: `src/core/ui/node-graph.ts`
- Site: `test/unit/a-node-row-says-its-own-fault.test.mjs`
- Site: `test/e2e/reforged-node-row-controls.spec.ts`

### T-a-logic-type-is-an-operator

**Logic's comparisons ARE the data layer's operators: ONE list, `OP_LABELS`, names them in a filter
menu and Logic's Operation select.** Plan 749 P5. `condition` is the Logic family (D1), ONE test per
node (Will, plan 783 D4): And and Or join the tests that come in, then Figma's six comparisons, then
Not and Is empty, then Sherpa's other operators. A comparison's type id is its `FilterOp`, its label
`OP_LABELS[op]`. A copied label is a second vocabulary. Change the word in `OP_LABELS`, and every
place says it: Figma's "Greater than or equal" reads "At least" here.

- **A comparison tests what comes in on its HEADER** (plan 783 D3): a Field's column, or one value
  (`needs: 'tested'`). Value A is gone. Its rows are Rows, then what `OP_TAKES` says the operator
  takes: Value B, a tag list of Values (`LIST_OPS`), or Start and End. Rows with no Field warn:
  "Equals takes a field or a value; it was given rows: connect a Field in".
- **The Field on its header shapes it** (`fieldAt` in workflow.ts): Value B picks from the field's
  values where known and is typed by its type (a number field's "70" is 70), Values close to them,
  and a Value B that is no number for a number field is the row's own fault. An operator the field's
  type does not take is a WARNING, never a fault: "Contains takes a text field; it was given the
  Seats column" (graphs stay open).
- **The Operation lists what fits what comes in** (Will, TODO 940): a value's or a column's type
  picks its comparisons (`conditionFits`, by `OPS_FOR_TYPE`); rows or an object, And, Or and Is
  empty. A pick no input fits stays listed and warns (D1 A). In a mixture, an input the pick does not
  fit is IGNORED (`GraphNode.ignored`, D2 A): not read, no warning, its line dashed with a `<title>`
  tip; Simulate's `into` and `leafOf` skip it. An unknown field type is text, as `opWarning` reads it.
- **Every type leads with Pass and Fail** (plan 971 A): the rows that hold, and the rows that do not,
  so none is lost. They send rows only where rows reached its header — rows, a column, an object, or
  a test's Pass or Fail (`sender`). A test has no True row (plan 971 §9): on one value its Pass and Fail
  send what came into its header, else the value (`T-the-data-comes-in-at-the-header`).
- **In the last and In the next are Time › Duration's**, not Logic's: two nodes would do one check.
- **The header's input is the type's.** And and Or take many of anything (TODO 939), and Not one
  boolean; Is empty takes any value; a comparison any. Each one has a True property, 1 or 0 (plan 944). Nothing
  runs (N4): a runner reads a value as `truthy` reads it (D2).
- **A header's warning names the type** where the family has several: "Sort takes a field", "Not
  takes a boolean", not "Collection" or "Condition".
- **What a type change orphans is the draft's** (Will, 2026-11-05), and only a socket that is GONE
  orphans a connection (TODO 770). A column into a Condition switched to Not stays joined: Not's header is
  there, reads null, and the node warns ("Not takes a boolean; it was given the Status column"). A
  Value B switched away from is kept for its type, and Save leaves it out (`finalGraph`).
- **The Query draws its trees with it** (plan 783 D6): And, Or and the comparisons; Not and Is empty
  are a workflow's alone (`graphs`).
- **A tags field is tested by Is one of** (the Tag node went, plan 992 O4): its `where` (`nodeFlow`) is
  `{ field, op: 'in', value }`.

- Site: `src/core/data/node-kinds.ts`
- Site: `src/core/data/workflow.ts`
- Site: `test/unit/a-logic-type-is-an-operator.test.mjs`
- Site: `test/e2e/reforged-node-logic.spec.ts`

### T-a-node-reads-null-from-what-it-cannot-use

**A node reads what it NEEDS of what reaches an input; what it cannot use is `null` there, and the
node draws as a WARNING with a tip that says why.** Will, 2026-11-05 (TODO 764): "Nodes will
determine which data they need from the input. If there's no valid input then it's null and we
style the node as a warning with tooltip message." Graphs stay open (E5): a connection its socket
types allow is drawn; no family fences what a graph places.

- **What it needs is the kind's own description** (`needs`): a header that takes any type says
  it (a comparison a field or a value; a Count rows or a field
  (plan 783 D5); an Organise its rows, its fields in its own rows (plan 960 U4.2); a Field an object,
  Time a date; Is empty anything); a
  row says it by its
  control (a number, a date, one of a fixed list, an operator), by picking several (a list; Math's
  a list of numbers), or, a comparison's Value, by its field's type; else by its socket's TYPE
  (TODO 770: a value, an object, a boolean). `needOf` reads it; an `any` that says nothing takes
  anything (the Output, a Custom Node's header, Is empty).
- **What reaches is what the graph says before a run** (`givenAt`): the type its source sends,
  finer where its row says (`gives`: rows from a Rows row, a list from a List or Split by, a
  number from a Math Result or a Count), and the value a row with a control holds. A Value that
  holds nothing sends nothing (D2): no warning. What a node works out (a Text's Result) is known
  only when it runs: no warning until N4. An unconnected row is no such case.
- **A Field sends a COLUMN** (Will, TODO 783, D2): rows in, `{ rows, field }` out, an object whose
  finer given is `field`, carrying the field's name, words and type (`sentFrom` reads it through
  the connections, `columnOf` says it). One record in (an object that is not rows), the row sends that
  field's value. A column fits a need for a field, rows, an object or a list; a list of numbers
  where its field is a number; a date where it is a date. It never fits ONE value: "Value A takes
  a number; it was given the Seats column". Its row says "Seats: a number field". Its list is
  OPEN (D8): a field its Source's store lacks warns on the row ("is not a field of the rows that
  come in") and sends nothing, as a Value into its header does (`T-a-field-reads-its-sources-fields`). Rows where a field is needed say
  ": connect a Field in".
- **One door, `readInput`**: the value, or `null` and the words — `<input> takes <need>; it was
  given <what>` — all from `INPUT_WORDS` (a socket type in the words its tip says). The runner
  (N4) reads through the same door, and so does Simulate (`heard`, Will 2026-11-11: "fixed
  generically on how to handle data types"): a connected value is read by the row's need, whatever
  node sends it — a Math Result, a Count, an agent's True — and a Condition tests against what a connection
  brings to Value B or Start and End, not the row's own. Text that reads as a number is a number,
  as the row reads it (`T-a-value-is-typed-once`).
- **Drawn**: `workflowGraph` puts each on the node as `warnings` (by row; none, the header), the
  row reads `null` (read only, not "X Custom"), and `nodeFlow`'s incoming says `value: null`
  with the warning. `drawGraph` writes `data-warning`; `sherpa-node` pins the warning Style mode
  (`state-pins.yaml`: after `data-current`, so a picked one stays a warning; a run's step wins)
  and drops a category's tint, as a pick does. Its header is the tip's anchor and is described by
  it (`aria-describedby`), so a hover or keyboard focus shows the words, one line each.
- **A connected row that holds nothing shows nothing** (TODO 774). Where its connections send nothing yet
  (a Group Input row, a node only a run fills) and it holds no value of its own, `workflowGraph`
  draws it empty, marked `custom`, with "From Group Input › Status". A list's choices go with it:
  a select with no pick shows its FIRST choice, as if held. One that holds a value shows it until
  N4 runs.
- **Any connection joins any input** (Will, TODO 770, B): a type mismatch is no fault and no refusal,
  only this warning — "Value A takes a number; it was given rows". Grouping makes one socket of
  what its source sends. What stays refused is the graph's shape: a loop, the same connection twice,
  two into an input that takes one, a socket that is not there, a property row (it only sends), an
  output that says it sends any type, and a preset's header (read only). And and Or take any
  boolean (TODO 780, `T-a-condition-is-a-tree-of-nodes`): a boolean input reads true or false, 1 or
  0, and the words, by `truthOf`.
- **A boolean reads as what its input needs** (Will, TODO 781: "Where booleans need to be a number
  then nodes should convert True/False to 1/0. Where they need to be a String (or part of a larger
  JSON object) then the inverse should be handled."). ONE table, `COERCIONS`, beside `INPUT_WORDS`,
  and `readInput` reads it after what fits and before it warns: a number reads True and False as 1 and
  0; a value (text) as the words true and false, never 1 or 0; JSON (`nodeFlow`'s Outgoing) as `true`
  and `false`; a boolean reads a number by D2 (0 False, any other True) and the words true and false,
  while other text says no boolean, reads null and warns. A value is typed first: a Value of type
  True/false gives a boolean (`gives`), a Text "true" is text. A coerced value is used, and no warning;
  one only a run gives reads then. No node coerces by itself.
- **No fault, no Save block, never red.** A row's own fault (`T-a-row-says-its-own-fault`) is
  still red and holds Save; a connection the input cannot read brings no such fault.

- Site: `src/core/data/node-input.ts`
- Site: `src/core/data/workflow.ts`
- Site: `src/core/data/node-simulate.ts`
- Site: `src/core/ui/node-graph.ts`
- Site: `src/components/sherpa-node/sherpa-node.ts`
- Site: `src/components/sherpa-node/sherpa-node.html`
- Site: `src/data.ts`
- Site: `test/unit/a-node-reads-null-from-what-it-cannot-use.test.mjs`
- Site: `test/unit/any-connection-joins-any-input.test.mjs`
- Site: `test/unit/and-or-take-any-boolean.test.mjs`
- Site: `test/unit/a-boolean-reads-as-its-need.test.mjs`
- Site: `test/unit/a-field-is-a-node.test.mjs`
- Site: `test/unit/a-run-reads-each-input-by-its-need.test.mjs`
- Site: `test/e2e/reforged-node-warning.spec.ts`

### T-a-changed-key-moves-the-row

**An update that changes a row's KEY moves the row, in every store.** TODO 188,
found by the 183 review. `IdbStore.update` merged the change and `put` it: with
a new email under `keyPath: 'email'`, that wrote a SECOND row and left the old
one. `ArrayStore` changes the row in place, so the two stores Sherpa Demos
switches between did different things with the same Edit.

Now both: a changed key moves the row — `IdbStore` deletes the old key and
`add`s the new one in ONE transaction — and a key another row already holds is
refused (the delete rolls back with it). One test runs the same script over
both stores.

- Site: `src/core/browser/idb-store.ts`
- Site: `src/core/data/stores.ts`
- Site: `test/e2e/reforged-idb-store.spec.ts`

### T-one-way-to-write-a-condition

**A definition or a View writes ONE form of condition** (Will, TODO 197, B):
`{ "openTickets": { "gt": 0 } }`, numbers as numbers. An agent had two
grammars to learn — a store's `[field, op, value]` and readings with numbers
as strings, `{ "op": "gt", "text": "0" }`. The plain form is the ops by field:
several ops all hold, `and` / `or` take a list, `off` keeps it unapplied.

It goes under `where` in a View's scope and a page definition's saved filter,
in a stored saved filter, and in a component's `data-where`. **Readings stay
inside**: every control, event and the live Query speak them. The source turns
one into the other at the edge — `source.readingsOf(where)` and
`source.whereOf(readings)` — by its field types, so a number comes out a number.

It is SUGAR for the condition tree (`T-one-condition-tree`): `readingsOf` parses
each field's condition ONCE into its tree, then into the reading a control holds
— Simple where a Simple control says it (a list's picks, a date's two ends, a
number's one value under its op), else Advanced, nested as deep as it was
written. `whereOf` writes the TREE the field compiles from, so the two cannot
disagree. It keeps the answer in force only: Simple's picks or Advanced's tree,
never both, and nothing a control keeps for itself (`mirror`, `kept`, `present`).
An Advanced answer of one condition a Simple control can say reads back as Simple;
the filter is the same.

**A `where` holds conditions only.** A reading stored there before 197 — its
keys `picked`, `op`, `text`… — is not read: each key reports `unknown-op` and
the field filters nothing (Will, D4, 2026-10-14: no shim for old stored data).
A page definition's preset with `readings` and no
`where` reports `preset-without-where`. A condition nests freely: nothing in it
is unreadable but a key that is not an op.

- Site: `src/core/data/where.ts`
- Site: `src/core/data/data-source.ts`
- Site: `src/core/data/query.ts`
- Site: `src/core/browser/persist-view.ts`
- Site: `src/components/sherpa-provider/sherpa-provider.ts`
- Site: `src/data.ts`
- Site: `test/unit/one-way-to-write-a-condition.test.mjs`
- Site: `src/core/data/query-edits.ts`


### T-one-condition-tree

**A filter condition has ONE shape in memory: a tree.** Will, D1 A (plan 695):
`{ and: [...] } | { or: [...] } | { field?, op, value, off?, id? }` (`Condition`,
in `store.ts`, beside the wire `Filter` it compiles to). A field's Advanced
answer is `reading.tree`; a preset holds its tree per field (`byPreset[id].tree`);
a status value's `when` is parsed into one tree when `statusFields()` is made, and
its domain carries that tree (`zonesOf` reads it); a View, a saved filter and a
page definition WRITE the plain form (`T-one-way-to-write-a-condition`), parsed
once.

Nine shapes with six converters between them drop what they cannot carry: a
nested condition in a definition was thrown away, though the type and the schema
allowed it.

- **One compile.** `conditionClause()` is the one place a tree becomes a filter:
  numbers cast, a day with a time reaching its last moment, a tiered field's paths.
  `stateClause()` compiles `state.answer` — Simple's picks as their leaf, or the
  Advanced tree — and each preset's tree, ANDed.
- **A leaf in one field's answer names no field**: it is that field's. A tree
  across fields (a status value's) names each.
- **The menu edits the tree itself**: `menu.condition` reads and writes a
  `Condition`, no flat rows between (`T-many-conditions-are-one-reading`).
  Nothing in the data layer reads rows.
- **Off is kept on any node**; a part kept off compiles to nothing and spells nothing.

- Site: `src/core/data/store.ts`
- Site: `src/core/data/filter-state.ts`
- Site: `src/core/data/where.ts`
- Site: `src/data.ts`
- Site: `test/unit/filter-state.test.mjs`
- Site: `test/unit/one-way-to-write-a-condition.test.mjs`
- Site: `test/unit/a-status-is-worked-out-by-the-data.test.mjs`
- Site: `test/unit/page-definition.test.mjs`
- Site: `test/e2e/reforged-one-condition-tree.spec.ts`

### T-a-workflow-is-its-definition

**A workflow is ONE JSON document** — its nodes, each node's values, and the
connections between their sockets — checked by `schemas/workflow.v3.json` and by
`checkWorkflow`. Will, TODO 78; plan-78-workflow-data.md.

- **A node holds only what the reader may change**: its place, its own name and
  line, and each row's value by the row's name. What it IS — its header, its
  sockets, its rows — is its KIND's, in the one registry (`T-one-node-registry`).
  So a kind can gain a row and every saved workflow still loads.
- **The library ships the generic kinds** (Will, D2 A), each over a data-layer
  function it already has; an app adds its own beside them, as `{ ...NODE_KINDS,
  mine }`. Sherpa stays app agnostic. A kind a workflow does not run (a Query's
  scope) is reported.
- **A Filter node's rows are one condition**: `{ field, op, value }`, the condition
  tree's leaf, never a shape of its own. An `op` row holds an operator, a `number`
  row a number: `editWorkflow` types a value as its row takes it.
- **A v2 workflow** (Will, plan 713 D8): a node's data comes IN on its header, of any
  type (D1), and leaves from its property rows (`node/rows`, a test's `node/pass` and `node/fail`), which only send. No v1 ships,
  so none is read (Will, 2026-11-10): `readWorkflow` takes a v2, and anything else is
  the one fault "it is not a workflow definition: a v2". An entity's graph is made a v2
  by `entity-check`.
- **A socket is `node` or `node/row`**: the header's, for the whole node, or a row's. No
  node has a True or a False socket (plan 944). A connection joins an output to any input (TODO 770;
  one of another type reads null, `T-a-socket-says-its-type`); an input takes one connection
  unless it takes `many`, and no connection may close a loop, or nothing would run first.
- **`checkWorkflow` reports each fault and never throws**, as `checkApp` does: a
  definition from a store or an agent may be wrong, and the page still opens.
  `workflowFaults` says them without reporting: `bindWorkflow` refuses a new connection
  that adds one.
- **Each edit is pure** (`editWorkflow`): a value, a node's own name, line or place,
  a connection made — in place of the one into that input — or cut. `bindWorkflow`
  keeps the DRAFT in the tab (`SessionStore`, `shared: false`, TODO 551): a reload
  keeps every edit and move; the session's end forgets them. Save checks it, hands
  it to the app as `definition-save`, and drops the draft: the app keeps it where it
  keeps things. A connected row shows its own value, read only, until a run (N4) gives
  it the incoming one.

- Site: `src/core/data/workflow.ts`
- Site: `src/data.ts`
- Site: `test/unit/a-workflow-is-its-definition.test.mjs`
- Site: `src/core/ui/node-graph.ts`

### T-the-node-editor-asks-the-query

**The Node Editor is one more VIEW of a page's Query, and it ASKS.** Will, TODO
555; plan-78-query-editor.md; plan 960 U4.8. `queryGraph(query, definition, facts)`
draws the Source and each status field its store works out; **View Filters**, the
View's bar; a **Presentation** per component, each a Content; and the **View**
they go into, its two inputs View Filters and Content — from the LIVE Query, each
time it changes. A filter is a tree of Conditions on a Field that reads the page's
rows. It keeps no Query of its own; a change made in it is a `QueryRequest`, as a
chip's is (`graphRequest`).

- **Derived, not stored.** The same Query draws the same graph. Only the nodes'
  places, their bends and the Sources a reader keeps are the editor's (kept per
  tab, `T-a-second-source-is-kept`). A second view that kept its own copy
  of what the first answered caused six filter bugs (the old panel).
- **A bar is rows** (Will, U4.8 Q3 A): its Switch, a chip per held field in
  order, its pick in words, then a row per preset. The View's is on View
  Filters, where a filter's Pass joins its chip. A card's is on its
  Presentation, and its chips take no line: a card's own filter is ON ITS ROWS'
  PATH, its Pass into the Presentation (two or more through ONE And), then its
  Organise. A test of one value is no filter: it sends all its header's data one way. Moving a field
  between scopes is moving its tree, its root's Pass into a chip of
  View Filters or onto a card's path (`connectionRequest`), as Send to View is.
  A field the View answers but no bar holds still gets a chip, so its condition
  has a socket. The chips' order written back is the Query's (`orderRequest`).
- **Conditions are read in the plain form** (`whereOf`,
  `T-one-way-to-write-a-condition`), so the editor shows what the field filters
  by, never what a control keeps for itself; an `off` one is kept, not applied.
  A condition node is the READER's answer: a preset's rows in it are the preset's.
- **A preset is a node into its bar's row** (`@<id>`): its On, read from the
  Query (`presetHeld`), and what it writes, read only. A Filter over the store, a
  reader's saved one too, is a preset `filter:<id>`: its own graph changes it (plan
  960 U4.4c: there is no Saved filter kind). A status field is ONE Field node on the
  Source's rows, a row per value saying its rule, the rule its inside
  (`T-a-status-opens-its-rule`). A
  component scope's own answer the View holds over it (`superseded`) is a read-only
  condition into its chip, the one card chip with a line: it moves nowhere.
- **Laid out by depth**, in columns: Fields and Conditions, then each card's And
  and Organise, then View Filters over the Presentations, then the View. The
  reader moves what overlaps.

- **The page passes its components** (`facts.components`): a source keeps its
  binds private. Each is its own Presentation: its slot's, where the scope is its
  own, else its definition's kind. A card's bar is on one of them, the component
  named as its scope, else its first; a card with none still has its own
  Presentation. A load lights a scope's step on its bar's node
  (`QUERY_NODE.bar`).
- **`drawGraph` places a node where its graph says, when that place MOVED**; else
  it leaves the reader's. It WRITES NOTHING: a field's change is an edit it hands
  its host (`onEdit`), and a move too (`onMove`). `bindQueryEditor` keeps each moved
  node's place for the tab (`/node-layout/<page>`, `shared: false`, TODO 551) and lays it
  over the layout (`withPlaces`, `T-a-place-is-no-edit`): a reload keeps it, a new tab starts from the layout. `bindQueryEditor` turns each into the
  command a chip asks, through the one door (`query.ask`) — a reading, the
  Switch, a Sort, a Group (a slot's are its chart's) — so whether it applies
  at once or waits for Apply is the Query's, as for any chip (Q3). What a row
  may change is the graph's to say (`editable`, its `choices`).
- **Read only is the exception** (Will, 2026-10-29): a row a connection drives
  MIRRORS what comes in; a row nothing outside takes yet (the Source's search
  fields, its Apply on; a presentation on the View, which has no slot) says why
  in its hint. Everything else edits, through its door: page size, Field, a
  value, Search, a slot's Show as, Primary, Secondary, Group and Sort.
- **A field whose values are known is PICKED**, as its chip picks: ticks, Is one
  of or Is not one of. Equals is Is one of with one tick — the Query writes it
  so — and reads back as that.
- **A picked node opens the INSPECTOR**: its rows again, the same values and the
  same edits, with where each comes from and goes to. A Presentation shows a
  live COPY of the page's component, with no ids, which asks the provider as the
  page's does — so it draws what the Query says. The editor sits inside the
  provider for that; off its page, the copy is made from the page's markup
  (`markup`), and the provider holds the page (TODO 822,
  `T-a-graph-is-a-view-of-a-type`).
- **A drag from an OUTPUT socket draws a new connection** (Will, 2026-10-29). The
  drawing hears the press first, at the canvas, so it neither moves the node nor
  pans the view; let go within reach of an input socket, and the HOST is asked
  (`onConnect`). The Query takes a filter's tree into a chip of View Filters or
  onto a card's rows (`connectionRequest`): the same field in another scope MOVES
  it there; another chip's field takes it, keeping only the values that field has. A connection the Query has no
  meaning for — or one that would then say nothing — is REFUSED and reported
  (`query-connection`): nothing moves.
- **Save writes the definition** (`pageWithQuery`): each scope's holds, its own
  answers as its `where`, its slot's presentation over the definition's, and the
  page size. `checkPage` checks it; the editor hands it to the app as
  `definition-save`. A scope's sort, group and search are the page's too (plan 960
  U4.3); the places are not. The MCP writes back through the same door, the
  Query's lens (`QUERY_LENS`, plan 960 U4.5): what the Query cannot take — a
  read-only row, a cut connection — refuses the whole graph, in words.
- **The lens says what each node IS; the drawing is only drawn** (plan 1004c).
  `queryLensGraph` makes the definition (`LensNode`, lens-registry.ts) and the
  drawn node in ONE call per node, so they never disagree: its kind, values and own
  words, its `ref` (what it is to the Query: every request reads it), `editable`
  (the rows a reader may change; the rest are read only), `hints` (each row's
  words), `off` (kept, not applied), its own `icon` (a Filter's) and its
  `warnings` (a kept Source's); its id is QUERY_NODE's, in the order drawn.
  A reconcile reads `editable` and `hints` from the lens's definition
  (`queryOpened`), never off the drawing: the one drawing (1004d) adds defaults,
  kind headings and warnings, and a row it draws editable is still refused if the
  lens says no. A drawn graph is shaped enough like a definition to type-check as
  one, so `queryDefinition` takes `queryLensGraph`'s nodes, never a drawn graph's.

- Site: `src/core/data/query-graph.ts`
- Site: `src/data.ts`
- Site: `test/unit/a-query-is-drawn-as-nodes.test.mjs`
- Site: `src/core/ui/node-graph.ts`
- Site: `test/e2e/reforged-node-graph.spec.ts`
- Site: `src/core/data/query-document.ts`
- Site: `src/core/ui/query-editor.ts`
- Site: `src/core/data/query-lens.ts`
- Site: `src/core/data/lens-registry.ts`
- Site: `test/unit/a-lens-says-what-a-node-is.test.mjs`

### T-one-node-registry

**Every node kind is said ONCE, in `NODE_KINDS`** (node-kinds.ts), for every graph
Sherpa draws: a page's Query and a workflow. Plan 695 N1: two registries had let
`source` mean a store's rows in one and a page's source in the other.

- **A kind says its header, its sockets, its rows, what it stands for in the data
  layer (`model`), and where it is drawn (`graphs`)**. A Query node adds its own
  rows after the kind's (a scope's presets and fields).
- **One meaning per word**: a Source is where rows come from, in every graph: the
  store it names, a `SourceDefinition`; a Query adds how its page reads it (Page
  size, Search fields, Apply on). The Store kind went (TODO 808): a Store then a
  Source were two nodes for one thing, and Will's chain starts at Source. A row's
  `field` is a field of the rows, never its key; a row's `control` is what it
  draws; `op` is an operator, and a condition is the tree.
- **A kind's `description` is its synopsis** (Will, TODO 809): a few words on one
  line, said once here. It is the node panel's line, and a node's own where it has
  none. A family's types are never listed in it: search finds a type by its name,
  and an item found so says that type's help.
- **The graph is DERIVED, never stored**: from the definition and the live Query
  (`queryGraph`), or from the workflow definition (`workflowGraph`). Only places are
  the editor's, kept for the tab, and laid over (`placed`).
- **An edit is a command**: a Query node's is a `QueryRequest` through `ask()`
  (`graphRequest`, `T-one-command-one-door`); a workflow node's a pure
  `editWorkflow`. A value entered is typed by its field (`typedValue`).
- **Save hands the app a checked definition**, as `definition-save` on the canvas
  (`pageWithQuery` and `checkPage`; the draft and `checkWorkflow`): Sherpa never
  decides where an app keeps things.
- **The MCP serves the registry as it is**, `sherpa://node-kinds`, read from
  `NODE_KINDS` and never listed by hand: a kind, row or socket added here is served
  with no change there (plan 700 G3).

- Site: `src/core/data/node-kinds.ts`
- Site: `src/data.ts`
- Site: `src/core/data/page-definition.ts`
- Site: `test/unit/a-workflow-is-its-definition.test.mjs`
- Site: `mcp-server/resources/query.js`
- Site: `test/unit/a-source-is-where-rows-come-from.test.mjs`

### T-a-second-source-is-kept

**A page reads ONE store, so a second Source in its Query is the EDITOR's, not the
Query's** (Will, TODO 808: "Multiple Sources are allowed"). The Query editor's panel
offers Source as every graph's does; `placeRequest('source', …)` answers `{ keep }`,
never a `QueryRequest`: a new id (`source-2`, the next free) and the first store the
app registered that the page does not read.

- **It is placed and warns**: "The page reads customers. This Source is not the
  page's: the Query reads nothing from it." Its Store row is the reader's to pick
  (`keptEdit`); a connection from it is refused in those words (`connectionRequest`).
- **Kept as a place is**, for the tab (`/node-sources/<page>`, `shared: false`),
  and drawn from `facts.kept` under the page's Source. Undo and Redo step it with
  the Query's draft, one journal; Delete takes it, where any other Query node is
  refused. Save writes `pageWithQuery`, the page's own definition, so it is never
  saved (draft keeps, Save writes final).
- **Never a second door into the Query.** Nothing it does asks the Query. A Source
  that reads another store for a Field's values is a join the Query cannot hold:
  that waits for Will.

- Site: `src/core/data/query-graph.ts`
- Site: `test/unit/a-source-is-where-rows-come-from.test.mjs`
- Site: `test/e2e/reforged-node-sources.spec.ts`
- Site: `src/core/ui/query-editor.ts`

### T-a-field-reads-its-sources-fields

**A Field picks from the fields of the store its ROWS come from, never from one list for the
graph** (Will, TODO 817; 802 pick 1, found by 785: a Condition after Source › devices offered the
Records fields). The facts are keyed by store, `WorkflowFacts.fieldsOf`, each field with its words,
its type and the values it takes; `fields` and the graph-wide `values` are gone.

- **Its store is the FIRST Source up its connections**: the connections into its header first, then into its
  rows, depth first, past what passes rows on (a test's Rows, an Organise, a use) and through the
  portals (`flowOf`'s connections, `T-a-portal-hop-is-resolved-once`). The Source's Store row says the
  store: a Value connected in, else its own. Rows of two stores into one And: the first connection's.
- **What reads it**: the Field row's list and its tip words, the stranger warning, what the column
  carries (`ColumnField.values`), so a Condition's Value B and Values lists, the type that
  types Value B and warns an operator (`fieldAt`), in the drawing, the faults and an edit alike.
- **No Source's rows**: the list is only its own pick, it warns "No store's rows come in: connect a
  Source in" (the kind's heading), unless its header warns already, and it sends nothing, so what
  tests it reads null. A warning, never a fault (D8). Placed alone, it says so too.
- **Two doors in**: a Custom Node's Group Input brings its use's rows, of any store, so a Field
  inside offers every store's fields, the first store's words for a shared name. A Filter
  with no Source reads its own store (`rowsFrom`, its `settings.source`): `presetOfEntity` passes
  it, so the provider's check of a page's presets still compiles one.
- **No facts, or a store they do not know** (`orders`): a Field's list is open and it warns nothing, as
  before. The Source's own Fields (TODO 969) says what it cannot offer: "Pick a store first" with no store, and
  `No fields are known for "orders"` where the facts know no fields of its store, which warns (Will: "Fields dropdown
  doesn't populate"). It picks from its OWN store's fields, every one; a Field after it, from the ones it keeps.
  The Query editor draws its own Field rows from its page's fields: one store, untouched.

- Site: `src/core/data/workflow.ts`
- Site: `test/unit/a-field-reads-its-sources-fields.test.mjs`

### T-a-socket-says-its-type

**Every socket says its type, once, in `NODE_KINDS`** — a value, an object, a
boolean, or `any` (Will, TODO 713; plan-713 §2, M1). A workflow's JSON names
sockets only, never types.

- **`accepts(from, to)` says what an input reads as its own**: each type its own,
  and an `any` input all three. Any connection JOINS any input (Will, TODO 770, B): one
  of another type is no fault and no refusal; the input reads null and its node
  warns (`T-a-node-reads-null-from-what-it-cannot-use`). The shapes are hints. An
  output never sends `any`: it says what it sends, so a kind whose output is `any`
  is a fault on each connection that leaves it.
- **An ARRAY is an object** (Will, D17): a `multiple` row — a picklist of several,
  HTML's own name — holds a list, and its sockets are objects; one set comes in.
- **`many` is per socket** (D4): only an input that says it takes several connections.
  `editWorkflow` puts a new connection beside the ones there; anywhere else it replaces
  the one there. The same connection twice is a fault. Two TYPES into an `any` that takes
  many are not (770): each is read by what the input needs.
- **A test splits, or decides; there is no Branch** (Will, plan 944: "we're making nodes harder to work with
  by having True and False sockets on nodes"; plan 971 A; §9: "Fold it into Condition"). No kind forks; `branches`
  and `#false` are gone. A test (a Condition's every type, Time, Tag, And, Or, Not, Is empty) gives Pass and Fail
  (`TEST_KINDS`), and no True row (Will: "This removes the need for the 'True' property in Condition nodes");
  an AI node that expects True/false has a True. On a COLUMN (a Field's on its header, or tests' rows into And, Or, Not) Pass and Fail
  split the rows. On ONE value (`testsOneValue`: no column and no rows, or rows into Is empty, one set) the way
  its truth takes sends ALL that came into its header (`passes`), else the value tested, drawn as that type; the
  other sends `notTaken`, and a node whose header (with none, its rows) hears only that does not run (Simulate:
  Not taken). The value tested, where it is not the data, comes in on Value A (`T-the-data-comes-in-at-the-header`). "None" is Is empty on a Pass; "At least N",
  a Math Count into Greater or equal. The Boolean (`passes` on its kind) has no rows: its header sends on what
  reaches its header, drawn as that type, where it is true, else Not taken (Will: "if true then"). A check that is no
  Condition (Time, Tag, a Preset, a Custom Node's use) says `output: 'boolean'`:
  one boolean from its header, `Out`. A line from a Condition's header is a fault, in words.
- **A row's output may be DRAWN on another's** (`beside`, TODO 830): a Source's Rows leave from
  its Store row, as a Field's column does from its Field row, not from a Rows line of their own.
  The address stays `node/rows`; the drawing makes no line for it, wears its socket on the named
  row (`drawn.beside`), and a press or a drop on that socket is the Rows', never the Store's.
- **One `rowChoices()` gives every picklist's list**, single or `multiple`: the
  `control` names the list. An open list (fields, operators, values, stores,
  scopes) also offers each own value it lacks, so a select shows it; a fixed list
  (units, directions, presentations, Apply on, joins, value types) never does.

- Site: `src/core/data/node-kinds.ts`
- Site: `src/core/data/workflow.ts`
- Site: `test/unit/a-socket-says-its-type.test.mjs`
- Site: `test/unit/any-connection-joins-any-input.test.mjs`
- Site: `test/e2e/reforged-node-true-false.spec.ts`

### T-a-condition-is-a-tree-of-nodes

**One test per Condition; And and Or join tests; each test reads the Field on its header** (Will,
plan 783 D4, D6): "The Graph chain would, at it's simplest, would then be Source>Field>Condition>
Output." `A or (B and C)` on Seats is six nodes, in a workflow and in the Query editor alike: one
Field, three Conditions on it, an And and an Or. A test's Pass goes into its group's header (plan 971 §9: no True); the
root's into its scope's row. Rows that hold, its Join, Field, Operator, Value and Group rows are
gone, and no file is read as one (D9): a saved one says ""rows" as its Operation, which is none of
its choices".

- **The Query draws a reading's whole tree** (`queryGraph`): a Field per field it reads
  (`field-<scope>-<field>`), a test per leaf, an And or an Or per group. The ROOT keeps
  `when-<scope>-<field>`, so a load's trace still lights it (`T-a-step-names-its-node`); a part is
  `….<path>` by its part numbers. Each node's `ref` keeps the whole tree and its path; an edit
  changes the tree there and asks it as one reading through `graphRequest`, the door a chip asks:
  a leaf's Operation its `op`, its Value B, Values or Start and End its value (`editedCondition`,
  typed by the field), an And or an Or's Operation its group's join. The Field's Field MOVES the
  whole reading to the other field. The `off` and `id` of every part go through untouched; an off
  part says "Off: kept, not applied". A leaf's select lists its field's operators; where its values
  are known, Equals reads back as Is one of with one tick. A span from today draws as Time ›
  Duration. A half-built range is dropped, as a chip's is.
- **Placing in a Query**: a Field holds the scope's next field (its chip appears); a Condition is
  refused in words, "A Condition tests a Field: connect one in" — a Field's tests are its chip's. A
  part's Pass, a Field and a Fail make no connection a reader may: the Query holds one tree per field.
- **And and Or take ANY boolean** (Will, TODO 780: "0/1 or True or False is data"). A test's Pass
  brings its whole tree. Any other boolean — a True or False, a value that says true or false, 1
  or 0 (`truthOf`) — is a CONSTANT part: true always holds, false never. One the graph holds folds
  into its group in `nodeFlow`'s `where`: true drops out of And and ends Or, false the other way, so
  `where` may be `true` or `false`; one only a run gives is named by where it comes from,
  `{ boolean: "Source › True" }`. Since TODO 939 anything else joins too, with no warning — rows, a
  count, a value, each true where it is above zero, true, or not empty — and says nothing in the tree;
  a test's Pass brings its tree, and its Fail the opposite one (`notCondition`: each
  operator's opposite, And and Or swapped; an operator with none is a fault, in words; plan 971 A). No
  connection into it is a fault. A Filter's
  use brings its tree too, read inside (plan 776 D5, `T-a-filter-is-a-preset-of-its-store`).
- **The Query holds no constant.** A page's `where` cannot say one, and the Query editor takes no
  connection into an And or an Or (`connectionRequest`), so it draws none. Folded, a constant compiles as no
  constant: always holds is no condition (it narrows nothing); never holds is an empty Any of,
  `['or']`, which holds no row (`T-an-empty-any-of-is-never`, TODO 816).
- **A test is shaped by its Field's type** where the facts give it (`T-a-logic-type-is-an-operator`):
  an operator its type does not take warns; a Value B that is no number for a number field is the
  row's fault.
- **A preset draws read only** (M5): the definition owns it, so no `ref.scope` and no edit asks
  the Query. A status field's rule draws the same shapes, inside its Field node
  (`T-a-status-opens-its-rule`). `queryGraphFaults` names a `when` that is no condition and a
  connection that ends in nothing.
- **Left for later**: a new leaf made in the Query editor (a connection from a Field to a new
  Condition); an Or across two fields (plan 783 D7: said in words, left off the bar).

- Site: `src/core/data/query-graph.ts`
- Site: `src/core/data/workflow.ts`
- Site: `src/core/data/node-flow.ts`
- Site: `src/core/data/node-kinds.ts`
- Site: `test/unit/a-condition-is-a-tree-of-nodes.test.mjs`
- Site: `test/unit/a-status-opens-its-rule.test.mjs`
- Site: `test/unit/and-or-take-any-boolean.test.mjs`
- Site: `test/e2e/reforged-node-and-or.spec.ts`
- Site: `test/unit/only-a-test-branches.test.mjs`

### T-a-status-opens-its-rule

**A status field is ONE Field node, and its rule is its inside** (Will, plan 960 U4.7b,
2026-11-14). In a page's Query graph the field's node (`status-<field>`) stands on the
Source's rows: its field, read only, then a row per value saying its rule in words
(`conditionWords`; the last value "Every row the values before it left"). The rows
show: no socket, as the Query takes no connection from them. The rule itself is
`statusRule(field, domain)`, a preset Custom Node's definition: the rows in at its Group
Input; each value's `when` a tree (the one walk `whereGraph` uses), its Pass out at
that value's row of the Group Output, its Fail into the next value's Fields, in the
order the store takes the first match.

- **One door to open it.** The editor opens a node whose kind is a Custom Node, or one
  its document holds an inside for (`GraphDocument.inside`, `innerOf`'s `held`): ⛶ and
  Enter alike, the same trail and Back. Inside, it is read only as a preset's is, says
  why, and offers no Clone: the rule is the app's store's.
- **It is drawn as a workflow**, inside: the document draws only its own top graph.
- **A load still lights it**: the Field node with every row that took a value, each
  root inside with its own (`statusTallies`, `traceQuerySteps`), by the same ids. A
  watch keeps what it lit for every node a span names, drawn or not (`litOn`), and a
  node is lit as it is drawn: inside, when the load spoke on the top canvas, and on
  top again after Back. Measured by sherpa-demos-67: before this, nothing inside was lit.
- **Each value's row ends with its count** (Will, TODO 983, A), so the split shows
  without opening it. A load names the row by its address (`QUERY_NODE.statusValue`,
  `status-health/At risk`); a row lit wears only its caption (`lightRow`, the words a
  node's tab would say). Every value is counted, the last too: the store works it out
  for every row, so `statusTallies` asks it of each.

- Site: `src/core/data/query-graph.ts`
- Site: `src/core/ui/query-editor.ts`
- Site: `src/core/ui/node-graph.ts`
- Site: `test/unit/a-status-opens-its-rule.test.mjs`
- Site: `test/e2e/reforged-a-status-opens-its-rule.spec.ts`

### T-an-app-is-its-definition

**An app names its Contexts ONCE, in `app.json`** (TODO 190; Will, 183 choice
1, A: the app layer lives in sherpa-ui). Sherpa Demos kept the Context names
in about 25 places: `index.html` alone held the list, the defined ones, the
resizable ones, the Settings pages, the default, the router's default, the
session's slots, the nav rows and every path; the server had its own copy.

`AppDefinition` (`schemas/app.v1.json`) holds each Context's row — label and
icon, which the header shows too — its files (template, definition, views,
module) and its `chrome` (`header: false`, `resizable`); the default, which
is the nav's Home; the nav sections; and the Settings pages with their one
module. Each path is relative to the file. `checkApp()` reports each name
that is broken — a default that is not a Context, a section naming one that
is not, a name that is both a Context and a Settings page.

**One `init(root, ctx)` for every Context** — `ContextModule`. `ctx` is
`{ session, view, source, signal, header, panels, label }`, the same for a
Context, a Settings page and the assistant panel, so no Context reaches into
the document for the header or a panel. `signal` aborts when it goes. The
CHROME is the loader's: a Context with `header: false` no longer sets and
clears the shell's attribute itself.

A page definition has no `template` key now: nothing read it, and its markup
is its Context's, named here.

- Site: `src/core/data/app-definition.ts`
- Site: `src/data.ts`
- Site: `test/unit/an-app-is-its-definition.test.mjs`
- Site: `src/app.ts`

### T-the-data-entry-loads-no-dom

**`sherpa-ui/data` loads only modules the lint holds DOM-free** (TODO 290). Saved
Views, saved filters, the page's kept state and `onViewPicked`, which builds DOM,
are `sherpa-ui/app`'s; `sherpa-ui` still has each one. `checkApp` stays in both: it
reads JSON, and a server, a test or the MCP's `validate_page` runs it in Node.

The lint checks each FILE, never what it imports: a module can pass it and still
load one that touches the DOM. So a test reads each export's module out of
`src/data.ts`, walks what `dist/data.js` loads, and fails on a file
`eslint.config.js` does not ban `document` in.

- Site: `src/data.ts`
- Site: `test/unit/the-data-entry-loads-no-dom.test.mjs`

### T-a-page-scope-starts-with-its-answers

**A page definition's scope may START with answers** (`where`, as a View
writes them) — Will, TODO 464: Records' Date opens on "Last 12 months". They are
NOT a component's own default (`declareDefault`): that makes its scope
"fixed", and a View-held field's picks would stop being set aside. So the
Query keeps them apart, as `starts` (`declareStart`), and `definitionOf` lays
them under any View or restore that does not name the scope — as it does a
component's default. Without that, a View naming only its data scope (Records'
"All customers") started the View scope on a clean slate: Reset to default
took the Date off, and the page never read as at its default.

- Site: `src/core/data/query-edits.ts`
- Site: `src/core/data/query-context.ts`
- Site: `test/unit/page-definition.test.mjs`

### T-the-app-context-is-one-answer

**While the app shares it, the View Context is the APP Context: one answer for
every page** — Will, TODO 453; D1 A, D2 A. While the `appContext` setting is on,
the page keeper keeps it for the tab (`keeper.appContext`), as a `SharedView`: the
View's fields, their answers, and each field's face.

- **Read:** every Query a page puts on — a restore, a View pick, a draft — goes
  through `setQuery(…, { lay })`, which lays the answer over the View
  (`layShared`): its fields this page has, in its order, then the page's own it
  lacks. A View sets its local filters alone (D1 A).
- **Write:** each reader act writes the View back (`sharedOf`); a field this
  page has not keeps its answer and its place for the pages that do. Reset all
  on view resets the App answer too.
- **Each page keeps its own:** `lay` keeps the View it covered, and a reload,
  what a View was left with and turning sharing off use THAT (`#keepNow`,
  `share`) — so off gives each page its own back (D2 A).
- **A field this page has not** (`source.has`) is drawn after its View's,
  inactive and refused, saying why (`declareUnused` → `data-unused`). It is
  never in the Query, so nothing compiles or counts it.
- **The name:** while shared, the provider declares the View scope "App
  Context"; off, the page's own name comes back.

- Site: `src/core/data/query-edits.ts`
- Site: `src/components/sherpa-provider/provider-page.ts`
- Site: `src/components/sherpa-provider/sherpa-provider.ts`
- Site: `src/core/browser/page-state.ts`

### T-a-hovered-chip-previews-the-highlight

**A chip hovered PREVIEWS the highlight** (Will, TODO 449,
"Highlight matches on hover"). Resting 150ms on an applied chip whose matches
are counted (`results` is not null: not pending, not a draft) asks
`{ field, preview: true }`; leaving the chip, or the bar, asks it off. It is the
only highlight: the driver a menu's "Highlight matches" switch kept in the Query
(TODO 441) went in TODO 589, Will: not useful.

**The hover is the PAGE's, never the data layer's** (Will, TODO 655: *"Highlighting
should also just be a response to a broadcast 'on hover' event from another UI
component."*). `bindSource` hands a bar's preview request to its host's `hover`
callback, and never to the Query; a legend's `legend-hover` goes to the provider
too. The provider keeps it (`hovered`, `hover()`), asks each source once what it
matches (`highlightTest`, by the pure `highlightOf`), and draws again only the
components whose test changed: a summary from the rows it last gave them, a grid
by `drawHighlight`. Nothing is saved, nothing is a `query-change`, and nothing
loads: a re-query would set the page to 1, and every hover once sent the grid back
to page 1. Until 655 it was the QueryContext's (`preview()`, `previewed`) and
`compile()`'s (`facts.highlight`).

**It follows `pointermove`, never `pointerover`** (TODO 463). Inside a bar
Chromium sent ONE `pointerover` — the first element entered — and none after,
setting on or off, with no pointer capture anywhere, while `pointermove` kept
naming each element under the pointer. Hovered by `pointerover`, a preview came
once, late or never. Nor is LEAVING a boundary event: a bar inside the panel's
column heard no `pointerout` either, and a value stayed lit. While something is
hovered the bar watches the PAGE's `pointermove`, and ends the preview once the
pointer's path no longer holds the bar; `pointerout` stays for a pointer that
leaves the window, where no `pointermove` comes.

**One value, or the whole chip** (TODO 459). A section's value chip, or a value
row of a chip's open menu — picked or not — previews that value alone:
`{ field, preview: true, value }`, and `compile()` marks by `{ picked: [value] }`.
The chip itself previews its whole answer, and only while it is applied and
counted.


**A preview needs no scope made first** (Will, TODO 513: *"Hover highlighting on
legend items only works if one of the legend items has been toggled"*). A
chart's own scope is made at its legend's first toggle, and `compile` built the
highlight only from scopes the Query had — so a rest before any toggle asked a
preview and lit nothing. A rested value whose scope is not made yet is compiled
from an empty one.
- Site: `src/core/ui/bind-source.ts`
- Site: `src/core/data/query.ts`
- Site: `src/components/sherpa-quick-filter-toolbar/sherpa-quick-filter-toolbar.ts`
- Site: `test/unit/a-hovered-chip-previews-the-highlight.test.mjs`
- Site: `src/components/sherpa-provider/provider-highlight.ts`
- Site: `src/components/sherpa-provider/provider-legends.ts`

A chip switched OFF previews what it holds too (Will, TODO 496 A), where the
rows are held here — not on a bar whose source is remote: compile lifts the
held answer's `suspended` for the preview.

A LEGEND row is a value too (Will, TODO 495): while the provider's
`highlightOnHover` is on, it writes `data-highlight-hover` on each legend that
picks, and a rest on a row (150 ms, as a chip's) says `legend-hover`; the
provider previews that value — in the View where the View holds the field, else
in the legend's own part. "Other" folds many values, so it previews none.

### T-a-chart-is-free-of-its-own-field

Will, TODO 479: *"When filtering gauge chart segments the needle shouldn't
move. This chart shows a range with demarked threshold segments. Toggling a
legend item, or filter chips, for this type of chart should highlight the
active segments."*

A chart over its field's ZONES — a gauge — is FREE of that field
(`free: [field]` on its bind; its provider says so for any summary that asks
for zones). Its rows are the View's less every clause on that field
(`filterWithout`: an `and` drops its parts on it; an `or` goes only when all of
it is that field), and its own part's answer less the same — loaded beside the
unpaged set, once per set of fields, and handed the chart in place of it. So the
View's OTHER filters still move the needle (Will, D1 A) and its own never does.

Its picks LIGHT it: `pickedFor(el, field)` — the chart's own part's picks, else
the View's, as applied — rides with the summary as `picked`, and a zone not
picked fades (D2 A). The push key carries those picks, because a pick on a free
field changes no row the chart is handed.

Where the View HOLDS the field, the gauge's legend writes the View's answer
(`bindSelection`'s "raised"), so in Demos' Records the zones filter the whole
page, as Will asked: the Records View holds Health.

- Site: `src/core/data/data-source-types.ts`
- Site: `src/core/data/source-binding.ts`
- Site: `src/core/data/data-source.ts`
- Site: `src/components/sherpa-provider/sherpa-provider.ts`
- Site: `src/components/sherpa-gauge-chart/sherpa-gauge-chart.ts`
- Site: `test/unit/a-chart-is-free-of-its-own-field.test.mjs`
- Site: `src/core/data/source-reads.ts`
- Site: `src/core/data/source-view.ts`

### T-all-is-an-answer

**ALL is said on purpose, as `none` is: `{ picked: [], all: true }`** — Will,
TODO 489 (B): Customer and Region open with every value ticked and the chip ON,
reading All. A field's `"start": "all"` opens it so; a reader's Select all on
says it too.

**ALL IS EVERY VALUE PICKED, NOT NO FILTER** — Will, 2026-11-13: *"Select All
should mean that all values are selected. It's semantically different from no
filter applied."* It compiles to ONE clause, "has a value": `[field, 'notin',
[null, …, '']]`, short however many values a field has and live by itself, so a
row with no value (an empty cell, an empty list) does not pass, and its chip is
counted as a picked chip is. The plain `where` form keeps it as `{ all: true }`,
never as its clause, so a View or a page saved on All stays on All. The Query
graph draws no Condition for it (`answerTree` gives none).

**Every value ticked by hand is the same answer** — Will, 2026-11-13: it
filters too (`in` those values), so a row with no value drops. It retired the
rule that every value ticked is no filter (2026-09-22). To see the rows with no
value, the reader switches the chip off. A legend is not a chip: with every row
on, it picks nothing, so it narrows nothing.

It is a FLAG, not a list of every value. A list goes stale: a value added later
started unticked, and in a chained set Region kept, ticked and greyed, the
regions the chosen Customer has not. So the menu keeps `all` and ticks every row
it may have — rows that arrive later, and back again when the chain offers them;
one ruled out or not offered is not ticked. A list given (`values = …`) or one
row changed ends it; Clear ends it. The chip keeps it while OFF, as it keeps
picks, and the bar's `readings` say `all`, never the rows ticked now.

The face says "All" for the flag only: a list ticked by hand says its values.

- Site: `src/core/data/filter-state.ts`
- Site: `src/core/data/where.ts`
- Site: `src/core/data/data-source.ts`
- Site: `src/core/data/filter-face.ts`
- Site: `src/components/sherpa-menu/sherpa-menu.ts`
- Site: `src/components/sherpa-menu/menu-list.ts`
- Site: `src/components/sherpa-quick-filter-toolbar/sherpa-quick-filter-toolbar.ts`
- Site: `test/unit/a-list-can-start-with-every-value.test.mjs`
- Site: `test/e2e/reforged-menu.spec.ts`
- Site: `src/components/sherpa-quick-filter/chip-answer.ts`
- Site: `test/e2e/reforged-select-all-is-every-value.spec.ts`
- Site: `src/core/data/bind-selection.ts`

### T-a-preset-is-its-own-part

**A preset is a WRAPPER round its fields' conditions** — Will, TODO 510 (A):
*"Preset filters should be a wrapper around stacked advanced filter conditions
that get injected into the overall filter query. The filter query component
should broadcast the changes out to all other UI components."* A scope's
definition lists `presets` (`{ id, label, where }`), kept by the Query
(`declarePresets`); each is a boolean chip that leads its scope.

**Its rows sit beside the answer, never in it** — Will, TODOs 521, 526. ON puts its
name and rows on each field's reading, as `byPreset`, at the field's HOME (a
View-held Health goes to the View). Where no scope holds the field they stay in the
preset's own scope, in `readings` and not `holds`, so they filter that scope alone
and add NO chip or section (Will, TODO 590; `rehome` leaves them). `stateClause` ANDs
them with the answer: `(A or B) and P`. The
answer and its mode stay the reader's, so a preset never turns a field Advanced,
and it cannot lose the reader's own picks. Written into the answer instead, ON
forces Advanced — Enterprise trials flipped Plan and Status — and OFF must work
out which rows were its own.

OFF takes them off. A reader's answer
replaces only the answer (`keepPresets` in `query-edits.ts`), so a pick never turns a preset off. A saved filter replaces
the reading whole, so it replaces these too.

**Its ON is read from the fields** (`presetOn`): its rows on every field it names,
in force. The Switch off, it reads off. A View whose own filters happen to match a
preset does not turn it on. No `presets` flag is kept: an old stored one is a key
a scope does not have, dropped and reported once (D4).

**Every control reads `byPreset`, so toolbar and panel agree.** A chip already there wears
`data-by-preset`, the preset's names: on, blue (the `info` pin), and its tip says
"On by the preset ‹name›." Its face reads the rows where the reader has no answer
of their own. In a panel section each value chip the rows touch goes blue
(`presetTouches`: a list value they keep, a band they overlap, so `!equals(churned)`
colours the other three); no chip is added. **Toggled off, a blue chip or value
turns its presets off**: their conditions no longer stand (Will, TODO 592; it is the
one thing that does, beside the preset's own chip and Reset). An icon-only heading
chip has no toggle: its press opens its menu. **Its values cannot change while the
preset is on** (Will, TODO 601): its menu is `data-readonly` and its `title` says why, a
panel section's other values wear `data-held-out` (inactive, and they say why), a
section's ⋮ offers no Advanced or Reset, and a grid's cell offers nothing and its tags
refuse. TODO 602 is the setting that will let them. In a menu the row is ticked, refused
and says why; `NON_VALUE_ROWS` leaves it out of the menu's values, so it is never read
back as the reader's. A grid heading tells its chip through `chip.presets`.

The walk counts each preset ON first in its scope, with its own clause
(`presetClause`), narrowing nothing — its rows are in its fields' steps.

The bar: its press asks `{ preset, on }`; its on is the source's, drawn on every
draw — `drawScope` would otherwise empty a chip that answers no field. It offers
no ⋮, so it never moves scope, and it is not dragged. A divider follows the last
preset on the bar (482); the panel heads them "Presets" (a word in the
toolbar's markup), stacked in the value column, or side by side under the
heading. The held fields that 452 called "presets" are `own` now.

On a field no scope holds, its reading sits in the preset's scope, so `homeOf`
looks there before it falls back to the View. Without that, `selection()` read the
View and said off while the rows were filtered, and a heading wore the amber
"on, filtering nothing" (TODO 611).

- Site: `src/components/sherpa-quick-filter-toolbar/sherpa-quick-filter-toolbar.ts`
- Site: `src/components/sherpa-quick-filter/sherpa-quick-filter.ts`
- Site: `src/core/data/data-source.ts`
- Site: `src/core/data/filter-state.ts`
- Site: `src/core/data/page-definition.ts`
- Site: `src/core/data/query-edits.ts`
- Site: `src/core/data/query.ts`
- Site: `src/core/data/source-counts.ts`
- Site: `src/core/ui/filter-def.ts`
- Site: `test/unit/a-preset-is-its-own-part.test.mjs`
- Site: `test/unit/a-key-a-scope-lacks-goes.test.mjs`

### T-one-field-one-status

**One function says what a field is now, seen from a scope: `fieldStatus`.** Eight
channels told a control parts of this, and each control worked out the rest, so a
fix reached some chips and missed others: a preset's field no toolbar held wore the
amber "on, filtering nothing" on its heading (TODO 611). The Query tells every
control; no control asks another (Will, 2026-10-30). "Held above" comes from the
hierarchy, the View scope over a local scope over a component. So `above` is read
from the draft, as a raise shows at once, and `on` from the Query as applied. See
docs/DATA-LAYER-PLAN.md, Step 3.

- Site: `scripts/check-ownership.mjs`
- Site: `src/core/data/data-source-types.ts`
- Site: `src/core/data/data-source.ts`
- Site: `src/core/data/field-status.ts`
- Site: `src/core/ui/filter-host.ts`
- Site: `test/unit/one-field-one-status.test.mjs`
- Site: `src/core/ui/filter-host-controller.ts`
- Site: `src/core/data/source-view.ts`

### T-a-rule-names-its-clock-and-its-language

**What a rule reads beyond its input is named: the clock and the sort language.**
`last` and `next` read the clock, and `Intl.Collator(undefined)` the machine's
language: `z` and `ä` swap between German and Swedish, which moves a sort and `lt` and
`gt`. Same input, other output, and nothing says why. So `filterTest`, `filterRows`
and `LoadOptions` take `now`, a `DataSource` takes `now: () => Date`, a walk asked of a
store sends the dates of its own clock, and `setCollation` names the language. Left
alone, both are the reader's, as a page wants. The day is in the source's keys, or a
load after midnight would be skipped as the same question (TODO 614).

- Site: `src/core/data/data-source-types.ts`
- Site: `src/core/data/source-counts.ts`
- Site: `src/core/data/store.ts`
- Site: `test/unit/same-input-same-output.test.mjs`
- Site: `src/core/data/source-reads.ts`

### T-a-page-turn-is-a-slice

**Do a question's work once; ask a store for what the answer needs.** A page turn ran
the filter and the sort again over every row; a read checked every row against its
schema again; a count downloaded the matches; a tally downloaded whole rows; and a set
too big was sent whole, up to the cap, only to be refused and thrown away. Measured at
1M rows: a page turn 157 ms, all of it this. So a store and a held set keep the last
question's order and slice it, a store that says its total is asked that first, and a
row is checked once. The kept order goes when the rows change, or the day does, as
"last 7 days" means other rows tomorrow (TODO 615).

- Site: `src/core/data/base-store.ts`
- Site: `src/core/data/held-set.ts`
- Site: `src/core/data/source-counts.ts`
- Site: `src/core/data/store-cache.ts`
- Site: `src/core/data/stores.ts`
- Site: `test/unit/scale-asks-less.test.mjs`

### T-one-trace-stream

**ONE trace stream for every host** (plan 695 S3). Each step is a span,
`{ host, step, store?, trace, id, parent?, t, ms?, detail? }`: said as it begins,
with no `ms`, and again as it ends. `trace` joins every span of one act, on every
host; `id` is the span's own; `parent` the span it ran under. `onTrace(listener)`
hears them all, from every context, and returns its stop; many may listen.

**Across hosts, by `traceparent`** (W3C, sampled). A `RequestStore` that traces
sends its `request` span as `traceparent`; `createDataHandler` begins its `answer`
under it, on its own host (`host`: `serveData` says `worker`), and echoes the
header. The worker's own steps — `hold` (the set held for a read, its plan and
rows), `recheck`, `send` (only where writes wait) — begin under the answer. A
DataSource says `load` as it starts and ends: its requests start traces of their
own, as no call can carry a span past an `await` (`within` sets the span for a
call's first, synchronous part only, so the handler reads a body BEFORE it calls
its store).

**Said on one channel, `sherpa-trace`.** A context that listens says so
(`{ listen }`); one that opens its channel asks who does. `tracing()` is true where
anyone listens, here or there. A request that asks to be traced is traced by the
host that answers it, even one that knows of no listener yet: a worker woken by
that very request has not heard. Nobody listening, `startSpan` returns null and
nothing is made, and no request carries a `traceparent`: a new header could fail
a server's CORS. A listening tab that shuts says nothing: its peers trace on for it
until they stop.

- Site: `src/core/data/trace.ts`
- Site: `src/core/data/request-store.ts`
- Site: `src/core/data/data-handler.ts`
- Site: `src/data.ts`
- Site: `test/unit/one-trace-stream.test.mjs`
- Site: `src/core/data/source-reads.ts`
- Site: `src/core/data/store.ts`

### T-a-step-names-its-node

**ONE way to say a step ran** (plan 695 N2, Will's TODO 671): a span on the one
trace stream (`T-one-trace-stream`) whose `detail.node` is the id the graph draws
the node by, `detail.state` how it stands (`start`, then `done`, `failed` or
`skipped`) and `detail.rows` the rows it ended with. `traceStep(node, options)`
says it: begun now, `end(state, detail)` ends it; or, given `state`, said once as
it ended, in `ms`. The worker, any code or an agent reports this way, and any Node
Editor that listens lights from it. No second channel; nobody listening, nothing
is made and it returns null.

- **A run is one trace.** A workflow's steps begin under one span (`parent`, or
  `within`); `detail.graph` names the workflow, and claims the trace for its graph.
  `watchSteps` keeps a run's lights until the next run begins; a late span of a run
  gone by lights nothing. N4's runner only reports.
- **A Query graph maps S3's spans** (`queryStepNode`): a `load`, and its store's
  `request`, `answer`, `hold`, `recheck` and `send`, light the Source. A trace is the
  graph's where a span names its store (`definition.source.store`) — so the
  worker's answer and hold join by the trace of the request they answer — or where
  it is the source's own load. A load is the source's when its span begins as the
  source says `loading`: the DataSource dispatches `loading` and begins its `load`
  span in one synchronous step. Reorder the two and the Source never lights: the
  e2e test fails. A node lit by several spans says the time and rows of the one
  that spoke LAST, and every host that ran one: the load ends after its store's
  reads, so the Source says the page's rows (TODO 808).
- **The rows are the walk's own** (`planWalk`'s step ids: a field, `preset:<id>`).
  When the source's load ends, `traceQuerySteps` says each scope, condition and
  preset the walk counted, and the scope it arranged, under the load; an off one,
  or one in a scope whose filters are off, is `skipped`. Until the walk says its
  own steps (S5), the Query editor asks it to as the load ends. The ids are one
  scheme, `QUERY_NODE`, which `queryGraph` draws by.
- **A lit node is CSS.** `data-step` (`running`, `done`, `failed`, `skipped`) is a
  Style pin (`state-pins.yaml`); `data-caption` is a line over the card, so no row
  or connection moves. A step of 0 ms shows no time.

- Site: `src/core/data/trace.ts`
- Site: `src/core/data/query-graph.ts`
- Site: `src/core/ui/node-graph.ts`
- Site: `test/unit/a-step-names-its-node.test.mjs`
- Site: `test/e2e/reforged-a-node-lights-by-its-step.spec.ts`

### T-one-command-one-door

**Every edit to the Query is a `QueryRequest`, asked through ONE door:
`QueryContext.ask(request)`.** Plan 695 S2 (D2). A field's answer, an on or off,
a Switch, a reset, an order, a preset, a presentation, a solo, a Sort, Group or
Search, a page or its size, what a scope holds, takes, lets go or moves, a
let-go pick, an Apply, a Discard — one typed union, and a list is ONE change
(one `query-change`, one Apply). The UI, the node editor and an agent say the
same thing the same way, so each edit can be traced, undone and replayed. There
is no other door. A page or its size goes to the source that draws a page in the
request's scope — with none named, or none drawing there, every source's.

- **One table maps the steering events** (`STEERS` in `bind-source.ts`): each
  event a bound component sends up, and the command it asks. The event names
  are the components' own, public (PRINCIPLES 18); only the map moves. Two are
  no edit and say so: `grid-pages-change` is a report, `select-all-request` a
  read. A hover (`preview`) is the page's, never the Query's: `ask()` passes it
  by.
- **A slot's Sort and Group are its chart's**, whoever asks — the rerouting
  lives in the edit, not in one caller: a caller that arranges a chart's rows
  straight arranges them instead of its presentation (bug 5, the node editor).
- **Every edit is pure**: `editQuery(query, edit, facts)` gives the Query after a
  Sort, Group, Search, presentation, order or move, and leaves the one given
  untouched; `editCopies(copies, request, facts)` gives the copies after an
  answer, a Switch, a solo, a reset, a preset or a hold, with the ordered list of
  what members must hear — what a Switch turned off, a hold's clear with its
  scope. `ask()` freezes the new Query, puts it in place and tells each member once.
- **`scope` left out** is the View; for a Sort, Group or Search, the scope that
  arranges now; for an Apply or a Discard, every scope. A preset's own `commit`
  applies only the fields it moved.
- **A command that names no edit is reported, `unknown-request`, and changes
  nothing** — `{ foo: 1 }`, `{}`, or no object at all, from an agent's JSON. Only
  `commit` is an Apply: before TODO 718 anything unmatched fell through to one,
  on every scope, and said nothing.

- Site: `src/core/data/query.ts`
- Site: `src/core/data/query-edits.ts`
- Site: `src/core/data/query-context.ts`
- Site: `src/core/ui/bind-source.ts`
- Site: `test/unit/one-command-one-door.test.mjs`
- Site: `src/data.ts`
- Site: `src/core/data/query-graph.ts`
- Site: `test/unit/an-answer-is-a-pure-edit.test.mjs`
- Site: `mcp-server/tools/query.js`
- Site: `test/unit/the-mcp-query-tier.test.mjs`
- Site: `test/e2e/reforged-query-panel.spec.ts`
- Site: `src/core/ui/query-editor.ts`

### T-a-setting-is-declared-once

**Every app setting is ONE entry in a schema** (695 U2): its key, type, default,
scope and the session pointer it is kept at — `SETTINGS`, and an app's own beside
it. `Settings` holds the live values over the app's session: a page's own (`lay()`,
for its `page` or `component` settings) over the app's, kept, over the default.
One entry replaces seven paths per setting.

The provider holds the `Settings` and delivers each kind one way. A component
reads what it takes through `static settings` — its own attribute, by key, `!key`
while the setting is off — asked by Context Protocol and told again on every
change; a setting of none (`null`) leaves the attribute alone. A `source` setting
is the DataSource's own property of that name. A `look` setting goes on the page's
root: inherited custom properties the component CSS reads, or the attribute the
token layer reads (a mode, a density); the root takes off only what it put on. A
reader's change made inside — a ⋮ switch, the mode button — is set and said as ONE
`setting-change`; the app's own writes say nothing.

A new setting is one entry, and its use.

- Site: `src/core/data/settings.ts`
- Site: `src/core/ui/sherpa-element.ts`
- Site: `src/components/sherpa-provider/sherpa-provider.ts`
- Site: `src/components/sherpa-provider/provider-look.ts`
- Site: `src/components/sherpa-outlet/outlet-nav.ts`

### T-grid-collapsed-group-is-one-slot

**A SHUT group is ONE line on screen, so it costs ONE slot of the page.**

A page of 25 RECORDS, grouped by tier with Gold shut, gives the reader one heading
and twenty-four hidden rows — a page that looks empty, with a pager insisting
there are ten more like it. The rows are there; CSS hides them; the count is
already spent.

So the page is cut from the rows in hand and the groups the grid has shut —
the data layer's `ColumnFacts.page`, asked by the grid with what it shut
(`GridGroups.#shut`):

| | costs |
|---|---|
| a row | 1 |
| an open group's heading | nothing |
| a shut group | 1 — the heading, and nothing for its rows |

**A page is `data-page-size` ROWS, grouped or not** — Will, TODO 152: "Data
grid pages don't respect the row count value set in the pagination." Counting
every heading as a line gives a page of 25 only 24 or 23 rows, and a grouped
view one page more than the same rows ungrouped. With every group open, the
pages match the ungrouped ones.

`ColumnFacts.page` walks the visible rows once and records the index each page
opens at. A page is then a plain slice, and `data-index` stays an index into the FULL
visible list (`#renderBody` adds the slice's `offset`) — so selection, row-click
and `GridSelection.syncCurrent` keep resolving against the same list. Change
that and a click on page 2 returns a page-1 record.

**A group split by a page boundary redraws its heading**, because a page that
opened mid-group with no heading would not say which group it was showing. The
`group-count` is the group's REAL size across every page, not the part this page
drew — the heading answers "how many are in Gold", not "how many fit here".

Only an OPEN group can be split. A shut one is a single line and cannot be.

**Folding RE-CUTS the page**, so `GridGroups.fold` draws the body again, not only
`syncShut()`. Shutting a group frees slots and the next rows
move up onto this page; opening one pushes the tail off. A visibility sync alone
leaves the hole this trap exists to remove — and because the body is replaced,
the ticks, the select-all and the focus tint all have to be re-derived after it.

None of this runs ungrouped (`GridGroups.paginates`): there the store's window IS the page,
and slicing it again would hide rows nobody folded.

- Site: `src/components/sherpa-data-grid/grid-groups.ts`
- Site: `test/e2e/reforged-data-grid.spec.ts`
- Site: `src/core/data/column-facts.ts`

### T-grid-slider-spans-real-values

A NUMBER column's range slider is given `min`/`max` from the column's REAL
values (floor of the minimum, ceil of the maximum, over the finite ones).

Left at the slider's own 0..100 default, a spend column would open with **every
row crushed at the far left** and no way to pick between them.

A fresh range then opens spanning the WHOLE column, so the filter starts by
excluding nothing — opening at 0..0 would empty the view before the reader had
asked it anything.

- Site: `src/core/data/column-facts.ts`
- Site: `src/components/sherpa-menu/sherpa-menu.ts`
- Site: `test/e2e/reforged-data-grid.spec.ts`

### T-a-fixed-field-stays-held

A scope's definition may say, once, which fields it holds a reader cannot REMOVE
(`fixed`) and which a reader cannot switch OFF (`alwaysOn`) — Will, TODO 703: the
View Context's Customer, Region and Date stay, and Customer and Region stay on.
`declareFixed` keeps it with the page's other declarations, never in the Query.

**Every door refuses, not only the chip's** (PRINCIPLES 21). The Query refuses a
`hold` or `release` that lets a fixed field go, a `take` that sends one down from
the View, and a `move` out of its scope (`field-fixed`); and an OFF for a field
always on (`field-always-on`): `suspended` is refused, and an answer that comes in
suspended comes in on. The scope's Switch and a Solo pass an always-on field by. A
restore (`setQuery`) that left a fixed field out puts it back, leading, and turns
an always-on answer on (`keepFixed`): a kept Query from before the page fixed it
would otherwise drop the chip. The bar refuses `removeFilter` (`filter-fixed`) and
`setChipReading` off (`filter-always-on`), and offers no Remove, Move or Edit-list
row for a fixed chip. Off is not gone: an always-on field's values still change,
and a clear is an answer.

**An always-on chip is `data-persistent`, and no selector.** `data-persistent` is
the chip's one word for "cannot be toggled" (TODO 697), so the bar sets it. The
bar's own rules for its SELECTOR — the View chip answers no field, leads, keeps its
pick through a reset, stays in panel mode, and a divider follows it — read
`data-selector`, which only a `persistent` def gets. Read off `data-persistent`,
they would take an always-on Customer for a selector: it would report nothing, stay
on the bar in panel mode, and draw a divider after itself.

**Fixed fields lead their scope**, and the bar draws ONE divider after the last
while a chip follows — the preset divider's rule, with a second selector.

- Site: `src/core/data/query-edits.ts`
- Site: `src/core/data/query-declarations.ts`
- Site: `src/core/data/query-context.ts`
- Site: `src/core/data/page-definition.ts`
- Site: `src/core/ui/filter-def.ts`
- Site: `src/components/sherpa-quick-filter-toolbar/sherpa-quick-filter-toolbar.ts`
- Site: `test/unit/a-fixed-field-stays-held.test.mjs`
- Site: `test/e2e/reforged-a-fixed-field-stays-held.spec.ts`

### T-only-a-store-reads-data

**Nothing reads data but a store** — Will, 2026-11-14 (PRINCIPLES 25): "Nothing should ever read a Data Source directly
except a Data Store." A copy read around the store rots: the same list said in four places (a seed generator, an act's
choices, two definitions' `values`) drifts, and a check reads names the rows no longer hold.

**The test lists every module that reaches outside the page**, each with what it reads: the stores, and those that read
no rows — a page, a View, a template, the icon sprite, the app's offline files, a worker's script, the notices that a
store's rows moved. The shelf reads entity files because it is the entities' store. A new `fetch`, `EventSource`,
`WebSocket`, `XMLHttpRequest`, file read or JSON import fails it until it is listed, and says why. It reads code, not
comments, and a method named `fetch` is no read.

What it cannot hold: a module that reads a store's file through a helper with another name. A reviewer holds that, and
an app holds its own (Demos audits its `app/`). A `{{customer:…}}` reference is read the same way: `refFacts` asks each
type's store for the rows a text names, by key, never every row (TODO 988).

- Site: `src/core/data/stores.ts`
- Site: `src/core/data/ref-facts.ts`
- Site: `test/unit/only-a-store-reads-data.test.mjs`
- Site: `test/unit/a-reference-reads-its-store.test.mjs`

### T-a-scope-below-narrows-within-a-fixed-field

**A field the View holds FIXED can never move down, so a scope below may add it
again, as its own chip** — Will, TODO 554: "A local scope may still add these
fields and their filters, but its options come from what the View scope's filter
on that field allows." The one exception to "a field lives in exactly one scope"
(`docs/DATA-SOURCE-RULES.md` §6). A field the View holds and does not fix is as
before: down is closed, and a reader moves it instead.

**Both scopes hold it, and each keeps its own answer.** The View's reading stays
the field's HOME (`homeOf`, `readingOf`); the card's sits in the card's scope
beside it (`ownIn`). Every edit that writes by home learns to leave it there:
`setReading` (else a View answer wipes the card's), `rehome` (else a hold moves
the card's onto the View's), `homes` (else a move reads the card's as the field's
home), and `definitionOf` (else a View that loads marks it superseded). A request
asked IN the card's scope — an answer, a Switch, a Solo, a Reset, a Remove —
writes the card's (`w.at(field, scope)`). `pending` reads both: else a remote
card's change to Customer, under a View whose Customer did not move, has no Apply.

**It ANDs under the View's** (`appliesIn`'s `own`), and the walk counts it as any
of the card's fields: it offers what the View leaves (347), and a pick the View
then rules out LEAVES the card's answer (512 A), so no card shows no rows with no
chip that says why. The walk taps it before it is added, as any field a card may
add. Its chip is never drawn held above: `describe` sets no `appliedAt`, and
`syncHeld` tells each scope below the View's fields less those it answers again.

**It is decided by the page's `fixed`, never kept in the Query**: no fixed field
at the View, and every door is exactly as it was. A date answers a range, not
picks: its card chip ANDs, and is not yet bounded to the View's range.

- Site: `src/core/data/query.ts`
- Site: `src/core/data/query-edits.ts`
- Site: `src/core/data/source-view.ts`
- Site: `test/unit/a-scope-below-narrows-within-a-fixed-field.test.mjs`
- Site: `test/e2e/reforged-a-scope-below-narrows-within-a-fixed-field.spec.ts`

### T-a-range-is-counted-from-its-own-start

A sparkline's segments are the date range cut into equal steps from ITS start,
not from the calendar. "Last 6 months" is 6 segments, though it touches 7
calendar months. Cutting by calendar month gave 7, and then 12 for a range of
rows with no condition.

The unit is drawn once per unit in the range, until that passes one of the next
unit up: 12 months is 12 segments, 13 is 5 quarters, 20 is 7, and 24 is 2
years. A week or more left over makes one more, partial, segment; less joins the
last. "Last 7 days" is 7 days and not 8, the filter's and the axis's alike:
`rangeOf` is `durationSpan` (TODO 716). A day is a segment like any other, so "last 14
days" is the range's 14 days, never every day the field holds (TODO 705). A day
alone is 12 of two hours, and a date with no time is at its midnight: cut as
text, it was keyed `2026-11-0400` and matched no segment.

A fixed `data-bucket`, or none, over a date condition follows the range too
(Will, TODO 705): the range cut at that unit from its start; with none, the
values the range holds. Only `auto` picks the unit. Without that, its values
followed the range and its axis was every month the field holds, most at 0.

- Site: `src/core/data/segments.ts`
- Site: `src/core/data/aggregate.ts`

### T-a-custom-node-is-an-instance

**A Custom Node is a workflow body saved under one id, and each use is an INSTANCE of it.**
Will, 2026-11-04 (D9-D13, D15); plan-713-node-model.md section 9.

- **The definition is JSON** (`defs.v1#/$defs/nodeDefinition`), an app's shipped as entities of
  the type `node` (`entities.v3.json`; app.v1 `nodes` is gone, TODO 777): a
  label, `inputs`, `outputs` and a body of `nodes` and `connections`. Inside, `#in`, `#in/<name>`,
  `#out` and `#out/<name>` are the Group Input and Group Output; `innerOf` lays them out as
  two nodes of the kinds `#group-input` and `#group-output`, so the body is checked and drawn
  by the workflow's own functions. Its header takes any type (D1).
- **A use is a plain node** whose `kind` is the definition's id, merged into the kinds the
  workflow functions take (`kindsOf(library)`). A shipped kind's id is refused. Its own values
  are the instance's parameters, over each input's `default`.
- **It runs NESTED** (D12): the runner calls `innerOf(use, library)` per use; the checks do
  too (`workflowFaultsDeep`), naming each fault by path. A Custom Node that holds itself, at
  any depth, is one loop fault, said once per cycle.
- **A use records the VERSION and the definition it was made from** (`version`, `was`): a
  hash of the label, sockets, nodes and connections, never where a node sits. `definitionDiff`
  compares it with the library's now. `updateInstance` and `updateAll` are pure edits that keep
  the instance's own values; the editor gives the DRAFT, so an updated instance keeps its
  draft changes until the reader saves or discards them. A connection to a lost socket is kept, and
  is a fault.
- **A preset is read only** (`preset: true`): `editDefinition` returns the library given;
  a Clone (`clone`, the act `<type>.clone`, plan 972c) makes the reader's own copy.
- **The editor OPENS it** (M10): `bindWorkflow`'s `open(use)` shows `innerOf(use).workflow` under
  a `sherpa-breadcrumbs` trail, and an edit there is an `editDefinition` of the library DRAFT
  (kept for the tab beside the workflow's; at Save the app keeps each one `edits()` names, through
  `keepNode`, and `discard()` puts it back). A use whose recorded version is old says "Update available", shows
  `definitionDiff` and a split button: "Update instance", and in its menu the two bulk updates,
  each behind a critical `sherpa-dialog`. A preset's inside is locked, with Clone when the app gives its `act`.
- **"Save as Custom Node" is `groupNodes`, "Ungroup" is `ungroupUse`** (M11): each connection over
  the edge is one socket per outside OUTPUT that feeds in (a Group Input row) and per inside
  output that feeds out, typed by what its source sends. The definition keeps the nodes WHERE THEY
  SIT, so Ungroup gives the same nodes, connections and places. A loop out and back and a result with
  a new fault are refused in words; one source into inputs of two types is one socket, and an
  input inside that cannot use it warns, as it did outside (TODO 770).
  The toolbar's button (on from two picked) opens a dialog for the name and description; a
  refusal is said in it, and the dialog stays open. The inspector holds none of it (TODO 745).
- **Its tags are the DEFINITION's** (TODO 819): a use's inspector, and inside it the Group Input's
  and Output's, has a Tags field that edits them (`tagDefinition`), so every use shows the change.
  It is a draft edit of the library, one Undo step, handed over by Save; the panel's tag headings
  follow at once. Tags are no part of the version: no use goes stale. A preset's field is read
  only. A tag chip's Backspace or Delete is the field's: the inspector's Delete-the-node key hears
  only a key no field took (`defaultPrevented`), or a chip's Backspace removed the node.
  The OPEN graph's own tags (TODO 828) are on its own Group Input and Output: a draft beside
  the workflow's, one Undo step, and not an edit of the library's copy of it. That copy holds
  the graph as last saved, and a Save that wrote it as an edited definition would put the old
  graph back. `editor.tags()` is what the app's `saveGraph(…, { tags })` writes.

- Site: `src/core/data/node-library.ts`
- Site: `src/core/data/node-group.ts`
- Site: `src/core/ui/node-graph.ts`
- Site: `test/unit/a-custom-node-is-an-instance.test.mjs`
- Site: `test/unit/a-custom-node-is-saved-from-nodes.test.mjs`
- Site: `src/data.ts`

### T-a-custom-node-header-adds-an-input

**A Custom Node's header takes ANYTHING, and each connection let go on it is a NEW input of its
definition.** Will, 2026-11-05 (TODO 763): "A group input can take anything. What is connected to
it becomes a row on the group input node within the group. These rows are then reconnected to any of
the group's internal node sockets. I never said that a group input was of a certain type."

- **What it replaced.** 759 matched a header connection to the first input row of its type, and kept
  one no row fitted on the header. Nothing about an input is a type until something is connected.
- **The rule.** `headerInput` (node-group.ts): a connection let go on a use's header adds an input to
  the definition, named and labelled by its source as `groupNodes` names one ("Source › Rows"),
  typed by what the source sends. It is a Group Input row inside, with an output socket, and a row
  on every use; the connection enters this use's new row. It feeds nothing inside until the reader
  connects it on. The editor's drop, "Add a node" from a line, and a moved end all take this one
  door (`join` in `bindWorkflow`); `editWorkflow` and `readWorkflow` know no definition, so they
  leave a header connection where it is.
- **The definition is shared (D11).** The add is a definition edit, in the editor's draft until
  Save (nothing about it is a fault). The use that took it follows the new version; every other use
  says Update available. A preset is read only: the drop is refused as any refused drop is, in
  words through `report` (`workflow-connection`), and nothing is kept; a moved end goes back (TODO 803).
- **Read once.** A connection a use's header holds from a file saved before reads as its own new input
  (`heldInputs`), as the editor opens and after Discard; the draft and the edit are kept for the
  tab together, so a reload does not add it twice. A preset's stays on the header.
- **Ungroup** joins each connection into a row to every inner socket that row feeds. A row that feeds
  nothing inside, and a header connection, have nowhere to go, and are dropped.
- **The Group Input has no header socket** (Will, 765): nothing stays on a use's header, so it
  would send nothing. Only its rows send. A definition connection from `#in` itself is a fault.

- Site: `src/core/data/node-group.ts`
- Site: `src/core/ui/node-graph.ts`
- Site: `test/unit/a-custom-node-is-saved-from-nodes.test.mjs`

### T-an-entity-is-an-envelope-and-a-type

**An entity is ONE envelope for every kind of saved graph, and its TYPE says the rest.**
Will, 2026-11-05 (plan-746, D1-D3, D8); versions: "not too fussed while we build the core".

- **The envelope** (`schemas/entity.v2.json`, `entity.ts`): `{ v, type, id, label, description?,
  graph { nodes, connections, ties }, settings, uses, origin }`. The graph is a workflow's, with `#in`
  and `#out` as a Custom Node has. `origin` (`preset` or `mine`) is set on READ, never written.
  A Custom Node is the type `node`, its sockets in `settings`; `nodeEntityOf` and `definitionOf`
  are the two ways round. An app ships its Custom Nodes as entities (app.v1 `nodes` and its
  `loadNodeLibrary` are gone, TODO 777); the old `nodes` part is not read (TODO 816).
- **The type registry** (`entity-types.ts`, the data layer, light): each type is a `type.v1`
  (plan 960 U2) whose `graph` part says the families its graph may place (a kind's category), the
  `#in` and `#out` it demands, `runs` and `reusable`; beside it, in code, its settings check (and
  its schema in `schemas/entity-<type>.v1.json`) and `defaults`. Two ship: `filter` and
  `node`. An app adds its own with `registerEntityType`, or in its entities file's `types`
  (entities.v3); `typeFaults` refuses a bad one, in words, and a clash with a shipped type is
  refused. The data layer has no schema validator, so the checks are hand-written (as
  `checkNodeLibrary`'s are) and a test holds the schema and the check to the same answers.
- **Any entity is a node in any graph** (D1): `asNode` is the box it offers, its kind is
  `<type>:<id>` (a `node`'s is its plain id, as today). `libraryOf` keys the boxes by kind, so
  `innerOf`, `useOf`, `definitionDiff` and `updateInstance` serve entities as they serve Custom
  Nodes: a use records the version and `was`, and follows its definition (D8). `uses` is kept
  beside the graph for a quick dependency check; the nodes stay the truth.
- **One check** (`entity-check.ts`, which reads kinds and workflows, so it loads only when asked).
  `checkEntity` says each fault in words: unknown type, a family outside the type,
  settings the type does not keep, an output nothing reaches, a `uses` that is not there, a loop
  of entities (said once, from its first end), and the graph's own faults as a Custom Node's.
  Every writer calls it.
- **One shelf** (`entity-shelf.ts`, E2): `list/get/save/remove/duplicate/export/import/watch`
  over a port, so the rules are one set. The reader's own are ONE named part of the keeper
  (`entities`, app-wide); the presets are `entities.json` (app.v1 `entities`) and the Custom Node
  presets read as type `node`. Its `library()` is every entity of a reusable type, as the node it
  offers (E5, built in memory by `libraryOf`); the old `nodes` part is gone, and the database drops a leftover `nodes`
  store unread (TODO 816).
  A remove is refused while another entity `uses` it, naming who.

- Site: `src/core/data/entity.ts`
- Site: `src/core/data/entity-types.ts`
- Site: `src/core/data/entity-check.ts`
- Site: `test/unit/an-entity-is-an-envelope-and-a-type.test.mjs`
- Site: `src/data.ts`
- Site: `src/core/data/entity-shelf.ts`
- Site: `src/core/browser/entity-files.ts`
- Site: `test/unit/an-entity-shelf-is-one-door.test.mjs`

### T-a-graph-is-a-view-of-a-type

**A graph is a View whose body is a canvas: no fifth word.** Will, 2026-11-05 (plan-746 D4, D9,
D10): ONE preset View per entity TYPE, and a SECOND chip, right of the View chip, picks which entity
of that type the canvas shows.

- **The View** (`views.v1`, `defs.v1 #/view`) carries `graph: { type }` and no template or content.
  An app ships one per type it uses.
- **The row.** `chrome.filters: "views"`, on a Context with no definition: the outlet draws the View
  chip alone, and on a graph View the graph chip beside it (the bar's own actions taken away). Its
  rows are `graphRows`: the type's presets (read only), the reader's own, then New graph…. The
  outlet watches the shelf, so a save in another tab shows at once.
- **The URL** is `?view=<View>&graph=<entity>`; the type's first is left out, as the first View is.
  A pick REPLACES, as a View pick does. The outlet owns `graph` on the router where a Context needs it.
- **The Context** is handed `ctx.graph` (`{ view, type, id, origin }`) and hears `graph-change` on
  the outlet. It binds the canvas to `graphWorkflow(entity)`, `readOnly` on a preset; the outlet's
  `openGraph(id)` opens another. Set BEFORE the chips draw: what they report is what is open.
- **New graph…** is a REQUEST, `graph-new`, cancelable: taken over, the app asks a name and calls
  `newGraph`; not, the outlet makes "New <type>" and opens it. An EMPTY graph is a new one:
  `checkEntity` asks for its outputs once it places a node.
- **The canvas** edits the entity's own nodes, with `#in` and `#out` only where its type has
  sockets, as a Custom Node's inside is drawn; its id is the entity's, so its tab draft is its own,
  and its own kind is not offered there. `graphOfWorkflow` keeps the `#` nodes out of what is saved.
- **The header** (E4; Will: "repurpose the Save View button… 'Save' and 'Save Graph As'"):
  `data-graph` says graph in its words (Save graph as, Delete graph), `data-readonly` turns Save
  off on a preset, `data-custom-view` shows Delete on the reader's own; the outlet sets all three.
  `view-save`, `view-save-as` and `view-delete` are REQUESTS, cancelable: the Context that holds the
  canvas takes them over. Save is `saveGraph` (a preset refused by the shelf); Save graph as is
  `saveGraphAs`, the shelf's `duplicate` of the canvas's graph under the reader's name and a free
  id; Delete asks `whyKept` first, so a refusal is said in words before anything goes.
- **A page's Query is a graph too** (Will, TODO 822: "2 different views… The former has no app
  header"; plan-822). The type `query` (`PAGE_QUERY`) is no entity: its graphs are the app's
  pages, every Context with a definition (`pagesOf`): a page with Views is a chip section, a row per View under it,
  its presets read only, and a page with none is one row, with no New graph… (`pageRows`; plan 960 U4.8b). A row's
  value is `<page>/<view>` (`pageViewOf`); a bare `<page>` opens the View the page was left on, else its first.
  `?view=<the query View>&graph=<row>`, the first page left out. A filter toolbar's
  ⋮ › Open in Node Editor (`node-editor-open`) is answered by the OUTLET: a PUSH to the app's
  `query` View on the asking page, so Back returns to it; an app with none is not answered.
- **The outlet opens the page for its Query alone**: its definition (the app's `definition()` hook
  too), under the page's own KEY, on the View its row names, with `bars: false`.
  So the page's ONE document is what is drawn and what each edit writes: there is no second path
  to the data. `bars: false` answers no filter bar or panel (the header row stays the outlet's; the
  panel stays shut), hears no View chip, configures no element by id, and still answers a
  component (the inspector's live copy) and draws the page's news and reach. Leaving a page writes
  it as it was left — its View, its Query, what waited for its frame — so a page opened on a View
  by URL, never edited, opens on that View here too.
- **The Context is handed `page`** (`OpenPage`: `id`, `label`, `href` back on its View,
  `definition`, `source`, `components`, `markup`, `stores`, `view`), and `source` and `query` are the
  page's; `graph-change` carries the next `page`. Bind `bindQueryEditor(canvas, page.source, {
  definition, components, markup, stores, … })`, and load the source, as the page does, so each
  node lights. `markup` is the page's template off screen (`pageMarkup`, its View's own cards in
  `[data-view-content]`, parsed through the allow-list), where `pageComponents` reads the grids and
  charts and a Presentation's live copy is copied from. `presentsOf` reads a tag not upgraded by
  its class, so an inert template answers.
- **The header** shows the View's actions in a View's words (Save view, Save view as, Delete view): `data-graph`
  is an entity's graph alone. Each edit is the page's as it is made; Save writes its View. `OpenGraph.origin` is the
  View's, so a preset is read only and Delete shows on the reader's own. The Context answers the requests through the
  outlet's two doors: `savePageView(label?)`, over the reader's own View or as a new one named (the provider's
  `saveView`, its `query` by `statedQuery`), which the chip then opens; and `deletePageView()`, which opens the page's
  first View after.

- Site: `src/core/data/graph-views.ts`
- Site: `src/core/data/entity-check.ts`
- Site: `src/core/data/app-definition.ts`
- Site: `src/core/browser/persist-view.ts`
- Site: `src/data.ts`
- Site: `src/core/ui/shared-constants.ts`
- Site: `src/core/ui/node-graph.ts`
- Site: `src/components/sherpa-outlet/sherpa-outlet.ts`
- Site: `src/components/sherpa-provider/sherpa-provider.ts`
- Site: `src/components/sherpa-provider/provider-page.ts`
- Site: `src/core/ui/page-components.ts`
- Site: `src/components/sherpa-app-header/sherpa-app-header.ts`
- Site: `src/components/sherpa-app-header/sherpa-app-header.html`
- Site: `test/unit/a-graph-is-a-view-of-a-type.test.mjs`
- Site: `test/e2e/reforged-graph-views.spec.ts`

### T-an-entity-is-used-as-a-node

**A saved entity of any type is a node the panel offers, and a use of it is an INSTANCE that
follows it.** Will, 2026-11-05 (plan-746 E5; D1 "any graph type can have custom nodes", D8, and
plan-713 D11 with its update flow).

- **One library.** The editor's library is the entity shelf's `library()`: EVERY entity of a reusable type, as the
  node `asNode` makes of it, keyed by its use's kind (`<type>:<id>`; a `node`'s plain id). So the
  one Custom Node path serves them all: the panel lists them under Custom Nodes, a place is
  `useOf` (the version and `was` recorded), Enter opens the inside (a preset read only, with
  Clone), and a save, a `refresh` from the watch, `staleUses`, the diff and the split
  button are the Custom Node's own. No second path exists for an entity.
- **Back to its entity.** `nodeEntityOf(kind, definition)` is the inverse of `asNode`: an edit made
  inside a use, or a copy, is saved as an entity of the kind's type. A type's own settings ride in
  the definition's `settings` (never part of its version), so a Clone of a preset
  Filter is saved as the reader's own Filter, its source kept. One id names one
  entity of ANY type: `clone` frees an id among every type's.
- **What the panel offers** is `offeredKinds`, for the graph shown (the canvas's entity, given to
  `bindWorkflow` as `entity`; inside a use opened, that one): a kind its type `takes` (its
  families, the rule the check holds too), and any entity's node (no family bounds one, D1) but
  its own and any that holds it at any depth, read through the DRAFT. Without `entity`, a plain
  workflow is offered all.
- **The open entity's saved copy is never written.** The library holds it (another entity may
  place it, and the checks read it), but "Update all instances" skips it: its graph is the draft,
  and Save writes the draft. Writing the saved copy too would put the old graph back over it.
- **Light.** The keeper builds the library, so the registry and `asNode` (`entity-types.ts`) load
  no node kind and no workflow; the check is `entity-check.ts`, loaded by a save.
- **Demos** saves each Custom Node the draft changed FIRST, and stops the Save on a refusal (a
  family its type does not take), so the draft keeps the edit.

- Site: `src/core/data/entity-types.ts`
- Site: `src/core/data/entity-shelf.ts`
- Site: `src/data.ts`
- Site: `src/core/ui/node-graph.ts`
- Site: `test/unit/an-entity-is-used-as-a-node.test.mjs`
- Site: `test/e2e/reforged-entity-use.spec.ts`

### T-a-filter-is-a-preset-of-its-store

**A Filter entity is a PRESET of every page over its store, read from its graph by ONE
reader, and declared through the door every preset takes.** Will, 2026-11-05 (TODO 776, plan 776):
"Preset filters will be custom nodes when we are specifically creating or working with filter type
graphs. Let's keep them but also make sure they work in the new architecture for nodes & data."

- **One reader.** `conditionAt(graph, '#out/where')` (node-flow.ts) reads what reaches the Where as
  ONE tree (plan 783 D7): Logic And and Or joining what comes in; a TEST — a Condition's comparison,
  Time's Between or Duration — a leaf on the Field on its header, ANDed with what
  the rows into that Field carry (Source › Field › A › Rows › Field › B is A and B); a USE of another
  entity read inside, at its Group Output (`inner`), so it flattens. The Outgoing JSON shows what it
  reads, so the canvas and the data cannot disagree. A test with no Field, a Field that sends
  nothing, Not and Is empty, a False, a loop: a fault in words.
- **One leaf reader.** Each comparison is read by `editedCondition`, the Query editor's own: text in a
  list's row splits as an edited row does. A number or a list of numbers stays as the row holds it; the
  page types it by its field (`presetReadings`, `T-a-value-is-typed-once`).
- **The plain form, each field's own** (`whereOfTree`): every All, at any depth, is one list of parts;
  each part must read ONE field. "Any" of two fields has no preset form, since a preset writes each
  field's own condition (`byPreset`); it is said in words and left off the bar (plan 776 D6).
- **One door.** The preset is `{ id: filter:<id>, label, where }`, the shape a page's own preset
  has. `ProviderPage.#layPresets` declares each scope's presets in one list: the page's own, then its
  Filters (a reader's saved ones among them), all through `presetReadings` and `declarePresets`.
  The chip is `preset:filter:<id>`; a press is `query.ask({ scope, preset, on })`.
- **Which pages.** Those whose store is its source: `settings.source`, else the store its graph's Source
  names (a new graph has no settings). The app's first, read only, then the reader's, in the shelf's
  order. Its bar is the one scope that holds every field it names, else the View. A View may name the Filters it
  offers (`filters: ["filter:<id>"]`, Will, plan 960 U4.4d): named, those alone; an empty list, none; none named,
  every one. They are laid again when the View changes, before its Query, which may turn one on (`#offered`).
- **Loaded only where needed.** The provider reads the shelf as the page opens: no Filter, no
  import. The compile (filter.ts) loads on first use. The provider hears the shelf, so one
  saved in another tab joins the bar. The outlet hands the keeper its entities BEFORE `open`: a first
  page read none when they came after.
- **Composing.** A Filter's use, its output into And or Or, brings its tree, read inside: its
  condition joins the outer one. A constant into And or Or folds (TODO 780); a condition a constant
  decides, always or never, has no preset form, nor has a boolean only a run gives: each is said in
  words. A graph that folds to never is Any of nothing, `{ or: [] }`, on each field its tests name:
  on the bar, and on it holds no row; one with no tested field is said in words
  (`T-an-empty-any-of-is-never`). An Or across two fields is said in words and left off the bar (plan 783 D7, 776 D6); an And
  across them is two readings.
- **One leaf.** `leafOf` reads one test: the field its Field picks, the operator its Operation, the
  value its Value B, Values, or Start and End. The one place a leaf is read.
- **The Query editor** offers a page's Filters under Custom Nodes; a click asks
  `{ scope, preset: <its id>, on: true }` of the scope that declares it (`placeRequest`). It draws one
  as a Preset node with its own name; its conditions are read only: its own graph changes it.
- **It keeps a Where where a Where says it all** (plan 960 U4.4b, D6). Its body is ONE: a `graph`, or a
  `query: { where }`, never both (entity.v2), and only a type whose graph part says `query: true` keeps a
  query. Its lens (`FILTER_LENS`) draws the graph from the Where (`whereGraph`: a Source, a Field and a
  test per field, as the Query graph draws a test) and writes a graph back as a Where while it holds only
  Source, Field, Condition and Time; a Value node, a Math node or a use keeps the graph. Every read of an
  entity's graph is `entityGraph`. The lens registers when filter.ts loads: sherpa-ui/data, the node editor
  and the provider load it. A Where's places are not kept: it unfurls when shown.

- Site: `src/core/data/filter.ts`
- Site: `src/core/data/node-flow.ts`
- Site: `src/core/data/where.ts`
- Site: `src/core/data/entity-types.ts`
- Site: `src/components/sherpa-provider/sherpa-provider.ts`
- Site: `src/components/sherpa-provider/provider-page.ts`
- Site: `src/data.ts`
- Site: `test/unit/a-filter-is-a-preset-of-its-store.test.mjs`
- Site: `test/e2e/reforged-filter-presets.spec.ts`
- Site: `test/e2e/reforged-query-panel.spec.ts`

### T-an-empty-any-of-is-never

**An Any of with no part is NEVER: it holds no row, and it is an answer.** Will, TODO 816. Any of is
"some part holds", so with no part nothing does; All of nothing is always, which narrows nothing.

- **Said, it stays.** A tree's `{ or: [] }` survives the plain form (`fieldTree`) and the reader's
  answer (`answeredCondition`), and `conditionClause` compiles it to `['or']`. A group whose rows
  were all unanswered is still dropped: that is a half-built row, not a never.
- **Every matcher holds it so.** `filterTest` (`some` of none), a held set, the IndexedDB store (an
  `or` takes no range: it reads all and tests each), a REST request (the filter as JSON) and the
  data handler's `isFilter`. `filterWithout` keeps it: it names no field, so no field's chart drops it.
- **Under Any of it adds nothing** (`never or A` is A, the join flattens); under All of it ends it.
- **A Filter that folds to never** puts `{ or: [] }` on each field its tests name, so its chip
  is on the bar and, on, gives zero rows. One that tests no Field has nowhere to say it: said in words.

- Site: `src/core/data/filter-state.ts`
- Site: `test/unit/a-filter-is-a-preset-of-its-store.test.mjs`

### T-a-frame-is-drawn-round-its-nodes

**A frame keeps only WHICH nodes; its box is drawn round them.** Will, TODO 778 ·
`docs/history/plan-778-frames.md`. The workflow's `frames` hold an id, a title, a line and the
node ids. No x, y, width or height is saved: the nodes own their places (one owner per value),
and the editor writes the box round their drawn cards on every draw, drag and resize, as
`data-x`, `data-y`, `data-w` and `data-h` on its `sherpa-node-frame`.

- **A node dragged out stays in.** The frame grows round it. It leaves by Release or Delete.
- **A node is in ONE frame.** Framing takes it from the frame it was in; a frame left with no
  node goes, in the edit and in `finalGraph`, as a tie with no connection does.
- **The frame owns no place, so it reports a STEP.** A drag on its header, or an arrow there,
  fires `frame-move { dx, dy }` in plane px; the editor moves every node in it as one `{place}`
  edit, one step. A frame never moves itself, and never writes a node.
- **Only its header takes the pointer.** The host is `pointer-events: none`, so a box or a pan
  starts on its body; it is drawn before the lines and the nodes, so it is behind them.
- **The header's height is a token sum**, its padding, a small button's row, the gap and the
  line, so CSS alone sets its top: `--y` is the nodes' top less the pad and the header.
- **Release is ONE act**: the frame goes and its nodes stay. Will's "remove the frame and
  release the contained nodes" name the same result; deleting the nodes is Delete.

- Site: `src/core/data/node-frames.ts`
- Site: `src/core/data/workflow.ts`
- Site: `src/data.ts`
- Site: `src/core/ui/node-graph.ts`
- Site: `src/components/sherpa-node-frame/sherpa-node-frame.ts`
- Site: `src/components/sherpa-node-frame/sherpa-node-frame.html`
- Site: `src/components/sherpa-node-frame/sherpa-node-frame.css`
- Site: `test/e2e/reforged-node-frame.spec.ts`

### T-a-portal-hop-is-resolved-once

**A portal hop is joined in ONE place, `portalFlow`; every reader of what flows reads its connections.**
Will, TODOs 779, 826 · `docs/history/plan-779-portals.md`, `docs/history/plan-826-portal-rows.md`. An In and an
Out of one name have no connection between them, so a reader that walks `connections` meets an In that sends nothing and an
Out row that nothing reaches. Each reader that followed connections itself would have to learn the hop, and one would not.

- **An In takes many connections; every Out of its name draws ONE ROW per connection into an In of the name**, as a Group
  Input does (763). The row is named `@` and the connection's SOURCE (`addressRow`, `o/@source-1/rows`), labelled
  from it ("Source › Rows") and typed by it. The Out's header sends nothing: it has no socket.
- **What flows is `flowOf` in workflow.ts, `flowing` in node-flow.ts**: both the one resolver's connections. A connection
  from an Out's row is ONE connection from that row's source, carrying the name (`portal`); an Out's row into an In of
  another name chains. `sentFrom`, a row's read, the field a node reads, the warnings, the faults, `conditionAt`,
  the Outgoing JSON and a Filter's compile all read it. The drawing reads the connections as given, so no line
  joins two portals. An Out's rows come from `flowOf`'s `kindOf`, never `kindOfNode`, which knows no connections.
- **A row's id is its source**, so it is stable: a connection in cut, its row goes, and the connections out of it are
  `orphans`, kept as another type's are (`keptConnections`): unseen, no fault, and Save leaves them out. The same
  connection back, the same row, and they draw again. An Out turned In, or renamed away, keeps them the same way.
- **Each row is connected alone**, so many-to-1 is several rows, and an input that takes one takes one row.
- **A loop through a row is a loop**: the check reads the connections as the data flows, and the editor refuses a
  connection, a name or a Rename that makes one, a name that revives a kept row too.
- **An Out no In names warns, and has no rows.**
- **A name is local to its graph.** A Custom Node's body resolves alone; Save as Custom Node refuses a pick
  that holds some, not all, of a name's portals; a row whose source is outside becomes `@#in/<input>`, and
  Ungroup gives each connection the use's input took its own row again. Ungroup renumbers a name the graph holds.
- **A picked portal lights its name** with `data-linked`, the active pin, as a picked node is.

- Site: `src/core/data/node-portals.ts`
- Site: `src/core/data/node-kinds.ts`
- Site: `src/core/data/workflow.ts`
- Site: `src/core/data/node-flow.ts`
- Site: `src/core/data/node-group.ts`
- Site: `src/data.ts`
- Site: `src/core/ui/node-graph.ts`
- Site: `src/components/sherpa-node/sherpa-node.ts`
- Site: `test/unit/a-portal-joins-by-name.test.mjs`
- Site: `test/e2e/reforged-node-portal.spec.ts`

### T-a-property-row-is-an-output

**A property row is output only, one definition, and connects like any output.** Will, TODO 835 ·
`docs/history/plan-835-organise-and-properties.md`. It is a row a node provides from its own data or logic: no control,
no input socket, no value to edit. `propertyRow` in node-kinds.ts is the ONE builder: an AI node's True (1 or 0), a test's
Pass and Fail (rows, plan 971 A; on one value, what reaches its header, `passes`, 971 §9). Count was its first use and is
gone (plan 944): counting rows is a Math type, Count. Sort and Group are kinds of their own in
Organise, and the Collection family and its Count type are gone: a saved `collection` reads with the fault "of the kind
"collection", which is not one", and nothing converts it.

- **It needs no reader of its own.** `givenAt` reads any output row; a True sends `{ kind: 'number' }` before a run, as
  a Result does. Warnings (764), coercion (781), a portal row's label ("Condition › Pass"), Save as Custom Node's outputs and
  Unfurl's socket heights all read it as an output.
- **A value or an object.** `propertyRow(name, label, gives)` gives a number (the default), text or a boolean (a circle or
  a triangle), or a row, rows or a record (a diamond); a True is a number, like any other.
- **A graph with a fault does not save.** Save says each fault in words and fires `definition-refused { faults }`; nothing is
  handed over. Every shipped definition is walked for faults (sherpa-ui's, and Demos'): none is converted on read, each is
  corrected or deleted.

- Site: `src/core/data/node-kinds.ts`
- Site: `test/unit/a-property-row-is-an-output.test.mjs`

### T-a-cell-draws-words-not-its-value

**A cell draws its value in WORDS; all that acts on it reads the RAW value.**
TODO 791, found by 785 (2026-11-05). A cell drew `String(record[field])`: a
dotted field was blank, an object drew "[object Object]", a date its ISO day, a
boolean "true" past its field's `labels`, a list "VIP,Legacy".

The value is read by `readField`, the one dotted reader the stores and filters
use, never a second. `formatFieldValue()` (`src/core/data/format-value.ts`,
DOM-free) says it: its field's NAME for it first, by value key — the names its
source's filter options carry, so a cell says what its chip and menu say; a
list as a list (`Intl.ListFormat`, each item as its field reads it); a day the
one way (`formatDate`; its time too where the field says `time`,
`T-a-date-reads-one-way`); an object by its parts, `building: B2, floor: 3` — a
page that wants one part shows it as a dotted column. A boolean with no
`labels` reads `true`, as its chip lists it; a number is drawn as given. A group
heading, and its toggle, are named in the same words.

Raw stays raw: the sort (an ISO day sorts by the day; by its words, "01 Feb"
would lead "20 Dec"), a cell chip's pick (`false`, the ISO day, `B3`), a group's
key, a search. A filter's MARKS land on the words drawn, so a name that does not
read like its value marks nothing.

A list is words, not TAGS: a grid's tags are filter toggles, and the data layer
has no "a list holds this value" operator (TODO 792) — `eq` and `in` compare the
whole list, so a tag per item would filter wrong.

- Site: `src/components/sherpa-data-grid/grid-cells.ts`
- Site: `src/components/sherpa-data-grid/sherpa-data-grid.ts`
- Site: `src/components/sherpa-data-grid/grid-groups.ts`
- Site: `src/core/data/format-value.ts`
- Site: `test/unit/format-value.test.mjs`
- Site: `test/e2e/reforged-a-cell-reads-in-words.spec.ts`

### T-unfurl-keeps-the-flow

**Unfurl lays the graph out round its hub, but every line still runs left to right.** Will, TODO 569 ·
`docs/history/plan-569-unfurl.md`. Will asked for weighted cells round the most connected node, its neighbours
spread evenly round it, the next generation after. Done as a full circle, half the lines run right to left: a
connector leaves a node's RIGHT edge and enters the next one's LEFT edge, so a target to the left of its source
is drawn as a loop. So the rings are signed by the flow: the anchor's outputs fan right, its inputs fan left.

- **The rings are made valid, not just signed.** A walk from the anchor gives each node its side, but two walks
  can disagree, and a ring that a connection goes BACK into draws a backwards line. The rings start as a longest-path
  layering (every connection to a higher ring, always), and each node then moves to the valid ring nearest its own.
  Repairing the walk's rings in place stopped before it settled, and left 43 back lines in 300 nodes.
- **The order is kept, so the pull cannot tangle it.** A free spring-and-push relaxation crossed lines that the
  ring order had untangled. The centroid pull moves heights only, and an isotonic projection puts each ring back
  in its order with its gaps, so a node never passes its neighbour.
- **No overlap is made in x alone.** An arc bends in at its ends, so an outer ring's end can sit left of an inner
  ring's middle. Pushing a node along its ray from the anchor moved it off its height and broke the flow. Moving it
  out in x only, ring by ring, past its sources and past any node placed before it in its height band, keeps both.
- **A frame is one cell.** Its nodes keep their column; the frame's pad and header are read off a drawn frame, so
  the gap is between the frames' boxes, not their nodes'.
- **A portal pair has no connection, so it pulls nothing.** An In and an Out of one name sit by their own connections' nodes,
  so a graph cut by portals is several parts. The parts keep the order they stood in, left to right: biggest first
  put Demos' Source and its In portal to the right of the Outs it feeds.
- **Within a part, the places a node had do not change where it goes.** Only the boxes and the connections do; the old
  places give only the parts' order and the first part's anchor, which keeps its place. So a second Unfurl gives
  the same layout.

- **A node's neighbours stand in its sockets' order** (Will, TODO 827). The editor hands each connected socket's drawn
  height. The cells one cell reached first, on one side of it, take their own slots on their ring in the order of its
  sockets, in every candidate; where several connections join two cells, the topmost socket decides. Each line is pulled
  level, socket to socket, and the lines are counted socket to socket, so two lines out of one node's two sockets
  that swap are a crossing. With no socket heights, every socket is at mid height and unfurl is as it was.
- **Will's order wins, but only on the ring.** Ranking the candidates by the sockets' order first, every pair of a
  node's neighbours, took the drawn crossings of eight random graphs with rows from 599 to 881. Dealing the cells
  that hang from one cell into their own slots costs 599 to 624, and leaves no such pair out of order on a ring.
  Siblings on different rings, and a node's other neighbours, follow the fewest crossings.

- **A graph reads left to right** (Will, TODO 839). Sources and a Portal In stand left, Outputs and a Portal Out right
  (`bands`); an In hands on to each Out of its name with no line, and that hop (`hops`) holds the order a connection would, so
  a portal pair makes one part, never two stood in the order they were: it cannot flip. The MAIN part (the most nodes)
  keeps its place; every other part and every lone node but a Source or In stands in ONE stack on its left, top to bottom
  as they stood, wholly clear of the main part's lines (Will, 2026-11-10); a lone Source or In has its column left of that.

- **A tie is a point in the flow** (Will, TODO 888: "use zip ties as anchor points"). A tie whose every connection joins two
  moved cells is a cell of no width (`#tie:<id>`), and each connection through it is a piece to it and one on, its slot the
  socket on both: so what feeds it stands on its left and what it feeds on its right, in its slots' order, and its lines
  never cross at it. Its weight is two a connection, so a tie of many is the anchor and keeps its place, as the central node
  would. A tie it cannot hold so still goes to its connections' middle. Before, every tie went to the middle after the
  nodes moved: a tie a reader had placed was thrown away.

- **In stages, the stages move with the nodes** (TODO 950). Unfurled by the flow alone, then fitted, each stage's nodes
  moved by how far the stage packed from where it stood (`packBands` moves a flex band's members by `start - stage.x`),
  and some were held at its left edge: a made Coworker's Report nodes landed in one column, on each other and level with
  what fed them. Now the whole graph is laid out by the flow, as before; then each stage's nodes, the main part's as laid
  and a stack of its own, move across into their band, packed by `stageBands`, the first stage where it stood. The place
  edit writes each stage's left edge with the places, so the fit after moves none, and a tie in a stage moves with it. A
  node in no stage joins the nearest first and says so in its place, or the fit would put it in another. Every line runs
  left to right but one from a later stage into an earlier: the stages say so. With no stages, nothing changes.

- Site: `src/core/data/node-unfurl.ts`
- Site: `src/core/ui/node-graph.ts`
- Site: `test/unit/unfurl-spreads-the-graph-from-its-hub.test.mjs`
- Site: `test/unit/unfurl-keeps-the-socket-order.test.mjs`
- Site: `test/e2e/reforged-node-unfurl.spec.ts`

### T-a-simulation-reads-the-cache-and-writes-nothing

**A simulation READS the cached rows and WRITES nothing; a fetch is only ever a press.** Will, TODO 836 ·
`docs/history/plan-836-data-through-nodes.md`. `simulateGraph` takes a graph and the cached rows of each Source and gives
each node's incoming and outgoing slots, a row list on each socket. It is not N4: it sends, writes and notifies nothing.

- **No fetch without a press.** Nothing fetches on open, on an edit, on Save, on Undo, on a timer or on a store's push.
  Simulate runs only on a press or an agent's call, never as the reader edits.
- **A Source with no cached rows is "not fetched yet"**, a note on its slot and a fault in words, never an empty list that
  reads as "no rows".
- **A Condition keeps the rows of its Field's rows** that its leaf holds, by the same `filterTest` a page runs; its False
  is the rest. And keeps what every part kept, Or what any part kept. A row is the cache's own object, never a copy, so
  "kept" is identity.
- **A connection through a portal is read as the data flows** (`portalFlow`): no portal code lives here.
- **A path is a chain of kept connections from a Source to an Output**, through portals and through a use whose inside joins its
  Group Input to its Group Output. Fetch and Simulate are inactive without one, and the tip says which part is missing.
  Inside a Custom Node's definition they are inactive: they run on a whole graph.

- Site: `src/core/data/node-routes.ts`
- Site: `src/core/data/node-simulate.ts`
- Site: `src/core/browser/source-cache.ts`
- Site: `src/core/ui/node-graph.ts`
- Site: `test/unit/a-graph-has-a-route-from-a-source-to-an-output.test.mjs`
- Site: `test/unit/a-simulation-reads-the-cache-and-writes-nothing.test.mjs`
- Site: `test/unit/a-simulation-runs-every-kind.test.mjs`
- Site: `test/e2e/reforged-node-fetch-needs-a-route.spec.ts`
- Site: `test/e2e/reforged-node-fetch-caches-the-rows.spec.ts`

### T-a-task-queue-knows-nothing-of-what-it-runs

**The task queue is generic: it names nothing it runs, and the one who runs owns every word of the notice.** Will, TODOs 843
and 844 · `docs/history/plan-836-data-through-nodes.md`. A task is `{ id, kind, requestedBy, state, history[], outcome }`:
queued, running, then ok or failed, with the named states a run says. It is a small seam, not the full Task Manager (844, with
N4); Fetch and Simulate are its first two users.

- **A key makes a task exclusive.** A second request of a key a queued or running task holds is BLOCKED, not queued: `submit`
  answers `accepted: false` with the task in the way, and fires `task-blocked`. The editor keys a graph's tasks by the graph,
  so a press while Fetch runs is blocked, and says what is running.
- **Notices wait for quiet.** `task-notice` sums what ended into ONE: a single task says its own words, several are counted
  with the failures. Each end moves the timer, so tasks that end a little apart are one notice, not several.
- **The queue is told, not read.** The button, the node and the toast ask `get`, `list`, `busy` or hear `task-change`; the
  elapsed time is the task's history, drawn by whoever shows it.
- **The running look is one part, drawn from the task.** A node a task is on wears the node's own `caption` as a TAB on its
  top edge, right-aligned, with the play icon, and the active border (`data-step="running"` pins the active mode, never a
  colour of its own): "Fetching… 1s" on a Source being read, "Simulating… 1s" on the node a simulation is on. The seconds are
  the task's own history; the node only draws them. A stepped simulation (`stepSimulation`) lets the page draw between nodes
  once one has run over 16 ms, so the tab can move. One look for every kind of task. (TODO 845)
- **Light and in memory.** The history keeps the latest finished tasks (100); nothing is stored. A stopped task ends failed as
  "Stopped"; a queued one never runs.
- **It names no user.** The test reads its source for the words fetch, simulate, graph, store, row and source: none is there.

- Site: `src/core/data/task-queue.ts`
- Site: `src/core/ui/node-graph.ts`
- Site: `test/unit/a-task-queue-knows-nothing-of-what-it-runs.test.mjs`
- Site: `test/e2e/reforged-node-fetch-caches-the-rows.spec.ts`

### T-a-route-is-start-to-end

**A Route is a FULL path along Connections, from a Start node to an End node; a Branch is one of the Routes that
part at a node.** Will, 2026-11-11 (plan 934): a Connector shows a Connection, not a Route, so an agent that reads a
graph must say "two Routes branch at the Condition", not "two routes". `routesOf` lists each Route as its node ids:
from each Source, and inside a Custom Node from its Group Input, to each Output, and inside to its Group Output, as
the data flows (a portal hop resolved). A Value or a Field that nothing comes into FEEDS a Route; it starts none
(D5). `branchesAt` groups the Routes through a node by the node each goes to next: fewer than two, and the node is
no place where Routes part. A test is where its Pass and Fail Branches start (D3, plan 944; 971 §9).
`routeRead`, which Fetch and Simulate ask, is whether a Route exists at all. A loop is walked once.

- Site: `src/core/data/node-routes.ts`
- Site: `test/unit/a-graph-has-a-route-from-a-source-to-an-output.test.mjs`

### T-a-custom-title-follows-its-kind

**A node's title of its own follows its kind: "Field: Device type", "Condition: Under 8 GB RAM".** Will, 2026-11-11:
N-zo titled each node it made in its own words ("RAM (GB)", "Is a laptop"), and a reader could no longer see what
each node was. A title of its own is allowed; `nodeTitle` (node-title.ts, tiny, so sherpa-node reads it too) puts
the kind before it. The KIND, never a family's type: a Condition titled by the reader says "Condition", and its
check stays in its Type row. One with no title of its own is as it was; one that already starts with its kind and a
colon is as it is, so none reads "Field: Field: …".

The DATA keeps the node's own title, and so does `data-heading`: `workflowGraph` gives a titled node its kind's
name beside it (`kindHeading`), the drawing writes it as `data-kind`, and sherpa-node's header says both. Measured:
putting the kind INTO the heading broke 20 specs that find a node by `sherpa-node[data-heading="…"]`, and the
inspector's Name field would have saved the kind into the title. A label that names a node in words (a portal's
row, where a value comes from) says both; a node's own warning names it by its own words, as its header stands above it.

- Site: `src/core/data/node-title.ts`
- Site: `src/core/data/workflow.ts`
- Site: `src/core/data/node-kinds.ts`
- Site: `src/core/ui/node-graph.ts`
- Site: `src/components/sherpa-node/sherpa-node.ts`
- Site: `test/unit/a-custom-title-follows-its-kind.test.mjs`
- Site: `test/e2e/reforged-node-title-follows-its-kind.spec.ts`

### T-a-text-names-what-it-means

**A text names what it means one way, `{{kind:id}}`: a node's message and an agent's prompt alike** (Will, TODO 956:
"A"; plan 956). A node's value is `{{value:<node>.<name>}}`; the old `{node.name}` is not read, and stays plain text.

- **One reader**, `references.ts`: `refsIn` (each where it stands), `refsOf` (each once), `readRefs` (each read: its name,
  or why it names nothing, in words, never refused). `node-messages.ts` reads a message's values through it, and the
  Markdown model draws any reference as one atom, a chip.
- **The kinds are registered, read live** (`registerRefKinds`): the library's own, then each entity type (one call in
  `entity-types.ts`, read through the caller's `entity(type, id)`), then the app's. The module imports nothing, so a
  display component that reads the form carries no registry.
- **A kind reads its id from the facts' `<kind>s`** (a list, or labels by id). A field is read by its LAST part
  (`location.building`); a step's words are the caller's, read from its prompt.

- **A graph reads as text the same way** (`graph-text.ts`, plan 960 U5): `graphText` says its steps, `graphSteps`'
  order and numbers, each kind in its own words (`stepWords`; an app's by `registerStepWords`), naming what it means
  `{{kind:id}}`. A text form round it, as a Runbook's prompt, is the app's.

- Site: `src/core/data/references.ts`
- Site: `src/core/data/node-messages.ts`
- Site: `src/core/data/graph-text.ts`
- Site: `test/unit/a-text-names-what-it-means.test.mjs`
- Site: `test/unit/a-graph-reads-as-text.test.mjs`


### T-a-draft-hides-a-save

**A write under the reader's unsaved draft of a graph is refused, in words** (Will met it on "Contoso patching",
2026-11-14; plan 964 N3c). The editor keeps a draft of each graph for the tab, at `/workflows/<id>` in the session
(`shared: false`, so it outlives a reload), and the draft WINS over the kept copy when the editor draws it. So a
change, remove, publish or roll back made under it would be hidden: the reader sees the draft, and their next Save
writes the draft over it.

- **One owner of the pointer**, `graph-drafts.ts`: `keepDraft` is what `bindWorkflow` persists; `draftOf` reads it,
  and restores one kept before a reload when nothing holds it yet this load, as the editor would.
- **The acts ask `ctx.draftOf`**, which the outlet fills from its session. `graphActs` wraps each act that writes the
  entity its key names (change, remove, publish, roll back) so that its check AND its run refuse:
  `The reader has unsaved changes to "<label>" in the Node Editor (<n> nodes), and they hide any save. Ask the reader
  to Save or discard them first.` Find, read, add and clone write no kept copy under it, and run.
- **Read says the draft** beside the kept copy, `unsavedInTheEditor: { nodes, connections, text, warnings }`, so an
  agent knows what the reader sees.
- A Custom Node's definition edited INSIDE an open graph is drafted at `/node-edits/<graph>`, by the graph: this does
  not see it.

- Site: `src/core/data/entity-acts.ts`
- Site: `src/core/data/acts.ts`
- Site: `src/core/browser/graph-drafts.ts`
- Site: `src/components/sherpa-outlet/sherpa-outlet.ts`

### T-a-place-is-no-edit

**Where a graph is drawn saves itself, and is no part of a version** — Will, 2026-11-14 (TODO 1001): "Node position
edits, unfurls, swimlane toggles don't count as edits requiring a save. They apply and save automatically." Plan 1001
D1 A: Save and Publish are for what a graph DOES. A version still keeps its definition whole, places in it, and that looks
like a mistake; it is the fallback for a node the draft no longer has.

**The place set is said once**, in `graph-layout.ts`: each node's x, y and size, each tie's x and y, each connection's
bends (`via`), each stage's x and width, the swimlanes with `beforeLanes`, and the `unfurl` mark. `placesOf` reads it,
`withoutPlaces` takes it away, `withPlaces` puts it on each part it names; a part it does not name keeps its own. A
node's `stage` is no place: a move into another stage changes the run, so it waits for Save (D2 A). A frame is words.
A new layout mark goes into this set, or it lights Save and changes a version's hash.

- **The hash leaves places out**: `hashOfDefinition` hashes `withoutPlaces(graph)`. So a move alone is no change to
  publish ("Nothing to publish"), and `draftChanged` says no.
- **A kept hash is never trusted**: `draftChanged` hashes the newest version's definition again with today's function
  (once per version, in a WeakMap). Each hash kept before this change counted places, so comparing with it would have
  flagged every entity a reader keeps at once. The kept `hash` still holds the shelf's add-only check.
- **A published graph is drawn where the draft is**: `publishedOf` puts the draft's places on the version's graph. So the
  library, a use, and a Roll back (which writes `publishedOf`) leave each node where it is now.
- **A page's Query keeps its places in the same set** (plan 1004e): its layout, kept for the tab (`GraphLayout`,
  query-document.ts), holds `places` (`placesOf`, put back by `withPlaces`) and, whole, the parts a Query has none of:
  its ties, frames and stages, and each node's stage. A second shape had dropped `beforeLanes` and the `unfurl` mark, so
  Swimlanes off left each node of a Query graph where the lanes put it. A layout kept in the old shape is dropped once
  (`isGraphPlaces`), never drawn.

- Site: `src/core/data/graph-layout.ts`
- Site: `src/core/data/entity-versions.ts`
- Site: `src/core/data/query-document.ts`
- Site: `test/unit/a-place-is-no-edit.test.mjs`
- Site: `test/e2e/reforged-a-query-graph-keeps-its-places.spec.ts`
