> **Checked against HEAD `0fa1b5af` on 2026-10-19** (a read-only agent; about 145 claims confirmed). What it changed is in §0 below, and it WINS over the sections after it. Line numbers in §1–§6 are at `dde2589e`; §0.K has the HEAD lines.

## 0. The check — what changes before building

**Wrong in the design:**

1. The line shifts in §2.1 are wrong; use §0.K.
2. `#take` adds a saved filter at :869 and calls `drawBars` at :873 (HEAD).
3. **A saved filter the panel adds does NOT reach the bar.** `#take` calls `SourceBinding.drawBars` → `drawScope(describe())`, and `drawScope` only adds ids already in the bar's `#available`. So §3.3's second bullet (draw a described saved filter that `#available` lacks) is REQUIRED.
4. `query.ts`: the View's answer wins at :230-231; `compile` reports an unknown preset at :239-246; C0 extracts :227-248.
5. `store.ts`: `in` at :404-405, `looseEqual` at :430-435, dates per row at :408-410, `distinct` at :239.
6. **C4's bench act proves nothing.** An undeclared pick ('Nowhere') never reaches the filter. A real set-aside costs **4** loads today (measured on the 10-row fixture with paging and an all-rows bind); the walk makes it **2**, not 1. The act needs a DECLARED value with no rows under the picks before it — check the combination is empty in the 10k seed first.
7. Wrap `passOver` as a scan in **C5**, when `walk.ts` is first imported — not C4.
8. The new `page-definition.test.mjs` case goes after :304, not :294.
9. Toolbar `drawScope` is :1321-1385. `CompileFacts.drop` doc is :100-102.

**Must change because of what landed (345 phase 4, 355):**

- **A. `#walkRows` follows `#reads` / `#plan`.** `held` or `held-stale` → walk `cache.set.rows` in place (stale included, so 4.4's "a failed read keeps the set" decides for the walk too). `store` (never holdable, over the cap, refused, `holdRows: 0`) → stepwise. A CLOSED source does not walk. `HeldSet.rows` is already in place.
- **B. A failed walk never aborts the load.** Catch inside `#walked`, keep the last walk, never touch `#down` — a stepwise walk against a store that cannot be reached would otherwise blank the page.
- **C. A stepwise walk is never on the critical path.** Walk BEFORE the load only for a held set or a local in-place scan; stepwise keeps today's spot, after publish.
- **D. `#rowsAge` moves** in `#onStoreChange`, `#onSet` and `load({ force })`. Delete `#presentFor = ''` in `#onStoreChange`. Keep "a change or a set from the cache moves the source's `#age`".
- **E. The bench has 51 acts** (records, remote, rest × 17). `aside` lands on all three; `asked()` must stay empty for `remote/aside` and `rest/aside`.
- **F. The INP baseline is 355's:** tick 104 ms, second value 88, saved filter 176, View pick 80 (4x). A walk before the load must keep each under 200.
- **G. The grid's `drawOffered`** hooks both the kept-cell mark (C5's `#drawHeadCell`) and `drawPresent` / `#markPresent`.
- **H. 345 seams:** expose each scope's tested and tallied fields, so History (phase 3) can skip a re-walk; they are `planRead`'s `need` later.
- **I. The peer gate is gone:** phase 4 is committed.
- **J. TRAPs:** also extend `T-a-read-is-planned` and `T-a-failed-read-keeps-the-last-set`; the rename also moves the mention in `T-a-store-has-one-cache`.

**Missed:**

- `test/unit/a-store-has-one-cache.test.mjs` calls `results('data')` ({tier:3}, an insert, {tier:4}) — keep it green through the `#age` bump.
- The provider's legend listener (`sherpa-provider.ts` ~:857) reads the `present` event's `detail.byScope[partKey][field]`: `#drawWalk` keeps that shape, part scopes included.
- `#compileFacts().drop`.
- Tests: the `present-limits` comment block :137-140; Demos `reforged-limit-options.spec.ts` :3-8 header and :49 comment; a NEW test for Q1 A ("Limit off: the View greys a legend value").
- Controls that write order themselves: toolbar `#render` → `#inSets`, `#addFilters` (append), `heldFields` → `answerScope` → `hold()` (the bar writes `q.holds` on every report); the panel's Organise → Presets → fields and `#groupSets`; the View chip first. Toolbar, panel and grid each work out set-aside with `allSetAside(ruleOut(...))`.
- **Gates:** `check:size` (pre-commit) and `check:weight` (`npm test`) need growth recorded on purpose for `walk.ts`, `source-counts.ts` and `data-source.ts`.

**K. HEAD lines (`data-source.ts`):** `#parts` :184 · `#viewFilter` :208 · `setFilter` :516-523 · `contribute` :535-539 · `answer` presets :705 · `describe` :744-807 · `#take` :863-874 · `declareFromRows` load :973 · `declareSets` :1035-1053 · `offer` :1324 · `debugState` :1381-1414 · `#recompose` :1418-1444 · `#ask` :1803-1885 · `results` :1893-1916 · `valueResults` :1926-1949 · `#drawResults` :1954-1982 · `limitOptions` :1991-1996 · `present` :2005-2026 · `#setAsideNow` :2037-2081 · `#chainAside` :2085-2102 · `offered` :2110-2124 · `#settleSetAside` :2128-2147 · `#recency`… :2151-2176 · `#drawPresent` :2186-2212 · `attach` :2228 · `answerColumn` hold :2324. (Moved again by the 4.3–4.7 review fixes: re-read before each edit.)

