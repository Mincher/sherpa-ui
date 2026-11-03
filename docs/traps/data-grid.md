# Traps — The data grid

One of the eleven areas of [the traps](../TRAPS.md): each entry is here because its
first `Site:` is in this area (`npm run check:traps` holds it so). 58 entries.

### T-col-width-not-inline-size

On a `<col>` in a fixed-layout table, use `width`, **not** `inline-size`.

Chromium does not feed the logical property into fixed-table column sizing: a
`<col>` styled with `inline-size` **measured 381px against a set 160px**.

A modernisation sweep replacing physical properties with logical ones would
silently destroy column sizing here.

**A card wider than its columns is FILLED** (Will, 2026-10-12, TODO 96). The
table stays a fixed table at its columns' sum; the grid shares the slack
between the columns the reader has not dragged, in proportion, by writing
their `<col>` widths — on each render, when its scroll box resizes, and while a
column is dragged. A dragged column and the pinned edges keep theirs; narrower
than the sum, nothing grows and the box scrolls. A filled column may pass the
maximum width, so a drag that starts there shrinks it without a jump.

- Site: `src/components/sherpa-data-grid/grid-widths.ts`

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

- Site: `src/components/sherpa-data-grid/grid-selection.ts`
- Site: `src/components/sherpa-data-grid/sherpa-data-grid.css`
- Site: `test/e2e/reforged-data-grid.spec.ts`


---

### T-swallow-flag-not-listener

A finished resize-drag fires a synthetic `click`, which would sort the column.

The fix is a FLAG, not a rival listener: `#onHeaderClick` is capture-phase on the
same element and was **registered first**, so it sorted the column before any
swallowing listener could run. Registration order decides capture order.

- Site: `src/components/sherpa-data-grid/grid-widths.ts`

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
re-opened menu show the pair already set, and what a heading cell made again
(a changed type or filter shape) draws from.

- Site: `src/components/sherpa-data-grid/sherpa-data-grid.ts`
- Site: `src/components/sherpa-data-grid/grid-actions.ts`
- Site: `src/components/sherpa-data-grid/grid-filters.ts`
- Site: `src/components/sherpa-data-grid/grid-groups.ts`

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
- Site: `src/components/sherpa-data-grid/grid-selection.ts`

### T-grid-column-width-bounds

A column is never narrower than `11ch` nor wider than `50ch`; it starts at
`DEFAULT_COL_WIDTH = 160` px. CSS sets the bounds on `.col-bounds`, in characters
of the grid's own face, and JS reads them back as px — `getComputedStyle` gives a
`ch` length in px — the way `sherpa-app-shell` reads its panel's minimum. Will,
TODO 575.

- **11ch** (about 97px in 14px Inter) is six characters plus padding. Narrower
  than that and a heading is pure ellipsis.
- **50ch** (about 440px) holds a long name or an email. A column that grows to
  fill a wide card stops there too, and the room left over stays empty: a
  sub-grid of two columns gave each half the card.
- **160** fits a name, a date or a mid-length status without clipping, which is
  most of what a grid holds.

Every route into a width is clamped — a config width, a wide card's share, a
drag — so a caller's `width: 4` cannot produce a column too thin to read.

- Site: `src/components/sherpa-data-grid/sherpa-data-grid.ts`
- Site: `src/components/sherpa-data-grid/sherpa-data-grid.css`

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
- Site: `src/components/sherpa-data-grid/grid-widths.ts`

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

- Site: `src/components/sherpa-data-grid/grid-widths.ts`

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

`sort-none` is the neutral sort pair, not three bars: three equal rules read
as a menu, not as "this column can be sorted".

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

- Site: `src/components/sherpa-data-grid/grid-filters.ts`

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

One path writes a menu, `#drawColumnFilter`, from `#columnFilters` — for a
heading cell just made and a kept one alike (`T-a-heading-cell-is-kept`).

- Site: `src/components/sherpa-data-grid/sherpa-data-grid.ts`
- Site: `src/components/sherpa-data-grid/grid-filters.ts`

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

- Site: `src/components/sherpa-data-grid/grid-cells.ts`

### T-grid-thead-sticks-as-one-block

