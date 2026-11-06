# Building an app on Sherpa

How to build an app on sherpa-ui, in order. Each step is the one way to do it
today. Served to agents as `sherpa://app-guide`.
[Sherpa Demos](https://github.com/Mincher/sherpa-demos) is one app built this
way.

**Start from the starter:** `npm create sherpa-ui my-app`. It is every step
below, in one folder with no build.

An app is five kinds of file:

| file | holds |
|---|---|
| `index.html` | the page: the shell, and `outlet.start()` |
| `app.json` | THE list: every Context, the default, the nav, the Settings pages |
| `templates/*.html` | each Context's markup: components that ASK for data |
| `view-schemas/*.json` | each Context's page definition: its store, fields, scopes |
| `contexts/*.js` | each Context's own behaviour, if it has any |

Plus the app's stores, and its Views as JSON.

---

## 1. The page

```html
<!doctype html>
<html lang="en" data-theme="sherpa" data-mode="auto">
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <script type="importmap">
    { "imports": { "sherpa-ui": "/node_modules/sherpa-ui/dist/bundle/index.js" } }
  </script>
  <link rel="stylesheet" href="/node_modules/sherpa-ui/dist/styles/tokens/tokens.css">
  <link rel="stylesheet" href="/node_modules/sherpa-ui/dist/styles/tokens/page.css">
</head>
```

- `dist/bundle/` is Sherpa joined into a few files: a page with no bundler of
  its own loads about 10, not 200. Use the bundle OR the
  module files (`dist/index.js`), never both: two copies of every class. An app
  with its own bundler imports `sherpa-ui` as usual. `T-a-page-loads-the-bundle`
- Serve text files compressed (brotli or gzip). A bundle file whose name ends in
  a hash (`chunk-AB12CD34.js`) never changes: it can be cached for good.
- Every icon is a symbol in one file, `dist/core/ui/icons.svg`, fetched once, the
  first time an icon is drawn. Serve it from the app's own origin (a CSP's
  `connect-src` must let it through), and keep it in the app's Service Worker to
  draw icons offline. `T-an-icon-loads-when-first-drawn`
- `tokens.css` gives every component its variables. `page.css` styles the
  page itself — margins, the body font. Leave `page.css` out when the
  components go into someone else's page. `T-tokens-are-safe-to-embed`
- The `viewport` meta is what makes a phone draw the page at its own width;
  without it a phone draws it 980px wide, and every component's phone layout
  stays off.
- `data-mode="auto"` follows the OS. No `data-mode` is light.
- Sherpa loads no font. The tokens ask for Inter, then `system-ui`: link Inter
  in this `<head>` to use it. Nothing else is fetched — no polyfill, no CDN.
- The targets are current Chrome, Edge and Firefox, desktop and Android.
  Safari is not one; every iOS browser is WebKit, and Sherpa brings its own
  stand-in where WebKit lacks something (today `Temporal`).
  `T-temporal-is-the-date-model`
- `sherpa-ui` is everything. `sherpa-ui/components` is the components alone,
  `sherpa-ui/app` the app layer, `sherpa-ui/data` the data layer with no DOM.
  `T-the-app-layer-is-opt-in`
- **A form's submit is a native `<button type="submit">`** — `sherpa-button`
  submits no form. Give it the Button's look with `class="sherpa-button"` and
  the Button's own names (`data-look="saturated"`, `data-size`, `data-status`,
  `disabled`). Link `dist/styles/button.css` beside `tokens.css` for a native in
  the page; one inside a component's template has it already. An unlayered
  `button {}` reset of your own beats it. `T-a-native-wears-the-button-class`

## 2. The shell

