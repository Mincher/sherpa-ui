# Traps — Tests only

One of the eleven areas of [the traps](../TRAPS.md): each entry is here because its
first `Site:` is in this area (`npm run check:traps` holds it so). 13 entries.

### T-the-a11y-gate-reads-shadow-roots

**The accessibility gate is axe-core over ONE EXAMPLE per component, WCAG 2.1
level AA** — TODO 24. Each component's shipped `sherpa-<name>.example.json` is a
realistic instance, written as a page writes it
(`T-a-component-ships-its-example`); `test/e2e/a11y.spec.ts` draws each in the
harness and runs axe on it. Three things make a green result mean something.
**It is proved to read a shadow root**: a test puts an unnamed `<button>`
inside one and expects axe to report it, with a target that crosses the
boundary. A checker that reads only the light DOM sees almost nothing of a
Sherpa component and passes everything. **A name is asserted by ROLE**
(`getByRole('switch', { name })`), never by reading `aria-label` back — the
attribute was there all along on hosts where it named nothing
(`T-a-host-label-must-reach-its-control`). **Every component must have an
example**, so a new one cannot skip the gate.

The output is a REPORT per component in `test/a11y/reports/` (not tracked):
what is wrong, the criterion it breaks, and how to correct it. The failures
known today are in `test/a11y/baseline.json`, as a count per rule, and the
gate fails when a count is not EQUAL — a rise is a regression, and a fall
must be recorded (`npm run test:a11y:update`) so it cannot come back unseen.
Chromium only, in one worker: the rules are the same in every engine, and one
baseline file cannot hold three answers or take two writers.

Two lessons from the first run. An id reference (`aria-controls`,
`aria-labelledby`) cannot cross a shadow boundary, so a tab names its light-DOM
panel by TEXT. And a row whose label is hidden — a collapsed nav rail — has no
name at all unless the row carries `aria-label`.

- Site: `test/e2e/a11y.spec.ts`

### T-a-current-row-opens-its-details

**A row click opens that record in the app's details panel** — TODO 23. The
grid holds the CURRENT row BY KEY (`currentKey`), so a re-populate, which is
what an edit causes, keeps it. It was a row OBJECT, cleared on every populate.
A caller can do what a click does: `currentKey = key` sets it (silent, as
`select()` is), `neighbour(by)` reads the row above or below in drawn order,
and `stepCurrent(by)` moves to it. The panel's up and down chevrons use those,
and each disables at an end of the page. The panel lives in `index.html`, beside
the Assistant, and the Context fills it: the heading is the record's name, and
the body is every DECLARED field under its label, formatted by its type. A
drilldown has a trail, `Records › <name>`, but it is the PANEL's, in its
`breadcrumbs` slot, shown only while it is maximised (Will, TODO 303); the app
header shows none. Its first crumb shuts the panel. A crumb is a real
`<a href="?…">` to the page it is on, so the router finds no change and
nothing reloads.

- Site: `test/e2e/reforged-records-details.spec.ts`

### T-chromium-pointer-starts-on-the-page

**Chromium can start a test with its mouse pointer at (0, 0)** — on the page,
not off it — and whatever is drawn there gets a real, trusted `pointerenter`.
A probe (2026-10-02, Chromium 153 on Linux) logged `pointerover`,
`pointerenter`, `mouseover` and `mousemove` at (0, 0) on a freshly appended
`sherpa-nav`, with no test touching the mouse.

`#root` starts at (0, 0), so the first thing a spec draws sits under it. The
nav rail opened to `hover`, and five closed-rail tests read 320px. The app
shell MIRRORS its rail's state, so a test that set the shell to `pinned` was
overwritten with `hover` — 31 failures in 40 under parallel load, a pass when
run alone. On the Mac it showed as "the known nav flake": the same cause, seen
less often.

The components are right: a pointer really is on the rail. The fix is in the
harness — `gotoHarness()` parks the pointer at (-1, -1) once the page is ready.
A spec that loads the page with its own `page.goto` does not get that.

