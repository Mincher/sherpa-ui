# Principles

The rules, stated once. Eighteen of them, and **fourteen are enforced by a gate**
— those are facts about the codebase, not aspirations. The other four are
conventions a reviewer has to hold.

This file exists because every one of these rules was previously stated in
three to seven documents. "Never use opacity for a disabled state" appeared in
**seven**. A rule with seven copies is seven chances to rot, and this repo has
the receipts: a focus-ring token named in `CLAUDE.md` for months **did not
exist**, so anyone who followed the doc shipped the wrong colour.

**One statement, one gate.** Where those disagree, the gate wins — it runs.

---

## The two layers

Everything below serves one separation:

| | |
|---|---|
| **Data layer** | `src/core/*.ts` minus the element. Getting, setting and transforming rows. Touches no DOM, so a server, a test or an MCP tool imports it |
| **Presentation layer** | `SherpaElement` + the 65 components. Shows what it is given; asks for what it wants; decides nothing about the data |

The join is the SOURCE. A component ASKS for what it wants, in its own
attributes; `sherpa-provider` opens a page's source from its page definition
(`docs/PAGE-DEFINITION.md`) and answers each ask through `DataSource.bind`.
A hand `bind(el, options)` is the manual way, for a page with no provider. A
component never reaches past the source to a store, and two components never
speak directly.

**A utility layer sits beside them.** App plumbing that holds no rows and draws
nothing. `sherpa-router` owns the URL, on the Navigation API
(`T-the-router-owns-the-url`); `sherpa-provider` opens a page's source and
answers what its components ask. The frame they sit in is a component,
`sherpa-app-shell`.

**Where does new code go?**

- Getting, setting or transforming data → the **data layer**.
- Reusable by more than one component → **`SherpaElement`**.
- Only this component could want it → the **component**.

---

## 1–14: the gated rules

Each one runs in the pre-commit hook. The gate is the statement; the words here
are a reminder of why.

### CSS

| # | Rule | Gate |
|---|---|---|
| 1 | `:host(:not(…))` functional form — chained form is silently broken in shadow DOM | `lint:css` `chained-host` |
| 2 | No `&` nesting inside `:host {}` — it desugars to the broken chained form | `lint:css` `host-nesting` |
| 3 | Never `opacity` for a disabled state — it compounds in dark mode. Inactive tokens per property | `lint:css` `disabled-opacity` |
| 4 | An inset focus ring, `var(--sherpa-focus-ring)` — an outer ring bleeds over a snapped neighbour | `lint:css` `focus-ring` |
| 5 | `@container`, never a viewport `@media`, inside a component | `lint:css` `viewport-media` |
| 6 | Two grids: 4px for spacing, 2px for text. `/* off-grid-ok */` opts a drawn glyph out | `lint:css` `off-grid` |
| 7 | No `light-dark()` in component CSS — the display-mode layer owns mode | `lint:css` `light-dark` |
| 8 | A colour binds the Style name Figma binds; a state is a mode pin in `state-pins.yaml`, never a colour rule. `/* theme-direct */` where Figma binds Theme too | `lint:css` `theme-active`, `theme-colour` (ratchet) |

### Contracts

| # | Rule | Gate |
|---|---|---|
| 9 | Every `:host([data-*])` and every `this.dataset` read is DECLARED in `static props` | `check:props` |
| 10 | One owner per value. A bound component REPORTS; `data-locked` says the host owns it | `check:ownership` |
| 11 | A `TRAP T-…` citation resolves to an entry in `TRAPS.md`, and its Sites match who cites it | `check:traps` |
| 12 | A `.component.json` regenerates the source it describes, and is what that source generates now | `spec:check` |
| 13 | The data layer imports no DOM — no `document`, `window`, `customElements`, storage | `lint` |
| 14 | Every file's header says what it holds, and ends in a `Map:` of its exports — one line each. A changed file carries its map; `npm run map` prints them all | `check:map` |

---

## 15–18: the ungated conventions

No gate, so a reviewer holds these. All four were checked on 2026-09-22 and the
codebase obeys them.

**15. `data-*` is the public API.** Native attributes (`disabled`, `name`,
`value`) stay unprefixed. Component-private state is `--_*`, never a public
`data-*`. `data-type` is the component's Figma **Type** axis — whatever that
axis picks, a control, a shape, a look or a template (Will, 11d, 2026-10-01).

**16. CSS owns visibility.** JS sets a `data-*` on the host; CSS selects it. JS
never touches `.hidden`, `display` or `visibility` on a shadow node.

**17. Every element the component will ever show is in the template.** No
`createElement()` for structure, no structural `innerHTML`. Repeating items use
a cloning prototype. A typed child by tag name is not structure — `menuFor()`
building a `<sherpa-menu>` is that. Measured 2026-09-25: ten calls, not the four
this said; two are `menuFor`'s typed children, and the other eight were not
re-reviewed.

