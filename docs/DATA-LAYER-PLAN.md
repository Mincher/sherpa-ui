# The Data Layer — plan

Branch `sherpa-data-layer`. **Part 1 is DONE** except the low-priority `delegate()`; Part 2 onward is plan.

Three jobs:

1. **Consolidate `SherpaElement`** — absorb the plumbing 31 components copy by hand.
2. **Add a data layer** — one place that owns filter / sort / group / page, so the
   grid, the toolbar and the app cannot disagree about them, and so MANY components
   can bind to ONE source: a sort set in a toolbar moves the grid's column header, a
   filter set in an app header re-populates every chart on a dashboard.
3. **Add validation** — one rule set for all five data sources, translated to the
   platform's own validity mechanism at the edge.

Part 1 comes first because Part 2 feeds components through the door Part 1 cleans.
Part 3 interleaves with Part 2 rather than following it — see the order of work.

---

## Why this is needed — the evidence

### The same sort is written three times

| Where | What it holds |
|---|---|
| [`sherpa-data-grid.ts:417`](../src/components/sherpa-data-grid/sherpa-data-grid.ts#L417) | `#sortRows()` — its own compare |
| [`records.js:135`](../examples/views/records.js#L135) | `compare()` — a second copy, with `{ numeric: true }` |
| [`sherpa-quick-filter-toolbar.ts:914`](../src/components/sherpa-quick-filter-toolbar/sherpa-quick-filter-toolbar.ts#L914) | `sortField` / `sortDirection` — a third *state* |

The two compares are **not identical**: the grid's ignores `{ numeric: true }`, so
`"item 2"` and `"item 10"` order differently depending on which control you used.

[`HANDOVER-BACKLOG.md`](HANDOVER-BACKLOG.md) already records the symptom:

> The Sort chip is NOT linked to the grid's column-header sort … two separate
> pieces of state, so they can disagree.

They disagree because there are three of them. A data layer makes them one.

### The precedent is already accepted

[`format-tick.ts:9`](../src/core/format-tick.ts#L9) is a shared `src/core/` helper, and
its own comment gives the reason:

> Shared by every chart that draws an axis, so the barchart and the line chart
> cannot format the same number two different ways.

That is this plan's argument, already ratified once, for one small function.

### The spec files already know the answer

Every generated `.component.yaml` classifies each prop by `kind:`:

| `kind` | Count | Meaning | Needs |
|---|---|---|---|
| `content` | 146 | JS writes text into the shadow DOM | **behaviour** in the base class |
| `style` | 123 | CSS selects on it; JS never reads it | **declaration** only |
| `visibility` | 11 | presence toggles a CSS rule | declaration only |

The YAML knows each attribute's `type` (`enum`/`boolean`/`string`/`number`) and its
`kind`. The TypeScript does not — so it re-derives both by hand, 51 times.
**The contract exists; the code just does not consume it.**

---

# Part 1 — consolidate `SherpaElement`

`src/core/sherpa-element.ts` is 277 lines and does four things well. It provides no
helper for attribute coercion, template cloning, text syncing or delegation — and
that is exactly where every copy-paste bug lives.

A full sweep of all 57 component files found **six** patterns worth absorbing.
Each one is a bug fix, not tidying.

## 1.1 Declarative attributes — `static props`

**This is the centrepiece.** One block replaces `static observed`, ~30 `#syncX`
methods, every `onChange` if-chain, and every boolean getter/setter pair.

```ts
static props = {
  // kind: content — the base class writes it into the shadow DOM
  'data-label':       { type: 'string',  kind: 'content', to: '.label' },
  'data-icon':        { type: 'string',  kind: 'content', to: '.icon', as: 'icon' },
  'data-count':       { type: 'number',  kind: 'content', to: '.count', default: 0 },

  // kind: style — CSS owns it. Declared so JS has a typed door, and nothing else.
  'data-status':      { type: 'enum', kind: 'style', values: ['info','success','warning','critical','urgent'] },
  'data-size':        { type: 'enum', kind: 'style', values: ['sm','md','lg'] },
  'data-orientation': { type: 'enum', kind: 'style', values: ['horizontal','vertical'] },
};
```

### Why declare the CSS-only ones

A `kind: style` attribute generates **no** DOM writes. Declaring it buys three things:

1. **A write path.** `this.set('data-len', n)` — JS telling CSS about a data change.
   [`sherpa-sparkline.ts:77`](../src/components/sherpa-sparkline/sherpa-sparkline.ts#L77)
   already invents this by hand (`this.dataset['len'] = String(count)`). One component
   found the pattern; the declaration makes it first-class.
2. **Types.** `data-size` and `data-orientation` are observed by **zero** components
   today — CSS reads them alone, so nothing validates a typo.
3. **A hook for later.** The data layer will want to read `data-status` to drive a
   record's state, with no CSS change at all.

**Cost is near zero.** [`sherpa-element.ts:144`](../src/core/sherpa-element.ts#L144)
already drops no-op writes before `onChange` runs.

### The rule this must not break

`kind: style` stays **CSS-only**. Declaring `data-status` must not tempt anyone to
add a JS status branch — 26 components handle it correctly in pure CSS via the status
cascade today, and that stays. The declaration is a door, not an instruction.

### Evidence

51 sync sites across 31 components, and the copies already differ:

```ts
// sherpa-section-header.ts:24   ← identical
#syncTitle(): void { const el = this.$('.title'); if (el) el.textContent = this.dataset['heading'] ?? ''; }
// sherpa-empty-state.ts:28      ← identical
#syncTitle(): void { const el = this.$('.title'); if (el) el.textContent = this.dataset['heading'] ?? ''; }
```

Five different guard policies exist across the copies:

| Component | Guard | Note |
|---|---|---|
| `container-header.ts:83` | `if (el && !el.querySelector('[slot]'))` | slot-aware; nobody else |
| `nav-item.ts:108` | skips when `mark.match` present | protects search highlight |
| `gauge-chart.ts:108` | falls back to `String(raw)` not `''` | different default |
| `list-item.ts:75` | uses `$$` not `$` | writes **all** matches |
| 4 components | `dataset.heading` (dot) vs `['heading']` | copy-paste drift |

The base class keeps each real behaviour as an option (`to`, `all: true`,
`skipWhen`). The accidental differences go.

## 1.2 `num()` — number from an attribute

**Do this first. Smallest change, most bugs fixed.**

Eleven components parse numbers **five** mutually inconsistent ways:

```ts
// line-chart.ts:94   — Number('') is 0, NOT NaN
const explicitMin = Number(this.dataset['min']);
// pagination.ts:51   — `|| 1` folds "0", "" and garbage together
return Math.max(1, parseInt(this.dataset['totalPages'] ?? '', 10) || 1);
// slider.ts:97       — correct
const n = parseFloat(this.getAttribute('min') ?? ''); return Number.isFinite(n) ? n : 0;
```

**Live bug.** `Number('')` is `0`, not `NaN`. Templating engines emit empty
attributes freely, so today:

- `data-min=""` on a line chart **pins the y-floor to 0** ([`line-chart.ts:94`](../src/components/sherpa-line-chart/sherpa-line-chart.ts#L94))
- `data-ticks=""` **silently means "no axis"**
- `data-max=""` on a gauge returns `0`, not `100` ([`gauge-chart.ts:95`](../src/components/sherpa-gauge-chart/sherpa-gauge-chart.ts#L95))

All four are **proven, not inferred** — run in Node against the real expressions:

```
gauge  data-max="" → 0     (expected 100)   ← `?? 100` only catches undefined
line   data-min="" → 0     isFinite: true   ← reads as an explicit floor of 0
pager  parseInt("0")||1 → 1 (expected 0)
Number(null) → 0                            ← would splice row 0
```

```ts
protected num(attr: string, fallback: number, opts?: { min?; max?; int? }): number
```

One empty-string-aware parse, one clamp. Fixes all four at once.

## 1.3 `clone()` — template prototypes

39 sites across 19 components, with **three** null policies:

```ts
if (!list || !tpl) return;                                        // A: guarded (most)
const tpl = this.$<HTMLTemplateElement>('template.group-row-tpl')!; // B: asserted — throws on rename
if (removeTpl) menu.appendChild(removeTpl.content.firstElementChild!...); // C: half-guarded
```

Every site then asserts `content.firstElementChild!` regardless — a template starting
with a comment or whitespace silently yields `null!` and crashes on next access.
[`sherpa-calendar.ts:175`](../src/components/sherpa-calendar/sherpa-calendar.ts#L175)
also omits the `template` qualifier, unlike the other 38.

```ts
protected clone<T extends Element = HTMLElement>(sel: string): T | null
```

## 1.4 `icon()` — Font Awesome

Six components, **three** incompatible strategies:

| Component | Strategy |
|---|---|
| `button.ts:74` | classes on the element, then `textContent = ''` |
| `input-text.ts:99` | classes on the element, then `removeAttribute('data-glyph')` |
| `nav-item.ts:242` | builds a child `<i>` with **`createElement`** |

**Two problems.**

*A bug already shipped from this.* [`input-text.ts:92`](../src/components/sherpa-input-text/sherpa-input-text.ts#L92)
records it in a comment:

> handed a class list it printed the class list as text, which is exactly what a
> menu's search field showed

One component learned. The other two never heard.

*It breaks a house rule.* Four components hand-build `<i class="fa-…" aria-hidden>`
with `createElement` — which [`CLAUDE.md`](../CLAUDE.md) lists under **"❌ Never"**.
(The `createElementNS` calls in `line-chart` are SVG and are legitimate — an SVG node
cannot be cloned from an HTML template.)

*And four components have no FA branch at all.* `sherpa-chip`, `sherpa-tag`,
`sherpa-list-item` and `sherpa-container-header` write `data-icon` as plain text —
pass one an FA class and it prints `fa-solid fa-tag` literally. One shared `icon()`
gives all four working icons for free.

## 1.5 `delegate()` — row clicks

**Re-scoped after a closer look. The bug half is already fixed; what remains is
smaller and more delicate than first written.**

### The index bug — DONE

The original finding was that three components parsed a row index three ways, and
`Number(null)` is `0`, so a row that had lost its `data-index` would act on **row 0**.
That is fixed: `coerceNum(raw, -1)` with a range check, in step 1 (`5a34c3a6`).
A `delegate()` helper is no longer needed for it.

### What is actually left: TWO populations, not one pattern

A re-count found the sites split cleanly, and they are **not interchangeable**:

| | Sites | Listener is on | Finds the row with | Why |
|---|---|---|---|---|
| **A** | 11 | a shadow element (`.bars`, `.head-row`) | `event.target.closest()` | native event, same tree — `closest()` is correct |
| **B** | 8 | the **host** | `event.composedPath()` | a *composed* event from a child component — `event.target` is **retargeted to the host**, so `closest()` finds nothing |

Only `sherpa-tabs` uses both, for two different listeners.

Population B is not a gap to close — it is already right, and each site carries a
comment saying why, e.g. [`sherpa-list.ts:102`](../src/components/sherpa-list/sherpa-list.ts#L102):

> item-click is composed: crossing into this list's shadow tree retargets
> event.target to the list host, so find the real item via composedPath().

### So the helper must choose, not impose

A single `delegate()` that always used `closest()` would break all 8 of population B.
One that always used `composedPath()` would work but is slower and less direct for
the 11 in A. The helper has to pick the right lookup for the listener it is attached
to — which is knowable: a listener on `this` needs `composedPath`, one on a shadow
element does not.

```ts
protected delegate(
  hostSel: string | null,          // null = listen on the host → composedPath
  rowSel: string,
  type: string,
  handler: (row: HTMLElement, index: number, ev: Event) => void,
): void
```

### Verdict: LOW priority, and possibly not worth it

The data-grid alone has six delegation sites and each has its own early returns
(`.select-cell` and `.group-select` bail out before the row lookup, a group row is
handled differently from a data row). Those are genuine behaviour, not boilerplate,
and a helper that had to express all of them would be longer than what it replaced.

**Recommend: do this only if a third population appears, or skip it.** The bug it was
queued for is gone; what is left is a modest tidy with real risk of flattening a
correct distinction. `renderList()` (1.6) is the better use of the same effort.

## 1.6 `renderList()` — rebuild a list

**Re-measured. This is now the best remaining item in Part 1 — take it before
`delegate()`.**

12 components clear a container and stamp a cloned row per item. The shared part is
exactly four steps:

```
look up container + template → guard both → clear → clone per item → append
```

Everything else is unique per component and belongs in a callback anyway: tabs wires a
roving tabindex, breadcrumbs marks the last crumb `aria-current`, the grid sets a
per-column type.

### What it is worth

Measured against the real `sherpa-tabs` body: **9 boilerplate lines become 3**, so
~6 per site and **~96 lines across 12 components**. More importantly it removes the
**last 12 `content.firstElementChild!` assertions** — `clone()` (1.3) fixed the four
standalone ones, and these are the rest.

```ts
protected renderList<T>(
  containerSel: string,
  tplSel: string,
  items: readonly T[],
  fill: (node: HTMLElement, item: T, i: number) => void,
  opts?: { clear?: 'replace' | 'own-children'; ownSel?: string },
): void
```

### Three behaviours that must survive as options, not be flattened

- **`sherpa-list` must NOT use `replaceChildren()`.**
  [`sherpa-list.ts:72`](../src/components/sherpa-list/sherpa-list.ts#L72) removes only
  `.body > .row-item` — a blanket clear would destroy the `<slot>` beside the stamped
  rows. Hence `clear: 'own-children'`.
- **`sherpa-barchart` stamps the ORIGINAL index.**
  [`sherpa-barchart.ts:101`](../src/components/sherpa-barchart/sherpa-barchart.ts#L101)
  iterates a *filtered* list but writes the datum's real position, so `bar-click` still
  names the right bar when a legend has hidden earlier categories. The `fill` callback
  must therefore stay free-form — the helper must not impose the loop index.
- **Some components clear TWO containers.** barchart clears `.bars` and `.x-axis-row`
  in one pass. The helper covers one container; the second stays hand-written rather
  than growing a `containers: []` parameter for a single case.

### The bar for a new option

The same rule `static props` settled on: **three or more uses, or it stays
hand-written.** `clear: 'own-children'` has one use today — it is in only because the
alternative is a silent slot-destroying bug, not because it is tidy.

## Leave alone

The sweep was equally clear about what **not** to build:

| Pattern | Finding |
|---|---|
| ResizeObserver / MutationObserver / rAF / debounce | **Zero uses.** Do not pre-build the API. |
| Keyboard / roving focus | **One** component (`tabs`). Do not abstract. |
| `document`-level listeners | **One** (`menu`). `<dialog>` handles the rest natively. |
| `aria-*` syncing | 69 writes, no shared shape. |
| Escaping before `textContent` | All 113 sites use `textContent` — already safe. **Add nothing.** |
| `Set`-based selection | 7 components, 7 different meanings. Not a pattern. |
| `data-status` handling | 26 components do it in **pure CSS**. Correct as is. |

## One bug to fix regardless

[`sherpa-toast.ts:85`](../src/components/sherpa-toast/sherpa-toast.ts#L85) —
`setTimeout(() => this.#removeAndTidy(), LEAVE_MS)` is **never stored or cleared**.
Remove the toast mid-animation and the timer still fires. A base-class
`this.after(ms, fn)` that auto-cancels on disconnect would prevent the class.

---

# Part 2 — the data layer

## Shape: `Store` (stateless) + `DataSource` (stateful)

Borrowed from DevExtreme, which Apex already uses — so the mental model transfers.
**Much smaller** than DevExtreme's: no OData, no remote grouping, no query builder.

```
  ArrayStore ─┐
  JsonStore  ─┼─→  DataSource  ──populate()──→  sherpa-data-grid
  RestStore  ─┘    (holds filter/                sherpa-barchart
                    sort/group/page)             sherpa-pagination
```

| Thing | Job |
|---|---|
| **Store** | *Stateless.* Reads and writes records. One interface, several backings. |
| **DataSource** | *Stateful.* Holds filter / sort / group / page, applies them on load, emits `change`. |

### Stores

| Store | Backing | Notes |
|---|---|---|
| `ArrayStore` | a JS array | the common case |
| `JsonStore` | a JSON URL | fetch once, then behave as ArrayStore |
| `RestStore` | an HTTP endpoint | `load` → GET, `insert` → POST, `update` → PATCH, `remove` → DELETE |
| `LocalStore` | `localStorage` | for saved views and column state, not bulk data |

Every store, same shape:

```ts
load(options): Promise<Row[]>
byKey(key):    Promise<Row | undefined>
insert(values): Promise<Row>
update(key, values): Promise<Row>
remove(key):   Promise<void>
totalCount(options): Promise<number>
```

### Load options

One vocabulary, reused everywhere. It deliberately matches the `data-*` names the
components already publish, so nothing needs translating:

```ts
{ filter, sort, group, select, skip, take, searchExpr }
```

`sort` uses `data-sort-field` / `data-sort-direction`, and `group` uses
`data-group-field` — the standard names in [`CLAUDE.md`](../CLAUDE.md).

## Built on the platform — zero dependencies

Checked against MDN and caniuse for 2026. All Baseline:

| API | Used for |
|---|---|
| `class Store extends EventTarget` | store events — **no emitter code to write** |
| `AbortController` + `AbortSignal.timeout()` | cancel a stale request when filters change fast |
| `fetch` + `Request`/`Response`/`Headers` | `RestStore` transport |
| `URLSearchParams` | building the query string |
| `structuredClone()` | defensive copies, undo snapshots |
| `Intl.Collator` | locale sort — **one reusable instance**, far faster than per-pair `localeCompare` |
| `Array.prototype.toSorted` | immutable sort |
| `Object.groupBy` | grouping |

### Two traps avoided

- **TC39 Signals** — **Stage 1**. The proposal's own FAQ says 2–3 years minimum.
  Polyfill-only, and a polyfill breaks the zero-dependency rule. **Not used.**
- **DOM `Observable`** — **Chromium only**. No Firefox, no Safari, no MDN reference
  page. **Not used.**

`EventTarget` does both jobs today, natively.

### Sharp edges to handle explicitly

- `fetch` does **not** reject on 404/500 — must check `response.ok`.
- `structuredClone` cannot clone class instances, functions or Proxies. Records stay
  plain objects.
- `Object.groupBy` is Baseline **March 2024** — the youngest thing used. Trivially
  swappable for a `reduce` if the browser floor is older.
- `navigator.onLine` is a UI hint only, never a gate on a request.

## How it reaches components — no component changes

All 21 data-taking components already accept a plain array or object through one
door: `populate()`. The data source simply calls it.

```js
const source = new DataSource({ store: new ArrayStore(customers), pageSize: 25 });
source.bind(grid);       // populate() on every change
source.bind(pager);      // reads total + page
source.bind(toolbar);    // chips write filters back
```

Three components, **one** piece of state. The backlog's "Sort chip disagrees with the
grid" stops being possible by construction.

`sherpa-container` already has `data-loading` plus slot-driven empty/error states, so
a bound source can drive those three states with no new CSS.

## The real prize: many components, one source

This is the capability the whole layer exists for, and it is worth stating plainly
because it is bigger than "less code".

### What it looks like today

[`records.js:305`](../examples/views/records.js#L305) and
[`records.js:332`](../examples/views/records.js#L332) are **two handlers for the same
event**, doing the same thing, because the sort can arrive from two places:

```js
grid.addEventListener('sort-change', (e) => { sort = {…}; render(); });
// …26 lines later…
qft.addEventListener('sort-change', (e) => { sort = {…}; page = 1; render(); });
```

The comment beside the second one says the quiet part out loud:

> Same event the grid's own header sort fires, so both routes land on one piece of
> state and cannot disagree.

The app is holding them together **by hand**. And it only half works — setting the
sort from the toolbar never tells the grid, so the grid's own header arrow keeps
showing the old column. That is exactly the backlog's known issue.

The dashboard has the same shape at a larger scale: **11 separate `populate()` calls**
in [`dashboard.js`](../examples/views/dashboard.js), each fed by hand. Filtering
"last 30 days" from the app header would mean re-deriving and re-feeding all eleven.

### What a shared source makes possible

```js
const customers = new DataSource({ store: new ArrayStore(rows), pageSize: 25 });

customers.bind(grid);     // rows in, sort/group/filter out
customers.bind(toolbar);  // chips in, sort/group/filter out
customers.bind(pager);    // page in, total out
```

The two sort routes become one because there is only one place the sort lives. The
grid's header arrow and the toolbar's Sort chip are both **views of the same value** —
change either and both redraw. No `render()` to remember to call.

The dashboard case is the same mechanism, fanned wider:

```js
const sales = new DataSource({ store: new ArrayStore(orders) });
sales.bind(header);       // the date-range / segment filter writes here
sales.bind(revenueChart); // …and every visualisation
sales.bind(regionDonut);  // …re-populates from the SAME filtered rows
sales.bind(topTable);
```

One filter change, eleven components updated, zero wiring per component.

### Binding is TWO-WAY, and that is the point

A bound component both **reads** and **writes**:

| Direction | How | Example |
|---|---|---|
| source → component | `populate()` + `data-*` writes | rows, `data-sort-field`, `data-page` |
| component → source | its existing `noun-verb` events | `sort-change`, `quick-filter-change`, `page-change` |

Both halves already exist. The events are ratified and composed; the attributes are
the standard names in [`CLAUDE.md`](../CLAUDE.md) — `data-sort-field`,
`data-sort-direction`, `data-group-field`. **No component needs a new API.**

This is also where `static props` pays off a second time. A `kind: style` attribute
is declared and observable, so a source can write `data-sort-direction` onto the grid
and the header arrow re-draws through CSS — no JS branch, exactly the "JS tells CSS
about a data change" path the declaration was for.

### Shared ATTRIBUTES, not just shared rows

Two components bound to one source share more than the data:

- **sort** — the toolbar's Sort chip and the grid's column header
- **group** — the Group chip and the grid's `data-group-field`
- **page** — the pager and the grid's visible slice
- **filters** — the chips, and every chart reading the same rows
- **selection** — a grid's checkboxes and a toolbar's "3 selected" action bar
- **loading / empty / error** — every bound `sherpa-container` at once

### Scoping: not everything shares everything

A dashboard filter should reach every chart; a grid's page should not reach a
sparkline. Two mechanisms, and the smaller one is usually right:

1. **Separate sources.** Two `DataSource`s over the same store share the records but
   not the view state. This is the default answer.
2. **A scoped bind** — `source.bind(el, { reads: ['rows'], writes: [] })` — for a
   component that should see the data but not steer it. A read-only chart beside a
   steering grid is the case.

`DataSource` extends `EventTarget`, so "notify every bound component" is the platform's
own `dispatchEvent`, not a subscriber list to write.

### The precedent is already in the repo

[`render-view.ts:120`](../src/core/render-view.ts#L120) already implements exactly this
shape: a `StateStore` where a write at a JSON pointer re-runs **every subscriber whose
pointer overlaps**, and `renderView` binds `$state` references to `populate()`
reactively. The fan-out model is proven here; `DataSource` is that idea applied to
records rather than to a view blob, and the two should share the mechanism rather than
grow a second one.

## What shrinks

| File | Now | Why |
|---|---|---|
| `examples/views/records.js` | 371 lines | hand-wired filter → sort → page pipeline |
| `sherpa-data-grid.ts` | 714 lines | keeps rendering, loses `#sortRows` / `#filteredRows` |

`records.js` also builds filter options by hand (`valuesOf`) — a store can derive
those from the data.

---

# Part 3 — validation

Data arrives from five places, and they do **not** share a mechanism:

| Source | Native validation available? |
|---|---|
| User input (a form field) | **Yes** — Constraint Validation API |
| Server responses (JSON) | **No** |
| Agent / MCP tool calls | **No** |
| System events | **No** |
| Programmatic API calls | **No** |

So the answer splits in two. One half is already built; the other has no platform
support at all and must be written.

## What already exists — more than expected

Sherpa is **not** starting from zero here:

| Piece | Where | State |
|---|---|---|
| `:user-invalid` in CSS | [`sherpa-input-text.css:178`](../src/components/sherpa-input-text/sherpa-input-text.css#L178) | ✅ correct |
| `checkValidity()` passthrough | input-text, select-checkbox, select-radio | ✅ present |
| Native constraints mirrored | `required`, `pattern`, `minlength`, `maxlength` | ✅ present |
| `data-error` display channel | input-text, select-group | ✅ present, but **nothing computes it** |

`:user-invalid` is the right choice and worth protecting: it matches **only after
the user has interacted**, so a form does not turn red on page load the way
`:invalid` would. Baseline since November 2023.

## The form half — finish it with `ElementInternals`

The gap is that Sherpa's inputs are **not form-associated**. They pass
`checkValidity()` through to an inner native control, but a wrapping `<form>`
cannot see them: no value is submitted, and submission is not blocked when
invalid.

The fix is platform-native and Baseline since **March 2023**:

```ts
static formAssociated = true;          // opt in
#internals = this.attachInternals();   // in the constructor

// Valid:
this.#internals.setValidity({});
// Invalid — a message is REQUIRED whenever any flag is true:
this.#internals.setValidity({ valueMissing: true }, 'Enter an email address');
```

`setValidity()` takes the same `ValidityState` flags the platform uses
(`valueMissing`, `typeMismatch`, `patternMismatch`, `tooLong`, `tooShort`,
`rangeUnderflow`, `rangeOverflow`, `stepMismatch`, `badInput`, `customError`).

Once `setValidity()` marks the host invalid, `:invalid` and `:user-invalid` apply to
the **custom element itself**, and a native form submit is blocked exactly as it
would be for a built-in `<input>`. So the CSS Sherpa already has keeps working.

**Sharp edges** (all documented, all avoidable):

- `attachInternals()` throws `NotSupportedError` without `static formAssociated = true`.
- `setValidity()` throws `TypeError` if a flag is true and no message is given.
- Passing `{}` is the **only** way to clear the flags.
- The optional `anchor` must be a shadow-including descendant, or `NotFoundError`.

**Two real cross-browser gaps** — the validation plumbing is solid, the
*accessibility* plumbing is not:

- **Firefox** implements value + validation but **not** most of `ElementInternals`'
  ARIA/role reflection. Wire ARIA by hand; do not rely on reflection.
- **Safari** has an open WebKit bug (#259124) affecting `<label>`-click association
  for form-associated custom elements.

Neither blocks the work. Both mean: set the ARIA attributes explicitly rather than
trusting the platform to reflect them.

## The native constraints are shipped — but `type="email"` is not an email check

Every constraint attribute (`required`, `min`, `max`, `minlength`, `maxlength`,
`pattern`, `step`) is Baseline since 2015. Support is not the limit; **expressiveness**
is — and `type="email"` deserves a specific warning.

The WHATWG production is a self-declared *"willful violation of RFC 5322."* It is
simultaneously **too loose and too strict**:

| It ACCEPTS | It REJECTS |
|---|---|
| `me@example` — **no TLD required at all** | `"john doe"@example.com` — quoted local part |
| an empty value when `multiple` + `required` | `john(comment)@example.com` — RFC-legal comment |

So `type="email"` is a useful *shape* hint and nothing more. Treat a real address
check as a server concern, and never tell a user an address is invalid on its say-so.

### What native cannot express at all

Confirmed: none of these exist as a declarative native primitive.

| Rule | Example |
|---|---|
| Cross-field | confirm-password, `start < end` |
| Async | "is this username taken?" |
| Conditional | required *only if* another field is set |

The spec-sanctioned escape hatch is the one Sherpa should use:
`setValidity({ customError: true }, message)` recomputed on the events the rule
actually depends on — which is exactly what a `validate` module feeds.

**Precedent — four libraries, one answer.** All of them anchor on native constraint
validation. None invents a validation vocabulary of its own.

| Library | Approach |
|---|---|
| **Web Awesome 3** (Shoelace's successor) | Rebuilt on `ElementInternals`. Controls are "first-class citizens": `new FormData(form)`, `form.checkValidity()` and `form.reset()` just work. Styles via `:state(user-invalid)`. |
| **Microsoft FAST / Fluent** | A first-party `FormAssociated` base class, with `supportsElementInternals` capability detection. The most standards-aligned. |
| **Adobe Spectrum** | A native `<input>` inside the shadow DOM as the engine, patched with JS where native falls short (e.g. `pattern` does not fire on `<textarea>`). |
| **Lit** | Ships nothing. The team **explicitly declined**: not enough "opinions or bandwidth for a fully bespoke forms package." |

Two details worth copying:

- **Legacy Shoelace 2.x hand-rolled all of this** — its own source says *"Since we're
  not yet using ElementInternals…"* — and Web Awesome 3 **replaced** that with the
  native API. That is the migration Sherpa would be doing, with the benefit of
  skipping the hand-rolled stage entirely.
- Web Awesome moved from `data-user-invalid` to the real CSS custom-state
  `:state(user-invalid)`. Worth considering once `ElementInternals` is in.

## The non-form half — nothing native exists

For a JSON payload, an MCP tool result or a system event there is **no** web-platform
validator. Checked and confirmed:

| Candidate | Verdict |
|---|---|
| JSON Schema in browsers | **Does not exist.** A spec + third-party libraries only; no engine implements it. |
| A TC39 proposal for runtime validation | **None.** `proposal-type-annotations` (Stage 1) is explicitly *erased* at runtime — it validates nothing. Records & Tuples was **withdrawn** (April 2025). |
| A WICG proposal | One 2022 discourse thread ("built-in JSON Schema validation"). Never entered incubation, no implementer interest. **Dormant.** |
| `JSON.parse` reviver | A *transform* hook, not a validator — any check is code you write by hand. |
| `JSON.parse` with source | Stage 4, but about **precision/round-tripping**, not validation. |
| `structuredClone()` | Not a validator — it clones. A value can clone cleanly and still violate every rule. |
| `URL.canParse()` | ✅ **Baseline Dec 2023** — a real, free URL validator. Use it. |
| `Temporal` | ✅ **USE IT.** Stage 4; Chrome 144, Firefox 139, Node 26. Safari is Tech Preview only — **Will's ruling: Temporal matters more to Sherpa than Safari does.** See below. |
| `Number.isInteger`, `Number.isFinite` | ✅ fine, already used by `coerceNum`. |

So this half must be written. It should be **small**.

### Temporal — a deliberate, recorded exception

`Temporal` is Stage 4 and ships unflagged in **Chrome 144, Firefox 139 and Node 26**.
Safari has it in Technology Preview only, so it is not yet Baseline.

**Will's ruling (2026-09-15): use it. Temporal matters more to Sherpa than Safari
does.** This is a deliberate trade, recorded here so nobody "fixes" it later by
ripping Temporal out.

What that decision does and does not mean:

- **It does not touch the CSS build.** `browserslist` in `package.json` still says
  `Safari >= 16`, and it should — that entry drives only `postcss-preset-env` and
  `autoprefixer` for CSS. Styling stays cross-browser. This is a JS-only trade.
- **It costs nothing in tests today.** Playwright runs `chromium` only; the
  `webkit` project is commented out in `playwright.config.ts`. So nothing in CI
  breaks, and nothing in CI would have caught it either way.
- **No polyfill.** Adding one would break the zero-dependency rule, which is a
  harder rule than the browser matrix. On a browser without Temporal, a date rule
  fails loudly rather than silently — that is the correct failure mode.
- **Where it earns its place:** date validation and date-range filtering. `Date` has
  no sane parsing, no plain-date type and no comparison that survives a timezone.
  A `created` between two days — which the records example already does by string
  comparison — is exactly what `Temporal.PlainDate` is for.

If Safari support is ever needed, the escape is a capability check at the one place
dates are parsed, not a polyfill and not a rewrite.

**Verified, not assumed** — probed in the real test browser:

```
chromium 153 · typeof Temporal → "object"
Temporal.PlainDate.from('2026-09-15') → "2026-09-15"
Temporal.PlainDate.compare('2026-01-02','2026-01-10') → -1
```

**Two things must change before any Temporal code compiles or runs:**

1. **TypeScript rejects it today.** `tsconfig.reforged.json` has
   `"lib": ["ES2022", "DOM", "DOM.Iterable"]`, so `Temporal` is
   `error TS2304: Cannot find name 'Temporal'`. Add `"ESNext.Temporal"` — the
   **old** `tsconfig.json` already carries it, so this is restoring a precedent,
   not inventing one.
2. **Node 24 does not have Temporal** (it landed in Node 26), and this project runs
   Node 24. So date rules **cannot** be unit-tested under `node:test` — they must be
   exercised in the browser harness, where Temporal is present. This settles the
   open "how do we test the data layer" question for anything date-shaped: the
   harness, not Node.

## Recommended shape

### 1. A `validate` module, not a component

**Recommend: a plain module (`src/core/validate.ts`), NOT a `<sherpa-data-validator>`
element.**

The reasoning:

- **A validator has no visual output.** A custom element that renders nothing is
  a function wearing a costume. `format-tick.ts` is the house precedent for shared
  non-visual logic, and it is a module.
- **The data layer must validate before any DOM exists.** A `RestStore` checks a
  response the moment it lands — there may be no component mounted at all. An
  element cannot serve that path; a module serves both.
- **Shadow DOM makes nesting worse, not better.** A nested element's error would
  have to cross a shadow boundary to reach the field that caused it — the exact
  problem recorded in [[sherpa-projected-slot-content-crosses-two-shadow-boundaries]].
- **The prior art that exists confirms the limit.** The pattern is real but a
  minority one — see below.

### The prior art, honestly

A validator-as-element is **not** unprecedented. Two real examples:

- **D2L (Brightspace) `<d2l-validation-custom>`** — a *sibling* element, not a
  wrapper, referencing its field the way `<label for>` does:
  ```html
  <d2l-input-text id="name" label="Name"></d2l-input-text>
  <d2l-validation-custom for="name" failure-text="…"></d2l-validation-custom>
  ```
- **Polymer's `iron-validator-behavior`** (now `ValidatableMixin`) — the same idea
  as a mixin rather than an element.

So the idea has pedigree. But note what D2L's shape tells us: it is a **sibling with
a `for` attribute**, *not* a nested wrapper — because nesting is what the shadow
boundary punishes. And the modern libraries surveyed above all went the other way.

The decisive argument is the one the prior art itself runs into: **a JSON response, a
WebSocket payload or an MCP tool result has no element to attach to.** Expressing a
rule only as an element's behaviour makes it unusable outside a live DOM — so the
rule would have to be written twice, once for fields and once for data. That is the
duplication this whole plan exists to remove.

**What the element idea gets right, and how to keep it:** the desire is for
validation to be *declarative and co-located with the markup*. That is better served
by a `data-*` attribute the field already owns than by a wrapper element:

```html
<sherpa-input-text data-rules="required email"></sherpa-input-text>
```

Declarative, nestable, no extra element, and it reads exactly like the native
constraint attributes beside it.

### 2. One result shape, used everywhere

```ts
type Issue = { path: string[]; message: string; code: string };
type Result<T> = { ok: true; value: T } | { ok: false; issues: Issue[] };
```

A `path` (not a flat key) because a validated object nests, and an agent payload
nests deeply.

### 3. Translate to the platform at the edge

The same result drives both halves:

- **Form:** `issues` → `internals.setValidity({ customError: true }, issues[0].message)`
  → CSS `:user-invalid` already does the rest.
- **Non-form:** `issues` → a `sherpa-toast`, a `data-error` attribute, or a rejected
  store write.

One validator, two renderings. No second mechanism.

### 4. Accept a `StandardSchema` — but do not depend on one

**Standard Schema** (standardschema.dev) is a community **interface convention**, not
a TC39 proposal and not a spec. A schema advertises itself with a `~standard`
property carrying a `validate` function. Zod, Valibot and ArkType implement it.

It is a **TypeScript interface and a duck-typed contract — no runtime dependency**.
So Sherpa can accept any Standard Schema object without importing anything:

```ts
new ArrayStore(rows, { schema: mySchema })   // a Zod/Valibot/ArkType schema, or
new ArrayStore(rows, { schema: rules({...}) }) // Sherpa's own tiny built-in
```

Users who already have Zod bring it. Users who want nothing extra use the built-in.
**Sherpa's `package.json` gains no dependency either way.**

Two contract details to honour:

- `validate()` may return **either a result or a `Promise` of one**. Every caller must
  handle both — which is also what makes async rules ("is this username taken?")
  work through the same door.
- Its `Issue` shape is `{ message, path? }`. Sherpa's own `Issue` should stay
  compatible with it rather than inventing a different one.

### 5. Accessibility — avoid the known trap

The base is `aria-invalid` + `aria-describedby`. Both are old, stable ARIA with no
known gaps — treat them as safe.

```html
<label for="email">Email address</label>
<input id="email" type="email"
       aria-describedby="email-hint email-error"
       aria-invalid="true">          <!-- set by JS only AFTER validation runs -->
<p id="email-hint">We only use this to send your receipt.</p>
<!-- present in the DOM from the start; JS fills the text -->
<p id="email-error"></p>
```

Three rules that are easy to get wrong:

**1. `role="alert"` does NOT belong on a per-field error.** Putting `role="alert"`
(or `aria-live`) on the same element `aria-describedby` points at causes
**double-speak** in JAWS and NVDA — the live region fires, then the description
fires again on focus — and has been observed to make VoiceOver drop the
`aria-describedby` association entirely.

Reserve `role="alert"` for a **form-level summary** ("There are 3 errors"), shown
once on a failed submit. That is the one place an interruption is warranted.

**2. The error element must already exist in the DOM.** Creating the element and
injecting its text in one operation frequently fails to announce. Sherpa already
does this correctly — the error line is in the `.html` template and CSS reveals it,
per the "all elements must exist in the template from the start" rule.

**3. `aria-errormessage` is optional, additive — never the only wiring.** Its
reputation for poor support was accurate through ~2023, and it has **measurably
improved**: NVDA added it in 2024.3, JAWS and iOS VoiceOver support it. But
**macOS VoiceOver (desktop) and Android TalkBack remain gaps** as of 2025 testing,
and the W3C ARIA group has an open issue questioning whether the attribute stays in
the spec at all. Adding it alongside `aria-describedby`, pointing at the same id,
costs nothing where unsupported. Relying on it alone does not.

**Known platform gap worth recording:** Safari 17+ on macOS changed how
`aria-describedby` is exposed on **text-type inputs** — VoiceOver no longer
auto-announces it, and instead offers a "more content menu" the user must open.
Radio, checkbox and button types are unaffected. This hits exactly the field type
most often validated, and there is no workaround from the library side.

## Do NOT build

| Not this | Why |
|---|---|
| A full JSON Schema implementation | Large, and Standard Schema already delegates it |
| A `<sherpa-data-validator>` element | No visual output; cannot serve the pre-DOM path (a JSON/MCP payload has no element to attach to) |
| A second validation mechanism for forms | The platform's is better; finish wiring it |
| `aria-errormessage` as the only wiring | macOS VoiceOver + TalkBack gaps remain |
| `role="alert"` on a per-field error | double-speak in JAWS/NVDA; summaries only |

## Validation — order of work

| Step | Work |
|---|---|
| V1 | `validate.ts`: the `Result`/`Issue` shape + a small rule set (required, type, range, length, pattern, url, enum, custom) |
| V2 | Accept a Standard Schema object wherever a rule set is accepted |
| V3 | `formAssociated` + `ElementInternals` on the input components |
| V4 | `data-rules` on the field, translated into `setValidity()` |
| V5 | Validate on the store: check a `RestStore` response and reject a bad `insert`/`update` |
| V6 | ARIA wiring: `aria-invalid` + `aria-describedby`; `role="alert"` only on a form-level summary |

V1–V2 are prerequisites for V5, so validation interleaves with Part 2 rather than
following it.

---

# On htmx — recommend **no**

The codebase already reached this conclusion, at
[`server/index.mjs:15`](../server/index.mjs#L15):

> No htmx: the example pages fetch their view template with plain `fetch` … Plain
> fetch+inject is enough here — there is no server-driven partial swapping — so a
> client-side swap library would only add weight.

The blocker is structural. **htmx cannot see into shadow DOM.** Its own docs say so:

> HTMX doesn't know anything about your web components, and won't see anything
> inside their shadow DOM.

Every Sherpa component is shadow DOM. Adopting htmx would mean:

- calling `htmx.process(this.root)` by hand in **every** component
- `hx-target` cannot cross a shadow boundary without `global:` prefixes
- a runtime dependency, breaking the zero-dependency rule
- htmx wants **HTML fragments** back; the data layer wants **JSON**

The 2026-09-08 HTMX-readiness pass was still right, and its gains are kept: semantic
HTML, `data-*` on the host, composed `noun-verb` events. Those make components
htmx-*compatible* for an app that chooses htmx. **Sherpa should not depend on it.**

If server-driven HTML swapping is ever wanted, it belongs in the app, not the library.

---

# Order of work

Part 1 first — Part 2 feeds components through the door Part 1 cleans.

| Step | Work | Why here |
|---|---|---|
| **1** ✅ | `num()` | **DONE** `5a34c3a6` — 4 live bugs, 15 specs |
| **2** ✅ | `static props` | **DONE** — 26 components; `fd30d49c` `5c742777` `4880a80d` `7818d325` `4171a2dd` `5a531870` |
| **3** ✅ | `clone()` | **DONE** `f7fa5fc3` — the 4 asserted sites; loop sites left alone |
| **4** ✅ | `icon()` | **DONE** `fffab02b` — as `as: 'icon'` on a prop; 4 components had no FA branch |
| 5 | `delegate()` | **RE-SCOPED — low priority.** Its bug is already fixed by step 1; see 1.5 |
| **6** ✅ | `renderList()` | **DONE** `205a318c` — 6 components; 4 tried and left hand-written |
| 7 | **V1** `validate.ts` — `Result`/`Issue` + the rule set | a prerequisite for step 10 |
| 8 | **V2** accept a Standard Schema object | zero-dependency Zod/Valibot support |
| 9 | `Store` + `ArrayStore` + `DataSource` | the core |
| 9a | **`bind()` — two-way, many components per source** | the capability the layer exists for; see "The real prize" |
| 10 | **V5** validate on the store | a bad response or `insert` must not reach the UI |
| 11 | `JsonStore`, `RestStore`, `LocalStore` | remote + persistence |
| 12 | **V3 + V4** `formAssociated` + `data-rules` | the form half; independent of 9–11 |
| 13 | **V6** ARIA wiring | `aria-invalid` + `aria-describedby` (NOT `role="alert"` per field) |
| 14 | Rewire `records.js` | proves ONE source steering grid + toolbar + pager |
| 14a | Rewire `dashboard.js` | proves ONE filter fanning out to 11 visualisations |
| 15 | Move grid sort/filter onto the source | closes the backlog's known issue |

Validation is interleaved, not appended: V1–V2 must precede the store work that uses
them (step 10), while the form half (12–13) is independent and can run in parallel.

## Gates

Each step must pass before the next:

```bash
npm run type-check     # strict, no emit
npm run lint            # eslint, --max-warnings 0
npm run lint:css        # 57 files · 0 errors · 0 warnings
npm test                # 437 passing after step 6 — must not drop
```

Also run `node scripts/generate-component-spec.mjs --all --check` after touching a
component and confirm **no new** drift (several pre-existing round-trip notes are
unrelated and expected).

**Trap:** `npm test` can serve a **stale `dist/`**. If a change *should* have broken a
test and did not, run `npm run build` and re-run.

## Testing the data layer

Playwright is E2E-only (`test/e2e/*.spec.ts`, real browsers against a harness). The
store and data source are plain modules with no DOM, so a `node:test` runner looked
like the natural fit.

**The Temporal decision settles it: use the browser harness.** Node 24 has no
`Temporal`, so a date rule tested under `node:test` would fail on the runner while
working perfectly in every browser the library targets — the worst kind of false
negative. The harness has Temporal (verified above) and is already the house
pattern.

The `coerceNum` spec in
[`reforged-num-coercion.spec.ts`](../test/e2e/reforged-num-coercion.spec.ts) already
shows the shape: `await import('/dist/core/…')` inside `page.evaluate`, then assert on
plain return values. A DOM-free module tests fine that way.

## Docs owed

- A new ADR: `docs/adr/0013-data-layer.md`
- `CLAUDE.md`: a Data Layer section, and the `static props` contract
- `HANDOVER-BACKLOG.md`: close "Sort chip is NOT linked", note what step 10 replaces
- **Note:** `FormManager` / `FlowManager` are referenced in
  [`adr/0011`](adr/0011-crud-flow-composition.md) and `BACKLOG.md` but **do not exist
  on this branch**. Either build them under the data layer or correct those docs.
