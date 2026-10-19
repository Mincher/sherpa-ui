# What Sherpa expects of your data

> Served to agents as `sherpa://data-rules`. Written for a person too: if you
> are pointing a Sherpa app at a backend, this is the whole contract.

Sherpa's data layer is two objects. **A store holds records. A source holds one
query over them.** Everything below follows from that split.

---

## 1. A record is a plain object

```ts
type Row = Record<string, unknown>;
```

No class, no wrapper, no base type to extend. Whatever your backend returns is
already a row, provided it is a plain object.

**One field is the identity.** You name it when you build the store:

```js
new ArrayStore(rows, { key: 'email' })   // default: 'id'
```

The key is how `byKey`, `update` and `remove` find a record, and how a grid
remembers a selection across a re-query. A row with a duplicate key or a blank
one is a record that two operations can disagree about — which is why the
records example puts `required()` on its key field.

**Nested values are read with a dotted path.** `'address.city'` works anywhere a
field name does — a filter, a sort, a column, a search field. You do not have to
flatten a response.

---

## 2. A query is data, not a function

```ts
interface LoadOptions {
  filter?: Filter;
  sort?: SortSpec[];        // [{ field, direction }]
  group?: string;
  search?: string;
  searchFields?: string[];
  skip?: number;            // paging: skip N in, take N out
  take?: number;
}
```

**A filter is `[field, op, value]`**, not a predicate:

```js
['status', 'eq', 'active']
['and', ['health', 'lt', 60], ['tickets', 'gt', 2]]
['or',  ['region', 'eq', 'EMEA'], ['region', 'eq', 'APAC']]
```

The whole layer speaks this one shape because **a filter has to survive being
sent somewhere**. An `ArrayStore` runs it in memory; a `RestStore` turns it into
a query string; a future SQL store would turn it into a `WHERE`. A predicate
function could do none of that — it cannot cross a network.

The operators, in full:

| | |
|---|---|
| comparison | `eq` `ne` `lt` `lte` `gt` `gte` |
| text | `contains` `notcontains` `startswith` `endswith` |
| set | `in` `notin` |
| range | `between` (value is `[from, to]`) |
| a date from today | `last` `next` (value is `{ n: 7, unit: "day" }` — `day`, `week` or `month`) |

**A server never gets `last` or `next`.** They stay relative in a saved View,
so "the last 7 days" does not freeze on the day it was saved; a `RestStore`
sends each as the `between` it means today, in whole UTC days
(`absoluteDates`). `T-a-relative-date-stays-relative`

They are DevExtreme's names, deliberately: a vocabulary a backend author has
probably met beats one Sherpa invented.

**A definition or a View writes the same ops by field** — the ONE way to
write a condition, with numbers as numbers:

```json
{ "openTickets": { "gt": 0 }, "status": { "in": ["active", "trial"] } }
```

| | |
|---|---|
| one value | `{ "eq": "EMEA" }` — `{ "ne": "churned" }` |
| several | `{ "in": ["Pro", "Free"] }` — `{ "notin": [...] }` |
| a range | `{ "between": [10, 60] }` |
| typed | `{ "gt": 0 }` — `{ "contains": "acme" }` |
| a date from today | `{ "last": 7 }` — `{ "next": 2, "unit": "month" }` |
| one of the field's bands | `{ "band": "At risk" }` — its `thresholds` say the ends (`T-a-threshold-is-a-fact-of-the-field`) |
| all hold | `{ "gte": 10, "lt": 60 }` — `{ "and": [{ "contains": "a" }, { "contains": "b" }] }` |
| any holds | `{ "or": [{ "lt": 10 }, { "gt": 90 }] }` |
| kept, not applied | `{ "eq": "trial", "off": true }` |

It goes under `where` — a page definition's saved filter, a View's scope —
and in a component's `data-where`. The source compiles it into the clause
above. `T-one-way-to-write-a-condition`

---

## 3. A load returns rows AND a total

```ts
interface LoadResult {
  rows: Row[];
  total: number;       // matching rows BEFORE skip/take
  dropped?: number;    // rows a schema refused
  issues?: Issue[];    // and why
}
```

**`total` is the count before paging**, which is the number a pager needs to say
"page 3 of 12". Returning `rows.length` there makes every pager wrong on every
page but the last.

`dropped` and `issues` are absent when nothing was dropped, so a host tests the
field rather than comparing to zero.

---

## 4. A custom store implements six methods