**18. Events are unprefixed `noun-verb`** — `page-change`, `tree-select`. Never
a `sherpa-` prefix. A re-dispatched native event keeps its native name, which
is why `sherpa-accordion` emits `toggle`.

---

## The doors on `SherpaElement`

Reach for these before writing the same thing again. Each replaced a pattern
found in three or more components.

| | |
|---|---|
| `this.$(sel)` / `this.$$(sel)` | Shadow queries. Never `this.shadowRoot.querySelector` |
| `this.set(attr, value)` | The JS→CSS write. `null`/`false` REMOVE the attribute |
| `this.num(attr, fallback, opts)` | The one numeric parse; a real `0` survives |
| `this.on(target, type, handler)` | Listen on something this element does not own. Carries the disconnect signal, so nothing needs removing. `while:` names a shorter lifetime |
| `this.onFrame(…)` | The same, coalesced to one call per frame. For a handler that READS LAYOUT — measured, an unthrottled scroll handler did 100 `getBoundingClientRect()` calls for 50 events |
| `this.mirrorAttrs(control, attrs)` | Copy native attributes onto a wrapped `<input>`. `value` is skipped — it is a property on a live control |
| `this.renderItems(container, tpl, items)` | Stamp a LIST declaratively. The prototype names its own fields |
| `renderData(payload)` | Override to draw a payload. The DEFAULT writes a payload's keys onto the attributes the component declares, so a component with no override still shows data |

---

## Three silent failures worth knowing before you start

Each cost hours, and none produce an error.

**A component sheet is ADOPTED, and three things do not work in one.**
`@import` is dropped. A document class rule cannot reach in. `@property` does
not register — it parses, lists in `cssRules`, and `CSS.supports()` even
returns **true**, none of which is registration.

**`src/styles/` is what the APP links; `src/core/` is what a COMPONENT adopts.**
A token belongs in the first, a class in the second.

**Off is not gone.** Switching a filter off keeps its value; deleting it throws
the value away. Collapsing the two has cost a reader's typed filter, a sort
column and a legend row.

---

## The working method

**Measure in the running app. Never infer.**

Every bug in this repo's history was found by reading a value back in a browser,
and several "obvious" fixes were rejected after measuring them. Two examples:
the parser silently drops `:host(:has())`, and an index seek on a string in
IndexedDB skipped every row whose case differed — which made one chip value
return zero results while two returned the right answer.

A green test suite is not proof on its own. Ask what the change SHOULD have
broken, and check that it did.

---

## Open work

Carried over when 16 documents were retired into this one, 2026-09-22, then
**verified one by one** — four were already done and are struck out below.
Each remaining item is real and reported; none is a plan.

Done, verified in the running app 2026-09-22: **B4** (tooltips showed "1.2K"
for 1,234 — fixed, they now show the value in full while the axis still
compacts), **B7** (clicking an indeterminate group box selects all 24 rows and
the icon follows), **B8** (the 8px token is on the bulk-actions row), **B9**
(`def.range ?? def.kind === 'number'`), **5** (Add Customer calls
`store.insert`).

| | |
|---|---|
| **0** | No chart is keyboard-reachable |
| **1** | Bundle the toolbar + pagination INTO `sherpa-data-grid` |
| **2** | Pinned columns — an app-header filter change unpins the selection column |
| **3** | Sparkline sub-pixel gaps |
| **4** | App header — another design-review pass |

---

## Where the docs are

**The RULES are four markdown files, and three of them are read by code.** The
rest of `docs/` is record, not rule: the designs (`QUERY-DESIGN`,
`PROVIDER-DESIGN`, `PAGE-DEFINITION`), the audits and reviews (`COMPONENT-AUDIT`,
`COMPONENT-API-AUDIT`, `FILTER-REVIEW`, `CONSUMER-REVIEW`) and the ledger
(`TODO`). Where one disagrees with the code, the code and its gate win.

| File | Who reads it |
|---|---|
| `PRINCIPLES.md` | People. This file — the rules, the doors, the open work |
| `TRAPS.md` | `check-traps` — a `TRAP T-…` citation must resolve to an entry, and that entry's `Site:` list must match who cites it |
| `DEF-TO-FIGMA-BUILD-RULES.md` | The MCP server, as `sherpa://rules` |
| `DATA-SOURCE-RULES.md` | The MCP server, as `sherpa://data-rules` |

`TRAPS.md` is where the depth went, and it is gated both ways. That is the
trade: the citation stays beside the code, the essay moves out. About 1,800
citations in `src/` point at it.

If a rule here and a gate disagree, **the gate wins** — it runs.
