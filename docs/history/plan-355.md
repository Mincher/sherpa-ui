# TODO 355: the grid stops rebuilding its heading

`G` = `src/components/sherpa-data-grid/sherpa-data-grid.ts` and `E` = `src/core/ui/sherpa-element.ts`. TRAP line numbers are the current ones in `docs/TRAPS.md`. Several have moved since the explorers mapped them.

## 1. Today, in numbers (Demos Records: bound, 14 columns, 25-row page)

| act | heading rebuilt | body rebuilt | forced layouts |
|---|---|---|---|
| tick the first Status value | 4–5, plus 1 for each other field already answered on the bar | 4–5 | 6–8 |
| turn on a saved filter (nothing answered) | 3 | 3 | 6 |
| sort click, bound (field and direction both change) | 3 | 3 | 6 |
| sort click, unbound (G:1413-1415) | 3 | 3 | 6 |

Where the numbers come from:
- **`drawReading`.** Each answered field on the bar costs one heading and body rebuild during the click (G:818-830). It has no "same reading" guard, and `apply` calls `select` for every chip (data-source.ts:676-678 → `#draw` 1123-1138).
- **Attributes.** Each view attribute that changes costs one full `#render`. `onChange` ignores the attribute's name (G:254-258). `writeView` writes 8 attributes one at a time (bind-source.ts:106-115), and only a same-value write is dropped (E:521).
- **Rows.** `renderData` then costs one more full render (G:280). It runs a microtask after `populate` (E:731-734).
- **Layout.** `#syncPinned` (G:338-353) and `#fill` (G:311-326) both read layout on every full render: 2 forced layouts each time.

**Size of one heading build.** It removes every cell (G:405) and clones them all again. For each of the 14 cells:
- 2 `sherpa-quick-filter` chips, each with 1 `sherpa-tooltip`;
- 1 `sherpa-menu` from `menuFor` (filter-menu.ts:81), which stamps its own filter tree: buttons, input-texts, slider, switch, breadcrumbs and footer.

That is about 280–560 components per heading build (20–40 per cell). The filter row is rebuilt too (G:934-961), even though CSS hides it on Records.

**Size of one body build.** 25 rows × 2 select components = 50 components, plus 350 cloned cells.

**Thrown-away cells.** `#bootstrap` stamps without checking `isConnected` (E:861-889). So a cell that a later render in the same run has already removed still stamps. This matches the profile: 257–266 ms spent in `#bootstrap → #stamp`, out of about 500 ms busy.

## 2. The fix: five commits, smallest risk first

### C1: Guards (tiny)
- **`drawReading` (G:818).** Return early when `sameReading(this.#columnFilters.get(field), reading)`. That function is in query.ts:194. It compares the answer keys in a fixed order, including `suspended`, `mode`, `mirror` and `kept`, so T-both-answers-are-kept (2255) still holds. This removes the "+1 per other answered field".
- **`#filterDef` (G:509).** Work out `#presentValues(...).sort()` only when there is no `given` def. Today it is computed for all 14 columns and thrown away.

### C2 (a): one render per tick
- **New members.** `#dirty: Set<'all'|'head'|'body'|'layout'>` and `#schedule = coalesce(...)`, reusing `coalesce` from src/core/data/timing.ts:16-26. This is the house pattern (T-coalesce-microtask-not-debounce, 2851).
  - `#flush()` runs `#render()` for `'all'`. Otherwise it runs head, then body (`#renderBody` + `#syncSelected` + `#syncGroupSelects` + `#syncCurrent`, as G:1513-1517 does), then layout.
  - `#render()` clears `#dirty` first.
- **`onChange` (G:254).** It still parses needles and column values synchronously, then calls `#invalidate('all')`.
- **One render per publish, not two.** Override `populate()` to set `#awaitingData = true`, then call `super.populate(data).finally(...)`. The `finally` clears the flag and re-schedules if anything is still dirty. `renderData` clears the flag at its top.
  - The scheduled flush skips while `#awaitingData` is set. `push` sends the view before the rows (source-binding.ts:159, then :177), and the delivery is synchronous (E:506-508). So the view's flush is skipped, and `renderData` draws everything once.
  - If the rows are unchanged (the guard at :174), no populate comes, and the flush draws.
