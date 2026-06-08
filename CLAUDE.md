# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

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

### Component anatomy (three-file split)

Every component lives in `components/sherpa-<name>/` with exactly three files:

| File | Owns |
|------|------|
| `sherpa-<name>.ts` | Lifecycle, events, attribute coordination — JS is the last resort |
| `sherpa-<name>.css` | **All** presentation: variants, states, visibility, responsiveness, transitions |
| `sherpa-<name>.html` | Shadow DOM template, slots, semantic structure |

**The golden rule:** can this be done in HTML or CSS before writing JS? If yes, do it there.

### `SherpaElement` base class (`components/utilities/sherpa-element/sherpa-element.ts`)

All components extend this. It handles template fetching (with class-level cache), shadow DOM setup via `adoptedStyleSheets`, slot-presence detection (`data-has-{slotName}` on host), and multi-template support.

```ts
export class SherpaFoo extends SherpaElement {
  static override get cssUrl()  { return new URL('./sherpa-foo.css',  import.meta.url).href; }
  static override get htmlUrl() { return new URL('./sherpa-foo.html', import.meta.url).href; }
  static override get observedAttributes() { return [...super.observedAttributes, 'data-variant']; }

  override onRender()  { /* shadow DOM ready — cache refs, set defaults, wire host listeners */ }
  override onConnect() { /* fires once after first render — for one-time setup needing DOM */ }
  override onDisconnect() { /* clean up timers / observers */ }
  override onAttributeChanged(name, oldVal, newVal) { /* react to attribute changes */ }
}
customElements.define('sherpa-foo', SherpaFoo);
```

Shadow root queries: `this.$('.sel')` (querySelector) and `this.$$('.sel')` (querySelectorAll). Never use `this.shadowRoot.querySelector` directly.

`onRender()` is guarded by a `#rendered` flag — it fires exactly once. Event listeners registered there will not double-bind.

### `data-*` attributes as the public API

Components expose their entire public API through `data-*` attributes. CSS selects on them via `:host([data-*])`; JS reads/writes `this.dataset`. Native HTML attributes (`disabled`, `hidden`, `name`, `value`, etc.) stay un-prefixed.

Standard names: `data-variant`, `data-size`, `data-status`, `data-type`, `data-layout`, `data-active`, `data-selected`, `data-elevation`, `data-label`, `data-description`, `data-icon-start`, `data-icon-end`.

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

Always write: `var(--sherpa-space-sm, 12px)`. The fallback is required.

Cascade layer order (declared in `css/styles/index.css`):
```
reset → primitives → alias → platform → theme → density → status → components → utilities
```

Themes live in `css/styles/sherpa-themes.css` (always loaded). Activate via `<html data-theme="apex-2-purple">`. Mode via `<html data-mode="auto|light|dark|hc">`. `ThemeManager` (`components/utilities/theme-manager.js`) handles persistence. There is no `light-dark()` in component CSS — themes own mode handling.

### Status cascade (`[data-status]`)

Setting `data-status="critical|warning|success|info|urgent"` on any ancestor emits `--_status-*` custom properties that inherit through Shadow DOM. Components consume them via fallback chains — no per-component status blocks are needed:

```css
background: var(--_status-surface-strong, var(--sherpa-surface-control-primary-default));
```

Available: `--_status-surface`, `--_status-surface-strong`, `--_status-border`, `--_status-text`, `--_status-text-on-color`, `--_status-icon`.

### CSS `@function` library (`css/styles/tokens/sherpa-functions.css`)

Loaded in both `css/styles/index.css` (light DOM) and `SherpaElement.sharedStyles` (every shadow root) — both are required. Functions are Chromium 139+ only; Safari/Firefox receive the property's initial value.

| Function | Returns | Safe to use for |
|----------|---------|-----------------|
| `--transition-fast/base/slow(--prop)` | transition shorthand | Motion — degrades gracefully (no animation) |
| `--alpha(--c, --pct)` | alpha-blended colour | Subtle surfaces — check if degradation is acceptable |
| `--shadow-sm/md/lg/sunken(--tint)` | box-shadow value | Elevation — degrades to no shadow |
| `--focus-ring(--color?)` | `2px solid <color>` | **Do not use for keyboard focus indicators** — silent failure = invisible focus ring (WCAG 2.4.11) |

For focus rings, always use the explicit fallback pattern:
```css
:host(:focus-visible) {
  outline: none;
  box-shadow: 0 0 0 2px var(--sherpa-border-control-primary-default, #3c5edd);
}
```

### Events

Always `bubbles: true`. Add `composed: true` for events that must cross shadow DOM boundaries to application code:
```ts
this.dispatchEvent(new CustomEvent('card-click', { bubbles: true, composed: true, detail: {} }));
```

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

Components use `@container` for responsive adaptation — **no viewport `@media` queries** inside component CSS. Four `@media (forced-colors: active)` blocks exist for OS accessibility; these are intentional exceptions.

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
| `outline: --focus-ring()` for focus indicators | `outline: none; box-shadow: 0 0 0 2px var(…, #hex)` |

---

## Suppression budget

TypeScript `@ts-expect-error` suppressions are tracked in `.fallowrc.json`. Run `npm run ts:check-regression` before committing to ensure the count hasn't increased.
