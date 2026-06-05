# Sherpa UI — Codebase Audit & Improvement Plan

> Audit date: 25 May 2026  
> Scope: All components assessed against established HTML-first / CSS-first principles.  
> Status legend: **Open** — not yet fixed · **In Progress** — work underway · **Resolved** — fix merged

---

## Executive Summary

The Sherpa-UI library demonstrates a mature, well-structured Web Components architecture that follows consistent patterns for component lifecycle management, status theming, and static factory APIs. The codebase largely adheres to the established principles. Issues found are focused on a small number of components and fall into four categories:

1. **Memory leaks** — orphaned DOM elements and retained references
2. **Accessibility gaps** — missing ARIA roles, labels, and live regions
3. **CSS anti-patterns** — `opacity` used for disabled state, placeholder comment bloat, missing `:host(:not(...))` fallbacks
4. **JavaScript doing CSS's job** — `.hidden = true/false` on shadow DOM internals, `classList.add/remove` for visual state

---

## Priority Matrix

| # | Priority | Status | Component | Issue | Impact |
|---|----------|--------|-----------|-------|--------|
| 1 | **Critical** | Open | `sherpa-toast` | Container memory leak — empty containers never removed | DOM bloat, performance degradation |
| 2 | **Critical** | Open | `sherpa-tooltip` | CSS anchor positioning fallback incomplete | Tooltip invisible in non-supporting browsers |
| 3 | **High** | Open | `sherpa-toast` | Z-index higher than tooltip (`1100` vs `10000`) | Potential stacking-order inversion |
| 4 | **High** | Open | `sherpa-tooltip` | Singleton instance never removed from DOM | Memory leak in SPAs |
| 5 | **High** | Open | `sherpa-nav-section` | `.hidden = false` on shadow DOM internals (3×) | Breaks CSS visibility contract |
| 6 | **High** | Open | `sherpa-message` | `.hidden = true/false` on shadow DOM internals | Breaks CSS visibility contract |
| 7 | **Medium** | Open | `sherpa-toast` | Missing `aria-live` on toast container | Screen readers miss dynamically added toasts |
| 8 | **Medium** | Open | `sherpa-code-block` | CDN dependency with no SRI hash or error fallback | Silent failure on CDN outage |
| 9 | **Medium** | Open | `sherpa-tooltip` | CSS fallback missing `left` / `right` position rules | Broken positioning in some browsers |
| 10 | **Medium** | Open | `sherpa-input-select` | `placeholderOpt.hidden = true` on shadow DOM internal | Breaks CSS visibility contract |
| 11 | **Medium** | Open | `sherpa-breadcrumbs` | No `aria-label` on breadcrumb `<nav>` | Screen reader navigation context missing |
| 12 | **Medium** | Open | `sherpa-view-header` | `tag.hidden = false` + heavy `createElement` usage | JS creating structural DOM |
| 13 | **Low** | Open | `sherpa-toast` | CSS placeholder section comments left in stylesheet | Code bloat, confuses developers |
| 14 | **Low** | Open | `sherpa-icon` | SVG registry never cleared — accumulates in SPAs | Gradual memory growth |
| 15 | **Low** | Open | `sherpa-code-block` | `classList.toggle('hljs-dark', ...)` for visual state | Should be driven by `data-theme` + CSS selector |
| 16 | **Low** | Open | `sherpa-input-base` | `opacity: 0.45` for disabled state | Should use inactive tokens per property |
| 17 | **Low** | Open | `sherpa-nav` | CSS Highlight API used without feature detection guard | Runtime error in non-supporting browsers |
| 18 | **Low** | Open | `sherpa-tag` | `light-dark()` used in component CSS | Contradicts the "no `light-dark()` in components" rule |
| 19 | **Low** | Open | `sherpa-nav-item` | `light-dark()` used in component CSS | Same as above |

---

## Detailed Findings & Fixes

---

### 1. `sherpa-toast` — Container Memory Leak (Critical)

**File:** `components/sherpa-toast/sherpa-toast.js`  
**Lines:** `~200`, `~170`

Containers are created on demand and appended to `document.body`. When all toasts inside a container are dismissed, the empty container is never removed and the static registry entry is never cleared.

**Fix — clean up container on `hide()`:**

