# The page definition — one JSON sets up a page

Designed 2026-09-28; Will's two decisions 2026-09-29 (§3, §7). TODO 92, gap
G4 (`PROVIDER-DESIGN.md` §10).

Will: *"When the app shell navigates to new content we shouldn't only be
swapping the content area content/templates. We need to be getting and
setting the definitions, data layer etc. to ensure all the correct filters are
available, shown, and in the correct state."*

---

## 1. Why

Every Context repeats the same setup by hand: make a source, declare its
fields, values and scopes, give each bar its first chips, fill the header,
give the provider its sources, Views and session, and take it all down again.
A Context that forgets a step is a gap — the Dashboard never passed its
session, so its filters were lost on a trip away and back (G2).

| Context | lines | setup a definition replaces | its own business |
|---|---:|---:|---|
| `records.js` | 600 | ~330 | add, edit and delete a customer; the save dialogs; the risk gauge |
| `dashboard.js` | 182 | ~120 | the save-view dialog |

---

## 2. What a page definition is

One JSON document per page. The same rule as a View: **a definition is data**
(`T-a-view-is-json`), so a service or an agent can read and write it.

```json
{
  "v": 1,
  "id": "records",
  "source": {
    "store": "customers",
    "pageSize": 25,
    "search": ["name", "email", "owner"],
    "fields": {
      "status": { "label": "Status", "select": "multiple" },
      "owner":  { "label": "Owner", "select": "multiple", "advanced": true },
      "email":  { "label": "Email", "advanced": "only", "op": "contains" },
      "seats":  { "label": "Seats", "type": "number" },
      "created": { "label": "Date", "type": "date" }
    },
    "scopes": {
      "view": { "label": "View filters", "holds": ["customer", "region", "created"] },
      "data": { "label": "Customer records", "offers": "all",
                "holds": ["status", "plan", "tier", "owner"] }
    }
  },
  "savedFilters": {
    "has-tickets": { "label": "Has open tickets",
                     "query": { "v": 1, "scopes": { "data": { "where": { "openTickets": { "gt": 0 } } } } } }
  },
  "ui": {
    "grid": { "key": "email", "columns": ["…"], "actions": ["…"] }
  }
}
```

- **`source`** — which store, how it pages and searches, every field as
  `declareField` takes it, and each scope's name and what it holds at the
  start. **No field lists its values** — see §3.
- **`savedFilters`** — the saved filters the page ships: each a name and a
  query definition, every scope's `where` (DATA-SOURCE-RULES §2) and `holds`,
  as a reader's saved filter is. Listed beside the reader's on every bar, and
  taken as theirs are — into the field chips; never saved over or deleted.
  One that is not `{ label, query: { v: 1, scopes } }` is reported
  (`saved-filter-invalid`) and left out. `T-saved-filters-are-every-scope`
- **A scope's `sets`** draw fields as one group:
  `"sets": [{ "id": "account", "label": "Account", "mode": "serial", "fields": ["customer", "region"] }]`.
  A `serial` set chains them — Region offers only the regions of the picked
  Customers, and of every filter before it. `parallel`, the default, only
  groups (`T-a-filter-set-groups-or-chains`). Either way a chip counts, and
  Limit greys it, within the filters BEFORE it: the fields in the scope's
  order, each set together
  (`T-one-walk-counts-and-limits-in-order`).
- **A scope's `arranges`** says whether Group and Sort arrange its rows. Left
  out, a scope over a grid or a list does, and the View does not
  (`T-group-and-sort-are-component-scope`).
- **A field's `child`** names the field holding its CHILD values — a
  Customer's Site: `"customer": { "label": "Customer", "child": "site" }`,
  `"site": { "label": "Site" }`. A child has no filter of its own: its picks are
  in its parent's reading, so no scope holds, offers or sets it, and
  `offers: "all"` leaves it out. Not under a number or a date (TODO 369).
- **A number field's `thresholds`** are its bands, declared once:
  `"health": { "type": "number", "thresholds": [{ "to": 60, "label": "At risk", "status": "critical" }, …] }`.
  A gauge over the field draws them, a bar chart is cut at them, and a saved
  filter names one: `{ "health": { "band": "At risk" } }`
  (`T-a-threshold-is-a-fact-of-the-field`).
- **`applyOn: "input"`** makes the source's filters apply LIVE: a number does
  not wait for Apply, and a value reports while it moves. The source loads
  `debounce` ms (default 300) after the last move. The default, `"change"`,
  applies once per act. A remote source always waits for Apply (TODO 107).
