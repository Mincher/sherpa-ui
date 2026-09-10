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
| [docs/HANDOVER-FIGMA.md](docs/HANDOVER-FIGMA.md) | Touching tokens or reading Figma — how to read values RELIABLY (extension overrides read back empty) |

Active branch is `sherpa-reforged`. **Never push** — commit freely, pushing is
Will's call.

---

## Commands

```bash
# Build (clean → compile TS → copy HTML/CSS assets → generate tokens/patterns)
npm run build

# TypeScript only (fast iteration)
npm run build:ts
npm run build:ts:watch

# Type check (no emit)
npm run type-check

# Lint TypeScript
npm run lint
npm run lint:fix

# Lint component CSS (structural rules; --strict elevates grid warnings to errors)
npm run lint:css
npm run lint:css:strict

# Tests
npm test                  # build:ts then web-test-runner
npm run test:watch
npm run test:coverage

# Accessibility audit
npm run test:a11y

# Pattern regeneration (run after changing pattern HTML)
npm run patterns

# MCP server
npm run mcp               # stdio transport — connect from Claude Desktop / Cursor
```

---

## Architecture

### Stack

- **Web Components** — Custom Elements + Shadow DOM + HTML Templates. No framework, no virtual DOM, zero runtime dependencies.
- **TypeScript** strict mode, compiled to ES2022 ES modules (`dist/components/`).
- **CSS** with design tokens sourced from Figma Variables.
- **MCP server** (`mcp-server/`) — gives AI agents structured access to schemas, tokens, patterns, and architecture rules.

### Component anatomy (three source files + one generated def)

Every component lives in `src/components/sherpa-<name>/`. Three hand-written source files:

| File | Owns |
|------|------|
| `sherpa-<name>.ts` | Lifecycle, events, attribute coordination — JS is the last resort |
| `sherpa-<name>.css` | **All** presentation: variants, states, visibility, responsiveness, transitions |
| `sherpa-<name>.html` | Shadow DOM template, slots, semantic structure |

A fourth file, `sherpa-<name>.component.yaml`, is **generated** (by `scripts/*.mjs` from the
source + Figma) and git-tracked — it is the component's thin def, consumed by the MCP and the
spec/validate tooling. Never hand-edit it; regenerate it.

**The golden rule:** can this be done in HTML or CSS before writing JS? If yes, do it there.

### `SherpaElement` base class (`src/core/sherpa-element.ts`)

All components extend this. It handles template fetching (with class-level cache), shadow DOM setup via `adoptedStyleSheets`, slot-presence detection (`data-has-{slotName}` on host), and multi-template support.

```ts
export class SherpaFoo extends SherpaElement {
  static override css = new URL('./sherpa-foo.css', import.meta.url);
  static override html = new URL('./sherpa-foo.html', import.meta.url);
  static override observed = ['data-variant'];

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

### `data-*` attributes as the public API

Components expose their entire public API through `data-*` attributes. CSS selects on them via `:host([data-*])`; JS reads/writes `this.dataset`. Native HTML attributes (`disabled`, `hidden`, `name`, `value`, etc.) stay un-prefixed.

Standard names: `data-variant`, `data-size`, `data-status`, `data-type`, `data-layout`, `data-active`, `data-selected`, `data-elevation`, `data-label`, `data-description`, `data-icon-start`, `data-icon-end`.

### Naming contract (ratified — Phase 0.5)

Applies to **all** components, existing and new:

- **Element names:** every Sherpa-UI custom element is `sherpa-*`. No exceptions.
- **Attributes:** `data-*` for the public API; native attributes (`disabled`, `name`, `value`, `hidden`, `required`, `readonly`) stay un-prefixed. Reuse the standard-name enums above verbatim — don't invent a synonym for an existing concept. Component-private state is `--_*` CSS custom properties, never a public `data-*`.
- **Events:** **unprefixed `noun-verb`** names (`button-click`, `page-change`, `tree-select`, `quick-filter-change`). Do **not** prefix event strings with `sherpa-`. Standard shared events: `change`/`input` (re-dispatched native), `*-click`, `*-change`, `*-select`, `*-open`/`*-close`.
- **Standard data attrs for data components:** `data-sort-field`/`data-sort-direction` (`asc|desc`), `data-segment-field`/`data-segment-mode` — reuse across all chart/grid components.
- **Slots:** every content-bearing slot declares a `data-accepts` category allowlist (see `docs/SLOT-CONTRACTS.md`).

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
core → display-mode → theme → layout → structure → style → elevation → components
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

### CSS `@function` library (`css/styles/tokens/sherpa-functions.css`)

Loaded in both `css/styles/index.css` (light DOM) and `SherpaElement.sharedStyles` (every shadow root) — both are required. Functions are Chromium 139+ only; Safari/Firefox receive the property's initial value.

| Function | Returns | Safe to use for |
|----------|---------|-----------------|
| `--transition-fast/base/slow(--prop)` | transition shorthand | Motion — degrades gracefully (no animation) |
| `--alpha(--c, --pct)` | alpha-blended colour | Subtle surfaces — check if degradation is acceptable |
| `--shadow-sm/md/lg/sunken(--tint)` | box-shadow value | Elevation — degrades to no shadow |
| `--focus-ring(--color?)` | `2px solid <color>` | **Do not use for keyboard focus indicators** — silent failure = invisible focus ring (WCAG 2.4.11) |

For focus rings, always use the explicit fallback pattern — and an INSET ring, so
the stroke is drawn INSIDE the component's own box rather than bleeding over its
neighbours (an outer ring on a snapped control pair, a table cell or a tight
toolbar overlaps whatever sits beside it):
```css
:host(:focus-visible) {
  outline: none;
  box-shadow: inset 0 0 0 2px var(--sherpa-border-control-primary-default, #3c5edd);
}
```

### Events

Always `bubbles: true`. Add `composed: true` for events that must cross shadow DOM boundaries to application code:
```ts
this.dispatchEvent(new CustomEvent('card-click', { bubbles: true, composed: true, detail: {} }));
```
Prefer the base-class `this.emit(name, detail)` helper (sets `bubbles`+`composed`). Event **names** follow the ratified naming contract above: unprefixed `noun-verb`, no `sherpa-` prefix. Every dispatched event must have a matching `@fires` tag in the component's JSDoc (the MCP parses these into the component schema — keep them in sync). Document-level broadcasts via `document.dispatchEvent` are the one case where `bubbles` is moot.

### CRUD flows

Flows are composed from existing components — there is no dedicated flow component. Three utility modules in `components/utilities/` orchestrate them:

- `FlowManager` — dialog lifecycle, flow events (`flow-start`, `flow-progress`, `flow-complete`, `flow-cancel`, `flow-error`), toast feedback
- `FormManager` — read/write/validate named form fields
- `refreshDataset` — re-dispatch `datasetfiltered` after data mutations

See `patterns/flows/add|edit|delete.html` for canonical HTML structure.

### MCP server (`mcp-server/`)

23 tools + 250+ `sherpa://` resources + 4 guided prompts. Component schemas are parsed lazily from JSDoc; tokens scanned from `css/styles/`; patterns from `patterns/index.json`. Run with `npm run mcp`.

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

TypeScript `@ts-expect-error` suppressions are tracked in `.fallowrc.json`. Run `npm run ts:check-regression` before committing to ensure the count hasn't increased.
