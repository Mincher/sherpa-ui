# Sherpa stock-take — 2026-10-19

A snapshot: what is done, what is still to do, and how Sherpa works with the
rest of a tech stack. It is dated, so it goes stale. The live list of work is
[docs/TODO.md](../TODO.md).

**Updated after TODO 344** (markup, default variants and text come from the
`.html` and `.css`), with a new part: how an app, a View and a component are
made at run time.

---

## Where we are

- **Done:** 310 TODO items (344 is the newest).
- **Open:** 27 items. 7 are in progress, 16 are not started, and 4 wait for Will's answer. New since the first stock-take: 345 to 349.
- **Size:** 66 components, 14 checks before each commit, about 1,360 commits since 1 September.

```mermaid
pie showData title TODO items
  "Done" : 310
  "In progress" : 7
  "Not started" : 16
  "Waits for Will" : 4
```

---

## What is done

| Area | Main results |
|---|---|
| Components | 66 components. Each has a spec, which is its full contract, and an example. They fetch nothing: the build puts the HTML and CSS text inside the JS. Shared logic is in the `SherpaElement` base class. |
| Markup out of TS (344) | A component's markup, default variants and fixed words live in its `.html` and `.css`, never in TS. The base class gives five ways to do that — see "How a UI component is made" below. |
| Tokens and Figma | Figma variables become 8 CSS layers. Components use the same Style names as Figma. There is one Button look, which a native `<button>` can use too. |
| Data layer | `sherpa-ui/data` has no DOM, so it also runs on a server. A remote source reads its whole data set once, so a toggle, a sort or a group makes no server request (345 explores fetching each field's values on demand instead). A gate counts what each click costs. |
| App layer | Provider, router, outlet, session, saved Views, drafts and favourites. One `app.json` defines the whole app. |
| Filters | Simple and Advanced modes, filter sets, Save filters, Reset and "Return to X". Each chip shows a count. The data bar has a Switch, hidden by default. |
| Accessibility | An axe check on every component (WCAG 2.1 AA), with no known failures. Tabs, charts and radios are one tab stop each. |
| Tooling | 14 checks before each commit. The component reference, `custom-elements.json` and the VS Code data are made from the specs. Each import's size is checked. |
| MCP server | `sherpa-ui-mcp` has 19 tools and the guides, and can drive a live page. |
| Other projects | Sherpa Demos (the example app), Sherpa Gallery (stories) and Sherpa Starter (`create-sherpa-ui`). |

---

## What is still to do

### Your decision (it waits for you)

| Item | The question | My pick |
|---|---|---|
| 305 | Should a grid column's menu follow "Hide unmatching filters"? | A: yes |
| 319 | A saved filter keeps the caller's object, so the caller can change it. | A: copy it when it comes in |
| 321 | Saved Views use two keys: the Context's name and the page's id. | A: one key (Views saved under the old key are then not found) |
| 327 | There is no LICENSE file. | Need the copyright holder and the year |
| 338 | Two choices for the Switch: 1, while it is off, the chips are grey and do not work. 2, the panel turns the Switch back on. | Both are built as written |
| 293 | Cut CLAUDE.md (now 839 lines) down, or keep it. Remove the old `generate-sherpa-component` skill, or not. | — |
| 339 | Clean up the Figma file, or leave it. | — |
| 290 | Rename `spoofRemote` to `fakeRemote`? | — |
| Look by eye | 323 (sparkline gaps), 313 (panel footer), 324 (app header), 340 (toggles feel instant on `?remote`). | — |

### Needs a test run you allow

- **Data layer:** 287 step 5b, 288 steps 8b–10, 291 steps 7–8.
- **Filter family:** 302 (remove the frame waits), 311 (`clone()` everywhere), 320.
- **Keyboard:** 315 (calendar keys), 318 (arrow keys on 3 toolbars).
- **Button:** 4 hand-made copies of the Button look move to the shared class.

### Later or large (your word first)

- **170:** the data layer on the client, the server, or both.
- **223:** server rendering.
- **76:** WebMCP.
- **77:** UX patterns as a contract.
- **78:** node components.
- **341:** component words out of the data layer. This one can be measured and planned now.

### Next, from Will's notes on 2026-10-19

- **345:** fetch each field's values on demand, and cache them, instead of the whole set. A History table of field bitmaps says what changed; it starts again each session. Plan with Will first.
- **346:** one "Send to <component>" on a View field.
- **347:** the View scope first; a component scope only within its subset.
- **348 and 349:** a chip's count, and a menu's viable fields and values, from that subset: its scopes and the filters before it.

### New: found by reading on 2026-10-19, not in the TODO yet

1. The outlet puts Context markup in with a plain `innerHTML`. Under a strict Trusted Types policy (CSP), that will stop the page.
2. If one Context's views file is missing, every Context fails to load, and nothing reports it.
3. The Starter template asks npm for `sherpa-ui@^2.1.0-beta.0`. On npm, that name is another person's package.
4. `RestStore` loses headers that come as a `Headers` object. It also cannot cancel a request.
5. Plan items with no TODO row:
   - prompt-composer sets its height in JS.
   - 3 component sheets still read the old `--_status-*` names.
   - (Fixed in 344: the toast stack's inline styles are now a CSS sheet. It is still `z-index: 1000`, not a popover.)
6. Doc clean-up: about 20 sections still say "Not run yet", and 2 headings do not agree with the ledger.

---

## How Sherpa works

### 1. The layers, and where they touch the rest of the stack

Purple boxes are Sherpa. Green boxes are outside Sherpa. The red box is a gap:
Sherpa has no auth.

```mermaid
flowchart TB
  subgraph Browser["In the browser"]
    App["Your app files<br/>index.html · app.json · templates<br/>page definitions · views · contexts/*.js"]
    Util["Utility<br/>sherpa-router → sherpa-outlet"]
    AppL["App layer — sherpa-ui/app, opt-in<br/>sherpa-provider · SessionStore · Views · drafts"]
    Comp["Components — sherpa-ui/components<br/>66 × sherpa-*"]
    Data["Data layer — sherpa-ui/data, no DOM<br/>DataSource · Query · HeldSet · validate"]
    Local["ArrayStore · LocalStore · IdbStore"]
    Remote["JsonStore · RestStore"]
    Live["EventStore (SSE) · SocketStore (WebSocket)"]
    App --> Util --> AppL --> Comp --> Data
    Data --> Local
    Data --> Remote
    Data --> Live
  end

  Web[("Web server")]:::ext
  URL["URL<br/>Navigation API"]:::ext
  Storage[("Browser storage<br/>localStorage · sessionStorage · IndexedDB")]:::ext
  Backend[("Backend<br/>HTTP · SSE · WebSocket")]:::ext
  Auth["Auth: NONE in Sherpa<br/>the app supplies headers or cookies"]:::warn
  Figma["Figma → tokens.css"]:::ext
  Agents["AI agents"]:::ext
  MCP["sherpa-ui-mcp<br/>stdio"]

  Web --> App
  Util <--> URL
  AppL <--> Storage
  Local <--> Storage
  Remote <--> Backend
  Live <--> Backend
  Auth -.-> Remote
  Figma --> Comp
  Agents <--> MCP
  MCP -. "runs the real data layer" .-> Data

  class Util,AppL,Comp,Data,Local,Remote,Live,MCP sherpa
  class App app
  classDef sherpa fill:#f3e5fb,stroke:#8e24aa,color:#0c0b11
  classDef app fill:#ffffff,stroke:#5c5c66,color:#0c0b11
  classDef ext fill:#e3f4e8,stroke:#2e7d32,color:#0c0b11
  classDef warn fill:#fde8e8,stroke:#c0392b,color:#0c0b11
  style Browser fill:#fafafa,stroke:#b3b3c3
```

Not in the page: the `sherpa-ui` CLI (`serve`, `check-usage`), and Node code
that imports `sherpa-ui/data` on a server.

### 2. A page opens (the read flow)

```mermaid
sequenceDiagram
  actor R as Reader
  participant Router as sherpa-router
  participant Outlet as sherpa-outlet
  participant C as Components
  participant P as sherpa-provider
  participant DS as DataSource
  participant S as Store
  participant B as Backend

  R->>Router: clicks a nav row
  Router->>Outlet: route-change
  Outlet->>Outlet: fetch the template, put it in the page
  C->>P: ask (context-request event)
  Outlet->>P: open(page definition)
  P->>DS: openSource() makes a DataSource
  opt A remote store
    DS->>S: read the whole set once
    S->>B: GET
    B-->>S: all rows and the total
    Note over P: the cards show loading after 300 ms
  end
  P->>DS: bindSource() for each ask
  DS->>DS: load()
  alt The whole set is held
    DS->>DS: answer in the browser, no request
  else Not held
    DS->>S: store.load()
    S->>B: GET with the filter
    B-->>S: one page of rows
  end
  DS-->>C: populate()
  C->>C: draw the rows
```

### 3. A reader changes a filter

```mermaid
flowchart TD
  A["Reader ticks a chip value"] -->|quick-filter-change| B["Toolbar"]
  B --> C["bindSource"]
  C --> D["DataSource.answerScope()"]
  D --> E["The Query changes<br/>a remote source keeps a draft until Apply"]
  E --> F["compile() makes one Filter"]
  F --> G{"Is the whole set held?"}
  G -->|yes| H["Answered in the browser<br/>0 server requests"]
  G -->|no| I["store.load()"]
  I --> J[("Backend<br/>GET with the filter")]:::ext
  H --> K["Every bound part redraws<br/>the chip counts update"]
  J --> K
  K --> L[("SessionStore keeps the Query")]:::ext

  classDef ext fill:#e3f4e8,stroke:#2e7d32,color:#0c0b11
```

Today the check reads "Is the whole set held?" (TODO 340). TODO 345 makes it a
series of checks. That is the next diagram.

### 3b. Planned (TODO 345): fast or current

Will, 2026-10-19: *"It's not just a binary scenario but a series of
considerations on when to be performant versus current in working with data."*
Not built yet.

```mermaid
flowchart TD
  F["compile() makes one Filter"] --> Q{"Can the query be fulfilled<br/>with held data?"}
  Q -->|no| R1{"Is the store reachable?"}
  R1 -->|yes| Fetch["Fetch only the fields and values<br/>the query needs"]
  R1 -->|no| Err["Empty state or error UI<br/>shows the last data held"]
  Q -->|yes| C{"Has any field the query uses<br/>changed in the store since it was held?"}
  C -->|no| Local["Answer in the browser<br/>0 server requests"]
  C -->|yes| R2{"Is the store reachable?"}
  R2 -->|yes| Fetch
  R2 -->|"no: offline or timed out"| Stale["Answer in the browser<br/>from the held data"]
  Fetch --> S[("Store")]:::ext
  S --> Hold["Hold the new data<br/>in the client cache"]
  Hold --> Draw["Every bound part redraws"]
  Local --> Draw
  Stale --> Draw

  classDef ext fill:#e3f4e8,stroke:#2e7d32,color:#0c0b11
```

Open questions in 345: what the cache keys on, and how the reader sees that an
answer came from held data. For "has a field changed?", Will's sketch: the
store keeps a History table (a delta time and a bitmap of the changed fields
per update), and the data layer compares it with the session start and View
update times. See TODO 345.

### 4. A write (add, edit, delete)

```mermaid
sequenceDiagram
  participant M as Context module (your code)
  participant S as Store
  participant B as Backend
  participant DS as DataSource
  participant C as Components

  M->>S: insert, update or remove
  S->>B: POST, PATCH or DELETE
  B-->>S: the saved row
  S-->>DS: change event
  DS->>DS: read again
  DS-->>C: every bound part redraws
```

### 5. Style

```mermaid
flowchart LR
  F["Figma variables"]:::ext -->|manual export| J["figma.tokens.json<br/>and figma.extensions.json"]
  J --> P["scripts/project-tokens.mjs"]
  P --> T["tokens.css, 8 layers<br/>and the shared sheets"]
  T --> Pg["The page links<br/>tokens.css and page.css"]
  T --> SR["Each shadow root adopts the shared sheets,<br/>then its own CSS"]
  SR --> St["data-status or data-look on a parent<br/>changes the colours"]

  classDef ext fill:#e3f4e8,stroke:#2e7d32,color:#0c0b11
```

### 6. Where an app plugs in auth

Sherpa has no auth. An app picks one of these four.

```mermaid
flowchart LR
  subgraph Choose["Your app chooses one"]
    A1["Cookies<br/>init.credentials = 'include'"]
    A2["A fixed header<br/>init.headers, a plain object"]
    A3["A custom Store<br/>that signs each request"]
    A4["A wrapped fetch"]
  end
  A1 --> RS["RestStore or JsonStore"]
  A2 --> RS
  A4 --> RS
  A3 --> CS["Custom Store<br/>extends BaseStore"]
  RS --> B[("Backend")]:::ext
  CS --> B
  B -->|401 or 403| E["HttpError.status<br/>the card shows the error"]

  classDef ext fill:#e3f4e8,stroke:#2e7d32,color:#0c0b11
```

---

## How each part is made at run time

Added after TODO 344. Each part was drafted by one agent and checked against the
code by a second. Worked examples come from Sherpa Demos.

### 7. The kinds of file, and how they work together

Every file is one of six kinds. The colours are the same in every diagram below.

| Kind | What it is | Examples | Written by | Read by, and when |
|---|---|---|---|---|
| **DEFINITION** (JSON) 🟨 | Data that sets something up | `app.json`; a page definition (`view-schemas/records.json`); a Views file (`views/records-views.json`); a component's `.example.json` | a person | `app.json` and every Views file: once, when the app starts. A page definition: each time its Context opens. An example: only tools and the Gallery. |
| **SCHEMA** (JSON) ⬜ | Checks the SHAPE of a definition or a contract | `schemas/app.v1.json`, `page.v1.json`, `component.v1.json`, `example.v1.json` | sherpa-ui | The editor, the MCP and the tests. **Never the browser.** At run time `checkApp()` checks only the NAMES, and reports a problem. |
| **CONTRACT** (JSON) 🟨 | What a component is, made from its code | `sherpa-x.component.json`; `custom-elements.json`; `docs/components/` | the spec generator, never a person | The commit checks, the MCP, editors and the Gallery. **No app reads it.** |
| **TEMPLATE** (HTML) 🟩 | Markup that is stamped or cloned | A component's `.html`; a Context's `templates/records.html`; a family file (`src/core/sherpa-filter-menu.html`); a View's own markup (`views/dashboard-views.html`) | a person | A component's: put inside its JS at build time, stamped by the base class. A Context's: each time it opens, into the outlet. |
| **SHEET** (CSS) 🟦 | Styles | `tokens.css` and `page.css` (the page links them); shared, family and own sheets (adopted into each shadow root); a page sheet (`sherpa-toast-stack.css`) | Figma (through `project-tokens.mjs`) and a person | `tokens.css` and `page.css`: at page load. The rest: inside the JS, adopted when an element first connects. |
| **CODE** (JS/TS) 🟪 | Behaviour | a component's `.ts`; a Context's module (`contexts/records.js`); the stores | a person | sherpa-ui: at page load. A Context's module: each time it opens. |

**Where the text of a component lives, after 344.** The TS holds behaviour only.
Everything you can see or read is in the `.html` or `.css`, and the base class
carries it:

| You want | Write it in the markup as | The base class |
|---|---|---|
| A default variant | the bare `:host`, or `:host(:not([data-x]))`, in the `.css` | writes nothing |
| A prop's default text | the text inside its `to` target, in the `.html` | writes it back whenever the attribute is absent |
| A label that follows state (Expand/Collapse) | `data-swap-on="data-collapsed" data-swap-aria-label="Expand"` | applies the swap on each change |
| A word the code hands on as data ("Presets") | `<template class="words"><span data-word="presets">Presets</span></template>` | `this.word('presets')` reads it |
| One item per data row | a `<template class="row-tpl">` prototype | `clone()`, `renderItems()` copy it |
| Markup a shared helper needs | a family file, listed first in `static html` | stamps it after the component's own body |
| Styles for what it puts in the PAGE | a page sheet, named by `static pageCss` | adopts it into the document |

### 8. How an app is made

How the files relate:

```mermaid
flowchart TD
  subgraph made["Made before run time, by npm run build"]
    tok["tokens.css + page.css<br/>project-tokens.mjs, from Figma"]
    dist["dist/index.js + dist/data.js<br/>each component's .html and .css inside its JS"]
    schemas["schemas/app.v1.json<br/>schemas/page.v1.json"]
  end
  server["server/index.mjs"]
  check["checkApp()<br/>app-definition.ts, no DOM"]
  subgraph folder["The app folder, written by a person"]
    idx["index.html<br/>the frame + the boot script"]
    imap["import map<br/>sherpa-ui = /dist/index.js"]
    appjson["app.json<br/>Contexts, Sections, Settings pages"]
    stores["stores/records-data.js<br/>stores/dashboard-data.js"]
    tpl["templates/records.html<br/>the Context's markup"]
    def["view-schemas/records.json<br/>page definition"]
    views["views/records-views.json<br/>the Context's Views"]
    vtpl["views/dashboard-views.html<br/>a View's markup, by template id"]
    mod["contexts/records.js<br/>init(root, ctx)"]
    settpl["templates/application.html<br/>data-setting pointers"]
  end
  subgraph page["In the page, at run time"]
    session["SessionStore<br/>persist() to localStorage"]
    outlet["sherpa-outlet<br/>start() and load()"]
    nav["OutletNav<br/>fills sherpa-nav"]
    router["sherpa-router<br/>owns the URL"]
    provider["sherpa-provider<br/>open() and provide()"]
  end

  server -->|"serves /, /dist, the app files"| idx
  server -->|"at boot"| check
  outlet -->|"first step of start()"| check
  check -.->|"checks the names"| appjson
  schemas -.->|"checks the shape: editor and tests only"| appjson
  schemas -.->|"page.v1.json checks the shape"| def
  idx -->|"link"| tok
  idx --> imap
  imap -->|"resolves sherpa-ui"| dist
  dist -->|"defines every sherpa-* tag"| outlet
  idx -->|"its View chip bar and filter panel ask"| provider
  idx -->|"boot script imports"| stores
  idx -->|"boot script makes"| session
  idx -->|"boot script calls start()"| outlet
  stores -->|"stores() and ready, given to start()"| outlet
  outlet -->|"start(app) reads"| appjson
  outlet -->|"listens to route-change"| router
  outlet -->|"keeps"| nav
  appjson -->|"template"| tpl
  appjson -->|"definition"| def
  appjson -->|"views"| views
  appjson -->|"module"| mod
  appjson -->|"settings.pages"| settpl
  views -->|"template: file and id"| vtpl
  outlet -->|"open(definition, stores())"| provider
  def -->|"openSource() makes the DataSource"| provider
  tpl -->|"its components ask, context-request"| provider
  settpl -->|"bindSettings"| session

  classDef json fill:#fff4d6,color:#0c0b11
  classDef html fill:#e3f4e8,color:#0c0b11
  classDef css fill:#e8eefc,color:#0c0b11
  classDef js fill:#f3e5fb,color:#0c0b11
  classDef schema fill:#f0f0f0,color:#0c0b11
  class appjson,def,views,imap json
  class idx,tpl,vtpl,settpl html
  class tok css
  class dist,stores,mod,server,check,session,outlet,nav,router,provider js
  class schemas schema
```

The order, from a page load to the first Context on screen:

```mermaid
sequenceDiagram
  autonumber
  participant B as Browser
  participant Sv as server/index.mjs
  participant P as index.html script
  participant O as sherpa-outlet
  participant N as OutletNav
  participant R as sherpa-router
  participant Pr as sherpa-provider
  participant M as contexts/records.js

  Note over Sv: At boot it imports app.json and runs checkApp()
  B->>Sv: GET /?context=records
  Sv-->>B: app/index.html
  B->>Sv: GET tokens.css and page.css (link tags)
  Note over B: No Sherpa tag is defined yet. page.css shows a skeleton after 300 ms
  P->>Sv: import sherpa-ui, the import map gives /dist/index.js
  Note over B: Each component defines its tag, its .html and .css text<br/>already inside its JS. The frame's tags upgrade
  P->>Sv: import app.json as a JSON module, and the store files
  P->>P: checkApp(app.json), then new SessionStore(defaults) and persist()
  P->>O: start(app, base, session, stores, ready, drafts, panels, settings)
  O->>O: checkApp again. It stops here if a name is broken
  O->>R: data-params becomes context=dashboard view, listen to route-change
  O->>Sv: fetch every Views file with loadViewLibrary, not awaited
  B->>Pr: the View chip bar and the filter panel send context-request, and wait
  O->>N: nav.populate - Home, Recent, Favorites, the Sections, the Settings rows
  O->>Sv: fetch templates/records.html, after the Views are in
  O->>B: the header's heading and icon from app.json, then outlet.innerHTML
  B->>Pr: each data component in the Context sends context-request, and waits
  O->>Sv: import contexts/records.js, then fetch view-schemas/records.json
  O->>O: await ready, so the store is seeded
  O->>Pr: open(definition, stores(), the Views, the view, session, drafts)
  Pr->>Pr: openSource makes the DataSource, draws the bars, sets each ui entry by id
  Pr-->>B: provide() answers every waiting request, then puts on the kept Query or the View
  O->>M: init(outlet, ctx) with session, view, source, header, panels, signal
  O->>O: bindSettings, pick the URL's View, then a ?settings= page opens over the Context
```

On purpose, though it looks odd:

- **`checkApp()` runs three times** (server boot, the boot script, `start()`), and the JSON Schema never runs in the browser. `checkApp()` checks names; the schema checks shape, in the editor and the tests.
- **The markup has no default Context and no header title.** `start()` writes the default Context from `app.json`, and the outlet writes the header from each Context's `label` and `icon`.
- **`stores` is a function.** The outlet calls it at each load, so a debug flag can wrap a store. It waits for `ready` just before `open()`, because `openSource()` reads the store's rows.
- **A Context's markup goes into the outlet's light DOM**, not a shadow root, so each component's ask reaches the provider above it.

### 9. How a Context page and a View are made

A Context opens (the reader picks the Records row):

```mermaid
sequenceDiagram
  autonumber
  actor Reader
  participant Router as sherpa-router
  participant Outlet as sherpa-outlet
  participant Files as App files on the server
  participant Comps as Components in the Context
  participant Provider as sherpa-provider
  participant Source as DataSource
  participant Module as contexts/records.js

  Reader->>Router: presses a nav row, a link to ?context=records
  Router->>Outlet: route-change with route, changed and waitUntil
  Outlet->>Provider: the old Context's teardown runs, then close()
  Outlet->>Files: fetch templates/records.html as text
  Outlet->>Comps: innerHTML into its own light DOM
  Note over Comps: Each upgrades and stamps its shadow DOM from its .html and .css
  Comps-->>Provider: context-request, after the first render - no source yet, so it waits
  Outlet->>Files: import contexts/records.js, fetch view-schemas/records.json
  Outlet->>Provider: open(definition, stores, Views, the URL's view, session, drafts)
  Provider->>Source: openSource(definition.source, the customers store)
  par at the same time
    Provider->>Comps: drawBars() - each bar from source.describe(scope), the View chip first
  and
    Provider->>Comps: configure(definition.ui) - applyState() sets the grid's key, columns, actions
  end
  Provider->>Comps: provide() - watch each card's state, then bindSource() answers every ask
  Provider->>Source: setQuery() with the kept Query, else a draft, else the View's own query
  Source-->>Comps: rows, groups and summaries through populate(), on each load
  Outlet->>Module: init(root, ctx)
  Module-->>Outlet: a teardown function
```

Which JSON field drives what, for a View:

```mermaid
flowchart TB
  subgraph SHIPPED["Files the app ships - a person writes them"]
    APP["app.json<br/>contexts.records"]
    TPL["templates/records.html, dashboard.html<br/>each Context's markup"]
    DEF["view-schemas/records.json<br/>the page definition"]
    VJ["views/records-views.json<br/>the shipped Views"]
    VT["views/dashboard-views.html<br/>a View's own template"]
    MOD["contexts/records.js<br/>the Context's module"]
  end
  subgraph KEPT["Kept in the browser - Sherpa writes them"]
    SAVED["sherpa:views:records<br/>the reader's saved Views"]
    DRAFT["sherpa:drafts:records<br/>one draft per View"]
    KQ["SessionStore /filters/records<br/>the View and Query on screen"]
  end
  subgraph RUN["Run time"]
    LIB["ViewLibrary<br/>loadViewLibrary()"]
    SRC["DataSource<br/>openSource()"]
    BARS["Filter bars and the View chip<br/>drawBars()"]
    CFG["Components, by id<br/>applyState()"]
    REG["data-view-content region<br/>parseViewMarkup()"]
  end

  APP -- "template" --> TPL
  APP -- "definition" --> DEF
  APP -- "views, read once at start" --> VJ
  APP -- "module" --> MOD
  DEF -- "source: store, fields, presets, scopes" --> SRC
  DEF -- "ui.grid: key, columns, actions" --> CFG
  TPL -- "id, data-scope, data-aggregate" --> CFG
  TPL -- "data-view-content" --> REG
  VJ --> LIB
  VT -- "template fills content" --> LIB
  SAVED -- "after the shipped ones" --> LIB
  LIB -- "label" --> BARS
  BARS -. "a pick" .-> LIB
  LIB -- "query" --> SRC
  LIB -- "ui" --> CFG
  LIB -- "content, through an allow-list" --> REG
  DRAFT -- "query, if it still fits" --> SRC
  KQ -- "query, on its own View only" --> SRC
  SRC -- "describe(scope)" --> BARS
  SRC -. "kept each frame" .-> KQ
  SRC -. "the reader's edits" .-> DRAFT
  BARS -- "view-save, the app calls saveView()" --> SAVED
  SRC -- "rows, groups, summaries" --> CFG
  MOD -- "uses ctx.source" --> SRC

  classDef json fill:#fff4d6,color:#0c0b11
  classDef html fill:#e3f4e8,color:#0c0b11
  classDef js fill:#f3e5fb,color:#0c0b11
  class APP,DEF,VJ,SAVED,DRAFT,KQ json
  class TPL,VT,REG html
  class MOD,LIB,SRC,BARS,CFG js
```

What each field does:

- **Page definition, `source`:** `store` picks the store. `fields` declares each field's type and label; no field lists its values, they are read from the rows. `presets` are saved filters. `scopes` go to the SOURCE, which draws each bar.
- **Page definition, `ui.<id>`:** sets that element through its own API (the grid's `columns`), before it gets data.
- **Page definition, `id`:** names the source and every storage key for the page.
- **A View's `label`:** the View chip's option, and its nav row when "Show full view hierarchy" is on.
- **A View's `query`:** what the source puts on when the View is picked (a draft wins if it still fits).
- **A View's `ui` and `content`:** set elements by id, and fill `[data-view-content]` through an allow-list.

On purpose, though it looks odd:

- **A Context's markup goes in with plain `innerHTML`, but a View's goes through an allow-list.** The template ships with the app; a View's content can come from storage or a server.
- **The first View's own query is not put on at open: the page definition IS the first View.** A kept Query or a draft can still go on it.
- **The View chip owns the View, not the URL.** A pick goes to the URL by `replace`, so Back does not step through picks.
- **Known gap (TODO 321):** the outlet reads saved Views under the Context's name, the provider writes them under the definition's `id`. Equal in Demos, but nothing makes them equal.

### 10. How a UI component is made

At build time — how its files relate:

```mermaid
flowchart LR
  FIG["Figma<br/>variables and components"]
  FT["figma.tokens.json<br/>the Figma export"]
  FE["figma.extensions.json<br/>override collections, hand-patched"]
  SP["state-pins.yaml<br/>a state is a Style pin"]
  PT["project-tokens.mjs"]
  TOK["tokens.css + page.css"]
  SH["shared sheets<br/>sherpa-base.css ... sherpa-motion.css"]
  FAM["family files<br/>chart and container sheets, the filter menus' markup"]
  CSS["sherpa-x.css<br/>sherpa:tokens part + authored part"]
  HTML["sherpa-x.html<br/>variants, prototypes, words, swaps, slots"]
  TS["sherpa-x.ts<br/>class, static props, css and html URLs, asks"]
  GEN["generate-component-spec.mjs"]
  SCH["schemas/component.v1.json"]
  SPEC["sherpa-x.component.json<br/>the contract"]
  EX["sherpa-x.example.json"]
  MAN["custom-elements.json<br/>vscode.html-data.json, docs/components"]
  MCP["MCP server, a11y gate, Gallery"]
  BLD["build-reforged.mjs<br/>tsc, PostCSS, inline the text, minify"]
  DIST["dist/components/sherpa-x/sherpa-x.js<br/>the class, with its html and css text inside"]

  FIG --> FT
  FIG -.->|"read live, patched by hand"| FE
  FT --> PT
  FE --> PT
  SP --> PT
  PT --> TOK
  PT -->|"writes 3 of them"| SH
  PT -->|"rewrites the sherpa:tokens part"| CSS
  TS --> GEN
  HTML --> GEN
  CSS -->|"authored part only"| GEN
  GEN --> SPEC
  SCH -->|"checks"| SPEC
  SPEC --> MAN
  SPEC --> MCP
  EX --> MCP
  TS --> BLD
  HTML --> BLD
  CSS --> BLD
  FAM --> BLD
  SH --> BLD
  BLD --> DIST

  classDef json fill:#fff4d6,color:#0c0b11
  classDef html fill:#e3f4e8,color:#0c0b11
  classDef css fill:#e8eefc,color:#0c0b11
  classDef js fill:#f3e5fb,color:#0c0b11
  classDef schema fill:#f0f0f0,color:#0c0b11
  class FT,FE,SP,SPEC,EX,MAN json
  class HTML html
  class CSS,SH,TOK css
  class TS,PT,GEN,BLD,DIST,MCP js
  class FAM html
  class SCH schema
```

In an app, only `DIST`, `tokens.css` and `page.css` reach the browser. The
shared, family and own sheets travel inside the JS.

At run time — how one element is drawn (`sherpa-metric`, a data tile; the
button stops at step 15):

```mermaid
sequenceDiagram
  autonumber
  participant Page as Page markup and import
  participant El as SherpaElement base class
  participant Tpl as templater.ts
  participant SR as Shadow root and its CSS
  participant Sub as SherpaMetric
  participant Prov as sherpa-provider
  participant Src as bindSource and DataSource

  Page->>El: import sherpa-metric.js - its html and css text go into the templater
  El->>El: define('sherpa-metric') - observedAttributes from static props
  Page->>El: a sherpa-metric tag is made, by the parser or a clone
  El->>El: constructor attaches the shadow root, connectedCallback starts bootstrap
  El->>Tpl: filesFor(tag) - its family files, its own, or a useTemplate() override
  par styles
    El->>Tpl: loadSheets - shared, family, own
    El->>SR: adoptedStyleSheets - shared first, its own last
  and markup
    El->>Tpl: loadTemplates - the inlined text, split by template id
  and page sheet
    El->>Tpl: adoptPageSheet, only if it names static pageCss
  end
  El->>SR: stamp - its own body, then each family file's body, under Trusted Types
  El->>SR: readOwn and readSwaps - each prop's default text, each swap
  El->>SR: write each content prop, apply the swaps, draw the icons
  El->>Sub: onRender()
  El->>SR: a has-name custom state for each filled slot
  El->>Sub: rendered resolves, then onConnect()
  El->>Prov: ask - context-request, bubbles and composed
  Prov->>Src: bindSource(source, el, all rows, as a summary)
  Src-->>Sub: populate(data) - value, values and delta
  Sub->>El: set data-value, data-delta, data-trend, data-status
  El->>SR: each change writes its content prop and applies its swaps
  Note over SR: CSS selects data-* and :state(). A data-status pin re-points<br/>the public Style names, which inherit into every shadow root
```

On purpose, though it looks odd:

- **The source says `new URL('./sherpa-x.html', import.meta.url)`, but a built page fetches nothing.** The build puts the text inside the JS. A dev build keeps the fetch, so live reload works.
- **The `Public API:` and `Fires:` comments, and every `data-accepts`, are only for the spec.** The build strips them; no app reads the spec or the example.
- **Most `static props` do nothing at run time.** Only a `content` prop with a `to` target is written, and its default is the template's own text. The rest are declared so the contract knows them.
- **A prototype is a `<template class>` with no `id`.** Only a top-level `<template id>` is a variant.
- **A family file's markup is stamped into every member's root**, so a shared helper (`menuFor()`, the ⋮ menu) clones from the host it works for.

---

## Where you must plug things in

| Part | What Sherpa gives | What your app gives | Gap |
|---|---|---|---|
| **Backend (REST)** | `RestStore` options: `url`, `rowsPath`, `totalPath`, `init`, `timeout`, `buildQuery`. Writes use POST, PATCH and DELETE. | The endpoint. A server that reads Sherpa's filter parameters, or a `buildQuery` that translates them. A `totalPath`, so the whole set can be held. | No retry, no cancel. No GraphQL store, no polling. |
| **Backend (live)** | `EventStore` (SSE, it only receives). `SocketStore` (WebSocket, you call `send()`). | The endpoints, and a call to `connect()`. | Nothing shows "reconnecting". |
| **Other backend** | The `Store` interface, or `BaseStore` to extend. | All of it, auth too. | — |
| **Auth** ⚠ | **None.** Only fixed settings: `init` (headers, `credentials`), `withCredentials`, WebSocket `protocols`. | Cookies, a fixed header, a custom store that signs each request, or a wrapped `fetch`. Handle a 401 from `HttpError.status`. | No token hook, no refresh, no 401 handler. A `Headers` object is dropped. |
| **User and permissions** ⚠ | **None.** | Who the user is, and what they may do. Row security on the server: the held set is all that the server sends. | — |
| **Browser storage** | `SessionStore` (`sherpa:session:*`), saved Views, filters, drafts, `IdbStore`. | Which values to `persist()`. | Saved Views stay on one browser. `syncViews` exists, but nothing uses it. |
| **URL** | `sherpa-router` (Navigation API). | The parameter names. A server that serves `?context=` URLs. | — |
| **App files** | The outlet fetches the templates, definitions and views. | The files and a web server. | It sends no credentials. One missing views file stops every Context. |
| **Forms** | The form controls take part in a native `<form>`. The `.sherpa-button` look works on a native submit button. | The form action or a submit handler. | File upload sends nothing by itself. |
| **Security** | A strict CSP and Trusted Types policies. | A CSP header that names `sherpa-ui` and `sherpa-ui-view`. | The outlet's `innerHTML` does not use the policy. |
| **Design** | Figma becomes `tokens.css`. | Links to `tokens.css` and `page.css`, and the Inter font. | The Figma export is manual. Clean-up is TODO 339. |
| **AI agents** | `sherpa-ui-mcp`: 19 tools, over stdio. | The MCP client settings. | stdio only, no HTTP. |
| **Server / Node** | `sherpa-ui/data` runs in Node. Components load but define nothing there. | Node 22 or later. | No server rendering (TODO 223). |
| **Getting Sherpa** | A link to the repo: `"sherpa-ui": "file:../sherpa-ui"`. | A clone, a build, and an import map or a bundler. | It is not on npm. The Starter still names npm versions. |
| **Language** | `Intl` and `Temporal`. | — | English text only. The browser's language only. |
