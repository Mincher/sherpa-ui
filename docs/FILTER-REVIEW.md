# The filter family — a review

**Written for Will**, 2026-09-25. Everything here is measured, not estimated;
every command used is given so you can re-run it.

---

## 1. The short version

Four components draw filters: `sherpa-quick-filter` (the chip), its toolbar,
`sherpa-filter-panel`, and `sherpa-menu`. Together they are **4,561 lines of
TypeScript**. The data layer under them is correct — I tested it directly and
it answers every question right. **Every filter bug in the last two days came
from two components working out the same answer separately and disagreeing.**

There is a second problem, and it is mine: over this session I added **4,351
lines and deleted 1,095** — a ratio of **4:1**. I have been writing new code
beside the old instead of replacing it. That is a large part of why the surface
keeps growing and why fixes keep reopening old bugs.

---

## 2. What a filter IS

Your taxonomy, 2026-09-25:

> Group is a thing. Sort is a thing. Boolean filters are a thing. Single select
> value filters are a thing. Multi select value filters are a thing. Compound
> Conditional filters are a thing. **Organise is not.** It's just a label on the
> screen.

Six kinds. A heading, a section, a zone, a bar or a panel is **presentation**
and must never name a kind.

**Where the code stands against that model:**

| kind | how it is spelled today | honest? |
|---|---|---|
| group | `data-kind="group"` | ✅ |
| sort | `data-kind="sort"` | ✅ |
| boolean | *no options, and no `kind`* | ❌ inferred |
| single select | `select: 'single'` | ❌ a different axis |
| multi select | `select: 'multiple'` | ❌ a different axis |
| compound conditional | `conditions: true \| 'only'` | ❌ a third axis |

Four of the six kinds are **inferred** from a combination of three unrelated
properties. That is why `#addMenu` is 141 lines: it is a decision tree
rebuilding the kind from its symptoms every time it runs.

---

## 3. The numbers

```
node scripts/…/methods.mjs src/components/<name>/<name>.ts
```

| file | lines | methods | lines in methods |
|---|---:|---:|---:|
| `sherpa-quick-filter-toolbar.ts` | **1,857** | 77 | 1,367 |
| `sherpa-menu.ts` | 1,103 | — | — |
| `sherpa-filter-panel.ts` | **898** | 44 | 638 |
| `sherpa-quick-filter.ts` | 703 | — | — |

The five largest methods in the two containers:

| lines | method | what it does |
|---:|---|---|
| 141 | `toolbar #addMenu` | build a field's menu — every kind, every op |
| 109 | `panel #draw` | build every scope |
| 106 | `panel #drawField` | build one field's row |
| 86 | `toolbar #render` | build every chip |
| 54 | `panel #flipCondition` | switch one field into condition mode |

`#addMenu` + `#render` (227 lines) and `#drawField` + `#drawChip` + `#draw`
(251 lines) are **the same job twice**: turn a filter definition into controls.

---

## 4. The intertwining of Group and Sort

You asked about this directly. Sort state is read or written at **61 sites**:

```
grep -rnE "sortField|sortDirection|data-sort-|setSort|resumeSort|clearSort|nextSort|'sort'" …
```

| file | sites |
|---|---:|
| `sherpa-quick-filter-toolbar.ts` | 15 |
| `sherpa-data-grid.ts` | 13 |
| `sherpa-filter-panel.ts` | 9 |
| `data-source.ts` | 8 |
| `sherpa-quick-filter.ts` | 7 |
| `records.js` | 5 |
| `cycle.ts` | 4 |

**One value, seven owners.** And the value is spread over four separate
attributes that must agree: `data-sort-field`, `data-sort-direction`,
`data-current` on the chip, and `data-direction` on the chip. Group has three.

The asymmetries this has already produced:

- `#syncSortLabel` kept the column when the chip went off; `#syncGroupLabel`,
  four methods away, blanked it. Group forgot what Sort remembered.