---

# THE WALK, for TODOs 347, 348 and 349: the two designs scored, then one merged design

This was a read-only pass. I edited and built nothing. I ran `npm run check:bench`, which writes nothing. All 32 acts are within the baseline, and the numbers match both designs' tables (report: 32 scans locally, 15 held).

Line numbers are at HEAD `dde2589e`. For `data-source.ts`, these are the same as at `30e4f4f5`.

## The scores

| | pure-first | migration-first |
|---|---|---|
| **Correct against the code and Will's rules** | **3.5 / 5.** Strong: one pass for each scope, which stops each row at the first step in force that it fails. Each picked value is counted by its own clause, as today (`data-source.ts:1903-1905`). Fields that are not held are tallied where they would land. Page scopes and the hand filter (`:203`, `:508-515`) go into the View's base. Wrong: (a) setting some picks aside assumes exact keys, but `in` compares loosely (`store.ts:423-428`, `looseEqual`), so the walk's end can differ from the compiled rows. (b) Every lower field of a serial set REMOVES values even when nothing before it is answered, so a declared value with no rows vanishes. Today's chain needs a field above it to be answered (`data-source.ts:2081`). (c) A lower field's `present` with Limit off contradicts its own "`present(VIEW)` stays `{}`". (d) It starts setting chart parts' picks aside, which nobody asked for. Today parts are never set aside (`:2011`). (e) Its toolbar lines are at `69dd2dcf`, and its TRAP lines are older than that. | **3 / 5.** Strong: an exact second pass when some picks are set aside; parts are never set aside; an unknown saved filter is flagged `known`; it warns that `describe` reads the draft while the walk reads the applied Query. Wrong: (a) each value's count is a loose fold of the tallies, which is wrong for array values and is not today's per-value clause. (b) Its `narrowed` check looks only inside the scope, so a component scope's chain misses the View (347 step 2). (c) It walks page scopes as their own passes, but nothing draws them (`source-binding.ts:126-132`), so those passes are wasted. (d) `results()` can start a requery through `#afterWalk`, which is a side effect inside a read. (e) It misses the hand filter. |
| **Smallest safe steps** | 3: C5 is one large switch. Counts, limits and all the deletions land together. | **5**: C0 extracts a helper, C1 is pure and unwired, C4 does counts (with the old set-aside handed in), and only then C5 does limits. Each can be reverted in reverse order. |
| **Testable** | **5**: a property test against a naive `referenceWalk`, a parity test with the step-by-step fallback, a bench act that sets a pick aside (proves loads 2 → 1), and `debugState().aside`. | 4: a parity test and exact numbers per case, but no reference walk and no bench act that sets a pick aside. |
| **Bench drop** | **5**: one scan for each scope. A report goes 32 → about 4. | 3: one pass for each step that narrows. A report goes 32 → about 8. |

**What both designs missed (checked now):**

1. **A peer agent is working on 345 phase 4.2 right now, in the same files.** Uncommitted changes are in `data-source.ts`, `check-bench.mjs`, `bench-baseline.json`, `store.ts`, `stores.ts` and `spoof-remote.ts`, plus a new `store-cache.ts`.
   - In the working tree, `#held`, `#holding`, `#heldAge`, `#mayHold` and `#readWhole` are gone. They are replaced by `#cache: StoreCache`, and `get #reads` returns `cache.set` while it is current (working tree `:1695`).
   - Both designs' `#walkRows` read `this.#held`, which no longer exists.
   - Phase 4.3 adds `read-plan.ts` / `planRead`, and `#reads` will follow it (`plan-345-phase-4.md:112`, `:360`).
2. **The TRAP headings at HEAD** are: `T-a-chip-counts-its-own-results` :1685, `T-a-filter-set-groups-or-chains` :1766, `T-the-bench-counts-and-never-times` :591, `T-a-remote-source-holds-its-whole-set` :3552, `T-a-ruled-out-value-is-greyed` :7579, `T-a-later-answer-sets-an-earlier-pick-aside` :7662, `T-the-add-menu-is-the-whole-list` :11541 and `T-only-the-view-trickles-down` :16273.
3. **The saved-filter gap is narrower than pure-first says.**
   - `drawBars` fills the bar from `describe()` (`provider-page.ts:351-360`), and `#take` calls `drawBars` (`data-source.ts:861`). So a saved filter the panel adds does reach the bar.
   - Only `drawScope` adds a chip just from `#available` (toolbar `:1355-1356`), and `#offer` passes fields only (`provider-page.ts:376`).

---

## 1. Exact semantics

*From: pure-first, because its single pass is exact and gives the larger bench drop, and its taps and per-value clauses match today. Four fixes come from migration-first: a re-walk on ANY set-aside, which keeps it exact under loose matching; serial removal only when something before the field narrows; parts never set aside; and the `known` flag for an unknown saved filter.*

### 1.1 `answerOrder(applied, sets, presets, scope) → OrderEntry[]`

