# Traps — The join and the app layer

One of the eleven areas of [the traps](../TRAPS.md): each entry is here because its
first `Site:` is in this area (`npm run check:traps` holds it so). 40 entries.

### T-a-word-is-in-the-markup

**A fixed word the TS hands on as data is in the component's markup** (Will,
TODO 344): a section title, a menu's empty choice, a chip's label, a
placeholder. It sits in a `<template class="words">` of the stamped template —
never cloned, so it is never shown —

```html
<template class="words"><span data-word="presets">Presets</span></template>
```

and the code reads it with `this.word('presets')`. A word belongs to the
TEMPLATE it is in, so a component with several templates puts it in each one
that needs it: input-text's `number` and `find` each have their own
`placeholder`. A missing word is REPORTED once (`word-missing`), never thrown.
A host without its own shadow root asks its element (the provider's page code
awaits `rendered`). A consumer's `useTemplate()` markup can retext every word.

A word with DATA inside it (`Reset ${name}`) is not one: it stays where its
data is.

- Site: `src/components/sherpa-outlet/sherpa-outlet.html`
- Site: `src/core/ui/sherpa-element.ts`
- Site: `src/components/sherpa-provider/provider-page.ts`
- Site: `src/components/sherpa-menu/sherpa-menu.html`
- Site: `src/components/sherpa-nav/sherpa-nav.html`
- Site: `src/components/sherpa-input-text/sherpa-input-text.html`
- Site: `src/components/sherpa-provider/sherpa-provider.html`
- Site: `src/components/sherpa-quick-filter-toolbar/toolbar-rows.html`
- Site: `src/components/sherpa-data-grid/sherpa-data-grid.html`
- Site: `src/components/sherpa-quick-filter/sherpa-quick-filter.html`
- Site: `src/components/sherpa-nav-item/sherpa-nav-item.html`
- Site: `src/components/sherpa-chart-legend/sherpa-chart-legend.html`

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

- Site: `src/core/ui/bind-source.ts`

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
bindSource(source, qft, { steerOnly: true, ignore: ['quick-filter-change'] });
```

An ignored event gets **no listener at all**, rather than a listener that
returns early — so a view that owns an event owns it outright, with no chance of
the source having already acted by the time the view's own handler runs.

- Site: `src/core/ui/bind-source.ts`

### T-steering-events-are-a-closed-list

`STEERS` in `bind-source.ts` is the CLOSED table of events a bound component may
send up, and the command each asks the Query (`T-one-command-one-door`):
`sort-change`, `group-change`, `quick-filter-change`, `filter-add`,
`filter-remove`, `column-filter-change`, `filter-apply`, `filter-discard`,
`page-change`, `page-size-change`, `search-change` — and two that are no edit,
`grid-pages-change` (a report) and `select-all-request` (a read).

Only these. A component fires plenty more (`row-click`, `bar-click`) that are the
app's business, not the source's — a source that listened to everything would
turn every click into a reload.

The detail shapes the table reads are the components' own, already ratified. It
reads them; it does not ask components to send anything new. So adding an event
here is a decision about what steers a query, never about what a component
emits.

- Site: `src/core/ui/bind-source.ts`

### T-a-reach-banner-takes-no-room

345 phase 4.6 — Will: *"Unable to reach data warning/critical banner under the
app header (or at top of the content area actually)"*, and W1 A: it FLOATS over
the top of the content area and takes no room.

The outlet owns it: it is the content area's one block, and it hears the
provider's `reach-change` (`T-the-provider-says-the-pages-reach`), reading
`provider.reach` once at `start()`. Its template holds both callouts and their
words; a private state shows one — `reach-unreached` a WARNING ("The last data
is still shown, and may be out of date."), `reach-down` a CRITICAL with
`role="alert"` ("There is no data to show until it can be reached."). Why — by
the failure's kind — is a word in the markup (`T-a-word-is-in-the-markup`).

**Heard:** a live region shown and filled in one task is not announced, so the
warning is SAID by a hidden one, `.reach-say`, always in the tree and written
when the reach moves; the visible warning is a `note`. The critical one is an
alert. **Focus** on Retry or Dismiss, when the banner goes, lands on
`.reach-after` — the top of the content — never the page's start. **On top,
at 100:** over the page's own layers and the shell's fixed region (2), and
under the panels (101 and up). A Context is NO stacking context of its own
(Will, TODO 823): the outlet used to isolate each element of a Context
(`::slotted(*) { isolation: isolate }`), so on the Node Editor page a floating
Nodes card never came in front of the inspector beside it
(`T-a-pressed-panel-comes-to-the-front`). Measured, before the change, what
that isolation held, page by page and in each engine: the canvas's docked area
and banners (1), a card's loading bar (1), and the data grid's scroll edges
(5) and, in Firefox and WebKit, its sticky head (3) and cells (2), which would
have risen over the fixed region. The grid now keeps its own layers
(`T-a-grid-keeps-its-own-layers`); what is left meets the shell at 1.

**No room:** `.reach` is a sticky row of ZERO height at the top of the
scrolling content; its callout is absolute inside it. Shown or gone, nothing
moves — Chromium's layout-shift sum is 0 (`reforged-panel-mode-does-not-shift`
and Demos `reforged-reach-banner` hold it). It covers the top of the page (on
Records, the metric row) while shown: **Dismiss** hides it until the reach
moves; **Retry** is `provider.recheck()`. A card keeps its own error state
beside a critical banner; a stale answer gives a card no state at all.

- Site: `src/components/sherpa-outlet/sherpa-outlet.ts`
- Site: `src/components/sherpa-outlet/sherpa-outlet.html`
- Site: `src/components/sherpa-outlet/sherpa-outlet.css`
- Site: `test/e2e/reforged-outlet-layers.spec.ts`

### T-the-provider-says-the-pages-reach

345 phase 4.5. Each source knows its own `reach`
(`T-a-failed-read-keeps-the-last-set`); a PAGE needs one answer, so the provider
gives the WORST of its sources' — `down` over `unreached` over `ok` — with the
failure, as `provider.reach`, and fires `reach-change` when it moves.

- **Read from state**, after each source's `change` and `error`, never from the
  event alone. A source that has not answered yet says nothing, so a new page's
  source does not read `ok` before its first load: two opens over one store that
  cannot be reached say nothing between them. `close({ next: true })` keeps the
  reach for the next page; a page with no data (`prepare(null)`, a plain
  `close()`) clears it.
- **`recheck()`** tries every source that is not `ok`. The provider calls it on
  `online` and when the tab is shown again — a DOM event, so here and not in the
  data layer.
- A refusal (401) is not a reach failure: the store answered.

- Site: `test/unit/parity-sweep.test.mjs`
- Site: `src/components/sherpa-provider/sherpa-provider.ts`
- Site: `test/e2e/reforged-provider-reach.spec.ts`

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
- Site: `src/components/sherpa-outlet/outlet-nav.ts`

### T-one-way-to-build-an-element

**`document.createElement` plus `dataset`. That is the whole API.**

`render-element.ts` held two things that looked related and were not:

| | what it did | app callers |
|---|---|---|
| `applyState(el, state)` | configure a live element through its own methods and accessors | **1 — the live saved-view path** |
| `renderElement(node)` | build an element from a JSON node: `{ type, props, data, slots, children, state }` | **0** |

`applyState` is load-bearing: a View's `ui` and a page's kept `ui` are state
blocks, and `persist-view.ts` applies them — that is how a saved view restores a
grid's column filters. It moved to `apply-state.ts` and stays.

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
attribute write beside `bindSource` —
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
bound component shares (`T-populatable-declared-four-times`), and its draw
half, `BoundControl`, is the data layer's: `data-source-types.ts` declares it,
and the data layer imports nothing from `ui/`.

- Site: `src/core/ui/apply-state.ts`

### T-state-is-the-saved-view-half

`props` sets attributes and `data` sets the populate payload. Neither can express
what a component exposes as a METHOD or an accessor — a grid's column filters
(`setColumnFilter`), its selection (`select`), a chart's hidden series, a
transfer list's chosen values. That is the half a SAVED VIEW
needs, so `state` is the field that carries it.

A reader who filters a column and reloads should find it filtered; a preset
called "Overdue invoices" should arrive configured; an agent should be able to ask
for a view by describing it. All three are the same data.

```
{ type: 'sherpa-data-grid',
  data: { columns, rows },
  state: { setColumnFilter: ['name', ['name', 'contains', 'ana']] } }
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
- Site: `src/components.ts`

