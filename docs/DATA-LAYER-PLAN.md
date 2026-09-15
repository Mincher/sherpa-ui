# The Data Layer — plan

Branch `sherpa-data-layer`. Nothing is built yet. This is the plan only.

Two jobs, in this order:

1. **Consolidate `SherpaElement`** — absorb the plumbing 31 components copy by hand.
2. **Add a data layer** — one place that owns filter / sort / group / page, so the
   grid, the toolbar and the app cannot disagree about them.

Part 1 comes first because Part 2 feeds components through the door Part 1 cleans.

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

Eight components; the copies disagree, and one is a real bug:

```ts
// barchart.ts:163 — guards, then indexes (safe)
const raw = col?.dataset['index']; if (raw == null) return;
// file-upload.ts:140 — NO null guard
const idx = Number(row?.dataset['index']); if (Number.isNaN(idx)) return;
// progress-step-tracker.ts:93 — no guard at all; can emit index: NaN
const index = Number(node.dataset['index']);
```

`Number(undefined)` is `NaN` so file-upload survives by luck — but `Number(null)` is
**`0`**, which would **splice row 0**.

Two components also carry comments about `closest()` failing after shadow-boundary
retargeting. [`sherpa-list.ts:98`](../src/components/sherpa-list/sherpa-list.ts#L98)
already solves it with `composedPath()`. One helper fixes that class everywhere.

## 1.6 `renderList()` — rebuild a list

16 components share the skeleton: clear, clone per item, set a key, append.

Two real behaviours must survive as **explicit options**, not be flattened:

- [`sherpa-list.ts:69`](../src/components/sherpa-list/sherpa-list.ts#L69) must **not**
  use `replaceChildren()` — it would destroy the `<slot>`.
- [`sherpa-barchart.ts:96`](../src/components/sherpa-barchart/sherpa-barchart.ts#L96)
  stamps the **original** index, not the loop index, because hidden series shift
  positions.

Do this one last — it needs the most design care.

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

## What shrinks

| File | Now | Why |
|---|---|---|
| `examples/views/records.js` | 371 lines | hand-wired filter → sort → page pipeline |
| `sherpa-data-grid.ts` | 714 lines | keeps rendering, loses `#sortRows` / `#filteredRows` |

`records.js` also builds filter options by hand (`valuesOf`) — a store can derive
those from the data.

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
| 1 | `num()` | smallest change, fixes 4 live bugs |
| 2 | `static props` + reflection | biggest win; removes ~30 methods and every if-chain |
| 3 | `clone()` | trivial; unifies 3 null policies |
| 4 | `icon()` | gives 4 components working icons |
| 5 | `delegate()` | fixes the `Number(null)` → row 0 bug |
| 6 | `renderList()` | most design care; do last |
| 7 | `Store` + `ArrayStore` + `DataSource` | the core |
| 8 | `JsonStore`, `RestStore`, `LocalStore` | remote + persistence |
| 9 | Rewire `records.js` | proves it on the hardest real view |
| 10 | Move grid sort/filter onto the source | closes the backlog's known issue |

## Gates

Each step must pass before the next:

```bash
npm run type-check     # strict, no emit
npm run lint:css       # 53/0/0
npm test               # 401 passing today — must not drop
```

**Trap:** `npm test` can serve a **stale `dist/`**. If a change *should* have broken a
test and did not, run `npm run build` and re-run.

## Testing the data layer

Playwright is E2E-only (`test/e2e/*.spec.ts`, real browsers against a harness). The
store and data source are plain modules with no DOM, so they need either a `node:test`
runner or a harness page. **Decide before step 7.**

## Docs owed

- A new ADR: `docs/adr/0013-data-layer.md`
- `CLAUDE.md`: a Data Layer section, and the `static props` contract
- `HANDOVER-BACKLOG.md`: close "Sort chip is NOT linked", note what step 10 replaces
- **Note:** `FormManager` / `FlowManager` are referenced in
  [`adr/0011`](adr/0011-crud-flow-composition.md) and `BACKLOG.md` but **do not exist
  on this branch**. Either build them under the data layer or correct those docs.
