# Component audit — 2026-09-23

58 components, 24,635 lines (11,066 TS · 10,252 CSS · 3,317 HTML).

Every claim below was measured or grepped, not inferred. Where a first reading
was wrong, the correction is kept — the wrong version is usually the more
tempting one.

---

## 1. The shared sheets

There are **seven**, not one. Every one is adopted into every shadow root
(`src/index.ts:28`).

| sheet | lines | holds |
|---|---:|---|
| `sherpa-base.css` | 110 | `:host` defaults, `--shade()` / `--tint()`, `.sherpa-truncate`, `.sherpa-inert` |
| `sherpa-typography.css` | 222 | **generated** — the type scale |
| `sherpa-grouping.css` | 171 | controls that read as one object |
| `sherpa-icon.css` | 58 | the icon wrapper |
| `sherpa-group-positions.css` | 231 | **generated** — grouping positions |
| `sherpa-anchor.css` | 95 | anchored tips — `.chart-tip`, `.sherpa-tip` |
| `sherpa-motion.css` | 39 | durations, shared keyframes |

**CLAUDE.md was wrong about two of these, in different ways.** (Fixed — see
"Fixes applied" below. Kept here because the findings are the reason.)

It says `.chart-tip` and `.sherpa-snap-group` both live in `sherpa-base.css`.

- `.chart-tip` is real and shared, but it is in `sherpa-anchor.css:8`. Only the
  file name in the doc is wrong.
- `.sherpa-snap-group` **does not exist anywhere in the codebase.** Grepping
  `src/` and `examples/` returns nothing. It was renamed: the behaviour now
  lives in `sherpa-grouping.css` as `.sherpa-group` (+ `.sherpa-group-vertical`,
  `.sherpa-group-grid`), and it works exactly as the doc describes — keyed off
  `:first-child` / `:last-child` at `sherpa-grouping.css:30,35` so a re-order
  survives.

  Two things rotted with the rename. CLAUDE.md still teaches the old class name,
  so anyone following it writes markup that silently does nothing. And the same
  paragraph says each child "keeps its own `data-snap` as the honest description
  of what it is" — `data-snap` appears in **zero** component CSS files.

That matters because the rule "when the same rule appears in a third component,
move it to `sherpa-base.css`" names the wrong destination. The real question is
*which* of the seven sheets. Base is for what every component needs; the others
are opt-in by class.

### The per-edge border paragraph described deleted code (fixed)

CLAUDE.md says the four `border-*-width: var(--sherpa-border-{top,bottom,left,right})`
lines "appear in 21 components and cannot become a shorthand", and instructs the
reader to **leave them**.

Measured: **zero** components contain a per-edge `border-*-width` declaration.
The refactor the doc warns against has already happened — the four lines now
live once, in `sherpa-grouping.css:149` as `.sherpa-border-edges`, alongside
`.sherpa-border-corners` at `:166`. Both moved to *logical* properties on the
way (`border-block-start-width`, `border-start-start-radius`), so they follow
the writing direction; that sheet's own comment records the corners were
"written verbatim 26 times across 21 components" before the lift.

So the doc preserves a caution against a cleanup that was completed, and would
stop someone repeating it elsewhere.

### The doc-rot pattern

Three of the claims checked in this section were stale, all in the same
direction: **the code improved and the doc kept the old warning**.

| claim | reality |
|---|---|
| `.chart-tip` in `sherpa-base.css` | it is in `sherpa-anchor.css:8` |
| `.sherpa-snap-group` + `data-snap` | renamed to `.sherpa-group`; `data-snap` gone |
| per-edge borders in 21 components | zero; lifted to `.sherpa-border-edges` |

Two claims did check out: `src/` has **zero** `@ts-expect-error`, and the focus
ring is a shared custom property used by **31** components.

---

## 2. Two vocabularies for "the text on this thing"

The clearest finding in the whole audit.

| attribute | components |
|---|---:|
| `data-label` | 19 |
| `data-heading` | 14 |
| `data-description` | 10 |
| `data-text` | 1 (`sherpa-tooltip`) |
| `data-title` | 1 (`sherpa-app-header`, as an alias) |
| `data-sublabel` | 1 (`sherpa-donut-chart`) |

`data-label` — button, calendar, calendar-cell, donut-chart, file-upload,
gauge-chart, input-text, list-item, metric, nav-item, nav-section, progress-bar,
quick-filter, quick-filter-toolbar, select-card, select-checkbox, select-group,
select-radio, slider

`data-heading` — accordion, app-header, callout, container-header, data-grid,
dialog, empty-state, list-item, menu, overlay-panel, panel,
quick-filter-toolbar, section-header, toast

**The split is not arbitrary, and it is not clean either.** Reading the two
lists, `data-label` lands on *controls* (things you operate) and `data-heading`
on *containers* (things that hold other things). That is a defensible line. But:

- `sherpa-list-item` declares **both** (`sherpa-list-item.ts:34`)
- `sherpa-quick-filter-toolbar` declares **both**
- The two aliases point in **opposite directions**:
  - `list-item` — `data-label` primary, `data-heading` is the `fallbackAttr`
  - `app-header` — `data-heading` primary, `data-title` is the `fallbackAttr`

So the alias machinery already exists and is already used; it simply has no
agreed direction. Picking one direction per tier (control → `data-label`,
container → `data-heading`) and making every alias point that way is a small,
mechanical change that removes the guesswork.

---

## 3. Event names

75 distinct events. The verb distribution:

| verb | count |
|---|---:|
| `-change` | 18 |
| `-click` | 11 |
| `-select` | 5 |
| `-remove` | 4 |
| `-dismiss` | 3 |
| `-clear` | 3 |

### Confirmed inconsistency: breadcrumbs

| component | event |
|---|---|
| `sherpa-breadcrumbs` | `breadcrumb-select` (`sherpa-breadcrumbs.ts:57`) |
| `sherpa-app-header` | `breadcrumb-click` (`sherpa-app-header.ts:169`) |

Same user action, same detail shape (`{ index, label, href }`), two names — and
the app-header *contains* the breadcrumbs. A consumer listening for one misses
the other. `examples/index.html:391` listens for `breadcrumb-click`, so the
app-header's name is the one in use.

### NOT a finding: bare `change` / `input`

