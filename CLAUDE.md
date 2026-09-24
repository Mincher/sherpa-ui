# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

## Read these first

**[docs/PRINCIPLES.md](docs/PRINCIPLES.md) is the rules, stated once.** Sixteen
of them, twelve enforced by a gate. Start there; it is two pages.

This file is the detail behind them — the commands, the architecture, and the
worked examples. The handover docs hold the *why*: the traps, the rulings, and
the reasons behind decisions that look odd. Several are silent failures that
have each cost hours.

Where a rule appears in more than one place, PRINCIPLES.md is the statement and
its gate is the arbiter. A rule that was re-stated in seven documents is what
made that necessary.

| Doc | Read it when |
|---|---|
| [docs/PRINCIPLES.md](docs/PRINCIPLES.md) | **First, always.** The rules, the gate that enforces each, and the open work |
| [docs/TRAPS.md](docs/TRAPS.md) | Any `TRAP T-…` citation you meet in the code. The reasons, gated both ways |
| [docs/DATA-SOURCE-RULES.md](docs/DATA-SOURCE-RULES.md) | Pointing Sherpa at a backend. Served to agents as `sherpa://data-rules` |
| [docs/DEF-TO-FIGMA-BUILD-RULES.md](docs/DEF-TO-FIGMA-BUILD-RULES.md) | Building a component from a def. Served as `sherpa://rules` |

Active branch is `sherpa-data-layer`. **Never push** — commit freely, pushing is
Will's call.

---

## Commands

```bash
# Build (clean → compile TS → transform + copy CSS/HTML assets into dist/)
npm run build
npm run build:watch       # build-reforged.mjs --watch — TS *and* assets
npm run build:watch:ts    # tsc --watch — TS only, no asset copy

# Type check (no emit)
npm run type-check

# Lint TypeScript. Includes the DOM-FREE BOUNDARY: nine core modules
# (store, stores, validate, pointer, chart-datum, format-tick, live-stores,
# data-source) may not touch document/window/customElements/storage — they are
# the half of the data layer a server, a test or an MCP tool imports.
npm run lint
npm run lint:fix

# Lint component CSS (structural rules; --strict elevates grid warnings to errors)
npm run lint:css
npm run lint:css:strict

# Check the component specs. Two halves, and BOTH must pass:
#   validate   — the spec matches schemas/component.v1.json
#   round-trip — the spec regenerates the source it was made from
# `spec:check` RUNS IN THE PRE-COMMIT HOOK and writes nothing. A spec that does
# not match, or that no longer describes its component, blocks the commit.
npm run spec:check
npm run spec:validate      # the schema half alone

# Format component CSS
npm run format
npm run format:check

# Tests — Playwright. The webServer runs `npm run build`, so `npm test` builds
# for you; there is no separate build step to remember.
npm test
npm run test:ui           # the Playwright UI runner
npm run test:headed
npm run test:report       # open the last HTML report

# Serve
npm run sandbox           # build, then serve the repo on :4000 (sandbox/)
npm run preview           # serve WITHOUT building — :4000
npm run serve:examples    # express template server on :4200 (examples/)

# MCP server
npm run mcp               # stdio transport — connect from Claude Desktop / Cursor
```

---

## Architecture

### Stack

- **Web Components** — Custom Elements + Shadow DOM + HTML Templates. No framework, no virtual DOM, zero runtime dependencies.
- **TypeScript** strict mode, compiled to ES2022 ES modules (`dist/components/`).
- **CSS** with design tokens sourced from Figma Variables.
- **MCP server** (`mcp-server/`) — gives AI agents structured access to component specs, tokens, the data layer and the build rules. (There is no `patterns/` directory on this branch — `examples/` is the working reference instead.)

### Component anatomy (three source files + one generated def)

Every component lives in `src/components/sherpa-<name>/`. Three hand-written source files:

| File | Owns |
|------|------|
| `sherpa-<name>.ts` | Lifecycle, events, attribute coordination — JS is the last resort |
| `sherpa-<name>.css` | **All** presentation: variants, states, visibility, responsiveness, transitions |
| `sherpa-<name>.html` | Shadow DOM template, slots, semantic structure |

A fourth file, `sherpa-<name>.component.yaml`, is **generated** — by
`scripts/generate-component-spec.mjs` from the source + Figma — and git-tracked. It is
the component's single contract (a DTCG-dialect spec), consumed by the MCP and the
validate tooling. Never hand-edit it; regenerate it.