```html
<body>
  <sherpa-router data-params="context view" data-overlay="settings"></sherpa-router>
  <sherpa-provider>
    <sherpa-app-shell>
      <sherpa-nav slot="nav"></sherpa-nav>
      <sherpa-app-header slot="header">
        <sherpa-breadcrumbs slot="breadcrumbs"></sherpa-breadcrumbs>
        <sherpa-quick-filter-toolbar slot="filters" data-type="view" data-scope="view"
                                     data-locked data-reset-on-populate></sherpa-quick-filter-toolbar>
      </sherpa-app-header>
      <sherpa-quick-filter-toolbar slot="panel-start" id="filter-column" data-orientation="portrait"
                                   data-column data-scope="view data"></sherpa-quick-filter-toolbar>
      <sherpa-outlet id="context-root"></sherpa-outlet>
      <sherpa-dialog slot="overlay" id="settings" data-type="overlay">
        <sherpa-app-header slot="header" data-back></sherpa-app-header>
        <div id="settings-root" style="block-size: 100%"></div>
      </sherpa-dialog>
    </sherpa-app-shell>
  </sherpa-provider>
</body>
```

- **The router owns the URL.** A link, `router.go(changes)` and Back are all
  requests. Never call `history.pushState`. `T-the-router-owns-the-url`
- **The provider answers every component's ask** with the open page's data.
  `T-a-component-asks-its-provider`
- **The outlet draws the route's Context**, keeps the nav, and opens Settings
  over the Context. `T-an-outlet-loads-the-context` · `T-the-outlet-keeps-the-nav`
- **Settings opens ON TOP of the Context**, which is never reloaded, so closing
  Settings keeps its View. The URL carries both:
  `?context=records&view=risk&settings=application`. A Settings page is ONE
  page with no Views: a section heading before each set of settings, a Jump to
  chip (`sherpa-quick-filter data-type="jump"`) in its header, and a footer only
  where typed values need Save.
- **A row kept in view** — a metrics row — goes in a `<div slot="context-header">`
  in the Context's markup. The outlet lifts it over the scroll area.
  `T-a-context-has-a-fixed-region`
- The View chip is the header bar with `data-type="view"`: it picks the
  Context's Views, and the URL follows.
- **A panel in `panel-start` or `panel-end` docks FLUSH** in that area of the
  body, a `sherpa-layout-panels`: top, side and bottom, with no shadow; the area
  draws the divider, takes the panel's width and resizes by its edge
  (`panel-area-resize`; keep the width, hand it back in `data-panel-start-width`).
  A shut panel takes no room. Add `data-floatable` to the filter column and it
  floats out of the area and docks back. `T-a-panel-area-is-a-layout`

## 3. `app.json`

```json
{
  "$schema": "./node_modules/sherpa-ui/schemas/app.v1.json",
  "v": 1,
  "product": { "name": "My product", "icon": "group" },
  "default": "dashboard",
  "nodes": "nodes.json",
  "entities": "entities.json",
  "contexts": {
    "dashboard": {
      "label": "Home", "icon": "home",
      "template": "templates/dashboard.html",
      "definition": "view-schemas/dashboard.json",
      "views": "views/dashboard-views.json",
      "module": "contexts/dashboard.js",
      "chrome": { "resizable": true }
    },
    "records": { "label": "Records", "icon": "table-columns", "template": "templates/records.html",
                 "definition": "view-schemas/records.json", "module": "contexts/records.js" }
  },
  "sections": [{ "label": "Customers", "contexts": ["records"] }],
  "settings": {
    "module": "contexts/settings.js",
    "pages": { "appearance": { "label": "Appearance", "icon": "paint-roller", "template": "templates/appearance.html" } }
  }
}
```

- A Context is what a nav row opens: `?context=records`. Each path is
  relative to `app.json`. The default Context is the nav's Home.
- `chrome.header: false` takes the app header away while it is open;
  `chrome.filters: false` its filter row, and `"views"` leaves the View chip
  alone there, for a Context with no definition (see "Graph Views").
- `entities` is the app's preset entities, an `entities.v1.json`: read only,
  listed with the reader's own; its Custom Nodes are its entities of the type
  `node`. See "Entities", below.