There is **no sticky-offset measurement** in this grid, deliberately. The WHOLE
`<thead>` sticks as one block, so its two rows stay in normal flow relative to
each other and nothing has to know the label row's height.

Measuring it and offsetting the filter row was the bug: **a sticky offset is
measured from the SCROLLPORT, so it applied at scroll 0 too** and left a phantom
empty band between the two header rows.

Do not reintroduce a measured offset here.

- Site: `src/components/sherpa-data-grid/sherpa-data-grid.ts`

### T-grid-sort-is-tri-state

A column header's sort is TRI-STATE, and only its Sort button cycles it: the
column's name is plain text, and a click on it or the cell sorts nothing (Will,
TODO 502):

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

`sort-change` therefore carries `field: null, direction: 'asc'` on the third
click — the Sort chip's shape (TODO 523 S10).

**ONLY ONE COLUMN AT A TIME.** `data-sort-field` holds a single field, so sorting
a new column replaces the old one rather than stacking.

**The same third state as the chip's** (`T-sort-is-tri-state`): it SUSPENDS,
from the same `nextSort`. Unbound, the grid keeps `data-sort-field` with an empty
direction; bound, the Query keeps `sortSuspended`.

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

- Site: `src/components/sherpa-data-grid/grid-widths.ts`

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
- Site: `src/components/sherpa-data-grid/grid-selection.ts`

### T-grid-filter-fields-match-whole

`data-filter-fields` is space-separated and each name must be matched WHOLE.

A bare `includes()` on the raw string would light `status` for a filter on
`substatus`. Split on whitespace and compare the whole token.

The attribute itself is written by the source
(`T-push-writes-state-as-attributes`) from the flattened filter tree
(`T-filter-fields-flattens-the-tree`), which de-duplicates — so a field appearing
in two clauses arrives once, and the header only needs to know THAT it is
filtered.

- Site: `src/components/sherpa-data-grid/grid-filters.ts`

### T-grid-no-matches-is-not-empty

"No matches" is NOT `data-empty`. `data-empty` hides the whole `<table>`, which
would take the filter input the user is typing in with it.

`data-no-matches` is a separate flag, set when the visible count is 0 but the
grid still holds rows. CSS keeps the header and filter row up and shows the
message under them.

**A bound grid's rows can be 0 because its SOURCE filtered them** — its
`data-filter-fields` or `data-needles` says so. That is no matches too (359):
its headings — and a heading filter at 0 (`T-a-ruled-out-value-is-greyed`) —
stay in reach. Empty is 0 rows with no filter and no search.

- Site: `src/components/sherpa-data-grid/sherpa-data-grid.ts`

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

The opt-in that mirrors the Figma Grid Cell (926:34253) is `data-selectable`
(a leading checkbox column, a select-all in the header, and `selection-change`).

- Site: `src/components/sherpa-data-grid/sherpa-data-grid.ts`

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
- Site: `src/components/sherpa-data-grid/grid-actions.ts`

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

- Site: `src/components/sherpa-data-grid/grid-actions.ts`
- Site: `test/e2e/reforged-data-grid.spec.ts`
- Site: `src/components/sherpa-data-grid/sherpa-data-grid.html`

### T-grid-untyped-column-gets-no-filter-button

The filter CHIP is in the header template already; JS adds only the MENU, because
only JS knows the column's type and name.

`text`, `number` and `date` each get one. **Any other type gets NO button at
all** — an affordance that opens nothing is worse than none, so a column the grid
cannot build a control for shows no control rather than a dead chip.

The type is in a heading cell's key, so a column whose type changes is made
again (`T-a-heading-cell-is-kept`). `#drawColumnFilter` is the one path that
writes a menu, for a cell just made and a kept one alike
(`T-grid-read-without-write-is-half-an-api`).

- Site: `src/components/sherpa-data-grid/grid-filters.ts`

### T-grid-empty-clause-is-null

`#readColumnFilter` returns NULL for an EMPTY value as much as for a cleared
menu.

"Contains nothing" matches every row, so applying it would light the column and
change the view not at all — **which reads as the filter being broken**, not as a
filter that does nothing.

