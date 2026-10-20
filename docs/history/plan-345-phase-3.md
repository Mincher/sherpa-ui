# Plan 345 phase 3 — History for memory stores

A read-only design against the code at 2026-10-20, with a prototype in a
throwaway copy, then a check that reproduced three bugs in it (M1–M3 in §4).
Build from §3 with the check's fixes. Line numbers will drift.

## 1. Map — the change path today

### TODO 345 phase 3 (History): the change path today, and what one keyed update costs

**In short:** today a source treats every store change as "anything may have moved". It re-runs the walk, re-reads the page and all rows, and redraws every control. It does this even when the changed field is one nothing on the page reads.

- On the bench page (10k rows), changing an unread field (`lastSeen`, `seats`, `name`) costs the same as changing a field the page uses.
- A field-level History could skip the walk in about 9 of every 12 updates I tried.
- What that saves depends on the store:
  - **Local or held set:** about 4 ms of walk and 16 of 18 draws per change.
  - **Remote set that is not held:** 12 of 14 store requests per change.

`StoreChangeDetail` does not carry the old row. Four stores have the old row in hand before they announce, and so does `HeldSet.patch` (§1, §2).

Line numbers are at HEAD `6054f48a`; the last data-layer commit is `7e85e584`. I ran `node scripts/check-bench.mjs` (57 acts within the baseline) and four throwaway scripts (§8). The repo is unchanged.

---

#### 1. How each store announces a change

`StoreChangeDetail` is `{ type: 'insert'|'update'|'remove', key?, row?, trimmed? }` (`store.ts:250-259`). It has no `fields`, no old row and no sequence number. Absent `key` means "every row may have changed".

| Store | Announce site | Detail sent | Old row in hand? |
|---|---|---|---|
| `BaseStore.announce` | `base-store.ts:146-148` | Sends the detail as given. **This is the one funnel** for ArrayStore, LocalStore, RestStore, IdbStore and JsonStore. | n/a |
| ArrayStore.insert | `stores.ts:114` | `{insert, key, row (keyed copy), trimmed?}`; the cap is applied first (`:111-113`) | n/a (rows bit) |
| ArrayStore.update | `stores.ts:130` | `{update, key (old key), row (whole merged row)}` | **Yes**: `old` at `:122`, merged at `:123` |
| ArrayStore.remove | `stores.ts:138` | `{remove, key}` | n/a |
| ArrayStore.setRows | `stores.ts:65-68` | `{update}`, no key, so all rows | no |
| JsonStore | `stores.ts:176-179` | Re-announces the inner ArrayStore's detail. The fetch lands through `setRows` (`:203`), so it is keyless. | Yes, via the inner store |
| LocalStore insert / update / remove | `stores.ts:496`, `:514`, `:524` | Same shapes; the row is not keyed | **Yes**: `rows[i]` at `:506` |
| RestStore.insert | `stores.ts:350` | `row` only when the server replied | n/a |
| RestStore.update | `stores.ts:365` | `{update, key}`, plus `row` only when the server replied (`:364`) | **No.** Only the patch keys (`values`) and the reply row |
| RestStore.remove | `stores.ts:372` | `{remove, key}` | n/a |
| IdbStore insert / update / remove | `idb-store.ts:221`, `:242`, `:252` | Same shapes; insert carries the `trimmed` keys from `#trim` (`:363-384`) | **Yes**: `existing` at `:226` |
| IdbStore.putAll | `idb-store.ts:261-283`, announce `:281` | `{update}`, no key. The trimmed keys are dropped (`:280`). | no |
| IdbStore.clear | `idb-store.ts:183-187` | `{remove}`, no key | no |
| LiveStore (EventStore, SocketStore) | relay `live-stores.ts:56-58`; `#apply` `:99-125` | Re-dispatches the inner ArrayStore's detail. A whole-set push is `setRows` (`:103`), so keyless. A push `update` merges into the inner store (`:113-114`). | **Yes**, the inner store has it. LiveStore does not extend BaseStore (`:40`). |
| `spoofRemote` | relay `spoof-remote.ts:34-42` | Passes the inner store's `detail` on unchanged, through a `WeakRef` | n/a |
| `StoreCache.#onChange` | `store-cache.ts:334-349` | Patches the HeldSet, then fires its **own** `change` with only `{ taken }` (`:36-38`, `:348`). The store's detail does not get past the cache. | Through `HeldSet.patch` |
| `HeldSet.patch` | `held-set.ts:56-98` | Returns `true`/`false`. Without a key it returns false (`:59`). | **Yes**: `this.#rows[i]` at `:61`/`:70`/`:83`, replaced at `:84` (or `:90`, `:93-96` on a key move) |

**Where the changed fields can be found:**
- **In the store, before announcing:** ArrayStore, LocalStore, IdbStore and LiveStore (through the inner store). JsonStore inherits it.
- **In `HeldSet.patch`:** compare the held row with the announced whole row (`held-set.ts:83`). This works for any held store whose announce carries the row, including a RestStore whose server replies.
- **RestStore with no reply and no held set:** only `Object.keys(values)` is known (`stores.ts:354-366`). Fields the server works out are missed.
- **Never:** `setRows`, `putAll`, `clear`. Each must count as "all fields plus rows".

**Wrappers drop new members.** The plan warns about this, and it still holds:
- `spoofRemote` copies a fixed list of members (`spoof-remote.ts:44-74`). It already leaves out `scan`, and it would leave out `history`.
- `LiveStore` forwards only `load`, `byKey`, `totalCount`, `distinct`, `scan` and the writes (`live-stores.ts:138-163`).

#### 2. What a DataSource does on a change

**Wiring** (`data-source.ts:262-266`):
- A remote source with `holdRows > 0` uses `cacheOf(store)` and listens to the **cache**, which fires `change` and `set`.
- Any other source listens to the store directly.
- `close()` removes the listeners (`:1748-1753`).

**`#onStoreChange`** (`:1695-1699`) is `(): void`. **It ignores the event**: it always runs `#age++` and `#rowsAge++`, then calls `#reask()` (cached source) or `load({ force: true })` (local source). A local source therefore bumps both ages twice (again at `:1672-1676`). On a local source `#letGo` does nothing (`:1821-1823`).

`#onSet` (`:1703-1711`) runs only when a whole set lands, never on a keyed change.

**What the two ages do.** `#age` mixes "the rows changed" with "the facts changed" (comment at `:2182-2183`).

| Counter | Bumped at | Read by | Effect when bumped |
|---|---|---|---|
| `#age` | `:595` declarePart, `:723` declarePreset, `:953` declareValues, `:966` declareField, `:990` declareFromRows, `:1051` declareSets, `:1673` forced load, **`:1696` store change**, `:1707` set landed | `#walkKey` `:1953-1959`; `allKey` `:1875`; `#drawWalk` key `:2118` (through walkKey) | New walk, all-rows re-read, every control redrawn |
| `#rowsAge` | `:1674`, **`:1697`**, `:1708` | `#rowsCache` `:2001-2005`; declareFromRows cache `:981-986` | A store with no `scan()` (IdbStore, LocalStore) loads its whole set again for the next walk |

**`#ask` after a change** (`:1829-1923`):
1. `#hold` (`:1837`, `:1784-1818`) runs `planRead` (`read-plan.ts:39-57`).
2. If the walk is cheap (a held set, a store that scans, or a current `#rowsCache`; `:2057-2061`), `#walked()` runs **before** the load (`:1843-1852`). The walk key moved with `#age`, so `#walkRows` (`:1995-2007`) calls `walkInOrder` (`walk.ts:218`), which makes one `passOver` per scope.
3. The page is read (`:1853`). The no-op guard (`:1683`) and the asked guard (`:1687`) are bypassed, because `#reask` (`:1756-1760`) and `force` skip them. `#lastLoadKey` (`:178`) is a ViewState key with no row version, so it cannot see a change.
4. All rows are read (`:1865-1882`) when a `rows: 'all'` bind exists and the page is windowed or split. `allKey = [#age, asked]` moved, so this always re-reads. A HeldSet load copies every row (`held-set.ts:117-120`); so does an ArrayStore load (`stores.ts:70-74`).
5. `publish` (`:1894`; `source-binding.ts:151-178`). The guard at `:174` compares array identity, and a new array always pushes.
6. The `change` event fires (`:1900-1904`). `DataChangeDetail` (`data-source-types.ts:277-284`) does not say why.
7. `#rewalk` (`:1905`, `:2078-2095`) reuses the cached walk, then `#drawWalk` (`:2110-2140`). The walk key moved, so every bar, grid and panel is drawn again and `present` fires.
8. A remote store that is not held walks **step by step after publish**, through `walkStepwise` (`source-counts.ts:214-311`): one `totalCount` per counted step, and `presentUnder` (`:25-37`) as `distinct` or a whole `load` per tally filter.

**Value lists never refresh.** Values are declared only at construction (`:272-275`) and at `openSource` (`page-definition.ts:77` → `:976-991`). I checked with `dist/data.js`: after inserting a row with `plan: 'ultra'`, `valuesFor('plan')` is still `["free","pro"]`, on both a local and a remote source.