- `checkApp(app)` reports every broken name. `T-an-app-is-its-definition`

## 4. Stores

```js
import { localRecords, rules, required, email, oneOf } from 'sherpa-ui';

export const { store: customerStore, ready: customersReady } = localRecords({
  name: 'customers', key: 'email',
  schema: rules({ email: [required(), email()], status: oneOf(['active', 'trial', 'churned']) }),
  seed: customers, seedVersion: 1,
});
```

- `localRecords()` is IndexedDB where the browser has it — its rows in
  Sherpa's one database, under `name` — and memory where not. It seeds a first
  run, and again when `seedVersion` moves. `T-local-records-seed-themselves`
- A server's records are a `RestStore`; the same filter grammar reaches it.
  `docs/DATA-SOURCE-RULES.md`
- **The schema says what a field may hold.** `oneOf([...])` is the list every
  filter offers, in its order. `T-the-data-says-what-a-field-may-hold`
- Import a store by ONE URL everywhere. A file the server maps to two paths
  is two modules, and two stores. And make each store ONCE: the outlet's
  `stores()` hands back the SAME object at every open, or a remote store's
  held rows are read again each time. `T-a-store-has-one-cache`
- **When a store cannot be reached**, the provider says so: `provider.reach`
  is `ok`, `unreached` (the last rows are shown, unconfirmed) or `down`
  (nothing to show), and `reach-change` fires when it moves; `recheck()` tries
  again (it does on `online` and a tab shown). The outlet draws a banner for it;
  a page with no outlet listens itself. `T-the-provider-says-the-pages-reach`
- **Keep a remote store's rows on the device** with
  `keepCache(store, { name: 'customers:' + tenant })`: a reload shows them at
  once, offline too, and checks them behind. Call `clearKept()` at sign-out.
  `T-a-kept-set-is-checked-each-session`
- **Ask the device to keep that data** with `keepData()`, when your app chooses —
  after a sign-in, say. Sherpa never asks on its own: Firefox shows the reader a
  prompt. `T-one-browser-database`

## 5. A page definition

```json
{
  "$schema": "../node_modules/sherpa-ui/schemas/page.v1.json",
  "v": 1,
  "id": "records",
  "source": {
    "store": "customers",
    "pageSize": 25,
    "fields": {
      "status": { "label": "Status", "select": "multiple" },
      "openTickets": { "label": "Tickets", "type": "number" }
    },
    "scopes": {
      "view": { "label": "View filters", "holds": ["region"] },
      "data": { "label": "Records", "offers": "all", "holds": ["status"] }
    }
  },
  "savedFilters": {
    "has-tickets": { "label": "Has open tickets", "query": { "v": 1, "scopes": { "data": { "where": { "openTickets": { "gt": 0 } } } } } }
  },
  "ui": { "grid": { "key": "email", "columns": [{ "field": "name", "header": "Name" }] } }
}
```

- The `view` scope narrows every component; another scope narrows the
  components that name it in `data-scope`. `T-a-page-is-its-definition`
- **A condition is written ONE way**: the ops by field, numbers as numbers —
  `{ "gt": 0 }`, `{ "in": ["Pro", "Free"] }`, `{ "between": [10, 60] }`.
  `T-one-way-to-write-a-condition`
- `ui` configures a component by id before it is answered.
  `T-configuration-is-not-data`
- A date field picks DAYS. Give it `"range": true` to pick a from and a to.
  `T-a-date-picks-days-unless-it-says-range`
- A field's values can hold CHILD values — a Customer's Sites: give the parent
  `"child": "site"` and declare `site`. Its menu is then a tree in the bar, the
  panel and the grid heading; a pick is a parent, or a path `{ customer, site }`.
  `T-a-value-holds-child-values`
- Each axis's chip — Primary, Secondary, Group — offers what `axes` leaves:
  `"axes": { "chart": { "group": { "unavailable": ["name"] } } }`, on the source
  or on a scope, for `grid`, `chart` or both. `available` keeps only those named.