- **Unbound sort (G:1415).** Replace `this.#render()` with `this.#flush()`: 3 renders become 1, and the result is still synchronous.
- **What must stay synchronous:**
  - `onRender`'s first render (T-restamp-does-not-abort, 509).
  - `renderData`, so that `await populate()` sees the DOM (T-populate-settles-after-render-data, 4640).
  - `setColumnFilter`, `clearColumnFilter`, `supersedeColumns`, `suspendColumnFilter` and `select()` stay as they are.
  - `drawReading` redraws its heading synchronously and only schedules the body.
  - `findStep` (G:1082) and `openColumnFilter` (G:863) read the DOM, so each calls `#flush()` first.
- **Tests that read the DOM right after `setAttribute`: none found.** Every attribute write in the grid specs is followed by a settle (`__settled` → `settled()`, which awaits `rendered` and a frame; harness.html:118). Examples: reforged-data-grid.spec.ts:362, 607, 647, 719-721, 1427, 2202, 2313, 2688; reforged-filter-conditions:544; reforged-input-find:147, 156-158; reforged-chip-tips:126-128.
- **After C2:**

  | act | heading builds | body builds | forced layouts |
  |---|---|---|---|
  | tick | 2 | 2 | 2 |
  | saved filter | 1 | 1 | 2 |
  | sort (bound or unbound) | 1 | 1 | 2 |

### C3 (b): each attribute redraws only what it needs (`onChange(name)`)
Route the hot attributes. Every other attribute falls back to `'all'`.

| attribute | work |
|---|---|
| `data-sort-field`, `data-sort-direction` | head + body |
| `data-filter-fields` | `#syncColumnFilterStatus()` synchronously (G:921-931). No schedule |
| `data-needles` | `#syncNeedles` + body |
| `data-page`, `data-page-size` | body. reforged-input-find.spec.ts:156-161 depends on a redraw after a page write |
| `data-total-pages` | nothing. It is only read (G:1086, G:1234) |
| `data-column-values` | parse + head |
| `data-locked`, `data-column-filters`, `data-filterable` | nothing |
| `data-group-field`, `data-select`, `data-selectable`, `data-bounds`, `data-apply-on` | `'all'` |

On Records' click this gains little, because `renderData` follows anyway. It helps pushes where the rows do not change, and unbound hosts. Until C5 lands, "head" for a sort is still a rebuild.

### C4 (d): read layout once, and only when a layout input moved
- **Merge into one function, `#measure()`.** Do all the writes first (the head and filter-row select cells pinned per `data-selectable`). Then do one read: the probe's `getBoundingClientRect`, the edge cells and `clientWidth`. Then do the writes: `--_pin-offset` and the `<col>` widths. This replaces G:301-302.
- **Mark the body's select cells pinned inside `#renderBody`'s row loop** (G:1004-1016). The `.select-cell` loop in `#syncPinned` (G:340-345) then goes.
- **Layout key.** It is made of: the shown fields and their widths, `[...#widths]`, `data-selectable`, the `advanced-select` state (G:293) and the `actions` state (G:270).
  - Skip `#measure` when the key is unchanged.
  - Do not store the key when the probe measures 0 (a grid first drawn while hidden).
  - The ResizeObserver (G:236-238) calls `#measure(true)`, and also observes `.head-row > .select-cell`, so a density change re-measures.
- **`#renderCols` (G:377-393) must re-stamp only when the shown columns change.** Otherwise it rewrites the base widths without the slack `#fill` shared, and the skipped `#fill` never puts the slack back.
- **TRAPs kept:** T-grid-pin-offset-is-measured (3812) and -needs-subpixel (3833): keep `getBoundingClientRect`. T-col-width-not-inline-size (196): keep `<col>.style.width`.
- **After C4:** 0 forced layouts per click while the columns stay the same.