### T-populatable-declared-four-times

`Populatable` is `HTMLElement` plus `populate?` and `rendered?`, and the draw
members, declared once in the data layer's `BoundControl`. The optional members
are what lets a plain `HTMLElement` be passed where one is expected, and be
skipped rather than crash.

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
| `data-favourite` | the value, IN — observed, and the star's `data-when-*` paint it |
| `view-favorite` | the INTENT, out — a request, not a notification |
| `data-locked` | the host owns the list; the bar reports and never self-sets |

Unlocked, the bar still flips its own attribute, so a page with no favourites
list keeps working exactly as before.

- See also: `T-session-list-is-a-view-not-a-copy` — where the list itself lives
- Site: `src/components/sherpa-outlet/outlet-nav.ts`
- Site: `src/components/sherpa-app-header/sherpa-app-header.ts`

### T-a-scope-is-named-for-its-content

A filter panel's component scope is named after the CONTENT it filters —
"Customer records", not "This context".

A reader with two grids on one page has to know which one a section answers
for, and "this context" answers for neither. The caller passes the name
(`names: { data: 'Customer records' }`); the generic word is only the fallback.

The VIEW scope keeps its own name, because there is exactly one of it.

---
- Site: `src/components/sherpa-provider/provider-legends.ts`

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

**A bar steps back only where a column ANSWERS for its scope** (Will, TODO
436): a column covers the scopes its `data-scope` names, the legacy panel
every scope. An app that leaves the View out of its column (Demos' "Include
View Context in the panel", off) keeps the View a whole toolbar in panel mode.
A column over ONE scope says `data-column`, or it is a portrait bar; the
provider binds a column's scopes as a list, even of one, and steps every bar
again when a column joins — a changed `data-scope` asks again.

---
- Site: `src/components/sherpa-quick-filter-toolbar/sherpa-quick-filter-toolbar.ts`
- Site: `src/components/sherpa-quick-filter-toolbar/sherpa-quick-filter-toolbar.css`
- Site: `src/components/sherpa-quick-filter-toolbar/sherpa-quick-filter-toolbar.html`
- Site: `src/components/sherpa-provider/provider-mode.ts`
- Site: `src/components/sherpa-provider/sherpa-provider.ts`

### T-the-panel-is-desktop-only

**A panel area needs ROOM: the Context beside it keeps a tablet's width
(768px).** So the shell's body must hold 768 plus the area's min (464) —
1232px. Filtering goes back to the toolbars where it does not, which is what
they are for.

**The SHELL measures it, by its own body** — TODO 146, level 1. The panel used
to measure the WINDOW (`matchMedia`, 1280). A pinned nav takes 320px of the
window, so at 1280 the panel still showed and left the Context 496px. Now
`sherpa-app-shell` watches `.body` (a `ResizeObserver`), hides both areas
under `data-no-room`, and reports `panel-room-change`. The body is the panel-area
layout (`T-a-panel-area-is-a-layout`): the rule stays the SHELL's, so the shell
reads the area's min from it (`areaMin()`) and hands it `data-no-room`; the
canvas has no such rule, and its card never hides. The PROVIDER owns the
mode, so it shuts the panel (`hide('width')` — not a choice) and gives it back
when there is room and the reader still wants it. A panel with no shell
around it has no width rule: that is its host's to say.

While Settings is open the nav is wide, but the overlay covers the Context:
the shell ignores the room then, or leaving Settings would shut and reopen
the panel under it.

- Site: `src/components/sherpa-app-shell/sherpa-app-shell.ts`
- Site: `src/components/sherpa-provider/provider-mode.ts`
- Site: `src/components/sherpa-layout-panels/sherpa-layout-panels.ts`

### T-bind-locks-what-it-owns

`bindSource()` sets `data-locked` on the element, and `unbind()` removes it.

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

- Site: `src/core/ui/bind-source.ts`
- Site: `src/components/sherpa-data-grid/sherpa-data-grid.ts`
- Site: `src/components/sherpa-pagination/sherpa-pagination.ts`
- Site: `scripts/check-ownership.mjs`
- Site: `src/core/ui/sherpa-element.ts`
- Site: `src/components/sherpa-data-grid/grid-groups.ts`

### T-a-legend-toggle-is-a-filter

A legend row turned off by a DRAWING trick on one chart — hiding its slice —
leaves nothing else on the page knowing: the other charts, the metric tiles,
the grid and its pager all carry on counting the rows the reader has just said
to exclude.

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

- Site: `src/components/sherpa-provider/provider-legends.ts`
- Site: `src/components/sherpa-chart-legend/sherpa-chart-legend.ts`

### T-a-grid-from-a-chart-keeps-to-its-card

**A filter in a grid made from a chart stays in its card.** Will, TODO 621: *"scoped to
the local scope for the chart. Right now they're affecting the Customer Records data
grid toolbar and columns."* Steered, a heading's answer goes to the scope that holds its
field (one home), which is Customer Records. So the provider asks with `only`:
`ask({ scope: slot, field, reading, only })` keeps it in the Query, in the slot's scope,
and narrows that one grid. Its rows and its cells' on state come back from the source,
as any grid's do, and its sub-grids are told as ever (Will: *"all of the state, and
conditions, are coming from the data layer"*). The event stops at the grid. `only` names
one element, so when the grid is swapped away its readings go with it.

**Its rows are a table, not the records** (Will, TODOs 622, 625): a row a value of the
first axis, a column a Secondary value, and a Total, and a row opens on its records. Its
Group groups those records, in each opened row, and adds no column (Will, TODO 661). The
table is laid out (`crossTable`) from the very summary its page's own chart is asked —
the provider's `#spec` over that chart, kept aside, in its slot — so its numbers are the
chart's, a bucketed line's months too. A line's first axis is what it runs over, its
lines the columns. A gauge is one mean of one field, so nothing totals: it shows its
records, named by the first field the page declares (Records: Name), and that field.

- Site: `src/components/sherpa-provider/provider-show-as.ts`

### T-a-kind-is-registered-never-a-tag

**Show as knows no tag.** Will, TODO 548; plan 695 U4. Each component says what it is in
its `static presents`: the kind it draws (`bar`, `donut`, `pie`, `grid`, `gauge`, `line`),
the shapes of answer it can draw another kind's data from (`accepts`), the slots it fills
from the element it replaces (`slots`: a chart's legend) and its own attributes as that
kind (`is`: a radial chart is a donut or a pie by `data-type`). `define()` keeps every
class it registers, and `show-as.ts` reads the statics: who draws a kind (`presenter`),
what an element is (`presentsOf`), what a card offers (`offered`, in the Query's order of
`PRESENTATION_KINDS`) and what a made element keeps of the one it replaces (`kept`).

- **What it keeps is read from the two declarations**, never listed: the attributes BOTH
  declare (a chart's summary, a donut's centre label to a pie) and the ones NEITHER does —
  where it sat: its `id`, `slot`, `style`, `data-scope`, a layout's `data-grow`. A line's
  `data-type` is its own and stays behind; a grid's `data-column-filters` too. It takes them
  from its slot's own element while that is aside, so a third kind comes from the page's.
- **The gauge and the line are kinds like any other.** They accept nothing: only ever their
  page's own. A gauge is one number, so a card over one offers a grid, never a chart; the
  grid accepts `aggregate` and shows its rows.
- **A kind is offered only while its component is loaded.** The old map imported each
  chart on first show; now an app imports what it offers (the package does it all).
- **The core imports no component.** `npm run lint` holds `show-as.ts`, `show-as-menu.ts` and
  the data layer to it; a header that offers Show as imports the button and menu its
  markup holds.

- Site: `src/components/sherpa-provider/provider-show-as.ts`
- Site: `src/core/ui/show-as.ts`
- Site: `src/components.ts`
- Site: `test/e2e/reforged-provider-summary.spec.ts`

### T-a-swap-is-a-view-transition

**A slot's swap runs in `document.startViewTransition`** where the engine has it —
measured 2026-11-03 in Chromium 153, Firefox 155 and WebKit 26.6: each runs it (`ready`
resolves, five `::view-transition` animations, 258–404 ms) — and at once where it has
none, or where the reader asks for less motion: the
`prefers-reduced-motion` gate in `sherpa-motion.css` reaches no `::view-transition`
pseudo-element, which the document owns. Everything — the made element, its legend
moved, the page's own put aside, `replaceWith` — happens inside the update callback, so
the old snapshot is the old card, whole. A transition another one skips still runs its
update; only its `ready` rejects, and is caught. While it waits for its frame the element
is marked swapping, so a second ask in that frame does not make a second one; what takes
its place asks again and reads the newest presentation.

- Site: `src/components/sherpa-provider/provider-show-as.ts`
- Site: `test/e2e/reforged-provider-summary.spec.ts`

### T-a-card-toggles-its-own-toolbar

**A card's header toggles the filter toolbars of its slot.** Will, TODO 629. The header
asks, in `filter-toolbar-change`; the provider owns the answer, sets the bars' native
`hidden` and writes `data-filter-toolbar` back. It is kept in the page's document
(`toolbars`, by slot), as a slot's name means nothing on another page. Its bar stays bound while
hidden, so a filter it holds still applies.

Where the panel answers for its scope a bar has `data-panel-mode`, and a press could hide
the panel by accident: the toggle reads `panel`, shown and inactive (Will, TODO 672). With
no bar at all it reads `off` and goes, and so it does where its bars have nothing to draw —
no filter, nothing to arrange, no actions: a gauge's, its legend not chips (Will, TODO 696, A).
That is read from the slot's description (`drawsNothing`), so it is read again once a chart
binds and once its legend moves in or out of the bar. `ProviderMode` says when a bar steps.

- Site: `src/components/sherpa-provider/provider-cards.ts`
- Site: `test/e2e/reforged-provider-summary.spec.ts`

### T-a-context-has-a-fixed-region

**A Context can keep a row in view above its scroll area** (Will, TODO 484, B):
the shell's `context-header` slot is the FIRST thing in `.context-frame`,
sticky at its top with the shell's surface, so what scrolls passes UNDER it,
and its own edge shades it while the frame is scrolled. It replaced a sticky
metrics row inside the grid, which needed its own drop shadow.

**Inside the scroller, not above it — and an EMPTY outlet.** Above it, the
region filled as the markup arrived and pushed the scroller down 120px: a
layout shift, CLS 0.05 to 0.08 at 4x where it was 0.01. Chromium counts a box
that moves when it is a SCROLL box, or has ANY child box, even if nothing
paints — measured: an empty `overflow: auto` box moved 120px scored 0.15; an
empty plain box 0; the outlet with only its two hidden helpers (`.reach-say`,
`.reach-after`) 0.073. So the region is first in the scroller, which never
moves, and the outlet shows its helpers only once its first Context is drawn
(`:state(drawn)`). CLS 0.009 since.

**The outlet lifts it.** A slot only takes the shell's own children, and a
Context's markup is the outlet's. So after the markup goes in, each
`:scope > [slot="context-header"]` element moves up into the shell, and goes
when the next Context's markup replaces it, or the outlet leaves. A Context
module's `root` (the outlet) no longer holds it; the provider still answers it,
since it asks up the tree.

**Wrap its grid.** The region's element is a `sherpa-context` container like
the Context, so its grid steps by the same width — and a container never
queries itself, so a `sherpa-layout-grid` with the slot on it reads the
viewport. Put the slot on a plain `<div>` round it.

**One gap, not two.** The region's grid keeps its bottom padding, and the
Context's FIRST grid drops its top one while a region is there
(`sherpa-app-shell:has(> [slot="context-header"])`, in `tokens.css`).

- Site: `src/components/sherpa-app-shell/sherpa-app-shell.html`
- Site: `src/components/sherpa-app-shell/sherpa-app-shell.css`
- Site: `src/components/sherpa-outlet/sherpa-outlet.ts`
- Site: `src/components/sherpa-outlet/sherpa-outlet.css`
- Site: `scripts/project-tokens.mjs`
- Site: `test/e2e/reforged-outlet.spec.ts`
- Site: `test/e2e/reforged-app-shell.spec.ts`

### T-the-local-context-waits-for-the-view

**The column's Local Context stays unseen until its View has drawn** (TODO
439). A section draws its chips ~650ms after it is drawn at 4x CPU — one long
task for every chip and menu — so the View, at the top, grew 24 → 296px over
the scopes already showing under it: CLS 0.054 in panel mode. Each bar now
says `:state(populated)` once `populate()` draws, and the column hides the
rule, the "Local Context" label and its scopes (`visibility: hidden`, so
nothing is laid out again) while the View's bar has not: they appear at once,
drawn, and nothing moves. A page with no View scope has no View bar, so
nothing waits.

**A late bar is told alone.** The column's sections join one by one, and each
`joined()` drew that bar and then told EVERY bar its Add list and the saved
sets: ~6 times each as the column opened. `#offer(only)` tells only the bars
just drawn.

- Site: `src/components/sherpa-quick-filter-toolbar/sherpa-quick-filter-toolbar.css`
- Site: `src/components/sherpa-provider/provider-page.ts`

### T-every-close-reports-or-the-toolbars-stay-hidden

The panel area's column has **two ways to close**: the reader closes it,
or the window narrows past the panel's minimum and the width path closes
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

- Site: `src/components/sherpa-provider/provider-mode.ts`
- Site: `src/components/sherpa-quick-filter-toolbar/sherpa-quick-filter-toolbar.ts`

### T-navigating-sets-up-the-page

**Moving to a page sets up its filters and data — not only its template.**
TODO 92, audited 2026-09-27 (`PROVIDER-DESIGN.md` §10). Two things a page
used to leave behind:

- **A page with NO data shuts the panel** — `provide({ sources: {} })` closes
  it with reason `page`, which is not the reader's choice: the mode is kept,
  and the next page with filters opens the panel again. On Chat the panel had
  stayed open, showing the last page's filters, which did nothing there.
- **Every page with data keeps its Query**, under its own name in the keeper,
  on the View it was made on. The Dashboard passed no key or View to
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

**Only a bar a column ANSWERS gets one** (Will, TODO 488): a View the column
leaves out ("Include View Context in the panel" off) stays a toolbar, so its bar
switches nothing and carries no button; it follows the column's scopes as they
change.

- Site: `src/components/sherpa-provider/sherpa-provider.html`
- Site: `test/e2e/reforged-provider.spec.ts`
- Site: `test/e2e/reforged-quick-filter-toolbar.spec.ts`
- Site: `src/components/sherpa-provider/provider-mode.ts`

### T-the-filter-mode-is-set-before-the-page-paints

TODO 352 (Will, 2026-10-19). Demos Records opened in Panel mode had a CLS of
**0.55** at 4x CPU throttling, against 0.01 in Toolbar mode: the content area
was drawn full width, then the panel opened and pushed it 464 px aside.

The mode reached a panel or a bar only when it was ANSWERED — after its page's
source was open, which waits for the data. A component asks only once it has
drawn (after its icons load), which is after the first paint. So three things
now set the mode before the page paints:

- **A wanted panel opens before it asks.** `want('panel')` and `prepare()` open
  every panel in the provider's subtree (`found()`, read from the DOM by its
  `drawScopes`) while none has asked yet. The shell's panel area is there at the
  first paint; the panel takes the mode in full when it asks.