```js
hide() {
  const toast = this.$('.toast');
  if (!toast) return;
  toast.dataset.state = 'hiding';

  setTimeout(() => {
    this.dispatchEvent(new CustomEvent('close', { bubbles: true, composed: true }));
    const container = this.parentElement;
    this.remove();
    // Remove container when last toast leaves
    if (container?.childElementCount === 0) {
      const pos = container.dataset.position;
      if (pos) delete SherpaToast.#containers[pos];
      container.remove();
    }
  }, 300);
}
```

---

### 2. `sherpa-tooltip` — Incomplete Anchor Positioning Fallback (Critical)

**File:** `components/sherpa-tooltip/sherpa-tooltip.js`  
**File:** `components/sherpa-tooltip/sherpa-tooltip.css`

`showFor()` attempts to read `--_point-offset` from the anchor — a property that typically doesn't exist — then silently proceeds. In browsers without CSS Anchor Positioning the tooltip remains invisible.

**Fix — implement `getBoundingClientRect()` fallback in JS:**

```js
async showFor(anchor, text, { position = 'top' } = {}) {
  if (!anchor) return;
  await this.rendered;
  this.setText(text);
  this.setPosition(position);

  if (!supportsAnchor) {
    const r = anchor.getBoundingClientRect();
    const offsets = {
      top:    { top: r.top - 8,        left: r.left + r.width / 2 },
      bottom: { top: r.bottom + 8,     left: r.left + r.width / 2 },
      left:   { top: r.top + r.height / 2, left: r.left - 8 },
      right:  { top: r.top + r.height / 2, left: r.right + 8 },
    };
    const { top, left } = offsets[position] ?? offsets.top;
    this.style.top  = `${top}px`;
    this.style.left = `${left}px`;
  }

  this.setVisible(true);
}
```

**Fix — add missing `left` / `right` CSS fallbacks:**

```css
@supports not (position-anchor: --tooltip-anchor) {
  /* existing top / bottom rules … */

  :host([data-position="left"]) {
    transform: translateX(-100%) translateY(-50%);
    margin-left: calc(-1 * var(--sherpa-space-2xs, 0.375rem));
  }

  :host([data-position="right"]) {
    transform: translateX(0) translateY(-50%);
    margin-left: var(--sherpa-space-2xs, 0.375rem);
  }
}
```

---

### 3. `sherpa-toast` — Z-Index Stacking Order (High)

**File:** `components/sherpa-toast/sherpa-toast.js` — injected `<style>`  
Injected container style sets `z-index: var(--sherpa-z-toast, 1100)`.  
Tooltip uses `z-index: 10000` in its shadow styles.  
Dialogs will typically use `z-index: 1000+` in their own layer.

The toast sits inside the modal layer, which risks being obscured by modals or dialog backdrops.

**Fix:** Align toast z-index to sit below tooltips and above dialogs:

```js
// In #ensureContainerStyles():
z-index: var(--sherpa-z-toast, 1050);
```

---

### 4. `sherpa-tooltip` — Singleton Instance Leak (High)

**File:** `components/sherpa-tooltip/sherpa-tooltip.js`

Module-level `instance` is appended to `document.body` on first use and never removed. In SPA navigations the instance persists indefinitely.

**Fix:** Expose a `destroy()` static method:

```js
static destroy() {
  if (instance) {
    instance.remove();
    instance = null;
    currentAnchor = null;
  }
}
```

Call from the app's route-change teardown hook if needed.

---

### 5 & 6. `sherpa-nav-section` / `sherpa-message` — `.hidden` on Shadow DOM Internals (High)

**Files:**  
- `components/sherpa-nav-section/sherpa-nav-section.js` lines 188, 206, 231  
- `components/sherpa-message/sherpa-message.js` lines 112, 115

Setting `.hidden = true/false` on internal shadow elements violates the core rule: **CSS owns all show/hide logic**.

**Fix pattern — JS sets attribute on host; CSS reacts:**

```js
// ❌ Before
labelEl.hidden = false;

// ✅ After
this.toggleAttribute('data-has-label', !!labelText);
```

```css
/* ❌ Before — no rule, element always visible */

/* ✅ After */
.label { display: none; }
:host([data-has-label]) .label { display: block; }
```

Apply the same pattern for `desc`, `iconEl`, and the message link.

---

