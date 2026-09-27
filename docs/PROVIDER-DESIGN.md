# The provider — a component ASKS, the data layer ANSWERS

2026-09-27. Approved by Will (§8). **P1 is built** (`ffc48935`); §9 is the
centralisation audit, for Will's review before any of it is done.

Will: *"Why can't any component ask for data, a definition, a conditional
query definition or a template from the data layer? … Is there a case for
being able to send these out to the relevant data layer components?"* — and,
choosing the Context Protocol: *"The provider component is something I thought
we already had. I hope this can bring drastic simplification to the codebase,
too!"*

**It was designed, never built.** `FILTER-REVIEW.md` §9.2, §10, §12 and §19
(2026-09-25) chose all of it: the Context Protocol, a source PROVIDED over a
subtree, `data-source` optional, a component DECLARING what it needs, and
aggregation folded into the data layer. None of it exists in `src/`. This
document is that design, brought up to date with the Query (`QUERY-DESIGN.md`)
and Will's three questions, and turned into build steps.

---

## 1. Why — the page does the data layer's job

Today a component cannot ask for anything. The data layer is DOM-free (it runs
in Node), so it is not in the page tree, and nothing can reach it from a
component. So **the page wires every component by hand**:

| Context | lines of code (comments out) | hand binds | event listeners |
|---|---:|---:|---:|
| `records.js` | 853 | 9 | 33 |
| `dashboard.js` | 222 | 6 | 6 |

Roughly, by job, in `records.js` (estimates from reading it):

| job | ~lines | after the provider |
|---|---:|---|
| filter PANEL glue — fill, refill, open, close, panel mode, routing its events to bars | 230 | **gone** — the panel asks for its scopes |
| filter wiring — bar binds, header answers, raise/lower, `syncScopes`, heading → chip | 150 | **gone** — bars and headings ask for their scope |
| charts and tiles — `as` adapters, `countBy`, `seriesBy`, money | 110 | **gone** — each declares what it needs (step 8) |
| views and session persistence | 60 | **gone** — the provider holds the View library and the session Query |
| field definitions — chip defs, number/text facts, Add lists | 180 | **mostly declarations** — a scope's fields, in JSON |
| CRUD — row actions, dialog, toast, delete | 250 | stays — it is the page's own business |