**An event's DETAIL is read from its `emit()` call sites**, and its types are
inferred only where they cannot be anything else — a literal, a `??` fallback.
Anything needing the type checker is `unknown`, because a wrong type in a
contract is worse than an honest gap.

**The EVENTS in a spec come from the code, not from the `Fires:` comment.** That
comment is prose, and reading it for identifiers put phantom events into 31 of the
58 specs — one component declared an event literally called `nothing`, another had
scraped sixteen words out of sentences about its filters. The generator now
intersects the comment with what the TypeScript actually dispatches (`emit()`,
`new CustomEvent`, `new Event`), so a comment can choose which emitted events are
public but can never invent one. `scripts/resync-figma.mjs --check`
reports drift between a spec and Figma. (`scripts/generate-defs.mjs` was deleted
2026-09-16 — it had been a stub that only printed an error.)

**The same rule holds for PROPS.** A bare (non-`data-*`) name in the `Public API:`
comment must be used as an attribute somewhere in the TS, CSS or HTML, or it is
dropped and reported. Two wrapped sentences had become props —
`stretch — ONE wide control fills the row` is the tail of `data-align`'s
description — because any lowercase word before an em-dash reads like an entry.
A `data-*` name is unambiguous enough to stand on its own; anything else has to
be found in the code.