- **`provider.prepare(definition)`** — the outlet calls it after it has the
  Context's markup and definition (now fetched together) and BEFORE it draws
  the markup. A page with a `source` opens the panel the reader wants; one with
  none shuts it (`'page'`, not the reader's choice).
- **A bar or panel joins the mode as it ASKS**, not only when its data comes —
  a bar steps back with no source yet. It joins again when answered, so the
  next page with data opens the panel a page with none shut.

**`close({ next: true })` keeps the panel.** The outlet leaves a Context before
it loads the next; a plain `close()` shuts the panel (a page with no data), so
every navigation shut it and opened it again. With `next`, the next page's
`prepare()` decides.

Measured after (Playwright, Chromium, 4x, 1440 × 900): Panel 0.013, Toolbars
0.011. A Demos test holds both under 0.05.

- Site: `src/components/sherpa-provider/provider-mode.ts`
- Site: `src/components/sherpa-provider/sherpa-provider.ts`
- Site: `src/components/sherpa-outlet/sherpa-outlet.ts`
- Site: `test/e2e/reforged-provider-mode-before-paint.spec.ts`

### T-the-provider-owns-the-panel-mode

**TOOLBARS or PANEL is the provider's, for every page in its subtree.** TODO
91, 2026-09-27. Will: *"The app shell should be able to toggle between Filter
Toolbar and Filter Panel modes for any View that is showing in the content
area."*

The provider hears its OWN mode buttons (`T-the-mode-switch-is-the-pages-own`)
the panel's `filter-panel-close`, and the shell's `panel-room-change`. It opens or shuts every panel
that asked, and steps every bar that asked back (`data-panel-mode`) — a bar
on a page loaded later takes the mode when it asks. The choice is the
`filterMode` setting (`T-a-setting-is-declared-once`), and a reader's change is
said as one `setting-change` — a reader's only; a window too narrow is not a
choice, and the panel comes back when it is wide again.

A panel asks for `view data` on every page; a scope a page does not have —
nothing held, nothing to offer — is not drawn, so the Dashboard's panel shows
its View filters alone.

- Site: `src/components/sherpa-provider/sherpa-provider.ts`
- Site: `test/e2e/reforged-provider.spec.ts`
- Site: `src/components/sherpa-provider/provider-mode.ts`

### T-a-provider-keeps-the-views

**The provider keeps a page's Views: `provide({ sources, views, view, key })`.**
Provider P4, 2026-09-27. It puts the page's kept Query back
— only on the View it was made on — or else the URL's View (the FIRST View is
the page as it loads, so it is not applied again); it hears a View pick from
anything inside it, as the View chip reports one, and puts that View's Query
on; it draws a View's own content into the element marked
`data-view-content`, whose components ask like any other; and it keeps the
Query in the page's document once per frame, through its keeper
(`T-one-page-one-document`). `provide()` settles when the start Query
is on, so a page awaits it before its first load.

