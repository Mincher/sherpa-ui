# Plan 652 — the data layer in a Service Worker

Will, 2026-11-02: *"Let's plan for the Service Worker. Getting the data layer right is
a huge part of building solid apps with Sherpa. I like that the Service Worker can
offload some work and also handle it async/offline."*

Will, on D1 to D4: *"your picks work for me. We can start making that a reality."* They
are A. **S1 to S5 are built.** Will, on D5 and D6: A, and a new version is an item in
the Notifications menu too.

---

## Will's rules for this plan

Will, 2026-11-02, second pass. Each one is held below.

1. **The data layer answers data, and nothing about how it is shown.** It answers a
   first read, a query and a change. *"The data layer components shouldn't know, or
   care, about how UI components present data to the user (other than possibly being
   aware of State if we need that)."* That was the aim of one standard query and one
   standard query handler.
2. **A component computes what it draws** — a grid's rows, counts, sub-totals — from
   what the data layer answers.
3. **The data layer may also give counts.** A component may show them. It never
   highlights from them: it highlights from its own.
4. **Highlighting is a broadcast between components.** A hover in one goes out; each
   component that highlights tests its own rows. Nothing goes through the data layer.
   Row 655.
5. **An update notice is heard, never ordered.** The worker says that new data waits. It
   never tells the app to show a banner. A component registers to hear it: in Demos, an
   info banner. The Refresh data button takes the update in.
6. **A component's own narrowing travels in its own request.** A legend that narrows its
   chart adds its reading to the chart's request. No element is named, so nothing needs
   an id (TODO 518).
7. **The perks, all yes:** fast loads and offline use, a fake backend, one connection for
   all tabs, push notifications, an installable app, background sync.
8. **`POST` is the fallback for `QUERY`, not `GET`.** Built in S1.
9. **A server needs the page definition**, for each field's type, label and thresholds.
   It is JSON already (D4).

---

## The shape: split by what each part is (D1)

| Where | What | Why there |
|---|---|---|
| **The worker, one for the app** | DATA: the stores, the held sets (`StoreCache`, `HeldSet`), the copy kept in IndexedDB, remote reads and writes, live feeds, push, the offline outbox, the app's files. And the work over rows: filter, sort, page, search, a field's values and their counts | One copy of the rows for every tab, one connection, offline use, and the work is off the page's thread |
| **The page, one per tab** | STATE: the Query (scopes, readings, drafts), its bindings and the controls. PRESENTATION: each component computes what it draws from its answers | The Query is the reader's, in this tab: only saved filters cross tabs (TODO 370). It must answer at once, and live on when the browser stops the worker |

**The worker sees no presentation.** It reads the protocol S1 built: a filter, a sort, a
page, a search, the fields. No chip, no scope, no chart, no highlight. The page turns its
State into that filter. This is rule 1, and the protocol already holds it.

**Why not everything in the worker**

1. The worker is shared by every tab, and a Query is per tab. Each Query must be kept by tab, and cleaned up when its tab shuts.
2. The browser stops an idle worker (about 30 seconds), and its memory goes. A Query kept there must be written to IndexedDB on every change.
3. Controls read 43 things at once from `DataSource`, and 18 that wait. In the worker, all 61 wait.
4. The page and the worker update apart. One protocol with a version stops that being a silent bug.

**Why not a data layer per page, as now:** each tab opens its own stores and holds its own
copy of a remote set. Two tabs read the server twice, hold 100k rows twice, and lose
everything offline.

**Today is halfway there.** Stores are already the app's (`options.stores`). `StoreCache`
already holds *"one held set per remote store, shared by every page over it"*, kept in
IndexedDB (`CacheKeep`). The worker widens that from one tab to the whole app. Rule 13
already keeps the data layer free of the DOM, so it can move.

---

## What was measured, 2026-11-02

Chromium 153, Firefox 155, WebKit 26.6, on localhost.

