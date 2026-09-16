# The Data Layer — plan

Branch `sherpa-data-layer`.

| Part | State |
|---|---|
| **1** — consolidate `SherpaElement` | **DONE**, except the low-priority `delegate()` |
| **2** — the data layer | **CORE DONE** — `Store`, `ArrayStore`, `DataSource`, two-way `bind()`, and `records.js` rewired. Remote stores and the dashboard fan-out are still plan. |
| **2.5** — state ownership and parity | **NEW 2026-09-16.** The model the core turned out to need. Four primitives exist; the generalisation does not. |
| **3** — validation | V1, V2 and V5 done; the form half is plan |
| **Q** — query translation | `LoadOptions` IS the format and the `buildQuery` seam exists. Translators on demand; the server end deliberately deferred. |
| **S** — scope + external sources | **NEW 2026-09-16.** Where stores, sources and session state live; and how MANY backends meet ONE `DataSource` — resolved in the `Store` layer, with a schema as each source's adapter. |

Five jobs:

1. **Consolidate `SherpaElement`** — absorb the plumbing 31 components copy by hand.
2. **Add a data layer** — one place that owns filter / sort / group / page, so the
   grid, the toolbar and the app cannot disagree about them, and so MANY components
   can bind to ONE source: a sort set in a toolbar moves the grid's column header, a
   filter set in an app header re-populates every chart on a dashboard.

   **Nothing reloads and no page re-renders.** A source calls `populate()` on
   each bound component, and that component updates its OWN shadow DOM from its
   own template — the rest of the page is untouched. What is NOT yet scoped is
   the update WITHIN a component: the grid rebuilds every row even when only the
   sort changed. That is F1/F2, and it is the difference between "the right
   component updated" (true today) and "only the part that changed updated"
   (not yet).
3. **Settle state OWNERSHIP** — every value has one owner; everything else reads
   it. Plus PARITY: anything a person can do by clicking, a caller can do by
   calling, through the same code. This is what makes the layer usable by hosts,
   tests and agents alike.
4. **Add validation** — one rule set for all five data sources, translated to the
   platform's own validity mechanism at the edge. A schema is also how an
   EXTERNAL source is mapped into the layer's own vocabulary.
5. **Settle SCOPE** — what lives at app, view and component level, and how many
   backends meet one `DataSource`. The answer to both is that plurality is
   resolved in the `Store` layer, never above it.

Part 1 came first because Part 2 feeds components through the door Part 1 cleans.
Part 2.5 was written AFTER Part 2's core shipped, because building it is what
revealed the gap — see "What actually happened when two-way binding met a real
screen". Part 3 interleaves rather than following — see the order of work.

**The cornerstone, unchanged:** platform-native paradigms, progressive
enhancement, zero runtime dependencies. Attributes carry state, events carry
intent, CSS draws every visual, and JS is the last resort. Everything in Part
2.5 is an attribute, an event name, or a method — no framework appears anywhere
in this plan.

---

## Why this is needed — the evidence

### The same sort was written three times — TWO are now one

The original diagnosis, as written before the layer existed:

| Where | What it held |
|---|---|
| `sherpa-data-grid.ts` | `#sortRows()` — its own compare |
| `examples/views/records.js` | `compare()` — a second copy, with `{ numeric: true }` |
| `sherpa-quick-filter-toolbar.ts` | `sortField` / `sortDirection` — a third *state* |

[`HANDOVER-BACKLOG.md`](HANDOVER-BACKLOG.md) recorded the symptom:

> The Sort chip is NOT linked to the grid's column-header sort … two separate
> pieces of state, so they can disagree.

**Re-checked 2026-09-16 — two of the three are gone:**

- `records.js` has **no `compare()` at all** (grep: zero hits). The hand-wired
  pipeline it belonged to was replaced by the source.
- The toolbar and the grid's column header are now **one value**: the toolbar
  observes `data-sort-field` / `data-sort-direction` and the grid writes them.
  Verified in a browser — sorting a column header moves the toolbar's Sort chip
  and vice versa.

