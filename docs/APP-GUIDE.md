# Building an app on Sherpa

How to build an app on sherpa-ui, in order. Each step is the one way to do it
today. Served to agents as `sherpa://app-guide`. Sherpa Demos
(`../Sherpa Demos/app/`) is a working app built this way.

**Start from the starter:** `npx sherpa-ui init my-app`, or the MCP's
`scaffold_app`. It is every step below, in one folder with no build.

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
    { "imports": { "sherpa-ui": "/node_modules/sherpa-ui/dist/index.js" } }
  </script>
  <link rel="stylesheet" href="/node_modules/sherpa-ui/dist/styles/tokens/tokens.css">
  <link rel="stylesheet" href="/node_modules/sherpa-ui/dist/styles/tokens/page.css">
</head>
```

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
      <sherpa-filter-panel slot="panel-start" id="filter-panel" data-scope="view data"></sherpa-filter-panel>
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
- The View chip is the header bar with `data-type="view"`: it picks the
  Context's Views, and the URL follows.

## 3. `app.json`

```json
{
  "$schema": "./node_modules/sherpa-ui/schemas/app.v1.json",
  "v": 1,
  "product": { "name": "My product", "icon": "group" },
  "default": "dashboard",
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
- `chrome.header: false` takes the app header away while it is open.
- `checkApp(app)` reports every broken name. `T-an-app-is-its-definition`

## 4. Stores

```js
import { localRecords, rules, required, email, oneOf } from 'sherpa-ui';

export const { store: customerStore, ready: customersReady } = localRecords({
  name: 'customers', database: 'my-app', key: 'email',
  schema: rules({ email: [required(), email()], status: oneOf(['active', 'trial', 'churned']) }),
  indexes: ['status'], version: 1,
  seed: customers, seedVersion: 1,
});
```

- `localRecords()` is IndexedDB where the browser has it, and memory where
  not. It seeds a first run, and again when `seedVersion` moves.
  `T-local-records-seed-themselves`
- A server's records are a `RestStore`; the same filter grammar reaches it.
  `docs/DATA-SOURCE-RULES.md`
- **The schema says what a field may hold.** `oneOf([...])` is the list every
  filter offers, in its order. `T-the-data-says-what-a-field-may-hold`
- Import a store by ONE URL everywhere. A file the server maps to two paths
  is two modules, and two stores.

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
      "data": { "label": "Records", "offers": "all", "holds": ["status"], "presets": ["has-tickets"] }
    },
    "presets": { "has-tickets": { "label": "Has open tickets", "where": { "openTickets": { "gt": 0 } } } }
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

## 7. A Context module

```js
export async function init(root, { source, session, view, signal, header, panels, label }) {
  root.querySelector('#add').addEventListener('click', () => openForm(source.store), { signal });
  await header?.populate({ breadcrumb: [] });
}
```

- Every Context, Settings page and panel gets the same `ctx`. `source` is the
  page's, when it has a definition. `signal` aborts when it goes; or return a
  teardown.
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

- A View is JSON: each scope's `where`, `holds`, `presets`, `sort`, `group`.
  The first View is the Context's own; the URL leaves it out.
  `T-a-view-is-json`
- A View's own cards are markup, in a template beside the JSON.
  `T-a-views-markup-lives-in-a-template`
- A reader's own Views: `provider.saveView(name)`, `provider.deleteView()`.
  A draft per View is kept: `T-a-view-keeps-a-draft`.

## 9. The session

```js
import { SessionStore } from 'sherpa-ui';

const session = new SessionStore({
  theme: { mode: 'auto' },
  nav: { pinned: false, favorites: [], recent: [], hierarchy: false },
  filters: { mode: 'toolbars', drafts: true, draftsAcross: true },
});
session.persist('/theme/mode');
session.persist('/nav/pinned');
```

- What outlives a Context lives here, by pointer. `persist()` keeps one
  across reloads; with no guard, the default's type is the guard.
  `T-session-persist-defaults-shared`
- A control bound to a pointer says so in its markup — the outlet binds it:
  `<sherpa-switch data-setting="/nav/hierarchy">`. `T-a-setting-is-a-pointer`

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
  const label = await named.prompt(provider.savedFilters?.label ?? '');
  if (label) provider.saveFilters(label);
};
provider.addEventListener('filters-save', () => (provider.savedFilters ? provider.saveFilters() : saveAs()));
provider.addEventListener('filters-save-as', saveAs);
provider.addEventListener('filters-delete', () => provider.deleteFilters());
```

- `dialog.prompt(value)` and `dialog.confirm({ heading, words, action })` ask
  the question the dialog's own markup holds. `T-a-dialog-answers-its-question`
- A dialog or an overlay panel that only opens and shuts needs no script:
  `<sherpa-button commandfor="edit" command="--show">Edit</sherpa-button>`, and
  `command="--hide"` on a button inside it. `T-a-button-commands-by-markup`
- **Save filters** keeps EVERY scope's filters under one name, with the page
  beside its Views. The Filters menu's Saved section applies one; the Saved
  chip names it, and its cross puts the filters back. Ask before you save over
  a name that exists. `T-saved-filters-are-every-scope`

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
  drafts: () => 'always',
  panels: { filters: document.getElementById('filter-panel') },
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
