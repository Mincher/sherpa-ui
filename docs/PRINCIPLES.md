# Principles

The rules, stated once. Rules 1–14 each have a gate in the pre-commit hook —
facts about the codebase, not aspirations. Two of them, 5 and 6, only warn in the
hook; `npm run lint:css:strict` makes them errors. From 15 on, a reviewer holds
them.

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
- Can HTML or CSS do it? Then do it there. JS is the last resort.
- Anything generic is elevated (D5): a method to `SherpaElement`, a CSS rule to a
  shared sheet, picked by class. Only an edge case stays in a component. A shared
  sheet's `:host` rule holds only what EVERY component needs (box-sizing,
  `[hidden]`, the forced-colors ring) and inherited custom properties. It never
  holds a look, such as a border. A block whose target is the host becomes an
  inherited custom property, as `--sherpa-focus-ring` does
  (`T-one-value-one-declaration`). A family sheet may carry `:host` rules, because
  only its family adopts it.

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
| 5 | `@container`, never a viewport `@media`, inside a component. The one `@media` a component writes is `(forced-colors: active)`. `prefers-reduced-motion` is gated once, in `sherpa-motion.css` | `lint:css` `viewport-media` (a warning), `motion-gate` (an error) |
| 6 | Two grids: 4px for spacing, 2px for text. `/* off-grid-ok */` opts a drawn glyph out | `lint:css` `off-grid` (a warning; `lint:css:strict` blocks it) |
| 7 | No `light-dark()` in component CSS — the display-mode layer owns mode | `lint:css` `light-dark` |
| 8 | A colour binds the Style name Figma binds; a state is a mode pin in `state-pins.yaml`, never a colour rule. `/* theme-direct */` where Figma binds Theme too | `lint:css` `theme-active`, `theme-colour` (ratchet) |

### Contracts

| # | Rule | Gate |
|---|---|---|
| 9 | Every `:host([data-*])` and every `this.dataset` read is DECLARED in `static props`. A `kind: style` prop gets no JS branch | `check:props` |
| 10 | One owner per value. A bound component REPORTS; `data-locked` says the host owns it | `check:ownership` |
| 11 | A `TRAP T-…` citation resolves to an entry in `TRAPS.md`, and its Sites match who cites it. `TRAPS-INDEX.md` is made from those Sites | `check:traps` |
| 12 | A `.component.json` regenerates the source it describes, and is what that source generates now. Every slot says what it takes, in `data-accepts`, from one vocabulary: text, icon, control, input, content, item, menu, legend, header, footer, nav, panel, dialog, toolbar, badge (`T-a-slot-says-what-it-accepts`) | `spec:check` |
| 13 | The data layer imports no DOM — no `document`, `window`, `customElements`, storage — and no display component imports the app layer (`T-the-app-layer-is-opt-in`) | `lint`; `check:weight` proves it in `npm test` |
| 14 | Every file's header says what it holds, and ends in a `Map:` of its exports — one line each. A changed file carries its map; `npm run map` prints them all | `check:map` |

---

## 15 on: the conventions a reviewer holds

No gate, so a reviewer holds these. 15–18 were checked on 2026-09-22 and the
codebase obeys them.

**15. `data-*` is the public API.** Native attributes (`disabled`, `name`,
`value`) stay unprefixed. Component-private state is `--_*`, and private HOST
state is a `:state()` (`toggleState`), never a public `data-*`. `data-type` is the component's Figma **Type** axis — whatever that
axis picks, a control, a shape, a look or a template (Will, 11d, 2026-10-01).

- Every element is `sherpa-*`. Native attributes (`disabled`, `hidden`, `name`,
  `value`, `required`, `readonly`) stay bare.
- Reuse a standard name verbatim, never a synonym: `data-size`, `data-status`,
  `data-type`, `data-look`, `data-label`, `data-heading`, `data-description`,
  `data-icon-start`/`-end`, `data-current`, `data-selected`, `data-elevation`.
  Data components use `data-sort-field`/`data-sort-direction` (`asc|desc`) and
  `data-segment-field`.
- A CONTROL's text is `data-label`; a CONTAINER's is `data-heading`.
- `data-current` is one-of-many (the row you are on); the host's pointer is
  `data-current-id`. `data-selected` is any-of-many, for a ROW. A ticked control
  is `checked`.
- No aliases: a rename drops the old name in the same change
  (`T-a-rename-drops-the-old-name`). `docs/LEXICON.md` holds the moves.

**16. CSS owns visibility.** JS sets a `data-*` on the host; CSS selects it. JS
never touches `.hidden`, `display` or `visibility` on a shadow node. `lint`
blocks `.hidden =` and `.style.display|visibility =` (eslint
`no-restricted-syntax`). A reviewer holds the rest: no `classList` for a visual
state.

