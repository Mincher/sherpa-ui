# The provider — a component ASKS, the data layer ANSWERS

For Will's review before anything is built. 2026-09-27.

Will: *"Why can't any component ask for data, a definition, a conditional
query definition or a template from the data layer? … Is there a case for
being able to send these out to the relevant data layer components?"* — and,
choosing the Context Protocol: *"The provider component is something I thought
we already had. I hope this can bring drastic simplification to the codebase,
too!"*

**It was designed, never built.** `FILTER-REVIEW.md` §9.2, §10, §12 and §19
(2026-09-25) chose all of it: the Context Protocol, a source PROVIDED over a
region, `data-source` optional, a component DECLARING what it needs, and
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

1. **A component ASKS; the nearest provider over its region ANSWERS.** A
   `context-request` event — composed, so it crosses shadow roots upward — with
   a key, a callback and `subscribe`. The Context Protocol (W3C Web Components
   Community Group; Lit ships it as `@lit/context`). Will, 2026-09-27: **A**.
2. **`subscribe: true` means "keep telling me".** The provider pushes each
   change to what asked — only what it asked for (FILTER-REVIEW §9.3).
3. **Containment comes from the TREE.** A component reaches what its region
   provides, never wider. `data-source` names one only when a region offers
   two; a name the region does not offer is a loud error (decided 2026-09-25).
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

One element, a real region with a real name (FILTER-REVIEW §12: *"never an
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
its own. Providers NEST — an inner region answers what it provides, and a key
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
| P1 | `sherpa-provider`, `ContextRequestEvent`, the `source` key; a component that asks joins the source as `bind()` joins it | — | a grid inside a provider fills with no bind; one outside draws its empty state; two sources unnamed is a loud error |
| P2 | the `data` key and its five shapes; step 8 of the Query: aggregate and segment in a component scope, `Intl` formats | the charts' and tiles' `as` adapters, `money`, `overMonths`, their binds | the chart and metric tests, with no adapter |
| P3 | the `scope` and `query` keys: bars, panel, grid headings and legends ask | `syncScopes`, the header listener, panel fill and routing, `showChip`, raise/lower glue | the Records filter suite |
| P4 | the `definition` key: the View chip asks; the provider applies, saves and keeps the session Query | `onViewPicked` wiring and session code in each Context | the view tests |
| P5 | `export` / `import` — the Query and Views out and in, as JSON | — | a round trip through JSON gives the same rows |
| later | `template` (with 68), WebMCP (76) | — | — |

The size gate shows each step's deletions.

---

## 8. Decisions for Will

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
