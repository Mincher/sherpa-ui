# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

## Read these first

This file holds the RULES. The handover docs hold the *why* — the traps, the
rulings, and the reasons behind decisions that look odd. Several are silent
failures that have each cost hours.

| Doc | Read it when |
|---|---|
| [docs/HANDOVER.md](docs/HANDOVER.md) | **Always, before your first change.** Traps (anchor positioning, tables, shadow DOM, SVG), the working method, where the interesting code is |
| [docs/HANDOVER-BACKLOG.md](docs/HANDOVER-BACKLOG.md) | Picking up work — what is queued and what "done" means |
| [docs/DATA-LAYER-PLAN.md](docs/DATA-LAYER-PLAN.md) | **Working on data, state, or view definitions** — Store/DataSource, the ownership + parity rules, view definitions, and the headless contract. This branch's plan |
| [docs/HANDOVER-FIGMA.md](docs/HANDOVER-FIGMA.md) | Touching tokens or reading Figma — how to read values RELIABLY (extension overrides read back empty) |

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

# Lint TypeScript
npm run lint
npm run lint:fix

# Lint component CSS (structural rules; --strict elevates grid warnings to errors)
npm run lint:css
npm run lint:css:strict

# Validate the component specs against schemas/component.v1.json.
# RUNS IN THE PRE-COMMIT HOOK — a spec that does not match blocks the commit.
npm run spec:validate
npm run spec:check         # coverage + round-trip table, writes nothing

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
- **MCP server** (`mcp-server/`) — gives AI agents structured access to component specs, tokens, the ontology, and the build rules. (There is no `patterns/` directory on this branch — `examples/` is the working reference instead.)

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

**The EVENTS in a spec come from the code, not from the `Fires:` comment.** That
comment is prose, and reading it for identifiers put phantom events into 31 of the
58 specs — one component declared an event literally called `nothing`, another had
scraped sixteen words out of sentences about its filters. The generator now
intersects the comment with what the TypeScript actually dispatches (`emit()`,
`new CustomEvent`, `new Event`), so a comment can choose which emitted events are
public but can never invent one. `scripts/resync-figma.mjs --check`
reports drift between a spec and Figma. (`scripts/generate-defs.mjs` was deleted
2026-09-16 — it had been a stub that only printed an error.)

**The golden rule:** can this be done in HTML or CSS before writing JS? If yes, do it there.

### `SherpaElement` base class (`src/core/sherpa-element.ts`)

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
| `fallbackAttr` | a legacy alias (`data-label` → `data-heading`) |
| `default` | a real default string (`'Available'`, `'Ask N-zo'`) |

`skipWhen` on a `<slot>` guards only when the slot is **filled** — a `<slot>` in the
template is the normal state, not an override.

