# The Query — one compiled state, run on Apply

A design for TODO 73, 70 and 62, for Will to review before any of it is built.
2026-09-26.

It answers three asks as one:

- **73** — *"A query language that is compiled as conditions (grouping,
  sorting, filtering, conditions, segmentation, aggregation etc.) are built
  up. The data layer compiles this query then executes it when triggered."*
- **70** — *"Default filter fields, values, and states need to be bundled in a
  view definition."*
- **62** — *"Apply and Discard are actions that are only needed if there is a
  data fetch that reaches outside the Data Layer."*

---

## 1. Why

This session fixed a dozen filter bugs. Nearly all were ONE cause: a
filter's answer is held in several places, and they disagree.

| bug | the two holders that disagreed |
|---|---|
| 41 | the panel's reading and the bar chip's face |
| 55 | the source's selection and the grid heading's condition |
| 56 | the header chip and the source's `global` part |
| 21e | the source's compiled filter and every chip (empty after reload) |
| 44, 44b, 44c | the bar chip, the source and the grid heading |
| 72 | the bar's rebuilt menu and the source's reading |
| 42 | the legend's part and every other bound component |

Today the answer to "what is this page filtered by?" lives in:

| holder | what it keeps |
|---|---|
| each toolbar | its chips, their picks, conditions, on/off |
| the filter panel | its own copy, a draft, and "what was applied" |
| each grid heading | one condition per column |
| `DataSource` | field readings, named parts, one-component parts, the COMPILED filter, sort, group, search, page |
| `records.js` | the glue: header readings → a `global` part, a mirror back into chips and headings, the panel's refill |
| the session | each bar's `answers` (21e) |
| a saved view | a compiled filter, plus method calls on elements |

Every fix so far taught one holder to copy another more carefully. The fix
this design proposes is to have ONE.

---

## 2. The rules

1. **One Query per source.** Every filter, sort, group, search, page,
   segment and aggregate the reader has set up, in one plain-data object.
2. **The Query is in the READER'S terms.** Fields, picks, conditions, on/off
   — never a compiled clause. A clause is OUTPUT, made on demand, never saved.
3. **Controls are VIEWS of the Query.** A chip, a panel field, a column
   heading and a legend each READ their slice and REQUEST a change. None of
   them holds an answer of its own.
4. **Two copies: `applied` and `draft`.** A change that needs no fetch goes
   straight to `applied`. One that needs a remote fetch edits the `draft`, and
   Apply commits it. Pending, dirty and Discard all fall out of the difference.
5. **Save the Query, restore the Query.** A reload, a trip away, a saved View
   and a shared link are all the same act.
6. **A View is markup plus a Query.** The markup says what is on screen; the
   Query says what the data is.

---

## 3. The Query

```ts
interface Query {
  v: 1;
  /** One entry per scope, keyed by scope id. `view` is the page's own. */
  scopes: Record<ScopeId, ScopeQuery>;
}

interface ScopeQuery {
  /** The fields this scope holds, in order — the chips on its bar. */
  holds: FieldId[];
  /** Each held field's answer. The shape chips already report. */
  readings: Record<FieldId, FieldReading>;
  /** Saved filters on this scope, on or off. Their readings stay in the library. */
  presets?: Record<PresetId, boolean>;
  /** A component scope narrows only these bound components (see 42). */
  narrows?: BindId[];
  sort?: SortSpec[];
  group?: FieldId | null;
  search?: string;
  page?: { size: number; index: number };
  /** For a chart: what it splits by, and how a group becomes a number. */
  segment?: { field: FieldId; mode: string };
  aggregate?: { field?: FieldId; op: Aggregate };
}
```

`FieldReading` is unchanged — `{ picked, op, text, conditions, range,
suspended }` — so every control already speaks it.

**Records, as a Query:**

```json
{
  "v": 1,
  "scopes": {
    "view": {
      "holds": ["customer", "region", "created"],
      "readings": { "region": { "picked": ["EMEA"] } }
    },
    "grid": {
      "holds": ["status", "plan", "tier", "owner", "email"],
      "readings": {
        "status": { "picked": ["active"] },
        "owner":  { "conditions": [{ "op": "contains", "text": "Da" }] },
        "email":  { "conditions": [{ "op": "contains", "text": "@" }], "suspended": true }
      },
      "presets": { "at-risk": false },
      "sort": [{ "field": "name", "direction": "asc" }],
      "group": null,
      "page": { "size": 25, "index": 1 }
    },
    "bar-chart": {
      "holds": ["status"],
      "readings": { "status": { "picked": ["active", "trial"] } },
      "narrows": ["r-bar"]
    }
  }
}
```

The rules that exist today become rules OF the Query, checked in one place:

- **One field lives in ONE of `view` / a component scope.** Moving it is one
  write (`source.move`, already built).
- **Two component scopes may hold the same field** (two grids both filter
  Owner).
- **A component scope narrows only its `narrows`** — the legend fix (42), now
  a property of the scope rather than of a part.
- **A field the View holds is SUPERSEDED in every component scope** — the chip
  greyed, the heading read-only (44c). Derived, never written by a host.

