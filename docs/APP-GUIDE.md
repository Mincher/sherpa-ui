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
      <sherpa-overlay-panel id="filter-column" data-heading="Filters" data-side="start"
                            data-floatable data-minimisable data-searchable data-search-placeholder="Search filters">
        <sherpa-filter-panel data-scope="view data"></sherpa-filter-panel>
      </sherpa-overlay-panel>
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
  A shut panel takes no room. Add `data-floatable` to the filter panel's overlay panel and it
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
- `types` is the app's types, by id: each a path to its `type.v1` file (`{ "device": "types/device.json" }`),
  registered before a Context opens. A page names its own (`source.type`), and says in `source.fields` only what
  each control does: the words are the type's (`pageFields`, `sherpa://data-rules` "A type says each field once").
  A type that names its rows (`data`) has a store by its id; a graph type's store is its entities on the shelf.
  A Context may name a `type` and no `template`: `{ "label": "Devices", "type": "device" }` is the type's own page,
  its filter toolbar, a grid of its fields and a pager. One type file, one data file and one line in
  app.json make a working page.
- `entities` is the app's preset entities and their types, an `entities.v3.json`: read only,
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
  one module can serve many. `stores` is every store a page may name, by name
  (each app.json type's, then the app's own, which wins): a module reads another
  type's rows there, the same store its page reads, never a second one.
- Reach the header and the panels through `ctx`, never `document`. A part a
  component does not offer is a door to ask for, not a shadow root to reach
  into. `T-a-shadow-reach-is-a-missing-door`
- A component's property is set AFTER it is defined.
  `T-a-property-set-before-upgrade-shadows-its-accessor`
- A Context with nothing of its own needs no module.
- **An act is said once** (`registerAct`, `sherpa-ui/data`; plan 964): its id (`<type>.<verb>`), its words, the
  type whose rows it acts on, its input as a type's fields (a `ref` field names another type's rows), whether it
  changes data, where a press offers it, and its `run`. A press, the AI chat and the MCP all call `runAct(id, { keys,
  input }, { stores: ctx.stores })`: it checks the call by the type's rules and answers `done` (with an `undo` where it
  changed data) or `refused`, in words. Ask the reader before an act that `changes`. Every app.json type gives
  `<type>.find`, `.read`, `.add`, `.change` and `.remove` by itself; `actsOf({ context, view, type })` lists a page's,
  `actsOf()` every act, and `actSchema(act)` is a call's JSON Schema, for a tool.
- **A press names its act in markup**: `<sherpa-button commandfor="<the outlet's id>" command="--user.suspend"
  value="u1">Suspend</sherpa-button>` — its keys its `value` (a key, or a JSON list), else the selected rows of the
  page's grid; a grid row action whose `id` is an act's runs on its rows. The outlet runs it through `runAct` at once
  and says it in a toast, with Undo where it changed data; a refusal in its words.

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
{ "filters": { "label": "Filters", "graph": { "type": "filter" } },
  "nodes": { "label": "Custom Nodes", "graph": { "type": "node" } } }
```

- The outlet draws the View chip and, to its right, the graph chip: the
  type's presets (read only), the reader's own, then New graph…. The URL
  carries both, `?view=filters&graph=mine`; the type's first is left out.
- The canvas lays its nodes out on a plain layer. `data-drawn` on the
  `sherpa-layout-canvas` draws them into a real canvas, where the browser can
  (Chrome 157 on). Measured at 2,000 nodes, that is slower to pan, zoom and
  drag, and faster only to type, so leave it off. `T-a-canvas-draws-live-html`
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
  panel, toolbar, session, stageDialog })`, then `page.source.load()`. `T-a-graph-is-a-view-of-a-type`
  It is the ONE node editor, on the page's Query as its document: every tool works there, and each
  edit is asked of the Query as a chip asks; the layout (places, ties, frames, stages, lanes) is kept
  for the tab beside it. `T-one-node-editor`