Before it, each Context wired `onViewPicked` itself with its own `applied`,
`into` and `after`, and Records kept and restored the Query by hand; the
Dashboard bound a View's content in an `after` hook. Now a View's JSON says it
all: its Query, its content, and its `ui` — a content grid's columns and key
are its CONFIGURATION (`T-configuration-is-not-data`), set through the View.

Three things to know. `onViewPicked` sets the View chip through the element
that REPORTED the pick — a host above it has no chips. The Views are over the
subtree's ONE Query: a subtree whose sources do not all share one gets none
(366). And the provider fires
`view-change` with the View's id, and its content's elements by id, for a
page that still wants them.

- Site: `src/components/sherpa-provider/sherpa-provider.ts`
- Site: `test/e2e/reforged-provider.spec.ts`
- Site: `src/components/sherpa-provider/provider-page.ts`

### T-a-bar-reports-its-holds

**Since TODO 415 (D2 A) the QUERY owns each scope's list.** A Sherpa bar with a
source ASKS for one change — `filter-add { scope, ids }` takes, `filter-remove
{ scope, id }` releases — and is drawn back by its source; it no longer edits
its own list first. The whole-list report below stays only for a HOST's own
bar, bound with no such request (and for headless tests).

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
- Site: `src/core/ui/bind-source.ts`

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
- **A component's OWN filter is `data-where`** — see
  `T-a-component-default-outlives-a-view`.