## 6. A template that asks

```html
<sherpa-layout-grid>
  <sherpa-metric data-label="Critical" data-aggregate="count"
                 data-where='{"severity":{"eq":"critical"}}'></sherpa-metric>
  <sherpa-quick-filter-toolbar data-scope="data" data-saveable></sherpa-quick-filter-toolbar>
  <sherpa-data-grid id="grid" data-scope="data"></sherpa-data-grid>
</sherpa-layout-grid>
```

- A component ASKS its provider; nothing binds by hand. A summary — a metric,
  a chart — counts every row, not one page. `T-a-summary-binds-to-all-the-rows`
- `data-where` is a component's own filter. It narrows it alone, and outlives
  a View pick. `T-a-component-default-outlives-a-view`
- A grid that fits its box needs a sized parent. `T-a-fit-grid-needs-a-sized-parent`
- Wait for `settled(root)` before you measure: icons load when first drawn.
  `T-an-icon-loads-when-first-drawn`
- **What is new** shows in an element that LISTENS for it, drawn `hidden`:
  `data-listens="app"` (a new version), `"data"` (newer rows wait) or `"lost"` (a
  save made offline lost). The provider shows it while that waits; a locked
  callout's close hides it until the next notice; a `data-refresh` from it takes
  the rows in. For your own list, read `provider.updates` (`waiting`, and its
  `change` event), never a second `onUpdate`. `T-a-notice-is-heard-never-ordered`
- **So no page polls for news,** serve `updatesFeed()` at `/sherpa/updates`, `say()`
  a new build or a changed store on it, and call `followUpdates()` in the page: one
  tab follows it, and the worker checks behind. Where no feed answers, it polls
  instead — call it alone, never `watchForUpdates()` beside it.
  `T-news-is-pushed-by-the-server`

## 7. A Context module

```js
export async function init(root, { source, query, session, view, signal, header, panels, label, id }) {
  root.querySelector('#add').addEventListener('click', () => openForm(source.store), { signal });
  await header?.populate({ breadcrumb: [] });
}
```

- Every Context, Settings page and panel gets the same `ctx`. `source` is the
  page's, when it has a definition, and `query` its Context's ONE Query: a
  second source joins it with `new DataSource({ store, query })`. `signal`
  aborts when it goes; or return a teardown. `id` is its key in `app.json`, so
  one module can serve many.
- Reach the header and the panels through `ctx`, never `document`. A part a
  component does not offer is a door to ask for, not a shadow root to reach
  into. `T-a-shadow-reach-is-a-missing-door`
- A component's property is set AFTER it is defined.
  `T-a-property-set-before-upgrade-shadows-its-accessor`
- A Context with nothing of its own needs no module.

## 8. Views

```json
{
  "all": { "label": "All customers", "query": { "v": 1, "scopes": { "data": {} } } },
  "risk": {
    "label": "At risk",
    "query": { "v": 1, "scopes": { "data": {
      "where": { "health": { "lt": 60 } },
      "sort": [{ "field": "health", "direction": "asc" }]
    } } }
  }
}
```

- A View is JSON: each scope's `where`, `holds`, `sort`, `group`.
- A page's own **saved filters** are query definitions — each scope's `where`
  and `holds`, under a name. The Filters menu lists them beside the reader's;
  ticked, one is a preset chip on the bar. It is never saved over or deleted.
  `T-saved-filters-are-every-scope`
  The first View is the Context's own; the URL leaves it out.
  `T-a-view-is-json`
- A View's own cards are markup, in a template beside the JSON.
  `T-a-views-markup-lives-in-a-template`
- A reader's own Views: `provider.saveView(name)`, `provider.deleteView()`.
  Each View keeps what the reader left on it, where the keeper's `eachView`
  says so: `T-a-view-keeps-what-the-reader-left`.