- **A page and its Views go through one lens door.** `lensOf('query')` draws a page's Query and
  writes it back as the page (`pageWithQuery`); `lensOf('view')` draws the page with one of its
  Views put on its Query, and writes back the View (`viewWithQuery`), its `query` as the Query holds
  it then: filters, sort, group and search. A View's `query` has one writer, `statedQuery`: the View
  chip's Save and the graph's write the same. The MCP's `edit_definition_graph` takes a page and a
  `view`, for a View in your views file.

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
- `/nav/large` (on by default) doubles the nav's sizes and spaces and steps its text up one; the shell's rail inset follows.

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
- **The reader's own**, in the page keeper's `entities`, the one entity shelf. They
  are NAMED, so they are every tab's, in the database with `database: true`, and on
  the server with `remote` (the page name `NODES_PAGE`; `restore(NODES_PAGE)` takes
  them back). A stored entity of the wrong shape is dropped. `T-only-a-named-part-crosses-tabs`

One door for each act, for the editor, an MCP tool and an assistant alike (plan 942):
`createNode(shelf, json)`, `readNode(shelf, id)`, `updateNode(shelf, id, change)`,
`deleteNode(shelf, id)`, and `keepNode(shelf, kind, definition)` for one the editor made or
changed. Each checks as Save checks, and answers `{ id }` or `{ faults }` in words. An id a
preset or a shipped kind holds is refused: a custom node overrides nothing.

Every Context's `init` is handed `entities` (the outlet's provider's). Its `library()` is
every entity of a reusable type as the Custom Node it offers, and `watch(handler, signal)`
hears a change here or in another tab:

```js
const kinds = { ...NODE_KINDS, ...kindsOf(entities.library()) };
entities.watch(() => {
  for (const id of Object.keys(kinds)) if (kinds[id].model === 'graph') delete kinds[id];
  Object.assign(kinds, kindsOf(entities.library()));
  panel.populate(paletteOf(kinds));
}, signal);
const editor = bindWorkflow(canvas, workflow, { kinds, panel, session, library: entities.library() });
// Save: keep each Custom Node the draft made or changed, once, through the door; then the graph.
for (const [kind, definition] of Object.entries(editor.edits())) await keepNode(entities, kind, definition);
editor.save();
```

The panel lists them under "Custom Nodes", a preset marked read only, in one list
whose headings stick as it scrolls, with a Jump to chip beside its search. A Custom
Node's `tags` (a list of words, on its entity) list it under each tag there, and the
search finds it by one: give Save as Custom Node's dialog a tags field,
`<sherpa-input-text name="tags" data-type="tags">`, and pass `tags` to `newGraph`
and `saveGraphAs`. A saved one is retagged in the inspector: a use's Tags field, and
inside it the Group Input's and Output's, edit its definition's tags
(`tagDefinition`), so every use shares them; a preset's are read only. A use's
inspector also lists each input and output of its Custom Node: its Name, its Type, and
Remove (`socketEdit`). Each is one step; that use follows the change, every other use says
"Update available", and a removed socket's connections go, inside and on this graph. A Custom
Node being edited is a draft in its tab until it is saved, as a workflow is.
`T-a-node-panel-lists-under-sticky-headings`

### Pass, Fail, Branch and Count

No node has a True or a False socket (plan 944). Every test (a Condition, Time, Tag, And,
Or, Not, Is empty) gives **Pass**, the rows that hold, and **Fail**, the rows that do not,
so no row is lost; and **True**, 1 where its test holds, 0 where not (plan 971 A). To send
the at-risk devices one way and the rest another, connect a Condition's Pass and its Fail.

A **Branch** node sends ALL its Data one way: its test on its header, its Data on a row.
Its **When** says what makes it Yes: Any (its test has a Pass row), All (no Fail row),
None (no Pass row), or At least N Pass rows. A plain value on its header (a Prompt's
True, a Count) is true where it is above zero, true, or not empty. Yes sends the Data
where When holds, No where it does not. The other way is not taken: nothing after it
runs, and Simulate's light says Not taken. With no Data, a Branch sends its test.

And and Or take anything, several. An input is true where it is above zero, true, or
not empty. Pass: Or, the rows of every true input; And, the rows in all of them. Fail is
the rest of their rows. A test's True or Pass into an And or an Or says its condition, so
the Query reads the same tree; its Fail says the opposite one. A Condition fed one
value tests that value against Value B (Not and Is empty by its truth). To count rows,
use a Math node of type Count: rows in, how many out.

A Condition's Operation list follows what comes in on its header. A value or a column
lists the operations its type takes (text, a number, a date, a boolean). Rows or an
object list And, Or and Is empty: a comparison needs a Field. A mixture lists every
operation one of them takes. An input the pick does not take is ignored: its line is
dashed, and its tip says why. Where no input fits, the pick stays and the node warns.