`accordion`, `dialog`, `input-text`, `overlay-panel`, `select-*`, `switch`,
`slider` emit unprefixed `change` / `input` / `toggle` / `close`. This looked
like drift and is not — the naming contract in CLAUDE.md explicitly lists
`change`/`input` as re-dispatched native events. Left alone.

---

## 4. Progressive enhancement — largely honoured

This is the part of the audit that came back cleanest, and it is worth saying
so rather than manufacturing findings.

**JS touching visibility directly: 2 sites in 58 components.**

```
sherpa-quick-filter-toolbar.ts:1567  chip.classList.remove('chip');
sherpa-quick-filter-toolbar.ts:1568  chip.classList.add('organise-chip');
```

Both in one component, both swapping a *variant* class rather than toggling
visibility — so even these are a soft violation, not the `display: none` the
rule exists to prevent.

**`createElement` in components: 9 calls across 5 files.**

| file | calls |
|---|---:|
| `sherpa-line-chart.ts` | 4 |
| `sherpa-toast.ts` | 2 |
| `sherpa-select-group.ts` | 1 |
| `sherpa-nav.ts` | 1 |
| `sherpa-input-text.ts` | 1 |

The line-chart ones are the interesting case: SVG cloned from an HTML template
lands in the wrong namespace and paints nothing (a documented trap), so
`createElement`/`createElementNS` there may be the *correct* answer rather than
a violation. Needs a read, not a rule.

---

## 5. `static props` — the migration is mostly done

22 components still pair `static observed` with a hand-written `#syncX()`
method — the pattern `static props` was introduced to replace. That looks like
47 methods of legacy.

It mostly is not. CLAUDE.md lists the cases where a hand-written sync is
correct — a computed value, a runtime selector choice, a text template — and
almost all of them qualify. Filtering to sync methods that *only* write text
into the shadow DOM, which is exactly what `kind: 'content'` does:

| component | method |
|---|---|
| `sherpa-button` | `#syncLabel`, `#syncBadge` |
| `sherpa-code-block` | `#syncCode` |
| `sherpa-input-text` | `#syncValue` |
| `sherpa-quick-filter` | `#syncEmpty` |

**Five methods, four components.** Everything else writes ARIA
(`#syncCollapsed` sets `aria-expanded`), picks a selector at runtime, or builds
a string — none of which a declaration can express.

13 components declare no `static props` at all, but that is not a gap either:
`sherpa-button` declares `data-label` through `static observed` instead, which
is the same contract by the older route.

So this is a small, genuinely optional tidy — not the refactor the raw count
suggests.

---

## Per-family detail

Six parallel audits (forms, data display, charts, navigation, containers,
filters). Merged in as they land. Every claim below was re-checked against the
code before inclusion.

---

### Forms & controls — 10 components

`input-text` · `select-card` · `select-checkbox` · `select-group` ·
`select-radio` · `slider` · `switch` · `file-upload` · `button` · `chip`

#### Verified findings, worst first

**1. `sherpa-slider` says `Events:` where every other component says `Fires:`**

`sherpa-slider.html:16`. It is the only one of 58 — the other 53 event-bearing
templates all use `Fires:`.

The consequence is not cosmetic. The generator reads `Fires:` to build the
contract, so the slider's spec records this:

```yaml
name: input      detail: { value: unknown }
name: change     detail: { value: unknown }
```

But in range mode the component emits a completely different shape
(`sherpa-slider.ts:197`):

```ts
this.emit(event, { start: next[0], end: next[1] });
```

**The entire range detail is missing from the contract**, and anything reading
the spec — the MCP server, an agent, a consumer — sees only `{ value }`. One
word fixes it; regenerate afterwards.

**2. `sherpa-file-upload` hand-draws four buttons**

Zero `sherpa-button` in its template. Four hand-rolled controls instead:
`.browse` (`:83`), `.file-remove` (`:169`), `.clear-all` (`:237`), `.upload`
(`:266`) — together re-deriving padding, border, radius, focus ring, hover and
active shading, and disabled state, in ~95 of the file's 279 CSS lines.

Its own sibling shows the right answer, with the trap cited in the markup
(`sherpa-select-checkbox.html:47`):

```html
<!-- A real sherpa-button, not a hand-drawn one — T-compose-never-reimplement. -->
<sherpa-button class="caret" data-type="icon" data-size="sm" …>
```

**3. `sherpa-switch` declares nothing, so its attributes are inert**

No `static props`, no `static observed`, no `variantAttrs` — confirmed by grep.
`observedAttributes` is built from the union of those three
(`sherpa-element.ts:229`), so it is `[]`.

Setting `checked` or `disabled` **as an attribute** after first render never
reaches the inner `<input>`. The JS property setters do work, so this is the
attribute path only — but every other control in the family observes its
natives. Its `data-type="simple"` is also real, documented and in the spec,
yet declared in no TS.

**4. Three holes in `check-props`, found by running the gate rather than reading it**

The gate passes on all ten components while real public API goes undeclared:

| hole | effect |
|---|---|
| the scan slices off everything above `/* == end sherpa:tokens == */` | hides `sherpa-switch`'s `data-type`, `sherpa-button`'s `data-look` + `data-size` |
| the read-scan only matches `this.dataset['x']` | misses `hasAttribute` / `toggleAttribute` — `data-dragover`, `data-loading` |
| the `data-has-*` skip | meant for base-class slot writes, also exempts hand-written ones — `data-has-files` |

Fixing the first alone surfaces three attributes on the two most-used controls
in the system.

**5. `data-size` has two contradictory contracts**

`SHARED_PROPS['data-size']` (`sherpa-element.ts:869`) declares `['sm','lg']`.
`sherpa-button` ships five — `2xs xs sm lg xl` (`sherpa-button.css:15-58`), and
its own spec agrees. Any component adopting the shared declaration inherits an
enum that contradicts the system's most-used control.

#### Naming drift within the family

| concept | names in use |
|---|---|
| helper line under a label | `data-description` (4 components) vs **`data-helper`** (`file-upload` alone) |
| one-vs-many selection | `data-select-mode="radio\|checkbox"` vs `data-multiple` vs `data-multiline` |
| non-native attributes | all `data-*` — except **`value-start` / `value-end`** on the slider, unprefixed but not native HTML |

`data-type` means five unrelated things: which control element (`input-text`),
how many thumbs (`slider`), pill vs rectangle (`switch`), square vs labelled
(`button`). Four of the five pick a *template*, which is at least a consistent
role — but nothing in the name says so.