Both projects do it for every spec now: `test/e2e/fixture.ts` gives each test a
`page` that parks the pointer after every `goto` — sherpa-ui's `harness.ts`
builds on it — and a node test fails a spec that takes `test` from
`@playwright/test` (TODO 202, 203).

- Site: `test/e2e/harness.ts`
- Site: `test/e2e/fixture.ts`
- Site: `test/unit/e2e-fixture.test.mjs`

### T-a-test-must-click-what-the-listener-is-on

`element.click()` on a custom element HOST usually does nothing.

A Sherpa component listens on a node inside its own shadow root, not on itself:
`sherpa-button` on `.trigger`, `sherpa-select-checkbox` and
`sherpa-select-radio` on `.control`, `sherpa-quick-filter` on `.body`. A
synthetic `click()` on the host dispatches at the host and does not retarget
INTO the shadow tree, so it reaches no listener — and it fails quietly, because
`click()` returns nothing and the assertion that follows simply reads the
unchanged state.

This turns a working component into a "broken" one in a test, and it has cost
several tests on this branch. It bites hardest right after a bare `<input>` is
replaced by a component: the same selector still matches, the same `.click()`
still runs, and only the behaviour disappears.

```ts
box.click();                                              // reaches nothing
box.shadowRoot!.querySelector('.control')!.click();       // reaches the listener
```

A real user's click does retarget, so this is a synthetic-event problem only —
Playwright's own `locator.click()` is fine.

- Site: `test/e2e/reforged-data-grid.spec.ts`

### T-a-wall-of-values-is-not-a-filter

A text column's heading menu lists the column's distinct values to tick, with a
search box above them. That is right for Status (4 values) and wrong for Email
(100): the search box only FINDS in the wall, it never filters the rows.

Measured on the running page — the search itself works, 101 rows down to 2 on
"aisha" — which is exactly why the bug was confusing. Will: *"The search input
in the email column filter doesn't work."* It worked; it just did not do what a
reader typing an address expects.

Such a column is answered by TYPING — `advanced: 'only'`, opening on
`contains`. See TRAP T-a-filter-answers-by-values-conditions-or-both for the
three states and how they are configured.

**The HOST decides**, never the grid: how many values is too many is a question
about the data. `../Sherpa Demos/app/contexts/records.js` has one rule, `PICKABLE_AT_MOST`,
read by the bar's Add menu AND by the grid's headings, so the same column can
never be a list in one place and a box in the other.

- Site: `test/e2e/reforged-data-grid.spec.ts`

### T-one-query-builder-in-the-data-layer

A reading becomes a query in exactly ONE place: `stateClause()`, reached through
`ask({ field, reading })`. Anything else is a second builder, and a second builder
does not know what the first learned.

`DataSource.#steer` had one. `quick-filter-change` ran a private
`filterFromChips()` that turned `{ field: [values] }` into `in` clauses — no
field type, so a number column compared as text; no range, so two picks on a
slider meant a LIST; no conditions at all. Every fix to `stateClause` missed it.

Worse, both it and the grid's `filter-change` replaced the WHOLE query — so
typing in one column heading wiped every chip's selection and every component
contribution. (That door, `setFilter`, went in 366 step 11.)

The proof it was dead weight: `../Sherpa Demos/app/contexts/records.js` had to switch it
off, twice, with `ignore: ['quick-filter-change']` and `ignore: ['filter-change']`.
An app working around the data layer is the data layer being wrong.