This goes in `source-counts.ts`. It is pure and uses no component words (341).

```ts
type OrderEntry =
  | { kind: 'preset'; id: string; on: boolean; known: boolean }
  | { kind: 'field'; id: string; held: boolean; above: boolean; set?: string; chain?: 'top' | 'below' };

answerOrder(applied, sets, presets: (id) => Readings | undefined, scope):
  q = applied.scopes[scope]; if (!q) return []
  above = scope === VIEW ? ∅ : heldInView(applied)                    // query.ts:147
  out = []
  // 1. SAVED FILTERS FIRST, in the order the scope keeps them. answer() writes the bar's
  //    order (data-source.ts:697); #take adds a new one after the rest (:857).
  for [id, on] of entries(q.presets ?? {}): out.push({ kind:'preset', id, on, known: !!presets(id) })
  // 2. HELD FIELDS. Each set is gathered where its first held field stands, in the set's
  //    order. A field is in one set at most (declareSets :1027-1045).
  placed = ∅
  for f of q.holds:
    run = setOf(f) ? setOf(f).fields.filter(x => q.holds.includes(x)) : [f]
    for x of run, x ∉ placed: placed.add(x); out.push({ kind:'field', id:x, held:true, above: above.has(x), set })
  // 3. A reading that no chip holds (a View select() on an unheld field) goes LAST.
  for f of keys(q.readings), f ∉ placed: out.push({ kind:'field', id:f, held:false, above: above.has(f) })
  // CHAIN MARKS: the same rule as serialChains (source-counts.ts:47-61), so that function goes.
  for set of sets, set.mode === 'serial':
    chain = out.filter(e => e.kind==='field' && e.held && !e.above && set.fields.includes(e.id))
    if (chain.length > 1) { chain[0].chain = 'top'; chain.slice(1).forEach(e => e.chain = 'below') }
  return out
```

### 1.2 `planWalk(applied, facts) → WalkPlan`

This also goes in `source-counts.ts`. It and `compile` share one rule through `scopeClauses()` / `appliesIn()`, which are extracted from `query.ts:227-249`.

```ts
interface WalkStep {
  id: string; field?: string;
  clause?: Filter;                 // its whole answer; `suspended` is stripped so an OFF chip still counts
  on: boolean;                     // narrows the steps after it
  counts: boolean;                 // wears a badge
  list: boolean;                   // catalogue.isList (field-catalogue.ts:131-135)
  ruler?: 'here' | 'start';        // what greys its values and sets its picks aside
  offers?: boolean;                // a serial set's lower field: REMOVES what S here lacks (once something narrows)
  picks?: string[];                // value keys of a Simple, non-range, DEFAULT_OP list answer in force (today :2023-2024)
  each?: Array<[key: string, Filter]>;  // each pick's own clause, as valueResults builds it (:1903-1905)
}
interface WalkScope { scope; after: string | null; steps: WalkStep[]; taps: Array<{ at: number; fields: string[] }>;
                      setsAside: boolean /* false for a part */ }
interface WalkPlan { scopes: WalkScope[]; now: Date }
interface PlanFacts { field(f); isList(f); presets(id); sets(scope); fields(scope); components; fixed;
                      parts: Filter[] /* #parts :179 */; hand?: Filter /* #filter while #viewFilter===null */;
                      narrowing: Map<scope, { field; host?: string }>; limit: boolean }

planWalk(applied, facts):
  pageClauses = scopes no bound element answers (not VIEW, not narrowsOne) → scopeClauses   // compile's `view`, query.ts:254
  base = and([...facts.parts, ...pageClauses]) ?? facts.hand
  VIEW      : after null, steps [{ id:'', clause: base, on: !!base, counts:false }, ...stepsOf(VIEW)]
  component : every bound scope except VIEW, not narrowsOne → after VIEW                    // 347
  part      : each #narrowing entry → after = its element's component scope (source-binding.ts:168), else VIEW;
              setsAside:false (today :2011); its legend field is a step if answered, else a tap
  default   : narrowsOne with no part (#defaults, data-where) → skipped: it has no chips

ruleOf(s) = facts.limit ? 'here' : s !== VIEW ? 'start' : undefined                          // D5 A + 347

stepsOf(s): for e of answerOrder(...):
  preset: clause = e.known ? and(presetClauses(readings)) : undefined; on = e.on && !!clause; counts = on   // 166
  field : skip unless appliesIn(applied, s, f, fixed)            // the View's answer wins (query.ts:237-238)
          off = !!r?.suspended; clause = r ? readingClause(facts, { ...r, suspended: undefined }) : undefined
          on = !!clause && !off;  counts = !!clause                                              // D3 A, TODO 123
          ruler = list ? ruleOf(s) : undefined;  offers = list && e.chain === 'below'
          picks/each only when !off, simple, !range, op === DEFAULT_OP, picked.length
taps(s): only if ruleOf(s). Each list field in fields(s) (the View: every offered field, :1330) that is not held
         here and, below the View, not View-held. at = just after its set's last step, if its set has a
         field held here; else at the end.
```

### 1.3 `walkInOrder(rows, plan) → Walk` (new `src/core/data/walk.ts`, DOM-free)

`walk.ts` imports only `absoluteDates`, `matchesFilter`, `readField`, `valueKey` and types from `store.ts`.