A RANGE needs BOTH ends for the same reason: one end alone is a "greater than"
the reader did not ask for. `T-grid-number-clause-must-coerce` is the other half
of reading a number column safely.

- Site: `src/components/sherpa-data-grid/grid-filters.ts`

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

UNBOUND, it does NOT re-fire `column-filter-change`: the caller is the one
who asked, so telling them what they just did would be an echo, and a host
that routes the event back into its query would clear it TWICE. Same silence
as `setColumnFilter` — `T-grid-read-without-write-is-half-an-api`. BOUND
(`data-locked`), it ASKS instead — `setColumnFilter`, `clearColumnFilter` and
`suspendColumnFilter` each send the one `column-filter-change` a reader's act
would, and the source draws the answer back; the same answer twice is a
no-op, so the echo dies there (366 step 23).

Pass NOTHING to clear every column at once, which is what a toolbar's "clear
all" means.

- Site: `src/components/sherpa-data-grid/sherpa-data-grid.ts`
- Site: `src/components/sherpa-data-grid/grid-filters.ts`

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

### T-pages-are-one-based-and-default-to-100

Two `sherpa-pagination` numbers that look arbitrary and are not.

**Pages are 1-BASED**, so 1 is both the default and the FLOOR. 0 and a negative
are not "a page" at all, and clamping them UP is the only sane reading — hence
`min: 1` on both `data-page` and `data-total-pages`.

**The default page size is 100, not the first option** (Will, 2026-10-22; it
was 25). 10 rows is a thin slice of a real table: it fills less than half a
panel and makes paging the main way to read the data. A host can still name any
size with `data-page-size`, and an options set that does not OFFER 100 falls
back to its own first option. The default options are 10, 25, 50 and 100. The
constant is public as `SherpaPagination.DEFAULT_PAGE_SIZE`.

`#clamp` states the **NaN** case rather than leaning on `Math.trunc(n) || 1`.
That idiom folds 0, NaN and -0 together — the exact trick `coerceNum`'s own doc
comment calls out as the reason it exists. It happened to be harmless here (page
0 is invalid anyway, so both paths give 1), but it hid its reasoning behind a
coincidence.

- Site: `src/components/sherpa-pagination/sherpa-pagination.ts`
- Site: `test/e2e/reforged-pagination.spec.ts`

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

- Site: `src/components/sherpa-data-grid/grid-selection.ts`

### T-radios-in-shadow-roots-are-not-one-group

A radio group needs its members in ONE tree. Wrap each radio in its own
component and the browser no longer sees a group at all.

`<input type="radio" name="x">` unticks its siblings because they share a name
*and* a root. `sherpa-select-radio` puts each input inside its own shadow root,
so the browser sees one group of one, per row — every radio stays ticked, and
nothing warns. Setting the same `name` on all of them does not help; the name
is only half the rule.