### C5 (c): keyed heading cells, updated in place
**`#renderHead` (G:396) becomes a reconcile:**
1. Map the existing `.head-cell` elements by `data-field`.
2. For each shown column, work out a cell key: `[type, FILTERABLE, menuKey]`.
   - `menuKey` is the def without `options`, `min`, `max` and `availableDates`.
   - `range` is normalised to `def.range ?? kind === 'number'` (T-a-default-is-not-an-override, 12229).
   - `bounds` and `live` are part of it.
3. Reuse the cell when its key is unchanged (kept in a `WeakMap<HTMLElement,string>`). Otherwise `clone()` a new one and `replaceWith` the old one.
4. Call **one** function, `#drawHeadCell(th, col, i, def)`, for new and kept cells alike.
5. Remove cells whose field is no longer shown.
6. Move a cell only when it is out of order. A moved node closes an open popover.
7. Move `.actions-head` only when it is not already last (T-grid-actions-pin-to-the-trailing-edge, 8130).
8. `#renderFilterRow` rebuilds only when the shown columns change. Otherwise it syncs the input values from `#filters` in place (`renderData` clears `#filters`, G:274).

**`#addColumnFilter` (G:461-498) splits in two:**
- **`#buildColumnFilter`, on a new cell only:** `menuFor`, `data-removable`, append, upgrade (T-custom-element-upgrade, 41).
- **`#drawColumnFilter`, on every pass.** Each of these steps sets the value both ways (added or removed):
  1. Write `data-superseded`, `data-applied-at`, the menu's `data-readonly` and the `aria-label` (T-a-view-held-heading-shows-and-refuses, 17182).
  2. Call `menu.items()` only when the options key changed. This keeps the search text and focus.
  3. Write `data-min`, `data-max` and `data-available` (a same-value write costs nothing, E:521).
  4. Write `menu.reading = held` only when `!sameReading(drawn, held)`, and pass it whole (T-a-heading-menu-opens-on-what-it-holds, 17100).
  5. On release, do what the Clear path does (G:629-633): `data-value=''` and `reading = {}`.
  6. Add `data-advanced` when the reading has rows. Remove it only when `!advancedOf(def)` (T-many-conditions-are-one-reading, 10072).
  7. `#markPresent`, which is re-run when a field is released (T-a-ruled-out-value-is-greyed, 7541).

**Attributes that today are only ever added must now be removed both ways:**
- th `data-type` (G:411);
- th `data-pinned` / `data-pin-last` (G:413). The pin moves when the group field drops column one;
- th `data-status` (G:425). Use the rule from G:925-927;
- chip `data-applied-at` (G:479);
- menu `data-advanced` (G:495).

**State that survives a push:**
- the open popover, `#trigger` and `#openAc`, because the menu is never disconnected;
- the chip's `data-open` and `aria-expanded`;
- focus on `.head-btn` / `.head-sort` (fixes bugs A and B);
- the search text;
- an unapplied draft whose held reading did not change;
- the Cancel baseline;
- the grip's pointer capture (fixes bug F);
- a heading menu that a toolbar chip has borrowed (T-grid-toolbar-chip-borrows-the-menu, 8323; fixes bugs C and D).

**TRAPs kept and wording to change:**
- T-one-field-one-filter-menu (5246) and T-variant-attrs-or-one-way-door (4563): a change of `data-type` changes `menuKey`, so the menu is rebuilt and never re-stamped in place.
- T-a-heading-opens-the-chips-menu (16796).
- T-grid-untyped-column-gets-no-filter-button (8294): the type is in the cell key. Re-word 8303.
- T-grid-read-without-write-is-half-an-api: re-word 3979-3981 to "one path writes a menu, `#drawColumnFilter`, for a new cell and a kept one alike".
- T-the-column-chip-is-the-only-signal: change the table row at 12327.
- T-grid-reports-never-combines: change 3456-3457.
- Code comments to change: G:239, G:729, G:886.
- T-grid-header-needs-capture (3736) and T-grid-chip-vocabulary-stops-here (3750): unchanged. Their listeners are delegated on the stable `.head-row`.