```ts
interface Walk {                                              // by scope id
  results: { [scope]: { [id]: number } };
  values:  { [scope]: { [field]: { [key]: number } } };
  present: { [scope]: { [field]: string[] } };                // ruler fields and taps
  offered: { [scope]: { [field]: string[] } };                // `offers` steps, only once narrowed
  aside:   { [scope]: { [field]: string[] } };                // compile's drop
  spent:   { [scope]: string[] };                             // taps with no value left (the Add list)
  ends:    { [scope]: number };
}
walkInOrder(rows, plan):
  for sc of plan.scopes:                                      // View first
    start = sc.after ? end(sc.after) : rows;  narrowedAtStart = sc.after ? narrowed(sc.after) : false
    tests = steps.map(s => s.clause && test(absoluteDates(s.clause, plan.now)))  // dates made absolute ONCE (not per row, store.ts:404-405)
    live = start; from = 0; next = 0
    loop:
      reach = passOver(live, steps, tests, from, acc)         // ONE scan: tally, count, per-value; stop at the first ON step failed
      j = first i ≥ next with steps[i].on && sc.setsAside && asideOf(i).length
      //  asideOf(i) = picks ∉ ruler(i) ∪ (offers && narrowed(i) ? picks ∉ tally(i) : ∅)
      //  ruler 'here' = tally at i; 'start' = tally over start
      if (!j) { end(sc) = live rows with reach === steps.length; break }
      tests[j] = clause less asideOf(j); none left → it narrows nothing and wears no badge (today :1871)
      live = live rows with reach ≥ j; from = j; next = j + 1; acc.reset(j)   // exact: covers loose matching
    write the Walk entries for sc
```

`passOver` is pure-first's: for each row, from `from`, it tallies, counts and counts per value at each step, and it breaks at the first ON step the row fails. The bench counts each call as one scan.

`narrowed(i)` is true when a step before `i` in this scope is in force, or when the scope's start was narrowed.

**Cost:** one scan for each scope, plus one partial re-scan for each step that has a pick set aside (rare). Today, each chip, each value, each limiting filter and each chained field is its own full pass.

**`walkStepwise(reads, plan)`** is for a remote store that is not held. It runs the same plan as requests: `presentUnder` (kept) for the tallies, and `totalCount` for each counted step and each pick. That is about today's number of requests.

### 1.4 Each case

| Case | Narrows the steps after it | Its badge | Greys / sets aside |
|---|---|---|---|
| A field ON | yes | yes | a list field: by its ruler |
| A field OFF (D3 A) | no | yes, within the steps before it | tallied; never set aside |
| The bar's Switch off | `keepOff` suspends each field and turns each preset off (`query-edits.ts:82-90`), so each step is as the rows above | | |
| A saved filter ON / OFF | yes / no | yes / **no** (166) | — |
| An unknown saved filter | no | no | — (`compile` reports it, `query.ts:241-248`) |
| A View-held field in a component scope (not fixed) | skipped | — | — (`describe` still shows it with `appliedAt`) |
| Range, Advanced, `ne`, `contains` | by its clause | yes | its list is tallied; never set aside |
| Dates | its clause, made absolute once | yes | not a list |
| Number ranges and calendar days | whole set (347 "not in this pass", `field-catalogue.ts:104-116`) | | |
| A chart part | starts inside its host | yes | greyed (Q1 A); **never set aside** |
| Page scopes, `#parts`, the hand filter | the View's hidden base step | — | — |
| Search | never in counts (plan §347) | | |

### 1.5 Invariants (one test each)

1. The last step in force in a scope counts exactly that scope's `ends`. On Records, that is 13. A search breaks this.
2. For a scalar list field, its per-value counts add up to its count.
3. `ends[VIEW]` equals `filterRows(rows, #viewFilter)`, and a component scope's `ends` equals the rows its grid shows.
4. One walk per key; a second read reads it back.

On the 10-row fixture (`present-limits-each-field.test.mjs:17-25`): with AW + LATAM and Limit on, the total goes 2 → **3** (AW stays, LATAM is set aside), and `present.customer` lists all four.

---

## 2. Where it plugs in

*From: pure-first, because it walks again on the "still" path (`#rewalk`) and never requeries from inside a public read. From migration-first: skip reading rows when nothing is counted. Both are adapted to 345 phase 4.2's `#cache` / `#reads`.*

### 2.1 Replaced or deleted (HEAD lines)

The peer's 4.2 edit moves the lines after `:217` by −7 and the lines after `:1700` by about −57. Cite again once it lands.

