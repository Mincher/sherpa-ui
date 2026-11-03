# Plan 687 — news by push: one "what's new" feed, and one updates object per page

Will, 2026-11-02: *"I'm wondering if the service worker, for new builds, data updates
etc., should inform a data layer component in some capacity and that should handle the
push to the presentation layer. Then we don't have to rely on polling for Service Workers
and such from any open page/app."* He picked A — the app's server says what is new on one
shared feed — and added: *"how about a 'There is new stuff' boolean check before pulling
all the info on 'What's new'?"*

Part of [plan 652](plan-652-service-worker.md). Its diagrams go in row 685's docs.

---

## Today

| News | Who learns it | How |
|---|---|---|
| A change made in one tab | every tab | PUSHED: the worker says it on `DATA_CHANNEL` (S6a) |
| Newer rows a check found | every tab | PUSHED: the worker says a `data` notice (S6c) |
| A save made offline that lost | every tab, even later | PUSHED and KEPT: the worker keeps it until seen (S7b) |
| A new build | an open page | POLLED: `watchForUpdates()` asks every 5 minutes, and on show / online |
| A change on the server | the worker | POLLED: a check behind when a tab is shown, back online, Retry — or a Web Push (S8) |

A Service Worker cannot learn news by itself: the browser stops it when idle, so it
holds no timer and no connection. The polled rows are polled because the SERVER has no
way to say "something changed".

## After

1. **The app's server offers one small feed**, `/sherpa/updates` (Server-Sent Events).
   Its messages are tiny notices — never the data:
   `{ kind: 'app', build: 'b42' }` · `{ kind: 'data', store: 'customers', at: 1093 }`.
2. **One tab holds it**, as S8's `shareFeed` holds a live feed: the tab with the Web Lock
   opens it and passes each notice on; the next tab takes over when it shuts.
3. **A notice is acted on where it belongs:** `app` → that tab asks for the new worker
   (`registration.update()`), which takes every tab over (the banner, the item);
   `data` → the worker checks that store behind, and its newer rows wait (S6c).
4. **A tab that comes back asks once "anything since my mark?"** (Will's boolean first):
   `GET /sherpa/updates?since=<mark>` answers `{ build, stores: { customers: 1093 } }`, or
   `204` when nothing moved. Only a store whose mark moved is checked behind, and then
   only what moved (`changes(since)`); the data itself is pulled when the reader takes it
   (Refresh data).
5. **One `Updates` object per page, in the data layer** — DOM-free state: the app
   version waiting, each store's rows waiting, the lost saves, and what this tab
   dismissed. A browser-layer connector feeds it from the worker's channels, the
   takeover, and the feed — or `watchForUpdates()` polling where the server has no feed.
6. **The provider binds `[data-listens]` to it**, as today: a component never learns where
   news came from.
7. **Sherpa ships the server half**: a small `updatesFeed()` for a Node server (with
   `createDataHandler`, row 170), and Demos' server shows it.

## Steps

| Step | What | Done when |
|---|---|---|
| U1 ✅ | **Done 2026-11-03:** `Updates` (`src/core/data/updates.ts`) holds what waits — a new version, each store's rows, the lost saves — and what the reader dismissed; `hearUpdates()` feeds it from `onUpdate` and tells the worker of a lost save taken in; the provider's `updates` draws every `[data-listens]` element on each change and each page it provides, so a banner shows on the next page while its news waits; a listening element's own Refresh takes the rows in. Demos' Notifications reads `provider.updates`, its two `onUpdate`s gone (each asked the worker to say every kept notice again). The `Updates` object (data layer) and its connector (browser layer); the provider binds to it; `onUpdate` and the provider's `#heard` fold into it | Every notice spec green, unchanged — 20 of 20 in three engines, before and after Demos moved |
| U2 | The feed: `updatesFeed()` for a server; Demos' `/sherpa/updates`; one tab holds it (`shareFeed`) | A Demos build shows the banner in an open tab with polling OFF |
| U3 | The catch-up check: `?since=<mark>`, `204` when nothing moved | A tab shown again after a change asks once, and checks behind only that store |
| U4 | Cleanup: polling only where no feed answers | `watchForUpdates()` runs only as the fallback |

## Decisions for Will

Answered, 2026-11-02: both A (Will: "your picks").

| # | Question | A (my pick) | B |
|---|---|---|---|
| U-D1 | The feed's transport | Server-Sent Events: one-way, reconnects and replays by itself (`Last-Event-ID`), as `EventStore` does | WebSocket: two-way, which this does not need |
| U-D2 | Where a store's "mark" comes from | The store's own History (`changes(since)` marks), so the catch-up and the check behind speak one number | A separate version counter per store on the server |