### Graph Views

A graph View is a View whose body is a canvas, showing one entity of a type
(see "Entities"). Ship ONE per type, and set the Context's `chrome.filters` to
`"views"`:

```json
{ "filters": { "label": "Preset Filters", "graph": { "type": "preset-filter" } },
  "nodes": { "label": "Custom Nodes", "graph": { "type": "node" } } }
```

- The outlet draws the View chip and, to its right, the graph chip: the
  type's presets (read only), the reader's own, then New graph…. The URL
  carries both, `?view=filters&graph=mine`; the type's first is left out.
- `init` is handed `ctx.graph` (`{ view, type, id, origin }`), and the outlet
  fires `graph-change` `{ graph }` when it moves. Bind the canvas to
  `graphWorkflow(entities.get(id))` with `bindWorkflow`, `readOnly` on a
  preset and `entity` the one open, `library` `nodes.library()`;
  `graphOfWorkflow(editor.workflow())` is the graph to keep.
  `outlet.openGraph(id)` opens another.
- New graph… asks first, `graph-new` `{ type }`: prevent it to ask a name, then
  `newGraph(entities, entityTypes()[type], { label })`. Left alone, the outlet
  makes "New <type>". `T-a-graph-is-a-view-of-a-type`
- The header's Save and its menu read Save graph as and Delete graph there;
  Save is off on a preset. Each is a request (`view-save`, `view-save-as`,
  `view-delete`): the Context prevents it and answers. Save is
  `saveGraph(entities, id, graph, { tags: editor.tags() })`, the open graph's own
  tags with it (its Group Input's and Output's Tags field); Save graph as asks a name in the Save View
  dialog, then `saveGraphAs(entities, id, graph, { label, description })` and
  `openGraph` the copy; Delete says `entities.whyKept(id)` when it is refused.
- **A page's filters are a graph View too**: ship
  `{ "page-filters": { "label": "Page filters", "graph": { "type": "query" } } }`. Its graph chip
  lists your pages (each Context with a definition), and a filter toolbar with
  `data-node-editor` offers Open in Node Editor in its ⋮: the outlet goes there, on that page,
  and Back comes back. The outlet opens the page for its Query alone, under its own name, so an
  edit there is the page's. `init` is handed `page` (`{ id, label, href, definition, source,
  components, markup, stores }`; `graph-change` carries the next): bind
  `bindQueryEditor(canvas, page.source, { definition, components, markup, stores, inspector,
  panel, toolbar, session })`, then `page.source.load()`. `T-a-graph-is-a-view-of-a-type`

## 9. The session

```js
import { SessionStore } from 'sherpa-ui';

const session = new SessionStore({
  theme: { mode: 'auto' },
  nav: { pinned: false, favorites: [], recent: [], hierarchy: false },
  filters: { mode: 'toolbars' },
});
session.persist('/theme/mode');
session.persist('/nav/pinned');
```

- What outlives a Context lives here, by pointer. `persist()` keeps one
  across reloads; with no guard, the default's type is the guard.
  `T-session-persist-defaults-shared`
- A control bound to a pointer says so in its markup — the outlet binds it:
  `<sherpa-switch data-setting="/nav/hierarchy">`. One that depends on another adds
  `data-setting-needs="/pointer"`: disabled until that one is on. `T-a-setting-is-a-pointer`
- A demo or onboarding page may lay its own settings over the app's: `provider.settings.lay({ limitOptions: true })` on entering it, `lay(null)` on leaving. While on, a control bound to one reads and writes the page's, and nothing is stored, so a change never carries over to another page. Only a `page` or `component` setting may be laid. Not how an app sets a setting.

### Settings

Every setting is ONE entry in a schema: Sherpa's own are `SETTINGS`; an app adds
its own beside them, and may start one of Sherpa's otherwise.

```js
import { SETTINGS, Settings, SessionStore, persistSettings } from 'sherpa-ui';

