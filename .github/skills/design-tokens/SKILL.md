---
name: design-tokens
description: 'Use Sherpa design tokens correctly in component CSS and app HTML. Use when: choosing color, surface, text, spacing, sizing, border, shadow, or typography tokens; applying --sherpa-* tokens with required fallback values; activating a theme (apex-2-purple, apex-2-teal, apex-2-blue, apex-2-classic); switching light or dark mode with data-mode; enabling compact or comfortable density with data-density; applying data-status to components for critical, warning, success, info, or urgent coloring; using CSS custom functions --alpha(), --shadow-*(), --focus-ring(), --transition-*().'
---

# Design Tokens

## The 3-Tier Rule

| Tier | Prefix | File | Rule |
|------|--------|------|------|
| Core primitives | `--core-*` | `tokens/primitives.css` | **Never use** in component or app CSS |
| Semantic aliases | `--sherpa-*` | `tokens/sherpa-alias.css` | **Always use** — always with a hardcoded fallback |
| Component private | `--_*` | Component CSS only | Never expose in public API |

```css
/* ✅ Correct — semantic token with fallback */
color:      var(--sherpa-text-default-body, #1a1a1f);
background: var(--sherpa-surface-container-default, #f4f4f6);
padding:    var(--sherpa-space-md, 16px);

/* ❌ Wrong — core token, never use directly */
color: var(--core-colors-slate-900);

/* ❌ Wrong — missing fallback */
color: var(--sherpa-text-default-body);
```

Find the right token:
```
browse_tokens({ query: "surface" })    ← all surface tokens
browse_tokens({ query: "spacing" })    ← all space tokens
list_token_groups()                    ← every namespace, grouped by file
```

---

## Spacing Grid

All spacings must land on the **8px primary grid** with a **4px sub-grid**.

| Token | Value | Use for |
|-------|-------|---------|
| `--sherpa-space-3xs` | 2px | Borders and optical edge-case adjustments only |
| `--sherpa-space-2xs` | 4px | Tight inline gaps (icon-to-text, badge padding) |
| `--sherpa-space-xs` | 8px | Small gaps, icon-to-label spacing |
| `--sherpa-space-sm` | 12px | Compact padding |
| `--sherpa-space-default` / `--sherpa-space-md` | 16px | Standard padding |
| `--sherpa-space-lg` | 24px | Section spacing |
| `--sherpa-space-xl` | 32px | Large padding |
| `--sherpa-space-2xl` | 48px | Page-level section spacing |

**Forbidden values (never use):** 3, 5, 6, 7, 9, 10, 11, 13, 14, 15 — choose the nearest token instead.

---

## Component Sizing

| Token | Value | Use for |
|-------|-------|---------|
| `--sherpa-size-xs` | 24px | 2x-small controls |
| `--sherpa-size-sm` | 28px | Small controls |
| `--sherpa-size-md` | 32px | Default control height |
| `--sherpa-size-lg` | 40px | Large controls |
| `--sherpa-size-xl` | 48px | X-large controls |
| `--sherpa-size-2xl` | 64px | Icon / avatar sizes |

---

## Key Token Namespaces

| Namespace | Purpose | Example token |
|-----------|---------|---------------|
| `--sherpa-surface-*` | Background fills | `--sherpa-surface-container-default` |
| `--sherpa-text-*` | Text colors | `--sherpa-text-default-body` |
| `--sherpa-border-*` | Borders and radius | `--sherpa-border-container-default`, `--sherpa-border-rounding-base` |
| `--sherpa-icon-*` | Icon colors | `--sherpa-icon-default-subtle` |
| `--sherpa-space-*` | Spacing and gaps | (see table above) |
| `--sherpa-size-*` | Control heights | (see table above) |
| `--sherpa-shadow-*` | Elevation shadows | `--sherpa-shadow-default-md` |
| `--sherpa-fonts-scale-*` | Font sizes | `--sherpa-fonts-scale-base` (14px) |
| `--sherpa-fonts-context-*` | Font families | `--sherpa-fonts-context-default` (Open Sans) |
| `--sherpa-motion-transition-*` | Durations | `--sherpa-motion-transition-fast` |
| `--sherpa-border-rounding-*` | Border radius | `--sherpa-border-rounding-base` (8px) |