**After C5:**

| act | heading components built | body builds | forced layouts |
|---|---|---|---|
| tick | 0 | 2 | 0 |
| saved filter | 0 | 1 | 0 |
| sort | 0 | 1 | 0 |

## 3. Tests

**New sherpa-ui spec:** `test/e2e/reforged-grid-keeps-its-heading.spec.ts`. Check with `ls` that the name is free first. It uses a bound grid, set up like reforged-data-source.spec.ts:616.

| test | proves | commit |
|---|---|---|
| T1 count per act | A `MutationObserver` on the shadow root counts `.body` records with `removedNodes` (one per `replaceChildren`) and the `.head-cell`s added. After `source.select('status',['active'])` and a settle: body ≤ 2. Heading cells added: ≤ 28 after C2, 0 after C5. The ceilings may only fall | C2, then tightened in C5 |
| T2 no new heading component | Put every `sherpa-*` under `.head-row`, walking into shadow roots, into a `WeakSet`. After a select, a sort and a page change, no new `sherpa-*` appears | C5 |
| T3 open menu survives a push | `openColumnFilter('name')`, type in its search and tick a row without Apply. Then `source.select('region',…)`. Expect the same menu node, `menu.open`, the search text and the tick all still there | C5 |
| T4 Enter on `.head-btn` / `.head-sort` | Bound and unbound: `shadowRoot.activeElement` is the same node afterwards | C5 |
| T5 Clear keeps a bound heading menu open | Clear does not shut the menu on a bound grid | C5 |
| T6 two attribute writes, one render | Unbound: write sort field and direction in one run → 1 body render. A header click → 1 | C2 |
| T7 pin and fill | `--_pin-offset` equals `.select-head`'s width after the first populate, `data-selectable` off then on, 0 → N rows, and a mount while hidden followed by show. The `<col>` widths still fill the box after a same-column populate. **No test checks `--_pin-offset` today** | C4 |

**New Demos spec:** `test/e2e/reforged-records-heading-is-kept.spec.ts`. On Records:
- mark the heading's components, then drive the bar through `setChipReading` + `report()` (public API, so no light-dismiss), then click the saved-filter chip;
- expect no new heading component and body renders ≤ 2;
- a Status heading menu that is open stays open through a bar reading.

**Existing tests to run per commit:**

| commit | specs |
|---|---|
| C1 | `reforged-grid-keeps-both-answers:21`; `reforged-view-definition:16`; `reforged-data-source:616`; `reforged-provider:44`; the number-blanks test in `reforged-data-grid` (~2729). Demos: `reforged-filter-coordination:23`, `reforged-equals-lists:33` |
| C2, C3 | All of `reforged-data-grid.spec.ts`; `reforged-input-find:134`; `reforged-chip-tips:116`; `reforged-sort-icons:23,115`; `reforged-filter-conditions:522,651`; `reforged-data-source:159`; `reforged-grid-select-all-pages`; grouped paging (`reforged-data-grid:584, 2277-2313`). The full Demos suite (`reforged-records-grid-pages`) |
| C4 | `reforged-data-grid:896, 1003, 2346, 3084`; `reforged-border-edges`. Demos: `reforged-panel-mode-does-not-shift` (CLS ≤ 0.05) |
| C5 | Every heading test in `reforged-data-grid` (24, 48, 279, 849, 1003, 1240, 1352, 1506, 1544, 1679, 1771, 1866, 1969, 2059, 2346, 2480, 2650, 2729, 2767, 2830, 2909, 2937, 2980, 3020, 3084); `reforged-advanced-condition-words:109,185`; `reforged-date-conditions`; `reforged-advanced-rows`. Demos: `reforged-filter-chips-green:10`, `reforged-view-chips:445` |