A Field node has ONE Values row: a dropdown whose menu ticks the values its own field declares
(its type's or page's `values`), drawn only where it declares some. It sends what is picked, one
value or the list: join it to a Condition's Value B, or its Values for Is one of. Filtering stays
the Condition's. A node's multi-select is always this one row, the same dropdown a single pick
uses, opening a menu of ticks (plan 960 U4.7a; Will: `T-a-multi-select-is-one-row`).

### Outputs

An Output is a node per FAMILY, each a kind of its types (plan 917): `notify`
(Notification), `content` (On a view, Generated file), `response` (Toast, Alert, API
response), `result` (Run result) and `request` (none shipped). A family of several
types has its Type row first; one of one type has none. Each type has its
parameters, its icon, and its properties: output rows, so an Output may feed the
nodes after it. Request is not listed in the Nodes panel until you add a type to it.
Add your own types to a family, from your own file, before a graph opens: then every
editor, check and save reads them.

```js
const ticket = {
  label: 'Ticket', icon: 'ticket', help: 'Open a ticket on a board', would: 'Would open a ticket',
  rows: [
    { name: 'summary', label: 'Summary', control: 'message', input: 'value' },
    { name: 'priority', label: 'Priority', control: 'pick', input: 'value', choices: [{ value: 'p1', label: 'P1' }, { value: 'p2', label: 'P2' }] },
    propertyRow('ticket-id', 'Ticket ID', 'value'),
  ],
};
registerNodeTypes('request', { ticket });
```

`addTypes(NODE_KINDS.request, { ticket })` gives the family with them, for one
editor's `kinds` alone; its graphs then save only where you check them yourself.

- A `message` row takes text with values, `{node.name}`: a row or property of a node
  before it, or a field of the rows a Source sends. Its Insert value menu lists
  them; one no connection gives is a warning on its row. In the node it is a text
  area; the Details panel edits it as Markdown, each value a purple chip.
  `singleLine: true` makes it one line, as a title: a text box in the node, no
  toolbar in the Details panel, and no line break goes in.
- A `pick` row picks from its own `choices`.
- Simulate never fires an Output: its light says its `would`, and each property
  sends a stand-in. Send a test, in its Details, fires `output-test`
  `{ node, kind, type, values }` on the canvas: send the test to the reader there.
  Sherpa sends nothing.

### Organise

One **Organise** node sorts, groups and searches rows, and names a chart's axes, in every
graph (Will, plan 960 U4.2). Its rows: Sort and Direction, Group, Search, and Primary (X),
Secondary (Y) and Segments. Each picks a field of the rows that reach it; an empty one does
nothing. In a page's Query graph it is each scope's own, and each edit is the request its
chip sends; a chart card's axes are set there. In a workflow, Simulate keeps the rows that
contain its Search, puts them in its Sort's order, then gathers them by its Group.

### AI nodes

The AI category has four nodes. A **Model** picks a provider and one of its models,
both; a **Prompt**, a **Runbook** and a **Skill** ask it. Each of the last three has
**Expects** as its Type picker: True/false gives a True, 1 or 0, as a Condition does;
Text, Number, Data and List give an Answer, a property. A Model with a pick left blank
warns "Pick a provider" or "Pick a model".

**One model for the whole graph** (plan 951). A Model joined to the Start's Model row
is the graph's PRIMARY. Every AI node with no Model of its own uses it, in the graph
and in every Custom Node inside it, and its Model row says "From the Start". A Model
joined to an AI node's own row overrides it. With neither, the node warns "Join a
Model, here or to the Start". A graph with no AI needs no primary: the Start does not
warn. `graphModels(workflow, library)` lists every model used, the primary first, each
with how many AI nodes use it. The editor's **Graph details** tab shows that list: it
is the only tab with no node picked, and the last tab with one.

Sherpa ships no providers, models or skills. Register yours once, at load, before a
graph opens:

```js
registerAiCatalog({
  providers: { anthropic: { label: 'Anthropic', models: { opus: 'Claude Opus 5.5' } } },
  skills: { 'summarise-tickets': { label: 'Summarise tickets' } },
});
```

- A Model lists the models of the provider it picked.
- A Skill lists yours, then New; a new one is its Instructions. A Runbook is its
  own Instructions, for the model to run.
- Your runbooks are nodes of the **Runbooks** category, not a list (plan 936): see
  Runbooks, below.