---

## 4. Compiling

```ts
compile(query: Query, facts: FieldFacts): Compiled

interface Compiled {
  /** The shared filter — the view scope, ANDed with every component scope that narrows everyone. */
  filter?: Filter;
  /** Per bound component, the parts that narrow only it. */
  only: Record<BindId, Filter>;
  sort: SortSpec[]; group: string | null; search: string; page: number; pageSize: number | null;
}
```

- **Pure and DOM-free**, beside `readingClause` in `filter-state.ts`. It is
  `readingClause` and `chainRows` run over every scope, and `andFilter` over
  the result. `clauseConditions` is its inverse for a reader that hands over
  a clause.
- **The source runs it** whenever `applied` changes, and loads.
  `state.filter` becomes a read-only getter over `compile(applied).filter` —
  never saved, never restored.
- **Aggregation and segmentation** move in too. Today each Context builds a
  chart's numbers by hand in an `as` closure (`countBy`, `seriesBy`,
  `deltaPercent` — ~569 lines in the example). With `segment` and
  `aggregate` in a component scope, the source hands the chart its series.
  This is 38's "a component DECLARES what data it needs", given a home.

---

## 5. Draft and applied — when Apply runs (62)

```ts
source.query.applied   // what the rows are under
source.query.draft     // what the reader is editing
```

| a change to a field whose data… | goes to | Apply |
|---|---|---|
| is already in the data layer (local) | `applied` directly | none |
| needs a fetch outside it (remote) | `draft` | Apply commits `draft` → `applied`, then loads |

- **Remote is a fact about the STORE** (decided, Will 2026-09-26: *"Remote
  data will need to come into the data layer to be formatted ready for
  components to use"*). A store says `remote: true`; every field on that
  source then edits the `draft` and waits for Apply. A local store applies at
  once, as today.
- **The spoof lives in the data layer**: `spoofRemote(store, { delay: 800,
  fail: 0 })` wraps any store, marks it remote, waits `delay` ms per load and
  fails at the rate given. The example wraps one Context's store with it. 58
  (loading, empty and error states) uses the same wrapper to show each state.
- **Pending (46)** is one derived fact: `draft.readings[f]` differs from
  `applied.readings[f]`. The chip reads it and wears the pending look.
- **Dirty (66)** is the same test over a scope. The shared footer reads
  `source.dirty(scope)` and turns its commit and revert off when false — no
  host tracks it.
- **Discard** copies `applied` back over `draft` for that scope.
- **Result counts (60)** are the rows each field's own answer matches under
  `applied` — computed by the source, read by the chip.

---

## 6. Saving and restoring

| act | what is kept | where |
|---|---|---|
| reload, trip away and back | `query.applied` (and a live `draft`) | the session, per Context |
| Save a View (15) | `query.applied` | the view library |
| a shared link | `query.applied` | the URL, or a key into the library |

All three restore the same way: `source.setQuery(q)`. Every bound control
re-reads its slice. Nothing replays a control, so the rebuild-timing traps of
21e (`restoreAnswers`, the URL view picked after init) go away.

Replaced: the bars' `answers` / `restoreAnswers`, `persistView`'s `filter:
false`, the `/filters/records` session path.

---

## 7. The view definition (70)

**A View is markup plus a Query:**

```ts
interface SavedView {
  label: string;
  content?: string;   // markup, parsed through the allow-list — as today
  query: Query;       // replaces `snapshot`
}
```

- **Its default filters ARE its Query** — which fields each scope holds, their
  values and states. A View change applies the View's Query onto a clean
  slate, which is Will's 21e ruling (clean slate) and his 70 ask (defaults
  bundled) at once.
- **21b (which header chips survive a View change)** becomes one flag per
  field in the view scope: `survives: true` keeps its reading across a change.
- **Element state that is not data** — a column width, a grid's selected rows
  — stays in a small `ui` block, applied through the element's public API as
  `ViewSnapshot.elements` is today.

**One disagreement to settle, said once.** On 2026-09-18 Will chose markup as
the ONE format for what is on screen, and the JSON view definition
(`renderView`) was deleted — it had no use in the app. 70 now asks for *"a
JSON definition that gets translated to a template"*. This design keeps the
2026-09-18 ruling for LAYOUT (markup) and uses JSON only for the DATA (the
Query). Components in the markup name their scope and fields as attributes
(`data-scope="grid"`, `data-field`, `data-aggregate`), and the source composes
the rest. See question 1.

---

## 8. Controls

Every filter control does two things only:

```ts
source.query.applied.scopes[scope]          // READ its slice (or the draft)
source.write(scope, { field, reading })     // REQUEST a change
source.hold(scope, fields) / source.move(field, from, to)
source.apply(scope) / source.discard(scope) // only where the scope is remote
```

The source pushes each bound control its slice on every change — as it pushes
`data-sort-field` today. So:

| control | today | with the Query |
|---|---|---|
| toolbar | holds chips' answers; `readings`, `answers`, `restoreAnswers` | draws `holds` + `readings`; its events are requests |
| filter panel | its own draft, `#applied`, `readings`, refill from the bars | draws every scope; Apply/Discard call the source |
| grid heading | one `ColumnFilter` per column; `supersedeColumns` | draws the column's reading; superseded is derived |
| legend | a one-component part | a component scope with `narrows: [chart]` |
| `records.js` | several hundred lines of glue | declares scopes and fields; no mirroring |

**Informing other components** (Will's *"use this query to help inform other
UI components"*): the Filters menu's Added and Available lists, the panel's
Add list, "Filter applied at higher scope", the superseded heading, the
pending look, result counts and `debugState()` all read the Query. None is
computed by a component from another component.

---

## 9. What goes, what stays

**Goes**: the `global`, `columns`, `saved:*` and `legend:*` parts (they become
scope readings); `ownParts` (becomes `narrows`); the bars' `answers` /
`restoreAnswers`; the panel's `#applied` / `#syncDirty` (become
`source.dirty`); the grid's `ColumnFilter` model and `supersedeColumns`; the
selection mirror, `syncHeadings`, `syncColumns` and the panel glue in
`records.js`; `persistView`'s `filter` option; the Context's `as` closures,
as aggregation moves in.

**Stays**: `FieldReading`, `fieldState`, `readingClause`, `clauseConditions`,
the clause grammar, `bind()`, `select()` (a write into the view scope),
`groups()`, the scope registry, `debugState()`.

---

## 10. Building it — one step per commit, each deleting what it replaces

| step | builds | deletes | proves |
|---|---|---|---|
| 1 | `Query`, `compile()`, DOM-free, with unit tests | — | compiling today's parts and readings gives today's filter |
| 2 | the source holds `applied`; `select`/`contribute`/`apply` write it | the compiled `state.filter` as state | every filter test still passes |
| 3 | save and restore the Query (`setQuery`) | bar `answers`, `persistView` `filter` | 21e's tests, on the Query |
| 4 | toolbars and the panel read their slice; requests only | panel refill glue, the selection mirror | the Records filter suite |
| 5 | grid headings and legends as scopes | `ColumnFilter`, `supersedeColumns`, `ownParts` | 44b, 44c and 42's tests |
| 6 | `draft` / `applied`, `remote`, the debug store; pending, dirty, Discard | the panel's `#applied` | 62, 46, 66 |
| 7 | `SavedView.query`, View change applies it | `snapshot` for filters | the view tests |
| 8 | `segment` / `aggregate` in a component scope | the example's `as` closures | the chart tests |

A size gate lands with step 1 (`scripts/size-baseline.json`, a per-file line
count that may only fall — 38's plan), so each step shows what it deleted.

**Built (2026-09-27): steps 1 to 5**, in the order 1, 2, 4a–4e, 3, 5a–5c —
a bar must be drawn FROM the Query before a restore can draw it.

- 4a–4e: the header answers the View scope; a bound `scope` draws the bars,
  the open panel and the header (`drawReading`, `drawScope`); saved filters
  are presets.
- 3: the session keeps the Query, and `setQuery` restores it.
- 5a: a legend is a scope that `narrows` its chart (`ownParts` gone).
- 5b: a heading is a view of its field's reading, and wears the field's
  NORMAL chip (Will, 2026-09-27 — the `col:` chips and the toolbar's external
  chips are gone). A field a scope lets go of, held nowhere else, is cleared.
- 5c: superseded headings are built from the View scope.

Left for later steps: the panel still refills from the bars and routes its
Apply through them (step 6, with the draft); the bars still own which chips
they hold, and Records reports it (`syncScopes`); the grid keeps its own
`ColumnFilter` shape internally, as a drawn copy of the reading.

---

## 11. Decisions — Will, 2026-09-26

| # | question | answer |
|---|---|---|
| 1 | the view definition's format | **A** — markup for layout, JSON for the Query only |
| 2 | where "remote" is decided | **B** — on the STORE: remote data comes into the data layer to be formatted, so the spoof is a wrapping store there (§5) |
| 3 | build order | **A** — steps 1–5 first (one owner), then 6–8 |

The questions as asked, kept for the reasoning:

### The questions

**1. The view definition's format.**
- **A — markup for layout, JSON for the Query only.** Keeps the 2026-09-18
  ruling; a View is `content` (markup) + `query` (JSON). *(Recommended.)*
- **B — one JSON definition for both,** translated into a template and data
  requests, as 70 first sketched. Brings back a second layout language.

**2. Where a field's "remote" is decided.**
- **A — on the field** (`declareField(f, { remote })`), with the debug store
  spoofing it per field. Matches the ask. *(Recommended.)*
- **B — on the store** — a whole source is remote or not. Simpler, but every
  field then needs Apply.

**3. Build order.**
- **A — steps 1–5 first** (one owner, no draft yet), then 6–8. The bug class
  ends early; Apply-only-for-remote waits for step 6. *(Recommended.)*
- **B — step 6 with step 2,** so draft/applied is in from the start. Fewer
  passes over the controls, a bigger first change.
