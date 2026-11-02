# Plan 652 — the data layer in a Service Worker

Will, 2026-11-02: *"Let's plan for the Service Worker. Getting the data layer right is
a huge part of building solid apps with Sherpa. I like that the Service Worker can
offload some work and also handle it async/offline."* And: *"would it be bad if there
was a client side server where the data layer, and all its source, store, and query
components, lived? Or is a per-page data layer better?"*

Will, 2026-11-02, on the decisions: *"your picks work for me. We can start making that a
reality."* D1 to D4 are A. Built so far: **S1** (below).

---

## The answer: split it by what each part is

Neither all of it in the worker, nor all of it per page.

| Where | What | Why there |
|---|---|---|
| **The worker, one for the app** | What is DATA: the stores, the held sets (`StoreCache`, `HeldSet`), the copy kept in IndexedDB, remote reads and writes, live feeds, the offline outbox, and the heavy work over rows: filter, sort, group, the counts walk, summaries | One copy of the rows for every tab, one connection to the server, and it keeps working while the network is down |
| **The page, one per page** | What is INTENT: the Query (scopes, readings, drafts, presentation), the bindings, the controls, and a mirror of what controls read at once (field facts, values, filter menus) | The Query is the reader's, in this tab. It must answer at once and survive the worker being stopped |

**Why not everything in the worker**

1. **The worker is shared by every tab.** A reader's Query is per tab: only saved filters cross tabs (TODO 370). In the worker, every Query must be kept by tab, and a tab that closes must be cleaned up.
2. **The browser stops an idle worker** (about 30 seconds) and its memory goes. A Query kept there must be written to IndexedDB on every change, or it is lost mid-task.
3. **Controls read 43 things at once** from `DataSource` (values, filter menus, groups, field facts), and 18 that wait. In the worker, every one of them waits, and every component that draws from them changes.
4. **The page and the worker update apart.** A page can talk to an older worker. One protocol with a version stops that being a silent bug.

**Why not a data layer per page, as now**

Each tab opens its own stores and holds its own copy of a remote set. Two tabs read the server twice, hold 100k rows twice, and lose everything offline.

**Today is halfway there.** Stores are already the app's (`options.stores`), and
`StoreCache` already holds *"one held set per remote store, shared by every page over
it"*, kept in IndexedDB (`CacheKeep`). The worker widens that from one tab to the whole
app. And rule 13 already keeps the data layer free of the DOM, so it can move.

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
(`RestStore`, `JsonStore`). So a worker does not remove much code. What it gives is a
shared, offline, off-thread home for the data. The Query logic travels with it unchanged.

Not measured yet: a worker in Firefox's private windows, and on iOS. Both must have a
fallback anyway (below).

---

## One engine, three hosts: the progressive enhancement

The handler is one plain function, `handle(request: Request): Promise<Response>`, in
`src/core/data/`: no DOM, as rule 13 requires. Three hosts run the same function.

| Host | When | What it is |
|---|---|---|
| **A, in the page** | No worker: a first load, a private window, tests, Node | A transport that calls `handle()` directly. No network, no worker |
| **B, the Service Worker** | The worker controls the page | A `sherpa-ui/worker` entry. It routes `/sherpa/data/*` to `handle()` |
| **C, a server** (row 170, later) | The app has a server | Node runs the same `handle()`. A `RestStore` sends it `QUERY` |

The page works with no worker, and works better with one. That is Sherpa's
progressive enhancement, at the data layer.

**Sherpa stays app-agnostic.** The worker holds no app code. An app names its stores in
a definition (as it names its pages), and the worker opens them.

---

## The two seams

**1. The Store seam.** `Store` is already the interface: `load`, `totalCount`,
`byKey`, `insert`, `update`, `remove`, `changes`. A `WorkerStore` in the page speaks it
over the protocol: `QUERY` to read, `POST`, `PATCH` and `DELETE` to write. Nothing above
it changes. It gives the shared set, offline reads, offline writes and `QUERY` to remote
servers. **It does not take work off the page.** A set the page does not hold is asked
step by step (`walkStepwise`), about 10 trips for one filter act.