**The same label renders in different greys.** Four sibling controls, one visual
role:

| component | `.label` colour |
|---|---|
| `select-radio` | `content-body-base` (#0c0b11) |
| `select-checkbox` | **`content-body-1`** (#35353d) |
| `select-group` | `content-body-base` |
| `input-text` | `content-body-base` |

A checkbox and a radio side by side in a `select-card` footer render their
labels differently. `.description` diverges the same way (`body-1` vs `body-2`).

#### What is clean — worth stating

**Zero visibility violations in all ten.** No `classList.add/remove/toggle`, no
`.style.display`, no `.hidden =` on shadow internals. The only
`style.setProperty` calls write `--_pct` on the slider, which is the sanctioned
numeric bridge and documented as such.

**Zero dead CSS classes in nine of ten.** The exception is `.label` in
`sherpa-chip` (`.html:28,35`) — no reference in its CSS or TS.

#### A repo-wide convention that has lapsed

CLAUDE.md says "every dispatched event must have a matching `@fires` tag in the
component's JSDoc". In this family **one of ten** has one (`sherpa-button.ts:7`).
The other nine document events only in the HTML `Fires:` comment. If the other
families show the same ratio, this needs one ruling, not 58 fixes.

#### Claims checked and rejected

The auditing agent flagged three of its own findings as wrong after running the
gate, and I re-checked the rest. Not findings:

- `data-selected`, `data-advanced`, `data-multiple` are **validly declared** —
  `check-props.mjs:78` accepts `observed` and `variantAttrs`, not just `props`.
- `sherpa-select-group.ts:105` `createElement` — sanctioned by PRINCIPLES
  rule 15 as "a typed child by tag name".
- The per-edge border chain in `input-text` and `button` — explicitly sanctioned
  in CLAUDE.md, though see §1: it no longer exists anywhere else.
- `--sherpa-button-*` / `--sherpa-switch-*` — projected Figma tokens, not
  mis-named privates.

---

## The findings that matter, across all six families

Six audits ran in parallel. Everything below was re-checked against the code
before it was written down; where a first reading was wrong, the correction is
kept.

**Every gate passes.** `check:props`, `check:ownership`, `lint:css`,
`spec:check` (58/58) are all green. Nothing here is a gate failure — it is what
the gates do not look at.

### 1. `sherpa-app-header` publishes 1 of its 9 events

The worst finding in the audit, and it is silent.

Its `Fires:` comment names eight events (`header-back`, `header-ai`,
`header-theme` …) that **exist nowhere in the codebase**. The real names live in
an `ACTIONS` table (`sherpa-app-header.ts:24`) and are emitted through a
variable:

```ts
this.$(sel)?.addEventListener('button-click', () => this.emit(event, {}));
```

The generator builds the contract by intersecting the `Fires:` comment with the
emitted names. The intersection is empty, so:

```
spec lists: ['breadcrumb-click']
code emits:  back-click ai-click labs-click theme-toggle
             notifications-open account-click help-click menu-click
             breadcrumb-click
```

Eight public events are invisible to the spec, the MCP, and any agent reading
either. The examples wire them correctly by hand, so nothing is *broken* — the
contract is just wrong.

**A measurement note against myself.** My first sweep reported this component as
clean, because my regex only matched `emit('literal')` and this file emits
through a variable. Two agents said otherwise and they were right. Worth
remembering: a component that emits from a table is invisible to a
string-literal grep.

### 2. One phantom event in the data-grid's contract

Measured across all 58 components, exactly **one** spec disagrees with its code
in a way a literal scan can see:

| component | emits | spec | |
|---|---:|---:|---|
| `sherpa-data-grid` | 9 | 10 | **phantom `menu-clear`** |

`sherpa-data-grid.ts:621` constructs a `CustomEvent('menu-clear')` and passes it
straight to a handler as an argument. It is `bubbles: false` and never reaches
`dispatchEvent`. The generator scrapes `new CustomEvent` and cannot tell a
dispatched event from a constructed one, so a public event that does not exist
entered the contract — and `spec:check` certifies it.

Two smaller drops of the same kind: `sherpa-menu` writes `menu-open /
menu-close` on one `Fires:` line, so the pair is dropped; the quick-filter
toolbar omits `filter-remove` from its comment, so it is dropped too.

### 3. `@fires` is a dead convention (fixed)

CLAUDE.md: *"Every dispatched event must have a matching `@fires` tag in the
component's JSDoc (the MCP parses these into the component schema)."*

Measured: **one** `@fires` exists in the entire `src/` tree
(`sherpa-button.ts:7`). 54 components carry an HTML `Fires:` block instead, and
that is what the generator actually reads — as CLAUDE.md itself explains two
sections later.

The two statements contradict each other and the first is false. Per the
repo's own rule — *"Gate it or delete it"* — delete the sentence.

All six auditors found this independently. It needs one ruling, not 58 fixes.

### 4. Three CSS blocks are far past the "third component" rule

Counted repo-wide:

| block | components |
|---|---:|
| the card-surface quartet (`--_surface`/`--_border`/`--_divider`/`--_pad`) | **12** |
| the disabled inactive-token triple | **14** |
| the `color-mix` hover longhand | **8** |

The hover one is the sharpest. The `--shade()` / `--tint()` functions are
already shared in `sherpa-base.css` — what is copy-pasted eight times is the
*mandatory longhand fallback* beside them. `T-a-css-function-needs-its-longhand-first`
exists because a copy can lose its longhand, and there are eight copies.

The elevation shadow is the same story: nine components each hand-write a
`box-shadow` with its own comment explaining that *"a `[data-elevation]` pin is
a bare selector in tokens.css and never reaches this shadow root"*. Nine
independent workarounds for one gap in the token layer. `sherpa-panel` cannot be
elevated at all as a result.

All four belong in a shared sheet as **custom properties**, not classes — a
bare `:host` cannot wear a class from its own sheet, which is exactly why
`--sherpa-focus-ring` took that shape.

### 5. Dead code that actively misleads

| what | where |
|---|---|
| `data-label` on barchart + line-chart | documented, spec'd, **set by 4 example call sites**, implemented nowhere |
| 4 calendar cell attributes | `data-today`, `data-selected`, `data-in-range`, `data-range-end` written 6× — **read by zero CSS**, with a comment claiming otherwise |
| 3 toolbar cloning prototypes | `qf-row-tpl`, `qf-all-tpl`, `qf-divider-tpl` — superseded when stamping moved into `sherpa-menu` |
| `data-min-item` on `sherpa-stack` | documented; no rule maps it to `--_min-item` |
| dead classes | `.label` (chip, tabs, tag), `.region` (app-shell), `.pair-back`/`.pair-fwd` (pagination), `.check` (grid-cell), `.menu-all` (menu), `.save-btn` (toolbar) |
| dead `--_*` | `--_size` (donut), `--_fill-pct` (gauge), `--_focus` (select-checkbox), `--_measure` (stack) |

The `data-label` one is live: four templates set a heading that never renders.
The visible headings come from a sibling `<sherpa-container-header>`, so nobody
noticed.

### 6. One vocabulary, many spellings

The highest-value section, because it is what a reader has to hold in their head.

**"Which one is picked"** — four names for one idea:
`data-active-id` (nav) · `data-current-id` (tabs) · `data-current` (nav-item,
list-item) · `data-tab-active` (tabs, on the panel — one line from its own
`data-current`).

**"The user picked one"** — three verbs:
`nav-select` · `tab-change` · `breadcrumb-select`. And the sharpest case:
`sherpa-breadcrumbs` emits `breadcrumb-select`; `sherpa-app-header` listens and
re-emits the identical detail as **`breadcrumb-click`**, one hop later.

**"Make this go away"** — three antonyms for `show()`:
`close()` (dialog, overlay-panel) · `hide()` (notifications, menu) ·
`dismiss()` (toast, callout). And `SherpaToast.show()` is a static that
*creates* a toast, while every other `show()` reveals an existing one.

**`data-type`** means at least nine different things: which control element,
how many thumbs, pill vs rectangle, square vs labelled, a look, a template
variant, a scope, a cardinality, a role.

**`data-empty`** means three: a message string (list), a host boolean (grid), a
per-pane boolean (transfer-list).

**`quick-filter-change`** carries **three** different detail shapes under one
name — and the HTML documents a fourth that matches none of them.

**Same event, different detail:** `sherpa-data-grid` fires `sort-change` with
`{field, direction}`; `sherpa-grid-cell` fires it with `{direction}` — no field,
unusable above one cell. `group-toggle` is worse: `{collapsed}` from one,
`{expanded}` from the other. **Inverted sense, same gesture.**

### 7. Composition, skipped in four places

The rule is *compose, never re-implement*. Where it is broken:

- **`sherpa-file-upload`** hand-draws four buttons (~95 of its 279 CSS lines).
  Zero `sherpa-button` in its template.
- **`sherpa-calendar`** re-implements the menu's card and its Today/Cancel/Apply
  footer (~76 lines) while `sherpa-container-footer` sits composed in four
  other components. It composes `sherpa-button` for its stepper three lines
  earlier in the same file.
- **`sherpa-prompt-composer`** is the only non-chart component with inline
  `<svg>` — three hand-drawn buttons where the icon system exists.
- **`sherpa-grid-cell`** is an orphan: every part of it is re-implemented inside
  `sherpa-data-grid`, and the two disagree about what their shared events mean.
- **`sherpa-nav-section`** is the inverse — a real component that
  `sherpa-nav` never uses, drawing the same label-plus-rule itself.

### 8. State ownership — the named recurring bug, still recurring

The convention: `data-<thing>` in, `<thing>-change` out, `data-locked` to hand
ownership to the host.

**`data-locked` is implemented by 5 components and ignored by the rest.** The
gate only examines components that already opted in, so a component with no
`data-locked` support is invisible to it.

The sharpest case is a locked chip that is not actually locked:
`sherpa-quick-filter` correctly defers when locked — then the toolbar catches
the event in *capture*, calls `stopImmediatePropagation()`, and writes
`data-current` itself. The chip's correct deference is undone one level up.

`sherpa-nav` and `sherpa-tabs` both write the selection *then* report it, so a
host cannot veto a navigation. `sherpa-list` derives "which row is current" by
reading and mutating its children's attributes — the canonical form of the bug.

### 9. What is genuinely clean

Worth stating, because the audit could read as a list of faults.

- **Rule 14 (CSS owns visibility) holds across all 58 components.** Six
  independent auditors looked for `classList`/`display`/`hidden` on shadow
  internals and found two soft cases, both swapping a variant class.
- **Rule 15 (templates hold everything) holds.** Nine `createElement` calls
  repo-wide, most of them sanctioned self-creation or namespaced SVG.
- **Native elements are used where they exist** — `<details>` in accordion,
  `showModal()` in dialog, `<progress>` in progress-bar, `popover` in menu and
  tooltip. The brief for one family assumed dialog hand-rolled its modality; it
  does not.
- **The data layer is in good shape.** The charts' duplication is entirely in
  presentation; `chartScale`, `formatTick`, `seriesSlot` and friends are shared
  and correctly used.
- **Reference implementations exist** to copy from: `sherpa-key-value-list`
  (zero API mismatches), `sherpa-menu` (ownership and popover positioning),
  `sherpa-dialog` (native modality), `sherpa-notifications` (composition).

---

## Fixes applied

### 1 — `sherpa-app-header` publishes all 9 events (was 1)

Fixing the `Fires:` comment was necessary and **not sufficient**. The generator
also scans the TS for `emit('name')`, and this component emits through a
variable (`emit(event, {})`) with the names held in an `ACTIONS` table — so the
code half of the intersection was empty too.

The scanner now also reads the second column of a `['.selector', 'noun-verb']`
pair. The selector half anchors it, so a plain array of strings cannot match.

A first attempt read *every* string literal in the file. It swept up
`data-anchor` and `aria-describedby` and wrote phantom events into all 58
specs — 2401 inserted lines, the exact bug the intersection exists to prevent.
Reverted, then done narrowly. `TRAP T-an-event-name-is-not-always-a-literal`.

### 2 — `sherpa-slider`'s range detail reaches the contract

`Events:` → `Fires:`, the only such deviation in 58 components. The detail
shapes were already written correctly underneath it; nothing else changed.

### 3 — Two more dropped events

A `Fires:` line reading `menu-open / menu-close` is read as **one** name, so
`menu-close` was missing. Same for the toolbar's `group-change / sort-change`.
Split onto their own lines, and `filter-remove` added — the comment had never
mentioned it.

**Net: 10 events recovered across 2 components, 0 invented, 0 lost.**

| component | before | after |
|---|---:|---:|
| `sherpa-app-header` | 1 | **9** |
| `sherpa-menu` | 8 | **10** |

### 4 — The `@fires` sentence is gone from CLAUDE.md

It claimed the MCP parses `@fires` JSDoc tags. It does not, and exactly one tag
exists in the repo. Replaced with what actually governs the contract: the HTML
`Fires:` block, one event per line, because that comment is what the generator
intersects with the code.

### 5 — The shared-CSS section rewritten

Three claims in one section were stale, all in the same direction — the code
improved and the doc kept the old warning:

| doc said | actually |
|---|---|
| shared CSS lives in `sherpa-base.css` | **seven** sheets are adopted; pick by job |
| `.chart-tip` is in `sherpa-base.css` | it is in `sherpa-anchor.css` |
| `.sherpa-snap-group` + `data-snap` | renamed `.sherpa-group`; `data-snap` gone |
| per-edge borders in 21 components, "leave them" | **zero** — lifted to `.sherpa-border-edges` |

The last was the most costly: it preserved a caution against a cleanup that had
already been completed, which would have stopped someone repeating it.

Also recorded the rule that explains the shape of these sheets: **a `:host`
cannot wear a class from its own sheet**, which is why a repeating host-level
block has to become an inherited custom property rather than a class.

### 6 — Dead code removed

Six class tokens and three custom properties, each verified unreferenced in CSS,
TS, tests and examples before removal. **Every element stayed** — only the
unused token went, because a class with no rule reads as a styling hook that
already works.

| removed | from |
|---|---|
| `.label` | chip, tag |
| `.check` | grid-cell |
| `.save-btn` | quick-filter-toolbar |
| `.pair-back`, `.pair-fwd` | pagination |
| `.menu-all` | menu (its sibling `.qf-all` is live) |
| `.region` | app-shell |
| `--_size` | donut-chart |
| `--_fill-pct` | gauge-chart (left over from a stroke-dash implementation) |
| `--_focus` | select-checkbox |

**One removal was wrong and got reverted.** `.label` in `sherpa-tabs` looked
identical to the chip and tag cases — no rule in its CSS, no reference in its
TS. But `reforged-tabs.spec.ts:44` queries `.tab[data-current] .label`, and two
tests failed immediately.

My check had scanned CSS and TS and not the test files. A class can be load-
bearing for a test without being load-bearing for a render. I re-ran the check
across `test/` and `examples/` for all seven; only tabs was affected.

### 7 — `data-min-item` now does something

`sherpa-stack` documented it as "the floor an item may shrink to (default
200px)". No rule mapped the attribute to `--_min-item`, so the 200px default
applied whatever you set — and `examples/templates/settings.html:81` carries a
comment claiming the row "reflows the cards at data-min-item", which it never
did.

Wired as an enum, matching `data-gap` beside it, so the sizes stay on the grid:

```css
:host([data-min-item="sm"]) { --_min-item: 120px; }
:host([data-min-item="md"]) { --_min-item: 200px; }   /* the old default */
:host([data-min-item="lg"]) { --_min-item: 280px; }
:host([data-min-item="xl"]) { --_min-item: 360px; }
```

Also dropped `var(--_measure, 90ch)` to a plain `90ch`: the property was never
declared, so the fallback was the only value it ever had.

---

### 8 — The hover shade is one declaration, not 17

Every interactive control wrote the same two `@supports` blocks: a `color-mix`
longhand, then the named `--shade()` function second so it wins where
`@function` is real. Eleven lines, 17 times, across 8 components.

```css
/* what each site used to carry */
@supports (color: color-mix(in oklab, red, blue)) {
  &:hover  { background: color-mix(in oklab, var(--_surface) 92%, currentColor); }
  &:active { background: color-mix(in oklab, var(--_surface) 84%, currentColor); }
}
@supports (background: --shade(red, 8%)) {
  &:hover  { background: --shade(var(--_surface), 8%); }
  &:active { background: --shade(var(--_surface), 16%); }
}
```

Now two inherited properties in `sherpa-base.css`, and each site reads them:

```css
&:hover  { background: var(--sherpa-shade-hover); }
&:active { background: var(--sherpa-shade-active); }
```

**Why a property works here.** `currentColor` resolves where the property is
*used*, not where it is declared — measured directly: two siblings with
different ink shade differently from one declaration. And `--_shade-base` reads
`var(--_surface, …)`, so a component that sets its own surface keeps shading it.
Verified on `sherpa-button`, whose three looks resolve to `#fff`, `#3b4ccd` and
transparent respectively.

**The `@supports` pair disappears entirely.** A `color-mix()` *is* the longhand,
so there is no function to guard and no longhand for a copy to lose — which was
the whole reason for `T-a-css-function-needs-its-longhand-first`.

Proved identical rather than assumed: the painted `backgroundColor` was captured
on hover for four controls, then the change was reverted, rebuilt, and captured
again. Same values to the last decimal in all three engines.

**Net −41 lines.**

#### A failure I had to chase down

After the migration the batch reported 2 failed where it had shown 1 failed +
1 flaky. The diff was colour-only and the failure was a *width* — 187px where
24px was expected — so it looked unrelated, which is exactly when it is worth
checking rather than waving through.

Run alone, the test passed three times with the change and three times without.
Run in the 9-file batch on the **unchanged** build, it failed twice then once.
So it is load-dependent flakiness in a hover-timing test, and it predates this
work. The first reading — "1 flaky became 2 failed" — was itself noise.

---

### 9 — The card quartet, lifted opt-in

Six components declared the same four values verbatim — accordion, container,
dialog, overlay-panel, panel, select-card. They now read a shared default:

```css
/* sherpa-base.css :host */
--sherpa-card-surface: var(--_status-surface, var(--sherpa-style-surface-base, #ffffff));
--sherpa-card-border:  var(--_status-border,  var(--sherpa-style-border-base, #b3b3c3));
--sherpa-card-divider: var(--sherpa-theme-border-default-1, #e8e8f6);
--sherpa-card-pad:     var(--sherpa-theme-padding-lg, 16px);
```

**Properties, not a class.** Five of the six declare these on `:host`, and a
`:host` cannot wear a class from its own sheet — the same constraint that made
`--sherpa-focus-ring` a property.

**Public names, private aliases kept.** Each component keeps
`--_surface: var(--sherpa-card-surface)`, so every rule body that already reads
`--_surface` is untouched, and `--_*` keeps meaning "private".

**Opt-in by omission.** Six *other* components use `--_surface` to mean
something different on purpose: callout is deliberately status-blind, toast uses
the subtle tier, checkbox and radio use a different token. Their own `:host`
rule wins over the shared one — verified in all three engines — so they simply
keep their declaration and nothing about them changes. Confirmed: only six files
were touched.

`select-card` kept its own `--_border`: its fallback is
`theme-border-default-2`, not `style-border-base`. That is a real divergence and
normalising it would have changed a colour silently.

Values proved unchanged the same way as the shade: resolved all four properties
on all six components, reverted, rebuilt, resolved again. Identical.

### Measured and NOT lifted

Two candidates from the audit turned out not to be duplication once counted.

**The disabled-token triple — 14 components, and the count is misleading.**
Only **45%** of the 110 uses sit inside a `[disabled]` selector.
`border-default-2` alone appears 61 times across 32 files, mostly as an ordinary
border. The three tokens do not cluster: of the 14 files, one uses all three
once and the rest use them in wildly different proportions.

The *values* are already centralised in `tokens.css`. What repeats is which
property each component paints for its own disabled state, and that genuinely
differs — `sherpa-pagination` even documents why `.sherpa-inert` cannot serve
it (it kills `pointer-events`, which those fields keep).

**Elevation.** Left for now: nine components each hand-write a `box-shadow`
because `[data-elevation]` is a bare selector in `tokens.css` that never reaches
a shadow root. That is a real gap and the fix is the same property shape — but
it changes what nine components paint, so it wants its own pass.

---

### 10 — Breadcrumbs: one name, and one fewer hop

`sherpa-breadcrumbs` fires `breadcrumb-select`. `sherpa-app-header` listened for
it and re-emitted the identical detail as `breadcrumb-click` — the same user
action under two names, one hop apart.

**Renaming the re-emit would have looped forever.** The header listens for
`breadcrumb-select` *on itself*, so emitting that name from the handler feeds
straight back in. Checking `emit()` explained why the re-emit was never needed:

```ts
this.dispatchEvent(new CustomEvent(name, { detail, bubbles: true, composed: true }));
```

The child's event already bubbles composed, so it crosses the header's shadow
boundary and reaches the document on its own. The handler was duplicating an
event that was already arriving.

Removed the listener and the handler; `examples/index.html` now listens for
`breadcrumb-select`. Verified in the running app rather than by reading: a crumb
click moved the URL from `?view=records` to `?view=dashboard` with zero page
errors.

The app-header test kept its real assertion — that the event reaches a listener
on the header — under the one name.

---

### 11 — `sherpa-element.ts`: two real bugs, and some subtraction

**A template that fails to load hung 557 await sites.**

`#bootstrap()` awaits the stylesheet and the `.html` together, then stamps and
calls `#resolveRendered()`. An unguarded `await` skipped that last call when the
markup fetch rejected, so `rendered` stayed pending for the life of the page.

Two failure modes, and only one was a hang — measured, not assumed:

| the server does | `fetch` | before |
|---|---|---|
| drops the connection | **rejects** | `rendered` pending forever |
| answers 404 | **resolves** | stamped the error page as the template |

`loadHtml` now checks `r.ok`, and `#bootstrap` catches, logs the component's own
tag, and stamps empty. A blank element is a fault a person can see; a promise
that never settles is not.

`#adoptStyles` already had this defence (`allSettled`). The markup leg never
got one. `TRAP T-rendered-settles-even-when-the-markup-does-not`.

`reforged-bootstrap-failure.spec.ts` covers both. Verified it catches the bug:
reverted the fix, and the test failed.

**Slot listeners leaked on every variant re-stamp.**

`#wireSlots` was the only listener registration in the file that did not carry
`this.signal`. A re-stamp replaces every slot node, so each stamp wired a fresh
closure to a fresh element — nothing for `addEventListener`'s repeat-discard to
dedupe. Six components have `variantAttrs` and slots. One argument fixes it.

This is a real gap in `T-restamp-does-not-abort`, which reasons only about
**host** listeners being stable arrow fields.

**`static tier` was a config knob nobody read.**

Declared on the base class, set by 5 components, read by **zero** — verified
across `src/`, `scripts/`, `mcp-server/`, `sandbox/`, `test/`. Its comment
claimed it hid a component from "the catalog / sandbox picker"; the picker never
consulted it. The concept survives in `scripts/figma-data/name-map.yaml`, which
is what the tooling actually reads and covers 16 components rather than 5.
Deleted, 6 sites.

**Dead surface removed:** `ItemTemplate` (a type no signature referenced),
`pathHas` (a two-line wrapper with zero callers), and the `export` dropped from
`MARKABLE_OPS` and `parseTemplates` — neither is used outside the file, and the
`parseTemplates` in `scripts/lib/html-structure.mjs` is a different function
that happens to share the name.

`ItemTemplate`'s JSDoc carried two gated TRAP citations, so its text moved onto
`renderItems` — which already pointed at it for the vocabulary.

---

### 12 — `sherpa-element.ts`: comments cut, file ordered

**Comments: 38% → 35%, 888 → 864 lines.** Eight blocks trimmed, every one the
same shape — a useful first line followed by history the TRAP citation already
carries:

> *"three of them wrote the same loop"* · *"only 23 of 58 overrode renderData"*
> · *"seven files hand-paired add/remove across 22 sites"* · *"50 scroll events
> produced 100 getBoundingClientRect() calls"*

All 51 TRAP citations survive. The gate keys on a **Set of files** per id, so
duplicate citations within one file collapse — what matters is that each of the
36 distinct ids still appears, which was checked.

**Module order now matches the convention:** `import → types → constants →
functions → class`. `DATA_PROPS` and `SHARED_PROPS` had been declared at line
821, *after* the class.

**Class body grouped by role**, so a component author reads top-down — what I
set, what is called on me, what I can call, what I override:

```
static config → instance fields → constructor
Native lifecycle — the platform calls these
Shadow queries · Attributes in, out · Events · Data in
Private — boot and stamp / slots / prop sync / item stamping
Hooks — subclasses override these
```

#### Two bugs in my own tooling, both caught by verification

The reorder was scripted, and the script was wrong twice:

1. **Split inside multi-line parameter lists.** A param line is 4-space indented
   but the closing `): void {` is 2-space, so the member regex fired mid-
   declaration. Type-check caught it.
2. **Overlapping chunk boundaries duplicated comment blocks.** 51 citations
   became 78 and the file grew to 1045 lines. A sort-and-diff against the
   original caught it — the type-checker was perfectly happy.

The third version asserts the chunks **tile the body exactly** before
reassembling:

```python
assert rebuilt == original, 'chunks do not tile the body'
```

Final diff shows only the section banners changed. Every line of code and every
comment is intact.

**Verified:** all nine gates green; 1932 passed / 12 failed, and the 12 are the
known load-flaky set — no base-class, bootstrap, binding or coercion failure.
That is the signal that matters, since all 58 components inherit from this file.

#### The ordering rule, as it should be written

Per **class**, not per file: constants and types above it, nothing below it.
`core/data/stores.ts` is the exception that proves it — three classes, each
paired with its own `*Options` interface, which keeps a class beside its config.

---

### 13 — Icons: four files, and only the name was wrong

Will's note said three icon scripts looked like overkill. Measured, there are
four, and they are a chain with one entry point rather than three overlapping
doors:

```
icon-paths.ts    231 lines, 307 KB, GENERATED — "do not edit"
icon-aliases.ts   41 lines, hand-written FA → Figma judgements
   ↓
render-icon.ts    92 lines — the one writer (renderIcon, hasIcon, upgradeIcons)
   ↓
components        2 importers
```

No redundancy to remove: 307 KB of generated path data and 28 hand-made
judgements about what two icons *mean* are genuinely different things from the
writer that stamps them.

The real fault was the fourth file's **name**. `icons.ts` was imported by four
components, and **three of them wanted `NON_VALUE_ROWS`** — a CSS selector, not
an icon. Its own header already said "shared constants that more than one
component must agree on", which is accurate.

Renamed to `shared-constants.ts`; 5 import lines followed, including one in a
test that a `src/`-only grep would have missed.

**The traps gate caught the rename.** Two `Site:` entries still pointed at
`src/core/ui/icons.ts`, and the count went 7 → 11 until they were updated —
exactly the silent rot it exists to prevent.

### 14 — Elevation was broken, not duplicated

Nine components hand-write a `box-shadow`, each with a comment explaining that
a `[data-elevation]` pin never reaches a shadow root. That reads as duplication.
It is a **bug**, and the comments are nine people describing it.

`--sherpa-shadow-sm/md/lg` resolved to `0px 0px 0px 0px` — an invisible shadow
— inside every component, at every elevation. Measured on a real host:

```
before   --sherpa-shadow-sm = 0px 0px 0px 0px color-mix(…)
after    --sherpa-shadow-sm = 2px 2px 8px -4px color-mix(…)
```

The aliases were built from `--sherpa-elevation-*`, which default to
`size-none` on `:root` and take a real value only from `[data-elevation=…]` — a
bare selector that cannot cross a shadow boundary.

**The projector already documented the failure** in its `MODE_ALIAS_TARGETS`
comment — *"resolves against :root… all zeros — so the shadow silently
vanished"* — and had patched the Navigation collection only.

Fixed by emitting Elevation's own per-mode geometry as literals, read from the
Figma dump:

| tier | offset | blur | spread |
|---|---|---|---|
| sm | 2px | 8px | −4px |
| md | 8px | 16px | −4px |
| lg | 8px | 32px | −8px |

Those are **exactly** what the nine components had written by hand, which is
why nothing ever looked wrong — the token was simply never used.
`grep var(--sherpa-shadow-` across components returned zero.

Six now read a token: dialog, overlay-panel (lg); menu, tooltip, app-shell
(md); toast keeps the geometry inline because it tints the colour by status.
`sherpa-nav` and `sherpa-metric` keep their own — nav uses its own projected
`navigation-nav-shadow-*`, metric tints by trend.

Painted shadows captured before and after: identical to the last decimal.

`data-elevation` stays unwired — no component declares it, no example sets it.
Making it work needs a per-component `:host([data-elevation])` rule, which is a
separate decision. `TRAP T-an-elevation-pin-cannot-reach-a-shadow-root`.

---

### 15 — The naming rulings

Three decisions. Two of the audit's three findings turned out to be wrong once
measured, which is the useful part.

#### Verbs: one Sherpa vocabulary, proxying to native

The audit called `show`/`close`/`hide`/`dismiss` "three antonyms for one
concept". Each actually mirrors a different platform API:

| component | wraps | native verb |
|---|---|---|
| dialog, overlay-panel | `<dialog>` | `close()` |
| menu, notifications | `popover` | `hidePopover()` |
| callout, toast | neither | removes the element |

Will's ruling: a user of Sherpa should not have to learn which primitive a
component happens to wrap. So **`show()` / `hide()` is Sherpa's pair**, and all
four openers accept `close()` too. The alias delegates — one place does the
work:

```ts
hide(): void { … }                 // the logic
close(): void { this.hide(); }     // the platform spelling
```

`examples/` had the problem this fixes: `dialog.close()` on one line,
`notifications.hide()` on the next, for the same intent.

**`dismiss()` stays separate** because it REMOVES the element. A method that
sometimes hides and sometimes destroys would be worse than two names.
`TRAP T-one-verb-proxies-to-the-native-one`, and a test that proves all three
verbs reach the same place without recursing.

#### Selection: two small renames, and one merge NOT done

`data-active-id` → `data-current-id` (12 sites) and `data-tab-active` →
`data-current` (3 sites). Those were the real faults: two names for the host
pointer, and `sherpa-tabs` using two names one line apart.

The merge of `data-selected` into `data-current` was chosen and then **not
done**, because checking what they mean showed they are orthogonal, not
synonyms. `sherpa-list-item` declares both and documents them separately:

> `data-current` — current-row state
> `data-selected` — selection state (for the leading control)

A row can be current AND selected. `sherpa-select-card` is explicitly
multi-select. Merging would have made that unexpressible.

**The rename broke two things, both the same shape.** An attribute rename does
not touch its camelCase `dataset` form:

```
src/components/sherpa-nav/sherpa-nav.ts   this.dataset['activeId']
examples/index.html:193                   nav.dataset.activeId = …
```

The first was caught by a failing nav test; the second only by a favourites
test that passed before the rename and failed after. Both now read `currentId`.
A `grep` for the kebab-case attribute finds neither.

#### Label vs heading: the rule was already being followed

Measured across all 33 components: **zero** are on the wrong side. Controls
take `data-label`, containers take `data-heading`, and all three `fallbackAttr`
aliases already point at their own tier's name.

The audit read that as "aliases point in opposite directions" — they do, and
that is the rule working. What was missing was the rule being written down.

CLAUDE.md had it backwards in one place (`fallbackAttr` documented as
`data-label → data-heading`) and omitted `data-heading` from the standard-names
list entirely. Both fixed, along with the `data-current` / `data-selected`
distinction.

---

### 16 — Composition: the close button, four times over

The audit named four composition violations. Measured first, because "62 raw
`<button>` across 26 components" overstates it — a chart bar, a calendar cell, a
nav row and a tab are all *meant* to be raw. Filtering to buttons that duplicate
what `sherpa-button` styles leaves four real cases.

**Started with the close button: 4 components, ~153 CSS lines, one shape.**

`callout`, `toast`, `tag` and `chip` each carried byte-identical markup —

```html
<button class="close" part="close" type="button" aria-label="Dismiss">
  <span aria-hidden="true">&#215;</span>
</button>
```

— and ~38 lines of CSS each re-deriving box, radius, hover, active and focus
ring. Meanwhile `sherpa-container-header` composes a real `sherpa-button` for
the identical job, and its `.close` rule is **three lines**, because the button
owns all of that.

| | before | after |
|---|---:|---:|
| `.close` CSS, per component | 37–39 lines | **4** |
| total | ~153 | 16 |

Net **−163 lines** across 16 files.

Three things improved beyond the line count:

- The `&#215;` glyph is gone. All four now draw `fa-xmark` through the icon
  system, so they follow the Figma set and re-theme like everything else.
- They listen for `button-click`, not `click` — a **disabled** `sherpa-button`
  suppresses its own event, which the hand-rolled version could not do.
- One size. All four were hand-set (20px on callout, 10px on the others,
  matching no token); they now use `data-size="xs"` like the reference, so all
  five close buttons in the library agree.

#### What went wrong, and what it taught

My first verification said **0×0, not firing** — apparently a total break. It
was the probe: a composed `sherpa-button` has its own render to await, and
`.click()` on the host does nothing because the real target is its inner
trigger. The button was 24×24 and upgraded the whole time.

The same mistake was in four existing tests, which is why they failed. The fix
was already written down — `reforged-container-header.spec.ts:145` carries the
comment *"`el.rendered` only covers the HEADER; the button is a child component
with its own render to wait for."*

**That is the real cost of composing**, and it is worth stating plainly: a
composed child moves the click target and adds a render to await. It is not
free, and every test that reaches into a shadow root has to know.

`check:traps` caught the rest — four `Site:` entries for
`T-a-css-function-needs-its-longhand-first` pointed at CSS blocks that no
longer exist, because the `--tint` pair now lives once, inside `sherpa-button`.

#### Still to do

Everything in the original list is either done or measured. What genuinely
remains:

### 1 — State ownership: two gate gaps, and a finding that shrank

Investigated further. The picture is more nuanced than "15 unguarded writes".

**The gate under-reports by construction.** `check-ownership.mjs:68` matches
`setAttribute` but not `toggleAttribute` or `removeAttribute`. Widening it to
`(?:set|toggle|remove)Attribute` takes the count from 5 to **24**, of which 15
are in `sherpa-quick-filter-toolbar` — exactly matching an independent grep, so
both numbers are confirmed.

That widening is **not applied**: the gate runs pre-commit, and leaving it red
would block every commit in the tree, including the other agent's. It is a
one-regex change when someone is ready to work through the 24.

**And the rule does not mean what the raw count implies.** Declaring
`data-current` in `DATA_PROPS` surfaced 5 writes; reading them showed all five
write to a **child chip**, not to the component itself. `sherpa-data-grid.html`
declares those chips `data-locked` in its own markup, with the reason stated:

> `data-locked` is required: a chip derives its on-state from CHECKED ROWS, and
> this menu has none, so unlocked it switches itself off the instant Apply
> closes.

So the grid locks its chips **precisely so that it can own them**, and writing
to them is correct. The gate's guard-window heuristic looks for `data-locked`
near the write; it cannot see a lock declared in a template.

`data-current` was therefore **not** left in `DATA_PROPS` — a rule about "a
component writing what a host owns" does not describe a parent configuring its
own locked child.

**What remains real**, and needs per-case judgement rather than a sweep:

- The 15 toolbar writes still have no lock check, and at least one is
  load-bearing (`#onOrganiseChange` records that *"an off chip could never
  commit itself on — every date chip's first pick"*).
- `#onOrganiseChange` is registered in CAPTURE and calls
  `stopImmediatePropagation()` before writing, so a chip that deferred
  correctly has its answer overwritten AND the event never reaches the host.

Two separate pieces of work: teach the gate to see a template-declared lock,
and decide per site whether the toolbar is an owner or a reporter.


### 2 — `render-icon.ts` and the alias map

Will's question, recorded above with measurements. The viewBox is the part that
resists being a static template — 88 distinct ink boxes across 214 icons — and
the alias map covers 88 call sites still naming icons in Font Awesome's
vocabulary. Three questions to answer before starting.

### 3 — `sherpa-data-grid` rebuild

`name-map.yaml` has it as `status: needs-rebuild`: Figma reduced Data Grid to a
single **Grid Cell** in the 2026-08-27 resync, and the grid is meant to be
composed from them. The two now agree on their shared event shapes, which was
the prerequisite. The rebuild itself is a dedicated session.

### 4 — The flaky suite

12 failures that are not deterministic, plus a webkit-only border-edges failure
(20 components resolving 0.5px where 1px is wanted) that belongs to
border-token work in progress elsewhere in the tree. Worth its own pass, since
it makes every other change harder to verify.

### 5 — The smaller naming questions

`nav-select` vs `tab-change` for the same gesture, and whether `data-type`
should be reserved for template selection (it currently means nine different
things). Neither is a bug; both are rulings.
