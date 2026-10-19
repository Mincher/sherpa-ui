# TODO 345 phase 4: the two designs judged, and one merged design

This was a read-only pass. I edited nothing and ran no build or tests. Every line number below is at **HEAD `30e4f4f5`**, and the working tree is clean. Both designs cite `7af8e40b`. Since then `b2f9988b` (348 W1) changed `data-source.ts`, and that change matters here (finding 1). Minimal's note about peer edits not yet committed is out of date: `prepare()` (`sherpa-provider.ts:342`) and `close({ next })` (`:349`) are both still there.

## Scores

| Criterion | minimal | robust |
|---|---|---|
| Correct against the code | 3.5: misses the `#age` keys (finding 1). A smaller `holdRows` drops the shared set for every page. A closed source's Refresh can touch the shared set. Its Retry goes through `#resolve(outlet)` (`sherpa-provider.ts:152-153`), which reports `provider-ambiguous` when the page has two sources | 3.5: misses `#age` too. It keeps the set, and shows "Unable to reach data", on a 401/403 and on any error (§1.7 "If a set is held, it stays"; reach `down` on any error). Its `visibilitychange` write sits in a file on the headless-safe list, where `document` is banned (`eslint.config.js:90-99`). Its `provider-new-store` report fires on the tenant switch that its own §1.2 calls legitimate. It maps `AbortError` to timeout. It leaves the spoof wrapper pinning the cache (finding 2) |
| Fits the project rules | 4: banner only for "could not reach", 401 forgets, words in markup. But `data-reach` is a public attribute the outlet writes on itself (`T-private-state-is-a-custom-state`) | 3.5: custom states and state-first reach are good. Weak points: speculative `Mark.seq`/`cursor`, the lint conflict, and the banner on a 401 |
| Smallest change that meets Will | 5 | 2.5: 8 commits, an `openIdb` refactor, an LRU budget |
| Ready for phases 5-9 | 2.5: no `planRead`, no "announces every change" member, no recheck hook. `remote/reopen` stays at 1 load, against the plan's 0 (`plan-345.md` phase 4) | 5 |
| Testable | 4 | 4.5: a pure table function |

**What neither design has (checked at HEAD):**

1. **348 W1 keys four caches on `#age`.** They are `#countedFor` (`data-source.ts:1925`), `#allFor` (`:1804`), `#settledFor` (`:2094`) and `#presentFor` (`:2154`). `#age` is bumped only by a change (`:1662`), a forced load (`:1640`) and the declares. In both designs, a background read that lands or a patch made by the cache then calls only `#reask()`. The chip counts, the unpaged rows a chart draws, and the set-aside would all stay as they were before.
2. **`spoofRemote`'s relay listener keeps its wrapper alive** (`spoof-remote.ts:29`). So a `WeakMap<Store, StoreCache>` keyed by a wrapper made per open keeps every visit's whole set. Demos makes a new wrapper on every load: `stores()` is called at `sherpa-outlet.ts:317`, and Demos `app/index.html:618-623` builds a new one each time. The leak is confirmed. The docs say the opposite (`TRAPS.md:3670-3671`, `TODO.md:899-900`).
3. **A closed source's `load({ force: true })` runs `#letGo`** (`:1639-1642`). Once the set is shared, a stale source would mark every page's set as out of date.
4. **Neither design bounds the wait for the kept copy.** An IndexedDB open can stall (`IdbStore.#db`, `idb-store.ts:123-173`; WebKit boot hang, Demos `reforged-card-data-states.spec.ts:61`).

---

## The merged design

### 1. The cache
*From robust: one cache per store, a per-source cap, and the K1/K2 split, which the plan's 0-load reopen needs. From minimal: refusals are kept as today, the WeakRef relay, and an internal-only cache. Added: the `#age` rule and the closed-source guard.*

**Where it lives** (all new and DOM-free unless stated):

| File | What it holds |
|---|---|
| `src/core/data/failure.ts` | `failureOf()` and `unreached()`; exported from `sherpa-ui/data` |
| `src/core/data/read-plan.ts` | `planRead()`, pure, with phase 4's inputs only. Later phases widen it |
| `src/core/data/store-cache.ts` | `StoreCache`, `cacheOf()`, the `CacheKeep` port. Internal, not exported |
| `src/core/browser/cache-keep.ts` | Headless-safe. Covered in §3 |

**The key** is the store object. The cache is held in a `WeakMap<Store, StoreCache>`. A store name would show one tenant's rows to another after a tenant switch, and a debug switch may swap a store under the same name (`sherpa-outlet.ts:33`). The Demos problem is fixed in two places:

- **Demos:** make one wrapper for the life of the app. It reads its flags at each load:
  ```js
  const remoteCustomers = spoofRemote(customerStore, {
    delay: () => (session.get('/debug/remote') === true ? 800 : 0),
    fail: () => (session.get('/debug/fail') === true ? 1 : 0),
  });
  // stores: () => ({ customers: remote || fail ? remoteCustomers : customerStore, alerts: alertStore })
  ```
- **sherpa-ui:**
  - `SpoofOptions.delay` and `fail` also take a function.
  - The relay reaches its wrapper through a `WeakRef` and removes itself once the wrapper is gone.
  - The `OutletOptions.stores` doc says "hand back the same object each time".
  - There is no `provider-new-store` report, because it would fire on a legitimate swap.

**API:**