| Fact | Chromium | Firefox | WebKit |
|---|---|---|---|
| A Service Worker sees a `QUERY` request and its body | yes | yes | yes |
| A page's `fetch()` sends `QUERY` to a real server | yes | yes | yes |
| The Cache API stores a `QUERY` request | refused | refused | refused |
| One trip through the worker, no work in it | 0.3 ms | 1 to 1.5 ms | 0.3 to 0.4 ms |
| A new worker controls the page after | 65 ms | 311 ms | 71 to 89 ms |
| Background Sync | yes | **no** | **no** |
| BroadcastChannel, Web Locks, `storage.persist()`, module workers | yes | yes | yes |

The data layer is about 13,300 lines. Fetching and posting are about 300 of them
(`RestStore`, `JsonStore`). So a worker does not remove much code. It gives the data a
shared, offline, off-thread home.

Not measured yet: a worker in Firefox's private windows and on iOS, push, and install.
Each has a fallback or is marked below.

---

## One engine, three hosts

The handler is one plain function, `handle(request: Request): Promise<Response>`, in
`src/core/data/`: no DOM, as rule 13 requires. Three hosts run it.

| Host | When | What it is |
|---|---|---|
| **A, in the page** | No worker: a first load, a private window, tests, Node | A transport that calls `handle()` directly. No network, no worker |
| **B, the Service Worker** | The worker controls the page | A `sherpa-ui/worker` entry. It routes `/sherpa/data/*` to `handle()` |
| **C, a server** (row 170, later) | The app has a server | Node runs the same `handle()`. A `RestStore` sends it `QUERY` |

The page works with no worker, and better with one: progressive enhancement, at the data
layer. **Sherpa stays app-agnostic:** the worker holds no app code. An app names its
stores in a JSON definition (D4), and the worker opens them.

---

## What a component asks, and what it gets

**The Store seam (S4).** `Store` is the interface already: `load`, `totalCount`, `byKey`,
`insert`, `update`, `remove`, `changes`. A `WorkerStore` in the page speaks it over the
protocol. Nothing above it changes. It gives the shared set, offline reads and writes, and
`QUERY` to remote servers.

**The answer seam (S9).** Each component asks for the rows it needs, in its own request:
the filter its scope makes plus its own narrowing, a sort, a page or all of them, and the
fields it reads. What it gets:

| It asks for | It gets |
|---|---|
| A page of rows: a grid, a list | The rows and the total |
| Every row, to count: a chart, a metric | Only the fields it reads, as columns: each field's values once, and a code for each row in a typed array, which moves to the page with no copy |
| A field's values over rows the page does not hold: a chip's menu, a group's count across pages | Each value and its count, as data. A component may show them, and never highlights from them (rule 3) |
| A change | Which rows changed, so it asks again |

The component counts, sums, groups and highlights from that. The shared pure helpers
(`aggregate.ts`, `compile`) do the math, on the page, in the binding each component
asks for (D6, Will: A). The components do not change.

**Why columns.** 100k rows as objects is a slow copy from the worker to the page. Two
fields as codes in typed arrays is about 400 KB, and moves free. Not measured yet: S9
measures it, and stops if it does not win.

The worker still shares its work: ten components on one filter cost one pass.

---

## Highlighting (row 655)

A legend item or a chip says what the pointer rests on: a field and a value. The provider
sends that to every component on the page that asked to highlight. It is a broadcast: no
element is named. Each component tests its own rows and draws its own match — a grid row,
a marked string, its part of a segment or a section (`T-a-match-marks-its-own-mark`).
There is no trip, so it is as fast with a remote server as with none.

Today the hover goes into the Query (`QueryContext.preview`), and the data layer tests it
(`DataSource.highlightFor`). Row 655 takes it out of the data layer. A chip set to
Highlight is different: it is the reader's State, so it stays in the Query, and each
component tests it in the same way.

---

## Update notices

