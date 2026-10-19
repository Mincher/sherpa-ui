# TODO 345: Plan to fetch each field on demand and cache it

This was a read-only pass. I ran `npm run map src/core/data` and `npm run check:bench` and nothing else. The bench reports "26 acts within the baseline". I changed nothing.

345 is an EXPLORE item, so nothing gets built until Will says go. None of this moves a source to the server. That is TODO 170, which waits on Will.

## 1. What happens today, in numbers

Demos Records with `?remote` uses `customerStore`, an IdbStore (Demos `app/stores/records-data.js:132`). Demos wraps it in `spoofRemote(…, { delay: 800 })` (Demos `app/index.html:622`). It makes a new wrapper on every Context open (`sherpa-outlet.ts:313` calls `options.stores()`).

| Case | Store calls at open | What moves |
|---|---|---|
| Records `?remote` (held) | 1 call: `load({ take: 50001 })` with no filter (`data-source.ts:1690`) | 100 rows × all 14 fields |
| Bench `remote/open` (held) | 1 load, 0 counts, 0 distinct | 10,000 rows × all 15 fields |
| Records, not held (`holdRows: 0`, a failed whole read, or a RestStore with no `totalPath`). I traced this but did not run it. | 3 loads. (1) The values: `distinct` at `:964` if the store has one, else a whole load at `:965`. IdbStore and RestStore have no `distinct`. (2) The page, at `:1748`. (3) The unpaged rows, at `:1767`. That load runs only while a summary binds `rows: 'all'` and the page is windowed or split. Records has charts and metrics. | Each load: every matching row × all fields. Each answered chip's count is one more whole load (`base-store.ts:70-74`). |
| Each of the 12 remote bench acts after open | 0 loads, 0 counts, 0 distinct | nothing |

- **No load can ask for only some fields.** `LoadOptions` has no `fields` (`store.ts:171-182`).
- **A RestStore has no `distinct`** (`stores.ts:256-361`). Its count is a whole load with no `take` (`base-store.ts:70-74`).
- **A store `change` reads the whole set again.** The path is `data-source.ts:256-259`, then `load({ force: true })` at `:1638`, then `#letGo` at `:1728`, which drops the set. On Demos, each save costs one 800 ms whole read.
- **One source owns the held set** (`data-source.ts:221`). Each Context open makes a new source (`page-definition.ts:66`, `sherpa-provider.ts:279`). So each open reads the whole set again.
- **A listener leak.** I found this by reading and did not run it.
  - A source never removes its store listener (`data-source.ts:256`). The file has no `removeEventListener`.
  - `spoofRemote` never removes its own listener (`spoof-remote.ts:29`).
  - So every old source still runs `load({ force: true })` on each change. On a remote store that is a whole read. On a local store it is a page load.
- **Records needs every field at open.**
  - The grid shows 14 of 14 fields (Demos `view-schemas/records.json:53-68`). The data scope has `offers: "all"` (`:39`).
  - The metrics and charts read `created`, `seats`, `spend` and `openTickets` (Demos `templates/records.html:15-23`).
  - The saving shows only on a store that has fields the page never shows.
- **Some values already need no fetch.** A field whose schema states its values is skipped (`field-catalogue.ts:139-143`). On Records these are `customer`, `status`, `plan`, `tier` and `region`, through `oneOf` (Demos `records-data.js:97-110`).
- **The source reads values before it knows what the page holds.** `openSource` calls `declareFromRows` at `page-definition.ts:77`. The holds, presets and sets come later, at `:78-109`.
- **No store says which fields changed.** `StoreChangeDetail` is `{ type, key?, row? }` (`store.ts:235-239`). No change time is kept in `src/core/data`. The only clock there is "today" for relative dates (`store.ts:142`, `:157`).
- **A filter menu has no loading state.** The word "loading" is not found in `src/core/sherpa-filter-menu.html`, `core/ui/filter-menu.ts` or `sherpa-quick-filter`. Values that arrive late redraw nothing, because `declareValues` only writes the catalogue (`data-source.ts:938-940`).

## 2. The design

**The main idea: Sherpa holds the fields the screen uses, one field at a time. It keeps each field until the store says that field changed.**

