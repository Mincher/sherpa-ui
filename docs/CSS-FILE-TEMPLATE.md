# Sherpa CSS file template

> **Canonical structure for every component CSS file in this repo.**
> Files that deviate are refactored on touch. The lint script
> `scripts/lint-component-css.mjs` enforces the structural rules below.

This document is the single source of truth for **file shape**, **nesting
policy**, and **shared sheet usage**. For *what* each layer owns (HTML vs CSS
vs JS), see `.github/copilot-instructions.md`. For the documentation header
format, see `docs/COMPONENT-API-STANDARD.md`.

---

## 1. Shared sheets (do not redeclare)

`SherpaElement` adopts these stylesheets into every shadow root **before** your
component's own CSS, so your component CSS always wins on specificity.

| Sheet              | Adopted by                                            | Owns                                                                                                |
| ------------------ | ----------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| `sherpa-base.css`  | Every component (always)                              | `:host([hidden])`, `box-sizing`, `i { font-style: normal }`, tap-highlight reset, `prefers-reduced-motion` blanket |
| `sherpa-anchor.css`| Components with `static useAnchor = true`             | `:host([data-placement])` / `[data-offset]` / `[data-flip]` positioning for floating UI             |
| FA / text / icon / motion classes | Every component                       | Font Awesome glyphs, `.text-*` / `.icon-*` / `.motion-*` utility classes                            |

**Do not redeclare** any of the above in component CSS. Common offenders to
delete on touch:

```css
/* ❌ Delete — provided by sherpa-base.css */
:host([hidden]) { display: none; }
i { font-style: normal; }
*, *::before, *::after { box-sizing: border-box; }
```

To opt a floating-UI component into `sherpa-anchor.css`:

```js
export class SherpaPopover extends SherpaElement {
  static useAnchor = true;
  // …
}
```

Then in the template/CSS just use `data-placement="bottom-start"`,
`data-offset="sm"`, `data-flip` — never re-implement `top: anchor(bottom)`.

---

## 2. File section order (locked)

Every component CSS file ships sections in this order. Use the section
banners verbatim — the lint script does not require them, but they are
the spec for code review:

```css
/**
 * sherpa-foo.css
 * Per docs/COMPONENT-API-STANDARD.md
 */

/* ── Host base ──────────────────────────────────────────────── */
:host { /* display, layout, font, private --_* defaults */ }

/* ── Internal elements ──────────────────────────────────────── */
.label  { /* … nested &:hover / &:focus-visible OK here … */ }
.icon   { /* … */ }

/* ── Compound host visibility toggles ───────────────────────── */
:host([data-icon-start])  .icon-start { display: inline-flex; }
:host(:not([data-label])) .label      { display: none; }

/* ── Variants ───────────────────────────────────────────────── */
:host([data-variant="secondary"]) { --_surface: …; }

/* ── Sizes ──────────────────────────────────────────────────── */
:host([data-size="small"]) { --_size: …; }

/* ── Status (consumption only — set by global sherpa-status.css) */
:host { background: var(--_status-surface, var(--sherpa-surface-control-primary-default)); }

/* ── Interaction states ─────────────────────────────────────── */
:host(:hover:not([disabled])) { … }
:host(:focus-visible)         { … }
:host([disabled])             { … }   /* never opacity — inactive tokens per property */

/* ── Container queries ──────────────────────────────────────── */
:host { container: sherpa-foo / inline-size; }
@container sherpa-foo (max-width: 200px) { … }

/* ── Motion / forced-colors / print ─────────────────────────── */
@media (prefers-reduced-motion: no-preference) { … }
@media (forced-colors: active) { … }
@media print { … }

/* ── Advanced @supports (anchor, field-sizing, calc-size) ───── */
@supports (field-sizing: content) { textarea { field-sizing: content; } }
```

Skip any section that does not apply — but keep the relative order of
the sections you do use.

---

## 3. Nesting policy

Native CSS nesting is permitted and encouraged **except** where it desugars
into a broken shadow-DOM selector.

### ✅ Safe — nest freely

**Internal element rules** — nest state and child selectors inside the
element's own rule:

```css
.trigger {
  display: inline-flex;
  background: var(--_surface);

  &:hover { background: var(--_surface-hover); }
  &:focus-visible { outline: 2px solid var(--sherpa-border-focus-default); }
  &[aria-expanded="true"] { background: var(--_surface-active); }

  & .icon { color: var(--_icon-color); }
}
```