A new declaration asks again: the base class leaves and re-asks when a
`SUMMARY_PROPS` attribute, `data-source` or `data-scope` changes.

- Site: `src/components/sherpa-provider/sherpa-provider.ts`
- Site: `src/core/ui/sherpa-element.ts`
- Site: `test/e2e/reforged-provider-summary.spec.ts`

### T-a-component-asks-its-provider

**A component ASKS; the nearest `sherpa-provider` above it ANSWERS.** Will,
2026-09-27 (the Context Protocol, choice A; designed in FILTER-REVIEW §9–§12
on 2026-09-25 and never built until P1). Before it, nothing could reach the
data layer from a component — it is DOM-free, so it is not in the tree — and
every page wired every component by hand with `bindSource(source, el, { as, … })`.

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
- Site: `src/core/ui/bind-source.ts`
- Site: `src/core/ui/context.ts`
- Site: `src/core/ui/sherpa-element.ts`
- Site: `src/components.ts`
- Site: `test/e2e/reforged-provider.spec.ts`
- Site: `test/unit/headless-data-layer.test.mjs`
- Site: `src/components/sherpa-quick-filter-toolbar/sherpa-quick-filter-toolbar.ts`

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
- **A text heading offers conditions only where its field does.**
- **The menu reads and writes every body** through `reading` — a date's
  calendar too — so the grid's own calendar code, its dead Range switch
  handler and two templates are gone. Clear is `reading = {}`.