**17. Every element the component will ever show is in the template.** Its
default variant and its fixed text are in its `.html` and `.css` too: with no
`data-x`, the bare `:host` or `:host(:not([data-x]))` draws the default, and the
component never writes one (Will, 2026-10-19, TODO 344). No
`createElement()` for structure, no structural `innerHTML`. Repeating items use
a cloning prototype. A typed child by tag name is not structure — `menuFor()`
building a `<sherpa-menu>` is that. Measured 2026-10-15: eight. Four are typed
(`menuFor()`'s menu and calendar, `SherpaToast.show`, a select group's children);
four build nothing a template could hold (the page's tokens `<link>`, the toasts'
shared stack in `document.body`, a stored view's allow-listed tags, a match's
`<mark>`). The nav's icon box and input-text's options are prototypes now (285).

**18. Events are unprefixed `noun-verb`** — `page-change`, `nav-select`. Never
a `sherpa-` prefix. A re-dispatched native event keeps its native name, which
is why `sherpa-switch` emits `change`. The shared endings are `-click`,
`-change`, `-select`, `-open`/`-close`. Only a component's OWN events leave it;
a part's event stops at the composite's host (`T-an-inner-event-stops-at-its-host`).

**19. The words** (ratified 2026-09-24). Four words, one meaning each — in code,
comments, tests and docs.

| Term | Is | Where |
|---|---|---|
| **Section** | a label and divider in the nav. Visual only, does nothing | nav — `NavSection`, `sherpa-nav-section` |
| **Area** | a parent nav row. It expands and collapses its children; it never navigates | nav — a `NavEntry` with `children` |
| **Context** | a nav row that fills the app header and the content | nav — a `NavEntry` with an `href`; `?context=` in the URL |
| **View** | a preset or user-saved view definition, picked from the header's View chip | the View chip; also child rows of its Context when the session's `/nav/hierarchy` is on |

A Context's sub-pages are its **Views**, picked in the View chip. The session's
`/nav/hierarchy` also lists them as child rows, which makes the Context row an
Area. A View row picks THROUGH the chip, so the two never disagree. Add an Area
only when one is asked for. "View" is kept for saved views — `ViewSnapshot`,
`onViewPicked`, the `data-type="view"` toolbar and its `view-*` events.

**20. Tokens.** Read a token as `var(--sherpa-x, <the value it resolves to>)`.
The fallback is required, and it is the token's own value. A private value is
`--_*`. These are all projected from Figma by `scripts/project-tokens.mjs`:
`tokens.css`, the three generated shared sheets (`sherpa-typography.css`,
`sherpa-group-positions.css`, `sherpa-style-modes.css`), and every region above
`/* == end sherpa:tokens == */`. Edit Figma, re-export and re-project; never edit
those files (`T-a-generated-region-still-declares-api`).

**21. Report, do not derive** (ratified 2026-09-16). A component REPORTS what a
host might also control; it OWNS only what nothing outside it can see.
`data-<thing>` goes in; `<thing>-change` goes out, as a request. `data-locked`
is ONE attribute for the whole component, and a locked component still emits its
event. A sort suspends with `data-sort-field=""` and clears by being replaced. A
read-back getter (`grid.columnClause(field)`) answers what a host set. `ignore:`
on `bindSource()` gives one event to the view that owns it
(`T-ignore-is-the-scalpel`).

> Before shipping a component interaction, ask what a caller with no pointer
> would type to do the same thing. If there is no answer, it is not finished.
> `test/unit/parity-sweep.test.mjs` enforces the half of this that is mechanical.

**22. Comments are simple and concise — if they are needed at all** (ratified
2026-09-21; HTML, CSS, JS and TS alike).

| Cut | Keep |
|---|---|
| Multi-paragraph rationale | One-line summary on an export |
| Markdown tables in comments | A file header of one or two lines, ending in its `Map:` — one line per export |
| "It used to be X, which was wrong because Y" | A warning NOT obvious from the code — a silent failure, a browser quirk, an ordering constraint |
| Restating what the code plainly says | A line that looks like a mistake and is not |
| Worked examples longer than one line | `/* off-grid-ok */` and other pragmas |

Depth belongs in `docs/TRAPS.md`, which is gated both ways: a `TRAP T-some-id`
citation must survive verbatim, and the explanation lives in the doc. Two
regions are exempt because a generator owns them: everything above
`/* == end sherpa:tokens == */` in a component's CSS, and the `Public API:`,
`Slots:` and `Fires:` blocks in its HTML. Aim nearer 15% than 40%.

**23. No `@ts-expect-error` in `src/`**; there are none today. `lint` bans
`@ts-ignore` and `@ts-nocheck`, and allows `@ts-expect-error` only with a reason
of 10 or more characters IN the directive comment (typescript-eslint strict,
`ban-ts-comment`). The count of zero has no gate.

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

## Silent failures worth knowing before you start

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

**A CSS `@function` renders NOTHING in Firefox 155.** Write the longhand first
and the function second, inside `@supports`. Add a function only with that guard
and a test in all three engines (`T-a-css-function-needs-its-longhand-first`).

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

Check a generator by diffing its output. A `/* */` or `<!-- -->` inside a
template literal is OUTPUT, and a comment-stripper eats it.

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