- **`holdRows`** caps the whole set a REMOTE source holds and answers every
  question from on the client (default 50 000; `0` holds none, so every
  question asks the store). The set is the STORE's, shared by every page over
  it: a page with a smaller cap asks the store, and the set stays. See DATA-SOURCE-RULES, "A remote store's whole
  set is HELD" (TODO 340).
- **`ui`** — each component's configuration, by id, set through its own API
  before it is answered — as a View's `ui` is. The grid's columns live here.
- **Its Views** are filed under its `id`: the ones it ships, and a reader's
  saved ones.
- **The header's chips are not listed.** They are the View scope's holds,
  each drawn from its field — one definition per field
  (`T-a-field-is-declared-once`). The View chip lists `views`.
- **Its markup is its Context's**, named in the app definition (`app.v1.json`,
  TODO 190) — not here.

---

## 3. Where a field's values come from

Decided by Will, 2026-09-29: *"fields like Status and Seats will need a finite
set/range of possible values provided in the data… If the list isn't provided
then Status's list will just be all the unique values in the field and Seats
range will be between the min and max values."*

| field | the DATA says it | nothing said |
|---|---|---|
| a set — Status | an ordered array: `oneOf(['active', 'trial', …])` | the unique values in the rows, sorted |
| a range — Seats | `number()` with `min(1)` and `max(500)` | the lowest and highest value in the rows |

- **The data says it in the store's SCHEMA** — the same rules that refuse a bad
  record. One list does three jobs: it checks a write, it is what a filter
  offers, and its order keeps a category's slot and colour
  (`T-a-category-keeps-its-colour`). A second copy in the page would drift.
- **An array, because order carries meaning** — a lifecycle, a tier, a weekday.
  A set or an object key order would lose it.
- **JSON Schema says the same thing** as `enum`, `minimum` and `maximum`, which
  `import_schema` already maps to these rules — so a remote store states its
  values the same way.
- A store with no schema list costs one load of every row, once, at open.

---

## 4. Who reads it

The ROUTER hands the definition to the PROVIDER on every navigation:

```js
provider.close({ next: true });   // leave the last page; the next one decides the panel
provider.prepare(definition);     // its filter mode BEFORE its markup is drawn, so nothing shifts
contextRoot.innerHTML = markup;
const source = await provider.open(definition, { stores, views, view, session });
cleanup = await mod.init(contextRoot, { session, view, source });
```

The provider builds the source from the app's registered store, declares
every field, value and scope, holds each scope's first fields, fills
the header's chips from the View scope, and does what `provide()` does today —
the kept Query on its own View, the View picks, the session, the panel mode.
Leaving a page closes it. A Context module keeps only its own business:
`init(root, { source })` wires add, edit and delete. The source is opened into
the Context's ONE Query, `ctx.query`: one definition per Context, and a second
source joins it with `new DataSource({ store, query })`.

A page with no data (Chat, Settings) has no `source`, and the provider shuts
the panel as it does now (G1).

---

## 5. What goes, and what stays

| goes | stays |
|---|---|
| each Context's source, declarations, holds, saved filters, Add lists, header chips, `provide()`, teardown | the Context's own business: add, edit, delete, its dialogs and toasts |
| the "forgot to pass the session" gap | a bespoke summary a page binds itself (the risk gauge) |
| `globalFilters()` — the header's chips come from the View scope | `DataSource`, the Query, `provide()` for a page that wants it by hand |

---

## 6. Building it — one commit each

| step | builds | proves |
|---|---|---|
| D1 ✅ | `provider.open(definition)`, `saveView()`, `openSource()`, `schemas/page.v1.json`; a field's values from the schema or the rows (§3) | the Dashboard opens from `../Sherpa Demos/app/definitions/dashboard.json`; `dashboard.js` 183 → 116 lines |
| D2 ✅ | Records from `records.json`; the reader's saved filters and each bar's Group and Sort come from the provider; the customer schema lists its values | the Records filter suite; `records.js` 601 → 359 lines, `global-filters.js` deleted |
| D3 ✅ | the router opens each page from its definition, with the app's stores and the page's Views; a definition's `ui` configures its components by id; a Context's `init` gets its source | the full suite; `../Sherpa Demos/app/index.html` is the one caller of `open()` |
| later | the Templater builds `template` from JSON (68, 70) | — |

---

## 7. Where definitions live

Decided by Will, 2026-09-29: in **`../Sherpa Demos/app/definitions/`** for now — a page's
definition and its View library. They belong to the app built with Sherpa, not
to a component. When the example app becomes its own project, the folder moves
with it.
