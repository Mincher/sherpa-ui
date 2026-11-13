# Plan 960 U3: one store door

Plan 960 section 2.2: "An entity of any type is a row of its type. Rows stay in a Store; graph things stay on the
shelf. The shelf is READ through the Store door by an `EntityStore` adapter. A contributor's path: one type file, one
data file, one line in `app.json`. The app makes the store and a default page." Owner sherpa-ui-a9 (sherpa-ui),
sherpa-demos-67 (Demos). Written 2026-11-13, after U2 (`type.v1`, `source.type`, app.json `types`: a72f77ffa).

**Will's picks stand for now ("Go with your picks for now", 2026-11-13): D1 A, D2 A, D3 A below.** Say B to change one.

## 1. What exists (each read on a72f77ffa)

- A page gets its stores from the app: `outlet.start({ stores: () => ({ name: store }) })` (sherpa-outlet.ts:44); the
  provider opens a page's source over `stores[source.store]` (:559).
- An app makes each store by hand. Demos: `customers` through `defineStores` (app/stores/stores.js:56), and
  `devices`, `alerts`, `coworkers` handed to the outlet by hand (app/index.html:735).
- A local seed: `localRecords({ name, key, time, schema, seed, seedVersion })` (idb-store.ts:58). Demos bumps
  `seedVersion` by hand, or from today's date where its rows follow today (devices-data.js).
- The Coworkers grid: Demos copies the shelf into an ArrayStore by hand (`followShelf`, coworkers-data.js:274), each
  row made by `coworkerRow` (:246): the entity's words and settings, and values the app works out (its Runs, next run,
  success rate). A Coworker's seed has its own version (`SEED_VERSION`, :118).
- A type's `data` names its seed rows (type.v1), and nothing reads it yet.

## 2. The design

1. **A type's store** (`typeStore(type, { rows, name? })`, the data layer and the browser): local records made from
   the type (`typeStoreOptions`), seeded with its rows, its status fields worked out (`typeStatusFields`). The seed
   version is made from the rows themselves (a hash), so no one bumps it: changed rows are a new seed; a row a
   person added stays (as `localRecords` keeps it today).
2. **An entity type's store** (`entityStore(shelf, type, { row? })`): the shelf's entities of the type as rows —
   `id`, `label`, `description`, `tags`, each settings field the type names, each `from` field read from the graph —
   kept in step with the shelf (`watch`). A write of a settings field saves the entity through the shelf, so it is
   checked; a `from` field is never written; a remove is the shelf's (refused while another entity uses it). `row`
   lets the app add the values it works out (a Coworker's Runs); their words are the type's fields.
3. **The app's stores** (`typeStores`): for each app.json type, its store by the type's id — a row type's from its
   `data` file, a graph type's from the keeper's shelf. The outlet makes them once the types are in; the app's own
   `stores()` wins by name, so an app may still make one by hand (a remote one, a debug pick).
4. **A default page** (D2): a Context that names a `type` and no `template` gets the type's own page: its toolbar, a
   grid of `typeColumns`, a pager, and (U6) its Details form. Its page definition is made from the type: the store,
   the type, the View and data scopes, and nothing else.

## 3. Decisions (picks stand)

| # | Question | A (pick) | B |
|---|---|---|---|
| D1 | Who makes a type's store | **The outlet, from app.json `types`, through `typeStores`; the app's own `stores()` wins by name.** One line in app.json is enough | The app makes them in its stores module (`defineStores`), as today: two files for a new type |
| D2 | A default page | **A Context with a `type` and no `template` gets the type's own page (toolbar, grid, pager)** | No default: `generate_page` (the MCP) writes the files |
| D3 | Values the app works out on an entity row (a Coworker's Runs) | **`entityStore(…, { row })` adds them; the type names their words** | A store the app wraps around the entity store |

## 4. Steps

| Step | Builds | Proves | Lane |
|---|---|---|---|
| U3.1 | `typeStore`, the seed version from the rows, `typeStores` for row types, the outlet makes them | unit: a type and its rows make a seeded store, and a changed row is a new seed; e2e: a Context over a type's store with no store the app made | a9 |
| U3.2 | `entityStore`; `typeStores` for graph types | unit: a Coworker saved on the shelf is a row at once, a settings write saves it, a `from` write is refused | a9 |
| U3.3 | the default page (D2) | e2e: a `user` type from 3 files (types/user.json, data/users.json, app.json) is a working page | a9 |
| U3.4 | Demos: `pageStores` by hand, `followShelf`, `coworkerStore` and `SEED_VERSION` deleted; Users (plan 963) on it | Demos specs in 3 engines | demos-67 |