**A store is STATELESS.** It reads and writes records and remembers nothing
about how they are being viewed. Sorting, filtering, grouping and paging are the
`DataSource`'s job, so ONE store can back several views of the same records
without them fighting over a shared cursor.

That split is DevExtreme's, so the mental model transfers. What is not borrowed
is the size: no OData, no remote grouping, no query-builder language. A store
answers `load(options)` and four CRUD calls, and the interface is identical
whatever backs it — so a view moves from an in-memory array to an HTTP endpoint
without touching the components.


```ts
interface Store {
  load(options?: LoadOptions): Promise<LoadResult>;
  byKey(key: unknown): Promise<Row | undefined>;
  insert(values: Row): Promise<Row>;
  update(key: unknown, values: Row): Promise<Row>;
  remove(key: unknown): Promise<void>;
  totalCount(options?: LoadOptions): Promise<number>;
  distinct?(fields: readonly string[], options?: LoadOptions): Promise<Record<string, unknown[]>>;
  scan?(): Promise<readonly Row[]>;
  readonly key: string;
}
```

`distinct()` is optional: each field's values among the matching rows, one per
value. A store that has it is asked for a filter's values; one without it is
read row by row.

`scan()` is optional too: every row the schema accepts, handed over IN PLACE —
no copy — for a reader that only reads. The source's counts and limits walk the
rows once per scope (TODOs 347–349): a store with `scan` is walked in place; one
without it is loaded once per change; a remote store is walked from its held
set, or asked step by step. Give `scan` only to a store whose rows live in
memory — `ArrayStore`, `JsonStore` and the live stores have it.

Extend `BaseStore` and you get the key handling, the schema check and the
`change` announcement for free — you write `load` and the four mutations.

**Announce every change.** `this.announce({ type: 'insert', key, row })` is what
tells a bound `DataSource` to re-query, which is what redraws every component
watching it. A store that mutates silently leaves the screen lying.

**Name the row.** `key` is the row's key — on an update, the key it had BEFORE
the change — and `row` is the WHOLE row as saved; leave `row` out when you do
not know it (a server that replied with nothing). A cap that removes rows with
an insert lists their keys in `trimmed`. Say `rowOrder` — `'insertion'` or
`'key'` — when a load asked no sort returns rows in that order. A held set then
takes the change in place, with no whole read; a change with no `key` means any
row may have changed, and the whole set is read again.

**Copy in and copy out.** `ArrayStore` does `{ ...row }` on both edges so a
caller cannot reach in and mutate a stored record by holding a reference. It
also keeps `SourceBinding.push`'s skip-if-unchanged guard working, which compares the rows
array by identity.

---

## 5. Validation belongs on the store

```js
new ArrayStore(rows, { key: 'email', schema: customerSchema })
```

A form is not the only way a record arrives: a dialog, a paste, a REST response
and a script all reach the same records. **A rule enforced in one screen is not
a rule.**

The schema runs on **reads as well as writes**. A malformed row from a backend
is dropped and reported through `dropped` / `issues` rather than reaching a grid
that has no idea what to draw.