1. The worker learns that newer data waits: from a live feed, a push, or a check when a tab comes back.
2. The reader's own writes, from any tab, show in every tab at once. Changes from the server WAIT, so a grid does not move under the reader. A store can say to take its changes at once, for a live board.
3. The worker sends a notice on a channel: which store, and how many rows. It names no element, and asks for nothing to be shown.
4. A component registers to hear it, in its own attribute, and the provider answers it. In Demos: an info banner, `sherpa-callout data-type="banner"` (row 656), at the top of each layout grid, before the metrics row, across all 12 columns. CSS shows it while a notice waits. An app can pick another component.
5. The Refresh data button (`data-refresh`, in the header's toolbar) takes the waiting changes in. Every component asks again.
6. A new app version (the worker has new files) is a notice of its own kind (D5, Will: A). Refresh data does not take it in. Two components hear it:
   - **The banner** says a new version is ready, with its own Reload button. The reader can dismiss it. It can also close itself after a time, with `data-duration` as `sherpa-toast` names it; off by default.
   - **An item in the App Header's Notifications menu** says the same, and stays after the banner goes. A press on it reloads. It goes when the new version runs. In Demos the menu is `sherpa-notifications`, fed from a store, so the item is a row the listener writes there.

---

## The perks

| Perk | How | Engines |
|---|---|---|
| **Fast loads, offline use** | The worker keeps the app's files when it installs, and answers from its cache. Sherpa's build puts each template and sheet in the JS, so the list is short. A new version installs in the background and waits. `navigator.storage.persist()` stops the browser clearing the kept data | All three |
| **A fake backend** | The worker answers a REST API from a JSON definition: seed rows, a delay, a failure rate. Demos and tests run the real remote path (`RestStore`, the held set, paging, errors) with no server. The app names its routes and seed files | All three |
| **One connection for all tabs** | One held set and one live feed, in the worker. Each tab is told on a `BroadcastChannel`, where today each tab asks `changes(since)` for itself | All three |
| **Push notifications** | The worker hears a Web Push. It shows a notification, if the reader allowed it, and sends an update notice. A press on the notification opens the app. The app's server sends the push, with its own keys: Sherpa ships the worker's half | Not measured. On iOS, only for an installed app |
| **An installable app** | A web app manifest and the worker. The app owns its manifest (name, icons). `create-sherpa-ui` writes one, and Demos gets one | Not measured. Firefox on the desktop may not offer it |
| **Background sync** | An outbox in IndexedDB, each write with its time. Chromium: the `sync` event sends it after the network comes back, with the tab shut. Firefox and WebKit: it is sent when the worker starts or the page goes online. Web Locks stop two tabs sending it twice | `sync`: Chromium only (measured). The fallback: all three |

---

## The steps

Each step is measured in the running app, and the plan can stop after any of them.

**Each step cleans up behind itself** (Will, 2026-11-02: *"The Service Worker improvement
may make some legacy code redundant or convoluted. So we should plan to refactor and
cleanup the code as we implement the Service Worker changes."*). The last column is what
each step should make redundant. In that step: measure that nothing still needs it, delete
it, and say so. A step is not done while its old path is still there beside the new one.
`check:size` must fall, or the step says why it grew.

| Step | What | Done when | What it should make redundant: check, then delete |
|---|---|---|---|
| S1 ✅ | The protocol and `handle()`: the `QUERY` body, the answers, a `Failure` kind for each HTTP status, a version header, and a `POST` of a query answered as the query | **Done 2026-11-02:** `createDataHandler` in `src/core/data/data-handler.ts`, from `sherpa-ui/data`; 10 Node tests. `T-a-data-request-is-the-store-interface` | Nothing yet: it is new |
| S2 ✅ | Host A: `DataSource` reads one Demos page through the protocol, in the page | Every test green. Nothing changes for the reader. **Done 2026-11-02:** `RequestStore` (`openRequestStore`, from `sherpa-ui/data`): each read a `QUERY`, each write a request, its rows keyed, its own writes announced, a refused write's `issues` carried by field. Demos' Records reads through it, over a handler in the page; Demos 282 of 283 in Chromium (the one is a peer's open work). 6 Node tests | Once every page reads this way, `DataSource`'s direct calls to a `Store`: one path, the protocol, in the page or in the worker. Not yet: the Dashboard still reads its store directly |
| S3 ✅ | The worker and the app's files: `sherpa-ui/worker` keeps them; Demos gets a manifest | Demos opens offline and installs. A second load's LCP falls. **Done 2026-11-02:** `keepAppFiles` from `sherpa-ui/worker` (and `/dist/bundle/worker.js`): the shell kept at install, every other file as asked; FRESH by default, the network first, so a rebuild shows at once. Demos: `app/sw.js`, a manifest and icons. Measured with the server truly stopped: Records opens in all three engines, 100 rows; Chromium reports no install errors; Demos 283 of 283 in Chromium with the worker on. LCP not measured: fresh asks the network first, and on localhost it is no faster. `T-a-worker-keeps-the-apps-files` | Any app-side preload or file-cache code the worker's cache now does |
| S4 ✅ | Host B and the Store seam: the data routes, one held set for all tabs, the fallback to A. Records on it | Two tabs read the server once. Records reads offline. **Done 2026-11-02:** `serveData` (`sherpa-ui/worker`) answers `/sherpa/data/*` from the stores the app's worker script imports (D7); `openWorkerStore` (`sherpa-ui/app`) reads through the worker while it controls the page, else the page's own handler — a first visit, a private window, an older worker. Measured: after a reload every Records read goes through the worker, in all three engines; with the server stopped, Records opens and reads through it in all three, 100 rows; two tabs share it. Demos 284 of 284 in Chromium. Records is local (IndexedDB), so "read the server once" waits for a remote store (S5's fake backend). `T-the-worker-answers-the-data` | The page's own `StoreCache`, `HeldSet` and `CacheKeep`: the worker holds the set; the page keeps only a mirror of what controls read at once. Each tab's own `changes(since)` asks |
| S5 | **One held set in the worker** (Will, 2026-11-02: A, over "a pretend REST server"). A worker's own `fetch` skips its own fetch handler, so a store in the worker can never reach a fake server in that worker; and since S4 each tab still held its own copy of a remote store's rows. So: **S5a ✅** — the read plan over a store's held set (`planRead`, `StoreCache`: hold, recheck, failures, the kept copy) comes out of `DataSource` into its own DOM-free module, `DataSource` unchanged on top (every test and `check:bench` as before). Done 2026-11-02: `HeldReads` in `held-reads.ts`; `DataSource` 49 lines shorter; `check:bench` 102 acts as before; 839 Node tests and 132 Demos remote and held-set specs green. **S5b ✅** — `HeldStore`: a store for the worker on that module, answering each page from the one held set, and saying to the page that it holds it (`holds`), so no page holds another; it stays remote to the page (D8), its unconfirmed rows said in a `Sherpa-Stale` header, Retry and Refresh a `?recheck`. **S5c ✅** — the fake backend is the existing `fakeRemote` (a delay, failures), run in the worker under `HeldStore` with its copy kept on the device; Demos' remote mode moves there, and each request carries its Settings switches in a header (`RequestStore`'s `headers`), as a worker may be stopped and forget. Done 2026-11-02 | Two tabs read the store once (counted in the worker). Records' remote mode reads offline from the worker's kept copy. **Measured:** tab one waited once (805 ms), tab two's reads about 1 ms (Chromium; WebKit at most 128 ms); a reload shows the kept rows with no read waited for, and offline it warns; 4 Node tests; sherpa-ui 799 and Demos 284 specs in Chromium. `T-a-worker-holds-the-set` | Each tab's own held set of a remote store, and Demos' page-side `fakeRemote` and `keepCache` wiring |
| S6 | Changes and update notices: every tab told, server changes wait, the notice, Demos' banner, Refresh data, a new version's banner and Notifications item. **S6a ✅** 2026-11-02: every tab told — `serveData` says each change on `DATA_CHANNEL`, a `RequestStore` whose host `notifies` hears it; measured in all three engines (`T-every-tab-hears-a-change`). S6b: notices heard by a component that registers; S6c: server changes wait | A change in one tab shows in another. A server change shows the banner, and Refresh data takes it in. A new build shows the banner and an item in Notifications; the item stays after the banner is dismissed | Each tab's own change events and checks for new data; per-tab reach checks that the worker's notice now answers |
| S7 | Offline writes: the outbox, Web Locks, Background Sync where it is, D3's rule | A save made offline lands once, after the network comes back | Any per-tab retry or queue of writes |
| S8 | Live feeds and push: one feed in the worker for all tabs; a push makes a notice and a notification | One connection for many tabs. A push shows the banner | Each tab's own feed connection |
| S9 | The answer seam: answers as columns, each component counting from them | INP and LCP at 4x CPU with 100k rows beat S4 (TODO 350's targets). If not, S9 stops | Presentation math still in the data layer: what row 655 has not already taken out of `DataSource` and `QueryContext`, and any count the page computes that a value-count answer now gives |
| S10 | `RestStore` sends `QUERY` to real servers; a `POST` of the same body where a proxy refuses it; `GET` only for a server that takes nothing else. Host C's shape, for row 170 | A long filter that breaks a URL works | Query strings built for `GET`, kept only for a server that takes nothing else |

Row 655 cleans up too: `QueryContext.preview` and `previewed`, and the hover half of
`DataSource.highlightFor`, go when the broadcast takes their place.

Rows 655 (highlighting) and 656 (the banner) need no worker, so they go before S2. Playwright can test the
worker in all three engines (`context.serviceWorkers()`, `context.setOffline()`).

---

## Risks

- **The worker stops and starts.** Its held set must come back from IndexedDB quickly. S4 measures the wake-up cost.
- **Version skew.** A page newer than its worker uses Host A until the worker updates.
- **A kept file goes stale.** Each build names its file list, and a new list is an update notice (D5).
- **Harder to debug.** The worker has its own devtools. `debugState()` must answer from both sides.
- **No worker at all:** private windows, some embedded browsers. Host A covers them. That is why A comes first.
- **Push needs a server** and its keys. Sherpa can only ship the worker's half, and the fake backend can only pretend.
- **Cross-origin `QUERY`** to a remote server needs a CORS preflight. The page to its own worker needs none.

---

## How it meets the other rows

- **170**, the client/server split: Host C is its server, with the same `handle()`.
- **350**, load and interaction speed: S3 and S9 are measured against its targets.
- **615**, scale: 100k rows held once for the app, not once per tab.
- **616**, the node engine: a workflow could run in the worker. Will is planning 616, so this plan does not touch it.
- **392**, a customer's sites read when their row opens: a worker route can answer it.
- **495, 638**: a hover's highlight. Row 655 moves it out of the data layer.
- **653, 654**: a chart is Primary by Secondary, each axis as counts or names. Components count for themselves, so the data layer does not change for them.
- **656**: the banner is a variant of `sherpa-callout`, as Figma's Banner. S6 needs it.

---

## Decisions for Will

Answered, 2026-11-02: all A. Nothing is open. D7 changes how D4 is met, not what it asks: the app still names its stores; its worker script imports their code.

| # | Question | A (picked) | B |
|---|---|---|---|
| D1 | The shape | Split: data in the worker, the Query per page | Everything in the worker |
| D2 | The first seam | The Store seam first, then measure the answer seam | The answer seam at once |
| D3 | A write made offline that clashes with a newer one | The newer write wins, and the reader is told | The reader chooses each time |
| D4 | How an app names its stores for the worker | A JSON definition, as pages are | A script the app writes |
| D5 | Does Refresh data also take in a new app version? | No. It takes in new data only. A new version shows in the banner with its own Reload button: a reload can lose what the reader has open. Will added: an item in the Notifications menu too, which stays, while the banner can be dismissed or time out | Yes. One button takes in both, and reloads the page for a new version |
| D6 | Where does a component's counting run? | On the page, in the binding the component asks for, with the shared helpers. Components do not change, and a chart still draws a plain summary when it stands alone | In each component's own class. Each chart and chip takes rows and counts them itself |
| D8 | S5b: the worker holds a remote store's one set for every tab. How does a page treat that store? (Will: A) | Still remote, as today: drafts and Apply, loading, "Unable to reach data". The page holds no second copy (`holds`), asks the worker each answer, and is told when the worker shows old rows (`stale`); Retry asks the worker to read again | Local: a pick applies at once, with no Apply; "Unable to reach data" waits for S6 |
| D7 | D4 met a wall: a Service Worker may not `import()` at runtime — measured 2026-11-02, refused in all three engines. How does the worker get its stores? (Will: A) | The app's worker script imports its store modules and hands them to `sherpa-ui/worker`. The app definition still names the stores, so the page and the worker agree; rules and a made seed stay code, written once | Stores become pure JSON: kind, key, rules in a JSON vocabulary, seed rows in a file. No code, but a made seed (Demos' dates follow today) becomes a fixed file |