**Inside `@container`, `@media`, `@supports`** — nest normally:

```css
@container sherpa-card (max-width: 200px) {
  .description { display: none; }
  .title { font-size: var(--sherpa-text-body-sm-size); }
}
```

### ❌ Forbidden — never nest inside `:host {}`

CSS nesting with `&` inside `:host {}` desugars to the **chained** form
`:host:not(...)`, which does not match in shadow DOM. The functional form
`:host(:not(...))` is required.

```css
/* ❌ FORBIDDEN — desugars to :host:not(...) and silently fails */
:host {
  background: var(--_surface);
  &:hover { background: var(--_surface-hover); }
  &([data-variant="secondary"]) { … }
  &(:focus-visible) { … }
}

/* ✅ CORRECT — compound :host(...) selectors stay standalone */
:host { background: var(--_surface); }
:host(:hover) { background: var(--_surface-hover); }
:host([data-variant="secondary"]) { … }
:host(:focus-visible) { … }
```

The lint script blocks any `&` appearing as the first non-whitespace token
inside a `:host {` block, plus any literal `:host:not(`, `:host:is(`,
`:host:has(` chained-form occurrence.

---

## 4. Variants, sizes, status — set tokens, do not redeclare properties

Variant and size rules should set `--_*` private custom properties only.
Property assignment (background, color, padding, height …) lives in the
host base or internal element rules, consuming those custom properties
through fallback chains.

```css
/* ✅ Good — variants set tokens, base consumes them */
:host {
  --_surface: var(--sherpa-surface-control-primary-default);
  --_text:    var(--sherpa-text-default-on-color-body);
  background: var(--_surface);
  color:      var(--_text);
}
:host([data-variant="secondary"]) {
  --_surface: transparent;
  --_text:    var(--sherpa-text-default-label);
}

/* ❌ Bad — each variant redeclares every property */
:host([data-variant="secondary"]) {
  background: transparent;
  color: var(--sherpa-text-default-label);
  border-color: …;
  /* …8 more lines… */
}
```

Status (`data-status`) is special: global `sherpa-status.css` already sets
`--_status-*` custom properties that inherit through shadow DOM. Components
**consume only** — never declare per-status blocks:

```css
:host {
  background: var(--_status-surface-strong, var(--sherpa-surface-control-primary-default));
  color:      var(--_status-text-on-color,  var(--sherpa-text-default-on-color-body));
}
```

---

## 5. Disabled styling

Never use `opacity` for disabled. Set inactive tokens per property:

```css
/* ✅ */
:host([disabled]) {
  cursor: not-allowed;
  pointer-events: none;
  color:        var(--sherpa-text-inactive-default);
  background:   var(--sherpa-surface-control-inactive-default);
  border-color: var(--sherpa-border-inactive-default);
}

/* ❌ */
:host([disabled]) { opacity: 0.5; }
```

The lint script flags any `opacity:` declaration inside a `[disabled]`
selector.

---

## 6. Grid rule (sizing / spacing)

All literal pixel values used as fallbacks must land on the
**8 px primary grid**, with **4 px** and **2 px** sub-grids allowed for text
and icon alignment. **1 px** is reserved for borders only.

```
allowed: 1 (borders), 2 (edge), 4, 8, 12, 16, 20, 24, 32, 40, 48, 56, 64, …
forbidden: 3, 5, 6, 7, 9, 10, 11, 13, 14, 15, …
```

This applies to padding, margin, gap, width, height, min/max sizes, icon
sizes — both fallback literals AND the underlying token values you choose
(`--sherpa-space-2xs` = 4, `xs` = 8, `sm` = 12, `default` = 16). The lint
script warns initially, then blocks from Phase 2 onwards.

---

## 7. Hard rules (lint-enforced)

| Rule                                                    | Lint action       |
| ------------------------------------------------------- | ----------------- |
| No chained `:host:not(`, `:host:is(`, `:host:has(`      | **block**         |
| No `&` as first token inside a `:host {` block          | **block**         |
| Component CSS does not redeclare `:host([hidden])`      | **block**         |
| Component CSS does not redeclare `i { font-style: normal }` | **block**     |
| File starts with a JSDoc header comment                 | warn              |
| `opacity:` inside a `[disabled]` selector               | **block**         |
| Off-grid pixel literals (3, 5, 6, 7, 9, 10, 11, …)      | warn → block (P2) |

Run locally:

```sh
npm run lint:css
```