**Gates on every commit:** `npm run map:write` on the grid file, then `check:map`. `spec:check` (no public API changes, so the spec should not change). `check:weight -- --update-baseline` with a reason, because the grid's JS grows.

## 4. How to measure
- **Build** with `npm run build -- --no-minify` (scripts/build-reforged.mjs:12-13, 41). Will's :4200 Demos server reads `dist/`, so never build during a running suite.
- **The probe is found.** It exists only in this session's scratchpad: `/private/tmp/claude-502/-Users-williammincher-Documents-My-synced-vault-Projects-sherpa-ui/38359d93-1fb6-4254-bf7e-d44922d71fbe/scratchpad/cls/inp.mjs`. Run it as `node …/inp.mjs 5 toolbars`.
  - It gives the median INP per act at 4x.
  - Baseline from docs/TODO.md:796-805: tick 216 ms, second value 208, saved filter 320/328, View pick 200.
- **CPU profile:** `/private/tmp/claude-502/-Users-williammincher-Documents-My-synced-vault-Projects-sherpa-ui/38359d93-1fb6-4254-bf7e-d44922d71fbe/scratchpad/cls/profile.mjs`. Run it with `saved` or `tick`, and read `#bootstrap`, `#stamp`, `getBoundingClientRect` and `#renderHead`. Copy both scripts into Sherpa Demos (for example `scripts/perf/`) so they outlive the session.
- **Expected drop** (an estimate; to be measured):
  - `#bootstrap → #stamp`: 257/266 ms → under 60 ms (what is left is the body's select boxes);
  - `getBoundingClientRect`: 49 ms → about 0;
  - busy: about 500 ms → about 200–250 ms;
  - INP: saved filter 320 → about 150–190, tick 216 → about 120–150. The target is ≤ 200 ms at 4x.
- INP is noisy, so T1 and T2 are the deterministic gate.

## 5. Risks
1. **Timing (C2).** A host that reads the grid's DOM straight after writing an attribute now sees the old DOM until the microtask. No such read was found in the specs, and `findStep` / `openColumnFilter` flush first. The `#awaitingData` skip relies on the view being pushed before the rows. If that order changes, the cost is one extra render, never a missed one, because `finally` re-schedules.
2. **Re-entrancy changes.** `grid-pages-change` → the host writes `data-page`. Today that is a nested render inside `#renderBody` (G:1035). After C2 it is the next microtask. The paging tests cover this.
3. **Stale state in place (C5).** A missed "remove" shows as a heading that stays lit, greyed or pinned. The five attributes are listed under C5; add tests for superseded → released, sorted → unsorted, and the group field moving the pin.
4. **❓ For Will.** A heading menu is open, and another control changes the same field:
   - **A (my pick):** the new answer is written and the menu stays open. The draft is replaced, which is what happens today, minus the close.
   - **B:** the draft is kept.

   With A, the menu should re-take its Cancel baseline when `reading` is written while it is open (sherpa-menu.ts:468, `#takeBaseline` 866; T-the-baseline-is-taken-at-show, 1998). Otherwise Cancel restores a stale answer.
5. **A number or date shape flip** changes `menuKey`, so that one menu is rebuilt and closes. This happens today too, but it now affects one cell, not 14.
6. **Layout key (C4).** A hidden first draw, or a density change without a resize, could leave the pin offset stale. Mitigations: do not store the key on a 0 width, and let the ResizeObserver watch the select cell.
7. **Not touched:** `#bootstrap`'s missing `isConnected` check (E:861-889). Changing it risks a `rendered` promise that never settles (T-rendered-settles-even-when-the-markup-does-not, 12532). C5 removes the thrown-away cells, so the waste goes with them.
8. **Left for later:**
   - The body is still rebuilt: 50 select components per render, and one of the 2 body builds in a tick is wasted (`drawReading`'s body is drawn against the old rows). Keying the rows is a separate item.
   - The provider runs `filterDef` for all 14 fields on every push (sherpa-provider.ts:663-671). It could be memoised.
   - `#pageRecords` sorts once per row (G:1746-1750). It is not on the click path.
9. **A peer agent is live on the branch.** `docs/TODO.md` is staged by another session right now. Stage only your own paths, and never stash.

---

# Check against the code (a second read-only agent)

**Verdict:** C1 and C2 are sound. Three things need fixing before work starts:
- C3 regresses layout until C4 lands.
- C4 misses two callers.
- The `populate()` override changes the spec, which the design says will not change.

A peer agent is live on the branch: it committed `bf83ee5f` and `dde2589e` at 15:28 and 15:32, and has unstaged edits in `src/core/data/`. Several of the line numbers below moved because of it.

### Wrong

1. **TRAP line numbers after line 3649 are now +38.** `dde2589e` added lines to `docs/TRAPS.md` after the design was written. Current numbers:

   | TRAP | now |
   |---|---|
   | T-populate-settles-after-render-data | 4678 |
   | T-grid-pin-offset-is-measured | 3850 |
   | T-grid-pin-offset-needs-subpixel | 3871 |
   | T-grid-header-needs-capture | 3774 |
   | T-grid-chip-vocabulary-stops-here | 3788 |
   | T-grid-read-without-write-is-half-an-api | 3996 (re-word 4017-4019) |
   | T-variant-attrs-or-one-way-door | 4601 |
   | T-one-field-one-filter-menu | 5284 |
   | T-a-ruled-out-value-is-greyed | 7579 |
   | T-grid-actions-pin-to-the-trailing-edge | 8168 |
   | T-grid-untyped-column-gets-no-filter-button | 8332 (re-word 8341) |
   | T-grid-toolbar-chip-borrows-the-menu | 8361 |
   | T-many-conditions-are-one-reading | 10110 |
   | T-a-default-is-not-an-override | 12267 |
   | T-the-column-chip-is-the-only-signal | 12343 (table row 12365) |
   | T-rendered-settles-even-when-the-markup-does-not | 12570 |
   | T-a-heading-opens-the-chips-menu | 16834 |
   | T-a-heading-menu-opens-on-what-it-holds | 17138 |
   | T-a-view-held-heading-shows-and-refuses | 17220 |

   Unchanged: 41, 196, 509, 1998, 2255, 2851, and 3447 (re-word lines 3456-3457).
2. **The INP baseline is not at `docs/TODO.md:796-805`.** It is now at 821-823 (the "before" figures) and 829 (W1).
3. **Gates, "spec:check should not change": wrong.** A public `override populate()` is read as a public method:
   - `scripts/lib/ts-facts.mjs:206-209`: the LIFECYCLE list does not include `populate`.
   - `scripts/lib/ts-facts.mjs:233-237` (`isPublic`) and `:297-305` (the method list) let it through.
   - So `$extensions.sherpa.methods` gains `populate`, and the spec, the manifest and the reference all change.
   - Fix: add `populate` to LIFECYCLE (a script change), or set the flag another way.
4. **Risk 2:** G:1035 is `#syncGroupVisibility`. The nested emit is `#reportPages` at G:1038, which emits at G:1235.
5. **C4:** `toggleState('actions')` is at G:271, not G:270.
6. **C2:** T-restamp-does-not-abort (509) is about deduplicating listeners on a re-stamp. It does not say why `onRender`'s first render must stay synchronous, so that citation is wrong.
7. **Risk 9 is stale.** Nothing is staged now. The peer's unstaged changes are in `data-source.ts`, `store.ts`, `stores.ts`, `spoof-remote.ts` and a new `store-cache.ts`.
   - `data-source.ts:676-678` and `1123-1138` are right at HEAD.
   - In the working tree they are already 673 / 1120 / 1135.
8. **Minor line and scope slips:**
   - The `reforged-input-find` test starts at line 135, not 134.
   - `data-total-pages` is also read at G:1730.
   - `menuFor` starts at `filter-menu.ts:73`; line 81 is its `importNode`.
   - C1's guard should be `!given && kind === 'text' && kindOf(col) !== 'advanced'`, because the values are only used at G:515.

### Missed

1. **C3 regresses layout before C4 lands.**
   - A `'head'` flush runs `#renderCols` (G:377-393), which writes the base `<col>` widths (G:386). Nothing marks `'layout'`, so no `#fill` runs. Every unbound sort and every `data-column-values` change loses the shared slack.
   - A `'body'` flush (sort, page, needles) draws the rows' select cells without `data-pinned`. Pinning lives only in `#syncPinned` (G:340-345), and the CSS needs that attribute (`sherpa-data-grid.css:595`). The selection column would scroll away.
   - Today `#render` covers both (G:301-302).
   - Fix: have `'head'` and `'body'` also mark `'layout'` in C3, or land C4's pinning in `#renderBody` and `#renderCols`-only-on-change first.
   - No spec checks `data-pinned` or `--_pin-offset`.
2. **C4 misses two callers of the merged function.** `#onGripMove` calls `#fill` (G:1571) and `#onGripUp` calls `#syncPinned` (G:1594); both need `#measure(true)`. Also, `onRender` creates a new ResizeObserver on every re-stamp without disconnecting the old one (G:236). Observing a second target makes that worse.
3. **C5 does not say what `drawn` is.** It must be updated in `#onColumnFilterCommit` (G:619-634) and in Remove (G:591-598). Otherwise:
   - the grid draws D, and the reader applies X;
   - then `setColumnFilter` or `drawReading` sets D back;
   - `sameReading(D, D)` skips the write, so the menu shows X while the grid holds D.
4. **`#markPresent` returns early for a superseded field (G:555).** A kept chip that becomes superseded keeps `data-unavailable` and `menu.present`. The chip's `#tipText` checks `data-unavailable` first (`sherpa-quick-filter.ts:700`), so the tip would say "ruled out", not "moved to View". Add both to the "remove both ways" list.
5. **The filter row is synced in place, but `data-has-value` is only ever added (G:956).** It must be cleared, and the input emptied, when `renderData` clears `#filters` (G:274).
   - Test 552 changes the columns, so it never takes the in-place path.
   - Add `reforged-data-grid` 215, 406, 484, 552 and 3051 to the C5 runs.
6. **Risk 4 (A) needs a `sherpa-menu.ts` change**: re-take the baseline when `reading` is set while the menu is open (`set reading` :468, `#takeBaseline` :866).
   - Without it, closing the menu restores the old baseline (`sherpa-menu.ts:1722-1735`, T-a-draft-dies-with-its-menu at 14970). That breaks T-a-heading-menu-opens-on-what-it-holds.
   - No commit owns this change, and the `sherpa-menu.ts` map and spec gates are not listed.
7. **Re-entrancy in C5 on a bound grid.** A heading Apply runs this chain synchronously, inside the menu's own `menu-apply` dispatch:
   - `#onColumnFilterCommit` emits (G:649);
   - bind-source calls `source.answerColumn` (`bind-source.ts:257-265`);
   - the source runs `select` → `#draw` → `grid.drawReading`;
   - C5 then writes `menu.reading` into that same menu.

   Today that menu is removed instead, so this path is new and untested. Updating `drawn` before the emit avoids the write.
8. **T1's setup misses `drawReading`.** `reforged-data-source.spec.ts:616` binds with no scope (`bindSource(source, grid, { as })`).
   - `SourceBinding.drawReading` reaches only an element whose scope is the field's home (`source-binding.ts:191-196`).
   - `homeOf` defaults to VIEW (`query-edits.ts:114-116`).
   - So that setup never runs the "+1 per answered field" path. Bind with `scope: 'view'`.
9. **T2 caveat.** A reading with condition rows (`#setRows`, `sherpa-menu.ts:798-812`) or an `items()` call (`#stampItems`, :1361) makes new components inside a kept menu. Keep T2 to plain picks, sort and page.
10. **Two existing tests lose their purpose.** `reforged-data-grid.spec.ts:1425` ("A SORT rebuilds the whole header row") and 2692 ("A RE-POPULATE rebuilds the head row") still pass, but no longer cover `#buildColumnFilter` restoring state. Point one at a new cell, for example by changing the type or the def.
11. **Stale comments.** The two test comments above, plus G:376, G:404 and G:939, also become false.
12. **`data-available` cannot be removed this way.** The menu copies it to the calendar only when it is not empty (`sherpa-menu.ts:1520`). A removal never reaches the calendar of a kept menu.
13. **Small timing points:**
    - The config setter path (`#reconfigure`, E:432-441, as in `reforged-provider.spec.ts:33`) calls `renderData` without `populate`, so there is no `#awaitingData` and one extra render. Harmless.
    - `#flush` must keep the `#columns.length` guard (G:257).
    - A partial flush must clear its flags before running, so a re-entrant `grid-pages-change` write re-schedules.
14. **Practical notes:**
    - `inp.mjs` imports Playwright by an absolute path into sherpa-ui's `node_modules` (line 2), so that path must change when it is copied into Demos. Demos has no `scripts/` folder yet.
    - The grid newly pulls `query.ts` and `timing.ts` into its import graph. Name them in the `check:weight` reason.

### Confirmed (≈48)

- **Grid (`G`):** 818-830, 254-258, 280, 286-303, 311-326, 338-353, 405, 461-498 (including the order: append, then upgrade), 509/515, 555, 629-633, 863, 921-931, 934-961, 1004-1016, 1082, 1413-1415, 1746-1750.
  - The add-only attributes at 411, 413, 425, 479 and 495.
  - The comments at 239, 729 and 886.
  - Listeners delegated on `.head-row` (228, 240-247).
  - The C3 table covers all 16 props (G:122-144).
- **Sherpa element (`E`):** 506-508 (delivery is synchronous), 521, 731-734, 861-889 (no `isConnected` check).
- **Data layer:**
  - `bind-source.ts:106-115` writes 8 attributes.
  - `source-binding.ts`: view at :159, guard at :174, rows at :177.
  - `data-source.ts:676-678` and `1123-1138` at HEAD.
  - `query.ts:194` (`sameReading`, fixed key order).
  - `timing.ts:16-26`.
  - `sherpa-provider.ts:663-671`.
  - `filterDef` is static per field (`field-catalogue.ts:104-116`), so `menuKey` stays stable across pushes.
- **Menu:** `sherpa-menu.ts:468` and `:866`; it reacts to `data-readonly` (:138, 1067-1069, 1593). The chip reacts to superseded and applied-at (`sherpa-quick-filter.ts:202`).
- **Counts:** 2 chips with 1 tooltip each per cell; 2 select boxes per row; the filter row is hidden by CSS (`sherpa-data-grid.css:159-160`). Records has 14 columns, all filterable. The grid and the toolbar share `data-scope="data"`, so the bar's answers reach `drawReading`.
- **Tests:**
  - Every cited spec line checks out.
  - Scanning all grid specs found no DOM read right after an attribute write without a settle.
  - No spec checks `--_pin-offset`.
  - `harness.html:118` is right.
  - Both new spec names are free.
  - The Demos tests exist at the cited lines; `reforged-panel-mode-does-not-shift.spec.ts:40` is the 0.05 check.
  - `setChipReading` (toolbar :476) and `report` (:1219) are public.
- **Docs and measurement:** TODO's 257/266 ms and 493/546 ms busy; `build-reforged.mjs:12-13, 41`; both probe scripts exist in the scratchpad; TRAP lines 41, 196, 509, 1998, 2255, 2851 and 3447 are unchanged.