See [references/token-namespaces.md](./references/token-namespaces.md) for every token with its value and usage note.

---

## Theme Activation

All themes are bundled in `css/styles/index.css` — no extra stylesheet needed.

```html
<!-- Default theme (apex-2-core): omit the attribute -->
<html>

<!-- Extended themes: set data-theme on <html> -->
<html data-theme="apex-2-purple">
<html data-theme="apex-2-teal">
<html data-theme="apex-2-blue">
<html data-theme="apex-2-classic">
```

Via JavaScript (with optional localStorage persistence):
```js
import { ThemeManager } from 'sherpa-ui/components/utilities/theme-manager.js';
ThemeManager.setTheme('apex-2-purple');
```

---

## Mode (Light / Dark / High Contrast)

Set on `<html>` for global scope, or any ancestor element for a subtree:

```html
<html data-mode="auto">   <!-- honors OS prefers-color-scheme (default) -->
<html data-mode="light">
<html data-mode="dark">
<html data-mode="hc">     <!-- high contrast -->
```

**Do not use** `light-dark()` or `prefers-color-scheme` in component CSS — mode is handled entirely by the theme files via token redefinition.

---

## Density

```html
<!-- On <html> for global scope, or any ancestor for a subtree -->
<html data-density="compact">      <!-- tighter spacing throughout -->
<html data-density="comfortable">  <!-- more generous spacing -->
<!-- default: omit attribute = base density -->
```

Components read density-aware tokens internally — no per-component changes needed.

---

## Status System

Set `data-status` on any container or component to apply semantic coloring to that element and its Sherpa children. The CSS custom properties cascade through shadow DOM automatically.

```html
<sherpa-callout data-status="critical">…</sherpa-callout>
<sherpa-button  data-status="success">…</sherpa-button>
<div data-status="warning">
  <!-- All sherpa-* components inside inherit --_status-* vars -->
</div>
```

**Available statuses:** `critical` | `warning` | `success` | `info` | `urgent`

### Consuming Status in Component CSS

Use `--_status-*` private variables in fallback chains:

```css
/* Surface: status fill → primary fill -->
background: var(--_status-surface-strong,
            var(--sherpa-surface-control-primary-default, #2855ef));

/* Text: status text → on-color text */
color: var(--_status-text-on-color,
       var(--sherpa-text-default-on-color-body, #ffffff));

/* Border: status border → default border */
border-color: var(--_status-border,
              var(--sherpa-border-control-default, #c8cad0));
```

The 6 private status variables set by `sherpa-status.css`:
- `--_status-surface` — subtle fill
- `--_status-surface-strong` — strong fill
- `--_status-border` — border color
- `--_status-text` — text color
- `--_status-text-on-color` — text on strong surface
- `--_status-icon` — icon color

---

## CSS Custom Functions

> **Chromium 139+ only.** No Safari or Firefox support. Do not add `@supports` fallbacks — these functions are for internal component use only.

| Function | Signature | Replaces |
|----------|-----------|---------|
| `--alpha(color, pct)` | `<color>, 0–100` → color | `color-mix(in srgb, X calc(Y * 1%), transparent)` |
| `--shadow-sm(tint)` | `<color>` → box-shadow value | Inline multi-layer box-shadow |
| `--shadow-md(tint)` | `<color>` → box-shadow value | |
| `--shadow-lg(tint)` | `<color>` → box-shadow value | |
| `--shadow-sunken(tint)` | `<color>` → box-shadow value | |
| `--focus-ring()` / `--focus-ring(color)` | → outline shorthand | `outline: 2px solid var(--sherpa-border-focus-default)` |
| `--transition-fast(prop)` | `<custom-ident>` → transition | `<prop> var(--sherpa-motion-transition-fast) ease-out` |
| `--transition-base(prop)` | `<custom-ident>` → transition | |
| `--transition-slow(prop)` | `<custom-ident>` → transition | |

```css
:host(:focus-visible) {
  outline: --focus-ring();
  outline-offset: 2px;
}

background: --alpha(var(--sherpa-surface-context-error-strong-default, #d7191e), 15);
box-shadow: --shadow-md(var(--sherpa-elevation-tint-default, #1a1a1f));
transition: --transition-fast(background-color), --transition-fast(border-color);
```