export const SCHEMA = {
  ...SETTINGS,
  allowSolo: { ...SETTINGS.allowSolo, default: true },   // the app starts it on
  sites: { type: 'boolean', default: true, scope: 'app', at: '/filters/sites' },
};

const session = new SessionStore({});
for (const def of Object.values(SCHEMA)) if (session.get(def.at) === undefined) session.set(def.at, def.default);
persistSettings(session, SCHEMA);        // each kept, guarded by what it can take
const settings = new Settings(SCHEMA, session);
document.querySelector('sherpa-provider').settings = settings;
```

- **Add a setting in one step:** its entry — `type`, `default`, `scope` (`app`;
  `page`, which a page may lay; `component`, whose `null` leaves each component's
  own) and `at`, its session pointer. Then its use: a Settings switch says
  `data-setting="<at>"`; a component that reads it lists it in `static settings`,
  `{ 'data-its-attribute': 'key' }` (`'!key'` while it is off); a DataSource
  property of that name marks it `source: true`; a look marks `look: { props }`
  (custom properties on the root, by value) or `look: { attr }` (the root's
  attribute the tokens read, as `data-mode` and `data-density`).
- Read one with `settings.get(key)`; hear each move on its `change`. A reader's
  change made in the provider — a bar's ⋮, the mode button — is set and reported
  as `setting-change` `{ key, value }`. `T-a-setting-is-declared-once`
- Recents and Favorites name each View; `/nav/views: false` lists each Context
  once instead. `T-the-outlet-keeps-the-nav`
- The nav opens to a pointer; `/nav/hover: false` keeps it as icons until its Pin.
  `T-a-rail-may-stay-shut`

### A page's state

```js
import { PageKeeper } from 'sherpa-ui';

provider.keeper = new PageKeeper({ eachView: () => settings.get('eachView') === true });
```

- A page's state is ONE document, kept under its name (an outlet's Context): the
  View on screen, its Query, what waits for Apply (`draft`), each element's
  `ui`, what the reader left on each View, the saved filters on a bar, each
  card's toolbar, and — NAMED — the reader's own Views and saved filters.
  `T-one-page-one-document`
- Each part has ONE tier. Only what the reader names crosses tabs; the rest is
  the tab's, and a reload keeps it. `T-only-a-named-part-crosses-tabs`
- Give the keeper before a page opens. Its tiers are the app's: `tab`, `local`,
  `database: true` for the reader's Views in IndexedDB, `remote` for a server
  (`PageRemote`, a snapshot pushed, debounced). `await keeper.restore(page)`
  merges the database and the server under this browser's.
  `T-local-first-then-onward`
- An element's own state across a reload — a grid's selection — is the page's
  `ui`: `keeper.keepUi(ctx.id, { source, elements: { grid } }, { grid: () => ({ select: [grid.selectedKeys] }) }, { signal })`.
- `provider.export()` hands the same document out, and `import(state)` takes it
  back in. `T-a-page-goes-out-as-json`

### Custom Nodes

A Custom Node is a workflow body saved under one name, with its inputs and
outputs said once: an entity of the type `node`. They are app-wide, in two halves:

- **The presets**, which the app ships as entities of the type `node` in the
  file `app.json` `entities` names. They are read only; a reader copies one to
  edit it (`copyToMine`). `loadEntityLibrary(url)` reads the file: each entity
  goes through `checkEntity`, one that fails is reported in its words and left
  out, and the rest still load. The outlet does this for you.
- **The reader's own**, in the page keeper: `await keeper.saveNode(id, definition)` (it answers whether it was kept; its checks load only when it is first asked),
  `keeper.removeNode(id)`. They are NAMED, so they are every tab's, in the
  database with `database: true`, and on the server with `remote` (the page name
  `NODES_PAGE`; `restore(NODES_PAGE)` takes them back). A stored node of the
  wrong shape is dropped. `T-only-a-named-part-crosses-tabs`

`keeper.nodeLibrary()` is the two joined. An id a preset or a shipped kind holds
is refused: a custom node overrides nothing. Every Context's `init` is handed
`nodes` (the outlet's provider's), the same three calls and a `watch(handler, signal)` that hears a save
here or in another tab:

```js
const kinds = { ...NODE_KINDS, ...kindsOf(nodes.library()) };
nodes.watch((library) => {
  for (const id of Object.keys(kinds)) if (kinds[id].model === 'graph') delete kinds[id];
  Object.assign(kinds, kindsOf(library));
  panel.populate(paletteOf(kinds));
}, signal);
bindWorkflow(canvas, workflow, { kinds, panel, session });
```

The panel lists them under "Custom Nodes", a preset marked read only, in one list
whose headings stick as it scrolls, with a Jump to chip beside its search. A Custom
Node's `tags` (a list of words, on its entity) list it under each tag there, and the
search finds it by one: give Save as Custom Node's dialog a tags field,
`<sherpa-input-text name="tags" data-type="tags">`, and pass `tags` to `newGraph`
and `saveGraphAs`. A saved one is retagged in the inspector: a use's Tags field, and
inside it the Group Input's and Output's, edit its definition's tags
(`tagDefinition`), so every use shares them; a preset's are read only. A Custom Node
being edited is a draft in its tab until it is saved, as a workflow is.
`T-a-node-panel-lists-under-sticky-headings`

### Entities

An entity is a graph saved under a TYPE, an id and a name (`entity.v1`): `{ v, type,
id, label, graph { nodes, routes }, settings, uses }`. Its type says what its
settings hold, which node families its graph may place, and which sockets (`#in`,
`#out`) it must have. A Custom Node is the type `node`. `preset-filter` is the other
type that ships: its graph sends a condition to `#out/where`. An app adds its own
with `registerEntityType(type)` (a clash with a shipped type is refused).

