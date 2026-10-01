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
  "template": "records",
  "source": {
    "store": "customers",
    "pageSize": 25,
    "search": ["name", "email", "owner"],
    "fields": {
      "status": { "label": "Status", "select": "multiple" },
      "owner":  { "label": "Owner", "select": "multiple", "custom": true },
      "email":  { "label": "Email", "custom": "only", "op": "contains" },
      "seats":  { "label": "Seats", "type": "number" },
      "created": { "label": "Date", "type": "date" }
    },
    "scopes": {
      "view": { "label": "View filters", "holds": ["customer", "region", "created"] },
      "data": { "label": "Customer records", "offers": "all",
                "holds": ["status", "plan", "tier", "owner"],
                "presets": ["has-tickets", "at-risk", "unassigned"] }
    },
    "presets": {
      "has-tickets": { "label": "Has open tickets", "readings": { "openTickets": { "op": "gt", "text": "0" } } }
    }
  },
  "ui": {
    "grid": { "key": "email", "columns": ["…"], "actions": ["…"] }
  }
}
```

- **`source`** — which store, how it pages and searches, every field as
  `declareField` takes it, each scope's name, what it holds at the start, and
  the saved filters the page ships. **No field lists its values** — see §3.
- **`ui`** — each component's configuration, by id, set through its own API
  before it is answered — as a View's `ui` is. The grid's columns live here.
- **Its Views** are filed under its `id`: the ones it ships, and a reader's
  saved ones.
- **The header's chips are not listed.** They are the View scope's holds,
  each drawn from its field — one definition per field
  (`T-a-field-is-declared-once`). The View chip lists `views`.
- **`template`** — the markup, until the Templater (68) builds it from JSON.

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
const source = await provider.open(definition, { stores, views, view, session });
cleanup = await mod.init(contextRoot, { session, view, source });
```

The provider builds the source from the app's registered store, declares
every field, value, scope and preset, holds each scope's first fields, fills
the header's chips from the View scope, and does what `provide()` does today —
the kept Query on its own View, the View picks, the session, the panel mode.
Leaving a page closes it. A Context module keeps only its own business:
`init(root, { source })` wires add, edit and delete.

A page with no data (Chat, Settings) has no `source`, and the provider shuts
the panel as it does now (G1).

---

## 5. What goes, and what stays

| goes | stays |
|---|---|
| each Context's source, declarations, holds, presets, Add lists, header chips, `provide()`, teardown | the Context's own business: add, edit, delete, its dialogs and toasts |
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