- `data-direction` is written `'asc'` unconditionally in three places
  (`#renderOrganise`, `#syncSortFromAttrs`, the chip's own cycle), so "which
  way" and "is it running" are carried by different attributes that no single
  function owns.
- Group and Sort share one `.field-values` container in the panel and are both
  `select: 'single'`, so the "untick the siblings" sweep cleared the other one.

**I could not reproduce** the case you hit (group by Customer, refresh, Sort
comes back on Last Seen). Stored state after grouping reads
`{"sort":[],"group":"customer"}` and sort stays off through a reload, in
toolbar and panel mode. That does not mean it is not real — it means the
trigger is a state I have not found, and with seven owners that is unsurprising.
**Collapsing the owners is more likely to fix it than another hunt.**

---

## 5. Why the bugs keep coming back

Every filter bug reported over two days, against its structural cause:

| symptom | cause |
|---|---|
| amber Sort chip | `data-current` written from 26 places; the chip judged itself from a menu it does not own |
| Group off cleared its column | two hosts painted the chip and disagreed |
| Sort off also killed Group | a container swept a run holding two different controls |
| menus dead after leaving the panel | the borrower did not give them back on close |
| conditional chip opened a blank card | the overflow drill moves ROWS; conditions are not rows |
| Add could not remove | the bar's menu listed what was LEFT, not the whole list |
| Email search "did nothing" | a find-in-list box where a filter was expected |

**Not one was in the data layer.** I verified that directly:

```
one row  (eq Dana)      total=25   ["owner","eq","Dana Whitlock"]
two rows OR             total=50   ["or",[eq Dana],[eq Ravi]]
two rows AND            total= 0   ["and",[eq Dana],[eq Ravi]]
three rows OR           total=75   ["or",…,…,…]
```

The query builder is right. Grouping, sorting and filtering are genuinely
centralised, transforms never touch the raw rows, and there is one `stateClause`.
**The whole problem is above it.**

---

## 6. My own failure mode

You said I write new code rather than improving what is there. Measured over
this session, across the four components and the data layer:

```
git log --numstat --since="2 days ago" -- <the filter components>
+4,351  −1,095   ratio 4.0 : 1
```

| file | start | now | net |
|---|---:|---:|---:|
| `sherpa-filter-panel.ts` | 0 | 898 | **+898** |
| `sherpa-quick-filter.ts` | 522 | 703 | +181 |
| `sherpa-quick-filter-toolbar.ts` | 1,748 | 1,857 | +109 |
| `sherpa-menu.ts` | 1,025 | 1,103 | +78 |

Even the commit *called* a refactor was **+264 −207**. When I moved Group and
Sort into the chip I wrote three new methods (`#arrange`, `#arrangeFromMenu`,
`#drawArrangement`) rather than moving `#cycleSort` and `#toggleGroup` across.
The behaviour ended up in one place, which was the point — but the library grew
where it should have shrunk, and the new code had to re-earn the lessons the
old code already carried.

**The rule for the rest of this work: a step that does not delete more than it
adds is not finished.** Every step below states what it deletes.

---

## 7. The plan

Ordered smallest-risk first. Each step is one commit, full suite between.

### Step 1 — `[x]` The chip owns its KIND (done)

Group and Sort own their gesture, draw themselves, report by name. Containers
place them; the panel annotates with `scope`.
**Deleted:** `#toggleGroup`, `#cycleSort`, `#syncSortLabel`, `#syncGroupLabel`
(toolbar); `#organiseClick`, `#organiseField`, `#sortField`, `#sortLive`
(panel). −129 lines from the containers.

### Step 2 — Name all six kinds, and delete the inference

`data-kind` gains `boolean`, `single`, `multi`, `conditional`. The definition
says what a filter IS; `select` and `conditions` stop being read as a
three-axis code.

**Deletes:** the decision tree inside `#addMenu` (≈60 of its 141 lines), the
`hasOwnContent` guess, and the `conditions ? 'only' : true` branch that had to
be widened twice this week.
**Risk:** low — it is a rename plus a lookup table.
**Closes:** the class where a kind is inferred differently in two places.

### Step 3 — The DATA LAYER coordinates; no component knows another exists

*Revised 2026-09-25 after Will's ruling. The earlier version of this step had
the panel ASK the bar — which keeps them coupled and was the wrong answer.*

> Will: "The Panel and Bar should not be aware of each other. This is core to
> sherpa component agnosticism. The data layer is the coordinator. If we need
> to co-ordinate state then perhaps we need to have a state component in the
> data layer that every component in the UI registers with (name, id) and
> gets/sets state from. It would only be the current state that is tracked."

#### How bad the coupling is today

Measured. The panel does not merely read the bar — it searches the page for
one, reaches into its shadow root, calls its methods and **takes its child
elements**:

| site | what it does |
|---|---|
| `#barOf` | `document.querySelectorAll('sherpa-quick-filter-toolbar')` |
| `#chipOf` | `bar.shadowRoot.querySelector('.chip[data-id=…]')` |
| `#bars` → `bar.report()` | calls a method on the other component |
| `#barOf` → `bar.heldIds` | reads the other component's state |
| `#borrow` / `#giveBack` | MOVES the bar's `<sherpa-menu>` into itself, and back |

And **neither component binds to a `DataSource` at all.** The app wires both by
hand today, and the panel closes the gaps by reaching sideways.

#### Two ways to do what Will described

**A — the `DataSource` IS the registry. (Recommended.)**

It already does every part of the description:

| Will's words | what exists |
|---|---|
| components register (name, id) | `source.bind(el, { as, scope, ignore })` |
| gets state | `selection(field)` → the whole `FilterState`; `state`; `rows` |
| sets state | `select`, `apply`, `contribute`, `setSort`, `setGroup` |
| broadcasts | `#push(el)` per bound element, `selection-change` |
| current state only | true today — nothing is historical |

One thing is genuinely missing, and it is the thing the panel reaches for:
**which filters a scope is currently HOLDING.** That is UI state, not data.
Add one slot — `source.held(scope)` / `source.hold(scope, ids)` — and both
components read and write it without either knowing the other exists.

**B — a separate `StateRegistry` in the data layer**, as sketched: components
register by (name, id) and get/set through it.

Cleaner as a concept, but `bind()` already IS registration. Two registries
means every component joins both, and every value has to be reasoned about
twice — the exact failure this whole review is about. **A gets the same result
with no second door.**

`SherpaElement` could carry the registration so a component opts in with one
line rather than the host wiring it. Worth doing — but as its own step, after
the bloat review Will wants of `sherpa-element.ts` itself.

#### The part that matters most: STOP BORROWING MENUS

Both components draw their own menu from the same definitions the app already
gives them both.

Borrowing exists for `T-one-field-one-filter-menu`: one field, one menu, so two
controls cannot disagree. **Move the truth into the data layer and that reason
disappears** — two menus over one field are fine when neither of them is where
the answer lives.

This is also where the bugs are. Twice this week: menus dead after leaving the
panel (`close()` never gave them back), and a borrowed menu breaking every
listener bound on its old host.

#### What changes

1. The panel takes a `DataSource` the same way every other component does.
2. `#picked`, `#clearField`, `#markConditioned`, `#flipCondition` and
   `#syncAnswered` read `selection(field)` and write `select`/`apply`.
3. `held(scope)` / `hold(scope, ids)` replaces `heldIds`, for the Add menus.
4. The panel builds its own menus; `#borrow` and `#giveBack` go.
5. `bar.report()` goes — the source publishes, it is not nudged.

#### What it deletes

| gone | lines |
|---|---:|
| `#barOf`, `#bars`, `#chipOf` | ~25 |
| `#borrow`, `#giveBack`, `menuHome`, `release`, `#missingMenus` | ~60 |
| `#picked`, `#clearField`, `#markConditioned`, `#syncAnswered` | ~30 |
| `#flipCondition` | ~54 |
| **total** | **≈170** |

Plus `held()` and the binding, ≈40 new. **Net ≈ −130.**

**Risk:** medium-high. The panel's Apply / Discard baseline is built on
`#picked`, and its inline menu bodies are the borrowed ones.
**Closes:** five of the seven bug classes in §5, and both borrowing bugs.

#### Decided — Will, 2026-09-25

> 1. Scoping of filters should live in the data layer.
> 2. [Registration is] automatic.

##### First: "scope" already means three things

The same disease as `kind`. `DataSource` uses the word twice, for unrelated
axes, and the app uses it a third way:

| where | values | what it actually means |
|---|---|---|
| `ApplyAt.scope` | `view` \| `component` | how a filter REACHES: narrow for everyone, or contribute a named part ANDed under the view |
| `BindOptions.scope` | `page` \| `all` | which ROWS a bound element is pushed — the drawn page, or every match |
| `records.js` | `view` \| `data` | WHICH SURFACE a filter lives on — the header bar, the grid's bar, a panel section |

Only the third is what Will's ruling is about, and it is the one with no home.
Naming them apart is part of this step, or the collision will be re-learned:

- `reach` — `view` \| `component`. The query rule. (renamed from `ApplyAt.scope`)
- `rows` — `page` \| `all`. What a bound element is given. (renamed from
  `BindOptions.scope`)
- `scope` — a NAMED place a filter lives. Free-form, the app's own words.

##### The scope registry

`DataSource` gains one small map, holding **current state only**:

```
scope(name)                 → the fields that scope is holding, in order
hold(name, fields)          → set it
holds(name, field)          → is this field held here?
scopeOf(field)              → which scope holds it, or null
```

That answers, without any component knowing another exists:

- the Add menu's whole list — *held here, ticked; offered, not*
- superseding — a field held by `view` is not the `data` bar's to narrow
- which fields the panel draws in which section
- what a saved view restores

A `scope-change` event joins `selection-change`, so a bar that gains or loses a
filter redraws from the source rather than from a sibling.

##### Automatic registration

A component must not name its source — that is the coupling again. The web
component idiom is a **provider request**: on connect the element dispatches a
composed event, and the nearest `DataSource` in the tree answers it.

```
SherpaElement.onConnect  →  emit('sherpa-source-request', { accept })
DataSource               →  listens on its host region, calls accept(this)
```

The element learns its source without naming one; the source learns the element
without knowing its tag. `bind()` stays for a host that wants to be explicit —
the same element, wired two ways, is a second door, so the request path calls
`bind()` internally rather than duplicating it.

`SherpaElement` is already flagged for its own bloat review. This is ~20 lines
and belongs with that work, not before it.

##### The component DECLARES; the data layer COMPOSES

Will, 2026-09-25:

> Any component template can come in with a variety of attributes set that will
> require data composition from the data layer. So this should probably just be
> the mechanism for all UI components. **1 system, 1 implementation.**

Today the app hands `bind()` a closure — `as` — that builds each component's
shape by hand. Measured in `examples/contexts/records.js`:

| | |
|---|---|
| components fed by an `as` closure | **9** |
| lines of composition around them | **~569** |
| data-layer helpers called by hand | `reduceRows` ×5, `countBy` ×5, `deltaPercent` ×3, `seriesBy` ×2, `aggregate` ×1 |

A tile is built like this, in the app:

```js
summary('#m-spend', (rows) =>
  tile('Total spend', money(reduceRows(rows, 'sum', 'spend')),
       overMonths(rows, 'sum', 'spend')));
```

Every one of those helpers is already IN the data layer. The app is reaching in
and doing the layer's job, per component, by hand — and a self-registering
element has nobody to write the closure for it.

**The component says what it needs, in its own attributes**, which is what a
template already carries:

```html
<sherpa-metric data-label="Total spend" data-field="spend"
               data-aggregate="sum" data-series-by="created"
               data-series-step="month"></sherpa-metric>
```

The source reads that and composes `{ label, value, values, deltaPercent }`
itself. No closure, and the same declaration works wherever the template is
dropped.

The shapes are a small closed set, not a language:

| what a component needs | who needs it |
|---|---|
| ROWS | grid, list, transfer list |
| ROWS + its own config | grid (columns, key, actions) |
| an AGGREGATE of one field | metric, progress bar, gauge |
| a SERIES over a field | metric sparkline, line and bar charts |
| the VALUES of a field, with counts | menu, quick filter, chart legend |
| the VIEW STATE only | pagination |

**Configuration is not data.** `columns`, `key` and `actions` travel through
`as` today only because `as` was the one door. They belong on the component,
set once by the app; then `as` has nothing left to carry and goes.

**Deletes:** the `as` and `into` options, `mergeInto`, and the ~569 lines of
per-component composition in the example — replaced by attributes on the
templates and one composer in the source.

**This is a bigger step than the rest of §7** and touches every data-bound
component, not just the filters. It should be its own item once step 3 lands.

### Step 4 — ONE field-row builder

`#drawField` / `#drawChip` / `#drawSection` and `#render` / `#addMenu` differ
by exactly two things: layout **direction**, and whether a field's values
**explode into a run** or stay behind a menu. Two flags, one builder, shared in
`core/ui/`.

**Deletes:** ≈250 lines — the larger half of both containers' drawing code.
**Risk:** high; land 2 and 3 first.
**Closes:** the class where the two containers drift apart visually and
behaviourally.

### Step 5 — Collapse the sort/group state

One owner, one shape. `data-sort-field` + `data-sort-direction` +
`data-current` + `data-direction` become the chip's own state, read back
through a getter, with the source as the only other owner.

**Deletes:** the three unconditional `'asc'` writes, `#syncSortFromAttrs` /
`#syncGroupFromAttrs` (47 lines), and the panel's seeding.
**Closes:** the intertwining in §4 — including, most likely, the bug I could
not reproduce.

### Step 6 — Split `filter-state.ts`

547 lines doing three jobs: the state model and query building; how a filter
reads in words and badges; `bindSelection`. Tidiness, no behaviour change.

---

## 8. Rules for the work

1. **Every step either deletes more than it adds, or names the deletion it buys
   and which step collects it.** State it in the commit message either way.
   (Step 2 is the first: it is net +73, and it buys ~250 lines in step 4,
   because two components cannot share a builder until they agree what a filter
   IS. Writing the rule as an absolute was wrong.)
2. **Move code, do not rewrite it.** The old code carries lessons — comments,
   TRAP citations, guards — that new code has to re-learn through bugs.
3. **Pin the invariant before moving it.** Off-keeps-the-value regressed
   because nothing tested it across kinds. It does now.
4. **Measure on the running page, and read the TOTAL.** A page size of 25 makes
   a working filter look broken; that cost an hour and a false bug report.
5. **One step per commit, full suite between.** Two steps in one commit means a
   failure cannot be bisected.