| Today | Becomes |
|---|---|
| `limitFor` `source-counts.ts:20-28`, `serialChains` :45-61, `belowIn` :63-70, `clauseOf` :72-79 | deleted. `presentUnder` :30-43 stays, for `walkStepwise` only. |
| `heldAbove` `query.ts:152-154` (callers `data-source.ts:1866`, `:1896`, `:1973`) | deleted. `CompileFacts.drop` doc :99-102 → "the picks the filters before it rule out". |
| `results` :1857-1880, `valueResults` :1890-1913, `present` :1969-1990, `offered` :2074-2088 | read back `await this.#walked()`, as a copy. The early `{}` return in `present` (:1970) goes. |
| `#drawResults` :1918-1946, `#drawPresent` / `#presenting` / `#presentFor` :2150-2176 | `#drawWalk(only?)`, synchronous, keyed `#drawnFor = [walkKey, controls]`. It still dispatches `present` for the legends (:2171). |
| `#setAsideNow` :2001-2045, `#chainAside` :2049-2066 | deleted |
| `#settleSetAside` / `#settling` / `#settledFor` :2092-2111 | deleted (the settle → recompile → second load) |
| `#recency` / `#noted` / `#lastSeen` / `#noteRecency` :2115-2140, the call at :1411, `suspendScope` stamps :1181 and :1201 | deleted (D4 A) |
| `#presentSoon` :2143-2146; `#counting` / `#countedFor` :2178-2181 | `#walkSoon = coalesce(() => void this.#rewalk())`; `#walking = new Latest()` |
| `#recompose` :1406-1432 | :1412-1424 become `#compileNow()`. :1430-1431 become `if (still && loaded) #walkSoon()`. |
| `#ask` :1773-1849 | walks before the load (§2.2). :1831-1832 become `#drawWalk()`. |
| `attach` :2209 | `#drawWalk(el)` when the walk key matches, else `#walkSoon()`. This closes W1's "control bound late" gap. |
| `limitOptions` setter :1955-1960 | `#rewalk()` |
| `offer` :1316, `declareSets` :1028, `contribute` :527-531 | `#age++` (`offer`, `contribute`), plus `#walkSoon()` when loaded. Today a set or an offer change counts nothing again. |
| `debugState` :1373-1402 | gains `aside` |

### 2.2 `compile` learns the set-aside picks before it compiles

```
#ask(key):  await #hold(); ticket check
            w = await #walked(); ticket check
            if #takeAside(w.aside): #setAside = w.aside; #compileNow(); key = #stateKey(); #inFlightKey = key
            result = await #reads.load(#loadOptions())       // ONE load
            … all rows (:1794-1811), publish, change … ; #drawWalk()
#rewalk():  w = await #walked(); if #takeAside(w.aside) && the shared filter moved → #requery() else #drawWalk()
```

- The walk key holds no set-aside (the walk computes it). So the load after `#takeAside` reads back the cached walk.
- `load()`'s no-op guard (:1649) stays safe:
  - if the filter moved, the load walks;
  - if it did not, the still path walks.

### 2.3 One walk per key; rows read once

```ts
#walkKey() = JSON([#age, #limitOptions, #applied, [...#parts], #viewFilter === null ? #filter : null,
                   [...componentScopes].sort(), [...#defaults.keys()].sort(), [...#narrowing].map(([s, p]) => [s, p.field, hostOf(p)])])
async #walked(): Walk          // { key, out } memo + an in-flight promise for the same key; a Latest ticket;
                               // the plan is built BEFORE the await; an empty plan (nothing counted, tallied or tapped) reads no rows
async #walkRows(): Promise<readonly Row[] | null> {
  await this.#hold();                                   // the one hold site for counts (345 decides through #reads)
  const reads = this.#reads;                            // working tree: the store's held set while current, else the store
  if (this.#remote) return reads.scan ? reads.scan() : null;   // held: in place; not held → walkStepwise
  if (this.#rowsCache?.age === this.#rowsAge) return this.#rowsCache.rows;
  const age = this.#rowsAge;
  const rows = reads.scan ? await reads.scan() : (await reads.load({})).rows;   // ArrayStore in place; IdbStore one getAll
  if (!reads.scan && rows.length > this.#holdRows) return null;                // a copy too large to keep: stepwise
  if (age === this.#rowsAge) this.#rowsCache = { age, rows };
  return rows;
}
```

- **`#rowsAge` moves** in `#onStoreChange`, in 4.2's `#onSet`, and in `load({force})` (:1639-1642). `declareFromRows`' `load({})` (:965) seeds the cache for IdbStore.
- **`Store.scan?(): Promise<readonly Row[]>`** (beside `distinct`, `store.ts:235`):
  - ArrayStore: `(await this.page(this.#rows, {})).rows`. This is one counted scan, and no row is copied (`T-array-store-copies-both-ways`: it is never handed to a host).
  - `HeldSet.scan()` returns its live `#rows` (`held-set.ts:22`).
  - LiveStore forwards it (`live-stores.ts:147`).
  - JsonStore forwards its inner store's.
  - **`spoofRemote` does not** forward it: a remote store is held or asked, never scanned.
  - The `#reads` type gains `scan`.
- **The `#hold()` sites go from 8 to 4:** `:962`, `:1779`, `#walkRows` and `:2223`. This is the seam for 345's `needOf` / `planRead`: the fields a plan tests and tallies are the walk's part of the need. Do not build it now.

---

## 3. How the controls learn the order