- **One door**, `entities` in every Context's `init` (and `keeper.entities`):
  `list(type?)`, `get(id)`, `await save(entity)`, `remove(id)`, `await duplicate(id, newId)`,
  `export(id)`, `await import(json)` and `watch(handler, signal)`. An id names ONE
  entity. A save runs `checkEntity` and says each fault in words; a remove is refused
  while another entity uses it, naming who. `nodes` is the same shelf seen as Custom Nodes:
  every entity, as the node it offers, by its use's kind.
- **The presets** are the file `app.json` `entities` names (`entities.v1`: `{ v, entities: { id: entity } }`),
  read by the outlet through `loadEntityLibrary(url)`; one that fails is reported and left out.
  They are read only: `duplicate` makes the reader's own.
- **The reader's own** are one NAMED part of the keeper, as the nodes are: every tab,
  the database (`database: true`), and the server (`remote`). A stored entity of the wrong
  shape is dropped.
- **Any entity is a node** in any graph: `asNode(entity)` is the box it offers, and a
  use is a node whose `kind` is `<type>:<id>`. It follows its definition: `libraryOf(entities)`
  feeds `kindsOf`, `useOf` and `updateInstance`, as a Custom Node's library does.
  `T-an-entity-is-an-envelope-and-a-type`
- **Used as a node** (E5): `nodes.library()` holds every entity so, and the editor's panel
  lists them under Custom Nodes. Given `entity`, it offers what that type takes (`offeredKinds`),
  and no node that holds the graph (a loop). A placed use records its version; when the entity
  is saved again, each use shows "Update available", its diff and the split button, and an
  update stays in the draft until Save. Save each Custom Node the draft changed,
  `nodes.save(kind, definition)`, BEFORE the graph that places it, and stop on a refusal: the
  draft keeps it. `T-an-entity-is-used-as-a-node`