- **A value is shown by its NAME** (`AMER` reads "Americas"), as on the chip.

- Site: `src/components/sherpa-data-grid/sherpa-data-grid.ts`
- Site: `src/components/sherpa-provider/sherpa-provider.ts`
- Site: `src/core/ui/context.ts`
- Site: `test/e2e/reforged-data-grid.spec.ts`
- Site: `src/components/sherpa-data-grid/grid-filters.ts`

### T-a-control-sends-one-request

**A filter control sends ONE request per reader act, and paints only what it
is drawn.** 366. The request — a `QueryRequest` — names one field's answer, an
on or off, a Switch, a reset, or a list that is one change; `bindSource` asks
it of the Context's one door, `QueryContext.ask`. A control never sends its
WHOLE answer: that cleared every field a rebuilt control had not drawn yet.

Two things end every loop. A draw never goes through the door, so a draw
never becomes a request. And the Context drops a request whose answer is
already in force, so an echo dies in one round. A bound control's doors ask as
its reader would; unbound, they stay silent writes.

- Site: `src/core/ui/bind-source.ts`
- Site: `src/components/sherpa-quick-filter-toolbar/sherpa-quick-filter-toolbar.ts`

### T-a-setting-is-a-pointer

**A control that says `data-setting="/pointer"` is bound to that session
value** (TODO 191). `bindSettings(root, session, { signal })` draws each one
and writes its `change` back — a declared setting's through the provider's
`Settings`, so a page's own shows and stays the page's
(`T-a-setting-is-declared-once`), any other pointer straight from the session: a boolean is a switch's
`checked`, anything else is its `value`, and a value that was a number is kept
a number — Items per page writes `50`, not `"50"`. A session write from
anywhere redraws it. Sherpa Demos' Settings wired eight such controls by hand,
the same four lines each time.

The app calls it AFTER a page's `init()`, so a select is given its choices
first. A setting that is more than one value stays hand-wired: Drafts and
"Keep them across sessions", where the second means nothing without the first.
`check:usage` knows `data-setting` on any component, as it knows `data-scope`.
`data-setting-needs="/pointer"` says it depends on another setting: disabled until
that one is on, and it keeps its value (Will, TODO 606).

- Site: `src/core/ui/bind-settings.ts`
- Site: `scripts/check-usage.mjs`
- Site: `test/e2e/reforged-bind-settings.spec.ts`

### T-the-app-layer-is-opt-in

**A display component imports no app code** (TODO 221). The app layer — the
provider, the router, the session and `bindSettings`, a page's state and its
keeper, View files and markup, the app definition —
is `sherpa-ui/app` (`src/app.ts`). The display components and their base are
`sherpa-ui/components` (`src/components.ts`). `sherpa-ui` re-exports both and
the data layer (Will, A): one line on a CDN still gets everything.

Three things hold the line. `npm run lint` refuses an import of an app module
from `src/components/**` and `src/components.ts` — the provider and the router
are the app, so they are let through. `check:weight` lists the same modules
and fails any entry but the app's, the package's and the data layer's that
reaches one. A node test checks each entry holds its own half.

A component FEATURE stays a component: `dialog.prompt()` is a dialog's, for
any app, with or without the app layer.

- Site: `src/app.ts`
- Site: `src/components.ts`
- Site: `src/index.ts`
- Site: `scripts/check-weight.mjs`
- Site: `test/unit/the-package-surface.test.mjs`

### T-an-outlet-loads-the-context

**`<sherpa-outlet>` is where the route's Context is drawn** (TODO 194). Put it
in the app shell's content as `<sherpa-outlet id="context-root">` and call
`outlet.start({ app, base, session, stores, ready, panels })` once. On
every `route-change` that names another Context it:

1. tears the last one down — its teardown, its `ctx.signal`, the provider's page;
2. reports `context-change`, writes the header's title and icon from
   `app.json`, sets the shell's `data-no-header` from its `chrome`;