**A spec's `anatomy` has three forms.** `root` (one node tree), `roots` (a
template with 2+ sibling roots), and `byTemplate` (a map of template id → that
template's own roots). The third is for a component whose templates are genuinely
DIFFERENT trees — `sherpa-input-text` swaps `<input>` for `<textarea>`,
`sherpa-nav-item`'s `promo` renames every class. `showWhen` can only add or
remove a node against one shared tree, so it cannot express a changed tag, class
or part. Prefer `root`/`roots`; the generator falls back to `byTemplate` on its
own and says so in a note.

**The golden rule:** can this be done in HTML or CSS before writing JS? If yes, do it there.

### Two entry points

```js
import { SherpaButton } from 'sherpa-ui';        // components — needs a DOM
import { ArrayStore, DataSource } from 'sherpa-ui/data';  // the data layer — no DOM
```

`sherpa-ui` exports all 58 components, and importing a component DEFINES a
custom element — so it throws `HTMLElement is not defined` in Node.
`sherpa-ui/data` (`src/data.ts`) is the same stores, query, validation, live
connections and saved views with no components and no DOM, for a server, a test
or an MCP tool. `npm run lint` enforces the boundary; a node test proves the
entry point stays clean.

### `SherpaElement` base class (`src/core/ui/sherpa-element.ts`)

All components extend this. It handles template fetching (with class-level cache), shadow DOM setup via `adoptedStyleSheets`, slot-presence detection (`data-has-{slotName}` on host), and multi-template support.

```ts
export class SherpaFoo extends SherpaElement {
  static override css = new URL('./sherpa-foo.css', import.meta.url);
  static override html = new URL('./sherpa-foo.html', import.meta.url);

  // The public attribute surface, DECLARED. Every key is observed automatically.
  static override props = {
    'data-heading': { type: 'string', kind: 'content', to: '.title' },
    'data-status':  { type: 'enum', kind: 'style',
                      values: ['info', 'success', 'warning', 'critical', 'urgent'] },
  } as const;

  // For native attributes, and for attributes the component handles itself.
  static override observed = ['disabled'];

  override onRender()  { /* shadow DOM ready — cache refs, set defaults, wire host listeners */ }
  override onConnect() { /* fires once after first render — for one-time setup needing DOM */ }
  override onDisconnect() { /* clean up timers / observers */ }
  override onChange(name: string, oldVal: string | null, newVal: string | null) { /* react to attribute changes */ }

  #onClick = (): void => { this.emit('foo-click'); };  // emit() sets bubbles + composed
}
customElements.define('sherpa-foo', SherpaFoo);
```

Shadow root queries: `this.$('.sel')` (querySelector) and `this.$$('.sel')` (querySelectorAll). Never use `this.shadowRoot.querySelector` directly.

`onRender()` is guarded by a `#rendered` flag — it fires exactly once. Event listeners registered there will not double-bind.

### Declared attributes — `static props`

**Declare an attribute; do not hand-sync it.** A `kind: content` entry with a `to`
selector is written into the shadow DOM by the base class — replacing the `#syncX()`
method, its call in `onRender`, and its branch of the `onChange` if-chain. Props are
written BEFORE `onRender`, and `onChange` still fires afterwards so a component can do
extra work for the same attribute.

The `kind` vocabulary matches the generated `.component.yaml`, so the code and the
contract agree:

| `kind` | Meaning | What the base class does |
|---|---|---|
| `content` | JS writes text into the shadow DOM | writes it |
| `style` | CSS selects on it | **nothing** — declared only |
| `visibility` | presence toggles a CSS rule | **nothing** — declared only |

Declare the CSS-only ones too. They generate no DOM writes; the declaration gives JS a
typed door (`this.set(attr, value)` — the JS→CSS write path) and a place to hang later
use. **`kind: style` must stay CSS-only in behaviour** — declaring `data-status` is not
licence to add a JS status branch.

Four options exist to preserve real behaviour. Do not add a fifth without evidence of
three or more uses:

| Option | For |
|---|---|
| `all` | the target repeats in the template (list-item writes `.title` twice) |
| `skipWhen` | content the component owns — a filled `<slot>`, a search `<mark>` |
| `fallbackAttr` | a legacy alias, pointing AT the tier's own name (see below) |
| `default` | a real default string (`'Available'`, `'Ask N-zo'`) |

`skipWhen` on a `<slot>` guards only when the slot is **filled** — a `<slot>` in the
template is the normal state, not an override.

Keep it hand-written when the write is not a plain attribute→text mapping: a runtime
selector choice (`nav-item`), a text template (`file-upload`'s `"Maximum file size: …"`),
or a value derived from something other than the attribute (`sherpa-list`'s row count).

### `data-*` attributes as the public API

Components expose their entire public API through `data-*` attributes. CSS selects on them via `:host([data-*])`; JS reads/writes `this.dataset`. Native HTML attributes (`disabled`, `hidden`, `name`, `value`, etc.) stay un-prefixed.

Standard names: `data-variant`, `data-size`, `data-status`, `data-type`, `data-layout`, `data-current`, `data-selected`, `data-elevation`, `data-label`, `data-heading`, `data-description`, `data-icon-start`, `data-icon-end`.

**The text on a thing has two names, and the split is by TIER.** A CONTROL you
operate takes `data-label` — button, input, slider, checkbox, metric,
progress-bar. A CONTAINER that holds other things takes `data-heading` —
dialog, panel, accordion, toast, menu, app-header. Measured 2026-09-23: 19
components on one side, 14 on the other, and **zero** on the wrong one.

An alias always points AT its tier's own name, never away:
`sherpa-list-item` takes `data-label` with `data-heading` as the fallback;
`sherpa-app-header` takes `data-heading` with `data-title` as the fallback.

**And `data-current` vs `data-selected` are not synonyms.** `data-current` is
one-of-many — which row you are on. `data-selected` is any-of-many — whether
its control is ticked. `sherpa-list-item` declares both, because a row can be
current AND selected. The host-level pointer is `data-current-id`.

### Naming contract (ratified — Phase 0.5)

Applies to **all** components, existing and new:

- **Element names:** every Sherpa-UI custom element is `sherpa-*`. No exceptions.
- **Attributes:** `data-*` for the public API; native attributes (`disabled`, `name`, `value`, `hidden`, `required`, `readonly`) stay un-prefixed. Reuse the standard-name enums above verbatim — don't invent a synonym for an existing concept. Component-private state is `--_*` CSS custom properties, never a public `data-*`.
- **Events:** **unprefixed `noun-verb`** names (`button-click`, `page-change`, `tree-select`, `quick-filter-change`). Do **not** prefix event strings with `sherpa-`. Standard shared events: `change`/`input` (re-dispatched native), `*-click`, `*-change`, `*-select`, `*-open`/`*-close`.
- **Standard data attrs for data components:** `data-sort-field`/`data-sort-direction` (`asc|desc`), `data-segment-field`/`data-segment-mode` — reuse across all chart/grid components.
- **Slots:** every content-bearing slot declares a `data-accepts` category allowlist. There is no separate slot-contracts doc — read the `data-accepts` values in the component `.html` templates. **12 of the 44
  slot-bearing components carry them** — the rule is every content-bearing slot, so
  the other 32 are a real gap, not a licence to skip it.

### Navigation terms

Ratified 2026-09-24. Four words, one meaning each — in code, comments, tests and docs.

| Term | Is | Where |
|---|---|---|
| **Section** | a label and divider in the nav. Visual only, does nothing | nav — `NavSection`, `sherpa-nav-section` |
| **Area** | a parent nav row. It expands and collapses its Contexts; it never navigates | nav — a `NavEntry` with `children` |
| **Context** | a nav row that fills the app header and the content | nav — a `NavEntry` with an `href`; `?context=` in the example app |
| **View** | a preset or user-saved view definition, picked from the header's View chip | app header only — never in the nav |

A Context's sub-pages are its **Views**, picked in the View chip — never child
nav rows. Add an Area only when one is asked for. `examples/contexts/settings-views.js`
is the reference: three Settings Contexts, two Views each.

**Settings opens ON TOP of the Context**, in `<sherpa-dialog data-type="overlay">`
in the app shell's `overlay` slot. The Context under it is never reloaded, so
leaving Settings restores its View. The URL carries both:
`?context=records&settings=profile`.

So a page is a **Context**, not a view: `examples/contexts/`, `loadContext`,
`/template/context/:context`. "View" is kept for saved views — `ViewSnapshot`,
`onViewPicked`, the `data-type="view"` toolbar and its `view-*` events. Figma
still uses the old words; that rename is queued in `docs/TODO.md`.

### CSS owns all visibility

**JS never toggles `.hidden`, `display`, or `visibility` on shadow DOM internals.** JS sets `data-*` attributes on the host; CSS selects them:

```css
.icon { display: none; }
:host([data-icon-start]) .icon { display: inline-flex; }
```

`:host` compound selectors must use functional form — **chained form does not work in Shadow DOM:**
```css
:host(:not([data-pinned])) { … }   /* ✅ functional */
:host:not([data-pinned])   { … }   /* ❌ chained — broken in shadow DOM */
```
CSS nesting with `&` inside `:host {}` also desugars to the broken chained form. Write compound host selectors as standalone rules.

### Template rules

- Every `.html` file wraps content in `<template id="default">`, even single-template components.
- All elements the component will ever show **must exist in the HTML template from the start**. Never use `createElement()` or structural `innerHTML`.
- Data-driven repeating items use cloning prototypes: `<template class="item-tpl">` (no `id` — prevents SherpaElement's multi-template parser from picking them up).
- Multi-variant: add `<template id="other">` blocks; JS selects via `get templateId()`.

### Token architecture

Three tiers:

| Tier | Prefix | Usage |
|------|--------|-------|
| Core primitives | `--core-*` | Never use directly in component CSS |
| Semantic aliases | `--sherpa-*` | Always consume with a hardcoded fallback |
| Component-private | `--_*` | Internal only — never in public API |

Always write: `var(--sherpa-space-sm, 12px)`. The fallback is required — and the
fallback value **must equal the on-grid value the token resolves to** (a stale
off-grid fallback is drift even though it only surfaces if the token goes missing).

**Component-SCOPED tokens are a fourth case, and they look like a mistake.**
`scripts/project-tokens.mjs` maps four Figma collections into the CSS of the
component that owns them — into its own generated `sherpa:tokens` region, not
into `tokens.css`:

| collection | lands in |
|---|---|
| `structure` | `sherpa-button.css` |
| `input` | `sherpa-input-text.css` |
| `navigation` | `sherpa-nav.css` **and** `sherpa-nav-item.css` |
| `switch` | `sherpa-switch.css` |

So `--sherpa-button-space-gap` is a real projected token that happens to live
next to the one component that uses it. It is **not** a private value wearing the
shared prefix, and renaming it to `--_*` is undone by the next projection.
**Everything above `/* == end sherpa:tokens == */` belongs to Figma** — edit it
there and re-project. `npm run lint:css` already lints only the authored region
below that marker, for the same reason.

### Spacing grid

All sizing, spacing, and radius follow an **8px grid** with a **4px sub-grid** for
text. **2px and 1px** increments are for edge cases only. **Values below 1px** exist
only for stroke widths (border widths). The projected Figma tokens are all on-grid;
consume them rather than hand-writing px.

`npm run lint:css` warns on any odd px literal (≥1px, not `999`) in a spacing/sizing/
radius property (`off-grid`). Exempt: `border*` props and `font-size`; `1px` and
sub-1px (strokes); `999px` (the fully-round pill idiom). A genuinely off-grid **drawn
glyph** (a pure-CSS triangle/chevron, where the px is geometry not spacing) opts out
with a trailing `/* off-grid-ok */` comment on the declaration — do not use it to
excuse real spacing drift.

Cascade layer order (declared in the generated `src/styles/tokens/tokens.css`) mirrors
the Figma collection families — each layer owns its base values plus its own mode /
extension blocks:
```
core → display-mode → theme → layout → structure → border → style → elevation → components
```
- **core** — shared base geometry (Primitives are inlined as literals, not emitted).
- **display-mode** — light/dark colour+scale ramp + dark re-point + density (`[data-density]`).
- **theme** — semantic surface/border/content/size/weight/font, scoped `[data-theme]`; font atoms + `.sherpa-text-*` classes.
- **layout** — grid properties + the `.sherpa-view` app-shell utility.
- **structure** — bound sizes / content sizes / per-corner rounding + snap (`[data-snap]`).
- **style** — default + status (`[data-status]`) + look tiers (`[data-look]`) + categorical data-viz series.
- **elevation** — shadow styling (`[data-elevation]`).
- **components** — each component's own scoped partial, last (guaranteed last word).

Layers are re-projected from Figma by `scripts/project-tokens.mjs`; edit tokens in Figma,
re-export, re-project — never hand-edit `tokens.css`. Activate a theme via
`<html data-theme="sherpa">`. Mode via `<html data-mode="auto|light|dark|hc">`.
`ThemeManager` handles persistence. There is no `light-dark()` in component CSS — the
display-mode layer owns mode handling.

### Shared CSS lives in SEVEN sheets

`src/index.ts` puts seven stylesheets into `SherpaElement.sharedStyles`, and
every one is adopted into every shadow root:

| sheet | holds |
|---|---|
| `sherpa-base.css` | `:host` defaults, `--shade()` / `--tint()`, `.sherpa-truncate`, `.sherpa-inert` |
| `sherpa-typography.css` | **generated** — the type scale |
| `sherpa-grouping.css` | `.sherpa-group*`, `.sherpa-border-edges`, `.sherpa-border-corners` |
| `sherpa-icon.css` | `.sherpa-icon-box` |
| `sherpa-group-positions.css` | **generated** — grouping positions |
| `sherpa-anchor.css` | `.chart-tip`, `.sherpa-tip`, `.chart-mark` |
| `sherpa-motion.css` | durations, shared keyframes |

Reach for a shared sheet when the same rule appears in a THIRD component —
`.chart-tip` (the five charts) got into `sherpa-anchor.css` that way. Pick the
sheet by job: `base` is what every component needs, the rest are opt-in by
class.

`.sherpa-group` on a WRAPPER squares its children's inner corners so a row of
controls reads as one object. By POSITION (`:first-child` / `:last-child`), so
a re-order survives. (It was called `.sherpa-snap-group` once, alongside a
`data-snap` attribute; both names are gone.)

**What does NOT belong in a shared sheet: a `:host` rule.** Only 22 of the 58
components want a border at all, so a blanket `:host` rule draws one on 36 that
do not. Shared CSS is opt-in by class — with one exception, below.

**A `:host` cannot wear a class from its own sheet.** That is why the shared
sheets also carry inherited custom properties: `--sherpa-focus-ring` replaced
48 hand-written sites across 29 files, and a property is the only shape that
reaches a bare `:host`. When a block repeats and its target is the host, make
it a property, not a class.

**The per-edge border chain has already been lifted.** The four
`border-*-width` lines and the four per-corner radii were written verbatim 26
times across 21 components; they now live once, as `.sherpa-border-edges` and
`.sherpa-border-corners` in `sherpa-grouping.css`, on LOGICAL properties so a
corner follows the writing direction. The edges genuinely differ per
`[data-group]` mode, which is why they cannot collapse to a `border-width`
shorthand — but that is an argument for the shared class, not for 21 copies.

### Status cascade (`[data-status]`)

Setting `data-status="critical|warning|success|info|urgent"` on any ancestor emits `--_status-*` custom properties that inherit through Shadow DOM. Components consume them via fallback chains — no per-component status blocks are needed:

```css
background: var(--_status-surface-strong, var(--sherpa-surface-control-primary-default));
```

Available: `--_status-surface` (style-surface/base), `--_status-surface-subtle` (+1 — the pale tint, e.g. the Toast card), `--_status-surface-strong` (+2), `--_status-shadow` (style-surface/shadow — status-tinted elevation colour), `--_status-border` (neutral in most modes), `--_status-border-strong` (style-border/base +1 — the status-tinted rule/stroke, e.g. a sparkline), `--_status-text`, `--_status-text-on-color`, `--_status-icon`.

### CSS `@function`: longhand first, function second

A CSS `@function` is REAL in Chromium and WebKit, and absent in Firefox 155
where a declaration using one renders NOTHING — silently, with no error. That
is why this library had no function library.

**`@supports` closes it**, and the pattern is always the same two blocks:

```css
/* 1. The longhand. Every engine, always. */
&:hover { background: color-mix(in oklab, var(--_surface) 92%, currentColor); }

/* 2. The function. SECOND, so it wins only where it works. */
@supports (background: --shade(red, 8%)) {
  &:hover { background: --shade(var(--_surface), 8%); }
}
```

Measured in all three engines, including inside an adopted shadow sheet:
Firefox drops the `@function` rule entirely and keeps the longhand, and the
three render the same colour to five decimal places.

Two functions exist, both in `sherpa-base.css`:

| function | for | scale |
|---|---|---|
| `--shade(--surface, --amount)` | a control with a surface of its OWN | 8% hover, 16% pressed |
| `--tint(--amount)` | one BORROWING the surface beneath it | 16% hover, 24% pressed |

Add another only with the same guard and the same three-engine proof — a
function without its longhand is a rule that vanishes for a third of the web.
TRAP `T-a-css-function-needs-its-longhand-first`.

For focus rings, always use the explicit fallback pattern — and an INSET ring, so
the stroke is drawn INSIDE the component's own box rather than bleeding over its
neighbours (an outer ring on a snapped control pair, a table cell or a tight
toolbar overlaps whatever sits beside it):
```css
:host(:focus-visible) {
  outline: none;
  box-shadow: inset 0 0 0 2px var(--sherpa-theme-border-accent-2, #3b4ccd);
}
```

**Use `var(--sherpa-focus-ring)`.** Declared once on `:host` in
`sherpa-base.css`, which every shadow root adopts, so it inherits everywhere.
It was written by hand at 48 sites across 29 files — see
`T-one-value-one-declaration` for why it is a custom property and not a class.

The value it carries, for reference: This doc named `--sherpa-border-control-primary-default`
until 2026-09-16; **that token does not exist** in `tokens.css`, so anyone who
followed the doc got a focus ring drawn in the fallback colour only, and a
slightly wrong one. A ring nobody can see is the accessibility bug the rule
exists to prevent.

Two components deviate and are **not** the pattern to copy: `sherpa-button`
(outer ring + surface halo) and `sherpa-progress-step-tracker` / the
`sherpa-select-card` tick (outer `0 0 0 2px`). `sherpa-input-text` and
`sherpa-pagination` route through a private `--_border-focus` because they also
need an error state — acceptable, since the resolved value is the same.

### State ownership — every value has exactly ONE owner

Ratified 2026-09-16, after four of five bugs in one week turned out to be the
same mistake.

**A component is a REPORTER for anything a host might also control, and an OWNER
only of what nothing outside it can see.** A grid owns its scroll position; it
REPORTS its sort, because a toolbar chip can set that too.

**The recurring bug is DERIVING state you do not own.** The quick-filter chip
worked out its own on/off from its menu's ticked rows — right while the chip
owns the filter, wrong the moment a grid does.

The convention, in three parts:

| | |
|---|---|
| `data-<thing>` | the value, IN |
| `<thing>-change` | the INTENT, out — a request, not a notification |
| `data-locked` | the host owns the state; report the interaction, never set it |

`data-locked` is **one attribute for the whole component**, not per value —
`sherpa-quick-filter` implements it; the grid and the toolbar set it. A locked
chip still emits its event; it simply stops writing its own `data-current`.

Three more primitives exist for the same problem, all in use:

- **`ignore: ['event']` on `bind()`** — this VIEW owns this event, so the source
  gets no listener at all. `readonly` was too blunt: it silences everything.
- **suspend ≠ clear.** "Off" keeps the value; "gone" deletes it. Collapsing them
  cost a user their typed filter. A sort suspends with `data-sort-field=""` and
  clears by being replaced.
- **a read-back getter** — `grid.columnClause(field)`. The one that gets
  forgotten: a host that SET something needs to ask what the component now holds.

> Before shipping a component interaction, ask what a caller with no pointer
> would type to do the same thing. If there is no answer, it is not finished.
> `test/unit/parity-sweep.test.mjs` enforces the half of this that is mechanical.

### Events

Always `bubbles: true`. Add `composed: true` for events that must cross shadow DOM boundaries to application code:
```ts
this.dispatchEvent(new CustomEvent('card-click', { bubbles: true, composed: true, detail: {} }));
```
Prefer the base-class `this.emit(name, detail)` helper (sets `bubbles`+`composed`). Event **names** follow the ratified naming contract above: unprefixed `noun-verb`, no `sherpa-` prefix. Every dispatched event must appear in the component HTML's `Fires:` block, one event per line — that comment is what the spec generator intersects with the code, so an event missing from it is dropped from the contract, and two events sharing a line are read as one name. (An `@fires` JSDoc tag does nothing: the MCP does not read it, and exactly one exists in the whole repo.) Document-level broadcasts via `document.dispatchEvent` are the one case where `bubbles` is moot.

### CRUD flows

Flows are composed from existing components — there is no dedicated flow component,
and no flow-manager utility module on this branch. A flow is wired by hand in the
app: open a `sherpa-dialog` with `.show()` (NOT the native `showModal()` — the
component owns modality and the `open` attribute), read the fields, then append a
`sherpa-toast` for feedback.

`examples/contexts/records.js` is the working reference — the add-customer
button → dialog → save → toast path.

### MCP server (`mcp-server/`)

**17 tools** across five modules, **6 `sherpa://` resources**, and **3 guided
prompts**. Run with `npm run mcp` (stdio).

| Module | Tools |
|---|---|
| `tools/discover.js` | `list_components`, `get_component`, `find_token` |
| `tools/generate.js` | `scaffold_def`, `validate_def`, `compile_def`, `token_for` |
| `tools/verify.js` | `audit_component`, `check_bindings` |
| `tools/data.js` | `run_query`, `import_schema`, `scaffold_schema`, `validate_schema` |
| `tools/drive.js` | `component_api`, `call_component`, `read_component`, `browser_close` |

The **data** tools wrap `sherpa-ui/data` (`dist/data.js`), so their answers are
the answers the app gives — the same `validate()` a Store runs, the same
DataSource a component binds to. They need `npm run build`; a missing `dist/`
is reported as that rather than as a module error.

The **drive** tools are the instance tier: `component_api` reads a component's
callable surface from its spec (no browser), and `call_component` /
`read_component` reach a real element in a running page. **Localhost only, and
no arbitrary script** — a caller names an element, a method and JSON arguments;
the page-side code lives in the repo. Nothing launches until a tool asks, and
`browser_close` ends it.

Resources (6): `sherpa://data-rules` (what Sherpa expects of your data),
`sherpa://def/{name}`, `sherpa://rules`, and `sherpa://component/{name}/` in
`ts`, `html` and `css`. Prompts:
`generate_component`, `debug_component`, `review_component_usage`.

The component contract it reads is `<name>.component.yaml`; tokens come from
`src/styles/tokens/`.

### Disabled state

**Never `opacity`** — compounds in dark mode. Use inactive tokens per property:
```css
:host([disabled]) {
  cursor: not-allowed;
  pointer-events: none;
  color: var(--sherpa-theme-content-body-2, #b3b3c3);
  background: var(--sherpa-theme-surface-default-2, #b3b3c3);
  border-color: var(--sherpa-theme-border-default-2, #b3b3c3);
}
```

**These exact tokens.** This example named
`--sherpa-content-inactive-default`, `--sherpa-surface-container-inactive` and
`--sherpa-border-container-inactive` until 2026-09-17; **none of the three has
ever existed** in `tokens.css`, so anyone who copied it got a colour drawn from
the literal fallback only. One component did:
`sherpa-quick-filter-toolbar.css` carried the dead
`--sherpa-content-inactive-default` and painted `#5c5c66`, a grey that appears
nowhere in the system. Same failure as the focus-ring token before 2026-09-16 —
a doc example is code, and an unchecked one rots the same way.

### Container queries

Components use `@container` for responsive adaptation — **no viewport `@media` queries** inside component CSS. The only sanctioned `@media` inside a component is `(forced-colors: active)` for OS high-contrast. Do **not** add `@media (prefers-reduced-motion)` blocks to component CSS — motion gating is owned globally, not per component.

```css
:host { container: sherpa-card / inline-size; }
@container sherpa-card (max-width: 200px) { .description { display: none; } }
```

---

## Key rules at a glance

| ❌ Never | ✅ Instead |
|---------|-----------|
| `element.hidden = bool` on shadow internals | CSS `:host([data-*]) .el { display: … }` |
| `element.style.display = '…'` | CSS attribute selectors |
| `classList.add/remove/toggle` for visual state | `data-*` attributes + CSS |
| `createElement()` / structural `innerHTML` | HTML template + cloning prototypes |
| `--core-*` in component CSS | `--sherpa-*` with hardcoded fallback |
| `opacity` for disabled | Inactive tokens per property |
| `:host:not(…)` chained form | `:host(:not(…))` functional form |
| `&` nesting inside `:host {}` | Standalone `:host(…)` rules |
| `light-dark()` in component CSS | Theme files own mode; components are mode-agnostic |
| `outline: --focus-ring()` for focus indicators | `outline: none; box-shadow: inset 0 0 0 2px var(…, #hex)` |
| Odd px (`3px`, `11px`) for spacing/size/radius | On-grid step (8/4/2px) or the token's real value |
| A paragraph of rationale beside the code | One line, or a `TRAP` citation into `docs/TRAPS.md` |

---

## Comments are simple and concise — if they are needed at all

Ratified 2026-09-21. **HTML, CSS, JS and TS alike.**

Measured when the rule was given: TS was 34% comments (5,925 of 17,222 lines),
component CSS 36%, component **HTML 64%** — some templates 89%. A long comment
is a second place the truth lives, and it rots; this repo has the receipts.

| Cut | Keep |
|---|---|
| Multi-paragraph rationale | One-line summary on an export |
| Markdown tables in comments | A file header of one or two lines |
| "It used to be X, which was wrong because Y" | A warning NOT obvious from the code — a silent failure, a browser quirk, an ordering constraint |
| Restating what the code plainly says | A line that looks like a mistake and is not |
| Worked examples longer than one line | `/* off-grid-ok */` and other pragmas |

**Depth belongs in `docs/TRAPS.md`**, which is gated both ways: a `TRAP
T-some-id` citation must survive verbatim, and the explanation lives in the doc
rather than beside the code. That is the trade — the citation stays, the essay
moves.

Two regions are exempt because a generator owns them: everything above
`/* == end sherpa:tokens == */` in a component's CSS, and the `Public API:` /
`Fires:` blocks in its HTML.

Aim nearer 15% than 40%.

### Template literals

Measured 2026-09-21: 1,831 backtick strings across the repo, but only **29
genuinely span lines**. The rest are one-line interpolation — `${name}.html`,
a path, a regex — which is what backticks are for.

Of the 29, every one is **generating text**, and the target's own comment syntax
is why they look confusing:

| where | generates | needs a literal? |
|---|---|---|
| `project-tokens.mjs` (9 blocks) | `tokens.css` | 6 interpolate; 3 are static CSS |
| `mcp-server/prompts/index.js` | markdown prompts | yes — multi-paragraph |
| `dashboard-views.js` | a saved view's markup | yes — content IS a string |

**A `/* */` or `<!-- -->` inside one is OUTPUT, not a JS comment.** A regex
comment-stripper eats it and reports a false code change — which is exactly what
happened when three build scripts were checked that way. Run the script and
diff its output instead: `project-tokens.mjs` regenerating `tokens.css`
byte-identically is the real proof.

Keep comments inside them to one line, because they ship: `tokens.css` carries
50 comment lines of 2,211, which is the right order.

---

## Suppression budget

`src/` currently has **zero** `@ts-expect-error` suppressions — keep it that way.
There is no `.fallowrc.json` and no `ts:check-regression` script on this branch;
`npm run type-check` (strict, no emit) is the gate. If you genuinely need a
suppression, say why in the comment above it.