It is a [Standard Schema](https://standardschema.dev), duck-typed — so
`rules({...})` from Sherpa, or a Zod, Valibot or ArkType schema, all work with
no adapter and no dependency.

A schema can also **rename, coerce and default** on the way in, which is how an
external shape becomes a Sherpa row without a hand-written mapping layer.

**On a big response, sample it.** `{ schema, sample: 50 }` checks the first 50
rows instead of all of them — measured at 100,000 rows, that is 0.1ms instead of
58ms. A backend is wrong in a SHAPE, not one row at a time, so fifty rows answer
the question. Two rules: a schema that RENAMES or COERCES must not be sampled
(the unchecked tail would keep the old shape), and writes are always checked in
full regardless.

---

## 6. What the source adds

A `DataSource` holds one query and pushes results to bound components. In an
app, `<sherpa-provider>` does the binding: it opens a page definition's source
and answers each component's ask (`docs/PAGE-DEFINITION.md`). The binds below
are the manual way, for a page with no provider:

```js
const source = new DataSource({ store, pageSize: 25 });
bindSource(source, grid);                                       // two-way: reads and steers
bindSource(source, chart, { readonly: true, as: byCategory });  // reads only
```

- **`readonly`** — the component shows the data but never steers it.
- **`steerOnly`** — its events reach the source but no rows are pushed back
  (a filter toolbar's `populate()` means "here are your chips", not "here are
  your records").
- **`as`** — an adapter from rows to that component's payload shape.
- **`into`** — this bind owns ONE named part of the payload, so two sources can
  feed one component without the last writer winning.

A source's own options say WHEN a filter applies. **`applyOn: 'input'`** with
**`debounce`** (ms, default 300) applies it LIVE, while a value moves, and
loads once the moves stop — for a large local dataset that suits it. The
default, `'change'`, applies once per act. A remote source always waits for
Apply.
- **`rows: 'all'`** — this bind wants the WHOLE matching set, not the page. A
  grid shows page one of four; a total, a chart or a legend counting the same
  query must count all of it, or a donut redraws itself every time the reader
  turns a page. (Not `scope: 'all'`: `scope` names a filter scope, so that
  binds to a scope called "all" — and `bindSource()` reports it.)
- **`signal`** — an `AbortSignal`; the binding ends when it aborts.

**Which lives where:** a **store** is app-level, because records outlive any one
screen and are shared by every screen showing them. A **source** is view-level,
because a query is exactly as long-lived as the view asking it.

### Reading it back

Each thing you tell a source, you can ask back — one door each:

| told with | read with |
|---|---|
| `hold(scope, fields)` | `scope(scope)` — the fields it holds; `scopes` — every scope that holds one; `describe(scope)` — the scope whole, as a control draws it |
| `declareField` · `declareValues` · `declareSets` | `fieldFacts(field)` · `valuesFor(field)` · `sets(scope)` |
| `declareScope` | `scopeFacts(scope)`; `scopeLabel()` and `arranges()` add their fallbacks |
| `declarePreset` · `declarePart` · `declareDefault` | `preset(id)` · `partFacts(scope)` · `defaultFor(scope)` |
| `contribute(key, filter)` | `contribution(key)`; `contributions` — every key |
| `limitOptions = on` | `limitOptions`. `applyOn` is read only: set it in the options |

Each read-back here is a copy — `partFacts`' `only` is the element itself — and
`rows` is the source's own array, so never change it.

### A remote store's whole set is HELD

A store with `remote: true` is read ONCE for its whole set — once for every page
over the same store OBJECT, which shares one held set — `load({ take })`
with no filter, no sort and no search, so the answer is what your server's own
shaping gives (a tenant, a permission). While that set is held, the source
answers every load, count and distinct read on the client, with the same
search, filter, sort and paging an in-memory store runs. A chip toggled, a sort
cycled, the filter Switch, a page turned: none of them reaches your server.
Every chip's count, and what Limit greys and sets aside, comes from ONE walk
over the held set, in place. A set NOT held is asked step by step instead: one
`totalCount` per count and one `distinct` (or load) per list it tallies, sent
together.

Your store must say two things for its set to be held:

- **`reportsTotal`: its `total` counts every match.** A `RestStore` says so only
  with a `totalPath`; without one, its total is the rows it sent, and a server
  that caps a response silently would look whole.
- **`sampled` is false: its schema checks every row it reads.**

The source checks those two before it reads anything. Then the whole read must
come back whole: a total that is a number (a numeric string is read as one), at
most `holdRows` rows (a source option or a page definition's, default 50 000;
`0` holds none), and every row it counts — a server that caps a response
silently is refused. Otherwise it is said why once per store (`held-set-refused`)
and your store is asked every question, as before. A page whose `holdRows` is
smaller than the set asks your store, and the set stays for the others. A whole read that FAILS —
a 400 for the big `take`, a timeout — is caught: the source asks your store as
before until a Refresh.

The rows are as fresh as the last whole read and the changes announced since.
A `change` that names its row is taken into the held set in place; one that
does not — or names a row the set does not hold — reads the whole set again, as
a Refresh does. So a store whose rows change on the server should announce it
(an `EventStore` or `SocketStore` does).

**The set outlives the page.** When a page closes, its store's set stays, and
the next page over the same store object answers from it at once. A store that
says `announcesAll: true` — every change to its rows comes through it, as an
`ArrayStore`'s does — is trusted as it is; any other (a server another client
writes, a store another tab writes) is read again before a new page trusts it.
So **make each store ONCE** and hand the same object to every page: a new
object is a new store, with nothing held.

Matching is the client's from then on, so your server and the client must agree
on what a whole read returns, not on how to filter it.

### A failed load is a STATE, not a throw

Every load emits `loading` first, then `change` — or `error`. A backend being
down is not a programming error at the call site that typed into a box, so a
setter never throws:

```js
source.addEventListener('error', (e) => showBanner(e.detail.error));
source.setSearch('ada');   // never throws, whatever the store does
```

A failed load leaves the LAST GOOD ROWS on screen rather than blanking the
view, and the `error` event says what went wrong — `e.detail.failure` is its
KIND (`offline`, `timeout`, `server`, `refused`, `invalid`, `unknown`), read from
the error your store throws: give an HTTP failure a numeric `status`, as
`HttpError` does. A bound `sherpa-container` shows its own overlay off
`loading` without being told to.

**When the store cannot be reached, a held set stays.** A remote store's whole
read that fails offline, too slow or with a server error keeps the last set:
the page answers from it, each `change` says `stale: true`, and
`source.reach` is `'unreached'`. With nothing held it is `'down'`. A REFUSAL
(401, 403) is different: the store was reached, and said no — the set is
dropped, so nothing held is shown to someone no longer allowed to see it.
`source.recheck()` tries again; a page calls it on its Retry, on `online`, and
when its tab is shown. Never `navigator.onLine` — a store's own failures say
whether it answers.

**Kept on the device, if you ask.** `keepCache(store, { name })` keeps a remote
store's held set in IndexedDB, so a reload shows the last rows at once —
offline too — marked stale, and reads them again behind. Put the user or
tenant in `name`, bump `version` when the rows' shape changes, and call
`clearKept()` at sign-out: the rows outlive the session.

### The filter is NAMED PARTS, not one value

Several controls narrow one query at once — a toolbar's chips, a grid's column
headings, a chart legend, a saved view. Each owns a named part, and the source
ANDs them:

```js
source.contribute('chips',   ['tier', 'in', ['gold', 'silver']]);
source.contribute('columns', ['name', 'contains', 'ada']);
source.contribute('legend',  ['plan', 'ne', 'Free']);
source.contribute('chips',   undefined);   // that part only, removed
```

`setFilter()` replaces the WHOLE filter and clears every part, so it is what a
saved view uses and not what a control uses. A control that calls it wipes
whatever the others had said.

### Two scopes: a component EXTENDS a view, never alters it

A **view** filter narrows everything bound to its source — the charts, the
tiles, the grid. A **component** filter narrows one component and leaves the
rest alone: a reader hunting through a table does not want the charts beside it
to move.

    component rows = view filter AND component filter

That is ONE source, and its Query has SCOPES: `view` is the page's own, and a
component scope narrows only the components it names (`narrows`). Each holds
its own fields and their answers:

```json
{ "v": 1, "scopes": {
  "view":  { "holds": ["region"], "where": { "region": { "eq": "EMEA" } } },
  "data":  { "holds": ["status"], "where": { "status": { "eq": "active" } } }
} }
```

A view change cannot touch a component scope's answers, so a component filter
survives the view being cleared, and the two never fight. `docs/QUERY-DESIGN.md`
§3 has the whole shape.

**A field lives in exactly one scope.** Each toolbar offers only what the other
has left alone:

| held | offered to the view | offered to the component |
|---|---|---|
| view has it | no | no |
| component has it | **yes** — that is how it moves up | no |
| neither | yes | yes |

Adding a component's field to the view SUPERSEDES the component's chip: it is
not removed, it goes inactive holding what the reader picked, and comes back
when the view lets the field go. Off is not gone.

Nothing here needs to know what a "view" or a "component" is. They are two
scopes, one narrowing within the other — a card extending a dashboard, or a
panel extending a card, is the same relationship with different words.

---

## 7. It runs with no DOM

```js
import { ArrayStore, DataSource } from 'sherpa-ui/data';
```

Stores, queries, validation, live connections and the app definition's check
all run in Node — on a server, in a test, in an MCP tool. A lint rule keeps
each module here DOM-free, and a test checks that `sherpa-ui/data` loads
nothing else. Saved Views, saved filters and the session are the app layer:
`sherpa-ui/app`. `sherpa-ui` imports in Node too; it defines no component there.

---

## The short version

1. A row is a plain object with one identity field.
2. A query is data — `[field, op, value]` — so it can be sent somewhere.
3. `total` is the count **before** paging.
4. A store holds records and NOTHING about how they are viewed.
5. A store announces every change, and copies on both edges.
6. Validation lives on the store, and runs on reads too.
7. A failed load is a STATE, not a throw — the last good rows stay up.
8. Several controls narrow one query through NAMED PARTS, so none of them
   overwrites the others.
9. A component EXTENDS a view's filter; it never alters it.
10. Stores are app-level; sources are view-level.
11. None of it needs a browser.
12. A remote store's whole set is held — up to `holdRows`, when it reports a
    true total — once per store object, for every page over it, and every
    question is then answered on the client.