**The provider's reactions.** None of them read rows, yet all run on every row change:
- `#watchStates` (`sherpa-provider.ts:552-580`): `loading` starts a 300 ms timer; `change` runs `#syncReach` (`:367-388`) and writes each card's state.
- `provider-page.ts:114-131`: one animation frame later, `#sayResets` (`:324-340`, which calls `atDefault` and `answered`) and `#saySaved` (`:278-289`, which reads localStorage and sets `savedSets` on every bar and panel).
- `present` updates the legend (`sherpa-provider.ts:855-859`).

A taken change also schedules a whole-set write for `keepCache` (`store-cache.ts:340` → `cache-keep.ts:114-140`, 2 s quiet, then idle).

#### 3. Measured: one keyed update today

The setup is the bench page (`test/unit/fixtures/records.page.json`, 10k rows), bound as the bench binds it, with `limitOptions` on. Each update runs on a fresh page.
- **S0:** nothing answered.
- **S1:** the bench's `report` state (status, plan and owner picked; "At risk" on).

`dist/data.js` gives the same request counts as the src bundle.

| Page (store) | Store requests per update (any field) | Client work | Walk | Draws / events |
|---|---|---|---|---|
| `records` (ArrayStore, local) | 2 loads, 10,025 rows copied out | 4 scans: 2 `applyOptions` + 2 `passOver` | 1 `walkInOrder` | 18 draws (16 from `#drawWalk`, 2 `populate`); 1 `change`, 1 `present` |
| `remote` (held, spoof) | 0 | 4 scans; 2 HeldSet loads, 10,025 row copies | 1 | 18; 1, 1 |
| `rest` (held, `announcesAll: false`) | 0 | Same as remote | 1 | 18 |
| IdbStore-like (local, no `scan`, no `distinct`) | 3 loads, 20,025 rows | 5 scans | 1 | 18 |
| Not held (`holdRows: 0`, has `distinct`) | S0: 2 loads + 1 distinct. **S1: 2 loads + 8 counts + 4 distinct = 14** | S1: 18 scans | stepwise | 18 |
| Not held, no `distinct` (like a RestStore) | S0: 3 loads, 20,025 rows. **S1: 6 loads + 8 counts, 29,951 rows** | 14 scans | stepwise | 18 |

- No update ran `compile`; each made 1 clone. Insert and remove cost the same as an update.
- On a held set, a keyless `setRows` adds 1 whole load of 10,000 rows.
- The bench's `records/save` (2 loads, 4 scans) and `remote/save` (0 loads, 4 scans) match these numbers.
- **Every update cost the same, whatever field changed:** owner, health, lastSeen, seats or name, on page 1 or not.

**Time** (node, not throttled; per update):
- The whole act takes about 12–24 ms.
- The walk alone takes 4.2–4.6 ms.
- The all-rows re-read takes 1.9–4.7 ms; the page read takes 0.2–2.5 ms.

**The walk's output did not change for any of the 48 keyed updates.** It changed only for insert and remove in S1, where the counts move.

#### 4. What a field-level History could skip

The walk's dependencies come from its plan. They are:
- tallied step fields (a `ruler` or `offers`) and tapped fields;
- each pick's own clause;
- the clause fields of steps that are on or that count, including the base step's parts, page scopes and hand filter.

On the bench page:
- **S0:** customer, region, status, plan, tier, owner.
- **S1:** the same, plus health.

So 8 of 14 fields are unread in S0, and 7 in S1. The bench's `save` act changes `owner`, which is read, so **today's bench cannot show the gain.**

When an update changes a field the walk does not read, and no rows were added or removed:

| Page | Phase 3 skips | Left after the skip |
|---|---|---|
| records | 2 `passOver` (about 4 ms), 16 draws, the `present` event | 2 loads, 2 scans, 2 draws |
| remote, rest | 2 `passOver`, 16 draws | 0 requests, 2 scans |
| IdbStore-like | 1 whole load (10,000 rows), 2 `passOver` | 2 loads (10,025 rows), 3 scans |
| Not held (S1) | **12 requests** (8 counts + 4 distinct) | 2 loads |
| Not held, no `distinct` (S1) | **4 whole loads + 8 counts** (19,926 rows) | 2 loads (10,025 rows) |

Two more savings are possible, but they are outside phase 3:
- **The page read.** It can be skipped when the field is not in the filter, sort, group or search, and the row is not on the page.
- **The all-rows re-read.** It can be skipped only if the source knows which fields a summary reads (`AttachFacts.fields`, phase 8), or if it swaps the one row in place. A new array is still needed to get past the push guard (`source-binding.ts:174`).

#### 5. What this means for building phase 3

1. **Where History lives.** `BaseStore.announce` (`base-store.ts:146`) covers five of the stores. `LiveStore` (`live-stores.ts:56`) and `spoofRemote` (`spoof-remote.ts:44-52`) must forward `history` by hand.
   - Find the changed fields where the old row is in hand (`stores.ts:122`, `:506`; `idb-store.ts:226`), or by comparing rows in `HeldSet.patch` (`held-set.ts:83`). Otherwise count it as all fields.
   - An insert, a remove, `trimmed`, or a missing key sets the rows bit.
2. **One clock.** Use the store's sequence number. The source keeps the number at which each walk was made. `#onStoreChange` (`:1695-1699`) must stop bumping `#age` unconditionally: split it into "facts changed" (the six declare sites) and "rows changed" (History).
3. **The §0.H seam.** Add a pure `walkFields(plan)` in `walk.ts` that **leaves out idle steps**.
   - `passOver` still tests a saved filter that is off and does not count (`walk.ts:160-164`; `scanOf` at `:183`).
   - Dropping those tests made the walk 13–18% faster (4.31 → 3.52 ms) with identical output. This is a performance fix within reach.
4. **Do not skip after a failed walk.** A walk in `#unwalked` (`:2047`, `:2125`) must still be asked again on any change. Today `#age` makes that happen (TRAP `T-one-walk-counts-and-limits-in-order`, "Under change").
5. **`#rowsCache`** (`:2053`) is still invalidated by a skipped change. It could be patched the way `HeldSet.patch` works, or simply re-read when the Query next moves.
6. **The plan's phase-3 proof is out of date.** On held and local pages, counts and distinct are already 0 per change, because the walk replaced the per-count requests. The proof should be:
   - a `save-unread` act (for example `update(17, { lastSeen })`) on records, remote and rest: scans 4 → 2. Draws and walks are not in `GATED` (`check-bench.mjs:30`).
   - a `notheld/` page with `holdRows: 0`, to show requests 14 → 2. `asked()` checks only the `remote/` and `rest/` acts (`:303`).
7. **Line references in `plan-345.md` that have moved:**
   - `StoreChangeDetail` is now `store.ts:250-259` and has `trimmed`.
   - The old rows are at `stores.ts:122`, `:506` and `idb-store.ts:226`.
   - spoof `:43-74`; JsonStore forward `:176-179`; `#lastLoadKey` `:178`.
   - The 8 `#hold()` sites are now 4: `:978`, `:1837`, `:1996`, `:2224`.
8. **Next to phase 3, found while reading:**
   - Value lists never refresh after a change (verified above). The list-field bit could trigger a re-declare in phase 5.
   - A remote source's applied Query is `{}` until the first Apply; the holds live in the draft. So its first walk has only taps.
   - The provider's `#saySaved` and `#sayResets` could be skipped when only rows changed.

#### 6. Method and files

Everything is in `/private/tmp/claude-502/history-study/`. Nothing is in the repo.

| File | What it is |
|---|---|
| `measure-src.mjs` | Bundles `src/` in memory with esbuild, as the bench does, and adds counters for walks, `passOver`, HeldSet loads and patches, draws and events. It also compares the walk's output before and after each update. |
| `measure-dist.mjs` | The same acts against `dist/data.js`, which was built after the last data commit. Its request counts match. |
| `micro.mjs` | Times the walk and the re-reads alone, 30 times each. |
| `debug-s1.mjs`, `debug-remote.mjs`, `debug-values.mjs` | The checks behind §2 and §5.8. |
| `run1.txt`, `run-dist.txt`, `run-noscan.txt` | The raw tables. |

Caveats:
- Times are from node with no throttling, and each act's time includes the settle turns.
- The bench's controls are fakes, so the real cost of the 16 walk draws in a browser was not measured. Demos `perf/inp.mjs` would show it.
- In my not-held scenario the inner store's `totalCount` returns no rows. On a real RestStore each count is a whole load (`base-store.ts:70-74`).

## 2. Map — what reads what

### TODO 345 phase 3 (History): what each cost reads, by field

No function lists any cost's fields today. All five costs re-run on every store change, whatever field moved. Only the walk's fields can be listed from data the source already holds, its `WalkPlan`, without rows. The page load and the catalogue are partly known. The fields a grid shows and the fields a summary reads are not known to the source at all.

This was a read-only pass at HEAD `6054f48a`, with `dist/` built at the same time. The bench ran clean: 57 acts, all within the baseline. I wrote two throwaway scripts that import `dist/` read-only:
- `/private/tmp/claude-502/history-study/study.mjs`
- `/private/tmp/claude-502/history-study/walkfields.mjs`

#### 0. What every change costs today (measured)

`study.mjs` §A opens the bench page over a local ArrayStore (400 rows), binds the same controls the bench binds, and changes one field of row 5:

| Field changed | loads | `store.scan` calls |
|---|---|---|
| `notes` (not in the page at all) | 2 | 1 |
| `lastSeen` (a date, filtered by nothing) | 2 | 1 |
| `status` (held and answered) | 2 | 1 |

The cost is the same whatever field changed. The cause is in `data-source.ts`:
- `#onStoreChange` (`:1695-1699`) bumps `#age` and `#rowsAge`, then runs `load({ force: true })`, or `#reask()` on a held source. It takes no event, so it ignores the change's detail.
- `#age` is part of the walk key (`:1956`) and the all-rows key (`:1875`).

Bench numbers for the same thing: `records/save` (owner) costs loads 2 and scans 4. `remote/save` costs 0 asks but still 4 scans and 18 draws.

#### 1. The walk (counts, value counts, present, offered, set-aside)

**What it reads, from `planWalk` (`source-counts.ts:120-208`):**

| Part of the plan | Fields | Where |
|---|---|---|
| Base step (View only), always in force | `filterFields(parts ∪ page scopes' clauses)`, else the hand filter | `:124-132`, `:194` |
| Saved-filter steps | `filterFields(clause)`. They narrow and count only while on. | `:139-145` |
| Field steps | `filterFields(clause)` from `readingClause` | `:146-157` |
| `each` (one clause per pick) | the step's field | `:160-166`. Scanned at `walk.ts:159` |
| Ruler `here` / `offers` (tallied at the step) | the step's field | `:153`, `:158`. `walk.ts:185` |
| Ruler `start` (tallied over the scope's starting rows) | the step's field | `walk.ts:177-180` |
| Taps | each list field in `fields(scope)` that no step holds. A part adds its legend field. | `:177-191`, `:205` |
| Inherited | a component scope starts from the View's end rows, and a part from its host's. So it depends on the earlier scope's in-force step fields. | `:196-206`. `walk.ts:222-223` |
| Page (non-component) scopes | their clauses go into the View's base. They are walked for counts only. | `:126-128`, `:199-200` |

`walkStepwise` (`:214-311`) runs the same plan as store requests, so it reads the same fields.

**What re-runs it:**
- `#walked()` (`data-source.ts:2011-2043`) keys by `#walkKey()` (`:1953-1959`). That key includes `#age`.
- `#age` moves on every store change (`:1696`), every set that lands (`:1707`), a forced load (`:1673`), and every `declare*` (`:595`, `:723`, `:953`, `:966`, `:990`, `:1051`).
- Rows come from `#walkRows` (`:1995-2007`): the held set or `store.scan` in place, else `#rowsCache`, keyed by `#rowsAge` (`:2051-2053`).

**Lister: none exists.** This is the seam named in plan-347-349 §0.H.
- It would go in `walk.ts`, as a pure function such as `walkReads(plan): Record<scope, { tested, tallied, narrows, reads }>`.
- `walkfields.mjs` builds that prototype over the live bench fixture plan. Results:

| State | Limit | View reads | data reads |
|---|---|---|---|
| open | on | customer, region, status, plan, tier, owner | status, plan, tier, owner |
| open | off | region (serial `offers`) | status, plan, tier, owner |
| region + status + at-risk | on | region, customer, status, plan, tier, owner | region, health, status, plan, tier, owner |
| region + status + at-risk | off | region | region, health, status, plan, tier, owner |

- With Limit on and `offers: "all"`, the View's taps tally every list field. A History skip then helps only changes to numbers, dates, advanced-only text, or undeclared fields.

**Hook point:**
- Take the store's part out of `#age` in `#walkKey`.
- Store `seq` with `#walk` instead, and compare `lastChanged[bit] > seq` for `reads ∪ {rows}`.
- `#rowsCache` must still drop or patch on any change. Its row copies hold the old value of the changed field, and a later walk that reads that field would be wrong.

#### 2. The page load (`#loadOptions`, `data-source.ts:1644-1663`)

**What it reads:**
- `#filter`: the parts plus the compiled Query (`:1452-1463`)
- `sort[].field`
- `group`
- `search`: its `searchFields`, or every field when they are absent. `searchRows` reads `Object.values(row)` (`store.ts:528-535`).

A page bind also filters its rows by `only(id)` (`source-binding.ts:167-177`). The rows themselves go out whole, so what is shown depends on (4).

**What re-runs it:** `#onStoreChange` → `load({ force })` or `#reask()` (`:1695-1699`). Both bypass the `#lastLoadKey` guard (`:1683`).

**Lister:**
- Only the filter part exists: `filterFields` (`store.ts:327-342`), used by `#boundView` at `:2361`.
- Missing: `optionFields(options: LoadOptions): string[] | 'all'`, beside `filterFields` in `store.ts`.
- Even when no listed field changed, the page must still re-push if a shown field changed. Without the rows bit and without a hit on filter, sort, group or search, the members and their order stand. So a local source could patch the one row in `#result.rows`, as phase 2 does for the held set.

#### 3. The all-rows load (`#ask`, `data-source.ts:1863-1882`), for `rows: 'all'` binds

**What it reads:**
- `asked` = the load options without skip, take or filter, plus `#viewFilter` (`:1872-1873`). That is sort, group, search and searchFields, plus the View filter's fields.
- Then, per bind, `only(id)` and `scoped(scope)` (`source-binding.ts:171-177`).
- Then the bind's `as` adapter. The provider passes `summariseBanded(rows, spec, valuesFor, fieldFacts)` (`sherpa-provider.ts:718`), so it reads `spec.field`, `spec.segment` and `spec.over` (`aggregate.ts:233-255`, `:308-369`).
  - A `count` with no field reads only the rows bit.
  - Sort really is read here: `aggregateBy` orders by first sight when no values are declared (`aggregate.ts:116-118`). That is why `records/sort` costs 2 loads.

**What re-runs it:** `#allFor = JSON.stringify([#age, asked])` (`:1875`, `:2186`). So any change re-runs it, and so does any `declare*`.

**Lister: none.**
- The source never sees the summary spec. It lives in the provider's `#spec` (`sherpa-provider.ts:796-817`), inside the `as` closure.
- Fix:
  - Add `AttachFacts.reads?`.
  - The provider fills it with `[spec.field, spec.segment, spec.over]` at the `bindSource` call (`:710-731`).
  - `Bound` keeps it (`source-binding.ts:39-58`, set in `add` at `:92-102`).
  - A `SourceBinding.reads('all')` lister unions it with the `only` and `scoped` fields.
  - A bind with no `reads` means every field. The bench's chart bind (`check-bench.mjs:202`) has none.
- `allRows(el)` (`:2222-2229`) runs on demand and is never cached, so it needs no History.

#### 4. What a bound grid shows (its columns)

**The source does not know.**
- `AttachFacts` (`data-source-types.ts:201-221`) carries `readonly`, `steerOnly`, `id`, `scope`, `shows` (a kind) and `rows`. It has no fields.
- The page definition's `ui.grid.columns` reaches the grid only through the provider's `#configure` (`sherpa-provider.ts:303`, `:495-521`). `openSource` takes only `def.source` (`page-definition.ts:66`).
- The provider reads `asks.filters(el)` at each push (`sherpa-provider.ts:726-729`). That list holds only the filterable columns, text, number and date (`sherpa-data-grid.ts:115`, `:151-157`). It is not every shown column, and it leaves out `key`.

**Where it would go:**
1. A new `DataAsk.reads?: (el) => readonly string[]` (`core/ui/context.ts:44-70`). It must be a function read at each push, like `filters`, so that a later column change is seen.
2. The grid's `asks` returns `columns.map(c => c.field)` plus its `key`.
3. The provider passes it into `AttachFacts.reads`, as in (3).

**Risk:** Demos' details panel and Edit form read `Object.keys(record)` from the grid's row (plan-345 §6). If a re-push is skipped for a field the grid does not show, that row copy is stale for that field. Both would need `store.byKey()`.

#### 5. The catalogue (`declareFromRows`) and `filterDef`

**What it reads:**
- `FieldCatalogue.fromRows` (`field-catalogue.ts:138-171`) chooses its `open` fields at `:139-143`:
  - a number field lacking min or max
  - any other field that is not `advanced: 'only'` and has no domain yet
- It derives three things from them:
  - list values (`:160-163`)
  - number min, max and step (`:165-169`)
  - a date's days, read as `availableDates` in `filterDef` (`:109`)
- `filterDef` (`:104-116`) reads `#fields` and `#domains` only.
- Two sources of values are not row-derived: schema domains (`data-source.ts:271-275`) and `bindSelection`'s own list (`bind-selection.ts:106`).

**What re-runs it:** nothing. It is read once at open (`page-definition.ts:77`), and `fromRows` skips any field that already has values (`:142`). `study.mjs` §D shows the result:
- After inserting a row with `status: "archived"`, the status options are still `active, churned, paused, trial`.
- After inserting `seats: 99999`, seats max stays `399`.

So History would add currency here, not remove a cost.

**Lister: none.** `open` is worked out and then dropped.
- The catalogue would keep a set of row-derived fields, plus the `seq` it read them at.
- A change to one of those fields, or the rows bit (an insert can add a value, a remove can drop the last one), re-reads only those fields. That needs a force path past `:142`.
- A re-read bumps `#age` (`data-source.ts:990`), which re-runs the walk and the all-rows load. So it should declare only when the values actually differ.

#### 6. Wrappers that would drop a new `Store.history`

| Wrapper | How it copies | `history` | Also |
|---|---|---|---|
| `spoofRemote` (`spoof-remote.ts:44-74`) | `Object.assign` of a fixed list | **Dropped.** `study.mjs` §C: `'history' in spoofed` is `false` | Relays the detail whole (`:37-41`), so `fields` gets through. It also leaves out `scan`. |
| `LiveStore` / `EventStore` / `SocketStore` (`live-stores.ts:40-164`) | Not a BaseStore. Copies `key`/`time` (`:51-52`), delegates methods (`:138-163`), forwards the detail (`:56-58`) | **Needs** `get history() { return this.inner.history }` | Already drops `domains`, `announcesAll`, `rowOrder`, `reportsTotal` and `sampled` (§C: all `undefined`). `into` shares an ArrayStore (`:35`, `:53`), so the History is shared too, which is correct. |
| `JsonStore` (`stores.ts:160-245`) | Is a BaseStore. Re-announces the inner store's detail (`:177-179`) | Kept, if History is recorded in `BaseStore.announce` | Does not forward `distinct` or `announcesAll` (§C). `setRows` (`:65-68`) sends `{ type: 'update' }` with no key, which means every field plus the rows bit. |
| `StoreCache` (`store-cache.ts:334-349`) | Re-dispatches `change` with `CacheChangeDetail` = `{ taken }` only (`:36-38`, `:348`) | Not a store. The **fields are dropped.** §E: the store sends `{type, key, row}`, the cache sends `{"taken":true}` | A held `DataSource` hears only the cache (`data-source.ts:265`). Either `CacheChangeDetail` gains `fields`/`seq`, or the source reads `this.store.history` directly. |
| `DataSource.#onStoreChange` (`data-source.ts:1695`) | Takes no event | n/a | Must read the detail, or `store.history`. |
| Bench `counted()` (`check-bench.mjs:116-126`) | Patches `load`, `totalCount` and `distinct` in place | Kept | The `remote/` and `rest/` pages go through `spoofRemote` (`:183`). Phase 9's `changes()` needs counting there and in `ASKS` (`:294`). |
| `HeldSet` (via `#reads`, `data-source.ts:1764`) | `Pick<Store, …>` | n/a | Read History from `this.store`, not from `#reads`. |
| Test helpers, Demos, `keepCache` | Patch in place (`a-store-has-one-cache.test.mjs:17-24`, `a-live-filter-…:22-28`, `a-reopen-checks-behind:16-22`), or literal stores with no History; Demos uses only `spoofRemote` (Demos `app/index.html:619`); `cache-keep.ts` wraps no store | Not needed | A literal store has no History, so it takes today's path. |

**Where the changed fields would come from:**
- `BaseStore.announce` (`base-store.ts:146-148`) is the one choke point, for ArrayStore, JsonStore, RestStore, LocalStore and IdbStore.
- The old row to diff against:
  - ArrayStore: `stores.ts:122`
  - LocalStore: `stores.ts:506`
  - IdbStore: `idb-store.ts:226`
- RestStore knows only the patch keys (`stores.ts:358-365`), so a field the server works out is missed.
- These carry no key, so they mean every field plus the rows bit: `setRows` (`stores.ts:67`), `clear` (`idb-store.ts:186`), `putAll` (`idb-store.ts:281`).
- An insert, a remove, or a cap's `trimmed` rows set the rows bit.
- `read-plan.ts:31-32` already has a `history: { announcesAll, since }` input to widen.

#### 7. Things to know before building

- **An off saved filter is still matched on every row.** Its step keeps `clause` with `on` and `counts` false (`source-counts.ts:143`). `passOver` still runs `matchesFilter` and throws the result away (`walk.ts:160-164`). `needsScan` (`:208`) counts it, so it can force a scan alone. I found this by reading the code, not by measuring it. It is a performance fix within reach.
- **A relative date can go stale with no store change.** The plan sets `now: new Date()` (`data-source.ts:1991`), but the walk key has no time in it. History cannot see that, and it does not make it worse.
- **Some events must still count as "everything moved", keeping today's `#age` bump:**
  - a whole set landing (`#onSet`)
  - a Refresh (`load({ force })`)
  - any `declare*`
- **The skip is all or nothing per walk.** One walk covers every scope in one pass. Re-using one scope's result (say, the View's while only the data scope's fields changed) would mean keeping the View's end rows.

## 3. Design

### TODO 345 phase 3 (History): design against today's code

I read the code at HEAD `7a892477`; three commits from another agent landed while I worked. One of them (`06f7a4f2`, 319) moved `data-source.ts` by 2 lines after line 722, and the line numbers below are current. I changed nothing in the repo. To check the design, I built a prototype in a throwaway copy of `src/` and ran the bench against it (§9).

#### 0. In short

- **What History buys now is small and narrow.** It helps one case: a store change to a field the page does not filter, sort, group, search or tally. That change now costs 0 loads, 0 scans and 0 walks, where today it costs 2 loads, 4 scans, 1 walk and 18 draws. On a remote store that is not held, it is 0 asks instead of 8.
- **It does nothing for a toggle**, because a toggle makes no store change. The toggles are already GOOD: the 350 measure (`7a892477`) gives a worst INP of 176 ms.
- **The prototype moves 11 bench acts down and 0 up.** All 57 existing acts stay the same.
- **The other reason to build it now** is that it is the clock phases 8 and 9 need. Phase 8 uses it for `planRead`'s "is it current?" step, and phase 9 for the remote History.

---

#### 1. What History buys NOW, after the walk and the cache

The walk and the cache already removed the store requests:
- On a held set, a save asks the store nothing (phase 2, `store-cache.ts:334-349`).
- Counts ask nothing on held and local sources (347–349).

What is left on every change is client work, plus requests on stores that are not held. Today `#onStoreChange` (`data-source.ts:1697-1701`) ignores its event. It runs `#age++`, which moves the walk key (`:1958`) and the all-rows key (`:1877`). It also runs `#rowsAge++`, and then either `#reask()` or `load({ force: true })`.

**Measured on the bench page, 10,000 rows.** These are the bench's own counters, from the throwaway bench run against the throwaway prototype (§9). Each cell reads today → after commit 3.4 → after commit 3.5.

| Act (store) | loads | counts + distinct | scans | walks | draws |
|---|---|---|---|---|---|
| `records/save-unread` (ArrayStore, `lastSeen`) | 2 → 2 → **0** | 0 | 4 → 2 → **0** | 1 → 0 | 18 → 2 → 0 |
| `remote/save-unread` (held spoof) | 0 | 0 | 4 → 2 → **0** | 1 → 0 | 18 → 2 → 0 |
| `notheld/save-unread` (spoof, `holdRows: 0`, after `report`) | 2 → 2 → **0** | 6 → **0** | 10 → 2 → 0 | 1 → 0 | 18 → 2 |
| `lean/change-unused`, `lean/change-shown` | 2 → 2 → **0** | 0 | 4 → 2 → **0** | 1 → 0 | 18 → 2 |
| `lean/change-held` (field held, not answered) | 2 → 2 → **0** | 0 | 4 → 4 → 2 | 1 | 18 |
| `lean/change-answered` (the page filters on it) | 2 → 2 → **1** | 0 | 4 → 4 → 3 | 1 | 18 |
| `records/save-same` (writes the value the row has) | 2 → 2 → **0** | 0 | 4 → 2 → **0** | 1 → 0 | 18 → 0 |
| `records/save` (owner: searched and tallied) | 2 | 0 | 4 | 1 | 18, no change |
| `rest/save-unread` (`announcesAll: false`) | 0 | 0 | 4 | 1 | 18, no change (D2 A) |

`notheld/save-unread` is 2 loads + 4 counts + 2 distinct, so 8 asks. The earlier map said 14; its counters counted differently.

**Time per act** is printed by the bench but not gated, from one run. It includes about 4–5 ms of settle turns.
- `records/save-unread`: 18 → 5 ms
- `remote/save-unread`: 34 → 5 ms
- `notheld/save-unread`: 16 → 5 ms

`micro.mjs`, timed alone on 10k rows in node, gives:
- the walk: 4.3–4.5 ms
- the all-rows read: 1.9–3.7 ms
- the page read: 0.2–2.0 ms

So the act saves about 7–10 ms in node, or about 30–40 ms at 4x CPU. It also saves 16 control redraws. The bench cannot time those redraws in a browser; Demos `perf/inp.mjs` would have to.

**What it does NOT buy:**
- **A toggle.** It makes no store change, so nothing changes.
- **A change to a field the page reads.** On Records, with Limit on and `offers: "all"`, the walk tallies every list field, so a change to any list field still walks. Only numbers, dates, advanced-only text and fields that are not declared skip it.
- **An insert, a remove or a keyless set.** These move the rows, so everything runs as today.
- **Stores that may miss a writer (D2 A).** IdbStore, LocalStore, RestStore, Demos `?remote` (a `spoofRemote` over IdbStore, which says no `announcesAll`) and the bench's `rest/` page are not trusted. **Demos sees no change.** At its 100 rows, an update costs under 1 ms today anyway.
- **A RestStore** has no old row to compare against (`stores.ts:354-366`). Its update names no fields until phase 9.

**Where it matters:**
- A live feed (EventStore or SocketStore) that pushes field updates such as `lastSeen` or `health`. Each push today costs 2 loads, 1 walk and 18 draws. Nothing in the repo runs such a feed at a high rate yet.
- A save that changes nothing (Edit → Save without an edit), which becomes free.
- A remote store that is not held.

**Found on the way:** the bench's `save` act writes `owner: 'Owner 02'` (`check-bench.mjs:227`). Row 17's seeded owner is already `'Owner 02'`, so today's `save` is a no-op that costs 2 loads and a walk. Commit 3.1 fixes the act.

---

#### 2. The History: `src/core/data/store-history.ts` (new, DOM-free)

```ts
export function changedFields(before: Row, after: Row): string[]   // a value that differs; an object compared as JSON; one JSON cannot hold counts as changed
export class StoreHistory {
  get seq(): number                                                // the store's clock; 0 = ground zero
  record(change: StoreChangeDetail, key: string): number          // called by BaseStore.announce, before it dispatches
  changedSince(seq: number, fields: readonly string[] | 'all'): boolean  // the rows always count
  since(seq: number): { rows: boolean; fields: string[] | 'all' } // the OR of every update after seq, by name (debugState; phase 9's answer)
}
```

**The shape (D1 A).**
- Each field gets a bit the first time a change names it. Bit 0 is the rows. A bit never moves.
- The History keeps `#last[bit]`, the `seq` of the last change that moved that bit, and `#all`, the last change that may have moved every field.
- Each update's bitmap is folded into these numbers and is not kept as a row.
- `changedSince` is one compare per field read. No log grows.
- **Ground zero:** a History starts at 0 when its store object is made. A store is made once per session (`OutletOptions.stores`), so the History starts again each session (Will, 2026-10-19). There is no wall time and no second clock.

**What `record` marks:**

| Change | Marks |
|---|---|
| No key (`setRows` `stores.ts:67`, `putAll` `idb-store.ts:281`, `clear` `:186`) | everything (`#all`) |
| Insert or remove with a key (and a cap's `trimmed`) | bit 0, the rows |
| Update with a key and `fields` | each named field. If the key field is among them, the rows too |
| Update with a key and no `fields` (RestStore) | everything |

A read through a dot path (`customer.name`) answers to its top field, `customer`.

**`StoreChangeDetail.fields?: readonly string[]`** goes in `store.ts:250-259`: "On an update, the fields whose values changed; absent, any may have."

**`Store.history?: StoreHistory`** goes beside `scan?` in `store.ts:243-247`. A store without it takes today's path.

**Where the fields come from.** The old row is in hand before each of these announces:

| Store | Change |
|---|---|
| `ArrayStore.update` | `stores.ts:130` adds `fields: changedFields(old, row)`. `old` is at `:122`, `row` at `:123` |
| `LocalStore.update` | `stores.ts:514` adds `fields: changedFields(rows[i], row)`, computed before `rows[i] = row` at `:512` |
| `IdbStore.update` | `idb-store.ts:242` adds `fields: changedFields(existing, row)` (`existing` at `:226`) |
| `RestStore` | No change. It has no old row, so `fields` is absent and the update means every field |
| `JsonStore` | Re-announces its inner store's detail (`stores.ts:176-179`), so `fields` gets through. Its own `BaseStore` History records it. Add `readonly announcesAll = true` beside `:162`: its rows change only through it |

**How the History gets through each wrapper:**

| Wrapper | Change |
|---|---|
| `BaseStore` | `readonly history = new StoreHistory()` beside `base-store.ts:38`. `announce` (`:146-148`) calls `this.history.record(detail, this.key)` first |
| `LiveStore` | Add `get history()` and `get announcesAll()` from `this.inner` (`live-stores.ts:40-60`). A shared `into` store shares one History, which is right. The detail is already relayed whole (`:56-58`) |
| `spoofRemote` | Add `history: store.history` to the copied list (`spoof-remote.ts:44-53`). The relay already passes the detail whole (`:37-41`) |
| `StoreCache` | `CacheChangeDetail` (`store-cache.ts:36-38`) gains `change?: StoreChangeDetail`. The dispatch at `:348` passes it on, so a held source has the row |
| `src/data.ts` | Export `StoreHistory` and `changedFields`, beside `:233-234` |

---

#### 3. How the source uses it

**When a source trusts it (D2 A).** All of these must hold, or everything moves exactly as today:
1. `store.history` exists.
2. **`history.seq` moved since the source last heard**, so the store recorded this change. A `change` sent by hand, or by a store that calls `dispatchEvent` itself, is not in the History. The prototype needed this guard: without it, `a-held-set-takes-a-change-in-place.test.mjs:79` failed.
3. `store.announcesAll` is true. A writer the store may miss could have moved any field. This is phase 4's rule: "an unknown change counts as a change."
4. On a held source, the cache took the change (`taken`) and the plan is not `held-stale`. An unconfirmed set may differ from the store's old row.

**Four costs, each redone only when what it reads moved:**

| Cost | What it reads | When it moved | If it did not move |
|---|---|---|---|
| The walk (counts, values, present, offered, set-aside) | `walkReads(plan)`: the fields that steps test (only steps that are on or count, plus `each`) and the fields they tally (a ruler, `offers`, taps) | `#walkAge++`. The walk key gains `#walkAge` beside `#age` (`:1958`). A walk that failed (`#unwalked`, `:2036`) always runs again | The cached walk and draws stand. No `present` event |
| The page (`#result`) | `optionFields(#loadOptions())`: the filter, the sort fields, the group, and the search fields (`'all'` when a search has no `searchFields`) | `#reask()`, as today | The update's row replaces the old one, keyed like it (`carryKey` + `keyRow`, as `held-set.ts:70-72` does). Only an array that held it is pushed |
| The unpaged rows (`#allRows`) | The same, over the `asked` options and the View filter (`:1872-1873`) | `#allAge++` (in the all-rows key at `:1877`) | Patched in place. If `#allRows === #result.rows`, both are patched together |
| `#rowsCache` | Every field | `#rowsAge++` on every change, as today | Not used. Only a store with no `scan` reads it, and every trusted store in the repo has `scan` (ArrayStore, JsonStore, live stores, HeldSet). Patch it with `HeldSet.patch` when a trusted store without `scan` exists |

**The page is patched only when the source is idle:**
- `#loaded` is true,
- no ask is in flight (`#inFlight.busy`),
- and `#stateKey() === #lastLoadKey`, so a sort scheduled but not yet loaded does not get the patch.

Otherwise the source asks again.

**After a patch:**
- `#binding.publish()` runs. The array identity guard (`source-binding.ts:174`) pushes only the arrays that changed.
- `change` fires with the patched result. Emptiness and `stale` come from one helper shared with `#ask` (`:1898-1906`). `loading` does not fire, so the provider's 300 ms slow-load timer (`sherpa-provider.ts:564`) never starts.
- `#rewalk()` runs. If the walk did not move, `#drawWalk`'s key returns early.

**These still move everything** through `#age`, exactly as today:
- a Refresh (`load({ force })`, `:1675`),
- a set landing (`#onSet`, `:1705-1714`),
- every `declare*` (`:595`, `:723`, `:955`, `:968`, `:992`, `:1053`).

**The new `#onStoreChange` (`data-source.ts:1697-1701`).** Commits 3.4 and 3.5 together; the prototype ran this:

```ts
#onStoreChange = (event: Event): void => {
  this.#rowsAge++;
  const said = (event as CustomEvent<StoreChangeDetail & Partial<CacheChangeDetail> | undefined>).detail;
  const change = this.#cache ? said?.change : said;
  const history = this.store.history;
  const since = this.#heard;
  this.#heard = history?.seq ?? 0;
  if (!history || history.seq <= since || !this.store.announcesAll
    || (this.#cache && (!said?.taken || this.#plan === 'held-stale'))) {
    this.#age++;                                    // as before: any field may have moved
    void (this.#cache ? this.#reask() : this.load({ force: true }));
    return;
  }
  const moved = (reads: readonly string[] | 'all'): boolean => history.changedSince(since, reads);
  const w = this.#walk;
  if ((w && (this.#unwalked.has(w.walk) || moved(w.reads))) || (this.#walking && moved(this.#walking.reads))) this.#walkAge++;
  const idle = this.#loaded && !this.#inFlight.busy && this.#stateKey() === this.#lastLoadKey;
  if (!idle || moved(this.#allReads()) || !this.#takeRow(change, 'all')) this.#allAge++;
  if (idle && !moved(optionFields(this.#loadOptions())) && this.#takeRow(change, 'page')) {
    this.#binding.publish();
    this.#announceChange(this.#result);             // the helper split out of #ask :1898-1906
    void this.#rewalk();
    return;
  }
  void this.#reask();
};
```

More details:
- `#heard` starts at `store.history?.seq ?? 0` in the constructor, beside `:263`.
- `#walk` and `#walking` (`:2047`, `:2051`) carry `reads`, set in `#walked()` (`:2013-2045`) from `walkReads(this.#planWalk())`.
- `#takeRow` needs an `update` with a key and a `row`. A row that is not in the array is taken as "nothing to change", because its membership cannot have moved.
- `debugState()` (`:1397`) gains `history: { seq, heard }`.

**Will's sketch, mapped:**
- **The "View update time"** is `#heard`, the store `seq` the source last took. The comparison is `changedSince`.
- **Per-component times are not needed yet.** The push guard already skips a bind whose array did not change. Per-component fields (`AttachFacts.reads`) are phase 8.
- **The walk is all or nothing per walk.** One walk covers every scope.

**What stays true:**
- 340: a toggle asks nothing. No toggle path changes.
- The `asked()` rules (`check-bench.mjs:299-308`) still cover every `remote/` and `rest/` act. The new acts on those pages ask nothing today either.
- D1 A (phase 9): no History is asked inside a toggle.
- The data layer stays DOM-free.
- An old store, or a literal store, takes today's path.

---

#### 4. Commits, in order

Each commit ends with `npm run map:write <file>` for each changed file, then a build so Demos' symlink sees it. Demos has nothing to change and nothing to look at by eye.

##### 3.1 — bench: the acts phase 3 moves, recorded at today's cost

`scripts/check-bench.mjs`:
- A `walks` counter (`:35`). Wrap `walkInOrder` beside `passOver` (`:64-73`), and wrap `walkStepwise` with a new `onLoad` for `source-counts.ts`. Printed and used by the QUIET rule in 3.5, but not in `GATED`.
- `open()` (`:180-185`) takes `{ page, remote, announcesAll, holdRows }`, and the loop (`:282`) passes `PAGES[page]`.
- In ACTS (`:211-239`):
  - `save` becomes `{ owner: 'Owner 03' }`, so it really moves a read field. Its cost today stays the same: 2 loads, 3,546 rows, 4 scans.
  - New: `save-same` (`'Owner 03'` again), `save-unread` (`{ lastSeen: '2030-01-01' }`), `change-unused` (`{ spend: -1 }`), `change-shown` (`{ owner: 'Owner 99' }`), `change-held` (`{ tier: 'platinum' }`), `answer-held` (`data.answer({ tier: { picked: ['gold'] } })`) and `change-answered` (row 18 `{ tier: 'platinum' }`).
- PAGES (`:240-245`):
  - `records`, `remote` and `rest` add `save-same` and `save-unread` after `save`.
  - `lean: { page: LEAN, acts: [change-unused, change-shown, change-held, answer-held, change-answered, add, delete] }`
  - `notheld: { remote: true, holdRows: 0, acts: [report, save, save-same, save-unread, add, delete] }`
- STAGED (`:34`) gains the lean fixture.

New fixture `test/unit/fixtures/lean.page.json`:
- It uses the same 10k rows, which have 15 fields.
- It declares and shows 10 fields: `name`, `email`, `customer`, `status`, `plan`, `tier`, `region`, `owner`, `seats`, `created`. `ui.grid` has those 10 columns, `key: "id"`, and `search: ["name","email"]`.
- It holds 5 fields: `view.holds [region, created]` and `data` offers and holds `[status, plan, tier]`.
- So the walk reads `region`, `status`, `plan` and `tier`. The prototype's copy is `/private/tmp/claude-502/history-study/proto/lean.page.json`; add `$schema` and `ui`.

Then:
- `npm run check:bench -- --update-baseline`. In the throwaway bench run, all 57 existing acts stayed the same and 23 new acts were added, at today's cost.
- Update TRAP `T-the-bench-counts-and-never-times` with the two pages, `walks`, and `save-same` as the save that changes nothing.
- No source change.

##### 3.2 — walk: an idle saved filter tests no row, and `walkReads` (§0.H)

`src/core/data/walk.ts`:
- `scanOf` (`:183`) builds `tests` only for steps that are `on || counts`. An off saved filter still ran `matchesFilter` on every row (`:160-164`) and threw the result away.
- New `walkReads(plan): Record<scope, { tested: string[]; tallied: string[] }>` beside `emptyWalk` (`:95`).

New test `test/unit/a-walk-reads-only-what-it-names.test.mjs`:
1. It names the fields of a page like the bench's, with and without Limit, and with a saved filter on and off.
2. **A property test:** for seeded rows and several plans, change a field outside `walkReads` on 20% of the rows, and `walkInOrder` must give a deep-equal Walk. The throwaway `prop.mjs` held this for 5 states × 14 fields.
3. An idle saved filter reads no row. The rows have a getter that counts reads of `health`.

Results:
- The bench's gated counts stay the same, because a scan counts a pass over the rows, not each test.
- The time falls, with identical output (`micro.mjs` `same: true`): 4.48 → 3.48, 4.29 → 3.83 and 4.44 → 3.94 ms.
- TRAP `T-one-walk-counts-and-limits-in-order` gains two lines: an off saved filter that counts nothing tests no row, and `walkReads` names what a walk reads.

##### 3.3 — History: each store keeps what changed this session, by field

Files:
- `store-history.ts` (new)
- `store.ts:250-259`, `:243-247`
- `base-store.ts:38`, `:146-148`
- `stores.ts:130`, `:512-514`, `:162`
- `idb-store.ts:242`
- `live-stores.ts:40-60`
- `spoof-remote.ts:44-53`
- `store-cache.ts:36-38`, `:348`
- `src/data.ts:233`

New test `test/unit/a-store-keeps-its-history.test.mjs`:
- Ground zero: `seq` is 0 and nothing changed since 0.
- An update names only the values that moved, so a form that sends every field moves one.
- An insert or a remove moves the rows. `setRows` moves everything. A changed key moves the rows.
- `customer.name` follows `customer`.
- An object with the same content is not a change.
- A RestStore update has no `fields` (fetch stubbed).
- `spoofRemote(s).history === s.history`.
- `new EventStore({ url, into }).history === into.history` and `announcesAll` is true.
- JsonStore (fetch stubbed) and LocalStore (a stubbed `localStorage`) name their fields.

Changed tests:
- e2e `test/e2e/reforged-idb-store.spec.ts`: an update announces only the fields that moved. IndexedDB needs a browser.
- `a-held-set-takes-a-change-in-place.test.mjs:133` stays: a RestStore still announces `{ type, key }`.

Also:
- `check:weight`: `data.js` and `index.js` grow about 1 KB. Record it on purpose.
- New TRAP `T-a-store-keeps-its-history`.
- DATA-SOURCE-RULES §4 (see §6 below).

##### 3.4 — the walk runs again only when a field it reads, or the rows, moved

`data-source.ts`:
- `#heard` (`:263`) and the trust rule.
- `#onStoreChange` (`:1697-1701`) up to the walk.
- `#walkAge` in `#walkKey` (`:1958`).
- `reads` on `#walk` and `#walking` (`:2013-2051`).
- In this commit, `#allAge++` on every trusted change, so the unpaged rows are still read again as today.
- `debugState`.

New test `test/unit/a-change-walks-again-only-for-what-it-moved.test.mjs`. The first six run over a local ArrayStore with a fake bar that counts its `drawResults` calls.
1. An update to an unread field draws no count again, and `present` does not fire.
2. An update to a held field counts again, and gets the count right.
3. A literal store with no History walks again on every change.
4. `spoofRemote(..., { announcesAll: false })` walks again on every change (D2 A).
5. A `change` sent by hand walks again.
6. A store that is not held (`holdRows: 0`) asks no count or distinct for an unread field.
7. A set kept from an earlier session, through a fake `CacheKeep` with gen 0, so `held-stale`, walks again.

Changed tests:
- `a-count-runs-again-only-when-something-moved.test.mjs`: add "an update no count reads counts nothing again".
- `the-walk-holds-under-change.test.mjs`:
  - add "a walk in flight when a field it reads moves is not kept". Use an ArrayStore with `scan` removed and a slow `load`.
  - add "a failed walk is asked again on any change".
- `a-closed-source-hears-nothing.test.mjs:16-21`: count `loading` events, not `source.load` calls. The change path no longer goes through the public `load()`. The prototype failed this as written and passed it that way.

Bench, measured on the prototype at this stage:
- `save-same` and `save-unread` on `records` and `remote`: scans 4 → 2, walks 1 → 0.
- `lean/change-unused` and `change-shown`: scans 4 → 2.
- `notheld/save-same` and `save-unread`: counts 4 → 0, distinct 2 → 0, scans 10 → 2.
- `notheld/save` (owner, tallied): no change.
- Record it.

TRAPs:
- New `T-a-change-redoes-only-what-reads-it`.
- Rewrite `T-one-walk-counts-and-limits-in-order` "Under change" (TRAPS.md about :1871-1874): "a store change" becomes "a store change that moves a field it reads, or the rows".
- Rewrite `T-a-store-has-one-cache` (about :3957-3958): "a `change` moves `#age`" becomes "a `change` moves the walk only when its reads moved; a `set` moves `#age`".

##### 3.5 — the page and the unpaged rows take an update in place

- `store.ts`: `optionFields(options): string[] | 'all'` beside `filterFields` (`:327`).
- `data-source.ts`: `#allReads()`, `#takeRow()`, the idle check, the patch path and `#announceChange` (split out of `:1898-1906`).
- `check-bench.mjs`: a `quiet(costs)` rule.
  - The QUIET acts are `records/`, `remote/` and `notheld/` with `save-same` and `save-unread`, plus `lean/change-unused` and `lean/change-shown`.
  - Each must make 0 loads, counts, distinct, scans and walks.
  - It exits 1 the way `asked()` does, and `test/unit/bench.test.mjs` also asserts `quiet(...)` is `[]`.

New test `test/unit/an-update-nothing-reads-is-taken-in-place.test.mjs`:
1. An update to an unread field makes no store load. The grid's populate gets the new row, keyed like the old one. `change` fires and `loading` does not.
2. A row that is not on the page pushes nothing to the grid.
3. A chart bound with `rows: 'all'` gets the patched array.
4. Each of these asks again: a sorted field, a filtered field, a grouped field, a search with no `searchFields`, and a changed key.
5. An update while a load is out asks again.
6. `setSort` then an update in the same tick asks again.
7. A store that is not held asks nothing for an unread field.
8. An update that changes nothing asks nothing.

Bench, measured on the prototype:
- Every QUIET act goes to 0.
- `lean/change-held`: loads 2 → 0, scans 4 → 2.
- `lean/change-answered`: loads 2 → 1.
- `notheld/save`: loads 2 → 0, because the remote page's applied Query is empty until Apply.
- Record it, and record `check:weight` too.

Docs:
- TRAP `T-a-change-redoes-only-what-reads-it` gains its page part.
- `T-a-summary-binds-to-all-the-rows` gains a line: an update its reads did not move is patched into the unpaged rows.
- `T-the-bench-counts-and-never-times` gains the QUIET rule.
- DATA-SOURCE-RULES §6.
- `docs/TODO.md` 345: Phase 3 ✅, with the 3.1–3.5 lines. Replace the ⏸️ "moves after 348" line.

---

#### 5. TRAPs

**New `T-a-store-keeps-its-history`:**
- One clock, the store's `seq`, which starts at 0 each session.
- Folded by field (D1 A).
- Which fields: `changedFields` compares the old row and the new; an object compares as JSON.
- An insert, a remove, a trim or a changed key moves the rows.
- No key, or no `fields`, moves everything.
- A dot path follows its top field.
- Every wrapper passes `history` on.
- Sites: `store-history.ts`, `base-store.ts`, `stores.ts`, `idb-store.ts`, `live-stores.ts`, `spoof-remote.ts` and the new test.

**New `T-a-change-redoes-only-what-reads-it`:**
- The four costs and what each reads.
- The trust rule: History present, History moved, `announcesAll`, a held set took it, and the plan is not held-stale.
- The patch needs an idle source.
- A Refresh, a set landing and `declare*` still move everything.
- Sites: `data-source.ts`, `walk.ts`, `store.ts` and the two new tests.

**Rewrite:**
- `T-one-walk-counts-and-limits-in-order`: "Under change", the idle-filter line and `walkReads`.
- `T-a-store-has-one-cache`: the `#age` line.
- `T-a-summary-binds-to-all-the-rows`: one line.
- `T-the-bench-counts-and-never-times`: the pages, `walks` and QUIET.

#### 6. DATA-SOURCE-RULES.md

**§4**, after "Name the row." (3.3): add "**Say which fields changed.**"
> On an update, `fields` lists the fields whose values changed. `BaseStore` keeps them in `this.history`: this session's record of what changed, by field. When a store says `announcesAll: true`, a source over it redoes only what reads a field that moved. Leave `fields` out when you do not know: the change then moves every field.

**§6**, after "The rows are as fresh as..." (3.5):
> An update that moves no field the page's filter, sort, group or search reads is put into its rows in place: no load, no count.

**The short version, item 5:**
> A store announces every change (on an update, the fields it moved), and copies on both edges.

---

#### 7. Risks

- **A store that names the wrong `fields` shows a stale count or row.** The History is trusted only when the store says `announcesAll` and the History moved for this change. The doc says to leave `fields` out when unsure.
- **Freshness that came by accident is lost (D2 B only).** Today any change re-reads everything, which picks up another tab's writes on the way. Under D2 A, untrusted stores keep that behaviour.
- **The patched row is trusted as the store announced it.** That is the same trust as `HeldSet.patch` (`T-a-held-set-takes-a-change-in-place`).
- **Objects compare as JSON.** A different key order reads as changed, which is the safe side.
- **Spy tests on the public `load()` miss the change path.** One exists (§3.4). Any others would show in `npm test`.
- **TODO 366 is queued (`7a892477`):** one QueryContext per app Context, with structural data-layer work waiting on it. Phase 3 does not move the Query. It changes only how a store change marks costs out of date, and it keys on the walk's reads, not on the Query's owner. If 366 moves the walk, the check moves with it. Commits 3.1–3.3 do not touch `data-source.ts` at all.
- **Not changed by phase 3:**
  - Value lists still never refresh after a change; that is phase 5, and the History's fields could drive it.
  - Relative dates still go stale with no change.
- **The fold keeps no order or time** (D1), so a bug report cannot list each change.
- **The weight grows** by about 1–2 KB on `data.js` and `index.js`, recorded on purpose.

#### 8. Decisions for Will

**D1 — How the History table is kept**
- **A (my pick): folded.** Each field keeps the number of the last change that moved it, and bit 0 is the rows. Its size never grows, and "did any of these fields change since N?" is exact. Each update's bitmap is applied and then dropped.
- **B: one row per update** (number + bitmap), as you sketched. It can list what changed and when, for a bug report. But it grows with every update: a feed at 10 a second makes 288,000 rows in 8 hours. And each question must OR every row since N.

**D2 — A store that may miss a writer: IdbStore, LocalStore, Demos `?remote`, and a spoof with `announcesAll: false`**
- **A (my pick): not trusted.** Each change redoes everything, as today. This is the same rule as phase 4: "an unknown change counts as a change." Demos sees no change, and at 100 rows each update costs under 1 ms today anyway.
- **B: trusted within this tab.** A save to an unread field is free there too. But a write from another tab or client shows only after a change that moves a field the page reads; today it shows after any change in this tab.

A RestStore names no fields under either option, so it gains nothing until phase 9.

---

#### 9. How I checked it

All files are in `/private/tmp/claude-502/history-study/proto/`. Nothing is in the repo.

- **The prototype:** `/private/tmp/claude-502/history-study/proto/repo/src/core/data/` is a copy of `src/` with these edits:
  - `store-history.ts`
  - the `fields` and `history` members in `store.ts`
  - `base-store.ts`
  - `ArrayStore.update` only
  - `spoof-remote.ts`
  - `store-cache.ts`
  - `walk.ts`
  - the `#onStoreChange` in `data-source.ts` from §3

  It leaves out LocalStore, IdbStore, LiveStore, JsonStore, the emptiness and `stale` in the patch path's `change`, and the docs. **Do not copy it blindly.**
- **Type-check:** the strict `tsconfig.reforged.json` config passes on the copy.
- **Node tests:** 254 of the 255 data-layer node tests pass against its build. The one that fails is `a-closed-source-hears-nothing`, which spies on `load()`; it passes when it counts `loading` events instead. The full node run's other 14 failures come only from files I did not copy (eslint config, MCP, e2e).
- **Bench:** `/private/tmp/claude-502/history-study/proto/bench-proto.mjs` is a copy of `check-bench.mjs` with 3.1's acts. Today against the prototype: 11 acts fall and 0 rise. Raw counts are in `costs.json`, `costs-1.json` and `costs-2.json` in the same folder.
- **Property check:** `/private/tmp/claude-502/history-study/prop.mjs` showed that a field outside the walk's reads never changed its output, over 5 states × 14 fields.
- **Timing:** `/private/tmp/claude-502/history-study/micro.mjs` re-timed the walk and the reads.

## 4. Check of the design

**Verdict:** the design mostly matches HEAD, and the prototype's bench numbers reproduce. But three cases leave the screen wrong, and I reproduced each one on the prototype's own build (`proto/repo/dist`, stage 2). Fix M1–M3 before building. I changed nothing in the repo; the two probe scripts are listed at the end.

#### Missed (most severe first)

**M1. A save after a failed Refresh hides the error and shows old rows.** Confirmed by probe.
- A failed ask leaves `#loaded` and `#lastLoadKey` as they were (`data-source.ts:1909-1916`). So after `load({force:true})` fails with the same key, the "idle" check still passes.
- A trusted update then takes the patch path and fires `change`. The provider's `change` handler deletes `data-state="error"` from every card (`sherpa-provider.ts:567-570`).
- If `#announceChange` is split out of `:1898-1906`, it also runs `this.#down = null` (`:1901`), so reach flips to `ok` while the store is down.
- Probe: `spoofRemote(ArrayStore, {fail})` with `holdRows: 0`, a failed Refresh, then `inner.update`. HEAD gives `error, error`. The prototype gives `error, change (reach=down)`.
- Fix: "idle" must also mean the last ask succeeded, and the patch path must never clear `#down`.

**M2. A nested object changed in place is never seen as a change.** Confirmed by probe.
- ArrayStore copies rows only one level deep (`stores.ts:73`, `:103`, `:131`; `held-set.ts:119`). A nested object a page holds is the store's own object.
- So `row.customer.name = 'Zeta'; store.update(1, {customer: row.customer})` gives `Object.is(old, new)` in `changedFields`, and no field is named.
- With the filter `['customer.name','eq','Acme']`, HEAD drops row 1. The prototype keeps it on the page, showing "Zeta". An array changed with `push` fails the same way.
- Fix: when the caller sent a field and its value is the same object reference as before, count that field as changed.

**M3. `searchFields: []` searches every value, but `optionFields` misses it.** Confirmed by probe.
- `page-definition.ts:73` passes `[]` for `"search": []`. `searchRows` treats an empty list as every value (`store.ts:532`), and so does `data-source.ts:1592`.
- The prototype's `optionFields` returns `'all'` only when `searchFields` is absent. Probe: HEAD drops the row that stops matching; the prototype keeps it.
- Fix: return `'all'` when `!searchFields?.length`.

**M4. Patching the page (3.5) is new scope that Will has not ruled on.**
- `plan-345.md:90-96` defines phase 3 as recounting only. Its proof says "The page load stays, because the grid shows `plan`", and it names `records/change-plan`, which the design drops.
- Patching a shown field from the announced row should be a decision for Will (a D3), not folded in.

**M5. Two commit gates are not named.**
- `check:size` (`.githooks/pre-commit:168`): every commit grows a file that has a line baseline (data-source.ts 2371, stores.ts 528, store.ts 613, base-store.ts 151, walk.ts 288, store-cache.ts 377, spoof-remote.ts 76, live-stores.ts 316, idb-store.ts 397). Each commit needs `check:size -- --update-baseline`.
- `check:traps` (`:61`) plus `npm run traps:write` for the two new TRAPs.

**M6. The property check is too narrow.**
- `prop.mjs:210` ran only records states S0–S2, with Limit on and off.
- It never covered a chart part (`narrowing`, `source-counts.ts:205-209`), a filter set by hand (`hand`, `:131`, `setFilter`), or a component's own scope or default (`fixed`).
- Reading the code, `walkReads` does cover everything `scanOf` and `passOver` read (`walk.ts:149-166`, `:176-185`). But the 3.2 test should include these plans.

**M7. The trust check reads `#plan`, the plan from the last ask** (set at `:1801`). It should call `#planNow().plan`, as the `stale` flag already does (`:1900`). Low risk: a failed read fires `set` (`store-cache.ts:328`), which makes every source ask again.

**M8. A dot-path key is missed.** The prototype's `record` marks the rows only when `f === key`. A store with `key: 'meta.id'` (`readField` follows dots, `base-store.ts:141`) would not mark the rows on a key change. Compare the key's top field. Low.

**M9. The QUIET acts on `records/` and `remote/` never touch a bound array.**
- Row 17 is off the page under the `owner 1` search; the prototype draws 0 there.
- They prove cost only. Only `lean/` and `notheld/` (2 draws) and the new unit tests prove the screen is fresh.

**M10. A change to a counted field pushes the grid twice** (`lean/change-held`). The patch publishes before `#rewalk` sets picks aside; today `#ask` walks first (`:1845-1854`). Low.

**M11. Two of the prototype's own checks failed.** `the-data-entry-loads-no-dom` and `weight.test` both failed in its run (`proto/all-proto.txt`). So "the data layer stays DOM-free" and the weight figure are not proved by it.

#### Wrong

- **W1.** "23 new acts were added": it is **21**. `costs.json` has 78 acts against 57 in the baseline: 3 pages × 2, plus lean 8, plus notheld 7.
- **W2.** "the `asked` options and the View filter (`:1872-1873`)": `viewed` is at `:1868` and `asked` at `:1874-1875`.
- **W3.** "Demos sees no change, and nothing to look at by eye": wrong in three places.
  - `notificationFeed` is an ArrayStore (Demos `app/index.html:507-518`). Its `update(id, {unread:false})` calls (`:553`, `:558`) now take the patch path: the list and badge update inside the save, with no reload. Will should check the bell after "Mark all read".
  - `alertStore` is an ArrayStore (`stores/dashboard-data.js:85`), so it is trusted.
  - `localRecords` returns an ArrayStore when there is no IndexedDB (`idb-store.ts:58-59`). In a private window, Records and `?remote` are trusted (the spoof inherits `announcesAll: true`, `spoof-remote.ts:52`).
- **W4.** "Nothing in the repo runs such a feed": Demos `?live` runs `new EventStore({url:'/live/alerts', into: alertStore})` (`app/contexts/dashboard.js:86`). The server pushes only inserts (`server/index.mjs:49`), so it gains nothing.
- **W5.** "A save that changes nothing becomes free": it asks the store nothing, but the grid still redraws and `change` still fires. Probe on a no-op save: HEAD gives loads 1, populate 1, change 1; the prototype gives loads 0, populate 1, change 1.
- **W6.** JsonStore `announcesAll = true` reverses an earlier ruling.
  - The phase-4 review (`docs/history/plan-345-phase-4.md:428-430`) and `TRAPS.md:3947-3948` deliberately name only ArrayStore.
  - After `invalidate()` (`stores.ts:242-244`), nothing announces. A held, spoofed JsonStore would then plan `held` instead of `held-stale` (`read-plan.ts:55`) and never fetch again.
  - Drop it from 3.3, or make `invalidate()` announce a change with no key.
- **W7.** "Objects compare as JSON … the safe side" is only half true.
  - JSON also reads some real changes as no change: Map and Set become `{}`, NaN and Infinity become `null`, and `undefined` members are dropped. An object changed in place is caught by `Object.is` first (M2).
  - Use `valueKey` (`store.ts:469-478`), the comparison the filter, sort and walk already use.
- **W8.** "`data.js` and `index.js` grow": the last change to `data-source.ts` (`06f7a4f2`) moved 19 weight entries, including `app.js`, `components.js`, `sherpa-provider.js`, the data grid, the filter panel and the toolbar.
- **W9.** "`#allAge++` (in the all-rows key at `:1877`)": `#allAge` goes beside `#age`, not in place of it. The prototype keeps both: `[#age, #allAge, asked]`.
- **W10.** In the §1 table, `records/save-same` draws went 18 → 2 → 0, not 18 → 0 (`costs-1.json`).

#### Confirmed: 66 file:line citations and 25 measured claims

- **data-source.ts (18):** `:263`, `:595`, `:723`, `:955`, `:968`, `:992`, `:1053`, `:1397`, `:1675`, `:1697-1701`, `:1705-1714`, `:1877`, `:1898-1906`, `:1958`, `:2013-2045`, `:2036`, `:2047`, `:2051`.
- **Stores (19):**
  - `store.ts` `:243-247`, `:250-259`, `:327`.
  - `stores.ts` `:67`, `:122`, `:123`, `:130`, `:162`, `:176-179`, `:354-366`, `:512`, `:514`.
  - `base-store.ts` `:38`, `:146-148`.
  - `src/core/browser/idb-store.ts` `:186`, `:226`, `:242`, `:281`.
- **Wrappers and others (15):**
  - `live-stores.ts` `:40-60`, `:56-58`; `spoof-remote.ts` `:37-41`, `:44-53`.
  - `store-cache.ts` `:36-38`, `:334-349`, `:348`; `held-set.ts:70-72`.
  - `src/data.ts:233-234`, `source-binding.ts:174`, `sherpa-provider.ts:564`.
  - `walk.ts` `:95`, `:160-164`, `:183` (inside `scanOf`).
- **Bench, docs and tests (14):**
  - `check-bench.mjs` `:34`, `:35`, `:64-73`, `:180-185`, `:211-239`, `:227`, `:240-245`, `:282`, `:299-308`.
  - TRAPS "Under change" (`~:1869-1878`) and `:3957-3958`; DATA-SOURCE-RULES `:173`, `:302`, `:433`.
  - Tests `a-closed-source-hears-nothing.test.mjs:16-21` (spies on `load()`, and the insert now goes through `#reask`), `a-held-set-takes-a-change-in-place.test.mjs:79` (a change sent by hand) and `:133`.
- **Measured (25):**
  - Every cell of the §1 table except the W10 draws cell; 11 acts down, 0 up; all 57 existing acts unchanged (`save` with "Owner 03" costs the same).
  - Times 18→5, 34→5 and 16→5 ms; `notheld` is 8 asks; every stage claim in 3.4 and 3.5.
  - Row 17's owner is already "Owner 02", and the rows have 15 fields; the 350 worst INP is 176 ms (`7a892477`); `06f7a4f2` moved `data-source.ts` by 2 lines after 722.
- **Behaviour:**
  - A toggle makes no store change.
  - Value lists are read only at open (`page-definition.ts:77`).
  - A set kept from an earlier session plans `held-stale` (`read-plan.ts:55`), so it is not trusted.
  - `#rowsCache` is read only by stores with no `scan`.
  - A RestStore has no old row.
  - An off saved filter's test result is thrown away (`source-counts.ts:150`, `walk.ts:162-164`).

Files are in `/private/tmp/claude-502/history-study/verify`:
- `stale.mjs`: probes M1, M2 and M3
- `same.mjs`: probes W5
- `rows.mjs`: the seeded bench rows (rows 17 and 18)