**2. The Query seam.** One `QUERY` for one act. Its body is the applied Query, compiled:
each scope's filter and the walk's plan (`planWalk`, already pure), the page asked for,
and the summaries the charts ask for. Its answer is the page's rows, every count and
every summary. This takes the heavy work off the page, in one trip. It needs the pure
halves (`source-counts.ts`, `aggregate.ts`, `compile`) to be the only path.

---

## Offline and async

- **Reads offline:** from the copy kept in IndexedDB, which `StoreCache` already keeps. The worker owns it. The page says so through `reach`, which already exists.
- **Writes offline:** an outbox in IndexedDB, each write with the time it was made. It is sent when the worker starts or the browser goes `online`. **Not Background Sync:** only Chromium has it. Web Locks keep two tabs from sending the same outbox twice.
- **A change, to every tab:** the worker tells each tab on a `BroadcastChannel`. That replaces each tab's own change events and its `changes(since)` asks.
- **Live feeds:** one Server-Sent Events or WebSocket connection in the worker for all tabs, where today each tab opens its own.
- **Kept data:** `navigator.storage.persist()`, so the browser does not clear it under storage pressure.

---

## The steps

Each step is measured in the running app, and the plan can stop after any of them.

| Step | What | Done when |
|---|---|---|
| S1 ✅ | The protocol and `handle()`: the `QUERY` body, the answers, a `Failure` kind for each HTTP status, a version header | Node tests over every store kind. **Done 2026-11-02:** `createDataHandler` in `src/core/data/data-handler.ts`, from `sherpa-ui/data`; 9 Node tests. `T-a-data-request-is-the-store-interface` |
| S2 | Host A: `DataSource` reads one Demos page through the protocol, in the page | Every test green, nothing changes for the reader |
| S3 | Host B and the Store seam: `sherpa-ui/worker`, its routes, the fallback to A; Records on it | Two tabs read the server once; Records works offline |
| S4 | The Query seam: one `QUERY` an act | INP and LCP at 4x CPU with 100k rows beat S3 (TODO 350's targets). If not, S4 stops |
| S5 | Offline writes: the outbox, Web Locks, what a conflict does | A save made offline lands after reconnecting, once |
| S6 | Live feeds in the worker, sent to every tab | One connection for many tabs |
| S7 | `RestStore` sends `QUERY` to real servers. Where a proxy refuses it, a `POST` of the same body (Will, 2026-11-02); `GET` only for a server that takes nothing else. Host C's shape for row 170 | A long filter that breaks a URL works |

Playwright can test the worker (`context.serviceWorkers()`, `context.setOffline()`),
in all three engines.

---

## Risks

- **The worker stops and starts.** Its held set must come back from IndexedDB quickly. Measure the wake-up cost in S3.
- **Version skew.** A page newer than its worker uses Host A until the worker updates.
- **Harder to debug.** The worker has its own devtools. `debugState()` must answer from both sides.
- **No worker at all:** private windows, some embedded browsers. Host A covers them. That is why A comes first.
- **Cross-origin `QUERY`** to a remote server needs a CORS preflight. The page to its own worker needs none.

---

## How it meets the other rows

- **170**, the client/server split: Host C is its server, with the same `handle()`.
- **350**, load and interaction speed: S4 is measured against its targets.
- **615**, scale: 100k rows held once for the app, not once per tab.
- **616**, the node engine: a workflow could run in the worker, off the page. Will is planning 616, so this plan does not touch it.
- **392**, a customer's sites read when their row opens: a worker route can answer it.

---

## Decisions for Will

| # | Question | A (my pick) | B |
|---|---|---|---|
| D1 | The shape | Split: data in the worker, the Query per page | Everything in the worker |
| D2 | The first seam | The Store seam first (S2, S3), then measure the Query seam (S4) | The Query seam at once |
| D3 | A write made offline that clashes with a newer one | The newer write wins, and the reader is told | The reader chooses each time |
| D4 | How an app names its stores for the worker | A JSON definition, as pages are | A script the app writes |