- **A Preset Filter is a preset** of every page over its store (TODO 776): the provider
  reads the shelf as the page opens, and each one's chip follows the page's own presets,
  the app's then the reader's. A press is `query.ask({ scope, preset: 'preset-filter:<id>', on })`.
  Its graph is read by the one reader the Outgoing JSON shows (`conditionAt`), each field's
  own (`presetOfEntity`): Store › Field › Condition, a test per Condition on the Field on its
  header, And and Or joining tests (plan 783); a use's True into And or Or joins the outer
  condition. An Or across two fields is said in words and left off. The Query
  editor's panel lists them under Custom Nodes. `T-a-preset-filter-is-a-preset-of-its-store`

## 10. Questions and saved filters

```html
<sherpa-dialog id="save-filters" data-heading="Save filters">
  <sherpa-input-text data-label="Name" required></sherpa-input-text>
  <sherpa-container-footer slot="footer">
    <sherpa-button>Cancel</sherpa-button>
    <sherpa-button data-look="saturated">Save</sherpa-button>
  </sherpa-container-footer>
</sherpa-dialog>
```

```js
const named = document.getElementById('save-filters');
const saveAs = async () => {
  const label = await named.prompt('');
  if (label) provider.saveFilters(label);
};
provider.addEventListener('filters-save', saveAs);
provider.addEventListener('filters-save-as', saveAs);
```

- `dialog.prompt(value)` and `dialog.confirm({ heading, words, action })` ask
  the question the dialog's own markup holds. `T-a-dialog-answers-its-question`
- A dialog or an overlay panel that only opens and shuts needs no script:
  `<sherpa-button commandfor="edit" command="--show">Edit</sherpa-button>`, and
  `command="--hide"` on a button inside it. `T-a-button-commands-by-markup`
- An overlay panel with `data-floatable` floats: its header bar moves it, its
  corner resizes it, and Dock puts it back on the right edge or in the shell's
  panel area it came from (`data-fixed`, or `data-fixed="start"`). It reports
  `panel-float`, `panel-move` and `panel-resize`; keep `data-floating`, `data-x`,
  `data-y`, `data-width` and `data-height` in the session and hand them back. The
  Nodes panel is an overlay panel slotted in the canvas's `panel` slot with
  `sherpa-node-list` in it, and floats the same way, inside the canvas; so does a
  filter column with `data-floatable`. A press or a focus brings a floating panel to the front.
  `T-a-floating-panel-is-a-state` · `T-a-pressed-panel-comes-to-the-front`
- From a script, call `dialog.show()`, never the native `showModal()`: the
  component owns modality and `open`. An add or edit flow is that dialog, its
  fields read on save, and a `sherpa-toast` to say it is done.
- **Save filters** keeps EVERY scope's filters under one name, with the page
  beside its Views. A saved filter is a preset the reader made: ticked in the
  Filters menu's Saved section, its chip joins the bar's presets, on; unticked, it
  goes, with what it held. Several may be on. Ask before you save over a name that
  exists. `T-saved-filters-are-every-scope`

## 11. Start

```js
import { checkApp } from 'sherpa-ui';
import app from './app.json' with { type: 'json' };
import { customerStore, customersReady } from './stores/customers.js';

const outlet = document.getElementById('context-root');
const settings = document.getElementById('settings');
outlet.start({
  app, base: new URL('./app.json', location.href), session,
  stores: () => ({ customers: customerStore }),
  ready: customersReady,
  panels: { filters: document.getElementById('filter-column') },
  settings: { dialog: settings, header: settings.querySelector('sherpa-app-header'),
              root: document.getElementById('settings-root') },
});
```

The outlet loads the route's Context and reports `context-change`,
`context-markup` (with `waitUntil`) and `context-load`. Hang the app's own
extras on those.

## 12. When something is wrong

Sherpa does not fail silently: a broken assumption REPORTS. Route every report
somewhere you will see it — a toast, a log. `T-a-broken-assumption-reports`

```js
import { onReport } from 'sherpa-ui';
onReport((r) => console.warn(r.code, r.message, r.at));
```
