# The Data Layer — plan

Branch `sherpa-data-layer`. Step 1 is done (`5a34c3a6`); the rest is plan.

Three jobs:

1. **Consolidate `SherpaElement`** — absorb the plumbing 31 components copy by hand.
2. **Add a data layer** — one place that owns filter / sort / group / page, so the
   grid, the toolbar and the app cannot disagree about them.
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

**Precedent.** Shoelace / Web Awesome — the closest comparable library — does exactly
this: native Constraint Validation, `setCustomValidity()`, and it exposes
`data-user-invalid` / `data-user-valid` for styling. It ships **no** validator
component and **no** schema validation. Sherpa is already on the same path.

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
| `Temporal` | ⚠️ Stage 4 and shipped in Chrome 144 / Firefox 139 / Node 26 — but **Safari ships it only in Technology Preview**. Not Baseline. Polyfill breaks zero-dependency. **Do not use.** |
| `Number.isInteger`, `Number.isFinite` | ✅ fine, already used by `coerceNum`. |

So this half must be written. It should be **small**.

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
- **No prior art.** No major web-component library ships a validator element.

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
| A `<sherpa-data-validator>` element | No visual output; cannot serve the pre-DOM path |
| A second validation mechanism for forms | The platform's is better; finish wiring it |
| Anything using `Temporal` | Safari has not shipped it |
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
| **1** ✅ | `num()` | **DONE** (`5a34c3a6`) — fixed 4 live bugs, 15 specs, 416 passing |
| 2 | `static props` + reflection | biggest win; removes ~30 methods and every if-chain |
| 3 | `clone()` | trivial; unifies 3 null policies |
| 4 | `icon()` | gives 4 components working icons |
| 5 | `delegate()` | fixes the `Number(null)` → row 0 bug |
| 6 | `renderList()` | most design care; do last |
| 7 | **V1** `validate.ts` — `Result`/`Issue` + the rule set | a prerequisite for step 10 |
| 8 | **V2** accept a Standard Schema object | zero-dependency Zod/Valibot support |
| 9 | `Store` + `ArrayStore` + `DataSource` | the core |
| 10 | **V5** validate on the store | a bad response or `insert` must not reach the UI |
| 11 | `JsonStore`, `RestStore`, `LocalStore` | remote + persistence |
| 12 | **V3 + V4** `formAssociated` + `data-rules` | the form half; independent of 9–11 |
| 13 | **V6** ARIA wiring | `aria-invalid` + `aria-describedby` (NOT `role="alert"` per field) |
| 14 | Rewire `records.js` | proves it on the hardest real view |
| 15 | Move grid sort/filter onto the source | closes the backlog's known issue |

Validation is interleaved, not appended: V1–V2 must precede the store work that uses
them (step 10), while the form half (12–13) is independent and can run in parallel.

## Gates

Each step must pass before the next:

```bash
npm run type-check     # strict, no emit
npm run lint            # eslint, --max-warnings 0
npm run lint:css        # 57 files · 0 errors · 0 warnings
npm test                # 416 passing after step 1 — must not drop
```

Also run `node scripts/generate-component-spec.mjs --all --check` after touching a
component and confirm **no new** drift (several pre-existing round-trip notes are
unrelated and expected).

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