**Target: `records.js` from 853 lines of code to about 250, `dashboard.js`
from 222 to about 50.** And the components stop carrying the options that
exist only because a page wires them (`bind()`'s seven — FILTER-REVIEW §11.1).

---

## 2. The rules

1. **A component ASKS; the nearest provider over its subtree ANSWERS.** A
   `context-request` event — composed, so it crosses shadow roots upward — with
   a key, a callback and `subscribe`. The Context Protocol (W3C Web Components
   Community Group; Lit ships it as `@lit/context`). Will, 2026-09-27: **A**.
2. **`subscribe: true` means "keep telling me".** The provider pushes each
   change to what asked — only what it asked for (FILTER-REVIEW §9.3).
3. **Containment comes from the TREE.** A component reaches what its subtree
   provides, never wider. `data-source` names one only when a subtree offers
   two; a name the subtree does not offer is a loud error (decided 2026-09-25).
4. **Both a declaration and a definition — one owner.** A component's
   ATTRIBUTES are its defaults (`data-field="status" data-aggregate="count"`);
   a View's JSON may change them. When the component joins, its defaults
   become its scope in the Query, and from then on the Query owns them.
   Will, 2026-09-27: *"Why not support both?"*
5. **No component talks to another.** A control reports INTENT as the events
   it fires today; the provider hears them (it is an ancestor) and routes them.
6. **Definitions are JSON** (`T-a-view-is-json`). A format is the platform's
   own options object (`Intl.NumberFormatOptions`), never our language
   (QUERY-DESIGN §4, "Step 8 uses the platform").

---

## 3. The provider

One element, a real subtree with a real name (FILTER-REVIEW §12: *"never an
implicit wrapper"*):

```html
<sherpa-provider data-sources="records">
  <sherpa-quick-filter-toolbar data-scope="data"></sherpa-quick-filter-toolbar>
  <sherpa-data-grid data-scope="data"></sherpa-data-grid>
  <sherpa-metric data-field="spend" data-aggregate="sum"
                 data-format='{"style":"currency","currency":"USD","maximumFractionDigits":0}'></sherpa-metric>
  <sherpa-barchart data-segment-field="status" data-aggregate="count"></sherpa-barchart>
</sherpa-provider>
```

The page gives it its sources and libraries once, in JS or JSON:

```js
provider.provide({
  sources: { records: source },          // one or more DataSources
  views: RECORDS_VIEWS,                  // the View library — JSON
  session,                               // where the Query is kept
});
```

It is thin: a DOM adapter over the DOM-free data layer. It holds no data of
its own. Providers NEST — an inner subtree answers what it provides, and a key
it does not provide keeps travelling up.

---

## 4. What a component can ask for

Six keys. Each answer is pushed again on change when `subscribe` is set.

| key | a component asks for | who asks | answered from |
|---|---|---|---|
| `data` | its data, in the shape it declared — rows, an aggregate, a series, a field's values with counts, or the view state (FILTER-REVIEW §9.5) | grid, list, metric, chart, legend, pager | the source |
| `scope` | its slice of the Query — what it holds, each answer, presets, what is pending | toolbar, panel, grid heading, legend | the Query |
| `query` | one field's reading as JSON — the sub-query behind a condition (TODO 74) | a menu, a chip, the panel | the Query |
| `definition` | a View definition by id, or the list of Views | the View chip, the nav, Save | the View library |
| `template` | a template by name | any component, later | the Templater (TODO 68) |
| `source` | the DataSource itself — an escape hatch for a page's own code | page code only | the provider |

The shapes of `data` are a small closed set, not a language:

| shape | declared by | e.g. |
|---|---|---|
| rows | nothing extra — the default | grid, list |
| aggregate | `data-field` + `data-aggregate` | metric, gauge, progress bar |
| series | `data-segment-field` (+ `data-aggregate`, `data-field`) | bar, donut, line, sparkline |
| field values | `data-field` on a legend or a menu | legend, filter menu |
| view state | nothing — a pager reads only the state | pagination |

---

## 5. Sending out — Will's third question

Yes, in three directions:

- **DOWN, to what asked.** `subscribe` makes a request a live line: the
  provider pushes each change, as the source already pushes rows and answers
  to bound controls today — but only to what asked, for what it asked.
- **OUT of the app.** Because a View and a Query are JSON, the same object
  goes to a remote store (run on the server), to an MCP or WebMCP tool, or to
  another service. `provider.export()` / `provider.import(json)` are the doors.
  This is the base the agentic work (TODO 76) stands on.
- **INSIDE the data layer.** The provider ROUTES by key: `data`, `scope` and
  `query` to the source, `definition` to the View library, `template` to the
  Templater. A component never knows which part answered.

---

## 6. What goes

| goes | why |
|---|---|
| `source.bind(el, { as, rows, scope, readonly, steerOnly, ignore, into })` in every page | a component asks; its declaration says which shape and scope |
| every chart and tile `as` adapter; `money()`; `overMonths()` | declarations + `Intl` formats (step 8 folds in here) |
| `fillPanel`, `refill`, `barFor`, panel mode wiring, `asPanelField` | the panel asks for its scopes and draws them |
| `syncScopes`, `viewFields`, `headerField`, the header answer listener | a bar asks for its scope and registers its holds by asking |
| `showChip`, the raise and lower handlers | a bar and a heading are views of one scope; add and move are requests |
| `onViewPicked` wiring, the session save and restore | the provider holds the View library and the session Query |
| `records.js` 853 → ~250, `dashboard.js` 222 → ~50 | the page keeps what only it knows: its CRUD and its own business |

**Stays:** the DataSource, the Query, `compile`, `bind()` as the explicit
door for page code and tests, every component's events, the JSON Views.

---

## 7. Building it — one step per commit, each deleting what it replaces

| step | builds | deletes | proves |
|---|---|---|---|
| P1 ✅ | `sherpa-provider`, `ContextRequestEvent`, the `source` key; a component that asks joins the source as `bind()` joins it. **Built `ffc48935`**: the grid asks for rows, the pager for state; Records drops their binds | — | `test/e2e/reforged-provider.spec.ts`, all three engines |
| P2 ✅ | the summary shapes — `aggregate`, `segments`, `series` — declared by attributes (`SUMMARY_PROPS`) and answered by `summarise()`; a child reads the nearest declaration above it; a legend picks for its chart; `data-format` is `Intl.NumberFormatOptions` | Records' and the Dashboard's tile, chart and legend adapters, `money`, `overMonths`, `bindLegend`, the line legend's hide — pages −168 lines | `reforged-provider-summary.spec.ts`; `aggregate.test.mjs` |
| P3 | the `scope` and `query` keys: bars, panel, grid headings and legends ask | `syncScopes`, the header listener, panel fill and routing, `showChip`, raise/lower glue | the Records filter suite |
| P4 ✅ | `provide({ views, view, session, key })`: the provider restores the kept Query on its own View, hears a View pick, draws a View's content into `data-view-content`, and keeps the Query; a View's `ui` configures its content | `onViewPicked` wiring, Records' session keep and restore, the Dashboard's content binds — Records −37 lines, the Dashboard −55 | `reforged-provider.spec.ts`, the view tests |
| P5 ✅ | `export` / `import` — each source's question (its applied Query, arrangement and saved filters) and the View on screen, out and in as JSON; the source half is DOM-free | — | a round trip through JSON gives the same rows — `headless-data-layer.test.mjs`, `reforged-provider.spec.ts` |
| later | `template` (with 68), WebMCP (76) | — | — |

**P3, in five commits** — each deletes its glue from `records.js`, and the
Records filter suite proves it:

| step | the source learns | the page loses |
|---|---|---|
| P3a ✅ | each field's FILTER definition (`declareField` facts → `filterDef`), each scope's name, and what a scope may still add | `fieldDef`, `addable`, `SCOPE_LABELS` |
| P3b ✅ | the bars ASK for their scope (`data-scope` in markup); a bar's report and its add and remove carry its holds; a raised answer is drawn where it lives; a bar below is told what the View holds | the header listener, `syncScopes`, `viewFields`, `headerField`, the raise and lower glue — Records −135 lines, the Dashboard −13 |
| P3c ✅ | the panel ASKS for its scopes (`data-scope="view data"`); `describe(scope)` draws each whole; the source hears its answers, Add, Remove, Apply and Discard, and draws that scope's bar; panel mode hides a bar's chips in CSS | `fillPanel`, `refill`, `asPanelField`, `syncPanelled`, the panel's event routing — Records −176 lines; TODO 87 and 88 done |
| P3d ✅ | a heading's answer is a steering event, and a new field gets its normal chip; every grid below the View is told what it holds | `showChip`, `syncHeadings`, the heading listener — Records −35 lines |
| P3e ✅ | a component's own filter is `data-readings` — a DEFAULT scope narrowing it alone, put back under any View that does not name it | the Dashboard's Critical tile bind |

The size gate shows each step's deletions.

**Left on purpose.** The Records gauge shows risk (`100 − mean(health)`), a bespoke
summary a page binds by hand, which stays. Saving a View still names it in the
page's own dialog.

---

## 8. Decisions — Will, 2026-09-27

| # | question | answer |
|---|---|---|
| 1 | the provider's name | **A** — `sherpa-provider` |
| 2 | how a control's request travels back | **A** — as the events it fires today; the provider routes them |
| 3 | the name for the part of the page a provider wraps | **subtree** — the element and everything under it. Never "region": that is a field in the example data |
| 4 | a component inside another (a pager in a grid, a legend in a chart) | the provider reads `data-source`, `data-scope` and a summary declaration from the NEAREST element above it, like CSS inheritance. Recommended (A) and built in P2; Will may still pick B, the parent answering for its children |

And a standing ask: *"Look for opportunities to refactor code to be simpler,
and leaner, with this improvement. I suspect that a lot of sherpa-elements
code, as well as bespoke scenario code in other components, can start to be
centralised and standardised resulting in lighter weight components all
around."* — §9.

The questions as asked:

**1. The provider's name.**
- **A — `sherpa-provider`** — says its job, and nothing about data only, since
  it also answers for Views and templates. *(Recommended.)*
- **B — `sherpa-data`** — shorter; reads as data only.

**2. How a control's REQUEST travels back.**
- **A — as the events it fires today** (`quick-filter-change`,
  `column-filter-change`, `legend-item-click`…); the provider listens as an
  ancestor and routes them. No component changes its events. *(Recommended.)*
- **B — a method on the answer** (`scope.select(field, reading)`) handed to
  the component. More direct, but every component gains a data-layer API and
  stops being agnostic (TODO 37).

---

## 9. What centralises — the audit, for review

Measured at `9628b64b`, before P1. Nothing here is built. Will, 2026-09-27:
*"Do the assessment first, for review, before executing these changes."* The
full audit of every component's functions and events is TODO 86, after P5;
this is its first pass.

**Where the code is.** Component TS is 15,052 lines. The filter family —
toolbar 2057, grid 2041, menu 1474, panel 1362, quick-filter 795 — is 7,729
of them, 51%. Nearly all the savings are there.

| # | duplicated or bespoke | ~lines out | moves to | needs |
|---|---|---:|---|---|
| 1 ◐ | **Toolbar done** (`f45f4f10`, −125): `held`, `offering`, `clauses`, `pickedValues`, `setClause` gone; `states`, `heldIds`, `setChipActive` private. The GRID's `ColumnFilter` moves with item 7 — its event's old fields and 40 test sites spell that shape. Was: filter state read back and written in, three times — toolbar (`values`, `setChip*`, `drawReading`, `supersede`, `clauses`, `states`, `presets`, `held`…), grid (`supersedeColumns`, `columnClause`/`Reading`/`Label`, `setColumnFilter`), panel (`readings`, `setFieldReading`) | 450–550 | the Query, through the `scope` key: one `drawScope(slice)` each, intent out. "Superseded" is derived by the Query | P3; parity gate accepts "the Query is the door" |
| 2 → | **Moves into TODO 89 and 90**, which change how the panel draws a field (Simple and Advanced). Was: the panel is a second field-row builder (393 lines against the toolbar's 281; TODO 38 step 4) | 300–600 (a guess) | the panel = scope sections, each a vertical toolbar that asks for its scope | P3 |
| 3 ◐ | **Queues done** (`819cacdc`, −45): `clone()` imports its copy, so a component upgrades at once, and the three menu queues are gone. The read-before-stamped rechecks stay until answers are read from the Query, not the DOM. Was: workarounds for a menu that fills late: three pending-item queues, `#keepAnswer`, condition rechecks, ~9 double-rAF sites | ~250 | the menu ASKS for its field values when it connects, so nothing pushes into an element not yet upgraded | P2 (field-values shape). Goes against FILTER-REVIEW §11.5, written before a component could ask |
| 4 | The grid builds its filter menu by hand (~15 attributes) instead of `menuFor()`, and computes its own values (`data-column-values`) | ~140 | `menuFor(colDef, {bounds})`; values from `source.selection(field)` | half now, half P2 |
| 5 | The grid's `ColumnFilter` is a fourth spelling of `FieldReading`, with its own face | ~120 | hold a `FieldReading`; draw with `filterFace` | now — no provider needed |
| 6 | Chart and tile adapters: `bindLegend` copied in both pages, `tile()`, `money`, `overMonths`, metric `deriveValue` | ~250 | the `data` key's aggregate, series and field-values shapes | P2 |
| 7 | Filter events carry four shapes (`active`, `values`, `picked`, `clauses`), and the source ignores them and reads the bar back by duck typing | ~60 | the event carries `{readings, presets}` — a JSON delta of the Query | P3; P5 and WebMCP need it too |
| 8 | The base class does jobs few components need: the templater (~157), item stamping (~173, 2–6 users), `markNeedle` (~42, 2 users), vocabularies (~56) | ~430 moved, ~10 deleted | `sherpa-templater` (TODO 68), a stamping module, a marking module | separation, NOT deletion — lighter base, same total |
| 9 ✅ | **Done** — `static config` in the base class; the grid lost its setters (`T-configuration-is-not-data`). Was: config and data split by hand: P1 gave the grid `columns`/`key`/`actions` setters and a `#config()` merge. Menu, toolbar, panel, list and charts will each need it | stops ~40 × N | `static config = {…}` in the base class; `populate` merges data over it | now, before it is copied |
| 10 | The wrapped native control, four times: checkbox, radio, switch, input-text each mirror the control, `checked`/`value`, `checkValidity`, `focus`, the `change` re-emit. Only input-text uses `ElementInternals` — the other three submit nothing in a `<form>` | ~90, and form support | `static control = '.control'` in the base class | keep the radio untick (`T-radios-in-shadow-roots`) |
| 11 | Hand-rolled formats (TODO 84): `formatTick` compact notation, toolbar `#syncDateLabel`, calendar's English `MONTHS`, metric `toFixed`, file-upload MB, `filterFace` plurals | ~100 | `Intl.NumberFormat`, `DateTimeFormat.formatRange`, `PluralRules`, `ListFormat` | P2; strings differ by engine — tests compare them |
| 12 | Chart axes and hidden series: bar and line `#renderYAxis` near-identical; hidden series under three names, now used only by tests | ~50 | a shared `renderValueAxis()`; one `hidden` door | now |
| 13 ✅ | **Done** for metric, input-text and file-upload; calendar-cell and notifications keep theirs (a slot guard, a cloned node). Was: text synced by hand that could be declared: metric, input-text, file-upload, calendar-cell, notifications | ~35 | `static props`, `kind: 'content'` | now, low risk |
| 14 | The app-header re-exposes the toolbar's API (`values`, `available`, forwarding) | ~55 | the slotted bar asks for its own scope | P3 |
| 15 | Leftovers: 18 `Array.isArray` guards, 4 value normalisers, the panel's copy of `pathFind`, legacy shims | ~70 | base defaults; delete the shims | now |

**Total: about 1,500 ± 500 lines out of `src/`** — on top of the ~770 §1
counts in `records.js` and `dashboard.js`. Items 1, 2 and 3 are the biggest,
and all three need P3.

### Looks shared, but is NOT

- **Keyboard and focus.** Arrow keys in tabs and nav only; the five `keydown`
  listeners each do a different job.
- **Event names.** `emit()` is already central, and each component's event
  name is what the provider routes by (§8, decision 2). One generic event
  would hide the intent.
- **Popover placement.** Menu flips and caps height; tooltip centres above.
  Sharing saves ~15 lines; CSS anchoring is blocked (`T-anchor-cross-root`).
- **Selection models.** Grid keys, transfer-list staging, menu values and a
  radio group mean different things.
- **The grid's own sort and filter** (~40 lines) serve a grid with no source.
  They go only if "no provider means empty" is ruled for the grid.
- **`DATA_PROPS` attributes** stay attributes: CSS reads them.

---

## 10. Navigating sets up the page — the audit (TODO 92)

Will, 2026-09-27: *"When the app shell navigates to new content we shouldn't
only be swapping the content area content/templates. We need to be getting and
setting the definitions, data layer etc. to ensure all the correct filters are
available, shown, and in the correct state."* Audited the same day.

**Who sets up a page today:**

| step | who |
|---|---|
| fetch the template, put it in the content area | the router (`index.html`) |
| the header's title and icon | the router, from the nav row |
| the header's chips and its View list | each Context — `header.populate(globalFilters(viewOptions(views), …))` |
| the source; its fields, values, scope names, first holds, presets | each Context |
| sources, Views, the kept Query, the start View | the provider — each Context calls `provide()` |
| every component's data | the component asks |
| toolbars or panel | the provider; the app keeps the choice (91) |
| teardown | each Context's cleanup — `provide({ sources: {} })` |

**The gaps, and what happened to each:**

| gap | status |
|---|---|
| G1 — on a page with no data (Chat) the panel stayed open with the last page's filters | **fixed** — no sources shuts the panel with reason `page`, not the reader's choice; the next page with filters opens it again |
| G2 — the Dashboard lost its filters on a trip away and back; it never passed the session, a key, or the URL's View to `provide()` | **fixed** — it does, under `/filters/dashboard` |
| G3 — Save view works on the Dashboard only; Records' Save does nothing | open — TODO 15 |
| G4 — every Context repeats the same setup: a source, its declarations, the header's chips, `provide()`, the teardown — and anything one forgets is a gap (G2 was one) | open — the **Context definition**: one JSON (its store, fields, scopes, Views, header chips, template) the router hands the provider, which sets up the page with no page code. With 70 (a view definition renders the page) and 68 (the Templater) |

