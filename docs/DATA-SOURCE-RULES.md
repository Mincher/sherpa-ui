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

They are DevExtreme's names, deliberately: a vocabulary a backend author has
probably met beats one Sherpa invented.

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
  readonly key: string;
}
```

Extend `BaseStore` and you get the key handling, the schema check and the
`change` announcement for free — you write `load` and the four mutations.

**Announce every change.** `this.announce({ type: 'insert', key, row })` is what
tells a bound `DataSource` to re-query, which is what redraws every component
watching it. A store that mutates silently leaves the screen lying.

**Copy in and copy out.** `ArrayStore` does `{ ...row }` on both edges so a
caller cannot reach in and mutate a stored record by holding a reference. It
also keeps `#push`'s skip-if-unchanged guard working, which compares the rows
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

A `DataSource` holds one query and pushes results to bound components:

```js
const source = new DataSource({ store, pageSize: 25 });
source.bind(grid);                                  // two-way: reads and steers
source.bind(chart, { readonly: true, as: byCategory });  // reads only
```

- **`readonly`** — the component shows the data but never steers it.
- **`steerOnly`** — its events reach the source but no rows are pushed back
  (a filter toolbar's `populate()` means "here are your chips", not "here are
  your records").
- **`as`** — an adapter from rows to that component's payload shape.
- **`into`** — this bind owns ONE named part of the payload, so two sources can
  feed one component without the last writer winning.
- **`signal`** — an `AbortSignal`; the binding ends when it aborts.

**Which lives where:** a **store** is app-level, because records outlive any one
screen and are shared by every screen showing them. A **source** is view-level,
because a query is exactly as long-lived as the view asking it.

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

That is two sources, with the component's taking the view's whole filter as one
named part:

```js
const view = new DataSource({ store });
const grid = new DataSource({ store });
view.addEventListener('change', () => grid.contribute('scope:view', view.state.filter));
```

Because it arrives as ONE PART, a view change replaces that part and cannot
touch the component's own — so a component filter survives the view being
cleared entirely, and the two can never fight.

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
sources, one following the other — a card extending a dashboard, or a panel
extending a card, is the same relationship with different words.

---

## 7. It runs with no DOM

```js
import { ArrayStore, DataSource } from 'sherpa-ui/data';
```

Stores, queries, validation, live connections and saved views all work in Node —
on a server, in a test, in an MCP tool. `sherpa-ui` itself does not: it exports
58 components, and importing a component defines a custom element.

A lint rule keeps those modules DOM-free, and a test proves the entry point
stays free of components.

---

## The short version

1. A row is a plain object with one identity field.
2. A query is data — `[field, op, value]` — so it can be sent somewhere.
3. `total` is the count **before** paging.
4. A store announces every change, and copies on both edges.
5. Validation lives on the store, and runs on reads too.
6. Stores are app-level; sources are view-level.
7. None of it needs a browser.