So the component keeps the group, by HTML's own rule: the same tag, the same
TREE (the host's root; a shadow root is a tree of its own), the same FORM owner
(`ElementInternals.form`, so a `form="id"` member counts) and the same non-empty
`name`. `radioGroup()` in `core/ui/radio-group.ts` finds it, for the radio and
the radio-mode card (TODO 285). Not the form's subtree, which misses a `form=`
member; not the document, which crosses forms and cannot see into a shadow
root. The grid's single-select rows are radios in its own tree, so the radio
unticks them; the grid only clears its own record.

This was free before, which is what makes it easy to miss: the grid's rows were
bare `<input>`s in one shadow tree, the browser did the unticking, and a comment
in the code said so. Replacing the input with a component silently removed the
behaviour that comment described.

- Site: `src/components/sherpa-data-grid/sherpa-data-grid.ts`
- Site: `src/components/sherpa-select-radio/sherpa-select-radio.ts`
- Site: `src/core/ui/radio-group.ts`
- Site: `test/e2e/reforged-form-controls.spec.ts`

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

### T-a-row-holds-two-selection-boxes

The row template holds BOTH a `sherpa-select-checkbox` and a
`sherpa-select-radio`. Until 2026-10-20 every body row stamped both and CSS
revealed one — so `.row-select` matched **two elements per row**, and a
hidden box still upgraded and stamped: 50 controls (and 25 inner buttons) on
every page of 25 rows. Now a row keeps only the box its mode shows, and none
when the grid is not selectable; changing `data-select` or `data-selectable`
draws the rows again (TODO 368).

Ask for the box through `#rowBox()` / `#rowBoxes()` (`.row-multi` or
`.row-one`) all the same: it reads which one the mode wants.

Four callers had it wrong, and each failed differently — which is what made it
hard to see as one bug:

| caller | what went wrong |
|---|---|
| `#syncGroupSelects` | counted 44 ticks against 22 rows, so a group box never read as full |
| `#syncSelectAll` | saw 50 boxes for 25 rows, so the header box was never "all" |
| `#emitSelection` | reported every selected row **twice** |
| `#selectGroup` | wrote to the hidden control in single mode |

The tests had the same fault: `.row-select` in a spec counts double too.

- Site: `src/components/sherpa-data-grid/sherpa-data-grid.html`
- Site: `src/components/sherpa-data-grid/sherpa-data-grid.ts`
- Site: `src/components/sherpa-data-grid/grid-selection.ts`

### T-a-cell-chip-is-one-and-moves

A cell's filter chip (TODO 373) is ONE `sherpa-quick-filter` per grid, MOVED
into the cell under the pointer — not one per cell. A page of 25 rows and 14
columns would stamp 350 chips, each a shadow root, for a control only one cell
shows at a time (368 took 50 hidden boxes out of a page for the same reason).

Three things follow from the move:

- A redraw empties the body, so `#renderBody` puts the chip back in
  `.cell-filter-home` first. Left in its cell it leaves with the row.
- The pointer does not move when the rows change under it (a press that
  filters is exactly that), so after a redraw the chip is placed again from
  the last pointer point, in the next frame, not by forcing layout.
- CSS shows it only on the hovered cell. The cell keeps the chip after the
  pointer leaves, so its room (`padding-inline-end`) is a hover rule too, or
  the last cell stays narrow.

The cell clips at its content box (`overflow-clip-margin`), so the cell that
holds the chip clips at its padding box, where the chip sits.

- Site: `src/components/sherpa-data-grid/sherpa-data-grid.html`
- Site: `src/components/sherpa-data-grid/sherpa-data-grid.css`
- Site: `src/components/sherpa-data-grid/sherpa-data-grid.ts`
- Site: `src/components/sherpa-data-grid/grid-cells.ts`

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

- Site: `src/components/sherpa-data-grid/grid-filters.ts`
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

- Site: `src/components/sherpa-data-grid/grid-filters.ts`

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
| `#renderHead` | each cell is drawn — made new, or kept (`T-a-heading-cell-is-kept`) |

The second is the one that hid the bug. `#renderHead` never called
`#syncColumnFilterStatus` — it set the `<th>` flag inline — so on any re-render
the flag survived on the heading and the chip beside it came back empty.

The chip is `data-locked`: the GRID owns its on-state. Writing it here is the
host doing its job, not the chip deriving something it does not own.

- Site: `src/components/sherpa-data-grid/grid-filters.ts`
- Site: `test/e2e/reforged-data-grid.spec.ts`

### T-one-value-one-declaration

The focus indicator was written by hand at **48 sites across 29 files** —
`box-shadow: inset 0 0 0 2px var(--sherpa-theme-border-accent-2, #3b4ccd)`,
verbatim each time. `CLAUDE.md` already said "this exact token and fallback,
verbatim", which is the shape of a rule nothing enforces: the doc had named the
WRONG token for months, and everyone who followed it got a ring drawn in the
fallback colour only.

It is a **custom property on `:host` in `sherpa-base.css`**, not a class (since
2026-10-22 an outline, `--sherpa-focus-ring` with `--sherpa-focus-offset`, so it
sits 1px clear of the edge — an inset box-shadow cannot leave that gap):

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

### T-a-sub-grid-sticks-under-its-parent

**A sub-grid stays its parent's width, scrolls sideways for itself, and its headings stay
under the parent's as the parent scrolls, with its cells passing under them.** Will, TODOs
626, 627. CSS cannot do all of that: a scroll box on one axis is one on both, so a
sub-grid that scrolls sideways is what its `sticky` sticks to. Without a scroll box the
headings stuck, and a wide sub-grid broke out of its parent. So:

- **It scrolls on one axis.** `--_detail-block: hidden` on the parent's `.detail-cell`
  stops the block axis; its height is its rows', so nothing is cut.
- **JS moves its headings,** coalesced per frame: `translate` by how far the parent's foot
  is past the sub-grid's top, capped so they stop at its last row. No `--_head-stuck`, and
  `translate` is invalid, so no other grid has its stacking context.
- **`isolation: isolate` on the cell.** Both `.head`s are `z-index: 3`, and the later one
  in the document drew over the parent's headings.

- Site: `src/components/sherpa-data-grid/sherpa-data-grid.css`
- Site: `src/components/sherpa-data-grid/grid-details.ts`
- Site: `test/e2e/reforged-data-grid.spec.ts`

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

### T-a-grid-draws-once-per-moment

TODO 355 C2. `sherpa-data-grid`'s `onChange()` ran a FULL `#render()` on every
observed attribute, and a bound publish writes several (`writeView`: the sort,
the page, the total…) and then the rows — so one filter click drew the grid,
heading and body, four or five times, building each heading cell's chips and
menu again each time.

Now an attribute change only marks a render OWED (`#invalidate`), drawn once
at the end of the moment (`coalesce`, `T-coalesce-microtask-not-debounce`). And
`populate()` says rows are coming: an owed render waits for them, and
`renderData` draws everything once. If no rows come (the same rows), the owed
render draws. What must read the drawn DOM first calls `#flush()`: the header
click's own sort (still synchronous), `openColumnFilter`, `findStep`.
`renderData` stays synchronous, so `await populate()` still sees the DOM.

Overriding `populate()` is not a new method: `ts-facts.mjs` lists it with the
base's lifecycle, so the grid's spec does not change.

**Layout is read once, and only when it moved** (C4). `#syncPinned` and `#fill`
each read layout on every render — two forced layouts per draw. `#measure()`
reads the select cell, the edge cells and the box together, then writes the
offset and the `<col>` widths — and only when its key moved: the shown columns,
their widths, the dragged widths, `data-selectable`, rows or none, actions or
none. A resize (the observer watches the box and the select cell) or a drag
forces it. A grid drawn while HIDDEN measures 0 and keeps no key, so it measures
again when shown. The `<col>`s are stamped again only when the shown columns
change, or the widths `#measure` shared out would be lost. Pinning the select
cells is writes only, on every draw (`#pinSelects`).

**A reading and its rows draw the body once** (plan 695 P4). A bound grid is told
a heading's new answer (`drawReading`, `supersede`) before its source has read
the rows that answer leaves. The heading draws then; the body is OWED. The source
asks its load before it draws the answer, so the load's microtask runs first, and
its `loading` reaches the grid through `bindSource` as `drawLoading(true)`: the
owed body waits for the rows. `drawLoading(false)` draws whatever is still owed —
no rows came. The column bounds are read off CSS only when the box resized: read
after every body draw, `getComputedStyle` forced a style pass (~40 ms at 4x).
Measured on Demos Records at 4x: a value tick 216 → 80 ms, a chip on 208 → 80.

**Each attribute redraws only its part** (C3). `onChange(name)` routes: a page
or the needles redraw the BODY; the column values the HEADING; the sort both;
`data-filter-fields` lights the chips in place; the total pages, the lock and
the CSS-only flags draw nothing; anything else draws all. Only after C4, as a
part drawn alone still pins its select cells and measures — a heading drawn
alone would otherwise lose the shared widths, and a body the frozen column.

- Site: `src/components/sherpa-data-grid/sherpa-data-grid.ts`
- Site: `test/e2e/reforged-grid-keeps-its-heading.spec.ts`
- Site: `test/e2e/reforged-a-grid-draws-once-per-act.spec.ts`
- Site: `src/components/sherpa-data-grid/grid-widths.ts`

### T-a-heading-cell-is-kept

TODO 355 C5. `#renderHead()` removed every heading cell and cloned it again on
each render — per column a filter chip, its `sherpa-menu` from `menuFor()` with
its own inputs, a sort chip and a button: 280–560 components per build on
Records, the largest single cost of a filter click (`#bootstrap → #stamp`, 260
of about 500 ms busy at 4x). It also shut an open heading menu, lost its search
and focus, and dropped a grip's pointer capture.

Now the heading is RECONCILED by field. A cell is made again only when its KEY
moves — the column's type, whether it filters, and its filter menu's SHAPE (its
def without `options`, `min`, `max` and `availableDates`; `range` as
`menuFor` reads it), the bounds and apply-on. Else it is KEPT and drawn in place
by ONE function for new and kept cells alike (`#drawHeadCell`,
`#drawColumnFilter`), so every state is set AND taken away: `data-type`, the pin,
`data-status`, the sort, `data-superseded` and `data-applied-at`,
`data-advanced`, `data-unavailable`.

- **A kept menu is told only what moved.** Its values only when they changed
  (`#itemsFor`), so the search text stays; its reading only when what it HOLDS
  changed (`#drawn`, compared with `sameReading`), so a reader's unapplied draft
  survives a push of the same answer. A heading's own Apply records what it
  holds first, so the push it causes writes nothing back into that menu.
- **Will, G1 A:** a NEW answer for an open menu's field is written into it, and
  the menu stays open; it takes a new Cancel baseline (`takeBaseline()`). New
  values for an open menu keep its draft's ticks that still exist.
- **A kept chip refreshes its face** when its menu's answer or its superseded
  state moved: a chip made new drew it on its first render; a kept one would
  keep its old tip ("This chip holds EMEA").
- **A cell is moved only when it is out of place** — a moved node shuts an open
  popover. The ACTIONS head stays last.
- The filter row is stamped again only when the shown columns change; else each
  input shows what it holds, in place.

Measured: a bound pick makes 0 heading cells and 0 heading components (it made
4–5 full builds); `test/e2e/reforged-grid-keeps-its-heading.spec.ts` holds it.

- Site: `src/components/sherpa-data-grid/sherpa-data-grid.ts`
- Site: `test/e2e/reforged-data-grid.spec.ts`
- Site: `test/e2e/reforged-grid-keeps-its-heading.spec.ts`
- Site: `src/components/sherpa-data-grid/grid-filters.ts`

### T-an-inner-event-stops-at-its-host

**A page hears a component's OWN events, never its parts'.** Every `emit()`
is composed, so an inner `<sherpa-button>`'s `button-click` left its composite
with the composite as its target: a page listening for `button-click` heard
every app-header action and every container Retry. Will, TODO 213, A.

So `emit()` from a part inside a Sherpa composite's shadow root adds a
stopper on that composite's host just before it dispatches. The stopper is
the LAST listener there, so the composite's own listeners — and any a page
put on the host itself — still hear it; then it goes no further. A composite
that wants a part's event to be its public API says so by emitting its own.

A slotted child is the page's markup, not a part, so its events pass through
as before. The menu was the one component that relied on the leak: its
number field, slider and condition rows are parts, and a committing menu's
host — the filter panel — reads its draft from their `change`. So the menu
passes on a plain `input` and `change` for each (`#passOn`). Found by the
Demos test that flips a panel field to "is not".

Measured by `reforged-only-own-events.spec.ts`, which presses every button in
every bare component: 24 leaks without the stopper, 0 with it.

- Site: `src/core/ui/sherpa-element.ts`
- Site: `test/e2e/reforged-only-own-events.spec.ts`
- Site: `src/components/sherpa-data-grid/sherpa-data-grid.ts`
- Site: `src/components/sherpa-data-grid/grid-details.ts`

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

- Site: `src/components/sherpa-data-grid/grid-filters.ts`
- Site: `test/e2e/reforged-data-grid.spec.ts`

### T-a-sideways-scroll-shadow-is-its-frames

**A sideways scroll's two edges are drawn by a FRAME round the box** (Will,
TODO 478). The box's own `::before` and `::after` are its top and bottom edges
(`T-a-scroll-shadow-is-drawn-over-the-content`), and an element has no third
pseudo-element. Nor can a sticky edge stand down the box's side: a sticky
child cannot take the scrollport's height, and an absolute one scrolls away.