For a held source, "values on demand" becomes "a COLUMN on demand": the key plus one field, for every row.
- The values then come for free from the column (`distinctOf`).
- A later toggle on that field stays on the client.
- 340's rule needs the rows, not only the values. Will's 345 example names fields ("5 preset filters and 10 visible grid columns"), not a page of rows.

**The TRAP's sentence changes.** `T-a-remote-source-holds-its-whole-set` says "what it holds must not depend on which component is bound". After 345 it depends on the FIELDS the page asks for. It still never depends on a component's type (341).

Every new interface member is optional, so an old store works as it does today.

| Part | Where | Interface |
|---|---|---|
| **Field list** | No new member | The source already knows the page's fields: the definition's `fields` (`page-definition.ts:47`, `:75-76`), and `offers: "all"` means those fields (`:21-22`, `:95`). It also has the schema's `domains` (`store.ts:228`) and `time`. No phase needs more. |
| **Page need** | New `read-plan.ts`, `needOf()` | It reads the scope holds, the preset `where` fields, the search fields, the sort, the group, the time field and the key. It also reads a new `AttachFacts.fields?` (`data-source-types.ts:201-221`). The provider fills that from a grid's `columns` config and a summary's spec, near `sherpa-provider.ts:612-633`. It is a data shape, not a component word (341). |
| **Columns on demand** | `held-set.ts:17-50`, `store.ts`, `stores.ts` `defaultQuery` (`:386-396`) | New `LoadOptions.fields?` and `Store.projects?`. `projects` must be declared, because the client cannot tell when a server ignores `fields=`. The HeldSet holds the keys plus one column per field, each with its own marker, and gets `covers(need)`. It needs a real key: a made-up key cannot join two reads. |
| **Values on demand** | `field-catalogue.ts` `fromRows` (`:138`); `DataSource.hold()`, `request()`, `answerColumn()` (`:2230`) | Every way a field reaches a scope goes through these three methods, so `bind-source.ts` does not change. A held source reads values from its column. A store that is never held uses `distinct`; a new `RestStoreOptions.distinct?` URL gives RestStore one. |
| **Decision series** | `read-plan.ts` `planRead(need, held, history, reach)`, a pure function. One `#ready(need)` replaces all 8 `await this.#hold()` calls in `data-source.ts`: `:962`, `:1745`, `:1818` (`results`), `:1850` (`valueResults`), `:1926` (`present`), `:2030` (`offered`), `:2049` (`#settleSetAside`) and `:2167` (`allRows`) | Will's order: (1) Can held data answer? (2) Did a field it uses change since it was held? (3) Can the store be reached? An always-fetch field (Will's choice A) is one more input. The results are `held`, `held-stale`, `fetch(missing ∪ stale)`, `store` (never holdable, so today's path) and `none` (the error state). |
| **History and ground zero** | New `store-history.ts` (DOM-free), fed by `BaseStore.announce` (`base-store.ts:146`) | Each entry is a sequence number plus a `bigint` bitmap. Bit 0 means "rows changed", and field bits are added in order and never moved. `lastChanged[bit] = seq` makes each check one compare. New `StoreChangeDetail.fields?`: absent means every field, as today. New `Store.history?`. It resets each session (Will). The old row for the diff is at `stores.ts:109`, `:474` and `browser/idb-store.ts:224`. |
| **Wrappers pass the new members on** | `spoof-remote.ts:33-60`, `live-stores.ts:40-60`, `stores.ts:163` | `spoofRemote` copies a fixed list of members, so any new member is silently dropped unless it is added. `LiveStore` and `JsonStore` forward an inner `ArrayStore`. Each one must pass on `history`, `projects`, `distinct` and `changes`. |
| **Times** | `DataSource`, beside `#lastLoadKey` (declared at `data-source.ts:172`), and `Bound` (`source-binding.ts:39-58`) | `#loadedSeq` is the View update time. `Bound.seq` is the component update time. Code compares sequence numbers only, never two clocks. `SherpaElement` does not change. |
| **Remote History** | `stores.ts` RestStore | New `Store.changes?(since)`, which returns `{ at, fields, rows, whole? }`. A new `RestStoreOptions.changesUrl` turns it on. The wire carries field NAMES, so no bit order crosses it. `at` is an opaque cursor, and ground zero is the cursor in the first answer. |
| **Cache partner** | New `store-cache.ts`: a `WeakMap` keyed by the store, so one cache per store (app level, as rule 10 of DATA-SOURCE-RULES says) | It holds the rows, the columns and the value lists, each with its marker. `failureOf(error)` sorts a failure as offline, timeout, refused, server or invalid. It checks `status` by shape, so `store.ts` imports nothing from `stores.ts`. |
| **Loading and stale UI** | `src/core/sherpa-filter-menu.html` and `menuFor` (`core/ui/filter-menu.ts:73`); provider `#watchStates` (`:459-485`) | `filterDef()` carries `loading: true` until a field's values are read. The menu shows a `sherpa-loader` row through CSS. A stale source sends `change` with a new `DataChangeDetail.stale?` (`data-source-types.ts:277`). The card then shows its keep-content banner, "The last data is still shown." (`sherpa-container.html:47-48`), whatever the Experiments setting is. Without `data-keep-content` an error is an overlay over the body (`sherpa-container.css:144`, `:168`), which would hide the data the cache kept. There is no new banner (342). |

## 3. Phases, smallest first

Rules for every phase:
- Each phase ships alone.
- The 12 remote bench acts stay at 0 asks.
- A new bench act needs `--update-baseline`. When a cost falls, record the lower baseline too.
- Update `T-a-remote-source-holds-its-whole-set` and DATA-SOURCE-RULES.
- `npm run map:write` is the last step.

**Phase 1: Close a source.** This is a bug, so give it its own TODO row. It can still ship first.
- **Change:**
  - The source keeps its store listener in a field.
  - A new `DataSource.close()` removes the listener and drops the held set. An ask still in flight then lands on nothing.
  - The provider closes the old source in `open()` (`sherpa-provider.ts:264`) and in `close()` (`:312`).
  - Demos makes one spoof wrapper per setting, not one per open (Demos `index.html:618-622`).
- **Proof:** a node test runs `openSource` twice over one `spoofRemote(ArrayStore)`, closes the first source, then inserts once. The result must be 1 whole read; today it is 2.
- **For the reader:** a save after many Context visits costs one read. 350 puts this in reach.

**Phase 2: A change patches the held set.**
- **Change:** an `insert`, `update` or `remove` that carries a key changes the HeldSet in place.
  - An update MERGES its row into the held row. The row can be only the patch (`stores.ts:333`).
  - The update is found by the announced key, which is the OLD key (`T-a-changed-key-moves-the-row`).
  - After the patch, the source uses `#reask()`. It cannot use `load({ force })`, because `#letGo` drops the set (`:1728`). It cannot use `load()`, because a repeated key is skipped (`:1645`).
  - A change with no key reads the whole set again, as today: `setRows` (`stores.ts:62`), `putAll` (`idb-store.ts:278`) and `clear` (`idb-store.ts:184`).
  - A whole read in flight still bumps `#heldAge`.
- **Proof:** a new `save` act on both bench pages. `remote/save` must make 0 asks, and `asked()` holds it.
- **For the reader:** on Demos `?remote`, a save no longer waits 800 ms.

**Phase 3: History for memory stores.**
- **Change:** add `store-history.ts`, `StoreChangeDetail.fields?`, and pass `history` through each wrapper. A cached count, list or `present` runs again only when a field in its WHOLE filter changed (its own clause, its scope and the View), or when the rows changed.
- **Proof:**
  - Build a lean fixture, which Will's example describes: 15 fields, 10 shown, 5 held.
  - `lean/change-unused` makes 0 loads, counts and distinct reads.
  - In `records/change-plan`, the counts and distinct reads fall. The page load stays, because the grid shows `plan`.
- **For the reader:** less client work after a change. The server cost is already 0 after phase 2. This is client work, not 350's measured toolbar INP.

**Phase 4: The cache partner, in memory.**
- **Change:**
  - Move `#held` and its state (`data-source.ts:221-233`) into `store-cache.ts`.
  - `#letGo` marks the set stale instead of dropping it. A failed re-read keeps the stale set and sends `stale: true`. Add `failureOf`.
  - On reopen:
    - A store that announces every change uses the cache. That covers every in-repo memory store, and `spoofRemote` over one.
    - Before phase 9, a RestStore cannot know about other writers. It draws the cache at once, marked stale, and reads again behind it. This is Will's "Current" step: an unknown change counts as a change.
- **Proof:**
  - `remote/reopen` makes 0 loads. The bench must reuse its store, because `open()` makes a new `ArrayStore` each time (`check-bench.mjs:157`).
  - A store that fails AFTER open, then a store change whose re-read fails: the 12 acts still make 0 asks, `change` carries `stale: true`, and no `error` fires.
  - `spoofRemote`'s `fail` is fixed when the wrapper is made (`spoof-remote.ts:25`, `:42`), and `fail: 1` also fails the open. So the test needs a way to fail later.
- **For the reader:** going back to Records is instant. If the network drops, the data stays on screen, marked stale.

**Phase 5: Values on demand, and a menu loading state.**
- **Change:**
  - `openSource` declares the holds, presets and sets first, then reads values only for the need. Today `:77` runs before `:89-109`. The need is the holds, the preset fields, the start-Query picks, the chart and legend fields, and the filterable grid columns (Will's example counts the visible columns).
  - `hold()`, `request()` and `answerColumn()` start a field's read at once.
  - When a list lands, the source declares it, redraws the scopes that hold the field, and composes again, because "everything ticked" becomes "no filter" (`filter-state.ts:346-354`).
  - The `loading` mark goes on `filterDef()`. `describe()` (`:737`) and `addable()` (`:1067`) only read `filterDef()`, so they do not change.
  - The loader row goes in `sherpa-filter-menu.html`.
- **Scope:** this gains nothing on a held store, because `HeldSet.distinct` answers on the client (`held-set.ts:46`). It helps stores that are not held.
- **Proof:** a `notheld/` bench page (`holdRows: 0`, a store with `distinct`) with a new counter for the fields asked:
  - Open asks only the fields in the need.
  - `notheld/add-field` asks for 1 field.
  - The repeat asks for 0.
- **For the reader:** a store that cannot be held opens with a smaller read. A menu that opens early shows loading. Reading later also helps 350's LCP lead, "openSource() reads the rows and their values before any component is answered".

**Phase 6: Always-fetch fields (Will chose A, 2026-10-19).**
- **Change:**
  - A field fact comes from three places: the page definition (`fields.<name>.fetch: "server"`), the filtering component (`data-fetch-fields`) and a grid column's config. Each can only turn it ON. Names to settle with Will.
  - The provider hands it to the source. `filterDef()` says `commit: true`, so every menu for that field has Apply (`filter-menu.ts:100`).
  - Apply asks the store once for the KEYS that match that field's clause. That is a whole-row load until phase 7, then `fields: [key]`.
  - The source keeps that key set and joins it with what it holds. So the field's toggle, the Switch and a cycle stay client updates (340).
- **Proof:** on the lean page with one always-fetch field, `lean/apply-fetch` makes 1 ask, and its toggle off and on makes 0.

**Phase 7: Projected reads, with no change in behaviour.**
- **Change:**
  - `LoadOptions.fields`, `Store.projects` and RestStore `fields=`.
  - HeldSet columns, joined by a real key.
  - A projected row is checked only on the fields that were sent. `rules()` can do this (`validateField`, `validate.ts:293`). A schema from another library cannot, so its store is never PROJECTED. It can still be held whole.
  - The need is still every page field.
- **Proof:**
  - The 26 acts are unchanged.
  - A node test joins two column reads by key.
  - A row with no `name` (not sent) passes Demos' schema, where `name` is `required()`.

**Phase 8: The decision series.**
- **Change:**
  - `needOf`, `planRead` and `#ready` across the 8 sites.
  - The provider fills `AttachFacts.fields`.
  - The need is gathered over one tick (`timing.ts` `coalesce`). The first load starts at the first attach (`data-source.ts:2160`), and `openSource` runs before any component is bound.
  - A search with no `searchFields` needs every field, so it gets no projection (`store.ts:512`).
- **Proof:** a new `cells` counter (rows × fields).
  - `lean/open` reads exactly the need.
  - `lean/add-field` makes 1 projected load, and the repeat makes 0.
  - Records does not change, because it shows 14 of 14.
- **For the reader:** a wide store moves only the fields the page uses.

**Phase 9: Remote History.**
- **Change:**
  - Add `changes(since)` and `changesUrl`.
  - `spoofRemote` builds `changes()` from the inner store's History (phase 3), so the bench can prove it.
  - `counted()` counts it, and it is added to `ASKS` (`check-bench.mjs:91`, `:244`).
  - When it is asked is D1.
- **Proof:** in `remote/changed-field`, a change to `owner` that the client did not make reads only the `owner` column again. The toggles stay at 0.

## 4. What stays true

- **A toggle asks nothing.** This covers a chip off or on, a saved filter, the Switch, a Sort cycle, a Group toggle, and an always-fetch field's toggle. `asked()` (`check-bench.mjs:249-253`) stays a rule for `remote/` acts. A new field asks only on the `lean/` and `notheld/` pages, which have their own exact expectations.
- **Shown fields are held for every row, not for one page.** A toggle can bring any row onto page 1.
- **A new Sort or Group field that is not held counts as a new field.** It costs one fetch, and cycling it after that is local.
- **The data layer stays DOM-free** (`eslint.config.js:56-67`).
  - `read-plan.ts`, `store-history.ts` and `store-cache.ts` go in `src/core/data`.
  - Any IndexedDB code goes in `src/core/browser` (`eslint.config.js:64`, `:90`).
  - `navigator` is not banned by the lint today. Add it to the list in phase 4, so that "the store's own failures, not `navigator`" is gated.
  - Tab focus is a DOM event: the provider listens for it and tells the source.
- **No component words in the data layer (341).** The need is fields plus `rows: 'page' | 'all'`, never "grid" or "chart".
- **An old store works as today.** A change with no `fields` means "every field".
- **The server stays the source of truth.** Sherpa holds only what the screen uses: the thin rosetta stone layer.

## 5. Decisions for Will

Neither decision blocks phases 1–3 or 5–8.

**D1: How does a remote store's History reach the browser? (phase 9)**
- **A (my pick):** never inside a toggle. It comes from a change feed the server pushes beside the RestStore, on tab focus (the provider listens), on a timer, or with a fetch that goes anyway.
  - 340's rule stays as it is.
  - A toggle can show data up to one step old.
  - EventStore and SocketStore are not remote stores. They are never held, and their pushes already arrive.
- **B:** each toggle first sends one small "changes since" ask, with no rows.
  - The data is always current.
  - Each toggle waits one round trip (800 ms on Demos `?remote`).
  - 340's rule becomes "no ROWS asked", and `asked()` changes with it.

**D2: What does the cache partner keep when the store does not answer? (phase 4)**
- **A (my pick):** memory only, for this session.
  - A timeout keeps the data on screen, marked stale.
  - A reload while offline shows the error state.
- **B:** IndexedDB as well, turned on per remote store.
  - A reload while offline shows the last data, marked stale.
  - Will's ground-zero ruling already says a kept cache is checked again when the session starts.
  - There is more code in `src/core/browser`, and the stored data outlives the session.

## 6. Risks

- **Records gains nothing at open,** because it shows 14 of 14 fields. The lean fixture proves the saving.
- **A projected row lacks the fields the page does not show.** Demos' details panel draws `Object.keys(record)` from the grid's row (Demos `contexts/records.js:199-201`). Edit fills its form from that same row (`:171`). Both must use `store.byKey()`.
- **Columns read at different times can disagree on rows.** The rows bit forces a new read of the row list. A store with no History keeps today's whole read on each change.
- **The schema risk is narrower than it looks.** Every rule except `required()` passes an absent field (`T-every-rule-but-required-passes-absent`). Demos requires `name`, `email` and `customer`.
- **A patch from a client write can add a row the server's own shaping would not send,** such as one from another tenant or permission. The next whole read fixes it.
- **A search with no `searchFields` reads every field** (`store.ts:512`). Also, `defaultQuery` never sends `searchFields` (`stores.ts:386-396`), so a held answer and a server answer can differ.
- **A list that arrives late can change `compile()`** (`filter-state.ts:346-354`). A chip can change while the reader looks at it.
- **An always-fetch toggle shows the client's answer for the other filters.** If the server would match differently, the two answers can differ.
- **A RestStore update with no row in its reply knows only the patch keys** (`stores.ts:333-334`). A field the server works out is missed until the next whole read.
- **A cheap count with `take=0` can read as "no limit" on some servers.** It must be opt-in.
- **Tabs do not hear each other.** The only cross-tab hook is `db.onversionchange` (`browser/idb-store.ts:157`). No `BroadcastChannel` or `storage` listener was found.
- **Memory use is not measured.** A per-store cache lives as long as the tab, not the page. `holdRows` caps it (`data-source.ts:245`).
- **The values read moves later.** That must keep 343's slow-load tests green (Demos `reforged-card-data-states.spec.ts`).
- **348 and 349 make counts depend on order.** The "whole filter" rule for stale data covers this.
- **A bitmap over 32 fields needs `bigint`.** The bitmap stays inside the store's History; the wire carries names.
- **A menu that redraws while it is open must keep its focus.**

---

**What I changed**

1. **Corrected the "not held" row.** The `:965` load runs only when the store has no `distinct`, and `:1767` runs only with a summary on a windowed or split page. I added that each chip count is a whole load.
2. **Fixed the `#hold()` sites.** There are 8, not 6: the plan missed `offered` (`:2030`) and `#settleSetAside` (`:2049`). I also cited the `#hold` lines rather than the method lines, and corrected `#lastLoadKey` to `:172`.
3. **Added Will's always-fetch field (choice A, `data-fetch-fields`) as phase 6.** The original plan left it out. Apply fetches a key set, so toggles stay free.
4. **Dropped `Store.fields`.** The page definition and the schema `domains` already list the fields, and no phase needed it.
5. **Added that wrappers drop new members.** `spoofRemote`, `LiveStore` and `JsonStore` copy fixed member lists, so each phase must forward what it adds.
6. **Fixed the reopen in phase 4.** "0 loads" would drop currency for a RestStore with no History. It now shows the cache stale and reads again behind it.
7. **Fixed the phase 4 proof.** `spoofRemote({ fail: 1 })` fails the open itself, and the bench makes a new store on each open.
8. **Fixed the phase 5 proof.** With `distinct`, `:965` never runs. I also noted that a held store gains nothing from phase 5.
9. **Fixed the phase 5 change.** `describe()` and `addable()` only read `filterDef()`. The real changes are the `openSource` order (`:77` runs before `:89-109`) and `hold`/`request`/`answerColumn`.
10. **Pointed the menu loading state at the right file.** It belongs in `sherpa-filter-menu.html` and `menuFor`, not `sherpa-menu`.
11. **Added how a stale card is drawn.** Without `data-keep-content`, an error is an overlay that hides the kept data.
12. **Split the old phase 6 in two.** Phase 7 changes how reads are stored with no change in behaviour. Phase 8 adds the decision series.
13. **Added the one-tick need gathering.** The first load starts at the first attach, and `openSource` runs before any component is bound.
14. **Moved the lean fixture to phase 3,** because that proof needs it first. I moved `StoreChangeDetail.fields` from phase 2 to phase 3.
15. **Corrected phase 2's reload.** It must use `#reask()`: `force` drops the set and plain `load()` skips the repeated key. An update must MERGE, by the old key.
16. **Clarified `asked()`.** It allows no asks, so new-field acts go on separate `lean/` and `notheld/` pages.
17. **Narrowed the schema risk to `required()`,** and changed "never held" to "never projected".
18. **Added the Demos details and edit risk,** plus the risks for patch-shaped rows, `take=0`, 343, 348/349 and the always-fetch toggle.
19. **Added `navigator` to the lint ban list,** because it is not gated today.
20. **Rewrote D1.** EventStore and SocketStore are not remote stores. I said which phase each decision blocks.
21. **Noted that the TRAP's sentence changes,** and that building waits for Will's go. TODO 170 is untouched.
22. **Gave phase 1 its own TODO row,** following Will's "queue bugs" rule.