Keep it hand-written when the write is not a plain attribute→text mapping: a runtime
selector choice (`nav-item`), a text template (`file-upload`'s `"Maximum file size: …"`),
or a value derived from something other than the attribute (`sherpa-list`'s row count).

### `data-*` attributes as the public API

Components expose their entire public API through `data-*` attributes. CSS selects on them via `:host([data-*])`; JS reads/writes `this.dataset`. Native HTML attributes (`disabled`, `hidden`, `name`, `value`, etc.) stay un-prefixed.

Standard names: `data-variant`, `data-size`, `data-status`, `data-type`, `data-layout`, `data-active`, `data-selected`, `data-elevation`, `data-label`, `data-description`, `data-icon-start`, `data-icon-end`.

### Naming contract (ratified — Phase 0.5)

Applies to **all** components, existing and new:

- **Element names:** every Sherpa-UI custom element is `sherpa-*`. No exceptions.
- **Attributes:** `data-*` for the public API; native attributes (`disabled`, `name`, `value`, `hidden`, `required`, `readonly`) stay un-prefixed. Reuse the standard-name enums above verbatim — don't invent a synonym for an existing concept. Component-private state is `--_*` CSS custom properties, never a public `data-*`.
- **Events:** **unprefixed `noun-verb`** names (`button-click`, `page-change`, `tree-select`, `quick-filter-change`). Do **not** prefix event strings with `sherpa-`. Standard shared events: `change`/`input` (re-dispatched native), `*-click`, `*-change`, `*-select`, `*-open`/`*-close`.
- **Standard data attrs for data components:** `data-sort-field`/`data-sort-direction` (`asc|desc`), `data-segment-field`/`data-segment-mode` — reuse across all chart/grid components.
- **Slots:** every content-bearing slot declares a `data-accepts` category allowlist. There is no separate slot-contracts doc — read the `data-accepts` values in the component `.html` templates. **12 of the 44
  slot-bearing components carry them** — the rule is every content-bearing slot, so
  the other 32 are a real gap, not a licence to skip it.

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

### Status cascade (`[data-status]`)

Setting `data-status="critical|warning|success|info|urgent"` on any ancestor emits `--_status-*` custom properties that inherit through Shadow DOM. Components consume them via fallback chains — no per-component status blocks are needed:

```css
background: var(--_status-surface-strong, var(--sherpa-surface-control-primary-default));
```

Available: `--_status-surface` (style-surface/base), `--_status-surface-subtle` (+1 — the pale tint, e.g. the Toast card), `--_status-surface-strong` (+2), `--_status-shadow` (style-surface/shadow — status-tinted elevation colour), `--_status-border` (neutral in most modes), `--_status-border-strong` (style-border/base +1 — the status-tinted rule/stroke, e.g. a sparkline), `--_status-text`, `--_status-text-on-color`, `--_status-icon`.

### No CSS `@function` library

The reforged branch has **no** `@function` library — there is no `sherpa-functions.css`,
and `SherpaElement.sharedStyles` is exactly `src/core/sherpa-base.css` + the Font
Awesome CDN sheet (see `src/index.ts`). Write transitions, shadows and alpha blends
longhand from tokens. A CSS `@function` fails SILENTLY where it is unsupported
(the property falls back to its initial value), which is why focus rings never
used one.

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

**This exact token and fallback, verbatim** — 47 sites across 29 components use
it and nothing else. This doc named `--sherpa-border-control-primary-default`
until 2026-09-16; **that token does not exist** in `tokens.css`, so anyone who
followed the doc got a focus ring drawn in the fallback colour only, and a
slightly wrong one. A ring nobody can see is the accessibility bug the rule
exists to prevent.

Two components deviate and are **not** the pattern to copy: `sherpa-button`
(outer ring + surface halo) and `sherpa-progress-step-tracker` / the
`sherpa-select-card` tick (outer `0 0 0 2px`). `sherpa-input-text` and
`sherpa-pagination` route through a private `--_border-focus` because they also
need an error state — acceptable, since the resolved value is the same.

### Events

Always `bubbles: true`. Add `composed: true` for events that must cross shadow DOM boundaries to application code:
```ts
this.dispatchEvent(new CustomEvent('card-click', { bubbles: true, composed: true, detail: {} }));
```
Prefer the base-class `this.emit(name, detail)` helper (sets `bubbles`+`composed`). Event **names** follow the ratified naming contract above: unprefixed `noun-verb`, no `sherpa-` prefix. Every dispatched event must have a matching `@fires` tag in the component's JSDoc (the MCP parses these into the component schema — keep them in sync). Document-level broadcasts via `document.dispatchEvent` are the one case where `bubbles` is moot.

### CRUD flows

Flows are composed from existing components — there is no dedicated flow component,
and no flow-manager utility module on this branch. A flow is wired by hand in the
app: open a `sherpa-dialog` with `.show()` (NOT the native `showModal()` — the
component owns modality and the `open` attribute), read the fields, then append a
`sherpa-toast` for feedback.

`examples/views/records.js` is the working reference — the add-customer
button → dialog → save → toast path.

### MCP server (`mcp-server/`)

**10 tools** across three modules, **4 `sherpa://` resource templates**, and
**3 guided prompts**. Run with `npm run mcp` (stdio).

| Module | Tools |
|---|---|
| `tools/discover.js` | `list_components`, `get_component`, `browse_ontology`, `explain_token` |
| `tools/generate.js` | `scaffold_def`, `validate_def`, `compile_def`, `token_for` |
| `tools/verify.js` | `audit_component`, `check_bindings` |

Resources: `sherpa://def/{name}`, `sherpa://ontology/{id}`,
`sherpa://component/{name}/{kind}`, `sherpa://rules`. Prompts:
`generate_component`, `debug_component`, `review_component_usage`.

The component contract it reads is `<name>.component.yaml`; tokens come from
`src/styles/tokens/`.

### Disabled state

**Never `opacity`** — compounds in dark mode. Use inactive tokens per property:
```css
:host([disabled]) {
  cursor: not-allowed;
  pointer-events: none;
  color: var(--sherpa-content-inactive-default, #5c5c66);
  background: var(--sherpa-surface-container-inactive, #f2f2f2);
  border-color: var(--sherpa-border-container-inactive, #c0c0cc);
}
```

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

---

## Suppression budget

`src/` currently has **zero** `@ts-expect-error` suppressions — keep it that way.
There is no `.fallowrc.json` and no `ts:check-regression` script on this branch;
`npm run type-check` (strict, no emit) is the gate. If you genuinely need a
suppression, say why in the comment above it.