- Simulate asks no model. A node says what it would do, and each answer is a
  stand-in by its shape: True 1, words, 0, no rows, an empty list.

### Runbooks, and who made a node

The Nodes panel's two tabs split by WHO made a node: **Preset Nodes** holds the kinds
Sherpa and your app ship and every preset Custom Node; **Custom Nodes** holds the
reader's own. In each tab the nodes stand under their category, so **Runbooks** can
stand in both. A runbook is a Custom Node of the Runbooks category: its steps are its
sub-graph, and a double click, or the drill-down button on its header's end, opens them,
read only for a preset. Give an entity type
a `category` (`registerEntityType({ …, category: 'Runbooks' })`) and its entities stand
there; an entity's own `category` wins. Save as Custom Node asks a Category when its
dialog has a `[name=category]` select (`data-type="select"`): Custom Nodes, Runbooks,
and each category your entity types name (`savedCategories()`). Who may change a
node of their own is your rule: give `bindWorkflow` a `canEdit(definition)`, and a no
opens its inside read only, as a preset's does.

The way back from a sub-graph is at the canvas's top left, not in the app header: put a
trail in the canvas's `trail` slot, a Back button and the breadcrumbs. The editor fills the
crumbs, shows the trail only inside a sub-graph (the canvas's `data-trail`), and goes back
on Back, on a crumb and on Escape:

```html
<sherpa-layout-canvas>
  <sherpa-stack slot="trail" data-direction="inline" data-gap="sm">
    <sherpa-button data-action="back" data-type="icon" data-look="transparent" data-icon-start="arrow-left" aria-label="Back" data-tip="Back (Esc)"></sherpa-button>
    <sherpa-breadcrumbs></sherpa-breadcrumbs>
  </sherpa-stack>
  …
</sherpa-layout-canvas>
```

To write a runbook's steps as text, as its prompt, read its graph as steps:
`graphSteps(graph)` gives each stage's steps in the flow's order, numbered "stage.place"
("2.1"). Each step says where its flow `goes`: a step by its number, an output, or a stop.
Each way of a fork is apart, in its `branches`: a test's Pass and Fail, a Branch's Yes and No, where one of
them leads on. A step's `kind` is its node's (`branch`, `condition`). A Model that only gives a model is no step. The
words for each step are your app's.

### Triggers

A **Trigger** is a Start node, first in the Nodes panel, in its own Triggers category.
Nothing comes into it. Its Type, **Listens for**, says what starts the graph: a User
action, a UI event, a Task schedule, a Task status, an AI message or an API response.
What it heard leaves by its rows (the Task, the Status, the Response…). A graph may hold
several: any one of them starts it. Your SERVER listens, not Sherpa: the definition
holds the Trigger's type and rows, and `TRIGGER_RUNS` maps each type to the runtime's
kind (`on_demand`, `scheduled` or `event`). Simulate says what it would hear ("Would
start when the task changes"); a row you set sends what it holds, the rest a stand-in.

Tell the Triggers what can be heard, once, at load, as for the AI nodes:

```js
import { registerTriggerCatalog } from 'sherpa-ui/data';
registerTriggerCatalog({
  events: { saved: { label: 'Record saved' } },
  tasks: { patch: { label: 'Patch run', help: 'The nightly patch' } },
  agents: { triage: { label: 'Triage agent' } },
  endpoints: { tickets: { label: '/tickets' } },
});
```

A list you register is a pick; one you do not is typed text.

Every top graph has a **Start**: the graph's entry point, always there. It is a node,
`{ "id": "#start", "kind": "#start", "x": …, "y": … }`, kept and moved as any node; one is
added where a graph has none, and it cannot be removed. Each Trigger joins it by a line from
its header, which sends True when it fires: `{ "from": "<trigger>", "to": "#start" }`. The
Start sends nothing.
A Trigger not joined to it warns. A Custom Node's body, or any graph with a Group Input
or Output, has none: those enter it.

The Start stands in the graph's first stage, and a line is drawn from it to each Source:
the line is never kept, and nothing flows on it.

An entity type your app registers may say `reusable: false` (a Coworker): the Nodes
panel then lists none of its entities, and a graph that places one is refused.

### Output Triggers

An **Output Trigger** starts something when the run gets there. Its types: a UI event, a
Task status or an AI message, which another graph's Trigger may hear. Add your own type to
start one of your entities, with a row that picks it from the shelf:

```js
import { OUTPUT_TRIGGER, registerNodeTypes } from 'sherpa-ui/data';
registerNodeTypes(OUTPUT_TRIGGER, {
  coworker: { label: 'Run Coworker', icon: 'person', help: 'Run a Coworker', would: 'Would run the Coworker',
    rows: [{ name: 'coworker', label: 'Coworker', control: 'entity', of: 'coworker' }] },
});
// The editor reads the shelf at each draw: what an entity row lists, and where a loop is looked for.
bindWorkflow(canvas, workflow, { entities: () => shelf.list().map((e) => shelf.get(e.id)), ... });
```

A ring of them across the shelf (A starts B, B starts A; or A starts itself) is a loop:
each Output Trigger in it is blocked, and warns "Blocked: it would start a loop, A › B ›
A". The graph still saves. `startLoops` gives the same answer to a server or an agent.

### Moving nodes

A node moves by a drag on its header, or by the arrow keys there; ⌘ or Ctrl and an
arrow moves the picked nodes. Every move holds nodes apart by their RADII, half each
one's largest side: a node moved too near another pushes it away, and that one pushes
on. Two that began nearer stay as near. With the setting `chainDrag` (on), ⌘ (Ctrl
off a Mac) held on a drag, or with an arrow on a header, pulls the nodes it joins
along behind it, and theirs behind them: each connector is a rope as long as it was,
slack when pushed. The whole move is one Undo. The math is the data layer's, with no
DOM: `startDrag` and `dragTo` (plan 918).

### Stages

A workflow's canvas has STAGES: columns across the top, left to right. A graph has
one at least, Stage 1, round every node; the workflow keeps them in `stages`, and a
node names its own in `stage`. Every node is in a stage: one let go in a stage joins
it, one let go between or past them joins the nearest, and a stage grows to hold its
nodes. Remove puts a stage's nodes in the stage before it. The gap between two
stages is a separator: drag it, or use the arrow keys, Home and End, and the stage
before grows as the one after shrinks, no node moving (a stage keeps `w`, its width).
The setting `resizeStages` (on) turns it off. With `resizeStagesMoveNodes` (on) too,
the edge goes past the nodes: the stage it narrows pushes them in, across only, in
order, a node pushing the one it meets with their gap kept, down to its widest node;
there they may overlap. The push is drawn as it goes and is one Undo. Each stage bar has Move left and Move right, and More: Edit, Add
stage before, Add stage after and Remove. A default name is its place (Stage 1,
Stage 2): one added or moved before Stage 1 is Stage 1. A new stage takes the next
data-viz colour no stage wears (`nextStageColour`); an app that makes stages gives
them colours the same way, `colourStages(stages, DATA_VIZ_SWATCHES.map((s) => s.value))`,
so stage 1 wears colour 1. A graph an app or an agent makes without laying it out
sets `unfurl: true` on its graph: the editor unfurls it the first time it shows it,
as the toolbar's Unfurl would, and saves it without the flag. That save is the editor's own
`definition-save`: an app that keeps graphs on its own Save keeps them on that event too, or
the layout is never stored. Give `bindWorkflow` a
`stageDialog` for Edit, one field to a row:

```html
<sherpa-dialog id="stage" data-heading="Edit stage">
  <sherpa-stack data-gap="md">
    <sherpa-input-text name="label" data-label="Name" required></sherpa-input-text>
    <sherpa-input-text name="description" data-label="Description" data-multiline></sherpa-input-text>
    <sherpa-swatch-picker name="colour" data-label="Colour"></sherpa-swatch-picker>
  </sherpa-stack>
  <sherpa-container-footer slot="footer">
    <sherpa-button data-action="cancel">Cancel</sherpa-button>
    <sherpa-button data-action="save" data-look="saturated">Save</sherpa-button>
  </sherpa-container-footer>
</sherpa-dialog>
```

### Swimlanes

The toolbar's Swimlanes turns on a row for each family of nodes (`LANES_BY_FAMILY`:
Data, Values, Organise, Agentic, Custom, Output), kept in the workflow's `lanes`. A
node stands in its family's lane, and wears its colour. A logic node or a portal
stands in a junction, never a lane: under the lowest lane its inputs come from, so
the junction nodes one lane feeds share one junction (an Out portal is fed through its
In). One fed from no lane stands by the lanes it joins. A
lane grows to hold its nodes and pushes the ones under it down; a lane with no node
takes no room. On and off, the nodes move to their places; off, each goes back where
it stood before (`beforeLanes`), and one placed since stays. Inside a Custom Node they
are its definition's, kept as its frames are, and no part of its version: no use goes
stale. Group Input and Group Output stand in no lane.

### Entities

An entity is a graph saved under a TYPE, an id and a name (`entity.v2`): `{ v, type,
id, label, graph { nodes, connections }, settings, uses }`. Its type says what its
settings hold, which node families its graph may place, and which sockets (`#in`,
`#out`) it must have. A Custom Node is the type `node`. `filter` is the other
type that ships: its graph sends a condition to `#out/where`. An app adds its own
with `registerEntityType(type)` (a clash with a shipped type is refused).

- **One door**, `entities` in every Context's `init` (and `keeper.entities`):
  `list(type?)`, `get(id)`, `await save(entity)`, `remove(id)`, `await duplicate(id, newId)`,
  `export(id)`, `await import(json)` and `watch(handler, signal)`. An id names ONE
  entity. A save runs `checkEntity` and says each fault in words; a remove is refused
  while another entity uses it, naming who. `nodes` is the same shelf seen as Custom Nodes:
  every entity, as the node it offers, by its use's kind.
- **The presets** are the file `app.json` `entities` names (`entities.v3`: `{ v, types: { id: type }, entities: { id: entity } }`,
  each type a `type.v1` with its `graph` part: `{ families, inputs, outputs, runs, reusable }`),
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
- **A Filter is a preset** of every page over its store (TODO 776): the provider
  reads the shelf as the page opens, and each one's chip follows the page's own presets,
  the app's then the reader's. A press is `query.ask({ scope, preset: 'filter:<id>', on })`.
  Its graph is read by the one reader the Outgoing JSON shows (`conditionAt`), each field's
  own (`presetOfEntity`): Store › Field › Condition, a test per Condition on the Field on its
  header, And and Or joining tests (plan 783); a use's True into And or Or joins the outer
  condition. An Or across two fields is said in words and left off. The Query
  editor's panel lists them under Custom Nodes. `T-a-filter-is-a-preset-of-its-store`
- **A Filter keeps its Where** where a Where says it all: `{ "v": 2, "type": "filter", "id",
  "label", "query": { "where": { "status": { "eq": "active" } } }, "settings": { "source" } }`,
  in place of a graph. Its lens draws the graph from it, and Save writes a graph back as a Where
  while it holds only a Source, Fields, tests, And and Or. `filterOf(preset, source)` makes a
  Filter of a page's preset, or of a saved filter in one scope. Read an entity's graph with
  `entityGraph(entity)`; save what a lens writes back as its body (`saveGraph(shelf, id, bodyOf(answer.definition))`),
  as it may have no graph. A use's Update says what its Filter's Where changed, field by field
  ("status: equals trial to equals suspended"), not the nodes its drawing gave ids (a lens's `changes`).

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
- A panel has ONE mode, `data-mode`: `fixed`, `overlay`, `floating` or `tab`, and one side, `data-side` (`start`, else
  `end`). Put it in the app shell or a canvas as a child, and it is docked in that side's area; the panel sets its own slot. An
  area holds two panels at most, stacked top and bottom, and owns how they present: a panel's header buttons ask
  (`panel-mode-change`) and the area writes the mode on both. An overlay panel with `data-floatable` floats: its header bar moves it,
  any edge or corner resizes it, the one across held (Shift on a corner keeps its shape; the keys, on its grip and its
  bottom-right corner), and Dock puts it back in its area, in the area's mode. It reports `panel-mode-change`, `panel-move` and
  `panel-resize`; keep `data-mode`, `data-side`, `data-x`,
  `data-y`, `data-width` and `data-height` in the session and hand them back. The
  Nodes panel is an overlay panel in the canvas with `data-side="start"` and
  `sherpa-node-list` in it, and floats the same way, inside the canvas; so does a
  filter panel's overlay panel with `data-floatable`. A press or a focus brings a floating panel to the front. Drag a floating
  panel by its header to within 4rem of the left or right edge and the area it would dock in lights up (an empty side, a card;
  a side with one panel, the new half of the split, above or below by the pointer's height); drop on it to dock, and the shell
  or canvas reports `panel-dock { side, place }`. Escape cancels. With no pointer, the Fixed button or `requestMode('fixed')`
  docks it. `T-a-dragged-panel-docks-where-the-area-lights-up`
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