Both now go through the one door. (The grid's filter row and its
`filter-change` went in TODO 523: a page's local filter toolbar does that job.) A control with a `readings` getter is ASKED
for it; one without has its `{ field: [values] }` read as READINGS, never as a
clause. `picksClause` then had no callers left in `data-source.ts` at all.

**The shape, stated once:** UI takes input → sends parameters to the data layer
→ the data layer transforms → it publishes a data change → UI reads the new
data back. Transforming never writes to the raw rows; only create, update and
remove do. `test/unit/raw-data-is-untouched.test.mjs` holds that half.

- Site: `test/unit/raw-data-is-untouched.test.mjs`
- Site: `test/unit/one-query-builder.test.mjs`
- Site: `test/reforged/harness.html`

### T-a-rename-drops-the-old-name

**A public name that is renamed drops the old one in the same change** (Will,
D4; code review Phase 2, 2026-10-14: a refactor deletes what it replaced). The
filter modes were renamed twice — to Default and Custom Condition Filter
(2026-09-25), then to Simple and Advanced (2026-09-27, TODO 75) — and each old
name was kept: `OLD_OPT_INS` and `OLD_MODES` in the menu, `OLD_KINDS` and two
def keys in `filter-kind.ts`, a chip's `data-kind="custom"`. They are gone, and
an old name does nothing. For an app that still writes one:

| was | now |
|---|---|
| `data-conditional`, `data-custom` | `data-advanced` |
| `data-conditions-only`, `data-custom-only` | `data-advanced-only` |
| `data-mode="select"`, `"default"` | `data-mode="simple"` |
| `data-mode="condition"`, `"custom"` | `data-mode="advanced"` |
| a def's `conditions`, `custom` | `advanced` |
| a def's kind `conditional`, `custom` | `advanced` |

**And the components' aliases**, the same day:

| component | was | now |
|---|---|---|
| `sherpa-list-item` | `data-heading` | `data-label` |
| `sherpa-app-header` | `data-title` | `data-heading` |
| `sherpa-toast` | `data-message` | `data-heading` |
| `sherpa-chat-message` | `data-author`, `data-time`, `data-content` | `data-name`, `data-timestamp`, `data-message` |
| `sherpa-progress-bar` | `data-value` | `value` |
| `sherpa-list` | `data-type="bordered"` | no `data-type`: it is the default |
| `sherpa-nav` | the type `NavItem`; `populate([…entries])` | `NavEntry`; `populate({ sections })` |
| `sherpa-notifications` | an item's `title` | `label` |
| `sherpa-metric` | `populate({ name })` | `populate({ label })` |
| `sherpa-file-upload` | `files-change` | `file-add`, `file-remove`, `file-clear` |

With no alias left, `static props` lost its `fallbackAttr` option, and
`check:props` the exception that counted one as a declaration.

One spelling in the DOM gives the CSS and every reader one value to match.
`OffersAdvanced` declares the def key ONCE — four def types each declared
`conditions` for themselves. The chip's `data-condition` and the menu's
`condition-mode-change` detail are reports, and their readers follow the new
words.

- Site: `test/e2e/reforged-advanced-condition-words.spec.ts`
- Site: `test/unit/the-def-speaks-the-new-words.test.mjs`
- Site: `test/e2e/reforged-num-coercion.spec.ts`
- Site: `test/e2e/reforged-metric.spec.ts`

### T-a-hairline-resolves-by-density

The border token is `0.5px`, and what a browser resolves that to depends on the
DISPLAY, not only on the engine. Measured in all four combinations:

| engine | dpr 1 | dpr 2 |
|---|---|---|
| Chromium | 1px | 1px |
| WebKit | 1px | **0.5px** |

WebKit at `deviceScaleFactor: 2` is the honest one — half a CSS pixel is exactly
one device pixel there, so there is nothing to round up. Playwright's
`devices['Desktop Safari']` sets `deviceScaleFactor: 2`, which is why only the
webkit project saw it, and why it looked like a flaky failure that "belonged to
border-token work".

`reforged-border-edges.spec.ts` hardcoded `1px/1px/1px/1px` and reported all 20
sites as broken on webkit. It now resolves the token once in the page and
compares every site against that, plus a bound that keeps the real regression
caught: a `border-style` with no width falls back to `medium` (3px), which is
what the test was written for. Verified by planting `border-width: medium` on
`sherpa-tag` and watching it fail.

- Site: `test/e2e/reforged-border-edges.spec.ts`
- Site: `test/e2e/reforged-callout.spec.ts`

### T-an-svg-path-box-rounds-by-a-hundredth

`getBoundingClientRect()` on an SVG `<path>` does not agree to the last decimal
across engines. Measured over all six button sizes:

| engine | worst delta from the token |
|---|---|
| Chromium | +0.0001 |
| WebKit | +0.0001 |
| Firefox | **+0.05** |

`reforged-icon-sizes.spec.ts` used `toBeCloseTo(14, 1)`, which demands a
difference **strictly below 0.05** — so Firefox failed by 0.00003px on a test
about whether an icon fills its box.

It now asserts the difference is at most 0.1px. That keeps what the test is for:
a wrong token is pixels out, not hundredths. Verified by forcing `.icon-start`
to 9px and watching the box assertions fail.

- Site: `test/e2e/reforged-icon-sizes.spec.ts`

### T-scroll-width-under-clip-is-engine-dependent

`overflow: clip` makes `scrollWidth` disagree across engines. Measured on one
truncated grid cell, 160px wide:

| engine | `scrollWidth` |
|---|---|
| Chromium | 377 |
| WebKit | 381 |
| Firefox | **159** — the CLIPPED width |

Everything that matters is identical in all three — the column is 160px,
`text-overflow: ellipsis`, `white-space: nowrap`, `overflow: clip` — so the
rendering is right and only the PROPERTY differs.

Measure the drawing instead. A `Range` over the node's contents reports
373 / 374 / 373 in the three engines:

```ts
const range = document.createRange();
range.selectNodeContents(cell);
range.getBoundingClientRect().width > cell.getBoundingClientRect().width + 1
```

- Site: `test/e2e/reforged-data-grid.spec.ts`

### T-a-text-range-box-differs-by-half-a-pixel

Two labels on one text line, measured with a `Range`, do not agree to the pixel
across engines. Measured on the quick-filter chip and its caret:

| engine | delta |
|---|---|
| Chromium | 0 |
| Firefox | 0 |
| WebKit | **0.5** — at dpr 1 AND dpr 2, so it is not density |

`toBeLessThan(0.5)` therefore failed on the boundary by nothing at all.

The two faults such a test exists to catch are exact and are asserted
separately: a different FACE (a `<button>` does not inherit the page font) and a
different LINE-HEIGHT (14 vs 20 puts the baselines in different places inside
boxes that share a midpoint). Half a pixel on a 20px line is neither.

- Site: `test/e2e/reforged-quick-filter.spec.ts`

### T-a-col-element-has-no-computed-width-in-webkit

`getComputedStyle(colEl).width` on a `<col>` inside a fixed table:

| engine | reports |
|---|---|
| Chromium | 56px |
| Firefox | 56px |
| WebKit | **0px** |

The PAINTED cell is 56px in all three, so the layout is correct everywhere and
only the property disagrees. Measure what is drawn:

```ts
Math.round(sr.querySelector('.select-cell')!.getBoundingClientRect().width)
```

**But an EMPTY grid paints 0 in every engine** — no body rows, so the table has
no width to hand the column. A test about the column DECLARATION reverting
(advanced 56 → plain 32) is asking a different question, and the honest probe
there is the custom property the rule reads, `--_select-w`, which every engine
resolves.

Two questions, two probes: what is DRAWN, and what is DECLARED.

- Site: `test/e2e/reforged-data-grid.spec.ts`

### T-the-fold-measures-whatever-font-is-loaded

A component that MEASURES text gets a different answer before the real font
arrives, and it does not re-measure on its own.

`sherpa-quick-filter-toolbar` folds chips until the bar stops overflowing.
Measured against fallback metrics it folded **3**; once the body font landed the
same bar needed **4**, so it came to rest overflowing and the test read it as a
fold bug. The values before and after, on one 300px bar:

```
before fonts   over: 2   folded: 3
after  fonts   over: 0   folded: 4
```

Waiting for icon faces sizes nothing, and the body font is what sizes a label.
The harness waits on `document.fonts.ready`, because Inter is not declared by the page at
all when it comes from the OS, so there is no named face to `fonts.load()`.

The ceiling stays: `fonts.ready` has no timeout of its own, and losing the race
only costs a text measurement.

- Site: `test/reforged/harness.html`