3. puts its template in its OWN light DOM — so `#context-root …` finds it —
   and reports `context-markup` with a `waitUntil`, for the app to size it
   before any data draws;
4. imports its module, opens its page definition on the provider, runs
   `init(root, ctx)`, binds every `data-setting`, picks the URL's View through
   the header's chip, and reports `context-load`.

A newer navigation abandons an older load at each step, and the router's
`waitUntil` makes the navigation wait for the load. The View chip owns the
View: a pick goes to the URL by `replace`. The outlet also sets the router's
`context` default from `app.json`.

**Settings open OVER the Context** (stage 2), which is never reloaded: given
`settings: { dialog, header, root }`, the outlet opens the page `?settings=`
names — its markup in `root`, the one Settings module, its settings bound —
and shows the dialog LAST, so focus can move inside. The back arrow and ESC
ask the router to close it. It reports `settings-open` at the start, so the
rail moves at once, and `settings-close`.

What stays the app's: its stores (a debug switch may swap one, so they are
asked for at each load), the session's defaults, kept card sizes and its own
experiments — each on an outlet event. The nav is the outlet's too:
`T-the-outlet-keeps-the-nav`.

- Site: `src/components/sherpa-outlet/sherpa-outlet.ts`
- Site: `src/components/sherpa-outlet/sherpa-outlet.html`
- Site: `src/app.ts`
- Site: `test/e2e/reforged-outlet.spec.ts`

### T-the-outlet-keeps-the-nav

**When its shell has a `sherpa-nav`, the outlet keeps it** (TODO 194, stage
3; `outlet-nav.ts`). It draws the rows from `app.json` — Home is the default
Context, then Recent and Favorites as Areas, then each section's Contexts, and
the Settings pages behind the settings button — BEFORE the first Context
loads, so a first click finds its rows. It lights the row of the route, a
View's own row when "Show full view hierarchy" (`navHierarchy`) is on. Its three
settings — `navHierarchy`, `navViews`, `navHover` — are read from the app's
`Settings`, as its provider tells them, so a schema's own default holds
(`T-a-setting-is-declared-once`).

**Recents and Favorites are the session's**: `/nav/recent` (five, newest
first; Home never) and `/nav/favorites`, which it persists with a shape
guard. Each is a VIEW, keyed `context:view`, the first View's by the Context
alone, and named after the View ("All customers", not "Records"). With
`navViews` off (TODO 399) both list each Context once, by its name, and the
★ stars the Context. A stored row whose Context the app no longer has (a
Settings page, from before Settings was an overlay) is dropped at boot. The ★ is
a request (`view-favorite`); the outlet toggles the favourite and writes
`data-favourite` back on the View chip's bar.

A re-draw keeps the open Areas — the nav's own state (TODO 116) — and opens
the one holding the page. The rail's pin is `/nav/pinned`; the settings button
is an INTENT to open or leave Settings; an Area's row names the header. An
app declares `nav: { pinned, favorites, recent, hierarchy, views, hover }` in its session's
defaults, and calls `outlet.refreshNav()` after it saves or deletes a View.

- Site: `src/components/sherpa-outlet/outlet-nav.ts`
- Site: `src/components/sherpa-outlet/sherpa-outlet.ts`
- Site: `test/e2e/reforged-outlet.spec.ts`

### T-a-pin-before-start-is-the-readers

**An app starts its outlet late, and its rail is drawn before** (TODO 775). Demos
calls `outlet.start()` after its own awaits — its first workflow saved, its stores
opened — and the rail has its Pin 25 ms to 200 ms before that, more under load. A
pin pressed in that gap reached no one: the outlet heard `nav-state-change` only
from `start()`. Then the first load drew the session's pin, `false`, over the
reader's, and the session never heard it. Measured in Chromium, a pin at 80 ms,
the outlet's first load at 106 ms writing `collapsed` and storing `false`. The
Context change and the reload after it read the session, so the pin was lost; two
clicks read `pinned`, as the load landed between them.

**So the outlet hears its rail from CONNECT**, as the router hears the URL
(`T-the-router-owns-the-url`). An outlet is in the page's markup, so it connects
when it is defined, before any rail can draw its Pin. Before `start()` it keeps
one thing, the pin: `pinned` sets it, and `collapsed` clears it only once it was
set. A pointer passing a rail never pinned reports `hover`, then `collapsed`; that
is not an unpin, and must not clear a stored pin. `start()` hands it to the nav,
which writes `/nav/pinned` before the first load reads it. After `start()`, the
nav hears the rail itself.

**What it does not cover.** A rail added after its outlet connects is heard from
`start()` only. A pin pressed and a page reloaded BEFORE `start()` is lost: the
outlet has no session to write to yet. And the stored pin is drawn at the first
load, not the first paint, so a test reads the rail after `context-load`.

- Site: `src/components/sherpa-outlet/sherpa-outlet.ts`
- Site: `src/components/sherpa-outlet/outlet-nav.ts`
- Site: `test/e2e/reforged-outlet.spec.ts`

### T-a-rail-may-stay-shut

**With "Expand navigation on hover" off, the rail opens only to its Pin** (Will,
TODO 600). `/nav/hover: false` in the session; the outlet writes `data-no-hover`
on the nav, so a nav built by hand takes the attribute alone. Neither a pointer
nor focus opens it, and a pointer leaving shuts nothing.