**What remains is smaller and different from the original claim.** The grid's
`#sortRows` ([line 1240](../src/components/sherpa-data-grid/sherpa-data-grid.ts#L1240))
still exists beside a source that could own it, and it compares strings with a
bare `localeCompare`:

```ts
if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * direction;
return String(av).localeCompare(String(bv)) * direction;   // no { numeric: true }
```

So `"item 2"` still sorts after `"item 10"` — but as a **single**
implementation's limitation, not as two controls disagreeing. The stated cause
("depending on which control you used") is no longer true.

The duplication that IS still open is the grid sorting in two places depending
on whether it is bound — step 15, and see "What shrinks — and what has NOT
yet".

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
| `content` | 144 | JS writes text into the shadow DOM | **behaviour** in the base class |
| `style` | 128 | CSS selects on it; JS never reads it | **declaration** only |
| `visibility` | 10 | presence toggles a CSS rule | declaration only |

The YAML knows each attribute's `type` (`enum`/`boolean`/`string`/`number`) and its
`kind`. The TypeScript does not — so it re-derives both by hand, 51 times.
**The contract exists; the code just does not consume it.**

---

# Part 1 — consolidate `SherpaElement`

`src/core/sherpa-element.ts` is **601 lines** (277 when this was written — Part 1
landed in between) and does four things well. It provides no
helper for attribute coercion, template cloning, text syncing or delegation — and
that is exactly where every copy-paste bug lives.

A full sweep of all 58 component directories found **six** patterns worth
absorbing.
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

**Cost is near zero.** [`sherpa-element.ts:271`](../src/core/sherpa-element.ts#L271)
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

*A bug already shipped from this.* `sherpa-input-text` recorded it in a comment
(since removed with the code it described):

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

## One bug to fix regardless — FIXED

`sherpa-toast` used `setTimeout(… , LEAVE_MS)` with a `160` that had to be kept
in step with the `sherpa-toast-out` CSS animation by hand.

**Fixed 2026-09-16**, and not the way this section proposed. A base-class
`this.after(ms, fn)` would have kept the duplicated number; instead **CSS owns
the duration and JS waits for `animationend`**, so the number has one home. The
dismiss timer is separately stored and cleared on disconnect.

A `this.after()` helper is still a reasonable idea for genuine timers, but it
had no third use — see the Part 1 bar.

---

# Part 2 — the data layer

## Shape: `Store` (stateless) + `DataSource` (stateful)

Borrowed from DevExtreme, which Apex already uses — so the mental model transfers.
**Much smaller** than DevExtreme's: no OData adapter yet, no remote grouping, and
no monolithic Filter Builder control.

> **Corrected 2026-09-16.** This line used to say "no query builder", which is
> wrong in an important way. Sherpa is FULL of query builders — see
> "[Every filter control is a query builder](#every-filter-control-is-a-query-builder)"
> below. What it does not have is DevExtreme's Filter Builder: one dense control
> where a user assembles `WHERE` clauses from field/operator/value dropdowns.
> That absence is deliberate, and it is a UX position, not an architectural gap.

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

`filter` has no single attribute — it is a tree, not a value — but the source
does write **which fields it touches** as `data-filter-fields` (space
separated). That is what lets a grid mark the columns a toolbar filter is
narrowing: the grid receives only the surviving rows, so without it a chip
change just shrank the table and said nothing about why. `filterFields()` in
`store.ts` flattens the tree.

### `LoadOptions` IS the standard query format

Worth saying plainly: `LoadOptions` is the query format. Every control above
writes into it, and every backend adapter reads out of it.

The distinction that matters:

| | |
|---|---|
| **A query FORMAT** | a portable description of a request: filter tree, sort specs, group field, page window. **We have this.** |
| **Query BUILDERS (UI)** | controls a person uses to assemble that request. **We have several** — see below. |
| **Query TRANSLATORS** | adapters that turn the format into SQL, OData, GraphQL, a Mongo document, an HTTP query string. **One exists; the seam is open for more.** |

<a id="every-filter-control-is-a-query-builder"></a>

### Every filter control IS a query builder

This is the useful reframing, and it changes how the components should be
judged. Sherpa does not lack a query builder — it has **three, at different
altitudes**, each emitting clauses into the same tree:

| Altitude | Control | Emits | Reads as |
|---|---|---|---|
| **App** | app header chips — view, customer, region | `['region', 'in', [...]]` | "which corner of the business am I in" |
| **View** | the quick-filter toolbar | `['plan', 'eq', 'Pro']` | "what am I looking at" |
| **Column** | a data-grid column heading | `['name', 'contains', 'ana']` | "how am I reading it" |

They compose into `['and', <app>, <view>, <column>]` — one tree, one
`LoadOptions`, one translation. **The user never sees a query; they see chips
and columns.** That is the whole design: the query builder is dissolved into the
furniture rather than concentrated into a control.

Judged this way, several things already built stop looking like grid features
and start looking like query-builder parts:

- The column filter menu's condition `<select>` is an **operator picker**. Its
  options are DevExtreme `FilterOp`s verbatim, which is why no translation table
  exists to drift.
- The Range switch is an **operator SHAPE toggle** — `eq` versus `between` —
  not a display mode.
- `suspendColumnFilter` is **temporarily disabling a clause** without deleting
  it, which is exactly what a builder's per-row on/off does.
- `data-filter-fields` is **provenance**: which clauses came from which column.

### Why not one dense Filter Builder control

Still a no, and now for a stated reason rather than by omission:

1. **It puts the query in front of the user.** A person filtering a customer
   list is not writing a predicate; they are narrowing to the thing they care
   about. Chips and column funnels say that in the user's language; a
   field/operator/value row says it in the database's.
2. **It duplicates controls that already exist.** A Filter Builder would need
   its own date picker, its own numeric range, its own value list — second
   copies of the calendar, the slider and the menu, free to drift.
3. **It has no home.** The three altitudes above each sit where their question
   is asked. A builder sits nowhere in particular and answers all three badly.

**What would change the answer:** a user who needs `or` across fields, or nested
groups. Neither altitude can express that today — chips `and` together, columns
`and` together.

### The Filter Panel — a FOURTH altitude, planned

Will, 2026-09-16: a **Filter Panel** as a sister to Apex's old Filter Builder is
wanted, as later work.

It is a fourth query builder, not a replacement for the three. What makes it
safe to add is the same thing that makes the others work: **one query tree
behind them all.** The panel reads and writes `LoadOptions.filter` exactly as a
chip does — a different surface onto the same value, not a second model.

The reuse conditions are the point, and they are not negotiable:

| It must | Not |
|---|---|
| read and write the SAME filter tree | keep its own parallel model to sync |
| emit the SAME `FilterOp`s | invent an operator vocabulary |
| compose as one more contribution (`'panel'`) | replace what the chips and columns hold |
| reuse the calendar, the slider, the value menu | grow second copies of any of them |
| use the same condition `<select>` the column filter has | a second operator picker |

That last pair is the whole risk. A Filter Panel is mostly **controls that
already exist**, arranged differently — an operator picker, a value editor per
type, a row you can disable. Every one of those is already built inside the
column filter menu, and the panel's real work is composing them, not writing
them again.

**The prerequisite is O5** (named contributions). Without it a fourth writer
joins the same last-write-wins race that `ignore` is currently patching.

`LoadOptions` is already backend-neutral by construction:

- `filter` is a **tree of `[field, op, value]` clauses** with `and`/`or` groups —
  the shape every query language nests, so nothing has to be un-flattened.
- `FilterOp` is DevExtreme's binary operation set (`eq`, `ne`, `lt`, `lte`,
  `gt`, `gte`, `contains`, `notcontains`, `startswith`, `endswith`, `in`,
  `notin`, `between`). Chosen because it is prior art with known mappings, not
  because it is ours.
- `sort` is `[{ field, direction }]` — an ordered list, so a translator can emit
  multi-column `ORDER BY`.
- `skip` / `take` map straight to `OFFSET` / `LIMIT`, and to every REST paging
  convention.

**Nothing in it names a transport.** That is what makes it translatable.

### The translation seam already exists

`RestStore` takes a `buildQuery(options) => URLSearchParams` hook, defaulting to
a simple one that JSON-encodes the filter tree. **That hook is the seam**, and it
generalises: a translator is a pure function from `LoadOptions` to whatever a
backend wants.

```ts
// what exists
new RestStore({ url, buildQuery: myOdataTranslator });

// what a translator looks like — pure, testable, no store involved
export function toOData(o: LoadOptions): URLSearchParams
export function toSql(o: LoadOptions): { text: string; values: unknown[] }
export function toGraphQL(o: LoadOptions): { query: string; variables: object }
```

Three rules for any translator:

1. **Pure.** `LoadOptions` in, a request description out. No fetching, no store.
   That makes it testable without a server and reusable on the server side.
2. **Parameterised, never interpolated.** A SQL translator emits placeholders
   and a values array. A filter value is user input; building a string from it
   is an injection.
3. **Honest about what it cannot express.** A backend with no `notcontains`
   should THROW on translation, not silently drop the clause and return rows
   the user did not ask for. Failing loudly at the seam beats a wrong answer.

**Build translators when a real backend needs one**, not speculatively. The
format is the commitment; each adapter is a small, separable piece of work.

### Three altitudes, once translated

The question this raises: if the app header, the view toolbar and a grid's
columns all contribute filters, what does the server receive?

**One tree. The composition happens before translation, and the server never
learns there were three sources.**

```
app header chips  ──┐   view · customer · region
quick-filter bar  ──┼─→ ['and', <app>, <view>, <columns>] ─→ translate ─→ SQL / OData / …
column headings   ──┘        ONE LoadOptions.filter
```

This falls out of the ownership model in Part 2.5: the view composes, the source
holds one `LoadOptions`, the store translates. A column filter is not a
different KIND of filter — it is a clause from a different altitude, and by the
time it reaches `LoadOptions` that provenance is gone.

Provenance is only kept **client-side**, and only for the UI:

| Kept for | How | Why |
|---|---|---|
| lighting the right column headers | `data-filter-fields` | the grid gets surviving rows and cannot otherwise know which column shrank the table |
| restoring a toggled-off chip | the view's `columnClauses` map | "off" keeps the value; see Part 2.5 |
| a future named-contributions API | `source.contribute(key, filter)` | so two writers cannot clobber each other — **held**, see O5 |

**Sorting and grouping are simpler**, because both are single-valued: one
`data-sort-field`, one `data-group-field`. There is no composition to do, only
a last-writer. The grid ⇄ toolbar link works precisely because there is exactly
one of each.

**Multi-column sort is NOT WANTED** (Will, 2026-09-16). `LoadOptions.sort` is an
array and `applyOptions` honours every spec, so the format allows it — but no
component expresses more than one, and none should until asked. If it is ever
wanted, the ownership question ("who owns the ORDER of the specs?") is the first
thing to answer.

### Server-side grouping — deferred, deliberately

A server that groups, sorts and filters before responding is the natural other
end of this. It is **out of scope for this plan** and belongs with the wider
server/database work.

What this plan owes it is only the seam, and that is already in place:

- `LoadOptions` is serialisable — it crosses the wire as JSON with no
  transformation.
- `store.ts` is DOM-free, so `applyOptions`, `filterRows` and `sortRows` run
  unchanged in Node. **A server can import the same functions the browser uses**
  and answer a query identically. That is the strongest argument for keeping
  that module DOM-free, and it should stay a rule.
- `RestStore` already reads a server-reported total (`totalPath`), which is what
  server-side paging needs.

One thing to decide THEN, not now: `applyOptions` deliberately does not group —
it applies the group field as a leading sort and leaves the consumer to draw
headings. A server returning genuinely grouped payloads (nested rows, per-group
counts) would need a `LoadResult` shape that does not exist yet. **Do not design
it before a real backend asks.**

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

### What it looked like — and what it looks like now

> **Re-checked 2026-09-16: this is DONE.** `records.js` now makes three
> `source.bind()` calls and the two rival `sort-change` listeners below have
> collapsed into one shared value. The passage is kept because it is the
> clearest statement of WHY the layer exists.

As it was, before the layer — **two handlers for the same event**, doing the
same thing, because the sort could arrive from two places:

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
`data-sort-direction`, `data-group-field`.

This is also where `static props` pays off a second time. A `kind: style` attribute
is declared and observable, so a source can write `data-sort-direction` onto the grid
and the header arrow re-draws through CSS — no JS branch, exactly the "JS tells CSS
about a data change" path the declaration was for.

> **Amended 2026-09-16.** This section used to end "**No component needs a new
> API.**" That was wrong, and building the data grid's column filters proved it.
> Two-way binding needs four things the components did not have, and every one of
> them turned out to be the SAME question: **who owns this value?** They are set
> out in [Part 2.5](#part-25--state-ownership) below, which is the real lesson of
> that work.

### What actually happened when two-way binding met a real screen

The records view binds a grid, a pager and a quick-filter toolbar to one source.
Adding column filters to the grid broke it five separate ways, and none of the
five was a logic bug:

| Symptom | Real cause |
|---|---|
| Chip switched itself off the instant Apply closed its menu | The chip derived `data-current` from its menu's ticked rows. This menu has none — it holds a typed condition. The **grid** owned that state, and the chip did not know. |
| Column filter wiped itself on every re-query | `populate()` cleared the filter map — but a column filter is what CAUSES a re-query, so the grid threw away the thing it had just asked for. |
| Toolbar silently clobbered the grid's filter | Both the toolbar's `quick-filter-change` and the grid's `filter-change` write `filter` on the source. Last write won, and which was last depended on event timing. |
| A custom chip was invisible to the host | It fell into neither `active` (skips menu chips) nor `values` (reads ticked rows), so turning it off said nothing. |
| A lit column painted its own menu purple; a quiet button made its menu transparent | Custom properties inherit past the element that owns them, and a slotted menu is a light-DOM child. |

Four of the five are one sentence: **the value was owned in one place and derived
in another.** The fifth is the CSS form of the same mistake.

<a id="part-25--state-ownership"></a>

### Shared ATTRIBUTES, not just shared rows

Two components bound to one source share more than the data:

- **sort** — the toolbar's Sort chip and the grid's column header
- **group** — the Group chip and the grid's `data-group-field`
- **page** — the pager and the grid's visible slice
- **filters** — the chips, and every chart reading the same rows
- **selection** — a grid's checkboxes and a toolbar's "3 selected" action bar
- **loading / empty / error** — every bound `sherpa-container` at once

### Scoping: contexts, and how they nest

A dashboard filter should reach every chart; a grid's page should not reach a
sparkline. A **context** is one `DataSource`: one set of view state (filter,
sort, group, page) over one store.

Three mechanisms, smallest first:

1. **Separate sources.** Two `DataSource`s over the same store share the records
   but not the view state. This is the default answer and usually the right one.
2. **A scoped bind** — `{ readonly: true }` for a component that sees the data
   but never steers it. A chart beside a steering grid.
3. **A partial bind** — `{ ignore: ['filter-change'] }` when a view has taken
   over ONE concern and the source should keep the rest. Added 2026-09-16; see
   Part 2.5.

`DataSource` extends `EventTarget`, so "notify every bound component" is the
platform's own `dispatchEvent`, not a subscriber list to write.

#### Contexts NEST, and that is the hard part

The records screen is two contexts, not one:

```
APP context      the toolbar's chips — what the user is looking at
  └─ GRID context   a column's own filter — how they are reading it
```

They compose into one query, and **only the view knows how.** The grid holds one
column's clause and cannot see the toolbar; the toolbar holds chips and cannot
see the columns. Neither can combine them, and neither should try.

That is why the grid does NOT filter its own rows off a column filter. It
reports the clause and lights the column; the view ANDs it with the chips and
hands the whole thing to the source. Attempting the merge lower down would mean
a component guessing at state it cannot see.

**The rule:** a component reports its own context's intent. Composition belongs
to whoever can see every context — today the view, and that is fine.

#### What this costs, honestly

The records view now owns ~35 lines of composition across four places: a `Map`
of column clauses, a remembered chip state, one `reapplyFilter()` that rebuilds
the whole filter from both halves, and two `ignore` options keeping the source
out of it. That is the real shape of the problem, not accidental complexity —
but it is the same 35 lines every screen with a grid and a toolbar will write.

**The generic version:** let a source accept named filter CONTRIBUTIONS rather
than one filter.

```ts
source.contribute('app',     filterFromHeader(...));  // replaces the 'app' part
source.contribute('chips',   filterFromChips(...));   // replaces the 'chips' part
source.contribute('columns', ['and', ...clauses]);    // replaces the 'columns' part
// the source ANDs every contribution — last writer per KEY, not per filter
```

One key per **altitude**, which is exactly the three in "Every filter control IS
a query builder". Each writer owns its own key and cannot touch another's, so:

- the last-write-wins race disappears — `ignore` exists only to work around it
- a view stops hand-rolling `reapplyFilter()`; it contributes and forgets
- provenance survives to the edge, which is what `data-filter-fields` and a
  future "clear just the column filters" both want

**The evidence is stronger than it was.** When this was first written the count
was two altitudes on one screen. It is three, and the third is already in code:
the app header emits `quick-filter-change` and `dashboard.js:212` listens for
it. Any screen with a header, a toolbar and a grid has all three.

**Still held, but for a smaller reason:** no single screen composes all three
yet. `records.js` does view + column; `dashboard.js` does app alone. Build the
screen that does all three — or rewire `dashboard.js` (step 14a), which will —
and if it writes the same composition by hand, build contributions. That is a
near-term trigger, not a distant one.

### The precedent is already in the repo

[`render-view.ts:120`](../src/core/render-view.ts#L120) already implements exactly this
shape: a `StateStore` where a write at a JSON pointer re-runs **every subscriber whose
pointer overlaps**, and `renderView` binds `$state` references to `populate()`
reactively. The fan-out model is proven here; `DataSource` is that idea applied to
records rather than to a view blob, and the two should share the mechanism rather than
grow a second one.

---

# Part 2.5 — state ownership and parity

**Every value has exactly one owner. Everything else reads it.**

**Anything a person can do by clicking, a caller can do by calling.**

This is the whole model. The bugs above all came from a value being owned in one
place and derived in another, so the two disagreed and whichever ran last won.

## The three roles

| Role | Holds the value? | Writes it? | Reads it? |
|---|---|---|---|
| **Owner** | yes | yes | yes |
| **Reporter** | no | never — it emits an INTENT | yes, to draw itself |
| **Observer** | no | no | yes, to draw itself |

A component is a **reporter** for anything a host might also control, and an
**owner** only of what nothing outside it can see. A grid owns its scroll
position; it reports its sort.

The trap is the middle case: a component that DERIVES a value it does not own.
The quick-filter chip works out `data-current` from its menu's ticked rows —
correct when the chip owns the filter, wrong the moment a grid does. Deriving is
owning in disguise.

## The four primitives this needs

All four exist now, built during the column-filter work. They are small, and
they generalise — none is specific to filters.

### 1. `data-locked` — "this state is not yours to set"

On the component. It reports the interaction and draws whatever the host chose,
but never flips itself.

```html
<sherpa-quick-filter data-locked>   <!-- the grid sets data-current -->
```

Without it the chip fought its host on every commit. With it the chip is a
reporter, and one attribute says so.

**Generalise to:** any component with a derived visual state. `data-locked`
should mean the same thing on every one of them — *report, never set* — and
`SherpaElement` should own the check rather than each component re-writing it.

### 2. `ignore` — "this view owns this event"

On the bind, not the component:

```ts
source.bind(qft,  { steerOnly: true, ignore: ['quick-filter-change'] });
source.bind(grid, { ignore: ['filter-change'] });
```

`readonly` was all-or-nothing and too blunt: the toolbar still had to steer
`sort-change` and `group-change`. Naming the one event a view has taken over
leaves the rest working.

An ignored event gets **no listener at all**, rather than a listener that
returns early — so a view that owns an event owns it outright, with no chance
of the source having already acted by the time the view's handler runs.

### 3. Suspend ≠ clear

Two different gestures that looked like one:

| Gesture | Meaning | What survives |
|---|---|---|
| toggle a chip off | stop APPLYING this | the clause, the typed value, the menu |
| Remove | I am done with this | nothing |

`suspendColumnFilter(field, on?)` keeps the value and stops applying it;
`clearColumnFilter(field?)` deletes it. Collapsing them cost a reader their
typed text every time they toggled a chip.

**Generalise to:** every filter, every sort, every grouping. "Off" and "gone"
are different states, and a control that offers both needs both verbs.

### 4. A read-back door

`columnClause(field)` returns what a column is SET to, suspended or not. A host
that suspended a value needs to put it back without asking the user to retype
it.

Any owner needs this: **set, read back, suspend, clear.** Four verbs, and the
read-back is the one that keeps getting forgotten.

## Parity: anything a person can do, a caller can do

**Every interaction has a programmatic equal.** If a reader can do it by
clicking, a script can do it by calling — and the two go through the SAME code,
not two paths that drift.

This is not a nice-to-have. Three reasons it is structural:

1. **Tests.** Driving a component through its own API is the only way to test
   it without simulating pointer events against a shadow root two levels down.
2. **Hosts.** A saved view, a deep link, a "clear all" button — every one of
   them needs to set state the user would otherwise click for.
3. **Agents.** An agent cannot click. If the only way to filter a column is to
   open a menu and type, the component is unusable to anything that is not a
   person with a mouse.

### The shape

For each concern a component owns, there are four verbs. They are the same four
from "a read-back door" above — this is why they matter:

| Verb | Person does | Caller does |
|---|---|---|
| **set** | types a value, picks a day | `data-*` attribute, or a method |
| **read** | sees it on screen | a getter — `columnClause(field)` |
| **suspend** | toggles the chip off | `suspendColumnFilter(field)` |
| **clear** | clicks Remove | `clearColumnFilter(field)` |

…and one more that is easy to forget:

| **open** | clicks the control | `openColumnFilter(field, anchor)` |

`openColumnFilter` exists because the toolbar chip has to open the grid's menu,
and it happens to be exactly what an agent needs to say "show me the filter for
this column". Parity and composition want the same method.

### Where the grid stands today

| Concern | Set | Read | Suspend | Clear | Open |
|---|---|---|---|---|---|
| column filter | menu only ⚠️ | `columnClause()` | `suspendColumnFilter()` | `clearColumnFilter()` | `openColumnFilter()` |
| sort | `data-sort-field` ✅ | attribute ✅ | third click ⚠️ | remove the attribute ✅ | n/a |
| group | `data-group-field` ✅ | attribute ✅ | — | remove the attribute ✅ | n/a |
| selection | ⚠️ none | `selection-change` detail | — | ⚠️ none | n/a |

Two real gaps, both worth closing:

- **A column filter can only be SET through its menu.** There is no
  `setColumnFilter(field, clause)`. A saved view cannot restore one, and an
  agent cannot apply one at all. This is the clearest missing piece in the
  model.
- **Selection has no programmatic door.** A "select all matching" action has
  nowhere to go.

### The MCP tier — the same door, further out

The MCP server already exposes component CONTRACTS (`get_component`,
`explain_token`, `audit_component`). The natural next tier is component
INSTANCES: an agent driving a live screen the way a host does.

That tier is only buildable if the layer below it is complete. An MCP tool for
"filter this column" is a thin wrapper over `setColumnFilter()` — and impossible
without it. **So parity is the prerequisite, not the feature.**

The rule to hold while building the rest of this plan:

> Before shipping a component interaction, ask what a caller with no pointer
> would type to do the same thing. If there is no answer, the interaction is
> not finished.

---

## Reuse — one implementation, not five

Will, 2026-09-16: *"I don't want to have 5 different implementations of the same
handling of data, events, or state. Even styling, naming conventions, and
schemas should conform and align where possible."*

This is the constraint the rest of the plan serves. Everything above — one
owner, one query tree, one vocabulary — is the same instruction at different
altitudes.

### The test for a second implementation

A second copy is almost never introduced on purpose. It arrives as *"this one is
slightly different"*, and the tell is always one of these:

| Smell | What it really means |
|---|---|
| a test that checks two things MATCH | there should be one thing |
| a comment saying "must stay in step with X" | it will not |
| a translation table between two vocabularies | one of them is redundant |
| the same four strings in two files | a shared constant is missing |

All four were present in this codebase on 2026-09-16, in the same place.

### Found and fixed, as the worked example

**The sort glyphs.** `sherpa-data-grid` held `static icons` and
`sherpa-quick-filter-toolbar` held `static #icons`, each with its own copy of
the same four Font Awesome strings — plus a comment reading *"must stay in step
with sherpa-data-grid's own map; a spec guards the pair"*, plus a spec that
hardcoded the values and never read the toolbar's copy at all. Two copies, a
warning, and a guard that could not guard.

→ One `ORGANISE_ICONS` in `core/icons.ts`; both import it. The spec now asserts
**identity** (same object) and reads the glyph each component actually paints.

**The operator vocabulary.** `FilterOp` in the store, six `<option>`s hardcoded
in the grid's text filter, six more in its number filter, and an `OP_LABELS` map
in the grid's TypeScript. Four places, one vocabulary — and a Filter Panel would
have made a fifth.

→ `OP_LABELS` and `OPS_FOR_TYPE` now sit beside `FilterOp` in `core/store.ts`.
The `<select>` is empty in the template with one `<option>` as a cloning
prototype, and the grid stamps it from the shared maps. **The keys ARE the
operators**, so what a control reports is already a clause the store
understands.

**The toast's leave duration.** `const LEAVE_MS = 160` in the TypeScript, an
`animation: … 160ms` in the CSS, and a comment reading *"keep in step with
sherpa-toast-out"*. Two copies of one number, and a race if either moved — the
same shape as the fixed-`setTimeout` trap that `__settled()` exists to prevent
in tests.

→ CSS owns the duration; JS waits for `animationend`. The platform already knew
when the animation finished, so the number never needed a second home. A
generous fallback timer covers the case where the animation does not run at all
(`display: none`, reduced motion, a hidden tab) — that is a safety net, not a
duration.

**A pattern across all three:** each was a constant that belonged in one place
and had been copied to a second, with a comment or a test standing in for the
thing that should have been shared. **A comment asking two files to agree is a
missing import.**

### Where shared things live

| Kind | Home | Rule |
|---|---|---|
| query vocabulary — ops, labels, per-type lists | `core/store.ts`, beside `FilterOp` | the keys are the operators; no translation table |
| glyphs two or more components draw | `core/icons.ts` | one component's glyph stays in that component |
| element plumbing | `core/sherpa-element.ts` | the bar is 3+ real uses; see Part 1 |
| design tokens | `src/styles/tokens/` | projected from Figma; never hand-edited |
| naming | [`CLAUDE.md`](../CLAUDE.md) | `data-*` API, unprefixed `noun-verb` events |

### Reuse of CONTROLS, not just constants

The bigger win, and the one the Filter Panel depends on. A column filter menu is
already built from parts that existed:

| Part | Reused from |
|---|---|
| the popover, its placement, its Apply/Cancel/Remove footer | `sherpa-menu` |
| the button that opens it | `sherpa-quick-filter`, `data-icon-only` |
| the range switch | `sherpa-switch` |
| the two-ended numeric range | `sherpa-slider` |
| the date picker | `sherpa-calendar`, `data-embedded` |
| the operator picker | a native `<select>` + the shared vocabulary |

**The only new code was the arithmetic**: which clause, which field, how to
compose. That is the shape every new query surface should have — if a Filter
Panel needs a second calendar or a second popover, something has gone wrong.

### What this costs, and why it is still right

A shared thing is harder to change: `ORGANISE_ICONS` cannot be tweaked for one
component without moving both. That is the point. When two surfaces genuinely
need to differ, the answer is a **variant on the shared thing**
(`data-icon-only`, `data-plain`, `data-locked`) — not a second implementation.
Every one of those attributes exists because a component needed to look or
behave differently while staying the same component.

---

## The naming convention this implies

The sort link works because it already follows one. Generalise it:

| Shape | Direction | Meaning |
|---|---|---|
| `data-<thing>` | host → component | the VALUE. The component draws it. |
| `<thing>-change` | component → host | the INTENT. "The user asked for this." |
| `data-<thing>-locked` | host → component | the host owns it; report, never set |

An event is a **request**, not a notification of a change already made. That
distinction is what makes one column sortable at a time without a coordinator:
the grid asks, the host decides, the host writes `data-sort-field` back, and
every bound component re-draws from the one value.

The grid ⇄ toolbar sort link is ~20 lines because the source was ALREADY
writing `data-sort-field`. The filter link took a day because it was not.

## Where the platform already does this

Worth saying plainly, because it is the cornerstone and it keeps paying:

| Platform thing | What it gives free |
|---|---|
| attribute + `observedAttributes` | the value, its change hook, and DevTools visibility |
| `CustomEvent` + `composed` | the intent crossing shadow boundaries, with no bus |
| CSS attribute selectors | every visual state, with no JS branch |
| `:has()` / `:not()` | derived visual state, still with no JS branch |
| `ElementInternals` | form participation, validity, ARIA — see Part 3 |

**Both states in the DOM, CSS picks.** The number filter's single field and its
range slider both exist from the start; the Range switch writes `data-range` and
CSS reveals one. No rebuild, and whatever was typed on the other side survives
the flip. That pattern is worth applying everywhere a control has modes.

## Where the platform stops — and what to do instead

One honest limit, found the hard way:

**Custom properties inherit past their owner, and `@scope` does not stop that.**
`@scope (root) to (boundary)` limits which elements a rule MATCHES; it says
nothing about how far a value that rule sets then travels. A slotted menu is a
light-DOM child, so it inherited both the column's active tint and the button's
transparent surface.

Two fixes, in order of preference:

1. **Style the element you mean.** A real `background: transparent` on the
   caret, never a re-point of `--sherpa-style-surface-base` on the host. Never
   re-point a shared token to restyle one part of a component.
2. **Reset on something between.** `--_status-*: initial` on the chip, so the
   menu inherits the reset. A reset DOES inherit, which is why this works.

## What `SherpaElement` should absorb

The point of putting this in the base class is that every component gets it
without asking. Candidates, in order of how often they came up:

| Candidate | Why | Evidence |
|---|---|---|
| `data-locked` handling | 3 uses already; the check is 3 lines and the meaning must not vary | quick-filter, quick-filter-toolbar, data-grid |
| A `reports()` helper | the emit-an-intent half of the convention, so `noun-verb` naming cannot drift | every steering component |
| Suspend/clear as a pair | "off" vs "gone" was collapsed twice in one week | column filters, toolbar chips |
| Attribute↔property reflection | `static props` does content; STYLE and VISIBILITY kinds still need a typed JS door | `this.set()` exists, is barely used |

The bar is the same as elsewhere in this plan: **three or more real uses**, and
it must not make the simple case worse.

## What this does NOT mean

- **Not a store for component state.** A component's own internals stay its
  own. This is only about values a host might also care about.
- **Not a new event bus.** `DataSource extends EventTarget`; the platform is
  the bus.
- **Not a framework.** Four attributes and a naming rule. If it grows a fifth
  primitive, that is evidence the model is wrong, not that it needs more parts.

---

## What shrinks — and what has NOT yet

Written before the core shipped, as a prediction. Re-measured 2026-09-16, and
**both files grew**:

| File | Predicted | Actually now | Why it grew |
|---|---|---|---|
| `examples/views/records.js` | 371 → smaller | **517 lines** | the hand-wired pipeline DID go; column filters, the toolbar hand-off and the composition of two filter altitudes came in |
| `sherpa-data-grid.ts` | 714 → smaller | **1727 lines** | column filters, the sort chip, match marking — capability, not plumbing |

**This is not a failed prediction so much as an unfinished one.** The shrink was
contingent on step 15 — "move grid sort/filter onto the source" — which has not
been done: `#sortRows` and `#filteredRows` are still in `sherpa-data-grid`,
alongside the source that could own them.

**So the same job has TWO implementations**, and which one runs depends on
whether the grid happens to be bound to a source. That is precisely the
duplication this plan exists to remove — one solution, or it is not a layer.

`records.js` also still builds filter options by hand (`valuesOf`, 2 uses) — a
store can derive those from the data.

**Honest reading:** the layer has so far ADDED capability without REMOVING the
older paths. Steps 15 and the `valuesOf` derivation are what close that, and
they should not be dropped quietly — a data layer that only adds is a second
implementation, which is the thing "Reuse — one implementation, not five"
argues against.

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
| **9** ✅ | `Store` + `ArrayStore` + `DataSource` | **DONE** — the core |
| **9a** ✅ | **`bind()` — two-way, many components per source** | **DONE** — plus `steerOnly`, `as`, `readonly`, and `ignore` (2026-09-16) |
| 10 | **V5** validate on the store | a bad response or `insert` must not reach the UI |
| 11 | `JsonStore`, `RestStore`, `LocalStore` | remote + persistence |
| 12 | **V3 + V4** `formAssociated` + `data-rules` | the form half; independent of 9–11 |
| 13 | **V6** ARIA wiring | `aria-invalid` + `aria-describedby` (NOT `role="alert"` per field) |
| **14** ✅ | Rewire `records.js` | **DONE** — one source steering grid + toolbar + pager |
| 14a | Rewire `dashboard.js` | proves ONE filter fanning out to 11 visualisations |
| 15 | Move grid sort/filter onto the source | **RAISED 2026-09-16.** The grid still holds `#sortRows` + `#filteredRows` beside a source that could own them, so it sorts in two places depending on whether it is bound. That is the duplication this plan exists to remove — see "What shrinks — and what has NOT yet" |

Validation is interleaved, not appended: V1–V2 must precede the store work that uses
them (step 10), while the form half (12–13) is independent and can run in parallel.

## The layer runs on the SERVER — verified, and it changes the goal

Will, 2026-09-16: *the data layer should bridge client and server. We need the
ability to use data layer components server side too, to allow all of the same
operations and mutations that happen client side. This also opens up any Sherpa
app to be run headless by APIs or agents using MCP.*

**Tested in plain Node 24, no DOM, no jsdom, no shim:**

```
typeof document === "undefined"

store.load()        → 25 of 500 rows, paged          ✅
setFilter()         → 333 matched                    ✅
setSort()           → top spend 9953                 ✅
store.insert()      → total 333 → 334, source updated ✅
filterRows / sortRows / applyOptions                 ✅
source.bind(plainObject)  → populate() called twice  ✅
```

**The entire layer already works headless.** Not a port, not a plan — it runs
today. Even `bind()` does: it needs only `populate` and `setAttribute`, so a
plain object stands in for a component.

### Why it already works

The pieces were built DOM-free for other reasons, and it adds up to this:

| Module | DOM refs | Note |
|---|---|---|
| `store.ts` | **0** | filter, sort, page, the whole query engine |
| `validate.ts` | **0** | rules and Standard Schema |
| `stores.ts` | 2 | `localStorage` in `LocalStore` only — guarded already |
| `data-source.ts` | 8 | all TYPES plus `CustomEvent`, which **Node has natively** |

`DataSource extends EventTarget` — a platform class Node ships. That decision was
made to avoid writing a subscriber list; it is also what makes the layer
portable.

### What this actually enables

Three things, in increasing order of interest:

1. **Server-side preparation** (Q3). A server imports `applyOptions` and answers
   a `LoadOptions` **identically to the browser** — same code, so no drift
   between what the client would have computed and what the server returns.
2. **Real isomorphism.** A screen can be rendered server-side, or its query run
   server-side and its rows sent down, with one implementation of "what does
   this view show".
3. **Headless Sherpa.** An app's data layer driven with no browser at all — by
   an HTTP API, a test, or an agent over MCP. Every operation and mutation is
   available because they are plain method calls on objects that need no DOM.

That last one connects to Part 2.5's parity rule: *anything a person can do by
clicking, a caller can do by calling.* Headless operation is that rule taken to
its conclusion — the caller need not even be in a browser.

### The real gap: nothing PROTECTS this

It works by happy accident. One `document.querySelector` in `store.ts` would
break it silently, and no test would notice.

| Step | Work | Why here |
|---|---|---|
| **N1** ✅ | A Node test that imports the layer and runs the operations above | **DONE 2026-09-16** — `test/unit/headless-data-layer.test.mjs`, run by `npm run test:node`. 5 tests: pure functions, store + source query and mutate, headless `bind()`, and a schema mapping an external shape. Proven to catch a regression: adding one `document.querySelector` to `store.js` fails it |
| **N2** | A lint rule: no DOM globals in `store.ts` / `validate.ts` / `data-source.ts` | states the boundary where it can be enforced, not just described |
| **N3** | Publish the layer as a separate entry point (`sherpa-ui/data`) | so a server imports it without pulling in `customElements`. `src/index.ts` currently registers every component on import |
| **N4** | An MCP tier that drives a headless source | needs N3 (a clean import) and P1–P3 (parity). The layer itself is ready |

**N1 and N2 are small and should come first.** The capability exists; what is
missing is anything stopping it being lost.

### What does NOT run headless, and should not

- **Components.** Custom elements need a DOM. Headless means the data layer, not
  the UI — `render-view.ts` and `sherpa-element.ts` are DOM-bound by nature.
- **`LocalStore`.** Web Storage is a browser thing. It already guards every
  access, so it degrades rather than throws, but a server should use a different
  store.

The split is clean and worth stating: **the query layer is portable, the
presentation layer is not.** That is the same Store / DataSource / component
separation this plan already draws, seen from a different angle.

## Next — the optimisations the fan-out needs

Measured 2026-09-16 against a real harness: six components bound to one source
over 500 rows, twenty filter writes. Each step below has a number behind it, not
a hunch.

### The measurement

**First figures were wrong — corrected 2026-09-16.** The original "667ms" was
the BENCHMARK's own `__settled()` waiting, not the layer. Re-measured as a burst
of twenty writes with one settle at the end, which is what a run of keystrokes
actually looks like:

| Rows | 20 changing writes | 20 IDENTICAL writes | |
|---|---|---|---|
| 500 | 34ms | 34ms → **34ms** | no measurable gain |
| 20,000 | 225ms | 167ms → **32ms** | **5× on the wasted case** |

At 500 rows the work was never the problem. At 20k it is, and the guards remove
it entirely — identical writes now cost what doing nothing costs.

The COUNTS are the clearer story, and they hold at any size:

| | Before | After |
|---|---|---|
| store loads, 20 identical writes | 20 | **2** |
| populates, 6 bound components | 120 | **0** |

A lesson worth keeping: **measure the thing, not the harness.** The first number
was 20× too large because the loop awaited a settle between every write.

Nothing here is a correctness bug — the layer works. These are the things that
will hurt once ONE filter fans out to eleven visualisations, which is the whole
point of the layer.

| Step | Work | Evidence | Size |
|---|---|---|---|
| **F1** ✅ | `DataSource` skips a load when the ViewState is UNCHANGED | **DONE 2026-09-16.** 20 identical writes → **2** store loads (was 20). Needed TWO checks, not one: the last COMPLETED key, and the key currently IN FLIGHT — a burst all fires before the first completes, so the completed key cannot stop it | small |
| **F2** ✅ | `#push` skips a component whose payload is IDENTICAL to its last | **DONE 2026-09-16.** 120 populates → **0**. Guards on the ROWS ARRAY, not the adapted payload: `applyOptions` returns a new array per load, while an `as` adapter builds a new object every call and would never match | small |
| **F3** ✅ | Coalesce writes within a tick | **DONE 2026-09-16.** Three setters in one handler → **1** load, not 3. A MICROTASK, in `#schedule()`, which the six setters call instead of `load()` — `load()` itself stays immediate, because a caller that awaits it means it | small |
| **F4** ✅ | ONE shared chart datum type | **DONE 2026-09-16.** `ChartDatum` + `LegendDatum` in `core/chart-datum.ts`; the three old names are now aliases, so no call site changed. Deleted TWO self-copying `.map()`s from `dashboard.js` — a chart and its legend share one array now |
| **F5** | A datum vocabulary for `as` adapters | 18 different `populate()` shapes across 22 components, so nearly every bind needs a hand-written adapter | medium — needs the F4 survey first |
| **F6** ✅ | Bind LIFETIME — answer 1 | **DONE 2026-09-16.** `records.js` now collects its three unbind functions and returns a teardown; the router already called one. Verified: `boundElements` 3 → 0. Answer 2 (auto-drop on disconnect) still open | small |

**F1 and F2 together** are the ones that matter: they turn "nothing changed"
from full cost into near-zero, which is exactly the shape a filter keystroke has.

### What F3 does and does NOT merge — stated, because it is a limit

A microtask waits for the current synchronous run and no longer:

| | Loads before | after |
|---|---|---|
| three setters in ONE handler | 3 | **1** |
| six keystrokes, 40ms apart | 6 | **6** |

**Typing is deliberately not merged.** Merging across ticks is a debounce, and a
debounce is a policy about how fast people type — the caller's to choose, not
this layer's to impose. A view that wants one can wrap its own input handler;
nothing here stops it.

F1 cannot help with typing either, because every keystroke is a DIFFERENT
question. What protects a large collection from a fast typist is server-side
paging (Q3) or a caller's debounce, not this.

### F1 and F2 in more detail

Both are **guards, not caches**. Nothing is stored that can go stale:

```ts
// F1 — in load()
const key = JSON.stringify(this.#state);
if (key === this.#lastLoadKey && !force) return this.#result;

// F2 — in #push(el)
const payload = adapt ? adapt(rows, this) : rows;
if (payload === this.#lastPushed.get(el)) return;   // identity, not deep-equal
this.#lastPushed.set(el, payload);
```

Two traps to write into the implementation:

- **`force` must exist.** A re-query after an `insert` has the same ViewState
  and a different answer. `load({ force: true })` is how the store's own change
  events already arrive; F1 must not swallow those.
- **F2 compares by IDENTITY, not deep equality.** An `as` adapter that builds a
  new array every call defeats it — which is a reason to prefer adapters that
  return the same reference when nothing changed, and an argument for F4/F5
  (a shared shape needs no adapter at all).

### F6 — who ends a bind

`bind()` already returns an unbind function and `unbind(el)` is public. Nothing
calls either. In an SPA that swaps views, the source keeps every component it
was ever given.

Two candidate answers, and the second is probably right:

1. **The view returns a teardown.** `records.js` collects the unbind functions
   and returns one that calls them; the router already expects a cleanup and
   discards nothing. Explicit, and it works today.
2. **The bind ends when the element leaves the DOM.** A `DataSource` could stop
   pushing to a component whose `isConnected` is false, and drop it. This is
   the platform's own answer to lifetime and needs no discipline from the
   caller.

Answer 2 has a trap worth stating before building it: a component MOVED in the
DOM is briefly disconnected, so dropping on the first disconnect would break a
legitimate re-parent. The honest version skips pushing to a disconnected
element and drops it only when a later push finds it still detached — or uses
the platform's `WeakRef`/`FinalizationRegistry`, which is the right tool and
the harder one to test.

**1 is done** (2026-09-16) — five lines in the view, and the leak is closed.
**Consider 2** when a second app hits the same thing; until then a view
returning its own teardown is the honest contract and the router already
expects it.

### Why F4 is a reuse fix first

```ts
export interface BarDatum   { label: string; value: number; colorIndex?: number }
export interface DonutSlice { label: string; value: number; colorIndex?: number }
export interface LegendItem { label: string; value?: string | number; colorIndex?: number; … }
```

Three names, one shape — and a legend sits BESIDE a chart showing the same data,
so crossing between them should be free. It is not: `dashboard.js:157` writes
`.map((d) => ({ label: d.label, value: d.value, colorIndex: d.colorIndex }))`,
a copy of a shape to itself.

One `ChartDatum` in `core/`, with `LegendItem` extending it, removes that map,
removes two type names, and lets F2's identity check actually hold when a chart
and its legend share one array.

---

## Scope: what lives at which level

Will asked 2026-09-16: *one store per view? per view INSTANCE (new tab, new
window)? or is view too high — should it be per component?*

**Both, and the split already exists** — it is the `Store` / `DataSource`
separation in Part 2, which answers different halves of the question.

### The whole model, in one table

Three levels, three kinds of thing, and **they do not line up one-to-one**:

| | **Session (app)** | **View** | **Component** |
|---|---|---|---|
| **`Store`** (records) | ✅ **lives here** — one per collection | rarely — only data no other view will want | ❌ never |
| **`DataSource`** (a query) | ❌ never — "the app's filter" is not a thing | ✅ **lives here** — one per QUERY | ❌ **never** |
| **session store** (singletons) | ✅ **lives here** — theme, user, route | ❌ | ❌ |
| **its own fields** | — | — | ✅ column widths, folds, scroll |

The two ❌ **never**s are the load-bearing ones:

**A component never owns a `DataSource`.** A grid that owns its source cannot be
steered by a toolbar — which is the capability this layer exists for — and it
would own AND report its own view state, the "deriving is owning in disguise"
trap from Part 2.5. `sherpa-data-grid` and `sherpa-quick-filter-toolbar` mention
`DataSource` only in comments; neither imports it. **Protect that.**

**A component never owns a `Store`.** Same reason, plus: records it fetched
itself are invisible to the rest of the app, so an edit elsewhere never reaches
it.

What a component DOES own is its own fields — column widths, which groups are
folded, scroll position. No store needed; that is the "Owner" role in Part 2.5.

### So: is a Store per view case-by-case?

**Mostly no.** The default is app-level, one per COLLECTION — not per view, and
not per component:

- **Records:** nobody would be surprised if two views shared them. Two views
  showing customers should show the SAME customers, and an edit in one should
  reach the other. A store per view means two copies of the truth.
- **View state:** everybody would be surprised. A filter set on Records has no
  business narrowing a dashboard. That is the whole reason `DataSource` is
  separate.

The case-by-case part is only **which collections exist**, not which level they
live at. A screen showing customers and invoices needs two stores because there
are two collections — both still app-level, both usable by any view.

The genuine exception is data no other view will ever want: a one-off lookup
list, a wizard's scratch rows. Keeping that at view level is fine, and the test
is the same question — *would anything outside be surprised if this were
shared?*

### One source per QUERY, not per view

"View level" is the right default because most views ask one question. It is the
wrong RULE, because some ask two:

| Screen | Sources | Why |
|---|---|---|
| Records | 1 | grid + toolbar + pager are three views of one query |
| Master/detail | 2 | the list's filter and the detail's are different questions |
| Dashboard | 1 | the point is ONE filter fanning out to eleven charts |
| A comparison — "this region vs that" | 2 | two queries, deliberately |

Both master/detail sources still live at the **view**, because only the view
knows they are related — see "Can a view-level store reference a component-level
one?" below.

### Today the example gets this wrong

`records.js` builds BOTH inside `init()`:

```js
const store  = new ArrayStore(customers, { key: 'email' });   // ← should outlive the view
const source = new DataSource({ store, pageSize: 25 });       // ← correct at view level
```

So leaving Records and coming back **rebuilds all 100 records and loses every
filter, sort and page**. Fine for a demo with generated data; wrong the moment
the records come from a server, where it is a re-fetch of data the app already
had.

The fix is not a new mechanism — it is moving one line out of `init()` into a
module the views import. **Queued as S1 below.**

### Can a view-level store reference a component-level one?

Will asked this next, and the honest answer is **no — and the question is the
valuable part**, because the thing it reaches for is real.

**A component must not own a `Store` or a `DataSource`.** Two reasons, and the
second is the one that bites:

1. **It cannot then be steered.** A grid that owns its source cannot share a
   sort with a toolbar, which is the capability this whole layer exists for.
2. **It makes the ownership question unanswerable.** Part 2.5 says every value
   has one owner. A component holding a source owns its own view state AND
   reports it, which is the "deriving is owning in disguise" trap that produced
   four of last week's five bugs.

Components already prove they do not need one: `sherpa-data-grid` and
`sherpa-quick-filter-toolbar` mention `DataSource` only in comments. Neither
imports it. **That is a property worth protecting, not an accident.**

#### What the question is really reaching for

Two different needs, both real, neither needing a component-level store:

**1. A component's OWN state that nobody else cares about.**

Column widths, which groups are folded, scroll position. A component owns
these outright — that is the "Owner" role in Part 2.5, and it needs no store,
only fields. The test is "would anything outside be surprised if this were
shared?" If no, it is not view state.

**2. A component that shows DIFFERENT records from the rest of the screen.**

The real case: a grid over customers, and a detail panel over that customer's
INVOICES. Two collections, so two stores — but the panel still must not own
one.

The answer is the layer already has: **the view holds both, and wires them.**

```js
// view level — the view owns both, because only it knows they are related
const customers = new DataSource({ store: customerStore });
const invoices  = new DataSource({ store: invoiceStore });

customers.bind(grid);
invoices.bind(panel);

// the RELATIONSHIP is a subscription, not a reference between stores
grid.addEventListener('row-click', (e) => {
  invoices.setFilter(['customerId', 'eq', e.detail.row.id]);
});
```

Three lines, and every rule holds: the grid reports an intent, the view decides
what it means, the panel is fed. Neither source knows the other exists.

#### Why not a reference between them

A `DataSource` holding another would make the dependency implicit and
bidirectional-by-accident — exactly the shape that produced the last-write-wins
race `ignore` is currently patching. **Relationships between queries belong to
whoever can see both**, which is the same rule that decides filter composition
(Part 2, "Three altitudes"). It is one principle, not two.

If a master/detail pairing turns out to be common enough to deserve sugar, the
honest form is a **helper on the view**, not a link inside the layer:

```js
follow(grid, 'row-click', invoices, (row) => ['customerId', 'eq', row.id]);
```

**Not yet.** One hypothetical screen is not evidence — the same bar O5 is held
to.

### Multiple external data sources, one `DataSource`

Will, 2026-09-16: *"there will often be the possibility that multiple external
data sources are in play. So how do we work with those in the single
DataSource paradigm?"*

The short answer: **they never meet the `DataSource`.** Plurality is resolved in
the `Store` layer beneath it, so the source keeps holding exactly one query.

What must NOT happen is combining unrelated feeds into one `DataSource` — that
would mean one filter/sort/page over rows that do not share a question, which is
a category error, not a shortcut.

### The principle, before the examples

Multiple external data sources are the NORMAL case, not an exception. A list of
scenarios will always be incomplete, so the layer needs a rule that decides any
of them.

**The rule: "multiple sources" is a fact about the BACKEND. `DataSource` is
about the QUERY. They are different layers, and the join between them is
always a `Store`.**

```
  many backends ──→ Store(s) ──→ ONE DataSource per query ──→ components
       ^                ^                    ^
   REST · socket    where plurality      where the USER's
   SSE · array       is resolved          question lives
```

Three consequences, and they settle every case including ones nobody has
thought of yet:

**1. Plurality is resolved BELOW the source, not above it.**
`Store` is an interface, not a base class — anything answering `load` / `byKey`
/ `insert` IS one. So a store can wrap other stores: join two, merge many, fan
one out. The `DataSource` above it never learns there was more than one, which
is exactly what keeps one filter tree, one sort and one page correct.

`live-stores.ts` already proves the shape: a `SocketStore` wraps an inner
`ArrayStore` and re-dispatches its `change`, so *"a DataSource listens to one
thing and never learns there are two"* — that comment is the whole principle,
written before it was named.

**2. One source per QUESTION the user asks, whatever feeds it.**
If a reader would say "filter THIS" and mean all of it, it is one query and one
source — however many backends are behind it. If they would filter two things
separately, that is two questions, two sources, and a relationship wired by
whoever can see both (Part 2.5).

**3. When a component shows several things at once, each source owns a NAMED
PART.** Not a merged payload, not last-write-wins: `into` (step S7). That is
the Part 2.5 ownership rule applied to a payload, and it is the same answer
whether the parts are two counts, two chart series, or something not imagined
yet.

### The decision, in one question

> **Is it ONE row, or things sitting BESIDE each other?**

| | Where plurality is handled | Build |
|---|---|---|
| **one row, merged from several backends** | a joining **`Store`** under one source | `JoinStore` (S8, deferred) |
| **things beside each other** | several **binds**, each owning a named part | `into` (S7) |
| **many feeds into one list** | one inner store, many connections | `into` on `LiveStore` (S9) |
| **not rows at all** (config, labels) | not the data layer — attributes | — |

Everything else is one of those four wearing different clothes.

### The examples that produced the rule

Not exhaustive — illustrations of each branch. The rule above decides cases not
listed here.

#### 1. Several series of the SAME shape — one source, one adapter

A line chart with three lines, a barchart grouped by region. This is **one
query**: same collection, same filter, split on a field.

```js
source.bind(lineChart, {
  as: (rows) => ({
    labels: months(rows),
    series: groupBy(rows, 'region').map(toSeries),   // the split is the ADAPTER's job
  }),
});
```

One `DataSource`, because there is one question. The adapter does the shaping —
which is exactly what `as` is for.

#### 2. Parts that are NOT rows — attributes, not a second source

`sherpa-app-header` takes `{ breadcrumb, filters }`. Neither is a query result;
they are configuration. A source pushes ROWS, so config arrives the way it
always has — from the view, at build time, or as attributes.

**Do not invent a source to deliver something that is not a query.**

#### 3. Genuinely different collections — several binds, one component

A summary panel showing "12 customers, 40 open invoices". Two collections, two
queries, so two sources — and the component is bound to both:

```js
customers.bind(panel, { as: (rows) => ({ slot: 'customers', count: rows.length }) });
invoices.bind(panel,  { as: (rows) => ({ slot: 'invoices',  count: rows.length }) });
```

Nothing forbids binding one component to two sources today — `bind()` is
per-source, and each keeps its own entry. What is MISSING is a way for the
component to tell the two payloads apart. Two options, and the second is
better:

| | |
|---|---|
| **Tag the payload** (above) | works now, but every multi-source component invents its own tag |
| **Bind to a SLOT** — `source.bind(panel, { into: 'customers' })` | the source writes one named part; the component merges by name |

`into` is the smaller idea: it says "this source owns this part of your data",
which is the Part 2.5 ownership rule applied to a payload. It also makes F2
(skip-if-unchanged) work per part rather than per component.

**The summary panel above is hypothetical — but `into` is not held on its
account.** Two other cases below need the same idea: a chart with one series per
backend (case 5) and several sockets feeding one feed (case 6, where the socket
work is already on this branch). Three uses is over the bar, so **S7 is a DO**,
and the panel is simply the least urgent of the three.

#### 4. ONE row, columns from TWO backends — a joining STORE

Will's case, 2026-09-16: a grid whose columns come from two different databases.
This is the hard one, and it is **not** the same as case 3.

Case 3 was two payloads sitting side by side. Here every ROW is a merge:
`{ id, name }` from one backend and `{ id, spend }` from another, shown as one
row with three columns. A filter on `spend` and a sort on `name` must work
across the seam.

**Two sources cannot do this.** A source owns a query, and there is one
question here — "the customers, with their spend" — not two. Tagging payloads
would leave the grid holding two half-rows and no way to sort them together.

**The join belongs in a `Store`.** `Store` is an interface, not a base class:
anything answering `load` / `byKey` / `insert` / … IS one. So a store can wrap
other stores.

```ts
const enriched = new JoinStore({
  left:  customerStore,          // { id, name }
  right: spendStore,             // { customerId, spend }
  on:    (c, s) => c.id === s.customerId,
  merge: (c, s) => ({ ...c, spend: s?.spend ?? null }),
});

new DataSource({ store: enriched }).bind(grid);   // one query, as usual
```

Everything above the store is unchanged: **one `DataSource`, one filter tree,
one sort** — the grid, the toolbar and the pager cannot tell the rows came from
two places, which is the point.

**Three things a `JoinStore` must decide, and they are why this is deferred:**

| Question | Why it is hard |
|---|---|
| Where does filtering happen? | A filter on a LEFT field can narrow before fetching the right side. One on a RIGHT field cannot — it has to fetch, join, then filter, and `total` is only known afterwards |
| Where does paging happen? | Page-then-join is fast and can return short pages when the join drops rows. Join-then-page is correct and fetches everything |
| What does a missing match mean? | An inner join hides rows; a left join shows them with nulls. Both are right, for different screens — so it is an option, not a default |

None of those can be answered without a real backend pair in front of you, and
answering them wrong is worse than not having the store: a grid quietly showing
the wrong `total`, or a page with four rows on it.

**This works TODAY — verified 2026-09-16.** `Store` is an interface, so a
joining store is a plain object; no class, no base, no new layer:

```js
const joined = {
  async load(options = {}) {
    const L = (await people.load()).rows;
    const R = (await spend.load()).rows;
    const merged = L.map(l => ({ ...l, spend: R.find(r => r.pid === l.id)?.spend ?? null }));
    return applyOptions(merged, options);   // filter/sort/page the MERGED rows
  },
  addEventListener() {}, removeEventListener() {},
};
new DataSource({ store: joined }).bind(grid);
```

Measured: filtering on `spend` (the RIGHT backend's field) and sorting on `name`
(the LEFT's) both work, through one `DataSource`, with the components unaware.
`applyOptions` — the same function `ArrayStore` uses — does the work.

So **S8 is not a missing capability.** It is sugar over a pattern that already
holds, plus answers to the three questions below. That lowers its priority and
raises confidence the shape is right.

**Two cheaper answers that usually suffice**, and should be tried first:

1. **Join on the server.** One endpoint returning the merged shape. A
   `RestStore` then sees one collection and none of this arises. This is almost
   always the right answer when both backends are yours.
2. **Join in the view, once.** Fetch both, merge into one array, hand it to an
   `ArrayStore`. Fine for hundreds of rows; wrong for thousands, and it gives up
   server-side paging.

| Step | Work | Why here |
|---|---|---|
| **S8** | `JoinStore` — SUGAR over a pattern that already works | verified 2026-09-16: a ~10-line plain object answering `load()` joins two stores and serves one `DataSource`, filter and sort intact. A class would add push-down, paging and join-type options | **DEFERRED, and cheaper than thought** — hand-write the object until a second screen needs one; then build the class with the three answers below |

#### 5. A CHART with one series per source — several binds, no join

Will, 2026-09-16. Easier than case 4, and worth separating from it.

A line chart showing "our revenue" and "market average" from two backends does
**not** need a join. The series sit side by side on a shared x-axis; no row is
merged with another.

So the shape is case 3 (several binds, one component) with a named part per
series:

```js
ours.bind(chart,   { into: 'series.0', as: (r) => toSeries(r, 'Ours') });
market.bind(chart, { into: 'series.1', as: (r) => toSeries(r, 'Market') });
```

The component's payload already supports it —
`LineData { labels?, series: Array<number[] | Series> }` is a LIST of series,
so each source owning one entry fits the existing shape with no change.

**Two things this needs, and only the second is new:**

1. **`into`** (step S7) — so each source owns one part rather than the last
   write replacing the whole payload. Without it the two sources clobber each
   other, which is the same last-write-wins problem `ignore` patches elsewhere.
2. **Agreeing on the x-axis.** Two sources returning different date ranges give
   two series of different lengths against one `labels` array. That is the
   view's problem to solve, not the layer's — align or pad before handing over,
   the same way the composition in Part 2.5 belongs to whoever can see both.

**A join is only needed when a ROW is a merge.** A chart series is not: it is a
whole column of numbers that happens to be drawn next to another.

#### 6. A FEED from several sockets — one inner store, many connections

Will, 2026-09-16: a list fed by various sockets.

Partly solved already. `SocketStore` and `EventStore` in
[`live-stores.ts`](../src/core/live-stores.ts) each wrap an inner `ArrayStore`
and push `insert` / `update` / `remove` messages into it, re-dispatching its
`change` so a `DataSource` "listens to one thing and never learns there are
two".

**One socket into one list works today. Several do not** — each `LiveStore`
constructs its OWN inner `ArrayStore`:

```ts
this.inner = new ArrayStore(options.rows ?? [], options);
```

Three sockets means three separate lists, three sources, three components. A
single merged feed cannot be built.

**The fix is small and already implied by the design:** let a `LiveStore` take
an inner store instead of always making one.

```ts
const feed = new ArrayStore([], { key: 'id' });          // ONE list

new SocketStore({ url: alertsUrl,  into: feed });        // three connections…
new SocketStore({ url: buildsUrl,  into: feed });
new EventStore({  url: deploysUrl, into: feed });

new DataSource({ store: feed }).bind(list);              // …one query, one component
```

Everything else already works: the inner store's `change` event drives the
fan-out, the `key` de-duplicates across connections, and the `DataSource` sorts
and filters the merged feed exactly as it would one collection.

**Two things to decide when building it:**

| Question | Note |
|---|---|
| A cap — a feed grows forever | `ArrayStore` has no ceiling. A long-running feed needs `maxRows` with oldest-out, or the tab dies. This is the one genuinely new piece |
| Provenance — "which socket sent this?" | Not the store's job. A message that needs a source label carries one as a FIELD, which the list then shows like any other column |

| Step | Work | Why here |
|---|---|---|
| **S9** | `LiveStore` accepts an inner store (`into`) instead of always creating one | several sockets into ONE feed is impossible today; each live store makes its own `ArrayStore`. Small change, no new concept — the re-dispatch already treats inner and outer as one | **DO** — the socket work is on this branch already |
| **S10** | `maxRows` on `ArrayStore`, oldest-out | a live feed grows without bound; the only genuinely new piece S9 needs | with S9 |

#### What stays true in every case

- **The component never owns a source.** It is bound, once or twice; it does not
  create one.
- **One source = one query.** If two payloads cannot share a filter, they cannot
  share a source.
- **The adapter shapes; it does not fetch.** An `as` that reaches for data of
  its own has become a second source in disguise.

| Step | Work | Why here |
|---|---|---|
| **S7** | `bind(el, { into: 'name' })` — a source owns one NAMED part of a component's payload | THREE cases need it: a summary panel (case 3), a chart with one series per backend (case 5), and a multi-socket feed (case 6, already on this branch). Without it the last write replaces the whole payload — the same last-write-wins problem `ignore` patches elsewhere. Also lets F2 skip per part | **DO** — over the 3-use bar |

### Schemas as the ADAPTER for an external source

Will, 2026-09-16: *use schemas for external data sources so we know how to map
and translate them into the generic store. A new source needs a schema; the
consumer of Sherpa can provide it.*

This is the missing half of the store layer, and the mechanism is already
chosen.

#### What exists, and what does not

`StoreOptions.schema` takes a **Standard Schema** — the cross-library interface
Zod, Valibot and ArkType all implement, duck-typed so it adds no dependency
(Part 3). Every store already:

- checks `insert` and `update` against it, THROWING on failure
- records the schema's **parsed** value, because a schema may coerce (`"42"` →
  `42`) and the store should keep what the schema settled on

**What is missing is the other direction.** `load()` is not checked at all —
verified 2026-09-16: `this.check()` is called from `insert` and `update` in
every store and from `load` in none. So rows arriving from a REST endpoint, a
socket or a JSON file reach the components exactly as the backend sent them:

- a date as an ISO string that should be a `Temporal.PlainDate`
- a number as `"1234.50"`, which then sorts lexically — `"100"` below `"9"`, the
  same trap the column filter had to coerce around by hand
- `customer_name` when every component expects `name`
- a null where the UI assumes a string

**`rowsPath` is the only mapping that exists**, and it only finds the array
inside a response envelope. Nothing maps FIELDS.

#### The shape: a schema is the contract for a source

A Standard Schema already does three of the four jobs, because **it parses
rather than merely asserts**:

| Job | Standard Schema | Note |
|---|---|---|
| **validate** — is this shape what we expect? | ✅ `~standard.validate` | already used for writes |
| **coerce** — `"42"` → `42`, ISO → `Temporal` | ✅ the parsed output | the reason to keep the schema's value, not the input |
| **default** — a missing field becomes a known value | ✅ | library-dependent but standard practice |
| **rename** — `customer_name` → `name` | ⚠️ expressible, but as a transform | Zod's `.transform`, Valibot's `transform` — so it IS possible, just not declarative |

So the answer is mostly **use what is there, on the read path too**:

```ts
new RestStore({
  url: '/api/customers',
  rowsPath: 'data',
  schema: CustomerSchema,     // ← already accepted; not yet applied to load()
});
```

The consumer provides the schema, exactly as Will described. Sherpa ships none
— a schema describes *someone else's* backend, and guessing at it is how a
library ends up with a folder of wrong ones.

#### Proven end to end — 2026-09-16

A hand-written Standard Schema (no library) wired as a mapping store, against a
backend sending snake_case, numbers as strings, and one bad row:

```js
validate(CustomerSchema, { cust_id: 1, customer_name: 'Ada', total_spend: '900' })
// → { value: { id: 1, name: 'Ada', spend: 900 } }
```

| Sent | Reached the components |
|---|---|
| `cust_id` | `id` — renamed |
| `customer_name` | `name` — renamed |
| `"900"` (string) | `900` — a real number, `typeof` confirmed |
| `{ customer_name: null, total_spend: 'xx' }` | dropped, not thrown |

…and `setSort('spend', 'desc')` then ordered `[900, 40]` **numerically**, which
is the trap the column filter currently hand-coerces around. The whole adapter
was ~12 lines, and every layer above it was unchanged.

**Two gaps the experiment exposed**, neither hypothetical:

1. **`LoadResult` has no room for a report.** The store counted dropped rows and
   had nowhere to put them — `{ rows, total }` is the whole shape. V8 needs a
   field.
2. **`DataSource` exposes no result at all.** `#result` is private with no
   getter, so even if the store reported something, a host could not read it.
   Fixing 1 without 2 is pointless.

#### The decisions this needs

Not hard, but they must be made deliberately:

| Question | Recommendation |
|---|---|
| What happens to a row that fails? | **Not a throw.** One bad row in a thousand must not empty a grid. Drop it, count it, and report on the source as a `LoadResult` field — the same way `total` is reported |
| Where does the failure surface? | A `change` / `error` event carrying the count and the first few issues. A silent drop is worse than a bad row |
| Is it optional? | **Yes.** No schema means no check, exactly as writes behave today. Adding one must never be required to use a store |
| Does it cost per row? | Measurably. A 10k-row load parsing every row is real work — so the check is per-load, and a `sample` option (check the first N, trust the rest) is the escape hatch for bulk |

#### Why this is worth more than validation

Type safety is the smaller half. The bigger one is that **a schema is where a
backend's vocabulary meets Sherpa's**, which is the reuse rule from Part 2.5
applied to data:

- **Column types stop being guesses.** The grid asks `col.type` to pick text /
  number / date operators. Today the caller declares it twice — once in the
  schema, once in the column config. One source of truth is better.
- **Filter values coerce correctly.** The column filter already hand-coerces
  numbers because the store compares a number row against a string filter with
  a text collator. A schema that made the row a real number removes that
  special case.
- **A `JoinStore` gains a shared vocabulary.** Two backends with two field names
  for one concept need renaming somewhere; a schema per source is the natural
  place.

#### The steps

| Step | Work | Why here |
|---|---|---|
| **V7** ✅ | Apply the schema on `load()`, not just writes | **DONE 2026-09-16.** `checkRows()` on the base store, wired into all four `load()`s. A schema now RENAMES, COERCES and DEFAULTS on the way in, so the hand-written adapter store the plan sketched is no longer needed |
| **V8** ✅ | Drop-and-report for bad rows: a field on `LoadResult` AND a getter on `DataSource` | **DONE 2026-09-16.** `LoadResult` gained `dropped` + `issues` (absent when nothing dropped, so a host tests the field rather than comparing to zero) and `DataSource` gained `result`. `total` drops with the rows, or a pager offers a page that renders empty |
| **V9** | Derive a column's `type` from the schema where one is given | the grid's `type` and the schema's already say the same thing in two places |
| **V10** | `sample` — check the first N rows on a bulk load | so a 10k-row load is not 10k parses |

**V7 is the one that matters** and is small: `load()` already has the rows and
the store already has `check()`. V8 makes it safe to turn on. V9 and V10 are
follow-ons, not prerequisites.

### Agents writing schemas — an MCP tier that fits

Will, 2026-09-16: *agents could write schemas if they knew how; empower the MCP
to support this.*

This is a better fit than most agent work, for one reason: **a schema is
checkable against real data.** An agent can be told it is wrong, automatically,
with the rows in front of it. Most generated code has no such oracle.

#### Why an agent is well placed here

Writing a source adapter is exactly the shape agents are good at and people find
tedious:

- it is **mechanical** — read a sample response, map field names, coerce types
- it is **repetitive** — one per external source, forever
- it is **well-specified** — Standard Schema is a published interface, and the
  target vocabulary is Sherpa's own
- it is **verifiable** — run it over the sample; a row that fails says why

The knowledge an agent needs is exactly what the MCP already serves for
components: the contract, the rules, and a way to check the result.

#### The loop, mirroring the existing tools

The MCP's generate module is already `scaffold_def` → `validate_def` →
`compile_def`. A schema is the same shape:

| Tool | Does | Mirrors |
|---|---|---|
| `scaffold_schema` | sample rows in → a draft Standard Schema out, with renames and coercions guessed from the data | `scaffold_def` |
| `validate_schema` | run the schema over the sample; report mapped rows, rejected rows and WHY | `validate_def` |
| `explain_source` | what Sherpa expects of a row: `FilterOp`s, which types sort numerically, why a date stays an ISO string | `explain_token` |

`validate_schema` is the one that matters. It closes the loop: the agent writes,
runs, reads the failures, and fixes — without a person in the middle.

#### What `scaffold_schema` can infer, and what it must not

**Can infer from a sample** (and should show its reasoning):

| Seen | Inferred |
|---|---|
| `"900.50"` in a field named `*_spend`, `*_amount`, `*_total` | a number that needs coercing |
| `"2024-03-04T09:00:00Z"` | an ISO date; keep as a date-only string |
| `customer_name`, `cust_id` | rename to `name`, `id` — snake→camel and a known-prefix strip |
| a field present in 9 of 10 rows | optional, so a default is needed |
| a field never null across the sample | probably required — **flag, do not assume** |

**Must not guess**, and should say so in the draft:

- **What is required.** A sample of ten rows cannot tell you a field is
  mandatory. Guessing wrong empties a grid in production.
- **Business meaning.** `status: 2` is a number; that it means "suspended" is
  not in the data.
- **Units.** `900.50` could be pounds or pence. A schema that silently divides
  by 100 is worse than one that does nothing.

A scaffold is a **draft for a person to confirm**, and the tool should mark
each inference so it can be checked rather than skimmed.

#### The honest limits

1. **A sample is not a contract.** Ten rows say nothing about the eleventh. The
   real answer is the backend's own OpenAPI / JSON Schema where one exists —
   **a tool that reads that is worth more than one that guesses**, and should
   come first if the backend offers it.
2. **A schema that silently drops rows is a production incident.** This is why
   V8 (drop-and-report, with a reachable count) is a prerequisite: an
   agent-written schema that rejects 40% of a response must be loud about it.
3. **The agent needs the sample.** Which means a fetch, or a person pasting a
   response. Neither is a problem, but the tool cannot invent the input.

#### The steps

| Step | Work | Why here |
|---|---|---|
| **M1** | `explain_source` — what Sherpa expects of a row, and why | the knowledge an agent needs is not written down anywhere yet. Mostly a DOC: `sherpa://rules` already works by serving a markdown file, so this is "write the page, register the resource" — and the page helps people too |
| **M2** | `validate_schema` — run a schema over sample rows, report mapped / rejected / why | the ORACLE. Without it an agent is guessing; with it the loop closes. **Cheap**: `validate()` is already exported from `core/validate.ts`, is DOM-free, and the MCP already imports Node modules from `scripts/lib/` — so the tool is a thin wrapper, not new machinery |
| **M3** | `scaffold_schema` — sample rows → a draft, inferences marked | least valuable of the three alone; genuinely useful after M2 |
| **M4** | Read a backend's OpenAPI / JSON Schema where it exists | strictly better than inferring from a sample. Do this before M3 if the backends have one |

**Order matters and is not the obvious one.** M2 before M3: a generator without
a checker produces confident, unverifiable output. And M1 before both, because
it is the smallest and it is the piece that makes the other two possible.

This sits in the **P5 family** (the MCP instance tier, Part 2.5 "Parity") —
same principle: anything a person can do, a caller can do, and an agent is just
a caller with no pointer.

### An app SESSION store — yes, and most of it exists

Will asked 2026-09-16. The answer is yes, but it is a **third kind of thing**,
not a bigger `Store`.

| | Holds | Shape | Lives |
|---|---|---|---|
| `Store` | RECORDS — many rows of one collection | `load` / `insert` / `update` / `remove` | app |
| `DataSource` | VIEW STATE — one query | filter / sort / group / page | one query |
| **session** | **SINGLETONS** — one value each, about the user or the app | get / set / subscribe | app |

Records and queries are both about *rows*. A session is about **one value at a
time**: the current theme, who is signed in, which view is open, the saved views
a user has made. Forcing those through a row-shaped API would be a worse fit
than the two lines of code it saves.

#### The mechanism already exists

`StateStore` in [`render-view.ts:120`](../src/core/render-view.ts#L120) is a
key/value store with **JSON-pointer subscriptions**: a write at a pointer
re-runs every subscriber whose pointer overlaps. That is precisely a session
store — it is simply not used as one, and lives in a module named for
something else.

```ts
session.set('/user/name', 'Ada');
session.subscribe('/theme/mode', (mode) => document.documentElement.dataset.mode = mode);
```

#### What it would own today

Scattered, and each in the wrong place:

| State | Where it lives now | Should be |
|---|---|---|
| light / dark mode | a `<script>` in `examples/index.html`, with its own `localStorage` key and try/catch | `session` + a persisted pointer |
| the current view | a module-scoped `let` in the router | `session.get('/route/view')` |
| saved views | nowhere — planned as `LocalStore` | `session`, persisted |
| the signed-in user | nowhere yet | `session` |
| nav collapsed / settings mode | a `data-*` attribute on `sherpa-nav` | stays there — it is the component's own |

That last row is the important one. **A session store is not a bucket for every
value in the app.** The same test applies: would anything outside be surprised
if this were shared? Nav collapse is one component's business; theme is every
component's.

#### Rules, so it does not become a global bag

1. **Singletons only.** Rows live in a `Store`. If it has a list, it is not
   session state.
2. **No component reads it directly.** Same rule as `DataSource`: a component
   that reaches for app state cannot be reused in a context that has none. The
   view reads the session and sets attributes.
3. **Persistence is a pointer, not the default.** `/theme/mode` survives a
   reload; `/route/view` does not. The store should be told which, rather than
   guessing.
4. **It does not replace attributes.** `data-mode` on `<html>` is still what
   CSS reads. The session store is where the VALUE is decided; the attribute is
   how it is expressed.

#### The steps

| Step | Work | Why here |
|---|---|---|
| **S4** | Promote `StateStore` to `core/session.ts` | it already IS this; it is in a file named for view rendering and nobody would look there |
| **S5** | Move theme mode onto it | the clearest duplicate: hand-rolled `localStorage` + try/catch in an example, which every app would copy |
| **S6** | Persisted pointers — `session.persist('/theme/mode')` | so rule 3 is a capability rather than a convention |

#### The case that makes it worth building: surviving a reload

Will, 2026-09-16: *retain app context so we can survive accidental page reloads
and retain a variety of contexts and states.*

Today an accidental refresh loses everything — the filters, the sort, the page,
which view you were on. The user starts again.

**Most of what must survive is already serialisable.** `ViewState` is plain
JSON:

```ts
interface ViewState {
  filter?: Filter;  sort: SortSpec[];  group: string | null;
  search: string;   page: number;      pageSize: number | null;
}
```

…and `DataSource` already exposes `state` and `setState`. So restoring a view is
**wiring, not new machinery**: persist the state under a pointer, read it back
on load, hand it to `setState`.

What should survive, and where:

| State | Survives a reload? | Where |
|---|---|---|
| theme / mode | yes | `localStorage` — a choice, not a session |
| signed-in user | yes | `localStorage` |
| current view + its `ViewState` | yes | `sessionStorage` — per TAB, so two tabs keep their own |
| scroll position, open menus | no | transient by nature |

**`sessionStorage` for view state is the important choice.** Two tabs on the
same screen filtered differently is a feature (see "Tabs and windows"), and
`localStorage` would make them fight.

One trap already known: Web Storage throws in a private window, with site data
blocked, and during preview or thumbnail capture. `LocalStore` already wraps
every access for that reason — the session store must do the same, and a failed
read must fall back to the default rather than break the page.

| Step | Work | Why here |
|---|---|---|
| **S11** ✅ | Persist a `DataSource`'s `ViewState`; restore on load | **DONE 2026-09-16.** `persistViewState(source, name)` in `core/persist-view.ts` — `sessionStorage` by default, so two tabs keep their own filters. A HELPER, not part of `DataSource`: where a state is kept is the host's call. NOTE: `setState` did NOT already exist, contrary to this plan — it was built as part of the step |

**S4–S6 are a tidy-up.** S11 is the one a user would notice.

### Tabs and windows

A new tab is a new document, so it gets its own everything — no work needed, and
that is correct: two tabs on the same screen filtered differently is a feature,
not a bug.

**Sharing ACROSS tabs is a separate question**, and the platform has answers if
it is ever wanted:

| Want | Mechanism |
|---|---|
| a saved view that follows the user | `LocalStore` — already planned |
| "someone edited this record in another tab" | `storage` event, or `BroadcastChannel` |
| one live query shared between tabs | a `SharedWorker` holding the store |

**None of this is planned, and none should be built speculatively.** The note is
here so the shape is not designed away: because `Store` is an `EventTarget` and
DOM-free, a cross-tab store is a store that listens to `BroadcastChannel` — a
new backing, not a new architecture.

### The steps

| Step | Work | Why here |
|---|---|---|
| **S1** | Move the `ArrayStore` out of `records.js` into a module the views import | leaving and returning to Records currently rebuilds every record and loses the view state; the store should outlive the view |
| **S2** | Say the rule in the docs: **stores are app-level, sources are query-level** | it is not written anywhere, and the example teaches the opposite |
| **S3** | A second view over the SAME store | proves records are shared and an edit in one is seen by the other — the thing a per-view store cannot do |

S1 and S2 are small. **S3 is the one that proves it**, and it pairs naturally
with step 14a (rewiring the dashboard).

---

## Next — the ownership work (Part 2.5)

Added 2026-09-16, after the column-filter work turned the "no new API" claim
over. These are the steps that make the model above true everywhere rather than
in the two components that needed it first.

| Step | Work | Why here | Bar |
|---|---|---|---|
| **O1** | `data-locked` in `SherpaElement` | 3 components already use it, each re-reading the attribute themselves, and it MUST not vary — a component that derives state it does not own is the bug this prevents | 3 uses today — over the bar already |
| **O2** | Audit every component for derived state it does not own | the quick-filter chip read "no ticked rows" as "off" for 8 months before a grid exposed it | finds the remaining ones before a host does |
| **O3** | Suspend/clear as a PAIR wherever a value can be turned off | collapsed twice in one week; costs the user their typed input each time | any control offering both "off" and "gone" |
| **O4** | Document the `data-x` / `x-change` / `data-x-locked` convention in `CLAUDE.md` | the sort link was 20 lines BECAUSE it followed this; the filter link was a day because it did not | one line in the naming contract |
| **O5** ✅ | Named filter CONTRIBUTIONS on `DataSource` — one key per ALTITUDE | **DONE 2026-09-16.** `contribute(key, filter)`; every part ANDed, a key replaced by its next contribution and removed by `undefined`. `setFilter` and `setState` still REPLACE and clear the parts with them, because both are claims about the WHOLE query. Deleted four hand-composed variables from the records view |
| **O6** ✅ | Shared `ORGANISE_ICONS`, shared operator vocabulary, toast duration via `animationend` | **DONE 2026-09-16** — three duplications: a glyph map in 2 files (with a guard that could not guard), an operator list in 4, and one animation duration in 2 | the smells listed under "Reuse" |
| **O7** | Sweep for the other four smells | O6 found two by looking in one place; nobody has looked anywhere else | any "must stay in step" comment, any test asserting two things match |

O1–O4 are small and pay immediately. **O5 is deliberately held**: one screen is
not evidence, and `ignore` is a working answer until a second one proves the
shape.

## View DEFINITIONS — the generalisation of a saved view

Will, 2026-09-16: *the column filter setting is why we will want to store and
retrieve view definitions. A preset, or a saved user configuration of a view,
should be a definition that is loaded in. These definitions can set context and
states to initialise any component in the view to.*

This is the right generalisation, and it says what S11 got wrong.

### What S11 built, and why it does not scale

Surviving a reload was wired as **one hand-rolled key per concern**:

```js
persistViewState(source, 'records');                     // the source's view state
sessionStorage.setItem('sherpa:view:records:columns', …); // the grid's clauses, by hand
```

Two stores, two shapes, two restore paths — and a third would be needed for
selection, a fourth for the toolbar's chips. **That is five implementations of
one idea**, which is the thing "Reuse — one implementation, not five" argues
against. It works for one screen and will not survive a second.

### The concept already exists

`render-view.ts` builds a whole view from a **normalised view definition** —
a flat `elements` registry, a layout tree of id references, a `state` blob and
`$state` wiring. A saved view is not a new concept; it is an existing one that
does not yet cover enough.

What it sets today, per element:

| | Sets | When |
|---|---|---|
| `props` | attributes | at BUILD |
| `data` | the `populate()` payload | at BUILD |
| `state` + `$state` | a shared blob elements bind to | live |

**The gap is everything that is neither an attribute nor a populate payload.**
A grid's column filters are set by `setColumnFilter()`; a source's view state by
`setState()`. Neither is expressible in a definition, so neither can be saved,
shared or preset.

### What a view definition must gain

One field, and the discipline to keep it small:

```js
{
  elements: {
    grid: {
      type: 'sherpa-data-grid',
      props: { 'data-column-filters': true },     // attributes — as now
      state: {                                     // NEW — the API surface
        columnFilters: { name: ['name', 'contains', 'ana'] },
        sort: { field: 'spend', direction: 'desc' },
      },
    },
  },
  source: {                                        // NEW — the query
    filter: ['and', ['plan', 'eq', 'Pro']],
    sort: [{ field: 'spend', direction: 'desc' }],
    page: 3, pageSize: 25,
  },
}
```

Two halves, because they have two owners:

- **`source`** is a `ViewState` — it already serialises, and `setState()`
  already restores it. Nothing new.
- **`state`** per element is applied through the component's **own public
  methods**, which is why parity (Part 2.5) is the prerequisite rather than a
  nicety. `setColumnFilter` exists; `select()` does not, so selection cannot be
  saved until P2 is built.

**The rule this implies is worth stating plainly:** *a component's state is
savable exactly as far as its API reaches.* That turns parity from a principle
into a feature — and it is why P1 had to be built before S11 could finish.

### Why this is the same answer as headless and MCP

A view definition that can set every component's state is, by construction:

| Also gives you | Because |
|---|---|
| **presets** — "Overdue invoices", shipped with the app | a definition is data |
| **saved views** — a user's own configuration | the same data, stored per user |
| **deep links** — a URL that opens a configured screen | the same data, in a query string |
| **agent control** — "show me X filtered by Y" | the same data, from MCP |
| **reproducible bugs** — "here is my exact view" | the same data, pasted |

Five features, one mechanism. That is the test the design has to pass, and it is
why the answer must not be a per-concern storage key.

### The honest difficulties

1. **A definition can name a component that no longer exists**, or a column a
   backend dropped. It must degrade — apply what it can, report what it could
   not — for the same reason a bad row is dropped rather than thrown (V8).
2. **Order matters.** A grid's column filters cannot be applied before it has
   columns, which means after its first `populate()`. The definition describes
   an end state; something has to sequence it.
3. **Versioning.** A saved view outlives the code that made it. A definition
   needs a version, and an unrecognised one must be ignored rather than
   half-applied.
4. **Not everything should be saved.** Scroll position, open menus, a
   half-typed filter — transient by nature. The same "would anything outside be
   surprised if this were shared?" test applies.

### The steps

| Step | Work | Why here |
|---|---|---|
| **D1** ✅ | `state` on `ElementNode`, applied through each component's public methods after build | **DONE 2026-09-16.** Plus `applyState(el, state)` exported, so a definition can reach a LIVE screen and not only one being built. A method is called (an array is its argument list), an accessor assigned; unknown keys are returned as skipped |
| **D2** ✅ | `source` on a view definition, applied via `setState()` | **DONE 2026-09-16** as `applyViewSnapshot(snapshot, targets)` — source first, then each element, because a component's state refers to rows the query brings |
| **D3** ✅ | `captureView(targets, reads)` — read the current state BACK into a definition | **DONE 2026-09-16.** What to read is NAMED per element rather than guessed: only the caller knows which properties are view state and which are incidental, and guessing would put a scroll position in a saved view |
| **D4** ✅ | Replace S11's two hand-rolled keys with one definition | **DONE 2026-09-16.** `persistView(name, targets, contributors)` keeps a whole snapshot; `persistViewState` is now a thin deprecated wrapper over it. Verified in the records app: TWO column filters, both lit, both typed values and all 6 match marks survive a real reload |
| **D5** ✅ | Degrade + version: apply what fits, report what did not | **DONE 2026-09-16.** A gone element and a gone method are REPORTED (`missingElements`, `skipped`), never thrown. An unrecognised `v` is ignored whole rather than half-applied — a definition applied in part leaves a screen nobody designed |

**D1 is blocked on parity, not on itself.** A definition can only set what a
component exposes, so the P-steps are its prerequisite — P2 (selection) first,
then a sweep (P3) for what else is unreachable.

**D4 paid the debt** on 2026-09-16. S11's two keys are gone; the records view
persists one snapshot in the same shape a preset or a shared link would use.

Building it forced one addition to D1: a `state` block is a MAP, so one method
cannot appear twice — and `setColumnFilter` must run once per filtered column.
The value may now be a LIST OF CALLS. Inventing a `setColumnFilter:name` key
would have been a second vocabulary nothing else understands.

## Component SPECS have fallen behind the data layer

Will, 2026-09-16: *ensure the component schemas still work with the data layer —
another agent noted the nav schema was "flaky" in a recent update.*

Checked, and there are three separate problems. The "flakiness" was real and had
a cause.

### 1. The generator could not read a commented `observed` list — FIXED

`static override observed` was parsed with a bare `split(',')`, so a component
that explained an entry inline produced observed "names" like
`// SINGLE vs multiple changes the CONTROL each row draws` and failed its own
round-trip. The spec then looked unstable when the only thing that had changed
was a COMMENT.

That is not an unusual thing to write: `observed` is where a component says WHY
an attribute is reactive, which is exactly the kind of thing worth recording
next to it.

Fixed 2026-09-16 — comments are stripped before splitting, in the one place both
call sites now share.

### 2. The specs do not describe the data layer's API at all

A spec records **attributes**, **events**, **slots**, **tokens** and — best
effort — **getters/setters**. It records nothing about **methods**.

Everything the parity and view-definition work added is a method:

| | |
|---|---|
| `setColumnFilter` / `columnClause` / `clearColumnFilter` | invisible to the spec |
| `suspendColumnFilter` / `openColumnFilter` | invisible |
| `select` / `clearSelection` | invisible |
| `setState` / `applyState` / `applyViewSnapshot` | invisible |

This matters more than it used to. **A view definition can set exactly what a
component exposes** (Part 2.5), so the set of methods IS the set of things a
saved view, a preset or an agent can configure. A spec that cannot describe them
cannot describe what a view definition may contain — and the MCP serves specs,
so an agent asking "what can I set on a grid?" gets an incomplete answer.

### 3. Twenty-two of fifty-eight specs fail their own round-trip

Measured 2026-09-16, after fixing (1):

```
22 FAIL / 58 components
```

Mostly pre-existing CSS drift — a token added or renamed since the spec was last
generated. Regenerating them produces ~800 lines of legitimate change across 43
files, which is real work and wants reviewing on its own rather than riding
along with a data-layer commit.

**One of the 22 was the data grid, and it was MY omission**: `data-filterable`,
`data-column-filters`, `data-filter-fields` and the whole JS API were missing
from the HTML `Public API:` block the generator reads. Fixed, and it round-trips
again — which is the spec doing its job.

### The steps

| Step | Work | Why here |
|---|---|---|
| **C1** ✅ | Strip comments before parsing `observed` | **DONE 2026-09-16.** The "flaky nav schema" was this: a comment in the array became a prop name |
| **C2** ✅ | Record METHODS in the spec — name, arguments, description | **DONE 2026-09-16.** `$extensions.sherpa.methods` plus a `js-methods` capability, re-derived from the TS like `jsProps` so a removed method disappears rather than lingering. The MCP's `get_component` serves the whole spec, so an agent now sees the seven verbs a data grid accepts and what each is for |
| **C3** | Regenerate all 58 and review the drift | 22 fail; the churn is ~800 lines of real CSS drift and deserves its own pass, not a ride-along |
| **C4** | Make the round-trip a GATE, once C3 lands | it catches exactly the class of mistake C1 and my `Public API` omission both were — cheap, and only possible once the baseline is clean |

**C1 and C2 are done.** C3 and C4 remain: 22 specs still fail round-trip on
pre-existing CSS drift, which wants its own reviewed pass rather than riding
along with feature work.

## Next — parity (API equals interaction)

Anything a person can do by clicking, a caller must be able to do by calling —
through the same code, not a second path. See "Parity" in Part 2.5 for why this
is structural rather than a convenience.

| Step | Work | Why here |
|---|---|---|
| **P1** ✅ | `setColumnFilter(field, clause)` on the data grid | **DONE 2026-09-16, and the prediction landed exactly.** Building S11 hit it: a reload restored the ROWS and lit the heading, but left the menu empty — a lit column that lies about why. Takes what `column-filter-change` reports, so the round trip closes |
| **P2** ✅ | Selection: `select(keys)` / `clearSelection()` / `selectedKeys` | **DONE 2026-09-16.** BY KEY, not index — `selection-change` reports indices, which is right for a live handler and useless for a saved view: an index means something else after any sort. Needs `key` in `populate()`; without one `selectedKeys` is EMPTY rather than approximate, because a selection saved by position comes back pointing at the wrong records |
| **P3** ✅ | A parity AUDIT across all components | **DONE 2026-09-16.** Swept every getter for a missing setter. Three real gaps fixed — `transfer-list.selected`, `barchart.hiddenBars`, `line-chart.hiddenSeries`, all choices a reader makes and could not get back. Four correctly READ-ONLY and left alone: `file-upload.files` (real File objects, cannot come from JSON), `notifications.unreadCount` and `code-block.code` (derived from data), `calendar-cell.value` (set by its parent). Guarded by `test/e2e/reforged-parity.spec.ts`, which fails if a setter disappears |
| **P4** | Parity as a spec field | `.component.yaml` records events and props; it should record which interactions have a programmatic equal, so drift is visible |
| **P5** | MCP instance tier — drive a live screen | a thin wrapper over P1–P3; **impossible before them**, which is the point |

P1 and P2 are small and unblock real hosts (saved views, deep links) as well as
agents. P3 is the one that finds what we have not noticed. **P5 is the reason
the rest are worth doing**, but it is last: an MCP tool for "filter this column"
is trivial once `setColumnFilter` exists and unbuildable until it does.

## Later — query translation and the server end

`LoadOptions` is the standard query format (Part 2). These steps are what make
it reach other backends. **Q3 is explicitly deferred** to a future piece of work
about servers and databases; it is listed so the seam is not designed away
before then.

| Step | Work | Why here |
|---|---|---|
| **Q1** | Keep `src/core/store.ts` DOM-free, as a rule | it is what lets a SERVER import `applyOptions` / `filterRows` / `sortRows` and answer a query identically to the browser. Free today; easy to lose by accident |
| **Q2** | A translator per real backend — `toOData`, `toSql`, `toGraphQL` | the `buildQuery` seam already takes them. Pure functions: `LoadOptions` in, a request out. **Build on demand, never speculatively** |
| **Q3** | Server-side group / sort / filter | **DEFERRED, and for the right reason.** Measured 2026-09-16 — see below. Needs a `LoadResult` shape for genuinely grouped payloads (nested rows, per-group counts), which must not be invented before a real backend asks |

Two rules that hold whenever Q2 is picked up: a translator **parameterises,
never interpolates** (a filter value is user input), and it **throws on an
operator it cannot express** rather than dropping the clause and returning rows
nobody asked for.

### Is the layer fast enough? Measured, 2026-09-16

`applyOptions` over generated rows, in the browser:

| Rows | Filter | Sort | Group | Filter + sort + page |
|---|---|---|---|---|
| 1,000 | 0ms | 1ms | 2ms | 1ms |
| 10,000 | 1ms | 5ms | 5ms | 1ms |
| 100,000 | 8ms | **60ms** | **72ms** | 10ms |

**Up to ~10k rows the layer is not the bottleneck.** Everything is inside one
frame, and the combined case is fastest because paging cuts the work.

At 100k a sort costs 60ms — one dropped frame, noticeable on a keystroke.

**But that is the wrong thing to optimise.** Long before the sort hurts, the
cost of shipping 100k rows to the browser does: the transfer, the parse and the
memory. **So server-side preparation is worth doing, and the reason is TRANSFER,
not arithmetic** — a server that filters and pages returns 25 rows instead of
100,000.

Which changes what Q3 is for. It is not "the client is too slow"; it is "do not
send what will be thrown away". That also makes the design obvious: the server
receives a `LoadOptions` (it is already serialisable JSON) and returns rows plus
a total — which is the shape `RestStore` already expects.

## What this week actually proved

Worth recording, because it is the argument for the whole layer:

- **The plan's core bet was right.** Attributes in, events out, `EventTarget` as
  the bus — no framework, no subscriber lists, zero dependencies. The grid ⇄
  toolbar sort link is ~20 lines of real code.
- **The plan's one wrong claim** was "no component needs a new API". Two-way
  binding needs four small ones, and they are all the same question.
- **Progressive enhancement held.** Every fix this week was an attribute, a CSS
  rule, or a native control. The only JS added was the arithmetic no CSS
  expresses: which clause, which field.
- **The DOM was the state, and that was enough.** No shadow copy of view state
  was needed anywhere — `data-sort-field` on the element IS the sort, and
  components re-draw from it.
- **The one platform limit found:** custom properties inherit past their owner,
  and `@scope` does not contain them. Style the element you mean.
- **Parity arrived by accident, and should have been on purpose.** Every public
  method the grid grew this week — `clearColumnFilter`, `suspendColumnFilter`,
  `columnClause`, `openColumnFilter` — was added because a HOST needed it. Each
  is also exactly what an agent would need. Building them on purpose rather than
  under pressure is what the P-steps are for.

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