*From: pure-first, because it covers more (it adds the Add-list `spent`, the grid's `drawOffered` and the Advanced value rows). Migration-first's HEAD line numbers for the toolbar are kept.*

1. **`describe(scope)`** (`data-source.ts:736-799`; `filters: [...presets, ...fields]` at :787) builds `filters` from `answerOrder(this.#draft, …)`. Sets are gathered by the source, and View-held fields keep their place with `appliedAt` (:772). `sets` is still returned (:788).
2. **Provider:** `drawBars` already calls `populate([...picker, ...described.filters])` (`provider-page.ts:351-360`), so a bar opens in the source's order. No change.
3. **Toolbar** (HEAD):
   - `drawScope` (:1321-1392): after the add/remove at :1350-1356, reorder `#filters` to the description's ids. Persistent chips and `field: null` chips stay first. It re-renders only when the order moved, silently.
   - Also in `drawScope`: add a described saved filter that `#available` lacks, built from its description (which carries `readings`).
   - `#addFilters` (:1447-1478; append at :1471): a def with `readings` goes at `findLastIndex(f => f.readings) + 1`, or after the persistent chips when no saved filter is on the bar. Fields still append.
   - The `presets` getter (:1238-1243) then reports saved filters first. `#inSets` (:1286) and `groupSets` (:1277) stay for a bar with no source.
4. **Panel:** Organise, then Presets, then fields in `describe` order (`sherpa-filter-panel.ts:543-595`). `#groupSets` (:646-655) becomes a no-op on a sourced panel. No change.
5. **Grid headings** read `present`. A free field's tap is where it would land; `answerColumn` appends it (:2286-2288). The grid gains a `drawOffered` (none today; `drawPresent` is at `sherpa-data-grid.ts:544`).
6. **Add list (349):** a list field with `present[f]` equal to `[]` (`spent`) is greyed, and hidden when `hidesUnmatched` (`more-menu.ts:52`, so Limit on and Hide on). A held row is never greyed.
   - Toolbar `#renderAvailable` (:1407-1444) passes this to `drawFiltersButton` (`filters-button.ts:117`; `ListedFilter` :49).
   - Panel: `#fillFilters` (:944), from `#presentBy` (:419).
7. **Advanced value rows (347 step 4):** `#refillPicks` (`sherpa-menu.ts:1817-1842`) disables a value when `ruleOut(present, offered)` (`filter-state.ts:243`) rules it out, unless it is the row's own pick.

---

## 4. Commits, smallest first

*From: migration-first's order (extract the helper, a pure unused walk, counts before limits; each commit can be reverted in reverse order). Pure-first adds the bench act that sets a pick aside, the property test and the same-value guards. All of it is re-sequenced around the live peer.*

**After every commit:** `npm run build`, then its tests, `check:bench`, `map:write` plus a hand edit, `check:traps` / `traps:write`, and `spec:check` / `manifest` / `reference` when JSDoc changes. Then commit and build again so Demos is current. Never push.

**Peer gate:** C2 onward touch files the peer has dirty: `data-source.ts`, `store.ts`, `stores.ts`, `check-bench.mjs`, `bench-baseline.json` and `spoof-remote.ts`. Start each one only once 4.2 is committed and `git diff --cached` is empty. C0 and C1 touch none of them.

- **C0 `refactor(query)`**: `scopeClauses()` and `appliesIn()` come out of `compile` (`query.ts:227-249`).
  - Proof: `query.test.mjs` is unchanged; bench `compiles` is unchanged.
- **C1 `feat(data)`, pure and unused**: `answerOrder`, `planWalk` and `walkStepwise` in `source-counts.ts`; `walkInOrder` and `passOver` in a new `walk.ts` (the name is free).
  - New `test/unit/filters-limit-in-order.test.mjs`, importing `dist/core/data/walk.js` and `source-counts.js`:
    - order: saved first, a set gathered, unheld last, `above`, `known`, chain marks;
    - OFF counts but does not narrow;
    - a saved filter ON / OFF;
    - partial set-aside and full set-aside, including a case-variant pick (loose `in`);
    - `ruler` `'here'` vs `'start'`;
    - `offers` only once narrowed, including a component chain under a View pick;
    - taps at a set's place and at the end; `spent`;
    - each value's own clause;
    - `last 30 days` made absolute once;
    - the base step;
    - a part under its host, never set aside;
    - a property test: `walkInOrder` ≡ a naive `referenceWalk` ≡ `walkStepwise(new ArrayStore(rows))`.
  - New TRAP `T-one-walk-counts-and-limits-in-order`.
  - Bench unchanged.
- **C2 `feat(filters)`, D2 one order**: `describe()` and the toolbar (§3.1 and §3.3).
  - Tests: a new `page-definition.test.mjs` case after :294 (a set gathered in `describe().filters`); `test/e2e/reforged-filterset.spec.ts` (a saved filter added lands after the other saved filters; `drawScope` reorders to a new `holds` order; a missing described saved filter is drawn); re-run `reforged-quick-filter-toolbar` and `reforged-one-filters-button`.
  - Demos: new `test/e2e/reforged-a-new-saved-filter-lands-with-the-saved.spec.ts` (release a saved filter on Records `?view=risk`, add it back, and it is after the other saved filters in the bar and the panel).
  - Bench unchanged.
- **C3 `feat(data)`, `Store.scan?`** (§2.3).
  - New `test/unit/a-store-scan-reads-in-place.test.mjs` (the name is free): ArrayStore equals `load({})` by value and drops refused rows; HeldSet is in place; LiveStore forwards; spoofRemote has none.
  - `DATA-SOURCE-RULES.md:149-156`.
  - Bench unchanged.
- **C4 `test(bench)`**:
  - add the act `aside: p => p.view.answer({ region: { picked: ['EMEA', 'Nowhere'] } })` as the last act;
  - make the `onLoad` hook (`check-bench.mjs:46-74`) also wrap `walk.ts`'s `export function passOver(` as a scan, and throw when it is missing.
  - Record it alone with `--update-baseline`. It shows `loads 2` today.
- **C5 `feat(data)`, 348: a chip counts within the filters before it.**
  - Adds `#walkRows`, `#walked`, `#walkKey`, `#drawWalk`, and `results()` / `valueResults()` from the walk.
  - In this commit the walk is HANDED the old `#setAside` (in the key; no re-walk loop), so counts follow position while limits stay as they are. It is consistent, so do not leave it long.
  - New `test/unit/a-chip-counts-within-the-filters-before-it.test.mjs`:
    - counts fall along the order;
    - OFF counts and does not narrow;
    - a saved filter ON narrows what follows it; OFF has no badge;
    - a set is gathered;
    - the last chip in force = `debugState().total`;
    - a `contribute`d part narrows a data chip (347 step 1);
    - a part counts inside its host.
  - Re-run, expected unchanged (each case checked against the rule): `page-definition.test.mjs:159-232`, `a-field-counts-unique-rows`, `a-count-runs-again-only-when-something-moved`.
  - Demos `reforged-chip-results.spec.ts:7-32`:
    - read `.chips > .chip` in DOM order;
    - among chips in force, a count never rises along the bar;
    - the last chip in force is 13;
    - the keys `['at-risk', 'openTickets', 'status']` are kept;
    - :3-5 doc rewritten;
    - :39-179 re-run.
  - TRAP rename (§5). Docs: `QUERY-DESIGN.md:228-229`.
  - Bench: counts → **0** on every act; a report is about 22 scans. A gated rise is a stop.
- **C6 `feat(data)`, 347 + 349 + D4 + D5: limits from the walk too.**
  - The walk computes the set-aside, and `given` goes. §2.2 is wired in. Everything in §2.1 is deleted.
  - `present-limits-each-field.test.mjs`:
    - :63 stays;
    - add "off, only the View limits a component scope": View Litware, data `[active]` → `present('data').status` is `['trial']`, `present(VIEW)` is `{}`, total 1;
    - :75 "one way": `p.customer` lists all four;
    - :84 "the earlier stands": total 2 → **3**, `customer` all four, `region` `['AMER', 'APAC', 'EMEA']`;
    - :117 becomes "rows read once per store change; `distinct` only stepwise", plus a `spoofRemote` with `holdRows: 0` case;
    - :141-166: AW in force, total 7 → 1 → 7, :158 becomes `includes`;
    - :94, :102, :107 and :168 stay.
  - `a-serial-set-chains-its-fields.test.mjs`:
    - :55-80 assertions stay;
    - rewrite the :1-9 header and the :70 comment;
    - add "a filter before the set limits the chain";
    - add "a component chain starts inside the View".
  - Demos:
    - `reforged-limit-options.spec.ts:84-120` becomes "a later Region never sets aside the Customer before it": AW is `{greyed:false, refused:false, ticked:true, says:null}`, and the Alerts number is unchanged;
    - new `reforged-the-view-limits-a-component-scope.spec.ts` (Limit off: the data Status menu and the grid heading grey; a pick the customer lacks is set aside, per `debugState().aside`);
    - `reforged-serial-account-set.spec.ts:3-9` comment only.
  - Bench:
    - local report 32 → **about 4** (page load, all-rows load, View pass, data pass); switch-on, heading and raise about 4-5; pick and clear about 5;
    - remote report 15 → about 4, and `asked()` stays empty;
    - distinct → 0 except `open`;
    - `aside` loads 2 → **1**;
    - report compiles 16 → about 7;
    - `open` may move by ±1: look, then record on purpose.
- **C7 words**:
  - `shared-constants.ts:32-38`: `RULED_OUT` / `SET_ASIDE` become "Limited by the filters before it: …";
  - comments and JSDoc: `sherpa-quick-filter.html:53`, `sherpa-quick-filter.ts:60`, `sherpa-chart-legend.ts:57,68,258`, `sherpa-provider.ts:796`, `data-source-types.ts:185,261`, `filter-state.ts:31,238`, toolbar JSDoc :510-512 and :524-526, panel :362-366 and :409-413, grid :540-543;
  - then specs, `manifest` and `reference` (these rewrite the `docs/components` pages for the quick filter, the toolbar, the panel and the grid);
  - Demos: `app/templates/application.html:35`, and `reforged-limit-options.spec.ts:45,53,69,109,139`.
- **C8 grid `drawOffered`, and Advanced rows follow `present`** (§3.5, §3.7).
  - Tests: new cases in `test/e2e/reforged-serial-set.spec.ts` and `reforged-filter-conditions.spec.ts`.
- **C9 the Add list greys or hides spent fields** (§3.6).
  - Tests: `reforged-one-filters-button.spec.ts` and `reforged-panel-filters-button.spec.ts`.
- **C10 W6 guards**:
  - the `present` / `offered` setters (`sherpa-menu.ts:1305`, `:1317`) and `chip.results` (`sherpa-quick-filter.ts:938`) do nothing for the same value;
  - `#markPresent` (:583) skips a chip that did not change.
  - `draws` falls. Run the INP probe (`inp.mjs`) and write the numbers into TODO 348.
- **C11 (optional, measured)**: on a local store, take `#allRows` from the walk's View end (`applyOptions`, copied with `carryKey`) instead of the second load (:1794-1811).

---

## 5. TRAPs and words

*From: pure-first's list, which is more complete (it also covers the remote-hold and bench TRAPs), with migration-first's timing per commit. Line numbers are HEAD.*

- **Rename** `T-a-chip-counts-its-own-results` (:1685) to **`T-a-chip-counts-within-the-filters-before-it`** in C5.
  - New text: the rows its scopes leave (parts, then the View for a component scope, then a part's host), the filters before it in the one order, and its own answer. OFF still counts (123); a saved filter counts only while ON (166); each value counts within the same rows (172); the header counts each row once (173); one walk per key.
  - Gated citations to move: `data-source.ts`, the toolbar, `sherpa-quick-filter.ts`, `sherpa-filter-panel.ts`, `sherpa-filter-panel.css`, `page-definition.test.mjs`, `a-count-runs-again…`, `a-field-counts-unique-rows…`, and `test/e2e/reforged-chip-results.spec.ts`.
  - Also update the mention in the body text at `TRAPS.md:10302`.
- **Delete** `T-a-later-answer-sets-an-earlier-pick-aside` (:7662) in C6. Move its citations to `T-a-ruled-out-value-is-greyed`:
  - `shared-constants.ts:37`, `filter-state.ts:255`, `query.ts:101`, `present-limits…:140`, and the mention at `TRAPS.md:7584`;
  - Demos `limit-options:90` (not gated);
  - the citation in `data-source.ts` goes with `#setAsideNow`.
- **Rewrite** `T-a-ruled-out-value-is-greyed` (:7579):
  - the filters BEFORE a field limit it, one way only;
  - Limit on: grey and set aside against the rows at its place;
  - Limit off: only the View limits a component scope, and the View is not limited;
  - parts are greyed, never set aside;
  - Hide is unchanged;
  - the `distinct()` paragraph becomes the three ways to read rows.
- **Rewrite** `T-a-filter-set-groups-or-chains` (:1766):
  - a lower field offers what the rows hold at its place, once something before it narrows;
  - a component scope's chain starts inside the View;
  - the top follows Limit;
  - the source gathers the set in `describe()`.
- **Extend:**
  - `T-only-the-view-trickles-down` (:16273): counts, menus, chains and the Add list;
  - `T-the-add-menu-is-the-whole-list` (:11541): a spent field is greyed, and hidden with Hide;
  - `T-the-bench-counts-and-never-times` (:591): `passOver` counts as a scan;
  - `T-a-remote-source-holds-its-whole-set` (:3552) and 4.2's `T-a-store-has-one-cache`: the held set is walked in place.
- **New** `T-one-walk-counts-and-limits-in-order`, in C1 (its sites grow through C6). Add it to `TRAPS-INDEX`.
- **Docs:** `QUERY-DESIGN.md:228`; `PAGE-DEFINITION.md:70-71` ("sees the filters before it"); `DATA-SOURCE-RULES.md:149-156` and the HELD section.

---

## 6. Risks, and two questions for Will

*From: both risk lists combined, plus the live peer agent, which both designs missed.*

1. **The live peer (345 phase 4.2 now, then 4.3 and 4.4)** owns `#reads` / `#hold`. `#walkRows` must follow `#reads`, so that 4.3's `planRead` and 4.4's "a failed read keeps the set" decide for the walk too. Re-read `data-source.ts` before C2.
2. **INP may not move.** The walk runs before the page load. For IdbStore, the first ask after a store change reads twice (rows, then the page) before rows draw. Measure in C10; C11 is the fix.
3. **Behaviour changes Will will see:**
   - saved filters lead the bar;
   - badges fall along the bar;
   - a later pick never greys an earlier one;
   - with Limit off, a component scope greys and sets aside what the View rules out.
4. **The step between C5 and C6** counts by position but still sets picks aside newest-first. It is consistent, but ship C6 next.
5. **`describe` reads the draft and the walk reads the applied Query.** On a remote store with a pending holds change, the drawn order can lead the counted order. Counts hide while a change is pending (46).
6. **Memory:** `#rowsCache` keeps one copy of an IdbStore's rows (100 in Demos), capped at `holdRows`.
7. **The bench counts passes, not rows,** so the fall in scans undersells the change.

**For Will** (my pick first in each):

- **Q1. A chart legend's own scope, with Limit off.**
  - **A (pick):** it sits under its host like any component scope. The View greys the legend values it leaves no rows for. It never sets a legend pick aside.
  - **B:** it is greyed only while Limit is on, as today (`data-source.ts:1970`).
- **Q2. The TOP field of a serial set, when filters stand before it.**
  - **A (pick):** the top is never cut. It is greyed only by Limit, or by the View for a component scope. The fields below it lose what everything before them rules out.
  - **B:** the top also removes what the filters before the set rule out. A declared value with no rows then vanishes from the first menu.
  - On Records, both give the same answer.