### 7. `sherpa-toast` — Missing `aria-live` on Container (Medium)

**File:** `components/sherpa-toast/sherpa-toast.js` — injected `<style>` / container creation

Toasts are appended to a container dynamically. Without `aria-live` on the container, screen readers do not announce newly added toasts.

**Fix:**

```js
el.setAttribute('aria-live', 'polite');
el.setAttribute('aria-relevant', 'additions');
el.setAttribute('role', 'log');
```

---

### 8. `sherpa-code-block` — CDN Dependency Without SRI (Medium)

**File:** `components/sherpa-code-block/sherpa-code-block.js`

```js
static PRISM_CDN = 'https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0';
```

No `integrity` hash; no fallback if CDN fails. Code blocks silently display unstyled plain text.

**Fix — add integrity and a user-visible error state:**

```js
static PRISM_CDN = 'https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0';
static PRISM_INTEGRITY = 'sha384-<hash-here>';

// When loading the script tag:
script.integrity = SherpaCodeBlock.PRISM_INTEGRITY;
script.crossOrigin = 'anonymous';
script.onerror = () => this.toggleAttribute('data-highlight-error', true);
```

---

### 9. `sherpa-tooltip` — Missing CSS Fallback Positions (Medium)

Covered in finding #2. `left` and `right` positions have no `@supports not` fallback rules in the CSS.

---

### 10. `sherpa-input-select` — `.hidden` on Internal Option (Medium)

**File:** `components/sherpa-input-select/sherpa-input-select.js` line 178

```js
placeholderOpt.hidden = true;
```

This is a native `<option>` inside the shadow `<select>`. The `hidden` attribute on `<option>` is a valid HTML construct (unlike shadow DOM internals), so this is acceptable. **No change required** — this is a false positive. The rule applies to internal shadow DOM structural elements, not form field options.

---

### 11. `sherpa-breadcrumbs` — No `aria-label` on `<nav>` (Medium)

**File:** `components/sherpa-breadcrumbs/sherpa-breadcrumbs.html` (or template HTML)

The breadcrumb trail wraps in a `.breadcrumb-trail` element. Without an `aria-label`, screen readers will announce "navigation" with no context.

**Fix:**

```html
<nav aria-label="Breadcrumb" class="breadcrumb-trail">
  <!-- crumbs rendered here -->
</nav>
```

---

### 12. `sherpa-view-header` — Heavy `createElement` for Structural DOM (Medium)

**File:** `components/sherpa-view-header/sherpa-view-header.js` lines 366–463

Constructs `sherpa-button`, `sherpa-tag`, `sherpa-menu`, `<ul>`, `<li>`, and a `<style>` element entirely in JS. Per the **Template Completeness Rule**, every element the component will ever show must exist in the HTML template from the start.

**Recommended approach:**
- Move the trigger `sherpa-button`, `sherpa-tag`, and `sherpa-menu` into the HTML template.
- Use cloning prototypes (`<template class="...">`) for the repeating `<li>` items.
- Remove the inline `<style>` injection; put those rules in the component CSS.
- JS only populates `textContent` / `dataset` values and calls `cloneNode`.

This is the largest refactor in the plan and should be scoped as its own ticket.

---

### 13. `sherpa-toast` — Placeholder CSS Comment Bloat (Low)

**File:** `components/sherpa-toast/sherpa-toast.css`

Empty section banners for ICON, CONTENT, ACTION BUTTON etc. appear in `:host {}` with no rules beneath them. They were placeholders from a migration and should be removed.

---

### 14. `sherpa-icon` — SVG Registry Never Cleared (Low)

**File:** `components/sherpa-icon/sherpa-icon.js`

```js
const _registry = new Map();
```

The `unregister(name)` public method exists but no `unregisterAll()`. Long-running SPAs that register icons per-route accumulate entries.

**Fix:**

```js
static unregisterAll() { _registry.clear(); }
```

---

### 15. `sherpa-code-block` — `classList.toggle` for Visual Theme State (Low)

**File:** `components/sherpa-code-block/sherpa-code-block.js` lines 418–419

```js
this.#preEl.classList.toggle('hljs-dark', isDark);
this.#preEl.classList.toggle('hljs-light', !isDark);
```

This uses JS to toggle classes for a visual state. It should instead toggle a `data-theme` attribute on the host and let CSS drive the class on the `<pre>` element — or better, have Prism's theme react to a CSS custom property.