So `.sherpa-scroll-frame` wraps the box: `position: relative`, and two EMPTY
SPANS in it, `.sherpa-scroll-edge-start` and `-end`, absolute over the box's
sides, `inset-block: 0`, 12px of gradient, `z-index: 5`. Spans, not the frame's
own `::before` and `::after`: WebKit gives a scoped timeline to an element and
not to a pseudo-element, which then ran on no timeline and showed its start
edge for good. The box names its sideways scroll
(`scroll-timeline: --sherpa-scroll-inline inline`) and the frame scopes the
name (`timeline-scope`), so the frame's edges follow a scroll they are not
inside: the start fades in over the first 16px, the end out over the last.
With no sideways overflow the timeline is inactive and neither shows.
Chromium and WebKit; Firefox 155 has no scroll timeline.

**A box that pins columns says how far in its edges sit**: `--_scroll-inset-start`
and `--_scroll-inset-end`. The grid always pins its first column (and the
selection column), so its start edge stands past them — measured, in the same
read as its column widths — and, with Actions, its end edge stands before that
76px column. Content scrolls UNDER pinned columns, so that is where it hides.

The frame takes the box's place in its layout (a flex column, `flex: 1 1 auto`,
`min-block-size: 0`) and the box fills it, so a fit grid still measures the
box. Frames: the grid's scroller, the app shell's Context, the dialog's body.

