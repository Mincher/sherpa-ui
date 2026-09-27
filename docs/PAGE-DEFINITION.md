# The page definition — one JSON sets up a page

For Will's review before anything is built. 2026-09-28. TODO 92, gap G4
(`PROVIDER-DESIGN.md` §10).

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
      "status": { "label": "Status", "select": "multiple", "values": "data",
                  "order": ["active", "trial", "suspended", "churned"] },
      "owner":  { "label": "Owner", "select": "multiple", "values": "data", "custom": true },
      "email":  { "label": "Email", "custom": "only", "op": "contains" },
      "seats":  { "label": "Seats", "type": "number", "bounds": "data" },
      "created": { "label": "Date", "type": "date", "values": "data" }
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
  "views": "records-views"
}
```

- **`source`** — which store, how it pages and searches, every field as
  `declareField` takes it, each scope's name, what it holds at the start, and
  the saved filters the page ships.
- **`views`** — the View library, already JSON (`records-views.js`).
- **The header's chips are not listed.** They are the View scope's holds,
  each drawn from its field — one definition per field
  (`T-a-field-is-declared-once`). The View chip lists `views`.
- **`template`** — the markup, until the Templater (68) builds it from JSON.

---

## 3. Who reads it

The ROUTER hands the definition to the PROVIDER on every navigation:

```js
await provider.open(definition, { session, view });
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

## 4. What goes, and what stays

| goes | stays |
|---|---|
| each Context's source, declarations, holds, presets, Add lists, header chips, `provide()`, teardown | the Context's own business: add, edit, delete, its dialogs and toasts |
| the "forgot to pass the session" gap | a bespoke summary a page binds itself (the risk gauge) |
| `globalFilters()` — the header's chips come from the View scope | `DataSource`, the Query, `provide()` for a page that wants it by hand |

---

## 5. Building it — one commit each

| step | builds | proves |
|---|---|---|
| D1 | `provider.open(definition)` and the definition's JSON Schema | the Dashboard opened from a definition, no setup in `dashboard.js` |
| D2 | Records from a definition; the store registry | the Records filter suite |
| D3 | the router hands definitions; a Context's `init` gets its source | a trip through every page keeps each one's filters |
| later | the Templater builds `template` from JSON (68, 70) | — |

---

## 6. Decisions for Will

**1. Where do the data's own facts come from — Status's values, Seats' ends?**
- **A — the provider reads them from the data** (`"values": "data"`,
  `"bounds": "data"`), with `order` where the data has one. A list typed into
  the JSON goes stale the day the data changes
  (`T-a-chip-filters-the-values-the-data-has`). *(Recommended.)*
- **B — written in the JSON.** Simple and exact, but kept in step by hand.

**2. Where does a page's definition live?**
- **A — beside its Context**, as `records.page.json`, fetched by the router
  like its template. *(Recommended.)*
- **B — in one app file** listing every page. One place, but every page edits
  it.