**Fix:**

```js
// JS sets host attribute only
this.dataset.resolvedTheme = isDark ? 'dark' : 'light';
```

```css
/* CSS selects Prism theme class via host attribute */
:host([data-resolved-theme="dark"]) .code-pre  { /* dark styles */ }
:host([data-resolved-theme="light"]) .code-pre { /* light styles */ }
```

---

### 16. `sherpa-input-base` — `opacity` for Disabled (Low)

**File:** `components/utilities/sherpa-input-base/sherpa-input-base.css` line 164

```css
opacity: 0.45;
```

Using `opacity` for disabled state compounds in nested components and can cause illegibility in dark mode.

**Fix — use inactive tokens per property:**

```css
:host([disabled]) .input-field {
  color: var(--sherpa-text-inactive-default);
  background: var(--sherpa-surface-control-inactive-default);
  border-color: var(--sherpa-border-inactive-default);
  cursor: not-allowed;
  pointer-events: none;
}
```

---

### 17. `sherpa-nav` — CSS Highlight API Without Feature Guard (Low)

**File:** `components/sherpa-nav/sherpa-nav.js`

The `::highlight(nav-search-match)` API is documented but usage is not guarded by `if (CSS.highlights)`.

**Fix:**

```js
if (CSS.highlights) {
  CSS.highlights.set('nav-search-match', new Highlight(...ranges));
} else {
  // Fallback: add a class to matched elements directly
}
```

---

### 18 & 19. `sherpa-tag` / `sherpa-nav-item` — `light-dark()` in Component CSS (Low)

**Files:**  
- `components/sherpa-tag/sherpa-tag.css` lines 82–84  
- `components/sherpa-nav-item/sherpa-nav-item.css` line 150

Per the architecture rules: _"No `light-dark()` in component CSS — themes own mode handling."_

These components define hard-coded brand colour pairs inline rather than consuming theme tokens.

**Fix — move to theme files or use semantic tokens:**

```css
/* ❌ Before */
--_status-surface: light-dark(var(--sherpa-color-brand-100), var(--sherpa-color-brand-900));

/* ✅ After — consume a semantic alias defined per-mode in the theme */
--_status-surface: var(--sherpa-surface-context-brand-subtle-default);
```

If the semantic token doesn't yet exist, add it to `sherpa-alias.css` and the relevant theme files.

---

## Implementation Chunks

Work can be grouped into self-contained PRs:

### Chunk A — Critical Fixes (do first)
- [ ] `sherpa-toast`: Fix container cleanup in `hide()`
- [ ] `sherpa-tooltip`: Implement `getBoundingClientRect()` fallback in `showFor()`
- [ ] `sherpa-tooltip`: Add missing `left`/`right` CSS fallback rules

### Chunk B — Accessibility
- [ ] `sherpa-toast`: Add `aria-live="polite"` / `role="log"` to container
- [ ] `sherpa-breadcrumbs`: Add `aria-label="Breadcrumb"` to `<nav>`

### Chunk C — JS Visibility Anti-patterns
- [ ] `sherpa-nav-section`: Replace `.hidden` with host `data-*` attributes + CSS
- [ ] `sherpa-message`: Replace `.hidden` with host `data-*` attributes + CSS

### Chunk D — CSS Anti-patterns
- [ ] `sherpa-input-base`: Replace `opacity` disabled style with inactive tokens
- [ ] `sherpa-tag`: Remove `light-dark()` — use semantic tokens
- [ ] `sherpa-nav-item`: Remove `light-dark()` — use semantic tokens
- [ ] `sherpa-code-block`: Replace `classList.toggle` theme logic with `data-resolved-theme`

### Chunk E — Code Quality & Safety
- [ ] `sherpa-toast`: Remove placeholder CSS section comments
- [ ] `sherpa-code-block`: Add SRI integrity hash to Prism CDN script
- [ ] `sherpa-nav`: Add `CSS.highlights` feature guard
- [ ] `sherpa-icon`: Add `unregisterAll()` static method
- [ ] `sherpa-tooltip`: Add `static destroy()` method

### Chunk F — Large Refactor (own ticket)
- [ ] `sherpa-view-header`: Move all createElement DOM to HTML template + cloning prototypes