```ts
// failure.ts — read by SHAPE: no import of stores.ts, never navigator. TRAP T-a-failure-has-a-kind
export type FailureKind = 'offline' | 'timeout' | 'server' | 'refused' | 'invalid' | 'unknown';
export interface Failure { readonly kind: FailureKind; readonly message: string; readonly status?: number }
export function failureOf(error: unknown): Failure;
export function unreached(failure: Failure): boolean;          // offline | timeout | server

// read-plan.ts — the decision's home from now on; phase 8 widens `need`, phases 3 and 9 widen `history`
export type Plan = 'held' | 'held-stale' | 'fetch' | 'store';
export function planRead(
  need: { cap: number },
  held: { set: { size: number; gen: number; due: boolean } | null; never: boolean; over: number },
  history: { announcesAll: boolean; since: number },
  reach: { failed: boolean; tried: boolean },
): { plan: Plan; behind: boolean };

// store-cache.ts — TRAP T-a-store-has-one-cache
export function cacheOf(store: Store): StoreCache;
export class StoreCache extends EventTarget {
  readonly store: Store;
  get set(): HeldSet | null;
  get gen(): number;               // whole reads landed this session; a kept copy is gen 0
  get due(): boolean;              // known out of date: a change it could not take, or a Refresh
  get failure(): Failure | null;   // the last whole read failed; while unreached, the set stands
  get never(): string | null;      // store facts that forbid holding (reportsTotal, sampled, totalUnknown, a capped reply)
  get over(): number;              // the largest cap a set was refused at, for size
  hold(cap: number): Promise<void>;   // ONE shared read, take: cap + 1; waits (bounded) for a kept copy first; never rejects
  recheck(cap: number): void;         // a read BEHIND the set; never drops it
  letGo(): void;                      // a Refresh: due, failure cleared, the set kept as the fallback
  drop(opts?: { forget?: boolean }): void;  // no set; forget: the kept copy too
  keep(port: CacheKeep): void;        // §3
  // events: 'change' { taken: boolean } — a store change, patched ONCE here, then relayed
  //         'set' — a set landed or was restored, or `failure` moved
}
```

Other new members. Each is optional, so an old store works as it does today:

- `Store.announcesAll?: boolean` means "every change to my rows is announced by this object".
  - `ArrayStore` (`stores.ts:42`) and `JsonStore` (`:152`) say true.
  - `spoofRemote` passes the inner store's value on, and `SpoofOptions.announcesAll` can override it.
  - `IdbStore`, `LocalStore` and `RestStore` leave it out, because other tabs or other clients write to them.
- `DataChangeDetail.stale?: true` (`data-source-types.ts:277`): "held rows the store has not confirmed: they are being checked, or the store cannot be reached".
- `DataSource.reach: 'ok' | 'unreached' | 'down'` and `DataSource.recheck()`.
- The `error` event's detail gains `failure`.
- `debugState()` gains `held: { rows, gen, due, failure }` and `reach`.

**What moves out of `DataSource`:**

| Today | After |
|---|---|
| `#held` (:222), `#holding` (:224), `#heldAge` (:226) | Move to the cache: one set, one read and one read age per store. An overtaken read still reads once more (:1725, :1735) |
| `#holdNever` (:231), `#refusalSaid` (:235), `#refuse` and `#sayNotHeld` (:1745-1760) | Move to the cache as `never` and `over`. `held-set-refused` is said once per store |
| `#holdRefused` (:233) | Moves to `cache.failure` |
| `#holdRows` (:228) | Stays on the source as the page's cap. A set larger than it means "ask the store", and the set is never dropped for it |
| The store listener (:256) and `#onStoreChange` (:1661-1671) | The cache listens to the store for good and patches once. A remote source with `holdRows > 0` listens to the cache instead |
| `#mayHold`/`#hold` (:1702-1718) | `#hold()` = `planRead(...)` in a loop: `fetch` → `await cache.hold(cap)`; `behind` → `cache.recheck(cap)` and `#tried = true`. It records `#plan`, which `#reads` (:1696) follows. All 8 sites stay: :962, :1779, :1859, :1891, :1971, :2075, :2098, :2223 |
| `close()` (:1681-1686) | Removes its listener. **The store's set stays**, which is what makes a reopen instant |

The source's two cache handlers:

- **`change`:** `#age++`, `#presentFor = ''`, then `#reask()`. A held answer comes from the patched set. A due set makes `#hold` wait for one shared read. A source on the store path asks the store, as today.
- **`set`:** `#age++`, then `#reask()` if it has loaded.

Two guards:

- **`load({ force })`:** `#age++`, and `cache.letGo()` only when the source is **not** closed (finding 3).
- **A closed source** reads from the store and never touches the cache.

**The decision table.** The first row that matches wins:

| Set | Case | Plan | Behind |
|---|---|---|---|
| none | `never`, or cap ≤ `over` | store | – |
| none | `failed` | store, as today ("a failed whole read is not a failed source") | – |
| none | – | fetch | – |
| size > cap | – | store | – |
| `due`, not failed | – | fetch (wait, as today) | – |
| any | `failed` (only an unreached failure keeps a set) | held-stale | `!tried` |
| gen 0 (kept), or `!announcesAll && gen ≤ since` | unsure | held-stale | `!tried` |
| otherwise | current | held | – |

- `since` is `cache.gen` when the source was made.
- A source's first hold is in `declareFromRows` (:962). When every field's values are already declared, it is the first load (:1779).
- So the one read behind per source starts at open or at the first load, **never on a toggle** (340).

**A failed whole read**, inside `cache.#readWhole`:

| Failure | What the cache does |
|---|---|
| Overtaken | Reads once more, as today |
| Unreached, with a set | Keeps the set, sets `failure`, emits `set`, reports `store-unreached` once per flip (the message is kept) |
| Unreached, no set | Sets `failure`. The store path follows, as today |
| `refused` | `drop({ forget: true })`. Nothing held is shown to someone no longer allowed to see it |
| `invalid` or `unknown` | `drop()` and the store path, as today |

**`failureOf`**, by shape:

| Shape | Kind |
|---|---|
| `name` is `TimeoutError` (`AbortSignal.timeout`, `stores.ts:366`); `status` 408, 504 or 524 | timeout |
| `status` 429 or any other 5xx | server |
| `status` 401, 403 or 407 (`HttpError`, `stores.ts:379`) | refused |
| any other `status` | invalid |
| `name` is `ValidationError` or `SyntaxError` | invalid |
| `name` is `TypeError` (fetch's network failure; CORS looks the same) | offline |
| anything else, including `AbortError` | unknown |

`spoofRemote` throws `new TypeError('spoofRemote: the fetch failed.')`, so the message is unchanged (`query.test.mjs:377`; Demos `reforged-card-data-states.spec.ts:39`). Its `totalCount` fails too. Phase 4 adds `navigator` to the DOM-free ban (`eslint.config.js:56-67`).

**Memory:**

- One set per remote store object, for the session. It is capped by the largest `holdRows` used (default 50,000, `:246`).
- It no longer grows with each visit, and the WeakRef relay keeps a per-open wrapper from pinning one.
- A budget for caches nobody uses (robust 4.8) becomes a TODO row, measured in 350. It is not part of phase 4.

### 2. Reopen per kind of store, and what a component sees
*From robust: the K1/K2/K3 split and the case table. From minimal: no card state on stale, and a 401 is not a reach failure.*

**The three kinds:**

- **K1** announces every change: `ArrayStore`, `JsonStore`, or a spoof over either. This is the bench's kind.
- **K2** cannot know other writers: `RestStore`, a remote store with no flag, or Demos `?remote` (a spoof over `IdbStore`).
- **K3** is never held: no `reportsTotal`, `sampled`, too many rows, or `holdRows: 0`. It keeps today's path, and only `reach` and `failure` are new.

| Case | Events from the source, in order | Asks | Card | Banner |
|---|---|---|---|---|
| **R1** K1 reopen | `loading:true` → `change` → `loading:false`, in one task | 0 | data, no spinner (under `SLOW_LOAD`, `sherpa-provider.ts:97`); `#opening` (:541) marks nothing | none |
| **R2** K2 reopen, or a reload with a kept copy, online | `loading:true` → `change{stale}` → `loading:false`. The behind read lands → `set` → `loading:true` → `change` → `loading:false` | 1, behind | data at once, then a quiet redraw | none |
| **R3** as R2, but the behind read fails unreached | … → `set` → `loading:true` → `change{stale}` → `loading:false` | 1 | data kept, no card state | **warning** |
| **R4** nothing held or kept, store down | Whole read fails (`values-unread`, `field-catalogue.ts:151`) → store path → `loading:true` → `error{error, failure}` → `loading:false` | as today | error state (`sherpa-provider.ts:514-519`) | **critical** |
| **R5** Refresh, or an unkeyed save, while down | `loading:true` → (card loading after 300 ms) → read fails → `change{stale}` → `loading:false` | 1 | data back | **warning** |
| **R6** a toggle while stale | `loading:true` → `change{stale}` → `loading:false` | 0 | data | warning stays |
| **R7** 401/403 | Set dropped and kept copy forgotten → store asked → `error{failure: refused}` | as today | error | none (the store was reached) |
| **R8** recovery: `online`, tab shown, Retry, next open | A read → `change` without `stale` | 1 | `change` clears an error state (:508) | clears |

**Reach comes from state, not from the last event:**

- `down` from an ask whose failure is unreached, until the next `change`.
- Else `unreached` while answering from the set with an unreached `cache.failure`.
- Else `ok`.

**`recheck()`:**

- `down`: runs `load({ force: true })`.
- `unreached`: runs `cache.recheck(cap)`, which reads behind and shows no loading overlay.
- `ok`: does nothing. Phase 9 widens this.

### 3. The IndexedDB keep (D2 B)
*From minimal: reuse `IdbStore` with no refactor, and forget on 401. From robust: export from `sherpa-ui/data`, saves are written too, the age limit and quota handling. Added: a bounded wait.*

**The opt-in is in the app's code, where it makes the store** (`src/core/browser/cache-keep.ts`, exported beside `localRecords` at `src/data.ts:64-70`):

```js
const kept = keepCache(remoteCustomers, { name: `customers:${tenant}`, version: 1 }); // → { ready, forget() }
await clearKept();   // sign-out: every record, and each kept store's memory set
```

- It is not a page-definition key, because two pages could disagree and a server should not decide what is kept on the device.
- It is not a provider option, because then it would work only under a provider.
- On a store that is not `remote`, or never can be held, it reports `cache-keep-never-held` once and does nothing.

**Storage:**

- `new IdbStore({ name: 'sets', database: 'sherpa-cache', key: 'name' })`, reused as it is. One record per store goes in through `putAll([record])` (`idb-store.ts:261`).
- It has its own database, so the app's `version` can never move it (`idb-store.ts:144-154`).
- The record is `{ name, v: 1, version, key: store.key, savedAt, rows, dropped?, issues? }`.

**What is written, and when:**

- Only a set confirmed this session (gen ≥ 1 and not due).
- After a whole read lands.
- After patches, once quiet for 2 s.
- Always in idle time: `globalThis.requestIdleCallback`, else a timer.
- `take()` runs only at write time, so a run of saves costs one write.

**What is not written:**

- A set over 50,000 rows (an option).
- A set refused for size. That also clears the record.
- After a `QuotaExceededError`, the record is cleared, `cache-keep-full` is reported once, and writes stop for the session.

**How it is read at start:**

- `keep()` starts the read at once, and `cache.hold()` waits for it.
- The wait is bounded at 1 s. If the copy arrives late, it is ignored once a read has landed.
- The record is ignored and removed when `v`, `version` or `key` differ, or when it is older than `maxAge` (7 days).
- Rows are keyed again with `keyRow(row, readField(row, store.key))` (`row-key.ts:28`), because keys live in a WeakMap beside each row (`row-key.ts:13`) and IndexedDB drops them.
- The restored set is gen 0. It is applied only if no set exists and no change was heard first; a change heard first marks it due.

**"Checked again when the session starts":** gen 0 is always unsure. The first page that uses the store draws the copy (`held-stale`) and reads behind it:

- A read that lands gives a gen 1 set, and that set is written.
- An unreached failure gives the warning.
- A 401 forgets the copy.

The History is never kept, so ground zero holds.

**When IndexedDB is absent** (`IdbStore.available` false, `idb-store.ts:111-118`, or the open fails):

- No port is attached, `cache-keep-unavailable` is reported once, and the cache works in memory only.
- A failed open is not cached.
- This is deliberately unlike `T-idb-is-the-only-real-local-store`. A cache is never the only copy, so missing it is a miss, the same principle as `web-storage.ts:10`.
- It never falls back to Web Storage (`T-local-store-is-not-for-bulk-data`).
- `cache-keep.ts` goes on the headless-safe list (`eslint.config.js:90`) and listens to no `document` event.

### 4. The banner
*From robust: the source owns its state and the provider reads it before listening; custom states; per-kind words; `online` and tab-shown recovery; reach kept across `close({ next })`. From minimal: banner only for unreached kinds, Retry and Dismiss with the container's words, a direct call instead of `data-refresh`, and the CSS that keeps CLS at 0.*

**Who owns what:**

- Each source owns its `reach`.
- The provider reports the page's reach.
- The outlet draws the banner. The outlet is the content area's one block (`sherpa-outlet.css:2`) and sits in the shell's one scroller, `.context-frame` (`sherpa-app-shell.css:188-195`; Demos `index.html:79`).
- The shell is a display component and may not know the app layer (`eslint.config.js:70-83`).
- A page with no outlet uses `provider.reach` and `reach-change` itself.

**The provider:**

- **`get reach(): { reach: 'ok' | 'unreached' | 'down'; failure?: Failure }`** is the worst over its sources.
- **`reach-change`** fires when that value changes. It gets a `Fires:` line in `sherpa-provider.html`.
- **`recheck()`** rechecks every source that is not `ok`.
- **When it reads reach:**
  - `#watchStates` (:496) reads each `source.reach` before it adds its listeners, then again after each `change` (:506) and `error` (:514).
  - It keeps the last value across `close({ next: true })` (:349-353), so going between two pages over one down store does not flicker.
  - `prepare(null)` (:342), or a page with no source, clears it.
- **Recovery:** it listens for `online` and for `visibilitychange` to visible, with its own signal, and calls `recheck()`.

**The outlet's template** (`sherpa-outlet.html`; it imports `sherpa-callout` and `sherpa-button`):

```html
<!-- No height: a late banner never moves the Context. TRAP T-a-reach-banner-takes-no-room -->
<div class="reach" part="reach">
  <sherpa-callout class="reach-unreached" data-status="warning" data-heading="Unable to reach data">
    <span>The last data is still shown, and may be out of date. <span class="reach-why"></span></span>
    <span class="reach-actions">
      <sherpa-button class="retry" data-size="sm" data-look="saturated">Retry</sherpa-button>
      <sherpa-button class="dismiss" data-size="sm">Dismiss</sherpa-button>
    </span>
  </sherpa-callout>
  <sherpa-callout class="reach-down" data-status="critical" role="alert" data-heading="Unable to reach data">
    <span>There is no data to show until it can be reached. <span class="reach-why"></span></span>
    <span class="reach-actions">…the same two buttons…</span>
  </sherpa-callout>
</div>
<slot data-accepts="content"></slot>
<template class="words">
  <span data-word="offline">The network could not be reached.</span>
  <span data-word="timeout">The server took too long to answer.</span>
  <span data-word="server">The server had a problem.</span>
</template>
```

**What the outlet does:**

- In `start()` (:110), before the first `#load` (:144), it runs `this.on(provider, 'reach-change', …)` and reads `provider.reach` once.
- It sets the private states `reach-unreached` and `reach-down` with `toggleState`, never a public `data-*`.
- It writes `this.word(failure.kind)` into `.reach-why` after the state turns on, so a screen reader hears a change inside a shown live region.
- **Retry** calls `this.#provider?.recheck()`.
- **Dismiss** sets `reach-dismissed` until the reach changes.
- It never sets `data-dismissible`, because a callout's own close removes it (`sherpa-callout.ts:28-31`).

**Warning or critical:**

- **Warning** for `unreached`: the last data is shown.
- **Critical** for `down`: nothing to show. The cards also show their own error with Retry, as today.

**How it clears:** on reach `ok`, on a page with no data, or on Dismiss.

**Accessibility:**

- The warning keeps the callout's default `role=status` (`sherpa-callout.ts:21`).
- The critical callout has `role="alert"`, and the author attribute wins (`T-aria-defaults-live-in-internals`, `sherpa-element.ts:325-328`).
- Focus does not move.

**No layout shift:**

```css
.reach { display: none; position: sticky; inset-block-start: 0; block-size: 0; z-index: 3; }
:host(:is(:state(reach-unreached), :state(reach-down)):not(:state(reach-dismissed))) .reach { display: block; }
.reach > sherpa-callout { display: none; position: absolute;
  inset-block-start: var(--sherpa-layout-grid-padding, 16px); inset-inline: var(--sherpa-layout-grid-padding, 16px); }
:host(:state(reach-unreached)) .reach-unreached, :host(:state(reach-down)) .reach-down { display: block; }
```

- The row has no height, so CLS is 0 whenever the banner shows or goes.
- `sticky` keeps it at the top of `.context-frame` while the Context scrolls.
- `.content` keeps it under the nav rail (`isolation: isolate`, `sherpa-app-shell.css:75`).
- Its shadow uses the container's `md` elevation recipe (`sherpa-container.css:41-44`).

### 5. Commits, smallest first
*Order from robust (cache before UX, so nothing is written twice), with minimal's specific test cases added. Robust's `openIdb` refactor and LRU budget are dropped.*

Rules for every commit:

- Every remote act after open stays at 0 asks (`asked()`, `check-bench.mjs:268-271`).
- Baselines change only on purpose.
- The `#age` rule (finding 1) is in every commit from 4.2 on.
- `npm run map:write <file>` is the last step.

| # | Change | Proof | TRAPs and docs |
|---|---|---|---|
| **4.1** Failure kinds; a spoof that fails later | `failure.ts`; `navigator` banned; spoof `delay` and `fail` take functions, failures are `TypeError`, `totalCount` fails; WeakRef relay. **Demos:** one wrapper (§1) | node `a-failure-has-a-kind.test.mjs` (every row of the table, over `HttpError` 401/403/404/408/429/500/503, `TimeoutError`, `TypeError`, `ValidationError`, `SyntaxError`, `AbortError`, `Error`, a string). Node `a-spoof-fails-when-told.test.mjs`: flipped mid-run; `totalCount` fails; a child `node --expose-gc` run where 100 dropped wrappers relay nothing. `npm run lint`; bench unchanged; Demos `reforged-card-data-states` and `reforged-remote-source` green | New `T-a-failure-has-a-kind`. Correct `TRAPS.md:3670-3671` and `TODO.md:899-900`. `OutletOptions.stores` doc |
| **4.2** One cache per store | `store-cache.ts`; `Store.announcesAll` (+ spoof pass-through and override); sources join the cache; the closed-source guard; `close()` keeps the set. K2 reopen still waits | node `a-store-has-one-cache.test.mjs`: 2 sources make 1 whole read; an unkeyed change with 2 open makes 1 read (today 2); a keyed insert is patched once and both show N+1; a change heard while no page is open is in the next first answer; after the set moves, `results()` counts again (`#age`); a closed source's `load({force})` leaves the set fresh; a smaller cap asks the store and leaves the set; K1 reopen makes 0 loads; K2 reopen makes 1 load before the first `change`. Bench: a new last act, `remote/reopen` (close, `openSource` over `p.store`, bind again) at **0 asks with no exemption**. `a-closed-source-hears-nothing`, `a-held-set-takes-a-change-in-place` and e2e `reforged-provider-closes-its-sources` green | New `T-a-store-has-one-cache`. Edit `T-a-remote-source-holds-its-whole-set` (per store; said once per store), `T-a-held-set-takes-a-change-in-place` (patched once, by the cache), `T-a-closed-source-hears-nothing` (the set stays). DATA-SOURCE-RULES rule 10 and HELD (`:263-295`). PAGE-DEFINITION `holdRows` (`:84-87`) |
| **4.3** The decision as a function; K2 shows its data at once | `read-plan.ts`; `#hold()` goes through it; `held-stale` plus one behind read; `DataChangeDetail.stale` | node `the-read-plan.test.mjs` (every row). Node `a-reopen-checks-behind.test.mjs`: K2's first `change` has `stale` after 0 loads, then 1 load, then `change` without it. Bench page `rest/` (spoof `announcesAll:false`): `rest/open` and `rest/reopen` make exactly 1 load (an exact rule beside `asked()`), the rest 0. Demos: Records → Dashboard → Records with `?remote` shows rows within 100 ms | Edit `T-a-store-has-one-cache` (unsure → behind) |
| **4.4** A failed read keeps the set; reach is a state | Per-kind failure handling; `reach`, `recheck()`, `error.failure`, `debugState`, `store-unreached` | node `a-failed-read-keeps-the-last-set.test.mjs` over a spoof with `fail: () => n`. Down + Refresh gives `change{stale}`, the same rows, no `error`, reach `unreached`. While stale, the 12 bench toggles make 0 loads, counts and distinct reads. A keyed insert while stale is taken with 0 loads. Up + `recheck()` gives a `change` with no stale and reach `ok`. A 401 gives `error`, `held` null and reach `ok`. Down from open gives `error` with `failure` and reach `down`. Bench unchanged | New `T-a-failed-read-keeps-the-last-set`. Edit `T-error-is-a-state-not-a-throw`. DATA-SOURCE-RULES §6 "A failed load is a STATE" (`:297`) and short-version items 7 and 12 |
| **4.5** The provider reports the page's reach | `reach`, `reach-change`, `recheck()`; reads before it listens; `online`/visible; kept over `close({next})` | e2e `reforged-provider-reach.spec.ts` (×3 engines): stale, then ok after `dispatchEvent(new Event('online'))`; down from the start; no `reach-change` between two opens over one down store; a 401 leaves reach `ok`. `spec:check`, `manifest`, `reference` | New `T-the-provider-says-the-pages-reach`. PROVIDER-DESIGN note. APP-GUIDE: a page with no outlet listens for `reach-change` |
| **4.6** The banner (Will checks it by eye) | Outlet template, words, CSS, states, Retry, Dismiss | e2e `reforged-outlet-reach-banner.spec.ts` (×3): each callout shown only for its own state; `role=alert` on critical; words from markup; the first card's box unchanged; a `layout-shift` observer sums 0 (Chromium); `elementFromPoint` hits the callout (pixels, not computed style); Retry calls `recheck()`; Dismiss holds until the reach changes. `test:a11y`. `check:weight -- --update-baseline` on purpose. Demos `reforged-reach-banner.spec.ts`: `?fail=1` gives critical; `?remote` + fail + Refresh gives warning with 100 rows; off + Retry clears it. Demos `reforged-panel-mode-does-not-shift` stays green | New `T-a-reach-banner-takes-no-room`. Edit `T-a-container-shows-its-datas-state` (stale has no card state; the page banner sits beside the cards) |
| **4.7** The keep (D2 B) | `cache-keep.ts`; `StoreCache.keep`; exports. **Demos:** `keepCache(remoteCustomers, { name: 'demos-customers' })` | e2e `reforged-a-kept-set-survives-a-reload.spec.ts` (×3): reload with the store failing shows the rows, `stale` and the warning; a selected row keeps its key; reload online makes 1 behind read and rewrites the record; a save is in the record after quiet; `version` or age drops it; `clearKept()` and a 401 empty it; `indexedDB` throwing (`addInitScript`) leaves memory only; a stalled open does not hold the page past 1 s. Node: `keepCache` in Node is a no-op with one report. Demos `reforged-kept-set.spec.ts` | New `T-a-kept-set-is-checked-each-session`. Edit `T-idb-is-the-only-real-local-store` (a row: a cache degrades). DATA-SOURCE-RULES "When the store cannot be reached". APP-GUIDE (make each store once; `keepCache`; `clearKept` at sign-out). PAGE-DEFINITION: no key, the keep is the app's |

Each commit also updates TODO 345's progress line.

### 6. Risks, and what needs Will
*Risks merged from both. Decisions cut to the two real ones.*

**W1: where the banner sits.**
- **A (pick):** it floats over the top of the content area and takes no room. CLS is 0. While shown it covers about 60 px (Records' data bar) until Dismiss or recovery.
- **B:** it sits in the flow and pushes the Context down. It covers nothing, but the page moves each time the banner shows or goes. 4.6 measures how much.

**W2: a kept copy on a reload while online.**
- **A (pick):** draw the kept rows at once and check behind them. The first paint is faster (an LCP gain), but rows can change about one round trip later.
- **B:** online, wait for the read, and use the kept rows only if the read fails. The data is always current, offline still works, and there is no LCP gain.

**Names to settle:** `keepCache` / `clearKept`, `Store.announcesAll`, reach `unreached` / `down`, `reach-change`, `recheck()`, `sherpa-cache`.

**Small calls I made (say if any is wrong):**
- The words in §4.
- Retry and Dismiss, reusing the container's words.
- The banner shows only when the store could not be reached. A 401 or a bad reply stays on the card.
- The cards keep their own error beside a critical banner.
- A 401/403 forgets the kept copy.
- Kept copies last at most 7 days.
- The restore wait is bounded at 1 s.
- Saves are written to the keep after 2 s of quiet.
- The session check is lazy: it runs on the first page that uses the store.
- IdbStore and LocalStore are not `announcesAll`.
- There is no retry timer before phase 9.

**Risks:**
- **A `TypeError` from a bug in a custom store reads as "offline".** The message stays in `failure.message`, `debugState()` and the `store-unreached` report.
- **Data at rest:** the kept rows outlive the session. The `name` must carry the user or tenant, and the app must call `clearKept()` at sign-out.
- **Writing the keep clones up to 50,000 rows on the main thread.** It is done in idle time after quiet. Measure it in 350.
- **A K2 reopen draws twice.** Rows can move after about one round trip.
- **Value lists come from the set at open.** A behind read that lands does not declare them again, which is the same gap as today's Refresh. Phase 5 closes it.
- **One cap per page:** a page with a smaller `holdRows` asks the store.
- **Memory:** one set per remote store lives for the session. This is not measured, and there is no budget yet.
- **Demos `/debug/remote` and `/debug/fail` are persisted** (Demos `index.html:301-303`). `?fail` after a `?remote` session shows the kept rows with a warning, not the card error. That is D2 B by design, and fresh Playwright contexts keep the specs green.
- **Tabs do not hear each other.** The last write wins, which is harmless because every session checks its copy again.
- **The live regions** need a check by ear in VoiceOver, because axe cannot prove an announcement.
- **A focused control under the banner can be hidden.** WCAG 2.2's 2.4.11 is outside the 2.1 AA gate. Dismiss is the way out.

---

# Check against the code (a second read-only agent)

**Wrong**

1. **The design's baseline is out of date.** It says HEAD is `30e4f4f5` and the working tree is clean.
   - HEAD is now `b744cba1`, four commits later (`4dee8902`, `69dd2dcf`, `798fd439`, `b744cba1`).
   - `git diff --stat 30e4f4f5 HEAD -- src` touches only `sherpa-quick-filter-toolbar.ts`, `sherpa-quick-filter.css`, `sherpa-style-modes.css` and `tokens.css`. No cited code file has moved.
   - Doc drift: `TODO.md:899-900` is now `:900-901`. `TRAPS.md:3670-3671` is unchanged.

2. **The Demos line numbers are from Demos `b731331`.** At Demos HEAD `7049522`, commit `d15cd53` edited `app/index.html`, and each cited line moved down by 2:
   - `<sherpa-outlet>` is at `:81`, not `:79`.
   - The `persist('/debug/…')` lines are at `:303-305`, not `:301-303`.
   - `stores()` is at `:620-627`, with `spoofRemote(...)` at `:624`, not `:618-623`.

3. **The evidence for finding 4 does not show an IndexedDB stall.** The design cites a "WebKit boot hang" at Demos `reforged-card-data-states.spec.ts:61`.
   - That comment points to TODO 204. TODO 204 (`TODO.md:2345-2369`) found a `page.reload` sent while fetches were still open (the `/live/files` stream): "Not Sherpa and not the server".
   - `IdbStore.#db` rejects on `onerror` and `onblocked` (`idb-store.ts:166-167`) and never caches a failed open (`:170-171`).
   - The 1 s bound may still be wise, but no source given shows an IndexedDB open that stalls.

4. **"K1: ArrayStore, JsonStore say `announcesAll: true`" (`stores.ts:42`, `:152`).**
   - Only `RestStore` (`stores.ts:267`) and `spoofRemote` (`spoof-remote.ts:34`) are `remote`, and `#mayHold` needs `#remote` (`data-source.ts:1713`). A plain ArrayStore or JsonStore is never held, so in practice K1 is only a spoof over one.
   - JsonStore does not announce every change. `invalidate()` (`stores.ts:227-229`) makes the next load fetch the URL again, with no `change` event.

5. **R4's "Whole read fails (`values-unread`, `field-catalogue.ts:151`)" is not quite right.** The whole read's failure reports `held-set-refused` (`data-source.ts:1736-1738` → `:1751-1759`). `values-unread` (`field-catalogue.ts:151-155`) comes from the store read that follows in `declareFromRows` (`data-source.ts:963-966`). That is two reports, not one.

6. **The critique of minimal's Retry (`provider-ambiguous`, `sherpa-provider.ts:152-153`, `:814-834`) has the right mechanism but cannot happen on an outlet page.** `open()` always gives one source, `{ [definition.id]: source }` (`sherpa-provider.ts:307`). Only a hand `provide()` gives two, and Demos makes no such call.

7. **Small inaccuracies in §4:**
   - The outlet need not import `sherpa-button`, because `sherpa-callout` already imports it (`sherpa-callout.ts:11`).
   - The container's `md` recipe (`sherpa-container.css:41-44`) reads `--_shadow-color`, which is private to the container (`:27`). The outlet must declare its own.

**Missed**

1. **`check:size`** (`.githooks/pre-commit:168`, `scripts/check-size.mjs`): line counts may only fall. Files that will grow, with their current baselines in `size-baseline.json`:
   - `sherpa-provider.ts` 841, `sherpa-outlet.ts` 402, `spoof-remote.ts` 63, `stores.ts` 513, `data-source-types.ts` 282, `idb-store.ts` 396.
   - `sherpa-outlet.html` 33, `sherpa-outlet.css` 10, `sherpa-provider.html` 44.
   - New files are reported. Every commit needs `--update-baseline` on purpose, and the design never names this gate.

2. **`check:weight` growth comes earlier than 4.6.** `data-source.ts` is in the graphs of `data.js` (102,688 bytes), `app.js`, `index.js` and `sherpa-provider.js` (via `openSource`, `sherpa-provider.ts:26`). So 4.1-4.5 and 4.7 grow these too, and only 4.6 updates the baseline.

3. **`check:bench`:**
   - It throws on any `report()` during an act (`check-bench.mjs:244`). So `held-set-refused`, `store-unreached` and `cache-keep-*` must stay silent on the bench pages.
   - The new `remote/reopen` act and the `rest/*` page are "not in the baseline" (`over()`, `:276-285`). So 4.2 and 4.3 need `--update-baseline`.
   - `ACTS` is shared by every page (`:192-211`), so `reopen` also runs as `records/reopen` and `rest/reopen`.

4. **4.6 leaves out `spec:check`, `manifest` and `reference` for `sherpa-outlet`.** The template gains `part="reach"` and words, and `sherpa-outlet.html:10` says "Public API: none". The hook runs `check:manifest` (`:189`) and `check:reference` (`:198`). `docs/components/sherpa-outlet.md` is regenerated too.

5. **`check:traps`** (`.githooks/pre-commit:61`): the six new traps each need a Site list that matches their citations, plus `npm run traps:write` for `TRAPS-INDEX.md`.

6. **JsonStore errors carry no status.** It throws a plain `Error` with the status only in the message (`stores.ts:191-192`). So `failureOf` gives `unknown` for a JsonStore 401 or 5xx: not `refused` or `server`, and no banner.

7. **`LiveStore` (`live-stores.ts:40-160`) is not covered.** It forwards a fixed list of members, and `plan-345.md:56` and `:233` require every wrapper to pass new members on. EventStore and SocketStore announce every push, so they are K1 by nature, but the design neither sets nor forwards `announcesAll` for them. They are not held today, but `spoofRemote(eventStore)` would read as K2.

8. **Sherpa Gallery calls the spoof.** `lib/fake-data.js:74-79` uses `spoofRemote(store, { delay: 1500 })` and `{ delay: 600, fail: 1 }`. The thrown error's type changes, and the "failing" story will now report reach `down`. It makes a new inner store and wrapper on each open, so it does not leak. Sherpa Starter (`template/index.html:38`) already passes the same object each time.

9. **The 343 test** `test/e2e/reforged-provider-opening.spec.ts` is in no commit's proof.
   - It stays green, because it makes a new store on each run (`:18`).
   - But its premise in `TRAPS.md:1335-1340` ("`openSource()` reads a remote store's whole set before the provider holds the source") becomes true only on a first open.
   - It should be named in 4.2 and 4.3, with a reopen case beside it: R1 and R2 mark no card.

10. **DATA-SOURCE-RULES needs more edits than the design names.**
    - §4's `Store` interface (`:141-152`) and "Announce every change" (`:159-161`) need `announcesAll`, and so does short-version item 5 (`:392`).
    - In HELD, "a failed whole read… asks your store as before until a Refresh" (`:283-285`) changes in 4.4.
    - `QUERY-DESIGN.md:218` describes the spoof's options as numbers.

11. **`a-held-set-takes-a-change-in-place.test.mjs:81` and `:90` set `rowOrder` on the spoof wrapper after it is made.** The cache must read `store.rowOrder` when it patches, as `HeldSet.patch(change, store)` does today (`held-set.ts:43`), and never take a copy of it once.

12. **`close({ next: true })` itself provides `{ sources: {} }` (`sherpa-provider.ts:352`).** The rule that "a page with no source clears reach" must leave out this step (`shut=false`), or the "kept across `close({next})`" promise cannot hold.

13. **The leak is worse than finding 2 says.** Each pinned wrapper still relays every inner change (`spoof-remote.ts:29-31`). A cache that listens "for good" to each leaked wrapper would patch every visit's set on each change: a CPU leak as well as memory.

14. **The 4.7 Demos call `keepCache(remoteCustomers, { name: 'demos-customers' })` breaks the design's own rules.** It has no `version` and no user or tenant, which the design's own risk note says `name` must carry.

**Confirmed (about 100)**

- **`data-source.ts`, 31 citations:**
  - Fields and constructor: `:222/224/226/228/231/233/235`, the 50,000 default at `:246`, the listener at `:256`.
  - The eight `#hold()` sites: `:962, 1779, 1859, 1891, 1971, 2075, 2098, 2223`.
  - The `force` branch at `:1639-1642`, `#onStoreChange` at `:1661-1671`, `close()` at `:1681-1686`, `#reads` at `:1696`, `#hold`/`#mayHold` at `:1702-1718`, the re-reads after an overtaken read at `:1725` and `:1735`, `#refuse`/`#sayNotHeld` at `:1745-1760`.
  - The `#age` caches at `:1804, 1925, 2094, 2154`.
  - `#age` is bumped only at `:1640` and `:1662` and by the declares (`:585, 711, 937, 950, 1028`).
- **`sherpa-provider.ts`, 9:** `:97, 152-153, 342, 349-353, 496, 506, 508, 514-519, 541`.
- **`sherpa-outlet.ts`, 4:** `:33, 110, 144, 317`.
- **Other source files:**
  - `sherpa-outlet.css:2`; `sherpa-app-shell.css:75` and `:188-195`; `data-source-types.ts:277`.
  - `eslint.config.js:56-67`, `:70-83` and `:90-99`. `navigator` is not banned today.
  - `stores.ts:42, 152, 366, 379`; `spoof-remote.ts:29`.
  - `idb-store.ts:111-118, 123-173, 144-154, 261`; `row-key.ts:13` and `:28`; `web-storage.ts:10`; `data.ts:64-70`.
  - `sherpa-callout.ts:21` and `:28-31`; `sherpa-element.ts:325-328`; `sherpa-container.css:41-44`; the container's Retry and Dismiss words at `sherpa-container.html:51-52`; `check-bench.mjs:268-271`.
- **Tests and docs:**
  - `query.test.mjs:377`; Demos `reforged-card-data-states.spec.ts:39`.
  - `TRAPS.md:3670-3671`; `TODO.md:899-900` (at `30e4f4f5`); `plan-345.md:106` (0 loads); `PAGE-DEFINITION.md:84-87`; `DATA-SOURCE-RULES.md:263-295` and `:297`, and short-version items 7, 10 and 12.
- **Names:** all 9 existing TRAP ids exist. The 6 new TRAP ids and the 4 new file names are free. `reach`, `recheck`, `announcesAll` and `reach-change` are unused.
- **Behaviour claims:**
  - The spoof's relay pins its wrapper, Demos makes a new wrapper on each load, and the docs say the opposite.
  - A closed source's `load({ force: true })` runs `#letGo`.
  - `prepare()` and `close({ next })` are still there.
  - `the-data-entry-loads-no-dom.test.mjs` reads `eslint.config.js`, so adding `cache-keep.ts` to the headless-safe list satisfies it.

The design's critiques of the robust and minimal drafts could not be checked: those two drafts were not given to me.