**Settings and Pin stay at the foot in EVERY state, and are one pair of buttons,
moved by CSS** (Will: pinned, they do not jump back to the header). With hover
off, `.header` and `.brand` are `display: contents`, so each part is a cell of the
rail's own grid, and `.actions` has the row above the foot. A second pair at the
foot would be two controls for one state. Tab still meets them first: a grid area
moves the box, never the focus order. Open, they are a row at the bottom right.
Shut, the rail is one row wide, so they are a column: `data-group` goes
`vertical-start` and `vertical-end`, written by `#applyState`.

**A row with no children says its name in a tip**: the shared tip, in the row's
own root, shown by the inherited `--_row-tip` the rail sets
(`T-a-tip-lives-in-the-top-layer`). A row hides it otherwise.

**A row with children lists them in a `sherpa-menu` to its right**
(`data-placement="right"`), headed by its name, with the current one marked. Those
are the rows the hierarchy gives a Context, AND Recent and Favorites, whatever the
hierarchy says: an Area in a shut rail can reach its children no other way. The
nav knows only that a row has children.

- It opens after 120 ms at rest, or a pointer crossing a row on its way to the
  menu would swap it. It shuts 200 ms after the pointer is off both.
- A press opens it too, as a thumb and a keyboard have no hover. The press stops
  in capture, so the Area's open or shut is left for the open rail. A keyboard's
  press carries `detail: 0`: focus goes into the menu, and comes back on close.
- A pick PRESSES the real row (`item.press()`), hidden as it is. One route: the
  row's href, `item-select`, `nav-select` and the lit row.

**A shut rail hides child rows, so the top row lights for one.** With the
hierarchy on, `data-current-id` names a View's row, and nothing would show where
the reader is.

**The search icon opens the rail** to type in, in `hover`, and focus leaving shuts
it: it is the one row with no menu and no name to give. Leaving Settings goes to
`collapsed`, not `hover`. The Figma Navigation set has no frame for this foot.

- Site: `src/components/sherpa-nav/sherpa-nav.ts`
- Site: `src/components/sherpa-nav/sherpa-nav.html`
- Site: `src/components/sherpa-nav/sherpa-nav.css`
- Site: `src/components/sherpa-nav-item/sherpa-nav-item.html`
- Site: `src/components/sherpa-nav-item/sherpa-nav-item.css`
- Site: `src/components/sherpa-outlet/outlet-nav.ts`
- Site: `test/e2e/reforged-nav.spec.ts`

### T-the-highlight-reaches-the-whole-page

**The highlight lights the whole page, whatever scope its filter is in** — Will,
TODO 458: a reader sees a local filter's matches across the View without moving
the filter. One source already gives its ONE test to every component it binds.
A page with SEVERAL sources compiles only its own scopes (`facts.mine`), so
`compile` reads the driver BEFORE it skips another source's scope — where this
source has the field (`facts.has`); one without it marks nothing.

**Or only within the filter's scope** — TODO 467, the app's setting,
`highlightAcross` on the provider. It is OFF by default since TODO 520 (Will:
*"Match highlighting should only apply to content in the same scope as the
filter."*), so the whole page lights only when an app turns it on. Off, a
component outside the driver's scope is given no test, and flipping the setting
draws again only what changed. A View driver is every scope's, on or off. A
CHART's own scope (its legend's part) is in a scope of its own, while the chart
is bound in the page's: so the part reaches the one component it narrows
(`partFacts(scope).only`), or the chart is never lit (Will, TODO 529).

**Who it reaches is the PROVIDER's** since TODO 655 (`#lit`): the hover is the
page's, and the data layer is only asked what it matches, once per source.

- Site: `src/components/sherpa-provider/provider-highlight.ts`
- Site: `test/unit/a-hovered-chip-previews-the-highlight.test.mjs`

### T-a-grid-is-never-wired-by-hand

Will, TODO 388: *"We should always use the provider. Never hand wire a data
grid. Throw a console warning/log if a consumer of sherpa tries to hand wire a
grid without a provider."*

A grid joined by a hand `bindSource(source, grid)` shows rows, but nothing
keeps its Query, its Views or its draft over a reload; the provider does. So
`bindSource()` reports `grid-without-provider` (a `console.warn` unless the
app routes reports) for a `sherpa-data-grid` bound with no `deliver`. Every
provider bind passes `deliver` — the callback the component asked with — so
that is how a hand bind is told from the provider's. A plain object standing
in for a grid in a node test has no `localName`, and is not reported.

Sherpa does NOT re-route a hand-wired grid through a provider. Two rules stop
it: the binder is DOM-free and names no component, and no display component
imports the app layer (TRAP `T-the-app-layer-is-opt-in`), so a grid cannot
make a provider for itself. The report names the one-line fix instead.

- Site: `src/core/ui/bind-source.ts`
- Site: `test/unit/a-grid-is-never-wired-by-hand.test.mjs`

### T-a-nested-control-steers-through-its-own-binding

**A control bound INSIDE another bound control is heard by its own binding
only.** The panel is a column bar that holds a bar per scope, each in its shadow
root and each bound to the source on its own. An event leaves a part and stops
at its host (`T-an-inner-event-stops-at-its-host`) — but that host's OWN
binding listens there, so every section bar's `quick-filter-change`,
`filter-add`, `sort-change` reached the column's binding too: a request with no
scope logged `bar-without-scope` on every press, and one that named its scope
was asked twice — two commits, two loads, two redraws (found in TODO 512, Will:
*"crossed wires … duplicate or legacy implementations"*). `bindSource` keeps the
controls it binds to steer, and a binding skips an event whose ORIGIN
(`composedPath()[0]`) is another of them.

- Site: `src/core/ui/bind-source.ts`
- Site: `test/e2e/reforged-nested-binding.spec.ts`
