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
| **Presentation layer** | `SherpaElement` + every component. Shows what it is given; asks for what it wants; decides nothing about the data |

The join is the SOURCE. A component ASKS for what it wants, in its own
attributes; `sherpa-provider` opens a page's source from its page definition
(`docs/PAGE-DEFINITION.md`) and answers each ask through `bindSource`.
A hand `bindSource(source, el, options)` is the manual way, for a page with no
provider. A
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
| 11 | A `TRAP T-…` citation resolves to an entry in `TRAPS.md`, and its Sites match who cites it. `TRAPS-INDEX.md` is made from those Sites | `check:traps` |
| 12 | A `.component.json` regenerates the source it describes, and is what that source generates now | `spec:check` |
| 13 | The data layer imports no DOM — no `document`, `window`, `customElements`, storage | `lint` |
| 14 | Every file's header says what it holds, and ends in a `Map:` of its exports — one line each. A changed file carries its map; `npm run map` prints them all | `check:map` |

---

## 15–18: the ungated conventions

No gate, so a reviewer holds these. All four were checked on 2026-09-22 and the
codebase obeys them.

**15. `data-*` is the public API.** Native attributes (`disabled`, `name`,
`value`) stay unprefixed. Component-private state is `--_*`, and private HOST
state is a `:state()` (`toggleState`), never a public `data-*`. `data-type` is the component's Figma **Type** axis — whatever that
axis picks, a control, a shape, a look or a template (Will, 11d, 2026-10-01).

**16. CSS owns visibility.** JS sets a `data-*` on the host; CSS selects it. JS
never touches `.hidden`, `display` or `visibility` on a shadow node.

**17. Every element the component will ever show is in the template.** No
`createElement()` for structure, no structural `innerHTML`. Repeating items use
a cloning prototype. A typed child by tag name is not structure — `menuFor()`
building a `<sherpa-menu>` is that. Measured 2026-10-15: eight. Four are typed
(`menuFor()`'s menu and calendar, `SherpaToast.show`, a select group's children);
four build nothing a template could hold (the page's tokens `<link>`, the toasts'
shared stack in `document.body`, a stored view's allow-listed tags, a match's
`<mark>`). The nav's icon box and input-text's options are prototypes now (285).

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
| `renderData(payload)` | Override to draw a payload. The DEFAULT writes a payload's keys onto the attributes the component DECLARES in `static props` — a key it does not declare is skipped (TODO 195 declares the rest) |

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

## Where the docs are

**The RULES are the markdown files in this table, and code reads all but this one.** The
rest of `docs/` is record, not rule: the designs (`QUERY-DESIGN`,
`PROVIDER-DESIGN`, `PAGE-DEFINITION`), the code review's plan
(`CODE-REVIEW-PLAN`), the approved names (`LEXICON`), the ledger (`TODO`, the one
list of open work) and `TRAPS-INDEX`, which is made from `TRAPS`. The four old
reviews are in `docs/history/`: `COMPONENT-AUDIT`, `FILTER-REVIEW`,
`COMPONENT-API-AUDIT` and `CONSUMER-REVIEW`. Where one disagrees with the code,
the code and its gate win. `docs/components/` is the component reference:
written from the specs by `npm run reference`, never edited.

| File | Who reads it |
|---|---|
| `PRINCIPLES.md` | People. This file — the rules and the doors. Open work is in `TODO.md` |
| `TRAPS.md` | `check-traps` — a `TRAP T-…` citation must resolve to an entry, and that entry's `Site:` list must match who cites it; `npm run traps:write` makes `TRAPS-INDEX.md`, the entries by area, from those lists |
| `APP-GUIDE.md` | The MCP server, as `sherpa://app-guide` |
| `DEF-TO-FIGMA-BUILD-RULES.md` | The MCP server, as `sherpa://rules` |
| `DATA-SOURCE-RULES.md` | The MCP server, as `sherpa://data-rules` |

`TRAPS.md` is where the depth went, and it is gated both ways. That is the
trade: the citation stays beside the code, the essay moves out. Each `TRAP T-…`
comment in the code points at it.

If a rule here and a gate disagree, **the gate wins** — it runs.