- Site: `src/core/sherpa-base.css`
- Site: `src/components/sherpa-data-grid/grid-widths.ts`
- Site: `test/e2e/reforged-scroll-shadow.spec.ts`

### T-heading-buttons-show-on-hover

**A heading's buttons show while it is hovered or focused — and while one is on
or open** — Will, TODO 501, with the app's "Heading buttons on hover"
(`data-heading-hover`, on by default). They go by `visibility`, not `display`,
so the heading's name never shifts as the pointer crosses. Two stay out:
an ON one (a sorted or filtered column says so, and the heading itself is
deliberately unpainted), and an OPEN one — `visibility: hidden` on a chip hides
its slotted menu too, top layer or not, and the pointer leaves the heading the
moment it moves into that menu. A heading's Group button (TODO 500,
`data-heading-group`) groups by its column; a number or a date offers none.

- Site: `src/components/sherpa-data-grid/sherpa-data-grid.css`
- Site: `test/e2e/reforged-data-grid.spec.ts`

### T-a-joined-menu-answers-each-field

**A multi-field column's heading menu is ONE menu over SEVERAL fields, and each
field keeps its own answer** — Will, TODO 490: *"The column header filter menu
will need to concatenate each fields values into a single menu. The toolbar and
panel still show individual chips, sections, and values per field."* A column
names its `tags`; its menu lists its own values (a plain list only), then each
tag field's, a section each. A row's value is `field` + U+001F + `value`, so two
fields that share a value ("active") are two rows. Apply splits the ticks by
field and reports EACH field whose ticks CHANGED as its own
`column-filter-change` — never one for the column. A field that did not change
is not reported: one answered by conditions shows no ticks here, and reporting
its empty section would wipe the bar's Advanced answer.

Simple only: no Advanced and no Select all (every value of every field answers
nothing). A field the View holds is LEFT OUT of the menu, since a menu is
read-only whole or not at all; its tags are greyed, refuse a press, and ONE
tip says where the filter went: each held tag is `aria-describedby` it, and the
shared tip moves to the one hovered (`T-a-tip-lives-in-the-top-layer`).

A TAG is its value's toggle. Pressed, its value is picked — out of All too, so
"filter by this" narrows even where the field opens on every value; pressed
again, it is let go, and the last let go is NO filter, not none (Will: "clicking
the tag again clears the filter value"). It wears the plain Tag look, and the
filters' on colours while picked: the data-viz colours were tried first, and
were "not great" (Will, TODO 507). While a shown column draws tags, EVERY cell is
two lines and starts at the first (`:state(multi-field)`), so the values align
across the row (Will, TODO 509).

- Site: `src/components/sherpa-data-grid/grid-cells.ts`
- Site: `test/e2e/reforged-multi-field-column.spec.ts`
- Site: `src/components/sherpa-data-grid/grid-filters.ts`
